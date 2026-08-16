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

$reportPath =
    Join-Path `
        $reportDir `
        "KLYX_MASTER_AUDIT_PHASE_3.txt"

$jsonPath =
    Join-Path `
        $reportDir `
        "KLYX_MASTER_AUDIT_PHASE_3.json"

$lines =
    [System.Collections.Generic.List[string]]::new()

function Out-Klyx {
    param(
        [string]$Text = ""
    )

    Write-Host $Text
    [void]$script:lines.Add($Text)
}

function Read-Klyx {
    param(
        [string]$Path
    )

    if (
        -not (
            Test-Path `
                -LiteralPath $Path `
                -PathType Leaf
        )
    ) {
        return ""
    }

    return [System.IO.File]::ReadAllText(
        $Path
    )
}

function Relative-Klyx {
    param(
        [string]$Path
    )

    $base =
        [System.IO.Path]::GetFullPath(
            $root
        ).TrimEnd("\") + "\"

    return (
        [System.IO.Path]::GetFullPath(
            $Path
        )
    ).Replace(
        $base,
        ""
    ).Replace(
        "\",
        "/"
    )
}

function Show-KlyxContext {
    param(
        [string]$Path,
        [string]$Pattern,
        [int]$Radius = 3
    )

    if (
        -not (
            Test-Path `
                -LiteralPath $Path `
                -PathType Leaf
        )
    ) {
        Out-Klyx "  FILE NOT FOUND"
        return
    }

    $content =
        @(Get-Content -LiteralPath $Path)

    $indexes =
        @()

    for (
        $i = 0;
        $i -lt $content.Count;
        $i++
    ) {
        if (
            $content[$i] -match
            $Pattern
        ) {
            $indexes +=
                $i
        }
    }

    if (
        $indexes.Count -eq 0
    ) {
        Out-Klyx "  NO MATCH"
        return
    }

    $shown =
        [System.Collections.Generic.HashSet[int]]::new()

    foreach ($index in $indexes) {
        $start =
            [math]::Max(
                0,
                $index - $Radius
            )

        $end =
            [math]::Min(
                $content.Count - 1,
                $index + $Radius
            )

        Out-Klyx ""

        for (
            $lineIndex = $start;
            $lineIndex -le $end;
            $lineIndex++
        ) {
            if (
                $shown.Add(
                    $lineIndex
                )
            ) {
                $marker =
                    if (
                        $lineIndex -eq
                        $index
                    ) {
                        ">>"
                    }
                    else {
                        "  "
                    }

                Out-Klyx (
                    $marker +
                    " L" +
                    ($lineIndex + 1) +
                    " | " +
                    $content[$lineIndex]
                )
            }
        }
    }
}

function Get-EnvNames {
    param(
        [string]$Path
    )

    $set =
        [System.Collections.Generic.HashSet[string]]::new(
            [System.StringComparer]::OrdinalIgnoreCase
        )

    if (
        Test-Path `
            -LiteralPath $Path `
            -PathType Leaf
    ) {
        foreach (
            $line in
            Get-Content `
                -LiteralPath $Path
        ) {
            if (
                $line -match
                '^\s*([A-Z][A-Z0-9_]*)\s*='
            ) {
                [void]$set.Add(
                    $matches[1]
                )
            }
        }
    }

    return @(
        $set |
        Sort-Object
    )
}

# ==================================================
# START
# ==================================================

Out-Klyx ""
Out-Klyx "======================================"
Out-Klyx "KLYX MASTER AUDIT PHASE 3"
Out-Klyx "======================================"
Out-Klyx "MODE : READ ONLY"
Out-Klyx ""

$decisions =
    [System.Collections.Generic.List[object]]::new()

function Add-Decision {
    param(
        [string]$Area,
        [string]$Decision,
        [string]$Reason
    )

    [void]$script:decisions.Add(
        [pscustomobject]@{
            area = $Area
            decision = $Decision
            reason = $Reason
        }
    )
}

# ==================================================
# 1. ADMIN STRIPE READINESS
# ==================================================

Out-Klyx "----- 1. ADMIN STRIPE READINESS SECURITY -----"

$stripeReadinessPath =
    Join-Path `
        $root `
        "app\api\admin\stripe-readiness\route.ts"

$stripeReadinessText =
    Read-Klyx `
        $stripeReadinessPath

if (
    [string]::IsNullOrWhiteSpace(
        $stripeReadinessText
    )
) {
    Out-Klyx "FILE MISSING"

    Add-Decision `
        "admin-stripe-readiness" `
        "REVIEW" `
        "Route missing"
}
else {
    $directGuardPatterns =
        @(
            "requireKlyxAdmin",
            "requireKlyxFounder",
            "getKlyxAdminAccess",
            "getCurrentKlyxProfile",
            "supabase.auth.getUser",
            "getUser()"
        )

    $directGuard =
        $false

    foreach ($pattern in $directGuardPatterns) {
        if (
            $stripeReadinessText.Contains(
                $pattern
            )
        ) {
            $directGuard =
                $true
        }
    }

    $imports =
        @(
            [regex]::Matches(
                $stripeReadinessText,
                'from\s+["'']@/([^"'']+)["'']'
            ) |
            ForEach-Object {
                $_.Groups[1].Value
            } |
            Sort-Object -Unique
        )

    $indirectGuard =
        $false

    $guardModules =
        @()

    foreach ($import in $imports) {
        $candidates =
            @(
                (
                    Join-Path `
                        $root `
                        ($import + ".ts")
                ),
                (
                    Join-Path `
                        $root `
                        ($import + ".tsx")
                ),
                (
                    Join-Path `
                        $root `
                        ($import + "\index.ts")
                )
            )

        foreach ($candidate in $candidates) {
            if (
                Test-Path `
                    -LiteralPath $candidate `
                    -PathType Leaf
            ) {
                $dependencyText =
                    Read-Klyx `
                        $candidate

                if (
                    $dependencyText -match
                    'requireKlyxAdmin|requireKlyxFounder|KLYX_ADMIN_USER_IDS|KLYX_FOUNDER_USER_IDS|auth\.getUser'
                ) {
                    $indirectGuard =
                        $true

                    $guardModules +=
                        Relative-Klyx `
                            $candidate
                }
            }
        }
    }

    $usesStripeSecret =
        $stripeReadinessText -match
        'STRIPE_SECRET_KEY|new Stripe|stripe\.'

    $usesWebhookSecret =
        $stripeReadinessText -match
        'STRIPE_WEBHOOK_SECRET'

    $usesServiceRole =
        $stripeReadinessText -match
        'SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin'

    $returnsOperationalState =
        $stripeReadinessText -match
        'NextResponse\.json|Response\.json'

    Out-Klyx "Direct guard          : $directGuard"
    Out-Klyx "Indirect guard module : $indirectGuard"
    Out-Klyx "Uses Stripe secret/API: $usesStripeSecret"
    Out-Klyx "Uses webhook secret   : $usesWebhookSecret"
    Out-Klyx "Uses service role     : $usesServiceRole"
    Out-Klyx "Returns JSON status   : $returnsOperationalState"

    foreach ($module in $guardModules) {
        Out-Klyx "  GUARD MODULE -> $module"
    }

    Out-Klyx ""
    Out-Klyx "Relevant code:"
    Show-KlyxContext `
        -Path $stripeReadinessPath `
        -Pattern 'export async|STRIPE|stripe|NextResponse|Response\.json|admin|founder|auth' `
        -Radius 2

    if (
        $directGuard
    ) {
        $stripeDecision =
            "KEEP_GUARDED"
    }
    elseif (
        $indirectGuard
    ) {
        $stripeDecision =
            "VERIFY_INDIRECT_GUARD"
    }
    elseif (
        $usesStripeSecret -or
        $usesServiceRole
    ) {
        $stripeDecision =
            "FIX_SECURITY"
    }
    else {
        $stripeDecision =
            "REVIEW_PUBLIC_STATUS_ENDPOINT"
    }

    Add-Decision `
        "admin-stripe-readiness" `
        $stripeDecision `
        "direct=$directGuard indirect=$indirectGuard stripe=$usesStripeSecret serviceRole=$usesServiceRole"

    Out-Klyx ""
    Out-Klyx "DECISION -> $stripeDecision"
}

# ==================================================
# 2. PROVIDER FINANCE
# ==================================================

Out-Klyx ""
Out-Klyx "----- 2. PROVIDER FINANCE CURRENCY -----"

$financePath =
    Join-Path `
        $root `
        "app\api\provider\finance\route.ts"

$financeText =
    Read-Klyx `
        $financePath

$financeWrites =
    $financeText -match
    '\.(insert|update|upsert|delete)\s*\('

$financePaymentCreation =
    $financeText -match
    'checkout\.sessions\.create|paymentIntents\.create|refunds\.create|transfers\.create'

$financeReadsCurrency =
    $financeText -match
    '\.currency|currency'

$financeLiteralEur =
    [regex]::Matches(
        $financeText,
        '(?i)["'']EUR["'']'
    ).Count

$financeFallbackEur =
    [regex]::Matches(
        $financeText,
        '(?i)(\|\||\?\?)\s*["'']EUR["'']'
    ).Count

$financeGuard =
    $financeText -match
    'requireKlyx|requireActive|resolveActive|getCurrentKlyxProfile|auth\.getUser'

Out-Klyx "Auth/profile guard      : $financeGuard"
Out-Klyx "Database writes         : $financeWrites"
Out-Klyx "Creates Stripe payment  : $financePaymentCreation"
Out-Klyx "Reads transaction currency: $financeReadsCurrency"
Out-Klyx "Literal EUR count       : $financeLiteralEur"
Out-Klyx "Fallback EUR count      : $financeFallbackEur"

Out-Klyx ""
Out-Klyx "EUR contexts:"

Show-KlyxContext `
    -Path $financePath `
    -Pattern 'EUR|eurosToCents|const currency|entry\.currency' `
    -Radius 4

if (
    -not $financeWrites -and
    -not $financePaymentCreation -and
    $financeFallbackEur -gt 0
) {
    $financeDecision =
        "FIX_READ_MODEL_CURRENCY_FALLBACK"
}
elseif (
    $financePaymentCreation -and
    $financeLiteralEur -gt 0
) {
    $financeDecision =
        "CRITICAL_FIX"
}
elseif (
    $financeLiteralEur -gt 0
) {
    $financeDecision =
        "REVIEW_CURRENCY"
}
else {
    $financeDecision =
        "KEEP"
}

Add-Decision `
    "provider-finance-currency" `
    $financeDecision `
    "writes=$financeWrites paymentCreation=$financePaymentCreation EUR=$financeLiteralEur fallback=$financeFallbackEur"

Out-Klyx ""
Out-Klyx "DECISION -> $financeDecision"

# ==================================================
# 3. PUBLIC ECONOMICS
# ==================================================

Out-Klyx ""
Out-Klyx "----- 3. PUBLIC ECONOMICS CURRENCY -----"

$economicsPath =
    Join-Path `
        $root `
        "app\api\public\economics\route.ts"

$economicsText =
    Read-Klyx `
        $economicsPath

$economicsDb =
    $economicsText -match
    '\.from\(|supabase'

$economicsStripe =
    $economicsText -match
    'Stripe|stripe\.'

$economicsLiteral =
    $economicsText -match
    'currency\s*:\s*["'']EUR["'']'

$economicsRequest =
    $economicsText -match
    'request\.|searchParams|params'

Out-Klyx "Database access  : $economicsDb"
Out-Klyx "Stripe access    : $economicsStripe"
Out-Klyx "EUR literal      : $economicsLiteral"
Out-Klyx "Request-driven   : $economicsRequest"

Show-KlyxContext `
    -Path $economicsPath `
    -Pattern 'currency|grossAmount|platformFee|providerAmount|GET|POST' `
    -Radius 4

if (
    -not $economicsDb -and
    -not $economicsStripe -and
    $economicsLiteral
) {
    $economicsDecision =
        "STATIC_EXAMPLE_NOT_TRANSACTIONAL"
}
else {
    $economicsDecision =
        "REVIEW"
}

Add-Decision `
    "public-economics-currency" `
    $economicsDecision `
    "db=$economicsDb stripe=$economicsStripe literalEUR=$economicsLiteral"

Out-Klyx ""
Out-Klyx "DECISION -> $economicsDecision"

# ==================================================
# 4. UI EUR
# ==================================================

Out-Klyx ""
Out-Klyx "----- 4. UI EUR DEFAULTS -----"

$uiCurrencyFiles =
    @(
        "app\assistant\market\[id]\split-plan\page.tsx",
        "app\founder\economics\page.tsx",
        "app\provider\jobs\page.tsx",
        "app\provider\payments\page.tsx"
    )

$uiResults =
    @()

foreach ($relative in $uiCurrencyFiles) {
    $full =
        Join-Path `
            $root `
            $relative

    $text =
        Read-Klyx `
            $full

    $literal =
        [regex]::Matches(
            $text,
            '(?i)["'']EUR["'']'
        ).Count

    $readsApiCurrency =
        $text -match
        '\.currency|currency\s*:'

    $moneyFormatter =
        $text -match
        'Intl\.NumberFormat'

    Out-Klyx ""
    Out-Klyx "FILE -> $relative"
    Out-Klyx "EUR literals      : $literal"
    Out-Klyx "Currency data      : $readsApiCurrency"
    Out-Klyx "Intl formatter     : $moneyFormatter"

    Show-KlyxContext `
        -Path $full `
        -Pattern 'EUR|currency' `
        -Radius 2

    $decision =
        if (
            $relative -eq
            "app\founder\economics\page.tsx"
        ) {
            "STATIC_FOUNDER_EXAMPLE"
        }
        elseif (
            $literal -gt 0
        ) {
            "FIX_UI_DYNAMIC_CURRENCY"
        }
        else {
            "KEEP"
        }

    Out-Klyx "DECISION -> $decision"

    $uiResults +=
        [pscustomobject]@{
            file = $relative
            decision = $decision
            eurLiterals = $literal
        }

    Add-Decision `
        $relative `
        $decision `
        "EUR literals=$literal"
}

# ==================================================
# 5. RESET ACCOUNTS
# ==================================================

Out-Klyx ""
Out-Klyx "----- 5. RESET-ACCOUNTS LEGACY -----"

$resetPath =
    Join-Path `
        $root `
        "app\reset-accounts\page.tsx"

$resetText =
    Read-Klyx `
        $resetPath

$resetReferences =
    @()

foreach ($file in Get-ChildItem `
    -LiteralPath (
        Join-Path $root "app"
    ) `
    -Recurse `
    -File `
    -Include "*.ts","*.tsx" `
    -ErrorAction SilentlyContinue
) {
    if (
        $file.FullName -eq
        $resetPath
    ) {
        continue
    }

    $text =
        Read-Klyx `
            $file.FullName

    if (
        $text.Contains(
            "/reset-accounts"
        )
    ) {
        $resetReferences +=
            Relative-Klyx `
                $file.FullName
    }
}

$resetOldStorage =
    $resetText -match
    'klyx-saved-accounts-v[0-9]|access_token|refresh_token'

$resetSupabase =
    $resetText -match
    'supabase|profiles'

Out-Klyx "References       : $($resetReferences.Count)"
Out-Klyx "Old storage keys : $resetOldStorage"
Out-Klyx "Modern Supabase  : $resetSupabase"

foreach ($reference in $resetReferences) {
    Out-Klyx "  REF -> $reference"
}

Show-KlyxContext `
    -Path $resetPath `
    -Pattern 'localStorage|klyx-saved|access_token|refresh_token|supabase|router' `
    -Radius 2

if (
    $resetReferences.Count -eq 0 -and
    $resetOldStorage
) {
    $resetDecision =
        "REMOVE_LEGACY"
}
else {
    $resetDecision =
        "REVIEW"
}

Add-Decision `
    "reset-accounts" `
    $resetDecision `
    "references=$($resetReferences.Count) legacyStorage=$resetOldStorage"

Out-Klyx ""
Out-Klyx "DECISION -> $resetDecision"

# ==================================================
# 6. DEV ACCOUNTS
# ==================================================

Out-Klyx ""
Out-Klyx "----- 6. DEV ACCOUNTS -----"

$devAccountsPath =
    Join-Path `
        $root `
        "app\dev\accounts\page.tsx"

$devText =
    Read-Klyx `
        $devAccountsPath

$devReferences =
    @()

foreach ($file in Get-ChildItem `
    -LiteralPath (
        Join-Path $root "app"
    ) `
    -Recurse `
    -File `
    -Include "*.ts","*.tsx" `
    -ErrorAction SilentlyContinue
) {
    if (
        $file.FullName -eq
        $devAccountsPath
    ) {
        continue
    }

    $text =
        Read-Klyx `
            $file.FullName

    if (
        $text.Contains(
            "/dev/accounts"
        )
    ) {
        $devReferences +=
            Relative-Klyx `
                $file.FullName
    }
}

$devGuard =
    $devText -match
    'NODE_ENV|development|requireKlyxFounder|requireKlyxAdmin|founder|admin'

$devSensitive =
    $devText -match
    'access_token|refresh_token|password|service_role|SUPABASE_SERVICE_ROLE'

Out-Klyx "References     : $($devReferences.Count)"
Out-Klyx "Dev/admin guard: $devGuard"
Out-Klyx "Sensitive data : $devSensitive"

Show-KlyxContext `
    -Path $devAccountsPath `
    -Pattern 'NODE_ENV|development|founder|admin|token|password|supabase|profile' `
    -Radius 2

if (
    $devReferences.Count -eq 0 -and
    -not $devGuard
) {
    $devDecision =
        "REMOVE_OR_PROTECT"
}
elseif (
    $devReferences.Count -eq 0
) {
    $devDecision =
        "DEV_ONLY_KEEP_IF_GUARDED"
}
else {
    $devDecision =
        "REVIEW"
}

Add-Decision `
    "dev-accounts" `
    $devDecision `
    "references=$($devReferences.Count) guard=$devGuard sensitive=$devSensitive"

Out-Klyx ""
Out-Klyx "DECISION -> $devDecision"

# ==================================================
# 7. ENV MISSING CLASSIFICATION
# ==================================================

Out-Klyx ""
Out-Klyx "----- 7. ENVIRONMENT CLASSIFICATION -----"

$envPath =
    Join-Path `
        $root `
        ".env.local"

$envNames =
    Get-EnvNames `
        $envPath

$missingKeys =
    @(
        "KLYX_ADMIN_EMAILS",
        "NEXT_PUBLIC_KLYX_COMPANY_NUMBER",
        "NEXT_PUBLIC_KLYX_LEGAL_ADDRESS",
        "NEXT_PUBLIC_KLYX_LEGAL_NAME",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "NODE_ENV",
        "TWILIO_API_KEY_SECRET",
        "TWILIO_API_KEY_SID"
    )

$hasAdminIds =
    $envNames -contains
    "KLYX_ADMIN_USER_IDS"

$hasSupabaseAnon =
    $envNames -contains
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"

$phoneRoute =
    Join-Path `
        $root `
        "app\api\profile\phone\otp\send\route.ts"

$phoneText =
    Read-Klyx `
        $phoneRoute

$phoneUsesTwilio =
    $phoneText -match
    'TWILIO_API_KEY|twilio'

$phoneAlternative =
    $phoneText -match
    'supabase.*otp|signInWithOtp|verifyOtp'

foreach ($key in $missingKeys) {
    $classification =
        switch ($key) {
            "KLYX_ADMIN_EMAILS" {
                if ($hasAdminIds) {
                    "OPTIONAL_ALIAS"
                }
                else {
                    "CONFIG_REQUIRED"
                }
            }

            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" {
                if ($hasSupabaseAnon) {
                    "OPTIONAL_NEW_KEY_ALIAS"
                }
                else {
                    "CONFIG_REQUIRED"
                }
            }

            "NODE_ENV" {
                "RUNTIME_MANAGED"
            }

            "NEXT_PUBLIC_KLYX_COMPANY_NUMBER" {
                "PRODUCTION_LEGAL_CONFIG"
            }

            "NEXT_PUBLIC_KLYX_LEGAL_ADDRESS" {
                "PRODUCTION_LEGAL_CONFIG"
            }

            "NEXT_PUBLIC_KLYX_LEGAL_NAME" {
                "PRODUCTION_LEGAL_CONFIG"
            }

            "TWILIO_API_KEY_SECRET" {
                if (
                    $phoneUsesTwilio -and
                    -not $phoneAlternative
                ) {
                    "PHONE_OTP_BLOCKER"
                }
                else {
                    "OPTIONAL_OR_ALTERNATIVE"
                }
            }

            "TWILIO_API_KEY_SID" {
                if (
                    $phoneUsesTwilio -and
                    -not $phoneAlternative
                ) {
                    "PHONE_OTP_BLOCKER"
                }
                else {
                    "OPTIONAL_OR_ALTERNATIVE"
                }
            }

            default {
                "REVIEW"
            }
        }

    Out-Klyx "$key = $classification"

    Add-Decision `
        $key `
        $classification `
        "Environment key classification"
}

Out-Klyx ""
Out-Klyx "Phone OTP uses Twilio      : $phoneUsesTwilio"
Out-Klyx "Phone OTP alternative seen : $phoneAlternative"

# ==================================================
# 8. .BAK SAFETY
# ==================================================

Out-Klyx ""
Out-Klyx "----- 8. GIT BACKUP FILE CLASSIFICATION -----"

$trackedBak =
    @(
        git ls-files |
        Where-Object {
            $_ -match '\.bak$'
        }
    )

$archiveBak =
    @(
        $trackedBak |
        Where-Object {
            $_ -match '^repository-archive-'
        }
    )

$activeTreeBak =
    @(
        $trackedBak |
        Where-Object {
            $_ -notmatch '^repository-archive-'
        }
    )

Out-Klyx "Tracked .bak total   : $($trackedBak.Count)"
Out-Klyx "Archive .bak         : $($archiveBak.Count)"
Out-Klyx "Active-tree .bak     : $($activeTreeBak.Count)"

Out-Klyx ""
Out-Klyx "ACTIVE TREE .bak:"

foreach ($file in $activeTreeBak) {
    Out-Klyx "  $file"
}

Out-Klyx ""
Out-Klyx "ARCHIVE .bak:"
Out-Klyx "  Count only = $($archiveBak.Count)"

if (
    $activeTreeBak.Count -gt 0
) {
    $bakDecision =
        "UNTRACK_ACTIVE_BAK_AND_IGNORE"
}
else {
    $bakDecision =
        "ARCHIVE_POLICY_ONLY"
}

Add-Decision `
    "tracked-bak" `
    $bakDecision `
    "active=$($activeTreeBak.Count) archive=$($archiveBak.Count)"

Out-Klyx ""
Out-Klyx "DECISION -> $bakDecision"

# ==================================================
# 9. VERCEL
# ==================================================

Out-Klyx ""
Out-Klyx "----- 9. VERCEL CLASSIFICATION -----"

$vercelDirectory =
    Join-Path `
        $root `
        ".vercel"

$vercelJson =
    Join-Path `
        $root `
        "vercel.json"

$vercelCliLinked =
    Test-Path `
        -LiteralPath (
            Join-Path `
                $vercelDirectory `
                "project.json"
        )

$vercelConfigExists =
    Test-Path `
        -LiteralPath $vercelJson

Out-Klyx "Local CLI link : $vercelCliLinked"
Out-Klyx "vercel.json    : $vercelConfigExists"

if (
    -not $vercelCliLinked
) {
    $vercelDecision =
        "LOCAL_CLI_LINK_NOT_PROOF_OF_NO_DEPLOYMENT"
}
else {
    $vercelDecision =
        "LOCAL_LINK_PRESENT"
}

Add-Decision `
    "vercel" `
    $vercelDecision `
    "localLink=$vercelCliLinked config=$vercelConfigExists"

Out-Klyx "DECISION -> $vercelDecision"

# ==================================================
# 10. E2E
# ==================================================

Out-Klyx ""
Out-Klyx "----- 10. END-TO-END TESTING -----"

$packagePath =
    Join-Path `
        $root `
        "package.json"

$packageText =
    Read-Klyx `
        $packagePath

$playwright =
    $packageText -match
    '"@playwright/test"|"playwright"'

$cypress =
    $packageText -match
    '"cypress"'

Out-Klyx "Playwright : $playwright"
Out-Klyx "Cypress    : $cypress"

if (
    -not $playwright -and
    -not $cypress
) {
    $e2eDecision =
        "BUILD_E2E_AFTER_CLEANUP"
}
else {
    $e2eDecision =
        "E2E_FRAMEWORK_PRESENT"
}

Add-Decision `
    "e2e" `
    $e2eDecision `
    "playwright=$playwright cypress=$cypress"

Out-Klyx "DECISION -> $e2eDecision"

# ==================================================
# 11. MASTER DECISION MATRIX
# ==================================================

Out-Klyx ""
Out-Klyx "======================================"
Out-Klyx "KLYX PHASE 3 DECISION MATRIX"
Out-Klyx "======================================"

foreach ($decision in $decisions) {
    Out-Klyx (
        $decision.decision +
        " | " +
        $decision.area +
        " | " +
        $decision.reason
    )
}

# ==================================================
# 12. COUNTS
# ==================================================

$fixDecisions =
    @(
        $decisions |
        Where-Object {
            $_.decision -match
            'FIX|REMOVE|UNTRACK|BLOCKER|PROTECT'
        }
    )

$configDecisions =
    @(
        $decisions |
        Where-Object {
            $_.decision -match
            'CONFIG|LEGAL'
        }
    )

$keepDecisions =
    @(
        $decisions |
        Where-Object {
            $_.decision -match
            '^KEEP|STATIC_EXAMPLE|OPTIONAL|RUNTIME_MANAGED|LOCAL_CLI'
        }
    )

Out-Klyx ""
Out-Klyx "======================================"
Out-Klyx "KLYX MASTER AUDIT PHASE 3 COMPLETE"
Out-Klyx "======================================"
Out-Klyx "Decisions total    : $($decisions.Count)"
Out-Klyx "Fix/remove/protect : $($fixDecisions.Count)"
Out-Klyx "Config/legal       : $($configDecisions.Count)"
Out-Klyx "Keep/optional      : $($keepDecisions.Count)"
Out-Klyx "Tracked .bak       : $($trackedBak.Count)"
Out-Klyx "Active-tree .bak   : $($activeTreeBak.Count)"
Out-Klyx "Archive .bak       : $($archiveBak.Count)"
Out-Klyx "======================================"

# ==================================================
# SAVE
# ==================================================

$report =
    [ordered]@{
        generatedAt =
            (
                Get-Date
            ).ToString(
                "yyyy-MM-ddTHH:mm:ssK"
            )

        mode =
            "READ_ONLY"

        decisions =
            $decisions

        adminStripeReadiness =
            [ordered]@{
                decision =
                    $stripeDecision
            }

        providerFinance =
            [ordered]@{
                decision =
                    $financeDecision
                writesDatabase =
                    $financeWrites
                createsPayment =
                    $financePaymentCreation
                literalEur =
                    $financeLiteralEur
                fallbackEur =
                    $financeFallbackEur
            }

        publicEconomics =
            [ordered]@{
                decision =
                    $economicsDecision
            }

        resetAccounts =
            [ordered]@{
                decision =
                    $resetDecision
                references =
                    $resetReferences.Count
            }

        devAccounts =
            [ordered]@{
                decision =
                    $devDecision
                references =
                    $devReferences.Count
                guarded =
                    $devGuard
            }

        backups =
            [ordered]@{
                tracked =
                    $trackedBak.Count
                activeTree =
                    $activeTreeBak.Count
                archive =
                    $archiveBak.Count
                decision =
                    $bakDecision
            }

        e2e =
            [ordered]@{
                decision =
                    $e2eDecision
            }
    }

[System.IO.File]::WriteAllText(
    $jsonPath,
    (
        $report |
        ConvertTo-Json `
            -Depth 10
    ),
    $utf8
)

[System.IO.File]::WriteAllLines(
    $reportPath,
    $lines,
    $utf8
)

Out-Klyx ""
Out-Klyx "REPORT:"
Out-Klyx $reportPath

Out-Klyx ""
Out-Klyx "JSON:"
Out-Klyx $jsonPath