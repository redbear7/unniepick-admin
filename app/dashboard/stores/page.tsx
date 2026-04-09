'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, ToggleLeft, ToggleRight, MapPin, Phone,
  Plus, Pencil, Trash2, X, Check,
  ExternalLink, User, FlaskConical, History, Calendar,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Store {
  id:                      string;
  name:                    string;
  address:                 string | null;
  phone:                   string | null;
  category:                string | null;
  is_active:               boolean;
  created_at:              string;
  owner_id:                string | null;
  image_url:               string | null;
  tts_policy_id:           string | null;
  subscription_expires_at: string | null;
}

interface TtsPolicy {
  id:               string;
  name:             string;
  daily_char_limit: number;
  description:      string;
  sort_order:       number;
}

interface StoreRequest {
  id:             string;
  owner_id:       string | null;
  owner_name:     string;
  owner_phone:    string | null;
  store_name:     string;
  store_address:  string | null;
  store_phone:    string | null;
  store_category: string | null;
  status:         'pending' | 'approved' | 'rejected';
  reject_reason:  string | null;
  created_at:     string;
  reviewed_at:    string | null;
}

interface StoreForm extends Omit<Store, 'id' | 'created_at'> {
  latitude:  number | null;
  longitude: number | null;
}
const EMPTY_FORM: StoreForm = { name: '', address: '', phone: '', category: '', is_active: true, owner_id: null, image_url: null, tts_policy_id: null, subscription_expires_at: null, latitude: null, longitude: null };

// TTS 정책 색상 맵 (name 기준)
const POLICY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '스타터':   { bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/25' },
  '프로':     { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/25'  },
  '프리미엄': { bg: 'bg-amber-400/15',  text: 'text-amber-400',  border: 'border-amber-400/25' },
};
const DEFAULT_POLICY_COLOR = { bg: 'bg-fill-subtle', text: 'text-dim', border: 'border-border-subtle' };

// localStorage 히스토리 헬퍼
interface StoreHistoryEntry {
  changed_at: string;
  label: string;  // '가게 추가' or '정보 수정'
  snapshot: Record<string, unknown>;
}
function getStoreHistory(id: string): StoreHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(`sh_${id}`) ?? '[]'); } catch { return []; }
}
function pushStoreHistory(id: string, entry: StoreHistoryEntry) {
  try {
    const list = getStoreHistory(id);
    list.unshift(entry);
    localStorage.setItem(`sh_${id}`, JSON.stringify(list.slice(0, 30)));
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function StoresPage() {
  const sb = createClient();
  const [tab, setTab] = useState<'requests' | 'stores'>('requests');

  /* ---- stores state ---- */
  const [stores,   setStores]   = useState<Store[]>([]);
  const [storeQ,   setStoreQ]   = useState('');
  const [storeFilter, setStoreFilter] = useState<'all' | 'active' | 'inactive' | 'dummy'>('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);

  /* ---- TTS 정책 state ---- */
  const [ttsPolicies,    setTtsPolicies]    = useState<TtsPolicy[]>([]);
  const [policyChanging, setPolicyChanging] = useState<string | null>(null);
  const [policyEditId,   setPolicyEditId]   = useState<string | null>(null);
  const [policyEditLimit, setPolicyEditLimit] = useState<number>(500);
  const [savingPolicy,   setSavingPolicy]   = useState(false);

  /* ---- 수정 히스토리 state ---- */
  const [historyStoreId,  setHistoryStoreId]  = useState<string | null>(null);
  const [historyEntries,  setHistoryEntries]  = useState<StoreHistoryEntry[]>([]);

  /* ---- request state ---- */
  const [requests,      setRequests]      = useState<StoreRequest[]>([]);
  const [reqFilter,     setReqFilter]     = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loadingReqs,   setLoadingReqs]   = useState(true);
  const [rejectModal,   setRejectModal]   = useState<StoreRequest | null>(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [processing,    setProcessing]    = useState<string | null>(null);

  /* ---- owner map (user_id → { name, phone, isDummy }) ---- */
  const [ownerMap, setOwnerMap] = useState<Record<string, { name: string; phone: string | null; isDummy: boolean }>>({});
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  /* ---- store crud modal ---- */
  const [editModal,   setEditModal]   = useState<Store | null | 'new'>(null);
  const [form,        setForm]        = useState<StoreForm>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [naverUrl,    setNaverUrl]    = useState('');
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillErr, setAutoFillErr] = useState('');

  /* ---------------------------------------------------------------- */
  /* Data loaders                                                       */
  /* ---------------------------------------------------------------- */

  const loadStores = async () => {
    // tts_policy_id 컬럼이 아직 없는 DB를 위해 fallback 쿼리 지원
    let rows: Store[] = [];
    const { data, error } = await sb
      .from('stores')
      .select('id, name, address, phone, category, is_active, created_at, owner_id, image_url, tts_policy_id, subscription_expires_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[loadStores] 1차 쿼리 실패, fallback:', error.message);
      // 기본 컬럼만으로 재시도
      const { data: data2, error: err2 } = await sb
        .from('stores')
        .select('id, name, address, phone, category, is_active, created_at, owner_id')
        .order('created_at', { ascending: false });
      if (err2) console.error('[loadStores] fallback 쿼리 실패:', err2.message);
      rows = (data2 ?? []) as Store[];
    } else {
      rows = (data ?? []) as Store[];
    }
    setStores(rows);
    setLoadingStores(false);

    // owner 정보 일괄 로드
    const ownerIds = [...new Set(rows.map(s => s.owner_id).filter(Boolean))] as string[];
    if (ownerIds.length) {
      const { data: owners } = await sb
        .from('users')
        .select('id, name, phone, email')
        .in('id', ownerIds);
      if (owners) {
        const map: Record<string, { name: string; phone: string | null; isDummy: boolean }> = {};
        owners.forEach(o => {
          map[o.id] = {
            name: o.name,
            phone: o.phone,
            isDummy: (o.email ?? '').endsWith('@test.unnipick.dev'),
          };
        });
        setOwnerMap(map);
      }
    }
  };

  const loadRequests = async () => {
    const { data } = await sb
      .from('store_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests(data ?? []);
    setLoadingReqs(false);
  };

  // 시샵 → 사장님 대시보드 바로가기
  const openOwnerDashboard = async (userId: string) => {
    setPreviewingId(userId);
    try {
      const res = await fetch('/api/admin/owner-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || '세션 발급 실패'); return; }
      const encoded = btoa(JSON.stringify(data.session));
      window.open(`/owner/preview?s=${encoded}`, '_blank');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPreviewingId(null);
    }
  };

  const loadTtsPolicies = async () => {
    try {
      const res = await fetch('/api/tts/policy');
      if (res.ok) setTtsPolicies(await res.json());
    } catch {}
  };

  const handlePolicyChange = async (store_id: string, policy_id: string | null) => {
    setPolicyChanging(store_id);
    try {
      await fetch('/api/tts/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id, policy_id }),
      });
      setStores(prev => prev.map(s => s.id === store_id ? { ...s, tts_policy_id: policy_id } : s));
    } finally {
      setPolicyChanging(null);
    }
  };

  const handlePolicyEdit = async (policyId: string) => {
    setSavingPolicy(true);
    try {
      await fetch('/api/tts/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policyId, daily_char_limit: policyEditLimit }),
      });
      await loadTtsPolicies();
      setPolicyEditId(null);
    } finally {
      setSavingPolicy(false);
    }
  };

  const openHistoryPanel = (storeId: string) => {
    setHistoryEntries(getStoreHistory(storeId));
    setHistoryStoreId(storeId);
  };

  useEffect(() => {
    loadStores();
    loadRequests();
    loadTtsPolicies();
    const ch = sb.channel('stores-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, loadStores)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_requests' }, loadRequests)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /* Stores actions                                                     */
  /* ---------------------------------------------------------------- */

  const toggleActive = async (store: Store) => {
    setToggling(store.id);

    await sb.from('stores').update({ is_active: !store.is_active }).eq('id', store.id);
    setStores(prev => prev.map(s => s.id === store.id ? { ...s, is_active: !s.is_active } : s));
    setToggling(null);
  };

  const openNew = () => { setForm(EMPTY_FORM); setNaverUrl(''); setAutoFillErr(''); setEditModal('new'); };
  const openEdit = (store: Store) => {
    setForm({ name: store.name, address: store.address ?? '', phone: store.phone ?? '', category: store.category ?? '', is_active: store.is_active, owner_id: store.owner_id, image_url: store.image_url, tts_policy_id: store.tts_policy_id, subscription_expires_at: store.subscription_expires_at ?? null, latitude: null, longitude: null });
    setNaverUrl(''); setAutoFillErr('');
    setEditModal(store);
  };

  const handleNaverAutoFill = async () => {
    if (!naverUrl.trim()) return;
    setAutoFilling(true);
    setAutoFillErr('');
    try {
      const res = await fetch(`/api/naver-place?url=${encodeURIComponent(naverUrl.trim())}`);
      const data = await res.json();
      if (data.error) { setAutoFillErr(data.error); return; }
      setForm(f => ({
        ...f,
        name:      data.name       || f.name,
        address:   data.address    || f.address,
        phone:     data.phone      || f.phone,
        category:  data.category   || f.category,
        image_url: data.image_url  || f.image_url,
        latitude:  data.latitude   ?? f.latitude,
        longitude: data.longitude  ?? f.longitude,
      }));
    } catch {
      setAutoFillErr('네트워크 오류가 발생했습니다');
    } finally {
      setAutoFilling(false);
    }
  };

  const saveStore = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      name:                    form.name.trim(),
      address:                 form.address       || null,
      phone:                   form.phone         || null,
      category:                form.category      || null,
      is_active:               form.is_active,
      owner_id:                form.owner_id,
      image_url:               form.image_url,
      tts_policy_id:           form.tts_policy_id || null,
      subscription_expires_at: form.subscription_expires_at || null,
      ...(form.latitude  != null ? { latitude:  form.latitude  } : {}),
      ...(form.longitude != null ? { longitude: form.longitude } : {}),
    };
    if (editModal === 'new') {
      await sb.from('stores').insert(payload);
    } else if (editModal) {
      await sb.from('stores').update(payload).eq('id', (editModal as Store).id);
      pushStoreHistory((editModal as Store).id, {
        changed_at: new Date().toISOString(),
        label: '정보 수정',
        snapshot: { ...form } as Record<string, unknown>,
      });
    }
    await loadStores();
    setEditModal(null);
    setSaving(false);
  };

  const deleteStore = async (id: string) => {

    await sb.from('stores').delete().eq('id', id);
    setStores(prev => prev.filter(s => s.id !== id));
    setDeleteId(null);
  };

  /* ---------------------------------------------------------------- */
  /* Request actions                                                    */
  /* ---------------------------------------------------------------- */

  const approveRequest = async (req: StoreRequest) => {
    setProcessing(req.id);

    // 가게 자동 생성
    await sb.from('stores').insert({
      name:     req.store_name,
      address:  req.store_address,
      phone:    req.store_phone,
      category: req.store_category,
      owner_id: req.owner_id,
      is_active: true,
    });
    await sb.from('store_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id);
    await Promise.all([loadRequests(), loadStores()]);
    setProcessing(null);
  };

  const rejectRequest = async () => {
    if (!rejectModal) return;
    setProcessing(rejectModal.id);

    await sb.from('store_requests').update({
      status: 'rejected',
      reject_reason: rejectReason.trim() || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', rejectModal.id);
    await loadRequests();
    setRejectModal(null);
    setRejectReason('');
    setProcessing(null);
  };

  /* ---------------------------------------------------------------- */
  /* Derived lists                                                      */
  /* ---------------------------------------------------------------- */

  const filteredStores = stores.filter(s => {
    const matchQ = !storeQ || s.name.includes(storeQ) || (s.address ?? '').includes(storeQ);
    const isDummyStore = s.owner_id ? (ownerMap[s.owner_id]?.isDummy ?? false) : false;
    const matchF =
      storeFilter === 'all'      ? true :
      storeFilter === 'active'   ? s.is_active :
      storeFilter === 'inactive' ? !s.is_active :
      storeFilter === 'dummy'    ? isDummyStore : true;
    return matchQ && matchF;
  });

  const filteredReqs = requests.filter(r => r.status === reqFilter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  /* ---------------------------------------------------------------- */
  /* Render                                                             */
  /* ---------------------------------------------------------------- */

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">가게 관리</h1>
          <p className="text-sm text-muted mt-1">
            전체 {stores.length}개 가게 · 활성 {stores.filter(s => s.is_active).length}개
          </p>
        </div>
        {tab === 'stores' && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] hover:bg-[#e66000] text-primary text-sm font-semibold rounded-xl transition"
          >
            <Plus size={15} /> 가게 추가
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-card border border-border-main p-1 rounded-xl w-fit">
        {([['requests', '신청 관리'], ['stores', '가게 목록']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative px-5 py-2 rounded-lg text-sm font-semibold transition ${
              tab === key ? 'bg-[#FF6F0F] text-primary' : 'text-tertiary hover:text-primary'
            }`}
          >
            {label}
            {key === 'requests' && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-primary flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* Tab: 신청 관리                                                 */}
      {/* ============================================================ */}
      {tab === 'requests' && (
        <>
          <div className="flex gap-2 mb-5">
            {(['pending', 'approved', 'rejected'] as const).map(s => (
              <button
                key={s}
                onClick={() => setReqFilter(s)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  reqFilter === s ? 'bg-[#FF6F0F] text-primary' : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
                }`}
              >
                {s === 'pending' ? `대기 (${requests.filter(r => r.status === 'pending').length})` : s === 'approved' ? '승인' : '거절'}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-main">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted">신청자</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">가게명</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">카테고리</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">연락처</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">신청일</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-muted">처리</th>
                </tr>
              </thead>
              <tbody>
                {loadingReqs ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b border-border-main">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 bg-fill-subtle rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredReqs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-dim">신청 내역이 없어요</td>
                  </tr>
                ) : (
                  filteredReqs.map(req => (
                    <tr key={req.id} className="border-b border-border-main hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-primary">{req.owner_name}</p>
                        {req.owner_phone && <p className="text-xs text-muted mt-0.5">{req.owner_phone}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-primary">{req.store_name}</p>
                        {req.store_address && (
                          <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {req.store_address}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 bg-fill-subtle rounded-lg text-xs text-tertiary">
                          {req.store_category ?? '미분류'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {req.store_phone
                          ? <p className="text-secondary flex items-center gap-1.5"><Phone size={12} className="text-muted" />{req.store_phone}</p>
                          : <span className="text-dim">-</span>}
                      </td>
                      <td className="px-4 py-4 text-muted text-xs">
                        {new Date(req.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-4">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => approveRequest(req)}
                              disabled={processing === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                            >
                              <Check size={13} /> 승인
                            </button>
                            <button
                              onClick={() => { setRejectModal(req); setRejectReason(''); }}
                              disabled={processing === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                            >
                              <X size={13} /> 거절
                            </button>
                          </div>
                        ) : req.status === 'approved' ? (
                          <span className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-semibold">
                            <Check size={13} /> 승인됨
                          </span>
                        ) : (
                          <div className="text-center">
                            <span className="text-red-400 text-xs font-semibold">거절됨</span>
                            {req.reject_reason && <p className="text-xs text-dim mt-0.5 max-w-[140px] truncate">{req.reject_reason}</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Tab: 가게 목록                                                 */}
      {/* ============================================================ */}
      {tab === 'stores' && (
        <>
          <div className="flex gap-3 mb-5">
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={storeQ}
                onChange={e => setStoreQ(e.target.value)}
                placeholder="가게명, 주소 검색"
                className="w-full bg-card border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
              />
            </div>
            {(['all', 'active', 'inactive', 'dummy'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStoreFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  storeFilter === f ? 'bg-[#FF6F0F] text-primary' : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
                }`}
              >
                {f === 'all' ? '전체' : f === 'active' ? '활성' : f === 'inactive' ? '비활성' : '🧪 더미'}
              </button>
            ))}
          </div>

          {/* 유료 회원 TTS 정책 관리 */}
          <div className="bg-card border border-border-main rounded-2xl p-4 mb-5">
            <p className="text-xs font-semibold text-muted mb-3">유료 회원 TTS 정책</p>
            <div className="flex gap-3 flex-wrap">
              {ttsPolicies.length === 0 && <p className="text-xs text-dim">정책 로드 중...</p>}
              {ttsPolicies.map(p => {
                const col = POLICY_COLORS[p.name] ?? DEFAULT_POLICY_COLOR;
                const isEditing = policyEditId === p.id;
                return (
                  <div key={p.id} className={`flex-1 min-w-[140px] rounded-xl border p-3 ${col.bg} ${col.border}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold ${col.text}`}>{p.name}</span>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => handlePolicyEdit(p.id)} disabled={savingPolicy}
                            className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-bold hover:bg-emerald-500/30 transition disabled:opacity-40">저장</button>
                          <button onClick={() => setPolicyEditId(null)}
                            className="text-[10px] p-0.5 bg-fill-subtle text-dim rounded hover:text-primary transition"><X size={9}/></button>
                        </div>
                      ) : (
                        <button onClick={() => { setPolicyEditId(p.id); setPolicyEditLimit(p.daily_char_limit); }}
                          className="text-dim hover:text-primary transition"><Pencil size={10}/></button>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={policyEditLimit === -1 ? '' : policyEditLimit}
                          onChange={e => setPolicyEditLimit(e.target.value === '' ? -1 : Number(e.target.value))}
                          placeholder="-1 무제한"
                          className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded-lg text-xs text-primary outline-none"/>
                        <span className="text-[10px] text-dim shrink-0">자/일</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-secondary">
                        {p.daily_char_limit === -1 ? '무제한' : `${p.daily_char_limit.toLocaleString()}자/일`}
                      </p>
                    )}
                    <p className="text-[10px] text-dim mt-1 truncate">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-main">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted">가게명</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">카테고리</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">연락처</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">사장님</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">TTS 정책</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">등록일</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-muted">상태</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-muted">관리</th>
                </tr>
              </thead>
              <tbody>
                {loadingStores ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border-main">
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 bg-fill-subtle rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredStores.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-dim">가게가 없어요</td>
                  </tr>
                ) : (
                  filteredStores.map(store => {
                    const owner = store.owner_id ? ownerMap[store.owner_id] : null;
                    return (
                    <tr key={store.id} className="border-b border-border-main hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#FF6F0F]/20 flex items-center justify-center text-sm shrink-0">🏪</div>
                          <div>
                            <p className="font-semibold text-primary">{store.name}</p>
                            {store.address && (
                              <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                                <MapPin size={10} /> {store.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 bg-fill-subtle rounded-lg text-xs text-tertiary">
                          {store.category ?? '미분류'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {store.phone
                          ? <p className="text-secondary flex items-center gap-1.5"><Phone size={12} className="text-muted" />{store.phone}</p>
                          : <span className="text-dim">-</span>}
                      </td>
                      {/* 사장님 열 */}
                      <td className="px-4 py-4">
                        {owner ? (
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-medium text-primary truncate">{owner.name}</p>
                                {owner.isDummy && (
                                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                                    <FlaskConical size={8} /> 더미
                                  </span>
                                )}
                              </div>
                              {owner.phone && <p className="text-[10px] text-muted mt-0.5">{owner.phone}</p>}
                            </div>
                            <button
                              onClick={() => openOwnerDashboard(store.owner_id!)}
                              disabled={previewingId === store.owner_id}
                              title="사장님 대시보드 바로가기"
                              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FF6F0F]/10 text-[#FF6F0F] text-[10px] font-semibold hover:bg-[#FF6F0F]/25 transition disabled:opacity-40"
                            >
                              <ExternalLink size={10} />
                              대시보드
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-dim">
                            <User size={11} />
                            미연결
                          </div>
                        )}
                      </td>
                      {/* TTS 정책 열 */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          {/* 현재 정책 배지 */}
                          {store.tts_policy_id ? (() => {
                            const pol = ttsPolicies.find(p => p.id === store.tts_policy_id);
                            const col = pol ? (POLICY_COLORS[pol.name] ?? DEFAULT_POLICY_COLOR) : DEFAULT_POLICY_COLOR;
                            return (
                              <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${col.bg} ${col.text} border ${col.border}`}>
                                {pol?.name ?? '정책'}
                              </span>
                            );
                          })() : (
                            <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-fill-subtle text-dim border border-border-subtle">
                              미설정
                            </span>
                          )}
                          {/* 정책 변경 드롭다운 */}
                          <select
                            value={store.tts_policy_id ?? ''}
                            disabled={policyChanging === store.id}
                            onChange={e => handlePolicyChange(store.id, e.target.value || null)}
                            className="appearance-none bg-sidebar border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-secondary outline-none cursor-pointer hover:border-[#FF6F0F]/40 transition disabled:opacity-50 max-w-[100px]"
                          >
                            <option value="">미설정</option>
                            {ttsPolicies.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          {(store as any).subscription_expires_at && (() => {
                            const exp = new Date((store as any).subscription_expires_at);
                            const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
                            return (
                              <div className={`flex items-center gap-1 text-[10px] mt-0.5 ${daysLeft < 0 ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                <Calendar size={9}/>
                                {daysLeft < 0 ? `만료됨 (${exp.toLocaleDateString('ko-KR')})` : `D-${daysLeft} (${exp.toLocaleDateString('ko-KR')})`}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <p className="text-muted">{new Date(store.created_at).toLocaleDateString('ko-KR')}</p>
                        <p className="text-dim text-[10px] mt-0.5">{new Date(store.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => toggleActive(store)}
                          disabled={toggling === store.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                          style={{
                            background: store.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.1)',
                            color:      store.is_active ? '#22C55E' : '#F87171',
                          }}
                        >
                          {store.is_active
                            ? <><ToggleRight size={14} /> 활성</>
                            : <><ToggleLeft  size={14} /> 비활성</>}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(store)}
                            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-fill-medium transition"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => openHistoryPanel(store.id)}
                            title="수정 히스토리"
                            className="p-1.5 rounded-lg text-muted hover:text-blue-400 hover:bg-blue-500/10 transition"
                          >
                            <History size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(store.id)}
                            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Modal: 가게 추가 / 수정                                        */}
      {/* ============================================================ */}
      {editModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-primary">
                {editModal === 'new' ? '가게 추가' : '가게 수정'}
              </h2>
              <button onClick={() => setEditModal(null)} className="text-muted hover:text-primary transition">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {/* 네이버 자동 입력 */}
              <div>
                <label className="block text-xs text-muted mb-1">네이버 업체 URL로 자동 입력</label>
                <div className="flex gap-2">
                  <input
                    value={naverUrl}
                    onChange={e => { setNaverUrl(e.target.value); setAutoFillErr(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleNaverAutoFill()}
                    placeholder="https://map.naver.com/v5/entry/place/..."
                    className="flex-1 min-w-0 bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#03C75A] transition"
                  />
                  <button
                    onClick={handleNaverAutoFill}
                    disabled={autoFilling || !naverUrl.trim()}
                    className="shrink-0 px-4 py-2.5 bg-[#03C75A] hover:bg-[#02b050] disabled:opacity-50 text-primary text-xs font-bold rounded-xl transition"
                  >
                    {autoFilling ? '조회 중...' : '자동 입력'}
                  </button>
                </div>
                {autoFillErr && <p className="mt-1.5 text-xs text-red-400">{autoFillErr}</p>}
                {form.latitude != null && (
                  <p className="mt-1.5 text-xs text-emerald-500">
                    좌표 자동 입력됨 ({form.latitude.toFixed(4)}, {form.longitude?.toFixed(4)})
                  </p>
                )}
              </div>
              <div className="border-t border-border-main" />

              {([
                ['name',     '가게명 *',  'text', '가게명을 입력하세요'],
                ['address',  '주소',      'text', '주소를 입력하세요'],
                ['phone',    '연락처',    'text', '연락처를 입력하세요'],
                ['category', '카테고리',  'text', '예: 카페, 식당, 바'],
              ] as const).map(([key, label, type, placeholder]) => (
                <div key={key}>
                  <label className="block text-xs text-muted mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form[key] as string) ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs text-muted mb-1">구독 만료일</label>
                <input
                  type="datetime-local"
                  value={form.subscription_expires_at ? new Date(form.subscription_expires_at).toISOString().slice(0, 16) : ''}
                  onChange={e => setForm(f => ({ ...f, subscription_expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                  className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-[#FF6F0F] transition"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs text-muted">활성 상태</label>
                <button
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    form.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-fill-subtle text-muted'
                  }`}
                >
                  {form.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {form.is_active ? '활성' : '비활성'}
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition"
              >
                취소
              </button>
              <button
                onClick={saveStore}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary bg-[#FF6F0F] hover:bg-[#e66000] transition disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Modal: 삭제 확인                                               */}
      {/* ============================================================ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-bold text-primary mb-2">가게 삭제</h2>
            <p className="text-sm text-tertiary mb-6">삭제하면 복구할 수 없습니다. 정말 삭제하시겠어요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition"
              >
                취소
              </button>
              <button
                onClick={() => deleteStore(deleteId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary bg-red-500 hover:bg-red-600 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Modal: 거절 사유                                               */}
      {/* ============================================================ */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-primary">신청 거절</h2>
              <button onClick={() => setRejectModal(null)} className="text-muted hover:text-primary transition">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-tertiary mb-3">
              <span className="text-primary font-semibold">{rejectModal.store_name}</span> 신청을 거절합니다.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="거절 사유 (선택)"
              rows={3}
              className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition"
              >
                취소
              </button>
              <button
                onClick={rejectRequest}
                disabled={processing === rejectModal.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary bg-red-500 hover:bg-red-600 transition disabled:opacity-50"
              >
                거절 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: 수정 히스토리 */}
      {historyStoreId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                <History size={16}/> 수정 히스토리
              </h2>
              <button onClick={() => setHistoryStoreId(null)} className="text-muted hover:text-primary transition">
                <X size={18}/>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {historyEntries.length === 0 ? (
                <p className="text-sm text-dim text-center py-8">수정 기록이 없어요</p>
              ) : (
                historyEntries.map((entry, i) => (
                  <div key={i} className="bg-fill-subtle border border-border-main rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">{entry.label}</span>
                      <span className="text-[10px] text-dim">{new Date(entry.changed_at).toLocaleString('ko-KR')}</span>
                    </div>
                    <div className="text-[10px] text-muted space-y-0.5">
                      {entry.snapshot.name && <p>가게명: {String(entry.snapshot.name)}</p>}
                      {entry.snapshot.phone && <p>연락처: {String(entry.snapshot.phone)}</p>}
                      {entry.snapshot.address && <p>주소: {String(entry.snapshot.address)}</p>}
                      {entry.snapshot.category && <p>카테고리: {String(entry.snapshot.category)}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
