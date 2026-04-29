'use client';

import { useState, useRef } from 'react';
import {
  Sparkles, Send, Search, Loader2, Check, Star, MapPin,
  MessageSquare, UtensilsCrossed, ExternalLink, Phone,
  Trophy, Info, Tag as TagIcon, RefreshCw, Ticket, Gift,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface FilterChip { text: string; color: string; }

interface ParsedFilter {
  gu: string | null;
  dong: string | null;
  category: string | null;
  style: string | null;
  keywords: string[];
  rewritten_intent: string;
  chips: FilterChip[];
}

interface Coupon {
  title: string;
  description: string;
  discount: string;
  valid_until: string;
  is_exclusive: boolean;
}

interface Recommendation {
  rank: number;
  restaurant_id: string;
  name: string;
  category: string;
  unniepick_style?: string | null;
  rating?: number | null;
  review_count?: number | null;
  blog_count?: number;
  address?: string | null;
  image_url?: string | null;
  phone?: string | null;
  naver_place_url?: string | null;
  kakao_place_url?: string | null;
  why: string;
  matched_signals: string[];
  coupon?: Coupon | null;
}

type StageStatus = 'idle' | 'parsing' | 'searching' | 'ranking' | 'done';

/* ------------------------------------------------------------------ */
/* Example Queries                                                      */
/* ------------------------------------------------------------------ */

const EXAMPLE_QUERIES = [
  '상남동 상견례 룸 한식',
  '오늘 매운 거 혼밥 1만원',
  '진해 벚꽃뷰 카페',
  '여자친구 데이트 분위기 이자카야',
  '가족외식 주차 한정식',
  '회식 40명 고기집 상남동',
  '비 오는 날 조용한 와인바',
  '아이랑 갈만한 브런치',
];

/* ------------------------------------------------------------------ */
/* Main Page                                                            */
/* ------------------------------------------------------------------ */

export default function AIChatPage() {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<StageStatus>('idle');
  const [filter, setFilter] = useState<ParsedFilter | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function doSearch(q: string) {
    if (!q.trim()) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStage('parsing');
    setFilter(null);
    setCandidateCount(0);
    setRecommendations([]);

    try {
      const res = await fetch('/api/restaurants/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error('검색 실패');

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === 'filter') {
              setFilter(event as ParsedFilter);
              setStage('searching');
            } else if (event.type === 'candidates') {
              setCandidateCount(event.count);
              setStage('ranking');
            } else if (event.type === 'recommendation') {
              setRecommendations(prev => [...prev, event as Recommendation]);
            } else if (event.type === 'done') {
              setStage('done');
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch {}
        }
      }
      setStage('done');
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setStage('done');
        alert(`검색 오류: ${e?.message ?? '알 수 없는 오류'}`);
      }
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || stage === 'parsing' || stage === 'searching' || stage === 'ranking') return;
    doSearch(query);
  }

  function runExample(q: string) {
    setQuery(q);
    doSearch(q);
  }

  function reset() {
    abortRef.current?.abort();
    setQuery('');
    setStage('idle');
    setFilter(null);
    setCandidateCount(0);
    setRecommendations([]);
    inputRef.current?.focus();
  }

  const isLoading = stage === 'parsing' || stage === 'searching' || stage === 'ranking';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#FF6F0F]" />
            AI 맛집 추천
          </h1>
          <p className="text-sm text-muted mt-1">
            자연어로 질문하면 창원 맛집을 상황에 맞춰 추천합니다 · <span className="text-green-400">실서비스 연결</span>
          </p>
        </div>
        {stage !== 'idle' && (
          <button
            onClick={reset}
            className="px-3 py-1.5 text-xs text-muted hover:text-primary border border-border-subtle hover:border-border-main rounded-lg flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> 새 대화
          </button>
        )}
      </div>

      {/* 예시 쿼리 */}
      {stage === 'idle' && (
        <div className="bg-card border border-border-main rounded-xl p-4">
          <p className="text-xs text-muted mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> 예시 쿼리 — 클릭하면 바로 검색
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => runExample(q)}
                className="px-3 py-1.5 bg-fill-subtle border border-border-subtle rounded-full text-sm text-secondary hover:border-[#FF6F0F]/50 hover:text-primary transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 */}
      <form onSubmit={onSubmit} className="sticky top-4 z-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 상남동 상견례 룸 한식"
            disabled={isLoading}
            className="w-full pl-12 pr-28 py-4 bg-card border border-border-main rounded-xl text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] shadow-lg"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2.5 bg-[#FF6F0F] text-white rounded-lg text-sm font-medium hover:bg-[#FF6F0F]/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            검색
          </button>
        </div>
      </form>

      {/* 진행 상황 */}
      {stage !== 'idle' && (
        <ProgressPanel stage={stage} filter={filter} candidateCount={candidateCount} />
      )}

      {/* 결과 */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            AI 추천 {recommendations.length}개
          </h2>
          <div className="space-y-4">
            {recommendations.map((r) => (
              <RecommendationCard key={r.restaurant_id} r={r} />
            ))}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {stage === 'done' && recommendations.length === 0 && (
        <div className="text-center py-16 text-muted">
          <p>조건에 맞는 맛집을 찾지 못했어요.</p>
          <p className="text-sm mt-1">조건을 조금 완화하거나 다른 키워드로 검색해보세요.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress Panel                                                       */
/* ------------------------------------------------------------------ */

function ProgressPanel({ stage, filter, candidateCount }: {
  stage: StageStatus;
  filter: ParsedFilter | null;
  candidateCount: number;
}) {
  return (
    <div className="bg-card border border-border-main rounded-xl p-4 space-y-3">
      <StageRow label="쿼리 분석" done={stage !== 'parsing' && !!filter} active={stage === 'parsing'}>
        {filter && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filter.chips?.map((c, i) => (
                <span key={i} className="px-2 py-0.5 text-xs rounded-full border flex items-center gap-1" style={{ color: c.color, borderColor: c.color + '50', background: c.color + '18' }}>
                  {c.text}
                </span>
              ))}
            </div>
            {filter.rewritten_intent && (
              <p className="text-xs text-muted mt-2 italic">💭 {filter.rewritten_intent}</p>
            )}
          </>
        )}
      </StageRow>

      <StageRow
        label="맛집 검색"
        done={(stage === 'ranking' || stage === 'done') && candidateCount > 0}
        active={stage === 'searching'}
      >
        {candidateCount > 0 && (
          <p className="text-xs text-secondary mt-1">
            조건에 맞는 <span className="text-[#FF6F0F] font-bold">{candidateCount}개</span> 맛집 발견
          </p>
        )}
      </StageRow>

      <StageRow label="AI 추천 선별" done={stage === 'done'} active={stage === 'ranking'} />
    </div>
  );
}

function StageRow({ label, done, active, children }: {
  label: string; done: boolean; active: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 shrink-0 mt-0.5">
        {done ? (
          <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-400" />
          </div>
        ) : active ? (
          <Loader2 className="w-5 h-5 animate-spin text-[#FF6F0F]" />
        ) : (
          <div className="w-5 h-5 rounded-full border border-border-subtle" />
        )}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? 'text-primary' : active ? 'text-[#FF6F0F]' : 'text-muted'}`}>
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recommendation Card                                                  */
/* ------------------------------------------------------------------ */

function RecommendationCard({ r }: { r: Recommendation }) {
  const medalColor = r.rank === 1 ? 'bg-amber-500' : r.rank === 2 ? 'bg-slate-400' : r.rank === 3 ? 'bg-orange-700' : 'bg-fill-subtle';

  return (
    <div className="bg-card border border-border-main rounded-xl overflow-hidden hover:border-[#FF6F0F]/50 transition">
      <div className="flex flex-col md:flex-row">
        {/* 이미지 */}
        {r.image_url && (
          <div className="md:w-48 h-48 md:h-auto shrink-0 overflow-hidden bg-fill-subtle relative">
            <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
            <div className={`absolute top-2 left-2 w-8 h-8 rounded-full ${medalColor} flex items-center justify-center text-white font-bold shadow-lg`}>
              {r.rank}
            </div>
          </div>
        )}

        {/* 내용 */}
        <div className="flex-1 p-5 space-y-3">
          <div className="flex items-start gap-3">
            {!r.image_url && (
              <div className={`w-8 h-8 rounded-full ${medalColor} flex items-center justify-center text-white font-bold shadow shrink-0`}>
                {r.rank}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-primary">{r.name}</h3>
              <p className="text-sm text-muted flex items-center gap-2 mt-1 flex-wrap">
                <span>{r.category}</span>
                {r.unniepick_style && <span className="text-violet-400">{r.unniepick_style}</span>}
                {r.rating != null && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" /> {r.rating}
                  </span>
                )}
                {r.review_count != null && <span>리뷰 {r.review_count.toLocaleString()}</span>}
                {r.blog_count != null && r.blog_count > 0 && (
                  <span className="text-sky-400">블로그 {r.blog_count}건</span>
                )}
              </p>
            </div>
          </div>

          {/* AI 추천 이유 */}
          <div className="bg-[#FF6F0F]/5 border border-[#FF6F0F]/20 rounded-lg p-3 space-y-1">
            <p className="text-xs text-[#FF6F0F] flex items-center gap-1 font-semibold">
              <Sparkles className="w-3 h-3" /> AI 추천 이유
            </p>
            <p className="text-sm text-secondary leading-6">{r.why}</p>
          </div>

          {/* 쿠폰 */}
          {r.coupon && <CouponCard coupon={r.coupon} />}

          {/* 매칭 시그널 */}
          {r.matched_signals.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1.5 flex items-center gap-1">
                <TagIcon className="w-3 h-3" /> 매칭 근거
              </p>
              <div className="flex flex-wrap gap-1.5">
                {r.matched_signals.map((s, i) => (
                  <span key={i} className="text-[11px] bg-fill-subtle text-muted px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* 주소 + 액션 */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border-subtle">
            {r.address && (
              <p className="text-xs text-muted flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {r.address}
              </p>
            )}
            <div className="flex gap-1.5">
              {r.phone && (
                <a href={`tel:${r.phone}`} className="px-2.5 py-1 text-xs bg-fill-subtle hover:bg-[#FF6F0F]/15 hover:text-[#FF6F0F] rounded-lg flex items-center gap-1 transition">
                  <Phone className="w-3 h-3" /> 전화
                </a>
              )}
              {r.naver_place_url && (
                <a href={r.naver_place_url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 text-xs bg-fill-subtle hover:bg-green-500/15 hover:text-green-400 rounded-lg flex items-center gap-1 transition">
                  <ExternalLink className="w-3 h-3" /> 네이버
                </a>
              )}
              {r.kakao_place_url && (
                <a href={r.kakao_place_url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 text-xs bg-fill-subtle hover:bg-yellow-500/15 hover:text-yellow-400 rounded-lg flex items-center gap-1 transition">
                  <ExternalLink className="w-3 h-3" /> 카카오
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coupon Card                                                          */
/* ------------------------------------------------------------------ */

function CouponCard({ coupon }: { coupon: Coupon }) {
  const [claimed, setClaimed] = useState(false);

  const daysLeft = coupon.valid_until
    ? Math.ceil((new Date(coupon.valid_until).getTime() - Date.now()) / 86400000)
    : 999;

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-[#FF6F0F]/40 bg-gradient-to-r from-[#FF6F0F]/10 to-amber-500/5">
      <div className="absolute top-1/2 -left-2 w-4 h-4 rounded-full bg-card border border-[#FF6F0F]/40 -translate-y-1/2" />
      <div className="absolute top-1/2 -right-2 w-4 h-4 rounded-full bg-card border border-[#FF6F0F]/40 -translate-y-1/2" />

      <div className="p-3 flex items-center gap-3">
        <div className="shrink-0 flex flex-col items-center justify-center bg-[#FF6F0F] text-white rounded-lg px-3 py-2 min-w-[72px]">
          <Ticket className="w-3 h-3 mb-0.5" />
          <p className="font-black text-lg leading-none">{coupon.discount}</p>
          <p className="text-[9px] opacity-80 mt-0.5">할인</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-[#FF6F0F]">{coupon.title}</p>
            {coupon.is_exclusive && (
              <span className="px-1.5 py-0 text-[9px] bg-amber-500/25 text-amber-400 rounded border border-amber-500/40 font-bold">언니픽 독점</span>
            )}
          </div>
          {coupon.description && <p className="text-xs text-secondary mt-0.5">{coupon.description}</p>}
          {coupon.valid_until && (
            <p className="text-[10px] text-muted mt-1">
              {daysLeft > 0
                ? <span className={daysLeft <= 7 ? 'text-red-400' : ''}>⏳ {daysLeft}일 남음 ({coupon.valid_until}까지)</span>
                : <span className="text-red-400">만료됨</span>
              }
            </p>
          )}
        </div>
        <button
          onClick={() => setClaimed(true)}
          disabled={claimed || daysLeft <= 0}
          className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
            claimed ? 'bg-green-500/15 text-green-400 border border-green-500/30'
            : daysLeft <= 0 ? 'bg-fill-subtle text-muted cursor-not-allowed'
            : 'bg-[#FF6F0F] text-white hover:bg-[#FF6F0F]/90'
          }`}
        >
          {claimed ? <><Check className="w-3.5 h-3.5" /> 받음</> : <><Gift className="w-3.5 h-3.5" /> 받기</>}
        </button>
      </div>

      {claimed && (
        <div className="border-t border-dashed border-[#FF6F0F]/20 mx-10 px-3 py-2 text-center bg-[#FF6F0F]/5">
          <p className="text-[10px] text-muted">매장에서 이 코드를 제시해주세요</p>
          <p className="font-mono font-bold text-[#FF6F0F] tracking-widest text-sm mt-0.5">
            UNNIE-{Math.random().toString(36).slice(2, 8).toUpperCase()}
          </p>
        </div>
      )}
    </div>
  );
}
