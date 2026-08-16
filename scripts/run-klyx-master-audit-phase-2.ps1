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
        "KLYX_MASTER_AUDIT_PHASE_2.txt"

$jsonPath =
    Join-Path `
        $reportDir `
        "KLYX_MASTER_AUDIT_PHASE_2.json"

$lines =
    [System.Collections.Generic.List[string]]::new()

function Out-Klyx {
    param(
        [string]$Text = ""
    )

    Write-Host $Text
    [void]$script:lines.Add($Text)
}

function Relative-KlyxPath {
    param(
        [string]$Path
    )

    return (
        [System.IO.Path]::GetFullPath(
            $Path
        )
    ).Replace(
        (
            [System.IO.Path]::GetFullPath(
                $root
            ).TrimEnd("\") + "\"
        ),
        ""
    ).Replace(
        "\",
        "/"
    )
}

function Read-KlyxText {
    param(
        [string]$Path
    )

    try {
        return [System.IO.File]::ReadAllText(
            $Path
        )
    }
    catch {
        return ""
    }
}

function Test-ContainsAny {
    param(
        [string]$Text,
        [string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        if (
            $Text -match $pattern
        ) {
            return $true
        }
    }

    return $false
}

function Get-EnvKeyNames {
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
        return @()
    }

    $names =
        [System.Collections.Generic.HashSet[string]]::new(
            [System.StringComparer]::OrdinalIgnoreCase
        )

    foreach (
        $line in
        Get-Content `
            -LiteralPath $Path `
            -ErrorAction SilentlyContinue
    ) {
        if (
            $line -match
            '^\s*([A-Z][A-Z0-9_]*)\s*='
        ) {
            [void]$names.Add(
                $matches[1]
            )
        }
    }

    return @(
        $names |
        Sort-Object
    )
}

function Invoke-KlyxCommand {
    param(
        [string]$Command
    )

    $previousPreference =
        $ErrorActionPreference

    try {
        $ErrorActionPreference =
            "Continue"

        $output =
            & $env:ComSpec `
                /d `
                /s `
                /c `
                "$Command 2>&1"

        $exitCode =
            $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference =
            $previousPreference
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output   = @($output)
    }
}

Out-Klyx ""
Out-Klyx "======================================"
Out-Klyx "KLYX MASTER AUDIT PHASE 2"
Out-Klyx "======================================"

# ==================================================
# SOURCE FILES
# ==================================================

$sourceFiles = @()

foreach ($folder in @(
    "app",
    "lib"
)) {
    $full =
        Join-Path `
            $root `
            $folder

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
                $_.Extension -in @(
                    ".ts",
                    ".tsx",
                    ".js",
                    ".jsx"
                ) -and
                $_.Name -notmatch '\.bak$'
            }
        )
    }
}

# ==================================================
# 1. GIT
# ==================================================

Out-Klyx ""
Out-Klyx "----- 1. GIT STATE -----"

$branch =
    (
        git branch --show-current
    ).Trim()

$head =
    (
        git rev-parse HEAD
    ).Trim()

$origin =
    ""

try {
    $origin =
        (
            git rev-parse origin/main
        ).Trim()
}
catch {
    $origin = ""
}

$status =
    @(
        git status --short
    )

$trackedBak =
    @(
        git ls-files |
        Where-Object {
            $_ -match '\.bak$'
        }
    )

Out-Klyx "Branch       : $branch"
Out-Klyx "HEAD         : $head"
Out-Klyx "origin/main  : $origin"
Out-Klyx "Changes      : $($status.Count)"
Out-Klyx "Tracked .bak : $($trackedBak.Count)"

if (
    $head -ne $origin
) {
    Out-Klyx "REMOTE STATE : LOCAL/REMOTE DIFFERENT"
}
else {
    Out-Klyx "REMOTE STATE : SAME COMMIT"
}

# ==================================================
# 2. LEGACY ROUTES
# ==================================================

Out-Klyx ""
Out-Klyx "----- 2. LEGACY ROUTES -----"

$legacyResults =
    @()

foreach ($route in @(
    [pscustomobject]@{
        Route = "/reset-accounts"
        Path  = "app\reset-accounts"
    },
    [pscustomobject]@{
        Route = "/dev/accounts"
        Path  = "app\dev\accounts"
    },
    [pscustomobject]@{
        Route = "/create-store"
        Path  = "app\create-store"
    },
    [pscustomobject]@{
        Route = "/babysitters"
        Path  = "app\babysitters"
    }
)) {
    $references = @()

    foreach ($file in $sourceFiles) {
        $text =
            Read-KlyxText `
                $file.FullName

        if (
            $text.Contains(
                $route.Route
            )
        ) {
            $references +=
                Relative-KlyxPath `
                    $file.FullName
        }
    }

    $references =
        @(
            $references |
            Sort-Object -Unique
        )

    $classification =
        switch ($route.Route) {
            "/reset-accounts" {
                if (
                    $references.Count -eq 0
                ) {
                    "OBSOLETE_CANDIDATE"
                }
                else {
                    "STILL_REFERENCED"
                }
            }

            "/dev/accounts" {
                if (
                    $references.Count -eq 0
                ) {
                    "DEV_ONLY_CANDIDATE"
                }
                else {
                    "STILL_REFERENCED"
                }
            }

            default {
                if (
                    $references.Count -gt 0
                ) {
                    "KEEP"
                }
                else {
                    "REVIEW"
                }
            }
        }

    Out-Klyx ""
    Out-Klyx "$($route.Route) = $classification"
    Out-Klyx "References = $($references.Count)"

    foreach ($reference in $references) {
        Out-Klyx "  $reference"
    }

    $legacyResults +=
        [pscustomobject]@{
            route = $route.Route
            classification =
                $classification
            references =
                $references
        }
}

# ==================================================
# 3. ADMIN / FOUNDER API SECURITY
# ==================================================

Out-Klyx ""
Out-Klyx "----- 3. ADMIN / FOUNDER API SECURITY -----"

$securityGuardPatterns = @(
    'requireKlyxAdmin',
    'requireKlyxFounder',
    'isKlyxFounder',
    'getKlyxAdminAccess',
    'getKlyxFounder',
    'assertKlyxAdmin',
    'assertKlyxFounder'
)

$apiSensitiveFiles = @()

foreach ($folder in @(
    "app\api\admin",
    "app\api\founder"
)) {
    $full =
        Join-Path `
            $root `
            $folder

    if (
        Test-Path `
            -LiteralPath $full
    ) {
        $apiSensitiveFiles += @(
            Get-ChildItem `
                -LiteralPath $full `
                -Recurse `
                -File `
                -Filter "route.ts" `
                -ErrorAction SilentlyContinue
        )
    }
}

$apiSecurityResults = @()

foreach ($file in $apiSensitiveFiles) {
    $text =
        Read-KlyxText `
            $file.FullName

    $relative =
        Relative-KlyxPath `
            $file.FullName

    $guarded =
        Test-ContainsAny `
            -Text $text `
            -Patterns $securityGuardPatterns

    if ($guarded) {
        $statusLabel =
            "GUARDED"
    }
    else {
        $statusLabel =
            "REVIEW"
    }

    Out-Klyx "$statusLabel -> $relative"

    $apiSecurityResults +=
        [pscustomobject]@{
            file = $relative
            guarded = $guarded
        }
}

# Dedicated Stripe readiness inspection

$stripeReadiness =
    Join-Path `
        $root `
        "app\api\admin\stripe-readiness\route.ts"

Out-Klyx ""
Out-Klyx "Admin Stripe readiness exact signals:"

if (
    Test-Path `
        -LiteralPath $stripeReadiness
) {
    $stripeReadinessText =
        Read-KlyxText `
            $stripeReadiness

    foreach ($signal in @(
        "requireKlyxAdmin",
        "requireKlyxFounder",
        "getKlyxAdminAccess",
        "getCurrentKlyxProfile",
        "supabase.auth.getUser",
        "SUPABASE_SERVICE_ROLE_KEY"
    )) {
        Out-Klyx (
            "  " +
            $signal +
            " = " +
            $stripeReadinessText.Contains(
                $signal
            )
        )
    }
}

# ==================================================
# 4. EUR / MULTI-CURRENCY CLASSIFICATION
# ==================================================

Out-Klyx ""
Out-Klyx "----- 4. EUR / MULTI-CURRENCY -----"

$currencyTargetPaths = @(
    "app\api\provider\finance\route.ts",
    "app\api\public\economics\route.ts",
    "app\assistant\market\[id]\split-plan\page.tsx",
    "app\founder\economics\page.tsx",
    "app\provider\jobs\page.tsx",
    "app\provider\payments\page.tsx"
)

$currencyResults = @()

foreach ($relative in $currencyTargetPaths) {
    $full =
        Join-Path `
            $root `
            $relative

    Out-Klyx ""
    Out-Klyx "FILE: $relative"

    if (
        -not (
            Test-Path `
                -LiteralPath $full `
                -PathType Leaf
        )
    ) {
        Out-Klyx "  MISSING"
        continue
    }

    $text =
        Read-KlyxText `
            $full

    $literalCurrency =
        [regex]::Matches(
            $text,
            '(?i)currency\s*:\s*["'']EUR["'']'
        ).Count

    $fallbackCurrency =
        [regex]::Matches(
            $text,
            '(?i)(\|\||\?\?)\s*["'']EUR["'']'
        ).Count

    $intlCurrency =
        [regex]::Matches(
            $text,
            'Intl\.NumberFormat'
        ).Count

    $databaseCurrency =
        (
            $text -match
            '\.currency'
        )

    $writesDatabase =
        (
            $text -match
            '\.(insert|update|upsert)\s*\('
        )

    $stripeCall =
        (
            $text -match
            'stripe\.|Stripe'
        )

    $classification =
        if (
            $relative -match '^app\\api\\' -and
            (
                $literalCurrency -gt 0 -or
                $fallbackCurrency -gt 0
            )
        ) {
            "BACKEND_REVIEW"
        }
        elseif (
            $literalCurrency -gt 0 -or
            $fallbackCurrency -gt 0
        ) {
            "UI_DEFAULT_REVIEW"
        }
        else {
            "NO_LITERAL_TRANSACTION_CURRENCY"
        }

    Out-Klyx "  literal currency EUR : $literalCurrency"
    Out-Klyx "  fallback EUR         : $fallbackCurrency"
    Out-Klyx "  Intl formatting      : $intlCurrency"
    Out-Klyx "  reads .currency      : $databaseCurrency"
    Out-Klyx "  DB write             : $writesDatabase"
    Out-Klyx "  Stripe code          : $stripeCall"
    Out-Klyx "  classification       : $classification"

    $matches =
        @(
            Select-String `
                -LiteralPath $full `
                -Pattern 'EUR|currency' `
                -CaseSensitive:$false `
                -ErrorAction SilentlyContinue
        )

    foreach (
        $match in
        $matches
    ) {
        Out-Klyx (
            "    L" +
            $match.LineNumber +
            " -> " +
            $match.Line.Trim()
        )
    }

    $currencyResults +=
        [pscustomobject]@{
            file =
                $relative.Replace(
                    "\",
                    "/"
                )
            classification =
                $classification
            literalEur =
                $literalCurrency
            fallbackEur =
                $fallbackCurrency
            readsCurrency =
                $databaseCurrency
            writesDatabase =
                $writesDatabase
            stripeCode =
                $stripeCall
        }
}

# ==================================================
# 5. ENVIRONMENT / PRODUCTION READINESS
# Never print values
# ==================================================

Out-Klyx ""
Out-Klyx "----- 5. PRODUCTION ENVIRONMENT -----"

$envPath =
    Join-Path `
        $root `
        ".env.local"

$envKeys =
    Get-EnvKeyNames `
        $envPath

$referencedEnv =
    [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )

foreach ($file in $sourceFiles) {
    $text =
        Read-KlyxText `
            $file.FullName

    foreach (
        $match in
        [regex]::Matches(
            $text,
            'process\.env(?:\.([A-Z0-9_]+)|\[\s*["'']([A-Z0-9_]+)["'']\s*\])'
        )
    ) {
        $key =
            if (
                $match.Groups[1].Success
            ) {
                $match.Groups[1].Value
            }
            else {
                $match.Groups[2].Value
            }

        [void]$referencedEnv.Add(
            $key
        )
    }
}

$referencedEnv =
    @(
        $referencedEnv |
        Sort-Object
    )

Out-Klyx ".env.local exists = $(
    Test-Path -LiteralPath $envPath
)"

Out-Klyx "Referenced environment variables = $($referencedEnv.Count)"
Out-Klyx "Configured key names            = $($envKeys.Count)"

$envResults = @()

foreach ($key in $referencedEnv) {
    $configured =
        $envKeys -contains $key

    if ($configured) {
        $label = "SET"
    }
    else {
        $label = "MISSING"
    }

    Out-Klyx "$label -> $key"

    $envResults +=
        [pscustomobject]@{
            key = $key
            configured =
                $configured
        }
}

# Important integration groups

Out-Klyx ""
Out-Klyx "Integration groups:"

$integrationGroups = @(
    [pscustomobject]@{
        Name = "Supabase"
        Match = 'SUPABASE'
    },
    [pscustomobject]@{
        Name = "Stripe"
        Match = 'STRIPE'
    },
    [pscustomobject]@{
        Name = "Sumsub"
        Match = 'SUMSUB'
    },
    [pscustomobject]@{
        Name = "OpenAI"
        Match = 'OPENAI'
    },
    [pscustomobject]@{
        Name = "Vercel"
        Match = 'VERCEL'
    }
)

$integrationResults = @()

foreach ($group in $integrationGroups) {
    $required =
        @(
            $referencedEnv |
            Where-Object {
                $_ -match $group.Match
            }
        )

    $missing =
        @(
            $required |
            Where-Object {
                $envKeys -notcontains $_
            }
        )

    $configuredCount =
        $required.Count -
        $missing.Count

    if (
        $required.Count -eq 0
    ) {
        $statusLabel =
            "NO_REFERENCED_KEYS"
    }
    elseif (
        $missing.Count -eq 0
    ) {
        $statusLabel =
            "CONFIGURED_LOCAL"
    }
    else {
        $statusLabel =
            "PARTIAL"
    }

    Out-Klyx (
        $group.Name +
        " = " +
        $statusLabel +
        " (" +
        $configuredCount +
        "/" +
        $required.Count +
        ")"
    )

    foreach ($item in $missing) {
        Out-Klyx (
            "  MISSING -> " +
            $item
        )
    }

    $integrationResults +=
        [pscustomobject]@{
            integration =
                $group.Name
            status =
                $statusLabel
            referenced =
                $required
            missing =
                $missing
        }
}

# ==================================================
# 6. VERCEL LOCAL LINK
# ==================================================

Out-Klyx ""
Out-Klyx "----- 6. VERCEL LOCAL LINK -----"

$vercelProject =
    Join-Path `
        $root `
        ".vercel\project.json"

if (
    Test-Path `
        -LiteralPath $vercelProject `
        -PathType Leaf
) {
    Out-Klyx "Vercel project link = PRESENT"

    try {
        $vercelData =
            Get-Content `
                -LiteralPath $vercelProject `
                -Raw |
            ConvertFrom-Json

        Out-Klyx (
            "projectId present = " +
            (
                -not [string]::IsNullOrWhiteSpace(
                    $vercelData.projectId
                )
            )
        )

        Out-Klyx (
            "orgId present     = " +
            (
                -not [string]::IsNullOrWhiteSpace(
                    $vercelData.orgId
                )
            )
        )
    }
    catch {
        Out-Klyx "Vercel project.json = INVALID JSON"
    }
}
else {
    Out-Klyx "Vercel project link = NOT FOUND"
}

# ==================================================
# 7. SUPABASE LOCAL STRUCTURE
# ==================================================

Out-Klyx ""
Out-Klyx "----- 7. SUPABASE STRUCTURE -----"

$supabaseDir =
    Join-Path `
        $root `
        "supabase"

$migrations =
    @()

if (
    Test-Path `
        -LiteralPath (
            Join-Path `
                $supabaseDir `
                "migrations"
        )
) {
    $migrations =
        @(
            Get-ChildItem `
                -LiteralPath (
                    Join-Path `
                        $supabaseDir `
                        "migrations"
                ) `
                -File `
                -Filter "*.sql" `
                -ErrorAction SilentlyContinue
        )
}

$sqlFiles =
    @()

if (
    Test-Path `
        -LiteralPath $supabaseDir
) {
    $sqlFiles =
        @(
            Get-ChildItem `
                -LiteralPath $supabaseDir `
                -Recurse `
                -File `
                -Filter "*.sql" `
                -ErrorAction SilentlyContinue
        )
}

Out-Klyx "SQL files   = $($sqlFiles.Count)"
Out-Klyx "Migrations  = $($migrations.Count)"

foreach ($migration in $migrations) {
    Out-Klyx (
        "  " +
        $migration.Name
    )
}

# ==================================================
# 8. TEST DEPTH / E2E
# ==================================================

Out-Klyx ""
Out-Klyx "----- 8. TEST DEPTH / E2E -----"

$packagePath =
    Join-Path `
        $root `
        "package.json"

$package =
    Get-Content `
        -LiteralPath $packagePath `
        -Raw |
    ConvertFrom-Json

$packageRaw =
    Get-Content `
        -LiteralPath $packagePath `
        -Raw

$hasPlaywright =
    $packageRaw -match
    '"@playwright/test"|"playwright"'

$hasCypress =
    $packageRaw -match
    '"cypress"'

$hasE2eScript =
    $false

if (
    $package.scripts
) {
    foreach (
        $property in
        $package.scripts.PSObject.Properties
    ) {
        if (
            $property.Name -match
            'e2e|playwright|cypress'
        ) {
            $hasE2eScript =
                $true

            Out-Klyx (
                "E2E script -> " +
                $property.Name +
                " = " +
                $property.Value
            )
        }
    }
}

$e2eFiles =
    @(
        Get-ChildItem `
            -LiteralPath $root `
            -Recurse `
            -File `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch
            '\\node_modules\\|\\\.next\\|\\repository-archive-' -and
            (
                $_.Name -match
                '\.e2e\.' -or
                $_.FullName -match
                '\\e2e\\|\\playwright\\|\\cypress\\'
            )
        }
    )

Out-Klyx "Playwright installed = $hasPlaywright"
Out-Klyx "Cypress installed    = $hasCypress"
Out-Klyx "E2E npm script       = $hasE2eScript"
Out-Klyx "E2E files            = $($e2eFiles.Count)"

foreach ($file in $e2eFiles) {
    Out-Klyx (
        "  " +
        (
            Relative-KlyxPath `
                $file.FullName
        )
    )
}

# ==================================================
# 9. CURRENT TESTS
# ==================================================

Out-Klyx ""
Out-Klyx "----- 9. CURRENT VERIFICATION -----"

$tests =
    Invoke-KlyxCommand `
        "npm.cmd test"

$ts =
    Invoke-KlyxCommand `
        "npx.cmd tsc --noEmit --pretty false"

$build =
    Invoke-KlyxCommand `
        "npm.cmd run build"

$testsStatus =
    if ($tests.ExitCode -eq 0) {
        "PASS"
    }
    else {
        "FAIL"
    }

$tsStatus =
    if ($ts.ExitCode -eq 0) {
        "PASS"
    }
    else {
        "FAIL"
    }

$buildStatus =
    if ($build.ExitCode -eq 0) {
        "PASS"
    }
    else {
        "FAIL"
    }

Out-Klyx "Tests      = $testsStatus"
Out-Klyx "TypeScript = $tsStatus"
Out-Klyx "Build      = $buildStatus"

# ==================================================
# 10. BACKUP READINESS
# ==================================================

Out-Klyx ""
Out-Klyx "----- 10. BACKUP READINESS -----"

$backupComponents =
    @(
        "scripts\backup-klyx.ps1",
        "scripts\restore-klyx.ps1",
        "scripts\check-klyx-backup.ps1",
        ".github\workflows\klyx-backup.yml"
    )

$backupPresent = 0

foreach ($component in $backupComponents) {
    $exists =
        Test-Path `
            -LiteralPath (
                Join-Path `
                    $root `
                    $component
            )

    if ($exists) {
        $backupPresent += 1
    }

    Out-Klyx (
        $component.Replace(
            "\",
            "/"
        ) +
        " = " +
        $exists
    )
}

# ==================================================
# 11. I18N READINESS
# ==================================================

Out-Klyx ""
Out-Klyx "----- 11. I18N READINESS -----"

$i18nLibraries =
    @(
        "next-intl",
        "i18next",
        "react-i18next"
    )

$i18nInstalled =
    $false

foreach ($library in $i18nLibraries) {
    $installed =
        $packageRaw.Contains(
            '"' + $library + '"'
        )

    if ($installed) {
        $i18nInstalled =
            $true
    }

    Out-Klyx (
        $library +
        " = " +
        $installed
    )
}

$translationDirectories =
    @(
        "messages",
        "locales",
        "i18n"
    )

$translationDirectoryExists =
    $false

foreach ($directory in $translationDirectories) {
    $exists =
        Test-Path `
            -LiteralPath (
                Join-Path `
                    $root `
                    $directory
            )

    if ($exists) {
        $translationDirectoryExists =
            $true
    }

    Out-Klyx (
        $directory +
        " = " +
        $exists
    )
}

# ==================================================
# 12. 100/100 GATE
# ==================================================

Out-Klyx ""
Out-Klyx "----- 12. KLYX 100/100 GATE -----"

$gateItems =
    @()

function Add-Gate {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail
    )

    $script:gateItems +=
        [pscustomobject]@{
            name = $Name
            passed = $Passed
            detail = $Detail
        }

    $label =
        if ($Passed) {
            "PASS"
        }
        else {
            "OPEN"
        }

    Out-Klyx (
        $label +
        " | " +
        $Name +
        " | " +
        $Detail
    )
}

Add-Gate `
    -Name "Unit/integration tests" `
    -Passed ($testsStatus -eq "PASS") `
    -Detail $testsStatus

Add-Gate `
    -Name "TypeScript" `
    -Passed ($tsStatus -eq "PASS") `
    -Detail $tsStatus

Add-Gate `
    -Name "Production build" `
    -Passed ($buildStatus -eq "PASS") `
    -Detail $buildStatus

Add-Gate `
    -Name "Legacy reset accounts removed or isolated" `
    -Passed (
        (
            $legacyResults |
            Where-Object {
                $_.route -eq "/reset-accounts"
            }
        ).classification -ne
        "OBSOLETE_CANDIDATE"
    ) `
    -Detail "Legacy route still under review"

Add-Gate `
    -Name "Tracked backup files cleaned" `
    -Passed ($trackedBak.Count -eq 0) `
    -Detail (
        "$($trackedBak.Count) tracked .bak"
    )

$backendCurrencyReviews =
    @(
        $currencyResults |
        Where-Object {
            $_.classification -eq
            "BACKEND_REVIEW"
        }
    )

Add-Gate `
    -Name "Backend currency review complete" `
    -Passed (
        $backendCurrencyReviews.Count -eq 0
    ) `
    -Detail (
        "$($backendCurrencyReviews.Count) backend file(s) require review"
    )

$unprotectedApis =
    @(
        $apiSecurityResults |
        Where-Object {
            -not $_.guarded
        }
    )

Add-Gate `
    -Name "Sensitive APIs explicitly guarded" `
    -Passed (
        $unprotectedApis.Count -eq 0
    ) `
    -Detail (
        "$($unprotectedApis.Count) route(s) require review"
    )

$missingEnv =
    @(
        $envResults |
        Where-Object {
            -not $_.configured
        }
    )

Add-Gate `
    -Name "Referenced local environment configured" `
    -Passed (
        $missingEnv.Count -eq 0
    ) `
    -Detail (
        "$($missingEnv.Count) referenced key(s) missing locally"
    )

Add-Gate `
    -Name "E2E framework" `
    -Passed (
        (
            $hasPlaywright -or
            $hasCypress
        ) -and
        $hasE2eScript
    ) `
    -Detail (
        "Playwright=$hasPlaywright Cypress=$hasCypress script=$hasE2eScript"
    )

Add-Gate `
    -Name "Automatic backup" `
    -Passed (
        $backupPresent -eq
        $backupComponents.Count
    ) `
    -Detail (
        "$backupPresent/$($backupComponents.Count)"
    )

Add-Gate `
    -Name "Internationalisation architecture" `
    -Passed (
        $i18nInstalled -and
        $translationDirectoryExists
    ) `
    -Detail (
        "library=$i18nInstalled translations=$translationDirectoryExists"
    )

$gatePassed =
    @(
        $gateItems |
        Where-Object {
            $_.passed
        }
    ).Count

$gateTotal =
    $gateItems.Count

$gatePercentage =
    if (
        $gateTotal -gt 0
    ) {
        [math]::Round(
            (
                $gatePassed /
                $gateTotal
            ) *
            100,
            2
        )
    }
    else {
        0
    }

Out-Klyx ""
Out-Klyx (
    "MASTER GATE = " +
    $gatePassed +
    "/" +
    $gateTotal +
    " (" +
    $gatePercentage +
    "%)"
)

Out-Klyx ""
Out-Klyx "IMPORTANT:"
Out-Klyx "Ce pourcentage mesure les gates de verification, pas le pourcentage de produit termine."

# ==================================================
# JSON
# ==================================================

$report =
    [ordered]@{
        generatedAt =
            (
                Get-Date
            ).ToString(
                "yyyy-MM-ddTHH:mm:ssK"
            )

        git =
            [ordered]@{
                branch = $branch
                head = $head
                originMain = $origin
                trackedBak =
                    $trackedBak.Count
                workingTreeEntries =
                    $status.Count
            }

        legacy =
            $legacyResults

        sensitiveApiSecurity =
            $apiSecurityResults

        currencies =
            $currencyResults

        environment =
            [ordered]@{
                referenced =
                    $referencedEnv
                configuredNames =
                    $envKeys
                results =
                    $envResults
                integrations =
                    $integrationResults
            }

        tests =
            [ordered]@{
                unitIntegration =
                    $testsStatus
                typescript =
                    $tsStatus
                build =
                    $buildStatus
                playwright =
                    $hasPlaywright
                cypress =
                    $hasCypress
                e2eScript =
                    $hasE2eScript
                e2eFiles =
                    $e2eFiles.Count
            }

        backup =
            [ordered]@{
                present =
                    $backupPresent
                required =
                    $backupComponents.Count
            }

        i18n =
            [ordered]@{
                library =
                    $i18nInstalled
                translationDirectory =
                    $translationDirectoryExists
            }

        masterGate =
            [ordered]@{
                passed =
                    $gatePassed
                total =
                    $gateTotal
                percentage =
                    $gatePercentage
                items =
                    $gateItems
            }
    }

[System.IO.File]::WriteAllText(
    $jsonPath,
    (
        $report |
        ConvertTo-Json `
            -Depth 12
    ),
    $utf8
)

[System.IO.File]::WriteAllLines(
    $reportPath,
    $lines,
    $utf8
)

Out-Klyx ""
Out-Klyx "======================================"
Out-Klyx "KLYX MASTER AUDIT PHASE 2 COMPLETE"
Out-Klyx "======================================"
Out-Klyx "Tests              : $testsStatus"
Out-Klyx "TypeScript         : $tsStatus"
Out-Klyx "Build              : $buildStatus"
Out-Klyx "Tracked .bak       : $($trackedBak.Count)"
Out-Klyx "Backend EUR review : $($backendCurrencyReviews.Count)"
Out-Klyx "Sensitive API review: $($unprotectedApis.Count)"
Out-Klyx "Missing env names  : $($missingEnv.Count)"
Out-Klyx "E2E framework      : $(
    (
        $hasPlaywright -or
        $hasCypress
    ) -and
    $hasE2eScript
)"
Out-Klyx "Backup             : $backupPresent/$($backupComponents.Count)"
Out-Klyx "i18n               : $i18nInstalled"
Out-Klyx "Master gate        : $gatePassed/$gateTotal ($gatePercentage%)"
Out-Klyx "======================================"

Out-Klyx ""
Out-Klyx "REPORT:"
Out-Klyx $reportPath

Out-Klyx ""
Out-Klyx "JSON:"
Out-Klyx $jsonPath