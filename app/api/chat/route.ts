import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { openrouterStream } from '@/lib/openrouter';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function getCallerRole(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await adminSb().from('users').select('role').eq('id', user.id).single();
  return data?.role ?? null;
}

async function fetchDbContext(): Promise<string> {
  const sb = adminSb();
  const TABLES = ['stores', 'users', 'owner_pins', 'music_tracks', 'playlists', 'coupons', 'store_posts', 'notices', 'restaurants'];
  const counts = await Promise.all(
    TABLES.map(async (t) => {
      const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
      return `${t}: ${count ?? '?'}개`;
    }),
  );
  return counts.join(', ');
}

async function fetchRestaurantContext(): Promise<string> {
  const sb = adminSb();

  // discovery_score 기준 TOP 30 (쿠폰·블로그리뷰 우선)
  const { data: topPlaces } = await sb
    .from('restaurants')
    .select('name, unniepick_category, unniepick_style, category, rating, visitor_review_count, blog_reviews, ai_summary, address, menu_items, tags, phone, operating_status, discovery_score')
    .order('discovery_score', { ascending: false })
    .order('visitor_review_count', { ascending: false })
    .limit(30);

  if (!topPlaces?.length) return '';

  // 카테고리별 통계
  const categories = new Map<string, number>();
  for (const r of topPlaces) {
    const cat = r.unniepick_category || r.category || '기타';
    categories.set(cat, (categories.get(cat) ?? 0) + 1);
  }

  const catSummary = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, cnt]) => `${cat}(${cnt}개)`)
    .join(', ');

  const restaurantList = topPlaces.map((r) => {
    const menus = Array.isArray(r.menu_items)
      ? r.menu_items.slice(0, 3).map((m: any) => m.name).join(', ')
      : '';
    const blogCount = Array.isArray(r.blog_reviews) ? r.blog_reviews.length : 0;
    const hasCoupon = (r.discovery_score ?? 0) >= 1000;
    const style = r.unniepick_style ? ` [${r.unniepick_style}]` : '';
    const couponTag = hasCoupon ? ' 🎫쿠폰' : '';
    const blogTag = blogCount > 0 ? ` 📝블로그${blogCount}건` : '';
    const summary = r.ai_summary ? ` AI: ${r.ai_summary.slice(0, 40)}…` : '';
    return `- ${r.name} (${r.unniepick_category ?? r.category ?? '기타'}${style})${couponTag}${blogTag} ★${r.rating ?? '?'} | ${r.address ?? ''}${summary} | 메뉴: ${menus || '정보없음'}`;
  }).join('\n');

  return `\n## 창원 맛집 데이터 (노출 점수 TOP 30 — 쿠폰·블로그리뷰 우선)\n카테고리: ${catSummary}\n${restaurantList}`;
}

const SYSTEM_PROMPT = `당신은 unniepick 관리자 전용 AI 어시스턴트입니다.
unniepick은 매장(카페, 음식점 등)에 BGM 음악을 스트리밍하고 AI 음성 안내방송(TTS)을 제공하는 B2B 플랫폼입니다.

## 플랫폼 구성
- **매장(stores)**: BGM 서비스를 이용하는 가게들. owner_pin으로 사장님이 직접 제어
- **음악 관리**: 트랙, 플레이리스트, AI 태깅
- **AI 음성안내**: Fish Audio TTS로 안내방송 생성. 히스토리는 로컬(localStorage) 저장
- **고객 관리**: 회원, 사장님 PIN, 쿠폰, 게시물, 공지사항
- **역할**: superadmin(시샵), owner(사장님), customer(고객)

## 맛집 추천 기능
- 창원/마산/진해 지역 맛집 데이터를 보유 (카카오·네이버 API 기반, 매일 수집)
- 14개 장르: 카페·디저트, 베이커리·빵집, 고기·구이, 해산물·회, 국밥·탕·찌개, 면류·냉면, 일식·초밥, 중식, 양식·파스타, 치킨·버거, 분식·떡볶이, 술집·이자카야, 브런치·샐러드, 한식
- 용도(style): 술자리, 회식·단체, 혼밥·간편식, 데이트·모임, 카페·여가, 일반식사
- 노출 우선순위: 🎫쿠폰 있는 파트너 업체 > 파트너 업체 > 📝블로그리뷰 많은 곳 > AI요약 있는 곳
- "쿠폰 있는 카페", "데이트하기 좋은 파스타", "블로그 리뷰 많은 고기집" 등 응답 가능
- 맛집 정보: 이름, 장르, 용도, 평점, 블로그리뷰 수, 주소, 대표메뉴, AI요약 제공

답변은 한국어로, 간결하고 실용적으로. 데이터 조회나 작업 방법을 물어보면 구체적인 경로/메뉴를 안내하세요.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const role = await getCallerRole();
  if (role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }

  const { messages } = await req.json() as { messages: ChatMessage[] };
  if (!messages?.length) {
    return NextResponse.json({ error: '메시지가 없습니다' }, { status: 400 });
  }

  const [dbContext, restaurantContext] = await Promise.all([
    fetchDbContext(),
    fetchRestaurantContext(),
  ]);
  const systemWithContext = `${SYSTEM_PROMPT}\n\n## 현재 DB 현황\n${dbContext}${restaurantContext}`;

  // 최근 40개 메시지만 유지 (약 20턴)
  const MAX_HISTORY = 40;
  const trimmed = messages.length > MAX_HISTORY
    ? messages.slice(messages.length - MAX_HISTORY)
    : messages;

  const orMessages = trimmed.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await openrouterStream(orMessages, systemWithContext);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

