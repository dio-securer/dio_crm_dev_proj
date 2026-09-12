param(
  [Parameter(Mandatory=$true)][string]$Server,
  [Parameter(Mandatory=$true)][string]$Database,
  [string]$SqlUser
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) { throw 'sqlcmd is required.' }
if ($Database -match '(?i)prod|production') { throw 'Refusing a restore-drill verification against a database name containing prod/production.' }

$auth = @()
if ($SqlUser) {
  if (-not $env:SQLCMDPASSWORD) { throw 'When -SqlUser is used, set SQLCMDPASSWORD in the process environment.' }
  $auth = @('-U', $SqlUser)
} else { $auth = @('-E') }

$sql = @"
SET NOCOUNT ON;
DBCC CHECKDB ([$Database]) WITH NO_INFOMSGS;
USE [$Database];
SELECT DB_NAME() database_name, COUNT(*) user_table_count FROM sys.tables WHERE is_ms_shipped=0;
IF OBJECT_ID('dbo.crm_company') IS NOT NULL SELECT COUNT(*) company_count FROM dbo.crm_company;
IF OBJECT_ID('dbo.crm_user') IS NOT NULL SELECT COUNT(*) user_count FROM dbo.crm_user;
IF OBJECT_ID('dbo.crm_account') IS NOT NULL SELECT COUNT(*) account_count FROM dbo.crm_account WHERE deleted_yn=0;
"@

& sqlcmd -S $Server @auth -b -Q $sql
if ($LASTEXITCODE -ne 0) { throw "Post-restore verification failed with exit code $LASTEXITCODE" }
Write-Host 'Post-restore verification completed.'
