'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, RefreshCw, Music2, ChevronRight, Sparkles } from 'lucide-react';

interface Recommendation {
  playlist_id: string;
  name:        string;
  reason:      string;
}

interface RecommendResult {
  comment:         string;
  recommendations: Recommendation[];
}

interface Props {
  userId: string;
}

// ── 캐릭터 SVG ─────────────────────────────────────────────────────────────
function MascotFace({ size = 56, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={animate ? 'mascot-bob' : ''}
    >
      {/* 얼굴 배경 */}
      <circle cx="28" cy="28" r="26" fill="#FF6F0F" />
      <circle cx="28" cy="28" r="23" fill="#FFB07A" />

      {/* 귀 (음표 형태) */}
      <ellipse cx="8"  cy="22" rx="4" ry="5.5" fill="#FF6F0F" />
      <ellipse cx="48" cy="22" rx="4" ry="5.5" fill="#FF6F0F" />

      {/* 헤드폰 밴드 */}
      <path d="M8 22 Q28 6 48 22" stroke="#CC4400" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* 눈 */}
      <ellipse cx="20" cy="26" rx="4.5" ry="5" fill="white" />
      <ellipse cx="36" cy="26" rx="4.5" ry="5" fill="white" />
      <circle  cx="21" cy="27" r="2.5"  fill="#1a1a2e" className="mascot-pupil-l" />
      <circle  cx="37" cy="27" r="2.5"  fill="#1a1a2e" className="mascot-pupil-r" />
      {/* 눈 하이라이트 */}
      <circle cx="22"  cy="26" r="1" fill="white" />
      <circle cx="38"  cy="26" r="1" fill="white" />

      {/* 볼 홍조 */}
      <ellipse cx="15" cy="33" rx="4" ry="2.5" fill="#FF9060" opacity="0.5" />
      <ellipse cx="41" cy="33" rx="4" ry="2.5" fill="#FF9060" opacity="0.5" />

      {/* 입 (미소) */}
      <path d="M21 37 Q28 43 35 37" stroke="#CC4400" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* 음표 장식 */}
      <text x="42" y="14" fontSize="8" fill="white" opacity="0.85" className="mascot-note-r">♪</text>
      <text x="6"  y="14" fontSize="7" fill="white" opacity="0.7"  className="mascot-note-l">♫</text>
    </svg>
  );
}

// ── 플레이리스트 카드 ───────────────────────────────────────────────────────
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

// ── 메인 위젯 ───────────────────────────────────────────────────────────────
export default function MascotWidget({ userId }: Props) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<RecommendResult | null>(null);
  const [fetched, setFetched] = useState(false);

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
    } catch {
      setResult({ comment: '추천을 불러오지 못했어요. 잠시 후 다시 시도해봐요! 🙏', recommendations: [] });
    } finally {
      setLoading(false);
    }
  }, [userId, loading]);

  // 처음 열 때 자동 fetch
  useEffect(() => {
    if (open && !fetched) {
      fetchRecommend();
    }
  }, [open, fetched, fetchRecommend]);

  return (
    <>
      <style>{`
        @keyframes mascot-bob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes mascot-note-float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.8; }
          50%       { transform: translateY(-3px) rotate(8deg); opacity: 1; }
        }
        @keyframes bubble-in {
          0%   { opacity: 0; transform: scale(0.92) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.2); }
        }
        .mascot-bob        { animation: mascot-bob 2.4s ease-in-out infinite; }
        .mascot-note-r     { animation: mascot-note-float 2s ease-in-out infinite; }
        .mascot-note-l     { animation: mascot-note-float 2.6s ease-in-out infinite reverse; }
        .bubble-in         { animation: bubble-in 0.25s ease-out forwards; }
        .badge-pulse       { animation: badge-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* 패널 */}
      {open && (
        <div
          className="bubble-in fixed bottom-24 right-4 w-80 rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50"
          style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)' }}
        >
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <MascotFace size={36} animate={false} />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">유니의 플리 추천</p>
              <p className="text-[10px] text-white/40">AI 큐레이션</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchRecommend}
                disabled={loading}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-40"
                title="새로고침"
              >
                <RefreshCw size={13} className={`text-white/60 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X size={13} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* 본문 */}
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <MascotFace size={44} animate />
                <p className="text-xs text-white/50 text-center">오늘의 플리 분석 중이에요~✨</p>
              </div>
            ) : result ? (
              <>
                {/* 말풍선 멘트 */}
                <div className="relative bg-[#FF6F0F]/15 border border-[#FF6F0F]/25 rounded-xl px-4 py-3">
                  <Sparkles size={12} className="absolute top-2.5 right-3 text-[#FF9F4F]/60" />
                  <p className="text-[13px] text-white/90 leading-relaxed pr-4">{result.comment}</p>
                </div>

                {/* 추천 목록 */}
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

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #FF6F0F, #ff9f4f)' }}
        title="유니의 플리 추천"
      >
        <MascotFace size={42} animate={!open} />
        {/* 알림 뱃지 */}
        {!open && (
          <span className="badge-pulse absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#FF6F0F] flex items-center justify-center">
            <span className="text-[7px] font-black text-[#FF6F0F]">♪</span>
          </span>
        )}
      </button>
    </>
  );
}
