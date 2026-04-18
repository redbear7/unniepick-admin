# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 코드 작성 규칙

- 모든 주석과 UI 텍스트는 **한국어**로 작성

---

## Commands

```bash
npm run dev          # Turbopack 개발 서버
npm run dev:webpack  # Webpack 폴백 (Three.js/Remotion 이슈 시)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint 검사
```

테스트 러너 없음. 빌드 성공 여부로 검증.

---

## Architecture Overview

**언니픽 슈퍼어드민** — 소매점(카페·식당) 대상 BGM 스트리밍 + AI TTS 방송 서비스 관리 대시보드.

### Auth (이중 인증 구조)

두 개의 분리된 인증 플로우가 공존한다:

1. **슈퍼어드민** (`/login`) → `POST /api/auth` → `ADMIN_PIN` 검증 후 Supabase email/password 로그인 → `get_my_role()` RPC로 role=superadmin 확인 → Supabase 세션 쿠키
2. **사장님** (`/owner`) → `POST /api/owner/auth` → `owner_pins` 테이블의 sha256(`"unnipick:{pin}"`) 해시 검증 → `owner_pin_id` + 유저 데이터만 반환 (Supabase 세션 없음)

미들웨어(`middleware.ts`)는 Supabase 세션만 체크하므로, owner 라우트는 별도 서버 컴포넌트에서 쿠키 기반으로 보호.

### Data Flow

- **브라우저 클라이언트**: `lib/supabase.ts` → `createBrowserClient()` (anon key)  
- **서버/API 라우트**: `@supabase/ssr`의 `createServerClient()` 또는 `SUPABASE_SERVICE_ROLE_KEY`로 elevated access  
- **Realtime**: 대시보드 메인(`/dashboard`)은 `stores`, `coupons`, `posts`, `users`, `playlists` 테이블에 postgres_changes 구독

### Audio Engine (`contexts/PlayerContext.tsx`)

단일 Context가 전체 오디오 상태를 담당한다:
- Web Audio API 기반 크로스페이드(3/4/5초 설정 가능)
- **Announcement Ducking**: TTS 재생 시 BGM 볼륨 자동 감소
- 재생 상태는 localStorage에 영속화
- `BottomPlayer.tsx`가 UI, `PlayerContext`가 엔진 역할 분리

### TTS / 방송 파이프라인

`/dashboard/announcements` → Fish Audio API (`/api/tts/generate`) → Supabase Storage `tts-audio` 버킷 → `/api/audio/:path*` 프록시(브라우저 캐시 1년)로 재생.  
방송 반복 재생은 `playAudioNTimes(url, id, times)` 헬퍼가 `onended` 체이닝으로 구현.

### VRM 마스코트 (`components/MascotWidget.tsx` + `components/VrmViewer.tsx`)

- `VrmViewer`는 Three.js + `@pixiv/three-vrm`을 **동적 임포트**(SSR 회피)로 로드
- `forwardRef` + `useImperativeHandle`로 `connectAnalyser` / `stopSpeaking` 노출
- `MascotWidget`에서 `lazy()` + `Suspense`로 번들 분리
- 립싱크: `AnalyserNode.getByteFrequencyData` → 저주파 슬라이스 평균 → `aa` blendshape
- 아이들: blink 상태머신(open→closing→opening), chest bone Y 오프셋으로 호흡

### 영상 생성 (Remotion)

`/remotion/` 디렉토리에 Remotion 컴포지션 정의.  
`POST /api/shorts/render` — 서버에서 `@remotion/bundler` + `@remotion/renderer`로 MP4 렌더링 후 Supabase `music-tracks/shorts/` 버킷 업로드. 타임아웃 5분(`maxDuration: 300`).  
`POST /api/shorts/analyze` — Node.js Buffer 슬라이딩 윈도우 RMS로 클라이맥스 구간 검출.

### 식당 데이터 파이프라인

네이버 플레이스 크롤링 → `restaurants` 테이블 저장 → AI 자동 태깅.  
대규모 작업은 별도 Docker 컨테이너(`docker-compose.bigdata.yml`, Directus 기반).

### 핵심 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # 서버 전용
ADMIN_EMAIL / ADMIN_PASSWORD   # Supabase 슈퍼어드민 계정
ADMIN_PIN                      # 로그인 PIN
GEMINI_API_KEY
```

### 주요 외부 서비스

| 서비스 | 용도 |
|--------|------|
| Supabase | DB, Auth, Storage, Realtime |
| Fish Audio | TTS 음성 합성 |
| Google Gemini | AI 채팅, 이미지 생성, 식당 추천 |
| Naver Place API | 식당 데이터 크롤링 |
| Remotion | 쇼츠/카드뉴스 영상 렌더링 |
