'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, GripVertical, Check, X, ToggleLeft, ToggleRight, Loader2, ChevronUp, ChevronDown, Smile } from 'lucide-react';

/* ── 이모티콘 데이터 ── */
const EMOJI_CATEGORIES = [
  {
    label: '감정', emojis: [
      '😊','😄','😁','🥰','😍','🤩','😎','🥳','😇','🙏',
      '👍','👏','🎉','✨','💯','❤️','💕','💪','🌟','⭐',
      '😢','😅','😂','🤣','😆','😋','🤗','😏','🙌','💫',
    ],
  },
  {
    label: '비즈니스', emojis: [
      '📢','📣','💬','📞','📱','💼','📋','📝','✅','🔔',
      '💡','🎯','🚀','📈','💰','🏆','🔑','📌','⚡','🔥',
      '📊','💎','🎁','🎀','🛒','🏷️','📦','🤝','👋','💌',
    ],
  },
  {
    label: '음식/가게', emojis: [
      '🍽️','🍜','🍣','🍕','🍔','🍱','🥗','🍰','☕','🧋',
      '🍺','🍻','🥂','🍷','🍸','🍹','🧃','🥤','🍦','🍩',
      '🏪','🏬','🛍️','🌮','🥘','🍲','🍛','🍤','🥩','🧆',
    ],
  },
  {
    label: '기호/화살', emojis: [
      '✔️','❌','⭕','❓','❗','💢','🔴','🟠','🟡','🟢',
      '🔵','🟣','⚫','⚪','🔺','🔻','▶️','◀️','🔝','🔛',
      '➡️','⬅️','⬆️','⬇️','↗️','↘️','🔄','♻️','📍','🗂️',
    ],
  },
];

/* ── 이모티콘 피커 컴포넌트 ── */
function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 w-72 bg-[--bg-card] border border-[--border-main] rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* 탭 */}
      <div className="flex border-b border-[--border-subtle]">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`flex-1 py-2 text-[11px] font-semibold transition ${
              tab === i
                ? 'text-[--accent] border-b-2 border-[--accent]'
                : 'text-[--text-dim] hover:text-[--text-muted]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {/* 그리드 */}
      <div className="p-2 grid grid-cols-10 gap-0.5 max-h-40 overflow-y-auto">
        {EMOJI_CATEGORIES[tab].emojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onSelect(emoji)}
            className="text-[18px] p-1 rounded-lg hover:bg-[--fill-medium] transition leading-none"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── 이모티콘 삽입 버튼 + 피커 래퍼 ── */
function EmojiButton({
  onInsert,
}: {
  onInsert: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const handleSelect = useCallback((emoji: string) => {
    onInsert(emoji);
    setOpen(false);
  }, [onInsert]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="p-1 text-[--text-dim] hover:text-[--accent] transition rounded-lg"
        title="이모티콘 삽입"
      >
        <Smile className="w-3.5 h-3.5" />
      </button>
      {open && <EmojiPicker onSelect={handleSelect} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ── 커서 위치에 이모티콘 삽입 헬퍼 ── */
function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  emoji: string,
  setValue: (v: string) => void
) {
  const start = el.selectionStart ?? el.value.length;
  const end   = el.selectionEnd   ?? el.value.length;
  const next  = el.value.slice(0, start) + emoji + el.value.slice(end);
  setValue(next);
  // 커서 위치 복원 (다음 틱)
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + emoji.length, start + emoji.length);
  });
}

/* ── 메인 ── */
interface Chip {
  id: string;
  label: string;
  message: string;
  auto_reply: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function ConsultChipsPage() {
  const [chips, setChips] = useState<Chip[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editAutoReply, setEditAutoReply] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newAutoReply, setNewAutoReply] = useState('');
  const [saving, setSaving] = useState(false);

  /* 각 입력 필드 ref */
  const editLabelRef    = useRef<HTMLInputElement>(null);
  const editMessageRef  = useRef<HTMLTextAreaElement>(null);
  const editReplyRef    = useRef<HTMLTextAreaElement>(null);
  const newLabelRef     = useRef<HTMLInputElement>(null);
  const newMessageRef   = useRef<HTMLTextAreaElement>(null);
  const newReplyRef     = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/consult-chips');
    const data = await res.json();
    setChips(data.chips ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newLabel.trim() || !newMessage.trim()) return;
    setSaving(true);
    const maxOrder = chips.length > 0 ? Math.max(...chips.map(c => c.sort_order)) + 1 : 0;
    await fetch('/api/admin/consult-chips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), message: newMessage.trim(), auto_reply: newAutoReply.trim() || null, sort_order: maxOrder }),
    });
    setNewLabel(''); setNewMessage(''); setNewAutoReply(''); setAdding(false);
    await load();
    setSaving(false);
  };

  const handleSave = async (id: string) => {
    if (!editLabel.trim() || !editMessage.trim()) return;
    setSaving(true);
    await fetch(`/api/admin/consult-chips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editLabel.trim(), message: editMessage.trim(), auto_reply: editAutoReply.trim() || null }),
    });
    setEditingId(null);
    await load();
    setSaving(false);
  };

  const toggleActive = async (chip: Chip) => {
    await fetch(`/api/admin/consult-chips/${chip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !chip.is_active }),
    });
    setChips(prev => prev.map(c => c.id === chip.id ? { ...c, is_active: !c.is_active } : c));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 칩을 삭제할까요?')) return;
    await fetch(`/api/admin/consult-chips/${id}`, { method: 'DELETE' });
    setChips(prev => prev.filter(c => c.id !== id));
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= chips.length) return;
    const updated = [...chips];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setChips(updated);
    await Promise.all([
      fetch(`/api/admin/consult-chips/${updated[idx].id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: idx }),
      }),
      fetch(`/api/admin/consult-chips/${updated[swapIdx].id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: swapIdx }),
      }),
    ]);
  };

  const inputCls = 'w-full bg-[--fill-subtle] border border-[--border-main] rounded-xl px-3 py-2.5 text-[14px] text-[--text-primary] placeholder:text-[--text-dim] focus:outline-none focus:border-[--accent] transition-colors';

  /* 라벨 + 이모티콘 버튼 헤더 */
  const FieldLabel = ({
    text,
    required,
    refEl,
    currentValue,
    setValue,
  }: {
    text: string;
    required?: boolean;
    refEl: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    currentValue: string;
    setValue: (v: string) => void;
  }) => (
    <div className="flex items-center justify-between mb-1">
      <label className="text-[11px] font-semibold text-[--text-dim] uppercase tracking-wide">
        {text}{required && ' *'}
      </label>
      <EmojiButton
        onInsert={emoji => {
          const el = refEl.current;
          if (el) insertAtCursor(el, emoji, setValue);
          else setValue(currentValue + emoji);
        }}
      />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[--text-primary]">빠른 질문 칩 관리</h1>
        <p className="text-[13px] text-[--text-muted] mt-1">고객 채팅창에 표시되는 버튼입니다. 클릭하면 즉시 메시지가 전송됩니다.</p>
      </div>

      {/* 미리보기 */}
      {chips.filter(c => c.is_active).length > 0 && (
        <div className="mb-6 p-4 bg-[--fill-subtle] rounded-2xl border border-[--border-main]">
          <p className="text-[11px] text-[--text-dim] font-semibold mb-2.5 uppercase tracking-wide">고객 화면 미리보기</p>
          <div className="flex gap-2 flex-wrap">
            {chips.filter(c => c.is_active).map(c => (
              <span key={c.id} className="px-3.5 py-2 rounded-full border border-[--accent] text-[--accent] text-[13px] font-medium bg-transparent">
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 칩 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[--text-dim]" />
        </div>
      ) : (
        <div className="space-y-2">
          {chips.map((chip, idx) => (
            <div
              key={chip.id}
              className={`rounded-2xl border transition-all ${
                chip.is_active
                  ? 'bg-[--bg-card] border-[--border-main]'
                  : 'bg-[--fill-subtle] border-[--border-subtle] opacity-60'
              }`}
            >
              {editingId === chip.id ? (
                <div className="p-4 space-y-3">
                  <div>
                    <FieldLabel text="버튼 라벨" refEl={editLabelRef} currentValue={editLabel} setValue={setEditLabel} />
                    <input
                      ref={editLabelRef}
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <FieldLabel text="전송될 메시지" refEl={editMessageRef} currentValue={editMessage} setValue={setEditMessage} />
                    <textarea
                      ref={editMessageRef}
                      value={editMessage}
                      onChange={e => setEditMessage(e.target.value)}
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[--text-dim] uppercase tracking-wide flex items-center gap-1.5">
                        자동 답변 <span className="text-[10px] font-normal text-[--text-dim] normal-case tracking-normal">(클릭 2초 후 전송, 비워두면 없음)</span>
                      </label>
                      <EmojiButton onInsert={emoji => { const el = editReplyRef.current; if (el) insertAtCursor(el, emoji, setEditAutoReply); else setEditAutoReply(p => p + emoji); }} />
                    </div>
                    <textarea
                      ref={editReplyRef}
                      value={editAutoReply}
                      onChange={e => setEditAutoReply(e.target.value)}
                      rows={2}
                      placeholder="예: 안녕하세요! 광고 문의 주셔서 감사합니다. 담당자가 곧 연락드릴게요 😊"
                      className={`${inputCls} resize-none border-[--accent]/40`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(chip.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[--accent] text-white rounded-xl text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[--fill-medium] text-[--text-muted] rounded-xl text-[13px] font-semibold hover:bg-[--fill-strong] transition"
                    >
                      <X className="w-3.5 h-3.5" /> 취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-0.5 text-[--text-dim] hover:text-[--text-primary] disabled:opacity-20 transition">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => move(idx, 1)} disabled={idx === chips.length - 1} className="p-0.5 text-[--text-dim] hover:text-[--text-primary] disabled:opacity-20 transition">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <GripVertical className="w-4 h-4 text-[--text-dim] shrink-0" />

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => { setEditingId(chip.id); setEditLabel(chip.label); setEditMessage(chip.message); setEditAutoReply(chip.auto_reply ?? ''); }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[--text-primary]">{chip.label}</span>
                      {!chip.is_active && (
                        <span className="text-[10px] text-[--text-dim] bg-[--fill-medium] px-1.5 py-0.5 rounded-full border border-[--border-subtle]">비활성</span>
                      )}
                    </div>
                    <p className="text-[12px] text-[--text-muted] mt-0.5 truncate">{chip.message}</p>
                    {chip.auto_reply && (
                      <p className="text-[11px] text-[--accent] mt-0.5 truncate flex items-center gap-1">
                        <span className="shrink-0">↩</span> {chip.auto_reply}
                      </p>
                    )}
                  </div>

                  <button onClick={() => toggleActive(chip)} className="shrink-0 text-[--text-dim] hover:text-[--text-primary] transition">
                    {chip.is_active ? <ToggleRight className="w-5 h-5 text-[--accent]" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>

                  <button onClick={() => handleDelete(chip.id)} className="shrink-0 p-1.5 text-[--text-dim] hover:text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 추가 폼 */}
      {adding ? (
        <div className="mt-4 p-4 bg-[--bg-card] rounded-2xl border border-[--accent]/30 space-y-3">
          <div>
            <FieldLabel text="버튼 라벨" required refEl={newLabelRef} currentValue={newLabel} setValue={setNewLabel} />
            <input
              ref={newLabelRef}
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="예: 광고 문의"
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel text="전송될 메시지" required refEl={newMessageRef} currentValue={newMessage} setValue={setNewMessage} />
            <textarea
              ref={newMessageRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="예: 안녕하세요! 광고 문의드리고 싶어요."
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[--text-dim] uppercase tracking-wide flex items-center gap-1.5">
                자동 답변 <span className="text-[10px] font-normal text-[--text-dim] normal-case tracking-normal">(클릭 2초 후 전송)</span>
              </label>
              <EmojiButton onInsert={emoji => { const el = newReplyRef.current; if (el) insertAtCursor(el, emoji, setNewAutoReply); else setNewAutoReply(p => p + emoji); }} />
            </div>
            <textarea
              ref={newReplyRef}
              value={newAutoReply}
              onChange={e => setNewAutoReply(e.target.value)}
              placeholder="예: 안녕하세요! 광고 문의 주셔서 감사합니다. 담당자가 곧 연락드릴게요 😊"
              rows={2}
              className={`${inputCls} resize-none border-[--accent]/40`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newLabel.trim() || !newMessage.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[--accent] text-white rounded-xl text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 추가
            </button>
            <button
              onClick={() => { setAdding(false); setNewLabel(''); setNewMessage(''); setNewAutoReply(''); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[--fill-medium] text-[--text-muted] rounded-xl text-[13px] font-semibold hover:bg-[--fill-strong] transition"
            >
              <X className="w-3.5 h-3.5" /> 취소
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[--border-main] hover:border-[--accent]/40 text-[--text-dim] hover:text-[--accent] text-[14px] font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          새 칩 추가
        </button>
      )}
    </div>
  );
}
