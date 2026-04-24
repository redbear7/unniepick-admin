/**
 * POST /api/stamp/party/join
 *
 * 동반자가 파티 코드 입력 → 스탬프 자동 적립
 * Body: { code, user_id }
 * Returns: { success, reason?, stamp_count?, store_name }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { code, user_id } = await req.json();

  if (!code)    return NextResponse.json({ error: '코드를 입력해주세요' }, { status: 400 });
  if (!user_id) return NextResponse.json({ error: 'user_id 필요' },       { status: 400 });

  const sb  = adminClient();
  const now = new Date().toISOString();

  // ── 활성 세션 조회 ─────────────────────────────────────────────
  const { data: session, error: sessionErr } = await sb
    .from('receipt_stamp_sessions')
    .select('id, host_user_id, store_id, max_joins, joined_count, expires_at')
    .eq('party_code', code.toUpperCase().trim())
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionErr || !session) {
    return NextResponse.json({ error: '유효하지 않은 코드예요. 코드를 다시 확인해주세요.' }, { status: 404 });
  }

  // ── 검증 ──────────────────────────────────────────────────────
  if (session.host_user_id === user_id) {
    return NextResponse.json({ error: '본인이 생성한 코드예요' }, { status: 409 });
  }

  const { data: alreadyJoined } = await sb
    .from('receipt_stamp_joins')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', user_id)
    .maybeSingle();

  if (alreadyJoined) {
    return NextResponse.json({ error: '이미 참가한 코드예요' }, { status: 409 });
  }

  if (session.joined_count >= session.max_joins) {
    return NextResponse.json({ error: '인원이 모두 찼어요' }, { status: 409 });
  }

  // ── 스탬프 적립 (try_add_stamp RPC) ───────────────────────────
  const { data: stampResult, error: stampErr } = await sb.rpc('try_add_stamp', {
    p_user_id:  user_id,
    p_store_id: session.store_id,
    p_source:   'receipt',
  });

  if (stampErr) {
    console.error('[party/join] stamp error:', stampErr.message);
    return NextResponse.json({ error: '스탬프 적립 오류' }, { status: 500 });
  }

  // ── 참가 기록 + joined_count 증가 ─────────────────────────────
  await sb.from('receipt_stamp_joins').insert({
    session_id: session.id,
    user_id,
    stamped: (stampResult as any)?.success ?? false,
  });

  await sb
    .from('receipt_stamp_sessions')
    .update({ joined_count: session.joined_count + 1 })
    .eq('id', session.id);

  // ── 가게 이름 조회 ─────────────────────────────────────────────
  const { data: store } = await sb
    .from('stores')
    .select('name')
    .eq('id', session.store_id)
    .single();

  const stamp = stampResult as any;

  return NextResponse.json({
    ok:          true,
    success:     stamp?.success   ?? false,
    reason:      stamp?.reason    ?? null,
    stamp_count: stamp?.stamp_count ?? null,
    is_reward:   stamp?.is_reward ?? false,
    store_name:  store?.name      ?? '',
    remaining:   session.max_joins - session.joined_count - 1,
  });
}
