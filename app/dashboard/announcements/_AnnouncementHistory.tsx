'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Trash2, Check, Loader2, Megaphone, Radio, AArrowUp, AArrowDown, GripVertical, Pin, Pencil, RotateCw } from 'lucide-react';
import { Announcement, Store, FishVoice, MODE_LABEL, fmtTime, voiceLabel } from './_shared';

const FONT_SIZES = [12, 14, 16, 20, 24] as const;

interface Props {
  announcements:     Announcement[];
  stores:            Store[];
  fishVoices:        FishVoice[];
  selectedStore:     string;
  playingId:         string | null;
  announcingId:      string | null;
  announcementPlaying: boolean;
  deleting:          string | null;
  loading:           boolean;
  onPlay:            (ann: Announcement) => void;
  onBroadcast:       (ann: Announcement) => void;
  onDelete:          (id: string) => void;
  onClearAll:        () => void;
  onReorder:         (list: Announcement[]) => void;
  onTogglePin:       (id: string) => void;
  onRegenerate:      (ann: Announcement, newText: string) => void;
  regeneratingId:    string | null;
  hasTrack:          boolean;
}

export default function AnnouncementHistory({
  announcements, stores, fishVoices, selectedStore,
  playingId, announcingId, announcementPlaying,
  deleting, loading,
  onPlay, onBroadcast, onDelete, onClearAll, onReorder, onTogglePin, onRegenerate, regeneratingId, hasTrack,
}: Props) {
  const storeName = (id: string) => stores.find(s => s.id === id)?.name ?? id;
  const [fontIdx, setFontIdx] = useState(1);
  const fontSize = FONT_SIZES[fontIdx];

  // 삭제 확인
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 인라인 편집
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText]   = useState('');

  // ── 드래그 & 드롭 ──
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx); };
  const handleDragLeave = () => setDragOver(null);
  const handleDrop = (idx: number) => {
    setDragOver(null);
    const from = dragIdx.current;
    if (from === null || from === idx) return;
    const list = [...announcements];
    const [item] = list.splice(from, 1);
    list.splice(idx, 0, item);
    onReorder(list);
    dragIdx.current = null;
  };
  const handleDragEnd = () => { dragIdx.current = null; setDragOver(null); };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-tertiary">
          {selectedStore ? stores.find(s => s.id === selectedStore)?.name : '전체'} 안내방송
          <span className="ml-2 text-dim">· {announcements.length}건</span>
          <span className="ml-2 text-[10px] text-gray-700 font-normal">로컬 저장</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setFontIdx(i => Math.max(0, i - 1))} disabled={fontIdx === 0}
            className="p-1 rounded text-dim hover:text-primary disabled:opacity-30 transition" title="글자 줄이기">
            <AArrowDown size={14} />
          </button>
          <span className="text-[10px] text-dim w-6 text-center">{fontSize}</span>
          <button onClick={() => setFontIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))} disabled={fontIdx === FONT_SIZES.length - 1}
            className="p-1 rounded text-dim hover:text-primary disabled:opacity-30 transition" title="글자 키우기">
            <AArrowUp size={14} />
          </button>
          {announcements.length > 0 && (
            <button onClick={onClearAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-dim hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition ml-2">
              <Trash2 size={11} /> 전체 초기화
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-dim">
          <Loader2 size={20} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-dim">
          <Megaphone size={32} className="mb-3 opacity-30" />
          <p className="text-sm">생성된 안내방송이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {announcements.map((ann, idx) => (
            <div key={ann.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl px-3 py-3 flex items-start gap-2.5 transition border ${
                ann.pinned
                  ? 'bg-[#FF6F0F]/[0.04] border-[#FF6F0F]/20'
                  : 'bg-card border-border-main hover:border-border-subtle'
              } ${dragOver === idx ? 'ring-2 ring-[#FF6F0F]/50' : ''}`}>

              {/* 드래그 핸들 */}
              <div className="shrink-0 flex flex-col items-center gap-1 pt-1 cursor-grab active:cursor-grabbing">
                <GripVertical size={14} className="text-dim/50" />
              </div>

              {/* 재생 버튼 */}
              <button
                onClick={() => onPlay(ann)}
                disabled={!ann.audio_url}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition ${
                  playingId === ann.id || announcingId === ann.id
                    ? 'bg-[#FF6F0F] text-primary'
                    : 'bg-fill-medium text-tertiary hover:bg-white/20 hover:text-primary disabled:opacity-30'
                }`}>
                {playingId === ann.id || announcingId === ann.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                {editingId === ann.id ? (
                  <div className="space-y-1.5">
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (editText.trim() && editText.trim() !== ann.text) {
                            onRegenerate(ann, editText.trim());
                          }
                          setEditingId(null);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full bg-fill-subtle border border-[#FF6F0F]/40 rounded-lg px-3 py-2 text-primary outline-none resize-none focus:ring-1 focus:ring-[#FF6F0F]/30"
                      style={{ fontSize, minHeight: 60 }}
                    />
                    <div className="flex items-center gap-2 text-[10px] text-dim">
                      <span>Enter: 저장 + 재생성</span>
                      <span>·</span>
                      <span>Shift+Enter: 줄바꿈</span>
                      <span>·</span>
                      <span>Esc: 취소</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-primary leading-snug cursor-pointer hover:bg-white/[0.03] rounded px-1 -mx-1 transition"
                    style={{ fontSize }}
                    onClick={() => { setEditingId(ann.id); setEditText(ann.text); }}
                    title="클릭하여 문구 수정">
                    {regeneratingId === ann.id ? (
                      <span className="flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" /> 재생성 중...</span>
                    ) : ann.text}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {!selectedStore && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] border border-[#FF6F0F]/20">
                      {storeName(ann.store_id)}
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ann.ann_type === 'call' ? 'bg-blue-500/15 text-blue-400' : 'bg-[#FF6F0F]/15 text-[#FF6F0F]'}`}>
                    {ann.ann_type === 'call' ? '호출음성' : '템플릿음성'}
                  </span>
                  <span className="text-[10px] text-dim">{voiceLabel(fishVoices, ann.voice_type)}</span>
                  <span className="text-[10px] text-dim">·</span>
                  <span className="text-[10px] text-dim">{MODE_LABEL[ann.play_mode] ?? ann.play_mode}</span>
                  <span className="text-[10px] text-dim">· {ann.repeat_count}회</span>
                  <span className="text-[10px] text-dim ml-auto">{fmtTime(ann.created_at)}</span>
                </div>
                {ann.audio_url && !ann.audio_url.startsWith('blob:') && (
                  <a
                    href={ann.audio_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    title={ann.audio_url}
                    className="block text-[9px] text-dim/50 font-mono mt-1 truncate hover:text-accent hover:underline transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    {ann.audio_url.split('/').pop()}
                  </a>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="shrink-0 flex items-center gap-1">
                {/* 즐겨찾기(핀) */}
                <button onClick={() => onTogglePin(ann.id)}
                  title={ann.pinned ? '고정 해제' : '상단 고정'}
                  className={`p-1 rounded transition ${
                    ann.pinned ? 'text-[#FF6F0F]' : 'text-dim/40 hover:text-[#FF6F0F]'
                  }`}>
                  <Pin size={13} className={ann.pinned ? 'fill-current' : ''} />
                </button>

                {/* 방송 */}
                {ann.audio_url && hasTrack && (
                  <button
                    onClick={() => onBroadcast(ann)}
                    disabled={announcementPlaying}
                    title={ann.play_mode === 'immediate' ? '즉시 방송' : '곡간 삽입'}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${
                      announcingId === ann.id && announcementPlaying
                        ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/40 text-[#FF6F0F] cursor-not-allowed'
                        : announcementPlaying
                          ? 'bg-fill-subtle border-border-subtle text-dim cursor-not-allowed opacity-40'
                          : 'bg-fill-subtle border-border-subtle text-muted hover:text-primary hover:border-border-main'
                    }`}>
                    <Radio size={10} />
                    {ann.play_mode === 'immediate' ? '즉시' : '곡간'}
                  </button>
                )}

                {/* 삭제 */}
                <div className="relative shrink-0 flex flex-col items-center">
                  <button
                    onClick={() => {
                      if (confirmDeleteId === ann.id) setConfirmDeleteId(null);
                      else setConfirmDeleteId(ann.id);
                    }}
                    disabled={deleting === ann.id}
                    className={`transition p-1 ${confirmDeleteId === ann.id ? 'text-red-400' : 'text-dim hover:text-red-400'}`}>
                    {deleting === ann.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                  {confirmDeleteId === ann.id && (
                    <button
                      onClick={() => { setConfirmDeleteId(null); onDelete(ann.id); }}
                      className="absolute top-full mt-0.5 z-10 flex items-center justify-center w-6 h-6 rounded-md bg-red-500 text-white hover:bg-red-600 transition shadow-lg">
                      <Check size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
