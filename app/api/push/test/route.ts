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
  const { phone, email, role, title, body } = await req.json().catch(() => ({})) as {
    phone?: string;
    email?: string;
    role?:  string;   // 'developer' → 해당 역할 회원 전체 발송
    title?: string;
    body?:  string;
  };

  // ── 역할 전체 발송 모드 ────────────────────────────────────────────
  if (role) {
    const sb = adminSb();
    const pushTitle = title?.trim() || '🧪 언니픽 테스트 알림';
    const pushBody  = body?.trim()  || '푸시 알림이 정상 작동해요! ✅';

    // 해당 역할 유저 ID 조회
    const { data: roleUsers, error: roleErr } = await sb
      .from('users')
      .select('id')
      .eq('role', role);

    if (roleErr) {
      return NextResponse.json({ error: roleErr.message }, { status: 500 });
    }
    if (!roleUsers?.length) {
      return NextResponse.json({ error: `역할 '${role}'인 회원이 없어요` }, { status: 404 });
    }

    const userIds = roleUsers.map((u: { id: string }) => u.id);

    // push_token 조회
    const { data: tokenRows } = await sb
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds);

    if (!tokenRows?.length) {
      return NextResponse.json({ error: '등록된 푸시 토큰이 없어요' }, { status: 404 });
    }

    // 일괄 발송
    const messages = tokenRows.map((t: { user_id: string; token: string }) => ({
      to:    t.token,
      sound: 'default',
      title: pushTitle,
      body:  pushBody,
      data:  { type: 'test' },
    }));

    const expRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(messages),
    });
    const expJson = await expRes.json();
    const tickets  = expJson?.data ?? [];
    const okCount  = (tickets as Array<{ status: string }>).filter(t => t.status === 'ok').length;

    return NextResponse.json({
      ok:      true,
      summary: `✅ ${role} ${tokenRows.length}명 중 ${okCount}명 발송 성공`,
    });
  }

  if (!phone?.trim() && !email?.trim()) {
    return NextResponse.json({ error: '전화번호 또는 이메일을 입력해주세요' }, { status: 400 });
  }

  const sb = adminSb();

  let userId: string | null = null;
  const debug: Record<string, unknown> = {};

  if (phone?.trim()) {
    const normalized = normalizePhone(phone.trim());          // +821085757863
    const local      = '0' + normalized.replace('+82', '');  // 01085757863

    debug.normalized = normalized;
    debug.local      = local;

    // 1순위: users 테이블 phone 컬럼 직접 매칭
    const { data: usersRow, error: usersErr } = await sb
      .from('users')
      .select('id')
      .or(`phone.eq.${normalized},phone.eq.${local},phone.eq.${phone.trim()}`)
      .maybeSingle();
    userId = usersRow?.id ?? null;
    debug.usersTableResult = usersRow;
    if (usersErr) debug.usersTableError = usersErr.message;

    // 2순위: users 테이블 name 으로도 탐색 (name 컬럼에 번호 저장하는 엣지 케이스)
    if (!userId) {
      const { data: allUsers } = await sb
        .from('users')
        .select('id, name, phone')
        .limit(200);
      debug.allUsersCount = allUsers?.length ?? 0;
      debug.allUsersSample = (allUsers ?? []).slice(0, 5).map(u => ({
        id: u.id.slice(0, 8),
        name: u.name,
        phone: u.phone,
      }));
    }

    // 3순위: RPC (auth.users phone 조회)
    if (!userId) {
      const { data: phonesData, error: rpcErr } = await sb.rpc('admin_get_user_phones');
      if (rpcErr) {
        debug.rpcError = rpcErr.message;
      } else {
        const allPhones = (phonesData ?? []) as { id: string; phone: string | null }[];
        debug.rpcCount = allPhones.length;
        debug.rpcSample = allPhones.slice(0, 3).map(u => ({
          id: u.id.slice(0, 8),
          phone: u.phone,
        }));
        // auth.users phone 포맷: +821085757863 / 821085757863 / 01085757863 모두 허용
        const noPlus = normalized.replace('+', '');  // 821085757863
        const matched = allPhones.find(u =>
          u.phone === normalized ||
          u.phone === noPlus     ||
          u.phone === local      ||
          u.phone === phone.trim()
        );
        userId = matched?.id ?? null;
        debug.rpcMatched = matched ? { id: matched.id.slice(0, 8), phone: matched.phone } : null;
      }
    }
  } else if (email?.trim()) {
    const { data: row } = await sb
      .from('users').select('id').eq('email', email.trim()).maybeSingle();
    userId = row?.id ?? null;
  }

  const targetLabel = phone?.trim() ?? email?.trim();
  if (!userId) {
    return NextResponse.json(
      {
        error: `${targetLabel} 계정을 찾을 수 없어요 (앱 가입 여부 확인)`,
        debug,
      },
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
      phone,
      token: tokenRow.token.slice(0, 30) + '…',
      summary: `✅ ${targetLabel} 에게 테스트 알림 발송 성공`,
    });
  }

  return NextResponse.json({
    ok:      false,
    details: ticket,
    error:   ticket?.message ?? '발송 실패',
  }, { status: 500 });
}
