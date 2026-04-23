/**
 * POST /api/push/test
 * 특정 이메일 유저에게 테스트 푸시 발송
 * body: { email: string, title?: string, body?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { email, title, body } = await req.json().catch(() => ({})) as {
    email?: string;
    title?: string;
    body?: string;
  };

  if (!email?.trim()) {
    return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 });
  }

  const sb = adminSb();

  // 1. 이메일로 user_id 조회 (auth.users)
  const { data: authUsers, error: authErr } = await sb.auth.admin.listUsers();
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  const authUser = authUsers?.users.find(u => u.email === email.trim());
  if (!authUser) {
    return NextResponse.json({ error: `${email} 계정을 찾을 수 없어요` }, { status: 404 });
  }

  // 2. push_token 조회
  const { data: tokenRow, error: tokenErr } = await sb
    .from('push_tokens')
    .select('token, opt_in')
    .eq('user_id', authUser.id)
    .single();

  if (tokenErr || !tokenRow?.token) {
    return NextResponse.json({
      error: '등록된 푸시 토큰이 없어요. 앱에서 알림 권한을 허용했는지 확인해주세요.',
    }, { status: 404 });
  }

  // 3. 테스트 발송
  const pushTitle = title?.trim() || '🧪 언니픽 테스트 알림';
  const pushBody  = body?.trim()  || '푸시 알림이 정상 작동해요! ✅';

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify([{
      to:    tokenRow.token,
      sound: 'default',
      title: pushTitle,
      body:  pushBody,
      data:  { type: 'test' },
    }]),
  });

  const result = await res.json();
  const ticket = result?.data?.[0];

  if (ticket?.status === 'ok') {
    return NextResponse.json({
      ok:    true,
      email,
      token: tokenRow.token.slice(0, 30) + '…',
      summary: `✅ ${email} 에게 테스트 알림 발송 성공`,
    });
  }

  return NextResponse.json({
    ok:      false,
    details: ticket,
    error:   ticket?.message ?? '발송 실패',
  }, { status: 500 });
}
