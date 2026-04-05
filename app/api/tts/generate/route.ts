import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Fish Audio: voice_type = 'fish_<referenceId>'
function fishReferenceId(v: string) { return v.slice(5); } // 'fish_' 제거

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { text, voice_type = 'fish_18e99f7be5374fa9b5ae52ed2f51e80d', speed = 1.0, store_id, play_mode = 'immediate', repeat_count = 1, duck_volume = 20 } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: '안내 문구가 없습니다' }, { status: 400, headers: CORS });

  if (!voice_type.startsWith('fish_')) {
    return NextResponse.json({ error: '지원하지 않는 voice_type입니다. fish_ 로 시작해야 합니다.' }, { status: 400, headers: CORS });
  }

  const apiKey      = process.env.FISH_AUDIO_API_KEY;
  const referenceId = fishReferenceId(voice_type);
  if (!apiKey)      return NextResponse.json({ error: 'FISH_AUDIO_API_KEY 미설정' }, { status: 500, headers: CORS });
  if (!referenceId) return NextResponse.json({ error: 'Fish Audio reference_id 가 비어있습니다' }, { status: 400, headers: CORS });

  const clampedSpeed = Math.min(4.0, Math.max(0.25, speed));

  try {
    // ── Fish Audio TTS ─────────────────────────────────────────────
    const fishRes = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        model: 's2-pro',
      },
      body: JSON.stringify({
        text: text.trim(),
        reference_id: referenceId,
        format: 'mp3',
        latency: 'balanced',
        prosody: { speed: clampedSpeed },
      }),
    });
    if (!fishRes.ok) throw new Error(`Fish Audio TTS 실패: ${await fishRes.text()}`);
    const mp3Buf = await fishRes.arrayBuffer();

    // ── Supabase Storage 업로드 ────────────────────────────────────
    const filename = `ann_${Date.now()}_${voice_type}.mp3`;
    const { error: upErr } = await supabase.storage
      .from('announcements')
      .upload(filename, mp3Buf, { contentType: 'audio/mpeg', upsert: false });
    if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);

    const { data: urlData } = supabase.storage.from('announcements').getPublicUrl(filename);
    const audio_url = urlData.publicUrl;

    // ── DB 저장 ────────────────────────────────────────────────────
    const { data: annData, error: dbErr } = await supabase
      .from('store_announcements')
      .insert({ store_id: store_id || null, text: text.trim(), audio_url, voice_type, play_mode, repeat_count, duck_volume, is_active: true })
      .select()
      .single();
    if (dbErr) console.error('[tts/generate] DB 저장 실패:', dbErr.message);

    return NextResponse.json({ audio_url, announcement: dbErr ? null : annData, db_error: dbErr?.message ?? null }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
