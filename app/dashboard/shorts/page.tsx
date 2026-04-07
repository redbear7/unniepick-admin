'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { usePlayer } from '@/contexts/PlayerContext';
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
  Trash2,
  Clock,
  Share2,
  Copy,
  Check,
  ImageIcon,
  RotateCcw,
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

// ─── 쇼츠 히스토리 (로컬 저장) ──────────────────────────────────
interface ShortsHistoryItem {
  id: string;
  trackTitle: string;
  artist: string;
  coverUrl: string | null;
  coverEmoji: string;
  videoUrl: string;
  startSec: number;
  moodTags: string[];
  createdAt: string;
}

const SHORTS_HISTORY_KEY = 'shorts_render_history';
const SHORTS_HISTORY_MAX = 30;

function loadShortsHistory(): ShortsHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(SHORTS_HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveShortsHistory(list: ShortsHistoryItem[]) {
  try { localStorage.setItem(SHORTS_HISTORY_KEY, JSON.stringify(list.slice(0, SHORTS_HISTORY_MAX))); } catch {}
}
function pushShortsHistory(item: ShortsHistoryItem) {
  saveShortsHistory([item, ...loadShortsHistory()]);
}
function removeShortsHistory(id: string) {
  saveShortsHistory(loadShortsHistory().filter(h => h.id !== id));
}

// ─── 플레이어 (간이 오디오 미리듣기) ────────────────────────────
function MiniPlayer({
  audioUrl,
  startSec,
  onPlayStart,
}: {
  audioUrl: string;
  startSec: number;
  onPlayStart?: () => void;
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
      onPlayStart?.();
      el.currentTime = startSec;
      el.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing, startSec, onPlayStart]);

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
  const player = usePlayer();

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

  // 커버 이미지 (기본: 트랙 커버, 변경 가능)
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // 쇼츠 제목 / 강조 문구
  const [shortsTitle, setShortsTitle] = useState('');
  const [shortsTagline, setShortsTagline] = useState('');

  // 렌더링
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);

  // 히스토리
  const [history, setHistory] = useState<ShortsHistoryItem[]>([]);
  useEffect(() => { setHistory(loadShortsHistory()); }, []);

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
    setCoverFile(null);
    setCoverPreviewUrl(null);
  };

  // ── 커버 이미지 변경 ──
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreviewUrl(url);
    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = '';
  };

  const handleCoverReset = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(null);
    setCoverPreviewUrl(null);
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
      // 커버 이미지 변경됐으면 Storage에 업로드 후 공개 URL 사용
      let finalCoverUrl = selected.cover_image_url;
      if (coverFile) {
        setUploadingCover(true);
        const ext = coverFile.name.split('.').pop() || 'jpg';
        const filename = `covers/shorts_${selected.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage
          .from('music-tracks')
          .upload(filename, coverFile, { upsert: true });
        setUploadingCover(false);
        if (upErr) throw new Error(`커버 업로드 실패: ${upErr.message}`);
        const { data: urlData } = sb.storage.from('music-tracks').getPublicUrl(filename);
        finalCoverUrl = urlData.publicUrl;
      }

      const res = await fetch('/api/shorts/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: selected.id,
          audio_url: selected.audio_url,
          cover_url: finalCoverUrl,
          title: selected.title,
          artist: selected.artist,
          cover_emoji: selected.cover_emoji,
          start_sec: startSec,
          mood_tags: selected.mood_tags ?? [],
          shorts_title: shortsTitle.trim(),
          shorts_tagline: shortsTagline.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '렌더링 실패');
      setVideoUrl(json.video_url);
      // 히스토리에 저장
      const item: ShortsHistoryItem = {
        id: `shorts_${Date.now()}`,
        trackTitle: selected.title,
        artist: selected.artist,
        coverUrl: selected.cover_image_url,
        coverEmoji: selected.cover_emoji,
        videoUrl: json.video_url,
        startSec,
        moodTags: selected.mood_tags ?? [],
        createdAt: new Date().toISOString(),
      };
      pushShortsHistory(item);
      setHistory(loadShortsHistory());
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

              {/* ── 커버 이미지 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-primary">커버 이미지</p>
                <div className="flex items-center gap-4">
                  {/* 미리보기 */}
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                    {(coverPreviewUrl || selected.cover_image_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverPreviewUrl ?? selected.cover_image_url!}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">{selected.cover_emoji || '🎵'}</span>
                    )}
                    {uploadingCover && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-white" />
                      </div>
                    )}
                    {coverPreviewUrl && (
                      <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-[#FF6F0F]" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-muted">
                      기본값은 트랙 커버입니다. 9:16 비율 이미지를 권장합니다.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border-main text-xs text-muted hover:text-primary hover:bg-white/10 transition">
                        <ImageIcon size={12} />
                        이미지 변경
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCoverChange}
                        />
                      </label>
                      {coverPreviewUrl && (
                        <button
                          onClick={handleCoverReset}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border-main text-xs text-muted hover:text-red-400 hover:border-red-500/30 transition"
                        >
                          <RotateCcw size={12} />
                          원본 복원
                        </button>
                      )}
                    </div>
                  </div>
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
                  <MiniPlayer audioUrl={selected.audio_url} startSec={startSec} onPlayStart={() => { if (player.isPlaying) player.pause(); }} />
                )}

                <p className="text-[10px] text-muted">
                  * 선택한 시작 시간부터 30초 구간이 쇼츠 영상에 사용됩니다.
                </p>
              </div>

              {/* ── 쇼츠 제목 / 강조 문구 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-primary">영상 텍스트</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted mb-1 block">쇼츠 제목 (상단 큰 텍스트)</label>
                    <input
                      type="text"
                      placeholder="예: 가을 감성 플레이리스트"
                      value={shortsTitle}
                      onChange={(e) => setShortsTitle(e.target.value)}
                      className="w-full bg-[#0f1117] border border-border-main rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">강조 문구 (서브 텍스트)</label>
                    <input
                      type="text"
                      placeholder="예: 언니픽이 큐레이션한 매장 BGM"
                      value={shortsTagline}
                      onChange={(e) => setShortsTagline(e.target.value)}
                      className="w-full bg-[#0f1117] border border-border-main rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]/50"
                    />
                  </div>
                  <p className="text-[10px] text-muted">비워두면 해당 텍스트는 영상에 표시되지 않습니다.</p>
                </div>
              </div>

              {/* ── 쇼츠 미리보기 (정적 썸네일) ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-primary">쇼츠 구성 미리보기</p>
                <div className="flex gap-4 items-start">
                  {/* 9:16 썸네일 */}
                  <div
                    className="relative shrink-0 rounded-xl overflow-hidden"
                    style={{ width: 120, height: 213, background: '#111' }}
                  >
                    {/* 커버 풀스크린 */}
                    {(coverPreviewUrl || selected.cover_image_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverPreviewUrl ?? selected.cover_image_url!}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl bg-[#1a1a2e]">
                        {selected.cover_emoji}
                      </div>
                    )}
                    {/* 그라디언트 오버레이 */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.75) 100%)',
                      }}
                    />
                    {/* 상단: 쇼츠 제목 */}
                    <div className="absolute top-3 left-2 right-2">
                      {shortsTitle && (
                        <p className="text-white text-[8px] font-black leading-tight line-clamp-2">
                          {shortsTitle}
                        </p>
                      )}
                      {shortsTagline && (
                        <p className="text-[#FF9F4F] text-[6px] font-bold mt-0.5 truncate">
                          {shortsTagline}
                        </p>
                      )}
                    </div>
                    {/* 하단: 노래 제목 (작게) */}
                    <div className="absolute bottom-5 left-2 right-2">
                      <p className="text-white text-[7px] font-semibold leading-tight truncate">
                        🎵 {selected.title}
                      </p>
                      <p className="text-white/60 text-[6px] truncate mt-0.5">{selected.artist}</p>
                    </div>
                    {/* 브랜드 */}
                    <div className="absolute top-2 right-1.5 bg-[#FF6F0F]/90 rounded text-white text-[6px] font-bold px-1 py-0.5">
                      언니픽
                    </div>
                    {/* 진행바 */}
                    <div className="absolute bottom-2 left-2 right-2 h-0.5 bg-white/10 rounded">
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

                    {/* 릴스 공유 */}
                    <div className="space-y-2 mt-3 pt-3 border-t border-border-subtle">
                      <p className="text-[10px] text-dim font-semibold">📱 인스타그램 릴스 공유</p>

                      {/* 캡션 복사 */}
                      <button
                        onClick={() => {
                          const genre = (selected.mood_tags ?? [])[0]?.replace(/[^a-zA-Z0-9가-힣]/g, '');
                          const tags = [
                            genre ? `#${genre}` : '',
                            '#매장BGM',
                            '#카페음악',
                            '#언니픽',
                          ].filter(Boolean).slice(0, 4).join(' ');
                          const caption = `🎵 ${selected.title}\n\n${tags}`;
                          navigator.clipboard.writeText(caption);
                          setCaptionCopied(true);
                          setTimeout(() => setCaptionCopied(false), 2000);
                        }}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition border ${
                          captionCopied
                            ? 'bg-green-500/15 border-green-500/30 text-green-400'
                            : 'bg-white/5 border-border-main text-muted hover:text-primary hover:bg-white/10'
                        }`}>
                        {captionCopied ? <><Check size={12} /> 캡션 복사됨!</> : <><Copy size={12} /> 릴스 캡션 복사</>}
                      </button>

                      {/* 모바일 공유 (Web Share API) */}
                      {'share' in navigator && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(videoUrl);
                              const blob = await res.blob();
                              const file = new File([blob], `${selected.title}_shorts.mp4`, { type: 'video/mp4' });
                              await navigator.share({ title: selected.title, files: [file] });
                            } catch {}
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-pink-500/30 transition">
                          <Share2 size={12} /> 모바일 공유 (인스타/틱톡)
                        </button>
                      )}

                      <p className="text-[8px] text-dim text-center">다운로드 → 인스타그램 앱 → 릴스 → 영상 선택 → 캡션 붙여넣기</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── 히스토리 (flex 레이아웃 바깥) ── */}
      {history.length > 0 && (
        <div className="px-6 py-4 border-t border-white/5 overflow-y-auto shrink-0" style={{ maxHeight: 360 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-tertiary flex items-center gap-2">
              <Clock size={14} /> 생성 히스토리
              <span className="text-dim font-normal">· {history.length}건 · 로컬 저장</span>
            </h2>
            <button
              onClick={() => { if (confirm('쇼츠 히스토리를 모두 삭제할까요?')) { saveShortsHistory([]); setHistory([]); } }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-dim hover:text-red-400 hover:bg-red-500/10 transition">
              <Trash2 size={11} /> 전체 삭제
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
            {history.map(h => (
              <div key={h.id} className="shrink-0 w-36 bg-card border border-border-main rounded-xl overflow-hidden group">
                <div className="relative aspect-[9/16] bg-fill-subtle">
                  <video
                    src={h.videoUrl}
                    className="w-full h-full object-cover"
                    muted playsInline
                    onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                    onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <a href={h.videoUrl} download
                      className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition">
                      <Download size={12} className="text-black" />
                    </a>
                    <a href={h.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition">
                      <ExternalLink size={12} className="text-black" />
                    </a>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-[10px] text-primary font-semibold truncate">{h.trackTitle}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[8px] text-dim">
                      {new Date(h.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                      onClick={() => { removeShortsHistory(h.id); setHistory(loadShortsHistory()); }}
                      className="text-dim hover:text-red-400 transition p-0.5">
                      <Trash2 size={9} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
