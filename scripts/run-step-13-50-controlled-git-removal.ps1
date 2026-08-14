$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$planPath =
    Join-Path `
        $root `
        "reports\repository-git-removal-plan-13-49.json"

$archiveRoot =
    Join-Path `
        $root `
        "repository-archive-13-50-git-removal"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-controlled-git-removal-13-50.json"

$reportPath =
    Join-Path `
        $root `
        "reports\repository-controlled-git-removal-13-50.txt"

# ============================================================
# INPUT
# ============================================================

if (
    -not (
        Test-Path `
            -LiteralPath `
            $planPath
    )
) {
    throw "13.50 : plan 13.49 introuvable."
}

$plan =
    Get-Content `
        -LiteralPath `
        $planPath `
        -Raw |
    ConvertFrom-Json

if (
    $plan.AuditComplete -ne
    $true
) {
    throw "13.50 : audit 13.49 incomplet."
}

if (
    $plan.PlanOnly -ne
    $true
) {
    throw "13.50 : plan 13.49 invalide."
}

if (
    [int]$plan.BlockedDirtyCount -ne
    0
) {
    throw "13.50 : fichiers dirty presents."
}

if (
    $plan.GitStatusUnchanged -ne
    $true
) {
    throw "13.50 : etat Git 13.49 non stable."
}

# ============================================================
# ELIGIBLE FILES
# ============================================================

$eligible =
    @(
        $plan.Candidates |
        Where-Object {
            $_.Classification -eq
            "eligible-removal-plan"
        }
    )

# ============================================================
# RECHECK EVERY FILE BEFORE MODIFYING GIT
# ============================================================

$verified =
    @()

foreach (
    $candidate
    in $eligible
) {
    $relative =
        [string]$candidate.RelativePath

    $absolute =
        Join-Path `
            $root `
            $relative

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $absolute `
                -PathType Leaf
        )
    ) {
        throw (
            "13.50 : fichier candidat absent : " +
            $relative
        )
    }

    git ls-files --error-unmatch -- $relative `
        *> $null

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw (
            "13.50 : fichier plus suivi par Git : " +
            $relative
        )
    }

    $worktreeDiff =
        @(
            git diff -- $relative
        )

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw (
            "13.50 : git diff FAILED : " +
            $relative
        )
    }

    $stagedDiff =
        @(
            git diff --cached -- $relative
        )

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw (
            "13.50 : git diff cached FAILED : " +
            $relative
        )
    }

    if (
        $worktreeDiff.Count -gt 0 -or
        $stagedDiff.Count -gt 0
    ) {
        throw (
            "13.50 : fichier devenu dirty : " +
            $relative
        )
    }

    $currentHash =
        (
            Get-FileHash `
                -LiteralPath `
                $absolute `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()

    if (
        $currentHash -ne
        [string]$candidate.Sha256
    ) {
        throw (
            "13.50 : hash modifie depuis 13.49 : " +
            $relative
        )
    }

    $verified +=
        [pscustomobject]@{
            RelativePath =
                $relative

            Length =
                (
                    Get-Item `
                        -LiteralPath `
                        $absolute
                ).Length

            Sha256 =
                $currentHash
        }
}

# ============================================================
# ARCHIVE BEFORE GIT RM
# ============================================================

New-Item `
    -ItemType Directory `
    -Force `
    -Path $archiveRoot |
    Out-Null

foreach (
    $entry
    in $verified
) {
    $source =
        Join-Path `
            $root `
            $entry.RelativePath

    $destination =
        Join-Path `
            $archiveRoot `
            $entry.RelativePath

    $parent =
        Split-Path -Parent $destination

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $parent |
        Out-Null

    if (
        Test-Path `
            -LiteralPath `
            $destination
    ) {
        $existingHash =
            (
                Get-FileHash `
                    -LiteralPath `
                    $destination `
                    -Algorithm SHA256
            ).Hash.ToLowerInvariant()

        if (
            $existingHash -ne
            $entry.Sha256
        ) {
            throw (
                "13.50 : conflit archive : " +
                $entry.RelativePath
            )
        }
    }

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $destination
        )
    ) {
        Copy-Item `
            -LiteralPath `
            $source `
            -Destination `
            $destination
    }

    $archiveHash =
        (
            Get-FileHash `
                -LiteralPath `
                $destination `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()

    if (
        $archiveHash -ne
        $entry.Sha256
    ) {
        throw (
            "13.50 : hash archive invalide : " +
            $entry.RelativePath
        )
    }
}

# ============================================================
# EXECUTE CONTROLLED GIT RM
# ============================================================

$removed =
    New-Object System.Collections.Generic.List[string]

foreach (
    $entry
    in $verified
) {
    Write-Host ""
    Write-Host (
        "git rm -> " +
        $entry.RelativePath
    )

    git rm -- $entry.RelativePath

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw (
            "13.50 : git rm FAILED : " +
            $entry.RelativePath
        )
    }

    $removed.Add(
        $entry.RelativePath
    )
}

# ============================================================
# VERIFY REMOVAL
# ============================================================

foreach (
    $relative
    in $removed
) {
    $source =
        Join-Path `
            $root `
            $relative

    if (
        Test-Path `
            -LiteralPath `
            $source
    ) {
        throw (
            "13.50 : fichier encore present apres git rm : " +
            $relative
        )
    }

    $archive =
        Join-Path `
            $archiveRoot `
            $relative

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $archive `
                -PathType Leaf
        )
    ) {
        throw (
            "13.50 : archive absente : " +
            $relative
        )
    }
}

# ============================================================
# CANONICAL MIGRATION SAFETY
# ============================================================

$migrationsDir =
    Join-Path `
        $root `
        "supabase\migrations"

$official =
    @(
        Get-ChildItem `
            -LiteralPath `
            $migrationsDir `
            -File `
            -Filter "*.sql"
    )

if (
    $official.Count -ne 1
) {
    throw "13.50 : migration canonique affectee."
}

if (
    $official[0].Name -ne
    "20260814000000_klyx_canonical_baseline.sql"
) {
    throw "13.50 : mauvaise migration officielle."
}

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.50"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        SourcePlan =
            "13.49"

        EligibleCount =
            $eligible.Count

        VerifiedCount =
            $verified.Count

        GitRemovedCount =
            $removed.Count

        VerifiedFiles =
            $verified

        GitRemovedFiles =
            @(
                $removed
            )

        ArchiveRoot =
            "repository-archive-13-50-git-removal"

        ArchiveHashesVerified =
            $true

        CanonicalMigrationPreserved =
            $true

        FilesIrreversiblyDeleted =
            0

        GitRmExecuted =
            (
                $removed.Count -gt 0
            )

        ProductionDatabaseModified =
            $false

        LinkedWriteUsed =
            $false

        CleanupRecoverable =
            $true

        RemovalComplete =
            $true
    }

[System.IO.File]::WriteAllText(
    $manifestPath,
    (
        $result |
        ConvertTo-Json -Depth 100
    ),
    $utf8
)

$report =
    @(
        "======================================",
        "KLYX 13.50 - CONTROLLED GIT REMOVAL",
        "======================================",
        "",
        (
            "Eligible files : " +
            $eligible.Count
        ),
        (
            "Verified files : " +
            $verified.Count
        ),
        (
            "git rm files : " +
            $removed.Count
        ),
        "",
        "Archive hashes verified : OUI",
        "Canonical migration preserved : OUI",
        "Irreversible deletion : 0",
        "Recovery archive : AVAILABLE",
        "",
        "Production DB modified : NON",
        "Linked write : NON",
        "======================================"
    )

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.50 CONTROLLED GIT REMOVAL OK"
Write-Host "======================================"
Write-Host (
    "Eligible : " +
    $eligible.Count
)
Write-Host (
    "git rm executed : " +
    $removed.Count
)
Write-Host "Archive hashes : VERIFIED"
Write-Host "Recovery archive : AVAILABLE"
Write-Host "Canonical migration : PRESERVED"
Write-Host "Irreversible deletions : 0"
Write-Host "Production linked writes : NON"
Write-Host "======================================"