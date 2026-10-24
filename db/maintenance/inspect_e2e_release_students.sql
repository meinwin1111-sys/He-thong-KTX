:on error exit
IF DB_NAME() = N'master'
    THROW 51802, N'Chạy script bằng sqlcmd -d với database đích.', 1;
GO
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.ChiTietHopDong', N'U') IS NULL
    THROW 51710, N'Cần chạy migration 014 trước khi kiểm tra sinh viên release.', 1;
GO

/*
  CHỈ ĐỌC — chỉ truy vấn dữ liệu thật; không thay đổi bảng.
  Chỉ kiểm tra chính xác ba MSSV/định danh dưới đây, không dùng LIKE.
  Hợp đồng được nối qua ChiTietHopDong; lịch sử lưu trú được giữ ở
  LichSuHopDong_Backup và NhatKyHeThong sau migration 014.
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
    (N'HopDong (có thành viên mục tiêu)', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.HopDong hd
        WHERE EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong c
            WHERE c.MaHopDong = hd.MaHopDong AND c.MaSinhVien = target.MaSinhVien
        )
    ))),
    (N'ChiTietHopDong', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.ChiTietHopDong c WHERE c.MaSinhVien = target.MaSinhVien
    ))),
    (N'LichSuHopDong_Backup', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.LichSuHopDong_Backup ls WHERE ls.MaSinhVien = target.MaSinhVien
    ))),
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
    (N'YeuCauSinhVien', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.YeuCauSinhVien yc WHERE yc.MaSinhVien = target.MaSinhVien
    ))),
    (N'NhatKyHeThong', CONVERT(bigint, (
        SELECT COUNT_BIG(*) FROM dbo.NhatKyHeThong nk
        WHERE nk.MaTaiKhoan IN (
            SELECT tk.MaTaiKhoan FROM dbo.TaiKhoan tk
            WHERE tk.MaSinhVien = target.MaSinhVien
               OR (target.EmailDangNhapMongDoi IS NOT NULL AND tk.Email = target.EmailDangNhapMongDoi)
        )
        OR nk.MaDoiTuong IN (
            SELECT target.MaSinhVien
            UNION SELECT hd.MaHoaDon FROM dbo.HoaDon hd WHERE hd.MaSinhVien = target.MaSinhVien
            UNION SELECT hd.MaHopDong FROM dbo.HopDong hd
                WHERE EXISTS (
                    SELECT 1 FROM dbo.ChiTietHopDong c
                    WHERE c.MaHopDong = hd.MaHopDong AND c.MaSinhVien = target.MaSinhVien
                )
            UNION SELECT N'LichSuHopDong:' + CONVERT(nvarchar(10), ls.MaLichSu)
                FROM dbo.LichSuHopDong_Backup ls WHERE ls.MaSinhVien = target.MaSinhVien
            UNION SELECT yc.MaYeuCau FROM dbo.YeuCauSinhVien yc WHERE yc.MaSinhVien = target.MaSinhVien
            UNION SELECT gd.MaGiaoDich FROM dbo.GiaoDichThanhToan gd
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
SELECT hd.MaHopDong, hd.TenPhong, hd.MaHangPhong, hd.NgayBatDau, hd.NgayKetThuc,
       hd.TrangThaiHopDong, c.MaChiTiet, c.MaSinhVien, sv.HoTen,
       c.NgayVao, c.NgayRa, c.TrangThai AS TrangThaiThanhVien,
       c.LaNguoiDaiDienThanhToanDichVu,
       CASE WHEN target.MaSinhVien IS NULL THEN N'SINH VIÊN KHÁC — GIỮ HỢP ĐỒNG'
            ELSE N'MSSV MỤC TIÊU' END AS PhamVi
FROM dbo.HopDong hd
INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
LEFT JOIN Targets target ON target.MaSinhVien = c.MaSinhVien
WHERE EXISTS (
    SELECT 1 FROM dbo.ChiTietHopDong member
    INNER JOIN Targets t ON t.MaSinhVien = member.MaSinhVien
    WHERE member.MaHopDong = hd.MaHopDong
)
ORDER BY hd.MaHopDong, c.NgayVao, c.MaChiTiet;

;WITH Targets AS
(
    SELECT MaSinhVien
    FROM (VALUES
        (N'E2E_REL_20261001_A'), (N'E2E_REL_20261001_B'), (N'TEST_DK_002')
    ) v(MaSinhVien)
)
SELECT ls.MaLichSu, ls.MaHopDong, ls.MaSinhVien, ls.HoTen, ls.TenPhong,
       ls.ThaoTac, ls.ThoiGian, ls.NguoiThucHien
FROM dbo.LichSuHopDong_Backup ls
WHERE ls.MaSinhVien IN (SELECT MaSinhVien FROM Targets)
ORDER BY ls.MaSinhVien, ls.ThoiGian, ls.MaLichSu;

;WITH Targets AS
(
    SELECT MaSinhVien
    FROM (VALUES
        (N'E2E_REL_20261001_A'), (N'E2E_REL_20261001_B'), (N'TEST_DK_002')
    ) v(MaSinhVien)
),
TargetContracts AS
(
    SELECT DISTINCT c.MaHopDong
    FROM dbo.ChiTietHopDong c
    INNER JOIN Targets t ON t.MaSinhVien = c.MaSinhVien
),
TargetHistory AS
(
    SELECT N'LichSuHopDong:' + CONVERT(nvarchar(10), ls.MaLichSu) AS MaDoiTuong
    FROM dbo.LichSuHopDong_Backup ls
    INNER JOIN Targets t ON t.MaSinhVien = ls.MaSinhVien
)
SELECT nk.MaNhatKy, nk.ThoiGian, nk.MaTaiKhoan, nk.HanhDong, nk.DoiTuong,
       nk.MaDoiTuong, nk.ChiTiet
FROM dbo.NhatKyHeThong nk
WHERE nk.MaTaiKhoan IN (
    SELECT tk.MaTaiKhoan FROM dbo.TaiKhoan tk
    WHERE tk.MaSinhVien IN (SELECT MaSinhVien FROM Targets)
)
   OR nk.MaDoiTuong IN (
       SELECT MaSinhVien FROM Targets
       UNION SELECT MaHopDong FROM TargetContracts
       UNION SELECT MaDoiTuong FROM TargetHistory
   )
ORDER BY nk.ThoiGian, nk.MaNhatKy;

;WITH Targets AS
(
    SELECT MaSinhVien
    FROM (VALUES
        (N'E2E_REL_20261001_A'), (N'E2E_REL_20261001_B'), (N'TEST_DK_002')
    ) v(MaSinhVien)
),
TargetRooms AS
(
    SELECT hd.TenPhong
    FROM dbo.ChiTietHopDong c
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
    INNER JOIN Targets t ON t.MaSinhVien = c.MaSinhVien
    UNION
    SELECT sv.TenPhong
    FROM dbo.SinhVien sv
    INNER JOIN Targets t ON t.MaSinhVien = sv.MaSinhVien
    WHERE sv.TenPhong IS NOT NULL
)
SELECT room.TenPhong, room.SoSinhVienHienTai AS SiSoDangLuu,
       room.TrangThaiPhong AS TrangThaiDangLuu,
       occupancy.SoSinhVienThucTe, room.SucChuaToiDa,
       CASE
           WHEN EXISTS (
               SELECT 1
               FROM dbo.ChiTietHopDong c
               INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
               WHERE hd.TenPhong = room.TenPhong
                 AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                 AND c.TrangThai = N'Đang ở'
                 AND c.MaSinhVien NOT IN
                     (N'E2E_REL_20261001_A', N'E2E_REL_20261001_B', N'TEST_DK_002')
           ) THEN N'CẢNH BÁO: CÒN THÀNH VIÊN KHÁC — GIỮ PHÒNG'
           ELSE N'CHỈ CÒN HỒ SƠ TEST HOẶC PHÒNG TRỐNG'
       END AS KiemTraPhong
FROM dbo.Phong room
INNER JOIN TargetRooms targetRoom ON targetRoom.TenPhong = room.TenPhong
OUTER APPLY (
    SELECT COUNT_BIG(*) AS SoSinhVienThucTe
    FROM dbo.ChiTietHopDong c
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
    WHERE hd.TenPhong = room.TenPhong
      AND hd.TrangThaiHopDong = N'Còn hiệu lực'
      AND c.TrangThai = N'Đang ở'
) occupancy
ORDER BY room.TenPhong;

PRINT N'CHỈ ĐỌC: các kết quả trên là kiểm kê; không có lệnh ghi/xóa dữ liệu.';
GO
