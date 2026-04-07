import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ── 무드 → 커버 아트 프롬프트 매핑 ──────────────────────────────
const MOOD_VISUAL: Record<string, { style: string; palette: string; elements: string }> = {
  'lo-fi':           { style: 'lo-fi anime aesthetic', palette: 'muted purples, warm oranges, soft pinks', elements: 'cozy room with vinyl records, rain on window, desk lamp glow' },
  'jazz':            { style: 'vintage jazz club poster art', palette: 'deep golds, smoky blues, warm browns', elements: 'saxophone silhouette, dim stage lights, smoke wisps' },
  'acoustic':        { style: 'warm folk illustration', palette: 'earthy browns, forest greens, golden light', elements: 'acoustic guitar, wooden cabin, autumn leaves' },
  'cozy':            { style: 'hygge lifestyle illustration', palette: 'warm amber, cream, soft orange', elements: 'candle light, knit blanket, steaming cup' },
  'chill':           { style: 'dreamy pastel digital art', palette: 'soft blue, lavender, mint green', elements: 'floating clouds, gentle waves, sunset gradient' },
  'upbeat':          { style: 'vibrant pop art', palette: 'bright yellow, hot pink, electric blue', elements: 'geometric shapes, confetti, neon signs' },
  'bright':          { style: 'sun-drenched watercolor', palette: 'golden yellow, sky blue, fresh green', elements: 'sunflowers, clear sky, morning light' },
  'pop':             { style: 'modern pop album art', palette: 'neon pink, electric purple, white', elements: 'holographic elements, glossy surface, mirror ball' },
  'indie':           { style: 'indie film photography', palette: 'faded film tones, warm highlights', elements: 'polaroid frames, wildflowers, vintage camera' },
  'ambient':         { style: 'ethereal abstract art', palette: 'deep navy, aurora green, soft white', elements: 'northern lights, cosmic nebula, still water reflection' },
  'lounge':          { style: 'mid-century modern illustration', palette: 'olive, burnt sienna, cream', elements: 'retro furniture, cocktail glass, palm fronds' },
  'r&b':             { style: 'moody R&B aesthetic', palette: 'deep purple, rose gold, midnight blue', elements: 'velvet texture, city lights bokeh, moonlight' },
  'tropical':        { style: 'tropical paradise illustration', palette: 'turquoise, coral, palm green', elements: 'palm trees, ocean waves, tropical flowers' },
  'morning-coffee':  { style: 'cozy cafe illustration', palette: 'warm brown, cream, soft gold', elements: 'coffee cup steam, bakery window, morning sun' },
  'fresh':           { style: 'clean minimal design', palette: 'mint, white, light blue', elements: 'dew drops, spring breeze, fresh leaves' },
  'warm':            { style: 'golden hour photography', palette: 'sunset orange, warm pink, amber', elements: 'golden wheat field, warm embrace, fireplace' },
  'night':           { style: 'neon noir cityscape', palette: 'deep blue, neon purple, city glow', elements: 'rainy street, neon reflections, empty road' },
  'energetic':       { style: 'dynamic action art', palette: 'fire red, electric orange, black', elements: 'lightning bolts, motion blur, explosion of color' },
  'EDM':             { style: 'futuristic EDM festival art', palette: 'neon cyan, magenta, UV purple', elements: 'laser beams, waveform visuals, LED grid' },
  'k-pop':           { style: 'K-pop concept art', palette: 'pastel pink, holographic, white', elements: 'cherry blossoms, starlight, crystal elements' },
  'study':           { style: 'minimalist study aesthetic', palette: 'warm gray, soft white, wood tones', elements: 'open books, desk plant, soft lamp light' },
  'latin':           { style: 'vibrant Latin art', palette: 'passionate red, gold, warm orange', elements: 'flamenco silhouette, rose petals, sunset' },
  'romantic':        { style: 'romantic impressionist painting', palette: 'rose pink, deep red, soft gold', elements: 'rose garden, moonlit balcony, silk curtains' },
};

const DEFAULT_VISUAL = { style: 'modern abstract album art', palette: 'gradients of blue and purple', elements: 'abstract shapes, light particles' };

function buildPrompt(title: string, moods: string[], artist: string, description: string, lyrics?: string | null, store_category?: string, format: 'portrait' | 'landscape' | 'ghibli' = 'portrait'): string {
  const primary = moods[0] || '';
  const visual = MOOD_VISUAL[primary] || DEFAULT_VISUAL;
  const moodStr = moods.slice(0, 3).join(', ');
  const descLine = description ? `\nSong description: ${description}.` : '';

  // 언어별 인물 描写
  const lang = detectLanguage(lyrics);
  const ethnicity = getEthnicityDescriptor(lang);

  // 패션/뷰티 카테고리는 흑백 스타일
  const isFashion = ['beauty', 'mall'].includes(store_category || '');
  const colorPalette = isFashion
    ? 'monochrome, black and white, high contrast'
    : visual.palette;
  const styleDesc = isFashion
    ? 'fashion editorial style, minimalist'
    : visual.style;

  // 포맷별 프롬프트 (모두 1:1 비율로 생성)
  let albumCoverText = '';
  let styleOverride = '';

  if (format === 'ghibli') {
    albumCoverText = `Studio Ghibli style anime character portrait. Beautiful hand-drawn animation style. ${ethnicity} character. Soft, dreamy watercolor aesthetic. Expressive eyes, flowing hair. Mood: ${moodStr}.`;
    styleOverride = 'studio ghibli animation style, hand-drawn, watercolor, soft-focus, anime';
  } else if (format === 'portrait') {
    albumCoverText = `Professional portrait album cover of a ${ethnicity} singer/vocalist performing. Dynamic angles - profile, frontal, or 3/4 view. Expressive face, professional headshot style. Mood: ${moodStr}.`;
  } else {
    albumCoverText = `Scenic landscape or environmental album cover. ABSOLUTELY NO PEOPLE, completely person-free. Urban cityscape, nature, abstract environment, or atmospheric scene. Mood: ${moodStr}.`;
  }

  const finalStyle = styleOverride || styleDesc;

  return `Professional album cover art (1:1 square). ${albumCoverText}
Mood: "${title}".${descLine}
Style: ${finalStyle}
Color palette: ${format === 'ghibli' ? 'soft pastels, watercolor tones' : colorPalette}.
Design elements: ${isFashion ? 'clean, minimal, fashion-forward' : visual.elements}.
ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO TYPOGRAPHY, NO WRITING, NO LOGOS, COMPLETELY TEXT-FREE. High quality, detailed, professional artwork.`;
}

// 가사에서 [Description: ...] 추출
function extractDescription(lyrics?: string | null): string {
  if (!lyrics) return '';
  const match = lyrics.match(/\[Description:\s*([^\]]+)\]/i);
  if (match) return match[1].trim();
  // 첫 줄이 // 주석이면 사용
  const first = lyrics.split('\n')[0]?.trim();
  if (first?.startsWith('//')) return first.slice(2).trim();
  return '';
}

// 가사 언어 감지 및 인물 描写 생성
function detectLanguage(text?: string | null): 'ko' | 'en' | 'ja' | 'zh' | 'other' {
  if (!text) return 'other';
  // 한글 (가나다...)
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  // 일본어 (히라가나, 가타카나, 한자)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) return 'ja';
  // 중국어 (한자)
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\uAC00-\uD7AF]/.test(text)) return 'zh';
  // 영어
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'other';
}

// 언어별 인물 描写
function getEthnicityDescriptor(lang: 'ko' | 'en' | 'ja' | 'zh' | 'other'): string {
  const descriptors: Record<string, string> = {
    'ko': 'Korean person',
    'en': 'Caucasian person',
    'ja': 'Japanese person',
    'zh': 'East Asian person',
    'other': 'person',
  };
  return descriptors[lang] || 'person';
}

/**
 * POST /api/cover/generate
 * body: { track_id, title, artist, mood_tags: string[] }
 * → fal.ai Flux로 커버 생성 → Supabase Storage 업로드 → DB 업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const { track_id, title, artist, mood_tags, lyrics, store_category, format } = await req.json();
    if (!track_id || !title) {
      return NextResponse.json({ error: '트랙 ID와 제목이 필요합니다' }, { status: 400, headers: CORS });
    }

    // 1. 프롬프트 생성 (가사 설명, 언어 기반 인물, 카테고리별 스타일 반영)
    const description = extractDescription(lyrics);
    const prompt = buildPrompt(title, mood_tags || [], artist || '', description, lyrics, store_category, format || 'portrait');

    // 2. 이미지 생성: Pollinations.ai 무료 모델 (Flux) + 재시도
    const encoded = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&nologo=true&seed=${Date.now()}&model=flux`;

    let imgRes = null;
    let imgBuf = null;
    let lastError = '';

    // 재시도 로직 (최대 3번, 429 에러 시 대기)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(120000) });

        if (imgRes.ok) {
          imgBuf = await imgRes.arrayBuffer();
          break;
        }

        if (imgRes.status === 429) {
          // Rate limit: 대기 후 재시도
          const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
          lastError = `Rate limit (429) - ${waitTime}ms 대기 후 재시도...`;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        lastError = `HTTP ${imgRes.status}`;
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!imgBuf) throw new Error(`이미지 다운로드 실패: ${lastError}`);

    // 4. Supabase Storage 업로드
    const sb = getSupabase();
    const filename = `covers/ai_${track_id}_${Date.now()}.jpg`;
    const { error: upErr } = await sb.storage
      .from('music-tracks')
      .upload(filename, imgBuf, { contentType: 'image/jpeg', upsert: true });
    if (upErr) throw new Error(`Storage 업로드 실패: ${upErr.message}`);

    const { data: urlData } = sb.storage.from('music-tracks').getPublicUrl(filename);
    const publicUrl = urlData.publicUrl;

    // 5. music_tracks 테이블 업데이트
    const { error: dbErr } = await sb
      .from('music_tracks')
      .update({ cover_image_url: publicUrl })
      .eq('id', track_id);
    if (dbErr) throw new Error(`DB 업데이트 실패: ${dbErr.message}`);

    return NextResponse.json({ cover_url: publicUrl, prompt }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
