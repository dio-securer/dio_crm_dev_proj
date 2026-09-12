param(
  [Parameter(Mandatory=$true)][string]$Server,
  [Parameter(Mandatory=$true)][string]$Database,
  [Parameter(Mandatory=$true)][string]$BackupPath,
  [string]$SqlUser,
  [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) { throw 'sqlcmd is required.' }

$escapedDb = $Database.Replace(']', ']]')
$escapedPath = $BackupPath.Replace("'", "''")
$auth = @()
if ($SqlUser) {
  if (-not $env:SQLCMDPASSWORD) { throw 'When -SqlUser is used, set SQLCMDPASSWORD in the process environment.' }
  $auth = @('-U', $SqlUser)
} else {
  $auth = @('-E')
}

if (-not $VerifyOnly) {
  $backupSql = "BACKUP DATABASE [$escapedDb] TO DISK=N'$escapedPath' WITH INIT, COMPRESSION, CHECKSUM, STATS=10;"
  & sqlcmd -S $Server @auth -b -Q $backupSql
  if ($LASTEXITCODE -ne 0) { throw "BACKUP DATABASE failed with exit code $LASTEXITCODE" }
}

$verifySql = "RESTORE VERIFYONLY FROM DISK=N'$escapedPath' WITH CHECKSUM;"
& sqlcmd -S $Server @auth -b -Q $verifySql
if ($LASTEXITCODE -ne 0) { throw "RESTORE VERIFYONLY failed with exit code $LASTEXITCODE" }

Write-Host "Backup verification completed: $BackupPath"
