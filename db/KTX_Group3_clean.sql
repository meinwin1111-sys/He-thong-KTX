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

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
        BEGIN
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT MaSinhVien FROM dbo.HopDong
                    WHERE TrangThaiHopDong = N''Còn hiệu lực''
                    GROUP BY MaSinhVien HAVING COUNT(*) > 1
                )
                    PRINT N''[002] CẢNH BÁO: Có sinh viên nhiều hợp đồng còn hiệu lực — không tạo UQ_HopDong_MotHieuLuc. Chạy db/optional/hopdong_unique.sql sau khi dọn dữ liệu.'';
                ELSE IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes WHERE name = N''UQ_HopDong_MotHieuLuc'' AND object_id = OBJECT_ID(N''dbo.HopDong'')
                )
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

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_LichSuHopDong_MaHopDong'' AND object_id = OBJECT_ID(N''dbo.LichSuHopDong''))
                    CREATE NONCLUSTERED INDEX IX_LichSuHopDong_MaHopDong ON dbo.LichSuHopDong (MaHopDong);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_LichSuHopDong_ThoiGian'' AND object_id = OBJECT_ID(N''dbo.LichSuHopDong''))
                    CREATE NONCLUSTERED INDEX IX_LichSuHopDong_ThoiGian ON dbo.LichSuHopDong (ThoiGian);
            ';

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
        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_HopDong_MaSV_TrangThai'' AND object_id = OBJECT_ID(N''dbo.HopDong''))
                    CREATE NONCLUSTERED INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong (MaSinhVien, TrangThaiHopDong);
            ';
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

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
           AND COL_LENGTH(N'dbo.LichSuHopDong', N'MaLS') IS NULL
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.LichSuHopDong
                ADD MaLS AS (N''LS'' + RIGHT(N''000'' + CAST(MaLichSu AS varchar(10)), 3)) PERSISTED;
            ';

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
        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.HopDong'') AND name = N''IX_HopDong_MaSV_TrangThai'')
                    CREATE NONCLUSTERED INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong (MaSinhVien, TrangThaiHopDong);
            ';
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
PRINT N'=== Migration 011 ==='
GO
-- BEGIN INLINE: db/migrations/011_student_registration_approval.sql
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
-- END INLINE: db/migrations/011_student_registration_approval.sql
GO
PRINT N'=== Migration 012 ==='
GO
-- BEGIN INLINE: db/migrations/012_align_student_request_type_check.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 50180, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'011')
    THROW 50181, N'Chạy migration 011 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'012')
    PRINT N'[012] Đã chạy trước đó — bỏ qua.';
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
        VALUES (N'012', N'012_align_student_request_type_check.sql');

        COMMIT TRANSACTION;
        PRINT N'[012] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
-- END INLINE: db/migrations/012_align_student_request_type_check.sql
GO
PRINT N'=== Migration 013 ==='
GO
-- BEGIN INLINE: db/migrations/013_room_classes_services.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51300, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'012')
    THROW 51301, N'Chạy migration 012 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'013')
    PRINT N'[013] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.Phong', N'U') IS NULL
           OR OBJECT_ID(N'dbo.HopDong', N'U') IS NULL
           OR OBJECT_ID(N'dbo.CauHinhHeThong', N'U') IS NULL
            THROW 51302, N'Thiếu bảng Phong, HopDong hoặc CauHinhHeThong.', 1;

        IF OBJECT_ID(N'dbo.HangPhong', N'U') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE TABLE dbo.HangPhong
                (
                    MaHangPhong nvarchar(20) NOT NULL CONSTRAINT PK_HangPhong PRIMARY KEY,
                    TenHangPhong nvarchar(100) NOT NULL CONSTRAINT UQ_HangPhong_Ten UNIQUE,
                    SucChuaToiDa int NOT NULL,
                    GiaPhongThang decimal(18,2) NOT NULL,
                    GiaPhongNam decimal(18,2) NOT NULL,
                    CONSTRAINT CK_HangPhong_SucChua CHECK (SucChuaToiDa > 0),
                    CONSTRAINT CK_HangPhong_Gia CHECK (GiaPhongThang >= 0 AND GiaPhongNam >= 0),
                    CONSTRAINT UQ_HangPhong_MaHang_SucChua UNIQUE (MaHangPhong, SucChuaToiDa)
                );';
        END;

        IF OBJECT_ID(N'dbo.DichVu', N'U') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE TABLE dbo.DichVu
                (
                    MaDichVu nvarchar(20) NOT NULL CONSTRAINT PK_DichVu PRIMARY KEY,
                    TenDichVu nvarchar(100) NOT NULL CONSTRAINT UQ_DichVu_Ten UNIQUE,
                    DonVi nvarchar(20) NOT NULL,
                    HoatDong bit NOT NULL CONSTRAINT DF_DichVu_HoatDong DEFAULT (1)
                );';
        END;

        IF OBJECT_ID(N'dbo.HangPhong_DichVu', N'U') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE TABLE dbo.HangPhong_DichVu
                (
                    MaHangPhong nvarchar(20) NOT NULL,
                    MaDichVu nvarchar(20) NOT NULL,
                    DonGia decimal(18,2) NOT NULL,
                    CachTinh nvarchar(20) NOT NULL,
                    DoiTuongThanhToan nvarchar(10) NOT NULL,
                    HoatDong bit NOT NULL CONSTRAINT DF_HangPhong_DichVu_HoatDong DEFAULT (1),
                    CONSTRAINT PK_HangPhong_DichVu PRIMARY KEY (MaHangPhong, MaDichVu),
                    CONSTRAINT FK_HPDV_HangPhong FOREIGN KEY (MaHangPhong) REFERENCES dbo.HangPhong (MaHangPhong),
                    CONSTRAINT FK_HPDV_DichVu FOREIGN KEY (MaDichVu) REFERENCES dbo.DichVu (MaDichVu),
                    CONSTRAINT CK_HPDV_DonGia CHECK (DonGia >= 0),
                    CONSTRAINT CK_HPDV_CachTinh CHECK (CachTinh IN (N''CHI_SO'', N''CO_DINH_KY'')),
                    CONSTRAINT CK_HPDV_DoiTuong CHECK (DoiTuongThanhToan IN (N''PHONG'', N''CA_NHAN''))
                );';
        END;

        IF COL_LENGTH(N'dbo.DichVu', N'DonVi') IS NULL
            ALTER TABLE dbo.DichVu ADD DonVi nvarchar(20) NULL;
        IF COL_LENGTH(N'dbo.DichVu', N'HoatDong') IS NULL
            ALTER TABLE dbo.DichVu ADD HoatDong bit NOT NULL
                CONSTRAINT DF_DichVu_HoatDong DEFAULT (1) WITH VALUES;
        IF COL_LENGTH(N'dbo.HangPhong_DichVu', N'HoatDong') IS NULL
            ALTER TABLE dbo.HangPhong_DichVu ADD HoatDong bit NOT NULL
                CONSTRAINT DF_HangPhong_DichVu_HoatDong DEFAULT (1) WITH VALUES;

        EXEC sys.sp_executesql N'
        MERGE dbo.HangPhong WITH (HOLDLOCK) AS target
        USING (VALUES
            (N''HP4'', N''Phòng 4 người'', 4, CONVERT(decimal(18,2), 1200000)),
            (N''HP6'', N''Phòng 6 người'', 6, CONVERT(decimal(18,2), 800000)),
            (N''HP8'', N''Phòng 8 người'', 8, CONVERT(decimal(18,2), 500000))
        ) AS source (MaHangPhong, TenHangPhong, SucChuaToiDa, GiaPhongThang)
            ON target.MaHangPhong = source.MaHangPhong
        WHEN MATCHED THEN UPDATE SET
            TenHangPhong = source.TenHangPhong,
            SucChuaToiDa = source.SucChuaToiDa,
            GiaPhongThang = source.GiaPhongThang,
            GiaPhongNam = source.GiaPhongThang * 12
        WHEN NOT MATCHED THEN INSERT
            (MaHangPhong, TenHangPhong, SucChuaToiDa, GiaPhongThang, GiaPhongNam)
        VALUES
            (source.MaHangPhong, source.TenHangPhong, source.SucChuaToiDa,
             source.GiaPhongThang, source.GiaPhongThang * 12);';

        DECLARE @DonGiaDien decimal(18,2),
                @DonGiaNuoc decimal(18,2),
                @DonGiaWifi decimal(18,2),
                @DonGiaVeSinh decimal(18,2),
                @DonGiaGiuXe decimal(18,2);

        SELECT @DonGiaDien = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_DIEN';
        SELECT @DonGiaNuoc = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_NUOC';
        IF @DonGiaDien IS NULL OR @DonGiaDien < 0 OR @DonGiaNuoc IS NULL OR @DonGiaNuoc < 0
            THROW 51303, N'CauHinhHeThong thiếu hoặc sai đơn giá điện/nước; không thể seed dịch vụ.', 1;

        SELECT @DonGiaWifi = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_WIFI';
        SELECT @DonGiaVeSinh = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_VE_SINH';
        SELECT @DonGiaGiuXe = TRY_CONVERT(decimal(18,2), GiaTri)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'DON_GIA_GIU_XE';

        IF EXISTS (
            SELECT 1
            FROM dbo.CauHinhHeThong
            WHERE Khoa IN (N'DON_GIA_WIFI', N'DON_GIA_VE_SINH', N'DON_GIA_GIU_XE')
              AND (TRY_CONVERT(decimal(18,2), GiaTri) IS NULL OR TRY_CONVERT(decimal(18,2), GiaTri) < 0)
        )
            THROW 51304, N'Đơn giá wifi/vệ sinh/giữ xe trong CauHinhHeThong không hợp lệ.', 1;

        EXEC sys.sp_executesql N'
        MERGE dbo.DichVu WITH (HOLDLOCK) AS target
        USING (VALUES
            (N''DIEN'', N''Điện'', N''kWh'', CONVERT(bit, 1)),
            (N''NUOC'', N''Nước'', N''m3'', CONVERT(bit, 1)),
            (N''WIFI'', N''Wifi'', N''tháng'', CONVERT(bit, CASE WHEN @DonGiaWifi IS NULL THEN 0 ELSE 1 END)),
            (N''VE_SINH'', N''Vệ sinh'', N''tháng'', CONVERT(bit, CASE WHEN @DonGiaVeSinh IS NULL THEN 0 ELSE 1 END)),
            (N''GIU_XE'', N''Giữ xe'', N''xe/tháng'', CONVERT(bit, CASE WHEN @DonGiaGiuXe IS NULL THEN 0 ELSE 1 END))
        ) AS source (MaDichVu, TenDichVu, DonVi, HoatDong)
            ON target.MaDichVu = source.MaDichVu
        WHEN MATCHED THEN UPDATE SET
            TenDichVu = source.TenDichVu,
            DonVi = source.DonVi,
            HoatDong = source.HoatDong
        WHEN NOT MATCHED THEN INSERT (MaDichVu, TenDichVu, DonVi, HoatDong)
        VALUES (source.MaDichVu, source.TenDichVu, source.DonVi, source.HoatDong);',
            N'@DonGiaWifi decimal(18,2), @DonGiaVeSinh decimal(18,2), @DonGiaGiuXe decimal(18,2)',
            @DonGiaWifi = @DonGiaWifi, @DonGiaVeSinh = @DonGiaVeSinh, @DonGiaGiuXe = @DonGiaGiuXe;

        EXEC sys.sp_executesql N'
            UPDATE dbo.DichVu SET DonVi = N''khác'' WHERE DonVi IS NULL;
            ALTER TABLE dbo.DichVu ALTER COLUMN DonVi nvarchar(20) NOT NULL;';

        EXEC sys.sp_executesql N'
        MERGE dbo.HangPhong_DichVu WITH (HOLDLOCK) AS target
        USING (
            SELECT hp.MaHangPhong, dv.MaDichVu,
                   CASE dv.MaDichVu
                       WHEN N''DIEN'' THEN @DonGiaDien
                       WHEN N''NUOC'' THEN @DonGiaNuoc
                       WHEN N''WIFI'' THEN COALESCE(@DonGiaWifi, 0)
                       WHEN N''VE_SINH'' THEN COALESCE(@DonGiaVeSinh, 0)
                       WHEN N''GIU_XE'' THEN COALESCE(@DonGiaGiuXe, 0)
                   END AS DonGia,
                   CASE WHEN dv.MaDichVu IN (N''DIEN'', N''NUOC'') THEN N''CHI_SO'' ELSE N''CO_DINH_KY'' END AS CachTinh,
                   N''PHONG'' AS DoiTuongThanhToan,
                   CONVERT(bit, CASE
                       WHEN dv.MaDichVu IN (N''DIEN'', N''NUOC'') THEN 1
                       WHEN dv.MaDichVu = N''WIFI'' THEN CASE WHEN @DonGiaWifi IS NULL THEN 0 ELSE 1 END
                       WHEN dv.MaDichVu = N''VE_SINH'' THEN CASE WHEN @DonGiaVeSinh IS NULL THEN 0 ELSE 1 END
                       WHEN dv.MaDichVu = N''GIU_XE'' THEN CASE WHEN @DonGiaGiuXe IS NULL THEN 0 ELSE 1 END
                       ELSE 0
                   END) AS HoatDong
            FROM dbo.HangPhong hp
            CROSS JOIN dbo.DichVu dv
            WHERE dv.MaDichVu IN (N''DIEN'', N''NUOC'', N''WIFI'', N''VE_SINH'', N''GIU_XE'')
        ) AS source
            ON target.MaHangPhong = source.MaHangPhong AND target.MaDichVu = source.MaDichVu
        WHEN NOT MATCHED THEN INSERT
            (MaHangPhong, MaDichVu, DonGia, CachTinh, DoiTuongThanhToan, HoatDong)
        VALUES
            (source.MaHangPhong, source.MaDichVu, source.DonGia, source.CachTinh,
             source.DoiTuongThanhToan, source.HoatDong);',
            N'@DonGiaDien decimal(18,2), @DonGiaNuoc decimal(18,2), @DonGiaWifi decimal(18,2), @DonGiaVeSinh decimal(18,2), @DonGiaGiuXe decimal(18,2)',
            @DonGiaDien = @DonGiaDien, @DonGiaNuoc = @DonGiaNuoc, @DonGiaWifi = @DonGiaWifi,
            @DonGiaVeSinh = @DonGiaVeSinh, @DonGiaGiuXe = @DonGiaGiuXe;

        IF COL_LENGTH(N'dbo.Phong', N'MaHangPhong') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.Phong ADD MaHangPhong nvarchar(20) NULL;';

        DECLARE @PhongLoi nvarchar(max);
        EXEC sys.sp_executesql N'
        SELECT @PhongLoi = STUFF((
            SELECT N'', '' + QUOTENAME(p.TenPhong) + N'' ('' + CONVERT(nvarchar(12), p.SucChuaToiDa) + N'')''
            FROM dbo.Phong p
            WHERE p.SucChuaToiDa NOT IN (4, 6, 8)
            ORDER BY p.TenPhong
            FOR XML PATH(''''), TYPE
        ).value(''.'', ''nvarchar(max)''), 1, 2, N'''');',
            N'@PhongLoi nvarchar(max) OUTPUT', @PhongLoi = @PhongLoi OUTPUT;
        IF @PhongLoi IS NOT NULL
        BEGIN
            SET @PhongLoi = LEFT(N'Sức chứa không thuộc 4/6/8; cần xử lý phòng: ' + @PhongLoi, 2048);
            THROW 51305, @PhongLoi, 1;
        END;

        EXEC sys.sp_executesql N'
            UPDATE dbo.Phong
            SET MaHangPhong = CASE SucChuaToiDa
                WHEN 4 THEN N''HP4'' WHEN 6 THEN N''HP6'' WHEN 8 THEN N''HP8'' END
            WHERE MaHangPhong IS NULL;
        ';

        DECLARE @PhongHangKhongHopLe bit = 0;
        EXEC sys.sp_executesql N'
        IF EXISTS (
            SELECT 1
            FROM dbo.Phong p
            LEFT JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
            WHERE hp.MaHangPhong IS NULL OR hp.SucChuaToiDa <> p.SucChuaToiDa
        ) SET @KhongHopLe = 1;',
            N'@KhongHopLe bit OUTPUT', @KhongHopLe = @PhongHangKhongHopLe OUTPUT;
        IF @PhongHangKhongHopLe = 1
            THROW 51306, N'Mã hạng phòng hoặc sức chứa không khớp; không thể hoàn tất migration 013.', 1;

        EXEC sys.sp_executesql N'ALTER TABLE dbo.Phong ALTER COLUMN MaHangPhong nvarchar(20) NOT NULL;';
        IF NOT EXISTS (
            SELECT 1 FROM sys.foreign_keys
            WHERE parent_object_id = OBJECT_ID(N'dbo.Phong')
              AND name = N'FK_Phong_Hang_SucChua'
        )
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.Phong WITH CHECK
                ADD CONSTRAINT FK_Phong_Hang_SucChua
                FOREIGN KEY (MaHangPhong, SucChuaToiDa)
                REFERENCES dbo.HangPhong (MaHangPhong, SucChuaToiDa);
            ';

        IF NOT EXISTS (
            SELECT 1 FROM sys.foreign_keys
            WHERE parent_object_id = OBJECT_ID(N'dbo.Phong') AND name = N'FK_Phong_HangPhong'
        )
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.Phong WITH CHECK
                    ADD CONSTRAINT FK_Phong_HangPhong
                    FOREIGN KEY (MaHangPhong) REFERENCES dbo.HangPhong (MaHangPhong);';

        EXEC sys.sp_executesql N'
            IF EXISTS (
                SELECT 1 FROM sys.extended_properties
                WHERE name = N''MS_Description''
                  AND major_id = OBJECT_ID(N''dbo.Phong'')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N''dbo.Phong''), N''GiaPhong'', N''ColumnId'')
            )
                EXEC sys.sp_updateextendedproperty
                    @name=N''MS_Description'',
                    @value=N''Deprecated: legacy compatibility only. New logic reads per-person monthly/yearly prices from HangPhong.'',
                    @level0type=N''SCHEMA'', @level0name=N''dbo'',
                    @level1type=N''TABLE'', @level1name=N''Phong'',
                    @level2type=N''COLUMN'', @level2name=N''GiaPhong'';
            ELSE
                EXEC sys.sp_addextendedproperty
                    @name=N''MS_Description'',
                    @value=N''Deprecated: legacy compatibility only. New logic reads per-person monthly/yearly prices from HangPhong.'',
                    @level0type=N''SCHEMA'', @level0name=N''dbo'',
                    @level1type=N''TABLE'', @level1name=N''Phong'',
                    @level2type=N''COLUMN'', @level2name=N''GiaPhong'';
        ';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_Phong_BaoVeHang
ON dbo.Phong
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(MaHangPhong) AND EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.TenPhong = i.TenPhong
        INNER JOIN dbo.HopDong hd ON hd.TenPhong = i.TenPhong
        WHERE i.MaHangPhong <> d.MaHangPhong
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
    )
        THROW 51307, N''Không thể đổi hạng phòng khi phòng còn hợp đồng hiệu lực.'', 1;
END;
';

        DECLARE @HasUnpricedOptionalServices bit = 0;
        EXEC sys.sp_executesql N'
            IF EXISTS (
                SELECT 1
                FROM dbo.DichVu
                WHERE MaDichVu IN (N''WIFI'', N''VE_SINH'', N''GIU_XE'') AND HoatDong = 0
            ) SET @HasUnpricedOptionalServices = 1;',
            N'@HasUnpricedOptionalServices bit OUTPUT',
            @HasUnpricedOptionalServices = @HasUnpricedOptionalServices OUTPUT;
        IF @HasUnpricedOptionalServices = 1
            PRINT N'[013] CẢNH BÁO: chưa có đơn giá cho các dịch vụ sau; đang để DonGia=0 và HoatDong=0: Wifi, Vệ sinh, Giữ xe. Cập nhật HangPhong_DichVu trước khi thu.';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'013', N'013_room_classes_services.sql');

        COMMIT TRANSACTION;
        PRINT N'[013] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
-- END INLINE: db/migrations/013_room_classes_services.sql
GO
PRINT N'=== Migration 014 ==='
GO
-- BEGIN INLINE: db/migrations/014_contract_members.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

CREATE TABLE #Migration014StartState (Applied bit NOT NULL);
INSERT INTO #Migration014StartState (Applied) VALUES (0);
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NOT NULL
    EXEC sys.sp_executesql N'
        UPDATE #Migration014StartState
        SET Applied = CASE WHEN EXISTS (
            SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N''014''
        ) THEN 1 ELSE 0 END;';
GO

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51400, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'013')
    THROW 51401, N'Chạy migration 013 trước.', 1;
ELSE IF (SELECT Applied FROM #Migration014StartState) = 1
    PRINT N'[014] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.HopDong', N'U') IS NULL
           OR OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NULL
           OR OBJECT_ID(N'dbo.NhatKyHeThong', N'U') IS NULL
            THROW 51402, N'Thiếu bảng HopDong, LichSuHopDong hoặc NhatKyHeThong.', 1;

        DECLARE @TrangThaiDangCo nvarchar(max),
                @TrangThaiLa nvarchar(max),
                @MaDoiTuongCan int;

        SELECT @TrangThaiDangCo = STUFF((
            SELECT N', ' + COALESCE(QUOTENAME(x.TrangThaiHopDong, N''''), N'<NULL>')
            FROM (SELECT DISTINCT TrangThaiHopDong FROM dbo.HopDong) x
            ORDER BY x.TrangThaiHopDong
            FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, N'');
        SELECT @TrangThaiLa = STUFF((
            SELECT N'; ' + QUOTENAME(cc.name) + N'=' + cc.definition
            FROM sys.check_constraints cc
            WHERE cc.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND cc.definition LIKE N'%TrangThaiHopDong%'
            ORDER BY cc.name
            FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, N'');
        PRINT N'[014] TrangThaiHopDong hiện có: ' + COALESCE(@TrangThaiDangCo, N'(không có dòng)');
        PRINT N'[014] CHECK liên quan TrangThaiHopDong: ' + COALESCE(@TrangThaiLa, N'(không có)');

        IF EXISTS (
            SELECT 1 FROM dbo.HopDong
            WHERE TrangThaiHopDong IS NULL
               OR TrangThaiHopDong NOT IN (N'Còn hiệu lực', N'Đã kết thúc')
        )
        BEGIN
            SET @TrangThaiDangCo = LEFT(
                N'Trạng thái hợp đồng ngoài CHECK đang dùng; dừng để bảo toàn dữ liệu: '
                + COALESCE(@TrangThaiDangCo, N'<NULL>'), 2048);
            THROW 51403, @TrangThaiDangCo, 1;
        END;

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.HopDong hd
                    LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                    LEFT JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                    WHERE sv.MaSinhVien IS NULL OR p.TenPhong IS NULL
                )
                BEGIN
                    DECLARE @ThieuHieuLuc nvarchar(max);
                    SELECT @ThieuHieuLuc = STUFF((
                        SELECT N'', '' + hd.MaHopDong + N'' (SV='' + COALESCE(hd.MaSinhVien, N''<NULL>'')
                             + N'', phòng='' + COALESCE(hd.TenPhong, N''<NULL>'') + N'')''
                        FROM dbo.HopDong hd
                        LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                        LEFT JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                        WHERE sv.MaSinhVien IS NULL OR p.TenPhong IS NULL
                        ORDER BY hd.MaHopDong
                        FOR XML PATH(''''), TYPE
                    ).value(''.'', ''nvarchar(max)''), 1, 2, N'''');
                    SET @ThieuHieuLuc = LEFT(N''Hợp đồng thiếu sinh viên/phòng: '' + @ThieuHieuLuc, 2048);
                    THROW 51404, @ThieuHieuLuc, 1;
                END;

                IF EXISTS (
                    SELECT MaSinhVien
                    FROM dbo.HopDong
                    WHERE TrangThaiHopDong = N''Còn hiệu lực''
                    GROUP BY MaSinhVien
                    HAVING COUNT_BIG(*) > 1
                )
                BEGIN
                    DECLARE @TrungSinhVien nvarchar(max);
                    SELECT @TrungSinhVien = STUFF((
                        SELECT N'', '' + d.MaSinhVien + N'' ('' + CONVERT(nvarchar(20), d.SoHopDong) + N'' hợp đồng)''
                        FROM (
                            SELECT MaSinhVien, COUNT_BIG(*) AS SoHopDong
                            FROM dbo.HopDong
                            WHERE TrangThaiHopDong = N''Còn hiệu lực''
                            GROUP BY MaSinhVien
                            HAVING COUNT_BIG(*) > 1
                        ) d
                        ORDER BY d.MaSinhVien
                        FOR XML PATH(''''), TYPE
                    ).value(''.'', ''nvarchar(max)''), 1, 2, N'''');
                    SET @TrungSinhVien = LEFT(N''Sinh viên có nhiều hợp đồng hiệu lực: '' + @TrungSinhVien, 2048);
                    THROW 51405, @TrungSinhVien, 1;
                END;';

        IF EXISTS (
            SELECT 1
            FROM dbo.HopDong hd
            LEFT JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
            WHERE p.TenPhong IS NULL
        )
            THROW 51406, N'Có hợp đồng (kể cả đã kết thúc) tham chiếu phòng không tồn tại; không thể tạo FK.', 1;

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.HopDong hd
                    INNER JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                    WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
                      AND (sv.GioiTinh IS NULL OR p.LoaiPhong IS NULL OR sv.GioiTinh <> p.LoaiPhong)
                )
                BEGIN
                    DECLARE @SaiGioiTinh nvarchar(max);
                    SELECT @SaiGioiTinh = STUFF((
                        SELECT N'', '' + hd.MaHopDong + N''/'' + hd.MaSinhVien + N''/'' + hd.TenPhong
                        FROM dbo.HopDong hd
                        INNER JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                        INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                        WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
                          AND (sv.GioiTinh IS NULL OR p.LoaiPhong IS NULL OR sv.GioiTinh <> p.LoaiPhong)
                        ORDER BY hd.MaHopDong
                        FOR XML PATH(''''), TYPE
                    ).value(''.'', ''nvarchar(max)''), 1, 2, N'''');
                    SET @SaiGioiTinh = LEFT(N''Sinh viên lệch giới tính phòng: '' + @SaiGioiTinh, 2048);
                    THROW 51407, @SaiGioiTinh, 1;
                END;';

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.SinhVien sv
                    WHERE sv.TenPhong IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM dbo.HopDong hd
                          WHERE hd.MaSinhVien = sv.MaSinhVien
                            AND hd.TenPhong = sv.TenPhong
                            AND hd.TrangThaiHopDong = N''Còn hiệu lực''
                      )
                )
                    THROW 51417, N''Sinh viên đang gán phòng nhưng không có hợp đồng hiệu lực khớp; cần đối soát trước khi chuyển đổi.'', 1;';

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.HopDong hd
                    WHERE EXISTS (
                        SELECT 1 FROM dbo.LichSuHopDong ls
                        WHERE ls.MaHopDong = hd.MaHopDong AND ls.ThaoTac = N''Chuyển phòng''
                    )
                      AND NOT EXISTS (
                        SELECT 1 FROM dbo.LichSuHopDong ls
                        WHERE ls.MaHopDong = hd.MaHopDong AND ls.ThaoTac = N''Tạo mới''
                    )
                )
                    THROW 51418, N''Hợp đồng có lịch sử chuyển phòng nhưng thiếu log Tạo mới; không thể khôi phục hạng phòng lúc ký một cách an toàn.'', 1;';

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.LichSuHopDong ls
                    WHERE ls.ThaoTac = N''Tạo mới''
                      AND NOT EXISTS (SELECT 1 FROM dbo.Phong p WHERE p.TenPhong = ls.TenPhong)
                )
                    THROW 51419, N''Log Tạo mới tham chiếu phòng không còn tồn tại; cần đối soát trước khi chuyển đổi.'', 1;';

        IF OBJECT_ID(N'dbo.LichSuHopDong_Backup', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.LichSuHopDong_Backup
            (
                MaLichSu int NOT NULL CONSTRAINT PK_LichSuHopDong_Backup PRIMARY KEY,
                MaHopDong nvarchar(20) NOT NULL,
                MaSinhVien nvarchar(30) NOT NULL,
                HoTen nvarchar(100) NULL,
                TenPhong nvarchar(50) NULL,
                NgayBatDau date NULL,
                NgayKetThuc date NULL,
                TrangThaiHopDong nvarchar(20) NULL,
                ThaoTac nvarchar(30) NOT NULL,
                NguoiThucHien int NULL,
                ThoiGian datetime NOT NULL
            );
        END;

        IF COL_LENGTH(N'dbo.NhatKyHeThong', N'ChiTiet') IS NULL
            THROW 51408, N'Không tìm thấy NhatKyHeThong.ChiTiet.', 1;
        IF COL_LENGTH(N'dbo.NhatKyHeThong', N'HanhDong') IS NULL
           OR COL_LENGTH(N'dbo.NhatKyHeThong', N'DoiTuong') IS NULL
           OR COL_LENGTH(N'dbo.NhatKyHeThong', N'MaDoiTuong') IS NULL
           OR COL_LENGTH(N'dbo.NhatKyHeThong', N'ThoiGian') IS NULL
           OR COL_LENGTH(N'dbo.NhatKyHeThong', N'MaTaiKhoan') IS NULL
            THROW 51409, N'Cấu trúc NhatKyHeThong thiếu cột cần chuyển log.', 1;

        SELECT @MaDoiTuongCan = c.max_length
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.NhatKyHeThong') AND c.name = N'MaDoiTuong';
        IF @MaDoiTuongCan <> -1 AND @MaDoiTuongCan < 48
            THROW 51410, N'NhatKyHeThong.MaDoiTuong không đủ dài cho LichSuHopDong:<MaLichSu>.', 1;

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.NhatKyHeThong')
              AND (definition LIKE N'%HanhDong%' OR definition LIKE N'%DoiTuong%')
        )
        BEGIN
            SELECT name, definition
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.NhatKyHeThong')
              AND (definition LIKE N'%HanhDong%' OR definition LIKE N'%DoiTuong%');
            THROW 51411, N'NhatKyHeThong có CHECK giới hạn HanhDong/DoiTuong; cần xem lại trước khi chuyển log.', 1;
        END;

        ALTER TABLE dbo.NhatKyHeThong ALTER COLUMN ChiTiet nvarchar(max) NULL;

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'
                DECLARE @SoLog bigint, @SoBackup bigint, @SoNhatKy bigint;

                INSERT INTO dbo.LichSuHopDong_Backup
                    (MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc,
                     TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian)
                SELECT ls.MaLichSu, ls.MaHopDong, ls.MaSinhVien, ls.HoTen, ls.TenPhong, ls.NgayBatDau,
                       ls.NgayKetThuc, ls.TrangThaiHopDong, ls.ThaoTac, ls.NguoiThucHien, ls.ThoiGian
                FROM dbo.LichSuHopDong ls
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.LichSuHopDong_Backup b WHERE b.MaLichSu = ls.MaLichSu
                );

                INSERT INTO dbo.NhatKyHeThong
                    (ThoiGian, MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
                SELECT ls.ThoiGian, ls.NguoiThucHien, ls.ThaoTac, N''HopDong'',
                       N''LichSuHopDong:'' + CONVERT(nvarchar(10), ls.MaLichSu),
                       (
                           SELECT N''LichSuHopDong'' AS nguon, ls.MaLichSu, ls.MaHopDong, ls.MaSinhVien,
                                  ls.HoTen, ls.TenPhong, ls.NgayBatDau, ls.NgayKetThuc,
                                  ls.TrangThaiHopDong, ls.ThaoTac, ls.NguoiThucHien, ls.ThoiGian
                           FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
                       )
                FROM dbo.LichSuHopDong ls
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM dbo.NhatKyHeThong nk
                    WHERE nk.DoiTuong = N''HopDong''
                      AND nk.MaDoiTuong = N''LichSuHopDong:'' + CONVERT(nvarchar(10), ls.MaLichSu)
                      AND ISJSON(nk.ChiTiet) = 1
                      AND JSON_VALUE(nk.ChiTiet, ''$.nguon'') = N''LichSuHopDong''
                      AND TRY_CONVERT(int, JSON_VALUE(nk.ChiTiet, ''$.MaLichSu'')) = ls.MaLichSu
                );

                SELECT @SoLog = COUNT_BIG(*) FROM dbo.LichSuHopDong;
                SELECT @SoBackup = COUNT_BIG(*) FROM dbo.LichSuHopDong_Backup b
                INNER JOIN dbo.LichSuHopDong ls ON ls.MaLichSu = b.MaLichSu;
                SELECT @SoNhatKy = COUNT_BIG(*)
                FROM dbo.NhatKyHeThong nk
                WHERE nk.DoiTuong = N''HopDong''
                  AND JSON_VALUE(nk.ChiTiet, ''$.nguon'') = N''LichSuHopDong'';
                PRINT N''[014] Log nguồn='' + CONVERT(nvarchar(20), @SoLog)
                    + N''; bản sao khớp='' + CONVERT(nvarchar(20), @SoBackup)
                    + N''; nhật ký chuyển='' + CONVERT(nvarchar(20), @SoNhatKy);

                IF @SoLog <> @SoBackup OR @SoLog <> @SoNhatKy
                    THROW 51412, N''Số dòng sao lưu/chuyển nhật ký không khớp; rollback, không tiếp tục.'', 1;

                IF EXISTS (
                    SELECT MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                           NgayKetThuc, TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian
                    FROM dbo.LichSuHopDong
                    EXCEPT
                    SELECT MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                           NgayKetThuc, TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian
                    FROM dbo.LichSuHopDong_Backup
                )
                OR EXISTS (
                    SELECT MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                           NgayKetThuc, TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian
                    FROM dbo.LichSuHopDong_Backup
                    EXCEPT
                    SELECT MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                           NgayKetThuc, TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian
                    FROM dbo.LichSuHopDong
                )
                    THROW 51455, N''Nội dung LichSuHopDong_Backup không khớp từng dòng nguồn; rollback migration.'', 1;

                IF EXISTS (
                    SELECT 1
                    FROM dbo.LichSuHopDong_Backup b
                    LEFT JOIN dbo.NhatKyHeThong nk
                      ON nk.DoiTuong = N''HopDong''
                     AND nk.MaDoiTuong = N''LichSuHopDong:'' + CONVERT(nvarchar(10), b.MaLichSu)
                     AND JSON_VALUE(nk.ChiTiet, ''$.nguon'') = N''LichSuHopDong''
                     AND TRY_CONVERT(int, JSON_VALUE(nk.ChiTiet, ''$.MaLichSu'')) = b.MaLichSu
                    WHERE EXISTS (SELECT 1 FROM dbo.LichSuHopDong ls WHERE ls.MaLichSu = b.MaLichSu)
                      AND nk.MaNhatKy IS NULL
                )
                    THROW 51413, N''Thiếu event nhật ký khớp từng MaLichSu; rollback migration.'', 1;';

        IF OBJECT_ID(N'dbo.ChiTietHopDong', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ChiTietHopDong
            (
                MaChiTiet int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChiTietHopDong PRIMARY KEY,
                MaHopDong nvarchar(20) NOT NULL,
                MaSinhVien nvarchar(30) NOT NULL,
                NgayVao date NOT NULL,
                NgayRa date NULL,
                KyHanThanhToanPhong nvarchar(10) NOT NULL
                    CONSTRAINT DF_ChiTietHopDong_KyHan DEFAULT (N'THANG'),
                GiaPhongApDung decimal(18,2) NOT NULL,
                GiaPhongThangApDung decimal(18,2) NOT NULL,
                LaNguoiDaiDienThanhToanDichVu bit NOT NULL
                    CONSTRAINT DF_ChiTietHopDong_DaiDien DEFAULT (0),
                TrangThai nvarchar(20) NOT NULL,
                GhiChu nvarchar(255) NULL,
                LyDoRoi nvarchar(100) NULL,
                NgayTao datetime NOT NULL CONSTRAINT DF_ChiTietHopDong_NgayTao DEFAULT (GETDATE()),
                CONSTRAINT FK_CTHD_HopDong FOREIGN KEY (MaHopDong) REFERENCES dbo.HopDong (MaHopDong),
                CONSTRAINT FK_CTHD_SinhVien FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien),
                CONSTRAINT CK_CTHD_KyHan CHECK (KyHanThanhToanPhong IN (N'THANG', N'NAM')),
                CONSTRAINT CK_CTHD_TrangThai CHECK (TrangThai IN (N'Đang ở', N'Đã rời', N'Đã chuyển phòng')),
                CONSTRAINT CK_CTHD_Ngay CHECK (NgayRa IS NULL OR NgayRa >= NgayVao),
                CONSTRAINT CK_CTHD_TrangThai_NgayRa CHECK (
                    (TrangThai = N'Đang ở' AND NgayRa IS NULL)
                    OR (TrangThai <> N'Đang ở' AND NgayRa IS NOT NULL)
                ),
                CONSTRAINT CK_CTHD_Gia CHECK (GiaPhongApDung >= 0 AND GiaPhongThangApDung >= 0)
            );
        END;

        IF COL_LENGTH(N'dbo.HopDong', N'MaHangPhong') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HopDong ADD MaHangPhong nvarchar(20) NULL;';

        EXEC sys.sp_executesql N'
            UPDATE hd
            SET MaHangPhong = COALESCE(hpFirst.MaHangPhong, pCurrent.MaHangPhong)
            FROM dbo.HopDong hd
            LEFT JOIN dbo.Phong pCurrent ON pCurrent.TenPhong = hd.TenPhong
            OUTER APPLY (
                SELECT TOP (1) pFirst.MaHangPhong
                FROM dbo.LichSuHopDong_Backup ls
                INNER JOIN dbo.Phong pFirst ON pFirst.TenPhong = ls.TenPhong
                WHERE ls.MaHopDong = hd.MaHopDong AND ls.ThaoTac = N''Tạo mới''
                ORDER BY ls.ThoiGian, ls.MaLichSu
            ) hpFirst
            WHERE hd.MaHangPhong IS NULL;
        ';

        DECLARE @MissingRoomTier bit = 0;
        EXEC sys.sp_executesql N'
            IF EXISTS (
                SELECT 1
                FROM dbo.HopDong hd
                LEFT JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
                WHERE hp.MaHangPhong IS NULL
            ) SET @MissingRoomTier = 1;',
            N'@MissingRoomTier bit OUTPUT', @MissingRoomTier = @MissingRoomTier OUTPUT;
        IF @MissingRoomTier = 1
            THROW 51414, N'Không xác định được hạng phòng cho mọi hợp đồng; xem log Tạo mới và Phong.', 1;

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.HopDong'') AND name = N''FK_HopDong_HangPhong''
            )
                ALTER TABLE dbo.HopDong WITH CHECK
                    ADD CONSTRAINT FK_HopDong_HangPhong
                    FOREIGN KEY (MaHangPhong) REFERENCES dbo.HangPhong (MaHangPhong);
            IF NOT EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.HopDong'') AND name = N''FK_HopDong_Phong''
            )
                ALTER TABLE dbo.HopDong WITH CHECK
                    ADD CONSTRAINT FK_HopDong_Phong
                    FOREIGN KEY (TenPhong) REFERENCES dbo.Phong (TenPhong);
            ALTER TABLE dbo.HopDong ALTER COLUMN MaHangPhong nvarchar(20) NOT NULL;';

        DECLARE @CapacityIssue nvarchar(max);
        SELECT @CapacityIssue = STUFF((
            SELECT N', ' + p.TenPhong + N' (' + CONVERT(nvarchar(20), x.SoNguoi) + N'/'
                 + CONVERT(nvarchar(20), p.SucChuaToiDa) + N')'
            FROM (
                SELECT hd.TenPhong, COUNT_BIG(*) AS SoNguoi
                FROM dbo.HopDong hd
                WHERE hd.TrangThaiHopDong = N'Còn hiệu lực'
                GROUP BY hd.TenPhong
            ) x
            INNER JOIN dbo.Phong p ON p.TenPhong = x.TenPhong
            WHERE x.SoNguoi > p.SucChuaToiDa
            ORDER BY p.TenPhong
            FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, N'');
        IF @CapacityIssue IS NOT NULL
        BEGIN
            SET @CapacityIssue = LEFT(N'Sĩ số hợp đồng hiệu lực vượt sức chứa: ' + @CapacityIssue, 2048);
            THROW 51415, @CapacityIssue, 1;
        END;

        EXEC sys.sp_executesql N'
            INSERT INTO dbo.ChiTietHopDong
                (MaHopDong, MaSinhVien, NgayVao, NgayRa, KyHanThanhToanPhong,
                 GiaPhongApDung, GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu,
                 TrangThai, GhiChu)
            SELECT hd.MaHopDong,
                   hd.MaSinhVien,
                   COALESCE(CAST(move.ThoiGian AS date), hd.NgayBatDau),
                   CASE WHEN hd.TrangThaiHopDong = N''Còn hiệu lực'' THEN NULL
                        WHEN COALESCE(hd.NgayKetThucThucTe, hd.NgayKetThuc) < COALESCE(CAST(move.ThoiGian AS date), hd.NgayBatDau)
                            THEN COALESCE(CAST(move.ThoiGian AS date), hd.NgayBatDau)
                        ELSE COALESCE(hd.NgayKetThucThucTe, hd.NgayKetThuc) END,
                   N''THANG'',
                   hp.GiaPhongThang,
                   hp.GiaPhongThang,
                   CASE WHEN hd.TrangThaiHopDong = N''Còn hiệu lực'' THEN 1 ELSE 0 END,
                   CASE WHEN hd.TrangThaiHopDong = N''Còn hiệu lực'' THEN N''Đang ở'' ELSE N''Đã rời'' END,
                   hd.GhiChu
            FROM dbo.HopDong hd
            INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
            OUTER APPLY (
                SELECT TOP (1) ls.ThoiGian
                FROM dbo.LichSuHopDong_Backup ls
                WHERE ls.MaHopDong = hd.MaHopDong
                  AND ls.ThaoTac = N''Chuyển phòng''
                  AND ls.TenPhong = hd.TenPhong
                ORDER BY ls.ThoiGian DESC, ls.MaLichSu DESC
            ) move
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.ChiTietHopDong c
                WHERE c.MaHopDong = hd.MaHopDong AND c.MaSinhVien = hd.MaSinhVien
            );
        ';

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.ChiTietHopDong'') AND name = N''IX_CTHD_MaHopDong'')
                CREATE INDEX IX_CTHD_MaHopDong ON dbo.ChiTietHopDong (MaHopDong);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.ChiTietHopDong'') AND name = N''IX_CTHD_MaSinhVien'')
                CREATE INDEX IX_CTHD_MaSinhVien ON dbo.ChiTietHopDong (MaSinhVien);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.ChiTietHopDong'') AND name = N''UX_CTHD_SinhVien_DangO'')
                CREATE UNIQUE INDEX UX_CTHD_SinhVien_DangO ON dbo.ChiTietHopDong (MaSinhVien)
                    WHERE TrangThai = N''Đang ở'';
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.ChiTietHopDong'') AND name = N''UX_CTHD_DaiDien_DangO'')
                CREATE UNIQUE INDEX UX_CTHD_DaiDien_DangO ON dbo.ChiTietHopDong (MaHopDong)
                    WHERE LaNguoiDaiDienThanhToanDichVu = 1 AND TrangThai = N''Đang ở'';';

        IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'UQ_HopDong_MotHieuLuc'
        )
            DROP INDEX UQ_HopDong_MotHieuLuc ON dbo.HopDong;
        IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_MaSV_TrangThai'
        )
            DROP INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong;

        IF EXISTS (
            SELECT 1
            FROM sys.key_constraints kc
            INNER JOIN sys.index_columns ic
                ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
            INNER JOIN sys.columns c
                ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE kc.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND kc.type = N'PK'
              AND c.name = N'MaSinhVien'
        )
            THROW 51458, N'Khóa chính của HopDong còn dùng MaSinhVien; cần đối soát trước khi bỏ cột.', 1;

        DECLARE @DropKey sysname;
        DECLARE @DropSql nvarchar(max);
        DECLARE key_contract CURSOR LOCAL FAST_FORWARD FOR
            SELECT DISTINCT kc.name
            FROM sys.key_constraints kc
            INNER JOIN sys.index_columns ic
                ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
            INNER JOIN sys.columns c
                ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE kc.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND kc.type = N'UQ'
              AND c.name = N'MaSinhVien';
        OPEN key_contract;
        FETCH NEXT FROM key_contract INTO @DropKey;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @DropSql = N'ALTER TABLE dbo.HopDong DROP CONSTRAINT ' + QUOTENAME(@DropKey) + N';';
            EXEC sys.sp_executesql @DropSql;
            FETCH NEXT FROM key_contract INTO @DropKey;
        END;
        CLOSE key_contract;
        DEALLOCATE key_contract;

        IF EXISTS (
            SELECT 1
            FROM sys.foreign_key_columns fkc
            INNER JOIN sys.columns c
                ON c.object_id = fkc.referenced_object_id
               AND c.column_id = fkc.referenced_column_id
            WHERE fkc.referenced_object_id = OBJECT_ID(N'dbo.HopDong')
              AND c.name = N'MaSinhVien'
        )
            THROW 51453, N'Bảng khác còn khóa ngoại tới HopDong.MaSinhVien; cần xử lý trước khi bỏ cột.', 1;

        DECLARE @DropFk sysname;
        DECLARE fk_contract CURSOR LOCAL FAST_FORWARD FOR
            SELECT DISTINCT fk.name
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            INNER JOIN sys.columns c
                ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
            WHERE fk.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND c.name = N'MaSinhVien';
        OPEN fk_contract;
        FETCH NEXT FROM fk_contract INTO @DropFk;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @DropSql = N'ALTER TABLE dbo.HopDong DROP CONSTRAINT ' + QUOTENAME(@DropFk) + N';';
            EXEC sys.sp_executesql @DropSql;
            FETCH NEXT FROM fk_contract INTO @DropFk;
        END;
        CLOSE fk_contract;
        DEALLOCATE fk_contract;

        DECLARE @DropIndex sysname;
        DECLARE ix_contract CURSOR LOCAL FAST_FORWARD FOR
            SELECT i.name
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.object_id = OBJECT_ID(N'dbo.HopDong')
              AND i.index_id > 0 AND i.is_primary_key = 0 AND i.is_unique_constraint = 0
              AND (c.name = N'MaSinhVien' OR i.filter_definition LIKE N'%MaSinhVien%')
            GROUP BY i.name;
        OPEN ix_contract;
        FETCH NEXT FROM ix_contract INTO @DropIndex;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @DropSql = N'DROP INDEX ' + QUOTENAME(@DropIndex) + N' ON dbo.HopDong;';
            EXEC sys.sp_executesql @DropSql;
            FETCH NEXT FROM ix_contract INTO @DropIndex;
        END;
        CLOSE ix_contract;
        DEALLOCATE ix_contract;

        DECLARE @DropDefault sysname;
        DECLARE default_contract CURSOR LOCAL FAST_FORWARD FOR
            SELECT dc.name
            FROM sys.default_constraints dc
            INNER JOIN sys.columns c
                ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
            WHERE dc.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND c.name = N'MaSinhVien';
        OPEN default_contract;
        FETCH NEXT FROM default_contract INTO @DropDefault;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @DropSql = N'ALTER TABLE dbo.HopDong DROP CONSTRAINT ' + QUOTENAME(@DropDefault) + N';';
            EXEC sys.sp_executesql @DropSql;
            FETCH NEXT FROM default_contract INTO @DropDefault;
        END;
        CLOSE default_contract;
        DEALLOCATE default_contract;

        IF OBJECT_ID(N'dbo.vw_LichSuHopDongFE', N'V') IS NOT NULL
            DROP VIEW dbo.vw_LichSuHopDongFE;
        IF OBJECT_ID(N'dbo.vw_HopDongSapHetHan', N'V') IS NOT NULL
            DROP VIEW dbo.vw_HopDongSapHetHan;
        IF OBJECT_ID(N'dbo.vw_SinhVienChiTiet', N'V') IS NOT NULL
            DROP VIEW dbo.vw_SinhVienChiTiet;

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND definition LIKE N'%MaSinhVien%'
        )
            THROW 51416, N'CHECK constraint còn tham chiếu HopDong.MaSinhVien; không thể bỏ cột an toàn.', 1;

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HopDong DROP COLUMN MaSinhVien;';

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            DROP TABLE dbo.LichSuHopDong;

        IF OBJECT_ID(N'dbo.TRG_UpdatePhong', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdatePhong;
        IF OBJECT_ID(N'dbo.TRG_UpdateRoomCount', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdateRoomCount;
        IF OBJECT_ID(N'dbo.TRG_UpdateTrangThaiHopDong', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdateTrangThaiHopDong;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GhiNhatKyHopDong
    @HanhDong nvarchar(50),
    @MaHopDong nvarchar(20),
    @ChiTiet nvarchar(500) = NULL,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.NhatKyHeThong (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
    VALUES (@NguoiThucHien, @HanhDong, N''HopDong'', @MaHopDong, @ChiTiet);
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHopDong
    @TenPhong nvarchar(50),
    @NgayBatDau date,
    @NgayKetThuc date,
    @SinhVienJson nvarchar(max),
    @GhiChu nvarchar(255) = NULL,
    @NguoiThucHien int = NULL,
    @MaHopDong nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @NgayKetThuc <= @NgayBatDau THROW 51420, N''Ngày kết thúc phải sau ngày bắt đầu.'', 1;
    IF ISJSON(@SinhVienJson) <> 1 THROW 51421, N''Danh sách sinh viên phải là JSON hợp lệ.'', 1;

    DECLARE @Members table (
        MaSinhVien nvarchar(30) NOT NULL PRIMARY KEY,
        KyHan nvarchar(10) NOT NULL,
        LaDaiDien bit NOT NULL
    );
    INSERT INTO @Members (MaSinhVien, KyHan, LaDaiDien)
    SELECT MaSinhVien, COALESCE(NULLIF(KyHan, N''''), N''THANG''), COALESCE(LaDaiDien, 0)
    FROM OPENJSON(@SinhVienJson)
    WITH (
        MaSinhVien nvarchar(30) N''$.maSinhVien'',
        KyHan nvarchar(10) N''$.kyHanThanhToanPhong'',
        LaDaiDien bit N''$.laNguoiDaiDien''
    );
    IF NOT EXISTS (SELECT 1 FROM @Members) THROW 51422, N''Hợp đồng cần ít nhất một sinh viên.'', 1;
    IF EXISTS (SELECT 1 FROM @Members WHERE KyHan NOT IN (N''THANG'', N''NAM''))
        THROW 51423, N''Kỳ hạn tiền phòng phải là THANG hoặc NAM.'', 1;
    IF (SELECT COUNT(*) FROM @Members WHERE LaDaiDien = 1) > 1
        THROW 51424, N''Mỗi hợp đồng chỉ có tối đa một người đại diện.'', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Gender nvarchar(10), @Capacity int, @RoomStatus nvarchar(20),
                @RoomCount int, @Hang nvarchar(20), @ContractId nvarchar(20);
        SELECT @Gender = p.LoaiPhong, @Capacity = hp.SucChuaToiDa,
               @RoomStatus = p.TrangThaiPhong,
               @Hang = p.MaHangPhong
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TenPhong = @TenPhong;
        IF @Gender IS NULL THROW 51425, N''Không tìm thấy phòng hoặc hạng phòng.'', 1;
        IF @RoomStatus IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 51426, N''Phòng đang bảo trì hoặc ngưng sử dụng.'', 1;
        IF EXISTS (SELECT 1 FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
                   WHERE TenPhong = @TenPhong AND TrangThaiHopDong = N''Còn hiệu lực'')
            THROW 51427, N''Phòng đã có hợp đồng hiệu lực; hãy thêm sinh viên vào hợp đồng đó.'', 1;
        SELECT @RoomCount = COUNT(*)
        FROM dbo.HopDong hd
        INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
        WHERE hd.TenPhong = @TenPhong
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND c.TrangThai = N''Đang ở'';
        IF EXISTS (
            SELECT 1
            FROM @Members m
            LEFT JOIN dbo.SinhVien sv WITH (UPDLOCK, HOLDLOCK) ON sv.MaSinhVien = m.MaSinhVien
            WHERE sv.MaSinhVien IS NULL OR sv.GioiTinh IS NULL OR sv.GioiTinh <> @Gender
               OR EXISTS (SELECT 1 FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
                          WHERE c.MaSinhVien = m.MaSinhVien AND c.TrangThai = N''Đang ở'')
        )
            THROW 51428, N''Có sinh viên không tồn tại, sai giới tính hoặc đã có chỗ ở hiệu lực.'', 1;
        IF @RoomCount + (SELECT COUNT(*) FROM @Members) > @Capacity
            THROW 51429, N''Số sinh viên vượt sức chứa hạng phòng.'', 1;

        IF NOT EXISTS (SELECT 1 FROM @Members WHERE LaDaiDien = 1)
            UPDATE @Members SET LaDaiDien = 1
            WHERE MaSinhVien = (SELECT MIN(MaSinhVien) FROM @Members);

        SET @ContractId = NULLIF(LTRIM(RTRIM(@MaHopDong)), N'''');
        IF @ContractId IS NULL
            SET @ContractId = N''HD'' + RIGHT(N''00000'' + CONVERT(nvarchar(10), NEXT VALUE FOR dbo.Seq_MaHopDong), 5);
        IF EXISTS (SELECT 1 FROM dbo.HopDong WHERE MaHopDong = @ContractId)
            THROW 51430, N''Mã hợp đồng đã tồn tại.'', 1;

        INSERT INTO dbo.HopDong
            (MaHopDong, TenPhong, MaHangPhong, NgayBatDau, NgayKetThuc,
             TrangThaiHopDong, NgayTao, GhiChu, SoLanGiaHan)
        VALUES
            (@ContractId, @TenPhong, @Hang, @NgayBatDau, @NgayKetThuc,
             N''Còn hiệu lực'', CAST(GETDATE() AS date), @GhiChu, 0);

        INSERT INTO dbo.ChiTietHopDong
            (MaHopDong, MaSinhVien, NgayVao, KyHanThanhToanPhong, GiaPhongApDung,
             GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu, TrangThai, GhiChu)
        SELECT @ContractId, m.MaSinhVien, @NgayBatDau, m.KyHan,
               CASE WHEN m.KyHan = N''NAM'' THEN hp.GiaPhongNam ELSE hp.GiaPhongThang END,
               hp.GiaPhongThang, m.LaDaiDien, N''Đang ở'', @GhiChu
        FROM @Members m
        CROSS JOIN dbo.HangPhong hp
        WHERE hp.MaHangPhong = @Hang;

        EXEC dbo.sp_GhiNhatKyHopDong N''Tạo mới'', @ContractId, N''Tạo hợp đồng theo phòng.'', @NguoiThucHien;
        COMMIT TRANSACTION;
        SELECT @ContractId AS MaHopDong;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVienVaoHopDong
    @MaHopDong nvarchar(20),
    @MaSinhVien nvarchar(30),
    @KyHanThanhToanPhong nvarchar(10) = N''THANG'',
    @LaNguoiDaiDien bit = 0,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @KyHanThanhToanPhong NOT IN (N''THANG'', N''NAM'')
        THROW 51431, N''Kỳ hạn tiền phòng phải là THANG hoặc NAM.'', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Room nvarchar(50), @Hang nvarchar(20), @Gender nvarchar(10),
                @Capacity int, @Count int, @End date, @RoomStatus nvarchar(20);
        SELECT @Room = hd.TenPhong, @Hang = hd.MaHangPhong, @End = hd.NgayKetThuc,
               @Gender = p.LoaiPhong, @RoomStatus = p.TrangThaiPhong, @Capacity = hp.SucChuaToiDa
        FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Phong p WITH (UPDLOCK, HOLDLOCK) ON p.TenPhong = hd.TenPhong
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
        WHERE hd.MaHopDong = @MaHopDong AND hd.TrangThaiHopDong = N''Còn hiệu lực'';
        IF @Room IS NULL THROW 51432, N''Không tìm thấy hợp đồng hiệu lực.'', 1;
        IF @RoomStatus IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 51433, N''Phòng đang bảo trì hoặc ngưng sử dụng.'', 1;
        SELECT @Count = COUNT(*)
        FROM dbo.ChiTietHopDong
        WHERE MaHopDong = @MaHopDong AND TrangThai = N''Đang ở'';
        IF EXISTS (
            SELECT 1 FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK)
            WHERE MaSinhVien = @MaSinhVien AND GioiTinh = @Gender
        ) AND NOT EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaSinhVien = @MaSinhVien AND TrangThai = N''Đang ở''
        )
        BEGIN
            IF @Count >= @Capacity THROW 51434, N''Phòng đã đủ sức chứa.'', 1;
            IF @LaNguoiDaiDien = 1
                UPDATE dbo.ChiTietHopDong
                SET LaNguoiDaiDienThanhToanDichVu = 0
                WHERE MaHopDong = @MaHopDong AND TrangThai = N''Đang ở'';

            INSERT INTO dbo.ChiTietHopDong
                (MaHopDong, MaSinhVien, NgayVao, KyHanThanhToanPhong, GiaPhongApDung,
                 GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu, TrangThai)
            SELECT @MaHopDong, @MaSinhVien, CAST(GETDATE() AS date), @KyHanThanhToanPhong,
                   CASE WHEN @KyHanThanhToanPhong = N''NAM'' THEN hp.GiaPhongNam ELSE hp.GiaPhongThang END,
                   hp.GiaPhongThang, @LaNguoiDaiDien, N''Đang ở''
            FROM dbo.HangPhong hp WHERE hp.MaHangPhong = @Hang;
        END
        ELSE
            THROW 51435, N''Sinh viên không tồn tại, sai giới tính hoặc đã có hợp đồng hiệu lực.'', 1;
        EXEC dbo.sp_GhiNhatKyHopDong N''Thêm sinh viên'', @MaHopDong, @MaSinhVien, @NguoiThucHien;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_SinhVienRoiHopDong
    @MaChiTiet int,
    @NgayRa date = NULL,
    @LyDoRoi nvarchar(100) = NULL,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Contract nvarchar(20), @Student nvarchar(30), @Room nvarchar(50),
                @WasRep bit, @LeaveDate date = COALESCE(@NgayRa, CAST(GETDATE() AS date)),
                @NextRep int;
        SELECT @Contract = c.MaHopDong, @Student = c.MaSinhVien,
               @Room = hd.TenPhong, @WasRep = c.LaNguoiDaiDienThanhToanDichVu
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaChiTiet = @MaChiTiet AND c.TrangThai = N''Đang ở'';
        IF @Contract IS NULL THROW 51436, N''Không tìm thấy chi tiết hợp đồng đang ở.'', 1;
        IF @LeaveDate < (SELECT NgayVao FROM dbo.ChiTietHopDong WHERE MaChiTiet = @MaChiTiet)
            THROW 51437, N''Ngày rời không được trước ngày vào.'', 1;

        IF @WasRep = 1
        BEGIN
            SELECT TOP (1) @NextRep = MaChiTiet
            FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaHopDong = @Contract AND TrangThai = N''Đang ở'' AND MaChiTiet <> @MaChiTiet
            ORDER BY NgayVao, MaChiTiet;
            UPDATE dbo.ChiTietHopDong
            SET LaNguoiDaiDienThanhToanDichVu = 0
            WHERE MaChiTiet = @MaChiTiet;
            IF @NextRep IS NOT NULL
                UPDATE dbo.ChiTietHopDong
                SET LaNguoiDaiDienThanhToanDichVu = 1
                WHERE MaChiTiet = @NextRep;
        END;
        UPDATE dbo.ChiTietHopDong
        SET TrangThai = N''Đã rời'', NgayRa = @LeaveDate, LyDoRoi = @LyDoRoi,
            LaNguoiDaiDienThanhToanDichVu = 0
        WHERE MaChiTiet = @MaChiTiet;
        EXEC dbo.sp_GhiNhatKyHopDong N''Sinh viên rời hợp đồng'', @Contract, @Student, @NguoiThucHien;
        COMMIT TRANSACTION;
        IF @WasRep = 1 AND @NextRep IS NULL
            SELECT N''Không còn thành viên đang ở để chuyển đại diện; hợp đồng không có người đại diện.'' AS ThongBao;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KetThucHopDong
    @MaHopDong nvarchar(20),
    @NgayKetThucThucTe date = NULL,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @End date = COALESCE(@NgayKetThucThucTe, CAST(GETDATE() AS date));
        IF NOT EXISTS (
            SELECT 1 FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaHopDong = @MaHopDong AND TrangThaiHopDong = N''Còn hiệu lực''
        ) THROW 51438, N''Không tìm thấy hợp đồng hiệu lực.'', 1;
        UPDATE dbo.ChiTietHopDong
        SET TrangThai = N''Đã rời'', NgayRa = CASE WHEN NgayVao > @End THEN NgayVao ELSE @End END,
            LyDoRoi = N''Kết thúc hợp đồng'', LaNguoiDaiDienThanhToanDichVu = 0
        WHERE MaHopDong = @MaHopDong AND TrangThai = N''Đang ở'';
        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'', NgayKetThucThucTe = @End
        WHERE MaHopDong = @MaHopDong;
        EXEC dbo.sp_GhiNhatKyHopDong N''Kết thúc'', @MaHopDong, N''Kết thúc toàn bộ thành viên.'', @NguoiThucHien;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GiaHanHopDong
    @MaHopDong nvarchar(20),
    @NgayKetThucMoi date,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @OldEnd date;
        SELECT @OldEnd = NgayKetThuc
        FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND TrangThaiHopDong = N''Còn hiệu lực'';
        IF @OldEnd IS NULL THROW 51439, N''Không tìm thấy hợp đồng hiệu lực.'', 1;
        IF @NgayKetThucMoi <= @OldEnd THROW 51440, N''Ngày kết thúc mới phải sau ngày hiện tại.'', 1;
        UPDATE dbo.HopDong
        SET NgayKetThucGoc = COALESCE(NgayKetThucGoc, NgayKetThuc),
            NgayKetThuc = @NgayKetThucMoi, SoLanGiaHan = SoLanGiaHan + 1
        WHERE MaHopDong = @MaHopDong;
        EXEC dbo.sp_GhiNhatKyHopDong N''Gia hạn'', @MaHopDong, N''Gia hạn hợp đồng.'', @NguoiThucHien;
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
    DECLARE @Ended int = 0;
    UPDATE dbo.HopDong
    SET TrangThaiHopDong = N''Đã kết thúc'',
        NgayKetThucThucTe = COALESCE(NgayKetThucThucTe, NgayKetThuc)
    WHERE TrangThaiHopDong = N''Còn hiệu lực''
      AND NgayKetThuc < CAST(GETDATE() AS date);
    SET @Ended = @@ROWCOUNT;
    SELECT @Ended AS SoHopDongDaKetThuc, 0 AS SoLoi;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVien
    @MaSinhVien nvarchar(30),
    @HoTen nvarchar(100),
    @NgaySinh date,
    @GioiTinh nvarchar(10),
    @SDT varchar(10),
    @Email varchar(100),
    @DiaChi nvarchar(255),
    @TenPhong nvarchar(50) = NULL,
    @GhiChu nvarchar(255) = NULL,
    @Truong nvarchar(150) = NULL,
    @Lop nvarchar(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF NULLIF(LTRIM(RTRIM(@TenPhong)), N'''') IS NOT NULL
        THROW 51441, N''Không gán phòng trực tiếp; hãy tạo hợp đồng và chi tiết thành viên.'', 1;
    INSERT INTO dbo.SinhVien
        (MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
         TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop)
    VALUES
        (@MaSinhVien, @HoTen, @NgaySinh, @GioiTinh, @SDT, @Email, @DiaChi,
         NULL, NULL, @GhiChu, @Truong, @Lop);
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_XoaSinhVien
    @MaSinhVien nvarchar(30),
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @MaChiTiet int;
    SELECT @MaChiTiet = MaChiTiet
    FROM dbo.ChiTietHopDong
    WHERE MaSinhVien = @MaSinhVien AND TrangThai = N''Đang ở'';
    IF @MaChiTiet IS NOT NULL
        EXEC dbo.sp_SinhVienRoiHopDong @MaChiTiet, NULL, N''Xóa sinh viên'', @NguoiThucHien;
    UPDATE dbo.SinhVien
    SET TrangThaiSinhVien = N''Đã rời KTX'', TenPhong = NULL,
        NgayRoiKTX = COALESCE(NgayRoiKTX, CAST(GETDATE() AS date))
    WHERE MaSinhVien = @MaSinhVien;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ChuyenPhong
    @MaSinhVien nvarchar(30),
    @PhongMoi nvarchar(50),
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @OldDetail int, @OldContract nvarchar(20), @OldRoom nvarchar(50),
                @OldTier nvarchar(20), @NewTier nvarchar(20), @Gender nvarchar(10),
                @Capacity int, @Count int, @RoomStatus nvarchar(20), @Term nvarchar(10),
                @Rate decimal(18,2), @Monthly decimal(18,2), @End date,
                @NewContract nvarchar(20), @Representative bit;
        SELECT @OldDetail = c.MaChiTiet, @OldContract = hd.MaHopDong, @OldRoom = hd.TenPhong,
               @OldTier = hd.MaHangPhong, @Term = c.KyHanThanhToanPhong,
               @Rate = c.GiaPhongApDung, @Monthly = c.GiaPhongThangApDung,
               @Representative = c.LaNguoiDaiDienThanhToanDichVu, @End = hd.NgayKetThuc
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK) ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaSinhVien = @MaSinhVien AND c.TrangThai = N''Đang ở''
          AND hd.TrangThaiHopDong = N''Còn hiệu lực'';
        IF @OldDetail IS NULL THROW 51442, N''Sinh viên không thuộc hợp đồng hiệu lực.'', 1;

        SELECT @NewTier = p.MaHangPhong, @Gender = p.LoaiPhong,
               @Capacity = hp.SucChuaToiDa, @RoomStatus = p.TrangThaiPhong
        FROM dbo.Phong p
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TenPhong = @PhongMoi;
        IF @NewTier IS NULL THROW 51443, N''Không tìm thấy phòng đích hoặc hạng phòng.'', 1;

        DECLARE @LockedRoom nvarchar(50);
        SELECT @LockedRoom = p.TenPhong
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.TenPhong IN (@OldRoom, @PhongMoi)
        ORDER BY p.TenPhong;

        SELECT @NewTier = p.MaHangPhong, @Gender = p.LoaiPhong,
               @Capacity = hp.SucChuaToiDa, @RoomStatus = p.TrangThaiPhong
        FROM dbo.Phong p
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TenPhong = @PhongMoi;
        SELECT @Count = COUNT(*)
        FROM dbo.HopDong hd
        INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
        WHERE hd.TenPhong = @PhongMoi
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND c.TrangThai = N''Đang ở'';
        IF @OldTier <> @NewTier
            THROW 51444, N''Không thể chuyển khác hạng phòng; cần xử lý tiền phòng đã đóng trước ở Bước 3.'', 1;
        IF @RoomStatus IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 51445, N''Phòng đích đang bảo trì hoặc ngưng sử dụng.'', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien AND GioiTinh = @Gender)
            THROW 51446, N''Giới tính sinh viên không phù hợp phòng đích.'', 1;
        IF @OldRoom <> @PhongMoi AND @Count >= @Capacity
            THROW 51447, N''Phòng đích đã đủ sức chứa.'', 1;

        SELECT TOP (1) @NewContract = MaHopDong
        FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE TenPhong = @PhongMoi AND TrangThaiHopDong = N''Còn hiệu lực''
        ORDER BY MaHopDong;
        IF @OldRoom = @PhongMoi
            THROW 51448, N''Sinh viên đã ở phòng này.'', 1;

        IF @NewContract IS NULL
        BEGIN
            SET @NewContract = N''HD'' + RIGHT(N''00000'' + CONVERT(nvarchar(10), NEXT VALUE FOR dbo.Seq_MaHopDong), 5);
            INSERT INTO dbo.HopDong
                (MaHopDong, TenPhong, MaHangPhong, NgayBatDau, NgayKetThuc,
                 TrangThaiHopDong, NgayTao, GhiChu, SoLanGiaHan)
            VALUES
                (@NewContract, @PhongMoi, @NewTier, CAST(GETDATE() AS date), @End,
                 N''Còn hiệu lực'', CAST(GETDATE() AS date), N''Chuyển phòng'', 0);
        END;

        IF @Representative = 1
            UPDATE dbo.ChiTietHopDong
            SET LaNguoiDaiDienThanhToanDichVu = 0
            WHERE MaHopDong = @OldContract AND MaChiTiet = @OldDetail;
        UPDATE dbo.ChiTietHopDong
        SET TrangThai = N''Đã chuyển phòng'', NgayRa = CAST(GETDATE() AS date),
            LyDoRoi = N''Chuyển phòng'', LaNguoiDaiDienThanhToanDichVu = 0
        WHERE MaChiTiet = @OldDetail;

        IF EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @NewContract AND TrangThai = N''Đang ở''
              AND LaNguoiDaiDienThanhToanDichVu = 1
        )
            SET @Representative = 0;
        ELSE
            SET @Representative = 1;

        INSERT INTO dbo.ChiTietHopDong
            (MaHopDong, MaSinhVien, NgayVao, KyHanThanhToanPhong, GiaPhongApDung,
             GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu, TrangThai, GhiChu)
        VALUES (@NewContract, @MaSinhVien, CAST(GETDATE() AS date), @Term, @Rate,
                @Monthly, COALESCE(@Representative, 0), N''Đang ở'', N''Chuyển phòng'');

        IF NOT EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @OldContract AND TrangThai = N''Đang ở''
              AND LaNguoiDaiDienThanhToanDichVu = 1
        )
        BEGIN
            DECLARE @Replacement int;
            SELECT TOP (1) @Replacement = MaChiTiet
            FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @OldContract AND TrangThai = N''Đang ở''
            ORDER BY NgayVao, MaChiTiet;
            IF @Replacement IS NOT NULL
                UPDATE dbo.ChiTietHopDong SET LaNguoiDaiDienThanhToanDichVu = 1
                WHERE MaChiTiet = @Replacement;
        END;
        DECLARE @LogDetails nvarchar(500);
        SET @LogDetails = N''Sinh viên '' + @MaSinhVien + N'' chuyển đến '' + @PhongMoi;
        EXEC dbo.sp_GhiNhatKyHopDong N''Chuyển phòng'', @OldContract,
             @LogDetails, @NguoiThucHien;
        COMMIT TRANSACTION;
        SELECT @NewContract AS MaHopDongMoi;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KiemTraChuanHoaDuLieu
    @ApDung bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @ApDung = 1
        EXEC dbo.sp_CapNhatHopDong;

    SELECT hd.MaHopDong, c.MaSinhVien, sv.HoTen, hd.TenPhong,
           hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
    FROM dbo.HopDong hd
    INNER JOIN dbo.ChiTietHopDong c
        ON c.MaHopDong = hd.MaHopDong AND c.TrangThai = N''Đang ở''
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
    WHERE hd.NgayKetThuc < CAST(GETDATE() AS date)
      AND hd.TrangThaiHopDong = N''Còn hiệu lực''
    ORDER BY hd.NgayKetThuc, c.MaSinhVien;

    SELECT sv.MaSinhVien, sv.HoTen, sv.TrangThaiSinhVien,
           sv.TenPhong AS PhongSinhVien, CAST(NULL AS nvarchar(20)) AS MaHopDong,
           CAST(NULL AS nvarchar(50)) AS PhongHopDong, CAST(NULL AS date) AS NgayKetThuc
    FROM dbo.SinhVien sv
    WHERE sv.TrangThaiSinhVien = N''Đang ở''
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.ChiTietHopDong c
          INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
          WHERE c.MaSinhVien = sv.MaSinhVien
            AND c.TrangThai = N''Đang ở''
            AND hd.TrangThaiHopDong = N''Còn hiệu lực''
      )
    ORDER BY sv.MaSinhVien;

    SELECT invoice.MaHoaDon, invoice.MaSinhVien, sv.HoTen, invoice.NgayLap,
           hd.MaHopDong, hd.NgayBatDau, invoice.TenPhong AS PhongHoaDon,
           hd.TenPhong AS PhongHopDong, sv.TenPhong AS PhongSinhVien
    FROM dbo.HoaDon invoice
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = invoice.MaSinhVien
    INNER JOIN dbo.ChiTietHopDong c ON c.MaSinhVien = invoice.MaSinhVien
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
    WHERE invoice.NgayLap < c.NgayVao
    ORDER BY invoice.NgayLap, invoice.MaHoaDon, c.NgayVao;

    SELECT invoice.MaHoaDon, invoice.MaSinhVien, sv.HoTen,
           invoice.TenPhong AS PhongHoaDon, sv.TenPhong AS PhongSinhVien, invoice.NgayLap
    FROM dbo.HoaDon invoice
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = invoice.MaSinhVien
    WHERE ISNULL(invoice.TenPhong, N'''') <> ISNULL(sv.TenPhong, N'''')
    ORDER BY invoice.NgayLap DESC, invoice.MaHoaDon;

    SELECT hd.MaHopDong, c.MaSinhVien, sv.HoTen,
           hd.TenPhong AS PhongHopDong, sv.TenPhong AS PhongSinhVien,
           hd.NgayBatDau, hd.NgayKetThuc
    FROM dbo.ChiTietHopDong c
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
    WHERE c.TrangThai = N''Đang ở''
      AND hd.TrangThaiHopDong = N''Còn hiệu lực''
      AND ISNULL(hd.TenPhong, N'''') <> ISNULL(sv.TenPhong, N'''')
    ORDER BY hd.NgayBatDau DESC, hd.MaHopDong, c.MaSinhVien;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_UpdateTrangThaiHopDong
ON dbo.HopDong
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID(N''dbo.TRG_UpdateTrangThaiHopDong'')) > 1
        RETURN;

    UPDATE c
    SET TrangThai = N''Đã rời'',
        NgayRa = CASE WHEN c.NgayVao > COALESCE(i.NgayKetThucThucTe, CAST(GETDATE() AS date))
                      THEN c.NgayVao ELSE COALESCE(i.NgayKetThucThucTe, CAST(GETDATE() AS date)) END,
        LyDoRoi = COALESCE(c.LyDoRoi, N''Kết thúc hợp đồng''),
        LaNguoiDaiDienThanhToanDichVu = 0
    FROM dbo.ChiTietHopDong c
    INNER JOIN inserted i ON i.MaHopDong = c.MaHopDong
    INNER JOIN deleted d ON d.MaHopDong = i.MaHopDong
    WHERE i.TrangThaiHopDong = N''Đã kết thúc''
      AND d.TrangThaiHopDong <> N''Đã kết thúc''
      AND c.TrangThai = N''Đang ở'';
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HopDong_BaoVePhong
ON dbo.HopDong
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(TenPhong) AND EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaHopDong = i.MaHopDong
        WHERE i.TenPhong <> d.TenPhong
    )
        THROW 51456, N''Không đổi phòng của hợp đồng đã tạo; dùng nghiệp vụ chuyển phòng.'', 1;

    IF UPDATE(MaHangPhong) AND EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaHopDong = i.MaHopDong
        WHERE i.MaHangPhong <> d.MaHangPhong
    )
        THROW 51457, N''Không đổi hạng snapshot của hợp đồng đã tạo.'', 1;

    DECLARE @RoomToLock nvarchar(50);
    DECLARE room_lock CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT TenPhong
        FROM inserted
        WHERE TrangThaiHopDong = N''Còn hiệu lực''
        ORDER BY TenPhong;
    OPEN room_lock;
    FETCH NEXT FROM room_lock INTO @RoomToLock;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @RoomToLock = p.TenPhong
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.TenPhong = @RoomToLock;
        FETCH NEXT FROM room_lock INTO @RoomToLock;
    END;
    CLOSE room_lock;
    DEALLOCATE room_lock;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON d.MaHopDong = i.MaHopDong
        WHERE i.TrangThaiHopDong = N''Còn hiệu lực''
          AND (d.MaHopDong IS NULL
               OR d.TrangThaiHopDong <> i.TrangThaiHopDong
               OR d.TenPhong <> i.TenPhong)
          AND (
              SELECT COUNT_BIG(*)
              FROM dbo.HopDong active
              WHERE active.TenPhong = i.TenPhong
                AND active.TrangThaiHopDong = N''Còn hiệu lực''
          ) > 1
    )
        THROW 51454, N''Phòng đã có hợp đồng hiệu lực; hãy thêm thành viên vào hợp đồng hiện có.'', 1;
END;
';

        IF OBJECT_ID(N'dbo.TRG_UpdatePhong', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdatePhong;
        EXEC sys.sp_executesql N'
CREATE TRIGGER dbo.TRG_UpdatePhong
ON dbo.ChiTietHopDong
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Rooms table (TenPhong nvarchar(50) PRIMARY KEY);
    DECLARE @Students table (MaSinhVien nvarchar(30) PRIMARY KEY);
    INSERT INTO @Rooms
    SELECT DISTINCT hd.TenPhong
    FROM (
        SELECT MaHopDong FROM inserted
        UNION
        SELECT MaHopDong FROM deleted
    ) x
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = x.MaHopDong;
    DECLARE @RoomToLock nvarchar(50);
    DECLARE room_lock CURSOR LOCAL FAST_FORWARD FOR
        SELECT TenPhong FROM @Rooms ORDER BY TenPhong;
    OPEN room_lock;
    FETCH NEXT FROM room_lock INTO @RoomToLock;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @RoomToLock = p.TenPhong
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.TenPhong = @RoomToLock;
        FETCH NEXT FROM room_lock INTO @RoomToLock;
    END;
    CLOSE room_lock;
    DEALLOCATE room_lock;

    INSERT INTO @Students
    SELECT MaSinhVien FROM inserted
    UNION
    SELECT MaSinhVien FROM deleted;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = i.MaHopDong
        INNER JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
        WHERE i.TrangThai = N''Đang ở''
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND NOT EXISTS (
              SELECT 1 FROM dbo.SinhVien sv
              WHERE sv.MaSinhVien = i.MaSinhVien AND sv.GioiTinh = p.LoaiPhong
          )
    )
        THROW 51450, N''Giới tính sinh viên không phù hợp phòng.'', 1;

    IF EXISTS (
        SELECT 1
        FROM @Rooms r
        INNER JOIN dbo.Phong p ON p.TenPhong = r.TenPhong
        CROSS APPLY (
            SELECT COUNT_BIG(*) AS SoNguoi
            FROM dbo.HopDong hd
            INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
            WHERE hd.TenPhong = r.TenPhong
              AND hd.TrangThaiHopDong = N''Còn hiệu lực''
              AND c.TrangThai = N''Đang ở''
        ) x
        WHERE x.SoNguoi > p.SucChuaToiDa
    )
        THROW 51451, N''Số thành viên đang ở vượt sức chứa phòng.'', 1;

    UPDATE hd
    SET TrangThaiHopDong = N''Đã kết thúc'',
        NgayKetThucThucTe = COALESCE(hd.NgayKetThucThucTe, CAST(GETDATE() AS date))
    FROM dbo.HopDong hd
    INNER JOIN (
        SELECT DISTINCT MaHopDong FROM inserted
        UNION
        SELECT DISTINCT MaHopDong FROM deleted
    ) c ON c.MaHopDong = hd.MaHopDong
    WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ChiTietHopDong active
          WHERE active.MaHopDong = hd.MaHopDong AND active.TrangThai = N''Đang ở''
      );

    UPDATE sv
    SET TenPhong = active.TenPhong,
        TrangThaiSinhVien = CASE WHEN active.MaSinhVien IS NULL THEN N''Đã rời KTX'' ELSE N''Đang ở'' END,
        NgayRoiKTX = CASE WHEN active.MaSinhVien IS NULL
                          THEN COALESCE(sv.NgayRoiKTX, CAST(GETDATE() AS date)) ELSE NULL END
    FROM dbo.SinhVien sv
    INNER JOIN @Students s ON s.MaSinhVien = sv.MaSinhVien
    OUTER APPLY (
        SELECT TOP (1) c.MaSinhVien, hd.TenPhong
        FROM dbo.ChiTietHopDong c
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaSinhVien = sv.MaSinhVien
          AND c.TrangThai = N''Đang ở''
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
        ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
    ) active
    WHERE EXISTS (
        SELECT sv.TenPhong, sv.TrangThaiSinhVien, sv.NgayRoiKTX
        EXCEPT
        SELECT active.TenPhong,
               CASE WHEN active.MaSinhVien IS NULL THEN N''Đã rời KTX'' ELSE N''Đang ở'' END,
               CASE WHEN active.MaSinhVien IS NULL
                    THEN COALESCE(sv.NgayRoiKTX, CAST(GETDATE() AS date)) ELSE NULL END
    );

    UPDATE p
    SET SoSinhVienHienTai = ISNULL(x.SoNguoi, 0),
        TrangThaiPhong = CASE
            WHEN p.TrangThaiPhong IN (N''Bảo trì'', N''Ngưng sử dụng'') THEN p.TrangThaiPhong
            WHEN ISNULL(x.SoNguoi, 0) >= p.SucChuaToiDa THEN N''Đầy'' ELSE N''Trống'' END
    FROM dbo.Phong p
    INNER JOIN @Rooms r ON r.TenPhong = p.TenPhong
    OUTER APPLY (
        SELECT COUNT_BIG(*) AS SoNguoi
        FROM dbo.HopDong hd
        INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
        WHERE hd.TenPhong = p.TenPhong
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND c.TrangThai = N''Đang ở''
    ) x
    WHERE ISNULL(p.SoSinhVienHienTai, -1) <> ISNULL(x.SoNguoi, 0)
       OR (p.TrangThaiPhong NOT IN (N''Bảo trì'', N''Ngưng sử dụng'')
           AND p.TrangThaiPhong <> CASE
               WHEN ISNULL(x.SoNguoi, 0) >= p.SucChuaToiDa THEN N''Đầy'' ELSE N''Trống'' END);
END;
';

        UPDATE sv
        SET TenPhong = active.TenPhong,
            TrangThaiSinhVien = CASE WHEN active.MaSinhVien IS NULL THEN N'Đã rời KTX' ELSE N'Đang ở' END,
            NgayRoiKTX = CASE WHEN active.MaSinhVien IS NULL
                              THEN COALESCE(sv.NgayRoiKTX, CAST(GETDATE() AS date)) ELSE NULL END
        FROM dbo.SinhVien sv
        OUTER APPLY (
            SELECT TOP (1) c.MaSinhVien, hd.TenPhong
            FROM dbo.ChiTietHopDong c
            INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
            WHERE c.MaSinhVien = sv.MaSinhVien
              AND c.TrangThai = N'Đang ở'
              AND hd.TrangThaiHopDong = N'Còn hiệu lực'
            ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
        ) active
        WHERE sv.TenPhong IS NOT NULL OR active.MaSinhVien IS NOT NULL;

        UPDATE p
        SET SoSinhVienHienTai = ISNULL(x.SoNguoi, 0),
            TrangThaiPhong = CASE
                WHEN p.TrangThaiPhong IN (N'Bảo trì', N'Ngưng sử dụng') THEN p.TrangThaiPhong
                WHEN ISNULL(x.SoNguoi, 0) >= p.SucChuaToiDa THEN N'Đầy' ELSE N'Trống' END
        FROM dbo.Phong p
        OUTER APPLY (
            SELECT COUNT_BIG(*) AS SoNguoi
            FROM dbo.HopDong hd
            INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
            WHERE hd.TenPhong = p.TenPhong
              AND hd.TrangThaiHopDong = N'Còn hiệu lực'
              AND c.TrangThai = N'Đang ở'
        ) x;

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_SinhVien_Insert
ON dbo.SinhVien
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted WHERE TenPhong IS NOT NULL OR TrangThaiSinhVien = N''Đang ở'')
        THROW 51452, N''Sinh viên phải được gán phòng qua hợp đồng và ChiTietHopDong.'', 1;

    INSERT INTO dbo.SinhVien
        (MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
         TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop, NgayRoiKTX, NgayTao)
    SELECT MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
           TrangThaiSinhVien, NULL, GhiChu, Truong, Lop, NgayRoiKTX, COALESCE(NgayTao, GETDATE())
    FROM inserted;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_ChiTietHopDongFE
AS
SELECT c.MaChiTiet, c.MaHopDong, c.MaSinhVien, sv.HoTen, hd.TenPhong, hd.MaHangPhong,
       c.NgayVao, c.NgayRa, c.KyHanThanhToanPhong, c.GiaPhongApDung,
       c.GiaPhongThangApDung, c.LaNguoiDaiDienThanhToanDichVu,
       c.TrangThai, c.GhiChu, c.LyDoRoi, c.NgayTao,
       hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
FROM dbo.ChiTietHopDong c
INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_LichSuHopDongFE
AS
SELECT CASE WHEN MaLichSu < 1000
            THEN N''LS'' + RIGHT(N''000'' + CAST(MaLichSu AS varchar(10)), 3)
            ELSE N''LS'' + CAST(MaLichSu AS varchar(10)) END AS MaLS,
       MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc,
       TrangThaiHopDong, ThaoTac, ThoiGian AS ThoiDiem
FROM dbo.LichSuHopDong_Backup;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_HopDongSapHetHan
AS
SELECT hd.MaHopDong, c.MaSinhVien, sv.HoTen, hd.TenPhong, hd.MaHangPhong,
       hd.NgayBatDau, hd.NgayKetThuc,
       DATEDIFF(day, CAST(GETDATE() AS date), hd.NgayKetThuc) AS SoNgayConLai,
       TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_ADMIN'')) AS NguongAdmin,
       TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_SV'')) AS NguongSinhVien
FROM dbo.HopDong hd
INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong AND c.TrangThai = N''Đang ở''
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
  AND hd.NgayKetThuc <= DATEADD(day,
      ISNULL(TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_ADMIN'')), 7),
      CAST(GETDATE() AS date));
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_SinhVienChiTiet
AS
SELECT sv.MaSinhVien, sv.HoTen, sv.NgaySinh, sv.GioiTinh, sv.SoDienThoai,
       sv.Email AS EmailTruong, sv.DiaChi, sv.Truong, sv.Lop, sv.GhiChu,
       sv.TrangThaiSinhVien, sv.TenPhong, sv.NgayRoiKTX, sv.NgayTao,
       p.Khu, p.LoaiPhong, p.SucChuaToiDa, p.TrangThaiPhong, p.MaHangPhong,
       c.MaHopDong, hd.NgayBatDau, hd.NgayKetThuc,
       hd.TrangThaiHopDong AS TrangThaiHopDongHienTai,
       tk.MaTaiKhoan, tk.Email AS EmailDangNhap, tk.VaiTro, tk.TrangThai AS TrangThaiTaiKhoan
FROM dbo.SinhVien sv
LEFT JOIN dbo.Phong p ON p.TenPhong = sv.TenPhong
LEFT JOIN dbo.ChiTietHopDong c ON c.MaSinhVien = sv.MaSinhVien AND c.TrangThai = N''Đang ở''
LEFT JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
LEFT JOIN dbo.TaiKhoan tk ON tk.MaSinhVien = sv.MaSinhVien;
';

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_Phong_TrangThai')
            CREATE INDEX IX_HopDong_Phong_TrangThai ON dbo.HopDong (TenPhong, TrangThaiHopDong);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_NgayKetThuc')
            CREATE INDEX IX_HopDong_NgayKetThuc ON dbo.HopDong (NgayKetThuc);

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_PhongCoNhieuHopDongHieuLuc
AS
SELECT TenPhong, COUNT_BIG(*) AS SoHopDongHieuLuc
FROM dbo.HopDong
WHERE TrangThaiHopDong = N''Còn hiệu lực''
GROUP BY TenPhong
HAVING COUNT_BIG(*) > 1;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'014', N'014_contract_members.sql');

        COMMIT TRANSACTION;
        PRINT N'[014] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

DROP TABLE #Migration014StartState;
-- END INLINE: db/migrations/014_contract_members.sql
GO
PRINT N'=== Migration 015 ==='
GO
-- BEGIN INLINE: db/migrations/015_invoice_types.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51500, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'014')
    THROW 51501, N'Chạy migration 014 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'015')
    PRINT N'[015] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF COL_LENGTH(N'dbo.HoaDon', N'LoaiHoaDon') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD LoaiHoaDon nvarchar(20) NULL;';

        EXEC sys.sp_executesql N'
            UPDATE dbo.HoaDon
            SET LoaiHoaDon = N''CU'';

            IF EXISTS (
                SELECT 1
                FROM dbo.HoaDon
                WHERE LoaiHoaDon NOT IN (N''TIEN_PHONG'', N''DICH_VU_PHONG'', N''CU'')
            )
                THROW 51502, N''Có loại hóa đơn ngoài danh sách cho phép; không thể thêm CHECK constraint.'', 1;

            IF NOT EXISTS (
                SELECT 1
                FROM sys.default_constraints dc
                INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
                WHERE dc.parent_object_id = OBJECT_ID(N''dbo.HoaDon'') AND c.name = N''LoaiHoaDon''
            )
                ALTER TABLE dbo.HoaDon ADD CONSTRAINT DF_HoaDon_LoaiHoaDon DEFAULT (N''CU'') FOR LoaiHoaDon;

            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE parent_object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''CK_HoaDon_LoaiHoaDon''
            )
                ALTER TABLE dbo.HoaDon WITH CHECK
                ADD CONSTRAINT CK_HoaDon_LoaiHoaDon
                CHECK (LoaiHoaDon IN (N''TIEN_PHONG'', N''DICH_VU_PHONG'', N''CU''));

            ALTER TABLE dbo.HoaDon ALTER COLUMN LoaiHoaDon nvarchar(20) NOT NULL;';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'015', N'015_invoice_types.sql');

        COMMIT TRANSACTION;
        PRINT N'[015] Hoàn tất. Hóa đơn cũ được giữ nguyên mã/tổng và gán LoaiHoaDon=CU.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
-- END INLINE: db/migrations/015_invoice_types.sql
GO
PRINT N'=== Migration 016 ==='
GO
-- BEGIN INLINE: db/migrations/016_invoice_periods_and_details.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51600, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'015')
    THROW 51601, N'Chạy migration 015 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'016')
    PRINT N'[016] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF COL_LENGTH(N'dbo.HoaDon', N'MaHopDong') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD MaHopDong nvarchar(20) NULL;';
        IF COL_LENGTH(N'dbo.HoaDon', N'MaChiTiet') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD MaChiTiet int NULL;';
        IF COL_LENGTH(N'dbo.HoaDon', N'KyThanhToan') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD KyThanhToan date NULL;';
        IF COL_LENGTH(N'dbo.HoaDon', N'KyThanhToanDen') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD KyThanhToanDen date NULL;';

        EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ALTER COLUMN MaSinhVien nvarchar(30) NULL;';

        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'MaDichVu') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.ChiTietHoaDon ADD MaDichVu nvarchar(20) NULL;';
        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'ChiSoCu') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.ChiTietHoaDon ADD ChiSoCu int NULL;';
        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'ChiSoMoi') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.ChiTietHoaDon ADD ChiSoMoi int NULL;';
        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'SoLuong') IS NULL
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.ChiTietHoaDon ADD SoLuong decimal(18,3) NOT NULL
                    CONSTRAINT DF_ChiTietHoaDon_SoLuong DEFAULT (1) WITH VALUES;';
        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'DonGia') IS NULL
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.ChiTietHoaDon ADD DonGia decimal(18,2) NOT NULL
                    CONSTRAINT DF_ChiTietHoaDon_DonGia DEFAULT (0) WITH VALUES;';

        EXEC sys.sp_executesql N'
            UPDATE dbo.ChiTietHoaDon
            SET DonGia = SoTien
            WHERE DonGia = 0 AND SoTien > 0;';

        DECLARE @ConstraintName sysname, @Sql nvarchar(max);
        DECLARE invoice_checks CURSOR LOCAL FAST_FORWARD FOR
            SELECT cc.name
            FROM sys.check_constraints cc
            WHERE cc.parent_object_id = OBJECT_ID(N'dbo.HoaDon')
              AND (cc.definition LIKE N'%LoaiHoaDon%'
                   OR cc.definition LIKE N'%TrangThaiThanhToan%'
                   OR cc.definition LIKE N'%KyThanhToan%');
        OPEN invoice_checks;
        FETCH NEXT FROM invoice_checks INTO @ConstraintName;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @Sql = N'ALTER TABLE dbo.HoaDon DROP CONSTRAINT ' + QUOTENAME(@ConstraintName) + N';';
            EXEC sys.sp_executesql @Sql;
            FETCH NEXT FROM invoice_checks INTO @ConstraintName;
        END;
        CLOSE invoice_checks;
        DEALLOCATE invoice_checks;

        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon
            WHERE LoaiHoaDon IS NULL
               OR LoaiHoaDon NOT IN (N'TIEN_PHONG', N'DICH_VU_PHONG', N'PHAT_SINH', N'CU')
        )
        BEGIN
            SELECT MaHoaDon, LoaiHoaDon
            FROM dbo.HoaDon
            WHERE LoaiHoaDon IS NULL
               OR LoaiHoaDon NOT IN (N'TIEN_PHONG', N'DICH_VU_PHONG', N'PHAT_SINH', N'CU');
            THROW 51602, N'Có loại hóa đơn không hợp lệ trước khi cập nhật CHECK.', 1;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon
            WHERE TrangThaiThanhToan IS NOT NULL
              AND TrangThaiThanhToan NOT IN
                  (N'Chưa thanh toán', N'Thanh toán một phần', N'Đã thanh toán', N'Đã hủy')
        )
        BEGIN
            SELECT MaHoaDon, TrangThaiThanhToan
            FROM dbo.HoaDon
            WHERE TrangThaiThanhToan IS NOT NULL
              AND TrangThaiThanhToan NOT IN
                  (N'Chưa thanh toán', N'Thanh toán một phần', N'Đã thanh toán', N'Đã hủy');
            THROW 51603, N'Có trạng thái hóa đơn không hợp lệ trước khi cập nhật CHECK.', 1;
        END;

        EXEC sys.sp_executesql N'
            IF EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''FK_HoaDon_HopDong''
            )
                ALTER TABLE dbo.HoaDon DROP CONSTRAINT FK_HoaDon_HopDong;
            IF EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''FK_HoaDon_ChiTietHopDong''
            )
                ALTER TABLE dbo.HoaDon DROP CONSTRAINT FK_HoaDon_ChiTietHopDong;

            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT FK_HoaDon_HopDong
                FOREIGN KEY (MaHopDong) REFERENCES dbo.HopDong(MaHopDong);
            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT FK_HoaDon_ChiTietHopDong
                FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHopDong(MaChiTiet);

            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT CK_HoaDon_LoaiHoaDon
                CHECK (LoaiHoaDon IN (N''TIEN_PHONG'', N''DICH_VU_PHONG'', N''PHAT_SINH'', N''CU''));
            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT CK_HoaDon_TrangThaiThanhToan
                CHECK (TrangThaiThanhToan IN
                    (N''Chưa thanh toán'', N''Thanh toán một phần'', N''Đã thanh toán'', N''Đã hủy''));
            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT CK_HoaDon_KyThanhToan
                CHECK (
                    (LoaiHoaDon = N''CU'')
                    OR (KyThanhToan IS NOT NULL AND KyThanhToanDen IS NOT NULL
                        AND KyThanhToanDen >= KyThanhToan)
                );';

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.ChiTietHoaDon'')
                  AND name = N''FK_ChiTietHoaDon_DichVu''
            )
                ALTER TABLE dbo.ChiTietHoaDon WITH CHECK
                    ADD CONSTRAINT FK_ChiTietHoaDon_DichVu
                    FOREIGN KEY (MaDichVu) REFERENCES dbo.DichVu(MaDichVu);

            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE parent_object_id = OBJECT_ID(N''dbo.ChiTietHoaDon'')
                  AND name = N''CK_ChiTietHoaDon_SoLuongDonGia''
            )
                ALTER TABLE dbo.ChiTietHoaDon WITH CHECK
                    ADD CONSTRAINT CK_ChiTietHoaDon_SoLuongDonGia
                    CHECK (SoLuong > 0 AND DonGia >= 0);

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''UX_HoaDon_TienPhong_ChiTiet_Ky''
            )
                CREATE UNIQUE INDEX UX_HoaDon_TienPhong_ChiTiet_Ky
                    ON dbo.HoaDon(MaChiTiet, KyThanhToan)
                    WHERE LoaiHoaDon = N''TIEN_PHONG''
                      AND TrangThaiThanhToan <> N''Đã hủy''
                      AND MaChiTiet IS NOT NULL AND KyThanhToan IS NOT NULL;

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''UX_HoaDon_DichVuPhong_HopDong_Ky''
            )
                CREATE UNIQUE INDEX UX_HoaDon_DichVuPhong_HopDong_Ky
                    ON dbo.HoaDon(MaHopDong, KyThanhToan)
                    WHERE LoaiHoaDon = N''DICH_VU_PHONG''
                      AND TrangThaiThanhToan <> N''Đã hủy''
                      AND MaHopDong IS NOT NULL AND KyThanhToan IS NOT NULL;';

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''IX_HoaDon_MaChiTiet_Ky''
            )
                CREATE INDEX IX_HoaDon_MaChiTiet_Ky
                    ON dbo.HoaDon(MaChiTiet, KyThanhToan, KyThanhToanDen)
                    INCLUDE (LoaiHoaDon, TrangThaiThanhToan, MaHoaDon);
            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''IX_HoaDon_MaHopDong_Ky''
            )
                CREATE INDEX IX_HoaDon_MaHopDong_Ky
                    ON dbo.HoaDon(MaHopDong, KyThanhToan, KyThanhToanDen)
                    INCLUDE (LoaiHoaDon, TrangThaiThanhToan, MaHoaDon);';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'016', N'016_invoice_periods_and_details.sql');

        COMMIT TRANSACTION;
        PRINT N'[016] Hoàn tất: loại hóa đơn, kỳ, liên kết hợp đồng/thành viên và snapshot chi tiết sẵn sàng.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- END INLINE: db/migrations/016_invoice_periods_and_details.sql
GO
PRINT N'=== Migration 017 ==='
GO
-- BEGIN INLINE: db/migrations/017_incident_costs.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51700, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'016')
    THROW 51701, N'Chạy migration 016 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'017')
    PRINT N'[017] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.ChiTietHoaDon')
              AND definition LIKE N'%MaKhoan%'
              AND definition NOT LIKE N'%INCIDENT%'
        )
        BEGIN
            SELECT name, definition
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.ChiTietHoaDon')
              AND definition LIKE N'%MaKhoan%'
              AND definition NOT LIKE N'%INCIDENT%';
            THROW 51704, N'CHECK hiện có trên MaKhoan chưa cho phép INCIDENT; cần điều chỉnh trước khi lập khoản phát sinh.', 1;
        END;

        EXEC sys.sp_executesql N'
            CREATE TABLE dbo.ChiPhiPhatSinh
            (
                MaChiPhi bigint IDENTITY(1,1) NOT NULL
                    CONSTRAINT PK_ChiPhiPhatSinh PRIMARY KEY,
                MaHopDong nvarchar(20) NOT NULL,
                MaChiTiet int NULL,
                NoiDung nvarchar(255) NOT NULL,
                SoTien decimal(18,2) NOT NULL,
                NgayPhatSinh date NOT NULL
                    CONSTRAINT DF_ChiPhiPhatSinh_NgayPhatSinh DEFAULT (CONVERT(date, GETDATE())),
                NguoiNhap int NOT NULL,
                TrangThai nvarchar(20) NOT NULL
                    CONSTRAINT DF_ChiPhiPhatSinh_TrangThai DEFAULT (N''Chưa lập hóa đơn''),
                MaChiTietHoaDon nvarchar(40) NULL,
                GhiChu nvarchar(255) NULL,
                NgayTao datetime NOT NULL
                    CONSTRAINT DF_ChiPhiPhatSinh_NgayTao DEFAULT (GETDATE()),
                CONSTRAINT FK_ChiPhiPhatSinh_HopDong
                    FOREIGN KEY (MaHopDong) REFERENCES dbo.HopDong(MaHopDong),
                CONSTRAINT FK_ChiPhiPhatSinh_ChiTiet
                    FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHopDong(MaChiTiet),
                CONSTRAINT FK_ChiPhiPhatSinh_NguoiNhap
                    FOREIGN KEY (NguoiNhap) REFERENCES dbo.TaiKhoan(MaTaiKhoan),
                CONSTRAINT FK_ChiPhiPhatSinh_ChiTietHoaDon
                    FOREIGN KEY (MaChiTietHoaDon) REFERENCES dbo.ChiTietHoaDon(MaChiTiet),
                CONSTRAINT CK_ChiPhiPhatSinh_SoTien CHECK (SoTien > 0),
                CONSTRAINT CK_ChiPhiPhatSinh_TrangThai
                    CHECK (TrangThai IN (N''Chưa lập hóa đơn'', N''Đã lập hóa đơn'', N''Đã hủy'')),
                CONSTRAINT CK_ChiPhiPhatSinh_LienKet
                    CHECK (
                        (TrangThai = N''Đã lập hóa đơn'' AND MaChiTietHoaDon IS NOT NULL)
                        OR (TrangThai <> N''Đã lập hóa đơn'' AND MaChiTietHoaDon IS NULL)
                    )
            );

            CREATE UNIQUE INDEX UX_ChiPhiPhatSinh_ChiTietHoaDon
                ON dbo.ChiPhiPhatSinh(MaChiTietHoaDon)
                WHERE MaChiTietHoaDon IS NOT NULL;

            CREATE INDEX IX_ChiPhiPhatSinh_HopDong_TrangThai
                ON dbo.ChiPhiPhatSinh(MaHopDong, TrangThai, NgayPhatSinh)
                INCLUDE (MaChiPhi, MaChiTiet, SoTien);';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiPhiPhatSinh_BaoVe
ON dbo.ChiPhiPhatSinh
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        LEFT JOIN inserted i ON i.MaChiPhi = d.MaChiPhi
        WHERE d.TrangThai = N''Đã lập hóa đơn''
          AND (i.MaChiPhi IS NULL
               OR ISNULL(i.MaChiTietHoaDon, N'''') <> d.MaChiTietHoaDon
               OR i.TrangThai <> N''Đã lập hóa đơn'')
    )
    BEGIN
        SELECT d.MaChiPhi, d.MaHopDong, d.MaChiTiet, d.TrangThai, d.MaChiTietHoaDon
        FROM deleted d
        LEFT JOIN inserted i ON i.MaChiPhi = d.MaChiPhi
        WHERE d.TrangThai = N''Đã lập hóa đơn''
          AND (i.MaChiPhi IS NULL
               OR ISNULL(i.MaChiTietHoaDon, N'''') <> d.MaChiTietHoaDon
               OR i.TrangThai <> N''Đã lập hóa đơn'');
        THROW 51702, N''Không được xóa, hủy hoặc tháo liên kết chi phí đã lập hóa đơn.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.ChiTietHoaDon c ON c.MaChiTiet = i.MaChiTietHoaDon
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = c.MaHoaDon
        WHERE i.TrangThai = N''Đã lập hóa đơn''
          AND (hd.LoaiHoaDon NOT IN (N''DICH_VU_PHONG'', N''PHAT_SINH'')
               OR hd.MaHopDong <> i.MaHopDong
               OR c.MaKhoan <> N''INCIDENT''
               OR c.SoTien <> i.SoTien)
    )
    BEGIN
        SELECT i.MaChiPhi, i.MaHopDong, i.MaChiTietHoaDon, c.MaHoaDon,
               hd.LoaiHoaDon, c.MaKhoan, c.SoTien AS TienDong, i.SoTien AS TienChiPhi
        FROM inserted i
        INNER JOIN dbo.ChiTietHoaDon c ON c.MaChiTiet = i.MaChiTietHoaDon
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = c.MaHoaDon
        WHERE i.TrangThai = N''Đã lập hóa đơn''
          AND (hd.LoaiHoaDon NOT IN (N''DICH_VU_PHONG'', N''PHAT_SINH'')
               OR hd.MaHopDong <> i.MaHopDong
               OR c.MaKhoan <> N''INCIDENT''
               OR c.SoTien <> i.SoTien);
        THROW 51703, N''Chi phí phát sinh chỉ được liên kết với đúng dòng INCIDENT trên hóa đơn dịch vụ/phát sinh cùng hợp đồng.'', 1;
    END;
END;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'017', N'017_incident_costs.sql');

        COMMIT TRANSACTION;
        PRINT N'[017] Hoàn tất: chi phí phát sinh được lưu và bảo vệ sau khi lập hóa đơn.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- END INLINE: db/migrations/017_incident_costs.sql
GO
PRINT N'=== Migration 018 ==='
GO
-- BEGIN INLINE: db/migrations/018_receipts_and_refunds.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51800, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'017')
    THROW 51801, N'Chạy migration 017 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'018')
    PRINT N'[018] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
            CREATE TABLE dbo.PhieuThu
            (
                MaPhieuThu bigint IDENTITY(1,1) NOT NULL
                    CONSTRAINT PK_PhieuThu PRIMARY KEY,
                MaHoaDon nvarchar(20) NOT NULL,
                MaGiaoDich nvarchar(60) NULL,
                SoTien decimal(18,2) NOT NULL,
                NgayThu datetime NOT NULL
                    CONSTRAINT DF_PhieuThu_NgayThu DEFAULT (GETDATE()),
                PhuongThuc nvarchar(20) NOT NULL,
                MaSinhVienNop nvarchar(30) NULL,
                NguoiThu int NULL,
                TrangThai nvarchar(20) NOT NULL
                    CONSTRAINT DF_PhieuThu_TrangThai DEFAULT (N''Hợp lệ''),
                MaThamChieu nvarchar(100) NULL,
                GhiChu nvarchar(255) NULL,
                NgayTao datetime NOT NULL
                    CONSTRAINT DF_PhieuThu_NgayTao DEFAULT (GETDATE()),
                CONSTRAINT FK_PhieuThu_HoaDon
                    FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon(MaHoaDon),
                CONSTRAINT FK_PhieuThu_GiaoDich
                    FOREIGN KEY (MaGiaoDich) REFERENCES dbo.GiaoDichThanhToan(MaGiaoDich),
                CONSTRAINT FK_PhieuThu_SinhVienNop
                    FOREIGN KEY (MaSinhVienNop) REFERENCES dbo.SinhVien(MaSinhVien),
                CONSTRAINT FK_PhieuThu_NguoiThu
                    FOREIGN KEY (NguoiThu) REFERENCES dbo.TaiKhoan(MaTaiKhoan),
                CONSTRAINT CK_PhieuThu_SoTien CHECK (SoTien > 0),
                CONSTRAINT CK_PhieuThu_PhuongThuc
                    CHECK (PhuongThuc IN (N''CASH'', N''ONLINE'', N''CHUYEN_DOI'')),
                CONSTRAINT CK_PhieuThu_TrangThai
                    CHECK (TrangThai IN (N''Hợp lệ'', N''Chờ xác nhận'', N''Đã hủy''))
            );

            CREATE UNIQUE INDEX UX_PhieuThu_GiaoDich_HoaDon
                ON dbo.PhieuThu(MaGiaoDich, MaHoaDon)
                WHERE MaGiaoDich IS NOT NULL;
            CREATE INDEX IX_PhieuThu_HoaDon_TrangThai_NgayThu
                ON dbo.PhieuThu(MaHoaDon, TrangThai, NgayThu)
                INCLUDE (SoTien, MaGiaoDich);

            CREATE TABLE dbo.PhieuChi
            (
                MaPhieuChi bigint IDENTITY(1,1) NOT NULL
                    CONSTRAINT PK_PhieuChi PRIMARY KEY,
                MaChiTiet int NOT NULL,
                SoTienDaDong decimal(18,2) NOT NULL,
                SoTienDaSuDung decimal(18,2) NOT NULL,
                KhauTru decimal(18,2) NOT NULL
                    CONSTRAINT DF_PhieuChi_KhauTru DEFAULT (0),
                SoTien decimal(18,2) NOT NULL,
                NgayRa date NOT NULL,
                LyDo nvarchar(30) NOT NULL,
                NgayChi datetime NOT NULL
                    CONSTRAINT DF_PhieuChi_NgayChi DEFAULT (GETDATE()),
                TrangThai nvarchar(20) NOT NULL
                    CONSTRAINT DF_PhieuChi_TrangThai DEFAULT (N''Chờ duyệt''),
                NguoiLap int NULL,
                GhiChu nvarchar(255) NULL,
                NgayTao datetime NOT NULL
                    CONSTRAINT DF_PhieuChi_NgayTao DEFAULT (GETDATE()),
                CONSTRAINT FK_PhieuChi_ChiTiet
                    FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHopDong(MaChiTiet),
                CONSTRAINT FK_PhieuChi_NguoiLap
                    FOREIGN KEY (NguoiLap) REFERENCES dbo.TaiKhoan(MaTaiKhoan),
                CONSTRAINT CK_PhieuChi_SoTien
                    CHECK (SoTien > 0 AND SoTienDaDong >= 0 AND SoTienDaSuDung >= 0 AND KhauTru >= 0),
                CONSTRAINT CK_PhieuChi_LyDo
                    CHECK (LyDo IN (N''Nghỉ học giữa chừng'', N''Chuyển đi'', N''Khác'')),
                CONSTRAINT CK_PhieuChi_TrangThai
                    CHECK (TrangThai IN (N''Hợp lệ'', N''Chờ duyệt'', N''Đã hủy''))
            );

            CREATE INDEX IX_PhieuChi_ChiTiet_TrangThai
                ON dbo.PhieuChi(MaChiTiet, TrangThai, NgayChi)
                INCLUDE (SoTien, SoTienDaDong, SoTienDaSuDung, KhauTru);

            CREATE TABLE dbo.PhieuChi_HoaDon
            (
                MaPhieuChi bigint NOT NULL,
                MaHoaDon nvarchar(20) NOT NULL,
                SoTien decimal(18,2) NOT NULL,
                CONSTRAINT PK_PhieuChi_HoaDon PRIMARY KEY (MaPhieuChi, MaHoaDon),
                CONSTRAINT FK_PhieuChi_HoaDon_PhieuChi
                    FOREIGN KEY (MaPhieuChi) REFERENCES dbo.PhieuChi(MaPhieuChi),
                CONSTRAINT FK_PhieuChi_HoaDon_HoaDon
                    FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon(MaHoaDon),
                CONSTRAINT CK_PhieuChi_HoaDon_SoTien CHECK (SoTien > 0)
            );
            CREATE INDEX IX_PhieuChi_HoaDon_HoaDon
                ON dbo.PhieuChi_HoaDon(MaHoaDon, MaPhieuChi)
                INCLUDE (SoTien);';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_PhieuThu_GiuTong
ON dbo.PhieuThu
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HoaDon TABLE (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT MaHoaDon FROM inserted
    UNION
    SELECT MaHoaDon FROM deleted;

    DECLARE @MaHoaDon nvarchar(20);
    DECLARE lock_invoice CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHoaDon FROM @HoaDon ORDER BY MaHoaDon;
    OPEN lock_invoice;
    FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    END;
    CLOSE lock_invoice;
    DEALLOCATE lock_invoice;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE r.DaThu > t.TongHoaDon
           OR (hd.TrangThaiThanhToan = N''Đã hủy'' AND r.DaThu > 0)
    )
    BEGIN
        SELECT hd.MaHoaDon, hd.TrangThaiThanhToan, t.TongHoaDon, r.DaThu
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE r.DaThu > t.TongHoaDon
           OR (hd.TrangThaiThanhToan = N''Đã hủy'' AND r.DaThu > 0);
        THROW 51802, N''Tổng phiếu thu hợp lệ vượt tổng hóa đơn hoặc hóa đơn đã hủy.'', 1;
    END;

    UPDATE hd
    SET TrangThaiThanhToan = CASE
            WHEN hd.TrangThaiThanhToan = N''Đã hủy'' THEN N''Đã hủy''
            WHEN r.DaThu = 0 THEN N''Chưa thanh toán''
            WHEN r.DaThu < t.TongHoaDon THEN N''Thanh toán một phần''
            ELSE N''Đã thanh toán''
        END,
        NgayThanhToan = CASE
            WHEN r.DaThu > 0 AND r.DaThu >= t.TongHoaDon THEN COALESCE(hd.NgayThanhToan, GETDATE())
            ELSE NULL
        END
    FROM dbo.HoaDon hd
    INNER JOIN @HoaDon x ON x.MaHoaDon = hd.MaHoaDon
    CROSS APPLY (
        SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
        FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
    ) t
    CROSS APPLY (
        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
        FROM dbo.PhieuThu pt
        WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
    ) r
    WHERE hd.TrangThaiThanhToan <> N''Đã hủy''
      AND (
          hd.TrangThaiThanhToan <> CASE
              WHEN r.DaThu = 0 THEN N''Chưa thanh toán''
              WHEN r.DaThu < t.TongHoaDon THEN N''Thanh toán một phần''
              ELSE N''Đã thanh toán'' END
          OR (r.DaThu > 0 AND r.DaThu >= t.TongHoaDon AND hd.NgayThanhToan IS NULL)
          OR (r.DaThu < t.TongHoaDon AND hd.NgayThanhToan IS NOT NULL)
      );
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HoaDon_BaoVePhieuThu
ON dbo.HoaDon
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = i.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = i.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE i.LoaiHoaDon <> N''CU''
          AND i.TrangThaiThanhToan <> N''Đã hủy''
          AND i.TrangThaiThanhToan <> CASE
              WHEN r.DaThu = 0 THEN N''Chưa thanh toán''
              WHEN r.DaThu < t.TongHoaDon THEN N''Thanh toán một phần''
              ELSE N''Đã thanh toán'' END
    )
    BEGIN
        SELECT i.MaHoaDon, i.TrangThaiThanhToan AS TrangThaiMoi,
               t.TongHoaDon, r.DaThu
        FROM inserted i
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = i.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = i.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE i.LoaiHoaDon <> N''CU''
          AND i.TrangThaiThanhToan <> N''Đã hủy''
          AND i.TrangThaiThanhToan <> CASE
              WHEN r.DaThu = 0 THEN N''Chưa thanh toán''
              WHEN r.DaThu < t.TongHoaDon THEN N''Thanh toán một phần''
              ELSE N''Đã thanh toán'' END;
        THROW 51810, N''Trạng thái hóa đơn mới phải được suy ra từ phiếu thu hợp lệ.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = i.MaHoaDon
        WHERE i.TrangThaiThanhToan = N''Đã hủy''
          AND d.TrangThaiThanhToan <> N''Đã hủy''
          AND pt.TrangThai = N''Hợp lệ''
    )
    BEGIN
        SELECT i.MaHoaDon, pt.MaPhieuThu, pt.SoTien, pt.TrangThai
        FROM inserted i
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = i.MaHoaDon
        WHERE i.TrangThaiThanhToan = N''Đã hủy''
          AND d.TrangThaiThanhToan <> N''Đã hủy''
          AND pt.TrangThai = N''Hợp lệ'';
        THROW 51803, N''Không thể hủy hóa đơn còn phiếu thu hợp lệ.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_GiuTongThu
ON dbo.ChiTietHoaDon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HoaDon TABLE (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT MaHoaDon FROM inserted
    UNION
    SELECT MaHoaDon FROM deleted;

    DECLARE @MaHoaDon nvarchar(20);
    DECLARE lock_invoice CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHoaDon FROM @HoaDon ORDER BY MaHoaDon;
    OPEN lock_invoice;
    FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    END;
    CLOSE lock_invoice;
    DEALLOCATE lock_invoice;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE r.DaThu > t.TongHoaDon
    )
    BEGIN
        SELECT hd.MaHoaDon, hd.LoaiHoaDon, t.TongHoaDon, r.DaThu
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE r.DaThu > t.TongHoaDon;
        THROW 51804, N''Không thể giảm/xóa chi tiết làm tổng hóa đơn thấp hơn số đã thu hợp lệ.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_PhieuChi_HoaDon
ON dbo.PhieuChi_HoaDon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HoaDon TABLE (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT MaHoaDon FROM inserted
    UNION
    SELECT MaHoaDon FROM deleted;

    DECLARE @MaHoaDon nvarchar(20);
    DECLARE lock_invoice CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHoaDon FROM @HoaDon ORDER BY MaHoaDon;
    OPEN lock_invoice;
    FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    END;
    CLOSE lock_invoice;
    DEALLOCATE lock_invoice;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaHoaDon = hd.MaHoaDon
        INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
        INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
        WHERE pc.TrangThai = N''Hợp lệ''
          AND (hd.LoaiHoaDon <> N''TIEN_PHONG'' OR hd.MaChiTiet <> pc.MaChiTiet)
    )
    BEGIN
        SELECT hd.MaHoaDon, hd.LoaiHoaDon, hd.MaChiTiet AS ChiTietHoaDon,
               pc.MaPhieuChi, pc.MaChiTiet AS ChiTietHoan, ph.SoTien
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaHoaDon = hd.MaHoaDon
        INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
        WHERE pc.TrangThai = N''Hợp lệ''
          AND (hd.LoaiHoaDon <> N''TIEN_PHONG'' OR hd.MaChiTiet <> pc.MaChiTiet);
        THROW 51805, N''Phiếu chi chỉ được phân bổ vào hóa đơn tiền phòng của đúng thành viên.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT pc.MaPhieuChi, pc.SoTien,
                   ISNULL(SUM(ph.SoTien), 0) AS DaPhanBo
            FROM dbo.PhieuChi pc
            INNER JOIN (
                SELECT MaPhieuChi FROM inserted
                UNION
                SELECT MaPhieuChi FROM deleted
            ) x ON x.MaPhieuChi = pc.MaPhieuChi
            LEFT JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = pc.MaPhieuChi
            WHERE pc.TrangThai = N''Hợp lệ''
            GROUP BY pc.MaPhieuChi, pc.SoTien
        ) x
        WHERE x.DaPhanBo <> x.SoTien
    )
    BEGIN
        SELECT pc.MaPhieuChi, pc.SoTien, ISNULL(SUM(ph.SoTien), 0) AS DaPhanBo
        FROM dbo.PhieuChi pc
        INNER JOIN (
            SELECT MaPhieuChi FROM inserted
            UNION
            SELECT MaPhieuChi FROM deleted
        ) x ON x.MaPhieuChi = pc.MaPhieuChi
        LEFT JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = pc.MaPhieuChi
        WHERE pc.TrangThai = N''Hợp lệ''
        GROUP BY pc.MaPhieuChi, pc.SoTien
        HAVING ISNULL(SUM(ph.SoTien), 0) <> pc.SoTien;
        THROW 51806, N''Tổng phân bổ hóa đơn phải bằng tổng phiếu chi hợp lệ.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        CROSS APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) c
        WHERE c.DaChi > r.DaThu
    )
    BEGIN
        SELECT hd.MaHoaDon, r.DaThu, c.DaChi
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        CROSS APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) c
        WHERE c.DaChi > r.DaThu;
        THROW 51807, N''Tổng phiếu chi hợp lệ vượt tổng phiếu thu hợp lệ của hóa đơn.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_PhieuChi_BaoVe
ON dbo.PhieuChi
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HoaDon table (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT ph.MaHoaDon
    FROM dbo.PhieuChi_HoaDon ph
    INNER JOIN (
        SELECT MaPhieuChi FROM inserted
        UNION
        SELECT MaPhieuChi FROM deleted
    ) x ON x.MaPhieuChi = ph.MaPhieuChi;

    DECLARE @MaHoaDon nvarchar(20);
    DECLARE lock_invoice CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHoaDon FROM @HoaDon ORDER BY MaHoaDon;
    OPEN lock_invoice;
    FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    END;
    CLOSE lock_invoice;
    DEALLOCATE lock_invoice;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        OUTER APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaPhanBo
            FROM dbo.PhieuChi_HoaDon ph WHERE ph.MaPhieuChi = i.MaPhieuChi
        ) a
        WHERE i.TrangThai = N''Hợp lệ'' AND a.DaPhanBo <> i.SoTien
    )
    BEGIN
        SELECT i.MaPhieuChi, i.SoTien, a.DaPhanBo
        FROM inserted i
        OUTER APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaPhanBo
            FROM dbo.PhieuChi_HoaDon ph WHERE ph.MaPhieuChi = i.MaPhieuChi
        ) a
        WHERE i.TrangThai = N''Hợp lệ'' AND a.DaPhanBo <> i.SoTien;
        THROW 51808, N''Phiếu chi hợp lệ phải có phân bổ bằng đúng tổng số tiền.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = i.MaPhieuChi
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = ph.MaHoaDon
        WHERE i.TrangThai = N''Hợp lệ''
          AND (hd.LoaiHoaDon <> N''TIEN_PHONG'' OR hd.MaChiTiet <> i.MaChiTiet)
    )
    BEGIN
        SELECT i.MaPhieuChi, i.MaChiTiet, hd.MaHoaDon, hd.LoaiHoaDon, hd.MaChiTiet AS MaChiTietHoaDon
        FROM inserted i
        INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = i.MaPhieuChi
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = ph.MaHoaDon
        WHERE i.TrangThai = N''Hợp lệ''
          AND (hd.LoaiHoaDon <> N''TIEN_PHONG'' OR hd.MaChiTiet <> i.MaChiTiet);
        THROW 51809, N''Phiếu chi hợp lệ chỉ được dùng cho hóa đơn tiền phòng cùng thành viên.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        CROSS APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) c
        WHERE c.DaChi > r.DaThu
    )
    BEGIN
        SELECT hd.MaHoaDon, r.DaThu, c.DaChi
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        CROSS APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) c
        WHERE c.DaChi > r.DaThu;
        THROW 51811, N''Tổng phiếu chi hợp lệ vượt tổng phiếu thu hợp lệ của hóa đơn.'', 1;
    END;
END;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'018', N'018_receipts_and_refunds.sql');

        COMMIT TRANSACTION;
        PRINT N'[018] Hoàn tất: phiếu thu, phiếu chi và phân bổ đã sẵn sàng.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- END INLINE: db/migrations/018_receipts_and_refunds.sql
GO
PRINT N'=== Migration 019 ==='
GO
-- BEGIN INLINE: db/migrations/019_payment_workflows.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51900, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'018')
    THROW 51901, N'Chạy migration 018 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'019')
    PRINT N'[019] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.ChiTietGiaoDich', N'U') IS NOT NULL
        BEGIN
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.GiaoDichThanhToan gd
                    LEFT JOIN (
                        SELECT MaGiaoDich, SUM(SoTien) AS DaPhanBo
                        FROM dbo.ChiTietGiaoDich
                        GROUP BY MaGiaoDich
                    ) a ON a.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.TrangThai = N''SUCCESS''
                      AND ISNULL(a.DaPhanBo, 0) <> gd.TongTien
                )
                BEGIN
                    SELECT gd.MaGiaoDich, gd.TongTien, ISNULL(a.DaPhanBo, 0) AS DaPhanBo,
                           gd.TrangThai
                    FROM dbo.GiaoDichThanhToan gd
                    LEFT JOIN (
                        SELECT MaGiaoDich, SUM(SoTien) AS DaPhanBo
                        FROM dbo.ChiTietGiaoDich
                        GROUP BY MaGiaoDich
                    ) a ON a.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.TrangThai = N''SUCCESS''
                      AND ISNULL(a.DaPhanBo, 0) <> gd.TongTien;
                    THROW 51902, N''Tổng phân bổ ChiTietGiaoDich không khớp giao dịch SUCCESS.'', 1;
                END;

                IF EXISTS (
                    SELECT 1
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY chi.MaChiTiet, chi.SoTien
                    HAVING SUM(cgd.SoTien) > chi.SoTien
                )
                BEGIN
                    SELECT chi.MaChiTiet, chi.MaHoaDon, chi.SoTien AS TienDong,
                           SUM(cgd.SoTien) AS DaThuThanhCong
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY chi.MaChiTiet, chi.MaHoaDon, chi.SoTien
                    HAVING SUM(cgd.SoTien) > chi.SoTien;
                    THROW 51903, N''Phân bổ SUCCESS vượt số tiền của chi tiết hóa đơn.'', 1;
                END;

                IF EXISTS (
                    SELECT 1
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY chi.MaHoaDon
                    HAVING SUM(cgd.SoTien) > (
                        SELECT SUM(all_lines.SoTien)
                        FROM dbo.ChiTietHoaDon all_lines
                        WHERE all_lines.MaHoaDon = chi.MaHoaDon
                    )
                )
                BEGIN
                    SELECT chi.MaHoaDon, SUM(cgd.SoTien) AS DaThuThanhCong,
                           (SELECT SUM(all_lines.SoTien)
                            FROM dbo.ChiTietHoaDon all_lines
                            WHERE all_lines.MaHoaDon = chi.MaHoaDon) AS TongHoaDon
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY chi.MaHoaDon
                    HAVING SUM(cgd.SoTien) > (
                        SELECT SUM(all_lines.SoTien)
                        FROM dbo.ChiTietHoaDon all_lines
                        WHERE all_lines.MaHoaDon = chi.MaHoaDon
                    );
                    THROW 51904, N''Tổng SUCCESS phân bổ vượt tổng hóa đơn.'', 1;
                END;';

            EXEC sys.sp_executesql N'
                INSERT INTO dbo.PhieuThu
                    (MaHoaDon, MaGiaoDich, SoTien, NgayThu, PhuongThuc,
                     MaSinhVienNop, NguoiThu, TrangThai, MaThamChieu, GhiChu)
                SELECT chi.MaHoaDon, gd.MaGiaoDich, SUM(cgd.SoTien),
                       COALESCE(gd.NgayThanhToan, gd.NgayTao),
                       CASE WHEN gd.PhuongThuc = N''CASH'' THEN N''CASH'' ELSE N''ONLINE'' END,
                       CONVERT(nvarchar(30), gd.MaSinhVien), gd.XacNhanBoi,
                       N''Hợp lệ'', gd.MaThamChieuNgoai,
                       N''Chuyển đổi từ giao dịch SUCCESS cũ''
                FROM dbo.ChiTietGiaoDich cgd
                INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                WHERE gd.TrangThai = N''SUCCESS''
                GROUP BY chi.MaHoaDon, gd.MaGiaoDich, gd.NgayThanhToan, gd.NgayTao,
                         gd.PhuongThuc, gd.MaSinhVien, gd.XacNhanBoi, gd.MaThamChieuNgoai;';

            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT gd.MaGiaoDich, chi.MaHoaDon
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY gd.MaGiaoDich, chi.MaHoaDon
                    HAVING SUM(cgd.SoTien) <> (
                        SELECT SUM(pt.SoTien)
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaGiaoDich = gd.MaGiaoDich
                          AND pt.MaHoaDon = chi.MaHoaDon
                          AND pt.TrangThai = N''Hợp lệ''
                    )
                )
                BEGIN
                    SELECT gd.MaGiaoDich, chi.MaHoaDon,
                           SUM(cgd.SoTien) AS TongNguon,
                           (SELECT SUM(pt.SoTien)
                            FROM dbo.PhieuThu pt
                            WHERE pt.MaGiaoDich = gd.MaGiaoDich
                              AND pt.MaHoaDon = chi.MaHoaDon
                              AND pt.TrangThai = N''Hợp lệ'') AS TongPhieuThu
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY gd.MaGiaoDich, chi.MaHoaDon
                    HAVING SUM(cgd.SoTien) <> (
                        SELECT SUM(pt.SoTien)
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaGiaoDich = gd.MaGiaoDich
                          AND pt.MaHoaDon = chi.MaHoaDon
                          AND pt.TrangThai = N''Hợp lệ''
                    );
                    THROW 51907, N''Đối chiếu ChiTietGiaoDich và PhieuThu không khớp; không được bỏ bảng nguồn.'', 1;
                END;';

            EXEC sys.sp_executesql N'
                INSERT INTO dbo.PhieuThu
                    (MaHoaDon, SoTien, NgayThu, PhuongThuc, MaSinhVienNop,
                     TrangThai, GhiChu)
                SELECT chi.MaHoaDon, SUM(chi.SoTien - ISNULL(success_paid.DaThu, 0)),
                       COALESCE(MAX(chi.NgayThanhToan), MAX(hd.NgayLap), GETDATE()),
                       N''CHUYEN_DOI'', CONVERT(nvarchar(30), MAX(hd.MaSinhVien)),
                       N''Hợp lệ'', N''Chuyển đổi từ dữ liệu cũ''
                FROM dbo.ChiTietHoaDon chi
                INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
                LEFT JOIN (
                    SELECT cgd.MaChiTiet, SUM(cgd.SoTien) AS DaThu
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY cgd.MaChiTiet
                ) success_paid ON success_paid.MaChiTiet = chi.MaChiTiet
                WHERE chi.TrangThai = N''Đã thanh toán''
                  AND chi.SoTien > ISNULL(success_paid.DaThu, 0)
                GROUP BY chi.MaHoaDon;';

            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.ChiTietHoaDon chi
                    CROSS APPLY (
                        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = chi.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
                    ) r
                    CROSS APPLY (
                        SELECT ISNULL(SUM(all_lines.SoTien), 0) AS TongHoaDon
                        FROM dbo.ChiTietHoaDon all_lines
                        WHERE all_lines.MaHoaDon = chi.MaHoaDon
                    ) t
                    WHERE chi.TrangThai = N''Đã thanh toán''
                    GROUP BY chi.MaHoaDon, r.DaThu, t.TongHoaDon
                    HAVING r.DaThu > t.TongHoaDon
                )
                BEGIN
                    SELECT chi.MaHoaDon,
                           SUM(CASE WHEN chi.TrangThai = N''Đã thanh toán'' THEN chi.SoTien ELSE 0 END)
                               AS TongChiTietDaThanhToan,
                           MAX(r.DaThu) AS TongPhieuThu,
                           MAX(t.TongHoaDon) AS TongHoaDon
                    FROM dbo.ChiTietHoaDon chi
                    CROSS APPLY (
                        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = chi.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
                    ) r
                    CROSS APPLY (
                        SELECT ISNULL(SUM(all_lines.SoTien), 0) AS TongHoaDon
                        FROM dbo.ChiTietHoaDon all_lines
                        WHERE all_lines.MaHoaDon = chi.MaHoaDon
                    ) t
                    WHERE chi.TrangThai = N''Đã thanh toán''
                    GROUP BY chi.MaHoaDon
                    HAVING MAX(r.DaThu) > MAX(t.TongHoaDon);
                    THROW 51905, N''Số phiếu thu chuyển đổi vượt tổng hóa đơn.'', 1;
                END;';
        END;

        IF OBJECT_ID(N'dbo.TRG_ChiTietGiaoDich_MotSuccess', N'TR') IS NOT NULL
            EXEC sys.sp_executesql N'DROP TRIGGER dbo.TRG_ChiTietGiaoDich_MotSuccess;';
        IF OBJECT_ID(N'dbo.TRG_GiaoDich_MotSuccess', N'TR') IS NOT NULL
            EXEC sys.sp_executesql N'DROP TRIGGER dbo.TRG_GiaoDich_MotSuccess;';
        IF OBJECT_ID(N'dbo.ChiTietGiaoDich', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'DROP TABLE dbo.ChiTietGiaoDich;';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HoaDon_DongBoChiTiet
ON dbo.HoaDon
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID(N''dbo.TRG_HoaDon_DongBoChiTiet'')) > 1 RETURN;

    DECLARE @HasAmount bit = CASE
        WHEN UPDATE(TienPhong) OR UPDATE(TienDien) OR UPDATE(TienNuoc) THEN 1 ELSE 0 END;
    DECLARE @HasStatus bit = CASE WHEN UPDATE(TrangThaiThanhToan) THEN 1 ELSE 0 END;

    IF @HasAmount = 1
    BEGIN
        MERGE dbo.ChiTietHoaDon AS target
        USING (
            SELECT i.MaHoaDon, x.MaKhoan, x.TenKhoan, x.SoTien, x.ThuTu
            FROM inserted i
            CROSS APPLY (VALUES
                (N''ROOM'', N''Tiền phòng'', ISNULL(i.TienPhong, 0), 1),
                (N''ELECTRICITY'', N''Tiền điện'', ISNULL(i.TienDien, 0), 2),
                (N''WATER'', N''Tiền nước'', ISNULL(i.TienNuoc, 0), 3)
            ) x(MaKhoan, TenKhoan, SoTien, ThuTu)
            WHERE i.LoaiHoaDon = N''CU'' AND x.SoTien > 0
        ) AS source
        ON target.MaHoaDon = source.MaHoaDon
           AND target.MaKhoan = source.MaKhoan AND target.TenKhoan = source.TenKhoan
        WHEN MATCHED AND target.TrangThai = N''Chưa thanh toán''
                        AND target.SoTien <> source.SoTien
            THEN UPDATE SET SoTien = source.SoTien, DonGia = source.SoTien, ThuTu = source.ThuTu
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, DonGia, TrangThai, ThuTu)
            VALUES (LEFT(source.MaHoaDon, 32) + N''-'' + RIGHT(CONVERT(nvarchar(36), NEWID()), 7),
                    source.MaHoaDon, source.MaKhoan, source.TenKhoan, source.SoTien,
                    source.SoTien, N''Chưa thanh toán'', source.ThuTu);
    END;

    IF @HasStatus = 1
        UPDATE c
        SET TrangThai = N''Đã thanh toán'',
            NgayThanhToan = ISNULL(c.NgayThanhToan, GETDATE())
        FROM dbo.ChiTietHoaDon c
        INNER JOIN inserted i ON i.MaHoaDon = c.MaHoaDon
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        WHERE i.LoaiHoaDon = N''CU''
          AND i.TrangThaiThanhToan = N''Đã thanh toán''
          AND d.TrangThaiThanhToan <> N''Đã thanh toán''
          AND c.TrangThai <> N''Đã thanh toán'';
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_DongBoHoaDon
ON dbo.ChiTietHoaDon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID(N''dbo.TRG_ChiTietHoaDon_DongBoHoaDon'')) > 1 RETURN;

    DECLARE @HoaDon table (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT MaHoaDon FROM inserted
    UNION
    SELECT MaHoaDon FROM deleted;

    UPDATE hd
    SET TrangThaiThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                 SELECT 1 FROM dbo.ChiTietHoaDon c
                 WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
             ) THEN N''Đã thanh toán''
            ELSE N''Chưa thanh toán''
        END,
        NgayThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                 SELECT 1 FROM dbo.ChiTietHoaDon c
                 WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
             ) THEN ISNULL(hd.NgayThanhToan, GETDATE())
            ELSE NULL
        END
    FROM dbo.HoaDon hd
    INNER JOIN @HoaDon x ON x.MaHoaDon = hd.MaHoaDon
    WHERE hd.LoaiHoaDon = N''CU''
      AND (
          hd.TrangThaiThanhToan <> CASE
              WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
               AND NOT EXISTS (
                   SELECT 1 FROM dbo.ChiTietHoaDon c
                   WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
               ) THEN N''Đã thanh toán'' ELSE N''Chưa thanh toán'' END
          OR (hd.TrangThaiThanhToan = N''Đã thanh toán'' AND hd.NgayThanhToan IS NULL)
      );
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
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = d.MaHoaDon
        LEFT JOIN inserted i ON i.MaChiTiet = d.MaChiTiet
        WHERE hd.LoaiHoaDon = N''CU''
          AND d.TrangThai = N''Đã thanh toán''
          AND (i.MaChiTiet IS NULL OR i.SoTien <> d.SoTien)
    )
    BEGIN
        SELECT d.MaChiTiet, d.MaHoaDon, d.SoTien, d.TrangThai
        FROM deleted d
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = d.MaHoaDon
        LEFT JOIN inserted i ON i.MaChiTiet = d.MaChiTiet
        WHERE hd.LoaiHoaDon = N''CU''
          AND d.TrangThai = N''Đã thanh toán''
          AND (i.MaChiTiet IS NULL OR i.SoTien <> d.SoTien);
        THROW 51906, N''Không được xóa hoặc đổi số tiền của hạng mục CU đã thanh toán.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_GiaoDich_DongBoPhieuThu
ON dbo.GiaoDichThanhToan
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE pt
    SET TrangThai = N''Đã hủy''
    FROM dbo.PhieuThu pt
    INNER JOIN inserted i ON i.MaGiaoDich = pt.MaGiaoDich
    INNER JOIN deleted d ON d.MaGiaoDich = i.MaGiaoDich
    WHERE i.TrangThai IN (N''REJECTED'', N''EXPIRED'')
      AND d.TrangThai <> i.TrangThai
      AND pt.TrangThai <> N''Đã hủy'';
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_B3_TaoMaHoaDon
    @Ngay date,
    @MaHoaDon nvarchar(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ky char(6) = CONVERT(char(6), @Ngay, 112), @SoCuoi int;
    SELECT @SoCuoi = SoCuoi
    FROM dbo.MaHoaDonCounter WITH (UPDLOCK, HOLDLOCK)
    WHERE Ky = @Ky;
    IF @SoCuoi IS NULL
    BEGIN
        SET @SoCuoi = 1;
        INSERT INTO dbo.MaHoaDonCounter(Ky, SoCuoi) VALUES (@Ky, @SoCuoi);
    END
    ELSE
    BEGIN
        IF @SoCuoi >= 9999
        BEGIN
            SELECT @Ky AS Ky, @SoCuoi AS SoCuoi;
            THROW 51910, N''Đã hết dải mã hóa đơn trong tháng.'', 1;
        END;
        SET @SoCuoi += 1;
        UPDATE dbo.MaHoaDonCounter SET SoCuoi = @SoCuoi WHERE Ky = @Ky;
    END;
    SET @MaHoaDon = N''INV'' + @Ky + RIGHT(N''0000'' + CONVERT(nvarchar(4), @SoCuoi), 4);
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GhiPhieuThu
    @MaHoaDon nvarchar(20),
    @SoTien decimal(18,2),
    @PhuongThuc nvarchar(20),
    @MaSinhVienNop nvarchar(30) = NULL,
    @NguoiThu int = NULL,
    @TrangThai nvarchar(20) = N''Hợp lệ'',
    @MaGiaoDich nvarchar(60) = NULL,
    @MaThamChieu nvarchar(100) = NULL,
    @GhiChu nvarchar(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @TongHoaDon decimal(18,2), @DaThu decimal(18,2), @HoaDonStatus nvarchar(30);
        SELECT @HoaDonStatus = hd.TrangThaiThanhToan
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        IF @HoaDonStatus IS NULL
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 51911, N''Không tìm thấy hóa đơn.'', 1;
        END;
        IF @SoTien <= 0
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @SoTien AS SoTien;
            THROW 51912, N''Số tiền phiếu thu phải lớn hơn 0.'', 1;
        END;
        IF @PhuongThuc NOT IN (N''CASH'', N''ONLINE'', N''CHUYEN_DOI'')
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @PhuongThuc AS PhuongThuc;
            THROW 51913, N''Phương thức thu không hợp lệ.'', 1;
        END;
        IF @TrangThai NOT IN (N''Hợp lệ'', N''Chờ xác nhận'', N''Đã hủy'')
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @TrangThai AS TrangThai;
            THROW 51914, N''Trạng thái phiếu thu không hợp lệ.'', 1;
        END;
        IF @HoaDonStatus = N''Đã hủy'' AND @TrangThai = N''Hợp lệ''
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @HoaDonStatus AS TrangThaiHoaDon;
            THROW 51915, N''Không thể thu tiền cho hóa đơn đã hủy.'', 1;
        END;

        SELECT @TongHoaDon = ISNULL(SUM(SoTien), 0)
        FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @MaHoaDon;
        SELECT @DaThu = ISNULL(SUM(SoTien), 0)
        FROM dbo.PhieuThu
        WHERE MaHoaDon = @MaHoaDon AND TrangThai = N''Hợp lệ'';
        IF @TrangThai = N''Hợp lệ'' AND @DaThu + @SoTien > @TongHoaDon
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @TongHoaDon AS TongHoaDon,
                   @DaThu AS DaThu, @SoTien AS SoTienMoi;
            THROW 51916, N''Phiếu thu làm tổng thu vượt tổng hóa đơn.'', 1;
        END;

        INSERT INTO dbo.PhieuThu
            (MaHoaDon, MaGiaoDich, SoTien, PhuongThuc, MaSinhVienNop,
             NguoiThu, TrangThai, MaThamChieu, GhiChu)
        VALUES
            (@MaHoaDon, @MaGiaoDich, @SoTien, @PhuongThuc, @MaSinhVienNop,
             @NguoiThu, @TrangThai, @MaThamChieu, @GhiChu);
        DECLARE @MaPhieuThu bigint = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT @MaPhieuThu AS MaPhieuThu;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_DongBoTrangThaiHoaDon
    @MaHoaDon nvarchar(20)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TongHoaDon decimal(18,2), @DaThu decimal(18,2);
    SELECT @TongHoaDon = ISNULL(SUM(c.SoTien), 0)
    FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = @MaHoaDon;
    SELECT @DaThu = ISNULL(SUM(pt.SoTien), 0)
    FROM dbo.PhieuThu pt WHERE pt.MaHoaDon = @MaHoaDon AND pt.TrangThai = N''Hợp lệ'';
    UPDATE dbo.HoaDon
    SET TrangThaiThanhToan = CASE
            WHEN TrangThaiThanhToan = N''Đã hủy'' THEN N''Đã hủy''
            WHEN @DaThu = 0 THEN N''Chưa thanh toán''
            WHEN @DaThu < @TongHoaDon THEN N''Thanh toán một phần''
            ELSE N''Đã thanh toán''
        END,
        NgayThanhToan = CASE WHEN @DaThu >= @TongHoaDon AND @DaThu > 0
                             THEN COALESCE(NgayThanhToan, GETDATE()) ELSE NULL END
    WHERE MaHoaDon = @MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDonTienPhong
    @MaChiTiet int,
    @KyThanhToan date,
    @MaHoaDon nvarchar(20) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @MaHopDong nvarchar(20), @MaSinhVien nvarchar(30), @TenPhong nvarchar(50),
                @KyHan nvarchar(10), @Gia decimal(18,2), @ThangGia decimal(18,2),
                @Den date, @Ngay date = CAST(GETDATE() AS date), @Han date;
        SELECT @MaHopDong = hd.MaHopDong, @MaSinhVien = c.MaSinhVien, @TenPhong = hd.TenPhong,
               @KyHan = c.KyHanThanhToanPhong, @Gia = c.GiaPhongApDung,
               @ThangGia = c.GiaPhongThangApDung
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaChiTiet = @MaChiTiet AND c.TrangThai = N''Đang ở''
          AND hd.TrangThaiHopDong = N''Còn hiệu lực'';
        IF @MaHopDong IS NULL
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet;
            THROW 51920, N''Không tìm thấy thành viên hợp đồng đang ở.'', 1;
        END;
        IF @KyThanhToan IS NULL
           OR @KyThanhToan <> DATEFROMPARTS(YEAR(@KyThanhToan), MONTH(@KyThanhToan), 1)
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @KyThanhToan AS KyThanhToan;
            THROW 51921, N''Kỳ thanh toán tiền phòng phải là ngày đầu tháng.'', 1;
        END;
        IF @KyHan = N''NAM''
        BEGIN
            SET @Den = EOMONTH(DATEADD(month, 11, @KyThanhToan));
            SET @Gia = @Gia;
        END
        ELSE
        BEGIN
            SET @Den = EOMONTH(@KyThanhToan);
            SET @Gia = @ThangGia;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE LoaiHoaDon = N''TIEN_PHONG''
              AND MaChiTiet = @MaChiTiet
              AND TrangThaiThanhToan <> N''Đã hủy''
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan
        )
        BEGIN
            SELECT MaHoaDon, MaChiTiet, KyThanhToan, KyThanhToanDen,
                   TrangThaiThanhToan
            FROM dbo.HoaDon
            WHERE LoaiHoaDon = N''TIEN_PHONG''
              AND MaChiTiet = @MaChiTiet
              AND TrangThaiThanhToan <> N''Đã hủy''
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan;
            THROW 51922, N''Kỳ tiền phòng bị trùng hoặc chồng với hóa đơn đang hoạt động.'', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon)
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 51923, N''Mã hóa đơn đã tồn tại.'', 1;
        END;
        SELECT @Han = DATEADD(day, ISNULL(TRY_CONVERT(int, GiaTri), 15), @Ngay)
        FROM dbo.CauHinhHeThong WHERE Khoa = N''SO_NGAY_HAN_THANH_TOAN'';
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, 0, 0, 0,
             N''Chưa thanh toán'', COALESCE(@Han, DATEADD(day, 15, @Ngay)),
             N''TIEN_PHONG'', @MaHopDong, @MaChiTiet, @KyThanhToan, @Den);
        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
             TrangThai, ThuTu, GhiChu)
        VALUES
            (LEFT(@MaHoaDon, 30) + N''-ROOM'', @MaHoaDon, N''ROOM'', N''Tiền phòng'',
             @Gia, 1, @Gia, N''Chưa thanh toán'', 1, @KyHan);
        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon, @Gia AS TongTien;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDonPhatSinh
    @MaChiPhi bigint,
    @MaHoaDon nvarchar(20) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @MaHopDong nvarchar(20), @MaChiTiet int, @NoiDung nvarchar(255),
                @SoTien decimal(18,2), @TenPhong nvarchar(50), @MaSinhVien nvarchar(30),
                @Ky date, @Ngay date = CAST(GETDATE() AS date), @Prefix nvarchar(40),
                @TenKhoan nvarchar(100), @MaChiTietHD nvarchar(40);
        SELECT @MaHopDong = cp.MaHopDong, @MaChiTiet = cp.MaChiTiet,
               @NoiDung = cp.NoiDung, @SoTien = cp.SoTien,
               @TenPhong = hd.TenPhong, @Ky = DATEFROMPARTS(YEAR(cp.NgayPhatSinh), MONTH(cp.NgayPhatSinh), 1),
               @MaSinhVien = c.MaSinhVien
        FROM dbo.ChiPhiPhatSinh cp WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = cp.MaHopDong
        LEFT JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = cp.MaChiTiet
        WHERE cp.MaChiPhi = @MaChiPhi AND cp.TrangThai = N''Chưa lập hóa đơn'';
        IF @MaHopDong IS NULL
        BEGIN
            SELECT MaChiPhi, MaHopDong, TrangThai FROM dbo.ChiPhiPhatSinh WHERE MaChiPhi = @MaChiPhi;
            THROW 51924, N''Không tìm thấy khoản phát sinh chưa lập hóa đơn.'', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon)
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 51925, N''Mã hóa đơn đã tồn tại.'', 1;
        END;
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, 0, 0, 0,
             N''Chưa thanh toán'', N''PHAT_SINH'', @MaHopDong, @MaChiTiet, @Ky, @Ky);
        SET @Prefix = N''Phát sinh #'' + CONVERT(nvarchar(20), @MaChiPhi) + N'': '';
        SET @TenKhoan = @Prefix + LEFT(@NoiDung, 100 - LEN(@Prefix));
        SET @MaChiTietHD = LEFT(@MaHoaDon, 25) + N''-INC-'' + CONVERT(nvarchar(12), @MaChiPhi);
        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
             TrangThai, ThuTu, GhiChu)
        VALUES
            (@MaChiTietHD, @MaHoaDon, N''INCIDENT'', @TenKhoan, @SoTien, 1, @SoTien,
             N''Chưa thanh toán'', 1, @NoiDung);
        UPDATE dbo.ChiPhiPhatSinh
        SET TrangThai = N''Đã lập hóa đơn'', MaChiTietHoaDon = @MaChiTietHD
        WHERE MaChiPhi = @MaChiPhi;
        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon, @MaChiTietHD AS MaChiTietHoaDon;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDonDichVuPhong
    @MaHopDong nvarchar(20),
    @KyThanhToan date,
    @ChiSoJson nvarchar(max) = NULL,
    @MaSinhVienNop nvarchar(30) = NULL,
    @MaHoaDon nvarchar(20) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @TenPhong nvarchar(50), @MaHangPhong nvarchar(20),
                @Ngay date = CAST(GETDATE() AS date), @Den date = EOMONTH(@KyThanhToan),
                @Han date;
        SELECT @TenPhong = TenPhong, @MaHangPhong = MaHangPhong
        FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND TrangThaiHopDong = N''Còn hiệu lực'';
        IF @TenPhong IS NULL
        BEGIN
            SELECT @MaHopDong AS MaHopDong;
            THROW 51926, N''Không tìm thấy hợp đồng/phòng hiệu lực.'', 1;
        END;
        IF @KyThanhToan IS NULL
           OR @KyThanhToan <> DATEFROMPARTS(YEAR(@KyThanhToan), MONTH(@KyThanhToan), 1)
        BEGIN
            SELECT @MaHopDong AS MaHopDong, @KyThanhToan AS KyThanhToan;
            THROW 51927, N''Kỳ dịch vụ phải là ngày đầu tháng.'', 1;
        END;
        IF @ChiSoJson IS NOT NULL AND ISJSON(@ChiSoJson) <> 1
        BEGIN
            SELECT @MaHopDong AS MaHopDong, @ChiSoJson AS ChiSoJson;
            THROW 51928, N''Dữ liệu chỉ số dịch vụ phải là JSON hợp lệ.'', 1;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE LoaiHoaDon = N''DICH_VU_PHONG'' AND MaHopDong = @MaHopDong
              AND TrangThaiThanhToan <> N''Đã hủy''
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan
        )
        BEGIN
            SELECT MaHoaDon, MaHopDong, KyThanhToan, KyThanhToanDen
            FROM dbo.HoaDon
            WHERE LoaiHoaDon = N''DICH_VU_PHONG'' AND MaHopDong = @MaHopDong
              AND TrangThaiThanhToan <> N''Đã hủy''
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan;
            THROW 51929, N''Kỳ dịch vụ bị trùng hoặc chồng với hóa đơn đang hoạt động.'', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        SELECT @Han = DATEADD(day, ISNULL(TRY_CONVERT(int, GiaTri), 15), @Ngay)
        FROM dbo.CauHinhHeThong WHERE Khoa = N''SO_NGAY_HAN_THANH_TOAN'';
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVienNop, @TenPhong, @Ngay, 0, 0, 0,
             N''Chưa thanh toán'', COALESCE(@Han, DATEADD(day, 15, @Ngay)),
             N''DICH_VU_PHONG'', @MaHopDong, @KyThanhToan, @Den);

        DECLARE @Services table
        (
            RowNo int IDENTITY(1,1) PRIMARY KEY,
            MaDichVu nvarchar(20) NOT NULL,
            TenDichVu nvarchar(100) NOT NULL,
            DonVi nvarchar(20) NOT NULL,
            DonGia decimal(18,2) NOT NULL,
            CachTinh nvarchar(20) NOT NULL,
            DoiTuongThanhToan nvarchar(10) NOT NULL,
            SoLuong decimal(18,3) NOT NULL,
            ChiSoCu int NULL,
            ChiSoMoi int NULL
        );
        INSERT INTO @Services
            (MaDichVu, TenDichVu, DonVi, DonGia, CachTinh, DoiTuongThanhToan,
             SoLuong, ChiSoCu, ChiSoMoi)
        SELECT d.MaDichVu, d.TenDichVu, d.DonVi, hpdv.DonGia,
               hpdv.CachTinh, hpdv.DoiTuongThanhToan,
               CASE
                   WHEN hpdv.CachTinh = N''CHI_SO''
                       THEN CONVERT(decimal(18,3), j.ChiSoMoi - j.ChiSoCu)
                   WHEN hpdv.DoiTuongThanhToan = N''CA_NHAN''
                       THEN CONVERT(decimal(18,3), residents.SoNguoi)
                   ELSE CONVERT(decimal(18,3), 1)
               END,
               j.ChiSoCu, j.ChiSoMoi
        FROM dbo.HangPhong_DichVu hpdv
        INNER JOIN dbo.DichVu d ON d.MaDichVu = hpdv.MaDichVu
        OUTER APPLY (
            SELECT TRY_CONVERT(int, JSON_VALUE(value, ''$.chiSoCu'')) AS ChiSoCu,
                   TRY_CONVERT(int, JSON_VALUE(value, ''$.chiSoMoi'')) AS ChiSoMoi
            FROM OPENJSON(COALESCE(@ChiSoJson, N''[]''))
            WHERE JSON_VALUE(value, ''$.maDichVu'') = hpdv.MaDichVu
        ) j
        CROSS APPLY (
            SELECT COUNT(*) AS SoNguoi
            FROM dbo.ChiTietHopDong c
            WHERE c.MaHopDong = @MaHopDong AND c.TrangThai = N''Đang ở''
        ) residents
        WHERE hpdv.MaHangPhong = @MaHangPhong
          AND hpdv.HoatDong = 1 AND d.HoatDong = 1;

        IF EXISTS (
            SELECT 1 FROM @Services
            WHERE CachTinh = N''CHI_SO'' AND (ChiSoCu IS NULL OR ChiSoMoi IS NULL OR ChiSoMoi < ChiSoCu)
        )
        BEGIN
            SELECT MaDichVu, CachTinh, ChiSoCu, ChiSoMoi
            FROM @Services
            WHERE CachTinh = N''CHI_SO'' AND (ChiSoCu IS NULL OR ChiSoMoi IS NULL OR ChiSoMoi < ChiSoCu);
            THROW 51930, N''Thiếu hoặc sai chỉ số cũ/mới cho dịch vụ tính theo chỉ số.'', 1;
        END;
        IF EXISTS (SELECT 1 FROM @Services WHERE SoLuong <= 0)
        BEGIN
            SELECT MaDichVu, SoLuong FROM @Services WHERE SoLuong <= 0;
            THROW 51931, N''Số lượng dịch vụ phải lớn hơn 0.'', 1;
        END;

        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, MaDichVu,
             ChiSoCu, ChiSoMoi, SoLuong, DonGia, TrangThai, ThuTu, GhiChu)
        SELECT LEFT(@MaHoaDon, 25) + N''-SV-'' + RIGHT(N''000'' + CONVERT(nvarchar(3), RowNo), 3),
               @MaHoaDon, N''SERVICE'', TenDichVu,
               CONVERT(decimal(18,2), ROUND(SoLuong * DonGia, 2)),
               MaDichVu, ChiSoCu, ChiSoMoi, SoLuong, DonGia,
               N''Chưa thanh toán'', RowNo, DonVi
        FROM @Services;

        DECLARE @IncidentIds table (MaChiPhi bigint PRIMARY KEY);
        INSERT INTO @IncidentIds(MaChiPhi)
        SELECT MaChiPhi
        FROM dbo.ChiPhiPhatSinh WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND TrangThai = N''Chưa lập hóa đơn'';

        DECLARE @MaChiPhi bigint, @IncidentAmount decimal(18,2), @IncidentDesc nvarchar(255),
                @IncidentDetail nvarchar(40), @IncidentPrefix nvarchar(40), @IncidentName nvarchar(100);
        DECLARE incident_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT cp.MaChiPhi, cp.SoTien, cp.NoiDung
            FROM dbo.ChiPhiPhatSinh cp WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN @IncidentIds ids ON ids.MaChiPhi = cp.MaChiPhi
            ORDER BY cp.MaChiPhi;
        OPEN incident_cursor;
        FETCH NEXT FROM incident_cursor INTO @MaChiPhi, @IncidentAmount, @IncidentDesc;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @IncidentPrefix = N''Phát sinh #'' + CONVERT(nvarchar(20), @MaChiPhi) + N'': '';
            SET @IncidentName = @IncidentPrefix + LEFT(@IncidentDesc, 100 - LEN(@IncidentPrefix));
            SET @IncidentDetail = LEFT(@MaHoaDon, 25) + N''-INC-'' + CONVERT(nvarchar(12), @MaChiPhi);
            INSERT INTO dbo.ChiTietHoaDon
                (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
                 TrangThai, ThuTu, GhiChu)
            VALUES (@IncidentDetail, @MaHoaDon, N''INCIDENT'', @IncidentName,
                    @IncidentAmount, 1, @IncidentAmount, N''Chưa thanh toán'', 1000, @IncidentDesc);
            UPDATE dbo.ChiPhiPhatSinh
            SET TrangThai = N''Đã lập hóa đơn'', MaChiTietHoaDon = @IncidentDetail
            WHERE MaChiPhi = @MaChiPhi;
            FETCH NEXT FROM incident_cursor INTO @MaChiPhi, @IncidentAmount, @IncidentDesc;
        END;
        CLOSE incident_cursor;
        DEALLOCATE incident_cursor;

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
CREATE OR ALTER PROCEDURE dbo.sp_TinhGoiYHoanTien
    @MaChiTiet int,
    @KhauTru decimal(18,2) = 0,
    @NgayRa date = NULL,
    @SoThangDaSuDung int OUTPUT,
    @TienSuDung decimal(18,2) OUTPUT,
    @SoTienDaDong decimal(18,2) OUTPUT,
    @SoTienDaHoan decimal(18,2) OUTPUT,
    @GoiYHoan decimal(18,2) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NgayVao date, @Monthly decimal(18,2), @EndDate date, @Months int;
    SELECT @NgayVao = NgayVao, @Monthly = GiaPhongThangApDung, @EndDate = COALESCE(@NgayRa, NgayRa)
    FROM dbo.ChiTietHopDong WHERE MaChiTiet = @MaChiTiet;
    IF @NgayVao IS NULL
    BEGIN
        SELECT @MaChiTiet AS MaChiTiet;
        THROW 51932, N''Không tìm thấy thành viên hợp đồng để tính hoàn tiền.'', 1;
    END;
    IF @EndDate IS NULL SET @EndDate = CAST(GETDATE() AS date);
    IF @EndDate < @NgayVao
    BEGIN
        SELECT @MaChiTiet AS MaChiTiet, @NgayVao AS NgayVao, @EndDate AS NgayRa;
        THROW 51933, N''Ngày ra không được trước ngày vào.'', 1;
    END;
    IF @KhauTru < 0
    BEGIN
        SELECT @MaChiTiet AS MaChiTiet, @KhauTru AS KhauTru;
        THROW 51934, N''Khấu trừ không được âm.'', 1;
    END;

    SET @Months = CASE WHEN @EndDate = @NgayVao THEN 0
        ELSE DATEDIFF(month, @NgayVao, @EndDate)
             + CASE WHEN DATEADD(month, DATEDIFF(month, @NgayVao, @EndDate), @NgayVao) < @EndDate
                    THEN 1 ELSE 0 END END;
    SET @SoThangDaSuDung = @Months;
    SET @TienSuDung = CONVERT(decimal(18,2), ROUND(@Months * @Monthly, 0));
    SELECT @SoTienDaDong = ISNULL(SUM(pt.SoTien), 0)
    FROM dbo.PhieuThu pt
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
    WHERE hd.MaChiTiet = @MaChiTiet
      AND hd.LoaiHoaDon = N''TIEN_PHONG''
      AND pt.TrangThai = N''Hợp lệ'';
    SELECT @SoTienDaHoan = ISNULL(SUM(pc.SoTien), 0)
    FROM dbo.PhieuChi pc
    WHERE pc.MaChiTiet = @MaChiTiet AND pc.TrangThai = N''Hợp lệ'';
    SET @GoiYHoan = CONVERT(decimal(18,2),
        ROUND(CASE WHEN @SoTienDaDong - @TienSuDung - @KhauTru - @SoTienDaHoan > 0
                   THEN @SoTienDaDong - @TienSuDung - @KhauTru - @SoTienDaHoan ELSE 0 END, 0));
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoPhieuChi
    @MaChiTiet int,
    @NgayRa date,
    @LyDo nvarchar(30),
    @KhauTru decimal(18,2) = 0,
    @SoTien decimal(18,2) = NULL,
    @NguoiLap int = NULL,
    @GhiChu nvarchar(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @SoThang int, @Used decimal(18,2), @Paid decimal(18,2),
                @Refunded decimal(18,2), @Suggested decimal(18,2),
                @MaPhieuChi bigint, @Remaining decimal(18,2), @Available decimal(18,2),
                @MaHoaDon nvarchar(20), @DateIn date;
        SELECT @DateIn = NgayVao FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChiTiet = @MaChiTiet;
        IF @DateIn IS NULL
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet;
            THROW 51935, N''Không tìm thấy thành viên hợp đồng.'', 1;
        END;
        IF @NgayRa < @DateIn
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @DateIn AS NgayVao, @NgayRa AS NgayRa;
            THROW 51936, N''Ngày ra không được trước ngày vào.'', 1;
        END;
        EXEC dbo.sp_TinhGoiYHoanTien
            @MaChiTiet = @MaChiTiet, @KhauTru = @KhauTru, @NgayRa = @NgayRa,
            @SoThangDaSuDung = @SoThang OUTPUT, @TienSuDung = @Used OUTPUT,
            @SoTienDaDong = @Paid OUTPUT, @SoTienDaHoan = @Refunded OUTPUT,
            @GoiYHoan = @Suggested OUTPUT;
        IF @SoTien IS NULL SET @SoTien = @Suggested;
        IF @SoTien <= 0
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @Suggested AS GoiYHoan, @SoTien AS SoTien;
            THROW 51937, N''Không có số dư hoàn tiền dương.'', 1;
        END;
        IF @SoTien > @Suggested
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @Suggested AS GoiYHoan, @SoTien AS SoTien;
            THROW 51938, N''Số tiền hoàn không được vượt số tiền gợi ý.'', 1;
        END;
        IF @LyDo NOT IN (N''Nghỉ học giữa chừng'', N''Chuyển đi'', N''Khác'')
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @LyDo AS LyDo;
            THROW 51939, N''Lý do hoàn tiền không hợp lệ.'', 1;
        END;
        IF @SoTien <> @Suggested AND NULLIF(LTRIM(RTRIM(@GhiChu)), N'''') IS NULL
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @Suggested AS GoiYHoan, @SoTien AS SoTien;
            THROW 51940, N''Sửa số tiền gợi ý phải ghi lý do trong GhiChu.'', 1;
        END;

        DECLARE @InvoiceBalance table
        (
            MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY,
            NgayLap date NOT NULL,
            SoDu decimal(18,2) NOT NULL
        );
        INSERT INTO @InvoiceBalance(MaHoaDon, NgayLap, SoDu)
        SELECT hd.MaHoaDon, hd.NgayLap,
               CASE WHEN ISNULL(paid.DaThu, 0) - ISNULL(spent.DaChi, 0) > 0
                    THEN ISNULL(paid.DaThu, 0) - ISNULL(spent.DaChi, 0) ELSE 0 END
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        OUTER APPLY (
            SELECT SUM(pt.SoTien) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) paid
        OUTER APPLY (
            SELECT SUM(ph.SoTien) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) spent
        WHERE hd.MaChiTiet = @MaChiTiet AND hd.LoaiHoaDon = N''TIEN_PHONG''
          AND hd.TrangThaiThanhToan <> N''Đã hủy''
          AND ISNULL(paid.DaThu, 0) > ISNULL(spent.DaChi, 0);

        IF @SoTien > ISNULL((SELECT SUM(SoDu) FROM @InvoiceBalance), 0)
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @SoTien AS SoTien,
                   ISNULL((SELECT SUM(SoDu) FROM @InvoiceBalance), 0) AS SoDuConLai;
            THROW 51941, N''Tổng hoàn vượt tiền thu hợp lệ còn lại trên các hóa đơn.'', 1;
        END;

        INSERT INTO dbo.PhieuChi
            (MaChiTiet, SoTienDaDong, SoTienDaSuDung, KhauTru, SoTien,
             NgayRa, LyDo, TrangThai, NguoiLap, GhiChu)
        VALUES
            (@MaChiTiet, @Paid, @Used, @KhauTru, @SoTien, @NgayRa,
             @LyDo, N''Chờ duyệt'', @NguoiLap,
             CASE WHEN @SoTien <> @Suggested
                  THEN N''Gợi ý '' + CONVERT(nvarchar(30), @Suggested) + N''; '' + @GhiChu
                  ELSE @GhiChu END);
        SET @MaPhieuChi = SCOPE_IDENTITY();
        SET @Remaining = @SoTien;

        DECLARE refund_invoice_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT MaHoaDon, SoDu FROM @InvoiceBalance ORDER BY NgayLap, MaHoaDon;
        OPEN refund_invoice_cursor;
        FETCH NEXT FROM refund_invoice_cursor INTO @MaHoaDon, @Available;
        WHILE @@FETCH_STATUS = 0 AND @Remaining > 0
        BEGIN
            DECLARE @Portion decimal(18,2) =
                CASE WHEN @Available >= @Remaining THEN @Remaining ELSE @Available END;
            IF @Portion > 0
                INSERT INTO dbo.PhieuChi_HoaDon(MaPhieuChi, MaHoaDon, SoTien)
                VALUES (@MaPhieuChi, @MaHoaDon, @Portion);
            SET @Remaining -= @Portion;
            FETCH NEXT FROM refund_invoice_cursor INTO @MaHoaDon, @Available;
        END;
        CLOSE refund_invoice_cursor;
        DEALLOCATE refund_invoice_cursor;

        UPDATE dbo.PhieuChi SET TrangThai = N''Hợp lệ'' WHERE MaPhieuChi = @MaPhieuChi;
        COMMIT TRANSACTION;
        SELECT @MaPhieuChi AS MaPhieuChi, @SoTien AS SoTien,
               @Suggested AS GoiYBanDau, @SoThang AS SoThangDaSuDung;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_HoaDonTongHop
AS
SELECT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.TenPhong, hd.NgayLap,
       MONTH(hd.NgayLap) AS Thang, YEAR(hd.NgayLap) AS Nam,
       hd.HanThanhToan, hd.LoaiHoaDon, hd.MaHopDong, hd.MaChiTiet,
       hd.KyThanhToan, hd.KyThanhToanDen,
       hd.TrangThaiThanhToan,
       hd.TongTien AS TongTienCotTinh,
       ISNULL(total.TongThuc, 0) AS TongThuc,
       ISNULL(received.DaThu, 0) AS DaThu,
       ISNULL(total.TongThuc, 0) - ISNULL(received.DaThu, 0) AS ConNo,
       ISNULL(lines.SoHangMuc, 0) AS SoHangMuc,
       CASE
           WHEN hd.TrangThaiThanhToan = N''Đã hủy'' THEN N''CANCELLED''
           WHEN ISNULL(received.DaThu, 0) >= ISNULL(total.TongThuc, 0)
                AND ISNULL(total.TongThuc, 0) > 0 THEN N''PAID''
           WHEN ISNULL(received.DaThu, 0) > 0 THEN N''PARTIAL''
           WHEN hd.HanThanhToan < CAST(GETDATE() AS date)
                AND hd.HanThanhToan IS NOT NULL THEN N''OVERDUE''
           ELSE N''UNPAID''
       END AS TrangThaiSuyRa
FROM dbo.HoaDon hd
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
OUTER APPLY (
    SELECT SUM(c.SoTien) AS TongThuc, COUNT(*) AS SoHangMuc
    FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
) total
OUTER APPLY (
    SELECT SUM(pt.SoTien) AS DaThu
    FROM dbo.PhieuThu pt
    WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
) received
OUTER APPLY (
    SELECT COUNT(*) AS SoHangMuc FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
) lines;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
SELECT hd.MaSinhVien, sv.HoTen, hd.TenPhong,
       SUM(v.ConNo) AS TongCongNo,
       SUM(CASE WHEN v.TrangThaiSuyRa = N''OVERDUE'' THEN v.ConNo ELSE 0 END) AS CongNoQuaHan,
       COUNT(*) AS SoHoaDon
FROM dbo.vw_HoaDonTongHop v
INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = v.MaHoaDon
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
WHERE v.ConNo > 0 AND hd.TrangThaiThanhToan <> N''Đã hủy''
GROUP BY hd.MaSinhVien, sv.HoTen, hd.TenPhong;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_DoanhThuThang
AS
WITH receipt_totals AS (
    SELECT YEAR(pt.NgayThu) AS Nam, MONTH(pt.NgayThu) AS Thang,
           SUM(CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN pt.SoTien ELSE 0 END) AS ThuTienPhong,
           SUM(CASE WHEN hd.LoaiHoaDon <> N''TIEN_PHONG'' THEN pt.SoTien ELSE 0 END) AS ThuDichVuKhac,
           SUM(pt.SoTien) AS TongThu
    FROM dbo.PhieuThu pt
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
    WHERE pt.TrangThai = N''Hợp lệ''
    GROUP BY YEAR(pt.NgayThu), MONTH(pt.NgayThu)
),
refund_totals AS (
    SELECT YEAR(pc.NgayChi) AS Nam, MONTH(pc.NgayChi) AS Thang,
           SUM(CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN pha.SoTien ELSE 0 END) AS ChiTienPhong,
           SUM(CASE WHEN hd.LoaiHoaDon <> N''TIEN_PHONG'' THEN pha.SoTien ELSE 0 END) AS ChiKhac,
           SUM(pha.SoTien) AS TongChi
    FROM dbo.PhieuChi pc
    INNER JOIN dbo.PhieuChi_HoaDon pha ON pha.MaPhieuChi = pc.MaPhieuChi
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pha.MaHoaDon
    WHERE pc.TrangThai = N''Hợp lệ''
    GROUP BY YEAR(pc.NgayChi), MONTH(pc.NgayChi)
)
SELECT COALESCE(r.Nam, c.Nam) AS Nam, COALESCE(r.Thang, c.Thang) AS Thang,
       ISNULL(r.ThuTienPhong, 0) - ISNULL(c.ChiTienPhong, 0) AS DoanhThuTienPhong,
       ISNULL(r.ThuDichVuKhac, 0) - ISNULL(c.ChiKhac, 0) AS DoanhThuDienNuocKhac,
       ISNULL(r.TongThu, 0) AS TongThu,
       ISNULL(c.TongChi, 0) AS TongChi,
       ISNULL(r.TongThu, 0) - ISNULL(c.TongChi, 0) AS TongDoanhThu
FROM receipt_totals r
FULL OUTER JOIN refund_totals c ON c.Nam = r.Nam AND c.Thang = r.Thang;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'019', N'019_payment_workflows.sql');

        COMMIT TRANSACTION;
        PRINT N'[019] Hoàn tất: chuyển đổi giao dịch, phiếu thu/chi, quy trình hóa đơn và báo cáo đã sẵn sàng.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- END INLINE: db/migrations/019_payment_workflows.sql
GO

-- BEGIN INLINE: db/migrations/020_grant_app_permissions.sql
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
-- END INLINE: db/migrations/020_grant_app_permissions.sql
GO

-- BEGIN INLINE: db/migrations/021_money_api_permissions.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
BEGIN
    ;THROW 52100, N'Chạy migration 001 trước.', 1;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'020')
BEGIN
    ;THROW 52101, N'Chạy migration 020 trước.', 1;
END;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'021')
BEGIN
    PRINT N'[021] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
            SELECT MaGiaoDich
            FROM dbo.PhieuThu
            WHERE MaGiaoDich IS NOT NULL
              AND TrangThai <> N'Đã hủy'
            GROUP BY MaGiaoDich
            HAVING COUNT_BIG(*) > 1
        )
        BEGIN
            SELECT MaGiaoDich, COUNT_BIG(*) AS SoPhieuThu
            FROM dbo.PhieuThu
            WHERE MaGiaoDich IS NOT NULL
              AND TrangThai <> N'Đã hủy'
            GROUP BY MaGiaoDich
            HAVING COUNT_BIG(*) > 1;
            ;THROW 52102, N'Có giao dịch đang liên kết với nhiều phiếu thu chưa hủy.', 1;
        END;

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.PhieuThu')
              AND name = N'UX_PhieuThu_MaGiaoDich_ChuaHuy'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE UNIQUE INDEX UX_PhieuThu_MaGiaoDich_ChuaHuy
                    ON dbo.PhieuThu(MaGiaoDich)
                    WHERE MaGiaoDich IS NOT NULL
                      AND TrangThai <> N''Đã hủy'';';
        END;

        IF COL_LENGTH(N'dbo.GiaoDichThanhToan', N'LyDoDoiSoat') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.GiaoDichThanhToan
                ADD LyDoDoiSoat nvarchar(255) NULL;';
        END;

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan')
              AND name = N'CK_GiaoDich_TrangThai'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.GiaoDichThanhToan
                DROP CONSTRAINT CK_GiaoDich_TrangThai;';
        END;

        IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan')
              AND name = N'IX_GiaoDich_TrangThai_PhuongThuc'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                DROP INDEX IX_GiaoDich_TrangThai_PhuongThuc
                ON dbo.GiaoDichThanhToan;';
        END;

        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.GiaoDichThanhToan
            ALTER COLUMN TrangThai nvarchar(20) NOT NULL;';

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan')
              AND name = N'IX_GiaoDich_TrangThai_PhuongThuc'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE NONCLUSTERED INDEX IX_GiaoDich_TrangThai_PhuongThuc
                ON dbo.GiaoDichThanhToan (TrangThai, PhuongThuc);';
        END;

        IF NOT EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan')
              AND name = N'CK_GiaoDich_TrangThai'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.GiaoDichThanhToan WITH CHECK
                ADD CONSTRAINT CK_GiaoDich_TrangThai
                CHECK (TrangThai IN
                    (N''PENDING'', N''SUCCESS'', N''REJECTED'', N''EXPIRED'', N''RECONCILIATION''));';
        END;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_XacNhanPhieuThu
    @MaPhieuThu bigint,
    @NguoiXacNhan int = NULL,
    @MaThamChieuNgoai nvarchar(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaHoaDon nvarchar(20), @MaGiaoDich nvarchar(60),
                @TrangThai nvarchar(20), @TongHoaDon decimal(18,2),
                @DaThu decimal(18,2), @SoTien decimal(18,2),
                @LyDo nvarchar(255);

        SELECT @MaHoaDon = pt.MaHoaDon, @MaGiaoDich = pt.MaGiaoDich,
               @TrangThai = pt.TrangThai, @SoTien = pt.SoTien
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        WHERE pt.MaPhieuThu = @MaPhieuThu;

        IF @MaHoaDon IS NULL
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52103, N''Không tìm thấy phiếu thu.'', 1;
        END;
        IF @TrangThai <> N''Chờ xác nhận''
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu, @TrangThai AS TrangThai;
            THROW 52104, N''Chỉ xác nhận được phiếu thu đang chờ xác nhận.'', 1;
        END;

        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;

        SELECT @TongHoaDon = ISNULL(SUM(c.SoTien), 0)
        FROM dbo.ChiTietHoaDon c
        WHERE c.MaHoaDon = @MaHoaDon;
        SELECT @DaThu = ISNULL(SUM(pt.SoTien), 0)
        FROM dbo.PhieuThu pt
        WHERE pt.MaHoaDon = @MaHoaDon
          AND pt.TrangThai = N''Hợp lệ''
          AND pt.MaPhieuThu <> @MaPhieuThu;

        IF @DaThu + @SoTien > @TongHoaDon
        BEGIN
            SET @LyDo = N''Tổng thu hợp lệ đã thay đổi; xác nhận phiếu sẽ vượt tổng hóa đơn.'';
            IF @MaGiaoDich IS NOT NULL
            BEGIN
                UPDATE dbo.GiaoDichThanhToan
                SET TrangThai = N''RECONCILIATION'',
                    LyDoDoiSoat = @LyDo,
                    MaThamChieuNgoai = COALESCE(@MaThamChieuNgoai, MaThamChieuNgoai)
                WHERE MaGiaoDich = @MaGiaoDich
                  AND TrangThai IN (N''PENDING'', N''RECONCILIATION'');
            END;

            INSERT INTO dbo.NhatKyHeThong
                (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
            VALUES
                (@NguoiXacNhan, N''Cần đối soát phiếu thu'', N''PhieuThu'',
                 CONVERT(nvarchar(60), @MaPhieuThu), @LyDo);

            COMMIT TRANSACTION;
            SELECT @MaPhieuThu AS MaPhieuThu, N''RECONCILIATION'' AS TrangThaiGiaoDich,
                   @LyDo AS LyDoDoiSoat;
            RETURN;
        END;

        UPDATE dbo.PhieuThu
        SET TrangThai = N''Hợp lệ'',
            MaThamChieu = COALESCE(@MaThamChieuNgoai, MaThamChieu)
        WHERE MaPhieuThu = @MaPhieuThu
          AND TrangThai = N''Chờ xác nhận'';
        IF @@ROWCOUNT <> 1
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52105, N''Phiếu thu đã được xử lý bởi thao tác khác.'', 1;
        END;

        IF @MaGiaoDich IS NOT NULL
        BEGIN
            UPDATE dbo.GiaoDichThanhToan
            SET TrangThai = N''SUCCESS'',
                NgayThanhToan = GETDATE(),
                XacNhanBoi = COALESCE(@NguoiXacNhan, XacNhanBoi),
                MaThamChieuNgoai = COALESCE(@MaThamChieuNgoai, MaThamChieuNgoai),
                LyDoDoiSoat = NULL
            WHERE MaGiaoDich = @MaGiaoDich
              AND TrangThai IN (N''PENDING'', N''RECONCILIATION'');
        END;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiXacNhan, N''Xác nhận phiếu thu'', N''PhieuThu'',
             CONVERT(nvarchar(60), @MaPhieuThu), N''Phiếu thu chuyển sang Hợp lệ.'');

        COMMIT TRANSACTION;
        SELECT @MaPhieuThu AS MaPhieuThu, N''Hợp lệ'' AS TrangThaiPhieuThu,
               N''SUCCESS'' AS TrangThaiGiaoDich, CAST(NULL AS nvarchar(255)) AS LyDoDoiSoat;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_HuyPhieuThu
    @MaPhieuThu bigint,
    @NguoiThucHien int = NULL,
    @LyDo nvarchar(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaHoaDon nvarchar(20), @MaGiaoDich nvarchar(60),
                @TrangThai nvarchar(20);
        SELECT @MaHoaDon = pt.MaHoaDon, @MaGiaoDich = pt.MaGiaoDich,
               @TrangThai = pt.TrangThai
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        WHERE pt.MaPhieuThu = @MaPhieuThu;

        IF @MaHoaDon IS NULL
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52103, N''Không tìm thấy phiếu thu.'', 1;
        END;
        IF @TrangThai <> N''Chờ xác nhận''
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu, @TrangThai AS TrangThai;
            THROW 52104, N''Chỉ hủy được phiếu thu đang chờ xác nhận.'', 1;
        END;

        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;

        UPDATE dbo.PhieuThu
        SET TrangThai = N''Đã hủy'',
            GhiChu = COALESCE(NULLIF(LTRIM(RTRIM(@LyDo)), N''''), GhiChu)
        WHERE MaPhieuThu = @MaPhieuThu
          AND TrangThai = N''Chờ xác nhận'';
        IF @@ROWCOUNT <> 1
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52105, N''Phiếu thu đã được xử lý bởi thao tác khác.'', 1;
        END;

        IF @MaGiaoDich IS NOT NULL
        BEGIN
            UPDATE dbo.GiaoDichThanhToan
            SET TrangThai = N''REJECTED'',
                LyDoTuChoi = COALESCE(NULLIF(LTRIM(RTRIM(@LyDo)), N''''), LyDoTuChoi),
                LyDoDoiSoat = NULL
            WHERE MaGiaoDich = @MaGiaoDich
              AND TrangThai IN (N''PENDING'', N''RECONCILIATION'');
        END;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiThucHien, N''Hủy phiếu thu chờ'', N''PhieuThu'',
             CONVERT(nvarchar(60), @MaPhieuThu), COALESCE(@LyDo, N''Hủy phiếu thu chờ xác nhận.''));

        COMMIT TRANSACTION;
        SELECT @MaPhieuThu AS MaPhieuThu, N''Đã hủy'' AS TrangThaiPhieuThu,
               N''REJECTED'' AS TrangThaiGiaoDich;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;';

        DECLARE @PrincipalExists bit = 0;
        EXEC sys.sp_executesql
            N'SELECT @PrincipalExists = CASE WHEN DATABASE_PRINCIPAL_ID(N''DNKTX'') IS NULL THEN 0 ELSE 1 END;',
            N'@PrincipalExists bit OUTPUT',
            @PrincipalExists = @PrincipalExists OUTPUT;

        IF @PrincipalExists = 1
        BEGIN
            EXEC sys.sp_executesql N'
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonTienPhong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonDichVuPhong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonPhatSinh TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_GhiPhieuThu TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_TinhGoiYHoanTien TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoPhieuChi TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_XacNhanPhieuThu TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_HuyPhieuThu TO [DNKTX];';

            INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
            VALUES (N'021', N'021_money_api_permissions.sql');
        END;

        COMMIT TRANSACTION;
        IF @PrincipalExists = 1
            PRINT N'[021] Đã thêm đối soát phiếu thu, chống ghi trùng giao dịch và quyền EXECUTE thanh toán.';
        ELSE
            PRINT N'[021] Đã cập nhật schema/procedure; bỏ qua GRANT và chưa ghi ledger vì user DNKTX chưa tồn tại.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- END INLINE: db/migrations/021_money_api_permissions.sql
GO

IF SUSER_ID(N'DNKTX') IS NULL
    THROW 50150, N'DNKTX server login must exist before this build script runs.', 1;
IF DATABASE_PRINCIPAL_ID(N'DNKTX') IS NULL
    CREATE USER [DNKTX] FOR LOGIN [DNKTX];
IF NOT EXISTS (SELECT 1 FROM sys.database_role_members drm INNER JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id INNER JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id WHERE r.name = N'db_datareader' AND m.name = N'DNKTX')
    ALTER ROLE [db_datareader] ADD MEMBER [DNKTX];
IF NOT EXISTS (SELECT 1 FROM sys.database_role_members drm INNER JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id INNER JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id WHERE r.name = N'db_datawriter' AND m.name = N'DNKTX')
    ALTER ROLE [db_datawriter] ADD MEMBER [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_TaoHopDong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_ThemSinhVienVaoHopDong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_SinhVienRoiHopDong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_GiaHanHopDong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_KetThucHopDong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_ChuyenPhong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_GhiNhatKyHopDong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonTienPhong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonDichVuPhong TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonPhatSinh TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_GhiPhieuThu TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_TinhGoiYHoanTien TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_TaoPhieuChi TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_XacNhanPhieuThu TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_HuyPhieuThu TO [DNKTX];
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'021')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'021', N'021_money_api_permissions.sql');
GO
-- BEGIN INLINE: db/migrations/022_complete_financial_reports.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;
IF DB_NAME() = N'master'
    THROW 52200, N'Không chạy migration trong master.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'021')
    THROW 52202, N'Chạy migration 021 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'022')
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
WITH invoice_totals AS (
    SELECT hd.MaHoaDon, hd.LoaiHoaDon, hd.TenPhong, hd.MaHopDong,
           CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG''
                THEN cthd.MaSinhVien
                WHEN hd.LoaiHoaDon = N''CU''
                THEN hd.MaSinhVien END AS MaSinhVien,
           ISNULL(sv.HoTen, N'''') AS HoTen,
           ISNULL(v.TongThuc, 0) AS TongHoaDon,
           ISNULL(v.DaThu, 0) AS DaThu,
           ISNULL(v.ConNo, 0) AS ConNo,
           CASE WHEN v.TrangThaiSuyRa = N''OVERDUE''
                THEN ISNULL(v.ConNo, 0) ELSE 0 END AS CongNoQuaHan
    FROM dbo.HoaDon hd
    INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
    LEFT JOIN dbo.ChiTietHopDong cthd
        ON hd.LoaiHoaDon = N''TIEN_PHONG'' AND cthd.MaChiTiet = hd.MaChiTiet
    LEFT JOIN dbo.SinhVien sv
        ON sv.MaSinhVien = CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG''
                               THEN cthd.MaSinhVien
                               WHEN hd.LoaiHoaDon = N''CU''
                               THEN hd.MaSinhVien END
    WHERE ISNULL(hd.TrangThaiThanhToan, N'''') <> N''Đã hủy''
)
SELECT LoaiHoaDon, TenPhong, MaHopDong, MaSinhVien,
       NULLIF(HoTen, N'''') AS HoTen,
       SUM(TongHoaDon) AS TongHoaDon,
       SUM(DaThu) AS DaThu,
       SUM(ConNo) AS TongCongNo,
       SUM(CongNoQuaHan) AS CongNoQuaHan,
       COUNT_BIG(*) AS SoHoaDon
FROM invoice_totals
WHERE ConNo > 0
GROUP BY LoaiHoaDon, TenPhong, MaHopDong, MaSinhVien, HoTen;';
        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_DoanhThuThang
AS
WITH receipt_totals AS (
    SELECT YEAR(pt.NgayThu) AS Nam, MONTH(pt.NgayThu) AS Thang,
           SUM(CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN pt.SoTien ELSE 0 END) AS ThuTienPhong,
           SUM(CASE WHEN hd.LoaiHoaDon = N''DICH_VU_PHONG'' OR hd.LoaiHoaDon = N''CU''
                    THEN pt.SoTien ELSE 0 END) AS ThuDichVu,
           SUM(CASE WHEN hd.LoaiHoaDon = N''PHAT_SINH'' THEN pt.SoTien ELSE 0 END) AS ThuPhatSinh,
           SUM(pt.SoTien) AS TongThu
    FROM dbo.PhieuThu pt
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
    WHERE pt.TrangThai = N''Hợp lệ''
    GROUP BY YEAR(pt.NgayThu), MONTH(pt.NgayThu)
),
refund_totals AS (
    SELECT YEAR(pc.NgayChi) AS Nam, MONTH(pc.NgayChi) AS Thang,
           SUM(CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN pha.SoTien ELSE 0 END) AS ChiTienPhong,
           SUM(CASE WHEN hd.LoaiHoaDon = N''DICH_VU_PHONG'' OR hd.LoaiHoaDon = N''CU''
                    THEN pha.SoTien ELSE 0 END) AS ChiDichVu,
           SUM(CASE WHEN hd.LoaiHoaDon = N''PHAT_SINH'' THEN pha.SoTien ELSE 0 END) AS ChiPhatSinh,
           SUM(pha.SoTien) AS TongChi
    FROM dbo.PhieuChi pc
    INNER JOIN dbo.PhieuChi_HoaDon pha ON pha.MaPhieuChi = pc.MaPhieuChi
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pha.MaHoaDon
    WHERE pc.TrangThai = N''Hợp lệ''
    GROUP BY YEAR(pc.NgayChi), MONTH(pc.NgayChi)
)
SELECT COALESCE(r.Nam, c.Nam) AS Nam,
       COALESCE(r.Thang, c.Thang) AS Thang,
       ISNULL(r.ThuTienPhong, 0) AS ThuTienPhong,
       ISNULL(c.ChiTienPhong, 0) AS ChiTienPhong,
       ISNULL(r.ThuTienPhong, 0) - ISNULL(c.ChiTienPhong, 0) AS DoanhThuTienPhong,
       ISNULL(r.ThuDichVu, 0) AS ThuDichVu,
       ISNULL(c.ChiDichVu, 0) AS ChiDichVu,
       ISNULL(r.ThuDichVu, 0) - ISNULL(c.ChiDichVu, 0) AS DoanhThuDichVu,
       ISNULL(r.ThuPhatSinh, 0) AS ThuPhatSinh,
       ISNULL(c.ChiPhatSinh, 0) AS ChiPhatSinh,
       ISNULL(r.ThuPhatSinh, 0) - ISNULL(c.ChiPhatSinh, 0) AS DoanhThuPhatSinh,
       ISNULL(r.ThuDichVu, 0) - ISNULL(c.ChiDichVu, 0) AS DoanhThuDienNuocKhac,
       ISNULL(r.TongThu, 0) AS TongThu,
       ISNULL(c.TongChi, 0) AS TongChi,
       ISNULL(r.TongThu, 0) - ISNULL(c.TongChi, 0) AS TongDoanhThu
FROM receipt_totals r
FULL OUTER JOIN refund_totals c ON c.Nam = r.Nam AND c.Thang = r.Thang;';
        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'022', N'022_complete_financial_reports.sql');
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- END INLINE: db/migrations/022_complete_financial_reports.sql
GO
-- BEGIN INLINE: db/migrations/023_student_notifications.sql
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
-- END INLINE: db/migrations/023_student_notifications.sql
GO
-- BEGIN INLINE: db/migrations/024_invoice_reminder_reference.sql
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 52400, N'Chạy migration 001 trước.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'023')
    THROW 52401, N'Chạy migration 023 trước.', 1;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'024')
BEGIN
    PRINT N'[024] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
IF COL_LENGTH(N''dbo.ThongBao'', N''MaHoaDon'') IS NULL
    ALTER TABLE dbo.ThongBao ADD MaHoaDon nvarchar(20) NULL;';

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
IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N''dbo.ThongBao'')
      AND name = N''IX_ThongBao_MaHoaDon_NgayTao''
)
    CREATE INDEX IX_ThongBao_MaHoaDon_NgayTao
        ON dbo.ThongBao (MaHoaDon, NgayTao DESC);';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'024', N'024_invoice_reminder_reference.sql');

        COMMIT TRANSACTION;
        PRINT N'[024] Hoàn tất; không cập nhật dữ liệu cũ và không cấp thêm quyền.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
-- END INLINE: db/migrations/024_invoice_reminder_reference.sql
GO
PRINT N'KTX_Group3 schema, migrations 001-024, master data, and DNKTX permissions are ready.'
GO
