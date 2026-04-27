import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyNewConsult } from '@/lib/telegram';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/consult — 상담 신청 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { owner_name, phone, business_name, area, has_agency, agency_name, memo } = body;

    if (!owner_name?.trim() || !phone?.trim() || !business_name?.trim()) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    const supabase = adminClient();
    const phoneClean = phone.replace(/\D/g, '');

    const { data, error } = await supabase
      .from('consult_inquiries')
      .insert({
        owner_name: owner_name.trim(),
        phone: phoneClean,
        business_name: business_name.trim(),
        area: area || null,
        has_agency: has_agency ?? false,
        agency_name: has_agency ? (agency_name?.trim() || null) : null,
        memo: memo?.trim() || null,
        status: 'pending',
      })
      .select('token, id')
      .single();

    if (error) throw error;

    // 시스템 메시지
    const agencyNote = has_agency
      ? ` · 광고 대행사 이용 중${agency_name ? ` (${agency_name})` : ''}`
      : '';
    await supabase.from('consult_messages').insert({
      inquiry_id: data.id,
      sender_type: 'system',
      content: `새 상담 신청\n업체: ${business_name.trim()} / ${area || '상권 미입력'}${agencyNote}\n연락처: ${phone}`,
    });

    // 텔레그램 알림 (비동기 — 실패해도 응답에 영향 없음)
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
    const chatUrl = `${origin}/consult/chat/${data.token}`;
    const adminUrl = `${origin}/dashboard/consultations?id=${data.id}`;

    notifyNewConsult({
      businessName: business_name.trim(),
      ownerName: owner_name.trim(),
      phone: phoneClean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3'),
      area: area || null,
      hasAgency: has_agency ?? false,
      agencyName: agency_name?.trim() || null,
      memo: memo?.trim() || null,
      chatUrl,
      adminUrl,
    }).then((messageId) => {
      // 텔레그램 메시지 ID 저장 (웹훅 reply 라우팅용)
      if (messageId) {
        supabase
          .from('consult_inquiries')
          .update({ telegram_message_id: messageId })
          .eq('id', data.id)
          .then();
      }
    });

    return NextResponse.json({ token: data.token });
  } catch (e) {
    console.error('[consult POST]', e);
    return NextResponse.json({ error: '상담 신청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
