:on error exit
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 52310, N'Kiểm thử 023 chỉ được chạy trong KTX_Group3_test.', 1;

DECLARE @CheckClause nvarchar(max);
SELECT @CheckClause = definition
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID(N'dbo.YeuCauSinhVien')
  AND name = N'CK_YeuCau_Loai';

IF @CheckClause IS NULL OR @CheckClause NOT LIKE N'%Yêu cầu khác%'
    THROW 52311, N'CHECK loại yêu cầu chưa có giá trị Yêu cầu khác.', 1;

DECLARE @StudentA nvarchar(30);
DECLARE @StudentB nvarchar(30);
DECLARE @RoomA nvarchar(50);
DECLARE @RoomB nvarchar(50);
DECLARE @RoomGender nvarchar(10);
DECLARE @ManagerId int;
DECLARE @Token nvarchar(36) = CONVERT(nvarchar(36), NEWID());
DECLARE @RequestId int;
DECLARE @ContractA nvarchar(20);
DECLARE @ContractB nvarchar(20);
DECLARE @PermissionNoticeId bigint;
DECLARE @StartDate date = CONVERT(date, GETDATE());
DECLARE @EndDate date = DATEADD(year, 1, CONVERT(date, GETDATE()));
DECLARE @StudentJsonA nvarchar(max);
DECLARE @StudentJsonB nvarchar(max);
DECLARE @ExecutingAs bit = 0;
DECLARE @FailureMessage nvarchar(2048);
DECLARE @NoticeIds table (Kind nvarchar(20) NOT NULL, Id bigint NOT NULL);
DECLARE @VisibleForA table (MaThongBao bigint PRIMARY KEY);
DECLARE @VisibleForB table (MaThongBao bigint PRIMARY KEY);

SELECT TOP (1) @RoomA = p.TenPhong, @RoomGender = p.LoaiPhong
FROM dbo.Phong p
WHERE p.TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng')
  AND NOT EXISTS
      (SELECT 1 FROM dbo.HopDong hd WHERE hd.TenPhong = p.TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực')
ORDER BY p.TenPhong;

SELECT TOP (1) @RoomB = p.TenPhong
FROM dbo.Phong p
WHERE p.LoaiPhong = @RoomGender
  AND p.TenPhong <> @RoomA
  AND p.TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng')
  AND NOT EXISTS
      (SELECT 1 FROM dbo.HopDong hd WHERE hd.TenPhong = p.TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực')
ORDER BY p.TenPhong;

SELECT TOP (1) @ManagerId = MaTaiKhoan
FROM dbo.TaiKhoan
WHERE VaiTro = N'Quản lý';

IF @RoomA IS NULL OR @RoomB IS NULL
    THROW 52312, N'Cần hai phòng trống cùng giới tính để kiểm chứng phạm vi.', 1;
IF @ManagerId IS NULL
    THROW 52313, N'Không có tài khoản quản lý để làm NguoiTao.', 1;

SET @StudentA = N'T23A' + LEFT(REPLACE(@Token, N'-', N''), 24);
SET @StudentB = N'T23B' + LEFT(REPLACE(@Token, N'-', N''), 24);
SET @ContractA = N'HD23A' + LEFT(REPLACE(@Token, N'-', N''), 10);
SET @ContractB = N'HD23B' + LEFT(REPLACE(@Token, N'-', N''), 10);

BEGIN TRY
    BEGIN TRANSACTION;

    INSERT INTO dbo.SinhVien (MaSinhVien, HoTen, GioiTinh, Email)
    VALUES
        (@StudentA, N'Kiểm thử thông báo A', @RoomGender, N't23a.' + REPLACE(@Token, N'-', N'') + N'@example.test'),
        (@StudentB, N'Kiểm thử thông báo B', @RoomGender, N't23b.' + REPLACE(@Token, N'-', N'') + N'@example.test');

    SET @StudentJsonA = N'[{"maSinhVien":"' + @StudentA
        + N'","kyHanThanhToanPhong":"THANG","laNguoiDaiDien":true}]';
    SET @StudentJsonB = N'[{"maSinhVien":"' + @StudentB
        + N'","kyHanThanhToanPhong":"THANG","laNguoiDaiDien":true}]';

    EXEC dbo.sp_TaoHopDong
        @TenPhong = @RoomA,
        @NgayBatDau = @StartDate,
        @NgayKetThuc = @EndDate,
        @SinhVienJson = @StudentJsonA,
        @GhiChu = N'Fixture kiểm thử thông báo 023',
        @NguoiThucHien = @ManagerId,
        @MaHopDong = @ContractA;
    EXEC dbo.sp_TaoHopDong
        @TenPhong = @RoomB,
        @NgayBatDau = @StartDate,
        @NgayKetThuc = @EndDate,
        @SinhVienJson = @StudentJsonB,
        @GhiChu = N'Fixture kiểm thử thông báo 023',
        @NguoiThucHien = @ManagerId,
        @MaHopDong = @ContractB;

    INSERT INTO dbo.YeuCauSinhVien (MaSinhVien, Loai, NoiDung)
    VALUES (@StudentA, N'Yêu cầu khác', N'Kiểm chứng CHECK 023; giao dịch sẽ rollback.');
    SET @RequestId = CONVERT(int, SCOPE_IDENTITY());

    INSERT INTO dbo.ThongBao (TieuDe, NoiDung, PhamViNhan, NguoiTao)
        OUTPUT N'TAT_CA', inserted.MaThongBao INTO @NoticeIds (Kind, Id)
    VALUES (N'Kiểm chứng 023 ' + @Token, N'Tất cả', N'TAT_CA', @ManagerId);
    INSERT INTO dbo.ThongBao (TieuDe, NoiDung, PhamViNhan, TenPhong, NguoiTao)
        OUTPUT N'PHONG_A', inserted.MaThongBao INTO @NoticeIds (Kind, Id)
    VALUES (N'Kiểm chứng 023 ' + @Token, N'Phòng A', N'PHONG', @RoomA, @ManagerId);
    INSERT INTO dbo.ThongBao (TieuDe, NoiDung, PhamViNhan, TenPhong, NguoiTao)
        OUTPUT N'PHONG_B', inserted.MaThongBao INTO @NoticeIds (Kind, Id)
    VALUES (N'Kiểm chứng 023 ' + @Token, N'Phòng B', N'PHONG', @RoomB, @ManagerId);
    INSERT INTO dbo.ThongBao (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao)
        OUTPUT N'SV_A', inserted.MaThongBao INTO @NoticeIds (Kind, Id)
    VALUES (N'Kiểm chứng 023 ' + @Token, N'Sinh viên A', N'SINH_VIEN', @StudentA, @ManagerId);
    INSERT INTO dbo.ThongBao (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao)
        OUTPUT N'SV_B', inserted.MaThongBao INTO @NoticeIds (Kind, Id)
    VALUES (N'Kiểm chứng 023 ' + @Token, N'Sinh viên B', N'SINH_VIEN', @StudentB, @ManagerId);
    INSERT INTO dbo.ThongBao (TieuDe, NoiDung, PhamViNhan, NguoiTao, DaXoa)
        OUTPUT N'DELETED', inserted.MaThongBao INTO @NoticeIds (Kind, Id)
    VALUES (N'Kiểm chứng 023 ' + @Token, N'Đã ẩn', N'TAT_CA', @ManagerId, 1);

    PRINT N'CHECK_CLAUSE: ' + @CheckClause;
    PRINT N'INSERT YeuCauSinhVien(Yêu cầu khác): thành công; MaYeuCau YC' +
          RIGHT(N'00000' + CONVERT(nvarchar(10), @RequestId), 5) + N' (sẽ rollback).';

    EXECUTE AS USER = N'DNKTX';
    SET @ExecutingAs = 1;

    SELECT N'Fixture contract' AS CheckType, hd.MaHopDong, hd.TenPhong,
           hd.TrangThaiHopDong, c.MaSinhVien, c.TrangThai AS MemberStatus
    FROM dbo.HopDong hd
    INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
    WHERE hd.MaHopDong IN (@ContractA, @ContractB);
    SELECT N'Fixture notification' AS CheckType, MaThongBao, PhamViNhan,
           TenPhong, MaSinhVien, DaXoa
    FROM dbo.ThongBao
    WHERE TieuDe = N'Kiểm chứng 023 ' + @Token;

    SELECT
        USER_NAME() AS ExecutingUser,
        HAS_PERMS_BY_NAME(N'dbo.ThongBao', N'OBJECT', N'SELECT') AS EffectiveSelect,
        HAS_PERMS_BY_NAME(N'dbo.ThongBao', N'OBJECT', N'INSERT') AS EffectiveInsert,
        HAS_PERMS_BY_NAME(N'dbo.ThongBao', N'OBJECT', N'UPDATE') AS EffectiveUpdate,
        HAS_PERMS_BY_NAME(N'dbo.ThongBao', N'OBJECT', N'DELETE') AS EffectiveDelete,
        SUM(CASE WHEN dp.permission_name = N'DELETE' AND dp.state IN ('G', 'W') THEN 1 ELSE 0 END) AS ExplicitDeleteGrants
    FROM sys.database_permissions dp
    WHERE dp.grantee_principal_id = DATABASE_PRINCIPAL_ID(N'DNKTX')
      AND dp.major_id = OBJECT_ID(N'dbo.ThongBao');
    IF HAS_PERMS_BY_NAME(N'dbo.ThongBao', N'OBJECT', N'SELECT') <> 1
       OR HAS_PERMS_BY_NAME(N'dbo.ThongBao', N'OBJECT', N'INSERT') <> 1
       OR HAS_PERMS_BY_NAME(N'dbo.ThongBao', N'OBJECT', N'UPDATE') <> 1
       OR EXISTS
       (
           SELECT 1 FROM sys.database_permissions
           WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'DNKTX')
             AND major_id = OBJECT_ID(N'dbo.ThongBao')
             AND permission_name = N'DELETE'
             AND state IN ('G', 'W')
       )
        SET @FailureMessage = N'GRANT trực tiếp trên dbo.ThongBao không đúng SELECT/INSERT/UPDATE, không DELETE.';

    IF EXISTS
    (
        SELECT 1
        FROM dbo.ThongBao tb
        WHERE tb.TieuDe = N'Kiểm chứng 023 ' + @Token
          AND tb.DaXoa = 0
          AND
          (
              tb.PhamViNhan = N'TAT_CA'
              OR (tb.PhamViNhan = N'SINH_VIEN' AND tb.MaSinhVien = @StudentA)
              OR
              (
                  tb.PhamViNhan = N'PHONG'
                  AND EXISTS
                  (
                      SELECT 1
                      FROM dbo.ChiTietHopDong c
                      INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                      WHERE c.MaSinhVien = @StudentA
                        AND c.TrangThai = N'Đang ở'
                        AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                        AND hd.TenPhong = tb.TenPhong
                  )
              )
          )
          AND
          (
              (tb.PhamViNhan = N'SINH_VIEN' AND tb.MaSinhVien <> @StudentA)
              OR
              (
                  tb.PhamViNhan = N'PHONG'
                  AND NOT EXISTS
                  (
                      SELECT 1
                      FROM dbo.ChiTietHopDong c
                      INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                      WHERE c.MaSinhVien = @StudentA
                        AND c.TrangThai = N'Đang ở'
                        AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                        AND hd.TenPhong = tb.TenPhong
                  )
              )
          )
    )
        SET @FailureMessage = COALESCE(@FailureMessage, N'Sinh viên A nhìn thấy thông báo riêng hoặc phòng của B.');

    INSERT INTO @VisibleForA (MaThongBao)
    SELECT tb.MaThongBao
    FROM dbo.ThongBao tb
    WHERE tb.TieuDe = N'Kiểm chứng 023 ' + @Token
      AND tb.DaXoa = 0
      AND
      (
          tb.PhamViNhan = N'TAT_CA'
          OR (tb.PhamViNhan = N'SINH_VIEN' AND tb.MaSinhVien = @StudentA)
          OR
          (
              tb.PhamViNhan = N'PHONG'
              AND EXISTS
              (
                  SELECT 1
                  FROM dbo.ChiTietHopDong c
                  INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                  WHERE c.MaSinhVien = @StudentA
                    AND c.TrangThai = N'Đang ở'
                    AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                    AND hd.TenPhong = tb.TenPhong
              )
          )
      );

    IF NOT EXISTS (SELECT 1 FROM dbo.ThongBao WHERE TieuDe = N'Kiểm chứng 023 ' + @Token AND PhamViNhan = N'TAT_CA' AND DaXoa = 0)
       OR NOT EXISTS (SELECT 1 FROM dbo.ThongBao WHERE TieuDe = N'Kiểm chứng 023 ' + @Token AND PhamViNhan = N'PHONG' AND TenPhong = @RoomA AND DaXoa = 0)
       OR NOT EXISTS (SELECT 1 FROM dbo.ThongBao WHERE TieuDe = N'Kiểm chứng 023 ' + @Token AND PhamViNhan = N'SINH_VIEN' AND MaSinhVien = @StudentA AND DaXoa = 0)
       OR (SELECT COUNT(*) FROM @VisibleForA) <> 3
       OR EXISTS (SELECT 1 FROM @VisibleForA visible INNER JOIN @NoticeIds n ON n.Id = visible.MaThongBao WHERE n.Kind IN (N'PHONG_B', N'SV_B', N'DELETED'))
        SET @FailureMessage = COALESCE(@FailureMessage, N'Sinh viên A không nhận đúng thông báo áp dụng hoặc thấy thông báo đã ẩn.');

    IF EXISTS
    (
        SELECT 1
        FROM dbo.ThongBao tb
        WHERE tb.TieuDe = N'Kiểm chứng 023 ' + @Token
          AND tb.DaXoa = 0
          AND
          (
              tb.PhamViNhan = N'TAT_CA'
              OR (tb.PhamViNhan = N'SINH_VIEN' AND tb.MaSinhVien = @StudentB)
              OR
              (
                  tb.PhamViNhan = N'PHONG'
                  AND EXISTS
                  (
                      SELECT 1
                      FROM dbo.ChiTietHopDong c
                      INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                      WHERE c.MaSinhVien = @StudentB
                        AND c.TrangThai = N'Đang ở'
                        AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                        AND hd.TenPhong = tb.TenPhong
                  )
              )
          )
          AND
          (
              (tb.PhamViNhan = N'SINH_VIEN' AND tb.MaSinhVien <> @StudentB)
              OR
              (
                  tb.PhamViNhan = N'PHONG'
                  AND NOT EXISTS
                  (
                      SELECT 1
                      FROM dbo.ChiTietHopDong c
                      INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                      WHERE c.MaSinhVien = @StudentB
                        AND c.TrangThai = N'Đang ở'
                        AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                        AND hd.TenPhong = tb.TenPhong
                  )
              )
          )
    )
        SET @FailureMessage = COALESCE(@FailureMessage, N'Sinh viên B nhìn thấy thông báo riêng hoặc phòng của A.');

    INSERT INTO @VisibleForB (MaThongBao)
    SELECT tb.MaThongBao
    FROM dbo.ThongBao tb
    WHERE tb.TieuDe = N'Kiểm chứng 023 ' + @Token
      AND tb.DaXoa = 0
      AND
      (
          tb.PhamViNhan = N'TAT_CA'
          OR (tb.PhamViNhan = N'SINH_VIEN' AND tb.MaSinhVien = @StudentB)
          OR
          (
              tb.PhamViNhan = N'PHONG'
              AND EXISTS
              (
                  SELECT 1
                  FROM dbo.ChiTietHopDong c
                  INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                  WHERE c.MaSinhVien = @StudentB
                    AND c.TrangThai = N'Đang ở'
                    AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                    AND hd.TenPhong = tb.TenPhong
              )
          )
      );
    IF (SELECT COUNT(*) FROM @VisibleForB) <> 3
       OR EXISTS (SELECT 1 FROM @VisibleForB visible INNER JOIN @NoticeIds n ON n.Id = visible.MaThongBao WHERE n.Kind IN (N'PHONG_A', N'SV_A', N'DELETED'))
        SET @FailureMessage = COALESCE(@FailureMessage, N'Sinh viên B không nhận đúng thông báo áp dụng hoặc thấy thông báo đã ẩn.');

    INSERT INTO dbo.ThongBao (TieuDe, NoiDung, PhamViNhan, NguoiTao)
    VALUES (N'Kiểm thử GRANT ' + @Token, N'Insert/update sẽ rollback.', N'TAT_CA', @ManagerId);
    SET @PermissionNoticeId = CONVERT(bigint, SCOPE_IDENTITY());
    UPDATE dbo.ThongBao
    SET DaXoa = 1
    WHERE MaThongBao = @PermissionNoticeId AND DaXoa = 0;
    IF @@ROWCOUNT <> 1
        SET @FailureMessage = COALESCE(@FailureMessage, N'DNKTX không thể cập nhật xóa mềm dbo.ThongBao.');

    REVERT;
    SET @ExecutingAs = 0;

    ROLLBACK TRANSACTION;
    PRINT N'ROLLBACK: dữ liệu kiểm thử không được giữ lại.';
END TRY
BEGIN CATCH
    PRINT N'ERROR_NUMBER=' + CONVERT(nvarchar(20), ERROR_NUMBER())
        + N'; XACT_STATE=' + CONVERT(nvarchar(10), XACT_STATE())
        + N'; MESSAGE=' + ERROR_MESSAGE();
    IF @ExecutingAs = 1 REVERT;
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

IF @FailureMessage IS NOT NULL
    THROW 52319, @FailureMessage, 1;

PRINT N'EXECUTE AS USER=DNKTX: phạm vi A/B đúng, phòng khác và thông báo DaXoa=1 không xuất hiện.';
PRINT N'GRANT trực tiếp SELECT/INSERT/UPDATE đúng dbo.ThongBao; không có GRANT DELETE trực tiếp.';
PRINT N'Kiểm tra INSERT/UPDATE quyền DNKTX và xóa mềm thành công.';
GO
