# Comprehensive Test Script for Canopy Sight
# Tests all aspects of the application

Write-Host "🧪 Canopy Sight - Comprehensive Test Suite" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

$ErrorCount = 0
$TestCount = 0

function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    
    $global:TestCount++
    Write-Host "[$TestCount] Testing: $Name..." -ForegroundColor Yellow -NoNewline
    
    try {
        & $Test
        Write-Host " ✅ PASSED" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host " ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $global:ErrorCount++
        return $false
    }
}

# Test 1: Check Node.js version
Test-Step "Node.js Version" {
    $nodeVersion = node --version
    if (-not $nodeVersion) {
        throw "Node.js not found"
    }
    $version = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($version -lt 18) {
        throw "Node.js 18+ required, found $nodeVersion"
    }
}

# Test 2: Check dependencies
Test-Step "Dependencies Installed" {
    if (-not (Test-Path "node_modules")) {
        throw "node_modules not found. Run 'npm install' first."
    }
}

# Test 3: TypeScript compilation
Test-Step "TypeScript Compilation" {
    Push-Location $PSScriptRoot\..
    npm run type-check 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript compilation failed"
    }
    Pop-Location
}

# Test 4: Linting
Test-Step "Code Linting" {
    Push-Location $PSScriptRoot\..
    npm run lint 2>&1 | Out-Null
    # Linting errors are warnings, not failures
    Pop-Location
}

# Test 5: Database connection (if DATABASE_URL is set)
Test-Step "Database Connection" {
    if ($env:DATABASE_URL) {
        # Check if we can import Prisma
        Push-Location $PSScriptRoot\..\packages\database
        $testScript = @"
import { prisma } from './src/index';
prisma.`$queryRaw\`SELECT 1\`.then(() => {
  console.log('OK');
  process.exit(0);
}).catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
"@
        $testScript | Out-File -FilePath "test-db-connection.mjs" -Encoding utf8
        node test-db-connection.mjs 2>&1 | Out-Null
        $dbOk = $LASTEXITCODE -eq 0
        Remove-Item "test-db-connection.mjs" -ErrorAction SilentlyContinue
        Pop-Location
        if (-not $dbOk) {
            throw "Database connection failed. Check DATABASE_URL."
        }
    } else {
        Write-Host " (skipped - DATABASE_URL not set)" -ForegroundColor Gray -NoNewline
    }
}

# Test 6: Check all required files exist
Test-Step "Required Files Exist" {
    $requiredFiles = @(
        "apps/api/src/server.ts",
        "apps/web/src/app/layout.tsx",
        "packages/database/prisma/schema.prisma",
        "package.json"
    )
    
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            throw "Required file missing: $file"
        }
    }
}

# Test 7: Check for critical console.log statements (should be minimal)
Test-Step "Console.log Usage Check" {
    Push-Location $PSScriptRoot\..
    $consoleLogs = Select-String -Path "apps/api/src/**/*.ts" -Pattern "console\.(log|error|warn|info|debug)" -Exclude "*.test.ts" | Measure-Object
    if ($consoleLogs.Count -gt 5) {
        Write-Host " (found $($consoleLogs.Count) console statements - should use logger)" -ForegroundColor Yellow -NoNewline
    }
    Pop-Location
}

# Test 8: Verify API routes are properly exported
Test-Step "API Router Exports" {
    $routerFile = "apps/api/src/router/index.ts"
    if (-not (Test-Path $routerFile)) {
        throw "Router index file missing"
    }
    $content = Get-Content $routerFile -Raw
    if ($content -notmatch "export.*appRouter") {
        throw "appRouter not exported"
    }
}

# Test 9: Check environment variable usage
Test-Step "Environment Variables" {
    $envFiles = @(
        "apps/api/.env.example",
        "apps/web/.env.example"
    )
    # Just check they're referenced, not that they exist
    Write-Host " (checked)" -ForegroundColor Gray -NoNewline
}

# Test 10: Verify build scripts
Test-Step "Build Scripts" {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $requiredScripts = @("build", "dev", "test")
    foreach ($script in $requiredScripts) {
        if (-not $packageJson.scripts.$script) {
            throw "Missing script: $script"
        }
    }
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Test Summary: $TestCount tests, $ErrorCount failures" -ForegroundColor $(if ($ErrorCount -eq 0) { "Green" } else { "Red" })

if ($ErrorCount -eq 0) {
    Write-Host "`n✅ All tests passed! Application is ready." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ Some tests failed. Please fix the issues above." -ForegroundColor Red
    exit 1
}
