SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50180, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'010')
    THROW 50181, N'Chạy migration 010 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'011')
    PRINT N'[011] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NULL
            THROW 50182, N'Không tìm thấy bảng dbo.YeuCauSinhVien.', 1;

        DECLARE @UnsupportedRows bigint;
        SELECT @UnsupportedRows = COUNT_BIG(*)
        FROM dbo.YeuCauSinhVien WITH (TABLOCKX, HOLDLOCK)
        WHERE Loai NOT IN (N'Gia hạn hợp đồng', N'Báo hỏng thiết bị', N'Yêu cầu khác');

        IF @UnsupportedRows > 0
            THROW 50183, N'Có yêu cầu hiện hữu ngoài danh sách loại được hỗ trợ; không thay đổi constraint.', 1;

        IF EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.YeuCauSinhVien')
              AND name = N'CK_YeuCau_Loai'
        )
            ALTER TABLE dbo.YeuCauSinhVien DROP CONSTRAINT CK_YeuCau_Loai;

        ALTER TABLE dbo.YeuCauSinhVien WITH CHECK
        ADD CONSTRAINT CK_YeuCau_Loai
        CHECK (Loai IN (N'Gia hạn hợp đồng', N'Báo hỏng thiết bị', N'Yêu cầu khác'));

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'011', N'011_align_student_request_type_check.sql');

        COMMIT TRANSACTION;
        PRINT N'[011] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
