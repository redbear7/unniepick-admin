'use client';

/**
 * /dashboard/review-claims
 *
 * 네이버 리뷰 인증 신청 관리 페이지
 * 스크린샷 미리보기 + 승인/반려 처리
 */

import { useEffect, useState } from 'react';
import { Check, X, ExternalLink, Clock, RefreshCw } from 'lucide-react';
import Image from 'next/image';

// ── Types ──────────────────────────────────────────────────────────
interface Claim {
  id:             string;
  status:         'pending' | 'approved' | 'rejected';
  screenshot_url: string;
  admin_note:     string | null;
  created_at:     string;
  reviewed_at:    string | null;
  stores:         { name: string; category: string } | null;
  profiles:       { nickname: string | null; phone: string | null } | null;
  coupons:        { title: string; discount_type: string; discount_value: number } | null;
}

type Tab = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '심사중', approved: '승인됨', rejected: '반려됨',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── 스크린샷 모달 ──────────────────────────────────────────────────
function ScreenshotModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white transition">
          <X size={24} />
        </button>
        <img src={url} alt="리뷰 스크린샷" className="w-full rounded-2xl shadow-2xl" />
      </div>
    </div>
  );
}

// ── 반려 사유 입력 모달 ────────────────────────────────────────────
function RejectModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (note: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl">
        <h3 className="text-white font-bold mb-3">반려 사유 (선택)</h3>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="예: 스크린샷이 불명확해요"
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF6F0F] resize-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition disabled:opacity-50">취소</button>
          <button onClick={() => onConfirm(note)} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition disabled:opacity-50">
            {loading ? '처리 중...' : '반려'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────
export default function ReviewClaimsPage() {
  const [claims,       setClaims]       = useState<Claim[]>([]);
  const [tab,          setTab]          = useState<Tab>('pending');
  const [loading,      setLoading]      = useState(true);
  const [actionId,     setActionId]     = useState<string | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const fetchClaims = async (t: Tab = tab) => {
    setLoading(true);
    const qs = t === 'all' ? '' : `?status=${t}`;
    const res = await fetch(`/api/review-claims/list${qs}`);
    const data = await res.json();
    setClaims(data.claims ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchClaims(); }, [tab]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    await fetch('/api/review-claims/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setClaims(prev => prev.map(c => c.id === id ? { ...c, status: 'approved', reviewed_at: new Date().toISOString() } : c));
    setActionId(null);
  };

  const handleReject = async (id: string, note: string) => {
    setActionId(id);
    await fetch('/api/review-claims/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, admin_note: note }),
    });
    setClaims(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected', admin_note: note, reviewed_at: new Date().toISOString() } : c));
    setActionId(null);
    setRejectTarget(null);
  };

  const counts = {
    all:      claims.length,
    pending:  claims.filter(c => c.status === 'pending').length,
    approved: claims.filter(c => c.status === 'approved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'pending',  label: `심사중 ${tab === 'pending' ? counts.pending : ''}` },
    { key: 'approved', label: `승인됨 ${tab === 'approved' ? counts.approved : ''}` },
    { key: 'rejected', label: `반려됨 ${tab === 'rejected' ? counts.rejected : ''}` },
    { key: 'all',      label: '전체' },
  ];

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      {previewUrl && <ScreenshotModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
      {rejectTarget && (
        <RejectModal
          onConfirm={(note) => handleReject(rejectTarget, note)}
          onCancel={() => setRejectTarget(null)}
          loading={actionId === rejectTarget}
        />
      )}

      {/* 헤더 */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">네이버 리뷰 인증</h1>
          <p className="text-zinc-400 text-sm mt-1">언니들이 제출한 네이버 영수증 리뷰 인증 스크린샷을 확인하고 쿠폰을 발급하세요.</p>
        </div>
        <button onClick={() => fetchClaims()} className="flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition">
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 카드 그리드 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400">로딩 중...</div>
      ) : claims.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">신청 내역이 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {claims.map(claim => (
            <div key={claim.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              {/* 스크린샷 썸네일 */}
              <button
                onClick={() => setPreviewUrl(claim.screenshot_url)}
                className="relative w-full h-40 bg-zinc-800 block overflow-hidden hover:opacity-90 transition group"
              >
                <img
                  src={claim.screenshot_url}
                  alt="리뷰 스크린샷"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition">
                  <ExternalLink size={24} className="text-white" />
                </div>
              </button>

              {/* 내용 */}
              <div className="p-4 space-y-2.5">
                {/* 가게 + 상태 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold text-sm">{claim.stores?.name ?? '-'}</p>
                    <p className="text-zinc-500 text-xs">{claim.profiles?.nickname ?? '익명'} · {claim.profiles?.phone?.slice(-4) ?? ''}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[claim.status]}`}>
                    {STATUS_LABEL[claim.status]}
                  </span>
                </div>

                {/* 쿠폰 */}
                {claim.coupons && (
                  <div className="bg-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300">
                    🎟 {claim.coupons.title}
                    {claim.coupons.discount_type === 'percent'  && ` · ${claim.coupons.discount_value}% 할인`}
                    {claim.coupons.discount_type === 'amount'   && ` · ${claim.coupons.discount_value.toLocaleString()}원 할인`}
                    {claim.coupons.discount_type === 'naver_review' && ' · 리뷰 인증 쿠폰'}
                  </div>
                )}

                {/* 날짜 */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Clock size={11} />
                  <span>신청 {fmtDate(claim.created_at)}</span>
                  {claim.reviewed_at && <span>· 처리 {fmtDate(claim.reviewed_at)}</span>}
                </div>

                {/* 반려 사유 */}
                {claim.admin_note && (
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{claim.admin_note}</p>
                )}

                {/* 액션 버튼 — pending 만 */}
                {claim.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleApprove(claim.id)}
                      disabled={actionId === claim.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition disabled:opacity-50"
                    >
                      <Check size={14} /> 승인
                    </button>
                    <button
                      onClick={() => setRejectTarget(claim.id)}
                      disabled={actionId === claim.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-semibold transition disabled:opacity-50"
                    >
                      <X size={14} /> 반려
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
