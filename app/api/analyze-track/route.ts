import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500, headers: CORS });
  }

  const { title, mood_tags, lyrics } = await req.json();

  const prompt = `
당신은 음악 분석 전문가입니다. 아래 음악 정보를 분석하여 JSON만 반환하세요. 설명 없이 순수 JSON만.

음악 정보:
- 제목: ${title || '(없음)'}
- 장르/스타일 태그: ${(mood_tags || []).join(', ') || '(없음)'}
- 가사 샘플: ${(lyrics || '').slice(0, 500) || '(없음)'}

반환 형식 (0~100 정수):
{
  "energy_score": 0~100,
  "valence_score": 0~100,
  "danceability_score": 0~100,
  "energy_level": "low" | "medium" | "high",
  "time_tags": ["morning"|"afternoon"|"evening"|"night"|"late_night"] (1~3개)
}

기준:
- energy_score: 0=매우 조용한 발라드, 100=격렬한 EDM
- valence_score: 0=매우 어둡고 슬픔, 100=매우 밝고 행복
- danceability_score: 0=춤추기 부적합, 100=매우 춤추기 좋음
- energy_level: low(0~40), medium(41~70), high(71~100)
- time_tags: 이 음악이 어울리는 시간대 (복수 가능)
`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
  };

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // JSON 추출 (```json ... ``` 감싸인 경우 제거)
    const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(jsonStr);
    return NextResponse.json(result, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: `분석 실패: ${(e as Error).message}` }, { status: 500, headers: CORS });
  }
}
