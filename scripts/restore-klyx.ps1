param(
    [Parameter(Mandatory = $true)]
    [string]$ArchivePath,

    [Parameter(Mandatory = $true)]
    [string]$TargetDirectory,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot =
    (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$resolvedArchive =
    (Resolve-Path -LiteralPath $ArchivePath).Path

$targetPath =
    [System.IO.Path]::GetFullPath(
        $TargetDirectory
    )

$projectPath =
    [System.IO.Path]::GetFullPath(
        $ProjectRoot
    )

if (
    [System.StringComparer]::OrdinalIgnoreCase.Equals(
        $targetPath.TrimEnd(
            [System.IO.Path]::DirectorySeparatorChar
        ),
        $projectPath.TrimEnd(
            [System.IO.Path]::DirectorySeparatorChar
        )
    )
) {
    throw "Restore directly over the active KLYX project is forbidden."
}

$checkScript =
    Join-Path `
        $PSScriptRoot `
        "check-klyx-backup.ps1"

& $checkScript `
    -ArchivePath $resolvedArchive

if (
    Test-Path `
        -LiteralPath $targetPath
) {
    $existingContent =
        Get-ChildItem `
            -LiteralPath $targetPath `
            -Force `
            -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($existingContent -and -not $Force) {
        throw (
            "Restore target is not empty. " +
            "Use -Force only for an intentional test/restore."
        )
    }

    if ($Force) {
        Remove-Item `
            -LiteralPath $targetPath `
            -Recurse `
            -Force
    }
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $targetPath |
    Out-Null

Add-Type `
    -AssemblyName System.IO.Compression.FileSystem

$zip =
    [System.IO.Compression.ZipFile]::OpenRead(
        $resolvedArchive
    )

try {
    $targetPrefix =
        $targetPath.TrimEnd(
            [System.IO.Path]::DirectorySeparatorChar
        ) +
        [System.IO.Path]::DirectorySeparatorChar

    foreach ($entry in $zip.Entries) {
        if (-not $entry.FullName) {
            continue
        }

        $relativePath =
            $entry.FullName.Replace(
                "/",
                [System.IO.Path]::DirectorySeparatorChar
            )

        $destinationPath =
            [System.IO.Path]::GetFullPath(
                (
                    Join-Path `
                        $targetPath `
                        $relativePath
                )
            )

        if (
            -not $destinationPath.StartsWith(
                $targetPrefix,
                [System.StringComparison]::OrdinalIgnoreCase
            ) -and
            -not [System.StringComparer]::OrdinalIgnoreCase.Equals(
                $destinationPath,
                $targetPath
            )
        ) {
            throw "Unsafe archive path detected: $($entry.FullName)"
        }
    }
}
finally {
    $zip.Dispose()
}

[System.IO.Compression.ZipFile]::ExtractToDirectory(
    $resolvedArchive,
    $targetPath
)

$manifestPath =
    Join-Path `
        $targetPath `
        "KLYX_BACKUP_MANIFEST.json"

$packagePath =
    Join-Path `
        $targetPath `
        "package.json"

if (
    -not (
        Test-Path `
            -LiteralPath $manifestPath `
            -PathType Leaf
    )
) {
    throw "Restored manifest is missing."
}

if (
    -not (
        Test-Path `
            -LiteralPath $packagePath `
            -PathType Leaf
    )
) {
    throw "Restored package.json is missing."
}

$manifest =
    Get-Content `
        -LiteralPath $manifestPath `
        -Raw |
    ConvertFrom-Json

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX RESTORE COMPLETE"
Write-Host "======================================"
Write-Host "Target  : $targetPath"
Write-Host "Branch  : $($manifest.branch)"
Write-Host "Commit  : $($manifest.commit)"
Write-Host "Files   : $($manifest.fileCount)"
Write-Host "Manifest: PASS"
Write-Host "Package : PASS"
Write-Host "======================================"