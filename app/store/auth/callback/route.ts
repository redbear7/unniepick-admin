import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${origin}/store/login?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/store/login?error=no_code`);
  }

  const response = NextResponse.redirect(`${origin}/store`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    return NextResponse.redirect(
      `${origin}/store/login?error=${encodeURIComponent(exchangeError?.message ?? 'session_error')}`,
    );
  }

  // 내 가게가 있는지 확인 → 있으면 해당 가게 대시보드로, 없으면 신청 페이지로
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', data.user.id)
    .single();

  if (store?.id) {
    response.headers.set('Location', `${origin}/store/${store.id}`);
  } else {
    response.headers.set('Location', `${origin}/apply`);
  }

  return response;
}
