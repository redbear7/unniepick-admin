'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Search, Plus, Play, Loader2, Trash2, Check, X,
  Calendar, MessageSquare, AlertCircle, Clock, Terminal, ChevronDown, ChevronUp,
} from 'lucide-react';

interface CrawlKeyword {
  id: string;
  keyword: string;
  description: string | null;
  enabled: boolean;
  is_daily: boolean;
  analyze_reviews: boolean;
  status: 'idle' | 'running' | 'success' | 'failed';
  last_error: string | null;
  last_result_count: number | null;
  last_new_count: number | null;
  last_crawled_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function CrawlKeywordsPage() {
  const [items, setItems] = useState<CrawlKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    keyword: '',
    description: '',
    is_daily: false,
    analyze_reviews: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  async function load() {
    const res = await fetch('/api/crawl-restaurants/keywords');
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // running 상태가 있으면 5초마다 폴링
  useEffect(() => {
    const hasRunning = items.some((k) => k.status === 'running');

    if (hasRunning) {
      if (!pollRef.current) {
        pollRef.current = setInterval(load, 5000);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [items]);

  async function addKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!form.keyword.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/crawl-restaurants/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? '추가 실패');
      } else {
        setForm({ keyword: '', description: '', is_daily: false, analyze_reviews: false });
        load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePatch(id: string, patch: Partial<CrawlKeyword>) {
    await fetch(`/api/crawl-restaurants/keywords/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function removeKeyword(id: string, keyword: string) {
    if (!confirm(`"${keyword}" 키워드를 삭제할까요?`)) return;
    await fetch(`/api/crawl-restaurants/keywords/${id}`, { method: 'DELETE' });
    load();
  }

  async function runManual(id: string) {
    const res = await fetch('/api/crawl-restaurants/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword_id: id }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? '실행 실패');
    }
    load();
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Search className="w-6 h-6" />
          크롤링 키워드
        </h1>
        <p className="text-sm text-muted mt-1">
          네이버 플레이스 검색어를 등록하고 수동/자동 크롤링을 관리합니다
        </p>
      </div>

      {/* 추가 폼 */}
      <form
        onSubmit={addKeyword}
        className="bg-card border border-border-main rounded-xl p-4 space-y-3"
      >
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="검색어 (예: 창원시 한식 맛집)"
            value={form.keyword}
            onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            className="flex-1 px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
          />
          <button
            type="submit"
            disabled={submitting || !form.keyword.trim()}
            className="px-4 py-2 bg-[#FF6F0F] text-white rounded-lg text-sm font-medium hover:bg-[#FF6F0F]/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </div>
        <input
          type="text"
          placeholder="설명 (선택)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
        />
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer text-secondary">
            <input
              type="checkbox"
              checked={form.is_daily}
              onChange={(e) => setForm({ ...form, is_daily: e.target.checked })}
              className="accent-[#FF6F0F]"
            />
            매일 자동 크롤링
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-secondary">
            <input
              type="checkbox"
              checked={form.analyze_reviews}
              onChange={(e) => setForm({ ...form, analyze_reviews: e.target.checked })}
              className="accent-[#FF6F0F]"
            />
            리뷰 상세 분석 (느림)
          </label>
        </div>
      </form>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-20 text-muted">로딩 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-muted">등록된 키워드가 없습니다</div>
      ) : (
        <div className="space-y-2">
          {items.map((k) => (
            <KeywordRow
              key={k.id}
              k={k}
              onRun={() => runManual(k.id)}
              onToggle={(patch) => togglePatch(k.id, patch)}
              onDelete={() => removeKeyword(k.id, k.keyword)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KeywordRow({
  k, onRun, onToggle, onDelete,
}: {
  k: CrawlKeyword;
  onRun: () => void;
  onToggle: (patch: Partial<CrawlKeyword>) => void;
  onDelete: () => void;
}) {
  const running = k.status === 'running';
  const failed = k.status === 'failed';
  const [logOpen, setLogOpen] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const logPollRef = useRef<NodeJS.Timeout | null>(null);
  const logPreRef = useRef<HTMLPreElement | null>(null);

  // 로그 fetch
  const fetchLog = async () => {
    setLogLoading(true);
    try {
      const res = await fetch(`/api/crawl-restaurants/logs/${k.id}`);
      const data = await res.json();
      setLogContent(data.content || '(로그 없음 — 아직 실행하지 않았거나 로그 파일이 생성되지 않았습니다)');
      // 자동 스크롤 to bottom
      setTimeout(() => {
        if (logPreRef.current) logPreRef.current.scrollTop = logPreRef.current.scrollHeight;
      }, 50);
    } finally {
      setLogLoading(false);
    }
  };

  // 로그 창이 열려있고 실행 중이면 2초마다 폴링
  useEffect(() => {
    if (logOpen) {
      fetchLog();
      if (running) {
        logPollRef.current = setInterval(fetchLog, 2000);
      }
    }
    return () => {
      if (logPollRef.current) { clearInterval(logPollRef.current); logPollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logOpen, running, k.id]);

  return (
    <div className={`bg-card border rounded-xl transition ${failed ? 'border-red-500/30' : 'border-border-main'}`}>
      <div className="p-4 flex items-center gap-3">
        {/* 활성화 토글 */}
        <button
          onClick={() => onToggle({ enabled: !k.enabled })}
          className={`w-10 h-6 rounded-full flex items-center ${k.enabled ? 'bg-[#FF6F0F] justify-end' : 'bg-fill-subtle justify-start'}`}
          title={k.enabled ? '활성' : '비활성'}
        >
          <span className="w-5 h-5 bg-white rounded-full mx-0.5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${k.enabled ? 'text-primary' : 'text-muted line-through'}`}>
              {k.keyword}
            </span>
            {k.is_daily && (
              <span className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 text-[10px] rounded border border-blue-500/25 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                매일
              </span>
            )}
            {k.analyze_reviews && (
              <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-400 text-[10px] rounded border border-purple-500/25 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                리뷰분석
              </span>
            )}
          </div>
          {k.description && (
            <p className="text-xs text-muted mt-0.5">{k.description}</p>
          )}
          <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {k.last_crawled_at ? (
              <>
                {new Date(k.last_crawled_at).toLocaleString('ko-KR')}
                {' • '}
                {k.last_result_count ?? 0}개
                {(k.last_new_count ?? 0) > 0 && <span className="text-green-400"> (신규 {k.last_new_count}개)</span>}
              </>
            ) : '아직 실행 안함'}
          </p>
          {failed && k.last_error && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {k.last_error}
            </p>
          )}
        </div>

        {/* 옵션 토글 */}
        <div className="flex gap-1">
          <IconToggle
            active={k.is_daily}
            onClick={() => onToggle({ is_daily: !k.is_daily })}
            icon={<Calendar className="w-3.5 h-3.5" />}
            title="매일 자동"
          />
          <IconToggle
            active={k.analyze_reviews}
            onClick={() => onToggle({ analyze_reviews: !k.analyze_reviews })}
            icon={<MessageSquare className="w-3.5 h-3.5" />}
            title="리뷰 분석"
          />
        </div>

        {/* 실행 버튼 */}
        <button
          onClick={onRun}
          disabled={running}
          className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
            running
              ? 'bg-fill-subtle text-muted cursor-not-allowed'
              : 'bg-[#FF6F0F] text-white hover:bg-[#FF6F0F]/90'
          }`}
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              실행 중
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              실행
            </>
          )}
        </button>

        <button
          onClick={() => setLogOpen((v) => !v)}
          className={`p-2 rounded-lg ${logOpen ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]' : 'text-muted hover:bg-fill-subtle'}`}
          title="로그 보기"
        >
          <Terminal className="w-4 h-4" />
        </button>

        <button
          onClick={onDelete}
          className="p-2 text-muted hover:text-red-400 hover:bg-fill-subtle rounded-lg"
          title="삭제"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 실시간 로그 뷰어 */}
      {logOpen && (
        <div className="border-t border-border-subtle bg-sidebar">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted flex items-center gap-1.5">
              <Terminal className="w-3 h-3" />
              실시간 로그 {running && <Loader2 className="w-3 h-3 animate-spin text-[#FF6F0F]" />}
            </span>
            <div className="flex gap-2 text-xs">
              <button
                onClick={fetchLog}
                disabled={logLoading}
                className="text-muted hover:text-primary"
              >
                새로고침
              </button>
              <button
                onClick={() => setLogOpen(false)}
                className="text-muted hover:text-primary"
              >
                닫기
              </button>
            </div>
          </div>
          <pre
            ref={logPreRef}
            className="text-[11px] leading-5 px-4 pb-4 overflow-y-auto max-h-[320px] font-mono text-secondary whitespace-pre-wrap break-all"
          >
            {logContent || '로딩 중...'}
          </pre>
        </div>
      )}
    </div>
  );
}

function IconToggle({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg ${active ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]' : 'text-muted hover:bg-fill-subtle'}`}
    >
      {icon}
    </button>
  );
}
