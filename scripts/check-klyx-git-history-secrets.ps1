Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# KLYX_DEEP_GIT_SECRET_SCAN_PHASE_12A_3_FIX2

$Root = "C:\Users\fenjo\Documents\klyx"
Set-Location $Root

$ExpectedBranch = "agent/klyx-repo-hygiene-20260816"

$Branch = (git branch --show-current).Trim()

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
        "deep-git-secret-scan-12A3.txt"

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
            $Parts = $Candidate.Value.Split(".")

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

    $UrlMatches =
        [regex]::Matches(
            $Text,
            $Regex
        )

    foreach ($Match in $UrlMatches) {
        $Password =
            $Match.Groups[2].Value

        $HostName =
            $Match.Groups[3].Value

        $IsLocal =
            $HostName -match '^(127\.0\.0\.1|localhost)(:\d+)?$'

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

$ObjectRows =
    @(
        git rev-list `
            --objects `
            --all |
        git cat-file `
            --batch-check='%(objectname)|%(objecttype)|%(objectsize)|%(rest)'
    )

if ($LASTEXITCODE -ne 0) {
    throw "Git object inventory FAILED."
}

$BlobList =
    [System.Collections.Generic.List[object]]::new()

foreach ($Row in $ObjectRows) {
    if ([string]::IsNullOrWhiteSpace($Row)) {
        continue
    }

    $Parts =
        $Row -split '\|', 4

    if ($Parts.Count -lt 3) {
        continue
    }

    if ($Parts[1] -ne "blob") {
        continue
    }

    $Size = 0L

    if (
        -not [long]::TryParse(
            $Parts[2],
            [ref]$Size
        )
    ) {
        continue
    }

    if ($Size -le 0) {
        continue
    }

    if ($Size -gt 2MB) {
        continue
    }

    $PathValue =
        if ($Parts.Count -ge 4) {
            $Parts[3]
        }
        else {
            ""
        }

    $BlobList.Add(
        [pscustomobject]@{
            Sha  = $Parts[0]
            Size = $Size
            Path = $PathValue
        }
    )
}

$Blobs =
    @(
        $BlobList |
        Sort-Object Sha -Unique
    )

$FindingList =
    [System.Collections.Generic.List[object]]::new()

$Scanned = 0
$EmptySkipped = 0
$BinarySkipped = 0

foreach ($Blob in $Blobs) {
    $Lines =
        @(
            git cat-file `
                blob `
                $Blob.Sha
        )

    if ($LASTEXITCODE -ne 0) {
        continue
    }

    $Text =
        $Lines -join "`n"

    if ([string]::IsNullOrWhiteSpace($Text)) {
        $EmptySkipped++
        continue
    }

    $Scanned++

    if (
        $Text.IndexOf(
            [char]0
        ) -ge 0
    ) {
        $BinarySkipped++
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
                    Blob    = $Blob.Sha
                    Path    = $Blob.Path
                }
            )
        }
    }

    $ServiceRoleFound =
        Test-ServiceRoleJwt `
            -Text $Text

    if ($ServiceRoleFound) {
        $FindingList.Add(
            [pscustomobject]@{
                Pattern = "Supabase service-role JWT"
                Blob    = $Blob.Sha
                Path    = $Blob.Path
            }
        )
    }

    $DatabasePasswordFound =
        Test-EmbeddedPostgresPassword `
            -Text $Text

    if ($DatabasePasswordFound) {
        $FindingList.Add(
            [pscustomobject]@{
                Pattern = "Postgres URL with non-local embedded password"
                Blob    = $Blob.Sha
                Path    = $Blob.Path
            }
        )
    }
}

$Findings =
    @(
        $FindingList |
        Sort-Object `
            Pattern,
            Blob,
            Path `
            -Unique
    )

$FindingCount =
    @($Findings).Count

$Report =
    [System.Collections.Generic.List[string]]::new()

$Report.Add("KLYX DEEP GIT HISTORY SECRET SCAN")
$Report.Add("=================================")
$Report.Add("Generated: $(Get-Date -Format o)")
$Report.Add("")
$Report.Add("Secret values stored in report: NO")
$Report.Add("Blobs inventoried: $(@($Blobs).Count)")
$Report.Add("Blobs scanned: $Scanned")
$Report.Add("Empty blobs skipped: $EmptySkipped")
$Report.Add("Binary blobs skipped: $BinarySkipped")
$Report.Add("Confirmed secret-shaped findings: $FindingCount")
$Report.Add("")

foreach ($Finding in $Findings) {
    $SafePath =
        if ([string]::IsNullOrWhiteSpace($Finding.Path)) {
            "(path unavailable)"
        }
        else {
            $Finding.Path
        }

    $Report.Add(
        $Finding.Pattern +
        " | blob " +
        $Finding.Blob.Substring(0, 12) +
        " | " +
        $SafePath
    )
}

[System.IO.File]::WriteAllLines(
    $ReportPath,
    $Report,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX DEEP GIT HISTORY SECRET SCAN"
Write-Host "======================================"
Write-Host "Blobs inventoried      : $(@($Blobs).Count)"
Write-Host "Blobs scanned          : $Scanned"
Write-Host "Empty blobs skipped    : $EmptySkipped"
Write-Host "Binary blobs skipped   : $BinarySkipped"
Write-Host "Secret-shaped findings : $FindingCount"
Write-Host "Secret values printed  : NO"
Write-Host "Report tracked         : NO"
Write-Host ""

foreach ($Finding in $Findings) {
    $SafePath =
        if ([string]::IsNullOrWhiteSpace($Finding.Path)) {
            "(path unavailable)"
        }
        else {
            $Finding.Path
        }

    Write-Host (
        "FINDING: " +
        $Finding.Pattern +
        " | blob " +
        $Finding.Blob.Substring(0, 12) +
        " | " +
        $SafePath
    )
}

Write-Host ""

if ($FindingCount -gt 0) {
    throw "KLYX DEEP GIT SECRET SCAN NEEDS SECURITY REVIEW."
}

Write-Host "Full Git history : PASS"
Write-Host "KLYX PHASE 12A.3 COMPLETE"