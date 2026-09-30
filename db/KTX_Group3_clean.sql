USE [master]
GO
/****** Object:  Database [KTX_Group3]    Script Date: 9/29/2026 5:16:20 PM ******/
CREATE DATABASE [KTX_Group3]
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [KTX_Group3].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [KTX_Group3] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [KTX_Group3] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [KTX_Group3] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [KTX_Group3] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [KTX_Group3] SET ARITHABORT OFF 
GO
ALTER DATABASE [KTX_Group3] SET AUTO_CLOSE OFF 
GO
ALTER DATABASE [KTX_Group3] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [KTX_Group3] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [KTX_Group3] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [KTX_Group3] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [KTX_Group3] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [KTX_Group3] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [KTX_Group3] SET QUOTED_IDENTIFIER ON 
GO
ALTER DATABASE [KTX_Group3] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [KTX_Group3] SET  DISABLE_BROKER 
GO
ALTER DATABASE [KTX_Group3] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [KTX_Group3] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [KTX_Group3] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [KTX_Group3] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [KTX_Group3] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [KTX_Group3] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [KTX_Group3] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [KTX_Group3] SET RECOVERY FULL 
GO
ALTER DATABASE [KTX_Group3] SET  MULTI_USER 
GO
ALTER DATABASE [KTX_Group3] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [KTX_Group3] SET DB_CHAINING OFF 
GO
ALTER DATABASE [KTX_Group3] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [KTX_Group3] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [KTX_Group3] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [KTX_Group3] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
EXEC sys.sp_db_vardecimal_storage_format N'KTX_Group3', N'ON'
GO
ALTER DATABASE [KTX_Group3] SET QUERY_STORE = ON
GO
ALTER DATABASE [KTX_Group3] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 1000, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO, MAX_PLANS_PER_QUERY = 200, WAIT_STATS_CAPTURE_MODE = ON)
GO
USE [KTX_Group3]
GO
/****** Object:  User [DNKTX]    Script Date: 9/29/2026 5:16:20 PM ******/
CREATE USER [DNKTX] FOR LOGIN [DNKTX] WITH DEFAULT_SCHEMA=[dbo]
GO
ALTER ROLE [db_datareader] ADD MEMBER [DNKTX]
GO
ALTER ROLE [db_datawriter] ADD MEMBER [DNKTX]
GO
/****** Object:  Table [dbo].[HoaDon]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[HoaDon](
	[MaHoaDon] [nvarchar](20) NOT NULL,
	[MaSinhVien] [nvarchar](20) NOT NULL,
	[TenPhong] [nvarchar](50) NOT NULL,
	[NgayLap] [date] NULL,
	[TienPhong] [decimal](18, 2) NULL,
	[ChiSoDien] [int] NULL,
	[ChiSoNuoc] [int] NULL,
	[TienDien] [decimal](18, 2) NULL,
	[TienNuoc] [decimal](18, 2) NULL,
	[TongTien]  AS (([TienPhong]+[TienDien])+[TienNuoc]),
	[TrangThaiThanhToan] [nvarchar](30) NULL,
PRIMARY KEY CLUSTERED 
(
	[MaHoaDon] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[HopDong]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[HopDong](
	[MaHopDong] [nvarchar](20) NOT NULL,
	[MaSinhVien] [nvarchar](20) NOT NULL,
	[TenPhong] [nvarchar](50) NOT NULL,
	[NgayBatDau] [date] NOT NULL,
	[NgayKetThuc] [date] NOT NULL,
	[TrangThaiHopDong] [nvarchar](20) NULL,
	[NgayTao] [date] NULL,
	[GhiChu] [nvarchar](255) NULL,
PRIMARY KEY CLUSTERED 
(
	[MaHopDong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Phong]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Phong](
	[TenPhong] [nvarchar](50) NOT NULL,
	[LoaiPhong] [nvarchar](10) NULL,
	[SucChuaToiDa] [int] NOT NULL,
	[SoSinhVienHienTai] [int] NULL,
	[TrangThaiPhong] [nvarchar](20) NOT NULL,
	[GhiChu] [nvarchar](255) NULL,
	[Khu] [nvarchar](10) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[TenPhong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SinhVien]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SinhVien](
	[MaSinhVien] [nvarchar](20) NOT NULL,
	[HoTen] [nvarchar](100) NOT NULL,
	[NgaySinh] [date] NULL,
	[GioiTinh] [nvarchar](10) NULL,
	[SoDienThoai] [char](10) NULL,
	[Email] [nvarchar](100) NULL,
	[DiaChi] [nvarchar](255) NULL,
	[TrangThaiSinhVien] [nvarchar](20) NULL,
	[TenPhong] [nvarchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[MaSinhVien] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TaiKhoan]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TaiKhoan](
	[MaTaiKhoan] [int] IDENTITY(1,1) NOT NULL,
	[Email] [varchar](100) NOT NULL,
	[MatKhau] [varchar](255) NOT NULL,
	[TenHienThi] [nvarchar](100) NOT NULL,
	[SoDienThoai] [varchar](10) NULL,
	[VaiTro] [nvarchar](20) NOT NULL,
	[LanDangNhapCuoi] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[MaTaiKhoan] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
SET IDENTITY_INSERT [dbo].[TaiKhoan] ON 

SET IDENTITY_INSERT [dbo].[TaiKhoan] OFF
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ__TaiKhoan__A9D1053416CF01F2]    Script Date: 9/29/2026 5:16:21 PM ******/
ALTER TABLE [dbo].[TaiKhoan] ADD UNIQUE NONCLUSTERED 
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT (getdate()) FOR [NgayLap]
GO
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [TienPhong]
GO
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [ChiSoDien]
GO
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [ChiSoNuoc]
GO
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [TienDien]
GO
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [TienNuoc]
GO
ALTER TABLE [dbo].[HopDong] ADD  DEFAULT (getdate()) FOR [NgayTao]
GO
ALTER TABLE [dbo].[Phong] ADD  DEFAULT ((0)) FOR [SoSinhVienHienTai]
GO
ALTER TABLE [dbo].[TaiKhoan] ADD  DEFAULT (getdate()) FOR [LanDangNhapCuoi]
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD FOREIGN KEY([MaSinhVien])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD FOREIGN KEY([TenPhong])
REFERENCES [dbo].[Phong] ([TenPhong])
GO
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD FOREIGN KEY([MaSinhVien])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
GO
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD FOREIGN KEY([TenPhong])
REFERENCES [dbo].[Phong] ([TenPhong])
GO
ALTER TABLE [dbo].[SinhVien]  WITH CHECK ADD FOREIGN KEY([TenPhong])
REFERENCES [dbo].[Phong] ([TenPhong])
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([ChiSoDien]>=(0)))
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([ChiSoNuoc]>=(0)))
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([NgayLap]<=getdate()))
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([TienDien]>=(0)))
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([TienNuoc]>=(0)))
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([TienPhong]>=(0)))
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([TrangThaiThanhToan]=N'Đã thanh toán' OR [TrangThaiThanhToan]=N'Chưa thanh toán'))
GO
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD CHECK  (([NgayTao]<=getdate()))
GO
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD CHECK  (([TrangThaiHopDong]=N'Đã kết thúc' OR [TrangThaiHopDong]=N'Còn hiệu lực'))
GO
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD  CONSTRAINT [CK_NgayHopDong] CHECK  (([NgayKetThuc]>[NgayBatDau]))
GO
ALTER TABLE [dbo].[HopDong] CHECK CONSTRAINT [CK_NgayHopDong]
GO
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD CHECK  (([Khu]='C' OR [Khu]='B' OR [Khu]='A'))
GO
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD CHECK  (([SoSinhVienHienTai]>=(0)))
GO
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD CHECK  (([SucChuaToiDa]=(8) OR [SucChuaToiDa]=(6) OR [SucChuaToiDa]=(4)))
GO
ALTER TABLE [dbo].[Phong]  WITH NOCHECK ADD CHECK  (([TrangThaiPhong]=N'Ngưng sử dụng' OR [TrangThaiPhong]=N'Bảo trì' OR [TrangThaiPhong]=N'Đầy' OR [TrangThaiPhong]=N'Trống'))
GO
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD  CONSTRAINT [CK_Phong_LoaiPhong] CHECK  (([LoaiPhong]=N'Nữ' OR [LoaiPhong]=N'Nam'))
GO
ALTER TABLE [dbo].[Phong] CHECK CONSTRAINT [CK_Phong_LoaiPhong]
GO
ALTER TABLE [dbo].[Phong]  WITH NOCHECK ADD  CONSTRAINT [CK_SoLuong] CHECK  (([SoSinhVienHienTai]<=[SucChuaToiDa]))
GO
ALTER TABLE [dbo].[Phong] CHECK CONSTRAINT [CK_SoLuong]
GO
ALTER TABLE [dbo].[SinhVien]  WITH CHECK ADD CHECK  (([GioiTinh]=N'Khác' OR [GioiTinh]=N'Nữ' OR [GioiTinh]=N'Nam'))
GO
ALTER TABLE [dbo].[SinhVien]  WITH CHECK ADD CHECK  (([NgaySinh]<getdate()))
GO
ALTER TABLE [dbo].[SinhVien]  WITH CHECK ADD CHECK  (([TrangThaiSinhVien]=N'Đã rời KTX' OR [TrangThaiSinhVien]=N'Đang ở'))
GO
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD CHECK  (([Email] like '%@%.%'))
GO
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD CHECK  ((len([MatKhau])>=(6)))
GO
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD CHECK  (([SoDienThoai] like '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'))
GO
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD CHECK  (([VaiTro]=N'Quản lý' OR [VaiTro]=N'Admin'))
GO
/****** Object:  StoredProcedure [dbo].[sp_CapNhatHopDong]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROC [dbo].[sp_CapNhatHopDong]
AS
BEGIN
    UPDATE HopDong
    SET TrangThaiHopDong =
        CASE
            WHEN NgayKetThuc < GETDATE() THEN N'Hết hạn'
            ELSE N'Còn hiệu lực'
        END
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ChuyenPhong]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROC [dbo].[sp_ChuyenPhong]
    @MaSinhVien VARCHAR(20),
    @PhongMoi VARCHAR(20)
AS
BEGIN
    UPDATE SinhVien
    SET TenPhong = @PhongMoi
    WHERE MaSinhVien = @MaSinhVien
END
GO
/****** Object:  StoredProcedure [dbo].[sp_TaoHoaDon]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROC [dbo].[sp_TaoHoaDon]
    @MaHoaDon VARCHAR(20),
    @MaSinhVien VARCHAR(20),
    @TenPhong VARCHAR(20),
    @TienPhong DECIMAL(18,2),
    @ChiSoDien INT,
    @ChiSoNuoc INT
AS
BEGIN
    DECLARE @TienDien DECIMAL(18,2) = @ChiSoDien * 3500
    DECLARE @TienNuoc DECIMAL(18,2) = @ChiSoNuoc * 15000

    INSERT INTO HoaDon
    (MaHoaDon,MaSinhVien,TenPhong,NgayLap,TienPhong,ChiSoDien,ChiSoNuoc,TienDien,TienNuoc,TrangThaiThanhToan)
    VALUES
    (@MaHoaDon,@MaSinhVien,@TenPhong,GETDATE(),@TienPhong,@ChiSoDien,@ChiSoNuoc,@TienDien,@TienNuoc,N'Chưa thanh toán')
END
GO
/****** Object:  StoredProcedure [dbo].[sp_TaoHopDong]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROC [dbo].[sp_TaoHopDong]
    @MaHopDong VARCHAR(20),
    @MaSinhVien VARCHAR(20),
    @TenPhong VARCHAR(20),
    @NgayBatDau DATE,
    @NgayKetThuc DATE
AS
BEGIN
    INSERT INTO HopDong
    VALUES (@MaHopDong,@MaSinhVien,@TenPhong,@NgayBatDau,@NgayKetThuc,N'Còn hiệu lực',GETDATE(),NULL)
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ThanhToan]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROC [dbo].[sp_ThanhToan]
    @MaHoaDon VARCHAR(20)
AS
BEGIN
    UPDATE HoaDon
    SET TrangThaiThanhToan = N'Đã thanh toán'
    WHERE MaHoaDon = @MaHoaDon
END
GO
/****** Object:  StoredProcedure [dbo].[sp_ThemSinhVien]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROC [dbo].[sp_ThemSinhVien]
    @MaSinhVien VARCHAR(20),
    @HoTen NVARCHAR(100),
    @NgaySinh DATE,
    @GioiTinh NVARCHAR(10),
    @SDT VARCHAR(10),
    @Email VARCHAR(100),
    @DiaChi NVARCHAR(255),
    @TenPhong VARCHAR(20)
AS
BEGIN
    INSERT INTO SinhVien
    VALUES (@MaSinhVien,@HoTen,@NgaySinh,@GioiTinh,@SDT,@Email,@DiaChi,N'Đang ở',@TenPhong)
END
GO
/****** Object:  StoredProcedure [dbo].[sp_XoaSinhVien]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROC [dbo].[sp_XoaSinhVien]
    @MaSinhVien VARCHAR(20)
AS
BEGIN
    UPDATE SinhVien
    SET TrangThaiSinhVien = N'Đã rời KTX',
        TenPhong = NULL
    WHERE MaSinhVien = @MaSinhVien
END
GO
/****** Object:  Trigger [dbo].[TRG_UpdateTrangThaiHopDong]    Script Date: 9/29/2026 5:16:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TRIGGER [dbo].[TRG_UpdateTrangThaiHopDong]
ON [dbo].[HopDong]
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE hd
    SET TrangThaiHopDong = 
        CASE 
            WHEN hd.NgayKetThuc < GETDATE() THEN N'Đã kết thúc'
            ELSE N'Còn hiệu lực'
        END
    FROM HopDong hd
    INNER JOIN inserted i 
        ON hd.MaHopDong = i.MaHopDong;
END
GO
ALTER TABLE [dbo].[HopDong] ENABLE TRIGGER [TRG_UpdateTrangThaiHopDong]
GO
/****** Object:  Trigger [dbo].[TRG_SinhVien_Insert]    Script Date: 9/29/2026 5:16:22 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TRIGGER [dbo].[TRG_SinhVien_Insert]
ON [dbo].[SinhVien]
INSTEAD OF INSERT
AS
BEGIN
    -- 1. Check phòng tồn tại
    IF EXISTS (
        SELECT 1 FROM inserted i
        LEFT JOIN Phong p ON i.TenPhong = p.TenPhong
        WHERE p.TenPhong IS NULL
    )
    BEGIN
        RAISERROR(N'Phòng không tồn tại!',16,1);
        RETURN;
    END

    -- 2. Check giới tính
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN Phong p ON i.TenPhong = p.TenPhong
        WHERE i.GioiTinh <> p.LoaiPhong
    )
    BEGIN
        RAISERROR(N'Sai giới tính phòng!',16,1);
        RETURN;
    END

    -- 3. Check phòng bảo trì
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN Phong p ON i.TenPhong = p.TenPhong
        WHERE p.TrangThaiPhong IN (N'Bảo trì', N'Ngưng sử dụng')
    )
    BEGIN
        RAISERROR(N'Phòng không khả dụng!',16,1);
        RETURN;
    END

    -- 4. Check sức chứa
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN Phong p ON i.TenPhong = p.TenPhong
        WHERE p.SoSinhVienHienTai >= p.SucChuaToiDa
    )
    BEGIN
        RAISERROR(N'Phòng đã đầy!',16,1);
        RETURN;
    END

    INSERT INTO SinhVien
    SELECT * FROM inserted;
END
GO
ALTER TABLE [dbo].[SinhVien] ENABLE TRIGGER [TRG_SinhVien_Insert]
GO
/****** Object:  Trigger [dbo].[TRG_UpdatePhong]    Script Date: 9/29/2026 5:16:22 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   TRIGGER [dbo].[TRG_UpdatePhong]
ON [dbo].[SinhVien]
AFTER INSERT, DELETE, UPDATE
AS
BEGIN
    UPDATE P
    SET SoSinhVienHienTai = ISNULL(SV.CountSV,0)
    FROM Phong P
    LEFT JOIN (
        SELECT TenPhong, COUNT(*) CountSV
        FROM SinhVien
        GROUP BY TenPhong
    ) SV ON P.TenPhong = SV.TenPhong;

    UPDATE Phong
    SET TrangThaiPhong =
        CASE
            WHEN SoSinhVienHienTai >= SucChuaToiDa THEN N'Đầy' 
			ELSE N'Trống'
        END
END
GO
ALTER TABLE [dbo].[SinhVien] ENABLE TRIGGER [TRG_UpdatePhong]
GO
/****** Object:  Trigger [dbo].[TRG_UpdateRoomCount]    Script Date: 9/29/2026 5:16:22 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TRIGGER [dbo].[TRG_UpdateRoomCount]
ON [dbo].[SinhVien]
AFTER INSERT
AS
BEGIN
    UPDATE Phong
    SET SoSinhVienHienTai = (SELECT COUNT(*) FROM SinhVien WHERE TenPhong = (SELECT TenPhong FROM inserted))
    WHERE TenPhong = (SELECT TenPhong FROM inserted);

    -- Tự động chuyển trạng thái phòng sang 'Đầy' nếu đạt sức chứa
    UPDATE Phong
    SET TrangThaiPhong = N'Đầy'
    WHERE SoSinhVienHienTai = SucChuaToiDa;
END
GO
ALTER TABLE [dbo].[SinhVien] ENABLE TRIGGER [TRG_UpdateRoomCount]
GO
USE [master]
GO
ALTER DATABASE [KTX_Group3] SET  READ_WRITE 
GO


USE [KTX_Group3]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
SET ARITHABORT ON
SET CONCAT_NULL_YIELDS_NULL ON
SET NUMERIC_ROUNDABORT OFF
GO
PRINT N'=== Inlined migrations 001-010 ==='
GO
-- Chạy từ thư mục gốc repo. Bắt buộc -I (QUOTED_IDENTIFIER ON).
-- sqlcmd -I -S 127.0.0.1,53606 -d KTX_Group3 -U DNKTX -i db/run_all.sql
:on error exit
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
PRINT N'=== Migration 001 ==='
GO
-- BEGIN INLINE: db/migrations/001_fix_existing_objects.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SchemaMigration
    (
        MaMigration nvarchar(10) NOT NULL CONSTRAINT PK_SchemaMigration PRIMARY KEY,
        TenFile nvarchar(200) NOT NULL,
        ThoiGian datetime NOT NULL CONSTRAINT DF_SchemaMigration_ThoiGian DEFAULT (GETDATE())
    );
END;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'001')
BEGIN
    PRINT N'[001] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        /* ---- DROP trigger trùng / lỗi ---- */
        IF OBJECT_ID(N'dbo.TRG_UpdateRoomCount', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdateRoomCount;

        /* ---- TaiKhoan.VaiTro: thêm Sinh viên ---- */
        DECLARE @ckVaiTro sysname;
        DECLARE @sqlDropCK nvarchar(400);
        SELECT TOP (1) @ckVaiTro = cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID(N'dbo.TaiKhoan')
          AND cc.definition LIKE N'%VaiTro%'
          AND cc.name <> N'CK_TaiKhoan_VaiTro';
        IF @ckVaiTro IS NOT NULL
        BEGIN
            SET @sqlDropCK = N'ALTER TABLE dbo.TaiKhoan DROP CONSTRAINT ' + QUOTENAME(@ckVaiTro) + N';';
            EXEC sys.sp_executesql @sqlDropCK;
        END;
        IF NOT EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE name = N'CK_TaiKhoan_VaiTro' AND parent_object_id = OBJECT_ID(N'dbo.TaiKhoan')
        )
        BEGIN
            ALTER TABLE dbo.TaiKhoan WITH CHECK
            ADD CONSTRAINT CK_TaiKhoan_VaiTro
            CHECK ([VaiTro] IN (N'Admin', N'Quản lý', N'Sinh viên'));
        END;

        /* ---- Triggers (batch riêng qua dynamic SQL) ---- */
        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_UpdatePhong
ON dbo.SinhVien
AFTER INSERT, DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;

    DECLARE @Phong TABLE (TenPhong nvarchar(50) NOT NULL PRIMARY KEY);

    INSERT INTO @Phong (TenPhong)
    SELECT DISTINCT TenPhong
    FROM (
        SELECT TenPhong FROM inserted WHERE TenPhong IS NOT NULL
        UNION
        SELECT TenPhong FROM deleted WHERE TenPhong IS NOT NULL
    ) x;

    IF NOT EXISTS (SELECT 1 FROM @Phong)
        RETURN;

    UPDATE p
    SET SoSinhVienHienTai = ISNULL(c.SoSV, 0)
    FROM dbo.Phong p
    INNER JOIN @Phong a ON a.TenPhong = p.TenPhong
    LEFT JOIN (
        SELECT sv.TenPhong, COUNT(*) AS SoSV
        FROM dbo.SinhVien sv
        INNER JOIN @Phong a2 ON a2.TenPhong = sv.TenPhong
        WHERE sv.TrangThaiSinhVien = N''Đang ở''
          AND sv.TenPhong IS NOT NULL
        GROUP BY sv.TenPhong
    ) c ON c.TenPhong = p.TenPhong;

    UPDATE p
    SET TrangThaiPhong = CASE
        WHEN p.SoSinhVienHienTai >= p.SucChuaToiDa THEN N''Đầy''
        ELSE N''Trống''
    END
    FROM dbo.Phong p
    INNER JOIN @Phong a ON a.TenPhong = p.TenPhong
    WHERE p.TrangThaiPhong NOT IN (N''Bảo trì'', N''Ngưng sử dụng'');
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_UpdateTrangThaiHopDong
ON dbo.HopDong
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1
        RETURN;

    UPDATE hd
    SET TrangThaiHopDong = N''Đã kết thúc''
    FROM dbo.HopDong hd
    INNER JOIN inserted i ON i.MaHopDong = hd.MaHopDong
    WHERE hd.TrangThaiHopDong <> N''Đã kết thúc''
      AND hd.NgayKetThuc < CAST(GETDATE() AS date);
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_SinhVien_Insert
ON dbo.SinhVien
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND p.TenPhong IS NULL
    )
    BEGIN
        RAISERROR(N''Phòng không tồn tại!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND i.GioiTinh <> p.LoaiPhong
    )
    BEGIN
        RAISERROR(N''Sai giới tính phòng!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND p.TrangThaiPhong IN (N''Bảo trì'', N''Ngưng sử dụng'')
    )
    BEGIN
        RAISERROR(N''Phòng không khả dụng!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT i.TenPhong, COUNT(*) AS SoDong
            FROM inserted i
            WHERE i.TenPhong IS NOT NULL
            GROUP BY i.TenPhong
        ) b
        INNER JOIN dbo.Phong p ON p.TenPhong = b.TenPhong
        WHERE p.SoSinhVienHienTai + b.SoDong > p.SucChuaToiDa
    )
    BEGIN
        RAISERROR(N''Phòng đã đầy!'', 16, 1);
        RETURN;
    END;

    INSERT INTO dbo.SinhVien (
        MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
        TrangThaiSinhVien, TenPhong
    )
    SELECT
        i.MaSinhVien, i.HoTen, i.NgaySinh, i.GioiTinh, i.SoDienThoai, i.Email, i.DiaChi,
        i.TrangThaiSinhVien, i.TenPhong
    FROM inserted i;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_CapNhatHopDong
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.HopDong
    SET TrangThaiHopDong = N''Đã kết thúc''
    WHERE TrangThaiHopDong = N''Còn hiệu lực''
      AND NgayKetThuc < CAST(GETDATE() AS date);
END;
';

        /* ---- Tính lại sĩ số / trạng thái phòng (giữ bảo trì, ngưng) ---- */
        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE name = N'CK_SoLuong' AND parent_object_id = OBJECT_ID(N'dbo.Phong')
        )
            ALTER TABLE dbo.Phong NOCHECK CONSTRAINT CK_SoLuong;

        UPDATE p
        SET SoSinhVienHienTai = ISNULL(c.SoSV, 0)
        FROM dbo.Phong p
        LEFT JOIN (
            SELECT TenPhong, COUNT(*) AS SoSV
            FROM dbo.SinhVien
            WHERE TrangThaiSinhVien = N'Đang ở' AND TenPhong IS NOT NULL
            GROUP BY TenPhong
        ) c ON c.TenPhong = p.TenPhong;

        UPDATE dbo.Phong
        SET TrangThaiPhong = CASE
            WHEN SoSinhVienHienTai >= SucChuaToiDa THEN N'Đầy'
            ELSE N'Trống'
        END
        WHERE TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng');

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE name = N'CK_SoLuong' AND parent_object_id = OBJECT_ID(N'dbo.Phong')
        )
            ALTER TABLE dbo.Phong WITH NOCHECK CHECK CONSTRAINT CK_SoLuong;

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'001', N'001_fix_existing_objects.sql');

        COMMIT TRANSACTION;
        PRINT N'[001] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 001 (thủ công, không chạy tự động):
- Khôi phục từ backup (khuyến nghị).
- DROP CONSTRAINT CK_TaiKhoan_VaiTro; tạo lại CHECK (Admin/Quản lý).
- Không khôi phục TRG_UpdateRoomCount (object lỗi).
*/

-- END INLINE: db/migrations/001_fix_existing_objects.sql
GO
PRINT N'=== Migration 002 ==='
GO
-- BEGIN INLINE: db/migrations/002_schema_extensions.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
BEGIN
    RAISERROR(N'Chạy migration 001 trước.', 16, 1);
END
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'002')
BEGIN
    PRINT N'[002] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        /* ========== SinhVien ========== */
        IF COL_LENGTH(N'dbo.SinhVien', N'GhiChu') IS NULL
            ALTER TABLE dbo.SinhVien ADD GhiChu nvarchar(255) NULL;
        IF COL_LENGTH(N'dbo.SinhVien', N'Truong') IS NULL
            ALTER TABLE dbo.SinhVien ADD Truong nvarchar(150) NULL;
        IF COL_LENGTH(N'dbo.SinhVien', N'Lop') IS NULL
            ALTER TABLE dbo.SinhVien ADD Lop nvarchar(50) NULL;
        IF COL_LENGTH(N'dbo.SinhVien', N'NgayRoiKTX') IS NULL
            ALTER TABLE dbo.SinhVien ADD NgayRoiKTX date NULL;
        IF COL_LENGTH(N'dbo.SinhVien', N'NgayTao') IS NULL
            ALTER TABLE dbo.SinhVien ADD NgayTao datetime NULL CONSTRAINT DF_SinhVien_NgayTao DEFAULT (GETDATE());

        EXEC sys.sp_executesql N'
            UPDATE sv
            SET NgayRoiKTX = x.NgayKetThuc
            FROM dbo.SinhVien sv
            CROSS APPLY (
                SELECT TOP (1) hd.NgayKetThuc
                FROM dbo.HopDong hd
                WHERE hd.MaSinhVien = sv.MaSinhVien
                ORDER BY hd.NgayKetThuc DESC, hd.MaHopDong DESC
            ) x
            WHERE sv.TrangThaiSinhVien = N''Đã rời KTX''
              AND sv.NgayRoiKTX IS NULL;
        ';

        IF EXISTS (
            SELECT Email FROM dbo.SinhVien WHERE Email IS NOT NULL GROUP BY Email HAVING COUNT(*) > 1
        )
        BEGIN
            PRINT N'[002] CẢNH BÁO: SinhVien.Email đang trùng — không tạo UQ_SinhVien_Email. Xem db/audit.sql.';
        END
        ELSE IF NOT EXISTS (
            SELECT 1 FROM sys.indexes WHERE name = N'UQ_SinhVien_Email' AND object_id = OBJECT_ID(N'dbo.SinhVien')
        )
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE UNIQUE NONCLUSTERED INDEX UQ_SinhVien_Email
                ON dbo.SinhVien (Email)
                WHERE Email IS NOT NULL;
            ';
        END;

        /* INSTEAD OF INSERT: copy cột mới */
        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_SinhVien_Insert
ON dbo.SinhVien
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND p.TenPhong IS NULL
    )
    BEGIN
        RAISERROR(N''Phòng không tồn tại!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND i.GioiTinh <> p.LoaiPhong
    )
    BEGIN
        RAISERROR(N''Sai giới tính phòng!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND p.TrangThaiPhong IN (N''Bảo trì'', N''Ngưng sử dụng'')
    )
    BEGIN
        RAISERROR(N''Phòng không khả dụng!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT i.TenPhong, COUNT(*) AS SoDong
            FROM inserted i
            WHERE i.TenPhong IS NOT NULL
            GROUP BY i.TenPhong
        ) b
        INNER JOIN dbo.Phong p ON p.TenPhong = b.TenPhong
        WHERE p.SoSinhVienHienTai + b.SoDong > p.SucChuaToiDa
    )
    BEGIN
        RAISERROR(N''Phòng đã đầy!'', 16, 1);
        RETURN;
    END;

    INSERT INTO dbo.SinhVien (
        MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
        TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop, NgayRoiKTX, NgayTao
    )
    SELECT
        i.MaSinhVien, i.HoTen, i.NgaySinh, i.GioiTinh, i.SoDienThoai, i.Email, i.DiaChi,
        i.TrangThaiSinhVien, i.TenPhong, i.GhiChu, i.Truong, i.Lop, i.NgayRoiKTX,
        ISNULL(i.NgayTao, GETDATE())
    FROM inserted i;
END;
';

        /* ========== HopDong ========== */
        IF COL_LENGTH(N'dbo.HopDong', N'NgayKetThucThucTe') IS NULL
            ALTER TABLE dbo.HopDong ADD NgayKetThucThucTe date NULL;
        IF COL_LENGTH(N'dbo.HopDong', N'NgayKetThucGoc') IS NULL
            ALTER TABLE dbo.HopDong ADD NgayKetThucGoc date NULL;
        IF COL_LENGTH(N'dbo.HopDong', N'SoLanGiaHan') IS NULL
            ALTER TABLE dbo.HopDong ADD SoLanGiaHan int NOT NULL CONSTRAINT DF_HopDong_SoLanGiaHan DEFAULT (0);

        IF EXISTS (
            SELECT MaSinhVien FROM dbo.HopDong
            WHERE TrangThaiHopDong = N'Còn hiệu lực'
            GROUP BY MaSinhVien HAVING COUNT(*) > 1
        )
        BEGIN
            PRINT N'[002] CẢNH BÁO: Có sinh viên nhiều hợp đồng còn hiệu lực — không tạo UQ_HopDong_MotHieuLuc. Chạy db/optional/hopdong_unique.sql sau khi dọn dữ liệu.';
        END
        ELSE IF NOT EXISTS (
            SELECT 1 FROM sys.indexes WHERE name = N'UQ_HopDong_MotHieuLuc' AND object_id = OBJECT_ID(N'dbo.HopDong')
        )
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE UNIQUE NONCLUSTERED INDEX UQ_HopDong_MotHieuLuc
                ON dbo.HopDong (MaSinhVien)
                WHERE TrangThaiHopDong = N''Còn hiệu lực'';
            ';
        END;

        /* ========== HoaDon ========== */
        IF COL_LENGTH(N'dbo.HoaDon', N'SoDienCu') IS NULL
            ALTER TABLE dbo.HoaDon ADD SoDienCu int NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'SoDienMoi') IS NULL
            ALTER TABLE dbo.HoaDon ADD SoDienMoi int NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'SoNuocCu') IS NULL
            ALTER TABLE dbo.HoaDon ADD SoNuocCu int NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'SoNuocMoi') IS NULL
            ALTER TABLE dbo.HoaDon ADD SoNuocMoi int NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'HanThanhToan') IS NULL
            ALTER TABLE dbo.HoaDon ADD HanThanhToan date NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'PhuongThucThanhToan') IS NULL
            ALTER TABLE dbo.HoaDon ADD PhuongThucThanhToan nvarchar(30) NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'NgayThanhToan') IS NULL
            ALTER TABLE dbo.HoaDon ADD NgayThanhToan datetime NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'GhiChuThanhToan') IS NULL
            ALTER TABLE dbo.HoaDon ADD GhiChuThanhToan nvarchar(255) NULL;

        EXEC sys.sp_executesql N'
            UPDATE dbo.HoaDon
            SET SoDienCu = ISNULL(SoDienCu, 0),
                SoDienMoi = ISNULL(SoDienMoi, ChiSoDien),
                SoNuocCu = ISNULL(SoNuocCu, 0),
                SoNuocMoi = ISNULL(SoNuocMoi, ChiSoNuoc),
                HanThanhToan = ISNULL(HanThanhToan, DATEADD(day, 15, NgayLap)),
                NgayThanhToan = CASE
                    WHEN TrangThaiThanhToan = N''Đã thanh toán'' AND NgayThanhToan IS NULL
                        THEN CAST(NgayLap AS datetime)
                    ELSE NgayThanhToan
                END;
        ';
        PRINT N'[002] HoaDon.NgayThanhToan của hóa đơn đã trả được gán = NgayLap (giá trị suy đoán).';

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes WHERE name = N'IX_HoaDon_MaSinhVien_NgayLap' AND object_id = OBJECT_ID(N'dbo.HoaDon')
        )
            EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX IX_HoaDon_MaSinhVien_NgayLap ON dbo.HoaDon (MaSinhVien, NgayLap);';

        /* ========== TaiKhoan (không seed tài khoản sinh viên) ========== */
        IF COL_LENGTH(N'dbo.TaiKhoan', N'MaSinhVien') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD MaSinhVien nvarchar(20) NULL;
        IF COL_LENGTH(N'dbo.TaiKhoan', N'TrangThai') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD TrangThai nvarchar(20) NOT NULL CONSTRAINT DF_TaiKhoan_TrangThai DEFAULT (N'Hoạt động');
        IF COL_LENGTH(N'dbo.TaiKhoan', N'NgayTao') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD NgayTao datetime NULL CONSTRAINT DF_TaiKhoan_NgayTao DEFAULT (GETDATE());
        IF COL_LENGTH(N'dbo.TaiKhoan', N'SoLanDangNhapSai') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD SoLanDangNhapSai int NOT NULL CONSTRAINT DF_TaiKhoan_SoLanDangNhapSai DEFAULT (0);
        IF COL_LENGTH(N'dbo.TaiKhoan', N'KhoaDenLuc') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD KhoaDenLuc datetime NULL;

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE name = N''FK_TaiKhoan_SinhVien'' AND parent_object_id = OBJECT_ID(N''dbo.TaiKhoan'')
            )
            BEGIN
                ALTER TABLE dbo.TaiKhoan WITH CHECK
                ADD CONSTRAINT FK_TaiKhoan_SinhVien
                FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien);
            END;

            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE name = N''CK_TaiKhoan_TrangThai'' AND parent_object_id = OBJECT_ID(N''dbo.TaiKhoan'')
            )
            BEGIN
                ALTER TABLE dbo.TaiKhoan WITH CHECK
                ADD CONSTRAINT CK_TaiKhoan_TrangThai
                CHECK (TrangThai IN (N''Hoạt động'', N''Khóa''));
            END;

            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE name = N''CK_TaiKhoan_SinhVienGmail'' AND parent_object_id = OBJECT_ID(N''dbo.TaiKhoan'')
            )
            BEGIN
                ALTER TABLE dbo.TaiKhoan WITH CHECK
                ADD CONSTRAINT CK_TaiKhoan_SinhVienGmail
                CHECK (
                    VaiTro <> N''Sinh viên''
                    OR (MaSinhVien IS NOT NULL AND Email LIKE N''%@gmail.com'')
                );
            END;
        ';

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes WHERE name = N'UQ_TaiKhoan_MaSinhVien' AND object_id = OBJECT_ID(N'dbo.TaiKhoan')
        )
            EXEC sys.sp_executesql N'
                CREATE UNIQUE NONCLUSTERED INDEX UQ_TaiKhoan_MaSinhVien
                ON dbo.TaiKhoan (MaSinhVien)
                WHERE MaSinhVien IS NOT NULL;
            ';

        /* Không backfill MaSinhVien: SinhVien.Email là email trường, đăng nhập SV dùng Gmail. */

        /* ========== CauHinhHeThong ========== */
        IF OBJECT_ID(N'dbo.CauHinhHeThong', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.CauHinhHeThong
            (
                Khoa nvarchar(50) NOT NULL CONSTRAINT PK_CauHinhHeThong PRIMARY KEY,
                GiaTri nvarchar(200) NOT NULL,
                MoTa nvarchar(255) NULL
            );
        END;

        MERGE dbo.CauHinhHeThong AS t
        USING (VALUES
            (N'DON_GIA_DIEN', N'3500', N'Đơn giá điện (VND / chỉ số)'),
            (N'DON_GIA_NUOC', N'15000', N'Đơn giá nước (VND / chỉ số)'),
            (N'SO_NGAY_HAN_THANH_TOAN', N'15', N'Số ngày cộng vào NgayLap để ra hạn thanh toán'),
            (N'NGUONG_CANH_BAO_HET_HAN_ADMIN', N'7', N'Số ngày còn lại để cảnh báo admin'),
            (N'NGUONG_CANH_BAO_HET_HAN_SV', N'30', N'Số ngày còn lại để cảnh báo sinh viên'),
            (N'THOI_GIAN_HET_HAN_QR_PHUT', N'15', N'Thời gian hết hạn giao dịch ONLINE PENDING (phút)')
        ) AS s (Khoa, GiaTri, MoTa)
        ON t.Khoa = s.Khoa
        WHEN NOT MATCHED THEN
            INSERT (Khoa, GiaTri, MoTa) VALUES (s.Khoa, s.GiaTri, s.MoTa);

        /* ========== LichSuHopDong ========== */
        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.LichSuHopDong
            (
                MaLichSu int IDENTITY(1,1) NOT NULL CONSTRAINT PK_LichSuHopDong PRIMARY KEY,
                MaHopDong nvarchar(20) NOT NULL,
                MaSinhVien nvarchar(20) NOT NULL,
                HoTen nvarchar(100) NULL,
                TenPhong nvarchar(50) NULL,
                NgayBatDau date NULL,
                NgayKetThuc date NULL,
                TrangThaiHopDong nvarchar(20) NULL,
                ThaoTac nvarchar(30) NOT NULL,
                NguoiThucHien int NULL,
                ThoiGian datetime NOT NULL CONSTRAINT DF_LichSuHopDong_ThoiGian DEFAULT (GETDATE()),
                CONSTRAINT CK_LichSuHopDong_ThaoTac CHECK (ThaoTac IN (N'Tạo mới', N'Gia hạn', N'Kết thúc', N'Chuyển phòng', N'Ghi chú')),
                CONSTRAINT FK_LichSuHopDong_TaiKhoan FOREIGN KEY (NguoiThucHien) REFERENCES dbo.TaiKhoan (MaTaiKhoan)
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LichSuHopDong_MaHopDong' AND object_id = OBJECT_ID(N'dbo.LichSuHopDong'))
            CREATE NONCLUSTERED INDEX IX_LichSuHopDong_MaHopDong ON dbo.LichSuHopDong (MaHopDong);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LichSuHopDong_ThoiGian' AND object_id = OBJECT_ID(N'dbo.LichSuHopDong'))
            CREATE NONCLUSTERED INDEX IX_LichSuHopDong_ThoiGian ON dbo.LichSuHopDong (ThoiGian);

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'002', N'002_schema_extensions.sql');

        COMMIT TRANSACTION;
        PRINT N'[002] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 002: restore backup. Không DROP cột đã thêm.
Ghi chú: TaiKhoan.SoDienThoai CHECK 10 chữ số (BE chuẩn hóa +84 → 0…).
MatKhau varchar(255) đủ chứa hash dạng scrypt$salt$hash.
*/

-- END INLINE: db/migrations/002_schema_extensions.sql
GO
PRINT N'=== Migration 003 ==='
GO
-- BEGIN INLINE: db/migrations/003_invoice_items_payments.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    RAISERROR(N'Chạy migration 001 trước.', 16, 1);
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'002')
    RAISERROR(N'Chạy migration 002 trước.', 16, 1);
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'003')
    PRINT N'[003] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.ChiTietHoaDon', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ChiTietHoaDon
            (
                MaChiTiet nvarchar(40) NOT NULL CONSTRAINT PK_ChiTietHoaDon PRIMARY KEY,
                MaHoaDon nvarchar(20) NOT NULL,
                MaKhoan nvarchar(30) NOT NULL,
                TenKhoan nvarchar(100) NOT NULL,
                SoTien decimal(18, 2) NOT NULL,
                GhiChu nvarchar(255) NULL,
                TrangThai nvarchar(20) NOT NULL CONSTRAINT DF_ChiTietHoaDon_TrangThai DEFAULT (N'Chưa thanh toán'),
                NgayThanhToan datetime NULL,
                MaGiaoDich nvarchar(60) NULL,
                ThuTu int NOT NULL CONSTRAINT DF_ChiTietHoaDon_ThuTu DEFAULT (0),
                RowVer rowversion NOT NULL,
                CONSTRAINT CK_ChiTietHoaDon_SoTien CHECK (SoTien >= 0),
                CONSTRAINT CK_ChiTietHoaDon_TrangThai CHECK (TrangThai IN (N'Chưa thanh toán', N'Chờ tiền mặt', N'Đã thanh toán')),
                CONSTRAINT UQ_ChiTietHoaDon_Khoan UNIQUE (MaHoaDon, MaKhoan, TenKhoan),
                CONSTRAINT FK_ChiTietHoaDon_HoaDon FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon (MaHoaDon) ON DELETE CASCADE
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChiTietHoaDon_MaHoaDon' AND object_id = OBJECT_ID(N'dbo.ChiTietHoaDon'))
            CREATE NONCLUSTERED INDEX IX_ChiTietHoaDon_MaHoaDon ON dbo.ChiTietHoaDon (MaHoaDon);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChiTietHoaDon_TrangThai' AND object_id = OBJECT_ID(N'dbo.ChiTietHoaDon'))
            CREATE NONCLUSTERED INDEX IX_ChiTietHoaDon_TrangThai ON dbo.ChiTietHoaDon (TrangThai);

        IF OBJECT_ID(N'dbo.GiaoDichThanhToan', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.GiaoDichThanhToan
            (
                MaGiaoDich nvarchar(60) NOT NULL CONSTRAINT PK_GiaoDichThanhToan PRIMARY KEY,
                MaSinhVien nvarchar(20) NOT NULL,
                TongTien decimal(18, 2) NOT NULL,
                PhuongThuc nvarchar(10) NOT NULL,
                TrangThai nvarchar(10) NOT NULL,
                NoiDungCK nvarchar(100) NULL,
                NgayTao datetime NOT NULL CONSTRAINT DF_GiaoDich_NgayTao DEFAULT (GETDATE()),
                NgayThanhToan datetime NULL,
                HetHanLuc datetime NULL,
                XacNhanBoi int NULL,
                LyDoTuChoi nvarchar(255) NULL,
                MaThamChieuNgoai nvarchar(100) NULL,
                CONSTRAINT CK_GiaoDich_TongTien CHECK (TongTien > 0),
                CONSTRAINT CK_GiaoDich_PhuongThuc CHECK (PhuongThuc IN (N'ONLINE', N'CASH')),
                CONSTRAINT CK_GiaoDich_TrangThai CHECK (TrangThai IN (N'PENDING', N'SUCCESS', N'REJECTED', N'EXPIRED')),
                CONSTRAINT CK_GiaoDich_SuccessNgay CHECK (TrangThai <> N'SUCCESS' OR NgayThanhToan IS NOT NULL),
                CONSTRAINT CK_GiaoDich_CashSuccess CHECK (NOT (PhuongThuc = N'CASH' AND TrangThai = N'SUCCESS') OR XacNhanBoi IS NOT NULL),
                CONSTRAINT FK_GiaoDich_SinhVien FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien),
                CONSTRAINT FK_GiaoDich_XacNhanBoi FOREIGN KEY (XacNhanBoi) REFERENCES dbo.TaiKhoan (MaTaiKhoan)
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GiaoDich_MaSinhVien_NgayTao' AND object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan'))
            CREATE NONCLUSTERED INDEX IX_GiaoDich_MaSinhVien_NgayTao ON dbo.GiaoDichThanhToan (MaSinhVien, NgayTao DESC);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GiaoDich_TrangThai_PhuongThuc' AND object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan'))
            CREATE NONCLUSTERED INDEX IX_GiaoDich_TrangThai_PhuongThuc ON dbo.GiaoDichThanhToan (TrangThai, PhuongThuc);

        IF OBJECT_ID(N'dbo.ChiTietGiaoDich', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ChiTietGiaoDich
            (
                MaGiaoDich nvarchar(60) NOT NULL,
                MaChiTiet nvarchar(40) NOT NULL,
                SoTien decimal(18, 2) NOT NULL,
                CONSTRAINT PK_ChiTietGiaoDich PRIMARY KEY (MaGiaoDich, MaChiTiet),
                CONSTRAINT CK_ChiTietGiaoDich_SoTien CHECK (SoTien >= 0),
                CONSTRAINT FK_ChiTietGiaoDich_GiaoDich FOREIGN KEY (MaGiaoDich) REFERENCES dbo.GiaoDichThanhToan (MaGiaoDich) ON DELETE CASCADE,
                CONSTRAINT FK_ChiTietGiaoDich_ChiTiet FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHoaDon (MaChiTiet)
            );
        END;

        /* Backfill hạng mục từ hóa đơn cũ — trước khi gắn trigger */
        INSERT INTO dbo.ChiTietHoaDon (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, GhiChu, TrangThai, NgayThanhToan, ThuTu)
        SELECT
            LEFT(hd.MaHoaDon, 37) + N'-01',
            hd.MaHoaDon, N'ROOM', N'Tiền phòng', hd.TienPhong, NULL,
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN N'Đã thanh toán' ELSE N'Chưa thanh toán' END,
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN ISNULL(hd.NgayThanhToan, CAST(hd.NgayLap AS datetime)) ELSE NULL END,
            1
        FROM dbo.HoaDon hd
        WHERE ISNULL(hd.TienPhong, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon AND c.MaKhoan = N'ROOM');

        INSERT INTO dbo.ChiTietHoaDon (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, GhiChu, TrangThai, NgayThanhToan, ThuTu)
        SELECT
            LEFT(hd.MaHoaDon, 37) + N'-02',
            hd.MaHoaDon, N'ELECTRICITY', N'Tiền điện', hd.TienDien,
            N'Chỉ số ' + CAST(ISNULL(hd.SoDienCu, 0) AS nvarchar(20)) + N' → ' + CAST(ISNULL(hd.SoDienMoi, hd.ChiSoDien) AS nvarchar(20)),
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN N'Đã thanh toán' ELSE N'Chưa thanh toán' END,
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN ISNULL(hd.NgayThanhToan, CAST(hd.NgayLap AS datetime)) ELSE NULL END,
            2
        FROM dbo.HoaDon hd
        WHERE ISNULL(hd.TienDien, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon AND c.MaKhoan = N'ELECTRICITY');

        INSERT INTO dbo.ChiTietHoaDon (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, GhiChu, TrangThai, NgayThanhToan, ThuTu)
        SELECT
            LEFT(hd.MaHoaDon, 37) + N'-03',
            hd.MaHoaDon, N'WATER', N'Tiền nước', hd.TienNuoc,
            N'Chỉ số ' + CAST(ISNULL(hd.SoNuocCu, 0) AS nvarchar(20)) + N' → ' + CAST(ISNULL(hd.SoNuocMoi, hd.ChiSoNuoc) AS nvarchar(20)),
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN N'Đã thanh toán' ELSE N'Chưa thanh toán' END,
            CASE WHEN hd.TrangThaiThanhToan = N'Đã thanh toán' THEN ISNULL(hd.NgayThanhToan, CAST(hd.NgayLap AS datetime)) ELSE NULL END,
            3
        FROM dbo.HoaDon hd
        WHERE ISNULL(hd.TienNuoc, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon AND c.MaKhoan = N'WATER');

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HoaDon_DongBoChiTiet
ON dbo.HoaDon
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1
        RETURN;

    DECLARE @HasAmount BIT = CASE WHEN UPDATE(TienPhong) OR UPDATE(TienDien) OR UPDATE(TienNuoc) THEN 1 ELSE 0 END;
    DECLARE @HasStatus BIT = CASE WHEN UPDATE(TrangThaiThanhToan) THEN 1 ELSE 0 END;

    IF @HasAmount = 1
    BEGIN
        MERGE dbo.ChiTietHoaDon AS t
        USING (
            SELECT i.MaHoaDon, N''ROOM'' AS MaKhoan, N''Tiền phòng'' AS TenKhoan, ISNULL(i.TienPhong, 0) AS SoTien, 1 AS ThuTu
            FROM inserted i
            WHERE ISNULL(i.TienPhong, 0) > 0
            UNION ALL
            SELECT i.MaHoaDon, N''ELECTRICITY'', N''Tiền điện'', ISNULL(i.TienDien, 0), 2
            FROM inserted i
            WHERE ISNULL(i.TienDien, 0) > 0
            UNION ALL
            SELECT i.MaHoaDon, N''WATER'', N''Tiền nước'', ISNULL(i.TienNuoc, 0), 3
            FROM inserted i
            WHERE ISNULL(i.TienNuoc, 0) > 0
        ) AS s
        ON t.MaHoaDon = s.MaHoaDon AND t.MaKhoan = s.MaKhoan AND t.TenKhoan = s.TenKhoan
        WHEN MATCHED AND t.TrangThai = N''Chưa thanh toán'' THEN
            UPDATE SET SoTien = s.SoTien, ThuTu = s.ThuTu
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, TrangThai, ThuTu)
            VALUES (
                LEFT(s.MaHoaDon, 37) + CASE s.MaKhoan
                    WHEN N''ROOM'' THEN N''-01''
                    WHEN N''ELECTRICITY'' THEN N''-02''
                    ELSE N''-03''
                END,
                s.MaHoaDon, s.MaKhoan, s.TenKhoan, s.SoTien, N''Chưa thanh toán'', s.ThuTu
            );

        UPDATE c
        SET SoTien = CASE c.MaKhoan
                WHEN N''ROOM'' THEN ISNULL(i.TienPhong, 0)
                WHEN N''ELECTRICITY'' THEN ISNULL(i.TienDien, 0)
                WHEN N''WATER'' THEN ISNULL(i.TienNuoc, 0)
                ELSE c.SoTien
            END
        FROM dbo.ChiTietHoaDon c
        INNER JOIN inserted i ON i.MaHoaDon = c.MaHoaDon
        WHERE c.TrangThai = N''Chưa thanh toán''
          AND c.MaKhoan IN (N''ROOM'', N''ELECTRICITY'', N''WATER'');
    END;

    IF @HasStatus = 1
    BEGIN
        UPDATE c
        SET TrangThai = N''Đã thanh toán'',
            NgayThanhToan = ISNULL(c.NgayThanhToan, GETDATE())
        FROM dbo.ChiTietHoaDon c
        INNER JOIN inserted i ON i.MaHoaDon = c.MaHoaDon
        LEFT JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        WHERE i.TrangThaiThanhToan = N''Đã thanh toán''
          AND ISNULL(d.TrangThaiThanhToan, N'''') <> N''Đã thanh toán''
          AND c.TrangThai <> N''Đã thanh toán'';
        /* Chuyển ngược về Chưa thanh toán: không hoàn tác hạng mục đã SUCCESS */
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_DongBoHoaDon
ON dbo.ChiTietHoaDon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Hd TABLE (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @Hd (MaHoaDon)
    SELECT DISTINCT MaHoaDon FROM inserted
    UNION
    SELECT DISTINCT MaHoaDon FROM deleted;

    UPDATE hd
    SET TrangThaiThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                    SELECT 1 FROM dbo.ChiTietHoaDon c
                    WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
                )
            THEN N''Đã thanh toán''
            ELSE N''Chưa thanh toán''
        END,
        NgayThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                    SELECT 1 FROM dbo.ChiTietHoaDon c
                    WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
                )
            THEN ISNULL(hd.NgayThanhToan, GETDATE())
            ELSE hd.NgayThanhToan
        END
    FROM dbo.HoaDon hd
    INNER JOIN @Hd x ON x.MaHoaDon = hd.MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe
ON dbo.ChiTietHoaDon
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        WHERE d.TrangThai = N''Đã thanh toán''
          AND NOT EXISTS (SELECT 1 FROM inserted i WHERE i.MaChiTiet = d.MaChiTiet)
    )
    BEGIN
        THROW 50011, N''Không được xóa hạng mục đã thanh toán.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaChiTiet = i.MaChiTiet
        WHERE d.TrangThai = N''Đã thanh toán''
          AND i.SoTien <> d.SoTien
    )
    BEGIN
        THROW 50012, N''Không được sửa số tiền hạng mục đã thanh toán.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietGiaoDich_MotSuccess
ON dbo.ChiTietGiaoDich
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT ct.MaChiTiet
        FROM dbo.ChiTietGiaoDich ct
        INNER JOIN inserted i ON i.MaChiTiet = ct.MaChiTiet
        INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = ct.MaGiaoDich
        WHERE gd.TrangThai = N''SUCCESS''
        GROUP BY ct.MaChiTiet
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 50013, N''Hạng mục đã thuộc một giao dịch SUCCESS.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_GiaoDich_MotSuccess
ON dbo.GiaoDichThanhToan
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT ct.MaChiTiet
        FROM dbo.ChiTietGiaoDich ct
        INNER JOIN inserted i ON i.MaGiaoDich = ct.MaGiaoDich
        INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = ct.MaGiaoDich
        WHERE gd.TrangThai = N''SUCCESS''
        GROUP BY ct.MaChiTiet
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 50013, N''Hạng mục đã thuộc một giao dịch SUCCESS.'', 1;
    END;
END;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'003', N'003_invoice_items_payments.sql');

        COMMIT TRANSACTION;
        PRINT N'[003] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 003: restore backup. Hai trigger đồng bộ dùng TRIGGER_NESTLEVEL()>1 trên TRG_HoaDon_DongBoChiTiet
để không lặp vô hạn khi TRG_ChiTietHoaDon_DongBoHoaDon cập nhật HoaDon.
*/

-- END INLINE: db/migrations/003_invoice_items_payments.sql
GO
PRINT N'=== Migration 004 ==='
GO
-- BEGIN INLINE: db/migrations/004_requests_and_audit.sql
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

-- END INLINE: db/migrations/004_requests_and_audit.sql
GO
PRINT N'=== Migration 005 ==='
GO
-- BEGIN INLINE: db/migrations/005_procs_views_indexes.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    RAISERROR(N'Chạy migration 001 trước.', 16, 1);
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'004')
    RAISERROR(N'Chạy migration 004 trước.', 16, 1);
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'005')
    PRINT N'[005] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'Seq_MaHopDong' AND SCHEMA_NAME(schema_id) = N'dbo')
        BEGIN
            DECLARE @start int;
            SELECT @start = ISNULL(MAX(TRY_CONVERT(int, SUBSTRING(MaHopDong, 3, 20))), 0) + 1
            FROM dbo.HopDong
            WHERE MaHopDong LIKE N'HD[0-9]%';
            DECLARE @seq nvarchar(400) = N'CREATE SEQUENCE dbo.Seq_MaHopDong AS int START WITH '
                + CAST(@start AS varchar(12)) + N' INCREMENT BY 1 MINVALUE 1 NO CACHE;';
            EXEC sys.sp_executesql @seq;
        END;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVien
    @MaSinhVien VARCHAR(20),
    @HoTen NVARCHAR(100),
    @NgaySinh DATE,
    @GioiTinh NVARCHAR(10),
    @SDT VARCHAR(10),
    @Email VARCHAR(100),
    @DiaChi NVARCHAR(255),
    @TenPhong VARCHAR(20) = NULL,
    @GhiChu NVARCHAR(255) = NULL,
    @Truong NVARCHAR(150) = NULL,
    @Lop NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.SinhVien (
        MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
        TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop
    )
    VALUES (
        @MaSinhVien, @HoTen, @NgaySinh, @GioiTinh, @SDT, @Email, @DiaChi,
        N''Đang ở'', NULLIF(@TenPhong, ''''), @GhiChu, @Truong, @Lop
    );
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ChuyenPhong
    @MaSinhVien VARCHAR(20),
    @PhongMoi VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @PhongCu nvarchar(50), @HoTen nvarchar(100), @GioiTinh nvarchar(10);
        SELECT @PhongCu = sv.TenPhong, @HoTen = sv.HoTen, @GioiTinh = sv.GioiTinh
        FROM dbo.SinhVien sv
        WHERE sv.MaSinhVien = @MaSinhVien;

        IF @HoTen IS NULL
            THROW 50021, N''Sinh viên không tồn tại.'', 1;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.SinhVien
            WHERE MaSinhVien = @MaSinhVien AND TrangThaiSinhVien = N''Đang ở''
        )
            THROW 50022, N''Sinh viên không ở trạng thái Đang ở.'', 1;

        DECLARE @Loai nvarchar(10), @TrangThai nvarchar(20), @Suc int, @HienTai int;
        SELECT @Loai = LoaiPhong, @TrangThai = TrangThaiPhong, @Suc = SucChuaToiDa, @HienTai = SoSinhVienHienTai
        FROM dbo.Phong WHERE TenPhong = @PhongMoi;

        IF @Loai IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.Phong WHERE TenPhong = @PhongMoi)
            THROW 50023, N''Phòng không tồn tại!'', 1;
        IF @GioiTinh <> @Loai
            THROW 50024, N''Sai giới tính phòng!'', 1;
        IF @TrangThai IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 50025, N''Phòng không khả dụng!'', 1;
        IF ISNULL(@PhongCu, N'''') <> @PhongMoi AND @HienTai >= @Suc
            THROW 50026, N''Phòng đã đầy!'', 1;

        UPDATE dbo.SinhVien SET TenPhong = @PhongMoi WHERE MaSinhVien = @MaSinhVien;

        UPDATE dbo.HopDong
        SET TenPhong = @PhongMoi
        WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực'';

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        SELECT hd.MaHopDong, hd.MaSinhVien, @HoTen, @PhongMoi, hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong, N''Chuyển phòng''
        FROM dbo.HopDong hd
        WHERE hd.MaSinhVien = @MaSinhVien AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_XoaSinhVien
    @MaSinhVien VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien)
            THROW 50031, N''Sinh viên không tồn tại.'', 1;

        DECLARE @HoTen nvarchar(100);
        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        SELECT hd.MaHopDong, hd.MaSinhVien, @HoTen, hd.TenPhong, hd.NgayBatDau, hd.NgayKetThuc, N''Đã kết thúc'', N''Kết thúc''
        FROM dbo.HopDong hd
        WHERE hd.MaSinhVien = @MaSinhVien AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'',
            NgayKetThucThucTe = CAST(GETDATE() AS date)
        WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực'';

        UPDATE dbo.SinhVien
        SET TrangThaiSinhVien = N''Đã rời KTX'',
            TenPhong = NULL,
            NgayRoiKTX = CAST(GETDATE() AS date)
        WHERE MaSinhVien = @MaSinhVien;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHopDong
    @MaHopDong VARCHAR(20) = NULL,
    @MaSinhVien VARCHAR(20),
    @TenPhong VARCHAR(20),
    @NgayBatDau DATE,
    @NgayKetThuc DATE,
    @GhiChu NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @NgayKetThuc <= @NgayBatDau
            THROW 50041, N''Ngày kết thúc phải sau ngày bắt đầu.'', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien)
            THROW 50042, N''Sinh viên không tồn tại.'', 1;

        IF EXISTS (
            SELECT 1 FROM dbo.HopDong
            WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực''
        )
            THROW 50043, N''Sinh viên đã có hợp đồng còn hiệu lực.'', 1;

        DECLARE @GioiTinh nvarchar(10), @HoTen nvarchar(100);
        SELECT @GioiTinh = GioiTinh, @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        DECLARE @Loai nvarchar(10), @TrangThai nvarchar(20), @Suc int, @HienTai int, @PhongHienTai nvarchar(50);
        SELECT @Loai = LoaiPhong, @TrangThai = TrangThaiPhong, @Suc = SucChuaToiDa, @HienTai = SoSinhVienHienTai
        FROM dbo.Phong WHERE TenPhong = @TenPhong;
        SELECT @PhongHienTai = TenPhong FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        IF @Loai IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.Phong WHERE TenPhong = @TenPhong)
            THROW 50044, N''Phòng không tồn tại!'', 1;
        IF @GioiTinh <> @Loai
            THROW 50045, N''Sai giới tính phòng!'', 1;
        IF @TrangThai IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 50046, N''Phòng không khả dụng!'', 1;
        IF ISNULL(@PhongHienTai, N'''') <> @TenPhong AND @HienTai >= @Suc
            THROW 50047, N''Phòng đã đầy!'', 1;

        DECLARE @Ma nvarchar(20) = NULLIF(LTRIM(RTRIM(@MaHopDong)), '''');
        IF @Ma IS NULL
            SET @Ma = N''HD'' + RIGHT(N''00000'' + CAST(NEXT VALUE FOR dbo.Seq_MaHopDong AS varchar(10)), 5);

        IF EXISTS (SELECT 1 FROM dbo.HopDong WHERE MaHopDong = @Ma)
            THROW 50048, N''Mã hợp đồng đã tồn tại.'', 1;

        INSERT INTO dbo.HopDong (
            MaHopDong, MaSinhVien, TenPhong, NgayBatDau, NgayKetThuc,
            TrangThaiHopDong, NgayTao, GhiChu
        )
        VALUES (
            @Ma, @MaSinhVien, @TenPhong, @NgayBatDau, @NgayKetThuc,
            N''Còn hiệu lực'', CAST(GETDATE() AS date), @GhiChu
        );

        UPDATE dbo.SinhVien
        SET TenPhong = @TenPhong,
            TrangThaiSinhVien = N''Đang ở'',
            NgayRoiKTX = NULL
        WHERE MaSinhVien = @MaSinhVien;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        VALUES (@Ma, @MaSinhVien, @HoTen, @TenPhong, @NgayBatDau, @NgayKetThuc, N''Còn hiệu lực'', N''Tạo mới'');

        COMMIT TRANSACTION;
        SELECT @Ma AS MaHopDong;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GiaHanHopDong
    @MaHopDong NVARCHAR(20),
    @NgayKetThucMoi DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @NgayCu date, @MaSV nvarchar(20), @TenPhong nvarchar(50), @HoTen nvarchar(100), @NgayBD date;
        SELECT @NgayCu = hd.NgayKetThuc, @MaSV = hd.MaSinhVien, @TenPhong = hd.TenPhong, @NgayBD = hd.NgayBatDau
        FROM dbo.HopDong hd
        WHERE hd.MaHopDong = @MaHopDong AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        IF @NgayCu IS NULL
            THROW 50051, N''Không tìm thấy hợp đồng còn hiệu lực.'', 1;
        IF @NgayKetThucMoi <= @NgayCu
            THROW 50052, N''Ngày kết thúc mới phải sau ngày kết thúc hiện tại.'', 1;

        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSV;

        UPDATE dbo.HopDong
        SET NgayKetThucGoc = ISNULL(NgayKetThucGoc, NgayKetThuc),
            NgayKetThuc = @NgayKetThucMoi,
            SoLanGiaHan = SoLanGiaHan + 1
        WHERE MaHopDong = @MaHopDong;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        VALUES (@MaHopDong, @MaSV, @HoTen, @TenPhong, @NgayBD, @NgayKetThucMoi, N''Còn hiệu lực'', N''Gia hạn'');

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KetThucHopDong
    @MaHopDong NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaSV nvarchar(20), @TenPhong nvarchar(50), @HoTen nvarchar(100), @NgayBD date, @NgayKT date;
        SELECT @MaSV = hd.MaSinhVien, @TenPhong = hd.TenPhong, @NgayBD = hd.NgayBatDau, @NgayKT = hd.NgayKetThuc
        FROM dbo.HopDong hd
        WHERE hd.MaHopDong = @MaHopDong AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        IF @MaSV IS NULL
            THROW 50061, N''Không tìm thấy hợp đồng còn hiệu lực.'', 1;

        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSV;

        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'',
            NgayKetThucThucTe = CAST(GETDATE() AS date)
        WHERE MaHopDong = @MaHopDong;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        VALUES (@MaHopDong, @MaSV, @HoTen, @TenPhong, @NgayBD, @NgayKT, N''Đã kết thúc'', N''Kết thúc'');

        IF NOT EXISTS (
            SELECT 1 FROM dbo.HopDong
            WHERE MaSinhVien = @MaSV AND TrangThaiHopDong = N''Còn hiệu lực''
        )
        BEGIN
            UPDATE dbo.SinhVien
            SET TrangThaiSinhVien = N''Đã rời KTX'',
                TenPhong = NULL,
                NgayRoiKTX = CAST(GETDATE() AS date)
            WHERE MaSinhVien = @MaSV;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDon
    @MaHoaDon VARCHAR(20),
    @MaSinhVien VARCHAR(20),
    @TenPhong VARCHAR(20),
    @TienPhong DECIMAL(18,2),
    @ChiSoDien INT,
    @ChiSoNuoc INT,
    @SoDienCu INT = NULL,
    @SoDienMoi INT = NULL,
    @SoNuocCu INT = NULL,
    @SoNuocMoi INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DonDien decimal(18,2) = 3500, @DonNuoc decimal(18,2) = 15000, @SoNgayHan int = 15;
    SELECT @DonDien = TRY_CONVERT(decimal(18,2), GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''DON_GIA_DIEN'';
    SELECT @DonNuoc = TRY_CONVERT(decimal(18,2), GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''DON_GIA_NUOC'';
    SELECT @SoNgayHan = TRY_CONVERT(int, GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''SO_NGAY_HAN_THANH_TOAN'';
    SET @DonDien = ISNULL(@DonDien, 3500);
    SET @DonNuoc = ISNULL(@DonNuoc, 15000);
    SET @SoNgayHan = ISNULL(@SoNgayHan, 15);

    DECLARE @Dien int = @ChiSoDien, @Nuoc int = @ChiSoNuoc;
    IF @SoDienMoi IS NOT NULL AND @SoDienCu IS NOT NULL
        SET @Dien = @SoDienMoi - @SoDienCu;
    IF @SoNuocMoi IS NOT NULL AND @SoNuocCu IS NOT NULL
        SET @Nuoc = @SoNuocMoi - @SoNuocCu;
    IF @Dien < 0 OR @Nuoc < 0
        THROW 50071, N''Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ.'', 1;

    IF EXISTS (
        SELECT 1 FROM dbo.HoaDon
        WHERE MaSinhVien = @MaSinhVien
          AND YEAR(NgayLap) = YEAR(GETDATE())
          AND MONTH(NgayLap) = MONTH(GETDATE())
    )
        THROW 50072, N''Đã tồn tại hóa đơn của sinh viên trong tháng này.'', 1;

    DECLARE @TienDien decimal(18,2) = @Dien * @DonDien;
    DECLARE @TienNuoc decimal(18,2) = @Nuoc * @DonNuoc;
    DECLARE @Ngay date = CAST(GETDATE() AS date);

    INSERT INTO dbo.HoaDon (
        MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, ChiSoDien, ChiSoNuoc, TienDien, TienNuoc,
        TrangThaiThanhToan, SoDienCu, SoDienMoi, SoNuocCu, SoNuocMoi, HanThanhToan
    )
    VALUES (
        @MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, @TienPhong, @Dien, @Nuoc, @TienDien, @TienNuoc,
        N''Chưa thanh toán'',
        ISNULL(@SoDienCu, 0), ISNULL(@SoDienMoi, @Dien),
        ISNULL(@SoNuocCu, 0), ISNULL(@SoNuocMoi, @Nuoc),
        DATEADD(day, @SoNgayHan, @Ngay)
    );
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThanhToan
    @MaHoaDon VARCHAR(20),
    @PhuongThuc NVARCHAR(30) = NULL,
    @GhiChu NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.HoaDon
    SET TrangThaiThanhToan = N''Đã thanh toán'',
        NgayThanhToan = ISNULL(NgayThanhToan, GETDATE()),
        PhuongThucThanhToan = COALESCE(@PhuongThuc, PhuongThucThanhToan),
        GhiChuThanhToan = COALESCE(@GhiChu, GhiChuThanhToan)
    WHERE MaHoaDon = @MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_DongBoTrangThaiHoaDon
    @MaHoaDon NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE hd
    SET TrangThaiThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                    SELECT 1 FROM dbo.ChiTietHoaDon c
                    WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
                )
            THEN N''Đã thanh toán''
            ELSE N''Chưa thanh toán''
        END,
        NgayThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                    SELECT 1 FROM dbo.ChiTietHoaDon c
                    WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
                )
            THEN ISNULL(hd.NgayThanhToan, GETDATE())
            ELSE hd.NgayThanhToan
        END
    FROM dbo.HoaDon hd
    WHERE hd.MaHoaDon = @MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_HoaDonTongHop
AS
SELECT
    hd.MaHoaDon,
    hd.MaSinhVien,
    sv.HoTen,
    hd.TenPhong,
    hd.NgayLap,
    MONTH(hd.NgayLap) AS Thang,
    YEAR(hd.NgayLap) AS Nam,
    hd.HanThanhToan,
    hd.TrangThaiThanhToan,
    hd.TongTien AS TongTienCotTinh,
    ISNULL(x.TongThuc, 0) AS TongThuc,
    ISNULL(x.DaTra, 0) AS DaTra,
    ISNULL(x.TongThuc, 0) - ISNULL(x.DaTra, 0) AS ConNo,
    ISNULL(x.SoHangMuc, 0) AS SoHangMuc,
    CASE
        WHEN ISNULL(x.SoHangMuc, 0) > 0 AND ISNULL(x.SoChuaTra, 0) = 0 THEN N''PAID''
        WHEN ISNULL(x.DaTra, 0) > 0 AND ISNULL(x.TongThuc, 0) - ISNULL(x.DaTra, 0) > 0 THEN N''PARTIAL''
        WHEN ISNULL(x.TongThuc, 0) - ISNULL(x.DaTra, 0) > 0
             AND hd.HanThanhToan IS NOT NULL
             AND hd.HanThanhToan < CAST(GETDATE() AS date) THEN N''OVERDUE''
        ELSE N''UNPAID''
    END AS TrangThaiSuyRa
FROM dbo.HoaDon hd
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
LEFT JOIN (
    SELECT
        MaHoaDon,
        SUM(SoTien) AS TongThuc,
        SUM(CASE WHEN TrangThai = N''Đã thanh toán'' THEN SoTien ELSE 0 END) AS DaTra,
        COUNT(*) AS SoHangMuc,
        SUM(CASE WHEN TrangThai <> N''Đã thanh toán'' THEN 1 ELSE 0 END) AS SoChuaTra
    FROM dbo.ChiTietHoaDon
    GROUP BY MaHoaDon
) x ON x.MaHoaDon = hd.MaHoaDon;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
SELECT
    sv.MaSinhVien,
    sv.HoTen,
    sv.TenPhong,
    SUM(v.ConNo) AS TongCongNo,
    SUM(CASE WHEN v.TrangThaiSuyRa = N''OVERDUE'' THEN v.ConNo ELSE 0 END) AS CongNoQuaHan,
    COUNT(*) AS SoHoaDon
FROM dbo.vw_HoaDonTongHop v
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = v.MaSinhVien
GROUP BY sv.MaSinhVien, sv.HoTen, sv.TenPhong;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_DoanhThuThang
AS
SELECT
    YEAR(c.NgayThanhToan) AS Nam,
    MONTH(c.NgayThanhToan) AS Thang,
    SUM(CASE WHEN c.MaKhoan = N''ROOM'' THEN c.SoTien ELSE 0 END) AS DoanhThuTienPhong,
    SUM(CASE WHEN c.MaKhoan <> N''ROOM'' THEN c.SoTien ELSE 0 END) AS DoanhThuDienNuocKhac,
    SUM(c.SoTien) AS TongDoanhThu
FROM dbo.ChiTietHoaDon c
WHERE c.TrangThai = N''Đã thanh toán''
  AND c.NgayThanhToan IS NOT NULL
GROUP BY YEAR(c.NgayThanhToan), MONTH(c.NgayThanhToan);
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_HopDongSapHetHan
AS
SELECT
    hd.MaHopDong,
    hd.MaSinhVien,
    sv.HoTen,
    hd.TenPhong,
    hd.NgayBatDau,
    hd.NgayKetThuc,
    DATEDIFF(day, CAST(GETDATE() AS date), hd.NgayKetThuc) AS SoNgayConLai,
    TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_ADMIN'')) AS NguongAdmin,
    TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_SV'')) AS NguongSinhVien
FROM dbo.HopDong hd
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
  AND hd.NgayKetThuc <= DATEADD(
        day,
        ISNULL(TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_ADMIN'')), 7),
        CAST(GETDATE() AS date)
      );
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_ThongKePhong
AS
SELECT
    p.Khu,
    p.LoaiPhong,
    COUNT(*) AS SoPhong,
    SUM(p.SucChuaToiDa) AS TongSucChua,
    SUM(CASE WHEN p.TrangThaiPhong NOT IN (N''Bảo trì'', N''Ngưng sử dụng'') THEN p.SoSinhVienHienTai ELSE 0 END) AS DangO,
    CAST(
        CASE WHEN SUM(p.SucChuaToiDa) = 0 THEN 0
             ELSE 100.0 * SUM(CASE WHEN p.TrangThaiPhong NOT IN (N''Bảo trì'', N''Ngưng sử dụng'') THEN p.SoSinhVienHienTai ELSE 0 END)
                  / NULLIF(SUM(p.SucChuaToiDa), 0)
        END AS decimal(9,2)
    ) AS TyLeLapDayPct
FROM dbo.Phong p
GROUP BY p.Khu, p.LoaiPhong;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_SinhVienChiTiet
AS
SELECT
    sv.MaSinhVien,
    sv.HoTen,
    sv.NgaySinh,
    sv.GioiTinh,
    sv.SoDienThoai,
    sv.Email AS EmailTruong,
    sv.DiaChi,
    sv.Truong,
    sv.Lop,
    sv.GhiChu,
    sv.TrangThaiSinhVien,
    sv.TenPhong,
    sv.NgayRoiKTX,
    sv.NgayTao,
    p.Khu,
    p.LoaiPhong,
    p.SucChuaToiDa,
    p.TrangThaiPhong,
    hd.MaHopDong,
    hd.NgayBatDau,
    hd.NgayKetThuc,
    hd.TrangThaiHopDong AS TrangThaiHopDongHienTai,
    tk.MaTaiKhoan,
    tk.Email AS EmailDangNhap,
    tk.VaiTro,
    tk.TrangThai AS TrangThaiTaiKhoan
FROM dbo.SinhVien sv
LEFT JOIN dbo.Phong p ON p.TenPhong = sv.TenPhong
LEFT JOIN dbo.HopDong hd ON hd.MaSinhVien = sv.MaSinhVien AND hd.TrangThaiHopDong = N''Còn hiệu lực''
LEFT JOIN dbo.TaiKhoan tk ON tk.MaSinhVien = sv.MaSinhVien;
';

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SinhVien_TrangThai_TenPhong' AND object_id = OBJECT_ID(N'dbo.SinhVien'))
            CREATE NONCLUSTERED INDEX IX_SinhVien_TrangThai_TenPhong ON dbo.SinhVien (TrangThaiSinhVien, TenPhong);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SinhVien_HoTen' AND object_id = OBJECT_ID(N'dbo.SinhVien'))
            CREATE NONCLUSTERED INDEX IX_SinhVien_HoTen ON dbo.SinhVien (HoTen);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HopDong_MaSV_TrangThai' AND object_id = OBJECT_ID(N'dbo.HopDong'))
            CREATE NONCLUSTERED INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong (MaSinhVien, TrangThaiHopDong);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HopDong_NgayKetThuc' AND object_id = OBJECT_ID(N'dbo.HopDong'))
            CREATE NONCLUSTERED INDEX IX_HopDong_NgayKetThuc ON dbo.HopDong (NgayKetThuc);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HoaDon_TrangThai_NgayLap' AND object_id = OBJECT_ID(N'dbo.HoaDon'))
            CREATE NONCLUSTERED INDEX IX_HoaDon_TrangThai_NgayLap ON dbo.HoaDon (TrangThaiThanhToan, NgayLap);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Phong_Khu_Loai_TrangThai' AND object_id = OBJECT_ID(N'dbo.Phong'))
            CREATE NONCLUSTERED INDEX IX_Phong_Khu_Loai_TrangThai ON dbo.Phong (Khu, LoaiPhong, TrangThaiPhong);

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'005', N'005_procs_views_indexes.sql');

        COMMIT TRANSACTION;
        PRINT N'[005] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 005: restore backup.
sp_TaoHopDong: tham số cũ giữ nguyên; @MaHopDong = NULL để tự sinh HD + 5 số từ SEQUENCE Seq_MaHopDong.
*/

-- END INLINE: db/migrations/005_procs_views_indexes.sql
GO
PRINT N'=== Migration 006 ==='
GO
-- BEGIN INLINE: db/migrations/006_schema_alignment.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50080, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'005')
    THROW 50081, N'Chạy migration 005 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'006')
    PRINT N'[006] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @AddedGiaPhong bit = 0;
        IF COL_LENGTH(N'dbo.Phong', N'GiaPhong') IS NULL
        BEGIN
            ALTER TABLE dbo.Phong
            ADD GiaPhong decimal(18,2) NOT NULL
                CONSTRAINT DF_Phong_GiaPhong DEFAULT (0) WITH VALUES;
            SET @AddedGiaPhong = 1;
        END;

        IF @AddedGiaPhong = 1
        BEGIN
            -- Defer binding GiaPhong until the ALTER TABLE above has completed.
            EXEC sys.sp_executesql N'
;WITH GiaPhongTheoHoaDon AS
(
    SELECT hd.TenPhong, hd.TienPhong, COUNT_BIG(*) AS SoLan,
           ROW_NUMBER() OVER (
               PARTITION BY hd.TenPhong
               ORDER BY COUNT_BIG(*) DESC, hd.TienPhong DESC
           ) AS ThuTu
    FROM dbo.HoaDon hd
    WHERE hd.TienPhong IS NOT NULL
    GROUP BY hd.TenPhong, hd.TienPhong
)
UPDATE p
SET GiaPhong = COALESCE(g.TienPhong, CASE p.SucChuaToiDa
    WHEN 4 THEN CONVERT(decimal(18,2), 1200000)
    WHEN 6 THEN CONVERT(decimal(18,2), 800000)
    WHEN 8 THEN CONVERT(decimal(18,2), 500000)
    ELSE CONVERT(decimal(18,2), 0)
END)
FROM dbo.Phong p
LEFT JOIN GiaPhongTheoHoaDon g ON g.TenPhong = p.TenPhong AND g.ThuTu = 1;
';
        END;

        IF COL_LENGTH(N'dbo.LichSuHopDong', N'MaLS') IS NULL
            ALTER TABLE dbo.LichSuHopDong
            ADD MaLS AS (N'LS' + RIGHT(N'000' + CAST(MaLichSu AS varchar(10)), 3)) PERSISTED;

        IF OBJECT_ID(N'tempdb..#FK_MaSinhVien') IS NOT NULL DROP TABLE #FK_MaSinhVien;
        CREATE TABLE #FK_MaSinhVien
        (
            ConstraintName sysname NOT NULL,
            ParentSchema sysname NOT NULL,
            ParentTable sysname NOT NULL,
            ParentColumn sysname NOT NULL,
            ReferencedSchema sysname NOT NULL,
            ReferencedTable sysname NOT NULL,
            ReferencedColumn sysname NOT NULL,
            DeleteAction nvarchar(60) NOT NULL,
            UpdateAction nvarchar(60) NOT NULL,
            IsDisabled bit NOT NULL,
            IsNotTrusted bit NOT NULL
        );

        IF EXISTS
        (
            SELECT fk.object_id
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            INNER JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
            INNER JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
            WHERE pc.name = N'MaSinhVien' OR rc.name = N'MaSinhVien'
            GROUP BY fk.object_id
            HAVING COUNT(*) > 1
        )
            THROW 50082, N'Có FK ghép chứa MaSinhVien; cần xử lý thủ công trước migration 006.', 1;

        INSERT INTO #FK_MaSinhVien
        SELECT fk.name, ps.name, pt.name, pc.name, rs.name, rt.name, rc.name,
               fk.delete_referential_action_desc, fk.update_referential_action_desc,
               fk.is_disabled, fk.is_not_trusted
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        INNER JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id
        INNER JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
        INNER JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
        INNER JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
        INNER JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
        INNER JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
        WHERE pc.name = N'MaSinhVien' OR rc.name = N'MaSinhVien';

        DECLARE @ConstraintName sysname, @PKName sysname, @ParentSchema sysname, @ParentTable sysname,
                @ParentColumn sysname, @ReferencedSchema sysname, @ReferencedTable sysname,
                @ReferencedColumn sysname, @DeleteAction nvarchar(60), @UpdateAction nvarchar(60),
                @IsDisabled bit, @IsNotTrusted bit, @Sql nvarchar(max);
        DECLARE fk_drop CURSOR LOCAL FAST_FORWARD FOR
            SELECT ConstraintName, ParentSchema, ParentTable
            FROM #FK_MaSinhVien;
        OPEN fk_drop;
        FETCH NEXT FROM fk_drop INTO @ConstraintName, @ParentSchema, @ParentTable;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @Sql = N'ALTER TABLE ' + QUOTENAME(@ParentSchema) + N'.' + QUOTENAME(@ParentTable)
                + N' DROP CONSTRAINT ' + QUOTENAME(@ConstraintName) + N';';
            EXEC sys.sp_executesql @Sql;
            FETCH NEXT FROM fk_drop INTO @ConstraintName, @ParentSchema, @ParentTable;
        END;
        CLOSE fk_drop;
        DEALLOCATE fk_drop;

        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.SinhVien') AND is_primary_key = 1)
        BEGIN
            SELECT @PKName = kc.name
            FROM sys.key_constraints kc
            WHERE kc.parent_object_id = OBJECT_ID(N'dbo.SinhVien') AND kc.type = N'PK';
            SET @Sql = N'ALTER TABLE dbo.SinhVien DROP CONSTRAINT ' + QUOTENAME(@PKName) + N';';
            EXEC sys.sp_executesql @Sql;
        END;

        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HoaDon') AND name = N'IX_HoaDon_MaSinhVien_NgayLap')
            DROP INDEX IX_HoaDon_MaSinhVien_NgayLap ON dbo.HoaDon;
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_MaSV_TrangThai')
            DROP INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong;
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TaiKhoan') AND name = N'UQ_TaiKhoan_MaSinhVien')
            DROP INDEX UQ_TaiKhoan_MaSinhVien ON dbo.TaiKhoan;
        IF OBJECT_ID(N'dbo.GiaoDichThanhToan', N'U') IS NOT NULL
           AND EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan') AND name = N'IX_GiaoDich_MaSinhVien_NgayTao')
            DROP INDEX IX_GiaoDich_MaSinhVien_NgayTao ON dbo.GiaoDichThanhToan;
        IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NOT NULL
           AND EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.YeuCauSinhVien') AND name = N'IX_YeuCau_MaSinhVien_NgayTao')
            DROP INDEX IX_YeuCau_MaSinhVien_NgayTao ON dbo.YeuCauSinhVien;

        DECLARE @SchemaName sysname, @TableName sysname, @Nullable bit;
        DECLARE ma_sv_columns CURSOR LOCAL FAST_FORWARD FOR
            SELECT s.name, t.name, c.is_nullable
            FROM sys.tables t
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            INNER JOIN sys.columns c ON c.object_id = t.object_id
            WHERE c.name = N'MaSinhVien';
        OPEN ma_sv_columns;
        FETCH NEXT FROM ma_sv_columns INTO @SchemaName, @TableName, @Nullable;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @Sql = N'ALTER TABLE ' + QUOTENAME(@SchemaName) + N'.' + QUOTENAME(@TableName)
                + N' ALTER COLUMN [MaSinhVien] nvarchar(30) ' + CASE WHEN @Nullable = 1 THEN N'NULL;' ELSE N'NOT NULL;' END;
            EXEC sys.sp_executesql @Sql;
            FETCH NEXT FROM ma_sv_columns INTO @SchemaName, @TableName, @Nullable;
        END;
        CLOSE ma_sv_columns;
        DEALLOCATE ma_sv_columns;

        IF @PKName IS NOT NULL AND NOT EXISTS
            (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.SinhVien') AND type = N'PK')
        BEGIN
            SET @Sql = N'ALTER TABLE dbo.SinhVien ADD CONSTRAINT ' + QUOTENAME(@PKName)
                + N' PRIMARY KEY CLUSTERED (MaSinhVien ASC);';
            EXEC sys.sp_executesql @Sql;
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HoaDon') AND name = N'IX_HoaDon_MaSinhVien_NgayLap')
            CREATE NONCLUSTERED INDEX IX_HoaDon_MaSinhVien_NgayLap ON dbo.HoaDon (MaSinhVien, NgayLap);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_MaSV_TrangThai')
            CREATE NONCLUSTERED INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong (MaSinhVien, TrangThaiHopDong);
        IF OBJECT_ID(N'dbo.TaiKhoan', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.TaiKhoan') AND name = N'UQ_TaiKhoan_MaSinhVien')
            CREATE UNIQUE NONCLUSTERED INDEX UQ_TaiKhoan_MaSinhVien ON dbo.TaiKhoan (MaSinhVien) WHERE MaSinhVien IS NOT NULL;
        IF OBJECT_ID(N'dbo.GiaoDichThanhToan', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan') AND name = N'IX_GiaoDich_MaSinhVien_NgayTao')
            CREATE NONCLUSTERED INDEX IX_GiaoDich_MaSinhVien_NgayTao ON dbo.GiaoDichThanhToan (MaSinhVien, NgayTao DESC);
        IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.YeuCauSinhVien') AND name = N'IX_YeuCau_MaSinhVien_NgayTao')
            CREATE NONCLUSTERED INDEX IX_YeuCau_MaSinhVien_NgayTao ON dbo.YeuCauSinhVien (MaSinhVien, NgayTao DESC);

        DECLARE fk_add CURSOR LOCAL FAST_FORWARD FOR
            SELECT ConstraintName, ParentSchema, ParentTable, ParentColumn,
                   ReferencedSchema, ReferencedTable, ReferencedColumn,
                   DeleteAction, UpdateAction, IsDisabled, IsNotTrusted
            FROM #FK_MaSinhVien;
        OPEN fk_add;
        FETCH NEXT FROM fk_add INTO @ConstraintName, @ParentSchema, @ParentTable, @ParentColumn,
            @ReferencedSchema, @ReferencedTable, @ReferencedColumn, @DeleteAction, @UpdateAction,
            @IsDisabled, @IsNotTrusted;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @Sql = N'ALTER TABLE ' + QUOTENAME(@ParentSchema) + N'.' + QUOTENAME(@ParentTable)
                + CASE WHEN @IsNotTrusted = 1 THEN N' WITH NOCHECK ADD CONSTRAINT ' ELSE N' WITH CHECK ADD CONSTRAINT ' END
                + QUOTENAME(@ConstraintName) + N' FOREIGN KEY (' + QUOTENAME(@ParentColumn) + N') REFERENCES '
                + QUOTENAME(@ReferencedSchema) + N'.' + QUOTENAME(@ReferencedTable) + N' (' + QUOTENAME(@ReferencedColumn) + N')'
                + CASE WHEN @DeleteAction = N'NO_ACTION' THEN N'' ELSE N' ON DELETE ' + REPLACE(@DeleteAction, N'_', N' ') END
                + CASE WHEN @UpdateAction = N'NO_ACTION' THEN N'' ELSE N' ON UPDATE ' + REPLACE(@UpdateAction, N'_', N' ') END + N';';
            EXEC sys.sp_executesql @Sql;
            IF @IsDisabled = 1
            BEGIN
                SET @Sql = N'ALTER TABLE ' + QUOTENAME(@ParentSchema) + N'.' + QUOTENAME(@ParentTable)
                    + N' NOCHECK CONSTRAINT ' + QUOTENAME(@ConstraintName) + N';';
                EXEC sys.sp_executesql @Sql;
            END;
            FETCH NEXT FROM fk_add INTO @ConstraintName, @ParentSchema, @ParentTable, @ParentColumn,
                @ReferencedSchema, @ReferencedTable, @ReferencedColumn, @DeleteAction, @UpdateAction,
                @IsDisabled, @IsNotTrusted;
        END;
        CLOSE fk_add;
        DEALLOCATE fk_add;

        IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.YeuCauSinhVien') AND name = N'CK_YeuCau_Loai')
            ALTER TABLE dbo.YeuCauSinhVien DROP CONSTRAINT CK_YeuCau_Loai;
        IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NOT NULL
            ALTER TABLE dbo.YeuCauSinhVien WITH CHECK
            ADD CONSTRAINT CK_YeuCau_Loai CHECK (Loai IN (N'Gia hạn hợp đồng', N'Báo hỏng thiết bị', N'Yêu cầu khác'));

        IF OBJECT_ID(N'dbo.MaHoaDonCounter', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.MaHoaDonCounter
            (
                Ky char(6) NOT NULL CONSTRAINT PK_MaHoaDonCounter PRIMARY KEY,
                SoCuoi int NOT NULL,
                CONSTRAINT CK_MaHoaDonCounter_SoCuoi CHECK (SoCuoi BETWEEN 0 AND 9999)
            );
        END;

        INSERT INTO dbo.MaHoaDonCounter (Ky, SoCuoi)
        SELECT SUBSTRING(hd.MaHoaDon, 4, 6), MAX(TRY_CONVERT(int, RIGHT(hd.MaHoaDon, 4)))
        FROM dbo.HoaDon hd
        WHERE hd.MaHoaDon LIKE N'INV[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
          AND TRY_CONVERT(int, RIGHT(hd.MaHoaDon, 4)) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dbo.MaHoaDonCounter c WHERE c.Ky = SUBSTRING(hd.MaHoaDon, 4, 6))
        GROUP BY SUBSTRING(hd.MaHoaDon, 4, 6);

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDon
    @MaHoaDon NVARCHAR(20),
    @MaSinhVien NVARCHAR(30),
    @TenPhong NVARCHAR(50),
    @TienPhong DECIMAL(18,2),
    @ChiSoDien INT,
    @ChiSoNuoc INT,
    @SoDienCu INT = NULL,
    @SoDienMoi INT = NULL,
    @SoNuocCu INT = NULL,
    @SoNuocMoi INT = NULL,
    @NgayLap DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @DonDien decimal(18,2) = 3500, @DonNuoc decimal(18,2) = 15000, @SoNgayHan int = 15;
        SELECT @DonDien = TRY_CONVERT(decimal(18,2), GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''DON_GIA_DIEN'';
        SELECT @DonNuoc = TRY_CONVERT(decimal(18,2), GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''DON_GIA_NUOC'';
        SELECT @SoNgayHan = TRY_CONVERT(int, GiaTri) FROM dbo.CauHinhHeThong WHERE Khoa = N''SO_NGAY_HAN_THANH_TOAN'';
        SET @DonDien = ISNULL(@DonDien, 3500);
        SET @DonNuoc = ISNULL(@DonNuoc, 15000);
        SET @SoNgayHan = ISNULL(@SoNgayHan, 15);

        DECLARE @Dien int = @ChiSoDien, @Nuoc int = @ChiSoNuoc;
        IF @SoDienMoi IS NOT NULL AND @SoDienCu IS NOT NULL SET @Dien = @SoDienMoi - @SoDienCu;
        IF @SoNuocMoi IS NOT NULL AND @SoNuocCu IS NOT NULL SET @Nuoc = @SoNuocMoi - @SoNuocCu;
        IF @Dien < 0 OR @Nuoc < 0 THROW 50071, N''Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ.'', 1;

        DECLARE @Ngay date = ISNULL(@NgayLap, CAST(GETDATE() AS date));
        DECLARE @Ky char(6) = CONVERT(char(6), @Ngay, 112);
        IF @MaHoaDon IS NULL OR LTRIM(RTRIM(@MaHoaDon)) = N''''
        BEGIN
            DECLARE @SoCuoi int;
            SELECT @SoCuoi = SoCuoi
            FROM dbo.MaHoaDonCounter WITH (UPDLOCK, HOLDLOCK)
            WHERE Ky = @Ky;

            IF @SoCuoi IS NULL
            BEGIN
                SET @SoCuoi = 1;
                INSERT INTO dbo.MaHoaDonCounter (Ky, SoCuoi) VALUES (@Ky, @SoCuoi);
            END
            ELSE
            BEGIN
                IF @SoCuoi >= 9999 THROW 50073, N''Đã hết dải mã hóa đơn trong tháng.'', 1;
                SET @SoCuoi = @SoCuoi + 1;
                UPDATE dbo.MaHoaDonCounter SET SoCuoi = @SoCuoi WHERE Ky = @Ky;
            END;

            SET @MaHoaDon = N''INV'' + @Ky + RIGHT(N''0000'' + CAST(@SoCuoi AS varchar(4)), 4);
        END;

        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon)
            THROW 50074, N''Mã hóa đơn đã tồn tại.'', 1;
        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaSinhVien = @MaSinhVien AND YEAR(NgayLap) = YEAR(@Ngay) AND MONTH(NgayLap) = MONTH(@Ngay))
            THROW 50072, N''Đã tồn tại hóa đơn của sinh viên trong tháng này.'', 1;

        DECLARE @TienDien decimal(18,2) = @Dien * @DonDien;
        DECLARE @TienNuoc decimal(18,2) = @Nuoc * @DonNuoc;
        INSERT INTO dbo.HoaDon (
            MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, ChiSoDien, ChiSoNuoc, TienDien, TienNuoc,
            TrangThaiThanhToan, SoDienCu, SoDienMoi, SoNuocCu, SoNuocMoi, HanThanhToan
        )
        VALUES (
            @MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, @TienPhong, @Dien, @Nuoc, @TienDien, @TienNuoc,
            N''Chưa thanh toán'', ISNULL(@SoDienCu, 0), ISNULL(@SoDienMoi, @Dien),
            ISNULL(@SoNuocCu, 0), ISNULL(@SoNuocMoi, @Nuoc), DATEADD(day, @SoNgayHan, @Ngay)
        );

        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_LichSuHopDongFE
AS
SELECT MaLS, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc,
       TrangThaiHopDong, ThaoTac, ThoiGian AS ThoiDiem
FROM dbo.LichSuHopDong;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'006', N'006_schema_alignment.sql');

        COMMIT TRANSACTION;
        PRINT N'[006] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

SELECT p.TenPhong, hd.TienPhong, COUNT(*) AS SoHoaDonMucGia
FROM dbo.Phong p
INNER JOIN dbo.HoaDon hd ON hd.TenPhong = p.TenPhong
WHERE hd.TienPhong IS NOT NULL
  AND (SELECT COUNT(DISTINCT x.TienPhong) FROM dbo.HoaDon x WHERE x.TenPhong = p.TenPhong) > 1
GROUP BY p.TenPhong, hd.TienPhong
ORDER BY p.TenPhong, hd.TienPhong;
GO
-- END INLINE: db/migrations/006_schema_alignment.sql
GO
PRINT N'=== Migration 007 ==='
GO
-- BEGIN INLINE: db/migrations/007_data_normalization_reports.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50090, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'006')
    THROW 50091, N'Chạy migration 006 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'007')
    PRINT N'[007] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KiemTraChuanHoaDuLieu
    @ApDung bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @ApDung = 1
        EXEC dbo.sp_CapNhatHopDong;

    SELECT hd.MaHopDong, hd.MaSinhVien, sv.HoTen, hd.TenPhong,
           hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
    FROM dbo.HopDong hd
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
    WHERE hd.NgayKetThuc < CAST(GETDATE() AS date)
      AND hd.TrangThaiHopDong = N''Còn hiệu lực''
    ORDER BY hd.NgayKetThuc;

    SELECT sv.MaSinhVien, sv.HoTen, sv.TrangThaiSinhVien, sv.TenPhong AS PhongSinhVien,
           hd.MaHopDong, hd.TenPhong AS PhongHopDong, hd.NgayKetThuc
    FROM dbo.SinhVien sv
    INNER JOIN dbo.HopDong hd ON hd.MaSinhVien = sv.MaSinhVien
    WHERE sv.TrangThaiSinhVien = N''Đang ở''
      AND hd.TrangThaiHopDong = N''Đã kết thúc''
      AND hd.NgayKetThuc < CAST(GETDATE() AS date)
      AND NOT EXISTS (
          SELECT 1 FROM dbo.HopDong h2
          WHERE h2.MaSinhVien = sv.MaSinhVien AND h2.TrangThaiHopDong = N''Còn hiệu lực''
      )
    ORDER BY sv.MaSinhVien, hd.NgayKetThuc DESC;

    SELECT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.NgayLap,
           hp.MaHopDong, hp.NgayBatDau, hd.TenPhong AS PhongHoaDon,
           hp.TenPhong AS PhongHopDong, sv.TenPhong AS PhongSinhVien
    FROM dbo.HoaDon hd
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
    INNER JOIN dbo.HopDong hp ON hp.MaSinhVien = hd.MaSinhVien
    WHERE hd.NgayLap < hp.NgayBatDau
    ORDER BY hd.NgayLap, hd.MaHoaDon, hp.NgayBatDau;

    SELECT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.TenPhong AS PhongHoaDon,
           sv.TenPhong AS PhongSinhVien, hd.NgayLap
    FROM dbo.HoaDon hd
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
    WHERE ISNULL(hd.TenPhong, N'''') <> ISNULL(sv.TenPhong, N'''')
    ORDER BY hd.NgayLap DESC, hd.MaHoaDon;

    SELECT hp.MaHopDong, hp.MaSinhVien, sv.HoTen, hp.TenPhong AS PhongHopDong,
           sv.TenPhong AS PhongSinhVien, hp.NgayBatDau, hp.NgayKetThuc
    FROM dbo.HopDong hp
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hp.MaSinhVien
    WHERE ISNULL(hp.TenPhong, N'''') <> ISNULL(sv.TenPhong, N'''')
    ORDER BY hp.NgayBatDau DESC, hp.MaHopDong;
END;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'007', N'007_data_normalization_reports.sql');

        COMMIT TRANSACTION;
        PRINT N'[007] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- END INLINE: db/migrations/007_data_normalization_reports.sql
GO
PRINT N'=== Migration 008 ==='
GO
-- BEGIN INLINE: db/migrations/008_room_price_by_capacity.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50110, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'007')
    THROW 50111, N'Chạy migration 007 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'008')
    PRINT N'[008] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF COL_LENGTH(N'dbo.Phong', N'GiaPhong') IS NULL
            THROW 50112, N'Không tìm thấy dbo.Phong.GiaPhong; cần chạy migration 006.', 1;

        UPDATE dbo.Phong
        SET GiaPhong = CASE SucChuaToiDa
            WHEN 4 THEN CONVERT(decimal(18,2), 1200000)
            WHEN 6 THEN CONVERT(decimal(18,2), 800000)
            WHEN 8 THEN CONVERT(decimal(18,2), 500000)
            ELSE CONVERT(decimal(18,2), 0)
        END;

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'008', N'008_room_price_by_capacity.sql');

        COMMIT TRANSACTION;
        PRINT N'[008] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- END INLINE: db/migrations/008_room_price_by_capacity.sql
GO
PRINT N'=== Migration 009 ==='
GO
-- BEGIN INLINE: db/migrations/009_canonical_management_role.sql
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
-- END INLINE: db/migrations/009_canonical_management_role.sql
PRINT N'=== Migration 010 ==='
-- BEGIN INLINE: db/migrations/010_fixes.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50170, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'009')
    THROW 50171, N'Chạy migration 009 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'010')
    PRINT N'[010] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVien
    @MaSinhVien NVARCHAR(30),
    @HoTen NVARCHAR(100),
    @NgaySinh DATE,
    @GioiTinh NVARCHAR(10),
    @SDT VARCHAR(10),
    @Email NVARCHAR(100),
    @DiaChi NVARCHAR(255),
    @TenPhong NVARCHAR(50) = NULL,
    @GhiChu NVARCHAR(255) = NULL,
    @Truong NVARCHAR(150) = NULL,
    @Lop NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.SinhVien (
        MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
        TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop
    )
    VALUES (
        @MaSinhVien, @HoTen, @NgaySinh, @GioiTinh, @SDT, @Email, @DiaChi,
        N''Đang ở'', NULLIF(@TenPhong, ''''), @GhiChu, @Truong, @Lop
    );
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ChuyenPhong
    @MaSinhVien NVARCHAR(30),
    @PhongMoi NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @PhongCu nvarchar(50), @HoTen nvarchar(100), @GioiTinh nvarchar(10);
        SELECT @PhongCu = sv.TenPhong, @HoTen = sv.HoTen, @GioiTinh = sv.GioiTinh
        FROM dbo.SinhVien sv
        WHERE sv.MaSinhVien = @MaSinhVien;

        IF @HoTen IS NULL
            THROW 50021, N''Sinh viên không tồn tại.'', 1;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.SinhVien
            WHERE MaSinhVien = @MaSinhVien AND TrangThaiSinhVien = N''Đang ở''
        )
            THROW 50022, N''Sinh viên không ở trạng thái Đang ở.'', 1;

        DECLARE @Loai nvarchar(10), @TrangThai nvarchar(20), @Suc int, @HienTai int;
        SELECT @Loai = LoaiPhong, @TrangThai = TrangThaiPhong, @Suc = SucChuaToiDa, @HienTai = SoSinhVienHienTai
        FROM dbo.Phong WHERE TenPhong = @PhongMoi;

        IF @Loai IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.Phong WHERE TenPhong = @PhongMoi)
            THROW 50023, N''Phòng không tồn tại!'', 1;
        IF @GioiTinh <> @Loai
            THROW 50024, N''Sai giới tính phòng!'', 1;
        IF @TrangThai IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 50025, N''Phòng không khả dụng!'', 1;
        IF ISNULL(@PhongCu, N'''') <> @PhongMoi AND @HienTai >= @Suc
            THROW 50026, N''Phòng đã đầy!'', 1;

        UPDATE dbo.SinhVien SET TenPhong = @PhongMoi WHERE MaSinhVien = @MaSinhVien;

        UPDATE dbo.HopDong
        SET TenPhong = @PhongMoi
        WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực'';

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        SELECT hd.MaHopDong, hd.MaSinhVien, @HoTen, @PhongMoi, hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong, N''Chuyển phòng''
        FROM dbo.HopDong hd
        WHERE hd.MaSinhVien = @MaSinhVien AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_XoaSinhVien
    @MaSinhVien NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien)
            THROW 50031, N''Sinh viên không tồn tại.'', 1;

        DECLARE @HoTen nvarchar(100);
        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        SELECT hd.MaHopDong, hd.MaSinhVien, @HoTen, hd.TenPhong, hd.NgayBatDau, hd.NgayKetThuc, N''Đã kết thúc'', N''Kết thúc''
        FROM dbo.HopDong hd
        WHERE hd.MaSinhVien = @MaSinhVien AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'',
            NgayKetThucThucTe = CAST(GETDATE() AS date)
        WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực'';

        UPDATE dbo.SinhVien
        SET TrangThaiSinhVien = N''Đã rời KTX'',
            TenPhong = NULL,
            NgayRoiKTX = CAST(GETDATE() AS date)
        WHERE MaSinhVien = @MaSinhVien;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHopDong
    @MaHopDong NVARCHAR(20) = NULL,
    @MaSinhVien NVARCHAR(30),
    @TenPhong NVARCHAR(50),
    @NgayBatDau DATE,
    @NgayKetThuc DATE,
    @GhiChu NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @NgayKetThuc <= @NgayBatDau
            THROW 50041, N''Ngày kết thúc phải sau ngày bắt đầu.'', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien)
            THROW 50042, N''Sinh viên không tồn tại.'', 1;

        IF EXISTS (
            SELECT 1 FROM dbo.HopDong
            WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N''Còn hiệu lực''
        )
            THROW 50043, N''Sinh viên đã có hợp đồng còn hiệu lực.'', 1;

        DECLARE @GioiTinh nvarchar(10), @HoTen nvarchar(100);
        SELECT @GioiTinh = GioiTinh, @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        DECLARE @Loai nvarchar(10), @TrangThai nvarchar(20), @Suc int, @HienTai int, @PhongHienTai nvarchar(50);
        SELECT @Loai = LoaiPhong, @TrangThai = TrangThaiPhong, @Suc = SucChuaToiDa, @HienTai = SoSinhVienHienTai
        FROM dbo.Phong WHERE TenPhong = @TenPhong;
        SELECT @PhongHienTai = TenPhong FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;

        IF @Loai IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.Phong WHERE TenPhong = @TenPhong)
            THROW 50044, N''Phòng không tồn tại!'', 1;
        IF @GioiTinh <> @Loai
            THROW 50045, N''Sai giới tính phòng!'', 1;
        IF @TrangThai IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 50046, N''Phòng không khả dụng!'', 1;
        IF ISNULL(@PhongHienTai, N'''') <> @TenPhong AND @HienTai >= @Suc
            THROW 50047, N''Phòng đã đầy!'', 1;

        DECLARE @Ma nvarchar(20) = NULLIF(LTRIM(RTRIM(@MaHopDong)), '''');
        IF @Ma IS NULL
            SET @Ma = N''HD'' + RIGHT(N''00000'' + CAST(NEXT VALUE FOR dbo.Seq_MaHopDong AS varchar(10)), 5);

        IF EXISTS (SELECT 1 FROM dbo.HopDong WHERE MaHopDong = @Ma)
            THROW 50048, N''Mã hợp đồng đã tồn tại.'', 1;

        INSERT INTO dbo.HopDong (
            MaHopDong, MaSinhVien, TenPhong, NgayBatDau, NgayKetThuc,
            TrangThaiHopDong, NgayTao, GhiChu
        )
        VALUES (
            @Ma, @MaSinhVien, @TenPhong, @NgayBatDau, @NgayKetThuc,
            N''Còn hiệu lực'', CAST(GETDATE() AS date), @GhiChu
        );

        UPDATE dbo.SinhVien
        SET TenPhong = @TenPhong,
            TrangThaiSinhVien = N''Đang ở'',
            NgayRoiKTX = NULL
        WHERE MaSinhVien = @MaSinhVien;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        VALUES (@Ma, @MaSinhVien, @HoTen, @TenPhong, @NgayBatDau, @NgayKetThuc, N''Còn hiệu lực'', N''Tạo mới'');

        COMMIT TRANSACTION;
        SELECT @Ma AS MaHopDong;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThanhToan
    @MaHoaDon NVARCHAR(20),
    @PhuongThuc NVARCHAR(30) = NULL,
    @GhiChu NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.HoaDon
    SET TrangThaiThanhToan = N''Đã thanh toán'',
        NgayThanhToan = ISNULL(NgayThanhToan, GETDATE()),
        PhuongThucThanhToan = COALESCE(@PhuongThuc, PhuongThucThanhToan),
        GhiChuThanhToan = COALESCE(@GhiChu, GhiChuThanhToan)
    WHERE MaHoaDon = @MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KetThucHopDong
    @MaHopDong NVARCHAR(20),
    @NgayKetThucThucTe DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaSV nvarchar(30), @TenPhong nvarchar(50), @HoTen nvarchar(100),
                @NgayBD date, @NgayKT date, @NgayThucTe date;
        SET @NgayThucTe = ISNULL(@NgayKetThucThucTe, CAST(GETDATE() AS date));

        SELECT @MaSV = hd.MaSinhVien, @TenPhong = hd.TenPhong,
               @NgayBD = hd.NgayBatDau, @NgayKT = hd.NgayKetThuc
        FROM dbo.HopDong hd
        WHERE hd.MaHopDong = @MaHopDong
          AND hd.TrangThaiHopDong = N''Còn hiệu lực'';

        IF @MaSV IS NULL
            THROW 50061, N''Không tìm thấy hợp đồng còn hiệu lực.'', 1;

        SELECT @HoTen = HoTen FROM dbo.SinhVien WHERE MaSinhVien = @MaSV;

        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'',
            NgayKetThucThucTe = @NgayThucTe
        WHERE MaHopDong = @MaHopDong;

        INSERT INTO dbo.LichSuHopDong (
            MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac
        )
        VALUES (@MaHopDong, @MaSV, @HoTen, @TenPhong, @NgayBD, @NgayKT, N''Đã kết thúc'', N''Kết thúc'');

        IF NOT EXISTS (
            SELECT 1 FROM dbo.HopDong
            WHERE MaSinhVien = @MaSV AND TrangThaiHopDong = N''Còn hiệu lực''
        )
        BEGIN
            UPDATE dbo.SinhVien
            SET TrangThaiSinhVien = N''Đã rời KTX'',
                TenPhong = NULL,
                NgayRoiKTX = @NgayThucTe
            WHERE MaSinhVien = @MaSV;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_CapNhatHopDong
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Expired TABLE
    (
        RowNo int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        MaHopDong nvarchar(20) NOT NULL,
        NgayKetThuc date NOT NULL
    );

    INSERT INTO @Expired (MaHopDong, NgayKetThuc)
    SELECT MaHopDong, NgayKetThuc
    FROM dbo.HopDong
    WHERE TrangThaiHopDong = N''Còn hiệu lực''
      AND NgayKetThuc < CAST(GETDATE() AS date);

    DECLARE @RowNo int = 1,
            @Total int = (SELECT COUNT(*) FROM @Expired),
            @Ended int = 0,
            @Errors int = 0,
            @MaHopDong nvarchar(20),
            @NgayKetThuc date;

    WHILE @RowNo <= @Total
    BEGIN
        SELECT @MaHopDong = MaHopDong, @NgayKetThuc = NgayKetThuc
        FROM @Expired
        WHERE RowNo = @RowNo;

        BEGIN TRY
            EXEC dbo.sp_KetThucHopDong
                @MaHopDong = @MaHopDong,
                @NgayKetThucThucTe = @NgayKetThuc;
            SET @Ended += 1;
        END TRY
        BEGIN CATCH
            SET @Errors += 1;
        END CATCH;

        SET @RowNo += 1;
    END;

    SELECT @Ended AS SoHopDongDaKetThuc, @Errors AS SoLoi;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_UpdateTrangThaiHopDong
ON dbo.HopDong
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Lifecycle, history, student departure, and room occupancy are handled by sp_KetThucHopDong.
    -- Keep this trigger as a no-op so it cannot preempt the procedure during contract expiry.
    RETURN;
END;
';

        IF OBJECT_ID(N'dbo.vw_LichSuHopDongFE', N'V') IS NOT NULL
            EXEC sys.sp_executesql N'DROP VIEW dbo.vw_LichSuHopDongFE;';

        DECLARE @MaLSColumnId int = COLUMNPROPERTY(OBJECT_ID(N'dbo.LichSuHopDong'), N'MaLS', N'ColumnId');
        IF @MaLSColumnId IS NOT NULL
        BEGIN
            IF EXISTS (
                SELECT 1 FROM sys.index_columns
                WHERE object_id = OBJECT_ID(N'dbo.LichSuHopDong')
                  AND column_id = @MaLSColumnId
            )
                THROW 50162, N'MaLS đang được index; cần gỡ dependency trước migration 010.', 1;

            IF EXISTS (
                SELECT 1 FROM sys.foreign_key_columns
                WHERE (parent_object_id = OBJECT_ID(N'dbo.LichSuHopDong') AND parent_column_id = @MaLSColumnId)
                   OR (referenced_object_id = OBJECT_ID(N'dbo.LichSuHopDong') AND referenced_column_id = @MaLSColumnId)
            )
                THROW 50163, N'MaLS đang được foreign key tham chiếu; cần gỡ dependency trước migration 010.', 1;

            IF EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE parent_object_id = OBJECT_ID(N'dbo.LichSuHopDong')
                  AND definition LIKE N'%MaLS%'
            )
                THROW 50164, N'MaLS đang được CHECK constraint tham chiếu; cần gỡ dependency trước migration 010.', 1;

            IF EXISTS (
                SELECT 1 FROM sys.sql_expression_dependencies
                WHERE referenced_id = OBJECT_ID(N'dbo.LichSuHopDong')
                  AND referenced_minor_id = @MaLSColumnId
            )
                THROW 50165, N'MaLS còn dependency ngoài vw_LichSuHopDongFE; cần gỡ dependency trước migration 010.', 1;

            EXEC sys.sp_executesql N'ALTER TABLE dbo.LichSuHopDong DROP COLUMN MaLS;';
        END;

        EXEC sys.sp_executesql N'
ALTER TABLE dbo.LichSuHopDong
ADD MaLS AS (
    CASE
        WHEN MaLichSu < 1000
            THEN N''LS'' + RIGHT(N''000'' + CAST(MaLichSu AS varchar(10)), 3)
        ELSE N''LS'' + CAST(MaLichSu AS varchar(10))
    END
) PERSISTED;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_LichSuHopDongFE
AS
SELECT MaLS, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc,
       TrangThaiHopDong, ThaoTac, ThoiGian AS ThoiDiem
FROM dbo.LichSuHopDong;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
SELECT
    sv.MaSinhVien,
    sv.HoTen,
    sv.TenPhong,
    SUM(v.ConNo) AS TongCongNo,
    SUM(CASE
        WHEN v.ConNo > 0 AND v.HanThanhToan < CAST(GETDATE() AS date) THEN v.ConNo
        ELSE 0
    END) AS CongNoQuaHan,
    COUNT(*) AS SoHoaDon
FROM dbo.vw_HoaDonTongHop v
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = v.MaSinhVien
GROUP BY sv.MaSinhVien, sv.HoTen, sv.TenPhong;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'010', N'010_fixes.sql');

        COMMIT TRANSACTION;
        PRINT N'[010] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/*
ROLLBACK 010: restore the pre-010 procedure, trigger, view, and MaLS definition
from backup. Do not drop this migration row or recompute MaLS manually on a live DB.
*/
-- END INLINE: db/migrations/010_fixes.sql
GO
PRINT N'=== Hết run_all (master seed chạy riêng: db/seed/run_master.sql) ==='
GO

PRINT N'=== Inlined master seed ==='
GO
:on error exit
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Chạy từ thư mục gốc repo trên DB đã chạy migrations 001-009.
-- BEGIN INLINE: db/seed/master/001_phong.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.Phong', N'U') IS NULL OR COL_LENGTH(N'dbo.Phong', N'GiaPhong') IS NULL
    THROW 50140, N'Chạy migrations 001-009 trước khi seed master.', 1;

MERGE dbo.Phong AS target
USING (VALUES
    (N'A101', N'Nam', 6, N'Không có', N'A', N'Trống'),
    (N'A102', N'Nam', 8, N'1', N'A', N'Trống'),
    (N'A103', N'Nam', 4, N'-', N'A', N'Đầy'),
    (N'A104', N'Nam', 6, N'Không có', N'A', N'Trống'),
    (N'A105', N'Nam', 8, N'1', N'A', N'Trống'),
    (N'A201', N'Nữ', 4, N'2', N'A', N'Trống'),
    (N'A202', N'Nữ', 8, N'2', N'A', N'Trống'),
    (N'A203', N'Nữ', 6, N'2', N'A', N'Trống'),
    (N'A204', N'Nữ', 6, N'Phòng tầng 2', N'A', N'Đầy'),
    (N'A205', N'Nữ', 8, N'Phòng tầng 2', N'A', N'Trống'),
    (N'A301', N'Nam', 6, N'3', N'A', N'Trống'),
    (N'A302', N'Nam', 8, N'Phòng tầng 3', N'A', N'Trống'),
    (N'A303', N'Nam', 4, N'Phòng tầng 3', N'A', N'Trống'),
    (N'A304', N'Nam', 6, N'Phòng tầng 3', N'A', N'Trống'),
    (N'A305', N'Nam', 8, N'Phòng tầng 3', N'A', N'Trống'),
    (N'A401', N'Nữ', 6, N'Phòng tầng 4', N'A', N'Trống'),
    (N'A402', N'Nữ', 8, N'Phòng tầng 4', N'A', N'Trống'),
    (N'A403', N'Nữ', 8, N'Phòng tầng 4', N'A', N'Trống'),
    (N'A404', N'Nữ', 6, N'Phòng tầng 4', N'A', N'Trống'),
    (N'A405', N'Nữ', 8, N'Phòng tầng 4', N'A', N'Trống'),
    (N'A501', N'Nam', 6, N'Phòng tầng 5', N'A', N'Trống'),
    (N'A502', N'Nam', 8, N'Phòng tầng 5', N'A', N'Trống'),
    (N'A503', N'Nam', 6, N'Phòng tầng 5', N'A', N'Trống'),
    (N'A504', N'Nam', 6, N'Phòng tầng 5', N'A', N'Trống'),
    (N'A505', N'Nam', 8, N'Phòng tầng 5', N'A', N'Trống'),
    (N'A601', N'Nữ', 6, N'Phòng tầng 6', N'A', N'Trống'),
    (N'A602', N'Nữ', 8, N'Phòng tầng 6', N'A', N'Trống'),
    (N'A603', N'Nữ', 4, N'Phòng tầng 6', N'A', N'Trống'),
    (N'A604', N'Nữ', 6, N'Phòng tầng 6', N'A', N'Trống'),
    (N'A605', N'Nữ', 8, N'Phòng tầng 6', N'A', N'Trống'),
    (N'A701', N'Nam', 6, N'Phòng tầng 7', N'A', N'Trống'),
    (N'A702', N'Nam', 8, N'Phòng tầng 7', N'A', N'Đầy'),
    (N'A703', N'Nam', 4, N'Phòng tầng 7', N'A', N'Đầy'),
    (N'A704', N'Nam', 8, N'Phòng tầng 7', N'A', N'Đầy'),
    (N'A705', N'Nam', 8, N'Phòng tầng 7', N'A', N'Trống'),
    (N'A801', N'Nữ', 6, N'Phòng tầng 8', N'A', N'Đầy'),
    (N'A802', N'Nữ', 8, N'Phòng tầng 8', N'A', N'Trống'),
    (N'A803', N'Nữ', 4, N'Phòng tầng 8', N'A', N'Trống'),
    (N'A804', N'Nữ', 8, N'Phòng tầng 8', N'A', N'Trống'),
    (N'A805', N'Nữ', 8, N'Phòng tầng 8', N'A', N'Trống'),
    (N'A901', N'Nam', 6, N'Phòng tầng 9', N'A', N'Trống'),
    (N'A902', N'Nam', 8, N'Phòng tầng 9', N'A', N'Trống'),
    (N'A903', N'Nam', 4, N'Phòng tầng 9', N'A', N'Trống'),
    (N'A904', N'Nam', 6, N'Phòng tầng 9', N'A', N'Trống'),
    (N'A905', N'Nam', 8, N'Phòng tầng 9', N'A', N'Trống'),
    (N'B101', N'Nam', 6, N'Phòng tầng 1', N'B', N'Đầy'),
    (N'B102', N'Nam', 8, N'Phòng tầng 1', N'B', N'Trống'),
    (N'B103', N'Nam', 4, N'Phòng tầng 1', N'B', N'Trống'),
    (N'B104', N'Nam', 6, N'Phòng tầng 1', N'B', N'Trống'),
    (N'B105', N'Nam', 8, N'Phòng tầng 1', N'B', N'Đầy'),
    (N'B201', N'Nữ', 6, N'Phòng tầng 2', N'B', N'Trống'),
    (N'B202', N'Nữ', 8, N'Phòng tầng 2', N'B', N'Trống'),
    (N'B203', N'Nữ', 8, N'Phòng tầng 2', N'B', N'Trống'),
    (N'B204', N'Nữ', 8, N'Phòng tầng 2', N'B', N'Đầy'),
    (N'B205', N'Nữ', 8, N'Phòng tầng 2', N'B', N'Trống'),
    (N'B301', N'Nam', 6, N'Phòng tầng 3', N'B', N'Trống'),
    (N'B302', N'Nam', 8, N'Phòng tầng 3', N'B', N'Trống'),
    (N'B303', N'Nam', 4, N'Phòng tầng 3', N'B', N'Trống'),
    (N'B304', N'Nam', 6, N'Phòng tầng 3', N'B', N'Trống'),
    (N'B305', N'Nam', 8, N'Phòng tầng 3', N'B', N'Trống'),
    (N'B401', N'Nữ', 6, N'Phòng tầng 4', N'B', N'Trống'),
    (N'B402', N'Nữ', 8, N'Phòng tầng 4', N'B', N'Trống'),
    (N'B403', N'Nữ', 4, N'Phòng tầng 4', N'B', N'Trống'),
    (N'B404', N'Nữ', 6, N'Phòng tầng 4', N'B', N'Trống'),
    (N'B405', N'Nữ', 8, N'Phòng tầng 4', N'B', N'Trống'),
    (N'B501', N'Nam', 6, N'Phòng tầng 5', N'B', N'Trống'),
    (N'B502', N'Nam', 8, N'Phòng tầng 5', N'B', N'Trống'),
    (N'B503', N'Nam', 4, N'Phòng tầng 5', N'B', N'Đầy'),
    (N'B504', N'Nam', 6, N'Phòng tầng 5', N'B', N'Trống'),
    (N'B505', N'Nam', 8, N'Phòng tầng 5', N'B', N'Trống'),
    (N'B601', N'Nữ', 6, N'Phòng tầng 6', N'B', N'Đầy'),
    (N'B602', N'Nữ', 8, N'Phòng tầng 6', N'B', N'Trống'),
    (N'B603', N'Nữ', 6, N'Phòng tầng 6', N'B', N'Trống'),
    (N'B604', N'Nữ', 6, N'Phòng tầng 6', N'B', N'Trống'),
    (N'B605', N'Nữ', 8, N'Phòng tầng 6', N'B', N'Trống'),
    (N'B701', N'Nam', 8, N'Phòng tầng 7', N'B', N'Đầy'),
    (N'B702', N'Nam', 8, N'Phòng tầng 7', N'B', N'Trống'),
    (N'B703', N'Nam', 8, N'Phòng tầng 7', N'B', N'Trống'),
    (N'B704', N'Nam', 6, N'Phòng tầng 7', N'B', N'Trống'),
    (N'B705', N'Nam', 8, N'Phòng tầng 7', N'B', N'Trống'),
    (N'B801', N'Nữ', 6, N'Phòng tầng 8', N'B', N'Trống'),
    (N'B802', N'Nữ', 8, N'Phòng tầng 8', N'B', N'Trống'),
    (N'B803', N'Nữ', 4, N'Phòng tầng 8', N'B', N'Trống'),
    (N'B804', N'Nữ', 6, N'Phòng tầng 8', N'B', N'Trống'),
    (N'B805', N'Nữ', 8, N'Phòng tầng 8', N'B', N'Trống'),
    (N'B901', N'Nam', 8, N'Phòng tầng 9', N'B', N'Đầy'),
    (N'B902', N'Nam', 8, N'Phòng tầng 9', N'B', N'Trống'),
    (N'B903', N'Nam', 4, N'Phòng tầng 9', N'B', N'Trống'),
    (N'B904', N'Nam', 6, N'Phòng tầng 9', N'B', N'Trống'),
    (N'B905', N'Nam', 8, N'Phòng tầng 9', N'B', N'Trống'),
    (N'C101', N'Nam', 8, N'Phòng tầng 1', N'C', N'Trống'),
    (N'C102', N'Nam', 8, N'Phòng tầng 1', N'C', N'Trống'),
    (N'C103', N'Nam', 4, N'Phòng tầng 1', N'C', N'Trống'),
    (N'C104', N'Nam', 6, N'Phòng tầng 1', N'C', N'Trống'),
    (N'C105', N'Nam', 8, N'Phòng tầng 1', N'C', N'Trống'),
    (N'C201', N'Nữ', 6, N'Phòng tầng 2', N'C', N'Trống'),
    (N'C202', N'Nữ', 8, N'Phòng tầng 2', N'C', N'Trống'),
    (N'C203', N'Nữ', 4, N'Phòng tầng 2', N'C', N'Đầy'),
    (N'C204', N'Nữ', 6, N'Phòng tầng 2', N'C', N'Trống'),
    (N'C205', N'Nữ', 8, N'Phòng tầng 2', N'C', N'Trống'),
    (N'C301', N'Nam', 6, N'Phòng tầng 3', N'C', N'Trống'),
    (N'C302', N'Nam', 8, N'Phòng tầng 3', N'C', N'Trống'),
    (N'C303', N'Nam', 6, N'Phòng tầng 3', N'C', N'Đầy'),
    (N'C304', N'Nam', 6, N'Phòng tầng 3', N'C', N'Trống'),
    (N'C305', N'Nam', 8, N'Phòng tầng 3', N'C', N'Trống'),
    (N'C401', N'Nữ', 8, N'Phòng tầng 4', N'C', N'Trống'),
    (N'C402', N'Nữ', 8, N'Phòng tầng 4', N'C', N'Trống'),
    (N'C403', N'Nữ', 8, N'Phòng tầng 4', N'C', N'Đầy'),
    (N'C404', N'Nữ', 6, N'Phòng tầng 4', N'C', N'Trống'),
    (N'C405', N'Nữ', 8, N'Phòng tầng 4', N'C', N'Trống'),
    (N'C501', N'Nam', 6, N'Phòng tầng 5', N'C', N'Đầy'),
    (N'C502', N'Nam', 8, N'Phòng tầng 5', N'C', N'Trống'),
    (N'C503', N'Nam', 4, N'Phòng tầng 5', N'C', N'Trống'),
    (N'C504', N'Nam', 6, N'Phòng tầng 5', N'C', N'Trống'),
    (N'C505', N'Nam', 8, N'Phòng tầng 5', N'C', N'Trống'),
    (N'C601', N'Nữ', 6, N'Phòng tầng 6', N'C', N'Trống'),
    (N'C602', N'Nữ', 8, N'Phòng tầng 6', N'C', N'Trống'),
    (N'C603', N'Nữ', 4, N'Phòng tầng 6', N'C', N'Trống'),
    (N'C604', N'Nữ', 8, N'Phòng tầng 6', N'C', N'Đầy'),
    (N'C605', N'Nữ', 8, N'Phòng tầng 6', N'C', N'Trống'),
    (N'C701', N'Nam', 6, N'Phòng tầng 7', N'C', N'Trống'),
    (N'C702', N'Nam', 8, N'Phòng tầng 7', N'C', N'Trống'),
    (N'C703', N'Nam', 4, N'7', N'C', N'Trống'),
    (N'C704', N'Nam', 6, N'Phòng tầng 7', N'C', N'Trống'),
    (N'C705', N'Nam', 8, N'Phòng tầng 7', N'C', N'Trống'),
    (N'C801', N'Nữ', 6, N'Phòng tầng 8', N'C', N'Đầy'),
    (N'C802', N'Nữ', 8, N'Phòng tầng 8', N'C', N'Trống'),
    (N'C803', N'Nữ', 4, N'Phòng tầng 8', N'C', N'Trống'),
    (N'C804', N'Nữ', 6, N'Phòng tầng 8', N'C', N'Trống'),
    (N'C805', N'Nữ', 8, N'Phòng tầng 8', N'C', N'Trống'),
    (N'C901', N'Nam', 6, N'Phòng tầng 9', N'C', N'Trống'),
    (N'C902', N'Nam', 8, N'Phòng tầng 9', N'C', N'Trống'),
    (N'C903', N'Nam', 4, N'Phòng tầng 9', N'C', N'Trống'),
    (N'C904', N'Nam', 6, N'Phòng tầng 9', N'C', N'Trống'),
    (N'C905', N'Nam', 8, N'Phòng tầng 9', N'C', N'Trống'),
    (N'D101', N'Nam', 4, N'Phòng mới tạo', N'A', N'Ngưng sử dụng'),
    (N'D102', N'Nam', 4, N'New', N'B', N'Ngưng sử dụng')
) AS source (TenPhong, LoaiPhong, SucChuaToiDa, GhiChu, Khu, TrangThaiGoc)
ON target.TenPhong = source.TenPhong
WHEN MATCHED THEN
    UPDATE SET LoaiPhong = source.LoaiPhong,
               SucChuaToiDa = source.SucChuaToiDa,
               SoSinhVienHienTai = 0,
               TrangThaiPhong = CASE WHEN source.TrangThaiGoc IN (N'Ngưng sử dụng', N'Bảo trì')
                                    THEN source.TrangThaiGoc ELSE N'Trống' END,
               GhiChu = source.GhiChu,
               Khu = source.Khu,
               GiaPhong = CASE source.SucChuaToiDa
                   WHEN 4 THEN CONVERT(decimal(18,2), 1200000)
                   WHEN 6 THEN CONVERT(decimal(18,2), 800000)
                   WHEN 8 THEN CONVERT(decimal(18,2), 500000)
                   ELSE CONVERT(decimal(18,2), 0)
               END
WHEN NOT MATCHED THEN
    INSERT (TenPhong, LoaiPhong, SucChuaToiDa, SoSinhVienHienTai, TrangThaiPhong, GhiChu, Khu, GiaPhong)
    VALUES (source.TenPhong, source.LoaiPhong, source.SucChuaToiDa, 0,
            CASE WHEN source.TrangThaiGoc IN (N'Ngưng sử dụng', N'Bảo trì')
                 THEN source.TrangThaiGoc ELSE N'Trống' END,
            source.GhiChu, source.Khu,
            CASE source.SucChuaToiDa
                WHEN 4 THEN CONVERT(decimal(18,2), 1200000)
                WHEN 6 THEN CONVERT(decimal(18,2), 800000)
                WHEN 8 THEN CONVERT(decimal(18,2), 500000)
                ELSE CONVERT(decimal(18,2), 0)
            END);
GO
-- END INLINE: db/seed/master/001_phong.sql
GO
-- BEGIN INLINE: db/seed/master/002_cauhinh.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.CauHinhHeThong', N'U') IS NULL
    THROW 50120, N'Chạy migrations 001-009 trước khi seed master.', 1;

MERGE dbo.CauHinhHeThong AS target
USING (VALUES
    (N'DON_GIA_DIEN', N'3500', N'Đơn giá điện (VND / chỉ số)'),
    (N'DON_GIA_NUOC', N'15000', N'Đơn giá nước (VND / chỉ số)'),
    (N'SO_NGAY_HAN_THANH_TOAN', N'15', N'Số ngày cộng vào NgayLap để ra hạn thanh toán'),
    (N'NGUONG_CANH_BAO_HET_HAN_ADMIN', N'7', N'Số ngày còn lại để cảnh báo admin'),
    (N'NGUONG_CANH_BAO_HET_HAN_SV', N'30', N'Số ngày còn lại để cảnh báo sinh viên'),
    (N'THOI_GIAN_HET_HAN_QR_PHUT', N'15', N'Thời gian hết hạn giao dịch ONLINE PENDING (phút)')
) AS source (Khoa, GiaTri, MoTa)
ON target.Khoa = source.Khoa
WHEN MATCHED THEN
    UPDATE SET GiaTri = source.GiaTri, MoTa = source.MoTa
WHEN NOT MATCHED THEN
    INSERT (Khoa, GiaTri, MoTa) VALUES (source.Khoa, source.GiaTri, source.MoTa);
GO
-- END INLINE: db/seed/master/002_cauhinh.sql
GO
-- BEGIN INLINE: db/seed/master/003_taikhoan_admin.sql
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
-- END INLINE: db/seed/master/003_taikhoan_admin.sql
GO
IF SUSER_ID(N'DNKTX') IS NULL
    THROW 50150, N'DNKTX server login must exist before this build script runs.', 1;
IF DATABASE_PRINCIPAL_ID(N'DNKTX') IS NULL
    CREATE USER [DNKTX] FOR LOGIN [DNKTX];
IF NOT EXISTS (SELECT 1 FROM sys.database_role_members drm INNER JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id INNER JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id WHERE r.name = N'db_datareader' AND m.name = N'DNKTX')
    ALTER ROLE [db_datareader] ADD MEMBER [DNKTX];
IF NOT EXISTS (SELECT 1 FROM sys.database_role_members drm INNER JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id INNER JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id WHERE r.name = N'db_datawriter' AND m.name = N'DNKTX')
    ALTER ROLE [db_datawriter] ADD MEMBER [DNKTX];
GRANT EXECUTE TO [DNKTX];
GO
PRINT N'KTX_Group3 schema, migrations 001-010, master data, and DNKTX permissions are ready.'
GO
