param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [string]$TestDatabase = "dinhguide_restore_test"
)

$ErrorActionPreference = "Stop"
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedBackup = (Resolve-Path $BackupFile).Path

if ($TestDatabase -notmatch '^[a-zA-Z][a-zA-Z0-9_]*_restore_test$') {
  throw "TestDatabase must end with '_restore_test' and contain only letters, numbers, and underscores."
}

$containerId = (docker compose --project-directory $projectDirectory ps -q postgres).Trim()
if (-not $containerId) {
  throw "PostgreSQL container is not running. Run 'docker compose up -d' first."
}

$databaseName = (docker compose --project-directory $projectDirectory exec -T postgres printenv POSTGRES_DB).Trim()
$databaseUser = (docker compose --project-directory $projectDirectory exec -T postgres printenv POSTGRES_USER).Trim()
if ($TestDatabase -eq $databaseName) {
  throw "Refusing to restore over the application database."
}

$containerBackup = "/tmp/restore-test.dump"
try {
  docker cp $resolvedBackup "${containerId}:$containerBackup"
  if ($LASTEXITCODE -ne 0) { throw "Could not copy the backup into PostgreSQL." }

  docker compose --project-directory $projectDirectory exec -T postgres dropdb `
    --username $databaseUser --if-exists $TestDatabase
  docker compose --project-directory $projectDirectory exec -T postgres createdb `
    --username $databaseUser $TestDatabase
  if ($LASTEXITCODE -ne 0) { throw "Could not create the temporary restore database." }

  docker compose --project-directory $projectDirectory exec -T postgres pg_restore `
    --username $databaseUser `
    --dbname $TestDatabase `
    --exit-on-error `
    $containerBackup
  if ($LASTEXITCODE -ne 0) { throw "Restore test failed." }

  $tableCount = (docker compose --project-directory $projectDirectory exec -T postgres psql `
    --username $databaseUser `
    --dbname $TestDatabase `
    --tuples-only `
    --no-align `
    --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()

  Write-Host "Restore test passed. Public tables restored: $tableCount"
}
finally {
  docker compose --project-directory $projectDirectory exec -T postgres dropdb `
    --username $databaseUser --if-exists $TestDatabase 2>$null
  docker compose --project-directory $projectDirectory exec -T postgres rm -f $containerBackup 2>$null
}
