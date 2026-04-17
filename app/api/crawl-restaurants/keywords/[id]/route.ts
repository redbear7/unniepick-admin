import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('keyword' in body) patch.keyword = body.keyword;
  if ('description' in body) patch.description = body.description;
  if ('enabled' in body) patch.enabled = body.enabled;
  if ('is_daily' in body) patch.is_daily = body.is_daily;
  if ('analyze_reviews' in body) patch.analyze_reviews = body.analyze_reviews;
  if ('status' in body) patch.status = body.status;        // 수동 리셋용
  if ('last_error' in body) patch.last_error = body.last_error;

  const { data, error } = await sb()
    .from('crawl_keywords')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await sb().from('crawl_keywords').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
