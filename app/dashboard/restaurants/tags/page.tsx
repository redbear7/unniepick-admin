'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Tag, Hash, Search, Plus, X, Loader2, TrendingUp,
  ChevronDown, Store, Star, RefreshCw, Sparkles,
} from 'lucide-react';

// ── 타입 ────────────────────────────────────────────────────────────
interface Restaurant {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  image_url: string | null;
  visitor_review_count: number;
  custom_tags: string[];
  review_keywords: Array<{ keyword: string; count: number }>;
  menu_keywords: Array<{ menu: string; count: number }>;
  operating_status: string | null;
}

interface TagStat {
  tag: string;
  count: number;
  restaurants: string[];
}

/** 업체의 리뷰·메뉴 키워드에서 추천 태그 자동 추출 */
function getAutoTags(r: Restaurant): string[] {
  const reviewTop = [...(r.review_keywords ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((k) => k.keyword);
  const menuTop = [...(r.menu_keywords ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((k) => k.menu);
  return [...new Set([...reviewTop, ...menuTop])];
}

/** 카드에 표기할 대표 태그 3개 (custom_tags 우선, 부족하면 auto 보완) */
export function getRepresentativeTags(r: {
  custom_tags?: string[];
  review_keywords?: Array<{ keyword: string; count: number }>;
  menu_keywords?: Array<{ menu: string; count: number }>;
}): string[] {
  const custom = r.custom_tags ?? [];
  const reviewTop = [...(r.review_keywords ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((k) => k.keyword);
  const menuTop = [...(r.menu_keywords ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((k) => k.menu);

  const combined = [...new Set([...custom, ...reviewTop, ...menuTop])];
  return combined.slice(0, 3);
}

// ── 프리셋 태그 카테고리 ────────────────────────────────────────────
const PRESET_TAGS: Record<string, string[]> = {
  '🌟 분위기': ['데이트', '가족모임', '혼밥', '단체석', '조용한', '모던한', '레트로', '뷰맛집'],
  '🅿️ 편의': ['주차가능', '포장가능', '배달가능', '예약가능', '24시', '반려동물', '키즈존'],
  '🍽 음식특징': ['매운맛', '담백한', '푸짐한', '가성비', '프리미엄', '건강식', '채식가능'],
  '📍 위치특성': ['역세권', '상가거리', '골목맛집', '드라이브스루', '바다뷰', '산뷰'],
  '⭐ 특이사항': ['맛집인정', '줄서는곳', '인스타맛집', '단골맛집', '오래된맛집', '신규오픈'],
};

// ── 메인 페이지 ─────────────────────────────────────────────────────
export default function RestaurantTagsPage() {
  const sb = createClient();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 선택된 업체의 태그 편집 상태
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // ── 로드 ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb
      .from('restaurants')
      .select('id, name, category, address, image_url, visitor_review_count, custom_tags, review_keywords, menu_keywords, operating_status')
      .neq('operating_status', 'inactive')
      .order('visitor_review_count', { ascending: false })
      .limit(300);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Restaurant[];
    setRestaurants(rows);

    // 태그 통계 집계
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      const allTags = [
        ...(r.custom_tags ?? []),
        ...getAutoTags(r),
      ];
      for (const tag of allTags) {
        if (!tag?.trim()) continue;
        if (!map.has(tag)) map.set(tag, new Set());
        map.get(tag)!.add(r.name);
      }
    }
    const stats: TagStat[] = [...map.entries()]
      .map(([tag, names]) => ({ tag, count: names.size, restaurants: [...names].slice(0, 5) }))
      .sort((a, b) => b.count - a.count);
    setTagStats(stats);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── 편집 시작 ──────────────────────────────────────────────────────
  function startEdit(r: Restaurant) {
    setEditingId(r.id);
    setEditTags([...(r.custom_tags ?? [])]);
    setNewTag('');
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t || editTags.includes(t) || editTags.length >= 10) return;
    setEditTags((prev) => [...prev, t]);
    setNewTag('');
  }

  function removeTag(tag: string) {
    setEditTags((prev) => prev.filter((t) => t !== tag));
  }

  // ── 저장 ──────────────────────────────────────────────────────────
  async function saveEdit(restaurantId: string) {
    setSaving(true);
    const res = await fetch('/api/restaurants/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, tags: editTags }),
    });
    if (res.ok) {
      setRestaurants((prev) =>
        prev.map((r) => r.id === restaurantId ? { ...r, custom_tags: editTags } : r),
      );
      setEditingId(null);
      await loadData(); // 통계 갱신
    }
    setSaving(false);
  }

  // ── 필터링 ──────────────────────────────────────────────────────────
  const filtered = restaurants.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.name.toLowerCase().includes(q)
      || r.category?.toLowerCase().includes(q)
      || (r.custom_tags ?? []).some((t) => t.includes(q));

    const allTags = [...(r.custom_tags ?? []), ...getAutoTags(r)];
    const matchTag = !tagFilter || allTags.includes(tagFilter);

    return matchSearch && matchTag;
  });

  // ── 요약 통계 ──────────────────────────────────────────────────────
  const totalTagged = restaurants.filter((r) => (r.custom_tags ?? []).length > 0).length;
  const totalUntagged = restaurants.length - totalTagged;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Tag className="w-6 h-6 text-[#FF6F0F]" />
            업체 태그 관리
          </h1>
          <p className="text-sm text-muted mt-1">
            크롤링 데이터 기반 자동 태그 + 커스텀 태그 · 업체 카드에 대표 태그 3개 표기
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-lg text-muted hover:text-primary hover:bg-fill-subtle"
          title="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Hash className="w-4 h-4" />} label="전체 태그 종류" value={`${tagStats.length}개`} />
        <StatCard icon={<Store className="w-4 h-4" />} label="태그 있는 업체" value={`${totalTagged}개`} color="text-green-400" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="태그 미설정" value={`${totalUntagged}개`} color="text-amber-400" />
        <StatCard icon={<Star className="w-4 h-4" />} label="가장 많은 태그" value={tagStats[0]?.tag ?? '-'} color="text-[#FF6F0F]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 태그 목록 패널 */}
        <div className="space-y-3">
          <div className="bg-card border border-border-main rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
              <span className="text-sm font-semibold text-primary flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FF6F0F]" />
                인기 태그
              </span>
              <span className="text-xs text-muted">{tagStats.length}개</span>
            </div>
            <div className="p-3 space-y-1 max-h-[500px] overflow-y-auto">
              <button
                onClick={() => setTagFilter('')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                  !tagFilter ? 'bg-[#FF6F0F]/15 text-[#FF6F0F] font-semibold' : 'text-secondary hover:bg-fill-subtle'
                }`}
              >
                <span>전체 업체</span>
                <span className="text-xs text-muted">{restaurants.length}</span>
              </button>

              {loading ? (
                <div className="py-6 text-center text-muted text-sm">로딩 중...</div>
              ) : (
                tagStats.map((stat) => (
                  <button
                    key={stat.tag}
                    onClick={() => setTagFilter(tagFilter === stat.tag ? '' : stat.tag)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                      tagFilter === stat.tag
                        ? 'bg-[#FF6F0F]/15 text-[#FF6F0F] font-semibold'
                        : 'text-secondary hover:bg-fill-subtle'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Hash className="w-3 h-3 opacity-60" />
                      {stat.tag}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      tagFilter === stat.tag
                        ? 'bg-[#FF6F0F]/20 text-[#FF6F0F]'
                        : 'bg-fill-subtle text-muted'
                    }`}>
                      {stat.count}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 프리셋 태그 */}
          <div className="bg-card border border-border-main rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle">
              <span className="text-sm font-semibold text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                프리셋 태그
              </span>
            </div>
            <div className="p-3 space-y-3">
              {Object.entries(PRESET_TAGS).map(([cat, tags]) => (
                <div key={cat}>
                  <p className="text-xs text-muted mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => editingId && addTag(tag)}
                        className={`px-2 py-1 rounded-full text-[11px] font-semibold border transition ${
                          editTags.includes(tag)
                            ? 'bg-[#FF6F0F] border-[#FF6F0F] text-white'
                            : 'border-border-sub text-muted hover:border-[#FF6F0F] hover:text-[#FF6F0F]'
                        } ${!editingId ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!editingId && (
                <p className="text-xs text-muted text-center py-2">
                  업체를 선택하면 태그를 추가할 수 있어요
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 업체 목록 */}
        <div className="lg:col-span-2 space-y-3">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="업체명, 카테고리, 태그 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border-main rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
            />
          </div>

          {/* 필터 상태 */}
          {tagFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">필터:</span>
              <span className="flex items-center gap-1 px-2 py-1 bg-[#FF6F0F]/15 text-[#FF6F0F] text-xs rounded-full font-semibold">
                #{tagFilter}
                <button onClick={() => setTagFilter('')} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
              <span className="text-xs text-muted">{filtered.length}개 업체</span>
            </div>
          )}

          {/* 업체 목록 */}
          {loading ? (
            <div className="py-20 text-center text-muted">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              로딩 중...
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <RestaurantTagCard
                  key={r.id}
                  restaurant={r}
                  isEditing={editingId === r.id}
                  editTags={editTags}
                  newTag={newTag}
                  saving={saving}
                  onStartEdit={() => startEdit(r)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={() => saveEdit(r.id)}
                  onAddTag={addTag}
                  onRemoveTag={removeTag}
                  onNewTagChange={setNewTag}
                />
              ))}
              {filtered.length === 0 && (
                <div className="py-16 text-center text-muted">
                  검색 결과가 없습니다
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 업체 태그 카드 ─────────────────────────────────────────────────
function RestaurantTagCard({
  restaurant: r,
  isEditing,
  editTags,
  newTag,
  saving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onAddTag,
  onRemoveTag,
  onNewTagChange,
}: {
  restaurant: Restaurant;
  isEditing: boolean;
  editTags: string[];
  newTag: string;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onNewTagChange: (v: string) => void;
}) {
  const autoTags = getAutoTags(r);
  const representativeTags = getRepresentativeTags(r);

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition ${
      isEditing ? 'border-[#FF6F0F]/50' : 'border-border-main'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* 썸네일 */}
          {r.image_url ? (
            <img
              src={r.image_url}
              alt={r.name}
              className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-fill-subtle flex items-center justify-center flex-shrink-0 text-xl">
              🍽️
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-primary text-sm">{r.name}</p>
                <p className="text-xs text-muted">{r.category} · 리뷰 {(r.visitor_review_count ?? 0).toLocaleString()}건</p>
              </div>
              {!isEditing && (
                <button
                  onClick={onStartEdit}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-fill-subtle text-secondary hover:bg-[#FF6F0F]/10 hover:text-[#FF6F0F] transition flex-shrink-0"
                >
                  태그 편집
                </button>
              )}
            </div>

            {/* 대표 태그 3개 표기 */}
            {!isEditing && (
              <div className="mt-2 flex flex-wrap gap-1">
                {representativeTags.length > 0 ? (
                  representativeTags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        (r.custom_tags ?? []).includes(tag)
                          ? 'bg-[#FF6F0F]/15 text-[#FF6F0F] border border-[#FF6F0F]/30'
                          : 'bg-fill-subtle text-secondary border border-border-subtle'
                      }`}
                    >
                      #{tag}
                      {(r.custom_tags ?? []).includes(tag) && (
                        <span className="text-[9px] opacity-60">✎</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted italic">태그 없음</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 편집 모드 */}
        {isEditing && (
          <div className="mt-4 space-y-3">
            {/* 현재 커스텀 태그 */}
            <div>
              <p className="text-xs text-muted mb-1.5 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                커스텀 태그 (최대 10개)
              </p>
              <div className="flex flex-wrap gap-1 min-h-[32px]">
                {editTags.length > 0 ? editTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FF6F0F]/15 text-[#FF6F0F] border border-[#FF6F0F]/30 rounded-full text-[11px] font-semibold"
                  >
                    #{tag}
                    <button onClick={() => onRemoveTag(tag)} className="hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )) : (
                  <span className="text-xs text-muted italic">태그를 추가해주세요</span>
                )}
              </div>
            </div>

            {/* 자동 태그 추천 */}
            {autoTags.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  리뷰 기반 추천 태그 (클릭하여 추가)
                </p>
                <div className="flex flex-wrap gap-1">
                  {autoTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => onAddTag(tag)}
                      disabled={editTags.includes(tag)}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${
                        editTags.includes(tag)
                          ? 'bg-fill-subtle border-border-subtle text-muted cursor-not-allowed'
                          : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10 cursor-pointer'
                      }`}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 태그 직접 입력 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="태그 직접 입력 (Enter)"
                value={newTag}
                onChange={(e) => onNewTagChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onAddTag(newTag); }
                }}
                maxLength={20}
                className="flex-1 px-3 py-1.5 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
              />
              <button
                onClick={() => onAddTag(newTag)}
                disabled={!newTag.trim()}
                className="px-3 py-1.5 bg-fill-subtle text-secondary hover:bg-[#FF6F0F]/10 hover:text-[#FF6F0F] rounded-lg text-sm transition disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* 저장/취소 버튼 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onCancelEdit}
                className="px-4 py-2 text-sm text-muted hover:text-primary border border-border-subtle rounded-lg hover:bg-fill-subtle transition"
              >
                취소
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-[#FF6F0F] text-white rounded-lg hover:bg-[#FF6F0F]/90 disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 통계 카드 ──────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = 'text-primary' }: {
  icon: React.ReactNode; label: string; value: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border-main rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
