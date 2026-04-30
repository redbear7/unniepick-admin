/**
 * tagger.ts — 창원 맛집 다차원 자동 태그 분류기
 *
 * 크롤링 데이터(카테고리·이름·리뷰키워드·메뉴·영업시간·주소·블로그리뷰)를 분석하여
 * 8개 차원의 구조화된 태그를 자동 부여합니다.
 *
 * 태그 차원 (AutoTags):
 *   foodType        — 음식 유형 (한식, 회·초밥, 고기구이 등)
 *   atmosphere      — 분위기 (데이트, 가족모임, 혼밥 등)
 *   service         — 서비스 특징 (포장가능, 예약가능 등)
 *   facilities      — 편의시설 (주차, 와이파이 등)
 *   priceRange      — 가격대 (1만원미만 / 1-2만원 / 2-3만원 / 3만원이상)
 *   mealTime        — 영업 시간대 (점심, 저녁, 야식 등)
 *   location        — 지역 (마산, 창원, 상남동 등)
 *   characteristics — 특징 (가성비, 인기맛집, 오래된가게 등)
 */
export const AUTO_TAG_DIMENSIONS = {
    foodType: '음식 유형',
    atmosphere: '분위기',
    service: '서비스',
    facilities: '편의시설',
    priceRange: '가격대',
    mealTime: '식사시간',
    location: '지역',
    characteristics: '특징',
};
const FOOD_TYPE_MAP = [
    { tag: '한식', keywords: ['한식', '한정식', '한국식', '전통'] },
    { tag: '일식', keywords: ['일식', '일본식', '이자카야'] },
    { tag: '중식', keywords: ['중식', '중국집', '짜장', '짬뽕', '탕수육', '마라'] },
    { tag: '양식', keywords: ['양식', '이탈리안', '프렌치', '유러피안', '파인다이닝'] },
    { tag: '퓨전', keywords: ['퓨전', '모던한식', '창작'] },
    { tag: '분식', keywords: ['분식', '떡볶이', '순대', '튀김', '어묵', '김밥'] },
    { tag: '카페', keywords: ['카페', '커피', 'cafe', 'coffee', '로스터리'] },
    { tag: '베이커리', keywords: ['베이커리', '빵집', '제과', '파티쉐', '브레드', '빵'] },
    { tag: '치킨', keywords: ['치킨', '프라이드치킨', '양념치킨', '닭강정'] },
    { tag: '피자', keywords: ['피자', 'pizza', '화덕피자'] },
    { tag: '버거', keywords: ['버거', 'burger', '햄버거', '수제버거'] },
    { tag: '회·초밥', keywords: ['회', '초밥', '사시미', '스시', '횟집', '참치회', '광어'] },
    { tag: '해산물', keywords: ['해산물', '해물', '수산', '조개', '굴', '홍합', '대게', '킹크랩'] },
    { tag: '낙지·꼼장어', keywords: ['낙지', '꼼장어', '장어', '연포탕', '주꾸미', '오징어'] },
    { tag: '아귀·복어', keywords: ['아귀', '복어', '아구'] },
    { tag: '고기구이', keywords: ['고기', '구이', '삼겹살', '목살', '오겹살', '한우', '흑돼지', '갈비', '등심', '채끝', '불고기'] },
    { tag: '곱창·막창', keywords: ['곱창', '막창', '대창', '소곱창', '양'] },
    { tag: '보쌈·족발', keywords: ['보쌈', '족발', '수육'] },
    { tag: '닭갈비', keywords: ['닭갈비', '춘천닭갈비', '철판닭갈비'] },
    { tag: '해물찜', keywords: ['해물찜', '아귀찜', '꽃게찜', '킹크랩찜', '대게찜'] },
    { tag: '국밥·탕', keywords: ['국밥', '탕', '설렁탕', '육개장', '감자탕', '해장국', '순대국', '갈비탕', '곰탕', '추어탕', '선지해장국'] },
    { tag: '찌개·전골', keywords: ['찌개', '전골', '부대찌개', '된장찌개', '김치찌개', '순두부', '청국장'] },
    { tag: '면요리', keywords: ['냉면', '국수', '칼국수', '수제비', '라멘', '우동', '파스타', '스파게티', '소바', '라면', '짜장면'] },
    { tag: '찜닭·통닭', keywords: ['찜닭', '통닭', '반계탕', '삼계탕', '닭도리탕'] },
    { tag: '돈카츠', keywords: ['돈카츠', '가스', '경양식'] },
    { tag: '스테이크', keywords: ['스테이크', '등심스테이크', '안심스테이크', '그릴'] },
    { tag: '샐러드·건강식', keywords: ['샐러드', '건강식', '채식', '비건', '글루텐프리', '유기농'] },
    { tag: '디저트', keywords: ['디저트', '케이크', '마카롱', '빙수', '아이스크림', '타르트', '크로플', '와플', '쿠키', '티라미수'] },
    { tag: '주점', keywords: ['이자카야', '선술집', '포차', '호프', '맥주', '술집', '와인바', '칵테일바'] },
];
const ATMOSPHERE_MAP = [
    { tag: '데이트', keywords: ['데이트', '커플', '분위기좋은', '로맨틱', '예쁜', '아늑한'] },
    { tag: '가족모임', keywords: ['가족', '패밀리', '어르신', '아이', '아기', '유아', '키즈'] },
    { tag: '단체모임', keywords: ['단체', '모임', '대관', '단체석', '룸'] },
    { tag: '혼밥', keywords: ['혼밥', '혼자', '1인석', '혼밥가능'] },
    { tag: '회식', keywords: ['회식', '직장', '회사', '비즈니스'] },
    { tag: '조용한', keywords: ['조용', '한적', '프라이빗', '여유로운'] },
    { tag: '인스타감성', keywords: ['인스타', '감성', '힙한', '트렌디', '사진맛집', '포토존'] },
    { tag: '뷰맛집', keywords: ['뷰', '전망', '오션뷰', '야경', '바다뷰', '경치'] },
    { tag: '야외', keywords: ['야외', '테라스', '정원', '루프탑'] },
    { tag: '레트로', keywords: ['레트로', '옛날', '복고', '빈티지', '노포'] },
    { tag: '모던', keywords: ['모던', '세련된', '인테리어', '고급스러운'] },
];
const SERVICE_MAP = [
    { tag: '친절한', keywords: ['친절', '서비스좋은', '응대'] },
    { tag: '포장가능', keywords: ['포장', '테이크아웃', 'takeout', 'to-go'] },
    { tag: '예약가능', keywords: ['예약', '예약제', '사전예약'] },
    { tag: '배달가능', keywords: ['배달', '딜리버리', '배달의민족', '쿠팡이츠'] },
    { tag: '단체예약', keywords: ['단체예약', '대관', '행사'] },
    { tag: '줄서는집', keywords: ['웨이팅', '대기', '줄서', '인기'] },
    { tag: '빠른응대', keywords: ['빠른', '신속', '빠름'] },
];
const FACILITIES_MAP = [
    { tag: '주차', keywords: ['주차', '주차장', '주차가능', '발레파킹'] },
    { tag: '와이파이', keywords: ['와이파이', 'wifi', 'wi-fi', '인터넷'] },
    { tag: '반려동물', keywords: ['반려동물', '애견', '펫', '강아지동반', '고양이동반'] },
    { tag: '어린이의자', keywords: ['유아의자', '어린이의자', '아기의자', '하이체어', '키즈'] },
    { tag: '단체룸', keywords: ['단체룸', '프라이빗룸', '개인룸', '룸식', '독립공간'] },
    { tag: '콘센트', keywords: ['콘센트', '충전', '노트북가능', '작업가능'] },
    { tag: '흡연구역', keywords: ['흡연', '흡연가능', '흡연석', '흡연부스'] },
];
const LOCATION_MAP = [
    // 광역
    { tag: '마산', keywords: ['마산', '마산합포', '마산회원', '합포구', '회원구'] },
    { tag: '창원', keywords: ['창원', '의창구', '성산구'] },
    { tag: '진해', keywords: ['진해', '진해구'] },
    // 창원 상권
    { tag: '상남동', keywords: ['상남동', '상남'] },
    { tag: '중앙동', keywords: ['중앙동', '중앙로'] },
    { tag: '팔용동', keywords: ['팔용동', '팔용'] },
    { tag: '반송동', keywords: ['반송동', '반송'] },
    { tag: '신월동', keywords: ['신월동', '신월'] },
    { tag: '용호동', keywords: ['용호동', '용호'] },
    // 마산 상권
    { tag: '오동동', keywords: ['오동동', '오동'] },
    { tag: '창동', keywords: ['창동', '창동골목', '창동예술'] },
    { tag: '마산어시장', keywords: ['어시장', '수산시장', '마산어시장'] },
    { tag: '합포동', keywords: ['합포동', '합포'] },
    { tag: '회성동', keywords: ['회성동', '회성'] },
    { tag: '합성동', keywords: ['합성동', '합성'] },
    // 진해 상권
    { tag: '경화동', keywords: ['경화동', '경화'] },
    { tag: '진해시장', keywords: ['진해시장', '진해중앙시장'] },
];
const CHARACTERISTIC_MAP = [
    { tag: '오래된가게', keywords: ['오래된', '역사', '노포', '30년', '40년', '50년', '20년', '전통'] },
    { tag: 'SNS핫플', keywords: ['인스타', '핫플', '유명한', 'sns', '방송'] },
    { tag: '가성비', keywords: ['가성비', '저렴한', '합리적', '양많은', '푸짐한'] },
    { tag: '프리미엄', keywords: ['프리미엄', '고급', '럭셔리', '파인다이닝'] },
    { tag: '재료신선', keywords: ['신선한', '당일', '직접', '국내산', '제철', '직송'] },
    { tag: '수제', keywords: ['수제', '직접만든', '홈메이드', '핸드메이드'] },
    { tag: '건강식', keywords: ['건강', '유기농', '저칼로리', '다이어트', '채식'] },
    { tag: '인기맛집', keywords: ['맛집', '유명', '인기많은', '맛있는', '줄서는'] },
    { tag: '로컬맛집', keywords: ['로컬', '현지', '동네', '단골'] },
];
/* ------------------------------------------------------------------ */
/* 헬퍼                                                                  */
/* ------------------------------------------------------------------ */
function matchKeywords(text, map) {
    const lower = text.toLowerCase();
    const matched = [];
    for (const { tag, keywords } of map) {
        if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
            matched.push(tag);
        }
    }
    return matched;
}
function kwText(reviewKws, menuKws) {
    return [
        ...reviewKws.map((k) => k.keyword),
        ...menuKws.map((k) => k.menu),
    ].join(' ');
}
function blogText(blogReviews) {
    return blogReviews.map((b) => `${b.title} ${b.snippet}`).join(' ');
}
/* ------------------------------------------------------------------ */
/* 차원별 추론 함수                                                       */
/* ------------------------------------------------------------------ */
function inferFoodType(category, name, reviewKws, menuKws) {
    const text = `${category} ${name} ${kwText(reviewKws, menuKws)}`;
    return [...new Set(matchKeywords(text, FOOD_TYPE_MAP))];
}
function inferAtmosphere(reviewKws, reviewSummary, blogReviews) {
    const text = `${kwText(reviewKws, [])} ${Object.keys(reviewSummary).join(' ')} ${blogText(blogReviews)}`;
    return [...new Set(matchKeywords(text, ATMOSPHERE_MAP))];
}
function inferService(reviewKws, reviewSummary) {
    const text = `${kwText(reviewKws, [])} ${Object.keys(reviewSummary).join(' ')}`;
    return [...new Set(matchKeywords(text, SERVICE_MAP))];
}
function inferFacilities(reviewKws, reviewSummary, blogReviews) {
    const text = `${kwText(reviewKws, [])} ${Object.keys(reviewSummary).join(' ')} ${blogText(blogReviews)}`;
    return [...new Set(matchKeywords(text, FACILITIES_MAP))];
}
function inferPriceRange(menuItems) {
    const prices = [];
    for (const item of menuItems) {
        if (!item.price)
            continue;
        const num = parseInt(item.price.replace(/[^0-9]/g, ''), 10);
        if (num > 500 && num < 500_000)
            prices.push(num);
    }
    if (!prices.length)
        return [];
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    if (avg < 10_000)
        return ['1만원미만'];
    if (avg < 20_000)
        return ['1-2만원'];
    if (avg < 30_000)
        return ['2-3만원'];
    return ['3만원이상'];
}
function inferMealTime(businessHours) {
    if (!businessHours)
        return [];
    const tags = [];
    // "HH:MM~HH:MM" 패턴 추출
    const ranges = [...businessHours.matchAll(/(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})/g)];
    for (const m of ranges) {
        const openMin = parseInt(m[1]) * 60 + parseInt(m[2]);
        const closeMin = parseInt(m[3]) * 60 + parseInt(m[4]);
        if (openMin <= 9 * 60)
            tags.push('아침');
        if (openMin <= 12 * 60 && closeMin >= 13 * 60)
            tags.push('점심');
        if (closeMin >= 17 * 60)
            tags.push('저녁');
        if (closeMin >= 22 * 60 || closeMin <= 4 * 60)
            tags.push('야식');
        if (openMin >= 9 * 60 && openMin <= 11 * 60 && closeMin <= 17 * 60)
            tags.push('브런치');
        if (openMin <= 7 * 60)
            tags.push('새벽영업');
    }
    if (/24시간|24시|연중무휴/.test(businessHours))
        tags.push('24시간');
    return [...new Set(tags)];
}
function inferLocation(address) {
    if (!address)
        return [];
    return [...new Set(matchKeywords(address, LOCATION_MAP))];
}
function inferCharacteristics(r, reviewKws, blogReviews) {
    const allText = [
        r.name,
        r.category ?? '',
        ...reviewKws.map((k) => k.keyword),
        ...Object.keys(r.review_summary ?? {}),
        ...blogReviews.map((b) => `${b.title} ${b.snippet}`),
    ].join(' ');
    const tags = [...new Set(matchKeywords(allText, CHARACTERISTIC_MAP))];
    if (r.is_new_open)
        tags.push('신규오픈');
    return [...new Set(tags)];
}
/* ------------------------------------------------------------------ */
/* 메인 자동 태그 함수                                                    */
/* ------------------------------------------------------------------ */
export function autoTagRestaurant(r) {
    const reviewKws = r.review_keywords ?? [];
    const menuKws = r.menu_keywords ?? [];
    const menuItems = r.menu_items ?? [];
    const summary = r.review_summary ?? {};
    const blogReviews = r.blog_reviews ?? [];
    return {
        foodType: inferFoodType(r.category ?? '', r.name, reviewKws, menuKws),
        atmosphere: inferAtmosphere(reviewKws, summary, blogReviews),
        service: inferService(reviewKws, summary),
        facilities: inferFacilities(reviewKws, summary, blogReviews),
        priceRange: inferPriceRange(menuItems),
        mealTime: inferMealTime(r.business_hours ?? ''),
        location: inferLocation(r.address ?? ''),
        characteristics: inferCharacteristics(r, reviewKws, blogReviews),
    };
}
/** AutoTags → 1차원 flat 배열 (검색·필터용) */
export function flattenAutoTags(tags) {
    return Object.values(tags).flat();
}
