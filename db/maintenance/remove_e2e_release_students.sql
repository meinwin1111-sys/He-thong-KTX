:on error exit
IF DB_NAME() = N'master'
    THROW 51801, N'Chạy script bằng sqlcmd -d với database đích.', 1;
GO
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.ChiTietHopDong', N'U') IS NULL
    THROW 51711, N'Cần chạy migration 014 trước khi dọn sinh viên release.', 1;
GO

/*
  Chỉ dành cho các MSSV/định danh ghi rõ bên dưới.
  Mặc định chạy thử trong transaction rồi ROLLBACK.
  Chỉ lưu thay đổi khi đổi DECLARE @ApDung bit = 0 thành 1 sau khi xem inspect_e2e_release_students.sql.
  Trước khi áp dụng thật, hãy sao lưu database.
  Hợp đồng chỉ bị xóa khi không còn bất kỳ ChiTietHopDong nào.
  LichSuHopDong_Backup và NhatKyHeThong được giữ để bảo toàn audit.
*/

DECLARE @ApDung bit = 0;

DECLARE @Students TABLE
(
    MaSinhVien nvarchar(30) NOT NULL PRIMARY KEY,
    HoTenMongDoi nvarchar(100) NOT NULL,
    EmailDangNhapMongDoi varchar(100) NULL,
    DiaChiMongDoi nvarchar(255) NULL,
    TenPhongMongDoi nvarchar(50) NULL
);

DECLARE @InvoiceTargets TABLE
(
    MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY,
    MaSinhVienMongDoi nvarchar(30) NOT NULL
);

DECLARE @Rooms TABLE (TenPhong nvarchar(50) NOT NULL PRIMARY KEY);
DECLARE @ContractTargets TABLE (MaHopDong nvarchar(20) NOT NULL PRIMARY KEY);
DECLARE @ContractStateBefore TABLE
(
    MaHopDong nvarchar(20) NOT NULL PRIMARY KEY,
    TrangThaiHopDong nvarchar(20) NOT NULL,
    NgayKetThucThucTe date NULL
);
DECLARE @AffectedStudents TABLE (MaSinhVien nvarchar(30) NOT NULL PRIMARY KEY);
DECLARE @RepresentativeChanges TABLE
(
    MaHopDong nvarchar(20) NOT NULL PRIMARY KEY,
    MaChiTietCu int NOT NULL,
    MaChiTietMoi int NOT NULL
);
DECLARE @Deleted TABLE
(
    ThuTu int IDENTITY(1,1) NOT NULL,
    Bang nvarchar(80) NOT NULL,
    SoDong int NOT NULL
);
DECLARE @Rows int = 0;
DECLARE @RegistrationRows int = 0;
DECLARE @HoaDonTriggerWasEnabled bit =
    CASE WHEN OBJECT_ID(N'dbo.TRG_ChiTietHoaDon_BaoVe', N'TR') IS NOT NULL
              AND OBJECTPROPERTY(OBJECT_ID(N'dbo.TRG_ChiTietHoaDon_BaoVe'), N'ExecIsTriggerDisabled') = 0
         THEN 1 ELSE 0 END;
DECLARE @StudentA nvarchar(30) = N'E2E_REL_20261001_A';
DECLARE @StudentB nvarchar(30) = N'E2E_REL_20261001_B';
DECLARE @StudentC nvarchar(30) = N'TEST_DK_002';

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
               AND NOT EXISTS (
                   SELECT 1 FROM @Students target WHERE target.MaSinhVien = hd.MaSinhVien
               ))
           OR (hd.MaSinhVien IN (SELECT MaSinhVien FROM @Students)
               AND NOT EXISTS (
                   SELECT 1 FROM @Students target WHERE target.MaSinhVien = gd.MaSinhVien
               ))
    )
        THROW 51004, N'Dừng: giao dịch đang liên kết chéo giữa test và sinh viên khác. Không xóa.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.TaiKhoan tk
        INNER JOIN @Students target ON target.MaSinhVien = tk.MaSinhVien
        WHERE EXISTS (SELECT 1 FROM dbo.GiaoDichThanhToan gd WHERE gd.XacNhanBoi = tk.MaTaiKhoan)
           OR EXISTS (SELECT 1 FROM dbo.YeuCauSinhVien yc WHERE yc.XuLyBoi = tk.MaTaiKhoan)
           OR EXISTS (
               SELECT 1 FROM dbo.LichSuHopDong_Backup ls
               WHERE ls.NguoiThucHien = tk.MaTaiKhoan
           )
           OR EXISTS (
               SELECT 1 FROM dbo.NhatKyHeThong nk
               WHERE nk.MaTaiKhoan = tk.MaTaiKhoan
           )
    )
        THROW 51005, N'Dừng: tài khoản test đang được dùng làm người xác nhận/xử lý/ghi audit. Không xóa tài khoản.', 1;

    IF OBJECT_ID(N'dbo.DangKySinhVienChoDuyet', N'U') IS NOT NULL
    BEGIN
        EXEC sys.sp_executesql
            N'IF EXISTS (SELECT 1 FROM dbo.DangKySinhVienChoDuyet WHERE XuLyBoi IN
              (SELECT MaTaiKhoan FROM dbo.TaiKhoan WHERE MaSinhVien IN (@A, @B, @C)))
                THROW 51006, N''Dừng: tài khoản test là người xử lý đăng ký. Không xóa.'', 1;',
            N'@A nvarchar(30), @B nvarchar(30), @C nvarchar(30)',
            @A = @StudentA, @B = @StudentB, @C = @StudentC;
    END;

    INSERT INTO @ContractTargets (MaHopDong)
    SELECT DISTINCT c.MaHopDong
    FROM dbo.ChiTietHopDong c
    INNER JOIN @Students target ON target.MaSinhVien = c.MaSinhVien;

    INSERT INTO @ContractStateBefore (MaHopDong, TrangThaiHopDong, NgayKetThucThucTe)
    SELECT hd.MaHopDong, hd.TrangThaiHopDong, hd.NgayKetThucThucTe
    FROM dbo.HopDong hd
    INNER JOIN @ContractTargets target ON target.MaHopDong = hd.MaHopDong;

    INSERT INTO @AffectedStudents (MaSinhVien)
    SELECT c.MaSinhVien
    FROM dbo.ChiTietHopDong c
    INNER JOIN @ContractTargets target ON target.MaHopDong = c.MaHopDong
    UNION
    SELECT MaSinhVien FROM @Students;

    INSERT INTO @Rooms (TenPhong)
    SELECT hd.TenPhong
    FROM dbo.HopDong hd
    INNER JOIN @ContractTargets target ON target.MaHopDong = hd.MaHopDong
    UNION
    SELECT sv.TenPhong
    FROM dbo.SinhVien sv
    INNER JOIN @Students target ON target.MaSinhVien = sv.MaSinhVien
    WHERE sv.TenPhong IS NOT NULL;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.SinhVien sv
        WHERE sv.TenPhong = N'A101'
          AND sv.TrangThaiSinhVien = N'Đang ở'
          AND NOT EXISTS (SELECT 1 FROM @Students target WHERE target.MaSinhVien = sv.MaSinhVien)
    )
        PRINT N'CẢNH BÁO: A101 còn sinh viên khác; chỉ xóa MSSV test và sẽ tính lại sĩ số, không xóa sinh viên/phòng thật.';

    IF EXISTS
    (
        SELECT 1
        FROM dbo.HoaDon hd
        WHERE hd.TenPhong = N'A101'
          AND hd.NgayLap >= '20261001'
          AND hd.NgayLap < '20261101'
          AND NOT EXISTS (SELECT 1 FROM @Students target WHERE target.MaSinhVien = hd.MaSinhVien)
    )
        PRINT N'CẢNH BÁO: A101/tháng 10-2026 còn hóa đơn của MSSV khác; các hóa đơn đó không bị xóa.';

    INSERT INTO @RepresentativeChanges (MaHopDong, MaChiTietCu, MaChiTietMoi)
    SELECT c.MaHopDong, c.MaChiTiet, replacement.MaChiTiet
    FROM dbo.ChiTietHopDong c
    INNER JOIN @Students target ON target.MaSinhVien = c.MaSinhVien
    CROSS APPLY
    (
        SELECT TOP (1) candidate.MaChiTiet
        FROM dbo.ChiTietHopDong candidate
        WHERE candidate.MaHopDong = c.MaHopDong
          AND candidate.MaChiTiet <> c.MaChiTiet
          AND candidate.TrangThai = N'Đang ở'
          AND NOT EXISTS (
              SELECT 1 FROM @Students removing WHERE removing.MaSinhVien = candidate.MaSinhVien
          )
        ORDER BY candidate.NgayVao, candidate.MaChiTiet
    ) replacement
    WHERE c.TrangThai = N'Đang ở'
      AND c.LaNguoiDaiDienThanhToanDichVu = 1;

    UPDATE c
    SET LaNguoiDaiDienThanhToanDichVu = 0
    FROM dbo.ChiTietHopDong c
    INNER JOIN @RepresentativeChanges change ON change.MaChiTietCu = c.MaChiTiet;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'ChiTietHopDong (bỏ đại diện cũ)', @Rows);

    UPDATE c
    SET LaNguoiDaiDienThanhToanDichVu = 1
    FROM dbo.ChiTietHopDong c
    INNER JOIN @RepresentativeChanges change ON change.MaChiTietMoi = c.MaChiTiet;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'ChiTietHopDong (chuyển đại diện)', @Rows);

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

    IF OBJECT_ID(N'dbo.DangKySinhVienChoDuyet', N'U') IS NOT NULL
    BEGIN
        EXEC sys.sp_executesql
            N'DELETE FROM dbo.DangKySinhVienChoDuyet
              WHERE MaSinhVien IN (@A, @B, @C);
              SET @RowsOut = @@ROWCOUNT;',
            N'@A nvarchar(30), @B nvarchar(30), @C nvarchar(30), @RowsOut int OUTPUT',
            @A = @StudentA, @B = @StudentB, @C = @StudentC,
            @RowsOut = @RegistrationRows OUTPUT;
    END;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'DangKySinhVienChoDuyet', @RegistrationRows);

    IF @HoaDonTriggerWasEnabled = 1
        DISABLE TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe ON dbo.ChiTietHoaDon;

    DELETE chi
    FROM dbo.ChiTietHoaDon chi
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
    INNER JOIN @Students target ON target.MaSinhVien = hd.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'ChiTietHoaDon', @Rows);

    IF @HoaDonTriggerWasEnabled = 1
        ENABLE TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe ON dbo.ChiTietHoaDon;

    DELETE hd
    FROM dbo.HoaDon hd
    INNER JOIN @Students target ON target.MaSinhVien = hd.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'HoaDon', @Rows);

    DELETE c
    FROM dbo.ChiTietHopDong c
    INNER JOIN @Students target ON target.MaSinhVien = c.MaSinhVien;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'ChiTietHopDong (thành viên mục tiêu)', @Rows);

    INSERT INTO @Deleted (Bang, SoDong)
    SELECT N'HopDong (đổi trạng thái bởi trigger)', COUNT(*)
    FROM dbo.HopDong hd
    INNER JOIN @ContractStateBefore beforeState ON beforeState.MaHopDong = hd.MaHopDong
    WHERE hd.TrangThaiHopDong <> beforeState.TrangThaiHopDong
       OR (hd.NgayKetThucThucTe <> beforeState.NgayKetThucThucTe)
       OR (hd.NgayKetThucThucTe IS NULL AND beforeState.NgayKetThucThucTe IS NOT NULL)
       OR (hd.NgayKetThucThucTe IS NOT NULL AND beforeState.NgayKetThucThucTe IS NULL);

    DELETE hd
    FROM dbo.HopDong hd
    INNER JOIN @ContractTargets target ON target.MaHopDong = hd.MaHopDong
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.ChiTietHopDong c WHERE c.MaHopDong = hd.MaHopDong
    );
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'HopDong (không còn chi tiết)', @Rows);

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

    UPDATE sv
    SET TenPhong = active.TenPhong,
        TrangThaiSinhVien = CASE WHEN active.MaSinhVien IS NULL THEN N'Đã rời KTX' ELSE N'Đang ở' END,
        NgayRoiKTX = CASE WHEN active.MaSinhVien IS NULL
                          THEN COALESCE(sv.NgayRoiKTX, latest.NgayRa, CAST(GETDATE() AS date)) ELSE NULL END
    FROM dbo.SinhVien sv
    INNER JOIN @AffectedStudents affected ON affected.MaSinhVien = sv.MaSinhVien
    OUTER APPLY
    (
        SELECT TOP (1) c.MaSinhVien, hd.TenPhong
        FROM dbo.ChiTietHopDong c
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaSinhVien = sv.MaSinhVien
          AND c.TrangThai = N'Đang ở'
          AND hd.TrangThaiHopDong = N'Còn hiệu lực'
        ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
    ) active
    OUTER APPLY
    (
        SELECT MAX(c.NgayRa) AS NgayRa
        FROM dbo.ChiTietHopDong c
        WHERE c.MaSinhVien = sv.MaSinhVien
          AND c.NgayRa IS NOT NULL
    ) latest
    WHERE ISNULL(sv.TenPhong, N'') <> ISNULL(active.TenPhong, N'')
       OR ISNULL(sv.TrangThaiSinhVien, N'') <> CASE WHEN active.MaSinhVien IS NULL THEN N'Đã rời KTX' ELSE N'Đang ở' END
       OR (active.MaSinhVien IS NULL AND sv.NgayRoiKTX IS NULL)
       OR (active.MaSinhVien IS NOT NULL AND sv.NgayRoiKTX IS NOT NULL);
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'SinhVien (đồng bộ phòng/trạng thái)', @Rows);

    UPDATE room
    SET SoSinhVienHienTai = occupancy.SoSinhVien,
        TrangThaiPhong = CASE
            WHEN room.TrangThaiPhong IN (N'Bảo trì', N'Ngưng sử dụng') THEN room.TrangThaiPhong
            WHEN occupancy.SoSinhVien >= room.SucChuaToiDa THEN N'Đầy'
            ELSE N'Trống'
        END
    FROM dbo.Phong room
    INNER JOIN @Rooms targetRoom ON targetRoom.TenPhong = room.TenPhong
    CROSS APPLY
    (
        SELECT COUNT_BIG(*) AS SoSinhVien
        FROM dbo.ChiTietHopDong c
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE hd.TenPhong = room.TenPhong
          AND hd.TrangThaiHopDong = N'Còn hiệu lực'
          AND c.TrangThai = N'Đang ở'
    ) occupancy;
    SET @Rows = @@ROWCOUNT;
    INSERT INTO @Deleted (Bang, SoDong) VALUES (N'Phong (đồng bộ sĩ số/trạng thái)', @Rows);

    INSERT INTO @Deleted (Bang, SoDong)
    VALUES (N'LichSuHopDong_Backup (giữ audit)', 0),
           (N'NhatKyHeThong (giữ audit)', 0);

    SELECT Bang, SoDong FROM @Deleted ORDER BY ThuTu;
    SELECT room.TenPhong, COUNT_BIG(c.MaSinhVien) AS SiSoConLai,
           room.SucChuaToiDa, room.TrangThaiPhong
    FROM dbo.Phong room
    LEFT JOIN dbo.HopDong hd
        ON hd.TenPhong = room.TenPhong
       AND hd.TrangThaiHopDong = N'Còn hiệu lực'
    LEFT JOIN dbo.ChiTietHopDong c
        ON c.MaHopDong = hd.MaHopDong
       AND c.TrangThai = N'Đang ở'
    WHERE room.TenPhong IN (SELECT TenPhong FROM @Rooms)
    GROUP BY room.TenPhong, room.SucChuaToiDa, room.TrangThaiPhong;

    IF @ApDung = 1
    BEGIN
        COMMIT TRANSACTION;
        PRINT N'Đã COMMIT dọn dữ liệu test theo ApDung=1.';
    END
    ELSE
    BEGIN
        ROLLBACK TRANSACTION;
        PRINT N'DRY-RUN: đã ROLLBACK; không có thay đổi nào được lưu.';
    END;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
