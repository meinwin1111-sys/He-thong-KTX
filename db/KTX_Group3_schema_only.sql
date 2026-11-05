-- Read-only schema export from the current KTX_Group3_test database.
-- Creates an empty database named KTX_Group3_Schema; no application rows are included.
-- Includes all 25 non-system tables, their keys, checks, defaults, indexes, and foreign keys.
-- Views, stored procedures, and triggers are intentionally excluded.
-- Requires permission to create a database. Change the database name below if needed.
-- Table list: dbo.CauHinhHeThong, dbo.ChiPhiPhatSinh, dbo.ChiTietHoaDon, dbo.ChiTietHopDong, dbo.DangKySinhVienChoDuyet, dbo.DichVu, dbo.GiaHanHopDong, dbo.GiaoDichThanhToan, dbo.HangPhong, dbo.HangPhong_DichVu, dbo.HoaDon, dbo.HoanTienChuyenKhoanDu, dbo.HopDong, dbo.LichSuHopDong_Backup, dbo.MaHoaDonCounter, dbo.NhatKyHeThong, dbo.PhieuChi, dbo.PhieuChi_HoaDon, dbo.PhieuThu, dbo.Phong, dbo.SchemaMigration, dbo.SinhVien, dbo.TaiKhoan, dbo.ThongBao, dbo.YeuCauSinhVien

IF DB_ID(N'KTX_Group3_Schema') IS NOT NULL
    THROW 51900, N'Database KTX_Group3_Schema already exists. Change the target database name before running this script.', 1;
GO

CREATE DATABASE [KTX_Group3_Schema];
GO
USE [KTX_Group3_Schema];
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
CREATE SEQUENCE [dbo].[Seq_MaHopDong]
 AS [int]
 START WITH 1
 INCREMENT BY 1
 MINVALUE 1
 MAXVALUE 2147483647
 NO CACHE
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[CauHinhHeThong](
	[Khoa] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[GiaTri] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MoTa] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_CauHinhHeThong] PRIMARY KEY CLUSTERED
(
	[Khoa] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[ChiPhiPhatSinh](
	[MaChiPhi] [bigint] IDENTITY(1,1) NOT NULL,
	[MaHopDong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaChiTiet] [int] NULL,
	[NoiDung] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SoTien] [decimal](18, 2) NOT NULL,
	[NgayPhatSinh] [date] NOT NULL,
	[NguoiNhap] [int] NOT NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaChiTietHoaDon] [nvarchar](40) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [datetime] NOT NULL,
	[HanDong] [date] NOT NULL,
 CONSTRAINT [PK_ChiPhiPhatSinh] PRIMARY KEY CLUSTERED
(
	[MaChiPhi] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_ChiPhiPhatSinh_HopDong_TrangThai] ON [dbo].[ChiPhiPhatSinh]
(
	[MaHopDong] ASC,
	[TrangThai] ASC,
	[NgayPhatSinh] ASC
)
INCLUDE ( 	[MaChiPhi],
	[MaChiTiet],
	[SoTien]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_ChiPhiPhatSinh_ChiTietHoaDon] ON [dbo].[ChiPhiPhatSinh]
(
	[MaChiTietHoaDon] ASC
)
WHERE ([MaChiTietHoaDon] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[ChiPhiPhatSinh] ADD  CONSTRAINT [DF_ChiPhiPhatSinh_NgayPhatSinh]  DEFAULT (CONVERT([date],getdate())) FOR [NgayPhatSinh]
ALTER TABLE [dbo].[ChiPhiPhatSinh] ADD  CONSTRAINT [DF_ChiPhiPhatSinh_TrangThai]  DEFAULT (N'Chưa lập hóa đơn') FOR [TrangThai]
ALTER TABLE [dbo].[ChiPhiPhatSinh] ADD  CONSTRAINT [DF_ChiPhiPhatSinh_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[ChiPhiPhatSinh] ADD  CONSTRAINT [DF_ChiPhiPhatSinh_HanDong]  DEFAULT (dateadd(day,(7),CONVERT([date],getdate()))) FOR [HanDong]
ALTER TABLE [dbo].[ChiPhiPhatSinh]  WITH CHECK ADD  CONSTRAINT [CK_ChiPhiPhatSinh_LienKet] CHECK  (([TrangThai]=N'Đã lập hóa đơn' AND [MaChiTietHoaDon] IS NOT NULL OR [TrangThai]<>N'Đã lập hóa đơn' AND [MaChiTietHoaDon] IS NULL))
ALTER TABLE [dbo].[ChiPhiPhatSinh] CHECK CONSTRAINT [CK_ChiPhiPhatSinh_LienKet]
ALTER TABLE [dbo].[ChiPhiPhatSinh]  WITH CHECK ADD  CONSTRAINT [CK_ChiPhiPhatSinh_SoTien] CHECK  (([SoTien]>(0)))
ALTER TABLE [dbo].[ChiPhiPhatSinh] CHECK CONSTRAINT [CK_ChiPhiPhatSinh_SoTien]
ALTER TABLE [dbo].[ChiPhiPhatSinh]  WITH CHECK ADD  CONSTRAINT [CK_ChiPhiPhatSinh_TrangThai] CHECK  (([TrangThai]=N'Đã hủy' OR [TrangThai]=N'Đã lập hóa đơn' OR [TrangThai]=N'Chờ gộp' OR [TrangThai]=N'Chưa lập hóa đơn'))
ALTER TABLE [dbo].[ChiPhiPhatSinh] CHECK CONSTRAINT [CK_ChiPhiPhatSinh_TrangThai]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[ChiTietHoaDon](
	[MaChiTiet] [nvarchar](40) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaHoaDon] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaKhoan] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TenKhoan] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SoTien] [decimal](18, 2) NOT NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgayThanhToan] [datetime] NULL,
	[MaGiaoDich] [nvarchar](60) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ThuTu] [int] NOT NULL,
	[RowVer] [timestamp] NOT NULL,
	[MaDichVu] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ChiSoCu] [int] NULL,
	[ChiSoMoi] [int] NULL,
	[SoLuong] [decimal](18, 3) NOT NULL,
	[DonGia] [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_ChiTietHoaDon] PRIMARY KEY CLUSTERED
(
	[MaChiTiet] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON),
 CONSTRAINT [UQ_ChiTietHoaDon_Khoan] UNIQUE NONCLUSTERED
(
	[MaHoaDon] ASC,
	[MaKhoan] ASC,
	[TenKhoan] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_ChiTietHoaDon_MaHoaDon] ON [dbo].[ChiTietHoaDon]
(
	[MaHoaDon] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_ChiTietHoaDon_TrangThai] ON [dbo].[ChiTietHoaDon]
(
	[TrangThai] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[ChiTietHoaDon] ADD  CONSTRAINT [DF_ChiTietHoaDon_TrangThai]  DEFAULT (N'Chưa thanh toán') FOR [TrangThai]
ALTER TABLE [dbo].[ChiTietHoaDon] ADD  CONSTRAINT [DF_ChiTietHoaDon_ThuTu]  DEFAULT ((0)) FOR [ThuTu]
ALTER TABLE [dbo].[ChiTietHoaDon] ADD  CONSTRAINT [DF_ChiTietHoaDon_SoLuong]  DEFAULT ((1)) FOR [SoLuong]
ALTER TABLE [dbo].[ChiTietHoaDon] ADD  CONSTRAINT [DF_ChiTietHoaDon_DonGia]  DEFAULT ((0)) FOR [DonGia]
ALTER TABLE [dbo].[ChiTietHoaDon]  WITH CHECK ADD  CONSTRAINT [CK_ChiTietHoaDon_SoLuongDonGia] CHECK  (([SoLuong]>(0) AND [DonGia]>=(0)))
ALTER TABLE [dbo].[ChiTietHoaDon] CHECK CONSTRAINT [CK_ChiTietHoaDon_SoLuongDonGia]
ALTER TABLE [dbo].[ChiTietHoaDon]  WITH CHECK ADD  CONSTRAINT [CK_ChiTietHoaDon_SoTien] CHECK  (([SoTien]>=(0)))
ALTER TABLE [dbo].[ChiTietHoaDon] CHECK CONSTRAINT [CK_ChiTietHoaDon_SoTien]
ALTER TABLE [dbo].[ChiTietHoaDon]  WITH CHECK ADD  CONSTRAINT [CK_ChiTietHoaDon_TrangThai] CHECK  (([TrangThai]=N'Đã thanh toán' OR [TrangThai]=N'Chờ tiền mặt' OR [TrangThai]=N'Chưa thanh toán'))
ALTER TABLE [dbo].[ChiTietHoaDon] CHECK CONSTRAINT [CK_ChiTietHoaDon_TrangThai]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[ChiTietHopDong](
	[MaChiTiet] [int] IDENTITY(1,1) NOT NULL,
	[MaHopDong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaSinhVien] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgayVao] [date] NOT NULL,
	[NgayRa] [date] NULL,
	[KyHanThanhToanPhong] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[GiaPhongApDung] [decimal](18, 2) NOT NULL,
	[GiaPhongThangApDung] [decimal](18, 2) NOT NULL,
	[LaNguoiDaiDienThanhToanDichVu] [bit] NOT NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LyDoRoi] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [datetime] NOT NULL,
 CONSTRAINT [PK_ChiTietHopDong] PRIMARY KEY CLUSTERED
(
	[MaChiTiet] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_CTHD_MaHopDong] ON [dbo].[ChiTietHopDong]
(
	[MaHopDong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_CTHD_MaSinhVien] ON [dbo].[ChiTietHopDong]
(
	[MaSinhVien] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_CTHD_DaiDien_DangO] ON [dbo].[ChiTietHopDong]
(
	[MaHopDong] ASC
)
WHERE ([LaNguoiDaiDienThanhToanDichVu]=(1) AND [TrangThai]=N'Đang ở')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_CTHD_SinhVien_DangO] ON [dbo].[ChiTietHopDong]
(
	[MaSinhVien] ASC
)
WHERE ([TrangThai]=N'Đang ở')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[ChiTietHopDong] ADD  CONSTRAINT [DF_ChiTietHopDong_KyHan]  DEFAULT (N'THANG') FOR [KyHanThanhToanPhong]
ALTER TABLE [dbo].[ChiTietHopDong] ADD  CONSTRAINT [DF_ChiTietHopDong_DaiDien]  DEFAULT ((0)) FOR [LaNguoiDaiDienThanhToanDichVu]
ALTER TABLE [dbo].[ChiTietHopDong] ADD  CONSTRAINT [DF_ChiTietHopDong_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[ChiTietHopDong]  WITH CHECK ADD  CONSTRAINT [CK_CTHD_Gia] CHECK  (([GiaPhongApDung]>=(0) AND [GiaPhongThangApDung]>=(0)))
ALTER TABLE [dbo].[ChiTietHopDong] CHECK CONSTRAINT [CK_CTHD_Gia]
ALTER TABLE [dbo].[ChiTietHopDong]  WITH CHECK ADD  CONSTRAINT [CK_CTHD_KyHan] CHECK  (([KyHanThanhToanPhong]=N'NAM' OR [KyHanThanhToanPhong]=N'THANG'))
ALTER TABLE [dbo].[ChiTietHopDong] CHECK CONSTRAINT [CK_CTHD_KyHan]
ALTER TABLE [dbo].[ChiTietHopDong]  WITH CHECK ADD  CONSTRAINT [CK_CTHD_Ngay] CHECK  (([NgayRa] IS NULL OR [NgayRa]>=[NgayVao]))
ALTER TABLE [dbo].[ChiTietHopDong] CHECK CONSTRAINT [CK_CTHD_Ngay]
ALTER TABLE [dbo].[ChiTietHopDong]  WITH CHECK ADD  CONSTRAINT [CK_CTHD_TrangThai] CHECK  (([TrangThai]=N'Đã chuyển phòng' OR [TrangThai]=N'Đã rời' OR [TrangThai]=N'Đang ở'))
ALTER TABLE [dbo].[ChiTietHopDong] CHECK CONSTRAINT [CK_CTHD_TrangThai]
ALTER TABLE [dbo].[ChiTietHopDong]  WITH CHECK ADD  CONSTRAINT [CK_CTHD_TrangThai_NgayRa] CHECK  (([TrangThai]=N'Đang ở' AND ([NgayRa] IS NULL OR [NgayRa]>=[NgayVao]) OR [TrangThai]<>N'Đang ở' AND [NgayRa] IS NOT NULL))
ALTER TABLE [dbo].[ChiTietHopDong] CHECK CONSTRAINT [CK_CTHD_TrangThai_NgayRa]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[DangKySinhVienChoDuyet](
	[Id] [bigint] IDENTITY(1,1) NOT NULL,
	[MaSinhVien] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[HoTen] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgaySinh] [date] NOT NULL,
	[GioiTinh] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SoDienThoai] [varchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Email] [varchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DiaChi] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Truong] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Lop] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MatKhauHash] [varchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgayTao] [datetime] NOT NULL,
	[NgayXuLy] [datetime] NULL,
	[XuLyBoi] [int] NULL,
	[LyDoTuChoi] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_DangKySinhVienChoDuyet] PRIMARY KEY CLUSTERED
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_DangKySinhVienChoDuyet_TrangThai_NgayTao] ON [dbo].[DangKySinhVienChoDuyet]
(
	[TrangThai] ASC,
	[NgayTao] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_DangKySinhVienChoDuyet_Email_ChoDuyet] ON [dbo].[DangKySinhVienChoDuyet]
(
	[Email] ASC
)
WHERE ([TrangThai]=N'Chờ duyệt')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_DangKySinhVienChoDuyet_MaSinhVien_ChoDuyet] ON [dbo].[DangKySinhVienChoDuyet]
(
	[MaSinhVien] ASC
)
WHERE ([TrangThai]=N'Chờ duyệt')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[DangKySinhVienChoDuyet] ADD  CONSTRAINT [DF_DangKySinhVienChoDuyet_TrangThai]  DEFAULT (N'Chờ duyệt') FOR [TrangThai]
ALTER TABLE [dbo].[DangKySinhVienChoDuyet] ADD  CONSTRAINT [DF_DangKySinhVienChoDuyet_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[DangKySinhVienChoDuyet]  WITH CHECK ADD  CONSTRAINT [CK_DangKySinhVienChoDuyet_TrangThai] CHECK  (([TrangThai]=N'Từ chối' OR [TrangThai]=N'Đã duyệt' OR [TrangThai]=N'Chờ duyệt'))
ALTER TABLE [dbo].[DangKySinhVienChoDuyet] CHECK CONSTRAINT [CK_DangKySinhVienChoDuyet_TrangThai]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[DichVu](
	[MaDichVu] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TenDichVu] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DonVi] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[HoatDong] [bit] NOT NULL,
 CONSTRAINT [PK_DichVu] PRIMARY KEY CLUSTERED
(
	[MaDichVu] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON),
 CONSTRAINT [UQ_DichVu_Ten] UNIQUE NONCLUSTERED
(
	[TenDichVu] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

ALTER TABLE [dbo].[DichVu] ADD  CONSTRAINT [DF_DichVu_HoatDong]  DEFAULT ((1)) FOR [HoatDong]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[GiaHanHopDong](
	[MaGiaHan] [int] IDENTITY(1,1) NOT NULL,
	[MaHopDong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaChiTiet] [int] NOT NULL,
	[MaYeuCau] [nvarchar](7) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayKetThucCu] [date] NOT NULL,
	[NgayKetThucMoi] [date] NOT NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[HanThanhToan] [date] NOT NULL,
	[MaHoaDon] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [datetime2](0) NOT NULL,
	[NgayCapNhat] [datetime2](0) NOT NULL,
	[GhiChu] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_GiaHanHopDong] PRIMARY KEY CLUSTERED
(
	[MaGiaHan] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_GiaHanHopDong_MaHoaDon] ON [dbo].[GiaHanHopDong]
(
	[MaHoaDon] ASC
)
INCLUDE ( 	[MaGiaHan],
	[MaHopDong],
	[MaChiTiet],
	[TrangThai],
	[HanThanhToan]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
CREATE UNIQUE NONCLUSTERED INDEX [UX_GiaHanHopDong_MaChiTiet_ChoThanhToan] ON [dbo].[GiaHanHopDong]
(
	[MaChiTiet] ASC
)
WHERE ([TrangThai]=N'Chờ thanh toán')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[GiaHanHopDong] ADD  CONSTRAINT [DF_GiaHanHopDong_TrangThai]  DEFAULT (N'Chờ thanh toán') FOR [TrangThai]
ALTER TABLE [dbo].[GiaHanHopDong] ADD  CONSTRAINT [DF_GiaHanHopDong_NgayTao]  DEFAULT (sysutcdatetime()) FOR [NgayTao]
ALTER TABLE [dbo].[GiaHanHopDong] ADD  CONSTRAINT [DF_GiaHanHopDong_NgayCapNhat]  DEFAULT (sysutcdatetime()) FOR [NgayCapNhat]
ALTER TABLE [dbo].[GiaHanHopDong]  WITH CHECK ADD  CONSTRAINT [CK_GiaHanHopDong_Ngay] CHECK  (([NgayKetThucMoi]>[NgayKetThucCu]))
ALTER TABLE [dbo].[GiaHanHopDong] CHECK CONSTRAINT [CK_GiaHanHopDong_Ngay]
ALTER TABLE [dbo].[GiaHanHopDong]  WITH CHECK ADD  CONSTRAINT [CK_GiaHanHopDong_TrangThai] CHECK  (([TrangThai]=N'Hủy' OR [TrangThai]=N'Đã hiệu lực' OR [TrangThai]=N'Chờ thanh toán'))
ALTER TABLE [dbo].[GiaHanHopDong] CHECK CONSTRAINT [CK_GiaHanHopDong_TrangThai]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[GiaoDichThanhToan](
	[MaGiaoDich] [nvarchar](60) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaSinhVien] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TongTien] [decimal](18, 2) NOT NULL,
	[PhuongThuc] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NoiDungCK] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [datetime] NOT NULL,
	[NgayThanhToan] [datetime] NULL,
	[HetHanLuc] [datetime] NULL,
	[XacNhanBoi] [int] NULL,
	[LyDoTuChoi] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MaThamChieuNgoai] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LyDoDoiSoat] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SoTienThucNhan] [decimal](18, 2) NULL,
 CONSTRAINT [PK_GiaoDichThanhToan] PRIMARY KEY CLUSTERED
(
	[MaGiaoDich] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_GiaoDich_MaSinhVien_NgayTao] ON [dbo].[GiaoDichThanhToan]
(
	[MaSinhVien] ASC,
	[NgayTao] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_GiaoDich_TrangThai_PhuongThuc] ON [dbo].[GiaoDichThanhToan]
(
	[TrangThai] ASC,
	[PhuongThuc] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[GiaoDichThanhToan] ADD  CONSTRAINT [DF_GiaoDich_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[GiaoDichThanhToan]  WITH CHECK ADD  CONSTRAINT [CK_GiaoDich_CashSuccess] CHECK  ((NOT ([PhuongThuc]=N'CASH' AND [TrangThai]=N'SUCCESS') OR [XacNhanBoi] IS NOT NULL))
ALTER TABLE [dbo].[GiaoDichThanhToan] CHECK CONSTRAINT [CK_GiaoDich_CashSuccess]
ALTER TABLE [dbo].[GiaoDichThanhToan]  WITH CHECK ADD  CONSTRAINT [CK_GiaoDich_PhuongThuc] CHECK  (([PhuongThuc]=N'CASH' OR [PhuongThuc]=N'ONLINE'))
ALTER TABLE [dbo].[GiaoDichThanhToan] CHECK CONSTRAINT [CK_GiaoDich_PhuongThuc]
ALTER TABLE [dbo].[GiaoDichThanhToan]  WITH CHECK ADD  CONSTRAINT [CK_GiaoDich_SuccessNgay] CHECK  (([TrangThai]<>N'SUCCESS' OR [NgayThanhToan] IS NOT NULL))
ALTER TABLE [dbo].[GiaoDichThanhToan] CHECK CONSTRAINT [CK_GiaoDich_SuccessNgay]
ALTER TABLE [dbo].[GiaoDichThanhToan]  WITH CHECK ADD  CONSTRAINT [CK_GiaoDich_TongTien] CHECK  (([TongTien]>(0)))
ALTER TABLE [dbo].[GiaoDichThanhToan] CHECK CONSTRAINT [CK_GiaoDich_TongTien]
ALTER TABLE [dbo].[GiaoDichThanhToan]  WITH CHECK ADD  CONSTRAINT [CK_GiaoDich_TrangThai] CHECK  (([TrangThai]=N'RECONCILIATION' OR [TrangThai]=N'EXPIRED' OR [TrangThai]=N'REJECTED' OR [TrangThai]=N'SUCCESS' OR [TrangThai]=N'PENDING'))
ALTER TABLE [dbo].[GiaoDichThanhToan] CHECK CONSTRAINT [CK_GiaoDich_TrangThai]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[HangPhong](
	[MaHangPhong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TenHangPhong] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SucChuaToiDa] [int] NOT NULL,
	[GiaPhongThang] [decimal](18, 2) NOT NULL,
	[GiaPhongNam] [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_HangPhong] PRIMARY KEY CLUSTERED
(
	[MaHangPhong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON),
 CONSTRAINT [UQ_HangPhong_MaHang_SucChua] UNIQUE NONCLUSTERED
(
	[MaHangPhong] ASC,
	[SucChuaToiDa] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON),
 CONSTRAINT [UQ_HangPhong_Ten] UNIQUE NONCLUSTERED
(
	[TenHangPhong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

ALTER TABLE [dbo].[HangPhong]  WITH CHECK ADD  CONSTRAINT [CK_HangPhong_Gia] CHECK  (([GiaPhongThang]>=(0) AND [GiaPhongNam]>=(0)))
ALTER TABLE [dbo].[HangPhong] CHECK CONSTRAINT [CK_HangPhong_Gia]
ALTER TABLE [dbo].[HangPhong]  WITH CHECK ADD  CONSTRAINT [CK_HangPhong_SucChua] CHECK  (([SucChuaToiDa]>(0)))
ALTER TABLE [dbo].[HangPhong] CHECK CONSTRAINT [CK_HangPhong_SucChua]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[HangPhong_DichVu](
	[MaHangPhong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaDichVu] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DonGia] [decimal](18, 2) NOT NULL,
	[CachTinh] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DoiTuongThanhToan] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[HoatDong] [bit] NOT NULL,
 CONSTRAINT [PK_HangPhong_DichVu] PRIMARY KEY CLUSTERED
(
	[MaHangPhong] ASC,
	[MaDichVu] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

ALTER TABLE [dbo].[HangPhong_DichVu] ADD  CONSTRAINT [DF_HangPhong_DichVu_HoatDong]  DEFAULT ((1)) FOR [HoatDong]
ALTER TABLE [dbo].[HangPhong_DichVu]  WITH CHECK ADD  CONSTRAINT [CK_HPDV_CachTinh] CHECK  (([CachTinh]=N'CO_DINH_KY' OR [CachTinh]=N'CHI_SO'))
ALTER TABLE [dbo].[HangPhong_DichVu] CHECK CONSTRAINT [CK_HPDV_CachTinh]
ALTER TABLE [dbo].[HangPhong_DichVu]  WITH CHECK ADD  CONSTRAINT [CK_HPDV_DoiTuong] CHECK  (([DoiTuongThanhToan]=N'CA_NHAN' OR [DoiTuongThanhToan]=N'PHONG'))
ALTER TABLE [dbo].[HangPhong_DichVu] CHECK CONSTRAINT [CK_HPDV_DoiTuong]
ALTER TABLE [dbo].[HangPhong_DichVu]  WITH CHECK ADD  CONSTRAINT [CK_HPDV_DonGia] CHECK  (([DonGia]>=(0)))
ALTER TABLE [dbo].[HangPhong_DichVu] CHECK CONSTRAINT [CK_HPDV_DonGia]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[HoaDon](
	[MaHoaDon] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaSinhVien] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TenPhong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgayLap] [date] NULL,
	[TienPhong] [decimal](18, 2) NULL,
	[ChiSoDien] [int] NULL,
	[ChiSoNuoc] [int] NULL,
	[TienDien] [decimal](18, 2) NULL,
	[TienNuoc] [decimal](18, 2) NULL,
	[TongTien]  AS (([TienPhong]+[TienDien])+[TienNuoc]),
	[TrangThaiThanhToan] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SoDienCu] [int] NULL,
	[SoDienMoi] [int] NULL,
	[SoNuocCu] [int] NULL,
	[SoNuocMoi] [int] NULL,
	[HanThanhToan] [date] NULL,
	[PhuongThucThanhToan] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayThanhToan] [datetime] NULL,
	[GhiChuThanhToan] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[LoaiHoaDon] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaHopDong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MaChiTiet] [int] NULL,
	[KyThanhToan] [date] NULL,
	[KyThanhToanDen] [date] NULL,
PRIMARY KEY CLUSTERED
(
	[MaHoaDon] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_HoaDon_MaChiTiet_Ky] ON [dbo].[HoaDon]
(
	[MaChiTiet] ASC,
	[KyThanhToan] ASC,
	[KyThanhToanDen] ASC
)
INCLUDE ( 	[LoaiHoaDon],
	[TrangThaiThanhToan],
	[MaHoaDon]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_HoaDon_MaHopDong_Ky] ON [dbo].[HoaDon]
(
	[MaHopDong] ASC,
	[KyThanhToan] ASC,
	[KyThanhToanDen] ASC
)
INCLUDE ( 	[LoaiHoaDon],
	[TrangThaiThanhToan],
	[MaHoaDon]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_HoaDon_MaSinhVien_NgayLap] ON [dbo].[HoaDon]
(
	[MaSinhVien] ASC,
	[NgayLap] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_HoaDon_TrangThai_NgayLap] ON [dbo].[HoaDon]
(
	[TrangThaiThanhToan] ASC,
	[NgayLap] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_HoaDon_DichVuPhong_HopDong_Ky] ON [dbo].[HoaDon]
(
	[MaHopDong] ASC,
	[KyThanhToan] ASC
)
WHERE ([LoaiHoaDon]=N'DICH_VU_PHONG' AND [TrangThaiThanhToan]<>N'Đã hủy' AND [MaHopDong] IS NOT NULL AND [KyThanhToan] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
CREATE UNIQUE NONCLUSTERED INDEX [UX_HoaDon_TienPhong_ChiTiet_Ky] ON [dbo].[HoaDon]
(
	[MaChiTiet] ASC,
	[KyThanhToan] ASC
)
WHERE ([LoaiHoaDon]=N'TIEN_PHONG' AND [TrangThaiThanhToan]<>N'Đã hủy' AND [MaChiTiet] IS NOT NULL AND [KyThanhToan] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT (getdate()) FOR [NgayLap]
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [TienPhong]
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [ChiSoDien]
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [ChiSoNuoc]
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [TienDien]
ALTER TABLE [dbo].[HoaDon] ADD  DEFAULT ((0)) FOR [TienNuoc]
ALTER TABLE [dbo].[HoaDon] ADD  CONSTRAINT [DF_HoaDon_LoaiHoaDon]  DEFAULT (N'CU') FOR [LoaiHoaDon]
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([ChiSoDien]>=(0)))
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([ChiSoNuoc]>=(0)))
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([NgayLap]<=getdate()))
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([TienDien]>=(0)))
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([TienNuoc]>=(0)))
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD CHECK  (([TienPhong]>=(0)))
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD  CONSTRAINT [CK_HoaDon_KyThanhToan] CHECK  (([LoaiHoaDon]=N'CU' OR [KyThanhToan] IS NOT NULL AND [KyThanhToanDen] IS NOT NULL AND [KyThanhToanDen]>=[KyThanhToan]))
ALTER TABLE [dbo].[HoaDon] CHECK CONSTRAINT [CK_HoaDon_KyThanhToan]
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD  CONSTRAINT [CK_HoaDon_LoaiHoaDon] CHECK  (([LoaiHoaDon]=N'CU' OR [LoaiHoaDon]=N'PHAT_SINH' OR [LoaiHoaDon]=N'DICH_VU_PHONG' OR [LoaiHoaDon]=N'TIEN_PHONG'))
ALTER TABLE [dbo].[HoaDon] CHECK CONSTRAINT [CK_HoaDon_LoaiHoaDon]
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD  CONSTRAINT [CK_HoaDon_TrangThaiThanhToan] CHECK  (([TrangThaiThanhToan]=N'Đã hủy' OR [TrangThaiThanhToan]=N'Đã thanh toán' OR [TrangThaiThanhToan]=N'Thanh toán một phần' OR [TrangThaiThanhToan]=N'Chưa thanh toán'))
ALTER TABLE [dbo].[HoaDon] CHECK CONSTRAINT [CK_HoaDon_TrangThaiThanhToan]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[HoanTienChuyenKhoanDu](
	[MaHoanTien] [bigint] IDENTITY(1,1) NOT NULL,
	[MaGiaoDich] [nvarchar](60) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaHoaDon] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SoTien] [decimal](18, 2) NOT NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NguoiTra] [int] NULL,
	[ThoiDiemTra] [datetime] NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [datetime] NOT NULL,
 CONSTRAINT [PK_HoanTienChuyenKhoanDu] PRIMARY KEY CLUSTERED
(
	[MaHoanTien] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON),
 CONSTRAINT [UQ_HoanTienChuyenKhoanDu_MaGiaoDich] UNIQUE NONCLUSTERED
(
	[MaGiaoDich] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_HoanTienChuyenKhoanDu_HoaDon_TrangThai] ON [dbo].[HoanTienChuyenKhoanDu]
(
	[MaHoaDon] ASC,
	[TrangThai] ASC
)
INCLUDE ( 	[SoTien],
	[MaGiaoDich]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu] ADD  CONSTRAINT [DF_HoanTienChuyenKhoanDu_TrangThai]  DEFAULT (N'CHO_HOAN') FOR [TrangThai]
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu] ADD  CONSTRAINT [DF_HoanTienChuyenKhoanDu_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu]  WITH CHECK ADD  CONSTRAINT [CK_HoanTienChuyenKhoanDu_DaHoan] CHECK  (([TrangThai]=N'CHO_HOAN' AND [NguoiTra] IS NULL AND [ThoiDiemTra] IS NULL OR [TrangThai]=N'DA_HOAN' AND [NguoiTra] IS NOT NULL AND [ThoiDiemTra] IS NOT NULL))
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu] CHECK CONSTRAINT [CK_HoanTienChuyenKhoanDu_DaHoan]
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu]  WITH CHECK ADD  CONSTRAINT [CK_HoanTienChuyenKhoanDu_SoTien] CHECK  (([SoTien]>(0)))
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu] CHECK CONSTRAINT [CK_HoanTienChuyenKhoanDu_SoTien]
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu]  WITH CHECK ADD  CONSTRAINT [CK_HoanTienChuyenKhoanDu_TrangThai] CHECK  (([TrangThai]=N'DA_HOAN' OR [TrangThai]=N'CHO_HOAN'))
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu] CHECK CONSTRAINT [CK_HoanTienChuyenKhoanDu_TrangThai]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[HopDong](
	[MaHopDong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TenPhong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgayBatDau] [date] NOT NULL,
	[NgayKetThuc] [date] NOT NULL,
	[TrangThaiHopDong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [date] NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayKetThucThucTe] [date] NULL,
	[NgayKetThucGoc] [date] NULL,
	[SoLanGiaHan] [int] NOT NULL,
	[MaHangPhong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
PRIMARY KEY CLUSTERED
(
	[MaHopDong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

CREATE NONCLUSTERED INDEX [IX_HopDong_NgayKetThuc] ON [dbo].[HopDong]
(
	[NgayKetThuc] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_HopDong_Phong_TrangThai] ON [dbo].[HopDong]
(
	[TenPhong] ASC,
	[TrangThaiHopDong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[HopDong] ADD  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[HopDong] ADD  CONSTRAINT [DF_HopDong_SoLanGiaHan]  DEFAULT ((0)) FOR [SoLanGiaHan]
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD CHECK  (([NgayTao]<=getdate()))
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD CHECK  (([TrangThaiHopDong]=N'Đã kết thúc' OR [TrangThaiHopDong]=N'Còn hiệu lực'))
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD  CONSTRAINT [CK_NgayHopDong] CHECK  (([NgayKetThuc]>[NgayBatDau]))
ALTER TABLE [dbo].[HopDong] CHECK CONSTRAINT [CK_NgayHopDong]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[LichSuHopDong_Backup](
	[MaLichSu] [int] NOT NULL,
	[MaHopDong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaSinhVien] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[HoTen] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TenPhong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayBatDau] [date] NULL,
	[NgayKetThuc] [date] NULL,
	[TrangThaiHopDong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ThaoTac] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NguoiThucHien] [int] NULL,
	[ThoiGian] [datetime] NOT NULL,
 CONSTRAINT [PK_LichSuHopDong_Backup] PRIMARY KEY CLUSTERED
(
	[MaLichSu] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[MaHoaDonCounter](
	[Ky] [char](6) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SoCuoi] [int] NOT NULL,
 CONSTRAINT [PK_MaHoaDonCounter] PRIMARY KEY CLUSTERED
(
	[Ky] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

ALTER TABLE [dbo].[MaHoaDonCounter]  WITH CHECK ADD  CONSTRAINT [CK_MaHoaDonCounter_SoCuoi] CHECK  (([SoCuoi]>=(0) AND [SoCuoi]<=(9999)))
ALTER TABLE [dbo].[MaHoaDonCounter] CHECK CONSTRAINT [CK_MaHoaDonCounter_SoCuoi]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[NhatKyHeThong](
	[MaNhatKy] [bigint] IDENTITY(1,1) NOT NULL,
	[ThoiGian] [datetime] NOT NULL,
	[MaTaiKhoan] [int] NULL,
	[HanhDong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[DoiTuong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MaDoiTuong] [nvarchar](60) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[ChiTiet] [nvarchar](max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_NhatKyHeThong] PRIMARY KEY CLUSTERED
(
	[MaNhatKy] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

ALTER TABLE [dbo].[NhatKyHeThong] ADD  CONSTRAINT [DF_NhatKy_ThoiGian]  DEFAULT (getdate()) FOR [ThoiGian]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[PhieuChi](
	[MaPhieuChi] [bigint] IDENTITY(1,1) NOT NULL,
	[MaChiTiet] [int] NOT NULL,
	[SoTienDaDong] [decimal](18, 2) NOT NULL,
	[SoTienDaSuDung] [decimal](18, 2) NOT NULL,
	[KhauTru] [decimal](18, 2) NOT NULL,
	[SoTien] [decimal](18, 2) NOT NULL,
	[NgayRa] [date] NOT NULL,
	[LyDo] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgayChi] [datetime] NOT NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NguoiLap] [int] NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [datetime] NOT NULL,
 CONSTRAINT [PK_PhieuChi] PRIMARY KEY CLUSTERED
(
	[MaPhieuChi] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_PhieuChi_ChiTiet_TrangThai] ON [dbo].[PhieuChi]
(
	[MaChiTiet] ASC,
	[TrangThai] ASC,
	[NgayChi] ASC
)
INCLUDE ( 	[SoTien],
	[SoTienDaDong],
	[SoTienDaSuDung],
	[KhauTru]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[PhieuChi] ADD  CONSTRAINT [DF_PhieuChi_KhauTru]  DEFAULT ((0)) FOR [KhauTru]
ALTER TABLE [dbo].[PhieuChi] ADD  CONSTRAINT [DF_PhieuChi_NgayChi]  DEFAULT (getdate()) FOR [NgayChi]
ALTER TABLE [dbo].[PhieuChi] ADD  CONSTRAINT [DF_PhieuChi_TrangThai]  DEFAULT (N'Chờ duyệt') FOR [TrangThai]
ALTER TABLE [dbo].[PhieuChi] ADD  CONSTRAINT [DF_PhieuChi_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[PhieuChi]  WITH CHECK ADD  CONSTRAINT [CK_PhieuChi_LyDo] CHECK  (([LyDo]=N'Trả phòng sớm' OR [LyDo]=N'Khác' OR [LyDo]=N'Chuyển đi' OR [LyDo]=N'Nghỉ học giữa chừng'))
ALTER TABLE [dbo].[PhieuChi] CHECK CONSTRAINT [CK_PhieuChi_LyDo]
ALTER TABLE [dbo].[PhieuChi]  WITH CHECK ADD  CONSTRAINT [CK_PhieuChi_SoTien] CHECK  (([SoTien]>(0) AND [SoTienDaDong]>=(0) AND [SoTienDaSuDung]>=(0) AND [KhauTru]>=(0)))
ALTER TABLE [dbo].[PhieuChi] CHECK CONSTRAINT [CK_PhieuChi_SoTien]
ALTER TABLE [dbo].[PhieuChi]  WITH CHECK ADD  CONSTRAINT [CK_PhieuChi_TrangThai] CHECK  (([TrangThai]=N'Đã hủy' OR [TrangThai]=N'Chờ duyệt' OR [TrangThai]=N'Hợp lệ'))
ALTER TABLE [dbo].[PhieuChi] CHECK CONSTRAINT [CK_PhieuChi_TrangThai]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[PhieuChi_HoaDon](
	[MaPhieuChi] [bigint] NOT NULL,
	[MaHoaDon] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SoTien] [decimal](18, 2) NOT NULL,
 CONSTRAINT [PK_PhieuChi_HoaDon] PRIMARY KEY CLUSTERED
(
	[MaPhieuChi] ASC,
	[MaHoaDon] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_PhieuChi_HoaDon_HoaDon] ON [dbo].[PhieuChi_HoaDon]
(
	[MaHoaDon] ASC,
	[MaPhieuChi] ASC
)
INCLUDE ( 	[SoTien]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[PhieuChi_HoaDon]  WITH CHECK ADD  CONSTRAINT [CK_PhieuChi_HoaDon_SoTien] CHECK  (([SoTien]>(0)))
ALTER TABLE [dbo].[PhieuChi_HoaDon] CHECK CONSTRAINT [CK_PhieuChi_HoaDon_SoTien]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[PhieuThu](
	[MaPhieuThu] [bigint] IDENTITY(1,1) NOT NULL,
	[MaHoaDon] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaGiaoDich] [nvarchar](60) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SoTien] [decimal](18, 2) NOT NULL,
	[NgayThu] [datetime] NOT NULL,
	[PhuongThuc] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaSinhVienNop] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NguoiThu] [int] NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MaThamChieu] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [datetime] NOT NULL,
 CONSTRAINT [PK_PhieuThu] PRIMARY KEY CLUSTERED
(
	[MaPhieuThu] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_PhieuThu_HoaDon_TrangThai_NgayThu] ON [dbo].[PhieuThu]
(
	[MaHoaDon] ASC,
	[TrangThai] ASC,
	[NgayThu] ASC
)
INCLUDE ( 	[SoTien],
	[MaGiaoDich]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_PhieuThu_GiaoDich_HoaDon] ON [dbo].[PhieuThu]
(
	[MaGiaoDich] ASC,
	[MaHoaDon] ASC
)
WHERE ([MaGiaoDich] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_PhieuThu_MaGiaoDich_ChuaHuy] ON [dbo].[PhieuThu]
(
	[MaGiaoDich] ASC
)
WHERE ([MaGiaoDich] IS NOT NULL AND [TrangThai]<>N'Đã hủy')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[PhieuThu] ADD  CONSTRAINT [DF_PhieuThu_NgayThu]  DEFAULT (getdate()) FOR [NgayThu]
ALTER TABLE [dbo].[PhieuThu] ADD  CONSTRAINT [DF_PhieuThu_TrangThai]  DEFAULT (N'Hợp lệ') FOR [TrangThai]
ALTER TABLE [dbo].[PhieuThu] ADD  CONSTRAINT [DF_PhieuThu_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[PhieuThu]  WITH CHECK ADD  CONSTRAINT [CK_PhieuThu_PhuongThuc] CHECK  (([PhuongThuc]=N'CHUYEN_DOI' OR [PhuongThuc]=N'ONLINE' OR [PhuongThuc]=N'CASH'))
ALTER TABLE [dbo].[PhieuThu] CHECK CONSTRAINT [CK_PhieuThu_PhuongThuc]
ALTER TABLE [dbo].[PhieuThu]  WITH CHECK ADD  CONSTRAINT [CK_PhieuThu_SoTien] CHECK  (([SoTien]>(0)))
ALTER TABLE [dbo].[PhieuThu] CHECK CONSTRAINT [CK_PhieuThu_SoTien]
ALTER TABLE [dbo].[PhieuThu]  WITH CHECK ADD  CONSTRAINT [CK_PhieuThu_TrangThai] CHECK  (([TrangThai]=N'Đã hủy' OR [TrangThai]=N'Chờ xác nhận' OR [TrangThai]=N'Hợp lệ'))
ALTER TABLE [dbo].[PhieuThu] CHECK CONSTRAINT [CK_PhieuThu_TrangThai]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[Phong](
	[TenPhong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LoaiPhong] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SucChuaToiDa] [int] NOT NULL,
	[SoSinhVienHienTai] [int] NULL,
	[TrangThaiPhong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Khu] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[GiaPhong] [decimal](18, 2) NOT NULL,
	[MaHangPhong] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
PRIMARY KEY CLUSTERED
(
	[TenPhong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_Phong_Khu_Loai_TrangThai] ON [dbo].[Phong]
(
	[Khu] ASC,
	[LoaiPhong] ASC,
	[TrangThaiPhong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[Phong] ADD  DEFAULT ((0)) FOR [SoSinhVienHienTai]
ALTER TABLE [dbo].[Phong] ADD  CONSTRAINT [DF_Phong_GiaPhong]  DEFAULT ((0)) FOR [GiaPhong]
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD CHECK  (([Khu]='C' OR [Khu]='B' OR [Khu]='A'))
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD CHECK  (([SoSinhVienHienTai]>=(0)))
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD CHECK  (([SucChuaToiDa]=(8) OR [SucChuaToiDa]=(6) OR [SucChuaToiDa]=(4)))
ALTER TABLE [dbo].[Phong]  WITH NOCHECK ADD CHECK  (([TrangThaiPhong]=N'Ngưng sử dụng' OR [TrangThaiPhong]=N'Bảo trì' OR [TrangThaiPhong]=N'Đầy' OR [TrangThaiPhong]=N'Trống'))
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD  CONSTRAINT [CK_Phong_LoaiPhong] CHECK  (([LoaiPhong]=N'Nữ' OR [LoaiPhong]=N'Nam'))
ALTER TABLE [dbo].[Phong] CHECK CONSTRAINT [CK_Phong_LoaiPhong]
ALTER TABLE [dbo].[Phong]  WITH NOCHECK ADD  CONSTRAINT [CK_SoLuong] CHECK  (([SoSinhVienHienTai]<=[SucChuaToiDa]))
ALTER TABLE [dbo].[Phong] CHECK CONSTRAINT [CK_SoLuong]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[SchemaMigration](
	[MaMigration] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TenFile] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[ThoiGian] [datetime] NOT NULL,
 CONSTRAINT [PK_SchemaMigration] PRIMARY KEY CLUSTERED
(
	[MaMigration] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

ALTER TABLE [dbo].[SchemaMigration] ADD  CONSTRAINT [DF_SchemaMigration_ThoiGian]  DEFAULT (getdate()) FOR [ThoiGian]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[SinhVien](
	[MaSinhVien] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[HoTen] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgaySinh] [date] NULL,
	[GioiTinh] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[SoDienThoai] [char](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Email] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[DiaChi] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TrangThaiSinhVien] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TenPhong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[GhiChu] [nvarchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Truong] [nvarchar](150) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[Lop] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayRoiKTX] [date] NULL,
	[NgayTao] [datetime] NULL,
 CONSTRAINT [PK__SinhVien__939AE77565DE2B04] PRIMARY KEY CLUSTERED
(
	[MaSinhVien] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_SinhVien_HoTen] ON [dbo].[SinhVien]
(
	[HoTen] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_SinhVien_TrangThai_TenPhong] ON [dbo].[SinhVien]
(
	[TrangThaiSinhVien] ASC,
	[TenPhong] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UQ_SinhVien_Email] ON [dbo].[SinhVien]
(
	[Email] ASC
)
WHERE ([Email] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[SinhVien] ADD  CONSTRAINT [DF_SinhVien_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[SinhVien]  WITH CHECK ADD CHECK  (([GioiTinh]=N'Khác' OR [GioiTinh]=N'Nữ' OR [GioiTinh]=N'Nam'))
ALTER TABLE [dbo].[SinhVien]  WITH CHECK ADD CHECK  (([NgaySinh]<getdate()))
ALTER TABLE [dbo].[SinhVien]  WITH CHECK ADD CHECK  (([TrangThaiSinhVien]=N'Đã rời KTX' OR [TrangThaiSinhVien]=N'Đang ở'))
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[TaiKhoan](
	[MaTaiKhoan] [int] IDENTITY(1,1) NOT NULL,
	[Email] [varchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[MatKhau] [varchar](255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TenHienThi] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[SoDienThoai] [varchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[VaiTro] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[LanDangNhapCuoi] [datetime] NULL,
	[MaSinhVien] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TrangThai] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgayTao] [datetime] NULL,
	[SoLanDangNhapSai] [int] NOT NULL,
	[KhoaDenLuc] [datetime] NULL,
PRIMARY KEY CLUSTERED
(
	[MaTaiKhoan] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON),
UNIQUE NONCLUSTERED
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UQ_TaiKhoan_MaSinhVien] ON [dbo].[TaiKhoan]
(
	[MaSinhVien] ASC
)
WHERE ([MaSinhVien] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[TaiKhoan] ADD  DEFAULT (getdate()) FOR [LanDangNhapCuoi]
ALTER TABLE [dbo].[TaiKhoan] ADD  CONSTRAINT [DF_TaiKhoan_TrangThai]  DEFAULT (N'Hoạt động') FOR [TrangThai]
ALTER TABLE [dbo].[TaiKhoan] ADD  CONSTRAINT [DF_TaiKhoan_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[TaiKhoan] ADD  CONSTRAINT [DF_TaiKhoan_SoLanDangNhapSai]  DEFAULT ((0)) FOR [SoLanDangNhapSai]
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD CHECK  (([Email] like '%@%.%'))
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD CHECK  ((len([MatKhau])>=(6)))
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD CHECK  (([SoDienThoai] like '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'))
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD  CONSTRAINT [CK_TaiKhoan_SinhVienGmail] CHECK  (([VaiTro]<>N'Sinh viên' OR [MaSinhVien] IS NOT NULL AND [Email] like N'%@gmail.com'))
ALTER TABLE [dbo].[TaiKhoan] CHECK CONSTRAINT [CK_TaiKhoan_SinhVienGmail]
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD  CONSTRAINT [CK_TaiKhoan_TrangThai] CHECK  (([TrangThai]=N'Khóa' OR [TrangThai]=N'Hoạt động'))
ALTER TABLE [dbo].[TaiKhoan] CHECK CONSTRAINT [CK_TaiKhoan_TrangThai]
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD  CONSTRAINT [CK_TaiKhoan_VaiTro] CHECK  (([VaiTro]=N'Sinh viên' OR [VaiTro]=N'Quản lý'))
ALTER TABLE [dbo].[TaiKhoan] CHECK CONSTRAINT [CK_TaiKhoan_VaiTro]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
CREATE TABLE [dbo].[ThongBao](
	[MaThongBao] [bigint] IDENTITY(1,1) NOT NULL,
	[TieuDe] [nvarchar](200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NoiDung] [nvarchar](2000) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PhamViNhan] [nvarchar](10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[TenPhong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MaSinhVien] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NguoiTao] [int] NOT NULL,
	[NgayTao] [datetime2](0) NOT NULL,
	[DaXoa] [bit] NOT NULL,
	[MaHoaDon] [nvarchar](20) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[MaSuKien] [nvarchar](100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 CONSTRAINT [PK_ThongBao] PRIMARY KEY CLUSTERED
(
	[MaThongBao] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_ThongBao_MaHoaDon_NgayTao] ON [dbo].[ThongBao]
(
	[MaHoaDon] ASC,
	[NgayTao] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_ThongBao_NgayTao] ON [dbo].[ThongBao]
(
	[NgayTao] DESC,
	[MaThongBao] DESC
)
INCLUDE ( 	[DaXoa],
	[PhamViNhan],
	[TenPhong],
	[MaSinhVien]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_ThongBao_MaSuKien_MaSinhVien] ON [dbo].[ThongBao]
(
	[MaSuKien] ASC,
	[MaSinhVien] ASC
)
WHERE ([MaSuKien] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[ThongBao] ADD  CONSTRAINT [DF_ThongBao_NgayTao]  DEFAULT (sysdatetime()) FOR [NgayTao]
ALTER TABLE [dbo].[ThongBao] ADD  CONSTRAINT [DF_ThongBao_DaXoa]  DEFAULT ((0)) FOR [DaXoa]
ALTER TABLE [dbo].[ThongBao]  WITH CHECK ADD  CONSTRAINT [CK_ThongBao_DoiTuong] CHECK  (([PhamViNhan]=N'TAT_CA' AND [TenPhong] IS NULL AND [MaSinhVien] IS NULL OR [PhamViNhan]=N'PHONG' AND [TenPhong] IS NOT NULL AND [MaSinhVien] IS NULL OR [PhamViNhan]=N'SINH_VIEN' AND [TenPhong] IS NULL AND [MaSinhVien] IS NOT NULL))
ALTER TABLE [dbo].[ThongBao] CHECK CONSTRAINT [CK_ThongBao_DoiTuong]
ALTER TABLE [dbo].[ThongBao]  WITH CHECK ADD  CONSTRAINT [CK_ThongBao_PhamVi] CHECK  (([PhamViNhan]=N'SINH_VIEN' OR [PhamViNhan]=N'PHONG' OR [PhamViNhan]=N'TAT_CA'))
ALTER TABLE [dbo].[ThongBao] CHECK CONSTRAINT [CK_ThongBao_PhamVi]
GO
SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
SET ARITHABORT ON
CREATE TABLE [dbo].[YeuCauSinhVien](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MaYeuCau]  AS (N'YC'+right(N'00000'+CONVERT([varchar](10),[Id]),(5))) PERSISTED,
	[MaSinhVien] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[Loai] [nvarchar](30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NoiDung] [nvarchar](1000) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[NgayKetThucDeXuat] [date] NULL,
	[TenPhong] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[TrangThai] [nvarchar](15) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
	[PhanHoi] [nvarchar](500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[NgayTao] [datetime] NOT NULL,
	[NgayXuLy] [datetime] NULL,
	[XuLyBoi] [int] NULL,
 CONSTRAINT [PK_YeuCauSinhVien] PRIMARY KEY CLUSTERED
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON),
 CONSTRAINT [UQ_YeuCauSinhVien_MaYeuCau] UNIQUE NONCLUSTERED
(
	[MaYeuCau] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
)

SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_YeuCau_MaSinhVien_NgayTao] ON [dbo].[YeuCauSinhVien]
(
	[MaSinhVien] ASC,
	[NgayTao] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE NONCLUSTERED INDEX [IX_YeuCau_TrangThai_Loai] ON [dbo].[YeuCauSinhVien]
(
	[TrangThai] ASC,
	[Loai] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
SET ANSI_PADDING ON

CREATE UNIQUE NONCLUSTERED INDEX [UX_YeuCau_TraPhongSom_ChoDuyet] ON [dbo].[YeuCauSinhVien]
(
	[MaSinhVien] ASC
)
WHERE ([Loai]=N'Trả phòng sớm' AND [TrangThai]=N'Chờ duyệt')
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON)
ALTER TABLE [dbo].[YeuCauSinhVien] ADD  CONSTRAINT [DF_YeuCau_TrangThai]  DEFAULT (N'Chờ duyệt') FOR [TrangThai]
ALTER TABLE [dbo].[YeuCauSinhVien] ADD  CONSTRAINT [DF_YeuCau_NgayTao]  DEFAULT (getdate()) FOR [NgayTao]
ALTER TABLE [dbo].[YeuCauSinhVien]  WITH CHECK ADD  CONSTRAINT [CK_YeuCau_GiaHanNgay] CHECK  (([Loai]<>N'Gia hạn hợp đồng' OR [NgayKetThucDeXuat] IS NOT NULL))
ALTER TABLE [dbo].[YeuCauSinhVien] CHECK CONSTRAINT [CK_YeuCau_GiaHanNgay]
ALTER TABLE [dbo].[YeuCauSinhVien]  WITH CHECK ADD  CONSTRAINT [CK_YeuCau_Loai] CHECK  (([Loai]=N'Trả phòng sớm' OR [Loai]=N'Yêu cầu khác' OR [Loai]=N'Báo hỏng thiết bị' OR [Loai]=N'Gia hạn hợp đồng'))
ALTER TABLE [dbo].[YeuCauSinhVien] CHECK CONSTRAINT [CK_YeuCau_Loai]
ALTER TABLE [dbo].[YeuCauSinhVien]  WITH CHECK ADD  CONSTRAINT [CK_YeuCau_NgayXuLy] CHECK  (([TrangThai]=N'Chờ duyệt' OR [NgayXuLy] IS NOT NULL))
ALTER TABLE [dbo].[YeuCauSinhVien] CHECK CONSTRAINT [CK_YeuCau_NgayXuLy]
ALTER TABLE [dbo].[YeuCauSinhVien]  WITH CHECK ADD  CONSTRAINT [CK_YeuCau_TrangThai] CHECK  (([TrangThai]=N'Từ chối' OR [TrangThai]=N'Đã duyệt' OR [TrangThai]=N'Chờ duyệt'))
ALTER TABLE [dbo].[YeuCauSinhVien] CHECK CONSTRAINT [CK_YeuCau_TrangThai]
ALTER TABLE [dbo].[YeuCauSinhVien]  WITH CHECK ADD  CONSTRAINT [CK_YeuCau_TraPhongSom_Ngay] CHECK  (([Loai]<>N'Trả phòng sớm' OR [NgayKetThucDeXuat] IS NOT NULL))
ALTER TABLE [dbo].[YeuCauSinhVien] CHECK CONSTRAINT [CK_YeuCau_TraPhongSom_Ngay]
GO
ALTER TABLE [dbo].[ChiPhiPhatSinh]  WITH CHECK ADD  CONSTRAINT [FK_ChiPhiPhatSinh_ChiTiet] FOREIGN KEY([MaChiTiet])
REFERENCES [dbo].[ChiTietHopDong] ([MaChiTiet])
ALTER TABLE [dbo].[ChiPhiPhatSinh] CHECK CONSTRAINT [FK_ChiPhiPhatSinh_ChiTiet]
GO
ALTER TABLE [dbo].[ChiPhiPhatSinh]  WITH CHECK ADD  CONSTRAINT [FK_ChiPhiPhatSinh_ChiTietHoaDon] FOREIGN KEY([MaChiTietHoaDon])
REFERENCES [dbo].[ChiTietHoaDon] ([MaChiTiet])
ALTER TABLE [dbo].[ChiPhiPhatSinh] CHECK CONSTRAINT [FK_ChiPhiPhatSinh_ChiTietHoaDon]
GO
ALTER TABLE [dbo].[ChiPhiPhatSinh]  WITH CHECK ADD  CONSTRAINT [FK_ChiPhiPhatSinh_HopDong] FOREIGN KEY([MaHopDong])
REFERENCES [dbo].[HopDong] ([MaHopDong])
ALTER TABLE [dbo].[ChiPhiPhatSinh] CHECK CONSTRAINT [FK_ChiPhiPhatSinh_HopDong]
GO
ALTER TABLE [dbo].[ChiPhiPhatSinh]  WITH CHECK ADD  CONSTRAINT [FK_ChiPhiPhatSinh_NguoiNhap] FOREIGN KEY([NguoiNhap])
REFERENCES [dbo].[TaiKhoan] ([MaTaiKhoan])
ALTER TABLE [dbo].[ChiPhiPhatSinh] CHECK CONSTRAINT [FK_ChiPhiPhatSinh_NguoiNhap]
GO
ALTER TABLE [dbo].[ChiTietHoaDon]  WITH CHECK ADD  CONSTRAINT [FK_ChiTietHoaDon_DichVu] FOREIGN KEY([MaDichVu])
REFERENCES [dbo].[DichVu] ([MaDichVu])
ALTER TABLE [dbo].[ChiTietHoaDon] CHECK CONSTRAINT [FK_ChiTietHoaDon_DichVu]
GO
ALTER TABLE [dbo].[ChiTietHoaDon]  WITH CHECK ADD  CONSTRAINT [FK_ChiTietHoaDon_HoaDon] FOREIGN KEY([MaHoaDon])
REFERENCES [dbo].[HoaDon] ([MaHoaDon])
ON DELETE CASCADE
ALTER TABLE [dbo].[ChiTietHoaDon] CHECK CONSTRAINT [FK_ChiTietHoaDon_HoaDon]
GO
ALTER TABLE [dbo].[ChiTietHopDong]  WITH CHECK ADD  CONSTRAINT [FK_CTHD_HopDong] FOREIGN KEY([MaHopDong])
REFERENCES [dbo].[HopDong] ([MaHopDong])
ALTER TABLE [dbo].[ChiTietHopDong] CHECK CONSTRAINT [FK_CTHD_HopDong]
GO
ALTER TABLE [dbo].[ChiTietHopDong]  WITH CHECK ADD  CONSTRAINT [FK_CTHD_SinhVien] FOREIGN KEY([MaSinhVien])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
ALTER TABLE [dbo].[ChiTietHopDong] CHECK CONSTRAINT [FK_CTHD_SinhVien]
GO
ALTER TABLE [dbo].[DangKySinhVienChoDuyet]  WITH CHECK ADD  CONSTRAINT [FK_DangKySinhVienChoDuyet_TaiKhoan] FOREIGN KEY([XuLyBoi])
REFERENCES [dbo].[TaiKhoan] ([MaTaiKhoan])
ALTER TABLE [dbo].[DangKySinhVienChoDuyet] CHECK CONSTRAINT [FK_DangKySinhVienChoDuyet_TaiKhoan]
GO
ALTER TABLE [dbo].[GiaHanHopDong]  WITH CHECK ADD  CONSTRAINT [FK_GiaHanHopDong_ChiTietHopDong] FOREIGN KEY([MaChiTiet])
REFERENCES [dbo].[ChiTietHopDong] ([MaChiTiet])
ALTER TABLE [dbo].[GiaHanHopDong] CHECK CONSTRAINT [FK_GiaHanHopDong_ChiTietHopDong]
GO
ALTER TABLE [dbo].[GiaHanHopDong]  WITH CHECK ADD  CONSTRAINT [FK_GiaHanHopDong_HoaDon] FOREIGN KEY([MaHoaDon])
REFERENCES [dbo].[HoaDon] ([MaHoaDon])
ALTER TABLE [dbo].[GiaHanHopDong] CHECK CONSTRAINT [FK_GiaHanHopDong_HoaDon]
GO
ALTER TABLE [dbo].[GiaHanHopDong]  WITH CHECK ADD  CONSTRAINT [FK_GiaHanHopDong_HopDong] FOREIGN KEY([MaHopDong])
REFERENCES [dbo].[HopDong] ([MaHopDong])
ALTER TABLE [dbo].[GiaHanHopDong] CHECK CONSTRAINT [FK_GiaHanHopDong_HopDong]
GO
ALTER TABLE [dbo].[GiaHanHopDong]  WITH CHECK ADD  CONSTRAINT [FK_GiaHanHopDong_YeuCauSinhVien] FOREIGN KEY([MaYeuCau])
REFERENCES [dbo].[YeuCauSinhVien] ([MaYeuCau])
ALTER TABLE [dbo].[GiaHanHopDong] CHECK CONSTRAINT [FK_GiaHanHopDong_YeuCauSinhVien]
GO
ALTER TABLE [dbo].[GiaoDichThanhToan]  WITH CHECK ADD  CONSTRAINT [FK_GiaoDich_SinhVien] FOREIGN KEY([MaSinhVien])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
ALTER TABLE [dbo].[GiaoDichThanhToan] CHECK CONSTRAINT [FK_GiaoDich_SinhVien]
GO
ALTER TABLE [dbo].[GiaoDichThanhToan]  WITH CHECK ADD  CONSTRAINT [FK_GiaoDich_XacNhanBoi] FOREIGN KEY([XacNhanBoi])
REFERENCES [dbo].[TaiKhoan] ([MaTaiKhoan])
ALTER TABLE [dbo].[GiaoDichThanhToan] CHECK CONSTRAINT [FK_GiaoDich_XacNhanBoi]
GO
ALTER TABLE [dbo].[HangPhong_DichVu]  WITH CHECK ADD  CONSTRAINT [FK_HPDV_DichVu] FOREIGN KEY([MaDichVu])
REFERENCES [dbo].[DichVu] ([MaDichVu])
ALTER TABLE [dbo].[HangPhong_DichVu] CHECK CONSTRAINT [FK_HPDV_DichVu]
GO
ALTER TABLE [dbo].[HangPhong_DichVu]  WITH CHECK ADD  CONSTRAINT [FK_HPDV_HangPhong] FOREIGN KEY([MaHangPhong])
REFERENCES [dbo].[HangPhong] ([MaHangPhong])
ALTER TABLE [dbo].[HangPhong_DichVu] CHECK CONSTRAINT [FK_HPDV_HangPhong]
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD  CONSTRAINT [FK__HoaDon__MaSinhVi__35BCFE0A] FOREIGN KEY([MaSinhVien])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
ALTER TABLE [dbo].[HoaDon] CHECK CONSTRAINT [FK__HoaDon__MaSinhVi__35BCFE0A]
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD FOREIGN KEY([TenPhong])
REFERENCES [dbo].[Phong] ([TenPhong])
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD  CONSTRAINT [FK_HoaDon_ChiTietHopDong] FOREIGN KEY([MaChiTiet])
REFERENCES [dbo].[ChiTietHopDong] ([MaChiTiet])
ALTER TABLE [dbo].[HoaDon] CHECK CONSTRAINT [FK_HoaDon_ChiTietHopDong]
GO
ALTER TABLE [dbo].[HoaDon]  WITH CHECK ADD  CONSTRAINT [FK_HoaDon_HopDong] FOREIGN KEY([MaHopDong])
REFERENCES [dbo].[HopDong] ([MaHopDong])
ALTER TABLE [dbo].[HoaDon] CHECK CONSTRAINT [FK_HoaDon_HopDong]
GO
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu]  WITH CHECK ADD  CONSTRAINT [FK_HoanTienChuyenKhoanDu_GiaoDich] FOREIGN KEY([MaGiaoDich])
REFERENCES [dbo].[GiaoDichThanhToan] ([MaGiaoDich])
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu] CHECK CONSTRAINT [FK_HoanTienChuyenKhoanDu_GiaoDich]
GO
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu]  WITH CHECK ADD  CONSTRAINT [FK_HoanTienChuyenKhoanDu_HoaDon] FOREIGN KEY([MaHoaDon])
REFERENCES [dbo].[HoaDon] ([MaHoaDon])
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu] CHECK CONSTRAINT [FK_HoanTienChuyenKhoanDu_HoaDon]
GO
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu]  WITH CHECK ADD  CONSTRAINT [FK_HoanTienChuyenKhoanDu_NguoiTra] FOREIGN KEY([NguoiTra])
REFERENCES [dbo].[TaiKhoan] ([MaTaiKhoan])
ALTER TABLE [dbo].[HoanTienChuyenKhoanDu] CHECK CONSTRAINT [FK_HoanTienChuyenKhoanDu_NguoiTra]
GO
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD FOREIGN KEY([TenPhong])
REFERENCES [dbo].[Phong] ([TenPhong])
GO
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD  CONSTRAINT [FK_HopDong_HangPhong] FOREIGN KEY([MaHangPhong])
REFERENCES [dbo].[HangPhong] ([MaHangPhong])
ALTER TABLE [dbo].[HopDong] CHECK CONSTRAINT [FK_HopDong_HangPhong]
GO
ALTER TABLE [dbo].[HopDong]  WITH CHECK ADD  CONSTRAINT [FK_HopDong_Phong] FOREIGN KEY([TenPhong])
REFERENCES [dbo].[Phong] ([TenPhong])
ALTER TABLE [dbo].[HopDong] CHECK CONSTRAINT [FK_HopDong_Phong]
GO
ALTER TABLE [dbo].[PhieuChi]  WITH CHECK ADD  CONSTRAINT [FK_PhieuChi_ChiTiet] FOREIGN KEY([MaChiTiet])
REFERENCES [dbo].[ChiTietHopDong] ([MaChiTiet])
ALTER TABLE [dbo].[PhieuChi] CHECK CONSTRAINT [FK_PhieuChi_ChiTiet]
GO
ALTER TABLE [dbo].[PhieuChi]  WITH CHECK ADD  CONSTRAINT [FK_PhieuChi_NguoiLap] FOREIGN KEY([NguoiLap])
REFERENCES [dbo].[TaiKhoan] ([MaTaiKhoan])
ALTER TABLE [dbo].[PhieuChi] CHECK CONSTRAINT [FK_PhieuChi_NguoiLap]
GO
ALTER TABLE [dbo].[PhieuChi_HoaDon]  WITH CHECK ADD  CONSTRAINT [FK_PhieuChi_HoaDon_HoaDon] FOREIGN KEY([MaHoaDon])
REFERENCES [dbo].[HoaDon] ([MaHoaDon])
ALTER TABLE [dbo].[PhieuChi_HoaDon] CHECK CONSTRAINT [FK_PhieuChi_HoaDon_HoaDon]
GO
ALTER TABLE [dbo].[PhieuChi_HoaDon]  WITH CHECK ADD  CONSTRAINT [FK_PhieuChi_HoaDon_PhieuChi] FOREIGN KEY([MaPhieuChi])
REFERENCES [dbo].[PhieuChi] ([MaPhieuChi])
ALTER TABLE [dbo].[PhieuChi_HoaDon] CHECK CONSTRAINT [FK_PhieuChi_HoaDon_PhieuChi]
GO
ALTER TABLE [dbo].[PhieuThu]  WITH CHECK ADD  CONSTRAINT [FK_PhieuThu_GiaoDich] FOREIGN KEY([MaGiaoDich])
REFERENCES [dbo].[GiaoDichThanhToan] ([MaGiaoDich])
ALTER TABLE [dbo].[PhieuThu] CHECK CONSTRAINT [FK_PhieuThu_GiaoDich]
GO
ALTER TABLE [dbo].[PhieuThu]  WITH CHECK ADD  CONSTRAINT [FK_PhieuThu_HoaDon] FOREIGN KEY([MaHoaDon])
REFERENCES [dbo].[HoaDon] ([MaHoaDon])
ALTER TABLE [dbo].[PhieuThu] CHECK CONSTRAINT [FK_PhieuThu_HoaDon]
GO
ALTER TABLE [dbo].[PhieuThu]  WITH CHECK ADD  CONSTRAINT [FK_PhieuThu_NguoiThu] FOREIGN KEY([NguoiThu])
REFERENCES [dbo].[TaiKhoan] ([MaTaiKhoan])
ALTER TABLE [dbo].[PhieuThu] CHECK CONSTRAINT [FK_PhieuThu_NguoiThu]
GO
ALTER TABLE [dbo].[PhieuThu]  WITH CHECK ADD  CONSTRAINT [FK_PhieuThu_SinhVienNop] FOREIGN KEY([MaSinhVienNop])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
ALTER TABLE [dbo].[PhieuThu] CHECK CONSTRAINT [FK_PhieuThu_SinhVienNop]
GO
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD  CONSTRAINT [FK_Phong_Hang_SucChua] FOREIGN KEY([MaHangPhong], [SucChuaToiDa])
REFERENCES [dbo].[HangPhong] ([MaHangPhong], [SucChuaToiDa])
ALTER TABLE [dbo].[Phong] CHECK CONSTRAINT [FK_Phong_Hang_SucChua]
GO
ALTER TABLE [dbo].[Phong]  WITH CHECK ADD  CONSTRAINT [FK_Phong_HangPhong] FOREIGN KEY([MaHangPhong])
REFERENCES [dbo].[HangPhong] ([MaHangPhong])
ALTER TABLE [dbo].[Phong] CHECK CONSTRAINT [FK_Phong_HangPhong]
GO
ALTER TABLE [dbo].[SinhVien]  WITH CHECK ADD FOREIGN KEY([TenPhong])
REFERENCES [dbo].[Phong] ([TenPhong])
GO
ALTER TABLE [dbo].[TaiKhoan]  WITH CHECK ADD  CONSTRAINT [FK_TaiKhoan_SinhVien] FOREIGN KEY([MaSinhVien])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
ALTER TABLE [dbo].[TaiKhoan] CHECK CONSTRAINT [FK_TaiKhoan_SinhVien]
GO
ALTER TABLE [dbo].[ThongBao]  WITH CHECK ADD  CONSTRAINT [FK_ThongBao_HoaDon] FOREIGN KEY([MaHoaDon])
REFERENCES [dbo].[HoaDon] ([MaHoaDon])
ALTER TABLE [dbo].[ThongBao] CHECK CONSTRAINT [FK_ThongBao_HoaDon]
GO
ALTER TABLE [dbo].[ThongBao]  WITH CHECK ADD  CONSTRAINT [FK_ThongBao_Phong] FOREIGN KEY([TenPhong])
REFERENCES [dbo].[Phong] ([TenPhong])
ALTER TABLE [dbo].[ThongBao] CHECK CONSTRAINT [FK_ThongBao_Phong]
GO
ALTER TABLE [dbo].[ThongBao]  WITH CHECK ADD  CONSTRAINT [FK_ThongBao_SinhVien] FOREIGN KEY([MaSinhVien])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
ALTER TABLE [dbo].[ThongBao] CHECK CONSTRAINT [FK_ThongBao_SinhVien]
GO
ALTER TABLE [dbo].[ThongBao]  WITH CHECK ADD  CONSTRAINT [FK_ThongBao_TaiKhoan] FOREIGN KEY([NguoiTao])
REFERENCES [dbo].[TaiKhoan] ([MaTaiKhoan])
ALTER TABLE [dbo].[ThongBao] CHECK CONSTRAINT [FK_ThongBao_TaiKhoan]
GO
ALTER TABLE [dbo].[YeuCauSinhVien]  WITH CHECK ADD  CONSTRAINT [FK_YeuCau_SinhVien] FOREIGN KEY([MaSinhVien])
REFERENCES [dbo].[SinhVien] ([MaSinhVien])
ALTER TABLE [dbo].[YeuCauSinhVien] CHECK CONSTRAINT [FK_YeuCau_SinhVien]
GO
ALTER TABLE [dbo].[YeuCauSinhVien]  WITH CHECK ADD  CONSTRAINT [FK_YeuCau_XuLyBoi] FOREIGN KEY([XuLyBoi])
REFERENCES [dbo].[TaiKhoan] ([MaTaiKhoan])
ALTER TABLE [dbo].[YeuCauSinhVien] CHECK CONSTRAINT [FK_YeuCau_XuLyBoi]
GO