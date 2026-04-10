'use client';

import { useState } from 'react';
import Da24Header from '@/components/Da24Header';
import Da24Footer from '@/components/Da24Footer';
import { DUMMY_REVIEWS, ServiceType } from '@/lib/dummy-reviews';

const PAGE_SIZE = 5;

const SERVICE_FILTERS: { label: string; value: ServiceType | 'all' }[] = [
  { label: '전체', value: 'all' },
  { label: '이사', value: '이사' },
  { label: '청소', value: '청소' },
  { label: '인터넷', value: '인터넷' },
  { label: '에어컨', value: '에어컨' },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={i <= rating ? '#3B82F6' : 'none'}
          stroke={i <= rating ? '#3B82F6' : '#93C5FD'}
          strokeWidth="1.5"
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewPage() {
  const [activeFilter, setActiveFilter] = useState<ServiceType | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = activeFilter === 'all'
    ? DUMMY_REVIEWS
    : DUMMY_REVIEWS.filter(r => r.service === activeFilter);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleFilterChange = (value: ServiceType | 'all') => {
    setActiveFilter(value);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Da24Header />

      <main className="flex-1 max-w-[640px] mx-auto w-full px-4 py-6">
        {/* Page Title */}
        <div className="mb-5">
          <h1 className="text-xl font-extrabold text-primary">고객 후기</h1>
          <p className="text-sm text-muted mt-1">
            실제 이용 고객님들의 솔직한 후기입니다
          </p>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-3 bg-card border border-border-main rounded-2xl px-5 py-4 mb-5">
          <div className="flex flex-col items-center flex-1 border-r border-border-subtle">
            <span className="text-2xl font-extrabold text-[#3B82F6]">4.8</span>
            <StarRating rating={5} />
            <span className="text-[10px] text-muted mt-1">평균 별점</span>
          </div>
          <div className="flex flex-col items-center flex-1 border-r border-border-subtle">
            <span className="text-2xl font-extrabold text-primary">{DUMMY_REVIEWS.length}</span>
            <span className="text-[10px] text-muted mt-1">총 후기 수</span>
          </div>
          <div className="flex flex-col items-center flex-1">
            <span className="text-2xl font-extrabold text-primary">98%</span>
            <span className="text-[10px] text-muted mt-1">재이용 의향</span>
          </div>
        </div>

        {/* Service Filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {SERVICE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleFilterChange(value)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition border ${
                activeFilter === value
                  ? 'bg-[#FF6F0F] text-white border-[#FF6F0F]'
                  : 'bg-card text-secondary border-border-main hover:border-[#FF6F0F]/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Review Count */}
        <p className="text-xs text-muted mb-3">
          총 <span className="font-bold text-secondary">{filtered.length}</span>개의 후기
        </p>

        {/* Review List */}
        <div className="space-y-3">
          {visible.map(review => (
            <div
              key={review.id}
              className="bg-card border border-border-main rounded-2xl p-5"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6F0F]/10 flex items-center justify-center text-sm font-bold text-[#FF6F0F] shrink-0">
                    {review.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary leading-tight">{review.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StarRating rating={review.rating} />
                      <span className="text-[11px] text-muted">{review.date}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] text-[10px] font-bold">
                    {review.service}
                  </span>
                  {review.subsidy > 0 && (
                    <p className="text-[10px] text-[#3B82F6] font-semibold mt-1">
                      지원금 {review.subsidy.toLocaleString()}원
                    </p>
                  )}
                </div>
              </div>

              {/* Review Content */}
              <p className="text-sm text-secondary leading-relaxed mb-3">
                {review.content}
              </p>

              {/* Tag Chips */}
              <div className="flex flex-wrap gap-1.5">
                {review.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-fill-subtle text-xs text-tertiary font-medium border border-border-subtle"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && (
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="w-full mt-5 py-3.5 rounded-2xl border border-border-main bg-card text-sm font-semibold text-secondary hover:bg-card-hover transition"
          >
            후기 더보기 ({filtered.length - visibleCount}개 남음)
          </button>
        )}

        {!hasMore && visible.length > 0 && (
          <p className="text-center text-xs text-muted mt-6">모든 후기를 확인했습니다.</p>
        )}
      </main>

      <Da24Footer />
    </div>
  );
}
