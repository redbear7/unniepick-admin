import type { Page } from 'playwright';
import type { RestaurantData } from '../storage.js';

/**
 * 네이버 플레이스 검증
 * 수집된 맛집을 네이버에서 검색하여:
 * 1. 현재 영업 중인지 확인
 * 2. 정확한 주소/좌표 업데이트
 * 3. 평점/리뷰 수 보강
 * 4. naver_place_id를 실제 ID로 교체
 */
export async function verifyWithNaver(
  page: Page,
  restaurants: RestaurantData[],
): Promise<RestaurantData[]> {
  const verified: RestaurantData[] = [];
  const failed: string[] = [];

  console.log(`\n  [네이버 검증] ${restaurants.length}개 맛집 검증 시작...`);

  for (let i = 0; i < restaurants.length; i++) {
    const r = restaurants[i];
    const query = r.address
      ? `${r.name} ${r.address.split(' ').slice(0, 3).join(' ')}`
      : `창원 ${r.name}`;

    try {
      // 네이버 플레이스 검색
      const searchUrl = `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20_000 });
      await page.waitForTimeout(2000);

      // __APOLLO_STATE__에서 첫 번째 결과의 place ID + 상세 정보 추출
      const naverData = await page.evaluate((targetName: string) => {
        const apollo = (window as any).__APOLLO_STATE__;
        if (!apollo) return null;

        // Place 엔트리들 중 이름이 가장 유사한 것 찾기
        let bestMatch: any = null;
        let bestId = '';

        for (const [key, value] of Object.entries(apollo) as [string, any][]) {
          const m = key.match(/^Place:(\d+)$/);
          if (!m) continue;

          const name = value?.name ?? '';
          // 정확 일치 우선
          if (name === targetName) {
            bestMatch = value;
            bestId = m[1];
            break;
          }
          // 포함 관계 (첫 매칭)
          if (!bestMatch && (name.includes(targetName) || targetName.includes(name))) {
            bestMatch = value;
            bestId = m[1];
          }
        }

        if (!bestMatch) {
          // 첫 번째 Place 엔트리라도 반환
          for (const [key, value] of Object.entries(apollo) as [string, any][]) {
            if (key.match(/^Place:\d+$/)) {
              bestMatch = value;
              bestId = key.replace('Place:', '');
              break;
            }
          }
        }

        if (!bestMatch) return null;

        return {
          placeId: bestId,
          name: bestMatch.name ?? '',
          address: bestMatch.roadAddress ?? bestMatch.address ?? '',
          phone: bestMatch.phone ?? '',
          category: bestMatch.category ?? (bestMatch.categories ?? [])[0] ?? '',
          x: bestMatch.x ?? bestMatch.longitude ?? '',
          y: bestMatch.y ?? bestMatch.latitude ?? '',
          rating: bestMatch.visitorReviewScore ?? bestMatch.rating ?? null,
          reviewCount: bestMatch.reviewCount ?? 0,
          visitorReviewCount: bestMatch.visitorReviewCount ?? 0,
          imageUrl: bestMatch.thumUrl ?? bestMatch.imageUrl ?? '',
          isClosed: bestMatch.businessStatus === 'CLOSED' || bestMatch.isCloseByAdmin === true,
        };
      }, r.name);

      if (!naverData || naverData.isClosed) {
        const reason = naverData?.isClosed ? '폐업' : '검색 안됨';
        console.log(`    [${i + 1}/${restaurants.length}] ✗ ${r.name} — ${reason}`);
        failed.push(`${r.name} (${reason})`);
        continue;
      }

      // 검증된 데이터 병합
      verified.push({
        ...r,
        naver_place_id: naverData.placeId,
        name: naverData.name || r.name,
        address: naverData.address || r.address,
        phone: naverData.phone || r.phone,
        category: naverData.category || r.category,
        latitude: naverData.y ? parseFloat(naverData.y) : r.latitude,
        longitude: naverData.x ? parseFloat(naverData.x) : r.longitude,
        rating: naverData.rating ? parseFloat(naverData.rating) : r.rating,
        review_count: naverData.reviewCount || r.review_count,
        visitor_review_count: naverData.visitorReviewCount || r.visitor_review_count,
        image_url: naverData.imageUrl || r.image_url,
        naver_place_url: `https://map.naver.com/p/entry/place/${naverData.placeId}`,
      });

      console.log(`    [${i + 1}/${restaurants.length}] ✓ ${r.name} → ${naverData.name} (★${naverData.rating ?? '?'})`);

      // 네이버 과부하 방지
      await page.waitForTimeout(800 + Math.random() * 700);
    } catch (e) {
      console.log(`    [${i + 1}/${restaurants.length}] ✗ ${r.name} — 에러: ${(e as Error).message}`);
      failed.push(`${r.name} (에러)`);
    }
  }

  console.log(`\n  [네이버 검증] 완료: ${verified.length}개 확인, ${failed.length}개 제외`);
  if (failed.length > 0) {
    console.log(`  제외된 맛집: ${failed.join(', ')}`);
  }

  return verified;
}
