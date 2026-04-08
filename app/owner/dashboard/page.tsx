'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useOwnerSession } from '@/components/OwnerShell';
import { User, Phone, CalendarDays, KeyRound, Store, Music, MapPin, Check, Loader2, Bell, AlertTriangle, Megaphone, MessageCircle, Pin, Heart, ChevronRight } from 'lucide-react';
import Link from 'next/link';

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

const NOTICE_TYPE_META: Record<Notice['notice_type'], { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  general:   { label: '일반',   color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',   Icon: MessageCircle },
  important: { label: '중요',   color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',    Icon: AlertTriangle },
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

async function fetchWeather(store: StoreInfo): Promise<WeatherData | null> {
  let qs = '';
  if (store.latitude && store.longitude) {
    qs = `?lat=${store.latitude}&lng=${store.longitude}`;
  } else if (store.address) {
    qs = `?address=${encodeURIComponent(store.address)}`;
  }
  // 주소도 위경도도 없으면 null 반환 (서울 기본값 사용 안 함 — 유도 UI 표시)
  if (!qs) return null;

  try {
    const res = await fetch(`/api/weather${qs}`);
    const data = await res.json();
    return data.error ? null : (data as WeatherData);
  } catch {
    return null;
  }
}

export default function OwnerDashboardHome() {
  const { session } = useOwnerSession();
  const [storeInfo,    setStoreInfo]    = useState<StoreInfo | null>(null);
  const [pinStatus,    setPinStatus]    = useState<PinStatus | null>(null);
  const [weather,      setWeather]      = useState<WeatherData | null>(null);
  const [weatherLabel, setWeatherLabel] = useState('');
  const [notices,      setNotices]      = useState<Notice[]>([]);
  const [likedIds,     setLikedIds]     = useState<Set<string>>(new Set());

  // 주소 입력 상태
  const [addressInput,  setAddressInput]  = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSaved,  setAddressSaved]  = useState(false);

  useEffect(() => {
    fetch('/api/notices')
      .then(r => r.ok ? r.json() : [])
      .then(data => setNotices(data));
  }, []);

  const toggleLike = async (n: Notice) => {
    const already = likedIds.has(n.id);
    setLikedIds(prev => { const s = new Set(prev); already ? s.delete(n.id) : s.add(n.id); return s; });
    setNotices(prev => prev.map(x => x.id === n.id ? { ...x, like_count: x.like_count + (already ? -1 : 1) } : x));
    await fetch(`/api/notices/${n.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ like_count: n.like_count + (already ? -1 : 1) }),
    });
  };

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
        if (!data) return;
        const store = data as StoreInfo;
        setStoreInfo(store);
        loadWeather(store);
      });
  }, [session]);

  const loadWeather = async (store: StoreInfo) => {
    const data = await fetchWeather(store);
    setWeather(data);
    if (store.latitude && store.longitude) {
      setWeatherLabel('매장 위치 기준');
    } else if (store.address) {
      setWeatherLabel('매장 주소 기준');
    }
  };

  const saveAddress = async () => {
    if (!addressInput.trim() || !storeInfo) return;
    setSavingAddress(true);
    const sb = createClient();
    const { error } = await sb
      .from('stores')
      .update({ address: addressInput.trim() })
      .eq('id', storeInfo.id);

    if (!error) {
      const updated = { ...storeInfo, address: addressInput.trim() };
      setStoreInfo(updated);
      setAddressSaved(true);
      await loadWeather(updated);
    }
    setSavingAddress(false);
  };

  if (!session) return null;

  const remaining = pinStatus
    ? pinStatus.pin_change_month === currentMonth()
      ? Math.max(0, MAX_CHANGES - pinStatus.pin_changes)
      : MAX_CHANGES
    : MAX_CHANGES;

  const stats = [
    { label: '이름',       value: session.name,                                                                                   icon: User,        color: 'text-[#FF6F0F]',  bg: 'bg-[#FF6F0F]/10' },
    { label: '전화번호',   value: session.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3'),                                   icon: Phone,       color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    { label: '가입일',     value: new Date(session.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }), icon: CalendarDays, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'PIN 변경 잔여', value: `${remaining}회 / ${MAX_CHANGES}회`,                                                         icon: KeyRound,    color: remaining === 0 ? 'text-red-400' : 'text-green-400', bg: remaining === 0 ? 'bg-red-500/10' : 'bg-green-500/10' },
  ];

  const noAddress = storeInfo && !storeInfo.address && !storeInfo.latitude;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main shrink-0">
        <h1 className="text-lg font-bold text-primary">대시보드</h1>
        <p className="text-xs text-muted mt-0.5">안녕하세요, {session.name} 사장님 👋</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* 공지사항 */}
        {notices.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Bell size={12} />
                공지사항
                {notices.some(n => isNew(n.created_at)) && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">NEW</span>
                )}
              </h2>
              <Link href="/owner/dashboard/notices"
                className="flex items-center gap-0.5 text-[11px] text-dim hover:text-primary transition">
                전체보기 <ChevronRight size={11} />
              </Link>
            </div>

            <div className="space-y-0">
              {notices.slice(0, 1).map((n, idx) => {
                const { label, color, bg, Icon } = NOTICE_TYPE_META[n.notice_type];
                const fresh = isNew(n.created_at);
                const isLast = idx === Math.min(notices.length, 1) - 1;
                const isLiked = likedIds.has(n.id);
                return (
                  <div key={n.id} className="relative">
                    {!isLast && (
                      <div className="absolute left-[21px] top-[44px] bottom-0 w-px bg-border-main/50 z-0" />
                    )}
                    <div className="relative z-10 pb-5 flex gap-3 items-start">
                      {/* 아바타 */}
                      <div className="w-11 h-11 rounded-full bg-fill-medium flex items-center justify-center text-xl shrink-0 border border-border-main/60">
                        {n.author_emoji}
                      </div>
                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold text-muted">{n.author_name}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bg} ${color}`}>
                            <Icon size={9} />{label}
                          </span>
                          {fresh && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none animate-pulse">NEW</span>
                          )}
                          {n.is_pinned && <Pin size={11} className="text-[#FF6F0F] ml-auto shrink-0" />}
                          {!n.is_pinned && <span className="text-[10px] text-dim ml-auto whitespace-nowrap">{timeAgo(n.created_at)}</span>}
                        </div>
                        {n.title && (
                          <p className="text-sm font-bold text-primary leading-snug mb-0.5">{n.title}</p>
                        )}
                        <p className="text-sm text-secondary leading-relaxed line-clamp-2">{n.content}</p>
                        <button
                          onClick={() => toggleLike(n)}
                          className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold transition ${isLiked ? 'text-red-400' : 'text-dim hover:text-red-400'}`}>
                          <Heart size={13} fill={isLiked ? 'currentColor' : 'none'} />
                          {n.like_count > 0 && <span>{n.like_count}</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 계정 정보 */}
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
                {storeInfo.address
                  ? <p className="text-xs text-muted">{storeInfo.address}</p>
                  : <p className="text-xs text-amber-400">📍 주소가 등록되어 있지 않습니다.</p>
                }
                {storeInfo.phone && <p className="text-xs text-muted">{storeInfo.phone}</p>}
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

        {/* 날씨 위젯 */}
        <div>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            오늘의 날씨
            {weatherLabel && (
              <span className="ml-2 text-[10px] text-dim normal-case font-normal">{weatherLabel}</span>
            )}
          </h2>

          {/* 주소 없을 때 — 입력 유도 */}
          {noAddress && !addressSaved ? (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <MapPin size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-primary">매장 주소를 등록하면 날씨를 확인할 수 있어요</p>
                  <p className="text-xs text-muted mt-0.5">주소를 기반으로 매장 위치의 날씨와 맞춤 BGM을 추천해드립니다.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={addressInput}
                  onChange={e => setAddressInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveAddress()}
                  placeholder="예) 서울시 강남구 테헤란로 123"
                  className="flex-1 px-3 py-2 text-sm bg-surface border border-border-main rounded-lg outline-none focus:border-amber-400 text-primary"
                />
                <button
                  onClick={saveAddress}
                  disabled={!addressInput.trim() || savingAddress}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-40 shrink-0"
                >
                  {savingAddress
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Check size={14} />}
                  저장
                </button>
              </div>
            </div>
          ) : weather ? (
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
                    <div key={d.date} className={`flex-1 text-center rounded-lg py-1.5 ${i === 0 ? 'bg-[#FF6F0F]/10' : ''}`}>
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
                    <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6F0F]/15 text-[#FF6F0F] border border-[#FF6F0F]/30 font-semibold">
                      {m}
                    </span>
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1 text-[10px] text-dim">
                  <Music size={10} /> 유니가 날씨에 맞는 플레이리스트를 추천해드려요
                </p>
              </div>

            </div>
          ) : storeInfo ? (
            /* 주소는 있지만 날씨 로딩 중 */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-card border border-border-main rounded-xl p-4 h-28 animate-pulse" />
              ))}
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}
