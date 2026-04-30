import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')?.trim();
  if (!path) return NextResponse.json({ error: 'path가 필요합니다.' }, { status: 400 });
  if (!path.startsWith('licenses/')) {
    return NextResponse.json({ error: '허용되지 않은 파일 경로입니다.' }, { status: 400 });
  }

  const { data, error } = await adminClient()
    .storage
    .from('owner-verifications')
    .createSignedUrl(path, 60 * 5);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? '파일 URL 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
