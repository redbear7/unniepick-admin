import 'dotenv/config';
import { PlaywrightCrawler, Configuration } from 'crawlee';
import cron from 'node-cron';
import { createDetailHandler, createListHandler } from './routes.js';
import { upsertRestaurants, getStats, type RestaurantData } from './storage.js';

const SEARCH_QUERIES = [
  '창원 신상맛집',
  '창원 핫플 맛집',
  '마산 신상맛집',
  '진해 맛집',
];

async function crawl() {
  console.log(`\n[${new Date().toLocaleString('ko-KR')}] 크롤링 시작...`);

  const allResults: RestaurantData[] = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`\n  검색어: "${query}"`);

    const config = new Configuration({ persistStorage: false });

    const crawler = new PlaywrightCrawler({
      requestHandler: async (ctx) => {
        const { request } = ctx;
        if (request.label === 'DETAIL') {
          const result = await createDetailHandler(ctx);
          if (result) allResults.push(result);
        } else {
          await createListHandler(ctx);
        }
      },
      maxRequestsPerCrawl: 120,
      maxConcurrency: 3,
      requestHandlerTimeoutSecs: 60,
      headless: true,
      launchContext: {
        launchOptions: { args: ['--lang=ko-KR'] },
      },
      failedRequestHandler: ({ request, log }) => {
        log.warning(`요청 실패: ${request.url}`);
      },
    }, config);

    await crawler.run([{
      url: `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`,
    }]);

    console.log(`  "${query}" 완료 (누적 ${allResults.length}개)`);
  }

  // 중복 제거 (naver_place_id 기준)
  const unique = new Map<string, RestaurantData>();
  for (const r of allResults) {
    unique.set(r.naver_place_id, r);
  }
  const deduped = [...unique.values()];

  console.log(`\n중복 제거 후 ${deduped.length}개`);

  if (deduped.length > 0) {
    const saved = await upsertRestaurants(deduped);
    console.log(`${saved}개 맛집 DB 저장 완료`);
  }

  const stats = await getStats();
  console.log(`DB 총 맛집 수: ${stats.total}개\n`);
}

// 메인 실행
const isOnce = process.argv.includes('--once');

if (isOnce) {
  crawl().catch(console.error);
} else {
  console.log('크롤링 스케줄러 시작 (매일 06:00)');
  crawl().catch(console.error); // 시작 시 1회 실행

  cron.schedule('0 6 * * *', () => {
    crawl().catch(console.error);
  });
}
