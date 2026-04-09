/* ──────────────────────────────────────────────────────────────
 *  Google Analytics 4 (gtag.js) 유틸리티
 *  환경변수: NEXT_PUBLIC_GA_ID  (예: G-XXXXXXXXXX)
 * ────────────────────────────────────────────────────────────── */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';

/** 페이지뷰 전송 */
export function pageview(url: string) {
  if (!GA_ID || typeof window === 'undefined') return;
  window.gtag('config', GA_ID, { page_path: url });
}

/** 커스텀 이벤트 전송 */
export function event(
  action: string,
  params?: Record<string, string | number | boolean>,
) {
  if (!GA_ID || typeof window === 'undefined') return;
  window.gtag('event', action, params);
}

/* ── 도메인별 이벤트 헬퍼 ── */

/** 통신사(상담 유형) 선택 */
export function trackCarrierSelect(consultationType: string) {
  event('carrier_select', { consultation_type: consultationType });
}

/** 요금제 클릭 */
export function trackPlanClick(planName: string) {
  event('plan_click', { plan_name: planName });
}

/** 상담 신청 완료 */
export function trackConsultationComplete(consultationType: string) {
  event('consultation_complete', { consultation_type: consultationType });
}

/* ── TypeScript 타입 보강 ── */
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      target: string | Date,
      params?: Record<string, unknown>,
    ) => void;
    dataLayer: unknown[];
  }
}
