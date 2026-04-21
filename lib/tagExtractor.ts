/**
 * tagExtractor.ts
 * 크롤링 데이터 → 빅데이터 태그 자동 추출 (규칙 기반 v1)
 *
 * 18개 카테고리:
 *   업종 | 세부업종 | 메뉴 | 메뉴특성 | 주재료 | 요리방식
 *   가격대 | 분위기 | 인테리어 | 방문목적 | 동행 | 연령대
 *   운영 | 시설 | 음식특성 | 위치특성 | 계절 | 트렌드
 *
 * Phase 2: Vision AI(사진 분석) + NLP 리뷰 감성분석 추가 예정
 */

// ══════════════════════════════════════════════════════════════════
//  타입
// ══════════════════════════════════════════════════════════════════
export interface TagsV2 {
  업종?:     string[];
  세부업종?:  string[];
  메뉴?:     string[];
  메뉴특성?:  string[];
  주재료?:   string[];
  요리방식?:  string[];
  가격대?:   string;
  분위기?:   string[];
  인테리어?:  string[];
  방문목적?:  string[];
  동행?:     string[];
  연령대?:   string[];
  운영?:     string[];
  시설?:     string[];
  음식특성?:  string[];
  위치특성?:  string[];
  계절?:     string[];
  트렌드?:   string[];
  신뢰도?:   number;  // 0~1
}

export interface RestaurantForTagging {
  name:                 string;
  category:             string | null;
  address:              string | null;
  business_hours:       string | null;
  menu_items:           Array<{ name: string; price?: string }> | string | null;
  tags:                 string[] | null;          // 기존 크롤링 태그
  review_keywords:      Array<{ keyword: string; count: number }> | string | null;
  menu_keywords:        Array<{ menu: string; count: number }> | string | null;
  review_summary:       Record<string, number> | string | null;
  visitor_review_count: number;
  is_new_open:          boolean | null;
  instagram_url:        string | null;
}

// ══════════════════════════════════════════════════════════════════
//  내부 유틸
// ══════════════════════════════════════════════════════════════════
function parseJsonField<T>(field: T | string | null, fallback: T): T {
  if (!field) return fallback;
  if (typeof field !== 'string') return field as T;
  try { return JSON.parse(field) as T; } catch { return fallback; }
}

function includes(text: string, ...words: string[]): boolean {
  return words.some(w => text.includes(w));
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// ══════════════════════════════════════════════════════════════════
//  업종 / 세부업종
// ══════════════════════════════════════════════════════════════════
function detectCategory(cat: string | null, name: string): { 업종: string[]; 세부업종: string[] } {
  const t = `${cat ?? ''} ${name}`.toLowerCase();
  const 업종: string[] = [];
  const 세부업종: string[] = [];

  if (includes(t, '카페', '커피', '에스프레소', '핸드드립', '스페셜티')) {
    업종.push('카페');
    if (includes(t, '브런치')) 세부업종.push('브런치카페');
    if (includes(t, '루프탑')) 세부업종.push('루프탑카페');
    if (includes(t, '디저트')) 세부업종.push('디저트카페');
    if (includes(t, '스터디', '독서')) 세부업종.push('스터디카페');
  }
  if (includes(t, '베이커리', '빵집', '제과', '빵', '크루아상', '소금빵')) {
    업종.push('베이커리');
  }
  if (includes(t, '디저트', '마카롱', '타르트', '와플', '케이크', '도넛')) {
    업종.push('디저트');
    if (includes(t, '빙수')) 세부업종.push('빙수전문');
    if (includes(t, '아이스크림')) 세부업종.push('아이스크림');
  }

  if (includes(t, '한식', '국밥', '설렁탕', '갈비', '삼겹살', '냉면',
    '보쌈', '족발', '찜닭', '낙지', '조개구이', '생선구이', '쌈밥',
    '비빔밥', '순대', '해장국', '곱창', '매운탕', '굴밥', '밥집')) {
    업종.push('한식');
    if (includes(t, '냉면')) 세부업종.push('냉면전문');
    if (includes(t, '삼겹살', '돼지고기구이')) 세부업종.push('삼겹살');
    if (includes(t, '국밥', '설렁탕', '해장국')) 세부업종.push('국밥·해장국');
    if (includes(t, '갈비', '갈비집')) 세부업종.push('갈비');
    if (includes(t, '낙지', '주꾸미')) 세부업종.push('낙지·주꾸미');
    if (includes(t, '곱창', '막창')) 세부업종.push('곱창·막창');
    if (includes(t, '조개', '조개구이')) 세부업종.push('조개구이');
    if (includes(t, '회', '횟집', '활어')) 세부업종.push('횟집');
  }

  if (includes(t, '일식', '초밥', '스시', '라멘', '돈카츠', '가츠',
    '이자카야', '오마카세', '타코야키', '야키토리', '텐동')) {
    업종.push('일식');
    if (includes(t, '라멘')) 세부업종.push('라멘');
    if (includes(t, '초밥', '스시')) 세부업종.push('초밥·스시');
    if (includes(t, '이자카야')) 세부업종.push('이자카야');
    if (includes(t, '오마카세')) 세부업종.push('오마카세');
    if (includes(t, '돈카츠', '가츠')) 세부업종.push('돈카츠');
  }

  if (includes(t, '중식', '중국집', '짬뽕', '짜장', '탕수육', '마라',
    '딤섬', '만두', '훠궈')) {
    업종.push('중식');
    if (includes(t, '마라', '마라탕')) 세부업종.push('마라탕·마라샹궈');
    if (includes(t, '딤섬')) 세부업종.push('딤섬');
  }

  if (includes(t, '양식', '파스타', '피자', '스테이크', '이탈리안', '프렌치',
    '리조또', '뇨키', '버거', '햄버거', '샌드위치')) {
    업종.push('양식');
    if (includes(t, '파스타', '이탈리안')) 세부업종.push('이탈리안');
    if (includes(t, '스테이크')) 세부업종.push('스테이크');
    if (includes(t, '버거', '햄버거')) 세부업종.push('수제버거');
  }

  if (includes(t, '치킨', '통닭', '프라이드')) {
    업종.push('치킨');
    if (includes(t, '양념')) 세부업종.push('양념치킨');
    if (includes(t, '마늘', '간장')) 세부업종.push('간장·마늘치킨');
  }

  if (includes(t, '분식', '떡볶이', '순대', '김밥', '라면', '핫도그')) {
    업종.push('분식');
    if (includes(t, '떡볶이')) 세부업종.push('떡볶이전문');
  }

  if (includes(t, '술집', '호프', '포차', '맥주', '와인바', '칵테일')) {
    업종.push('술집·바');
    if (includes(t, '와인')) 세부업종.push('와인바');
    if (includes(t, '칵테일', '바')) 세부업종.push('칵테일바');
    if (includes(t, '막걸리', '포차')) 세부업종.push('포차·막걸리');
  }

  if (includes(t, '미용실', '헤어', '헤어샵', '미용')) {
    업종.push('미용실');
    if (includes(t, '커트')) 세부업종.push('커트전문');
    if (includes(t, '펌')) 세부업종.push('펌전문');
    if (includes(t, '염색')) 세부업종.push('염색전문');
  }

  if (includes(t, '네일', '젤네일', '아크릴')) {
    업종.push('네일샵');
    if (includes(t, '젤')) 세부업종.push('젤네일');
    if (includes(t, '아트')) 세부업종.push('네일아트');
    if (includes(t, '풋', '발')) 세부업종.push('풋케어');
  }

  if (includes(t, '피부', '에스테틱', '마사지', '왁싱', '속눈썹')) {
    업종.push('피부·뷰티');
    if (includes(t, '왁싱')) 세부업종.push('왁싱');
    if (includes(t, '속눈썹')) 세부업종.push('속눈썹');
  }

  if (includes(t, '헬스', '피트니스', '요가', '필라테스', '크로스핏', '수영')) {
    업종.push('헬스·운동');
    if (includes(t, '요가')) 세부업종.push('요가');
    if (includes(t, '필라테스')) 세부업종.push('필라테스');
  }

  if (업종.length === 0) 업종.push('기타');
  return { 업종: unique(업종), 세부업종: unique(세부업종) };
}

// ══════════════════════════════════════════════════════════════════
//  메뉴 관련 태그
// ══════════════════════════════════════════════════════════════════
function detectMenuTags(
  menus: Array<{ name: string; price?: string }>,
  menuKeywords: Array<{ menu: string; count: number }>,
) {
  const allMenuText = [
    ...menus.map(m => m.name),
    ...menuKeywords.map(m => m.menu),
  ].join(' ').toLowerCase();

  const 메뉴: string[] = menus.slice(0, 15).map(m => m.name).filter(Boolean);
  const 주재료: string[] = [];
  const 요리방식: string[] = [];
  const 메뉴특성: string[] = [];

  // 주재료
  if (includes(allMenuText, '소고기', '한우', '와규', '등심', '갈비')) 주재료.push('소고기');
  if (includes(allMenuText, '돼지고기', '삼겹살', '목살', '항정살', '갈매기살')) 주재료.push('돼지고기');
  if (includes(allMenuText, '닭', '치킨', '닭발', '닭볶음')) 주재료.push('닭고기');
  if (includes(allMenuText, '새우', '왕새우', '대하')) 주재료.push('새우');
  if (includes(allMenuText, '게', '꽃게', '대게', '킹크랩')) 주재료.push('게');
  if (includes(allMenuText, '낙지', '주꾸미', '문어')) 주재료.push('낙지·문어');
  if (includes(allMenuText, '굴', '조개', '바지락', '전복')) 주재료.push('조개류');
  if (includes(allMenuText, '연어', '참치', '광어', '도미')) 주재료.push('생선회');
  if (includes(allMenuText, '두부', '순두부')) 주재료.push('두부');
  if (includes(allMenuText, '버섯', '송이', '표고')) 주재료.push('버섯');
  if (includes(allMenuText, '트러플')) 주재료.push('트러플');

  // 요리방식
  if (includes(allMenuText, '구이', '구운', '그릴', '바베큐', 'bbq', '화덕')) 요리방식.push('구이');
  if (includes(allMenuText, '찜', '수육', '보쌈')) 요리방식.push('찜');
  if (includes(allMenuText, '튀김', '프라이드', '바삭')) 요리방식.push('튀김');
  if (includes(allMenuText, '볶음', '볶아', '볶은')) 요리방식.push('볶음');
  if (includes(allMenuText, '국', '탕', '찌개', '전골', '국물')) 요리방식.push('국물요리');
  if (includes(allMenuText, '회', '생', '날것', '초밥', '스시')) 요리방식.push('날것(회·생)');
  if (includes(allMenuText, '발효', '된장', '청국장', '간장')) 요리방식.push('발효');
  if (includes(allMenuText, '훈제')) 요리방식.push('훈제');
  if (includes(allMenuText, '저온')) 요리방식.push('저온조리');

  // 메뉴특성 (맛·질감)
  if (includes(allMenuText, '매운', '불닭', '화끈', '스파이시')) 메뉴특성.push('매운맛');
  if (includes(allMenuText, '달콤', '달달', '달콤한', '스위트')) 메뉴특성.push('달콤한');
  if (includes(allMenuText, '담백', '깔끔')) 메뉴특성.push('담백한');
  if (includes(allMenuText, '고소', '고소한', '버터')) 메뉴특성.push('고소한');
  if (includes(allMenuText, '쫄깃', '쫀득', 'q')) 메뉴특성.push('쫄깃한');
  if (includes(allMenuText, '바삭', '크리스피')) 메뉴특성.push('바삭한');
  if (includes(allMenuText, '부드러운', '촉촉')) 메뉴특성.push('부드러운');
  if (includes(allMenuText, '진한', '농후', '크리미')) 메뉴특성.push('진한맛');
  if (includes(allMenuText, '시원', '차가운', '냉')) 메뉴특성.push('시원한');

  return {
    메뉴: unique(메뉴),
    주재료: unique(주재료),
    요리방식: unique(요리방식),
    메뉴특성: unique(메뉴특성),
  };
}

// ══════════════════════════════════════════════════════════════════
//  가격대
// ══════════════════════════════════════════════════════════════════
function classifyPrice(menus: Array<{ name: string; price?: string }>): string {
  const prices = menus
    .map(m => {
      if (!m.price) return null;
      const n = parseInt(m.price.replace(/[^0-9]/g, ''), 10);
      return isNaN(n) ? null : n;
    })
    .filter((n): n is number => n !== null && n > 0 && n < 500000);

  if (prices.length === 0) return '가격미확인';
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  if (avg < 8000)  return '8천원미만';
  if (avg < 15000) return '8천~1만5천';
  if (avg < 25000) return '1만5천~2만5천';
  if (avg < 40000) return '2만5천~4만원';
  return '4만원이상';
}

// ══════════════════════════════════════════════════════════════════
//  리뷰 키워드 → 분위기 / 방문목적 / 동행 / 시설 / 음식특성 / 트렌드
// ══════════════════════════════════════════════════════════════════
interface ReviewResult {
  분위기:   string[];
  방문목적:  string[];
  동행:     string[];
  시설:     string[];
  음식특성:  string[];
  운영:     string[];
  트렌드:   string[];
  연령대:   string[];
}

function detectFromReviews(
  reviewKeywords: Array<{ keyword: string; count: number }>,
  reviewSummary: Record<string, number>,
  existingTags: string[],
): ReviewResult {
  const kwText = [
    ...reviewKeywords.map(k => k.keyword),
    ...Object.keys(reviewSummary),
    ...existingTags,
  ].join(' ').toLowerCase();

  const 분위기: string[] = [];
  const 방문목적: string[] = [];
  const 동행: string[] = [];
  const 시설: string[] = [];
  const 음식특성: string[] = [];
  const 운영: string[] = [];
  const 트렌드: string[] = [];
  const 연령대: string[] = [];

  // ── 분위기
  if (includes(kwText, '아늑', '따뜻한', '포근')) 분위기.push('아늑한');
  if (includes(kwText, '조용', '한적', '프라이빗')) 분위기.push('조용한');
  if (includes(kwText, '활기', '왁자지껄', '북적')) 분위기.push('활기찬');
  if (includes(kwText, '힙', '트렌디', '핫플', '감성')) 분위기.push('힙한');
  if (includes(kwText, '고급', '럭셔리', '프리미엄')) 분위기.push('럭셔리');
  if (includes(kwText, '레트로', '빈티지', '복고')) 분위기.push('레트로');
  if (includes(kwText, '인스타', '포토', '예쁜', '사진')) 분위기.push('인스타감성');
  if (includes(kwText, '뷰', '전망', '야경', '바다뷰')) 분위기.push('뷰맛집');
  if (includes(kwText, '분위기 좋', '분위기좋', '분위기가 좋')) 분위기.push('분위기좋음');

  // ── 방문목적
  if (includes(kwText, '데이트', '연인', '소개팅')) 방문목적.push('데이트');
  if (includes(kwText, '혼밥', '혼자', '1인', '혼술')) 방문목적.push('혼밥·혼술');
  if (includes(kwText, '가족', '부모님', '어린이', '아이와')) 방문목적.push('가족외식');
  if (includes(kwText, '회식', '직장', '단체모임')) 방문목적.push('회식·모임');
  if (includes(kwText, '기념일', '생일', '프러포즈', '생일파티')) 방문목적.push('기념일');
  if (includes(kwText, '공부', '노트북', '카공', '스터디')) 방문목적.push('공부·작업');
  if (includes(kwText, '브런치', '아침', '모닝')) 방문목적.push('브런치');
  if (includes(kwText, '회의', '미팅', '비즈니스')) 방문목적.push('비즈니스미팅');

  // ── 동행
  if (includes(kwText, '혼밥', '혼자', '1인')) 동행.push('혼자');
  if (includes(kwText, '커플', '연인', '데이트', '둘이')) 동행.push('커플');
  if (includes(kwText, '친구', '동생', '언니', '오빠')) 동행.push('친구');
  if (includes(kwText, '가족', '부모님', '아이와')) 동행.push('가족');
  if (includes(kwText, '단체', '대형', '단체석', '단체방')) 동행.push('단체');

  // ── 시설
  if (includes(kwText, '주차', '주차장', '발렛')) 시설.push('주차가능');
  if (includes(kwText, '와이파이', 'wifi', '인터넷')) 시설.push('와이파이');
  if (includes(kwText, '키즈', '어린이', '유아')) 시설.push('키즈존');
  if (includes(kwText, '반려동물', '강아지', '고양이', '펫')) 시설.push('반려동물동반');
  if (includes(kwText, '개인실', '룸', '프라이빗룸', '독립실')) 시설.push('개인룸');
  if (includes(kwText, '콘센트', '충전', '전기')) 시설.push('콘센트');
  if (includes(kwText, '좌식', '방석', '온돌')) 시설.push('좌식');

  // ── 음식특성
  if (includes(kwText, '건강', '유기농', '자연식', '신선한')) 음식특성.push('건강식');
  if (includes(kwText, '비건', '채식', '식물성', 'vegan')) 음식특성.push('비건·채식');
  if (includes(kwText, '다이어트', '저칼로리', '가벼운')) 음식특성.push('저칼로리');
  if (includes(kwText, '국내산', '한우', '국산', '무항생제')) 음식특성.push('국내산재료');
  if (includes(kwText, '글루텐', 'gluten')) 음식특성.push('글루텐프리');
  if (includes(kwText, '제철', '시즌')) 음식특성.push('제철재료');
  if (includes(kwText, '매운', '불닭', '화끈')) 음식특성.push('매운맛');

  // ── 운영
  if (includes(kwText, '24시간', '연중무휴', '밤새')) 운영.push('24시간');
  if (includes(kwText, '심야', '새벽', '밤늦게')) 운영.push('심야영업');
  if (includes(kwText, '포장', '테이크아웃')) 운영.push('포장가능');
  if (includes(kwText, '배달')) 운영.push('배달가능');
  if (includes(kwText, '웨이팅', '줄서', '대기', '오래기다')) 운영.push('웨이팅');
  if (includes(kwText, '예약', '예약필수', '사전예약')) 운영.push('예약가능');
  if (includes(kwText, '무인', '키오스크')) 운영.push('무인주문');

  // ── 트렌드
  if (includes(kwText, 'tv', '방송', '뉴스', '신문')) 트렌드.push('TV출연');
  if (includes(kwText, '블로거', '파워블로거', '리뷰어')) 트렌드.push('블로거추천');
  if (includes(kwText, '줄서', '웨이팅', '오픈런')) 트렌드.push('줄서는집');
  if (includes(kwText, '포토', '사진맛집', '인생샷', '포토존')) 트렌드.push('포토스팟');
  if (includes(kwText, '미쉐린', '블루리본')) 트렌드.push('미쉐린·블루리본');

  // ── 연령대 (크롤링 태그 기반 추론)
  if (includes(kwText, '대학생', '20대', '젊은', 'mz')) 연령대.push('20대');
  if (includes(kwText, '직장인', '30대')) 연령대.push('30대');
  if (includes(kwText, '가족', '아이', '어린이', '부모님')) 연령대.push('전연령');

  return {
    분위기:   unique(분위기),
    방문목적:  unique(방문목적),
    동행:     unique(동행),
    시설:     unique(시설),
    음식특성:  unique(음식특성),
    운영:     unique(운영),
    트렌드:   unique(트렌드),
    연령대:   unique(연령대),
  };
}

// ══════════════════════════════════════════════════════════════════
//  영업시간 → 운영 태그
// ══════════════════════════════════════════════════════════════════
function detectFromHours(hours: string | null): string[] {
  if (!hours) return [];
  const t = hours.toLowerCase();
  const tags: string[] = [];

  if (includes(t, '24시간')) tags.push('24시간');
  if (includes(t, '00:00', '24:00', '02:', '03:', '01:')) tags.push('심야영업');
  // 브런치 시간: 07:00~10:00 오픈
  const openMatch = t.match(/(\d{1,2}):(\d{2})/);
  if (openMatch) {
    const openHour = parseInt(openMatch[1], 10);
    if (openHour >= 7 && openHour <= 10) tags.push('브런치타임');
  }

  return unique(tags);
}

// ══════════════════════════════════════════════════════════════════
//  주소 → 위치특성
// ══════════════════════════════════════════════════════════════════
function detectLocation(address: string | null): string[] {
  if (!address) return [];
  const t = address.toLowerCase();
  const tags: string[] = [];

  // 창원 구별
  if (includes(t, '성산구')) tags.push('성산구');
  if (includes(t, '의창구')) tags.push('의창구');
  if (includes(t, '마산회원구', '마산합포구')) tags.push('마산');
  if (includes(t, '진해구')) tags.push('진해');

  // 주요 상권 동
  if (includes(t, '상남동')) tags.push('상남동');
  if (includes(t, '중앙동')) tags.push('중앙동');
  if (includes(t, '용호동')) tags.push('용호동');
  if (includes(t, '반림동', '봉곡동')) tags.push('반림·봉곡');

  return unique(tags);
}

// ══════════════════════════════════════════════════════════════════
//  트렌드 (리뷰수 기반)
// ══════════════════════════════════════════════════════════════════
function detectTrendByCount(
  reviewCount: number,
  isNewOpen: boolean,
  hasInstagram: boolean,
  existingTrend: string[],
): string[] {
  const tags = [...existingTrend];

  if (reviewCount >= 500)  tags.push('유명맛집');
  if (reviewCount >= 2000) tags.push('인기명소');
  if (reviewCount >= 5000) tags.push('줄서는집');
  if (isNewOpen)           tags.push('신규오픈');
  if (hasInstagram)        tags.push('인스타운영');

  return unique(tags);
}

// ══════════════════════════════════════════════════════════════════
//  신뢰도 계산
// ══════════════════════════════════════════════════════════════════
function calcConfidence(r: RestaurantForTagging, tags: TagsV2): number {
  let score = 0.4; // 기본점수

  const menus = parseJsonField<Array<{ name: string }>>(r.menu_items, []);
  const reviews = parseJsonField<Array<{ keyword: string; count: number }>>(r.review_keywords, []);

  if (menus.length > 0)   score += 0.15;  // 메뉴 데이터 있음
  if (menus.length > 5)   score += 0.05;  // 메뉴 5개 이상
  if (reviews.length > 0) score += 0.15;  // 리뷰 키워드 있음
  if (reviews.length > 5) score += 0.05;  // 리뷰 키워드 5개 이상
  if (r.visitor_review_count > 100)  score += 0.05;
  if (r.visitor_review_count > 1000) score += 0.05;
  if ((tags.분위기?.length ?? 0) > 0) score += 0.05;
  if ((tags.시설?.length   ?? 0) > 0) score += 0.05;

  return Math.min(Math.round(score * 100) / 100, 1.0);
}

// ══════════════════════════════════════════════════════════════════
//  메인 추출 함수 (공개 API)
// ══════════════════════════════════════════════════════════════════
export function extractTagsV2(r: RestaurantForTagging): TagsV2 {
  // ── 파싱
  const menus     = parseJsonField<Array<{ name: string; price?: string }>>(r.menu_items, []);
  const menuKws   = parseJsonField<Array<{ menu: string; count: number }>>(r.menu_keywords ?? null, []);
  const reviewKws = parseJsonField<Array<{ keyword: string; count: number }>>(r.review_keywords, []);
  const reviewSum = parseJsonField<Record<string, number>>(r.review_summary, {});
  const existTags = r.tags ?? [];

  // ── 개별 감지
  const { 업종, 세부업종 }                = detectCategory(r.category, r.name);
  const { 메뉴, 주재료, 요리방식, 메뉴특성 } = detectMenuTags(menus, menuKws);
  const 가격대                            = classifyPrice(menus);
  const reviewResult                      = detectFromReviews(reviewKws, reviewSum, existTags);
  const hoursTags                         = detectFromHours(r.business_hours);
  const 위치특성                          = detectLocation(r.address);
  const 트렌드Final                       = detectTrendByCount(
    r.visitor_review_count,
    r.is_new_open ?? false,
    !!r.instagram_url,
    reviewResult.트렌드,
  );

  // ── 운영 병합
  const 운영 = unique([...reviewResult.운영, ...hoursTags]);

  // ── 연령대 기본값 (비어 있으면 추론)
  let 연령대 = reviewResult.연령대;
  if (연령대.length === 0) {
    // 카페/디저트/베이커리 → 20~30대 기본
    if (업종.some(u => ['카페', '베이커리', '디저트'].includes(u))) {
      연령대 = ['20대', '30대'];
    }
  }

  const tags: TagsV2 = {
    업종,
    세부업종:   세부업종.length  ? 세부업종  : undefined,
    메뉴:       메뉴.length      ? 메뉴      : undefined,
    메뉴특성:   메뉴특성.length  ? 메뉴특성  : undefined,
    주재료:     주재료.length    ? 주재료    : undefined,
    요리방식:   요리방식.length  ? 요리방식  : undefined,
    가격대,
    분위기:     reviewResult.분위기.length   ? reviewResult.분위기   : undefined,
    방문목적:   reviewResult.방문목적.length  ? reviewResult.방문목적 : undefined,
    동행:       reviewResult.동행.length     ? reviewResult.동행     : undefined,
    연령대:     연령대.length    ? 연령대    : undefined,
    운영:       운영.length      ? 운영      : undefined,
    시설:       reviewResult.시설.length     ? reviewResult.시설     : undefined,
    음식특성:   reviewResult.음식특성.length  ? reviewResult.음식특성 : undefined,
    위치특성:   위치특성.length  ? 위치특성  : undefined,
    트렌드:     트렌드Final.length ? 트렌드Final : undefined,
  };

  // ── 신뢰도
  tags.신뢰도 = calcConfidence(r, tags);

  // undefined 키 정리
  return Object.fromEntries(
    Object.entries(tags).filter(([, v]) => v !== undefined),
  ) as TagsV2;
}
