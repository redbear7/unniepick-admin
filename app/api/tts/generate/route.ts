import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

// TTS 일별 한도 초과 여부 확인 (실제 기록은 성공 후 recordUsage에서 수행)
async function checkLimit(
  supabase: ReturnType<typeof createClient>,
  store_id: string,
  charCount: number,
): Promise<{ allowed: boolean; errorMsg?: string }> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 가게의 정책 조회
  const { data: storeData } = await supabase
    .from('stores')
    .select('tts_policy_id, tts_policies(daily_char_limit)')
    .eq('id', store_id)
    .single();

  const policy = storeData?.tts_policies as { daily_char_limit: number } | null;
  const daily_char_limit: number | null = policy ? policy.daily_char_limit : null;

  // 정책 미할당 또는 무제한(-1) 이면 항상 허용
  if (daily_char_limit === null || daily_char_limit === -1) {
    return { allowed: true };
  }

  // 오늘 사용량 조회
  const { data: usageData } = await supabase
    .from('tts_daily_usage')
    .select('char_count')
    .eq('store_id', store_id)
    .eq('usage_date', today)
    .maybeSingle();

  const currentUsage = usageData?.char_count ?? 0;

  // 한도 초과 여부 확인
  if (currentUsage + charCount > daily_char_limit) {
    return {
      allowed: false,
      errorMsg: `오늘 TTS 사용 한도(${daily_char_limit.toLocaleString()}자)를 초과했습니다. (사용: ${currentUsage.toLocaleString()}자 / 한도: ${daily_char_limit.toLocaleString()}자)`,
    };
  }

  return { allowed: true };
}

// 성공 후 사용량 upsert (increment)
async function recordUsage(
  supabase: ReturnType<typeof createClient>,
  store_id: string,
  charCount: number,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  // Supabase JS v2 does not support increment in upsert directly,
  // so we use a raw SQL via rpc or handle with select+upsert
  const { data: existing } = await supabase
    .from('tts_daily_usage')
    .select('char_count')
    .eq('store_id', store_id)
    .eq('usage_date', today)
    .maybeSingle();

  const newCount = (existing?.char_count ?? 0) + charCount;
  await supabase.from('tts_daily_usage').upsert(
    { store_id, usage_date: today, char_count: newCount, updated_at: new Date().toISOString() },
    { onConflict: 'store_id,usage_date' },
  );
}

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
  const charCount = text.trim().length;

  try {
    // ── TTS 일별 한도 체크 ─────────────────────────────────────────
    if (store_id) {
      const { allowed, errorMsg } = await checkLimit(supabase, store_id, charCount);
      if (!allowed) {
        return NextResponse.json({ error: errorMsg }, { status: 429, headers: CORS });
      }
    }

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

    // ── 로컬 파일 저장 ────────────────────────────────────────────
    const filename   = `ann_${Date.now()}_${voice_type}.mp3`;
    const saveDir    = path.join(process.cwd(), 'public', 'announcements');
    const localPath  = path.join(saveDir, filename);
    await mkdir(saveDir, { recursive: true });
    await writeFile(localPath, Buffer.from(mp3Buf));

    const audio_url  = `/announcements/${filename}`;

    // ── TTS 사용량 기록 ───────────────────────────────────────────
    if (store_id) {
      await recordUsage(supabase, store_id, charCount);
    }

    // 히스토리는 클라이언트 localStorage에서 관리 (DB 저장 없음)
    return NextResponse.json({ audio_url, local_path: localPath }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
