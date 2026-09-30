SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50160, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'008')
    THROW 50161, N'Chạy migration 008 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'009')
    PRINT N'[009] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE name = N'CK_TaiKhoan_VaiTro'
              AND parent_object_id = OBJECT_ID(N'dbo.TaiKhoan')
        )
            ALTER TABLE dbo.TaiKhoan DROP CONSTRAINT CK_TaiKhoan_VaiTro;

        UPDATE dbo.TaiKhoan
        SET VaiTro = N'Quản lý'
        WHERE VaiTro = N'Admin';

        ALTER TABLE dbo.TaiKhoan WITH CHECK
        ADD CONSTRAINT CK_TaiKhoan_VaiTro
        CHECK (VaiTro IN (N'Quản lý', N'Sinh viên'));

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'009', N'009_canonical_management_role.sql');

        COMMIT TRANSACTION;
        PRINT N'[009] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO