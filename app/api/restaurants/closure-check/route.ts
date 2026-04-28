/**
 * POST /api/restaurants/closure-check
 * body: { limit?: number, force?: boolean }
 *
 * 행정안전부 지방행정인허가 OpenAPI로 폐업 여부 + 개업일 자동 수집
 * - 창원시 일반음식점·휴게음식점·제과점 인허가 데이터와 상호명+구 매칭
 * - 폐업 확인 → operating_status = 'inactive', closed_at 기록
 * - 영업 확인 → last_verified_at 갱신, apvPermYmd → opened_at 저장
 * - 미발견  → suspicion_count +1 (임계값 3 이상 시 suspected)
 *
 * 사전 준비: .env에 LOCALDATA_AUTH_KEY 추가 (localdata.go.kr 회원가입 후 발급)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CHANGWON_CODE = '3620000';

const SVC_IDS = [
  '07_24_04_P', // 일반음식점
  '07_24_03_P', // 휴게음식점 (카페·분식 포함)
  '07_24_05_P', // 제과점영업 (베이커리)
];

const LOCALDATA_URL = 'https://www.localdata.go.kr/platform/rest/TO0/openDataApi';

interface LocalDataRow {
  bizNm:       string; // 상호명
  rdnWhlAddr:  string; // 도로명 전체 주소
  lnWhlAddr:   string; // 지번 주소
  dtlStateNm:  string; // 상세영업상태명: "영업중" | "폐업" | "휴업"
  dcbYmd:      string; // 폐업일자 YYYYMMDD
  apvPermYmd:  string; // 인허가일자 YYYYMMDD (≈ 개업일)
}

interface MatchResult {
  status:   'closed' | 'open' | 'not_found';
  openedAt: string | null; // ISO date string, null이면 미확인
  closedAt: string | null;
}

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function normName(s: string): string {
  return s.replace(/[\s\(\)\[\]·,\.\&\+]/g, '').toLowerCase();
}

function extractGu(addr: string | null | undefined): string {
  if (!addr) return '';
  return addr.match(/[가-힣]+구/)?.[0] ?? '';
}

function isNameSimilar(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) {
    return Math.abs(na.length - nb.length) <= 3;
  }
  return false;
}

/** YYYYMMDD → ISO date string (null if invalid) */
function ymdToIso(ymd: string | null | undefined): string | null {
  if (!ymd || ymd.length !== 8) return null;
  const y = ymd.slice(0, 4);
  const m = ymd.slice(4, 6);
  const d = ymd.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}`);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

async function checkLocaldata(
  name: string,
  address: string | null,
  authKey: string,
): Promise<MatchResult> {
  const gu = extractGu(address);

  for (const svcId of SVC_IDS) {
    const params = new URLSearchParams({
      authKey,
      pageIndex:    '1',
      pageSize:     '10',
      opnSvcId:     svcId,
      opnSfTeamCode: CHANGWON_CODE,
      bizNm:        name,
    });

    try {
      const res = await fetch(`${LOCALDATA_URL}?${params}`, {
        headers: { Accept: 'application/json' },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const json = await res.json();
      const rows: LocalDataRow[] = json?.body?.items?.item ?? [];

      for (const row of rows) {
        if (!isNameSimilar(name, row.bizNm)) continue;

        if (gu) {
          const rowGu = extractGu(row.rdnWhlAddr || row.lnWhlAddr);
          if (rowGu && rowGu !== gu) continue;
        }

        const state    = row.dtlStateNm ?? '';
        const openedAt = ymdToIso(row.apvPermYmd);
        const closedAt = ymdToIso(row.dcbYmd);

        if (state.includes('폐업') || state.includes('취소') || state.includes('말소')) {
          return { status: 'closed', openedAt, closedAt };
        }
        return { status: 'open', openedAt, closedAt: null };
      }
    } catch {
      continue;
    }
  }

  return { status: 'not_found', openedAt: null, closedAt: null };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    limit?: number;
    force?: boolean;
  };
  const limit = Math.min(100, body.limit ?? 30);
  const force = body.force ?? false;

  const authKey = process.env.LOCALDATA_AUTH_KEY;
  if (!authKey) {
    return NextResponse.json(
      { error: 'LOCALDATA_AUTH_KEY 환경변수 없음 — localdata.go.kr에서 발급 필요' },
      { status: 500 },
    );
  }

  const sb = adminSb();

  let query = sb
    .from('restaurants')
    .select('id, name, address, operating_status, suspicion_count, naver_place_id, kakao_place_id')
    .not('operating_status', 'in', '("inactive","relocated")')
    .order('last_verified_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (!force) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`);
  }

  const { data: targets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!targets?.length) return NextResponse.json({ ok: true, checked: 0, closed: 0, suspected: 0, opened: 0, message: '검수 대상 없음' });

  const now = new Date().toISOString();
  let closed = 0, confirmed = 0, suspected = 0, opened = 0, errors = 0;
  const SUSPICION_THRESHOLD = 3;

  for (const r of targets) {
    try {
      const result = await checkLocaldata(r.name, r.address, authKey);

      if (result.status === 'closed') {
        await sb.from('restaurants').update({
          operating_status:   'inactive',
          closure_source:     'localdata',
          closure_confidence: 0.9,
          closed_at:          result.closedAt ?? now,
          last_verified_at:   now,
          suspicion_count:    0,
          ...(result.openedAt ? { opened_at: result.openedAt } : {}),
        }).eq('id', r.id);
        closed++;

      } else if (result.status === 'open') {
        await sb.from('restaurants').update({
          operating_status:   r.operating_status === 'unknown' ? 'active' : r.operating_status,
          closure_source:     null,
          closure_confidence: 0,
          last_verified_at:   now,
          suspicion_count:    0,
          ...(result.openedAt ? { opened_at: result.openedAt } : {}),
        }).eq('id', r.id);
        if (result.openedAt) opened++;
        confirmed++;

      } else {
        const newCount  = (r.suspicion_count ?? 0) + 1;
        const newStatus = newCount >= SUSPICION_THRESHOLD ? 'suspected' : r.operating_status;
        await sb.from('restaurants').update({
          suspicion_count:    newCount,
          operating_status:   newStatus,
          last_verified_at:   now,
          closure_confidence: Math.min(0.3 * newCount, 0.9),
        }).eq('id', r.id);
        if (newStatus === 'suspected') suspected++;
      }
    } catch {
      errors++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return NextResponse.json({
    ok: true,
    checked:   targets.length,
    closed,
    confirmed,
    suspected,
    opened,   // 개업일 수집 완료 건수
    errors,
  });
}
