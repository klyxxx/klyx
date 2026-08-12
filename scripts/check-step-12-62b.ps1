$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "CHECK KLYX 12.62b - Assistant Readiness UI"
Write-Host ""

$candidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$targetPath = $null

foreach ($candidate in $candidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $candidateContent = [System.IO.File]::ReadAllText($candidate)

    if (
        $candidateContent.Contains("KLYX_ASSISTANT_READINESS_UI_12_62") -or
        $candidateContent.Contains("/api/brain/respond")
    ) {
        $targetPath = $candidate
        break
    }
}

if (-not $targetPath) {
    throw "Interface assistant KLYX introuvable."
}

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BrainReadinessCard.tsx"

if (-not (Test-Path -LiteralPath $componentPath)) {
    throw "BrainReadinessCard.tsx introuvable."
}

$page = [System.IO.File]::ReadAllText($targetPath)
$component = [System.IO.File]::ReadAllText($componentPath)

function Compact-Code {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $builder = New-Object System.Text.StringBuilder

    foreach ($char in $Text.ToCharArray()) {
        if (-not [char]::IsWhiteSpace($char)) {
            [void]$builder.Append($char)
        }
    }

    return $builder.ToString()
}

function Count-Literal {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $count = 0
    $position = 0

    while ($true) {
        $index = $Text.IndexOf(
            $Value,
            $position,
            [System.StringComparison]::Ordinal
        )

        if ($index -lt 0) {
            break
        }

        $count++
        $position = $index + $Value.Length
    }

    return $count
}

$pageCompact = Compact-Code $page
$componentCompact = Compact-Code $component

$checks = @(
    @{
        Name = "page 12.62 marker"
        Value = $page.Contains(
            "KLYX_ASSISTANT_READINESS_UI_12_62"
        )
    },
    @{
        Name = "page marker unique"
        Value = (
            (Count-Literal `
                -Text $page `
                -Value "KLYX_ASSISTANT_READINESS_UI_12_62") -eq 1
        )
    },
    @{
        Name = "component 12.62 marker"
        Value = $component.Contains(
            "KLYX_READINESS_CARD_12_62"
        )
    },
    @{
        Name = "BrainReadinessCard imported"
        Value = $page.Contains(
            "BrainReadinessCard"
        )
    },
    @{
        Name = "BrainReadinessViewModel imported"
        Value = $page.Contains(
            "BrainReadinessViewModel"
        )
    },
    @{
        Name = "BrainPayload readiness"
        Value = $pageCompact.Contains(
            "readiness?:BrainReadinessViewModel;"
        )
    },
    @{
        Name = "readiness condition rendered"
        Value = $pageCompact.Contains(
            "{payload?.readiness&&("
        )
    },
    @{
        Name = "readiness passed to component"
        Value = $pageCompact.Contains(
            "readiness={payload.readiness}"
        )
    },
    @{
        Name = "confirm uses existing flow"
        Value = $pageCompact.Contains(
            "onConfirm={openResults}"
        )
    },
    @{
        Name = "edit handler connected"
        Value = $pageCompact.Contains(
            "onEdit={editCurrentRequest}"
        )
    },
    @{
        Name = "editCurrentRequest exists"
        Value = $pageCompact.Contains(
            "functioneditCurrentRequest(){"
        )
    },
    @{
        Name = "readiness score supported"
        Value = $componentCompact.Contains(
            "score:number;"
        )
    },
    @{
        Name = "readiness complete state supported"
        Value = $componentCompact.Contains(
            "isComplete:boolean;"
        )
    },
    @{
        Name = "remaining count supported"
        Value = $componentCompact.Contains(
            "remainingCount:number;"
        )
    },
    @{
        Name = "progress uses safeScore"
        Value = (
            $component.Contains("safeScore") -and
            $component.Contains("width:")
        )
    },
    @{
        Name = "service summary rendered"
        Value = $componentCompact.Contains(
            "{readiness.summary.service}"
        )
    },
    @{
        Name = "city summary rendered"
        Value = $componentCompact.Contains(
            "{readiness.summary.city}"
        )
    },
    @{
        Name = "date summary rendered"
        Value = $componentCompact.Contains(
            "{readiness.summary.date}"
        )
    },
    @{
        Name = "time summary rendered"
        Value = $componentCompact.Contains(
            "{readiness.summary.time}"
        )
    },
    @{
        Name = "explicit confirmation visible"
        Value = (
            $component.Contains("confirmation") -and
            $component.Contains("avant toute action")
        )
    },
    @{
        Name = "confirm button exists"
        Value = $component.Contains(
            "Confirmer"
        )
    },
    @{
        Name = "edit button exists"
        Value = $component.Contains(
            "Modifier"
        )
    },
    @{
        Name = "no automatic market publication"
        Value = -not $component.Contains(
            "/api/brain/market-publish"
        )
    },
    @{
        Name = "brain API still connected"
        Value = $page.Contains(
            "/api/brain/respond"
        )
    }
)

$failed = @()

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed += $check.Name
    }
}

Write-Host ""
Write-Host "Interface : $targetPath"
Write-Host "Composant : $componentPath"
Write-Host ""

if ($failed.Count -gt 0) {
    Write-Host "======================================"
    Write-Host "ECHECS REELS DETECTES"
    Write-Host "======================================"

    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    Write-Host ""
    throw "KLYX 12.62b static checker FAILED."
}

Write-Host "Tous les controles structurels sont OK."
Write-Host ""
Write-Host "Lancement npm run build..."
Write-Host ""

Push-Location $projectRoot

try {
    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "npm run build a echoue avec le code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.62 CHECK OK"
Write-Host "Assistant Readiness UI operationnel."
Write-Host "Progression et confirmation visibles."
Write-Host "Aucune publication automatique."
Write-Host "======================================"
Write-Host ""