declare global {
  interface Window {
    daum: {
      Postcode: new (config: {
        oncomplete: (data: { address: string; zonecode?: string; buildingName?: string }) => void;
        width?: string;
        height?: string;
      }) => { open: () => void; embed: (el: HTMLElement, opts?: { q?: string; autoClose?: boolean }) => void };
    };
  }
}

const KAKAO_REST_KEY = "30e31a6f08ec677dc19b020601ffcbb0";

export function openPostcode(onComplete: (addr: string) => void) {
  if (typeof window === "undefined" || !window.daum?.Postcode) {
    alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  const isMobile = window.innerWidth < 640;

  // 오버레이
  const overlay = document.createElement("div");
  overlay.style.cssText = isMobile
    ? "position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;justify-content:flex-end;"
    : "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;";

  const backdrop = document.createElement("div");
  backdrop.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.5);";
  backdrop.onclick = () => document.body.removeChild(overlay);
  overlay.appendChild(backdrop);

  const sheet = document.createElement("div");
  sheet.style.cssText = isMobile
    ? "position:relative;background:white;border-radius:20px 20px 0 0;max-height:80vh;overflow:hidden;animation:slideUp 0.3s ease-out;"
    : "position:relative;background:white;border-radius:16px;width:480px;max-height:80vh;overflow:hidden;animation:slideUp 0.3s ease-out;box-shadow:0 20px 60px rgba(0,0,0,0.15);";
  overlay.appendChild(sheet);

  // 핸들바 (모바일만)
  if (isMobile) {
    const handle = document.createElement("div");
    handle.style.cssText = "display:flex;justify-content:center;padding:12px 0 4px;";
    handle.innerHTML = '<div style="width:40px;height:4px;background:#ddd;border-radius:2px;"></div>';
    sheet.appendChild(handle);
  }

  // 헤더
  const header = document.createElement("div");
  header.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 20px 12px;";
  header.innerHTML = '<span style="font-size:18px;font-weight:700;">주소 검색</span>';
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = "font-size:20px;background:none;border:none;cursor:pointer;padding:4px 8px;color:#888;";
  closeBtn.onclick = () => document.body.removeChild(overlay);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  // 현재 위치로 설정하기 버튼
  const locBtn = document.createElement("button");
  locBtn.innerHTML = '📍 현재 위치로 설정하기';
  locBtn.style.cssText = "display:flex;align-items:center;justify-content:center;gap:6px;width:calc(100% - 40px);margin:0 20px 12px;padding:14px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:12px;font-size:15px;font-weight:600;color:#333;cursor:pointer;transition:background 0.2s;";
  locBtn.onmouseenter = () => locBtn.style.background = "#eee";
  locBtn.onmouseleave = () => locBtn.style.background = "#f5f5f5";
  locBtn.onclick = async () => {
    locBtn.innerHTML = '⏳ 위치 확인 중...';
    locBtn.style.pointerEvents = "none";
    locBtn.style.opacity = "0.6";

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = pos.coords;

      // 카카오 역지오코딩
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${longitude}&y=${latitude}`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
      );
      const data = await res.json();

      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        // 도로명에서 번지 제거 → 도로명까지만 (GPS 오차 감안)
        const roadAddr = doc.road_address?.address_name || "";
        const jibunAddr = doc.address?.address_name || "";

        // 도로명: "경남 창원시 의창구 동곡로 1" → "경남 창원시 의창구 동곡로" (번호 제거)
        // 지번: "경남 창원시 의창구 북면 무동리 147-2" → "경남 창원시 의창구 북면" (동/리까지)
        let searchKeyword = "";
        if (roadAddr) {
          // 마지막 숫자(번호) 부분 제거 → 도로명까지만
          searchKeyword = roadAddr.replace(/\s+\d[\d-]*$/, "");
        } else if (jibunAddr) {
          // 동/리 까지만 (번지 제거)
          searchKeyword = jibunAddr.replace(/\s+\d[\d-]*$/, "");
        }

        if (searchKeyword) {
          // 기존 embed 제거 → 도로명 키워드로 새 Postcode 재생성 (자동 검색)
          embedWrap.innerHTML = "";

          new window.daum.Postcode({
            oncomplete: (pdata) => {
              const full = pdata.buildingName
                ? `${pdata.address} (${pdata.buildingName})`
                : pdata.address;
              onComplete(full);
              if (overlay.parentNode) document.body.removeChild(overlay);
            },
            width: "100%",
            height: "100%",
          }).embed(embedWrap, { q: searchKeyword, autoClose: false });

          locBtn.innerHTML = '✅ ' + searchKeyword;
          locBtn.style.background = "#e8f5e9";
          locBtn.style.borderColor = "#4caf50";
          locBtn.style.color = "#2e7d32";
          locBtn.style.pointerEvents = "auto";
          locBtn.style.opacity = "1";
          return;
        }
      }
      alert("현재 위치의 주소를 찾을 수 없습니다. 직접 검색해 주세요.");
    } catch (err) {
      alert("위치 정보를 가져올 수 없습니다. 위치 권한을 허용해 주세요.");
    }

    locBtn.innerHTML = '📍 현재 위치로 설정하기';
    locBtn.style.pointerEvents = "auto";
    locBtn.style.opacity = "1";
  };
  sheet.appendChild(locBtn);

  // 우편번호 임베드 영역
  const embedWrap = document.createElement("div");
  embedWrap.style.cssText = "height:55vh;";
  sheet.appendChild(embedWrap);

  document.body.appendChild(overlay);

  // slideUp 애니메이션
  if (!document.getElementById("postcode-anim")) {
    const style = document.createElement("style");
    style.id = "postcode-anim";
    style.textContent = "@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}";
    document.head.appendChild(style);
  }

  new window.daum.Postcode({
    oncomplete: (data) => {
      const full = data.buildingName
        ? `${data.address} (${data.buildingName})`
        : data.address;
      onComplete(full);
      if (overlay.parentNode) document.body.removeChild(overlay);
    },
    width: "100%",
    height: "100%",
  }).embed(embedWrap);
}
