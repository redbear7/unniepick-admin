const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

let loadPromise: Promise<void> | null = null;

export function loadGoogleMapsSDK(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const win = window as any;

    if (win.google?.maps?.Map) { resolve(); return; }

    // 콜백 함수 등록
    const cbName = '__googleMapsReady__';
    win[cbName] = () => { resolve(); };

    const s   = document.createElement('script');
    s.src     = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&callback=${cbName}&libraries=marker`;
    s.async   = true;
    s.defer   = true;
    s.onerror = () => {
      loadPromise = null;
      reject(new Error('Google Maps SDK 로드 실패'));
    };
    document.head.appendChild(s);

    setTimeout(() => {
      if (!win.google?.maps?.Map) {
        loadPromise = null;
        reject(new Error('Google Maps 로드 타임아웃 (API 키 확인 또는 Maps JavaScript API 활성화 필요)'));
      }
    }, 15_000);
  });

  return loadPromise;
}
