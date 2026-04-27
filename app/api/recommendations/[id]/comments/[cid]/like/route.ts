/**
 * POST /api/recommendations/[id]/comments/[cid]/like
 * 댓글 좋아요 토글
 * Returns { liked: boolean, like_count: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; cid: string }> },
) {
  const { cid } = await context.params;

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

  const admin = db();

  const { data: existing } = await admin
    .from('recommendation_comment_likes')
    .select('id')
    .eq('comment_id', cid)
    .eq('user_id', user.id)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    await admin.from('recommendation_comment_likes').delete().eq('id', existing.id);
    liked = false;
  } else {
    await admin.from('recommendation_comment_likes').insert({ comment_id: cid, user_id: user.id });
    liked = true;
  }

  const { count } = await admin
    .from('recommendation_comment_likes')
    .select('*', { count: 'exact', head: true })
    .eq('comment_id', cid);

  await admin.from('recommendation_comments').update({ like_count: count ?? 0 }).eq('id', cid);

  return NextResponse.json({ liked, like_count: count ?? 0 });
}
