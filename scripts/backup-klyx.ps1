param(
    [string]$OutputDirectory = "",
    [switch]$IncludeUntracked
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot =
    (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if (-not $OutputDirectory) {
    $OutputDirectory =
        Join-Path `
            $ProjectRoot `
            ".klyx-local-backup\archives"
}

$OutputDirectory =
    [System.IO.Path]::GetFullPath(
        $OutputDirectory
    )

New-Item `
    -ItemType Directory `
    -Force `
    -Path $OutputDirectory |
    Out-Null

$inside =
    (
        git -C $ProjectRoot `
            rev-parse `
            --is-inside-work-tree
    ).Trim()

if (
    $LASTEXITCODE -ne 0 -or
    $inside -ne "true"
) {
    throw "KLYX backup requires a valid Git repository."
}

$branch =
    (
        git -C $ProjectRoot `
            branch `
            --show-current
    ).Trim()

$commit =
    (
        git -C $ProjectRoot `
            rev-parse HEAD
    ).Trim()

if (
    $LASTEXITCODE -ne 0 -or
    -not $commit
) {
    throw "Unable to resolve current Git commit."
}

$shortCommit =
    $commit.Substring(
        0,
        [Math]::Min(
            8,
            $commit.Length
        )
    )

$gitFiles =
    @(
        git -C $ProjectRoot `
            ls-files
    )

if ($LASTEXITCODE -ne 0) {
    throw "git ls-files failed."
}

$requiredFoundationFiles =
    @(
        "package.json",
        "scripts/backup-klyx.ps1",
        "scripts/check-klyx-backup.ps1",
        "scripts/restore-klyx.ps1",
        ".github/workflows/klyx-backup.yml"
    )

$allFiles =
    @(
        $gitFiles +
        $requiredFoundationFiles
    )

if ($IncludeUntracked) {
    $untrackedFiles =
        @(
            git -C $ProjectRoot `
                ls-files `
                --others `
                --exclude-standard
        )

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to enumerate untracked files."
    }

    $allFiles +=
        $untrackedFiles
}

$allFiles =
    @(
        $allFiles |
        ForEach-Object {
            if ($_ -and $_.Trim()) {
                $_.Trim().Replace(
                    "\",
                    "/"
                )
            }
        } |
        Sort-Object -Unique
    )

$forbiddenPatterns =
    @(
        '(^|/)\.env($|\.)',
        '\.pem$',
        '\.p12$',
        '\.pfx$',
        '\.key$',
        '\.bak$',
        '(^|/)\.klyx-local-backup(/|$)',
        '^reports/master-audit(/|$)',
        '(^|/)node_modules(/|$)',
        '(^|/)\.next(/|$)',
        '(^|/)\.git(/|$)'
    )

function Test-KlyxForbiddenPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $normalized =
        $Path.Replace(
            "\",
            "/"
        )

    foreach ($pattern in $forbiddenPatterns) {
        if ($normalized -match $pattern) {
            return $true
        }
    }

    return $false
}

$includedFiles =
    @()

$excludedFiles =
    @()

foreach ($relativePath in $allFiles) {
    if (
        Test-KlyxForbiddenPath `
            -Path $relativePath
    ) {
        $excludedFiles +=
            $relativePath

        continue
    }

    $nativeRelative =
        $relativePath.Replace(
            "/",
            [System.IO.Path]::DirectorySeparatorChar
        )

    $sourcePath =
        Join-Path `
            $ProjectRoot `
            $nativeRelative

    if (
        Test-Path `
            -LiteralPath $sourcePath `
            -PathType Leaf
    ) {
        $includedFiles +=
            $relativePath
    }
}

foreach (
    $requiredFile
    in $requiredFoundationFiles
) {
    $normalizedRequired =
        $requiredFile.Replace(
            "\",
            "/"
        )

    if (
        $includedFiles -notcontains
        $normalizedRequired
    ) {
        throw (
            "Required source file unavailable for backup: " +
            $normalizedRequired
        )
    }
}

if ($includedFiles.Count -eq 0) {
    throw "No source files available for backup."
}

$tempRoot =
    Join-Path `
        ([System.IO.Path]::GetTempPath()) `
        (
            "klyx-backup-" +
            [Guid]::NewGuid().ToString("N")
        )

$payloadRoot =
    Join-Path `
        $tempRoot `
        "payload"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $payloadRoot |
    Out-Null

try {
    foreach ($relativePath in $includedFiles) {
        $nativeRelative =
            $relativePath.Replace(
                "/",
                [System.IO.Path]::DirectorySeparatorChar
            )

        $sourcePath =
            Join-Path `
                $ProjectRoot `
                $nativeRelative

        $destinationPath =
            Join-Path `
                $payloadRoot `
                $nativeRelative

        $destinationDirectory =
            Split-Path `
                -Parent `
                $destinationPath

        if ($destinationDirectory) {
            New-Item `
                -ItemType Directory `
                -Force `
                -Path $destinationDirectory |
                Out-Null
        }

        Copy-Item `
            -LiteralPath $sourcePath `
            -Destination $destinationPath `
            -Force
    }

    $manifest =
        [ordered]@{
            format = "KLYX_SOURCE_BACKUP"
            version = 2
            createdUtc = (
                Get-Date
            ).ToUniversalTime().ToString("o")
            branch = $branch
            commit = $commit
            fileCount = $includedFiles.Count
            includeUntracked = [bool]$IncludeUntracked
            excludedCount = $excludedFiles.Count
        }

    $manifestPath =
        Join-Path `
            $payloadRoot `
            "KLYX_BACKUP_MANIFEST.json"

    $manifest |
        ConvertTo-Json -Depth 5 |
        Set-Content `
            -LiteralPath $manifestPath `
            -Encoding UTF8

    $timestamp =
        Get-Date -Format "yyyyMMdd-HHmmss"

    $archiveName =
        "klyx-source-$timestamp-$shortCommit.zip"

    $archivePath =
        Join-Path `
            $OutputDirectory `
            $archiveName

    Add-Type `
        -AssemblyName `
        System.IO.Compression.FileSystem

    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $payloadRoot,
        $archivePath,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    if (
        -not (
            Test-Path `
                -LiteralPath $archivePath `
                -PathType Leaf
        )
    ) {
        throw "Backup archive was not created."
    }

    $hash =
        (
            Get-FileHash `
                -LiteralPath $archivePath `
                -Algorithm SHA256
        ).Hash.ToUpperInvariant()

    $checksumPath =
        "$archivePath.sha256"

    "$hash  $archiveName" |
        Set-Content `
            -LiteralPath $checksumPath `
            -Encoding ASCII

    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX BACKUP CREATED"
    Write-Host "======================================"
    Write-Host "Archive        : $archivePath"
    Write-Host "Checksum       : $checksumPath"
    Write-Host "Branch         : $branch"
    Write-Host "Commit         : $commit"
    Write-Host "Files          : $($includedFiles.Count)"
    Write-Host "Excluded       : $($excludedFiles.Count)"
    Write-Host "SHA256         : $hash"
    Write-Host "Secrets copied : NO"
    Write-Host "======================================"

    Write-Output $archivePath
}
finally {
    if (
        Test-Path `
            -LiteralPath $tempRoot
    ) {
        Remove-Item `
            -LiteralPath $tempRoot `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue
    }
}