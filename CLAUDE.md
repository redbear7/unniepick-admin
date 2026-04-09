@AGENTS.md

# Multica — AI 에이전트 작업 관리

이 프로젝트는 Multica로 AI 에이전트 분업 체계를 운영 중입니다.
`multica` CLI가 `/opt/homebrew/bin/multica`에 설치되어 있습니다.

## 에이전트 목록

### 언니픽 어드민팀
| 에이전트 | 담당 |
|---------|------|
| 🎵 언니픽 콘텐츠 에이전트 | tracks, playlists, cardnews, shorts, ai-images, references |
| 🏪 언니픽 매장운영 에이전트 | stores, owners, coupons, announcements, notices, posts, users, brands, map, contexts |
| ⚙️ 언니픽 인프라 에이전트 | API routes, supabase migrations, auth, tags, propagation, 공통 컴포넌트 |
| 🎸 언니픽 신곡제작 에이전트 | YT Music 분석 → Suno 제작 워크플로우, 트랙 업로드 |
| 🔌 언니픽 크롬 확장 에이전트 | Suno 크롬 확장앱 전담, /api/import/suno 연동 |
| 🎨 언니픽 디자인 에이전트 | UI/UX, 라이트/다크 테마, DESIGN.md 관리 |
| 🧪 언니픽 QA 에이전트 | 버그 재현, TypeScript 오류 검증, 기능 테스트 |

### da24팀
| 에이전트 | 담당 |
|---------|------|
| da24 프론트엔드 에이전트 | da24 프론트엔드 |
| da24 백엔드 에이전트 | da24 백엔드 |
| da24 디자인 에이전트 | da24 디자인 |

## 자주 쓰는 명령어
```bash
multica issue create --title "제목" --description "설명" --assignee "에이전트명" --priority "high"
multica issue list                  # 이슈 목록
multica agent list                  # 에이전트 상태
multica issue run-messages <taskID> # 실행 메시지 확인
multica daemon status               # 데몬 상태
```

## 규칙
- 이슈 할당 시 담당 영역에 맞는 에이전트에 할당
- 한국어로 커밋 메시지 및 코멘트 작성
- 데몬이 꺼져 있으면 `multica daemon start`로 시작

# Companion
Nuzzlewhit는 항상 한국어로 코멘트를 작성합니다.
