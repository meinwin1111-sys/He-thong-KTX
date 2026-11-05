SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 54100, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 54101, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'018')
    THROW 54102, N'Chạy migration 018 trước.', 1;
IF DATABASE_PRINCIPAL_ID(N'DNKTX') IS NULL
    THROW 54103, N'Không tìm thấy user DNKTX; chưa thể cấp quyền cho bảng ThongBao.', 1;
GO

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'041')
BEGIN
    PRINT N'[041] Đã chạy trước đó — bỏ qua.';
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
        MaHoaDon nvarchar(20) NULL,
        MaSuKien nvarchar(100) NULL,
        CONSTRAINT CK_ThongBao_PhamVi CHECK
            (PhamViNhan IN (N''TAT_CA'', N''PHONG'', N''SINH_VIEN'')),
        CONSTRAINT CK_ThongBao_DoiTuong CHECK
        (
            (PhamViNhan = N''TAT_CA'' AND TenPhong IS NULL AND MaSinhVien IS NULL)
            OR (PhamViNhan = N''PHONG'' AND TenPhong IS NOT NULL AND MaSinhVien IS NULL)
            OR (PhamViNhan = N''SINH_VIEN'' AND TenPhong IS NULL AND MaSinhVien IS NOT NULL)
        ),
        CONSTRAINT FK_ThongBao_Phong FOREIGN KEY (TenPhong) REFERENCES dbo.Phong (TenPhong),
        CONSTRAINT FK_ThongBao_SinhVien FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien),
        CONSTRAINT FK_ThongBao_TaiKhoan FOREIGN KEY (NguoiTao) REFERENCES dbo.TaiKhoan (MaTaiKhoan),
        CONSTRAINT FK_ThongBao_HoaDon FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon (MaHoaDon)
    );
END;';

        EXEC sys.sp_executesql N'
IF COL_LENGTH(N''dbo.ThongBao'', N''MaHoaDon'') IS NULL
    ALTER TABLE dbo.ThongBao ADD MaHoaDon nvarchar(20) NULL;';

        EXEC sys.sp_executesql N'
IF COL_LENGTH(N''dbo.ThongBao'', N''MaSuKien'') IS NULL
    ALTER TABLE dbo.ThongBao ADD MaSuKien nvarchar(100) NULL;';

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
            GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.ThongBao TO [DNKTX];';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'041', N'041_bootstrap_student_notifications.sql');

        COMMIT TRANSACTION;
        PRINT N'[041] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
