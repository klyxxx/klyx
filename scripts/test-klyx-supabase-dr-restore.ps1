param(
    [string]$ArchivePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root =
    "C:\Users\fenjo\Documents\klyx"

Set-Location $Root

$SupabaseCmd =
    Join-Path `
        $Root `
        "node_modules\.bin\supabase.cmd"

if (
    -not (
        Test-Path `
            -LiteralPath $SupabaseCmd `
            -PathType Leaf
    )
) {
    throw "Local Supabase CLI missing."
}

docker info *> $null

if (
    $LASTEXITCODE -ne 0
) {
    throw "Docker Engine is not running."
}

# ------------------------------------------------------------
# SAFETY:
# refuse de toucher à une autre instance locale Supabase.
# ------------------------------------------------------------

$ExistingSupabase =
    @(
        docker ps `
            --format "{{.Names}}" |
        Where-Object {
            $_ -like "supabase_*"
        }
    )

if (
    $ExistingSupabase.Count -gt 0
) {
    Write-Host ""
    Write-Host "Existing Supabase containers:"
    $ExistingSupabase |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw (
        "Another local Supabase stack is running. " +
        "8D refuses to stop or modify it."
    )
}

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

# ------------------------------------------------------------
# ARCHIVE
# ------------------------------------------------------------

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
        throw "No KLYX DR archive found."
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
    throw "DR archive checksum missing."
}

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
    throw "Invalid DR checksum."
}

$ExpectedEncryptedHash =
    $Matches[1].ToUpperInvariant()

$ActualEncryptedHash =
    (
        Get-FileHash `
            -LiteralPath $ArchivePath `
            -Algorithm SHA256
    ).Hash.ToUpperInvariant()

if (
    $ExpectedEncryptedHash -ne
    $ActualEncryptedHash
) {
    throw "Encrypted archive SHA256 FAILED."
}

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
# ISOLATED WORKSPACE
# ------------------------------------------------------------

$RunId =
    (
        Get-Date `
            -Format "yyyyMMdd-HHmmss"
    ) +
    "-" +
    [Guid]::NewGuid().ToString(
        "N"
    ).Substring(
        0,
        8
    )

$WorkRoot =
    Join-Path `
        $Root `
        (
            ".klyx-local-backup\" +
            "dr-restore-work\" +
            $RunId
        )

$Extracted =
    Join-Path `
        $WorkRoot `
        "backup"

$PlainZip =
    Join-Path `
        $WorkRoot `
        "backup.zip"

$LabRoot =
    Join-Path `
        $WorkRoot `
        "isolated-supabase"

$ReportDirectory =
    Join-Path `
        $Root `
        ".klyx-local-backup\dr-restore-reports"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $WorkRoot |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $Extracted |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $LabRoot |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $ReportDirectory |
    Out-Null

$ReportPath =
    Join-Path `
        $ReportDirectory `
        (
            "KLYX_DR_RESTORE_" +
            $RunId +
            ".json"
        )

$RestoreSucceeded =
    $false

$ExpectedState =
    $null

try {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX PHASE 8D - ISOLATED DR RESTORE"
    Write-Host "======================================"
    Write-Host "Encrypted archive : PASS"
    Write-Host "Production target : NO"
    Write-Host "Linked commands   : NO"
    Write-Host ""

    # --------------------------------------------------------
    # DECRYPT
    # --------------------------------------------------------

    $env:KLYX_DR_PASSPHRASE =
        $Passphrase

    node `
        ".\scripts\decrypt-klyx-dr.mjs" `
        $ArchivePath `
        $PlainZip

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "DR decryption FAILED."
    }

    Remove-Item `
        Env:\KLYX_DR_PASSPHRASE `
        -ErrorAction SilentlyContinue

    Write-Host "Decryption         : PASS"

    # --------------------------------------------------------
    # EXTRACT
    # --------------------------------------------------------

    Add-Type `
        -AssemblyName `
        System.IO.Compression.FileSystem

    [System.IO.Compression.ZipFile]::ExtractToDirectory(
        $PlainZip,
        $Extracted
    )

    Remove-Item `
        -LiteralPath $PlainZip `
        -Force

    $DbRoot =
        Join-Path `
            $Extracted `
            "database"

    $StorageRoot =
        Join-Path `
            $Extracted `
            "storage"

    $StatePath =
        Join-Path `
            $StorageRoot `
            "state-manifest.json"

    if (
        -not (
            Test-Path `
                -LiteralPath $StatePath `
                -PathType Leaf
        )
    ) {
        throw "DR state manifest missing."
    }

    $ExpectedState =
        Get-Content `
            -LiteralPath $StatePath `
            -Raw |
        ConvertFrom-Json

    $RequiredDatabaseFiles =
        @(
            "roles.sql",
            "schema.sql",
            "data.sql",
            "auth-data.sql",
            "migration-history-schema.sql",
            "migration-history-data.sql"
        )

    foreach (
        $FileName in
        $RequiredDatabaseFiles
    ) {
        $FilePath =
            Join-Path `
                $DbRoot `
                $FileName

        if (
            -not (
                Test-Path `
                    -LiteralPath $FilePath `
                    -PathType Leaf
            )
        ) {
            throw (
                "Required DR file missing: " +
                $FileName
            )
        }
    }

    Write-Host "Backup extraction  : PASS"

    # --------------------------------------------------------
    # CREATE COMPLETELY NEW LOCAL SUPABASE PROJECT
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- CREATE ISOLATED SUPABASE -----"

    & $SupabaseCmd `
        --workdir $LabRoot `
        init `
        --force

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Isolated Supabase init FAILED."
    }

    $LinkedRef =
        Join-Path `
            $LabRoot `
            "supabase\.temp\project-ref"

    if (
        Test-Path `
            -LiteralPath $LinkedRef
    ) {
        throw (
            "SAFETY FAILURE: isolated restore lab " +
            "must never be linked to a remote project."
        )
    }

    # --------------------------------------------------------
    # START ONLY LOCAL POSTGRES
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- START ISOLATED POSTGRES -----"

    & $SupabaseCmd `
        --workdir $LabRoot `
        db start

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Isolated local Postgres FAILED."
    }

    $DbContainers =
        @(
            docker ps `
                --format "{{.Names}}" |
            Where-Object {
                $_ -like "supabase_db_*"
            }
        )

    if (
        $DbContainers.Count -ne 1
    ) {
        throw (
            "Unable to uniquely identify " +
            "isolated Supabase Postgres container."
        )
    }

    $DbContainer =
        $DbContainers[0]

    Write-Host (
        "Isolated database : READY"
    )

    # --------------------------------------------------------
    # KLYX_DR_LOCAL_ROLE_SANITIZER_PHASE_8D_2
    #
    # Le stack Supabase local cree deja ses roles systeme.
    # Le roles.sql distant peut contenir des reglages GUC
    # refuses par PostgreSQL local.
    #
    # On modifie uniquement la COPIE TEMPORAIRE extraite.
    # L archive DR chiffree reste intacte.
    # --------------------------------------------------------

    $TemporaryRolesPath =
        Join-Path `
            $DbRoot `
            "roles.sql"

    $OriginalRolesLines =
        @(
            Get-Content `
                -LiteralPath $TemporaryRolesPath
        )

    $FilteredRolesLines =
        @()

    $RemovedRestrictedRoleSettings =
        @()

    foreach (
        $RoleLine in $OriginalRolesLines
    ) {
        if (
            $RoleLine -match
            '(?i)log_min_messages'
        ) {
            $RemovedRestrictedRoleSettings +=
                $RoleLine

            continue
        }

        $FilteredRolesLines +=
            $RoleLine
    }

    if (
        $RemovedRestrictedRoleSettings.Count -gt 0
    ) {
        [System.IO.File]::WriteAllLines(
            $TemporaryRolesPath,
            $FilteredRolesLines,
            [System.Text.UTF8Encoding]::new($false)
        )
    }

    Write-Host (
        "Restricted local role settings removed : " +
        $RemovedRestrictedRoleSettings.Count
    )

    # --------------------------------------------------------
    # COPY RESTORE FILES INTO LOCAL DB CONTAINER
    # --------------------------------------------------------

    docker exec `
        $DbContainer `
        sh `
        -lc `
        "mkdir -p /tmp/klyx-dr"

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Cannot prepare isolated DB restore directory."
    }

    foreach (
        $FileName in
        @(
            "roles.sql",
            "schema.sql",
            "data.sql",
            "auth-data.sql",
            "migration-history-schema.sql",
            "migration-history-data.sql"
        )
    ) {
        $Source =
            Join-Path `
                $DbRoot `
                $FileName

        $Destination =
            "${DbContainer}:/tmp/klyx-dr/$FileName"

        docker cp `
            $Source `
            $Destination

        if (
            $LASTEXITCODE -ne 0
        ) {
            throw (
                "docker cp FAILED: " +
                $FileName
            )
        }
    }

    # --------------------------------------------------------
    # OFFICIAL LOGICAL RESTORE:
    # roles -> schema -> data
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- RESTORE DATABASE -----"

    docker exec `
        $DbContainer `
        psql `
        --username postgres `
        --dbname postgres `
        --single-transaction `
        --variable ON_ERROR_STOP=1 `
        --file /tmp/klyx-dr/roles.sql `
        --file /tmp/klyx-dr/schema.sql `
        --command "SET session_replication_role = replica;" `
        --file /tmp/klyx-dr/data.sql

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Database logical restore FAILED."
    }

    Write-Host "Database SQL       : PASS"

    # --------------------------------------------------------
    # HELPER FOR SAFE COUNTS ONLY
    # --------------------------------------------------------

    function Invoke-KlyxLocalScalar {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Sql
        )

        $Output =
            @(
                docker exec `
                    $DbContainer `
                    psql `
                    --username postgres `
                    --dbname postgres `
                    --tuples-only `
                    --no-align `
                    --variable ON_ERROR_STOP=1 `
                    --command $Sql
            )

        if (
            $LASTEXITCODE -ne 0
        ) {
            throw (
                "Local verification SQL FAILED."
            )
        }

        return (
            (
                $Output |
                Out-String
            ).Trim()
        )
    }

    # --------------------------------------------------------
    # AUTH
    #
    # data.sql officiel doit normalement restaurer
    # les données Auth.
    #
    # Le snapshot auth-data.sql de 8B est utilisé
    # seulement si data.sql n'a restauré aucun user.
    # --------------------------------------------------------

    $AuthUsers =
        [int](
            Invoke-KlyxLocalScalar `
                -Sql "select count(*) from auth.users;"
        )

    $ExpectedAuthUsers =
        [int]$ExpectedState.authUserCount

    if (
        $AuthUsers -eq 0 -and
        $ExpectedAuthUsers -gt 0
    ) {
        Write-Host (
            "Auth not present in standard data dump; " +
            "applying explicit Auth snapshot..."
        )

        docker exec `
            $DbContainer `
            psql `
            --username postgres `
            --dbname postgres `
            --single-transaction `
            --variable ON_ERROR_STOP=1 `
            --command "SET session_replication_role = replica;" `
            --file /tmp/klyx-dr/auth-data.sql

        if (
            $LASTEXITCODE -ne 0
        ) {
            throw "Explicit Auth restore FAILED."
        }

        $AuthUsers =
            [int](
                Invoke-KlyxLocalScalar `
                    -Sql "select count(*) from auth.users;"
            )
    }

    if (
        $AuthUsers -ne
        $ExpectedAuthUsers
    ) {
        throw (
            "Auth restore count mismatch. Expected " +
            $ExpectedAuthUsers +
            ", got " +
            $AuthUsers
        )
    }

    Write-Host (
        "Auth database      : PASS (" +
        $AuthUsers +
        ")"
    )

    # --------------------------------------------------------
    # MIGRATION HISTORY
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- RESTORE MIGRATION HISTORY -----"

    docker exec `
        $DbContainer `
        psql `
        --username postgres `
        --dbname postgres `
        --single-transaction `
        --variable ON_ERROR_STOP=1 `
        --file /tmp/klyx-dr/migration-history-schema.sql `
        --file /tmp/klyx-dr/migration-history-data.sql

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Migration history restore FAILED."
    }

    Write-Host "Migration history  : PASS"

    # --------------------------------------------------------
    # PUBLIC DATABASE SANITY
    # --------------------------------------------------------

    $PublicTables =
        [int](
            Invoke-KlyxLocalScalar `
                -Sql (
                    "select count(*) " +
                    "from information_schema.tables " +
                    "where table_schema = 'public' " +
                    "and table_type = 'BASE TABLE';"
                )
        )

    if (
        $PublicTables -le 0
    ) {
        throw "No public KLYX tables restored."
    }

    Write-Host (
        "Public tables      : PASS (" +
        $PublicTables +
        ")"
    )

    # --------------------------------------------------------
    # RESTART AS FULL SUPABASE STACK
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- START AUTH + STORAGE SERVICES -----"

    & $SupabaseCmd `
        --workdir $LabRoot `
        stop

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Unable to stop isolated DB before full stack."
    }

    & $SupabaseCmd `
        --workdir $LabRoot `
        start

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Full isolated Supabase stack FAILED."
    }

    # --------------------------------------------------------
    # READ LOCAL CREDENTIALS WITHOUT PRINTING THEM
    # --------------------------------------------------------

    $StatusLines =
        @(
            & $SupabaseCmd `
                --workdir $LabRoot `
                status `
                -o env
        )

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Cannot read isolated Supabase status."
    }

    $LocalStatus =
        @{}

    foreach (
        $Line in $StatusLines
    ) {
        if (
            $Line -match
            '^([A-Z0-9_]+)=(.*)$'
        ) {
            $Name =
                $Matches[1]

            $Value =
                $Matches[2].Trim()

            if (
                $Value.StartsWith('"') -and
                $Value.EndsWith('"')
            ) {
                $Value =
                    $Value.Substring(
                        1,
                        $Value.Length - 2
                    )
            }

            $LocalStatus[$Name] =
                $Value
        }
    }

    if (
        -not $LocalStatus.ContainsKey(
            "API_URL"
        )
    ) {
        throw "Local API_URL missing."
    }

    if (
        -not $LocalStatus.ContainsKey(
            "SERVICE_ROLE_KEY"
        )
    ) {
        throw "Local SERVICE_ROLE_KEY missing."
    }

    $env:KLYX_RESTORE_SUPABASE_URL =
        $LocalStatus["API_URL"]

    $env:KLYX_RESTORE_SERVICE_ROLE_KEY =
        $LocalStatus["SERVICE_ROLE_KEY"]

    # --------------------------------------------------------
    # RESTORE REAL STORAGE OBJECTS
    # + VERIFY AUTH THROUGH GOTRUE
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "----- RESTORE STORAGE OBJECTS -----"

    node `
        ".\scripts\restore-klyx-storage.mjs" `
        $StorageRoot

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw (
            "Storage/Auth service restore verification FAILED."
        )
    }

    Remove-Item `
        Env:\KLYX_RESTORE_SUPABASE_URL `
        -ErrorAction SilentlyContinue

    Remove-Item `
        Env:\KLYX_RESTORE_SERVICE_ROLE_KEY `
        -ErrorAction SilentlyContinue

    # --------------------------------------------------------
    # FINAL DB COUNTS
    # --------------------------------------------------------

    $DbContainersAfterStart =
        @(
            docker ps `
                --format "{{.Names}}" |
            Where-Object {
                $_ -like "supabase_db_*"
            }
        )

    if (
        $DbContainersAfterStart.Count -ne 1
    ) {
        throw "Restored database container missing."
    }

    $DbContainer =
        $DbContainersAfterStart[0]

    $FinalAuthUsers =
        [int](
            Invoke-KlyxLocalScalar `
                -Sql "select count(*) from auth.users;"
        )

    $FinalStorageBuckets =
        [int](
            Invoke-KlyxLocalScalar `
                -Sql "select count(*) from storage.buckets;"
        )

    $FinalStorageObjects =
        [int](
            Invoke-KlyxLocalScalar `
                -Sql "select count(*) from storage.objects;"
        )

    if (
        $FinalAuthUsers -ne
        [int]$ExpectedState.authUserCount
    ) {
        throw "Final Auth count FAILED."
    }

    if (
        $FinalStorageObjects -ne
        [int]$ExpectedState.storageObjectCount
    ) {
        throw "Final Storage object count FAILED."
    }

    # --------------------------------------------------------
    # SAFE LOCAL REPORT
    # --------------------------------------------------------

    $Report =
        [ordered]@{
            format =
                "KLYX_SUPABASE_DR_RESTORE_DRILL"

            version =
                1

            createdUtc =
                (
                    Get-Date
                ).ToUniversalTime().ToString(
                    "o"
                )

            archive =
                Split-Path `
                    -Leaf `
                    $ArchivePath

            encryptedSha256 =
                $ActualEncryptedHash

            isolatedLocalRestore =
                $true

            productionWrite =
                $false

            linkedCommands =
                $false

            publicTables =
                $PublicTables

            authUsers =
                $FinalAuthUsers

            storageBuckets =
                $FinalStorageBuckets

            storageObjects =
                $FinalStorageObjects

            storageBinaryIntegrity =
                $true

            authServiceVerified =
                $true

            storageServiceVerified =
                $true

            plaintextRetained =
                $false

            restoreTested =
                $true
        }

    $Report |
        ConvertTo-Json `
            -Depth 10 |
        Set-Content `
            -LiteralPath $ReportPath `
            -Encoding UTF8

    $RestoreSucceeded =
        $true

    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX PHASE 8D RESTORE DRILL COMPLETE"
    Write-Host "======================================"
    Write-Host "Database restore   : PASS"
    Write-Host "Public tables      : $PublicTables"
    Write-Host "Auth DB            : PASS ($FinalAuthUsers)"
    Write-Host "Auth service       : PASS"
    Write-Host "Storage buckets    : $FinalStorageBuckets"
    Write-Host "Storage objects    : $FinalStorageObjects"
    Write-Host "Storage SHA256     : PASS"
    Write-Host "Storage service    : PASS"
    Write-Host "Production write   : NO"
    Write-Host "Linked command     : NO"
    Write-Host "Plaintext retained : NO"
    Write-Host "Restore tested     : YES"
    Write-Host "======================================"
}
finally {
    Remove-Item `
        Env:\KLYX_DR_PASSPHRASE `
        -ErrorAction SilentlyContinue

    Remove-Item `
        Env:\KLYX_RESTORE_SUPABASE_URL `
        -ErrorAction SilentlyContinue

    Remove-Item `
        Env:\KLYX_RESTORE_SERVICE_ROLE_KEY `
        -ErrorAction SilentlyContinue

    $Passphrase =
        $null

    # Never use --all. Only destroy this isolated local lab.
    if (
        Test-Path `
            -LiteralPath (
                Join-Path `
                    $LabRoot `
                    "supabase\config.toml"
            )
    ) {
        & $SupabaseCmd `
            --workdir $LabRoot `
            stop `
            --no-backup `
            *> $null
    }

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
