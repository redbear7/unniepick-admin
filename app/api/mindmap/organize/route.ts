/**
 * POST /api/mindmap/organize
 * body: { messages: [{role, content}][], sessionId: string }
 * → 브레인스토밍 메시지를 마인드맵 JSON으로 정리 (Gemini)
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const ORGANIZE_PROMPT = `당신은 브레인스토밍 회의록을 마인드맵으로 정리하는 전문가입니다.
아래는 사용자가 자유롭게 던진 아이디어와 생각들입니다.

이것을 분석하여 다음 JSON 형식으로 **반드시 유효한 JSON만** 반환하세요. 설명 없이 JSON만 출력.

{
  "seed": "회의의 핵심 주제 (10자 이내 씨앗 키워드)",
  "summary": "이 회의를 한 문장으로 요약",
  "branches": [
    {
      "topic": "대분류 주제",
      "emoji": "관련 이모지 1개",
      "color": "#FF6F0F 또는 #3B82F6 또는 #10B981 또는 #8B5CF6 또는 #F59E0B 중 하나",
      "children": [
        {
          "idea": "구체적 아이디어 또는 키워드",
          "children": [
            { "idea": "더 세부 아이디어 (선택)", "children": [] }
          ]
        }
      ]
    }
  ],
  "core_insights": ["핵심 인사이트 1 (한 문장)", "인사이트 2", "인사이트 3"],
  "next_actions": ["다음 단계 액션 1", "액션 2", "액션 3"]
}

규칙:
- branches는 2~5개, 각 branch의 children은 2~6개
- 중복 아이디어는 합치고 비슷한 것끼리 묶기
- core_insights는 3~5개, 실행 가능하고 날카로운 인사이트
- next_actions는 2~4개, 구체적인 다음 행동
- 씨앗(seed)은 모든 아이디어를 관통하는 핵심 단어
- JSON 외 다른 텍스트 절대 금지`;

export async function POST(req: NextRequest) {
  const { messages, sessionId } = await req.json() as {
    messages: Array<{ role: string; content: string }>;
    sessionId: string;
  };

  if (!messages?.length) {
    return NextResponse.json({ error: '정리할 내용이 없습니다' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 });

  // 사용자 발언만 추출해서 브레인스토밍 텍스트로 합치기
  const brainstorm = messages
    .filter(m => m.role === 'user')
    .map((m, i) => `[아이디어 ${i + 1}] ${m.content}`)
    .join('\n');

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `${ORGANIZE_PROMPT}\n\n---브레인스토밍 내용---\n${brainstorm}` }] }],
    });

    const raw = response.text ?? '';
    // JSON 블록 추출 (```json ... ``` 혹은 순수 JSON)
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    const mindmap = JSON.parse(jsonStr);

    // DB 저장
    if (sessionId) {
      await sb()
        .from('brainstorm_sessions')
        .update({
          mindmap,
          core_insights: mindmap.core_insights ?? [],
          next_actions:  mindmap.next_actions ?? [],
          updated_at:    new Date().toISOString(),
        })
        .eq('id', sessionId);
    }

    return NextResponse.json({ ok: true, mindmap });
  } catch (e) {
    return NextResponse.json({ error: `마인드맵 생성 실패: ${(e as Error).message}` }, { status: 500 });
  }
}
