import { NextRequest, NextResponse } from 'next/server';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500, headers: CORS });

  const { situation } = await req.json();

  const prompt = situation?.trim()
    ? `다음 상황에 맞는 매장 안내방송 문구를 작성해주세요: ${situation}\n\n조건: 80자 이내, 자연스럽고 친근한 한국어, 문구만 출력 (따옴표·설명 없음)`
    : `친근한 일반 매장 환영 안내방송을 작성해주세요.\n\n조건: 80자 이내, 자연스럽고 친근한 한국어, 문구만 출력 (따옴표·설명 없음)`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.85, maxOutputTokens: 128 },
  };

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('AI 응답 없음');
    return NextResponse.json({ text }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
