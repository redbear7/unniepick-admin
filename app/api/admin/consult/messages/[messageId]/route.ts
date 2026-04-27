import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// DELETE /api/admin/consult/messages/[messageId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const supabase = adminClient();

  // 메시지 조회 (파일 URL 확인용)
  const { data: msg, error: fetchErr } = await supabase
    .from('consult_messages')
    .select('id, file_url')
    .eq('id', messageId)
    .single();

  if (fetchErr || !msg) {
    return NextResponse.json({ error: '메시지를 찾을 수 없습니다.' }, { status: 404 });
  }

  // Storage 파일 삭제 (있는 경우)
  if (msg.file_url) {
    try {
      const url = new URL(msg.file_url);
      // publicUrl 경로에서 버킷 이름 이후 경로 추출
      // 예: /storage/v1/object/public/consult-files/consult/token/xxx.jpg
      const match = url.pathname.match(/\/object\/public\/consult-files\/(.+)$/);
      if (match?.[1]) {
        await supabase.storage.from('consult-files').remove([match[1]]);
      }
    } catch {
      // 파일 삭제 실패해도 메시지 삭제는 진행
    }
  }

  const { error: delErr } = await supabase
    .from('consult_messages')
    .delete()
    .eq('id', messageId);

  if (delErr) {
    return NextResponse.json({ error: '삭제 실패: ' + delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
