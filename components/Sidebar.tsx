'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  LayoutDashboard, Store, FileText, Music, Ticket,
  Users, LogOut, ChevronRight, ScrollText, MapPin, PlaySquare, Zap, Map, ListMusic, Tag, Building2, Megaphone, Film, Video, KeyRound, Bell,
  GripVertical, Pencil, Check, X, Settings, ImagePlus, PanelBottom, ClipboardList, UtensilsCrossed, BarChart3, Search, BookOpen, Sparkles, Brain, Gift,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ------------------------------------------------------------------ */
/* Static definitions                                                   */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, Store, FileText, Music, Ticket,
  Users, ScrollText, MapPin, PlaySquare, Zap, Map, ListMusic, Tag, Building2, Megaphone, Film, Video, KeyRound, Bell, ImagePlus, PanelBottom, ClipboardList, UtensilsCrossed, BarChart3, Search, BookOpen, Sparkles, Brain, Gift,
};

interface NavItem {
  id:    string;
  href:  string;
  icon:  string;
  label: string;
}

interface NavGroup {
  id:    string;
  label: string;
  items: NavItem[];
}

const DEFAULT_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: '개요',
    items: [
      { id: 'dashboard', href: '/dashboard',     icon: 'LayoutDashboard', label: '대시보드' },
      { id: 'map',       href: '/dashboard/map', icon: 'Map',             label: '지도' },
    ],
  },
  {
    id: 'store',
    label: '매장 관리',
    items: [
      { id: 'stores',       href: '/dashboard/stores',       icon: 'Store',         label: '가게 관리' },
      { id: 'applications', href: '/dashboard/applications', icon: 'ClipboardList', label: '가게 등록 신청' },
      { id: 'contexts',     href: '/dashboard/contexts',     icon: 'MapPin',        label: '매장 컨텍스트' },
      { id: 'brands',       href: '/dashboard/brands',       icon: 'Building2',         label: '브랜드관' },
      { id: 'restaurants',        href: '/dashboard/restaurants',              icon: 'UtensilsCrossed', label: '창원 맛집' },
      { id: 'restaurant-tags',    href: '/dashboard/restaurants/tags',         icon: 'Tag',             label: '업체 태그 관리' },
      { id: 'ai-chat',            href: '/dashboard/restaurants/ai-chat',      icon: 'Sparkles',        label: 'AI 맛집 추천' },
      { id: 'crawl-keywords',     href: '/dashboard/restaurants/keywords',     icon: 'Search',          label: '크롤링 키워드' },
      { id: 'restaurant-bi',      href: '/dashboard/restaurants/analytics',    icon: 'BarChart3',       label: '맛집 분석' },
    ],
  },
  {
    id: 'music',
    label: '음악 관리',
    items: [
      { id: 'tracks',        href: '/dashboard/tracks',        icon: 'ListMusic',  label: '트랙 관리' },
      { id: 'playlists',     href: '/dashboard/playlists',     icon: 'Music',      label: '플레이리스트' },
      { id: 'references',    href: '/dashboard/references',    icon: 'PlaySquare', label: '레퍼런스 음악' },
      { id: 'announcements', href: '/dashboard/announcements', icon: 'Megaphone',  label: 'AI음성안내' },
      { id: 'cardnews',      href: '/dashboard/cardnews',      icon: 'Video',      label: '카드뉴스' },
      { id: 'shorts',        href: '/dashboard/shorts',        icon: 'Film',       label: '숏폼 생성' },
      { id: 'tags',          href: '/dashboard/tags',          icon: 'Tag',        label: '태그관리' },
    ],
  },
  {
    id: 'customer',
    label: '고객 & 마케팅',
    items: [
      { id: 'users',   href: '/dashboard/users',   icon: 'Users',    label: '회원 관리' },
      { id: 'push',    href: '/dashboard/push',    icon: 'Bell',     label: '푸쉬 알림' },
      { id: 'owners',  href: '/dashboard/owners',  icon: 'KeyRound', label: '사장님 PIN 관리' },
      { id: 'notices', href: '/dashboard/notices', icon: 'ScrollText', label: '공지사항' },
      { id: 'posts',   href: '/dashboard/posts',   icon: 'FileText', label: '게시물 관리' },
      { id: 'coupons',   href: '/dashboard/coupons',   icon: 'Ticket',      label: '쿠폰 관리' },
      { id: 'banners',   href: '/dashboard/banners',   icon: 'PanelBottom', label: '배너 관리' },
      { id: 'ai-images', href: '/dashboard/ai-images', icon: 'ImagePlus',   label: 'AI 이미지 생성' },
      { id: 'points',    href: '/dashboard/points',    icon: 'Gift',        label: '영수증 리뷰' },
    ],
  },
  {
    id: 'system',
    label: '시스템',
    items: [
      { id: 'mindmap',     href: '/dashboard/mindmap',     icon: 'Brain',      label: '마인드맵' },
      { id: 'docs',        href: '/dashboard/docs',        icon: 'BookOpen',   label: '문서 Wiki' },
      { id: 'propagation', href: '/dashboard/propagation', icon: 'Zap',        label: '학습 & 전파' },
      { id: 'opensource',  href: '/dashboard/opensource',  icon: 'ScrollText', label: '오픈소스' },
    ],
  },
];

const STORAGE_KEY = 'unnipick_sidebar_layout';

function loadGroups(): NavGroup[] {
  if (typeof window === 'undefined') return DEFAULT_GROUPS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GROUPS;
    const saved = JSON.parse(raw) as NavGroup[];
    // Merge: keep saved order but ensure all default items exist
    const allDefaultItems = DEFAULT_GROUPS.flatMap(g => g.items);
    const savedItemIds = saved.flatMap(g => g.items.map(i => i.id));
    const missing = allDefaultItems.filter(i => !savedItemIds.includes(i.id));
    if (missing.length > 0) {
      // append missing to their original group
      const result = saved.map(g => {
        const origGroup = DEFAULT_GROUPS.find(dg => dg.id === g.id);
        if (!origGroup) return g;
        const groupMissing = missing.filter(m => origGroup.items.some(oi => oi.id === m.id));
        return { ...g, items: [...g.items, ...groupMissing] };
      });
      return result;
    }
    return saved;
  } catch {
    return DEFAULT_GROUPS;
  }
}

/* ------------------------------------------------------------------ */
/* SortableNavItem                                                      */
/* ------------------------------------------------------------------ */

function SortableNavItem({
  item,
  isActive,
  editMode,
}: {
  item: NavItem;
  isActive: boolean;
  editMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const Icon = ICON_MAP[item.icon];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 transition ${
        isActive
          ? 'bg-[#FF6F0F]/20 border-l-2 border-[#FF6F0F] rounded-r-lg'
          : 'rounded-lg hover:bg-card'
      }`}
    >
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          className="pl-2 py-2.5 text-muted hover:text-primary cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical size={13} />
        </button>
      )}
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 text-sm flex-1 min-w-0 ${
          editMode ? 'pointer-events-none' : ''
        } ${isActive ? 'text-[#FF6F0F] font-semibold' : 'font-medium text-tertiary hover:text-primary'}`}
      >
        {Icon && <Icon size={16} className="shrink-0" />}
        <span className="flex-1 truncate">{item.label}</span>
        {isActive && !editMode && <ChevronRight size={12} />}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Sidebar                                                         */
/* ------------------------------------------------------------------ */

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [groups,       setGroups]       = useState<NavGroup[]>(DEFAULT_GROUPS);
  const [editMode,     setEditMode]     = useState(false);
  const [preEditSnap,  setPreEditSnap]  = useState<NavGroup[] | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingLabel,   setEditingLabel]   = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => { setGroups(loadGroups()); }, []);

  // 현재 로그인 유저 이름 조회
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from('users')
        .select('name')
        .eq('id', data.user.id)
        .maybeSingle();
      if (row?.name) setUserName(row.name);
    });
  }, []);

  const saveGroups = (next: NavGroup[]) => {
    setGroups(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  /* ---- DnD sensors ---- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ---- Find which group contains an itemId ---- */
  const findGroupOf = (itemId: string) =>
    groups.find(g => g.items.some(i => i.id === itemId));

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const srcGroup = findGroupOf(String(active.id));
    const dstGroup = findGroupOf(String(over.id));
    if (!srcGroup || !dstGroup) return;

    const next = groups.map(g => {
      if (g.id === srcGroup.id && g.id === dstGroup.id) {
        // same group — reorder
        const oldIdx = g.items.findIndex(i => i.id === active.id);
        const newIdx = g.items.findIndex(i => i.id === over.id);
        return { ...g, items: arrayMove(g.items, oldIdx, newIdx) };
      }
      if (g.id === srcGroup.id) {
        // remove from source
        return { ...g, items: g.items.filter(i => i.id !== active.id) };
      }
      if (g.id === dstGroup.id) {
        // insert into dest at over's position
        const movedItem = srcGroup.items.find(i => i.id === active.id)!;
        const overIdx   = g.items.findIndex(i => i.id === over.id);
        const newItems  = [...g.items];
        newItems.splice(overIdx, 0, movedItem);
        return { ...g, items: newItems };
      }
      return g;
    });
    saveGroups(next);
  };

  /* ---- Category rename ---- */
  const startRename = (g: NavGroup) => {
    setEditingGroupId(g.id);
    setEditingLabel(g.label);
  };

  const commitRename = () => {
    if (!editingGroupId) return;
    const trimmed = editingLabel.trim();
    if (trimmed) {
      saveGroups(groups.map(g => g.id === editingGroupId ? { ...g, label: trimmed } : g));
    }
    setEditingGroupId(null);
  };

  const resetLayout = () => {
    if (!confirm('사이드바 레이아웃을 기본값으로 초기화할까요?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setGroups(DEFAULT_GROUPS);
  };

  /* ---- Active item id (for overlay) ---- */
  const activeItem = activeId
    ? groups.flatMap(g => g.items).find(i => i.id === activeId)
    : null;

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-border-main flex flex-col h-full overflow-y-auto">
      {/* 로고 */}
      <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5 border-b border-border-main hover:bg-card transition">
        <div className="w-8 h-8 rounded-lg bg-[#FF6F0F] flex items-center justify-center text-base shrink-0">🍖</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted leading-none">언니픽 슈퍼어드민</p>
          <p className="text-sm font-bold text-primary leading-tight mt-0.5 truncate">
            {userName || '로딩 중…'}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-muted">v0.1.1</p>
            <ThemeToggle />
          </div>
        </div>
      </Link>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {groups.map(group => (
            <div key={group.id}>
              {/* Category label */}
              <div className="flex items-center gap-1 px-2 mb-1 h-5">
                {editMode && editingGroupId === group.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      autoFocus
                      value={editingLabel}
                      onChange={e => setEditingLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditingGroupId(null);
                      }}
                      className="flex-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-card border border-[#FF6F0F] rounded outline-none text-primary"
                    />
                    <button onClick={commitRename} className="text-green-500 hover:text-green-400"><Check size={11} /></button>
                    <button onClick={() => setEditingGroupId(null)} className="text-muted hover:text-primary"><X size={11} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-1 group/cat">
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider flex-1">
                      {group.label}
                    </p>
                    {editMode && (
                      <button
                        onClick={() => startRename(group)}
                        className="opacity-0 group-hover/cat:opacity-100 text-muted hover:text-primary transition"
                      >
                        <Pencil size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-0.5">
                <SortableContext
                  items={group.items.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {group.items.map(item => {
                    const isActive = item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href);
                    return (
                      <SortableNavItem
                        key={item.id}
                        item={item}
                        isActive={isActive}
                        editMode={editMode}
                      />
                    );
                  })}
                </SortableContext>
              </div>
            </div>
          ))}

          {/* Drag overlay */}
          <DragOverlay>
            {activeItem ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card border border-[#FF6F0F]/40 shadow-lg text-sm font-medium text-primary opacity-90">
                {ICON_MAP[activeItem.icon] && (() => {
                  const Icon = ICON_MAP[activeItem.icon];
                  return <Icon size={16} className="shrink-0" />;
                })()}
                <span>{activeItem.label}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </nav>

      {/* 하단 */}
      <div className="px-3 py-4 border-t border-border-main space-y-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (editMode) {
                setPreEditSnap(null);
              } else {
                setPreEditSnap(groups.map(g => ({ ...g, items: [...g.items] })));
              }
              setEditMode(e => !e);
              setEditingGroupId(null);
            }}
            className={`flex items-center gap-3 flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              editMode
                ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]'
                : 'text-muted hover:bg-card hover:text-primary'
            }`}
          >
            <Settings size={16} />
            <span>{editMode ? '편집 완료' : '메뉴 편집'}</span>
          </button>
          {editMode && (
            <button
              onClick={() => {
                if (preEditSnap) {
                  setGroups(preEditSnap);
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(preEditSnap));
                }
                setPreEditSnap(null);
                setEditMode(false);
                setEditingGroupId(null);
              }}
              title="편집 취소 (원래 순서로 복원)"
              className="p-2.5 rounded-lg text-muted hover:bg-card hover:text-red-400 transition"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {editMode && (
          <button
            onClick={resetLayout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-xs font-medium text-muted hover:bg-card hover:text-red-400 transition"
          >
            <X size={14} />
            <span>기본값으로 초기화</span>
          </button>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-card hover:text-red-400 transition"
        >
          <LogOut size={16} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
