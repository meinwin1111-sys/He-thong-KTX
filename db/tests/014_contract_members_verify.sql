:on error exit
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 51703, N'Chạy kiểm thử bằng sqlcmd -d với database đích.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'014')
    THROW 51700, N'Chạy migration 014 trước khi chạy kiểm thử.', 1;

DECLARE @Suffix nvarchar(8) = RIGHT(REPLACE(CONVERT(nvarchar(36), NEWID()), N'-', N''), 8),
        @Room nvarchar(50),
        @SecondRoom nvarchar(50),
        @Gender nvarchar(10),
        @OppositeGender nvarchar(10),
        @Tier nvarchar(20),
        @Capacity int,
        @Contract nvarchar(20),
        @SecondContract nvarchar(20),
        @Student nvarchar(30),
        @MemberJson nvarchar(max),
        @OverflowStudent nvarchar(30),
        @WrongGenderStudent nvarchar(30),
        @DetailId int,
        @RepCount int,
        @RoomCount int,
        @ContractStatus nvarchar(20),
        @StartDate date = CAST(GETDATE() AS date),
        @EndDate date = DATEADD(day, 30, CAST(GETDATE() AS date)),
        @StudentGender nvarchar(10),
        @i int,
        @Email varchar(100);
DECLARE @Students table
(
    RowNum int NOT NULL PRIMARY KEY,
    MaSinhVien nvarchar(30) NOT NULL,
    GioiTinh nvarchar(10) NOT NULL
);

BEGIN TRY
    SELECT TOP (1)
        @Room = p.TenPhong,
        @Gender = p.LoaiPhong,
        @Tier = p.MaHangPhong,
        @Capacity = hp.SucChuaToiDa
    FROM dbo.Phong p
    INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
    WHERE p.TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng')
      AND NOT EXISTS (SELECT 1 FROM dbo.HopDong hd WHERE hd.TenPhong = p.TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực')
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ChiTietHopDong c
          INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
          WHERE hd.TenPhong = p.TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực' AND c.TrangThai = N'Đang ở'
      )
    ORDER BY hp.SucChuaToiDa DESC, p.TenPhong;

    IF @Room IS NULL
        THROW 51701, N'Không có phòng phù hợp để kiểm thử.', 1;

    SELECT TOP (1) @SecondRoom = p.TenPhong
    FROM dbo.Phong p
    WHERE p.MaHangPhong = @Tier
      AND p.LoaiPhong = @Gender
      AND p.TenPhong <> @Room
      AND p.TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng')
      AND NOT EXISTS (SELECT 1 FROM dbo.HopDong hd WHERE hd.TenPhong = p.TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực')
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ChiTietHopDong c
          INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
          WHERE hd.TenPhong = p.TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực' AND c.TrangThai = N'Đang ở'
      )
    ORDER BY p.TenPhong;
    IF @SecondRoom IS NULL
        THROW 51702, N'Cần hai phòng trống cùng hạng/giới tính để kiểm thử.', 1;

    SET @Contract = N'T014' + @Suffix + N'01';
    SET @SecondContract = N'T014' + @Suffix + N'02';
    SET @OppositeGender = CASE WHEN @Gender = N'Nam' THEN N'Nữ' ELSE N'Nam' END;

    SET @i = 1;
    WHILE @i <= @Capacity + 2
    BEGIN
        SET @Student = N'T014' + @Suffix + RIGHT(N'00' + CONVERT(nvarchar(2), @i), 2);
        SET @Email = 't014.' + CONVERT(varchar(8), @Suffix) + '.' + CONVERT(varchar(2), @i) + '@example.invalid';
        SET @StudentGender = CASE WHEN @i = @Capacity + 2 THEN @OppositeGender ELSE @Gender END;
        INSERT INTO @Students (RowNum, MaSinhVien, GioiTinh)
        VALUES (@i, @Student, @StudentGender);

        EXEC dbo.sp_ThemSinhVien
            @MaSinhVien = @Student,
            @HoTen = N'Kiểm thử hợp đồng phòng',
            @NgaySinh = '2000-01-01',
            @GioiTinh = @StudentGender,
            @SDT = '0900000000',
            @Email = @Email,
            @DiaChi = N'Test migration 014',
            @TenPhong = NULL,
            @GhiChu = NULL,
            @Truong = N'Test',
            @Lop = N'T014';
        SET @i += 1;
    END;

    SELECT @MemberJson = (
        SELECT MaSinhVien AS maSinhVien,
               N'THANG' AS kyHanThanhToanPhong,
               CONVERT(bit, CASE WHEN RowNum = 1 THEN 1 ELSE 0 END) AS laNguoiDaiDien
        FROM @Students
        WHERE RowNum <= @Capacity
        ORDER BY RowNum
        FOR JSON PATH
    );

    EXEC dbo.sp_TaoHopDong
        @TenPhong = @Room,
        @NgayBatDau = @StartDate,
        @NgayKetThuc = @EndDate,
        @SinhVienJson = @MemberJson,
        @GhiChu = N'Kiểm thử migration 014',
        @MaHopDong = @Contract;

    IF (SELECT COUNT(*) FROM dbo.ChiTietHopDong WHERE MaHopDong = @Contract AND TrangThai = N'Đang ở') <> @Capacity
        THROW 51703, N'Không tạo đủ thành viên đúng sức chứa phòng.', 1;

    SELECT @OverflowStudent = MaSinhVien FROM @Students WHERE RowNum = @Capacity + 1;
    BEGIN TRY
        EXEC dbo.sp_ThemSinhVienVaoHopDong @Contract, @OverflowStudent;
        THROW 51704, N'Không từ chối thành viên vượt sức chứa.', 1;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() <> 51434 THROW;
    END CATCH;

    SELECT @WrongGenderStudent = MaSinhVien FROM @Students WHERE RowNum = @Capacity + 2;
    BEGIN TRY
        EXEC dbo.sp_ThemSinhVienVaoHopDong @Contract, @WrongGenderStudent;
        THROW 51705, N'Không từ chối sinh viên sai giới tính phòng.', 1;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() <> 51435 THROW;
    END CATCH;

    SELECT @Student = MaSinhVien FROM @Students WHERE RowNum = 1;
    SET @MemberJson = N'[{"maSinhVien":"' + @Student
        + N'","kyHanThanhToanPhong":"THANG","laNguoiDaiDien":true}]';
    BEGIN TRY
        EXEC dbo.sp_TaoHopDong
            @TenPhong = @SecondRoom,
            @NgayBatDau = @StartDate,
            @NgayKetThuc = @EndDate,
            @SinhVienJson = @MemberJson,
            @GhiChu = N'Kiểm thử hợp đồng trùng sinh viên',
            @MaHopDong = @SecondContract;
        THROW 51706, N'Không từ chối sinh viên đã thuộc hợp đồng hiệu lực khác.', 1;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() <> 51428 THROW;
    END CATCH;

    SELECT @DetailId = MaChiTiet
    FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @Contract
      AND LaNguoiDaiDienThanhToanDichVu = 1
      AND TrangThai = N'Đang ở';
    EXEC dbo.sp_SinhVienRoiHopDong @DetailId, NULL, N'Kiểm thử chuyển đại diện';
    SELECT @RepCount = COUNT(*)
    FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @Contract
      AND LaNguoiDaiDienThanhToanDichVu = 1
      AND TrangThai = N'Đang ở';
    IF @RepCount <> 1
        THROW 51707, N'Không chuyển đại diện dịch vụ khi đại diện rời hợp đồng.', 1;

    SELECT TOP (1) @DetailId = MaChiTiet
    FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @Contract AND TrangThai = N'Đang ở'
    ORDER BY MaChiTiet;
    WHILE @DetailId IS NOT NULL
    BEGIN
        EXEC dbo.sp_SinhVienRoiHopDong @DetailId, NULL, N'Kiểm thử kết thúc thành viên';
        SET @DetailId = NULL;
        SELECT TOP (1) @DetailId = MaChiTiet
        FROM dbo.ChiTietHopDong
        WHERE MaHopDong = @Contract AND TrangThai = N'Đang ở'
        ORDER BY MaChiTiet;
    END;

    SELECT @ContractStatus = TrangThaiHopDong FROM dbo.HopDong WHERE MaHopDong = @Contract;
    SELECT @RoomCount = SoSinhVienHienTai FROM dbo.Phong WHERE TenPhong = @Room;
    IF @ContractStatus <> N'Đã kết thúc' OR ISNULL(@RoomCount, -1) <> 0
        THROW 51708, N'Hợp đồng không tự kết thúc hoặc sĩ số phòng không về 0 sau khi thành viên cuối rời.', 1;

    DELETE FROM dbo.ChiTietHopDong WHERE MaHopDong IN (@Contract, @SecondContract);
    DELETE FROM dbo.HopDong WHERE MaHopDong IN (@Contract, @SecondContract);
    DELETE FROM dbo.NhatKyHeThong
    WHERE DoiTuong = N'HopDong' AND MaDoiTuong IN (@Contract, @SecondContract);
    DELETE FROM dbo.SinhVien WHERE MaSinhVien IN (SELECT MaSinhVien FROM @Students);

    DELETE FROM @Students;
    SET @Contract = N'T014' + @Suffix + N'03';
    SET @SecondContract = NULL;
    BEGIN TRANSACTION;
    SET @i = 91;
    WHILE @i <= 92
    BEGIN
        SET @Student = N'T014' + @Suffix + RIGHT(N'00' + CONVERT(nvarchar(2), @i), 2);
        SET @Email = 't014.' + CONVERT(varchar(8), @Suffix) + '.' + CONVERT(varchar(2), @i) + '@example.invalid';
        INSERT INTO @Students (RowNum, MaSinhVien, GioiTinh)
        VALUES (@i, @Student, @Gender);

        EXEC dbo.sp_ThemSinhVien
            @MaSinhVien = @Student,
            @HoTen = N'Kiểm thử vòng trigger hợp đồng',
            @NgaySinh = '2000-01-01',
            @GioiTinh = @Gender,
            @SDT = '0900000000',
            @Email = @Email,
            @DiaChi = N'Test trigger migration 014',
            @TenPhong = NULL,
            @GhiChu = NULL,
            @Truong = N'Test',
            @Lop = N'T014';
        SET @i += 1;
    END;

    SET @MemberJson = (
        SELECT MaSinhVien AS maSinhVien,
               N'THANG' AS kyHanThanhToanPhong,
               CONVERT(bit, CASE WHEN RowNum = 91 THEN 1 ELSE 0 END) AS laNguoiDaiDien
        FROM @Students
        ORDER BY RowNum
        FOR JSON PATH
    );

    EXEC dbo.sp_TaoHopDong
        @TenPhong = @Room,
        @NgayBatDau = @StartDate,
        @NgayKetThuc = @EndDate,
        @SinhVienJson = @MemberJson,
        @GhiChu = N'Kiểm thử vòng trigger trong transaction',
        @MaHopDong = @Contract;

    SELECT @Student = MaSinhVien FROM @Students WHERE RowNum = 91;
    SELECT @DetailId = MaChiTiet
    FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @Contract AND MaSinhVien = @Student AND TrangThai = N'Đang ở';
    EXEC dbo.sp_SinhVienRoiHopDong @DetailId, NULL, N'Kiểm thử đổi đại diện trong transaction';
    SELECT @RepCount = COUNT(*)
    FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @Contract
      AND LaNguoiDaiDienThanhToanDichVu = 1
      AND TrangThai = N'Đang ở';
    IF @RepCount <> 1
        THROW 51709, N'Không đổi đại diện sau khi đại diện rời trong transaction.', 1;

    SELECT @Student = MaSinhVien FROM @Students WHERE RowNum = 92;
    EXEC dbo.sp_ChuyenPhong @Student, @SecondRoom;
    SELECT @RoomCount = SoSinhVienHienTai FROM dbo.Phong WHERE TenPhong = @Room;
    IF ISNULL(@RoomCount, -1) <> 0
       OR NOT EXISTS (
           SELECT 1 FROM dbo.HopDong
           WHERE MaHopDong = @Contract AND TrangThaiHopDong = N'Đã kết thúc'
       )
        THROW 51710, N'Hợp đồng/phòng nguồn không kết thúc đúng sau khi chuyển thành viên cuối.', 1;

    SELECT @RoomCount = SoSinhVienHienTai FROM dbo.Phong WHERE TenPhong = @SecondRoom;
    IF ISNULL(@RoomCount, -1) <> 1
       OR NOT EXISTS (
           SELECT 1 FROM dbo.SinhVien
           WHERE MaSinhVien = @Student
             AND TenPhong = @SecondRoom
             AND TrangThaiSinhVien = N'Đang ở'
       )
        THROW 51711, N'Sĩ số hoặc phòng sinh viên sai sau khi chuyển phòng.', 1;

    SELECT @SecondContract = MaHopDong
    FROM dbo.ChiTietHopDong
    WHERE MaSinhVien = @Student AND TrangThai = N'Đang ở';
    EXEC dbo.sp_KetThucHopDong @SecondContract, @StartDate;
    IF EXISTS (
        SELECT 1 FROM dbo.ChiTietHopDong
        WHERE MaHopDong = @SecondContract AND TrangThai = N'Đang ở'
    )
       OR NOT EXISTS (
           SELECT 1 FROM dbo.HopDong
           WHERE MaHopDong = @SecondContract AND TrangThaiHopDong = N'Đã kết thúc'
       )
       OR EXISTS (
           SELECT 1 FROM dbo.Phong
           WHERE TenPhong = @SecondRoom AND SoSinhVienHienTai <> 0
       )
       OR EXISTS (
           SELECT 1 FROM dbo.SinhVien
           WHERE MaSinhVien = @Student
             AND (TrangThaiSinhVien <> N'Đã rời KTX' OR TenPhong IS NOT NULL)
       )
        THROW 51712, N'Kết thúc hợp đồng không đồng bộ thành viên, sinh viên hoặc sĩ số phòng.', 1;

    ROLLBACK TRANSACTION;
    PRINT N'[014 verify] Kiểm tra thêm sinh viên, sức chứa, giới tính, rời hợp đồng, kết thúc hợp đồng, chuyển phòng, đại diện và sĩ số đều đạt; dữ liệu transaction đã rollback.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DELETE FROM dbo.ChiTietHopDong
    WHERE MaHopDong IN (@Contract, @SecondContract)
       OR MaSinhVien IN (SELECT MaSinhVien FROM @Students);
    DELETE FROM dbo.HopDong WHERE MaHopDong IN (@Contract, @SecondContract);
    DELETE FROM dbo.NhatKyHeThong
    WHERE DoiTuong = N'HopDong' AND MaDoiTuong IN (@Contract, @SecondContract);
    DELETE FROM dbo.SinhVien WHERE MaSinhVien IN (SELECT MaSinhVien FROM @Students);
    THROW;
END CATCH;
GO
