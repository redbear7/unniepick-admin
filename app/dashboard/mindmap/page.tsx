'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  Plus, Trash2, Loader2, Sparkles,
  ChevronRight, Calendar, MessageSquare, Lightbulb,
  ArrowRight, X, Pencil, Check, ExternalLink, Save, Printer,
  AlignRight, AlignLeft, AlignCenter,
} from 'lucide-react';

/* ── 테마 헬퍼: 라이트/다크 판별 ──────────────────────────────── */
const DARK_THEMES = new Set(['dark', 'supabase', 'linear']);
function useMindTheme() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted ? true : DARK_THEMES.has(resolvedTheme ?? 'dark');
  return {
    isDark,
    nodeBg:     (c: string) => isDark ? `${c}1a` : `${c}22`,
    nodeBorder: (c: string) => isDark ? `${c}45` : `${c}65`,
    childColor: isDark ? 'var(--text-secondary)' : 'var(--text-primary)',
    connColor:  (c: string) => isDark ? `${c}50` : `${c}70`,
    branchLine: (c: string) => isDark ? `${c}30` : `${c}50`,
    branchDash: (c: string) => isDark ? `${c}28` : `${c}40`,
  };
}

/* ── 상수 ─────────────────────────────────────────────────────── */
const BRANCH_COLORS = ['#FF6F0F', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'];
function dc<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

/* ── 인쇄용 HTML 생성 ─────────────────────────────────────────── */
function buildPrintHTML(m: Mindmap, title: string): string {
  const branches = m.branches.map(b => `
    <div class="branch">
      <h3 style="color:${b.color}">${b.emoji} ${b.topic}</h3>
      ${b.children.map(n => `
        <div class="node" style="color:${b.color}">● ${n.idea}
          ${(n.children ?? []).map(c => `<div class="child">◦ ${c.idea}</div>`).join('')}
        </div>`).join('')}
    </div>`).join('');
  const insights = (m.core_insights ?? []).map(i => `<li>✦ ${i}</li>`).join('');
  const actions  = (m.next_actions  ?? []).map((a, i) => `<li>${i+1}. ${a}</li>`).join('');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
  <title>${m.seed} 마인드맵</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:32px;color:#111;max-width:780px;margin:0 auto}
    h1{color:#FF6F0F;font-size:26px;margin:0 0 4px}
    .sub{color:#666;font-size:13px;margin-bottom:28px}
    .branch{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px}
    .branch h3{margin:0 0 8px;font-size:15px}
    .node{margin:5px 0 5px 12px;font-size:13px;font-weight:600}
    .child{margin:2px 0 2px 20px;color:#555;font-weight:400;font-size:12px}
    .section{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px}
    .section h3{margin:0 0 8px;font-size:14px;color:#FF6F0F}
    ul{margin:0;padding-left:8px;list-style:none}
    li{margin:4px 0;font-size:13px}
    .date{font-size:11px;color:#aaa;text-align:right;margin-top:24px}
    @media print{body{padding:0}}
  </style></head><body>
  <div style="text-align:center;margin-bottom:28px">
    <div style="font-size:36px">🌱</div>
    <h1>${m.seed}</h1>
    <p class="sub">${m.summary}</p>
  </div>
  ${branches}
  ${insights ? `<div class="section"><h3>💡 핵심 인사이트</h3><ul>${insights}</ul></div>` : ''}
  ${actions  ? `<div class="section" style="border-color:#e2e8f0"><h3 style="color:#333">→ 다음 단계</h3><ul>${actions}</ul></div>` : ''}
  <p class="date">${title} · ${new Date().toLocaleDateString('ko-KR')}</p>
  </body></html>`;
}

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

// ── 뷰용 MindNode ───────────────────────────────────────────────
function MindNode({
  node, color, depth = 0, th,
}: {
  node: MindmapNode; color: string; depth?: number;
  th: ReturnType<typeof useMindTheme>;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;
  const size = depth === 0 ? 'text-sm font-semibold' : 'text-xs font-medium';
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-1.5">
        {depth > 0 && (
          <div className="w-4 h-px shrink-0" style={{ backgroundColor: th.connColor(color) }} />
        )}
        <button
          onClick={() => hasChildren && setOpen(v => !v)}
          className={`px-2.5 py-1 rounded-lg border transition-all ${size} ${hasChildren ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          style={{
            backgroundColor: th.nodeBg(color),
            borderColor:     th.nodeBorder(color),
            color: depth === 0 ? color : th.childColor,
          }}
        >
          {hasChildren && <span className="mr-1 opacity-60">{open ? '▾' : '▸'}</span>}
          {node.idea}
        </button>
      </div>
      {open && hasChildren && (
        <div className="ml-6 mt-1.5 flex flex-col gap-1.5 border-l border-dashed pl-2"
          style={{ borderColor: th.branchDash(color) }}>
          {node.children.map((c, i) => (
            <MindNode key={i} node={c} color={color} depth={depth + 1} th={th} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 마인드맵 뷰 + 편집 + 저장 + 인쇄 ───────────────────────────
function MindmapView({
  mindmap: initMindmap, sessionId, sessionTitle, onSaved,
}: {
  mindmap: Mindmap; sessionId: string; sessionTitle: string;
  onSaved: (m: Mindmap) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft,    setDraft]    = useState<Mindmap>(() => dc(initMindmap));
  const [saving,   setSaving]   = useState(false);
  const th = useMindTheme();

  useEffect(() => { if (!editMode) setDraft(dc(initMindmap)); }, [initMindmap, editMode]);

  const data = editMode ? draft : initMindmap;

  /* ── draft 업데이트 헬퍼 ── */
  const upd = (fn: (d: Mindmap) => Mindmap) => setDraft(d => fn(dc(d)));

  // 씨앗 / 요약
  const updSeed    = (v: string) => upd(d => ({ ...d, seed: v }));
  const updSummary = (v: string) => upd(d => ({ ...d, summary: v }));

  // 브랜치
  const updBranch   = (bi: number, k: keyof MindmapBranch, v: string) =>
    upd(d => { (d.branches[bi] as Record<string, unknown>)[k] = v; return d; });
  const addBranch   = () => upd(d => ({
    ...d, branches: [...d.branches, {
      topic: '새 분류', emoji: '🔹',
      color: BRANCH_COLORS[d.branches.length % BRANCH_COLORS.length],
      children: [{ idea: '새 아이디어', children: [] }],
    }],
  }));
  const removeBranch = (bi: number) => upd(d => ({ ...d, branches: d.branches.filter((_, i) => i !== bi) }));

  // 노드 (1단계)
  const updNode    = (bi: number, ni: number, v: string) => upd(d => { d.branches[bi].children[ni].idea = v; return d; });
  const addNode    = (bi: number) => upd(d => { d.branches[bi].children.push({ idea: '새 아이디어', children: [] }); return d; });
  const removeNode = (bi: number, ni: number) => upd(d => { d.branches[bi].children.splice(ni, 1); return d; });

  // 자식 노드 (2단계)
  const updChild    = (bi: number, ni: number, ci: number, v: string) => upd(d => { d.branches[bi].children[ni].children[ci].idea = v; return d; });
  const addChild    = (bi: number, ni: number) => upd(d => { d.branches[bi].children[ni].children.push({ idea: '세부 아이디어', children: [] }); return d; });
  const removeChild = (bi: number, ni: number, ci: number) => upd(d => { d.branches[bi].children[ni].children.splice(ci, 1); return d; });

  // 인사이트 / 액션
  const updInsight    = (i: number, v: string) => upd(d => { d.core_insights[i] = v; return d; });
  const addInsight    = () => upd(d => ({ ...d, core_insights: [...d.core_insights, '새 인사이트'] }));
  const removeInsight = (i: number) => upd(d => ({ ...d, core_insights: d.core_insights.filter((_, j) => j !== i) }));
  const updAction     = (i: number, v: string) => upd(d => { d.next_actions[i] = v; return d; });
  const addAction     = () => upd(d => ({ ...d, next_actions: [...d.next_actions, '새 액션'] }));
  const removeAction  = (i: number) => upd(d => ({ ...d, next_actions: d.next_actions.filter((_, j) => j !== i) }));

  /* ── 저장 ── */
  const saveEdit = async () => {
    setSaving(true);
    await fetch(`/api/mindmap/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mindmap: draft }),
    });
    onSaved(draft);
    setEditMode(false);
    setSaving(false);
  };

  /* ── 인쇄 ── */
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=820,height=700');
    if (!win) return;
    win.document.write(buildPrintHTML(editMode ? draft : initMindmap, sessionTitle));
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  /* ── 공용 input 스타일 ── */
  const inp = 'bg-fill-subtle border border-border-subtle rounded px-2 py-1 focus:outline-none focus:border-[#FF6F0F] w-full';

  return (
    <div className="space-y-6">
      {/* ── 툴바 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {editMode ? (
          <>
            <button onClick={saveEdit} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              저장
            </button>
            <button onClick={() => { setDraft(dc(initMindmap)); setEditMode(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-fill-subtle hover:bg-fill-medium text-muted text-xs font-bold rounded-lg transition">
              <X className="w-3.5 h-3.5" /> 취소
            </button>
          </>
        ) : (
          <button onClick={() => { setDraft(dc(initMindmap)); setEditMode(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-fill-subtle hover:bg-fill-medium text-primary text-xs font-bold rounded-lg transition">
            <Pencil className="w-3.5 h-3.5" /> 편집
          </button>
        )}
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-fill-subtle hover:bg-fill-medium text-primary text-xs font-bold rounded-lg transition ml-auto">
          <Printer className="w-3.5 h-3.5" /> 인쇄
        </button>
      </div>

      {/* ── 씨앗 ── */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-20 rounded-full bg-[#FF6F0F] flex items-center justify-center shadow-lg shadow-[#FF6F0F]/30">
          <span className="text-white text-2xl">🌱</span>
        </div>
        {editMode ? (
          <>
            <input value={draft.seed} onChange={e => updSeed(e.target.value)}
              className={`${inp} text-lg font-black text-center max-w-xs`}
              style={{ color: '#FF6F0F' }} placeholder="씨앗 키워드" />
            <textarea value={draft.summary} onChange={e => updSummary(e.target.value)}
              rows={2} className={`${inp} text-xs text-center max-w-xs resize-none text-muted`}
              placeholder="한 줄 요약" />
          </>
        ) : (
          <>
            <span className="text-lg font-black text-white">{data.seed}</span>
            <span className="text-xs text-muted text-center max-w-xs">{data.summary}</span>
          </>
        )}
      </div>

      {/* ── 브랜치 ── */}
      <div className="grid grid-cols-1 gap-4">
        {data.branches.map((branch, bi) => (
          <div key={bi} className="bg-card border border-border-main rounded-xl p-4">
            {/* 브랜치 헤더 */}
            <div className="flex items-center gap-2 mb-3">
              {editMode ? (
                <>
                  <input value={branch.emoji} onChange={e => updBranch(bi, 'emoji', e.target.value)}
                    className="w-9 text-xl text-center bg-fill-subtle border border-border-subtle rounded focus:outline-none" />
                  <input value={branch.topic} onChange={e => updBranch(bi, 'topic', e.target.value)}
                    className="flex-1 text-sm font-bold bg-fill-subtle border border-border-subtle rounded px-2 py-1 focus:outline-none focus:border-[#FF6F0F]"
                    style={{ color: branch.color }} />
                  <div className="flex gap-1 shrink-0">
                    {BRANCH_COLORS.map(c => (
                      <button key={c} onClick={() => updBranch(bi, 'color', c)}
                        className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ backgroundColor: c, borderColor: branch.color === c ? 'white' : 'transparent' }} />
                    ))}
                  </div>
                  <button onClick={() => removeBranch(bi)} className="text-muted hover:text-red-400 transition ml-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xl">{branch.emoji}</span>
                  <span className="font-bold text-sm" style={{ color: branch.color }}>{branch.topic}</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: th.branchLine(branch.color) }} />
                </>
              )}
            </div>

            {/* 노드 목록 */}
            <div className="flex flex-col gap-2">
              {editMode ? (
                <>
                  {branch.children.map((node, ni) => (
                    <div key={ni} className="border border-dashed border-border-subtle rounded-lg p-2.5 space-y-1.5">
                      {/* 1단계 노드 */}
                      <div className="flex items-center gap-1.5">
                        <input value={node.idea} onChange={e => updNode(bi, ni, e.target.value)}
                          className="flex-1 text-sm font-semibold bg-fill-subtle border border-border-subtle rounded px-2 py-1 focus:outline-none focus:border-[#FF6F0F]"
                          style={{ color: branch.color }} />
                        <button onClick={() => addChild(bi, ni)} title="하위 추가"
                          className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-green-400 transition">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeNode(bi, ni)} title="삭제"
                          className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-red-400 transition">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* 2단계 자식 */}
                      {(node.children ?? []).map((child, ci) => (
                        <div key={ci} className="flex items-center gap-1.5 pl-4">
                          <div className="w-3 h-px shrink-0" style={{ backgroundColor: th.connColor(branch.color) }} />
                          <input value={child.idea} onChange={e => updChild(bi, ni, ci, e.target.value)}
                            className="flex-1 text-xs bg-fill-subtle border border-border-subtle rounded px-2 py-1 focus:outline-none focus:border-[#FF6F0F] text-secondary" />
                          <button onClick={() => removeChild(bi, ni, ci)}
                            className="w-5 h-5 rounded flex items-center justify-center text-muted hover:text-red-400 transition">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                  <button onClick={() => addNode(bi)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-primary transition py-1 pl-1">
                    <Plus className="w-3 h-3" /> 아이디어 추가
                  </button>
                </>
              ) : (
                branch.children.map((node, j) => (
                  <MindNode key={j} node={node} color={branch.color} depth={0} th={th} />
                ))
              )}
            </div>
          </div>
        ))}

        {editMode && (
          <button onClick={addBranch}
            className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border-subtle rounded-xl text-sm text-muted hover:text-primary hover:border-[#FF6F0F]/40 transition">
            <Plus className="w-4 h-4" /> 브랜치 추가
          </button>
        )}
      </div>

      {/* ── 핵심 인사이트 ── */}
      {(data.core_insights?.length > 0 || editMode) && (
        <div className="bg-[#FF6F0F]/8 border border-[#FF6F0F]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-[#FF6F0F]" />
            <span className="text-sm font-bold text-[#FF6F0F]">핵심 인사이트</span>
          </div>
          <div className="space-y-2">
            {(data.core_insights ?? []).map((ins, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[#FF6F0F] shrink-0 mt-0.5">✦</span>
                {editMode ? (
                  <>
                    <input value={ins} onChange={e => updInsight(i, e.target.value)}
                      className="flex-1 text-sm bg-fill-subtle border border-border-subtle rounded px-2 py-1 focus:outline-none focus:border-[#FF6F0F] text-secondary" />
                    <button onClick={() => removeInsight(i)}
                      className="w-5 h-5 flex items-center justify-center text-muted hover:text-red-400 transition shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-secondary">{ins}</span>
                )}
              </div>
            ))}
            {editMode && (
              <button onClick={addInsight}
                className="flex items-center gap-1 text-xs text-muted hover:text-[#FF6F0F] transition mt-1">
                <Plus className="w-3 h-3" /> 인사이트 추가
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 다음 단계 ── */}
      {(data.next_actions?.length > 0 || editMode) && (
        <div className="bg-fill-subtle border border-border-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">다음 단계</span>
          </div>
          <div className="space-y-2">
            {(data.next_actions ?? []).map((act, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-fill-medium flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {i + 1}
                </span>
                {editMode ? (
                  <>
                    <input value={act} onChange={e => updAction(i, e.target.value)}
                      className="flex-1 text-sm bg-fill-subtle border border-border-subtle rounded px-2 py-1 focus:outline-none focus:border-[#FF6F0F] text-secondary" />
                    <button onClick={() => removeAction(i)}
                      className="w-5 h-5 flex items-center justify-center text-muted hover:text-red-400 transition shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-secondary">{act}</span>
                )}
              </div>
            ))}
            {editMode && (
              <button onClick={addAction}
                className="flex items-center gap-1 text-xs text-muted hover:text-primary transition mt-1">
                <Plus className="w-3 h-3" /> 액션 추가
              </button>
            )}
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

  const [fontSize, setFontSize]           = useState(14);
  const [bubbleAlign, setBubbleAlign]     = useState<'end' | 'start' | 'center'>('end');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const composingRef   = useRef(false);
  const organizeAbort  = useRef<AbortController | null>(null);

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

  // ── 팝업 → 메인 BroadcastChannel 동기화 ──────────────────
  useEffect(() => {
    if (!activeId) return;
    const ch = new BroadcastChannel(`mindmap_${activeId}`);
    ch.onmessage = (e) => {
      if (e.data?.type === 'messages_updated') {
        setSession(s => s ? { ...s, messages: e.data.messages } : s);
      }
    };
    return () => ch.close();
  }, [activeId]);

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

  // ── 말풍선 개별 삭제 ───────────────────────────────────────
  async function deleteMessage(index: number) {
    if (!session) return;
    const newMsgs = session.messages.filter((_, i) => i !== index);
    setSession(s => s ? { ...s, messages: newMsgs } : s);
    await fetch(`/api/mindmap/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMsgs }),
    });
  }

  // ── 마인드맵 정리 ──────────────────────────────────────────
  async function organize() {
    if (!session || !session.messages?.length) return;

    // 이전 요청 취소
    organizeAbort.current?.abort();
    const ctrl = new AbortController();
    organizeAbort.current = ctrl;

    setOrganizing(true);
    setView('map');

    try {
      const res = await fetch('/api/mindmap/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: session.messages, sessionId: session.id }),
        signal: ctrl.signal,
      });

      if (res.ok) {
        const { mindmap } = await res.json();
        const newTitle = mindmap.seed?.trim() || session.title;
        await fetch(`/api/mindmap/sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
          signal: ctrl.signal,
        });
        setSession(s => s ? { ...s, mindmap, title: newTitle } : s);
        setSessions(ss => ss.map(s => s.id === session!.id ? { ...s, title: newTitle, mindmap } : s));
      } else {
        // 중지가 아닌 실제 오류
        if (!ctrl.signal.aborted) {
          alert('마인드맵 생성 실패');
          if (!session.mindmap) setView('chat');
        }
      }
    } catch (e) {
      // AbortError: 사용자가 중지 → 이전 마인드맵 유지, 뷰 유지
      if ((e as Error).name !== 'AbortError') {
        alert(`오류: ${(e as Error).message}`);
        if (!session.mindmap) setView('chat');
      }
      // 중지된 경우: 기존 mindmap이 있으면 map뷰 유지, 없으면 chat으로
      else if (!session.mindmap) {
        setView('chat');
      }
    } finally {
      setOrganizing(false);
      organizeAbort.current = null;
    }
  }

  // ── 마인드맵 정리 중지 ─────────────────────────────────────
  function stopOrganize() {
    organizeAbort.current?.abort();
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

            {/* 모델명 */}
            <span className="text-[10px] text-muted bg-fill-subtle border border-border-subtle px-2 py-0.5 rounded-full font-mono tracking-tight select-none">
              Gemini 2.5 Flash
            </span>

            {/* 새창 열기 */}
            {session && (
              <button
                onClick={() => {
                  const url = `/mindmap-popup?session=${activeId}`;
                  window.open(url, 'mindmap_popup',
                    'width=420,height=640,top=60,left=60,resizable=yes,scrollbars=no,toolbar=no,location=no,menubar=no,status=no,directories=no');
                }}
                className="p-1.5 rounded-lg hover:bg-fill-subtle text-muted hover:text-primary transition"
                title="새창으로 열기"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            {/* 정리 버튼 / 중지 버튼 */}
            {session && msgs.length > 0 && (
              organizing ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6F0F]/20 border border-[#FF6F0F]/30 text-[#FF6F0F] text-xs font-bold rounded-lg">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> 정리 중...
                  </div>
                  <button
                    onClick={stopOrganize}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg transition"
                    title="정리 중지"
                  >
                    <X className="w-3.5 h-3.5" /> 중지
                  </button>
                </div>
              ) : (
                <button
                  onClick={organize}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6F0F] hover:bg-[#e85e00] text-white text-xs font-bold rounded-lg transition"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 마인드맵 정리
                </button>
              )
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
              {msgs.map((m, i) => {
                const isUser = m.role === 'user';

                // 가운데: 모두 center, 좌/우: user↔ai 대칭
                const isCenter = bubbleAlign === 'center';
                const align = isCenter
                  ? 'center'
                  : isUser ? bubbleAlign : (bubbleAlign === 'end' ? 'start' : 'end');
                const isRight = align === 'end';
                const tail = isCenter ? '' : isRight ? 'rounded-br-sm' : 'rounded-bl-sm';

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-1.5 group/bubble ${
                      isCenter ? 'justify-center' : isRight ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* 삭제 버튼 (가운데 모드: 왼쪽 고정) */}
                    {isCenter && (
                      <button
                        onClick={() => deleteMessage(i)}
                        className="opacity-0 group-hover/bubble:opacity-100 mt-1 shrink-0 w-5 h-5 rounded-full bg-fill-medium hover:bg-red-500/20 flex items-center justify-center text-muted hover:text-red-400 transition-all"
                        title="삭제"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}

                    {/* 말풍선 */}
                    <div
                      style={{ fontSize: `${fontSize}px` }}
                      className={`rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed ${
                        isCenter ? 'max-w-[85%] text-center' : 'max-w-[78%]'
                      } ${tail} ${
                        isUser
                          ? isCenter
                            ? 'bg-card border border-border-main border-t-2 border-t-[#FF6F0F] text-primary'
                            : 'bg-card border border-border-main border-l-2 border-l-[#FF6F0F] text-primary'
                          : 'bg-fill-subtle border border-border-subtle text-primary'
                      }`}
                    >
                      {m.content}
                    </div>

                    {/* 삭제 버튼 (좌/우 모드) */}
                    {!isCenter && (
                      <button
                        onClick={() => deleteMessage(i)}
                        className="opacity-0 group-hover/bubble:opacity-100 mt-1 shrink-0 w-5 h-5 rounded-full bg-fill-medium hover:bg-red-500/20 flex items-center justify-center text-muted hover:text-red-400 transition-all"
                        title="삭제"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 */}
            <div className="border-t border-border-main p-3">
              {/* 입력창 툴바: 말풍선 위치 + 폰트 크기 */}
              <div className="flex items-center gap-3 mb-2">
                {/* 말풍선 위치 — 오른쪽 → 왼쪽 → 가운데 순환 */}
                <div className="flex items-center rounded-lg border border-border-subtle overflow-hidden text-[10px] font-semibold">
                  {(['end', 'start', 'center'] as const).map(opt => {
                    const active = bubbleAlign === opt;
                    const label = opt === 'end' ? '오른쪽' : opt === 'start' ? '왼쪽' : '가운데';
                    const Icon  = opt === 'end' ? AlignRight : opt === 'start' ? AlignLeft : AlignCenter;
                    return (
                      <button
                        key={opt}
                        onClick={() => setBubbleAlign(opt)}
                        title={`말풍선 ${label}`}
                        className={`flex items-center gap-1 px-2 h-6 transition ${
                          active
                            ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]'
                            : 'text-muted hover:text-primary hover:bg-fill-subtle'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* 폰트 크기 */}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[10px] text-muted mr-0.5">크기</span>
                  <button
                    onClick={() => setFontSize(s => Math.max(10, s - 2))}
                    className="w-6 h-6 rounded flex items-center justify-center bg-fill-subtle hover:bg-fill-medium text-muted hover:text-primary text-xs font-bold transition"
                  >−</button>
                  <button
                    onClick={() => setFontSize(14)}
                    className="px-2 h-6 rounded bg-fill-subtle hover:bg-fill-medium text-muted hover:text-primary text-[10px] font-semibold transition"
                  >기본</button>
                  <button
                    onClick={() => setFontSize(s => Math.min(26, s + 2))}
                    className="w-6 h-6 rounded flex items-center justify-center bg-fill-subtle hover:bg-fill-medium text-muted hover:text-primary text-xs font-bold transition"
                  >+</button>
                  <span className="text-[10px] text-muted w-7 text-center">{fontSize}px</span>
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
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
                  placeholder="아이디어를 입력하세요... (Shift+Enter로 줄바꿈)"
                  rows={3}
                  style={{ fontSize: `${fontSize}px` }}
                  className="flex-1 bg-fill-subtle border border-border-subtle rounded-xl px-4 py-3 text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F] resize-none leading-relaxed"
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
                <button
                  onClick={stopOrganize}
                  className="mt-2 flex items-center gap-1.5 px-5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold rounded-xl transition"
                >
                  <X className="w-4 h-4" /> 정리 중지
                </button>
                {session.mindmap && (
                  <p className="text-[10px] text-muted">중지하면 이전 마인드맵이 유지됩니다</p>
                )}
              </div>
            ) : session.mindmap ? (
              <div className="max-w-2xl mx-auto">
                <MindmapView
                  mindmap={session.mindmap}
                  sessionId={session.id}
                  sessionTitle={session.title}
                  onSaved={(m) => setSession(s => s ? { ...s, mindmap: m } : s)}
                />
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
