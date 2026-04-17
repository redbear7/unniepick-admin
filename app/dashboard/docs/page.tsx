'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BookOpen, Search, Folder, Tag, Calendar, User,
  FileText, Loader2,
} from 'lucide-react';
import DocViewer from '@/components/DocViewer';

interface DocMeta {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  date: string;
  author: string;
  status: string;
  excerpt: string;
  filePath: string;
}

interface DocsIndex {
  docs: DocMeta[];
  categories: Array<{ name: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
}

interface DocDetail extends DocMeta {
  content: string;
}

export default function DocsPage() {
  const [index, setIndex] = useState<DocsIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  useEffect(() => {
    fetch('/api/docs')
      .then((r) => r.json())
      .then((data) => {
        setIndex(data);
        setLoading(false);
        if (data.docs?.[0]) setSelectedSlug(data.docs[0].slug);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSlug) { setSelectedDoc(null); return; }
    setDocLoading(true);
    fetch(`/api/docs/${selectedSlug}`)
      .then((r) => r.json())
      .then((data) => {
        setSelectedDoc(data);
        setDocLoading(false);
      })
      .catch(() => setDocLoading(false));
  }, [selectedSlug]);

  const filtered = useMemo(() => {
    if (!index) return [];
    return index.docs.filter((d) => {
      if (category && d.category !== category) return false;
      if (tag && !d.tags.includes(tag)) return false;
      if (search) {
        const q = search.toLowerCase();
        return d.title.toLowerCase().includes(q)
          || d.excerpt.toLowerCase().includes(q)
          || d.tags.some((t) => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [index, category, tag, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> 문서 로딩 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <BookOpen className="w-6 h-6" />
          문서 Wiki
        </h1>
        <p className="text-sm text-muted mt-1">
          기획안, PRD, 운영 가이드 · 총 {index?.docs.length ?? 0}개
        </p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* 좌측 사이드바 */}
        <aside className="w-80 shrink-0 bg-card border border-border-main rounded-xl p-4 overflow-y-auto">
          {/* 검색 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="문서 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
            />
          </div>

          {/* 카테고리 */}
          <div className="mb-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <Folder className="w-3 h-3" /> 카테고리
            </p>
            <div className="space-y-1">
              <CategoryBtn
                active={!category}
                onClick={() => setCategory('')}
                label="전체"
                count={index?.docs.length ?? 0}
              />
              {index?.categories.map((c) => (
                <CategoryBtn
                  key={c.name}
                  active={category === c.name}
                  onClick={() => setCategory(category === c.name ? '' : c.name)}
                  label={c.name}
                  count={c.count}
                />
              ))}
            </div>
          </div>

          {/* 태그 */}
          {index && index.tags.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Tag className="w-3 h-3" /> 태그
              </p>
              <div className="flex flex-wrap gap-1.5">
                {index.tags.slice(0, 20).map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setTag(tag === t.name ? '' : t.name)}
                    className={`px-2 py-0.5 text-xs rounded border transition ${
                      tag === t.name
                        ? 'bg-[#FF6F0F] border-[#FF6F0F] text-white'
                        : 'bg-fill-subtle border-border-subtle text-muted hover:text-primary hover:border-[#FF6F0F]/50'
                    }`}
                  >
                    {t.name} {t.count}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 문서 목록 */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" /> 문서 ({filtered.length})
            </p>
            <div className="space-y-1.5">
              {filtered.map((d) => (
                <button
                  key={d.slug}
                  onClick={() => setSelectedSlug(d.slug)}
                  className={`w-full text-left p-2.5 rounded-lg border transition ${
                    selectedSlug === d.slug
                      ? 'bg-[#FF6F0F]/10 border-[#FF6F0F]/50'
                      : 'bg-transparent border-border-subtle hover:bg-fill-subtle hover:border-[#FF6F0F]/30'
                  }`}
                >
                  <p className={`text-sm font-medium truncate ${selectedSlug === d.slug ? 'text-[#FF6F0F]' : 'text-primary'}`}>
                    {d.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted">
                    <span className="flex items-center gap-0.5"><Folder className="w-2.5 h-2.5" />{d.category}</span>
                    {d.date && <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{d.date}</span>}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted text-center py-4">검색 결과 없음</p>
              )}
            </div>
          </div>
        </aside>

        {/* 우측 문서 뷰어 */}
        <main className="flex-1 bg-card border border-border-main rounded-xl p-8 overflow-y-auto">
          {docLoading ? (
            <div className="flex items-center justify-center h-full text-muted">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> 로딩 중...
            </div>
          ) : selectedDoc ? (
            <>
              {/* 메타 정보 */}
              <div className="mb-6 pb-4 border-b border-border-subtle flex flex-wrap gap-3 text-xs text-muted">
                {selectedDoc.category && (
                  <span className="flex items-center gap-1"><Folder className="w-3 h-3" /> {selectedDoc.category}</span>
                )}
                {selectedDoc.date && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedDoc.date}</span>
                )}
                {selectedDoc.author && (
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedDoc.author}</span>
                )}
                {selectedDoc.status && (
                  <span className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded">{selectedDoc.status}</span>
                )}
                {selectedDoc.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 bg-fill-subtle rounded">#{t}</span>
                ))}
              </div>

              <DocViewer content={selectedDoc.content} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted">
              문서를 선택해주세요
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function CategoryBtn({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition ${
        active
          ? 'bg-[#FF6F0F] text-white'
          : 'text-secondary hover:bg-fill-subtle hover:text-primary'
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs ${active ? 'text-white/80' : 'text-muted'}`}>{count}</span>
    </button>
  );
}
