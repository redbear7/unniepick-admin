'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Terminal, X, Trash2, ChevronDown, ChevronUp,
  AlertTriangle, AlertCircle, Info, Bug, Copy, CopyCheck,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  id:        number;
  level:     LogLevel;
  args:      string;
  time:      string;
  count:     number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtTime() {
  const d = new Date();
  return (
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0') + '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  );
}

function serialize(args: unknown[]): string {
  return args
    .map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a, null, 0); } catch { return String(a); }
    })
    .join(' ');
}

const LEVEL_STYLE: Record<LogLevel, string> = {
  log:   'text-[var(--text-tertiary)]',
  info:  'text-sky-400',
  warn:  'text-amber-400',
  error: 'text-red-400',
  debug: 'text-violet-400',
};

const LEVEL_BG: Record<LogLevel, string> = {
  log:   '',
  info:  'bg-sky-500/10',
  warn:  'bg-amber-500/10',
  error: 'bg-red-500/15',
  debug: 'bg-violet-500/10',
};

const LEVEL_ICON: Record<LogLevel, React.ReactNode> = {
  log:   <Bug size={10} />,
  info:  <Info size={10} />,
  warn:  <AlertTriangle size={10} />,
  error: <AlertCircle size={10} />,
  debug: <Bug size={10} />,
};

const LEVELS: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug'];
const MAX_ENTRIES = 300;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function DevLogPanel() {
  const [entries,  setEntries]  = useState<LogEntry[]>([]);
  const [open,     setOpen]     = useState(false);
  const [filter,   setFilter]   = useState<LogLevel | 'all'>('all');
  const [height,   setHeight]   = useState(260);
  const [copied,   setCopied]   = useState(false);

  const idRef       = useRef(0);
  const bodyRef     = useRef<HTMLDivElement>(null);
  const autoScroll  = useRef(true);
  const dragRef     = useRef<{ startY: number; startH: number } | null>(null);

  /* ---- intercept console ---- */
  useEffect(() => {
    const orig: Record<LogLevel, (...a: unknown[]) => void> = {
      log:   console.log.bind(console),
      info:  console.info.bind(console),
      warn:  console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    const wrap = (level: LogLevel) => (...args: unknown[]) => {
      orig[level](...args);
      const msg = serialize(args);
      const time = fmtTime();
      setEntries(prev => {
        const last = prev[prev.length - 1];
        if (last && last.level === level && last.args === msg) {
          return [
            ...prev.slice(0, -1),
            { ...last, count: last.count + 1, time },
          ];
        }
        const next = [
          ...prev,
          { id: ++idRef.current, level, args: msg, time, count: 1 },
        ];
        return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
      });
    };

    console.log   = wrap('log');
    console.info  = wrap('info');
    console.warn  = wrap('warn');
    console.error = wrap('error');
    console.debug = wrap('debug');

    return () => {
      console.log   = orig.log;
      console.info  = orig.info;
      console.warn  = orig.warn;
      console.error = orig.error;
      console.debug = orig.debug;
    };
  }, []);

  /* ---- auto-scroll ---- */
  useEffect(() => {
    if (open && autoScroll.current && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [entries, open]);

  /* ---- keyboard shortcut: Ctrl+` ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ---- resize drag ---- */
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };
    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - me.clientY;
      setHeight(Math.max(120, Math.min(600, dragRef.current.startH + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height]);

  const handleCopy = useCallback(() => {
    const text = filtered
      .map(e => `[${e.time}] [${e.level.toUpperCase()}]${e.count > 1 ? ` ×${e.count}` : ''} ${e.args}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [filtered]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.level === filter);

  const counts: Record<LogLevel, number> = { log: 0, info: 0, warn: 0, error: 0, debug: 0 };
  entries.forEach(e => counts[e.level]++);
  const errorCount = counts.error + counts.warn;

  return (
    <>
      {/* ---- floating toggle button ---- */}
      <button
        onClick={() => setOpen(v => !v)}
        title="개발자 로그 (Ctrl+`)"
        className={`fixed bottom-[72px] right-4 z-[9998] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold shadow-lg border transition-all ${
          open
            ? 'bg-[#1a1d24] border-[#FF6F0F]/60 text-[#FF6F0F]'
            : 'bg-[#1a1d24] border-white/10 text-[var(--text-muted)] hover:border-white/20 hover:text-[var(--text-primary)]'
        }`}
      >
        <Terminal size={13} />
        <span>DEV LOG</span>
        {errorCount > 0 && !open && (
          <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {errorCount > 99 ? '99+' : errorCount}
          </span>
        )}
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {/* ---- panel ---- */}
      {open && (
        <div
          style={{ height }}
          className="fixed bottom-[72px] right-0 w-[520px] z-[9997] flex flex-col bg-[#0d1117] border border-white/10 border-b-0 rounded-tl-xl shadow-2xl font-mono text-xs overflow-hidden"
        >
          {/* resize handle */}
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-[#FF6F0F]/40 transition-colors rounded-tl-xl"
          />

          {/* header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0 select-none">
            <Terminal size={12} className="text-[#FF6F0F] shrink-0" />
            <span className="text-[#FF6F0F] font-semibold tracking-wide">DEV LOG</span>
            <span className="text-white/20">|</span>

            {/* level filters */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                  filter === 'all'
                    ? 'bg-white/15 text-white'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                ALL {entries.length}
              </button>
              {LEVELS.filter(l => counts[l] > 0 || filter === l).map(l => (
                <button
                  key={l}
                  onClick={() => setFilter(f => f === l ? 'all' : l)}
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase transition ${
                    filter === l
                      ? 'bg-white/15 ' + LEVEL_STYLE[l]
                      : 'text-white/30 hover:text-white/50'
                  }`}
                >
                  {l} {counts[l]}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <label className="flex items-center gap-1 text-[10px] text-white/30 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll.current}
                onChange={e => { autoScroll.current = e.target.checked; }}
                className="w-3 h-3 accent-[#FF6F0F]"
              />
              자동스크롤
            </label>

            <button
              onClick={handleCopy}
              title={copied ? '복사됨!' : '현재 로그 복사'}
              className={`transition ml-1 ${copied ? 'text-green-400' : 'text-white/30 hover:text-white/70'}`}
            >
              {copied ? <CopyCheck size={13} /> : <Copy size={13} />}
            </button>

            <button
              onClick={() => setEntries([])}
              title="지우기"
              className="text-white/30 hover:text-white/70 transition"
            >
              <Trash2 size={13} />
            </button>
            <button
              onClick={() => setOpen(false)}
              title="닫기"
              className="text-white/30 hover:text-white/70 transition"
            >
              <X size={13} />
            </button>
          </div>

          {/* log body */}
          <div
            ref={bodyRef}
            onScroll={() => {
              if (!bodyRef.current) return;
              const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
              autoScroll.current = scrollTop + clientHeight >= scrollHeight - 10;
            }}
            className="flex-1 overflow-y-auto overflow-x-hidden"
          >
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/20">
                로그 없음
              </div>
            ) : (
              filtered.map(entry => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-2 px-3 py-1 border-b border-white/[0.04] hover:bg-white/[0.03] ${LEVEL_BG[entry.level]}`}
                >
                  {/* level icon */}
                  <span className={`mt-[2px] shrink-0 ${LEVEL_STYLE[entry.level]}`}>
                    {LEVEL_ICON[entry.level]}
                  </span>

                  {/* time */}
                  <span className="text-white/20 shrink-0 text-[10px] mt-[1px]">
                    {entry.time}
                  </span>

                  {/* message */}
                  <span className={`flex-1 break-all whitespace-pre-wrap leading-relaxed ${LEVEL_STYLE[entry.level]}`}>
                    {entry.args}
                  </span>

                  {/* repeat count */}
                  {entry.count > 1 && (
                    <span className="shrink-0 min-w-[20px] text-center rounded-full bg-white/10 text-white/40 text-[10px] px-1 mt-[1px]">
                      ×{entry.count}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
