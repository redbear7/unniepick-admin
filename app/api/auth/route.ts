import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  // PIN 검증 (서버에서만)
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
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

  if (authError || !data.user) {
    return NextResponse.json({ error: authError?.message ?? '로그인 실패' }, { status: 401 });
  }

  // role 확인
  const { data: role } = await supabase.rpc('get_my_role');
  if (role !== 'superadmin') {
    await supabase.auth.signOut();
    return NextResponse.json({ error: `권한없음 (role: ${role ?? '없음'})` }, { status: 403 });
  }

  return response;
}
