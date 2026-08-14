$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$auditPath =
    Join-Path `
        $root `
        "reports\repository-artifact-usage-audit-13-46.json"

$archiveRoot =
    Join-Path `
        $root `
        "repository-archive-13-47-dead-artifacts"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-dead-artifact-archive-13-47.json"

$reportPath =
    Join-Path `
        $root `
        "reports\repository-dead-artifact-archive-13-47.txt"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $auditPath
    )
) {
    throw "13.47 : audit 13.46 introuvable."
}

$audit =
    Get-Content `
        -LiteralPath `
        $auditPath `
        -Raw |
    ConvertFrom-Json

if (
    $audit.AuditComplete -ne
    $true
) {
    throw "13.47 : audit 13.46 incomplet."
}

if (
    $audit.RepositoryModified -ne
    $false
) {
    throw "13.47 : 13.46 avait modifie le repository."
}

$deadCandidates =
    @(
        $audit.Candidates |
        Where-Object {
            $_.Classification -eq
            "dead-candidate"
        }
    )

$eligible =
    @()

foreach (
    $candidate
    in $deadCandidates
) {
    $relative =
        [string]$candidate.RelativePath

    if (
        [string]::IsNullOrWhiteSpace(
            $relative
        )
    ) {
        continue
    }

    if (
        $candidate.GitTracked -ne
        $false
    ) {
        throw (
            "13.47 : dead-candidate suivi par Git : " +
            $relative
        )
    }

    if (
        [int]$candidate.ReferenceCount -ne
        0
    ) {
        throw (
            "13.47 : dead-candidate encore reference : " +
            $relative
        )
    }

    $source =
        Join-Path `
            $root `
            $relative

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $source `
                -PathType Leaf
        )
    ) {
        continue
    }

    $currentHash =
        (
            Get-FileHash `
                -LiteralPath `
                $source `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()

    if (
        $null -ne $candidate.Sha256 -and
        [string]$candidate.Sha256 -ne "" -and
        $currentHash -ne
        [string]$candidate.Sha256
    ) {
        throw (
            "13.47 : hash fichier change depuis 13.46 : " +
            $relative
        )
    }

    $eligible +=
        [pscustomobject]@{
            RelativePath =
                $relative

            Length =
                (
                    Get-Item `
                        -LiteralPath `
                        $source
                ).Length

            Sha256 =
                $currentHash
        }
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $archiveRoot |
    Out-Null

$moved =
    New-Object System.Collections.Generic.List[string]

foreach (
    $entry
    in $eligible
) {
    $source =
        Join-Path `
            $root `
            $entry.RelativePath

    $destination =
        Join-Path `
            $archiveRoot `
            $entry.RelativePath

    $destinationParent =
        Split-Path -Parent $destination

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $destinationParent |
        Out-Null

    if (
        Test-Path `
            -LiteralPath `
            $destination
    ) {
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
                "13.47 : conflit archive : " +
                $entry.RelativePath
            )
        }

        if (
            Test-Path `
                -LiteralPath `
                $source
        ) {
            throw (
                "13.47 : source et archive existent simultanement : " +
                $entry.RelativePath
            )
        }

        continue
    }

    Move-Item `
        -LiteralPath `
        $source `
        -Destination `
        $destination

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
            "13.47 : hash archive invalide : " +
            $entry.RelativePath
        )
    }

    $moved.Add(
        $entry.RelativePath
    )
}

$remaining =
    @()

foreach (
    $entry
    in $eligible
) {
    $source =
        Join-Path `
            $root `
            $entry.RelativePath

    if (
        Test-Path `
            -LiteralPath `
            $source
    ) {
        $remaining +=
            $entry.RelativePath
    }
}

if (
    $remaining.Count -gt 0
) {
    throw (
        "13.47 : dead artifacts encore presents : " +
        (
            $remaining -join ", "
        )
    )
}

# ============================================================
# SAFETY: USED + TRACKED-UNREFERENCED MUST STAY
# ============================================================

$protectedCandidates =
    @(
        $audit.Candidates |
        Where-Object {
            $_.Classification -eq "used" -or
            $_.Classification -eq "tracked-unreferenced"
        }
    )

$missingProtected =
    @()

foreach (
    $candidate
    in $protectedCandidates
) {
    $relative =
        [string]$candidate.RelativePath

    $path =
        Join-Path `
            $root `
            $relative

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        $missingProtected +=
            $relative
    }
}

if (
    $missingProtected.Count -gt 0
) {
    throw (
        "13.47 : fichier protege manquant : " +
        (
            $missingProtected -join ", "
        )
    )
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
    $official.Count -ne
    1
) {
    throw "13.47 : historique migration canonique affecte."
}

if (
    $official[0].Name -ne
    "20260814000000_klyx_canonical_baseline.sql"
) {
    throw "13.47 : mauvaise migration officielle."
}

$result =
    [pscustomobject]@{
        Step =
            "13.47"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        SourceAudit =
            "13.46"

        DeadCandidateCount =
            $deadCandidates.Count

        EligibleCount =
            $eligible.Count

        ArchivedCount =
            $moved.Count

        EligibleFiles =
            $eligible

        ArchivedFiles =
            @(
                $moved
            )

        ProtectedCandidateCount =
            $protectedCandidates.Count

        ProtectedFilesPreserved =
            $true

        ArchiveHashesVerified =
            $true

        OriginalDeadSourcesRemaining =
            $remaining.Count

        CanonicalMigrationPreserved =
            $true

        FilesIrreversiblyDeleted =
            0

        SourceFilesEdited =
            0

        ProductionDatabaseModified =
            $false

        LinkedWriteUsed =
            $false

        CleanupReversible =
            $true

        ArchiveComplete =
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
        "KLYX 13.47 - DEAD ARTIFACT ARCHIVE",
        "======================================",
        "",
        (
            "Dead candidates from 13.46 : " +
            $deadCandidates.Count
        ),
        (
            "Eligible existing files : " +
            $eligible.Count
        ),
        (
            "Archived files : " +
            $moved.Count
        ),
        "",
        "Archive hashes verified : OUI",
        "Used files preserved : OUI",
        "Tracked unreferenced files preserved : OUI",
        "Canonical migration preserved : OUI",
        "",
        "Irreversible deletions : 0",
        "Source files edited : 0",
        "Production DB modified : NON",
        "Linked write : NON",
        "Cleanup reversible : OUI",
        "",
        "======================================"
    )

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.47 DEAD ARTIFACT ARCHIVE OK"
Write-Host "======================================"
Write-Host (
    "Dead candidates : " +
    $deadCandidates.Count
)
Write-Host (
    "Archived : " +
    $moved.Count
)
Write-Host "Used files : PRESERVED"
Write-Host "Tracked unreferenced : PRESERVED"
Write-Host "Archive hashes : VERIFIED"
Write-Host "Canonical migration : PRESERVED"
Write-Host "Irreversible deletions : 0"
Write-Host "Cleanup reversible : OUI"
Write-Host "======================================"