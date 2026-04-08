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
  general:   { label: '일반',  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   Icon: MessageCircle },
  important: { label: '중요',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',    Icon: AlertTriangle },
  event:     { label: '이벤트', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', Icon: Megaphone },
};

function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
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
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main shrink-0">
        <h1 className="text-lg font-bold text-primary">공지사항</h1>
        <p className="text-xs text-muted mt-0.5">언니픽 새 소식을 확인하세요</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-4 py-5 space-y-0">

          {loading ? (
            <div className="space-y-4 pt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border-main rounded-2xl p-4 h-32 animate-pulse" />
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
              const isLast = idx === notices.length - 1;
              const fresh = isNew(n.created_at);
              return (
                <div key={n.id} className="relative">
                  {/* 스레드 연결선 */}
                  {!isLast && (
                    <div className="absolute left-[21px] top-[44px] bottom-0 w-px bg-border-main/50 z-0" />
                  )}

                  <div className="relative z-10 pb-5">
                    {/* 고정 배너 */}
                    {n.is_pinned && (
                      <div className="flex items-center gap-1.5 mb-2 pl-12">
                        <Pin size={11} className="text-[#FF6F0F]" />
                        <span className="text-[10px] font-semibold text-[#FF6F0F]">고정된 공지</span>
                      </div>
                    )}

                    <div className="flex gap-3 items-start">
                      {/* 아바타 */}
                      <div className="w-11 h-11 rounded-full bg-fill-medium flex items-center justify-center text-xl shrink-0 border border-border-main/60">
                        {n.author_emoji}
                      </div>

                      {/* 본문 */}
                      <div className="flex-1 min-w-0">
                        {/* 이름 + 뱃지 + NEW + 시간 */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-xs font-semibold text-muted">{n.author_name}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bg} ${color}`}>
                            <Icon size={9} />
                            {label}
                          </span>
                          {fresh && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none animate-pulse">
                              NEW
                            </span>
                          )}
                          <span className="text-[10px] text-dim ml-auto whitespace-nowrap">
                            {new Date(n.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
                          </span>
                        </div>

                        {/* 제목 */}
                        {n.title && (
                          <p className="text-base font-bold text-primary leading-snug mb-1.5">{n.title}</p>
                        )}
                        {/* 제목 구분선 */}
                        {n.title && <div className="w-full h-px bg-border-main/40 mb-2" />}

                        {/* 본문 */}
                        <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap mb-2">{n.content}</p>

                        {/* 이미지 */}
                        {n.image_url && (
                          <img src={n.image_url} alt="" className="w-full rounded-xl object-cover max-h-64 mb-3 border border-border-main/30" />
                        )}
                      </div>
                    </div>
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
