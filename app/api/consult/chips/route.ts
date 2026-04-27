import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const { data } = await adminClient()
    .from('consult_chips')
    .select('id, label, message')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ chips: data ?? [] });
}
