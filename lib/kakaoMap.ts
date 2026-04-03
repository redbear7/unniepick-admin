const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? '';

let loadPromise: Promise<void> | null = null;

export function loadKakaoSDK(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const win = window as any;

    // 이미 로드 완료
    if (win.kakao?.maps?.Map) { resolve(); return; }

    // 스크립트 삽입 (autoload=false 없이 — 자동 로드)
    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (!existing) {
      const s     = document.createElement('script');
      s.src       = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=clusterer`;
      s.onerror   = () => {
        loadPromise = null;
        reject(new Error('카카오맵 SDK 로드 실패 (네트워크 오류)'));
      };
      document.head.appendChild(s);
    }

    // 준비될 때까지 폴링 (최대 15초)
    const start   = Date.now();
    const timer   = setInterval(() => {
      if (win.kakao?.maps?.Map) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > 15_000) {
        clearInterval(timer);
        loadPromise = null;
        reject(new Error(
          '카카오맵 로드 타임아웃\n' +
          '카카오 개발자 콘솔에서 Web 플랫폼 도메인(http://localhost:3000)을 등록했는지 확인해주세요'
        ));
      }
    }, 200);
  });

  return loadPromise;
}
