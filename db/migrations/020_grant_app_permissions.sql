SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
BEGIN
    ;THROW 52020, N'Chạy migration 001 trước.', 1;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'019')
BEGIN
    ;THROW 52021, N'Chạy migration 019 trước.', 1;
END;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'020')
BEGIN
    PRINT N'[020] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    DECLARE @AppPrincipalExists bit = 0;
    EXEC sys.sp_executesql
        N'SELECT @PrincipalExists = CASE
              WHEN DATABASE_PRINCIPAL_ID(N''DNKTX'') IS NULL THEN 0 ELSE 1 END;',
        N'@PrincipalExists bit OUTPUT',
        @PrincipalExists = @AppPrincipalExists OUTPUT;

    IF @AppPrincipalExists = 0
    BEGIN
        PRINT N'[020] Bỏ qua vì user DNKTX chưa tồn tại; chưa ghi nhận migration để có thể thử lại.';
    END
    ELSE
    BEGIN
        IF OBJECT_ID(N'dbo.sp_TaoHopDong', N'P') IS NULL
           OR OBJECT_ID(N'dbo.sp_ThemSinhVienVaoHopDong', N'P') IS NULL
           OR OBJECT_ID(N'dbo.sp_SinhVienRoiHopDong', N'P') IS NULL
           OR OBJECT_ID(N'dbo.sp_GiaHanHopDong', N'P') IS NULL
           OR OBJECT_ID(N'dbo.sp_KetThucHopDong', N'P') IS NULL
           OR OBJECT_ID(N'dbo.sp_ChuyenPhong', N'P') IS NULL
           OR OBJECT_ID(N'dbo.sp_GhiNhatKyHopDong', N'P') IS NULL
        BEGIN
            ;THROW 52022, N'Thiếu procedure hợp đồng cần cấp quyền cho DNKTX.', 1;
        END;

        BEGIN TRY
            BEGIN TRANSACTION;

            EXEC sys.sp_executesql N'
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoHopDong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_ThemSinhVienVaoHopDong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_SinhVienRoiHopDong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_GiaHanHopDong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_KetThucHopDong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_ChuyenPhong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_GhiNhatKyHopDong TO [DNKTX];';

            INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
            VALUES (N'020', N'020_grant_app_permissions.sql');

            COMMIT TRANSACTION;
            PRINT N'[020] Đã cấp EXECUTE đúng các procedure hợp đồng cho DNKTX.';
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            THROW;
        END CATCH;
    END;
END;
GO
