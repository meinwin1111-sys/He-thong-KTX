SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51600, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'015')
    THROW 51601, N'Chạy migration 015 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'016')
    PRINT N'[016] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF COL_LENGTH(N'dbo.HoaDon', N'MaHopDong') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD MaHopDong nvarchar(20) NULL;';
        IF COL_LENGTH(N'dbo.HoaDon', N'MaChiTiet') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD MaChiTiet int NULL;';
        IF COL_LENGTH(N'dbo.HoaDon', N'KyThanhToan') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD KyThanhToan date NULL;';
        IF COL_LENGTH(N'dbo.HoaDon', N'KyThanhToanDen') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ADD KyThanhToanDen date NULL;';

        EXEC sys.sp_executesql N'ALTER TABLE dbo.HoaDon ALTER COLUMN MaSinhVien nvarchar(30) NULL;';

        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'MaDichVu') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.ChiTietHoaDon ADD MaDichVu nvarchar(20) NULL;';
        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'ChiSoCu') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.ChiTietHoaDon ADD ChiSoCu int NULL;';
        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'ChiSoMoi') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.ChiTietHoaDon ADD ChiSoMoi int NULL;';
        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'SoLuong') IS NULL
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.ChiTietHoaDon ADD SoLuong decimal(18,3) NOT NULL
                    CONSTRAINT DF_ChiTietHoaDon_SoLuong DEFAULT (1) WITH VALUES;';
        IF COL_LENGTH(N'dbo.ChiTietHoaDon', N'DonGia') IS NULL
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.ChiTietHoaDon ADD DonGia decimal(18,2) NOT NULL
                    CONSTRAINT DF_ChiTietHoaDon_DonGia DEFAULT (0) WITH VALUES;';

        EXEC sys.sp_executesql N'
            UPDATE dbo.ChiTietHoaDon
            SET DonGia = SoTien
            WHERE DonGia = 0 AND SoTien > 0;';

        DECLARE @ConstraintName sysname, @Sql nvarchar(max);
        DECLARE invoice_checks CURSOR LOCAL FAST_FORWARD FOR
            SELECT cc.name
            FROM sys.check_constraints cc
            WHERE cc.parent_object_id = OBJECT_ID(N'dbo.HoaDon')
              AND (cc.definition LIKE N'%LoaiHoaDon%'
                   OR cc.definition LIKE N'%TrangThaiThanhToan%'
                   OR cc.definition LIKE N'%KyThanhToan%');
        OPEN invoice_checks;
        FETCH NEXT FROM invoice_checks INTO @ConstraintName;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @Sql = N'ALTER TABLE dbo.HoaDon DROP CONSTRAINT ' + QUOTENAME(@ConstraintName) + N';';
            EXEC sys.sp_executesql @Sql;
            FETCH NEXT FROM invoice_checks INTO @ConstraintName;
        END;
        CLOSE invoice_checks;
        DEALLOCATE invoice_checks;

        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon
            WHERE LoaiHoaDon IS NULL
               OR LoaiHoaDon NOT IN (N'TIEN_PHONG', N'DICH_VU_PHONG', N'PHAT_SINH', N'CU')
        )
        BEGIN
            SELECT MaHoaDon, LoaiHoaDon
            FROM dbo.HoaDon
            WHERE LoaiHoaDon IS NULL
               OR LoaiHoaDon NOT IN (N'TIEN_PHONG', N'DICH_VU_PHONG', N'PHAT_SINH', N'CU');
            THROW 51602, N'Có loại hóa đơn không hợp lệ trước khi cập nhật CHECK.', 1;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon
            WHERE TrangThaiThanhToan IS NOT NULL
              AND TrangThaiThanhToan NOT IN
                  (N'Chưa thanh toán', N'Thanh toán một phần', N'Đã thanh toán', N'Đã hủy')
        )
        BEGIN
            SELECT MaHoaDon, TrangThaiThanhToan
            FROM dbo.HoaDon
            WHERE TrangThaiThanhToan IS NOT NULL
              AND TrangThaiThanhToan NOT IN
                  (N'Chưa thanh toán', N'Thanh toán một phần', N'Đã thanh toán', N'Đã hủy');
            THROW 51603, N'Có trạng thái hóa đơn không hợp lệ trước khi cập nhật CHECK.', 1;
        END;

        EXEC sys.sp_executesql N'
            IF EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''FK_HoaDon_HopDong''
            )
                ALTER TABLE dbo.HoaDon DROP CONSTRAINT FK_HoaDon_HopDong;
            IF EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''FK_HoaDon_ChiTietHopDong''
            )
                ALTER TABLE dbo.HoaDon DROP CONSTRAINT FK_HoaDon_ChiTietHopDong;

            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT FK_HoaDon_HopDong
                FOREIGN KEY (MaHopDong) REFERENCES dbo.HopDong(MaHopDong);
            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT FK_HoaDon_ChiTietHopDong
                FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHopDong(MaChiTiet);

            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT CK_HoaDon_LoaiHoaDon
                CHECK (LoaiHoaDon IN (N''TIEN_PHONG'', N''DICH_VU_PHONG'', N''PHAT_SINH'', N''CU''));
            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT CK_HoaDon_TrangThaiThanhToan
                CHECK (TrangThaiThanhToan IN
                    (N''Chưa thanh toán'', N''Thanh toán một phần'', N''Đã thanh toán'', N''Đã hủy''));
            ALTER TABLE dbo.HoaDon WITH CHECK ADD CONSTRAINT CK_HoaDon_KyThanhToan
                CHECK (
                    (LoaiHoaDon = N''CU'')
                    OR (KyThanhToan IS NOT NULL AND KyThanhToanDen IS NOT NULL
                        AND KyThanhToanDen >= KyThanhToan)
                );';

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.ChiTietHoaDon'')
                  AND name = N''FK_ChiTietHoaDon_DichVu''
            )
                ALTER TABLE dbo.ChiTietHoaDon WITH CHECK
                    ADD CONSTRAINT FK_ChiTietHoaDon_DichVu
                    FOREIGN KEY (MaDichVu) REFERENCES dbo.DichVu(MaDichVu);

            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE parent_object_id = OBJECT_ID(N''dbo.ChiTietHoaDon'')
                  AND name = N''CK_ChiTietHoaDon_SoLuongDonGia''
            )
                ALTER TABLE dbo.ChiTietHoaDon WITH CHECK
                    ADD CONSTRAINT CK_ChiTietHoaDon_SoLuongDonGia
                    CHECK (SoLuong > 0 AND DonGia >= 0);

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''UX_HoaDon_TienPhong_ChiTiet_Ky''
            )
                CREATE UNIQUE INDEX UX_HoaDon_TienPhong_ChiTiet_Ky
                    ON dbo.HoaDon(MaChiTiet, KyThanhToan)
                    WHERE LoaiHoaDon = N''TIEN_PHONG''
                      AND TrangThaiThanhToan <> N''Đã hủy''
                      AND MaChiTiet IS NOT NULL AND KyThanhToan IS NOT NULL;

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''UX_HoaDon_DichVuPhong_HopDong_Ky''
            )
                CREATE UNIQUE INDEX UX_HoaDon_DichVuPhong_HopDong_Ky
                    ON dbo.HoaDon(MaHopDong, KyThanhToan)
                    WHERE LoaiHoaDon = N''DICH_VU_PHONG''
                      AND TrangThaiThanhToan <> N''Đã hủy''
                      AND MaHopDong IS NOT NULL AND KyThanhToan IS NOT NULL;';

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''IX_HoaDon_MaChiTiet_Ky''
            )
                CREATE INDEX IX_HoaDon_MaChiTiet_Ky
                    ON dbo.HoaDon(MaChiTiet, KyThanhToan, KyThanhToanDen)
                    INCLUDE (LoaiHoaDon, TrangThaiThanhToan, MaHoaDon);
            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID(N''dbo.HoaDon'')
                  AND name = N''IX_HoaDon_MaHopDong_Ky''
            )
                CREATE INDEX IX_HoaDon_MaHopDong_Ky
                    ON dbo.HoaDon(MaHopDong, KyThanhToan, KyThanhToanDen)
                    INCLUDE (LoaiHoaDon, TrangThaiThanhToan, MaHoaDon);';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'016', N'016_invoice_periods_and_details.sql');

        COMMIT TRANSACTION;
        PRINT N'[016] Hoàn tất: loại hóa đơn, kỳ, liên kết hợp đồng/thành viên và snapshot chi tiết sẵn sàng.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
