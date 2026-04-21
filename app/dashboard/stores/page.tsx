'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, ToggleLeft, ToggleRight, MapPin, Phone,
  Plus, Pencil, Trash2, X, ImageIcon,
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

interface StoreForm extends Omit<Store, 'id' | 'created_at'> {
  latitude:  number | null;
  longitude: number | null;
}

const EMPTY_FORM: StoreForm = {
  name: '', address: '', phone: '', category: '', is_active: true,
  owner_id: null, image_url: null, tts_policy_id: null,
  subscription_expires_at: null, latitude: null, longitude: null,
};

// TTS 정책 색상 맵
const POLICY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '스타터':   { bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/25' },
  '프로':     { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/25'  },
  '프리미엄': { bg: 'bg-amber-400/15',  text: 'text-amber-400',  border: 'border-amber-400/25' },
};
const DEFAULT_POLICY_COLOR = { bg: 'bg-fill-subtle', text: 'text-dim', border: 'border-border-subtle' };

// localStorage 히스토리
interface StoreHistoryEntry {
  changed_at: string;
  label: string;
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

  /* ---- stores state ---- */
  const [stores,        setStores]        = useState<Store[]>([]);
  const [storeQ,        setStoreQ]        = useState('');
  const [storeFilter,   setStoreFilter]   = useState<'all' | 'active' | 'inactive' | 'dummy'>('all');
  const [sortCol,       setSortCol]       = useState<string>('created_at');
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [toggling,      setToggling]      = useState<string | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);

  /* ---- TTS 정책 state ---- */
  const [ttsPolicies,     setTtsPolicies]     = useState<TtsPolicy[]>([]);
  const [policyChanging,  setPolicyChanging]  = useState<string | null>(null);
  const [policyEditId,    setPolicyEditId]    = useState<string | null>(null);
  const [policyEditLimit, setPolicyEditLimit] = useState<number>(500);
  const [savingPolicy,    setSavingPolicy]    = useState(false);

  /* ---- 수정 히스토리 state ---- */
  const [historyStoreId, setHistoryStoreId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<StoreHistoryEntry[]>([]);

  /* ---- owner map ---- */
  const [ownerMap,      setOwnerMap]      = useState<Record<string, { name: string; phone: string | null; isDummy: boolean }>>({});
  const [previewingId,  setPreviewingId]  = useState<string | null>(null);

  /* ---- store crud modal ---- */
  const [editModal,   setEditModal]   = useState<Store | null | 'new'>(null);
  const [form,        setForm]        = useState<StoreForm>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [naverUrl,    setNaverUrl]    = useState('');
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillErr, setAutoFillErr] = useState('');

  /* ---------------------------------------------------------------- */
  /* Data loaders                                                       */
  /* ---------------------------------------------------------------- */

  const loadStores = async () => {
    let rows: Store[] = [];
    const { data, error } = await sb
      .from('stores')
      .select('id, name, address, phone, category, is_active, created_at, owner_id, image_url, tts_policy_id, subscription_expires_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[loadStores] fallback:', error.message);
      const { data: data2 } = await sb
        .from('stores')
        .select('id, name, address, phone, category, is_active, created_at, owner_id')
        .order('created_at', { ascending: false });
      rows = (data2 ?? []) as Store[];
    } else {
      rows = (data ?? []) as Store[];
    }
    setStores(rows);
    setLoadingStores(false);

    const ownerIds = [...new Set(rows.map(s => s.owner_id).filter(Boolean))] as string[];
    if (ownerIds.length) {
      const { data: owners } = await sb
        .from('users')
        .select('id, name, phone, email')
        .in('id', ownerIds);
      if (owners) {
        const map: Record<string, { name: string; phone: string | null; isDummy: boolean }> = {};
        owners.forEach(o => {
          map[o.id] = { name: o.name, phone: o.phone, isDummy: (o.email ?? '').endsWith('@test.unnipick.dev') };
        });
        setOwnerMap(map);
      }
    }
  };

  const loadTtsPolicies = async () => {
    try {
      const res = await fetch('/api/tts/policy');
      if (res.ok) setTtsPolicies(await res.json());
    } catch {}
  };

  useEffect(() => {
    loadStores();
    loadTtsPolicies();
    const ch = sb.channel('stores-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, loadStores)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /* Handlers                                                           */
  /* ---------------------------------------------------------------- */

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

  const toggleActive = async (store: Store) => {
    setToggling(store.id);
    await fetch('/api/admin/stores', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: store.id, is_active: !store.is_active }),
    });
    setStores(prev => prev.map(s => s.id === store.id ? { ...s, is_active: !s.is_active } : s));
    setToggling(null);
  };

  const openNew  = () => { setForm(EMPTY_FORM); setNaverUrl(''); setAutoFillErr(''); setSaveError(''); setEditModal('new'); };
  const openEdit = (store: Store) => {
    setForm({
      name: store.name, address: store.address ?? '', phone: store.phone ?? '',
      category: store.category ?? '', is_active: store.is_active, owner_id: store.owner_id,
      image_url: store.image_url, tts_policy_id: store.tts_policy_id,
      subscription_expires_at: store.subscription_expires_at ?? null,
      latitude: null, longitude: null,
    });
    setNaverUrl(''); setAutoFillErr(''); setSaveError('');
    setEditModal(store);
  };

  const handleNaverAutoFill = async () => {
    if (!naverUrl.trim()) return;
    setAutoFilling(true); setAutoFillErr('');
    try {
      const res = await fetch(`/api/naver-place?url=${encodeURIComponent(naverUrl.trim())}`);
      const data = await res.json();
      if (data.error) { setAutoFillErr(data.error); return; }
      setForm(f => ({
        ...f,
        name:      data.name      || f.name,
        address:   data.address   || f.address,
        phone:     data.phone     || f.phone,
        category:  data.category  || f.category,
        image_url: data.image_url || f.image_url,
        latitude:  data.latitude  ?? f.latitude,
        longitude: data.longitude ?? f.longitude,
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
    setSaveError('');
    const payload: Record<string, unknown> = {
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

    let res: Response;
    if (editModal === 'new') {
      res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/admin/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: (editModal as Store).id, ...payload }),
      });
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error || '저장 중 오류가 발생했습니다.');
      setSaving(false);
      return;
    }

    if (editModal !== 'new' && editModal) {
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
    const res = await fetch('/api/admin/stores', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`삭제 실패: ${data.error ?? '알 수 없는 오류'}`);
      return;
    }
    setStores(prev => prev.filter(s => s.id !== id));
    setDeleteId(null);
  };

  /* ---------------------------------------------------------------- */
  /* Derived list                                                       */
  /* ---------------------------------------------------------------- */

  const filteredStores = (() => {
    const filtered = stores.filter(s => {
      const matchQ = !storeQ || s.name.includes(storeQ) || (s.address ?? '').includes(storeQ);
      const isDummyStore = s.owner_id ? (ownerMap[s.owner_id]?.isDummy ?? false) : false;
      const matchF =
        storeFilter === 'all'      ? true :
        storeFilter === 'active'   ? s.is_active :
        storeFilter === 'inactive' ? !s.is_active :
        storeFilter === 'dummy'    ? isDummyStore : true;
      return matchQ && matchF;
    });
    return [...filtered].sort((a, b) => {
      let va: string | number | boolean | null = null;
      let vb: string | number | boolean | null = null;
      if      (sortCol === 'name')       { va = a.name;        vb = b.name; }
      else if (sortCol === 'category')   { va = a.category ?? ''; vb = b.category ?? ''; }
      else if (sortCol === 'phone')      { va = a.phone ?? '';    vb = b.phone ?? ''; }
      else if (sortCol === 'owner')      { va = a.owner_id ? (ownerMap[a.owner_id]?.name ?? '') : ''; vb = b.owner_id ? (ownerMap[b.owner_id]?.name ?? '') : ''; }
      else if (sortCol === 'policy')     { va = a.tts_policy_id ?? ''; vb = b.tts_policy_id ?? ''; }
      else if (sortCol === 'status')     { va = a.is_active ? 1 : 0;   vb = b.is_active ? 1 : 0; }
      else /* created_at */              { va = a.created_at; vb = b.created_at; }
      if (va == null) va = ''; if (vb == null) vb = '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  })();

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
            전체 {stores.length}개 · 활성 {stores.filter(s => s.is_active).length}개
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] hover:bg-[#e66000] text-primary text-sm font-semibold rounded-xl transition"
          >
            <Plus size={15} /> 가게 등록
          </button>
        </div>
      </div>

      {/* 검색 + 필터 */}
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

      {/* TTS 정책 */}
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

      {/* 가게 목록 테이블 */}
      <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-main">
              {([
                ['name',       '가게명',   'left',   'px-5'],
                ['category',   '카테고리', 'left',   'px-4'],
                ['phone',      '연락처',   'left',   'px-4'],
                ['owner',      '사장님',   'left',   'px-4'],
                ['policy',     'TTS 정책', 'left',   'px-4'],
                ['created_at', '등록일',   'left',   'px-4'],
                ['status',     '상태',     'center', 'px-4'],
              ] as const).map(([col, label, align, px]) => (
                <th key={col} className={`text-${align} ${px} py-3.5`}>
                  <button
                    onClick={() => {
                      if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortCol(col); setSortDir('asc'); }
                    }}
                    className={`inline-flex items-center gap-1 text-xs font-semibold transition hover:text-primary ${sortCol === col ? 'text-[#FF6F0F]' : 'text-muted'}`}
                  >
                    {label}
                    <span className="text-[10px]">{sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              ))}
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
                            <ExternalLink size={10} /> 대시보드
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-dim">
                          <User size={11} /> 미연결
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
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
                        {store.is_active ? <><ToggleRight size={14} /> 활성</> : <><ToggleLeft size={14} /> 비활성</>}
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
                          onClick={() => { setHistoryEntries(getStoreHistory(store.id)); setHistoryStoreId(store.id); }}
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

      {/* ============================================================ */}
      {/* Modal: 가게 추가 / 수정                                        */}
      {/* ============================================================ */}
      {editModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-primary">
                {editModal === 'new' ? '가게 등록' : '가게 수정'}
              </h2>
              <button onClick={() => setEditModal(null)} className="text-muted hover:text-primary transition">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {/* 저장 오류 */}
              {saveError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  <X size={13} className="shrink-0" />
                  {saveError}
                </div>
              )}

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

              {/* 가게 사진 */}
              <div className="border-t border-border-main pt-3">
                <label className="flex items-center gap-1.5 text-xs text-muted mb-2">
                  <ImageIcon size={12} /> 가게 사진
                </label>
                {form.image_url ? (
                  <div className="flex items-start gap-3 mb-2">
                    <img
                      src={form.image_url}
                      alt="가게 사진"
                      className="w-20 h-20 object-cover rounded-xl border border-border-subtle shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted break-all line-clamp-2 mb-2">{form.image_url}</p>
                      <button
                        onClick={() => setForm(f => ({ ...f, image_url: null }))}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition"
                      >
                        <Trash2 size={11} /> 사진 삭제
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-dim mb-2">등록된 사진이 없습니다</p>
                )}
                <input
                  type="url"
                  value={form.image_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value || null }))}
                  placeholder="https://... 이미지 URL 직접 입력"
                  className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                />
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

      {/* Modal: 삭제 확인 */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-bold text-primary mb-2">가게 삭제</h2>
            <p className="text-sm text-tertiary mb-6">삭제하면 복구할 수 없습니다. 정말 삭제하시겠어요?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition">
                취소
              </button>
              <button onClick={() => deleteStore(deleteId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary bg-red-500 hover:bg-red-600 transition">
                삭제
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
                      {(entry.snapshot as any).name     && <p>가게명: {String((entry.snapshot as any).name)}</p>}
                      {(entry.snapshot as any).phone    && <p>연락처: {String((entry.snapshot as any).phone)}</p>}
                      {(entry.snapshot as any).address  && <p>주소: {String((entry.snapshot as any).address)}</p>}
                      {(entry.snapshot as any).category && <p>카테고리: {String((entry.snapshot as any).category)}</p>}
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
