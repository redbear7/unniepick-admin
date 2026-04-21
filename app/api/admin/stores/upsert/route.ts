/**
 * POST /api/admin/stores/upsert
 * restaurants → stores 변환 등록/수정 — service role로 RLS 우회
 * onConflict: naver_place_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function POST(req: NextRequest) {
  try {
    const fields = await req.json().catch(() => ({})) as Record<string, unknown>;

    const { error } = await adminSb()
      .from('stores')
      .upsert(fields, { onConflict: 'naver_place_id', ignoreDuplicates: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
