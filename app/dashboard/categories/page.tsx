'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { Layers, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────── */
interface Row {
  kakao_category: string | null;
  category: string | null;
  unniepick_category: string | null;
  source: string | null;
}

interface TreeNode {
  label: string;
  count: number;
  children: Record<string, TreeNode>;
}

/* ── Build kakao tree from "A > B > C" strings ───────────────── */
function buildKakaoTree(rows: Row[]): TreeNode {
  const root: TreeNode = { label: 'root', count: 0, children: {} };
  for (const row of rows) {
    if (!row.kakao_category) continue;
    const parts = row.kakao_category.split('>').map(s => s.trim()).filter(Boolean);
    let node = root;
    root.count++;
    for (const part of parts) {
      if (!node.children[part]) {
        node.children[part] = { label: part, count: 0, children: {} };
      }
      node.children[part].count++;
      node = node.children[part];
    }
  }
  return root;
}

function buildFlatCounts(values: (string | null)[]): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const v of values) {
    const key = v?.trim() || '미분류';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/* ── Kakao Tree Node component ───────────────────────────────── */
function KakaoNode({ node, depth, total }: { node: TreeNode; depth: number; total: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = Object.keys(node.children).length > 0;
  const pct = total > 0 ? ((node.count / total) * 100).toFixed(1) : '0';

  const depthColors = [
    'text-yellow-300 font-bold',
    'text-yellow-200 font-semibold',
    'text-yellow-100/80',
  ];
  const barColors = ['bg-yellow-400/60', 'bg-yellow-400/40', 'bg-yellow-400/20'];

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(o => !o)}
        className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-yellow-500/5 transition group text-left`}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <span className="w-4 shrink-0 text-muted">
          {hasChildren
            ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <span className="w-3" />}
        </span>
        <span className={`flex-1 text-sm truncate ${depthColors[Math.min(depth, 2)]}`}>
          {node.label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-16 h-1.5 bg-fill-subtle rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColors[Math.min(depth, 2)]}`} style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
          </div>
          <span className="text-xs text-muted w-10 text-right">{node.count.toLocaleString()}</span>
          <span className="text-[10px] text-dim w-8 text-right">{pct}%</span>
        </div>
      </button>
      {open && hasChildren && (
        <div>
          {Object.values(node.children)
            .sort((a, b) => b.count - a.count)
            .map(child => (
              <KakaoNode key={child.label} node={child} depth={depth + 1} total={total} />
            ))}
        </div>
      )}
    </div>
  );
}

/* ── Flat list for Naver / Unniepick ─────────────────────────── */
function FlatList({
  items,
  total,
  color,
}: {
  items: { label: string; count: number }[];
  total: number;
  color: 'green' | 'orange';
}) {
  const barColor = color === 'green' ? 'bg-green-400/50' : 'bg-[#FF6F0F]/50';
  const textColor = color === 'green' ? 'text-green-300' : 'text-[#FF6F0F]';

  return (
    <div className="space-y-0.5">
      {items.map(item => {
        const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
        return (
          <div key={item.label} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-fill-subtle transition">
            <span className={`flex-1 text-sm font-medium ${textColor}`}>{item.label}</span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-24 h-1.5 bg-fill-subtle rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
              </div>
              <span className="text-xs text-secondary w-12 text-right font-medium">{item.count.toLocaleString()}</span>
              <span className="text-[10px] text-dim w-9 text-right">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Panel wrapper ───────────────────────────────────────────── */
function Panel({
  title,
  badge,
  total,
  badgeColor,
  children,
}: {
  title: string;
  badge: string;
  total: number;
  badgeColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-sidebar border border-border-main rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border-main">
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${badgeColor}`}>{badge}</span>
        <h2 className="text-sm font-semibold text-primary flex-1">{title}</h2>
        <span className="text-xs text-muted">{total.toLocaleString()}개</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 max-h-[calc(100vh-220px)]">
        {children}
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function CategoriesPage() {
  const sb = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    const PAGE = 1000;
    const all: Row[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from('restaurants')
        .select('kakao_category, category, unniepick_category, source')
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as Row[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setRows(all);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    load();

    const ch = sb.channel('categories-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        load();
      })
      .subscribe();

    return () => { sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* derived data */
  const kakaoRows  = useMemo(() => rows.filter(r => r.kakao_category), [rows]);
  const naverRows  = useMemo(() => rows.filter(r => r.source === 'naver' || (!r.kakao_category && r.category)), [rows]);
  const allRows    = rows;

  const kakaoTree   = useMemo(() => buildKakaoTree(kakaoRows), [kakaoRows]);
  const naverItems  = useMemo(() => buildFlatCounts(naverRows.map(r => r.category)), [naverRows]);
  const unniepickItems = useMemo(() => buildFlatCounts(allRows.map(r => r.unniepick_category)), [allRows]);

  return (
    <div className="p-6 h-full overflow-hidden flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-[#FF6F0F]" />
          <h1 className="text-lg font-bold text-primary">업종 카테고리</h1>
          <span className="px-2 py-0.5 bg-fill-subtle border border-border-subtle text-muted text-xs rounded-full">
            전체 {rows.length.toLocaleString()}개
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-dim">
              {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 업데이트
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fill-subtle hover:bg-card border border-border-subtle text-muted hover:text-primary text-xs transition"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> 로딩 중...
        </div>
      ) : (
        /* 3-column grid */
        <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden min-h-0">
          {/* Kakao */}
          <Panel title="카카오 업종 트리" badge="K" total={kakaoRows.length} badgeColor="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
            {Object.values(kakaoTree.children)
              .sort((a, b) => b.count - a.count)
              .map(node => (
                <KakaoNode key={node.label} node={node} depth={0} total={kakaoRows.length} />
              ))}
          </Panel>

          {/* Naver */}
          <Panel title="네이버 업종" badge="N" total={naverRows.length} badgeColor="bg-green-600/15 text-green-400 border border-green-600/30">
            <FlatList items={naverItems} total={naverRows.length} color="green" />
          </Panel>

          {/* Unniepick */}
          <Panel title="언니픽 정규화 카테고리" badge="U" total={allRows.length} badgeColor="bg-[#FF6F0F]/15 text-[#FF6F0F] border border-[#FF6F0F]/30">
            <FlatList items={unniepickItems} total={allRows.length} color="orange" />
          </Panel>
        </div>
      )}
    </div>
  );
}
