'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
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

// ── 단일 크롤링 히스토리 아이템 ──────────────────────────────
interface SingleHistoryItem {
  id: string;
  query: string;
  status: 'success' | 'failed' | 'not_found';
  storeName?: string;
  storeCategory?: string;
  naver_place_id?: string;
  finishedAt: string;
}

const SINGLE_HISTORY_KEY = 'unniepick_single_crawl_history';
const SINGLE_HISTORY_MAX = 50;

function loadSingleHistory(): SingleHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(SINGLE_HISTORY_KEY) ?? '[]');
  } catch { return []; }
}

function saveSingleHistory(items: SingleHistoryItem[]) {
  localStorage.setItem(SINGLE_HISTORY_KEY, JSON.stringify(items.slice(0, SINGLE_HISTORY_MAX)));
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
  const [singleHistory, setSingleHistory] = useState<SingleHistoryItem[]>([]);
  const singlePollRef = useRef<NodeJS.Timeout | null>(null);
  const singleLogPreRef = useRef<HTMLPreElement | null>(null);

  // 폐업 검증
  const [verifyRunning, setVerifyRunning] = useState(false);
  const [verifyLog, setVerifyLog] = useState('');
  const [verifyLogOpen, setVerifyLogOpen] = useState(false);
  const verifyPollRef = useRef<NodeJS.Timeout | null>(null);
  const verifyLogPreRef = useRef<HTMLPreElement | null>(null);

  // 네이버 폴더 가져오기
  const [folderUrl, setFolderUrl] = useState('');
  const [folderRunning, setFolderRunning] = useState(false);
  const [folderLog, setFolderLog] = useState('');
  const [folderLogOpen, setFolderLogOpen] = useState(false);
  const [folderResult, setFolderResult] = useState<{
    status: string; total: number; alreadyCount: number;
    newCount: number; savedCount?: number; failedCount?: number;
    saved?: Array<{ placeId: string; name: string }>;
    failed?: Array<{ placeId: string; name: string; error: string }>;
    error?: string;
  } | null>(null);
  const folderPollRef = useRef<NodeJS.Timeout | null>(null);
  const folderLogPreRef = useRef<HTMLPreElement | null>(null);

  // 히스토리 초기 로드
  useEffect(() => {
    setSingleHistory(loadSingleHistory());
  }, []);

  function addToHistory(result: SingleResult) {
    const item: SingleHistoryItem = {
      id: Date.now().toString(),
      query: result.query,
      status: result.status,
      storeName: result.store?.name,
      storeCategory: result.store?.category,
      naver_place_id: result.store?.naver_place_id,
      finishedAt: result.finishedAt,
    };
    setSingleHistory(prev => {
      const next = [item, ...prev].slice(0, SINGLE_HISTORY_MAX);
      saveSingleHistory(next);
      return next;
    });
  }

  function deleteHistoryItem(id: string) {
    setSingleHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      saveSingleHistory(next);
      return next;
    });
  }

  function clearHistory() {
    if (!confirm('단일 크롤링 히스토리를 모두 삭제할까요?')) return;
    setSingleHistory([]);
    saveSingleHistory([]);
  }

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
      // 완료 시 히스토리에 추가 (running → done 전환 시점)
      if (!data.running && data.result.finishedAt) {
        addToHistory(data.result);
      }
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

  // ── 네이버 폴더 가져오기 함수들 ──────────────────────────────

  async function fetchFolderStatus() {
    const res = await fetch('/api/crawl-restaurants/naver-folder');
    const data = await res.json();
    setFolderRunning(!!data.running);
    if (data.log) {
      setFolderLog(data.log);
      setTimeout(() => {
        if (folderLogPreRef.current)
          folderLogPreRef.current.scrollTop = folderLogPreRef.current.scrollHeight;
      }, 50);
    }
    if (data.result?.status) setFolderResult(data.result);
    return !!data.running;
  }

  async function runFolderCrawl() {
    if (!folderUrl.trim()) return;
    setFolderResult(null);
    setFolderLog('');
    setFolderLogOpen(true);

    const res = await fetch('/api/crawl-restaurants/naver-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_url: folderUrl.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? '실행 실패'); return; }
    setFolderRunning(true);
  }

  async function stopFolderCrawl() {
    if (!confirm('폴더 가져오기를 중지할까요?')) return;
    await fetch('/api/crawl-restaurants/naver-folder', { method: 'DELETE' });
    setFolderRunning(false);
  }

  // 폴더 크롤링 폴링
  useEffect(() => {
    if (folderRunning || folderLogOpen) {
      fetchFolderStatus();
      folderPollRef.current = setInterval(async () => {
        const running = await fetchFolderStatus();
        if (!running && folderPollRef.current) {
          clearInterval(folderPollRef.current);
          folderPollRef.current = null;
        }
      }, 2000);
    }
    return () => {
      if (folderPollRef.current) { clearInterval(folderPollRef.current); folderPollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderRunning, folderLogOpen]);

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

      {/* ── 네이버 폴더 가져오기 ── */}
      <div className="bg-card border border-border-main rounded-xl overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-[#03C75A]" />
            <h2 className="text-sm font-semibold text-primary">네이버 내 장소 폴더 가져오기</h2>
            <span className="text-xs text-muted">공유된 폴더 URL의 업체를 일괄 수집 (신규만)</span>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={folderUrl}
              onChange={(e) => setFolderUrl(e.target.value)}
              placeholder="https://map.naver.com/p/favorite/myPlace/folder/..."
              className="flex-1 px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#03C75A]"
              disabled={folderRunning}
            />
            {folderRunning ? (
              <button
                onClick={stopFolderCrawl}
                className="px-3 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm font-semibold rounded-lg border border-red-500/30 transition flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> 중지
              </button>
            ) : (
              <button
                onClick={runFolderCrawl}
                disabled={!folderUrl.trim()}
                className="px-4 py-2 bg-[#03C75A] hover:bg-[#02a84a] disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" /> 가져오기
              </button>
            )}
            <button
              onClick={() => { setFolderLogOpen(v => !v); if (!folderLogOpen) fetchFolderStatus(); }}
              className="px-3 py-2 bg-fill-subtle hover:bg-fill-medium border border-border-subtle rounded-lg text-xs text-muted hover:text-primary transition flex items-center gap-1"
            >
              <Terminal className="w-3.5 h-3.5" />
              {folderLogOpen ? '로그 닫기' : '로그'}
            </button>
          </div>

          {/* 결과 요약 */}
          {folderResult && !folderRunning && (
            <div className={`rounded-lg px-4 py-3 text-sm border ${
              folderResult.status === 'failed'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-green-500/10 border-green-500/20'
            }`}>
              {folderResult.status === 'failed' ? (
                <p className="font-semibold">❌ {folderResult.error}</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-4 text-xs">
                    <span className="text-muted">폴더 내 업체 <strong className="text-primary">{folderResult.total}개</strong></span>
                    <span className="text-muted">이미 등록 <strong className="text-primary">{folderResult.alreadyCount}개</strong></span>
                    <span className="text-muted">신규 <strong className="text-[#03C75A]">{folderResult.newCount}개</strong></span>
                    {folderResult.savedCount !== undefined && (
                      <span className="text-muted">저장 완료 <strong className="text-[#FF6F0F]">{folderResult.savedCount}개</strong></span>
                    )}
                  </div>
                  {(folderResult.saved?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {folderResult.saved!.map(s => (
                        <span key={s.placeId} className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {(folderResult.failed?.length ?? 0) > 0 && (
                    <p className="text-xs text-red-400">실패: {folderResult.failed!.map(f => f.name).join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 로그 */}
        {folderLogOpen && (
          <div className="border-t border-border-main bg-[#0D0D0D]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
              <span className="text-xs text-muted flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                폴더 가져오기 실시간 로그
                {folderRunning && <Loader2 className="w-3 h-3 animate-spin text-[#03C75A]" />}
              </span>
              <button onClick={() => setFolderLogOpen(false)} className="text-xs text-muted hover:text-primary">닫기</button>
            </div>
            <pre
              ref={folderLogPreRef}
              className="text-[11px] leading-5 px-4 py-3 overflow-y-auto max-h-[300px] font-mono text-secondary whitespace-pre-wrap break-all"
            >
              {folderLog || '로딩 중...'}
            </pre>
          </div>
        )}
      </div>

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

          <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded px-2.5 py-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            리뷰 상세 분석 항상 포함
          </div>

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

      {/* ── 단일 크롤링 히스토리 ── */}
      {singleHistory.length > 0 && (
        <div className="bg-card border border-border-main rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted" />
              <span className="text-sm font-semibold text-primary">단일 크롤링 히스토리</span>
              <span className="text-xs text-muted">{singleHistory.length}건</span>
            </div>
            <button
              onClick={clearHistory}
              className="text-xs text-muted hover:text-red-400 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              전체 삭제
            </button>
          </div>
          <div className="divide-y divide-border-subtle">
            {singleHistory.map(h => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3 hover:bg-fill-subtle/50 transition group">
                {/* 상태 아이콘 */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  h.status === 'success'   ? 'bg-green-500/20' :
                  h.status === 'not_found' ? 'bg-yellow-500/20' :
                  'bg-red-500/20'
                }`}>
                  {h.status === 'success'   ? <Check className="w-3 h-3 text-green-400" /> :
                   h.status === 'not_found' ? <AlertCircle className="w-3 h-3 text-yellow-400" /> :
                   <X className="w-3 h-3 text-red-400" />}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-primary truncate">
                      {h.storeName ?? h.query}
                    </span>
                    {h.storeCategory && (
                      <span className="text-[10px] text-muted bg-fill-subtle px-1.5 py-0.5 rounded">
                        {h.storeCategory}
                      </span>
                    )}
                    {h.status === 'not_found' && (
                      <span className="text-[10px] text-yellow-400">검색결과 없음</span>
                    )}
                    {h.status === 'failed' && (
                      <span className="text-[10px] text-red-400">실패</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(h.finishedAt).toLocaleString('ko-KR')}
                    <span className="text-muted/50">·</span>
                    <span className="text-muted/70">&quot;{h.query}&quot;</span>
                  </p>
                </div>

                {/* 액션 */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  {/* 재실행 */}
                  <button
                    onClick={() => { setSingleQuery(h.query); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="p-1.5 rounded text-muted hover:text-[#FF6F0F] hover:bg-[#FF6F0F]/10 transition"
                    title="쿼리 다시 사용"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  {/* 가게 추가 링크 (성공 시) */}
                  {h.status === 'success' && h.naver_place_id && (
                    <Link
                      href={`/dashboard/restaurants/register?naver_place_id=${encodeURIComponent(h.naver_place_id)}`}
                      className="p-1.5 rounded text-muted hover:text-[#FF6F0F] hover:bg-[#FF6F0F]/10 transition"
                      title="가게 추가"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {/* 삭제 */}
                  <button
                    onClick={() => deleteHistoryItem(h.id)}
                    className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                    title="히스토리 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-2 text-sm text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded px-3 py-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            리뷰 상세 분석 항상 포함
          </div>
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
            <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-400 text-[10px] rounded border border-purple-500/25 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              리뷰 상세 분석
            </span>
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
          {/* 리뷰 분석은 항상 활성 — 토글 제거 */}
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
              ✓ 크롤됨
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

          {/* 가게 추가 링크 */}
          <div className="mt-3">
            <Link
              href={`/dashboard/restaurants/register?naver_place_id=${encodeURIComponent(store.naver_place_id)}`}
              className="text-xs text-[#FF6F0F] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              가게 추가
            </Link>
          </div>
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
