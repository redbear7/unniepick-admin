/**
 * POST /api/restaurants/closure-check
 * body: { limit?: number, force?: boolean }
 *
 * 공공데이터포털(data.go.kr) 지방행정인허가 OpenAPI로 폐업 여부 + 개업일 자동 수집
 * - localdata.go.kr 2026-04-16 폐쇄 → data.go.kr 이전 (행정안전부 공식 마이그레이션)
 * - APIs: general_restaurants / rest_cafes / bakeries
 * - 사전 준비: data.go.kr 로그인 → '지방행정인허가데이터' 검색 → 활용신청
 *   → 마이페이지 > 개인 API 키 확인 → LOCALDATA_AUTH_KEY 환경변수에 등록
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// data.go.kr 음식점 인허가 서비스 URL (붙임2 URL 목록 기준)
const SVC_URLS = [
  'http://apis.data.go.kr/1741000/general_restaurants/info', // 일반음식점
  'http://apis.data.go.kr/1741000/rest_cafes/info',          // 휴게음식점 (카페·분식)
  'http://apis.data.go.kr/1741000/bakeries/info',            // 제과점영업
];

// 새 API 응답 필드명 (붙임3 매핑테이블 기준)
interface DataRow {
  BPLC_NM:         string; // 사업장명 (상호)
  ROAD_NM_ADDR:    string; // 도로명주소
  LOTNO_ADDR:      string; // 지번주소
  SALS_STTS_NM:    string; // 영업상태명
  DTL_SALS_STTS_NM:string; // 상세영업상태명: "영업중" | "폐업" | "휴업"
  LCPMT_YMD:       string; // 인허가일자 YYYYMMDD (≈ 개업일)
  CLSBIZ_YMD:      string; // 폐업일자 YYYYMMDD
}

interface MatchResult {
  status:   'closed' | 'open' | 'not_found';
  openedAt: string | null;
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

function isChangwon(addr: string | null | undefined): boolean {
  if (!addr) return false;
  return addr.includes('창원');
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

function ymdToIso(ymd: string | null | undefined): string | null {
  if (!ymd || ymd.length !== 8) return null;
  const date = new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

async function checkRestaurant(
  name: string,
  address: string | null,
  serviceKey: string,
): Promise<MatchResult> {
  const gu = extractGu(address);

  for (const url of SVC_URLS) {
    // cond[] 필터: 사업장명 검색 (LIKE 또는 EQ)
    const params = new URLSearchParams({
      serviceKey,
      pageNo:    '1',
      numOfRows: '10',
      'cond[BPLC_NM::EQ]': name,
    });

    try {
      const res = await fetch(`${url}?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const text = await res.text();
      // XML 응답인 경우 오류 코드 감지
      if (text.trimStart().startsWith('<')) {
        const code = text.match(/<resultCode>(\d+)<\/resultCode>/)?.[1];
        if (code && code !== '00') continue; // 00 = 정상
        continue;
      }

      const json = JSON.parse(text);
      const raw  = json?.response?.body?.items?.item
                ?? json?.body?.items?.item
                ?? json?.items?.item
                ?? [];
      const rows: DataRow[] = Array.isArray(raw) ? raw : (raw ? [raw] : []);

      for (const row of rows) {
        if (!row?.BPLC_NM) continue;
        if (!isNameSimilar(name, row.BPLC_NM)) continue;

        // 창원시 주소 확인 (도로명 또는 지번)
        const rowAddr = row.ROAD_NM_ADDR || row.LOTNO_ADDR || '';
        if (!isChangwon(rowAddr)) continue;

        // 구(區) 단위 추가 검증
        if (gu) {
          const rowGu = extractGu(rowAddr);
          if (rowGu && rowGu !== gu) continue;
        }

        const state    = row.DTL_SALS_STTS_NM || row.SALS_STTS_NM || '';
        const openedAt = ymdToIso(row.LCPMT_YMD);
        const closedAt = ymdToIso(row.CLSBIZ_YMD);

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

  const serviceKey = process.env.LOCALDATA_AUTH_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'LOCALDATA_AUTH_KEY 환경변수 없음 — data.go.kr에서 지방행정인허가데이터 활용신청 후 키 등록 필요' },
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
      const result = await checkRestaurant(r.name, r.address, serviceKey);

      if (result.status === 'closed') {
        await sb.from('restaurants').update({
          operating_status:   'inactive',
          closure_source:     'data.go.kr',
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
    opened,
    errors,
  });
}
