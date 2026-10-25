SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
BEGIN
    ;THROW 52200, N'Không chạy migration trong master.', 1;
END;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
BEGIN
    ;THROW 52201, N'Chạy migration 001 trước.', 1;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'021')
BEGIN
    ;THROW 52202, N'Chạy migration 021 trước.', 1;
END;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'022')
BEGIN
    PRINT N'[022] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
WITH invoice_totals AS (
    SELECT hd.MaHoaDon, hd.LoaiHoaDon, hd.TenPhong, hd.MaHopDong,
           CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG''
                THEN cthd.MaSinhVien
                WHEN hd.LoaiHoaDon = N''CU''
                THEN hd.MaSinhVien END AS MaSinhVien,
           ISNULL(sv.HoTen, N'''') AS HoTen,
           ISNULL(v.TongThuc, 0) AS TongHoaDon,
           ISNULL(v.DaThu, 0) AS DaThu,
           ISNULL(v.ConNo, 0) AS ConNo,
           CASE WHEN v.TrangThaiSuyRa = N''OVERDUE''
                THEN ISNULL(v.ConNo, 0) ELSE 0 END AS CongNoQuaHan
    FROM dbo.HoaDon hd
    INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
    LEFT JOIN dbo.ChiTietHopDong cthd
        ON hd.LoaiHoaDon = N''TIEN_PHONG'' AND cthd.MaChiTiet = hd.MaChiTiet
    LEFT JOIN dbo.SinhVien sv
        ON sv.MaSinhVien = CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG''
                               THEN cthd.MaSinhVien
                               WHEN hd.LoaiHoaDon = N''CU''
                               THEN hd.MaSinhVien END
    WHERE ISNULL(hd.TrangThaiThanhToan, N'''') <> N''Đã hủy''
)
SELECT LoaiHoaDon, TenPhong, MaHopDong, MaSinhVien,
       NULLIF(HoTen, N'''') AS HoTen,
       SUM(TongHoaDon) AS TongHoaDon,
       SUM(DaThu) AS DaThu,
       SUM(ConNo) AS TongCongNo,
       SUM(CongNoQuaHan) AS CongNoQuaHan,
       COUNT_BIG(*) AS SoHoaDon
FROM invoice_totals
WHERE ConNo > 0
GROUP BY LoaiHoaDon, TenPhong, MaHopDong, MaSinhVien, HoTen;';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_DoanhThuThang
AS
WITH receipt_totals AS (
    SELECT YEAR(pt.NgayThu) AS Nam, MONTH(pt.NgayThu) AS Thang,
           SUM(CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN pt.SoTien ELSE 0 END) AS ThuTienPhong,
           SUM(CASE WHEN hd.LoaiHoaDon = N''DICH_VU_PHONG'' OR hd.LoaiHoaDon = N''CU''
                    THEN pt.SoTien ELSE 0 END) AS ThuDichVu,
           SUM(CASE WHEN hd.LoaiHoaDon = N''PHAT_SINH'' THEN pt.SoTien ELSE 0 END) AS ThuPhatSinh,
           SUM(pt.SoTien) AS TongThu
    FROM dbo.PhieuThu pt
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
    WHERE pt.TrangThai = N''Hợp lệ''
    GROUP BY YEAR(pt.NgayThu), MONTH(pt.NgayThu)
),
refund_totals AS (
    SELECT YEAR(pc.NgayChi) AS Nam, MONTH(pc.NgayChi) AS Thang,
           SUM(CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN pha.SoTien ELSE 0 END) AS ChiTienPhong,
           SUM(CASE WHEN hd.LoaiHoaDon = N''DICH_VU_PHONG'' OR hd.LoaiHoaDon = N''CU''
                    THEN pha.SoTien ELSE 0 END) AS ChiDichVu,
           SUM(CASE WHEN hd.LoaiHoaDon = N''PHAT_SINH'' THEN pha.SoTien ELSE 0 END) AS ChiPhatSinh,
           SUM(pha.SoTien) AS TongChi
    FROM dbo.PhieuChi pc
    INNER JOIN dbo.PhieuChi_HoaDon pha ON pha.MaPhieuChi = pc.MaPhieuChi
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pha.MaHoaDon
    WHERE pc.TrangThai = N''Hợp lệ''
    GROUP BY YEAR(pc.NgayChi), MONTH(pc.NgayChi)
)
SELECT COALESCE(r.Nam, c.Nam) AS Nam,
       COALESCE(r.Thang, c.Thang) AS Thang,
       ISNULL(r.ThuTienPhong, 0) AS ThuTienPhong,
       ISNULL(c.ChiTienPhong, 0) AS ChiTienPhong,
       ISNULL(r.ThuTienPhong, 0) - ISNULL(c.ChiTienPhong, 0) AS DoanhThuTienPhong,
       ISNULL(r.ThuDichVu, 0) AS ThuDichVu,
       ISNULL(c.ChiDichVu, 0) AS ChiDichVu,
       ISNULL(r.ThuDichVu, 0) - ISNULL(c.ChiDichVu, 0) AS DoanhThuDichVu,
       ISNULL(r.ThuPhatSinh, 0) AS ThuPhatSinh,
       ISNULL(c.ChiPhatSinh, 0) AS ChiPhatSinh,
       ISNULL(r.ThuPhatSinh, 0) - ISNULL(c.ChiPhatSinh, 0) AS DoanhThuPhatSinh,
       ISNULL(r.ThuDichVu, 0) - ISNULL(c.ChiDichVu, 0) AS DoanhThuDienNuocKhac,
       ISNULL(r.TongThu, 0) AS TongThu,
       ISNULL(c.TongChi, 0) AS TongChi,
       ISNULL(r.TongThu, 0) - ISNULL(c.TongChi, 0) AS TongDoanhThu
FROM receipt_totals r
FULL OUTER JOIN refund_totals c ON c.Nam = r.Nam AND c.Thang = r.Thang;';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'022', N'022_complete_financial_reports.sql');

        COMMIT TRANSACTION;
        PRINT N'[022] Hoàn tất: báo cáo công nợ và doanh thu phân loại theo hóa đơn.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
