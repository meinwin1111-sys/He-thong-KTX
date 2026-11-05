:on error exit
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 52290, N'Chạy kiểm thử bằng sqlcmd -d KTX_Group3_test.', 1;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'022')
    THROW 52291, N'Chạy db/run_all.sql trước khi kiểm thử migration 022.', 1;
GO

DECLARE @Token nvarchar(12) = LEFT(REPLACE(CONVERT(nvarchar(36), NEWID()), N'-', N''), 12),
        @ManagerId int, @Room nvarchar(50), @Gender nvarchar(10),
        @Capacity int, @District nvarchar(10), @RoomClass nvarchar(20),
        @StudentId nvarchar(30), @ContractId nvarchar(20), @DetailId int,
        @RentInvoice nvarchar(20), @ServiceInvoice nvarchar(20),
        @IncidentInvoice nvarchar(20), @Date date = CONVERT(date, GETDATE()),
        @PeriodDate date,
        @EndDate date, @MembersJson nvarchar(max), @ReceiptAmount decimal(18,2),
        @RentAmount decimal(18,2), @ExpectedDebt decimal(18,2),
        @ActualDebt decimal(18,2), @ExpectedRevenue decimal(18,2),
        @ActualRevenue decimal(18,2), @ExpectedService decimal(18,2),
        @ActualService decimal(18,2), @ExpectedIncident decimal(18,2),
        @ActualIncident decimal(18,2);

BEGIN TRY
    BEGIN TRANSACTION;

    SET @Room = N'RPT-' + @Token;
    SET @StudentId = N'RPT' + @Token;
    SET @ContractId = N'RPT' + @Token;
    SET @EndDate = DATEADD(day, 30, @Date);
    SET @PeriodDate = DATEFROMPARTS(YEAR(@Date), MONTH(@Date), 1);
    SET @MembersJson = N'[{"maSinhVien":"' + @StudentId
        + N'","kyHanThanhToanPhong":"THANG","laNguoiDaiDien":true}]';

    INSERT INTO dbo.TaiKhoan (Email, MatKhau, TenHienThi, VaiTro)
    VALUES ('rpt' + CONVERT(varchar(12), @Token) + '@test.invalid',
            'report-test-only', N'Fixture kiểm thử báo cáo', N'Quản lý');
    SET @ManagerId = CONVERT(int, SCOPE_IDENTITY());

    SELECT TOP (1)
        @Gender = p.LoaiPhong,
        @Capacity = p.SucChuaToiDa,
        @District = p.Khu,
        @RoomClass = p.MaHangPhong
    FROM dbo.Phong p
    WHERE p.MaHangPhong IS NOT NULL
      AND p.LoaiPhong IN (N'Nam', N'Nữ')
    ORDER BY p.TenPhong;

    IF @RoomClass IS NULL
        THROW 52292, N'Không tìm được hạng phòng để tạo fixture báo cáo.', 1;

    INSERT INTO dbo.Phong
        (TenPhong, LoaiPhong, SucChuaToiDa, SoSinhVienHienTai,
         TrangThaiPhong, GhiChu, Khu, MaHangPhong)
    VALUES
        (@Room, @Gender, @Capacity, 0, N'Trống', N'Fixture kiểm thử báo cáo',
         @District, @RoomClass);

    INSERT INTO dbo.SinhVien (MaSinhVien, HoTen, GioiTinh, TrangThaiSinhVien)
    VALUES (@StudentId, N'Sinh viên fixture báo cáo', @Gender, N'Đã rời KTX');

    EXEC dbo.sp_TaoHopDong
        @TenPhong = @Room,
        @NgayBatDau = @Date,
        @NgayKetThuc = @EndDate,
        @SinhVienJson = @MembersJson,
        @NguoiThucHien = @ManagerId,
        @MaHopDong = @ContractId;

    SELECT @DetailId = MaChiTiet
    FROM dbo.ChiTietHopDong
    WHERE MaHopDong = @ContractId AND MaSinhVien = @StudentId;

    EXEC dbo.sp_TaoHoaDonTienPhong
        @MaChiTiet = @DetailId,
        @KyThanhToan = @PeriodDate,
        @MaHoaDon = @RentInvoice OUTPUT;

    SELECT @RentAmount = TongThuc
    FROM dbo.vw_HoaDonTongHop
    WHERE MaHoaDon = @RentInvoice;
    SET @ReceiptAmount = @RentAmount / 2;

    INSERT INTO dbo.HoaDon
        (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TrangThaiThanhToan,
         LoaiHoaDon, MaHopDong, KyThanhToan, KyThanhToanDen)
    VALUES
        (N'RPT' + @Token + N'S', NULL, @Room, @Date, N'Chưa thanh toán',
         N'DICH_VU_PHONG', @ContractId, DATEFROMPARTS(YEAR(@Date), MONTH(@Date), 1),
         EOMONTH(@Date));
    SET @ServiceInvoice = N'RPT' + @Token + N'S';
    INSERT INTO dbo.ChiTietHoaDon
        (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia)
    VALUES
        (N'RPT' + @Token + N'S-1', @ServiceInvoice, N'REPORT_SERVICE',
         N'Dịch vụ fixture báo cáo', 1000, 1, 1000);

    INSERT INTO dbo.HoaDon
        (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TrangThaiThanhToan,
         LoaiHoaDon, MaHopDong, KyThanhToan, KyThanhToanDen)
    VALUES
        (N'RPT' + @Token + N'P', NULL, @Room, @Date, N'Chưa thanh toán',
         N'PHAT_SINH', @ContractId, DATEFROMPARTS(YEAR(@Date), MONTH(@Date), 1),
         EOMONTH(@Date));
    SET @IncidentInvoice = N'RPT' + @Token + N'P';
    INSERT INTO dbo.ChiTietHoaDon
        (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia)
    VALUES
        (N'RPT' + @Token + N'P-1', @IncidentInvoice, N'REPORT_INCIDENT',
         N'Phát sinh fixture báo cáo', 500, 1, 500);

    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @RentInvoice, @SoTien = @ReceiptAmount,
        @PhuongThuc = N'CASH', @MaSinhVienNop = @StudentId,
        @NguoiThu = @ManagerId;
    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @ServiceInvoice, @SoTien = 100,
        @PhuongThuc = N'CASH', @MaSinhVienNop = @StudentId,
        @NguoiThu = @ManagerId;
    EXEC dbo.sp_GhiPhieuThu
        @MaHoaDon = @IncidentInvoice, @SoTien = 50,
        @PhuongThuc = N'CASH', @MaSinhVienNop = @StudentId,
        @NguoiThu = @ManagerId;

    EXEC dbo.sp_TaoPhieuChi
        @MaChiTiet = @DetailId, @NgayRa = @Date, @LyDo = N'Khác',
        @NguoiLap = @ManagerId, @GhiChu = N'Hoàn tiền fixture kiểm thử báo cáo';

    UPDATE dbo.PhieuChi
    SET TrangThai = N'Hợp lệ'
    WHERE MaChiTiet = @DetailId AND GhiChu LIKE N'%fixture kiểm thử báo cáo%';

    SELECT @ExpectedDebt = ISNULL(SUM(
        CASE WHEN ISNULL(inv.TongHoaDon, 0) > ISNULL(paid.DaThu, 0)
             THEN ISNULL(inv.TongHoaDon, 0) - ISNULL(paid.DaThu, 0)
             ELSE 0 END), 0)
    FROM dbo.HoaDon hd
    OUTER APPLY (
        SELECT SUM(ct.SoTien) AS TongHoaDon
        FROM dbo.ChiTietHoaDon ct WHERE ct.MaHoaDon = hd.MaHoaDon
    ) inv
    OUTER APPLY (
        SELECT SUM(pt.SoTien) AS DaThu
        FROM dbo.PhieuThu pt
        WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N'Hợp lệ'
    ) paid
    WHERE ISNULL(hd.TrangThaiThanhToan, N'') <> N'Đã hủy';

    SELECT @ActualDebt = ISNULL(SUM(TongCongNo), 0)
    FROM dbo.vw_CongNo;

    SELECT @ExpectedRevenue =
        ISNULL((SELECT SUM(pt.SoTien)
                FROM dbo.PhieuThu pt
                WHERE pt.TrangThai = N'Hợp lệ'
                  AND YEAR(pt.NgayThu) = YEAR(@Date)
                  AND MONTH(pt.NgayThu) = MONTH(@Date)), 0)
        - ISNULL((SELECT SUM(pha.SoTien)
                  FROM dbo.PhieuChi pc
                  INNER JOIN dbo.PhieuChi_HoaDon pha ON pha.MaPhieuChi = pc.MaPhieuChi
                  WHERE pc.TrangThai = N'Hợp lệ'
                    AND YEAR(pc.NgayChi) = YEAR(@Date)
                    AND MONTH(pc.NgayChi) = MONTH(@Date)), 0);

    SELECT @ActualRevenue = TongDoanhThu,
           @ActualService = DoanhThuDichVu,
           @ActualIncident = DoanhThuPhatSinh
    FROM dbo.vw_DoanhThuThang
    WHERE Nam = YEAR(@Date) AND Thang = MONTH(@Date);

    SELECT @ExpectedService =
        ISNULL((SELECT SUM(pt.SoTien)
                FROM dbo.PhieuThu pt
                INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                WHERE pt.TrangThai = N'Hợp lệ'
                  AND hd.LoaiHoaDon IN (N'DICH_VU_PHONG', N'CU')
                  AND YEAR(pt.NgayThu) = YEAR(@Date)
                  AND MONTH(pt.NgayThu) = MONTH(@Date)), 0)
        - ISNULL((SELECT SUM(pha.SoTien)
                  FROM dbo.PhieuChi pc
                  INNER JOIN dbo.PhieuChi_HoaDon pha ON pha.MaPhieuChi = pc.MaPhieuChi
                  INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pha.MaHoaDon
                  WHERE pc.TrangThai = N'Hợp lệ'
                    AND hd.LoaiHoaDon IN (N'DICH_VU_PHONG', N'CU')
                    AND YEAR(pc.NgayChi) = YEAR(@Date)
                    AND MONTH(pc.NgayChi) = MONTH(@Date)), 0);

    SELECT @ExpectedIncident =
        ISNULL((SELECT SUM(pt.SoTien)
                FROM dbo.PhieuThu pt
                INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                WHERE pt.TrangThai = N'Hợp lệ'
                  AND hd.LoaiHoaDon = N'PHAT_SINH'
                  AND YEAR(pt.NgayThu) = YEAR(@Date)
                  AND MONTH(pt.NgayThu) = MONTH(@Date)), 0)
        - ISNULL((SELECT SUM(pha.SoTien)
                  FROM dbo.PhieuChi pc
                  INNER JOIN dbo.PhieuChi_HoaDon pha ON pha.MaPhieuChi = pc.MaPhieuChi
                  INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pha.MaHoaDon
                  WHERE pc.TrangThai = N'Hợp lệ'
                    AND hd.LoaiHoaDon = N'PHAT_SINH'
                    AND YEAR(pc.NgayChi) = YEAR(@Date)
                    AND MONTH(pc.NgayChi) = MONTH(@Date)), 0);

    SELECT N'Tổng công nợ (mọi hóa đơn chưa hủy)' AS CaTest,
           @ExpectedDebt AS TruyVanTrucTiep, @ActualDebt AS vw_CongNo;
    SELECT N'Doanh thu ròng tháng sau hoàn tiền' AS CaTest,
           @ExpectedRevenue AS ThuHopLeTruChiHopLe, @ActualRevenue AS vw_DoanhThuThang;
    SELECT N'Dịch vụ / phát sinh' AS CaTest,
           @ExpectedService AS NetDichVuTrucTiep, @ActualService AS NetDichVuView,
           @ExpectedIncident AS NetPhatSinhTrucTiep, @ActualIncident AS NetPhatSinhView;
    SELECT LoaiHoaDon, TenPhong, MaHopDong, MaSinhVien, HoTen,
           TongHoaDon, DaThu, TongCongNo, SoHoaDon
    FROM dbo.vw_CongNo
    WHERE TenPhong = @Room
    ORDER BY LoaiHoaDon;

    IF @ExpectedDebt <> @ActualDebt
        THROW 52293, N'Tổng công nợ vw_CongNo không khớp tính trực tiếp từ hóa đơn và phiếu thu.', 1;
    IF ISNULL(@ExpectedRevenue, 0) <> ISNULL(@ActualRevenue, 0)
        THROW 52294, N'Doanh thu ròng không khớp tổng phiếu thu trừ phân bổ phiếu chi hợp lệ.', 1;
    IF ISNULL(@ExpectedService, 0) <> ISNULL(@ActualService, 0)
       OR ISNULL(@ExpectedIncident, 0) <> ISNULL(@ActualIncident, 0)
        THROW 52295, N'Doanh thu theo nhóm dịch vụ/phát sinh không khớp dữ liệu phiếu.', 1;
    IF NOT EXISTS (
        SELECT 1 FROM dbo.vw_CongNo
        WHERE TenPhong = @Room AND MaHopDong = @ContractId
          AND LoaiHoaDon = N'TIEN_PHONG' AND MaSinhVien = @StudentId
    )
        THROW 52296, N'Công nợ tiền phòng không được nhóm về thành viên hợp đồng.', 1;
    IF NOT EXISTS (
        SELECT 1 FROM dbo.vw_CongNo
        WHERE TenPhong = @Room AND MaHopDong = @ContractId
          AND LoaiHoaDon = N'DICH_VU_PHONG' AND MaSinhVien IS NULL
    )
        THROW 52297, N'Công nợ dịch vụ không được nhóm theo phòng/hợp đồng.', 1;
    IF NOT EXISTS (
        SELECT 1 FROM dbo.vw_CongNo
        WHERE TenPhong = @Room AND MaHopDong = @ContractId
          AND LoaiHoaDon = N'PHAT_SINH' AND MaSinhVien IS NULL
    )
        THROW 52298, N'Công nợ phát sinh không được nhóm theo phòng/hợp đồng.', 1;

    PRINT N'[022 financial reports verify] Đạt: công nợ gồm hóa đơn không có MaSinhVien; doanh thu nhóm và doanh thu ròng khớp phiếu thật.';
    ROLLBACK TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
