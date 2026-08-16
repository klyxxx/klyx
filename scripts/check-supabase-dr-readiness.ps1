Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root =
    "C:\Users\fenjo\Documents\klyx"

if (
    -not (
        Test-Path `
            -LiteralPath $Root `
            -PathType Container
    )
) {
    throw "KLYX project root introuvable."
}

Set-Location $Root

function Get-KlyxToolInfo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $command =
        Get-Command `
            $Name `
            -ErrorAction SilentlyContinue

    if (-not $command) {
        return [pscustomobject]@{
            installed = $false
            version = "MISSING"
            path = ""
        }
    }

    try {
        $output =
            @(
                & $command.Source @Arguments 2>&1
            )

        $exitCode =
            $LASTEXITCODE

        $version =
            (
                $output |
                Select-Object -First 1 |
                Out-String
            ).Trim()

        if (-not $version) {
            $version =
                "INSTALLED"
        }

        return [pscustomobject]@{
            installed =
                ($exitCode -eq 0)

            version =
                $version

            path =
                $command.Source
        }
    }
    catch {
        return [pscustomobject]@{
            installed = $false
            version = "ERROR"
            path = $command.Source
        }
    }
}

function Get-KlyxEnvNames {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (
        -not (
            Test-Path `
                -LiteralPath $Path `
                -PathType Leaf
        )
    ) {
        return @()
    }

    $names =
        @()

    foreach (
        $line in
        Get-Content -LiteralPath $Path
    ) {
        if (
            $line -match
            '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*='
        ) {
            $names +=
                $Matches[1]
        }
    }

    return @(
        $names |
        Sort-Object -Unique
    )
}

function Test-KlyxEnvName {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names,

        [Parameter(Mandatory = $true)]
        [string[]]$Candidates
    )

    foreach (
        $candidate in $Candidates
    ) {
        if (
            $Names -contains
            $candidate
        ) {
            return $true
        }
    }

    return $false
}

function Convert-KlyxBool {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Value
    )

    if ($Value) {
        return "YES"
    }

    return "NO"
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX PHASE 8A - SUPABASE DR PREFLIGHT"
Write-Host "======================================"

# ------------------------------------------------------------
# GIT
# ------------------------------------------------------------

$insideGit =
    (
        git -C $Root `
            rev-parse `
            --is-inside-work-tree
    ).Trim()

if (
    $LASTEXITCODE -ne 0 -or
    $insideGit -ne "true"
) {
    throw "Projet Git KLYX invalide."
}

$branch =
    (
        git -C $Root `
            branch `
            --show-current
    ).Trim()

$commit =
    (
        git -C $Root `
            rev-parse HEAD
    ).Trim()

# ------------------------------------------------------------
# OUTILS
# ------------------------------------------------------------

$supabaseTool =
    Get-KlyxToolInfo `
        -Name "supabase" `
        -Arguments @(
            "--version"
        )

$pgDumpTool =
    Get-KlyxToolInfo `
        -Name "pg_dump" `
        -Arguments @(
            "--version"
        )

$psqlTool =
    Get-KlyxToolInfo `
        -Name "psql" `
        -Arguments @(
            "--version"
        )

# ------------------------------------------------------------
# SUPABASE LINK
# ------------------------------------------------------------

$projectRefPath =
    Join-Path `
        $Root `
        "supabase\.temp\project-ref"

$linkedProjectPath =
    Join-Path `
        $Root `
        "supabase\.temp\linked-project.json"

$configTomlPath =
    Join-Path `
        $Root `
        "supabase\config.toml"

$projectRefPresent =
    $false

if (
    Test-Path `
        -LiteralPath $projectRefPath `
        -PathType Leaf
) {
    $projectRefText =
        (
            Get-Content `
                -LiteralPath $projectRefPath `
                -Raw
        ).Trim()

    $projectRefPresent =
        [bool]$projectRefText
}

$linkedProjectPresent =
    Test-Path `
        -LiteralPath $linkedProjectPath `
        -PathType Leaf

$configTomlPresent =
    Test-Path `
        -LiteralPath $configTomlPath `
        -PathType Leaf

$linked =
    $projectRefPresent -or
    $linkedProjectPresent

# ------------------------------------------------------------
# MIGRATIONS
# ------------------------------------------------------------

$migrationsPath =
    Join-Path `
        $Root `
        "supabase\migrations"

$migrations =
    @()

if (
    Test-Path `
        -LiteralPath $migrationsPath `
        -PathType Container
) {
    $migrations =
        @(
            Get-ChildItem `
                -LiteralPath $migrationsPath `
                -Filter "*.sql" `
                -File
        )
}

# ------------------------------------------------------------
# ENV LOCAL
# IMPORTANT:
# uniquement les NOMS.
# aucune valeur n'est affichee.
# ------------------------------------------------------------

$envLocalPath =
    Join-Path `
        $Root `
        ".env.local"

$envNames =
    @(
        Get-KlyxEnvNames `
            -Path $envLocalPath
    )

$hasSupabaseUrl =
    Test-KlyxEnvName `
        -Names $envNames `
        -Candidates @(
            "NEXT_PUBLIC_SUPABASE_URL"
        )

$hasPublicKey =
    Test-KlyxEnvName `
        -Names $envNames `
        -Candidates @(
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        )

$hasServiceRole =
    Test-KlyxEnvName `
        -Names $envNames `
        -Candidates @(
            "SUPABASE_SERVICE_ROLE_KEY"
        )

$hasDatabaseCredential =
    Test-KlyxEnvName `
        -Names $envNames `
        -Candidates @(
            "SUPABASE_DB_PASSWORD",
            "SUPABASE_DB_URL",
            "DATABASE_URL",
            "POSTGRES_URL"
        )

# ------------------------------------------------------------
# SOURCE BACKUP FOUNDATION
# ------------------------------------------------------------

$sourceFoundation =
    @(
        "scripts\backup-klyx.ps1",
        "scripts\check-klyx-backup.ps1",
        "scripts\restore-klyx.ps1",
        ".github\workflows\klyx-backup.yml"
    )

$missingSourceFoundation =
    @()

foreach (
    $relative in $sourceFoundation
) {
    $fullPath =
        Join-Path `
            $Root `
            $relative

    if (
        -not (
            Test-Path `
                -LiteralPath $fullPath `
                -PathType Leaf
        )
    ) {
        $missingSourceFoundation +=
            $relative
    }
}

$sourceBackupReady =
    ($missingSourceFoundation.Count -eq 0)

# ------------------------------------------------------------
# DETECTION DES BUCKETS STORAGE UTILISES PAR KLYX
#
# Aucun fichier utilisateur n'est lu ici.
# On analyse uniquement le code Git.
# ------------------------------------------------------------

$bucketNames =
    New-Object `
        "System.Collections.Generic.HashSet[string]" `
        ([System.StringComparer]::OrdinalIgnoreCase)

$trackedFiles =
    @(
        git -C $Root ls-files
    )

if ($LASTEXITCODE -ne 0) {
    throw "git ls-files FAILED."
}

$sourceExtensions =
    @(
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs"
    )

$bucketConstantPattern =
    'const\s+[A-Z0-9_]*BUCKET[A-Z0-9_]*\s*=\s*["'']([^"'']+)["'']'

$storageFromPattern =
    'storage[\s\S]{0,160}?\.from\(\s*["'']([^"'']+)["'']'

foreach (
    $relativePath in $trackedFiles
) {
    $extension =
        [System.IO.Path]::GetExtension(
            $relativePath
        )

    if (
        $sourceExtensions -notcontains
        $extension
    ) {
        continue
    }

    $fullPath =
        Join-Path `
            $Root `
            $relativePath

    if (
        -not (
            Test-Path `
                -LiteralPath $fullPath `
                -PathType Leaf
        )
    ) {
        continue
    }

    $content =
        Get-Content `
            -LiteralPath $fullPath `
            -Raw `
            -ErrorAction SilentlyContinue

    if (-not $content) {
        continue
    }

    foreach (
        $match in
        [regex]::Matches(
            $content,
            $bucketConstantPattern,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
    ) {
        $name =
            $match.Groups[1].Value.Trim()

        if ($name) {
            [void]$bucketNames.Add(
                $name
            )
        }
    }

    foreach (
        $match in
        [regex]::Matches(
            $content,
            $storageFromPattern,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
    ) {
        $name =
            $match.Groups[1].Value.Trim()

        if ($name) {
            [void]$bucketNames.Add(
                $name
            )
        }
    }
}

$buckets =
    @(
        $bucketNames |
        Sort-Object
    )

# ------------------------------------------------------------
# READINESS
# ------------------------------------------------------------

$databaseBackupToolingReady =
    $supabaseTool.installed -and
    $linked

$databaseRestoreToolingReady =
    $psqlTool.installed

$storageBackupAccessReady =
    $hasSupabaseUrl -and
    $hasServiceRole

$fullDrTested =
    $false

$actions =
    @()

if (-not $supabaseTool.installed) {
    $actions +=
        "INSTALL_SUPABASE_CLI"
}

if (-not $pgDumpTool.installed) {
    $actions +=
        "INSTALL_POSTGRES_PG_DUMP"
}

if (-not $psqlTool.installed) {
    $actions +=
        "INSTALL_POSTGRES_PSQL"
}

if (-not $linked) {
    $actions +=
        "LINK_SUPABASE_PROJECT"
}

if (-not $hasSupabaseUrl) {
    $actions +=
        "RESTORE_LOCAL_SUPABASE_URL"
}

if (-not $hasPublicKey) {
    $actions +=
        "RESTORE_LOCAL_PUBLIC_KEY"
}

if (-not $hasServiceRole) {
    $actions +=
        "RESTORE_LOCAL_SERVICE_ROLE"
}

if (-not $hasDatabaseCredential) {
    $actions +=
        "DB_PASSWORD_WILL_BE_REQUESTED_SECURELY_IN_8B"
}

if ($buckets.Count -gt 0) {
    $actions +=
        "BACKUP_STORAGE_OBJECTS_SEPARATELY"
}

$actions =
    @(
        $actions |
        Sort-Object -Unique
    )

# ------------------------------------------------------------
# REPORT LOCAL IGNORE PAR GIT
# ------------------------------------------------------------

$reportDirectory =
    Join-Path `
        $Root `
        ".klyx-local-backup\dr-preflight"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $reportDirectory |
    Out-Null

$report =
    [ordered]@{
        format =
            "KLYX_SUPABASE_DR_PREFLIGHT"

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
                branch = $branch
                commit = $commit
            }

        tools =
            [ordered]@{
                supabase =
                    $supabaseTool

                pgDump =
                    $pgDumpTool

                psql =
                    $psqlTool
            }

        supabase =
            [ordered]@{
                linkedProject =
                    $linked

                projectRefPresent =
                    $projectRefPresent

                linkedProjectMetadataPresent =
                    $linkedProjectPresent

                configTomlPresent =
                    $configTomlPresent

                migrationsCount =
                    $migrations.Count
            }

        localEnvironment =
            [ordered]@{
                envFilePresent =
                    (
                        Test-Path `
                            -LiteralPath $envLocalPath `
                            -PathType Leaf
                    )

                supabaseUrlPresent =
                    $hasSupabaseUrl

                publicKeyPresent =
                    $hasPublicKey

                serviceRolePresent =
                    $hasServiceRole

                databaseCredentialPresent =
                    $hasDatabaseCredential

                secretValuesPrinted =
                    $false
            }

        sourceBackup =
            [ordered]@{
                ready =
                    $sourceBackupReady

                missingFiles =
                    $missingSourceFoundation
            }

        storage =
            [ordered]@{
                sourceBucketReferenceCount =
                    $buckets.Count

                bucketReferences =
                    $buckets

                storageObjectsBackedUp =
                    $false
            }

        readiness =
            [ordered]@{
                databaseBackupTooling =
                    $databaseBackupToolingReady

                databaseRestoreTooling =
                    $databaseRestoreToolingReady

                storageBackupAccess =
                    $storageBackupAccessReady

                fullDisasterRecoveryTested =
                    $fullDrTested
            }

        nextActions =
            $actions
    }

$jsonPath =
    Join-Path `
        $reportDirectory `
        "KLYX_SUPABASE_DR_PREFLIGHT.json"

$txtPath =
    Join-Path `
        $reportDirectory `
        "KLYX_SUPABASE_DR_PREFLIGHT.txt"

$report |
    ConvertTo-Json `
        -Depth 10 |
    Set-Content `
        -LiteralPath $jsonPath `
        -Encoding UTF8

$bucketText =
    "NONE"

if ($buckets.Count -gt 0) {
    $bucketText =
        (
            $buckets -join ", "
        )
}

$actionText =
    "NONE"

if ($actions.Count -gt 0) {
    $actionText =
        (
            $actions -join ", "
        )
}

$lines =
    @(
        "======================================",
        "KLYX SUPABASE DR PREFLIGHT",
        "======================================",
        "Branch                 : $branch",
        "Commit                 : $commit",
        "Supabase CLI           : $($supabaseTool.version)",
        "pg_dump                : $($pgDumpTool.version)",
        "psql                   : $($psqlTool.version)",
        "Supabase linked        : $(Convert-KlyxBool $linked)",
        "config.toml            : $(Convert-KlyxBool $configTomlPresent)",
        "Canonical migrations   : $($migrations.Count)",
        "Supabase URL           : $(Convert-KlyxBool $hasSupabaseUrl)",
        "Public key             : $(Convert-KlyxBool $hasPublicKey)",
        "Service-role local     : $(Convert-KlyxBool $hasServiceRole)",
        "DB credential local    : $(Convert-KlyxBool $hasDatabaseCredential)",
        "Source backup          : $(Convert-KlyxBool $sourceBackupReady)",
        "Storage buckets refs   : $bucketText",
        "Storage objects backup : NO",
        "DB backup tooling      : $(Convert-KlyxBool $databaseBackupToolingReady)",
        "DB restore tooling     : $(Convert-KlyxBool $databaseRestoreToolingReady)",
        "Storage backup access  : $(Convert-KlyxBool $storageBackupAccessReady)",
        "Full DR tested         : NO",
        "Secret values printed  : NO",
        "Next actions           : $actionText",
        "======================================"
    )

$lines |
    Set-Content `
        -LiteralPath $txtPath `
        -Encoding UTF8

Write-Host ""

foreach (
    $line in $lines
) {
    Write-Host $line
}

Write-Host ""
Write-Host "Local report JSON : $jsonPath"
Write-Host "Local report TXT  : $txtPath"
Write-Host ""
Write-Host "KLYX PHASE 8A PREFLIGHT COMPLETE"