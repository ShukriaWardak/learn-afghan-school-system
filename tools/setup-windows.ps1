# LEARN Afghan — local Windows/XAMPP assistant (development only)
# Does not edit existing database rows, import SQL, or modify Git branches.
# Creates a first administrator or resets an authorized account only after Y confirmation.
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$php = 'C:\xampp\php\php.exe'
$checker = Join-Path $project 'check-setup.php'
$reset = Join-Path $project 'reset-local-login.php'
$firstAdmin = Join-Path $project 'backend\cli\first_admin.php'
$htdocs = 'C:\xampp\htdocs'
$relative = $null
$dashboard = $null
$setupPage = $null

if ($project.StartsWith(($htdocs.TrimEnd('\') + '\'), [StringComparison]::OrdinalIgnoreCase)) {
    $relative = $project.Substring($htdocs.TrimEnd('\').Length).TrimStart('\').Replace('\', '/')
    $dashboard = "http://localhost/$relative/index.html"
    $setupPage = "http://localhost/$relative/check-setup.php"
}

function Show-Checks($report) {
    foreach ($check in $report.checks) {
        $color = if ($check.status -eq 'pass') { 'Green' } elseif ($check.status -eq 'waiting') { 'Yellow' } else { 'Red' }
        Write-Host ('[{0}] {1}' -f $check.status.ToUpperInvariant(), $check.title) -ForegroundColor $color
        if ($check.status -ne 'pass') { Write-Host ('    ' + $check.detail) }
    }
}

function Get-Report {
    $output = & $php $checker 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "Local checker failed: $output" }
    return ($output | ConvertFrom-Json -ErrorAction Stop)
}

function New-HiddenPassword {
    $secret = Read-Host 'Enter a new password (hidden; 12-72 UTF-8 bytes)' -AsSecureString
    $value = [System.Net.NetworkCredential]::new('', $secret).Password
    $secret = $null
    $bytes = [System.Text.Encoding]::UTF8.GetByteCount($value)
    if ($bytes -lt 12 -or $bytes -gt 72) {
        Write-Host 'Password must be 12-72 UTF-8 bytes; nothing was changed.' -ForegroundColor Red
        return $null
    }
    return $value
}

Write-Host 'LEARN Afghan | Windows XAMPP setup' -ForegroundColor Cyan
Write-Host "Project: $project"
Write-Host 'No migrations or database resets will be run. Keep real student data out of this development system.'

if (-not (Test-Path -LiteralPath $php -PathType Leaf)) {
    Write-Host "Cannot find XAMPP PHP at $php. Check your XAMPP installation." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path -LiteralPath $checker -PathType Leaf)) {
    Write-Host 'This folder has no check-setup.php. Check the project you downloaded.' -ForegroundColor Red
    exit 1
}
Push-Location $project
try {
    if (-not (Test-Path '.\backend\config.local.php')) {
        Write-Host 'Missing backend/config.local.php.' -ForegroundColor Red
        Write-Host 'Copy backend/config.example.php to backend/config.local.php and enter your LOCAL MySQL credentials.'
        Write-Host 'This helper deliberately does not guess database credentials.'
        exit 1
    }

    Write-Host ''
    Write-Host 'Checking PHP, MySQL, tables and administrator...' -ForegroundColor Cyan
    $report = Get-Report
    Show-Checks $report
    $blocked = @($report.checks | Where-Object { $_.id -ne 'admin' -and $_.status -ne 'pass' })
    $admin = @($report.checks | Where-Object { $_.id -eq 'admin' } | Select-Object -First 1)
    if ($blocked.Count -gt 0) {
        Write-Host 'Fix the failed setup checks above before creating any accounts.' -ForegroundColor Yellow
    } elseif ($admin.Count -gt 0 -and $admin[0].status -eq 'fail' -and $admin[0].detail -like '*first administrator has not been created*') {
        Write-Host ''
        if ((Read-Host 'Create the FIRST local super admin? Type Y to confirm') -ieq 'Y') {
            $username = Read-Host 'Admin username (Enter for fatima_admin)'
            if ([string]::IsNullOrWhiteSpace($username)) { $username = 'fatima_admin' }
            $name = Read-Host 'Display name (Enter for LEARN Afghan Administrator)'
            if ([string]::IsNullOrWhiteSpace($name)) { $name = 'LEARN Afghan Administrator' }
            if ($username -notmatch '^[A-Za-z0-9_.-]{3,100}$' -or $name.Trim().Length -eq 0 -or $name.Length -gt 180) {
                Write-Host 'Invalid username or display name. No account created.' -ForegroundColor Red
            } else {
                $password = New-HiddenPassword
                if ($null -ne $password) {
                    try {
                        $env:LEARN_FIRST_ADMIN_USERNAME = $username
                        $env:LEARN_FIRST_ADMIN_NAME = $name
                        $env:LEARN_FIRST_ADMIN_PASSWORD = $password
                        $env:LEARN_FIRST_ADMIN_CONFIG = Join-Path $project 'backend\config.local.php'
                        & $php $firstAdmin
                        if ($LASTEXITCODE -ne 0) { Write-Host 'Administrator creation did not succeed.' -ForegroundColor Red }
                    } finally {
                        Remove-Item Env:\LEARN_FIRST_ADMIN_USERNAME, Env:\LEARN_FIRST_ADMIN_NAME, Env:\LEARN_FIRST_ADMIN_PASSWORD, Env:\LEARN_FIRST_ADMIN_CONFIG -ErrorAction SilentlyContinue
                        $password = $null
                    }
                }
            }
        }
    } elseif ($admin.Count -gt 0 -and $admin[0].status -eq 'pass') {
        Write-Host 'An active administrator already exists. The first-admin helper will not replace it.' -ForegroundColor Green
        if ((Read-Host 'Need to reset an existing authorized login? Type Y to confirm') -ieq 'Y') {
            if (-not (Test-Path -LiteralPath $reset)) {
                Write-Host 'reset-local-login.php is missing; no password was changed.' -ForegroundColor Red
            } else {
                & $php $reset --list
                if ($LASTEXITCODE -eq 0) {
                    $username = Read-Host 'Enter an active account username from the list'
                    if (-not [string]::IsNullOrWhiteSpace($username) -and
                        (Read-Host "Confirm password reset for account '$username'? Type Y") -ieq 'Y') {
                        $password = New-HiddenPassword
                        if ($null -ne $password) {
                            try {
                                $env:LEARN_RESET_USERNAME = $username
                                $env:LEARN_RESET_PASSWORD = $password
                                & $php $reset
                            } finally {
                                Remove-Item Env:\LEARN_RESET_USERNAME, Env:\LEARN_RESET_PASSWORD -ErrorAction SilentlyContinue
                                $password = $null
                            }
                        }
                    }
                }
            }
        }
    } else {
        Write-Host 'An existing administrator requires manual review. No account was modified.' -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host 'Final setup checks:' -ForegroundColor Cyan
    $report = Get-Report
    Show-Checks $report
    if ($report.ready) {
        Write-Host 'Basic local setup checks passed; test sign-in and database persistence next.' -ForegroundColor Green
        if ($dashboard) {
            Write-Host "Dashboard: $dashboard"
            Start-Process $dashboard
        }
    } else {
        Write-Host 'Some checks still need attention; this is not yet a verified working installation.' -ForegroundColor Yellow
        if ($setupPage) { Write-Host "Checker: $setupPage"; Start-Process $setupPage }
    }
} catch {
    Write-Host ('Setup helper error: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
