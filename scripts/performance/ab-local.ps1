param(
  [string]$Url = "http://127.0.0.1:3000/login",
  [int]$Requests = 200,
  [int]$Concurrency = 10,
  [int]$TimeoutSeconds = 15
)

$ErrorActionPreference = "Stop"

if ($Requests -lt 1 -or $Requests -gt 10000) {
  throw "KLYX ab guard: Requests must be between 1 and 10000."
}

if ($Concurrency -lt 1 -or $Concurrency -gt 100) {
  throw "KLYX ab guard: Concurrency must be between 1 and 100."
}

if ($Concurrency -gt $Requests) {
  throw "KLYX ab guard: Concurrency cannot exceed Requests."
}

try {
  $target = [System.Uri]$Url
} catch {
  throw "KLYX ab guard: invalid URL."
}

$allowedHosts = @("127.0.0.1", "localhost", "::1")
if ($target.Scheme -notin @("http", "https")) {
  throw "KLYX ab guard: only HTTP/HTTPS targets are allowed."
}

if ($target.Host -notin $allowedHosts) {
  throw "KLYX ab guard: remote targets are forbidden by this official benchmark wrapper. Use a dedicated isolated environment, never production."
}

$ab = Get-Command ab -ErrorAction SilentlyContinue
if (-not $ab) {
  throw "ApacheBench (ab) is not installed. Install Apache HTTP Server utilities first."
}

Write-Host "KLYX ApacheBench diagnostic"
Write-Host "Target      : $Url"
Write-Host "Requests    : $Requests"
Write-Host "Concurrency : $Concurrency"
Write-Host "Safety      : loopback-only"

& $ab.Source -n $Requests -c $Concurrency -s $TimeoutSeconds -k $Url

if ($LASTEXITCODE -ne 0) {
  throw "ApacheBench failed with exit code $LASTEXITCODE."
}
