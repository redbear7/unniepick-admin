import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BOT_TOKEN, CHAT_ID } from '@/lib/telegram';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  from?: { first_name?: string };
  text?: string;
  reply_to_message?: { message_id: number };
  photo?: Array<{ file_id: string; width: number; height: number }>;
  document?: { file_id: string; file_name?: string; mime_type?: string };
  caption?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// POST /api/telegram/webhook — 텔레그램 웹훅 수신
export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();
    const msg = update.message;

    // 메시지가 없거나 봇 자신의 채팅이 아니면 무시
    if (!msg || String(msg.chat.id) !== String(CHAT_ID)) {
      return NextResponse.json({ ok: true });
    }

    // reply_to_message가 없으면 일반 메시지 — 라우팅 불가
    if (!msg.reply_to_message) {
      return NextResponse.json({ ok: true });
    }

    const replyToId = msg.reply_to_message.message_id;
    const supabase = adminClient();

    // 어떤 상담의 메시지에 답장했는지 찾기
    const { data: inquiry } = await supabase
      .from('consult_inquiries')
      .select('id, business_name')
      .eq('telegram_message_id', replyToId)
      .single();

    if (!inquiry) {
      // 혹시 forwarded message의 ID일 수 있으므로 무시 (업그레이드 여지)
      return NextResponse.json({ ok: true });
    }

    // 파일 처리 (사진)
    let fileUrl: string | null = null;
    let fileType: string | null = null;
    let fileName: string | null = null;

    if (msg.photo?.length) {
      const photo = msg.photo[msg.photo.length - 1]; // 가장 큰 사이즈
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photo.file_id}`);
      const fileData = await fileRes.json();
      if (fileData.ok) {
        fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
        fileType = 'image';
        fileName = 'photo.jpg';
      }
    } else if (msg.document) {
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${msg.document.file_id}`);
      const fileData = await fileRes.json();
      if (fileData.ok) {
        fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
        fileType = 'file';
        fileName = msg.document.file_name || 'document';
      }
    }

    const content = msg.text || msg.caption || null;
    if (!content && !fileUrl) return NextResponse.json({ ok: true });

    // 어드민 메시지로 저장
    await supabase.from('consult_messages').insert({
      inquiry_id: inquiry.id,
      sender_type: 'admin',
      content,
      file_url: fileUrl,
      file_type: fileType,
      file_name: fileName,
    });

    // 상담방 업데이트
    await supabase
      .from('consult_inquiries')
      .update({ last_message_at: new Date().toISOString(), unread_count: 0 })
      .eq('id', inquiry.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[telegram webhook]', e);
    return NextResponse.json({ ok: true }); // 텔레그램에는 항상 200 반환
  }
}

// GET /api/telegram/webhook/setup — 웹훅 등록 (배포 후 1회 실행)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  // 간단한 비밀키 검증
  if (secret !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || '';
  const webhookUrl = `${origin}/api/telegram/webhook`;

  const { setWebhook } = await import('@/lib/telegram');
  const ok = await setWebhook(webhookUrl);

  return NextResponse.json({ ok, webhookUrl });
}
