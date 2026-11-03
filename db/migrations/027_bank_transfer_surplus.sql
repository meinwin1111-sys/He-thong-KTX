SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 52700, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 52701, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'026')
    THROW 52702, N'Chạy migration 026 trước.', 1;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'027')
BEGIN
    PRINT N'[027] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF COL_LENGTH(N'dbo.GiaoDichThanhToan', N'SoTienThucNhan') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.GiaoDichThanhToan
                ADD SoTienThucNhan decimal(18,2) NULL;';
        END;

        IF OBJECT_ID(N'dbo.HoanTienChuyenKhoanDu', N'U') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE TABLE dbo.HoanTienChuyenKhoanDu
                (
                    MaHoanTien bigint IDENTITY(1,1) NOT NULL
                        CONSTRAINT PK_HoanTienChuyenKhoanDu PRIMARY KEY,
                    MaGiaoDich nvarchar(60) NOT NULL,
                    MaHoaDon nvarchar(20) NOT NULL,
                    SoTien decimal(18,2) NOT NULL,
                    TrangThai nvarchar(20) NOT NULL
                        CONSTRAINT DF_HoanTienChuyenKhoanDu_TrangThai DEFAULT (N''CHO_HOAN''),
                    NguoiTra int NULL,
                    ThoiDiemTra datetime NULL,
                    GhiChu nvarchar(255) NULL,
                    NgayTao datetime NOT NULL
                        CONSTRAINT DF_HoanTienChuyenKhoanDu_NgayTao DEFAULT (GETDATE()),
                    CONSTRAINT UQ_HoanTienChuyenKhoanDu_MaGiaoDich UNIQUE (MaGiaoDich),
                    CONSTRAINT FK_HoanTienChuyenKhoanDu_GiaoDich
                        FOREIGN KEY (MaGiaoDich) REFERENCES dbo.GiaoDichThanhToan(MaGiaoDich),
                    CONSTRAINT FK_HoanTienChuyenKhoanDu_HoaDon
                        FOREIGN KEY (MaHoaDon) REFERENCES dbo.HoaDon(MaHoaDon),
                    CONSTRAINT FK_HoanTienChuyenKhoanDu_NguoiTra
                        FOREIGN KEY (NguoiTra) REFERENCES dbo.TaiKhoan(MaTaiKhoan),
                    CONSTRAINT CK_HoanTienChuyenKhoanDu_SoTien CHECK (SoTien > 0),
                    CONSTRAINT CK_HoanTienChuyenKhoanDu_TrangThai
                        CHECK (TrangThai IN (N''CHO_HOAN'', N''DA_HOAN'')),
                    CONSTRAINT CK_HoanTienChuyenKhoanDu_DaHoan
                        CHECK ((TrangThai = N''CHO_HOAN'' AND NguoiTra IS NULL AND ThoiDiemTra IS NULL)
                            OR (TrangThai = N''DA_HOAN'' AND NguoiTra IS NOT NULL AND ThoiDiemTra IS NOT NULL))
                );

                CREATE INDEX IX_HoanTienChuyenKhoanDu_HoaDon_TrangThai
                    ON dbo.HoanTienChuyenKhoanDu(MaHoaDon, TrangThai)
                    INCLUDE (SoTien, MaGiaoDich);';
        END;

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HoanTienChuyenKhoanDu_KhongHoanNguoc
ON dbo.HoanTienChuyenKhoanDu
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM deleted d
        LEFT JOIN inserted i ON i.MaHoanTien = d.MaHoanTien
        WHERE d.TrangThai = N''DA_HOAN''
          AND (i.MaHoanTien IS NULL OR i.TrangThai <> N''DA_HOAN'')
    )
        THROW 52703, N''Không thể xóa hoặc chuyển ngược khoản đã hoàn.'', 1;
END;';

        EXEC sys.sp_executesql N'
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
                @TrangThai nvarchar(20), @MaPhieuThu bigint;

        SELECT @MaHoanTien = h.MaHoanTien, @MaHoaDon = h.MaHoaDon,
               @SoTien = h.SoTien, @TrangThai = h.TrangThai
        FROM dbo.HoanTienChuyenKhoanDu h WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
            ON gd.MaGiaoDich = h.MaGiaoDich
        WHERE h.MaGiaoDich = @MaGiaoDich;

        IF @MaHoanTien IS NULL
            THROW 52704, N''Không tìm thấy khoản tiền dư đang chờ hoàn.'', 1;

        IF @TrangThai = N''DA_HOAN''
        BEGIN
            COMMIT TRANSACTION;
            SELECT @MaGiaoDich AS MaGiaoDich, @MaHoaDon AS MaHoaDon,
                   @SoTien AS SoTien, @TrangThai AS TrangThai, CAST(1 AS bit) AS DaXuLyTruoc;
            RETURN;
        END;

        SELECT TOP (1) @MaPhieuThu = pt.MaPhieuThu
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        WHERE pt.MaGiaoDich = @MaGiaoDich AND pt.TrangThai = N''Chờ xác nhận''
        ORDER BY pt.MaPhieuThu;

        IF @MaPhieuThu IS NOT NULL
            EXEC dbo.sp_HuyPhieuThu @MaPhieuThu, @NguoiTra,
                N''Giao dịch đối soát được trả lại toàn bộ số tiền thực nhận.'';

        UPDATE dbo.HoanTienChuyenKhoanDu
        SET TrangThai = N''DA_HOAN'',
            NguoiTra = @NguoiTra,
            ThoiDiemTra = GETDATE(),
            GhiChu = COALESCE(NULLIF(LTRIM(RTRIM(@GhiChu)), N''''), GhiChu)
        WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N''CHO_HOAN'';

        IF @@ROWCOUNT <> 1
            THROW 52705, N''Khoản tiền dư đã được xử lý bởi thao tác khác.'', 1;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiTra, N''Đã trả lại tiền chuyển khoản dư'', N''HoanTienChuyenKhoanDu'',
             @MaGiaoDich, CONCAT(N''Hóa đơn '', @MaHoaDon, N''; số tiền '', @SoTien, N'' đ.''));

        COMMIT TRANSACTION;
        SELECT @MaGiaoDich AS MaGiaoDich, @MaHoaDon AS MaHoaDon,
               @SoTien AS SoTien, N''DA_HOAN'' AS TrangThai, CAST(0 AS bit) AS DaXuLyTruoc;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_CongNo
AS
WITH invoice_totals AS (
    SELECT hd.MaHoaDon, hd.LoaiHoaDon, hd.TenPhong, hd.MaHopDong,
           CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN cthd.MaSinhVien
                WHEN hd.LoaiHoaDon = N''CU'' THEN hd.MaSinhVien END AS MaSinhVien,
           ISNULL(sv.HoTen, N'''') AS HoTen,
           ISNULL(v.TongThuc, 0) AS TongHoaDon,
           ISNULL(v.DaThu, 0) AS DaThu,
           ISNULL(v.ConNo, 0) AS ConNo,
           CASE WHEN v.TrangThaiSuyRa = N''OVERDUE''
                THEN ISNULL(v.ConNo, 0) ELSE 0 END AS CongNoQuaHan,
           ISNULL(surplus.TienDuChoHoan, 0) AS TienDuChoHoan
    FROM dbo.HoaDon hd
    INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
    LEFT JOIN dbo.ChiTietHopDong cthd
        ON hd.LoaiHoaDon = N''TIEN_PHONG'' AND cthd.MaChiTiet = hd.MaChiTiet
    LEFT JOIN dbo.SinhVien sv
        ON sv.MaSinhVien = CASE WHEN hd.LoaiHoaDon = N''TIEN_PHONG'' THEN cthd.MaSinhVien
                                WHEN hd.LoaiHoaDon = N''CU'' THEN hd.MaSinhVien END
    LEFT JOIN (
        SELECT MaHoaDon, SUM(SoTien) AS TienDuChoHoan
        FROM dbo.HoanTienChuyenKhoanDu
        WHERE TrangThai = N''CHO_HOAN''
        GROUP BY MaHoaDon
    ) surplus ON surplus.MaHoaDon = hd.MaHoaDon
    WHERE ISNULL(hd.TrangThaiThanhToan, N'''') <> N''Đã hủy''
)
SELECT LoaiHoaDon, TenPhong, MaHopDong, MaSinhVien,
       NULLIF(HoTen, N'''') AS HoTen,
       SUM(TongHoaDon) AS TongHoaDon,
       SUM(DaThu) AS DaThu,
       SUM(ConNo) AS TongCongNo,
       SUM(CongNoQuaHan) AS CongNoQuaHan,
       SUM(TienDuChoHoan) AS TienDuChoHoan,
       COUNT_BIG(*) AS SoHoaDon
FROM invoice_totals
WHERE ConNo > 0 OR TienDuChoHoan > 0
GROUP BY LoaiHoaDon, TenPhong, MaHopDong, MaSinhVien, HoTen;';

        DECLARE @PrincipalExists bit = 0;
        EXEC sys.sp_executesql
            N'SELECT @Exists = CASE WHEN DATABASE_PRINCIPAL_ID(N''DNKTX'') IS NULL THEN 0 ELSE 1 END;',
            N'@Exists bit OUTPUT',
            @Exists = @PrincipalExists OUTPUT;

        IF @PrincipalExists = 1
        BEGIN
            EXEC sys.sp_executesql N'
                GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.HoanTienChuyenKhoanDu TO [DNKTX];
                GRANT SELECT ON OBJECT::dbo.vw_CongNo TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_DanhDauHoanTienChuyenKhoanDu TO [DNKTX];';
        END;

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'027', N'027_bank_transfer_surplus.sql');

        COMMIT TRANSACTION;
        PRINT N'[027] Đã thêm số tiền thực nhận, quản lý tiền chuyển khoản dư và cập nhật công nợ.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
