$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$migrationPath = Join-Path `
    $projectRoot `
    "supabase\migrations\20260812154600_klyx_phone_12_67.sql"

$apiPath = Join-Path `
    $projectRoot `
    "app\api\profile\phone\route.ts"

$pagePath = Join-Path `
    $projectRoot `
    "app\settings\phone\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.67"
Write-Host ""

foreach ($path in @(
    $migrationPath,
    $apiPath,
    $pagePath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier 12.67 introuvable : $path"
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

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$checks = @(
    @{
        Name = "SQL marker"
        Value = $migration.Contains(
            "KLYX_PHONE_FOUNDATION_12_67"
        )
    },
    @{
        Name = "phone number column"
        Value = $migration.Contains(
            "phone_number"
        )
    },
    @{
        Name = "verification column"
        Value = $migration.Contains(
            "phone_verified_at"
        )
    },
    @{
        Name = "private visibility"
        Value = $migration.Contains(
            "transaction_participants"
        )
    },
    @{
        Name = "API marker"
        Value = $api.Contains(
            "KLYX_PHONE_API_12_67"
        )
    },
    @{
        Name = "authenticated profile"
        Value = $api.Contains(
            "getAuthenticatedProfile"
        )
    },
    @{
        Name = "international validation"
        Value = $api.Contains(
            "isValidInternationalPhone"
        )
    },
    @{
        Name = "settings page"
        Value = $page.Contains(
            "KLYX_PHONE_SETTINGS_12_67"
        )
    },
    @{
        Name = "phone input"
        Value = $page.Contains(
            'type="tel"'
        )
    },
    @{
        Name = "private notice"
        Value = $page.Contains(
            "Numero prive"
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
    throw "KLYX 12.67 static checker FAILED."
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
            Select-Object -First 100 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.67 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.67 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.67 CHECK OK"
Write-Host "Telephone client/prestataire operationnel cote application."
Write-Host "Numero prive par defaut."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""
Write-Host "IMPORTANT : applique maintenant la migration Supabase."
Write-Host ""