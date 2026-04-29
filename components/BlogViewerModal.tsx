'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';

interface Props {
  url: string;
  title?: string;
  onClose: () => void;
}

export default function BlogViewerModal({ url, title, onClose }: Props) {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [loading,  setLoading]  = useState(true);
  const [blocked,  setBlocked]  = useState(false);
  const [key,      setKey]      = useState(0);

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleLoad = () => {
    setLoading(false);
    // iframe이 로드됐지만 X-Frame-Options로 차단된 경우 감지
    try {
      // 같은 도메인이 아니면 접근 불가 → 차단 아님(정상 로드)
      // 차단된 경우 about:blank로 리다이렉트되거나 빈 페이지
      const doc = iframeRef.current?.contentDocument;
      if (doc && doc.body && doc.body.innerHTML === '') setBlocked(true);
    } catch {
      // cross-origin → 정상 로드된 것
    }
  };

  const handleError = () => {
    setLoading(false);
    setBlocked(true);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0d1117] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{ width: 'min(900px, 95vw)', height: 'min(85vh, 800px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex-1 min-w-0">
            {title && (
              <p className="text-sm text-white/70 font-medium truncate">{title}</p>
            )}
            <p className="text-[11px] text-white/30 truncate">{url}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setKey(k => k + 1); setLoading(true); setBlocked(false); }}
              title="새로고침"
              className="text-white/30 hover:text-white/70 transition"
            >
              <RefreshCw size={14} />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="새 탭에서 열기"
              className="text-white/30 hover:text-white/70 transition"
            >
              <ExternalLink size={14} />
            </a>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 relative overflow-hidden">
          {loading && !blocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117] z-10">
              <div className="flex flex-col items-center gap-2 text-white/30">
                <RefreshCw size={20} className="animate-spin" />
                <span className="text-xs">로딩 중...</span>
              </div>
            </div>
          )}

          {blocked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/40">
              <AlertCircle size={32} className="text-amber-400/60" />
              <p className="text-sm">이 페이지는 미리보기가 차단되어 있습니다.</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#03C75A]/15 hover:bg-[#03C75A]/25 border border-[#03C75A]/30 text-[#03C75A] text-sm font-semibold transition"
              >
                <ExternalLink size={14} /> 새 탭에서 열기
              </a>
            </div>
          ) : (
            <iframe
              key={key}
              ref={iframeRef}
              src={url}
              onLoad={handleLoad}
              onError={handleError}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title={title ?? '블로그 원문'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
