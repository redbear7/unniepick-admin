import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'restaurant-images';
const OUTPUT_WIDTH = 800; // 레티나 대응 (기존 480 → 800)
const JPEG_QUALITY = 92; // 고품질 (기존 80 → 92)
// ── 네이버 이미지 URL → 고해상도 버전으로 변환 ───────────────
function toHighResNaverUrl(url) {
    if (!url)
        return url;
    if (url.includes('pstatic.net')) {
        return url
            .replace(/type=f\d+_\d+_\w+/, 'type=f1080_1080_jpg')
            .replace(/type=s\d+x\d+/, 'type=f1080_1080_jpg');
    }
    if (url.includes('search.pstatic.net')) {
        return url.replace(/[&?]w=\d+/, '').replace(/[&?]h=\d+/, '');
    }
    return url;
}
// ── Sharp 품질 향상 파이프라인 ────────────────────────────────
async function enhanceWithSharp(buffer, meta) {
    const { width = 0, height = 0 } = meta;
    const isSmall = Math.min(width, height) < 400;
    return sharp(buffer)
        .resize(OUTPUT_WIDTH, null, {
        withoutEnlargement: !isSmall, // 소스 작으면 강제 업스케일
        kernel: sharp.kernel.lanczos3, // 최고 품질 리사이즈 커널
    })
        .normalise() // 자동 레벨 (어두운 사진 밝아짐)
        .gamma(isSmall ? 1.6 : 1.3) // 어두운 영역 디테일 살리기
        .modulate({
        brightness: 1.08, // 8% 밝게
        saturation: 1.15, // 15% 채도↑ (음식 색감)
    })
        .sharpen({ sigma: 1.2, m1: 1.0, m2: 2.0 }) // 선명도
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
        .toBuffer();
}
// ── 메인 processImage ─────────────────────────────────────────
export async function processImage(originalUrl, placeId) {
    if (!originalUrl)
        return { url: '', isProcessed: false };
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
        // Step 1: 고해상도 URL 우선 시도 → 실패 시 원본 URL
        const highResUrl = toHighResNaverUrl(originalUrl);
        let buffer = null;
        let usedUrl = originalUrl;
        for (const url of [highResUrl, originalUrl]) {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': 'https://map.naver.com/',
                    'Accept': 'image/*,*/*',
                },
            });
            if (res.ok) {
                buffer = Buffer.from(await res.arrayBuffer());
                usedUrl = url;
                break;
            }
        }
        if (!buffer)
            return { url: originalUrl, isProcessed: false };
        // Step 2: Sharp 강화 파이프라인
        const meta = await sharp(buffer).metadata();
        console.log(`    [image] 소스 ${meta.width}×${meta.height}px${usedUrl !== originalUrl ? ' (고해상도)' : ''}`);
        const enhanced = await enhanceWithSharp(buffer, meta);
        // Step 3: Supabase Storage 업로드
        const { error } = await supabase.storage.from(BUCKET).upload(filename, enhanced, {
            contentType: 'image/jpeg',
            upsert: true,
        });
        if (error) {
            console.log(`    [image] 업로드 실패 ${placeId}: ${error.message}`);
            return { url: originalUrl, isProcessed: false };
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
        console.log(`    [image] ✓ 완료 → ${(enhanced.length / 1024) | 0}KB`);
        return { url: urlData.publicUrl, isProcessed: true };
    }
    catch (e) {
        console.log(`    [image] 처리 실패 ${placeId}: ${e.message}`);
        return { url: originalUrl, isProcessed: false };
    }
}
