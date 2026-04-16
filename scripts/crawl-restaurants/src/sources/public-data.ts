import type { RestaurantData } from '../storage.js';

/**
 * 공공데이터포털 - 전국 모범음식점 표준데이터
 * CSV 다운로드 후 창원시 필터링
 * https://www.data.go.kr/data/15096282/standard.do
 */
export async function crawlPublicData(): Promise<RestaurantData[]> {
  const results: RestaurantData[] = [];

  // LOCALDATA API로 창원시 모범음식점 조회
  // 또는 경상남도 모범음식점 CSV에서 창원 필터링
  const csvUrl = 'https://file.localdata.go.kr/file/model_restaurants/info';

  console.log('    [공공데이터] 모범음식점 데이터 다운로드 중...');

  try {
    const res = await fetch(csvUrl, {
      headers: { 'Accept': 'text/csv, application/octet-stream, */*' },
      redirect: 'follow',
    });

    if (!res.ok) {
      console.log(`    [공공데이터] 다운로드 실패 (${res.status}). LOCALDATA API 시도...`);
      return await crawlLocalDataApi();
    }

    const text = await res.text();
    const lines = text.split('\n');
    const header = lines[0]?.split(',').map((h) => h.trim().replace(/"/g, ''));

    if (!header?.length) {
      console.log('    [공공데이터] CSV 파싱 실패');
      return await crawlLocalDataApi();
    }

    // 헤더에서 필요한 컬럼 인덱스 찾기
    const nameIdx = header.findIndex((h) => h.includes('업소명') || h.includes('사업장명'));
    const addrIdx = header.findIndex((h) => h.includes('주소') || h.includes('소재지'));
    const phoneIdx = header.findIndex((h) => h.includes('전화'));
    const catIdx = header.findIndex((h) => h.includes('음식종류') || h.includes('업종'));
    const statusIdx = header.findIndex((h) => h.includes('영업상태'));

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (!cols || cols.length < 3) continue;

      const addr = cols[addrIdx] ?? '';
      // 창원시 필터링 (창원, 마산, 진해 포함)
      if (!addr.includes('창원') && !addr.includes('마산') && !addr.includes('진해')) continue;

      const status = cols[statusIdx] ?? '';
      if (status && status.includes('폐업')) continue;

      const name = (cols[nameIdx] ?? '').replace(/"/g, '').trim();
      if (!name) continue;

      results.push({
        naver_place_id: `pub_${name}_${addr.slice(0, 20)}`,
        name,
        address: addr.replace(/"/g, '').trim() || undefined,
        phone: (cols[phoneIdx] ?? '').replace(/"/g, '').trim() || undefined,
        category: (cols[catIdx] ?? '').replace(/"/g, '').trim() || undefined,
        tags: ['모범음식점', '공공데이터'],
      });
    }
  } catch (e) {
    console.log(`    [공공데이터] CSV 에러: ${(e as Error).message}`);
    return await crawlLocalDataApi();
  }

  console.log(`  [공공데이터] 창원 모범음식점 ${results.length}개 추출`);
  return results;
}

/** LOCALDATA API 폴백 */
async function crawlLocalDataApi(): Promise<RestaurantData[]> {
  console.log('    [공공데이터] LOCALDATA API는 인증키 필요 — 건너뜀');
  return [];
}

/** CSV 라인 파서 (따옴표 내 쉼표 처리) */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
