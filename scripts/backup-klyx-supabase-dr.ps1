param(
    [string]$OffsiteDirectory = "C:\Users\fenjo\OneDrive\KLYX-DR",
    [int]$RetentionDays = 30,
    [int]$MinimumCopies = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\Users\fenjo\Documents\klyx"

Set-Location $Root

# KLYX_DR_OFFSITE_PHASE_11C_2

$AllowedBranches = @(
    "main",
    "agent/klyx-dr-offsite-20260816"
)

$Branch = (
    git branch --show-current
).Trim()

if ($AllowedBranches -notcontains $Branch) {
    throw "Wrong Git branch: $Branch"
}

$Commit = (
    git rev-parse HEAD
).Trim()

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

function Invoke-KlyxSupabase {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    & $script:SupabaseExecutable @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$Label FAILED."
    }
}

# ------------------------------------------------------------
# TOOLS
# ------------------------------------------------------------

$SupabaseCommand =
    Get-Command `
        supabase `
        -ErrorAction SilentlyContinue

if ($SupabaseCommand) {
    $SupabaseExecutable =
        $SupabaseCommand.Source
}
else {
    $LocalSupabase =
        Join-Path `
            $Root `
            "node_modules\.bin\supabase.cmd"

    if (
        -not (
            Test-Path `
                -LiteralPath $LocalSupabase `
                -PathType Leaf
        )
    ) {
        throw "SUPABASE CLI MISSING."
    }

    $SupabaseExecutable =
        $LocalSupabase
}

$Docker =
    Get-Command `
        docker `
        -ErrorAction SilentlyContinue

if (-not $Docker) {
    throw "DOCKER DESKTOP MISSING."
}

$DockerVersion = @(
    docker version `
        --format "{{.Server.Version}}" `
        2>$null
)

if (
    $LASTEXITCODE -ne 0 -or
    -not $DockerVersion
) {
    throw "Docker Desktop is not running."
}

$ProjectRefFile =
    Join-Path `
        $Root `
        "supabase\.temp\project-ref"

if (
    -not (
        Test-Path `
            -LiteralPath $ProjectRefFile `
            -PathType Leaf
    )
) {
    throw "Supabase project is not linked locally."
}

# ------------------------------------------------------------
# OFFSITE
# ------------------------------------------------------------

$OneDriveRoot =
    "C:\Users\fenjo\OneDrive"

if (
    -not (
        Test-Path `
            -LiteralPath $OneDriveRoot `
            -PathType Container
    )
) {
    throw "OneDrive directory missing."
}

$OneDriveProcess =
    Get-Process `
        OneDrive `
        -ErrorAction SilentlyContinue

if (-not $OneDriveProcess) {
    throw "OneDrive client is not running."
}

$OffsiteDirectory =
    [System.IO.Path]::GetFullPath(
        $OffsiteDirectory
    )

if (
    -not $OffsiteDirectory.StartsWith(
        $OneDriveRoot,
        [System.StringComparison]::OrdinalIgnoreCase
    )
) {
    throw "Offsite directory must be inside OneDrive."
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $OffsiteDirectory |
Out-Null

if ($RetentionDays -lt 1) {
    throw "RetentionDays must be at least 1."
}

if ($MinimumCopies -lt 1) {
    throw "MinimumCopies must be at least 1."
}

# ------------------------------------------------------------
# PASSWORDS
# ------------------------------------------------------------

Write-Host ""
Write-Host "Database password Supabase."
Write-Host "Il ne sera ni affiché ni passé dans la ligne de commande."

$SecureDbPassword =
    Read-Host `
        "Database password" `
        -AsSecureString

$DbPassword =
    ConvertFrom-KlyxSecureString `
        -Secure $SecureDbPassword

if (-not $DbPassword) {
    throw "Database password missing."
}

Write-Host ""
Write-Host "Phrase secrète DR."
Write-Host "Minimum 16 caractères."
Write-Host "NE LA PERDS PAS."

$SecurePassphrase1 =
    Read-Host `
        "DR passphrase" `
        -AsSecureString

$SecurePassphrase2 =
    Read-Host `
        "Repeat DR passphrase" `
        -AsSecureString

$Passphrase1 =
    ConvertFrom-KlyxSecureString `
        -Secure $SecurePassphrase1

$Passphrase2 =
    ConvertFrom-KlyxSecureString `
        -Secure $SecurePassphrase2

if ($Passphrase1 -ne $Passphrase2) {
    throw "DR passphrases do not match."
}

if ($Passphrase1.Length -lt 16) {
    throw "DR passphrase too short."
}

# ------------------------------------------------------------
# PATHS
# ------------------------------------------------------------

$Timestamp =
    Get-Date `
        -Format "yyyyMMdd-HHmmss"

$ShortCommit =
    $Commit.Substring(
        0,
        8
    )

$BackupRoot =
    Join-Path `
        $Root `
        ".klyx-local-backup"

$WorkRoot =
    Join-Path `
        $BackupRoot `
        "dr-work\$Timestamp"

$Payload =
    Join-Path `
        $WorkRoot `
        "payload"

$DbDirectory =
    Join-Path `
        $Payload `
        "database"

$StorageDirectory =
    Join-Path `
        $Payload `
        "storage"

$ArchiveDirectory =
    Join-Path `
        $BackupRoot `
        "dr-archives"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $DbDirectory |
Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $StorageDirectory |
Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $ArchiveDirectory |
Out-Null

$ArchiveName =
    "klyx-dr-$Timestamp-$ShortCommit.klyxdr"

$PlainZip =
    Join-Path `
        $WorkRoot `
        "payload.zip"

$EncryptedArchive =
    Join-Path `
        $ArchiveDirectory `
        $ArchiveName

$ChecksumPath =
    "$EncryptedArchive.sha256"

$OffsiteArchive =
    Join-Path `
        $OffsiteDirectory `
        $ArchiveName

$OffsiteChecksum =
    "$OffsiteArchive.sha256"

try {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX PHASE 11C.2 - SUPABASE DR"
    Write-Host "======================================"

    # --------------------------------------------------------
    # DATABASE PASSWORD VIA ENVIRONMENT
    # --------------------------------------------------------

    $env:SUPABASE_DB_PASSWORD =
        $DbPassword

    $DbPassword =
        $null

    Write-Host ""
    Write-Host "Database password transport : ENVIRONMENT"

    # --------------------------------------------------------
    # DATABASE
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- DATABASE ROLES -----"

    Invoke-KlyxSupabase `
        -Label "Roles backup" `
        -Arguments @(
            "db",
            "dump",
            "--linked",
            "-f",
            (
                Join-Path `
                    $DbDirectory `
                    "roles.sql"
            ),
            "--role-only"
        )

    Write-Host ""
    Write-Host "----- DATABASE SCHEMA -----"

    Invoke-KlyxSupabase `
        -Label "Schema backup" `
        -Arguments @(
            "db",
            "dump",
            "--linked",
            "-f",
            (
                Join-Path `
                    $DbDirectory `
                    "schema.sql"
            )
        )

    Write-Host ""
    Write-Host "----- DATABASE DATA -----"

    Invoke-KlyxSupabase `
        -Label "Database data backup" `
        -Arguments @(
            "db",
            "dump",
            "--linked",
            "-f",
            (
                Join-Path `
                    $DbDirectory `
                    "data.sql"
            ),
            "--data-only",
            "--use-copy",
            "-x",
            "storage.buckets_vectors",
            "-x",
            "storage.vector_indexes"
        )

    # --------------------------------------------------------
    # AUTH
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- AUTH SCHEMA -----"

    Invoke-KlyxSupabase `
        -Label "Auth schema backup" `
        -Arguments @(
            "db",
            "dump",
            "--linked",
            "--schema",
            "auth",
            "-f",
            (
                Join-Path `
                    $DbDirectory `
                    "auth-schema.sql"
            )
        )

    Write-Host ""
    Write-Host "----- AUTH DATA -----"

    Invoke-KlyxSupabase `
        -Label "Auth data backup" `
        -Arguments @(
            "db",
            "dump",
            "--linked",
            "--schema",
            "auth",
            "--data-only",
            "--use-copy",
            "-f",
            (
                Join-Path `
                    $DbDirectory `
                    "auth-data.sql"
            )
        )

    # --------------------------------------------------------
    # MIGRATION HISTORY
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- MIGRATION HISTORY -----"

    Invoke-KlyxSupabase `
        -Label "Migration history schema" `
        -Arguments @(
            "db",
            "dump",
            "--linked",
            "--schema",
            "supabase_migrations",
            "-f",
            (
                Join-Path `
                    $DbDirectory `
                    "migration-history-schema.sql"
            )
        )

    Invoke-KlyxSupabase `
        -Label "Migration history data" `
        -Arguments @(
            "db",
            "dump",
            "--linked",
            "--schema",
            "supabase_migrations",
            "--data-only",
            "--use-copy",
            "-f",
            (
                Join-Path `
                    $DbDirectory `
                    "migration-history-data.sql"
            )
        )

    Remove-Item `
        Env:\SUPABASE_DB_PASSWORD `
        -ErrorAction SilentlyContinue

    # --------------------------------------------------------
    # DATABASE FILE VERIFICATION
    # --------------------------------------------------------

    $RequiredDbFiles = @(
        "roles.sql",
        "schema.sql",
        "data.sql",
        "auth-schema.sql",
        "auth-data.sql",
        "migration-history-schema.sql",
        "migration-history-data.sql"
    )

    foreach ($Name in $RequiredDbFiles) {
        $Path =
            Join-Path `
                $DbDirectory `
                $Name

        if (
            -not (
                Test-Path `
                    -LiteralPath $Path `
                    -PathType Leaf
            )
        ) {
            throw "Missing DB backup file: $Name"
        }

        if (
            (
                Get-Item `
                    -LiteralPath $Path
            ).Length -le 0
        ) {
            throw "Empty DB backup file: $Name"
        }
    }

    Write-Host "Database files : PASS"

    # --------------------------------------------------------
    # STORAGE
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- STORAGE OBJECTS -----"

    node `
        ".\scripts\backup-klyx-storage.mjs" `
        $StorageDirectory

    if ($LASTEXITCODE -ne 0) {
        throw "Storage backup FAILED."
    }

    # --------------------------------------------------------
    # MANIFEST
    # --------------------------------------------------------

    $FileManifest = @()

    foreach (
        $File in
        Get-ChildItem `
            -LiteralPath $Payload `
            -File `
            -Recurse
    ) {
        $Relative =
            $File.FullName.Substring(
                $Payload.Length
            ).TrimStart(
                "\",
                "/"
            ).Replace(
                "\",
                "/"
            )

        $Hash =
            (
                Get-FileHash `
                    -LiteralPath $File.FullName `
                    -Algorithm SHA256
            ).Hash.ToLowerInvariant()

        $FileManifest +=
            [ordered]@{
                path =
                    $Relative

                size =
                    $File.Length

                sha256 =
                    $Hash
            }
    }

    $StatePath =
        Join-Path `
            $StorageDirectory `
            "state-manifest.json"

    $State =
        Get-Content `
            -LiteralPath $StatePath `
            -Raw |
        ConvertFrom-Json

    $Manifest =
        [ordered]@{
            format =
                "KLYX_SUPABASE_DR_BACKUP"

            version =
                1

            createdUtc =
                (
                    Get-Date
                ).ToUniversalTime().ToString("o")

            git =
                [ordered]@{
                    branch =
                        $Branch

                    commit =
                        $Commit
                }

            database =
                [ordered]@{
                    roles =
                        $true

                    schema =
                        $true

                    data =
                        $true

                    migrationHistory =
                        $true
                }

            auth =
                [ordered]@{
                    explicitSchemaDump =
                        $true

                    explicitDataDump =
                        $true

                    expectedUserCount =
                        $State.authUserCount
                }

            storage =
                [ordered]@{
                    bucketCount =
                        $State.storageBucketCount

                    objectCount =
                        $State.storageObjectCount

                    bytes =
                        $State.storageBytes
                }

            encryption =
                [ordered]@{
                    algorithm =
                        "AES-256-GCM"

                    keyDerivation =
                        "scrypt"

                    passphraseStored =
                        $false
                }

            disasterRecoveryPolicy =
                [ordered]@{
                    rpoTargetHours =
                        24

                    retentionDays =
                        $RetentionDays

                    minimumCopies =
                        $MinimumCopies

                    offsiteProvider =
                        "OneDrive"
                }

            files =
                $FileManifest

            restoreTested =
                $false
        }

    $ManifestPath =
        Join-Path `
            $Payload `
            "KLYX_DR_MANIFEST.json"

    $Manifest |
        ConvertTo-Json `
            -Depth 10 |
        Set-Content `
            -LiteralPath $ManifestPath `
            -Encoding UTF8

    # --------------------------------------------------------
    # PACK
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- PACK -----"

    Compress-Archive `
        -Path (
            Join-Path `
                $Payload `
                "*"
        ) `
        -DestinationPath $PlainZip `
        -CompressionLevel Optimal

    if (
        -not (
            Test-Path `
                -LiteralPath $PlainZip `
                -PathType Leaf
        )
    ) {
        throw "Temporary DR ZIP FAILED."
    }

    # --------------------------------------------------------
    # ENCRYPT
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- ENCRYPT -----"

    $env:KLYX_DR_PASSPHRASE =
        $Passphrase1

    node `
        ".\scripts\encrypt-klyx-dr.mjs" `
        $PlainZip `
        $EncryptedArchive

    if ($LASTEXITCODE -ne 0) {
        throw "DR encryption FAILED."
    }

    Remove-Item `
        Env:\KLYX_DR_PASSPHRASE `
        -ErrorAction SilentlyContinue

    # --------------------------------------------------------
    # LOCAL HASH
    # --------------------------------------------------------

    $EncryptedHash =
        (
            Get-FileHash `
                -LiteralPath $EncryptedArchive `
                -Algorithm SHA256
        ).Hash.ToUpperInvariant()

    "$EncryptedHash  $ArchiveName" |
        Set-Content `
            -LiteralPath $ChecksumPath `
            -Encoding ASCII

    # --------------------------------------------------------
    # OFFSITE COPY
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- ONEDRIVE OFFSITE COPY -----"

    Copy-Item `
        -LiteralPath $EncryptedArchive `
        -Destination $OffsiteArchive `
        -Force

    Copy-Item `
        -LiteralPath $ChecksumPath `
        -Destination $OffsiteChecksum `
        -Force

    if (
        -not (
            Test-Path `
                -LiteralPath $OffsiteArchive `
                -PathType Leaf
        )
    ) {
        throw "Offsite archive missing after copy."
    }

    if (
        -not (
            Test-Path `
                -LiteralPath $OffsiteChecksum `
                -PathType Leaf
        )
    ) {
        throw "Offsite checksum missing after copy."
    }

    $OffsiteHash =
        (
            Get-FileHash `
                -LiteralPath $OffsiteArchive `
                -Algorithm SHA256
        ).Hash.ToUpperInvariant()

    if ($EncryptedHash -ne $OffsiteHash) {
        throw "Offsite SHA256 verification FAILED."
    }

    Write-Host "Offsite SHA256 : PASS"

    # --------------------------------------------------------
    # RETENTION
    # Keep at least MinimumCopies even if they are old.
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- OFFSITE RETENTION -----"

    $Cutoff =
        (
            Get-Date
        ).ToUniversalTime().AddDays(
            -$RetentionDays
        )

    $OffsiteArchives = @(
        Get-ChildItem `
            -LiteralPath $OffsiteDirectory `
            -Filter "klyx-dr-*.klyxdr" `
            -File `
            -ErrorAction SilentlyContinue |
        Sort-Object `
            LastWriteTimeUtc `
            -Descending
    )

    for (
        $Index = $MinimumCopies;
        $Index -lt $OffsiteArchives.Count;
        $Index++
    ) {
        $OldArchive =
            $OffsiteArchives[$Index]

        if (
            $OldArchive.LastWriteTimeUtc -lt
            $Cutoff
        ) {
            $OldChecksum =
                "$($OldArchive.FullName).sha256"

            Remove-Item `
                -LiteralPath $OldArchive.FullName `
                -Force

            if (
                Test-Path `
                    -LiteralPath $OldChecksum `
                    -PathType Leaf
            ) {
                Remove-Item `
                    -LiteralPath $OldChecksum `
                    -Force
            }
        }
    }

    $RetainedCount =
        @(
            Get-ChildItem `
                -LiteralPath $OffsiteDirectory `
                -Filter "klyx-dr-*.klyxdr" `
                -File `
                -ErrorAction SilentlyContinue
        ).Count

    $EncryptedSize =
        (
            Get-Item `
                -LiteralPath $EncryptedArchive
        ).Length

    # --------------------------------------------------------
    # RESULT
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX PHASE 11C.2 DR BACKUP COMPLETE"
    Write-Host "======================================"
    Write-Host "Database           : BACKED UP"
    Write-Host "Auth snapshot      : BACKED UP"
    Write-Host "Auth users         : $($State.authUserCount)"
    Write-Host "Storage buckets    : $($State.storageBucketCount)"
    Write-Host "Storage objects    : $($State.storageObjectCount)"
    Write-Host "Storage bytes      : $($State.storageBytes)"
    Write-Host "Encryption         : AES-256-GCM"
    Write-Host "DB password argv   : NO"
    Write-Host "Secrets committed  : NO"
    Write-Host "Plaintext retained : NO"
    Write-Host "Archive bytes      : $EncryptedSize"
    Write-Host "Local SHA256       : PASS"
    Write-Host "Offsite copy       : PASS"
    Write-Host "Offsite SHA256     : PASS"
    Write-Host "OneDrive client    : RUNNING"
    Write-Host "Retention          : $RetentionDays days"
    Write-Host "Minimum copies     : $MinimumCopies"
    Write-Host "Retained archives  : $RetainedCount"
    Write-Host "RPO target         : 24 hours"
    Write-Host "Cloud remote check : PENDING"
    Write-Host "======================================"
    Write-Host ""
    Write-Host "Local archive : $EncryptedArchive"
    Write-Host "Offsite       : $OffsiteArchive"
}
finally {
    Remove-Item `
        Env:\SUPABASE_DB_PASSWORD `
        -ErrorAction SilentlyContinue

    Remove-Item `
        Env:\KLYX_DR_PASSPHRASE `
        -ErrorAction SilentlyContinue

    $DbPassword =
        $null

    $Passphrase1 =
        $null

    $Passphrase2 =
        $null

    if (
        Test-Path `
            -LiteralPath $WorkRoot
    ) {
        Remove-Item `
            -LiteralPath $WorkRoot `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue
    }
}