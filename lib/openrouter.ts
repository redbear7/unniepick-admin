/**
 * OpenRouter API 공통 유틸
 * 모델: deepseek/deepseek-chat-v3-0324 (AI 요약과 동일)
 */

const MODEL   = 'deepseek/deepseek-chat-v3-0324';
const BASE_URL = 'https://openrouter.ai/api/v1';
const HEADERS  = {
  'Content-Type':  'application/json',
  'HTTP-Referer':  'https://admin.unniepick.com',
  'X-Title':       'Unniepick Admin',
};

function getKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY 없음');
  return key;
}

/** 단순 텍스트 생성 */
export async function openrouterChat(
  prompt: string,
  options?: {
    system?:      string;
    temperature?: number;
    maxTokens?:   number;
  },
): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (options?.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      model:       MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens:  options?.maxTokens   ?? 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * 스트리밍 텍스트 생성 — 클라이언트로 바로 파이프할 수 있는 ReadableStream<string> 반환
 * 내부적으로 OpenAI SSE → 순수 텍스트 청크로 변환
 */
export async function openrouterStream(
  messages: { role: string; content: string }[],
  system?:  string,
): Promise<ReadableStream<Uint8Array>> {
  const fullMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      model:       MODEL,
      messages:    fullMessages,
      temperature: 0.7,
      stream:      true,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);

  const upstream = res.body!;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const json = line.slice(5).trim();
            if (json === '[DONE]') break;
            try {
              const chunk = JSON.parse(json);
              const text  = chunk.choices?.[0]?.delta?.content;
              if (text) controller.enqueue(enc.encode(text));
            } catch {}
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}
