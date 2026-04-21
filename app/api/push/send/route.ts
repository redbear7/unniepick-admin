/**
 * POST /api/push/send
 * 전체 또는 opt-in 유저에게 Expo 푸쉬 알림 발송
 *
 * body: { title, body, target: 'all' | 'optin', data?: Record<string,string> }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function sendExpo(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<{ ok: number; fail: number }> {
  if (!tokens.length) return { ok: 0, fail: 0 };

  let ok = 0, fail = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    const messages = chunk.map(token => ({
      to: token, sound: 'default', title, body, data,
    }));
    try {
      const res     = await fetch('https://exp.host/--/api/v2/push/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(messages),
      });
      const json    = await res.json();
      const tickets = (json.data ?? []) as Array<{ status: string }>;
      ok   += tickets.filter(t => t.status === 'ok').length;
      fail += tickets.filter(t => t.status !== 'ok').length;
    } catch {
      fail += chunk.length;
    }
  }
  return { ok, fail };
}

export async function POST(req: NextRequest) {
  const { title, body, target = 'optin', data = {} } =
    await req.json().catch(() => ({})) as {
      title?: string; body?: string;
      target?: 'all' | 'optin';
      data?: Record<string, string>;
    };

  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 });
  }

  const sb = adminSb();

  // 토큰 조회
  let query = sb.from('push_tokens').select('token').not('token', 'is', null);
  if (target === 'optin') query = query.eq('opt_in', true);
  const { data: rows, error: fetchErr } = await query;
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const tokens = (rows ?? []).map((r: any) => r.token as string).filter(Boolean);

  // Expo 발송
  const { ok, fail } = await sendExpo(tokens, title.trim(), body.trim(), {
    type: 'superadmin', ...data,
  });

  // 히스토리 저장
  const { error: histErr } = await sb.from('push_history').insert({
    sender_type:  'superadmin',
    sender_label: '최고관리자',
    title:        title.trim(),
    body:         body.trim(),
    sent_count:   ok,
    read_count:   0,
    target,
  });
  if (histErr) console.warn('[push/send] history insert error:', histErr.message);

  return NextResponse.json({
    ok: true,
    sentCount:   ok,
    failCount:   fail,
    totalTokens: tokens.length,
    summary: `${tokens.length}명 대상 → ${ok}건 발송, ${fail}건 실패`,
  });
}
