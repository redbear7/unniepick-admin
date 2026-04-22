'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Plus, Trash2, Loader2, Sparkles, ChevronDown,
  ChevronRight, Calendar, MessageSquare, Lightbulb,
  ArrowRight, X, Pencil, Check,
} from 'lucide-react';

// ── 타입 ────────────────────────────────────────────────────────
interface Msg { role: 'user' | 'ai'; content: string; ts: string }

interface MindmapNode { idea: string; children: MindmapNode[] }
interface MindmapBranch {
  topic: string; emoji: string; color: string; children: MindmapNode[];
}
interface Mindmap {
  seed: string; summary: string;
  branches: MindmapBranch[];
  core_insights: string[];
  next_actions: string[];
}

interface Session {
  id: string; title: string; date: string;
  messages: Msg[]; mindmap: Mindmap | null;
  core_insights: string[]; created_at: string;
}

// ── 마인드맵 노드 렌더러 ────────────────────────────────────────
function MindNode({ node, color, depth = 0 }: { node: MindmapNode; color: string; depth?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;
  const size = depth === 0 ? 'text-sm font-semibold' : 'text-xs font-medium';
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-1.5">
        {/* 연결선 */}
        {depth > 0 && <div className="w-4 h-px opacity-30" style={{ backgroundColor: color }} />}
        <button
          onClick={() => hasChildren && setOpen(v => !v)}
          className={`px-2.5 py-1 rounded-lg border transition-all ${size} ${hasChildren ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          style={{
            backgroundColor: `${color}18`,
            borderColor: `${color}40`,
            color: depth === 0 ? color : '#E0E0E0',
          }}
        >
          {hasChildren && (
            <span className="mr-1 opacity-60">{open ? '▾' : '▸'}</span>
          )}
          {node.idea}
        </button>
      </div>
      {open && hasChildren && (
        <div className="ml-6 mt-1.5 flex flex-col gap-1.5 border-l border-dashed pl-2"
          style={{ borderColor: `${color}25` }}>
          {node.children.map((c, i) => (
            <MindNode key={i} node={c} color={color} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 마인드맵 뷰 ─────────────────────────────────────────────────
function MindmapView({ mindmap }: { mindmap: Mindmap }) {
  return (
    <div className="space-y-6 select-none">
      {/* 씨앗 */}
      <div className="flex flex-col items-center gap-1">
        <div className="w-20 h-20 rounded-full bg-[#FF6F0F] flex items-center justify-center shadow-lg shadow-[#FF6F0F]/30">
          <span className="text-white text-2xl">🌱</span>
        </div>
        <span className="text-lg font-black text-white mt-1">{mindmap.seed}</span>
        <span className="text-xs text-muted text-center max-w-xs">{mindmap.summary}</span>
      </div>

      {/* 브랜치 */}
      <div className="grid grid-cols-1 gap-4">
        {mindmap.branches.map((branch, i) => (
          <div key={i} className="bg-card border border-border-main rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{branch.emoji}</span>
              <span className="font-bold text-sm" style={{ color: branch.color }}>{branch.topic}</span>
              <div className="flex-1 h-px" style={{ backgroundColor: `${branch.color}30` }} />
            </div>
            <div className="flex flex-col gap-2">
              {branch.children.map((node, j) => (
                <MindNode key={j} node={node} color={branch.color} depth={0} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 핵심 인사이트 */}
      {mindmap.core_insights?.length > 0 && (
        <div className="bg-[#FF6F0F]/8 border border-[#FF6F0F]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-[#FF6F0F]" />
            <span className="text-sm font-bold text-[#FF6F0F]">핵심 인사이트</span>
          </div>
          <div className="space-y-2">
            {mindmap.core_insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-secondary">
                <span className="text-[#FF6F0F] mt-0.5 shrink-0">✦</span>
                {ins}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 다음 액션 */}
      {mindmap.next_actions?.length > 0 && (
        <div className="bg-fill-subtle border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">다음 단계</span>
          </div>
          <div className="space-y-2">
            {mindmap.next_actions.map((act, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-secondary">
                <span className="w-5 h-5 rounded-full bg-fill-medium flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {i + 1}
                </span>
                {act}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────
export default function MindmapPage() {
  const [sessions, setSessions]       = useState<Session[]>([]);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [input, setInput]             = useState('');
  const [organizing, setOrganizing]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [creating, setCreating]       = useState(false);
  const [sideOpen, setSideOpen]       = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput]   = useState('');
  const [view, setView]               = useState<'chat' | 'map'>('chat');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // ── 세션 목록 로드 ─────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/mindmap/sessions');
    if (res.ok) setSessions(await res.json());
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── 세션 선택 ──────────────────────────────────────────────
  const selectSession = useCallback(async (id: string) => {
    setActiveId(id);
    const res = await fetch(`/api/mindmap/sessions/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSession(data);
      setView(data.mindmap ? 'map' : 'chat');
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0 && !activeId) selectSession(sessions[0].id);
  }, [sessions, activeId, selectSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  // ── 새 세션 생성 ───────────────────────────────────────────
  async function createSession() {
    setCreating(true);
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch('/api/mindmap/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `${today} 회의`, date: today }),
    });
    if (res.ok) {
      const data = await res.json();
      await loadSessions();
      await selectSession(data.id);
    }
    setCreating(false);
  }

  // ── 메시지 전송 ────────────────────────────────────────────
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
    setSaving(false);
  }

  // ── 마인드맵 정리 ──────────────────────────────────────────
  async function organize() {
    if (!session || !session.messages?.length) return;
    setOrganizing(true);
    setView('map');

    const res = await fetch('/api/mindmap/organize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: session.messages, sessionId: session.id }),
    });

    if (res.ok) {
      const { mindmap } = await res.json();
      setSession(s => s ? { ...s, mindmap } : s);
      await loadSessions();
    } else {
      alert('마인드맵 생성 실패');
      setView('chat');
    }
    setOrganizing(false);
  }

  // ── 제목 수정 ──────────────────────────────────────────────
  async function saveTitle() {
    if (!session || !titleInput.trim()) return;
    await fetch(`/api/mindmap/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleInput.trim() }),
    });
    setSession(s => s ? { ...s, title: titleInput.trim() } : s);
    setSessions(ss => ss.map(s => s.id === session.id ? { ...s, title: titleInput.trim() } : s));
    setEditingTitle(false);
  }

  // ── 세션 삭제 ──────────────────────────────────────────────
  async function deleteSession(id: string) {
    if (!confirm('이 회의를 삭제할까요?')) return;
    await fetch(`/api/mindmap/sessions/${id}`, { method: 'DELETE' });
    const next = sessions.filter(s => s.id !== id);
    setSessions(next);
    if (activeId === id) {
      if (next.length > 0) selectSession(next[0].id);
      else { setActiveId(null); setSession(null); }
    }
  }

  const msgs = session?.messages ?? [];

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-background">

      {/* ── 사이드바: 세션 목록 ── */}
      <div className={`${sideOpen ? 'w-60' : 'w-0'} shrink-0 transition-all duration-200 overflow-hidden border-r border-border-main flex flex-col bg-sidebar`}>
        <div className="p-3 border-b border-border-main flex items-center justify-between">
          <span className="text-xs font-bold text-muted uppercase tracking-wide">회의 목록</span>
          <button
            onClick={createSession}
            disabled={creating}
            className="p-1.5 rounded-lg hover:bg-fill-subtle text-muted hover:text-primary transition"
            title="새 회의"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 && (
            <p className="text-xs text-muted text-center py-8">회의가 없습니다</p>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => selectSession(s.id)}
              className={`group mx-2 mb-1 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                activeId === s.id ? 'bg-[#FF6F0F]/15 border border-[#FF6F0F]/30' : 'hover:bg-fill-subtle border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${activeId === s.id ? 'text-[#FF6F0F]' : 'text-primary'}`}>
                    {s.mindmap && <span className="mr-1">🌱</span>}{s.title}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {s.date}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-red-400 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 메인 영역 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="h-12 border-b border-border-main flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSideOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-fill-subtle text-muted transition"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${sideOpen ? 'rotate-180' : ''}`} />
          </button>

          {session ? (
            editingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="flex-1 bg-fill-subtle border border-[#FF6F0F] rounded-lg px-3 py-1 text-sm text-primary focus:outline-none"
                  autoFocus
                />
                <button onClick={saveTitle} className="p-1.5 text-[#FF6F0F]"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingTitle(false)} className="p-1.5 text-muted"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => { setTitleInput(session.title); setEditingTitle(true); }}
                className="flex items-center gap-2 hover:opacity-70 transition group"
              >
                <span className="font-semibold text-primary text-sm">{session.title}</span>
                <Pencil className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100" />
              </button>
            )
          ) : (
            <span className="text-sm text-muted">회의를 선택하거나 새로 시작하세요</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* 채팅 / 마인드맵 전환 탭 */}
            {session && (
              <div className="flex bg-fill-subtle rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setView('chat')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${view === 'chat' ? 'bg-card text-primary shadow-sm' : 'text-muted hover:text-primary'}`}
                >
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" />채팅
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${view === 'map' ? 'bg-card text-primary shadow-sm' : 'text-muted hover:text-primary'}`}
                >
                  🌱 마인드맵
                </button>
              </div>
            )}

            {/* 정리 버튼 */}
            {session && msgs.length > 0 && (
              <button
                onClick={organize}
                disabled={organizing}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6F0F] hover:bg-[#e85e00] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
              >
                {organizing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 정리 중...</>
                  : <><Sparkles className="w-3.5 h-3.5" /> 마인드맵 정리</>
                }
              </button>
            )}
          </div>
        </div>

        {/* 콘텐츠 */}
        {!session ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted">
            <div className="w-20 h-20 rounded-full bg-fill-subtle flex items-center justify-center text-4xl">🌱</div>
            <p className="text-sm font-semibold text-primary">마인드맵 브레인스토밍</p>
            <p className="text-xs text-center max-w-xs">아이디어를 자유롭게 던지면 AI가 마인드맵으로 정리해드립니다</p>
            <button
              onClick={createSession}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6F0F] hover:bg-[#e85e00] text-white text-sm font-bold rounded-xl transition"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              새 회의 시작
            </button>
          </div>
        ) : view === 'chat' ? (
          /* ── 채팅 뷰 ── */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
                  <span className="text-4xl">💡</span>
                  <p className="text-sm">아이디어를 자유롭게 입력하세요</p>
                  <div className="text-xs text-center max-w-sm space-y-1">
                    <p>• 생각나는 대로 한 줄씩 입력</p>
                    <p>• 여러 아이디어를 한번에 쭉 적어도 OK</p>
                    <p>• 충분히 입력 후 "마인드맵 정리" 클릭</p>
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#FF6F0F] text-white rounded-br-sm'
                      : 'bg-card border border-border-main text-primary rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 */}
            <div className="border-t border-border-main p-3">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder="아이디어를 입력하세요... (Shift+Enter로 줄바꿈)"
                  rows={3}
                  className="flex-1 bg-fill-subtle border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] resize-none leading-relaxed"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || saving}
                  className="h-10 px-4 bg-[#FF6F0F] hover:bg-[#e85e00] disabled:opacity-40 text-white text-sm font-bold rounded-xl transition shrink-0"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '전송'}
                </button>
              </div>
              <p className="text-[10px] text-muted mt-1.5 text-right">
                {msgs.length}개 메시지 · Enter 전송 · Shift+Enter 줄바꿈
              </p>
            </div>
          </div>
        ) : (
          /* ── 마인드맵 뷰 ── */
          <div className="flex-1 overflow-y-auto p-6">
            {organizing ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted">
                <Loader2 className="w-10 h-10 animate-spin text-[#FF6F0F]" />
                <p className="text-sm font-semibold text-primary">AI가 마인드맵을 정리하고 있어요...</p>
                <p className="text-xs">아이디어를 분석하고 트리를 구성 중입니다</p>
              </div>
            ) : session.mindmap ? (
              <div className="max-w-2xl mx-auto">
                <MindmapView mindmap={session.mindmap} />
                <button
                  onClick={() => setView('chat')}
                  className="mt-6 w-full py-2 border border-border-subtle rounded-xl text-xs text-muted hover:text-primary hover:border-border-main transition"
                >
                  채팅으로 돌아가기 (아이디어 추가)
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted">
                <span className="text-4xl">🌱</span>
                <p className="text-sm">아직 마인드맵이 없습니다</p>
                <p className="text-xs">채팅에서 아이디어를 입력 후 "마인드맵 정리"를 눌러주세요</p>
                <button onClick={() => setView('chat')} className="px-4 py-2 bg-fill-subtle hover:bg-fill-medium rounded-lg text-sm text-primary transition">
                  채팅으로 이동
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
