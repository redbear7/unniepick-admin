'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, FileText, MapPin, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase';

type CouponDraft = {
  discount_type:  'free_item' | 'percent' | 'amount';
  title:          string;
  discount_value: number;
  free_item_name: string | null;
  expires_at:     string | null;
  total_quantity: number;
};

type Application = {
  id: string;
  store_name: string;
  category: string;
  address: string;
  phone: string;
  owner_name: string;
  owner_phone: string;
  has_agency?: boolean | null;
  agency_name?: string | null;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  admin_note?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  business_license_path?: string | null;
  business_license_file_name?: string | null;
  business_registration_number?: string | null;
  gps_verified_at?: string | null;
  gps_latitude?: number | string | null;
  gps_longitude?: number | string | null;
  gps_accuracy_m?: number | string | null;
  verification_status?: 'pending' | 'auto_checked' | 'approved' | 'rejected';
  coupon_draft?: CouponDraft | null;
};

type StoreSummary = {
  id: string;
  name: string | null;
  address: string | null;
};

type TabFilter = 'all' | 'pending' | 'approved' | 'rejected';
type SignalFilter = 'all' | 'agency' | 'ai' | 'gps' | 'duplicate';

const STATUS_LABEL: Record<string, string> = {
  pending: '대기중',
  approved: '승인됨',
  rejected: '반려됨',
};

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const VERIFICATION_LABEL: Record<string, string> = {
  pending: '검수대기',
  auto_checked: '자동확인',
  approved: '검증승인',
  rejected: '검증반려',
};

const VERIFICATION_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300',
  auto_checked: 'bg-cyan-500/15 text-cyan-300',
  approved: 'bg-green-500/15 text-green-300',
  rejected: 'bg-red-500/15 text-red-300',
};

const CATEGORY_LABEL: Record<string, string> = {
  cafe:   '☕ 카페',
  food:   '🍽 음식',
  beauty: '✂️ 미용',
  nail:   '💅 네일',
  etc:    '기타',
};

function numericValue(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function gpsInfo(app: Application) {
  const lat = numericValue(app.gps_latitude);
  const lng = numericValue(app.gps_longitude);
  const accuracy = numericValue(app.gps_accuracy_m);
  if (lat === null || lng === null) return null;

  return {
    lat,
    lng,
    accuracy,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  };
}

function licenseFileUrl(path: string) {
  return `/api/admin/owner-verification-file?path=${encodeURIComponent(path)}`;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, '').toLowerCase();
}

function duplicateStore(app: Application, stores: StoreSummary[]) {
  const appName = normalizeText(app.store_name);
  const appAddress = normalizeText(app.address);
  if (!appName) return null;

  return stores.find(store => {
    const storeName = normalizeText(store.name);
    const storeAddress = normalizeText(store.address);
    if (!storeName) return false;
    const sameName = storeName === appName;
    const similarName = appName.length >= 3 && (storeName.includes(appName) || appName.includes(storeName));
    const sameAddress = Boolean(appAddress && storeAddress && (storeAddress.includes(appAddress) || appAddress.includes(storeAddress)));
    return sameName || (similarName && sameAddress);
  }) ?? null;
}

// ── 삭제 확인 모달 ──────────────────────────────────────────────────────────
function DeleteConfirmModal({
  app,
  onConfirm,
  onCancel,
  loading,
}: {
  app: Application;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* 모달 */}
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        {/* 닫기 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={18} />
        </button>

        {/* 아이콘 */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
          <Trash2 size={20} className="text-red-400" />
        </div>

        {/* 텍스트 */}
        <h3 className="text-white font-bold text-center text-lg mb-1">신청 삭제</h3>
        <p className="text-zinc-400 text-sm text-center mb-1">
          아래 신청을 영구적으로 삭제합니다.
        </p>
        <p className="text-white font-semibold text-center text-sm bg-zinc-800 rounded-lg px-3 py-2 mb-5">
          {app.store_name}
        </p>
        <p className="text-red-400 text-xs text-center mb-6">
          삭제 후 복구할 수 없습니다.
        </p>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {loading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [tab, setTab] = useState<TabFilter>('all');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 삭제 모달 상태
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    setLoading(true);
    const [{ data, error }, { data: storeData, error: storeError }] = await Promise.all([
      supabase
        .from('store_applications')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('stores')
        .select('id, name, address')
        .eq('is_active', true),
    ]);

    if (error) {
      console.error('신청 목록 로드 오류:', error);
    } else {
      setApplications(data ?? []);
    }
    if (storeError) {
      console.error('가게 목록 로드 오류:', storeError);
    } else {
      setStores(storeData ?? []);
    }
    setLoading(false);
  }

  async function handleApprove(app: Application) {
    const duplicate = duplicateStore(app, stores);
    const message = duplicate
      ? `"${app.store_name}" 신청을 승인하시겠습니까?\n\n이미 등록된 가게와 중복일 수 있습니다: ${duplicate.name}`
      : `"${app.store_name}" 신청을 승인하시겠습니까?`;
    if (!confirm(message)) return;
    setActionLoading(app.id);
    try {
      const res = await fetch('/api/applications/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, allow_duplicate: Boolean(duplicate) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? '승인 실패');

      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, status: 'approved', verification_status: 'approved' } : a)
      );
      alert(`✅ "${app.store_name}" 승인 완료! (stores 등록됨)`);
    } catch (err) {
      console.error('승인 처리 오류:', err);
      alert('승인 처리 중 오류가 발생했습니다: ' + (err as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(app: Application) {
    if (!confirm(`"${app.store_name}" 신청을 반려하시겠습니까?`)) return;
    setActionLoading(app.id);
    try {
      const { error } = await supabase
        .from('store_applications')
        .update({
          status: 'rejected',
          verification_status: 'rejected',
        })
        .eq('id', app.id);

      if (error) throw error;

      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, status: 'rejected', verification_status: 'rejected' } : a)
      );
    } catch (err) {
      console.error('반려 처리 오류:', err);
      alert('반려 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/applications/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? '삭제 실패');

      setApplications(prev => prev.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다: ' + (err as Error).message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const statusFiltered = tab === 'all'
    ? applications
    : applications.filter(a => a.status === tab);

  const filtered = statusFiltered.filter(app => {
    if (signalFilter === 'agency') return Boolean(app.has_agency);
    if (signalFilter === 'ai') return app.coupon_draft?.source === 'owner_join_ai_suggest';
    if (signalFilter === 'gps') return Boolean(gpsInfo(app));
    if (signalFilter === 'duplicate') return Boolean(duplicateStore(app, stores)) && app.status !== 'approved';
    return true;
  });

  const tabCounts = {
    all:      applications.length,
    pending:  applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const TABS: { key: TabFilter; label: string }[] = [
    { key: 'all',      label: `전체 ${tabCounts.all}` },
    { key: 'pending',  label: `대기중 ${tabCounts.pending}` },
    { key: 'approved', label: `승인됨 ${tabCounts.approved}` },
    { key: 'rejected', label: `반려됨 ${tabCounts.rejected}` },
  ];

  const signalCounts = {
    all: applications.length,
    agency: applications.filter(app => app.has_agency).length,
    ai: applications.filter(app => app.coupon_draft?.source === 'owner_join_ai_suggest').length,
    gps: applications.filter(app => Boolean(gpsInfo(app))).length,
    duplicate: applications.filter(app => Boolean(duplicateStore(app, stores)) && app.status !== 'approved').length,
  };

  const SIGNAL_TABS: { key: SignalFilter; label: string }[] = [
    { key: 'all', label: `전체 신호 ${signalCounts.all}` },
    { key: 'agency', label: `대행사 ${signalCounts.agency}` },
    { key: 'ai', label: `AI 쿠폰 ${signalCounts.ai}` },
    { key: 'gps', label: `GPS 제출 ${signalCounts.gps}` },
    { key: 'duplicate', label: `중복 의심 ${signalCounts.duplicate}` },
  ];

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <DeleteConfirmModal
          app={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* 제목 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">가게 등록 신청</h1>
        <p className="text-zinc-400 text-sm mt-1">사장님 앱에서 접수된 가게 등록 신청 목록입니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            {t.label}
          </button>
        ))}

        <button
          onClick={fetchApplications}
          className="ml-auto px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          새로고침
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {SIGNAL_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSignalFilter(t.key)}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
              signalFilter === t.key
                ? 'bg-[#FF6F0F] text-white'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            로딩 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">
            신청 내역이 없습니다.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-800 text-zinc-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold">신청일</th>
                <th className="px-4 py-3 text-left font-semibold">가게명</th>
                <th className="px-4 py-3 text-left font-semibold">카테고리</th>
                <th className="px-4 py-3 text-left font-semibold">주소</th>
                <th className="px-4 py-3 text-left font-semibold">검증</th>
                <th className="px-4 py-3 text-left font-semibold">첫 번째 쿠폰</th>
                <th className="px-4 py-3 text-left font-semibold">상태</th>
                <th className="px-4 py-3 text-left font-semibold">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(app => (
                <tr
                  key={app.id}
                  className="hover:bg-zinc-800/50 transition-colors"
                >
                  {/* 신청일 */}
                  <td className="px-4 py-3 text-zinc-400 text-sm whitespace-nowrap">
                    {new Date(app.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                    })}
                  </td>

                  {/* 가게명 */}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white text-sm">{app.store_name}</div>
                    {app.has_agency && (
                      <div className="mt-1 inline-flex max-w-[180px] items-center rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                        대행사{app.agency_name ? ` · ${app.agency_name}` : ''}
                      </div>
                    )}
                    {app.description && (
                      <div className="text-zinc-500 text-xs mt-0.5 truncate max-w-[160px]">
                        {app.description}
                      </div>
                    )}
                  </td>

                  {/* 카테고리 */}
                  <td className="px-4 py-3 text-zinc-300 text-sm whitespace-nowrap">
                    {CATEGORY_LABEL[app.category] ?? app.category}
                  </td>

                  {/* 주소 */}
                  <td className="px-4 py-3 text-zinc-300 text-sm max-w-[200px]">
                    <span className="truncate block">{app.address || '-'}</span>
                  </td>

                  {/* 검증 */}
                  <td className="px-4 py-3 min-w-[170px]">
                    <div className="flex flex-col gap-1.5">
                      {(() => {
                        const duplicate = duplicateStore(app, stores);
                        if (!duplicate || app.status === 'approved') return null;
                        return (
                          <span
                            className="inline-flex w-fit items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-300"
                            title={`${duplicate.name ?? ''} · ${duplicate.address ?? ''}`}
                          >
                            <AlertTriangle size={12} />
                            중복 의심
                          </span>
                        );
                      })()}
                      <span className={`inline-flex w-fit rounded-full px-2 py-1 text-[11px] font-semibold ${
                        VERIFICATION_BADGE[app.verification_status ?? 'pending']
                      }`}>
                        {VERIFICATION_LABEL[app.verification_status ?? 'pending']}
                      </span>
                      {app.business_license_path ? (
                        <a
                          href={licenseFileUrl(app.business_license_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit items-center gap-1 rounded-full bg-sky-500/15 px-2 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/25"
                        >
                          <FileText size={12} />
                          등록증 보기
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <div className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                          app.business_registration_number
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-zinc-700/60 text-zinc-400'
                        }`}>
                          <FileText size={12} />
                          {app.business_registration_number
                            ? `사업자번호 ${app.business_registration_number.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')}`
                            : '사업자 정보 없음'}
                        </div>
                      )}
                      {(() => {
                        const gps = gpsInfo(app);
                        if (!gps) {
                          return (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-zinc-700/60 px-2 py-1 text-[11px] font-semibold text-zinc-400">
                              <MapPin size={12} /> GPS 미제출
                            </span>
                          );
                        }
                        return (
                          <a
                            href={gps.mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                            title={`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`}
                          >
                            <MapPin size={12} />
                            지도 확인
                            {gps.accuracy !== null && ` · ${Math.round(gps.accuracy)}m`}
                            <ExternalLink size={11} />
                          </a>
                        );
                      })()}
                    </div>
                  </td>

                  {/* 첫 번째 쿠폰 */}
                  <td className="px-4 py-3 max-w-[200px]">
                    {app.coupon_draft ? (
                      <div>
                        <p className="text-white text-xs font-semibold truncate">🎟️ {app.coupon_draft.title}</p>
                        <p className="text-zinc-500 text-[10px] mt-0.5">
                          {app.coupon_draft.discount_type === 'free_item' && app.coupon_draft.free_item_name && `🎁 ${app.coupon_draft.free_item_name}`}
                          {app.coupon_draft.discount_type === 'percent'   && `${app.coupon_draft.discount_value}% 할인`}
                          {app.coupon_draft.discount_type === 'amount'    && `${app.coupon_draft.discount_value.toLocaleString()}원 할인`}
                          {app.coupon_draft.expires_at && ` · ~${new Date(app.coupon_draft.expires_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`}
                        </p>
                        {app.coupon_draft.source === 'owner_join_ai_suggest' && (
                          <span className="mt-1 inline-flex rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                            AI 추천
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-xs">-</span>
                    )}
                  </td>

                  {/* 상태 뱃지 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[app.status] ?? 'bg-zinc-700 text-zinc-300'}`}>
                      {STATUS_LABEL[app.status] ?? app.status}
                    </span>
                  </td>

                  {/* 액션 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* 승인/반려 — pending 상태만 */}
                      {app.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(app)}
                            disabled={actionLoading === app.id}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            {actionLoading === app.id ? '...' : '승인'}
                          </button>
                          <button
                            onClick={() => handleReject(app)}
                            disabled={actionLoading === app.id}
                            className="bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            {actionLoading === app.id ? '...' : '반려'}
                          </button>
                        </>
                      )}

                      {/* 삭제 버튼 — 항상 표시 */}
                      <button
                        onClick={() => setDeleteTarget(app)}
                        disabled={actionLoading === app.id || deleteLoading}
                        title="삭제"
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
