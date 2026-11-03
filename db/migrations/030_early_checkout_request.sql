SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 53000, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 53001, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'029')
    THROW 53002, N'Chạy migration 029 trước.', 1;
IF OBJECT_ID(N'dbo.YeuCauSinhVien', N'U') IS NULL
    THROW 53003, N'Không tìm thấy bảng dbo.YeuCauSinhVien.', 1;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM dbo.SchemaMigration WITH (UPDLOCK, HOLDLOCK)
        WHERE MaMigration = N'030'
    )
    BEGIN
        COMMIT TRANSACTION;
        PRINT N'[030] Đã chạy trước đó — bỏ qua.';
        RETURN;
    END;

    DECLARE @InvalidRequestTypes bigint;
    SELECT @InvalidRequestTypes = COUNT_BIG(*)
    FROM dbo.YeuCauSinhVien WITH (TABLOCKX, HOLDLOCK)
    WHERE Loai NOT IN (N'Gia hạn hợp đồng', N'Báo hỏng thiết bị', N'Yêu cầu khác', N'Trả phòng sớm');

    IF @InvalidRequestTypes > 0
        THROW 53004, N'Có loại yêu cầu hiện hữu ngoài danh sách được hỗ trợ; không thay đổi constraint.', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.YeuCauSinhVien
        WHERE Loai = N'Trả phòng sớm'
          AND NgayKetThucDeXuat IS NULL
    )
        THROW 53005, N'Có yêu cầu trả phòng sớm thiếu ngày kết thúc đề xuất; cần xử lý dữ liệu trước migration.', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.YeuCauSinhVien
        WHERE Loai = N'Trả phòng sớm'
          AND TrangThai = N'Chờ duyệt'
        GROUP BY MaSinhVien
        HAVING COUNT_BIG(*) > 1
    )
        THROW 53006, N'Có sinh viên trùng yêu cầu trả phòng sớm đang chờ duyệt; cần xử lý trước migration.', 1;

    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.YeuCauSinhVien')
          AND name = N'CK_YeuCau_Loai'
    )
        ALTER TABLE dbo.YeuCauSinhVien DROP CONSTRAINT CK_YeuCau_Loai;

    ALTER TABLE dbo.YeuCauSinhVien WITH CHECK
    ADD CONSTRAINT CK_YeuCau_Loai
    CHECK (Loai IN (N'Gia hạn hợp đồng', N'Báo hỏng thiết bị', N'Yêu cầu khác', N'Trả phòng sớm'));

    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.YeuCauSinhVien')
          AND name = N'CK_YeuCau_TraPhongSom_Ngay'
    )
        ALTER TABLE dbo.YeuCauSinhVien WITH CHECK
        ADD CONSTRAINT CK_YeuCau_TraPhongSom_Ngay
        CHECK (Loai <> N'Trả phòng sớm' OR NgayKetThucDeXuat IS NOT NULL);

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.YeuCauSinhVien')
          AND name = N'UX_YeuCau_TraPhongSom_ChoDuyet'
    )
        CREATE UNIQUE INDEX UX_YeuCau_TraPhongSom_ChoDuyet
            ON dbo.YeuCauSinhVien (MaSinhVien)
            WHERE Loai = N'Trả phòng sớm'
              AND TrangThai = N'Chờ duyệt';

    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.PhieuChi')
          AND name = N'CK_PhieuChi_LyDo'
    )
        ALTER TABLE dbo.PhieuChi DROP CONSTRAINT CK_PhieuChi_LyDo;
    ALTER TABLE dbo.PhieuChi WITH CHECK
    ADD CONSTRAINT CK_PhieuChi_LyDo
    CHECK (LyDo IN (N'Nghỉ học giữa chừng', N'Chuyển đi', N'Khác', N'Trả phòng sớm'));

    IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.ChiTietHopDong')
          AND name = N'CK_CTHD_TrangThai_NgayRa'
    )
        ALTER TABLE dbo.ChiTietHopDong DROP CONSTRAINT CK_CTHD_TrangThai_NgayRa;
    ALTER TABLE dbo.ChiTietHopDong WITH CHECK
    ADD CONSTRAINT CK_CTHD_TrangThai_NgayRa
    CHECK (
        (TrangThai = N'Đang ở' AND (NgayRa IS NULL OR NgayRa >= NgayVao))
        OR (TrangThai <> N'Đang ở' AND NgayRa IS NOT NULL)
    );

    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'030', N'030_early_checkout_request.sql');

    COMMIT TRANSACTION;
    PRINT N'[030] Hoàn tất.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

CREATE OR ALTER PROCEDURE dbo.sp_SinhVienRoiHopDong
    @MaChiTiet int,
    @NgayRa date = NULL,
    @LyDoRoi nvarchar(100) = NULL,
    @NguoiThucHien int = NULL,
    @SuppressMessage bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @StartedTransaction bit = 0;
    BEGIN TRY
        IF @@TRANCOUNT = 0
        BEGIN
            BEGIN TRANSACTION;
            SET @StartedTransaction = 1;
        END
        ELSE
            SAVE TRANSACTION SinhVienRoiHopDongSave;

        DECLARE @Contract nvarchar(20), @Student nvarchar(30), @WasRep bit,
                @LeaveDate date = COALESCE(@NgayRa, CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))),
                @NextRep int;
        SELECT @Contract = c.MaHopDong, @Student = c.MaSinhVien,
               @WasRep = c.LaNguoiDaiDienThanhToanDichVu
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        WHERE c.MaChiTiet = @MaChiTiet AND c.TrangThai = N'Đang ở';
        IF @Contract IS NULL THROW 51436, N'Không tìm thấy chi tiết hợp đồng đang ở.', 1;
        IF @LeaveDate < (SELECT NgayVao FROM dbo.ChiTietHopDong WHERE MaChiTiet = @MaChiTiet)
            THROW 51437, N'Ngày rời không được trước ngày vào.', 1;

        IF @WasRep = 1
        BEGIN
            SELECT TOP (1) @NextRep = MaChiTiet
            FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaHopDong = @Contract AND TrangThai = N'Đang ở' AND MaChiTiet <> @MaChiTiet
            ORDER BY NgayVao, MaChiTiet;
            UPDATE dbo.ChiTietHopDong
            SET LaNguoiDaiDienThanhToanDichVu = 0
            WHERE MaChiTiet = @MaChiTiet;
            IF @NextRep IS NOT NULL
                UPDATE dbo.ChiTietHopDong
                SET LaNguoiDaiDienThanhToanDichVu = 1
                WHERE MaChiTiet = @NextRep;
        END;

        UPDATE dbo.ChiTietHopDong
        SET TrangThai = N'Đã rời', NgayRa = @LeaveDate, LyDoRoi = @LyDoRoi,
            LaNguoiDaiDienThanhToanDichVu = 0
        WHERE MaChiTiet = @MaChiTiet;
        EXEC dbo.sp_GhiNhatKyHopDong N'Sinh viên rời hợp đồng', @Contract, @Student, @NguoiThucHien;
        IF @StartedTransaction = 1 COMMIT TRANSACTION;
        IF @SuppressMessage = 0 AND @WasRep = 1 AND @NextRep IS NULL
            SELECT N'Không còn thành viên đang ở để chuyển đại diện; hợp đồng không có người đại diện.' AS ThongBao;
    END TRY
    BEGIN CATCH
        IF @StartedTransaction = 1 AND XACT_STATE() <> 0
            ROLLBACK TRANSACTION;
        ELSE IF @StartedTransaction = 0 AND XACT_STATE() = 1
            ROLLBACK TRANSACTION SinhVienRoiHopDongSave;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_TaoPhieuChi
    @MaChiTiet int,
    @NgayRa date,
    @LyDo nvarchar(30),
    @KhauTru decimal(18,2) = 0,
    @SoTien decimal(18,2) = NULL,
    @NguoiLap int = NULL,
    @GhiChu nvarchar(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @StartedTransaction bit = 0;
    BEGIN TRY
        IF @@TRANCOUNT = 0
        BEGIN
            BEGIN TRANSACTION;
            SET @StartedTransaction = 1;
        END
        ELSE
            SAVE TRANSACTION TaoPhieuChiSave;

        DECLARE @SoThang int, @Used decimal(18,2), @Paid decimal(18,2),
                @Refunded decimal(18,2), @Suggested decimal(18,2),
                @MaPhieuChi bigint, @Remaining decimal(18,2), @Available decimal(18,2),
                @MaHoaDon nvarchar(20), @DateIn date, @GhiChuPhieu nvarchar(255),
                @MaSinhVien nvarchar(30), @LockCount bigint;
        SELECT @MaSinhVien = MaSinhVien
        FROM dbo.ChiTietHopDong WITH (NOLOCK)
        WHERE MaChiTiet = @MaChiTiet;
        SELECT @LockCount = COUNT_BIG(*)
        FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChiTiet = @MaChiTiet AND LoaiHoaDon = N'TIEN_PHONG';
        SELECT @LockCount = COUNT_BIG(*)
        FROM dbo.GiaoDichThanhToan WITH (UPDLOCK, HOLDLOCK)
        WHERE MaSinhVien = @MaSinhVien;
        SELECT @LockCount = COUNT_BIG(*)
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
        WHERE hd.MaChiTiet = @MaChiTiet AND hd.LoaiHoaDon = N'TIEN_PHONG';
        SELECT @LockCount = COUNT_BIG(*)
        FROM dbo.HoanTienChuyenKhoanDu surplus WITH (UPDLOCK, HOLDLOCK)
        WHERE EXISTS (
            SELECT 1 FROM dbo.GiaoDichThanhToan gd
            WHERE gd.MaGiaoDich = surplus.MaGiaoDich
              AND gd.MaSinhVien = @MaSinhVien
        );
        SELECT @DateIn = NgayVao FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChiTiet = @MaChiTiet;
        IF @DateIn IS NULL THROW 51935, N'Không tìm thấy thành viên hợp đồng.', 1;
        IF @NgayRa < @DateIn THROW 51936, N'Ngày ra không được trước ngày vào.', 1;

        EXEC dbo.sp_TinhGoiYHoanTien
            @MaChiTiet = @MaChiTiet, @KhauTru = @KhauTru, @NgayRa = @NgayRa,
            @SoThangDaSuDung = @SoThang OUTPUT, @TienSuDung = @Used OUTPUT,
            @SoTienDaDong = @Paid OUTPUT, @SoTienDaHoan = @Refunded OUTPUT,
            @GoiYHoan = @Suggested OUTPUT;
        IF @SoTien IS NULL SET @SoTien = @Suggested;
        IF @SoTien <= 0 THROW 51937, N'Không có số dư hoàn tiền dương.', 1;
        IF @LyDo <> N'Trả phòng sớm' AND @SoTien > @Suggested
            THROW 51938, N'Số tiền hoàn không được vượt số tiền gợi ý.', 1;
        IF @LyDo NOT IN (N'Nghỉ học giữa chừng', N'Chuyển đi', N'Khác', N'Trả phòng sớm')
            THROW 51939, N'Lý do hoàn tiền không hợp lệ.', 1;
        IF @SoTien <> @Suggested AND NULLIF(LTRIM(RTRIM(@GhiChu)), N'') IS NULL
            THROW 51940, N'Sửa số tiền gợi ý phải ghi lý do trong GhiChu.', 1;
        SET @GhiChuPhieu = CASE WHEN @SoTien <> @Suggested
            THEN N'Gợi ý ' + CONVERT(nvarchar(30), @Suggested) + N'; ' + @GhiChu ELSE @GhiChu END;

        DECLARE @InvoiceBalance table
        (
            MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY,
            NgayLap date NOT NULL,
            SoDu decimal(18,2) NOT NULL
        );
        INSERT INTO @InvoiceBalance(MaHoaDon, NgayLap, SoDu)
        SELECT hd.MaHoaDon, hd.NgayLap,
               CASE WHEN ISNULL(paid.DaThu, 0) - ISNULL(spent.DaChi, 0) > 0
                    THEN ISNULL(paid.DaThu, 0) - ISNULL(spent.DaChi, 0) ELSE 0 END
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        OUTER APPLY (
            SELECT SUM(pt.SoTien) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N'Hợp lệ'
        ) paid
        OUTER APPLY (
            SELECT SUM(ph.SoTien) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon
              AND (pc.TrangThai = N'Hợp lệ'
                   OR (@LyDo = N'Trả phòng sớm' AND pc.TrangThai = N'Chờ duyệt'))
        ) spent
        WHERE hd.MaChiTiet = @MaChiTiet AND hd.LoaiHoaDon = N'TIEN_PHONG'
          AND hd.TrangThaiThanhToan <> N'Đã hủy'
          AND ISNULL(paid.DaThu, 0) > ISNULL(spent.DaChi, 0);

        IF @SoTien > ISNULL((SELECT SUM(SoDu) FROM @InvoiceBalance), 0)
            THROW 51941, N'Tổng hoàn vượt tiền thu hợp lệ còn lại trên các hóa đơn.', 1;

        INSERT INTO dbo.PhieuChi
            (MaChiTiet, SoTienDaDong, SoTienDaSuDung, KhauTru, SoTien,
             NgayRa, LyDo, TrangThai, NguoiLap, GhiChu)
        VALUES
            (@MaChiTiet, @Paid, @Used, @KhauTru, @SoTien, @NgayRa,
             @LyDo, N'Chờ duyệt', @NguoiLap, @GhiChuPhieu);
        SET @MaPhieuChi = SCOPE_IDENTITY();
        SET @Remaining = @SoTien;

        DECLARE refund_invoice_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT MaHoaDon, SoDu FROM @InvoiceBalance ORDER BY NgayLap, MaHoaDon;
        OPEN refund_invoice_cursor;
        FETCH NEXT FROM refund_invoice_cursor INTO @MaHoaDon, @Available;
        WHILE @@FETCH_STATUS = 0 AND @Remaining > 0
        BEGIN
            DECLARE @Portion decimal(18,2) =
                CASE WHEN @Available >= @Remaining THEN @Remaining ELSE @Available END;
            IF @Portion > 0
                INSERT INTO dbo.PhieuChi_HoaDon(MaPhieuChi, MaHoaDon, SoTien)
                VALUES (@MaPhieuChi, @MaHoaDon, @Portion);
            SET @Remaining -= @Portion;
            FETCH NEXT FROM refund_invoice_cursor INTO @MaHoaDon, @Available;
        END;
        CLOSE refund_invoice_cursor;
        DEALLOCATE refund_invoice_cursor;

        UPDATE dbo.PhieuChi SET TrangThai = N'Hợp lệ' WHERE MaPhieuChi = @MaPhieuChi;
        IF @StartedTransaction = 1 COMMIT TRANSACTION;
        SELECT @MaPhieuChi AS MaPhieuChi, @SoTien AS SoTien,
               @Suggested AS GoiYBanDau, @SoThang AS SoThangDaSuDung;
    END TRY
    BEGIN CATCH
        IF @StartedTransaction = 1 AND XACT_STATE() <> 0
            ROLLBACK TRANSACTION;
        ELSE IF @StartedTransaction = 0 AND XACT_STATE() = 1
            ROLLBACK TRANSACTION TaoPhieuChiSave;
        THROW;
    END CATCH;
END;
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
        THROW 53023, N'Trạng thái xử lý không hợp lệ.', 1;
    IF @TrangThai = N'Từ chối' AND NULLIF(LTRIM(RTRIM(@PhanHoi)), N'') IS NULL
        THROW 53024, N'Lý do từ chối là bắt buộc.', 1;

    DECLARE @MaChiTiet int, @MaSinhVien nvarchar(30), @MaHopDong nvarchar(20),
            @MaHoaDon nvarchar(20), @MaGiaoDich nvarchar(60), @MaPhieuChi bigint,
            @NgayDeXuat date, @NgayBatDau date, @NgayKetThuc date, @HomNayVN date,
            @SoNgayHopDong int, @SoNgayDaO int, @TienPhong decimal(18,2),
            @DaThanhToan decimal(18,2), @TienDaO decimal(18,2),
            @SoTienHoan decimal(18,2), @Count bigint, @Title nvarchar(200),
            @Content nvarchar(2000);
    SELECT @MaSinhVien = MaSinhVien, @NgayDeXuat = NgayKetThucDeXuat
    FROM dbo.YeuCauSinhVien WITH (NOLOCK)
    WHERE MaYeuCau = @MaYeuCau AND Loai = N'Trả phòng sớm';
    IF @MaSinhVien IS NULL THROW 53020, N'Không tìm thấy yêu cầu trả phòng sớm.', 1;

    SELECT TOP (1) @MaChiTiet = c.MaChiTiet, @MaHopDong = c.MaHopDong
    FROM dbo.ChiTietHopDong c WITH (NOLOCK)
    INNER JOIN dbo.HopDong h WITH (NOLOCK) ON h.MaHopDong = c.MaHopDong
    WHERE c.MaSinhVien = @MaSinhVien AND h.TenPhong =
        (SELECT TenPhong FROM dbo.YeuCauSinhVien WITH (NOLOCK) WHERE MaYeuCau = @MaYeuCau)
      AND c.NgayVao <= @NgayDeXuat
    ORDER BY c.NgayVao DESC, c.MaChiTiet DESC;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Count = COUNT_BIG(*)
        FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChiTiet = @MaChiTiet AND LoaiHoaDon = N'TIEN_PHONG';

        SELECT @Count = COUNT_BIG(*)
        FROM dbo.GiaoDichThanhToan WITH (UPDLOCK, HOLDLOCK)
        WHERE MaSinhVien = @MaSinhVien;

        SELECT @Count = COUNT_BIG(*)
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
        WHERE hd.MaChiTiet = @MaChiTiet AND hd.LoaiHoaDon = N'TIEN_PHONG';

        SELECT @Count = COUNT_BIG(*)
        FROM dbo.HoanTienChuyenKhoanDu d WITH (UPDLOCK, HOLDLOCK)
        WHERE EXISTS (
            SELECT 1 FROM dbo.GiaoDichThanhToan gd
            WHERE gd.MaGiaoDich = d.MaGiaoDich AND gd.MaSinhVien = @MaSinhVien
        );

        DECLARE @Request TABLE (MaSinhVien nvarchar(30), TenPhong nvarchar(50),
                                NgayKetThucDeXuat date, TrangThai nvarchar(15));
        UPDATE dbo.YeuCauSinhVien WITH (UPDLOCK, HOLDLOCK)
        SET TrangThai = @TrangThai, PhanHoi = NULLIF(LTRIM(RTRIM(@PhanHoi)), N''),
            NgayXuLy = CONVERT(datetime, DATEADD(hour, 7, SYSUTCDATETIME())),
            XuLyBoi = @NguoiThucHien
        OUTPUT inserted.MaSinhVien, inserted.TenPhong,
               inserted.NgayKetThucDeXuat, inserted.TrangThai
        INTO @Request
        WHERE MaYeuCau = @MaYeuCau AND Loai = N'Trả phòng sớm'
          AND TrangThai = N'Chờ duyệt';
        IF @@ROWCOUNT <> 1 THROW 53021, N'Yêu cầu đã được xử lý.', 1;

        SELECT @MaSinhVien = MaSinhVien, @NgayDeXuat = NgayKetThucDeXuat
        FROM @Request;
        IF @TrangThai = N'Từ chối'
        BEGIN
            SET @Title = N'Yêu cầu trả phòng sớm bị từ chối';
            SET @Content = N'Yêu cầu trả phòng sớm bị từ chối. Lý do: ' + LTRIM(RTRIM(@PhanHoi));
        END
        ELSE
        BEGIN
            SELECT TOP (1) @MaChiTiet = c.MaChiTiet, @MaHopDong = c.MaHopDong,
                   @NgayBatDau = c.NgayVao, @NgayKetThuc = h.NgayKetThuc,
                   @TienPhong = CASE WHEN c.KyHanThanhToanPhong = N'NAM'
                                     THEN c.GiaPhongApDung ELSE c.GiaPhongThangApDung END
            FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.HopDong h WITH (UPDLOCK, HOLDLOCK) ON h.MaHopDong = c.MaHopDong
            INNER JOIN @Request r ON r.MaSinhVien = c.MaSinhVien
                                 AND r.TenPhong = h.TenPhong
            WHERE c.NgayVao <= @NgayDeXuat
              AND c.TrangThai = N'Đang ở'
              AND h.TrangThaiHopDong = N'Còn hiệu lực'
            ORDER BY c.NgayVao DESC, c.MaChiTiet DESC;
            IF @MaChiTiet IS NULL OR @NgayBatDau IS NULL OR @NgayKetThuc IS NULL
                THROW 53022, N'Không còn tìm thấy hợp đồng phù hợp để xử lý yêu cầu.', 1;
            IF @TienPhong IS NULL OR @TienPhong <= 0
                THROW 53022, N'Không thể tính hoàn tiền vì hợp đồng chưa có đơn giá tiền phòng hợp lệ.', 1;
            SET @HomNayVN = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));
            IF @NgayDeXuat < @HomNayVN OR @NgayDeXuat <= @NgayBatDau OR @NgayDeXuat >= @NgayKetThuc
                THROW 53025, N'Ngày kết thúc đề xuất không còn hợp lệ với hợp đồng hiện tại.', 1;
            SET @SoNgayHopDong = DATEDIFF(day, @NgayBatDau, @NgayKetThuc) + 1;
            SET @SoNgayDaO = DATEDIFF(day, @NgayBatDau, @NgayDeXuat) + 1;
            SELECT @DaThanhToan = ISNULL(SUM(pt.SoTien), 0)
            FROM dbo.HoaDon hd
            INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = hd.MaHoaDon
            WHERE hd.MaChiTiet = @MaChiTiet AND hd.LoaiHoaDon = N'TIEN_PHONG'
              AND pt.TrangThai = N'Hợp lệ';
            SELECT @DaThanhToan = CASE WHEN @DaThanhToan > ISNULL(SUM(pc.SoTien), 0)
                                       THEN @DaThanhToan - ISNULL(SUM(pc.SoTien), 0)
                                       ELSE 0 END
            FROM dbo.PhieuChi pc
            WHERE pc.MaChiTiet = @MaChiTiet
              AND pc.TrangThai IN (N'Hợp lệ', N'Chờ duyệt');
            SET @TienDaO = ROUND(@TienPhong * @SoNgayDaO / NULLIF(@SoNgayHopDong, 0), 0);
            SET @SoTienHoan = CASE WHEN @DaThanhToan > @TienDaO
                                   THEN @DaThanhToan - @TienDaO ELSE 0 END;

            IF @NgayDeXuat <= @HomNayVN
                EXEC dbo.sp_SinhVienRoiHopDong
                    @MaChiTiet = @MaChiTiet, @NgayRa = @NgayDeXuat,
                    @LyDoRoi = N'Trả phòng sớm', @NguoiThucHien = @NguoiThucHien,
                    @SuppressMessage = 1;
            ELSE
                UPDATE dbo.ChiTietHopDong
                SET NgayRa = @NgayDeXuat, LyDoRoi = N'Trả phòng sớm'
                WHERE MaChiTiet = @MaChiTiet AND TrangThai = N'Đang ở';

            IF @SoTienHoan > 0
            BEGIN
                DECLARE @RefundResult TABLE
                    (MaPhieuChi bigint, SoTien decimal(18,2),
                     GoiYBanDau decimal(18,2), SoThangDaSuDung int);
                DECLARE @GhiChuHoan nvarchar(255) = N'Hoàn tiền theo ngày, yêu cầu ' + @MaYeuCau;
                INSERT INTO @RefundResult
                EXEC dbo.sp_TaoPhieuChi
                    @MaChiTiet = @MaChiTiet, @NgayRa = @NgayDeXuat,
                    @LyDo = N'Trả phòng sớm', @KhauTru = 0, @SoTien = @SoTienHoan,
                    @NguoiLap = @NguoiThucHien,
                    @GhiChu = @GhiChuHoan;
                SELECT TOP (1) @MaPhieuChi = MaPhieuChi FROM @RefundResult;
            END;
            SET @Title = N'Yêu cầu trả phòng sớm đã được duyệt';
            SET @Content = N'Đã duyệt trả phòng sớm, ngày kết thúc mới '
                + CONVERT(nvarchar(10), @NgayDeXuat, 103) + N', '
                + CASE WHEN @SoTienHoan > 0
                       THEN N'hoàn ' + FORMAT(@SoTienHoan, N'N0', N'vi-VN') + N' đ tiền mặt tại văn phòng'
                       ELSE N'không có khoản hoàn' END + N'.';
        END;

        IF NOT EXISTS (SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                       WHERE MaSuKien = N'CHECKOUT:' + @MaYeuCau + N':' + @MaSinhVien
                         AND MaSinhVien = @MaSinhVien)
            INSERT INTO dbo.ThongBao
                (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien)
            VALUES
                (@Title, @Content, N'SINH_VIEN', @MaSinhVien, @NguoiThucHien,
                 N'CHECKOUT:' + @MaYeuCau + N':' + @MaSinhVien);

        COMMIT TRANSACTION;
        SELECT @MaYeuCau AS MaYeuCau, @TrangThai AS TrangThai, @PhanHoi AS PhanHoi,
               @MaPhieuChi AS MaPhieuChi, @SoTienHoan AS SoTienHoan;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

GRANT EXECUTE ON OBJECT::dbo.sp_DuyetTraPhongSom TO [DNKTX];
GO

PRINT N'[030] Hoàn tất.';
GO
