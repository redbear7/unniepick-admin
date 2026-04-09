/**
 * Gemini Image Generation Utility (Nano Banana 2)
 * 공용 이미지 생성 유틸리티 — 커버, 카드뉴스, 마케팅 에셋에서 재사용
 */

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const MODEL_ID = 'gemini-2.5-flash-image';

// ── 타입 정의 ──────────────────────────────────────────────

export interface GeminiPromptSchema {
  meta?: {
    aspect_ratio?: string;
    resolution?: string;
    quality_mode?: string;
    thinking_level?: 'minimal' | 'high';
    seed?: number | null;
    guidance_scale?: number;
    web_grounding?: boolean;
  };
  subject?: Array<{
    type?: string;
    description?: string;
    position?: string;
    expression?: string;
    clothing?: string;
    skin?: string;
    accessories?: string;
    pose?: string;
    appearance?: Record<string, any>;
    action?: string;
    name?: string;
    details?: string;
  }>;
  scene?: {
    environment?: string;
    location?: string;
    surface?: string;
    props?: string;
    details?: string;
    time_of_day?: string;
    weather?: string;
    depth?: string;
    lighting?: {
      type?: string;
      direction?: string;
      quality?: string;
      secondary?: string;
    };
    background_blur?: string;
    background_elements?: string[];
  };
  camera?: {
    lens?: string;
    lens_mm?: number;
    angle?: string;
    distance?: string;
    framing?: string;
    focus?: string;
    depth_of_field?: string;
    aperture?: string;
    motion?: string;
    film_stock?: string;
  };
  style?: {
    preset?: string;
    aesthetic?: string;
    lighting?: string;
    color_grading?: string;
    film_stock?: string;
    texture?: string;
    mood?: string;
    post_processing?: string;
    color_restriction?: string;
  };
  text_rendering?: Array<{
    content?: string;
    text?: string;
    position?: string;
    placement?: string;
    font_style?: string;
    size?: string;
    color?: string;
    effect?: string;
  }> | { elements?: Array<Record<string, any>> };
  negative_prompt?: string;
}

// ── JSON → 텍스트 프롬프트 변환 ──────────────────────────────

export function jsonToTextPrompt(data: GeminiPromptSchema): string {
  const parts: string[] = [];

  // Subject
  const subjects = data.subject || [];
  for (const subject of subjects) {
    const sp: string[] = [];
    if (subject.description) sp.push(subject.description);
    if (subject.name) sp.push(subject.name);
    if (subject.details) sp.push(subject.details);
    if (subject.expression) sp.push(`expression: ${subject.expression}`);
    if (subject.clothing) sp.push(`wearing ${subject.clothing}`);
    if (subject.skin) sp.push(`skin: ${subject.skin}`);
    if (subject.accessories) sp.push(`with ${subject.accessories}`);
    if (subject.pose) sp.push(`pose: ${subject.pose}`);
    if (subject.action) sp.push(`action: ${subject.action}`);
    if (subject.position) sp.push(`positioned at ${subject.position}`);
    if (subject.appearance) {
      const a = subject.appearance;
      if (a.age) sp.push(`age: ${a.age}`);
      if (a.gender) sp.push(`gender: ${a.gender}`);
      if (a.skin) sp.push(`skin: ${a.skin}`);
      if (a.hair) sp.push(`hair: ${JSON.stringify(a.hair)}`);
      if (a.expression) sp.push(`expression: ${a.expression}`);
    }
    const sType = subject.type || 'subject';
    parts.push(`[${sType}] ${sp.join(', ')}`);
  }

  // Scene
  const scene = data.scene;
  if (scene) {
    const sp: string[] = [];
    if (scene.environment) sp.push(`Setting: ${scene.environment}`);
    if (scene.location) sp.push(`Location: ${scene.location}`);
    if (scene.surface) sp.push(`Surface: ${scene.surface}`);
    if (scene.props) sp.push(`Props: ${scene.props}`);
    if (scene.details) sp.push(`Details: ${scene.details}`);
    if (scene.time_of_day) sp.push(`Time: ${scene.time_of_day}`);
    if (scene.weather) sp.push(`Weather: ${scene.weather}`);
    if (scene.depth) sp.push(`Depth: ${scene.depth}`);
    if (scene.lighting) {
      const l = scene.lighting;
      if (l.type) sp.push(`Lighting: ${l.type}`);
      if (l.direction) sp.push(`Light direction: ${l.direction}`);
      if (l.quality) sp.push(`Light quality: ${l.quality}`);
    }
    if (scene.background_blur) sp.push(`Background blur: ${scene.background_blur}`);
    if (scene.background_elements?.length) sp.push(`Background elements: ${scene.background_elements.join(', ')}`);
    if (sp.length) parts.push('Scene — ' + sp.join('. '));
  }

  // Camera
  const cam = data.camera;
  if (cam) {
    const cp: string[] = [];
    if (cam.lens_mm) cp.push(`${cam.lens_mm}mm lens`);
    if (cam.lens) cp.push(`${cam.lens} lens`);
    if (cam.angle) cp.push(`${cam.angle} angle`);
    if (cam.distance) cp.push(`${cam.distance} shot`);
    if (cam.framing) cp.push(`${cam.framing} framing`);
    if (cam.depth_of_field) cp.push(`depth of field: ${cam.depth_of_field}`);
    if (cam.aperture) cp.push(`aperture ${cam.aperture}`);
    if (cam.focus) cp.push(`focus on ${cam.focus}`);
    if (cam.motion) cp.push(cam.motion);
    if (cam.film_stock) cp.push(`film stock: ${cam.film_stock}`);
    if (cp.length) parts.push('Camera — ' + cp.join(', '));
  }

  // Style
  const style = data.style;
  if (style) {
    const sp: string[] = [];
    if (style.preset || style.aesthetic) sp.push(`Style: ${style.preset || style.aesthetic}`);
    if (style.lighting) sp.push(`Lighting: ${style.lighting}`);
    if (style.color_grading) sp.push(`Color grading: ${style.color_grading}`);
    if (style.film_stock) sp.push(`Film stock: ${style.film_stock}`);
    if (style.texture) sp.push(`Texture: ${style.texture}`);
    if (style.mood) sp.push(`Mood: ${style.mood}`);
    if (style.color_restriction) sp.push(`Color restriction: ${style.color_restriction}`);
    if (style.post_processing) sp.push(`Post: ${style.post_processing}`);
    if (sp.length) parts.push('Style — ' + sp.join('. '));
  }

  // Text Rendering
  const textRender = data.text_rendering;
  if (textRender) {
    const elements = Array.isArray(textRender) ? textRender : (textRender as any).elements || [];
    if (elements.length) {
      const tp: string[] = [];
      for (const t of elements) {
        const content = t.content || t.text || '';
        const pos = t.position || t.placement || 'center';
        const font = t.font_style || 'sans-serif-bold';
        const size = t.size || 'medium';
        const color = t.color || 'white';
        tp.push(`Text "${content}" at ${pos}, ${font}, ${size} size, ${color} color`);
      }
      parts.push('Text on image — ' + tp.join('. '));
    }
  }

  // Negative Prompt
  if (data.negative_prompt) {
    parts.push(`Avoid: ${data.negative_prompt}`);
  }

  return parts.join('\n\n');
}

// ── 이미지 생성 (JSON 프롬프트) ──────────────────────────────

export async function generateImage(
  promptData: GeminiPromptSchema,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NANOBANANA_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');

  const ai = new GoogleGenAI({ apiKey });

  const meta = promptData.meta || {};
  const aspectRatio = meta.aspect_ratio || '1:1';
  const thinkingLevel = meta.thinking_level || 'minimal';

  const textPrompt = jsonToTextPrompt(promptData);

  let fullPrompt = `Generate an image with aspect ratio ${aspectRatio}.\n\n${textPrompt}`;
  if (thinkingLevel === 'high') {
    fullPrompt = `Think carefully about the composition and spatial relationships before generating.\n\n${fullPrompt}`;
  }

  return callGeminiImage(ai, fullPrompt);
}

// ── 이미지 생성 (텍스트 프롬프트 — 기존 커버 호환용) ────────────

export async function generateImageFromText(
  prompt: string,
  aspectRatio: string = '1:1',
): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NANOBANANA_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');

  const ai = new GoogleGenAI({ apiKey });
  const fullPrompt = `Generate an image with aspect ratio ${aspectRatio}.\n\n${prompt}`;
  return callGeminiImage(ai, fullPrompt);
}

// ── 공용 Gemini API 호출 (재시도 포함) ────────────────────────

async function callGeminiImage(
  ai: GoogleGenAI,
  prompt: string,
  maxRetries: number = 3,
): Promise<{ buffer: Buffer; mimeType: string }> {
  let lastError = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          temperature: 1.0,
        },
      });

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            let imageBytes: Buffer;

            if (typeof part.inlineData.data === 'string') {
              imageBytes = Buffer.from(part.inlineData.data, 'base64');
            } else {
              imageBytes = Buffer.from(part.inlineData.data);
            }

            return { buffer: imageBytes, mimeType };
          }
        }
      }

      lastError = '이미지가 생성되지 않았습니다 (텍스트만 반환됨)';
    } catch (e: any) {
      lastError = e.message || String(e);

      // Rate limit 또는 일시적 오류 시 재시도
      if (e.status === 429 || e.status === 503) {
        const waitTime = Math.pow(2, attempt) * 2000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // 다른 에러는 바로 throw
      if (attempt === maxRetries - 1) throw e;
    }
  }

  throw new Error(`이미지 생성 실패 (${maxRetries}회 시도): ${lastError}`);
}

// ── Supabase Storage 업로드 ──────────────────────────────────

export async function uploadToSupabase(
  buffer: Buffer,
  path: string,
  contentType: string = 'image/png',
  bucket: string = 'music-tracks',
): Promise<string> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error } = await sb.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`);

  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
