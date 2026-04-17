'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Search, Loader2, Check, Star, MapPin,
  MessageSquare, UtensilsCrossed, ExternalLink, Phone,
  Trophy, Info, Tag as TagIcon, RefreshCw,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface ParsedFilter {
  location?: { gu?: string | null; dong?: string | null };
  category_hints?: string[];
  scene?: string;
  amenity?: string[];
  mood?: string[];
  price_tier?: 'low' | 'mid' | 'high';
  craving?: string[];
  rewritten_intent?: string;
}

interface Recommendation {
  rank: number;
  restaurant_id: string;
  name: string;
  category: string;
  rating?: number;
  review_count?: number;
  address?: string;
  image_url?: string;
  phone?: string;
  naver_place_url?: string;
  why: string;
  matched_signals: string[];
  owner_pick?: string;
}

type StageStatus = 'idle' | 'parsing' | 'searching' | 'ranking' | 'done';

/* ------------------------------------------------------------------ */
/* Mock Data (AI 연동 전 테스트용)                                      */
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

const MOCK_DATA: Record<string, { filter: ParsedFilter; candidateCount: number; recommendations: Recommendation[] }> = {
  '상남동 상견례 룸 한식': {
    filter: {
      location: { gu: '성산구', dong: '상남동' },
      category_hints: ['한식', '한정식'],
      scene: '상견례',
      amenity: ['룸', '단체석'],
      mood: ['고급진', '조용한'],
      price_tier: 'high',
      rewritten_intent: '상남동에서 양가 상견례를 진행할 수 있는 룸이 있는 격식 있는 한식당',
    },
    candidateCount: 28,
    recommendations: [
      {
        rank: 1,
        restaurant_id: 'mock-1',
        name: '서라벌한정식 상남본점',
        category: '한정식',
        rating: 4.8,
        review_count: 312,
        address: '창원 성산구 상남동 중앙대로 123',
        image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
        phone: '055-123-4567',
        naver_place_url: 'https://map.naver.com',
        why: 'VIP 독립룸 2개와 정통 한정식 코스를 갖춘 창원 상남동 대표 상견례 장소. 최근 3개월 블로그 후기 12건에서 "상견례", "부모님 모시고" 키워드가 다수 등장.',
        matched_signals: ['"음식이 맛있어요" 267명', '"재료가 신선해요" 185명', '룸 태그', '한정식 카테고리'],
        owner_pick: '25년 된 한옥 서까래 그대로 살린 공간',
      },
      {
        rank: 2,
        restaurant_id: 'mock-2',
        name: '한옥마당 상남점',
        category: '한식',
        rating: 4.7,
        review_count: 198,
        address: '창원 성산구 상남동 마디미로 45',
        image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
        phone: '055-234-5678',
        naver_place_url: 'https://map.naver.com',
        why: '프라이빗 다이닝룸 3개 보유, 전통 한정식 + 와인 페어링 제공. "조용한 분위기"와 "격식 있는 서비스" 리뷰 다수.',
        matched_signals: ['"분위기가 좋아요" 142명', '"친절해요" 121명', '프라이빗룸', '예약가능'],
      },
      {
        rank: 3,
        restaurant_id: 'mock-3',
        name: '청기와 상남',
        category: '한식',
        rating: 4.6,
        review_count: 156,
        address: '창원 성산구 상남동 상남로 89',
        image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
        phone: '055-345-6789',
        naver_place_url: 'https://map.naver.com',
        why: '단체석 최대 20명 수용, 양가 상견례 코스 메뉴 별도 운영. 한복 대여 서비스 포함.',
        matched_signals: ['단체석 태그', '"특별한 메뉴" 98명', '상견례 코스'],
        owner_pick: '상견례 가족 사진 촬영 무료 제공',
      },
    ],
  },
  '오늘 매운 거 혼밥 1만원': {
    filter: {
      category_hints: ['분식', '중식', '한식'],
      scene: '혼밥',
      craving: ['매운거'],
      price_tier: 'low',
      rewritten_intent: '1만원 이하 혼자 먹기 편한 매운 메뉴',
    },
    candidateCount: 42,
    recommendations: [
      {
        rank: 1,
        restaurant_id: 'mock-4',
        name: '신전떡볶이 상남점',
        category: '분식',
        rating: 4.5,
        review_count: 523,
        address: '창원 성산구 상남동 상남로 22',
        image_url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&q=80',
        why: '1인 세트 8,500원, 카운터석 6석으로 혼밥하기 편함. 매운맛 단계 조절 가능.',
        matched_signals: ['"매워요" 187명', '1인석 태그', '8천원대'],
      },
      {
        rank: 2,
        restaurant_id: 'mock-5',
        name: '창원 마라탕 본점',
        category: '중식',
        rating: 4.6,
        review_count: 289,
        address: '창원 성산구 중앙동 중앙대로 156',
        image_url: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&q=80',
        why: '1인 마라탕 9천원, 본인 맵기 선택 가능. 저녁 늦게까지 영업하여 혼밥 자유로움.',
        matched_signals: ['"혼밥 좋아요" 82명', '매운맛 3단계'],
      },
    ],
  },
  '진해 벚꽃뷰 카페': {
    filter: {
      location: { gu: '진해구' },
      category_hints: ['카페'],
      mood: ['뷰맛집', '인스타감성'],
      rewritten_intent: '진해에서 벚꽃 뷰가 좋은 감성 카페',
    },
    candidateCount: 17,
    recommendations: [
      {
        rank: 1,
        restaurant_id: 'mock-6',
        name: '여좌천뷰 카페',
        category: '카페',
        rating: 4.9,
        review_count: 1042,
        address: '창원 진해구 여좌동 여좌천로 12',
        image_url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&q=80',
        why: '여좌천 벚꽃길 바로 앞. 2층 통창에서 벚꽃 터널을 한눈에. 4월 군항제 기간 예약 필수.',
        matched_signals: ['"뷰가 좋아요" 412명', '"벚꽃" 리뷰 89건', '루프탑 태그'],
        owner_pick: '벚꽃 시즌 한정 라떼 3종',
      },
    ],
  },
};

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

  async function simulateSearch(q: string) {
    setStage('parsing');
    setFilter(null);
    setCandidateCount(0);
    setRecommendations([]);

    // 목 데이터 매칭
    const mock = MOCK_DATA[q.trim()] ?? generateGenericMock(q);

    // Stage 1: 파싱
    await wait(800);
    setFilter(mock.filter);

    // Stage 2: 검색
    setStage('searching');
    await wait(600);
    setCandidateCount(mock.candidateCount);

    // Stage 3: 랭킹 — 카드 하나씩 점진 추가
    setStage('ranking');
    for (const r of mock.recommendations) {
      await wait(700);
      setRecommendations((prev) => [...prev, r]);
    }

    setStage('done');
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || stage === 'parsing' || stage === 'searching' || stage === 'ranking') return;
    simulateSearch(query);
  }

  function runExample(q: string) {
    setQuery(q);
    simulateSearch(q);
  }

  function reset() {
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
            자연어로 질문하면 창원 맛집을 상황에 맞춰 추천합니다 · <span className="text-amber-400">UI 시안 (목 데이터)</span>
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
        <ProgressPanel
          stage={stage}
          filter={filter}
          candidateCount={candidateCount}
          query={query}
        />
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

      {/* 빈 상태 (done인데 결과 없음) */}
      {stage === 'done' && recommendations.length === 0 && (
        <div className="text-center py-16 text-muted">
          <p>조건에 맞는 맛집을 찾지 못했어요.</p>
          <p className="text-sm mt-1">조건을 조금 완화해보세요.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress Panel                                                       */
/* ------------------------------------------------------------------ */

function ProgressPanel({
  stage, filter, candidateCount, query,
}: {
  stage: StageStatus;
  filter: ParsedFilter | null;
  candidateCount: number;
  query: string;
}) {
  return (
    <div className="bg-card border border-border-main rounded-xl p-4 space-y-3">
      <StageRow
        label="쿼리 분석"
        done={stage !== 'parsing' && !!filter}
        active={stage === 'parsing'}
      >
        {filter && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filter.location?.dong && (
              <Chip icon={<MapPin className="w-3 h-3" />} color="blue">{filter.location.dong}</Chip>
            )}
            {filter.location?.gu && !filter.location?.dong && (
              <Chip icon={<MapPin className="w-3 h-3" />} color="blue">{filter.location.gu}</Chip>
            )}
            {filter.scene && <Chip color="purple">{filter.scene}</Chip>}
            {filter.category_hints?.map((c) => (
              <Chip key={c} icon={<UtensilsCrossed className="w-3 h-3" />} color="orange">{c}</Chip>
            ))}
            {filter.amenity?.map((a) => <Chip key={a} color="green">{a}</Chip>)}
            {filter.mood?.map((m) => <Chip key={m} color="pink">{m}</Chip>)}
            {filter.craving?.map((c) => <Chip key={c} color="red">{c}</Chip>)}
            {filter.price_tier && (
              <Chip color="amber">
                {filter.price_tier === 'low' ? '1만원↓' : filter.price_tier === 'mid' ? '1~3만원' : '3만원↑'}
              </Chip>
            )}
          </div>
        )}
        {filter?.rewritten_intent && (
          <p className="text-xs text-muted mt-2 italic">💭 {filter.rewritten_intent}</p>
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

      <StageRow
        label="AI 추천 선별"
        done={stage === 'done'}
        active={stage === 'ranking'}
      />
    </div>
  );
}

function StageRow({
  label, done, active, children,
}: {
  label: string;
  done: boolean;
  active: boolean;
  children?: React.ReactNode;
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

function Chip({ children, icon, color }: { children: React.ReactNode; icon?: React.ReactNode; color: 'blue' | 'purple' | 'orange' | 'green' | 'pink' | 'red' | 'amber' }) {
  const map = {
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
    orange: 'bg-[#FF6F0F]/15 text-[#FF6F0F] border-[#FF6F0F]/30',
    green: 'bg-green-500/15 text-green-400 border-green-500/25',
    pink: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
    red: 'bg-red-500/15 text-red-400 border-red-500/25',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border flex items-center gap-1 ${map[color]}`}>
      {icon} {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Recommendation Card                                                  */
/* ------------------------------------------------------------------ */

function RecommendationCard({ r }: { r: Recommendation }) {
  const medalColor = r.rank === 1 ? 'bg-amber-500' : r.rank === 2 ? 'bg-slate-400' : r.rank === 3 ? 'bg-orange-700' : 'bg-fill-subtle';

  return (
    <div className="bg-card border border-border-main rounded-xl overflow-hidden hover:border-[#FF6F0F]/50 transition group">
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-primary">{r.name}</h3>
              <p className="text-sm text-muted flex items-center gap-2 mt-1">
                <span>{r.category}</span>
                {r.rating != null && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" /> {r.rating}
                  </span>
                )}
                {r.review_count != null && (
                  <span>리뷰 {r.review_count.toLocaleString()}</span>
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

          {/* 점장 자랑 */}
          {r.owner_pick && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-1">
              <p className="text-xs text-amber-400 flex items-center gap-1 font-semibold">
                <Info className="w-3 h-3" /> 사장님 자랑
              </p>
              <p className="text-sm text-secondary italic">"{r.owner_pick}"</p>
            </div>
          )}

          {/* 매칭 시그널 */}
          {r.matched_signals.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1.5 flex items-center gap-1">
                <TagIcon className="w-3 h-3" /> 매칭 근거
              </p>
              <div className="flex flex-wrap gap-1.5">
                {r.matched_signals.map((s, i) => (
                  <span key={i} className="text-[11px] bg-fill-subtle text-muted px-2 py-0.5 rounded">
                    {s}
                  </span>
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
                <a
                  href={`tel:${r.phone}`}
                  className="px-2.5 py-1 text-xs bg-fill-subtle hover:bg-[#FF6F0F]/15 hover:text-[#FF6F0F] rounded-lg flex items-center gap-1 transition"
                >
                  <Phone className="w-3 h-3" /> 전화
                </a>
              )}
              {r.naver_place_url && (
                <a
                  href={r.naver_place_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs bg-fill-subtle hover:bg-[#FF6F0F]/15 hover:text-[#FF6F0F] rounded-lg flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3" /> 네이버
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
/* Utils                                                                */
/* ------------------------------------------------------------------ */

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** MOCK_DATA에 없는 쿼리는 포괄적 가짜 응답 생성 */
function generateGenericMock(q: string) {
  return {
    filter: {
      rewritten_intent: `"${q}"에 맞는 맛집 (목 데이터 — 실제 AI 연동 전)`,
    } as ParsedFilter,
    candidateCount: 0,
    recommendations: [] as Recommendation[],
  };
}
