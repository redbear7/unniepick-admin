import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCallerRole();
  if (role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음 (시샵만 성우를 수정할 수 있습니다)' }, { status: 403, headers: CORS });
  }

  const { id } = await params;
  const { label, refId, emoji } = await req.json();

  const sb = adminClient();
  const { data, error } = await sb
    .from('fish_voices')
    .update({ label: label?.trim(), ref_id: refId?.trim(), emoji })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json(data, { headers: CORS });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCallerRole();
  if (role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음 (시샵만 성우를 삭제할 수 있습니다)' }, { status: 403, headers: CORS });
  }

  const { id } = await params;
  const sb = adminClient();
  const { error } = await sb.from('fish_voices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json({ ok: true }, { headers: CORS });
}
