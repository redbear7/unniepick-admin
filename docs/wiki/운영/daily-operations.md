---
title: 일일 운영 가이드
category: 운영
tags: [운영, 체크리스트, 크롤러, Metabase]
date: 2026-04-17
author: bangju
status: Active
---

# 일일 운영 가이드

## 매일 확인할 것

### 1. 크롤러 동작 확인
- 텔레그램 `@bangjuclaw_bot` 채팅에서 아침 알림 확인
- `✅ 크롤링 완료 (50개 수집, 신규 N개)` 메시지가 오면 정상
- 신규 업체가 있으면 🆕 상세 알림

### 2. 대시보드 체크
- `/dashboard/restaurants` — 총 업체 수, 새로오픈 개수
- `/dashboard/restaurants/keywords` — 모든 키워드 `status='success'` 확인
- failed 상태인 키워드 있으면 로그 확인

### 3. Metabase 분석
- `/dashboard/restaurants/analytics` 접속 → 차트 갱신 확인
- 카테고리별 분포, 지도 핀 수, 리뷰 트렌드

## 문제 해결

### 크롤링이 안 돌았을 때
```bash
# launchd 상태 확인
launchctl list | grep unniepick

# 로그 확인
tail -f /Users/bangju/Documents/PROGRAM/unniepick-admin/scripts/crawl-restaurants/logs/stdout.log

# 수동 실행
cd /Users/bangju/Documents/PROGRAM/unniepick-admin/scripts/crawl-restaurants
npm run crawl
```

### Metabase가 안 뜰 때
```bash
cd /Users/bangju/Documents/PROGRAM/unniepick-admin
docker compose -f docker-compose.bigdata.yml --env-file .env.bigdata up -d
```

### Next.js 서버 재시작
```bash
cd /Users/bangju/Documents/PROGRAM/unniepick-admin
npm run dev
```

## 주간 작업
- 월요일: Metabase 대시보드 검토 + 인사이트 발굴
- 주간 신규 업체 리뷰 (텔레그램 알림 확인)
- 태그 보정 (AI 오분류 수정)
