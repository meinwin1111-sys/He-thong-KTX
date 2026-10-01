SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO
/*
  db/audit.sql — CHỈ ĐỌC, không INSERT/UPDATE/DELETE.
  Chạy: sqlcmd -I -S <server> -d KTX_Group3 -i db/audit.sql
*/
USE [KTX_Group3];
GO

PRINT N'========== AUDIT KTX_Group3 ==========';
PRINT N'Thời điểm: ' + CONVERT(nvarchar(30), GETDATE(), 126);

PRINT N'--- 1) Phong.SoSinhVienHienTai lệch số sinh viên Đang ở ---';
SELECT p.TenPhong, p.SucChuaToiDa, p.SoSinhVienHienTai, p.TrangThaiPhong,
       ISNULL(x.SoThucTe, 0) AS SoSinhVienDangO,
       p.SoSinhVienHienTai - ISNULL(x.SoThucTe, 0) AS Lech
FROM dbo.Phong p
LEFT JOIN (
    SELECT TenPhong, COUNT(*) AS SoThucTe
    FROM dbo.SinhVien
    WHERE TrangThaiSinhVien = N'Đang ở' AND TenPhong IS NOT NULL
    GROUP BY TenPhong
) x ON x.TenPhong = p.TenPhong
WHERE ISNULL(p.SoSinhVienHienTai, 0) <> ISNULL(x.SoThucTe, 0)
ORDER BY p.TenPhong;

PRINT N'--- 2) Sinh viên khác giới tính với loại phòng ---';
SELECT sv.MaSinhVien, sv.HoTen, sv.GioiTinh, sv.TenPhong, p.LoaiPhong
FROM dbo.SinhVien sv
INNER JOIN dbo.Phong p ON p.TenPhong = sv.TenPhong
WHERE sv.GioiTinh <> p.LoaiPhong
ORDER BY sv.MaSinhVien;

PRINT N'--- 3) Sinh viên có phòng nhưng không có hợp đồng còn hiệu lực ---';
SELECT sv.MaSinhVien, sv.HoTen, sv.TrangThaiSinhVien, sv.TenPhong
FROM dbo.SinhVien sv
WHERE sv.TenPhong IS NOT NULL
  AND NOT EXISTS (
        SELECT 1
        FROM dbo.HopDong hd
        WHERE hd.MaSinhVien = sv.MaSinhVien
          AND hd.TrangThaiHopDong = N'Còn hiệu lực'
  )
ORDER BY sv.MaSinhVien;

PRINT N'--- 4) Hợp đồng trùng khoảng thời gian cùng một sinh viên ---';
SELECT a.MaSinhVien, a.MaHopDong AS HopDongA, b.MaHopDong AS HopDongB,
       a.NgayBatDau AS A_BatDau, a.NgayKetThuc AS A_KetThuc,
       b.NgayBatDau AS B_BatDau, b.NgayKetThuc AS B_KetThuc
FROM dbo.HopDong a
INNER JOIN dbo.HopDong b
    ON a.MaSinhVien = b.MaSinhVien
   AND a.MaHopDong < b.MaHopDong
   AND a.NgayBatDau < b.NgayKetThuc
   AND b.NgayBatDau < a.NgayKetThuc
ORDER BY a.MaSinhVien;

PRINT N'--- 5) Hợp đồng quá NgayKetThuc nhưng vẫn Còn hiệu lực ---';
SELECT MaHopDong, MaSinhVien, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong
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

PRINT N'--- 9) Hợp đồng Còn hiệu lực trùng MaSinhVien (cản filtered unique) ---';
SELECT MaSinhVien, COUNT(*) AS SoHopDongHieuLuc
FROM dbo.HopDong
WHERE TrangThaiHopDong = N'Còn hiệu lực'
GROUP BY MaSinhVien
HAVING COUNT(*) > 1;

PRINT N'========== HẾT AUDIT ==========';
GO
