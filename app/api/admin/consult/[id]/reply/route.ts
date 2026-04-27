import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/admin/consult/[id]/reply — 어드민 답장
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = adminClient();

  const body = await req.json();
  const { content, file_url, file_type, file_name } = body;

  if (!content?.trim() && !file_url) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('consult_messages')
    .insert({
      inquiry_id: id,
      sender_type: 'admin',
      content: content?.trim() || null,
      file_url: file_url || null,
      file_type: file_type || null,
      file_name: file_name || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: '답장 전송에 실패했습니다.' }, { status: 500 });
  }

  await supabase
    .from('consult_inquiries')
    .update({ last_message_at: new Date().toISOString(), unread_count: 0 })
    .eq('id', id);

  return NextResponse.json({ message: data });
}
