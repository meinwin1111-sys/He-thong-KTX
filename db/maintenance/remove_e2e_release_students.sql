USE [KTX_Group3];
GO
SET XACT_ABORT ON;
SET NOCOUNT ON;

/*
  Script xóa có chủ đích, chỉ dành cho các MSSV/định danh ghi rõ bên dưới.
  KHÔNG chạy trước khi xem kết quả inspect_e2e_release_students.sql và được xác nhận.
  Trước khi sửa ROLLBACK thành COMMIT, hãy sao lưu: BACKUP DATABASE KTX_Group3.
  Mặc định luôn ROLLBACK; không tự đổi sang COMMIT.
  Không xóa phòng A101 hoặc dữ liệu/hóa đơn của sinh viên khác.
*/

DECLARE @Students TABLE
(
    MaSinhVien nvarchar(20) NOT NULL PRIMARY KEY,
    HoTenMongDoi nvarchar(100) NOT NULL,
    EmailDangNhapMongDoi varchar(100) NULL,
    DiaChiMongDoi nvarchar(255) NULL,
    TenPhongMongDoi nvarchar(50) NULL
);

DECLARE @InvoiceTargets TABLE
(
    MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY,
    MaSinhVienMongDoi nvarchar(20) NOT NULL
);

DECLARE @Rooms TABLE (TenPhong nvarchar(50) NOT NULL PRIMARY KEY);
DECLARE @Deleted TABLE
(
    ThuTu int IDENTITY(1,1) NOT NULL,
    Bang nvarchar(60) NOT NULL,
    SoDong int NOT NULL
);
DECLARE @Rows int = 0;
DECLARE @RegistrationRows int = 0;
DECLARE @StudentA nvarchar(20) = N'E2E_REL_20261001_A';
DECLARE @StudentB nvarchar(20) = N'E2E_REL_20261001_B';
DECLARE @StudentC nvarchar(20) = N'TEST_DK_002';

INSERT INTO @Students
    (MaSinhVien, HoTenMongDoi, EmailDangNhapMongDoi, DiaChiMongDoi, TenPhongMongDoi)
VALUES
    (@StudentA, N'E2E Release Student A', NULL, N'E2E fixture', N'A101'),
    (@StudentB, N'E2E Release Student B', NULL, N'E2E fixture', N'A101'),
    (@StudentC, N'test', 'test.dk002@gmail.com', NULL, NULL);

INSERT INTO @InvoiceTargets (MaHoaDon, MaSinhVienMongDoi)
VALUES
    (N'HD2026100001', @StudentA),
    (N'HD2026100002', @StudentB);

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.SinhVien sv
        INNER JOIN @Students target ON target.MaSinhVien = sv.MaSinhVien
        WHERE sv.HoTen <> target.HoTenMongDoi
           OR (target.TenPhongMongDoi IS NOT NULL
               AND ISNULL(sv.TenPhong, N'') <> target.TenPhongMongDoi)
           OR (target.DiaChiMongDoi IS NOT NULL
               AND ISNULL(sv.DiaChi, N'') <> target.DiaChiMongDoi)
    )
        THROW 51000, N'Dừng: hồ sơ mục tiêu không khớp MSSV/tên/phòng/địa chỉ đã xác định. Không xóa.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.TaiKhoan tk
        INNER JOIN @Students target
            ON target.EmailDangNhapMongDoi IS NOT NULL
           AND tk.Email = target.EmailDangNhapMongDoi
        WHERE ISNULL(tk.MaSinhVien, N'') <> target.MaSinhVien
    )
        THROW 51001, N'Dừng: email test.dk002@gmail.com đang liên kết với MSSV khác. Không xóa tài khoản.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.TaiKhoan tk
        INNER JOIN @Students target
            ON target.MaSinhVien = tk.MaSinhVien
           AND target.EmailDangNhapMongDoi IS NOT NULL
        WHERE tk.Email <> target.EmailDangNhapMongDoi
    )
        THROW 51002, N'Dừng: tài khoản TEST_DK_002 có email khác email test đã chỉ định. Kiểm tra thủ công.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.HoaDon hd
        INNER JOIN @InvoiceTargets target ON target.MaHoaDon = hd.MaHoaDon
        WHERE hd.MaSinhVien <> target.MaSinhVienMongDoi
           OR hd.TenPhong <> N'A101'
           OR hd.NgayLap IS NULL
           OR hd.NgayLap < '20261001'
           OR hd.NgayLap >= '20261101'
    )
        THROW 51003, N'Dừng: HD2026100001/HD2026100002 không khớp đúng MSSV, A101 và tháng 10/2026. Không xóa.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.ChiTietGiaoDich cgd
        INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
        INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
        WHERE (gd.MaSinhVien IN (SELECT MaSinhVien FROM @Students)
               AND hd.MaSinhVien NOT IN (SELECT MaSinhVien FROM @Students))
           OR (hd.MaSinhVien IN (SELECT MaSinhVien FROM @Students)
               AND gd.MaSinhVien NOT IN (SELECT MaSinhVien FROM @Students))
    )
        THROW 51004, N'Dừng: giao dịch đang liên kết chéo giữa test và sinh viên khác. Không xóa.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.TaiKhoan tk
        INNER JOIN @Students target ON target.MaSinhVien = tk.MaSinhVien
        WHERE EXISTS (SELECT 1 FROM dbo.GiaoDichThanhToan gd WHERE gd.XacNhanBoi = tk.MaTaiKhoan)
           OR EXISTS (SELECT 1 FROM dbo.YeuCauSinhVien yc WHERE yc.XuLyBoi = tk.MaTaiKhoan)
           OR EXISTS (SELECT 1 FROM dbo.LichSuHopDong ls WHERE ls.NguoiThucHien = tk.MaTaiKhoan)
    )
        THROW 51005, N'Dừng: tài khoản test đang được tham chiếu là người xác nhận/xử lý. Không xóa tài khoản.', 1;

    IF OBJECT_ID(N'dbo.DangKySinhVienChoDuyet', N'U') IS NOT NULL
    BEGIN
        EXEC sys.sp_executesql
            N'IF EXISTS (SELECT 1 FROM dbo.DangKySinhVienChoDuyet WHERE XuLyBoi IN
              (SELECT MaTaiKhoan FROM dbo.TaiKhoan WHERE MaSinhVien IN (@A, @B, @C)))
                THROW 51006, N''Dừng: tài khoản test là người xử lý đăng ký. Không xóa.'', 1;',
            N'@A nvarchar(20), @B nvarchar(20), @C nvarchar(20)',
            @A = @StudentA, @B = @StudentB, @C = @StudentC;
    END;

    INSERT INTO @Rooms (TenPhong)
    SELECT DISTINCT sv.TenPhong
    FROM dbo.SinhVien sv
    INNER JOIN @Students target ON target.MaSinhVien = sv.MaSinhVien
    WHERE sv.TenPhong IS NOT NULL;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.SinhVien sv
        WHERE sv.TenPhong = N'A101'
          AND sv.TrangThaiSinhVien = N'Đang ở'
          AND sv.MaSinhVien NOT IN (SELECT MaSinhVien FROM @Students)
    )
        PRINT N'CẢNH BÁO: A101 còn sinh viên khác; chỉ xóa MSSV test và sẽ tính lại sĩ số, không xóa sinh viên/phòng thật.';

    IF EXISTS
    (
        SELECT 1
        FROM dbo.HoaDon hd
        WHERE hd.TenPhong = N'A101'
          AND hd.NgayLap >= '20261001'
          AND hd.NgayLap < '20261101'
          AND hd.MaSinhVien NOT IN (SELECT MaSinhVien FROM @Students)
    )
        PRINT N'CẢNH BÁO: A101/tháng 10-2026 còn hóa đơn của MSSV khác; các hóa đơn đó không bị xóa.';

    DELETE cgd
    FROM dbo.ChiTietGiaoDich cgd
    WHERE EXISTS
    (
        SELECT 1
        FROM dbo.GiaoDichThanhToan gd
        INNER JOIN @Students target ON target.MaSinhVien = gd.MaSinhVien
        WHERE gd.MaGiaoDich = cgd.MaGiaoDich
    )
    OR EXISTS
    (
        SELECT 1
        FROM dbo.ChiTietHoaDon chi
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
        INNER JOIN @Students target ON target.MaSinhVien = hd.MaSinhVien
        WHERE chi.MaChiTiet = cgd.MaChiTiet
    );
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'ChiTietGiaoDich', @Rows);

    DELETE gd
    FROM dbo.GiaoDichThanhToan gd
    INNER JOIN @Students target ON target.MaSinhVien = gd.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'GiaoDichThanhToan', @Rows);

    DELETE yc
    FROM dbo.YeuCauSinhVien yc
    INNER JOIN @Students target ON target.MaSinhVien = yc.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'YeuCauSinhVien', @Rows);

    DELETE ls
    FROM dbo.LichSuHopDong ls
    INNER JOIN @Students target ON target.MaSinhVien = ls.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'LichSuHopDong', @Rows);

    DELETE nk
    FROM dbo.NhatKyHeThong nk
    WHERE nk.MaTaiKhoan IN
          (SELECT tk.MaTaiKhoan FROM dbo.TaiKhoan tk
           INNER JOIN @Students target ON target.MaSinhVien = tk.MaSinhVien)
       OR nk.MaDoiTuong IN
          (SELECT target.MaSinhVien FROM @Students target
           UNION SELECT hd.MaHoaDon FROM dbo.HoaDon hd
                 INNER JOIN @Students target ON target.MaSinhVien = hd.MaSinhVien
           UNION SELECT hd.MaHopDong FROM dbo.HopDong hd
                 INNER JOIN @Students target ON target.MaSinhVien = hd.MaSinhVien
           UNION SELECT yc.MaYeuCau FROM dbo.YeuCauSinhVien yc
                 INNER JOIN @Students target ON target.MaSinhVien = yc.MaSinhVien
           UNION SELECT gd.MaGiaoDich FROM dbo.GiaoDichThanhToan gd
                 INNER JOIN @Students target ON target.MaSinhVien = gd.MaSinhVien);
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'NhatKyHeThong (liên quan trực tiếp)', @Rows);

    IF OBJECT_ID(N'dbo.DangKySinhVienChoDuyet', N'U') IS NOT NULL
    BEGIN
        EXEC sys.sp_executesql
            N'DELETE FROM dbo.DangKySinhVienChoDuyet
              WHERE MaSinhVien IN (@A, @B, @C);
              SET @RowsOut = @@ROWCOUNT;',
            N'@A nvarchar(20), @B nvarchar(20), @C nvarchar(20), @RowsOut int OUTPUT',
            @A = @StudentA, @B = @StudentB, @C = @StudentC,
            @RowsOut = @RegistrationRows OUTPUT;
    END;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'DangKySinhVienChoDuyet', @RegistrationRows);

    IF OBJECT_ID(N'dbo.TRG_ChiTietHoaDon_BaoVe', N'TR') IS NOT NULL
        DISABLE TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe ON dbo.ChiTietHoaDon;

    DELETE chi
    FROM dbo.ChiTietHoaDon chi
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
    INNER JOIN @Students target ON target.MaSinhVien = hd.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'ChiTietHoaDon', @Rows);

    IF OBJECT_ID(N'dbo.TRG_ChiTietHoaDon_BaoVe', N'TR') IS NOT NULL
        ENABLE TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe ON dbo.ChiTietHoaDon;

    DELETE hd
    FROM dbo.HoaDon hd
    INNER JOIN @Students target ON target.MaSinhVien = hd.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'HoaDon', @Rows);

    DELETE hd
    FROM dbo.HopDong hd
    INNER JOIN @Students target ON target.MaSinhVien = hd.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'HopDong', @Rows);

    DELETE tk
    FROM dbo.TaiKhoan tk
    INNER JOIN @Students target ON target.MaSinhVien = tk.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'TaiKhoan', @Rows);

    DELETE sv
    FROM dbo.SinhVien sv
    INNER JOIN @Students target ON target.MaSinhVien = sv.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'SinhVien', @Rows);

    UPDATE room
    SET SoSinhVienHienTai = ISNULL(occupancy.SoSinhVien, 0),
        TrangThaiPhong = CASE
            WHEN room.TrangThaiPhong IN (N'Bảo trì', N'Ngưng sử dụng') THEN room.TrangThaiPhong
            WHEN ISNULL(occupancy.SoSinhVien, 0) >= room.SucChuaToiDa THEN N'Đầy'
            ELSE N'Trống'
        END
    FROM dbo.Phong room
    INNER JOIN @Rooms targetRoom ON targetRoom.TenPhong = room.TenPhong
    OUTER APPLY
    (
        SELECT COUNT(*) AS SoSinhVien
        FROM dbo.SinhVien sv
        WHERE sv.TenPhong = room.TenPhong
          AND sv.TrangThaiSinhVien = N'Đang ở'
    ) occupancy;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'Phong (cập nhật sĩ số/trạng thái)', @Rows);

    SELECT Bang, SoDong FROM @Deleted ORDER BY ThuTu;
    SELECT room.TenPhong, COUNT_BIG(sv.MaSinhVien) AS SiSoConLai,
           room.SucChuaToiDa, room.TrangThaiPhong
    FROM dbo.Phong room
    LEFT JOIN dbo.SinhVien sv
        ON sv.TenPhong = room.TenPhong
       AND sv.TrangThaiSinhVien = N'Đang ở'
    WHERE room.TenPhong IN (SELECT TenPhong FROM @Rooms)
    GROUP BY room.TenPhong, room.SucChuaToiDa, room.TrangThaiPhong;

    ROLLBACK TRANSACTION;
    PRINT N'Đã ROLLBACK; không có thay đổi nào được lưu.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
