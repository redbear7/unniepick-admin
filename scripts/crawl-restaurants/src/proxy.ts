/**
 * 프록시 유틸리티
 *
 * .env 설정:
 *   PROXY_URL=http://user:pass@host:port        단일 프록시
 *   PROXY_URL=socks5://user:pass@host:port      SOCKS5 프록시
 *   PROXY_LIST=http://p1:port,http://p2:port    로테이션 (호출마다 랜덤 선택)
 *
 * 미설정 시 프록시 없이 동작 (기존과 동일).
 */

export type PlaywrightProxy = {
  server:    string;
  username?: string;
  password?: string;
};

// ── 프록시 URL 반환 ───────────────────────────────────────────────
// PROXY_LIST가 있으면 랜덤 선택, 없으면 PROXY_URL 사용
export function getProxyUrl(): string | undefined {
  const list = process.env.PROXY_LIST
    ?.split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (list?.length) return list[Math.floor(Math.random() * list.length)];
  return process.env.PROXY_URL || undefined;
}

// ── Playwright proxy 옵션 반환 ───────────────────────────────────
export function getPlaywrightProxy(): PlaywrightProxy | undefined {
  const raw = getProxyUrl();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return {
      server:   `${u.protocol}//${u.hostname}:${u.port}`,
      username: u.username || undefined,
      password: u.password || undefined,
    };
  } catch {
    // URL 파싱 실패 시 그대로 server에 사용
    return { server: raw };
  }
}

// ── 프록시 적용 fetch (undici ProxyAgent 사용) ────────────────────
// undici 미설치 시 경고 후 일반 fetch로 폴백
let _proxyAgent: unknown = null;
let _agentInit = false;

async function getProxyAgent(): Promise<unknown | undefined> {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return undefined;

  if (!_agentInit) {
    _agentInit = true;
    try {
      const { ProxyAgent } = await import('undici');
      _proxyAgent = new ProxyAgent(proxyUrl);
      console.log(`[proxy] fetch 프록시 적용: ${proxyUrl.replace(/:[^:@]+@/, ':***@')}`);
    } catch {
      console.warn('[proxy] undici 미설치 → fetch 프록시 미적용 (npm install undici)');
    }
  }
  return _proxyAgent ?? undefined;
}

export async function proxyFetch(
  url: string | URL,
  opts: RequestInit = {},
): Promise<Response> {
  const agent = await getProxyAgent();
  if (!agent) return fetch(url, opts);
  return fetch(url, { ...opts, dispatcher: agent } as RequestInit & { dispatcher: unknown });
}

// ── 프록시 상태 출력 ─────────────────────────────────────────────
export function logProxyStatus(): void {
  const url = getProxyUrl();
  if (url) {
    const safe = url.replace(/:[^:@]+@/, ':***@');
    console.log(`  [proxy] ${safe}`);
  } else {
    console.log('  [proxy] 미설정 (직접 연결)');
  }
}
