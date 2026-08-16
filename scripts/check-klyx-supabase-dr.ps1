param(
    [string]$ArchivePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root =
    "C:\Users\fenjo\Documents\klyx"

Set-Location $Root

function ConvertFrom-KlyxSecureString {
    param(
        [Parameter(Mandatory = $true)]
        [Security.SecureString]$Secure
    )

    $Pointer =
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
            $Secure
        )

    try {
        return (
            [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
                $Pointer
            )
        )
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
            $Pointer
        )
    }
}

$ArchiveDirectory =
    Join-Path `
        $Root `
        ".klyx-local-backup\dr-archives"

if (-not $ArchivePath) {
    $Latest =
        Get-ChildItem `
            -LiteralPath $ArchiveDirectory `
            -Filter "*.klyxdr" `
            -File `
            -ErrorAction SilentlyContinue |
        Sort-Object `
            LastWriteTimeUtc `
            -Descending |
        Select-Object `
            -First 1

    if (-not $Latest) {
        throw "No encrypted KLYX DR archive found."
    }

    $ArchivePath =
        $Latest.FullName
}

$ArchivePath =
    (
        Resolve-Path `
            -LiteralPath $ArchivePath
    ).Path

$ChecksumPath =
    "$ArchivePath.sha256"

if (
    -not (
        Test-Path `
            -LiteralPath $ChecksumPath `
            -PathType Leaf
    )
) {
    throw "DR checksum file missing."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX PHASE 8C - DR INTEGRITY DRILL"
Write-Host "======================================"

# ------------------------------------------------------------
# CHECK ENCRYPTED ARCHIVE SHA256
# ------------------------------------------------------------

$ChecksumLine =
    (
        Get-Content `
            -LiteralPath $ChecksumPath `
            -Raw
    ).Trim()

if (
    $ChecksumLine -notmatch
    '^([A-Fa-f0-9]{64})\s+(.+)$'
) {
    throw "Invalid DR checksum format."
}

$ExpectedHash =
    $Matches[1].ToUpperInvariant()

$ActualHash =
    (
        Get-FileHash `
            -LiteralPath $ArchivePath `
            -Algorithm SHA256
    ).Hash.ToUpperInvariant()

if (
    $ExpectedHash -ne
    $ActualHash
) {
    throw "Encrypted DR archive SHA256 FAILED."
}

Write-Host "Encrypted SHA256 : PASS"

# ------------------------------------------------------------
# PASSPHRASE
# ------------------------------------------------------------

$SecurePassphrase =
    Read-Host `
        "DR passphrase" `
        -AsSecureString

$Passphrase =
    ConvertFrom-KlyxSecureString `
        -Secure $SecurePassphrase

if (
    -not $Passphrase -or
    $Passphrase.Length -lt 16
) {
    throw "Invalid DR passphrase."
}

# ------------------------------------------------------------
# TEMPORARY PLAINTEXT DIRECTORY
# ------------------------------------------------------------

$TempRoot =
    Join-Path `
        $env:TEMP `
        (
            "klyx-dr-check-" +
            [Guid]::NewGuid().ToString("N")
        )

$PlainZip =
    Join-Path `
        $TempRoot `
        "payload.zip"

$Extracted =
    Join-Path `
        $TempRoot `
        "extracted"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $TempRoot |
    Out-Null

try {
    # --------------------------------------------------------
    # DECRYPT
    # --------------------------------------------------------

    $env:KLYX_DR_PASSPHRASE =
        $Passphrase

    node `
        ".\scripts\decrypt-klyx-dr.mjs" `
        $ArchivePath `
        $PlainZip

    if ($LASTEXITCODE -ne 0) {
        throw "DR decryption FAILED."
    }

    Remove-Item `
        Env:\KLYX_DR_PASSPHRASE `
        -ErrorAction SilentlyContinue

    if (
        -not (
            Test-Path `
                -LiteralPath $PlainZip `
                -PathType Leaf
        )
    ) {
        throw "Decrypted ZIP missing."
    }

    Write-Host "Decryption       : PASS"

    # --------------------------------------------------------
    # ZIP VALIDITY
    # --------------------------------------------------------

    Add-Type `
        -AssemblyName `
        System.IO.Compression.FileSystem

    $Zip =
        [System.IO.Compression.ZipFile]::OpenRead(
            $PlainZip
        )

    try {
        if (
            $Zip.Entries.Count -eq 0
        ) {
            throw "DR ZIP contains no files."
        }

        foreach (
            $Entry in $Zip.Entries
        ) {
            if (-not $Entry.FullName) {
                continue
            }

            $Normalized =
                $Entry.FullName.Replace(
                    "\",
                    "/"
                )

            if (
                $Normalized.StartsWith("/") -or
                $Normalized.Contains("../") -or
                $Normalized.Contains("..\")
            ) {
                throw (
                    "Unsafe ZIP entry: " +
                    $Entry.FullName
                )
            }
        }
    }
    finally {
        $Zip.Dispose()
    }

    Write-Host "ZIP structure    : PASS"

    # --------------------------------------------------------
    # EXTRACT
    # --------------------------------------------------------

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $Extracted |
        Out-Null

    [System.IO.Compression.ZipFile]::ExtractToDirectory(
        $PlainZip,
        $Extracted
    )

    # --------------------------------------------------------
    # MANIFEST
    # --------------------------------------------------------

    $ManifestPath =
        Join-Path `
            $Extracted `
            "KLYX_DR_MANIFEST.json"

    if (
        -not (
            Test-Path `
                -LiteralPath $ManifestPath `
                -PathType Leaf
        )
    ) {
        throw "KLYX DR manifest missing."
    }

    $Manifest =
        Get-Content `
            -LiteralPath $ManifestPath `
            -Raw |
        ConvertFrom-Json

    if (
        $Manifest.format -ne
        "KLYX_SUPABASE_DR_BACKUP"
    ) {
        throw "Unexpected DR manifest format."
    }

    if (
        [int]$Manifest.version -ne 1
    ) {
        throw "Unsupported DR manifest version."
    }

    Write-Host "Manifest         : PASS"

    # --------------------------------------------------------
    # REQUIRED DATABASE FILES
    # --------------------------------------------------------

    $RequiredDbFiles =
        @(
            "database\roles.sql",
            "database\schema.sql",
            "database\data.sql",
            "database\auth-schema.sql",
            "database\auth-data.sql",
            "database\migration-history-schema.sql",
            "database\migration-history-data.sql"
        )

    foreach (
        $Relative in $RequiredDbFiles
    ) {
        $Path =
            Join-Path `
                $Extracted `
                $Relative

        if (
            -not (
                Test-Path `
                    -LiteralPath $Path `
                    -PathType Leaf
            )
        ) {
            throw (
                "Required DR database file missing: " +
                $Relative
            )
        }

        if (
            (
                Get-Item `
                    -LiteralPath $Path
            ).Length -le 0
        ) {
            throw (
                "Required DR database file empty: " +
                $Relative
            )
        }
    }

    Write-Host "Database files   : PASS"

    # --------------------------------------------------------
    # MANIFEST FILE HASHES
    # --------------------------------------------------------

    $HashCount =
        0

    foreach (
        $File in $Manifest.files
    ) {
        $Relative =
            [string]$File.path

        $Expected =
            ([string]$File.sha256).ToLowerInvariant()

        $Path =
            Join-Path `
                $Extracted `
                $Relative.Replace(
                    "/",
                    "\"
                )

        if (
            -not (
                Test-Path `
                    -LiteralPath $Path `
                    -PathType Leaf
            )
        ) {
            throw (
                "Manifest file missing: " +
                $Relative
            )
        }

        $Actual =
            (
                Get-FileHash `
                    -LiteralPath $Path `
                    -Algorithm SHA256
            ).Hash.ToLowerInvariant()

        if (
            $Expected -ne
            $Actual
        ) {
            throw (
                "Manifest SHA256 mismatch: " +
                $Relative
            )
        }

        $HashCount++
    }

    Write-Host "Payload hashes   : PASS ($HashCount)"

    # --------------------------------------------------------
    # STORAGE MANIFEST
    # --------------------------------------------------------

    $StorageManifestPath =
        Join-Path `
            $Extracted `
            "storage\storage-manifest.json"

    $StateManifestPath =
        Join-Path `
            $Extracted `
            "storage\state-manifest.json"

    if (
        -not (
            Test-Path `
                -LiteralPath $StorageManifestPath `
                -PathType Leaf
        )
    ) {
        throw "Storage manifest missing."
    }

    if (
        -not (
            Test-Path `
                -LiteralPath $StateManifestPath `
                -PathType Leaf
        )
    ) {
        throw "State manifest missing."
    }

    $StorageManifest =
        Get-Content `
            -LiteralPath $StorageManifestPath `
            -Raw |
        ConvertFrom-Json

    $State =
        Get-Content `
            -LiteralPath $StateManifestPath `
            -Raw |
        ConvertFrom-Json

    $StorageObjectCount =
        0

    foreach (
        $Bucket in $StorageManifest.buckets
    ) {
        foreach (
            $Object in $Bucket.objects
        ) {
            $ObjectFile =
                Join-Path `
                    $Extracted `
                    (
                        "storage\" +
                        (
                            [string]$Object.backupFile
                        ).Replace(
                            "/",
                            "\"
                        )
                    )

            if (
                -not (
                    Test-Path `
                        -LiteralPath $ObjectFile `
                        -PathType Leaf
                )
            ) {
                throw (
                    "Storage object backup missing: " +
                    [string]$Object.path
                )
            }

            $ExpectedObjectHash =
                (
                    [string]$Object.sha256
                ).ToLowerInvariant()

            $ActualObjectHash =
                (
                    Get-FileHash `
                        -LiteralPath $ObjectFile `
                        -Algorithm SHA256
                ).Hash.ToLowerInvariant()

            if (
                $ExpectedObjectHash -ne
                $ActualObjectHash
            ) {
                throw (
                    "Storage SHA256 mismatch: " +
                    [string]$Object.path
                )
            }

            $StorageObjectCount++
        }
    }

    if (
        $StorageObjectCount -ne
        [int]$State.storageObjectCount
    ) {
        throw (
            "Storage object count mismatch. Expected " +
            $State.storageObjectCount +
            ", verified " +
            $StorageObjectCount
        )
    }

    Write-Host "Storage hashes   : PASS ($StorageObjectCount)"

    # --------------------------------------------------------
    # AUTH EVIDENCE
    # --------------------------------------------------------

    $AuthDataPath =
        Join-Path `
            $Extracted `
            "database\auth-data.sql"

    $AuthLength =
        (
            Get-Item `
                -LiteralPath $AuthDataPath
        ).Length

    if ($AuthLength -le 0) {
        throw "Auth backup is empty."
    }

    Write-Host "Auth snapshot    : PASS"
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX PHASE 8C INTEGRITY COMPLETE"
    Write-Host "======================================"
    Write-Host "Encrypted SHA256 : PASS"
    Write-Host "AES-256-GCM      : PASS"
    Write-Host "ZIP              : PASS"
    Write-Host "Manifest         : PASS"
    Write-Host "Database files   : PASS"
    Write-Host "Auth snapshot    : PASS"
    Write-Host "Storage objects  : $StorageObjectCount"
    Write-Host "Storage integrity: PASS"
    Write-Host "Plaintext kept   : NO"
    Write-Host "Production write : NO"
    Write-Host "Restore tested   : NO"
    Write-Host "======================================"
}
finally {
    Remove-Item `
        Env:\KLYX_DR_PASSPHRASE `
        -ErrorAction SilentlyContinue

    $Passphrase =
        $null

    if (
        Test-Path `
            -LiteralPath $TempRoot
    ) {
        Remove-Item `
            -LiteralPath $TempRoot `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue
    }
}