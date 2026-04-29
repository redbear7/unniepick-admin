/**
 * POST /api/restaurants/normalize-categories
 * restaurants 전체 unniepick_category / unniepick_style / unniepick_sub 일괄 정규화
 *
 * v2 카테고리 체계 (핫페퍼 벤치마킹):
 *   unniepick_category : 14개 고정 장르 (음식 종류 + 분위기 혼합)
 *   unniepick_style    : 용도 6종 (술자리 / 회식·단체 / 혼밥·간편식 / 데이트·모임 / 카페·여가 / 일반식사)
 *   unniepick_sub      : 카카오 3뎁스 or 네이버 단일 카테고리 (세부 메뉴)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ── v2 카테고리 규칙 (순서 중요: 구체적인 것 먼저) ─────────────────
const RULES: Array<{ result: string; keywords: string[] }> = [
  { result: '카페·디저트',   keywords: ['카페', '커피', '디저트', '티하우스', '찻집', '테이크아웃커피', '아이스크림', '빙수', '스무디', '버블티'] },
  { result: '베이커리·빵집', keywords: ['베이커리', '빵', '제과', '케이크', '도넛', '크루아상', '파티쉐'] },
  { result: '고기·구이',     keywords: ['삼겹살', '갈비', '곱창', '막창', '대창', '불고기', '오리구이', '닭갈비', '소고기', '돼지고기', '양고기', '족발', '보쌈', '수육', '바비큐', 'bbq', '고기뷔페'] },
  { result: '해산물·회',     keywords: ['회', '해물', '해산물', '수산', '낙지', '조개', '굴', '새우', '랍스터', '대게', '꽃게', '아구', '복어', '장어', '전복', '멍게', '오징어'] },
  { result: '국밥·탕·찌개', keywords: ['국밥', '탕', '해장국', '설렁탕', '순대국', '감자탕', '뼈다귀', '순두부', '된장찌개', '부대찌개', '청국장', '육개장', '곰탕', '삼계탕', '추어탕', '사골'] },
  { result: '면류·냉면',     keywords: ['냉면', '막국수', '칼국수', '수제비', '쌀국수', '쌀면', '짬뽕', '짜장', '라멘', '우동', '소바', '라면'] },
  { result: '일식·초밥',     keywords: ['일식', '초밥', '롤', '돈카츠', '돈까스', '돈부리', '덮밥', '텐동', '오마카세', '이자카야', '야키토리', '타코야키'] },
  { result: '중식',          keywords: ['중식', '중국', '딤섬', '마라', '탕수육', '양꼬치', '훠궈', '마파두부'] },
  { result: '양식·파스타',   keywords: ['양식', '파스타', '리조또', '스테이크', '이탈리안', '프렌치', '스파게티', '그릴', '비프', '스테이크하우스'] },
  { result: '치킨·버거',     keywords: ['치킨', '버거', '햄버거', '패스트푸드', '핫도그', '샌드위치', '피자'] },
  { result: '분식·떡볶이',   keywords: ['분식', '떡볶이', '순대', '김밥', '만두', '튀김', '오뎅', '포장마차', '간식', '닭강정', '토스트', '도넛', '붕어빵'] },
  { result: '술집·이자카야', keywords: ['술집', '호프', '포차', '맥주', '와인바', '칵테일', '펍', '주점', '바', '와인', '막걸리', '사케'] },
  { result: '브런치·샐러드', keywords: ['브런치', '샐러드', '도시락', '건강식', '비건', '채식'] },
  { result: '한식',          keywords: ['한식', '비빔밥', '쌈밥', '백반', '정식', '보리밥', '솥밥', '두부', '기사식당'] },
];

// ── 용도(스타일) 매핑 ────────────────────────────────────────────────
const STYLE_RULES: Array<{ result: string; keywords: string[] }> = [
  { result: '술자리',    keywords: ['술집', '호프', '포차', '이자카야', '맥주', '와인바', '칵테일', '펍', '주점', '와인', '사케'] },
  { result: '회식·단체', keywords: ['삼겹살', '갈비', '곱창', '막창', '고기뷔페', '뷔페', '양꼬치', '훠궈', '바비큐', 'bbq'] },
  { result: '혼밥·간편식', keywords: ['분식', '김밥', '도시락', '라면', '떡볶이', '덮밥', '돈부리', '국밥', '짜장', '짬뽕', '라멘'] },
  { result: '데이트·모임', keywords: ['카페', '브런치', '샐러드', '파스타', '이탈리안', '프렌치', '오마카세', '초밥'] },
  { result: '카페·여가', keywords: ['커피', '디저트', '케이크', '베이커리', '빙수', '아이스크림', '버블티'] },
];

function normalize(raw: string | null | undefined): string {
  if (!raw) return '기타';
  const text = raw.toLowerCase().replace(/\s/g, '');
  for (const { result, keywords } of RULES) {
    if (keywords.some(kw => text.includes(kw.toLowerCase().replace(/\s/g, '')))) return result;
  }
  return '기타';
}

function mapStyle(category: string | null, kakaoCategory: string | null): string {
  const text = `${category ?? ''} ${kakaoCategory ?? ''}`.toLowerCase().replace(/\s/g, '');
  for (const { result, keywords } of STYLE_RULES) {
    if (keywords.some(kw => text.includes(kw.replace(/\s/g, '')))) return result;
  }
  return '일반식사';
}

// 카카오 3뎁스 or 네이버 단일 카테고리를 세부 분류로 사용
function mapSub(kakaoCategory: string | null, naverCategory: string | null): string | null {
  if (kakaoCategory) {
    const parts = kakaoCategory.split('>').map(s => s.trim()).filter(Boolean);
    // 3뎁스(인덱스 2)가 있으면 우선, 없으면 2뎁스
    const sub = parts[2] ?? parts[1] ?? null;
    if (sub && sub !== '음식점' && sub !== '카페') return sub;
  }
  if (naverCategory && naverCategory.length > 0) return naverCategory;
  return null;
}

// 카카오 category_name 중간 뎁스 추출
function kakaoMid(categoryName: string | null): string | null {
  if (!categoryName) return null;
  const parts = categoryName.split('>').map(s => s.trim()).filter(Boolean);
  return parts[1] ?? parts[0] ?? null;
}

export async function POST() {
  const sb = adminSb();

  type Row = {
    id: string;
    name: string | null;
    category: string | null;
    kakao_category: string | null;
    source: string | null;
  };

  const rows: Row[] = [];
  const PAGE = 1000;
  let page = 0;
  while (true) {
    const { data, error } = await sb
      .from('restaurants')
      .select('id, name, category, kakao_category, source')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
    page++;
  }

  let updated = 0;
  const errors: string[] = [];
  const BATCH = 200;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).filter(r => r.id && r.name);

    const patches = batch.map(r => {
      const mid = r.source === 'kakao' ? kakaoMid(r.kakao_category) : null;
      const unniepick_category = normalize(mid ?? r.category);
      const unniepick_style    = mapStyle(r.category, r.kakao_category);
      const unniepick_sub      = mapSub(r.kakao_category, r.category);
      return { id: r.id, name: r.name!, unniepick_category, unniepick_style, unniepick_sub };
    });

    const { error: upsertErr } = await sb
      .from('restaurants')
      .upsert(patches, { onConflict: 'id' });

    if (upsertErr) {
      console.error('[normalize] batch error:', upsertErr.message);
      errors.push(upsertErr.message);
    } else {
      updated += patches.length;
    }
  }

  // 카테고리 분포 집계
  const catDist: Record<string, number> = {};
  const styleDist: Record<string, number> = {};

  for (const r of rows) {
    const mid = r.source === 'kakao' ? kakaoMid(r.kakao_category) : null;
    const cat   = normalize(mid ?? r.category);
    const style = mapStyle(r.category, r.kakao_category);
    catDist[cat]     = (catDist[cat] ?? 0) + 1;
    styleDist[style] = (styleDist[style] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    total: rows.length,
    updated,
    errors: errors.length > 0 ? errors.slice(0, 3) : undefined,
    distribution: Object.entries(catDist)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count })),
    styleDistribution: Object.entries(styleDist)
      .sort((a, b) => b[1] - a[1])
      .map(([style, count]) => ({ style, count })),
  });
}
