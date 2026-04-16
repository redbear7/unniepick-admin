'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight,
  Image as ImageIcon, Link, Palette, ArrowUpDown,
  Upload, Loader2, CheckCircle,
} from 'lucide-react';

const STORAGE_BUCKET = 'banners';
const RECOMMENDED_W  = 750;
const RECOMMENDED_H  = 400;

const BANNER_TYPES: { value: string; label: string; desc: string; emoji: string }[] = [
  { value: 'home_bottom',  label: '홈 바텀모달',  desc: '홈탭 하단 팝업 캐러셀', emoji: '🏠' },
  { value: 'home_top',     label: '홈 상단 배너', desc: '홈탭 피드 최상단',       emoji: '📌' },
  { value: 'explore_top',  label: '탐색 상단',    desc: '탐색탭 목록 최상단',     emoji: '🔍' },
  { value: 'coupon_top',   label: '쿠폰함 상단',  desc: '쿠폰함탭 최상단',        emoji: '🎟' },
];

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Banner {
  id:            string;
  title:         string;
  subtitle:      string | null;
  image_url:     string | null;
  link_url:      string | null;
  bg_color:      string;
  banner_type:   string;
  is_active:     boolean;
  display_order: number;
  created_at:    string;
}

interface BannerForm {
  title:         string;
  subtitle:      string;
  image_url:     string;
  link_url:      string;
  bg_color:      string;
  banner_type:   string;
  display_order: number;
  is_active:     boolean;
}

const EMPTY_FORM: BannerForm = {
  title: '', subtitle: '', image_url: '', link_url: '',
  bg_color: '#EEF2FF', banner_type: 'home_bottom', display_order: 0, is_active: true,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/* ------------------------------------------------------------------ */
/* ImageUploader — 드래그앤드롭 + 파일 선택                              */
/* ------------------------------------------------------------------ */

function ImageUploader({
  value,
  onChange,
}: {
  value:    string;
  onChange: (url: string) => void;
}) {
  const sb          = createClient();
  const inputRef    = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgMeta,   setImgMeta]   = useState<{ w: number; h: number; size: string } | null>(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [error,     setError]     = useState('');

  // 이미 등록된 이미지 URL이 있으면 크기 측정
  useEffect(() => {
    if (!value) { setImgMeta(null); return; }
    const img = new Image();
    img.onload = () => setImgMeta(prev => ({ w: img.naturalWidth, h: img.naturalHeight, size: prev?.size ?? '' }));
    img.src = value;
  }, [value]);

  const upload = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드 가능합니다'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('파일 크기는 5MB 이하여야 합니다'); return; }

    setUploading(true);
    const sizeStr = formatBytes(file.size);

    // 실제 이미지 크기 측정
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setImgMeta({ w: img.naturalWidth, h: img.naturalHeight, size: sizeStr });
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;

    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `banner_${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      onChange(publicUrl);
    } catch (e: any) {
      setError(`업로드 실패: ${e.message} (Storage에 '${STORAGE_BUCKET}' 버킷이 있는지 확인하세요)`);
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (files: FileList | null) => {
    if (files?.[0]) upload(files[0]);
  };

  const isGoodSize = imgMeta && imgMeta.w >= RECOMMENDED_W && imgMeta.h >= RECOMMENDED_H;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted">
          <span className="inline-flex items-center gap-1"><ImageIcon size={10} /> 배너 이미지</span>
        </label>
        <span className="text-[10px] text-muted font-mono bg-fill-subtle px-2 py-0.5 rounded-md">
          권장: {RECOMMENDED_W} × {RECOMMENDED_H}px
        </span>
      </div>

      {/* 드롭존 */}
      <div
        className={`relative border-2 border-dashed rounded-xl transition cursor-pointer ${
          dragOver
            ? 'border-[#FF6F0F] bg-[#FF6F0F]/5'
            : value
            ? 'border-border-subtle'
            : 'border-border-subtle hover:border-[#FF6F0F]/50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleFile(e.target.files)}
        />

        {value ? (
          /* 이미지 미리보기 */
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="배너 미리보기"
              className="w-full h-40 object-cover rounded-xl"
            />
            {/* 오버레이 — 재업로드 */}
            <div className="absolute inset-0 rounded-xl bg-black/0 hover:bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
              <div className="flex items-center gap-2 text-white text-sm font-semibold">
                <Upload size={16} /> 이미지 교체
              </div>
            </div>
            {/* 삭제 버튼 */}
            <button
              onClick={e => { e.stopPropagation(); onChange(''); setImgMeta(null); }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition"
            >
              <X size={12} />
            </button>
          </div>
        ) : uploading ? (
          <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted">
            <Loader2 size={24} className="animate-spin text-[#FF6F0F]" />
            <p className="text-xs">업로드 중...</p>
          </div>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted">
            <Upload size={24} className="opacity-40" />
            <p className="text-xs text-center leading-relaxed">
              클릭하거나 이미지를 드래그하세요<br />
              <span className="text-[10px] text-dim">PNG, JPG, WEBP · 최대 5MB</span>
            </p>
          </div>
        )}
      </div>

      {/* 이미지 메타 정보 */}
      {imgMeta && (
        <div className="flex items-center gap-3 text-[11px]">
          <span className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-md ${
            isGoodSize
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-amber-500/10 text-amber-400'
          }`}>
            {isGoodSize ? <CheckCircle size={10} /> : '⚠'}
            {imgMeta.w} × {imgMeta.h}px
          </span>
          {imgMeta.size && (
            <span className="text-dim font-mono">{imgMeta.size}</span>
          )}
          {!isGoodSize && (
            <span className="text-amber-400/70">권장 크기보다 작습니다</span>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page                                                            */
/* ------------------------------------------------------------------ */

export default function BannersPage() {
  const sb = createClient();

  const [banners,   setBanners]   = useState<Banner[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [editModal, setEditModal] = useState<Banner | null | 'new'>(null);
  const [form,      setForm]      = useState<BannerForm>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);

  const loadBanners = async () => {
    const { data } = await sb.from('banners').select('*').order('display_order', { ascending: true });
    setBanners(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadBanners();
    const ch = sb
      .channel('banners-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, loadBanners)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (banner: Banner) => {
    setToggling(banner.id);
    await sb.from('banners').update({ is_active: !banner.is_active }).eq('id', banner.id);
    setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: !b.is_active } : b));
    setToggling(null);
  };

  const openNew = () => {
    setForm({ ...EMPTY_FORM, display_order: banners.length });
    setEditModal('new');
  };

  const openEdit = (banner: Banner) => {
    setForm({
      title: banner.title, subtitle: banner.subtitle ?? '',
      image_url: banner.image_url ?? '', link_url: banner.link_url ?? '',
      bg_color: banner.bg_color ?? '#EEF2FF',
      banner_type: banner.banner_type ?? 'home_bottom',
      display_order: banner.display_order, is_active: banner.is_active,
    });
    setEditModal(banner);
  };

  const saveBanner = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title:         form.title.trim(),
      subtitle:      form.subtitle.trim()  || null,
      image_url:     form.image_url.trim() || null,
      link_url:      form.link_url.trim()  || null,
      bg_color:      form.bg_color || '#EEF2FF',
      banner_type:   form.banner_type || 'home_bottom',
      display_order: form.display_order,
      is_active:     form.is_active,
      updated_at:    new Date().toISOString(),
    };
    if (editModal === 'new') {
      await sb.from('banners').insert(payload);
    } else if (editModal) {
      await sb.from('banners').update(payload).eq('id', (editModal as Banner).id);
    }
    await loadBanners();
    setEditModal(null);
    setSaving(false);
  };

  const deleteBanner = async (id: string) => {
    await sb.from('banners').delete().eq('id', id);
    setBanners(prev => prev.filter(b => b.id !== id));
    setDeleteId(null);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">배너 관리</h1>
          <p className="text-sm text-muted mt-1">
            전체 {banners.length}개 · 활성 {banners.filter(b => b.is_active).length}개
            <span className="ml-2 font-mono text-dim text-[11px]">
              권장 이미지: {RECOMMENDED_W}×{RECOMMENDED_H}px
            </span>
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] hover:bg-[#e66000] text-white text-sm font-semibold rounded-xl transition"
        >
          <Plus size={15} /> 배너 추가
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-main">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted">
                <span className="inline-flex items-center gap-1"><ArrowUpDown size={11} /> 순서</span>
              </th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">종류(위치)</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">제목 / 부제목</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">이미지</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">배경색</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">링크</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">등록일</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-muted">상태</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-muted">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-border-main">
                  {[...Array(9)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-fill-subtle rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : banners.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-dim">등록된 배너가 없어요</td>
              </tr>
            ) : (
              banners.map(banner => (
                <tr key={banner.id} className="border-b border-border-main hover:bg-white/[0.02] transition">
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-fill-subtle text-xs font-bold text-tertiary">
                      {banner.display_order}
                    </span>
                  </td>
                  {/* 종류(위치) */}
                  <td className="px-4 py-4">
                    {(() => {
                      const t = BANNER_TYPES.find(x => x.value === (banner.banner_type ?? 'home_bottom'));
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-fill-subtle text-xs font-semibold text-secondary whitespace-nowrap">
                          {t?.emoji} {t?.label ?? banner.banner_type}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4 max-w-[200px]">
                    <p className="font-semibold text-primary truncate">{banner.title}</p>
                    {banner.subtitle && <p className="text-xs text-muted mt-0.5 truncate">{banner.subtitle}</p>}
                  </td>

                  {/* 이미지 썸네일 + 사이즈 */}
                  <td className="px-4 py-4">
                    {banner.image_url ? (
                      <a href={banner.image_url} target="_blank" rel="noreferrer" className="block group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={banner.image_url}
                          alt="banner"
                          className="w-20 h-11 object-cover rounded-lg border border-white/10 group-hover:opacity-80 transition"
                        />
                        <ImageSizeTag src={banner.image_url} />
                      </a>
                    ) : (
                      <div className="w-20 h-11 rounded-lg bg-fill-subtle border border-border-subtle flex items-center justify-center">
                        <ImageIcon size={14} className="text-dim" />
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md border border-white/10 shrink-0" style={{ backgroundColor: banner.bg_color }} />
                      <span className="text-xs text-muted font-mono">{banner.bg_color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 max-w-[140px]">
                    {banner.link_url ? (
                      <a href={banner.link_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#FF6F0F] hover:text-[#e66000] transition truncate max-w-full">
                        <Link size={11} /><span className="truncate">{banner.link_url}</span>
                      </a>
                    ) : <span className="text-dim text-xs">-</span>}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <p className="text-muted">{new Date(banner.created_at).toLocaleDateString('ko-KR')}</p>
                    <p className="text-dim text-[10px] mt-0.5">
                      {new Date(banner.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => toggleActive(banner)}
                      disabled={toggling === banner.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                      style={{
                        background: banner.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.1)',
                        color:      banner.is_active ? '#22C55E' : '#F87171',
                      }}
                    >
                      {banner.is_active ? <><ToggleRight size={14} />활성</> : <><ToggleLeft size={14} />비활성</>}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(banner)} className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-fill-medium transition">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteId(banner.id)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition">
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

      {/* ── 추가/수정 모달 ── */}
      {editModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border border-border-subtle rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 sticky top-0 bg-card border-b border-border-subtle z-10">
              <h2 className="text-base font-bold text-primary">
                {editModal === 'new' ? '배너 추가' : '배너 수정'}
              </h2>
              <button onClick={() => setEditModal(null)} className="text-muted hover:text-primary transition">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 배너 종류(위치) 선택 */}
              <div>
                <label className="block text-xs text-muted mb-2">배너 위치 *</label>
                <div className="grid grid-cols-2 gap-2">
                  {BANNER_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, banner_type: t.value }))}
                      className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-left transition ${
                        form.banner_type === t.value
                          ? 'border-[#FF6F0F] bg-[#FF6F0F]/10'
                          : 'border-border-subtle hover:border-border-main bg-sidebar'
                      }`}
                    >
                      <span className="text-base mt-0.5">{t.emoji}</span>
                      <div>
                        <p className={`text-xs font-bold ${form.banner_type === t.value ? 'text-[#FF6F0F]' : 'text-primary'}`}>
                          {t.label}
                        </p>
                        <p className="text-[10px] text-dim mt-0.5">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 업로드 */}
              <ImageUploader
                value={form.image_url}
                onChange={url => setForm(f => ({ ...f, image_url: url }))}
              />

              {/* 제목 */}
              <div>
                <label className="block text-xs text-muted mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="배너 제목을 입력하세요"
                  className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                />
              </div>

              {/* 부제목 */}
              <div>
                <label className="block text-xs text-muted mb-1">부제목</label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                  placeholder="간단한 설명 (선택)"
                  className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                />
              </div>

              {/* 링크 URL */}
              <div>
                <label className="block text-xs text-muted mb-1">
                  <span className="inline-flex items-center gap-1"><Link size={10} /> 링크 URL</span>
                </label>
                <input
                  type="text"
                  value={form.link_url}
                  onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                  placeholder="https://... (선택)"
                  className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                />
              </div>

              {/* 배경색 + 순서 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">
                    <span className="inline-flex items-center gap-1"><Palette size={10} /> 배경색</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.bg_color}
                      onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-border-subtle bg-sidebar cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={form.bg_color}
                      onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))}
                      className="flex-1 bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary font-mono focus:outline-none focus:border-[#FF6F0F] transition"
                    />
                  </div>
                </div>
                <div className="w-28">
                  <label className="block text-xs text-muted mb-1">표시 순서</label>
                  <input
                    type="number" min={0}
                    value={form.display_order}
                    onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))}
                    className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-[#FF6F0F] transition"
                  />
                </div>
              </div>

              {/* 미리보기 */}
              <div className="rounded-xl overflow-hidden border border-white/10" style={{ backgroundColor: form.bg_color }}>
                {form.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image_url} alt="preview" className="w-full h-32 object-cover" />
                )}
                <div className="p-4">
                  <p className="text-sm font-bold text-gray-800">{form.title || '제목 미리보기'}</p>
                  {form.subtitle && <p className="text-xs text-gray-600 mt-0.5">{form.subtitle}</p>}
                </div>
              </div>

              {/* 활성 상태 */}
              <div className="flex items-center gap-3">
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

            <div className="flex gap-2 px-6 py-4 border-t border-border-subtle sticky bottom-0 bg-card">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition"
              >
                취소
              </button>
              <button
                onClick={saveBanner}
                disabled={saving || !form.title.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#FF6F0F] hover:bg-[#e66000] transition disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-bold text-primary mb-2">배너 삭제</h2>
            <p className="text-sm text-tertiary mb-6">삭제하면 복구할 수 없습니다. 정말 삭제하시겠어요?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition">
                취소
              </button>
              <button onClick={() => deleteBanner(deleteId)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 테이블 이미지 사이즈 태그 (lazy)                                       */
/* ------------------------------------------------------------------ */
function ImageSizeTag({ src }: { src: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);
  if (!size) return null;
  const ok = size.w >= RECOMMENDED_W && size.h >= RECOMMENDED_H;
  return (
    <span className={`inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
      ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
    }`}>
      {size.w}×{size.h}
    </span>
  );
}
