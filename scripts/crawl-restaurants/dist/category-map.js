/**
 * 언니픽 업종 카테고리 정규화
 *
 * 네이버 / 카카오 각각의 raw category 값을 언니픽 고정 카테고리 12개 중 하나로 통일.
 * 수집 시점(kakao-main.ts, main.ts)과 관리자 페이지에서 모두 이 파일을 참조.
 *
 * raw category 흐름:
 *   [카카오] category_name("음식점 > 한식 > 설렁탕") ──► kakaoMidCategory() ──► "한식"
 *   [네이버] Apollo val.category("한식")                                    ──► "한식"
 *   ──────────────────────────────────────────────────────────────────────────────────
 *   두 소스 모두  normalizeToUnniepick("한식") ──► "한식" (UnniepickCategory)
 */
// ── 언니픽 고정 카테고리 ─────────────────────────────────────────────────────
export const UNNIEPICK_CATEGORIES = [
    '한식',
    '일식',
    '중식',
    '양식',
    '카페',
    '베이커리',
    '분식',
    '치킨·피자',
    '고기·구이',
    '해산물·회',
    '술집·바',
    '기타',
];
// ── 매핑 규칙 (순서가 우선순위) ───────────────────────────────────────────────
// 앞쪽 규칙이 이길 때까지 순서대로 검사.
// 중복되는 키워드(예: 초밥)는 의도한 카테고리 규칙을 먼저 배치.
const RULES = [
    {
        result: '카페',
        keywords: ['카페', '커피', '디저트', '브런치', '티하우스', '찻집', '테이크아웃커피'],
    },
    {
        result: '베이커리',
        keywords: ['베이커리', '빵', '제과', '케이크', '도넛', '파티쉐', '크루아상'],
    },
    {
        result: '분식',
        keywords: ['분식', '떡볶이', '순대', '김밥', '라면', '만두', '튀김', '오뎅', '포장마차'],
    },
    {
        result: '치킨·피자',
        keywords: ['치킨', '피자', '버거', '햄버거', '패스트푸드', '핫도그', '샌드위치'],
    },
    {
        result: '고기·구이',
        keywords: ['고기', '구이', '삼겹살', '갈비', '바비큐', 'bbq', '곱창', '막창', '불고기', '보쌈', '족발'],
    },
    {
        result: '해산물·회',
        keywords: ['회', '해물', '해산물', '수산', '낙지', '조개', '굴', '새우', '랍스터', '대게', '꽃게'],
    },
    {
        result: '술집·바',
        keywords: ['술집', '바', '포차', '이자카야', '호프', '맥주', '와인바', '칵테일', '펍'],
    },
    {
        result: '일식',
        keywords: ['일식', '초밥', '롤', '라멘', '우동', '소바', '돈카츠', '돈부리', '덮밥', '텐동', '오마카세'],
    },
    {
        result: '중식',
        keywords: ['중식', '중국', '짜장', '짬뽕', '딤섬', '마라', '탕수육', '양꼬치'],
    },
    {
        result: '양식',
        keywords: ['양식', '파스타', '리조또', '스테이크', '이탈리안', '프렌치', '스파게티', '그릴'],
    },
    {
        result: '한식',
        keywords: [
            '한식', '설렁탕', '국밥', '비빔밥', '된장', '순두부', '해장국', '쌈밥',
            '냉면', '칼국수', '수육', '두부', '솥밥', '백반', '정식', '보리밥',
        ],
    },
];
/**
 * 원본 카테고리 문자열 → 언니픽 카테고리
 *
 * @param raw  네이버 Apollo category 또는 kakaoMidCategory() 결과
 * @returns    UnniepickCategory (항상 12개 중 하나)
 */
export function normalizeToUnniepick(raw) {
    if (!raw)
        return '기타';
    const text = raw.toLowerCase().replace(/\s/g, '');
    for (const { result, keywords } of RULES) {
        if (keywords.some(kw => text.includes(kw.toLowerCase().replace(/\s/g, '')))) {
            return result;
        }
    }
    return '기타';
}
// ── 카카오 전용: category_name 중간 뎁스 추출 ────────────────────────────────
// "음식점 > 한식 > 설렁탕,국밥"  →  "한식"   (2번째 뎁스)
// "카페 > 디저트카페"            →  "카페"   (CE7 groupCode 우선)
// "음식점 > 고기,구이"           →  "고기,구이"
export function kakaoMidCategory(groupCode, categoryName) {
    if (groupCode === 'CE7')
        return '카페';
    const parts = categoryName.split('>').map(s => s.trim()).filter(Boolean);
    // 2뎁스가 있으면 반환, 없으면 1뎁스
    return parts[1] ?? parts[0] ?? '기타';
}
