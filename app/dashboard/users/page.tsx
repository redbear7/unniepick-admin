'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, User, Store, Shield, ShieldCheck, Trash2, AlertTriangle, X,
  Bell, BellOff, MapPin, Ticket, Pencil, Check,
} from 'lucide-react';

// ── 타입 ─────────────────────────────────────────────────────────────
interface UserRow {
  id:              string;
  name:            string;
  phone:           string | null;
  role:            string;
  created_at:      string;
  last_sign_in_at: string | null;
  recent_area:     string | null;
  source:          'users' | 'profiles' | 'both';
  push_enabled:    boolean | null;   // null = 알 수 없음
  gps_granted:     boolean | null;   // follows 여부로 추론
  coupon_count:    number;
  provider:        'phone' | 'kakao' | null; // 가입방식
}

// ── 상수 ─────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  customer:   '일반회원',
  owner:      '사장님',
  admin:      '관리자',
  superadmin: '최고관리자',
  developer:  '개발자',
};
const ROLE_ICON: Record<string, React.ReactNode> = {
  customer:   <User        size={12} />,
  owner:      <Store       size={12} />,
  admin:      <Shield      size={12} />,
  superadmin: <ShieldCheck size={12} />,
  developer:  <span className="text-[10px]">👨‍💻</span>,
};
const ROLE_COLOR: Record<string, string> = {
  customer:   'bg-blue-500/15 text-blue-400',
  owner:      'bg-[#FF6F0F]/15 text-[#FF6F0F]',
  admin:      'bg-yellow-500/15 text-yellow-400',
  superadmin: 'bg-purple-500/15 text-purple-400',
  developer:  'bg-teal-500/15 text-teal-400',
};

// ── 전화번호 포맷 (+821012345678 / 01012345678 → 010-1234-5678) ────────
function formatPhone(phone: string | null): string {
  if (!phone) return '-';
  let digits = phone.replace(/\D/g, '');            // 숫자만 추출
  if (digits.startsWith('82') && digits.length === 12) {
    digits = '0' + digits.slice(2);                 // +82 → 0
  }
  const m = digits.match(/^(\d{3})(\d{4})(\d{4})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : phone;    // 매칭 실패 시 원본
}

// ── 날짜 포맷 (YYYY. M. D. HH:mm) ────────────────────────────────────
function fmtDate(iso: string) {
  const d = new Date(iso);
  const ymd = d.toLocaleDateString('ko-KR'); // "2026. 4. 20."
  const hm  = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${ymd} ${hm}`;
}

// ── 편집 모달 ────────────────────────────────────────────────────────
function EditModal({
  user,
  onConfirm,
  onCancel,
  saving,
}: {
  user: UserRow;
  onConfirm: (name: string, role: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(user.name === '(이름 없음)' ? '' : user.name);
  const [role, setRole] = useState(user.role);

  const roles: { value: string; label: string; color: string }[] = [
    { value: 'customer',   label: '일반회원',   color: 'border-blue-500/60 bg-blue-500/10 text-blue-400' },
    { value: 'owner',      label: '사장님',     color: 'border-[#FF6F0F]/60 bg-[#FF6F0F]/10 text-[#FF6F0F]' },
    { value: 'admin',      label: '관리자',     color: 'border-yellow-500/60 bg-yellow-500/10 text-yellow-400' },
    { value: 'superadmin', label: '최고관리자', color: 'border-purple-500/60 bg-purple-500/10 text-purple-400' },
    { value: 'developer',  label: '개발자',     color: 'border-teal-500/60 bg-teal-500/10 text-teal-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1D23] border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6F0F]/15 flex items-center justify-center">
              <Pencil size={18} className="text-[#FF6F0F]" />
            </div>
            <div>
              <p className="font-bold text-primary">회원 정보 수정</p>
              <p className="text-xs text-muted mt-0.5">이름과 역할을 변경해요</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-muted hover:text-primary transition">
            <X size={18} />
          </button>
        </div>

        {/* 이름 */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">이름</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            placeholder="이름 입력"
            className="w-full bg-fill-subtle border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
          />
        </div>

        {/* 역할 */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">역할</label>
          <div className="grid grid-cols-2 gap-2">
            {roles.map(r => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                  role === r.value
                    ? r.color
                    : 'border-border-subtle bg-fill-subtle text-tertiary hover:text-primary'
                }`}
              >
                {ROLE_ICON[r.value]}
                {r.label}
                {role === r.value && <Check size={12} className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-fill-medium text-sm font-semibold text-tertiary hover:text-primary transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(name, role)}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#FF6F0F] hover:bg-[#e55e00] text-sm font-semibold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check size={14} />
            )}
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
              <p className="text-xs text-muted">{user.phone ? formatPhone(user.phone) : '전화번호 없음'}</p>
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
  const [users,        setUsers]        = useState<UserRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [query,        setQuery]        = useState('');
  const [filter,       setFilter]       = useState<'all' | 'customer' | 'owner' | 'admin' | 'superadmin' | 'developer' | 'profiles'>('all');
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [editTarget,   setEditTarget]   = useState<UserRow | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState('');

  // ── 데이터 로드 ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const sb = createClient();

    // 기본 유저 데이터 (전 등급 포함)
    const [usersRes, profilesRes] = await Promise.all([
      sb.from('users')
        .select('id, name, phone, role, created_at')
        .order('created_at', { ascending: false }),
      sb.from('profiles')
        .select('id, nickname, created_at')
        .order('created_at', { ascending: false }),
    ]);

    const usersMap = new Map<string, UserRow>();

    for (const u of usersRes.data ?? []) {
      usersMap.set(u.id, {
        id:              u.id,
        name:            u.name || '(이름 없음)',
        phone:           u.phone,
        role:            u.role,
        created_at:      u.created_at,
        last_sign_in_at: null,
        recent_area:     null,
        source:          'users',
        push_enabled:    null,
        gps_granted:     null,
        coupon_count:    0,
        provider:        null,
      });
    }

    for (const p of profilesRes.data ?? []) {
      if (usersMap.has(p.id)) {
        usersMap.get(p.id)!.source = 'both';
      } else {
        usersMap.set(p.id, {
          id:              p.id,
          name:            p.nickname || '(닉네임 없음)',
          phone:           null,
          role:            'customer',
          created_at:      p.created_at,
          last_sign_in_at: null,
          recent_area:     null,
          source:          'profiles',
          push_enabled:    null,
          gps_granted:     null,
          coupon_count:    0,
          provider:        null,
        });
      }
    }

    // created_at 내림차순 정렬
    const merged = [...usersMap.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setUsers(merged);
    setLoading(false);

    // 서비스롤 기반 추가 데이터 (별도 API)
    try {
      const res  = await fetch('/api/admin/users');
      const json = await res.json();

      const {
        authUsers = {}, providerMap = {}, pushMap = {},
        followSet = [], couponCount = {}, recentArea = {},
        usersRoleMap = {},
      } = json;

      const followSetObj = new Set<string>(followSet as string[]);
      const roleMap = usersRoleMap as Record<string, { name: string; role: string }>;

      setUsers(prev => prev.map(u => ({
        ...u,
        // 서비스롤로 조회한 role/name 이 있으면 덮어쓰기 (RLS 우회)
        name:            roleMap[u.id]?.name  ?? u.name,
        role:            roleMap[u.id]?.role  ?? u.role,
        phone:           authUsers[u.id]?.phone ?? u.phone,
        last_sign_in_at: authUsers[u.id]?.last_sign_in_at ?? null,
        recent_area:     (recentArea as Record<string, string>)[u.id] ?? null,
        push_enabled:    pushMap[u.id] === true ? true : null,
        gps_granted:     followSetObj.has(u.id) ? true : null,
        coupon_count:    couponCount[u.id] ?? 0,
        provider:        (providerMap as Record<string, 'phone' | 'kakao'>)[u.id] ?? null,
      })));
    } catch (e) {
      console.error('[users] /api/admin/users fetch 실패:', e);
    }
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
    if (filter !== 'all' && filter !== 'profiles' && u.role !== filter) return false;
    if (!query) return true;
    return u.name.includes(query) || (u.phone ?? '').includes(query);
  });

  const counts = {
    all:        users.length,
    customer:   users.filter(u => u.role === 'customer').length,
    owner:      users.filter(u => u.role === 'owner').length,
    admin:      users.filter(u => u.role === 'admin').length,
    superadmin: users.filter(u => u.role === 'superadmin').length,
    developer:  users.filter(u => u.role === 'developer').length,
    profiles:   users.filter(u => u.source === 'profiles').length,
  };

  // ── 수정 ────────────────────────────────────────────────────────────
  const handleEdit = async (name: string, role: string) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: editTarget.id, name, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '수정 실패');

      setUsers(prev => prev.map(u =>
        u.id === editTarget.id ? { ...u, name, role } : u
      ));
      setToast(`${name} 정보가 수정됐어요`);
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) {
      setToast(`오류: ${e.message}`);
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSaving(false);
      setEditTarget(null);
    }
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
    if (source !== 'profiles') return null;
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 ml-1.5">
        NEW
      </span>
    );
  };

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">회원 관리</h1>
        <p className="text-sm text-muted mt-1">
          전체 {users.length}명 &middot;
          일반 {counts.customer}명 &middot;
          사장님 {counts.owner}명
          {counts.admin > 0 && <span> &middot; 관리자 <span className="text-yellow-400">{counts.admin}명</span></span>}
          {counts.superadmin > 0 && <span> &middot; 최고관리자 <span className="text-purple-400">{counts.superadmin}명</span></span>}
          {counts.profiles > 0 && <span className="ml-2 text-orange-400"> &middot; 🆕 신규 {counts.profiles}명</span>}
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
        {([
          { key: 'all',        label: '전체',       color: 'default' },
          { key: 'customer',   label: '일반회원',    color: 'blue'    },
          { key: 'owner',      label: '사장님',      color: 'orange'  },
          { key: 'admin',      label: '관리자',      color: 'yellow'  },
          { key: 'superadmin', label: '최고관리자',  color: 'purple'  },
          { key: 'developer',  label: '👨‍💻 개발자',  color: 'teal'    },
          { key: 'profiles',   label: '🆕 신규',    color: 'new'     },
        ] as const).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              filter === key
                ? color === 'blue'   ? 'bg-blue-500/80 text-white'
                : color === 'orange' ? 'bg-[#FF6F0F] text-white'
                : color === 'yellow' ? 'bg-yellow-500/80 text-black'
                : color === 'purple' ? 'bg-purple-500/80 text-white'
                : color === 'teal'   ? 'bg-teal-500/80 text-white'
                : color === 'new'    ? 'bg-orange-400/80 text-black'
                : 'bg-white/15 text-primary'
                : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">{counts[key]}</span>
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
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">가입방식</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">역할</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">가입일시</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">최근 로그인</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">접속지역</th>
              <th className="text-center px-3 py-3.5 text-xs font-semibold text-muted">
                <MapPin size={12} className="inline-block mr-0.5 -mt-0.5" />GPS
              </th>
              <th className="text-center px-3 py-3.5 text-xs font-semibold text-muted">
                <Bell size={12} className="inline-block mr-0.5 -mt-0.5" />푸쉬
              </th>
              <th className="text-center px-3 py-3.5 text-xs font-semibold text-muted">
                <Ticket size={12} className="inline-block mr-0.5 -mt-0.5" />쿠폰
              </th>
              <th className="w-12 px-4 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-border-main">
                  {[...Array(11)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-fill-subtle rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-12 text-dim">회원이 없어요</td>
              </tr>
            ) : (
              filtered.map(user => (
                <tr
                  key={user.id}
                  className="border-b border-border-main hover:bg-white/[0.02] transition group"
                >
                  {/* 이름 */}
                  <td className="px-5 py-3.5">
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

                  {/* 전화번호 */}
                  <td className="px-4 py-3.5 text-tertiary font-mono text-xs">
                    {user.phone
                      ? formatPhone(user.phone)
                      : <span className="text-dim">-</span>}
                  </td>

                  {/* 가입방식 */}
                  <td className="px-4 py-3.5">
                    {user.provider === 'phone' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold whitespace-nowrap">
                        📱 전화번호
                      </span>
                    )}
                    {user.provider === 'kakao' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 text-[10px] font-bold whitespace-nowrap">
                        💬 카카오
                      </span>
                    )}
                    {user.provider === null && (
                      <span className="text-dim text-xs">-</span>
                    )}
                  </td>

                  {/* 역할 */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${ROLE_COLOR[user.role] ?? 'bg-fill-subtle text-tertiary'}`}>
                      {ROLE_ICON[user.role]}
                      {ROLE_LABEL[user.role] ?? user.role}
                    </span>
                  </td>

                  {/* 가입일시 */}
                  <td className="px-4 py-3.5 text-muted text-xs whitespace-nowrap">
                    {fmtDate(user.created_at)}
                  </td>

                  {/* 최근 로그인 */}
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                    {user.last_sign_in_at
                      ? <span className="text-tertiary">{fmtDate(user.last_sign_in_at)}</span>
                      : <span className="text-dim">-</span>}
                  </td>

                  {/* 접속지역 */}
                  <td className="px-4 py-3.5 text-xs">
                    {user.recent_area
                      ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium whitespace-nowrap">
                          <MapPin size={10} />
                          {user.recent_area}
                        </span>
                      )
                      : <span className="text-dim">-</span>}
                  </td>

                  {/* GPS */}
                  <td className="px-3 py-3.5 text-center">
                    {user.gps_granted === true
                      ? <MapPin size={14} className="inline text-green-400" />
                      : <MapPin size={14} className="inline text-white/15" />}
                  </td>

                  {/* 푸쉬 */}
                  <td className="px-3 py-3.5 text-center">
                    {user.push_enabled === true
                      ? <Bell size={14} className="inline text-[#FF6F0F]" />
                      : <BellOff size={14} className="inline text-white/15" />}
                  </td>

                  {/* 쿠폰 */}
                  <td className="px-3 py-3.5 text-center">
                    {user.coupon_count > 0
                      ? (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#FF6F0F]/20 text-[#FF6F0F] text-[10px] font-bold">
                          {user.coupon_count}
                        </span>
                      )
                      : <span className="text-dim text-xs">-</span>}
                  </td>

                  {/* 편집 / 삭제 */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => setEditTarget(user)}
                        className="p-1.5 rounded-lg hover:bg-[#FF6F0F]/15 text-muted hover:text-[#FF6F0F]"
                        title="수정"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user)}
                        className="p-1.5 rounded-lg hover:bg-red-500/15 text-muted hover:text-red-400"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 편집 모달 */}
      {editTarget && (
        <EditModal
          user={editTarget}
          onConfirm={handleEdit}
          onCancel={() => !saving && setEditTarget(null)}
          saving={saving}
        />
      )}

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
