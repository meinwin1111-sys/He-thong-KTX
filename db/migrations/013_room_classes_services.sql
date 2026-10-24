SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51300, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'012')
    THROW 51301, N'Chạy migration 012 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'013')
    PRINT N'[013] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.Phong', N'U') IS NULL
           OR OBJECT_ID(N'dbo.HopDong', N'U') IS NULL
           OR OBJECT_ID(N'dbo.CauHinhHeThong', N'U') IS NULL
            THROW 51302, N'Thiếu bảng Phong, HopDong hoặc CauHinhHeThong.', 1;

        IF OBJECT_ID(N'dbo.HangPhong', N'U') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE TABLE dbo.HangPhong
                (
                    MaHangPhong nvarchar(20) NOT NULL CONSTRAINT PK_HangPhong PRIMARY KEY,
                    TenHangPhong nvarchar(100) NOT NULL CONSTRAINT UQ_HangPhong_Ten UNIQUE,
                    SucChuaToiDa int NOT NULL,
                    GiaPhongThang decimal(18,2) NOT NULL,
                    GiaPhongNam decimal(18,2) NOT NULL,
                    CONSTRAINT CK_HangPhong_SucChua CHECK (SucChuaToiDa > 0),
                    CONSTRAINT CK_HangPhong_Gia CHECK (GiaPhongThang >= 0 AND GiaPhongNam >= 0),
                    CONSTRAINT UQ_HangPhong_MaHang_SucChua UNIQUE (MaHangPhong, SucChuaToiDa)
                );';
        END;

        IF OBJECT_ID(N'dbo.DichVu', N'U') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE TABLE dbo.DichVu
                (
                    MaDichVu nvarchar(20) NOT NULL CONSTRAINT PK_DichVu PRIMARY KEY,
                    TenDichVu nvarchar(100) NOT NULL CONSTRAINT UQ_DichVu_Ten UNIQUE,
                    DonVi nvarchar(20) NOT NULL,
                    HoatDong bit NOT NULL CONSTRAINT DF_DichVu_HoatDong DEFAULT (1)
                );';
        END;

        IF OBJECT_ID(N'dbo.HangPhong_DichVu', N'U') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE TABLE dbo.HangPhong_DichVu
                (
                    MaHangPhong nvarchar(20) NOT NULL,
                    MaDichVu nvarchar(20) NOT NULL,
                    DonGia decimal(18,2) NOT NULL,
                    CachTinh nvarchar(20) NOT NULL,
                    DoiTuongThanhToan nvarchar(10) NOT NULL,
                    HoatDong bit NOT NULL CONSTRAINT DF_HangPhong_DichVu_HoatDong DEFAULT (1),
                    CONSTRAINT PK_HangPhong_DichVu PRIMARY KEY (MaHangPhong, MaDichVu),
                    CONSTRAINT FK_HPDV_HangPhong FOREIGN KEY (MaHangPhong) REFERENCES dbo.HangPhong (MaHangPhong),
                    CONSTRAINT FK_HPDV_DichVu FOREIGN KEY (MaDichVu) REFERENCES dbo.DichVu (MaDichVu),
                    CONSTRAINT CK_HPDV_DonGia CHECK (DonGia >= 0),
                    CONSTRAINT CK_HPDV_CachTinh CHECK (CachTinh IN (N''CHI_SO'', N''CO_DINH_KY'')),
                    CONSTRAINT CK_HPDV_DoiTuong CHECK (DoiTuongThanhToan IN (N''PHONG'', N''CA_NHAN''))
                );';
        END;

        IF COL_LENGTH(N'dbo.DichVu', N'DonVi') IS NULL
            ALTER TABLE dbo.DichVu ADD DonVi nvarchar(20) NULL;
        IF COL_LENGTH(N'dbo.DichVu', N'HoatDong') IS NULL
            ALTER TABLE dbo.DichVu ADD HoatDong bit NOT NULL
                CONSTRAINT DF_DichVu_HoatDong DEFAULT (1) WITH VALUES;
        IF COL_LENGTH(N'dbo.HangPhong_DichVu', N'HoatDong') IS NULL
            ALTER TABLE dbo.HangPhong_DichVu ADD HoatDong bit NOT NULL
                CONSTRAINT DF_HangPhong_DichVu_HoatDong DEFAULT (1) WITH VALUES;

        EXEC sys.sp_executesql N'
        MERGE dbo.HangPhong WITH (HOLDLOCK) AS target
        USING (VALUES
            (N''HP4'', N''Phòng 4 người'', 4, CONVERT(decimal(18,2), 1200000)),
            (N''HP6'', N''Phòng 6 người'', 6, CONVERT(decimal(18,2), 800000)),
            (N''HP8'', N''Phòng 8 người'', 8, CONVERT(decimal(18,2), 500000))
        ) AS source (MaHangPhong, TenHangPhong, SucChuaToiDa, GiaPhongThang)
            ON target.MaHangPhong = source.MaHangPhong
        WHEN MATCHED THEN UPDATE SET
            TenHangPhong = source.TenHangPhong,
            SucChuaToiDa = source.SucChuaToiDa,
            GiaPhongThang = source.GiaPhongThang,
            GiaPhongNam = source.GiaPhongThang * 12
        WHEN NOT MATCHED THEN INSERT
            (MaHangPhong, TenHangPhong, SucChuaToiDa, GiaPhongThang, GiaPhongNam)
        VALUES
            (source.MaHangPhong, source.TenHangPhong, source.SucChuaToiDa,
             source.GiaPhongThang, source.GiaPhongThang * 12);';

        DECLARE @DonGiaDien decimal(18,2),
                @DonGiaNuoc decimal(18,2),
                @DonGiaWifi decimal(18,2),
                @DonGiaVeSinh decimal(18,2),
                @DonGiaGiuXe decimal(18,2);

        SELECT @DonGiaDien = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_DIEN';
        SELECT @DonGiaNuoc = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_NUOC';
        IF @DonGiaDien IS NULL OR @DonGiaDien < 0 OR @DonGiaNuoc IS NULL OR @DonGiaNuoc < 0
            THROW 51303, N'CauHinhHeThong thiếu hoặc sai đơn giá điện/nước; không thể seed dịch vụ.', 1;

        SELECT @DonGiaWifi = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_WIFI';
        SELECT @DonGiaVeSinh = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_VE_SINH';
        SELECT @DonGiaGiuXe = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_GIU_XE';

        IF EXISTS (
            SELECT 1
            FROM dbo.CauHinhHeThong
            WHERE Khoa IN (N'DON_GIA_WIFI', N'DON_GIA_VE_SINH', N'DON_GIA_GIU_XE')
              AND (TRY_CONVERT(decimal(18,2), GiaTri) IS NULL OR TRY_CONVERT(decimal(18,2), GiaTri) < 0)
        )
            THROW 51304, N'Đơn giá wifi/vệ sinh/giữ xe trong CauHinhHeThong không hợp lệ.', 1;

        EXEC sys.sp_executesql N'
        MERGE dbo.DichVu WITH (HOLDLOCK) AS target
        USING (VALUES
            (N''DIEN'', N''Điện'', N''kWh'', CONVERT(bit, 1)),
            (N''NUOC'', N''Nước'', N''m3'', CONVERT(bit, 1)),
            (N''WIFI'', N''Wifi'', N''tháng'', CONVERT(bit, CASE WHEN @DonGiaWifi IS NULL THEN 0 ELSE 1 END)),
            (N''VE_SINH'', N''Vệ sinh'', N''tháng'', CONVERT(bit, CASE WHEN @DonGiaVeSinh IS NULL THEN 0 ELSE 1 END)),
            (N''GIU_XE'', N''Giữ xe'', N''xe/tháng'', CONVERT(bit, CASE WHEN @DonGiaGiuXe IS NULL THEN 0 ELSE 1 END))
        ) AS source (MaDichVu, TenDichVu, DonVi, HoatDong)
            ON target.MaDichVu = source.MaDichVu
        WHEN MATCHED THEN UPDATE SET
            TenDichVu = source.TenDichVu,
            DonVi = source.DonVi,
            HoatDong = source.HoatDong
        WHEN NOT MATCHED THEN INSERT (MaDichVu, TenDichVu, DonVi, HoatDong)
        VALUES (source.MaDichVu, source.TenDichVu, source.DonVi, source.HoatDong);',
            N'@DonGiaWifi decimal(18,2), @DonGiaVeSinh decimal(18,2), @DonGiaGiuXe decimal(18,2)',
            @DonGiaWifi = @DonGiaWifi, @DonGiaVeSinh = @DonGiaVeSinh, @DonGiaGiuXe = @DonGiaGiuXe;

        EXEC sys.sp_executesql N'
            UPDATE dbo.DichVu SET DonVi = N''khác'' WHERE DonVi IS NULL;
            ALTER TABLE dbo.DichVu ALTER COLUMN DonVi nvarchar(20) NOT NULL;';

        EXEC sys.sp_executesql N'
        MERGE dbo.HangPhong_DichVu WITH (HOLDLOCK) AS target
        USING (
            SELECT hp.MaHangPhong, dv.MaDichVu,
                   CASE dv.MaDichVu
                       WHEN N''DIEN'' THEN @DonGiaDien
                       WHEN N''NUOC'' THEN @DonGiaNuoc
                       WHEN N''WIFI'' THEN COALESCE(@DonGiaWifi, 0)
                       WHEN N''VE_SINH'' THEN COALESCE(@DonGiaVeSinh, 0)
                       WHEN N''GIU_XE'' THEN COALESCE(@DonGiaGiuXe, 0)
                   END AS DonGia,
                   CASE WHEN dv.MaDichVu IN (N''DIEN'', N''NUOC'') THEN N''CHI_SO'' ELSE N''CO_DINH_KY'' END AS CachTinh,
                   N''PHONG'' AS DoiTuongThanhToan,
                   CONVERT(bit, CASE
                       WHEN dv.MaDichVu IN (N''DIEN'', N''NUOC'') THEN 1
                       WHEN dv.MaDichVu = N''WIFI'' THEN CASE WHEN @DonGiaWifi IS NULL THEN 0 ELSE 1 END
                       WHEN dv.MaDichVu = N''VE_SINH'' THEN CASE WHEN @DonGiaVeSinh IS NULL THEN 0 ELSE 1 END
                       WHEN dv.MaDichVu = N''GIU_XE'' THEN CASE WHEN @DonGiaGiuXe IS NULL THEN 0 ELSE 1 END
                       ELSE 0
                   END) AS HoatDong
            FROM dbo.HangPhong hp
            CROSS JOIN dbo.DichVu dv
            WHERE dv.MaDichVu IN (N''DIEN'', N''NUOC'', N''WIFI'', N''VE_SINH'', N''GIU_XE'')
        ) AS source
            ON target.MaHangPhong = source.MaHangPhong AND target.MaDichVu = source.MaDichVu
        WHEN NOT MATCHED THEN INSERT
            (MaHangPhong, MaDichVu, DonGia, CachTinh, DoiTuongThanhToan, HoatDong)
        VALUES
            (source.MaHangPhong, source.MaDichVu, source.DonGia, source.CachTinh,
             source.DoiTuongThanhToan, source.HoatDong);',
            N'@DonGiaDien decimal(18,2), @DonGiaNuoc decimal(18,2), @DonGiaWifi decimal(18,2), @DonGiaVeSinh decimal(18,2), @DonGiaGiuXe decimal(18,2)',
            @DonGiaDien = @DonGiaDien, @DonGiaNuoc = @DonGiaNuoc, @DonGiaWifi = @DonGiaWifi,
            @DonGiaVeSinh = @DonGiaVeSinh, @DonGiaGiuXe = @DonGiaGiuXe;

        IF COL_LENGTH(N'dbo.Phong', N'MaHangPhong') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.Phong ADD MaHangPhong nvarchar(20) NULL;';

        DECLARE @PhongLoi nvarchar(max);
        EXEC sys.sp_executesql N'
        SELECT @PhongLoi = STUFF((
            SELECT N'', '' + QUOTENAME(p.TenPhong) + N'' ('' + CONVERT(nvarchar(12), p.SucChuaToiDa) + N'')''
            FROM dbo.Phong p
            WHERE p.SucChuaToiDa NOT IN (4, 6, 8)
            ORDER BY p.TenPhong
            FOR XML PATH(''''), TYPE
        ).value(''.'', ''nvarchar(max)''), 1, 2, N'''');',
            N'@PhongLoi nvarchar(max) OUTPUT', @PhongLoi = @PhongLoi OUTPUT;
        IF @PhongLoi IS NOT NULL
        BEGIN
            SET @PhongLoi = LEFT(N'Sức chứa không thuộc 4/6/8; cần xử lý phòng: ' + @PhongLoi, 2048);
            THROW 51305, @PhongLoi, 1;
        END;

        EXEC sys.sp_executesql N'
            UPDATE dbo.Phong
            SET MaHangPhong = CASE SucChuaToiDa
                WHEN 4 THEN N''HP4'' WHEN 6 THEN N''HP6'' WHEN 8 THEN N''HP8'' END
            WHERE MaHangPhong IS NULL;
        ';

        DECLARE @PhongHangKhongHopLe bit = 0;
        EXEC sys.sp_executesql N'
        IF EXISTS (
            SELECT 1
            FROM dbo.Phong p
            LEFT JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
            WHERE hp.MaHangPhong IS NULL OR hp.SucChuaToiDa <> p.SucChuaToiDa
        ) SET @KhongHopLe = 1;',
            N'@KhongHopLe bit OUTPUT', @KhongHopLe = @PhongHangKhongHopLe OUTPUT;
        IF @PhongHangKhongHopLe = 1
            THROW 51306, N'Mã hạng phòng hoặc sức chứa không khớp; không thể hoàn tất migration 013.', 1;

        EXEC sys.sp_executesql N'ALTER TABLE dbo.Phong ALTER COLUMN MaHangPhong nvarchar(20) NOT NULL;';
        IF NOT EXISTS (
            SELECT 1 FROM sys.foreign_keys
            WHERE parent_object_id = OBJECT_ID(N'dbo.Phong')
              AND name = N'FK_Phong_Hang_SucChua'
        )
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.Phong WITH CHECK
                ADD CONSTRAINT FK_Phong_Hang_SucChua
                FOREIGN KEY (MaHangPhong, SucChuaToiDa)
                REFERENCES dbo.HangPhong (MaHangPhong, SucChuaToiDa);
            ';

        IF NOT EXISTS (
            SELECT 1 FROM sys.foreign_keys
            WHERE parent_object_id = OBJECT_ID(N'dbo.Phong') AND name = N'FK_Phong_HangPhong'
        )
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.Phong WITH CHECK
                    ADD CONSTRAINT FK_Phong_HangPhong
                    FOREIGN KEY (MaHangPhong) REFERENCES dbo.HangPhong (MaHangPhong);';

        EXEC sys.sp_executesql N'
            IF EXISTS (
                SELECT 1 FROM sys.extended_properties
                WHERE name = N''MS_Description''
                  AND major_id = OBJECT_ID(N''dbo.Phong'')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N''dbo.Phong''), N''GiaPhong'', N''ColumnId'')
            )
                EXEC sys.sp_updateextendedproperty
                    @name=N''MS_Description'',
                    @value=N''Deprecated: legacy compatibility only. New logic reads per-person monthly/yearly prices from HangPhong.'',
                    @level0type=N''SCHEMA'', @level0name=N''dbo'',
                    @level1type=N''TABLE'', @level1name=N''Phong'',
                    @level2type=N''COLUMN'', @level2name=N''GiaPhong'';
            ELSE
                EXEC sys.sp_addextendedproperty
                    @name=N''MS_Description'',
                    @value=N''Deprecated: legacy compatibility only. New logic reads per-person monthly/yearly prices from HangPhong.'',
                    @level0type=N''SCHEMA'', @level0name=N''dbo'',
                    @level1type=N''TABLE'', @level1name=N''Phong'',
                    @level2type=N''COLUMN'', @level2name=N''GiaPhong'';
        ';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_Phong_BaoVeHang
ON dbo.Phong
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(MaHangPhong) AND EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.TenPhong = i.TenPhong
        INNER JOIN dbo.HopDong hd ON hd.TenPhong = i.TenPhong
        WHERE i.MaHangPhong <> d.MaHangPhong
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
    )
        THROW 51307, N''Không thể đổi hạng phòng khi phòng còn hợp đồng hiệu lực.'', 1;
END;
';

        DECLARE @HasUnpricedOptionalServices bit = 0;
        EXEC sys.sp_executesql N'
            IF EXISTS (
                SELECT 1
                FROM dbo.DichVu
                WHERE MaDichVu IN (N''WIFI'', N''VE_SINH'', N''GIU_XE'') AND HoatDong = 0
            ) SET @HasUnpricedOptionalServices = 1;',
            N'@HasUnpricedOptionalServices bit OUTPUT',
            @HasUnpricedOptionalServices = @HasUnpricedOptionalServices OUTPUT;
        IF @HasUnpricedOptionalServices = 1
            PRINT N'[013] CẢNH BÁO: chưa có đơn giá cho các dịch vụ sau; đang để DonGia=0 và HoatDong=0: Wifi, Vệ sinh, Giữ xe. Cập nhật HangPhong_DichVu trước khi thu.';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'013', N'013_room_classes_services.sql');

        COMMIT TRANSACTION;
        PRINT N'[013] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
