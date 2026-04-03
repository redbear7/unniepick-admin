import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// CORS 헤더 (Chrome 확장앱에서 호출 허용)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Supabase 서버 클라이언트 (service role 또는 anon key)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // service role key가 있으면 RLS bypass, 없으면 anon key 사용
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// 파일 다운로드 후 Supabase Storage 업로드
async function uploadFromUrl(
  supabase: ReturnType<typeof createClient>,
  remoteUrl: string,
  storagePath: string,
  contentType: string,
): Promise<string | null> {
  try {
    const resp = await fetch(remoteUrl, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const { error } = await supabase.storage
      .from('music-tracks')
      .upload(storagePath, buf, { contentType, upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('music-tracks').getPublicUrl(storagePath);
    return data.publicUrl;
  } catch {
    return null;
  }
}

// Suno 스타일 태그 파싱 → mood / mood_tags
function parseTags(tagsStr: string) {
  const all = tagsStr
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  const mood = all[0] || 'chill';
  return { mood, mood_tags: all };
}

// 제목에서 [핸들] 접두사 분리 → { pureTitle, referenceUrl }
// 예: "[@backtothemelody] Morning Breeze" → title="Morning Breeze", ref="https://www.youtube.com/@backtothemelody/"
function parseTitle(rawTitle: string) {
  const match = rawTitle.match(/^\[(@?[^\]]+)\]\s*(.+)$/);
  if (match) {
    const raw = match[1].trim();
    const pureTitle = match[2].trim();
    const handle = raw.startsWith('@') ? raw : `@${raw}`;
    return { pureTitle, referenceUrl: `https://www.youtube.com/${handle}/` };
  }
  return { pureTitle: rawTitle.trim(), referenceUrl: null };
}

// 파일명 안전 처리 (Supabase 경로용)
function safePath(title: string) {
  return title.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ.\-_ ]/g, '_').trim().substring(0, 120);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  let songs: {
    id: string;
    title: string;
    display_name: string;
    image_url: string | null;
    audio_url: string | null;
    prompt: string;
    tags: string;
    duration: number | null;
    created_at: string | null;
    suno_url: string;
  }[];

  try {
    const body = await req.json();
    songs = body.songs || [];
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식' }, { status: 400, headers: CORS });
  }

  if (!songs.length) {
    return NextResponse.json({ error: '등록할 곡이 없습니다' }, { status: 400, headers: CORS });
  }

  const results: { ok: boolean; title: string; id?: string; error?: string }[] = [];

  for (const song of songs) {
    try {
      const songId = song.id || `suno_${Date.now()}`;

      // ── 제목에서 [핸들] 접두사 분리 ──────────────────────────────────
      const { pureTitle, referenceUrl } = parseTitle(song.title || '(제목 없음)');
      const safeTitle = safePath(pureTitle) || `suno_${songId}`;

      // ── 커버 이미지: Suno CDN → Supabase Storage ──────────────────────
      let coverUrl: string | null = null;
      if (song.image_url) {
        const uploaded = await uploadFromUrl(
          supabase,
          song.image_url,
          `covers/${safeTitle}.jpg`,
          'image/jpeg',
        );
        coverUrl = uploaded || song.image_url; // 업로드 실패 시 원본 URL 유지
      }

      // ── 오디오: Suno CDN → Supabase Storage (핸들 없는 순수 제목으로 저장) ──
      let audioUrl: string | null = song.audio_url;
      if (song.audio_url) {
        const uploaded = await uploadFromUrl(
          supabase,
          song.audio_url,
          `audio/${safeTitle}.mp3`,
          'audio/mpeg',
        );
        audioUrl = uploaded || song.audio_url; // 업로드 실패 시 원본 URL 유지
      }

      // ── 태그 파싱 ──────────────────────────────────────────────────────
      const { mood, mood_tags } = parseTags(song.tags || '');

      // ── music_tracks 테이블 삽입 ──────────────────────────────────────
      const { data: track, error } = await supabase
        .from('music_tracks')
        .insert({
          title: pureTitle,                       // 순수 제목 (핸들 제거)
          artist: song.display_name || 'Suno AI',
          mood,
          mood_tags,
          audio_url: audioUrl,
          cover_image_url: coverUrl,
          duration_sec: song.duration ? Math.round(song.duration) : null,
          is_active: true,
          reference_url: referenceUrl,            // YouTube 채널 레퍼런스
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      results.push({ ok: true, title: song.title, id: track?.id });
    } catch (e) {
      results.push({
        ok: false,
        title: song.title || '(알 수 없음)',
        error: (e as Error).message,
      });
    }
  }

  return NextResponse.json({ results }, { headers: CORS });
}
