// Tables of the metadata version store (F2-3). Only crm_meta_* tables; nothing here drops or alters another table.
// Every statement is idempotent: running it again on a database that already has the tables changes nothing.
export const CRM_META_TABLES = ['crm_meta_version', 'crm_meta_pointer', 'crm_meta_event'] as const;

export const CRM_META_SCHEMA: readonly string[] = [
  `IF OBJECT_ID(N'dbo.crm_meta_version', N'U') IS NULL
CREATE TABLE dbo.crm_meta_version (
  id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_crm_meta_version PRIMARY KEY,
  status NVARCHAR(20) NOT NULL CONSTRAINT ck_crm_meta_version_status
    CHECK (status IN (N'staging', N'published', N'superseded', N'rolled_back', N'discarded')),
  files_json NVARCHAR(MAX) NOT NULL CONSTRAINT ck_crm_meta_version_json CHECK (ISJSON(files_json) = 1),
  created_by NVARCHAR(100) NOT NULL,
  created_at DATETIME2(3) NOT NULL,
  published_at DATETIME2(3) NULL,
  previous_id INT NULL CONSTRAINT fk_crm_meta_version_previous REFERENCES dbo.crm_meta_version(id),
  note NVARCHAR(400) NULL
)`,
  `IF OBJECT_ID(N'dbo.crm_meta_pointer', N'U') IS NULL
CREATE TABLE dbo.crm_meta_pointer (
  id TINYINT NOT NULL CONSTRAINT pk_crm_meta_pointer PRIMARY KEY CONSTRAINT ck_crm_meta_pointer_single CHECK (id = 1),
  published_version_id INT NULL CONSTRAINT fk_crm_meta_pointer_version REFERENCES dbo.crm_meta_version(id)
)`,
  `IF NOT EXISTS (SELECT 1 FROM dbo.crm_meta_pointer WHERE id = 1)
INSERT INTO dbo.crm_meta_pointer (id, published_version_id) VALUES (1, NULL)`,
  `IF OBJECT_ID(N'dbo.crm_meta_event', N'U') IS NULL
CREATE TABLE dbo.crm_meta_event (
  id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_crm_meta_event PRIMARY KEY,
  version_id INT NOT NULL CONSTRAINT fk_crm_meta_event_version REFERENCES dbo.crm_meta_version(id),
  action NVARCHAR(20) NOT NULL,
  actor NVARCHAR(100) NOT NULL,
  at DATETIME2(3) NOT NULL,
  from_version_id INT NULL
)`,
];
