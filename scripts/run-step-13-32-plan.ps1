$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-migration-audit-13-31.json"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-fresh-rebuild-manifest-13-32.json"

$planPath =
    Join-Path `
        $root `
        "reports\supabase-fresh-rebuild-plan-13-32.txt"

# KLYX_SUPABASE_FRESH_REBUILD_MANIFEST_13_32

$report =
    Get-Content `
        -LiteralPath `
        $reportPath `
        -Raw |
    ConvertFrom-Json

if (
    $report.Step -ne
    "13.31"
) {
    throw "13.32 : rapport source invalide."
}

function Get-Sha256 {
    param(
        [string]$Path
    )

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $Path
        )
    ) {
        return $null
    }

    return (
        Get-FileHash `
            -LiteralPath `
            $Path `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()
}

function Get-SqlClass {
    param(
        [string]$Path
    )

    $name =
        [System.IO.Path]::GetFileName(
            $Path
        ).ToLowerInvariant()

    $content =
        ""

    if (
        Test-Path `
            -LiteralPath `
            $Path
    ) {
        $content =
            [System.IO.File]::ReadAllText(
                $Path
            ).ToLowerInvariant()
    }

    if (
        $name -match "remote_schema"
    ) {
        return "remote_snapshot"
    }

    if (
        $name -match "seed"
    ) {
        return "seed"
    }

    if (
        $content -match "\bcreate\s+table\b"
    ) {
        return "schema"
    }

    if (
        $content -match "\balter\s+table\b"
    ) {
        return "schema_patch"
    }

    if (
        $content -match "\bcreate\s+(or\s+replace\s+)?function\b"
    ) {
        return "function"
    }

    if (
        $content -match "\bcreate\s+policy\b" -or
        $content -match "row level security"
    ) {
        return "security"
    }

    return "unknown"
}

function Get-Risk {
    param(
        [string]$Path,
        [string]$Class
    )

    $lower =
        $Path.ToLowerInvariant()

    if (
        $Class -eq
        "remote_snapshot"
    ) {
        return "exclude_candidate"
    }

    if (
        $lower -match "legacy" -or
        $lower -match "backup" -or
        $lower -match "old"
    ) {
        return "legacy_review"
    }

    if (
        $Class -eq
        "unknown"
    ) {
        return "manual_review"
    }

    return "candidate"
}

$allPaths =
    New-Object System.Collections.Generic.List[string]

foreach (
    $entry
    in @(
        $report.ActiveMigrations
    )
) {
    if (
        $entry.FullPath
    ) {
        $allPaths.Add(
            [string]$entry.FullPath
        )
    }
}

foreach (
    $path
    in @(
        $report.DispersedSqlFiles
    )
) {
    if (
        $path
    ) {
        $allPaths.Add(
            [string]$path
        )
    }
}

$uniquePaths =
    @(
        $allPaths |
        Sort-Object -Unique
    )

$entries =
    @()

foreach (
    $path
    in $uniquePaths
) {
    $exists =
        Test-Path `
            -LiteralPath `
            $path

    $class =
        Get-SqlClass `
            -Path $path

    $risk =
        Get-Risk `
            -Path $path `
            -Class $class

    $fileName =
        [System.IO.Path]::GetFileName(
            $path
        )

    $timestamp =
        ""

    $timestampMatch =
        [regex]::Match(
            $fileName,
            "^(\d{14})_"
        )

    if (
        $timestampMatch.Success
    ) {
        $timestamp =
            $timestampMatch.Groups[1].Value
    }

    $entries +=
        [pscustomobject]@{
            Path =
                $path

            FileName =
                $fileName

            Exists =
                $exists

            Sha256 =
                Get-Sha256 `
                    -Path $path

            Timestamp =
                $timestamp

            Class =
                $class

            ReviewStatus =
                $risk

            CurrentlyActive =
                $path.StartsWith(
                    (
                        Join-Path `
                            $root `
                            "supabase\migrations"
                    ),
                    [System.StringComparison]::OrdinalIgnoreCase
                )

            ProposedAction =
                switch (
                    $risk
                ) {
                    "candidate" {
                        "review_for_canonical_migration"
                    }

                    "legacy_review" {
                        "compare_before_import"
                    }

                    "exclude_candidate" {
                        "do_not_import_automatically"
                    }

                    default {
                        "manual_review_required"
                    }
                }
        }
}

$active =
    @(
        $entries |
        Where-Object {
            $_.CurrentlyActive
        }
    )

$dispersed =
    @(
        $entries |
        Where-Object {
            -not $_.CurrentlyActive
        }
    )

$missing =
    @(
        $entries |
        Where-Object {
            -not $_.Exists
        }
    )

$manualReview =
    @(
        $entries |
        Where-Object {
            $_.ReviewStatus -ne
            "candidate"
        }
    )

$hashDuplicates =
    @(
        $entries |
        Where-Object {
            $_.Sha256
        } |
        Group-Object Sha256 |
        Where-Object {
            $_.Count -gt 1
        }
    )

$canonicalPhases =
    @(
        [pscustomobject]@{
            Order = 1
            Name = "extensions_and_foundation"
            Purpose = "Extensions PostgreSQL, fonctions utilitaires et fondations."
        },
        [pscustomobject]@{
            Order = 2
            Name = "identity_and_profiles"
            Purpose = "Profils, comptes, rôles et identité KLYX."
        },
        [pscustomobject]@{
            Order = 3
            Name = "services_and_market"
            Purpose = "Services, métiers, offres, demandes et matching."
        },
        [pscustomobject]@{
            Order = 4
            Name = "bookings"
            Purpose = "Réservations simples et groupées."
        },
        [pscustomobject]@{
            Order = 5
            Name = "payments"
            Purpose = "Stripe, ledger, paiements et remboursements."
        },
        [pscustomobject]@{
            Order = 6
            Name = "split_missions"
            Purpose = "Missions multi-prestataires 13.18+."
        },
        [pscustomobject]@{
            Order = 7
            Name = "trust_security"
            Purpose = "RLS, KYC, Sumsub, scores, litiges et sécurité."
        },
        [pscustomobject]@{
            Order = 8
            Name = "brain_memory"
            Purpose = "Brain, mémoire, assistant et données IA."
        },
        [pscustomobject]@{
            Order = 9
            Name = "final_constraints"
            Purpose = "Contraintes finales, index, triggers et politiques."
        }
    )

$manifest =
    [pscustomobject]@{
        Step =
            "13.32"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        Goal =
            "fresh_database_rebuild"

        SourceAudit =
            "13.31"

        CurrentFreshRebuildReady =
            [bool]$report.FreshRebuildReady

        Counts =
            [pscustomobject]@{
                SqlFiles =
                    $entries.Count

                Active =
                    $active.Count

                Dispersed =
                    $dispersed.Count

                Missing =
                    $missing.Count

                ManualReview =
                    $manualReview.Count

                DuplicateContentGroups =
                    $hashDuplicates.Count
            }

        CanonicalPhases =
            $canonicalPhases

        Files =
            $entries

        DuplicateContent =
            @(
                $hashDuplicates |
                ForEach-Object {
                    [pscustomobject]@{
                        Sha256 =
                            $_.Name

                        Files =
                            @(
                                $_.Group |
                                ForEach-Object {
                                    $_.Path
                                }
                            )
                    }
                }
            )

        TargetInvariant =
            "fresh Supabase database -> supabase db push -> complete KLYX schema"

        DestructiveChangesApplied =
            $false

        DatabaseModified =
            $false

        FilesMoved =
            $false

        FilesDeleted =
            $false
    }

$json =
    $manifest |
    ConvertTo-Json -Depth 100

[System.IO.File]::WriteAllText(
    $manifestPath,
    $json,
    $utf8
)

$lines =
    New-Object System.Collections.Generic.List[string]

$lines.Add(
    "======================================"
)

$lines.Add(
    "KLYX 13.32 - FRESH REBUILD PLAN"
)

$lines.Add(
    "======================================"
)

$lines.Add(
    ""
)

$lines.Add(
    "OBJECTIF"
)

$lines.Add(
    "Base Supabase vierge -> supabase db push -> KLYX complet"
)

$lines.Add(
    ""
)

$lines.Add(
    "ETAT ACTUEL"
)

$lines.Add(
    "Fresh rebuild ready : " +
    $manifest.CurrentFreshRebuildReady
)

$lines.Add(
    "SQL analyses : " +
    $manifest.Counts.SqlFiles
)

$lines.Add(
    "Migrations actives : " +
    $manifest.Counts.Active
)

$lines.Add(
    "SQL disperses : " +
    $manifest.Counts.Dispersed
)

$lines.Add(
    "Fichiers manquants : " +
    $manifest.Counts.Missing
)

$lines.Add(
    "Revue manuelle : " +
    $manifest.Counts.ManualReview
)

$lines.Add(
    "Doublons de contenu : " +
    $manifest.Counts.DuplicateContentGroups
)

$lines.Add(
    ""
)

$lines.Add(
    "---- ORDRE CANONIQUE CIBLE ----"
)

foreach (
    $phase
    in $canonicalPhases
) {
    $lines.Add(
        (
            "{0:D2}. {1} - {2}" -f
            $phase.Order,
            $phase.Name,
            $phase.Purpose
        )
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "---- FICHIERS A REVOIR ----"
)

foreach (
    $entry
    in $entries
) {
    $lines.Add(
        $entry.ReviewStatus +
        " | " +
        $entry.Class +
        " | " +
        $entry.ProposedAction +
        " | " +
        $entry.Path
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "---- REGLES 13.32 ----"
)

$lines.Add(
    "1. Aucun SQL supprime automatiquement."
)

$lines.Add(
    "2. Aucun SQL legacy importe automatiquement."
)

$lines.Add(
    "3. Un doublon SHA256 ne doit exister qu'une fois dans le futur historique canonique."
)

$lines.Add(
    "4. remote_schema.sql n'est jamais considere comme migration canonique automatiquement."
)

$lines.Add(
    "5. Les migrations deja appliquees en production ne sont jamais reeditees silencieusement."
)

$lines.Add(
    "6. La future consolidation doit etre testee sur une base jetable avant production."
)

$lines.Add(
    "7. Production Supabase reste intacte pendant 13.32."
)

$lines.Add(
    ""
)

$lines.Add(
    "Database modified : NON"
)

$lines.Add(
    "Files moved : NON"
)

$lines.Add(
    "Files deleted : NON"
)

$lines.Add(
    ""
)

$lines.Add(
    "======================================"
)

[System.IO.File]::WriteAllLines(
    $planPath,
    $lines,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.32 PLAN GENERE"
Write-Host "======================================"
Write-Host (
    "SQL analyses : " +
    $entries.Count
)
Write-Host (
    "Migrations actives : " +
    $active.Count
)
Write-Host (
    "SQL disperses : " +
    $dispersed.Count
)
Write-Host (
    "Revue manuelle : " +
    $manualReview.Count
)
Write-Host (
    "Doublons contenu : " +
    $hashDuplicates.Count
)
Write-Host "Production DB : NON TOUCHEE"
Write-Host "SQL moved : NON"
Write-Host "SQL deleted : NON"
Write-Host "======================================"