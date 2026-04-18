import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';

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

  // 평점 TOP 20 맛집
  const { data: topRated } = await sb
    .from('restaurants')
    .select('name, category, rating, review_count, visitor_review_count, address, menu_items, tags')
    .order('rating', { ascending: false })
    .order('visitor_review_count', { ascending: false })
    .limit(20);

  if (!topRated?.length) return '';

  // 카테고리별 통계
  const categories = new Map<string, number>();
  for (const r of topRated) {
    const cat = r.category || '기타';
    categories.set(cat, (categories.get(cat) ?? 0) + 1);
  }

  const catSummary = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, cnt]) => `${cat}(${cnt}개)`)
    .join(', ');

  const restaurantList = topRated.map((r) => {
    const menus = Array.isArray(r.menu_items)
      ? r.menu_items.slice(0, 3).map((m: any) => m.name).join(', ')
      : '';
    return `- ${r.name} (${r.category ?? '기타'}) ★${r.rating ?? '?'} 리뷰${r.visitor_review_count ?? 0}건 | ${r.address ?? ''} | 메뉴: ${menus || '정보없음'}`;
  }).join('\n');

  return `\n## 창원 맛집 데이터 (평점 TOP 20)\n카테고리: ${catSummary}\n${restaurantList}`;
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
- 창원/마산/진해 지역 맛집 데이터를 보유 (네이버 플레이스 기반, 매일 크롤링)
- 카테고리(한식, 일식, 카페 등), 평점, 리뷰 수로 필터링하여 추천 가능
- "신상맛집", "한식 추천", "카페 추천" 등 키워드에 응답
- 맛집 정보: 이름, 카테고리, 평점, 리뷰수, 주소, 대표메뉴 제공

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 });
  }

  const [dbContext, restaurantContext] = await Promise.all([
    fetchDbContext(),
    fetchRestaurantContext(),
  ]);
  const systemWithContext = `${SYSTEM_PROMPT}\n\n## 현재 DB 현황\n${dbContext}${restaurantContext}`;

  const ai = new GoogleGenAI({ apiKey });

  // 컨텍스트 한도 초과 방지: 최근 40개 메시지만 유지 (약 20턴)
  const MAX_HISTORY = 40;
  const trimmed = messages.length > MAX_HISTORY
    ? messages.slice(messages.length - MAX_HISTORY)
    : messages;

  // Gemini history 형식으로 변환 (마지막 user 메시지 제외)
  const history = trimmed.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMessage = trimmed[trimmed.length - 1].content;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const chat = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: { systemInstruction: systemWithContext },
          history,
        });

        const result = await chat.sendMessageStream({ message: lastMessage });

        for await (const chunk of result) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
      } catch (e) {
        controller.enqueue(
          new TextEncoder().encode(`\n[오류: ${(e as Error).message}]`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
