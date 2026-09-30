SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

USE [KTX_Group3];
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Today date = CAST(GETDATE() AS date),
            @Room nvarchar(50),
            @Gender nvarchar(10),
            @RoomBefore int,
            @RoomAfterInsert int,
            @RoomAfterClose int,
            @StudentCode nvarchar(30) = N'SV010TEST1234567890123456',
            @StudentEmail nvarchar(100) = N'verify.010.longcode@example.invalid',
            @ContractId nvarchar(20) = N'T010-EXP-001',
            @ContractStart date,
            @ContractEnd date,
            @ActualEnd date,
            @StudentStatus nvarchar(20),
            @StudentRoom nvarchar(50),
            @StudentLeaveDate date,
            @ContractStatus nvarchar(20),
            @HistoryCount int,
            @Run1Ended int,
            @Run1Errors int,
            @Run2Ended int,
            @Run2Errors int,
            @StoredCode nvarchar(30),
            @ObservedPartial varchar(20),
            @ObservedDebt decimal(18,2),
            @OverdueDebt decimal(18,2),
            @MaLSDefinition nvarchar(max),
            @DistinctProbeMaLS int;

    IF EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @StudentCode)
        THROW 50210, N'Mã sinh viên test đã tồn tại.', 1;
    IF EXISTS (SELECT 1 FROM dbo.HopDong WHERE MaHopDong = @ContractId)
        THROW 50211, N'Mã hợp đồng test đã tồn tại.', 1;
    IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = N'T010-INVOICE')
        THROW 50212, N'Mã hóa đơn test đã tồn tại.', 1;

    SELECT TOP (1)
        @Room = TenPhong,
        @Gender = LoaiPhong,
        @RoomBefore = ISNULL(SoSinhVienHienTai, 0)
    FROM dbo.Phong
    WHERE TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng')
      AND ISNULL(SoSinhVienHienTai, 0) < SucChuaToiDa
    ORDER BY SucChuaToiDa - ISNULL(SoSinhVienHienTai, 0) DESC, TenPhong;

    IF @Room IS NULL
        THROW 50213, N'Không có phòng còn chỗ để chạy kiểm thử.', 1;

    EXEC dbo.sp_ThemSinhVien
        @MaSinhVien = @StudentCode,
        @HoTen = N'Sinh viên kiểm tra Migration 010',
        @NgaySinh = '2000-01-01',
        @GioiTinh = @Gender,
        @SDT = '0900000999',
        @Email = @StudentEmail,
        @DiaChi = N'Kiểm thử rollback',
        @TenPhong = @Room,
        @GhiChu = NULL,
        @Truong = N'Test',
        @Lop = N'T010';

    SELECT @StoredCode = MaSinhVien FROM dbo.SinhVien WHERE MaSinhVien = @StudentCode;
    SELECT @RoomAfterInsert = SoSinhVienHienTai FROM dbo.Phong WHERE TenPhong = @Room;
    IF @StoredCode <> @StudentCode OR LEN(@StoredCode) <> 25
        THROW 50214, N'sp_ThemSinhVien đã cắt mã 25 ký tự.', 1;
    IF @RoomAfterInsert <> @RoomBefore + 1
        THROW 50215, N'Sĩ số phòng không tăng sau khi thêm sinh viên.', 1;

    SET @ContractStart = DATEADD(day, -30, @Today);
    SET @ContractEnd = DATEADD(day, -1, @Today);

    DECLARE @CreatedContract TABLE (MaHopDong nvarchar(20));
    INSERT INTO @CreatedContract (MaHopDong)
    EXEC dbo.sp_TaoHopDong
        @MaHopDong = @ContractId,
        @MaSinhVien = @StudentCode,
        @TenPhong = @Room,
        @NgayBatDau = @ContractStart,
        @NgayKetThuc = @ContractEnd,
        @GhiChu = N'Kiểm thử Migration 010';

    IF NOT EXISTS (
        SELECT 1 FROM dbo.HopDong
        WHERE MaHopDong = @ContractId AND MaSinhVien = @StudentCode
    )
        THROW 50216, N'Hợp đồng không lưu nguyên mã sinh viên 25 ký tự.', 1;

    DECLARE @Run1 TABLE (SoHopDongDaKetThuc int, SoLoi int);
    INSERT INTO @Run1 EXEC dbo.sp_CapNhatHopDong;
    SELECT @Run1Ended = SoHopDongDaKetThuc, @Run1Errors = SoLoi FROM @Run1;

    SELECT @ContractStatus = TrangThaiHopDong, @ActualEnd = NgayKetThucThucTe
    FROM dbo.HopDong WHERE MaHopDong = @ContractId;
    SELECT @StudentStatus = TrangThaiSinhVien,
           @StudentRoom = TenPhong,
           @StudentLeaveDate = NgayRoiKTX
    FROM dbo.SinhVien WHERE MaSinhVien = @StudentCode;
    SELECT @RoomAfterClose = SoSinhVienHienTai FROM dbo.Phong WHERE TenPhong = @Room;
    SELECT @HistoryCount = COUNT(*)
    FROM dbo.LichSuHopDong
    WHERE MaHopDong = @ContractId AND ThaoTac = N'Kết thúc';

    IF ISNULL(@Run1Errors, -1) <> 0 OR ISNULL(@Run1Ended, 0) < 1
        THROW 50217, N'sp_CapNhatHopDong không kết thúc hợp đồng hoặc có lỗi.', 1;
    IF @ContractStatus <> N'Đã kết thúc' OR @ActualEnd <> @ContractEnd
        THROW 50218, N'Trạng thái/ngày kết thúc thực tế của hợp đồng không đúng.', 1;
    IF @StudentStatus <> N'Đã rời KTX' OR @StudentRoom IS NOT NULL OR @StudentLeaveDate <> @ContractEnd
        THROW 50219, N'Trạng thái, phòng hoặc ngày rời KTX của sinh viên không đúng.', 1;
    IF @RoomAfterClose <> @RoomBefore OR @HistoryCount <> 1
        THROW 50220, N'Sĩ số phòng hoặc lịch sử kết thúc hợp đồng không đúng.', 1;

    DECLARE @Run2 TABLE (SoHopDongDaKetThuc int, SoLoi int);
    INSERT INTO @Run2 EXEC dbo.sp_CapNhatHopDong;
    SELECT @Run2Ended = SoHopDongDaKetThuc, @Run2Errors = SoLoi FROM @Run2;
    IF ISNULL(@Run2Ended, -1) <> 0 OR ISNULL(@Run2Errors, -1) <> 0
        THROW 50221, N'Lần chạy thứ hai phải không kết thúc thêm hợp đồng và không báo lỗi.', 1;

    SELECT @MaLSDefinition = cc.definition
    FROM sys.computed_columns cc
    WHERE cc.object_id = OBJECT_ID(N'dbo.LichSuHopDong')
      AND cc.name = N'MaLS'
      AND cc.is_persisted = 1;
    IF @MaLSDefinition IS NULL OR @MaLSDefinition NOT LIKE N'%1000%'
        THROW 50222, N'dbo.LichSuHopDong.MaLS không phải persisted computed column theo công thức mới.', 1;

    CREATE TABLE #MaLSProbe
    (
        MaLichSu int NOT NULL,
        MaLS AS (
            CASE
                WHEN MaLichSu < 1000
                    THEN N'LS' + RIGHT(N'000' + CAST(MaLichSu AS varchar(10)), 3)
                ELSE N'LS' + CAST(MaLichSu AS varchar(10))
            END
        ) PERSISTED,
        CONSTRAINT UQ_MaLSProbe UNIQUE (MaLS)
    );
    INSERT INTO #MaLSProbe (MaLichSu) VALUES (1), (999), (1000), (1001);
    SELECT @DistinctProbeMaLS = COUNT(DISTINCT MaLS) FROM #MaLSProbe;
    IF @DistinctProbeMaLS <> 4
       OR (SELECT MaLS FROM #MaLSProbe WHERE MaLichSu = 999) <> N'LS999'
       OR (SELECT MaLS FROM #MaLSProbe WHERE MaLichSu = 1000) <> N'LS1000'
       OR (SELECT MaLS FROM #MaLSProbe WHERE MaLichSu = 1001) <> N'LS1001'
        THROW 50223, N'MaLS bị trùng hoặc sai định dạng từ ID 1000.', 1;

    INSERT INTO dbo.HoaDon (
        MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, ChiSoDien, ChiSoNuoc,
        TienDien, TienNuoc, TrangThaiThanhToan, HanThanhToan
    )
    VALUES (
        N'T010-INVOICE', @StudentCode, @Room, DATEADD(day, -60, @Today),
        1000, 0, 0, 500, 0, N'Chưa thanh toán', DATEADD(day, -30, @Today)
    );

    UPDATE dbo.ChiTietHoaDon
    SET TrangThai = N'Đã thanh toán',
        NgayThanhToan = DATEADD(day, -45, @Today)
    WHERE MaHoaDon = N'T010-INVOICE' AND MaKhoan = N'ROOM';

    SELECT @ObservedPartial = TrangThaiSuyRa,
           @ObservedDebt = ConNo,
           @OverdueDebt = CASE
               WHEN ConNo > 0 AND HanThanhToan < @Today THEN ConNo ELSE 0
           END
    FROM dbo.vw_HoaDonTongHop
    WHERE MaHoaDon = N'T010-INVOICE';

    DECLARE @ViewOverdueDebt decimal(18,2);
    SELECT @ViewOverdueDebt = CongNoQuaHan
    FROM dbo.vw_CongNo
    WHERE MaSinhVien = @StudentCode;

    IF @ObservedPartial <> 'PARTIAL' OR @ObservedDebt <> 500 OR @OverdueDebt <> 500
       OR @ViewOverdueDebt <> 500
        THROW 50224, N'vw_CongNo không cộng công nợ hóa đơn PARTIAL đã quá hạn.', 1;

    EXEC dbo.sp_KiemTraChuanHoaDuLieu @ApDung = 1;

    ROLLBACK TRANSACTION;
    PRINT N'[010 verify] Tất cả kiểm thử đạt; transaction đã rollback.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO