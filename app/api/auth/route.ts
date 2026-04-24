import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * signInWithPassword 는 Supabase Auth rate limit 소모가 큼.
 * 마지막 성공한 로그인 시각을 메모리에 캐시해서
 * 30초 이내 재요청은 Supabase 호출 없이 세션 재사용.
 */
let lastSignInAt  = 0;
const SIGNIN_COOLDOWN_MS = 30_000; // 30초

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  // PIN 검증
  const correctPin = process.env.ADMIN_PIN ?? '1111';
  if (pin !== correctPin) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않아요' }, { status: 401 });
  }

  const email    = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;

  if (!email || !password || password === '여기에_실제_비밀번호_입력') {
    return NextResponse.json({ error: '.env.local에 ADMIN_PASSWORD를 설정해주세요' }, { status: 500 });
  }

  const cookieStore = await cookies();
  const response    = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // ── 1) 기존 세션 확인 — 유효하면 signInWithPassword 스킵 ──────────────────
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && session.expires_at && session.expires_at * 1000 > Date.now()) {
      const { data: role } = await supabase.rpc('get_my_role');
      if (role === 'superadmin') {
        console.log('[admin/auth] 기존 세션 재사용 — signInWithPassword 스킵');
        return response;
      }
    }
  } catch { /* 세션 확인 실패 시 아래에서 재로그인 */ }

  // ── 2) cooldown — 30초 이내 재시도 차단 (rate limit 방지) ────────────────
  const now = Date.now();
  if (now - lastSignInAt < SIGNIN_COOLDOWN_MS) {
    const remaining = Math.ceil((SIGNIN_COOLDOWN_MS - (now - lastSignInAt)) / 1000);
    return NextResponse.json(
      { error: `잠시 후 다시 시도하세요 (${remaining}초 후)` },
      { status: 429 },
    );
  }

  // ── 3) signInWithPassword ──────────────────────────────────────────────────
  let signInData;
  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      // Supabase rate limit → 알기 쉬운 메시지로 변환
      if (authError.status === 429 || authError.code === 'over_request_rate_limit') {
        return NextResponse.json(
          { error: 'Supabase 인증 요청이 너무 많아요. 1분 후 다시 시도해주세요.' },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: authError.message ?? '로그인 실패' }, { status: 401 });
    }

    if (!data.user) {
      return NextResponse.json({ error: '로그인 실패 (user 없음)' }, { status: 401 });
    }
    signInData = data;
  } catch (e: unknown) {
    const err = e as { status?: number; code?: string; message?: string };
    if (err?.status === 429 || err?.code === 'over_request_rate_limit') {
      return NextResponse.json(
        { error: 'Supabase 인증 요청이 너무 많아요. 1분 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: err?.message ?? '로그인 중 오류' }, { status: 500 });
  }

  // ── 4) role 확인 ───────────────────────────────────────────────────────────
  const { data: role } = await supabase.rpc('get_my_role');
  if (role !== 'superadmin') {
    await supabase.auth.signOut();
    return NextResponse.json({ error: `권한없음 (role: ${role ?? '없음'})` }, { status: 403 });
  }

  lastSignInAt = Date.now(); // 성공 시점 기록
  return response;
}
