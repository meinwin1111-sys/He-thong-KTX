SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 53700, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 53701, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'034')
   OR OBJECT_ID(N'dbo.sp_HuyGiaHanQuaHan', N'P') IS NULL
   OR OBJECT_ID(N'dbo.GiaHanHopDong', N'U') IS NULL
    THROW 53702, N'Cần migration 034, dbo.sp_HuyGiaHanQuaHan và dbo.GiaHanHopDong.', 1;
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
            @LockedStatus nvarchar(20), @Count bigint, @EventKey nvarchar(100),
            @NoticeCreator int;
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
                BEGIN
                    SET @NoticeCreator = NULL;
                    SELECT @NoticeCreator = yc.XuLyBoi
                    FROM dbo.GiaHanHopDong g
                    INNER JOIN dbo.YeuCauSinhVien yc ON yc.MaYeuCau = g.MaYeuCau
                    WHERE g.MaGiaHan = @CurrentId;
                    IF @NoticeCreator IS NULL
                        SELECT TOP (1) @NoticeCreator = MaTaiKhoan
                        FROM dbo.TaiKhoan
                        WHERE VaiTro = N'Quản lý'
                        ORDER BY MaTaiKhoan;
                    IF @NoticeCreator IS NULL
                        THROW 53704, N'Không tìm thấy tài khoản Quản lý để ghi người tạo thông báo gia hạn quá hạn.', 1;

                    INSERT INTO dbo.ThongBao
                        (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien, MaHoaDon)
                    VALUES
                        (N'Gia hạn đã hết hạn',
                         N'Gia hạn đã bị hủy vì hóa đơn quá hạn thanh toán.',
                         N'SINH_VIEN', @StudentId, @NoticeCreator, @EventKey, @InvoiceId);
                END;
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

GRANT EXECUTE ON OBJECT::dbo.sp_HuyGiaHanQuaHan TO [DNKTX];
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'037')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'037', N'037_expired_renewal_notice_creator.sql');
GO

PRINT N'[037] Hoàn tất.';
GO
