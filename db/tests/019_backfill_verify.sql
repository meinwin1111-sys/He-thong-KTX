:on error exit
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 52020, N'Chạy kiểm thử bằng sqlcmd -d KTX_Group3_test.', 1;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'015')
    THROW 52021, N'Chạy migrations 001-015 trước khi chuẩn bị dữ liệu legacy.', 1;
IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration IN (N'016', N'017', N'018', N'019'))
    THROW 52022, N'Khôi phục DB test và chỉ chạy migrations đến 015 trước bài backfill.', 1;
IF OBJECT_ID(N'dbo.ChiTietGiaoDich', N'U') IS NULL
    THROW 52023, N'Bảng legacy ChiTietGiaoDich không tồn tại.', 1;

DECLARE @Suffix nvarchar(8) = RIGHT(REPLACE(CONVERT(nvarchar(36), NEWID()), N'-', N''), 8),
        @Student nvarchar(20), @Room nvarchar(50),
        @NoTxn nvarchar(20), @Partial nvarchar(20), @Full nvarchar(20),
        @Pending nvarchar(20), @Rejected nvarchar(20), @Expired nvarchar(20), @CashWait nvarchar(20),
        @PartialTx nvarchar(60), @FullTx nvarchar(60), @PendingTx nvarchar(60),
        @RejectedTx nvarchar(60), @ExpiredTx nvarchar(60), @CashWaitTx nvarchar(60),
        @PaidBefore decimal(18,2), @PaidAfter decimal(18,2);

CREATE TABLE #LegacyInvoices
(
    CaseName nvarchar(20) NOT NULL PRIMARY KEY,
    MaHoaDon nvarchar(20) NOT NULL UNIQUE,
    ExpectedPaid decimal(18,2) NOT NULL
);
CREATE TABLE #LegacyTransactions
(
    CaseName nvarchar(20) NOT NULL PRIMARY KEY,
    MaGiaoDich nvarchar(60) NOT NULL UNIQUE,
    MaHoaDon nvarchar(20) NOT NULL,
    TrangThai nvarchar(10) NOT NULL
);

SELECT TOP (1) @Student = MaSinhVien
FROM dbo.SinhVien
ORDER BY MaSinhVien;
SELECT TOP (1) @Room = TenPhong
FROM dbo.Phong
ORDER BY TenPhong;
IF @Student IS NULL OR @Room IS NULL
BEGIN
    SELECT COUNT(*) AS SoSinhVien FROM dbo.SinhVien;
    SELECT COUNT(*) AS SoPhong FROM dbo.Phong;
    THROW 52024, N'Cần có ít nhất một sinh viên và một phòng để dựng dữ liệu legacy.', 1;
END;

SET @NoTxn = N'B19' + @Suffix + N'01';
SET @Partial = N'B19' + @Suffix + N'02';
SET @Full = N'B19' + @Suffix + N'03';
SET @Pending = N'B19' + @Suffix + N'04';
SET @Rejected = N'B19' + @Suffix + N'05';
SET @Expired = N'B19' + @Suffix + N'06';
SET @CashWait = N'B19' + @Suffix + N'07';
SET @PartialTx = N'B19TX' + @Suffix + N'02';
SET @FullTx = N'B19TX' + @Suffix + N'03';
SET @PendingTx = N'B19TX' + @Suffix + N'04';
SET @RejectedTx = N'B19TX' + @Suffix + N'05';
SET @ExpiredTx = N'B19TX' + @Suffix + N'06';
SET @CashWaitTx = N'B19TX' + @Suffix + N'07';

INSERT INTO #LegacyInvoices (CaseName, MaHoaDon, ExpectedPaid)
VALUES
    (N'NO_TXN', @NoTxn, 150),
    (N'PARTIAL', @Partial, 300),
    (N'FULL', @Full, 400),
    (N'PENDING', @Pending, 0),
    (N'REJECTED', @Rejected, 0),
    (N'EXPIRED', @Expired, 0),
    (N'CASH_WAIT', @CashWait, 0);

INSERT INTO dbo.HoaDon
    (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
     TrangThaiThanhToan)
VALUES
    (@NoTxn, @Student, @Room, CAST(GETDATE() AS date), 150, 0, 0, N'Đã thanh toán'),
    (@Partial, @Student, @Room, CAST(GETDATE() AS date), 300, 0, 0, N'Đã thanh toán'),
    (@Full, @Student, @Room, CAST(GETDATE() AS date), 400, 0, 0, N'Đã thanh toán'),
    (@Pending, @Student, @Room, CAST(GETDATE() AS date), 70, 0, 0, N'Chưa thanh toán'),
    (@Rejected, @Student, @Room, CAST(GETDATE() AS date), 80, 0, 0, N'Chưa thanh toán'),
    (@Expired, @Student, @Room, CAST(GETDATE() AS date), 90, 0, 0, N'Chưa thanh toán'),
    (@CashWait, @Student, @Room, CAST(GETDATE() AS date), 60, 0, 0, N'Chưa thanh toán');

UPDATE chi
SET TrangThai = N'Đã thanh toán',
    NgayThanhToan = GETDATE()
FROM dbo.ChiTietHoaDon chi
INNER JOIN #LegacyInvoices cases ON cases.MaHoaDon = chi.MaHoaDon
WHERE cases.CaseName IN (N'NO_TXN', N'PARTIAL', N'FULL');
UPDATE chi
SET TrangThai = N'Chờ tiền mặt'
FROM dbo.ChiTietHoaDon chi
WHERE chi.MaHoaDon = @CashWait;

INSERT INTO dbo.GiaoDichThanhToan
    (MaGiaoDich, MaSinhVien, TongTien, PhuongThuc, TrangThai, NgayThanhToan)
VALUES
    (@PartialTx, @Student, 200, N'ONLINE', N'SUCCESS', GETDATE()),
    (@FullTx, @Student, 400, N'ONLINE', N'SUCCESS', GETDATE()),
    (@PendingTx, @Student, 70, N'ONLINE', N'PENDING', NULL),
    (@RejectedTx, @Student, 80, N'ONLINE', N'REJECTED', NULL),
    (@ExpiredTx, @Student, 90, N'ONLINE', N'EXPIRED', NULL),
    (@CashWaitTx, @Student, 60, N'ONLINE', N'PENDING', NULL);

INSERT INTO dbo.ChiTietGiaoDich (MaGiaoDich, MaChiTiet, SoTien)
SELECT @PartialTx, MaChiTiet, 200 FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @Partial;
INSERT INTO dbo.ChiTietGiaoDich (MaGiaoDich, MaChiTiet, SoTien)
SELECT @FullTx, MaChiTiet, 400 FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @Full;
INSERT INTO dbo.ChiTietGiaoDich (MaGiaoDich, MaChiTiet, SoTien)
SELECT @PendingTx, MaChiTiet, 70 FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @Pending;
INSERT INTO dbo.ChiTietGiaoDich (MaGiaoDich, MaChiTiet, SoTien)
SELECT @RejectedTx, MaChiTiet, 80 FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @Rejected;
INSERT INTO dbo.ChiTietGiaoDich (MaGiaoDich, MaChiTiet, SoTien)
SELECT @ExpiredTx, MaChiTiet, 90 FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @Expired;
INSERT INTO dbo.ChiTietGiaoDich (MaGiaoDich, MaChiTiet, SoTien)
SELECT @CashWaitTx, MaChiTiet, 60 FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @CashWait;

INSERT INTO #LegacyTransactions (CaseName, MaGiaoDich, MaHoaDon, TrangThai)
VALUES
    (N'PARTIAL', @PartialTx, @Partial, N'SUCCESS'),
    (N'FULL', @FullTx, @Full, N'SUCCESS'),
    (N'PENDING', @PendingTx, @Pending, N'PENDING'),
    (N'REJECTED', @RejectedTx, @Rejected, N'REJECTED'),
    (N'EXPIRED', @ExpiredTx, @Expired, N'EXPIRED'),
    (N'CASH_WAIT', @CashWaitTx, @CashWait, N'PENDING');

SELECT cases.CaseName, cases.MaHoaDon, cases.ExpectedPaid,
       hd.TrangThaiThanhToan, chi.MaChiTiet, chi.SoTien, chi.TrangThai AS TrangThaiChiTiet,
       gd.MaGiaoDich, gd.TongTien AS TongGiaoDich, gd.TrangThai AS TrangThaiGiaoDich,
       cgd.SoTien AS SoTienPhanBo
FROM #LegacyInvoices cases
INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = cases.MaHoaDon
INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaHoaDon = cases.MaHoaDon
LEFT JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaChiTiet = chi.MaChiTiet
LEFT JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
ORDER BY cases.CaseName;
PRINT N'[019 backfill] Legacy fixtures ready; starting migrations 016-018.';
GO

:r db/migrations/016_invoice_periods_and_details.sql
:r db/migrations/017_incident_costs.sql
:r db/migrations/018_receipts_and_refunds.sql

DECLARE @PartialTx nvarchar(60) = (
    SELECT MaGiaoDich FROM #LegacyTransactions WHERE CaseName = N'PARTIAL'
);
UPDATE dbo.GiaoDichThanhToan SET TongTien = TongTien + 1
WHERE MaGiaoDich = @PartialTx;
SELECT MaGiaoDich, TongTien, TrangThai
FROM dbo.GiaoDichThanhToan WHERE MaGiaoDich = @PartialTx;
PRINT N'[019 backfill] Expected failure 51902 follows: SUCCESS total intentionally differs from ChiTietGiaoDich.';
GO

:on error ignore
:r db/migrations/019_payment_workflows.sql
:on error exit

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'019')
    THROW 52025, N'Migration 019 should have rolled back on mismatched SUCCESS amount.', 1;

DECLARE @PartialTx nvarchar(60) = (
    SELECT MaGiaoDich FROM #LegacyTransactions WHERE CaseName = N'PARTIAL'
);
UPDATE dbo.GiaoDichThanhToan SET TongTien = 200 WHERE MaGiaoDich = @PartialTx;
SELECT gd.MaGiaoDich, gd.TongTien, SUM(cgd.SoTien) AS DaPhanBo
FROM dbo.GiaoDichThanhToan gd
INNER JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaGiaoDich = gd.MaGiaoDich
WHERE gd.MaGiaoDich = @PartialTx
GROUP BY gd.MaGiaoDich, gd.TongTien;
GO

:r db/migrations/019_payment_workflows.sql

DECLARE @ExpectedPaid decimal(18,2), @ActualPaid decimal(18,2),
        @NoTxn nvarchar(20), @Partial nvarchar(20), @Full nvarchar(20),
        @PartialTx nvarchar(60), @FullTx nvarchar(60);
SELECT @NoTxn = MaHoaDon FROM #LegacyInvoices WHERE CaseName = N'NO_TXN';
SELECT @Partial = MaHoaDon FROM #LegacyInvoices WHERE CaseName = N'PARTIAL';
SELECT @Full = MaHoaDon FROM #LegacyInvoices WHERE CaseName = N'FULL';
SELECT @PartialTx = MaGiaoDich FROM #LegacyTransactions WHERE CaseName = N'PARTIAL';
SELECT @FullTx = MaGiaoDich FROM #LegacyTransactions WHERE CaseName = N'FULL';
SELECT @ExpectedPaid = SUM(ExpectedPaid) FROM #LegacyInvoices;
SELECT @ActualPaid = SUM(pt.SoTien)
FROM dbo.PhieuThu pt
INNER JOIN #LegacyInvoices cases ON cases.MaHoaDon = pt.MaHoaDon
WHERE pt.TrangThai = N'Hợp lệ';

SELECT cases.CaseName, cases.MaHoaDon, cases.ExpectedPaid,
       ISNULL(SUM(CASE WHEN pt.TrangThai = N'Hợp lệ' THEN pt.SoTien ELSE 0 END), 0) AS ImportedReceiptTotal,
       COUNT(CASE WHEN pt.MaPhieuThu IS NOT NULL THEN 1 END) AS SoPhieuThu,
       SUM(CASE WHEN pt.PhuongThuc = N'CHUYEN_DOI' THEN pt.SoTien ELSE 0 END) AS TienChuyenDoi
FROM #LegacyInvoices cases
LEFT JOIN dbo.PhieuThu pt ON pt.MaHoaDon = cases.MaHoaDon
GROUP BY cases.CaseName, cases.MaHoaDon, cases.ExpectedPaid
ORDER BY cases.CaseName;

SELECT @ExpectedPaid AS TongDaThuLegacy, @ActualPaid AS TongPhieuThuHopLe;
IF @ActualPaid <> @ExpectedPaid
BEGIN
    SELECT cases.CaseName, cases.MaHoaDon, cases.ExpectedPaid,
           ISNULL(SUM(CASE WHEN pt.TrangThai = N'Hợp lệ' THEN pt.SoTien ELSE 0 END), 0) AS ImportedReceiptTotal
    FROM #LegacyInvoices cases
    LEFT JOIN dbo.PhieuThu pt ON pt.MaHoaDon = cases.MaHoaDon
    GROUP BY cases.CaseName, cases.MaHoaDon, cases.ExpectedPaid;
    THROW 52026, N'Tổng phiếu thu hợp lệ không bằng tổng đã thanh toán trong dữ liệu legacy.', 1;
END;

IF EXISTS (
    SELECT 1
    FROM #LegacyInvoices cases
    INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = cases.MaHoaDon
    WHERE cases.CaseName IN (N'PENDING', N'REJECTED', N'EXPIRED', N'CASH_WAIT')
      AND pt.TrangThai = N'Hợp lệ'
)
BEGIN
    SELECT cases.CaseName, cases.MaHoaDon, pt.MaPhieuThu, pt.SoTien, pt.PhuongThuc, pt.TrangThai
    FROM #LegacyInvoices cases
    INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = cases.MaHoaDon;
    THROW 52027, N'Giao dịch PENDING/REJECTED/EXPIRED hoặc Chờ tiền mặt bị nhập nhầm thành phiếu thu hợp lệ.', 1;
END;

IF NOT EXISTS (
    SELECT 1 FROM dbo.PhieuThu
    WHERE MaHoaDon = @NoTxn AND PhuongThuc = N'CHUYEN_DOI'
      AND SoTien = 150 AND GhiChu = N'Chuyển đổi từ dữ liệu cũ'
)
   OR NOT EXISTS (
    SELECT 1 FROM dbo.PhieuThu
    WHERE MaHoaDon = @Partial AND MaGiaoDich = @PartialTx
      AND SoTien = 200 AND PhuongThuc = N'ONLINE'
)
   OR NOT EXISTS (
    SELECT 1 FROM dbo.PhieuThu
    WHERE MaHoaDon = @Partial AND MaGiaoDich IS NULL
      AND SoTien = 100 AND PhuongThuc = N'CHUYEN_DOI'
      AND GhiChu = N'Chuyển đổi từ dữ liệu cũ'
)
   OR NOT EXISTS (
    SELECT 1 FROM dbo.PhieuThu
    WHERE MaHoaDon = @Full AND MaGiaoDich = @FullTx
      AND SoTien = 400 AND PhuongThuc = N'ONLINE'
)
BEGIN
    SELECT cases.CaseName, cases.MaHoaDon, pt.MaGiaoDich, pt.SoTien, pt.PhuongThuc, pt.GhiChu
    FROM #LegacyInvoices cases
    LEFT JOIN dbo.PhieuThu pt ON pt.MaHoaDon = cases.MaHoaDon
    ORDER BY cases.CaseName;
    THROW 52028, N'Backfill đã thu đôi hoặc không bù đúng phần giao dịch SUCCESS còn thiếu.', 1;
END;

IF OBJECT_ID(N'dbo.ChiTietGiaoDich', N'U') IS NOT NULL
    THROW 52029, N'ChiTietGiaoDich phải được drop sau khi đối chiếu migration 019.', 1;

PRINT N'[019 backfill] PASS: no transaction 150, partial SUCCESS 200 + conversion 100, full SUCCESS 400; non-success and cash-wait produce no valid receipts; mismatch produced 51902 before corrected retry.';
GO
