'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useOwnerSession } from '@/components/OwnerShell';
import {
  Store, MapPin, Phone, Tag, Check, Loader2, AlertCircle, Camera, Banknote,
} from 'lucide-react';

interface StoreForm {
  name:                 string;
  address:              string;
  phone:                string;
  category:             string;
  image_url:            string;
  representative_price: string;   // 입력은 문자열로 받아 저장 시 숫자 변환
  price_label:          string;
}

// 가격대 프리셋
const PRICE_PRESETS = [
  { label: '~6,000원', value: 5500, hint: '런치 5,500원~' },
  { label: '~8,000원', value: 7500, hint: '런치 7,500원~' },
  { label: '~12,000원', value: 10000, hint: '메뉴 10,000원~' },
  { label: '~20,000원', value: 15000, hint: '코스 15,000원~' },
];

const CATEGORIES = [
  '한식', '중식', '일식', '양식', '분식', '카페', '베이커리',
  '치킨', '피자', '패스트푸드', '해산물', '고깃집', '술집', '기타',
];

export default function OwnerStorePage() {
  const { session } = useOwnerSession();
  const EMPTY_FORM: StoreForm = { name: '', address: '', phone: '', category: '', image_url: '', representative_price: '', price_label: '' };
  const [storeId,  setStoreId]  = useState<string | null>(null);
  const [form,     setForm]     = useState<StoreForm>(EMPTY_FORM);
  const [original, setOriginal] = useState<StoreForm>(EMPTY_FORM);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!session) return;
    const sb = createClient();
    sb.from('stores')
      .select('id, name, address, phone, category, image_url, representative_price, price_label')
      .eq('owner_id', session.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const f: StoreForm = {
            name:                 data.name      || '',
            address:              data.address   || '',
            phone:                data.phone     || '',
            category:             data.category  || '',
            image_url:            data.image_url || '',
            representative_price: data.representative_price != null ? String(data.representative_price) : '',
            price_label:          data.price_label || '',
          };
          setForm(f);
          setOriginal(f);
          setStoreId(data.id);
        }
        setLoading(false);
      });
  }, [session]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(original);

  const handleSave = async () => {
    if (!storeId || !form.name.trim()) return;
    setSaving(true);
    setError('');

    // service role API 경유 — RLS 우회
    const res = await fetch('/api/owner/store', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id:             storeId,
        owner_user_id:        session!.user_id,
        name:                 form.name.trim(),
        address:              form.address.trim()   || null,
        phone:                form.phone.trim()     || null,
        category:             form.category.trim()  || null,
        image_url:            form.image_url.trim() || null,
        representative_price: form.representative_price ? Number(form.representative_price.replace(/,/g, '')) : null,
        price_label:          form.price_label.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || '저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } else {
      setOriginal({ ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const field = (key: keyof StoreForm, v: string) =>
    setForm(f => ({ ...f, [key]: v }));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#FF6F0F]" />
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-muted">
        <Store size={32} className="text-muted/30" />
        <p className="text-sm">연결된 매장이 없습니다.</p>
        <p className="text-xs text-dim">관리자에게 문의해주세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-primary">가게 정보</h1>
          <p className="text-xs text-muted mt-0.5">매장 기본 정보를 수정할 수 있습니다.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving || !form.name.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-40
            bg-[#FF6F0F] text-white hover:bg-[#e56500] disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : saved ? (
            <Check size={15} />
          ) : null}
          {saved ? '저장됨' : '저장'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg space-y-5">

          {/* 오류 */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          {/* 썸네일 미리보기 */}
          {form.image_url && (
            <div className="flex items-center gap-4 p-4 bg-card border border-border-main rounded-xl">
              <img
                src={form.image_url}
                alt="매장 이미지"
                className="w-16 h-16 rounded-xl object-cover border border-border-main"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <p className="text-xs text-muted">등록된 매장 이미지</p>
                <p className="text-[10px] text-dim mt-0.5 break-all line-clamp-1">{form.image_url}</p>
              </div>
            </div>
          )}

          {/* 가게명 */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-tertiary mb-1.5">
              <Store size={13} /> 가게명 <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => field('name', e.target.value)}
              placeholder="가게 이름을 입력하세요"
              className="w-full px-3 py-2.5 text-sm bg-card border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
            />
          </div>

          {/* 업종 */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-tertiary mb-1.5">
              <Tag size={13} /> 업종
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => field('category', form.category === cat ? '' : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    form.category === cat
                      ? 'bg-[#FF6F0F] text-white border-[#FF6F0F]'
                      : 'bg-card text-tertiary border-border-main hover:border-[#FF6F0F]/50 hover:text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* 직접 입력 */}
            {form.category && !CATEGORIES.includes(form.category) && (
              <p className="text-xs text-[#FF6F0F] mt-2">현재: {form.category}</p>
            )}
            <input
              value={CATEGORIES.includes(form.category) ? '' : form.category}
              onChange={e => field('category', e.target.value)}
              placeholder="목록에 없으면 직접 입력"
              className="w-full mt-2 px-3 py-2 text-sm bg-card border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
            />
          </div>

          {/* 주소 */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-tertiary mb-1.5">
              <MapPin size={13} /> 주소
            </label>
            <input
              value={form.address}
              onChange={e => field('address', e.target.value)}
              placeholder="예) 서울시 강남구 테헤란로 123"
              className="w-full px-3 py-2.5 text-sm bg-card border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
            />
            <p className="text-[10px] text-dim mt-1.5">
              📍 주소를 등록하면 대시보드에서 매장 위치 기준 날씨를 확인할 수 있어요.
            </p>
          </div>

          {/* 전화번호 */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-tertiary mb-1.5">
              <Phone size={13} /> 전화번호
            </label>
            <input
              value={form.phone}
              onChange={e => field('phone', e.target.value)}
              placeholder="예) 02-1234-5678"
              className="w-full px-3 py-2.5 text-sm bg-card border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
            />
          </div>

          {/* ── 가격 정보 (거지맵 벤치마킹) ── */}
          <div className="border border-border-main rounded-xl p-4 space-y-4 bg-card">
            <div className="flex items-center gap-2">
              <Banknote size={15} className="text-[#FF6F0F]" />
              <p className="text-sm font-bold text-primary">가격 정보</p>
              <span className="ml-auto text-[10px] text-dim bg-fill-subtle px-2 py-0.5 rounded-full">
                지도 핀 · 가성비 픽 노출
              </span>
            </div>

            {/* 프리셋 빠른 선택 */}
            <div>
              <p className="text-xs text-muted mb-2">빠른 선택</p>
              <div className="flex flex-wrap gap-2">
                {PRICE_PRESETS.map(p => {
                  const active = form.representative_price === String(p.value);
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        representative_price: active ? '' : String(p.value),
                        price_label: active ? '' : (f.price_label || p.hint),
                      }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        active
                          ? 'bg-[#FF6F0F] text-white border-[#FF6F0F]'
                          : 'bg-card text-tertiary border-border-main hover:border-[#FF6F0F]/60'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 대표 메뉴 가격 직접 입력 */}
            <div>
              <label className="text-xs font-semibold text-tertiary mb-1.5 block">
                대표 메뉴 가격 (원)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.representative_price}
                  onChange={e => setForm(f => ({ ...f, representative_price: e.target.value }))}
                  placeholder="예) 8000"
                  min={0}
                  className="w-full px-3 py-2.5 pr-10 text-sm bg-[#18191c] border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">원</span>
              </div>
              {form.representative_price && (
                <p className="text-[10px] text-[#FF6F0F] mt-1">
                  💰 지도에 표시: {Number(form.representative_price).toLocaleString()}원~
                </p>
              )}
            </div>

            {/* 가격 라벨 (선택) */}
            <div>
              <label className="text-xs font-semibold text-tertiary mb-1.5 block">
                가격 설명 <span className="text-dim font-normal">(선택 · 지도 핀에 표시)</span>
              </label>
              <input
                value={form.price_label}
                onChange={e => setForm(f => ({ ...f, price_label: e.target.value }))}
                placeholder="예) 런치 7,000원~ / 커피 4,500원~"
                className="w-full px-3 py-2.5 text-sm bg-[#18191c] border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
              />
              <p className="text-[10px] text-dim mt-1">
                입력하지 않으면 &quot;{form.representative_price ? `${Number(form.representative_price).toLocaleString()}원~` : '8,000원~'}&quot; 형태로 자동 표시돼요.
              </p>
            </div>
          </div>

          {/* 이미지 URL */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-tertiary mb-1.5">
              <Camera size={13} /> 대표 이미지 URL
            </label>
            <input
              value={form.image_url}
              onChange={e => field('image_url', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 text-sm bg-card border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
            />
          </div>

          {/* 저장 버튼 (하단 고정용) */}
          {isDirty && (
            <div className="pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-[#FF6F0F] text-white hover:bg-[#e56500] transition disabled:opacity-40"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saved ? '✓ 저장됨' : '변경사항 저장'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
