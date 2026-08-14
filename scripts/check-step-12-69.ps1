$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$helperPath = Join-Path $projectRoot "lib\twilio-verify.ts"
$sendPath = Join-Path $projectRoot "app\api\profile\phone\otp\send\route.ts"
$verifyPath = Join-Path $projectRoot "app\api\profile\phone\otp\verify\route.ts"
$phonePath = Join-Path $projectRoot "app\settings\PhoneSettingsInline.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.69"
Write-Host ""

foreach ($path in @(
    $helperPath,
    $sendPath,
    $verifyPath,
    $phonePath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
    }
}

$helper = [System.IO.File]::ReadAllText($helperPath)
$send = [System.IO.File]::ReadAllText($sendPath)
$verify = [System.IO.File]::ReadAllText($verifyPath)
$phone = [System.IO.File]::ReadAllText($phonePath)

$checks = @(
    @{
        Name = "Twilio Verify helper"
        Value = $helper.Contains(
            "KLYX_TWILIO_VERIFY_12_69"
        )
    },
    @{
        Name = "OTP send API"
        Value = $send.Contains(
            "KLYX_PHONE_OTP_SEND_12_69"
        )
    },
    @{
        Name = "OTP verify API"
        Value = $verify.Contains(
            "KLYX_PHONE_OTP_VERIFY_12_69"
        )
    },
    @{
        Name = "OTP settings UI"
        Value = $phone.Contains(
            "KLYX_PHONE_OTP_UI_12_69"
        )
    },
    @{
        Name = "SMS endpoint"
        Value = $helper.Contains(
            "/Verifications"
        )
    },
    @{
        Name = "verification check"
        Value = $helper.Contains(
            "/VerificationCheck"
        )
    },
    @{
        Name = "verified timestamp"
        Value = $verify.Contains(
            "phone_verified_at: verifiedAt"
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
    throw "KLYX 12.69 static checker FAILED."
}

Push-Location $projectRoot

try {
    Write-Host ""
    Write-Host "TypeScript..."
    Write-Host ""

    $tsOutput = @(
        & npx.cmd tsc --noEmit --pretty false 2>&1
    )

    if ($LASTEXITCODE -ne 0) {
        $tsOutput |
            Select-Object -First 120 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.69 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.69 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.69 CHECK OK"
Write-Host "OTP telephone integre."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""