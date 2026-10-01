SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
/*
  Tạo filtered unique index mỗi sinh viên tối đa một hợp đồng còn hiệu lực.
  Chỉ chạy sau khi db/audit.sql mục 9 không còn dòng.
*/
IF EXISTS (
    SELECT MaSinhVien FROM dbo.HopDong
    WHERE TrangThaiHopDong = N'Còn hiệu lực'
    GROUP BY MaSinhVien
    HAVING COUNT(*) > 1
)
BEGIN
    RAISERROR(N'Vẫn còn hợp đồng hiệu lực trùng MaSinhVien. Dọn dữ liệu rồi chạy lại.', 16, 1);
END
ELSE IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = N'UQ_HopDong_MotHieuLuc' AND object_id = OBJECT_ID(N'dbo.HopDong')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_HopDong_MotHieuLuc
    ON dbo.HopDong (MaSinhVien)
    WHERE TrangThaiHopDong = N'Còn hiệu lực';
    PRINT N'Đã tạo UQ_HopDong_MotHieuLuc.';
END
ELSE
    PRINT N'UQ_HopDong_MotHieuLuc đã tồn tại.';
GO
