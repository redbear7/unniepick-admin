import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { forwardBusinessMessage } from '@/lib/telegram';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/consult/[token]/messages — 메시지 목록 조회
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = adminClient();

  const { data: inquiry } = await supabase
    .from('consult_inquiries')
    .select('id')
    .eq('token', token)
    .single();

  if (!inquiry) return NextResponse.json({ error: '존재하지 않는 상담입니다.' }, { status: 404 });

  const { data: messages } = await supabase
    .from('consult_messages')
    .select('*')
    .eq('inquiry_id', inquiry.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ messages: messages ?? [] });
}

// POST /api/consult/[token]/messages — 메시지 전송 (업체 측)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = adminClient();

  const { data: inquiry, error: inquiryError } = await supabase
    .from('consult_inquiries')
    .select('id, unread_count, business_name, telegram_message_id')
    .eq('token', token)
    .single();

  if (inquiryError || !inquiry) {
    return NextResponse.json({ error: '존재하지 않는 상담입니다.' }, { status: 404 });
  }

  const body = await req.json();
  const { content, file_url, file_type, file_name } = body;

  if (!content?.trim() && !file_url) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
  }

  const { data: msg, error: msgError } = await supabase
    .from('consult_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_type: 'business',
      content: content?.trim() || null,
      file_url: file_url || null,
      file_type: file_type || null,
      file_name: file_name || null,
    })
    .select()
    .single();

  if (msgError) {
    console.error('[consult messages POST]', msgError);
    return NextResponse.json({ error: '메시지 전송에 실패했습니다.' }, { status: 500 });
  }

  await supabase
    .from('consult_inquiries')
    .update({
      unread_count: (inquiry.unread_count ?? 0) + 1,
      last_message_at: new Date().toISOString(),
      status: 'chatting',
    })
    .eq('id', inquiry.id);

  // 텔레그램 포워드 (비동기)
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
  forwardBusinessMessage({
    businessName: inquiry.business_name,
    content: content?.trim() || null,
    fileType: file_type || null,
    fileName: file_name || null,
    replyToMessageId: inquiry.telegram_message_id ?? undefined,
    adminUrl: `${origin}/dashboard/consultations?id=${inquiry.id}`,
  });

  return NextResponse.json({ message: msg });
}
