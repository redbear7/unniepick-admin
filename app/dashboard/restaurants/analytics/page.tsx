'use client';

import { BarChart3 } from 'lucide-react';

const METABASE_PUBLIC_URL = 'http://localhost:3100/public/dashboard/f5079417-b338-4c42-a3c1-7355b56e5c6e';

export default function RestaurantAnalyticsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          창원 맛집 분석
        </h1>
        <p className="text-sm text-muted mt-1">
          Metabase 기반 빅데이터 대시보드 · 카테고리 분포, 리뷰 분석, 지도
        </p>
      </div>

      <div className="bg-card border border-border-main rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <iframe
          src={`${METABASE_PUBLIC_URL}#bordered=false&titled=false`}
          className="w-full h-full border-0"
          allowTransparency
        />
      </div>
    </div>
  );
}
