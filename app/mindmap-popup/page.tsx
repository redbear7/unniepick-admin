'use client';

import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Pin, PinOff } from 'lucide-react';

interface Msg { role: 'user' | 'ai'; content: string; ts: string }
interface Session {
  id: string; title: string; date: string;
  messages: Msg[];
}

const FONT_KEY  = 'mindmap_popup_font';
const ONTOP_KEY = 'mindmap_popup_ontop';

/* ── 실제 팝업 콘텐츠 ── */
function PopupContent() {
  const params    = useSearchParams();
  const sessionId = params.get('session');

  const [session, setSession] = useState<Session | null>(null);
  const [input,   setInput]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window === 'undefined') return 14;
    return parseInt(localStorage.getItem(FONT_KEY) ?? '14', 10) || 14;
  });

  const [alwaysOnTop, setAlwaysOnTop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(ONTOP_KEY) !== 'false';
  });

  const composingRef   = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── 세션 로드 ── */
  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/mindmap/sessions/${sessionId}`);
    if (res.ok) setSession(await res.json());
  }, [sessionId]);

  useEffect(() => { loadSession(); }, [loadSession]);

  /* ── BroadcastChannel: 메인 창 ↔ 팝업 실시간 동기화 ── */
  useEffect(() => {
    if (!sessionId) return;
    const ch = new BroadcastChannel(`mindmap_${sessionId}`);
    ch.onmessage = (e) => {
      if (e.data?.type === 'messages_updated') {
        setSession(s => s ? { ...s, messages: e.data.messages } : s);
      }
    };
    return () => ch.close();
  }, [sessionId]);

  /* ── 스크롤 ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  /* ── 항상 위에 ── */
  useEffect(() => {
    localStorage.setItem(ONTOP_KEY, String(alwaysOnTop));
    document.title = alwaysOnTop ? '📌 마인드맵 채팅' : '마인드맵 채팅';

    if (alwaysOnTop) {
      // 3초마다 focus 요청 (브라우저 허용 범위 내)
      intervalRef.current = setInterval(() => {
        try { window.focus(); } catch {}
      }, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [alwaysOnTop]);

  /* ── 폰트 저장 ── */
  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontSize));
  }, [fontSize]);

  /* ── 메시지 전송 ── */
  async function sendMessage() {
    if (!input.trim() || !session) return;
    const userMsg: Msg = { role: 'user', content: input.trim(), ts: new Date().toISOString() };
    const newMsgs = [...(session.messages ?? []), userMsg];

    setSession(s => s ? { ...s, messages: newMsgs } : s);
    setInput('');
    setSaving(true);

    await fetch(`/api/mindmap/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMsgs }),
    });

    // 메인창에 변경 알림
    const ch = new BroadcastChannel(`mindmap_${session.id}`);
    ch.postMessage({ type: 'messages_updated', messages: newMsgs });
    ch.close();

    setSaving(false);
  }

  if (!session) return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-[#FF6F0F]" />
      <p className="text-xs text-muted">세션 로딩 중...</p>
    </div>
  );

  const msgs = session.messages ?? [];

  return (
    <div
      className="flex flex-col h-screen bg-background overflow-hidden"
      style={{ outline: alwaysOnTop ? '2px solid rgba(255,111,15,0.35)' : 'none' }}
    >
      {/* ── 헤더 ── */}
      <div className="h-10 border-b border-border-main flex items-center px-3 gap-2 shrink-0 bg-sidebar select-none">
        {/* 제목 */}
        <span className="text-xs font-semibold text-primary truncate flex-1">{session.title}</span>

        {/* 항상 위에 토글 */}
        <button
          onClick={() => setAlwaysOnTop(v => !v)}
          title={alwaysOnTop ? '항상 위에 ON' : '항상 위에 OFF'}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition shrink-0 ${
            alwaysOnTop
              ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/40 text-[#FF6F0F]'
              : 'bg-fill-subtle border-border-subtle text-muted'
          }`}
        >
          {alwaysOnTop ? <Pin className="w-2.5 h-2.5" /> : <PinOff className="w-2.5 h-2.5" />}
          {alwaysOnTop ? '고정' : '해제'}
        </button>

        {/* 폰트 크기 */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setFontSize(s => Math.max(10, s - 2))}
            className="w-5 h-5 rounded text-muted hover:text-primary hover:bg-fill-subtle text-sm font-bold flex items-center justify-center transition"
          >−</button>
          <span className="text-[10px] text-muted w-7 text-center tabular-nums">{fontSize}px</span>
          <button
            onClick={() => setFontSize(s => Math.min(26, s + 2))}
            className="w-5 h-5 rounded text-muted hover:text-primary hover:bg-fill-subtle text-sm font-bold flex items-center justify-center transition"
          >+</button>
        </div>
      </div>

      {/* ── 메시지 목록 ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted">
            <span className="text-3xl">💡</span>
            <p style={{ fontSize: `${fontSize}px` }} className="text-center leading-relaxed">
              아이디어를 자유롭게 입력하세요
            </p>
            <div style={{ fontSize: `${Math.max(10, fontSize - 2)}px` }} className="text-center text-muted space-y-0.5">
              <p>• 생각나는 대로 한 줄씩</p>
              <p>• Shift+Enter 줄바꿈</p>
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              style={{ fontSize: `${fontSize}px` }}
              className={`max-w-[88%] rounded-2xl px-3 py-2 whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#FF6F0F] text-white rounded-br-sm'
                  : 'bg-card border border-border-main text-primary rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── 입력 ── */}
      <div className="border-t border-border-main px-3 py-2.5 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="아이디어 입력... (Shift+Enter 줄바꿈)"
            rows={2}
            style={{ fontSize: `${fontSize}px` }}
            className="flex-1 bg-fill-subtle border border-border-subtle rounded-xl px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] resize-none leading-relaxed"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || saving}
            className="h-10 px-3 bg-[#FF6F0F] hover:bg-[#e85e00] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shrink-0 flex items-center justify-center"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '전송'}
          </button>
        </div>
        <p className="text-[9px] text-muted mt-1.5 flex items-center justify-between">
          <span className="font-mono">Gemini 2.5 Flash</span>
          <span>{msgs.length}개 메시지</span>
        </p>
      </div>
    </div>
  );
}

/* ── 페이지 래퍼 (Suspense 필수: useSearchParams) ── */
export default function MindmapPopupPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-[#FF6F0F]" />
      </div>
    }>
      <PopupContent />
    </Suspense>
  );
}
