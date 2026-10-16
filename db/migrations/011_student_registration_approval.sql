SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50090, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'010')
    THROW 50091, N'Chạy migration 010 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'011')
    PRINT N'[011] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF COL_LENGTH(N'dbo.SinhVien', N'Truong') IS NULL
           OR COL_LENGTH(N'dbo.SinhVien', N'Lop') IS NULL
           OR COL_LENGTH(N'dbo.SinhVien', N'DiaChi') IS NULL
            THROW 50092, N'Migration 002 cần được chạy để có các cột DiaChi, Truong và Lop trong SinhVien.', 1;

        IF OBJECT_ID(N'dbo.DangKySinhVienChoDuyet', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.DangKySinhVienChoDuyet
            (
                Id bigint IDENTITY(1,1) NOT NULL
                    CONSTRAINT PK_DangKySinhVienChoDuyet PRIMARY KEY,
                MaSinhVien nvarchar(20) NOT NULL,
                HoTen nvarchar(100) NOT NULL,
                NgaySinh date NOT NULL,
                GioiTinh nvarchar(10) NOT NULL,
                SoDienThoai varchar(10) NOT NULL,
                Email varchar(100) NOT NULL,
                DiaChi nvarchar(255) NULL,
                Truong nvarchar(150) NOT NULL,
                Lop nvarchar(50) NOT NULL,
                MatKhauHash varchar(255) NOT NULL,
                TrangThai nvarchar(20) NOT NULL
                    CONSTRAINT DF_DangKySinhVienChoDuyet_TrangThai DEFAULT (N'Chờ duyệt'),
                NgayTao datetime NOT NULL
                    CONSTRAINT DF_DangKySinhVienChoDuyet_NgayTao DEFAULT (GETDATE()),
                NgayXuLy datetime NULL,
                XuLyBoi int NULL,
                LyDoTuChoi nvarchar(500) NULL,
                CONSTRAINT CK_DangKySinhVienChoDuyet_TrangThai
                    CHECK (TrangThai IN (N'Chờ duyệt', N'Đã duyệt', N'Từ chối')),
                CONSTRAINT FK_DangKySinhVienChoDuyet_TaiKhoan
                    FOREIGN KEY (XuLyBoi) REFERENCES dbo.TaiKhoan (MaTaiKhoan)
            );
        END;

        IF NOT EXISTS
        (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.DangKySinhVienChoDuyet')
              AND name = N'UX_DangKySinhVienChoDuyet_MaSinhVien_ChoDuyet'
        )
            CREATE UNIQUE NONCLUSTERED INDEX UX_DangKySinhVienChoDuyet_MaSinhVien_ChoDuyet
                ON dbo.DangKySinhVienChoDuyet (MaSinhVien)
                WHERE TrangThai = N'Chờ duyệt';

        IF NOT EXISTS
        (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.DangKySinhVienChoDuyet')
              AND name = N'UX_DangKySinhVienChoDuyet_Email_ChoDuyet'
        )
            CREATE UNIQUE NONCLUSTERED INDEX UX_DangKySinhVienChoDuyet_Email_ChoDuyet
                ON dbo.DangKySinhVienChoDuyet (Email)
                WHERE TrangThai = N'Chờ duyệt';

        IF NOT EXISTS
        (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.DangKySinhVienChoDuyet')
              AND name = N'IX_DangKySinhVienChoDuyet_TrangThai_NgayTao'
        )
            CREATE NONCLUSTERED INDEX IX_DangKySinhVienChoDuyet_TrangThai_NgayTao
                ON dbo.DangKySinhVienChoDuyet (TrangThai, NgayTao DESC);

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'011', N'011_student_registration_approval.sql');

        COMMIT TRANSACTION;
        PRINT N'[011] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
Rollback — chỉ chạy khi dữ liệu đăng ký đã được sao lưu/lưu trữ:
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.DangKySinhVienChoDuyet', N'U') IS NOT NULL
    DROP TABLE dbo.DangKySinhVienChoDuyet;
DELETE FROM dbo.SchemaMigration WHERE MaMigration = N'011';
COMMIT TRANSACTION;
*/
