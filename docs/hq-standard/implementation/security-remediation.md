# HQ 구현 선행 보안 의존성 보완

기록일: 2026-10-22 · 상태: Critical 5건 제거, 원격 CI 전체 통과

## 확인한 문제

H01 기준 커밋 `6febb62fa3e0aafe760d13171b730a94ef09787e`의 [CI 실행](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39761688013)은 기능 빌드·테스트 이후 `pnpm audit --audit-level=critical`에서 실패했다. 감사 결과의 Critical 5건은 아래 3개 의존성에 연결된다. 패키지 설치 여부가 곧 운영 환경에서의 악용 가능성을 의미하지는 않으며, 본 작업은 기존 CI의 통과 기준을 유지하면서 해당 취약 버전을 제거한다.

| 패키지 | 기존 lockfile 버전 | 수정 버전 | 보완 대상 |
|---|---|---|---|
| proxy-addr | 2.0.7 | 2.0.8 | GHSA-jqcg-44mw-7w3h |
| tinypool | 1.1.1 | 2.1.2 | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr |
| handlebars | 4.7.9 | 4.7.10 | GHSA-8r5x-fm3f-whwj, GHSA-p8wg-vrv2-v86f |

## 적용 방법과 호환성 판단

루트 `package.json`의 `pnpm.overrides`에 취약 범위 선택자를 추가한다. 이미 수정 버전 이상인 의존성은 하위 버전으로 내리지 않는다.

```json
{
  "proxy-addr@<2.0.8": "2.0.8",
  "tinypool@<2.1.2": "2.1.2",
  "handlebars@<4.7.10": "4.7.10"
}
```

`proxy-addr`와 `handlebars`는 같은 주 버전의 패치로, 공식 배포 소스의 실행 의존성은 기존 잠금 구조와 일치한다. `tinypool`은 주 버전 변경이므로 공식 v1.1.1→v2.1.2 전체 소스 변경을 확인했다. 호환성 변경은 Node 18 지원 종료이며, 기존 CI의 Node 22와 맞는다. CPU 수 계산 변경, 선택적 자식 프로세스 serialization 옵션 및 원형 오염 방어가 추가되며, 기존 Vitest가 사용하는 풀 생성·실행 API는 유지된다. 이 정적 검토를 실제 Vitest 실행 결과로 대신하지 않는다.

의존성 설치 네트워크가 제한된 로컬 환경에서 새 tarball의 integrity 값을 추정하거나 종전 integrity를 재사용하지 않았다. 기존 CI의 `pnpm install --no-frozen-lockfile`가 생성한 실제 lockfile 차이를 job 로그에서 회수하여 저장했다. 해당 실행은 새 잠금 파일이 생성된 상태에서 빌드·테스트·감사를 모두 수행했다. `audit:critical`의 검사 수준이나 실패 처리는 변경하지 않았다.

## 검증 상태

| 확인 | 결과 |
|---|---|
| 공식 advisory와 수정 버전 대조 | 확인 |
| Tinypool Node 22 및 API 정적 호환성 검토 | 확인 |
| 루트 package.json 구문 및 공백 검사 | PASS |
| 새 의존성 설치·lockfile 생성 | PASS — CI의 실제 pnpm 해석 결과 회수 |
| 전체 빌드 | PASS |
| frontend 테스트 | PASS — 15개 파일, 70개 테스트 |
| backend 테스트 | PASS — 15개 suite, 59개 테스트 |
| HQ 계약 검증 | PASS — 141개, 실패 0 |
| 기존 회귀·다국어·하드코딩·PWA 정적검사 | PASS |
| Critical 5건 제거 | PASS — audit exit 0, Critical 0건 |

검증 커밋은 `e360473c5fb0b80b3a1f68a9e5f9f532bd7b1f81`, [실행 39784369288](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39784369288), [job 119843515751](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39784369288/job/119843515751)이며 전체 결과는 `success`다. 설치 직후 출력된 `pnpm-lock.yaml` 차이를 그대로 적용한 로컬 파일의 Git blob SHA는 `6ca05e8a3a85e209a5cc693abbc8d6429afeaf72`이며, CI diff의 결과 인덱스 `6ca05e8`과 일치한다. 기존 취약 버전의 package/snapshot 참조가 제거된 것을 확인했고 `git diff --check`가 통과했다.

이번 통과는 기존 `audit:critical` 기준에 대한 결과다. 감사에는 **High 6건, Moderate 11건, Low 2건(합계 19건)**이 남아 있으며 모든 보안 취약점이 없어졌다는 의미로 기록하지 않는다. `env:check`는 명령이 성공했으나 기존 SQL PLAN ONLY와 실제 외부 endpoint 미제공에 따른 SKIP을 포함한다. 실제 ERP 접속·운영 환경 검증은 수행하지 않았다.

## 근거

- [proxy-addr 공식 advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h), [2.0.8 package.json](https://github.com/jshttp/proxy-addr/blob/v2.0.8/package.json)
- [Tinypool worker options advisory](https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3), [run options advisory](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr)
- [Tinypool 2.0.0 release](https://github.com/tinylibs/tinypool/releases/tag/v2.0.0), [v1.1.1→v2.1.2 변경](https://github.com/tinylibs/tinypool/compare/v1.1.1...v2.1.2), [2.1.2 package.json](https://github.com/tinylibs/tinypool/blob/v2.1.2/package.json)
- [Handlebars AST advisory](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-8r5x-fm3f-whwj), [own property advisory](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-p8wg-vrv2-v86f), [4.7.10 package.json](https://github.com/handlebars-lang/handlebars.js/blob/v4.7.10/package.json)
