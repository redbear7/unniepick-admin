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
  loadHistoryFromLS, pushHistoryToLS, removeHistoryFromLS,
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
      const blobUrl = await fetchBlobUrl(audioUrl, sessionCacheKey(fullText, voice, speed));
      if (player.track) {
        player.playAnnouncement(blobUrl, { duck_volume: duckVolume, play_mode: 'immediate', ann_volume: annVolume });
      } else {
        playAudio(blobUrl, `call_${num}`, player.volume * annVolume / 100, callRepeat);
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
    const playUrl = await fetchBlobUrl(cachedUrl, sessionCacheKey(fullText, voice, speed));
    playAudio(playUrl, `call_${n}`, player.volume * annVolume / 100, callRepeat);
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
      if (cached) { audioUrl = cached; }
      else {
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
      const playUrl = await fetchBlobUrl(audioUrl, sessionCacheKey(fullText, voice, speed));
      const newAnn = makeAnnouncement(fullText, audioUrl, 'template');
      pushHistoryToLS(newAnn);
      setAnnouncements(prev => [newAnn, ...prev]);
      if (player.track) {
        player.playAnnouncement(playUrl, { duck_volume: duckVolume, play_mode: playMode, ann_volume: annVolume });
      } else {
        playAudio(playUrl, '__new__', player.volume * annVolume / 100);
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
      playAudio(playUrl, id, player.volume * annVolume / 100);
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
    <div className="min-h-screen bg-[#0D0F14] text-white flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone size={20} className="text-[#FF6F0F]" />
          <div>
            <h1 className="text-lg font-bold">AI 음성안내</h1>
            <p className="text-xs text-gray-500">매장 안내방송 생성 및 관리</p>
          </div>
        </div>
        <div className="relative">
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
            className="appearance-none bg-[#1A1D23] border border-white/10 text-sm text-white rounded-xl px-4 py-2 pr-8 outline-none cursor-pointer">
            <option value="">전체 가게</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* ── 생성 패널 ── */}
        <div className="w-[380px] shrink-0 border-r border-white/5 p-5 overflow-y-auto space-y-5">

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
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Radio size={13} className="text-[#FF6F0F]" /> 고객 호출
                </span>
                <ChevronDown size={13} className={`text-gray-500 transition-transform ${callOpen ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={() => { setCallFullscreen(true); setFsStartDraft(callStartNum); }}
                title="크게보기"
                className="px-3 py-3 text-gray-500 hover:text-white transition border-l border-white/5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </button>
            </div>

            {callOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                <div className="pt-3 space-y-1">
                  <label className="text-[10px] text-gray-500 font-semibold">호출 문구 ({'{num}'}은 번호로 대체)</label>
                  <input value={callTemplate}
                    onChange={e => { setCallTemplate(e.target.value); try { localStorage.setItem(CALL_TEMPLATE_KEY, e.target.value); } catch {} }}
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40" />
                  <p className="text-[10px] text-gray-600">
                    미리보기: <span className="text-gray-400">"{greetingPfx() + callTemplate.replaceAll('{num}', '101')}"</span>
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] text-gray-500 font-semibold">반복</span>
                    {[1, 2].map(n => (
                      <button key={n} onClick={() => setCallRepeat(n)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                          callRepeat === n ? 'bg-[#FF6F0F] text-white' : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
                        }`}>{n}회</button>
                    ))}
                  </div>
                </div>

                {/* 즉시 호출 */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-semibold">⚡ 즉시 호출 (번호 입력 후 Enter)</label>
                  <div className="flex gap-2">
                    <input ref={directCallRef} type="number" value={directCallNum}
                      onChange={e => setDirectCallNum(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleDirectCall(); }}
                      placeholder="번호 입력"
                      className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40 [appearance:textfield]" />
                    <button onClick={handleDirectCall} disabled={callingNum !== null || !directCallNum}
                      className="px-4 py-2 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl disabled:opacity-40 transition hover:bg-[#FF6F0F]/90">
                      {callingNum !== null ? <Loader2 size={14} className="animate-spin" /> : '호출'}
                    </button>
                  </div>
                </div>

                {/* 번호 그리드 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500 font-semibold">시작 번호</label>
                    <input type="number" value={callStartNum} onChange={e => setCallStartNum(e.target.value)}
                      placeholder="예) 100"
                      className="w-24 px-2 py-1 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40 [appearance:textfield]" />
                    {callStartNum && <span className="text-[10px] text-gray-600">{callStartNum} ~ {Number(callStartNum) + CALL_CARD_COUNT - 1}</span>}
                  </div>
                  <CallNumberGrid
                    callStartNum={callStartNum} callingNum={callingNum} lastCalledNum={lastCalledNum}
                    size="small" onCallNum={handleCallNum}
                    isCached={n => !!getCachedAudio(`${greetingPfx()}${callTemplate.replaceAll('{num}', String(n))}`, voice, speed)}
                  />
                  {!callStartNum && (
                    <p className="text-[10px] text-gray-600 text-center py-3">시작 번호를 입력하면 번호 카드가 나타납니다</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 템플릿 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
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
                        isActive ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50' : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                      }`}>
                      <span className="text-xl leading-none">{tpl.emoji}</span>
                      <span className={`text-[9px] font-bold mt-0.5 text-center leading-tight ${isActive ? 'text-[#FF6F0F]' : 'text-gray-400'}`}>
                        {tpl.label}
                      </span>
                      {tpl.sched_time !== '' && <span className="text-[8px]">⏰</span>}
                    </button>
                    <button onClick={e => { e.stopPropagation(); openTplModal(tpl); }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1A1D23] border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Pencil size={7} className="text-gray-400" />
                    </button>
                  </div>
                );
              })}
            </div>
            {selectedTplId !== null && (
              <div className="flex items-center gap-2">
                <button onClick={handleSaveToTemplate}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition">
                  <BookMarked size={9} /> 📌 현재 설정을 템플릿에 저장
                </button>
                <button onClick={() => setSelectedTplId(null)} className="text-[10px] text-gray-600 hover:text-gray-400">
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          {/* 인사말 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold">👋 인사말</label>
              <button onClick={() => setGreetingOn(v => !v)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition ${
                  greetingOn ? 'bg-[#FF6F0F]/20 text-[#FF6F0F]' : 'bg-white/5 text-gray-500'
                }`}>{greetingOn ? 'ON' : 'OFF'}</button>
            </div>
            <input value={greeting}
              onChange={e => { setGreeting(e.target.value); try { localStorage.setItem(GREETING_KEY, e.target.value); } catch {} }}
              placeholder="예) 안녕하세요, 고객 여러분."
              className={`w-full px-3 py-2 border rounded-xl text-sm text-white placeholder-gray-600 outline-none transition ${
                greetingOn ? 'bg-[#FF6F0F]/5 border-[#FF6F0F]/20 focus:border-[#FF6F0F]/40' : 'bg-white/[0.02] border-white/5 opacity-40'
              }`} disabled={!greetingOn} />
            {greetingOn && greeting.trim() && (
              <p className="text-[10px] text-gray-600 px-1">미리보기: <span className="text-gray-400">"{greeting.trim()} (안내 문구...)"</span></p>
            )}
          </div>

          {/* 안내 문구 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold">🎙 안내 문구 *</label>
              <div className="flex items-center gap-2">
                {cacheHit && <span className="flex items-center gap-1 text-[10px] text-green-400"><DatabaseZap size={9} /> 캐시</span>}
                <span className={`text-[10px] ${text.length > 180 ? 'text-red-400' : 'text-gray-600'}`}>{text.length}/200</span>
              </div>
            </div>
            <textarea value={text}
              onChange={e => { const v = e.target.value.slice(0, 200); setText(v); checkCache(v, voice, speed); }}
              rows={3} placeholder="안내 문구를 입력하세요"
              className="w-full bg-[#1A1D23] border border-white/10 text-sm text-white rounded-xl px-3 py-2.5 outline-none placeholder-gray-600 resize-none" />
          </div>

          {/* 생성 버튼 */}
          <button onClick={handleGenerate} disabled={generating || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {generating
              ? <><Loader2 size={16} className="animate-spin" /> {cacheHit ? '재사용 중...' : '생성 중...'}</>
              : cacheHit
                ? <><DatabaseZap size={16} /> 캐시 재사용 · 방송하기</>
                : <><Volume2 size={16} /> 템플릿음성생성</>
            }
          </button>
          <p className="text-[10px] text-gray-600 text-center">
            {cacheHit ? '동일 문구·목소리 → 캐시 재사용 (API 미호출)' : 'Fish Audio TTS · 생성 후 즉시 미리듣기'}
          </p>

          {/* 속도 */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-semibold">⚡ 속도</label>
            <div className="flex gap-1.5">
              {SPEED_OPTIONS.map(s => (
                <button key={s} onClick={() => { setSpeed(s); checkCache(text, voice, s); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    speed === s ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                  }`}>{s}x</button>
              ))}
            </div>
          </div>

          {/* 재생 모드 + 반복 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-semibold">📡 방송 방식</label>
              <div className="space-y-1">
                {PLAY_MODES.map(m => (
                  <button key={m.value} onClick={() => setPlayMode(m.value as any)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      playMode === m.value ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                    }`}>{m.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-semibold">🔁 반복</label>
              <div className="space-y-1">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setRepeat(n)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      repeat === n ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                    }`}>{n}회</button>
                ))}
              </div>
            </div>
          </div>

          {/* 안내방송 볼륨 */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold">📢 안내방송 볼륨</label>
              <span className={`text-xs font-bold ${annVolume > 100 ? 'text-yellow-400' : 'text-[#FF6F0F]'}`}>{annVolume}%</span>
            </div>
            <input type="range" min={50} max={200} step={5}
              value={annVolume} onChange={e => { setAnnVolume(Number(e.target.value)); checkCache(text, voice, speed); }}
              className="w-full h-1.5 rounded-full cursor-pointer" style={{ accentColor: annVolume > 100 ? '#facc15' : '#FF6F0F' }} />
            <div className="flex justify-between text-[9px] text-gray-600">
              <span>50%</span><span className="text-gray-500">100% = 음악 볼륨</span><span>200%</span>
            </div>
            {annVolume > 100 && <p className="text-[10px] text-yellow-500/80">⚡ 부스트 모드 · audio.volume 최대 적용 (1.0 클램프)</p>}
          </div>

          {/* 덕킹 */}
          {playMode === 'immediate' && (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500 font-semibold">🔉 안내방송 중 트랙 볼륨</label>
                <span className="text-xs font-bold text-[#FF6F0F]">{duckVolume}%</span>
              </div>
              <input type="range" min={0} max={80} step={5}
                value={duckVolume} onChange={e => setDuckVolume(Number(e.target.value))}
                className="w-full h-1.5 rounded-full cursor-pointer" style={{ accentColor: '#FF6F0F' }} />
              <p className="text-[10px] text-gray-600">안내방송 시작 시 트랙을 {duckVolume}%로 페이드 아웃 → 방송 종료 후 원래 볼륨으로 페이드 인</p>
            </div>
          )}
          {playMode === 'between_tracks' && (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
              <p className="text-[10px] text-gray-600">현재 곡이 완전히 끝난 후 안내방송 → 다음 곡 자동 재생</p>
            </div>
          )}
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
        />
      </div>
    </div>

    {/* ── 고객 호출 풀스크린 ── */}
    {callFullscreen && (
      <div className="fixed inset-0 z-50 bg-[#080A0E] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <Radio size={18} className="text-[#FF6F0F]" />
            <span className="text-base font-bold text-white">고객 호출</span>
            {lastCalledNum && callingNum === null && (
              <span className="text-sm text-gray-400">마지막 호출: <span className="text-white font-bold">{lastCalledNum}번</span></span>
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
                className="w-28 px-3 py-2 bg-white/[0.05] border border-white/15 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/50 [appearance:textfield]" />
              <button onClick={handleDirectCall} disabled={callingNum !== null || !directCallNum}
                className="px-4 py-2 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl disabled:opacity-40 transition hover:bg-[#FF6F0F]/90">호출</button>
            </div>
            <button onClick={() => setCallFullscreen(false)} className="p-2 text-gray-400 hover:text-white transition rounded-xl hover:bg-white/10">
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
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
              <Radio size={48} className="opacity-20" />
              <p className="text-lg">시작 번호를 설정하세요</p>
              <input type="number" value={fsStartDraft}
                onChange={e => setFsStartDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && fsStartDraft && !isNaN(Number(fsStartDraft))) setCallStartNum(fsStartDraft); }}
                onBlur={() => { if (fsStartDraft && !isNaN(Number(fsStartDraft))) setCallStartNum(fsStartDraft); }}
                placeholder="시작 번호 입력 (예: 100)"
                className="w-56 px-4 py-3 bg-white/[0.05] border border-white/15 rounded-2xl text-base text-white text-center placeholder-gray-600 outline-none focus:border-[#FF6F0F]/50 [appearance:textfield]" />
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-white/8 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 shrink-0">시작</span>
            <input type="number" value={callStartNum}
              onChange={e => { setCallStartNum(e.target.value); setFsStartDraft(e.target.value); }}
              placeholder="번호"
              className="w-20 px-2 py-1 bg-white/[0.05] border border-white/10 rounded-lg text-xs text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/50 [appearance:textfield]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 shrink-0">반복</span>
            {[1, 2].map(n => (
              <button key={n} onClick={() => setCallRepeat(n)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${callRepeat === n ? 'bg-[#FF6F0F] text-white' : 'bg-white/[0.05] text-gray-400 hover:bg-white/10'}`}>{n}회</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[11px] text-gray-500 shrink-0">문구</span>
            <input value={callTemplate}
              onChange={e => { setCallTemplate(e.target.value); try { localStorage.setItem(CALL_TEMPLATE_KEY, e.target.value); } catch {} }}
              placeholder="{num}번 고객님..."
              className="flex-1 min-w-0 px-2 py-1 bg-white/[0.05] border border-white/10 rounded-lg text-xs text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/50" />
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
