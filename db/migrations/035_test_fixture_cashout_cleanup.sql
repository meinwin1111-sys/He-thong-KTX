SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 53500, N'Không chạy migration trong master.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 53501, N'Chạy migration 001 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'034')
    THROW 53502, N'Chạy migration 034 trước.', 1;
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
        IF LEFT(@TenPhong, 3) <> N'T5-'
            THROW 53506, N'Chỉ được hủy phiếu chi thuộc phòng fixture T5-.', 1;

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

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'035')
    INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
    VALUES (N'035', N'035_test_fixture_cashout_cleanup.sql');
GO
PRINT N'[035] Hoàn tất.';
GO
