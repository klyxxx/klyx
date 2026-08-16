$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$utf8 =
    [System.Text.UTF8Encoding]::new(
        $false
    )

$reportDir =
    Join-Path `
        $root `
        "reports\master-audit"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $reportDir |
    Out-Null

$jsonPath =
    Join-Path `
        $reportDir `
        "KLYX_MASTER_AUDIT.json"

$txtPath =
    Join-Path `
        $reportDir `
        "KLYX_MASTER_AUDIT.txt"

$mdPath =
    Join-Path `
        $reportDir `
        "KLYX_MASTER_STATE.md"

$testLog =
    Join-Path `
        $reportDir `
        "tests.log"

$tsLog =
    Join-Path `
        $reportDir `
        "typescript.log"

$buildLog =
    Join-Path `
        $reportDir `
        "build.log"

function Relative-Path(
    [string]$Path
) {
    $full =
        [System.IO.Path]::GetFullPath(
            $Path
        )

    $base =
        [System.IO.Path]::GetFullPath(
            $root
        ).TrimEnd(
            "\"
        ) + "\"

    if (
        $full.StartsWith(
            $base,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    ) {
        return $full.Substring(
            $base.Length
        ).Replace(
            "\",
            "/"
        )
    }

    return $full.Replace(
        "\",
        "/"
    )
}

function Existing-File(
    [string]$Relative
) {
    return Test-Path `
        -LiteralPath (
            Join-Path `
                $root `
                $Relative
        ) `
        -PathType Leaf
}

function Existing-Directory(
    [string]$Relative
) {
    return Test-Path `
        -LiteralPath (
            Join-Path `
                $root `
                $Relative
        ) `
        -PathType Container
}

function Read-Safe(
    [string]$Path
) {
    try {
        return [System.IO.File]::ReadAllText(
            $Path
        )
    }
    catch {
        return ""
    }
}

function Scan-Files(
    [System.IO.FileInfo[]]$Files,
    [string]$Pattern
) {
    $hits =
        [System.Collections.Generic.HashSet[string]]::new(
            [System.StringComparer]::OrdinalIgnoreCase
        )

    foreach ($file in $Files) {
        $text =
            Read-Safe `
                $file.FullName

        if (
            $text -and
            [regex]::IsMatch(
                $text,
                $Pattern,
                [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
            )
        ) {
            [void]$hits.Add(
                (Relative-Path $file.FullName)
            )
        }
    }

    return @(
        $hits |
        Sort-Object
    )
}

function Add-Unique(
    [System.Collections.Generic.HashSet[string]]$Set,
    [string]$Value
) {
    if (
        -not [string]::IsNullOrWhiteSpace(
            $Value
        )
    ) {
        [void]$Set.Add(
            $Value.Trim()
        )
    }
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX MASTER AUDIT"
Write-Host "======================================"
Write-Host ""

# ==================================================
# FILE INVENTORY
# ==================================================

$scanDirectories = @(
    "app",
    "lib",
    "supabase",
    "tests"
)

$sourceFiles = @()

foreach ($directory in $scanDirectories) {
    $full =
        Join-Path `
            $root `
            $directory

    if (
        Test-Path `
            -LiteralPath $full `
            -PathType Container
    ) {
        $sourceFiles += @(
            Get-ChildItem `
                -LiteralPath $full `
                -Recurse `
                -File `
                -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -notmatch '\.bak$' -and
                $_.Extension -in @(
                    ".ts",
                    ".tsx",
                    ".js",
                    ".jsx",
                    ".sql",
                    ".json",
                    ".md",
                    ".css"
                )
            }
        )
    }
}

$scriptFiles = @()

$scriptsDirectory =
    Join-Path `
        $root `
        "scripts"

if (
    Test-Path `
        -LiteralPath $scriptsDirectory
) {
    $scriptFiles =
        @(
            Get-ChildItem `
                -LiteralPath $scriptsDirectory `
                -File `
                -Filter "*.ps1" `
                -ErrorAction SilentlyContinue
        )
}

$pageFiles =
    @(
        Get-ChildItem `
            -LiteralPath (
                Join-Path $root "app"
            ) `
            -Recurse `
            -File `
            -Filter "page.tsx" `
            -ErrorAction SilentlyContinue
    )

$routeFiles =
    @(
        Get-ChildItem `
            -LiteralPath (
                Join-Path $root "app"
            ) `
            -Recurse `
            -File `
            -Filter "route.ts" `
            -ErrorAction SilentlyContinue
    )

$testFiles =
    @(
        Get-ChildItem `
            -LiteralPath (
                Join-Path $root "tests"
            ) `
            -Recurse `
            -File `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -match '\.(test|spec)\.(ts|tsx|js|jsx)$'
        }
    )

$migrationFiles = @()

$migrationDirectory =
    Join-Path `
        $root `
        "supabase\migrations"

if (
    Test-Path `
        -LiteralPath $migrationDirectory
) {
    $migrationFiles =
        @(
            Get-ChildItem `
                -LiteralPath $migrationDirectory `
                -File `
                -Filter "*.sql" `
                -ErrorAction SilentlyContinue
        )
}

$sqlFiles =
    @(
        Get-ChildItem `
            -LiteralPath (
                Join-Path $root "supabase"
            ) `
            -Recurse `
            -File `
            -Filter "*.sql" `
            -ErrorAction SilentlyContinue
    )

$backupFiles = @()

foreach ($directory in @(
    "app",
    "lib",
    "supabase"
)) {
    $full =
        Join-Path `
            $root `
            $directory

    if (
        Test-Path `
            -LiteralPath $full
    ) {
        $backupFiles += @(
            Get-ChildItem `
                -LiteralPath $full `
                -Recurse `
                -File `
                -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -match '\.bak$'
            }
        )
    }
}

# ==================================================
# GIT
# ==================================================

$branch =
    (
        git branch --show-current
    ).Trim()

$head =
    (
        git rev-parse HEAD
    ).Trim()

$originHead = ""

try {
    $originHead =
        (
            git rev-parse origin/main
        ).Trim()
}
catch {
    $originHead = ""
}

$gitStatus =
    @(
        git status --short
    )

$untracked =
    @(
        $gitStatus |
        Where-Object {
            $_ -match '^\?\?'
        }
    )

$changed =
    @(
        $gitStatus |
        Where-Object {
            $_ -notmatch '^\?\?'
        }
    )

$trackedFiles =
    @(
        git ls-files
    )

$trackedEnvFiles =
    @(
        $trackedFiles |
        Where-Object {
            $_ -match '(^|/)\.env($|\.)'
        }
    )

$workflowFiles =
    @(
        $trackedFiles |
        Where-Object {
            $_ -match '^\.github/workflows/'
        }
    )

# ==================================================
# DATABASE REFERENCES
# ==================================================

$tableNames =
    [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )

$rpcNames =
    [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )

$envNames =
    [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )

$klyxMarkers =
    [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )

foreach ($file in $sourceFiles) {
    $text =
        Read-Safe `
            $file.FullName

    if (-not $text) {
        continue
    }

    foreach (
        $match in
        [regex]::Matches(
            $text,
            '\.from\(\s*["'']([^"'']+)["'']\s*\)'
        )
    ) {
        Add-Unique `
            $tableNames `
            $match.Groups[1].Value
    }

    foreach (
        $match in
        [regex]::Matches(
            $text,
            '\.rpc\(\s*["'']([^"'']+)["'']'
        )
    ) {
        Add-Unique `
            $rpcNames `
            $match.Groups[1].Value
    }

    foreach (
        $match in
        [regex]::Matches(
            $text,
            'process\.env(?:\.([A-Z0-9_]+)|\[\s*["'']([A-Z0-9_]+)["'']\s*\])'
        )
    ) {
        $name =
            if (
                $match.Groups[1].Success
            ) {
                $match.Groups[1].Value
            }
            else {
                $match.Groups[2].Value
            }

        Add-Unique `
            $envNames `
            $name
    }

    foreach (
        $match in
        [regex]::Matches(
            $text,
            '\bKLYX_[A-Z0-9_]{4,}\b'
        )
    ) {
        Add-Unique `
            $klyxMarkers `
            $match.Value
    }
}

# ==================================================
# SECURITY / LEGACY / TECH DEBT
# ==================================================

$secretLiteralHits =
    Scan-Files `
        $sourceFiles `
        '(sk_live_[A-Za-z0-9]+|sk_test_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|sbp_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.)'

$legacyTokenStorageHits =
    Scan-Files `
        (
            @(
                $sourceFiles |
                Where-Object {
                    $_.FullName -match '\\(app|lib)\\'
                }
            )
        ) `
        '(localStorage[\s\S]{0,300}(access_token|refresh_token)|(access_token|refresh_token)[\s\S]{0,300}localStorage|klyx-saved-accounts-v[0-9])'

$hardcodedEurCheckoutHits =
    Scan-Files `
        (
            @(
                $sourceFiles |
                Where-Object {
                    $_.FullName -match '\\(app|lib)\\'
                }
            )
        ) `
        'currency\s*:\s*["'']eur["'']'

$hardcodedBelgiumHits =
    Scan-Files `
        (
            @(
                $sourceFiles |
                Where-Object {
                    $_.FullName -match '\\(app|lib)\\'
                }
            )
        ) `
        'countryCode\s*:\s*["'']BE["'']'

$todoHits =
    Scan-Files `
        $sourceFiles `
        '\b(TODO|FIXME|HACK|XXX)\b'

$localizationDebtHits =
    Scan-Files `
        (
            @(
                $sourceFiles |
                Where-Object {
                    $_.FullName -match '\\(app|lib)\\'
                }
            )
        ) `
        '(fr-BE|€)'

$legacyCandidates = @()

foreach ($candidate in @(
    "app\create-store",
    "app\babysitters",
    "app\dev\accounts",
    "app\reset-accounts"
)) {
    if (
        Existing-Directory $candidate
    ) {
        $legacyCandidates +=
            $candidate.Replace(
                "\",
                "/"
            )
    }
}

$productionSensitiveRoutes = @()

foreach ($candidate in @(
    "app\dev",
    "app\founder\test",
    "app\founder\cleanup",
    "app\founder\transaction-test",
    "app\admin"
)) {
    if (
        Existing-Directory $candidate
    ) {
        $productionSensitiveRoutes +=
            $candidate.Replace(
                "\",
                "/"
            )
    }
}

# ==================================================
# HISTORICAL CHECKERS
# ==================================================

$stepCheckers =
    @(
        $scriptFiles |
        Where-Object {
            $_.Name -match '^check-step-(12|13|14)-'
        } |
        Sort-Object Name |
        ForEach-Object {
            $_.Name
        }
    )

$latestStepChecker =
    if (
        $stepCheckers.Count -gt 0
    ) {
        $stepCheckers[
            $stepCheckers.Count - 1
        ]
    }
    else {
        $null
    }

function Marker-Exists(
    [string]$RelativePath,
    [string]$Marker
) {
    $full =
        Join-Path `
            $root `
            $RelativePath

    if (
        -not (
            Test-Path `
                -LiteralPath $full `
                -PathType Leaf
        )
    ) {
        return $false
    }

    return (
        Read-Safe $full
    ).Contains(
        $Marker
    )
}

$stepEvidence = @(
    [pscustomobject]@{
        step = "14.24"
        checker =
            Existing-File `
                "scripts\check-step-14-24.ps1"
        evidence = (
            (
                Marker-Exists `
                    "lib\api-auth.ts" `
                    "KLYX_REAL_PROFILE_MARKET_14_24"
            ) -and
            (
                Marker-Exists `
                    "app\api\quotes\route.ts" `
                    "KLYX_QUOTE_CLIENT_MONEY_14_24"
            ) -and
            (
                Marker-Exists `
                    "app\api\bookings\create\route.ts" `
                    "KLYX_BOOKING_CLIENT_MONEY_14_24"
            )
        )
    }

    [pscustomobject]@{
        step = "14.25"
        checker =
            Existing-File `
                "scripts\check-step-14-25.ps1"
        evidence = (
            (
                Marker-Exists `
                    "app\api\stripe\create-checkout-session\route.ts" `
                    "KLYX_STRIPE_BOOKING_CURRENCY_14_25"
            ) -and
            (
                Marker-Exists `
                    "app\api\stripe\create-group-checkout-session\route.ts" `
                    "KLYX_STRIPE_GROUP_CURRENCY_14_25"
            )
        )
    }

    [pscustomobject]@{
        step = "14.26"
        checker =
            Existing-File `
                "scripts\check-step-14-26.ps1"
        evidence = (
            (
                Marker-Exists `
                    "lib\stripe-payments.ts" `
                    "KLYX_PAYMENT_CURRENCY_INTEGRITY_14_26"
            ) -and
            (
                Marker-Exists `
                    "lib\stripe-group-payments.ts" `
                    "KLYX_GROUP_CURRENCY_INTEGRITY_14_26"
            )
        )
    }
)

# ==================================================
# MASTER FEATURE BASELINE
# Based on KLYX project history + current architecture
# ==================================================

$features = @(
    [pscustomobject]@{
        name = "Authentication & session"
        paths = @(
            "app\login\page.tsx",
            "app\signup\page.tsx",
            "app\onboarding\page.tsx",
            "lib\api-auth.ts"
        )
    },

    [pscustomobject]@{
        name = "Multi-profils Supabase"
        paths = @(
            "app\accounts\page.tsx",
            "app\components\AccountSwitcher.tsx",
            "lib\account-switcher.ts",
            "lib\active-profile.ts",
            "app\api\profiles\active\route.ts",
            "app\api\profiles\manage\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Services universels / tous métiers"
        paths = @(
            "lib\klyx-service-catalog.ts",
            "app\provider\services\new\page.tsx",
            "app\api\services\public\route.ts",
            "app\admin\services\page.tsx",
            "supabase\KLYX_14_16_APPLY_UNIVERSAL_SERVICES.sql"
        )
    },

    [pscustomobject]@{
        name = "Recherche & matching"
        paths = @(
            "app\search\page.tsx",
            "app\api\search\providers\route.ts",
            "app\api\search\coverage\route.ts",
            "app\api\search\provider-coverage\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Brain / Assistant IA"
        paths = @(
            "app\assistant\page.tsx",
            "app\brain\page.tsx",
            "app\api\brain\respond\route.ts",
            "app\api\brain\command\route.ts",
            "app\api\brain\actions\route.ts",
            "app\api\brain\recommend\route.ts",
            "app\api\brain\llm-health\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Mémoire personnelle"
        paths = @(
            "app\memory\page.tsx",
            "app\api\memory\preferences\route.ts",
            "app\api\memory\profile\route.ts",
            "app\api\brain\memory-context\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Recherche par photo"
        paths = @(
            "app\request\photo\page.tsx",
            "app\api\requests\photo\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Marché KLYX & offres"
        paths = @(
            "app\assistant\market\page.tsx",
            "app\assistant\market\[id]\page.tsx",
            "app\api\market\requests\route.ts",
            "app\api\market\requests\[id]\offers\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Devis"
        paths = @(
            "app\quotes\page.tsx",
            "app\quotes\[id]\book\page.tsx",
            "app\api\quotes\route.ts",
            "app\api\quotes\[id]\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Réservation standard"
        paths = @(
            "app\bookings\page.tsx",
            "app\bookings\[id]\page.tsx",
            "app\api\bookings\create\route.ts",
            "app\api\bookings\overview\route.ts",
            "app\api\bookings\status\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Réservations groupées"
        paths = @(
            "app\booking-groups\[id]\page.tsx",
            "app\api\booking-groups\[id]\route.ts",
            "app\api\market\requests\[id]\group-booking\route.ts",
            "app\api\stripe\create-group-checkout-session\route.ts",
            "lib\stripe-group-payments.ts"
        )
    },

    [pscustomobject]@{
        name = "Multi-prestataires / split missions"
        paths = @(
            "app\bookings\split\[id]\page.tsx",
            "app\api\bookings\split-missions\route.ts",
            "app\api\bookings\split-missions\[id]\checkout\route.ts",
            "app\api\bookings\split-missions\[id]\payment-plan\route.ts",
            "app\api\bookings\split-missions\[id]\payment-confirmation\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Paiements Stripe"
        paths = @(
            "app\api\stripe\create-checkout-session\route.ts",
            "app\api\stripe\webhook\route.ts",
            "lib\stripe-payments.ts",
            "app\api\stripe\connect\create-account\route.ts",
            "app\api\stripe\connect\status\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Finance / Ledger"
        paths = @(
            "lib\klyx-money.ts",
            "lib\payment-ledger.ts",
            "app\api\provider\finance\route.ts",
            "app\api\provider\finance-audit\route.ts",
            "app\founder\economics\page.tsx"
        )
    },

    [pscustomobject]@{
        name = "Annulation / remboursement / litiges"
        paths = @(
            "app\api\booking-groups\[id]\cancellation\route.ts",
            "app\api\bookings\split-missions\[id]\refund-status\route.ts",
            "app\api\disputes\route.ts",
            "app\admin\disputes\page.tsx"
        )
    },

    [pscustomobject]@{
        name = "Avis & réputation"
        paths = @(
            "app\reviews\[bookingId]\page.tsx",
            "app\reviews\group\[groupId]\page.tsx",
            "app\api\reviews\route.ts",
            "app\api\group-reviews\route.ts",
            "app\scores\page.tsx"
        )
    },

    [pscustomobject]@{
        name = "Trust & compétences prestataire"
        paths = @(
            "app\provider\trust\page.tsx",
            "app\provider\skills\page.tsx",
            "app\api\provider\skills-verification\route.ts",
            "app\api\provider\skill-requirements\route.ts"
        )
    },

    [pscustomobject]@{
        name = "KYC / Sumsub"
        paths = @(
            "app\provider\verification\sumsub\page.tsx",
            "app\api\provider\sumsub\status\route.ts",
            "app\api\provider\sumsub\token\route.ts",
            "app\api\sumsub\webhook\route.ts",
            "app\admin\sumsub\page.tsx"
        )
    },

    [pscustomobject]@{
        name = "Téléphone / OTP"
        paths = @(
            "app\settings\phone\page.tsx",
            "app\api\profile\phone\route.ts",
            "app\api\profile\phone\otp\send\route.ts",
            "app\api\profile\phone\otp\verify\route.ts",
            "app\api\profile\phone\privacy\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Messages & notifications"
        paths = @(
            "app\messages\page.tsx",
            "app\messages\[bookingId]\page.tsx",
            "app\notifications\page.tsx",
            "app\api\notifications\read\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Tracking"
        paths = @(
            "app\tracking\[bookingId]\page.tsx",
            "app\api\bookings\tracking\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Sécurité applicative"
        paths = @(
            "app\security\page.tsx",
            "app\api\security\risk\route.ts",
            "tests\integration\split-checkout-security.test.ts",
            "tests\unit\payment-safety-contract.test.ts"
        )
    },

    [pscustomobject]@{
        name = "Legal / confidentialité / suppression"
        paths = @(
            "app\legal\page.tsx",
            "app\privacy\page.tsx",
            "app\terms\page.tsx",
            "app\support\page.tsx",
            "app\delete-account\page.tsx",
            "app\api\account\delete\route.ts"
        )
    },

    [pscustomobject]@{
        name = "Admin / Founder"
        paths = @(
            "app\admin\page.tsx",
            "app\founder\page.tsx",
            "app\founder\final-check\page.tsx",
            "app\api\founder\status\route.ts"
        )
    },

    [pscustomobject]@{
        name = "PWA / installation"
        paths = @(
            "app\install\page.tsx",
            "app\offline\page.tsx"
        )
    },

    [pscustomobject]@{
        name = "Marchés / pays"
        paths = @(
            "lib\klyx-supported-markets.ts",
            "supabase\KLYX_14_20_APPLY_PROFILE_MARKETS.sql"
        )
    },

    [pscustomobject]@{
        name = "Multi-devise"
        paths = @(
            "lib\klyx-money.ts",
            "supabase\KLYX_14_23_APPLY_TRANSACTION_CURRENCY.sql",
            "tests\unit\klyx-money.test.ts"
        )
    },

    [pscustomobject]@{
        name = "Internationalisation langues"
        paths = @(
            "messages\fr.json",
            "messages\en.json",
            "messages\nl.json",
            "messages\de.json"
        )
    },

    [pscustomobject]@{
        name = "Backup automatique"
        paths = @(
            "scripts\backup-klyx.ps1",
            "scripts\restore-klyx.ps1",
            "scripts\check-klyx-backup.ps1",
            ".github\workflows\klyx-backup.yml"
        )
    }
)

$featureResults = @()

$totalEvidence = 0
$foundEvidence = 0

foreach ($feature in $features) {
    $foundPaths = @()
    $missingPaths = @()

    foreach ($path in $feature.paths) {
        $totalEvidence += 1

        $full =
            Join-Path `
                $root `
                $path

        if (
            Test-Path `
                -LiteralPath $full
        ) {
            $foundEvidence += 1

            $foundPaths +=
                $path.Replace(
                    "\",
                    "/"
                )
        }
        else {
            $missingPaths +=
                $path.Replace(
                    "\",
                    "/"
                )
        }
    }

    $percentage =
        if (
            $feature.paths.Count -gt 0
        ) {
            [math]::Round(
                (
                    $foundPaths.Count /
                    $feature.paths.Count
                ) *
                100
            )
        }
        else {
            0
        }

    $status =
        if (
            $percentage -eq 100
        ) {
            "STATIC_OK"
        }
        elseif (
            $percentage -gt 0
        ) {
            "PARTIAL"
        }
        else {
            "MISSING"
        }

    $featureResults +=
        [pscustomobject]@{
            name = $feature.name
            status = $status
            percentage = $percentage
            found = $foundPaths
            missing = $missingPaths
        }
}

$staticCoverage =
    if (
        $totalEvidence -gt 0
    ) {
        [math]::Round(
            (
                $foundEvidence /
                $totalEvidence
            ) *
            100,
            2
        )
    }
    else {
        0
    }

# ==================================================
# HISTORY BASELINE
# ==================================================

$historyBaseline = @(
    "Connexion principale avec plusieurs profils KLYX.",
    "Profils client/prestataire gérés dans Supabase.",
    "Ancien stockage de sessions/tokens en localStorage considéré obsolète.",
    "Prestataires capables de proposer des métiers/services universels.",
    "Recherche générique par service, disponibilité, prix, zone et confiance.",
    "Brain / assistant IA avec actions et confirmation.",
    "Mémoire personnelle KLYX.",
    "Recherche par photo.",
    "Marché KLYX avec demandes et offres.",
    "Devis et conversion devis -> réservation.",
    "Réservations standard, groupées et multi-prestataires.",
    "Paiement Stripe Connect avec protection contre double paiement.",
    "Ledger financier et suivi des paiements.",
    "Avis, scores et système de confiance.",
    "KYC / Sumsub et vérification des compétences.",
    "Téléphone / OTP / confidentialité téléphone.",
    "Étape 14.16 : services universels.",
    "Étape 14.20 : marchés/pays par profil.",
    "Étape 14.23 : devise transactionnelle.",
    "Étape 14.24 : devise réelle devis/réservations et blocage silent FX.",
    "Toutes les langues : volontairement après les fondations critiques.",
    "Sauvegarde automatique bout-en-bout : à construire après audit."
)

# ==================================================
# DYNAMIC VERIFICATION
# ==================================================

function Invoke-KlyxAuditCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter(Mandatory = $true)]
        [string]$LogPath
    )

    if (
        Test-Path `
            -LiteralPath $LogPath
    ) {
        Remove-Item `
            -LiteralPath $LogPath `
            -Force
    }

    $escapedLogPath =
        $LogPath.Replace(
            '"',
            '""'
        )

    $commandLine =
        $Command +
        ' > "' +
        $escapedLogPath +
        '" 2>&1'

    $previousPreference =
        $ErrorActionPreference

    try {
        $ErrorActionPreference =
            "Continue"

        & $env:ComSpec `
            /d `
            /s `
            /c `
            $commandLine

        $exitCode =
            $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference =
            $previousPreference
    }

    if (
        Test-Path `
            -LiteralPath $LogPath `
            -PathType Leaf
    ) {
        $content =
            Get-Content `
                -LiteralPath $LogPath `
                -Raw `
                -ErrorAction SilentlyContinue

        if (
            -not [string]::IsNullOrWhiteSpace(
                $content
            )
        ) {
            Write-Host $content
        }
    }
    else {
        [System.IO.File]::WriteAllText(
            $LogPath,
            "",
            $utf8
        )
    }

    return [int]$exitCode
}

Write-Host ""
Write-Host "----- TESTS -----"

$testExit =
    Invoke-KlyxAuditCommand `
        -Command "npm.cmd test" `
        -LogPath $testLog

Write-Host ""
Write-Host "Tests exit code: $testExit"

Write-Host ""
Write-Host "----- TYPESCRIPT -----"

$tsExit =
    Invoke-KlyxAuditCommand `
        -Command "npx.cmd tsc --noEmit --pretty false" `
        -LogPath $tsLog

Write-Host ""
Write-Host "TypeScript exit code: $tsExit"

Write-Host ""
Write-Host "----- BUILD -----"

$buildExit =
    Invoke-KlyxAuditCommand `
        -Command "npm.cmd run build" `
        -LogPath $buildLog

Write-Host ""
Write-Host "Build exit code: $buildExit"

$testsStatus =
    if (
        $testExit -eq 0
    ) {
        "PASS"
    }
    else {
        "FAIL"
    }

$typescriptStatus =
    if (
        $tsExit -eq 0
    ) {
        "PASS"
    }
    else {
        "FAIL"
    }

$buildStatus =
    if (
        $buildExit -eq 0
    ) {
        "PASS"
    }
    else {
        "FAIL"
    }

# ==================================================
# KLYX MASTER AUDIT PUSH NORMALIZATION - PHASE 5H
# ==================================================
# KLYX_MASTER_AUDIT_PUSH_NORMALIZATION_PHASE_5H

$klyxAuditRoot = "C:\Users\fenjo\Documents\klyx"

# --------------------------------------------------
# 1. REAL SOURCE SECRET SCAN
# --------------------------------------------------

$klyxSecretRoots = @("app", "lib", "scripts", "supabase", ".github")
$klyxSecretFiles = @()

foreach ($relativeRoot in $klyxSecretRoots) {
    $candidateRoot = Join-Path $klyxAuditRoot $relativeRoot
    if (Test-Path -LiteralPath $candidateRoot -PathType Container) {
        $klyxSecretFiles += @(
            Get-ChildItem -LiteralPath $candidateRoot -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Extension -in @(".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".ps1", ".sql", ".yml", ".yaml", ".json") -and
                $_.FullName -notmatch "\\.klyx-local-backup\\" -and
                $_.FullName -notmatch "\\reports\\master-audit\\" -and
                $_.FullName -notmatch "\\repository-archive-"
            }
        )
    }
}

$klyxSecretPatterns = @(
    "sk_(live|test)_[A-Za-z0-9]{20,}",
    "rk_(live|test)_[A-Za-z0-9]{20,}",
    "whsec_[A-Za-z0-9]{20,}",
    "sb_secret_[A-Za-z0-9_-]{20,}",
    "sk-proj-[A-Za-z0-9_-]{20,}",
    "SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S{20,}",
    "OPENAI_API_KEY\s*=\s*\S{20,}",
    "TWILIO_AUTH_TOKEN\s*=\s*\S{20,}",
    "STRIPE_SECRET_KEY\s*=\s*\S{20,}"
)

$secretLiteralHits = @()

foreach ($sourceFile in $klyxSecretFiles) {
    foreach ($pattern in $klyxSecretPatterns) {
        $matches = @(
            Select-String -LiteralPath $sourceFile.FullName -Pattern $pattern -CaseSensitive:$false -ErrorAction SilentlyContinue
        )
        if ($matches.Count -gt 0) {
            $secretLiteralHits += $matches
        }
    }
}

# --------------------------------------------------
# 2. REAL ACTIVE EUR / BE SCAN
# --------------------------------------------------

$klyxRuntimeFiles = @()

foreach ($relativeRoot in @("app", "lib")) {
    $runtimeRoot = Join-Path $klyxAuditRoot $relativeRoot
    if (Test-Path -LiteralPath $runtimeRoot -PathType Container) {
        $klyxRuntimeFiles += @(
            Get-ChildItem -LiteralPath $runtimeRoot -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Extension -in @(".ts", ".tsx", ".js", ".jsx")
            }
        )
    }
}

$klyxReferenceFiles = @(
    "lib\klyx-supported-markets.ts",
    "lib\belgian-localities.ts",
    "app\api\public\economics\route.ts",
    "app\founder\economics\page.tsx"
)

$hardcodedEurCheckoutHits = @()
$hardcodedBelgiumHits = @()

foreach ($runtimeFile in $klyxRuntimeFiles) {
    $relative = $runtimeFile.FullName.Substring($klyxAuditRoot.Length).TrimStart("\", "/")
    $relative = $relative.Replace("/", "\")

    if ($klyxReferenceFiles -contains $relative) {
        continue
    }

    $eurHits = @(
        Select-String -LiteralPath $runtimeFile.FullName -Pattern '"EUR"', "'EUR'" -SimpleMatch -ErrorAction SilentlyContinue
    )

    if ($eurHits.Count -gt 0) {
        $hardcodedEurCheckoutHits += $eurHits
    }

    $beHits = @(
        Select-String -LiteralPath $runtimeFile.FullName -Pattern '"BE"', "'BE'" -SimpleMatch -ErrorAction SilentlyContinue
    )

    if ($beHits.Count -gt 0) {
        $hardcodedBelgiumHits += $beHits
    }
}

# --------------------------------------------------
# 3. ONLY TRACKED .BAK FILES BLOCK PUSH
# --------------------------------------------------

$backupFiles = @(
    git -C $klyxAuditRoot ls-files |
    Where-Object {
        $_ -match '\.bak$'
    }
)

# --------------------------------------------------
# 4. DIAGNOSTIC
# --------------------------------------------------

Write-Host ""
Write-Host "KLYX PHASE 5H PUSH NORMALIZATION"
Write-Host "--------------------------------------"
Write-Host "Source secret hits   : $($secretLiteralHits.Count)"
Write-Host "Active EUR hits      : $($hardcodedEurCheckoutHits.Count)"
Write-Host "Active BE hits       : $($hardcodedBelgiumHits.Count)"
Write-Host "Tracked .bak files   : $($backupFiles.Count)"
Write-Host "--------------------------------------"
Write-Host ""

# ==================================================
# PUSH BLOCKERS
# ==================================================

$pushBlockers = @()

if (
    $testsStatus -ne "PASS"
) {
    $pushBlockers +=
        "Tests non valides."
}

if (
    $typescriptStatus -ne "PASS"
) {
    $pushBlockers +=
        "TypeScript non valide."
}

if (
    $buildStatus -ne "PASS"
) {
    $pushBlockers +=
        "Build production non valide."
}

if (
    $trackedEnvFiles.Count -gt 0
) {
    $pushBlockers +=
        "Un fichier .env est suivi par Git."
}

if (
    $secretLiteralHits.Count -gt 0
) {
    $pushBlockers +=
        "Secrets potentiels detectes dans le code source."
}

if (
    $legacyTokenStorageHits.Count -gt 0
) {
    $pushBlockers +=
        "Ancien stockage de tokens/session dans localStorage detecte."
}

if (
    $hardcodedEurCheckoutHits.Count -gt 0
) {
    $pushBlockers +=
        "Devise EUR encore hardcodee dans un flux actif."
}

if (
    $hardcodedBelgiumHits.Count -gt 0
) {
    $pushBlockers +=
        "Pays BE encore hardcode dans un flux actif."
}

if (
    $backupFiles.Count -gt 0
) {
    $pushBlockers +=
        "$($backupFiles.Count) fichier(s) .bak present(s) dans le projet."
}

$pushReady =
    $pushBlockers.Count -eq 0

# ==================================================
# MASTER REPORT OBJECT
# ==================================================

$report =
    [ordered]@{
        generatedAt =
            (
                Get-Date
            ).ToString(
                "yyyy-MM-ddTHH:mm:ssK"
            )

        project = "KLYX"

        auditMode =
            "MASTER_READ_ONLY"

        claim100 =
            $false

        note =
            "100/100 ne sera declare qu'apres audit statique, tests, flux bout-en-bout, integrations externes et restauration."

        git =
            [ordered]@{
                branch = $branch
                head = $head
                originMain = $originHead
                headEqualsOrigin =
                    (
                        $head -eq
                        $originHead
                    )
                changedFiles =
                    $changed.Count
                untrackedFiles =
                    $untracked.Count
                trackedEnvFiles =
                    $trackedEnvFiles
                workflows =
                    $workflowFiles
            }

        inventory =
            [ordered]@{
                pages =
                    $pageFiles.Count
                apiRoutes =
                    $routeFiles.Count
                sourceFiles =
                    $sourceFiles.Count
                tests =
                    $testFiles.Count
                migrations =
                    $migrationFiles.Count
                sqlFiles =
                    $sqlFiles.Count
                powershellScripts =
                    $scriptFiles.Count
                backupFiles =
                    $backupFiles.Count
                referencedTables =
                    $tableNames.Count
                referencedRpcs =
                    $rpcNames.Count
                envVariables =
                    $envNames.Count
                klyxMarkers =
                    $klyxMarkers.Count
            }

        verification =
            [ordered]@{
                tests = $testsStatus
                typescript =
                    $typescriptStatus
                build =
                    $buildStatus
            }

        staticEvidenceCoverage =
            $staticCoverage

        features =
            $featureResults

        historyBaseline =
            $historyBaseline

        stepEvidence =
            $stepEvidence

        latestChecker =
            $latestStepChecker

        security =
            [ordered]@{
                trackedEnvFiles =
                    $trackedEnvFiles
                secretLiteralHits =
                    $secretLiteralHits
                legacyTokenStorageHits =
                    $legacyTokenStorageHits
                hardcodedEurCheckoutHits =
                    $hardcodedEurCheckoutHits
                hardcodedBelgiumHits =
                    $hardcodedBelgiumHits
            }

        technicalDebt =
            [ordered]@{
                todoFiles =
                    $todoHits
                backupFileCount =
                    $backupFiles.Count
                backupFiles =
                    @(
                        $backupFiles |
                        ForEach-Object {
                            Relative-Path `
                                $_.FullName
                        }
                    )
                localizationDebtFiles =
                    $localizationDebtHits
                legacyRouteCandidates =
                    $legacyCandidates
                productionSensitiveRoutes =
                    $productionSensitiveRoutes
            }

        database =
            [ordered]@{
                tables =
                    @(
                        $tableNames |
                        Sort-Object
                    )
                rpcs =
                    @(
                        $rpcNames |
                        Sort-Object
                    )
            }

        environmentVariables =
            @(
                $envNames |
                Sort-Object
            )

        klyxMarkers =
            @(
                $klyxMarkers |
                Sort-Object
            )

        stepCheckers =
            $stepCheckers

        push =
            [ordered]@{
                ready =
                    $pushReady
                blockers =
                    $pushBlockers
            }
    }

$json =
    $report |
    ConvertTo-Json `
        -Depth 12

[System.IO.File]::WriteAllText(
    $jsonPath,
    $json,
    $utf8
)

# ==================================================
# TEXT / MARKDOWN REPORT
# ==================================================

$sb =
    [System.Text.StringBuilder]::new()

[void]$sb.AppendLine(
    "# KLYX MASTER STATE"
)

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "Generated: $($report.generatedAt)"
)

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "IMPORTANT: KLYX n'est pas encore declare 100/100."
)

[void]$sb.AppendLine(
    "Ce rapport identifie ce qui existe reellement avant toute nouvelle evolution."
)

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Verification"
)

[void]$sb.AppendLine(
    "- Tests: $testsStatus"
)

[void]$sb.AppendLine(
    "- TypeScript: $typescriptStatus"
)

[void]$sb.AppendLine(
    "- Build: $buildStatus"
)

[void]$sb.AppendLine(
    "- Static evidence coverage: $staticCoverage%"
)

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Git"
)

[void]$sb.AppendLine(
    "- Branch: $branch"
)

[void]$sb.AppendLine(
    "- HEAD: $head"
)

[void]$sb.AppendLine(
    "- origin/main: $originHead"
)

[void]$sb.AppendLine(
    "- Changed: $($changed.Count)"
)

[void]$sb.AppendLine(
    "- Untracked: $($untracked.Count)"
)

[void]$sb.AppendLine(
    "- Push ready: $pushReady"
)

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Inventory"
)

[void]$sb.AppendLine(
    "- Pages: $($pageFiles.Count)"
)

[void]$sb.AppendLine(
    "- API routes: $($routeFiles.Count)"
)

[void]$sb.AppendLine(
    "- Tests: $($testFiles.Count)"
)

[void]$sb.AppendLine(
    "- Migrations: $($migrationFiles.Count)"
)

[void]$sb.AppendLine(
    "- SQL files: $($sqlFiles.Count)"
)

[void]$sb.AppendLine(
    "- PowerShell scripts: $($scriptFiles.Count)"
)

[void]$sb.AppendLine(
    "- Tracked .bak files: $($backupFiles.Count)"
)

[void]$sb.AppendLine(
    "- Supabase tables referenced: $($tableNames.Count)"
)

[void]$sb.AppendLine(
    "- RPC referenced: $($rpcNames.Count)"
)

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Feature matrix"
)

foreach ($feature in $featureResults) {
    [void]$sb.AppendLine(
        "- $($feature.name): $($feature.status) [$($feature.percentage)%]"
    )

    foreach ($missing in $feature.missing) {
        [void]$sb.AppendLine(
            "  - missing: $missing"
        )
    }
}

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Recent steps"
)

foreach ($step in $stepEvidence) {
    [void]$sb.AppendLine(
        "- $($step.step): checker=$($step.checker), evidence=$($step.evidence)"
    )
}

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Security"
)

[void]$sb.AppendLine(
    "- Tracked .env: $($trackedEnvFiles.Count)"
)

[void]$sb.AppendLine(
    "- Potential literal secrets: $($secretLiteralHits.Count)"
)

[void]$sb.AppendLine(
    "- Legacy token localStorage: $($legacyTokenStorageHits.Count)"
)

[void]$sb.AppendLine(
    "- Active EUR checkout hardcodes: $($hardcodedEurCheckoutHits.Count)"
)

[void]$sb.AppendLine(
    "- Active BE hardcodes: $($hardcodedBelgiumHits.Count)"
)

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Technical debt"
)

[void]$sb.AppendLine(
    "- TODO/FIXME files: $($todoHits.Count)"
)

[void]$sb.AppendLine(
    "- Localization debt files: $($localizationDebtHits.Count)"
)

[void]$sb.AppendLine(
    "- Legacy route candidates: $($legacyCandidates.Count)"
)

[void]$sb.AppendLine(
    "- Production-sensitive route groups: $($productionSensitiveRoutes.Count)"
)

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Push blockers"
)

if (
    $pushBlockers.Count -eq 0
) {
    [void]$sb.AppendLine(
        "- NONE"
    )
}
else {
    foreach ($blocker in $pushBlockers) {
        [void]$sb.AppendLine(
            "- $blocker"
        )
    }
}

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Historical KLYX baseline"
)

foreach ($item in $historyBaseline) {
    [void]$sb.AppendLine(
        "- $item"
    )
}

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Referenced Supabase tables"
)

foreach (
    $table in
    (
        $tableNames |
        Sort-Object
    )
) {
    [void]$sb.AppendLine(
        "- $table"
    )
}

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Referenced RPC"
)

foreach (
    $rpc in
    (
        $rpcNames |
        Sort-Object
    )
) {
    [void]$sb.AppendLine(
        "- $rpc"
    )
}

[void]$sb.AppendLine()

[void]$sb.AppendLine(
    "## Next rule"
)

[void]$sb.AppendLine(
    "Aucune nouvelle fonctionnalite avant analyse humaine de ce rapport et classification FAIT / PARTIEL / OBSOLETE / MANQUANT."
)

$masterText =
    $sb.ToString()

[System.IO.File]::WriteAllText(
    $txtPath,
    $masterText,
    $utf8
)

[System.IO.File]::WriteAllText(
    $mdPath,
    $masterText,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX MASTER AUDIT GENERATED"
Write-Host "======================================"
Write-Host "Pages               : $($pageFiles.Count)"
Write-Host "API routes           : $($routeFiles.Count)"
Write-Host "Tests files          : $($testFiles.Count)"
Write-Host "Migrations           : $($migrationFiles.Count)"
Write-Host "Tables referenced    : $($tableNames.Count)"
Write-Host "RPC referenced       : $($rpcNames.Count)"
Write-Host "Scripts              : $($scriptFiles.Count)"
Write-Host "Tracked .bak files   : $($backupFiles.Count)"
Write-Host "Static coverage      : $staticCoverage%"
Write-Host "Tests                : $testsStatus"
Write-Host "TypeScript           : $typescriptStatus"
Write-Host "Build                : $buildStatus"
Write-Host "Push ready           : $pushReady"
Write-Host "Push blockers        : $($pushBlockers.Count)"
Write-Host "Latest checker       : $latestStepChecker"
Write-Host "======================================"
Write-Host ""
Write-Host "REPORTS:"
Write-Host $txtPath
Write-Host $jsonPath
Write-Host $mdPath
Write-Host ""

if (
    $testsStatus -ne "PASS" -or
    $typescriptStatus -ne "PASS" -or
    $buildStatus -ne "PASS"
) {
    exit 2
}

exit 0