SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 52500, N'Chạy migration 001 trước.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'024')
    THROW 52501, N'Chạy migration 024 trước.', 1;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'025')
BEGIN
    PRINT N'[025] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.sp_TaoHopDong_014', N'P') IS NULL
            EXEC sys.sp_rename N'dbo.sp_TaoHopDong', N'sp_TaoHopDong_014';
        IF OBJECT_ID(N'dbo.sp_ThemSinhVienVaoHopDong_014', N'P') IS NULL
            EXEC sys.sp_rename N'dbo.sp_ThemSinhVienVaoHopDong', N'sp_ThemSinhVienVaoHopDong_014';

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

    DECLARE @Members table (MaSinhVien nvarchar(30) NOT NULL, KyHan nvarchar(10) NOT NULL,
                            LaDaiDien bit NOT NULL);
    INSERT INTO @Members (MaSinhVien, KyHan, LaDaiDien)
    SELECT MaSinhVien, COALESCE(NULLIF(KyHan, N''''), N''THANG''), COALESCE(LaDaiDien, 0)
    FROM OPENJSON(@SinhVienJson)
    WITH (MaSinhVien nvarchar(30) N''$.maSinhVien'',
          KyHan nvarchar(10) N''$.kyHanThanhToanPhong'',
          LaDaiDien bit N''$.laNguoiDaiDien'');
    IF NOT EXISTS (SELECT 1 FROM @Members) THROW 51422, N''Hợp đồng cần ít nhất một sinh viên.'', 1;
    IF EXISTS (SELECT 1 FROM @Members WHERE KyHan NOT IN (N''THANG'', N''NAM''))
        THROW 51423, N''Kỳ hạn tiền phòng phải là THANG hoặc NAM.'', 1;
    IF (SELECT COUNT(*) FROM @Members WHERE LaDaiDien = 1) > 1
        THROW 51424, N''Mỗi hợp đồng chỉ có tối đa một người đại diện.'', 1;
    IF EXISTS (SELECT MaSinhVien FROM @Members GROUP BY MaSinhVien HAVING COUNT(*) > 1)
        THROW 51421, N''Danh sách sinh viên không được trùng mã.'', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Gender nvarchar(10), @Capacity int, @RoomStatus nvarchar(20),
                @RoomCount int, @StudentGender nvarchar(10), @StudentId nvarchar(30);
        SELECT @Gender = p.LoaiPhong, @Capacity = hp.SucChuaToiDa,
               @RoomStatus = p.TrangThaiPhong
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
        FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK) ON c.MaHopDong = hd.MaHopDong
        WHERE hd.TenPhong = @TenPhong AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND c.TrangThai = N''Đang ở'';

        DECLARE memberCursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT MaSinhVien FROM @Members ORDER BY MaSinhVien;
        OPEN memberCursor;
        FETCH NEXT FROM memberCursor INTO @StudentId;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @StudentGender = NULL;
            SELECT @StudentGender = GioiTinh
            FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK) WHERE MaSinhVien = @StudentId;
            IF @StudentGender IS NULL THROW 51458, N''Không tìm thấy sinh viên.'', 1;
            IF @StudentGender <> @Gender THROW 51459, N''Giới tính sinh viên không phù hợp với phòng.'', 1;
            IF EXISTS (SELECT 1 FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
                       WHERE MaSinhVien = @StudentId AND TrangThai = N''Đang ở'')
                THROW 51460, N''Sinh viên đang ở tại phòng hoặc hợp đồng khác.'', 1;
            FETCH NEXT FROM memberCursor INTO @StudentId;
        END;
        CLOSE memberCursor;
        DEALLOCATE memberCursor;

        IF @RoomCount + (SELECT COUNT(*) FROM @Members) > @Capacity
            THROW 51461, N''Phòng đã đủ sức chứa.'', 1;

        EXEC dbo.sp_TaoHopDong_014
            @TenPhong = @TenPhong, @NgayBatDau = @NgayBatDau,
            @NgayKetThuc = @NgayKetThuc, @SinhVienJson = @SinhVienJson,
            @GhiChu = @GhiChu, @NguoiThucHien = @NguoiThucHien, @MaHopDong = @MaHopDong;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;';

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
        DECLARE @Room nvarchar(50), @Gender nvarchar(10), @Capacity int, @Count int,
                @RoomStatus nvarchar(20), @StudentGender nvarchar(10);
        SELECT @Room = hd.TenPhong, @Gender = p.LoaiPhong,
               @RoomStatus = p.TrangThaiPhong, @Capacity = hp.SucChuaToiDa
        FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Phong p WITH (UPDLOCK, HOLDLOCK) ON p.TenPhong = hd.TenPhong
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
        WHERE hd.MaHopDong = @MaHopDong AND hd.TrangThaiHopDong = N''Còn hiệu lực'';
        IF @Room IS NULL THROW 51432, N''Không tìm thấy hợp đồng hiệu lực.'', 1;
        IF @RoomStatus IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 51433, N''Phòng đang bảo trì hoặc ngưng sử dụng.'', 1;

        SELECT @Count = COUNT(*)
        FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND TrangThai = N''Đang ở'';
        SET @StudentGender = NULL;
        SELECT @StudentGender = GioiTinh
        FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK) WHERE MaSinhVien = @MaSinhVien;
        IF @StudentGender IS NULL THROW 51458, N''Không tìm thấy sinh viên.'', 1;
        IF @StudentGender <> @Gender THROW 51459, N''Giới tính sinh viên không phù hợp với phòng.'', 1;
        IF EXISTS (SELECT 1 FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
                   WHERE MaSinhVien = @MaSinhVien AND TrangThai = N''Đang ở'')
            THROW 51460, N''Sinh viên đang ở tại phòng hoặc hợp đồng khác.'', 1;
        IF @Count >= @Capacity THROW 51461, N''Phòng đã đủ sức chứa.'', 1;

        EXEC dbo.sp_ThemSinhVienVaoHopDong_014
            @MaHopDong = @MaHopDong, @MaSinhVien = @MaSinhVien,
            @KyHanThanhToanPhong = @KyHanThanhToanPhong,
            @LaNguoiDaiDien = @LaNguoiDaiDien, @NguoiThucHien = @NguoiThucHien;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;';

        IF DATABASE_PRINCIPAL_ID(N'DNKTX') IS NOT NULL
        BEGIN
            EXEC sys.sp_executesql N'GRANT EXECUTE ON OBJECT::dbo.sp_TaoHopDong TO [DNKTX];';
            EXEC sys.sp_executesql N'GRANT EXECUTE ON OBJECT::dbo.sp_ThemSinhVienVaoHopDong TO [DNKTX];';
        END;

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'025', N'025_contract_gender_errors.sql');
        COMMIT TRANSACTION;
        PRINT N'[025] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
