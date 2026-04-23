/**
 * POST /api/push/test
 * 특정 전화번호(또는 이메일) 유저에게 테스트 푸시 발송
 * body: { phone?: string, email?: string, title?: string, body?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** 전화번호 → E.164 정규화 (010-xxxx-xxxx / 01012345678 → +8210xxxxxxxx) */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('82')) return `+${digits}`;
  if (digits.startsWith('0'))  return `+82${digits.slice(1)}`;
  return `+82${digits}`;
}

export async function POST(req: NextRequest) {
  const { phone, email, title, body } = await req.json().catch(() => ({})) as {
    phone?: string;
    email?: string;
    title?: string;
    body?: string;
  };

  if (!phone?.trim() && !email?.trim()) {
    return NextResponse.json({ error: '전화번호 또는 이메일을 입력해주세요' }, { status: 400 });
  }

  const sb = adminSb();

  // 1. user_id 조회 — auth.admin.listUsers()는 "Database error finding users" 버그로 사용 불가
  //    1순위: users 테이블 phone 컬럼 직접 매칭
  //    2순위: admin_get_user_phones RPC (auth.users 직접 조회)
  let userId: string | null = null;

  if (phone?.trim()) {
    const normalized = normalizePhone(phone.trim());          // +821085757863
    const local      = '0' + normalized.replace('+82', '');  // 01085757863

    // 1순위: users 테이블
    const { data: usersRow } = await sb
      .from('users')
      .select('id')
      .or(`phone.eq.${normalized},phone.eq.${local},phone.eq.${phone.trim()}`)
      .maybeSingle();
    userId = usersRow?.id ?? null;

    // 2순위: RPC (auth.users phone 조회)
    if (!userId) {
      const { data: phonesData } = await sb.rpc('admin_get_user_phones');
      const matched = (phonesData ?? []).find((u: { id: string; phone: string | null }) =>
        u.phone === normalized || u.phone === local || u.phone === phone.trim()
      );
      userId = matched?.id ?? null;
    }
  } else if (email?.trim()) {
    const { data: row } = await sb
      .from('users').select('id').eq('email', email.trim()).maybeSingle();
    userId = row?.id ?? null;
  }

  const targetLabel = phone?.trim() ?? email?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: `${targetLabel} 계정을 찾을 수 없어요 (앱 가입 여부 확인)` },
      { status: 404 }
    );
  }

  const authUser = { id: userId };

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
    // 앱 알림 내역 저장 (notifications 테이블)
    await sb.from('notifications').insert({
      user_id: authUser.id,
      type:    'event',
      title:   pushTitle,
      body:    pushBody,
      data:    { type: 'test' },
      is_read: false,
    }).then(({ error }) => {
      if (error) console.warn('[push/test] notifications insert error:', error.message);
    });

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
