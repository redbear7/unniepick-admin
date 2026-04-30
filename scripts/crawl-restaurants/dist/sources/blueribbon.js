/**
 * 블루리본 서베이 크롤링
 * https://www.bluer.co.kr/search?zone1=경남&zone2=창원시
 */
export async function crawlBlueRibbon(page) {
    const results = [];
    const url = 'https://www.bluer.co.kr/search?query=&zone1=%EA%B2%BD%EB%82%A8&zone2=%EC%B0%BD%EC%9B%90%EC%8B%9C';
    console.log('    [블루리본] 페이지 접속...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(3000);
    // 무한스크롤로 모든 결과 로딩
    let prevCount = 0;
    for (let i = 0; i < 20; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
        const currentCount = await page.$$eval('[class*="restaurant"], [class*="store"], [class*="item"], .search-result-item, article', (els) => els.length);
        if (currentCount === prevCount)
            break;
        prevCount = currentCount;
    }
    // 맛집 리스트 추출
    const items = await page.evaluate(() => {
        const list = [];
        // 블루리본 검색 결과 카드들
        const cards = document.querySelectorAll('[class*="SearchResult"], [class*="RestaurantCard"], [class*="store-item"], article, .search-result-item');
        cards.forEach((card) => {
            const nameEl = card.querySelector('h2, h3, h4, [class*="name"], [class*="title"], a > strong, a > span');
            const name = nameEl?.textContent?.trim() ?? '';
            if (!name || name.length < 2)
                return;
            // 리본 수 (이미지 개수 또는 텍스트)
            const ribbonEls = card.querySelectorAll('[class*="ribbon"] img, [class*="ribbon"] svg, .ribbon');
            let ribbons = ribbonEls.length;
            if (!ribbons) {
                const ribbonText = card.textContent?.match(/리본\s*(\d)/);
                ribbons = ribbonText ? parseInt(ribbonText[1]) : 0;
            }
            const catEl = card.querySelector('[class*="category"], [class*="type"], [class*="cuisine"]');
            const addrEl = card.querySelector('[class*="address"], [class*="location"], [class*="addr"]');
            const imgEl = card.querySelector('img');
            list.push({
                name,
                ribbons,
                category: catEl?.textContent?.trim() ?? '',
                address: addrEl?.textContent?.trim() ?? '',
                imageUrl: imgEl?.getAttribute('src') ?? '',
            });
        });
        return list;
    });
    for (const item of items) {
        const ribbonTag = item.ribbons > 0 ? `블루리본${item.ribbons}개` : '블루리본';
        results.push({
            naver_place_id: `br_${item.name}`,
            name: item.name,
            address: item.address || undefined,
            category: item.category || undefined,
            rating: item.ribbons > 0 ? item.ribbons + 2.5 : undefined, // 리본→평점 환산 (1리본=3.5, 2=4.5, 3=5.0)
            tags: [ribbonTag, '블루리본'],
            image_url: item.imageUrl || undefined,
        });
    }
    console.log(`  [블루리본] 총 ${results.length}개 수집`);
    return results;
}
