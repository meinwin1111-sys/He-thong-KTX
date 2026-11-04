SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 53200, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 53201, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'031')
    THROW 53202, N'Chạy migration 031 trước.', 1;
GO

/*
Lock order for renewal and related payment work:
Phong -> HopDong -> GiaHanHopDong -> HoaDon -> GiaoDichThanhToan -> PhieuThu.
The payment path must acquire these resources in this order before recording a
renewal receipt. See migrations 028 and 030: their existing receipt path starts
at HoaDon, so callers must be aligned before concurrent renewal/payment use.
*/
IF OBJECT_ID(N'dbo.GiaHanHopDong', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.GiaHanHopDong
    (
        MaGiaHan int IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_GiaHanHopDong PRIMARY KEY,
        MaHopDong nvarchar(20) NOT NULL,
        MaChiTiet int NOT NULL,
        MaYeuCau nvarchar(7) NULL,
        NgayKetThucCu date NOT NULL,
        NgayKetThucMoi date NOT NULL,
        TrangThai nvarchar(20) NOT NULL
            CONSTRAINT DF_GiaHanHopDong_TrangThai DEFAULT (N'Chờ thanh toán'),
        HanThanhToan date NOT NULL,
        MaHoaDon nvarchar(20) NULL,
        NgayTao datetime2(0) NOT NULL
            CONSTRAINT DF_GiaHanHopDong_NgayTao DEFAULT (SYSUTCDATETIME()),
        NgayCapNhat datetime2(0) NOT NULL
            CONSTRAINT DF_GiaHanHopDong_NgayCapNhat DEFAULT (SYSUTCDATETIME()),
        GhiChu nvarchar(500) NULL,
        CONSTRAINT FK_GiaHanHopDong_HopDong
            FOREIGN KEY (MaHopDong) REFERENCES dbo.HopDong(MaHopDong),
        CONSTRAINT FK_GiaHanHopDong_ChiTietHopDong
            FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHopDong(MaChiTiet),
        CONSTRAINT FK_GiaHanHopDong_YeuCauSinhVien
            FOREIGN KEY (MaYeuCau) REFERENCES dbo.YeuCauSinhVien(MaYeuCau),
        CONSTRAINT FK_GiaHanHopDong_HoaDon
            FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon(MaHoaDon),
        CONSTRAINT CK_GiaHanHopDong_TrangThai
            CHECK (TrangThai IN (N'Chờ thanh toán', N'Đã hiệu lực', N'Hủy')),
        CONSTRAINT CK_GiaHanHopDong_Ngay
            CHECK (NgayKetThucMoi > NgayKetThucCu)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.GiaHanHopDong')
      AND name = N'UX_GiaHanHopDong_MaChiTiet_ChoThanhToan'
)
    CREATE UNIQUE INDEX UX_GiaHanHopDong_MaChiTiet_ChoThanhToan
        ON dbo.GiaHanHopDong(MaChiTiet)
        WHERE TrangThai = N'Chờ thanh toán';
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.GiaHanHopDong')
      AND name = N'IX_GiaHanHopDong_MaHoaDon'
)
    CREATE INDEX IX_GiaHanHopDong_MaHoaDon
        ON dbo.GiaHanHopDong(MaHoaDon)
        INCLUDE (MaGiaHan, MaHopDong, MaChiTiet, TrangThai, HanThanhToan);
GO

CREATE OR ALTER VIEW dbo.vw_NgayKetThucHieuLucThanhVien
AS
SELECT c.MaChiTiet, c.MaHopDong, c.MaSinhVien, hd.TenPhong,
       hd.NgayKetThuc AS NgayKetThucGoc,
       COALESCE(latestRenewal.NgayKetThucMoi, hd.NgayKetThuc) AS NgayKetThucHieuLuc
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

CREATE OR ALTER PROCEDURE dbo.sp_DuyetGiaHan
    @MaHopDong nvarchar(20),
    @MaChiTiet int,
    @NgayKetThucMoi date,
    @MaYeuCau nvarchar(7) = NULL,
    @NguoiThucHien int = NULL,
    @MaGiaHan int = NULL OUTPUT,
    @MaHoaDon nvarchar(20) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TenPhong nvarchar(50), @RoomToLock nvarchar(50), @MaHangPhong nvarchar(20),
            @NgayBatDau date, @NgayKetThucGoc date,
            @NgayKetThucCu date, @NgayTao date,
            @MaSinhVien nvarchar(30), @TrangThaiThanhVien nvarchar(20),
            @KyHan nvarchar(10), @GiaNam decimal(18,2),
            @GiaThang decimal(18,2), @SoNgayGoc int, @SoNgayGiaHan int,
            @SucChua int, @SoNguoi int, @Han date,
            @Tien decimal(18,2), @Count bigint, @Today date,
            @NoticeTitle nvarchar(200), @NoticeBody nvarchar(2000),
            @EventKey nvarchar(100);

    SET @Today = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));
    SET @NgayTao = @Today;

    IF @MaYeuCau IS NOT NULL
    BEGIN
        SELECT TOP (1) @MaHopDong = c.MaHopDong, @MaChiTiet = c.MaChiTiet
        FROM dbo.YeuCauSinhVien yc
        INNER JOIN dbo.ChiTietHopDong c ON c.MaSinhVien = yc.MaSinhVien
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE yc.MaYeuCau = @MaYeuCau
          AND yc.Loai = N'Gia hạn hợp đồng'
          AND yc.TrangThai = N'Chờ duyệt'
          AND hd.TenPhong = yc.TenPhong
          AND c.TrangThai = N'Đang ở'
          AND (@MaHopDong IS NULL OR c.MaHopDong = @MaHopDong)
          AND (@MaChiTiet IS NULL OR c.MaChiTiet = @MaChiTiet)
        ORDER BY c.NgayVao DESC, c.MaChiTiet DESC;
        IF @MaHopDong IS NULL OR @MaChiTiet IS NULL
            THROW 53203, N'Không tìm thấy yêu cầu gia hạn đang chờ hoặc thành viên phù hợp.', 1;
    END;

    SELECT @TenPhong = hd.TenPhong
    FROM dbo.HopDong hd
    WHERE hd.MaHopDong = @MaHopDong;
    IF @TenPhong IS NULL
        THROW 53204, N'Không tìm thấy hợp đồng để gia hạn.', 1;
    SET @RoomToLock = @TenPhong;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @Count = COUNT_BIG(*)
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE TenPhong = @RoomToLock;
        IF @Count = 0
            THROW 53205, N'Không tìm thấy phòng của hợp đồng.', 1;

        SELECT @TenPhong = hd.TenPhong, @MaHangPhong = hd.MaHangPhong,
               @NgayKetThucGoc = hd.NgayKetThuc
        FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHopDong = @MaHopDong
          AND hd.TrangThaiHopDong = N'Còn hiệu lực';
        IF @TenPhong IS NULL
            THROW 53204, N'Hợp đồng không còn hiệu lực.', 1;
        IF @TenPhong <> @RoomToLock
            THROW 53205, N'Phòng của hợp đồng vừa thay đổi; vui lòng thử lại.', 1;

        SELECT @MaSinhVien = c.MaSinhVien, @NgayBatDau = c.NgayVao,
               @TrangThaiThanhVien = c.TrangThai,
               @KyHan = c.KyHanThanhToanPhong,
               @GiaNam = c.GiaPhongApDung,
               @GiaThang = c.GiaPhongThangApDung,
               @NgayKetThucCu = v.NgayKetThucHieuLuc
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.vw_NgayKetThucHieuLucThanhVien v
            ON v.MaChiTiet = c.MaChiTiet
        WHERE c.MaChiTiet = @MaChiTiet
          AND c.MaHopDong = @MaHopDong;
        IF @MaSinhVien IS NULL OR @TrangThaiThanhVien <> N'Đang ở'
            THROW 53206, N'Chỉ gia hạn được thành viên đang ở trong hợp đồng.', 1;
        IF @NgayKetThucMoi IS NULL OR @NgayKetThucMoi <= @NgayKetThucCu
            THROW 53207, N'Ngày kết thúc mới phải sau ngày kết thúc hiệu lực hiện tại.', 1;
        IF @MaYeuCau IS NOT NULL AND NOT EXISTS
        (
            SELECT 1 FROM dbo.YeuCauSinhVien WITH (UPDLOCK, HOLDLOCK)
            WHERE MaYeuCau = @MaYeuCau
              AND MaSinhVien = @MaSinhVien
              AND NgayKetThucDeXuat = @NgayKetThucMoi
              AND Loai = N'Gia hạn hợp đồng'
              AND TrangThai = N'Chờ duyệt'
        )
            THROW 53203, N'Yêu cầu gia hạn đã đổi trạng thái hoặc ngày đề xuất không khớp.', 1;

        SELECT @Count = COUNT_BIG(*)
        FROM dbo.GiaHanHopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChiTiet = @MaChiTiet;
        IF EXISTS
        (
            SELECT 1 FROM dbo.GiaHanHopDong
            WHERE MaChiTiet = @MaChiTiet AND TrangThai = N'Chờ thanh toán'
        )
            THROW 53208, N'Sinh viên đã có gia hạn đang chờ thanh toán.', 1;

        SET @NgayTao = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));
        SET @Han = DATEADD(day, 7, @NgayTao);
        SET @SoNgayGoc = DATEDIFF(day, @NgayBatDau, @NgayKetThucGoc) + 1;
        SET @SoNgayGiaHan = DATEDIFF(day, @NgayKetThucCu, @NgayKetThucMoi);
        IF @SoNgayGoc <= 0 OR @SoNgayGiaHan <= 0
            THROW 53209, N'Không thể tính số ngày hợp đồng hoặc thời gian gia hạn.', 1;
        IF @KyHan NOT IN (N'THANG', N'NAM')
            THROW 53210, N'Kỳ hạn tiền phòng của thành viên không hợp lệ.', 1;
        SET @Tien = ROUND(
            (CASE WHEN @KyHan = N'NAM' THEN @GiaNam ELSE @GiaThang END)
            * CONVERT(decimal(18,6), @SoNgayGiaHan)
            / NULLIF(@SoNgayGoc, 0), 0);
        IF @Tien IS NULL OR @Tien <= 0
            THROW 53211, N'Không thể tạo hóa đơn vì giá tiền phòng không hợp lệ.', 1;

        SELECT @SucChua = hp.SucChuaToiDa
        FROM dbo.HangPhong hp
        WHERE hp.MaHangPhong = @MaHangPhong;
        IF @SucChua IS NULL OR @SucChua <= 0
            THROW 53212, N'Không tìm thấy sức chứa hợp lệ của hạng phòng.', 1;

        DECLARE @Occupants table
        (
            MaChiTiet int NOT NULL PRIMARY KEY,
            NgayVao date NOT NULL,
            NgayKetThuc date NOT NULL
        );
        INSERT INTO @Occupants(MaChiTiet, NgayVao, NgayKetThuc)
        SELECT c.MaChiTiet, c.NgayVao,
               CASE WHEN c.MaChiTiet = @MaChiTiet THEN @NgayKetThucMoi
                    WHEN pendingRenewal.NgayKetThucMoi IS NOT NULL
                         THEN pendingRenewal.NgayKetThucMoi
                    ELSE effectiveEnd.NgayKetThucHieuLuc END
        FROM dbo.ChiTietHopDong c
        INNER JOIN dbo.HopDong h ON h.MaHopDong = c.MaHopDong
        INNER JOIN dbo.vw_NgayKetThucHieuLucThanhVien effectiveEnd
            ON effectiveEnd.MaChiTiet = c.MaChiTiet
        OUTER APPLY
        (
            SELECT TOP (1) g.NgayKetThucMoi
            FROM dbo.GiaHanHopDong g
            WHERE g.MaChiTiet = c.MaChiTiet
              AND g.TrangThai = N'Chờ thanh toán'
              AND g.HanThanhToan >= @Today
            ORDER BY g.NgayKetThucMoi DESC, g.MaGiaHan DESC
        ) pendingRenewal
        WHERE h.TenPhong = @TenPhong
          AND h.TrangThaiHopDong = N'Còn hiệu lực'
          AND c.TrangThai = N'Đang ở'
          AND c.NgayVao <= @NgayKetThucMoi
          AND CASE WHEN c.MaChiTiet = @MaChiTiet THEN @NgayKetThucMoi
                   WHEN pendingRenewal.NgayKetThucMoi IS NOT NULL
                        THEN pendingRenewal.NgayKetThucMoi
                   ELSE effectiveEnd.NgayKetThucHieuLuc END >= @NgayKetThucCu;

        DECLARE @CheckDates table (Ngay date NOT NULL PRIMARY KEY);
        INSERT INTO @CheckDates(Ngay) VALUES (DATEADD(day, 1, @NgayKetThucCu));
        INSERT INTO @CheckDates(Ngay)
        SELECT DISTINCT points.Ngay
        FROM @Occupants o
        CROSS APPLY
        (
            VALUES (o.NgayVao), (DATEADD(day, 1, o.NgayKetThuc))
        ) points(Ngay)
        WHERE points.Ngay > @NgayKetThucCu
          AND points.Ngay <= @NgayKetThucMoi
          AND NOT EXISTS (SELECT 1 FROM @CheckDates d WHERE d.Ngay = points.Ngay);

        SELECT @SoNguoi = MAX(occupancy.SoNguoi)
        FROM @CheckDates dates
        CROSS APPLY
        (
            SELECT COUNT(*) AS SoNguoi
            FROM @Occupants o
            WHERE o.NgayVao <= dates.Ngay AND o.NgayKetThuc >= dates.Ngay
        ) occupancy;
        IF ISNULL(@SoNguoi, 0) > @SucChua
            THROW 53213, N'Không thể gia hạn: sức chứa phòng bị vượt trong khoảng ngày đề xuất.', 1;

        SELECT @Count = COUNT_BIG(*)
        FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE LoaiHoaDon = N'TIEN_PHONG'
          AND MaChiTiet = @MaChiTiet
          AND TrangThaiThanhToan <> N'Đã hủy'
          AND KyThanhToan <= @NgayKetThucMoi
          AND KyThanhToanDen >= DATEADD(day, 1, @NgayKetThucCu);
        IF @Count > 0
            THROW 53214, N'Không thể gia hạn vì kỳ tiền phòng bị trùng với hóa đơn đang có.', 1;

        INSERT INTO dbo.GiaHanHopDong
            (MaHopDong, MaChiTiet, MaYeuCau, NgayKetThucCu, NgayKetThucMoi,
             TrangThai, HanThanhToan, GhiChu)
        VALUES
            (@MaHopDong, @MaChiTiet, @MaYeuCau, @NgayKetThucCu, @NgayKetThucMoi,
             N'Chờ thanh toán', @Han, CASE WHEN @MaYeuCau IS NULL
                 THEN N'Admin gia hạn trực tiếp' ELSE N'Gia hạn theo yêu cầu ' + @MaYeuCau END);
        SET @MaGiaHan = CONVERT(int, SCOPE_IDENTITY());

        EXEC dbo.sp_B3_TaoMaHoaDon @NgayTao, @MaHoaDon OUTPUT;
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVien, @TenPhong, @NgayTao, 0, 0, 0,
             N'Chưa thanh toán', @Han, N'TIEN_PHONG', @MaHopDong, @MaChiTiet,
             DATEADD(day, 1, @NgayKetThucCu), @NgayKetThucMoi);
        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
             TrangThai, ThuTu, GhiChu)
        VALUES
            (LEFT(@MaHoaDon, 30) + N'-ROOM', @MaHoaDon, N'ROOM', N'Tiền phòng gia hạn',
             @Tien, 1, @Tien, N'Chưa thanh toán', 1,
             N'Gia hạn ' + CONVERT(nvarchar(10), DATEADD(day, 1, @NgayKetThucCu), 23)
             + N' - ' + CONVERT(nvarchar(10), @NgayKetThucMoi, 23));
        UPDATE dbo.GiaHanHopDong
        SET MaHoaDon = @MaHoaDon, NgayCapNhat = SYSUTCDATETIME()
        WHERE MaGiaHan = @MaGiaHan;

        IF @MaYeuCau IS NOT NULL
            UPDATE dbo.YeuCauSinhVien
            SET TrangThai = N'Đã duyệt',
                PhanHoi = N'Đã lập hóa đơn gia hạn ' + @MaHoaDon,
                NgayXuLy = CONVERT(datetime, DATEADD(hour, 7, SYSUTCDATETIME())),
                XuLyBoi = @NguoiThucHien
            WHERE MaYeuCau = @MaYeuCau AND TrangThai = N'Chờ duyệt';
        IF @MaYeuCau IS NOT NULL AND @@ROWCOUNT <> 1
            THROW 53203, N'Yêu cầu gia hạn đã được xử lý.', 1;

        SET @NoticeTitle = N'Hóa đơn gia hạn hợp đồng';
        SET @NoticeBody = N'Đã lập hóa đơn ' + @MaHoaDon + N' số tiền '
            + FORMAT(@Tien, N'N0', N'vi-VN') + N' đ. Hạn thanh toán '
            + CONVERT(nvarchar(10), @Han, 103) + N'. Ngày kết thúc mới dự kiến '
            + CONVERT(nvarchar(10), @NgayKetThucMoi, 103)
            + N'; ngày kết thúc chỉ cập nhật sau khi thanh toán đủ.';
        SET @EventKey = N'RENEWAL:' + CONVERT(nvarchar(20), @MaGiaHan)
            + N':' + @MaSinhVien;
        IF NOT EXISTS
        (
            SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
            WHERE MaSuKien = @EventKey AND MaSinhVien = @MaSinhVien
        )
            INSERT INTO dbo.ThongBao
                (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien, MaHoaDon)
            VALUES
                (@NoticeTitle, @NoticeBody, N'SINH_VIEN', @MaSinhVien,
                 @NguoiThucHien, @EventKey, @MaHoaDon);

        COMMIT TRANSACTION;
        SELECT @MaGiaHan AS MaGiaHan, @MaHoaDon AS MaHoaDon,
               @Tien AS SoTien, @Han AS HanThanhToan,
               @NgayKetThucCu AS NgayKetThucCu,
               @NgayKetThucMoi AS NgayKetThucMoi;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_KichHoatGiaHan
    @MaHoaDon nvarchar(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @MaGiaHan int, @MaHopDong nvarchar(20), @MaChiTiet int,
            @MaSinhVien nvarchar(30), @TenPhong nvarchar(50), @MaHoaDonKhoa nvarchar(20),
            @TrangThai nvarchar(20), @Han date, @Today date, @Count bigint,
            @TongHoaDon decimal(18,2), @DaThu decimal(18,2),
            @EventKey nvarchar(100), @NoticeTitle nvarchar(200), @NoticeBody nvarchar(2000);
    SET @Today = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));

    SELECT @MaGiaHan = g.MaGiaHan, @MaHopDong = g.MaHopDong,
           @MaChiTiet = g.MaChiTiet, @Han = g.HanThanhToan,
           @TenPhong = hd.TenPhong, @MaSinhVien = c.MaSinhVien
    FROM dbo.GiaHanHopDong g
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = g.MaHopDong
    INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = g.MaChiTiet
    WHERE g.MaHoaDon = @MaHoaDon;
    IF @MaGiaHan IS NULL
    BEGIN
        SELECT CAST(0 AS bit) AS DaKichHoat, N'Không phải hóa đơn gia hạn.' AS KetQua;
        RETURN;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;
        SELECT @Count = COUNT_BIG(*) FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE TenPhong = @TenPhong;
        SELECT @Count = COUNT_BIG(*) FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong;
        SELECT @TrangThai = TrangThai FROM dbo.GiaHanHopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaGiaHan = @MaGiaHan;
        SELECT @MaHoaDonKhoa = MaHoaDon, @Count = COUNT_BIG(*)
        FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHoaDon = @MaHoaDon
        GROUP BY MaHoaDon;
        SELECT @Count = COUNT_BIG(*)
        FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
        WHERE EXISTS
        (
            SELECT 1 FROM dbo.PhieuThu pt
            WHERE pt.MaGiaoDich = gd.MaGiaoDich AND pt.MaHoaDon = @MaHoaDon
        );
        SELECT @Count = COUNT_BIG(*)
        FROM dbo.PhieuThu WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHoaDon = @MaHoaDon;
        SELECT @TongHoaDon = ISNULL(SUM(SoTien), 0)
        FROM dbo.ChiTietHoaDon
        WHERE MaHoaDon = @MaHoaDon;
        SELECT @DaThu = ISNULL(SUM(SoTien), 0)
        FROM dbo.PhieuThu
        WHERE MaHoaDon = @MaHoaDon AND TrangThai = N'Hợp lệ';

        IF @MaHoaDonKhoa IS NULL
            THROW 53215, N'Không tìm thấy hóa đơn của gia hạn.', 1;
        IF @TrangThai = N'Đã hiệu lực'
        BEGIN
            COMMIT TRANSACTION;
            SELECT CAST(1 AS bit) AS DaKichHoat, N'Gia hạn đã hiệu lực.' AS KetQua;
            RETURN;
        END;
        IF @TrangThai <> N'Chờ thanh toán'
        BEGIN
            COMMIT TRANSACTION;
            SELECT CAST(0 AS bit) AS DaKichHoat, N'Gia hạn đã bị hủy.' AS KetQua;
            RETURN;
        END;

        IF @Han < @Today
        BEGIN
            UPDATE dbo.GiaHanHopDong
            SET TrangThai = N'Hủy', NgayCapNhat = SYSUTCDATETIME(),
                GhiChu = CONCAT(COALESCE(GhiChu + N' | ', N''), N'Hết hạn thanh toán.')
            WHERE MaGiaHan = @MaGiaHan AND TrangThai = N'Chờ thanh toán';
            UPDATE dbo.HoaDon
            SET TrangThaiThanhToan = N'Đã hủy'
            WHERE MaHoaDon = @MaHoaDon
              AND TrangThaiThanhToan <> N'Đã thanh toán';
            SET @EventKey = N'RENEWAL_EXPIRED:' + CONVERT(nvarchar(20), @MaGiaHan)
                + N':' + @MaSinhVien;
            IF NOT EXISTS (SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                           WHERE MaSuKien = @EventKey AND MaSinhVien = @MaSinhVien)
                INSERT INTO dbo.ThongBao
                    (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien, MaHoaDon)
                VALUES
                    (N'Gia hạn đã hết hạn', N'Gia hạn đã bị hủy vì hóa đơn quá hạn thanh toán.',
                     N'SINH_VIEN', @MaSinhVien, NULL, @EventKey, @MaHoaDon);
            COMMIT TRANSACTION;
            SELECT CAST(0 AS bit) AS DaKichHoat, N'Hóa đơn gia hạn đã quá hạn.' AS KetQua;
            RETURN;
        END;

        IF NOT EXISTS
        (
            SELECT 1 FROM dbo.HoaDon
            WHERE MaHoaDon = @MaHoaDon AND TrangThaiThanhToan = N'Đã thanh toán'
        ) OR @TongHoaDon <= 0 OR @DaThu <> @TongHoaDon
        BEGIN
            COMMIT TRANSACTION;
            SELECT CAST(0 AS bit) AS DaKichHoat, N'Hóa đơn chưa được thanh toán đủ.' AS KetQua;
            RETURN;
        END;

        UPDATE dbo.GiaHanHopDong
        SET TrangThai = N'Đã hiệu lực', NgayCapNhat = SYSUTCDATETIME()
        WHERE MaGiaHan = @MaGiaHan AND TrangThai = N'Chờ thanh toán';
        IF @@ROWCOUNT = 1
        BEGIN
            INSERT INTO dbo.NhatKyHeThong
                (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
            VALUES
                (NULL, N'Kích hoạt gia hạn', N'GiaHanHopDong',
                 CONVERT(nvarchar(20), @MaGiaHan),
                 N'Thanh toán đủ hóa đơn ' + @MaHoaDon + N'; ngày kết thúc hiệu lực '
                 + CONVERT(nvarchar(10),
                     (SELECT NgayKetThucMoi FROM dbo.GiaHanHopDong WHERE MaGiaHan = @MaGiaHan), 23));
        END;
        COMMIT TRANSACTION;
        SELECT CAST(1 AS bit) AS DaKichHoat, N'Gia hạn đã được kích hoạt.' AS KetQua;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HuyGiaHanQuaHan
    @MaChiTiet int = NULL,
    @MaHoaDon nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Today date = CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()));
    DECLARE @Candidates table
    (
        MaGiaHan int NOT NULL PRIMARY KEY,
        MaHopDong nvarchar(20) NOT NULL,
        MaChiTiet int NOT NULL,
        MaHoaDon nvarchar(20) NULL,
        TenPhong nvarchar(50) NOT NULL,
        MaSinhVien nvarchar(30) NOT NULL
    );
    INSERT INTO @Candidates(MaGiaHan, MaHopDong, MaChiTiet, MaHoaDon, TenPhong, MaSinhVien)
    SELECT g.MaGiaHan, g.MaHopDong, g.MaChiTiet, g.MaHoaDon, hd.TenPhong, c.MaSinhVien
    FROM dbo.GiaHanHopDong g
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = g.MaHopDong
    INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = g.MaChiTiet
    WHERE g.TrangThai = N'Chờ thanh toán'
      AND g.HanThanhToan < @Today
      AND (@MaChiTiet IS NULL OR g.MaChiTiet = @MaChiTiet)
      AND (@MaHoaDon IS NULL OR g.MaHoaDon = @MaHoaDon);

    DECLARE @CurrentId int, @ContractId nvarchar(20), @DetailId int,
            @InvoiceId nvarchar(20), @Room nvarchar(50), @StudentId nvarchar(30),
            @LockedStatus nvarchar(20), @Count bigint, @EventKey nvarchar(100);
    DECLARE overdue_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaGiaHan, MaHopDong, MaChiTiet, MaHoaDon, TenPhong, MaSinhVien
        FROM @Candidates
        ORDER BY TenPhong, MaHopDong, MaGiaHan;
    OPEN overdue_cursor;
    FETCH NEXT FROM overdue_cursor INTO @CurrentId, @ContractId, @DetailId,
        @InvoiceId, @Room, @StudentId;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;
            SELECT @Count = COUNT_BIG(*) FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
            WHERE TenPhong = @Room;
            SELECT @Count = COUNT_BIG(*) FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaHopDong = @ContractId;
            SELECT @LockedStatus = TrangThai FROM dbo.GiaHanHopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaGiaHan = @CurrentId AND MaChiTiet = @DetailId;
            SELECT @Count = COUNT_BIG(*) FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE MaHoaDon = @InvoiceId;
            SELECT @Count = COUNT_BIG(*)
            FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
            WHERE EXISTS
            (
                SELECT 1 FROM dbo.PhieuThu pt
                WHERE pt.MaGiaoDich = gd.MaGiaoDich AND pt.MaHoaDon = @InvoiceId
            );
            SELECT @Count = COUNT_BIG(*) FROM dbo.PhieuThu WITH (UPDLOCK, HOLDLOCK)
            WHERE MaHoaDon = @InvoiceId;

            IF @LockedStatus = N'Chờ thanh toán'
               AND EXISTS (SELECT 1 FROM dbo.GiaHanHopDong
                           WHERE MaGiaHan = @CurrentId AND HanThanhToan < @Today)
            BEGIN
                UPDATE dbo.GiaHanHopDong
                SET TrangThai = N'Hủy', NgayCapNhat = SYSUTCDATETIME(),
                    GhiChu = CONCAT(COALESCE(GhiChu + N' | ', N''), N'Hết hạn thanh toán.')
                WHERE MaGiaHan = @CurrentId AND TrangThai = N'Chờ thanh toán';
                UPDATE dbo.HoaDon
                SET TrangThaiThanhToan = N'Đã hủy'
                WHERE MaHoaDon = @InvoiceId
                  AND TrangThaiThanhToan <> N'Đã thanh toán';
                SET @EventKey = N'RENEWAL_EXPIRED:' + CONVERT(nvarchar(20), @CurrentId)
                    + N':' + @StudentId;
                IF NOT EXISTS (SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                               WHERE MaSuKien = @EventKey AND MaSinhVien = @StudentId)
                    INSERT INTO dbo.ThongBao
                        (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien, MaHoaDon)
                    VALUES
                        (N'Gia hạn đã hết hạn',
                         N'Gia hạn đã bị hủy vì hóa đơn quá hạn thanh toán.',
                         N'SINH_VIEN', @StudentId, NULL, @EventKey, @InvoiceId);
            END;
            COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            CLOSE overdue_cursor;
            DEALLOCATE overdue_cursor;
            THROW;
        END CATCH;
        FETCH NEXT FROM overdue_cursor INTO @CurrentId, @ContractId, @DetailId,
            @InvoiceId, @Room, @StudentId;
    END;
    CLOSE overdue_cursor;
    DEALLOCATE overdue_cursor;

    SELECT MaGiaHan, MaHopDong, MaChiTiet, MaHoaDon, TrangThai, HanThanhToan
    FROM dbo.GiaHanHopDong
    WHERE TrangThai = N'Hủy'
      AND HanThanhToan < @Today
      AND (@MaChiTiet IS NULL OR MaChiTiet = @MaChiTiet)
      AND (@MaHoaDon IS NULL OR MaHoaDon = @MaHoaDon);
END;
GO

GRANT EXECUTE ON OBJECT::dbo.sp_DuyetGiaHan TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_KichHoatGiaHan TO [DNKTX];
GRANT EXECUTE ON OBJECT::dbo.sp_HuyGiaHanQuaHan TO [DNKTX];
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'032')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'032', N'032_per_member_contract_renewals.sql');
GO
PRINT N'[032] Hoàn tất.';
GO
