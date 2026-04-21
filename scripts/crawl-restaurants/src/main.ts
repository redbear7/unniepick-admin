import 'dotenv/config';
import { chromium, type Page } from 'playwright';
import {
  upsertRestaurants, getStats, getExistingIds,
  getActiveKeywords, updateKeywordStatus,
  type RestaurantData, type ReviewKeyword, type MenuKeyword, type BlogReview,
  type CrawlKeyword,
} from './storage.js';
import { autoTagRestaurant } from './tagger.js';
import { notifyNewRestaurants, notifyDailySummary } from './notify.js';
import { processImage } from './image.js';

// ── 메인 크롤링 ─────────────────────────────────────────────

async function crawl(keywords: CrawlKeyword[]) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[${new Date().toLocaleString('ko-KR')}] 크롤링 시작 (${keywords.length}개 키워드)`);
  console.log(`${'='.repeat(50)}`);

  const existingIds = await getExistingIds();
  console.log(`기존 DB: ${existingIds.size}개`);

  const browser = await chromium.launch({ headless: true, args: ['--lang=ko-KR'] });
  const allResults: RestaurantData[] = [];

  try {
    for (const kw of keywords) {
      console.log(`\n  🔍 "${kw.keyword}" ${kw.analyze_reviews ? '(리뷰분석)' : ''}`);

      // 상태 'running'으로 마킹
      await updateKeywordStatus(kw.id, { status: 'running', last_error: undefined });

      const page = await browser.newPage();
      let keywordResults: RestaurantData[] = [];

      try {
        // ── 1. 목록에서 기본 정보 일괄 추출 ──
        const restaurants = await collectFromApollo(page, kw.keyword);
        console.log(`     ${restaurants.length}개 업체 수집`);

        // ── 2. analyze_reviews=true인 경우: 상세 정보 + 리뷰 분석 ──
        if (kw.analyze_reviews) {
          for (let i = 0; i < restaurants.length; i++) {
            const r = restaurants[i];
            r.is_new_open = true;
            try {
              console.log(`     [${i + 1}/${restaurants.length}] ${r.name} 상세+리뷰 분석...`);

              // 홈 탭 상세 정보 (영업시간·홈페이지·메뉴판)
              const detail = await crawlDetailInfo(page, r.naver_place_id);
              if (detail.business_hours)        r.business_hours = detail.business_hours;
              if (detail.business_hours_detail) r.business_hours_detail = detail.business_hours_detail;
              if (detail.website_url)           r.website_url = detail.website_url;
              if (detail.instagram_url)         r.instagram_url = detail.instagram_url;
              if (detail.menu_items?.length)    r.menu_items = detail.menu_items;

              // 방문자 리뷰 분석
              const reviews = await crawlReviews(page, r.naver_place_id);
              r.review_keywords = reviews.keywords;
              r.menu_keywords = reviews.menuKeywords;
              r.review_summary = reviews.summary;
              r.blog_reviews = reviews.blogReviews;

              // 상세 데이터로 auto_tags 재계산
              r.auto_tags = autoTagRestaurant(r);
            } catch (e) {
              console.log(`       분석 에러: ${(e as Error).message}`);
            }
            await page.waitForTimeout(500 + Math.random() * 500);
          }
        }

        // 키워드 태그 부착 (어떤 키워드에서 왔는지 식별용)
        for (const r of restaurants) r.tags = [...(r.tags ?? []), kw.keyword];

        // ── 이미지 리사이즈 + Storage 업로드 ──
        console.log(`     📷 이미지 처리 중...`);
        let imgCount = 0;
        for (const r of restaurants) {
          if (r.image_url) {
            (r as any).image_url_original = r.image_url;
            const { url, isProcessed } = await processImage(r.image_url, r.naver_place_id);
            if (isProcessed) {
              r.image_url = url;
              imgCount++;
            }
          }
        }
        console.log(`     📷 ${imgCount}/${restaurants.length}개 이미지 저장`);

        keywordResults = restaurants;
        allResults.push(...restaurants);
        console.log(`     ✓ 완료 (누적 ${allResults.length}개)`);

        // 키워드별 신규 수 계산 (성공 시에만)
        const newForKw = keywordResults.filter((r) => !existingIds.has(r.naver_place_id)).length;

        // 상태 'success' + 결과 기록 + PID 정리
        await updateKeywordStatus(kw.id, {
          status: 'success',
          last_crawled_at: new Date().toISOString(),
          last_result_count: keywordResults.length,
          last_new_count: existingIds.size > 0 ? newForKw : 0,
          current_pid: null,
        });
      } catch (e) {
        const msg = (e as Error).message;
        console.log(`     ✗ 에러: ${msg}`);
        await updateKeywordStatus(kw.id, {
          status: 'failed',
          last_error: msg,
          last_crawled_at: new Date().toISOString(),
          current_pid: null,
        });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  // 중복 제거
  const unique = new Map<string, RestaurantData>();
  for (const r of allResults) {
    const existing = unique.get(r.naver_place_id);
    if (existing) {
      existing.tags = [...new Set([...(existing.tags ?? []), ...(r.tags ?? [])])];
    } else {
      unique.set(r.naver_place_id, r);
    }
  }
  const deduped = [...unique.values()];
  console.log(`\n중복 제거: ${allResults.length} → ${deduped.length}개`);

  // ── 신규 업체 감지 ──
  const newRestaurants = deduped.filter((r) => !existingIds.has(r.naver_place_id));
  if (newRestaurants.length > 0 && existingIds.size > 0) {
    console.log(`\n${'🆕'.repeat(20)}`);
    console.log(`🆕 신규 업체 ${newRestaurants.length}개 발견!`);
    console.log(`${'🆕'.repeat(20)}`);
    for (const r of newRestaurants) {
      console.log(`  📍 ${r.name} (${r.category ?? '기타'}) ★${r.rating ?? '?'} 리뷰${r.visitor_review_count ?? 0}건`);
      console.log(`     ${r.address ?? ''}`);
      if (r.review_keywords?.length) {
        console.log(`     키워드: ${r.review_keywords.slice(0, 3).map((k) => `${k.keyword}(${k.count})`).join(', ')}`);
      }
      console.log(`     ${r.naver_place_url ?? ''}\n`);
    }
  } else if (existingIds.size > 0) {
    console.log('\n✅ 신규 업체 없음 (변동 없음)');
  }

  // DB 저장
  if (deduped.length > 0) {
    const saved = await upsertRestaurants(deduped);
    console.log(`\n💾 ${saved}개 DB 저장`);
  }

  // ── 신규 업체 텔레그램 알림 (키워드별로 분리) ──
  if (existingIds.size > 0) {
    for (const kw of keywords) {
      // 이 키워드 태그가 붙은 신규 업체만 골라냄
      const kwNew = newRestaurants.filter((r) => r.tags?.includes(kw.keyword));
      if (kwNew.length > 0) {
        await notifyNewRestaurants(kwNew, kw.keyword);
      }
    }
  }

  return { newRestaurants, total: deduped.length };
}

// ── Apollo 캐시에서 목록 기본 정보 일괄 추출 ────────────────

async function collectFromApollo(page: Page, query: string): Promise<RestaurantData[]> {
  const allResults: RestaurantData[] = [];
  const seenIds = new Set<string>();

  await page.goto(
    `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`,
    { waitUntil: 'networkidle', timeout: 20_000 },
  );
  await page.waitForTimeout(2500);

  for (let pageNum = 1; pageNum <= 5; pageNum++) {
    // Apollo RestaurantListSummary에서 기본 정보 추출
    const items: RestaurantData[] = await page.evaluate(() => {
      const apollo = (window as any).__APOLLO_STATE__;
      if (!apollo) return [];

      const results: any[] = [];
      for (const [key, val] of Object.entries(apollo) as [string, any][]) {
        const m = key.match(/^RestaurantListSummary:(\d+):/);
        if (!m) continue;

        results.push({
          naver_place_id: m[1],
          name: val.name ?? '',
          address: val.roadAddress
            ? `${val.commonAddress ?? ''} ${val.roadAddress}`.trim()
            : val.address ?? '',
          phone: val.virtualPhone ?? val.phone ?? '',
          category: val.category ?? '',
          latitude: val.y ? parseFloat(val.y) : undefined,
          longitude: val.x ? parseFloat(val.x) : undefined,
          image_url: val.imageUrl ?? '',
          visitor_review_count: parseInt((val.visitorReviewCount ?? '0').replace(/,/g, '')) || 0,
          review_count: parseInt((val.blogCafeReviewCount ?? val.totalReviewCount ?? '0').replace(/,/g, '')) || 0,
          naver_place_url: `https://map.naver.com/p/entry/place/${m[1]}`,
        });
      }
      return results;
    });

    // 새 ID만 추가
    let newCount = 0;
    for (const item of items) {
      if (seenIds.has(item.naver_place_id)) continue;
      seenIds.add(item.naver_place_id);
      item.tags = inferTags(item.category ?? '', item.name);
      item.auto_tags = autoTagRestaurant(item);
      allResults.push(item);
      newCount++;
    }

    console.log(`     페이지 ${pageNum}: ${newCount}개 (누적 ${allResults.length}개)`);

    if (newCount === 0 && pageNum > 1) {
      console.log(`     (새 결과 없음 — 종료)`);
      break;
    }

    // 다음 페이지
    if (pageNum < 5) {
      const nextBtn = await page.$('a:has-text("다음페이지"), button:has-text("다음페이지")');
      if (!nextBtn) { console.log(`     (마지막 페이지)`); break; }

      const prevFirstName = await page.$eval(
        '[class*="TYaxT"]', (el: Element) => el.textContent?.trim() ?? '',
      ).catch(() => '');

      await nextBtn.click();

      // 페이지 변경 대기
      for (let w = 0; w < 10; w++) {
        await page.waitForTimeout(500);
        const newFirstName = await page.$eval(
          '[class*="TYaxT"]', (el: Element) => el.textContent?.trim() ?? '',
        ).catch(() => '');
        if (newFirstName && newFirstName !== prevFirstName) break;
      }
      await page.waitForTimeout(1000);
    }
  }

  return allResults;
}

// ── 홈 탭 상세 정보 수집 (영업시간·홈페이지·메뉴판) ────────

export async function crawlDetailInfo(page: Page, placeId: string): Promise<{
  business_hours?: string;
  business_hours_detail?: string;
  website_url?: string;
  instagram_url?: string;
  menu_items?: Array<{ name: string; price?: string }>;
}> {
  // ── 1. 홈 탭 ──
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/home`, {
    waitUntil: 'networkidle', timeout: 20_000,
  });
  await page.waitForTimeout(2000);

  const homeData = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    // ── 영업시간 ──
    // Apollo state에서 직접 추출
    const apollo = (window as any).__APOLLO_STATE__ ?? {};
    let businessHours = '';
    const hoursByDay: Record<string, string> = {};

    // BusinessHour:xxx 키 파싱
    const dayMap: Record<string, string> = {
      MONDAY: '월', TUESDAY: '화', WEDNESDAY: '수',
      THURSDAY: '목', FRIDAY: '금', SATURDAY: '토', SUNDAY: '일',
    };
    for (const [, val] of Object.entries(apollo) as [string, any][]) {
      if (val?.startTime && val?.endTime && val?.businessHourType === 'NORMAL') {
        const day = dayMap[val.day] ?? val.day;
        if (day) hoursByDay[day] = `${val.startTime}~${val.endTime}`;
      }
    }

    if (Object.keys(hoursByDay).length > 0) {
      // 같은 시간대 묶기
      const grouped: Record<string, string[]> = {};
      for (const [day, time] of Object.entries(hoursByDay)) {
        if (!grouped[time]) grouped[time] = [];
        grouped[time].push(day);
      }
      businessHours = Object.entries(grouped)
        .map(([time, days]) => `${days.join('·')} ${time}`)
        .join(' / ');
    }

    // Fallback: body text에서 실제 시간 패턴(HH:MM~HH:MM)만 추출
    if (!businessHours) {
      // UI 노이즈 제거 키워드
      const NOISE = ['영업 중', '영업종료', '펼쳐보기', '접기', '라스트오더', '브레이크타임', '임시휴업', '정기휴무'];
      // HH:MM~HH:MM 또는 HH시~HH시 패턴이 있는 줄만 수집
      const timePattern = /\d{1,2}[:시]\d{0,2}[분]?\s*~\s*\d{1,2}[:시]\d{0,2}/;
      const dayPattern  = /[월화수목금토일]|매일|평일|주말/;

      const hourLines: string[] = [];
      for (const l of lines) {
        if (NOISE.some(n => l.includes(n))) continue;           // UI 텍스트 제외
        if (!timePattern.test(l) && !dayPattern.test(l)) continue; // 시간/요일 없으면 제외
        if (l.startsWith('http') || l.includes('전화') || l.includes('주소')) continue;
        if (!hourLines.includes(l)) hourLines.push(l);          // 중복 제거
        if (hourLines.length >= 5) break;
      }
      if (hourLines.length > 0) {
        businessHours = hourLines.join(' / ').slice(0, 200);
      }
    }

    // ── 홈페이지·인스타그램 ──
    let websiteUrl = '';
    let instagramUrl = '';

    // Apollo에서 URL 추출
    for (const [, val] of Object.entries(apollo) as [string, any][]) {
      const url: string = val?.url ?? val?.homepageUrl ?? '';
      if (!url.startsWith('http')) continue;
      if (url.includes('instagram.com') && !instagramUrl) instagramUrl = url;
      else if (!url.includes('naver') && !url.includes('kakao') && !websiteUrl) websiteUrl = url;
    }

    // Fallback: body text에서 URL 추출
    if (!instagramUrl || !websiteUrl) {
      const urlRegex = /https?:\/\/[^\s\n\)'"]+/g;
      const found = body.match(urlRegex) ?? [];
      for (const u of found) {
        if (u.includes('instagram.com') && !instagramUrl) instagramUrl = u.replace(/[,.]+$/, '');
        else if (!u.includes('naver') && !u.includes('kakao') && !u.includes('map.') && !websiteUrl) {
          websiteUrl = u.replace(/[,.]+$/, '');
        }
      }
    }

    return {
      business_hours: businessHours || undefined,
      business_hours_detail: Object.keys(hoursByDay).length > 0
        ? JSON.stringify(hoursByDay)
        : undefined,
      website_url: websiteUrl || undefined,
      instagram_url: instagramUrl || undefined,
    };
  });

  // ── 2. 메뉴 탭 ──
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/menu/list`, {
    waitUntil: 'networkidle', timeout: 15_000,
  });
  await page.waitForTimeout(1500);

  const menuItems: Array<{ name: string; price?: string }> = await page.evaluate(() => {
    const apollo = (window as any).__APOLLO_STATE__ ?? {};
    const items: Array<{ name: string; price?: string }> = [];
    const seen = new Set<string>();

    // Apollo에서 Menu:xxx 키 파싱
    for (const [key, val] of Object.entries(apollo) as [string, any][]) {
      if (!key.startsWith('Menu:')) continue;
      const name: string = val?.name ?? '';
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const price = val?.price ? `${Number(val.price).toLocaleString()}원` : undefined;
      items.push({ name, price });
    }

    // Fallback: body text에서 "메뉴명 N,NNN원" 패턴
    if (items.length === 0) {
      const body = document.body.innerText;
      const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length - 1; i++) {
        const name = lines[i];
        const next = lines[i + 1];
        if (name.length < 2 || name.length > 30) continue;
        const priceMatch = next.match(/^[\d,]+원$/);
        if (priceMatch) {
          if (!seen.has(name)) {
            seen.add(name);
            items.push({ name, price: next });
            i++; // 가격 줄 건너뜀
          }
        }
      }
    }

    return items.slice(0, 30);
  });

  return { ...homeData, menu_items: menuItems.length > 0 ? menuItems : undefined };
}

// ── 리뷰 상세 분석 (새로오픈 전용) ─────────────────────────

async function crawlReviews(page: Page, placeId: string): Promise<{
  keywords: ReviewKeyword[];
  menuKeywords: MenuKeyword[];
  summary: Record<string, number>;
  blogReviews: BlogReview[];
}> {
  // ── 방문자 리뷰 페이지 ──
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/review/visitor`, {
    waitUntil: 'networkidle', timeout: 15_000,
  });
  await page.waitForTimeout(2000);

  const visitorData = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    // 키워드 리뷰: "음식이 맛있어요" ... 229 패턴
    const keywords: Array<{ keyword: string; count: number }> = [];
    for (const m of body.matchAll(/"([^"]{4,20})"\s*이 키워드를 선택한 인원\s*(\d+)/g)) {
      keywords.push({ keyword: m[1], count: parseInt(m[2]) });
    }

    // 메뉴/특징 구간을 줄 단위로 정확히 파싱
    // body 예: ...메뉴\n오징어38\n튀김23\n...\n특징\n맛169\n만족도135\n...\n추천순...
    const menuKeywords: Array<{ menu: string; count: number }> = [];
    const summary: Record<string, number> = {};

    let section: 'none' | 'menu' | 'feature' = 'none';
    const skipWords = new Set(['이전', '다음', '리뷰', '안내', '사진', '영상', '더보기', '정렬']);

    for (const line of lines) {
      // 구간 전환 감지
      if (line === '메뉴') { section = 'menu'; continue; }
      if (line === '특징') { section = 'feature'; continue; }
      if (line === '추천순' || line === '최신순') { section = 'none'; continue; }

      // "한글+숫자" 패턴만 추출 (예: "오징어38", "맛169")
      const match = line.match(/^([가-힣\s]+)(\d+)$/);
      if (!match) continue;

      const name = match[1].trim();
      const count = parseInt(match[2]);
      if (!name || name.length > 10 || count < 1) continue;
      if (skipWords.has(name)) continue;

      if (section === 'menu') {
        menuKeywords.push({ menu: name, count });
      } else if (section === 'feature') {
        summary[name] = count;
      }
    }

    return { keywords, menuKeywords, summary };
  });

  // ── 블로그 리뷰 페이지 ──
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/review/ugc`, {
    waitUntil: 'networkidle', timeout: 15_000,
  });
  await page.waitForTimeout(2000);

  const blogReviews: BlogReview[] = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    const reviews: Array<{ title: string; snippet: string; date: string }> = [];

    // 블로그 리뷰 구조:
    // [닉네임] [블로그명] [다음] [제목] [본문...] [yy.mm.dd.요일] [yyyy년 mm월 dd일 ...]
    // 날짜 패턴으로 리뷰 경계를 나누고, 직전 긴 텍스트들에서 제목/본문 추출

    let started = false;
    let buffer: string[] = [];
    const skipPatterns = /^(리뷰|정렬|추천순|최신순|더보기|이전|피드형식|리스트형식|방문자|블로그)/;
    const dateShort = /^\d{2}\.\d{1,2}\.\d{1,2}\.[가-힣]$/;       // 26.4.16.목
    const dateLong = /^\d{4}년 \d{1,2}월 \d{1,2}일/;              // 2026년 4월 16일

    for (const line of lines) {
      if (line.includes('피드형식으로') || line.includes('리스트형식으로')) {
        started = true;
        continue;
      }
      if (!started) continue;

      // 짧은 날짜 = 리뷰 경계 (긴 날짜는 직후에 오므로 스킵)
      if (dateShort.test(line)) {
        // buffer에서 제목(20~80자)과 본문(80자+) 추출
        const title = buffer.find((l) => l.length >= 15 && l.length <= 80) ?? '';
        const snippet = buffer.find((l) => l.length > 80)?.slice(0, 300) ?? '';

        if (title || snippet) {
          reviews.push({ title, snippet, date: line });
        }
        buffer = [];
        continue;
      }
      if (dateLong.test(line)) continue; // 긴 날짜는 스킵

      // 필터링
      if (line.length < 5 || skipPatterns.test(line)) continue;
      if (line === '다음' || line === '이전' || line === '안내') continue;

      buffer.push(line);
    }

    return reviews.slice(0, 5);
  });

  return {
    keywords: visitorData.keywords,
    menuKeywords: visitorData.menuKeywords,
    summary: visitorData.summary,
    blogReviews,
  };
}

// ── 태그 추론 ───────────────────────────────────────────────

function inferTags(category: string, name: string): string[] {
  const text = `${category} ${name}`;
  const tagMap: Record<string, string[]> = {
    '한식': ['한식'], '일식': ['일식', '초밥', '라멘', '돈카츠'],
    '중식': ['중식', '짜장', '짬뽕'], '양식': ['양식', '파스타', '피자', '스테이크'],
    '카페': ['카페', '디저트', '커피'], '분식': ['분식', '떡볶이'],
    '치킨': ['치킨'], '고기': ['고기', '삼겹살', '소고기', '갈비'],
    '해물': ['해물', '회'], '베이커리': ['베이커리', '빵'], '브런치': ['브런치'],
  };
  const tags = new Set<string>();
  for (const [tag, kws] of Object.entries(tagMap)) {
    if (kws.some((kw) => text.includes(kw))) tags.add(tag);
  }
  return [...tags];
}

// ── 실행 모드 ────────────────────────────────────────────────

const args = process.argv.slice(2);
const keywordIdArg = args.find((a) => a.startsWith('--keyword-id='))?.split('=')[1];
const isOnce = args.includes('--once');

async function runWithKeywords(keywords: CrawlKeyword[]) {
  if (!keywords.length) {
    console.log('실행할 키워드가 없습니다.');
    return;
  }
  const allNew: RestaurantData[] = [];
  const existingBefore = await getExistingIds();

  await crawl(keywords);

  // 전체 신규 업체 집계 및 알림 (수동/스케줄러 공통)
  const stats = await getStats();
  // 간이 집계: 키워드 row의 last_new_count 합산
  const { data: updated } = await (await import('@supabase/supabase-js')).createClient(
    process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ).from('crawl_keywords').select('last_new_count').in('id', keywords.map((k) => k.id));
  const newCount = (updated ?? []).reduce((s, r: any) => s + (r.last_new_count ?? 0), 0);

  await notifyDailySummary(stats.total, newCount, keywords.map((k) => k.keyword));
  console.log(`📊 DB 총: ${stats.total}개\n`);
}

if (keywordIdArg) {
  // 수동 실행: 특정 키워드 하나만
  const keywords = await getActiveKeywords({ id: keywordIdArg });
  await runWithKeywords(keywords);
  process.exit(0);
} else if (isOnce) {
  // 즉시 1회 실행: is_daily=true 모든 키워드
  const keywords = await getActiveKeywords({ daily: true });
  await runWithKeywords(keywords);
  process.exit(0);
} else {
  // 스케줄러: 하루 1회 (부팅/잠자기 해제 시 체크)
  const lockFile = new URL('../.last-crawl', import.meta.url).pathname;
  const today = new Date().toISOString().slice(0, 10);

  let lastRun = '';
  try { lastRun = (await import('fs')).readFileSync(lockFile, 'utf-8').trim(); } catch {}

  if (lastRun === today) {
    console.log(`[${today}] 오늘 이미 크롤링 완료. 건너뜀.`);
    process.exit(0);
  }

  const delayMin = Math.floor(Math.random() * 20) + 3;
  console.log(`[${today}] ${delayMin}분 후 크롤링 시작 (봇 감지 회피)`);

  setTimeout(async () => {
    const keywords = await getActiveKeywords({ daily: true });
    await runWithKeywords(keywords);
    (await import('fs')).writeFileSync(lockFile, today);
    console.log('크롤링 완료. 프로세스 종료.');
    process.exit(0);
  }, delayMin * 60 * 1000);
}
