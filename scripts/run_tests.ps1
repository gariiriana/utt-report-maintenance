# ═══════════════════════════════════════════════════════════════════════════════
# UTT Report Maintenance — Automation Test Runner
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "  =======================================================" -ForegroundColor Cyan
Write-Host "  |   UTT REPORT MAINTENANCE - AUTOMATION TEST SUITE    |" -ForegroundColor Cyan
Write-Host "  |          Powered by Go Testing Framework            |" -ForegroundColor DarkGray
Write-Host "  =======================================================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

# Save original directory
$originalDir = Get-Location

# Navigate to backend directory relative to the script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "../backend"

if (Test-Path $backendDir) {
    Set-Location $backendDir
}

# Run Go tests with verbose + JSON output
$rawOutput = & go test -v -count=1 -json ./core/... 2>&1

# Return to original directory
Set-Location $originalDir

$passed = 0
$failed = 0
$skipped = 0
$total = 0
$catPassed = @{}
$catFailed = @{}
$failedTests = @()

foreach ($line in $rawOutput) {
    $lineStr = "$line".Trim()
    if ($lineStr -eq "") { continue }
    
    try {
        $obj = $lineStr | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($null -eq $obj) { continue }
        if ($null -eq $obj.Test) { continue }
        
        $pkg = ""
        if ($obj.Package -match "/([^/]+)$") { $pkg = $Matches[1] }
        
        if ($obj.Action -eq "pass") {
            $passed++
            $total++
            if (-not $catPassed.ContainsKey($pkg)) { $catPassed[$pkg] = 0 }
            $catPassed[$pkg]++
        }
        elseif ($obj.Action -eq "fail") {
            $failed++
            $total++
            $failedTests += $obj.Test
            if (-not $catFailed.ContainsKey($pkg)) { $catFailed[$pkg] = 0 }
            $catFailed[$pkg]++
        }
        elseif ($obj.Action -eq "skip") {
            $skipped++
            $total++
        }
    } catch { }
}

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

# ─── Category name mapping ────────────────────────────────────────────────────
$displayNames = @{
    "config"      = "Config & Environment"
    "models"      = "Model Serialization"
    "services"    = "AI Agent Pipeline & Edge Cases"
    "controllers" = "API Validation & Error Recovery"
}

# ─── Display Results by Category ──────────────────────────────────────────────
Write-Host "  Test Results by Category:" -ForegroundColor White
Write-Host "  -------------------------------------------------------" -ForegroundColor DarkGray

$allPkgs = @($catPassed.Keys) + @($catFailed.Keys) | Sort-Object -Unique
foreach ($pkg in $allPkgs) {
    $p = 0; if ($catPassed.ContainsKey($pkg)) { $p = $catPassed[$pkg] }
    $f = 0; if ($catFailed.ContainsKey($pkg)) { $f = $catFailed[$pkg] }
    $c = $p + $f
    
    $name = $pkg
    if ($displayNames.ContainsKey($pkg)) { $name = $displayNames[$pkg] }
    
    if ($f -eq 0) {
        Write-Host "    v " -ForegroundColor Green -NoNewline
        Write-Host "[$name]" -ForegroundColor White -NoNewline
        Write-Host " $p/$c passed" -ForegroundColor DarkGray
    } else {
        Write-Host "    x " -ForegroundColor Red -NoNewline
        Write-Host "[$name]" -ForegroundColor White -NoNewline
        Write-Host " $p/$c passed, $f failed" -ForegroundColor Red
    }
}

Write-Host ""

# ─── Failed Tests ─────────────────────────────────────────────────────────────
if ($failedTests.Count -gt 0) {
    Write-Host "  x Failed Tests:" -ForegroundColor Red
    foreach ($ft in $failedTests) {
        Write-Host "    - $ft" -ForegroundColor Red
    }
    Write-Host ""
}

# ─── Final Summary ────────────────────────────────────────────────────────────
Write-Host "  =======================================================" -ForegroundColor Cyan
Write-Host "  |                    Test Summary                      |" -ForegroundColor Cyan
Write-Host "  =======================================================" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "  Result:     PASSED" -ForegroundColor Green
} else {
    Write-Host "  Result:     FAILED" -ForegroundColor Red
}
Write-Host "  Passed:     $passed" -ForegroundColor Green

if ($failed -eq 0) {
    Write-Host "  Failed:     $failed" -ForegroundColor Green
} else {
    Write-Host "  Failed:     $failed" -ForegroundColor Red
}

Write-Host "  Skipped:    $skipped" -ForegroundColor Yellow
Write-Host "  Total:      $total" -ForegroundColor White
Write-Host "  Duration:   $([math]::Round($duration, 2))s" -ForegroundColor White
Write-Host "  =======================================================" -ForegroundColor Cyan

Write-Host ""
if ($failed -eq 0) {
    Write-Host "  v All $total tests passed! Ready for deployment" -ForegroundColor Green
} else {
    Write-Host "  x $failed test(s) failed. Fix issues before deployment." -ForegroundColor Red
}
Write-Host ""

exit $failed
