# P1-00 Technology Stack Decision

## Decision

DIO CRM 자체개발의 Phase 1 기준 기술스택은 다음으로 확정한다.

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Database: Microsoft SQL Server
- DB Access: 명시적 Repository + `mssql` driver
- API: REST/JSON
- Validation: Zod
- Authentication: JWT Access Token + Refresh Token
- Monorepo: pnpm workspace
- CI: GitHub Actions
- Integration: CRM Core와 분리된 Adapter/Interface Framework
- AI 기능: 필요 시 Python/FastAPI 서비스를 별도 서비스로 추가

## Why this stack

### CRM 특성
CRM은 화면 CRUD만이 아니라 상태전이, 승인, 권한, 활동기록, 계약/수금/주문과 같은 장기 업무규칙이 많다. NestJS의 Module/Guard/DI 구조는 도메인 경계를 강제하기 좋다.

### ERP 연동
기존 ERP와 데이터 운영 기반이 SQL Server이므로 CRM도 SQL Server를 사용해 운영 DB 기술종류를 늘리지 않는다. ERP DB 직접 결합은 피하고 Integration Adapter를 통해 연동한다.

### 유지보수
Frontend/Backend를 TypeScript로 통일하여 타입, DTO, Validation 규칙을 공유할 수 있다. ORM Magic보다 명시적 SQL/Repository를 우선하여 ERP형 업무에서 발생하는 복잡한 쿼리/Stored Procedure 연계를 통제한다.

### AI 개발효율
한 언어(TypeScript)를 중심으로 Backend/Frontend/Shared Contract를 관리하면 Agent가 API Contract와 화면 타입을 동시에 추적하기 쉽다. Python은 LLM/RAG/문서분석이 실제 필요할 때 별도 서비스로 추가한다.

## Alternatives considered

| 대안 | 장점 | 단점 | 판정 |
|---|---|---|---|
| ASP.NET Core + React | SQL Server/Windows 친화, 강한 타입 | Front/Back 언어 분리 | 충분히 가능하나 이번 프로젝트의 AI 개발통일성에서 2순위 |
| NestJS + React + PostgreSQL | TypeScript 통일, 현대적 생태계 | SQL Server ERP와 별도 DB 운영기술 추가 | 제외 |
| FastAPI + React | AI/Python 연계 우수 | CRM 전체 도메인을 Python으로 통일할 필요는 없음 | AI 서비스 전용 후보 |
| Next.js Full-stack | 빠른 개발 | ERP/승인/배치/Integration 서버 경계가 흐려질 수 있음 | Core API로 제외 |

## Architecture

```text
React Web/PWA
   |
REST/JSON
   |
NestJS CRM API
   |-- Auth / User / Organization / RBAC
   |-- Common Code / Audit / File / Notification
   |-- CRM Domains (Phase 2+)
   |
   +-- SQL Server (CRM DB)
   |
   +-- Integration Framework
          |-- ERP Adapter
          |-- HIRA Adapter
          +-- future external adapters

Optional:
Python/FastAPI AI Service
```

## Non-goals in Phase 1

- ERP 실운영 연결
- HIRA 실연동
- Production DB 자동 변경
- Phase 2 이후 CRM 업무화면 구현
