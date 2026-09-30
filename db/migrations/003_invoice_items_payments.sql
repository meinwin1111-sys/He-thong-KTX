SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    RAISERROR(N'Chạy migration 001 trước.', 16, 1);
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'002')
    RAISERROR(N'Chạy migration 002 trước.', 16, 1);
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'003')
    PRINT N'[003] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.ChiTietHoaDon', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ChiTietHoaDon
            (
                MaChiTiet nvarchar(40) NOT NULL CONSTRAINT PK_ChiTietHoaDon PRIMARY KEY,
                MaHoaDon nvarchar(20) NOT NULL,
                MaKhoan nvarchar(30) NOT NULL,
                TenKhoan nvarchar(100) NOT NULL,
                SoTien decimal(18, 2) NOT NULL,
                GhiChu nvarchar(255) NULL,
                TrangThai nvarchar(20) NOT NULL CONSTRAINT DF_ChiTietHoaDon_TrangThai DEFAULT (N'Chưa thanh toán'),
                NgayThanhToan datetime NULL,
                MaGiaoDich nvarchar(60) NULL,
                ThuTu int NOT NULL CONSTRAINT DF_ChiTietHoaDon_ThuTu DEFAULT (0),
                RowVer rowversion NOT NULL,
                CONSTRAINT CK_ChiTietHoaDon_SoTien CHECK (SoTien >= 0),
                CONSTRAINT CK_ChiTietHoaDon_TrangThai CHECK (TrangThai IN (N'Chưa thanh toán', N'Chờ tiền mặt', N'Đã thanh toán')),
                CONSTRAINT UQ_ChiTietHoaDon_Khoan UNIQUE (MaHoaDon, MaKhoan, TenKhoan),
                CONSTRAINT FK_ChiTietHoaDon_HoaDon FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon (MaHoaDon) ON DELETE CASCADE
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChiTietHoaDon_MaHoaDon' AND object_id = OBJECT_ID(N'dbo.ChiTietHoaDon'))
            CREATE NONCLUSTERED INDEX IX_ChiTietHoaDon_MaHoaDon ON dbo.ChiTietHoaDon (MaHoaDon);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChiTietHoaDon_TrangThai' AND object_id = OBJECT_ID(N'dbo.ChiTietHoaDon'))
            CREATE NONCLUSTERED INDEX IX_ChiTietHoaDon_TrangThai ON dbo.ChiTietHoaDon (TrangThai);

        IF OBJECT_ID(N'dbo.GiaoDichThanhToan', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.GiaoDichThanhToan
            (
                MaGiaoDich nvarchar(60) NOT NULL CONSTRAINT PK_GiaoDichThanhToan PRIMARY KEY,
                MaSinhVien nvarchar(20) NOT NULL,
                TongTien decimal(18, 2) NOT NULL,
                PhuongThuc nvarchar(10) NOT NULL,
                TrangThai nvarchar(10) NOT NULL,
                NoiDungCK nvarchar(100) NULL,
                NgayTao datetime NOT NULL CONSTRAINT DF_GiaoDich_NgayTao DEFAULT (GETDATE()),
                NgayThanhToan datetime NULL,
                HetHanLuc datetime NULL,
                XacNhanBoi int NULL,
                LyDoTuChoi nvarchar(255) NULL,
                MaThamChieuNgoai nvarchar(100) NULL,
                CONSTRAINT CK_GiaoDich_TongTien CHECK (TongTien > 0),
                CONSTRAINT CK_GiaoDich_PhuongThuc CHECK (PhuongThuc IN (N'ONLINE', N'CASH')),
                CONSTRAINT CK_GiaoDich_TrangThai CHECK (TrangThai IN (N'PENDING', N'SUCCESS', N'REJECTED', N'EXPIRED')),
                CONSTRAINT CK_GiaoDich_SuccessNgay CHECK (TrangThai <> N'SUCCESS' OR NgayThanhToan IS NOT NULL),
                CONSTRAINT CK_GiaoDich_CashSuccess CHECK (NOT (PhuongThuc = N'CASH' AND TrangThai = N'SUCCESS') OR XacNhanBoi IS NOT NULL),
                CONSTRAINT FK_GiaoDich_SinhVien FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien),
                CONSTRAINT FK_GiaoDich_XacNhanBoi FOREIGN KEY (XacNhanBoi) REFERENCES dbo.TaiKhoan (MaTaiKhoan)
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GiaoDich_MaSinhVien_NgayTao' AND object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan'))
            CREATE NONCLUSTERED INDEX IX_GiaoDich_MaSinhVien_NgayTao ON dbo.GiaoDichThanhToan (MaSinhVien, NgayTao DESC);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GiaoDich_TrangThai_PhuongThuc' AND object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan'))
            CREATE NONCLUSTERED INDEX IX_GiaoDich_TrangThai_PhuongThuc ON dbo.GiaoDichThanhToan (TrangThai, PhuongThuc);

        IF OBJECT_ID(N'dbo.ChiTietGiaoDich', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ChiTietGiaoDich
            (
                MaGiaoDich nvarchar(60) NOT NULL,
                MaChiTiet nvarchar(40) NOT NULL,
                SoTien decimal(18, 2) NOT NULL,
                CONSTRAINT PK_ChiTietGiaoDich PRIMARY KEY (MaGiaoDich, MaChiTiet),
                CONSTRAINT CK_ChiTietGiaoDich_SoTien CHECK (SoTien >= 0),
                CONSTRAINT FK_ChiTietGiaoDich_GiaoDich FOREIGN KEY (MaGiaoDich) REFERENCES dbo.GiaoDichThanhToan (MaGiaoDich) ON DELETE CASCADE,
                CONSTRAINT FK_ChiTietGiaoDich_ChiTiet FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHoaDon (MaChiTiet)
            );
        END;

        /* Backfill hạng mục từ hóa đơn cũ — trước khi gắn trigger */
        INSERT INTO dbo.ChiTietHoaDon (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, GhiChu, TrangThai, NgayThanhToan, ThuTu)
        SELECT
            LEFT(hd.MaHoaDon, 37) + N'-01',
            hd.MaHoaDon, N'ROOM', N'Tiền phòng', hd.TienPhong, NULL,
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN N'Đã thanh toán' ELSE N'Chưa thanh toán' END,
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN ISNULL(hd.NgayThanhToan, CAST(hd.NgayLap AS datetime)) ELSE NULL END,
            1
        FROM dbo.HoaDon hd
        WHERE ISNULL(hd.TienPhong, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon AND c.MaKhoan = N'ROOM');

        INSERT INTO dbo.ChiTietHoaDon (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, GhiChu, TrangThai, NgayThanhToan, ThuTu)
        SELECT
            LEFT(hd.MaHoaDon, 37) + N'-02',
            hd.MaHoaDon, N'ELECTRICITY', N'Tiền điện', hd.TienDien,
            N'Chỉ số ' + CAST(ISNULL(hd.SoDienCu, 0) AS nvarchar(20)) + N' → ' + CAST(ISNULL(hd.SoDienMoi, hd.ChiSoDien) AS nvarchar(20)),
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN N'Đã thanh toán' ELSE N'Chưa thanh toán' END,
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN ISNULL(hd.NgayThanhToan, CAST(hd.NgayLap AS datetime)) ELSE NULL END,
            2
        FROM dbo.HoaDon hd
        WHERE ISNULL(hd.TienDien, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon AND c.MaKhoan = N'ELECTRICITY');

        INSERT INTO dbo.ChiTietHoaDon (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, GhiChu, TrangThai, NgayThanhToan, ThuTu)
        SELECT
            LEFT(hd.MaHoaDon, 37) + N'-03',
            hd.MaHoaDon, N'WATER', N'Tiền nước', hd.TienNuoc,
            N'Chỉ số ' + CAST(ISNULL(hd.SoNuocCu, 0) AS nvarchar(20)) + N' → ' + CAST(ISNULL(hd.SoNuocMoi, hd.ChiSoNuoc) AS nvarchar(20)),
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN N'Đã thanh toán' ELSE N'Chưa thanh toán' END,
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN ISNULL(hd.NgayThanhToan, CAST(hd.NgayLap AS datetime)) ELSE NULL END,
            3
        FROM dbo.HoaDon hd
        WHERE ISNULL(hd.TienNuoc, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon AND c.MaKhoan = N'WATER');

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HoaDon_DongBoChiTiet
ON dbo.HoaDon
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1
        RETURN;

    DECLARE @HasAmount BIT = CASE WHEN UPDATE(TienPhong) OR UPDATE(TienDien) OR UPDATE(TienNuoc) THEN 1 ELSE 0 END;
    DECLARE @HasStatus BIT = CASE WHEN UPDATE(TrangThaiThanhToan) THEN 1 ELSE 0 END;

    IF @HasAmount = 1
    BEGIN
        MERGE dbo.ChiTietHoaDon AS t
        USING (
            SELECT i.MaHoaDon, N''ROOM'' AS MaKhoan, N''Tiền phòng'' AS TenKhoan, ISNULL(i.TienPhong, 0) AS SoTien, 1 AS ThuTu
            FROM inserted i
            WHERE ISNULL(i.TienPhong, 0) > 0
            UNION ALL
            SELECT i.MaHoaDon, N''ELECTRICITY'', N''Tiền điện'', ISNULL(i.TienDien, 0), 2
            FROM inserted i
            WHERE ISNULL(i.TienDien, 0) > 0
            UNION ALL
            SELECT i.MaHoaDon, N''WATER'', N''Tiền nước'', ISNULL(i.TienNuoc, 0), 3
            FROM inserted i
            WHERE ISNULL(i.TienNuoc, 0) > 0
        ) AS s
        ON t.MaHoaDon = s.MaHoaDon AND t.MaKhoan = s.MaKhoan AND t.TenKhoan = s.TenKhoan
        WHEN MATCHED AND t.TrangThai = N''Chưa thanh toán'' THEN
            UPDATE SET SoTien = s.SoTien, ThuTu = s.ThuTu
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, TrangThai, ThuTu)
            VALUES (
                LEFT(s.MaHoaDon, 37) + CASE s.MaKhoan
                    WHEN N''ROOM'' THEN N''-01''
                    WHEN N''ELECTRICITY'' THEN N''-02''
                    ELSE N''-03''
                END,
                s.MaHoaDon, s.MaKhoan, s.TenKhoan, s.SoTien, N''Chưa thanh toán'', s.ThuTu
            );

        UPDATE c
        SET SoTien = CASE c.MaKhoan
                WHEN N''ROOM'' THEN ISNULL(i.TienPhong, 0)
                WHEN N''ELECTRICITY'' THEN ISNULL(i.TienDien, 0)
                WHEN N''WATER'' THEN ISNULL(i.TienNuoc, 0)
                ELSE c.SoTien
            END
        FROM dbo.ChiTietHoaDon c
        INNER JOIN inserted i ON i.MaHoaDon = c.MaHoaDon
        WHERE c.TrangThai = N''Chưa thanh toán''
          AND c.MaKhoan IN (N''ROOM'', N''ELECTRICITY'', N''WATER'');
    END;

    IF @HasStatus = 1
    BEGIN
        UPDATE c
        SET TrangThai = N''Đã thanh toán'',
            NgayThanhToan = ISNULL(c.NgayThanhToan, GETDATE())
        FROM dbo.ChiTietHoaDon c
        INNER JOIN inserted i ON i.MaHoaDon = c.MaHoaDon
        LEFT JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        WHERE i.TrangThaiThanhToan = N''Đã thanh toán''
          AND ISNULL(d.TrangThaiThanhToan, N'''') <> N''Đã thanh toán''
          AND c.TrangThai <> N''Đã thanh toán'';
        /* Chuyển ngược về Chưa thanh toán: không hoàn tác hạng mục đã SUCCESS */
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_DongBoHoaDon
ON dbo.ChiTietHoaDon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Hd TABLE (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @Hd (MaHoaDon)
    SELECT DISTINCT MaHoaDon FROM inserted
    UNION
    SELECT DISTINCT MaHoaDon FROM deleted;

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
    INNER JOIN @Hd x ON x.MaHoaDon = hd.MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe
ON dbo.ChiTietHoaDon
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        WHERE d.TrangThai = N''Đã thanh toán''
          AND NOT EXISTS (SELECT 1 FROM inserted i WHERE i.MaChiTiet = d.MaChiTiet)
    )
    BEGIN
        THROW 50011, N''Không được xóa hạng mục đã thanh toán.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaChiTiet = i.MaChiTiet
        WHERE d.TrangThai = N''Đã thanh toán''
          AND i.SoTien <> d.SoTien
    )
    BEGIN
        THROW 50012, N''Không được sửa số tiền hạng mục đã thanh toán.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietGiaoDich_MotSuccess
ON dbo.ChiTietGiaoDich
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT ct.MaChiTiet
        FROM dbo.ChiTietGiaoDich ct
        INNER JOIN inserted i ON i.MaChiTiet = ct.MaChiTiet
        INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = ct.MaGiaoDich
        WHERE gd.TrangThai = N''SUCCESS''
        GROUP BY ct.MaChiTiet
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 50013, N''Hạng mục đã thuộc một giao dịch SUCCESS.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_GiaoDich_MotSuccess
ON dbo.GiaoDichThanhToan
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT ct.MaChiTiet
        FROM dbo.ChiTietGiaoDich ct
        INNER JOIN inserted i ON i.MaGiaoDich = ct.MaGiaoDich
        INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = ct.MaGiaoDich
        WHERE gd.TrangThai = N''SUCCESS''
        GROUP BY ct.MaChiTiet
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 50013, N''Hạng mục đã thuộc một giao dịch SUCCESS.'', 1;
    END;
END;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'003', N'003_invoice_items_payments.sql');

        COMMIT TRANSACTION;
        PRINT N'[003] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 003: restore backup. Hai trigger đồng bộ dùng TRIGGER_NESTLEVEL()>1 trên TRG_HoaDon_DongBoChiTiet
để không lặp vô hạn khi TRG_ChiTietHoaDon_DongBoHoaDon cập nhật HoaDon.
*/
