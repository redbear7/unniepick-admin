'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Megaphone, Loader2, Volume2, ChevronDown, Radio, Plus, Pencil, BookMarked, X, DatabaseZap } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

import {
  Store, Announcement, TtsTemplate, FishVoice,
  DEFAULT_FISH_VOICE, DEFAULT_FISH_VOICES, DEFAULT_TEMPLATES,
  PLAY_MODES, SPEED_OPTIONS, CALL_CARD_COUNT,
  TEMPLATES_LS_KEY, HISTORY_LS_KEY, DEFAULT_VOICE_KEY,
  GREETING_KEY, CALL_TEMPLATE_KEY,
  numToKorean, sessionAudioCache, sessionCacheKey, fetchBlobUrl,
  getCachedAudio, setCachedAudio,
  loadHistoryFromLS, pushHistoryToLS, removeHistoryFromLS, saveHistoryToLS,
  voiceLabel,
} from './_shared';

import VoiceCardGrid   from './_VoiceCardGrid';
import CallNumberGrid  from './_CallNumberGrid';
import TemplateModal   from './_TemplateModal';
import AnnouncementHistory from './_AnnouncementHistory';

// ─── 컴포넌트 ───────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const sb     = createClient();
  const player = usePlayer();

  const [stores,         setStores]         = useState<Store[]>([]);
  const [selectedStore,  setSelectedStore]  = useState<string>('');
  const [announcements,  setAnnouncements]  = useState<Announcement[]>([]);
  const [loading,        setLoading]        = useState(true);

  // 인사말
  const [greeting,     setGreeting]     = useState('안내말씀드립니다.');
  const [greetingOn,   setGreetingOn]   = useState(true);

  // 고객 호출
  const [callOpen,       setCallOpen]       = useState(false);
  const [callFullscreen, setCallFullscreen] = useState(false);
  const [callTemplate,   setCallTemplate]   = useState('{num}번 고객님, 카운터로 와주세요.');
  const [callStartNum,   setCallStartNum]   = useState('');
  const [fsStartDraft,   setFsStartDraft]   = useState('');
  const [directCallNum,  setDirectCallNum]  = useState('');
  const [callingNum,     setCallingNum]     = useState<number | null>(null);
  const [lastCalledNum,  setLastCalledNum]  = useState<number | null>(null);
  const [callRepeat,     setCallRepeat]     = useState(1);
  const directCallRef = useRef<HTMLInputElement>(null);

  // 생성 폼
  const [text,         setText]         = useState('');
  const [defaultVoice, setDefaultVoice] = useState(DEFAULT_FISH_VOICE);
  const [voice,        setVoice]        = useState(DEFAULT_FISH_VOICE);
  const [speed,        setSpeed]        = useState(1.0);
  const [playMode,     setPlayMode]     = useState<'immediate' | 'between_tracks'>('immediate');
  const [repeat,       setRepeat]       = useState(1);
  const [duckVolume,   setDuckVolume]   = useState(20);
  const [annVolume,    setAnnVolume]    = useState(120);
  const [cacheHit,     setCacheHit]     = useState(false);

  // 템플릿
  const [templates,     setTemplates]     = useState<TtsTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
  const [tplModal,      setTplModal]      = useState(false);
  const [tplEditTarget, setTplEditTarget] = useState<TtsTemplate | null>(null);

  // 재생성
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // 상태
  const [generating,   setGenerating]   = useState(false);
  const [deleting,     setDeleting]     = useState<string | null>(null);
  const [playingId,    setPlayingId]    = useState<string | null>(null);
  const [announcingId, setAnnouncingId] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [fishVoices,   setFishVoices]   = useState<FishVoice[]>(DEFAULT_FISH_VOICES);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── init ──
  useEffect(() => {
    Promise.all([loadStores(), checkSuperadmin()]);
    loadTemplates();
  }, []);
  useEffect(() => { loadAnnouncements(); }, [selectedStore]);

  const loadTemplates = () => {
    try { const s = localStorage.getItem(TEMPLATES_LS_KEY); if (s) setTemplates(JSON.parse(s)); } catch {}
    try {
      const raw = localStorage.getItem(DEFAULT_VOICE_KEY) ?? DEFAULT_FISH_VOICE;
      const v = raw.startsWith('fish_') ? raw : DEFAULT_FISH_VOICE;
      setDefaultVoice(v); setVoice(v);
    } catch {}
    try { const g = localStorage.getItem(GREETING_KEY); if (g !== null) setGreeting(g); else localStorage.setItem(GREETING_KEY, '안내말씀드립니다.'); } catch {}
    try { const ct = localStorage.getItem(CALL_TEMPLATE_KEY); if (ct) setCallTemplate(ct); } catch {}
  };

  const persistTemplates = useCallback((updated: TtsTemplate[]) => {
    setTemplates(updated);
    try { localStorage.setItem(TEMPLATES_LS_KEY, JSON.stringify(updated)); } catch {}
  }, []);

  const checkSuperadmin = async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from('users').select('role').eq('id', user.id).single();
    setIsSuperadmin(data?.role === 'superadmin');
  };

  const loadStores = async () => {
    const { data } = await sb.from('stores').select('id, name').order('name');
    setStores(data ?? []);
  };

  const loadAnnouncements = () => {
    setLoading(true);
    const list = loadHistoryFromLS();
    setAnnouncements(selectedStore ? list.filter(a => a.store_id === selectedStore) : list);
    setLoading(false);
  };

  // ── 공통 헬퍼 ──
  const greetingPfx = () => greetingOn && greeting.trim() ? `${greeting.trim()} ` : '';

  const makeAnnouncement = (txt: string, audioUrl: string, annType: 'call' | 'template', overrides?: Partial<Announcement & { duck_volume: number }>): Announcement & { duck_volume?: number } => ({
    id: `${annType === 'call' ? 'call' : 'loc'}_${Date.now()}`,
    store_id: selectedStore || '',
    text: txt,
    audio_url: audioUrl,
    voice_type: voice,
    play_mode: annType === 'call' ? 'immediate' : playMode,
    repeat_count: annType === 'call' ? callRepeat : repeat,
    is_active: true,
    created_at: new Date().toISOString(),
    duck_volume: duckVolume,
    ann_type: annType,
    ...overrides,
  });

  const checkCache = (t: string, v: string, s: number) => {
    setCacheHit(!!getCachedAudio(t, v, s) && sessionAudioCache.has(sessionCacheKey(t, v, s)));
  };

  // 언마운트 시 오디오 정리
  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  // BottomPlayer 안내방송 볼륨 슬라이더 → 로컬 재생 오디오에 실시간 반영
  // (player.track 없을 때 local audioRef로 재생되는 히스토리 오디오 대상)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, player.annVolume);
    }
  }, [player.annVolume]);

  const playAudio = (url: string, id: string, vol = 1, times = 1) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === id && times === 1) { setPlayingId(null); return; }
    let remaining = times;
    const playOnce = () => {
      const a = new Audio(url);
      a.volume = Math.min(1, vol);
      audioRef.current = a;
      a.play().catch(() => alert('재생 실패'));
      setPlayingId(id);
      a.onended = () => {
        remaining--;
        if (remaining > 0) playOnce();
        else { audioRef.current = null; setPlayingId(null); }
      };
    };
    playOnce();
  };

  // ── 고객 호출 ──
  const handleCallNum = async (num: number) => {
    if (callingNum !== null) return;
    if (!voice) { alert('성우를 먼저 선택하세요'); return; }
    setCallingNum(num);
    const fullText = `${greetingPfx()}${callTemplate.replaceAll('{num}', numToKorean(num))}`;
    try {
      let audioUrl: string;
      const cached = getCachedAudio(fullText, voice, speed);
      if (cached) { audioUrl = cached; }
      else {
        const res = await fetch('/api/tts/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText, voice_type: voice, speed, store_id: selectedStore || null, play_mode: 'immediate', repeat_count: 1, duck_volume: duckVolume }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        audioUrl = data.audio_url;
        setCachedAudio(fullText, voice, speed, audioUrl);
      }
      let blobUrl: string;
      try {
        blobUrl = await fetchBlobUrl(audioUrl, sessionCacheKey(fullText, voice, speed));
      } catch {
        blobUrl = audioUrl;
      }
      if (player.track) {
        player.playAnnouncement(blobUrl, { duck_volume: duckVolume, play_mode: 'immediate', ann_volume: annVolume });
      } else {
        playAudio(blobUrl, `call_${num}`, Math.min(1, player.annVolume), callRepeat);
      }
      const callAnn = makeAnnouncement(fullText, audioUrl, 'call');
      pushHistoryToLS(callAnn);
      setAnnouncements(prev => [callAnn, ...prev]);
    } catch (e: any) {
      alert(`호출 실패: ${e.message}`);
    } finally {
      setLastCalledNum(num);
      setCallingNum(null);
    }
  };

  // 풀스크린 캐시 바로 재생
  const handleFsCachedCall = async (n: number) => {
    if (callingNum !== null) return;
    const fullText = `${greetingPfx()}${callTemplate.replaceAll('{num}', numToKorean(n))}`;
    const cachedUrl = getCachedAudio(fullText, voice, speed);
    if (!cachedUrl) { handleCallNum(n); return; }
    let playUrl: string;
    try { playUrl = await fetchBlobUrl(cachedUrl, sessionCacheKey(fullText, voice, speed)); }
    catch { playUrl = cachedUrl; }
    playAudio(playUrl, `call_${n}`, Math.min(1, player.annVolume), callRepeat);
    setLastCalledNum(n);
    const callAnn = makeAnnouncement(fullText, cachedUrl, 'call');
    pushHistoryToLS(callAnn);
    setAnnouncements(prev => [callAnn, ...prev]);
  };

  // ── TTS 생성 ──
  const handleGenerate = async () => {
    if (!text.trim()) { alert('안내 문구를 입력하세요'); return; }
    if (!voice || voice === 'fish_') { alert('성우를 선택하세요'); return; }
    setGenerating(true);
    const fullText = `${greetingPfx()}${text.trim()}`;
    try {
      let audioUrl: string;
      const cached = getCachedAudio(fullText, voice, speed);
      if (cached) {
        audioUrl = cached;
        setCacheHit(true);
      } else {
        const res = await fetch('/api/tts/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText, voice_type: voice, speed, store_id: null, play_mode: playMode, repeat_count: repeat, duck_volume: duckVolume }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        audioUrl = data.audio_url;
        setCachedAudio(fullText, voice, speed, audioUrl);
        setCacheHit(true);
      }
      const sKey = sessionCacheKey(fullText, voice, speed);
      let playUrl: string;
      try {
        playUrl = await fetchBlobUrl(audioUrl, sKey);
      } catch {
        // fetchBlobUrl 실패 시 원본 URL로 직접 재생
        playUrl = audioUrl;
      }
      const newAnn = makeAnnouncement(fullText, audioUrl, 'template');
      pushHistoryToLS(newAnn);
      setAnnouncements(prev => [newAnn, ...prev]);
      if (player.track) {
        player.playAnnouncement(playUrl, { duck_volume: duckVolume, play_mode: playMode, ann_volume: annVolume });
      } else {
        playAudio(playUrl, '__new__', Math.min(1, player.annVolume));
      }
    } catch (e: any) {
      alert(`실패: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── 히스토리 재생 ──
  const playWithVolume = async (originalUrl: string, id: string, duckVol: number, pm: 'immediate' | 'between_tracks') => {
    if (announcingId === id) { setAnnouncingId(null); return; }
    let playUrl: string;
    try { playUrl = await fetchBlobUrl(originalUrl, `__hist__${originalUrl}`); }
    catch { playUrl = originalUrl; }
    setAnnouncingId(id);
    if (player.track) {
      player.playAnnouncement(playUrl, { duck_volume: duckVol, play_mode: pm, ann_volume: annVolume });
    } else {
      playAudio(playUrl, id, Math.min(1, player.annVolume));
    }
  };

  useEffect(() => {
    if (!player.announcementPlaying) setAnnouncingId(null);
  }, [player.announcementPlaying]);

  // ── 삭제 ──
  const handleDelete = (id: string) => {
    if (!confirm('안내방송을 삭제할까요?')) return;
    setDeleting(id);
    removeHistoryFromLS(id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    setDeleting(null);
  };

  const handleClearHistory = () => {
    if (!confirm('안내방송 히스토리를 모두 삭제할까요?')) return;
    try { localStorage.removeItem(HISTORY_LS_KEY); } catch {}
    setAnnouncements([]);
  };

  // ── 순서 변경 ──
  const handleReorder = (reordered: Announcement[]) => {
    setAnnouncements(reordered);
    // 전체 히스토리에서 현재 필터 외 항목은 유지
    if (selectedStore) {
      const others = loadHistoryFromLS().filter(a => a.store_id !== selectedStore);
      saveHistoryToLS([...reordered, ...others]);
    } else {
      saveHistoryToLS(reordered);
    }
  };

  // ── 즐겨찾기(핀) 토글 ──
  const handleTogglePin = (id: string) => {
    setAnnouncements(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, pinned: !a.pinned } : a);
      // 핀 항목 상단 정렬
      const pinned = updated.filter(a => a.pinned);
      const unpinned = updated.filter(a => !a.pinned);
      const sorted = [...pinned, ...unpinned];
      if (selectedStore) {
        const others = loadHistoryFromLS().filter(a => a.store_id !== selectedStore);
        saveHistoryToLS([...sorted, ...others]);
      } else {
        saveHistoryToLS(sorted);
      }
      return sorted;
    });
  };

  // ── 문구 수정 + 재생성 ──
  const handleRegenerate = async (ann: Announcement, newText: string) => {
    setRegeneratingId(ann.id);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newText,
          voice_type: ann.voice_type,
          speed,
          store_id: ann.store_id || selectedStore || null,
          play_mode: ann.play_mode,
          repeat_count: ann.repeat_count,
          duck_volume: (ann as any).duck_volume ?? duckVolume,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 히스토리 업데이트 (텍스트 + audio_url 교체)
      setAnnouncements(prev => {
        const updated = prev.map(a => a.id === ann.id ? { ...a, text: newText, audio_url: data.audio_url } : a);
        if (selectedStore) {
          const others = loadHistoryFromLS().filter(a => a.store_id !== selectedStore);
          saveHistoryToLS([...updated.filter(a => a.store_id === selectedStore || !selectedStore), ...others]);
        } else {
          saveHistoryToLS(updated);
        }
        return updated;
      });

      // 즉시 재생
      const updatedAnn = { ...ann, text: newText, audio_url: data.audio_url };
      if (player.track) {
        player.playAnnouncement(data.audio_url, { duck_volume: (ann as any).duck_volume ?? duckVolume, play_mode: ann.play_mode });
      } else {
        playAudio(data.audio_url, ann.id, Math.min(1, player.annVolume));
      }
    } catch (e: any) {
      alert(`재생성 실패: ${e.message}`);
    } finally {
      setRegeneratingId(null);
    }
  };

  // ── 템플릿 ──
  const handleSelectTemplate = (tpl: TtsTemplate, key: string) => {
    if (selectedTplId === key) { setSelectedTplId(null); return; }
    setSelectedTplId(key);
    setText(tpl.text);
    const safeVoice = tpl.voice_type.startsWith('fish_') ? tpl.voice_type : voice;
    setVoice(safeVoice);
    setSpeed(tpl.speed);
    setPlayMode(tpl.play_mode);
    setRepeat(tpl.repeat_count);
    setDuckVolume(tpl.duck_volume);
    checkCache(tpl.text, safeVoice, tpl.speed);
  };

  const handleSaveToTemplate = () => {
    if (!selectedTplId) return;
    persistTemplates(templates.map((t, i) =>
      `${i}` === selectedTplId ? { ...t, text, voice_type: voice, speed, play_mode: playMode, repeat_count: repeat, duck_volume: duckVolume } : t
    ));
  };

  const openTplModal = (tpl: TtsTemplate | null) => {
    setTplEditTarget(tpl);
    setTplModal(true);
  };

  const handleConfirmTpl = (newTpl: TtsTemplate) => {
    const updated = tplEditTarget === null
      ? [...templates, newTpl]
      : templates.map(t => t === tplEditTarget ? newTpl : t);
    persistTemplates(updated);
    setTplModal(false);
  };

  const handleDeleteTpl = (tpl: TtsTemplate) => {
    if (!confirm(`"${tpl.label}" 템플릿을 삭제할까요?`)) return;
    persistTemplates(templates.filter(t => t !== tpl));
    setTplModal(false);
    setSelectedTplId(null);
  };

  // ── 직접 호출 핸들러 ──
  const handleDirectCall = () => {
    const n = parseInt(directCallNum);
    if (!isNaN(n) && n > 0) { handleCallNum(n); setDirectCallNum(''); directCallRef.current?.focus(); }
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <>
    <div className="min-h-screen bg-surface text-primary flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-5 border-b border-border-main flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone size={20} className="text-[#FF6F0F]" />
          <div>
            <h1 className="text-lg font-bold">AI 음성안내</h1>
            <p className="text-xs text-muted">매장 안내방송 생성 및 관리</p>
          </div>
        </div>
        <div className="relative">
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
            className="appearance-none bg-card border border-border-subtle text-sm text-primary rounded-xl px-4 py-2 pr-8 outline-none cursor-pointer">
            <option value="">전체 가게</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* ── 생성 패널 ── */}
        <div className="w-[380px] shrink-0 border-r border-border-main p-5 overflow-y-auto space-y-5">

          {/* 성우 카드 */}
          <VoiceCardGrid
            voice={voice}
            defaultVoice={defaultVoice}
            isSuperadmin={isSuperadmin}
            onSelectVoice={vt => { setVoice(vt); checkCache(text, vt, speed); }}
            onSetDefault={setDefaultVoice}
            onVoicesLoaded={setFishVoices}
          />

          {/* 고객 호출 */}
          <div className="border border-white/8 rounded-2xl overflow-hidden">
            <div className="flex items-center">
              <button onClick={() => setCallOpen(v => !v)}
                className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition">
                <span className="text-xs font-bold text-primary flex items-center gap-2">
                  <Radio size={13} className="text-[#FF6F0F]" /> 고객 호출
                </span>
                <ChevronDown size={13} className={`text-muted transition-transform ${callOpen ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={() => { setCallFullscreen(true); setFsStartDraft(callStartNum); }}
                title="크게보기"
                className="px-3 py-3 text-muted hover:text-primary transition border-l border-border-main">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </button>
            </div>

            {callOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-border-main">
                <div className="pt-3 space-y-1">
                  <label className="text-[10px] text-muted font-semibold">호출 문구 ({'{num}'}은 번호로 대체)</label>
                  <input value={callTemplate}
                    onChange={e => { setCallTemplate(e.target.value); try { localStorage.setItem(CALL_TEMPLATE_KEY, e.target.value); } catch {} }}
                    className="w-full px-3 py-2 bg-white/[0.03] border border-border-subtle rounded-xl text-sm text-primary placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40" />
                  <p className="text-[10px] text-dim">
                    미리보기: <span className="text-tertiary">"{greetingPfx() + callTemplate.replaceAll('{num}', '101')}"</span>
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] text-muted font-semibold">반복</span>
                    {[1, 2].map(n => (
                      <button key={n} onClick={() => setCallRepeat(n)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                          callRepeat === n ? 'bg-[#FF6F0F] text-primary' : 'bg-white/[0.04] text-tertiary hover:bg-white/[0.08]'
                        }`}>{n}회</button>
                    ))}
                  </div>
                </div>

                {/* 즉시 호출 */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted font-semibold">⚡ 즉시 호출 (번호 입력 후 Enter)</label>
                  <div className="flex gap-2">
                    <input ref={directCallRef} type="number" value={directCallNum}
                      onChange={e => setDirectCallNum(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleDirectCall(); }}
                      placeholder="번호 입력"
                      className="flex-1 px-3 py-2 bg-white/[0.03] border border-border-subtle rounded-xl text-sm text-primary placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40 [appearance:textfield]" />
                    <button onClick={handleDirectCall} disabled={callingNum !== null || !directCallNum}
                      className="px-4 py-2 bg-[#FF6F0F] text-primary text-sm font-bold rounded-xl disabled:opacity-40 transition hover:bg-[#FF6F0F]/90">
                      {callingNum !== null ? <Loader2 size={14} className="animate-spin" /> : '호출'}
                    </button>
                  </div>
                </div>

                {/* 번호 그리드 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted font-semibold">시작 번호</label>
                    <input type="number" value={callStartNum} onChange={e => setCallStartNum(e.target.value)}
                      placeholder="예) 100"
                      className="w-24 px-2 py-1 bg-white/[0.03] border border-border-subtle rounded-lg text-xs text-primary placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40 [appearance:textfield]" />
                    {callStartNum && <span className="text-[10px] text-dim">{callStartNum} ~ {Number(callStartNum) + CALL_CARD_COUNT - 1}</span>}
                  </div>
                  <CallNumberGrid
                    callStartNum={callStartNum} callingNum={callingNum} lastCalledNum={lastCalledNum}
                    size="small" onCallNum={handleCallNum}
                    isCached={n => !!getCachedAudio(`${greetingPfx()}${callTemplate.replaceAll('{num}', String(n))}`, voice, speed)}
                  />
                  {!callStartNum && (
                    <p className="text-[10px] text-dim text-center py-3">시작 번호를 입력하면 번호 카드가 나타납니다</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 템플릿 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted font-semibold flex items-center gap-1.5">
                <BookMarked size={11} /> 템플릿
              </label>
              <button onClick={() => openTplModal(null)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-[#FF6F0F]/10 border border-[#FF6F0F]/20 text-[#FF6F0F] hover:bg-[#FF6F0F]/20 transition">
                <Plus size={9} /> 추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl, i) => {
                const key = `${i}`;
                const isActive = selectedTplId === key;
                return (
                  <div key={key} className="relative group">
                    <button onClick={() => handleSelectTemplate(tpl, key)}
                      className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl border transition min-w-[56px] ${
                        isActive ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50' : 'bg-white/[0.03] border-border-subtle hover:border-border-main'
                      }`}>
                      <span className="text-xl leading-none">{tpl.emoji}</span>
                      <span className={`text-[9px] font-bold mt-0.5 text-center leading-tight ${isActive ? 'text-[#FF6F0F]' : 'text-tertiary'}`}>
                        {tpl.label}
                      </span>
                      {tpl.sched_time !== '' && <span className="text-[8px]">⏰</span>}
                    </button>
                    <button onClick={e => { e.stopPropagation(); openTplModal(tpl); }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-card border border-border-main flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Pencil size={7} className="text-tertiary" />
                    </button>
                  </div>
                );
              })}
            </div>
            {selectedTplId !== null && (
              <div className="flex items-center gap-2">
                <button onClick={handleSaveToTemplate}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-fill-subtle border border-border-subtle text-tertiary hover:text-primary hover:border-border-main transition">
                  <BookMarked size={9} /> 📌 현재 설정을 템플릿에 저장
                </button>
                <button onClick={() => setSelectedTplId(null)} className="text-[10px] text-dim hover:text-tertiary">
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          {/* 인사말 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted font-semibold">👋 인사말</label>
              <button onClick={() => setGreetingOn(v => !v)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition ${
                  greetingOn ? 'bg-[#FF6F0F]/20 text-[#FF6F0F]' : 'bg-fill-subtle text-muted'
                }`}>{greetingOn ? 'ON' : 'OFF'}</button>
            </div>
            <input value={greeting}
              onChange={e => { setGreeting(e.target.value); try { localStorage.setItem(GREETING_KEY, e.target.value); } catch {} }}
              placeholder="예) 안녕하세요, 고객 여러분."
              className={`w-full px-3 py-2 border rounded-xl text-sm text-primary placeholder-gray-600 outline-none transition ${
                greetingOn ? 'bg-[#FF6F0F]/5 border-[#FF6F0F]/20 focus:border-[#FF6F0F]/40' : 'bg-white/[0.02] border-border-main opacity-40'
              }`} disabled={!greetingOn} />
            {greetingOn && greeting.trim() && (
              <p className="text-[10px] text-dim px-1">미리보기: <span className="text-tertiary">"{greeting.trim()} (안내 문구...)"</span></p>
            )}
          </div>

          {/* 안내 문구 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted font-semibold">🎙 안내 문구 *</label>
              <div className="flex items-center gap-2">
                {cacheHit && <span className="flex items-center gap-1 text-[10px] text-green-400"><DatabaseZap size={9} /> 캐시</span>}
                <span className={`text-[10px] ${text.length > 180 ? 'text-red-400' : 'text-dim'}`}>{text.length}/200</span>
              </div>
            </div>
            <textarea value={text}
              onChange={e => { const v = e.target.value.slice(0, 200); setText(v); checkCache(v, voice, speed); }}
              rows={3} placeholder="안내 문구를 입력하세요"
              className="w-full bg-card border border-border-subtle text-sm text-primary rounded-xl px-3 py-2.5 outline-none placeholder-gray-600 resize-none" />
            {/* 운율 태그 힌트 */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-dim">운율 태그:</span>
              {[
                { tag: '[laughs]', label: '😄 웃음' },
                { tag: '[sighs]', label: '😮‍💨 한숨' },
                { tag: '[clears throat]', label: '🗣 헛기침' },
                { tag: '[gasps]', label: '😲 놀람' },
                { tag: '[pauses]', label: '⏸ 멈춤' },
              ].map(({ tag, label }) => (
                <button key={tag}
                  onClick={() => {
                    const el = document.querySelector('textarea') as HTMLTextAreaElement | null;
                    if (!el) return;
                    const start = el.selectionStart ?? text.length;
                    const next = text.slice(0, start) + tag + text.slice(start);
                    if (next.length <= 200) { setText(next); checkCache(next, voice, speed); }
                  }}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-fill-subtle text-muted hover:text-[#FF6F0F] hover:bg-[#FF6F0F]/10 border border-border-subtle transition"
                  title={`"${tag}" 삽입`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 생성 버튼 */}
          <button onClick={handleGenerate} disabled={generating || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#FF6F0F] text-primary text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {generating
              ? <><Loader2 size={16} className="animate-spin" /> {cacheHit ? '재사용 중...' : '생성 중...'}</>
              : cacheHit
                ? <><DatabaseZap size={16} /> 캐시 재사용 · 방송하기</>
                : <><Volume2 size={16} /> 템플릿음성생성</>
            }
          </button>
          <p className="text-[10px] text-dim text-center">
            {cacheHit ? '동일 문구·목소리 → 캐시 재사용 (API 미호출)' : 'Fish Audio TTS · 생성 후 즉시 미리듣기'}
          </p>
          {!cacheHit && (
            <p className="text-[9px] text-center font-mono text-[#FF6F0F]/40">Fish Audio · s2-pro</p>
          )}

          {/* 재생 모드 + 반복 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs text-muted font-semibold">📡 방송 방식</label>
              <div className="space-y-1">
                {PLAY_MODES.map(m => (
                  <button key={m.value} onClick={() => setPlayMode(m.value as any)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      playMode === m.value ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/[0.03] border-border-subtle text-tertiary hover:border-border-main'
                    }`}>{m.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted font-semibold">🔁 반복</label>
              <div className="space-y-1">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setRepeat(n)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      repeat === n ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/[0.03] border-border-subtle text-tertiary hover:border-border-main'
                    }`}>{n}회</button>
                ))}
              </div>
            </div>
          </div>

          {/* 안내방송 볼륨 — 하단 플레이어에서 제어 */}

          {/* 덕킹 — UI 숨김, 기능 유지 (duckVolume 기본값 사용) */}
        </div>

        {/* ── 목록 패널 ── */}
        <AnnouncementHistory
          announcements={announcements} stores={stores} fishVoices={fishVoices}
          selectedStore={selectedStore} playingId={playingId} announcingId={announcingId}
          announcementPlaying={player.announcementPlaying} deleting={deleting} loading={loading}
          hasTrack={!!player.track}
          onPlay={ann => { if (ann.audio_url) playWithVolume(ann.audio_url, ann.id, (ann as any).duck_volume ?? 20, ann.play_mode); }}
          onBroadcast={ann => { if (ann.audio_url) playWithVolume(ann.audio_url, ann.id, (ann as any).duck_volume ?? 20, ann.play_mode); }}
          onDelete={handleDelete}
          onClearAll={handleClearHistory}
          onReorder={handleReorder}
          onTogglePin={handleTogglePin}
          onRegenerate={handleRegenerate}
          regeneratingId={regeneratingId}
        />
      </div>
    </div>

    {/* ── 고객 호출 풀스크린 ── */}
    {callFullscreen && (
      <div className="fixed inset-0 z-50 bg-[#080A0E] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <Radio size={18} className="text-[#FF6F0F]" />
            <span className="text-base font-bold text-primary">고객 호출</span>
            {lastCalledNum && callingNum === null && (
              <span className="text-sm text-tertiary">마지막 호출: <span className="text-primary font-bold">{lastCalledNum}번</span></span>
            )}
            {callingNum !== null && (
              <span className="flex items-center gap-2 text-[#FF6F0F] font-bold text-sm">
                <Loader2 size={14} className="animate-spin" /> {callingNum}번 호출 중...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <input type="number" value={directCallNum}
                onChange={e => setDirectCallNum(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleDirectCall(); }}
                placeholder="직접 입력"
                className="w-28 px-3 py-2 bg-white/[0.05] border border-white/15 rounded-xl text-sm text-primary placeholder-gray-600 outline-none focus:border-[#FF6F0F]/50 [appearance:textfield]" />
              <button onClick={handleDirectCall} disabled={callingNum !== null || !directCallNum}
                className="px-4 py-2 bg-[#FF6F0F] text-primary text-sm font-bold rounded-xl disabled:opacity-40 transition hover:bg-[#FF6F0F]/90">호출</button>
            </div>
            <button onClick={() => setCallFullscreen(false)} className="p-2 text-tertiary hover:text-primary transition rounded-xl hover:bg-fill-medium">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {callStartNum && !isNaN(Number(callStartNum)) ? (
            <CallNumberGrid
              callStartNum={callStartNum} callingNum={callingNum} lastCalledNum={lastCalledNum}
              size="large" onCallNum={handleFsCachedCall}
              isCached={n => !!getCachedAudio(`${greetingPfx()}${callTemplate.replaceAll('{num}', String(n))}`, voice, speed)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-dim">
              <Radio size={48} className="opacity-20" />
              <p className="text-lg">시작 번호를 설정하세요</p>
              <input type="number" value={fsStartDraft}
                onChange={e => setFsStartDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && fsStartDraft && !isNaN(Number(fsStartDraft))) setCallStartNum(fsStartDraft); }}
                onBlur={() => { if (fsStartDraft && !isNaN(Number(fsStartDraft))) setCallStartNum(fsStartDraft); }}
                placeholder="시작 번호 입력 (예: 100)"
                className="w-56 px-4 py-3 bg-white/[0.05] border border-white/15 rounded-2xl text-base text-primary text-center placeholder-gray-600 outline-none focus:border-[#FF6F0F]/50 [appearance:textfield]" />
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-white/8 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted shrink-0">시작</span>
            <input type="number" value={callStartNum}
              onChange={e => { setCallStartNum(e.target.value); setFsStartDraft(e.target.value); }}
              placeholder="번호"
              className="w-20 px-2 py-1 bg-white/[0.05] border border-border-subtle rounded-lg text-xs text-primary placeholder-gray-600 outline-none focus:border-[#FF6F0F]/50 [appearance:textfield]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted shrink-0">반복</span>
            {[1, 2].map(n => (
              <button key={n} onClick={() => setCallRepeat(n)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${callRepeat === n ? 'bg-[#FF6F0F] text-primary' : 'bg-white/[0.05] text-tertiary hover:bg-fill-medium'}`}>{n}회</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[11px] text-muted shrink-0">문구</span>
            <input value={callTemplate}
              onChange={e => { setCallTemplate(e.target.value); try { localStorage.setItem(CALL_TEMPLATE_KEY, e.target.value); } catch {} }}
              placeholder="{num}번 고객님..."
              className="flex-1 min-w-0 px-2 py-1 bg-white/[0.05] border border-border-subtle rounded-lg text-xs text-primary placeholder-gray-600 outline-none focus:border-[#FF6F0F]/50" />
          </div>
        </div>
      </div>
    )}

    {/* ── 템플릿 모달 ── */}
    {tplModal && (
      <TemplateModal
        target={tplEditTarget}
        fishVoices={fishVoices}
        onConfirm={handleConfirmTpl}
        onDelete={handleDeleteTpl}
        onClose={() => setTplModal(false)}
      />
    )}
    </>
  );
}
