'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Check, X, ToggleLeft, ToggleRight, Loader2, ChevronUp, ChevronDown } from 'lucide-react';

interface Chip {
  id: string;
  label: string;
  message: string;
  sort_order: number;
  is_active: boolean;
}

export default function ConsultChipsPage() {
  const [chips, setChips] = useState<Chip[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/consult-chips');
    const data = await res.json();
    setChips(data.chips ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // 추가
  const handleAdd = async () => {
    if (!newLabel.trim() || !newMessage.trim()) return;
    setSaving(true);
    const maxOrder = chips.length > 0 ? Math.max(...chips.map(c => c.sort_order)) + 1 : 0;
    await fetch('/api/admin/consult-chips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), message: newMessage.trim(), sort_order: maxOrder }),
    });
    setNewLabel(''); setNewMessage(''); setAdding(false);
    await load();
    setSaving(false);
  };

  // 수정 저장
  const handleSave = async (id: string) => {
    if (!editLabel.trim() || !editMessage.trim()) return;
    setSaving(true);
    await fetch(`/api/admin/consult-chips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editLabel.trim(), message: editMessage.trim() }),
    });
    setEditingId(null);
    await load();
    setSaving(false);
  };

  // 활성/비활성 토글
  const toggleActive = async (chip: Chip) => {
    await fetch(`/api/admin/consult-chips/${chip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !chip.is_active }),
    });
    setChips(prev => prev.map(c => c.id === chip.id ? { ...c, is_active: !c.is_active } : c));
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 칩을 삭제할까요?')) return;
    await fetch(`/api/admin/consult-chips/${id}`, { method: 'DELETE' });
    setChips(prev => prev.filter(c => c.id !== id));
  };

  // 순서 이동
  const move = async (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= chips.length) return;
    const updated = [...chips];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setChips(updated);
    // sort_order 동기화
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

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-white">빠른 질문 칩 관리</h1>
        <p className="text-[13px] text-gray-400 mt-1">고객 채팅창에 표시되는 버튼입니다. 클릭하면 즉시 메시지가 전송됩니다.</p>
      </div>

      {/* 미리보기 */}
      {chips.filter(c => c.is_active).length > 0 && (
        <div className="mb-6 p-4 bg-[#1a1a2e] rounded-2xl border border-white/10">
          <p className="text-[11px] text-gray-500 font-semibold mb-2.5 uppercase tracking-wide">고객 화면 미리보기</p>
          <div className="flex gap-2 flex-wrap">
            {chips.filter(c => c.is_active).map(c => (
              <span key={c.id} className="px-3.5 py-2 rounded-full border border-[#FF6F0F] text-[#FF6F0F] text-[13px] font-medium bg-transparent">
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 칩 목록 */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
      ) : (
        <div className="space-y-2">
          {chips.map((chip, idx) => (
            <div key={chip.id} className={`rounded-2xl border transition-all ${chip.is_active ? 'bg-[#1e1e2e] border-white/10' : 'bg-[#16161e] border-white/5 opacity-60'}`}>
              {editingId === chip.id ? (
                /* 편집 모드 */
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">버튼 라벨</label>
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="mt-1 w-full bg-[#0d0d17] border border-white/10 rounded-xl px-3 py-2.5 text-[14px] text-white focus:outline-none focus:border-[#FF6F0F]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">전송될 메시지</label>
                    <textarea
                      value={editMessage}
                      onChange={e => setEditMessage(e.target.value)}
                      rows={2}
                      className="mt-1 w-full bg-[#0d0d17] border border-white/10 rounded-xl px-3 py-2.5 text-[14px] text-white focus:outline-none focus:border-[#FF6F0F]/50 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(chip.id)} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6F0F] text-white rounded-xl text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-50">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 저장
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-[13px] font-semibold hover:bg-white/10 transition">
                      <X className="w-3.5 h-3.5" /> 취소
                    </button>
                  </div>
                </div>
              ) : (
                /* 보기 모드 */
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* 순서 버튼 */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-20 transition">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => move(idx, 1)} disabled={idx === chips.length - 1} className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-20 transition">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <GripVertical className="w-4 h-4 text-gray-700 shrink-0" />

                  <div className="flex-1 min-w-0"
                    onClick={() => { setEditingId(chip.id); setEditLabel(chip.label); setEditMessage(chip.message); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-white">{chip.label}</span>
                      {!chip.is_active && <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">비활성</span>}
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5 truncate">{chip.message}</p>
                  </div>

                  {/* 토글 */}
                  <button onClick={() => toggleActive(chip)} className="shrink-0 text-gray-500 hover:text-white transition">
                    {chip.is_active
                      ? <ToggleRight className="w-5 h-5 text-[#FF6F0F]" />
                      : <ToggleLeft className="w-5 h-5" />}
                  </button>

                  {/* 삭제 */}
                  <button onClick={() => handleDelete(chip.id)} className="shrink-0 p-1.5 text-gray-600 hover:text-red-400 transition">
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
        <div className="mt-4 p-4 bg-[#1e1e2e] rounded-2xl border border-[#FF6F0F]/30 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">버튼 라벨 *</label>
            <input
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="예: 광고 문의"
              className="mt-1 w-full bg-[#0d0d17] border border-white/10 rounded-xl px-3 py-2.5 text-[14px] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FF6F0F]/50"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">전송될 메시지 *</label>
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="예: 안녕하세요! 광고 문의드리고 싶어요."
              rows={2}
              className="mt-1 w-full bg-[#0d0d17] border border-white/10 rounded-xl px-3 py-2.5 text-[14px] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FF6F0F]/50 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newLabel.trim() || !newMessage.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6F0F] text-white rounded-xl text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-40">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 추가
            </button>
            <button onClick={() => { setAdding(false); setNewLabel(''); setNewMessage(''); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-[13px] font-semibold hover:bg-white/10 transition">
              <X className="w-3.5 h-3.5" /> 취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-white/10 hover:border-[#FF6F0F]/40 text-gray-500 hover:text-[#FF6F0F] text-[14px] font-semibold transition">
          <Plus className="w-4 h-4" />
          새 칩 추가
        </button>
      )}
    </div>
  );
}
