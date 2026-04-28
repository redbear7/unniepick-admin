/**
 * POST /api/restaurants/closure-check
 * body: { limit?: number, force?: boolean }
 *
 * 행정안전부 지방행정인허가 OpenAPI로 폐업 여부 자동 검수
 * - 창원시 일반음식점·휴게음식점·제과점 인허가 데이터와 상호명+구 매칭
 * - 폐업 확인 → operating_status = 'inactive', closed_at 기록
 * - 영업 확인 → last_verified_at 갱신
 * - 미발견  → suspicion_count +1 (임계값 3 이상 시 suspected)
 *
 * 사전 준비: .env에 LOCALDATA_AUTH_KEY 추가 (localdata.go.kr 회원가입 후 발급)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 창원시 행정구역 코드 (행안부 localdata)
const CHANGWON_CODE = '3620000';

// 검색 대상 서비스 ID (업종 코드)
const SVC_IDS = [
  '07_24_04_P', // 일반음식점
  '07_24_03_P', // 휴게음식점 (카페·분식 포함)
  '07_24_05_P', // 제과점영업 (베이커리)
];

const LOCALDATA_URL = 'https://www.localdata.go.kr/platform/rest/TO0/openDataApi';

interface LocalDataRow {
  bizNm:        string; // 상호명
  rdnWhlAddr:   string; // 도로명 전체 주소
  lnWhlAddr:    string; // 지번 주소
  dtlStateNm:   string; // 상세영업상태명: "영업중" | "폐업" | "휴업"
  dcbYmd:       string; // 폐업일자 YYYYMMDD
}

type CheckResult = 'closed' | 'open' | 'not_found' | 'error';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** 상호명 정규화: 공백·특수문자 제거, 소문자 */
function normName(s: string): string {
  return s.replace(/[\s\(\)\[\]·,\.\&\&\+]/g, '').toLowerCase();
}

/** 주소에서 구 추출: "창원시 마산합포구 ..." → "마산합포구" */
function extractGu(addr: string | null): string {
  if (!addr) return '';
  return addr.match(/[가-힣]+구/)?.[0] ?? '';
}

/** 두 상호명이 유사한지 판단 */
function isNameSimilar(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (na === nb) return true;
  // 한쪽이 다른 쪽에 포함되면서 길이 차이 3자 이하
  if (na.includes(nb) || nb.includes(na)) {
    return Math.abs(na.length - nb.length) <= 3;
  }
  return false;
}

/** localdata API로 단일 업체 폐업 여부 조회 */
async function checkLocaldata(
  name: string,
  address: string | null,
  authKey: string,
): Promise<CheckResult> {
  const gu = extractGu(address);

  for (const svcId of SVC_IDS) {
    const params = new URLSearchParams({
      authKey,
      pageIndex: '1',
      pageSize:  '10',
      opnSvcId:  svcId,
      opnSfTeamCode: CHANGWON_CODE,
      bizNm:     name,
    });

    try {
      const res  = await fetch(`${LOCALDATA_URL}?${params}`, {
        headers: { Accept: 'application/json' },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const json = await res.json();
      const rows: LocalDataRow[] = json?.body?.items?.item ?? [];

      for (const row of rows) {
        // 상호명 유사도 체크
        if (!isNameSimilar(name, row.bizNm)) continue;

        // 구 일치 체크 (주소 있으면)
        if (gu) {
          const rowGu = extractGu(row.rdnWhlAddr || row.lnWhlAddr);
          if (rowGu && rowGu !== gu) continue;
        }

        // 매칭 성공
        const state = row.dtlStateNm ?? '';
        if (state.includes('폐업') || state.includes('취소') || state.includes('말소')) {
          return 'closed';
        }
        return 'open';
      }
    } catch {
      // 네트워크 오류 — 다음 svcId 시도
      continue;
    }
  }

  return 'not_found';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    limit?: number;
    force?: boolean; // true면 already_checked도 재검수
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

  // 검수 대상 쿼리
  // inactive / relocated는 이미 확정됐으므로 제외
  let query = sb
    .from('restaurants')
    .select('id, name, address, operating_status, suspicion_count, naver_place_id, kakao_place_id')
    .not('operating_status', 'in', '("inactive","relocated")')
    .order('last_verified_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (!force) {
    // 30일 이내 검수한 건 제외
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`);
  }

  const { data: targets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!targets?.length) return NextResponse.json({ ok: true, checked: 0, closed: 0, suspected: 0, message: '검수 대상 없음' });

  const now = new Date().toISOString();
  let closed = 0, confirmed = 0, suspected = 0, errors = 0;

  const SUSPICION_THRESHOLD = 3; // not_found 누적 N회 시 suspected

  for (const r of targets) {
    const result = await checkLocaldata(r.name, r.address, authKey);

    if (result === 'closed') {
      await sb.from('restaurants').update({
        operating_status:  'inactive',
        closure_source:    'localdata',
        closure_confidence: 0.9,
        closed_at:         now,
        last_verified_at:  now,
        suspicion_count:   0,
      }).eq('id', r.id);
      closed++;
    } else if (result === 'open') {
      await sb.from('restaurants').update({
        operating_status:  r.operating_status === 'unknown' ? 'active' : r.operating_status,
        closure_source:    null,
        closure_confidence: 0,
        last_verified_at:  now,
        suspicion_count:   0,
      }).eq('id', r.id);
      confirmed++;
    } else if (result === 'not_found') {
      // 공공데이터 미발견 → suspicion_count 증가
      const newCount = (r.suspicion_count ?? 0) + 1;
      const newStatus = newCount >= SUSPICION_THRESHOLD ? 'suspected' : r.operating_status;
      await sb.from('restaurants').update({
        suspicion_count:   newCount,
        operating_status:  newStatus,
        last_verified_at:  now,
        closure_confidence: Math.min(0.3 * newCount, 0.9),
      }).eq('id', r.id);
      if (newStatus === 'suspected') suspected++;
    } else {
      errors++;
    }

    // 요청 간격: localdata API 부하 방지
    await new Promise(r => setTimeout(r, 300));
  }

  return NextResponse.json({
    ok: true,
    checked:   targets.length,
    closed,
    confirmed,
    suspected,
    errors,
  });
}
