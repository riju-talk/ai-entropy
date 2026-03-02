#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Package the NOVYRA AI Engine for AWS Lambda deployment.

.DESCRIPTION
    1. Installs Python dependencies into a dist/ package directory.
    2. Copies application source code.
    3. Creates lambda-package.zip ready for upload.

    Run from: infrastructure/lambda/
    Or via:   npm run build:lambda   (from project root if added to turbo.json)

.EXAMPLE
    .\build.ps1 -Stage dev
    .\build.ps1 -Stage prod -UploadToS3 -Bucket my-artifacts-bucket
#>

param(
    [ValidateSet("dev","staging","prod")]
    [string] $Stage      = "dev",
    [switch] $UploadToS3,
    [string] $Bucket     = "novyra-artifacts-$((aws sts get-caller-identity --query Account --output text))"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root        = Resolve-Path "../../apps/ai-agent"
$DistDir     = "$PSScriptRoot/dist"
$ZipOutput   = "$PSScriptRoot/lambda-package.zip"

Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NOVYRA Lambda Package Builder — Stage: $Stage" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

# ── 1. Clean dist ─────────────────────────────────────────────────────────────
Write-Host "`n[1/4] Cleaning dist..." -ForegroundColor Yellow
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
New-Item -ItemType Directory -Path $DistDir | Out-Null

# ── 2. Install Python dependencies ────────────────────────────────────────────
Write-Host "[2/4] Installing Python dependencies (boto3 excluded — provided by Lambda runtime)..." -ForegroundColor Yellow
$ReqFile = "$Root/requirements.txt"
pip install `
    --target $DistDir `
    --platform manylinux2014_x86_64 `
    --implementation cp `
    --python-version 3.11 `
    --only-binary=:all: `
    -r $ReqFile `
    --no-deps 2>&1 | Select-String -NotMatch "^(WARNING|NOTICE)"

# boto3 + botocore are provided by Lambda — remove if accidentally installed
"boto3","botocore" | ForEach-Object {
    $dir = "$DistDir/$_"
    if (Test-Path $dir) {
        Remove-Item $dir -Recurse -Force
        Write-Host "  Removed $_ (Lambda-provided)" -ForegroundColor DarkGray
    }
}

# ── 3. Copy application source ────────────────────────────────────────────────
Write-Host "[3/4] Copying application source..." -ForegroundColor Yellow
$Exclude = @("__pycache__",".venv",".env*","*.pyc","tests","*.md","dist","node_modules")
Get-ChildItem $Root | Where-Object {
    $_.Name -notin $Exclude -and $_.Name -notlike "*.pyc"
} | Copy-Item -Destination $DistDir -Recurse -Force

# ── 4. Zip ────────────────────────────────────────────────────────────────────
Write-Host "[4/4] Creating $ZipOutput..." -ForegroundColor Yellow
if (Test-Path $ZipOutput) { Remove-Item $ZipOutput -Force }
Compress-Archive -Path "$DistDir/*" -DestinationPath $ZipOutput

$SizeMB = [math]::Round((Get-Item $ZipOutput).Length / 1MB, 2)
Write-Host "`n✅ lambda-package.zip created ($SizeMB MB)" -ForegroundColor Green

# ── Optional S3 Upload ────────────────────────────────────────────────────────
if ($UploadToS3) {
    Write-Host "`nUploading to s3://$Bucket/lambda-package.zip ..." -ForegroundColor Yellow
    aws s3 cp $ZipOutput "s3://$Bucket/lambda-package.zip"
    Write-Host "✅ Uploaded to S3" -ForegroundColor Green
}

Write-Host "`nDeploy with:" -ForegroundColor Cyan
Write-Host "  cd infrastructure/cdk && npm run deploy:$Stage" -ForegroundColor White
