:on error exit
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
/*
  Khôi phục filtered unique index để mỗi sinh viên chỉ có một chỗ ở hiệu lực.
  Migration 014 thường đã tạo index này; chỉ chạy sau migration 014.
*/
IF DB_NAME() = N'master'
    THROW 51804, N'Chạy script bằng sqlcmd -d với database đích.', 1;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'014')
    THROW 51701, N'Cần chạy migration 014 trước.', 1;

IF EXISTS (
    SELECT MaSinhVien FROM dbo.ChiTietHopDong
    WHERE TrangThai = N'Đang ở'
    GROUP BY MaSinhVien
    HAVING COUNT(*) > 1
)
BEGIN
    RAISERROR(N'Vẫn còn sinh viên có nhiều ChiTietHopDong đang ở. Đối soát dữ liệu rồi chạy lại.', 16, 1);
END
ELSE IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_CTHD_SinhVien_DangO'
      AND object_id = OBJECT_ID(N'dbo.ChiTietHopDong')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_CTHD_SinhVien_DangO
    ON dbo.ChiTietHopDong (MaSinhVien)
    WHERE TrangThai = N'Đang ở';
    PRINT N'Đã tạo UX_CTHD_SinhVien_DangO.';
END
ELSE
    PRINT N'UX_CTHD_SinhVien_DangO đã tồn tại.';
GO
