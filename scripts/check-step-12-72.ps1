$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$migrationPath = Join-Path `
    $projectRoot `
    "supabase\migrations\20260812183500_klyx_phone_contact_audit_12_72.sql"

$apiPath = Join-Path `
    $projectRoot `
    "app\api\bookings\[id]\contact\route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BookingContactCard.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.72"
Write-Host ""

foreach ($path in @(
    $migrationPath,
    $apiPath,
    $componentPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
    }
}

$migration =
    [System.IO.File]::ReadAllText(
        $migrationPath
    )

$api =
    [System.IO.File]::ReadAllText(
        $apiPath
    )

$component =
    [System.IO.File]::ReadAllText(
        $componentPath
    )

$checks = @(
    @{
        Name = "audit table"
        Value = $migration.Contains(
            "phone_contact_access_logs"
        )
    },
    @{
        Name = "RLS enabled"
        Value = $migration.Contains(
            "enable row level security"
        )
    },
    @{
        Name = "browser denied"
        Value = $migration.Contains(
            "from anon, authenticated"
        )
    },
    @{
        Name = "API 12.72"
        Value = $api.Contains(
            "KLYX_PHONE_CONTACT_EXPIRATION_AUDIT_12_72"
        )
    },
    @{
        Name = "24 hour expiry"
        Value = $api.Contains(
            "COMPLETED_CONTACT_HOURS = 24"
        )
    },
    @{
        Name = "completion timestamp"
        Value = $api.Contains(
            "booking.completed_at"
        )
    },
    @{
        Name = "contact expiry"
        Value = $api.Contains(
            'reason: "contact_expired"'
        )
    },
    @{
        Name = "audit log"
        Value = $api.Contains(
            'event_type: "phone_reveal"'
        )
    },
    @{
        Name = "UI expiry"
        Value = $component.Contains(
            "accessExpiresAt"
        )
    },
    @{
        Name = "call button"
        Value = $component.Contains(
            '"tel:" + payload.phoneNumber'
        )
    }
)

$failed = @()

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed += $check.Name
    }
}

if ($failed.Count -gt 0) {
    throw "KLYX 12.72 static checker FAILED."
}

Push-Location $projectRoot

try {
    Write-Host ""
    Write-Host "TypeScript..."
    Write-Host ""

    $tsOutput = @(
        & npx.cmd `
            tsc `
            --noEmit `
            --pretty false 2>&1
    )

    if ($LASTEXITCODE -ne 0) {
        $tsOutput |
            Select-Object -First 120 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.72 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.72 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.72 CHECK OK"
Write-Host "Expiration contact active."
Write-Host "Audit telephone actif."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""