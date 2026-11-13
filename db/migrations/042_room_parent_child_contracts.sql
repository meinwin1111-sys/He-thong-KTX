SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 54200, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 54201, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'041')
    THROW 54202, N'Chạy migration 041 trước.', 1;
GO

IF COL_LENGTH(N'dbo.ChiTietHopDong', N'NgayKetThuc') IS NULL
    ALTER TABLE dbo.ChiTietHopDong ADD NgayKetThuc date NULL;
GO

UPDATE c
SET NgayKetThuc = hd.NgayKetThuc
FROM dbo.ChiTietHopDong c
INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
WHERE c.NgayKetThuc IS NULL;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.ChiTietHopDong')
      AND name = N'CK_CTHD_NgayKetThuc'
)
    ALTER TABLE dbo.ChiTietHopDong WITH CHECK
        ADD CONSTRAINT CK_CTHD_NgayKetThuc
        CHECK (NgayKetThuc IS NULL OR NgayKetThuc >= NgayVao);
GO

CREATE OR ALTER TRIGGER dbo.trg_ChiTietHopDong_DefaultEndDate
ON dbo.ChiTietHopDong
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c
    SET NgayKetThuc = hd.NgayKetThuc
    FROM dbo.ChiTietHopDong c
    INNER JOIN inserted i ON i.MaChiTiet = c.MaChiTiet
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
    WHERE c.NgayKetThuc IS NULL;
END;
GO

CREATE OR ALTER VIEW dbo.vw_NgayKetThucHieuLucThanhVien
AS
SELECT c.MaChiTiet, c.MaHopDong, c.MaSinhVien, hd.TenPhong,
       COALESCE(c.NgayKetThuc, hd.NgayKetThuc) AS NgayKetThucGoc,
       COALESCE(latestRenewal.NgayKetThucMoi, c.NgayKetThuc, hd.NgayKetThuc) AS NgayKetThucHieuLuc
FROM dbo.ChiTietHopDong c
INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
OUTER APPLY
(
    SELECT TOP (1) g.NgayKetThucMoi
    FROM dbo.GiaHanHopDong g
    WHERE g.MaChiTiet = c.MaChiTiet
      AND g.TrangThai = N'Đã hiệu lực'
    ORDER BY g.NgayKetThucMoi DESC, g.MaGiaHan DESC
) latestRenewal;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVienVaoHopDong
    @MaHopDong nvarchar(20),
    @MaSinhVien nvarchar(30),
    @KyHanThanhToanPhong nvarchar(10) = N'THANG',
    @LaNguoiDaiDien bit = 0,
    @NguoiThucHien int = NULL,
    @NgayVao date = NULL,
    @NgayKetThuc date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @KyHanThanhToanPhong NOT IN (N'THANG', N'NAM')
        THROW 51431, N'Kỳ hạn tiền phòng phải là THANG hoặc NAM.', 1;

    DECLARE @Room nvarchar(50), @RoomTier nvarchar(20), @ParentEnd date,
            @Gender nvarchar(10), @Capacity int, @RoomStatus nvarchar(20),
            @RoomCount int, @StudentGender nvarchar(10), @MonthlyPrice decimal(18,2),
            @YearlyPrice decimal(18,2), @RepresentativeExists bit = 0,
            @UseRepresentative bit, @Start date, @End date, @DetailId int,
            @Today date = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));
    SET @Start = COALESCE(@NgayVao, @Today);
    SELECT @Room = TenPhong
    FROM dbo.HopDong
    WHERE MaHopDong = @MaHopDong;
    IF @Room IS NULL
        THROW 51432, N'Không tìm thấy hợp đồng hiệu lực.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Gender = p.LoaiPhong, @RoomStatus = p.TrangThaiPhong,
               @Capacity = p.SucChuaToiDa, @RoomTier = p.MaHangPhong,
               @MonthlyPrice = hp.GiaPhongThang, @YearlyPrice = hp.GiaPhongNam
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TenPhong = @Room;
        IF @Gender IS NULL
            THROW 51425, N'Không tìm thấy phòng hoặc hạng phòng.', 1;
        IF @RoomStatus IN (N'Bảo trì', N'Ngưng sử dụng')
            THROW 51433, N'Phòng đang bảo trì hoặc ngưng sử dụng.', 1;

        SELECT @ParentEnd = hd.NgayKetThuc
        FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHopDong = @MaHopDong AND hd.TrangThaiHopDong = N'Còn hiệu lực'
          AND hd.TenPhong = @Room AND hd.MaHangPhong = @RoomTier;
        IF @ParentEnd IS NULL
            THROW 51438, N'Hợp đồng không còn hiệu lực.', 1;
        SET @End = COALESCE(@NgayKetThuc, @ParentEnd);
        IF @End <= @Start
            THROW 51420, N'Ngày kết thúc hợp đồng phải sau ngày bắt đầu.', 1;

        SELECT @RoomCount = COUNT(*),
               @RepresentativeExists = CONVERT(bit, COALESCE(MAX(CONVERT(int, c.LaNguoiDaiDienThanhToanDichVu)), 0))
        FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK) ON c.MaHopDong = hd.MaHopDong
        WHERE hd.TenPhong = @Room AND hd.TrangThaiHopDong = N'Còn hiệu lực'
          AND c.TrangThai = N'Đang ở';
        IF @RoomCount >= @Capacity
            THROW 51434, N'Phòng đã đủ sức chứa.', 1;

        SELECT @StudentGender = GioiTinh
        FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK)
        WHERE MaSinhVien = @MaSinhVien;
        IF @StudentGender IS NULL OR @StudentGender <> @Gender
           OR EXISTS
           (
               SELECT 1 FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
               WHERE MaSinhVien = @MaSinhVien AND TrangThai = N'Đang ở'
           )
            THROW 51435, N'Sinh viên không tồn tại, sai giới tính hoặc đã có hợp đồng hiệu lực.', 1;

        SET @UseRepresentative = CASE
            WHEN @LaNguoiDaiDien = 1 OR @RepresentativeExists = 0 THEN 1 ELSE 0 END;
        IF @LaNguoiDaiDien = 1
            UPDATE c
            SET LaNguoiDaiDienThanhToanDichVu = 0
            FROM dbo.ChiTietHopDong c
            INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
            WHERE hd.TenPhong = @Room AND hd.TrangThaiHopDong = N'Còn hiệu lực'
              AND c.TrangThai = N'Đang ở';

        INSERT INTO dbo.ChiTietHopDong
            (MaHopDong, MaSinhVien, NgayVao, NgayKetThuc, KyHanThanhToanPhong,
             GiaPhongApDung, GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu,
             TrangThai, GhiChu)
        VALUES
            (@MaHopDong, @MaSinhVien, @Start, @End, @KyHanThanhToanPhong,
             CASE WHEN @KyHanThanhToanPhong = N'NAM' THEN COALESCE(@YearlyPrice, 0)
                  ELSE COALESCE(@MonthlyPrice, 0) END,
             COALESCE(@MonthlyPrice, 0), @UseRepresentative, N'Đang ở', NULL);
        SET @DetailId = SCOPE_IDENTITY();

        UPDATE hd
        SET NgayBatDau = dates.FirstStart, NgayKetThuc = dates.LastEnd
        FROM dbo.HopDong hd
        CROSS APPLY
        (
            SELECT MIN(c.NgayVao) AS FirstStart, MAX(c.NgayKetThuc) AS LastEnd
            FROM dbo.ChiTietHopDong c
            WHERE c.MaHopDong = hd.MaHopDong AND c.TrangThai = N'Đang ở'
        ) dates
        WHERE hd.MaHopDong = @MaHopDong;

        EXEC dbo.sp_GhiNhatKyHopDong N'Thêm sinh viên', @MaHopDong, @MaSinhVien, @NguoiThucHien;
        COMMIT TRANSACTION;
        SELECT @DetailId AS MaChiTiet;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

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
                @NewContract nvarchar(20), @Representative bit,
                @Today date = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));
        SELECT @OldDetail = c.MaChiTiet, @OldContract = hd.MaHopDong, @OldRoom = hd.TenPhong,
               @OldTier = hd.MaHangPhong, @Term = c.KyHanThanhToanPhong,
               @Rate = c.GiaPhongApDung, @Monthly = c.GiaPhongThangApDung,
               @Representative = c.LaNguoiDaiDienThanhToanDichVu,
               @End = COALESCE(effectiveEnd.NgayKetThucHieuLuc, c.NgayKetThuc, hd.NgayKetThuc)
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK) ON hd.MaHopDong = c.MaHopDong
        LEFT JOIN dbo.vw_NgayKetThucHieuLucThanhVien effectiveEnd
            ON effectiveEnd.MaChiTiet = c.MaChiTiet
        WHERE c.MaSinhVien = @MaSinhVien AND c.TrangThai = N'Đang ở'
          AND hd.TrangThaiHopDong = N'Còn hiệu lực';
        IF @OldDetail IS NULL THROW 51442, N'Sinh viên không thuộc hợp đồng hiệu lực.', 1;

        SELECT @NewTier = p.MaHangPhong, @Gender = p.LoaiPhong,
               @Capacity = hp.SucChuaToiDa, @RoomStatus = p.TrangThaiPhong
        FROM dbo.Phong p
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TenPhong = @PhongMoi;
        IF @NewTier IS NULL THROW 51443, N'Không tìm thấy phòng đích hoặc hạng phòng.', 1;

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
          AND hd.TrangThaiHopDong = N'Còn hiệu lực'
          AND c.TrangThai = N'Đang ở';
        IF @OldTier <> @NewTier
            THROW 51444, N'Không thể chuyển khác hạng phòng; cần xử lý tiền phòng đã đóng trước ở Bước 3.', 1;
        IF @RoomStatus IN (N'Bảo trì', N'Ngưng sử dụng')
            THROW 51445, N'Phòng đích đang bảo trì hoặc ngưng sử dụng.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien AND GioiTinh = @Gender)
            THROW 51446, N'Giới tính sinh viên không phù hợp phòng đích.', 1;
        IF @OldRoom <> @PhongMoi AND @Count >= @Capacity
            THROW 51447, N'Phòng đích đã đủ sức chứa.', 1;
        IF @OldRoom = @PhongMoi
            THROW 51448, N'Sinh viên đã ở phòng này.', 1;

        SELECT TOP (1) @NewContract = MaHopDong
        FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE TenPhong = @PhongMoi AND TrangThaiHopDong = N'Còn hiệu lực'
        ORDER BY MaHopDong;
        IF @NewContract IS NULL
        BEGIN
            SET @NewContract = N'HD' + RIGHT(N'00000' + CONVERT(nvarchar(10), NEXT VALUE FOR dbo.Seq_MaHopDong), 5);
            INSERT INTO dbo.HopDong
                (MaHopDong, TenPhong, MaHangPhong, NgayBatDau, NgayKetThuc,
                 TrangThaiHopDong, NgayTao, GhiChu, SoLanGiaHan)
            VALUES
                (@NewContract, @PhongMoi, @NewTier, @Today, @End,
                 N'Còn hiệu lực', @Today, N'Chuyển phòng', 0);
        END;

        IF @Representative = 1
            UPDATE dbo.ChiTietHopDong
            SET LaNguoiDaiDienThanhToanDichVu = 0
            WHERE MaHopDong = @OldContract AND MaChiTiet = @OldDetail;
        UPDATE dbo.ChiTietHopDong
        SET TrangThai = N'Đã chuyển phòng', NgayRa = @Today,
            LyDoRoi = N'Chuyển phòng', LaNguoiDaiDienThanhToanDichVu = 0
        WHERE MaChiTiet = @OldDetail;

        IF EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @NewContract AND TrangThai = N'Đang ở'
              AND LaNguoiDaiDienThanhToanDichVu = 1
        )
            SET @Representative = 0;
        ELSE
            SET @Representative = 1;

        INSERT INTO dbo.ChiTietHopDong
            (MaHopDong, MaSinhVien, NgayVao, NgayKetThuc, KyHanThanhToanPhong,
             GiaPhongApDung, GiaPhongThangApDung,
             LaNguoiDaiDienThanhToanDichVu, TrangThai, GhiChu)
        VALUES (@NewContract, @MaSinhVien, @Today, @End, @Term, @Rate,
                @Monthly, COALESCE(@Representative, 0), N'Đang ở', N'Chuyển phòng');

        IF EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @OldContract AND TrangThai = N'Đang ở'
        )
        BEGIN
            UPDATE hd
            SET NgayBatDau = dates.FirstStart, NgayKetThuc = dates.LastEnd
            FROM dbo.HopDong hd
            CROSS APPLY
            (
                SELECT MIN(c.NgayVao) AS FirstStart, MAX(c.NgayKetThuc) AS LastEnd
                FROM dbo.ChiTietHopDong c
                WHERE c.MaHopDong = hd.MaHopDong AND c.TrangThai = N'Đang ở'
            ) dates
            WHERE hd.MaHopDong = @OldContract;
        END
        ELSE
            UPDATE dbo.HopDong
            SET TrangThaiHopDong = N'Đã kết thúc', NgayKetThucThucTe = @Today
            WHERE MaHopDong = @OldContract AND TrangThaiHopDong = N'Còn hiệu lực';

        UPDATE hd
        SET NgayBatDau = dates.FirstStart, NgayKetThuc = dates.LastEnd
        FROM dbo.HopDong hd
        CROSS APPLY
        (
            SELECT MIN(c.NgayVao) AS FirstStart, MAX(c.NgayKetThuc) AS LastEnd
            FROM dbo.ChiTietHopDong c
            WHERE c.MaHopDong = hd.MaHopDong AND c.TrangThai = N'Đang ở'
        ) dates
        WHERE hd.MaHopDong = @NewContract;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @OldContract AND TrangThai = N'Đang ở'
              AND LaNguoiDaiDienThanhToanDichVu = 1
        )
        BEGIN
            DECLARE @Replacement int;
            SELECT TOP (1) @Replacement = MaChiTiet
            FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @OldContract AND TrangThai = N'Đang ở'
            ORDER BY NgayVao, MaChiTiet;
            IF @Replacement IS NOT NULL
                UPDATE dbo.ChiTietHopDong SET LaNguoiDaiDienThanhToanDichVu = 1
                WHERE MaChiTiet = @Replacement;
        END;

        DECLARE @LogDetails nvarchar(500);
        SET @LogDetails = N'Sinh viên ' + @MaSinhVien + N' chuyển đến ' + @PhongMoi;
        EXEC dbo.sp_GhiNhatKyHopDong N'Chuyển phòng', @OldContract,
             @LogDetails, @NguoiThucHien;
        COMMIT TRANSACTION;
        SELECT @NewContract AS MaHopDongMoi;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'042')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'042', N'042_room_parent_child_contracts.sql');
GO
PRINT N'[042] Hoàn tất: hợp đồng cha theo phòng, hợp đồng con và tiền phòng theo sinh viên.';
GO
