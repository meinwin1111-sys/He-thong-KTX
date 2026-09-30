:on error exit
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Chạy từ thư mục gốc repo trên DB đã chạy migrations 001-009.
:r db/seed/master/001_phong.sql
GO
:r db/seed/master/002_cauhinh.sql
GO
:r db/seed/master/003_taikhoan_admin.sql
GO