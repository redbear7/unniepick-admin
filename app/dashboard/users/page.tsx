'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, User, Store, Shield, Trash2, AlertTriangle, X } from 'lucide-react';

// ── 타입 ─────────────────────────────────────────────────────────────
interface UserRow {
  id:         string;
  name:       string;
  phone:      string | null;
  role:       string;
  created_at: string;
  source:     'users' | 'profiles' | 'both'; // 어느 테이블 출처인지
}

// ── 상수 ─────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  customer:   '고객',
  owner:      '사장님',
  superadmin: '시샵',
};
const ROLE_ICON: Record<string, React.ReactNode> = {
  customer:   <User   size={12} />,
  owner:      <Store  size={12} />,
  superadmin: <Shield size={12} />,
};
const ROLE_COLOR: Record<string, string> = {
  customer:   'bg-blue-500/15 text-blue-400',
  owner:      'bg-[#FF6F0F]/15 text-[#FF6F0F]',
  superadmin: 'bg-purple-500/15 text-purple-400',
};

// ── 삭제 확인 모달 ───────────────────────────────────────────────────
function DeleteModal({
  user,
  onConfirm,
  onCancel,
  deleting,
}: {
  user: UserRow;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1D23] border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <p className="font-bold text-primary">회원 삭제</p>
              <p className="text-xs text-muted mt-0.5">이 작업은 되돌릴 수 없어요</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-muted hover:text-primary transition">
            <X size={18} />
          </button>
        </div>

        <div className="bg-fill-subtle rounded-xl p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-fill-medium flex items-center justify-center text-sm font-bold text-tertiary">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-primary text-sm">{user.name}</p>
              <p className="text-xs text-muted">{user.phone ?? '전화번호 없음'}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-tertiary mb-5 leading-relaxed">
          Auth 계정과 모든 관련 데이터(팔로우, 프로필)가 함께 삭제됩니다.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-fill-medium text-sm font-semibold text-tertiary hover:text-primary transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-sm font-semibold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {deleting ? '삭제 중…' : '삭제하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────
export default function UsersPage() {
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [query,       setQuery]       = useState('');
  const [filter,      setFilter]      = useState<'all' | 'customer' | 'owner' | 'profiles'>('all');
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [toast,       setToast]       = useState('');

  // ── 데이터 로드: users + profiles 병합 ──────────────────────────────
  const load = useCallback(async () => {
    const sb = createClient();

    const [usersRes, profilesRes] = await Promise.all([
      sb.from('users')
        .select('id, name, phone, role, created_at')
        .neq('role', 'superadmin')
        .order('created_at', { ascending: false }),
      sb.from('profiles')
        .select('id, nickname, created_at')
        .order('created_at', { ascending: false }),
    ]);

    const usersMap = new Map<string, UserRow>();

    // users 테이블 (기존 플로우)
    for (const u of usersRes.data ?? []) {
      usersMap.set(u.id, {
        id:         u.id,
        name:       u.name || '(이름 없음)',
        phone:      u.phone,
        role:       u.role,
        created_at: u.created_at,
        source:     'users',
      });
    }

    // profiles 테이블 (신규 인증 플로우) — 병합
    for (const p of profilesRes.data ?? []) {
      if (usersMap.has(p.id)) {
        usersMap.get(p.id)!.source = 'both';
      } else {
        usersMap.set(p.id, {
          id:         p.id,
          name:       p.nickname || '(닉네임 없음)',
          phone:      null,
          role:       'customer',
          created_at: p.created_at,
          source:     'profiles',
        });
      }
    }

    // created_at 내림차순 정렬
    const merged = [...usersMap.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    setUsers(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sb = createClient();
    const ch = sb
      .channel('users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },    load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [load]);

  // ── 필터 / 검색 ─────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    if (filter === 'profiles') return u.source === 'profiles';
    if (filter !== 'all' && u.role !== filter) return false;
    if (!query) return true;
    return u.name.includes(query) || (u.phone ?? '').includes(query);
  });

  const counts = {
    all:      users.length,
    customer: users.filter(u => u.role === 'customer').length,
    owner:    users.filter(u => u.role === 'owner').length,
    profiles: users.filter(u => u.source === 'profiles').length,
  };

  // ── 삭제 ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: deleteTarget.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '삭제 실패');

      // 낙관적 업데이트
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setToast(`${deleteTarget.name} 삭제 완료`);
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) {
      setToast(`오류: ${e.message}`);
      setTimeout(() => setToast(''), 4000);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── 소스 배지 ────────────────────────────────────────────────────────
  const SourceBadge = ({ source }: { source: UserRow['source'] }) => {
    if (source === 'both')     return null;
    if (source === 'profiles') return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 ml-1.5">
        NEW
      </span>
    );
    return null;
  };

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">회원 관리</h1>
        <p className="text-sm text-muted mt-1">
          전체 {users.length}명 · 고객 {counts.customer}명 · 사장님 {counts.owner}명
          {counts.profiles > 0 && (
            <span className="ml-2 text-yellow-400">· 신규플로우 {counts.profiles}명</span>
          )}
        </p>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="이름, 전화번호 검색"
            className="w-full bg-card border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
          />
        </div>
        {(['all', 'customer', 'owner', 'profiles'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              filter === f
                ? f === 'profiles'
                  ? 'bg-yellow-500/80 text-black'
                  : 'bg-[#FF6F0F] text-primary'
                : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
            }`}
          >
            {f === 'all'      && '전체'}
            {f === 'customer' && '고객'}
            {f === 'owner'    && '사장님'}
            {f === 'profiles' && '🆕 신규플로우'}
            <span className="ml-1.5 text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-main">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted">이름</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">전화번호</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">역할</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">가입일</th>
              <th className="w-12 px-4 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-border-main">
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-fill-subtle rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-dim">회원이 없어요</td>
              </tr>
            ) : (
              filtered.map(user => (
                <tr
                  key={user.id}
                  className="border-b border-border-main hover:bg-white/[0.02] transition group"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-fill-medium flex items-center justify-center text-xs font-bold text-tertiary flex-shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex items-center">
                        <p className="font-semibold text-primary">{user.name}</p>
                        <SourceBadge source={user.source} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-tertiary font-mono text-xs">
                    {user.phone ?? <span className="text-dim">-</span>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${ROLE_COLOR[user.role] ?? 'bg-fill-subtle text-tertiary'}`}>
                      {ROLE_ICON[user.role]}
                      {ROLE_LABEL[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted text-xs">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-red-500/15 text-muted hover:text-red-400"
                      title="삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1D23] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-primary shadow-xl z-50 flex items-center gap-2">
          {toast.startsWith('오류') ? (
            <AlertTriangle size={14} className="text-red-400" />
          ) : (
            <span className="text-green-400">✓</span>
          )}
          {toast}
        </div>
      )}
    </div>
  );
}
