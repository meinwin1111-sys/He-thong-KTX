:on error exit
/*
  BACKUP DATABASE TRƯỚC KHI CHẠY. Dùng lệnh backup trong db/00_backup_note.md.
  Luôn truyền -v XacNhan=0 để xem trước hoặc -v XacNhan=1 để xác nhận xóa.
  Chỉ dành cho KTX_Group3_test. Chạy từ thư mục gốc repo; luôn chỉ rõ -d KTX_Group3_test.
*/
IF DB_NAME() = N'master'
    THROW 51800, N'Chạy script bằng sqlcmd -d với database đích.', 1;
IF DB_NAME() <> N'KTX_Group3_test'
    THROW 51801, N'Script chỉ được chạy trên KTX_Group3_test.', 1;
GO
SET XACT_ABORT ON;
SET NOCOUNT ON;

DECLARE @XacNhan nvarchar(10) = N'$(XacNhan)';

IF @XacNhan <> N'1'
BEGIN
    SELECT N'PhieuChi_HoaDon' AS Bang, COUNT_BIG(*) AS SoDongSeXoa FROM dbo.PhieuChi_HoaDon
    UNION ALL SELECT N'PhieuChi', COUNT_BIG(*) FROM dbo.PhieuChi
    UNION ALL SELECT N'PhieuThu', COUNT_BIG(*) FROM dbo.PhieuThu
    UNION ALL SELECT N'GiaoDichThanhToan', COUNT_BIG(*) FROM dbo.GiaoDichThanhToan
    UNION ALL SELECT N'HoanTienChuyenKhoanDu', COUNT_BIG(*) FROM dbo.HoanTienChuyenKhoanDu
    UNION ALL SELECT N'ChiPhiPhatSinh', COUNT_BIG(*) FROM dbo.ChiPhiPhatSinh
    UNION ALL SELECT N'ChiTietHoaDon', COUNT_BIG(*) FROM dbo.ChiTietHoaDon
    UNION ALL SELECT N'ThongBao', COUNT_BIG(*) FROM dbo.ThongBao
    UNION ALL SELECT N'GiaHanHopDong', COUNT_BIG(*) FROM dbo.GiaHanHopDong
    UNION ALL SELECT N'DangKySinhVienChoDuyet', COUNT_BIG(*) FROM dbo.DangKySinhVienChoDuyet
    UNION ALL SELECT N'YeuCauSinhVien', COUNT_BIG(*) FROM dbo.YeuCauSinhVien
    UNION ALL SELECT N'ChiTietHopDong', COUNT_BIG(*) FROM dbo.ChiTietHopDong
    UNION ALL SELECT N'NhatKyHeThong', COUNT_BIG(*) FROM dbo.NhatKyHeThong
    UNION ALL SELECT N'LichSuHopDong_Backup', COUNT_BIG(*) FROM dbo.LichSuHopDong_Backup
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

    DISABLE TRIGGER dbo.TRG_PhieuChi_HoaDon ON dbo.PhieuChi_HoaDon;
    DISABLE TRIGGER dbo.TRG_PhieuChi_BaoVe ON dbo.PhieuChi;
    DELETE FROM dbo.PhieuChi_HoaDon;
    DELETE FROM dbo.PhieuChi;
    ENABLE TRIGGER dbo.TRG_PhieuChi_HoaDon ON dbo.PhieuChi_HoaDon;
    ENABLE TRIGGER dbo.TRG_PhieuChi_BaoVe ON dbo.PhieuChi;
    DELETE FROM dbo.ThongBao;
    DELETE FROM dbo.PhieuThu;
    DELETE FROM dbo.HoanTienChuyenKhoanDu;
    DELETE FROM dbo.GiaoDichThanhToan;

    DISABLE TRIGGER dbo.TRG_ChiPhiPhatSinh_BaoVe ON dbo.ChiPhiPhatSinh;
    DELETE FROM dbo.ChiPhiPhatSinh;
    ENABLE TRIGGER dbo.TRG_ChiPhiPhatSinh_BaoVe ON dbo.ChiPhiPhatSinh;

    DISABLE TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe ON dbo.ChiTietHoaDon;
    DELETE FROM dbo.ChiTietHoaDon;
    ENABLE TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe ON dbo.ChiTietHoaDon;

    DELETE FROM dbo.GiaHanHopDong;
    DELETE FROM dbo.DangKySinhVienChoDuyet;
    DELETE FROM dbo.YeuCauSinhVien;
    DELETE FROM dbo.NhatKyHeThong;
    DELETE FROM dbo.LichSuHopDong_Backup;
    DELETE FROM dbo.HoaDon;
    DELETE FROM dbo.ChiTietHopDong;
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
    DBCC CHECKIDENT (N'dbo.ChiTietHopDong', RESEED, 0) WITH NO_INFOMSGS;
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