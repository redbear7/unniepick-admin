/**
 * POST /api/admin/telegram-webhook
 * 텔레그램 웹훅 등록 (관리자 전용)
 */
import { NextRequest, NextResponse } from 'next/server';
import { setWebhook } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    || req.headers.get('origin')
    || '';

  if (!siteUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL 환경변수가 없습니다' }, { status: 500 });
  }

  const webhookUrl = `${siteUrl}/api/telegram/webhook`;
  const ok = await setWebhook(webhookUrl);

  if (!ok) {
    return NextResponse.json({ error: '웹훅 등록 실패 — 봇 토큰을 확인하세요' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, webhookUrl });
}
