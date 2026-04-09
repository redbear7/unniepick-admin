import { NextRequest, NextResponse } from 'next/server';
import { generateImage, uploadToSupabase, type GeminiPromptSchema } from '@/lib/gemini-image';
import { createClient } from '@supabase/supabase-js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

// 카테고리 → 기본 배경 매핑
const CATEGORY_DEFAULTS: Record<string, { scene: string; mood: string }> = {
  '카페/음료':      { scene: 'cozy artisan cafe, warm wood, morning light', mood: 'warm, inviting' },
  '뷰티':           { scene: 'clean beauty studio, soft pink tones', mood: 'elegant, premium' },
  '패션':           { scene: 'chic boutique, neutral tones, editorial', mood: 'stylish, modern' },
  '헬스케어':       { scene: 'serene wellness space, natural greenery', mood: 'calm, refreshing' },
  '음식점':         { scene: 'warm restaurant, ambient lighting', mood: 'appetizing, cozy' },
  '헤어':           { scene: 'modern hair salon, sleek mirrors', mood: 'trendy, professional' },
  '네일':           { scene: 'elegant nail studio, pastel accents', mood: 'delicate, artistic' },
  '피트니스':       { scene: 'energetic gym, dynamic lighting', mood: 'powerful, motivating' },
  '기타':           { scene: 'modern business interior', mood: 'professional, clean' },
};

// 에셋 유형 → 비율 매핑
const ASSET_CONFIGS: Record<string, { aspect_ratio: string; label: string }> = {
  instagram_feed:     { aspect_ratio: '1:1',  label: '인스타 피드' },
  instagram_story:    { aspect_ratio: '9:16', label: '인스타 스토리' },
  instagram_carousel: { aspect_ratio: '4:5',  label: '인스타 캐러셀' },
  web_banner:         { aspect_ratio: '16:9', label: '웹 배너' },
  youtube_thumbnail:  { aspect_ratio: '16:9', label: '유튜브 썸네일' },
};

interface AssetRequest {
  type: string;
  aspect_ratio: string;
}

export async function POST(req: NextRequest) {
  try {
    const { store_id, store_name, category, assets, subject, scene_override, style_preset, mood_override, text_elements } = await req.json() as {
      store_id?: string;
      store_name: string;
      category: string;
      assets: AssetRequest[];
      subject?: string;
      scene_override?: string;
      style_preset?: string;
      mood_override?: string;
      text_elements?: Array<{ content: string; position: string; color: string }>;
    };

    if (!assets?.length || !store_name) {
      return NextResponse.json({ error: '매장명과 에셋 유형을 선택해주세요' }, { status: 400, headers: CORS });
    }

    const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS['기타'];

    // 각 에셋별 이미지 생성
    const results = [];

    for (const asset of assets) {
      const config = ASSET_CONFIGS[asset.type];
      if (!config) continue;

      const promptData: GeminiPromptSchema = {
        meta: {
          aspect_ratio: config.aspect_ratio,
          resolution: '2K',
          thinking_level: 'high',
        },
        subject: subject ? [{
          type: 'object',
          description: subject,
          position: 'center',
        }] : [],
        scene: {
          environment: scene_override || `${defaults.scene}. Store: ${store_name}`,
          depth: 'medium',
          lighting: { type: 'natural-window', quality: 'soft, professional' },
        },
        camera: {
          lens_mm: 50,
          angle: 'eye-level',
          depth_of_field: 'medium',
        },
        style: {
          preset: style_preset || 'lifestyle-in-context',
          color_grading: 'warm',
          mood: mood_override || defaults.mood,
          texture: 'clean',
        },
        negative_prompt: 'blurry, low quality, distorted, watermark, text, letters, ugly, deformed, bad anatomy',
      };

      // 텍스트 요소 추가
      if (text_elements?.length) {
        promptData.text_rendering = text_elements.map(t => ({
          content: t.content,
          position: t.position,
          color: t.color,
          font_style: 'sans-serif-bold',
          size: 'large',
        }));
      }

      try {
        const { buffer, mimeType } = await generateImage(promptData);
        const ext = mimeType.includes('png') ? 'png' : 'jpg';
        const path = `ai-images/${store_id || 'general'}/${asset.type}_${Date.now()}.${ext}`;
        const url = await uploadToSupabase(buffer, path, mimeType);

        results.push({
          type: asset.type,
          label: config.label,
          aspect_ratio: config.aspect_ratio,
          url,
          status: 'success' as const,
        });
      } catch (e: any) {
        results.push({
          type: asset.type,
          label: config.label,
          aspect_ratio: config.aspect_ratio,
          url: null,
          status: 'error' as const,
          error: e.message,
        });
      }

      // rate limit 방지 딜레이
      await new Promise(r => setTimeout(r, 500));
    }

    // Supabase에 기록 저장 (옵션)
    if (store_id) {
      try {
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        for (const r of results) {
          if (r.status === 'success' && r.url) {
            await sb.from('ai_generated_images').insert({
              store_id,
              asset_type: r.type,
              aspect_ratio: r.aspect_ratio,
              image_url: r.url,
              created_at: new Date().toISOString(),
            }).catch(() => {}); // 테이블 없으면 무시
          }
        }
      } catch {}
    }

    return NextResponse.json({ results }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
