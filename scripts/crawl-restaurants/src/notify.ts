import type { RestaurantData } from './storage.js';

const BOT_TOKEN = '8491699194:AAG6gXOiK09eYm7gcvE7y7nj9TP3zcSKPg0';
const CHAT_ID = '914082906';

export async function notifyNewRestaurants(restaurants: RestaurantData[], keyword?: string) {
  if (!restaurants.length) return;

  // 헤더 — 키워드가 주어지면 그대로, 없으면 일반 문구
  const title = keyword ? escapeMarkdown(keyword) : '신규 업체';
  let text = `🆕 *${title} ${restaurants.length}개 발견\\!*\n\n`;

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

interface ClosureReport {
  okCount: number;
  newlyClosed: Array<{ name: string; reason: string; placeId: string }>;
  newlySuspected: Array<{ name: string; count: number }>;
  recovered: string[];
  errorCount: number;
  total: number;
}

export async function notifyClosureReport(report: ClosureReport) {
  const now = new Date().toLocaleString('ko-KR');

  // 변화 없으면 발송 스킵 (너무 잦은 알림 방지)
  if (report.newlyClosed.length === 0 && report.newlySuspected.length === 0 && report.recovered.length === 0) {
    console.log('[telegram] 변동 없음 — 알림 생략');
    return;
  }

  let text = `🧹 *폐업 검증 리포트* \\(${escapeMarkdown(now)}\\)\n\n`;
  text += `검증 ${report.total}개 \\| ✅ ${report.okCount} \\| ⚠️ ${report.errorCount}\n\n`;

  if (report.newlyClosed.length) {
    text += `🔴 *신규 폐업* ${report.newlyClosed.length}개\n`;
    for (const c of report.newlyClosed.slice(0, 10)) {
      text += `• ${escapeMarkdown(c.name)} \\- ${escapeMarkdown(c.reason)}\n`;
    }
    if (report.newlyClosed.length > 10) text += `\\.\\.\\. 외 ${report.newlyClosed.length - 10}개\n`;
    text += '\n';
  }

  if (report.newlySuspected.length) {
    text += `🟡 *신규 의심* ${report.newlySuspected.length}개 \\(확인 필요\\)\n`;
    for (const s of report.newlySuspected.slice(0, 5)) {
      text += `• ${escapeMarkdown(s.name)} \\(${s.count}회\\)\n`;
    }
    if (report.newlySuspected.length > 5) text += `\\.\\.\\. 외 ${report.newlySuspected.length - 5}개\n`;
    text += '\n';
  }

  if (report.recovered.length) {
    text += `♻️ *복구* ${report.recovered.length}개\n`;
    for (const n of report.recovered.slice(0, 5)) {
      text += `• ${escapeMarkdown(n)}\n`;
    }
  }

  await sendTelegram(text);
}

export async function notifyDailySummary(total: number, newCount: number, keywords?: string[]) {
  const now = new Date().toLocaleString('ko-KR');
  const kwLabel = keywords && keywords.length
    ? `\n키워드: ${keywords.map(escapeMarkdown).join(', ')}`
    : '';
  const text = newCount > 0
    ? `✅ *크롤링 완료* \\(${escapeMarkdown(now)}\\)\n총 ${total}개 수집, 🆕 신규 ${newCount}개${kwLabel}`
    : `✅ *크롤링 완료* \\(${escapeMarkdown(now)}\\)\n총 ${total}개 수집, 신규 업체 없음${kwLabel}`;

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
