import { NextResponse } from 'next/server';

// 인메모리 인증번호 저장 (서버리스 환경에서는 Supabase DB 테이블 권장)
const store = new Map<string, { code: string; expires: number; attempts: number }>();

// 5분 만료, 최대 5회 시도
const EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const { action, email, code } = await request.json();

  if (!email || !email.endsWith('@naver.com')) {
    return NextResponse.json({ error: '네이버 이메일(@naver.com)만 가능합니다' }, { status: 400 });
  }

  // ── 인증번호 발송 ──
  if (action === 'send') {
    // 쿨다운: 이미 유효한 코드가 있고 60초 이내면 재발송 차단
    const existing = store.get(email);
    if (existing && existing.expires - EXPIRY_MS + 60_000 > Date.now()) {
      return NextResponse.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 });
    }

    const pin = String(Math.floor(10 + Math.random() * 90));
    store.set(email, { code: pin, expires: Date.now() + EXPIRY_MS, attempts: 0 });

    // ── 이메일 발송 ──
    // TODO: 프로덕션에서 Resend/Nodemailer/SES 연동
    // 개발 중에는 서버 콘솔에서 확인
    console.log(`\n━━━ 인증번호 ━━━`);
    console.log(`📧 ${email}`);
    console.log(`🔑 ${pin}`);
    console.log(`━━━━━━━━━━━━━━━\n`);

    return NextResponse.json({ ok: true });
  }

  // ── 인증번호 검증 ──
  if (action === 'verify') {
    if (!code) {
      return NextResponse.json({ error: '인증번호를 입력하세요' }, { status: 400 });
    }

    const entry = store.get(email);
    if (!entry) {
      return NextResponse.json({ error: '인증번호를 먼저 요청하세요' }, { status: 400 });
    }
    if (Date.now() > entry.expires) {
      store.delete(email);
      return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 요청하세요.' }, { status: 400 });
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      store.delete(email);
      return NextResponse.json({ error: '시도 횟수를 초과했습니다. 다시 요청하세요.' }, { status: 400 });
    }

    entry.attempts++;

    if (entry.code !== code) {
      return NextResponse.json({ error: '인증번호가 일치하지 않습니다' }, { status: 400 });
    }

    store.delete(email);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}
