/**
 * POST /api/admin/extract-menu
 * FormData: file (image/*)
 * Returns: { representative_price, price_label, items: [{name, price}] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const PROMPT = `당신은 식당 메뉴판 이미지를 분석하는 전문가입니다.
이미지에서 메뉴 항목과 가격을 추출해서 JSON으로 반환하세요.

반환 형식 (반드시 이 JSON만, 다른 텍스트 없이):
{
  "items": [{ "name": "메뉴명", "price": 숫자(원) }],
  "representative_price": 숫자(가장 기본적인 단품 메뉴 가격, 없으면 null),
  "price_label": "짧은 가격 설명 (예: '밀면 8,000원~', '런치 9,000원~')"
}

규칙:
- price는 반드시 숫자(원 단위), 문자열 아님
- 세트/combo 가격보다 단품 가격 우선
- representative_price는 items 중 가장 대표적인 단품의 가격
- price_label은 15자 이내로 간결하게
- 가격을 읽을 수 없으면 null`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '이미지 파일이 없습니다' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: '이미지 파일이 없습니다' }, { status: 400 });

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');

  const ai = new GoogleGenAI({ apiKey });

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: file.type, data: base64 } },
            { text: PROMPT },
          ],
        },
      ],
    });

    const text = result.text ?? '';
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: {
      items?: { name: string; price: number | null }[];
      representative_price?: number | null;
      price_label?: string | null;
    };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
    }

    return NextResponse.json({
      items:                parsed.items ?? [],
      representative_price: parsed.representative_price ?? null,
      price_label:          parsed.price_label ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'AI 분석 실패' }, { status: 500 });
  }
}
