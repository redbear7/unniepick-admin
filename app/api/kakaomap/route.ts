import { NextResponse } from 'next/server';

/**
 * GET /api/kakaomap
 * 카카오맵 WebView HTML 반환
 * Expo React Native WebView가 source={{ uri }} 로 이 URL을 로드함
 * → window.location.href가 실제 URL이 되어 Kakao JS SDK 도메인 인증 통과
 */
export async function GET(request: Request) {
  // NEXT_PUBLIC_KAKAO_JS_KEY: Vercel 환경변수에 없을 경우 폴백 (JS 키는 공개키)
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '1e8def4aebde26a40dbdfe38bf42db24';

  // 썸네일 모드: ?lat=&lng=&level= 로 초기 중심·레벨 지정
  const u        = new URL(request.url);
  const rawLat   = parseFloat(u.searchParams.get('lat')   ?? '');
  const rawLng   = parseFloat(u.searchParams.get('lng')   ?? '');
  const rawLevel = parseInt  (u.searchParams.get('level') ?? '');
  const initLat   = isFinite(rawLat)   ? rawLat   : 35.2340;
  const initLng   = isFinite(rawLng)   ? rawLng   : 128.6668;
  const initLevel = isFinite(rawLevel) ? rawLevel : 5;
  // lat/lng 가 명시적으로 전달된 경우(썸네일 모드)에만 핀 표시
  const showPin   = u.searchParams.has('lat') && u.searchParams.has('lng');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100vh; overflow:hidden; }
    #err-banner {
      display:none; position:fixed; top:0; left:0; right:0;
      background:#E53935; color:#fff; font-size:12px;
      padding:6px 12px; text-align:center; z-index:9999;
    }
    .dist-chip {
      display:flex; align-items:center; gap:4px;
      background:#FF6F0F; color:#fff;
      border-radius:20px; border:2px solid #fff;
      padding:5px 10px; cursor:pointer;
      font-size:12px; font-weight:800;
      box-shadow:0 2px 6px rgba(0,0,0,0.2);
    }
    .dist-tail {
      width:0; height:0;
      border-left:6px solid transparent; border-right:6px solid transparent;
      border-top:8px solid #FF6F0F; margin:-1px auto 0;
    }
    .my-loc {
      width:18px; height:18px; border-radius:50%;
      background:rgba(66,133,244,0.9);
      border:2px solid #fff;
      box-shadow:0 0 0 6px rgba(66,133,244,0.2);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="err-banner"></div>

  <script>
    var map = null;
    var myLocOverlay = null;
    var storeOverlays = {};
    var distOverlays  = [];
    var selectedId    = null;
    var C = { brand:'#FF6F0F', red:'#E53935', gray:'#ADB5BD' };

    function send(data) {
      if (window.ReactNativeWebView)
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
    function esc(s) {
      return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function showErr(msg) {
      var b = document.getElementById('err-banner');
      b.textContent = msg; b.style.display = 'block';
      send({ type:'MAP_ERROR', message: msg });
    }

    window.moveMap = function(lat, lng, level) {
      if (!map) return;
      map.setCenter(new kakao.maps.LatLng(lat, lng));
      if (level) map.setLevel(level);
    };
    window.panMap = function(lat, lng, level) {
      if (!map) return;
      map.panTo(new kakao.maps.LatLng(lat, lng));
      if (level) setTimeout(function(){ map.setLevel(level); }, 350);
    };
    window.setMyLocation = function(lat, lng) {
      if (!map) return;
      var pos = new kakao.maps.LatLng(lat, lng);
      if (!myLocOverlay) {
        myLocOverlay = new kakao.maps.CustomOverlay({
          position: pos, content: '<div class="my-loc"></div>',
          yAnchor: 0.5, zIndex: 3
        });
        myLocOverlay.setMap(map);
      } else {
        myLocOverlay.setPosition(pos);
      }
    };
    window.setDistricts = function(arr) {
      if (!map) return;
      distOverlays.forEach(function(o){ o.setMap(null); });
      distOverlays = [];
      if (!arr || !arr.length) return;
      arr.forEach(function(d) {
        if (!d.latitude || !d.longitude) return;
        var content =
          '<div onclick="onDist(\\'' + esc(d.id) + '\\')" ' +
          'style="display:flex;flex-direction:column;align-items:center;">' +
          '<div class="dist-chip">🗺 ' + esc(d.name) + '</div>' +
          '<div class="dist-tail"></div></div>';
        var ov = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(d.latitude, d.longitude),
          content: content, yAnchor: 1, zIndex: 2
        });
        ov.setMap(map);
        distOverlays.push(ov);
      });
    };

    function _setStoresImpl(arr, selId) {
      if (!map) return;
      if (selId !== undefined) selectedId = selId;
      Object.keys(storeOverlays).forEach(function(k){ storeOverlays[k].setMap(null); });
      storeOverlays = {};
      if (!arr || !arr.length) return;
      arr.forEach(function(s){ renderStore(s); });
    }
    window.setStores = function(arr, selId) {
      window.__stores = arr;
      _setStoresImpl(arr, selId);
    };
    window.setSelectedStore = function(id) {
      selectedId = id;
      Object.keys(storeOverlays).forEach(function(k){ storeOverlays[k].setMap(null); });
      storeOverlays = {};
      if (window.__stores) _setStoresImpl(window.__stores, id);
    };

    function renderStore(s) {
      var color     = s.has_timesale ? C.red : (s.coupon_count > 0 ? C.brand : C.gray);
      var isSel     = selectedId === s.id;
      var chipBg    = isSel ? color : '#fff';
      var textColor = isSel ? '#fff' : (s.coupon_count > 0 || s.has_timesale ? color : '#4E5968');
      var fw        = isSel ? '900' : '700';
      var scale     = isSel ? 'transform:scale(1.08);' : '';
      var shadow    = isSel ? '0 3px 10px rgba(0,0,0,0.28)' : '0 2px 6px rgba(0,0,0,0.18)';
      var zIndex    = isSel ? 10 : 5;
      var content =
        '<div onclick="onStore(\\'' + esc(s.id) + '\\')" ' +
        'style="display:flex;flex-direction:column;align-items:center;">' +
        '<div style="display:flex;align-items:center;gap:4px;background:' + chipBg +
          ';border-radius:20px;border:2px solid ' + color +
          ';padding:5px 10px;box-shadow:' + shadow +
          ';max-width:130px;font-family:-apple-system,sans-serif;' + scale + '">' +
        '<span style="font-size:14px;">' + esc(s.emoji) + '</span>' +
        '<span style="font-size:12px;font-weight:' + fw + ';color:' + textColor +
          ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">' +
          esc(s.label) + '</span>' +
        '</div>' +
        '<div style="width:0;height:0;border-left:5px solid transparent;' +
          'border-right:5px solid transparent;border-top:7px solid ' +
          color + ';margin-top:-1px;"></div>' +
        '</div>';
      var ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(s.latitude, s.longitude),
        content: content, yAnchor: 1, zIndex: zIndex
      });
      ov.setMap(map);
      storeOverlays[s.id] = ov;
    }

    function onStore(id) { send({ type:'MARKER_PRESS', storeId: id }); }
    function onDist(id)  { send({ type:'DISTRICT_PRESS', id: id }); }

    function doInitMap() {
      try {
        var container = document.getElementById('map');
        map = new kakao.maps.Map(container, {
          center: new kakao.maps.LatLng(${initLat}, ${initLng}),
          level: ${initLevel}
        });
        ${showPin ? `new kakao.maps.Marker({
          position: new kakao.maps.LatLng(${initLat}, ${initLng}),
          map: map
        });` : ''}
        kakao.maps.event.addListener(map, 'idle', function() {
          var c = map.getCenter(), b = map.getBounds();
          var sw = b.getSouthWest(), ne = b.getNorthEast();
          send({ type:'REGION_CHANGE', lat:c.getLat(), lng:c.getLng(),
            latitudeDelta: ne.getLat()-sw.getLat(),
            longitudeDelta: ne.getLng()-sw.getLng() });
        });
        kakao.maps.event.addListener(map, 'click', function() {
          send({ type:'MAP_PRESS' });
        });
        send({ type:'MAP_READY' });
      } catch(e) {
        showErr('지도 초기화 실패: ' + e.message);
      }
    }

    function initKakaoMap() {
      var loc = window.location.href;
      send({ type:'DEBUG', step:'SDK_ONLOAD', loc: loc });

      var inited = false;

      /* 1차: kakao.maps.load() 콜백 */
      kakao.maps.load(function() {
        var ok = typeof kakao.maps.LatLng !== 'undefined';
        send({ type:'DEBUG', step:'MAPS_CB', ok: ok });
        if (ok && !inited) { inited = true; doInitMap(); }
      });

      /* 2차: 폴링 폴백 — 콜백이 오지 않거나 LatLng 미정의일 때 */
      var n = 0;
      var t = setInterval(function() {
        n++;
        if (typeof kakao !== 'undefined' && kakao.maps && typeof kakao.maps.LatLng === 'function') {
          clearInterval(t);
          send({ type:'DEBUG', step:'POLL_OK', n: n });
          if (!inited) { inited = true; doInitMap(); }
        } else if (n >= 100) {
          clearInterval(t);
          showErr('지도 로드 실패 — Kakao JS SDK 도메인 미등록? | loc=' + loc.slice(0,30));
        }
      }, 150);
    }
  </script>

  <script
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}"
    onload="initKakaoMap()"
    onerror="showErr('카카오맵 SDK 로드 실패')">
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Expo WebView가 postMessage로 통신할 수 있도록 CSP 완화
      'Content-Security-Policy': "default-src *; script-src * 'unsafe-inline'; style-src * 'unsafe-inline';",
    },
  });
}
