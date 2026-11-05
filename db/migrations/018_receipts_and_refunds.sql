SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51800, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'017')
    THROW 51801, N'Chạy migration 017 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'018')
    PRINT N'[018] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        EXEC sys.sp_executesql N'
            CREATE TABLE dbo.PhieuThu
            (
                MaPhieuThu bigint IDENTITY(1,1) NOT NULL
                    CONSTRAINT PK_PhieuThu PRIMARY KEY,
                MaHoaDon nvarchar(20) NOT NULL,
                MaGiaoDich nvarchar(60) NULL,
                SoTien decimal(18,2) NOT NULL,
                NgayThu datetime NOT NULL
                    CONSTRAINT DF_PhieuThu_NgayThu DEFAULT (GETDATE()),
                PhuongThuc nvarchar(20) NOT NULL,
                MaSinhVienNop nvarchar(30) NULL,
                NguoiThu int NULL,
                TrangThai nvarchar(20) NOT NULL
                    CONSTRAINT DF_PhieuThu_TrangThai DEFAULT (N''Hợp lệ''),
                MaThamChieu nvarchar(100) NULL,
                GhiChu nvarchar(255) NULL,
                NgayTao datetime NOT NULL
                    CONSTRAINT DF_PhieuThu_NgayTao DEFAULT (GETDATE()),
                CONSTRAINT FK_PhieuThu_HoaDon
                    FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon(MaHoaDon),
                CONSTRAINT FK_PhieuThu_GiaoDich
                    FOREIGN KEY (MaGiaoDich) REFERENCES dbo.GiaoDichThanhToan(MaGiaoDich),
                CONSTRAINT FK_PhieuThu_SinhVienNop
                    FOREIGN KEY (MaSinhVienNop) REFERENCES dbo.SinhVien(MaSinhVien),
                CONSTRAINT FK_PhieuThu_NguoiThu
                    FOREIGN KEY (NguoiThu) REFERENCES dbo.TaiKhoan(MaTaiKhoan),
                CONSTRAINT CK_PhieuThu_SoTien CHECK (SoTien > 0),
                CONSTRAINT CK_PhieuThu_PhuongThuc
                    CHECK (PhuongThuc IN (N''CASH'', N''ONLINE'', N''CHUYEN_DOI'')),
                CONSTRAINT CK_PhieuThu_TrangThai
                    CHECK (TrangThai IN (N''Hợp lệ'', N''Chờ xác nhận'', N''Đã hủy''))
            );

            CREATE UNIQUE INDEX UX_PhieuThu_GiaoDich_HoaDon
                ON dbo.PhieuThu(MaGiaoDich, MaHoaDon)
                WHERE MaGiaoDich IS NOT NULL;
            CREATE INDEX IX_PhieuThu_HoaDon_TrangThai_NgayThu
                ON dbo.PhieuThu(MaHoaDon, TrangThai, NgayThu)
                INCLUDE (SoTien, MaGiaoDich);

            CREATE TABLE dbo.PhieuChi
            (
                MaPhieuChi bigint IDENTITY(1,1) NOT NULL
                    CONSTRAINT PK_PhieuChi PRIMARY KEY,
                MaChiTiet int NOT NULL,
                SoTienDaDong decimal(18,2) NOT NULL,
                SoTienDaSuDung decimal(18,2) NOT NULL,
                KhauTru decimal(18,2) NOT NULL
                    CONSTRAINT DF_PhieuChi_KhauTru DEFAULT (0),
                SoTien decimal(18,2) NOT NULL,
                NgayRa date NOT NULL,
                LyDo nvarchar(30) NOT NULL,
                NgayChi datetime NOT NULL
                    CONSTRAINT DF_PhieuChi_NgayChi DEFAULT (GETDATE()),
                TrangThai nvarchar(20) NOT NULL
                    CONSTRAINT DF_PhieuChi_TrangThai DEFAULT (N''Chờ duyệt''),
                NguoiLap int NULL,
                GhiChu nvarchar(255) NULL,
                NgayTao datetime NOT NULL
                    CONSTRAINT DF_PhieuChi_NgayTao DEFAULT (GETDATE()),
                CONSTRAINT FK_PhieuChi_ChiTiet
                    FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHopDong(MaChiTiet),
                CONSTRAINT FK_PhieuChi_NguoiLap
                    FOREIGN KEY (NguoiLap) REFERENCES dbo.TaiKhoan(MaTaiKhoan),
                CONSTRAINT CK_PhieuChi_SoTien
                    CHECK (SoTien > 0 AND SoTienDaDong >= 0 AND SoTienDaSuDung >= 0 AND KhauTru >= 0),
                CONSTRAINT CK_PhieuChi_LyDo
                    CHECK (LyDo IN (N''Nghỉ học giữa chừng'', N''Chuyển đi'', N''Khác'')),
                CONSTRAINT CK_PhieuChi_TrangThai
                    CHECK (TrangThai IN (N''Hợp lệ'', N''Chờ duyệt'', N''Đã hủy''))
            );

            CREATE INDEX IX_PhieuChi_ChiTiet_TrangThai
                ON dbo.PhieuChi(MaChiTiet, TrangThai, NgayChi)
                INCLUDE (SoTien, SoTienDaDong, SoTienDaSuDung, KhauTru);

            CREATE TABLE dbo.PhieuChi_HoaDon
            (
                MaPhieuChi bigint NOT NULL,
                MaHoaDon nvarchar(20) NOT NULL,
                SoTien decimal(18,2) NOT NULL,
                CONSTRAINT PK_PhieuChi_HoaDon PRIMARY KEY (MaPhieuChi, MaHoaDon),
                CONSTRAINT FK_PhieuChi_HoaDon_PhieuChi
                    FOREIGN KEY (MaPhieuChi) REFERENCES dbo.PhieuChi(MaPhieuChi),
                CONSTRAINT FK_PhieuChi_HoaDon_HoaDon
                    FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon(MaHoaDon),
                CONSTRAINT CK_PhieuChi_HoaDon_SoTien CHECK (SoTien > 0)
            );
            CREATE INDEX IX_PhieuChi_HoaDon_HoaDon
                ON dbo.PhieuChi_HoaDon(MaHoaDon, MaPhieuChi)
                INCLUDE (SoTien);';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_PhieuThu_GiuTong
ON dbo.PhieuThu
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HoaDon TABLE (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT MaHoaDon FROM inserted
    UNION
    SELECT MaHoaDon FROM deleted;

    DECLARE @MaHoaDon nvarchar(20);
    DECLARE lock_invoice CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHoaDon FROM @HoaDon ORDER BY MaHoaDon;
    OPEN lock_invoice;
    FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    END;
    CLOSE lock_invoice;
    DEALLOCATE lock_invoice;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE r.DaThu > t.TongHoaDon
           OR (hd.TrangThaiThanhToan = N''Đã hủy'' AND r.DaThu > 0)
    )
    BEGIN
        SELECT hd.MaHoaDon, hd.TrangThaiThanhToan, t.TongHoaDon, r.DaThu
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE r.DaThu > t.TongHoaDon
           OR (hd.TrangThaiThanhToan = N''Đã hủy'' AND r.DaThu > 0);
        THROW 51802, N''Tổng phiếu thu hợp lệ vượt tổng hóa đơn hoặc hóa đơn đã hủy.'', 1;
    END;

    UPDATE hd
    SET TrangThaiThanhToan = CASE
            WHEN hd.TrangThaiThanhToan = N''Đã hủy'' THEN N''Đã hủy''
            WHEN r.DaThu = 0 THEN N''Chưa thanh toán''
            WHEN r.DaThu < t.TongHoaDon THEN N''Thanh toán một phần''
            ELSE N''Đã thanh toán''
        END,
        NgayThanhToan = CASE
            WHEN r.DaThu > 0 AND r.DaThu >= t.TongHoaDon THEN COALESCE(hd.NgayThanhToan, GETDATE())
            ELSE NULL
        END
    FROM dbo.HoaDon hd
    INNER JOIN @HoaDon x ON x.MaHoaDon = hd.MaHoaDon
    CROSS APPLY (
        SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
        FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
    ) t
    CROSS APPLY (
        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
        FROM dbo.PhieuThu pt
        WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
    ) r
    WHERE hd.TrangThaiThanhToan <> N''Đã hủy''
      AND (
          hd.TrangThaiThanhToan <> CASE
              WHEN r.DaThu = 0 THEN N''Chưa thanh toán''
              WHEN r.DaThu < t.TongHoaDon THEN N''Thanh toán một phần''
              ELSE N''Đã thanh toán'' END
          OR (r.DaThu > 0 AND r.DaThu >= t.TongHoaDon AND hd.NgayThanhToan IS NULL)
          OR (r.DaThu < t.TongHoaDon AND hd.NgayThanhToan IS NOT NULL)
      );
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HoaDon_BaoVePhieuThu
ON dbo.HoaDon
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = i.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = i.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE i.LoaiHoaDon <> N''CU''
          AND i.TrangThaiThanhToan <> N''Đã hủy''
          AND i.TrangThaiThanhToan <> CASE
              WHEN r.DaThu = 0 THEN N''Chưa thanh toán''
              WHEN r.DaThu < t.TongHoaDon THEN N''Thanh toán một phần''
              ELSE N''Đã thanh toán'' END
    )
    BEGIN
        SELECT i.MaHoaDon, i.TrangThaiThanhToan AS TrangThaiMoi,
               t.TongHoaDon, r.DaThu
        FROM inserted i
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = i.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = i.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE i.LoaiHoaDon <> N''CU''
          AND i.TrangThaiThanhToan <> N''Đã hủy''
          AND i.TrangThaiThanhToan <> CASE
              WHEN r.DaThu = 0 THEN N''Chưa thanh toán''
              WHEN r.DaThu < t.TongHoaDon THEN N''Thanh toán một phần''
              ELSE N''Đã thanh toán'' END;
        THROW 51810, N''Trạng thái hóa đơn mới phải được suy ra từ phiếu thu hợp lệ.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = i.MaHoaDon
        WHERE i.TrangThaiThanhToan = N''Đã hủy''
          AND d.TrangThaiThanhToan <> N''Đã hủy''
          AND pt.TrangThai = N''Hợp lệ''
    )
    BEGIN
        SELECT i.MaHoaDon, pt.MaPhieuThu, pt.SoTien, pt.TrangThai
        FROM inserted i
        INNER JOIN deleted d ON d.MaHoaDon = i.MaHoaDon
        INNER JOIN dbo.PhieuThu pt ON pt.MaHoaDon = i.MaHoaDon
        WHERE i.TrangThaiThanhToan = N''Đã hủy''
          AND d.TrangThaiThanhToan <> N''Đã hủy''
          AND pt.TrangThai = N''Hợp lệ'';
        THROW 51803, N''Không thể hủy hóa đơn còn phiếu thu hợp lệ.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiTietHoaDon_GiuTongThu
ON dbo.ChiTietHoaDon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HoaDon TABLE (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT MaHoaDon FROM inserted
    UNION
    SELECT MaHoaDon FROM deleted;

    DECLARE @MaHoaDon nvarchar(20);
    DECLARE lock_invoice CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHoaDon FROM @HoaDon ORDER BY MaHoaDon;
    OPEN lock_invoice;
    FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    END;
    CLOSE lock_invoice;
    DEALLOCATE lock_invoice;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE r.DaThu > t.TongHoaDon
    )
    BEGIN
        SELECT hd.MaHoaDon, hd.LoaiHoaDon, t.TongHoaDon, r.DaThu
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(c.SoTien), 0) AS TongHoaDon
            FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
        ) t
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        WHERE r.DaThu > t.TongHoaDon;
        THROW 51804, N''Không thể giảm/xóa chi tiết làm tổng hóa đơn thấp hơn số đã thu hợp lệ.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_PhieuChi_HoaDon
ON dbo.PhieuChi_HoaDon
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HoaDon TABLE (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT MaHoaDon FROM inserted
    UNION
    SELECT MaHoaDon FROM deleted;

    DECLARE @MaHoaDon nvarchar(20);
    DECLARE lock_invoice CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHoaDon FROM @HoaDon ORDER BY MaHoaDon;
    OPEN lock_invoice;
    FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    END;
    CLOSE lock_invoice;
    DEALLOCATE lock_invoice;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaHoaDon = hd.MaHoaDon
        INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
        INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
        WHERE pc.TrangThai = N''Hợp lệ''
          AND (hd.LoaiHoaDon <> N''TIEN_PHONG'' OR hd.MaChiTiet <> pc.MaChiTiet)
    )
    BEGIN
        SELECT hd.MaHoaDon, hd.LoaiHoaDon, hd.MaChiTiet AS ChiTietHoaDon,
               pc.MaPhieuChi, pc.MaChiTiet AS ChiTietHoan, ph.SoTien
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaHoaDon = hd.MaHoaDon
        INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
        WHERE pc.TrangThai = N''Hợp lệ''
          AND (hd.LoaiHoaDon <> N''TIEN_PHONG'' OR hd.MaChiTiet <> pc.MaChiTiet);
        THROW 51805, N''Phiếu chi chỉ được phân bổ vào hóa đơn tiền phòng của đúng thành viên.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT pc.MaPhieuChi, pc.SoTien,
                   ISNULL(SUM(ph.SoTien), 0) AS DaPhanBo
            FROM dbo.PhieuChi pc
            INNER JOIN (
                SELECT MaPhieuChi FROM inserted
                UNION
                SELECT MaPhieuChi FROM deleted
            ) x ON x.MaPhieuChi = pc.MaPhieuChi
            LEFT JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = pc.MaPhieuChi
            WHERE pc.TrangThai = N''Hợp lệ''
            GROUP BY pc.MaPhieuChi, pc.SoTien
        ) x
        WHERE x.DaPhanBo <> x.SoTien
    )
    BEGIN
        SELECT pc.MaPhieuChi, pc.SoTien, ISNULL(SUM(ph.SoTien), 0) AS DaPhanBo
        FROM dbo.PhieuChi pc
        INNER JOIN (
            SELECT MaPhieuChi FROM inserted
            UNION
            SELECT MaPhieuChi FROM deleted
        ) x ON x.MaPhieuChi = pc.MaPhieuChi
        LEFT JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = pc.MaPhieuChi
        WHERE pc.TrangThai = N''Hợp lệ''
        GROUP BY pc.MaPhieuChi, pc.SoTien
        HAVING ISNULL(SUM(ph.SoTien), 0) <> pc.SoTien;
        THROW 51806, N''Tổng phân bổ hóa đơn phải bằng tổng phiếu chi hợp lệ.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        CROSS APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) c
        WHERE c.DaChi > r.DaThu
    )
    BEGIN
        SELECT hd.MaHoaDon, r.DaThu, c.DaChi
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        CROSS APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) c
        WHERE c.DaChi > r.DaThu;
        THROW 51807, N''Tổng phiếu chi hợp lệ vượt tổng phiếu thu hợp lệ của hóa đơn.'', 1;
    END;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_PhieuChi_BaoVe
ON dbo.PhieuChi
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HoaDon table (MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY);
    INSERT INTO @HoaDon(MaHoaDon)
    SELECT ph.MaHoaDon
    FROM dbo.PhieuChi_HoaDon ph
    INNER JOIN (
        SELECT MaPhieuChi FROM inserted
        UNION
        SELECT MaPhieuChi FROM deleted
    ) x ON x.MaPhieuChi = ph.MaPhieuChi;

    DECLARE @MaHoaDon nvarchar(20);
    DECLARE lock_invoice CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHoaDon FROM @HoaDon ORDER BY MaHoaDon;
    OPEN lock_invoice;
    FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;
        FETCH NEXT FROM lock_invoice INTO @MaHoaDon;
    END;
    CLOSE lock_invoice;
    DEALLOCATE lock_invoice;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        OUTER APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaPhanBo
            FROM dbo.PhieuChi_HoaDon ph WHERE ph.MaPhieuChi = i.MaPhieuChi
        ) a
        WHERE i.TrangThai = N''Hợp lệ'' AND a.DaPhanBo <> i.SoTien
    )
    BEGIN
        SELECT i.MaPhieuChi, i.SoTien, a.DaPhanBo
        FROM inserted i
        OUTER APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaPhanBo
            FROM dbo.PhieuChi_HoaDon ph WHERE ph.MaPhieuChi = i.MaPhieuChi
        ) a
        WHERE i.TrangThai = N''Hợp lệ'' AND a.DaPhanBo <> i.SoTien;
        THROW 51808, N''Phiếu chi hợp lệ phải có phân bổ bằng đúng tổng số tiền.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = i.MaPhieuChi
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = ph.MaHoaDon
        WHERE i.TrangThai = N''Hợp lệ''
          AND (hd.LoaiHoaDon <> N''TIEN_PHONG'' OR hd.MaChiTiet <> i.MaChiTiet)
    )
    BEGIN
        SELECT i.MaPhieuChi, i.MaChiTiet, hd.MaHoaDon, hd.LoaiHoaDon, hd.MaChiTiet AS MaChiTietHoaDon
        FROM inserted i
        INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = i.MaPhieuChi
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = ph.MaHoaDon
        WHERE i.TrangThai = N''Hợp lệ''
          AND (hd.LoaiHoaDon <> N''TIEN_PHONG'' OR hd.MaChiTiet <> i.MaChiTiet);
        THROW 51809, N''Phiếu chi hợp lệ chỉ được dùng cho hóa đơn tiền phòng cùng thành viên.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        CROSS APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) c
        WHERE c.DaChi > r.DaThu
    )
    BEGIN
        SELECT hd.MaHoaDon, r.DaThu, c.DaChi
        FROM @HoaDon x
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = x.MaHoaDon
        CROSS APPLY (
            SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
            FROM dbo.PhieuThu pt
            WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N''Hợp lệ''
        ) r
        CROSS APPLY (
            SELECT ISNULL(SUM(ph.SoTien), 0) AS DaChi
            FROM dbo.PhieuChi_HoaDon ph
            INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = ph.MaPhieuChi
            WHERE ph.MaHoaDon = hd.MaHoaDon AND pc.TrangThai = N''Hợp lệ''
        ) c
        WHERE c.DaChi > r.DaThu;
        THROW 51811, N''Tổng phiếu chi hợp lệ vượt tổng phiếu thu hợp lệ của hóa đơn.'', 1;
    END;
END;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'018', N'018_receipts_and_refunds.sql');

        COMMIT TRANSACTION;
        PRINT N'[018] Hoàn tất: phiếu thu, phiếu chi và phân bổ đã sẵn sàng.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
