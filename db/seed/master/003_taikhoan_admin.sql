SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.TaiKhoan', N'U') IS NULL
    THROW 50130, N'Chạy migrations 001-009 trước khi seed master.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'009')
    THROW 50131, N'Chạy migration 009 trước khi seed tài khoản quản trị.', 1;

/* Quản lý là role chuẩn duy nhất cho quyền quản trị KTX. */
/* Hash bcrypt cost 12; đổi mật khẩu khởi tạo trước khi cấp hệ thống cho người dùng khác. */
DELETE FROM dbo.TaiKhoan
WHERE Email = N'adminktx@gmail.com'
  AND TenHienThi = N'Quản trị viên'
  AND VaiTro IN (N'Admin', N'Quản lý');

MERGE dbo.TaiKhoan AS target
USING (VALUES
    (N'quanlyktx@gmail.com', N'$2b$12$WgevBevxxeP3Xe6rF/cOeerFqzOC2xLdi4Z4QV6QKt5yO3vtUz1g2', N'Quản lý KTX', N'0977123456', N'Quản lý')
) AS source (Email, MatKhau, TenHienThi, SoDienThoai, VaiTro)
ON target.Email = source.Email
WHEN NOT MATCHED THEN
    INSERT (Email, MatKhau, TenHienThi, SoDienThoai, VaiTro)
    VALUES (source.Email, source.MatKhau, source.TenHienThi, source.SoDienThoai, source.VaiTro);
GO