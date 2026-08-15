$ErrorActionPreference = "Stop"

$root = "C:\Users\fenjo\Documents\klyx"

Set-Location $root

$utf8 =
    [System.Text.UTF8Encoding]::new(
        $false
    )

$backupRoot =
    Join-Path `
        $root `
        ".klyx-local-backup\phase-4-recovery"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $backupRoot |
    Out-Null

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX MASTER PHASE 4 - REAL REPAIR"
Write-Host "======================================"

# ==================================================
# 1. GITIGNORE FIRST
# ==================================================

Write-Host ""
Write-Host "1. .gitignore"

$gitignorePath =
    Join-Path `
        $root `
        ".gitignore"

$gitignoreLines =
    @()

if (
    Test-Path `
        -LiteralPath $gitignorePath `
        -PathType Leaf
) {
    $gitignoreLines =
        @(
            Get-Content `
                -LiteralPath $gitignorePath
        )
}

$rules =
    @(
        "*.bak",
        ".klyx-local-backup/",
        "reports/master-audit/*.log"
    )

foreach ($rule in $rules) {
    if (
        $gitignoreLines -notcontains
        $rule
    ) {
        $gitignoreLines +=
            $rule
    }
}

[System.IO.File]::WriteAllLines(
    $gitignorePath,
    $gitignoreLines,
    $utf8
)

Write-Host "[OK] *.bak ignored"
Write-Host "[OK] .klyx-local-backup ignored"

# ==================================================
# 2. BACKUP IMPORTANT FILES
# ==================================================

Write-Host ""
Write-Host "2. Local safety backup"

$adminPath =
    Join-Path `
        $root `
        "app\api\admin\stripe-readiness\route.ts"

$financePath =
    Join-Path `
        $root `
        "app\api\provider\finance\route.ts"

foreach ($source in @(
    $adminPath,
    $financePath,
    $gitignorePath
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $source `
                -PathType Leaf
        )
    ) {
        throw "Fichier introuvable : $source"
    }

    $relative =
        $source.Substring(
            $root.Length
        ).TrimStart(
            "\"
        )

    $destination =
        Join-Path `
            $backupRoot `
            $relative

    $destinationDirectory =
        Split-Path `
            -Parent `
            $destination

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $destinationDirectory |
        Out-Null

    Copy-Item `
        -LiteralPath $source `
        -Destination $destination `
        -Force
}

foreach ($legacyRelative in @(
    "app\reset-accounts",
    "app\dev\accounts"
)) {
    $legacySource =
        Join-Path `
            $root `
            $legacyRelative

    if (
        Test-Path `
            -LiteralPath $legacySource `
            -PathType Container
    ) {
        $legacyDestination =
            Join-Path `
                $backupRoot `
                $legacyRelative

        $legacyParent =
            Split-Path `
                -Parent `
                $legacyDestination

        New-Item `
            -ItemType Directory `
            -Force `
            -Path $legacyParent |
            Out-Null

        Copy-Item `
            -LiteralPath $legacySource `
            -Destination $legacyDestination `
            -Recurse `
            -Force
    }
}

Write-Host "[OK] Safety copies created"

# ==================================================
# 3. ADMIN STRIPE SECURITY
# ==================================================

Write-Host ""
Write-Host "3. Stripe readiness admin guard"

$adminText =
    [System.IO.File]::ReadAllText(
        $adminPath
    )

if (
    -not $adminText.Contains(
        "requireKlyxAdmin"
    )
) {
    $oldImport =
        'import { getAuthenticatedProfile } from "@/lib/api-auth";'

    $newImport =
        "import {`r`n" +
        "  adminErrorStatus,`r`n" +
        "  requireKlyxAdmin,`r`n" +
        "} from `"@/lib/admin-auth`";"

    if (
        -not $adminText.Contains(
            $oldImport
        )
    ) {
        throw "Ancien import api-auth Stripe readiness introuvable."
    }

    $adminText =
        $adminText.Replace(
            $oldImport,
            $newImport
        )

    $adminText =
        [regex]::Replace(
            $adminText,
            '(?s)\r?\nasync function requireAdmin\(request: Request\)\s*\{.*?\r?\n\}\r?\n(?=\r?\nexport async function GET)',
            ""
        )

    $adminText =
        $adminText.Replace(
            "export async function GET(request: Request) {",
            "export async function GET() {"
        )

    $adminText =
        $adminText.Replace(
            "await requireAdmin(request);",
            "await requireKlyxAdmin();"
        )

    $adminText =
        [regex]::Replace(
            $adminText,
            'status:\s*message\s*===\s*"Acces administrateur requis\."\s*\?\s*403\s*:\s*500,',
            'status: adminErrorStatus(error),'
        )

    [System.IO.File]::WriteAllText(
        $adminPath,
        $adminText,
        $utf8
    )
}

$adminCheck =
    [System.IO.File]::ReadAllText(
        $adminPath
    )

if (
    -not $adminCheck.Contains(
        "requireKlyxAdmin"
    )
) {
    throw "requireKlyxAdmin absent après correction."
}

if (
    -not $adminCheck.Contains(
        "adminErrorStatus"
    )
) {
    throw "adminErrorStatus absent après correction."
}

if (
    $adminCheck.Contains(
        "KLYX_ADMIN_EMAILS"
    )
) {
    throw "Ancien KLYX_ADMIN_EMAILS encore présent."
}

Write-Host "[OK] Admin security centralized"

# ==================================================
# 4. PROVIDER FINANCE CURRENCY
# ==================================================

Write-Host ""
Write-Host "4. Provider finance dynamic currency"

$financeText =
    [System.IO.File]::ReadAllText(
        $financePath
    )

if (
    -not $financeText.Contains(
        "KLYX_PROVIDER_FINANCE_CURRENCY_PHASE_4"
    )
) {
    $financeText =
        [regex]::Replace(
            $financeText,
            'currency:\s*\r?\n\s*"EUR",',
            "currency:`r`n            profile.currencyCode,",
            1
        )

    $financeText =
        [regex]::Replace(
            $financeText,
            'successfulPaymentRows\[0\]\s*\r?\n\s*\?\.currency\s*\|\|\s*\r?\n\s*ledger\[0\]\s*\r?\n\s*\?\.currency\s*\|\|\s*\r?\n\s*"EUR";',
            "successfulPaymentRows[0]`r`n" +
            "        ?.currency ||`r`n" +
            "      ledger[0]`r`n" +
            "        ?.currency ||`r`n" +
            "      profile.currencyCode;",
            1
        )

    $financeText =
        [regex]::Replace(
            $financeText,
            'entry\.currency\s*\|\|\s*\r?\n\s*"EUR"',
            "entry.currency ||`r`n                profile.currencyCode"
        )

    $financeText =
        $financeText.Replace(
            "function eurosToCents(",
            "function majorUnitsToCents("
        )

    $financeText =
        $financeText.Replace(
            "eurosToCents(",
            "majorUnitsToCents("
        )

    $financeText =
        $financeText.Replace(
            "Un refund partiel reel de 30 EUR",
            "Un refund partiel reel de 30 unites"
        )

    $financeText =
        $financeText.Replace(
            "sur un groupe de 100 EUR reste 30.",
            "sur un groupe de 100 unites reste 30."
        )

    $financeMarker =
        "// KLYX_GROUP_AWARE_FINANCE_COUNTS_13_04"

    if (
        -not $financeText.Contains(
            $financeMarker
        )
    ) {
        throw "Marker finance historique introuvable."
    }

    $financeText =
        $financeText.Replace(
            $financeMarker,
            "// KLYX_PROVIDER_FINANCE_CURRENCY_PHASE_4`r`n" +
            "// Transaction currency first, authenticated profile currency only as empty/fallback context.`r`n" +
            $financeMarker
        )

    [System.IO.File]::WriteAllText(
        $financePath,
        $financeText,
        $utf8
    )
}

$financeCheck =
    [System.IO.File]::ReadAllText(
        $financePath
    )

if (
    -not $financeCheck.Contains(
        "KLYX_PROVIDER_FINANCE_CURRENCY_PHASE_4"
    )
) {
    throw "Marker Phase 4 finance absent."
}

if (
    -not $financeCheck.Contains(
        "profile.currencyCode"
    )
) {
    throw "profile.currencyCode absent."
}

if (
    [regex]::IsMatch(
        $financeCheck,
        '(?i)(\|\||\?\?)\s*"EUR"'
    )
) {
    throw "Fallback EUR finance encore présent."
}

if (
    [regex]::IsMatch(
        $financeCheck,
        '(?i)currency\s*:\s*"EUR"'
    )
) {
    throw "Currency EUR finance encore présente."
}

Write-Host "[OK] Finance currency dynamic"

# ==================================================
# 5. REMOVE OBSOLETE ROUTES
# ==================================================

Write-Host ""
Write-Host "5. Legacy routes"

foreach ($legacyRelative in @(
    "app\reset-accounts",
    "app\dev\accounts"
)) {
    $legacyPath =
        Join-Path `
            $root `
            $legacyRelative

    if (
        Test-Path `
            -LiteralPath $legacyPath `
            -PathType Container
    ) {
        Remove-Item `
            -LiteralPath $legacyPath `
            -Recurse `
            -Force

        Write-Host "[REMOVED] $legacyRelative"
    }
}

if (
    Test-Path `
        -LiteralPath (
            Join-Path $root "app\reset-accounts"
        )
) {
    throw "reset-accounts encore présent."
}

if (
    Test-Path `
        -LiteralPath (
            Join-Path $root "app\dev\accounts"
        )
) {
    throw "dev/accounts encore présent."
}

Write-Host "[OK] Legacy routes removed"

# ==================================================
# 6. ENSURE ALL .BAK ARE UNTRACKED
# ==================================================

Write-Host ""
Write-Host "6. Git .bak"

$trackedBak =
    @(
        git ls-files |
        Where-Object {
            $_ -match '\.bak$'
        }
    )

foreach ($file in $trackedBak) {
    git rm `
        --cached `
        --ignore-unmatch `
        -- `
        $file |
        Out-Null

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "git rm --cached failed : $file"
    }
}

$remainingTrackedBak =
    @(
        git ls-files |
        Where-Object {
            $_ -match '\.bak$'
        }
    )

if (
    $remainingTrackedBak.Count -ne 0
) {
    throw "$($remainingTrackedBak.Count) .bak encore suivis."
}

Write-Host "[OK] Tracked .bak = 0"

# ==================================================
# 7. STATIC CHECK
# ==================================================

Write-Host ""
Write-Host "7. Static verification"

$gitignoreCheck =
    [System.IO.File]::ReadAllText(
        $gitignorePath
    )

if (
    -not $gitignoreCheck.Contains(
        "*.bak"
    )
) {
    throw "*.bak absent de .gitignore."
}

if (
    -not $gitignoreCheck.Contains(
        ".klyx-local-backup/"
    )
) {
    throw ".klyx-local-backup absent de .gitignore."
}

Write-Host "[OK] Static Phase 4 verification"

# ==================================================
# 8. TESTS
# ==================================================

Write-Host ""
Write-Host "----- TESTS -----"

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "Tests FAILED."
}

# ==================================================
# 9. TYPESCRIPT
# ==================================================

Write-Host ""
Write-Host "----- TYPESCRIPT -----"

npx.cmd tsc `
    --noEmit `
    --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "TypeScript FAILED."
}

# ==================================================
# 10. BUILD
# ==================================================

Write-Host ""
Write-Host "----- BUILD -----"

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "Build FAILED."
}

# ==================================================
# 11. FINAL STATE
# ==================================================

$finalTrackedBak =
    @(
        git ls-files |
        Where-Object {
            $_ -match '\.bak$'
        }
    )

$resetExists =
    Test-Path `
        -LiteralPath (
            Join-Path `
                $root `
                "app\reset-accounts"
        )

$devExists =
    Test-Path `
        -LiteralPath (
            Join-Path `
                $root `
                "app\dev\accounts"
        )

$adminFinal =
    [System.IO.File]::ReadAllText(
        $adminPath
    )

$financeFinal =
    [System.IO.File]::ReadAllText(
        $financePath
    )

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX MASTER PHASE 4 REAL CHECK OK"
Write-Host "======================================"
Write-Host "Admin requireKlyxAdmin : $($adminFinal.Contains('requireKlyxAdmin'))"
Write-Host "Old admin email guard  : $($adminFinal.Contains('KLYX_ADMIN_EMAILS'))"
Write-Host "Finance marker         : $($financeFinal.Contains('KLYX_PROVIDER_FINANCE_CURRENCY_PHASE_4'))"
Write-Host "Finance profile money  : $($financeFinal.Contains('profile.currencyCode'))"
Write-Host "reset-accounts exists  : $resetExists"
Write-Host "dev/accounts exists    : $devExists"
Write-Host "Tracked .bak           : $($finalTrackedBak.Count)"
Write-Host "gitignore *.bak        : $($gitignoreCheck.Contains('*.bak'))"
Write-Host "Local recovery backup  : $(Test-Path $backupRoot)"
Write-Host "Tests                  : PASS"
Write-Host "TypeScript             : PASS"
Write-Host "Build                  : PASS"
Write-Host "======================================"

Write-Host ""
Write-Host "GIT STATUS SUMMARY"
Write-Host "--------------------------------------"

$gitStatus =
    @(
        git status --short
    )

Write-Host "Entries : $($gitStatus.Count)"

Write-Host ""
Write-Host "Next audited target:"
Write-Host "UI multi-currency + MASTER GATE refresh"