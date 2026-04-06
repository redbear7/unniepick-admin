'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Film,
  Search,
  Loader2,
  Zap,
  Download,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Music2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

// ─── 타입 ──────────────────────────────────────────────────────
interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  cover_image_url: string | null;
  cover_emoji: string;
  duration_sec: number;
  bpm: number | null;
  energy_level: 'low' | 'medium' | 'high' | null;
  mood_tags: string[];
  energy_score?: number | null;
}

// ─── 헬퍼 ──────────────────────────────────────────────────────
function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ENERGY_KO: Record<string, string> = { low: '낮음', medium: '보통', high: '높음' };

const ENERGY_COLOR: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400',
};

// ─── 플레이어 (간이 오디오 미리듣기) ────────────────────────────
function MiniPlayer({
  audioUrl,
  startSec,
}: {
  audioUrl: string;
  startSec: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.currentTime = startSec;
      el.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing, startSec]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  // 시작 시간 바뀌면 재생 중지
  useEffect(() => {
    const el = audioRef.current;
    if (el && playing) {
      el.pause();
      setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSec]);

  const elapsed = Math.max(0, currentTime - startSec);
  const width = Math.min((elapsed / 30) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-[#FF6F0F] flex items-center justify-center hover:bg-[#e86200] transition shrink-0"
      >
        {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FF6F0F] rounded-full transition-all duration-300"
            style={{ width: `${width}%` }}
          />
        </div>
        <p className="text-[10px] text-muted">
          {fmtSec(startSec)} ~ {fmtSec(startSec + 30)} 미리듣기
        </p>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────
export default function ShortsPage() {
  const sb = createClient();

  // 트랙 목록
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [filtered, setFiltered] = useState<MusicTrack[]>([]);
  const [query, setQuery] = useState('');
  const [loadingTracks, setLoadingTracks] = useState(true);

  // 선택된 트랙
  const [selected, setSelected] = useState<MusicTrack | null>(null);

  // 클라이맥스 / 시작 시간
  const [startSec, setStartSec] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  // 렌더링
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 페이지네이션
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 8;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageTracks = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── 트랙 로드 ──
  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    setLoadingTracks(true);
    const { data, error } = await sb
      .from('music_tracks')
      .select(
        'id, title, artist, audio_url, cover_image_url, cover_emoji, duration_sec, bpm, energy_level, mood_tags, energy_score',
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      setTracks(data as MusicTrack[]);
      setFiltered(data as MusicTrack[]);
    }
    setLoadingTracks(false);
  };

  // ── 검색 필터 ──
  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setFiltered(tracks);
    } else {
      setFiltered(
        tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            (t.mood_tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
        ),
      );
    }
    setPage(0);
  }, [query, tracks]);

  // ── 트랙 선택 ──
  const handleSelect = (track: MusicTrack) => {
    setSelected(track);
    setStartSec(Math.floor(track.duration_sec * 0.35));
    setAnalyzed(false);
    setVideoUrl(null);
    setRenderError(null);
  };

  // ── 클라이맥스 자동 감지 ──
  const handleAnalyze = async () => {
    if (!selected) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/shorts/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: selected.audio_url,
          duration_sec: selected.duration_sec,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '분석 실패');
      setStartSec(json.start_sec);
      setAnalyzed(true);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── 쇼츠 렌더링 요청 ──
  const handleRender = async () => {
    if (!selected) return;
    setRendering(true);
    setVideoUrl(null);
    setRenderError(null);
    try {
      const res = await fetch('/api/shorts/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: selected.id,
          audio_url: selected.audio_url,
          cover_url: selected.cover_image_url,
          title: selected.title,
          artist: selected.artist,
          cover_emoji: selected.cover_emoji,
          start_sec: startSec,
          mood_tags: selected.mood_tags ?? [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '렌더링 실패');
      setVideoUrl(json.video_url);
    } catch (e) {
      setRenderError((e as Error).message);
    } finally {
      setRendering(false);
    }
  };

  const maxStart = selected ? Math.max(0, selected.duration_sec - 30) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f1117]">
      {/* ── 헤더 ── */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[#FF6F0F]/15 flex items-center justify-center">
          <Film size={18} className="text-[#FF6F0F]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-primary">쇼츠 영상 생성</h1>
          <p className="text-xs text-muted mt-0.5">
            음악 트랙에서 클라이맥스 구간을 추출해 9:16 쇼츠 영상(30초)을 생성합니다.
          </p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── 왼쪽: 트랙 선택 패널 ── */}
        <div className="w-[360px] shrink-0 border-r border-white/5 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-primary">트랙 선택</p>

            {/* 검색 */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="제목, 아티스트, 태그 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#0f1117] border border-border-main rounded-lg pl-8 pr-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]/50"
              />
            </div>

            {/* 트랙 목록 */}
            {loadingTracks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-muted" />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {pageTracks.length === 0 ? (
                  <p className="text-sm text-muted text-center py-6">트랙이 없습니다.</p>
                ) : (
                  pageTracks.map((track) => {
                    const isSelected = selected?.id === track.id;
                    return (
                      <button
                        key={track.id}
                        onClick={() => handleSelect(track)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition w-full ${
                          isSelected
                            ? 'bg-[#FF6F0F]/15 border border-[#FF6F0F]/40'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {/* 커버 */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                          {track.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={track.cover_image_url}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg">{track.cover_emoji || '🎵'}</span>
                          )}
                        </div>

                        {/* 텍스트 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{track.title}</p>
                          <p className="text-xs text-muted truncate">{track.artist}</p>
                        </div>

                        {/* 메타 */}
                        <div className="text-right shrink-0 space-y-1">
                          <p className="text-xs text-muted">{fmtSec(track.duration_sec)}</p>
                          {track.energy_level && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                ENERGY_COLOR[track.energy_level] ?? 'bg-white/10 text-muted'
                              }`}
                            >
                              {ENERGY_KO[track.energy_level]}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-muted transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-muted">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-muted transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── 오른쪽: 편집 & 생성 패널 ── */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {!selected ? (
            <div className="bg-card border border-border-main rounded-xl flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <Music2 size={28} className="text-muted" />
              </div>
              <p className="text-sm text-muted">왼쪽에서 트랙을 선택하세요</p>
            </div>
          ) : (
            <>
              {/* ── 선택 트랙 정보 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex gap-4 items-start">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                  {selected.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.cover_image_url}
                      alt={selected.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">{selected.cover_emoji || '🎵'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-primary truncate">{selected.title}</h2>
                  <p className="text-sm text-muted mt-0.5">{selected.artist}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(selected.mood_tags ?? []).slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6F0F]/15 text-[#FF9F4F] border border-[#FF6F0F]/20"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted">전체 길이</p>
                  <p className="text-sm font-semibold text-primary mt-0.5">
                    {fmtSec(selected.duration_sec)}
                  </p>
                  {selected.bpm && (
                    <p className="text-xs text-muted mt-1">{selected.bpm} BPM</p>
                  )}
                </div>
              </div>

              {/* ── 클라이맥스 구간 설정 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">클라이맥스 구간 설정</p>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6F0F]/15 text-[#FF6F0F] text-xs font-semibold hover:bg-[#FF6F0F]/25 transition disabled:opacity-50"
                  >
                    {analyzing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Zap size={12} />
                    )}
                    자동 감지
                  </button>
                </div>

                {analyzed && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Sparkles size={13} className="text-green-400" />
                    <p className="text-xs text-green-400">
                      클라이맥스 구간이 감지되었습니다: {fmtSec(startSec)} 시작
                    </p>
                  </div>
                )}

                {/* 슬라이더 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted">시작 시간 (직접 조정)</label>
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      {fmtSec(startSec)} ~ {fmtSec(Math.min(startSec + 30, selected.duration_sec))}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxStart}
                    step={1}
                    value={startSec}
                    onChange={(e) => {
                      setStartSec(Number(e.target.value));
                      setAnalyzed(false);
                    }}
                    className="w-full accent-[#FF6F0F]"
                  />
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>0:00</span>
                    <span>{fmtSec(maxStart)}</span>
                  </div>
                </div>

                {/* 미니 오디오 플레이어 */}
                {selected.audio_url && (
                  <MiniPlayer audioUrl={selected.audio_url} startSec={startSec} />
                )}

                <p className="text-[10px] text-muted">
                  * 선택한 시작 시간부터 30초 구간이 쇼츠 영상에 사용됩니다.
                </p>
              </div>

              {/* ── 쇼츠 미리보기 (정적 썸네일) ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-primary">쇼츠 구성 미리보기</p>
                <div className="flex gap-4 items-start">
                  {/* 9:16 썸네일 */}
                  <div
                    className="relative shrink-0 rounded-xl overflow-hidden"
                    style={{ width: 120, height: 213, background: '#000' }}
                  >
                    {selected.cover_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selected.cover_image_url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-110"
                      />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.8) 100%)',
                      }}
                    />
                    {/* 앨범아트 */}
                    <div className="absolute inset-0 flex items-center justify-center" style={{ marginTop: -20 }}>
                      <div
                        className="rounded-lg overflow-hidden shadow-xl"
                        style={{ width: 80, height: 80 }}
                      >
                        {selected.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selected.cover_image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-[#FF6F0F] flex items-center justify-center text-2xl">
                            {selected.cover_emoji}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 타이틀 */}
                    <div className="absolute bottom-6 left-2 right-2">
                      <p className="text-white text-[9px] font-bold leading-tight truncate">
                        {selected.title}
                      </p>
                      <p className="text-white/60 text-[8px] truncate">{selected.artist}</p>
                    </div>
                    {/* 브랜드 */}
                    <div className="absolute top-2 right-2 bg-[#FF6F0F]/90 rounded text-white text-[7px] font-bold px-1 py-0.5">
                      언니픽
                    </div>
                    {/* 진행바 */}
                    <div
                      className="absolute bottom-2 left-2 right-2 h-0.5 bg-white/10 rounded"
                    >
                      <div className="h-full w-1/3 bg-[#FF6F0F] rounded" />
                    </div>
                  </div>

                  {/* 구성 정보 */}
                  <div className="flex-1 space-y-2 text-xs text-muted">
                    <div className="flex justify-between">
                      <span>해상도</span>
                      <span className="text-primary font-medium">720 × 1280 (9:16)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>프레임레이트</span>
                      <span className="text-primary font-medium">30fps</span>
                    </div>
                    <div className="flex justify-between">
                      <span>영상 길이</span>
                      <span className="text-primary font-medium">30초 (900 프레임)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>코덱</span>
                      <span className="text-primary font-medium">H.264 MP4</span>
                    </div>
                    <div className="flex justify-between">
                      <span>오디오 시작</span>
                      <span className="text-primary font-medium">{fmtSec(startSec)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>무드 태그</span>
                      <span className="text-primary font-medium">
                        {(selected.mood_tags ?? []).slice(0, 3).join(', ') || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 생성 버튼 & 결과 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">쇼츠 생성</p>
                    <p className="text-xs text-muted mt-0.5">
                      Remotion으로 서버사이드 렌더링됩니다 (수 분 소요)
                    </p>
                  </div>
                  <button
                    onClick={handleRender}
                    disabled={rendering}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6F0F] text-white text-sm font-bold hover:bg-[#e86200] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rendering ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Film size={15} />
                        쇼츠 생성
                      </>
                    )}
                  </button>
                </div>

                {/* 렌더링 중 안내 */}
                {rendering && (
                  <div className="rounded-lg bg-[#FF6F0F]/10 border border-[#FF6F0F]/20 px-4 py-3 flex gap-3 items-start">
                    <Loader2 size={15} className="animate-spin text-[#FF6F0F] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-[#FF9F4F] font-medium">렌더링 진행 중</p>
                      <p className="text-xs text-muted mt-0.5">
                        Remotion이 900 프레임을 렌더링하고 있습니다. 창을 닫지 마세요.
                      </p>
                    </div>
                  </div>
                )}

                {/* 에러 */}
                {renderError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                    <p className="text-sm text-red-400 font-medium">렌더링 실패</p>
                    <p className="text-xs text-muted mt-0.5 break-all">{renderError}</p>
                  </div>
                )}

                {/* 완료 */}
                {videoUrl && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-green-400" />
                      <p className="text-sm text-green-400 font-semibold">쇼츠 영상이 생성되었습니다!</p>
                    </div>
                    {/* 영상 미리보기 */}
                    <video
                      src={videoUrl}
                      controls
                      className="rounded-lg w-full max-w-xs mx-auto"
                      style={{ aspectRatio: '9/16' }}
                    />
                    <div className="flex gap-2">
                      <a
                        href={videoUrl}
                        download={`shorts_${selected.title}.mp4`}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF6F0F] text-white text-sm font-semibold hover:bg-[#e86200] transition"
                      >
                        <Download size={14} />
                        다운로드
                      </a>
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-muted text-sm hover:bg-white/10 transition border border-border-main"
                      >
                        <ExternalLink size={14} />
                        새 탭
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
