'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

function StoreLoginInner() {
  const searchParams = useSearchParams();
  const errorParam   = searchParams.get('error');

  const [loading, setLoading] = useState(false);

  const handleNaverLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'custom:naver' as 'google',
      options: {
        redirectTo: `${window.location.origin}/store/auth/callback`,
        scopes: 'profile',
      },
    });
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-xs">

        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FF6F0F] mb-4">
            <span className="text-3xl">🍖</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">언니픽</h1>
          <p className="text-sm text-muted mt-1">사장님 전용 로그인</p>
        </div>

        {/* 에러 */}
        {errorParam && (
          <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm text-center">{decodeURIComponent(errorParam)}</p>
          </div>
        )}

        {/* 네이버 로그인 버튼 */}
        <button
          onClick={handleNaverLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-primary text-base transition disabled:opacity-60"
          style={{ backgroundColor: '#03C75A' }}
        >
          {loading ? (
            <span className="text-sm">로그인 중...</span>
          ) : (
            <>
              <NaverIcon />
              네이버로 시작하기
            </>
          )}
        </button>

        <p className="text-center text-xs text-dim mt-6 leading-relaxed">
          처음 방문하시나요?<br />
          로그인 후 가게 등록을 신청할 수 있어요.
        </p>

      </div>
    </div>
  );
}

export default function StoreLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center" />
    }>
      <StoreLoginInner />
    </Suspense>
  );
}

function NaverIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
    </svg>
  );
}
