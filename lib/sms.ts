/**
 * lib/sms.ts — SOLAPI SMS 발송 유틸
 *
 * 환경변수:
 *   SOLAPI_API_KEY     — 솔라피 API 키
 *   SOLAPI_API_SECRET  — 솔라피 API 시크릿
 *   SOLAPI_SENDER      — 발신번호 (사전 등록 필요)
 *
 * SOLAPI_API_KEY 가 없으면 발송 없이 조용히 스킵 (개발환경 친화)
 */

interface SendSmsOptions {
  to:   string; // 수신번호 (010-xxxx-xxxx or 01012345678)
  text: string; // 메시지 내용 (90바이트 초과 시 LMS 자동 전환)
}

export async function sendSms({ to, text }: SendSmsOptions): Promise<void> {
  const apiKey    = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from      = process.env.SOLAPI_SENDER;

  // 환경변수 미설정 시 스킵
  if (!apiKey || !apiSecret || !from) {
    console.log('[sms] SOLAPI 미설정 — 발송 스킵:', to, text.slice(0, 30) + '...');
    return;
  }

  // 동적 import — 빌드타임 번들 최소화
  const { SolapiMessageService } = await import('solapi');
  const service = new SolapiMessageService(apiKey, apiSecret);

  const toClean = to.replace(/\D/g, ''); // 숫자만

  // solapi v6+ : send(message) — 단건도 배열 대신 객체로 가능
  await (service as unknown as {
    send: (msg: { to: string; from: string; text: string }) => Promise<unknown>
  }).send({ to: toClean, from, text });
}
