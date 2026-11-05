SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 52300, N'Không chạy migration trong master.', 1;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 52301, N'Chạy migration 001 trước.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'022')
    THROW 52302, N'Chạy migration 022 trước.', 1;

IF DATABASE_PRINCIPAL_ID(N'DNKTX') IS NULL
    THROW 52303, N'Không tìm thấy user DNKTX; chưa thể cấp quyền cho bảng ThongBao.', 1;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'023')
BEGIN
    PRINT N'[023] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
IF OBJECT_ID(N''dbo.ThongBao'', N''U'') IS NULL
BEGIN
    CREATE TABLE dbo.ThongBao
    (
        MaThongBao bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ThongBao PRIMARY KEY,
        TieuDe nvarchar(200) NOT NULL,
        NoiDung nvarchar(2000) NOT NULL,
        PhamViNhan nvarchar(10) NOT NULL,
        TenPhong nvarchar(50) NULL,
        MaSinhVien nvarchar(30) NULL,
        NguoiTao int NOT NULL,
        NgayTao datetime2(0) NOT NULL
            CONSTRAINT DF_ThongBao_NgayTao DEFAULT (SYSDATETIME()),
        DaXoa bit NOT NULL
            CONSTRAINT DF_ThongBao_DaXoa DEFAULT (0),
        CONSTRAINT CK_ThongBao_PhamVi CHECK (PhamViNhan IN (N''TAT_CA'', N''PHONG'', N''SINH_VIEN'')),
        CONSTRAINT CK_ThongBao_DoiTuong CHECK
        (
            (PhamViNhan = N''TAT_CA'' AND TenPhong IS NULL AND MaSinhVien IS NULL)
            OR (PhamViNhan = N''PHONG'' AND TenPhong IS NOT NULL AND MaSinhVien IS NULL)
            OR (PhamViNhan = N''SINH_VIEN'' AND TenPhong IS NULL AND MaSinhVien IS NOT NULL)
        ),
        CONSTRAINT FK_ThongBao_Phong FOREIGN KEY (TenPhong) REFERENCES dbo.Phong (TenPhong),
        CONSTRAINT FK_ThongBao_SinhVien FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien),
        CONSTRAINT FK_ThongBao_TaiKhoan FOREIGN KEY (NguoiTao) REFERENCES dbo.TaiKhoan (MaTaiKhoan)
    );
END;';

        EXEC sys.sp_executesql N'
IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N''dbo.ThongBao'')
      AND name = N''IX_ThongBao_NgayTao''
)
    CREATE INDEX IX_ThongBao_NgayTao
        ON dbo.ThongBao (NgayTao DESC, MaThongBao DESC)
        INCLUDE (DaXoa, PhamViNhan, TenPhong, MaSinhVien);';

        EXEC sys.sp_executesql N'
            GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.ThongBao TO [DNKTX];';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'023', N'023_student_notifications.sql');

        COMMIT TRANSACTION;
        PRINT N'[023] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
