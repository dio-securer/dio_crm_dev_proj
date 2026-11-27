# ADR 0001. 설정 체계의 기준은 admin 계약이다

## 상태

채택 (2026-11-26, F0-4). 흡수 작업은 아직 시작하지 않았다.

## 맥락

이 저장소에는 "설정으로 화면과 동작을 바꾸는" 체계가 두 개 있다.

- admin 계약: `packages/contracts/src/admin/`. 설정을 17개 도메인(`domains`, `core.ts`)으로 나누고,
  도메인마다 형식을 검사한다(`payloadSchemas`, `schemas.ts`). 설정 범위는 네 단계다:
  `COMMON`, `TEMPLATE`, `COUNTRY`, `COMPANY`(`draftInputSchema`, `drafts.ts`). 초안을 만들고 게시하는 흐름이 있다.
  서버 쪽은 `backend/src/modules/admin/`, 화면 쪽은 `frontend/src/admin/` 이 쓴다.
- crm-customization: `packages/contracts/src/crm-customization.ts`. 리드 화면을 중심으로 만든 다른 체계다.
  서버 쪽은 `backend/src/customization/`, 화면 쪽은 `frontend/src/customization/` 이 쓴다.

둘은 같은 일을 서로 다른 형식으로 한다. 그대로 두면 AI 는 요청마다 가까운 쪽을 골라 쓰고, 두 체계가 함께 커진다.

## 결정

1. 설정의 기준은 admin 계약이다. 새 설정 종류, 새 범위, 새 검증은 admin 계약에만 추가한다.
2. crm-customization 은 admin 계약으로 흡수한다. 흡수가 끝나면 없앤다.
3. 흡수가 끝날 때까지 crm-customization 에 새 기능을 넣지 않는다. 고장 수리만 한다.
4. 새 개체와 새 화면은 crm-customization 을 쓰지 않고 `metadata/` 설정으로 만든다(ADR 0002).

## 결과

- 좋은 점: 설정 형식이 하나가 된다. 용어집의 "설정 도메인" 이름이 그대로 코드 이름이다.
- 치르는 값: crm-customization 을 쓰는 기존 코드를 옮기는 일이 남는다. 이 ADR 은 순서와 기한을 정하지 않는다.
- 주의: admin 계약의 필드 종류는 지금 다섯 가지뿐이다(`text`, `decimal`, `date`, `boolean`, `enum`. `schemas.ts` 의 확장 필드 정의).
  crm-customization 에만 있는 기능은 흡수할 때 admin 계약에 먼저 추가해야 한다.

## 기계 검사

- 메타모델 검사 함수가 있다(F1-1, ADR 0006): `packages/contracts/src/metadata/` 의 `validateBundle` 이 admin 설정끼리의 참조(없는 필드·문구·코드·개체)를 검사한다.
  지금은 테스트(`tests/metadata/`, `pnpm test`)로만 돈다. `metadata/` 파일에 대해 가드로 돌리는 연결은 F1-2 에서 한다.
- crm-customization 쪽은 아직 기계 검사 없음. 지금은 crm-customization 에 새 기능을 넣거나 새 코드가 그것을 import 해도 가드가 막지 않는다.
- 일부만 막힌다: G10 이 리드 전용 customization 파일의 새 생성을 막는다
  (`packages/contracts/src/lead-*`, `backend/src/customization/*lead-*`, `frontend/src/customization/` 의 `*Lead*`·`lead-*`·`Configured*.tsx`).
  이름에 lead 나 Configured 가 없는 새 파일은 막지 못한다. `crm-customization.ts` 자체는 legacy 목록에 없다.
- G02 는 엔진(`packages/engine*/`)이 legacy 목록의 계약 파일을 import 하는 것을 막는다. `crm-customization.ts` 는 그 목록에 없어 해당하지 않는다.
