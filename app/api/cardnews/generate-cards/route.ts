import { NextRequest, NextResponse } from 'next/server';
import { openrouterChat } from '@/lib/openrouter';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const { store_name, description, category } = await req.json();

  if (!store_name || !description || !category) {
    return NextResponse.json(
      { error: 'store_name, description, category are required' },
      { status: 400, headers: CORS }
    );
  }

  const prompt = `당신은 인스타그램/틱톡 숏츠 콘텐츠 마케팅 전문가입니다.
아래 업체 정보를 받아서 정확히 5개의 카드 콘텐츠를 JSON 형식으로 생성하세요. 설명 없이 순수 JSON만 반환하세요.

업체 정보:
- 업체명: ${store_name}
- 카테고리: ${category}
- 설명: ${description}

카드 구성 (각 카드는 4초 분량):
1. 업체 소개 - 업체명과 카테고리, 한줄 핵심 메시지
2. 위치/주소 - "위치", 주소 또는 지역 정보
3. 연락처 - "연락처", 전화번호 또는 운영시간
4. 특징/상품 - 대표 상품이나 서비스의 특징 (3가지)
5. 콜투액션(CTA) - 행동 유도 메시지 ("지금 바로 문의하세요" 같은)

반환 형식 (마크다운 서식 금지, 텍스트만 사용):
{
  "cards": [
    {
      "title": "카드 제목 (4~8글자)",
      "content": "카드 본문 (30~100글자, 줄바꿈 있을 수 있음)"
    },
    ...
  ]
}

주의사항:
- 각 카드의 title은 4~8글자로 간결하게
- 각 카드의 content는 명확하고 설득력 있게 작성
- 내용은 실제 업체처럼 보여야 함
- 이모지 사용 금지
- 마크다운 포맷 금지
- 줄바꿈은 \\n으로만 표시`;

  try {
    const raw = await openrouterChat(prompt, { temperature: 0.7, maxTokens: 1024 });
    const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(jsonStr);

    if (!result.cards || !Array.isArray(result.cards) || result.cards.length !== 5) {
      throw new Error('카드 생성 실패: 정확히 5개의 카드가 필요합니다');
    }

    return NextResponse.json(result, { headers: CORS });
  } catch (e) {
    return NextResponse.json(
      { error: `카드 생성 실패: ${(e as Error).message}` },
      { status: 500, headers: CORS }
    );
  }
}
