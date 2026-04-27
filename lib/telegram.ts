const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8491699194:AAG6gXOiK09eYm7gcvE7y7nj9TP3zcSKPg0';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '914082906';

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export interface SendResult {
  message_id: number;
  ok: boolean;
}

// 메시지 전송 (인라인 버튼 포함 가능)
export async function sendMessage(
  text: string,
  options: {
    reply_to_message_id?: number;
    inline_keyboard?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
    parse_mode?: 'HTML' | 'MarkdownV2';
  } = {}
): Promise<SendResult> {
  const body: Record<string, unknown> = {
    chat_id: CHAT_ID,
    text,
    disable_web_page_preview: true,
  };

  if (options.parse_mode) body.parse_mode = options.parse_mode;
  if (options.reply_to_message_id) body.reply_to_message_id = options.reply_to_message_id;
  if (options.inline_keyboard) {
    body.reply_markup = { inline_keyboard: options.inline_keyboard };
  }

  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('[telegram] 전송 실패:', data.description);
      // HTML 파싱 실패 시 plain text 재시도
      if (options.parse_mode) {
        return sendMessage(text.replace(/<[^>]*>/g, ''), { ...options, parse_mode: undefined });
      }
    }
    return { message_id: data.result?.message_id ?? 0, ok: data.ok };
  } catch (e) {
    console.error('[telegram] 에러:', (e as Error).message);
    return { message_id: 0, ok: false };
  }
}

// 신규 상담 신청 알림
export async function notifyNewConsult(params: {
  businessName: string;
  ownerName: string;
  phone: string;
  area: string | null;
  hasAgency: boolean;
  agencyName: string | null;
  memo: string | null;
  chatUrl: string;
  adminUrl: string;
}): Promise<number> {
  const agencyLine = params.hasAgency
    ? `\n🏢 대행사: ${params.agencyName || '있음'}`
    : '';
  const memoLine = params.memo ? `\n💬 메모: ${params.memo}` : '';

  const text =
    `🔔 <b>새 상담 신청</b>\n\n` +
    `🏪 <b>${params.businessName}</b>\n` +
    `👤 ${params.ownerName}` +
    (params.area ? ` · ${params.area}` : '') +
    `\n📞 ${params.phone}` +
    agencyLine +
    memoLine;

  const result = await sendMessage(text, {
    parse_mode: 'HTML',
    inline_keyboard: [[
      { text: '💬 채팅 답장하기', url: params.adminUrl },
      { text: '🔗 업체 채팅링크 복사용', url: params.chatUrl },
    ]],
  });

  return result.message_id;
}

// 업체가 메시지 보낼 때 어드민에게 포워드
export async function forwardBusinessMessage(params: {
  businessName: string;
  content: string | null;
  fileType: string | null;
  fileName: string | null;
  replyToMessageId?: number;
  adminUrl: string;
}): Promise<void> {
  const fileNote = params.fileType === 'image'
    ? '📷 이미지 전송'
    : params.fileType === 'file'
    ? `📎 파일: ${params.fileName}`
    : '';

  const body = params.content || fileNote;
  if (!body) return;

  const text = `💬 <b>${params.businessName}</b>\n${body}`;

  await sendMessage(text, {
    parse_mode: 'HTML',
    reply_to_message_id: params.replyToMessageId,
    inline_keyboard: [[
      { text: '답장하기 →', url: params.adminUrl },
    ]],
  });
}

// 웹훅 등록 (배포 후 1회 실행)
export async function setWebhook(webhookUrl: string): Promise<boolean> {
  const res = await fetch(`${API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });
  const data = await res.json();
  console.log('[telegram] setWebhook:', data);
  return data.ok;
}

export { CHAT_ID, BOT_TOKEN };
