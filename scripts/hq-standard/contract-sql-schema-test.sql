SET NOCOUNT ON;
IF DB_NAME() <> 'CodexContractTest' THROW 51000, 'This test must only run in the isolated CodexContractTest database.', 1;
IF COL_LENGTH('dbo.crm_contract','description') IS NULL THROW 51001, 'Contract description column is missing.', 1;
IF COL_LENGTH('dbo.crm_collection_plan','deleted_yn') IS NULL THROW 51002, 'Plan preservation column is missing.', 1;
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('dbo.crm_contract') AND name='UQ_contract_opportunity') THROW 51003, 'Opportunity still has a single-contract constraint.', 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.crm_collection_plan') AND name='UX_collection_plan_active_installment' AND has_filter=1) THROW 51004, 'Active plan uniqueness is missing.', 1;
PRINT 'Contract schema requirements are present.';
