$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$targets = @(
  "app\api\stripe\create-checkout-session\route.ts",
  "app\api\stripe\connect\create-account\route.ts",
  "app\api\stripe\connect\status\route.ts",
  "app\api\stripe\webhook\route.ts"
)

foreach ($relative in $targets) {
  $file = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $relative"
  }

  $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8

  if (-not $content.Contains('from "@/lib/stripe-runtime"')) {
    $firstImport = 'import { NextResponse } from "next/server";'
    $runtimeImport =
      'import { assertStripeRuntimeReady } from "@/lib/stripe-runtime";'

    if (-not $content.Contains($firstImport)) {
      throw "Import NextResponse introuvable : $relative"
    }

    $content = $content.Replace(
      $firstImport,
      $firstImport + "`r`n" + $runtimeImport
    )
  }

  if (-not $content.Contains("assertStripeRuntimeReady();")) {
    if ($relative -like "*webhook*") {
      $anchor = @'
  let stripe: Stripe;
  let webhookSecret: string;

  try {
'@
      $replacement = @'
  let stripe: Stripe;
  let webhookSecret: string;

  try {
    assertStripeRuntimeReady();
'@
    }
    elseif ($relative -like "*status*") {
      $anchor = @'
export async function GET(request: Request) {
  try {
'@
      $replacement = @'
export async function GET(request: Request) {
  try {
    assertStripeRuntimeReady();
'@
    }
    else {
      $anchor = @'
export async function POST(request: Request) {
  try {
'@
      $replacement = @'
export async function POST(request: Request) {
  try {
    assertStripeRuntimeReady();
'@
    }

    if (-not $content.Contains($anchor)) {
      throw "Point d'insertion introuvable : $relative"
    }

    $content = $content.Replace($anchor, $replacement)
  }

  Set-Content -LiteralPath $file -Value $content -Encoding UTF8
  Write-Host "[OK] $relative" -ForegroundColor Green
}

Write-Host ""
Write-Host "ETAPE 8.7 APPLIQUEE." -ForegroundColor Green
Write-Host "Verrou Stripe test/live actif."
Write-Host "Etape 8 terminee apres build et test."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
