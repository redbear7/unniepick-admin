import type { RestaurantData } from './storage.js';

const BOT_TOKEN = '8491699194:AAG6gXOiK09eYm7gcvE7y7nj9TP3zcSKPg0';
const CHAT_ID = '914082906';

export async function notifyNewRestaurants(restaurants: RestaurantData[]) {
  if (!restaurants.length) return;

  // 헤더
  let text = `🆕 *창원 새로오픈 맛집 ${restaurants.length}개 발견\\!*\n\n`;

  for (const r of restaurants.slice(0, 10)) {
    const name = escapeMarkdown(r.name);
    const cat = escapeMarkdown(r.category ?? '기타');
    const reviews = r.visitor_review_count ?? 0;
    const addr = escapeMarkdown(r.address ?? '');

    text += `📍 *${name}* \\(${cat}\\)\n`;
    text += `   리뷰 ${reviews}건`;

    if (r.review_keywords?.length) {
      const kw = r.review_keywords.slice(0, 2)
        .map((k) => `"${escapeMarkdown(k.keyword)}" ${k.count}명`)
        .join(', ');
      text += ` \\| ${kw}`;
    }

    text += `\n   ${addr}\n`;

    if (r.naver_place_url) {
      text += `   [네이버 지도](${r.naver_place_url})\n`;
    }
    text += `\n`;
  }

  if (restaurants.length > 10) {
    text += `\\.\\.\\. 외 ${restaurants.length - 10}개`;
  }

  await sendTelegram(text);
}

export async function notifyDailySummary(total: number, newCount: number) {
  const now = new Date().toLocaleString('ko-KR');
  const text = newCount > 0
    ? `✅ *크롤링 완료* \\(${escapeMarkdown(now)}\\)\n총 ${total}개 수집, 🆕 신규 ${newCount}개`
    : `✅ *크롤링 완료* \\(${escapeMarkdown(now)}\\)\n총 ${total}개 수집, 신규 업체 없음`;

  await sendTelegram(text);
}

async function sendTelegram(text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.log('[telegram] 전송 실패:', data.description);
      // MarkdownV2 실패 시 plain text로 재시도
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: text.replace(/\\([!.*_~`>#+\-=|{}()[\]])/g, '$1'),
          disable_web_page_preview: true,
        }),
      });
    }
  } catch (e) {
    console.log('[telegram] 에러:', (e as Error).message);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
