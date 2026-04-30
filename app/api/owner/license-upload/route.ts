import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const phone = String(formData.get('phone') ?? 'unknown').replace(/\D/g, '') || 'unknown';

  if (!file) return NextResponse.json({ error: '사업자등록증 파일이 필요합니다.' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '이미지 또는 PDF 파일만 업로드할 수 있습니다.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일은 10MB 이하여야 합니다.' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `licenses/${phone}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const sb = adminClient();

  const { error } = await sb.storage
    .from('owner-verifications')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    path,
    file_name: file.name,
    file_type: file.type,
  });
}
