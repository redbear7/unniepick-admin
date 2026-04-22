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

const ORGANIZE_PROMPT = `당신은 브레인스토밍 대화를 정밀하게 분석하여 깊이 있는 마인드맵으로 정리하는 전문 분석가입니다.
아래는 사용자(user)와 AI 어시스턴트(ai/assistant)의 실제 대화 전문입니다.

**중요: AI 응답에 포함된 구체적인 수치, 사례, 분석 내용을 반드시 마인드맵에 반영하세요.**

다음 JSON 형식으로 **반드시 유효한 JSON만** 반환하세요. 설명 없이 JSON만 출력.

{
  "seed": "대화의 핵심 주제 (10자 이내 씨앗 키워드)",
  "summary": "이 대화 전체를 한 문장으로 예리하게 요약",
  "branches": [
    {
      "topic": "대분류 주제 (대화에서 실제로 다룬 내용 기반)",
      "emoji": "관련 이모지 1개",
      "color": "#FF6F0F 또는 #3B82F6 또는 #10B981 또는 #8B5CF6 또는 #F59E0B 중 하나",
      "children": [
        {
          "idea": "대화에서 나온 구체적 아이디어/사실/수치 (추상적 표현 금지)",
          "children": [
            { "idea": "세부 근거, 수치, 사례명, 방법론 등 (가능한 구체적으로)", "children": [] }
          ]
        }
      ]
    }
  ],
  "core_insights": [
    "대화에서 도출된 날카롭고 실행 가능한 인사이트 (수치/사례 포함)",
    "인사이트 2",
    "인사이트 3"
  ],
  "next_actions": ["즉시 실행 가능한 구체적 다음 행동 1", "액션 2", "액션 3"]
}

품질 규칙:
- branches는 3~5개 — 대화의 실제 주요 토픽 기반으로 구성
- 각 branch의 children은 3~6개 — 대화에서 실제 언급된 내용만 사용
- children의 하위 children에는 수치, 사례명, 플랫폼명, 구체적 방법 등 세부 정보 포함
- "분석", "탐색", "전략" 같은 추상적 단어만 있는 노드는 금지 — 반드시 내용을 담을 것
- 예시 나쁨: "시너지 효과 탐색" / 예시 좋음: "카카오헤어샵 25% 수수료 → 언니픽 5~10% 목표"
- core_insights는 3~5개 — 수치나 사례를 포함한 날카로운 문장
- next_actions는 2~4개 — 담당자, 기한, 방법이 포함된 실행 문장
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

  // user + ai 메시지 모두 포함 — AI 분석 내용까지 마인드맵에 반영
  const brainstorm = messages
    .map(m => {
      const role = m.role === 'user' ? '👤 사용자' : '🤖 AI 분석';
      return `[${role}]\n${m.content}`;
    })
    .join('\n\n');

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
