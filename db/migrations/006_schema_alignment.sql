SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50080, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'005')
    THROW 50081, N'Chạy migration 005 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'006')
    PRINT N'[006] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @AddedGiaPhong bit = 0;
        IF COL_LENGTH(N'dbo.Phong', N'GiaPhong') IS NULL
        BEGIN
            ALTER TABLE dbo.Phong
            ADD GiaPhong decimal(18,2) NOT NULL
                CONSTRAINT DF_Phong_GiaPhong DEFAULT (0) WITH VALUES;
            SET @AddedGiaPhong = 1;
        END;

        IF @AddedGiaPhong = 1
        BEGIN
            -- Defer binding GiaPhong until the ALTER TABLE above has completed.
            EXEC sys.sp_executesql N'
;WITH GiaPhongTheoHoaDon AS
(
    SELECT hd.TenPhong, hd.TienPhong, COUNT_BIG(*) AS SoLan,
           ROW_NUMBER() OVER (
               PARTITION BY hd.TenPhong
               ORDER BY COUNT_BIG(*) DESC, hd.TienPhong DESC
           ) AS ThuTu
    FROM dbo.HoaDon hd
    WHERE hd.TienPhong IS NOT NULL
    GROUP BY hd.TenPhong, hd.TienPhong
)
UPDATE p
SET GiaPhong = COALESCE(g.TienPhong, CASE p.SucChuaToiDa
    WHEN 4 THEN CONVERT(decimal(18,2), 1200000)
    WHEN 6 THEN CONVERT(decimal(18,2), 800000)
    WHEN 8 THEN CONVERT(decimal(18,2), 500000)
    ELSE CONVERT(decimal(18,2), 0)
END)
FROM dbo.Phong p
LEFT JOIN GiaPhongTheoHoaDon g ON g.TenPhong = p.TenPhong AND g.ThuTu = 1;
';
        END;

        IF COL_LENGTH(N'dbo.LichSuHopDong', N'MaLS') IS NULL
            ALTER TABLE dbo.LichSuHopDong
            ADD MaLS AS (N'LS' + RIGHT(N'000' + CAST(MaLichSu AS varchar(10)), 3)) PERSISTED;

        IF OBJECT_ID(N'tempdb..#FK_MaSinhVien') IS NOT NULL DROP TABLE #FK_MaSinhVien;
        CREATE TABLE #FK_MaSinhVien
        (
            ConstraintName sysname NOT NULL,
            ParentSchema sysname NOT NULL,
            ParentTable sysname NOT NULL,
            ParentColumn sysname NOT NULL,
            ReferencedSchema sysname NOT NULL,
            ReferencedTable sysname NOT NULL,
            ReferencedColumn sysname NOT NULL,
            DeleteAction nvarchar(60) NOT NULL,
            UpdateAction nvarchar(60) NOT NULL,
            IsDisabled bit NOT NULL,
            IsNotTrusted bit NOT NULL
        );

        IF EXISTS
        (
            SELECT fk.object_id
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            INNER JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
            INNER JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
            WHERE pc.name = N'MaSinhVien' OR rc.name = N'MaSinhVien'
            GROUP BY fk.object_id
            HAVING COUNT(*) > 1
        )
            THROW 50082, N'Có FK ghép chứa MaSinhVien; cần xử lý thủ công trước migration 006.', 1;

        INSERT INTO #FK_MaSinhVien
        SELECT fk.name, ps.name, pt.name, pc.name, rs.name, rt.name, rc.name,
               fk.delete_referential_action_desc, fk.update_referential_action_desc,
               fk.is_disabled, fk.is_not_trusted
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        INNER JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id
        INNER JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
        INNER JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
        INNER JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
        INNER JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
        INNER JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
        WHERE pc.name = N'MaSinhVien' OR rc.name = N'MaSinhVien';

        DECLARE @ConstraintName sysname, @PKName sysname, @ParentSchema sysname, @ParentTable sysname,
                @ParentColumn sysname, @ReferencedSchema sysname, @ReferencedTable sysname,
                @ReferencedColumn sysname, @DeleteAction nvarchar(60), @UpdateAction nvarchar(60),
                @IsDisabled bit, @IsNotTrusted bit, @Sql nvarchar(max);
        DECLARE fk_drop CURSOR LOCAL FAST_FORWARD FOR
            SELECT ConstraintName, ParentSchema, ParentTable
            FROM #FK_MaSinhVien;
        OPEN fk_drop;
        FETCH NEXT FROM fk_drop INTO @ConstraintName, @ParentSchema, @ParentTable;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @Sql = N'ALTER TABLE ' + QUOTENAME(@ParentSchema) + N'.' + QUOTENAME(@ParentTable)
                + N' DROP CONSTRAINT ' + QUOTENAME(@ConstraintName) + N';';
            EXEC sys.sp_executesql @Sql;
            FETCH NEXT FROM fk_drop INTO @ConstraintName, @ParentSchema, @ParentTable;
        END;
        CLOSE fk_drop;
        DEALLOCATE fk_drop;

        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.SinhVien') AND is_primary_key = 1)
        BEGIN
            SELECT @PKName = kc.name
            FROM sys.key_constraints kc
            WHERE kc.parent_object_id = OBJECT_ID(N'dbo.SinhVien') AND kc.type = N'PK';
            SET @Sql = N'ALTER TABLE dbo.SinhVien DROP CONSTRAINT ' + QUOTENAME(@PKName) + N';';
            EXEC sys.sp_executesql @Sql;
        END;

        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HoaDon') AND name = N'IX_HoaDon_MaSinhVien_NgayLap')
            DROP INDEX IX_HoaDon_MaSinhVien_NgayLap ON dbo.HoaDon;
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_MaSV_TrangThai')
            DROP INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong;
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TaiKhoan') AND name = N'UQ_TaiKhoan_MaSinhVien')
            DROP INDEX UQ_TaiKhoan_MaSinhVien ON dbo.TaiKhoan;
        IF OBJECT_ID(N'dbo.GiaoDichThanhToan', N'U') IS NOT NULL
           AND EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan') AND name = N'IX_GiaoDich_MaSinhVien_NgayTao')
            DROP INDEX IX_GiaoDich_MaSinhVien_NgayTao ON dbo.GiaoDichThanhToan;
        IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NOT NULL
           AND EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.YeuCauSinhVien') AND name = N'IX_YeuCau_MaSinhVien_NgayTao')
            DROP INDEX IX_YeuCau_MaSinhVien_NgayTao ON dbo.YeuCauSinhVien;

        DECLARE @SchemaName sysname, @TableName sysname, @Nullable bit;
        DECLARE ma_sv_columns CURSOR LOCAL FAST_FORWARD FOR
            SELECT s.name, t.name, c.is_nullable
            FROM sys.tables t
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            INNER JOIN sys.columns c ON c.object_id = t.object_id
            WHERE c.name = N'MaSinhVien';
        OPEN ma_sv_columns;
        FETCH NEXT FROM ma_sv_columns INTO @SchemaName, @TableName, @Nullable;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @Sql = N'ALTER TABLE ' + QUOTENAME(@SchemaName) + N'.' + QUOTENAME(@TableName)
                + N' ALTER COLUMN [MaSinhVien] nvarchar(30) ' + CASE WHEN @Nullable = 1 THEN N'NULL;' ELSE N'NOT NULL;' END;
            EXEC sys.sp_executesql @Sql;
            FETCH NEXT FROM ma_sv_columns INTO @SchemaName, @TableName, @Nullable;
        END;
        CLOSE ma_sv_columns;
        DEALLOCATE ma_sv_columns;

        IF @PKName IS NOT NULL AND NOT EXISTS
            (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.SinhVien') AND type = N'PK')
        BEGIN
            SET @Sql = N'ALTER TABLE dbo.SinhVien ADD CONSTRAINT ' + QUOTENAME(@PKName)
                + N' PRIMARY KEY CLUSTERED (MaSinhVien ASC);';
            EXEC sys.sp_executesql @Sql;
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HoaDon') AND name = N'IX_HoaDon_MaSinhVien_NgayLap')
            CREATE NONCLUSTERED INDEX IX_HoaDon_MaSinhVien_NgayLap ON dbo.HoaDon (MaSinhVien, NgayLap);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_MaSV_TrangThai')
            CREATE NONCLUSTERED INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong (MaSinhVien, TrangThaiHopDong);
        IF OBJECT_ID(N'dbo.TaiKhoan', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TaiKhoan') AND name = N'UQ_TaiKhoan_MaSinhVien')
            CREATE UNIQUE NONCLUSTERED INDEX UQ_TaiKhoan_MaSinhVien ON dbo.TaiKhoan (MaSinhVien) WHERE MaSinhVien IS NOT NULL;
        IF OBJECT_ID(N'dbo.GiaoDichThanhToan', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan') AND name = N'IX_GiaoDich_MaSinhVien_NgayTao')
            CREATE NONCLUSTERED INDEX IX_GiaoDich_MaSinhVien_NgayTao ON dbo.GiaoDichThanhToan (MaSinhVien, NgayTao DESC);
        IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.YeuCauSinhVien') AND name = N'IX_YeuCau_MaSinhVien_NgayTao')
            CREATE NONCLUSTERED INDEX IX_YeuCau_MaSinhVien_NgayTao ON dbo.YeuCauSinhVien (MaSinhVien, NgayTao DESC);

        DECLARE fk_add CURSOR LOCAL FAST_FORWARD FOR
            SELECT ConstraintName, ParentSchema, ParentTable, ParentColumn,
                   ReferencedSchema, ReferencedTable, ReferencedColumn,
                   DeleteAction, UpdateAction, IsDisabled, IsNotTrusted
            FROM #FK_MaSinhVien;
        OPEN fk_add;
        FETCH NEXT FROM fk_add INTO @ConstraintName, @ParentSchema, @ParentTable, @ParentColumn,
            @ReferencedSchema, @ReferencedTable, @ReferencedColumn, @DeleteAction, @UpdateAction,
            @IsDisabled, @IsNotTrusted;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @Sql = N'ALTER TABLE ' + QUOTENAME(@ParentSchema) + N'.' + QUOTENAME(@ParentTable)
                + CASE WHEN @IsNotTrusted = 1 THEN N' WITH NOCHECK ADD CONSTRAINT ' ELSE N' WITH CHECK ADD CONSTRAINT ' END
                + QUOTENAME(@ConstraintName) + N' FOREIGN KEY (' + QUOTENAME(@ParentColumn) + N') REFERENCES '
                + QUOTENAME(@ReferencedSchema) + N'.' + QUOTENAME(@ReferencedTable) + N' (' + QUOTENAME(@ReferencedColumn) + N')'
                + CASE WHEN @DeleteAction = N'NO_ACTION' THEN N'' ELSE N' ON DELETE ' + REPLACE(@DeleteAction, N'_', N' ') END
                + CASE WHEN @UpdateAction = N'NO_ACTION' THEN N'' ELSE N' ON UPDATE ' + REPLACE(@UpdateAction, N'_', N' ') END + N';';
            EXEC sys.sp_executesql @Sql;
            IF @IsDisabled = 1
            BEGIN
                SET @Sql = N'ALTER TABLE ' + QUOTENAME(@ParentSchema) + N'.' + QUOTENAME(@ParentTable)
                    + N' NOCHECK CONSTRAINT ' + QUOTENAME(@ConstraintName) + N';';
                EXEC sys.sp_executesql @Sql;
            END;
            FETCH NEXT FROM fk_add INTO @ConstraintName, @ParentSchema, @ParentTable, @ParentColumn,
                @ReferencedSchema, @ReferencedTable, @ReferencedColumn, @DeleteAction, @UpdateAction,
                @IsDisabled, @IsNotTrusted;
        END;
        CLOSE fk_add;
        DEALLOCATE fk_add;

        IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.YeuCauSinhVien') AND name = N'CK_YeuCau_Loai')
            ALTER TABLE dbo.YeuCauSinhVien DROP CONSTRAINT CK_YeuCau_Loai;
        IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NOT NULL
            ALTER TABLE dbo.YeuCauSinhVien WITH CHECK
            ADD CONSTRAINT CK_YeuCau_Loai CHECK (Loai IN (N'Gia hạn hợp đồng', N'Báo hỏng thiết bị', N'Yêu cầu khác'));

        IF OBJECT_ID(N'dbo.MaHoaDonCounter', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.MaHoaDonCounter
            (
                Ky char(6) NOT NULL CONSTRAINT PK_MaHoaDonCounter PRIMARY KEY,
                SoCuoi int NOT NULL,
                CONSTRAINT CK_MaHoaDonCounter_SoCuoi CHECK (SoCuoi BETWEEN 0 AND 9999)
            );
        END;

        INSERT INTO dbo.MaHoaDonCounter (Ky, SoCuoi)
        SELECT SUBSTRING(hd.MaHoaDon, 4, 6), MAX(TRY_CONVERT(int, RIGHT(hd.MaHoaDon, 4)))
        FROM dbo.HoaDon hd
        WHERE hd.MaHoaDon LIKE N'INV[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
          AND TRY_CONVERT(int, RIGHT(hd.MaHoaDon, 4)) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dbo.MaHoaDonCounter c WHERE c.Ky = SUBSTRING(hd.MaHoaDon, 4, 6))
        GROUP BY SUBSTRING(hd.MaHoaDon, 4, 6);

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDon
    @MaHoaDon NVARCHAR(20),
    @MaSinhVien NVARCHAR(30),
    @TenPhong NVARCHAR(50),
    @TienPhong DECIMAL(18,2),
    @ChiSoDien INT,
    @ChiSoNuoc INT,
    @SoDienCu INT = NULL,
    @SoDienMoi INT = NULL,
    @SoNuocCu INT = NULL,
    @SoNuocMoi INT = NULL,
    @NgayLap DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @DonDien decimal(18,2) = 3500, @DonNuoc decimal(18,2) = 15000, @SoNgayHan int = 15;
        SELECT @DonDien = TRY_CONVERT(decimal(18,2), GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''DON_GIA_DIEN'';
        SELECT @DonNuoc = TRY_CONVERT(decimal(18,2), GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''DON_GIA_NUOC'';
        SELECT @SoNgayHan = TRY_CONVERT(int, GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''SO_NGAY_HAN_THANH_TOAN'';
        SET @DonDien = ISNULL(@DonDien, 3500);
        SET @DonNuoc = ISNULL(@DonNuoc, 15000);
        SET @SoNgayHan = ISNULL(@SoNgayHan, 15);

        DECLARE @Dien int = @ChiSoDien, @Nuoc int = @ChiSoNuoc;
        IF @SoDienMoi IS NOT NULL AND @SoDienCu IS NOT NULL SET @Dien = @SoDienMoi - @SoDienCu;
        IF @SoNuocMoi IS NOT NULL AND @SoNuocCu IS NOT NULL SET @Nuoc = @SoNuocMoi - @SoNuocCu;
        IF @Dien < 0 OR @Nuoc < 0 THROW 50071, N''Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ.'', 1;

        DECLARE @Ngay date = ISNULL(@NgayLap, CAST(GETDATE() AS date));
        DECLARE @Ky char(6) = CONVERT(char(6), @Ngay, 112);
        IF @MaHoaDon IS NULL OR LTRIM(RTRIM(@MaHoaDon)) = N''''
        BEGIN
            DECLARE @SoCuoi int;
            SELECT @SoCuoi = SoCuoi
            FROM dbo.MaHoaDonCounter WITH (UPDLOCK, HOLDLOCK)
            WHERE Ky = @Ky;

            IF @SoCuoi IS NULL
            BEGIN
                SET @SoCuoi = 1;
                INSERT INTO dbo.MaHoaDonCounter (Ky, SoCuoi) VALUES (@Ky, @SoCuoi);
            END
            ELSE
            BEGIN
                IF @SoCuoi >= 9999 THROW 50073, N''Đã hết dải mã hóa đơn trong tháng.'', 1;
                SET @SoCuoi = @SoCuoi + 1;
                UPDATE dbo.MaHoaDonCounter SET SoCuoi = @SoCuoi WHERE Ky = @Ky;
            END;

            SET @MaHoaDon = N''INV'' + @Ky + RIGHT(N''0000'' + CAST(@SoCuoi AS varchar(4)), 4);
        END;

        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon)
            THROW 50074, N''Mã hóa đơn đã tồn tại.'', 1;
        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaSinhVien = @MaSinhVien AND YEAR(NgayLap) = YEAR(@Ngay) AND MONTH(NgayLap) = MONTH(@Ngay))
            THROW 50072, N''Đã tồn tại hóa đơn của sinh viên trong tháng này.'', 1;

        DECLARE @TienDien decimal(18,2) = @Dien * @DonDien;
        DECLARE @TienNuoc decimal(18,2) = @Nuoc * @DonNuoc;
        INSERT INTO dbo.HoaDon (
            MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, ChiSoDien, ChiSoNuoc, TienDien, TienNuoc,
            TrangThaiThanhToan, SoDienCu, SoDienMoi, SoNuocCu, SoNuocMoi, HanThanhToan
        )
        VALUES (
            @MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, @TienPhong, @Dien, @Nuoc, @TienDien, @TienNuoc,
            N''Chưa thanh toán'', ISNULL(@SoDienCu, 0), ISNULL(@SoDienMoi, @Dien),
            ISNULL(@SoNuocCu, 0), ISNULL(@SoNuocMoi, @Nuoc), DATEADD(day, @SoNgayHan, @Ngay)
        );

        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_LichSuHopDongFE
AS
SELECT MaLS, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc,
       TrangThaiHopDong, ThaoTac, ThoiGian AS ThoiDiem
FROM dbo.LichSuHopDong;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'006', N'006_schema_alignment.sql');

        COMMIT TRANSACTION;
        PRINT N'[006] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

SELECT p.TenPhong, hd.TienPhong, COUNT(*) AS SoHoaDonMucGia
FROM dbo.Phong p
INNER JOIN dbo.HoaDon hd ON hd.TenPhong = p.TenPhong
WHERE hd.TienPhong IS NOT NULL
  AND (SELECT COUNT(DISTINCT x.TienPhong) FROM dbo.HoaDon x WHERE x.TenPhong = p.TenPhong) > 1
GROUP BY p.TenPhong, hd.TienPhong
ORDER BY p.TenPhong, hd.TienPhong;
GO