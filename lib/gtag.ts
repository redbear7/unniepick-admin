export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function event(action: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, params);
  }
}

export function trackPlanClick(planName: string) {
  event('plan_click', { plan_name: planName });
}

export function trackCarrierSelect(carrier: string) {
  event('carrier_select', { carrier });
}

export function trackConsultationComplete(carrier: string) {
  event('consultation_complete', { carrier });
}
