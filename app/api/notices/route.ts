import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// GET /api/notices
export async function GET() {
  const { data, error } = await sb()
    .from('notices')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/notices
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { author_name, author_emoji, content, image_url, notice_type, is_pinned } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const { data, error } = await sb()
    .from('notices')
    .insert({
      author_name: author_name ?? '관리자',
      author_emoji: author_emoji ?? '🍖',
      content: content.trim(),
      image_url: image_url ?? null,
      notice_type: notice_type ?? 'general',
      is_pinned: is_pinned ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
