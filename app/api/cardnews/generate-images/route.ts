import { NextRequest, NextResponse } from 'next/server';
import { generateImage, uploadToSupabase, type GeminiPromptSchema } from '@/lib/gemini-image';

const CORS = { 'Access-Control-Allow-Origin': '*' };

// 카테고리 → 배경 환경 매핑
const CATEGORY_SCENE: Record<string, string> = {
  '카페/음료':  'cozy artisan cafe interior, warm wood tones, coffee cups, pastries, morning light through windows',
  '뷰티':      'clean modern beauty studio, soft pink and white tones, beauty products, mirrors, ring light',
  '패션':      'chic fashion boutique, clothing racks, modern display, neutral tones, editorial feel',
  '헬스케어':   'serene wellness space, natural greenery, calm water elements, clean white, zen atmosphere',
  '음식점':    'inviting restaurant interior, warm ambient lighting, elegant table setting, fresh ingredients',
  '교육':      'bright modern classroom, books, creative supplies, motivational atmosphere',
  '헤어':      'stylish hair salon, sleek mirrors, professional tools, modern lighting',
  '네일':      'elegant nail art studio, delicate colors, crystal accents, soft lighting',
  '피트니스':   'energetic gym space, dynamic lighting, workout equipment, motivational vibe',
  '기타':      'modern business interior, clean lines, professional atmosphere',
};

// 템플릿 → 스타일 매핑
const TEMPLATE_STYLE: Record<string, { aesthetic: string; color_grading: string; mood: string; lighting: string }> = {
  modern:  { aesthetic: 'cinematic', color_grading: 'cinematic', mood: 'sleek, premium', lighting: 'dramatic-rim' },
  bright:  { aesthetic: 'lifestyle-in-context', color_grading: 'vibrant', mood: 'energetic, cheerful', lighting: 'natural-window' },
  minimal: { aesthetic: 'minimalist', color_grading: 'muted', mood: 'clean, serene', lighting: 'overcast-diffused' },
};

interface Card {
  title: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { store_name, category, cards, template } = await req.json() as {
      store_name: string;
      category: string;
      cards: Card[];
      template: string;
    };

    if (!cards?.length) {
      return NextResponse.json({ error: '카드가 없습니다' }, { status: 400, headers: CORS });
    }

    const scene = CATEGORY_SCENE[category] || CATEGORY_SCENE['기타'];
    const style = TEMPLATE_STYLE[template] || TEMPLATE_STYLE.modern;

    // 각 카드별 이미지 생성 프롬프트 구성
    const promises = cards.map(async (card, index) => {
      const promptData: GeminiPromptSchema = {
        meta: {
          aspect_ratio: '9:16',
          resolution: '1K',
          thinking_level: 'minimal',
        },
        scene: {
          environment: `${scene}. Context: ${store_name} - ${card.title}`,
          depth: 'medium',
          lighting: {
            type: style.lighting,
            quality: 'soft, atmospheric',
          },
        },
        camera: {
          lens_mm: 35,
          angle: 'eye-level',
          depth_of_field: 'medium',
        },
        style: {
          aesthetic: style.aesthetic,
          color_grading: style.color_grading,
          mood: style.mood,
          texture: 'clean',
        },
        negative_prompt: 'text, letters, words, typography, writing, logos, watermark, blurry, low quality, distorted, people, faces, hands',
      };

      try {
        const { buffer, mimeType } = await generateImage(promptData);
        const ext = mimeType.includes('png') ? 'png' : 'jpg';
        const path = `cardnews/bg_${Date.now()}_${index}.${ext}`;
        const url = await uploadToSupabase(buffer, path, mimeType);
        return { card_index: index, url, status: 'success' as const };
      } catch (e: any) {
        return { card_index: index, url: null, status: 'error' as const, error: e.message };
      }
    });

    // 200ms 간격으로 순차 시작 (rate limit 방지)
    const results = [];
    for (const promise of promises) {
      results.push(await promise);
      await new Promise(r => setTimeout(r, 200));
    }

    return NextResponse.json({ images: results }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
