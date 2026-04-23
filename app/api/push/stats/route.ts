/**
 * GET /api/push/stats
 * 수신자 수, opt-in 수, 히스토리 요약 반환
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET() {
  const sb = adminSb();

  const [tokensRes, optinRes, historyRes] = await Promise.allSettled([
    sb.from('push_tokens').select('user_id', { count: 'exact', head: true }),
    sb.from('push_tokens').select('user_id', { count: 'exact', head: true }).eq('opt_in', true),
    sb.from('push_history').select('id, title, body, link, sent_count, read_count, created_at, target').order('created_at', { ascending: false }).limit(50),
  ]);

  const totalTokens  = tokensRes.status  === 'fulfilled' ? (tokensRes.value.count  ?? 0) : 0;
  const optinTokens  = optinRes.status   === 'fulfilled' ? (optinRes.value.count   ?? 0) : 0;
  const history      = historyRes.status === 'fulfilled' ? (historyRes.value.data  ?? []) : [];

  const totalSent    = history.reduce((s: number, r: any) => s + (r.sent_count ?? 0), 0);
  const totalRead    = history.reduce((s: number, r: any) => s + (r.read_count ?? 0), 0);

  return NextResponse.json({ totalTokens, optinTokens, history, totalSent, totalRead });
}
