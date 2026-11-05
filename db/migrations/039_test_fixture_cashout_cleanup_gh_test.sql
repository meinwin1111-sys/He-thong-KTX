-- CHỈ CHO DB TEST KTX_Group3_test, KHÔNG chạy trên DB thật.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 53900, N'Migration 039 chỉ được chạy trên KTX_Group3_test.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 53901, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'038')
    THROW 53902, N'Chạy migration 038 trước.', 1;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HuyPhieuChiFixtureKiemThu
    @MaHopDong nvarchar(20),
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF DB_NAME() <> N'KTX_Group3_test'
        THROW 53503, N'Thủ tục chỉ hoạt động trên KTX_Group3_test.', 1;
    IF NULLIF(LTRIM(RTRIM(@MaHopDong)), N'') IS NULL
        THROW 53504, N'Mã hợp đồng fixture không hợp lệ.', 1;

    DECLARE @InitialTranCount int = @@TRANCOUNT;
    DECLARE @TenPhong nvarchar(50);
    DECLARE @Canceled TABLE (MaPhieuChi bigint NOT NULL, SoTien decimal(18,2) NOT NULL);

    BEGIN TRY
        IF @InitialTranCount = 0
            BEGIN TRANSACTION;
        ELSE
            SAVE TRANSACTION HuyPhieuChiFixture;

        SELECT @TenPhong = h.TenPhong
        FROM dbo.HopDong h WITH (UPDLOCK, HOLDLOCK)
        WHERE h.MaHopDong = @MaHopDong;

        IF @TenPhong IS NULL
            THROW 53505, N'Không tìm thấy hợp đồng fixture.', 1;
        IF @TenPhong NOT LIKE N'T5-%' AND @TenPhong NOT LIKE N'GH-TEST-%'
            THROW 53506, N'Chỉ được hủy phiếu chi thuộc phòng fixture T5- hoặc GH-TEST-.', 1;
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
                      AND @TenPhong LIKE N'GH-TEST-%'
                  )
              )
        )
            THROW 53506, N'Hợp đồng không có sinh viên fixture T5 hoặc GH thuộc phòng GH-TEST-.', 1;
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
                      AND @TenPhong LIKE N'GH-TEST-%'
                  )
              )
        )
            THROW 53506, N'Hợp đồng có sinh viên ngoài fixture.', 1;

        UPDATE pc
        SET TrangThai = N'Đã hủy'
        OUTPUT inserted.MaPhieuChi, inserted.SoTien
            INTO @Canceled (MaPhieuChi, SoTien)
        FROM dbo.PhieuChi pc WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
        WHERE c.MaHopDong = @MaHopDong
          AND pc.TrangThai = N'Hợp lệ';

        INSERT INTO dbo.NhatKyHeThong
            (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
        SELECT @NguoiThucHien, N'Hủy phiếu chi fixture kiểm thử', N'PhieuChi',
               CONVERT(nvarchar(60), canceled.MaPhieuChi),
               N'Hủy phiếu chi hợp lệ để dọn fixture thuộc hợp đồng '
                   + @MaHopDong + N' tại phòng ' + @TenPhong + N'.'
        FROM @Canceled canceled;

        IF @InitialTranCount = 0
            COMMIT TRANSACTION;

        SELECT COUNT_BIG(*) AS SoPhieuChiDaHuy
        FROM @Canceled;
    END TRY
    BEGIN CATCH
        IF @InitialTranCount = 0 AND @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        ELSE IF @InitialTranCount > 0 AND XACT_STATE() = 1
            ROLLBACK TRANSACTION HuyPhieuChiFixture;
        THROW;
    END CATCH;
END;
GO

GRANT EXECUTE ON OBJECT::dbo.sp_HuyPhieuChiFixtureKiemThu TO [DNKTX];
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'039')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'039', N'039_test_fixture_cashout_cleanup_gh_test.sql');
GO

PRINT N'[039] Hoàn tất.';
GO
