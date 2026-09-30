SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    RAISERROR(N'Chạy migration 001 trước.', 16, 1);
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'004')
    RAISERROR(N'Chạy migration 004 trước.', 16, 1);
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'005')
    PRINT N'[005] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'Seq_MaHopDong' AND SCHEMA_NAME(schema_id) = N'dbo')
        BEGIN
            DECLARE @start int;
            SELECT @start = ISNULL(MAX(TRY_CONVERT(int, SUBSTRING(MaHopDong, 3, 20))), 0) + 1
            FROM dbo.HopDong
            WHERE MaHopDong LIKE N'HD[0-9]%';
            DECLARE @seq nvarchar(400) = N'CREATE SEQUENCE dbo.Seq_MaHopDong AS int START WITH '
                + CAST(@start AS varchar(12)) + N' INCREMENT BY 1 MINVALUE 1 NO CACHE;';
            EXEC sys.sp_executesql @seq;
        END;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVien
    @MaSinhVien VARCHAR(20),
    @HoTen NVARCHAR(100),
    @NgaySinh DATE,
    @GioiTinh NVARCHAR(10),
    @SDT VARCHAR(10),
    @Email VARCHAR(100),
    @DiaChi NVARCHAR(255),
    @TenPhong VARCHAR(20) = NULL,
    @GhiChu NVARCHAR(255) = NULL,
    @Truong NVARCHAR(150) = NULL,
    @Lop NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.SinhVien (
        MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
        TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop
    )
    VALUES (
        @MaSinhVien, @HoTen, @NgaySinh, @GioiTinh, @SDT, @Email, @DiaChi,
        N''Đang ở'', NULLIF(@TenPhong, ''''), @GhiChu, @Truong, @Lop
    );
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ChuyenPhong
    @MaSinhVien VARCHAR(20),
    @PhongMoi VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @PhongCu nvarchar(50), @HoTen nvarchar(100), @GioiTinh nvarchar(10);
        SELECT @PhongCu = sv.TenPhong, @HoTen = sv.HoTen, @GioiTinh = sv.GioiTinh
        FROM dbo.SinhVien sv
        WHERE sv.MaSinhVien = @MaSinhVien;

        IF @HoTen IS NULL
            THROW 50021, N''Sinh viên không tồn tại.'', 1;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.SinhVien
            WHERE MaSinhVien = @MaSinhVien AND TrangThaiSinhVien = N''Đang ở''
        )
            THROW 50022, N''Sinh viên không ở trạng thái Đang ở.'', 1;

        DECLARE @Loai nvarchar(10), @TrangThai nvarchar(20), @Suc int, @HienTai int;
        SELECT @Loai = LoaiPhong, @TrangThai = TrangThaiPhong, @Suc = SucChuaToiDa, @HienTai = SoSinhVienHienTai
        FROM dbo.Phong WHERE TenPhong = @PhongMoi;

        IF @Loai IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.Phong WHERE TenPhong = @PhongMoi)
            THROW 50023, N''Phòng không tồn tại!'', 1;
        IF @GioiTinh <> @Loai
            THROW 50024, N''Sai giới tính phòng!'', 1;
        IF @TrangThai IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 50025, N''Phòng không khả dụng!'', 1;
        IF ISNULL(@PhongCu, N'''') <> @PhongMoi AND @HienTai >= @Suc
            THROW 50026, N''Phòng đã đầy!'', 1;

        UPDATE dbo.SinhVien SET TenPhong = @PhongMoi WHERE MaSinhVien = @MaSinhVien;

        UPDATE dbo.HopDong
        SET TenPhong = @PhongMoi
        WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực'';

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        SELECT hd.MaHopDong, hd.MaSinhVien, @HoTen, @PhongMoi, hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong, N''Chuyển phòng''
        FROM dbo.HopDong hd
        WHERE hd.MaSinhVien = @MaSinhVien AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_XoaSinhVien
    @MaSinhVien VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien)
            THROW 50031, N''Sinh viên không tồn tại.'', 1;

        DECLARE @HoTen nvarchar(100);
        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        SELECT hd.MaHopDong, hd.MaSinhVien, @HoTen, hd.TenPhong, hd.NgayBatDau, hd.NgayKetThuc, N''Đã kết thúc'', N''Kết thúc''
        FROM dbo.HopDong hd
        WHERE hd.MaSinhVien = @MaSinhVien AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'',
            NgayKetThucThucTe = CAST(GETDATE() AS date)
        WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực'';

        UPDATE dbo.SinhVien
        SET TrangThaiSinhVien = N''Đã rời KTX'',
            TenPhong = NULL,
            NgayRoiKTX = CAST(GETDATE() AS date)
        WHERE MaSinhVien = @MaSinhVien;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHopDong
    @MaHopDong VARCHAR(20) = NULL,
    @MaSinhVien VARCHAR(20),
    @TenPhong VARCHAR(20),
    @NgayBatDau DATE,
    @NgayKetThuc DATE,
    @GhiChu NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @NgayKetThuc <= @NgayBatDau
            THROW 50041, N''Ngày kết thúc phải sau ngày bắt đầu.'', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien)
            THROW 50042, N''Sinh viên không tồn tại.'', 1;

        IF EXISTS (
            SELECT 1 FROM dbo.HopDong
            WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực''
        )
            THROW 50043, N''Sinh viên đã có hợp đồng còn hiệu lực.'', 1;

        DECLARE @GioiTinh nvarchar(10), @HoTen nvarchar(100);
        SELECT @GioiTinh = GioiTinh, @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        DECLARE @Loai nvarchar(10), @TrangThai nvarchar(20), @Suc int, @HienTai int, @PhongHienTai nvarchar(50);
        SELECT @Loai = LoaiPhong, @TrangThai = TrangThaiPhong, @Suc = SucChuaToiDa, @HienTai = SoSinhVienHienTai
        FROM dbo.Phong WHERE TenPhong = @TenPhong;
        SELECT @PhongHienTai = TenPhong FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        IF @Loai IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.Phong WHERE TenPhong = @TenPhong)
            THROW 50044, N''Phòng không tồn tại!'', 1;
        IF @GioiTinh <> @Loai
            THROW 50045, N''Sai giới tính phòng!'', 1;
        IF @TrangThai IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 50046, N''Phòng không khả dụng!'', 1;
        IF ISNULL(@PhongHienTai, N'''') <> @TenPhong AND @HienTai >= @Suc
            THROW 50047, N''Phòng đã đầy!'', 1;

        DECLARE @Ma nvarchar(20) = NULLIF(LTRIM(RTRIM(@MaHopDong)), '''');
        IF @Ma IS NULL
            SET @Ma = N''HD'' + RIGHT(N''00000'' + CAST(NEXT VALUE FOR dbo.Seq_MaHopDong AS varchar(10)), 5);

        IF EXISTS (SELECT 1 FROM dbo.HopDong WHERE MaHopDong = @Ma)
            THROW 50048, N''Mã hợp đồng đã tồn tại.'', 1;

        INSERT INTO dbo.HopDong (
            MaHopDong, MaSinhVien, TenPhong, NgayBatDau, NgayKetThuc,
            TrangThaiHopDong, NgayTao, GhiChu
        )
        VALUES (
            @Ma, @MaSinhVien, @TenPhong, @NgayBatDau, @NgayKetThuc,
            N''Còn hiệu lực'', CAST(GETDATE() AS date), @GhiChu
        );

        UPDATE dbo.SinhVien
        SET TenPhong = @TenPhong,
            TrangThaiSinhVien = N''Đang ở'',
            NgayRoiKTX = NULL
        WHERE MaSinhVien = @MaSinhVien;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        VALUES (@Ma, @MaSinhVien, @HoTen, @TenPhong, @NgayBatDau, @NgayKetThuc, N''Còn hiệu lực'', N''Tạo mới'');

        COMMIT TRANSACTION;
        SELECT @Ma AS MaHopDong;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GiaHanHopDong
    @MaHopDong NVARCHAR(20),
    @NgayKetThucMoi DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @NgayCu date, @MaSV nvarchar(20), @TenPhong nvarchar(50), @HoTen nvarchar(100), @NgayBD date;
        SELECT @NgayCu = hd.NgayKetThuc, @MaSV = hd.MaSinhVien, @TenPhong = hd.TenPhong, @NgayBD = hd.NgayBatDau
        FROM dbo.HopDong hd
        WHERE hd.MaHopDong = @MaHopDong AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        IF @NgayCu IS NULL
            THROW 50051, N''Không tìm thấy hợp đồng còn hiệu lực.'', 1;
        IF @NgayKetThucMoi <= @NgayCu
            THROW 50052, N''Ngày kết thúc mới phải sau ngày kết thúc hiện tại.'', 1;

        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSV;

        UPDATE dbo.HopDong
        SET NgayKetThucGoc = ISNULL(NgayKetThucGoc, NgayKetThuc),
            NgayKetThuc = @NgayKetThucMoi,
            SoLanGiaHan = SoLanGiaHan + 1
        WHERE MaHopDong = @MaHopDong;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        VALUES (@MaHopDong, @MaSV, @HoTen, @TenPhong, @NgayBD, @NgayKetThucMoi, N''Còn hiệu lực'', N''Gia hạn'');

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KetThucHopDong
    @MaHopDong NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaSV nvarchar(20), @TenPhong nvarchar(50), @HoTen nvarchar(100), @NgayBD date, @NgayKT date;
        SELECT @MaSV = hd.MaSinhVien, @TenPhong = hd.TenPhong, @NgayBD = hd.NgayBatDau, @NgayKT = hd.NgayKetThuc
        FROM dbo.HopDong hd
        WHERE hd.MaHopDong = @MaHopDong AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        IF @MaSV IS NULL
            THROW 50061, N''Không tìm thấy hợp đồng còn hiệu lực.'', 1;

        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSV;

        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'',
            NgayKetThucThucTe = CAST(GETDATE() AS date)
        WHERE MaHopDong = @MaHopDong;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        VALUES (@MaHopDong, @MaSV, @HoTen, @TenPhong, @NgayBD, @NgayKT, N''Đã kết thúc'', N''Kết thúc'');

        IF NOT EXISTS (
            SELECT 1 FROM dbo.HopDong
            WHERE MaSinhVien = @MaSV AND TrangThaiHopDong = N''Còn hiệu lực''
        )
        BEGIN
            UPDATE dbo.SinhVien
            SET TrangThaiSinhVien = N''Đã rời KTX'',
                TenPhong = NULL,
                NgayRoiKTX = CAST(GETDATE() AS date)
            WHERE MaSinhVien = @MaSV;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDon
    @MaHoaDon VARCHAR(20),
    @MaSinhVien VARCHAR(20),
    @TenPhong VARCHAR(20),
    @TienPhong DECIMAL(18,2),
    @ChiSoDien INT,
    @ChiSoNuoc INT,
    @SoDienCu INT = NULL,
    @SoDienMoi INT = NULL,
    @SoNuocCu INT = NULL,
    @SoNuocMoi INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DonDien decimal(18,2) = 3500, @DonNuoc decimal(18,2) = 15000, @SoNgayHan int = 15;
    SELECT @DonDien = TRY_CONVERT(decimal(18,2), GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''DON_GIA_DIEN'';
    SELECT @DonNuoc = TRY_CONVERT(decimal(18,2), GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''DON_GIA_NUOC'';
    SELECT @SoNgayHan = TRY_CONVERT(int, GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''SO_NGAY_HAN_THANH_TOAN'';
    SET @DonDien = ISNULL(@DonDien, 3500);
    SET @DonNuoc = ISNULL(@DonNuoc, 15000);
    SET @SoNgayHan = ISNULL(@SoNgayHan, 15);

    DECLARE @Dien int = @ChiSoDien, @Nuoc int = @ChiSoNuoc;
    IF @SoDienMoi IS NOT NULL AND @SoDienCu IS NOT NULL
        SET @Dien = @SoDienMoi - @SoDienCu;
    IF @SoNuocMoi IS NOT NULL AND @SoNuocCu IS NOT NULL
        SET @Nuoc = @SoNuocMoi - @SoNuocCu;
    IF @Dien < 0 OR @Nuoc < 0
        THROW 50071, N''Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ.'', 1;

    IF EXISTS (
        SELECT 1 FROM dbo.HoaDon
        WHERE MaSinhVien = @MaSinhVien
          AND YEAR(NgayLap) = YEAR(GETDATE())
          AND MONTH(NgayLap) = MONTH(GETDATE())
    )
        THROW 50072, N''Đã tồn tại hóa đơn của sinh viên trong tháng này.'', 1;

    DECLARE @TienDien decimal(18,2) = @Dien * @DonDien;
    DECLARE @TienNuoc decimal(18,2) = @Nuoc * @DonNuoc;
    DECLARE @Ngay date = CAST(GETDATE() AS date);

    INSERT INTO dbo.HoaDon (
        MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, ChiSoDien, ChiSoNuoc, TienDien, TienNuoc,
        TrangThaiThanhToan, SoDienCu, SoDienMoi, SoNuocCu, SoNuocMoi, HanThanhToan
    )
    VALUES (
        @MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, @TienPhong, @Dien, @Nuoc, @TienDien, @TienNuoc,
        N''Chưa thanh toán'',
        ISNULL(@SoDienCu, 0), ISNULL(@SoDienMoi, @Dien),
        ISNULL(@SoNuocCu, 0), ISNULL(@SoNuocMoi, @Nuoc),
        DATEADD(day, @SoNgayHan, @Ngay)
    );
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThanhToan
    @MaHoaDon VARCHAR(20),
    @PhuongThuc NVARCHAR(30) = NULL,
    @GhiChu NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.HoaDon
    SET TrangThaiThanhToan = N''Đã thanh toán'',
        NgayThanhToan = ISNULL(NgayThanhToan, GETDATE()),
        PhuongThucThanhToan = COALESCE(@PhuongThuc, PhuongThucThanhToan),
        GhiChuThanhToan = COALESCE(@GhiChu, GhiChuThanhToan)
    WHERE MaHoaDon = @MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_DongBoTrangThaiHoaDon
    @MaHoaDon NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE hd
    SET TrangThaiThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                    SELECT 1 FROM dbo.ChiTietHoaDon c
                    WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
                )
            THEN N''Đã thanh toán''
            ELSE N''Chưa thanh toán''
        END,
        NgayThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                    SELECT 1 FROM dbo.ChiTietHoaDon c
                    WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
                )
            THEN ISNULL(hd.NgayThanhToan, GETDATE())
            ELSE hd.NgayThanhToan
        END
    FROM dbo.HoaDon hd
    WHERE hd.MaHoaDon = @MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_HoaDonTongHop
AS
SELECT
    hd.MaHoaDon,
    hd.MaSinhVien,
    sv.HoTen,
    hd.TenPhong,
    hd.NgayLap,
    MONTH(hd.NgayLap) AS Thang,
    YEAR(hd.NgayLap) AS Nam,
    hd.HanThanhToan,
    hd.TrangThaiThanhToan,
    hd.TongTien AS TongTienCotTinh,
    ISNULL(x.TongThuc, 0) AS TongThuc,
    ISNULL(x.DaTra, 0) AS DaTra,
    ISNULL(x.TongThuc, 0) - ISNULL(x.DaTra, 0) AS ConNo,
    ISNULL(x.SoHangMuc, 0) AS SoHangMuc,
    CASE
        WHEN ISNULL(x.SoHangMuc, 0) > 0 AND ISNULL(x.SoChuaTra, 0) = 0 THEN N''PAID''
        WHEN ISNULL(x.DaTra, 0) > 0 AND ISNULL(x.TongThuc, 0) - ISNULL(x.DaTra, 0) > 0 THEN N''PARTIAL''
        WHEN ISNULL(x.TongThuc, 0) - ISNULL(x.DaTra, 0) > 0
             AND hd.HanThanhToan IS NOT NULL
             AND hd.HanThanhToan < CAST(GETDATE() AS date) THEN N''OVERDUE''
        ELSE N''UNPAID''
    END AS TrangThaiSuyRa
FROM dbo.HoaDon hd
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
LEFT JOIN (
    SELECT
        MaHoaDon,
        SUM(SoTien) AS TongThuc,
        SUM(CASE WHEN TrangThai = N''Đã thanh toán'' THEN SoTien ELSE 0 END) AS DaTra,
        COUNT(*) AS SoHangMuc,
        SUM(CASE WHEN TrangThai <> N''Đã thanh toán'' THEN 1 ELSE 0 END) AS SoChuaTra
    FROM dbo.ChiTietHoaDon
    GROUP BY MaHoaDon
) x ON x.MaHoaDon = hd.MaHoaDon;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
SELECT
    sv.MaSinhVien,
    sv.HoTen,
    sv.TenPhong,
    SUM(v.ConNo) AS TongCongNo,
    SUM(CASE WHEN v.TrangThaiSuyRa = N''OVERDUE'' THEN v.ConNo ELSE 0 END) AS CongNoQuaHan,
    COUNT(*) AS SoHoaDon
FROM dbo.vw_HoaDonTongHop v
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = v.MaSinhVien
GROUP BY sv.MaSinhVien, sv.HoTen, sv.TenPhong;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_DoanhThuThang
AS
SELECT
    YEAR(c.NgayThanhToan) AS Nam,
    MONTH(c.NgayThanhToan) AS Thang,
    SUM(CASE WHEN c.MaKhoan = N''ROOM'' THEN c.SoTien ELSE 0 END) AS DoanhThuTienPhong,
    SUM(CASE WHEN c.MaKhoan <> N''ROOM'' THEN c.SoTien ELSE 0 END) AS DoanhThuDienNuocKhac,
    SUM(c.SoTien) AS TongDoanhThu
FROM dbo.ChiTietHoaDon c
WHERE c.TrangThai = N''Đã thanh toán''
  AND c.NgayThanhToan IS NOT NULL
GROUP BY YEAR(c.NgayThanhToan), MONTH(c.NgayThanhToan);
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_HopDongSapHetHan
AS
SELECT
    hd.MaHopDong,
    hd.MaSinhVien,
    sv.HoTen,
    hd.TenPhong,
    hd.NgayBatDau,
    hd.NgayKetThuc,
    DATEDIFF(day, CAST(GETDATE() AS date), hd.NgayKetThuc) AS SoNgayConLai,
    TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_ADMIN'')) AS NguongAdmin,
    TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_SV'')) AS NguongSinhVien
FROM dbo.HopDong hd
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
  AND hd.NgayKetThuc <= DATEADD(
        day,
        ISNULL(TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_ADMIN'')), 7),
        CAST(GETDATE() AS date)
      );
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_ThongKePhong
AS
SELECT
    p.Khu,
    p.LoaiPhong,
    COUNT(*) AS SoPhong,
    SUM(p.SucChuaToiDa) AS TongSucChua,
    SUM(CASE WHEN p.TrangThaiPhong NOT IN (N''Bảo trì'', N''Ngưng sử dụng'') THEN p.SoSinhVienHienTai ELSE 0 END) AS DangO,
    CAST(
        CASE WHEN SUM(p.SucChuaToiDa) = 0 THEN 0
             ELSE 100.0 * SUM(CASE WHEN p.TrangThaiPhong NOT IN (N''Bảo trì'', N''Ngưng sử dụng'') THEN p.SoSinhVienHienTai ELSE 0 END)
                  / NULLIF(SUM(p.SucChuaToiDa), 0)
        END AS decimal(9,2)
    ) AS TyLeLapDayPct
FROM dbo.Phong p
GROUP BY p.Khu, p.LoaiPhong;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_SinhVienChiTiet
AS
SELECT
    sv.MaSinhVien,
    sv.HoTen,
    sv.NgaySinh,
    sv.GioiTinh,
    sv.SoDienThoai,
    sv.Email AS EmailTruong,
    sv.DiaChi,
    sv.Truong,
    sv.Lop,
    sv.GhiChu,
    sv.TrangThaiSinhVien,
    sv.TenPhong,
    sv.NgayRoiKTX,
    sv.NgayTao,
    p.Khu,
    p.LoaiPhong,
    p.SucChuaToiDa,
    p.TrangThaiPhong,
    hd.MaHopDong,
    hd.NgayBatDau,
    hd.NgayKetThuc,
    hd.TrangThaiHopDong AS TrangThaiHopDongHienTai,
    tk.MaTaiKhoan,
    tk.Email AS EmailDangNhap,
    tk.VaiTro,
    tk.TrangThai AS TrangThaiTaiKhoan
FROM dbo.SinhVien sv
LEFT JOIN dbo.Phong p ON p.TenPhong = sv.TenPhong
LEFT JOIN dbo.HopDong hd ON hd.MaSinhVien = sv.MaSinhVien AND hd.TrangThaiHopDong = N''Còn hiệu lực''
LEFT JOIN dbo.TaiKhoan tk ON tk.MaSinhVien = sv.MaSinhVien;
';

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SinhVien_TrangThai_TenPhong' AND object_id = OBJECT_ID(N'dbo.SinhVien'))
            CREATE NONCLUSTERED INDEX IX_SinhVien_TrangThai_TenPhong ON dbo.SinhVien (TrangThaiSinhVien, TenPhong);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SinhVien_HoTen' AND object_id = OBJECT_ID(N'dbo.SinhVien'))
            CREATE NONCLUSTERED INDEX IX_SinhVien_HoTen ON dbo.SinhVien (HoTen);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HopDong_MaSV_TrangThai' AND object_id = OBJECT_ID(N'dbo.HopDong'))
            CREATE NONCLUSTERED INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong (MaSinhVien, TrangThaiHopDong);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HopDong_NgayKetThuc' AND object_id = OBJECT_ID(N'dbo.HopDong'))
            CREATE NONCLUSTERED INDEX IX_HopDong_NgayKetThuc ON dbo.HopDong (NgayKetThuc);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HoaDon_TrangThai_NgayLap' AND object_id = OBJECT_ID(N'dbo.HoaDon'))
            CREATE NONCLUSTERED INDEX IX_HoaDon_TrangThai_NgayLap ON dbo.HoaDon (TrangThaiThanhToan, NgayLap);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Phong_Khu_Loai_TrangThai' AND object_id = OBJECT_ID(N'dbo.Phong'))
            CREATE NONCLUSTERED INDEX IX_Phong_Khu_Loai_TrangThai ON dbo.Phong (Khu, LoaiPhong, TrangThaiPhong);

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'005', N'005_procs_views_indexes.sql');

        COMMIT TRANSACTION;
        PRINT N'[005] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 005: restore backup.
sp_TaoHopDong: tham số cũ giữ nguyên; @MaHopDong = NULL để tự sinh HD + 5 số từ SEQUENCE Seq_MaHopDong.
*/
