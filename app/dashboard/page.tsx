'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Store, Users, Ticket, FileText, AlertCircle, Music, CloudRain, Sun, Thermometer, Database, HardDrive, Table2, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Stats {
  stores:        number;
  activeStores:  number;
  users:         number;
  coupons:       number;
  activeCoupons: number;
  posts:         number;
  pendingDelete: number;
  playlists:     number;
}

interface WeatherData {
  current: { temp: number; feelsLike: number; humidity: number; windSpeed: number; label: string; emoji: string; category: string };
  daily: { date: string; dayOfWeek: string; tempMax: number; tempMin: number; precipProb: number; precipSum: number; label: string; emoji: string; category: string }[];
  moodRecommendation: { moods: string[]; message: string };
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [dbStats, setDbStats] = useState<{ tables: { table: string; count: number | null }[]; buckets: { bucket: string; files: number; bytes: number }[] } | null>(null);
  const [webhookState,   setWebhookState]   = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [webhookMsg,     setWebhookMsg]     = useState('');
  const [webhookUrlInput, setWebhookUrlInput] = useState('');

  useEffect(() => {
    const sb = createClient();

    const load = async () => {
      const [
        { count: stores },
        { count: activeStores },
        { count: users },
        { count: coupons },
        { count: activeCoupons },
        { count: posts },
        { count: pendingDelete },
        { count: playlists },
      ] = await Promise.all([
        sb.from('stores').select('*', { count: 'exact', head: true }),
        sb.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('users').select('*', { count: 'exact', head: true }),
        sb.from('coupons').select('*', { count: 'exact', head: true }),
        sb.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('store_posts').select('*', { count: 'exact', head: true }),
        sb.from('post_delete_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('playlists').select('*', { count: 'exact', head: true }),
      ]);
      setStats({
        stores:        stores ?? 0,
        activeStores:  activeStores ?? 0,
        users:         users ?? 0,
        coupons:       coupons ?? 0,
        activeCoupons: activeCoupons ?? 0,
        posts:         posts ?? 0,
        pendingDelete: pendingDelete ?? 0,
        playlists:     playlists ?? 0,
      });
      setLoading(false);
    };

    load();

    // 실시간 구독 — 주요 테이블 변경 시 자동 갱신
    const channel = sb
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' },               () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' },              () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_posts' },          () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_delete_requests' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },                () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' },            () => load())
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, []);

  // DB 이용현황 로드
  useEffect(() => {
    fetch('/api/dev/db-stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDbStats(d); })
      .catch(() => {});
  }, []);

  // 날씨 로드
  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(d => { if (!d.error) setWeather(d); })
      .catch(() => {});
  }, []);

  const CARDS = stats ? [
    {
      icon: Store, label: '전체 가게', value: stats.stores,
      sub: `활성 ${stats.activeStores}개`,
      color: 'text-[#FF6F0F]', bg: 'bg-[#FF6F0F]/10',
    },
    {
      icon: Users, label: '전체 회원', value: stats.users,
      sub: '가입된 전체 사용자',
      color: 'text-blue-400', bg: 'bg-blue-400/10',
    },
    {
      icon: Ticket, label: '전체 쿠폰', value: stats.coupons,
      sub: `활성 ${stats.activeCoupons}개`,
      color: 'text-green-400', bg: 'bg-green-400/10',
    },
    {
      icon: FileText, label: '피드 게시물', value: stats.posts,
      sub: pendingDelete(stats) > 0 ? `⚠️ 삭제 요청 ${pendingDelete(stats)}건 대기 중` : '삭제 요청 없음',
      subColor: pendingDelete(stats) > 0 ? 'text-red-400' : '',
      color: 'text-purple-400', bg: 'bg-purple-400/10',
    },
    {
      icon: Music, label: '플레이리스트', value: stats.playlists,
      sub: 'AI + 수동 합계',
      color: 'text-indigo-400', bg: 'bg-indigo-400/10',
    },
  ] : [];

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">대시보드</h1>
        <p className="text-sm text-muted mt-1">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {CARDS.map(({ icon: Icon, label, value, sub, subColor, color, bg }) => (
            <div key={label} className="bg-card border border-border-main rounded-2xl p-5">
              <div className={`inline-flex p-2 rounded-xl ${bg} mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-2xl font-bold text-primary">{value.toLocaleString()}</p>
              <p className="text-xs font-semibold text-tertiary mt-0.5">{label}</p>
              <p className={`text-xs mt-1.5 ${subColor || 'text-dim'}`}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 요청 알림 */}
      {stats && stats.pendingDelete > 0 && (
        <div className="mt-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">게시물 삭제 요청 {stats.pendingDelete}건 처리 필요</p>
            <p className="text-xs text-muted mt-0.5">
              게시물 관리 메뉴에서 승인 또는 반려해주세요
            </p>
          </div>
        </div>
      )}

      {/* 날씨 + BGM 추천 */}
      {weather && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 현재 날씨 */}
          <div className="bg-card border border-border-main rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-tertiary">현재 날씨</h3>
              <span className="text-[10px] text-dim">{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-5xl">{weather.current.emoji}</span>
              <div>
                <p className="text-3xl font-bold text-primary">{Math.round(weather.current.temp)}°</p>
                <p className="text-xs text-muted">{weather.current.label} · 체감 {Math.round(weather.current.feelsLike)}°</p>
                <p className="text-[10px] text-dim mt-0.5">💧 {weather.current.humidity}% · 💨 {Math.round(weather.current.windSpeed)}km/h</p>
              </div>
            </div>
          </div>

          {/* 주간 예보 */}
          <div className="bg-card border border-border-main rounded-2xl p-5">
            <h3 className="text-xs font-bold text-tertiary mb-3">7일 예보</h3>
            <div className="flex gap-1">
              {weather.daily.map((d, i) => (
                <div key={d.date} className={`flex-1 text-center rounded-lg py-2 transition ${i === 0 ? 'bg-[#FF6F0F]/10' : ''}`}>
                  <p className={`text-[10px] font-semibold ${i === 0 ? 'text-[#FF6F0F]' : 'text-muted'}`}>{i === 0 ? '오늘' : d.dayOfWeek}</p>
                  <p className="text-lg my-0.5">{d.emoji}</p>
                  <p className="text-[10px] text-primary font-bold">{Math.round(d.tempMax)}°</p>
                  <p className="text-[10px] text-dim">{Math.round(d.tempMin)}°</p>
                  {d.precipProb > 30 && (
                    <p className="text-[8px] text-blue-400 font-semibold mt-0.5">💧{d.precipProb}%</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* BGM 추천 */}
          <div className="bg-card border border-border-main rounded-2xl p-5">
            <h3 className="text-xs font-bold text-tertiary mb-3">🎵 날씨 맞춤 BGM</h3>
            <p className="text-xs text-muted leading-relaxed mb-3">{weather.moodRecommendation.message}</p>
            <div className="flex flex-wrap gap-1.5">
              {weather.moodRecommendation.moods.map(m => (
                <span key={m} className="text-[10px] px-2.5 py-1 rounded-full bg-[#FF6F0F]/15 text-[#FF6F0F] border border-[#FF6F0F]/30 font-semibold">{m}</span>
              ))}
            </div>
            <a href="/dashboard/tracks" className="mt-3 flex items-center gap-1 text-[10px] text-[#FF6F0F] hover:underline">
              <Music size={10} /> 트랙 관리에서 해당 무드 필터링 →
            </a>
          </div>
        </div>
      )}

      {/* DB 이용현황 */}
      {dbStats && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-tertiary mb-3 flex items-center gap-2">
            <Database size={14} className="text-[#FF6F0F]" />
            데이터베이스 이용현황
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* 테이블 row 수 */}
            <div className="bg-card border border-border-main rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Table2 size={14} className="text-blue-400" />
                <h3 className="text-xs font-bold text-tertiary">테이블 레코드 수</h3>
              </div>
              <div className="space-y-2">
                {dbStats.tables.map(({ table, count }) => {
                  const maxCount = Math.max(...dbStats.tables.map(t => t.count ?? 0), 1);
                  const pct = Math.round(((count ?? 0) / maxCount) * 100);
                  const LABEL: Record<string, string> = {
                    stores: '가게', users: '회원', owner_pins: '사장님 PIN',
                    music_tracks: '트랙', playlists: '플레이리스트',
                    playlist_tracks: '플레이리스트-트랙', coupons: '쿠폰',
                    store_posts: '피드 게시물', post_delete_requests: '삭제 요청',
                    store_announcements: '안내방송', fish_voices: '음성', notices: '공지사항',
                  };
                  return (
                    <div key={table}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-secondary">{LABEL[table] ?? table}</span>
                        <span className="text-xs font-bold text-primary tabular-nums">
                          {count === null ? '—' : count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-fill-medium rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400/70 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Storage 버킷 */}
            <div className="bg-card border border-border-main rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <HardDrive size={14} className="text-green-400" />
                <h3 className="text-xs font-bold text-tertiary">Storage 버킷</h3>
              </div>
              <div className="space-y-5">
                {dbStats.buckets.map(({ bucket, files, bytes }) => {
                  const mb = bytes / 1024 / 1024;
                  const gb = mb / 1024;
                  const sizeStr = gb >= 1
                    ? `${gb.toFixed(2)} GB`
                    : mb >= 1
                    ? `${mb.toFixed(1)} MB`
                    : `${(bytes / 1024).toFixed(1)} KB`;
                  // 500MB 기준 바
                  const maxMb = 500;
                  const pct = Math.min(100, Math.round((mb / maxMb) * 100));
                  const barColor = pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-green-400';
                  const BUCKET_LABEL: Record<string, string> = {
                    'music-tracks': '🎵 음악 트랙',
                    'store-images': '🏪 가게 이미지',
                    'tts-audio':    '🔊 TTS 음성',
                  };
                  return (
                    <div key={bucket}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-secondary">{BUCKET_LABEL[bucket] ?? bucket}</span>
                        <div className="flex items-center gap-2 text-xs text-dim">
                          <span>{files.toLocaleString()}개 파일</span>
                          <span className="font-bold text-primary">{sizeStr}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-fill-medium rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-dim mt-0.5">기준 500MB 대비 {pct}%</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-border-main/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">총 Storage 사용량</span>
                  <span className="text-sm font-bold text-primary">
                    {(() => {
                      const totalMb = dbStats.buckets.reduce((s, b) => s + b.bytes, 0) / 1024 / 1024;
                      return totalMb >= 1024
                        ? `${(totalMb / 1024).toFixed(2)} GB`
                        : `${totalMb.toFixed(1)} MB`;
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted">총 파일 수</span>
                  <span className="text-sm font-bold text-primary">
                    {dbStats.buckets.reduce((s, b) => s + b.files, 0).toLocaleString()}개
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 빠른 링크 */}
      <div className="mt-8">
        <h2 className="text-sm font-bold text-tertiary mb-3">빠른 이동</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/stores',    emoji: '🏪', label: '가게 승인 관리' },
            { href: '/dashboard/posts',     emoji: '📝', label: '삭제 요청 처리' },
            { href: '/dashboard/coupons',   emoji: '🎟', label: '쿠폰 현황' },
            { href: '/dashboard/playlists', emoji: '🎵', label: '플레이리스트 편집' },
          ].map(({ href, emoji, label }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 bg-card hover:bg-card-hover border border-border-main rounded-xl px-4 py-3.5 transition group"
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-sm font-semibold text-secondary group-hover:text-primary transition">{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* 텔레그램 웹훅 */}
      <div className="mt-6 p-4 bg-card border border-border-main rounded-2xl space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl shrink-0">✈️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-primary">텔레그램 웹훅</p>
            <p className="text-[12px] mt-0.5">
              {webhookState === 'ok'      && <span className="text-green-400">{webhookMsg}</span>}
              {webhookState === 'error'   && <span className="text-red-400">{webhookMsg}</span>}
              {webhookState === 'idle'    && <span className="text-muted">알림이 안 올 때 재등록하세요.</span>}
              {webhookState === 'loading' && <span className="text-muted">등록 중...</span>}
            </p>
          </div>
        </div>
        {/* URL 입력 + 버튼 */}
        <div className="flex gap-2">
          <input
            value={webhookUrlInput}
            onChange={e => setWebhookUrlInput(e.target.value)}
            placeholder="https://배포URL.com  (비우면 .env의 SITE_URL 사용)"
            className="flex-1 min-w-0 bg-sidebar border border-border-subtle rounded-xl px-3 py-2 text-[12px] text-primary placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition"
          />
          <button
            onClick={async () => {
              setWebhookState('loading'); setWebhookMsg('');
              try {
                const r = await fetch('/api/admin/telegram-webhook', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: webhookUrlInput.trim() || undefined }),
                });
                const d = await r.json();
                if (d.ok) { setWebhookState('ok'); setWebhookMsg('✅ ' + d.webhookUrl); }
                else { setWebhookState('error'); setWebhookMsg(d.error ?? '등록 실패'); }
              } catch { setWebhookState('error'); setWebhookMsg('네트워크 오류'); }
            }}
            disabled={webhookState === 'loading'}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-[12px] font-bold transition disabled:opacity-50"
          >
            {webhookState === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
             webhookState === 'ok'      ? <CheckCircle className="w-3.5 h-3.5" /> :
             webhookState === 'error'   ? <XCircle className="w-3.5 h-3.5" /> :
             <Send className="w-3.5 h-3.5" />}
            웹훅 등록
          </button>
        </div>
      </div>
    </div>
  );
}

function pendingDelete(stats: Stats) { return stats.pendingDelete; }
