---
title: 창원 맛집 크롤러 아키텍처
category: 개발
tags: [크롤러, 아키텍처, Crawlee, Playwright, Supabase]
date: 2026-04-17
author: bangju
status: Active
---

# 창원 맛집 크롤러 아키텍처

## 개요
네이버 플레이스에서 창원 맛집 데이터를 수집하여 Supabase에 저장하고, 신규 업체를 텔레그램으로 알림하는 자동화 시스템.

## 기술 스택
- **Playwright**: 헤드리스 브라우저 자동화
- **Crawlee**: 크롤러 프레임워크 (일부)
- **Supabase**: PostgreSQL + Storage
- **sharp**: 이미지 리사이즈
- **Telegram Bot API**: 신규 업체 알림
- **launchd**: macOS 자동 실행 (부팅/잠자기 해제 시)

## 실행 흐름
```
맥북 화면 열기 (잠자기 해제)
  → launchd → tsx src/main.ts
    → .last-crawl 파일 확인 (오늘 이미 실행했으면 종료)
      → 3~23분 랜덤 대기 (봇 감지 회피)
        → DB에서 enabled=true AND is_daily=true 키워드 조회
          → 각 키워드별 크롤링:
             ├ 네이버 플레이스 1~5 페이지 ID 수집
             ├ (analyze_reviews=true) 리뷰 상세 분석
             ├ 이미지 다운로드 + 리사이즈 + Storage 업로드
             └ Supabase upsert
          → 신규 업체 감지 → 텔레그램 알림
```

## 데이터 모델
- `restaurants`: 맛집 메타 (이름, 주소, 좌표, 카테고리, 리뷰, 태그, 이미지 등)
- `crawl_keywords`: 크롤링 키워드 관리 (수동/자동)

## 수동 크롤링
어드민 `/dashboard/restaurants/keywords` 에서 ▶ 버튼 클릭 시:
1. Next.js API `child_process.spawn` → 크롤러 프로세스
2. 로그 파일로 출력 (`logs/manual-{id}.log`)
3. DB 상태 폴링으로 진행 상황 UI 반영

## 향후 개선
- 카테고리별 병렬 크롤링
- Naver Place API 전환 검토
- 폐업 감지 로직
