import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '허용되지 않는 파일 형식입니다.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 });
  }

  const supabase = adminClient();

  // 토큰 유효성 확인
  const { data: inquiry } = await supabase
    .from('consult_inquiries')
    .select('id')
    .eq('token', token)
    .single();
  if (!inquiry) return NextResponse.json({ error: '존재하지 않는 상담입니다.' }, { status: 404 });

  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `consult/${token}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('consult-files')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (upErr) {
    console.error('[consult upload]', upErr);
    return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('consult-files')
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, file_type: file.type.startsWith('image/') ? 'image' : 'file', file_name: file.name });
}
