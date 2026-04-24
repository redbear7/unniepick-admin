/**
 * POST /api/stamp/party/create
 *
 * 영수증 인증 후 동반자 스탬프 공유 세션 생성
 * Body: { user_id, store_id, max_joins }  ← 동반자 최대 인원 (호스트 제외)
 * Returns: { code, expires_at }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// 6자리 코드: 대문자 + 숫자, 혼동하기 쉬운 문자(0·O·1·I) 제외
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  const { user_id, store_id, max_joins } = await req.json();

  if (!user_id)  return NextResponse.json({ error: 'user_id 필요' },  { status: 400 });
  if (!store_id) return NextResponse.json({ error: 'store_id 필요' }, { status: 400 });

  const sb     = adminClient();
  const now    = new Date().toISOString();
  const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30분

  // 코드 중복 회피 (최대 5회 재시도)
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const { data: clash } = await sb
      .from('receipt_stamp_sessions')
      .select('id')
      .eq('party_code', code)
      .gt('expires_at', now)
      .maybeSingle();
    if (!clash) break;
    if (attempt === 4) {
      return NextResponse.json({ error: '코드 생성 실패, 잠시 후 재시도해주세요' }, { status: 500 });
    }
  }

  const { error } = await sb
    .from('receipt_stamp_sessions')
    .insert({
      host_user_id: user_id,
      store_id,
      party_code:   code,
      max_joins:    Math.max(1, max_joins ?? 1),
      joined_count: 0,
      expires_at:   expiry,
    });

  if (error) {
    console.error('[party/create]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, code, expires_at: expiry });
}
