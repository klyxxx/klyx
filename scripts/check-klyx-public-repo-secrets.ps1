Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# KLYX_PUBLIC_REPO_SECRET_SCAN_PHASE_12A_7

$Root = "C:\Users\fenjo\Documents\klyx"
Set-Location $Root

$ExpectedBranch =
    "agent/klyx-repo-hygiene-20260816"

$Branch =
    (
        git branch --show-current
    ).Trim()

if ($Branch -ne $ExpectedBranch) {
    throw "Wrong branch: $Branch"
}

$ReportRoot =
    Join-Path `
        $Root `
        ".klyx-local-backup\security"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $ReportRoot |
Out-Null

$ReportPath =
    Join-Path `
        $ReportRoot `
        "public-repo-secret-scan-12A7.txt"

$SensitiveExactPaths = @(
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.test"
)

$SensitiveWildcardPaths = @(
    "*.pem",
    "*.p12",
    "*.pfx",
    "*.key",
    "*.klyxdr",
    "*.klyxdr.sha256",
    "*.klyxdr.zip",
    "*.dump",
    "*.dump.gz",
    "*.sql.dump",
    "*.sql.gz",
    ".klyx-local-backup/*",
    "supabase/.temp/*",
    "playwright-report/*",
    "test-results/*",
    "blob-report/*",
    ".klyx-baseline-rebuild-*/*",
    ".klyx-fidelity-rebuild-*/*",
    ".klyx-local-rebuild-*/*",
    "repository-archive-*/*"
)

function Test-SensitivePath {
    param(
        [AllowEmptyString()]
        [string]$Path = ""
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $false
    }

    $Normalized =
        $Path.Replace("\", "/")

    if ($SensitiveExactPaths -contains $Normalized) {
        return $true
    }

    foreach ($Pattern in $SensitiveWildcardPaths) {
        if ($Normalized -like $Pattern) {
            return $true
        }
    }

    return $false
}

$Patterns = @(
    [pscustomobject]@{
        Name = "Stripe secret key"
        Regex = '(?<![A-Za-z0-9])sk_(?:live|test)_[A-Za-z0-9]{20,}'
    },
    [pscustomobject]@{
        Name = "Stripe restricted key"
        Regex = '(?<![A-Za-z0-9])rk_(?:live|test)_[A-Za-z0-9]{20,}'
    },
    [pscustomobject]@{
        Name = "Stripe webhook secret"
        Regex = '(?<![A-Za-z0-9])whsec_[A-Za-z0-9]{20,}'
    },
    [pscustomobject]@{
        Name = "OpenAI secret"
        Regex = '(?<![A-Za-z0-9_-])sk-(?:proj-)?[A-Za-z0-9_-]{20,}'
    },
    [pscustomobject]@{
        Name = "GitHub fine-grained token"
        Regex = 'github_pat_[A-Za-z0-9_]{20,}'
    },
    [pscustomobject]@{
        Name = "GitHub token"
        Regex = 'gh[pousr]_[A-Za-z0-9]{20,}'
    },
    [pscustomobject]@{
        Name = "AWS access key"
        Regex = 'AKIA[0-9A-Z]{16}'
    },
    [pscustomobject]@{
        Name = "Supabase secret key"
        Regex = 'sb_secret_[A-Za-z0-9_-]{20,}'
    },
    [pscustomobject]@{
        Name = "Private key"
        Regex = '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
    },
    [pscustomobject]@{
        Name = "Twilio auth token assignment"
        Regex = '(?i)TWILIO_AUTH_TOKEN\s*[:=]\s*["'']?[0-9a-f]{32}["'']?'
    },
    [pscustomobject]@{
        Name = "Database password assignment"
        Regex = '(?i)SUPABASE_DB_PASSWORD\s*[:=]\s*["''][^"'']{8,}["'']'
    },
    [pscustomobject]@{
        Name = "DR passphrase assignment"
        Regex = '(?i)KLYX_DR_PASSPHRASE\s*[:=]\s*["''][^"'']{12,}["'']'
    },
    [pscustomobject]@{
        Name = "E2E password assignment"
        Regex = '(?i)E2E_PASSWORD\s*[:=]\s*["''][^"'']{8,}["'']'
    },
    [pscustomobject]@{
        Name = "Sumsub secret assignment"
        Regex = '(?i)SUMSUB_SECRET_KEY\s*[:=]\s*["''][^"'']{12,}["'']'
    }
)

function Test-ServiceRoleJwt {
    param(
        [AllowEmptyString()]
        [string]$Text = ""
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $false
    }

    $JwtRegex =
        '\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b'

    $Candidates =
        [regex]::Matches(
            $Text,
            $JwtRegex
        )

    foreach ($Candidate in $Candidates) {
        try {
            $Parts =
                $Candidate.Value.Split(".")

            if ($Parts.Count -lt 2) {
                continue
            }

            $Payload =
                $Parts[1].
                    Replace("-", "+").
                    Replace("_", "/")

            while (($Payload.Length % 4) -ne 0) {
                $Payload += "="
            }

            $Bytes =
                [Convert]::FromBase64String(
                    $Payload
                )

            $Json =
                [System.Text.Encoding]::UTF8.GetString(
                    $Bytes
                )

            $Object =
                $Json |
                ConvertFrom-Json `
                    -ErrorAction Stop

            if (
                $Object.PSObject.Properties.Name -contains "role" -and
                $Object.role -eq "service_role"
            ) {
                return $true
            }
        }
        catch {
            continue
        }
    }

    return $false
}

function Test-EmbeddedPostgresPassword {
    param(
        [AllowEmptyString()]
        [string]$Text = ""
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $false
    }

    $Regex =
        '(?i)postgres(?:ql)?://([^:/\s]+):([^@\s]+)@([^/\s]+)'

    $Matches =
        [regex]::Matches(
            $Text,
            $Regex
        )

    foreach ($Match in $Matches) {
        $Password =
            $Match.Groups[2].Value

        $HostName =
            $Match.Groups[3].Value

        $IsLocal =
            $HostName -match `
                '^(127\.0\.0\.1|localhost)(:\d+)?$'

        $IsDefaultLocal =
            $IsLocal -and
            $Password -eq "postgres"

        $IsPlaceholder =
            $Password -match (
                '^\[.*\]$|' +
                '^<.*>$|' +
                '^\$\{?.+\}?$|' +
                '^YOUR[-_].*$'
            )

        if (
            -not $IsDefaultLocal -and
            -not $IsPlaceholder
        ) {
            return $true
        }
    }

    return $false
}

git fetch --all --prune

if ($LASTEXITCODE -ne 0) {
    throw "git fetch FAILED."
}

$TrackedFiles =
    @(
        git ls-files
    )

if ($LASTEXITCODE -ne 0) {
    throw "git ls-files FAILED."
}

$SensitivePaths =
    [System.Collections.Generic.List[string]]::new()

$FindingList =
    [System.Collections.Generic.List[object]]::new()

foreach ($File in $TrackedFiles) {
    if (Test-SensitivePath -Path $File) {
        $SensitivePaths.Add($File)
    }

    $FullPath =
        Join-Path `
            $Root `
            $File

    if (
        -not (
            Test-Path `
                -LiteralPath $FullPath `
                -PathType Leaf
        )
    ) {
        continue
    }

    $Info =
        Get-Item `
            -LiteralPath $FullPath

    if ($Info.Length -gt 2MB) {
        continue
    }

    try {
        $Text =
            Get-Content `
                -LiteralPath $FullPath `
                -Raw `
                -ErrorAction Stop
    }
    catch {
        continue
    }

    if ([string]::IsNullOrWhiteSpace($Text)) {
        continue
    }

    if ($Text.IndexOf([char]0) -ge 0) {
        continue
    }

    foreach ($Pattern in $Patterns) {
        if (
            [regex]::IsMatch(
                $Text,
                $Pattern.Regex
            )
        ) {
            $FindingList.Add(
                [pscustomobject]@{
                    Pattern = $Pattern.Name
                    File    = $File
                }
            )
        }
    }

    if (
        Test-ServiceRoleJwt `
            -Text $Text
    ) {
        $FindingList.Add(
            [pscustomobject]@{
                Pattern = "Supabase service-role JWT"
                File    = $File
            }
        )
    }

    if (
        Test-EmbeddedPostgresPassword `
            -Text $Text
    ) {
        $FindingList.Add(
            [pscustomobject]@{
                Pattern = "Postgres URL with remote embedded password"
                File    = $File
            }
        )
    }
}

$CurrentFindings =
    @(
        $FindingList |
        Sort-Object `
            Pattern,
            File `
            -Unique
    )

$SensitivePaths =
    @(
        $SensitivePaths |
        Sort-Object -Unique
    )

$SensitivePathCount =
    @($SensitivePaths).Count

$FindingCount =
    @($CurrentFindings).Count

$Report =
    [System.Collections.Generic.List[string]]::new()

$Report.Add("KLYX CURRENT PUBLIC REPOSITORY SECRET SCAN")
$Report.Add("==========================================")
$Report.Add("Generated: $(Get-Date -Format o)")
$Report.Add("")
$Report.Add("Secret values stored: NO")
$Report.Add("Tracked files: $(@($TrackedFiles).Count)")
$Report.Add("Sensitive tracked paths: $SensitivePathCount")
$Report.Add("Secret-shaped content findings: $FindingCount")
$Report.Add("")

foreach ($Item in $SensitivePaths) {
    $Report.Add(
        "SENSITIVE_PATH | " +
        $Item
    )
}

foreach ($Item in $CurrentFindings) {
    $Report.Add(
        "CONTENT | " +
        $Item.Pattern +
        " | " +
        $Item.File
    )
}

[System.IO.File]::WriteAllLines(
    $ReportPath,
    $Report,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX CURRENT REPOSITORY SECRET SCAN"
Write-Host "======================================"
Write-Host "Tracked files          : $(@($TrackedFiles).Count)"
Write-Host "Sensitive paths        : $SensitivePathCount"
Write-Host "Secret-shaped findings : $FindingCount"
Write-Host "Secret values printed  : NO"
Write-Host "Report tracked         : NO"
Write-Host ""

foreach ($Item in $SensitivePaths) {
    Write-Host "SENSITIVE PATH: $Item"
}

foreach ($Item in $CurrentFindings) {
    Write-Host (
        "FINDING: " +
        $Item.Pattern +
        " | " +
        $Item.File
    )
}

Write-Host ""

if ($SensitivePathCount -gt 0) {
    throw "Sensitive files are tracked by Git."
}

if ($FindingCount -gt 0) {
    throw "Current repository secret scan needs review."
}

Write-Host "Current repository : PASS"
Write-Host "KLYX CURRENT SECRET SCAN COMPLETE"