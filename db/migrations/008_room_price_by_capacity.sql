SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50110, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'007')
    THROW 50111, N'Chạy migration 007 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'008')
    PRINT N'[008] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF COL_LENGTH(N'dbo.Phong', N'GiaPhong') IS NULL
            THROW 50112, N'Không tìm thấy dbo.Phong.GiaPhong; cần chạy migration 006.', 1;

        UPDATE dbo.Phong
        SET GiaPhong = CASE SucChuaToiDa
            WHEN 4 THEN CONVERT(decimal(18,2), 1200000)
            WHEN 6 THEN CONVERT(decimal(18,2), 800000)
            WHEN 8 THEN CONVERT(decimal(18,2), 500000)
            ELSE CONVERT(decimal(18,2), 0)
        END;

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'008', N'008_room_price_by_capacity.sql');

        COMMIT TRANSACTION;
        PRINT N'[008] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO