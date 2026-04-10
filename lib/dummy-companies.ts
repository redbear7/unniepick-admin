export interface MovingCompany {
  id: number;
  name: string;
  region: string;           // 대표 활동 지역
  regions: string[];        // 매칭 가능 지역 키워드
  rating: number;           // 1.0 ~ 5.0
  reviewCount: number;
  description: string;
  tags: string[];           // 특징 태그
  minPrice: number;         // 최소 견적 (만원)
  experience: number;       // 업력 (년)
  badge?: string;           // 뱃지 (인증, 인기 등)
}

export const DUMMY_COMPANIES: MovingCompany[] = [
  {
    id: 1, name: '강남포장이사', region: '서울 강남',
    regions: ['강남', '서초', '송파', '강동'],
    rating: 4.9, reviewCount: 312, experience: 12,
    description: '강남·서초 전문 포장이사. 당일 작업 가능.',
    tags: ['포장재무료', '층간소음주의', '당일가능'],
    minPrice: 35, badge: '인기',
  },
  {
    id: 2, name: '서울이사전문', region: '서울 전지역',
    regions: ['서울', '강북', '노원', '도봉', '성북'],
    rating: 4.8, reviewCount: 287, experience: 15,
    description: '서울 전역 15년 경력. 친절하고 꼼꼼한 이사.',
    tags: ['보험가입', '친절'],
    minPrice: 28, badge: '인증',
  },
  {
    id: 3, name: '경기이사천사', region: '경기 전지역',
    regions: ['경기', '수원', '성남', '용인', '분당', '안양', '광명'],
    rating: 4.7, reviewCount: 198, experience: 9,
    description: '경기도 전역 신속·안전 이사 서비스.',
    tags: ['신속', '안전포장'],
    minPrice: 25,
  },
  {
    id: 4, name: '인천포장이사', region: '인천',
    regions: ['인천', '부평', '연수', '남동', '계양', '미추홀'],
    rating: 4.6, reviewCount: 156, experience: 7,
    description: '인천 전문. 섬 지역 이사도 문의 가능.',
    tags: ['지역밀착', '합리적가격'],
    minPrice: 22,
  },
  {
    id: 5, name: '부산이사전문', region: '부산',
    regions: ['부산', '해운대', '동래', '남구', '북구', '사하'],
    rating: 4.9, reviewCount: 421, experience: 18,
    description: '부산 최다 후기. 20년 이상 경력 기사.',
    tags: ['경력20년', '포장재무료', '야간가능'],
    minPrice: 20, badge: '인기',
  },
  {
    id: 6, name: '대구이사센터', region: '대구',
    regions: ['대구', '수성', '달서', '북구', '동구'],
    rating: 4.5, reviewCount: 134, experience: 11,
    description: '대구·경북 전문 이사 센터.',
    tags: ['경북포함', '청결'],
    minPrice: 18,
  },
  {
    id: 7, name: '대전믿음이사', region: '대전',
    regions: ['대전', '유성', '서구', '중구', '동구', '세종'],
    rating: 4.7, reviewCount: 203, experience: 10,
    description: '대전·세종 특화. 정직한 견적.',
    tags: ['세종포함', '보험가입'],
    minPrice: 19,
  },
  {
    id: 8, name: '광주이사사랑', region: '광주',
    regions: ['광주', '서구', '북구', '남구', '동구', '광산'],
    rating: 4.6, reviewCount: 167, experience: 8,
    description: '광주 지역 10년 운영. 알뜰 이사.',
    tags: ['전남포함', '합리적가격'],
    minPrice: 17,
  },
  {
    id: 9, name: '울산이사마스터', region: '울산',
    regions: ['울산', '남구', '북구', '중구', '동구'],
    rating: 4.4, reviewCount: 89, experience: 6,
    description: '울산 전문. 산업단지·아파트 이사 특화.',
    tags: ['산업단지특화'],
    minPrice: 16,
  },
  {
    id: 10, name: '마포행복이사', region: '서울 마포',
    regions: ['마포', '은평', '서대문', '종로', '중구'],
    rating: 4.8, reviewCount: 245, experience: 13,
    description: '마포·은평·서대문 전문. 고층 이사 경험 풍부.',
    tags: ['고층특화', '친절'],
    minPrice: 30, badge: '인기',
  },
  {
    id: 11, name: '송파포장이사', region: '서울 송파',
    regions: ['송파', '강동', '하남', '위례'],
    rating: 4.7, reviewCount: 178, experience: 10,
    description: '송파·강동·하남 지역 전담 팀.',
    tags: ['하남포함', '보험가입'],
    minPrice: 32,
  },
  {
    id: 12, name: '분당이사전문', region: '경기 분당',
    regions: ['분당', '성남', '판교', '용인'],
    rating: 4.9, reviewCount: 356, experience: 14,
    description: '분당·판교 신도시 이사 전문.',
    tags: ['신도시전문', '포장재무료'],
    minPrice: 27, badge: '인증',
  },
  {
    id: 13, name: '일산이사나라', region: '경기 일산',
    regions: ['일산', '고양', '파주', '김포'],
    rating: 4.6, reviewCount: 143, experience: 9,
    description: '일산·파주·김포 전담 서비스.',
    tags: ['파주포함', '당일가능'],
    minPrice: 24,
  },
  {
    id: 14, name: '수원이사전문', region: '경기 수원',
    regions: ['수원', '화성', '오산', '평택'],
    rating: 4.5, reviewCount: 112, experience: 7,
    description: '수원·화성·평택 지역 밀착 서비스.',
    tags: ['화성포함', '합리적가격'],
    minPrice: 21,
  },
  {
    id: 15, name: '안산이사천사', region: '경기 안산',
    regions: ['안산', '시흥', '안양', '군포'],
    rating: 4.4, reviewCount: 78, experience: 5,
    description: '안산·시흥·안양 전문 팀.',
    tags: ['저렴한가격'],
    minPrice: 19,
  },
  {
    id: 16, name: '구리이사마트', region: '경기 구리',
    regions: ['구리', '남양주', '하남', '강동'],
    rating: 4.7, reviewCount: 167, experience: 11,
    description: '구리·남양주 지역 신속 이사.',
    tags: ['남양주포함', '신속'],
    minPrice: 26,
  },
  {
    id: 17, name: '의정부이사전문', region: '경기 의정부',
    regions: ['의정부', '양주', '동두천', '포천'],
    rating: 4.3, reviewCount: 65, experience: 6,
    description: '의정부·양주 북부 지역 특화.',
    tags: ['북부특화'],
    minPrice: 18,
  },
  {
    id: 18, name: '부천이사전문', region: '경기 부천',
    regions: ['부천', '광명', '시흥', '인천'],
    rating: 4.6, reviewCount: 134, experience: 8,
    description: '부천·광명 서울 인접 지역 전문.',
    tags: ['인천포함', '보험가입'],
    minPrice: 23,
  },
  {
    id: 19, name: '용인이사센터', region: '경기 용인',
    regions: ['용인', '기흥', '수지', '처인'],
    rating: 4.5, reviewCount: 98, experience: 7,
    description: '용인·수지 신도시 이사 전담.',
    tags: ['신도시전문', '친절'],
    minPrice: 22,
  },
  {
    id: 20, name: '강서이사전문', region: '서울 강서',
    regions: ['강서', '양천', '영등포', '구로', '금천'],
    rating: 4.7, reviewCount: 212, experience: 12,
    description: '서울 서남부 전문. 공항 인근 포함.',
    tags: ['서남부전문', '당일가능'],
    minPrice: 29,
  },
  {
    id: 21, name: '성북이사나라', region: '서울 성북',
    regions: ['성북', '강북', '도봉', '노원', '중랑'],
    rating: 4.5, reviewCount: 123, experience: 9,
    description: '서울 북부 전담. 빌라·다가구 이사 경험 풍부.',
    tags: ['빌라특화', '합리적가격'],
    minPrice: 26,
  },
  {
    id: 22, name: '동대문이사전문', region: '서울 동대문',
    regions: ['동대문', '동작', '관악', '광진'],
    rating: 4.4, reviewCount: 87, experience: 6,
    description: '서울 중동부 지역 신속 이사.',
    tags: ['신속', '저렴한가격'],
    minPrice: 25,
  },
  {
    id: 23, name: '창원이사마스터', region: '창원',
    regions: ['창원', '마산', '진해', '경남'],
    rating: 4.6, reviewCount: 145, experience: 10,
    description: '창원·마산·진해 통합시 전체 커버.',
    tags: ['경남포함', '보험가입'],
    minPrice: 16,
  },
  {
    id: 24, name: '천안이사전문', region: '충남 천안',
    regions: ['천안', '아산', '충남'],
    rating: 4.5, reviewCount: 102, experience: 8,
    description: '천안·아산 수도권 남부 연결 이사.',
    tags: ['아산포함', '합리적가격'],
    minPrice: 17,
  },
  {
    id: 25, name: '청주이사사랑', region: '충북 청주',
    regions: ['청주', '충북', '충주', '제천'],
    rating: 4.4, reviewCount: 76, experience: 7,
    description: '청주·충북 전역 서비스.',
    tags: ['충북전역'],
    minPrice: 16,
  },
  {
    id: 26, name: '전주이사전문', region: '전북 전주',
    regions: ['전주', '익산', '군산', '전북'],
    rating: 4.5, reviewCount: 89, experience: 8,
    description: '전주·익산·군산 전북 주요 도시 커버.',
    tags: ['전북전역', '합리적가격'],
    minPrice: 15,
  },
  {
    id: 27, name: '여수이사나라', region: '전남 여수',
    regions: ['여수', '순천', '광양', '전남'],
    rating: 4.3, reviewCount: 54, experience: 6,
    description: '여수·순천·광양 남해안 이사 전문.',
    tags: ['남해안특화'],
    minPrice: 14,
  },
  {
    id: 28, name: '포항이사전문', region: '경북 포항',
    regions: ['포항', '경주', '울산', '영천'],
    rating: 4.4, reviewCount: 67, experience: 7,
    description: '포항·경주 동해안 전문.',
    tags: ['동해안특화', '합리적가격'],
    minPrice: 15,
  },
  {
    id: 29, name: '구미이사센터', region: '경북 구미',
    regions: ['구미', '김천', '상주', '경북'],
    rating: 4.3, reviewCount: 48, experience: 5,
    description: '구미·김천 산업단지 이사 경험 다수.',
    tags: ['산업단지특화'],
    minPrice: 14,
  },
  {
    id: 30, name: '제주이사전문', region: '제주',
    regions: ['제주', '제주시', '서귀포'],
    rating: 4.7, reviewCount: 134, experience: 10,
    description: '제주도 섬 이사 전문. 항공·선박 운송 연계.',
    tags: ['섬이사전문', '운송연계'],
    minPrice: 45, badge: '인증',
  },
  {
    id: 31, name: '강릉이사마스터', region: '강원 강릉',
    regions: ['강릉', '원주', '강원', '춘천'],
    rating: 4.4, reviewCount: 58, experience: 7,
    description: '강원 전역 이사. 산간 지역 경험 풍부.',
    tags: ['산간가능', '강원전역'],
    minPrice: 20,
  },
  {
    id: 32, name: '종로이사전문', region: '서울 종로',
    regions: ['종로', '중구', '용산'],
    rating: 4.6, reviewCount: 112, experience: 11,
    description: '서울 도심 이사 전문. 좁은 골목 경험 풍부.',
    tags: ['도심전문', '골목작업'],
    minPrice: 32,
  },
  {
    id: 33, name: '위례이사전문', region: '위례·하남',
    regions: ['위례', '하남', '송파', '성남'],
    rating: 4.8, reviewCount: 189, experience: 8,
    description: '위례 신도시·하남 미사 전담.',
    tags: ['신도시전문', '포장재무료'],
    minPrice: 29, badge: '인기',
  },
  {
    id: 34, name: '평촌이사나라', region: '경기 평촌',
    regions: ['안양', '평촌', '군포', '의왕'],
    rating: 4.5, reviewCount: 96, experience: 8,
    description: '평촌·군포 1기 신도시 이사 경험 많음.',
    tags: ['신도시전문'],
    minPrice: 22,
  },
  {
    id: 35, name: '인천연수이사', region: '인천 연수',
    regions: ['연수', '송도', '인천', '남동'],
    rating: 4.7, reviewCount: 167, experience: 9,
    description: '송도 국제도시 이사 전문.',
    tags: ['송도전문', '친절'],
    minPrice: 24,
  },
  {
    id: 36, name: '동탄이사전문', region: '경기 동탄',
    regions: ['화성', '동탄', '오산', '수원'],
    rating: 4.8, reviewCount: 234, experience: 7,
    description: '동탄 신도시 이사 1등. 연간 800건 이상.',
    tags: ['동탄전문', '포장재무료'],
    minPrice: 25, badge: '인기',
  },
  {
    id: 37, name: '광교이사센터', region: '경기 광교',
    regions: ['광교', '수원', '용인', '영통'],
    rating: 4.6, reviewCount: 143, experience: 8,
    description: '광교 신도시·영통 전담 팀.',
    tags: ['신도시전문', '보험가입'],
    minPrice: 24,
  },
  {
    id: 38, name: '김포이사나라', region: '경기 김포',
    regions: ['김포', '한강신도시', '강서', '인천'],
    rating: 4.5, reviewCount: 87, experience: 6,
    description: '김포 한강신도시 이사 전문.',
    tags: ['한강신도시', '합리적가격'],
    minPrice: 22,
  },
  {
    id: 39, name: '검단이사전문', region: '인천 검단',
    regions: ['검단', '인천', '김포'],
    rating: 4.4, reviewCount: 68, experience: 5,
    description: '검단 신도시 초창기부터 운영.',
    tags: ['신도시전문'],
    minPrice: 20,
  },
  {
    id: 40, name: '별내이사마스터', region: '경기 별내',
    regions: ['별내', '남양주', '구리', '진접'],
    rating: 4.5, reviewCount: 78, experience: 6,
    description: '별내·진접 택지지구 이사 전담.',
    tags: ['택지지구전문'],
    minPrice: 23,
  },
  {
    id: 41, name: '다산이사전문', region: '경기 다산',
    regions: ['다산', '남양주', '강동', '구리'],
    rating: 4.6, reviewCount: 112, experience: 7,
    description: '다산 신도시 이사 전문. 도보 거리 이사 포함.',
    tags: ['다산전문', '저렴한가격'],
    minPrice: 22,
  },
  {
    id: 42, name: '파주이사나라', region: '경기 파주',
    regions: ['파주', '운정', '교하', '일산'],
    rating: 4.4, reviewCount: 76, experience: 7,
    description: '파주 운정 신도시·교하 전담.',
    tags: ['운정전문'],
    minPrice: 22,
  },
  {
    id: 43, name: '양주이사전문', region: '경기 양주',
    regions: ['양주', '회천', '의정부', '포천'],
    rating: 4.3, reviewCount: 52, experience: 5,
    description: '양주 회천 신도시 이사 전문.',
    tags: ['합리적가격'],
    minPrice: 19,
  },
  {
    id: 44, name: '미사이사센터', region: '경기 미사',
    regions: ['미사', '하남', '강동', '위례'],
    rating: 4.7, reviewCount: 156, experience: 8,
    description: '미사 강변도시 이사 1위.',
    tags: ['미사전문', '포장재무료'],
    minPrice: 26, badge: '인기',
  },
  {
    id: 45, name: '고덕이사전문', region: '서울 고덕',
    regions: ['고덕', '강동', '하남', '송파'],
    rating: 4.6, reviewCount: 134, experience: 9,
    description: '고덕 그라시움·강일지구 전담.',
    tags: ['강동전문', '친절'],
    minPrice: 30,
  },
  {
    id: 46, name: '사당이사마스터', region: '서울 사당',
    regions: ['사당', '동작', '관악', '서초', '방배'],
    rating: 4.5, reviewCount: 98, experience: 8,
    description: '사당·동작·관악 서울 남부 전담.',
    tags: ['남부전문', '합리적가격'],
    minPrice: 27,
  },
  {
    id: 47, name: '목동이사전문', region: '서울 목동',
    regions: ['목동', '양천', '강서', '신정'],
    rating: 4.7, reviewCount: 189, experience: 11,
    description: '목동 재건축·신정동 아파트 이사 전문.',
    tags: ['재건축경험', '보험가입'],
    minPrice: 31,
  },
  {
    id: 48, name: '상암이사나라', region: '서울 상암',
    regions: ['상암', '마포', '은평', '고양'],
    rating: 4.6, reviewCount: 123, experience: 9,
    description: '상암·마포 디지털미디어시티 인근 전담.',
    tags: ['마포전문', '당일가능'],
    minPrice: 29,
  },
  {
    id: 49, name: '세종이사전문', region: '세종',
    regions: ['세종', '대전', '공주', '천안'],
    rating: 4.7, reviewCount: 167, experience: 8,
    description: '세종시 행정중심복합도시 이사 전문.',
    tags: ['세종전문', '포장재무료'],
    minPrice: 20, badge: '인증',
  },
  {
    id: 50, name: '하늘이사전문', region: '전국',
    regions: ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산'],
    rating: 4.8, reviewCount: 534, experience: 20,
    description: '전국 이사 전문 업체. 장거리·해외 이사 포함.',
    tags: ['전국가능', '장거리', '보험가입'],
    minPrice: 30, badge: '인증',
  },
];

/**
 * 도착지 주소 기준으로 적합한 업체 필터링 및 정렬
 */
export function matchCompanies(toAddress: string, limit = 10): MovingCompany[] {
  if (!toAddress.trim()) {
    return [...DUMMY_COMPANIES]
      .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
      .slice(0, limit);
  }

  const lower = toAddress.toLowerCase();

  const scored = DUMMY_COMPANIES.map(c => {
    const score = c.regions.reduce((acc, r) => acc + (lower.includes(r) ? 2 : 0), 0);
    return { ...c, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, limit);
}
