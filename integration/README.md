# Integration Layer

Phase 1에서는 실제 ERP/HIRA endpoint를 연결하지 않는다.

기준:
- 모든 외부 연동은 `InterfaceService`를 통해 request_id를 생성한다.
- Business Entity 상태와 InterfaceLog 상세이력을 분리한다.
- ERP/HIRA별 Adapter는 Phase 2+에서 `integration/adapters/` 하위로 추가한다.
- 운영 ERP DB 직접 수정은 금지한다.
- Retry/Timeout/Error Mapping은 Adapter에서 구체화하고, 실패는 `crm_interface_log`로 운영자에게 노출한다.
