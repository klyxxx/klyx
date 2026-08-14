$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$audit13_48 =
    Join-Path `
        $root `
        "reports\repository-tracked-unreferenced-audit-13-48.json"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-git-removal-plan-13-49.json"

$reportPath =
    Join-Path `
        $root `
        "reports\repository-git-removal-plan-13-49.txt"

$commandsPath =
    Join-Path `
        $root `
        "reports\repository-git-removal-commands-13-49.txt"

$diffRoot =
    Join-Path `
        $root `
        "reports\13-49-candidate-diffs"

# ============================================================
# INPUT
# ============================================================

if (
    -not (
        Test-Path `
            -LiteralPath `
            $audit13_48
    )
) {
    throw "13.49 : audit 13.48 introuvable."
}

$audit =
    Get-Content `
        -LiteralPath `
        $audit13_48 `
        -Raw |
    ConvertFrom-Json

if (
    $audit.AuditComplete -ne
    $true
) {
    throw "13.49 : audit 13.48 incomplet."
}

if (
    $audit.RepositoryModified -ne
    $false
) {
    throw "13.49 : 13.48 avait modifie le repository."
}

$candidates =
    @(
        $audit.ArchiveReviewFiles |
        ForEach-Object {
            [string]$_
        } |
        Where-Object {
            $_ -ne ""
        } |
        Sort-Object -Unique
    )

# ============================================================
# SNAPSHOT GIT STATE
# ============================================================

$statusBefore =
    @(
        git status --porcelain
    )

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.49 : git status FAILED."
}

$headBefore =
    (
        git rev-parse HEAD
    ).Trim()

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.49 : git rev-parse HEAD FAILED."
}

# ============================================================
# DIFF DIRECTORY
# ============================================================

if (
    Test-Path `
        -LiteralPath `
        $diffRoot
) {
    Remove-Item `
        -LiteralPath `
        $diffRoot `
        -Recurse `
        -Force
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $diffRoot |
    Out-Null

# ============================================================
# ANALYZE CANDIDATES
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

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $absolute `
                -PathType Leaf
        )
    ) {
        throw (
            "13.49 : candidat introuvable : " +
            $relative
        )
    }

    $trackedOutput =
        @(
            git ls-files --error-unmatch -- $relative 2>&1
        )

    $tracked =
        (
            $LASTEXITCODE -eq 0
        )

    if (
        -not $tracked
    ) {
        throw (
            "13.49 : candidat non suivi par Git : " +
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
            "13.49 : git diff FAILED : " +
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
            "13.49 : git diff --cached FAILED : " +
            $relative
        )
    }

    $dirty =
        (
            $worktreeDiff.Count -gt 0 -or
            $stagedDiff.Count -gt 0
        )

    $hash =
        (
            Get-FileHash `
                -LiteralPath `
                $absolute `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()

    $item =
        Get-Item `
            -LiteralPath `
            $absolute

    $safeName =
        $relative.Replace(
            "\",
            "__"
        ).Replace(
            "/",
            "__"
        ).Replace(
            ":",
            "_"
        )

    $diffPath =
        Join-Path `
            $diffRoot `
            (
                $safeName +
                ".diff.txt"
            )

    $diffLines =
        New-Object System.Collections.Generic.List[string]

    $diffLines.Add(
        "======================================"
    )

    $diffLines.Add(
        "KLYX 13.49 CANDIDATE DIFF"
    )

    $diffLines.Add(
        "======================================"
    )

    $diffLines.Add(
        "File : " +
        $relative
    )

    $diffLines.Add(
        "SHA256 : " +
        $hash
    )

    $diffLines.Add(
        "Git tracked : " +
        $tracked
    )

    $diffLines.Add(
        "Git dirty : " +
        $dirty
    )

    $diffLines.Add(
        ""
    )

    $diffLines.Add(
        "WORKTREE DIFF:"
    )

    if (
        $worktreeDiff.Count -eq 0
    ) {
        $diffLines.Add(
            "  NONE"
        )
    }

    foreach (
        $line
        in $worktreeDiff
    ) {
        $diffLines.Add(
            [string]$line
        )
    }

    $diffLines.Add(
        ""
    )

    $diffLines.Add(
        "STAGED DIFF:"
    )

    if (
        $stagedDiff.Count -eq 0
    ) {
        $diffLines.Add(
            "  NONE"
        )
    }

    foreach (
        $line
        in $stagedDiff
    ) {
        $diffLines.Add(
            [string]$line
        )
    }

    [System.IO.File]::WriteAllLines(
        $diffPath,
        $diffLines,
        $utf8
    )

    $classification =
        "eligible-removal-plan"

    $reason =
        "Tracked, clean and previously classified archive-review."

    if (
        $dirty
    ) {
        $classification =
            "blocked-dirty"

        $reason =
            "Local or staged changes detected."
    }

    $results +=
        [pscustomobject]@{
            RelativePath =
                $relative

            Exists =
                $true

            GitTracked =
                $tracked

            GitDirty =
                $dirty

            Length =
                $item.Length

            Sha256 =
                $hash

            WorktreeDiffLines =
                $worktreeDiff.Count

            StagedDiffLines =
                $stagedDiff.Count

            Classification =
                $classification

            Reason =
                $reason

            DiffReport =
                (
                    "reports\13-49-candidate-diffs\" +
                    [System.IO.Path]::GetFileName(
                        $diffPath
                    )
                )
        }
}

# ============================================================
# CLASSIFY
# ============================================================

$eligible =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "eligible-removal-plan"
        }
    )

$blocked =
    @(
        $results |
        Where-Object {
            $_.Classification -eq
            "blocked-dirty"
        }
    )

# ============================================================
# GENERATED COMMANDS - DO NOT EXECUTE
# ============================================================

$commands =
    New-Object System.Collections.Generic.List[string]

$commands.Add(
    "# ============================================================"
)

$commands.Add(
    "# KLYX 13.49 - GENERATED GIT REMOVAL PLAN"
)

$commands.Add(
    "# DO NOT EXECUTE AUTOMATICALLY"
)

$commands.Add(
    "# ============================================================"
)

$commands.Add(
    ""
)

$commands.Add(
    'Set-Location "C:\Users\fenjo\Documents\klyx"'
)

$commands.Add(
    ""
)

foreach (
    $item
    in $eligible
) {
    $escaped =
        $item.RelativePath.Replace(
            '"',
            '\"'
        )

    $commands.Add(
        (
            'git rm -- "' +
            $escaped +
            '"'
        )
    )
}

$commands.Add(
    ""
)

$commands.Add(
    "git status --short"
)

$commands.Add(
    "npm.cmd test"
)

$commands.Add(
    "npx.cmd tsc --noEmit --pretty false"
)

$commands.Add(
    "npm.cmd run build"
)

$commands.Add(
    ""
)

$commands.Add(
    "# END - GENERATED ONLY"
)

[System.IO.File]::WriteAllLines(
    $commandsPath,
    $commands,
    $utf8
)

# ============================================================
# VERIFY REPOSITORY UNCHANGED
# ============================================================

$statusAfter =
    @(
        git status --porcelain
    )

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.49 : final git status FAILED."
}

$headAfter =
    (
        git rev-parse HEAD
    ).Trim()

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.49 : final HEAD FAILED."
}

$statusBeforeJson =
    @(
        $statusBefore |
        Sort-Object
    ) |
    ConvertTo-Json -Compress

$statusAfterJson =
    @(
        $statusAfter |
        Sort-Object
    ) |
    ConvertTo-Json -Compress

$gitStatusUnchanged =
    (
        $statusBeforeJson -eq
        $statusAfterJson
    )

$headUnchanged =
    (
        $headBefore -eq
        $headAfter
    )

if (
    -not $gitStatusUnchanged
) {
    throw "13.49 : git status a change pendant audit."
}

if (
    -not $headUnchanged
) {
    throw "13.49 : HEAD a change pendant audit."
}

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.49"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        SourceAudit =
            "13.48"

        CandidateCount =
            $candidates.Count

        EligibleRemovalPlanCount =
            $eligible.Count

        BlockedDirtyCount =
            $blocked.Count

        Candidates =
            $results

        EligibleRemovalFiles =
            @(
                $eligible |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        BlockedDirtyFiles =
            @(
                $blocked |
                ForEach-Object {
                    $_.RelativePath
                }
            )

        GeneratedCommandsFile =
            "reports\repository-git-removal-commands-13-49.txt"

        GitStatusUnchanged =
            $gitStatusUnchanged

        HeadUnchanged =
            $headUnchanged

        GitRmExecuted =
            $false

        FilesMoved =
            0

        FilesDeleted =
            0

        SourceFilesModified =
            0

        RepositoryModified =
            $false

        PlanOnly =
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
    "KLYX 13.49 - GIT REMOVAL PLAN AUDIT"
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
    "Eligible removal-plan : " +
    $eligible.Count
)

$report.Add(
    "Blocked dirty : " +
    $blocked.Count
)

$report.Add(
    ""
)

if (
    $eligible.Count -gt 0
) {
    $report.Add(
        "ELIGIBLE FOR CONTROLLED REMOVAL:"
    )

    foreach (
        $item
        in $eligible
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
    $blocked.Count -gt 0
) {
    $report.Add(
        "BLOCKED - DIRTY:"
    )

    foreach (
        $item
        in $blocked
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
    "git rm executed : NON"
)

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
    "Git status unchanged : OUI"
)

$report.Add(
    "HEAD unchanged : OUI"
)

$report.Add(
    "Plan only : OUI"
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
Write-Host "KLYX 13.49 GIT REMOVAL PLAN OK"
Write-Host "======================================"
Write-Host (
    "Candidates : " +
    $candidates.Count
)
Write-Host (
    "Eligible removal-plan : " +
    $eligible.Count
)
Write-Host (
    "Blocked dirty : " +
    $blocked.Count
)
Write-Host "git rm executed : NON"
Write-Host "Files deleted : 0"
Write-Host "Repository modified : NON"
Write-Host "Git status : UNCHANGED"
Write-Host "HEAD : UNCHANGED"
Write-Host "======================================"