/**
 * POST /api/restaurants/normalize-categories
 * 기존 restaurants 레코드의 unniepick_category 일괄 정규화
 *
 * category / kakao_category 값을 읽어 언니픽 고정 카테고리 12개 중 하나로 매핑.
 * 최초 1회 실행 후, 신규 수집은 크롤러에서 자동 적용됨.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ── 언니픽 카테고리 정규화 (category-map.ts 와 동기화 유지) ──────────────────

const RULES: Array<{ result: string; keywords: string[] }> = [
  { result: '카페',      keywords: ['카페', '커피', '디저트', '브런치', '티하우스', '찻집', '테이크아웃커피'] },
  { result: '베이커리',  keywords: ['베이커리', '빵', '제과', '케이크', '도넛', '파티쉐', '크루아상'] },
  { result: '분식',      keywords: ['분식', '떡볶이', '순대', '김밥', '라면', '만두', '튀김', '오뎅', '포장마차'] },
  { result: '치킨·피자', keywords: ['치킨', '피자', '버거', '햄버거', '패스트푸드', '핫도그', '샌드위치'] },
  { result: '고기·구이', keywords: ['고기', '구이', '삼겹살', '갈비', '바비큐', 'bbq', '곱창', '막창', '불고기', '보쌈', '족발'] },
  { result: '해산물·회', keywords: ['회', '해물', '해산물', '수산', '낙지', '조개', '굴', '새우', '랍스터', '대게', '꽃게'] },
  { result: '술집·바',   keywords: ['술집', '바', '포차', '이자카야', '호프', '맥주', '와인바', '칵테일', '펍'] },
  { result: '일식',      keywords: ['일식', '초밥', '롤', '라멘', '우동', '소바', '돈카츠', '돈부리', '덮밥', '텐동', '오마카세'] },
  { result: '중식',      keywords: ['중식', '중국', '짜장', '짬뽕', '딤섬', '마라', '탕수육', '양꼬치'] },
  { result: '양식',      keywords: ['양식', '파스타', '리조또', '스테이크', '이탈리안', '프렌치', '스파게티', '그릴'] },
  { result: '한식',      keywords: ['한식', '설렁탕', '국밥', '비빔밥', '된장', '순두부', '해장국', '쌈밥', '냉면', '칼국수', '수육', '두부', '솥밥', '백반', '정식', '보리밥'] },
];

function normalize(raw: string | null | undefined): string {
  if (!raw) return '기타';
  const text = raw.toLowerCase().replace(/\s/g, '');
  for (const { result, keywords } of RULES) {
    if (keywords.some(kw => text.includes(kw.toLowerCase().replace(/\s/g, '')))) return result;
  }
  return '기타';
}

// 카카오 category_name 중간 뎁스 추출
function kakaoMid(categoryName: string | null): string | null {
  if (!categoryName) return null;
  const parts = categoryName.split('>').map(s => s.trim()).filter(Boolean);
  return parts[1] ?? parts[0] ?? null;
}

export async function POST() {
  const sb = adminSb();

  // 전체 레코드 페이지네이션 조회 (Supabase 기본 1000행 제한 우회)
  type Row = { id: string; name: string | null; category: string | null; kakao_category: string | null; source: string | null };
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
    const batch = rows.slice(i, i + BATCH);

    const patches = batch
      .filter(r => r.id && r.name)
      .map(r => {
        const mid = r.source === 'kakao' ? kakaoMid(r.kakao_category) : null;
        const unniepick_category = normalize(mid ?? r.category);
        return { id: r.id, name: r.name!, unniepick_category };
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

  // 결과 분포 집계
  const dist: Record<string, number> = {};
  for (const r of rows) {
    const mid = r.source === 'kakao' ? kakaoMid(r.kakao_category) : null;
    const cat = normalize(mid ?? r.category);
    dist[cat] = (dist[cat] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    total: rows.length,
    updated,
    errors: errors.length > 0 ? errors.slice(0, 3) : undefined,
    distribution: Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count })),
  });
}
