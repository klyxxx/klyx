param(
    [Parameter(Mandatory = $true)]
    [string]$ArchivePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedArchive =
    (Resolve-Path -LiteralPath $ArchivePath).Path

$checksumPath =
    "$resolvedArchive.sha256"

if (
    -not (
        Test-Path `
            -LiteralPath $checksumPath `
            -PathType Leaf
    )
) {
    throw "Backup SHA256 file is missing."
}

$checksumText =
    (
        Get-Content `
            -LiteralPath $checksumPath `
            -Raw
    ).Trim()

$expectedHash =
    (
        $checksumText -split '\s+'
    )[0].ToUpperInvariant()

$actualHash =
    (
        Get-FileHash `
            -LiteralPath $resolvedArchive `
            -Algorithm SHA256
    ).Hash.ToUpperInvariant()

if ($expectedHash -ne $actualHash) {
    throw "Backup checksum mismatch."
}

Add-Type `
    -AssemblyName `
    System.IO.Compression.FileSystem

$zip =
    [System.IO.Compression.ZipFile]::OpenRead(
        $resolvedArchive
    )

try {
    $entries =
        @(
            $zip.Entries
        )

    $entryNames =
        @(
            $entries |
            ForEach-Object {
                $_.FullName.Replace(
                    "\",
                    "/"
                ).TrimStart("/")
            }
        )

    $manifestIndex =
        [Array]::IndexOf(
            $entryNames,
            "KLYX_BACKUP_MANIFEST.json"
        )

    if ($manifestIndex -lt 0) {
        throw "Backup manifest is missing."
    }

    $manifestEntry =
        $entries[$manifestIndex]

    $stream =
        $manifestEntry.Open()

    $reader =
        [System.IO.StreamReader]::new(
            $stream
        )

    try {
        $manifestJson =
            $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
        $stream.Dispose()
    }

    $manifest =
        $manifestJson |
        ConvertFrom-Json

    if (
        $manifest.format -ne
        "KLYX_SOURCE_BACKUP"
    ) {
        throw "Invalid KLYX backup format."
    }

    if (
        [int]$manifest.version -lt 1 -or
        [int]$manifest.version -gt 2
    ) {
        throw "Unsupported KLYX backup version."
    }

    $requiredFiles =
        @(
            "package.json",
            "scripts/backup-klyx.ps1",
            "scripts/check-klyx-backup.ps1",
            "scripts/restore-klyx.ps1",
            ".github/workflows/klyx-backup.yml"
        )

    foreach ($requiredFile in $requiredFiles) {
        if (
            $entryNames -notcontains
            $requiredFile
        ) {
            throw (
                "Required backup file missing: " +
                $requiredFile
            )
        }
    }

    $forbiddenEntries =
        @(
            $entryNames |
            Where-Object {
                $_ -match '(^|/)\.env($|\.)' -or
                $_ -match '\.pem$' -or
                $_ -match '\.p12$' -or
                $_ -match '\.pfx$' -or
                $_ -match '\.key$' -or
                $_ -match '\.bak$' -or
                $_ -match '(^|/)\.git(/|$)' -or
                $_ -match '(^|/)node_modules(/|$)' -or
                $_ -match '(^|/)\.next(/|$)'
            }
        )

    if ($forbiddenEntries.Count -gt 0) {
        foreach ($entry in $forbiddenEntries) {
            Write-Host "FORBIDDEN -> $entry"
        }

        throw "Backup contains forbidden files."
    }

    $payloadFiles =
        @(
            $entries |
            Where-Object {
                $_.Name -and
                $_.FullName.Replace(
                    "\",
                    "/"
                ).TrimStart("/") -ne
                "KLYX_BACKUP_MANIFEST.json"
            }
        )

    if (
        $payloadFiles.Count -ne
        [int]$manifest.fileCount
    ) {
        throw (
            "Backup file count mismatch. Manifest=" +
            $manifest.fileCount +
            " Archive=" +
            $payloadFiles.Count
        )
    }

    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX BACKUP CHECK PASS"
    Write-Host "======================================"
    Write-Host "Format          : $($manifest.format)"
    Write-Host "Version         : $($manifest.version)"
    Write-Host "Branch          : $($manifest.branch)"
    Write-Host "Commit          : $($manifest.commit)"
    Write-Host "Files           : $($manifest.fileCount)"
    Write-Host "SHA256          : PASS"
    Write-Host "Required files  : PASS"
    Write-Host "Forbidden files : 0"
    Write-Host "======================================"
}
finally {
    $zip.Dispose()
}