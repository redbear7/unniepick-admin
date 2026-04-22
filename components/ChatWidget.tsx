'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatWidget() {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await sb.from('users').select('role').eq('id', user.id).single();
      if (data?.role === 'superadmin') setIsSuperadmin(true);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isSuperadmin) return null;

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setStreaming(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: '요청 실패' }));
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: `오류: ${err.error}` };
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: full };
          return copy;
        });
      }
    } catch (e) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `오류: ${(e as Error).message}` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* 플로팅 버튼 — DEV LOG 창 왼쪽 하단 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-[10px] right-[532px] z-[9999] w-9 h-9 rounded-full bg-[#FF6F0F] text-white shadow-lg flex items-center justify-center hover:bg-[#e55c00] transition"
        title="AI 어시스턴트">
        {open ? <X size={16} /> : <MessageCircle size={16} />}
      </button>

      {/* 채팅 창 */}
      {open && (
        <div className="fixed bottom-[56px] right-[532px] z-[9999] w-80 h-[460px] flex flex-col rounded-2xl border border-border-main bg-surface shadow-2xl overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#FF6F0F]/10 border-b border-border-main shrink-0">
            <Bot size={16} className="text-[#FF6F0F]" />
            <span className="text-sm font-semibold text-primary">AI 어시스턴트</span>
            <span className="ml-auto text-[10px] text-dim bg-[#FF6F0F]/15 px-2 py-0.5 rounded-full">시샵 전용</span>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[10px] text-dim hover:text-primary transition ml-1"
                title="대화 초기화"
              >
                초기화
              </button>
            )}
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-dim text-center mt-8 leading-relaxed">
                무엇이든 물어보세요.<br />매장, 회원, 음악, 통계 등
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#FF6F0F] text-white rounded-br-sm'
                    : 'bg-fill-medium text-primary rounded-bl-sm'
                }`}>
                  {m.content}
                  {m.role === 'assistant' && m.content === '' && streaming && (
                    <Loader2 size={12} className="animate-spin inline" />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="shrink-0 flex items-end gap-2 px-3 py-3 border-t border-border-main">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="메시지 입력 (Enter 전송)"
              disabled={streaming}
              rows={1}
              className="flex-1 resize-none bg-fill-subtle border border-border-main rounded-lg px-3 py-2 text-xs text-primary placeholder:text-dim outline-none focus:border-[#FF6F0F]/50 disabled:opacity-50"
              style={{ maxHeight: 80 }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              className="shrink-0 w-8 h-8 rounded-lg bg-[#FF6F0F] text-white flex items-center justify-center hover:bg-[#e55c00] transition disabled:opacity-40 disabled:cursor-not-allowed">
              {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
