/**
 * POST /api/consult/[token]/auto-reply
 * 빠른 질문 칩 클릭 후 자동 관리자 답변 삽입
 * 클라이언트에서 2초 delay 후 호출
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = adminClient();

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: '내용이 없습니다.' }, { status: 400 });
  }

  const { data: inquiry, error: inquiryError } = await supabase
    .from('consult_inquiries')
    .select('id')
    .eq('token', token)
    .single();

  if (inquiryError || !inquiry) {
    return NextResponse.json({ error: '존재하지 않는 상담입니다.' }, { status: 404 });
  }

  const { data: msg, error: msgError } = await supabase
    .from('consult_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_type: 'admin',
      content: content.trim(),
    })
    .select()
    .single();

  if (msgError) {
    return NextResponse.json({ error: '자동 답변 전송 실패: ' + msgError.message }, { status: 500 });
  }

  return NextResponse.json({ message: msg });
}
