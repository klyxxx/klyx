$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$jsonPath =
    Join-Path `
        $root `
        "reports\master-audit\KLYX_MASTER_AUDIT.json"

$reportPath =
    Join-Path `
        $root `
        "reports\master-audit\KLYX_MASTER_DEEP_TRIAGE.txt"

if (
    -not (
        Test-Path `
            -LiteralPath $jsonPath `
            -PathType Leaf
    )
) {
    throw "KLYX_MASTER_AUDIT.json introuvable."
}

$data =
    Get-Content `
        -LiteralPath $jsonPath `
        -Raw |
    ConvertFrom-Json

$lines =
    [System.Collections.Generic.List[string]]::new()

function Out-Klyx {
    param(
        [string]$Text = ""
    )

    Write-Host $Text

    $script:lines.Add(
        $Text
    )
}

function Show-Matches {
    param(
        [string]$Title,
        [object[]]$Files,
        [string]$Pattern
    )

    Out-Klyx ""
    Out-Klyx "----- $Title -----"

    if (
        @($Files).Count -eq 0
    ) {
        Out-Klyx "AUCUN FICHIER"
        return
    }

    foreach ($relative in @($Files)) {
        $full =
            Join-Path `
                $root `
                $relative.Replace(
                    "/",
                    "\"
                )

        Out-Klyx ""
        Out-Klyx "FILE: $relative"

        if (
            -not (
                Test-Path `
                    -LiteralPath $full `
                    -PathType Leaf
            )
        ) {
            Out-Klyx "  FICHIER INTROUVABLE"
            continue
        }

        $matches =
            @(
                Select-String `
                    -LiteralPath $full `
                    -Pattern $Pattern `
                    -CaseSensitive:$false `
                    -ErrorAction SilentlyContinue
            )

        if (
            $matches.Count -eq 0
        ) {
            Out-Klyx "  Aucun match exact."
            continue
        }

        foreach ($match in $matches) {
            Out-Klyx (
                "  L" +
                $match.LineNumber +
                " -> " +
                $match.Line.Trim()
            )
        }
    }
}

Out-Klyx ""
Out-Klyx "======================================"
Out-Klyx "KLYX MASTER DEEP TRIAGE"
Out-Klyx "======================================"

# ==================================================
# BLOCKERS
# ==================================================

Out-Klyx ""
Out-Klyx "----- 1. PUSH BLOCKERS EXACTS -----"

$index = 1

foreach ($blocker in @($data.push.blockers)) {
    Out-Klyx (
        "$index. $blocker"
    )

    $index += 1
}

if (
    @($data.push.blockers).Count -eq 0
) {
    Out-Klyx "AUCUN"
}

# ==================================================
# COMPLETE FEATURE MATRIX
# ==================================================

Out-Klyx ""
Out-Klyx "----- 2. FEATURE MATRIX COMPLETE -----"

foreach ($feature in @($data.features)) {
    Out-Klyx (
        $feature.status +
        " | " +
        $feature.percentage +
        "% | " +
        $feature.name
    )

    foreach ($missing in @($feature.missing)) {
        Out-Klyx (
            "    MISSING -> " +
            $missing
        )
    }
}

# ==================================================
# SECRET EXACT CONTEXT
# ==================================================

Show-Matches `
    -Title "3. SECRET POTENTIEL" `
    -Files @(
        $data.security.secretLiteralHits
    ) `
    -Pattern 'sk_live_|sk_test_|whsec_|sbp_|eyJ'

# ==================================================
# OLD LOCAL STORAGE
# ==================================================

Show-Matches `
    -Title "4. LEGACY LOCALSTORAGE / TOKENS" `
    -Files @(
        $data.security.legacyTokenStorageHits
    ) `
    -Pattern 'localStorage|access_token|refresh_token|klyx-saved-accounts'

# ==================================================
# EUR
# ==================================================

Show-Matches `
    -Title "5. EUR EXACT CONTEXT" `
    -Files @(
        $data.security.hardcodedEurCheckoutHits
    ) `
    -Pattern 'EUR|eur|currency'

# ==================================================
# BELGIUM
# ==================================================

Show-Matches `
    -Title "6. BELGIUM EXACT CONTEXT" `
    -Files @(
        $data.security.hardcodedBelgiumHits
    ) `
    -Pattern 'BE|Belgique|countryCode|country'

# ==================================================
# TODO
# ==================================================

Show-Matches `
    -Title "7. TODO / FIXME" `
    -Files @(
        $data.technicalDebt.todoFiles
    ) `
    -Pattern 'TODO|FIXME|HACK|XXX'

# ==================================================
# BACKUPS
# ==================================================

Out-Klyx ""
Out-Klyx "----- 8. BACKUP FILES -----"

Out-Klyx (
    "Total .bak = " +
    $data.technicalDebt.backupFileCount
)

$trackedBak =
    @(
        git ls-files |
        Where-Object {
            $_ -match '\.bak$'
        }
    )

Out-Klyx (
    "Tracked .bak = " +
    $trackedBak.Count
)

foreach ($item in $trackedBak) {
    Out-Klyx (
        "  TRACKED -> " +
        $item
    )
}

$gitignore =
    Join-Path `
        $root `
        ".gitignore"

Out-Klyx ""
Out-Klyx ".gitignore backup rules:"

if (
    Test-Path `
        -LiteralPath $gitignore
) {
    $rules =
        @(
            Select-String `
                -LiteralPath $gitignore `
                -Pattern 'bak|backup|reports|\.env' `
                -CaseSensitive:$false `
                -ErrorAction SilentlyContinue
        )

    foreach ($rule in $rules) {
        Out-Klyx (
            "  L" +
            $rule.LineNumber +
            " -> " +
            $rule.Line.Trim()
        )
    }
}

# ==================================================
# LEGACY ROUTES REFERENCES
# ==================================================

Out-Klyx ""
Out-Klyx "----- 9. LEGACY ROUTE REFERENCES -----"

$source =
    @()

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
            -LiteralPath $full
    ) {
        $source += @(
            Get-ChildItem `
                -LiteralPath $full `
                -Recurse `
                -File `
                -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Extension -in @(
                    ".ts",
                    ".tsx"
                ) -and
                $_.Name -notmatch '\.bak$'
            }
        )
    }
}

foreach ($route in @(
    "/reset-accounts",
    "/dev/accounts",
    "/create-store",
    "/babysitters"
)) {
    Out-Klyx ""
    Out-Klyx "ROUTE: $route"

    $references =
        @(
            $source |
            Select-String `
                -Pattern (
                    [regex]::Escape(
                        $route
                    )
                ) `
                -CaseSensitive:$false `
                -ErrorAction SilentlyContinue
        )

    if (
        $references.Count -eq 0
    ) {
        Out-Klyx "  REFERENCES = 0"
    }

    foreach ($reference in $references) {
        $relative =
            $reference.Path.Replace(
                $root + "\",
                ""
            ).Replace(
                "\",
                "/"
            )

        Out-Klyx (
            "  " +
            $relative +
            ":" +
            $reference.LineNumber +
            " -> " +
            $reference.Line.Trim()
        )
    }
}

# ==================================================
# FOUNDER / ADMIN PROTECTION
# ==================================================

Out-Klyx ""
Out-Klyx "----- 10. FOUNDER / ADMIN SECURITY -----"

$sensitiveFiles =
    @()

foreach ($folder in @(
    "app\api\founder",
    "app\api\admin",
    "app\founder",
    "app\admin"
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
        $sensitiveFiles += @(
            Get-ChildItem `
                -LiteralPath $full `
                -Recurse `
                -File `
                -Include "*.ts","*.tsx" `
                -ErrorAction SilentlyContinue
        )
    }
}

foreach ($file in $sensitiveFiles) {
    $text =
        Get-Content `
            -LiteralPath $file.FullName `
            -Raw `
            -ErrorAction SilentlyContinue

    $relative =
        $file.FullName.Replace(
            $root + "\",
            ""
        ).Replace(
            "\",
            "/"
        )

    $founderGuard =
        $text -match
        'requireKlyxFounder|isKlyxFounder|/api/founder/status'

    $adminGuard =
        $text -match
        'requireKlyxAdmin|/api/admin/access'

    if (
        $founderGuard -or
        $adminGuard
    ) {
        Out-Klyx (
            "GUARDED -> " +
            $relative +
            " | founder=" +
            $founderGuard +
            " admin=" +
            $adminGuard
        )
    }
    else {
        Out-Klyx (
            "REVIEW -> " +
            $relative
        )
    }
}

# ==================================================
# I18N
# ==================================================

Out-Klyx ""
Out-Klyx "----- 11. I18N CURRENT STATE -----"

Out-Klyx (
    "Localization debt files = " +
    $data.technicalDebt.localizationDebtFiles.Count
)

$packagePath =
    Join-Path `
        $root `
        "package.json"

$packageText =
    Get-Content `
        -LiteralPath $packagePath `
        -Raw

foreach ($library in @(
    "next-intl",
    "i18next",
    "react-i18next"
)) {
    Out-Klyx (
        $library +
        " = " +
        (
            $packageText.Contains(
                '"' + $library + '"'
            )
        )
    )
}

foreach ($directory in @(
    "messages",
    "locales",
    "i18n"
)) {
    $exists =
        Test-Path `
            -LiteralPath (
                Join-Path `
                    $root `
                    $directory
            )

    Out-Klyx (
        $directory +
        " = " +
        $exists
    )
}

# ==================================================
# AUTOMATIC BACKUP
# ==================================================

Out-Klyx ""
Out-Klyx "----- 12. AUTOMATIC BACKUP CURRENT STATE -----"

foreach ($candidate in @(
    "scripts\backup-klyx.ps1",
    "scripts\restore-klyx.ps1",
    "scripts\check-klyx-backup.ps1",
    ".github\workflows\klyx-backup.yml"
)) {
    $exists =
        Test-Path `
            -LiteralPath (
                Join-Path `
                    $root `
                    $candidate
            )

    Out-Klyx (
        $candidate.Replace(
            "\",
            "/"
        ) +
        " = " +
        $exists
    )
}

# ==================================================
# HISTORICAL CLASSIFICATION
# ==================================================

Out-Klyx ""
Out-Klyx "----- 13. HISTORICAL CLASSIFICATION -----"

Out-Klyx "Belgium launch default          = INTENTIONAL"
Out-Klyx "Central supported-markets BE   = KEEP / VERIFY CENTRALIZATION"
Out-Klyx "Founder console                = INTENTIONAL"
Out-Klyx "Admin console                  = INTENTIONAL"
Out-Klyx "Old token localStorage system  = REPLACED BY SUPABASE PROFILES"
Out-Klyx "Languages                      = PLANNED AFTER CRITICAL FOUNDATIONS"
Out-Klyx "Automatic backup               = PLANNED AFTER MASTER AUDIT"

Out-Klyx ""
Out-Klyx "======================================"
Out-Klyx "KLYX MASTER DEEP TRIAGE COMPLETE"
Out-Klyx "======================================"

$utf8 =
    [System.Text.UTF8Encoding]::new(
        $false
    )

[System.IO.File]::WriteAllLines(
    $reportPath,
    $lines,
    $utf8
)

Out-Klyx ""
Out-Klyx "REPORT:"
Out-Klyx $reportPath