import { NextRequest, NextResponse } from 'next/server';

const CORS = { 'Access-Control-Allow-Origin': '*' };

/**
 * GET /api/weather?lat=37.5665&lng=126.978
 * Open-Meteo 무료 API (키 불필요) — 7일 예보 + 현재 날씨
 */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat') || '37.5665'; // 서울 기본값
  const lng = req.nextUrl.searchParams.get('lng') || '126.978';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&timezone=Asia/Seoul&forecast_days=7`;

    const res = await fetch(url, { next: { revalidate: 1800 } }); // 30분 캐시
    if (!res.ok) throw new Error(`Open-Meteo 오류: ${res.status}`);
    const data = await res.json();

    // WMO 날씨 코드 → 한글 + 이모지 변환
    const current = {
      temp: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      ...wmoToInfo(data.current.weather_code),
    };

    const daily = data.daily.time.map((date: string, i: number) => ({
      date,
      dayOfWeek: new Date(date).toLocaleDateString('ko-KR', { weekday: 'short' }),
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precipProb: data.daily.precipitation_probability_max[i],
      precipSum: data.daily.precipitation_sum[i],
      windMax: data.daily.wind_speed_10m_max[i],
      ...wmoToInfo(data.daily.weather_code[i]),
    }));

    // 날씨 기반 BGM 무드 추천
    const moodRec = weatherToMood(current.code, current.temp);

    return NextResponse.json({ current, daily, moodRecommendation: moodRec }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS });
  }
}

// ── WMO 날씨 코드 → 이모지 + 한글 ────────────────────────────────
interface WeatherInfo { code: number; label: string; emoji: string; category: string }

function wmoToInfo(code: number): WeatherInfo {
  if (code === 0) return { code, label: '맑음', emoji: '☀️', category: 'clear' };
  if (code <= 3) return { code, label: '구름 조금', emoji: '⛅', category: 'cloudy' };
  if (code <= 49) return { code, label: '안개/흐림', emoji: '🌫️', category: 'foggy' };
  if (code <= 59) return { code, label: '이슬비', emoji: '🌦️', category: 'drizzle' };
  if (code <= 69) return { code, label: '비', emoji: '🌧️', category: 'rain' };
  if (code <= 79) return { code, label: '눈', emoji: '❄️', category: 'snow' };
  if (code <= 82) return { code, label: '소나기', emoji: '⛈️', category: 'rain' };
  if (code <= 86) return { code, label: '눈보라', emoji: '🌨️', category: 'snow' };
  if (code <= 99) return { code, label: '뇌우', emoji: '⛈️', category: 'storm' };
  return { code, label: '알 수 없음', emoji: '❓', category: 'unknown' };
}

// ── 날씨 → BGM 무드 추천 ──────────────────────────────────────────
function weatherToMood(code: number, temp: number): { moods: string[]; message: string } {
  const info = wmoToInfo(code);

  // 비/눈 → 잔잔한 무드
  if (['rain', 'drizzle', 'snow'].includes(info.category)) {
    return {
      moods: ['lounge', 'chill', 'lo-fi', 'acoustic', 'ambient'],
      message: `${info.emoji} ${info.label} — 잔잔한 BGM으로 아늑한 매장 분위기를 만들어보세요`,
    };
  }

  // 뇌우/폭풍 → 따뜻한 무드
  if (['storm', 'foggy'].includes(info.category)) {
    return {
      moods: ['cozy', 'warm', 'acoustic', 'jazz', 'lo-fi'],
      message: `${info.emoji} ${info.label} — 따뜻하고 포근한 BGM으로 손님을 맞이하세요`,
    };
  }

  // 맑음 + 더움 (28도 이상) → 시원한 무드
  if (info.category === 'clear' && temp >= 28) {
    return {
      moods: ['tropical', 'fresh', 'chill', 'upbeat', 'bright'],
      message: `${info.emoji} 맑고 더운 날 — 시원하고 활기찬 BGM으로 청량감을 더하세요`,
    };
  }

  // 맑음 + 추움 (5도 이하) → 따뜻한 무드
  if (info.category === 'clear' && temp <= 5) {
    return {
      moods: ['cozy', 'warm', 'jazz', 'acoustic', 'lounge'],
      message: `${info.emoji} 맑고 추운 날 — 따뜻한 감성의 BGM으로 몸과 마음을 녹여주세요`,
    };
  }

  // 맑음 / 구름 조금 → 활기찬 무드
  return {
    moods: ['upbeat', 'bright', 'fresh', 'pop', 'morning-coffee'],
    message: `${info.emoji} ${info.label} — 밝고 활기찬 BGM으로 매장에 에너지를 채워보세요`,
  };
}
