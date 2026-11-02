SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 52400, N'Chạy migration 001 trước.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'023')
    THROW 52401, N'Chạy migration 023 trước.', 1;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'024')
BEGIN
    PRINT N'[024] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
IF COL_LENGTH(N''dbo.ThongBao'', N''MaHoaDon'') IS NULL
    ALTER TABLE dbo.ThongBao ADD MaHoaDon nvarchar(20) NULL;';

        EXEC sys.sp_executesql N'
IF NOT EXISTS
(
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N''dbo.ThongBao'')
      AND name = N''FK_ThongBao_HoaDon''
)
    ALTER TABLE dbo.ThongBao WITH CHECK
        ADD CONSTRAINT FK_ThongBao_HoaDon
        FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon (MaHoaDon);';

        EXEC sys.sp_executesql N'
IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N''dbo.ThongBao'')
      AND name = N''IX_ThongBao_MaHoaDon_NgayTao''
)
    CREATE INDEX IX_ThongBao_MaHoaDon_NgayTao
        ON dbo.ThongBao (MaHoaDon, NgayTao DESC);';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'024', N'024_invoice_reminder_reference.sql');

        COMMIT TRANSACTION;
        PRINT N'[024] Hoàn tất; không cập nhật dữ liệu cũ và không cấp thêm quyền.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
