import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms';
import { logActivity } from '@/lib/server/activity';
import { geocodeAddress } from '@/lib/server/kakao-local';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

type CouponSuggestion = {
  discount_type?: 'free_item' | 'percent' | 'amount';
  title?: string;
  discount_value?: number;
  free_item_name?: string | null;
  best_time?: string | null;
  target?: string | null;
  expected_effect?: string | null;
};

function couponDraftFromSuggestion(benefit: string, raw: unknown) {
  const suggestion = raw && typeof raw === 'object' ? raw as CouponSuggestion : null;
  const discountType = suggestion?.discount_type;
  const isSuggested = discountType === 'free_item' || discountType === 'percent' || discountType === 'amount';
  const title = String(suggestion?.title ?? benefit).trim();
  const value = Number(suggestion?.discount_value);

  return {
    discount_type: isSuggested ? discountType : 'amount',
    title: title || benefit,
    discount_value: isSuggested && discountType !== 'free_item' && Number.isFinite(value) ? value : Number(isSuggested ? 0 : 1000),
    free_item_name: isSuggested && discountType === 'free_item' ? String(suggestion?.free_item_name ?? '').trim() || null : null,
    expires_at: defaultExpiry(),
    total_quantity: 100,
    target_segment: suggestion?.target === '재방문' ? 'returning' : suggestion?.target === '첫방문' ? 'new' : 'all',
    time_start: parseTimeRange(suggestion?.best_time).start,
    time_end: parseTimeRange(suggestion?.best_time).end,
    source: isSuggested ? 'owner_join_ai_suggest' : 'owner_join_30s',
    expected_effect: suggestion?.expected_effect ?? null,
  };
}

function parseTimeRange(value?: string | null) {
  const match = String(value ?? '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  return { start: match?.[1] ?? null, end: match?.[2] ?? null };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'JSON body가 필요합니다.' }, { status: 400 });

  const ownerName = String(body.owner_name ?? '').trim();
  const ownerPhone = cleanPhone(String(body.owner_phone ?? ''));
  const hasAgency = Boolean(body.has_agency);
  const agencyName = String(body.agency_name ?? '').trim();
  const storeName = String(body.store_name ?? '').trim();
  const storePhone = String(body.phone ?? '').trim();
  const benefit = String(body.benefit ?? '').trim();
  const address = String(body.address ?? '').trim();
  const addressDetail = String(body.address_detail ?? '').trim();
  const businessLicensePath = String(body.business_license_path ?? '').trim();
  const businessLicenseFileName = String(body.business_license_file_name ?? '').trim();
  const businessRegistrationNumber = String(body.business_registration_number ?? '').replace(/\D/g, '');
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const gpsLat = Number(body.gps_latitude);
  const gpsLng = Number(body.gps_longitude);
  const gpsAccuracy = Number(body.gps_accuracy_m);
  let placeLat = Number.isFinite(latitude) ? latitude : null;
  let placeLng = Number.isFinite(longitude) ? longitude : null;
  if ((placeLat === null || placeLng === null) && address) {
    try {
      const geocoded = await geocodeAddress(address);
      if (geocoded) {
        placeLat = geocoded.latitude;
        placeLng = geocoded.longitude;
      }
    } catch (geoError) {
      console.warn('[owner/join] geocode failed:', (geoError as Error).message);
    }
  }

  const hasPlaceLatLng = placeLat !== null && placeLng !== null;
  const hasGps = Number.isFinite(gpsLat) && Number.isFinite(gpsLng);

  if (!ownerName) return NextResponse.json({ error: '사장님 성함을 입력해주세요.' }, { status: 400 });
  if (!/^010\d{8}$/.test(ownerPhone)) return NextResponse.json({ error: '010으로 시작하는 휴대폰 번호를 입력해주세요.' }, { status: 400 });
  if (hasAgency && !agencyName) return NextResponse.json({ error: '광고대행사명을 입력해주세요.' }, { status: 400 });
  if (!storeName) return NextResponse.json({ error: '가게 이름을 입력해주세요.' }, { status: 400 });
  if (!body.category) return NextResponse.json({ error: '카테고리를 선택해주세요.' }, { status: 400 });
  if (!benefit) return NextResponse.json({ error: '첫 혜택을 한 줄로 입력해주세요.' }, { status: 400 });
  if (!businessLicensePath && businessRegistrationNumber.length !== 10) {
    return NextResponse.json({ error: '사업자등록증 사진 또는 10자리 사업자번호가 필요합니다.' }, { status: 400 });
  }

  const sb = adminClient();

  const { data, error } = await sb
    .from('store_applications')
    .insert({
      owner_name: ownerName,
      owner_phone: ownerPhone,
      has_agency: hasAgency,
      agency_name: hasAgency ? agencyName : null,
      store_name: storeName,
      category: body.category ?? '기타',
      address: address || '미입력',
      address_detail: addressDetail || null,
      phone: storePhone || null,
      latitude: hasPlaceLatLng ? placeLat : null,
      longitude: hasPlaceLatLng ? placeLng : null,
      message: '사장님 30초 참여 신청',
      coupon_draft: couponDraftFromSuggestion(benefit, body.coupon_suggestion),
      status: 'pending',
      business_license_path: businessLicensePath || null,
      business_license_file_name: businessLicenseFileName || null,
      business_registration_number: businessRegistrationNumber || null,
      gps_verified_at: hasGps ? new Date().toISOString() : null,
      gps_latitude: hasGps ? gpsLat : null,
      gps_longitude: hasGps ? gpsLng : null,
      gps_accuracy_m: hasGps && Number.isFinite(gpsAccuracy) ? gpsAccuracy : null,
      verification_status: 'pending',
    })
    .select('id, review_token')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(sb, {
    event_type: 'store_joined',
    actor_type: 'owner',
    source_table: 'store_applications',
    source_id: data.id,
    area: address || '창원 상권',
    title: `${storeName} 사장님 참여 신청`,
    detail: benefit,
    metadata: {
      owner_phone_masked: `${ownerPhone.slice(0, 3)}****${ownerPhone.slice(-4)}`,
      has_agency: hasAgency,
      agency_name: hasAgency ? agencyName : null,
      business_license_attached: Boolean(businessLicensePath),
      business_registration_number_entered: Boolean(businessRegistrationNumber),
      gps_verified: hasGps,
      gps_accuracy_m: hasGps && Number.isFinite(gpsAccuracy) ? gpsAccuracy : null,
    },
  }).catch(e => console.error('[activity/store_joined]', e.message));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const statusUrl = `${siteUrl}/apply/status/${data.review_token}`;

  await sendSms({
    to: ownerPhone,
    text: `[언니픽] ${storeName} 사장님 참여 신청이 완료됐어요.\n관리자 확인 후 PIN 또는 빠른 참여 링크를 안내드릴게요.\n${statusUrl}`,
  }).catch(e => console.warn('[owner/join] SMS skipped/failed:', e.message));

  return NextResponse.json({ ok: true, id: data.id, review_token: data.review_token, status_url: statusUrl });
}
