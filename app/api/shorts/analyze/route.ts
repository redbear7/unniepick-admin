import { NextRequest, NextResponse } from 'next/server';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * 오디오 URL에서 클라이맥스 구간(30초) 시작 시간 감지
 * 방법: 바이트 레벨 에너지 슬라이딩 윈도우 (Node.js Buffer 분석, Python 불필요)
 * fallback: duration의 35% 지점 (통계적으로 코러스 위치)
 */
async function detectClimaxStart(
  audioUrl: string,
  durationSec: number,
  windowSec = 30,
): Promise<number> {
  try {
    const res = await fetch(audioUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());

    // MP3 바이트 에너지 근사: 1초당 바이트 수 기반 RMS-like 분석
    const chunkSize = Math.floor(buffer.length / durationSec);
    const windowChunks = Math.floor(windowSec);

    let maxEnergy = 0;
    let bestStart = 0;

    for (let s = 0; s <= durationSec - windowSec; s += 1) {
      let energy = 0;
      const startByte = Math.floor(s * chunkSize);
      const endByte = Math.min(
        Math.floor((s + windowChunks) * chunkSize),
        buffer.length,
      );

      // 100바이트마다 샘플링: PCM 0점(128) 기준 절대 편차
      for (let i = startByte; i < endByte; i += 100) {
        energy += Math.abs(buffer[i] - 128);
      }

      if (energy > maxEnergy) {
        maxEnergy = energy;
        bestStart = s;
      }
    }

    // 인트로/아웃트로 제외: 곡의 20%~70% 범위로 보정
    const minStart = durationSec * 0.2;
    const maxStart = durationSec * 0.7;
    if (bestStart < minStart) bestStart = Math.floor(durationSec * 0.35);
    if (bestStart > maxStart) bestStart = Math.floor(durationSec * 0.45);

    return Math.floor(bestStart);
  } catch {
    // fallback: 35% 지점
    return Math.floor(durationSec * 0.35);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { audio_url, duration_sec } = await req.json();

    if (!audio_url || !duration_sec) {
      return NextResponse.json(
        { error: 'audio_url, duration_sec required' },
        { status: 400, headers: CORS },
      );
    }

    const startSec = await detectClimaxStart(audio_url, Number(duration_sec));
    const endSec = Math.min(startSec + 30, Number(duration_sec));

    return NextResponse.json(
      { start_sec: startSec, end_sec: endSec, duration: 30 },
      { headers: CORS },
    );
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: CORS },
    );
  }
}
