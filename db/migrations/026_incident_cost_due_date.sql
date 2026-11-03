SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 52600, N'Không chạy migration trong master.', 1;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 52601, N'Chạy migration 001 trước.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'025')
    THROW 52602, N'Chạy migration 025 trước.', 1;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'026')
BEGIN
    PRINT N'[026] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
IF COL_LENGTH(N''dbo.ChiPhiPhatSinh'', N''HanDong'') IS NULL
    ALTER TABLE dbo.ChiPhiPhatSinh ADD HanDong date NULL;';

        EXEC sys.sp_executesql N'
UPDATE dbo.ChiPhiPhatSinh
SET HanDong = DATEADD(day, 7, NgayPhatSinh)
WHERE HanDong IS NULL;';

        EXEC sys.sp_executesql N'
IF NOT EXISTS
(
    SELECT 1 FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID(N''dbo.ChiPhiPhatSinh'')
      AND name = N''DF_ChiPhiPhatSinh_HanDong''
)
    ALTER TABLE dbo.ChiPhiPhatSinh
        ADD CONSTRAINT DF_ChiPhiPhatSinh_HanDong
        DEFAULT (DATEADD(day, 7, CONVERT(date, GETDATE()))) FOR HanDong;';

        EXEC sys.sp_executesql N'
IF EXISTS
(
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N''dbo.ChiPhiPhatSinh'')
      AND name = N''HanDong'' AND is_nullable = 1
)
    ALTER TABLE dbo.ChiPhiPhatSinh ALTER COLUMN HanDong date NOT NULL;';

        EXEC sys.sp_executesql N'
UPDATE hd
SET HanThanhToan = cp.HanDong
FROM dbo.HoaDon hd
INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaHoaDon = hd.MaHoaDon
INNER JOIN dbo.ChiPhiPhatSinh cp ON cp.MaChiTietHoaDon = chi.MaChiTiet
WHERE hd.HanThanhToan IS NULL;';

        EXEC sys.sp_executesql N'
IF COL_LENGTH(N''dbo.ThongBao'', N''MaSuKien'') IS NULL
    ALTER TABLE dbo.ThongBao ADD MaSuKien nvarchar(100) NULL;';

        EXEC sys.sp_executesql N'
IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N''dbo.ThongBao'')
      AND name = N''UX_ThongBao_MaSuKien_MaSinhVien''
)
    CREATE UNIQUE INDEX UX_ThongBao_MaSuKien_MaSinhVien
        ON dbo.ThongBao (MaSuKien, MaSinhVien)
        WHERE MaSuKien IS NOT NULL;';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDonPhatSinh
    @MaChiPhi bigint,
    @MaHoaDon nvarchar(20) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @MaHopDong nvarchar(20), @MaChiTiet int, @NoiDung nvarchar(255),
                @SoTien decimal(18,2), @TenPhong nvarchar(50), @MaSinhVien nvarchar(30),
                @Ky date, @Ngay date = CAST(GETDATE() AS date), @Prefix nvarchar(40),
                @TenKhoan nvarchar(100), @MaChiTietHD nvarchar(40), @HanDong date;
        SELECT @MaHopDong = cp.MaHopDong, @MaChiTiet = cp.MaChiTiet,
               @NoiDung = cp.NoiDung, @SoTien = cp.SoTien, @HanDong = cp.HanDong,
               @TenPhong = hd.TenPhong, @Ky = DATEFROMPARTS(YEAR(cp.NgayPhatSinh), MONTH(cp.NgayPhatSinh), 1),
               @MaSinhVien = c.MaSinhVien
        FROM dbo.ChiPhiPhatSinh cp WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = cp.MaHopDong
        LEFT JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = cp.MaChiTiet
        WHERE cp.MaChiPhi = @MaChiPhi AND cp.TrangThai = N''Chưa lập hóa đơn'';
        IF @MaHopDong IS NULL
        BEGIN
            SELECT MaChiPhi, MaHopDong, TrangThai FROM dbo.ChiPhiPhatSinh WHERE MaChiPhi = @MaChiPhi;
            THROW 51924, N''Không tìm thấy khoản phát sinh chưa lập hóa đơn.'', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon)
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 51925, N''Mã hóa đơn đã tồn tại.'', 1;
        END;
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, 0, 0, 0,
             N''Chưa thanh toán'', @HanDong, N''PHAT_SINH'', @MaHopDong, @MaChiTiet, @Ky, @Ky);
        SET @Prefix = N''Phát sinh #'' + CONVERT(nvarchar(20), @MaChiPhi) + N'': '';
        SET @TenKhoan = @Prefix + LEFT(@NoiDung, 100 - LEN(@Prefix));
        SET @MaChiTietHD = LEFT(@MaHoaDon, 25) + N''-INC-'' + CONVERT(nvarchar(12), @MaChiPhi);
        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
             TrangThai, ThuTu, GhiChu)
        VALUES
            (@MaChiTietHD, @MaHoaDon, N''INCIDENT'', @TenKhoan, @SoTien, 1, @SoTien,
             N''Chưa thanh toán'', 1, @NoiDung);
        UPDATE dbo.ChiPhiPhatSinh
        SET TrangThai = N''Đã lập hóa đơn'', MaChiTietHoaDon = @MaChiTietHD
        WHERE MaChiPhi = @MaChiPhi;
        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon, @MaChiTietHD AS MaChiTietHoaDon;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;';

        IF DATABASE_PRINCIPAL_ID(N'DNKTX') IS NOT NULL
            EXEC sys.sp_executesql N'GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonPhatSinh TO [DNKTX];';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'026', N'026_incident_cost_due_date.sql');

        COMMIT TRANSACTION;
        PRINT N'[026] Đã bổ sung hạn đóng chi phí phát sinh và liên kết hạn vào hóa đơn.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
