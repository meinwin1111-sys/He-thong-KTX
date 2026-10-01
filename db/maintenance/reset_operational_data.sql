:on error exit
:setvar XacNhan "0"

/*
  BACKUP DATABASE TRƯỚC KHI CHẠY. Dùng lệnh backup trong db/00_backup_note.md.
  Mặc định chỉ đếm. Chỉ xóa thật với: sqlcmd ... -v XacNhan=1 -i db/maintenance/reset_operational_data.sql
  Chạy từ thư mục gốc repo; database đích mặc định trong lệnh là KTX_Group3.
*/
USE [KTX_Group3];
GO
SET XACT_ABORT ON;
SET NOCOUNT ON;

DECLARE @XacNhan nvarchar(10) = N'$(XacNhan)';

IF @XacNhan <> N'1'
BEGIN
    SELECT N'ChiTietGiaoDich' AS Bang, COUNT_BIG(*) AS SoDongSeXoa FROM dbo.ChiTietGiaoDich
    UNION ALL SELECT N'GiaoDichThanhToan', COUNT_BIG(*) FROM dbo.GiaoDichThanhToan
    UNION ALL SELECT N'ChiTietHoaDon', COUNT_BIG(*) FROM dbo.ChiTietHoaDon
    UNION ALL SELECT N'YeuCauSinhVien', COUNT_BIG(*) FROM dbo.YeuCauSinhVien
    UNION ALL SELECT N'LichSuHopDong', COUNT_BIG(*) FROM dbo.LichSuHopDong
    UNION ALL SELECT N'NhatKyHeThong', COUNT_BIG(*) FROM dbo.NhatKyHeThong
    UNION ALL SELECT N'HoaDon', COUNT_BIG(*) FROM dbo.HoaDon
    UNION ALL SELECT N'HopDong', COUNT_BIG(*) FROM dbo.HopDong
    UNION ALL SELECT N'MaHoaDonCounter', COUNT_BIG(*) FROM dbo.MaHoaDonCounter
    UNION ALL SELECT N'TaiKhoan (VaiTro = Sinh viên)', COUNT_BIG(*) FROM dbo.TaiKhoan WHERE VaiTro = N'Sinh viên'
    UNION ALL SELECT N'SinhVien', COUNT_BIG(*) FROM dbo.SinhVien;

    PRINT N'DRY-RUN: không có dữ liệu nào bị xóa. Để xóa thật, truyền -v XacNhan=1.';
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    DELETE FROM dbo.ChiTietGiaoDich;
    DELETE FROM dbo.GiaoDichThanhToan;

    DISABLE TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe ON dbo.ChiTietHoaDon;
    DELETE FROM dbo.ChiTietHoaDon;
    ENABLE TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe ON dbo.ChiTietHoaDon;

    DELETE FROM dbo.YeuCauSinhVien;
    DELETE FROM dbo.LichSuHopDong;
    DELETE FROM dbo.NhatKyHeThong;
    DELETE FROM dbo.HoaDon;
    DELETE FROM dbo.HopDong;

    DELETE FROM dbo.TaiKhoan WHERE VaiTro = N'Sinh viên';
    DELETE FROM dbo.SinhVien;

    DELETE FROM dbo.MaHoaDonCounter;

    UPDATE dbo.Phong
    SET SoSinhVienHienTai = 0,
        TrangThaiPhong = CASE
            WHEN TrangThaiPhong IN (N'Bảo trì', N'Ngưng sử dụng') THEN TrangThaiPhong
            ELSE N'Trống'
        END;

    DBCC CHECKIDENT (N'dbo.YeuCauSinhVien', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT (N'dbo.LichSuHopDong', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT (N'dbo.NhatKyHeThong', RESEED, 0) WITH NO_INFOMSGS;

    DECLARE @TaiKhoanMaxId bigint = ISNULL((SELECT MAX(MaTaiKhoan) FROM dbo.TaiKhoan), 0);
    DECLARE @Dbcc nvarchar(200) = N'DBCC CHECKIDENT (N''dbo.TaiKhoan'', RESEED, '
        + CONVERT(nvarchar(20), @TaiKhoanMaxId) + N') WITH NO_INFOMSGS;';
    EXEC sys.sp_executesql @Dbcc;

    IF OBJECT_ID(N'dbo.Seq_MaHopDong', N'SO') IS NOT NULL
        ALTER SEQUENCE dbo.Seq_MaHopDong RESTART WITH 1;

    COMMIT TRANSACTION;
    PRINT N'Đã xóa dữ liệu vận hành; dữ liệu phòng, cấu hình và tài khoản Admin/Quản lý được giữ lại.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO