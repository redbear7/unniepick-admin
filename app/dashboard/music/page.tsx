'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { usePlayer } from '@/contexts/PlayerContext';

// ─── 타입 ─────────────────────────────────────────────────────
interface Store {
  id:       string;
  name:     string;
  category: string | null;
}

interface GeneratedTrack {
  id:             string;
  store_id:       string;
  title:          string | null;
  style_tags:     string[];
  style_prompt:   string | null;
  bpm_estimate:   number | null;
  audio_url:      string | null;
  image_url:      string | null;
  mood_embedding: [number, number, number] | null;
  suno_status:    'generating' | 'done' | 'error';
  confirm_status: 'pending' | 'liked' | 'disliked';
  confirm_count:  number;
  error_msg:      string | null;
  created_at:     string;
}

// ─── 스타일 프리셋 ─────────────────────────────────────────────
const PRESETS = [
  { label: 'K-pop', tags: ['K-pop', 'upbeat', 'synth', 'female vocals', '120 BPM'] },
  { label: '카페 재즈', tags: ['jazz', 'acoustic', 'chill', 'piano', '80 BPM'] },
  { label: '편의점 BGM', tags: ['j-pop', 'bright', 'cute', 'light', '100 BPM'] },
  { label: '헬스장 EDM', tags: ['EDM', 'electronic', 'high energy', 'drops', '140 BPM'] },
  { label: '레스토랑', tags: ['bossa nova', 'smooth', 'elegant', 'guitar', '90 BPM'] },
  { label: 'Lo-fi Hip-hop', tags: ['hip-hop', 'lo-fi', 'chill', 'trap beats', '95 BPM'] },
];

// ─── Suno 폴링 헬퍼 ──────────────────────────────────────────
async function pollSuno(sunoUrl: string, sunoId: string, maxMs = 5 * 60_000): Promise<{
  audioUrl?: string; imageUrl?: string; duration?: number; title?: string;
} | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, 8000));
    try {
      const res = await fetch(`${sunoUrl}/api/get?ids=${sunoId}`);
      if (!res.ok) continue;
      const songs: any[] = await res.json();
      const song = songs.find((s: any) => s.id === sunoId);
      if (!song) continue;
      if (song.status === 'complete' || song.audio_url) {
        return { audioUrl: song.audio_url, imageUrl: song.image_url, duration: song.duration, title: song.title };
      }
      if (song.status === 'error') return null;
    } catch { /* continue */ }
  }
  return null;
}

export default function MusicPage() {
  const sb     = createClient();
  const player = usePlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── 데이터
  const [stores,   setStores]   = useState<Store[]>([]);
  const [storeId,  setStoreId]  = useState('');
  const [storeDNA, setStoreDNA] = useState<string[]>([]);
  const [library,  setLibrary]  = useState<GeneratedTrack[]>([]);

  // ── Suno 설정
  const [sunoUrl, setSunoUrl] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('admin_suno_url') ?? '' : ''
  );
  const [urlEdit, setUrlEdit] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  // ── 스타일
  const [tags,    setTags]    = useState<string[]>([]);
  const [custom,  setCustom]  = useState('');
  const [bpm,     setBpm]     = useState('100');

  // ── 생성 상태
  type GenState = 'idle' | 'generating' | 'ready' | 'confirmed';
  const [genState,   setGenState]   = useState<GenState>('idle');
  const [genMsg,     setGenMsg]     = useState('');
  const [tryCount,   setTryCount]   = useState(1);
  const [curTrack,   setCurTrack]   = useState<GeneratedTrack | null>(null);

  // ── 오디오
  const [playing, setPlaying] = useState(false);
  const [libPlay, setLibPlay] = useState<string | null>(null);

  // ── 탭
  const [tab, setTab] = useState<'create' | 'library'>('create');

  // ── 로그
  const [logs,       setLogs]       = useState<string[]>([]);
  const [logVisible, setLogVisible] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus,  setTestStatus]  = useState<'idle'|'ok'|'error'>('idle');
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'))
      .then(() => alert('로그 복사됨'))
      .catch(() => alert('복사 실패'));
  };

  const testConnection = async () => {
    if (!sunoUrl) { alert('Suno API URL을 먼저 입력하세요'); return; }
    setTestLoading(true);
    setTestStatus('idle');
    addLog(`🔗 연결 테스트 시작: ${sunoUrl}`);
    try {
      const res = await fetch(`${sunoUrl}/api/get_limit`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const msg = `✅ 연결 성공 — 남은 크레딧: ${data.credits_left ?? '?'} / 월 한도: ${data.monthly_limit ?? '?'}`;
      addLog(msg);
      setTestStatus('ok');
    } catch (e: any) {
      addLog(`❌ 연결 실패: ${e.message}`);
      setTestStatus('error');
    } finally {
      setTestLoading(false);
    }
  };

  // ── 초기 로드
  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (storeId) { loadDNA(); loadLibrary(); }
  }, [storeId]);

  const loadStores = async () => {
    const { data } = await sb.from('stores').select('id, name, category').order('name');
    setStores((data ?? []) as Store[]);
    if (data && data.length > 0) setStoreId(data[0].id);
  };

  const loadDNA = async () => {
    const { data } = await sb
      .from('generated_tracks')
      .select('style_tags')
      .eq('store_id', storeId)
      .eq('confirm_status', 'liked');
    const freq: Record<string, number> = {};
    (data ?? []).forEach((t: any) =>
      (t.style_tags ?? []).forEach((tag: string) => { freq[tag] = (freq[tag] ?? 0) + 1; })
    );
    const dna = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 20);
    setStoreDNA(dna);
    if (tags.length === 0 && dna.length > 0) setTags(dna.slice(0, 6));
  };

  const loadLibrary = async () => {
    const { data } = await sb
      .from('generated_tracks')
      .select('*')
      .eq('store_id', storeId)
      .eq('confirm_status', 'liked')
      .order('created_at', { ascending: false });
    setLibrary((data ?? []) as GeneratedTrack[]);
  };

  // ── URL 저장
  const saveUrl = () => {
    const u = urlDraft.trim();
    setSunoUrl(u);
    localStorage.setItem('admin_suno_url', u);
    setUrlEdit(false);
  };

  // ── 태그 토글
  const toggleTag = (tag: string) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const addCustom = () => {
    const t = custom.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setCustom('');
  };

  const applyPreset = (presetTags: string[]) => {
    setTags(presetTags);
    const b = presetTags.find(t => t.includes('BPM'));
    if (b) { const n = parseInt(b); if (!isNaN(n)) setBpm(String(n)); }
  };

  // ── 음악 생성
  const generate = async (retryTags?: string[]) => {
    if (!storeId) { alert('매장을 선택해주세요'); return; }
    if (!sunoUrl) { alert('Suno API URL을 입력해주세요'); return; }
    const useTags = retryTags ?? tags;
    if (useTags.length === 0) { alert('스타일 태그를 선택해주세요'); return; }

    stopAudio();
    setGenState('generating');
    setLogVisible(true);
    const log = (msg: string) => { setGenMsg(msg); addLog(msg); };

    log('🤖 스타일 프롬프트 구성 중...');
    setCurTrack(null);

    try {
      const bpmNum  = parseInt(bpm) || 100;
      const bpmTag  = `${bpmNum} BPM`;
      const allTags = useTags.includes(bpmTag) ? useTags : [...useTags, bpmTag];
      const prompt  = allTags.slice(0, 12).join(', ');
      const title   = `AI Track ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;

      addLog(`📋 프롬프트: ${prompt}`);

      // avg mood vector from DNA
      const { data: likedRows } = await sb
        .from('generated_tracks')
        .select('mood_embedding')
        .eq('store_id', storeId)
        .eq('confirm_status', 'liked');
      const vecs = (likedRows ?? []).filter((r: any) => r.mood_embedding);
      const mv = vecs.length > 0
        ? vecs.reduce((acc: number[], r: any) =>
            [acc[0] + r.mood_embedding[0], acc[1] + r.mood_embedding[1], acc[2] + r.mood_embedding[2]],
            [0, 0, 0]
          ).map((v: number) => Math.round((v / vecs.length) * 100) / 100)
        : [0.6, 0.6, 0.5];

      log('💾 트랙 레코드 생성 중...');
      const { data: track, error: insErr } = await sb
        .from('generated_tracks')
        .insert({
          store_id:       storeId,
          title,
          style_prompt:   prompt,
          style_tags:     allTags,
          mood_embedding: mv,
          bpm_estimate:   bpmNum,
          suno_status:    'generating',
        })
        .select()
        .single();

      if (insErr || !track) throw new Error(insErr?.message ?? '트랙 생성 실패');
      addLog(`✅ DB 레코드 생성 완료 (id: ${track.id.slice(0, 8)}...)`);

      log('🎵 Suno API 요청 중...');

      // Suno POST
      const reqBody = { prompt: '', tags: prompt, title, make_instrumental: true, wait_audio: false };
      addLog(`📤 POST ${sunoUrl}/api/custom_generate`);
      addLog(`   body: ${JSON.stringify(reqBody)}`);

      const genRes = await fetch(`${sunoUrl}/api/custom_generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      const rawText = await genRes.text();
      addLog(`📥 HTTP ${genRes.status}: ${rawText.slice(0, 200)}`);

      if (!genRes.ok) {
        let errMsg = `Suno API ${genRes.status}`;
        try { errMsg = JSON.parse(rawText)?.error ?? errMsg; } catch {}
        throw new Error(errMsg);
      }

      const genJson = JSON.parse(rawText);
      const sunoId  = (genJson ?? [])[0]?.id;
      if (!sunoId) throw new Error('Suno ID 없음 — 응답: ' + rawText.slice(0, 100));
      addLog(`🎶 Suno ID: ${sunoId}`);

      log('⏳ 생성 완료 대기 중... (3~5분)');
      const result = await pollSuno(sunoUrl, sunoId);

      if (!result?.audioUrl) {
        addLog('❌ Suno 생성 시간 초과 또는 실패');
        await sb.from('generated_tracks').update({ suno_status: 'error', error_msg: '생성 시간 초과' }).eq('id', track.id);
        throw new Error('Suno 생성 시간 초과 또는 실패');
      }
      addLog(`✅ 생성 완료: ${result.title ?? title}`);

      await sb.from('generated_tracks').update({
        suno_id:    sunoId,
        title:      result.title ?? title,
        audio_url:  result.audioUrl,
        image_url:  result.imageUrl ?? null,
        duration:   result.duration ? Math.round(result.duration) : null,
        suno_status: 'done',
      }).eq('id', track.id);

      const { data: done } = await sb.from('generated_tracks').select('*').eq('id', track.id).single();
      if (!done) throw new Error('트랙 조회 실패');

      setCurTrack(done as GeneratedTrack);
      setGenState('ready');
      if (result.audioUrl) playAudio(result.audioUrl);

    } catch (e: any) {
      addLog(`💥 오류: ${e.message}`);
      setGenState('idle');
      alert(`생성 실패: ${e.message}`);
    }
  };

  // ── 컨펌
  const confirm = async (liked: boolean) => {
    if (!curTrack) return;

    const newCount = (curTrack.confirm_count ?? 0) + 1;
    await sb.from('generated_tracks').update({
      confirm_status: liked ? 'liked' : 'disliked',
      confirm_count:  newCount,
    }).eq('id', curTrack.id);

    if (liked) {
      setGenState('confirmed');
      loadLibrary();
      // 프로필 재계산 (RPC)
      sb.rpc('update_store_music_profile', { p_store_id: storeId }).catch(() => {});
      setTimeout(() => { setGenState('idle'); setCurTrack(null); }, 2500);
    } else if (newCount < 3) {
      // 태그 섞어서 재생성
      const shuffled = [...tags].sort(() => Math.random() - 0.5);
      const newBpm   = (parseInt(bpm) || 100) + Math.round((Math.random() - 0.5) * 20);
      setBpm(String(newBpm));
      setTryCount(prev => prev + 1);
      stopAudio();
      await generate([`${newBpm} BPM`, ...shuffled]);
    } else {
      setGenState('idle');
      setCurTrack(null);
      setTryCount(1);
      alert('AI가 계속 학습하고 있어요! 태그를 바꿔서 다시 시도해보세요.');
    }
  };

  // ── 오디오
  const playAudio = (url: string) => {
    stopAudio();
    audioRef.current = new Audio(url);
    audioRef.current.play().catch(() => {});
    audioRef.current.onended = () => setPlaying(false);
    setPlaying(true);
    setLibPlay(null);
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  };

  const togglePlay = () => {
    if (!curTrack?.audio_url) return;
    if (playing) { audioRef.current?.pause(); setPlaying(false); }
    else { audioRef.current?.play(); setPlaying(true); }
  };

  const toggleLibPlay = (track: GeneratedTrack) => {
    if (!track.audio_url) return;
    stopAudio();
    const playable = {
      id:            track.id,
      title:         track.title ?? '생성된 트랙',
      artist:        'Suno AI',
      audio_url:     track.audio_url,
      cover_image_url: track.image_url,
      cover_emoji:   '🎵',
    };
    if (player.track?.id === track.id) {
      player.togglePlay();
    } else {
      player.play(playable, library.filter(t => t.audio_url).map(t => ({
        id: t.id, title: t.title ?? '생성된 트랙', artist: 'Suno AI',
        audio_url: t.audio_url!, cover_image_url: t.image_url, cover_emoji: '🎵',
      })));
    }
    setLibPlay(player.track?.id === track.id && player.isPlaying ? null : track.id);
  };

  // ─── RENDER ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <h1 className="text-lg font-bold text-white">🎵 음악 제작</h1>
          <p className="text-xs text-gray-500 mt-0.5">Suno AI로 매장 전용 음악을 생성하고 확인합니다</p>
        </div>

        {/* 탭 */}
        <div className="flex bg-[#1A1D23] border border-white/10 rounded-xl p-1 gap-1">
          {(['create', 'library'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === t ? 'bg-[#FF6F0F] text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {t === 'create' ? '🎵 제작' : `❤️ 라이브러리 (${library.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'create' ? (
          <div className="max-w-2xl mx-auto space-y-4">

            {/* ── 매장 선택 ── */}
            <div className="bg-[#13161D] rounded-xl border border-white/5 p-4 space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">매장 선택</label>
              <select
                value={storeId}
                onChange={e => setStoreId(e.target.value)}
                className="w-full bg-[#1F2937] text-white text-sm rounded-lg px-3 py-2.5 border border-white/10 outline-none"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.category ? `(${s.category})` : ''}</option>
                ))}
              </select>
              {storeDNA.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {storeDNA.slice(0, 8).map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 bg-[#FF6F0F]/15 text-[#FF6F0F] rounded-full font-semibold">{tag}</span>
                  ))}
                  <span className="text-[10px] text-gray-500 self-center">DNA 기반</span>
                </div>
              )}
            </div>

            {/* ── Suno URL ── */}
            <div className="bg-[#13161D] rounded-xl border border-white/5 p-4 space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">🔗 Suno API URL</label>
              {urlEdit ? (
                <div className="flex gap-2">
                  <input
                    value={urlDraft}
                    onChange={e => setUrlDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveUrl()}
                    placeholder="http://localhost:3000"
                    className="flex-1 bg-[#1F2937] text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none"
                    autoFocus
                  />
                  <button onClick={saveUrl} className="px-4 py-2 bg-[#FF6F0F] text-white text-sm font-bold rounded-lg">저장</button>
                  <button onClick={() => setUrlEdit(false)} className="px-4 py-2 bg-white/5 text-gray-400 text-sm rounded-lg">취소</button>
                </div>
              ) : (
                <button
                  onClick={() => { setUrlDraft(sunoUrl); setUrlEdit(true); }}
                  className="w-full text-left flex items-center justify-between bg-[#1F2937] rounded-lg px-3 py-2.5 border border-white/10"
                >
                  <span className={`text-sm ${sunoUrl ? 'text-white' : 'text-gray-500'}`}>
                    {sunoUrl || '클릭하여 Suno API URL 입력'}
                  </span>
                  <span className="text-xs text-[#FF6F0F] font-bold">수정</span>
                </button>
              )}
              {/* 연결 테스트 버튼 */}
              {sunoUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={testConnection}
                    disabled={testLoading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      testStatus === 'ok'    ? 'bg-green-500/15 border border-green-500/30 text-green-400' :
                      testStatus === 'error' ? 'bg-red-500/15 border border-red-500/30 text-red-400' :
                                              'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                    }`}>
                    {testLoading
                      ? <><div className="w-3 h-3 border border-gray-400/30 border-t-gray-400 rounded-full animate-spin" /> 테스트 중...</>
                      : testStatus === 'ok'    ? '✅ 연결됨'
                      : testStatus === 'error' ? '❌ 연결 실패'
                      :                         '🔗 연결 테스트'
                    }
                  </button>
                  <button
                    onClick={() => setLogVisible(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-gray-400 hover:text-white transition">
                    📋 로그 {logVisible ? '숨기기' : `보기 (${logs.length})`}
                  </button>
                  {logs.length > 0 && (
                    <button onClick={copyLogs}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-gray-400 hover:text-white transition">
                      📋 복사
                    </button>
                  )}
                  {logs.length > 0 && (
                    <button onClick={() => setLogs([])}
                      className="text-xs text-gray-600 hover:text-red-400 transition px-2">초기화</button>
                  )}
                </div>
              )}
              {!sunoUrl && (
                <p className="text-xs text-gray-600">suno-api 오픈소스를 로컬 또는 서버에서 실행 후 URL을 입력하세요</p>
              )}
            </div>

            {/* ── 로그창 ── */}
            {logVisible && (
              <div className="bg-[#0A0C10] border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                  <span className="text-xs font-semibold text-gray-400">📋 생성 로그</span>
                  <div className="flex gap-2">
                    <button onClick={copyLogs}
                      className="text-xs text-gray-500 hover:text-white transition px-2 py-1 bg-white/5 rounded-lg">
                      복사
                    </button>
                    <button onClick={() => setLogs([])}
                      className="text-xs text-gray-500 hover:text-red-400 transition px-2 py-1 bg-white/5 rounded-lg">
                      초기화
                    </button>
                    <button onClick={() => setLogVisible(false)}
                      className="text-xs text-gray-500 hover:text-white transition">✕</button>
                  </div>
                </div>
                <div className="h-40 overflow-auto px-4 py-3 space-y-0.5 font-mono text-xs">
                  {logs.length === 0
                    ? <p className="text-gray-600">로그가 없습니다. 연결 테스트나 음악 생성을 시작하세요.</p>
                    : logs.map((line, i) => (
                      <p key={i} className={
                        line.includes('❌') || line.includes('💥') ? 'text-red-400' :
                        line.includes('✅') ? 'text-green-400' :
                        line.includes('🎶') || line.includes('🎵') ? 'text-[#FF6F0F]' :
                        'text-gray-400'
                      }>{line}</p>
                    ))
                  }
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {/* ── 스타일 프리셋 ── */}
            <div className="bg-[#13161D] rounded-xl border border-white/5 p-4 space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">🎨 스타일 프리셋</label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p.tags)}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold rounded-lg hover:border-[#FF6F0F]/50 hover:text-[#FF6F0F] transition">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 스타일 태그 ── */}
            <div className="bg-[#13161D] rounded-xl border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">🏷 스타일 태그</label>
                <span className="text-xs text-gray-500">{tags.length}/12 선택됨</span>
              </div>

              {/* DNA 태그 */}
              {storeDNA.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-2">매장 DNA</p>
                  <div className="flex flex-wrap gap-1.5">
                    {storeDNA.slice(0, 20).map(tag => (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                          tags.includes(tag)
                            ? 'bg-[#FF6F0F]/20 border border-[#FF6F0F] text-[#FF6F0F]'
                            : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                        }`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 커스텀 태그 입력 */}
              <div className="flex gap-2">
                <input
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustom()}
                  placeholder="직접 입력 (예: acoustic guitar)"
                  className="flex-1 bg-[#1F2937] text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none placeholder-gray-600"
                />
                <button onClick={addCustom} className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 text-sm rounded-lg hover:border-white/20 transition">추가</button>
              </div>

              {/* 선택된 태그 */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FF6F0F]/20 border border-[#FF6F0F] text-[#FF6F0F] hover:opacity-70 transition">
                      {tag} ✕
                    </button>
                  ))}
                </div>
              )}

              {/* BPM */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-semibold w-8">BPM</span>
                <input
                  value={bpm}
                  onChange={e => setBpm(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={3}
                  className="w-20 bg-[#1F2937] text-white text-sm rounded-lg px-3 py-1.5 border border-white/10 outline-none text-center"
                />
              </div>
            </div>

            {/* ── 생성 버튼 ── */}
            {genState === 'idle' && (
              <button
                onClick={() => generate()}
                disabled={!sunoUrl || tags.length === 0}
                className="w-full py-4 rounded-xl text-base font-black transition
                  disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed
                  bg-[#FF6F0F] text-white hover:bg-[#FF6F0F]/90 active:scale-[0.98]"
              >
                🎵 음악 만들기
              </button>
            )}

            {/* ── 생성 중 ── */}
            {genState === 'generating' && (
              <div className="bg-[#13161D] border border-white/5 rounded-xl p-8 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-white font-bold">{tryCount > 1 ? `재제작 중 (${tryCount}/3)` : '음악 제작 중'}</p>
                  <p className="text-[#FF6F0F] text-sm mt-1">{genMsg}</p>
                  <p className="text-gray-600 text-xs mt-2">보통 3~5분이 소요됩니다</p>
                </div>
              </div>
            )}

            {/* ── 생성된 트랙 ── */}
            {genState === 'ready' && curTrack && (
              <div className="bg-[#13161D] border border-white/5 rounded-xl p-6 space-y-5">
                {/* 시도 dots */}
                <div className="flex justify-center gap-2">
                  {[1, 2, 3].map(n => (
                    <div key={n} className={`w-2 h-2 rounded-full ${n <= tryCount ? 'bg-[#FF6F0F]' : 'bg-white/10'}`} />
                  ))}
                </div>

                <div>
                  <h3 className="text-white font-black text-lg text-center">{curTrack.title ?? '새 트랙'}</h3>
                  {curTrack.bpm_estimate && (
                    <p className="text-gray-500 text-sm text-center mt-1">~{curTrack.bpm_estimate} BPM</p>
                  )}
                </div>

                {/* 태그 */}
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {(curTrack.style_tags ?? []).slice(0, 8).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-full">{tag}</span>
                  ))}
                </div>

                {/* Mood bars */}
                {curTrack.mood_embedding && (
                  <div className="space-y-2">
                    {[
                      { label: '에너지',  val: curTrack.mood_embedding[0] },
                      { label: '밝음',    val: curTrack.mood_embedding[1] },
                      { label: '댄서블', val: curTrack.mood_embedding[2] },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-12">{label}</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#FF6F0F] rounded-full" style={{ width: `${Math.round(val * 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-600 w-8 text-right">{Math.round(val * 100)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 플레이어 */}
                {curTrack.audio_url ? (
                  <button onClick={togglePlay}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition">
                    <span className="text-xl">{playing ? '⏸' : '▶️'}</span>
                    <span className="text-white font-semibold text-sm">{playing ? '일시정지' : '미리듣기'}</span>
                  </button>
                ) : (
                  <p className="text-center text-gray-600 text-sm">🔇 오디오 없음</p>
                )}

                {/* 컨펌 버튼 */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => confirm(false)}
                    className="py-4 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center gap-1 hover:bg-white/10 transition">
                    <span className="text-2xl">😕</span>
                    <span className="text-white font-bold text-sm">다른 스타일</span>
                    {tryCount >= 3 && <span className="text-gray-600 text-[10px]">마지막 기회</span>}
                  </button>
                  <button onClick={() => confirm(true)}
                    className="py-4 bg-[#22C55E]/15 border border-[#22C55E]/30 rounded-xl flex flex-col items-center gap-1 hover:bg-[#22C55E]/25 transition">
                    <span className="text-2xl">❤️</span>
                    <span className="text-white font-bold text-sm">좋아요!</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── 확정 완료 ── */}
            {genState === 'confirmed' && (
              <div className="bg-[#13161D] border border-[#22C55E]/20 rounded-xl p-10 flex flex-col items-center gap-3">
                <span className="text-5xl">❤️</span>
                <p className="text-[#22C55E] font-black text-lg">라이브러리에 추가됐어요!</p>
                <p className="text-gray-500 text-sm text-center">이 곡의 DNA로 매장 음악이 학습됩니다</p>
              </div>
            )}

          </div>
        ) : (
          /* ── 라이브러리 탭 ── */
          <div className="max-w-3xl mx-auto">
            {/* 매장 선택 (라이브러리 탭에서도) */}
            <div className="flex items-center gap-3 mb-6">
              <select
                value={storeId}
                onChange={e => setStoreId(e.target.value)}
                className="bg-[#1F2937] text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span className="text-gray-500 text-sm">총 {library.length}곡 좋아요</span>
            </div>

            {library.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🎵</p>
                <p className="text-gray-400 font-semibold">아직 좋아요한 곡이 없어요</p>
                <p className="text-gray-600 text-sm mt-2">제작 탭에서 음악을 만들고 ❤️를 눌러보세요!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {library.map((track, i) => (
                  <div key={track.id}
                    className="flex items-center gap-4 bg-[#13161D] border border-white/5 rounded-xl p-4 hover:border-white/10 transition">
                    <span className="text-gray-600 text-sm font-bold w-6 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{track.title ?? '제목 없음'}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {track.bpm_estimate ? `${track.bpm_estimate} BPM · ` : ''}
                        {(track.style_tags ?? []).slice(0, 4).join(', ')}
                      </p>
                    </div>
                    {/* Mood bar (에너지) */}
                    {track.mood_embedding && (
                      <div className="w-16 flex flex-col gap-0.5">
                        {track.mood_embedding.map((val, idx) => (
                          <div key={idx} className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF6F0F] rounded-full" style={{ width: `${Math.round(val * 100)}%` }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => toggleLibPlay(track)}
                      disabled={!track.audio_url}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 ${
                        player.track?.id === track.id
                          ? 'bg-[#FF6F0F] text-white'
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30'
                      }`}>
                      <span className="text-sm">{player.track?.id === track.id && player.isPlaying ? '⏸' : '▶'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
