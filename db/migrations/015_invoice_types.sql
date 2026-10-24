SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51500, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'014')
    THROW 51501, N'Chạy migration 014 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'015')
    PRINT N'[015] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF COL_LENGTH(N'dbo.HoaDon', N'LoaiHoaDon') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD LoaiHoaDon nvarchar(20) NULL;';

        EXEC sys.sp_executesql N'
            UPDATE dbo.HoaDon
            SET LoaiHoaDon = N''CU'';

            IF EXISTS (
                SELECT 1
                FROM dbo.HoaDon
                WHERE LoaiHoaDon NOT IN (N''TIEN_PHONG'', N''DICH_VU_PHONG'', N''CU'')
            )
                THROW 51502, N''Có loại hóa đơn ngoài danh sách cho phép; không thể thêm CHECK constraint.'', 1;

            IF NOT EXISTS (
                SELECT 1
                FROM sys.default_constraints dc
                INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
                WHERE dc.parent_object_id = OBJECT_ID(N''dbo.HoaDon'') AND c.name = N''LoaiHoaDon''
            )
                ALTER TABLE dbo.HoaDon ADD CONSTRAINT DF_HoaDon_LoaiHoaDon DEFAULT (N''CU'') FOR LoaiHoaDon;

            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE parent_object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''CK_HoaDon_LoaiHoaDon''
            )
                ALTER TABLE dbo.HoaDon WITH CHECK
                ADD CONSTRAINT CK_HoaDon_LoaiHoaDon
                CHECK (LoaiHoaDon IN (N''TIEN_PHONG'', N''DICH_VU_PHONG'', N''CU''));

            ALTER TABLE dbo.HoaDon ALTER COLUMN LoaiHoaDon nvarchar(20) NOT NULL;';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'015', N'015_invoice_types.sql');

        COMMIT TRANSACTION;
        PRINT N'[015] Hoàn tất. Hóa đơn cũ được giữ nguyên mã/tổng và gán LoaiHoaDon=CU.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
