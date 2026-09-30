SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
BEGIN
    RAISERROR(N'Chạy migration 001 trước.', 16, 1);
END
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'002')
BEGIN
    PRINT N'[002] Đã chạy trước đó — bỏ qua.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        /* ========== SinhVien ========== */
        IF COL_LENGTH(N'dbo.SinhVien', N'GhiChu') IS NULL
            ALTER TABLE dbo.SinhVien ADD GhiChu nvarchar(255) NULL;
        IF COL_LENGTH(N'dbo.SinhVien', N'Truong') IS NULL
            ALTER TABLE dbo.SinhVien ADD Truong nvarchar(150) NULL;
        IF COL_LENGTH(N'dbo.SinhVien', N'Lop') IS NULL
            ALTER TABLE dbo.SinhVien ADD Lop nvarchar(50) NULL;
        IF COL_LENGTH(N'dbo.SinhVien', N'NgayRoiKTX') IS NULL
            ALTER TABLE dbo.SinhVien ADD NgayRoiKTX date NULL;
        IF COL_LENGTH(N'dbo.SinhVien', N'NgayTao') IS NULL
            ALTER TABLE dbo.SinhVien ADD NgayTao datetime NULL CONSTRAINT DF_SinhVien_NgayTao DEFAULT (GETDATE());

        EXEC sys.sp_executesql N'
            UPDATE sv
            SET NgayRoiKTX = x.NgayKetThuc
            FROM dbo.SinhVien sv
            CROSS APPLY (
                SELECT TOP (1) hd.NgayKetThuc
                FROM dbo.HopDong hd
                WHERE hd.MaSinhVien = sv.MaSinhVien
                ORDER BY hd.NgayKetThuc DESC, hd.MaHopDong DESC
            ) x
            WHERE sv.TrangThaiSinhVien = N''Đã rời KTX''
              AND sv.NgayRoiKTX IS NULL;
        ';

        IF EXISTS (
            SELECT Email FROM dbo.SinhVien WHERE Email IS NOT NULL GROUP BY Email HAVING COUNT(*) > 1
        )
        BEGIN
            PRINT N'[002] CẢNH BÁO: SinhVien.Email đang trùng — không tạo UQ_SinhVien_Email. Xem db/audit.sql.';
        END
        ELSE IF NOT EXISTS (
            SELECT 1 FROM sys.indexes WHERE name = N'UQ_SinhVien_Email' AND object_id = OBJECT_ID(N'dbo.SinhVien')
        )
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE UNIQUE NONCLUSTERED INDEX UQ_SinhVien_Email
                ON dbo.SinhVien (Email)
                WHERE Email IS NOT NULL;
            ';
        END;

        /* INSTEAD OF INSERT: copy cột mới */
        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_SinhVien_Insert
ON dbo.SinhVien
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND p.TenPhong IS NULL
    )
    BEGIN
        RAISERROR(N''Phòng không tồn tại!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND i.GioiTinh <> p.LoaiPhong
    )
    BEGIN
        RAISERROR(N''Sai giới tính phòng!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.Phong p ON p.TenPhong = i.TenPhong
        WHERE i.TenPhong IS NOT NULL
          AND p.TrangThaiPhong IN (N''Bảo trì'', N''Ngưng sử dụng'')
    )
    BEGIN
        RAISERROR(N''Phòng không khả dụng!'', 16, 1);
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT i.TenPhong, COUNT(*) AS SoDong
            FROM inserted i
            WHERE i.TenPhong IS NOT NULL
            GROUP BY i.TenPhong
        ) b
        INNER JOIN dbo.Phong p ON p.TenPhong = b.TenPhong
        WHERE p.SoSinhVienHienTai + b.SoDong > p.SucChuaToiDa
    )
    BEGIN
        RAISERROR(N''Phòng đã đầy!'', 16, 1);
        RETURN;
    END;

    INSERT INTO dbo.SinhVien (
        MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
        TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop, NgayRoiKTX, NgayTao
    )
    SELECT
        i.MaSinhVien, i.HoTen, i.NgaySinh, i.GioiTinh, i.SoDienThoai, i.Email, i.DiaChi,
        i.TrangThaiSinhVien, i.TenPhong, i.GhiChu, i.Truong, i.Lop, i.NgayRoiKTX,
        ISNULL(i.NgayTao, GETDATE())
    FROM inserted i;
END;
';

        /* ========== HopDong ========== */
        IF COL_LENGTH(N'dbo.HopDong', N'NgayKetThucThucTe') IS NULL
            ALTER TABLE dbo.HopDong ADD NgayKetThucThucTe date NULL;
        IF COL_LENGTH(N'dbo.HopDong', N'NgayKetThucGoc') IS NULL
            ALTER TABLE dbo.HopDong ADD NgayKetThucGoc date NULL;
        IF COL_LENGTH(N'dbo.HopDong', N'SoLanGiaHan') IS NULL
            ALTER TABLE dbo.HopDong ADD SoLanGiaHan int NOT NULL CONSTRAINT DF_HopDong_SoLanGiaHan DEFAULT (0);

        IF EXISTS (
            SELECT MaSinhVien FROM dbo.HopDong
            WHERE TrangThaiHopDong = N'Còn hiệu lực'
            GROUP BY MaSinhVien HAVING COUNT(*) > 1
        )
        BEGIN
            PRINT N'[002] CẢNH BÁO: Có sinh viên nhiều hợp đồng còn hiệu lực — không tạo UQ_HopDong_MotHieuLuc. Chạy db/optional/hopdong_unique.sql sau khi dọn dữ liệu.';
        END
        ELSE IF NOT EXISTS (
            SELECT 1 FROM sys.indexes WHERE name = N'UQ_HopDong_MotHieuLuc' AND object_id = OBJECT_ID(N'dbo.HopDong')
        )
        BEGIN
            EXEC sys.sp_executesql N'
                CREATE UNIQUE NONCLUSTERED INDEX UQ_HopDong_MotHieuLuc
                ON dbo.HopDong (MaSinhVien)
                WHERE TrangThaiHopDong = N''Còn hiệu lực'';
            ';
        END;

        /* ========== HoaDon ========== */
        IF COL_LENGTH(N'dbo.HoaDon', N'SoDienCu') IS NULL
            ALTER TABLE dbo.HoaDon ADD SoDienCu int NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'SoDienMoi') IS NULL
            ALTER TABLE dbo.HoaDon ADD SoDienMoi int NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'SoNuocCu') IS NULL
            ALTER TABLE dbo.HoaDon ADD SoNuocCu int NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'SoNuocMoi') IS NULL
            ALTER TABLE dbo.HoaDon ADD SoNuocMoi int NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'HanThanhToan') IS NULL
            ALTER TABLE dbo.HoaDon ADD HanThanhToan date NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'PhuongThucThanhToan') IS NULL
            ALTER TABLE dbo.HoaDon ADD PhuongThucThanhToan nvarchar(30) NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'NgayThanhToan') IS NULL
            ALTER TABLE dbo.HoaDon ADD NgayThanhToan datetime NULL;
        IF COL_LENGTH(N'dbo.HoaDon', N'GhiChuThanhToan') IS NULL
            ALTER TABLE dbo.HoaDon ADD GhiChuThanhToan nvarchar(255) NULL;

        EXEC sys.sp_executesql N'
            UPDATE dbo.HoaDon
            SET SoDienCu = ISNULL(SoDienCu, 0),
                SoDienMoi = ISNULL(SoDienMoi, ChiSoDien),
                SoNuocCu = ISNULL(SoNuocCu, 0),
                SoNuocMoi = ISNULL(SoNuocMoi, ChiSoNuoc),
                HanThanhToan = ISNULL(HanThanhToan, DATEADD(day, 15, NgayLap)),
                NgayThanhToan = CASE
                    WHEN TrangThaiThanhToan = N''Đã thanh toán'' AND NgayThanhToan IS NULL
                        THEN CAST(NgayLap AS datetime)
                    ELSE NgayThanhToan
                END;
        ';
        PRINT N'[002] HoaDon.NgayThanhToan của hóa đơn đã trả được gán = NgayLap (giá trị suy đoán).';

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes WHERE name = N'IX_HoaDon_MaSinhVien_NgayLap' AND object_id = OBJECT_ID(N'dbo.HoaDon')
        )
            EXEC sys.sp_executesql N'CREATE NONCLUSTERED INDEX IX_HoaDon_MaSinhVien_NgayLap ON dbo.HoaDon (MaSinhVien, NgayLap);';

        /* ========== TaiKhoan (không seed tài khoản sinh viên) ========== */
        IF COL_LENGTH(N'dbo.TaiKhoan', N'MaSinhVien') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD MaSinhVien nvarchar(20) NULL;
        IF COL_LENGTH(N'dbo.TaiKhoan', N'TrangThai') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD TrangThai nvarchar(20) NOT NULL CONSTRAINT DF_TaiKhoan_TrangThai DEFAULT (N'Hoạt động');
        IF COL_LENGTH(N'dbo.TaiKhoan', N'NgayTao') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD NgayTao datetime NULL CONSTRAINT DF_TaiKhoan_NgayTao DEFAULT (GETDATE());
        IF COL_LENGTH(N'dbo.TaiKhoan', N'SoLanDangNhapSai') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD SoLanDangNhapSai int NOT NULL CONSTRAINT DF_TaiKhoan_SoLanDangNhapSai DEFAULT (0);
        IF COL_LENGTH(N'dbo.TaiKhoan', N'KhoaDenLuc') IS NULL
            ALTER TABLE dbo.TaiKhoan ADD KhoaDenLuc datetime NULL;

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE name = N''FK_TaiKhoan_SinhVien'' AND parent_object_id = OBJECT_ID(N''dbo.TaiKhoan'')
            )
            BEGIN
                ALTER TABLE dbo.TaiKhoan WITH CHECK
                ADD CONSTRAINT FK_TaiKhoan_SinhVien
                FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien);
            END;

            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE name = N''CK_TaiKhoan_TrangThai'' AND parent_object_id = OBJECT_ID(N''dbo.TaiKhoan'')
            )
            BEGIN
                ALTER TABLE dbo.TaiKhoan WITH CHECK
                ADD CONSTRAINT CK_TaiKhoan_TrangThai
                CHECK (TrangThai IN (N''Hoạt động'', N''Khóa''));
            END;

            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE name = N''CK_TaiKhoan_SinhVienGmail'' AND parent_object_id = OBJECT_ID(N''dbo.TaiKhoan'')
            )
            BEGIN
                ALTER TABLE dbo.TaiKhoan WITH CHECK
                ADD CONSTRAINT CK_TaiKhoan_SinhVienGmail
                CHECK (
                    VaiTro <> N''Sinh viên''
                    OR (MaSinhVien IS NOT NULL AND Email LIKE N''%@gmail.com'')
                );
            END;
        ';

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes WHERE name = N'UQ_TaiKhoan_MaSinhVien' AND object_id = OBJECT_ID(N'dbo.TaiKhoan')
        )
            EXEC sys.sp_executesql N'
                CREATE UNIQUE NONCLUSTERED INDEX UQ_TaiKhoan_MaSinhVien
                ON dbo.TaiKhoan (MaSinhVien)
                WHERE MaSinhVien IS NOT NULL;
            ';

        /* Không backfill MaSinhVien: SinhVien.Email là email trường, đăng nhập SV dùng Gmail. */

        /* ========== CauHinhHeThong ========== */
        IF OBJECT_ID(N'dbo.CauHinhHeThong', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.CauHinhHeThong
            (
                Khoa nvarchar(50) NOT NULL CONSTRAINT PK_CauHinhHeThong PRIMARY KEY,
                GiaTri nvarchar(200) NOT NULL,
                MoTa nvarchar(255) NULL
            );
        END;

        MERGE dbo.CauHinhHeThong AS t
        USING (VALUES
            (N'DON_GIA_DIEN', N'3500', N'Đơn giá điện (VND / chỉ số)'),
            (N'DON_GIA_NUOC', N'15000', N'Đơn giá nước (VND / chỉ số)'),
            (N'SO_NGAY_HAN_THANH_TOAN', N'15', N'Số ngày cộng vào NgayLap để ra hạn thanh toán'),
            (N'NGUONG_CANH_BAO_HET_HAN_ADMIN', N'7', N'Số ngày còn lại để cảnh báo admin'),
            (N'NGUONG_CANH_BAO_HET_HAN_SV', N'30', N'Số ngày còn lại để cảnh báo sinh viên'),
            (N'THOI_GIAN_HET_HAN_QR_PHUT', N'15', N'Thời gian hết hạn giao dịch ONLINE PENDING (phút)')
        ) AS s (Khoa, GiaTri, MoTa)
        ON t.Khoa = s.Khoa
        WHEN NOT MATCHED THEN
            INSERT (Khoa, GiaTri, MoTa) VALUES (s.Khoa, s.GiaTri, s.MoTa);

        /* ========== LichSuHopDong ========== */
        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.LichSuHopDong
            (
                MaLichSu int IDENTITY(1,1) NOT NULL CONSTRAINT PK_LichSuHopDong PRIMARY KEY,
                MaHopDong nvarchar(20) NOT NULL,
                MaSinhVien nvarchar(20) NOT NULL,
                HoTen nvarchar(100) NULL,
                TenPhong nvarchar(50) NULL,
                NgayBatDau date NULL,
                NgayKetThuc date NULL,
                TrangThaiHopDong nvarchar(20) NULL,
                ThaoTac nvarchar(30) NOT NULL,
                NguoiThucHien int NULL,
                ThoiGian datetime NOT NULL CONSTRAINT DF_LichSuHopDong_ThoiGian DEFAULT (GETDATE()),
                CONSTRAINT CK_LichSuHopDong_ThaoTac CHECK (ThaoTac IN (N'Tạo mới', N'Gia hạn', N'Kết thúc', N'Chuyển phòng', N'Ghi chú')),
                CONSTRAINT FK_LichSuHopDong_TaiKhoan FOREIGN KEY (NguoiThucHien) REFERENCES dbo.TaiKhoan (MaTaiKhoan)
            );
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LichSuHopDong_MaHopDong' AND object_id = OBJECT_ID(N'dbo.LichSuHopDong'))
            CREATE NONCLUSTERED INDEX IX_LichSuHopDong_MaHopDong ON dbo.LichSuHopDong (MaHopDong);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LichSuHopDong_ThoiGian' AND object_id = OBJECT_ID(N'dbo.LichSuHopDong'))
            CREATE NONCLUSTERED INDEX IX_LichSuHopDong_ThoiGian ON dbo.LichSuHopDong (ThoiGian);

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'002', N'002_schema_extensions.sql');

        COMMIT TRANSACTION;
        PRINT N'[002] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

/*
ROLLBACK 002: restore backup. Không DROP cột đã thêm.
Ghi chú: TaiKhoan.SoDienThoai CHECK 10 chữ số (BE chuẩn hóa +84 → 0…).
MatKhau varchar(255) đủ chứa hash dạng scrypt$salt$hash.
*/
