'use client';

import { useState, useEffect } from 'react';
import { Plus, Copy, Eye, AlertCircle, Sparkles, Loader } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const TEMPLATES = [
  { id: 'modern', name: '모던', desc: '다크 그라디언트' },
  { id: 'bright', name: '밝음', desc: '오렌지/화이트' },
  { id: 'minimal', name: '심플', desc: '순백 배경' },
];

const CATEGORIES = [
  '카페/음료',
  '음식점',
  '뷰티',
  '의류/패션',
  '헬스/피트니스',
  '미용실',
  '부동산',
  '교육',
  '의료',
  '기타',
];

export default function CardNewsPage() {
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'modern' | 'bright' | 'minimal'>('modern');
  const [cards, setCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [editingCardIdx, setEditingCardIdx] = useState<number | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [cardNewsList, setCardNewsList] = useState<CardNews[]>([]);

  // Gemini로 카드 문구 생성
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
        body: JSON.stringify({
          store_name: storeName,
          description,
          category,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCards(data.cards);
    } catch (e: any) {
      alert(`카드 생성 실패: ${e.message}`);
    } finally {
      setLoadingCards(false);
    }
  };

  // 카드 텍스트 수정
  const handleUpdateCard = (idx: number, field: 'title' | 'content', value: string) => {
    const updated = [...cards];
    updated[idx] = { ...updated[idx], [field]: value };
    setCards(updated);
  };

  // 영상 생성
  const handleGenerateVideo = async () => {
    if (cards.length === 0) {
      alert('카드 문구를 먼저 생성해주세요.');
      return;
    }

    setGeneratingVideo(true);
    try {
      const res = await fetch('/api/cardnews/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: storeName,
          cards,
          template: selectedTemplate,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      alert('카드뉴스가 생성되었습니다!');
      setStoreName('');
      setDescription('');
      setCategory('');
      setCards([]);
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
    const styles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      rendering: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      done: 'bg-green-500/10 text-green-400 border-green-500/20',
      error: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    const labels = {
      pending: '대기중',
      rendering: '생성중',
      done: '완료',
      error: '실패',
    };
    return (
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main">
        <h1 className="text-lg font-bold text-primary">📺 카드뉴스 제작</h1>
        <p className="text-xs text-muted mt-0.5">설명 → AI 카드 생성 → 인스타그램 숏츠</p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* 입력 섹션 */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-primary">🎯 기본 정보 입력</h2>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="업체명 (예: 강남 카페 '아메노'"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
            />

            <textarea
              placeholder="한줄 소개 또는 설명 (예: 프리미엄 스페셜티 커피와 홈메이드 디저트를 제공하는 감성 카페입니다)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] resize-none"
            />

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#0f0f10] border border-border-main rounded-lg text-primary text-sm focus:outline-none focus:border-[#FF6F0F]">
              <option value="">카테고리 선택</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <button
              onClick={handleGenerateCards}
              disabled={loadingCards || !storeName.trim() || !description.trim() || !category}
              className="w-full py-2.5 bg-[#6366f1] text-white text-sm font-bold rounded-lg hover:bg-[#6366f1]/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
              {loadingCards ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  AI 카드 생성중...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  AI가 카드 문구 생성
                </>
              )}
            </button>
          </div>
        </div>

        {/* 카드 편집 섹션 */}
        {cards.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-main">
              <h2 className="text-sm font-bold text-primary">✏️ 카드 문구 편집</h2>
              <p className="text-xs text-muted mt-1">각 카드를 확인하고 필요시 수정하세요</p>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-border-subtle">
              {cards.map((card, idx) => (
                <div key={idx} className="p-4 hover:bg-fill-subtle transition">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#FF6F0F] bg-[#FF6F0F]/10 px-2.5 py-1 rounded">
                      카드 {idx + 1}
                    </span>
                    {editingCardIdx === idx && (
                      <button
                        onClick={() => setEditingCardIdx(null)}
                        className="text-xs text-tertiary hover:text-primary">
                        완료
                      </button>
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
                    <div
                      onClick={() => setEditingCardIdx(idx)}
                      className="cursor-pointer space-y-1">
                      <p className="text-sm font-semibold text-primary">{card.title}</p>
                      <p className="text-xs text-muted whitespace-pre-wrap">{card.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 설정 및 생성 섹션 */}
        {cards.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-primary">⚙️ 영상 생성 설정</h2>

            {/* 템플릿 선택 */}
            <div>
              <p className="text-xs font-semibold text-muted mb-2.5">템플릿 선택</p>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id as any)}
                    className={`p-3 rounded-lg border-2 transition text-center ${
                      selectedTemplate === tmpl.id
                        ? 'bg-[#FF6F0F]/10 border-[#FF6F0F] text-primary'
                        : 'bg-fill-subtle border-border-main text-muted hover:border-border-subtle'
                    }`}>
                    <div className="text-xs font-bold">{tmpl.name}</div>
                    <div className="text-[10px] text-dim mt-0.5">{tmpl.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 생성 버튼 */}
            <button
              onClick={handleGenerateVideo}
              disabled={generatingVideo}
              className="w-full py-3 bg-gradient-to-r from-[#FF6F0F] to-[#ff8c3a] text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
              {generatingVideo ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  영상 생성중...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  카드뉴스 영상 생성
                </>
              )}
            </button>
          </div>
        )}

        {/* 히스토리 */}
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
                      <button className="flex-1 py-1.5 text-[10px] font-semibold bg-fill-subtle border border-border-subtle text-tertiary rounded hover:border-border-main transition flex items-center justify-center gap-1">
                        <Eye size={10} /> 미리보기
                      </button>
                      <button className="flex-1 py-1.5 text-[10px] font-semibold bg-fill-subtle border border-border-subtle text-tertiary rounded hover:border-border-main transition flex items-center justify-center gap-1">
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
