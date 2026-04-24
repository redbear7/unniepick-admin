/**
 * POST /api/applications/submit
 *
 * 점주 가게 등록 신청 제출 (공개 엔드포인트 — 로그인 불필요)
 * store_applications 테이블에 'pending' 상태로 저장
 * coupon_draft JSON 필드에 첫 번째 쿠폰 초안 포함
 *
 * Response: { ok: true, id: string, review_token: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

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

interface SubmitBody {
  store_name:      string;
  category:        string;
  address:         string;
  address_detail?: string | null;
  phone?:          string | null;
  latitude?:       number | null;
  longitude?:      number | null;
  owner_name:      string;
  owner_phone:     string;
  coupon_draft:    CouponDraft;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<SubmitBody>;

  // ── 필수값 검증 ──────────────────────────────────────────────
  if (!body.store_name?.trim())  return NextResponse.json({ error: '가게 이름을 입력해주세요' }, { status: 400 });
  if (!body.category)            return NextResponse.json({ error: '카테고리를 선택해주세요' }, { status: 400 });
  if (!body.address?.trim())     return NextResponse.json({ error: '주소를 입력해주세요' }, { status: 400 });
  if (!body.owner_name?.trim())  return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 });
  if (!body.owner_phone?.trim()) return NextResponse.json({ error: '연락처를 입력해주세요' }, { status: 400 });
  if (!body.coupon_draft)        return NextResponse.json({ error: '첫 번째 쿠폰을 입력해주세요' }, { status: 400 });

  const c = body.coupon_draft;
  if (!c.title?.trim())          return NextResponse.json({ error: '쿠폰 이름을 입력해주세요' }, { status: 400 });
  if (c.discount_type === 'free_item' && !c.free_item_name?.trim()) {
    return NextResponse.json({ error: '무료 제공 아이템을 입력해주세요' }, { status: 400 });
  }
  if ((c.discount_type === 'percent' || c.discount_type === 'amount') && !(c.discount_value > 0)) {
    return NextResponse.json({ error: '할인 값을 입력해주세요' }, { status: 400 });
  }
  if (!c.expires_at) return NextResponse.json({ error: '쿠폰 유효기간을 입력해주세요' }, { status: 400 });

  const sb = adminClient();

  const { data, error } = await sb
    .from('store_applications')
    .insert({
      store_name:     body.store_name.trim(),
      category:       body.category,
      address:        body.address.trim(),
      address_detail: body.address_detail ?? null,
      phone:          body.phone ?? null,
      latitude:       body.latitude ?? null,
      longitude:      body.longitude ?? null,
      owner_name:     body.owner_name.trim(),
      owner_phone:    body.owner_phone.trim(),
      coupon_draft:   body.coupon_draft,
      status:         'pending',
    })
    .select('id, review_token')
    .single();

  if (error) {
    console.error('[applications/submit] insert error:', error.message);
    return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });
  }

  const reviewToken: string = data.review_token;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://unniepick.com';
  const statusUrl = `${siteUrl}/apply/status/${reviewToken}`;

  // ── SMS 발송 (SOLAPI 설정된 경우만) ────────────────────────────
  try {
    await sendSms({
      to:   body.owner_phone!.trim(),
      text: `[언니픽] ${body.store_name} 가게 등록 신청이 완료됐어요!\n영업일 1~2일 내 심사 후 안내드릴게요.\n\n신청 내역 확인:\n${statusUrl}`,
    });
  } catch (smsErr) {
    // SMS 실패해도 신청은 완료 처리
    console.warn('[applications/submit] SMS 발송 실패 (무시):', (smsErr as Error).message);
  }

  return NextResponse.json({ ok: true, id: data.id, review_token: reviewToken });
}
