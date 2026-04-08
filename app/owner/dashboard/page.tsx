'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useOwnerSession } from '@/components/OwnerShell';
import { User, Phone, CalendarDays, KeyRound, Store, Music } from 'lucide-react';

interface StoreInfo {
  id:        string;
  name:      string;
  address:   string | null;
  phone:     string | null;
  category:  string | null;
  latitude:  number | null;
  longitude: number | null;
}

interface PinStatus {
  pin_changes:      number;
  pin_change_month: string;
}

interface WeatherData {
  current: {
    temp: number; feelsLike: number; humidity: number;
    windSpeed: number; label: string; emoji: string; category: string;
  };
  daily: {
    date: string; dayOfWeek: string; tempMax: number; tempMin: number;
    precipProb: number; label: string; emoji: string;
  }[];
  moodRecommendation: { moods: string[]; message: string };
}

const MAX_CHANGES = 2;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function OwnerDashboardHome() {
  const { session } = useOwnerSession();
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [weather,   setWeather]   = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!session) return;
    const sb = createClient();

    sb.from('owner_pins')
      .select('pin_changes, pin_change_month')
      .eq('id', session.owner_pin_id)
      .single()
      .then(({ data }) => { if (data) setPinStatus(data as PinStatus); });

    sb.from('stores')
      .select('id, name, address, phone, category, latitude, longitude')
      .eq('owner_id', session.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStoreInfo(data as StoreInfo);
          // 날씨 로드 — 가게 위경도가 있으면 해당 위치, 없으면 서울 기본값
          const lat = (data as StoreInfo).latitude;
          const lng = (data as StoreInfo).longitude;
          const qs  = lat && lng ? `?lat=${lat}&lng=${lng}` : '';
          fetch(`/api/weather${qs}`)
            .then(r => r.json())
            .then(d => { if (!d.error) setWeather(d); })
            .catch(() => {});
        }
      });
  }, [session]);

  if (!session) return null;

  const remaining = pinStatus
    ? pinStatus.pin_change_month === currentMonth()
      ? Math.max(0, MAX_CHANGES - pinStatus.pin_changes)
      : MAX_CHANGES
    : MAX_CHANGES;

  const stats = [
    {
      label: '이름',
      value: session.name,
      icon: User,
      color: 'text-[#FF6F0F]',
      bg: 'bg-[#FF6F0F]/10',
    },
    {
      label: '전화번호',
      value: session.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3'),
      icon: Phone,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: '가입일',
      value: new Date(session.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
      icon: CalendarDays,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'PIN 변경 잔여',
      value: `${remaining}회 / ${MAX_CHANGES}회`,
      icon: KeyRound,
      color: remaining === 0 ? 'text-red-400' : 'text-green-400',
      bg: remaining === 0 ? 'bg-red-500/10' : 'bg-green-500/10',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main shrink-0">
        <h1 className="text-lg font-bold text-primary">대시보드</h1>
        <p className="text-xs text-muted mt-0.5">안녕하세요, {session.name} 사장님 👋</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* 계정 정보 카드 */}
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">계정 정보</h2>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-card border border-border-main rounded-xl p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={18} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-sm font-semibold text-primary mt-0.5 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 연결된 매장 */}
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">연결된 매장</h2>
          {storeInfo ? (
            <div className="bg-card border border-border-main rounded-xl p-5 flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#FF6F0F]/10 flex items-center justify-center shrink-0">
                <Store size={20} className="text-[#FF6F0F]" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-base font-bold text-primary">{storeInfo.name}</p>
                {storeInfo.category && (
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FF6F0F]/10 text-[#FF9F4F] border border-[#FF6F0F]/20">
                    {storeInfo.category}
                  </span>
                )}
                {storeInfo.address && <p className="text-xs text-muted">{storeInfo.address}</p>}
                {storeInfo.phone   && <p className="text-xs text-muted">{storeInfo.phone}</p>}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border-main rounded-xl p-8 flex flex-col items-center justify-center gap-2">
              <Store size={28} className="text-muted/30" />
              <p className="text-sm text-muted">연결된 매장이 없습니다.</p>
              <p className="text-xs text-dim">관리자에게 문의해주세요.</p>
            </div>
          )}
        </div>

        {/* 날씨 + BGM 추천 */}
        {weather && (
          <div>
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              오늘의 날씨
              {storeInfo?.latitude && storeInfo?.longitude && (
                <span className="ml-2 text-[10px] text-dim normal-case font-normal">매장 위치 기준</span>
              )}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* 현재 날씨 */}
              <div className="bg-card border border-border-main rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-tertiary">현재 날씨</p>
                  <span className="text-[10px] text-dim">
                    {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-5xl">{weather.current.emoji}</span>
                  <div>
                    <p className="text-3xl font-bold text-primary">{Math.round(weather.current.temp)}°</p>
                    <p className="text-xs text-muted">{weather.current.label} · 체감 {Math.round(weather.current.feelsLike)}°</p>
                    <p className="text-[10px] text-dim mt-0.5">
                      💧 {weather.current.humidity}% · 💨 {Math.round(weather.current.windSpeed)}km/h
                    </p>
                  </div>
                </div>
              </div>

              {/* 주간 예보 */}
              <div className="bg-card border border-border-main rounded-xl p-4">
                <p className="text-xs font-bold text-tertiary mb-3">7일 예보</p>
                <div className="flex gap-1">
                  {weather.daily.map((d, i) => (
                    <div
                      key={d.date}
                      className={`flex-1 text-center rounded-lg py-1.5 transition ${i === 0 ? 'bg-[#FF6F0F]/10' : ''}`}
                    >
                      <p className={`text-[10px] font-semibold ${i === 0 ? 'text-[#FF6F0F]' : 'text-muted'}`}>
                        {i === 0 ? '오늘' : d.dayOfWeek}
                      </p>
                      <p className="text-base my-0.5">{d.emoji}</p>
                      <p className="text-[10px] text-primary font-bold">{Math.round(d.tempMax)}°</p>
                      <p className="text-[10px] text-dim">{Math.round(d.tempMin)}°</p>
                      {d.precipProb > 30 && (
                        <p className="text-[8px] text-blue-400 font-semibold mt-0.5">💧{d.precipProb}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* BGM 무드 추천 */}
              <div className="bg-card border border-border-main rounded-xl p-4">
                <p className="text-xs font-bold text-tertiary mb-2">🎵 오늘의 추천 BGM 무드</p>
                <p className="text-xs text-muted leading-relaxed mb-3">{weather.moodRecommendation.message}</p>
                <div className="flex flex-wrap gap-1.5">
                  {weather.moodRecommendation.moods.map(m => (
                    <span
                      key={m}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6F0F]/15 text-[#FF6F0F] border border-[#FF6F0F]/30 font-semibold"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1 text-[10px] text-dim">
                  <Music size={10} /> 유니가 날씨에 맞는 플레이리스트를 추천해드려요
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
