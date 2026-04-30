/**
 * 창원시 관광포털 크롤링
 * https://www.changwon.go.kr/tour/index.do?menuCode=001_004004002000
 * 카테고리: CGR(창원맛집), EF(모범음식점), FSS(음식특화거리)
 */
export async function crawlChangwonTour(page) {
    const results = [];
    const categories = ['CGR', 'EF', 'FSS']; // 창원맛집, 모범음식점, 음식특화거리
    for (const cat of categories) {
        console.log(`    [창원관광] 카테고리: ${cat}`);
        let pageNo = 1;
        while (true) {
            const url = `https://www.changwon.go.kr/tour/index.do?menuCode=001_004004002000&page.pageNo=${pageNo}&search.searchCategory=${cat}`;
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
            await page.waitForTimeout(2000);
            // 맛집 리스트 추출
            const items = await page.evaluate(() => {
                const list = [];
                document.querySelectorAll('.food-list li, .list-wrap li, ul.food_list > li').forEach((li) => {
                    const nameEl = li.querySelector('.tit, .name, h3, h4, p.tit');
                    const addrEl = li.querySelector('.location, .addr, .address, p.location');
                    const catEl = li.querySelector('.cate, .category, p.cate');
                    const imgEl = li.querySelector('img');
                    const tagEls = li.querySelectorAll('.tag li, .tag span');
                    const name = nameEl?.textContent?.trim() ?? '';
                    if (!name)
                        return;
                    // detailId 추출 (goView('48') 패턴)
                    const onclick = li.querySelector('a')?.getAttribute('href') ?? '';
                    const idMatch = onclick.match(/goView\(['"]?(\d+)['"]?\)/);
                    list.push({
                        name,
                        address: addrEl?.textContent?.trim() ?? '',
                        category: catEl?.textContent?.trim() ?? '',
                        tags: [...tagEls].map((t) => t.textContent?.trim() ?? '').filter(Boolean),
                        imageUrl: imgEl?.getAttribute('src') ?? '',
                        detailId: idMatch?.[1] ?? '',
                    });
                });
                return list;
            });
            if (items.length === 0)
                break;
            for (const item of items) {
                results.push({
                    naver_place_id: `cwt_${item.detailId || item.name}`,
                    name: item.name,
                    address: item.address || undefined,
                    category: item.category || undefined,
                    tags: [...item.tags, '창원관광포털', cat === 'EF' ? '모범음식점' : '창원맛집'],
                    image_url: item.imageUrl || undefined,
                });
            }
            console.log(`    [창원관광] ${cat} 페이지 ${pageNo}: ${items.length}개`);
            // 다음 페이지 확인
            const hasNext = await page.evaluate((currentPage) => {
                const nextBtn = document.querySelector('a.next, .paging .next');
                const totalText = document.body.innerText.match(/페이지\s*(\d+)\s*\/\s*(\d+)/);
                if (totalText) {
                    return parseInt(totalText[1]) < parseInt(totalText[2]);
                }
                return !!nextBtn;
            }, pageNo);
            if (!hasNext)
                break;
            pageNo++;
        }
    }
    console.log(`  [창원관광] 총 ${results.length}개 수집`);
    return results;
}
