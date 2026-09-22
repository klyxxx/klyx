param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{40}$')]
  [string]$ExpectedMainSha,

  [switch]$ExecuteDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Repository = 'klyxxx/klyx'
$VercelOrgId = 'team_QaRMiX8yTbmNx0NTzqfhrMDj'
$VercelProjectId = 'prj_N6ZRVFs9ySP26csLhO0tXUiGVJW7'
$ProductionOrigin = 'https://www.klyx.be'
$RequiredMainPushWorkflows = @(
  'KLYX Security Certification',
  'KLYX Golden Path',
  'KLYX E2E'
)

function Fail([string]$Message) {
  throw "KLYX_DEPLOYMENT_GATE_FAILED: $Message"
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "Command failed: $Command $($Arguments -join ' ')"
  }
}

function Invoke-CheckedCapture {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )

  $output = & $Command @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    $rendered = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    Fail "Command failed: $Command $($Arguments -join ' ')`n$rendered"
  }

  return @($output | ForEach-Object { $_.ToString() })
}

function Assert-ExactMainAndCleanTree {
  Invoke-Checked git fetch --prune origin main

  $remoteMain = (Invoke-CheckedCapture git rev-parse origin/main | Select-Object -Last 1).Trim().ToLowerInvariant()
  $head = (Invoke-CheckedCapture git rev-parse HEAD | Select-Object -Last 1).Trim().ToLowerInvariant()
  $branch = (Invoke-CheckedCapture git branch --show-current | Select-Object -Last 1).Trim()
  $expected = $ExpectedMainSha.ToLowerInvariant()

  if ($branch -ne 'main') {
    Fail "Production must be built from branch main; current branch is '$branch'."
  }
  if ($remoteMain -ne $expected) {
    Fail "Expected SHA $expected is not the current origin/main SHA $remoteMain. Re-fetch and restart the release."
  }
  if ($head -ne $expected) {
    Fail "Local HEAD $head does not equal exact main SHA $expected."
  }

  $dirty = Invoke-CheckedCapture git status --porcelain
  if (($dirty -join '').Trim().Length -ne 0) {
    Fail 'Working tree or index is dirty. Production requires a clean exact-main checkout.'
  }

  return $expected
}

function Assert-GreenMainPushChecks([string]$Sha) {
  $headers = @{
    'Accept' = 'application/vnd.github+json'
    'User-Agent' = 'KLYX-Deployment-Gate/1.0'
    'X-GitHub-Api-Version' = '2022-11-28'
  }

  $uri = "https://api.github.com/repos/$Repository/actions/runs?head_sha=$Sha&per_page=100"
  try {
    $payload = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
  }
  catch {
    Fail "Unable to read GitHub Actions runs for exact main SHA ${Sha}: $($_.Exception.Message)"
  }

  foreach ($workflowName in $RequiredMainPushWorkflows) {
    $run = $payload.workflow_runs |
      Where-Object {
        $_.name -eq $workflowName -and
        $_.head_sha -eq $Sha -and
        $_.event -eq 'push'
      } |
      Sort-Object -Property created_at -Descending |
      Select-Object -First 1

    if ($null -eq $run) {
      Fail "Missing exact-main push run for '$workflowName' at $Sha."
    }
    if ($run.status -ne 'completed' -or $run.conclusion -ne 'success') {
      Fail "'$workflowName' is not green for exact main SHA $Sha (status=$($run.status), conclusion=$($run.conclusion))."
    }
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Push-Location $repoRoot

try {
  $sha = Assert-ExactMainAndCleanTree
  Assert-GreenMainPushChecks -Sha $sha

  # Pin the command to the known KLYX Vercel project rather than relying on
  # whichever project a local directory may previously have been linked to.
  $env:VERCEL_ORG_ID = $VercelOrgId
  $env:VERCEL_PROJECT_ID = $VercelProjectId

  # Remote Vercel builds are intentional. Local `vercel build --prod` requires
  # symlink creation on Windows and can fail with EPERM even when the KLYX build
  # itself is valid. Exact source safety is provided by the clean exact-main gate
  # above and by immutable deployment metadata.
  Invoke-Checked npx vercel pull --yes --environment=production

  if (-not $ExecuteDeploy) {
    Write-Host "KLYX_DEPLOYMENT_GATE_READY sha=$sha project=$VercelProjectId deploy=false"
    Write-Host 'Exact main and required checks are green. No Vercel deployment was created.'
    exit 0
  }

  if ($env:KLYX_PRODUCTION_DEPLOY_AUTHORITY -ne 'central-klyx-chat') {
    Fail 'KLYX_PRODUCTION_DEPLOY_AUTHORITY must equal central-klyx-chat for a production deployment.'
  }

  # Build remotely on Vercel but keep the candidate staged. --skip-domain
  # prevents the production domains from moving before candidate verification.
  $deployOutput = Invoke-CheckedCapture npx vercel deploy --prod --skip-domain --yes `
    --meta "klyxMainSha=$sha" `
    --meta 'klyxReleaseSource=central-klyx-chat'

  $deploymentUrl = $deployOutput |
    Where-Object { $_ -match 'https://[^\s]+\.vercel\.app' } |
    ForEach-Object { [regex]::Match($_, 'https://[^\s]+\.vercel\.app').Value } |
    Select-Object -Last 1

  if ([string]::IsNullOrWhiteSpace($deploymentUrl)) {
    Fail 'Vercel staged deployment completed without an immutable deployment URL in CLI output.'
  }

  # Filter by the exact release metadata. A failed query invalidates the release.
  $metadataLookup = Invoke-CheckedCapture npx vercel list --prod --meta "klyxMainSha=$sha"
  if (($metadataLookup -join [Environment]::NewLine) -notmatch [regex]::Escape(($deploymentUrl -replace '^https://', ''))) {
    Fail "Could not verify klyxMainSha metadata for staged deployment $deploymentUrl."
  }

  # Vercel CLI authentication lets this check work even when the immutable
  # deployment URL is protected. Fail on any HTTP 4xx/5xx before promotion.
  $healthOutput = Invoke-CheckedCapture npx vercel curl "$deploymentUrl/api/health" --fail-with-body --silent --show-error
  $healthText = ($healthOutput -join [Environment]::NewLine).Trim()
  try {
    $healthPayload = $healthText | ConvertFrom-Json
  }
  catch {
    Fail "Staged /api/health did not return valid JSON: $healthText"
  }

  if (
    $healthPayload.status -ne 'ok' -or
    $healthPayload.service -ne 'klyx' -or
    $healthPayload.check -ne 'liveness'
  ) {
    Fail "Staged /api/health payload is invalid: $healthText"
  }

  [void](Invoke-CheckedCapture npx vercel curl "$deploymentUrl/" --fail-with-body --silent --show-error)

  # A build can take long enough for main to move. Re-fetch immediately before
  # promotion; if main changed, leave the candidate staged and abort.
  $shaBeforePromotion = Assert-ExactMainAndCleanTree
  if ($shaBeforePromotion -ne $sha) {
    Fail "Main moved during the staged deployment build. Expected $sha, got $shaBeforePromotion."
  }

  Invoke-Checked npx vercel promote $deploymentUrl --yes

  $env:KLYX_PRODUCTION_URL = $ProductionOrigin
  Invoke-Checked npm run ops:smoke

  [pscustomobject]@{
    status = 'KLYX_DEPLOYMENT_GATE_OK'
    mainSha = $sha
    deploymentUrl = $deploymentUrl
    productionOrigin = $ProductionOrigin
    shaMetadata = 'verified'
    stagedHealth = 'verified'
    promotion = 'verified'
    health = 'verified'
  } | ConvertTo-Json -Compress | Write-Host
}
finally {
  Pop-Location
}
