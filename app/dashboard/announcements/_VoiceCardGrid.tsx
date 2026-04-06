'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, Plus, Pencil, X, Check, Bookmark } from 'lucide-react';
import {
  FishVoice, DEFAULT_FISH_VOICES, VOICE_EMOJIS, SAMPLE_CACHE_KEY, DEFAULT_VOICE_KEY,
} from './_shared';

interface Props {
  voice:        string;
  defaultVoice: string;
  isSuperadmin: boolean;
  onSelectVoice:    (vt: string) => void;
  onSetDefault:     (vt: string) => void;
  onVoicesLoaded?:  (voices: FishVoice[]) => void;
}

export default function VoiceCardGrid({ voice, defaultVoice, isSuperadmin, onSelectVoice, onSetDefault, onVoicesLoaded }: Props) {
  const [fishVoices,     setFishVoices]     = useState<FishVoice[]>(DEFAULT_FISH_VOICES);
  const [voicesLoading,  setVoicesLoading]  = useState(true);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [pendingEdit,    setPendingEdit]    = useState<FishVoice | null>(null);
  const [addingVoice,    setAddingVoice]    = useState(false);
  const [newVoiceForm,   setNewVoiceForm]   = useState<Omit<FishVoice,'id'>>({ label: '', refId: '', emoji: '🎙️' });
  const [voiceSaving,    setVoiceSaving]    = useState(false);
  const [samplingVoice,  setSamplingVoice]  = useState<string | null>(null);
  const [playingVoice,   setPlayingVoice]   = useState<string | null>(null);
  const [voiceSamples,   setVoiceSamples]   = useState<Record<string, string>>({});
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SAMPLE_CACHE_KEY);
      if (cached) setVoiceSamples(JSON.parse(cached));
    } catch {}
    (async () => {
      try {
        const res = await fetch('/api/tts/voices');
        const data = await res.json();
        const voices: FishVoice[] = Array.isArray(data) && data.length > 0
          ? data.map((v: any) => ({ id: v.id, label: v.label, refId: v.ref_id, emoji: v.emoji }))
          : DEFAULT_FISH_VOICES;
        setFishVoices(voices);
        onVoicesLoaded?.(voices);
        if (!voiceRef.current.startsWith('fish_') || !voices.some(fv => `fish_${fv.refId}` === voiceRef.current)) {
          onSelectVoice(`fish_${voices[0].refId}`);
        }
      } catch {
        setFishVoices(DEFAULT_FISH_VOICES);
        onVoicesLoaded?.(DEFAULT_FISH_VOICES);
      } finally {
        setVoicesLoading(false);
      }
    })();
    return () => { sampleAudioRef.current?.pause(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 샘플 미리듣기 ──
  const handleVoiceSample = async (voiceType: string) => {
    if (playingVoice === voiceType) {
      sampleAudioRef.current?.pause();
      sampleAudioRef.current = null;
      setPlayingVoice(null);
      return;
    }
    if (voiceSamples[voiceType]) {
      sampleAudioRef.current?.pause();
      const a = new Audio(voiceSamples[voiceType]);
      sampleAudioRef.current = a;
      a.play();
      setPlayingVoice(voiceType);
      a.onended = () => { sampleAudioRef.current = null; setPlayingVoice(null); };
      return;
    }
    setSamplingVoice(voiceType);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '안녕하세요! 언니픽 매장 안내방송입니다.', voice_type: voiceType, speed: 1.0, store_id: null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVoiceSamples(prev => {
        const next = { ...prev, [voiceType]: data.audio_url };
        try { sessionStorage.setItem(SAMPLE_CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
      sampleAudioRef.current?.pause();
      const a = new Audio(data.audio_url);
      sampleAudioRef.current = a;
      a.play();
      setPlayingVoice(voiceType);
      a.onended = () => { sampleAudioRef.current = null; setPlayingVoice(null); };
    } catch (e: any) {
      alert(`샘플 생성 실패: ${e.message}`);
    } finally {
      setSamplingVoice(null);
    }
  };

  // ── 성우 CRUD ──
  const handleAddVoiceApi = async () => {
    if (!newVoiceForm.label.trim() || !newVoiceForm.refId.trim()) { alert('이름과 Reference ID를 입력하세요'); return; }
    setVoiceSaving(true);
    try {
      const res = await fetch('/api/tts/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVoiceForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newCard = { id: data.id, label: data.label, refId: data.ref_id, emoji: data.emoji };
      setFishVoices(prev => { const next = [...prev, newCard]; onVoicesLoaded?.(next); return next; });
      setAddingVoice(false);
      setNewVoiceForm({ label: '', refId: '', emoji: '🎙️' });
    } catch (e: any) {
      alert(`추가 실패: ${e.message}`);
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleUpdateVoiceApi = async () => {
    if (!pendingEdit) return;
    setVoiceSaving(true);
    try {
      const res = await fetch(`/api/tts/voices/${pendingEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: pendingEdit.label, refId: pendingEdit.refId, emoji: pendingEdit.emoji }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFishVoices(prev => { const next = prev.map(f => f.id === pendingEdit.id ? pendingEdit : f); onVoicesLoaded?.(next); return next; });
      setEditingVoiceId(null);
      setPendingEdit(null);
    } catch (e: any) {
      alert(`수정 실패: ${e.message}`);
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleDeleteVoiceApi = async (fv: FishVoice) => {
    if (!confirm(`"${fv.label}" 성우를 삭제할까요?`)) return;
    try {
      const res = await fetch(`/api/tts/voices/${fv.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const updated = fishVoices.filter(f => f.id !== fv.id);
      setFishVoices(updated);
      onVoicesLoaded?.(updated);
      const vt = `fish_${fv.refId}`;
      if (voice === vt) onSelectVoice(updated[0] ? `fish_${updated[0].refId}` : '');
    } catch (e: any) {
      alert(`삭제 실패: ${e.message}`);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500 font-semibold">🔊 성우</label>
        <span className="text-[10px] text-gray-600">Fish Audio · s2-pro · DB 저장 · 시샵 관리</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {voicesLoading && (
          <div className="col-span-5 flex items-center justify-center py-4 text-gray-600">
            <Loader2 size={14} className="animate-spin mr-1" /><span className="text-[10px]">성우 로딩 중...</span>
          </div>
        )}
        {!voicesLoading && fishVoices.map(fv => {
          const vt         = `fish_${fv.refId}`;
          const isSelected = voice === vt;
          const isDefault  = defaultVoice === vt;
          const isEditing  = editingVoiceId === fv.id;
          const hasSample  = !!voiceSamples[vt];
          return (
            <div key={fv.id} className={`relative flex flex-col rounded-xl border transition ${
              isSelected ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50' : 'bg-teal-500/[0.05] border-teal-500/20'
            }`}>
              <button onClick={() => {
                  const next = isDefault ? '' : vt;
                  onSetDefault(next);
                  try { localStorage.setItem(DEFAULT_VOICE_KEY, next); } catch {}
                }}
                title={isDefault ? '디폴트 해제' : '디폴트로 설정'}
                className={`absolute top-1 right-1 transition ${isDefault ? 'text-[#FF6F0F]' : 'text-gray-700 hover:text-gray-400'}`}>
                <Bookmark size={8} fill={isDefault ? '#FF6F0F' : 'none'} />
              </button>
              <button onClick={() => onSelectVoice(vt)}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1 px-1 transition ${isSelected ? 'text-[#FF6F0F]' : 'text-gray-400 hover:text-white'}`}>
                <span className="text-base">{fv.emoji}</span>
                <span className="text-[9px] text-center leading-tight font-semibold truncate w-full px-0.5">{fv.label || '(이름없음)'}</span>
              </button>
              <div className="flex gap-0.5 mx-1 mb-1">
                <button onClick={() => handleVoiceSample(vt)} disabled={samplingVoice === vt}
                  title={hasSample ? '캐시됨' : '샘플 생성'}
                  className={`flex-1 flex items-center justify-center py-1 rounded-lg text-[9px] font-semibold transition ${
                    playingVoice === vt ? 'bg-green-500/20 text-green-400'
                    : hasSample ? 'bg-teal-500/10 text-teal-400 hover:text-teal-300'
                    : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>
                  {samplingVoice === vt ? <Loader2 size={8} className="animate-spin" />
                    : playingVoice === vt ? <Pause size={8} />
                    : <Play size={8} />}
                </button>
                {isSuperadmin && (
                  <button onClick={() => isEditing ? (setEditingVoiceId(null), setPendingEdit(null)) : (setEditingVoiceId(fv.id), setPendingEdit({ ...fv }))}
                    className={`flex-1 flex items-center justify-center py-1 rounded-lg text-[9px] font-semibold transition ${
                      isEditing ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>
                    <Pencil size={8} />
                  </button>
                )}
                {isSuperadmin && (
                  <button onClick={() => handleDeleteVoiceApi(fv)}
                    className="flex-1 flex items-center justify-center py-1 rounded-lg text-[9px] font-semibold bg-white/5 text-gray-600 hover:text-red-400 transition">
                    <X size={8} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isSuperadmin && !addingVoice && (
          <button onClick={() => { setNewVoiceForm({ label: '', refId: '', emoji: '🎙️' }); setAddingVoice(true); }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-teal-500/30 text-teal-600 hover:text-teal-400 hover:border-teal-400/50 transition py-3">
            <Plus size={14} />
            <span className="text-[9px] font-semibold">추가</span>
          </button>
        )}
      </div>

      {/* 성우 편집 패널 */}
      {editingVoiceId && pendingEdit && (
        <div className="bg-teal-500/5 border border-teal-500/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-teal-400 font-semibold">성우 수정 · {pendingEdit.label || '(이름없음)'}</span>
            <button onClick={() => { setEditingVoiceId(null); setPendingEdit(null); }}
              className="text-gray-500 hover:text-white transition"><X size={12} /></button>
          </div>
          <div className="flex flex-wrap gap-1">
            {VOICE_EMOJIS.map(e => (
              <button key={e} onClick={() => setPendingEdit(p => p ? { ...p, emoji: e } : p)}
                className={`text-sm rounded p-1 transition ${pendingEdit.emoji === e ? 'bg-teal-500/30 ring-1 ring-teal-400/50' : 'hover:bg-white/10'}`}>{e}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={pendingEdit.label}
              onChange={e => setPendingEdit(p => p ? { ...p, label: e.target.value } : p)}
              placeholder="이름"
              className="w-32 px-2 py-1.5 bg-black/30 border border-teal-500/30 rounded-lg text-xs text-white placeholder-gray-600 outline-none" />
            <input value={pendingEdit.refId}
              onChange={e => setPendingEdit(p => p ? { ...p, refId: e.target.value.trim() } : p)}
              placeholder="Fish Audio Reference ID"
              className="flex-1 px-2 py-1.5 bg-black/30 border border-teal-500/30 rounded-lg text-xs text-white placeholder-gray-600 outline-none font-mono" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleUpdateVoiceApi} disabled={voiceSaving}
              className="flex-1 py-1.5 bg-teal-500/20 text-teal-300 rounded-lg text-xs font-semibold hover:bg-teal-500/30 transition disabled:opacity-50">
              {voiceSaving ? <Loader2 size={11} className="inline animate-spin mr-1" /> : <Check size={11} className="inline mr-1" />}저장
            </button>
            <button onClick={() => { setEditingVoiceId(null); setPendingEdit(null); }}
              className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs font-semibold hover:text-white transition">취소</button>
          </div>
        </div>
      )}

      {/* 새 성우 추가 폼 */}
      {addingVoice && (
        <div className="bg-teal-500/5 border border-teal-500/30 rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap gap-1">
            {VOICE_EMOJIS.map(e => (
              <button key={e} onClick={() => setNewVoiceForm(f => ({ ...f, emoji: e }))}
                className={`text-sm rounded p-1 transition ${newVoiceForm.emoji === e ? 'bg-teal-500/30' : 'hover:bg-white/10'}`}>{e}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newVoiceForm.label} onChange={e => setNewVoiceForm(f => ({ ...f, label: e.target.value }))}
              placeholder="이름 (예: 한국어 여성)"
              className="w-32 px-2 py-1.5 bg-black/30 border border-teal-500/30 rounded-lg text-xs text-white placeholder-gray-600 outline-none" />
            <input value={newVoiceForm.refId} onChange={e => setNewVoiceForm(f => ({ ...f, refId: e.target.value.trim() }))}
              placeholder="Fish Audio Reference ID"
              className="flex-1 px-2 py-1.5 bg-black/30 border border-teal-500/30 rounded-lg text-xs text-white placeholder-gray-600 outline-none font-mono" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddVoiceApi} disabled={voiceSaving}
              className="flex-1 py-1.5 bg-teal-500/20 text-teal-300 rounded-lg text-xs font-semibold hover:bg-teal-500/30 transition disabled:opacity-50">
              {voiceSaving ? <Loader2 size={11} className="inline animate-spin mr-1" /> : <Check size={11} className="inline mr-1" />}저장
            </button>
            <button onClick={() => setAddingVoice(false)}
              className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs font-semibold hover:text-white transition">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
