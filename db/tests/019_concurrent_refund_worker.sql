:on error exit
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 52200, N'Chạy kiểm thử bằng sqlcmd -d KTX_Group3_test.', 1;
GO

DECLARE @MaChiTiet int = TRY_CONVERT(int, N'$(MaChiTiet)'),
        @NgayRa date = TRY_CONVERT(date, N'$(NgayRa)', 23),
        @NguoiLap int,
        @Succeeded bit = 0,
        @TongThu decimal(18,2),
        @TongChi decimal(18,2);

IF @MaChiTiet IS NULL OR @MaChiTiet <= 0 OR @NgayRa IS NULL
BEGIN
    SELECT N'$(MaChiTiet)' AS MaChiTiet, N'$(NgayRa)' AS NgayRa;
    THROW 52201, N'Mã thành viên hoặc ngày ra kiểm thử không hợp lệ.', 1;
END;

SELECT TOP (1) @NguoiLap = MaTaiKhoan
FROM dbo.TaiKhoan
WHERE VaiTro = N'Quản lý'
ORDER BY MaTaiKhoan;

IF @NguoiLap IS NULL
    THROW 52202, N'Không có tài khoản quản lý để lập phiếu chi kiểm thử.', 1;

BEGIN TRY
    EXEC dbo.sp_TaoPhieuChi
        @MaChiTiet = @MaChiTiet,
        @NgayRa = @NgayRa,
        @LyDo = N'Khác',
        @NguoiLap = @NguoiLap,
        @GhiChu = N'Concurrent refund worker test';
    SET @Succeeded = 1;
    PRINT N'Phiên này tạo được phiếu chi hợp lệ.';
END TRY
BEGIN CATCH
    SELECT ERROR_NUMBER() AS MaLoi, LEFT(ERROR_MESSAGE(), 255) AS ThongBao;
    IF ERROR_NUMBER() <> 51937
        THROW;
    PRINT N'Phiên này bị chặn vì số dư hoàn đã được phiên còn lại sử dụng.';
END CATCH;

SELECT @TongThu = ISNULL(SUM(pt.SoTien), 0)
FROM dbo.HoaDon hd
INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = hd.MaHoaDon
WHERE hd.MaChiTiet = @MaChiTiet
  AND hd.LoaiHoaDon = N'TIEN_PHONG'
  AND pt.TrangThai = N'Hợp lệ';

SELECT @TongChi = ISNULL(SUM(pc.SoTien), 0)
FROM dbo.PhieuChi pc
WHERE pc.MaChiTiet = @MaChiTiet
  AND pc.TrangThai = N'Hợp lệ';

SELECT @MaChiTiet AS MaChiTiet, @Succeeded AS PhienThanhCong,
       @TongThu AS TongThuHopLe, @TongChi AS TongChiHopLe;

IF @TongChi > @TongThu
    THROW 52203, N'Tổng phiếu chi hợp lệ vượt tổng phiếu thu hợp lệ.', 1;
GO
