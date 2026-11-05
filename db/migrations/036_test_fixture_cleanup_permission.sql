SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 53600, N'Migration 036 chỉ được chạy trên KTX_Group3_test.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 53601, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'035')
    THROW 53602, N'Chạy migration 035 trước.', 1;
IF OBJECT_ID(N'dbo.sp_HuyPhieuChiFixtureKiemThu', N'P') IS NULL
    THROW 53603, N'Không tìm thấy thủ tục cleanup fixture từ migration 035.', 1;
IF DATABASE_PRINCIPAL_ID(N'DNKTX') IS NULL
    THROW 53604, N'Không tìm thấy database principal DNKTX.', 1;
GO

GRANT EXECUTE ON OBJECT::dbo.sp_HuyPhieuChiFixtureKiemThu TO [DNKTX];
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'036')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'036', N'036_test_fixture_cleanup_permission.sql');
GO
PRINT N'[036] Hoàn tất.';
GO
