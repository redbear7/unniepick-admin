'use client';

/**
 * ApplicationStatusView
 *
 * /apply/complete  (신청 직후 — token을 URL search param으로 받음)
 * /apply/status/[token] (재방문 — token을 path param으로 받음)
 * 두 곳에서 공통으로 사용하는 신청 내역 확인 뷰
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check, Clock, XCircle, Gift, Percent, CircleDollarSign,
  MapPin, Phone, User, Tag, CalendarDays, Package,
  Users, ShoppingBag, AlarmClock, Copy, CheckCheck,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface CouponDraft {
  discount_type:    'free_item' | 'percent' | 'amount';
  title:            string;
  discount_value:   number;
  free_item_name:   string | null;
  expires_at:       string | null;
  total_quantity:   number;
  target_segment?:  string | null;
  min_visit_count?: number | null;
  min_people?:      number | null;
  min_order_amount?: number | null;
  time_start?:      string | null;
  time_end?:        string | null;
  stackable?:       boolean;
  per_person_limit?: boolean;
}

interface Application {
  id:             string;
  review_token:   string;
  status:         'pending' | 'approved' | 'rejected';
  admin_note:     string | null;
  created_at:     string;
  reviewed_at:    string | null;
  store_name:     string;
  category:       string;
  address:        string;
  address_detail: string | null;
  phone:          string | null;
  owner_name:     string;
  owner_phone:    string;
  coupon_draft:   CouponDraft | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  cafe: '카페', food: '음식점', beauty: '미용실', nail: '네일샵',
  fashion: '의류', fitness: '헬스/운동', mart: '마트/편의점', etc: '기타',
};
const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '☕', food: '🍽️', beauty: '✂️', nail: '💅',
  fashion: '👗', fitness: '💪', mart: '🛒', etc: '🏪',
};

function StatusBadge({ status }: { status: Application['status'] }) {
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
      <Clock size={14} /> 심사 중
    </span>
  );
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
      <Check size={14} /> 승인 완료
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-600 text-sm font-semibold">
      <XCircle size={14} /> 반려됨
    </span>
  );
}

function CouponTypeIcon({ type }: { type: CouponDraft['discount_type'] }) {
  if (type === 'free_item') return <Gift size={16} className="text-[#FF6F0F]" />;
  if (type === 'percent')   return <Percent size={16} className="text-[#FF6F0F]" />;
  return <CircleDollarSign size={16} className="text-[#FF6F0F]" />;
}

function couponValueLabel(c: CouponDraft) {
  if (c.discount_type === 'free_item') return c.free_item_name ? `${c.free_item_name} 무료 제공` : '무료 제공';
  if (c.discount_type === 'percent')   return `${c.discount_value}% 할인`;
  return `${c.discount_value.toLocaleString()}원 할인`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  token:     string;
  isNew?:    boolean; // 신청 직후면 true → 상단에 완료 배너
}

export default function ApplicationStatusView({ token, isNew = false }: Props) {
  const [app,     setApp]     = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/applications/status/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.application) setApp(d.application);
        else setErr(d.error ?? '내역을 불러올 수 없어요');
      })
      .catch(() => setErr('네트워크 오류가 발생했어요'))
      .finally(() => setLoading(false));
  }, [token]);

  const copyLink = () => {
    const url = `${window.location.origin}/apply/status/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#FF6F0F] rounded-full animate-spin" />
        <p className="text-sm">불러오는 중...</p>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (err || !app) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">🔍</div>
      <h2 className="text-lg font-bold text-gray-800">신청 내역을 찾을 수 없어요</h2>
      <p className="text-sm text-gray-500">{err || '링크가 올바른지 확인해주세요'}</p>
      <Link href="/apply" className="mt-2 px-5 py-2.5 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl hover:bg-[#e66000] transition">
        가게 등록하기
      </Link>
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-5 py-8 space-y-5">

      {/* 신청 완료 배너 (isNew=true 일 때만) */}
      {isNew && (
        <div className="bg-[#FF6F0F] text-white rounded-2xl px-6 py-5 text-center">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <Check size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold mb-1">신청이 완료됐어요! 🎉</h2>
          <p className="text-sm text-orange-100 leading-relaxed">
            영업일 1~2일 내로 사장님 연락처로 연락드릴게요.<br />
            이 페이지 링크를 저장하면 언제든 확인할 수 있어요.
          </p>
        </div>
      )}

      {/* 상태 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-gray-50 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">{fmtDate(app.created_at)} 신청</p>
            <h3 className="text-lg font-bold text-gray-900">{app.store_name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {CATEGORY_EMOJI[app.category] ?? '🏪'} {CATEGORY_LABEL[app.category] ?? app.category}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {/* 반려 사유 */}
        {app.status === 'rejected' && app.admin_note && (
          <div className="mx-5 my-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-red-600 mb-1">반려 사유</p>
            <p className="text-sm text-red-700">{app.admin_note}</p>
          </div>
        )}

        {/* 승인 안내 */}
        {app.status === 'approved' && (
          <div className="mx-5 my-4 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-green-700 mb-1">✅ 등록 승인됨</p>
            <p className="text-sm text-green-800">언니픽 앱에 가게가 노출됩니다. 첫 번째 쿠폰도 자동 발행됐어요!</p>
          </div>
        )}

        {/* 가게 정보 */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">가게 정보</p>
          <Row icon={<MapPin size={15} className="text-gray-400" />}
            label="주소"
            value={[app.address, app.address_detail].filter(Boolean).join(' ')} />
          {app.phone && (
            <Row icon={<Phone size={15} className="text-gray-400" />}
              label="가게 전화"
              value={app.phone} />
          )}
        </div>

        {/* 사장님 정보 */}
        <div className="px-5 py-4 space-y-3 border-t border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">신청자 정보</p>
          <Row icon={<User size={15} className="text-gray-400" />}
            label="이름"
            value={app.owner_name} />
          <Row icon={<Phone size={15} className="text-gray-400" />}
            label="연락처"
            value={app.owner_phone} />
        </div>

        {/* 쿠폰 정보 */}
        {app.coupon_draft && (
          <div className="px-5 py-4 space-y-3 border-t border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">첫 번째 쿠폰</p>
            <div className="bg-orange-50 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <CouponTypeIcon type={app.coupon_draft.discount_type} />
                <span className="font-bold text-gray-900">{app.coupon_draft.title}</span>
              </div>
              <Row icon={<Tag size={15} className="text-gray-400" />}
                label="혜택"
                value={couponValueLabel(app.coupon_draft)} />
              {app.coupon_draft.expires_at && (
                <Row icon={<CalendarDays size={15} className="text-gray-400" />}
                  label="유효기간"
                  value={`~ ${fmtDate(app.coupon_draft.expires_at)}`} />
              )}
              {app.coupon_draft.total_quantity > 0 && (
                <Row icon={<Package size={15} className="text-gray-400" />}
                  label="발행 수량"
                  value={`${app.coupon_draft.total_quantity.toLocaleString()}개`} />
              )}
              {/* 세부 옵션 */}
              {app.coupon_draft.target_segment && app.coupon_draft.target_segment !== 'all' && (
                <Row icon={<Users size={15} className="text-gray-400" />}
                  label="대상"
                  value={app.coupon_draft.target_segment === 'new' ? '신규 팔로워' : `${app.coupon_draft.min_visit_count ?? 2}회 이상 방문 고객`} />
              )}
              {(app.coupon_draft.min_people ?? 1) > 1 && (
                <Row icon={<Users size={15} className="text-gray-400" />}
                  label="최소 인원"
                  value={`${app.coupon_draft.min_people}명 이상`} />
              )}
              {(app.coupon_draft.min_order_amount ?? 0) > 0 && (
                <Row icon={<ShoppingBag size={15} className="text-gray-400" />}
                  label="최소 주문금액"
                  value={`${app.coupon_draft.min_order_amount!.toLocaleString()}원 이상`} />
              )}
              {app.coupon_draft.time_start && app.coupon_draft.time_end && (
                <Row icon={<AlarmClock size={15} className="text-gray-400" />}
                  label="사용 시간"
                  value={`${app.coupon_draft.time_start} ~ ${app.coupon_draft.time_end}`} />
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {app.coupon_draft.per_person_limit && (
                  <Chip>1인 1회 제한</Chip>
                )}
                {app.coupon_draft.stackable && (
                  <Chip>중복 사용 허용</Chip>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 링크 복사 버튼 */}
      <button
        onClick={copyLink}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-[#FF6F0F] hover:text-[#FF6F0F] transition"
      >
        {copied
          ? <><CheckCheck size={15} /> 링크 복사됨!</>
          : <><Copy size={15} /> 이 페이지 링크 복사하기</>
        }
      </button>

      {/* 문의 */}
      <p className="text-center text-xs text-gray-400 pb-4">
        문의사항은{' '}
        <a href="mailto:support@unniepick.com" className="text-[#FF6F0F] underline underline-offset-2">
          support@unniepick.com
        </a>
        으로 연락해주세요
      </p>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-xs text-gray-400 w-20 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-800 flex-1 break-all">{value}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6F0F] font-medium">
      {children}
    </span>
  );
}
