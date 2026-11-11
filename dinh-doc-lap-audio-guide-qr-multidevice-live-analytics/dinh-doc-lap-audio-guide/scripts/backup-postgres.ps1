param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$containerId = (docker compose --project-directory $projectDirectory ps -q postgres).Trim()

if (-not $containerId) {
  throw "PostgreSQL container is not running. Run 'docker compose up -d' first."
}

$databaseName = (docker compose --project-directory $projectDirectory exec -T postgres printenv POSTGRES_DB).Trim()
$databaseUser = (docker compose --project-directory $projectDirectory exec -T postgres printenv POSTGRES_USER).Trim()
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$containerBackup = "/tmp/$databaseName-$timestamp.dump"

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$hostBackup = Join-Path (Resolve-Path $OutputDirectory).Path "$databaseName-$timestamp.dump"

try {
  docker compose --project-directory $projectDirectory exec -T postgres pg_dump `
    --username $databaseUser `
    --dbname $databaseName `
    --format custom `
    --file $containerBackup
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }

  docker compose --project-directory $projectDirectory exec -T postgres pg_restore --list $containerBackup | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Backup verification failed." }

  docker cp "${containerId}:$containerBackup" $hostBackup
  if ($LASTEXITCODE -ne 0) { throw "Could not copy the backup to Windows." }
}
finally {
  docker compose --project-directory $projectDirectory exec -T postgres rm -f $containerBackup 2>$null
}

Write-Host "Backup created and verified: $hostBackup"
