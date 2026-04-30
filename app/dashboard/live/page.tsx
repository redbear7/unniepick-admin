'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Film,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  ShieldCheck,
  Store,
  Ticket,
  Zap,
} from 'lucide-react';

type ActivityType = 'coupon' | 'owner' | 'shorts' | 'use' | 'geo' | 'store';

interface LiveEvent {
  id: string;
  type: ActivityType;
  title: string;
  area: string;
  time: string;
  detail: string;
  privacy: string;
}

interface CouponRow {
  id: string;
  title: string | null;
  created_at: string | null;
  issued_count: number | null;
  used_count?: number | null;
  stores: { name: string | null; address?: string | null } | null;
}

interface StoreRow {
  id: string;
  name: string | null;
  address: string | null;
  created_at: string | null;
}

interface StorePostRow {
  id: string;
  title: string | null;
  created_at: string | null;
  stores: { name: string | null; address?: string | null } | null;
}

interface ReviewClaimRow {
  id: string;
  created_at: string | null;
  status: string | null;
  stores: { name: string | null; address?: string | null } | null;
  coupons: { title: string | null } | null;
}

interface ApiActivityRow {
  id: string;
  event_type: string;
  actor_type: string;
  area: string | null;
  title: string | null;
  detail: string | null;
  geofence_id: string | null;
  radius_m: number | null;
  created_at: string | null;
}

const AREA_KEYWORDS = [
  '상남동',
  '용호동',
  '중앙동',
  '창원대',
  '마산',
  '창동',
  '어시장',
  '석동',
  '여좌천',
  '의창구',
  '성산구',
];

const TYPE_STYLE: Record<ActivityType, { icon: typeof Ticket; label: string; color: string; bg: string }> = {
  coupon: { icon: Ticket, label: '쿠폰 발행', color: 'text-green-400', bg: 'bg-green-400/10' },
  owner:  { icon: Store, label: '사장님 활동', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  shorts: { icon: Film, label: '숏폼/릴스', color: 'text-pink-400', bg: 'bg-pink-400/10' },
  use:    { icon: CheckCircle2, label: '쿠폰 사용', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  geo:    { icon: Navigation, label: '지오펜스', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  store:  { icon: MapPin, label: '가게 등록', color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

const GEOFENCES = [
  {
    area: '상남동 점심권',
    radius: '700m',
    trigger: '11:00-13:30 진입',
    message: '지금 사용 가능한 만원픽 8개 노출',
    status: 'V1 필수',
  },
  {
    area: '창원대 카페권',
    radius: '500m',
    trigger: '14:00-17:30 진입',
    message: '카페 한산딜, 공부픽 쿠폰 추천',
    status: 'V1 후반',
  },
  {
    area: '용호동 직장인권',
    radius: '600m',
    trigger: '퇴근 30분 전',
    message: '저녁 응원딜과 포장 쿠폰 추천',
    status: 'V2',
  },
];

function areaFromText(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(' ');
  return AREA_KEYWORDS.find(keyword => text.includes(keyword)) ?? '창원 상권';
}

function relativeTime(value: string | null) {
  if (!value) return '방금 전';
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 60_000) return '방금 전';
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

function eventDate(e: LiveEvent) {
  const token = e.id.split(':').at(-1);
  const n = token ? Number(token) : 0;
  return Number.isFinite(n) ? n : 0;
}

function typeFromEventType(eventType: string): ActivityType {
  if (eventType.includes('coupon_used') || eventType.includes('route')) return 'use';
  if (eventType.includes('shorts')) return 'shorts';
  if (eventType.includes('store') || eventType.includes('coupon_created')) return 'owner';
  if (eventType.includes('geofence')) return 'geo';
  if (eventType.includes('coupon')) return 'coupon';
  return 'store';
}

export default function LiveActivityPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();

    const [couponRes, storeRes, postRes, claimRes] = await Promise.all([
      sb
        .from('coupons')
        .select('id, title, created_at, issued_count, used_count, stores(name, address)')
        .order('created_at', { ascending: false })
        .limit(12),
      sb
        .from('stores')
        .select('id, name, address, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      sb
        .from('store_posts')
        .select('id, title, created_at, stores(name, address)')
        .order('created_at', { ascending: false })
        .limit(8),
      sb
        .from('review_claims')
        .select('id, created_at, status, stores(name, address), coupons(title)')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const coupons = (couponRes.data ?? []) as unknown as CouponRow[];
    const stores = (storeRes.data ?? []) as unknown as StoreRow[];
    const posts = (postRes.data ?? []) as unknown as StorePostRow[];
    const claims = (claimRes.data ?? []) as unknown as ReviewClaimRow[];
    const activityRows = await fetch('/api/activity?limit=24')
      .then(res => res.ok ? res.json() : null)
      .then(json => (json?.events ?? []) as ApiActivityRow[])
      .catch(() => []);

    const explicitEvents: LiveEvent[] = activityRows.map(row => ({
      id: `activity:${row.id}:${new Date(row.created_at ?? Date.now()).getTime()}`,
      type: typeFromEventType(row.event_type),
      title: row.title ?? '새 활동',
      area: row.area ?? '창원 상권',
      time: relativeTime(row.created_at),
      detail: row.detail ?? (row.geofence_id ? `${row.geofence_id} · 반경 ${row.radius_m ?? '-'}m` : row.event_type),
      privacy: '공개 피드용 익명 이벤트',
    }));

    const fallbackEvents: LiveEvent[] = [
      ...coupons.map(coupon => {
        const issued = coupon.issued_count ?? 0;
        const used = coupon.used_count ?? 0;
        return {
          id: `coupon:${coupon.id}:${new Date(coupon.created_at ?? Date.now()).getTime()}`,
          type: 'coupon' as const,
          title: `${coupon.stores?.name ?? '사장님'} 쿠폰 발행`,
          area: areaFromText(coupon.stores?.address, coupon.stores?.name),
          time: relativeTime(coupon.created_at),
          detail: `${coupon.title ?? '새 쿠폰'} · 저장 ${issued.toLocaleString()}건 · 사용 ${used.toLocaleString()}건`,
          privacy: '가게 단위 공개, 사용자 정보 미노출',
        };
      }),
      ...stores.map(store => ({
        id: `store:${store.id}:${new Date(store.created_at ?? Date.now()).getTime()}`,
        type: 'store' as const,
        title: `${store.name ?? '새 가게'} 등록`,
        area: areaFromText(store.address, store.name),
        time: relativeTime(store.created_at),
        detail: '사장님 참여 또는 운영자 검수 후보',
        privacy: '상권/가게명 공개',
      })),
      ...posts.map(post => ({
        id: `post:${post.id}:${new Date(post.created_at ?? Date.now()).getTime()}`,
        type: 'shorts' as const,
        title: `${post.stores?.name ?? '가게'} 콘텐츠 등록`,
        area: areaFromText(post.stores?.address, post.stores?.name),
        time: relativeTime(post.created_at),
        detail: post.title ?? '새 홍보 콘텐츠가 등록됐습니다.',
        privacy: '콘텐츠 단위 공개',
      })),
      ...claims.map(claim => ({
        id: `claim:${claim.id}:${new Date(claim.created_at ?? Date.now()).getTime()}`,
        type: claim.status === 'approved' ? 'use' as const : 'owner' as const,
        title: claim.status === 'approved' ? '쿠폰 사용/방문 인증 승인' : '방문 인증 접수',
        area: areaFromText(claim.stores?.address, claim.stores?.name),
        time: relativeTime(claim.created_at),
        detail: `${claim.stores?.name ?? '가게'} · ${claim.coupons?.title ?? '쿠폰'} · ${claim.status ?? 'pending'}`,
        privacy: '사용자 실명, 정확한 위치 미노출',
      })),
      {
        id: `geo:sample:${Date.now()}`,
        type: 'geo',
        title: '상남동 점심권 진입 신호',
        area: '상남동',
        time: '실시간',
        detail: '반경 700m 안에서 오늘 사용 가능한 만원픽 8개 추천 가능',
        privacy: '개인 좌표 저장 없이 상권 진입 여부만 활용',
      },
    ];

    const next = explicitEvents.length > 0
      ? [...explicitEvents, fallbackEvents[fallbackEvents.length - 1]]
      : fallbackEvents;

    setEvents(next.sort((a, b) => eventDate(b) - eventDate(a)).slice(0, 24));
    setLastSync(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    const sb = createClient();
    const timer = window.setTimeout(() => { void load(); }, 0);

    const channel = sb
      .channel('live-activity-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_posts' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_claims' }, () => load())
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      sb.removeChannel(channel);
    };
  }, [load]);

  const stats = useMemo(() => {
    const byType = events.reduce<Record<ActivityType, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1;
      return acc;
    }, { coupon: 0, owner: 0, shorts: 0, use: 0, geo: 0, store: 0 });

    return [
      { icon: Radio, label: '라이브 이벤트', value: events.length, sub: '최근 활동 신호', color: 'text-orange-400', bg: 'bg-orange-400/10' },
      { icon: Ticket, label: '쿠폰 신호', value: byType.coupon, sub: '발행/저장/사용', color: 'text-green-400', bg: 'bg-green-400/10' },
      { icon: Film, label: '콘텐츠 신호', value: byType.shorts, sub: '릴스/숏폼 후보', color: 'text-pink-400', bg: 'bg-pink-400/10' },
      { icon: MapPin, label: '위치 트리거', value: GEOFENCES.length, sub: '상권 지오펜스', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    ];
  }, [events]);

  return (
    <div className="p-8 space-y-8">
      <section className="rounded-3xl border border-border-main bg-gradient-to-br from-[#191F28] via-[#2B303A] to-[#203D33] p-8 text-white">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-green-100">
            <Radio size={13} />
            실시간 활동 센터
          </div>
          <h1 className="text-3xl font-black leading-tight">
            사장님과 사용자의 움직임을 참여 신호로 보여주세요
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            쿠폰 발행, 저장, QR 사용, 숏폼 제작 요청, 상권 진입 신호를 모아 앱에 “지금 쓰는 사람들”의 분위기를 만듭니다.
            개인정보는 숨기고 상권 단위로만 보여주는 것이 기본 원칙입니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">익명화</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">상권 단위</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">GPS 선택형</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">하단 CTA 연동</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="rounded-2xl border border-border-main bg-card p-5">
            <div className={`mb-3 inline-flex rounded-xl p-2 ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-black text-primary">{loading ? '-' : value}</p>
            <p className="mt-1 text-xs font-bold text-tertiary">{label}</p>
            <p className="mt-1.5 text-xs text-dim">{sub}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-primary">라이브 활동 피드</h2>
              <p className="mt-1 text-sm text-muted">
                {lastSync ? `${lastSync.toLocaleTimeString('ko-KR')} 갱신` : '실시간 연결 준비 중'}
              </p>
            </div>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-fill-subtle px-3 py-2 text-xs font-bold text-tertiary transition hover:text-primary"
            >
              <RefreshCw size={14} />
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-fill-subtle" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(event => {
                const style = TYPE_STYLE[event.type];
                const Icon = style.icon;
                return (
                  <div key={event.id} className="rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl p-2 ${style.bg}`}>
                        <Icon size={17} className={style.color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-tertiary">
                            {style.label}
                          </span>
                          <span className="text-[11px] text-dim">{event.area}</span>
                          <span className="text-[11px] text-dim">· {event.time}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-black text-primary">{event.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted">{event.detail}</p>
                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-dim">
                          <ShieldCheck size={12} />
                          {event.privacy}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border-main bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Navigation size={18} className="text-cyan-400" />
              <h2 className="text-lg font-black text-primary">지오펜스 운영</h2>
            </div>
            <div className="space-y-3">
              {GEOFENCES.map(rule => (
                <div key={rule.area} className="rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-primary">{rule.area}</p>
                    <span className="rounded-full bg-[#FF6F0F]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF6F0F]">
                      {rule.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted">
                    <p className="flex items-center gap-2"><MapPin size={13} />반경 {rule.radius}</p>
                    <p className="flex items-center gap-2"><Clock size={13} />{rule.trigger}</p>
                    <p className="flex items-center gap-2"><Bell size={13} />{rule.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border-main bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck size={18} className="text-green-400" />
              <h2 className="text-lg font-black text-primary">노출 기준</h2>
            </div>
            <div className="space-y-3">
              {[
                ['공개 가능', '상권명, 가게명, 쿠폰명, 익명 활동 수, 상대 시간'],
                ['비공개', '사용자 실명, 전화번호, 정확한 좌표, 개별 이동 경로'],
                ['권한 미동의', 'GPS 대신 상권 직접 선택으로 동일 쿠폰 탐색 제공'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                  <p className="text-sm font-black text-primary">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border-main bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Zap size={18} className="text-[#FF6F0F]" />
              <h2 className="text-lg font-black text-primary">다음 연결</h2>
            </div>
            <div className="grid gap-2">
              {[
                { href: '/dashboard/coupons', label: '쿠폰 운영으로 이동', icon: Ticket },
                { href: '/dashboard/shorts', label: '숏폼 생성으로 이동', icon: Film },
                { href: '/dashboard/map', label: '상권 지도에서 반경 확인', icon: MapPin },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-xl border border-border-subtle bg-fill-subtle px-4 py-3 text-sm font-bold text-tertiary transition hover:border-[#FF6F0F]/40 hover:text-primary"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon size={15} />
                    {label}
                  </span>
                  <Activity size={14} />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-yellow-300" />
              <p className="text-xs leading-5 text-yellow-100/80">
                V1에서는 “상권 단위의 참여감”만 보여주고, 개인을 특정할 수 있는 실시간 위치 추적처럼 보이는 표현은 피하는 것이 좋습니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
