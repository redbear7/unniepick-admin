/**
 * 카카오 로컬 API 래퍼
 *
 * 공식 문서: https://developers.kakao.com/docs/latest/ko/local/dev-guide
 * 하루 300,000건 무료 (키워드 검색)
 *
 * 키워드 검색 1회 = 1건 소비 (페이지당)
 * 페이지당 최대 15개, 최대 45페이지 → 키워드당 최대 675개 결과
 */

const KAKAO_API_BASE = 'https://dapi.kakao.com/v2/local/search/keyword.json';

// ── 카카오 API 응답 타입 ──────────────────────────────────────────────────────
export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;       // 예: "음식점 > 한식 > 설렁탕,국밥"
  category_group_code: string; // FD6(음식점), CE7(카페), etc.
  category_group_name: string;
  phone: string;
  address_name: string;        // 지번주소
  road_address_name: string;   // 도로명주소
  x: string;                   // 경도(longitude)
  y: string;                   // 위도(latitude)
  place_url: string;           // https://place.map.kakao.com/12345
  distance: string;            // 중심점에서 거리(m), 위치 기반 검색 시만 유효
}

interface KakaoSearchResult {
  places: KakaoPlace[];
  isEnd: boolean;
  totalCount: number;
  pageableCount: number;
}

// ── 단일 페이지 검색 ──────────────────────────────────────────────────────────
export async function searchKakaoKeyword(
  query: string,
  page = 1,
  opts: {
    x?: number;        // 중심 경도 (검색 기준점, 선택)
    y?: number;        // 중심 위도 (검색 기준점, 선택)
    radius?: number;   // 검색 반경 m (최대 20000, opts.x/y 필요)
    size?: number;     // 페이지당 결과수 (기본 15, 최대 15)
    sort?: 'accuracy' | 'distance'; // 정렬 (distance는 x/y 필요)
  } = {},
): Promise<KakaoSearchResult> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) throw new Error('KAKAO_REST_API_KEY 환경변수가 없어요.');

  const params = new URLSearchParams({
    query,
    page: String(page),
    size: String(opts.size ?? 15),
    sort: opts.sort ?? 'accuracy',
  });
  if (opts.x != null) params.set('x', String(opts.x));
  if (opts.y != null) params.set('y', String(opts.y));
  if (opts.radius != null && opts.x != null) params.set('radius', String(opts.radius));

  const res = await fetch(`${KAKAO_API_BASE}?${params}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`카카오 API 오류 (${res.status}): ${err}`);
  }

  const data = await res.json() as {
    documents: KakaoPlace[];
    meta: { total_count: number; pageable_count: number; is_end: boolean };
  };

  return {
    places:        data.documents,
    isEnd:         data.meta.is_end,
    totalCount:    data.meta.total_count,
    pageableCount: data.meta.pageable_count,
  };
}

// ── 전체 페이지 자동 수집 (is_end까지 페이지네이션) ──────────────────────────
export async function searchKakaoAll(
  query: string,
  opts: {
    x?: number;
    y?: number;
    radius?: number;
    maxPages?: number;   // 기본 5페이지 (= 최대 75개)
    delayMs?: number;    // 요청 간격 ms (기본 300ms, rate-limit 방지)
  } = {},
): Promise<KakaoPlace[]> {
  const maxPages = opts.maxPages ?? 5;
  const delayMs  = opts.delayMs  ?? 300;
  const all: KakaoPlace[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const result = await searchKakaoKeyword(query, page, opts);
    all.push(...result.places);

    if (result.isEnd) {
      break;
    }

    // 요청 간격 준수 (카카오 rate limit: 초당 10건)
    if (page < maxPages) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return all;
}

// ── 카카오 카테고리 코드 → 한국어 카테고리 ───────────────────────────────────
export function kakaoGroupToCategory(
  groupCode: string,
  categoryName: string,
): string {
  // 상세 카테고리에서 마지막 뎁스 추출 (예: "음식점 > 한식 > 설렁탕" → "설렁탕")
  const parts = categoryName.split('>').map(s => s.trim());
  if (parts.length >= 3) return parts[parts.length - 1]; // 가장 상세한 카테고리
  if (parts.length === 2) return parts[1];

  // 그룹 코드 fallback
  const codeMap: Record<string, string> = {
    FD6: '음식점', CE7: '카페', CS2: '편의점',
    MT1: '대형마트', PK6: '주차장', OL7: '주유소',
    SW8: '지하철', BK9: '은행', CT1: '문화시설',
  };
  return codeMap[groupCode] ?? categoryName.split('>')[0]?.trim() ?? '기타';
}
