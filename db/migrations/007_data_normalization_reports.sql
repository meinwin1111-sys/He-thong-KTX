SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50090, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'006')
    THROW 50091, N'Chạy migration 006 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'007')
    PRINT N'[007] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KiemTraChuanHoaDuLieu
    @ApDung bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @ApDung = 1
        EXEC dbo.sp_CapNhatHopDong;

    SELECT hd.MaHopDong, hd.MaSinhVien, sv.HoTen, hd.TenPhong,
           hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
    FROM dbo.HopDong hd
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
    WHERE hd.NgayKetThuc < CAST(GETDATE() AS date)
      AND hd.TrangThaiHopDong = N''Còn hiệu lực''
    ORDER BY hd.NgayKetThuc;

    SELECT sv.MaSinhVien, sv.HoTen, sv.TrangThaiSinhVien, sv.TenPhong AS PhongSinhVien,
           hd.MaHopDong, hd.TenPhong AS PhongHopDong, hd.NgayKetThuc
    FROM dbo.SinhVien sv
    INNER JOIN dbo.HopDong hd ON hd.MaSinhVien = sv.MaSinhVien
    WHERE sv.TrangThaiSinhVien = N''Đang ở''
      AND hd.TrangThaiHopDong = N''Đã kết thúc''
      AND hd.NgayKetThuc < CAST(GETDATE() AS date)
      AND NOT EXISTS (
          SELECT 1 FROM dbo.HopDong h2
          WHERE h2.MaSinhVien = sv.MaSinhVien AND h2.TrangThaiHopDong = N''Còn hiệu lực''
      )
    ORDER BY sv.MaSinhVien, hd.NgayKetThuc DESC;

    SELECT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.NgayLap,
           hp.MaHopDong, hp.NgayBatDau, hd.TenPhong AS PhongHoaDon,
           hp.TenPhong AS PhongHopDong, sv.TenPhong AS PhongSinhVien
    FROM dbo.HoaDon hd
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
    INNER JOIN dbo.HopDong hp ON hp.MaSinhVien = hd.MaSinhVien
    WHERE hd.NgayLap < hp.NgayBatDau
    ORDER BY hd.NgayLap, hd.MaHoaDon, hp.NgayBatDau;

    SELECT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.TenPhong AS PhongHoaDon,
           sv.TenPhong AS PhongSinhVien, hd.NgayLap
    FROM dbo.HoaDon hd
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
    WHERE ISNULL(hd.TenPhong, N'''') <> ISNULL(sv.TenPhong, N'''')
    ORDER BY hd.NgayLap DESC, hd.MaHoaDon;

    SELECT hp.MaHopDong, hp.MaSinhVien, sv.HoTen, hp.TenPhong AS PhongHopDong,
           sv.TenPhong AS PhongSinhVien, hp.NgayBatDau, hp.NgayKetThuc
    FROM dbo.HopDong hp
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hp.MaSinhVien
    WHERE ISNULL(hp.TenPhong, N'''') <> ISNULL(sv.TenPhong, N'''')
    ORDER BY hp.NgayBatDau DESC, hp.MaHopDong;
END;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'007', N'007_data_normalization_reports.sql');

        COMMIT TRANSACTION;
        PRINT N'[007] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO