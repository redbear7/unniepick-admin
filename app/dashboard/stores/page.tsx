'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, ToggleLeft, ToggleRight, MapPin, Phone,
  Plus, Pencil, Trash2, X, Check, ChevronDown,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Store {
  id:         string;
  name:       string;
  address:    string | null;
  phone:      string | null;
  category:   string | null;
  is_active:  boolean;
  created_at: string;
  owner_id:   string | null;
  image_url:  string | null;
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
const EMPTY_FORM: StoreForm = { name: '', address: '', phone: '', category: '', is_active: true, owner_id: null, image_url: null, latitude: null, longitude: null };

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function StoresPage() {
  const sb = createClient();
  const [tab, setTab] = useState<'requests' | 'stores'>('requests');

  /* ---- stores state ---- */
  const [stores,   setStores]   = useState<Store[]>([]);
  const [storeQ,   setStoreQ]   = useState('');
  const [storeFilter, setStoreFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);

  /* ---- request state ---- */
  const [requests,      setRequests]      = useState<StoreRequest[]>([]);
  const [reqFilter,     setReqFilter]     = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loadingReqs,   setLoadingReqs]   = useState(true);
  const [rejectModal,   setRejectModal]   = useState<StoreRequest | null>(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [processing,    setProcessing]    = useState<string | null>(null);

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

    const { data } = await sb
      .from('stores')
      .select('id, name, address, phone, category, is_active, created_at, owner_id, image_url')
      .order('created_at', { ascending: false });
    setStores(data ?? []);
    setLoadingStores(false);
  };

  const loadRequests = async () => {

    const { data } = await sb
      .from('store_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests(data ?? []);
    setLoadingReqs(false);
  };

  useEffect(() => {

    loadStores();
    loadRequests();
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
    setForm({ name: store.name, address: store.address ?? '', phone: store.phone ?? '', category: store.category ?? '', is_active: store.is_active, owner_id: store.owner_id, image_url: store.image_url, latitude: null, longitude: null });
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
      name:      form.name.trim(),
      address:   form.address   || null,
      phone:     form.phone     || null,
      category:  form.category  || null,
      is_active: form.is_active,
      owner_id:  form.owner_id,
      image_url: form.image_url,
      ...(form.latitude  != null ? { latitude:  form.latitude  } : {}),
      ...(form.longitude != null ? { longitude: form.longitude } : {}),
    };
    if (editModal === 'new') {
      await sb.from('stores').insert(payload);
    } else if (editModal) {
      await sb.from('stores').update(payload).eq('id', (editModal as Store).id);
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
    const matchF = storeFilter === 'all' || (storeFilter === 'active' ? s.is_active : !s.is_active);
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
          <h1 className="text-2xl font-bold text-white">가게 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            전체 {stores.length}개 가게 · 활성 {stores.filter(s => s.is_active).length}개
          </p>
        </div>
        {tab === 'stores' && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] hover:bg-[#e66000] text-white text-sm font-semibold rounded-xl transition"
          >
            <Plus size={15} /> 가게 추가
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#1A1D23] border border-white/5 p-1 rounded-xl w-fit">
        {([['requests', '신청 관리'], ['stores', '가게 목록']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative px-5 py-2 rounded-lg text-sm font-semibold transition ${
              tab === key ? 'bg-[#FF6F0F] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
            {key === 'requests' && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
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
                  reqFilter === s ? 'bg-[#FF6F0F] text-white' : 'bg-[#1A1D23] border border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {s === 'pending' ? `대기 (${requests.filter(r => r.status === 'pending').length})` : s === 'approved' ? '승인' : '거절'}
              </button>
            ))}
          </div>

          <div className="bg-[#1A1D23] border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">신청자</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">가게명</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">카테고리</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">연락처</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">신청일</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">처리</th>
                </tr>
              </thead>
              <tbody>
                {loadingReqs ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredReqs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-600">신청 내역이 없어요</td>
                  </tr>
                ) : (
                  filteredReqs.map(req => (
                    <tr key={req.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{req.owner_name}</p>
                        {req.owner_phone && <p className="text-xs text-gray-500 mt-0.5">{req.owner_phone}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-white">{req.store_name}</p>
                        {req.store_address && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {req.store_address}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 bg-white/5 rounded-lg text-xs text-gray-400">
                          {req.store_category ?? '미분류'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {req.store_phone
                          ? <p className="text-gray-300 flex items-center gap-1.5"><Phone size={12} className="text-gray-500" />{req.store_phone}</p>
                          : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">
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
                            {req.reject_reason && <p className="text-xs text-gray-600 mt-0.5 max-w-[140px] truncate">{req.reject_reason}</p>}
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
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={storeQ}
                onChange={e => setStoreQ(e.target.value)}
                placeholder="가게명, 주소 검색"
                className="w-full bg-[#1A1D23] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
              />
            </div>
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStoreFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  storeFilter === f ? 'bg-[#FF6F0F] text-white' : 'bg-[#1A1D23] border border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? '전체' : f === 'active' ? '활성' : '비활성'}
              </button>
            ))}
          </div>

          <div className="bg-[#1A1D23] border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">가게명</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">카테고리</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">연락처</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">등록일</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">상태</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">관리</th>
                </tr>
              </thead>
              <tbody>
                {loadingStores ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredStores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-600">가게가 없어요</td>
                  </tr>
                ) : (
                  filteredStores.map(store => (
                    <tr key={store.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#FF6F0F]/20 flex items-center justify-center text-sm shrink-0">🏪</div>
                          <div>
                            <p className="font-semibold text-white">{store.name}</p>
                            {store.address && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <MapPin size={10} /> {store.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 bg-white/5 rounded-lg text-xs text-gray-400">
                          {store.category ?? '미분류'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {store.phone
                          ? <p className="text-gray-300 flex items-center gap-1.5"><Phone size={12} className="text-gray-500" />{store.phone}</p>
                          : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">
                        {new Date(store.created_at).toLocaleDateString('ko-KR')}
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
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(store.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
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
        </>
      )}

      {/* ============================================================ */}
      {/* Modal: 가게 추가 / 수정                                        */}
      {/* ============================================================ */}
      {editModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1A1D23] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">
                {editModal === 'new' ? '가게 추가' : '가게 수정'}
              </h2>
              <button onClick={() => setEditModal(null)} className="text-gray-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {/* 네이버 자동 입력 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">네이버 업체 URL로 자동 입력</label>
                <div className="flex gap-2">
                  <input
                    value={naverUrl}
                    onChange={e => { setNaverUrl(e.target.value); setAutoFillErr(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleNaverAutoFill()}
                    placeholder="https://map.naver.com/v5/entry/place/..."
                    className="flex-1 min-w-0 bg-[#111318] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#03C75A] transition"
                  />
                  <button
                    onClick={handleNaverAutoFill}
                    disabled={autoFilling || !naverUrl.trim()}
                    className="shrink-0 px-4 py-2.5 bg-[#03C75A] hover:bg-[#02b050] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
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
              <div className="border-t border-white/5" />

              {([
                ['name',     '가게명 *',  'text', '가게명을 입력하세요'],
                ['address',  '주소',      'text', '주소를 입력하세요'],
                ['phone',    '연락처',    'text', '연락처를 입력하세요'],
                ['category', '카테고리',  'text', '예: 카페, 식당, 바'],
              ] as const).map(([key, label, type, placeholder]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form[key] as string) ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                  />
                </div>
              ))}

              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs text-gray-500">활성 상태</label>
                <button
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    form.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-500'
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
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-400 bg-white/5 hover:bg-white/10 transition"
              >
                취소
              </button>
              <button
                onClick={saveStore}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#FF6F0F] hover:bg-[#e66000] transition disabled:opacity-50"
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
          <div className="w-full max-w-sm bg-[#1A1D23] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white mb-2">가게 삭제</h2>
            <p className="text-sm text-gray-400 mb-6">삭제하면 복구할 수 없습니다. 정말 삭제하시겠어요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-400 bg-white/5 hover:bg-white/10 transition"
              >
                취소
              </button>
              <button
                onClick={() => deleteStore(deleteId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition"
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
          <div className="w-full max-w-sm bg-[#1A1D23] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">신청 거절</h2>
              <button onClick={() => setRejectModal(null)} className="text-gray-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              <span className="text-white font-semibold">{rejectModal.store_name}</span> 신청을 거절합니다.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="거절 사유 (선택)"
              rows={3}
              className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-400 bg-white/5 hover:bg-white/10 transition"
              >
                취소
              </button>
              <button
                onClick={rejectRequest}
                disabled={processing === rejectModal.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50"
              >
                거절 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
