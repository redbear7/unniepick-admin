'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell, Send, Users, CheckCheck, RefreshCw,
  Smartphone, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── 타입 ────────────────────────────────────────────────────────────────
interface HistoryRow {
  id:         string;
  title:      string;
  body:       string;
  sent_count: number;
  read_count: number;
  created_at: string;
  target?:    'all' | 'optin';
}
interface Stats {
  totalTokens: number;
  optinTokens: number;
  totalSent:   number;
  totalRead:   number;
  history:     HistoryRow[];
}

// ── 날짜 포맷 ───────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  const d   = new Date(iso);
  const ymd = d.toLocaleDateString('ko-KR');
  const hm  = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${ymd} ${hm}`;
}

// ── 읽음율 바 ───────────────────────────────────────────────────────────
function ReadRate({ sent, read }: { sent: number; read: number }) {
  const pct = sent > 0 ? Math.round((read / sent) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF6F0F] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted w-10 text-right">{pct}%</span>
    </div>
  );
}

// ── KPI 카드 ────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, color = 'text-[#FF6F0F]',
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border-main rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-current/10 ${color}`}>
        <Icon size={18} className={color} />
      </div>
      <p className="text-2xl font-extrabold text-primary">{value.toLocaleString()}</p>
      <p className="text-sm font-semibold text-tertiary mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

// ── 미리보기 패널 ────────────────────────────────────────────────────────
function PhonePreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-[#0D0D0D] rounded-3xl p-4 w-64 mx-auto shadow-2xl border border-white/10">
      {/* 상단 시간 */}
      <div className="text-center text-xs text-white/40 mb-4 font-medium">9:41</div>
      {/* 알림 카드 */}
      <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-[#FF6F0F] flex items-center justify-center text-xs">🍖</div>
          <span className="text-xs font-semibold text-white/70">언니픽</span>
          <span className="ml-auto text-[10px] text-white/40">방금</span>
        </div>
        <p className="text-sm font-bold text-white leading-snug mb-1">
          {title || '알림 제목'}
        </p>
        <p className="text-xs text-white/60 leading-relaxed">
          {body || '알림 내용이 여기 표시됩니다.'}
        </p>
      </div>
      {/* 홈 인디케이터 */}
      <div className="mt-4 flex justify-center">
        <div className="w-16 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────
export default function PushPage() {
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [title,     setTitle]     = useState('');
  const [body,      setBody]      = useState('');
  const [target,    setTarget]    = useState<'all' | 'optin'>('optin');
  const [sending,   setSending]   = useState(false);
  const [result,    setResult]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 개발자 테스트 발송
  const [testEmail,   setTestEmail]   = useState('');
  const [testTitle,   setTestTitle]   = useState('🧪 언니픽 테스트 알림');
  const [testBody,    setTestBody]    = useState('푸시 알림이 정상 작동해요! ✅');
  const [testSending, setTestSending] = useState(false);
  const [testResult,  setTestResult]  = useState<{ ok: boolean; msg: string } | null>(null);

  // ── 통계 로드 ───────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/push/stats');
      const json = await res.json();
      setStats(json);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── 발송 ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    if (!confirm(`${target === 'all' ? '전체' : 'opt-in'} 수신자에게 푸쉬 알림을 발송할까요?`)) return;

    setSending(true);
    setResult(null);
    try {
      const res  = await fetch('/api/push/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, body, target }),
      });
      const json = await res.json();

      if (!res.ok) {
        setResult({ ok: false, msg: json.error ?? '발송 실패' });
      } else {
        setResult({ ok: true, msg: json.summary });
        setTitle('');
        setBody('');
        loadStats(); // 히스토리 갱신
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setSending(false);
      if (resultTimer.current) clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => setResult(null), 6000);
    }
  };

  const targetCount = target === 'all'
    ? (stats?.totalTokens ?? 0)
    : (stats?.optinTokens ?? 0);

  const handleTestSend = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res  = await fetch('/api/push/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: testEmail, title: testTitle, body: testBody }),
      });
      const json = await res.json();
      setTestResult({ ok: json.ok, msg: json.summary ?? json.error ?? '오류' });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">푸쉬 알림 관리</h1>
          <p className="text-sm text-muted mt-1">Expo Push로 전체·opt-in 수신자에게 알림 발송</p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border-subtle text-sm text-tertiary hover:text-primary transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={Smartphone}
          label="전체 기기"
          value={stats?.totalTokens ?? '-'}
          sub="push_tokens 등록"
          color="text-blue-400"
        />
        <KpiCard
          icon={ToggleRight}
          label="opt-in 수신자"
          value={stats?.optinTokens ?? '-'}
          sub="알림 허용 유저"
          color="text-green-400"
        />
        <KpiCard
          icon={Send}
          label="누적 발송"
          value={stats?.totalSent ?? '-'}
          sub="전체 히스토리 합산"
        />
        <KpiCard
          icon={CheckCheck}
          label="누적 읽음"
          value={stats?.totalRead ?? '-'}
          sub={stats && stats.totalSent > 0
            ? `읽음율 ${Math.round((stats.totalRead / stats.totalSent) * 100)}%`
            : ''}
          color="text-purple-400"
        />
      </div>

      {/* ── 개발자 테스트 발송 ── */}
      <div className="bg-card border border-orange-500/30 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-bold text-primary mb-1 flex items-center gap-2">
          <span className="text-lg">🧪</span>
          개발자 테스트 발송
        </h2>
        <p className="text-xs text-muted mb-5">특정 이메일 계정으로 테스트 푸시를 발송해요</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 이메일 */}
          <div className="lg:col-span-3">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">
              대상 이메일 <span className="text-red-400">*</span>
            </label>
            <input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="테스트할 개발자 이메일 입력"
              className="w-full bg-fill-subtle border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
            />
          </div>
          {/* 제목 */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">제목</label>
            <input
              value={testTitle}
              onChange={e => setTestTitle(e.target.value)}
              className="w-full bg-fill-subtle border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:border-[#FF6F0F] transition"
            />
          </div>
          {/* 내용 */}
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">내용</label>
            <input
              value={testBody}
              onChange={e => setTestBody(e.target.value)}
              className="w-full bg-fill-subtle border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:border-[#FF6F0F] transition"
            />
          </div>
        </div>

        {testResult && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium ${
            testResult.ok
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {testResult.msg}
          </div>
        )}

        <button
          onClick={handleTestSend}
          disabled={testSending || !testEmail.trim()}
          className="mt-4 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 text-sm font-bold hover:bg-orange-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testSending
            ? <span className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            : <Send size={14} />}
          {testSending ? '발송 중…' : '테스트 발송'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ── 발송 폼 ── */}
        <div className="bg-card border border-border-main rounded-2xl p-6">
          <h2 className="text-base font-bold text-primary mb-5 flex items-center gap-2">
            <Bell size={16} className="text-[#FF6F0F]" />
            알림 작성
          </h2>

          {/* 대상 선택 */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">
              발송 대상
            </label>
            <div className="flex gap-2">
              {([
                { key: 'optin', label: 'opt-in만', sub: `${stats?.optinTokens ?? 0}명`, icon: ToggleRight },
                { key: 'all',   label: '전체',      sub: `${stats?.totalTokens ?? 0}명`, icon: Users },
              ] as const).map(({ key, label, sub, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTarget(key)}
                  className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                    target === key
                      ? 'border-[#FF6F0F] bg-[#FF6F0F]/10 text-[#FF6F0F]'
                      : 'border-border-subtle bg-fill-subtle text-tertiary hover:text-primary'
                  }`}
                >
                  <Icon size={15} />
                  <div className="text-left">
                    <p className="leading-none">{label}</p>
                    <p className="text-[10px] opacity-60 mt-0.5 font-normal">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={60}
              placeholder="예: 🎟 새 쿠폰이 도착했어요!"
              className="w-full bg-fill-subtle border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
            />
            <p className="text-[10px] text-muted mt-1 text-right">{title.length}/60</p>
          </div>

          {/* 본문 */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">
              내용 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="예: 오월의커피 아메리카노 1+1 쿠폰을 지금 확인해보세요."
              className="w-full bg-fill-subtle border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition resize-none"
            />
            <p className="text-[10px] text-muted mt-1 text-right">{body.length}/200</p>
          </div>

          {/* 결과 메시지 */}
          {result && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
              result.ok
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {result.ok ? '✓ ' : '✕ '}{result.msg}
            </div>
          )}

          {/* 발송 버튼 */}
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF6F0F] text-white text-sm font-bold hover:bg-[#e55e00] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={15} />
            )}
            {sending
              ? '발송 중…'
              : `${targetCount.toLocaleString()}명에게 발송`}
          </button>
        </div>

        {/* ── 미리보기 ── */}
        <div className="bg-card border border-border-main rounded-2xl p-6">
          <h2 className="text-base font-bold text-primary mb-5 flex items-center gap-2">
            <Smartphone size={16} className="text-blue-400" />
            알림 미리보기
          </h2>
          <PhonePreview title={title} body={body} />
        </div>
      </div>

      {/* ── 발송 이력 ── */}
      <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border-main flex items-center justify-between">
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            <CheckCheck size={16} className="text-purple-400" />
            발송 이력
          </h2>
          <span className="text-xs text-muted">{stats?.history.length ?? 0}건 (최근 50건)</span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-white/20 border-t-[#FF6F0F] rounded-full animate-spin" />
          </div>
        ) : !stats?.history.length ? (
          <div className="py-12 text-center text-dim text-sm">발송 이력이 없어요</div>
        ) : (
          <div>
            {stats.history.map((row, idx) => {
              const isExp = expanded === row.id;
              return (
                <div
                  key={row.id}
                  className={`border-b border-border-main last:border-0 ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                >
                  <button
                    onClick={() => setExpanded(isExp ? null : row.id)}
                    className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-white/[0.02] transition"
                  >
                    {/* 발송 대상 뱃지 */}
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      row.target === 'all'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-green-500/15 text-green-400'
                    }`}>
                      {row.target === 'all' ? '전체' : 'opt-in'}
                    </span>

                    {/* 제목 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{row.title}</p>
                      {!isExp && (
                        <p className="text-xs text-muted truncate mt-0.5">{row.body}</p>
                      )}
                    </div>

                    {/* 통계 */}
                    <div className="shrink-0 text-right mr-2">
                      <p className="text-xs font-semibold text-primary">
                        {row.sent_count.toLocaleString()}건 발송
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">
                        읽음 {row.read_count.toLocaleString()}건
                      </p>
                    </div>

                    {/* 읽음율 바 (중간) */}
                    <div className="w-24 shrink-0">
                      <ReadRate sent={row.sent_count} read={row.read_count} />
                    </div>

                    {/* 날짜 */}
                    <p className="text-xs text-muted whitespace-nowrap shrink-0 w-32 text-right">
                      {fmtDate(row.created_at)}
                    </p>

                    {/* 토글 */}
                    <div className="text-muted shrink-0">
                      {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>

                  {/* 펼쳐진 본문 */}
                  {isExp && (
                    <div className="px-6 pb-4">
                      <div className="bg-fill-subtle rounded-xl px-4 py-3 text-sm text-tertiary leading-relaxed">
                        {row.body}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
