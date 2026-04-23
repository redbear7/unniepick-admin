'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Copy, Eye, AlertCircle, Sparkles, Loader, ImagePlus, Search, X,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface Store {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string | null;
  description: string | null;
  emoji: string | null;
  open_time: string | null;
  close_time: string | null;
}

interface Card {
  title: string;
  content: string;
}

interface CardNews {
  id: string;
  store_name: string;
  description: string;
  category: string;
  cards: Card[];
  video_url?: string;
  status: 'pending' | 'rendering' | 'done' | 'error';
  error_message?: string;
  created_at: string;
}

// ── 상수 ─────────────────────────────────────────────────────────────────────
const ASPECT_RATIOS = [
  {
    id: '1:1',
    label: '1:1',
    desc: '피드 정사각형',
    icon: '◼',
    w: 40, h: 40,
  },
  {
    id: '4:5',
    label: '4:5',
    desc: '피드 세로형',
    icon: '▬',
    w: 32, h: 40,
  },
  {
    id: '9:16',
    label: '9:16',
    desc: '릴스/스토리',
    icon: '▮',
    w: 23, h: 40,
  },
] as const;

type AspectRatio = (typeof ASPECT_RATIOS)[number]['id'];

const TEMPLATES = [
  { id: 'modern',  name: '모던',  desc: '다크 그라디언트' },
  { id: 'bright',  name: '밝음',  desc: '오렌지/화이트' },
  { id: 'minimal', name: '심플',  desc: '순백 배경' },
];

// ── 모델 배지 컴포넌트 ────────────────────────────────────────────────────────
function ModelBadge({ model, color = 'indigo' }: { model: string; color?: 'indigo' | 'purple' }) {
  const cls =
    color === 'purple'
      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {model}
    </span>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function CardNewsPage() {
  // 업체 검색
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchResults,   setSearchResults]   = useState<Store[]>([]);
  const [searchOpen,      setSearchOpen]      = useState(false);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [selectedStore,   setSelectedStore]   = useState<Store | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // 기본 정보 (자동 로딩 or 수동 입력)
  const [storeName,    setStoreName]    = useState('');
  const [description,  setDescription]  = useState('');
  const [category,     setCategory]     = useState('');

  // 제작 설정
  const [aspectRatio,       setAspectRatio]       = useState<AspectRatio>('9:16');
  const [selectedTemplate,  setSelectedTemplate]  = useState<'modern' | 'bright' | 'minimal'>('modern');

  // 카드
  const [cards,           setCards]           = useState<Card[]>([]);
  const [loadingCards,    setLoadingCards]    = useState(false);
  const [editingCardIdx,  setEditingCardIdx]  = useState<number | null>(null);

  // 배경 이미지
  const [bgImages,         setBgImages]         = useState<(string | null)[]>([]);
  const [loadingBgImages,  setLoadingBgImages]  = useState(false);

  // 영상
  const [generatingVideo, setGeneratingVideo] = useState(false);

  // 히스토리
  const [cardNewsList, setCardNewsList] = useState<CardNews[]>([]);

  // ── 업체 검색 ───────────────────────────────────────────────────────────────
  const searchStores = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data } = await sb
        .from('stores')
        .select('id, name, category, address, phone, description, emoji, open_time, close_time')
        .ilike('name', `%${q}%`)
        .eq('is_active', true)
        .limit(8);
      setSearchResults((data ?? []) as Store[]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // 디바운스
  useEffect(() => {
    const t = setTimeout(() => searchStores(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchStores]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    setStoreName(store.name);
    setCategory(store.category ?? '');

    // description 자동 구성
    const parts = [store.description].filter(Boolean);
    if (store.address) parts.push(`주소: ${store.address}`);
    if (store.phone) parts.push(`전화: ${store.phone}`);
    if (store.open_time && store.close_time) parts.push(`영업시간: ${store.open_time}~${store.close_time}`);
    setDescription(parts.join('\n') || '');

    setSearchOpen(false);
    setSearchQuery('');
    setCards([]);
    setBgImages([]);
  };

  const handleClearStore = () => {
    setSelectedStore(null);
    setStoreName('');
    setDescription('');
    setCategory('');
    setCards([]);
    setBgImages([]);
  };

  // ── AI 카드 문구 생성 ────────────────────────────────────────────────────────
  const handleGenerateCards = async () => {
    if (!storeName.trim() || !description.trim() || !category) {
      alert('업체명, 설명, 카테고리를 모두 입력해주세요.');
      return;
    }
    setLoadingCards(true);
    try {
      const res = await fetch('/api/cardnews/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_name: storeName, description, category }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCards(data.cards);
      setBgImages([]);
    } catch (e: any) {
      alert(`카드 생성 실패: ${e.message}`);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleUpdateCard = (idx: number, field: 'title' | 'content', value: string) => {
    const updated = [...cards];
    updated[idx] = { ...updated[idx], [field]: value };
    setCards(updated);
  };

  // ── AI 배경 이미지 생성 ───────────────────────────────────────────────────────
  const handleGenerateBgImages = async () => {
    if (cards.length === 0) { alert('카드 문구를 먼저 생성해주세요.'); return; }
    setLoadingBgImages(true);
    try {
      const res = await fetch('/api/cardnews/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: storeName,
          category,
          cards,
          template: selectedTemplate,
          aspect_ratio: aspectRatio,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const imgs = new Array(cards.length).fill(null);
      for (const img of data.images) {
        if (img.status === 'success') imgs[img.card_index] = img.url;
      }
      setBgImages(imgs);
    } catch (e: any) {
      alert(`배경 이미지 생성 실패: ${e.message}`);
    } finally {
      setLoadingBgImages(false);
    }
  };

  // ── 영상 생성 ────────────────────────────────────────────────────────────────
  const handleGenerateVideo = async () => {
    if (cards.length === 0) { alert('카드 문구를 먼저 생성해주세요.'); return; }
    setGeneratingVideo(true);
    try {
      const res = await fetch('/api/cardnews/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: storeName,
          cards,
          template: selectedTemplate,
          bg_images: bgImages.filter(Boolean),
          aspect_ratio: aspectRatio,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      alert('카드뉴스가 생성되었습니다!');
      handleClearStore();
      setCards([]);
      setBgImages([]);
      loadCardNewsList();
    } catch (e: any) {
      alert(`영상 생성 실패: ${e.message}`);
    } finally {
      setGeneratingVideo(false);
    }
  };

  const loadCardNewsList = async () => {
    try {
      const { data, error } = await sb
        .from('card_news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setCardNewsList((data || []) as CardNews[]);
    } catch (e: any) {
      console.error('목록 로드 실패:', e.message);
    }
  };

  useEffect(() => {
    loadCardNewsList();
    const interval = setInterval(loadCardNewsList, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    const s = {
      pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      rendering: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      done:      'bg-green-500/10 text-green-400 border-green-500/20',
      error:     'bg-red-500/10 text-red-400 border-red-500/20',
    };
    const l = { pending: '대기중', rendering: '생성중', done: '완료', error: '실패' };
    return (
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s[status as keyof typeof s]}`}>
        {l[status as keyof typeof l]}
      </span>
    );
  };

  // 비율에 따른 카드 썸네일 비율 클래스
  const thumbClass: Record<AspectRatio, string> = {
    '1:1':  'aspect-square',
    '4:5':  'aspect-[4/5]',
    '9:16': 'aspect-[9/16]',
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-primary">📺 카드뉴스 제작</h1>
          <p className="text-xs text-muted mt-0.5">업체 검색 → AI 카드 생성 → 인스타그램 숏츠</p>
        </div>
        <div className="flex items-center gap-2">
          <ModelBadge model="Gemini 2.0 Flash" color="indigo" />
          <ModelBadge model="Gemini 2.5 Flash Image" color="purple" />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-5">

        {/* ── STEP 1: 업체 검색 ─────────────────────────────────────────────── */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#FF6F0F] text-white text-[10px] font-bold flex items-center justify-center">1</span>
              업체 검색
            </h2>
          </div>

          {/* 선택된 업체 칩 */}
          {selectedStore ? (
            <div className="flex items-center gap-3 p-3.5 bg-[#FF6F0F]/10 border border-[#FF6F0F]/30 rounded-xl">
              <span className="text-2xl">{selectedStore.emoji ?? '🏪'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-primary truncate">{selectedStore.name}</p>
                <p className="text-xs text-muted truncate">{selectedStore.category} · {selectedStore.address}</p>
              </div>
              <button
                onClick={handleClearStore}
                className="p-1 rounded-full text-muted hover:text-primary hover:bg-fill-subtle transition"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            /* 검색 드롭다운 */
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="업체명으로 검색... (예: 강남 카페)"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] transition"
                />
                {searchLoading && (
                  <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />
                )}
              </div>

              {searchOpen && searchResults.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-surface border border-border-main rounded-xl shadow-2xl overflow-hidden">
                  {searchResults.map(store => (
                    <button
                      key={store.id}
                      onClick={() => handleSelectStore(store)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-fill-subtle transition text-left border-b border-border-subtle last:border-b-0"
                    >
                      <span className="text-xl w-8 text-center">{store.emoji ?? '🏪'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">{store.name}</p>
                        <p className="text-xs text-muted truncate">{store.category} · {store.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchOpen && searchQuery.length > 0 && !searchLoading && searchResults.length === 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-surface border border-border-main rounded-xl shadow-2xl px-4 py-6 text-center">
                  <p className="text-xs text-muted">검색 결과 없음</p>
                </div>
              )}
            </div>
          )}

          {/* 자동 로딩된 정보 편집 영역 */}
          {selectedStore && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">업체명</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm focus:outline-none focus:border-[#FF6F0F]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">카테고리</label>
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm focus:outline-none focus:border-[#FF6F0F]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">업체 설명 (AI 생성에 활용)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm focus:outline-none focus:border-[#FF6F0F] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── STEP 2: 비율 + 템플릿 선택 ──────────────────────────────────────── */}
        {selectedStore && (
          <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#FF6F0F] text-white text-[10px] font-bold flex items-center justify-center">2</span>
              제작 설정
            </h2>

            {/* 비율 선택 */}
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
                제작 비율
              </p>
              <div className="grid grid-cols-3 gap-3">
                {ASPECT_RATIOS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setAspectRatio(r.id)}
                    className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition ${
                      aspectRatio === r.id
                        ? 'bg-[#FF6F0F]/10 border-[#FF6F0F]'
                        : 'bg-fill-subtle border-border-main hover:border-border-subtle'
                    }`}
                  >
                    {/* 비율 미리보기 사각형 */}
                    <div
                      className={`rounded border-2 transition ${
                        aspectRatio === r.id ? 'border-[#FF6F0F] bg-[#FF6F0F]/20' : 'border-border-main bg-fill-subtle'
                      }`}
                      style={{ width: r.w, height: r.h }}
                    />
                    <div className="text-center">
                      <p className={`text-xs font-bold ${aspectRatio === r.id ? 'text-[#FF6F0F]' : 'text-primary'}`}>{r.label}</p>
                      <p className="text-[10px] text-muted mt-0.5">{r.desc}</p>
                    </div>
                    {aspectRatio === r.id && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#FF6F0F] flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">✓</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 템플릿 선택 */}
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
                템플릿
              </p>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id as any)}
                    className={`p-3 rounded-lg border-2 transition text-center ${
                      selectedTemplate === tmpl.id
                        ? 'bg-[#FF6F0F]/10 border-[#FF6F0F] text-primary'
                        : 'bg-fill-subtle border-border-main text-muted hover:border-border-subtle'
                    }`}
                  >
                    <div className="text-xs font-bold">{tmpl.name}</div>
                    <div className="text-[10px] text-dim mt-0.5">{tmpl.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: AI 카드 문구 생성 ────────────────────────────────────────── */}
        {selectedStore && (
          <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#FF6F0F] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                카드 문구 생성
              </h2>
              <ModelBadge model="Gemini 2.0 Flash" color="indigo" />
            </div>

            <button
              onClick={handleGenerateCards}
              disabled={loadingCards || !storeName.trim() || !description.trim() || !category}
              className="w-full py-2.5 bg-[#6366f1] text-white text-sm font-bold rounded-lg hover:bg-[#6366f1]/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loadingCards ? (
                <><Loader size={14} className="animate-spin" />AI 카드 문구 생성중...</>
              ) : (
                <><Sparkles size={14} />AI 카드 문구 자동 생성 (5장)</>
              )}
            </button>
          </div>
        )}

        {/* ── STEP 4: 카드 편집 + 배경 이미지 생성 ──────────────────────────────── */}
        {cards.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-main flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#FF6F0F] text-white text-[10px] font-bold flex items-center justify-center">4</span>
                  카드 편집
                </h2>
                <p className="text-xs text-muted mt-1 ml-6.5">각 카드를 확인하고 필요시 수정하세요</p>
              </div>
              <span className="text-xs text-muted font-mono">{aspectRatio} · {TEMPLATES.find(t => t.id === selectedTemplate)?.name}</span>
            </div>

            <div className="max-h-[480px] overflow-y-auto divide-y divide-border-subtle">
              {cards.map((card, idx) => (
                <div key={idx} className="p-4 hover:bg-fill-subtle transition">
                  <div className="flex items-start gap-3">
                    {/* 배경 이미지 썸네일 */}
                    {bgImages[idx] ? (
                      <div className={`${thumbClass[aspectRatio]} w-14 shrink-0 overflow-hidden rounded-lg border border-border-subtle`}>
                        <img
                          src={bgImages[idx]!}
                          alt={`카드 ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`${thumbClass[aspectRatio]} w-14 shrink-0 rounded-lg border-2 border-dashed border-border-main bg-fill-subtle flex items-center justify-center`}>
                        <span className="text-[10px] text-muted">{aspectRatio}</span>
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[#FF6F0F] bg-[#FF6F0F]/10 px-2.5 py-1 rounded">
                          카드 {idx + 1}
                        </span>
                        {editingCardIdx === idx && (
                          <button onClick={() => setEditingCardIdx(null)} className="text-xs text-tertiary hover:text-primary">완료</button>
                        )}
                      </div>

                      {editingCardIdx === idx ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={card.title}
                            onChange={e => handleUpdateCard(idx, 'title', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0f0f10] border border-border-main rounded text-sm text-primary focus:outline-none focus:border-[#FF6F0F]"
                            placeholder="제목"
                          />
                          <textarea
                            value={card.content}
                            onChange={e => handleUpdateCard(idx, 'content', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-[#0f0f10] border border-border-main rounded text-sm text-primary focus:outline-none focus:border-[#FF6F0F] resize-none"
                            placeholder="내용"
                          />
                        </div>
                      ) : (
                        <div onClick={() => setEditingCardIdx(idx)} className="cursor-pointer space-y-1">
                          <p className="text-sm font-semibold text-primary">{card.title}</p>
                          <p className="text-xs text-muted whitespace-pre-wrap">{card.content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 배경 이미지 생성 */}
            <div className="px-5 py-4 border-t border-border-main space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">배경 이미지 생성 (선택)</p>
                <ModelBadge model="Gemini 2.5 Flash Image" color="purple" />
              </div>
              <button
                onClick={handleGenerateBgImages}
                disabled={loadingBgImages}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {loadingBgImages ? (
                  <><Loader size={14} className="animate-spin" />AI 배경 이미지 생성중... (카드당 약 10초)</>
                ) : (
                  <><ImagePlus size={14} />AI 배경 이미지 생성 ({aspectRatio} 비율)</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: 생성 버튼 ─────────────────────────────────────────────── */}
        {cards.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#FF6F0F] text-white text-[10px] font-bold flex items-center justify-center">5</span>
              카드뉴스 생성
            </h2>

            {/* 요약 정보 */}
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-0.5 bg-fill-subtle border border-border-main rounded-full text-tertiary">{storeName}</span>
              <span className="px-2 py-0.5 bg-fill-subtle border border-border-main rounded-full text-tertiary">{aspectRatio}</span>
              <span className="px-2 py-0.5 bg-fill-subtle border border-border-main rounded-full text-tertiary">{TEMPLATES.find(t => t.id === selectedTemplate)?.name} 템플릿</span>
              <span className="px-2 py-0.5 bg-fill-subtle border border-border-main rounded-full text-tertiary">{cards.length}장</span>
              {bgImages.filter(Boolean).length > 0 && (
                <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400">
                  배경 이미지 {bgImages.filter(Boolean).length}장 포함
                </span>
              )}
            </div>

            <button
              onClick={handleGenerateVideo}
              disabled={generatingVideo}
              className="w-full py-3 bg-gradient-to-r from-[#FF6F0F] to-[#ff8c3a] text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {generatingVideo ? (
                <><Loader size={16} className="animate-spin" />카드뉴스 영상 생성중...</>
              ) : (
                <><Plus size={16} />카드뉴스 영상 생성하기</>
              )}
            </button>
          </div>
        )}

        {/* ── 생성 이력 ──────────────────────────────────────────────────────── */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-main">
            <h2 className="text-sm font-bold text-primary">📹 생성 이력</h2>
          </div>

          {cardNewsList.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted">아직 생성된 카드뉴스가 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle max-h-96 overflow-y-auto">
              {cardNewsList.map(card => (
                <div key={card.id} className="px-5 py-4 hover:bg-fill-subtle transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-primary">{card.store_name}</p>
                      <p className="text-xs text-muted mt-1">{new Date(card.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    {getStatusBadge(card.status)}
                  </div>

                  {card.status === 'done' && card.video_url && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => window.open(card.video_url, '_blank')}
                        className="flex-1 py-1.5 text-[10px] font-semibold bg-fill-subtle border border-border-subtle text-tertiary rounded hover:border-border-main transition flex items-center justify-center gap-1"
                      >
                        <Eye size={10} /> 미리보기
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(card.video_url!); alert('링크가 복사되었습니다.'); }}
                        className="flex-1 py-1.5 text-[10px] font-semibold bg-fill-subtle border border-border-subtle text-tertiary rounded hover:border-border-main transition flex items-center justify-center gap-1"
                      >
                        <Copy size={10} /> 링크복사
                      </button>
                    </div>
                  )}

                  {card.status === 'error' && (
                    <div className="mt-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 flex gap-2">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      {card.error_message || '생성 실패'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
