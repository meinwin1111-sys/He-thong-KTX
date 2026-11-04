SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 53100, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 53101, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'030')
    THROW 53102, N'Chạy migration 030 trước.', 1;
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.ChiPhiPhatSinh')
      AND name = N'CK_ChiPhiPhatSinh_TrangThai'
)
    ALTER TABLE dbo.ChiPhiPhatSinh DROP CONSTRAINT CK_ChiPhiPhatSinh_TrangThai;
GO

ALTER TABLE dbo.ChiPhiPhatSinh WITH CHECK
    ADD CONSTRAINT CK_ChiPhiPhatSinh_TrangThai
    CHECK (TrangThai IN (N'Chưa lập hóa đơn', N'Chờ gộp', N'Đã lập hóa đơn', N'Đã hủy'));
GO

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
        WHERE MaHopDong = @MaHopDong AND TrangThaiHopDong = N'Còn hiệu lực';
        IF @TenPhong IS NULL
        BEGIN
            SELECT @MaHopDong AS MaHopDong;
            THROW 51926, N'Không tìm thấy hợp đồng/phòng hiệu lực.', 1;
        END;
        IF @KyThanhToan IS NULL
           OR @KyThanhToan <> DATEFROMPARTS(YEAR(@KyThanhToan), MONTH(@KyThanhToan), 1)
        BEGIN
            SELECT @MaHopDong AS MaHopDong, @KyThanhToan AS KyThanhToan;
            THROW 51927, N'Kỳ dịch vụ phải là ngày đầu tháng.', 1;
        END;
        IF @ChiSoJson IS NOT NULL AND ISJSON(@ChiSoJson) <> 1
        BEGIN
            SELECT @MaHopDong AS MaHopDong, @ChiSoJson AS ChiSoJson;
            THROW 51928, N'Dữ liệu chỉ số dịch vụ phải là JSON hợp lệ.', 1;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE LoaiHoaDon = N'DICH_VU_PHONG' AND MaHopDong = @MaHopDong
              AND TrangThaiThanhToan <> N'Đã hủy'
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan
        )
        BEGIN
            SELECT MaHoaDon, MaHopDong, KyThanhToan, KyThanhToanDen
            FROM dbo.HoaDon
            WHERE LoaiHoaDon = N'DICH_VU_PHONG' AND MaHopDong = @MaHopDong
              AND TrangThaiThanhToan <> N'Đã hủy'
              AND KyThanhToan <= @Den AND KyThanhToanDen >= @KyThanhToan;
            THROW 51929, N'Kỳ dịch vụ bị trùng hoặc chồng với hóa đơn đang hoạt động.', 1;
        END;
        IF @MaHoaDon IS NULL
            EXEC dbo.sp_B3_TaoMaHoaDon @Ngay, @MaHoaDon OUTPUT;
        SELECT @Han = DATEADD(day, ISNULL(TRY_CONVERT(int, GiaTri), 15), @Ngay)
        FROM dbo.CauHinhHeThong WHERE Khoa = N'SO_NGAY_HAN_THANH_TOAN';
        INSERT INTO dbo.HoaDon
            (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
             TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong,
             KyThanhToan, KyThanhToanDen)
        VALUES
            (@MaHoaDon, @MaSinhVienNop, @TenPhong, @Ngay, 0, 0, 0,
             N'Chưa thanh toán', COALESCE(@Han, DATEADD(day, 15, @Ngay)),
             N'DICH_VU_PHONG', @MaHopDong, @KyThanhToan, @Den);

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
                   WHEN hpdv.CachTinh = N'CHI_SO'
                       THEN CONVERT(decimal(18,3), j.ChiSoMoi - j.ChiSoCu)
                   WHEN hpdv.DoiTuongThanhToan = N'CA_NHAN'
                       THEN CONVERT(decimal(18,3), residents.SoNguoi)
                   ELSE CONVERT(decimal(18,3), 1)
               END,
               j.ChiSoCu, j.ChiSoMoi
        FROM dbo.HangPhong_DichVu hpdv
        INNER JOIN dbo.DichVu d ON d.MaDichVu = hpdv.MaDichVu
        OUTER APPLY (
            SELECT TRY_CONVERT(int, JSON_VALUE(value, '$.chiSoCu')) AS ChiSoCu,
                   TRY_CONVERT(int, JSON_VALUE(value, '$.chiSoMoi')) AS ChiSoMoi
            FROM OPENJSON(COALESCE(@ChiSoJson, N'[]'))
            WHERE JSON_VALUE(value, '$.maDichVu') = hpdv.MaDichVu
        ) j
        CROSS APPLY (
            SELECT COUNT(*) AS SoNguoi
            FROM dbo.ChiTietHopDong c
            WHERE c.MaHopDong = @MaHopDong AND c.TrangThai = N'Đang ở'
        ) residents
        WHERE hpdv.MaHangPhong = @MaHangPhong
          AND hpdv.HoatDong = 1 AND d.HoatDong = 1;

        IF EXISTS (
            SELECT 1 FROM @Services
            WHERE CachTinh = N'CHI_SO' AND (ChiSoCu IS NULL OR ChiSoMoi IS NULL OR ChiSoMoi < ChiSoCu)
        )
        BEGIN
            SELECT MaDichVu, CachTinh, ChiSoCu, ChiSoMoi
            FROM @Services
            WHERE CachTinh = N'CHI_SO' AND (ChiSoCu IS NULL OR ChiSoMoi IS NULL OR ChiSoMoi < ChiSoCu);
            THROW 51930, N'Thiếu hoặc sai chỉ số cũ/mới cho dịch vụ tính theo chỉ số.', 1;
        END;
        IF EXISTS (SELECT 1 FROM @Services WHERE SoLuong <= 0)
        BEGIN
            SELECT MaDichVu, SoLuong FROM @Services WHERE SoLuong <= 0;
            THROW 51931, N'Số lượng dịch vụ phải lớn hơn 0.', 1;
        END;

        INSERT INTO dbo.ChiTietHoaDon
            (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, MaDichVu,
             ChiSoCu, ChiSoMoi, SoLuong, DonGia, TrangThai, ThuTu, GhiChu)
        SELECT LEFT(@MaHoaDon, 25) + N'-SV-' + RIGHT(N'000' + CONVERT(nvarchar(3), RowNo), 3),
               @MaHoaDon, N'SERVICE', TenDichVu,
               CONVERT(decimal(18,2), ROUND(SoLuong * DonGia, 2)),
               MaDichVu, ChiSoCu, ChiSoMoi, SoLuong, DonGia,
               N'Chưa thanh toán', RowNo, DonVi
        FROM @Services;

        DECLARE @IncidentIds table (MaChiPhi bigint PRIMARY KEY);
        INSERT INTO @IncidentIds(MaChiPhi)
        SELECT MaChiPhi
        FROM dbo.ChiPhiPhatSinh WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND MaChiTiet IS NULL
          AND TrangThai = N'Chờ gộp';

        DECLARE @MaChiPhi bigint, @IncidentAmount decimal(18,2), @IncidentDesc nvarchar(255),
                @IncidentDetail nvarchar(40), @IncidentName nvarchar(100);
        DECLARE incident_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT cp.MaChiPhi, cp.SoTien, cp.NoiDung
            FROM dbo.ChiPhiPhatSinh cp WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN @IncidentIds ids ON ids.MaChiPhi = cp.MaChiPhi
            ORDER BY cp.MaChiPhi;
        OPEN incident_cursor;
        FETCH NEXT FROM incident_cursor INTO @MaChiPhi, @IncidentAmount, @IncidentDesc;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @IncidentName = N'Chi phí phát sinh: ' + LEFT(@IncidentDesc, 80);
            SET @IncidentDetail = LEFT(@MaHoaDon, 25) + N'-INC-' + CONVERT(nvarchar(12), @MaChiPhi);
            INSERT INTO dbo.ChiTietHoaDon
                (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
                 TrangThai, ThuTu, GhiChu)
            VALUES (@IncidentDetail, @MaHoaDon, N'INCIDENT', @IncidentName,
                    @IncidentAmount, 1, @IncidentAmount, N'Chưa thanh toán', 1000, @IncidentDesc);
            UPDATE dbo.ChiPhiPhatSinh
            SET TrangThai = N'Đã lập hóa đơn', MaChiTietHoaDon = @IncidentDetail
            WHERE MaChiPhi = @MaChiPhi AND TrangThai = N'Chờ gộp';
            IF @@ROWCOUNT <> 1
                THROW 53103, N'Khoản chờ gộp đã được xử lý bởi thao tác khác.', 1;
            FETCH NEXT FROM incident_cursor INTO @MaChiPhi, @IncidentAmount, @IncidentDesc;
        END;
        CLOSE incident_cursor;
        DEALLOCATE incident_cursor;

        COMMIT TRANSACTION;
        SELECT @MaHoaDon AS MaHoaDon;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'incident_cursor') >= 0 CLOSE incident_cursor;
        IF CURSOR_STATUS('local', 'incident_cursor') > -3 DEALLOCATE incident_cursor;
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'031')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'031', N'031_incident_expense_modes.sql');
GO
PRINT N'[031] Hoàn tất: chi phí phát sinh có chế độ lập riêng hoặc chờ gộp vào hóa đơn dịch vụ.';
GO
