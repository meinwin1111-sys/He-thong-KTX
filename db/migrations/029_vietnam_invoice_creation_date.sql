SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 52900, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 52901, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'028')
    THROW 52902, N'Chạy migration 028 trước.', 1;
GO

CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDonTienPhong
    @MaChiTiet int,
    @KyThanhToan date,
    @MaHoaDon nvarchar(20) = NULL OUTPUT,
    @NgayTao date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @MaHopDong nvarchar(20), @MaSinhVien nvarchar(30), @TenPhong nvarchar(50),
                @KyHan nvarchar(10), @Gia decimal(18,2), @ThangGia decimal(18,2),
                @Den date, @Ngay date = COALESCE(@NgayTao, CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))),
                @Han date;
        SELECT @MaHopDong = hd.MaHopDong, @MaSinhVien = c.MaSinhVien, @TenPhong = hd.TenPhong,
               @KyHan = c.KyHanThanhToanPhong, @Gia = c.GiaPhongApDung,
               @ThangGia = c.GiaPhongThangApDung
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaChiTiet = @MaChiTiet AND c.TrangThai = N'Đang ở'
          AND hd.TrangThaiHopDong = N'Còn hiệu lực';
        IF @MaHopDong IS NULL
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet;
            THROW 51920, N'Không tìm thấy thành viên hợp đồng đang ở.', 1;
        END;
        IF @KyThanhToan IS NULL
           OR @KyThanhToan <> DATEFROMPARTS(YEAR(@KyThanhToan), MONTH(@KyThanhToan), 1)
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @KyThanhToan AS KyThanhToan;
            THROW 51921, N'Kỳ thanh toán tiền phòng phải là ngày đầu tháng.', 1;
        END;
        IF @KyHan = N'NAM'
        BEGIN
            SET @Den = EOMONTH(DATEADD(month, 11, @KyThanhToan));
            SET @Gia = @Gia;
        END
        ELSE
        BEGIN
            SET @Den = EOMONTH(@KyThanhToan);
            SET @Gia = @ThangGia;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE LoaiHoaDon = N'TIEN_PHONG'
              AND MaChiTiet = @MaChiTiet
              AND TrangThaiThanhToan <> N'Đã hủy'
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan
        )
        BEGIN
            SELECT MaHoaDon, MaChiTiet, KyThanhToan, KyThanhToanDen,
                   TrangThaiThanhToan
            FROM dbo.HoaDon
            WHERE LoaiHoaDon = N'TIEN_PHONG'
              AND MaChiTiet = @MaChiTiet
              AND TrangThaiThanhToan <> N'Đã hủy'
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan;
            THROW 51922, N'Kỳ tiền phòng bị trùng hoặc chồng với hóa đơn đang hoạt động.', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon)
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 51923, N'Mã hóa đơn đã tồn tại.', 1;
        END;
        SELECT @Han = DATEADD(day, ISNULL(TRY_CONVERT(int, GiaTri), 15), @Ngay)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'SO_NGAY_HAN_THANH_TOAN';
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, 0, 0, 0,
             N'Chưa thanh toán', COALESCE(@Han, DATEADD(day, 15, @Ngay)),
             N'TIEN_PHONG', @MaHopDong, @MaChiTiet, @KyThanhToan, @Den);
        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
             TrangThai, ThuTu, GhiChu)
        VALUES
            (LEFT(@MaHoaDon, 30) + N'-ROOM', @MaHoaDon, N'ROOM', N'Tiền phòng',
             @Gia, 1, @Gia, N'Chưa thanh toán', 1, @KyHan);
        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon, @Gia AS TongTien;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'029')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'029', N'029_vietnam_invoice_creation_date.sql');
GO
PRINT N'[029] Hoàn tất.';
GO
