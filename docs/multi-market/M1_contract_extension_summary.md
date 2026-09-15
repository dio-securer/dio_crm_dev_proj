# RM-MKT-001 M1 Change Summary

## Result

`GlobalizationContext`를 Multi-Market Profile 확장에 대비해 Backward-compatible하게 확장했다.

## Added profile codes

```text
marketTemplateCode
screenProfileCode
fieldProfileCode
featureProfileCode
integrationProfileCode
```

기존 `marketProfileCode`, `workflowProfileCode`, `mapProfileCode`는 유지한다.

## Current KR baseline

```text
KR_SALES
HQ_TEMPLATE
HQ_SCREEN_PROFILE
HQ_FIELD_PROFILE
HQ_FEATURE_PROFILE
KR_SALES_APPROVAL
HQ_INTEGRATION_PROFILE
KR_DEFAULT
```

## Compatibility

신규 Profile Code는 Contract에서 Optional이다. 따라서 기존 `/api/me/context` Payload는 계속 유효하다.

## No environment change

- DB migration 없음
- DEV/UAT 적용 없음
- Production 변경 없음
- US/MX/IN/PT/TR Profile 생성 없음
