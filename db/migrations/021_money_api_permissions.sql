SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
BEGIN
    ;THROW 52100, N'Chạy migration 001 trước.', 1;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'020')
BEGIN
    ;THROW 52101, N'Chạy migration 020 trước.', 1;
END;

IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'021')
BEGIN
    PRINT N'[021] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
            SELECT MaGiaoDich
            FROM dbo.PhieuThu
            WHERE MaGiaoDich IS NOT NULL
              AND TrangThai <> N'Đã hủy'
            GROUP BY MaGiaoDich
            HAVING COUNT_BIG(*) > 1
        )
        BEGIN
            SELECT MaGiaoDich, COUNT_BIG(*) AS SoPhieuThu
            FROM dbo.PhieuThu
            WHERE MaGiaoDich IS NOT NULL
              AND TrangThai <> N'Đã hủy'
            GROUP BY MaGiaoDich
            HAVING COUNT_BIG(*) > 1;
            ;THROW 52102, N'Có giao dịch đang liên kết với nhiều phiếu thu chưa hủy.', 1;
        END;

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.PhieuThu')
              AND name = N'UX_PhieuThu_MaGiaoDich_ChuaHuy'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE UNIQUE INDEX UX_PhieuThu_MaGiaoDich_ChuaHuy
                    ON dbo.PhieuThu(MaGiaoDich)
                    WHERE MaGiaoDich IS NOT NULL
                      AND TrangThai <> N''Đã hủy'';';
        END;

        IF COL_LENGTH(N'dbo.GiaoDichThanhToan', N'LyDoDoiSoat') IS NULL
        BEGIN
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.GiaoDichThanhToan
                ADD LyDoDoiSoat nvarchar(255) NULL;';
        END;

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan')
              AND name = N'CK_GiaoDich_TrangThai'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.GiaoDichThanhToan
                DROP CONSTRAINT CK_GiaoDich_TrangThai;';
        END;

        IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan')
              AND name = N'IX_GiaoDich_TrangThai_PhuongThuc'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                DROP INDEX IX_GiaoDich_TrangThai_PhuongThuc
                ON dbo.GiaoDichThanhToan;';
        END;

        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.GiaoDichThanhToan
            ALTER COLUMN TrangThai nvarchar(20) NOT NULL;';

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan')
              AND name = N'IX_GiaoDich_TrangThai_PhuongThuc'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE NONCLUSTERED INDEX IX_GiaoDich_TrangThai_PhuongThuc
                ON dbo.GiaoDichThanhToan (TrangThai, PhuongThuc);';
        END;

        IF NOT EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.GiaoDichThanhToan')
              AND name = N'CK_GiaoDich_TrangThai'
        )
        BEGIN
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.GiaoDichThanhToan WITH CHECK
                ADD CONSTRAINT CK_GiaoDich_TrangThai
                CHECK (TrangThai IN
                    (N''PENDING'', N''SUCCESS'', N''REJECTED'', N''EXPIRED'', N''RECONCILIATION''));';
        END;

        EXEC sys.sp_executesql N'
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
                @LyDo nvarchar(255);

        SELECT @MaHoaDon = pt.MaHoaDon, @MaGiaoDich = pt.MaGiaoDich,
               @TrangThai = pt.TrangThai, @SoTien = pt.SoTien
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        WHERE pt.MaPhieuThu = @MaPhieuThu;

        IF @MaHoaDon IS NULL
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52103, N''Không tìm thấy phiếu thu.'', 1;
        END;
        IF @TrangThai <> N''Chờ xác nhận''
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu, @TrangThai AS TrangThai;
            THROW 52104, N''Chỉ xác nhận được phiếu thu đang chờ xác nhận.'', 1;
        END;

        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;

        SELECT @TongHoaDon = ISNULL(SUM(c.SoTien), 0)
        FROM dbo.ChiTietHoaDon c
        WHERE c.MaHoaDon = @MaHoaDon;
        SELECT @DaThu = ISNULL(SUM(pt.SoTien), 0)
        FROM dbo.PhieuThu pt
        WHERE pt.MaHoaDon = @MaHoaDon
          AND pt.TrangThai = N''Hợp lệ''
          AND pt.MaPhieuThu <> @MaPhieuThu;

        IF @DaThu + @SoTien > @TongHoaDon
        BEGIN
            SET @LyDo = N''Tổng thu hợp lệ đã thay đổi; xác nhận phiếu sẽ vượt tổng hóa đơn.'';
            IF @MaGiaoDich IS NOT NULL
            BEGIN
                UPDATE dbo.GiaoDichThanhToan
                SET TrangThai = N''RECONCILIATION'',
                    LyDoDoiSoat = @LyDo,
                    MaThamChieuNgoai = COALESCE(@MaThamChieuNgoai, MaThamChieuNgoai)
                WHERE MaGiaoDich = @MaGiaoDich
                  AND TrangThai IN (N''PENDING'', N''RECONCILIATION'');
            END;

            INSERT INTO dbo.NhatKyHeThong
                (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
            VALUES
                (@NguoiXacNhan, N''Cần đối soát phiếu thu'', N''PhieuThu'',
                 CONVERT(nvarchar(60), @MaPhieuThu), @LyDo);

            COMMIT TRANSACTION;
            SELECT @MaPhieuThu AS MaPhieuThu, N''RECONCILIATION'' AS TrangThaiGiaoDich,
                   @LyDo AS LyDoDoiSoat;
            RETURN;
        END;

        UPDATE dbo.PhieuThu
        SET TrangThai = N''Hợp lệ'',
            MaThamChieu = COALESCE(@MaThamChieuNgoai, MaThamChieu)
        WHERE MaPhieuThu = @MaPhieuThu
          AND TrangThai = N''Chờ xác nhận'';
        IF @@ROWCOUNT <> 1
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52105, N''Phiếu thu đã được xử lý bởi thao tác khác.'', 1;
        END;

        IF @MaGiaoDich IS NOT NULL
        BEGIN
            UPDATE dbo.GiaoDichThanhToan
            SET TrangThai = N''SUCCESS'',
                NgayThanhToan = GETDATE(),
                XacNhanBoi = COALESCE(@NguoiXacNhan, XacNhanBoi),
                MaThamChieuNgoai = COALESCE(@MaThamChieuNgoai, MaThamChieuNgoai),
                LyDoDoiSoat = NULL
            WHERE MaGiaoDich = @MaGiaoDich
              AND TrangThai IN (N''PENDING'', N''RECONCILIATION'');
        END;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiXacNhan, N''Xác nhận phiếu thu'', N''PhieuThu'',
             CONVERT(nvarchar(60), @MaPhieuThu), N''Phiếu thu chuyển sang Hợp lệ.'');

        COMMIT TRANSACTION;
        SELECT @MaPhieuThu AS MaPhieuThu, N''Hợp lệ'' AS TrangThaiPhieuThu,
               N''SUCCESS'' AS TrangThaiGiaoDich, CAST(NULL AS nvarchar(255)) AS LyDoDoiSoat;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;';

        EXEC sys.sp_executesql N'
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
                @TrangThai nvarchar(20);
        SELECT @MaHoaDon = pt.MaHoaDon, @MaGiaoDich = pt.MaGiaoDich,
               @TrangThai = pt.TrangThai
        FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
        WHERE pt.MaPhieuThu = @MaPhieuThu;

        IF @MaHoaDon IS NULL
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52103, N''Không tìm thấy phiếu thu.'', 1;
        END;
        IF @TrangThai <> N''Chờ xác nhận''
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu, @TrangThai AS TrangThai;
            THROW 52104, N''Chỉ hủy được phiếu thu đang chờ xác nhận.'', 1;
        END;

        SELECT @MaHoaDon = hd.MaHoaDon
        FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
        WHERE hd.MaHoaDon = @MaHoaDon;

        UPDATE dbo.PhieuThu
        SET TrangThai = N''Đã hủy'',
            GhiChu = COALESCE(NULLIF(LTRIM(RTRIM(@LyDo)), N''''), GhiChu)
        WHERE MaPhieuThu = @MaPhieuThu
          AND TrangThai = N''Chờ xác nhận'';
        IF @@ROWCOUNT <> 1
        BEGIN
            SELECT @MaPhieuThu AS MaPhieuThu;
            THROW 52105, N''Phiếu thu đã được xử lý bởi thao tác khác.'', 1;
        END;

        IF @MaGiaoDich IS NOT NULL
        BEGIN
            UPDATE dbo.GiaoDichThanhToan
            SET TrangThai = N''REJECTED'',
                LyDoTuChoi = COALESCE(NULLIF(LTRIM(RTRIM(@LyDo)), N''''), LyDoTuChoi),
                LyDoDoiSoat = NULL
            WHERE MaGiaoDich = @MaGiaoDich
              AND TrangThai IN (N''PENDING'', N''RECONCILIATION'');
        END;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiThucHien, N''Hủy phiếu thu chờ'', N''PhieuThu'',
             CONVERT(nvarchar(60), @MaPhieuThu), COALESCE(@LyDo, N''Hủy phiếu thu chờ xác nhận.''));

        COMMIT TRANSACTION;
        SELECT @MaPhieuThu AS MaPhieuThu, N''Đã hủy'' AS TrangThaiPhieuThu,
               N''REJECTED'' AS TrangThaiGiaoDich;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;';

        DECLARE @PrincipalExists bit = 0;
        EXEC sys.sp_executesql
            N'SELECT @PrincipalExists = CASE WHEN DATABASE_PRINCIPAL_ID(N''DNKTX'') IS NULL THEN 0 ELSE 1 END;',
            N'@PrincipalExists bit OUTPUT',
            @PrincipalExists = @PrincipalExists OUTPUT;

        IF @PrincipalExists = 1
        BEGIN
            EXEC sys.sp_executesql N'
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonTienPhong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonDichVuPhong TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoHoaDonPhatSinh TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_GhiPhieuThu TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_TinhGoiYHoanTien TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_TaoPhieuChi TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_XacNhanPhieuThu TO [DNKTX];
                GRANT EXECUTE ON OBJECT::dbo.sp_HuyPhieuThu TO [DNKTX];';

            INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
            VALUES (N'021', N'021_money_api_permissions.sql');
        END;

        COMMIT TRANSACTION;
        IF @PrincipalExists = 1
            PRINT N'[021] Đã thêm đối soát phiếu thu, chống ghi trùng giao dịch và quyền EXECUTE thanh toán.';
        ELSE
            PRINT N'[021] Đã cập nhật schema/procedure; bỏ qua GRANT và chưa ghi ledger vì user DNKTX chưa tồn tại.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
