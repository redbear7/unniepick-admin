'use client';

import { useState } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import {
  TtsTemplate, FishVoice, DAYS_KR, SPEED_OPTIONS, PLAY_MODES, DEFAULT_FISH_VOICE,
} from './_shared';

interface Props {
  target:      TtsTemplate | null;
  fishVoices:  FishVoice[];
  onConfirm:   (tpl: TtsTemplate) => void;
  onDelete:    (tpl: TtsTemplate) => void;
  onClose:     () => void;
}

export default function TemplateModal({ target, fishVoices, onConfirm, onDelete, onClose }: Props) {
  const [emoji,    setEmoji]    = useState(target?.emoji ?? '📢');
  const [label,    setLabel]    = useState(target?.label ?? '');
  const [text,     setText]     = useState(target?.text ?? '');
  const [voiceT,   setVoiceT]   = useState(target?.voice_type ?? DEFAULT_FISH_VOICE);
  const [speed,    setSpeed]    = useState(target?.speed ?? 1.0);
  const [mode,     setMode]     = useState<'immediate' | 'between_tracks'>(target?.play_mode ?? 'immediate');
  const [repeatN,  setRepeatN]  = useState(target?.repeat_count ?? 1);
  const [duck,     setDuck]     = useState(target?.duck_volume ?? 20);
  const [days,     setDays]     = useState<number[]>(target?.sched_days ?? []);
  const [time,     setTime]     = useState(target?.sched_time ?? '');

  const toggleDay = (d: number) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  const handleConfirm = () => {
    if (!label.trim() || !text.trim()) { alert('라벨과 문구를 입력하세요'); return; }
    onConfirm({
      emoji: emoji.trim() || '📢',
      label: label.trim(),
      text: text.trim(),
      voice_type: voiceT,
      speed,
      play_mode: mode,
      repeat_count: repeatN,
      duck_volume: duck,
      sched_days: days,
      sched_time: time.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1A1D23] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {target ? '템플릿 수정' : '새 템플릿 추가'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* 이모지 + 라벨 */}
        <div className="flex gap-2">
          <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
            className="w-14 text-center bg-[#0D0F14] border border-white/10 text-xl rounded-xl py-2 outline-none" placeholder="📢" />
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="템플릿 이름"
            className="flex-1 bg-[#0D0F14] border border-white/10 text-sm text-white rounded-xl px-3 py-2 outline-none placeholder-gray-600" />
        </div>

        {/* 안내 문구 */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">안내 문구 *</label>
          <textarea value={text} onChange={e => setText(e.target.value.slice(0, 200))} rows={3} placeholder="안내 문구를 입력하세요"
            className="w-full bg-[#0D0F14] border border-white/10 text-sm text-white rounded-xl px-3 py-2 outline-none placeholder-gray-600 resize-none" />
        </div>

        {/* 목소리 + 속도 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">목소리</label>
            <select value={voiceT} onChange={e => setVoiceT(e.target.value)}
              className="w-full bg-[#0D0F14] border border-white/10 text-xs text-white rounded-xl px-2 py-1.5 outline-none">
              {fishVoices.map(fv => <option key={fv.id} value={`fish_${fv.refId}`}>{fv.emoji} {fv.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">속도</label>
            <div className="flex gap-1">
              {SPEED_OPTIONS.map(s => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-semibold border transition ${
                    speed === s ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/[0.03] border-white/10 text-gray-400'
                  }`}>{s}x</button>
              ))}
            </div>
          </div>
        </div>

        {/* 방송방식 + 반복 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">방송 방식</label>
            <div className="flex flex-col gap-1">
              {PLAY_MODES.map(m => (
                <button key={m.value} onClick={() => setMode(m.value as any)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    mode === m.value ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/[0.03] border-white/10 text-gray-400'
                  }`}>{m.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">반복 횟수</label>
            <div className="flex flex-col gap-1">
              {[1,2,3].map(n => (
                <button key={n} onClick={() => setRepeatN(n)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    repeatN === n ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/[0.03] border-white/10 text-gray-400'
                  }`}>{n}회</button>
              ))}
            </div>
          </div>
        </div>

        {/* 예약 설정 */}
        <div className="bg-[#0D0F14] border border-white/5 rounded-xl p-3 space-y-2">
          <label className="text-xs text-gray-500 font-semibold">⏰ 예약 설정 (선택)</label>
          <div className="flex gap-1.5 flex-wrap">
            {DAYS_KR.map((day, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={`w-8 h-8 rounded-full text-[11px] font-bold border transition ${
                  days.includes(i) ? 'bg-[#FF6F0F]/20 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/5 border-white/10 text-gray-500'
                }`}>{day}</button>
            ))}
            {days.length > 0 && (
              <button onClick={() => setDays([])} className="text-[10px] text-gray-600 hover:text-gray-400 px-1">초기화</button>
            )}
          </div>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="bg-[#1A1D23] border border-white/10 text-sm text-white rounded-lg px-3 py-1.5 outline-none"
            style={{ colorScheme: 'dark' }} />
          <p className="text-[10px] text-gray-600">
            {days.length === 0 && time === '' ? '예약 없음 (즉시 방송)' :
             days.length === 0 ? `매일 ${time}` :
             `${days.map(d => DAYS_KR[d]).join('·')} ${time || '매 시간'}`}
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 pt-1">
          {target && (
            <button onClick={() => onDelete(target)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition">
              <Trash2 size={12} /> 삭제
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold hover:bg-white/10 transition">
            취소
          </button>
          <button onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#FF6F0F] text-white text-xs font-bold hover:bg-[#FF6F0F]/90 transition">
            <Check size={13} /> 저장
          </button>
        </div>
      </div>
    </div>
  );
}
