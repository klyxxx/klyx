$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-hygiene-audit-13-44.json"

$reportPath =
    Join-Path `
        $root `
        "reports\repository-hygiene-audit-13-44.txt"

# ============================================================
# EXCLUDED DIRECTORIES
# ============================================================

$excludedDirectories =
    @(
        ".git",
        ".next",
        "node_modules"
    )

# ============================================================
# CANDIDATE PATTERNS
# ============================================================

$backupPatterns =
    @(
        '\.bak$',
        '\.bak-',
        '\.backup$',
        '\.backup-',
        '\.old$',
        '\.old-',
        '\.orig$',
        '\.tmp$',
        '\.temp$',
        '~$'
    )

$artifactNamePatterns =
    @(
        '^copy[-_]',
        '[-_]copy$',
        '^temp[-_]',
        '^tmp[-_]',
        '[-_]temp$',
        '[-_]tmp$',
        '^debug[-_]',
        '[-_]debug$'
    )

$knownArtifactDirectories =
    @(
        ".klyx-cutover-rebuild-13-37",
        ".klyx-post-cutover-audit-13-42"
    )

# ============================================================
# INVENTORY
# ============================================================

$allFiles =
    @(
        Get-ChildItem `
            -LiteralPath `
            $root `
            -File `
            -Recurse `
            -Force |
        Where-Object {
            $fullName =
                $_.FullName

            $excluded =
                $false

            foreach (
                $directory
                in $excludedDirectories
            ) {
                $segment =
                    [System.IO.Path]::DirectorySeparatorChar +
                    $directory +
                    [System.IO.Path]::DirectorySeparatorChar

                if (
                    $fullName.Contains(
                        $segment
                    )
                ) {
                    $excluded =
                        $true
                }
            }

            -not $excluded
        }
    )

$backupCandidates =
    @()

$artifactCandidates =
    @()

foreach (
    $file
    in $allFiles
) {
    $name =
        $file.Name

    $isBackup =
        $false

    foreach (
        $pattern
        in $backupPatterns
    ) {
        if (
            $name -match
            $pattern
        ) {
            $isBackup =
                $true
        }
    }

    if (
        $isBackup
    ) {
        $backupCandidates +=
            [pscustomobject]@{
                RelativePath =
                    $file.FullName.Substring(
                        $root.Length + 1
                    )

                Name =
                    $file.Name

                Length =
                    $file.Length

                Sha256 =
                    (
                        Get-FileHash `
                            -LiteralPath `
                            $file.FullName `
                            -Algorithm SHA256
                    ).Hash.ToLowerInvariant()

                Category =
                    "backup"
            }
    }

    $baseName =
        [System.IO.Path]::GetFileNameWithoutExtension(
            $name
        )

    $isArtifact =
        $false

    foreach (
        $pattern
        in $artifactNamePatterns
    ) {
        if (
            $baseName -match
            $pattern
        ) {
            $isArtifact =
                $true
        }
    }

    if (
        $isArtifact
    ) {
        $artifactCandidates +=
            [pscustomobject]@{
                RelativePath =
                    $file.FullName.Substring(
                        $root.Length + 1
                    )

                Name =
                    $file.Name

                Length =
                    $file.Length

                Sha256 =
                    (
                        Get-FileHash `
                            -LiteralPath `
                            $file.FullName `
                            -Algorithm SHA256
                    ).Hash.ToLowerInvariant()

                Category =
                    "artifact"
            }
    }
}

# ============================================================
# KNOWN TEMP DIRECTORIES
# ============================================================

$tempDirectories =
    @()

foreach (
    $directory
    in $knownArtifactDirectories
) {
    $path =
        Join-Path `
            $root `
            $directory

    if (
        Test-Path `
            -LiteralPath `
            $path
    ) {
        $files =
            @(
                Get-ChildItem `
                    -LiteralPath `
                    $path `
                    -File `
                    -Recurse `
                    -Force
            )

        $totalSize =
            (
                $files |
                Measure-Object `
                    -Property Length `
                    -Sum
            ).Sum

        if (
            $null -eq
            $totalSize
        ) {
            $totalSize =
                0
        }

        $tempDirectories +=
            [pscustomobject]@{
                RelativePath =
                    $directory

                FileCount =
                    $files.Count

                TotalBytes =
                    [int64]$totalSize
            }
    }
}

# ============================================================
# COMPILED-SOURCE BACKUP SAFETY CHECK
# ============================================================

$dangerousBackupExtensions =
    @(
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mts",
        ".cts"
    )

$dangerousBackupFiles =
    @()

foreach (
    $file
    in $allFiles
) {
    $extension =
        $file.Extension.ToLowerInvariant()

    if (
        $extension -in
        $dangerousBackupExtensions
    ) {
        $name =
            $file.Name.ToLowerInvariant()

        if (
            $name.Contains(
                ".bak."
            ) -or
            $name.Contains(
                ".backup."
            ) -or
            $name.Contains(
                ".old."
            )
        ) {
            $dangerousBackupFiles +=
                $file.FullName.Substring(
                    $root.Length + 1
                )
        }
    }
}

# ============================================================
# REPORT DATA
# ============================================================

$backupBytes =
    (
        $backupCandidates |
        Measure-Object `
            -Property Length `
            -Sum
    ).Sum

if (
    $null -eq
    $backupBytes
) {
    $backupBytes =
        0
}

$artifactBytes =
    (
        $artifactCandidates |
        Measure-Object `
            -Property Length `
            -Sum
    ).Sum

if (
    $null -eq
    $artifactBytes
) {
    $artifactBytes =
        0
}

$result =
    [pscustomobject]@{
        Step =
            "13.44"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        TotalFilesScanned =
            $allFiles.Count

        BackupCandidateCount =
            $backupCandidates.Count

        BackupCandidateBytes =
            [int64]$backupBytes

        ArtifactCandidateCount =
            $artifactCandidates.Count

        ArtifactCandidateBytes =
            [int64]$artifactBytes

        KnownTempDirectoryCount =
            $tempDirectories.Count

        DangerousCompilableBackupCount =
            $dangerousBackupFiles.Count

        BackupCandidates =
            $backupCandidates

        ArtifactCandidates =
            $artifactCandidates

        TemporaryDirectories =
            $tempDirectories

        DangerousCompilableBackups =
            $dangerousBackupFiles

        FilesDeleted =
            0

        FilesMoved =
            0

        SourceFilesModified =
            0

        RepositoryModified =
            $false

        AuditOnly =
            $true

        AuditComplete =
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
    New-Object System.Collections.Generic.List[string]

$report.Add(
    "======================================"
)

$report.Add(
    "KLYX 13.44 - REPOSITORY HYGIENE AUDIT"
)

$report.Add(
    "======================================"
)

$report.Add(
    ""
)

$report.Add(
    "Files scanned : " +
    $allFiles.Count
)

$report.Add(
    "Backup candidates : " +
    $backupCandidates.Count
)

$report.Add(
    "Backup bytes : " +
    $backupBytes
)

$report.Add(
    "Artifact candidates : " +
    $artifactCandidates.Count
)

$report.Add(
    "Artifact bytes : " +
    $artifactBytes
)

$report.Add(
    "Known temp directories : " +
    $tempDirectories.Count
)

$report.Add(
    "Dangerous compilable backups : " +
    $dangerousBackupFiles.Count
)

$report.Add(
    ""
)

$report.Add(
    "Files deleted : 0"
)

$report.Add(
    "Files moved : 0"
)

$report.Add(
    "Source files modified : 0"
)

$report.Add(
    "Repository modified : NON"
)

$report.Add(
    ""
)

if (
    $backupCandidates.Count -gt 0
) {
    $report.Add(
        "BACKUP CANDIDATES:"
    )

    foreach (
        $item
        in $backupCandidates
    ) {
        $report.Add(
            "  " +
            $item.RelativePath
        )
    }

    $report.Add(
        ""
    )
}

if (
    $artifactCandidates.Count -gt 0
) {
    $report.Add(
        "ARTIFACT CANDIDATES:"
    )

    foreach (
        $item
        in $artifactCandidates
    ) {
        $report.Add(
            "  " +
            $item.RelativePath
        )
    }

    $report.Add(
        ""
    )
}

if (
    $tempDirectories.Count -gt 0
) {
    $report.Add(
        "TEMP DIRECTORIES:"
    )

    foreach (
        $item
        in $tempDirectories
    ) {
        $report.Add(
            (
                "  " +
                $item.RelativePath +
                " | files=" +
                $item.FileCount +
                " | bytes=" +
                $item.TotalBytes
            )
        )
    }

    $report.Add(
        ""
    )
}

if (
    $dangerousBackupFiles.Count -gt 0
) {
    $report.Add(
        "DANGEROUS COMPILABLE BACKUPS:"
    )

    foreach (
        $item
        in $dangerousBackupFiles
    ) {
        $report.Add(
            "  " +
            $item
        )
    }

    $report.Add(
        ""
    )
}

$report.Add(
    "AUDIT ONLY : OUI"
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
Write-Host "KLYX 13.44 REPOSITORY AUDIT OK"
Write-Host "======================================"
Write-Host (
    "Files scanned : " +
    $allFiles.Count
)
Write-Host (
    "Backup candidates : " +
    $backupCandidates.Count
)
Write-Host (
    "Artifact candidates : " +
    $artifactCandidates.Count
)
Write-Host (
    "Temp directories : " +
    $tempDirectories.Count
)
Write-Host (
    "Dangerous compilable backups : " +
    $dangerousBackupFiles.Count
)
Write-Host "Files deleted : 0"
Write-Host "Files moved : 0"
Write-Host "Repository modified : NON"
Write-Host "======================================"