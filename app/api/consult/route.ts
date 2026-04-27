import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const { data, error } = await supabase
      .from('consult_inquiries')
      .insert({
        owner_name: owner_name.trim(),
        phone: phone.replace(/\D/g, ''),
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

    // 시스템 메시지 삽입
    const agencyNote = has_agency
      ? ` · 광고 대행사 이용 중${agency_name ? ` (${agency_name})` : ''}`
      : '';
    await supabase.from('consult_messages').insert({
      inquiry_id: data.id,
      sender_type: 'system',
      content: `새 상담 신청\n업체: ${business_name.trim()} / ${area || '상권 미입력'}${agencyNote}\n연락처: ${phone}`,
    });

    return NextResponse.json({ token: data.token });
  } catch (e) {
    console.error('[consult POST]', e);
    return NextResponse.json({ error: '상담 신청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
