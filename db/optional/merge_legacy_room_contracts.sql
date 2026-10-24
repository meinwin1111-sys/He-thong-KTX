:on error exit
:setvar ApDung "0"
IF DB_NAME() = N'master'
    THROW 51803, N'Chạy script bằng sqlcmd -d với database đích.', 1;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

DECLARE @ApDung nvarchar(10) = N'$(ApDung)';
IF @ApDung NOT IN (N'0', N'1')
    THROW 51600, N'ApDung chỉ nhận 0 (xem trước) hoặc 1 (áp dụng).', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'014')
    THROW 51601, N'Cần chạy migration 014 trước.', 1;

IF EXISTS (
    SELECT 1
    FROM dbo.HopDong a
    INNER JOIN dbo.HopDong b
        ON b.TenPhong = a.TenPhong
       AND b.MaHopDong > a.MaHopDong
       AND b.TrangThaiHopDong = N'Còn hiệu lực'
       AND a.TrangThaiHopDong = N'Còn hiệu lực'
    WHERE a.NgayBatDau > b.NgayKetThuc OR b.NgayBatDau > a.NgayKetThuc
)
    THROW 51603, N'Có hợp đồng hiệu lực cùng phòng nhưng thời hạn không giao nhau; cần đối soát thủ công.', 1;

DECLARE @MergeMap table
(
    MaHopDongCu nvarchar(20) NOT NULL PRIMARY KEY,
    MaHopDongChuan nvarchar(20) NOT NULL,
    TenPhong nvarchar(50) NOT NULL,
    MaHangPhong nvarchar(20) NOT NULL
);

;WITH Ranked AS
(
    SELECT MaHopDong, TenPhong, MaHangPhong,
           FIRST_VALUE(MaHopDong) OVER (
               PARTITION BY TenPhong, MaHangPhong
               ORDER BY NgayBatDau, MaHopDong
           ) AS MaHopDongChuan,
           ROW_NUMBER() OVER (
               PARTITION BY TenPhong, MaHangPhong
               ORDER BY NgayBatDau, MaHopDong
           ) AS ThuTu
    FROM dbo.HopDong
    WHERE TrangThaiHopDong = N'Còn hiệu lực'
)
INSERT INTO @MergeMap (MaHopDongCu, MaHopDongChuan, TenPhong, MaHangPhong)
SELECT MaHopDong, MaHopDongChuan, TenPhong, MaHangPhong
FROM Ranked
WHERE ThuTu > 1;

SELECT MaHopDongCu, MaHopDongChuan, TenPhong, MaHangPhong
FROM @MergeMap
ORDER BY TenPhong, MaHopDongChuan, MaHopDongCu;

IF @ApDung = N'0'
BEGIN
    PRINT N'Chế độ xem trước: không thay đổi dữ liệu. Chạy lại với -v ApDung=1 để áp dụng sau khi đối soát.';
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @HopDongLockCount bigint;
    SELECT @HopDongLockCount = COUNT_BIG(*)
    FROM dbo.HopDong WITH (TABLOCKX, HOLDLOCK);

    IF EXISTS (
        SELECT 1
        FROM @MergeMap m
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = m.MaHopDongCu
        INNER JOIN dbo.HopDong canonical ON canonical.MaHopDong = m.MaHopDongChuan
        WHERE hd.TrangThaiHopDong <> N'Còn hiệu lực'
           OR hd.TenPhong <> m.TenPhong
           OR hd.MaHangPhong <> m.MaHangPhong
           OR canonical.TrangThaiHopDong <> N'Còn hiệu lực'
           OR canonical.TenPhong <> m.TenPhong
           OR canonical.MaHangPhong <> m.MaHangPhong
    )
        THROW 51602, N'Dữ liệu hợp đồng nguồn/đích thay đổi sau khi lập bản xem trước; không thực hiện gộp.', 1;

    UPDATE c
    SET LaNguoiDaiDienThanhToanDichVu = 0,
        MaHopDong = m.MaHopDongChuan
    FROM dbo.ChiTietHopDong c
    INNER JOIN @MergeMap m ON m.MaHopDongCu = c.MaHopDong
    WHERE c.TrangThai = N'Đang ở';

    ;WITH CanonicalRanges AS
    (
        SELECT m.MaHopDongChuan,
               MIN(hd.NgayBatDau) AS NgayBatDau,
               MAX(hd.NgayKetThuc) AS NgayKetThuc
        FROM (
            SELECT DISTINCT MaHopDongChuan, MaHopDongCu FROM @MergeMap
        ) m
        INNER JOIN dbo.HopDong hd
            ON hd.MaHopDong = m.MaHopDongChuan
            OR hd.MaHopDong = m.MaHopDongCu
        GROUP BY m.MaHopDongChuan
    )
    UPDATE canonical
    SET NgayBatDau = r.NgayBatDau,
        NgayKetThuc = r.NgayKetThuc
    FROM dbo.HopDong canonical
    INNER JOIN CanonicalRanges r ON r.MaHopDongChuan = canonical.MaHopDong;

    UPDATE old
    SET TrangThaiHopDong = N'Đã kết thúc',
        NgayKetThucThucTe = COALESCE(NgayKetThucThucTe, CAST(GETDATE() AS date)),
        GhiChu = LEFT(CONCAT(COALESCE(GhiChu + N' | ', N''), N'Gộp vào ', m.MaHopDongChuan), 255)
    FROM dbo.HopDong old
    INNER JOIN @MergeMap m ON m.MaHopDongCu = old.MaHopDong;

    ;WITH RepresentativeCandidate AS
    (
        SELECT c.MaHopDong, c.MaChiTiet,
               ROW_NUMBER() OVER (PARTITION BY c.MaHopDong ORDER BY c.NgayVao, c.MaChiTiet) AS RowNum
        FROM dbo.ChiTietHopDong c
        WHERE c.TrangThai = N'Đang ở'
          AND c.MaHopDong IN (SELECT DISTINCT MaHopDongChuan FROM @MergeMap)
          AND NOT EXISTS (
              SELECT 1
              FROM dbo.ChiTietHopDong rep
              WHERE rep.MaHopDong = c.MaHopDong
                AND rep.TrangThai = N'Đang ở'
                AND rep.LaNguoiDaiDienThanhToanDichVu = 1
          )
    )
    UPDATE c
    SET LaNguoiDaiDienThanhToanDichVu = 1
    FROM dbo.ChiTietHopDong c
    INNER JOIN RepresentativeCandidate r ON r.MaChiTiet = c.MaChiTiet
    WHERE r.RowNum = 1;

    INSERT INTO dbo.NhatKyHeThong (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
    SELECT NULL, N'Gộp hợp đồng legacy', N'HopDong', m.MaHopDongChuan,
           (SELECT m.MaHopDongCu AS maHopDongCu, m.MaHopDongChuan AS maHopDongChuan,
                   m.TenPhong AS tenPhong, m.MaHangPhong AS maHangPhong
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM @MergeMap m;

    IF EXISTS (
        SELECT TenPhong
        FROM dbo.HopDong
        WHERE TrangThaiHopDong = N'Còn hiệu lực'
        GROUP BY TenPhong
        HAVING COUNT_BIG(*) > 1
    )
        THROW 51604, N'Vẫn còn nhiều hợp đồng hiệu lực trong một phòng; không tạo unique index.', 1;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.HopDong')
          AND name = N'UX_HopDong_TenPhong_HieuLuc'
    )
        CREATE UNIQUE INDEX UX_HopDong_TenPhong_HieuLuc
        ON dbo.HopDong (TenPhong)
        WHERE TrangThaiHopDong = N'Còn hiệu lực';

    COMMIT TRANSACTION;
    PRINT N'Đã gộp hợp đồng trùng phòng theo hạng phòng; các mã hợp đồng cũ được giữ lại ở trạng thái Đã kết thúc.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
