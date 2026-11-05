-- CHỈ CHO DB TEST KTX_Group3_test, KHÔNG chạy trên DB thật.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 54000, N'Migration 040 chỉ được chạy trên KTX_Group3_test.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 54001, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'039')
    THROW 54002, N'Chạy migration 039 trước.', 1;
GO

CREATE OR ALTER TRIGGER dbo.TRG_HoanTienChuyenKhoanDu_KhongHoanNguoc
ON dbo.HoanTienChuyenKhoanDu
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @FixtureCleanup bit =
        TRY_CONVERT(bit, SESSION_CONTEXT(N'KTXFixtureCleanup'));
    DECLARE @FixtureContract nvarchar(20) =
        TRY_CONVERT(nvarchar(20), SESSION_CONTEXT(N'KTXFixtureCleanupContract'));

    IF EXISTS
    (
        SELECT 1
        FROM deleted d
        LEFT JOIN inserted i ON i.MaHoanTien = d.MaHoanTien
        WHERE d.TrangThai = N'DA_HOAN'
          AND (i.MaHoanTien IS NULL OR i.TrangThai <> N'DA_HOAN')
          AND NOT
          (
              ISNULL(@FixtureCleanup, 0) = 1
              AND @FixtureContract IS NOT NULL
              AND DB_NAME() = N'KTX_Group3_test'
              AND i.MaHoanTien IS NULL
              AND EXISTS
              (
                  SELECT 1
                  FROM dbo.HoaDon hd
                  INNER JOIN dbo.HopDong h ON h.MaHopDong = hd.MaHopDong
                  INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = d.MaGiaoDich
                  WHERE hd.MaHoaDon = d.MaHoaDon
                    AND h.MaHopDong = @FixtureContract
                    AND (h.TenPhong LIKE N'T5-%' OR h.TenPhong LIKE N'GH-TEST-%')
                    AND
                    (
                        (gd.MaSinhVien LIKE N'T5%' AND LEN(gd.MaSinhVien) = 15)
                        OR
                        (
                            gd.MaSinhVien LIKE N'GH%'
                            AND LEN(gd.MaSinhVien) = 11
                            AND h.TenPhong LIKE N'GH-TEST-%'
                        )
                    )
                    AND EXISTS
                    (
                        SELECT 1
                        FROM dbo.ChiTietHopDong c
                        WHERE c.MaHopDong = h.MaHopDong
                          AND c.MaSinhVien = gd.MaSinhVien
                          AND
                          (
                              (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                              OR
                              (
                                  c.MaSinhVien LIKE N'GH%'
                                  AND LEN(c.MaSinhVien) = 11
                                  AND h.TenPhong LIKE N'GH-TEST-%'
                              )
                          )
                    )
                    AND NOT EXISTS
                    (
                        SELECT 1
                        FROM dbo.ChiTietHopDong c
                        WHERE c.MaHopDong = h.MaHopDong
                          AND NOT
                          (
                              (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                              OR
                              (
                                  c.MaSinhVien LIKE N'GH%'
                                  AND LEN(c.MaSinhVien) = 11
                                  AND h.TenPhong LIKE N'GH-TEST-%'
                              )
                          )
                    )
              )
          )
    )
        THROW 52703, N'Không thể xóa hoặc chuyển ngược khoản đã hoàn.', 1;
END;
GO

CREATE OR ALTER TRIGGER dbo.TRG_ChiPhiPhatSinh_BaoVe
ON dbo.ChiPhiPhatSinh
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @FixtureCleanup bit =
        TRY_CONVERT(bit, SESSION_CONTEXT(N'KTXFixtureCleanup'));
    DECLARE @FixtureContract nvarchar(20) =
        TRY_CONVERT(nvarchar(20), SESSION_CONTEXT(N'KTXFixtureCleanupContract'));

    IF EXISTS
    (
        SELECT 1
        FROM deleted d
        LEFT JOIN inserted i ON i.MaChiPhi = d.MaChiPhi
        WHERE d.TrangThai = N'Đã lập hóa đơn'
          AND (i.MaChiPhi IS NULL
               OR ISNULL(i.MaChiTietHoaDon, N'') <> d.MaChiTietHoaDon
               OR i.TrangThai <> N'Đã lập hóa đơn')
          AND NOT
          (
              ISNULL(@FixtureCleanup, 0) = 1
              AND @FixtureContract IS NOT NULL
              AND DB_NAME() = N'KTX_Group3_test'
              AND i.MaChiPhi IS NULL
              AND d.MaHopDong = @FixtureContract
              AND EXISTS
              (
                  SELECT 1
                  FROM dbo.HopDong h
                  WHERE h.MaHopDong = d.MaHopDong
                    AND (h.TenPhong LIKE N'T5-%' OR h.TenPhong LIKE N'GH-TEST-%')
                    AND EXISTS
                    (
                        SELECT 1
                        FROM dbo.ChiTietHopDong c
                        WHERE c.MaHopDong = h.MaHopDong
                          AND
                          (
                              (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                              OR
                              (
                                  c.MaSinhVien LIKE N'GH%'
                                  AND LEN(c.MaSinhVien) = 11
                                  AND h.TenPhong LIKE N'GH-TEST-%'
                              )
                          )
                    )
                    AND NOT EXISTS
                    (
                        SELECT 1
                        FROM dbo.ChiTietHopDong c
                        WHERE c.MaHopDong = h.MaHopDong
                          AND NOT
                          (
                              (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                              OR
                              (
                                  c.MaSinhVien LIKE N'GH%'
                                  AND LEN(c.MaSinhVien) = 11
                                  AND h.TenPhong LIKE N'GH-TEST-%'
                              )
                          )
                    )
              )
              AND
              (
                  d.MaChiTiet IS NULL
                  OR EXISTS
                  (
                      SELECT 1
                      FROM dbo.ChiTietHopDong c
                      INNER JOIN dbo.HopDong h ON h.MaHopDong = c.MaHopDong
                      WHERE c.MaChiTiet = d.MaChiTiet
                        AND c.MaHopDong = d.MaHopDong
                        AND
                        (
                            (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                            OR
                            (
                                c.MaSinhVien LIKE N'GH%'
                                AND LEN(c.MaSinhVien) = 11
                                AND h.TenPhong LIKE N'GH-TEST-%'
                            )
                        )
                  )
              )
          )
    )
    BEGIN
        SELECT d.MaChiPhi, d.MaHopDong, d.MaChiTiet, d.TrangThai, d.MaChiTietHoaDon
        FROM deleted d
        LEFT JOIN inserted i ON i.MaChiPhi = d.MaChiPhi
        WHERE d.TrangThai = N'Đã lập hóa đơn'
          AND (i.MaChiPhi IS NULL
               OR ISNULL(i.MaChiTietHoaDon, N'') <> d.MaChiTietHoaDon
               OR i.TrangThai <> N'Đã lập hóa đơn');
        THROW 51702, N'Không được xóa, hủy hoặc tháo liên kết chi phí đã lập hóa đơn.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.ChiTietHoaDon c ON c.MaChiTiet = i.MaChiTietHoaDon
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = c.MaHoaDon
        WHERE i.TrangThai = N'Đã lập hóa đơn'
          AND (hd.LoaiHoaDon NOT IN (N'DICH_VU_PHONG', N'PHAT_SINH')
               OR hd.MaHopDong <> i.MaHopDong
               OR c.MaKhoan <> N'INCIDENT'
               OR c.SoTien <> i.SoTien)
    )
    BEGIN
        SELECT i.MaChiPhi, i.MaHopDong, i.MaChiTietHoaDon, c.MaHoaDon,
               hd.LoaiHoaDon, c.MaKhoan, c.SoTien AS TienDong, i.SoTien AS TienChiPhi
        FROM inserted i
        INNER JOIN dbo.ChiTietHoaDon c ON c.MaChiTiet = i.MaChiTietHoaDon
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = c.MaHoaDon
        WHERE i.TrangThai = N'Đã lập hóa đơn'
          AND (hd.LoaiHoaDon NOT IN (N'DICH_VU_PHONG', N'PHAT_SINH')
               OR hd.MaHopDong <> i.MaHopDong
               OR c.MaKhoan <> N'INCIDENT'
               OR c.SoTien <> i.SoTien);
        THROW 51703, N'Chi phí phát sinh chỉ được liên kết với đúng dòng INCIDENT trên hóa đơn dịch vụ/phát sinh cùng hợp đồng.', 1;
    END;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_DonDepFixtureTaiChinhKiemThu
    @MaHopDong nvarchar(20),
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF DB_NAME() <> N'KTX_Group3_test'
        THROW 53803, N'Thủ tục chỉ hoạt động trên KTX_Group3_test.', 1;
    IF NULLIF(LTRIM(RTRIM(@MaHopDong)), N'') IS NULL
        THROW 53804, N'Mã hợp đồng fixture không hợp lệ.', 1;

    DECLARE @InitialTranCount int = @@TRANCOUNT;
    DECLARE @Room nvarchar(50);
    DECLARE @RefundCount int = 0;
    DECLARE @ExpenseCount int = 0;

    BEGIN TRY
        IF @InitialTranCount = 0
            BEGIN TRANSACTION;
        ELSE
            SAVE TRANSACTION DonDepFixtureTaiChinh;

        SELECT @Room = h.TenPhong
        FROM dbo.HopDong h WITH (UPDLOCK, HOLDLOCK)
        WHERE h.MaHopDong = @MaHopDong;

        IF @Room IS NULL
            THROW 53805, N'Không tìm thấy hợp đồng fixture.', 1;
        IF @Room NOT LIKE N'T5-%' AND @Room NOT LIKE N'GH-TEST-%'
            THROW 53806, N'Chỉ được dọn hợp đồng thuộc phòng fixture T5- hoặc GH-TEST-.', 1;
        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.ChiTietHopDong c
            WHERE c.MaHopDong = @MaHopDong
              AND
              (
                  (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                  OR
                  (
                      c.MaSinhVien LIKE N'GH%'
                      AND LEN(c.MaSinhVien) = 11
                      AND @Room LIKE N'GH-TEST-%'
                  )
              )
        )
            THROW 53807, N'Hợp đồng không có sinh viên fixture.', 1;
        IF EXISTS
        (
            SELECT 1
            FROM dbo.ChiTietHopDong c
            WHERE c.MaHopDong = @MaHopDong
              AND NOT
              (
                  (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                  OR
                  (
                      c.MaSinhVien LIKE N'GH%'
                      AND LEN(c.MaSinhVien) = 11
                      AND @Room LIKE N'GH-TEST-%'
                  )
              )
        )
            THROW 53808, N'Hợp đồng có sinh viên ngoài fixture; từ chối dọn.', 1;
        IF EXISTS
        (
            SELECT 1
            FROM dbo.HoanTienChuyenKhoanDu r
            INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = r.MaHoaDon
            INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = r.MaGiaoDich
            WHERE hd.MaHopDong = @MaHopDong
              AND
              (
                  NOT
                  (
                      (gd.MaSinhVien LIKE N'T5%' AND LEN(gd.MaSinhVien) = 15)
                      OR
                      (
                          gd.MaSinhVien LIKE N'GH%'
                          AND LEN(gd.MaSinhVien) = 11
                          AND @Room LIKE N'GH-TEST-%'
                      )
                  )
                  OR NOT EXISTS
                  (
                      SELECT 1
                      FROM dbo.ChiTietHopDong c
                      WHERE c.MaHopDong = @MaHopDong
                        AND c.MaSinhVien = gd.MaSinhVien
                        AND
                        (
                            (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                            OR
                            (
                                c.MaSinhVien LIKE N'GH%'
                                AND LEN(c.MaSinhVien) = 11
                                AND @Room LIKE N'GH-TEST-%'
                            )
                        )
                  )
              )
        )
            THROW 53809, N'Khoản hoàn liên kết sinh viên ngoài fixture; từ chối dọn.', 1;
        IF EXISTS
        (
            SELECT 1
            FROM dbo.ChiPhiPhatSinh cp
            WHERE cp.MaHopDong = @MaHopDong
              AND cp.MaChiTiet IS NOT NULL
              AND NOT EXISTS
              (
                  SELECT 1
                  FROM dbo.ChiTietHopDong c
                  WHERE c.MaChiTiet = cp.MaChiTiet
                    AND c.MaHopDong = @MaHopDong
                    AND
                    (
                        (c.MaSinhVien LIKE N'T5%' AND LEN(c.MaSinhVien) = 15)
                        OR
                        (
                            c.MaSinhVien LIKE N'GH%'
                            AND LEN(c.MaSinhVien) = 11
                            AND @Room LIKE N'GH-TEST-%'
                        )
                    )
              )
        )
            THROW 53810, N'Chi phí liên kết thành viên ngoài fixture; từ chối dọn.', 1;

        EXEC sys.sp_set_session_context
            @key = N'KTXFixtureCleanupContract', @value = @MaHopDong;
        EXEC sys.sp_set_session_context
            @key = N'KTXFixtureCleanup', @value = 1;

        DELETE r
        FROM dbo.HoanTienChuyenKhoanDu r
        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = r.MaHoaDon
        WHERE hd.MaHopDong = @MaHopDong;
        SET @RefundCount = @@ROWCOUNT;

        DELETE FROM dbo.ChiPhiPhatSinh
        WHERE MaHopDong = @MaHopDong;
        SET @ExpenseCount = @@ROWCOUNT;

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        VALUES
            (@NguoiThucHien, N'Dọn dữ liệu tài chính fixture kiểm thử',
             N'FixtureCleanup', @MaHopDong,
             CONCAT(N'Phòng ', @Room, N'; khoản hoàn đã xóa: ', @RefundCount,
                    N'; chi phí đã lập hóa đơn đã xóa: ', @ExpenseCount, N'.'));

        EXEC sys.sp_set_session_context
            @key = N'KTXFixtureCleanup', @value = NULL;
        EXEC sys.sp_set_session_context
            @key = N'KTXFixtureCleanupContract', @value = NULL;

        IF @InitialTranCount = 0
            COMMIT TRANSACTION;

        SELECT @MaHopDong AS MaHopDong,
               @RefundCount AS SoKhoanHoanDaXoa,
               @ExpenseCount AS SoChiPhiDaXoa;
    END TRY
    BEGIN CATCH
        EXEC sys.sp_set_session_context
            @key = N'KTXFixtureCleanup', @value = NULL;
        EXEC sys.sp_set_session_context
            @key = N'KTXFixtureCleanupContract', @value = NULL;

        IF @InitialTranCount = 0 AND @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        ELSE IF @InitialTranCount > 0 AND XACT_STATE() = 1
            ROLLBACK TRANSACTION DonDepFixtureTaiChinh;
        THROW;
    END CATCH;
END;
GO

GRANT EXECUTE ON OBJECT::dbo.sp_DonDepFixtureTaiChinhKiemThu TO [DNKTX];
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'040')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'040', N'040_test_fixture_financial_cleanup_gh_ids.sql');
GO

PRINT N'[040] Hoàn tất.';
GO
