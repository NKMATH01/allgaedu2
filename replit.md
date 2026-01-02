# 올가 미수등 시스템 (ALLGA Academy Management System)

한국 대학 입시 학원을 위한 종합 관리 시스템입니다.

## 개요

올가 미수등 시스템은 다중 지점 프랜차이즈 운영을 지원하는 학원 관리 시스템으로, 4가지 사용자 역할(관리자, 지점장, 학생, 학부모)을 지원합니다.

### 주요 기능

- **다중 지점 관리**: 여러 지점의 통합 관리
- **시험 관리**: Excel 업로드를 통한 시험 생성
- **자동 채점**: 1-9등급 자동 계산
- **AI 분석 리포트**: OpenAI를 활용한 맞춤형 학습 분석
- **역할별 대시보드**: 각 역할에 맞는 전용 대시보드

## 기술 스택

- **프론트엔드**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **백엔드**: Express.js + TypeScript
- **데이터베이스**: PostgreSQL + Drizzle ORM
- **인증**: express-session + bcrypt
- **AI 통합**: OpenAI (Replit AI Integrations)

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

- `DATABASE_URL` - PostgreSQL 연결 URL
- `SESSION_SECRET` - 세션 암호화 키
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API 키 (자동 설정)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI 기본 URL (자동 설정)

## 개발 명령어

```bash
npm run dev          # 개발 서버 시작
npm run db:push      # 데이터베이스 스키마 동기화
npm run build        # 프로덕션 빌드
```
