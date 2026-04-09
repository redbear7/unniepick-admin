'use client';

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { X, RefreshCw, Music2, ChevronRight, Sparkles, Volume2, Loader2 } from 'lucide-react';
import type { VrmViewerHandle } from './VrmViewer';

// VrmViewer는 Three.js 포함 — 동적 임포트로 번들 분리
const VrmViewer = lazy(() => import('./VrmViewer'));

// ── 샘플 VRM 모델 URL (pixiv 공식 샘플) ─────────────────────────────────
const VRM_MODEL_URL =
  'https://pixiv.github.io/three-vrm/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm';

interface Recommendation {
  playlist_id: string;
  name:        string;
  reason:      string;
}
interface RecommendResult {
  comment:         string;
  recommendations: Recommendation[];
}
interface Props { userId: string; }

// ── 플레이리스트 카드 ─────────────────────────────────────────────────────
function PlaylistCard({ rec, index }: { rec: Recommendation; index: number }) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-default"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="w-8 h-8 rounded-lg bg-[#FF6F0F]/20 flex items-center justify-center shrink-0 mt-0.5">
        <Music2 size={14} className="text-[#FF6F0F]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{rec.name}</p>
        <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{rec.reason}</p>
      </div>
      <ChevronRight size={14} className="text-white/30 shrink-0 mt-1" />
    </div>
  );
}

// ── 메인 위젯 ─────────────────────────────────────────────────────────────
export default function MascotWidget({ userId }: Props) {
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result,   setResult]   = useState<RecommendResult | null>(null);
  const [fetched,  setFetched]  = useState(false);

  const vrmRef      = useRef<VrmViewerHandle>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── AI 추천 fetch ──────────────────────────────────────────────────────
  const fetchRecommend = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res  = await fetch('/api/owner/mascot-recommend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      setResult(data);
      setFetched(true);
      if (data.comment) speakText(data.comment);
    } catch {
      setResult({ comment: '추천을 불러오지 못했어요. 잠시 후 다시 시도해봐요! 🙏', recommendations: [] });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loading]);

  useEffect(() => {
    if (open && !fetched) fetchRecommend();
  }, [open, fetched, fetchRecommend]);

  // ── Fish Audio TTS + 립싱크 ──────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    if (!vrmRef.current) return;
    setSpeaking(true);
    try {
      const res = await fetch('/api/tts/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice_type: 'fish_18e99f7be5374fa9b5ae52ed2f51e80d',
          speed: 1.0,
          store_id: null,
        }),
      });
      const data = await res.json();
      if (!data.audio_url) throw new Error('no audio_url');

      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const audioRes = await fetch(data.audio_url);
      const buf      = await audioRes.arrayBuffer();
      const decoded  = await ctx.decodeAudioData(buf);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      vrmRef.current.connectAnalyser(analyser);
      source.start();
      source.onended = () => {
        vrmRef.current?.stopSpeaking();
        setSpeaking(false);
      };
    } catch (e) {
      console.warn('[MascotWidget] TTS 실패:', e);
      setSpeaking(false);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    vrmRef.current?.stopSpeaking();
    setSpeaking(false);
  };

  return (
    <>
      <style>{`
        @keyframes bubble-in {
          0%   { opacity: 0; transform: scale(0.92) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes btn-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,111,15,0.5); }
          50%       { box-shadow: 0 0 0 8px rgba(255,111,15,0); }
        }
        @keyframes speak-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,111,15,0.7); }
          50%       { box-shadow: 0 0 0 12px rgba(255,111,15,0); }
        }
        .bubble-in  { animation: bubble-in 0.25s ease-out forwards; }
        .btn-pulse  { animation: btn-pulse 2.4s ease-in-out infinite; }
        .speak-ring { animation: speak-ring 0.8s ease-in-out infinite; }
      `}</style>

      {/* ── 패널 ── */}
      {open && (
        <div
          className="bubble-in fixed bottom-24 right-4 w-80 rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50"
          style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)' }}
        >
          {/* 헤더: VRM 캐릭터 + 타이틀 */}
          <div className="flex items-end gap-3 px-4 pt-3 pb-2 border-b border-white/10">
            <div className="relative shrink-0">
              <Suspense
                fallback={
                  <div className="w-20 h-28 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-[#FF6F0F]/60" />
                  </div>
                }
              >
                <VrmViewer
                  ref={vrmRef}
                  modelUrl={VRM_MODEL_URL}
                  width={80}
                  height={112}
                />
              </Suspense>
              {speaking && (
                <div className="speak-ring absolute inset-0 rounded-xl pointer-events-none border-2 border-[#FF6F0F]/60" />
              )}
            </div>

            <div className="flex-1 pb-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-white">단비의 플리 추천</p>
                {speaking && <Volume2 size={11} className="text-[#FF9F4F] animate-pulse" />}
              </div>
              <p className="text-[10px] text-white/40">AI 큐레이션 · VRM 3D</p>
            </div>

            <div className="flex items-center gap-1 pb-1">
              <button
                onClick={fetchRecommend}
                disabled={loading}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-40"
                title="새로고침"
              >
                <RefreshCw size={13} className={`text-white/60 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X size={13} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* 본문 */}
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 size={24} className="animate-spin text-[#FF6F0F]/60" />
                <p className="text-xs text-white/50 text-center">오늘의 플리 분석 중이에요~✨</p>
              </div>
            ) : result ? (
              <>
                <div className="relative bg-[#FF6F0F]/15 border border-[#FF6F0F]/25 rounded-xl px-4 py-3">
                  <Sparkles size={12} className="absolute top-2.5 right-3 text-[#FF9F4F]/60" />
                  <p className="text-[13px] text-white/90 leading-relaxed pr-4">{result.comment}</p>
                  {result.comment && (
                    <button
                      onClick={() => speakText(result.comment)}
                      disabled={speaking}
                      className="mt-2 flex items-center gap-1 text-[10px] text-[#FF9F4F]/70 hover:text-[#FF9F4F] transition disabled:opacity-40"
                    >
                      <Volume2 size={10} />
                      {speaking ? '말하는 중...' : '다시 듣기'}
                    </button>
                  )}
                </div>

                {result.recommendations?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-1">추천 플리</p>
                    {result.recommendations.map((rec, i) => (
                      <PlaylistCard key={rec.playlist_id} rec={rec} index={i} />
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── 플로팅 버튼 ── */}
      <button
        onClick={() => (open ? handleClose() : setOpen(true))}
        className={`fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${!open ? 'btn-pulse' : ''}`}
        style={{ background: 'linear-gradient(135deg, #FF6F0F, #ff9f4f)' }}
        title="단비의 플리 추천"
      >
        <span className="text-2xl">🎵</span>
        {!open && (
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#FF6F0F] flex items-center justify-center">
            <span className="text-[7px] font-black text-[#FF6F0F]">♪</span>
          </span>
        )}
      </button>
    </>
  );
}
