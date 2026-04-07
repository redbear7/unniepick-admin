/**
 * POST /api/cardnews/render
 *
 * Remotion 서버사이드 렌더링 파이프라인 (카드뉴스 숏츠).
 * - card_news 테이블에 pending 레코드 삽입 → 렌더링 → Storage 업로드 → done 업데이트
 * - 완료된 MP4를 Supabase Storage(music-tracks/cardnews/)에 업로드 후 공개 URL 반환
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const CORS = { 'Access-Control-Allow-Origin': '*' };
export const maxDuration = 300;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { store_name, cards, template = 'modern' } = await req.json();

  if (!store_name || !Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json(
      { error: 'store_name, cards are required' },
      { status: 400, headers: CORS },
    );
  }

  const supabase = createSupabase();

  // 1. DB에 rendering 레코드 삽입
  const { data: record, error: insertErr } = await supabase
    .from('card_news')
    .insert({ store_name, cards, template, status: 'rendering' })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500, headers: CORS });
  }

  try {
    const { bundle } = await import('@remotion/bundler');
    const { renderMedia, selectComposition } = await import('@remotion/renderer');

    const inputProps = {
      audioUrl: '',
      storeName: store_name,
      cards,
      template,
    };

    // 2. Remotion 번들링
    const bundled = await bundle({
      entryPoint: path.join(process.cwd(), 'remotion', 'index.ts'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      webpackOverride: (config: any) => config,
    });

    // 3. 컴포지션 선택 (카드 수에 따라 durationInFrames 동적 계산)
    const CARD_DURATION = 120; // 4s @ 30fps
    const durationInFrames = cards.length * CARD_DURATION;

    const composition = await selectComposition({
      serveUrl: bundled,
      id: 'CardNewsVideo',
      inputProps,
    });
    composition.durationInFrames = durationInFrames;

    // 4. 임시 출력 경로
    const tmpDir = os.tmpdir();
    const outputPath = path.join(tmpDir, `cardnews_${record.id}_${Date.now()}.mp4`);

    // 5. 렌더링
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
    });

    // 6. Supabase Storage 업로드
    const fileBuffer = fs.readFileSync(outputPath);
    const filename = `cardnews/${record.id}_${Date.now()}.mp4`;

    const { error: uploadErr } = await supabase.storage
      .from('music-tracks')
      .upload(filename, fileBuffer, { contentType: 'video/mp4', upsert: true });

    if (uploadErr) throw new Error(`업로드 실패: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage
      .from('music-tracks')
      .getPublicUrl(filename);

    // 7. 레코드 done 업데이트
    await supabase
      .from('card_news')
      .update({ status: 'done', video_url: urlData.publicUrl })
      .eq('id', record.id);

    // 8. 임시 파일 정리
    try { fs.unlinkSync(outputPath); } catch { /* ignore */ }

    return NextResponse.json(
      { id: record.id, video_url: urlData.publicUrl },
      { headers: CORS },
    );
  } catch (e) {
    await supabase
      .from('card_news')
      .update({ status: 'error', error_message: (e as Error).message })
      .eq('id', record.id);

    console.error('[cardnews/render]', e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: CORS },
    );
  }
}
