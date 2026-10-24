SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51700, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'016')
    THROW 51701, N'Chạy migration 016 trước.', 1;
ELSE IF EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'017')
    PRINT N'[017] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.ChiTietHoaDon')
              AND definition LIKE N'%MaKhoan%'
              AND definition NOT LIKE N'%INCIDENT%'
        )
        BEGIN
            SELECT name, definition
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.ChiTietHoaDon')
              AND definition LIKE N'%MaKhoan%'
              AND definition NOT LIKE N'%INCIDENT%';
            THROW 51704, N'CHECK hiện có trên MaKhoan chưa cho phép INCIDENT; cần điều chỉnh trước khi lập khoản phát sinh.', 1;
        END;

        EXEC sys.sp_executesql N'
            CREATE TABLE dbo.ChiPhiPhatSinh
            (
                MaChiPhi bigint IDENTITY(1,1) NOT NULL
                    CONSTRAINT PK_ChiPhiPhatSinh PRIMARY KEY,
                MaHopDong nvarchar(20) NOT NULL,
                MaChiTiet int NULL,
                NoiDung nvarchar(255) NOT NULL,
                SoTien decimal(18,2) NOT NULL,
                NgayPhatSinh date NOT NULL
                    CONSTRAINT DF_ChiPhiPhatSinh_NgayPhatSinh DEFAULT (CONVERT(date, GETDATE())),
                NguoiNhap int NOT NULL,
                TrangThai nvarchar(20) NOT NULL
                    CONSTRAINT DF_ChiPhiPhatSinh_TrangThai DEFAULT (N''Chưa lập hóa đơn''),
                MaChiTietHoaDon nvarchar(40) NULL,
                GhiChu nvarchar(255) NULL,
                NgayTao datetime NOT NULL
                    CONSTRAINT DF_ChiPhiPhatSinh_NgayTao DEFAULT (GETDATE()),
                CONSTRAINT FK_ChiPhiPhatSinh_HopDong
                    FOREIGN KEY (MaHopDong) REFERENCES dbo.HopDong(MaHopDong),
                CONSTRAINT FK_ChiPhiPhatSinh_ChiTiet
                    FOREIGN KEY (MaChiTiet) REFERENCES dbo.ChiTietHopDong(MaChiTiet),
                CONSTRAINT FK_ChiPhiPhatSinh_NguoiNhap
                    FOREIGN KEY (NguoiNhap) REFERENCES dbo.TaiKhoan(MaTaiKhoan),
                CONSTRAINT FK_ChiPhiPhatSinh_ChiTietHoaDon
                    FOREIGN KEY (MaChiTietHoaDon) REFERENCES dbo.ChiTietHoaDon(MaChiTiet),
                CONSTRAINT CK_ChiPhiPhatSinh_SoTien CHECK (SoTien > 0),
                CONSTRAINT CK_ChiPhiPhatSinh_TrangThai
                    CHECK (TrangThai IN (N''Chưa lập hóa đơn'', N''Đã lập hóa đơn'', N''Đã hủy'')),
                CONSTRAINT CK_ChiPhiPhatSinh_LienKet
                    CHECK (
                        (TrangThai = N''Đã lập hóa đơn'' AND MaChiTietHoaDon IS NOT NULL)
                        OR (TrangThai <> N''Đã lập hóa đơn'' AND MaChiTietHoaDon IS NULL)
                    )
            );

            CREATE UNIQUE INDEX UX_ChiPhiPhatSinh_ChiTietHoaDon
                ON dbo.ChiPhiPhatSinh(MaChiTietHoaDon)
                WHERE MaChiTietHoaDon IS NOT NULL;

            CREATE INDEX IX_ChiPhiPhatSinh_HopDong_TrangThai
                ON dbo.ChiPhiPhatSinh(MaHopDong, TrangThai, NgayPhatSinh)
                INCLUDE (MaChiPhi, MaChiTiet, SoTien);';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_ChiPhiPhatSinh_BaoVe
ON dbo.ChiPhiPhatSinh
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        LEFT JOIN inserted i ON i.MaChiPhi = d.MaChiPhi
        WHERE d.TrangThai = N''Đã lập hóa đơn''
          AND (i.MaChiPhi IS NULL
               OR ISNULL(i.MaChiTietHoaDon, N'''') <> d.MaChiTietHoaDon
               OR i.TrangThai <> N''Đã lập hóa đơn'')
    )
    BEGIN
        SELECT d.MaChiPhi, d.MaHopDong, d.MaChiTiet, d.TrangThai, d.MaChiTietHoaDon
        FROM deleted d
        LEFT JOIN inserted i ON i.MaChiPhi = d.MaChiPhi
        WHERE d.TrangThai = N''Đã lập hóa đơn''
          AND (i.MaChiPhi IS NULL
               OR ISNULL(i.MaChiTietHoaDon, N'''') <> d.MaChiTietHoaDon
               OR i.TrangThai <> N''Đã lập hóa đơn'');
        THROW 51702, N''Không được xóa, hủy hoặc tháo liên kết chi phí đã lập hóa đơn.'', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.ChiTietHoaDon c ON c.MaChiTiet = i.MaChiTietHoaDon
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = c.MaHoaDon
        WHERE i.TrangThai = N''Đã lập hóa đơn''
          AND (hd.LoaiHoaDon NOT IN (N''DICH_VU_PHONG'', N''PHAT_SINH'')
               OR hd.MaHopDong <> i.MaHopDong
               OR c.MaKhoan <> N''INCIDENT''
               OR c.SoTien <> i.SoTien)
    )
    BEGIN
        SELECT i.MaChiPhi, i.MaHopDong, i.MaChiTietHoaDon, c.MaHoaDon,
               hd.LoaiHoaDon, c.MaKhoan, c.SoTien AS TienDong, i.SoTien AS TienChiPhi
        FROM inserted i
        INNER JOIN dbo.ChiTietHoaDon c ON c.MaChiTiet = i.MaChiTietHoaDon
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = c.MaHoaDon
        WHERE i.TrangThai = N''Đã lập hóa đơn''
          AND (hd.LoaiHoaDon NOT IN (N''DICH_VU_PHONG'', N''PHAT_SINH'')
               OR hd.MaHopDong <> i.MaHopDong
               OR c.MaKhoan <> N''INCIDENT''
               OR c.SoTien <> i.SoTien);
        THROW 51703, N''Chi phí phát sinh chỉ được liên kết với đúng dòng INCIDENT trên hóa đơn dịch vụ/phát sinh cùng hợp đồng.'', 1;
    END;
END;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'017', N'017_incident_costs.sql');

        COMMIT TRANSACTION;
        PRINT N'[017] Hoàn tất: chi phí phát sinh được lưu và bảo vệ sau khi lập hóa đơn.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
