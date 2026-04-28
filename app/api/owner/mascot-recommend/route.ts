/**
 * POST /api/owner/mascot-recommend
 * 오너 마스코트 — 가게 정보 + 시간대 + 플레이리스트 분석 후 추천
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayName = days[now.getDay()];

  let timeSlot: string;
  if (hour >= 6 && hour < 11)       timeSlot = '아침';
  else if (hour >= 11 && hour < 14) timeSlot = '점심';
  else if (hour >= 14 && hour < 18) timeSlot = '오후';
  else if (hour >= 18 && hour < 22) timeSlot = '저녁';
  else                               timeSlot = '야간';

  return {
    dayName,
    timeSlot,
    hour,
    display: `${dayName} ${timeSlot} (${hour}시)`,
  };
}

export async function POST(req: NextRequest) {
  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: 'user_id가 필요합니다.' }, { status: 400 });
  }

  const supabase = sb();

  // 가게 정보 조회
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, category, address')
    .eq('owner_id', user_id)
    .maybeSingle();

  // 플레이리스트 조회 (최근 30개)
  const { data: playlists } = await supabase
    .from('playlists')
    .select('id, name, mood_tags, time_tags, weather_tags, category_tags, is_curated, is_dynamic')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!playlists || playlists.length === 0) {
    return NextResponse.json({
      comment: '아직 플레이리스트가 없어요. 관리자에게 문의해보세요! 🎵',
      recommendations: [],
    });
  }

  const timeCtx = getTimeContext();

  const playlistSummary = playlists.map(p => ({
    id:       p.id,
    name:     p.name,
    mood:     (p.mood_tags || []).join(', '),
    time:     (p.time_tags || []).join(', '),
    category: (p.category_tags || []).join(', '),
    curated:  p.is_curated,
  }));

  const prompt = `당신은 음악 큐레이션 서비스의 귀엽고 친근한 마스코트 DJ '단비'입니다.
가게 사장님에게 오늘의 플레이리스트를 추천해드리세요.

## 가게 정보
- 이름: ${store?.name || '(정보 없음)'}
- 업종: ${store?.category || '(정보 없음)'}

## 현재 시각
${timeCtx.display}

## 사용 가능한 플레이리스트 목록
${JSON.stringify(playlistSummary, null, 2)}

## 응답 형식 (JSON만 출력, 설명 금지)
{
  "comment": "사장님에게 건네는 짧고 친근한 추천 멘트 (1~2문장, 존댓말, 마스코트처럼 밝고 귀엽게, 시간대와 업종 분위기 반영)",
  "recommendations": [
    { "playlist_id": "...", "name": "...", "reason": "추천 이유 한 줄 (구체적으로)" }
  ]
}

규칙:
- 최대 3개 추천
- 시간대(${timeCtx.timeSlot}), 업종(${store?.category || '일반'}), 요일(${timeCtx.dayName}) 분위기에 가장 잘 맞는 플레이리스트 선택
- 멘트는 반드시 한국어, 밝고 귀여운 톤 유지
- playlist_id는 반드시 위 목록에 있는 실제 id만 사용`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `HTTP ${res.status}`);
    }

    const resp = await res.json();
    const raw  = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = raw.match(/```json\s*([\s\S]*?)```/)?.[1]
      || raw.match(/```\s*([\s\S]*?)```/)?.[1]
      || raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);

    const result = JSON.parse(jsonStr);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[mascot-recommend]', err);
    return NextResponse.json({ error: '추천 생성에 실패했습니다.' }, { status: 500 });
  }
}
