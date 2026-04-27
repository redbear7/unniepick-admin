/**
 * GET  /api/recommendations/[id]/comments
 * POST /api/recommendations/[id]/comments  { content }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const { data, error } = await db()
    .from('recommendation_comments')
    .select('*')
    .eq('recommendation_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: '인증 실패' }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: '댓글 내용을 입력하세요' }, { status: 400 });

  const phone = user.phone ?? '';
  const display = phone.length >= 8 ? `${phone.slice(0,3)}-****-${phone.slice(-4)}` : '익명';

  const admin = db();
  const { data, error } = await admin
    .from('recommendation_comments')
    .insert({
      recommendation_id: id,
      user_id:      user.id,
      user_display: display,
      content:      content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // comment_count 갱신
  const { count } = await admin
    .from('recommendation_comments')
    .select('*', { count: 'exact', head: true })
    .eq('recommendation_id', id);
  await admin.from('user_recommendations').update({ comment_count: count ?? 0 }).eq('id', id);

  return NextResponse.json({ data });
}
