'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight,
  Image as ImageIcon, Link, Palette, ArrowUpDown,
} from 'lucide-react';

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
  display_order: number;
  is_active:     boolean;
}

const EMPTY_FORM: BannerForm = {
  title:         '',
  subtitle:      '',
  image_url:     '',
  link_url:      '',
  bg_color:      '#EEF2FF',
  display_order: 0,
  is_active:     true,
};

/* ------------------------------------------------------------------ */
/* Component                                                            */
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

  /* ---------------------------------------------------------------- */
  /* Data loader                                                        */
  /* ---------------------------------------------------------------- */

  const loadBanners = async () => {
    const { data, error } = await sb
      .from('banners')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) console.error('[loadBanners]', error.message);
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

  /* ---------------------------------------------------------------- */
  /* Actions                                                            */
  /* ---------------------------------------------------------------- */

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
      title:         banner.title,
      subtitle:      banner.subtitle ?? '',
      image_url:     banner.image_url ?? '',
      link_url:      banner.link_url ?? '',
      bg_color:      banner.bg_color ?? '#EEF2FF',
      display_order: banner.display_order,
      is_active:     banner.is_active,
    });
    setEditModal(banner);
  };

  const saveBanner = async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      title:         form.title.trim(),
      subtitle:      form.subtitle.trim()   || null,
      image_url:     form.image_url.trim()  || null,
      link_url:      form.link_url.trim()   || null,
      bg_color:      form.bg_color          || '#EEF2FF',
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

  /* ---------------------------------------------------------------- */
  /* Render                                                             */
  /* ---------------------------------------------------------------- */

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">배너 관리</h1>
          <p className="text-sm text-muted mt-1">
            전체 {banners.length}개 배너 · 활성 {banners.filter(b => b.is_active).length}개
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] hover:bg-[#e66000] text-primary text-sm font-semibold rounded-xl transition"
        >
          <Plus size={15} /> 배너 추가
        </button>
      </div>

      {/* Banner table */}
      <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-main">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted">
                <span className="inline-flex items-center gap-1"><ArrowUpDown size={11} /> 순서</span>
              </th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">제목 / 부제목</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">배경색</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted">이미지</th>
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
                  {[...Array(8)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-fill-subtle rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : banners.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-dim">
                  등록된 배너가 없어요
                </td>
              </tr>
            ) : (
              banners.map(banner => (
                <tr key={banner.id} className="border-b border-border-main hover:bg-white/[0.02] transition">
                  {/* 순서 */}
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-fill-subtle text-xs font-bold text-tertiary">
                      {banner.display_order}
                    </span>
                  </td>

                  {/* 제목 / 부제목 */}
                  <td className="px-4 py-4 max-w-[220px]">
                    <p className="font-semibold text-primary truncate">{banner.title}</p>
                    {banner.subtitle && (
                      <p className="text-xs text-muted mt-0.5 truncate">{banner.subtitle}</p>
                    )}
                  </td>

                  {/* 배경색 */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-md border border-white/10 shrink-0"
                        style={{ backgroundColor: banner.bg_color }}
                      />
                      <span className="text-xs text-muted font-mono">{banner.bg_color}</span>
                    </div>
                  </td>

                  {/* 이미지 */}
                  <td className="px-4 py-4">
                    {banner.image_url ? (
                      <a
                        href={banner.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                      >
                        <ImageIcon size={12} /> 보기
                      </a>
                    ) : (
                      <span className="text-dim text-xs">-</span>
                    )}
                  </td>

                  {/* 링크 */}
                  <td className="px-4 py-4 max-w-[160px]">
                    {banner.link_url ? (
                      <a
                        href={banner.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#FF6F0F] hover:text-[#e66000] transition truncate"
                      >
                        <Link size={11} />
                        <span className="truncate">{banner.link_url}</span>
                      </a>
                    ) : (
                      <span className="text-dim text-xs">-</span>
                    )}
                  </td>

                  {/* 등록일 */}
                  <td className="px-4 py-4 text-xs">
                    <p className="text-muted">{new Date(banner.created_at).toLocaleDateString('ko-KR')}</p>
                    <p className="text-dim text-[10px] mt-0.5">
                      {new Date(banner.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>

                  {/* 상태 토글 */}
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
                      {banner.is_active
                        ? <><ToggleRight size={14} /> 활성</>
                        : <><ToggleLeft  size={14} /> 비활성</>}
                    </button>
                  </td>

                  {/* 관리 버튼 */}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(banner)}
                        className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-fill-medium transition"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(banner.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
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

      {/* ============================================================ */}
      {/* Modal: 배너 추가 / 수정                                        */}
      {/* ============================================================ */}
      {editModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-primary">
                {editModal === 'new' ? '배너 추가' : '배너 수정'}
              </h2>
              <button onClick={() => setEditModal(null)} className="text-muted hover:text-primary transition">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
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

              {/* 이미지 URL */}
              <div>
                <label className="block text-xs text-muted mb-1">
                  <span className="inline-flex items-center gap-1"><ImageIcon size={10} /> 이미지 URL</span>
                </label>
                <input
                  type="text"
                  value={form.image_url}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://... (선택)"
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

              {/* 배경색 + 순서 (가로 배치) */}
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
                      placeholder="#EEF2FF"
                      className="flex-1 bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary font-mono placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                    />
                  </div>
                </div>
                <div className="w-28">
                  <label className="block text-xs text-muted mb-1">표시 순서</label>
                  <input
                    type="number"
                    min={0}
                    value={form.display_order}
                    onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))}
                    className="w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-[#FF6F0F] transition"
                  />
                </div>
              </div>

              {/* 배경색 미리보기 */}
              <div
                className="rounded-xl p-4 border border-white/10"
                style={{ backgroundColor: form.bg_color }}
              >
                <p className="text-sm font-bold text-gray-800">{form.title || '제목 미리보기'}</p>
                {form.subtitle && <p className="text-xs text-gray-600 mt-0.5">{form.subtitle}</p>}
              </div>

              {/* 활성 상태 */}
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
                onClick={saveBanner}
                disabled={saving || !form.title.trim()}
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
            <h2 className="text-base font-bold text-primary mb-2">배너 삭제</h2>
            <p className="text-sm text-tertiary mb-6">삭제하면 복구할 수 없습니다. 정말 삭제하시겠어요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition"
              >
                취소
              </button>
              <button
                onClick={() => deleteBanner(deleteId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary bg-red-500 hover:bg-red-600 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
