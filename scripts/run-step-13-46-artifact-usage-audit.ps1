$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$cleanupManifest =
    Join-Path `
        $root `
        "reports\repository-cleanup-13-45.json"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-artifact-usage-audit-13-46.json"

$reportPath =
    Join-Path `
        $root `
        "reports\repository-artifact-usage-audit-13-46.txt"

# ============================================================
# INPUT
# ============================================================

if (
    -not (
        Test-Path `
            -LiteralPath `
            $cleanupManifest
    )
) {
    throw "13.46 : manifest 13.45 introuvable."
}

$cleanup =
    Get-Content `
        -LiteralPath `
        $cleanupManifest `
        -Raw |
    ConvertFrom-Json

if (
    $cleanup.CleanupComplete -ne
    $true
) {
    throw "13.46 : cleanup 13.45 incomplet."
}

if (
    $cleanup.CleanupReversible -ne
    $true
) {
    throw "13.46 : etat 13.45 non reversible."
}

# ============================================================
# CANDIDATES
# ============================================================

$candidates =
    @(
        $cleanup.GenericArtifactReviewOnly |
        ForEach-Object {
            [string]$_
        } |
        Where-Object {
            $_ -ne ""
        } |
        Sort-Object -Unique
    )

# ============================================================
# GIT TRACKED FILES
# ============================================================

$gitTrackedOutput =
    @(
        git ls-files
    )

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.46 : git ls-files FAILED."
}

$gitTracked =
    New-Object System.Collections.Generic.HashSet[string](
        [System.StringComparer]::OrdinalIgnoreCase
    )

foreach (
    $line
    in $gitTrackedOutput
) {
    $normalized =
        (
            [string]$line
        ).Replace(
            "/",
            "\"
        )

    [void]$gitTracked.Add(
        $normalized
    )
}

# ============================================================
# SEARCHABLE SOURCE FILES
# ============================================================

$excludedDirectoryNames =
    @(
        ".git",
        ".next",
        "node_modules",
        "repository-archive-13-45",
        "reports"
    )

$searchExtensions =
    @(
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mts",
        ".cts",
        ".mjs",
        ".cjs",
        ".json",
        ".css",
        ".scss",
        ".md",
        ".sql",
        ".ps1",
        ".yml",
        ".yaml"
    )

$searchFiles =
    @(
        Get-ChildItem `
            -LiteralPath `
            $root `
            -File `
            -Recurse `
            -Force |
        Where-Object {
            $file =
                $_

            if (
                $file.Extension.ToLowerInvariant() -notin
                $searchExtensions
            ) {
                return $false
            }

            $relative =
                $file.FullName.Substring(
                    $root.Length + 1
                )

            $segments =
                $relative.Split(
                    [System.IO.Path]::DirectorySeparatorChar
                )

            foreach (
                $excluded
                in $excludedDirectoryNames
            ) {
                if (
                    $segments -contains
                    $excluded
                ) {
                    return $false
                }
            }

            return $true
        }
    )

# ============================================================
# HELPERS
# ============================================================

function Get-ReferenceNeedles {
    param(
        [string]$RelativePath
    )

    $normalized =
        $RelativePath.Replace(
            "\",
            "/"
        )

    $fileName =
        [System.IO.Path]::GetFileName(
            $RelativePath
        )

    $baseName =
        [System.IO.Path]::GetFileNameWithoutExtension(
            $RelativePath
        )

    $withoutExtension =
        [System.IO.Path]::ChangeExtension(
            $normalized,
            $null
        )

    $needles =
        New-Object System.Collections.Generic.List[string]

    foreach (
        $value
        in @(
            $normalized,
            $RelativePath,
            $fileName,
            $baseName,
            $withoutExtension
        )
    ) {
        if (
            [string]::IsNullOrWhiteSpace(
                $value
            )
        ) {
            continue
        }

        if (
            $value.Length -lt 4
        ) {
            continue
        }

        if (
            -not $needles.Contains(
                $value
            )
        ) {
            $needles.Add(
                $value
            )
        }
    }

    return @(
        $needles
    )
}

# ============================================================
# ANALYZE EACH CANDIDATE
# ============================================================

$results =
    @()

foreach (
    $relative
    in $candidates
) {
    $absolute =
        Join-Path `
            $root `
            $relative

    $exists =
        Test-Path `
            -LiteralPath `
            $absolute `
            -PathType Leaf

    $tracked =
        $gitTracked.Contains(
            $relative
        )

    $references =
        New-Object System.Collections.Generic.List[object]

    if (
        $exists
    ) {
        $needles =
            @(
                Get-ReferenceNeedles `
                    -RelativePath $relative
            )

        foreach (
            $source
            in $searchFiles
        ) {
            if (
                $source.FullName -eq
                $absolute
            ) {
                continue
            }

            $text =
                $null

            try {
                $text =
                    [System.IO.File]::ReadAllText(
                        $source.FullName
                    )
            }
            catch {
                continue
            }

            foreach (
                $needle
                in $needles
            ) {
                if (
                    $text.IndexOf(
                        $needle,
                        [System.StringComparison]::OrdinalIgnoreCase
                    ) -ge 0
                ) {
                    $sourceRelative =
                        $source.FullName.Substring(
                            $root.Length + 1
                        )

                    $alreadyPresent =
                        $false

                    foreach (
                        $existing
                        in $references
                    ) {
                        if (
                            $existing.Source -eq
                            $sourceRelative
                        ) {
                            $alreadyPresent =
                                $true
                        }
                    }

                    if (
                        -not $alreadyPresent
                    ) {
                        $references.Add(
                            [pscustomobject]@{
                                Source =
                                    $sourceRelative

                                MatchedNeedle =
                                    $needle
                            }
                        )
                    }

                    break
                }
            }
        }
    }

    $referenceCount =
        $references.Count

    $classification =
        "review"

    $reason =
        "Requires manual review."

    if (
        -not $exists
    ) {
        $classification =
            "missing"

        $reason =
            "Candidate from 13.45 no longer exists at original path."
    }

    if (
        $exists -and
        $referenceCount -gt 0
    ) {
        $classification =
            "used"

        $reason =
            "Referenced by repository source files."
    }

    if (
        $exists -and
        $referenceCount -eq 0 -and
        $tracked
    ) {
        $classification =
            "tracked-unreferenced"

        $reason =
            "Tracked by Git but no textual references found."
    }

    if (
        $exists -and
        $referenceCount -eq 0 -and
        -not $tracked
    ) {
        $classification =
            "dead-candidate"

        $reason =
            "Untracked and no textual references found."
    }

    $hash =
        $null

    $length =
        0

    if (
        $exists
    ) {
        $item =
            Get-Item `
                -LiteralPath `
                $absolute

        $length =
            $item.Length

        $hash =
            (
                Get-FileHash `
                    -LiteralPath `
                    $absolute `
                    -Algorithm SHA256
            ).Hash.ToLowerInvariant()
    }

    $results +=
        [pscustomobject]@{
            RelativePath =
                $relative

            Exists =
                $exists

            GitTracked =
                $tracked

            ReferenceCount =
                $referenceCount

            References =
                @(
                    $references
                )

            Classification =
                $classification

            Reason =
                $reason

            Length =
                $length

            Sha256 =
                $hash
        }
}

# ============================================================
# SUMMARY
# ============================================================

$used =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "used"
        }
    )

$trackedUnreferenced =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "tracked-unreferenced"
        }
    )

$deadCandidates =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "dead-candidate"
        }
    )

$missing =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "missing"
        }
    )

$result =
    [pscustomobject]@{
        Step =
            "13.46"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        CandidateCount =
            $candidates.Count

        ExistingCandidateCount =
            @(
                $results |
                Where-Object {
                    $_.Exists
                }
            ).Count

        UsedCount =
            $used.Count

        TrackedUnreferencedCount =
            $trackedUnreferenced.Count

        DeadCandidateCount =
            $deadCandidates.Count

        MissingCount =
            $missing.Count

        Candidates =
            $results

        UsedFiles =
            @(
                $used |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        TrackedUnreferencedFiles =
            @(
                $trackedUnreferenced |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        DeadCandidates =
            @(
                $deadCandidates |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        FilesMoved =
            0

        FilesDeleted =
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

# ============================================================
# TEXT REPORT
# ============================================================

$report =
    New-Object System.Collections.Generic.List[string]

$report.Add(
    "======================================"
)

$report.Add(
    "KLYX 13.46 - ARTIFACT USAGE AUDIT"
)

$report.Add(
    "======================================"
)

$report.Add(
    ""
)

$report.Add(
    "Candidates : " +
    $candidates.Count
)

$report.Add(
    "Used : " +
    $used.Count
)

$report.Add(
    "Tracked but unreferenced : " +
    $trackedUnreferenced.Count
)

$report.Add(
    "Dead candidates : " +
    $deadCandidates.Count
)

$report.Add(
    "Missing : " +
    $missing.Count
)

$report.Add(
    ""
)

if (
    $used.Count -gt 0
) {
    $report.Add(
        "USED - KEEP:"
    )

    foreach (
        $item
        in $used
    ) {
        $report.Add(
            (
                "  " +
                $item.RelativePath +
                " | refs=" +
                $item.ReferenceCount
            )
        )

        foreach (
            $reference
            in $item.References
        ) {
            $report.Add(
                "    <- " +
                $reference.Source
            )
        }
    }

    $report.Add(
        ""
    )
}

if (
    $trackedUnreferenced.Count -gt 0
) {
    $report.Add(
        "TRACKED BUT UNREFERENCED - REVIEW:"
    )

    foreach (
        $item
        in $trackedUnreferenced
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
    $deadCandidates.Count -gt 0
) {
    $report.Add(
        "DEAD CANDIDATES - SAFE FOR CONTROLLED ARCHIVE:"
    )

    foreach (
        $item
        in $deadCandidates
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

$report.Add(
    "Files moved : 0"
)

$report.Add(
    "Files deleted : 0"
)

$report.Add(
    "Source files modified : 0"
)

$report.Add(
    "Repository modified : NON"
)

$report.Add(
    "Audit only : OUI"
)

$report.Add(
    ""
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
Write-Host "KLYX 13.46 ARTIFACT AUDIT OK"
Write-Host "======================================"
Write-Host (
    "Candidates : " +
    $candidates.Count
)
Write-Host (
    "Used files : " +
    $used.Count
)
Write-Host (
    "Tracked unreferenced : " +
    $trackedUnreferenced.Count
)
Write-Host (
    "Dead candidates : " +
    $deadCandidates.Count
)
Write-Host "Files moved : 0"
Write-Host "Files deleted : 0"
Write-Host "Repository modified : NON"
Write-Host "======================================"