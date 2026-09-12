SET XACT_ABORT ON;
BEGIN TRAN;

MERGE dbo.crm_permission AS t
USING (VALUES
 ('ACTIVITY.READ',N'영업활동 조회'),
 ('ACTIVITY.WRITE',N'영업활동 계획/수정'),
 ('ACTIVITY.MANAGE',N'영업활동 관리자 조회/관리'),
 ('ACTIVITY.CHECKIN',N'영업활동 GPS IN'),
 ('ACTIVITY.CHECKOUT',N'영업활동 OUT'),
 ('ACTIVITY.REPORT',N'활동보고 작성/요청'),
 ('ACTIVITY.REPORT.APPROVE.BRANCH',N'활동보고 지점장 승인'),
 ('ACTIVITY.REPORT.APPROVE.DIVISION',N'활동보고 본부장 승인'),
 ('DIRECT_WORK.READ',N'직출/직퇴 조회'),
 ('DIRECT_WORK.REQUEST',N'직출/직퇴 승인요청'),
 ('DIRECT_WORK.APPROVE.BRANCH',N'직출/직퇴 지점장 승인/반려'),
 ('DIRECT_WORK.APPROVE.DIVISION',N'직출/직퇴 본부장 승인/반려'),
 ('APPROVAL.ROUTE.MANAGE',N'승인경로 관리')
) AS s(permission_code, permission_name)
ON t.permission_code=s.permission_code
WHEN NOT MATCHED THEN INSERT(permission_code,permission_name,is_active) VALUES(s.permission_code,s.permission_name,1);

MERGE dbo.crm_common_code AS t
USING (VALUES
 ('ACTIVITY_STATUS','PLANNED',N'예정',10),
 ('ACTIVITY_STATUS','IN_PROGRESS',N'진행중',20),
 ('ACTIVITY_STATUS','COMPLETED',N'완료',30),
 ('ACTIVITY_REPORT_STATUS','DRAFT',N'승인요청 전',10),
 ('ACTIVITY_REPORT_STATUS','REQUESTED',N'승인요청 완료',20),
 ('ACTIVITY_REPORT_STATUS','BRANCH_APPROVED',N'지점장 승인완료',30),
 ('ACTIVITY_REPORT_STATUS','FINAL_APPROVED',N'본부장/최종 승인완료',40),
 ('DIRECT_WORK_TYPE','DIRECT_WORK',N'직출',10),
 ('DIRECT_WORK_TYPE','DIRECT_LEAVE',N'직퇴',20),
 ('DIRECT_WORK_STATUS','DRAFT',N'작성중',10),
 ('DIRECT_WORK_STATUS','REQUESTED',N'승인요청',20),
 ('DIRECT_WORK_STATUS','BRANCH_APPROVED',N'지점장 승인',30),
 ('DIRECT_WORK_STATUS','DIVISION_APPROVED',N'본부장 승인',40),
 ('DIRECT_WORK_STATUS','BRANCH_REJECTED',N'지점장 반려',50),
 ('DIRECT_WORK_STATUS','DIVISION_REJECTED',N'본부장 반려',60)
) AS s(group_code,code,code_name,sort_order)
ON t.company_id IS NULL AND t.group_code=s.group_code AND t.code=s.code
WHEN NOT MATCHED THEN INSERT(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
VALUES(NULL,s.group_code,s.code,s.code_name,s.sort_order,1,0);

IF NOT EXISTS (SELECT 1 FROM dbo.crm_system_setting WHERE company_id IS NULL AND setting_key='ACTIVITY_GPS_IN_DISTANCE_M')
  INSERT INTO dbo.crm_system_setting(company_id,setting_key,setting_value,description)
  VALUES(NULL,'ACTIVITY_GPS_IN_DISTANCE_M',N'200',N'영업활동 GPS IN 허용거리(m). Phase 0 GAP-001 승인값.');

COMMIT;
