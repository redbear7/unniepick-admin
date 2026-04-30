'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useOwnerSession } from '@/components/OwnerShell';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  MapPin,
  MessageSquare,
  Music,
  Radio,
  Send,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';

interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
}

interface Coupon {
  id: string;
  title: string;
  is_active: boolean;
  issued_count: number;
  total_quantity: number;
  expires_at: string;
}

interface ActivityEvent {
  id: string;
  event_type: string;
  title: string;
  detail: string | null;
  area: string | null;
  created_at: string;
}

const QUICK_STEPS = [
  { icon: MapPin, title: '가게 확인', desc: '가게명과 위치가 맞는지만 확인' },
  { icon: Ticket, title: '혜택 하나 입력', desc: '예: 점심 500원 할인, 라떼 1+1' },
  { icon: Film, title: '릴스 요청', desc: '사진 1장만 올리면 운영자가 제작' },
];

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

export default function OwnerQuickPage() {
  const { session } = useOwnerSession();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [benefit, setBenefit] = useState('');
  const [photoNote, setPhotoNote] = useState('');
  const [sending, setSending] = useState<'coupon' | 'shorts' | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const sb = createClient();

    const { data: storeData } = await sb
      .from('stores')
      .select('id, name, address, category')
      .eq('owner_id', session.user_id)
      .maybeSingle();

    if (!storeData) {
      setLoading(false);
      return;
    }

    const nextStore = storeData as StoreInfo;
    setStore(nextStore);

    const [{ data: couponData }, activityJson] = await Promise.all([
      sb
        .from('coupons')
        .select('id, title, is_active, issued_count, total_quantity, expires_at')
        .eq('store_id', nextStore.id)
        .order('created_at', { ascending: false })
        .limit(5),
      fetch(`/api/activity?limit=8`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null),
    ]);

    setCoupons((couponData ?? []) as Coupon[]);
    setActivities(((activityJson?.events ?? []) as ActivityEvent[])
      .filter(event => event.title?.includes(nextStore.name) || event.detail?.includes(nextStore.name))
      .slice(0, 4));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const activeCoupons = coupons.filter(coupon => coupon.is_active && new Date(coupon.expires_at) > new Date());
  const totalIssued = coupons.reduce((sum, coupon) => sum + (coupon.issued_count ?? 0), 0);

  const guideText = useMemo(() => {
    if (!store) return '';
    return `${store.name} 사장님, 오늘은 혜택 하나만 올려도 충분해요. 운영자가 쿠폰 카드와 릴스 문구를 다듬어드릴게요.`;
  }, [store]);

  const submitActivity = async (type: 'coupon' | 'shorts') => {
    if (!store) return;
    const text = type === 'coupon' ? benefit.trim() : photoNote.trim();
    if (!text) {
      setMessage(type === 'coupon' ? '등록할 혜택을 한 줄로 입력해주세요.' : '릴스에 넣을 요청을 한 줄로 입력해주세요.');
      return;
    }

    setSending(type);
    setMessage('');

    const res = await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: type === 'coupon' ? 'coupon_created' : 'shorts_requested',
        actor_type: 'owner',
        user_id: session?.user_id,
        store_id: store.id,
        area: store.address?.split(' ').slice(0, 3).join(' ') || '창원 상권',
        title: type === 'coupon' ? `${store.name} 사장님 혜택 등록 요청` : `${store.name} 릴스 제작 요청`,
        detail: text,
        metadata: { source: 'owner_quick_page' },
      }),
    });

    setSending(null);

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setMessage(json?.error ?? '요청 저장에 실패했습니다.');
      return;
    }

    setMessage(type === 'coupon' ? '혜택 요청이 저장됐어요. 관리자가 쿠폰으로 다듬어 반영할 수 있습니다.' : '릴스 제작 요청이 저장됐어요. 운영자가 확인 후 제작합니다.');
    if (type === 'coupon') setBenefit('');
    if (type === 'shorts') setPhotoNote('');
    await load();
  };

  if (!session) return null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#FF6F0F]" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface">
      <div className="mx-auto max-w-[720px] px-5 py-5 sm:py-8">
        <section className="rounded-3xl border border-border-main bg-gradient-to-br from-[#191F28] via-[#2B303A] to-[#49301D] p-6 text-white">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-orange-100">
            <Zap size={13} />
            사장님 30초 참여
          </div>
          <h1 className="text-2xl font-black leading-tight">
            앱 설치 없이 오늘 혜택과 릴스 요청만 남기세요
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            {guideText || '가게 연결이 필요합니다. 관리자에게 사장님 계정 연결을 요청해주세요.'}
          </p>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          {QUICK_STEPS.map(({ icon: Icon, title, desc }, idx) => (
            <div key={title} className="rounded-2xl border border-border-main bg-card p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6F0F]/10 text-[#FF6F0F]">
                <Icon size={17} />
              </div>
              <p className="text-sm font-black text-primary">{idx + 1}. {title}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-border-main bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[#FF6F0F]">내 가게</p>
              <h2 className="mt-1 text-xl font-black text-primary">{store?.name ?? '가게 연결 필요'}</h2>
              <p className="mt-1 text-sm text-muted">{store?.address ?? '주소를 등록하면 근처 혜택과 날씨 추천이 좋아집니다.'}</p>
            </div>
            <Link href="/owner/dashboard/store" className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-bold text-tertiary transition hover:text-primary">
              수정
            </Link>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Ticket, label: '활성 쿠폰', value: `${activeCoupons.length}개`, sub: '지금 노출 가능' },
            { icon: CheckCircle2, label: '누적 저장', value: `${totalIssued}건`, sub: '쿠폰 저장 수' },
            { icon: Radio, label: '활동 신호', value: `${activities.length}건`, sub: '최근 라이브 피드' },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="rounded-2xl border border-border-main bg-card p-4">
              <Icon size={17} className="text-[#FF6F0F]" />
              <p className="mt-3 text-2xl font-black text-primary">{value}</p>
              <p className="mt-1 text-xs font-bold text-tertiary">{label}</p>
              <p className="mt-1 text-xs text-dim">{sub}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Ticket size={18} className="text-[#FF6F0F]" />
            <h2 className="text-lg font-black text-primary">오늘 혜택 한 줄 등록</h2>
          </div>
          <div className="rounded-2xl bg-fill-subtle p-4">
            <input
              value={benefit}
              onChange={e => setBenefit(e.target.value)}
              placeholder="예: 오늘 2시~5시 라떼 1+1"
              className="w-full rounded-xl border border-border-subtle bg-card px-4 py-3 text-sm text-primary outline-none transition focus:border-[#FF6F0F]"
            />
            <button
              onClick={() => submitActivity('coupon')}
              disabled={sending === 'coupon'}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6F0F] px-4 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {sending === 'coupon' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              혜택 등록 요청
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Film size={18} className="text-[#FF6F0F]" />
            <h2 className="text-lg font-black text-primary">릴스 제작 요청</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-[92px_1fr]">
            <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-fill-subtle text-muted">
              <Camera size={26} />
            </div>
            <div>
              <textarea
                value={photoNote}
                onChange={e => setPhotoNote(e.target.value)}
                placeholder="예: 점심 만원 메뉴를 강조해주세요. 사진은 카카오톡으로 보내드릴게요."
                rows={4}
                className="w-full resize-none rounded-xl border border-border-subtle bg-card px-4 py-3 text-sm text-primary outline-none transition focus:border-[#FF6F0F]"
              />
              <button
                onClick={() => submitActivity('shorts')}
                disabled={sending === 'shorts'}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-surface transition hover:opacity-90 disabled:opacity-60"
              >
                {sending === 'shorts' ? <Loader2 size={16} className="animate-spin" /> : <Music size={16} />}
                릴스 제작 요청
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#FF6F0F]/20 bg-[#FF6F0F]/10 p-4 text-sm font-bold text-[#FF6F0F]">
            {message}
          </div>
        )}

        <section className="mt-5 rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-[#FF6F0F]" />
              <h2 className="text-lg font-black text-primary">최근 활동</h2>
            </div>
            <Link href="/owner/dashboard/stats" className="flex items-center gap-1 text-xs font-bold text-muted hover:text-primary">
              통계 보기 <ArrowRight size={13} />
            </Link>
          </div>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="rounded-2xl bg-fill-subtle p-4 text-sm text-muted">
                아직 표시할 활동이 없습니다. 오늘 혜택 하나를 등록하면 라이브 피드에 반영됩니다.
              </div>
            ) : activities.map(activity => (
              <div key={activity.id} className="rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                <div className="flex gap-3">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-[#FF6F0F]" />
                  <div>
                    <p className="text-sm font-black text-primary">{activity.title}</p>
                    {activity.detail && <p className="mt-1 text-xs leading-5 text-muted">{activity.detail}</p>}
                    <p className="mt-1 text-[11px] text-dim">{activity.area ?? '창원 상권'} · {relativeTime(activity.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 mb-8 rounded-2xl border border-border-main bg-card p-5">
          <div className="flex gap-3">
            <MessageSquare size={18} className="mt-0.5 shrink-0 text-[#FF6F0F]" />
            <div>
              <p className="text-sm font-black text-primary">V1 운영 방식</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                사장님은 한 줄만 남기고, 운영자는 관리자 대시보드에서 쿠폰/릴스/푸시로 다듬습니다.
                별도 앱 설치 없이 이 모바일 웹 링크만으로 참여를 시작합니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
