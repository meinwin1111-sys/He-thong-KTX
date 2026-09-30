SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SchemaMigration
    (
        MaMigration nvarchar(10) NOT NULL CONSTRAINT PK_SchemaMigration PRIMARY KEY,
        TenFile nvarchar(200) NOT NULL,
        ThoiGian datetime NOT NULL CONSTRAINT DF_SchemaMigration_ThoiGian DEFAULT (GETDATE())
    );
END;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'001')
BEGIN
    PRINT N'[001] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        /* ---- DROP trigger trùng / lỗi ---- */
        IF OBJECT_ID(N'dbo.TRG_UpdateRoomCount', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdateRoomCount;

        /* ---- TaiKhoan.VaiTro: thêm Sinh viên ---- */
        DECLARE @ckVaiTro sysname;
        DECLARE @sqlDropCK nvarchar(400);
        SELECT TOP (1) @ckVaiTro = cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID(N'dbo.TaiKhoan')
          AND cc.definition LIKE N'%VaiTro%'
          AND cc.name <> N'CK_TaiKhoan_VaiTro';
        IF @ckVaiTro IS NOT NULL
        BEGIN
            SET @sqlDropCK = N'ALTER TABLE dbo.TaiKhoan DROP CONSTRAINT ' + QUOTENAME(@ckVaiTro) + N';';
            EXEC sys.sp_executesql @sqlDropCK;
        END;
        IF NOT EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE name = N'CK_TaiKhoan_VaiTro' AND parent_object_id = OBJECT_ID(N'dbo.TaiKhoan')
        )
        BEGIN
            ALTER TABLE dbo.TaiKhoan WITH CHECK
            ADD CONSTRAINT CK_TaiKhoan_VaiTro
            CHECK ([VaiTro] IN (N'Admin', N'Quản lý', N'Sinh viên'));
        END;

        /* ---- Triggers (batch riêng qua dynamic SQL) ---- */
        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_UpdatePhong
ON dbo.SinhVien
AFTER INSERT, DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;

    DECLARE @Phong TABLE (TenPhong nvarchar(50) NOT NULL PRIMARY KEY);

    INSERT INTO @Phong (TenPhong)
    SELECT DISTINCT TenPhong
    FROM (
        SELECT TenPhong FROM inserted WHERE TenPhong IS NOT NULL
        UNION
        SELECT TenPhong FROM deleted WHERE TenPhong IS NOT NULL
    ) x;

    IF NOT EXISTS (SELECT 1 FROM @Phong)
        RETURN;

    UPDATE p
    SET SoSinhVienHienTai = ISNULL(c.SoSV, 0)
    FROM dbo.Phong p
    INNER JOIN @Phong a ON a.TenPhong = p.TenPhong
    LEFT JOIN (
        SELECT sv.TenPhong, COUNT(*) AS SoSV
        FROM dbo.SinhVien sv
        INNER JOIN @Phong a2 ON a2.TenPhong = sv.TenPhong
        WHERE sv.TrangThaiSinhVien = N''Đang ở''
          AND sv.TenPhong IS NOT NULL
        GROUP BY sv.TenPhong
    ) c ON c.TenPhong = p.TenPhong;

    UPDATE p
    SET TrangThaiPhong = CASE
        WHEN p.SoSinhVienHienTai >= p.SucChuaToiDa THEN N''Đầy''
        ELSE N''Trống''
    END
    FROM dbo.Phong p
    INNER JOIN @Phong a ON a.TenPhong = p.TenPhong
    WHERE p.TrangThaiPhong NOT IN (N''Bảo trì'', N''Ngưng sử dụng'');
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_UpdateTrangThaiHopDong
ON dbo.HopDong
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1
        RETURN;

    UPDATE hd
    SET TrangThaiHopDong = N''Đã kết thúc''
    FROM dbo.HopDong hd
    INNER JOIN inserted i ON i.MaHopDong = hd.MaHopDong
    WHERE hd.TrangThaiHopDong <> N''Đã kết thúc''
      AND hd.NgayKetThuc < CAST(GETDATE() AS date);
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_SinhVien_Insert
ON dbo.SinhVien
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND p.TenPhong IS NULL
    )
    BEGIN
        RAISERROR(N''Phòng không tồn tại!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND i.GioiTinh <> p.LoaiPhong
    )
    BEGIN
        RAISERROR(N''Sai giới tính phòng!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND p.TrangThaiPhong IN (N''Bảo trì'', N''Ngưng sử dụng'')
    )
    BEGIN
        RAISERROR(N''Phòng không khả dụng!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT i.TenPhong, COUNT(*) AS SoDong
            FROM inserted i
            WHERE i.TenPhong IS NOT NULL
            GROUP BY i.TenPhong
        ) b
        INNER JOIN dbo.Phong p ON p.TenPhong = b.TenPhong
        WHERE p.SoSinhVienHienTai + b.SoDong > p.SucChuaToiDa
    )
    BEGIN
        RAISERROR(N''Phòng đã đầy!'', 16, 1);
        RETURN;
    END;

    INSERT INTO dbo.SinhVien (
        MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
        TrangThaiSinhVien, TenPhong
    )
    SELECT
        i.MaSinhVien, i.HoTen, i.NgaySinh, i.GioiTinh, i.SoDienThoai, i.Email, i.DiaChi,
        i.TrangThaiSinhVien, i.TenPhong
    FROM inserted i;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_CapNhatHopDong
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.HopDong
    SET TrangThaiHopDong = N''Đã kết thúc''
    WHERE TrangThaiHopDong = N''Còn hiệu lực''
      AND NgayKetThuc < CAST(GETDATE() AS date);
END;
';

        /* ---- Tính lại sĩ số / trạng thái phòng (giữ bảo trì, ngưng) ---- */
        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE name = N'CK_SoLuong' AND parent_object_id = OBJECT_ID(N'dbo.Phong')
        )
            ALTER TABLE dbo.Phong NOCHECK CONSTRAINT CK_SoLuong;

        UPDATE p
        SET SoSinhVienHienTai = ISNULL(c.SoSV, 0)
        FROM dbo.Phong p
        LEFT JOIN (
            SELECT TenPhong, COUNT(*) AS SoSV
            FROM dbo.SinhVien
            WHERE TrangThaiSinhVien = N'Đang ở' AND TenPhong IS NOT NULL
            GROUP BY TenPhong
        ) c ON c.TenPhong = p.TenPhong;

        UPDATE dbo.Phong
        SET TrangThaiPhong = CASE
            WHEN SoSinhVienHienTai >= SucChuaToiDa THEN N'Đầy'
            ELSE N'Trống'
        END
        WHERE TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng');

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE name = N'CK_SoLuong' AND parent_object_id = OBJECT_ID(N'dbo.Phong')
        )
            ALTER TABLE dbo.Phong WITH NOCHECK CHECK CONSTRAINT CK_SoLuong;

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'001', N'001_fix_existing_objects.sql');

        COMMIT TRANSACTION;
        PRINT N'[001] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 001 (thủ công, không chạy tự động):
- Khôi phục từ backup (khuyến nghị).
- DROP CONSTRAINT CK_TaiKhoan_VaiTro; tạo lại CHECK (Admin/Quản lý).
- Không khôi phục TRG_UpdateRoomCount (object lỗi).
*/
