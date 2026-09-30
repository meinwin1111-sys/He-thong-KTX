SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    RAISERROR(N'Chạy migration 001 trước.', 16, 1);
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'003')
    RAISERROR(N'Chạy migration 003 trước.', 16, 1);
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'004')
    PRINT N'[004] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.YeuCauSinhVien
            (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_YeuCauSinhVien PRIMARY KEY,
                MaYeuCau AS (N'YC' + RIGHT(N'00000' + CAST(Id AS varchar(10)), 5)) PERSISTED,
                MaSinhVien nvarchar(20) NOT NULL,
                Loai nvarchar(30) NOT NULL,
                NoiDung nvarchar(1000) NOT NULL,
                NgayKetThucDeXuat date NULL,
                TenPhong nvarchar(50) NULL,
                TrangThai nvarchar(15) NOT NULL CONSTRAINT DF_YeuCau_TrangThai DEFAULT (N'Chờ duyệt'),
                PhanHoi nvarchar(500) NULL,
                NgayTao datetime NOT NULL CONSTRAINT DF_YeuCau_NgayTao DEFAULT (GETDATE()),
                NgayXuLy datetime NULL,
                XuLyBoi int NULL,
                CONSTRAINT UQ_YeuCauSinhVien_MaYeuCau UNIQUE (MaYeuCau),
                CONSTRAINT CK_YeuCau_Loai CHECK (Loai IN (N'Gia hạn hợp đồng', N'Báo hỏng thiết bị')),
                CONSTRAINT CK_YeuCau_TrangThai CHECK (TrangThai IN (N'Chờ duyệt', N'Đã duyệt', N'Từ chối')),
                CONSTRAINT CK_YeuCau_GiaHanNgay CHECK (Loai <> N'Gia hạn hợp đồng' OR NgayKetThucDeXuat IS NOT NULL),
                CONSTRAINT CK_YeuCau_NgayXuLy CHECK (TrangThai = N'Chờ duyệt' OR NgayXuLy IS NOT NULL),
                CONSTRAINT FK_YeuCau_SinhVien FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien),
                CONSTRAINT FK_YeuCau_XuLyBoi FOREIGN KEY (XuLyBoi) REFERENCES dbo.TaiKhoan (MaTaiKhoan)
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_YeuCau_MaSinhVien_NgayTao' AND object_id = OBJECT_ID(N'dbo.YeuCauSinhVien'))
            CREATE NONCLUSTERED INDEX IX_YeuCau_MaSinhVien_NgayTao ON dbo.YeuCauSinhVien (MaSinhVien, NgayTao DESC);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_YeuCau_TrangThai_Loai' AND object_id = OBJECT_ID(N'dbo.YeuCauSinhVien'))
            CREATE NONCLUSTERED INDEX IX_YeuCau_TrangThai_Loai ON dbo.YeuCauSinhVien (TrangThai, Loai);

        IF OBJECT_ID(N'dbo.NhatKyHeThong', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.NhatKyHeThong
            (
                MaNhatKy bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_NhatKyHeThong PRIMARY KEY,
                ThoiGian datetime NOT NULL CONSTRAINT DF_NhatKy_ThoiGian DEFAULT (GETDATE()),
                MaTaiKhoan int NULL,
                HanhDong nvarchar(50) NOT NULL,
                DoiTuong nvarchar(50) NULL,
                MaDoiTuong nvarchar(60) NULL,
                ChiTiet nvarchar(500) NULL
            );
        END;

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'004', N'004_requests_and_audit.sql');

        COMMIT TRANSACTION;
        PRINT N'[004] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 004: restore backup.
YeuCauSinhVien.MaYeuCau = YC + 5 chữ số từ Id (PERSISTED).
NhatKyHeThong không có trigger — chỉ Backend ghi.
*/
