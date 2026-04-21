'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  ArrowLeft, Save, Loader2, Check, ExternalLink,
  MapPin, Phone, Globe, Store, Camera, Link2,
} from 'lucide-react';
import Link from 'next/link';

interface RestaurantRow {
  id: string;
  naver_place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  image_url: string | null;
  naver_place_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  business_hours: string | null;
  visitor_review_count: number;
  review_count: number;
  menu_items: string; // JSON
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
}

export default function RestaurantRegisterPage() {
  const params = useSearchParams();
  const naverPlaceId = params.get('naver_place_id') ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // 폼 필드
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [naverUrl, setNaverUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  // 사진 업로드
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputVal, setUrlInputVal] = useState('');

  // 원본 row
  const [row, setRow] = useState<RestaurantRow | null>(null);

  useEffect(() => {
    if (!naverPlaceId) {
      setError('naver_place_id가 없습니다');
      setLoading(false);
      return;
    }
    fetchData();
  }, [naverPlaceId]);

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('restaurants')
      .select('*')
      .eq('naver_place_id', naverPlaceId)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setRow(data);
    setName(data.name ?? '');
    setCategory(data.category ?? '');
    setAddress(data.address ?? '');
    setPhone(data.phone ?? '');
    setImageUrl(data.image_url ?? '');
    setNaverUrl(data.naver_place_url ?? '');
    setWebsiteUrl(data.website_url ?? '');
    setInstagramUrl(data.instagram_url ?? '');
    setIsActive(data.is_active ?? true);
    setLoading(false);
  }

  // ── 파일 업로드 ──────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !naverPlaceId) return;

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${naverPlaceId}/${Date.now()}.${ext}`;

    setUploading(true);
    setError('');
    const supabase = createClient();

    const { error: upErr } = await supabase.storage
      .from('store-images')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setError(`이미지 업로드 실패: ${upErr.message}`);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('store-images')
      .getPublicUrl(path);

    setImageUrl(publicUrl);
    setUploading(false);
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function applyUrlInput() {
    if (urlInputVal.trim()) {
      setImageUrl(urlInputVal.trim());
    }
    setShowUrlInput(false);
    setUrlInputVal('');
  }

  async function handleSave() {
    if (!row) return;
    setSaving(true);
    setError('');

    // 1) restaurants 테이블 업데이트 — service role API 경유 (RLS 우회)
    const restRes = await fetch('/api/restaurants/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:              row.id,
        name,
        category,
        address,
        phone,
        image_url:       imageUrl || null,
        naver_place_url: naverUrl || null,
        website_url:     websiteUrl || null,
        instagram_url:   instagramUrl || null,
        latitude:        row.latitude  ?? null,
        longitude:       row.longitude ?? null,
        is_active:       isActive,
      }),
    });

    if (!restRes.ok) {
      const d = await restRes.json().catch(() => ({}));
      setError(`restaurants 저장 실패: ${d.error ?? restRes.statusText}`);
      setSaving(false);
      return;
    }

    // 2) stores 테이블 upsert — service role API 경유 (RLS 우회)
    const storeRes = await fetch('/api/admin/stores/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        category,
        address,
        phone,
        image_url:       imageUrl || null,
        naver_place_id:  naverPlaceId,
        naver_place_url: naverUrl || null,
        naver_thumbnail: imageUrl || null,
        instagram_url:   instagramUrl || null,
        latitude:        row.latitude  ?? null,
        longitude:       row.longitude ?? null,
        review_count:    row.visitor_review_count ?? 0,
        is_active:       isActive,
        is_closed:       false,
      }),
    });

    if (!storeRes.ok) {
      const d = await storeRes.json().catch(() => ({}));
      setError(`stores 저장 실패: ${d.error ?? storeRes.statusText}`);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  }

  // ── 렌더 ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Store className="w-12 h-12 text-muted mx-auto mb-4" />
        <p className="text-primary font-semibold mb-2">크롤링 데이터를 찾을 수 없습니다</p>
        <p className="text-sm text-muted mb-6">
          naver_place_id <code className="bg-fill-subtle px-1 rounded">{naverPlaceId}</code> 에 해당하는 업체가 없습니다.
          먼저 단일 업체 크롤링을 실행해 주세요.
        </p>
        <Link
          href="/dashboard/restaurants/keywords"
          className="inline-flex items-center gap-1.5 text-sm text-[#FF6F0F] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          크롤링 키워드 페이지로
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/restaurants/keywords"
          className="p-2 rounded-lg text-muted hover:bg-fill-subtle transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-primary">가게 등록</h1>
          <p className="text-sm text-muted mt-0.5">크롤링 데이터를 확인하고 저장합니다</p>
        </div>
      </div>

      {/* 썸네일 — 정사각형 + 교체 버튼 */}
      <div className="mb-6">
        {/* hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-fill-subtle border border-border-main">
          {/* 이미지 or 빈 상태 */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted">
              <Camera className="w-10 h-10 opacity-30" />
              <span className="text-sm">사진 없음</span>
            </div>
          )}

          {/* 오버레이: 업로드 중 */}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* 오버레이: 교체 버튼들 (업로드 중 아닐 때) */}
          {!uploading && (
            <div className="absolute bottom-3 right-3 flex gap-2">
              {/* 파일 선택 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/75 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                이미지 교체
              </button>
              {/* URL 입력 */}
              <button
                type="button"
                onClick={() => { setUrlInputVal(imageUrl); setShowUrlInput(v => !v); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/75 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                URL
              </button>
            </div>
          )}
        </div>

        {/* URL 입력 패널 */}
        {showUrlInput && (
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={urlInputVal}
              onChange={(e) => setUrlInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyUrlInput()}
              placeholder="https://..."
              className="flex-1 px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
            />
            <button
              type="button"
              onClick={applyUrlInput}
              className="px-3 py-2 bg-[#FF6F0F] hover:bg-[#e85e00] text-white text-sm font-medium rounded-lg transition-colors"
            >
              적용
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput(false)}
              className="px-3 py-2 text-sm text-muted hover:text-secondary transition-colors"
            >
              취소
            </button>
          </div>
        )}
      </div>

      {/* 폼 */}
      <div className="space-y-5">

        {/* 기본 정보 */}
        <section className="bg-card border border-border-main rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-primary border-b border-border pb-2">기본 정보</h2>

          <Field label="가게명 *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
              placeholder="가게 이름"
            />
          </Field>

          <Field label="카테고리">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
              placeholder="예: 한식, 카페"
            />
          </Field>

          <Field label="주소" icon={<MapPin className="w-3.5 h-3.5" />}>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
              placeholder="도로명 주소"
            />
          </Field>

          <Field label="전화번호" icon={<Phone className="w-3.5 h-3.5" />}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
              placeholder="010-0000-0000"
            />
          </Field>
        </section>

        {/* 링크 정보 */}
        <section className="bg-card border border-border-main rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-primary border-b border-border pb-2">링크</h2>

          <Field label="홈페이지" icon={<Globe className="w-3.5 h-3.5" />}>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
              placeholder="https://"
            />
          </Field>

          <Field label="인스타그램" icon={<Globe className="w-3.5 h-3.5" />}>
            <input
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              className="w-full px-3 py-2 bg-fill-subtle border border-border-subtle rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
              placeholder="https://instagram.com/..."
            />
          </Field>
        </section>

        {/* 네이버 플레이스 */}
        <section className="bg-card border border-border-main rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-primary border-b border-border pb-2">네이버 연동</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">네이버 플레이스 ID</span>
            <span className="text-secondary font-mono text-xs">{naverPlaceId}</span>
          </div>
          {naverUrl && (
            <a
              href={naverUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#FF6F0F] hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              네이버 플레이스에서 보기
            </a>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm text-secondary">앱 노출</label>
            <button
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isActive ? 'bg-[#FF6F0F]' : 'bg-fill-subtle'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-xs text-muted">{isActive ? '노출' : '숨김'}</span>
          </div>
        </section>

        {/* 에러 */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* 저장 버튼 */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/restaurants/keywords"
            className="px-4 py-2 text-sm text-muted hover:text-secondary transition-colors"
          >
            취소
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="px-5 py-2 bg-[#FF6F0F] hover:bg-[#e85e00] disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
            ) : saved ? (
              <><Check className="w-4 h-4" /> 저장됨</>
            ) : (
              <><Save className="w-4 h-4" /> 저장</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 필드 래퍼 ─────────────────────────────────────────────────
function Field({
  label, icon, children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-muted mb-1.5">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
