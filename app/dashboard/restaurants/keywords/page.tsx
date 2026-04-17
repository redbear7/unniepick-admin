'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Search, Plus, Play, Loader2, Trash2, Check, X,
  Calendar, MessageSquare, AlertCircle, Clock, Terminal, ChevronDown, ChevronUp,
  ShieldCheck, Sparkles, Square, Store, MapPin, Phone, Star, ExternalLink,
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

// ── 단일 업체 크롤링 결과 타입 ──────────────────────────────
interface SingleResult {
  query: string;
  status: 'success' | 'failed' | 'not_found';
  store?: {
    naver_place_id: string;
    name: string;
    address?: string;
    phone?: string;
    category?: string;
    rating?: number;
    visitor_review_count?: number;
    review_count?: number;
    image_url?: string;
    naver_place_url?: string;
    review_keywords?: Array<{ keyword: string; count: number }>;
    menu_keywords?: Array<{ menu: string; count: number }>;
  } | null;
  error?: string;
  finishedAt: string;
}

export default function CrawlKeywordsPage() {
  const [items, setItems] = useState<CrawlKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    keyword: '',
    description: '',
    is_daily: false,
    analyze_reviews: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── 단일 업체 크롤링 상태 ──
  const [singleQuery, setSingleQuery] = useState('');
  const [singleAnalyze, setSingleAnalyze] = useState(true);
  const [singleRunning, setSingleRunning] = useState(false);
  const [singleLog, setSingleLog] = useState('');
  const [singleLogOpen, setSingleLogOpen] = useState(false);
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);
  const singlePollRef = useRef<NodeJS.Timeout | null>(null);
  const singleLogPreRef = useRef<HTMLPreElement | null>(null);

  // 폐업 검증
  const [verifyRunning, setVerifyRunning] = useState(false);
  const [verifyLog, setVerifyLog] = useState('');
  const [verifyLogOpen, setVerifyLogOpen] = useState(false);
  const verifyPollRef = useRef<NodeJS.Timeout | null>(null);
  const verifyLogPreRef = useRef<HTMLPreElement | null>(null);

  // ── 단일 업체 크롤링 함수들 ──

  async function fetchSingleStatus() {
    const res = await fetch('/api/crawl-restaurants/single');
    const data = await res.json();
    setSingleRunning(!!data.running);
    if (data.log) {
      setSingleLog(data.log);
      setTimeout(() => {
        if (singleLogPreRef.current)
          singleLogPreRef.current.scrollTop = singleLogPreRef.current.scrollHeight;
      }, 50);
    }
    if (data.result && data.result.status) {
      setSingleResult(data.result);
    }
    return !!data.running;
  }

  async function runSingleCrawl() {
    if (!singleQuery.trim()) return;
    setSingleResult(null);
    setSingleLog('');
    setSingleLogOpen(true);

    const res = await fetch('/api/crawl-restaurants/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: singleQuery.trim(), analyze_reviews: singleAnalyze }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? '실행 실패');
      return;
    }
    setSingleRunning(true);
  }

  async function stopSingleCrawl() {
    if (!confirm('크롤링을 중지할까요?')) return;
    await fetch('/api/crawl-restaurants/single', { method: 'DELETE' });
    setSingleRunning(false);
  }

  // 단일 크롤링 중이면 폴링
  useEffect(() => {
    if (singleRunning || singleLogOpen) {
      fetchSingleStatus();
      singlePollRef.current = setInterval(async () => {
        const running = await fetchSingleStatus();
        if (!running && singlePollRef.current) {
          clearInterval(singlePollRef.current);
          singlePollRef.current = null;
        }
      }, 2000);
    }
    return () => {
      if (singlePollRef.current) {
        clearInterval(singlePollRef.current);
        singlePollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleRunning, singleLogOpen]);

  async function checkVerifyStatus() {
    const res = await fetch('/api/crawl-restaurants/verify');
    const data = await res.json();
    setVerifyRunning(!!data.running);
    return !!data.running;
  }

  async function fetchVerifyLog() {
    const res = await fetch('/api/crawl-restaurants/verify/log');
    const data = await res.json();
    setVerifyLog(data.content || '(로그 없음 — 아직 실행하지 않았습니다)');
    setTimeout(() => {
      if (verifyLogPreRef.current) verifyLogPreRef.current.scrollTop = verifyLogPreRef.current.scrollHeight;
    }, 50);
  }

  async function runVerify() {
    if (!confirm('폐업 검증을 실행할까요? (모든 업체 대상, 약 10~15분 소요)')) return;

    const res = await fetch('/api/crawl-restaurants/verify', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? '실행 실패');
      return;
    }
    setVerifyRunning(true);
    setVerifyLogOpen(true);
  }

  // 검증 중이면 로그+상태 폴링
  useEffect(() => {
    checkVerifyStatus();
  }, []);

  useEffect(() => {
    if (verifyLogOpen || verifyRunning) {
      fetchVerifyLog();
      verifyPollRef.current = setInterval(async () => {
        await fetchVerifyLog();
        const running = await checkVerifyStatus();
        if (!running) {
          // 완료되면 맛집 리스트 갱신 (상태 반영)
          load();
        }
      }, 3000);
    }
    return () => {
      if (verifyPollRef.current) { clearInterval(verifyPollRef.current); verifyPollRef.current = null; }
    };
  }, [verifyLogOpen, verifyRunning]);

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
        setForm({ keyword: '', description: '', is_daily: false, analyze_reviews: true });
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

  async function stopManual(id: string) {
    if (!confirm('실행 중인 크롤링을 중지할까요?\n(이미 종료된 상태라면 DB 상태만 idle로 리셋됩니다)')) return;
    const res = await fetch('/api/crawl-restaurants/run', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword_id: id }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? '중지 실패');
    }
    // running 상태 강제 리셋
    await fetch(`/api/crawl-restaurants/keywords/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'idle' }),
    }).catch(() => {});
    load();
  }

  async function stopVerify() {
    if (!confirm('폐업 검증을 중지할까요?')) return;
    const res = await fetch('/api/crawl-restaurants/verify', { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? '중지 실패');
    }
    setVerifyRunning(false);
    fetchVerifyLog();
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Search className="w-6 h-6" />
            크롤링 키워드
          </h1>
          <p className="text-sm text-muted mt-1">
            네이버 플레이스 검색어를 등록하고 수동/자동 크롤링을 관리합니다
          </p>
        </div>

        {/* 폐업 검증 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => setVerifyLogOpen((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 border transition ${
              verifyLogOpen
                ? 'bg-fill-subtle border-border-main text-primary'
                : 'border-border-subtle text-muted hover:text-primary'
            }`}
          >
            <Terminal className="w-4 h-4" />
            검증 로그
          </button>
          {verifyRunning ? (
            <button
              onClick={stopVerify}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-red-500/25 text-red-400 border border-red-500/50 hover:bg-red-500/40"
              title="검증 중지"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <Square className="w-3 h-3 fill-current" />
              검증 중지
            </button>
          ) : (
            <button
              onClick={runVerify}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
            >
              <ShieldCheck className="w-4 h-4" />
              폐업 검증 테스트
            </button>
          )}
        </div>
      </div>

      {/* 검증 로그 뷰어 */}
      {verifyLogOpen && (
        <div className="bg-sidebar border border-border-main rounded-xl overflow-hidden">
          <div className="px-4 py-2 flex items-center justify-between border-b border-border-subtle">
            <span className="text-xs text-muted flex items-center gap-1.5">
              <Terminal className="w-3 h-3" />
              폐업 검증 실시간 로그
              {verifyRunning && <Loader2 className="w-3 h-3 animate-spin text-red-400" />}
            </span>
            <button
              onClick={() => setVerifyLogOpen(false)}
              className="text-xs text-muted hover:text-primary"
            >
              닫기
            </button>
          </div>
          <pre
            ref={verifyLogPreRef}
            className="text-[11px] leading-5 px-4 py-3 overflow-y-auto max-h-[400px] font-mono text-secondary whitespace-pre-wrap break-all"
          >
            {verifyLog || '로딩 중...'}
          </pre>
        </div>
      )}

      {/* ── 단일 업체 크롤링 ── */}
      <div className="bg-card border border-border-main rounded-xl overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-4 h-4 text-[#FF6F0F]" />
            <h2 className="text-sm font-semibold text-primary">단일 업체 크롤링</h2>
            <span className="text-xs text-muted">지역 + 가게이름 형식으로 특정 업체 1개 수집</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder='예: 마산 불낙명가, 창원 돈까스 집'
              value={singleQuery}
              onChange={(e) => setSingleQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !singleRunning && runSingleCrawl()}
              className="flex-1 px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
              disabled={singleRunning}
            />
            {singleRunning ? (
              <button
                onClick={stopSingleCrawl}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <Square className="w-3 h-3 fill-current" />
                중지
              </button>
            ) : (
              <button
                onClick={runSingleCrawl}
                disabled={!singleQuery.trim()}
                className="px-4 py-2 bg-[#FF6F0F] text-white rounded-lg text-sm font-medium hover:bg-[#FF6F0F]/90 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                크롤링
              </button>
            )}
            <button
              onClick={() => setSingleLogOpen((v) => !v)}
              className={`p-2 rounded-lg ${singleLogOpen ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]' : 'text-muted hover:bg-fill-subtle'}`}
              title="로그 보기"
            >
              <Terminal className="w-4 h-4" />
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-secondary">
            <input
              type="checkbox"
              checked={singleAnalyze}
              onChange={(e) => setSingleAnalyze(e.target.checked)}
              className="accent-[#FF6F0F]"
            />
            리뷰 상세 분석 포함 (느림, 약 30초 추가)
          </label>

          {/* 결과 카드 */}
          {singleResult && singleResult.status === 'success' && singleResult.store && (
            <SingleResultCard store={singleResult.store} query={singleResult.query} finishedAt={singleResult.finishedAt} />
          )}
          {singleResult && singleResult.status === 'not_found' && (
            <div className="flex items-center gap-2 text-sm text-muted bg-fill-subtle rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              &quot;{singleResult.query}&quot; 검색 결과가 없습니다. 다른 키워드로 시도해보세요.
            </div>
          )}
          {singleResult && singleResult.status === 'failed' && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />
              에러: {singleResult.error}
            </div>
          )}
        </div>

        {/* 로그 뷰어 */}
        {singleLogOpen && (
          <div className="border-t border-border-subtle bg-sidebar">
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-muted flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                실시간 로그
                {singleRunning && <Loader2 className="w-3 h-3 animate-spin text-[#FF6F0F]" />}
              </span>
              <button onClick={() => setSingleLogOpen(false)} className="text-xs text-muted hover:text-primary">
                닫기
              </button>
            </div>
            <pre
              ref={singleLogPreRef}
              className="text-[11px] leading-5 px-4 pb-4 overflow-y-auto max-h-[280px] font-mono text-secondary whitespace-pre-wrap break-all"
            >
              {singleLog || '(대기 중...)'}
            </pre>
          </div>
        )}
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
              onStop={() => stopManual(k.id)}
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
  k, onRun, onStop, onToggle, onDelete,
}: {
  k: CrawlKeyword;
  onRun: () => void;
  onStop: () => void;
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

        {/* 실행/중지 버튼 */}
        {running ? (
          <button
            onClick={onStop}
            className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
            title="실행 중지"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <Square className="w-3 h-3 fill-current" />
            중지
          </button>
        ) : (
          <button
            onClick={onRun}
            className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-[#FF6F0F] text-white hover:bg-[#FF6F0F]/90"
          >
            <Play className="w-4 h-4" />
            실행
          </button>
        )}

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

// ── 단일 업체 결과 카드 ──────────────────────────────────────
function SingleResultCard({
  store, query, finishedAt,
}: {
  store: NonNullable<SingleResult['store']>;
  query: string;
  finishedAt: string;
}) {
  return (
    <div className="border border-green-500/30 bg-green-500/5 rounded-xl overflow-hidden">
      <div className="flex gap-3 p-4">
        {/* 썸네일 */}
        {store.image_url ? (
          <img
            src={store.image_url}
            alt={store.name}
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0 bg-fill-subtle"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-fill-subtle flex items-center justify-center flex-shrink-0">
            <Store className="w-8 h-8 text-muted" />
          </div>
        )}

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-primary text-base leading-tight">{store.name}</p>
              <p className="text-xs text-muted mt-0.5">{store.category}</p>
            </div>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full border border-green-500/30 flex-shrink-0">
              ✓ 저장됨
            </span>
          </div>

          <div className="mt-2 space-y-1">
            {store.address && (
              <p className="text-xs text-secondary flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-muted flex-shrink-0" />
                {store.address}
              </p>
            )}
            {store.phone && (
              <p className="text-xs text-secondary flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-muted flex-shrink-0" />
                {store.phone}
              </p>
            )}
            <p className="text-xs text-secondary flex items-center gap-1.5">
              <Star className="w-3 h-3 text-muted flex-shrink-0" />
              방문자 리뷰 {(store.visitor_review_count ?? 0).toLocaleString()}건
              {(store.review_count ?? 0) > 0 && ` · 블로그 ${store.review_count!.toLocaleString()}건`}
            </p>
          </div>

          {/* 리뷰 키워드 */}
          {store.review_keywords && store.review_keywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {store.review_keywords.slice(0, 5).map((kw) => (
                <span key={kw.keyword} className="px-2 py-0.5 bg-fill-subtle text-secondary text-[10px] rounded-full">
                  {kw.keyword} {kw.count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 푸터 */}
      <div className="px-4 py-2 border-t border-green-500/20 flex items-center justify-between">
        <p className="text-[10px] text-muted">
          쿼리: &quot;{query}&quot; · {new Date(finishedAt).toLocaleString('ko-KR')}
        </p>
        {store.naver_place_url && (
          <a
            href={store.naver_place_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#FF6F0F] hover:underline flex items-center gap-1"
          >
            네이버 플레이스 <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
