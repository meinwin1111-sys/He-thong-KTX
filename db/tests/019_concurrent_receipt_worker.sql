:on error exit
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 51998, N'Chạy kiểm thử bằng sqlcmd -d KTX_Group3_test.', 1;
GO

DECLARE @MaHoaDon nvarchar(20) = N'$(MaHoaDon)',
        @TongHoaDon decimal(18,2),
        @DaThu decimal(18,2);

IF LEN(@MaHoaDon) <> 13
   OR @MaHoaDon NOT LIKE N'INV[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
BEGIN
    SELECT @MaHoaDon AS MaHoaDonKhongHopLe;
    THROW 51999, N'MaHoaDon kiểm thử không hợp lệ.', 1;
END;

SELECT @TongHoaDon = SUM(SoTien)
FROM dbo.ChiTietHoaDon
WHERE MaHoaDon = @MaHoaDon;
SELECT @DaThu = ISNULL(SUM(SoTien), 0)
FROM dbo.PhieuThu
WHERE MaHoaDon = @MaHoaDon AND TrangThai = N'Hợp lệ';

IF @TongHoaDon <> 300 OR @DaThu NOT IN (100, 300)
BEGIN
    SELECT @MaHoaDon AS MaHoaDon, @TongHoaDon AS TongHoaDon, @DaThu AS DaThu;
    THROW 52000, N'Hóa đơn phải có tổng 300, đã thu ban đầu 100 và tối đa một phiếu thu đồng thời 200.', 1;
END;

BEGIN TRANSACTION;
EXEC dbo.sp_GhiPhieuThu
    @MaHoaDon = @MaHoaDon,
    @SoTien = 200,
    @PhuongThuc = N'CASH';
WAITFOR DELAY '00:00:05';
COMMIT TRANSACTION;

PRINT N'Phiên này ghi nhận thành công phiếu thu 200.';
GO
