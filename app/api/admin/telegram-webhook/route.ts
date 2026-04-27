/**
 * POST /api/admin/telegram-webhook
 * 텔레그램 웹훅 등록 (관리자 전용)
 * body: { url?: string }  — 없으면 NEXT_PUBLIC_SITE_URL 사용
 */
import { NextRequest, NextResponse } from 'next/server';
import { BOT_TOKEN } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* 빈 body 허용 */ }

  const siteUrl = body.url?.trim()
    || process.env.NEXT_PUBLIC_SITE_URL
    || req.headers.get('origin')
    || '';

  if (!siteUrl) {
    return NextResponse.json({ error: 'URL을 입력하거나 NEXT_PUBLIC_SITE_URL을 설정해주세요.' }, { status: 400 });
  }

  const webhookUrl = siteUrl.replace(/\/$/, '') + '/api/telegram/webhook';

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    return NextResponse.json(
      { error: `텔레그램 오류: ${data.description ?? '알 수 없는 오류'}`, webhookUrl },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, webhookUrl });
}
