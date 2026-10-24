:on error exit
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO
/*
  db/audit.sql — CHỈ ĐỌC, không INSERT/UPDATE/DELETE.
  Chạy sau migration 014:
  sqlcmd -I -S <server> -d KTX_Group3 -i db/audit.sql
*/
IF DB_NAME() = N'master'
    THROW 51701, N'Chạy audit bằng sqlcmd -d với database đích.', 1;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'014')
    THROW 51700, N'Cần chạy migration 014 trước khi audit mô hình hợp đồng/thành viên mới.', 1;
GO

PRINT N'========== AUDIT KTX_Group3 ==========' ;
PRINT N'Thời điểm: ' + CONVERT(nvarchar(30), GETDATE(), 126);

PRINT N'--- 1) Phong.SoSinhVienHienTai lệch số thành viên Đang ở ---';
SELECT p.TenPhong, p.SucChuaToiDa, p.SoSinhVienHienTai, p.TrangThaiPhong,
       ISNULL(x.SoThucTe, CONVERT(bigint, 0)) AS SoThanhVienDangO,
       p.SoSinhVienHienTai - ISNULL(x.SoThucTe, CONVERT(bigint, 0)) AS Lech
FROM dbo.Phong p
LEFT JOIN (
    SELECT hd.TenPhong, COUNT_BIG(*) AS SoThucTe
    FROM dbo.HopDong hd
    INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
    WHERE hd.TrangThaiHopDong = N'Còn hiệu lực' AND c.TrangThai = N'Đang ở'
    GROUP BY hd.TenPhong
) x ON x.TenPhong = p.TenPhong
WHERE ISNULL(p.SoSinhVienHienTai, 0) <> ISNULL(x.SoThucTe, CONVERT(bigint, 0))
ORDER BY p.TenPhong;

PRINT N'--- 2) Thành viên đang ở khác giới tính với loại phòng ---';
SELECT c.MaSinhVien, sv.HoTen, sv.GioiTinh, hd.MaHopDong, hd.TenPhong, p.LoaiPhong
FROM dbo.ChiTietHopDong c
INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
INNER JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
WHERE c.TrangThai = N'Đang ở'
  AND hd.TrangThaiHopDong = N'Còn hiệu lực'
  AND (sv.GioiTinh IS NULL OR p.LoaiPhong IS NULL OR sv.GioiTinh <> p.LoaiPhong)
ORDER BY c.MaSinhVien;

PRINT N'--- 3) Phòng trên hồ sơ sinh viên lệch hợp đồng/thành viên hiệu lực ---';
SELECT sv.MaSinhVien, sv.HoTen, sv.TrangThaiSinhVien, sv.TenPhong AS PhongHoSo,
       active.MaHopDong, active.TenPhong AS PhongHopDong
FROM dbo.SinhVien sv
OUTER APPLY (
    SELECT TOP (1) c.MaHopDong, hd.TenPhong
    FROM dbo.ChiTietHopDong c
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
    WHERE c.MaSinhVien = sv.MaSinhVien
      AND c.TrangThai = N'Đang ở'
      AND hd.TrangThaiHopDong = N'Còn hiệu lực'
    ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
) active
WHERE ISNULL(sv.TenPhong, N'') <> ISNULL(active.TenPhong, N'')
ORDER BY sv.MaSinhVien;

PRINT N'--- 4) Một sinh viên có các thời gian lưu trú chồng lấn ---';
SELECT a.MaSinhVien, a.MaChiTiet AS ChiTietA, b.MaChiTiet AS ChiTietB,
       ha.MaHopDong AS HopDongA, ha.TenPhong AS PhongA, a.NgayVao AS A_Vao, a.NgayRa AS A_Ra,
       hb.MaHopDong AS HopDongB, hb.TenPhong AS PhongB, b.NgayVao AS B_Vao, b.NgayRa AS B_Ra
FROM dbo.ChiTietHopDong a
INNER JOIN dbo.HopDong ha ON ha.MaHopDong = a.MaHopDong
INNER JOIN dbo.ChiTietHopDong b
    ON b.MaSinhVien = a.MaSinhVien
   AND b.MaChiTiet > a.MaChiTiet
INNER JOIN dbo.HopDong hb ON hb.MaHopDong = b.MaHopDong
WHERE a.NgayVao <= COALESCE(b.NgayRa, CONVERT(date, '99991231'))
  AND b.NgayVao <= COALESCE(a.NgayRa, CONVERT(date, '99991231'))
ORDER BY a.MaSinhVien, a.NgayVao;

PRINT N'--- 5) Hợp đồng quá NgayKetThuc nhưng vẫn Còn hiệu lực ---';
SELECT MaHopDong, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong
FROM dbo.HopDong
WHERE TrangThaiHopDong = N'Còn hiệu lực'
  AND NgayKetThuc < CAST(GETDATE() AS date)
ORDER BY NgayKetThuc;

PRINT N'--- 6) Email trùng (SinhVien, khác NULL) ---';
SELECT Email, COUNT(*) AS SoDong
FROM dbo.SinhVien
WHERE Email IS NOT NULL
GROUP BY Email
HAVING COUNT(*) > 1;

PRINT N'--- 6b) Email trùng TaiKhoan ---';
SELECT Email, COUNT(*) AS SoDong
FROM dbo.TaiKhoan
GROUP BY Email
HAVING COUNT(*) > 1;

PRINT N'--- 7) Hóa đơn trùng (sinh viên + tháng + năm lập) ---';
SELECT MaSinhVien, YEAR(NgayLap) AS Nam, MONTH(NgayLap) AS Thang, COUNT(*) AS SoHoaDon
FROM dbo.HoaDon
WHERE NgayLap IS NOT NULL
GROUP BY MaSinhVien, YEAR(NgayLap), MONTH(NgayLap)
HAVING COUNT(*) > 1
ORDER BY SoHoaDon DESC, MaSinhVien;

PRINT N'--- 8) Sinh viên Đã rời KTX vẫn còn TenPhong ---';
SELECT MaSinhVien, HoTen, TrangThaiSinhVien, TenPhong
FROM dbo.SinhVien
WHERE TrangThaiSinhVien = N'Đã rời KTX'
  AND TenPhong IS NOT NULL
ORDER BY MaSinhVien;

PRINT N'--- 9) Sinh viên có nhiều ChiTietHopDong đang ở ---';
SELECT MaSinhVien, COUNT_BIG(*) AS SoChiTietDangO
FROM dbo.ChiTietHopDong
WHERE TrangThai = N'Đang ở'
GROUP BY MaSinhVien
HAVING COUNT_BIG(*) > 1;

PRINT N'--- 10) Phòng có nhiều hợp đồng còn hiệu lực ---';
SELECT TenPhong, COUNT_BIG(*) AS SoHopDongHieuLuc
FROM dbo.HopDong
WHERE TrangThaiHopDong = N'Còn hiệu lực'
GROUP BY TenPhong
HAVING COUNT_BIG(*) > 1;

PRINT N'========== HẾT AUDIT ==========' ;
GO
