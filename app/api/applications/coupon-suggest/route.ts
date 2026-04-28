/**
 * POST /api/applications/coupon-suggest
 *
 * 가게 정보(이름, 카테고리, 주소)를 바탕으로
 * Gemini 2.0 Flash가 쿠폰 3가지를 추천해 줌
 *
 * Response: { suggestions: CouponSuggestion[] }
 */
import { NextRequest, NextResponse } from 'next/server';

export interface CouponSuggestion {
  discount_type:  'free_item' | 'percent' | 'amount';
  title:          string;
  discount_value: number;
  free_item_name: string | null;
  reason:         string; // 추천 이유 1줄
}

export async function POST(req: NextRequest) {
  const { store_name, category, address } = await req.json() as {
    store_name?: string;
    category?:  string;
    address?:   string;
  };

  if (!store_name) {
    return NextResponse.json({ error: '가게명이 필요합니다' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 });
  }

  const categoryLabel: Record<string, string> = {
    cafe:    '카페',
    food:    '음식점',
    beauty:  '미용실',
    nail:    '네일샵',
    fashion: '의류',
    fitness: '헬스/운동',
    mart:    '마트/편의점',
    etc:     '기타',
  };

  const prompt = `당신은 소상공인 마케팅 전문가입니다.
다음 가게 정보를 바탕으로 팔로워(단골 고객) 유치에 효과적인 쿠폰 3가지를 추천해주세요.

가게명: ${store_name}
카테고리: ${categoryLabel[category ?? ''] ?? category ?? '일반'}
주소: ${address ?? '정보 없음'}

규칙:
- 서로 다른 discount_type(free_item, percent, amount)을 각각 1개씩 추천
- 현실적이고 가게 업종에 맞는 쿠폰
- title은 20자 이내, 고객이 바로 이해할 수 있게
- free_item은 free_item_name에 구체적 아이템명 작성
- percent는 5~30% 범위, amount는 500~5000원 범위
- reason은 15자 이내로 핵심만

반드시 아래 JSON 배열만 반환(마크다운 없이):
[
  {
    "discount_type": "free_item",
    "title": "쿠폰 이름",
    "discount_value": 0,
    "free_item_name": "아이템명",
    "reason": "추천 이유"
  },
  {
    "discount_type": "percent",
    "title": "쿠폰 이름",
    "discount_value": 10,
    "free_item_name": null,
    "reason": "추천 이유"
  },
  {
    "discount_type": "amount",
    "title": "쿠폰 이름",
    "discount_value": 2000,
    "free_item_name": null,
    "reason": "추천 이유"
  }
]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        }),
      },
    );

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message ?? `Gemini HTTP ${res.status}`);
    }

    const resp = await res.json();
    const raw  = resp.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // JSON 파싱 — 마크다운 블록 제거
    const jsonStr = raw
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const suggestions: CouponSuggestion[] = JSON.parse(jsonStr);

    // 최소 유효성 검증
    const valid = suggestions.every(s =>
      s.discount_type && s.title && typeof s.discount_value === 'number'
    );
    if (!valid) throw new Error('AI 응답 형식 오류');

    return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
  } catch (e: unknown) {
    console.error('[coupon-suggest] error:', (e as Error).message);
    // fallback — 기본 추천 3개
    const fallback: CouponSuggestion[] = [
      {
        discount_type: 'free_item',
        title: `${store_name} 팔로워 전용 서비스`,
        discount_value: 0,
        free_item_name: '음료 1잔',
        reason: '첫 방문 유도에 효과적',
      },
      {
        discount_type: 'percent',
        title: `팔로워 10% 할인`,
        discount_value: 10,
        free_item_name: null,
        reason: '재방문율 높임',
      },
      {
        discount_type: 'amount',
        title: `팔로워 2,000원 할인`,
        discount_value: 2000,
        free_item_name: null,
        reason: '즉각적인 혜택 체감',
      },
    ];
    return NextResponse.json({ suggestions: fallback });
  }
}
