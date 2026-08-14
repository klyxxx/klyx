$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$phoneApi = Join-Path `
    $projectRoot `
    "app\api\profile\phone\route.ts"

$phoneUi = Join-Path `
    $projectRoot `
    "app\settings\PhoneSettingsInline.tsx"

$otpHelper = Join-Path `
    $projectRoot `
    "lib\twilio-verify.ts"

$otpSend = Join-Path `
    $projectRoot `
    "app\api\profile\phone\otp\send\route.ts"

$otpVerify = Join-Path `
    $projectRoot `
    "app\api\profile\phone\otp\verify\route.ts"

$privacyApi = Join-Path `
    $projectRoot `
    "app\api\profile\phone\privacy\route.ts"

$privacyUi = Join-Path `
    $projectRoot `
    "app\settings\PhonePrivacyControls.tsx"

$historyApi = Join-Path `
    $projectRoot `
    "app\api\profile\phone\access-history\route.ts"

$historyUi = Join-Path `
    $projectRoot `
    "app\settings\PhoneAccessHistory.tsx"

$contactApi = Join-Path `
    $projectRoot `
    "app\api\bookings\[id]\contact\route.ts"

$contactUi = Join-Path `
    $projectRoot `
    "app\components\BookingContactCard.tsx"

$bookingPage = Join-Path `
    $projectRoot `
    "app\bookings\[id]\page.tsx"

$settingsPage = Join-Path `
    $projectRoot `
    "app\settings\page.tsx"

$migrationOtp = Join-Path `
    $projectRoot `
    "supabase\migrations\20260812182000_klyx_phone_otp_security_12_71.sql"

$migrationAudit = Join-Path `
    $projectRoot `
    "supabase\migrations\20260812183500_klyx_phone_contact_audit_12_72.sql"

Write-Host ""
Write-Host "CHECK KLYX 12.77 - FINAL PHONE"
Write-Host ""

$requiredFiles = @(
    $phoneApi,
    $phoneUi,
    $otpHelper,
    $otpSend,
    $otpVerify,
    $privacyApi,
    $privacyUi,
    $historyApi,
    $historyUi,
    $contactApi,
    $contactUi,
    $bookingPage,
    $settingsPage,
    $migrationOtp,
    $migrationAudit
)

foreach ($path in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier telephone manquant : $path"
    }
}

function ReadText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.File]::ReadAllText(
        $Path
    )
}

function CountText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [string]$Needle
    )

    $count = 0
    $start = 0

    while ($true) {
        $index =
            $Text.IndexOf(
                $Needle,
                $start,
                [System.StringComparison]::Ordinal
            )

        if ($index -lt 0) {
            break
        }

        $count += 1
        $start =
            $index +
            $Needle.Length
    }

    return $count
}

$phoneApiText = ReadText $phoneApi
$phoneUiText = ReadText $phoneUi
$otpHelperText = ReadText $otpHelper
$otpSendText = ReadText $otpSend
$otpVerifyText = ReadText $otpVerify
$privacyApiText = ReadText $privacyApi
$privacyUiText = ReadText $privacyUi
$historyApiText = ReadText $historyApi
$historyUiText = ReadText $historyUi
$contactApiText = ReadText $contactApi
$contactUiText = ReadText $contactUi
$bookingText = ReadText $bookingPage
$settingsText = ReadText $settingsPage
$migrationOtpText = ReadText $migrationOtp
$migrationAuditText = ReadText $migrationAudit

$checks = @(
    @{
        Name = "phone final API"
        Value = $phoneApiText.Contains(
            "KLYX_PHONE_FINAL_12_77"
        )
    },
    @{
        Name = "same phone keeps OTP verification"
        Value =
            $phoneApiText.Contains(
                "if (phoneChanged)"
            ) -and
            $phoneApiText.Contains(
                "updatePayload.phone_verified_at = null"
            )
    },
    @{
        Name = "privacy is preserved"
        Value = $phoneApiText.Contains(
            "phone_visibility: visibility"
        )
    },
    @{
        Name = "phone UI final"
        Value = $phoneUiText.Contains(
            "KLYX_PHONE_FINAL_UI_12_77"
        )
    },
    @{
        Name = "Twilio helper"
        Value = $otpHelperText.Contains(
            "KLYX_TWILIO_VERIFY_12_69"
        )
    },
    @{
        Name = "OTP send security"
        Value = $otpSendText.Contains(
            "KLYX_PHONE_OTP_SEND_SECURITY_12_71"
        )
    },
    @{
        Name = "OTP verify security"
        Value = $otpVerifyText.Contains(
            "KLYX_PHONE_OTP_VERIFY_SECURITY_12_71"
        )
    },
    @{
        Name = "privacy API"
        Value = $privacyApiText.Contains(
            "KLYX_PHONE_PRIVACY_API_12_75"
        )
    },
    @{
        Name = "privacy UI"
        Value = $privacyUiText.Contains(
            "KLYX_PHONE_PRIVACY_UI_12_75"
        )
    },
    @{
        Name = "history API"
        Value = $historyApiText.Contains(
            "KLYX_PHONE_ACCESS_HISTORY_API_12_76"
        )
    },
    @{
        Name = "history UI"
        Value = $historyUiText.Contains(
            "KLYX_PHONE_ACCESS_HISTORY_UI_12_76"
        )
    },
    @{
        Name = "secure call API"
        Value = $contactApiText.Contains(
            "KLYX_REVALIDATED_PHONE_CALL_API_12_74"
        )
    },
    @{
        Name = "explicit reveal audit"
        Value = $contactApiText.Contains(
            '"phone_explicit_reveal"'
        )
    },
    @{
        Name = "call revalidation audit"
        Value = $contactApiText.Contains(
            '"phone_call_started"'
        )
    },
    @{
        Name = "secure call UI"
        Value = $contactUiText.Contains(
            "KLYX_REVALIDATED_PHONE_CALL_UI_12_74"
        )
    },
    @{
        Name = "call uses server PUT"
        Value = $contactUiText.Contains(
            'method: "PUT"'
        )
    },
    @{
        Name = "no direct tel link bypass"
        Value = -not $contactUiText.Contains(
            'href={"tel:"'
        )
    },
    @{
        Name = "booking contact exactly once"
        Value =
            (CountText `
                $bookingText `
                "<BookingContactCard") -eq 1
    },
    @{
        Name = "phone settings exactly once"
        Value =
            (CountText `
                $settingsText `
                "<PhoneSettingsInline />") -eq 1
    },
    @{
        Name = "privacy settings exactly once"
        Value =
            (CountText `
                $settingsText `
                "<PhonePrivacyControls />") -eq 1
    },
    @{
        Name = "history settings exactly once"
        Value =
            (CountText `
                $settingsText `
                "<PhoneAccessHistory />") -eq 1
    },
    @{
        Name = "OTP security migration"
        Value = $migrationOtpText.Contains(
            "KLYX_PHONE_OTP_SECURITY_12_71"
        )
    },
    @{
        Name = "contact audit migration"
        Value = $migrationAuditText.Contains(
            "KLYX_PHONE_CONTACT_AUDIT_12_72"
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
    Write-Host ""
    Write-Host "Echecs :"
    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.77 final phone checker FAILED."
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
            Select-Object -First 150 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.77 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.77 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.77 FINAL CHECK OK"
Write-Host "======================================"
Write-Host "Numero client/prestataire : OK"
Write-Host "OTP : OK"
Write-Host "Confidentialite : OK"
Write-Host "Revelation securisee : OK"
Write-Host "Appel revalide serveur : OK"
Write-Host "Audit : OK"
Write-Host "Build Next.js : OK"
Write-Host ""
Write-Host "PARTIE TELEPHONE TERMINEE."
Write-Host "======================================"
Write-Host ""