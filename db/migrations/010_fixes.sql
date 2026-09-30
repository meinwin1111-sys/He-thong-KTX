SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50170, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'009')
    THROW 50171, N'Chạy migration 009 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'010')
    PRINT N'[010] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVien
    @MaSinhVien NVARCHAR(30),
    @HoTen NVARCHAR(100),
    @NgaySinh DATE,
    @GioiTinh NVARCHAR(10),
    @SDT VARCHAR(10),
    @Email NVARCHAR(100),
    @DiaChi NVARCHAR(255),
    @TenPhong NVARCHAR(50) = NULL,
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
    @MaSinhVien NVARCHAR(30),
    @PhongMoi NVARCHAR(50)
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
    @MaSinhVien NVARCHAR(30)
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
    @MaHopDong NVARCHAR(20) = NULL,
    @MaSinhVien NVARCHAR(30),
    @TenPhong NVARCHAR(50),
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
CREATE OR ALTER PROCEDURE dbo.sp_ThanhToan
    @MaHoaDon NVARCHAR(20),
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
CREATE OR ALTER PROCEDURE dbo.sp_KetThucHopDong
    @MaHopDong NVARCHAR(20),
    @NgayKetThucThucTe DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaSV nvarchar(30), @TenPhong nvarchar(50), @HoTen nvarchar(100),
                @NgayBD date, @NgayKT date, @NgayThucTe date;
        SET @NgayThucTe = ISNULL(@NgayKetThucThucTe, CAST(GETDATE() AS date));

        SELECT @MaSV = hd.MaSinhVien, @TenPhong = hd.TenPhong,
               @NgayBD = hd.NgayBatDau, @NgayKT = hd.NgayKetThuc
        FROM dbo.HopDong hd
        WHERE hd.MaHopDong = @MaHopDong
          AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        IF @MaSV IS NULL
            THROW 50061, N''Không tìm thấy hợp đồng còn hiệu lực.'', 1;

        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSV;

        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'',
            NgayKetThucThucTe = @NgayThucTe
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
                NgayRoiKTX = @NgayThucTe
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
CREATE OR ALTER PROCEDURE dbo.sp_CapNhatHopDong
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Expired TABLE
    (
        RowNo int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        MaHopDong nvarchar(20) NOT NULL,
        NgayKetThuc date NOT NULL
    );

    INSERT INTO @Expired (MaHopDong, NgayKetThuc)
    SELECT MaHopDong, NgayKetThuc
    FROM dbo.HopDong
    WHERE TrangThaiHopDong = N''Còn hiệu lực''
      AND NgayKetThuc < CAST(GETDATE() AS date);

    DECLARE @RowNo int = 1,
            @Total int = (SELECT COUNT(*) FROM @Expired),
            @Ended int = 0,
            @Errors int = 0,
            @MaHopDong nvarchar(20),
            @NgayKetThuc date;

    WHILE @RowNo <= @Total
    BEGIN
        SELECT @MaHopDong = MaHopDong, @NgayKetThuc = NgayKetThuc
        FROM @Expired
        WHERE RowNo = @RowNo;

        BEGIN TRY
            EXEC dbo.sp_KetThucHopDong
                @MaHopDong = @MaHopDong,
                @NgayKetThucThucTe = @NgayKetThuc;
            SET @Ended += 1;
        END TRY
        BEGIN CATCH
            SET @Errors += 1;
        END CATCH;

        SET @RowNo += 1;
    END;

    SELECT @Ended AS SoHopDongDaKetThuc, @Errors AS SoLoi;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_UpdateTrangThaiHopDong
ON dbo.HopDong
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Lifecycle, history, student departure, and room occupancy are handled by sp_KetThucHopDong.
    -- Keep this trigger as a no-op so it cannot preempt the procedure during contract expiry.
    RETURN;
END;
';

        IF OBJECT_ID(N'dbo.vw_LichSuHopDongFE', N'V') IS NOT NULL
            EXEC sys.sp_executesql N'DROP VIEW dbo.vw_LichSuHopDongFE;';

        DECLARE @MaLSColumnId int = COLUMNPROPERTY(OBJECT_ID(N'dbo.LichSuHopDong'), N'MaLS', N'ColumnId');
        IF @MaLSColumnId IS NOT NULL
        BEGIN
            IF EXISTS (
                SELECT 1 FROM sys.index_columns
                WHERE object_id = OBJECT_ID(N'dbo.LichSuHopDong')
                  AND column_id = @MaLSColumnId
            )
                THROW 50162, N'MaLS đang được index; cần gỡ dependency trước migration 010.', 1;

            IF EXISTS (
                SELECT 1 FROM sys.foreign_key_columns
                WHERE (parent_object_id = OBJECT_ID(N'dbo.LichSuHopDong') AND parent_column_id = @MaLSColumnId)
                   OR (referenced_object_id = OBJECT_ID(N'dbo.LichSuHopDong') AND referenced_column_id = @MaLSColumnId)
            )
                THROW 50163, N'MaLS đang được foreign key tham chiếu; cần gỡ dependency trước migration 010.', 1;

            IF EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE parent_object_id = OBJECT_ID(N'dbo.LichSuHopDong')
                  AND definition LIKE N'%MaLS%'
            )
                THROW 50164, N'MaLS đang được CHECK constraint tham chiếu; cần gỡ dependency trước migration 010.', 1;

            IF EXISTS (
                SELECT 1 FROM sys.sql_expression_dependencies
                WHERE referenced_id = OBJECT_ID(N'dbo.LichSuHopDong')
                  AND referenced_minor_id = @MaLSColumnId
            )
                THROW 50165, N'MaLS còn dependency ngoài vw_LichSuHopDongFE; cần gỡ dependency trước migration 010.', 1;

            EXEC sys.sp_executesql N'ALTER TABLE dbo.LichSuHopDong DROP COLUMN MaLS;';
        END;

        EXEC sys.sp_executesql N'
ALTER TABLE dbo.LichSuHopDong
ADD MaLS AS (
    CASE
        WHEN MaLichSu < 1000
            THEN N''LS'' + RIGHT(N''000'' + CAST(MaLichSu AS varchar(10)), 3)
        ELSE N''LS'' + CAST(MaLichSu AS varchar(10))
    END
) PERSISTED;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_LichSuHopDongFE
AS
SELECT MaLS, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc,
       TrangThaiHopDong, ThaoTac, ThoiGian AS ThoiDiem
FROM dbo.LichSuHopDong;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
SELECT
    sv.MaSinhVien,
    sv.HoTen,
    sv.TenPhong,
    SUM(v.ConNo) AS TongCongNo,
    SUM(CASE
        WHEN v.ConNo > 0 AND v.HanThanhToan < CAST(GETDATE() AS date) THEN v.ConNo
        ELSE 0
    END) AS CongNoQuaHan,
    COUNT(*) AS SoHoaDon
FROM dbo.vw_HoaDonTongHop v
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = v.MaSinhVien
GROUP BY sv.MaSinhVien, sv.HoTen, sv.TenPhong;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'010', N'010_fixes.sql');

        COMMIT TRANSACTION;
        PRINT N'[010] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/*
ROLLBACK 010: restore the pre-010 procedure, trigger, view, and MaLS definition
from backup. Do not drop this migration row or recompute MaLS manually on a live DB.
*/