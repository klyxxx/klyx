$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$audit13_46 =
    Join-Path `
        $root `
        "reports\repository-artifact-usage-audit-13-46.json"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-tracked-unreferenced-audit-13-48.json"

$reportPath =
    Join-Path `
        $root `
        "reports\repository-tracked-unreferenced-audit-13-48.txt"

# ============================================================
# INPUT
# ============================================================

if (
    -not (
        Test-Path `
            -LiteralPath `
            $audit13_46
    )
) {
    throw "13.48 : audit 13.46 introuvable."
}

$audit =
    Get-Content `
        -LiteralPath `
        $audit13_46 `
        -Raw |
    ConvertFrom-Json

if (
    $audit.AuditComplete -ne
    $true
) {
    throw "13.48 : audit 13.46 incomplet."
}

$candidates =
    @(
        $audit.Candidates |
        Where-Object {
            $_.Classification -eq
            "tracked-unreferenced"
        }
    )

# ============================================================
# GIT STATE
# ============================================================

$gitTrackedOutput =
    @(
        git ls-files
    )

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.48 : git ls-files FAILED."
}

$trackedSet =
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

    [void]$trackedSet.Add(
        $normalized
    )
}

$statusOutput =
    @(
        git status --porcelain
    )

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.48 : git status FAILED."
}

# ============================================================
# SEARCHABLE FILES
# ============================================================

$excludedDirectories =
    @(
        ".git",
        ".next",
        "node_modules",
        "repository-archive-13-45",
        "repository-archive-13-47-dead-artifacts"
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
        ".sql",
        ".ps1",
        ".md",
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
                in $excludedDirectories
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
# RUNTIME-SENSITIVE RULES
# ============================================================

$runtimeFileNames =
    @(
        "page.tsx",
        "page.ts",
        "layout.tsx",
        "layout.ts",
        "route.ts",
        "route.js",
        "loading.tsx",
        "loading.ts",
        "error.tsx",
        "error.ts",
        "not-found.tsx",
        "not-found.ts",
        "template.tsx",
        "template.ts",
        "default.tsx",
        "default.ts",
        "middleware.ts",
        "middleware.js",
        "proxy.ts",
        "proxy.js",
        "instrumentation.ts",
        "instrumentation.js",
        "next.config.ts",
        "next.config.js",
        "next.config.mjs",
        "postcss.config.js",
        "postcss.config.mjs",
        "tailwind.config.ts",
        "tailwind.config.js",
        "eslint.config.js",
        "eslint.config.mjs"
    )

$runtimePrefixes =
    @(
        "app\",
        "pages\",
        "public\",
        "supabase\functions\"
    )

function Test-RuntimeSensitive {
    param(
        [string]$RelativePath
    )

    $name =
        [System.IO.Path]::GetFileName(
            $RelativePath
        )

    if (
        $name -in
        $runtimeFileNames
    ) {
        return $true
    }

    foreach (
        $prefix
        in $runtimePrefixes
    ) {
        if (
            $RelativePath.StartsWith(
                $prefix,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        ) {
            if (
                $name -match
                '^(page|layout|route|loading|error|not-found|template|default)\.'
            ) {
                return $true
            }
        }
    }

    return $false
}

# ============================================================
# REFERENCE SEARCH
# ============================================================

function Get-Needles {
    param(
        [string]$RelativePath
    )

    $unixPath =
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
            $unixPath,
            $null
        )

    $values =
        New-Object System.Collections.Generic.List[string]

    foreach (
        $value
        in @(
            $RelativePath,
            $unixPath,
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
            -not $values.Contains(
                $value
            )
        ) {
            $values.Add(
                $value
            )
        }
    }

    return @(
        $values
    )
}

# ============================================================
# ANALYSIS
# ============================================================

$results =
    @()

foreach (
    $candidate
    in $candidates
) {
    $relative =
        [string]$candidate.RelativePath

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
        $trackedSet.Contains(
            $relative
        )

    if (
        -not $tracked
    ) {
        throw (
            "13.48 : candidat 13.46 plus suivi par Git : " +
            $relative
        )
    }

    $runtimeSensitive =
        Test-RuntimeSensitive `
            -RelativePath $relative

    $references =
        New-Object System.Collections.Generic.List[object]

    if (
        $exists
    ) {
        $needles =
            @(
                Get-Needles `
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

                    $duplicate =
                        $false

                    foreach (
                        $existingReference
                        in $references
                    ) {
                        if (
                            $existingReference.Source -eq
                            $sourceRelative
                        ) {
                            $duplicate =
                                $true
                        }
                    }

                    if (
                        -not $duplicate
                    ) {
                        $references.Add(
                            [pscustomobject]@{
                                Source =
                                    $sourceRelative

                                Needle =
                                    $needle
                            }
                        )
                    }

                    break
                }
            }
        }
    }

    $gitDirty =
        $false

    foreach (
        $statusLine
        in $statusOutput
    ) {
        $statusText =
            [string]$statusLine

        if (
            $statusText.IndexOf(
                $relative,
                [System.StringComparison]::OrdinalIgnoreCase
            ) -ge 0 -or
            $statusText.IndexOf(
                $relative.Replace("\", "/"),
                [System.StringComparison]::OrdinalIgnoreCase
            ) -ge 0
        ) {
            $gitDirty =
                $true
        }
    }

    $classification =
        "manual-review"

    $reason =
        "Tracked file requires manual decision."

    if (
        -not $exists
    ) {
        $classification =
            "missing-tracked"

        $reason =
            "Tracked file missing from working tree."
    }

    if (
        $exists -and
        $runtimeSensitive
    ) {
        $classification =
            "keep-runtime"

        $reason =
            "Runtime or framework convention may load this file without textual import."
    }

    if (
        $exists -and
        $references.Count -gt 0
    ) {
        $classification =
            "keep-referenced"

        $reason =
            "References were detected during deeper repository scan."
    }

    if (
        $exists -and
        $references.Count -eq 0 -and
        -not $runtimeSensitive -and
        $gitDirty
    ) {
        $classification =
            "keep-dirty"

        $reason =
            "File has uncommitted Git state and must not be archived automatically."
    }

    if (
        $exists -and
        $references.Count -eq 0 -and
        -not $runtimeSensitive -and
        -not $gitDirty
    ) {
        $classification =
            "archive-review"

        $reason =
            "Tracked, clean, non-runtime file with no detected references."
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

            GitDirty =
                $gitDirty

            RuntimeSensitive =
                $runtimeSensitive

            ReferenceCount =
                $references.Count

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
# GROUPS
# ============================================================

$keepRuntime =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "keep-runtime"
        }
    )

$keepReferenced =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "keep-referenced"
        }
    )

$keepDirty =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "keep-dirty"
        }
    )

$archiveReview =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "archive-review"
        }
    )

$missingTracked =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "missing-tracked"
        }
    )

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.48"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        CandidateCount =
            $candidates.Count

        KeepRuntimeCount =
            $keepRuntime.Count

        KeepReferencedCount =
            $keepReferenced.Count

        KeepDirtyCount =
            $keepDirty.Count

        ArchiveReviewCount =
            $archiveReview.Count

        MissingTrackedCount =
            $missingTracked.Count

        Candidates =
            $results

        ArchiveReviewFiles =
            @(
                $archiveReview |
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
# REPORT
# ============================================================

$report =
    New-Object System.Collections.Generic.List[string]

$report.Add(
    "======================================"
)

$report.Add(
    "KLYX 13.48 - TRACKED UNREFERENCED DEEP AUDIT"
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
    "Keep runtime : " +
    $keepRuntime.Count
)

$report.Add(
    "Keep referenced : " +
    $keepReferenced.Count
)

$report.Add(
    "Keep dirty : " +
    $keepDirty.Count
)

$report.Add(
    "Archive review : " +
    $archiveReview.Count
)

$report.Add(
    "Missing tracked : " +
    $missingTracked.Count
)

$report.Add(
    ""
)

if (
    $archiveReview.Count -gt 0
) {
    $report.Add(
        "ARCHIVE REVIEW:"
    )

    foreach (
        $item
        in $archiveReview
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
    $keepRuntime.Count -gt 0
) {
    $report.Add(
        "KEEP - RUNTIME:"
    )

    foreach (
        $item
        in $keepRuntime
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
    $keepReferenced.Count -gt 0
) {
    $report.Add(
        "KEEP - REFERENCED:"
    )

    foreach (
        $item
        in $keepReferenced
    ) {
        $report.Add(
            (
                "  " +
                $item.RelativePath +
                " | refs=" +
                $item.ReferenceCount
            )
        )
    }

    $report.Add(
        ""
    )
}

if (
    $keepDirty.Count -gt 0
) {
    $report.Add(
        "KEEP - GIT DIRTY:"
    )

    foreach (
        $item
        in $keepDirty
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
    "Repository modified : NON"
)

$report.Add(
    "Audit only : OUI"
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
Write-Host "KLYX 13.48 DEEP AUDIT OK"
Write-Host "======================================"
Write-Host (
    "Candidates : " +
    $candidates.Count
)
Write-Host (
    "Keep runtime : " +
    $keepRuntime.Count
)
Write-Host (
    "Keep referenced : " +
    $keepReferenced.Count
)
Write-Host (
    "Keep dirty : " +
    $keepDirty.Count
)
Write-Host (
    "Archive review : " +
    $archiveReview.Count
)
Write-Host (
    "Missing tracked : " +
    $missingTracked.Count
)
Write-Host "Files moved : 0"
Write-Host "Files deleted : 0"
Write-Host "Repository modified : NON"
Write-Host "======================================"