:on error exit
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 51980, N'Chạy kiểm thử bằng sqlcmd -d KTX_Group3_test.', 1;
GO

DECLARE @Suffix nvarchar(8) = RIGHT(REPLACE(CONVERT(nvarchar(36), NEWID()), N'-', N''), 8),
        @Room nvarchar(50), @Gender nvarchar(10), @Tier nvarchar(20),
        @Capacity int, @Manager int, @Contract nvarchar(20),
        @Student nvarchar(30), @Student1 nvarchar(30), @Student2 nvarchar(30), @Student3 nvarchar(30),
        @MemberJson nvarchar(max), @Email varchar(100), @i int,
        @Start date = DATEFROMPARTS(YEAR(DATEADD(month, -6, GETDATE())),
                                   MONTH(DATEADD(month, -6, GETDATE())), 1),
        @End date, @CurrentPeriod date = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1),
        @SecondPeriod date, @ExitDate date, @Readings nvarchar(max), @Invoice300 nvarchar(20),
        @ServiceInvoice nvarchar(20), @CancelledServiceInvoice nvarchar(20),
        @TempInvoice nvarchar(20), @TempDetail nvarchar(40),
        @RoomInvoice1 nvarchar(20), @RoomInvoice2 nvarchar(20), @AnnualInvoice nvarchar(20),
        @MonthlyInvoice nvarchar(20), @Cost1 bigint, @Cost2 bigint, @Cost3 bigint,
        @ConcurrencyCost bigint, @ConcurrentInvoice nvarchar(20),
        @OverRefund decimal(18,2), @OverRefundId bigint,
        @Detail1 int, @Detail2 int, @Detail3 int, @MonthlyPrice decimal(18,2),
        @Paid decimal(18,2), @Used decimal(18,2), @Refunded decimal(18,2),
        @Suggested decimal(18,2), @RequestedRefund decimal(18,2),
        @Months int, @RefundId bigint, @WaitingReceipt bigint,
        @BeforeCount int, @AfterCount int;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'019')
    THROW 51981, N'Chạy run_all.sql trước khi chạy kiểm thử thanh toán.', 1;
IF NOT EXISTS (
    SELECT 1 FROM dbo.sysobjects
    WHERE id = OBJECT_ID(N'dbo.sp_GhiPhieuThu') AND type = N'P'
)
    THROW 51982, N'Thiếu dbo.sp_GhiPhieuThu.', 1;

BEGIN TRY
    SELECT TOP (1)
        @Room = p.TenPhong, @Gender = p.LoaiPhong,
        @Tier = p.MaHangPhong, @Capacity = hp.SucChuaToiDa
    FROM dbo.Phong p
    INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
    WHERE p.TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng')
      AND hp.SucChuaToiDa >= 3
      AND NOT EXISTS (
          SELECT 1 FROM dbo.HopDong hd
          WHERE hd.TenPhong = p.TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực'
      )
    ORDER BY hp.SucChuaToiDa DESC, p.TenPhong;
    IF @Room IS NULL
    BEGIN
        SELECT p.TenPhong, p.TrangThaiPhong, hp.SucChuaToiDa
        FROM dbo.Phong p INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TrangThaiPhong NOT IN (N'Bảo trì', N'Ngưng sử dụng')
        ORDER BY hp.SucChuaToiDa DESC;
        THROW 51983, N'Không có phòng trống đủ sức chứa ba sinh viên kiểm thử.', 1;
    END;

    SELECT TOP (1) @Manager = MaTaiKhoan
    FROM dbo.TaiKhoan
    WHERE VaiTro = N'Quản lý'
    ORDER BY MaTaiKhoan;
    IF @Manager IS NULL
    BEGIN
        SELECT MaTaiKhoan, VaiTro FROM dbo.TaiKhoan;
        THROW 51984, N'Không có tài khoản quản lý để ghi nhận người nhập chi phí.', 1;
    END;

    SET @Student1 = N'T019' + @Suffix + N'01';
    SET @Student2 = N'T019' + @Suffix + N'02';
    SET @Student3 = N'T019' + @Suffix + N'03';
    SET @Contract = N'T019' + @Suffix + N'01';
    SET @End = DATEADD(month, 24, @Start);

    SET @i = 1;
    WHILE @i <= 3
    BEGIN
        SET @Email = 't019.' + CONVERT(varchar(8), @Suffix) + '.' + CONVERT(varchar(1), @i) + '@example.invalid';
        SET @Student = CASE @i WHEN 1 THEN @Student1 WHEN 2 THEN @Student2 ELSE @Student3 END;
        EXEC dbo.sp_ThemSinhVien
            @MaSinhVien = @Student,
            @HoTen = N'Kiểm thử hóa đơn và phiếu',
            @NgaySinh = '2000-01-01',
            @GioiTinh = @Gender,
            @SDT = '0900000000',
            @Email = @Email,
            @DiaChi = N'Test payment migrations 016-019',
            @TenPhong = NULL,
            @GhiChu = NULL,
            @Truong = N'Test',
            @Lop = N'T019';
        SET @i += 1;
    END;

    SET @MemberJson = N'[
        {"maSinhVien":"' + @Student1 + N'","kyHanThanhToanPhong":"THANG","laNguoiDaiDien":true},
        {"maSinhVien":"' + @Student2 + N'","kyHanThanhToanPhong":"NAM","laNguoiDaiDien":false},
        {"maSinhVien":"' + @Student3 + N'","kyHanThanhToanPhong":"THANG","laNguoiDaiDien":false}
    ]';
    EXEC dbo.sp_TaoHopDong
        @TenPhong = @Room,
        @NgayBatDau = @Start,
        @NgayKetThuc = @End,
        @SinhVienJson = @MemberJson,
        @GhiChu = N'Test migrations 016-019',
        @MaHopDong = @Contract;

    SELECT @Detail1 = MaChiTiet FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @Contract AND MaSinhVien = @Student1 AND TrangThai = N'Đang ở';
    SELECT @Detail2 = MaChiTiet FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @Contract AND MaSinhVien = @Student2 AND TrangThai = N'Đang ở';
    SELECT @Detail3 = MaChiTiet FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @Contract AND MaSinhVien = @Student3 AND TrangThai = N'Đang ở';
    SELECT @MonthlyPrice = GiaPhongThangApDung
    FROM dbo.ChiTietHopDong WHERE MaChiTiet = @Detail1;

    INSERT INTO dbo.ChiPhiPhatSinh
        (MaHopDong, MaChiTiet, NoiDung, SoTien, NguoiNhap, GhiChu)
    VALUES (@Contract, @Detail3, N'Test receipt invoice total 300', 300, @Manager, N'T019 fixture');
    SET @Cost1 = SCOPE_IDENTITY();
    EXEC dbo.sp_TaoHoaDonPhatSinh @Cost1, @Invoice300 OUTPUT;

    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @Invoice300, @SoTien = 100, @PhuongThuc = N'CASH',
        @MaSinhVienNop = @Student1, @NguoiThu = @Manager;
    IF NOT EXISTS (
        SELECT 1 FROM dbo.HoaDon
        WHERE MaHoaDon = @Invoice300 AND TrangThaiThanhToan = N'Thanh toán một phần'
    )
    BEGIN
        SELECT MaHoaDon, TrangThaiThanhToan FROM dbo.HoaDon WHERE MaHoaDon = @Invoice300;
        THROW 51985, N'Hóa đơn 300 không chuyển sang thanh toán một phần sau khi thu 100.', 1;
    END;
    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @Invoice300, @SoTien = 200, @PhuongThuc = N'ONLINE',
        @MaSinhVienNop = @Student2;
    IF NOT EXISTS (
        SELECT 1 FROM dbo.HoaDon
        WHERE MaHoaDon = @Invoice300 AND TrangThaiThanhToan = N'Đã thanh toán'
    )
    BEGIN
        SELECT MaHoaDon, TrangThaiThanhToan FROM dbo.HoaDon WHERE MaHoaDon = @Invoice300;
        THROW 51986, N'Hóa đơn 300 không thành Đã thanh toán sau khi thu 100 + 200.', 1;
    END;

    BEGIN TRY
        EXEC dbo.sp_GhiPhieuThu
            @MaHoaDon = @Invoice300, @SoTien = 1, @PhuongThuc = N'CASH',
            @MaSinhVienNop = @Student1, @NguoiThu = @Manager;
        SELECT hd.MaHoaDon, SUM(c.SoTien) AS TongHoaDon,
               (SELECT ISNULL(SUM(pt.SoTien), 0) FROM dbo.PhieuThu pt
                WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N'Hợp lệ') AS DaThu
        FROM dbo.HoaDon hd
        INNER JOIN dbo.ChiTietHoaDon c ON c.MaHoaDon = hd.MaHoaDon
        WHERE hd.MaHoaDon = @Invoice300
        GROUP BY hd.MaHoaDon;
        THROW 51987, N'Không chặn thu vượt tổng hóa đơn.', 1;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() <> 51916 THROW;
    END CATCH;

    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @Invoice300, @SoTien = 1, @PhuongThuc = N'CASH',
        @MaSinhVienNop = @Student1, @NguoiThu = @Manager,
        @TrangThai = N'Chờ xác nhận';
    SELECT @WaitingReceipt = MAX(MaPhieuThu)
    FROM dbo.PhieuThu WHERE MaHoaDon = @Invoice300 AND TrangThai = N'Chờ xác nhận';
    DECLARE @Confirmation TABLE (
        MaPhieuThu bigint,
        TrangThaiGiaoDich nvarchar(20),
        LyDoDoiSoat nvarchar(255)
    );
    INSERT INTO @Confirmation
    EXEC dbo.sp_XacNhanPhieuThu
        @MaPhieuThu = @WaitingReceipt, @NguoiXacNhan = @Manager;
    IF NOT EXISTS (
        SELECT 1 FROM @Confirmation
        WHERE MaPhieuThu = @WaitingReceipt
          AND TrangThaiGiaoDich = N'RECONCILIATION'
          AND LyDoDoiSoat IS NOT NULL
    ) OR NOT EXISTS (
        SELECT 1 FROM dbo.PhieuThu
        WHERE MaPhieuThu = @WaitingReceipt AND TrangThai = N'Chờ xác nhận'
    )
    BEGIN
        SELECT hd.MaHoaDon, pt.MaPhieuThu, pt.SoTien, pt.TrangThai,
               SUM(c.SoTien) AS TongHoaDon, cf.TrangThaiGiaoDich, cf.LyDoDoiSoat
        FROM dbo.HoaDon hd
        INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = hd.MaHoaDon
        INNER JOIN dbo.ChiTietHoaDon c ON c.MaHoaDon = hd.MaHoaDon
        LEFT JOIN @Confirmation cf ON cf.MaPhieuThu = pt.MaPhieuThu
        WHERE pt.MaPhieuThu = @WaitingReceipt
        GROUP BY hd.MaHoaDon, pt.MaPhieuThu, pt.SoTien, pt.TrangThai,
                 cf.TrangThaiGiaoDich, cf.LyDoDoiSoat;
        THROW 51988, N'Không chặn xác nhận phiếu chờ làm vượt tổng hóa đơn.', 1;
    END;
    DELETE FROM dbo.PhieuThu WHERE MaPhieuThu = @WaitingReceipt;

    INSERT INTO dbo.ChiPhiPhatSinh
        (MaHopDong, MaChiTiet, NoiDung, SoTien, NguoiNhap, GhiChu)
    VALUES
        (@Contract, @Detail1, N'Test first incident on service invoice', 51, @Manager, N'T019 fixture'),
        (@Contract, NULL, N'Test shared incident on service invoice', 52, @Manager, N'T019 fixture');
    SELECT @Cost2 = MIN(MaChiPhi), @Cost3 = MAX(MaChiPhi)
    FROM dbo.ChiPhiPhatSinh
    WHERE MaHopDong = @Contract AND GhiChu = N'T019 fixture'
      AND MaChiPhi <> @Cost1;

    SELECT @Readings = (
        SELECT MaDichVu AS maDichVu, 0 AS chiSoCu, 1 AS chiSoMoi
        FROM dbo.DichVu WHERE MaDichVu IN (N'DIEN', N'NUOC')
        FOR JSON PATH
    );
    EXEC dbo.sp_TaoHoaDonDichVuPhong
        @MaHopDong = @Contract, @KyThanhToan = @CurrentPeriod,
        @ChiSoJson = @Readings, @MaSinhVienNop = @Student1,
        @MaHoaDon = @ServiceInvoice OUTPUT;
    IF (SELECT COUNT(*) FROM dbo.ChiTietHoaDon
        WHERE MaHoaDon = @ServiceInvoice AND MaKhoan = N'INCIDENT') <> 2
       OR (SELECT COUNT(DISTINCT TenKhoan) FROM dbo.ChiTietHoaDon
           WHERE MaHoaDon = @ServiceInvoice AND MaKhoan = N'INCIDENT') <> 2
       OR (SELECT COUNT(*) FROM dbo.ChiPhiPhatSinh
           WHERE MaChiPhi IN (@Cost2, @Cost3)
             AND TrangThai = N'Đã lập hóa đơn') <> 2
    BEGIN
        SELECT MaChiTiet, MaKhoan, TenKhoan, SoTien
        FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @ServiceInvoice;
        THROW 51989, N'Hai khoản phát sinh chưa vào hóa đơn thành hai dòng INCIDENT duy nhất.', 1;
    END;
    IF NOT EXISTS (
        SELECT 1 FROM dbo.HoaDon
        WHERE MaHoaDon = @ServiceInvoice AND LoaiHoaDon = N'DICH_VU_PHONG'
          AND KyThanhToan = @CurrentPeriod
    )
    BEGIN
        SELECT MaHoaDon, LoaiHoaDon, KyThanhToan FROM dbo.HoaDon WHERE MaHoaDon = @ServiceInvoice;
        THROW 51990, N'Không tạo được hóa đơn dịch vụ kỳ cần kiểm tra.', 1;
    END;
    IF NOT EXISTS (
        SELECT 1 FROM dbo.HoaDon
        WHERE MaHoaDon = @Invoice300 AND LoaiHoaDon = N'PHAT_SINH'
          AND KyThanhToan = @CurrentPeriod
    )
    BEGIN
        SELECT MaHoaDon, LoaiHoaDon, KyThanhToan
        FROM dbo.HoaDon WHERE MaHoaDon = @Invoice300;
        THROW 51991, N'Hóa đơn PHAT_SINH riêng không cùng kỳ với hóa đơn dịch vụ.', 1;
    END;

    SET @SecondPeriod = DATEADD(month, 1, @CurrentPeriod);
    EXEC dbo.sp_TaoHoaDonDichVuPhong
        @MaHopDong = @Contract, @KyThanhToan = @SecondPeriod,
        @ChiSoJson = @Readings, @MaSinhVienNop = @Student1,
        @MaHoaDon = @CancelledServiceInvoice OUTPUT;
    UPDATE dbo.HoaDon SET TrangThaiThanhToan = N'Đã hủy'
    WHERE MaHoaDon = @CancelledServiceInvoice;
    EXEC dbo.sp_TaoHoaDonDichVuPhong
        @MaHopDong = @Contract, @KyThanhToan = @SecondPeriod,
        @ChiSoJson = @Readings, @MaSinhVienNop = @Student1,
        @MaHoaDon = @TempInvoice OUTPUT;
    IF @TempInvoice = @CancelledServiceInvoice
       OR NOT EXISTS (
           SELECT 1 FROM dbo.HoaDon
           WHERE MaHoaDon = @TempInvoice AND TrangThaiThanhToan <> N'Đã hủy'
       )
    BEGIN
        SELECT MaHoaDon, TrangThaiThanhToan FROM dbo.HoaDon
        WHERE MaHopDong = @Contract AND LoaiHoaDon = N'DICH_VU_PHONG'
          AND KyThanhToan = @SecondPeriod;
        THROW 51992, N'Hóa đơn dịch vụ bị hủy không cho lập lại cùng kỳ.', 1;
    END;

    EXEC dbo.sp_TaoHoaDonTienPhong @Detail1, @Start, @RoomInvoice1 OUTPUT;
    SET @SecondPeriod = DATEADD(month, 1, @Start);
    EXEC dbo.sp_TaoHoaDonTienPhong @Detail1, @SecondPeriod, @RoomInvoice2 OUTPUT;
    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @RoomInvoice1, @SoTien = @MonthlyPrice, @PhuongThuc = N'CASH',
        @MaSinhVienNop = @Student1, @NguoiThu = @Manager;
    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @RoomInvoice2, @SoTien = @MonthlyPrice, @PhuongThuc = N'CASH',
        @MaSinhVienNop = @Student1, @NguoiThu = @Manager;
    EXEC dbo.sp_TinhGoiYHoanTien
        @MaChiTiet = @Detail1, @NgayRa = @Start,
        @SoThangDaSuDung = @Months OUTPUT, @TienSuDung = @Used OUTPUT,
        @SoTienDaDong = @Paid OUTPUT, @SoTienDaHoan = @Refunded OUTPUT,
        @GoiYHoan = @Suggested OUTPUT;
    IF @Months <> 0 OR @Used <> 0 OR @Paid <> 2 * @MonthlyPrice OR @Suggested <> @Paid
    BEGIN
        SELECT @Months AS SoThang, @Used AS TienSuDung, @Paid AS DaDong, @Suggested AS GoiY;
        THROW 51993, N'Gợi ý hoàn tiền 0 ngày không khớp.', 1;
    END;

    SET @RequestedRefund = @MonthlyPrice + (@MonthlyPrice / 2);
    EXEC dbo.sp_TaoPhieuChi
        @MaChiTiet = @Detail1, @NgayRa = @Start, @LyDo = N'Khác',
        @SoTien = @RequestedRefund, @NguoiLap = @Manager,
        @GhiChu = N'Điều chỉnh theo kịch bản kiểm thử';
    SELECT @RefundId = MAX(MaPhieuChi) FROM dbo.PhieuChi WHERE MaChiTiet = @Detail1;
    SELECT @BeforeCount = COUNT(*) FROM dbo.PhieuChi_HoaDon WHERE MaPhieuChi = @RefundId;
    SELECT @AfterCount = COUNT(*) FROM dbo.PhieuChi_HoaDon
    WHERE MaPhieuChi = @RefundId AND SoTien > 0;
    IF @BeforeCount <> 2 OR @AfterCount <> 2
    BEGIN
        SELECT MaPhieuChi, MaHoaDon, SoTien
        FROM dbo.PhieuChi_HoaDon WHERE MaPhieuChi = @RefundId;
        THROW 51994, N'Phiếu chi không được phân bổ qua cả hai hóa đơn tháng.', 1;
    END;

    SET @OverRefund = @RequestedRefund + 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT INTO dbo.PhieuChi
            (MaChiTiet, SoTienDaDong, SoTienDaSuDung, KhauTru, SoTien,
             NgayRa, LyDo, TrangThai, NguoiLap, GhiChu)
        VALUES
            (@Detail1, @MonthlyPrice * 2, 0, 0, @OverRefund,
             @Start, N'Khác', N'Chờ duyệt', @Manager, N'T019 over-refund rejection');
        SET @OverRefundId = SCOPE_IDENTITY();
        INSERT INTO dbo.PhieuChi_HoaDon (MaPhieuChi, MaHoaDon, SoTien)
        VALUES
            (@OverRefundId, @RoomInvoice1, @MonthlyPrice),
            (@OverRefundId, @RoomInvoice2, @OverRefund - @MonthlyPrice);
        UPDATE dbo.PhieuChi
        SET TrangThai = N'Hợp lệ'
        WHERE MaPhieuChi = @OverRefundId;
        SELECT @OverRefundId AS MaPhieuChi, @OverRefund AS TienChiVuot,
               @MonthlyPrice * 2 AS TongTienDaThu;
        THROW 52009, N'Không chặn phiếu chi vượt tổng thu hợp lệ.', 1;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        IF ERROR_NUMBER() <> 51811 THROW;
    END CATCH;

    EXEC dbo.sp_TinhGoiYHoanTien
        @MaChiTiet = @Detail1, @NgayRa = @Start,
        @SoThangDaSuDung = @Months OUTPUT, @TienSuDung = @Used OUTPUT,
        @SoTienDaDong = @Paid OUTPUT, @SoTienDaHoan = @Refunded OUTPUT,
        @GoiYHoan = @Suggested OUTPUT;
    IF @Refunded <> @RequestedRefund OR @Suggested <> @Paid - @RequestedRefund
    BEGIN
        SELECT @Paid AS DaDong, @Refunded AS DaHoan, @Suggested AS GoiY;
        THROW 51995, N'Gợi ý không trừ đúng khoản đã hoàn một phần.', 1;
    END;

    EXEC dbo.sp_TaoHoaDonTienPhong @Detail2, @Start, @AnnualInvoice OUTPUT;
    SELECT @Paid = SUM(SoTien) FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @AnnualInvoice;
    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @AnnualInvoice, @SoTien = @Paid, @PhuongThuc = N'ONLINE',
        @MaSinhVienNop = @Student2;
    SET @ExitDate = DATEADD(day, 3, DATEADD(month, 5, @Start));
    EXEC dbo.sp_TinhGoiYHoanTien
        @MaChiTiet = @Detail2, @NgayRa = @ExitDate,
        @SoThangDaSuDung = @Months OUTPUT, @TienSuDung = @Used OUTPUT,
        @SoTienDaDong = @Paid OUTPUT, @SoTienDaHoan = @Refunded OUTPUT,
        @GoiYHoan = @Suggested OUTPUT;
    IF @Months <> 6 OR @Suggested <> CASE WHEN @Paid - (6 * @MonthlyPrice) > 0
                                           THEN @Paid - (6 * @MonthlyPrice) ELSE 0 END
    BEGIN
        SELECT @Months AS SoThang, @Paid AS DaDong, @MonthlyPrice AS GiaThang,
               @Used AS TienSuDung, @Suggested AS GoiY;
        THROW 51996, N'Gợi ý hoàn cho 5 tháng + 3 ngày không làm tròn lên đúng 6 tháng.', 1;
    END;
    SET @ExitDate = DATEADD(month, 12, @Start);
    EXEC dbo.sp_TinhGoiYHoanTien
        @MaChiTiet = @Detail2, @NgayRa = @ExitDate,
        @SoThangDaSuDung = @Months OUTPUT, @TienSuDung = @Used OUTPUT,
        @SoTienDaDong = @Paid OUTPUT, @SoTienDaHoan = @Refunded OUTPUT,
        @GoiYHoan = @Suggested OUTPUT;
    IF @Months <> 12 OR @Used <> 12 * @MonthlyPrice
       OR @Suggested <> CASE WHEN @Paid - (12 * @MonthlyPrice) > 0
                              THEN @Paid - (12 * @MonthlyPrice) ELSE 0 END
    BEGIN
        SELECT @Months AS SoThang, @Paid AS DaDong, @MonthlyPrice AS GiaThang,
               @Used AS TienSuDung, @Suggested AS GoiY;
        THROW 52008, N'Gợi ý hoàn đủ 12 tháng không khớp giá tháng snapshot.', 1;
    END;

    EXEC dbo.sp_TaoHoaDonTienPhong @Detail3, @Start, @MonthlyInvoice OUTPUT;
    SELECT @Paid = SUM(SoTien) FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @MonthlyInvoice;
    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @MonthlyInvoice, @SoTien = @Paid, @PhuongThuc = N'CASH',
        @MaSinhVienNop = @Student3, @NguoiThu = @Manager;
    SET @ExitDate = EOMONTH(@Start);
    EXEC dbo.sp_TinhGoiYHoanTien
        @MaChiTiet = @Detail3, @NgayRa = @ExitDate,
        @SoThangDaSuDung = @Months OUTPUT, @TienSuDung = @Used OUTPUT,
        @SoTienDaDong = @Paid OUTPUT, @SoTienDaHoan = @Refunded OUTPUT,
        @GoiYHoan = @Suggested OUTPUT;
    IF @Months <> 1 OR @Suggested <> 0
    BEGIN
        SELECT @Months AS SoThang, @Paid AS DaDong, @Used AS TienSuDung, @Suggested AS GoiY;
        THROW 51997, N'Gợi ý hoàn sau khi đã sử dụng đủ tháng không đúng.', 1;
    END;

    INSERT INTO dbo.ChiPhiPhatSinh
        (MaHopDong, MaChiTiet, NoiDung, SoTien, NguoiNhap, GhiChu)
    VALUES (@Contract, @Detail3, N'Test concurrent receipts total 300', 300,
            @Manager, N'T019 concurrency fixture');
    SET @ConcurrencyCost = SCOPE_IDENTITY();
    EXEC dbo.sp_TaoHoaDonPhatSinh @ConcurrencyCost, @ConcurrentInvoice OUTPUT;
    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @ConcurrentInvoice, @SoTien = 100, @PhuongThuc = N'CASH',
        @MaSinhVienNop = @Student3, @NguoiThu = @Manager;

    SELECT @ConcurrentInvoice AS ConcurrentReceiptTestInvoice,
           CONVERT(decimal(18,2), 300) AS InvoiceTotal,
           CONVERT(decimal(18,2), 100) AS InitialReceipt,
           CONVERT(decimal(18,2), 200) AS EachConcurrentReceipt;
    SET @ExitDate = DATEADD(day, 3, DATEADD(month, 5, @Start));
    SELECT @Detail2 AS ConcurrentRefundTestMember, @ExitDate AS ConcurrentRefundTestExitDate;
    PRINT N'[016-019 verify] Đạt: thu 100+200, chặn thu vượt/xác nhận chờ vượt, hai INCIDENT, PHAT_SINH cùng kỳ DICH_VU, hủy/lập lại, hoàn qua hai hóa đơn, chặn chi vượt thu, hoàn 0 ngày/5 tháng+3 ngày/12 tháng/đóng tháng/đã hoàn một phần.';
    PRINT N'Chạy db/tests/019_concurrent_receipt_worker.sql đồng thời hai lần với MaHoaDon vừa in; chỉ một phiên được ghi nhận.';
    PRINT N'Chạy db/tests/019_concurrent_refund_worker.sql đồng thời hai lần với ConcurrentRefundTestMember và ConcurrentRefundTestExitDate; chỉ một phiên được hoàn.';
    PRINT N'Fixture T019 được giữ tạm trên KTX_Group3_test; restore lại DB test để dọn dữ liệu sau kiểm thử.';
END TRY
BEGIN CATCH
    THROW;
END CATCH;
GO
