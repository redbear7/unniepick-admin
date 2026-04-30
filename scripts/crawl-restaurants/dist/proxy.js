/**
 * 프록시 유틸리티 — 브라우저 스크래핑 전용
 *
 * ⚠️  공식 API (Kakao REST API, Naver API)에는 사용하지 않습니다.
 *     공식 API는 API KEY 기반 인증이므로 IP 차단 없음.
 *     할당량 초과 시 KEY가 거부되며 프록시로는 해결 불가.
 *
 * 적용 대상:
 *   - main.ts       : 네이버 Playwright 스크래핑
 *   - daum-main.ts  : 다음 Playwright 스크래핑
 *
 * .env 설정:
 *   PROXY_URL=http://user:pass@host:port        단일 프록시
 *   PROXY_URL=socks5://user:pass@host:port      SOCKS5 프록시
 *   PROXY_LIST=http://p1:port,http://p2:port    로테이션 (호출마다 랜덤 선택)
 *
 * 미설정 시 직접 연결 (기존과 동일).
 */
// ── 프록시 URL 반환 ───────────────────────────────────────────────
// PROXY_LIST가 있으면 랜덤 선택, 없으면 PROXY_URL 사용
export function getProxyUrl() {
    const list = process.env.PROXY_LIST
        ?.split(',')
        .map(s => s.trim())
        .filter(Boolean);
    if (list?.length)
        return list[Math.floor(Math.random() * list.length)];
    return process.env.PROXY_URL || undefined;
}
// ── Playwright proxy 옵션 반환 ───────────────────────────────────
export function getPlaywrightProxy() {
    const raw = getProxyUrl();
    if (!raw)
        return undefined;
    try {
        const u = new URL(raw);
        return {
            server: `${u.protocol}//${u.hostname}:${u.port}`,
            username: u.username || undefined,
            password: u.password || undefined,
        };
    }
    catch {
        // URL 파싱 실패 시 그대로 server에 사용
        return { server: raw };
    }
}
// ── 프록시 상태 출력 ─────────────────────────────────────────────
export function logProxyStatus() {
    const url = getProxyUrl();
    if (url) {
        const safe = url.replace(/:[^:@]+@/, ':***@');
        console.log(`  [proxy] ${safe}`);
    }
    else {
        console.log('  [proxy] 미설정 (직접 연결)');
    }
}
