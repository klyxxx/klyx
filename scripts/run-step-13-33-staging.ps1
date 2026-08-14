$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

$sourceManifestPath =
    Join-Path `
        $root `
        "reports\supabase-fresh-rebuild-manifest-13-32.json"

$stagingRoot =
    Join-Path `
        $root `
        "supabase\staging-migrations-13-33"

$outputManifestPath =
    Join-Path `
        $root `
        "reports\supabase-staging-manifest-13-33.json"

$outputPlanPath =
    Join-Path `
        $root `
        "reports\supabase-staging-plan-13-33.txt"

# KLYX_SUPABASE_CANONICAL_STAGING_13_33

if (
    -not (
        Test-Path `
            -LiteralPath `
            $sourceManifestPath
    )
) {
    throw "13.33 : manifest 13.32 introuvable."
}

$sourceManifest =
    Get-Content `
        -LiteralPath `
        $sourceManifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $sourceManifest.Step -ne
    "13.32"
) {
    throw "13.33 : mauvais manifest source."
}

# ============================================================
# CLEAN ONLY OUR STAGING DIRECTORY
# ============================================================

if (
    Test-Path `
        -LiteralPath `
        $stagingRoot
) {
    Remove-Item `
        -LiteralPath `
        $stagingRoot `
        -Recurse `
        -Force
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $stagingRoot |
    Out-Null

# ============================================================
# CANONICAL PHASES
# ============================================================

$phases =
    @(
        [pscustomobject]@{
            Order = 1
            Key = "01_foundation"
        },
        [pscustomobject]@{
            Order = 2
            Key = "02_identity_profiles"
        },
        [pscustomobject]@{
            Order = 3
            Key = "03_services_market"
        },
        [pscustomobject]@{
            Order = 4
            Key = "04_bookings"
        },
        [pscustomobject]@{
            Order = 5
            Key = "05_payments_finance"
        },
        [pscustomobject]@{
            Order = 6
            Key = "06_split_missions"
        },
        [pscustomobject]@{
            Order = 7
            Key = "07_trust_security"
        },
        [pscustomobject]@{
            Order = 8
            Key = "08_brain_memory"
        },
        [pscustomobject]@{
            Order = 9
            Key = "09_final_constraints"
        },
        [pscustomobject]@{
            Order = 99
            Key = "99_manual_review"
        }
    )

foreach (
    $phase
    in $phases
) {
    New-Item `
        -ItemType Directory `
        -Force `
        -Path (
            Join-Path `
                $stagingRoot `
                $phase.Key
        ) |
        Out-Null
}

function Get-Phase {
    param(
        [string]$Path,
        [string]$Content,
        [string]$Class
    )

    $haystack =
        (
            $Path +
            "`n" +
            $Content
        ).ToLowerInvariant()

    if (
        $haystack -match
        "split_booking|split-mission|split_mission"
    ) {
        return "06_split_missions"
    }

    if (
        $haystack -match
        "stripe|payment|refund|financial|ledger|commission|checkout"
    ) {
        return "05_payments_finance"
    }

    if (
        $haystack -match
        "sumsub|kyc|verification|dispute|trust|security|risk|score"
    ) {
        return "07_trust_security"
    }

    if (
        $haystack -match
        "brain|memory|assistant|agent|recommend"
    ) {
        return "08_brain_memory"
    }

    if (
        $haystack -match
        "booking|reservation"
    ) {
        return "04_bookings"
    }

    if (
        $haystack -match
        "service|offer|market|request|provider|quote|skill"
    ) {
        return "03_services_market"
    }

    if (
        $haystack -match
        "profile|account|role|identity|auth"
    ) {
        return "02_identity_profiles"
    }

    if (
        $haystack -match
        "extension|gen_random_uuid|uuid-ossp"
    ) {
        return "01_foundation"
    }

    if (
        $Class -eq
        "security"
    ) {
        return "09_final_constraints"
    }

    return "99_manual_review"
}

function Get-SafeName {
    param(
        [string]$Name
    )

    $safe =
        $Name `
            -replace '[^a-zA-Z0-9._-]', '_'

    return $safe
}

function Get-Sha256 {
    param(
        [string]$Path
    )

    return (
        Get-FileHash `
            -LiteralPath `
            $Path `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()
}

# ============================================================
# BUILD CANDIDATE SET
# ============================================================

$sourceFiles =
    @(
        $sourceManifest.Files
    ) |
    Where-Object {
        $_.Exists -eq $true
    }

$hashSeen =
    @{}

$stagingEntries =
    @()

$counter =
    0

foreach (
    $entry
    in $sourceFiles
) {
    $sourcePath =
        [string]$entry.Path

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $sourcePath
        )
    ) {
        continue
    }

    $content =
        [System.IO.File]::ReadAllText(
            $sourcePath
        )

    if (
        [string]::IsNullOrWhiteSpace(
            $content
        )
    ) {
        $stagingEntries +=
            [pscustomobject]@{
                SourcePath =
                    $sourcePath

                Status =
                    "excluded_empty"

                Phase =
                    "99_manual_review"

                StagingPath =
                    $null

                Sha256 =
                    $null
            }

        continue
    }

    $fileName =
        [System.IO.Path]::GetFileName(
            $sourcePath
        )

    if (
        $fileName -match
        "remote_schema"
    ) {
        $stagingEntries +=
            [pscustomobject]@{
                SourcePath =
                    $sourcePath

                Status =
                    "excluded_remote_snapshot"

                Phase =
                    "99_manual_review"

                StagingPath =
                    $null

                Sha256 =
                    Get-Sha256 `
                        -Path $sourcePath
            }

        continue
    }

    $sha =
        Get-Sha256 `
            -Path $sourcePath

    if (
        $hashSeen.ContainsKey(
            $sha
        )
    ) {
        $stagingEntries +=
            [pscustomobject]@{
                SourcePath =
                    $sourcePath

                Status =
                    "duplicate_content"

                DuplicateOf =
                    $hashSeen[$sha]

                Phase =
                    $null

                StagingPath =
                    $null

                Sha256 =
                    $sha
            }

        continue
    }

    $phase =
        Get-Phase `
            -Path $sourcePath `
            -Content $content `
            -Class ([string]$entry.Class)

    $counter +=
        1

    $safeOriginalName =
        Get-SafeName `
            -Name $fileName

    $stagingFileName =
        (
            "{0:D4}_{1}" -f
            $counter,
            $safeOriginalName
        )

    $phaseDir =
        Join-Path `
            $stagingRoot `
            $phase

    $targetPath =
        Join-Path `
            $phaseDir `
            $stagingFileName

    $header =
        @"
-- ============================================================
-- KLYX 13.33 STAGING COPY
-- SOURCE: $sourcePath
-- SHA256: $sha
-- PHASE: $phase
-- DO NOT APPLY DIRECTLY TO PRODUCTION
-- ============================================================

"@

    [System.IO.File]::WriteAllText(
        $targetPath,
        (
            $header +
            $content
        ),
        $utf8
    )

    $hashSeen[$sha] =
        $targetPath

    $stagingEntries +=
        [pscustomobject]@{
            SourcePath =
                $sourcePath

            Status =
                "staged"

            Phase =
                $phase

            StagingPath =
                $targetPath

            Sha256 =
                $sha

            SourceClass =
                [string]$entry.Class

            SourceReviewStatus =
                [string]$entry.ReviewStatus
        }
}

# ============================================================
# PHASE INDEX FILES
# ============================================================

foreach (
    $phase
    in $phases
) {
    $phaseDir =
        Join-Path `
            $stagingRoot `
            $phase.Key

    $phaseEntries =
        @(
            $stagingEntries |
            Where-Object {
                $_.Status -eq
                    "staged" -and
                $_.Phase -eq
                    $phase.Key
            }
        )

    $indexPath =
        Join-Path `
            $phaseDir `
            "_INDEX.txt"

    $indexLines =
        New-Object System.Collections.Generic.List[string]

    $indexLines.Add(
        "KLYX 13.33"
    )

    $indexLines.Add(
        "Phase: " +
        $phase.Key
    )

    $indexLines.Add(
        "Files: " +
        $phaseEntries.Count
    )

    $indexLines.Add(
        ""
    )

    foreach (
        $phaseEntry
        in $phaseEntries
    ) {
        $indexLines.Add(
            (
                [System.IO.Path]::GetFileName(
                    $phaseEntry.StagingPath
                )
            ) +
            " <- " +
            $phaseEntry.SourcePath
        )
    }

    [System.IO.File]::WriteAllLines(
        $indexPath,
        $indexLines,
        $utf8
    )
}

# ============================================================
# FINAL MANIFEST
# ============================================================

$staged =
    @(
        $stagingEntries |
        Where-Object {
            $_.Status -eq
            "staged"
        }
    )

$duplicates =
    @(
        $stagingEntries |
        Where-Object {
            $_.Status -eq
            "duplicate_content"
        }
    )

$excluded =
    @(
        $stagingEntries |
        Where-Object {
            $_.Status -like
            "excluded_*"
        }
    )

$manual =
    @(
        $staged |
        Where-Object {
            $_.Phase -eq
            "99_manual_review"
        }
    )

$manifest =
    [pscustomobject]@{
        Step =
            "13.33"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        SourceManifest =
            "13.32"

        StagingRoot =
            $stagingRoot

        Counts =
            [pscustomobject]@{
                SourceFiles =
                    $sourceFiles.Count

                Staged =
                    $staged.Count

                DuplicateContent =
                    $duplicates.Count

                Excluded =
                    $excluded.Count

                ManualReview =
                    $manual.Count
            }

        Entries =
            $stagingEntries

        ProductionDatabaseModified =
            $false

        OfficialMigrationDirectoryModified =
            $false

        SourceSqlMoved =
            $false

        SourceSqlDeleted =
            $false

        ReadyForDisposableDatabaseTest =
            (
                $staged.Count -gt 0
            )

        Important =
            "Staging classification is provisional until a disposable database rebuild succeeds."
    }

$manifestJson =
    $manifest |
    ConvertTo-Json -Depth 100

[System.IO.File]::WriteAllText(
    $outputManifestPath,
    $manifestJson,
    $utf8
)

# ============================================================
# HUMAN PLAN
# ============================================================

$lines =
    New-Object System.Collections.Generic.List[string]

$lines.Add(
    "======================================"
)

$lines.Add(
    "KLYX 13.33 - CANONICAL STAGING HISTORY"
)

$lines.Add(
    "======================================"
)

$lines.Add(
    ""
)

$lines.Add(
    "Source SQL : " +
    $sourceFiles.Count
)

$lines.Add(
    "Staged : " +
    $staged.Count
)

$lines.Add(
    "Exact duplicates removed : " +
    $duplicates.Count
)

$lines.Add(
    "Excluded : " +
    $excluded.Count
)

$lines.Add(
    "Manual review : " +
    $manual.Count
)

$lines.Add(
    ""
)

$lines.Add(
    "---- PHASES ----"
)

foreach (
    $phase
    in $phases
) {
    $count =
        @(
            $staged |
            Where-Object {
                $_.Phase -eq
                $phase.Key
            }
        ).Count

    $lines.Add(
        $phase.Key +
        " : " +
        $count
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "---- SAFETY ----"
)

$lines.Add(
    "Production database modified : NON"
)

$lines.Add(
    "supabase/migrations modified : NON"
)

$lines.Add(
    "Source SQL moved : NON"
)

$lines.Add(
    "Source SQL deleted : NON"
)

$lines.Add(
    ""
)

$lines.Add(
    "Next invariant:"
)

$lines.Add(
    "staging history -> disposable database -> successful rebuild"
)

$lines.Add(
    ""
)

$lines.Add(
    "IMPORTANT:"
)

$lines.Add(
    "La classification 13.33 est provisoire."
)

$lines.Add(
    "Aucun fichier staging n'est autorise en production avant reconstruction reussie sur base jetable."
)

$lines.Add(
    ""
)

$lines.Add(
    "======================================"
)

[System.IO.File]::WriteAllLines(
    $outputPlanPath,
    $lines,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.33 STAGING GENERE"
Write-Host "======================================"
Write-Host (
    "Source SQL : " +
    $sourceFiles.Count
)
Write-Host (
    "Staged : " +
    $staged.Count
)
Write-Host (
    "Duplicates : " +
    $duplicates.Count
)
Write-Host (
    "Excluded : " +
    $excluded.Count
)
Write-Host (
    "Manual review : " +
    $manual.Count
)
Write-Host "Production DB : NON TOUCHEE"
Write-Host "Official migrations : NON TOUCHEES"
Write-Host "======================================"