'use client';

import { useEffect, useState } from 'react';
import { Pin, AlertTriangle, Megaphone, MessageCircle } from 'lucide-react';

interface Notice {
  id: string;
  author_name: string;
  author_emoji: string;
  title: string;
  content: string;
  image_url: string | null;
  notice_type: 'general' | 'important' | 'event';
  is_pinned: boolean;
  like_count: number;
  created_at: string;
}

const TYPE_META: Record<Notice['notice_type'], { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  general:   { label: '일반',   color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',   Icon: MessageCircle },
  important: { label: '중요',   color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',    Icon: AlertTriangle },
  event:     { label: '이벤트', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', Icon: Megaphone },
};

function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '.').replace(/\.$/, '')
    + ' '
    + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function OwnerNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notices')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setNotices(data); setLoading(false); });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border-main shrink-0">
        <h1 className="text-lg font-bold text-primary">공지사항</h1>
        <p className="text-xs text-muted mt-0.5">언니픽 새 소식을 확인하세요</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5">

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border-main rounded-2xl p-4 h-28 animate-pulse" />
              ))}
            </div>
          ) : notices.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm text-muted">공지사항이 없습니다.</p>
            </div>
          ) : (
            notices.map((n, idx) => {
              const { label, color, bg, Icon } = TYPE_META[n.notice_type];
              const fresh = isNew(n.created_at);
              const isLast = idx === notices.length - 1;
              return (
                /* 래퍼: pb로 카드 간 간격 확보 → 연결선이 gap까지 관통 */
                <div key={n.id} className={`relative ${isLast ? '' : 'pb-3'}`}>

                  {/* 스레드 연결선 — 아바타 하단에서 래퍼 하단까지 */}
                  {!isLast && (
                    <div className="absolute left-[36px] top-[52px] bottom-0 w-px bg-border-main/60 z-0" />
                  )}

                  {/* 카드 */}
                  <div className={`relative z-10 bg-card border rounded-2xl overflow-hidden ${n.is_pinned ? 'border-[#FF6F0F]/30' : 'border-border-main'}`}>

                    {/* 고정 배너 */}
                    {n.is_pinned && (
                      <div className="px-4 py-1 bg-[#FF6F0F]/8 border-b border-[#FF6F0F]/20 flex items-center gap-1.5">
                        <Pin size={10} className="text-[#FF6F0F]" />
                        <span className="text-[10px] font-semibold text-[#FF6F0F]">고정된 공지</span>
                      </div>
                    )}

                    {/* 헤더 */}
                    <div className="px-4 pt-3 pb-2 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-fill-medium flex items-center justify-center text-xl shrink-0">
                        {n.author_emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-muted">{n.author_name}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bg} ${color}`}>
                            <Icon size={9} />{label}
                          </span>
                          {fresh && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none animate-pulse">NEW</span>
                          )}
                          <span className="text-[10px] text-dim ml-auto whitespace-nowrap">{fmtDate(n.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 제목 + 본문 */}
                    <div className="px-4 pb-4">
                      {n.title && (
                        <p className="text-base font-bold text-primary leading-snug mb-1.5">{n.title}</p>
                      )}
                      {n.title && <div className="w-full h-px bg-border-main/40 mb-2" />}
                      <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">{n.content}</p>
                    </div>

                    {/* 이미지 */}
                    {n.image_url && (
                      <div className="px-4 pb-4">
                        <img src={n.image_url} alt="" className="w-full rounded-xl object-cover max-h-64 border border-border-main/30" />
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
