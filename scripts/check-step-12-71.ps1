$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$migrationPath = Join-Path `
    $projectRoot `
    "supabase\migrations\20260812182000_klyx_phone_otp_security_12_71.sql"

$sendPath = Join-Path `
    $projectRoot `
    "app\api\profile\phone\otp\send\route.ts"

$verifyPath = Join-Path `
    $projectRoot `
    "app\api\profile\phone\otp\verify\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.71"
Write-Host ""

foreach ($path in @(
    $migrationPath,
    $sendPath,
    $verifyPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
    }
}

$migration =
    [System.IO.File]::ReadAllText(
        $migrationPath
    )

$send =
    [System.IO.File]::ReadAllText(
        $sendPath
    )

$verify =
    [System.IO.File]::ReadAllText(
        $verifyPath
    )

$checks = @(
    @{
        Name = "security table"
        Value = $migration.Contains(
            "phone_verification_limits"
        )
    },
    @{
        Name = "RLS"
        Value = $migration.Contains(
            "enable row level security"
        )
    },
    @{
        Name = "browser access revoked"
        Value = $migration.Contains(
            "from anon, authenticated"
        )
    },
    @{
        Name = "60 second cooldown"
        Value = $send.Contains(
            "SEND_COOLDOWN_SECONDS = 60"
        )
    },
    @{
        Name = "persistent last send"
        Value = $send.Contains(
            "last_sent_at: sentAt"
        )
    },
    @{
        Name = "5 failed attempts"
        Value = $verify.Contains(
            "MAX_FAILED_ATTEMPTS = 5"
        )
    },
    @{
        Name = "15 minute lock"
        Value = $verify.Contains(
            "LOCK_MINUTES = 15"
        )
    },
    @{
        Name = "success reset"
        Value =
            $verify.Contains(
                "failed_attempts: 0"
            ) -and
            $verify.Contains(
                "locked_until: null"
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
    throw "KLYX 12.71 static checker FAILED."
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

        throw "KLYX 12.71 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.71 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.71 CHECK OK"
Write-Host "OTP anti-abus persistant."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""