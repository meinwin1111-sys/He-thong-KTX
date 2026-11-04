SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 53400, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 53401, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'033')
    THROW 53402, N'Chạy migration 033 trước.', 1;
GO

CREATE OR ALTER PROCEDURE dbo.sp_DuyetTraPhongSom
    @MaYeuCau nvarchar(7),
    @TrangThai nvarchar(15),
    @PhanHoi nvarchar(500) = NULL,
    @NguoiThucHien int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @TrangThai NOT IN (N'Đã duyệt', N'Từ chối')
        THROW 53310, N'Trạng thái xử lý không hợp lệ.', 1;
    IF @TrangThai = N'Từ chối' AND NULLIF(LTRIM(RTRIM(@PhanHoi)), N'') IS NULL
        THROW 53311, N'Lý do từ chối là bắt buộc.', 1;

    DECLARE @MaSinhVien nvarchar(30), @TenPhong nvarchar(50), @MaHopDong nvarchar(20),
            @MaChiTiet int, @NgayDeXuat date, @NgayBatDau date,
            @NgayKetThucGoc date, @NgayKetThucHieuLuc date,
            @NgayKetThucGocPhan date, @Today date, @Count bigint,
            @TienPhong decimal(18,2), @BasePaid decimal(18,2),
            @BaseUsed decimal(18,2),
            @BaseRefund decimal(18,2), @TotalRefund decimal(18,2) = 0,
            @TotalPaid decimal(18,2) = 0, @MaPhieuChi bigint,
            @Title nvarchar(200), @Content nvarchar(2000), @EventKey nvarchar(100),
            @MaGiaHan int, @MaHoaDonGiaHan nvarchar(20);

    SELECT @MaSinhVien = yc.MaSinhVien, @TenPhong = yc.TenPhong,
           @NgayDeXuat = yc.NgayKetThucDeXuat
    FROM dbo.YeuCauSinhVien yc
    WHERE yc.MaYeuCau = @MaYeuCau
      AND yc.Loai = N'Trả phòng sớm'
      AND yc.TrangThai = N'Chờ duyệt';
    IF @MaSinhVien IS NULL
        THROW 53312, N'Không tìm thấy yêu cầu trả phòng sớm đang chờ duyệt.', 1;

    IF @TrangThai = N'Từ chối'
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;
            UPDATE dbo.YeuCauSinhVien WITH (UPDLOCK, HOLDLOCK)
            SET TrangThai = N'Từ chối', PhanHoi = NULLIF(LTRIM(RTRIM(@PhanHoi)), N''),
                NgayXuLy = CONVERT(datetime, DATEADD(hour, 7, SYSUTCDATETIME())),
                XuLyBoi = @NguoiThucHien
            WHERE MaYeuCau = @MaYeuCau AND Loai = N'Trả phòng sớm'
              AND TrangThai = N'Chờ duyệt';
            IF @@ROWCOUNT <> 1
                THROW 53313, N'Yêu cầu đã được xử lý.', 1;
            SET @Title = N'Yêu cầu trả phòng sớm bị từ chối';
            SET @Content = N'Yêu cầu trả phòng sớm bị từ chối. Lý do: '
                + LTRIM(RTRIM(@PhanHoi));
            SET @EventKey = N'CHECKOUT:' + @MaYeuCau + N':' + @MaSinhVien;
            IF NOT EXISTS (SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                           WHERE MaSuKien = @EventKey AND MaSinhVien = @MaSinhVien)
                INSERT INTO dbo.ThongBao
                    (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien)
                VALUES (@Title, @Content, N'SINH_VIEN', @MaSinhVien,
                        @NguoiThucHien, @EventKey);
            COMMIT TRANSACTION;
            SELECT @MaYeuCau AS MaYeuCau, N'Từ chối' AS TrangThai,
                   @PhanHoi AS PhanHoi, CAST(NULL AS bigint) AS MaPhieuChi,
                   CAST(0 AS decimal(18,2)) AS SoTienHoan;
            RETURN;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            THROW;
        END CATCH;
    END;

    SELECT TOP (1) @MaChiTiet = c.MaChiTiet, @MaHopDong = c.MaHopDong
    FROM dbo.ChiTietHopDong c
    INNER JOIN dbo.HopDong h ON h.MaHopDong = c.MaHopDong
    WHERE c.MaSinhVien = @MaSinhVien AND h.TenPhong = @TenPhong
      AND c.NgayVao <= @NgayDeXuat AND c.TrangThai = N'Đang ở'
    ORDER BY c.NgayVao DESC, c.MaChiTiet DESC;
    IF @MaChiTiet IS NULL
        THROW 53314, N'Không tìm thấy thành viên đang ở phù hợp với yêu cầu.', 1;

    SET @Today = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));
    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Count = COUNT_BIG(*) FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE TenPhong = @TenPhong;
        IF @Count = 0
            THROW 53314, N'Không tìm thấy phòng của thành viên.', 1;

        SELECT @TenPhong = TenPhong, @NgayKetThucGoc = NgayKetThuc
        FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND TrangThaiHopDong = N'Còn hiệu lực';
        IF @TenPhong IS NULL
            THROW 53314, N'Hợp đồng không còn hiệu lực.', 1;

        SELECT @MaSinhVien = c.MaSinhVien, @NgayBatDau = c.NgayVao,
               @TienPhong = CASE WHEN c.KyHanThanhToanPhong = N'NAM'
                                 THEN c.GiaPhongApDung ELSE c.GiaPhongThangApDung END,
               @NgayKetThucHieuLuc = effectiveEnd.NgayKetThucHieuLuc
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.vw_NgayKetThucHieuLucThanhVien effectiveEnd
            ON effectiveEnd.MaChiTiet = c.MaChiTiet
        WHERE c.MaChiTiet = @MaChiTiet AND c.MaHopDong = @MaHopDong
          AND c.TrangThai = N'Đang ở';
        IF @NgayBatDau IS NULL OR @NgayKetThucHieuLuc IS NULL
            THROW 53314, N'Thành viên không còn ở trong hợp đồng.', 1;

        SELECT @Count = COUNT_BIG(*) FROM dbo.GiaHanHopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChiTiet = @MaChiTiet;
        SELECT TOP (1) @MaGiaHan = MaGiaHan, @MaHoaDonGiaHan = MaHoaDon
        FROM dbo.GiaHanHopDong
        WHERE MaChiTiet = @MaChiTiet AND TrangThai = N'Chờ thanh toán'
        ORDER BY MaGiaHan DESC;

        SELECT @Count = COUNT_BIG(*) FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChiTiet = @MaChiTiet AND LoaiHoaDon = N'TIEN_PHONG';
        SELECT @Count = COUNT_BIG(*)
        FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
        WHERE EXISTS
        (
            SELECT 1 FROM dbo.PhieuThu pt
            INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
            WHERE pt.MaGiaoDich = gd.MaGiaoDich AND hd.MaChiTiet = @MaChiTiet
        );
        SELECT @Count = COUNT_BIG(*)
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
        WHERE hd.MaChiTiet = @MaChiTiet AND hd.LoaiHoaDon = N'TIEN_PHONG';

        UPDATE dbo.YeuCauSinhVien WITH (UPDLOCK, HOLDLOCK)
        SET TrangThai = N'Đã duyệt', PhanHoi = NULL,
            NgayXuLy = CONVERT(datetime, DATEADD(hour, 7, SYSUTCDATETIME())),
            XuLyBoi = @NguoiThucHien
        WHERE MaYeuCau = @MaYeuCau AND MaSinhVien = @MaSinhVien
          AND TrangThai = N'Chờ duyệt';
        IF @@ROWCOUNT <> 1
            THROW 53313, N'Yêu cầu đã được xử lý.', 1;

        IF @MaGiaHan IS NOT NULL
        BEGIN
            IF EXISTS (SELECT 1 FROM dbo.PhieuThu
                       WHERE MaHoaDon = @MaHoaDonGiaHan
                         AND TrangThai <> N'Đã hủy')
                THROW 53315, N'Gia hạn đang chờ đã có khoản thu; cần kiểm tra trạng thái trước khi trả phòng.', 1;
            UPDATE dbo.GiaHanHopDong
            SET TrangThai = N'Hủy', NgayCapNhat = SYSUTCDATETIME(),
                GhiChu = CONCAT(COALESCE(GhiChu + N' | ', N''), N'Hủy do trả phòng sớm.')
            WHERE MaGiaHan = @MaGiaHan AND TrangThai = N'Chờ thanh toán';
            UPDATE dbo.HoaDon
            SET TrangThaiThanhToan = N'Đã hủy'
            WHERE MaHoaDon = @MaHoaDonGiaHan
              AND TrangThaiThanhToan <> N'Đã thanh toán';
            SET @EventKey = N'RENEWAL_CANCELLED:' + CONVERT(nvarchar(20), @MaGiaHan)
                + N':' + @MaSinhVien;
            IF NOT EXISTS (SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                           WHERE MaSuKien = @EventKey AND MaSinhVien = @MaSinhVien)
                INSERT INTO dbo.ThongBao
                    (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien, MaHoaDon)
                VALUES (N'Gia hạn đã bị hủy',
                        N'Gia hạn đang chờ thanh toán đã bị hủy do trả phòng sớm.',
                        N'SINH_VIEN', @MaSinhVien, @NguoiThucHien,
                        @EventKey, @MaHoaDonGiaHan);
        END;

        SELECT @NgayKetThucGocPhan = MIN(NgayKetThucCu)
        FROM dbo.GiaHanHopDong
        WHERE MaChiTiet = @MaChiTiet AND TrangThai = N'Đã hiệu lực';
        SET @NgayKetThucGocPhan = COALESCE(@NgayKetThucGocPhan, @NgayKetThucGoc);
        IF @TienPhong IS NULL OR @TienPhong <= 0
            THROW 53316, N'Không thể tính hoàn tiền vì giá tiền phòng không hợp lệ.', 1;
        IF @NgayDeXuat < @Today OR @NgayDeXuat <= @NgayBatDau
           OR @NgayDeXuat >= @NgayKetThucHieuLuc
            THROW 53317, N'Ngày kết thúc đề xuất không còn hợp lệ với hợp đồng hiện tại.', 1;

        DECLARE @BaseDays int = DATEDIFF(day, @NgayBatDau, @NgayKetThucGocPhan) + 1;
        DECLARE @BaseLived int =
            CASE WHEN @NgayDeXuat < @NgayKetThucGocPhan
                 THEN DATEDIFF(day, @NgayBatDau, @NgayDeXuat) + 1
                 ELSE @BaseDays END;
        IF @BaseDays <= 0
            THROW 53318, N'Khoảng thời gian hợp đồng gốc không hợp lệ.', 1;

        SELECT @BasePaid = ISNULL(SUM(
                   paid.Amount - ISNULL(refunded.Amount, 0)), 0)
        FROM dbo.HoaDon hd
        OUTER APPLY
        (
            SELECT SUM(pt.SoTien) AS Amount
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N'Hợp lệ'
        ) paid
        OUTER APPLY
        (
            SELECT SUM(pha.SoTien) AS Amount
            FROM dbo.PhieuChi_HoaDon pha
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = pha.MaPhieuChi
            WHERE pha.MaHoaDon = hd.MaHoaDon
              AND pc.TrangThai IN (N'Hợp lệ', N'Chờ duyệt')
        ) refunded
        WHERE hd.MaChiTiet = @MaChiTiet
          AND hd.LoaiHoaDon = N'TIEN_PHONG'
          AND hd.TrangThaiThanhToan <> N'Đã hủy'
          AND hd.KyThanhToan <= @NgayKetThucGocPhan
          AND hd.KyThanhToanDen >= @NgayBatDau
          AND NOT EXISTS
          (
              SELECT 1 FROM dbo.GiaHanHopDong renewal
              WHERE renewal.MaHoaDon = hd.MaHoaDon
                AND renewal.TrangThai = N'Đã hiệu lực'
          )
          AND ISNULL(paid.Amount, 0) > ISNULL(refunded.Amount, 0);

        SET @BasePaid = ISNULL(@BasePaid, 0);
        SET @BaseUsed = ROUND(@TienPhong * @BaseLived / NULLIF(@BaseDays, 0), 0);
        SET @BaseRefund = CASE WHEN @BasePaid > @BaseUsed
                               THEN @BasePaid - @BaseUsed ELSE 0 END;
        SET @TotalPaid = @BasePaid;
        SET @TotalRefund = @BaseRefund;

        DECLARE @Renewals table
        (
            RowNo int IDENTITY(1,1) PRIMARY KEY,
            MaGiaHan int NOT NULL,
            MaHoaDon nvarchar(20) NOT NULL,
            NgayBatDau date NOT NULL,
            NgayKetThuc date NOT NULL
        );
        INSERT INTO @Renewals(MaGiaHan, MaHoaDon, NgayBatDau, NgayKetThuc)
        SELECT g.MaGiaHan, g.MaHoaDon, DATEADD(day, 1, g.NgayKetThucCu),
               g.NgayKetThucMoi
        FROM dbo.GiaHanHopDong g
        WHERE g.MaChiTiet = @MaChiTiet
          AND g.TrangThai = N'Đã hiệu lực'
          AND g.MaHoaDon IS NOT NULL;

        DECLARE @RenewalInvoice nvarchar(20), @PeriodStart date, @PeriodEnd date,
                @PeriodDays int, @LivedDays int, @InvoiceTotal decimal(18,2),
                @PeriodPaid decimal(18,2), @PeriodRefunded decimal(18,2),
                @PeriodUsed decimal(18,2);
        DECLARE period_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT MaHoaDon, NgayBatDau, NgayKetThuc
            FROM @Renewals ORDER BY NgayBatDau, MaGiaHan;
        OPEN period_cursor;
        FETCH NEXT FROM period_cursor INTO @RenewalInvoice, @PeriodStart, @PeriodEnd;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @PeriodDays = DATEDIFF(day, @PeriodStart, @PeriodEnd) + 1;
            SET @LivedDays = CASE WHEN @NgayDeXuat < @PeriodStart THEN 0
                                  WHEN @NgayDeXuat >= @PeriodEnd THEN @PeriodDays
                                  ELSE DATEDIFF(day, @PeriodStart, @NgayDeXuat) + 1 END;
            SELECT @InvoiceTotal = ISNULL(SUM(chi.SoTien), 0)
            FROM dbo.ChiTietHoaDon chi WHERE chi.MaHoaDon = @RenewalInvoice;
            SELECT @PeriodPaid = ISNULL(SUM(pt.SoTien), 0)
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = @RenewalInvoice AND pt.TrangThai = N'Hợp lệ';
            SELECT @PeriodRefunded = ISNULL(SUM(pha.SoTien), 0)
            FROM dbo.PhieuChi_HoaDon pha
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = pha.MaPhieuChi
            WHERE pha.MaHoaDon = @RenewalInvoice
              AND pc.TrangThai IN (N'Hợp lệ', N'Chờ duyệt');
            SET @PeriodUsed = ROUND(@InvoiceTotal * @LivedDays / NULLIF(@PeriodDays, 0), 0);
            SET @TotalPaid += CASE WHEN @PeriodPaid > @PeriodRefunded
                                   THEN @PeriodPaid - @PeriodRefunded ELSE 0 END;
            SET @TotalRefund += CASE
                WHEN @PeriodPaid - @PeriodRefunded > @PeriodUsed
                    THEN @PeriodPaid - @PeriodRefunded - @PeriodUsed
                ELSE 0 END;
            FETCH NEXT FROM period_cursor INTO @RenewalInvoice, @PeriodStart, @PeriodEnd;
        END;
        CLOSE period_cursor;
        DEALLOCATE period_cursor;

        IF @NgayDeXuat <= @Today
            EXEC dbo.sp_SinhVienRoiHopDong
                @MaChiTiet = @MaChiTiet, @NgayRa = @NgayDeXuat,
                @LyDoRoi = N'Trả phòng sớm', @NguoiThucHien = @NguoiThucHien,
                @SuppressMessage = 1;
        ELSE
            UPDATE dbo.ChiTietHopDong
            SET NgayRa = @NgayDeXuat, LyDoRoi = N'Trả phòng sớm'
            WHERE MaChiTiet = @MaChiTiet AND TrangThai = N'Đang ở';

        IF @TotalRefund > 0
        BEGIN
            DECLARE @RefundResult table
                (MaPhieuChi bigint, SoTien decimal(18,2),
                 GoiYBanDau decimal(18,2), SoThangDaSuDung int);
            INSERT INTO @RefundResult
            EXEC dbo.sp_TaoPhieuChi
                @MaChiTiet = @MaChiTiet, @NgayRa = @NgayDeXuat,
                @LyDo = N'Trả phòng sớm', @KhauTru = 0, @SoTien = @TotalRefund,
                @NguoiLap = @NguoiThucHien,
                @GhiChu = N'Hoàn tiền theo từng khoảng hợp đồng và gia hạn.';
            SELECT TOP (1) @MaPhieuChi = MaPhieuChi FROM @RefundResult;
        END;

        SET @Title = N'Yêu cầu trả phòng sớm đã được duyệt';
        SET @Content = N'Đã duyệt trả phòng sớm, ngày kết thúc mới '
            + CONVERT(nvarchar(10), @NgayDeXuat, 103) + N', '
            + CASE WHEN @TotalRefund > 0
                   THEN N'hoàn ' + FORMAT(@TotalRefund, N'N0', N'vi-VN')
                        + N' đ tiền mặt tại văn phòng'
                   ELSE N'không có khoản hoàn' END + N'.';
        SET @EventKey = N'CHECKOUT:' + @MaYeuCau + N':' + @MaSinhVien;
        IF NOT EXISTS (SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                       WHERE MaSuKien = @EventKey AND MaSinhVien = @MaSinhVien)
            INSERT INTO dbo.ThongBao
                (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien)
            VALUES (@Title, @Content, N'SINH_VIEN', @MaSinhVien,
                    @NguoiThucHien, @EventKey);

        COMMIT TRANSACTION;
        SELECT @MaYeuCau AS MaYeuCau, @TrangThai AS TrangThai, @PhanHoi AS PhanHoi,
               @MaPhieuChi AS MaPhieuChi, @TotalRefund AS SoTienHoan,
               @TotalPaid AS TongTienDaDong;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'period_cursor') >= 0
        BEGIN
            CLOSE period_cursor;
            DEALLOCATE period_cursor;
        END;
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'034')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'034', N'034_checkout_refund_base_period.sql');
GO
PRINT N'[034] Hoàn tất.';
GO
