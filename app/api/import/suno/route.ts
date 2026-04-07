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
  supabase: ReturnType<typeof getSupabase>,
  remoteUrl: string,
  storagePath: string,
  contentType: string,
  authToken?: string | null,
): Promise<{ url: string | null; error?: string }> {
  try {
    // 1차: 토큰 포함 시도
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    let resp = await fetch(remoteUrl, { headers, signal: AbortSignal.timeout(30000) });

    // 2차: 토큰 없이 재시도 (공개 CDN URL일 경우 토큰이 오히려 거부될 수 있음)
    if (!resp.ok && authToken) {
      resp = await fetch(remoteUrl, { signal: AbortSignal.timeout(30000) });
    }

    if (!resp.ok) {
      return { url: null, error: `다운로드 실패 HTTP ${resp.status} — ${remoteUrl.substring(0, 80)}` };
    }

    const buf = await resp.arrayBuffer();
    if (buf.byteLength < 1000) {
      return { url: null, error: `파일 크기 비정상 (${buf.byteLength}B) — 빈 파일 또는 만료된 URL` };
    }

    const { error } = await supabase.storage
      .from('music-tracks')
      .upload(storagePath, buf, { contentType, upsert: true });
    if (error) {
      return { url: null, error: `Storage 업로드 실패: ${error.message}` };
    }
    const { data } = supabase.storage.from('music-tracks').getPublicUrl(storagePath);
    return { url: data.publicUrl };
  } catch (e) {
    return { url: null, error: `네트워크 오류: ${(e as Error).message}` };
  }
}

// BPM 추출: "120 BPM", "120bpm", "bpm 120" 등
function extractBpm(str: string): number | null {
  const m = str.match(/\b(\d{2,3})\s*bpm\b/i) || str.match(/\bbpm\s*(\d{2,3})\b/i);
  return m ? Number(m[1]) : null;
}

// Suno 스타일 태그 파싱 → mood / mood_tags / bpm
// tags + prompt 합산, 중복 제거, BPM 태그는 별도 추출
function parseTags(tagsStr: string, promptStr: string = '') {
  const bpm = extractBpm(tagsStr) ?? extractBpm(promptStr) ?? null;

  const combined = [tagsStr, promptStr].join(', ');
  const all = combined
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t && !/^\d+\s*bpm$/i.test(t) && !/^bpm\s*\d+$/i.test(t)); // BPM 토큰 제거

  const unique = [...new Set(all)].filter(Boolean);
  const mood = unique[0] || 'chill';
  return { mood, mood_tags: unique, bpm };
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

// 파일명 안전 처리 (Supabase Storage 경로용)
// Supabase는 ASCII만 안전 — 비ASCII 문자는 제거하고 ID로 보장
function safePath(title: string, id: string) {
  const ascii = title
    .replace(/[^a-zA-Z0-9.\-_ ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .substring(0, 80);
  // ASCII 부분이 너무 짧으면 ID 사용
  return ascii.length >= 3 ? `${ascii}_${id.slice(0, 8)}` : id;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  let songs: {
    id:           string;
    title:        string;
    display_name: string;
    image_url:    string | null;
    audio_url:    string | null;
    prompt:       string;
    tags:         string;
    lyrics:       string;
    duration:     number | null;
    created_at:   string | null;
    suno_url:     string;
  }[];
  let sunoToken: string | null = null;

  try {
    const body = await req.json();
    songs = body.songs || [];
    sunoToken = body.token || null;
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
      const safeTitle = safePath(pureTitle, songId);

      // ── 커버 이미지: Suno CDN → Supabase Storage ──────────────────────
      let coverUrl: string | null = null;
      if (song.image_url) {
        const coverResult = await uploadFromUrl(
          supabase,
          song.image_url,
          `covers/${safeTitle}.jpg`,
          'image/jpeg',
          sunoToken,
        );
        coverUrl = coverResult.url; // 업로드 실패 시 null (만료되는 Suno URL 저장 방지)
      }

      // ── 오디오: Suno CDN → Supabase Storage (핸들 없는 순수 제목으로 저장) ──
      const remoteAudioUrl = song.audio_url || `https://cdn1.suno.ai/${songId}.mp3`;
      const audioResult = await uploadFromUrl(
        supabase,
        remoteAudioUrl,
        `audio/${safeTitle}.mp3`,
        'audio/mpeg',
        sunoToken,
      );
      if (!audioResult.url) {
        throw new Error(audioResult.error || '오디오 다운로드/업로드 실패');
      }
      const audioUrl = audioResult.url;

      // ── 태그 파싱 (tags + prompt 합산, BPM 추출) ──────────────────────
      const { mood, mood_tags, bpm } = parseTags(song.tags || '', song.prompt || '');

      // ── music_tracks 테이블 삽입 ──────────────────────────────────────
      const { data: track, error } = await supabase
        .from('music_tracks')
        .insert({
          title:          pureTitle,    // 순수 제목 (핸들 제거)
          artist:         '언니픽',      // 아티스트 고정
          mood,
          mood_tags,
          bpm,
          audio_url:      audioUrl,
          cover_image_url: coverUrl,
          duration_sec:   song.duration ? Math.round(song.duration) : null,
          is_active:      true,
          reference_url:  referenceUrl || null,   // YouTube 핸들 URL만
          suno_url:       song.suno_url || null,  // Suno 원본 링크 별도 저장
          lyrics:         song.lyrics?.trim() || null,
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
