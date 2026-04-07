// ─── 언니픽 오디오 캐시 Service Worker ─────────────────────────────
// 첫 재생: fetch → AES-GCM 암호화 → IndexedDB 저장 + 동시 재생
// 재재생: IndexedDB 로드 → 복호화 → 즉시 응답 (네트워크 0)
// ──────────────────────────────────────────────────────────────────

const DB_NAME = 'unniepick-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';
const MAX_CACHE_COUNT = 500; // 최대 캐시 트랙 수
const AUDIO_PATTERN = /\/storage\/v1\/object\/public\/music-tracks\/audio\//;

// ─── AES-GCM 암호화 키 (세션마다 새로 생성, SW 생명주기 동안 유지) ──
let cryptoKeyPromise = null;

function getCryptoKey() {
  if (!cryptoKeyPromise) {
    cryptoKeyPromise = crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // extractable = false (키 내보내기 불가)
      ['encrypt', 'decrypt'],
    );
  }
  return cryptoKeyPromise;
}

// ─── IndexedDB 헬퍼 ───────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCached(url) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function putCached(url, iv, encrypted, contentType) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ url, iv, encrypted, contentType, cachedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 오래된 캐시 정리 (LRU)
async function evictOldEntries() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const all = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (all.length <= MAX_CACHE_COUNT) return;
  // 가장 오래된 것부터 삭제
  all.sort((a, b) => a.cachedAt - b.cachedAt);
  const toRemove = all.slice(0, all.length - MAX_CACHE_COUNT);
  for (const entry of toRemove) {
    store.delete(entry.url);
  }
}

// ─── Fetch 가로채기 ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Supabase Storage 오디오 요청만 가로채기
  if (!AUDIO_PATTERN.test(url)) return;

  event.respondWith(handleAudioFetch(event.request));
});

async function handleAudioFetch(request) {
  const url = request.url;
  const key = await getCryptoKey();

  // 1) IndexedDB 캐시 확인
  try {
    const cached = await getCached(url);
    if (cached) {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: cached.iv },
        key,
        cached.encrypted,
      );
      return new Response(decrypted, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType || 'audio/mpeg',
          'X-Audio-Cache': 'hit',
        },
      });
    }
  } catch {
    // 캐시 읽기/복호화 실패 → 네트워크 폴백
  }

  // 2) 네트워크에서 다운로드
  const response = await fetch(request);
  if (!response.ok) return response;

  // 3) 응답 복제 → 하나는 즉시 반환, 하나는 암호화 저장
  const cloned = response.clone();
  const contentType = response.headers.get('Content-Type') || 'audio/mpeg';

  // 백그라운드에서 암호화 저장 (응답 반환을 블록하지 않음)
  (async () => {
    try {
      const buf = await cloned.arrayBuffer();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        buf,
      );
      await putCached(url, iv, encrypted, contentType);
      await evictOldEntries();
    } catch (e) {
      console.warn('[SW] 오디오 캐시 저장 실패:', e.message);
    }
  })();

  // 캐시 히트가 아님을 알리는 헤더 추가
  const headers = new Headers(response.headers);
  headers.set('X-Audio-Cache', 'miss');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ─── SW 설치 & 활성화 ─────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── 캐시 관리 메시지 ─────────────────────────────────────────────
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'CLEAR_AUDIO_CACHE') {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      event.source?.postMessage({ type: 'AUDIO_CACHE_CLEARED' });
    } catch (e) {
      event.source?.postMessage({ type: 'AUDIO_CACHE_ERROR', error: e.message });
    }
  }

  if (event.data?.type === 'GET_CACHE_STATS') {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const count = await new Promise((resolve, reject) => {
        const req = tx.objectStore(STORE_NAME).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      event.source?.postMessage({ type: 'CACHE_STATS', count });
    } catch {
      event.source?.postMessage({ type: 'CACHE_STATS', count: 0 });
    }
  }
});
