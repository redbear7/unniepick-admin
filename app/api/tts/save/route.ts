import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { text, audio_url, voice_type, play_mode = 'immediate', repeat_count = 1, duck_volume = 20, store_id } = await req.json();
  if (!text?.trim() || !audio_url) return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400, headers: CORS });

  const { data, error } = await supabase
    .from('store_announcements')
    .insert({
      store_id:     store_id || null,
      text:         text.trim(),
      audio_url,
      voice_type,
      play_mode,
      repeat_count,
      duck_volume,
      is_active:    true,
    })
    .select()
    .single();

  if (error) {
    console.error('[tts/save] DB 오류:', error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message, hint: error.hint }, { status: 500, headers: CORS });
  }
  return NextResponse.json({ announcement: data }, { headers: CORS });
}
