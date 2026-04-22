import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET       = 'restaurant-images';
const OUTPUT_WIDTH = 800;          // 레티나 대응 (기존 480 → 800)
const JPEG_QUALITY = 92;           // 고품질 (기존 80 → 92)

// AI 업스케일 임계값: 소스 이미지 단변이 이 값 미만이면 AI 업스케일 시도
const AI_UPSCALE_THRESHOLD = 300;  // px

// ── 네이버 이미지 URL → 고해상도 버전으로 변환 ───────────────
function toHighResNaverUrl(url: string): string {
  if (!url) return url;

  // ldb-phinf 계열: ?type=f{w}_{h}_{fmt} → f1080_1080_webp
  // 예: https://ldb-phinf.pstatic.net/.../image.jpg?type=f640_640_png
  if (url.includes('pstatic.net')) {
    return url
      .replace(/type=f\d+_\d+_\w+/, 'type=f1080_1080_jpg')   // 크기 파라미터 최대화
      .replace(/type=s\d+x\d+/, 'type=f1080_1080_jpg');        // s 형식도 처리
  }

  // search.pstatic.net: &w=, &h= 파라미터 제거 → 원본 크기
  if (url.includes('search.pstatic.net')) {
    return url.replace(/[&?]w=\d+/, '').replace(/[&?]h=\d+/, '');
  }

  return url;
}

// ── Sharp 품질 향상 파이프라인 ────────────────────────────────
async function enhanceWithSharp(buffer: Buffer, meta: sharp.Metadata): Promise<Buffer> {
  const { width = 0, height = 0 } = meta;
  const isSmall = Math.min(width, height) < 400;

  let pipeline = sharp(buffer)
    // 1. 리사이즈: 소스가 충분히 크면 그냥 800으로, 작으면 2배 업스케일 후 800으로
    .resize(OUTPUT_WIDTH, null, {
      withoutEnlargement: !isSmall,           // 소스 작으면 강제 업스케일
      kernel: sharp.kernel.lanczos3,          // Lanczos3: 최고 품질 리사이즈 커널
    })
    // 2. 자동 레벨 (히스토그램 정규화: 어두운 사진 밝아짐)
    .normalise()
    // 3. 감마 보정: 어두운 부분 살리기 (1.0=변화없음, 2.2=밝게)
    .gamma(isSmall ? 1.6 : 1.3)
    // 4. 밝기·채도 미세 조정
    .modulate({
      brightness: 1.08,   // 8% 밝게
      saturation: 1.15,   // 15% 채도 올리기 (음식 사진 색감)
    })
    // 5. 선명도 (sigma: 반경, flat: 평탄 임계, jagged: 엣지 임계)
    .sharpen({ sigma: 1.2, flat: 1.0, jagged: 2.0 })
    // 6. JPEG 인코딩: mozjpeg로 작은 파일에 높은 품질
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true });

  return pipeline.toBuffer();
}

// ── AI 업스케일 (Replicate Real-ESRGAN) ──────────────────────
// REPLICATE_API_TOKEN 환경변수가 있을 때만 동작, 없으면 스킵
async function aiUpscale(imageUrl: string): Promise<Buffer | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;

  try {
    console.log(`    [image] AI 업스케일 시도...`);

    // Prediction 생성
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa', // Real-ESRGAN x4
        input: {
          image: imageUrl,
          scale: 4,
          face_enhance: false,
        },
      }),
    });

    if (!createRes.ok) return null;

    let prediction = await createRes.json();
    const predId: string = prediction.id;

    // 완료 대기 (최대 60초)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      prediction = await pollRes.json();

      if (prediction.status === 'succeeded') {
        const outputUrl: string = prediction.output;
        const imgRes = await fetch(outputUrl);
        if (!imgRes.ok) return null;
        return Buffer.from(await imgRes.arrayBuffer());
      }
      if (prediction.status === 'failed') return null;
    }
    return null;
  } catch (e) {
    console.log(`    [image] AI 업스케일 실패: ${(e as Error).message}`);
    return null;
  }
}

// ── 메인 processImage ─────────────────────────────────────────
/**
 * 네이버 이미지를 다운로드 → 품질 향상 → Supabase Storage 업로드
 * 개선사항:
 *   1. 네이버 URL 고해상도 버전 우선 요청
 *   2. Sharp 강화 파이프라인 (정규화·감마·밝기·채도·선명도)
 *   3. 소스 저해상도 감지 → AI 업스케일 (REPLICATE_API_TOKEN 설정 시)
 *   4. 출력 800px / JPEG 92% (기존 480px / 80%)
 */
export async function processImage(
  originalUrl: string | undefined,
  placeId: string,
): Promise<{ url: string; isProcessed: boolean }> {
  if (!originalUrl) return { url: '', isProcessed: false };

  const filename = `${placeId}.jpg`;

  // 이미 업로드된 이미지 확인
  const { data: existing } = await supabase.storage.from(BUCKET).list('', {
    search: filename,
    limit: 1,
  });

  if (existing?.length && existing.some((f) => f.name === filename)) {
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return { url: urlData.publicUrl, isProcessed: true };
  }

  try {
    // ── Step 1: 고해상도 URL 시도 → 실패 시 원본 URL ──
    const highResUrl = toHighResNaverUrl(originalUrl);
    let downloadUrl = highResUrl;
    let buffer: Buffer | null = null;

    for (const url of [highResUrl, originalUrl]) {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer':    'https://map.naver.com/',
          'Accept':     'image/*,*/*',
        },
      });
      if (res.ok) {
        buffer = Buffer.from(await res.arrayBuffer());
        downloadUrl = url;
        break;
      }
    }

    if (!buffer) return { url: originalUrl, isProcessed: false };

    // ── Step 2: 소스 메타 분석 ──
    const meta = await sharp(buffer).metadata();
    const { width = 0, height = 0 } = meta;
    const minDim = Math.min(width, height);

    console.log(`    [image] 소스 ${width}×${height}px — ${downloadUrl !== originalUrl ? '고해상도 URL 성공' : '원본 URL 사용'}`);

    let finalBuffer: Buffer;

    // ── Step 3: 저해상도 감지 → AI 업스케일 시도 ──
    if (minDim < AI_UPSCALE_THRESHOLD && process.env.REPLICATE_API_TOKEN) {
      console.log(`    [image] 저해상도(${minDim}px) → AI 업스케일 시도`);
      const aiBuffer = await aiUpscale(downloadUrl);
      if (aiBuffer) {
        console.log(`    [image] AI 업스케일 성공 → Sharp 후처리`);
        const aiMeta = await sharp(aiBuffer).metadata();
        finalBuffer = await enhanceWithSharp(aiBuffer, aiMeta);
      } else {
        console.log(`    [image] AI 업스케일 실패 → Sharp만 적용`);
        finalBuffer = await enhanceWithSharp(buffer, meta);
      }
    } else {
      // ── Step 4: Sharp 강화 파이프라인 ──
      finalBuffer = await enhanceWithSharp(buffer, meta);
    }

    // ── Step 5: Supabase Storage 업로드 ──
    const { error } = await supabase.storage.from(BUCKET).upload(filename, finalBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    if (error) {
      console.log(`    [image] 업로드 실패 ${placeId}: ${error.message}`);
      return { url: originalUrl, isProcessed: false };
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    console.log(`    [image] ✓ 처리 완료 → ${finalBuffer.length / 1024 | 0}KB`);
    return { url: urlData.publicUrl, isProcessed: true };
  } catch (e) {
    console.log(`    [image] 처리 실패 ${placeId}: ${(e as Error).message}`);
    return { url: originalUrl, isProcessed: false };
  }
}
