import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = 'restaurant-images';
const MOBILE_WIDTH = 480;
const JPEG_QUALITY = 80;

/**
 * 네이버 이미지를 다운로드 → 모바일용 리사이즈 → Supabase Storage 업로드
 * @returns Supabase 공개 URL (실패 시 원본 URL 반환)
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
    // 이미지 다운로드
    const res = await fetch(originalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*',
      },
    });

    if (!res.ok) return { url: originalUrl, isProcessed: false };

    const buffer = Buffer.from(await res.arrayBuffer());

    // sharp로 리사이즈 (480px 너비, JPEG 80% 품질)
    const resized = await sharp(buffer)
      .resize(MOBILE_WIDTH, null, { withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    // Supabase Storage 업로드
    const { error } = await supabase.storage.from(BUCKET).upload(filename, resized, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    if (error) {
      console.log(`    [image] 업로드 실패 ${placeId}: ${error.message}`);
      return { url: originalUrl, isProcessed: false };
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return { url: urlData.publicUrl, isProcessed: true };
  } catch (e) {
    console.log(`    [image] 처리 실패 ${placeId}: ${(e as Error).message}`);
    return { url: originalUrl, isProcessed: false };
  }
}
