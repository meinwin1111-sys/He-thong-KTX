param(
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$Db = "KTX_Group3_test"
)

$ErrorActionPreference = "Continue"
chcp 65001 | Out-Null
Set-Location (Split-Path -Parent $PSScriptRoot)

$checks = New-Object System.Collections.Generic.List[object]
$npmLog = "C:\Temp\npm_test_auto.out"
$fixtureLog = "C:\Temp\npm_test_fixture_auto.out"
$focusedLog = "C:\Temp\renewal_sql_auto.out"
$dbLog = "C:\Temp\renewal_db_auto.out"

function Add-Check {
    param([string]$Name, [bool]$Passed, [string]$Detail)
    $script:checks.Add([pscustomobject]@{
        Check = $Name
        Result = if ($Passed) { "PASS" } else { "FAIL" }
        Detail = $Detail
    })
}

function Read-TestCounts {
    param([string]$Path)
    $counts = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $counts
    }

    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        if ($line -match '(?:^|\s)(tests|pass|fail|skipped)\s+(\d+)\b') {
            $counts[$Matches[1]] = [int]$Matches[2]
        }
    }
    return $counts
}

function Get-TestSummary {
    param([hashtable]$Counts)
    foreach ($name in @("tests", "pass", "fail", "skipped")) {
        if (-not $Counts.ContainsKey($name)) {
            $Counts[$name] = -1
        }
    }
    return "tests=$($Counts.tests), pass=$($Counts.pass), fail=$($Counts.fail), skipped=$($Counts.skipped)"
}

$nodeOutput = & node --check api-contracts.test.cjs 2>&1
$nodeExitCode = $LASTEXITCODE
$nodeDetail = if ($nodeExitCode -eq 0) { "syntax check passed" } else { ($nodeOutput | Out-String).Trim() }
Add-Check "1. node --check api-contracts.test.cjs" ($nodeExitCode -eq 0) $nodeDetail

$diffOutput = & git diff --check 2>&1
$diffExitCode = $LASTEXITCODE
$diffDetail = if ($diffExitCode -eq 0) { "no whitespace errors" } else { ($diffOutput | Out-String).Trim() }
Add-Check "2. git diff --check" ($diffExitCode -eq 0) $diffDetail

$statusLines = @(& git status --short --untracked-files=all 2>&1)
$statusExitCode = $LASTEXITCODE
$forbiddenStatus = @($statusLines | Where-Object {
    $_ -match '(?i)(^|[\\/])\.env($|[\\/])|(^|[\\/])dist([\\/]|$)'
})
$statusClean = ($statusExitCode -eq 0 -and $forbiddenStatus.Count -eq 0)
$statusDetail = if ($statusExitCode -ne 0) {
    "git status failed: $($statusLines -join '; ')"
} elseif ($forbiddenStatus.Count -gt 0) {
    "forbidden paths: $($forbiddenStatus -join '; ')"
} else {
    "no .env or dist paths"
}
Add-Check "3. git status excludes .env/dist" $statusClean $statusDetail

$fixtureSnapshotScript = @'
require("dotenv").config();
const sql = require("mssql");
(async () => {
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    try {
        const result = await pool.request().query(`
            SELECT
                (SELECT COUNT_BIG(*) FROM dbo.TaiKhoan
                 WHERE Email LIKE N'b5-%@example.test') AS FixtureManagers,
                (SELECT COUNT_BIG(*) FROM dbo.TaiKhoan
                 WHERE Email LIKE N'T5%@%' OR Email LIKE N'GH-TEST-%') AS FixtureStudentAccounts,
                (SELECT COUNT_BIG(*) FROM dbo.SinhVien
                 WHERE MaSinhVien LIKE N'T5%') AS FixtureStudents,
                (SELECT COUNT_BIG(*) FROM dbo.SinhVien
                 WHERE MaSinhVien LIKE N'GH-TEST-%') AS FixtureGhStudents,
                (SELECT COUNT_BIG(*) FROM dbo.Phong
                 WHERE TenPhong LIKE N'T5-%') AS FixtureRooms,
                (SELECT COUNT_BIG(*) FROM dbo.Phong
                 WHERE TenPhong LIKE N'GH-TEST-%') AS FixtureGhRooms,
                (SELECT COUNT_BIG(*) FROM dbo.HopDong
                 WHERE TenPhong LIKE N'T5-%' OR TenPhong LIKE N'GH-TEST-%') AS FixtureContracts,
                (SELECT COUNT_BIG(*) FROM dbo.GiaHanHopDong g
                 INNER JOIN dbo.HopDong h ON h.MaHopDong = g.MaHopDong
                 WHERE h.TenPhong LIKE N'T5-%') AS FixtureRenewals,
                (SELECT COUNT_BIG(*) FROM dbo.GiaHanHopDong g
                 INNER JOIN dbo.HopDong h ON h.MaHopDong = g.MaHopDong
                 WHERE h.TenPhong LIKE N'GH-TEST-%') AS FixtureGhRenewals;
        `);
        console.log(JSON.stringify(result.recordset[0]));
    } finally {
        await pool.close();
    }
})().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
});
'@

function Read-DbFixtureSnapshot {
    $previousDbName = $env:DB_NAME
    $env:DB_NAME = $Db
    try {
        $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($fixtureSnapshotScript))
        $output = @(& node -e "eval(Buffer.from('$encoded','base64').toString('utf8'))" 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        if ($null -eq $previousDbName) {
            Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
        } else {
            $env:DB_NAME = $previousDbName
        }
    }
    if ($exitCode -ne 0) {
        return $null
    }
    foreach ($line in $output) {
        $lineText = [string]$line
        $jsonStart = $lineText.IndexOf("{")
        if ($jsonStart -ge 0) {
            try {
                return ($lineText.Substring($jsonStart) | ConvertFrom-Json)
            } catch {
                return $null
            }
        }
    }
    return $null
}

$fixturesBefore = Read-DbFixtureSnapshot
New-Item -ItemType Directory -Path "C:\Temp" -Force | Out-Null
$previousDbName = $env:DB_NAME
$env:DB_NAME = $Db
try {
    & npm.cmd test 2>&1 | Out-File -LiteralPath $npmLog -Encoding utf8
    $npmExitCode = $LASTEXITCODE
} finally {
    if ($null -eq $previousDbName) {
        Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
    } else {
        $env:DB_NAME = $previousDbName
    }
}
$npmCounts = Read-TestCounts $npmLog
$npmSummary = Get-TestSummary $npmCounts
$npmPassed = ($npmExitCode -eq 0 -and
    $npmCounts.tests -gt 0 -and
    $npmCounts.fail -eq 0 -and
    $npmCounts.skipped -eq 0 -and
    $npmCounts.pass -eq $npmCounts.tests)
Add-Check "4. npm test ($npmLog)" $npmPassed "$npmSummary; exit=$npmExitCode"

$previousDbName = $env:DB_NAME
$env:DB_NAME = $Db
$focusedNames = @(
    "real SQL member renewal approval leaves the effective end date unchanged",
    "real SQL member renewal activates through QR, webhook, and cash payment",
    "real SQL renewal rejects short and excess QR amounts without activation",
    "real SQL duplicate bank webhook activates a member renewal once",
    "real SQL overdue member renewal cancels before attempted QR payment",
    "real SQL second pending renewal for the same member is rejected",
    "real SQL activating one member renewal does not change another member end date",
    "real SQL pending renewal reserves room capacity and over-capacity approval returns 409",
    "real SQL contract remains active while any member has an effective end date",
    "real SQL early checkout cancels a pending member renewal and its invoice",
    "real SQL concurrent renewal approval and payment complete in five rounds without deadlock",
    "real SQL early checkout without renewals refunds 640000",
    "real SQL early checkout refunds each paid renewal period separately",
    "real SQL fixture cashout cleanup rejects non-T5 cashout data",
    "real SQL non-fixture paid surplus refund remains protected by its trigger after migration 040",
    "real SQL non-fixture invoiced incident cost remains protected by its trigger after migration 040"
)
$focusedPattern = $focusedNames -join "|"
try {
    & node --test --test-reporter=tap --test-name-pattern="$focusedPattern" api-contracts.test.cjs 2>&1 |
        Out-File -LiteralPath $focusedLog -Encoding utf8
    $focusedExitCode = $LASTEXITCODE
} finally {
    if ($null -eq $previousDbName) {
        Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
    } else {
        $env:DB_NAME = $previousDbName
    }
}
$focusedText = if (Test-Path -LiteralPath $focusedLog) {
    Get-Content -LiteralPath $focusedLog -Raw -Encoding UTF8
} else {
    ""
}
$focusedFailures = @($focusedNames | Where-Object {
    $focusedText -notmatch ("(?m)^ok \d+ - " + [regex]::Escape($_) + "(?:\s|$)") -or
        $focusedText -match ("(?m)^ok \d+ - " + [regex]::Escape($_) + ".*# SKIP")
})
$focusedFailedNames = @($focusedNames | Where-Object {
    $focusedText -match ("(?m)^not ok \d+ - " + [regex]::Escape($_) + "(?:\s|$)")
})
$focusedPassed = ($focusedExitCode -eq 0 -and
    $focusedFailures.Count -eq 0 -and
    $focusedFailedNames.Count -eq 0)
$focusedDetail = if ($focusedPassed) {
    "all named SQL tests passed"
} else {
    "exit=$focusedExitCode; missing/non-passing: $($focusedFailures -join '; '); failed: $($focusedFailedNames -join '; '); log=$focusedLog"
}
Add-Check "5. Both SQL early-checkout tests" $focusedPassed $focusedDetail

$previousDbName = $env:DB_NAME
$env:DB_NAME = $Db
try {
    & npm.cmd run test:fixture 2>&1 | Out-File -LiteralPath $fixtureLog -Encoding utf8
    $fixtureExitCode = $LASTEXITCODE
} finally {
    if ($null -eq $previousDbName) {
        Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
    } else {
        $env:DB_NAME = $previousDbName
    }
}
$fixtureCounts = Read-TestCounts $fixtureLog
$fixtureSummary = Get-TestSummary $fixtureCounts
$fixturePassed = ($fixtureExitCode -eq 0 -and
    $fixtureCounts.tests -eq 2 -and
    $fixtureCounts.pass -eq 2 -and
    $fixtureCounts.fail -eq 0 -and
    $fixtureCounts.skipped -eq 0)
Add-Check "6. npm run test:fixture ($fixtureLog)" $fixturePassed "$fixtureSummary; exit=$fixtureExitCode"

$dbScript = @'
require("dotenv").config();
const sql = require("mssql");
(async () => {
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    try {
        const result = await pool.request()
            .input("ManagerPattern", sql.VarChar(100), "b5-%@example.test")
            .input("StudentPattern", sql.NVarChar(30), "T5%")
            .input("RoomPattern", sql.NVarChar(50), "T5-%")
            .query(`
                SELECT
                    CASE WHEN OBJECT_ID(N'dbo.GiaHanHopDong', N'U') IS NOT NULL THEN 1 ELSE 0 END AS GiaHanHopDong,
                    CASE WHEN OBJECT_ID(N'dbo.sp_DuyetGiaHan', N'P') IS NOT NULL THEN 1 ELSE 0 END AS sp_DuyetGiaHan,
                    CASE WHEN OBJECT_ID(N'dbo.sp_KichHoatGiaHan', N'P') IS NOT NULL THEN 1 ELSE 0 END AS sp_KichHoatGiaHan,
                    CASE WHEN OBJECT_ID(N'dbo.sp_HuyGiaHanQuaHan', N'P') IS NOT NULL THEN 1 ELSE 0 END AS sp_HuyGiaHanQuaHan,
                    CASE WHEN OBJECT_ID(N'dbo.sp_CapNhatHopDong', N'P') IS NOT NULL THEN 1 ELSE 0 END AS sp_CapNhatHopDong,
                    CASE WHEN OBJECT_ID(N'dbo.sp_DuyetTraPhongSom', N'P') IS NOT NULL THEN 1 ELSE 0 END AS sp_DuyetTraPhongSom,
                    CASE WHEN OBJECT_ID(N'dbo.sp_HuyPhieuChiFixtureKiemThu', N'P') IS NOT NULL THEN 1 ELSE 0 END AS sp_HuyPhieuChiFixtureKiemThu;
                IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
                    SELECT 0 AS Migration032, 0 AS Migration033, 0 AS Migration034, 0 AS Migration035,
                           0 AS Migration036, 0 AS Migration037, 0 AS Migration038, 0 AS Migration039,
                           0 AS Migration040;
                ELSE
                    SELECT
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'032') THEN 1 ELSE 0 END AS Migration032,
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'033') THEN 1 ELSE 0 END AS Migration033,
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'034') THEN 1 ELSE 0 END AS Migration034,
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'035') THEN 1 ELSE 0 END AS Migration035,
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'036') THEN 1 ELSE 0 END AS Migration036,
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'037') THEN 1 ELSE 0 END AS Migration037,
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'038') THEN 1 ELSE 0 END AS Migration038,
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'039') THEN 1 ELSE 0 END AS Migration039,
                        CASE WHEN EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'040') THEN 1 ELSE 0 END AS Migration040;
                SELECT
                    (SELECT COUNT_BIG(*) FROM dbo.TaiKhoan WHERE Email LIKE @ManagerPattern) AS FixtureManagers,
                    (SELECT COUNT_BIG(*) FROM dbo.SinhVien WHERE MaSinhVien LIKE @StudentPattern) AS FixtureStudents,
                    (SELECT COUNT_BIG(*) FROM dbo.Phong WHERE TenPhong LIKE @RoomPattern) AS FixtureRooms,
                    (SELECT COUNT_BIG(*)
                     FROM dbo.GiaHanHopDong g
                     INNER JOIN dbo.HopDong h ON h.MaHopDong = g.MaHopDong
                     WHERE h.TenPhong LIKE @RoomPattern) AS FixtureRenewals,
                    (SELECT COUNT_BIG(*) FROM dbo.TaiKhoan
                     WHERE Email LIKE N'T5%@%' OR Email LIKE N'GH-TEST-%') AS FixtureStudentAccounts,
                    (SELECT COUNT_BIG(*) FROM dbo.HopDong
                     WHERE TenPhong LIKE N'T5-%' OR TenPhong LIKE N'GH-TEST-%') AS FixtureContracts,
                    (SELECT COUNT_BIG(*) FROM dbo.SinhVien
                     WHERE MaSinhVien LIKE N'GH-TEST-%') AS FixtureGhStudents,
                    (SELECT COUNT_BIG(*) FROM dbo.Phong
                     WHERE TenPhong LIKE N'GH-TEST-%') AS FixtureGhRooms,
                    (SELECT COUNT_BIG(*) FROM dbo.GiaHanHopDong g
                     INNER JOIN dbo.HopDong h ON h.MaHopDong = g.MaHopDong
                     WHERE h.TenPhong LIKE N'GH-TEST-%') AS FixtureGhRenewals;
            `);
        console.log(JSON.stringify({
            objects: result.recordsets[0][0],
            migrations: result.recordsets[1][0],
            fixtures: result.recordsets[2][0]
        }));
    } finally {
        await pool.close();
    }
})().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
});
'@

$previousDbName = $env:DB_NAME
$env:DB_NAME = $Db
try {
    $encodedDbScript = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($dbScript))
    & node -e "eval(Buffer.from('$encodedDbScript','base64').toString('utf8'))" 2>&1 |
        Out-File -LiteralPath $dbLog -Encoding utf8
    $dbExitCode = $LASTEXITCODE
} finally {
    if ($null -eq $previousDbName) {
        Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
    } else {
        $env:DB_NAME = $previousDbName
    }
}

$dbResult = $null
if (Test-Path -LiteralPath $dbLog) {
    foreach ($line in Get-Content -LiteralPath $dbLog -Encoding UTF8) {
        $jsonStart = $line.IndexOf("{")
        if ($jsonStart -ge 0) {
            try {
                $dbResult = $line.Substring($jsonStart) | ConvertFrom-Json
            } catch {
                $dbResult = $null
            }
        }
    }
}

$objectCount = 0
if ($null -ne $dbResult) {
    foreach ($property in @(
        "GiaHanHopDong", "sp_DuyetGiaHan", "sp_KichHoatGiaHan",
        "sp_HuyGiaHanQuaHan", "sp_CapNhatHopDong", "sp_DuyetTraPhongSom",
        "sp_HuyPhieuChiFixtureKiemThu"
    )) {
        if ([int]$dbResult.objects.$property -eq 1) {
            $objectCount++
        }
    }
}
$objectDetail = if ($null -eq $dbResult) {
    "could not read DB result; exit=$dbExitCode; log=$dbLog"
} else {
    "$objectCount/7 objects present"
}
Add-Check "6. Required renewal DB objects" ($dbExitCode -eq 0 -and $objectCount -eq 7) $objectDetail

$migrationCount = 0
if ($null -ne $dbResult) {
    foreach ($property in @(
        "Migration032", "Migration033", "Migration034", "Migration035",
        "Migration036", "Migration037", "Migration038", "Migration039",
        "Migration040"
    )) {
        if ([int]$dbResult.migrations.$property -eq 1) {
            $migrationCount++
        }
    }
}
$migrationDetail = if ($null -eq $dbResult) {
    "could not read migration state; exit=$dbExitCode; log=$dbLog"
} else {
    "$migrationCount/9 migrations recorded"
}
Add-Check "7. SchemaMigration 032-040" ($dbExitCode -eq 0 -and $migrationCount -eq 9) $migrationDetail

$fixtureCounts = @{}
if ($null -ne $dbResult) {
    $fixtureCounts = @{
        TaiKhoan = [int64]$dbResult.fixtures.FixtureManagers
        SinhVien = [int64]$dbResult.fixtures.FixtureStudents
        Phong = [int64]$dbResult.fixtures.FixtureRooms
        GiaHanHopDong = [int64]$dbResult.fixtures.FixtureRenewals
        TaiKhoanSinhVien = [int64]$dbResult.fixtures.FixtureStudentAccounts
        HopDong = [int64]$dbResult.fixtures.FixtureContracts
        SinhVienGh = [int64]$dbResult.fixtures.FixtureGhStudents
        PhongGh = [int64]$dbResult.fixtures.FixtureGhRooms
        GiaHanGh = [int64]$dbResult.fixtures.FixtureGhRenewals
    }
}
$fixtureNoIncrease = $true
$fixtureComparison = @()
if ($null -eq $fixturesBefore -or $null -eq $dbResult) {
    $fixtureNoIncrease = $false
} else {
    $beforeCounts = @{
        TaiKhoan = [int64]$fixturesBefore.FixtureManagers
        SinhVien = [int64]$fixturesBefore.FixtureStudents
        Phong = [int64]$fixturesBefore.FixtureRooms
        GiaHanHopDong = [int64]$fixturesBefore.FixtureRenewals
        TaiKhoanSinhVien = [int64]$fixturesBefore.FixtureStudentAccounts
        HopDong = [int64]$fixturesBefore.FixtureContracts
        SinhVienGh = [int64]$fixturesBefore.FixtureGhStudents
        PhongGh = [int64]$fixturesBefore.FixtureGhRooms
        GiaHanGh = [int64]$fixturesBefore.FixtureGhRenewals
    }
    foreach ($name in $fixtureCounts.Keys) {
        if ($fixtureCounts[$name] -gt $beforeCounts[$name]) {
            $fixtureNoIncrease = $false
        }
        $fixtureComparison += "$name=$($beforeCounts[$name])->$($fixtureCounts[$name])"
    }
}
$fixtureDetail = if ($null -eq $dbResult -or $null -eq $fixturesBefore) {
    "could not read fixture counts; exit=$dbExitCode; log=$dbLog"
} else {
    $fixtureComparison -join ", "
}
Add-Check "8. Fixture counts do not increase (SELECT only)" ($dbExitCode -eq 0 -and $fixtureNoIncrease) $fixtureDetail

$msgLines = @()
if (Test-Path -LiteralPath $npmLog) {
    $msgLines = @(Select-String -LiteralPath $npmLog -Pattern '^\s*Msg\s+\d+')
}
$msgCount = $msgLines.Count
Add-Check "9. No SQL Msg error lines in npm output" ($msgCount -eq 0) "SQL Msg error lines=$msgCount"

Write-Host ""
$checks | Format-Table -AutoSize -Wrap
Write-Host "npm test: $(Get-TestSummary $npmCounts); log: $npmLog"
if ($null -ne $dbResult) {
    Write-Host "DB read-only results: $($dbResult | ConvertTo-Json -Compress -Depth 4)"
}
Write-Host "Output files: $npmLog; $fixtureLog; $focusedLog; $dbLog"

if (@($checks | Where-Object { $_.Result -eq "FAIL" }).Count -gt 0) {
    exit 1
}
exit 0
