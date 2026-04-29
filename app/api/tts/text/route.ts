import { NextRequest, NextResponse } from 'next/server';
import { openrouterChat } from '@/lib/openrouter';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const { situation } = await req.json();

  const prompt = situation?.trim()
    ? `다음 상황에 맞는 매장 안내방송 문구를 작성해주세요: ${situation}\n\n조건: 80자 이내, 자연스럽고 친근한 한국어, 문구만 출력 (따옴표·설명 없음)`
    : `친근한 일반 매장 환영 안내방송을 작성해주세요.\n\n조건: 80자 이내, 자연스럽고 친근한 한국어, 문구만 출력 (따옴표·설명 없음)`;

  try {
    const text = await openrouterChat(prompt, { temperature: 0.85, maxTokens: 128 });
    if (!text) throw new Error('AI 응답 없음');
    return NextResponse.json({ text: text.trim() }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
