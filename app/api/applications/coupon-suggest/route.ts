/**
 * POST /api/applications/coupon-suggest
 *
 * 가게 정보(이름, 카테고리, 주소)를 바탕으로
 * AI가 쿠폰 3가지를 추천해 줌
 *
 * Response: { suggestions: CouponSuggestion[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { openrouterChat, openrouterModel } from '@/lib/openrouter';

export interface CouponSuggestion {
  discount_type:  'free_item' | 'percent' | 'amount';
  title:          string;
  discount_value: number;
  free_item_name: string | null;
  reason:         string;
  best_time?:     string | null;
  target?:        string | null;
  expected_effect?: string | null;
}

export async function POST(req: NextRequest) {
  const { store_name, category, address, mode, first_benefit } = await req.json() as {
    store_name?:    string;
    category?:      string;
    address?:       string;
    mode?:          'cards' | 'quick';
    first_benefit?: string;
  };

  if (!store_name) {
    return NextResponse.json({ error: '가게명이 필요합니다' }, { status: 400 });
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

  const categoryName = categoryLabel[category ?? ''] ?? category ?? '일반';
  const isQuick = mode === 'quick';

  const prompt = `당신은 창원 지역 상권 활성화를 돕는 소상공인 쿠폰 기획자입니다.
목표는 "싸게 파는 느낌"보다 "오늘 방문할 이유"를 만드는 것입니다.
다음 가게 정보를 바탕으로 ${isQuick ? '사장님이 바로 복사해 쓸 수 있는 첫 혜택 문구 3개' : '팔로워 유치에 효과적인 쿠폰 3가지'}를 추천해주세요.

가게명: ${store_name}
카테고리: ${categoryName}
주소: ${address ?? '정보 없음'}
사장님 초안 혜택: ${first_benefit?.trim() || '없음'}

규칙:
- 서로 다른 discount_type(free_item, percent, amount)을 각각 1개씩 추천
- 카테고리에 어울리는 현실적인 혜택만 추천
- 창원 동네 상권에 맞게 너무 과한 할인은 피하고, 한산 시간대/첫방문/동행 방문을 자연스럽게 유도
- title은 ${isQuick ? '26자 이내의 사장님 말투 혜택 문구' : '20자 이내, 고객이 바로 이해할 수 있게'}
- free_item은 free_item_name에 구체적 아이템명 작성
- percent는 5~20% 범위, amount는 500~5000원 범위
- reason은 18자 이내로 핵심만
- best_time은 추천 사용 시간대. 예: "14:00-17:00", 없으면 null
- target은 "첫방문", "재방문", "동행", "한산시간" 중 하나
- expected_effect는 "첫 방문 유도", "재방문 강화", "객단가 상승", "한산시간 보완" 중 하나

반드시 아래 JSON 배열만 반환(마크다운 없이):
[
  {
    "discount_type": "free_item",
    "title": "쿠폰 이름",
    "discount_value": 0,
    "free_item_name": "아이템명",
    "reason": "추천 이유",
    "best_time": "14:00-17:00",
    "target": "첫방문",
    "expected_effect": "첫 방문 유도"
  },
  {
    "discount_type": "percent",
    "title": "쿠폰 이름",
    "discount_value": 10,
    "free_item_name": null,
    "reason": "추천 이유",
    "best_time": null,
    "target": "재방문",
    "expected_effect": "재방문 강화"
  },
  {
    "discount_type": "amount",
    "title": "쿠폰 이름",
    "discount_value": 2000,
    "free_item_name": null,
    "reason": "추천 이유",
    "best_time": "17:00-20:00",
    "target": "동행",
    "expected_effect": "객단가 상승"
  }
]`;

  try {
    const raw = await openrouterChat(prompt, {
      system: '반드시 유효한 JSON 배열만 출력한다. 한국어로 짧고 실전적인 쿠폰 문구를 만든다.',
      temperature: 0.65,
      maxTokens: 900,
    });

    const jsonStr = raw
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed: CouponSuggestion[] = JSON.parse(jsonStr);
    const suggestions = normalizeSuggestions(parsed, store_name, categoryName);

    const valid = suggestions.every(s =>
      s.discount_type && s.title && typeof s.discount_value === 'number'
    );
    if (!valid) throw new Error('AI 응답 형식 오류');

    return NextResponse.json({
      suggestions: suggestions.slice(0, 3),
      model_provider: 'openrouter',
      model: openrouterModel(),
    });
  } catch (e: unknown) {
    console.error('[coupon-suggest] error:', (e as Error).message);
    const fallback = fallbackSuggestions(store_name, categoryName);
    return NextResponse.json({ suggestions: fallback, model_provider: 'fallback' });
  }
}

function normalizeSuggestions(items: CouponSuggestion[], storeName: string, categoryName: string) {
  const fallback = fallbackSuggestions(storeName, categoryName);
  const allowedTypes = ['free_item', 'percent', 'amount'] as const;
  return allowedTypes.map((type, index) => {
    const item = items.find(s => s.discount_type === type) ?? fallback[index];
    const title = String(item.title ?? fallback[index].title).trim().slice(0, 32);
    const discountValue = Number(item.discount_value);
    return {
      discount_type: type,
      title: title || fallback[index].title,
      discount_value: type === 'free_item'
        ? 0
        : clamp(
          Number.isFinite(discountValue) ? discountValue : fallback[index].discount_value,
          type === 'percent' ? 5 : 500,
          type === 'percent' ? 20 : 5000,
        ),
      free_item_name: type === 'free_item'
        ? String(item.free_item_name ?? fallback[index].free_item_name ?? '').trim().slice(0, 20) || fallback[index].free_item_name
        : null,
      reason: String(item.reason ?? fallback[index].reason).trim().slice(0, 24),
      best_time: item.best_time ? String(item.best_time).trim().slice(0, 20) : null,
      target: item.target ? String(item.target).trim().slice(0, 12) : fallback[index].target,
      expected_effect: item.expected_effect ? String(item.expected_effect).trim().slice(0, 16) : fallback[index].expected_effect,
    };
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fallbackSuggestions(storeName: string, categoryName: string): CouponSuggestion[] {
  const freeItem = categoryName.includes('카페') ? '아메리카노 1잔'
    : categoryName.includes('음식') ? '사이드 메뉴 1개'
      : categoryName.includes('미용') || categoryName.includes('네일') ? '케어 서비스'
        : '서비스 상품 1개';

  return [
    {
      discount_type: 'free_item',
      title: `첫 방문 ${freeItem} 제공`,
      discount_value: 0,
      free_item_name: freeItem,
      reason: '첫 방문 부담 낮춤',
      best_time: categoryName.includes('카페') ? '14:00-17:00' : null,
      target: '첫방문',
      expected_effect: '첫 방문 유도',
    },
    {
      discount_type: 'percent',
      title: '재방문 10% 할인',
      discount_value: 10,
      free_item_name: null,
      reason: '다시 올 이유 제공',
      best_time: null,
      target: '재방문',
      expected_effect: '재방문 강화',
    },
    {
      discount_type: 'amount',
      title: '2인 방문 2천원 할인',
      discount_value: 2000,
      free_item_name: null,
      reason: '동행 방문 유도',
      best_time: '17:00-20:00',
      target: '동행',
      expected_effect: '객단가 상승',
    },
  ];
}
