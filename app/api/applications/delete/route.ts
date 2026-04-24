/**
 * DELETE /api/applications/delete
 *
 * 가게 등록 신청 삭제 (service_role — RLS 우회)
 * Body: { id: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id?: string };

  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
  }

  const sb = adminClient();

  const { error } = await sb
    .from('store_applications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[applications/delete] error:', error.message);
    return NextResponse.json({ error: `삭제 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
