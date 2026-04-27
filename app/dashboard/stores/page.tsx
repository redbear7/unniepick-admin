'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import KakaoMapPicker from '@/components/KakaoMapPicker';
import {
  Search, ToggleLeft, ToggleRight, MapPin, Phone,
  Plus, Pencil, Trash2, X, ImageIcon,
  ExternalLink, User, FlaskConical, History, Calendar, Tag,
  Camera, Loader2, Star,
} from 'lucide-react';

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

interface Store {
  id:                      string;
  name:                    string;
  address:                 string | null;
  phone:                   string | null;
  category:                string | null;
  is_active:               boolean;
  created_at:              string;
  updated_at:              string | null;
  owner_id:                string | null;
  image_url:               string | null;
  tts_policy_id:           string | null;
  subscription_expires_at: string | null;
  representative_price:    number | null;
  price_label:             string | null;
  price_range:             string | null;
  geo_discoverable:        boolean;
  latitude:                number | null;
  longitude:               number | null;
  category_detail:         string | null;   // 카카오 full path (음식점 > 한식 > 냉면)
}

interface TtsPolicy {
  id:               string;
  name:             string;
  daily_char_limit: number;
  description:      string;
  sort_order:       number;
}

interface StoreForm extends Omit<Store, 'id' | 'created_at' | 'updated_at'> {}

type CouponType = 'percent' | 'amount' | 'free_item' | 'bogo';

interface StoreCoupon {
  id:               string;
  title:            string;
  discount_type:    CouponType;
  discount_value:   number;
  free_item_name:   string | null;
  total_quantity:   number;
  issued_count:     number;
  is_active:        boolean;
  expires_at:       string;
  target_segment:   'all' | 'new' | 'returning';
  min_visit_count:  number | null;
  min_people:       number;
  min_order_amount: number;
  time_start:       string | null;
  time_end:         string | null;
  stackable:        boolean;
  is_featured:      boolean;
}

interface NaverPlace {
  place_name:    string;
  address:       string;
  road_address:  string | null;
  phone:         string | null;
  category:      string;
  category_raw:  string;
  latitude:      number | null;
  longitude:     number | null;
  place_url:     string | null;
}

interface CouponForm {
  title:            string;
  discount_type:    CouponType;
  discount_value:   number;
  free_item_name:   string;
  total_quantity:   number;
  expires_at:       string;
  target_segment:   'all' | 'new' | 'returning';
  min_visit_count:  number | null;
  is_active:        boolean;
  min_people:       number;
  min_order_amount: number;
  use_time_limit:   boolean;
  time_start:       string;
  time_end:         string;
  stackable:        boolean;
  is_featured:      boolean;
}

/* ================================================================== */
/* Constants                                                           */
/* ================================================================== */

const CATEGORIES = [
  '한식', '중식', '일식', '양식', '카페', '베이커리',
  '술집', '분식', '패스트푸드', '기타',
];

const PRICE_PRESETS = [
  { label: '~6천원',  value: 6000  },
  { label: '~8천원',  value: 8000  },
  { label: '~1.2만',  value: 12000 },
  { label: '~2만원',  value: 20000 },
];

function defaultExpires(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const EMPTY_FORM: StoreForm = {
  name: '', address: '', phone: '', category: '', is_active: true,
  owner_id: null, image_url: null, tts_policy_id: null,
  subscription_expires_at: null,
  latitude: null, longitude: null,
  representative_price: null, price_label: null, price_range: null,
  geo_discoverable: false,
  category_detail: null,
};

const EMPTY_COUPON: CouponForm = {
  title: '', discount_type: 'percent', discount_value: 10,
  free_item_name: '',
  total_quantity: 0, expires_at: defaultExpires(30),
  target_segment: 'all', min_visit_count: null, is_active: true,
  min_people: 1, min_order_amount: 0,
  use_time_limit: false, time_start: '11:00', time_end: '17:00',
  stackable: false, is_featured: false,
};

/* ---- 쿠폰 유형 메타 ---- */
const COUPON_TYPES: { key: CouponType; label: string; icon: string; desc: string }[] = [
  { key: 'percent',   label: '% 할인',  icon: '💹', desc: '주문 금액의 N% 할인' },
  { key: 'amount',    label: '원 할인',  icon: '💵', desc: '주문 금액에서 N원 차감' },
  { key: 'free_item', label: '무료 증정', icon: '🎁', desc: '특정 메뉴/상품 무료 제공' },
  { key: 'bogo',      label: '1+1',     icon: '2️⃣', desc: '동일 메뉴 1개 구매 시 1개 무료' },
];

const MIN_PEOPLE_PRESETS  = [1, 2, 3, 4];
const MIN_AMOUNT_PRESETS  = [0, 15000, 30000, 50000, 100000];

const POLICY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '스타터':   { bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/25' },
  '프로':     { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/25'  },
  '프리미엄': { bg: 'bg-amber-400/15',  text: 'text-amber-400',  border: 'border-amber-400/25' },
};
const DEFAULT_POLICY_COLOR = { bg: 'bg-fill-subtle', text: 'text-dim', border: 'border-border-subtle' };

/* ---- LocalStorage history ---- */
interface StoreHistoryEntry {
  changed_at: string;
  label:      string;
  snapshot:   Record<string, unknown>;
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

/* ---- Coupon helpers ---- */
function expiresLabel(expires_at: string) {
  const days = Math.ceil((new Date(expires_at).getTime() - Date.now()) / 86400000);
  if (days < 0)  return { text: '만료됨',    color: 'text-red-400'   };
  if (days <= 7) return { text: `D-${days}`, color: 'text-amber-400' };
  return {
    text: new Date(expires_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + '까지',
    color: 'text-muted',
  };
}
function discountLabel(type: CouponType, value: number, freeItemName?: string | null) {
  if (type === 'bogo')      return '1+1';
  if (type === 'free_item') return freeItemName ? `🎁 ${freeItemName}` : '무료 증정';
  if (type === 'percent')   return `${value}% 할인`;
  return `${value.toLocaleString()}원 할인`;
}

function couponConditionTags(c: StoreCoupon): string[] {
  const tags: string[] = [];
  if (c.min_people   > 1) tags.push(`👥 ${c.min_people}인+`);
  if (c.min_order_amount > 0) tags.push(`₩${(c.min_order_amount / 10000).toFixed(0)}만+`);
  if (c.time_start && c.time_end) tags.push(`⏰ ${c.time_start}~${c.time_end}`);
  if (c.stackable)    tags.push('중복 가능');
  return tags;
}

/* ================================================================== */
/* Component                                                           */
/* ================================================================== */

export default function StoresPage() {
  const sb = createClient();

  /* stores */
  const [stores,        setStores]        = useState<Store[]>([]);
  const [storeQ,        setStoreQ]        = useState('');
  const [storeFilter,   setStoreFilter]   = useState<'all' | 'active' | 'inactive' | 'dummy'>('all');
  const [sortCol,       setSortCol]       = useState('created_at');
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [toggling,      setToggling]      = useState<string | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);

  /* TTS */
  const [ttsPolicies,     setTtsPolicies]     = useState<TtsPolicy[]>([]);
  const [policyChanging,  setPolicyChanging]  = useState<string | null>(null);
  const [policyEditId,    setPolicyEditId]    = useState<string | null>(null);
  const [policyEditLimit, setPolicyEditLimit] = useState(500);
  const [savingPolicy,    setSavingPolicy]    = useState(false);

  /* history */
  const [historyStoreId, setHistoryStoreId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<StoreHistoryEntry[]>([]);

  /* owners */
  const [ownerMap,     setOwnerMap]     = useState<Record<string, { name: string; phone: string | null; isDummy: boolean }>>({});
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  /* modal */
  const [editModal,   setEditModal]   = useState<Store | null | 'new'>(null);
  const [activeTab,   setActiveTab]   = useState<'info' | 'coupons'>('info');
  const [form,        setForm]        = useState<StoreForm>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [naverQ,        setNaverQ]        = useState('');
  const [naverResults,  setNaverResults]  = useState<NaverPlace[]>([]);
  const [naverSearching, setNaverSearching] = useState(false);
  const [naverErr,      setNaverErr]      = useState('');

  /* menu items */
  const menuFileRef = useRef<HTMLInputElement>(null);
  const [menuExtracting, setMenuExtracting]   = useState(false);
  const [menuExtractErr, setMenuExtractErr]   = useState('');
  const [formMenuItems,  setFormMenuItems]    = useState<{ name: string; price: number | null }[]>([]);
  const [repIdx,         setRepIdx]           = useState<number | null>(null);

  /* coupon counts (list) */
  const [couponCountMap, setCouponCountMap] = useState<Record<string, number>>({});

  /* coupons */
  const [storeCoupons,    setStoreCoupons]    = useState<StoreCoupon[]>([]);
  const [couponsLoading,  setCouponsLoading]  = useState(false);
  const [showCouponAdd,   setShowCouponAdd]   = useState(false);
  const [couponForm,      setCouponForm]      = useState<CouponForm>(EMPTY_COUPON);
  const [savingCoupon,    setSavingCoupon]    = useState(false);
  const [couponError,     setCouponError]     = useState('');
  const [togglingCoupon,  setTogglingCoupon]  = useState<string | null>(null);
  const [editCouponId,    setEditCouponId]    = useState<string | null>(null);
  const [deletingCoupon,  setDeletingCoupon]  = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /* Loaders                                                           */
  /* ---------------------------------------------------------------- */

  const loadCouponCounts = async () => {
    const { data } = await sb.from('coupons').select('store_id').eq('is_active', true);
    const map: Record<string, number> = {};
    (data ?? []).forEach((r: { store_id: string }) => {
      map[r.store_id] = (map[r.store_id] || 0) + 1;
    });
    setCouponCountMap(map);
  };

  const loadStores = async () => {
    const { data, error } = await sb
      .from('stores')
      .select('id, name, address, phone, category, category_detail, is_active, created_at, updated_at, owner_id, image_url, tts_policy_id, subscription_expires_at, representative_price, price_label, price_range, geo_discoverable, latitude, longitude')
      .order('created_at', { ascending: false });

    let rows: Store[];
    if (error) {
      console.warn('[loadStores] fallback:', error.message);
      const { data: d2 } = await sb.from('stores')
        .select('id, name, address, phone, category, is_active, created_at, owner_id')
        .order('created_at', { ascending: false });
      rows = (d2 ?? []) as Store[];
    } else {
      rows = (data ?? []) as Store[];
    }
    setStores(rows);
    setLoadingStores(false);

    const ownerIds = [...new Set(rows.map(s => s.owner_id).filter(Boolean))] as string[];
    if (ownerIds.length) {
      const { data: owners } = await sb.from('users').select('id, name, phone, email').in('id', ownerIds);
      if (owners) {
        const map: Record<string, { name: string; phone: string | null; isDummy: boolean }> = {};
        owners.forEach(o => { map[o.id] = { name: o.name, phone: o.phone, isDummy: (o.email ?? '').endsWith('@test.unnipick.dev') }; });
        setOwnerMap(map);
      }
    }
  };

  const loadTtsPolicies = async () => {
    try { const r = await fetch('/api/tts/policy'); if (r.ok) setTtsPolicies(await r.json()); } catch {}
  };

  const loadStoreCoupons = async (storeId: string) => {
    setCouponsLoading(true);
    setStoreCoupons([]);
    try {
      const r = await fetch(`/api/admin/coupons?store_id=${storeId}`);
      if (r.ok) setStoreCoupons(await r.json());
    } finally {
      setCouponsLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
    loadTtsPolicies();
    loadCouponCounts();
    const ch = sb.channel('stores-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, loadStores)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /* Handlers — Store                                                  */
  /* ---------------------------------------------------------------- */

  const openOwnerDashboard = async (userId: string) => {
    setPreviewingId(userId);
    try {
      const r    = await fetch('/api/admin/owner-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
      const data = await r.json();
      if (!r.ok) { alert(data.error || '세션 발급 실패'); return; }
      window.open(`/owner/preview?s=${btoa(JSON.stringify(data.session))}`, '_blank');
    } catch (e) { alert((e as Error).message); }
    finally     { setPreviewingId(null); }
  };

  const handlePolicyChange = async (store_id: string, policy_id: string | null) => {
    setPolicyChanging(store_id);
    try {
      await fetch('/api/tts/policy', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id, policy_id }) });
      setStores(p => p.map(s => s.id === store_id ? { ...s, tts_policy_id: policy_id } : s));
    } finally { setPolicyChanging(null); }
  };

  const handlePolicyEdit = async (policyId: string) => {
    setSavingPolicy(true);
    try {
      await fetch('/api/tts/policy', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: policyId, daily_char_limit: policyEditLimit }) });
      await loadTtsPolicies();
      setPolicyEditId(null);
    } finally { setSavingPolicy(false); }
  };

  const toggleActive = async (store: Store) => {
    setToggling(store.id);
    await fetch('/api/admin/stores', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: store.id, is_active: !store.is_active }) });
    setStores(p => p.map(s => s.id === store.id ? { ...s, is_active: !s.is_active } : s));
    setToggling(null);
  };

  const searchNaver = async () => {
    if (!naverQ.trim()) return;
    setNaverSearching(true); setNaverErr(''); setNaverResults([]);
    try {
      const r = await fetch(`/api/naver-place?q=${encodeURIComponent(naverQ.trim())}&size=5`);
      const data = await r.json();
      if (!r.ok) { setNaverErr(data.error ?? '검색 오류'); return; }
      setNaverResults(data.places ?? []);
    } catch { setNaverErr('네트워크 오류가 발생했습니다'); }
    finally   { setNaverSearching(false); }
  };

  const applyNaverPlace = (place: NaverPlace) => {
    setForm(f => ({
      ...f,
      name:            place.place_name   || f.name,
      address:         place.address      || f.address,
      phone:           place.phone        || f.phone,
      category:        place.category     || f.category,
      category_detail: place.category_raw || f.category_detail,
      latitude:        place.latitude     ?? f.latitude,
      longitude:       place.longitude    ?? f.longitude,
    }));
    setNaverResults([]);
    setNaverQ('');
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setNaverQ(''); setNaverResults([]); setNaverErr(''); setSaveError('');
    setFormMenuItems([]); setRepIdx(null); setMenuExtractErr('');
    setActiveTab('info'); setStoreCoupons([]); setShowCouponAdd(false);
    setEditModal('new');
  };

  const openEdit = (store: Store) => {
    setForm({
      name: store.name, address: store.address ?? '', phone: store.phone ?? '',
      category: store.category ?? '', is_active: store.is_active,
      owner_id: store.owner_id, image_url: store.image_url,
      tts_policy_id: store.tts_policy_id,
      subscription_expires_at: store.subscription_expires_at ?? null,
      latitude: store.latitude ?? null, longitude: store.longitude ?? null,
      representative_price: store.representative_price ?? null,
      price_label: store.price_label ?? null, price_range: store.price_range ?? null,
      geo_discoverable: store.geo_discoverable ?? false,
      category_detail:  store.category_detail ?? null,
    });
    setNaverQ(''); setNaverResults([]); setNaverErr(''); setSaveError('');
    setMenuExtractErr('');
    // price_range에 저장된 메뉴 목록 복원
    let items: { name: string; price: number | null }[] = [];
    try { if (store.price_range) items = JSON.parse(store.price_range); } catch { items = []; }
    setFormMenuItems(items);
    const idx = items.findIndex(m => m.name === store.price_label && m.price === store.representative_price);
    setRepIdx(idx >= 0 ? idx : null);
    setActiveTab('info'); setShowCouponAdd(false);
    setCouponError(''); setEditCouponId(null);
    loadStoreCoupons(store.id);
    setEditModal(store);
  };

  const handleMenuImageExtract = async (file: File) => {
    setMenuExtracting(true); setMenuExtractErr('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/admin/extract-menu', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) { setMenuExtractErr(data.error ?? '분석 실패'); return; }
      const items: { name: string; price: number | null }[] = data.items ?? [];
      setFormMenuItems(items);
      // AI가 추천한 대표 메뉴 자동 선택
      const idx = items.findIndex(m => m.price === data.representative_price);
      setRepIdx(idx >= 0 ? idx : (items.length > 0 ? 0 : null));
    } catch { setMenuExtractErr('네트워크 오류가 발생했습니다'); }
    finally  { setMenuExtracting(false); }
  };

  const saveStore = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setSaveError('');
    const payload: Record<string, unknown> = {
      name:                    form.name.trim(),
      address:                 form.address       || null,
      phone:                   form.phone         || null,
      category:                form.category      || null,
      category_detail:         form.category_detail || null,
      is_active:               form.is_active,
      owner_id:                form.owner_id,
      image_url:               form.image_url,
      tts_policy_id:           form.tts_policy_id || null,
      subscription_expires_at: form.subscription_expires_at || null,
      representative_price:    repIdx != null ? (formMenuItems[repIdx]?.price ?? null) : null,
      price_label:             repIdx != null ? (formMenuItems[repIdx]?.name || null) : null,
      price_range:             formMenuItems.length > 0 ? JSON.stringify(formMenuItems) : null,
      geo_discoverable:        form.geo_discoverable,
      ...(form.latitude  != null ? { latitude:  form.latitude  } : {}),
      ...(form.longitude != null ? { longitude: form.longitude } : {}),
    };

    const method = editModal === 'new' ? 'POST' : 'PUT';
    const body   = editModal === 'new' ? payload : { id: (editModal as Store).id, ...payload };
    const r      = await fetch('/api/admin/stores', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setSaveError(d.error || '저장 중 오류가 발생했습니다.');
      setSaving(false); return;
    }
    if (editModal !== 'new' && editModal) {
      pushStoreHistory((editModal as Store).id, { changed_at: new Date().toISOString(), label: '정보 수정', snapshot: { ...form } as Record<string, unknown> });
    }
    await loadStores();
    setEditModal(null); setSaving(false);
  };

  const deleteStore = async (id: string) => {
    const r = await fetch('/api/admin/stores', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(`삭제 실패: ${d.error ?? '알 수 없는 오류'}`); return; }
    setStores(p => p.filter(s => s.id !== id));
    setDeleteId(null);
  };

  /* ---------------------------------------------------------------- */
  /* Handlers — Coupon                                                 */
  /* ---------------------------------------------------------------- */

  const saveCoupon = async () => {
    const _needsValue = couponForm.discount_type === 'percent' || couponForm.discount_type === 'amount';
    if (!couponForm.title.trim() || (_needsValue && !couponForm.discount_value) || editModal === 'new' || !editModal) return;
    setSavingCoupon(true); setCouponError('');
    try {
      if (editCouponId) {
        const r = await fetch('/api/admin/coupons', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editCouponId, ...couponForm }) });
        if (!r.ok) { const d = await r.json().catch(() => ({})); setCouponError(d.error ?? '수정 실패'); return; }
        setStoreCoupons(p => p.map(c => c.id === editCouponId ? { ...c, ...couponForm } : c));
        setEditCouponId(null);
      } else {
        const r = await fetch('/api/admin/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: (editModal as Store).id, ...couponForm }) });
        if (!r.ok) { const d = await r.json().catch(() => ({})); setCouponError(d.error ?? '등록 실패'); return; }
        const { data: newC } = await r.json();
        if (newC) setStoreCoupons(p => [newC, ...p]);
        else await loadStoreCoupons((editModal as Store).id);
      }
      setShowCouponAdd(false); setCouponForm(EMPTY_COUPON);
      loadCouponCounts();
    } finally { setSavingCoupon(false); }
  };

  const toggleCouponActive = async (coupon: StoreCoupon) => {
    setTogglingCoupon(coupon.id);
    await fetch('/api/admin/coupons', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: coupon.id, is_active: !coupon.is_active }) });
    setStoreCoupons(p => p.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
    setTogglingCoupon(null);
    loadCouponCounts();
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('쿠폰을 삭제할까요? 이미 발급된 쿠폰도 함께 삭제됩니다.')) return;
    setDeletingCoupon(id);
    const r = await fetch('/api/admin/coupons', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (r.ok) { setStoreCoupons(p => p.filter(c => c.id !== id)); loadCouponCounts(); }
    setDeletingCoupon(null);
  };

  const startEditCoupon = (coupon: StoreCoupon) => {
    setEditCouponId(coupon.id);
    setCouponForm({
      title:            coupon.title,
      discount_type:    coupon.discount_type,
      discount_value:   coupon.discount_value,
      free_item_name:   coupon.free_item_name ?? '',
      total_quantity:   coupon.total_quantity,
      expires_at:       coupon.expires_at.slice(0, 10),
      target_segment:   (coupon.target_segment ?? 'all') as 'all' | 'new' | 'returning',
      min_visit_count:  coupon.min_visit_count,
      is_active:        coupon.is_active,
      min_people:       coupon.min_people       ?? 1,
      min_order_amount: coupon.min_order_amount ?? 0,
      use_time_limit:   !!(coupon.time_start && coupon.time_end),
      time_start:       coupon.time_start ?? '11:00',
      time_end:         coupon.time_end   ?? '17:00',
      stackable:        coupon.stackable  ?? false,
      is_featured:      coupon.is_featured ?? false,
    });
    setShowCouponAdd(true);
  };

  /* ---------------------------------------------------------------- */
  /* Derived list                                                       */
  /* ---------------------------------------------------------------- */

  const filteredStores = (() => {
    const filtered = stores.filter(s => {
      const matchQ = !storeQ || s.name.includes(storeQ) || (s.address ?? '').includes(storeQ);
      const isDummy = s.owner_id ? (ownerMap[s.owner_id]?.isDummy ?? false) : false;
      const matchF = storeFilter === 'all' ? true : storeFilter === 'active' ? s.is_active : storeFilter === 'inactive' ? !s.is_active : isDummy;
      return matchQ && matchF;
    });
    return [...filtered].sort((a, b) => {
      let va: string | number | null = null, vb: string | number | null = null;
      if      (sortCol === 'name')       { va = a.name;                vb = b.name; }
      else if (sortCol === 'category')   { va = a.category ?? '';      vb = b.category ?? ''; }
      else if (sortCol === 'phone')      { va = a.phone ?? '';         vb = b.phone ?? ''; }
      else if (sortCol === 'owner')      { va = a.owner_id ? (ownerMap[a.owner_id]?.name ?? '') : ''; vb = b.owner_id ? (ownerMap[b.owner_id]?.name ?? '') : ''; }
      else if (sortCol === 'policy')     { va = a.tts_policy_id ?? ''; vb = b.tts_policy_id ?? ''; }
      else if (sortCol === 'status')     { va = a.is_active ? 1 : 0;         vb = b.is_active ? 1 : 0; }
      else if (sortCol === 'updated_at') { va = a.updated_at ?? a.created_at; vb = b.updated_at ?? b.created_at; }
      else if (sortCol === 'coupons')    { va = couponCountMap[a.id] ?? 0;    vb = couponCountMap[b.id] ?? 0; }
      else                              { va = a.created_at;                  vb = b.created_at; }
      if (va == null) va = ''; if (vb == null) vb = '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  })();

  /* ---------------------------------------------------------------- */
  /* Coupon form render                                                */
  /* ---------------------------------------------------------------- */

  const renderCouponForm = () => {
    const cf   = couponForm;
    const set  = (patch: Partial<CouponForm>) => setCouponForm(f => ({ ...f, ...patch }));
    const needsValue = cf.discount_type === 'percent' || cf.discount_type === 'amount';
    const isValid = cf.title.trim() &&
      (cf.discount_type === 'bogo' || cf.discount_type === 'free_item' || cf.discount_value > 0) &&
      (!cf.use_time_limit || (cf.time_start && cf.time_end));

    const SectionHead = ({ label }: { label: string }) => (
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-border-main" />
        <span className="text-[10px] text-muted font-semibold uppercase tracking-wider shrink-0">{label}</span>
        <div className="flex-1 h-px bg-border-main" />
      </div>
    );

    return (
      <div className="bg-[#FF6F0F]/5 rounded-2xl p-4 space-y-3.5 border border-[#FF6F0F]/20">
        {/* 헤더 */}
        <p className="text-xs font-bold text-[#FF6F0F] flex items-center gap-1.5">
          <Tag size={12} />
          {editCouponId ? '쿠폰 수정' : '새 쿠폰 등록'}
        </p>

        {couponError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            <X size={12} />{couponError}
          </div>
        )}

        {/* ── 쿠폰명 ── */}
        <div>
          <label className="text-[10px] text-dim mb-1 block">쿠폰명 *</label>
          <input
            value={cf.title}
            onChange={e => set({ title: e.target.value })}
            placeholder="예: 밀면 3인분 이상 주문시 만두 50% 할인권"
            className="w-full bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
          />
        </div>

        {/* ── 쿠폰 유형 ── */}
        <div>
          <label className="text-[10px] text-dim mb-1.5 block">쿠폰 유형</label>
          <div className="grid grid-cols-4 gap-1.5">
            {COUPON_TYPES.map(({ key, label, icon, desc }) => (
              <button key={key}
                onClick={() => set({ discount_type: key })}
                title={desc}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition ${
                  cf.discount_type === key
                    ? 'border-[#FF6F0F] bg-[#FF6F0F]/15 text-[#FF6F0F]'
                    : 'border-border-subtle bg-sidebar text-muted hover:text-primary hover:border-border-main'
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-dim mt-1.5">
            {COUPON_TYPES.find(t => t.key === cf.discount_type)?.desc}
          </p>
        </div>

        {/* 할인값 (percent / amount) */}
        {needsValue && (
          <div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-[10px] text-dim mb-1 block">
                  할인값 ({cf.discount_type === 'percent' ? '%' : '원'})
                </label>
                <input type="number" min="1"
                  value={cf.discount_value || ''}
                  onChange={e => set({ discount_value: Number(e.target.value) })}
                  placeholder={cf.discount_type === 'percent' ? '10' : '2000'}
                  className="w-full bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className="flex flex-wrap gap-1">
                  {(cf.discount_type === 'percent'
                    ? [5, 10, 15, 20, 30, 50]
                    : [1000, 2000, 3000, 5000]
                  ).map(v => (
                    <button key={v}
                      onClick={() => set({ discount_value: v })}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                        cf.discount_value === v
                          ? 'border-[#FF6F0F] bg-[#FF6F0F]/10 text-[#FF6F0F]'
                          : 'border-border-subtle bg-sidebar text-muted hover:text-primary'
                      }`}
                    >
                      {cf.discount_type === 'percent' ? `${v}%` : `${v.toLocaleString()}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 무료 증정 상품명 */}
        {cf.discount_type === 'free_item' && (
          <div>
            <label className="text-[10px] text-dim mb-1 block">증정 상품명 *</label>
            <input
              value={cf.free_item_name}
              onChange={e => set({ free_item_name: e.target.value })}
              placeholder="예: 아메리카노, 만두 1인분"
              className="w-full bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
            />
          </div>
        )}

        {/* ━━ 사용 조건 ━━ */}
        <SectionHead label="사용 조건" />

        {/* 최소 인원 */}
        <div>
          <label className="text-[10px] text-dim mb-1.5 block">최소 인원</label>
          <div className="flex gap-1.5">
            {MIN_PEOPLE_PRESETS.map(n => (
              <button key={n}
                onClick={() => set({ min_people: n })}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  cf.min_people === n
                    ? 'border-[#FF6F0F] bg-[#FF6F0F]/15 text-[#FF6F0F]'
                    : 'border-border-subtle bg-sidebar text-muted hover:text-primary'
                }`}
              >
                {n === 4 ? '4인+' : `${n}인`}
              </button>
            ))}
          </div>
        </div>

        {/* 최소 주문금액 */}
        <div>
          <label className="text-[10px] text-dim mb-1.5 block">최소 주문금액</label>
          <div className="flex gap-1.5 mb-1.5">
            {MIN_AMOUNT_PRESETS.map(n => (
              <button key={n}
                onClick={() => set({ min_order_amount: n })}
                className={`flex-1 py-1.5 rounded-lg border text-[10px] font-semibold transition ${
                  cf.min_order_amount === n
                    ? 'border-[#FF6F0F] bg-[#FF6F0F]/15 text-[#FF6F0F]'
                    : 'border-border-subtle bg-sidebar text-muted hover:text-primary'
                }`}
              >
                {n === 0 ? '없음' : `${(n / 10000).toFixed(0)}만`}
              </button>
            ))}
          </div>
          {!MIN_AMOUNT_PRESETS.includes(cf.min_order_amount) && (
            <input type="number" min="0" step="1000"
              value={cf.min_order_amount || ''}
              onChange={e => set({ min_order_amount: Number(e.target.value) })}
              placeholder="직접 입력 (원)"
              className="w-full bg-sidebar border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
            />
          )}
        </div>

        {/* 사용 가능 시간 */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox"
              checked={cf.use_time_limit}
              onChange={e => set({ use_time_limit: e.target.checked })}
              className="rounded accent-[#FF6F0F]"
            />
            <span className="text-[10px] text-muted font-semibold">사용 가능 시간 제한</span>
            {!cf.use_time_limit && <span className="text-[10px] text-dim">24시간 사용 가능</span>}
          </label>
          {cf.use_time_limit && (
            <div className="flex items-center gap-2">
              <input type="time" value={cf.time_start}
                onChange={e => set({ time_start: e.target.value })}
                className="flex-1 bg-sidebar border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary focus:outline-none focus:border-[#FF6F0F] transition"
              />
              <span className="text-muted text-xs">~</span>
              <input type="time" value={cf.time_end}
                onChange={e => set({ time_end: e.target.value })}
                className="flex-1 bg-sidebar border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary focus:outline-none focus:border-[#FF6F0F] transition"
              />
            </div>
          )}
        </div>

        {/* ━━ 수량 & 기간 ━━ */}
        <SectionHead label="수량 & 기간" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-dim mb-1 block">수량 (0 = 무제한)</label>
            <input type="number" min="0"
              value={cf.total_quantity}
              onChange={e => set({ total_quantity: Number(e.target.value) })}
              className="w-full bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary focus:outline-none focus:border-[#FF6F0F] transition"
            />
          </div>
          <div>
            <label className="text-[10px] text-dim mb-1 block">만료일</label>
            <input type="date" value={cf.expires_at}
              onChange={e => set({ expires_at: e.target.value })}
              className="w-full bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary focus:outline-none focus:border-[#FF6F0F] transition"
            />
          </div>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 60, 90].map(d => (
            <button key={d}
              onClick={() => set({ expires_at: defaultExpires(d) })}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-border-subtle bg-sidebar text-muted hover:text-primary hover:border-border-main transition"
            >
              +{d}일
            </button>
          ))}
        </div>

        {/* ━━ 대상 고객 ━━ */}
        <SectionHead label="대상 고객" />

        <div className="flex gap-1.5">
          {([
            { key: 'all',       label: '전체', desc: '모든 고객' },
            { key: 'new',       label: '신규', desc: '첫 방문 고객' },
            { key: 'returning', label: '재방문', desc: 'N회 이상 방문' },
          ] as const).map(({ key, label, desc }) => (
            <button key={key}
              onClick={() => set({ target_segment: key, min_visit_count: key === 'returning' ? (cf.min_visit_count ?? 2) : null })}
              title={desc}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition ${
                cf.target_segment === key
                  ? 'border-[#FF6F0F] bg-[#FF6F0F]/15 text-[#FF6F0F]'
                  : 'border-border-subtle bg-sidebar text-muted hover:text-primary'
              }`}
            >
              {label}
              <span className="block text-[9px] font-normal opacity-60 mt-0.5">{desc}</span>
            </button>
          ))}
        </div>
        {cf.target_segment === 'returning' && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-dim">최소 방문</label>
            <input type="number" min="1"
              value={cf.min_visit_count ?? 2}
              onChange={e => set({ min_visit_count: Number(e.target.value) })}
              className="w-16 bg-sidebar border border-border-subtle rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-[#FF6F0F] transition"
            />
            <span className="text-[10px] text-muted">회 이상</span>
          </div>
        )}

        {/* ━━ 운영 설정 ━━ */}
        <SectionHead label="운영 설정" />

        <div className="flex gap-3 flex-wrap">
          {/* 중복 사용 */}
          <button onClick={() => set({ stackable: !cf.stackable })}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition flex-1 ${
              cf.stackable ? 'border-blue-500/40 bg-blue-500/10 text-blue-400' : 'border-border-subtle bg-sidebar text-muted hover:text-primary'
            }`}
          >
            {cf.stackable ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            <div>
              <p>다른 쿠폰과 중복 사용</p>
              <p className="text-[9px] opacity-60 mt-0.5">{cf.stackable ? '중복 허용' : '중복 불가'}</p>
            </div>
          </button>
          {/* 앱 상단 노출 */}
          <button onClick={() => set({ is_featured: !cf.is_featured })}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition flex-1 ${
              cf.is_featured ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' : 'border-border-subtle bg-sidebar text-muted hover:text-primary'
            }`}
          >
            {cf.is_featured ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            <div>
              <p>⭐ 앱 상단 노출</p>
              <p className="text-[9px] opacity-60 mt-0.5">{cf.is_featured ? '리스트 최상단' : '일반 순서'}</p>
            </div>
          </button>
        </div>

        {/* ── 저장/취소 ── */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { setShowCouponAdd(false); setCouponForm(EMPTY_COUPON); setCouponError(''); setEditCouponId(null); }}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-muted bg-sidebar border border-border-subtle hover:bg-fill-medium transition"
          >
            취소
          </button>
          <button
            onClick={saveCoupon}
            disabled={savingCoupon || !isValid}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-primary bg-[#FF6F0F] hover:bg-[#e66000] transition disabled:opacity-50"
          >
            {savingCoupon ? '저장 중...' : (editCouponId ? '수정 완료' : '쿠폰 등록')}
          </button>
        </div>
      </div>
    );
  };

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
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6F0F] text-primary text-sm font-bold hover:bg-[#e66000] transition"
        >
          <Plus size={15} /> 새 가게 등록
        </button>
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
          <button key={f}
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
            const col      = POLICY_COLORS[p.name] ?? DEFAULT_POLICY_COLOR;
            const isEdit   = policyEditId === p.id;
            return (
              <div key={p.id} className={`flex-1 min-w-[140px] rounded-xl border p-3 ${col.bg} ${col.border}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold ${col.text}`}>{p.name}</span>
                  {isEdit ? (
                    <div className="flex gap-1">
                      <button onClick={() => handlePolicyEdit(p.id)} disabled={savingPolicy}
                        className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-bold disabled:opacity-40">저장</button>
                      <button onClick={() => setPolicyEditId(null)}
                        className="text-[10px] p-0.5 bg-fill-subtle text-dim rounded hover:text-primary"><X size={9}/></button>
                    </div>
                  ) : (
                    <button onClick={() => { setPolicyEditId(p.id); setPolicyEditLimit(p.daily_char_limit); }}
                      className="text-dim hover:text-primary transition"><Pencil size={10}/></button>
                  )}
                </div>
                {isEdit ? (
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

      {/* 가게 목록 */}
      <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-main">
              {([
                ['name',       '가게명',     'left',   'px-5'],
                ['category',   '카테고리',   'left',   'px-4'],
                ['phone',      '연락처',     'left',   'px-4'],
                ['owner',      '사장님',     'left',   'px-4'],
                ['policy',     'TTS 정책',   'left',   'px-4'],
                ['created_at', '등록일',     'left',   'px-4'],
                ['updated_at', '최근수정일', 'left',   'px-4'],
                ['coupons',    '쿠폰',       'center', 'px-3'],
                ['status',     '상태',       'center', 'px-4'],
              ] as const).map(([col, label, align, px]) => (
                <th key={col} className={`text-${align} ${px} py-3.5`}>
                  <button
                    onClick={() => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } }}
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
                  {[...Array(10)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-fill-subtle rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filteredStores.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-dim">가게가 없어요</td></tr>
            ) : filteredStores.map(store => {
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
                            <MapPin size={10} />{store.address}
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
                          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FF6F0F]/10 text-[#FF6F0F] text-[10px] font-semibold hover:bg-[#FF6F0F]/25 transition disabled:opacity-40"
                        >
                          <ExternalLink size={10} /> 대시보드
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-dim"><User size={11} /> 미연결</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      {store.tts_policy_id ? (() => {
                        const pol = ttsPolicies.find(p => p.id === store.tts_policy_id);
                        const col = pol ? (POLICY_COLORS[pol.name] ?? DEFAULT_POLICY_COLOR) : DEFAULT_POLICY_COLOR;
                        return <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${col.bg} ${col.text} border ${col.border}`}>{pol?.name ?? '정책'}</span>;
                      })() : (
                        <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-fill-subtle text-dim border border-border-subtle">미설정</span>
                      )}
                      <select
                        value={store.tts_policy_id ?? ''}
                        disabled={policyChanging === store.id}
                        onChange={e => handlePolicyChange(store.id, e.target.value || null)}
                        className="appearance-none bg-sidebar border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-secondary outline-none cursor-pointer hover:border-[#FF6F0F]/40 transition disabled:opacity-50 max-w-[100px]"
                      >
                        <option value="">미설정</option>
                        {ttsPolicies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {store.subscription_expires_at && (() => {
                        const exp = new Date(store.subscription_expires_at);
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
                  {/* 등록일 */}
                  <td className="px-4 py-4 text-xs">
                    <p className="text-muted">{new Date(store.created_at).toLocaleDateString('ko-KR')}</p>
                    <p className="text-dim text-[10px] mt-0.5">{new Date(store.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  {/* 최근수정일 */}
                  <td className="px-4 py-4 text-xs">
                    {store.updated_at && store.updated_at !== store.created_at ? (
                      <>
                        <p className="text-secondary">{new Date(store.updated_at).toLocaleDateString('ko-KR')}</p>
                        <p className="text-dim text-[10px] mt-0.5">{new Date(store.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </>
                    ) : (
                      <span className="text-dim">-</span>
                    )}
                  </td>
                  {/* 발행 중 쿠폰 */}
                  <td className="px-3 py-4 text-center">
                    {(couponCountMap[store.id] ?? 0) > 0 ? (
                      <button
                        onClick={() => { openEdit(store); setTimeout(() => setActiveTab('coupons'), 50); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF6F0F]/15 text-[#FF6F0F] text-[11px] font-bold hover:bg-[#FF6F0F]/25 transition"
                        title="쿠폰 관리 열기"
                      >
                        🎟 {couponCountMap[store.id]}
                      </button>
                    ) : (
                      <span className="text-dim text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => toggleActive(store)}
                      disabled={toggling === store.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                      style={{ background: store.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.1)', color: store.is_active ? '#22C55E' : '#F87171' }}
                    >
                      {store.is_active ? <><ToggleRight size={14} /> 활성</> : <><ToggleLeft size={14} /> 비활성</>}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(store)}
                        className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-fill-medium transition">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { setHistoryEntries(getStoreHistory(store.id)); setHistoryStoreId(store.id); }}
                        className="p-1.5 rounded-lg text-muted hover:text-blue-400 hover:bg-blue-500/10 transition" title="수정 히스토리">
                        <History size={14} />
                      </button>
                      <button onClick={() => setDeleteId(store.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* Modal: 가게 등록 / 수정                                        */}
      {/* ============================================================ */}
      {editModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border border-border-subtle rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-main shrink-0">
              <h2 className="text-base font-bold text-primary">
                {editModal === 'new' ? '🏪 새 가게 등록' : `✏️ ${(editModal as Store).name}`}
              </h2>
              <button onClick={() => setEditModal(null)} className="text-muted hover:text-primary transition">
                <X size={18} />
              </button>
            </div>

            {/* 탭 (수정 시만) */}
            {editModal !== 'new' && (
              <div className="flex gap-0 px-6 pt-3 shrink-0 border-b border-border-main">
                {([
                  { key: 'info',    label: '🏪 가게 정보',              badge: undefined },
                  { key: 'coupons', label: '🎟 쿠폰 관리', badge: storeCoupons.length },
                ] as const).map(({ key, label, badge }) => (
                  <button key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold border-b-2 transition ${
                      activeTab === key
                        ? 'border-[#FF6F0F] text-[#FF6F0F]'
                        : 'border-transparent text-muted hover:text-primary'
                    }`}
                  >
                    {label}
                    {badge != null && badge > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#FF6F0F] text-[9px] font-bold flex items-center justify-center text-white shrink-0">
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* ===== 가게 정보 탭 ===== */}
              {activeTab === 'info' && (
                <>
                  {saveError && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                      <X size={13} className="shrink-0" />{saveError}
                    </div>
                  )}

                  {/* 자동 입력 — 네이버 검색 */}
                  <div className="bg-sidebar border border-[#03C75A]/30 rounded-2xl overflow-hidden">
                    <div className="px-3 pt-3 pb-0.5">
                      <p className="text-[10px] font-bold text-[#03C75A] mb-2">🟢 네이버 검색으로 자동 입력</p>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={naverQ}
                          onChange={e => setNaverQ(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && searchNaver()}
                          placeholder="가게명 또는 주소로 검색 (예: 진해 밀면)"
                          className="flex-1 min-w-0 bg-card border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#03C75A] transition"
                        />
                        <button
                          onClick={searchNaver}
                          disabled={naverSearching || !naverQ.trim()}
                          className="shrink-0 px-4 py-2.5 bg-[#03C75A] hover:bg-[#02b050] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                        >
                          {naverSearching ? '검색 중...' : '검색'}
                        </button>
                      </div>

                      {naverErr && (
                        <p className="text-xs text-red-400 flex items-center gap-1"><X size={11}/>{naverErr}</p>
                      )}

                      {naverResults.length > 0 && (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                          {naverResults.map((place, i) => (
                            <button
                              key={i}
                              onClick={() => applyNaverPlace(place)}
                              className="w-full text-left px-3 py-2.5 bg-card border border-border-subtle hover:border-[#03C75A]/50 hover:bg-[#03C75A]/5 rounded-xl transition group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-primary group-hover:text-[#03C75A] transition truncate">{place.place_name}</p>
                                  <p className="text-[10px] text-muted mt-0.5 truncate">{place.address}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-fill-medium text-tertiary">{place.category}</span>
                                    {place.phone && <span className="text-[9px] text-dim">{place.phone}</span>}
                                    {place.latitude && <span className="text-[9px] text-emerald-500/70">📍 좌표 포함</span>}
                                  </div>
                                </div>
                                <span className="shrink-0 text-[10px] text-[#03C75A] opacity-0 group-hover:opacity-100 transition font-bold">적용 →</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {form.latitude != null && (
                        <p className="text-xs text-emerald-500 flex items-center gap-1">
                          <MapPin size={10} /> 좌표 입력됨 ({form.latitude.toFixed(4)}, {form.longitude?.toFixed(4)})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border-main" />

                  {/* 기본 정보 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">가게명 *</label>
                      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="가게명을 입력하세요"
                        className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1">연락처</label>
                      <input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="연락처를 입력하세요"
                        className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-muted mb-1">주소</label>
                      <input value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="주소를 입력하세요"
                        className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition" />
                    </div>
                  </div>

                  {/* 카테고리 chips */}
                  <div>
                    <label className="block text-xs text-muted mb-1.5">카테고리</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {CATEGORIES.map(cat => (
                        <button key={cat}
                          onClick={() => setForm(f => ({ ...f, category: f.category === cat ? '' : cat }))}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                            form.category === cat
                              ? 'border-[#FF6F0F] bg-[#FF6F0F]/15 text-[#FF6F0F]'
                              : 'border-border-subtle bg-sidebar text-muted hover:text-primary hover:border-border-main'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <input value={form.category ?? ''}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="직접 입력"
                      className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition" />
                  </div>

                  {/* 토글 행 */}
                  <div className="flex flex-wrap gap-4 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">활성</span>
                      <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${form.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-fill-subtle text-muted'}`}>
                        {form.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {form.is_active ? '활성' : '비활성'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted flex items-center gap-1"><MapPin size={11} />쿠폰 알림</span>
                      <button onClick={() => setForm(f => ({ ...f, geo_discoverable: !f.geo_discoverable }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${form.geo_discoverable ? 'bg-blue-500/15 text-blue-400' : 'bg-fill-subtle text-muted'}`}>
                        {form.geo_discoverable ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {form.geo_discoverable ? '활성' : '비활성'}
                      </button>
                    </div>
                  </div>

                  {/* 구독 만료일 */}
                  <div>
                    <label className="block text-xs text-muted mb-1">구독 만료일</label>
                    <input type="datetime-local"
                      value={form.subscription_expires_at ? new Date(form.subscription_expires_at).toISOString().slice(0, 16) : ''}
                      onChange={e => setForm(f => ({ ...f, subscription_expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                      className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-[#FF6F0F] transition" />
                  </div>

                  {/* 가게 사진 */}
                  <div className="border-t border-border-main pt-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted mb-2">
                      <ImageIcon size={12} /> 가게 사진
                    </label>
                    {form.image_url ? (
                      <div className="flex items-start gap-3 mb-2">
                        <img src={form.image_url} alt="가게 사진" className="w-20 h-20 object-cover rounded-xl border border-border-subtle shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted break-all line-clamp-2 mb-2">{form.image_url}</p>
                          <button onClick={() => setForm(f => ({ ...f, image_url: null }))}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition">
                            <Trash2 size={11} /> 삭제
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-dim mb-2">등록된 사진이 없습니다</p>
                    )}
                    <input type="url" value={form.image_url ?? ''}
                      onChange={e => setForm(f => ({ ...f, image_url: e.target.value || null }))}
                      placeholder="https://... 이미지 URL 직접 입력"
                      className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition" />
                  </div>

                  {/* 가격 정보 */}
                  <div className="border-t border-border-main pt-3">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-[#FF6F0F] flex items-center gap-1">
                        💰 메뉴 &amp; 가격 <span className="font-normal text-dim">(⭐ 클릭 → 대표 메뉴 지정)</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => menuFileRef.current?.click()}
                        disabled={menuExtracting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 text-[11px] font-semibold transition disabled:opacity-50"
                      >
                        {menuExtracting
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> 분석 중...</>
                          : <><Camera className="w-3 h-3" /> 메뉴판 자동 입력</>}
                      </button>
                      <input ref={menuFileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { handleMenuImageExtract(f); e.target.value = ''; } }}
                      />
                    </div>

                    {menuExtractErr && (
                      <p className="text-[11px] text-red-400 flex items-center gap-1 mb-2">
                        <X className="w-3 h-3" />{menuExtractErr}
                      </p>
                    )}

                    {/* 메뉴 목록 */}
                    <div className="space-y-1.5 mb-2">
                      {formMenuItems.map((item, i) => (
                        <div key={i} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border transition ${
                          repIdx === i
                            ? 'border-amber-400/40 bg-amber-400/5'
                            : 'border-border-subtle bg-sidebar'
                        }`}>
                          {/* 대표 메뉴 별 */}
                          <button
                            type="button"
                            onClick={() => setRepIdx(repIdx === i ? null : i)}
                            title={repIdx === i ? '대표 메뉴 해제' : '대표 메뉴로 지정'}
                            className="shrink-0 p-0.5 transition"
                          >
                            <Star className={`w-3.5 h-3.5 ${repIdx === i ? 'fill-amber-400 text-amber-400' : 'text-border-subtle hover:text-amber-400'}`} />
                          </button>
                          {/* 메뉴명 */}
                          <input
                            value={item.name}
                            onChange={e => setFormMenuItems(prev => prev.map((m, j) => j === i ? { ...m, name: e.target.value } : m))}
                            placeholder="메뉴명"
                            className="flex-1 min-w-0 bg-transparent text-sm text-primary placeholder-gray-600 focus:outline-none"
                          />
                          {/* 가격 */}
                          <input
                            type="number"
                            value={item.price ?? ''}
                            onChange={e => setFormMenuItems(prev => prev.map((m, j) => j === i ? { ...m, price: e.target.value ? Number(e.target.value) : null } : m))}
                            placeholder="가격"
                            className="w-20 shrink-0 bg-transparent text-sm text-primary placeholder-gray-600 text-right focus:outline-none"
                          />
                          <span className="text-[11px] text-dim shrink-0">원</span>
                          {/* 삭제 */}
                          <button
                            type="button"
                            onClick={() => {
                              setFormMenuItems(prev => prev.filter((_, j) => j !== i));
                              setRepIdx(prev => prev === i ? null : prev != null && prev > i ? prev - 1 : prev);
                            }}
                            className="shrink-0 p-0.5 text-dim hover:text-red-400 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* 메뉴 추가 */}
                    <button
                      type="button"
                      onClick={() => setFormMenuItems(prev => [...prev, { name: '', price: null }])}
                      className="w-full py-2 rounded-xl border border-dashed border-border-subtle text-[11px] text-muted hover:text-primary hover:border-border-main flex items-center justify-center gap-1 transition mb-3"
                    >
                      <Plus className="w-3 h-3" /> 메뉴 추가
                    </button>

                    {/* 가격 프리셋 */}
                    {repIdx != null && (
                      <div className="flex gap-1.5 mb-2">
                        {PRICE_PRESETS.map(({ label, value }) => (
                          <button key={value} type="button"
                            onClick={() => setFormMenuItems(prev => prev.map((m, j) => j === repIdx ? { ...m, price: value } : m))}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition ${
                              formMenuItems[repIdx]?.price === value
                                ? 'border-[#FF6F0F] bg-[#FF6F0F]/10 text-[#FF6F0F]'
                                : 'border-border-subtle bg-sidebar text-muted hover:text-primary'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 대표 메뉴 미리보기 */}
                    {repIdx != null && formMenuItems[repIdx] && (
                      <p className="text-[10px] text-[#FF6F0F]">
                        ⭐ 대표: {formMenuItems[repIdx].name || '(이름 없음)'}
                        {formMenuItems[repIdx].price != null && (
                          <> · {formMenuItems[repIdx].price!.toLocaleString()}원
                          {' '}({formMenuItems[repIdx].price! <= 6000 ? '~6천원' : formMenuItems[repIdx].price! <= 8000 ? '~8천원' : formMenuItems[repIdx].price! <= 12000 ? '~1.2만원' : '~2만원'})</>
                        )}
                      </p>
                    )}
                  </div>

                  {/* 좌표 + 지도 */}
                  <div className="border-t border-border-main pt-3">
                    <p className="text-xs text-muted mb-2 flex items-center gap-1">
                      <MapPin size={11} /> 위치 좌표
                      <span className="text-dim">(지오펜스·지도 핀 — 핀 드래그로 조정 가능)</span>
                    </p>

                    {/* 미니 지도 */}
                    <KakaoMapPicker
                      lat={form.latitude}
                      lng={form.longitude}
                      onChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                      height="220px"
                    />

                    {/* 좌표 수동 입력 */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-[10px] text-dim mb-1 block">위도 (lat)</label>
                        <input type="number" step="0.000001"
                          value={form.latitude ?? ''}
                          onChange={e => setForm(f => ({ ...f, latitude: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="35.2279..."
                          className="w-full bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition" />
                      </div>
                      <div>
                        <label className="text-[10px] text-dim mb-1 block">경도 (lng)</label>
                        <input type="number" step="0.000001"
                          value={form.longitude ?? ''}
                          onChange={e => setForm(f => ({ ...f, longitude: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="128.6811..."
                          className="w-full bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ===== 쿠폰 관리 탭 ===== */}
              {activeTab === 'coupons' && editModal !== 'new' && (
                <div className="space-y-3">
                  {couponsLoading ? (
                    <div className="flex justify-center py-10">
                      <div className="w-6 h-6 border-2 border-white/20 border-t-[#FF6F0F] rounded-full animate-spin" />
                    </div>
                  ) : storeCoupons.length === 0 && !showCouponAdd ? (
                    <div className="text-center py-10">
                      <p className="text-4xl mb-3">🎟</p>
                      <p className="text-sm text-dim">등록된 쿠폰이 없어요</p>
                      <p className="text-xs text-muted mt-1">아래 버튼으로 첫 쿠폰을 등록하세요</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {storeCoupons.map(coupon => {
                        const exp  = expiresLabel(coupon.expires_at);
                        const tags = couponConditionTags(coupon);
                        return (
                          <div key={coupon.id} className={`bg-fill-subtle border rounded-xl px-4 py-3 flex items-center gap-3 ${coupon.is_featured ? 'border-amber-500/30' : 'border-border-main'}`}>
                            <div className="flex-1 min-w-0">
                              {/* 제목 행 */}
                              <div className="flex items-center gap-2 mb-1">
                                {coupon.is_featured && (
                                  <span className="shrink-0 text-amber-400 leading-none" title="앱 상단 노출">⭐</span>
                                )}
                                <p className="text-sm font-semibold text-primary truncate">{coupon.title}</p>
                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-[#FF6F0F]/15 text-[#FF6F0F] font-bold">
                                  {discountLabel(coupon.discount_type, coupon.discount_value, coupon.free_item_name)}
                                </span>
                              </div>
                              {/* 메타 행 */}
                              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                <span className={exp.color}>{exp.text}</span>
                                {coupon.total_quantity > 0 && (
                                  <span className="text-muted">{coupon.issued_count}/{coupon.total_quantity}매</span>
                                )}
                                {coupon.target_segment && coupon.target_segment !== 'all' && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                                    {coupon.target_segment === 'new' ? '신규' : `재방문 ${coupon.min_visit_count ?? 2}회+`}
                                  </span>
                                )}
                                {tags.map(tag => (
                                  <span key={tag} className="px-1.5 py-0.5 rounded bg-fill-medium text-tertiary">{tag}</span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => toggleCouponActive(coupon)} disabled={togglingCoupon === coupon.id}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition disabled:opacity-40 ${coupon.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-fill-medium text-muted'}`}>
                                {coupon.is_active ? '활성' : '비활성'}
                              </button>
                              <button onClick={() => startEditCoupon(coupon)}
                                className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-fill-medium transition">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleDeleteCoupon(coupon.id)} disabled={deletingCoupon === coupon.id}
                                className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showCouponAdd ? renderCouponForm() : (
                    <button
                      onClick={() => { setShowCouponAdd(true); setCouponForm({ ...EMPTY_COUPON, expires_at: defaultExpires(30) }); setEditCouponId(null); setCouponError(''); }}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-[#FF6F0F]/30 text-[#FF6F0F] text-sm font-semibold hover:bg-[#FF6F0F]/5 transition"
                    >
                      <Plus size={15} /> 새 쿠폰 추가
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 푸터 (가게 정보 탭만) */}
            {activeTab === 'info' && (
              <div className="flex gap-2 px-6 py-4 border-t border-border-main shrink-0">
                <button onClick={() => setEditModal(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition">
                  취소
                </button>
                <button onClick={saveStore} disabled={saving || !form.name.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary bg-[#FF6F0F] hover:bg-[#e66000] transition disabled:opacity-50">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: 삭제 확인 */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-bold text-primary mb-2">가게 삭제</h2>
            <p className="text-sm text-tertiary mb-6">삭제하면 복구할 수 없습니다. 쿠폰도 함께 삭제됩니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition">취소</button>
              <button onClick={() => deleteStore(deleteId)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary bg-red-500 hover:bg-red-600 transition">삭제</button>
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
              <button onClick={() => setHistoryStoreId(null)} className="text-muted hover:text-primary transition"><X size={18}/></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {historyEntries.length === 0 ? (
                <p className="text-sm text-dim text-center py-8">수정 기록이 없어요</p>
              ) : historyEntries.map((entry, i) => (
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
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
