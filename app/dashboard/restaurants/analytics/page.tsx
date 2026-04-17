'use client';

import { useEffect, useRef, useState } from 'react';
import { BarChart3, Loader2, Check, AlertCircle, Play, ExternalLink, Square } from 'lucide-react';

const METABASE_PUBLIC_URL = 'http://localhost:3100/public/dashboard/f5079417-b338-4c42-a3c1-7355b56e5c6e';

interface ServiceStatus {
  state: string;   // absent | created | running | exited
  ready: boolean;  // HTTP 응답 가능 여부
  url: string;
}

interface BigDataStatus {
  metabase: ServiceStatus;
  directus: ServiceStatus;
  allReady: boolean;
}

export default function RestaurantAnalyticsPage() {
  const [status, setStatus] = useState<BigDataStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  async function checkStatus(): Promise<BigDataStatus | null> {
    try {
      const res = await fetch('/api/crawl-restaurants/bigdata/status');
      const data = await res.json();
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }

  async function stopContainers() {
    if (!confirm('Metabase + Directus 컨테이너를 중지할까요?')) return;
    try {
      await fetch('/api/crawl-restaurants/bigdata/stop', { method: 'POST' });
      setStarting(false);
      setTimeout(checkStatus, 3000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function startContainers() {
    setStarting(true);
    setError('');
    try {
      const res = await fetch('/api/crawl-restaurants/bigdata/start', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? '시작 실패');
        setStarting(false);
      }
      // 폴링으로 상태 확인
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  // 페이지 로드 시: 상태 확인 → 중지돼 있으면 자동 시작
  useEffect(() => {
    (async () => {
      const s = await checkStatus();
      if (s && !s.allReady) {
        await startContainers();
      }
    })();
  }, []);

  // 준비될 때까지 5초마다 폴링
  useEffect(() => {
    if (status?.allReady) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setStarting(false);
      return;
    }
    if (!pollRef.current) {
      pollRef.current = setInterval(checkStatus, 5000);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [status?.allReady]);

  // 로딩 / 시작 중 화면
  if (!status || !status.allReady) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            창원 맛집 분석
          </h1>
          <p className="text-sm text-muted mt-1">
            Metabase + Directus 빅데이터 스택을 준비하고 있습니다
          </p>
        </div>

        <div className="bg-card border border-border-main rounded-xl p-8 space-y-6 max-w-2xl">
          <ServiceRow
            name="Metabase"
            description="BI 대시보드 · 차트 · 지도"
            status={status?.metabase}
          />
          <ServiceRow
            name="Directus"
            description="데이터 관리 · API"
            status={status?.directus}
          />

          {!status?.allReady && (
            <div className="pt-2 border-t border-border-subtle">
              {starting || status?.metabase?.state === 'running' ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="w-4 h-4 animate-spin text-[#FF6F0F]" />
                  서비스 시작 중... (최대 1~2분 소요)
                </div>
              ) : (
                <button
                  onClick={startContainers}
                  className="px-4 py-2 bg-[#FF6F0F] text-white rounded-lg text-sm font-medium hover:bg-[#FF6F0F]/90 flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4" />
                  빅데이터 스택 시작
                </button>
              )}
              {error && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 모두 준비 완료 → 대시보드 표시
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            창원 맛집 분석
          </h1>
          <p className="text-sm text-muted mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1 text-green-400">
              <Check className="w-3.5 h-3.5" /> Metabase
            </span>
            <span className="flex items-center gap-1 text-green-400">
              <Check className="w-3.5 h-3.5" /> Directus
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="http://localhost:3100"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-card border border-border-main rounded-lg text-xs text-secondary hover:border-[#FF6F0F]/50 flex items-center gap-1"
          >
            Metabase <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="http://localhost:8055"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-card border border-border-main rounded-lg text-xs text-secondary hover:border-[#FF6F0F]/50 flex items-center gap-1"
          >
            Directus <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={stopContainers}
            className="px-3 py-1.5 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-500/25 flex items-center gap-1"
            title="컨테이너 중지"
          >
            <Square className="w-3 h-3 fill-current" /> 중지
          </button>
        </div>
      </div>

      <div
        className="bg-card border border-border-main rounded-xl overflow-hidden"
        style={{ height: 'calc(100vh - 180px)' }}
      >
        <iframe
          src={`${METABASE_PUBLIC_URL}#bordered=false&titled=false`}
          className="w-full h-full"
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>
    </div>
  );
}

function ServiceRow({
  name, description, status,
}: {
  name: string;
  description: string;
  status: ServiceStatus | undefined;
}) {
  const state = status?.state ?? 'checking';
  const ready = status?.ready ?? false;

  const label =
    state === 'checking' ? '확인 중'
    : state === 'absent' ? '중지됨'
    : state === 'running' && !ready ? '기동 중'
    : state === 'running' && ready ? '정상 동작'
    : state;

  const color =
    ready ? 'text-green-400'
    : state === 'running' ? 'text-amber-400'
    : 'text-muted';

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-primary">{name}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <div className={`flex items-center gap-1.5 text-sm ${color}`}>
        {ready ? <Check className="w-4 h-4" />
          : state === 'running' ? <Loader2 className="w-4 h-4 animate-spin" />
          : <AlertCircle className="w-4 h-4" />}
        {label}
      </div>
    </div>
  );
}
