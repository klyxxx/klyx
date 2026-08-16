Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root =
    "C:\Users\fenjo\Documents\klyx"

Set-Location $Root

$ExpectedBranch =
    "agent/klyx-master-checkpoint-20260815"

$Branch =
    (
        git branch --show-current
    ).Trim()

if (
    $Branch -ne
    $ExpectedBranch
) {
    throw "Wrong Git branch: $Branch"
}

$Commit =
    (
        git rev-parse HEAD
    ).Trim()

# ------------------------------------------------------------
# OUTILS
# ------------------------------------------------------------

$Supabase =
    Get-Command `
        supabase `
        -ErrorAction SilentlyContinue

if (-not $Supabase) {
    throw "SUPABASE CLI MISSING. Stop here."
}

$Docker =
    Get-Command `
        docker `
        -ErrorAction SilentlyContinue

if (-not $Docker) {
    throw "DOCKER DESKTOP MISSING. Stop here."
}

$DockerVersion =
    @(
        docker version `
            --format "{{.Server.Version}}" `
            2>$null
    )

if (
    $LASTEXITCODE -ne 0 -or
    -not $DockerVersion
) {
    throw "Docker Desktop is installed but not running."
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
    throw "Supabase project is not linked."
}

# ------------------------------------------------------------
# PASSWORDS
# ------------------------------------------------------------

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

Write-Host ""
Write-Host "Supabase demande le MOT DE PASSE DATABASE."
Write-Host "Il ne sera pas affiché."

$SecureDbPassword =
    Read-Host `
        "Database password" `
        -AsSecureString

$DbPassword =
    ConvertFrom-KlyxSecureString `
        -Secure $SecureDbPassword

if (
    -not $DbPassword
) {
    throw "Database password missing."
}

Write-Host ""
Write-Host "Choisis maintenant une phrase secrète DR."
Write-Host "Minimum 16 caractères."
Write-Host "NE LA PERDS PAS : sans elle, le backup est inutilisable."

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

if (
    $Passphrase1 -ne
    $Passphrase2
) {
    throw "DR passphrases do not match."
}

if (
    $Passphrase1.Length -lt 16
) {
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
        (
            "dr-work\" +
            $Timestamp
        )

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

$PlainZip =
    Join-Path `
        $WorkRoot `
        (
            "klyx-dr-" +
            $Timestamp +
            "-" +
            $ShortCommit +
            ".zip"
        )

$EncryptedArchive =
    Join-Path `
        $ArchiveDirectory `
        (
            "klyx-dr-" +
            $Timestamp +
            "-" +
            $ShortCommit +
            ".klyxdr"
        )

$ChecksumPath =
    "$EncryptedArchive.sha256"

try {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX PHASE 8B - DR BACKUP"
    Write-Host "======================================"

    # --------------------------------------------------------
    # DATABASE
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- DATABASE ROLES -----"

    & $Supabase.Source `
        db dump `
        --linked `
        -p $DbPassword `
        -f (
            Join-Path `
                $DbDirectory `
                "roles.sql"
        ) `
        --role-only

    if ($LASTEXITCODE -ne 0) {
        throw "Roles backup FAILED."
    }

    Write-Host ""
    Write-Host "----- DATABASE SCHEMA -----"

    & $Supabase.Source `
        db dump `
        --linked `
        -p $DbPassword `
        -f (
            Join-Path `
                $DbDirectory `
                "schema.sql"
        )

    if ($LASTEXITCODE -ne 0) {
        throw "Schema backup FAILED."
    }

    Write-Host ""
    Write-Host "----- DATABASE DATA -----"

    & $Supabase.Source `
        db dump `
        --linked `
        -p $DbPassword `
        -f (
            Join-Path `
                $DbDirectory `
                "data.sql"
        ) `
        --data-only `
        --use-copy `
        -x "storage.buckets_vectors" `
        -x "storage.vector_indexes"

    if ($LASTEXITCODE -ne 0) {
        throw "Database data backup FAILED."
    }

    # --------------------------------------------------------
    # AUTH EXPLICIT SNAPSHOT
    #
    # On ne supposera pas que le dump principal
    # suffit : on vérifie auth séparément.
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- AUTH SCHEMA -----"

    & $Supabase.Source `
        db dump `
        --linked `
        -p $DbPassword `
        --schema auth `
        -f (
            Join-Path `
                $DbDirectory `
                "auth-schema.sql"
        )

    if ($LASTEXITCODE -ne 0) {
        throw "Auth schema backup FAILED."
    }

    Write-Host ""
    Write-Host "----- AUTH DATA -----"

    & $Supabase.Source `
        db dump `
        --linked `
        -p $DbPassword `
        --schema auth `
        --data-only `
        --use-copy `
        -f (
            Join-Path `
                $DbDirectory `
                "auth-data.sql"
        )

    if ($LASTEXITCODE -ne 0) {
        throw "Auth data backup FAILED."
    }

    # --------------------------------------------------------
    # MIGRATION HISTORY
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- MIGRATION HISTORY -----"

    & $Supabase.Source `
        db dump `
        --linked `
        -p $DbPassword `
        --schema supabase_migrations `
        -f (
            Join-Path `
                $DbDirectory `
                "migration-history-schema.sql"
        )

    if ($LASTEXITCODE -ne 0) {
        throw "Migration history schema FAILED."
    }

    & $Supabase.Source `
        db dump `
        --linked `
        -p $DbPassword `
        --schema supabase_migrations `
        --data-only `
        --use-copy `
        -f (
            Join-Path `
                $DbDirectory `
                "migration-history-data.sql"
        )

    if ($LASTEXITCODE -ne 0) {
        throw "Migration history data FAILED."
    }

    # --------------------------------------------------------
    # VERIFY DB FILES
    # --------------------------------------------------------

    $RequiredDbFiles =
        @(
            "roles.sql",
            "schema.sql",
            "data.sql",
            "auth-schema.sql",
            "auth-data.sql",
            "migration-history-schema.sql",
            "migration-history-data.sql"
        )

    foreach (
        $Name in
        $RequiredDbFiles
    ) {
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

        $Length =
            (
                Get-Item `
                    -LiteralPath $Path
            ).Length

        if (
            $Length -le 0
        ) {
            throw "Empty DB backup file: $Name"
        }
    }

    # --------------------------------------------------------
    # STORAGE + AUTH REFERENCE COUNT
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

    $FileManifest =
        @()

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

    $AuthDataPath =
        Join-Path `
            $DbDirectory `
            "auth-data.sql"

    $AuthText =
        Get-Content `
            -LiteralPath $AuthDataPath `
            -Raw

    $AuthUsersDetected =
        [regex]::IsMatch(
            $AuthText,
            '(?i)auth.*users'
        )

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
                ).ToUniversalTime().ToString(
                    "o"
                )

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

                    authUsersReferenceDetected =
                        $AuthUsersDetected

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
    # ZIP PLAINTEXT TEMPORAIRE
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
    # CHECKSUM ENCRYPTED ARCHIVE
    # --------------------------------------------------------

    $EncryptedHash =
        (
            Get-FileHash `
                -LiteralPath $EncryptedArchive `
                -Algorithm SHA256
        ).Hash.ToUpperInvariant()

    $EncryptedName =
        Split-Path `
            -Leaf `
            $EncryptedArchive

    "$EncryptedHash  $EncryptedName" |
        Set-Content `
            -LiteralPath $ChecksumPath `
            -Encoding ASCII

    $EncryptedSize =
        (
            Get-Item `
                -LiteralPath $EncryptedArchive
        ).Length

    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX PHASE 8B BACKUP COMPLETE"
    Write-Host "======================================"
    Write-Host "Database       : BACKED UP"
    Write-Host "Auth snapshot  : BACKED UP"
    Write-Host "Auth users     : $($State.authUserCount)"
    Write-Host "Storage buckets: $($State.storageBucketCount)"
    Write-Host "Storage objects: $($State.storageObjectCount)"
    Write-Host "Storage bytes  : $($State.storageBytes)"
    Write-Host "Encryption     : AES-256-GCM"
    Write-Host "Archive bytes  : $EncryptedSize"
    Write-Host "SHA256         : $EncryptedHash"
    Write-Host "Secrets stored : NO"
    Write-Host "Git committed  : NO"
    Write-Host "Restore tested : NO"
    Write-Host "======================================"
    Write-Host ""
    Write-Host "Archive : $EncryptedArchive"
    Write-Host "Checksum: $ChecksumPath"
}
finally {
    Remove-Item `
        Env:\KLYX_DR_PASSPHRASE `
        -ErrorAction SilentlyContinue

    $DbPassword =
        $null

    $Passphrase1 =
        $null

    $Passphrase2 =
        $null

    # Aucun SQL/plaintext ne doit rester après la fin.
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