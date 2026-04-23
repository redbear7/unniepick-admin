// NEXT_PUBLIC_KAKAO_JS_KEY: 카카오 개발자 콘솔 > 내 애플리케이션 > 앱 키 > JavaScript 키
const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '';

let loadPromise: Promise<void> | null = null;

export function loadKakaoSDK(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const win = window as any;

    // 이미 완전 초기화
    if (win.kakao?.maps?.Map) { resolve(); return; }

    const init = () => win.kakao.maps.load(() => resolve());

    // 스크립트는 삽입됐지만 아직 초기화 전
    if (win.kakao?.maps) { init(); return; }

    // 최초 삽입
    if (!document.querySelector('script[src*="dapi.kakao.com/v2/maps"]')) {
      const s   = document.createElement('script');
      s.src     = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false&libraries=clusterer`;
      s.async   = true;
      s.onload  = init;
      s.onerror = () => {
        loadPromise = null;
        reject(new Error('카카오맵 SDK 로드 실패 — NEXT_PUBLIC_KAKAO_JS_KEY와 Web 플랫폼 등록을 확인하세요'));
      };
      document.head.appendChild(s);
    } else {
      // 이미 스크립트 태그가 있으면 로드 완료 대기
      const t = Date.now();
      const poll = setInterval(() => {
        if (win.kakao?.maps) { clearInterval(poll); init(); }
        else if (Date.now() - t > 10_000) { clearInterval(poll); loadPromise = null; reject(new Error('카카오맵 로드 타임아웃')); }
      }, 100);
    }
  });

  return loadPromise;
}
