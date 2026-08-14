$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$auditPath =
    Join-Path `
        $root `
        "reports\repository-hygiene-audit-13-44.json"

$archiveRoot =
    Join-Path `
        $root `
        "repository-archive-13-45"

$filesArchive =
    Join-Path `
        $archiveRoot `
        "files"

$directoriesArchive =
    Join-Path `
        $archiveRoot `
        "directories"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-cleanup-13-45.json"

$reportPath =
    Join-Path `
        $root `
        "reports\repository-cleanup-13-45.txt"

# ============================================================
# INPUT
# ============================================================

if (
    -not (
        Test-Path `
            -LiteralPath `
            $auditPath
    )
) {
    throw "13.45 : audit 13.44 introuvable."
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
    throw "13.45 : audit 13.44 incomplet."
}

if (
    $audit.RepositoryModified -ne
    $false
) {
    throw "13.45 : audit 13.44 avait modifie le repository."
}

# ============================================================
# ARCHIVE EXCLUSIONS
# Files already stored in deliberate archives stay where they are.
# ============================================================

$protectedArchivePrefixes =
    @(
        "supabase\migration-history-archive-13-37\",
        "supabase\migration-artifacts-archive-13-43\",
        "repository-archive-13-45\"
    )

function Test-IsProtectedArchivePath {
    param(
        [string]$RelativePath
    )

    foreach (
        $prefix
        in $protectedArchivePrefixes
    ) {
        if (
            $RelativePath.StartsWith(
                $prefix,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        ) {
            return $true
        }
    }

    return $false
}

function Test-IsInsideTempDirectory {
    param(
        [string]$RelativePath,
        [string[]]$TempDirectories
    )

    foreach (
        $directory
        in $TempDirectories
    ) {
        $prefix =
            $directory.TrimEnd(
                "\"
            ) +
            "\"

        if (
            $RelativePath.StartsWith(
                $prefix,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        ) {
            return $true
        }
    }

    return $false
}

# ============================================================
# TEMP DIRECTORIES FROM 13.44
# ============================================================

$tempDirectories =
    @(
        $audit.TemporaryDirectories |
        ForEach-Object {
            [string]$_.RelativePath
        } |
        Where-Object {
            $_ -ne ""
        } |
        Sort-Object -Unique
    )

# ============================================================
# FILE CANDIDATES
# ============================================================

$fileCandidates =
    New-Object System.Collections.Generic.List[string]

foreach (
    $item
    in @(
        $audit.BackupCandidates
    )
) {
    $relative =
        [string]$item.RelativePath

    if (
        $relative -eq ""
    ) {
        continue
    }

    if (
        Test-IsProtectedArchivePath `
            -RelativePath $relative
    ) {
        continue
    }

    if (
        Test-IsInsideTempDirectory `
            -RelativePath $relative `
            -TempDirectories $tempDirectories
    ) {
        continue
    }

    if (
        -not $fileCandidates.Contains(
            $relative
        )
    ) {
        $fileCandidates.Add(
            $relative
        )
    }
}

foreach (
    $relative
    in @(
        $audit.DangerousCompilableBackups
    )
) {
    $relative =
        [string]$relative

    if (
        $relative -eq ""
    ) {
        continue
    }

    if (
        Test-IsProtectedArchivePath `
            -RelativePath $relative
    ) {
        continue
    }

    if (
        Test-IsInsideTempDirectory `
            -RelativePath $relative `
            -TempDirectories $tempDirectories
    ) {
        continue
    }

    if (
        -not $fileCandidates.Contains(
            $relative
        )
    ) {
        $fileCandidates.Add(
            $relative
        )
    }
}

# ============================================================
# SNAPSHOT FILE HASHES BEFORE MOVE
# ============================================================

$fileInventory =
    @()

foreach (
    $relative
    in $fileCandidates
) {
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

    $file =
        Get-Item `
            -LiteralPath `
            $source

    $fileInventory +=
        [pscustomobject]@{
            RelativePath =
                $relative

            Length =
                $file.Length

            Sha256 =
                (
                    Get-FileHash `
                        -LiteralPath `
                        $source `
                        -Algorithm SHA256
                ).Hash.ToLowerInvariant()
        }
}

# ============================================================
# SNAPSHOT TEMP DIRECTORY CONTENT BEFORE MOVE
# ============================================================

$directoryInventory =
    @()

foreach (
    $relativeDirectory
    in $tempDirectories
) {
    $sourceDirectory =
        Join-Path `
            $root `
            $relativeDirectory

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $sourceDirectory `
                -PathType Container
        )
    ) {
        continue
    }

    $entries =
        @()

    $files =
        @(
            Get-ChildItem `
                -LiteralPath `
                $sourceDirectory `
                -File `
                -Recurse `
                -Force
        )

    foreach (
        $file
        in $files
    ) {
        $insideRelative =
            $file.FullName.Substring(
                $sourceDirectory.Length
            ).TrimStart(
                "\"
            )

        $entries +=
            [pscustomobject]@{
                RelativePath =
                    $insideRelative

                Length =
                    $file.Length

                Sha256 =
                    (
                        Get-FileHash `
                            -LiteralPath `
                            $file.FullName `
                            -Algorithm SHA256
                    ).Hash.ToLowerInvariant()
            }
    }

    $directoryInventory +=
        [pscustomobject]@{
            RelativePath =
                $relativeDirectory

            FileCount =
                $entries.Count

            Files =
                $entries
        }
}

# ============================================================
# CREATE ARCHIVE ROOTS
# ============================================================

New-Item `
    -ItemType Directory `
    -Force `
    -Path $filesArchive |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $directoriesArchive |
    Out-Null

# ============================================================
# MOVE FILES
# ============================================================

$movedFiles =
    New-Object System.Collections.Generic.List[string]

foreach (
    $entry
    in $fileInventory
) {
    $source =
        Join-Path `
            $root `
            $entry.RelativePath

    $destination =
        Join-Path `
            $filesArchive `
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
                "13.45 : archive fichier en conflit : " +
                $entry.RelativePath
            )
        }

        if (
            Test-Path `
                -LiteralPath `
                $source
        ) {
            throw (
                "13.45 : source et archive existent deja : " +
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

    $destinationHash =
        (
            Get-FileHash `
                -LiteralPath `
                $destination `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()

    if (
        $destinationHash -ne
        $entry.Sha256
    ) {
        throw (
            "13.45 : hash apres move invalide : " +
            $entry.RelativePath
        )
    }

    $movedFiles.Add(
        $entry.RelativePath
    )
}

# ============================================================
# MOVE TEMP DIRECTORIES WHOLE
# ============================================================

$movedDirectories =
    New-Object System.Collections.Generic.List[string]

foreach (
    $directory
    in $directoryInventory
) {
    $source =
        Join-Path `
            $root `
            $directory.RelativePath

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $source `
                -PathType Container
        )
    ) {
        continue
    }

    $destination =
        Join-Path `
            $directoriesArchive `
            $directory.RelativePath

    if (
        Test-Path `
            -LiteralPath `
            $destination
    ) {
        throw (
            "13.45 : archive dossier deja presente : " +
            $directory.RelativePath
        )
    }

    $destinationParent =
        Split-Path -Parent $destination

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $destinationParent |
        Out-Null

    Move-Item `
        -LiteralPath `
        $source `
        -Destination `
        $destination

    foreach (
        $entry
        in $directory.Files
    ) {
        $archivedFile =
            Join-Path `
                $destination `
                $entry.RelativePath

        if (
            -not (
                Test-Path `
                    -LiteralPath `
                    $archivedFile `
                    -PathType Leaf
            )
        ) {
            throw (
                "13.45 : fichier dossier archive absent : " +
                $directory.RelativePath +
                "\" +
                $entry.RelativePath
            )
        }

        $hash =
            (
                Get-FileHash `
                    -LiteralPath `
                    $archivedFile `
                    -Algorithm SHA256
            ).Hash.ToLowerInvariant()

        if (
            $hash -ne
            $entry.Sha256
        ) {
            throw (
                "13.45 : hash dossier archive invalide : " +
                $directory.RelativePath +
                "\" +
                $entry.RelativePath
            )
        }
    }

    $movedDirectories.Add(
        $directory.RelativePath
    )
}

# ============================================================
# VERIFY ORIGINAL LOCATIONS ARE CLEAN
# ============================================================

$remainingMovedSources =
    @()

foreach (
    $relative
    in $movedFiles
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
        $remainingMovedSources +=
            $relative
    }
}

foreach (
    $relative
    in $movedDirectories
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
        $remainingMovedSources +=
            $relative
    }
}

if (
    $remainingMovedSources.Count -gt 0
) {
    throw (
        "13.45 : sources encore presentes apres archivage : " +
        (
            $remainingMovedSources -join ", "
        )
    )
}

# ============================================================
# VERIFY CANONICAL MIGRATION STILL SAFE
# ============================================================

$officialMigrations =
    @(
        Get-ChildItem `
            -LiteralPath `
            (
                Join-Path `
                    $root `
                    "supabase\migrations"
            ) `
            -File `
            -Filter "*.sql"
    )

if (
    $officialMigrations.Count -ne 1
) {
    throw (
        "13.45 : migration canonique affectee. Count=" +
        $officialMigrations.Count
    )
}

if (
    $officialMigrations[0].Name -ne
    "20260814000000_klyx_canonical_baseline.sql"
) {
    throw "13.45 : mauvaise migration officielle."
}

# ============================================================
# GENERIC ARTIFACTS REMAIN REVIEW-ONLY
# ============================================================

$artifactReviewOnly =
    @(
        $audit.ArtifactCandidates |
        ForEach-Object {
            [string]$_.RelativePath
        } |
        Where-Object {
            $_ -ne ""
        } |
        Sort-Object -Unique
    )

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.45"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        SourceAuditStep =
            "13.44"

        ArchiveRoot =
            "repository-archive-13-45"

        BackupFilesEligible =
            $fileInventory.Count

        BackupFilesMoved =
            $movedFiles.Count

        TemporaryDirectoriesEligible =
            $directoryInventory.Count

        TemporaryDirectoriesMoved =
            $movedDirectories.Count

        FileInventory =
            $fileInventory

        DirectoryInventory =
            $directoryInventory

        MovedFiles =
            @(
                $movedFiles
            )

        MovedDirectories =
            @(
                $movedDirectories
            )

        GenericArtifactReviewOnly =
            $artifactReviewOnly

        GenericArtifactsMoved =
            0

        ArchiveHashesVerified =
            $true

        OriginalMovedSourcesRemaining =
            $remainingMovedSources.Count

        CanonicalMigrationPreserved =
            $true

        FilesIrreversiblyDeleted =
            0

        SourceFilesEdited =
            0

        ProductionDatabaseModified =
            $false

        ProductionSchemaModified =
            $false

        LinkedWriteUsed =
            $false

        CleanupReversible =
            $true

        CleanupComplete =
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

# ============================================================
# REPORT
# ============================================================

$report =
    New-Object System.Collections.Generic.List[string]

$report.Add(
    "======================================"
)

$report.Add(
    "KLYX 13.45 - CONTROLLED REPOSITORY CLEANUP"
)

$report.Add(
    "======================================"
)

$report.Add(
    ""
)

$report.Add(
    "Backup files eligible : " +
    $fileInventory.Count
)

$report.Add(
    "Backup files moved : " +
    $movedFiles.Count
)

$report.Add(
    "Temporary directories eligible : " +
    $directoryInventory.Count
)

$report.Add(
    "Temporary directories moved : " +
    $movedDirectories.Count
)

$report.Add(
    "Generic artifact candidates review-only : " +
    $artifactReviewOnly.Count
)

$report.Add(
    ""
)

$report.Add(
    "Archive hashes verified : OUI"
)

$report.Add(
    "Canonical migration preserved : OUI"
)

$report.Add(
    "Irreversible deletions : 0"
)

$report.Add(
    "Source files edited : 0"
)

$report.Add(
    "Production DB modified : NON"
)

$report.Add(
    "Linked write : NON"
)

$report.Add(
    ""
)

$report.Add(
    "Cleanup reversible : OUI"
)

$report.Add(
    "======================================"
)

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.45 CONTROLLED CLEANUP OK"
Write-Host "======================================"
Write-Host (
    "Backup files archived : " +
    $movedFiles.Count
)
Write-Host (
    "Temporary directories archived : " +
    $movedDirectories.Count
)
Write-Host (
    "Generic artifacts untouched : " +
    $artifactReviewOnly.Count
)
Write-Host "Archive hashes : VERIFIED"
Write-Host "Canonical migration : PRESERVED"
Write-Host "Irreversible deletions : 0"
Write-Host "Production linked writes : NON"
Write-Host "Cleanup reversible : OUI"
Write-Host "======================================"