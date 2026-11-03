SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 52800, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 52801, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'027')
    THROW 52802, N'Chạy migration 027 trước.', 1;
GO

CREATE OR ALTER PROCEDURE dbo.sp_XacNhanPhieuThu
    @MaPhieuThu bigint,
    @NguoiXacNhan int = NULL,
    @MaThamChieuNgoai nvarchar(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaHoaDon nvarchar(20), @MaGiaoDich nvarchar(60),
                @TrangThai nvarchar(20), @TongHoaDon decimal(18,2),
                @DaThu decimal(18,2), @SoTien decimal(18,2),
                @LyDo nvarchar(255), @HoaDonDaKhoa nvarchar(20),
                @GiaoDichDaKhoa nvarchar(60);

        SELECT @MaHoaDon = pt.MaHoaDon, @MaGiaoDich = pt.MaGiaoDich
        FROM dbo.PhieuThu pt WITH (READCOMMITTED)
        WHERE pt.MaPhieuThu = @MaPhieuThu;

        IF @MaHoaDon IS NULL
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52103, N'Không tìm thấy phiếu thu.', 1;
        END;

        SELECT @HoaDonDaKhoa = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;

        IF @HoaDonDaKhoa IS NULL
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 52103, N'Không tìm thấy hóa đơn của phiếu thu.', 1;
        END;

        IF @MaGiaoDich IS NOT NULL
        BEGIN
            SELECT @GiaoDichDaKhoa = gd.MaGiaoDich
            FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
            WHERE gd.MaGiaoDich = @MaGiaoDich;
        END;

        SELECT @MaHoaDon = pt.MaHoaDon, @MaGiaoDich = pt.MaGiaoDich,
               @TrangThai = pt.TrangThai, @SoTien = pt.SoTien
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        WHERE pt.MaPhieuThu = @MaPhieuThu;

        IF @MaHoaDon <> @HoaDonDaKhoa
            OR ISNULL(@MaGiaoDich, N'') <> ISNULL(@GiaoDichDaKhoa, N'')
            THROW 52103, N'Thông tin phiếu thu đã thay đổi; vui lòng thử lại.', 1;
        IF @TrangThai <> N'Chờ xác nhận'
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu, @TrangThai AS TrangThai;
            THROW 52104, N'Chỉ xác nhận được phiếu thu đang chờ xác nhận.', 1;
        END;

        SELECT @TongHoaDon = ISNULL(SUM(c.SoTien), 0)
        FROM dbo.ChiTietHoaDon c
        WHERE c.MaHoaDon = @MaHoaDon;
        SELECT @DaThu = ISNULL(SUM(pt.SoTien), 0)
        FROM dbo.PhieuThu pt
        WHERE pt.MaHoaDon = @MaHoaDon
          AND pt.TrangThai = N'Hợp lệ'
          AND pt.MaPhieuThu <> @MaPhieuThu;

        IF @DaThu + @SoTien > @TongHoaDon
        BEGIN
            SET @LyDo = N'Tổng thu hợp lệ đã thay đổi; xác nhận phiếu sẽ vượt tổng hóa đơn.';
            IF @MaGiaoDich IS NOT NULL
            BEGIN
                UPDATE dbo.GiaoDichThanhToan
                SET TrangThai = N'RECONCILIATION',
                    LyDoDoiSoat = @LyDo,
                    MaThamChieuNgoai = COALESCE(@MaThamChieuNgoai, MaThamChieuNgoai)
                WHERE MaGiaoDich = @MaGiaoDich
                  AND TrangThai IN (N'PENDING', N'RECONCILIATION');
            END;

            INSERT INTO dbo.NhatKyHeThong
                (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
            VALUES
                (@NguoiXacNhan, N'Cần đối soát phiếu thu', N'PhieuThu',
                 CONVERT(nvarchar(60), @MaPhieuThu), @LyDo);

            COMMIT TRANSACTION;
            SELECT @MaPhieuThu AS MaPhieuThu, N'RECONCILIATION' AS TrangThaiGiaoDich,
                   @LyDo AS LyDoDoiSoat;
            RETURN;
        END;

        UPDATE dbo.PhieuThu
        SET TrangThai = N'Hợp lệ',
            MaThamChieu = COALESCE(@MaThamChieuNgoai, MaThamChieu)
        WHERE MaPhieuThu = @MaPhieuThu
          AND TrangThai = N'Chờ xác nhận';
        IF @@ROWCOUNT <> 1
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52105, N'Phiếu thu đã được xử lý bởi thao tác khác.', 1;
        END;

        IF @MaGiaoDich IS NOT NULL
        BEGIN
            UPDATE dbo.GiaoDichThanhToan
            SET TrangThai = N'SUCCESS',
                NgayThanhToan = GETDATE(),
                XacNhanBoi = COALESCE(@NguoiXacNhan, XacNhanBoi),
                MaThamChieuNgoai = COALESCE(@MaThamChieuNgoai, MaThamChieuNgoai),
                LyDoDoiSoat = NULL
            WHERE MaGiaoDich = @MaGiaoDich
              AND TrangThai IN (N'PENDING', N'RECONCILIATION');
        END;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiXacNhan, N'Xác nhận phiếu thu', N'PhieuThu',
             CONVERT(nvarchar(60), @MaPhieuThu), N'Phiếu thu chuyển sang Hợp lệ.');

        COMMIT TRANSACTION;
        SELECT @MaPhieuThu AS MaPhieuThu, N'Hợp lệ' AS TrangThaiPhieuThu,
               N'SUCCESS' AS TrangThaiGiaoDich, CAST(NULL AS nvarchar(255)) AS LyDoDoiSoat;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HuyPhieuThu
    @MaPhieuThu bigint,
    @NguoiThucHien int = NULL,
    @LyDo nvarchar(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaHoaDon nvarchar(20), @MaGiaoDich nvarchar(60),
                @TrangThai nvarchar(20), @HoaDonDaKhoa nvarchar(20),
                @GiaoDichDaKhoa nvarchar(60);

        SELECT @MaHoaDon = pt.MaHoaDon, @MaGiaoDich = pt.MaGiaoDich
        FROM dbo.PhieuThu pt WITH (READCOMMITTED)
        WHERE pt.MaPhieuThu = @MaPhieuThu;

        IF @MaHoaDon IS NULL
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52103, N'Không tìm thấy phiếu thu.', 1;
        END;

        SELECT @HoaDonDaKhoa = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;

        IF @HoaDonDaKhoa IS NULL
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 52103, N'Không tìm thấy hóa đơn của phiếu thu.', 1;
        END;

        IF @MaGiaoDich IS NOT NULL
        BEGIN
            SELECT @GiaoDichDaKhoa = gd.MaGiaoDich
            FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
            WHERE gd.MaGiaoDich = @MaGiaoDich;
        END;

        SELECT @MaHoaDon = pt.MaHoaDon, @MaGiaoDich = pt.MaGiaoDich,
               @TrangThai = pt.TrangThai
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        WHERE pt.MaPhieuThu = @MaPhieuThu;

        IF @MaHoaDon <> @HoaDonDaKhoa
            OR ISNULL(@MaGiaoDich, N'') <> ISNULL(@GiaoDichDaKhoa, N'')
            THROW 52103, N'Thông tin phiếu thu đã thay đổi; vui lòng thử lại.', 1;
        IF @TrangThai <> N'Chờ xác nhận'
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu, @TrangThai AS TrangThai;
            THROW 52104, N'Chỉ hủy được phiếu thu đang chờ xác nhận.', 1;
        END;

        UPDATE dbo.PhieuThu
        SET TrangThai = N'Đã hủy',
            GhiChu = COALESCE(NULLIF(LTRIM(RTRIM(@LyDo)), N''), GhiChu)
        WHERE MaPhieuThu = @MaPhieuThu
          AND TrangThai = N'Chờ xác nhận';
        IF @@ROWCOUNT <> 1
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52105, N'Phiếu thu đã được xử lý bởi thao tác khác.', 1;
        END;

        IF @MaGiaoDich IS NOT NULL
        BEGIN
            UPDATE dbo.GiaoDichThanhToan
            SET TrangThai = N'REJECTED',
                LyDoTuChoi = COALESCE(NULLIF(LTRIM(RTRIM(@LyDo)), N''), LyDoTuChoi),
                LyDoDoiSoat = NULL
            WHERE MaGiaoDich = @MaGiaoDich
              AND TrangThai IN (N'PENDING', N'RECONCILIATION');
        END;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiThucHien, N'Hủy phiếu thu chờ', N'PhieuThu',
             CONVERT(nvarchar(60), @MaPhieuThu), COALESCE(@LyDo, N'Hủy phiếu thu chờ xác nhận.'));

        COMMIT TRANSACTION;
        SELECT @MaPhieuThu AS MaPhieuThu, N'Đã hủy' AS TrangThaiPhieuThu,
               N'REJECTED' AS TrangThaiGiaoDich;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_DanhDauHoanTienChuyenKhoanDu
    @MaGiaoDich nvarchar(60),
    @NguoiTra int,
    @GhiChu nvarchar(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @MaHoanTien bigint, @MaHoaDon nvarchar(20), @SoTien decimal(18,2),
                @TrangThai nvarchar(20), @MaPhieuThu bigint, @HoaDonDaKhoa nvarchar(20),
                @GiaoDichDaKhoa nvarchar(60);

        SELECT @MaHoaDon = h.MaHoaDon
        FROM dbo.HoanTienChuyenKhoanDu h WITH (READCOMMITTED)
        WHERE h.MaGiaoDich = @MaGiaoDich;

        IF @MaHoaDon IS NULL
            THROW 52704, N'Không tìm thấy khoản tiền dư đang chờ hoàn.', 1;

        SELECT @HoaDonDaKhoa = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;

        IF @HoaDonDaKhoa IS NULL
            THROW 52704, N'Không tìm thấy hóa đơn của khoản tiền dư.', 1;

        SELECT @GiaoDichDaKhoa = gd.MaGiaoDich
        FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
        WHERE gd.MaGiaoDich = @MaGiaoDich;

        SELECT @MaPhieuThu = pt.MaPhieuThu
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        WHERE pt.MaGiaoDich = @MaGiaoDich
          AND pt.TrangThai = N'Chờ xác nhận';

        SELECT @MaHoanTien = h.MaHoanTien, @MaHoaDon = h.MaHoaDon,
               @SoTien = h.SoTien, @TrangThai = h.TrangThai
        FROM dbo.HoanTienChuyenKhoanDu h WITH (UPDLOCK, HOLDLOCK)
        WHERE h.MaGiaoDich = @MaGiaoDich;

        IF @MaHoanTien IS NULL OR @MaHoaDon <> @HoaDonDaKhoa
            OR @GiaoDichDaKhoa IS NULL
            THROW 52704, N'Không tìm thấy khoản tiền dư chờ hoàn.', 1;

        IF @TrangThai = N'DA_HOAN'
        BEGIN
            COMMIT TRANSACTION;
            SELECT @MaGiaoDich AS MaGiaoDich, @MaHoaDon AS MaHoaDon,
                   @SoTien AS SoTien, @TrangThai AS TrangThai, CAST(1 AS bit) AS DaXuLyTruoc;
            RETURN;
        END;

        IF @MaPhieuThu IS NOT NULL
            EXEC dbo.sp_HuyPhieuThu @MaPhieuThu, @NguoiTra,
                N'Giao dịch đối soát được trả lại toàn bộ số tiền thực nhận.';

        UPDATE dbo.HoanTienChuyenKhoanDu
        SET TrangThai = N'DA_HOAN',
            NguoiTra = @NguoiTra,
            ThoiDiemTra = GETDATE(),
            GhiChu = COALESCE(NULLIF(LTRIM(RTRIM(@GhiChu)), N''), GhiChu)
        WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'CHO_HOAN';

        IF @@ROWCOUNT <> 1
            THROW 52705, N'Khoản tiền dư đã được xử lý bởi thao tác khác.', 1;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiTra, N'Đã trả lại tiền chuyển khoản dư', N'HoanTienChuyenKhoanDu',
             @MaGiaoDich, CONCAT(N'Hóa đơn ', @MaHoaDon, N'; số tiền ', @SoTien, N' đ.'));

        COMMIT TRANSACTION;
        SELECT @MaGiaoDich AS MaGiaoDich, @MaHoaDon AS MaHoaDon,
               @SoTien AS SoTien, N'DA_HOAN' AS TrangThai, CAST(0 AS bit) AS DaXuLyTruoc;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'028')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'028', N'028_payment_lock_order.sql');
GO
PRINT N'[028] Hoàn tất.';
GO
