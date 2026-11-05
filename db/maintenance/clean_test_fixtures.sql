/*
    Chỉ dành cho KTX_Group3_test.
    Mặc định @Commit = 0: thao tác trong transaction, in số đếm trước/sau rồi ROLLBACK.
    Chỉ đổi @Commit thành 1 sau khi kiểm tra kỹ kết quả; khi đó các fixture mục tiêu sẽ bị xóa.
    Chạy từ thư mục gốc repo:
      sqlcmd -S 127.0.0.1,1433 -E -d KTX_Group3_test -I -f 65001 -b -i db\maintenance\clean_test_fixtures.sql
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() <> N'KTX_Group3_test'
    THROW 54100, N'Script chỉ được chạy trên KTX_Group3_test.', 1;
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 54101, N'Không tìm thấy dbo.SchemaMigration.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'039')
    THROW 54102, N'Cần chạy migration 039 trước.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'040')
    THROW 54103, N'Cần chạy migration 040 trước.', 1;
IF OBJECT_ID(N'dbo.sp_HuyPhieuChiFixtureKiemThu', N'P') IS NULL
   OR OBJECT_ID(N'dbo.sp_DonDepFixtureTaiChinhKiemThu', N'P') IS NULL
    THROW 54104, N'Thiếu thủ tục dọn fixture 039/040.', 1;
GO

DECLARE @Commit bit = 0;

BEGIN TRY
    BEGIN TRANSACTION;

    CREATE TABLE #FixtureRooms
    (
        TenPhong nvarchar(50) NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureContracts
    (
        MaHopDong nvarchar(20) NOT NULL PRIMARY KEY,
        TenPhong nvarchar(50) NOT NULL
    );
    CREATE TABLE #FixtureMembers
    (
        MaChiTiet int NOT NULL PRIMARY KEY,
        MaHopDong nvarchar(20) NOT NULL,
        MaSinhVien nvarchar(30) NOT NULL
    );
    CREATE TABLE #FixtureStudents
    (
        MaSinhVien nvarchar(30) NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureInvoices
    (
        MaHoaDon nvarchar(20) NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureInvoiceItems
    (
        MaChiTiet nvarchar(40) NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixturePayments
    (
        MaGiaoDich nvarchar(60) NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureCashouts
    (
        MaPhieuChi bigint NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureRenewals
    (
        MaGiaHan int NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureAccounts
    (
        MaTaiKhoan int NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureAuditLogs
    (
        MaNhatKy bigint NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureTiers
    (
        MaHangPhong nvarchar(20) NOT NULL PRIMARY KEY
    );
    CREATE TABLE #FixtureServices
    (
        MaDichVu nvarchar(20) NOT NULL PRIMARY KEY
    );

    INSERT INTO #FixtureRooms (TenPhong)
    SELECT p.TenPhong
    FROM dbo.Phong p
    WHERE p.TenPhong LIKE N'T5-%'
       OR p.TenPhong LIKE N'GH-TEST-%';

    INSERT INTO #FixtureContracts (MaHopDong, TenPhong)
    SELECT h.MaHopDong, h.TenPhong
    FROM dbo.HopDong h
    WHERE h.TenPhong LIKE N'T5-%'
       OR h.TenPhong LIKE N'GH-TEST-%';

    INSERT INTO #FixtureMembers (MaChiTiet, MaHopDong, MaSinhVien)
    SELECT c.MaChiTiet, c.MaHopDong, c.MaSinhVien
    FROM dbo.ChiTietHopDong c
    INNER JOIN #FixtureContracts h ON h.MaHopDong = c.MaHopDong;

    IF EXISTS
    (
        SELECT 1
        FROM #FixtureContracts h
        WHERE NOT EXISTS
        (
            SELECT 1 FROM #FixtureMembers c
            WHERE c.MaHopDong = h.MaHopDong
        )
    )
        THROW 54105, N'Có hợp đồng phòng fixture không có thành viên; dừng để tránh xóa nhầm.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM #FixtureMembers c
        INNER JOIN #FixtureContracts h ON h.MaHopDong = c.MaHopDong
        WHERE NOT
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
        THROW 54106, N'Hợp đồng fixture có thành viên không khớp mã fixture; dừng, không xóa dữ liệu.', 1;

    INSERT INTO #FixtureStudents (MaSinhVien)
    SELECT sv.MaSinhVien
    FROM dbo.SinhVien sv
    WHERE sv.MaSinhVien LIKE N'T5%'
      AND LEN(sv.MaSinhVien) = 15
    UNION
    SELECT sv.MaSinhVien
    FROM dbo.SinhVien sv
    WHERE sv.MaSinhVien LIKE N'GH%'
      AND LEN(sv.MaSinhVien) = 11
      AND
      (
          EXISTS
          (
              SELECT 1
              FROM #FixtureMembers c
              INNER JOIN #FixtureContracts h ON h.MaHopDong = c.MaHopDong
              WHERE c.MaSinhVien = sv.MaSinhVien
                AND h.TenPhong LIKE N'GH-TEST-%'
          )
          OR EXISTS
          (
              SELECT 1
              FROM #FixtureRooms r
              WHERE r.TenPhong = sv.TenPhong
                AND r.TenPhong LIKE N'GH-TEST-%'
          )
      );

    IF EXISTS
    (
        SELECT 1
        FROM #FixtureMembers c
        LEFT JOIN #FixtureStudents sv ON sv.MaSinhVien = c.MaSinhVien
        WHERE sv.MaSinhVien IS NULL
    )
        THROW 54107, N'Thiếu hồ sơ SinhVien cho thành viên fixture; dừng để bảo toàn dữ liệu.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM #FixtureStudents sv
        INNER JOIN dbo.ChiTietHopDong c ON c.MaSinhVien = sv.MaSinhVien
        LEFT JOIN #FixtureContracts h ON h.MaHopDong = c.MaHopDong
        WHERE h.MaHopDong IS NULL
    )
        THROW 54108, N'Sinh viên fixture còn thuộc hợp đồng ngoài phòng fixture; dừng để tránh xóa nhầm.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.SinhVien sv
        INNER JOIN #FixtureRooms r ON r.TenPhong = sv.TenPhong
        LEFT JOIN #FixtureStudents fixtureStudent
            ON fixtureStudent.MaSinhVien = sv.MaSinhVien
        WHERE fixtureStudent.MaSinhVien IS NULL
    )
        THROW 54115, N'Phòng fixture đang được sinh viên ngoài fixture sử dụng; dừng.', 1;

    INSERT INTO #FixtureInvoices (MaHoaDon)
    SELECT DISTINCT hd.MaHoaDon
    FROM dbo.HoaDon hd
    LEFT JOIN #FixtureContracts h ON h.MaHopDong = hd.MaHopDong
    LEFT JOIN #FixtureMembers c ON c.MaChiTiet = hd.MaChiTiet
    WHERE h.MaHopDong IS NOT NULL
       OR c.MaChiTiet IS NOT NULL
       OR
       (
           hd.TenPhong IN (SELECT TenPhong FROM #FixtureRooms)
           AND hd.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       );

    IF EXISTS
    (
        SELECT 1
        FROM dbo.HoaDon hd
        INNER JOIN #FixtureRooms r ON r.TenPhong = hd.TenPhong
        LEFT JOIN #FixtureInvoices fixtureInvoice ON fixtureInvoice.MaHoaDon = hd.MaHoaDon
        WHERE fixtureInvoice.MaHoaDon IS NULL
    )
        THROW 54116, N'Phòng fixture có hóa đơn không khớp chủ thể fixture; dừng.', 1;

    INSERT INTO #FixtureInvoiceItems (MaChiTiet)
    SELECT DISTINCT cthd.MaChiTiet
    FROM dbo.ChiTietHoaDon cthd
    INNER JOIN #FixtureInvoices hd ON hd.MaHoaDon = cthd.MaHoaDon;

    INSERT INTO #FixturePayments (MaGiaoDich)
    SELECT DISTINCT gd.MaGiaoDich
    FROM dbo.GiaoDichThanhToan gd
    WHERE gd.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       OR EXISTS
       (
           SELECT 1
           FROM dbo.PhieuThu pt
           INNER JOIN #FixtureInvoices hd ON hd.MaHoaDon = pt.MaHoaDon
           WHERE pt.MaGiaoDich = gd.MaGiaoDich
       );

    IF EXISTS
    (
        SELECT 1
        FROM dbo.PhieuThu pt
        INNER JOIN #FixturePayments pay ON pay.MaGiaoDich = pt.MaGiaoDich
        LEFT JOIN #FixtureInvoices hd ON hd.MaHoaDon = pt.MaHoaDon
        WHERE hd.MaHoaDon IS NULL
    )
        THROW 54109, N'Giao dịch fixture đang liên kết hóa đơn ngoài fixture; dừng để bảo toàn dữ liệu.', 1;

    INSERT INTO #FixtureRenewals (MaGiaHan)
    SELECT g.MaGiaHan
    FROM dbo.GiaHanHopDong g
    INNER JOIN #FixtureContracts h ON h.MaHopDong = g.MaHopDong;

    INSERT INTO #FixtureCashouts (MaPhieuChi)
    SELECT pc.MaPhieuChi
    FROM dbo.PhieuChi pc
    INNER JOIN #FixtureMembers c ON c.MaChiTiet = pc.MaChiTiet;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.TaiKhoan tk
        WHERE (tk.Email LIKE N'b5-%' OR tk.Email LIKE N'gh-test-%')
          AND tk.MaSinhVien IS NOT NULL
          AND NOT EXISTS
          (
              SELECT 1 FROM #FixtureStudents sv
              WHERE sv.MaSinhVien = tk.MaSinhVien
          )
    )
        THROW 54117, N'Email tài khoản fixture đang gắn với sinh viên ngoài fixture; dừng.', 1;

    INSERT INTO #FixtureAccounts (MaTaiKhoan)
    SELECT tk.MaTaiKhoan
    FROM dbo.TaiKhoan tk
    WHERE tk.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       OR tk.Email LIKE N'b5-%'
       OR tk.Email LIKE N'gh-test-%';

    INSERT INTO #FixtureTiers (MaHangPhong)
    SELECT hp.MaHangPhong
    FROM dbo.HangPhong hp
    WHERE hp.MaHangPhong LIKE N'T5HP%'
       OR hp.MaHangPhong LIKE N'GH-TEST-HP-%';

    INSERT INTO #FixtureServices (MaDichVu)
    SELECT dv.MaDichVu
    FROM dbo.DichVu dv
    WHERE dv.MaDichVu LIKE N'T5DV%'
       OR dv.MaDichVu LIKE N'GH-TEST-DV%';

    IF EXISTS
    (
        SELECT 1
        FROM dbo.Phong p
        INNER JOIN #FixtureTiers hp ON hp.MaHangPhong = p.MaHangPhong
        LEFT JOIN #FixtureRooms r ON r.TenPhong = p.TenPhong
        WHERE r.TenPhong IS NULL
    )
        THROW 54111, N'Hạng phòng fixture đang được phòng ngoài fixture sử dụng; dừng.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.HangPhong_DichVu hpdv
        INNER JOIN #FixtureTiers hp ON hp.MaHangPhong = hpdv.MaHangPhong
        LEFT JOIN #FixtureServices dv ON dv.MaDichVu = hpdv.MaDichVu
        WHERE dv.MaDichVu IS NULL
    )
        THROW 54112, N'Hạng phòng fixture đang dùng dịch vụ ngoài fixture; dừng.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.HangPhong_DichVu hpdv
        INNER JOIN #FixtureServices dv ON dv.MaDichVu = hpdv.MaDichVu
        LEFT JOIN #FixtureTiers hp ON hp.MaHangPhong = hpdv.MaHangPhong
        WHERE hp.MaHangPhong IS NULL
    )
        THROW 54113, N'Dịch vụ fixture đang được hạng phòng ngoài fixture sử dụng; dừng.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.HoaDon hd
        INNER JOIN dbo.ChiTietHoaDon item ON item.MaHoaDon = hd.MaHoaDon
        INNER JOIN #FixtureServices service ON service.MaDichVu = item.MaDichVu
        LEFT JOIN #FixtureInvoices fixtureInvoice ON fixtureInvoice.MaHoaDon = hd.MaHoaDon
        WHERE fixtureInvoice.MaHoaDon IS NULL
    )
        THROW 54118, N'Dịch vụ fixture đang được hóa đơn ngoài fixture sử dụng; dừng.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.HopDong h
        INNER JOIN #FixtureTiers tier ON tier.MaHangPhong = h.MaHangPhong
        LEFT JOIN #FixtureContracts fixtureContract ON fixtureContract.MaHopDong = h.MaHopDong
        WHERE fixtureContract.MaHopDong IS NULL
    )
        THROW 54119, N'Hạng phòng fixture đang được hợp đồng ngoài fixture sử dụng; dừng.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.DangKySinhVienChoDuyet registration
        INNER JOIN #FixtureAccounts account ON account.MaTaiKhoan = registration.XuLyBoi
        LEFT JOIN #FixtureStudents student ON student.MaSinhVien = registration.MaSinhVien
        WHERE student.MaSinhVien IS NULL
    )
        THROW 54120, N'Tài khoản fixture đã xử lý đăng ký của sinh viên ngoài fixture; dừng.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.TaiKhoan tk
        INNER JOIN #FixtureAccounts a ON a.MaTaiKhoan = tk.MaTaiKhoan
        WHERE EXISTS
        (
            SELECT 1 FROM dbo.ThongBao tb
            WHERE tb.NguoiTao = tk.MaTaiKhoan
              AND tb.MaThongBao NOT IN
              (
                  SELECT tb2.MaThongBao
                  FROM dbo.ThongBao tb2
                  WHERE tb2.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
                     OR tb2.TenPhong IN (SELECT TenPhong FROM #FixtureRooms)
                     OR tb2.MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
              )
        )
        OR EXISTS
        (
            SELECT 1 FROM dbo.GiaoDichThanhToan gd
            WHERE gd.XacNhanBoi = tk.MaTaiKhoan
              AND gd.MaGiaoDich NOT IN (SELECT MaGiaoDich FROM #FixturePayments)
        )
        OR EXISTS
        (
            SELECT 1 FROM dbo.PhieuThu pt
            WHERE pt.NguoiThu = tk.MaTaiKhoan
              AND pt.MaHoaDon NOT IN (SELECT MaHoaDon FROM #FixtureInvoices)
        )
        OR EXISTS
        (
            SELECT 1
            FROM dbo.PhieuChi pc
            LEFT JOIN #FixtureMembers c ON c.MaChiTiet = pc.MaChiTiet
            WHERE pc.NguoiLap = tk.MaTaiKhoan
              AND c.MaChiTiet IS NULL
        )
        OR EXISTS
        (
            SELECT 1 FROM dbo.YeuCauSinhVien yc
            WHERE yc.XuLyBoi = tk.MaTaiKhoan
              AND yc.MaSinhVien NOT IN (SELECT MaSinhVien FROM #FixtureStudents)
              AND
              (
                  yc.TenPhong IS NULL
                  OR yc.TenPhong NOT IN (SELECT TenPhong FROM #FixtureRooms)
              )
        )
        OR EXISTS
        (
            SELECT 1 FROM dbo.ChiPhiPhatSinh cp
            LEFT JOIN #FixtureContracts h ON h.MaHopDong = cp.MaHopDong
            WHERE cp.NguoiNhap = tk.MaTaiKhoan
              AND h.MaHopDong IS NULL
        )
        OR EXISTS
        (
            SELECT 1 FROM dbo.LichSuHopDong_Backup lsb
            LEFT JOIN #FixtureContracts h ON h.MaHopDong = lsb.MaHopDong
            WHERE lsb.NguoiThucHien = tk.MaTaiKhoan
              AND h.MaHopDong IS NULL
        )
    )
        THROW 54114, N'Tài khoản fixture còn được dữ liệu ngoài fixture tham chiếu; dừng để bảo toàn dữ liệu.', 1;

    INSERT INTO #FixtureAuditLogs (MaNhatKy)
    SELECT n.MaNhatKy
    FROM dbo.NhatKyHeThong n
    WHERE n.MaTaiKhoan IN (SELECT MaTaiKhoan FROM #FixtureAccounts)
       OR (n.DoiTuong = N'HopDong'
           AND n.MaDoiTuong IN (SELECT MaHopDong FROM #FixtureContracts))
       OR (n.DoiTuong = N'GiaHanHopDong'
           AND n.MaDoiTuong IN
           (
               SELECT CONVERT(nvarchar(60), MaGiaHan)
               FROM #FixtureRenewals
           ))
       OR (n.DoiTuong = N'FixtureCleanup'
           AND n.MaDoiTuong IN (SELECT MaHopDong FROM #FixtureContracts))
       OR (n.DoiTuong = N'PhieuChi'
           AND n.MaDoiTuong IN
           (
               SELECT CONVERT(nvarchar(60), MaPhieuChi)
               FROM #FixtureCashouts
           ))
       OR (n.HanhDong IN
           (N'Hủy phiếu chi fixture kiểm thử', N'Dọn dữ liệu tài chính fixture kiểm thử')
           AND n.MaDoiTuong IN (SELECT MaHopDong FROM #FixtureContracts));

    SELECT N'ThongBao' AS Bang, COUNT_BIG(*) AS SoDong
    FROM dbo.ThongBao tb
    WHERE tb.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       OR tb.TenPhong IN (SELECT TenPhong FROM #FixtureRooms)
       OR tb.MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
    UNION ALL
    SELECT N'PhieuChi', COUNT_BIG(*) FROM #FixtureCashouts
    UNION ALL
    SELECT N'PhieuChi_HoaDon', COUNT_BIG(*)
    FROM dbo.PhieuChi_HoaDon
    WHERE MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR MaPhieuChi IN (SELECT MaPhieuChi FROM #FixtureCashouts)
    UNION ALL
    SELECT N'HoanTienChuyenKhoanDu', COUNT_BIG(*)
    FROM dbo.HoanTienChuyenKhoanDu
    WHERE MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR MaGiaoDich IN (SELECT MaGiaoDich FROM #FixturePayments)
    UNION ALL
    SELECT N'ChiTietHoaDon', COUNT_BIG(*) FROM #FixtureInvoiceItems
    UNION ALL
    SELECT N'ChiPhiPhatSinh', COUNT_BIG(*)
    FROM dbo.ChiPhiPhatSinh
    WHERE MaHopDong IN (SELECT MaHopDong FROM #FixtureContracts)
       OR MaChiTiet IN (SELECT MaChiTiet FROM #FixtureMembers)
    UNION ALL
    SELECT N'YeuCauSinhVien', COUNT_BIG(*)
    FROM dbo.YeuCauSinhVien
    WHERE MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       OR TenPhong IN (SELECT TenPhong FROM #FixtureRooms)
    UNION ALL
    SELECT N'DangKySinhVienChoDuyet', COUNT_BIG(*)
    FROM dbo.DangKySinhVienChoDuyet
    WHERE MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
    UNION ALL
    SELECT N'NhatKyHeThong', COUNT_BIG(*)
    FROM #FixtureAuditLogs
    UNION ALL
    SELECT N'LichSuHopDong_Backup', COUNT_BIG(*)
    FROM dbo.LichSuHopDong_Backup
    WHERE MaHopDong IN (SELECT MaHopDong FROM #FixtureContracts)
    UNION ALL
    SELECT N'HopDong', COUNT_BIG(*) FROM #FixtureContracts
    UNION ALL
    SELECT N'ChiTietHopDong', COUNT_BIG(*) FROM #FixtureMembers
    UNION ALL
    SELECT N'SinhVien', COUNT_BIG(*) FROM dbo.SinhVien
    WHERE MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
    UNION ALL
    SELECT N'TaiKhoan', COUNT_BIG(*) FROM dbo.TaiKhoan
    WHERE MaTaiKhoan IN (SELECT MaTaiKhoan FROM #FixtureAccounts)
    UNION ALL
    SELECT N'HoaDon', COUNT_BIG(*) FROM #FixtureInvoices
    UNION ALL
    SELECT N'PhieuThu', COUNT_BIG(*) FROM dbo.PhieuThu
    WHERE MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR MaGiaoDich IN (SELECT MaGiaoDich FROM #FixturePayments)
    UNION ALL
    SELECT N'GiaoDichThanhToan', COUNT_BIG(*) FROM #FixturePayments
    UNION ALL
    SELECT N'GiaHanHopDong', COUNT_BIG(*) FROM #FixtureRenewals
    UNION ALL
    SELECT N'Phong', COUNT_BIG(*) FROM #FixtureRooms
    UNION ALL
    SELECT N'HangPhong', COUNT_BIG(*) FROM #FixtureTiers
    UNION ALL
    SELECT N'HangPhong_DichVu', COUNT_BIG(*)
    FROM dbo.HangPhong_DichVu
    WHERE MaHangPhong IN (SELECT MaHangPhong FROM #FixtureTiers)
       OR MaDichVu IN (SELECT MaDichVu FROM #FixtureServices)
    UNION ALL
    SELECT N'DichVu', COUNT_BIG(*) FROM #FixtureServices;

    DECLARE @MaHopDong nvarchar(20);
    DECLARE contract_cleanup CURSOR LOCAL FAST_FORWARD FOR
        SELECT MaHopDong
        FROM #FixtureContracts
        ORDER BY MaHopDong;
    OPEN contract_cleanup;
    FETCH NEXT FROM contract_cleanup INTO @MaHopDong;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.sp_HuyPhieuChiFixtureKiemThu
            @MaHopDong = @MaHopDong,
            @NguoiThucHien = NULL;
        EXEC dbo.sp_DonDepFixtureTaiChinhKiemThu
            @MaHopDong = @MaHopDong,
            @NguoiThucHien = NULL;
        FETCH NEXT FROM contract_cleanup INTO @MaHopDong;
    END;
    CLOSE contract_cleanup;
    DEALLOCATE contract_cleanup;

    INSERT INTO #FixtureAuditLogs (MaNhatKy)
    SELECT n.MaNhatKy
    FROM dbo.NhatKyHeThong n
    WHERE
        (
            (
                n.DoiTuong = N'FixtureCleanup'
                AND n.MaDoiTuong IN (SELECT MaHopDong FROM #FixtureContracts)
            )
            OR
            (
                n.DoiTuong = N'PhieuChi'
                AND n.MaDoiTuong IN
                (
                    SELECT CONVERT(nvarchar(60), MaPhieuChi)
                    FROM #FixtureCashouts
                )
            )
        )
        AND NOT EXISTS
        (
            SELECT 1 FROM #FixtureAuditLogs existing
            WHERE existing.MaNhatKy = n.MaNhatKy
        );

    DELETE tb
    FROM dbo.ThongBao tb
    WHERE tb.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       OR tb.TenPhong IN (SELECT TenPhong FROM #FixtureRooms)
       OR tb.MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices);

    DELETE r
    FROM dbo.HoanTienChuyenKhoanDu r
    WHERE r.MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR r.MaGiaoDich IN (SELECT MaGiaoDich FROM #FixturePayments);

    DELETE pha
    FROM dbo.PhieuChi_HoaDon pha
    WHERE pha.MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR pha.MaPhieuChi IN (SELECT MaPhieuChi FROM #FixtureCashouts);

    DELETE pc
    FROM dbo.PhieuChi pc
    WHERE pc.MaPhieuChi IN (SELECT MaPhieuChi FROM #FixtureCashouts);

    DELETE pt
    FROM dbo.PhieuThu pt
    WHERE pt.MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR pt.MaGiaoDich IN (SELECT MaGiaoDich FROM #FixturePayments);

    DELETE gd
    FROM dbo.GiaoDichThanhToan gd
    WHERE gd.MaGiaoDich IN (SELECT MaGiaoDich FROM #FixturePayments);

    DELETE cp
    FROM dbo.ChiPhiPhatSinh cp
    WHERE cp.MaHopDong IN (SELECT MaHopDong FROM #FixtureContracts)
       OR cp.MaChiTiet IN (SELECT MaChiTiet FROM #FixtureMembers);

    DELETE n
    FROM dbo.NhatKyHeThong n
    INNER JOIN #FixtureAuditLogs fixtureLog ON fixtureLog.MaNhatKy = n.MaNhatKy;

    DELETE lsb
    FROM dbo.LichSuHopDong_Backup lsb
    WHERE lsb.MaHopDong IN (SELECT MaHopDong FROM #FixtureContracts);

    DELETE g
    FROM dbo.GiaHanHopDong g
    WHERE g.MaGiaHan IN (SELECT MaGiaHan FROM #FixtureRenewals);

    DELETE hd
    FROM dbo.HoaDon hd
    WHERE hd.MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices);

    DELETE yc
    FROM dbo.YeuCauSinhVien yc
    WHERE yc.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       OR yc.TenPhong IN (SELECT TenPhong FROM #FixtureRooms);

    DELETE registration
    FROM dbo.DangKySinhVienChoDuyet registration
    WHERE registration.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents);

    DELETE c
    FROM dbo.ChiTietHopDong c
    WHERE c.MaChiTiet IN (SELECT MaChiTiet FROM #FixtureMembers);

    DELETE h
    FROM dbo.HopDong h
    WHERE h.MaHopDong IN (SELECT MaHopDong FROM #FixtureContracts);

    DELETE tk
    FROM dbo.TaiKhoan tk
    WHERE tk.MaTaiKhoan IN (SELECT MaTaiKhoan FROM #FixtureAccounts);

    DELETE sv
    FROM dbo.SinhVien sv
    WHERE sv.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents);

    DELETE p
    FROM dbo.Phong p
    WHERE p.TenPhong IN (SELECT TenPhong FROM #FixtureRooms);

    DELETE hpdv
    FROM dbo.HangPhong_DichVu hpdv
    WHERE hpdv.MaHangPhong IN (SELECT MaHangPhong FROM #FixtureTiers)
       OR hpdv.MaDichVu IN (SELECT MaDichVu FROM #FixtureServices);

    DELETE dv
    FROM dbo.DichVu dv
    WHERE dv.MaDichVu IN (SELECT MaDichVu FROM #FixtureServices);

    DELETE hp
    FROM dbo.HangPhong hp
    WHERE hp.MaHangPhong IN (SELECT MaHangPhong FROM #FixtureTiers);

    SELECT N'ThongBao' AS Bang, COUNT_BIG(*) AS SoDong
    FROM dbo.ThongBao tb
    WHERE tb.MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       OR tb.TenPhong IN (SELECT TenPhong FROM #FixtureRooms)
       OR tb.MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
    UNION ALL
    SELECT N'PhieuChi', COUNT_BIG(*) FROM dbo.PhieuChi
    WHERE MaPhieuChi IN (SELECT MaPhieuChi FROM #FixtureCashouts)
    UNION ALL
    SELECT N'PhieuChi_HoaDon', COUNT_BIG(*)
    FROM dbo.PhieuChi_HoaDon
    WHERE MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR MaPhieuChi IN (SELECT MaPhieuChi FROM #FixtureCashouts)
    UNION ALL
    SELECT N'HoanTienChuyenKhoanDu', COUNT_BIG(*)
    FROM dbo.HoanTienChuyenKhoanDu
    WHERE MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR MaGiaoDich IN (SELECT MaGiaoDich FROM #FixturePayments)
    UNION ALL
    SELECT N'ChiTietHoaDon', COUNT_BIG(*)
    FROM dbo.ChiTietHoaDon
    WHERE MaChiTiet IN (SELECT MaChiTiet FROM #FixtureInvoiceItems)
    UNION ALL
    SELECT N'ChiPhiPhatSinh', COUNT_BIG(*)
    FROM dbo.ChiPhiPhatSinh
    WHERE MaHopDong IN (SELECT MaHopDong FROM #FixtureContracts)
       OR MaChiTiet IN (SELECT MaChiTiet FROM #FixtureMembers)
    UNION ALL
    SELECT N'YeuCauSinhVien', COUNT_BIG(*)
    FROM dbo.YeuCauSinhVien
    WHERE MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
       OR TenPhong IN (SELECT TenPhong FROM #FixtureRooms)
    UNION ALL
    SELECT N'DangKySinhVienChoDuyet', COUNT_BIG(*)
    FROM dbo.DangKySinhVienChoDuyet
    WHERE MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
    UNION ALL
    SELECT N'NhatKyHeThong', COUNT_BIG(*)
    FROM dbo.NhatKyHeThong n
    INNER JOIN #FixtureAuditLogs fixtureLog ON fixtureLog.MaNhatKy = n.MaNhatKy
    UNION ALL
    SELECT N'LichSuHopDong_Backup', COUNT_BIG(*)
    FROM dbo.LichSuHopDong_Backup
    WHERE MaHopDong IN (SELECT MaHopDong FROM #FixtureContracts)
    UNION ALL
    SELECT N'HopDong', COUNT_BIG(*) FROM dbo.HopDong
    WHERE MaHopDong IN (SELECT MaHopDong FROM #FixtureContracts)
    UNION ALL
    SELECT N'ChiTietHopDong', COUNT_BIG(*) FROM dbo.ChiTietHopDong
    WHERE MaChiTiet IN (SELECT MaChiTiet FROM #FixtureMembers)
    UNION ALL
    SELECT N'SinhVien', COUNT_BIG(*) FROM dbo.SinhVien
    WHERE MaSinhVien IN (SELECT MaSinhVien FROM #FixtureStudents)
    UNION ALL
    SELECT N'TaiKhoan', COUNT_BIG(*) FROM dbo.TaiKhoan
    WHERE MaTaiKhoan IN (SELECT MaTaiKhoan FROM #FixtureAccounts)
    UNION ALL
    SELECT N'HoaDon', COUNT_BIG(*) FROM dbo.HoaDon
    WHERE MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
    UNION ALL
    SELECT N'PhieuThu', COUNT_BIG(*) FROM dbo.PhieuThu
    WHERE MaHoaDon IN (SELECT MaHoaDon FROM #FixtureInvoices)
       OR MaGiaoDich IN (SELECT MaGiaoDich FROM #FixturePayments)
    UNION ALL
    SELECT N'GiaoDichThanhToan', COUNT_BIG(*) FROM dbo.GiaoDichThanhToan
    WHERE MaGiaoDich IN (SELECT MaGiaoDich FROM #FixturePayments)
    UNION ALL
    SELECT N'GiaHanHopDong', COUNT_BIG(*) FROM dbo.GiaHanHopDong
    WHERE MaGiaHan IN (SELECT MaGiaHan FROM #FixtureRenewals)
    UNION ALL
    SELECT N'Phong', COUNT_BIG(*) FROM dbo.Phong
    WHERE TenPhong IN (SELECT TenPhong FROM #FixtureRooms)
    UNION ALL
    SELECT N'HangPhong', COUNT_BIG(*) FROM dbo.HangPhong
    WHERE MaHangPhong IN (SELECT MaHangPhong FROM #FixtureTiers)
    UNION ALL
    SELECT N'HangPhong_DichVu', COUNT_BIG(*)
    FROM dbo.HangPhong_DichVu
    WHERE MaHangPhong IN (SELECT MaHangPhong FROM #FixtureTiers)
       OR MaDichVu IN (SELECT MaDichVu FROM #FixtureServices)
    UNION ALL
    SELECT N'DichVu', COUNT_BIG(*) FROM dbo.DichVu
    WHERE MaDichVu IN (SELECT MaDichVu FROM #FixtureServices);

    IF @Commit = 1
    BEGIN
        COMMIT TRANSACTION;
        PRINT N'Fixture đã được xóa và transaction đã COMMIT.';
    END
    ELSE
    BEGIN
        ROLLBACK TRANSACTION;
        PRINT N'Chế độ mặc định: transaction đã ROLLBACK; dữ liệu DB không thay đổi.';
    END;
END TRY
BEGIN CATCH
    IF CURSOR_STATUS('local', 'contract_cleanup') >= -1
    BEGIN
        IF CURSOR_STATUS('local', 'contract_cleanup') > -1
            CLOSE contract_cleanup;
        DEALLOCATE contract_cleanup;
    END;
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
