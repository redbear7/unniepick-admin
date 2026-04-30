/**
 * 카카오 로컬 API 기반 업체 수집
 *
 * 네이버 스크래핑 대체 — 브라우저 없음, IP 차단 위험 없음
 *
 * 사용법:
 *   npm run crawl:kakao                             # is_daily=true 키워드 전체
 *   npm run crawl:kakao -- --keyword-id=<uuid>      # 특정 키워드 1개
 *   npm run crawl:kakao -- --once                   # 1회 즉시 실행 후 종료
 *   npm run crawl:kakao -- --once --limit=30        # 키워드당 최대 30개
 *
 * 프록시:
 *   PROXY_URL=http://user:pass@host:port npm run crawl:kakao -- --once
 *   PROXY_LIST=http://p1:port,http://p2:port npm run crawl:kakao -- --once
 */
import 'dotenv/config';
import { upsertKakaoRestaurants, getStats, getExistingKakaoIds, getActiveKeywords, updateKeywordStatus, } from './storage.js';
import { searchKakaoAll } from './kakao-search.js';
import { kakaoMidCategory, normalizeToUnniepick } from './category-map.js';
import { autoTagRestaurant } from './tagger.js';
import { notifyNewRestaurants, notifyDailySummary } from './notify.js';
import { humanDelay, createTimer } from './human-delay.js';
// ── KakaoPlace → KakaoRestaurantData 변환 ─────────────────────────────────────────
function kakaoToRestaurant(place) {
    // kakao_category: 원본 전체 경로 보존 (예: "음식점 > 한식 > 설렁탕,국밥")
    // category:       중간 뎁스 (예: "한식")  — 사람이 읽을 수 있는 수준
    // unniepick_category: 언니픽 고정 카테고리 (예: "한식")
    const category = kakaoMidCategory(place.category_group_code, place.category_name);
    const unniepick_category = normalizeToUnniepick(category);
    const lat = parseFloat(place.y) || undefined;
    const lng = parseFloat(place.x) || undefined;
    const data = {
        kakao_place_id: place.id,
        kakao_place_url: place.place_url,
        kakao_category: place.category_name, // 원본 전체 경로
        source: 'kakao',
        name: place.place_name,
        address: place.road_address_name || place.address_name || '',
        phone: place.phone || '',
        category,
        unniepick_category,
        latitude: lat,
        longitude: lng,
        tags: [],
    };
    data.tags = inferTags(category, place.place_name);
    data.auto_tags = autoTagRestaurant(data);
    return data;
}
// ── 태그 추론 (main.ts 동일 로직) ────────────────────────────────────────────
function inferTags(category, name) {
    const text = `${category} ${name}`;
    const tagMap = {
        '한식': ['한식'], '일식': ['일식', '초밥', '라멘', '돈카츠'],
        '중식': ['중식', '짜장', '짬뽕'], '양식': ['양식', '파스타', '피자', '스테이크'],
        '카페': ['카페', '디저트', '커피'], '분식': ['분식', '떡볶이'],
        '치킨': ['치킨'], '고기': ['고기', '삼겹살', '소고기', '갈비'],
        '해물': ['해물', '회'], '베이커리': ['베이커리', '빵'], '브런치': ['브런치'],
    };
    const tags = new Set();
    for (const [tag, kws] of Object.entries(tagMap)) {
        if (kws.some(kw => text.includes(kw)))
            tags.add(tag);
    }
    return [...tags];
}
// ── 키워드 1개 수집 ───────────────────────────────────────────────────────────
async function collectByKeyword(kw) {
    const timer = createTimer(`"${kw.keyword}"`);
    const limitLabel = limitArg > 0 ? ` (최대 ${limitArg}개)` : '';
    timer.log(`카카오 검색: "${kw.keyword}"${limitLabel}`);
    const places = await searchKakaoAll(kw.keyword, {
        maxPages: limitArg > 0 ? Math.ceil(limitArg / 15) : 5,
        delayMs: 600,
        ...(limitArg > 0 ? { limit: limitArg } : {}),
    });
    timer.done(places.length, 0);
    return places.map(p => {
        const r = kakaoToRestaurant(p);
        r.tags = [...(r.tags ?? []), kw.keyword];
        return r;
    });
}
// ── 메인 크롤링 ───────────────────────────────────────────────────────────────
async function crawl(keywords) {
    const globalTimer = createTimer('카카오 전체 크롤링');
    console.log(`\n${'='.repeat(54)}`);
    console.log(`[${new Date().toLocaleString('ko-KR')}] 카카오 API 크롤링 시작 (${keywords.length}개 키워드)`);
    console.log(`키워드 ${keywords.length}개 · 인간형 랜덤 딜레이 적용`);
    console.log(`${'='.repeat(54)}`);
    const existingIds = await getExistingKakaoIds();
    globalTimer.log(`기존 DB (카카오): ${existingIds.size}개`);
    const allResults = [];
    for (const kw of keywords) {
        await updateKeywordStatus(kw.id, { status: 'running', last_error: undefined });
        try {
            const restaurants = await collectByKeyword(kw);
            const newCount = restaurants.filter(r => r.kakao_place_id && !existingIds.has(r.kakao_place_id)).length;
            allResults.push(...restaurants);
            await updateKeywordStatus(kw.id, {
                status: 'success',
                last_crawled_at: new Date().toISOString(),
                last_result_count: restaurants.length,
                last_new_count: existingIds.size > 0 ? newCount : 0,
                current_pid: null,
            });
            globalTimer.log(`✓ "${kw.keyword}" 완료 (${restaurants.length}개, 신규 ${newCount}개)`);
        }
        catch (e) {
            globalTimer.log(`✗ "${kw.keyword}" 실패: ${e.message}`);
            await updateKeywordStatus(kw.id, {
                status: 'failed',
                last_error: e.message,
                last_crawled_at: new Date().toISOString(),
                current_pid: null,
            });
        }
        // 키워드 간 인간형 딜레이 (3~7초)
        if (keywords.indexOf(kw) < keywords.length - 1) {
            await humanDelay(3000, 7000);
        }
    }
    // ── 중복 제거 (같은 카카오 ID) ─────────────────────────────────────────────
    const unique = new Map();
    for (const r of allResults) {
        const key = r.kakao_place_id ?? '';
        if (!key)
            continue;
        const existing = unique.get(key);
        if (existing) {
            existing.tags = [...new Set([...(existing.tags ?? []), ...(r.tags ?? [])])];
        }
        else {
            unique.set(key, r);
        }
    }
    const deduped = [...unique.values()];
    globalTimer.log(`중복 제거: ${allResults.length} → ${deduped.length}개`);
    // ── 신규 업체 감지 ───────────────────────────────────────────────────────────
    const newRestaurants = deduped.filter(r => r.kakao_place_id && !existingIds.has(r.kakao_place_id));
    if (newRestaurants.length > 0 && existingIds.size > 0) {
        console.log(`\n🆕 신규 업체 ${newRestaurants.length}개!`);
        for (const r of newRestaurants) {
            console.log(`  📍 ${r.name} (${r.category ?? '기타'}) — ${r.address ?? ''}`);
        }
    }
    else if (existingIds.size > 0) {
        console.log('\n✅ 신규 업체 없음');
    }
    // ── DB 저장 ──────────────────────────────────────────────────────────────────
    if (deduped.length > 0) {
        const saved = await upsertKakaoRestaurants(deduped);
        globalTimer.log(`💾 ${saved}개 DB 저장`);
    }
    // ── 텔레그램 알림 ────────────────────────────────────────────────────────────
    if (existingIds.size > 0) {
        for (const kw of keywords) {
            const kwNew = newRestaurants.filter(r => r.tags?.includes(kw.keyword));
            if (kwNew.length > 0)
                await notifyNewRestaurants(kwNew, kw.keyword);
        }
    }
    globalTimer.done(deduped.length, newRestaurants.length);
    return { newRestaurants, total: deduped.length };
}
// ── 실행 진입점 ──────────────────────────────────────────────────────────────
async function runWithKeywords(keywords) {
    if (!keywords.length) {
        console.log('실행할 키워드가 없습니다.');
        return;
    }
    await crawl(keywords);
    const stats = await getStats();
    const { data: updated } = await (await import('@supabase/supabase-js')).createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY).from('crawl_keywords').select('last_new_count').in('id', keywords.map(k => k.id));
    const newCount = (updated ?? []).reduce((s, r) => s + (r.last_new_count ?? 0), 0);
    await notifyDailySummary(stats.total, newCount, keywords.map(k => k.keyword));
    console.log(`📊 DB 총: ${stats.total}개\n`);
}
const args = process.argv.slice(2);
const keywordIdArg = args.find(a => a.startsWith('--keyword-id='))?.split('=')[1];
const isOnce = args.includes('--once');
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || 0;
if (keywordIdArg) {
    const keywords = await getActiveKeywords({ id: keywordIdArg });
    await runWithKeywords(keywords);
    process.exit(0);
}
else if (isOnce) {
    const keywords = await getActiveKeywords({ daily: true });
    await runWithKeywords(keywords);
    process.exit(0);
}
else {
    // 스케줄러 모드
    const lockFile = new URL('../.last-kakao-crawl', import.meta.url).pathname;
    const today = new Date().toISOString().slice(0, 10);
    let lastRun = '';
    try {
        lastRun = (await import('fs')).readFileSync(lockFile, 'utf-8').trim();
    }
    catch { }
    if (lastRun === today) {
        console.log(`[${today}] 오늘 이미 카카오 크롤링 완료. 건너뜀.`);
        process.exit(0);
    }
    const delayMin = Math.floor(Math.random() * 10) + 2;
    console.log(`[${today}] ${delayMin}분 후 카카오 크롤링 시작`);
    setTimeout(async () => {
        const keywords = await getActiveKeywords({ daily: true });
        await runWithKeywords(keywords);
        (await import('fs')).writeFileSync(lockFile, today);
        process.exit(0);
    }, delayMin * 60 * 1000);
}
