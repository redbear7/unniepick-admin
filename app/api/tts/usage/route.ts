import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET /api/tts/usage?store_id=xxx
// 오늘 날짜 기준 사용량 + 한도 반환
// { char_count: number, daily_char_limit: number | null, date: string }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const store_id = searchParams.get('store_id');

  if (!store_id) {
    return NextResponse.json({ error: 'store_id 가 필요합니다' }, { status: 400, headers: CORS });
  }

  const client = sb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 가게의 정책 조회 (tts_policies join)
  const { data: storeData, error: storeErr } = await client
    .from('stores')
    .select('tts_policy_id, tts_policies(daily_char_limit)')
    .eq('id', store_id)
    .single();

  if (storeErr) {
    return NextResponse.json({ error: storeErr.message }, { status: 500, headers: CORS });
  }

  // 정책이 없으면 한도 없음 (관리자용)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policy = (storeData as any)?.tts_policies as { daily_char_limit: number } | null;
  const daily_char_limit: number | null = policy ? policy.daily_char_limit : null;

  // 오늘 사용량 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usageData } = await (client as any)
    .from('tts_daily_usage')
    .select('char_count')
    .eq('store_id', store_id)
    .eq('usage_date', today)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const char_count = (usageData as any)?.char_count ?? 0;

  return NextResponse.json({ char_count, daily_char_limit, date: today }, { headers: CORS });
}
