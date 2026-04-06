import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function getCallerRole(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await adminClient().from('users').select('role').eq('id', user.id).single();
  return data?.role ?? null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  const sb = adminClient();
  const { data, error } = await sb.from('fish_voices').select('*').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json(data ?? [], { headers: CORS });
}

export async function POST(req: NextRequest) {
  const role = await getCallerRole();
  if (role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음 (시샵만 성우를 추가할 수 있습니다)' }, { status: 403, headers: CORS });
  }

  const { label, refId, emoji } = await req.json();
  if (!label?.trim() || !refId?.trim()) {
    return NextResponse.json({ error: '이름과 Reference ID는 필수입니다' }, { status: 400, headers: CORS });
  }

  const sb = adminClient();
  const { data, error } = await sb
    .from('fish_voices')
    .insert({ label: label.trim(), ref_id: refId.trim(), emoji: emoji || '🎙️' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json(data, { status: 201, headers: CORS });
}
