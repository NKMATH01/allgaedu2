# 올가 미수등 시스템 (ALLGA Academy Management System)

한국 대학 입시 학원을 위한 종합 관리 시스템입니다.

## 개요

올가 미수등 시스템은 다중 지점 프랜차이즈 운영을 지원하는 학원 관리 시스템으로, 4가지 사용자 역할(관리자, 지점장, 학생, 학부모)을 지원합니다.

### 주요 기능

- **다중 지점 관리**: 여러 지점의 통합 관리
- **시험 관리**: Excel 업로드를 통한 시험 생성
- **자동 채점**: 1-9등급 자동 계산
- **AI 분석 리포트**: Google Gemini API를 활용한 맞춤형 학습 분석
- **역할별 대시보드**: 각 역할에 맞는 전용 대시보드

## 기술 스택

- **프론트엔드**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **백엔드**: Express.js + TypeScript
- **데이터베이스**: PostgreSQL + Drizzle ORM
- **인증**: express-session + bcrypt
- **AI 통합**: Google Gemini API

## 프로젝트 구조

```
├── client/                    # 프론트엔드
│   └── src/
│       ├── components/ui/     # shadcn 컴포넌트
│       ├── lib/               # 유틸리티 및 인증
│       └── pages/             # 페이지 컴포넌트
├── server/                    # 백엔드
│   ├── middleware/            # 인증 미들웨어
│   ├── utils/                 # 유틸리티 함수
│   ├── routes.ts              # API 라우트
│   └── index.ts               # 서버 진입점
└── shared/                    # 공유 타입/스키마
    └── schema.ts              # Drizzle 스키마
```

## 데이터베이스 스키마

- **users**: 사용자 계정 (admin, branch, student, parent)
- **branches**: 지점 정보
- **classes**: 반 정보
- **students**: 학생 정보
- **parents**: 학부모 정보
- **exams**: 시험 정보
- **examDistributions**: 시험 배포
- **examAttempts**: 시험 응시 기록
- **aiReports**: AI 분석 리포트
- **examAnalysisData**: 시험 구조 분석 (Step 1 캐싱)
- **studentScoreData**: 학생 성적 데이터 (Step 2 저장)
- **aiAnalysisData**: AI 분석 인사이트 (Step 3 저장)

## 4단계 리포트 생성 시스템

AI 리포트 생성은 4단계로 분리되어 효율적인 데이터 관리와 캐싱을 제공합니다:

### Step 1: 시험지 분석 (step1AnalyzeExam)
- 시험 구조 분석 및 영역/난이도 분포 계산
- 결과는 `examAnalysisData` 테이블에 캐싱됨
- 동일 시험에 대해 재사용 가능

### Step 2: 학생 성적 계산 (step2CalculateStudentScore)
- 개별 학생의 정오답 분석, 영역별 점수 계산
- 강점/약점 영역 자동 식별
- 결과는 `studentScoreData` 테이블에 저장

### Step 3: AI 분석 생성 (step3GenerateAIAnalysis)
- Gemini API (우선) → OpenAI 폴백 (gpt-4o-mini)
- 맞춤형 학습 조언 및 성향 분석 생성
- 결과는 `aiAnalysisData` 테이블에 저장 (AI 제공자 추적)

### Step 4: 최종 리포트 생성 (step4GenerateReport)
- 모든 데이터를 조합하여 5페이지 A4 HTML 리포트 생성
- `aiReports` 테이블에 최종 리포트 저장

### 캐싱 및 재생성
- `force=true` 쿼리 파라미터로 학생별 캐시 무시 가능
- **Step 1 (시험 분석)**: 시험별 공유 캐시 - 시험 문항 변경 시에만 재생성
- **Step 2-3 (학생 데이터)**: 응시별 개별 캐시 - force=true 시 재생성
- Step 1-3 데이터는 독립적으로 캐싱되어 성능 최적화

## API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인 (userType 선택 지원)
- `GET /api/auth/me` - 현재 사용자 확인
- `POST /api/auth/logout` - 로그아웃

### 지점 관리 (관리자)
- `GET /api/branches` - 지점 목록
- `POST /api/branches` - 지점 생성
- `PATCH /api/branches/:id` - 지점 수정
- `DELETE /api/branches/:id` - 지점 삭제

### 시험 관리
- `GET /api/exams` - 시험 목록
- `POST /api/exams` - 시험 생성 (Excel 업로드)
- `POST /api/exams/:examId/distribute` - 시험 배포
- `POST /api/exams/:examId/submit` - 시험 제출

### AI 리포트
- `POST /api/reports/generate/:attemptId` - AI 리포트 생성
- `GET /api/reports/:attemptId` - 리포트 조회

## 사용자 역할

1. **총괄 관리자 (admin)**: 전체 시스템 관리, 지점 생성, 시험 생성/배포
2. **지점 관리자 (branch)**: 지점 내 학생/반 관리, 시험 배정, AI 리포트 생성
3. **학생 (student)**: 시험 응시, 성적 확인, AI 분석 보기
4. **학부모 (parent)**: 자녀 성적 확인, AI 분석 보기

## 시작하기

### 기본 계정
- **관리자**: allga / allga
- **지점장**: allga1 / allga1

### Excel 파일 형식 (시험 업로드)
| 문항번호 | 정답 | 배점 | 단원 | 개념 | 난이도 |
|---------|------|------|------|------|--------|
| 1       | 3    | 2    | 함수 | 이차함수 | 중 |
| 2       | 1    | 3    | 미분 | 도함수 | 상 |

## 환경 변수

- `SUPABASE_DATABASE_URL` - Supabase PostgreSQL 연결 URL (우선 사용)
- `DATABASE_URL` - PostgreSQL 연결 URL (폴백)
- `SESSION_SECRET` - 세션 암호화 키
- `GEMINI_API_KEY` - Google Gemini API 키 (AI 분석 리포트 생성용)

## 사용자 선호사항

- **데이터베이스**: Supabase 전용 사용 (Replit 내장 DB 사용 안함)

## 개발 명령어

```bash
npm run dev          # 개발 서버 시작
npm run db:push      # 데이터베이스 스키마 동기화
npm run build        # 프로덕션 빌드
```
