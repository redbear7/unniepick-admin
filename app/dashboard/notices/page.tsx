'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Pin, Trash2, Pencil, PlusCircle, ImagePlus, X,
  Heart, Check, AlertTriangle, Megaphone, MessageCircle, Eye, EyeOff,
} from 'lucide-react';

interface Notice {
  id: string;
  author_name: string;
  author_emoji: string;
  content: string;
  image_url: string | null;
  notice_type: 'general' | 'important' | 'event';
  is_pinned: boolean;
  is_active: boolean;
  like_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

const TYPE_META: Record<Notice['notice_type'], { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  general:   { label: '일반',  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   Icon: MessageCircle },
  important: { label: '중요',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',    Icon: AlertTriangle },
  event:     { label: '이벤트', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', Icon: Megaphone },
};

const AUTHOR_EMOJIS = ['🍖', '🎵', '🎸', '🌟', '📢', '💡', '🔥', '🎉'];

function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function NoticesPage() {
  const [notices, setNotices]       = useState<Notice[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);

  // 폼
  const [content,     setContent]     = useState('');
  const [imageUrl,    setImageUrl]    = useState('');
  const [noticeType,  setNoticeType]  = useState<Notice['notice_type']>('general');
  const [isPinned,    setIsPinned]    = useState(false);
  const [authorName,  setAuthorName]  = useState('관리자');
  const [authorEmoji, setAuthorEmoji] = useState('🍖');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/notices?admin=1');
    if (res.ok) setNotices(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  const resetForm = () => {
    setContent(''); setImageUrl(''); setNoticeType('general');
    setIsPinned(false); setAuthorName('관리자'); setAuthorEmoji('🍖');
    setEditingId(null);
  };

  const startEdit = (n: Notice) => {
    setContent(n.content);
    setImageUrl(n.image_url ?? '');
    setNoticeType(n.notice_type);
    setIsPinned(n.is_pinned);
    setAuthorName(n.author_name);
    setAuthorEmoji(n.author_emoji);
    setEditingId(n.id);
    textareaRef.current?.focus();
  };

  const submit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    const body = {
      author_name: authorName, author_emoji: authorEmoji,
      content, image_url: imageUrl || null,
      notice_type: noticeType, is_pinned: isPinned,
    };
    if (editingId) {
      await fetch(`/api/notices/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch('/api/notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    resetForm();
    await load();
    setSubmitting(false);
  };

  const patch = async (id: string, fields: Partial<Notice>) => {
    await fetch(`/api/notices/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('공지사항을 삭제할까요?')) return;
    await fetch(`/api/notices/${id}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    load();
  };

  const activeCount  = notices.filter(n => n.is_active).length;
  const hiddenCount  = notices.filter(n => !n.is_active).length;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold text-primary">공지사항 관리</h1>
          <p className="text-xs text-muted mt-0.5">사장님 대시보드에 스레드 형식으로 노출됩니다</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-dim">
          <span className="flex items-center gap-1"><Eye size={12} className="text-green-400" /> {activeCount}개 노출</span>
          <span className="flex items-center gap-1"><EyeOff size={12} className="text-dim" /> {hiddenCount}개 숨김</span>
        </div>
      </div>

      {/* ── 2단 레이아웃 ── */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── 왼쪽: 글쓰기 ── */}
        <div className="w-96 shrink-0 border-r border-border-main overflow-y-auto p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            {editingId ? '공지 수정' : '새 공지 작성'}
          </p>

          <div className="bg-card border border-border-main rounded-2xl overflow-hidden">
            {/* 컴포저 헤더 */}
            <div className="px-4 py-3 border-b border-border-main flex items-center gap-2">
              <span className="text-base">{authorEmoji}</span>
              <span className="text-sm font-semibold text-primary flex-1 truncate">{authorName || '관리자'}</span>
              {editingId && (
                <button onClick={resetForm} className="text-dim hover:text-secondary text-xs flex items-center gap-1 shrink-0">
                  <X size={12} /> 취소
                </button>
              )}
            </div>

            {/* 저자 */}
            <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
              <input
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="작성자 이름"
                className="text-xs px-2 py-1 rounded-lg bg-surface border border-border-main text-primary outline-none focus:border-[#FF6F0F]/50 w-28"
              />
              <div className="flex gap-1 flex-wrap">
                {AUTHOR_EMOJIS.map(em => (
                  <button key={em} onClick={() => setAuthorEmoji(em)}
                    className={`w-7 h-7 rounded-lg text-base flex items-center justify-center transition ${authorEmoji === em ? 'bg-[#FF6F0F]/20 ring-1 ring-[#FF6F0F]/50' : 'hover:bg-fill-medium'}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* 본문 */}
            <div className="px-4 pt-3 pb-1">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="공지 내용을 입력하세요..."
                rows={4}
                className="w-full bg-transparent text-sm text-primary placeholder:text-dim outline-none resize-none leading-relaxed min-h-[80px]"
              />
            </div>

            {/* 이미지 미리보기 */}
            {imageUrl && (
              <div className="px-4 pb-2 relative">
                <img src={imageUrl} alt="" className="w-full rounded-xl object-cover max-h-40" onError={() => setImageUrl('')} />
                <button onClick={() => setImageUrl('')} className="absolute top-3 right-6 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                  <X size={12} />
                </button>
              </div>
            )}

            {/* 이미지 URL */}
            <div className="px-4 pb-3">
              <label className="flex items-center gap-1.5 text-xs text-dim cursor-pointer">
                <ImagePlus size={12} className="shrink-0" />
                <input
                  type="text"
                  placeholder="이미지 URL 입력 (선택)"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-primary placeholder:text-dim border-b border-border-main focus:border-[#FF6F0F]/60 text-xs py-0.5"
                />
              </label>
            </div>

            {/* 하단 툴바 */}
            <div className="px-4 pb-4 flex flex-wrap items-center gap-2 border-t border-border-main/50 pt-3">
              <div className="flex gap-1">
                {(Object.keys(TYPE_META) as Notice['notice_type'][]).map(t => {
                  const { label, color, Icon } = TYPE_META[t];
                  const active = noticeType === t;
                  return (
                    <button key={t} onClick={() => setNoticeType(t)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
                        active ? `${color} border-current/30 bg-current/10` : 'text-dim border-border-main hover:border-border-main/60'
                      }`}
                      style={active ? { borderColor: 'currentColor' } : {}}>
                      <Icon size={11} />
                      {label}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setIsPinned(p => !p)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${isPinned ? 'text-[#FF6F0F] border-[#FF6F0F]/40 bg-[#FF6F0F]/10' : 'text-dim border-border-main hover:border-border-main/60'}`}>
                <Pin size={11} />
                고정
              </button>
              <button
                onClick={submit}
                disabled={!content.trim() || submitting}
                className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#FF6F0F] text-white hover:bg-[#FF6F0F]/90 transition disabled:opacity-40">
                {submitting ? '저장 중...' : editingId ? <><Check size={12} /> 수정</> : <><PlusCircle size={12} /> 게시</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 피드 1단 ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 py-5 space-y-3">

            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-card border border-border-main rounded-2xl p-4 h-28 animate-pulse" />
              ))
            ) : notices.length === 0 ? (
              <div className="py-20 text-center text-muted text-sm">아직 공지사항이 없습니다.</div>
            ) : (
              notices.map(n => {
                const { label, color, bg, Icon } = TYPE_META[n.notice_type];
                const fresh = isNew(n.created_at);
                return (
                  <div key={n.id}
                    className={`bg-card border rounded-2xl overflow-hidden transition ${
                      !n.is_active       ? 'opacity-50 border-border-main'
                      : editingId === n.id ? 'ring-2 ring-[#FF6F0F]/50 border-[#FF6F0F]/40'
                      : n.is_pinned       ? 'border-[#FF6F0F]/30'
                      :                     'border-border-main'
                    }`}>

                    {/* 고정 배너 */}
                    {n.is_pinned && n.is_active && (
                      <div className="px-4 py-1 bg-[#FF6F0F]/8 border-b border-[#FF6F0F]/20 flex items-center gap-1.5">
                        <Pin size={10} className="text-[#FF6F0F]" />
                        <span className="text-[10px] font-semibold text-[#FF6F0F]">고정된 공지</span>
                      </div>
                    )}

                    {/* 비노출 배너 */}
                    {!n.is_active && (
                      <div className="px-4 py-1 bg-fill-medium border-b border-border-main flex items-center gap-1.5">
                        <EyeOff size={10} className="text-dim" />
                        <span className="text-[10px] font-semibold text-dim">비노출 — 사장님에게 보이지 않습니다</span>
                      </div>
                    )}

                    <div className="px-4 pt-3 pb-2 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-fill-medium flex items-center justify-center text-xl shrink-0">
                        {n.author_emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-primary">{n.author_name}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bg} ${color}`}>
                            <Icon size={9} />{label}
                          </span>
                          {fresh && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">NEW</span>
                          )}
                          <span className="text-[10px] text-dim ml-auto">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">{n.content}</p>
                      </div>
                    </div>

                    {n.image_url && (
                      <div className="px-4 pb-3">
                        <img src={n.image_url} alt="" className="w-full rounded-xl object-cover max-h-52" />
                      </div>
                    )}

                    {/* 액션 바 */}
                    <div className="px-4 pb-3 pt-2 flex items-center gap-1 border-t border-border-main/40">
                      <div className="flex items-center gap-1 text-dim">
                        <Heart size={12} />
                        <span className="text-[11px]">{n.like_count}</span>
                      </div>
                      <div className="flex-1" />

                      {/* 노출/비노출 토글 */}
                      <button
                        onClick={() => patch(n.id, { is_active: !n.is_active })}
                        title={n.is_active ? '비노출로 변경' : '노출로 변경'}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
                          n.is_active
                            ? 'text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20'
                            : 'text-dim border-border-main hover:text-primary hover:border-border-main/60'
                        }`}>
                        {n.is_active ? <><Eye size={11} /> 노출</> : <><EyeOff size={11} /> 비노출</>}
                      </button>

                      {/* 고정 */}
                      <button onClick={() => patch(n.id, { is_pinned: !n.is_pinned })}
                        title={n.is_pinned ? '고정 해제' : '고정'}
                        className={`p-1.5 rounded-lg transition ${n.is_pinned ? 'text-[#FF6F0F]' : 'text-dim hover:text-primary'}`}>
                        <Pin size={13} />
                      </button>

                      {/* 수정 */}
                      <button onClick={() => startEdit(n)}
                        className="p-1.5 rounded-lg text-dim hover:text-primary transition">
                        <Pencil size={13} />
                      </button>

                      {/* 삭제 */}
                      <button onClick={() => del(n.id)}
                        className="p-1.5 rounded-lg text-dim hover:text-red-400 transition">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
