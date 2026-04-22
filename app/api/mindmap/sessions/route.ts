/**
 * GET  /api/mindmap/sessions  → 세션 목록
 * POST /api/mindmap/sessions  → 새 세션 생성
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const { data, error } = await sb()
    .from('brainstorm_sessions')
    .select('id, title, date, mindmap, core_insights, created_at, updated_at')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { title, date } = body as { title?: string; date?: string };

  const { data, error } = await sb()
    .from('brainstorm_sessions')
    .insert({
      title: title?.trim() || '새 회의',
      date:  date || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
