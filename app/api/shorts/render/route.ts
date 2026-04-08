/**
 * POST /api/shorts/render
 *
 * Remotion 서버사이드 렌더링 파이프라인.
 * - 렌더링은 CPU 집약적 작업으로 수분 소요 가능 (maxDuration: 300s)
 * - 완료된 MP4를 Supabase Storage(music-tracks/shorts/)에 업로드 후 공개 URL 반환
 *
 * NOTE: Vercel Serverless 환경에서는 제한이 있으므로 로컬/자체 서버 환경 권장
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const {
      track_id,
      audio_url,
      cover_url,
      title,
      artist,
      cover_emoji,
      start_sec,
      mood_tags,
      shorts_title,
      shorts_tagline,
      coupon,
      announcement_url,
      announcement_duration_sec,
      element_positions,
      audio_fade_in_sec,
      waveform_style,
      bg_video_url,
      bg_video_duration_sec,
      duration_sec,
    } = await req.json();

    if (!track_id || !audio_url || !title || !artist) {
      return NextResponse.json(
        { error: 'track_id, audio_url, title, artist are required' },
        { status: 400, headers: CORS },
      );
    }

    // Remotion 패키지는 동적 임포트 (번들 크기 및 엣지 런타임 호환)
    const { bundle } = await import('@remotion/bundler');
    const { renderMedia, selectComposition } = await import('@remotion/renderer');

    const inputProps = {
      audioUrl: audio_url,
      coverUrl: cover_url ?? null,
      title,
      artist,
      coverEmoji: cover_emoji ?? '🎵',
      startTimeSec: typeof start_sec === 'number' ? start_sec : 0,
      moodTags: Array.isArray(mood_tags) ? mood_tags : [],
      shortsTitle: shorts_title ?? '',
      shortsTagline: shorts_tagline ?? '',
      coupon: coupon ?? null,
      announcementUrl: announcement_url ?? '',
      announcementDurationSec: typeof announcement_duration_sec === 'number' ? announcement_duration_sec : 0,
      elementPositions: element_positions ?? { headerTop: 11, infoTop: 72, couponTop: 60 },
      audioFadeInSec: typeof audio_fade_in_sec === 'number' ? audio_fade_in_sec : 1.5,
      waveformStyle: waveform_style ?? 'bar',
      bgVideoUrl: bg_video_url ?? null,
      bgVideoDurationSec: typeof bg_video_duration_sec === 'number' ? bg_video_duration_sec : 0,
    };

    const VALID_DURATIONS = [10, 15, 20, 25, 30];
    const durationSec = VALID_DURATIONS.includes(duration_sec) ? duration_sec : 15;
    const durationInFrames = durationSec * 30; // 30fps

    // 1-a. 오디오 파일 로컬 다운로드 (원격 URL 간헐적 fetch 실패 방지)
    let localAudioPath: string | null = null;
    try {
      const audioRes = await fetch(audio_url);
      if (!audioRes.ok) throw new Error(`오디오 다운로드 실패: ${audioRes.status}`);
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      const ext = audio_url.split('?')[0].split('.').pop() ?? 'mp3';
      localAudioPath = path.join(os.tmpdir(), `audio_${track_id}_${Date.now()}.${ext}`);
      fs.writeFileSync(localAudioPath, audioBuffer);
      inputProps.audioUrl = `file://${localAudioPath}`;
    } catch (e) {
      console.warn('[shorts/render] 오디오 로컬 다운로드 실패, 원본 URL 사용:', (e as Error).message);
    }

    // 1. Remotion 번들링
    const bundled = await bundle({
      entryPoint: path.join(process.cwd(), 'remotion', 'index.ts'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      webpackOverride: (config: any) => config,
    });

    // 2. 컴포지션 선택
    const composition = await selectComposition({
      serveUrl: bundled,
      id: 'ShortsVideo',
      inputProps,
      timeoutInMilliseconds: 30000,
    });
    // 선택한 영상 길이로 덮어쓰기
    composition.durationInFrames = durationInFrames;

    // 3. 임시 출력 파일 경로
    const tmpDir = os.tmpdir();
    const outputPath = path.join(tmpDir, `shorts_${track_id}_${Date.now()}.mp4`);

    // 4. 렌더링 (CPU 집약적 — 수십 초 소요)
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
    });

    // 5. Supabase Storage 업로드
    const supabase = createSupabaseServer();
    const fileBuffer = fs.readFileSync(outputPath);
    const filename = `shorts/${track_id}_${Date.now()}.mp4`;

    const { error: uploadErr } = await supabase.storage
      .from('music-tracks')
      .upload(filename, fileBuffer, { contentType: 'video/mp4', upsert: true });

    if (uploadErr) {
      throw new Error(`업로드 실패: ${uploadErr.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('music-tracks')
      .getPublicUrl(filename);

    // 6. 임시 파일 정리
    try { fs.unlinkSync(outputPath); } catch { /* 무시 */ }
    if (localAudioPath) { try { fs.unlinkSync(localAudioPath); } catch { /* 무시 */ } }

    return NextResponse.json({ video_url: urlData.publicUrl }, { headers: CORS });
  } catch (e) {
    console.error('[shorts/render] error:', e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: CORS },
    );
  }
}

// Vercel: 최대 5분 타임아웃 (Pro 플랜 이상 필요)
export const maxDuration = 300;
