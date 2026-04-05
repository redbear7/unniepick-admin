import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Fish Audio 공개 한국어 보이스 (기본값)
const DEFAULT_REFERENCE_ID = '18e99f7be5374fa9b5ae52ed2f51e80d'; // 한국어 남성 내레이션

export async function POST(req: NextRequest) {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'FISH_AUDIO_API_KEY 미설정 (.env.local 확인)' },
      { status: 500, headers: CORS },
    );
  }

  const body = await req.json().catch(() => ({}));
  const text         = (body.text         as string) || '안녕하세요. 피쉬 오디오 연결 테스트입니다.';
  const reference_id = (body.reference_id as string) || DEFAULT_REFERENCE_ID;
  const format       = (body.format       as string) || 'mp3';
  const model        = (body.model        as string) || 's1';
  const speed        = (body.speed        as number) || 1.0;

  const startMs = Date.now();

  try {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        model,
      },
      body: JSON.stringify({
        text,
        reference_id,
        format,
        latency: 'balanced',
        prosody: { speed },
      }),
    });

    const elapsedMs = Date.now() - startMs;

    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch {}
      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          error: `Fish Audio API 오류 ${res.status}: ${errText}`,
          elapsed_ms: elapsedMs,
        },
        { status: 200, headers: CORS }, // 클라이언트에서 status field로 판단
      );
    }

    // 성공: 오디오 바이너리 수신
    const audioBuf  = await res.arrayBuffer();
    const bytesMB   = (audioBuf.byteLength / 1024 / 1024).toFixed(2);
    const base64    = Buffer.from(audioBuf).toString('base64');

    return NextResponse.json(
      {
        ok: true,
        model,
        reference_id,
        text,
        format,
        size_mb: bytesMB,
        elapsed_ms: elapsedMs,
        audio_base64: base64,           // data URI로 바로 재생 가능
        content_type: res.headers.get('content-type') ?? `audio/${format}`,
      },
      { status: 200, headers: CORS },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message, elapsed_ms: Date.now() - startMs },
      { status: 500, headers: CORS },
    );
  }
}
