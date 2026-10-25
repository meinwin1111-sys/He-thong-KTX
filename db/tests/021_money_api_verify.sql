:on error exit
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 52190, N'Chạy kiểm thử bằng sqlcmd -d KTX_Group3_test.', 1;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'021')
    THROW 52191, N'Chạy db/run_all.sql trước khi kiểm thử migration 021.', 1;

IF DATABASE_PRINCIPAL_ID(N'DNKTX') IS NULL
    THROW 52192, N'Không tìm thấy user DNKTX trong KTX_Group3_test.', 1;

DECLARE @Procedures TABLE (ProcedureName sysname PRIMARY KEY);
INSERT INTO @Procedures (ProcedureName)
VALUES
    (N'sp_TaoHoaDonTienPhong'),
    (N'sp_TaoHoaDonDichVuPhong'),
    (N'sp_TaoHoaDonPhatSinh'),
    (N'sp_GhiPhieuThu'),
    (N'sp_TinhGoiYHoanTien'),
    (N'sp_TaoPhieuChi'),
    (N'sp_XacNhanPhieuThu'),
    (N'sp_HuyPhieuThu');

DECLARE @ProcedurePermissions TABLE (
    ProcedureName sysname,
    HasExecutePermission int
);
EXECUTE AS USER = N'DNKTX';
INSERT INTO @ProcedurePermissions (ProcedureName, HasExecutePermission)
SELECT p.ProcedureName,
       HAS_PERMS_BY_NAME(N'dbo.' + p.ProcedureName, N'OBJECT', N'EXECUTE')
FROM @Procedures p;

DECLARE @DataPermissions TABLE (
    ObjectName sysname,
    PermissionName sysname,
    HasPermission int
);
INSERT INTO @DataPermissions (ObjectName, PermissionName, HasPermission)
VALUES
    (N'HoaDon', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.HoaDon', N'OBJECT', N'SELECT')),
    (N'HoaDon', N'UPDATE', HAS_PERMS_BY_NAME(N'dbo.HoaDon', N'OBJECT', N'UPDATE')),
    (N'ChiTietHoaDon', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.ChiTietHoaDon', N'OBJECT', N'SELECT')),
    (N'HopDong', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.HopDong', N'OBJECT', N'SELECT')),
    (N'ChiTietHopDong', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.ChiTietHopDong', N'OBJECT', N'SELECT')),
    (N'SinhVien', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.SinhVien', N'OBJECT', N'SELECT')),
    (N'TaiKhoan', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.TaiKhoan', N'OBJECT', N'SELECT')),
    (N'PhieuThu', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.PhieuThu', N'OBJECT', N'SELECT')),
    (N'GiaoDichThanhToan', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.GiaoDichThanhToan', N'OBJECT', N'SELECT')),
    (N'GiaoDichThanhToan', N'INSERT', HAS_PERMS_BY_NAME(N'dbo.GiaoDichThanhToan', N'OBJECT', N'INSERT')),
    (N'GiaoDichThanhToan', N'UPDATE', HAS_PERMS_BY_NAME(N'dbo.GiaoDichThanhToan', N'OBJECT', N'UPDATE')),
    (N'ChiPhiPhatSinh', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.ChiPhiPhatSinh', N'OBJECT', N'SELECT')),
    (N'ChiPhiPhatSinh', N'INSERT', HAS_PERMS_BY_NAME(N'dbo.ChiPhiPhatSinh', N'OBJECT', N'INSERT')),
    (N'ChiPhiPhatSinh', N'UPDATE', HAS_PERMS_BY_NAME(N'dbo.ChiPhiPhatSinh', N'OBJECT', N'UPDATE')),
    (N'PhieuChi', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.PhieuChi', N'OBJECT', N'SELECT')),
    (N'PhieuChi_HoaDon', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.PhieuChi_HoaDon', N'OBJECT', N'SELECT')),
    (N'NhatKyHeThong', N'INSERT', HAS_PERMS_BY_NAME(N'dbo.NhatKyHeThong', N'OBJECT', N'INSERT')),
    (N'vw_HoaDonTongHop', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.vw_HoaDonTongHop', N'OBJECT', N'SELECT')),
    (N'vw_CongNo', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.vw_CongNo', N'OBJECT', N'SELECT')),
    (N'vw_DoanhThuThang', N'SELECT', HAS_PERMS_BY_NAME(N'dbo.vw_DoanhThuThang', N'OBJECT', N'SELECT'));
REVERT;

SELECT ProcedureName, HasExecutePermission
FROM @ProcedurePermissions
ORDER BY ProcedureName;
SELECT ObjectName, PermissionName, HasPermission
FROM @DataPermissions
ORDER BY ObjectName, PermissionName;

IF EXISTS (SELECT 1 FROM @ProcedurePermissions WHERE ISNULL(HasExecutePermission, 0) <> 1)
    THROW 52193, N'DNKTX thiếu quyền EXECUTE một hoặc nhiều proc Bước 5.', 1;
IF EXISTS (SELECT 1 FROM @DataPermissions WHERE ISNULL(HasPermission, 0) <> 1)
    THROW 52194, N'DNKTX thiếu quyền đọc/ghi dữ liệu cần cho một hoặc nhiều route Bước 5.', 1;

PRINT N'[021 money API verify] Đạt: DNKTX có quyền EXECUTE đúng các proc nghiệp vụ được route gọi và quyền dữ liệu cần thiết.';
GO
