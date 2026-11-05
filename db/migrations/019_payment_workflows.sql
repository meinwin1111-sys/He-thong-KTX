SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51900, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'018')
    THROW 51901, N'Chạy migration 018 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'019')
    PRINT N'[019] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.ChiTietGiaoDich', N'U') IS NOT NULL
        BEGIN
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.GiaoDichThanhToan gd
                    LEFT JOIN (
                        SELECT MaGiaoDich, SUM(SoTien) AS DaPhanBo
                        FROM dbo.ChiTietGiaoDich
                        GROUP BY MaGiaoDich
                    ) a ON a.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.TrangThai = N''SUCCESS''
                      AND ISNULL(a.DaPhanBo, 0) <> gd.TongTien
                )
                BEGIN
                    SELECT gd.MaGiaoDich, gd.TongTien, ISNULL(a.DaPhanBo, 0) AS DaPhanBo,
                           gd.TrangThai
                    FROM dbo.GiaoDichThanhToan gd
                    LEFT JOIN (
                        SELECT MaGiaoDich, SUM(SoTien) AS DaPhanBo
                        FROM dbo.ChiTietGiaoDich
                        GROUP BY MaGiaoDich
                    ) a ON a.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.TrangThai = N''SUCCESS''
                      AND ISNULL(a.DaPhanBo, 0) <> gd.TongTien;
                    THROW 51902, N''Tổng phân bổ ChiTietGiaoDich không khớp giao dịch SUCCESS.'', 1;
                END;

                IF EXISTS (
                    SELECT 1
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY chi.MaChiTiet, chi.SoTien
                    HAVING SUM(cgd.SoTien) > chi.SoTien
                )
                BEGIN
                    SELECT chi.MaChiTiet, chi.MaHoaDon, chi.SoTien AS TienDong,
                           SUM(cgd.SoTien) AS DaThuThanhCong
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY chi.MaChiTiet, chi.MaHoaDon, chi.SoTien
                    HAVING SUM(cgd.SoTien) > chi.SoTien;
                    THROW 51903, N''Phân bổ SUCCESS vượt số tiền của chi tiết hóa đơn.'', 1;
                END;

                IF EXISTS (
                    SELECT 1
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY chi.MaHoaDon
                    HAVING SUM(cgd.SoTien) > (
                        SELECT SUM(all_lines.SoTien)
                        FROM dbo.ChiTietHoaDon all_lines
                        WHERE all_lines.MaHoaDon = chi.MaHoaDon
                    )
                )
                BEGIN
                    SELECT chi.MaHoaDon, SUM(cgd.SoTien) AS DaThuThanhCong,
                           (SELECT SUM(all_lines.SoTien)
                            FROM dbo.ChiTietHoaDon all_lines
                            WHERE all_lines.MaHoaDon = chi.MaHoaDon) AS TongHoaDon
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY chi.MaHoaDon
                    HAVING SUM(cgd.SoTien) > (
                        SELECT SUM(all_lines.SoTien)
                        FROM dbo.ChiTietHoaDon all_lines
                        WHERE all_lines.MaHoaDon = chi.MaHoaDon
                    );
                    THROW 51904, N''Tổng SUCCESS phân bổ vượt tổng hóa đơn.'', 1;
                END;';

            EXEC sys.sp_executesql N'
                INSERT INTO dbo.PhieuThu
                    (MaHoaDon, MaGiaoDich, SoTien, NgayThu, PhuongThuc,
                     MaSinhVienNop, NguoiThu, TrangThai, MaThamChieu, GhiChu)
                SELECT chi.MaHoaDon, gd.MaGiaoDich, SUM(cgd.SoTien),
                       COALESCE(gd.NgayThanhToan, gd.NgayTao),
                       CASE WHEN gd.PhuongThuc = N''CASH'' THEN N''CASH'' ELSE N''ONLINE'' END,
                       CONVERT(nvarchar(30), gd.MaSinhVien), gd.XacNhanBoi,
                       N''Hợp lệ'', gd.MaThamChieuNgoai,
                       N''Chuyển đổi từ giao dịch SUCCESS cũ''
                FROM dbo.ChiTietGiaoDich cgd
                INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                WHERE gd.TrangThai = N''SUCCESS''
                GROUP BY chi.MaHoaDon, gd.MaGiaoDich, gd.NgayThanhToan, gd.NgayTao,
                         gd.PhuongThuc, gd.MaSinhVien, gd.XacNhanBoi, gd.MaThamChieuNgoai;';

            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT gd.MaGiaoDich, chi.MaHoaDon
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY gd.MaGiaoDich, chi.MaHoaDon
                    HAVING SUM(cgd.SoTien) <> (
                        SELECT SUM(pt.SoTien)
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaGiaoDich = gd.MaGiaoDich
                          AND pt.MaHoaDon = chi.MaHoaDon
                          AND pt.TrangThai = N''Hợp lệ''
                    )
                )
                BEGIN
                    SELECT gd.MaGiaoDich, chi.MaHoaDon,
                           SUM(cgd.SoTien) AS TongNguon,
                           (SELECT SUM(pt.SoTien)
                            FROM dbo.PhieuThu pt
                            WHERE pt.MaGiaoDich = gd.MaGiaoDich
                              AND pt.MaHoaDon = chi.MaHoaDon
                              AND pt.TrangThai = N''Hợp lệ'') AS TongPhieuThu
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY gd.MaGiaoDich, chi.MaHoaDon
                    HAVING SUM(cgd.SoTien) <> (
                        SELECT SUM(pt.SoTien)
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaGiaoDich = gd.MaGiaoDich
                          AND pt.MaHoaDon = chi.MaHoaDon
                          AND pt.TrangThai = N''Hợp lệ''
                    );
                    THROW 51907, N''Đối chiếu ChiTietGiaoDich và PhieuThu không khớp; không được bỏ bảng nguồn.'', 1;
                END;';

            EXEC sys.sp_executesql N'
                INSERT INTO dbo.PhieuThu
                    (MaHoaDon, SoTien, NgayThu, PhuongThuc, MaSinhVienNop,
                     TrangThai, GhiChu)
                SELECT chi.MaHoaDon, SUM(chi.SoTien - ISNULL(success_paid.DaThu, 0)),
                       COALESCE(MAX(chi.NgayThanhToan), MAX(hd.NgayLap), GETDATE()),
                       N''CHUYEN_DOI'', CONVERT(nvarchar(30), MAX(hd.MaSinhVien)),
                       N''Hợp lệ'', N''Chuyển đổi từ dữ liệu cũ''
                FROM dbo.ChiTietHoaDon chi
                INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
                LEFT JOIN (
                    SELECT cgd.MaChiTiet, SUM(cgd.SoTien) AS DaThu
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = cgd.MaGiaoDich
                    WHERE gd.TrangThai = N''SUCCESS''
                    GROUP BY cgd.MaChiTiet
                ) success_paid ON success_paid.MaChiTiet = chi.MaChiTiet
                WHERE chi.TrangThai = N''Đã thanh toán''
                  AND chi.SoTien > ISNULL(success_paid.DaThu, 0)
                GROUP BY chi.MaHoaDon;';

            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.ChiTietHoaDon chi
                    CROSS APPLY (
                        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = chi.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
                    ) r
                    CROSS APPLY (
                        SELECT ISNULL(SUM(all_lines.SoTien), 0) AS TongHoaDon
                        FROM dbo.ChiTietHoaDon all_lines
                        WHERE all_lines.MaHoaDon = chi.MaHoaDon
                    ) t
                    WHERE chi.TrangThai = N''Đã thanh toán''
                    GROUP BY chi.MaHoaDon, r.DaThu, t.TongHoaDon
                    HAVING r.DaThu > t.TongHoaDon
                )
                BEGIN
                    SELECT chi.MaHoaDon,
                           SUM(CASE WHEN chi.TrangThai = N''Đã thanh toán'' THEN chi.SoTien ELSE 0 END)
                               AS TongChiTietDaThanhToan,
                           MAX(r.DaThu) AS TongPhieuThu,
                           MAX(t.TongHoaDon) AS TongHoaDon
                    FROM dbo.ChiTietHoaDon chi
                    CROSS APPLY (
                        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = chi.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
                    ) r
                    CROSS APPLY (
                        SELECT ISNULL(SUM(all_lines.SoTien), 0) AS TongHoaDon
                        FROM dbo.ChiTietHoaDon all_lines
                        WHERE all_lines.MaHoaDon = chi.MaHoaDon
                    ) t
                    WHERE chi.TrangThai = N''Đã thanh toán''
                    GROUP BY chi.MaHoaDon
                    HAVING MAX(r.DaThu) > MAX(t.TongHoaDon);
                    THROW 51905, N''Số phiếu thu chuyển đổi vượt tổng hóa đơn.'', 1;
                END;';
        END;

        IF OBJECT_ID(N'dbo.TRG_ChiTietGiaoDich_MotSuccess', N'TR') IS NOT NULL
            EXEC sys.sp_executesql N'DROP TRIGGER dbo.TRG_ChiTietGiaoDich_MotSuccess;';
        IF OBJECT_ID(N'dbo.TRG_GiaoDich_MotSuccess', N'TR') IS NOT NULL
            EXEC sys.sp_executesql N'DROP TRIGGER dbo.TRG_GiaoDich_MotSuccess;';
        IF OBJECT_ID(N'dbo.ChiTietGiaoDich', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'DROP TABLE dbo.ChiTietGiaoDich;';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HoaDon_DongBoChiTiet
ON dbo.HoaDon
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID(N''dbo.TRG_HoaDon_DongBoChiTiet'')) > 1 RETURN;

    DECLARE @HasAmount bit = CASE
        WHEN UPDATE(TienPhong) OR UPDATE(TienDien) OR UPDATE(TienNuoc) THEN 1 ELSE 0 END;
    DECLARE @HasStatus bit = CASE WHEN UPDATE(TrangThaiThanhToan) THEN 1 ELSE 0 END;

    IF @HasAmount = 1
    BEGIN
        MERGE dbo.ChiTietHoaDon AS target
        USING (
            SELECT i.MaHoaDon, x.MaKhoan, x.TenKhoan, x.SoTien, x.ThuTu
            FROM inserted i
            CROSS APPLY (VALUES
                (N''ROOM'', N''Tiền phòng'', ISNULL(i.TienPhong, 0), 1),
                (N''ELECTRICITY'', N''Tiền điện'', ISNULL(i.TienDien, 0), 2),
                (N''WATER'', N''Tiền nước'', ISNULL(i.TienNuoc, 0), 3)
            ) x(MaKhoan, TenKhoan, SoTien, ThuTu)
            WHERE i.LoaiHoaDon = N''CU'' AND x.SoTien > 0
        ) AS source
        ON target.MaHoaDon = source.MaHoaDon
           AND target.MaKhoan = source.MaKhoan AND target.TenKhoan = source.TenKhoan
        WHEN MATCHED AND target.TrangThai = N''Chưa thanh toán''
                        AND target.SoTien <> source.SoTien
            THEN UPDATE SET SoTien = source.SoTien, DonGia = source.SoTien, ThuTu = source.ThuTu
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, DonGia, TrangThai, ThuTu)
            VALUES (LEFT(source.MaHoaDon, 32) + N''-'' + RIGHT(CONVERT(nvarchar(36), NEWID()), 7),
                    source.MaHoaDon, source.MaKhoan, source.TenKhoan, source.SoTien,
                    source.SoTien, N''Chưa thanh toán'', source.ThuTu);
    END;

    IF @HasStatus = 1
        UPDATE c
        SET TrangThai = N''Đã thanh toán'',
            NgayThanhToan = ISNULL(c.NgayThanhToan, GETDATE())
        FROM dbo.ChiTietHoaDon c
        INNER JOIN inserted i ON i.MaHoaDon = c.MaHoaDon
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        WHERE i.LoaiHoaDon = N''CU''
          AND i.TrangThaiThanhToan = N''Đã thanh toán''
          AND d.TrangThaiThanhToan <> N''Đã thanh toán''
          AND c.TrangThai <> N''Đã thanh toán'';
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_DongBoHoaDon
ON dbo.ChiTietHoaDon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID(N''dbo.TRG_ChiTietHoaDon_DongBoHoaDon'')) > 1 RETURN;

    DECLARE @HoaDon table (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT MaHoaDon FROM inserted
    UNION
    SELECT MaHoaDon FROM deleted;

    UPDATE hd
    SET TrangThaiThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                 SELECT 1 FROM dbo.ChiTietHoaDon c
                 WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
             ) THEN N''Đã thanh toán''
            ELSE N''Chưa thanh toán''
        END,
        NgayThanhToan = CASE
            WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
             AND NOT EXISTS (
                 SELECT 1 FROM dbo.ChiTietHoaDon c
                 WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
             ) THEN ISNULL(hd.NgayThanhToan, GETDATE())
            ELSE NULL
        END
    FROM dbo.HoaDon hd
    INNER JOIN @HoaDon x ON x.MaHoaDon = hd.MaHoaDon
    WHERE hd.LoaiHoaDon = N''CU''
      AND (
          hd.TrangThaiThanhToan <> CASE
              WHEN EXISTS (SELECT 1 FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon)
               AND NOT EXISTS (
                   SELECT 1 FROM dbo.ChiTietHoaDon c
                   WHERE c.MaHoaDon = hd.MaHoaDon AND c.TrangThai <> N''Đã thanh toán''
               ) THEN N''Đã thanh toán'' ELSE N''Chưa thanh toán'' END
          OR (hd.TrangThaiThanhToan = N''Đã thanh toán'' AND hd.NgayThanhToan IS NULL)
      );
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_BaoVe
ON dbo.ChiTietHoaDon
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = d.MaHoaDon
        LEFT JOIN inserted i ON i.MaChiTiet = d.MaChiTiet
        WHERE hd.LoaiHoaDon = N''CU''
          AND d.TrangThai = N''Đã thanh toán''
          AND (i.MaChiTiet IS NULL OR i.SoTien <> d.SoTien)
    )
    BEGIN
        SELECT d.MaChiTiet, d.MaHoaDon, d.SoTien, d.TrangThai
        FROM deleted d
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = d.MaHoaDon
        LEFT JOIN inserted i ON i.MaChiTiet = d.MaChiTiet
        WHERE hd.LoaiHoaDon = N''CU''
          AND d.TrangThai = N''Đã thanh toán''
          AND (i.MaChiTiet IS NULL OR i.SoTien <> d.SoTien);
        THROW 51906, N''Không được xóa hoặc đổi số tiền của hạng mục CU đã thanh toán.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_GiaoDich_DongBoPhieuThu
ON dbo.GiaoDichThanhToan
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE pt
    SET TrangThai = N''Đã hủy''
    FROM dbo.PhieuThu pt
    INNER JOIN inserted i ON i.MaGiaoDich = pt.MaGiaoDich
    INNER JOIN deleted d ON d.MaGiaoDich = i.MaGiaoDich
    WHERE i.TrangThai IN (N''REJECTED'', N''EXPIRED'')
      AND d.TrangThai <> i.TrangThai
      AND pt.TrangThai <> N''Đã hủy'';
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_B3_TaoMaHoaDon
    @Ngay date,
    @MaHoaDon nvarchar(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ky char(6) = CONVERT(char(6), @Ngay, 112), @SoCuoi int;
    SELECT @SoCuoi = SoCuoi
    FROM dbo.MaHoaDonCounter WITH (UPDLOCK, HOLDLOCK)
    WHERE Ky = @Ky;
    IF @SoCuoi IS NULL
    BEGIN
        SET @SoCuoi = 1;
        INSERT INTO dbo.MaHoaDonCounter(Ky, SoCuoi) VALUES (@Ky, @SoCuoi);
    END
    ELSE
    BEGIN
        IF @SoCuoi >= 9999
        BEGIN
            SELECT @Ky AS Ky, @SoCuoi AS SoCuoi;
            THROW 51910, N''Đã hết dải mã hóa đơn trong tháng.'', 1;
        END;
        SET @SoCuoi += 1;
        UPDATE dbo.MaHoaDonCounter SET SoCuoi = @SoCuoi WHERE Ky = @Ky;
    END;
    SET @MaHoaDon = N''INV'' + @Ky + RIGHT(N''0000'' + CONVERT(nvarchar(4), @SoCuoi), 4);
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GhiPhieuThu
    @MaHoaDon nvarchar(20),
    @SoTien decimal(18,2),
    @PhuongThuc nvarchar(20),
    @MaSinhVienNop nvarchar(30) = NULL,
    @NguoiThu int = NULL,
    @TrangThai nvarchar(20) = N''Hợp lệ'',
    @MaGiaoDich nvarchar(60) = NULL,
    @MaThamChieu nvarchar(100) = NULL,
    @GhiChu nvarchar(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @TongHoaDon decimal(18,2), @DaThu decimal(18,2), @HoaDonStatus nvarchar(30);
        SELECT @HoaDonStatus = hd.TrangThaiThanhToan
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        IF @HoaDonStatus IS NULL
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 51911, N''Không tìm thấy hóa đơn.'', 1;
        END;
        IF @SoTien <= 0
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @SoTien AS SoTien;
            THROW 51912, N''Số tiền phiếu thu phải lớn hơn 0.'', 1;
        END;
        IF @PhuongThuc NOT IN (N''CASH'', N''ONLINE'', N''CHUYEN_DOI'')
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @PhuongThuc AS PhuongThuc;
            THROW 51913, N''Phương thức thu không hợp lệ.'', 1;
        END;
        IF @TrangThai NOT IN (N''Hợp lệ'', N''Chờ xác nhận'', N''Đã hủy'')
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @TrangThai AS TrangThai;
            THROW 51914, N''Trạng thái phiếu thu không hợp lệ.'', 1;
        END;
        IF @HoaDonStatus = N''Đã hủy'' AND @TrangThai = N''Hợp lệ''
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @HoaDonStatus AS TrangThaiHoaDon;
            THROW 51915, N''Không thể thu tiền cho hóa đơn đã hủy.'', 1;
        END;

        SELECT @TongHoaDon = ISNULL(SUM(SoTien), 0)
        FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @MaHoaDon;
        SELECT @DaThu = ISNULL(SUM(SoTien), 0)
        FROM dbo.PhieuThu
        WHERE MaHoaDon = @MaHoaDon AND TrangThai = N''Hợp lệ'';
        IF @TrangThai = N''Hợp lệ'' AND @DaThu + @SoTien > @TongHoaDon
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon, @TongHoaDon AS TongHoaDon,
                   @DaThu AS DaThu, @SoTien AS SoTienMoi;
            THROW 51916, N''Phiếu thu làm tổng thu vượt tổng hóa đơn.'', 1;
        END;

        INSERT INTO dbo.PhieuThu
            (MaHoaDon, MaGiaoDich, SoTien, PhuongThuc, MaSinhVienNop,
             NguoiThu, TrangThai, MaThamChieu, GhiChu)
        VALUES
            (@MaHoaDon, @MaGiaoDich, @SoTien, @PhuongThuc, @MaSinhVienNop,
             @NguoiThu, @TrangThai, @MaThamChieu, @GhiChu);
        DECLARE @MaPhieuThu bigint = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT @MaPhieuThu AS MaPhieuThu;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_DongBoTrangThaiHoaDon
    @MaHoaDon nvarchar(20)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TongHoaDon decimal(18,2), @DaThu decimal(18,2);
    SELECT @TongHoaDon = ISNULL(SUM(c.SoTien), 0)
    FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = @MaHoaDon;
    SELECT @DaThu = ISNULL(SUM(pt.SoTien), 0)
    FROM dbo.PhieuThu pt WHERE pt.MaHoaDon = @MaHoaDon AND pt.TrangThai = N''Hợp lệ'';
    UPDATE dbo.HoaDon
    SET TrangThaiThanhToan = CASE
            WHEN TrangThaiThanhToan = N''Đã hủy'' THEN N''Đã hủy''
            WHEN @DaThu = 0 THEN N''Chưa thanh toán''
            WHEN @DaThu < @TongHoaDon THEN N''Thanh toán một phần''
            ELSE N''Đã thanh toán''
        END,
        NgayThanhToan = CASE WHEN @DaThu >= @TongHoaDon AND @DaThu > 0
                             THEN COALESCE(NgayThanhToan, GETDATE()) ELSE NULL END
    WHERE MaHoaDon = @MaHoaDon;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDonTienPhong
    @MaChiTiet int,
    @KyThanhToan date,
    @MaHoaDon nvarchar(20) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @MaHopDong nvarchar(20), @MaSinhVien nvarchar(30), @TenPhong nvarchar(50),
                @KyHan nvarchar(10), @Gia decimal(18,2), @ThangGia decimal(18,2),
                @Den date, @Ngay date = CAST(GETDATE() AS date), @Han date;
        SELECT @MaHopDong = hd.MaHopDong, @MaSinhVien = c.MaSinhVien, @TenPhong = hd.TenPhong,
               @KyHan = c.KyHanThanhToanPhong, @Gia = c.GiaPhongApDung,
               @ThangGia = c.GiaPhongThangApDung
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaChiTiet = @MaChiTiet AND c.TrangThai = N''Đang ở''
          AND hd.TrangThaiHopDong = N''Còn hiệu lực'';
        IF @MaHopDong IS NULL
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet;
            THROW 51920, N''Không tìm thấy thành viên hợp đồng đang ở.'', 1;
        END;
        IF @KyThanhToan IS NULL
           OR @KyThanhToan <> DATEFROMPARTS(YEAR(@KyThanhToan), MONTH(@KyThanhToan), 1)
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @KyThanhToan AS KyThanhToan;
            THROW 51921, N''Kỳ thanh toán tiền phòng phải là ngày đầu tháng.'', 1;
        END;
        IF @KyHan = N''NAM''
        BEGIN
            SET @Den = EOMONTH(DATEADD(month, 11, @KyThanhToan));
            SET @Gia = @Gia;
        END
        ELSE
        BEGIN
            SET @Den = EOMONTH(@KyThanhToan);
            SET @Gia = @ThangGia;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE LoaiHoaDon = N''TIEN_PHONG''
              AND MaChiTiet = @MaChiTiet
              AND TrangThaiThanhToan <> N''Đã hủy''
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan
        )
        BEGIN
            SELECT MaHoaDon, MaChiTiet, KyThanhToan, KyThanhToanDen,
                   TrangThaiThanhToan
            FROM dbo.HoaDon
            WHERE LoaiHoaDon = N''TIEN_PHONG''
              AND MaChiTiet = @MaChiTiet
              AND TrangThaiThanhToan <> N''Đã hủy''
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan;
            THROW 51922, N''Kỳ tiền phòng bị trùng hoặc chồng với hóa đơn đang hoạt động.'', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon)
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 51923, N''Mã hóa đơn đã tồn tại.'', 1;
        END;
        SELECT @Han = DATEADD(day, ISNULL(TRY_CONVERT(int, GiaTri), 15), @Ngay)
        FROM dbo.CauHinhHeThong WHERE Khoa = N''SO_NGAY_HAN_THANH_TOAN'';
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, 0, 0, 0,
             N''Chưa thanh toán'', COALESCE(@Han, DATEADD(day, 15, @Ngay)),
             N''TIEN_PHONG'', @MaHopDong, @MaChiTiet, @KyThanhToan, @Den);
        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
             TrangThai, ThuTu, GhiChu)
        VALUES
            (LEFT(@MaHoaDon, 30) + N''-ROOM'', @MaHoaDon, N''ROOM'', N''Tiền phòng'',
             @Gia, 1, @Gia, N''Chưa thanh toán'', 1, @KyHan);
        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon, @Gia AS TongTien;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDonPhatSinh
    @MaChiPhi bigint,
    @MaHoaDon nvarchar(20) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @MaHopDong nvarchar(20), @MaChiTiet int, @NoiDung nvarchar(255),
                @SoTien decimal(18,2), @TenPhong nvarchar(50), @MaSinhVien nvarchar(30),
                @Ky date, @Ngay date = CAST(GETDATE() AS date), @Prefix nvarchar(40),
                @TenKhoan nvarchar(100), @MaChiTietHD nvarchar(40);
        SELECT @MaHopDong = cp.MaHopDong, @MaChiTiet = cp.MaChiTiet,
               @NoiDung = cp.NoiDung, @SoTien = cp.SoTien,
               @TenPhong = hd.TenPhong, @Ky = DATEFROMPARTS(YEAR(cp.NgayPhatSinh), MONTH(cp.NgayPhatSinh), 1),
               @MaSinhVien = c.MaSinhVien
        FROM dbo.ChiPhiPhatSinh cp WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = cp.MaHopDong
        LEFT JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = cp.MaChiTiet
        WHERE cp.MaChiPhi = @MaChiPhi AND cp.TrangThai = N''Chưa lập hóa đơn'';
        IF @MaHopDong IS NULL
        BEGIN
            SELECT MaChiPhi, MaHopDong, TrangThai FROM dbo.ChiPhiPhatSinh WHERE MaChiPhi = @MaChiPhi;
            THROW 51924, N''Không tìm thấy khoản phát sinh chưa lập hóa đơn.'', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        IF EXISTS (SELECT 1 FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon)
        BEGIN
            SELECT @MaHoaDon AS MaHoaDon;
            THROW 51925, N''Mã hóa đơn đã tồn tại.'', 1;
        END;
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVien, @TenPhong, @Ngay, 0, 0, 0,
             N''Chưa thanh toán'', N''PHAT_SINH'', @MaHopDong, @MaChiTiet, @Ky, @Ky);
        SET @Prefix = N''Phát sinh #'' + CONVERT(nvarchar(20), @MaChiPhi) + N'': '';
        SET @TenKhoan = @Prefix + LEFT(@NoiDung, 100 - LEN(@Prefix));
        SET @MaChiTietHD = LEFT(@MaHoaDon, 25) + N''-INC-'' + CONVERT(nvarchar(12), @MaChiPhi);
        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
             TrangThai, ThuTu, GhiChu)
        VALUES
            (@MaChiTietHD, @MaHoaDon, N''INCIDENT'', @TenKhoan, @SoTien, 1, @SoTien,
             N''Chưa thanh toán'', 1, @NoiDung);
        UPDATE dbo.ChiPhiPhatSinh
        SET TrangThai = N''Đã lập hóa đơn'', MaChiTietHoaDon = @MaChiTietHD
        WHERE MaChiPhi = @MaChiPhi;
        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon, @MaChiTietHD AS MaChiTietHoaDon;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHoaDonDichVuPhong
    @MaHopDong nvarchar(20),
    @KyThanhToan date,
    @ChiSoJson nvarchar(max) = NULL,
    @MaSinhVienNop nvarchar(30) = NULL,
    @MaHoaDon nvarchar(20) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @TenPhong nvarchar(50), @MaHangPhong nvarchar(20),
                @Ngay date = CAST(GETDATE() AS date), @Den date = EOMONTH(@KyThanhToan),
                @Han date;
        SELECT @TenPhong = TenPhong, @MaHangPhong = MaHangPhong
        FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND TrangThaiHopDong = N''Còn hiệu lực'';
        IF @TenPhong IS NULL
        BEGIN
            SELECT @MaHopDong AS MaHopDong;
            THROW 51926, N''Không tìm thấy hợp đồng/phòng hiệu lực.'', 1;
        END;
        IF @KyThanhToan IS NULL
           OR @KyThanhToan <> DATEFROMPARTS(YEAR(@KyThanhToan), MONTH(@KyThanhToan), 1)
        BEGIN
            SELECT @MaHopDong AS MaHopDong, @KyThanhToan AS KyThanhToan;
            THROW 51927, N''Kỳ dịch vụ phải là ngày đầu tháng.'', 1;
        END;
        IF @ChiSoJson IS NOT NULL AND ISJSON(@ChiSoJson) <> 1
        BEGIN
            SELECT @MaHopDong AS MaHopDong, @ChiSoJson AS ChiSoJson;
            THROW 51928, N''Dữ liệu chỉ số dịch vụ phải là JSON hợp lệ.'', 1;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE LoaiHoaDon = N''DICH_VU_PHONG'' AND MaHopDong = @MaHopDong
              AND TrangThaiThanhToan <> N''Đã hủy''
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan
        )
        BEGIN
            SELECT MaHoaDon, MaHopDong, KyThanhToan, KyThanhToanDen
            FROM dbo.HoaDon
            WHERE LoaiHoaDon = N''DICH_VU_PHONG'' AND MaHopDong = @MaHopDong
              AND TrangThaiThanhToan <> N''Đã hủy''
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan;
            THROW 51929, N''Kỳ dịch vụ bị trùng hoặc chồng với hóa đơn đang hoạt động.'', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        SELECT @Han = DATEADD(day, ISNULL(TRY_CONVERT(int, GiaTri), 15), @Ngay)
        FROM dbo.CauHinhHeThong WHERE Khoa = N''SO_NGAY_HAN_THANH_TOAN'';
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVienNop, @TenPhong, @Ngay, 0, 0, 0,
             N''Chưa thanh toán'', COALESCE(@Han, DATEADD(day, 15, @Ngay)),
             N''DICH_VU_PHONG'', @MaHopDong, @KyThanhToan, @Den);

        DECLARE @Services table
        (
            RowNo int IDENTITY(1,1) PRIMARY KEY,
            MaDichVu nvarchar(20) NOT NULL,
            TenDichVu nvarchar(100) NOT NULL,
            DonVi nvarchar(20) NOT NULL,
            DonGia decimal(18,2) NOT NULL,
            CachTinh nvarchar(20) NOT NULL,
            DoiTuongThanhToan nvarchar(10) NOT NULL,
            SoLuong decimal(18,3) NOT NULL,
            ChiSoCu int NULL,
            ChiSoMoi int NULL
        );
        INSERT INTO @Services
            (MaDichVu, TenDichVu, DonVi, DonGia, CachTinh, DoiTuongThanhToan,
             SoLuong, ChiSoCu, ChiSoMoi)
        SELECT d.MaDichVu, d.TenDichVu, d.DonVi, hpdv.DonGia,
               hpdv.CachTinh, hpdv.DoiTuongThanhToan,
               CASE
                   WHEN hpdv.CachTinh = N''CHI_SO''
                       THEN CONVERT(decimal(18,3), j.ChiSoMoi - j.ChiSoCu)
                   WHEN hpdv.DoiTuongThanhToan = N''CA_NHAN''
                       THEN CONVERT(decimal(18,3), residents.SoNguoi)
                   ELSE CONVERT(decimal(18,3), 1)
               END,
               j.ChiSoCu, j.ChiSoMoi
        FROM dbo.HangPhong_DichVu hpdv
        INNER JOIN dbo.DichVu d ON d.MaDichVu = hpdv.MaDichVu
        OUTER APPLY (
            SELECT TRY_CONVERT(int, JSON_VALUE(value, ''$.chiSoCu'')) AS ChiSoCu,
                   TRY_CONVERT(int, JSON_VALUE(value, ''$.chiSoMoi'')) AS ChiSoMoi
            FROM OPENJSON(COALESCE(@ChiSoJson, N''[]''))
            WHERE JSON_VALUE(value, ''$.maDichVu'') = hpdv.MaDichVu
        ) j
        CROSS APPLY (
            SELECT COUNT(*) AS SoNguoi
            FROM dbo.ChiTietHopDong c
            WHERE c.MaHopDong = @MaHopDong AND c.TrangThai = N''Đang ở''
        ) residents
        WHERE hpdv.MaHangPhong = @MaHangPhong
          AND hpdv.HoatDong = 1 AND d.HoatDong = 1;

        IF EXISTS (
            SELECT 1 FROM @Services
            WHERE CachTinh = N''CHI_SO'' AND (ChiSoCu IS NULL OR ChiSoMoi IS NULL OR ChiSoMoi < ChiSoCu)
        )
        BEGIN
            SELECT MaDichVu, CachTinh, ChiSoCu, ChiSoMoi
            FROM @Services
            WHERE CachTinh = N''CHI_SO'' AND (ChiSoCu IS NULL OR ChiSoMoi IS NULL OR ChiSoMoi < ChiSoCu);
            THROW 51930, N''Thiếu hoặc sai chỉ số cũ/mới cho dịch vụ tính theo chỉ số.'', 1;
        END;
        IF EXISTS (SELECT 1 FROM @Services WHERE SoLuong <= 0)
        BEGIN
            SELECT MaDichVu, SoLuong FROM @Services WHERE SoLuong <= 0;
            THROW 51931, N''Số lượng dịch vụ phải lớn hơn 0.'', 1;
        END;

        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, MaDichVu,
             ChiSoCu, ChiSoMoi, SoLuong, DonGia, TrangThai, ThuTu, GhiChu)
        SELECT LEFT(@MaHoaDon, 25) + N''-SV-'' + RIGHT(N''000'' + CONVERT(nvarchar(3), RowNo), 3),
               @MaHoaDon, N''SERVICE'', TenDichVu,
               CONVERT(decimal(18,2), ROUND(SoLuong * DonGia, 2)),
               MaDichVu, ChiSoCu, ChiSoMoi, SoLuong, DonGia,
               N''Chưa thanh toán'', RowNo, DonVi
        FROM @Services;

        DECLARE @IncidentIds table (MaChiPhi bigint PRIMARY KEY);
        INSERT INTO @IncidentIds(MaChiPhi)
        SELECT MaChiPhi
        FROM dbo.ChiPhiPhatSinh WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND TrangThai = N''Chưa lập hóa đơn'';

        DECLARE @MaChiPhi bigint, @IncidentAmount decimal(18,2), @IncidentDesc nvarchar(255),
                @IncidentDetail nvarchar(40), @IncidentPrefix nvarchar(40), @IncidentName nvarchar(100);
        DECLARE incident_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT cp.MaChiPhi, cp.SoTien, cp.NoiDung
            FROM dbo.ChiPhiPhatSinh cp WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN @IncidentIds ids ON ids.MaChiPhi = cp.MaChiPhi
            ORDER BY cp.MaChiPhi;
        OPEN incident_cursor;
        FETCH NEXT FROM incident_cursor INTO @MaChiPhi, @IncidentAmount, @IncidentDesc;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @IncidentPrefix = N''Phát sinh #'' + CONVERT(nvarchar(20), @MaChiPhi) + N'': '';
            SET @IncidentName = @IncidentPrefix + LEFT(@IncidentDesc, 100 - LEN(@IncidentPrefix));
            SET @IncidentDetail = LEFT(@MaHoaDon, 25) + N''-INC-'' + CONVERT(nvarchar(12), @MaChiPhi);
            INSERT INTO dbo.ChiTietHoaDon
                (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
                 TrangThai, ThuTu, GhiChu)
            VALUES (@IncidentDetail, @MaHoaDon, N''INCIDENT'', @IncidentName,
                    @IncidentAmount, 1, @IncidentAmount, N''Chưa thanh toán'', 1000, @IncidentDesc);
            UPDATE dbo.ChiPhiPhatSinh
            SET TrangThai = N''Đã lập hóa đơn'', MaChiTietHoaDon = @IncidentDetail
            WHERE MaChiPhi = @MaChiPhi;
            FETCH NEXT FROM incident_cursor INTO @MaChiPhi, @IncidentAmount, @IncidentDesc;
        END;
        CLOSE incident_cursor;
        DEALLOCATE incident_cursor;

        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TinhGoiYHoanTien
    @MaChiTiet int,
    @KhauTru decimal(18,2) = 0,
    @NgayRa date = NULL,
    @SoThangDaSuDung int OUTPUT,
    @TienSuDung decimal(18,2) OUTPUT,
    @SoTienDaDong decimal(18,2) OUTPUT,
    @SoTienDaHoan decimal(18,2) OUTPUT,
    @GoiYHoan decimal(18,2) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NgayVao date, @Monthly decimal(18,2), @EndDate date, @Months int;
    SELECT @NgayVao = NgayVao, @Monthly = GiaPhongThangApDung, @EndDate = COALESCE(@NgayRa, NgayRa)
    FROM dbo.ChiTietHopDong WHERE MaChiTiet = @MaChiTiet;
    IF @NgayVao IS NULL
    BEGIN
        SELECT @MaChiTiet AS MaChiTiet;
        THROW 51932, N''Không tìm thấy thành viên hợp đồng để tính hoàn tiền.'', 1;
    END;
    IF @EndDate IS NULL SET @EndDate = CAST(GETDATE() AS date);
    IF @EndDate < @NgayVao
    BEGIN
        SELECT @MaChiTiet AS MaChiTiet, @NgayVao AS NgayVao, @EndDate AS NgayRa;
        THROW 51933, N''Ngày ra không được trước ngày vào.'', 1;
    END;
    IF @KhauTru < 0
    BEGIN
        SELECT @MaChiTiet AS MaChiTiet, @KhauTru AS KhauTru;
        THROW 51934, N''Khấu trừ không được âm.'', 1;
    END;

    SET @Months = CASE WHEN @EndDate = @NgayVao THEN 0
        ELSE DATEDIFF(month, @NgayVao, @EndDate)
             + CASE WHEN DATEADD(month, DATEDIFF(month, @NgayVao, @EndDate), @NgayVao) < @EndDate
                    THEN 1 ELSE 0 END END;
    SET @SoThangDaSuDung = @Months;
    SET @TienSuDung = CONVERT(decimal(18,2), ROUND(@Months * @Monthly, 0));
    SELECT @SoTienDaDong = ISNULL(SUM(pt.SoTien), 0)
    FROM dbo.PhieuThu pt
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
    WHERE hd.MaChiTiet = @MaChiTiet
      AND hd.LoaiHoaDon = N''TIEN_PHONG''
      AND pt.TrangThai = N''Hợp lệ'';
    SELECT @SoTienDaHoan = ISNULL(SUM(pc.SoTien), 0)
    FROM dbo.PhieuChi pc
    WHERE pc.MaChiTiet = @MaChiTiet AND pc.TrangThai = N''Hợp lệ'';
    SET @GoiYHoan = CONVERT(decimal(18,2),
        ROUND(CASE WHEN @SoTienDaDong - @TienSuDung - @KhauTru - @SoTienDaHoan > 0
                   THEN @SoTienDaDong - @TienSuDung - @KhauTru - @SoTienDaHoan ELSE 0 END, 0));
END;
';

        EXEC sys.sp_executesql N'
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
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @SoThang int, @Used decimal(18,2), @Paid decimal(18,2),
                @Refunded decimal(18,2), @Suggested decimal(18,2),
                @MaPhieuChi bigint, @Remaining decimal(18,2), @Available decimal(18,2),
                @MaHoaDon nvarchar(20), @DateIn date;
        SELECT @DateIn = NgayVao FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaChiTiet = @MaChiTiet;
        IF @DateIn IS NULL
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet;
            THROW 51935, N''Không tìm thấy thành viên hợp đồng.'', 1;
        END;
        IF @NgayRa < @DateIn
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @DateIn AS NgayVao, @NgayRa AS NgayRa;
            THROW 51936, N''Ngày ra không được trước ngày vào.'', 1;
        END;
        EXEC dbo.sp_TinhGoiYHoanTien
            @MaChiTiet = @MaChiTiet, @KhauTru = @KhauTru, @NgayRa = @NgayRa,
            @SoThangDaSuDung = @SoThang OUTPUT, @TienSuDung = @Used OUTPUT,
            @SoTienDaDong = @Paid OUTPUT, @SoTienDaHoan = @Refunded OUTPUT,
            @GoiYHoan = @Suggested OUTPUT;
        IF @SoTien IS NULL SET @SoTien = @Suggested;
        IF @SoTien <= 0
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @Suggested AS GoiYHoan, @SoTien AS SoTien;
            THROW 51937, N''Không có số dư hoàn tiền dương.'', 1;
        END;
        IF @SoTien > @Suggested
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @Suggested AS GoiYHoan, @SoTien AS SoTien;
            THROW 51938, N''Số tiền hoàn không được vượt số tiền gợi ý.'', 1;
        END;
        IF @LyDo NOT IN (N''Nghỉ học giữa chừng'', N''Chuyển đi'', N''Khác'')
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @LyDo AS LyDo;
            THROW 51939, N''Lý do hoàn tiền không hợp lệ.'', 1;
        END;
        IF @SoTien <> @Suggested AND NULLIF(LTRIM(RTRIM(@GhiChu)), N'''') IS NULL
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @Suggested AS GoiYHoan, @SoTien AS SoTien;
            THROW 51940, N''Sửa số tiền gợi ý phải ghi lý do trong GhiChu.'', 1;
        END;

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
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) paid
        OUTER APPLY (
            SELECT SUM(ph.SoTien) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) spent
        WHERE hd.MaChiTiet = @MaChiTiet AND hd.LoaiHoaDon = N''TIEN_PHONG''
          AND hd.TrangThaiThanhToan <> N''Đã hủy''
          AND ISNULL(paid.DaThu, 0) > ISNULL(spent.DaChi, 0);

        IF @SoTien > ISNULL((SELECT SUM(SoDu) FROM @InvoiceBalance), 0)
        BEGIN
            SELECT @MaChiTiet AS MaChiTiet, @SoTien AS SoTien,
                   ISNULL((SELECT SUM(SoDu) FROM @InvoiceBalance), 0) AS SoDuConLai;
            THROW 51941, N''Tổng hoàn vượt tiền thu hợp lệ còn lại trên các hóa đơn.'', 1;
        END;

        INSERT INTO dbo.PhieuChi
            (MaChiTiet, SoTienDaDong, SoTienDaSuDung, KhauTru, SoTien,
             NgayRa, LyDo, TrangThai, NguoiLap, GhiChu)
        VALUES
            (@MaChiTiet, @Paid, @Used, @KhauTru, @SoTien, @NgayRa,
             @LyDo, N''Chờ duyệt'', @NguoiLap,
             CASE WHEN @SoTien <> @Suggested
                  THEN N''Gợi ý '' + CONVERT(nvarchar(30), @Suggested) + N''; '' + @GhiChu
                  ELSE @GhiChu END);
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

        UPDATE dbo.PhieuChi SET TrangThai = N''Hợp lệ'' WHERE MaPhieuChi = @MaPhieuChi;
        COMMIT TRANSACTION;
        SELECT @MaPhieuChi AS MaPhieuChi, @SoTien AS SoTien,
               @Suggested AS GoiYBanDau, @SoThang AS SoThangDaSuDung;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_HoaDonTongHop
AS
SELECT hd.MaHoaDon, hd.MaSinhVien, sv.HoTen, hd.TenPhong, hd.NgayLap,
       MONTH(hd.NgayLap) AS Thang, YEAR(hd.NgayLap) AS Nam,
       hd.HanThanhToan, hd.LoaiHoaDon, hd.MaHopDong, hd.MaChiTiet,
       hd.KyThanhToan, hd.KyThanhToanDen,
       hd.TrangThaiThanhToan,
       hd.TongTien AS TongTienCotTinh,
       ISNULL(total.TongThuc, 0) AS TongThuc,
       ISNULL(received.DaThu, 0) AS DaThu,
       ISNULL(total.TongThuc, 0) - ISNULL(received.DaThu, 0) AS ConNo,
       ISNULL(lines.SoHangMuc, 0) AS SoHangMuc,
       CASE
           WHEN hd.TrangThaiThanhToan = N''Đã hủy'' THEN N''CANCELLED''
           WHEN ISNULL(received.DaThu, 0) >= ISNULL(total.TongThuc, 0)
                AND ISNULL(total.TongThuc, 0) > 0 THEN N''PAID''
           WHEN ISNULL(received.DaThu, 0) > 0 THEN N''PARTIAL''
           WHEN hd.HanThanhToan < CAST(GETDATE() AS date)
                AND hd.HanThanhToan IS NOT NULL THEN N''OVERDUE''
           ELSE N''UNPAID''
       END AS TrangThaiSuyRa
FROM dbo.HoaDon hd
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
OUTER APPLY (
    SELECT SUM(c.SoTien) AS TongThuc, COUNT(*) AS SoHangMuc
    FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
) total
OUTER APPLY (
    SELECT SUM(pt.SoTien) AS DaThu
    FROM dbo.PhieuThu pt
    WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
) received
OUTER APPLY (
    SELECT COUNT(*) AS SoHangMuc FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
) lines;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
SELECT hd.MaSinhVien, sv.HoTen, hd.TenPhong,
       SUM(v.ConNo) AS TongCongNo,
       SUM(CASE WHEN v.TrangThaiSuyRa = N''OVERDUE'' THEN v.ConNo ELSE 0 END) AS CongNoQuaHan,
       COUNT(*) AS SoHoaDon
FROM dbo.vw_HoaDonTongHop v
INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = v.MaHoaDon
LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
WHERE v.ConNo > 0 AND hd.TrangThaiThanhToan <> N''Đã hủy''
GROUP BY hd.MaSinhVien, sv.HoTen, hd.TenPhong;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_DoanhThuThang
AS
WITH receipt_totals AS (
    SELECT YEAR(pt.NgayThu) AS Nam, MONTH(pt.NgayThu) AS Thang,
           SUM(CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN pt.SoTien ELSE 0 END) AS ThuTienPhong,
           SUM(CASE WHEN hd.LoaiHoaDon <> N''TIEN_PHONG'' THEN pt.SoTien ELSE 0 END) AS ThuDichVuKhac,
           SUM(pt.SoTien) AS TongThu
    FROM dbo.PhieuThu pt
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
    WHERE pt.TrangThai = N''Hợp lệ''
    GROUP BY YEAR(pt.NgayThu), MONTH(pt.NgayThu)
),
refund_totals AS (
    SELECT YEAR(pc.NgayChi) AS Nam, MONTH(pc.NgayChi) AS Thang,
           SUM(CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN pha.SoTien ELSE 0 END) AS ChiTienPhong,
           SUM(CASE WHEN hd.LoaiHoaDon <> N''TIEN_PHONG'' THEN pha.SoTien ELSE 0 END) AS ChiKhac,
           SUM(pha.SoTien) AS TongChi
    FROM dbo.PhieuChi pc
    INNER JOIN dbo.PhieuChi_HoaDon pha ON pha.MaPhieuChi = pc.MaPhieuChi
    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pha.MaHoaDon
    WHERE pc.TrangThai = N''Hợp lệ''
    GROUP BY YEAR(pc.NgayChi), MONTH(pc.NgayChi)
)
SELECT COALESCE(r.Nam, c.Nam) AS Nam, COALESCE(r.Thang, c.Thang) AS Thang,
       ISNULL(r.ThuTienPhong, 0) - ISNULL(c.ChiTienPhong, 0) AS DoanhThuTienPhong,
       ISNULL(r.ThuDichVuKhac, 0) - ISNULL(c.ChiKhac, 0) AS DoanhThuDienNuocKhac,
       ISNULL(r.TongThu, 0) AS TongThu,
       ISNULL(c.TongChi, 0) AS TongChi,
       ISNULL(r.TongThu, 0) - ISNULL(c.TongChi, 0) AS TongDoanhThu
FROM receipt_totals r
FULL OUTER JOIN refund_totals c ON c.Nam = r.Nam AND c.Thang = r.Thang;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'019', N'019_payment_workflows.sql');

        COMMIT TRANSACTION;
        PRINT N'[019] Hoàn tất: chuyển đổi giao dịch, phiếu thu/chi, quy trình hóa đơn và báo cáo đã sẵn sàng.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
