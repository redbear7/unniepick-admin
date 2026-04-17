'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

type Application = {
  id: string;
  store_name: string;
  category: string;
  address: string;
  phone: string;
  owner_name: string;
  owner_phone: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  admin_note?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
};

type TabFilter = 'all' | 'pending' | 'approved' | 'rejected';

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

const CATEGORY_LABEL: Record<string, string> = {
  cafe:   '☕ 카페',
  food:   '🍽 음식',
  beauty: '✂️ 미용',
  nail:   '💅 네일',
  etc:    '기타',
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [tab, setTab] = useState<TabFilter>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    setLoading(true);
    const { data, error } = await supabase
      .from('store_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('신청 목록 로드 오류:', error);
    } else {
      setApplications(data ?? []);
    }
    setLoading(false);
  }

  async function handleApprove(app: Application) {
    if (!confirm(`"${app.store_name}" 신청을 승인하시겠습니까?`)) return;
    setActionLoading(app.id);
    try {
      // service_role API 라우트를 통해 승인 (RLS 우회)
      const res = await fetch('/api/applications/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error ?? '승인 실패');

      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, status: 'approved' } : a)
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
        .update({ status: 'rejected' })
        .eq('id', app.id);

      if (error) throw error;

      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, status: 'rejected' } : a)
      );
    } catch (err) {
      console.error('반려 처리 오류:', err);
      alert('반려 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = tab === 'all'
    ? applications
    : applications.filter(a => a.status === tab);

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

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
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
                <th className="px-4 py-3 text-left font-semibold">전화통화 가능시간</th>
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

                  {/* 전화통화 가능시간 (message 컬럼) */}
                  <td className="px-4 py-3 text-zinc-400 text-sm">
                    {app.message || '-'}
                  </td>

                  {/* 상태 뱃지 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[app.status] ?? 'bg-zinc-700 text-zinc-300'}`}>
                      {STATUS_LABEL[app.status] ?? app.status}
                    </span>
                  </td>

                  {/* 액션 */}
                  <td className="px-4 py-3">
                    {app.status === 'pending' ? (
                      <div className="flex items-center gap-2">
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
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-sm">—</span>
                    )}
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
