# 사주 기반 플레이리스트 추천 + 지브리 프로필 생성 기획

## 개요
매장 사장님의 생년월일시 입력 → 사주(四柱) 분석 → 오행 기반 매장 무드 추천 + 지브리 스타일 AI 캐릭터 생성

## 기술 스택
- **사주 계산**: `@orrery/core` (한국식 사주 + 오행 + 십신 + 대운)
- **캐릭터 생성**: 나노바나나 2 API (지브리 스타일, 1:1 정사각)
- **저장**: Supabase Storage (`profiles/` 버킷) + `stores` 테이블 확장

---

## 1. 사주 분석 → 오행 프로필

### 입력
```
생년: 1985
월: 3
일: 12
시: 14 (24시간)
분: 30
성별: M/F
```

### @orrery/core 연동
```typescript
import { calculateSaju } from '@orrery/core/saju'

const saju = calculateSaju({ year, month, day, hour, minute, gender })
// → saju.pillars[0~3].element = 'tree'|'fire'|'earth'|'metal'|'water'
// → saju.pillars[1].stem (일간 = 본인의 오행)
```

### 오행 비율 계산
4주(년·월·일·시) × 2(천간+지지) = 8글자의 오행 분포

```
木(목) 30% | 火(화) 20% | 土(토) 10% | 金(금) 25% | 水(수) 15%
```

### 오행 → 무드 매핑

| 오행 | 성격 키워드 | 무드 태그 | 컬러 | 이미지 키워드 |
|------|-----------|----------|------|-------------|
| 木 | 성장, 생명력, 활기 | fresh, upbeat, morning-coffee, acoustic | #10b981 | 나무, 숲, 봄, 새싹 |
| 火 | 열정, 에너지, 화려 | energetic, EDM, latin, k-pop, bright | #ef4444 | 불꽃, 태양, 여름, 축제 |
| 土 | 안정, 신뢰, 편안 | chill, lounge, cozy, warm, ambient | #f59e0b | 산, 대지, 가을, 따뜻한 빛 |
| 金 | 세련, 결단, 깔끔 | jazz, lo-fi, indie, study, synth-pop | #8b5cf6 | 달빛, 겨울, 도시, 야경 |
| 水 | 감성, 유연, 깊이 | romantic, night, r&b, ambient, tropical | #06b6d4 | 바다, 비, 안개, 별 |

### 추천 로직
1. 일간(日干) 오행 = 사장님의 본질적 성격 → 1순위 무드
2. 월주(月柱) 오행 = 사회적 성격 → 2순위 무드
3. 부족한 오행 → 보충 추천 (예: 水가 없으면 romantic 트랙 소량 추가)
4. 대운(현재 나이 기준 10년 운) → 시즌별 미세 조정

### 출력: 사주 프로필 카드
```
┌──────────────────────────────────────┐
│ 🔮 사주 분석 결과                      │
│                                      │
│  年柱: 乙丑 (木·土)  月柱: 己卯 (土·木) │
│  日柱: 壬午 (水·火)  時柱: 甲辰 (木·土) │
│                                      │
│  ■■■■■■ 木 37%                       │
│  ■■■    火 15%                       │
│  ■■■■■  土 25%                       │
│  ■       金 5%                        │
│  ■■■    水 18%                       │
│                                      │
│  💎 일간: 壬水 — 감성적이고 유연한 성격    │
│  🎵 추천 무드: romantic, night, r&b     │
│  ⚠️ 부족: 金 → jazz, lo-fi 보충 추천    │
│  📅 현재 대운: 丙申 (火·金) → 활기+세련   │
└──────────────────────────────────────┘
```

---

## 2. 지브리 스타일 캐릭터 생성

### 나노바나나 2 API 연동

```
POST https://api.nanobanana.com/v2/generate
{
  "prompt": "Studio Ghibli style portrait, warm colors, ...",
  "aspect_ratio": "1:1",
  "style": "ghibli"
}
```

### 프롬프트 빌더 (오행 기반)
사주 분석 결과에 따라 캐릭터 외형/배경/분위기를 자동 생성:

```typescript
function buildGhibliPrompt(saju: SajuResult, gender: 'M' | 'F'): string {
  const dominant = getDominantElement(saju) // 가장 강한 오행
  const base = gender === 'F' ? 'young woman' : 'young man'

  const ELEMENT_STYLE = {
    tree: {
      look: 'gentle smile, bright eyes, wind-blown hair',
      bg: 'lush green forest, sunlight through leaves, spring blossoms',
      color: 'soft greens and warm yellows',
    },
    fire: {
      look: 'confident expression, dynamic pose, short hair',
      bg: 'sunset sky, festival lanterns, warm golden light',
      color: 'vibrant reds and oranges',
    },
    earth: {
      look: 'warm smile, calm eyes, earthy accessories',
      bg: 'countryside bakery, autumn harvest, rolling hills',
      color: 'warm browns and golden amber',
    },
    metal: {
      look: 'sophisticated, neat appearance, gentle gaze',
      bg: 'moonlit cityscape, winter snow, elegant interior',
      color: 'silver, lavender, cool whites',
    },
    water: {
      look: 'dreamy expression, flowing hair, serene pose',
      bg: 'ocean shore at twilight, rain on window, misty lake',
      color: 'deep blues and soft teals',
    },
  }

  const style = ELEMENT_STYLE[dominant]
  return `Studio Ghibli anime style portrait of a Korean ${base}, ${style.look}, background: ${style.bg}, color palette: ${style.color}, square composition, soft lighting, detailed, masterpiece quality`
}
```

### 저장
- Supabase Storage: `profiles/store_{id}_ghibli.png`
- stores 테이블: `saju_profile` JSON 컬럼, `ghibli_avatar_url` 컬럼

---

## 3. UI 설계

### 위치: `/dashboard/stores/[id]` 또는 새 탭 `/dashboard/saju`

### 화면 구성
```
┌─────────────────────────────────────────────────┐
│ 🔮 매장 사주 분석                    [분석하기]   │
├─────────────────────────────────────────────────┤
│                                                 │
│  생년월일시:  [1985] [03] [12] [14]:[30] [남/여]  │
│                                                 │
│  ┌──────────┐  ┌──────────────────────────┐     │
│  │          │  │ 四柱 분석                  │     │
│  │  지브리   │  │ 年: 乙丑  月: 己卯         │     │
│  │  캐릭터   │  │ 日: 壬午  時: 甲辰         │     │
│  │  (1:1)   │  │                          │     │
│  │          │  │ 오행: 木37 火15 土25 金5 水18│     │
│  └──────────┘  │                          │     │
│                │ 일간: 壬水 (감성·유연)       │     │
│  [캐릭터 재생성] │ 대운: 丙申 (활기+세련)       │     │
│                └──────────────────────────┘     │
│                                                 │
│  🎵 추천 플레이리스트                              │
│  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐      │
│  │night ││r&b   ││roman ││jazz  ││ambi  │      │
│  │ 5곡  ││ 3곡  ││ 4곡  ││ 2곡  ││ 1곡  │      │
│  └──────┘└──────┘└──────┘└──────┘└──────┘      │
│                                                 │
│  [플레이리스트 자동 생성]  [매장에 적용]             │
└─────────────────────────────────────────────────┘
```

---

## 4. 구현 단계

### Phase 1: 사주 계산 엔진
- `npm install @orrery/core`
- `/app/api/saju/analyze/route.ts` — 사주 계산 + 오행 비율 + 무드 매핑
- 오행→무드 매핑 테이블

### Phase 2: 추천 플레이리스트 (동적 업데이트)
- music_tracks 테이블에서 추천 무드 기반 트랙 선별
- 오행 비율에 비례하여 트랙 수 배분
- 부족 오행 보충 로직
- **동적 추천**: 사주 프로필은 고정, 트랙 DB가 변할 때마다 추천 목록 재계산
  - 트랙 등록/삭제 시 → 추천 API 재호출 (사주 재분석 불필요)
  - 사주 프로필의 `recommendedMoods` 가중치를 기준으로 현재 DB의 트랙을 매번 실시간 쿼리
  - 저장된 플레이리스트와 별개로 "오늘의 추천" 동적 목록 제공
  - 신규 트랙이 추천 무드에 해당하면 자동으로 추천 풀에 포함

### Phase 3: 지브리 캐릭터 생성 (최초 1회 + 교체)
- `/app/api/saju/avatar/route.ts` — 나노바나나 2 API 연동
- 오행 기반 프롬프트 빌더
- **생성 정책**:
  - 사주 분석 완료 시 자동으로 1회 생성
  - 이미 `ghibli_avatar_url`이 있으면 자동 생성 스킵
  - [캐릭터 교체] 버튼 → confirm 후 기존 이미지 삭제 + 재생성
  - 생성 이력 관리 없음 (항상 최신 1장만 유지)
- Supabase Storage 저장 + stores 테이블 연동

### Phase 4: UI 페이지
- `/app/dashboard/saju/page.tsx` — 입력 폼 + 결과 카드 + 캐릭터 + 추천 트랙
- 사주 결과 시각화 (오행 바 차트)
- 플레이리스트 자동 생성 + 매장 적용 버튼

### Phase 5: 사주 히스토리 (방문자 사주 저장)
- 매장 사장 외에 방문자(고객/직원/지인)도 본인 사주를 조회 가능
- 조회 결과를 히스토리에 저장 → 매장별 누적
- 사장 프로필은 `is_owner: true`로 구분 (최상단 고정)

---

## 5. DB 스키마

### stores 테이블 확장
```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS saju_profile jsonb;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ghibli_avatar_url text;
```

### saju_history — DB 저장 금지, 로컬 암호화 저장

**핵심 원칙**: 사주 개인정보(생년월일시)는 서버/DB에 절대 저장하지 않음.
모든 히스토리는 브라우저 localStorage에 AES-GCM 암호화하여 저장, PIN 4자리로 보호.

```
┌──────────────────────────────────────────────────────┐
│  저장 위치별 데이터 분류                                │
├───────────────┬──────────────────────────────────────┤
│ localStorage  │ 생년월일시, 사주 결과(四柱), 오행 비율,  │
│ (AES-GCM 암호화) │ PIN hash, 닉네임, 캐릭터 URL         │
├───────────────┼──────────────────────────────────────┤
│ Supabase DB   │ ❌ 사주 개인정보 저장 금지              │
│               │ ✅ 오행 비율 평균(매장 종합, 익명 집계만)  │
│               │ ✅ 추천 무드 목록 (개인 비식별)           │
├───────────────┼──────────────────────────────────────┤
│ Supabase      │ ✅ 지브리 캐릭터 이미지 (선택적)         │
│ Storage       │                                      │
└───────────────┴──────────────────────────────────────┘
```

### 암호화 구조

```typescript
// localStorage 키: `saju_history_${storeId}`
// 값: AES-GCM 암호화된 JSON blob

interface SajuLocalEntry {
  id:          string;           // uuid
  nickname:    string;           // "사장님", "알바 민수"
  is_owner:    boolean;
  birth_input: BirthInput;       // { year, month, day, hour, minute, gender }
  saju_result: SajuResult;       // { pillars, elements, dayMaster, recommendedMoods }
  ghibli_url?: string;
  created_at:  string;
}

interface EncryptedSajuStore {
  pin_hash:  string;             // SHA-256(PIN 4자리) — 검증용
  salt:      string;             // PBKDF2 salt (base64)
  iv:        string;             // AES-GCM IV (base64)
  data:      string;             // AES-GCM 암호화된 SajuLocalEntry[] (base64)
}

// 암호화 흐름:
// PIN 4자리 → PBKDF2(PIN, salt, 100000 iterations) → AES-256-GCM key
// → encrypt(JSON.stringify(entries)) → localStorage 저장
// 열람 시: PIN 입력 → 같은 과정으로 key 유도 → decrypt → 표시
```

### PIN 보호 정책
- **생성 시**: 첫 사주 분석 시 PIN 4자리 설정 (필수)
- **열람 시**: PIN 입력 → 일치해야 복호화 → 결과 표시
- **5회 실패**: 30초 대기 후 재시도 가능
- **PIN 분실**: 복구 불가 — 로컬 데이터 초기화만 가능 (안내 문구 표시)
- **공유 가능 항목**: 추천 플레이리스트(무드 목록)만 PIN 없이 공유 가능

### 개인정보 보호 조치 (개인정보보호법 대응)

**원칙: "본인 입력 + 로컬 전용 + 동의 확인"**

1. **본인 입력 원칙**: 반드시 본인이 직접 입력 (타인 대리 입력 금지 안내)
2. **동의 체크박스** (필수): 사주 분석 전 아래 문구에 동의해야 진행
   ```
   ☑ 본인이 직접 입력하며, 입력한 정보는 이 기기에만
     암호화 저장됩니다. 서버에 전송되지 않습니다.
   ```
3. **매장 종합 오행**: 5명 이상 누적 시에만 평균 표시 (소수 인원 비식별화 불가 방지)
4. **자동 만료**: 90일 경과 시 해당 방문자 데이터 자동 삭제 (사장 제외)
5. **즉시 삭제**: 본인이 PIN 인증 후 언제든 개별 삭제 가능
6. **안내 문구 상시 노출**:
   ```
   🔒 개인정보 보호 안내
   · 생년월일시는 이 기기에만 암호화 저장되며 서버에 전송되지 않습니다
   · PIN을 아는 본인만 열람할 수 있습니다
   · 추천 플레이리스트(무드)만 공유되며, 개인 식별 정보는 포함되지 않습니다
   · 90일 후 방문자 데이터는 자동 삭제됩니다
   ```

### PIN 없이 공개되는 정보 (비식별)
- 매장 종합 오행 평균 (개인별 내역 없이 집계만)
- 추천 플레이리스트 무드 목록
- 히스토리 개수 ("3명의 사주가 저장되어 있습니다")

### UI: 히스토리 목록
```
┌─────────────────────────────────────────────────────────┐
│ 🔮 사주 히스토리                          [새 사주 분석]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔒 사주 정보는 이 기기에만 암호화 저장됩니다.           │ │
│ │    서버에 전송되지 않으며, PIN을 아는 본인만 열람       │ │
│ │    가능합니다. 추천 플레이리스트는 자유롭게 공유됩니다.  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🔐 4명의 사주가 저장되어 있습니다                         │
│                                                         │
│ ┌──────────────────────────────┐                        │
│ │ PIN 4자리를 입력하세요        │                        │
│ │ [● ● ○ ○]         [열기]     │                        │
│ └──────────────────────────────┘                        │
│                                                         │
│ ── 매장 종합 오행 (PIN 없이 공개) ────────────────         │
│ 방문자 평균: 木21 火21 土18 金18 水16                      │
│ → 균형잡힌 매장! 다양한 무드 트랙 추천                      │
│                                                         │
│ ═══════ PIN 인증 후 ═══════════════════════════════════  │
│                                                         │
│ ⭐ 사장님 (김영희)             壬水 · 감성·유연           │
│    1985.03.12 14:30 여        木37 火15 土25 金5 水18   │
│    🎵 romantic, night, r&b    [지브리👤] [플리 적용]      │
│                                                         │
│ ── 방문자 사주 ──────────────────────── 3명 ──           │
│                                                         │
│ 알바 민수                      甲木 · 활기·성장           │
│    1998.07.22 09:00 남         木45 火20 土10 金15 水10  │
│    🎵 fresh, upbeat            [삭제]                    │
│                                                         │
│ ⚠️ PIN을 분실하면 사주 기록을 복구할 수 없습니다.           │
│    [PIN 변경]  [전체 초기화]                               │
└─────────────────────────────────────────────────────────┘
```

### 히스토리 활용
- **개인**: PIN 인증 후 본인 사주 결과 + 추천 무드 + 캐릭터 열람
- **매장 종합**: 방문자들의 오행 평균 → "이 매장을 찾는 사람들" 성향 파악 (PIN 불요, 비식별 집계)
- **플레이리스트 정교화**: 사장 사주 + 방문자 평균 오행을 블렌딩하여 추천 고도화
  - 예: 사장은 水(romantic) 중심이지만, 방문자 평균이 火(energetic) 높으면 → 두 무드를 섞어 추천
