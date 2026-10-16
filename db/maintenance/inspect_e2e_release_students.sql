USE [KTX_Group3];
GO
SET NOCOUNT ON;

/*
  CHỈ ĐỌC — chỉ truy vấn dữ liệu thật; không tạo bảng tạm hay ghi dữ liệu.
  Chỉ kiểm tra chính xác ba MSSV/định danh dưới đây, không dùng LIKE.
  Lịch sử lưu trú hiện nằm ở dbo.SinhVien (phòng/trạng thái) và dbo.LichSuHopDong;
  trong các migration/schema đang có không thấy bảng lịch sử lưu trú riêng.
*/

;WITH Targets AS
(
    SELECT *
    FROM (VALUES
        (N'E2E_REL_20261001_A', N'E2E Release Student A', CAST(NULL AS varchar(100))),
        (N'E2E_REL_20261001_B', N'E2E Release Student B', CAST(NULL AS varchar(100))),
        (N'TEST_DK_002', N'test', CAST('test.dk002@gmail.com' AS varchar(100)))
    ) v(MaSinhVien, HoTenMongDoi, EmailDangNhapMongDoi)
)
SELECT target.MaSinhVien, counts.Bang, counts.SoDong
FROM Targets target
CROSS APPLY (VALUES
    (N'SinhVien', CONVERT(bigint, (SELECT COUNT_BIG(*) FROM dbo.SinhVien sv WHERE sv.MaSinhVien = target.MaSinhVien))),
    (N'TaiKhoan', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.TaiKhoan tk
        WHERE tk.MaSinhVien = target.MaSinhVien
           OR (target.EmailDangNhapMongDoi IS NOT NULL AND tk.Email = target.EmailDangNhapMongDoi)
    ))),
    (N'HopDong', CONVERT(bigint, (SELECT COUNT_BIG(*) FROM dbo.HopDong hd WHERE hd.MaSinhVien = target.MaSinhVien))),
    (N'LichSuHopDong', CONVERT(bigint, (SELECT COUNT_BIG(*) FROM dbo.LichSuHopDong ls WHERE ls.MaSinhVien = target.MaSinhVien))),
    (N'HoaDon', CONVERT(bigint, (SELECT COUNT_BIG(*) FROM dbo.HoaDon hd WHERE hd.MaSinhVien = target.MaSinhVien))),
    (N'ChiTietHoaDon', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.ChiTietHoaDon chi
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
        WHERE hd.MaSinhVien = target.MaSinhVien
    ))),
    (N'GiaoDichThanhToan', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.GiaoDichThanhToan gd
        WHERE gd.MaSinhVien = target.MaSinhVien
           OR EXISTS (
               SELECT 1 FROM dbo.ChiTietGiaoDich cgd
               INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
               INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
               WHERE cgd.MaGiaoDich = gd.MaGiaoDich AND hd.MaSinhVien = target.MaSinhVien
           )
    ))),
    (N'ChiTietGiaoDich', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.ChiTietGiaoDich cgd
        WHERE EXISTS (
            SELECT 1 FROM dbo.GiaoDichThanhToan gd
            WHERE gd.MaGiaoDich = cgd.MaGiaoDich AND gd.MaSinhVien = target.MaSinhVien
        ) OR EXISTS (
            SELECT 1 FROM dbo.ChiTietHoaDon chi
            INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
            WHERE chi.MaChiTiet = cgd.MaChiTiet AND hd.MaSinhVien = target.MaSinhVien
        )
    ))),
    (N'YeuCauSinhVien', CONVERT(bigint, (SELECT COUNT_BIG(*) FROM dbo.YeuCauSinhVien yc WHERE yc.MaSinhVien = target.MaSinhVien))),
    (N'NhatKyHeThong', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.NhatKyHeThong nk
        WHERE nk.MaDoiTuong = target.MaSinhVien
           OR nk.MaTaiKhoan IN (
               SELECT tk.MaTaiKhoan FROM dbo.TaiKhoan tk
               WHERE tk.MaSinhVien = target.MaSinhVien
                  OR (target.EmailDangNhapMongDoi IS NOT NULL AND tk.Email = target.EmailDangNhapMongDoi)
           )
           OR nk.MaDoiTuong IN (SELECT hd.MaHoaDon FROM dbo.HoaDon hd WHERE hd.MaSinhVien = target.MaSinhVien)
           OR nk.MaDoiTuong IN (SELECT hd.MaHopDong FROM dbo.HopDong hd WHERE hd.MaSinhVien = target.MaSinhVien)
           OR nk.MaDoiTuong IN (SELECT yc.MaYeuCau FROM dbo.YeuCauSinhVien yc WHERE yc.MaSinhVien = target.MaSinhVien)
           OR nk.MaDoiTuong IN (
               SELECT gd.MaGiaoDich FROM dbo.GiaoDichThanhToan gd
               WHERE gd.MaSinhVien = target.MaSinhVien
                  OR EXISTS (
                      SELECT 1 FROM dbo.ChiTietGiaoDich cgd
                      INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                      INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
                      WHERE cgd.MaGiaoDich = gd.MaGiaoDich AND hd.MaSinhVien = target.MaSinhVien
                  )
           )
    )))
) counts(Bang, SoDong)
ORDER BY target.MaSinhVien, counts.Bang;

IF OBJECT_ID(N'dbo.DangKySinhVienChoDuyet', N'U') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
        ;WITH Targets AS
        (
            SELECT MaSinhVien
            FROM (VALUES
                (N''E2E_REL_20261001_A''), (N''E2E_REL_20261001_B''), (N''TEST_DK_002'')
            ) v(MaSinhVien)
        )
        SELECT target.MaSinhVien, N''DangKySinhVienChoDuyet'' AS Bang, COUNT_BIG(registration.Id) AS SoDong
        FROM Targets target
        LEFT JOIN dbo.DangKySinhVienChoDuyet registration
            ON registration.MaSinhVien = target.MaSinhVien
        GROUP BY target.MaSinhVien
        ORDER BY target.MaSinhVien;';
END
ELSE
BEGIN
    SELECT MaSinhVien, N'DangKySinhVienChoDuyet (bảng chưa có)' AS Bang, CONVERT(bigint, 0) AS SoDong
    FROM (VALUES
        (N'E2E_REL_20261001_A'), (N'E2E_REL_20261001_B'), (N'TEST_DK_002')
    ) target(MaSinhVien);
END;

;WITH Targets AS
(
    SELECT *
    FROM (VALUES
        (N'E2E_REL_20261001_A', N'E2E Release Student A', CAST(NULL AS varchar(100))),
        (N'E2E_REL_20261001_B', N'E2E Release Student B', CAST(NULL AS varchar(100))),
        (N'TEST_DK_002', N'test', CAST('test.dk002@gmail.com' AS varchar(100)))
    ) v(MaSinhVien, HoTenMongDoi, EmailDangNhapMongDoi)
)
SELECT
    target.MaSinhVien, sv.HoTen AS HoTenThucTe, sv.Email AS EmailHoSo,
    sv.TenPhong, sv.TrangThaiSinhVien, target.HoTenMongDoi, target.EmailDangNhapMongDoi,
    CASE
        WHEN sv.MaSinhVien IS NULL THEN N'KHÔNG TÌM THẤY HỒ SƠ'
        WHEN sv.HoTen <> target.HoTenMongDoi THEN N'CẢNH BÁO: TÊN KHÔNG KHỚP — KHÔNG XÓA'
        WHEN target.MaSinhVien IN (N'E2E_REL_20261001_A', N'E2E_REL_20261001_B')
             AND (ISNULL(sv.TenPhong, N'') <> N'A101' OR ISNULL(sv.DiaChi, N'') <> N'E2E fixture')
            THEN N'CẢNH BÁO: PHÒNG/ĐỊA CHỈ E2E KHÔNG KHỚP — KHÔNG XÓA'
        ELSE N'KHỚP MSSV/TÊN MONG ĐỢI'
    END AS KiemTraHoSo
FROM Targets target
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = target.MaSinhVien
ORDER BY target.MaSinhVien;

SELECT
    expected.MaHoaDon AS MaHoaDonMongDoi, expected.MaSinhVien AS MaSinhVienMongDoi,
    hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.TenPhong, hd.NgayLap,
    hd.TrangThaiThanhToan, hd.TongTien,
    CASE
        WHEN hd.MaHoaDon IS NULL THEN N'KHÔNG TÌM THẤY HÓA ĐƠN'
        WHEN hd.MaSinhVien <> expected.MaSinhVien THEN N'CẢNH BÁO: KHÔNG THUỘC MSSV MONG ĐỢI'
        WHEN hd.TenPhong <> N'A101' OR hd.NgayLap IS NULL
             OR hd.NgayLap < '20261001' OR hd.NgayLap >= '20261101'
            THEN N'CẢNH BÁO: PHÒNG/THÁNG KHÔNG KHỚP'
        ELSE N'KHỚP HÓA ĐƠN E2E'
    END AS KiemTra
FROM (VALUES
    (N'HD2026100001', N'E2E_REL_20261001_A'),
    (N'HD2026100002', N'E2E_REL_20261001_B')
) expected(MaHoaDon, MaSinhVien)
LEFT JOIN dbo.HoaDon hd ON hd.MaHoaDon = expected.MaHoaDon
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
ORDER BY expected.MaHoaDon;

;WITH Targets AS
(
    SELECT MaSinhVien
    FROM (VALUES
        (N'E2E_REL_20261001_A'), (N'E2E_REL_20261001_B'), (N'TEST_DK_002')
    ) v(MaSinhVien)
)
SELECT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.TenPhong, hd.NgayLap,
       hd.TrangThaiThanhToan, hd.TongTien
FROM dbo.HoaDon hd
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
WHERE hd.MaSinhVien IN (SELECT MaSinhVien FROM Targets)
ORDER BY hd.MaSinhVien, hd.NgayLap, hd.MaHoaDon;

;WITH Targets AS
(
    SELECT MaSinhVien
    FROM (VALUES
        (N'E2E_REL_20261001_A'), (N'E2E_REL_20261001_B'), (N'TEST_DK_002')
    ) v(MaSinhVien)
)
SELECT DISTINCT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.TenPhong, hd.NgayLap,
       hd.TrangThaiThanhToan, gd.MaGiaoDich, gd.PhuongThuc, gd.TrangThai,
       gd.TongTien AS TongTienGiaoDich, gd.NgayTao, gd.NgayThanhToan, gd.XacNhanBoi
FROM dbo.GiaoDichThanhToan gd
LEFT JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaGiaoDich = gd.MaGiaoDich
LEFT JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
LEFT JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = gd.MaSinhVien
WHERE gd.MaSinhVien IN (SELECT MaSinhVien FROM Targets)
   OR hd.MaSinhVien IN (SELECT MaSinhVien FROM Targets)
ORDER BY gd.MaSinhVien, gd.NgayTao, gd.MaGiaoDich;

;WITH Targets AS
(
    SELECT MaSinhVien
    FROM (VALUES
        (N'E2E_REL_20261001_A'), (N'E2E_REL_20261001_B'), (N'TEST_DK_002')
    ) v(MaSinhVien)
)
SELECT hd.MaHopDong, hd.MaSinhVien, sv.HoTen, hd.TenPhong, hd.NgayBatDau,
       hd.NgayKetThuc, hd.TrangThaiHopDong
FROM dbo.HopDong hd
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
WHERE hd.MaSinhVien IN (SELECT MaSinhVien FROM Targets)
ORDER BY hd.MaSinhVien, hd.MaHopDong;

;WITH Targets AS
(
    SELECT MaSinhVien
    FROM (VALUES
        (N'E2E_REL_20261001_A'), (N'E2E_REL_20261001_B'), (N'TEST_DK_002')
    ) v(MaSinhVien)
)
SELECT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.TenPhong, hd.NgayLap,
       hd.TrangThaiThanhToan, hd.TongTien,
       CASE WHEN hd.MaSinhVien IN (SELECT MaSinhVien FROM Targets)
            THEN N'HÓA ĐƠN CỦA MSSV TEST'
            ELSE N'CẢNH BÁO: CÒN SINH VIÊN KHÁC — SẼ KHÔNG XÓA'
       END AS KiemTra
FROM dbo.HoaDon hd
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
WHERE hd.TenPhong = N'A101'
  AND hd.NgayLap >= '20261001'
  AND hd.NgayLap < '20261101'
ORDER BY hd.MaHoaDon;

SELECT
    room.TenPhong, room.SoSinhVienHienTai AS SiSoDangLuu,
    room.TrangThaiPhong AS TrangThaiDangLuu,
    occupancy.SoSinhVienThucTe AS SiSoTheoSinhVienDangO,
    room.SucChuaToiDa,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM dbo.SinhVien sv
            WHERE sv.TenPhong = room.TenPhong
              AND sv.TrangThaiSinhVien = N'Đang ở'
              AND sv.MaSinhVien NOT IN (N'E2E_REL_20261001_A', N'E2E_REL_20261001_B', N'TEST_DK_002')
        ) THEN N'CẢNH BÁO: CÒN SINH VIÊN KHÁC — GIỮ PHÒNG, CHỈ TÍNH LẠI SĨ SỐ'
        ELSE N'CHỈ CÒN HỒ SƠ TEST HOẶC PHÒNG TRỐNG'
    END AS KiemTraPhong
FROM dbo.Phong room
OUTER APPLY (
    SELECT COUNT_BIG(*) AS SoSinhVienThucTe
    FROM dbo.SinhVien sv
    WHERE sv.TenPhong = room.TenPhong
      AND sv.TrangThaiSinhVien = N'Đang ở'
) occupancy
WHERE room.TenPhong = N'A101'
   OR room.TenPhong IN (
       SELECT sv.TenPhong FROM dbo.SinhVien sv
       WHERE sv.MaSinhVien IN (N'E2E_REL_20261001_A', N'E2E_REL_20261001_B', N'TEST_DK_002')
         AND sv.TenPhong IS NOT NULL
   );

PRINT N'CHỈ ĐỌC: các kết quả trên là kiểm kê; không có lệnh ghi/xóa dữ liệu.';
GO
