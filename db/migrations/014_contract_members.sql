SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

CREATE TABLE #Migration014StartState (Applied bit NOT NULL);
INSERT INTO #Migration014StartState (Applied) VALUES (0);
IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NOT NULL
    EXEC sys.sp_executesql N'
        UPDATE #Migration014StartState
        SET Applied = CASE WHEN EXISTS (
            SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N''014''
        ) THEN 1 ELSE 0 END;';
GO

IF OBJECT_ID(N'dbo.SchemaMigration', N'U') IS NULL
    THROW 51400, N'Chạy migration 001 trước.', 1;
ELSE IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigration WHERE MaMigration = N'013')
    THROW 51401, N'Chạy migration 013 trước.', 1;
ELSE IF (SELECT Applied FROM #Migration014StartState) = 1
    PRINT N'[014] Đã chạy trước đó — bỏ qua.';
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        IF OBJECT_ID(N'dbo.HopDong', N'U') IS NULL
           OR OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NULL
           OR OBJECT_ID(N'dbo.NhatKyHeThong', N'U') IS NULL
            THROW 51402, N'Thiếu bảng HopDong, LichSuHopDong hoặc NhatKyHeThong.', 1;

        DECLARE @TrangThaiDangCo nvarchar(max),
                @TrangThaiLa nvarchar(max),
                @MaDoiTuongCan int;

        SELECT @TrangThaiDangCo = STUFF((
            SELECT N', ' + COALESCE(QUOTENAME(x.TrangThaiHopDong, N''''), N'<NULL>')
            FROM (SELECT DISTINCT TrangThaiHopDong FROM dbo.HopDong) x
            ORDER BY x.TrangThaiHopDong
            FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, N'');
        SELECT @TrangThaiLa = STUFF((
            SELECT N'; ' + QUOTENAME(cc.name) + N'=' + cc.definition
            FROM sys.check_constraints cc
            WHERE cc.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND cc.definition LIKE N'%TrangThaiHopDong%'
            ORDER BY cc.name
            FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, N'');
        PRINT N'[014] TrangThaiHopDong hiện có: ' + COALESCE(@TrangThaiDangCo, N'(không có dòng)');
        PRINT N'[014] CHECK liên quan TrangThaiHopDong: ' + COALESCE(@TrangThaiLa, N'(không có)');

        IF EXISTS (
            SELECT 1 FROM dbo.HopDong
            WHERE TrangThaiHopDong IS NULL
               OR TrangThaiHopDong NOT IN (N'Còn hiệu lực', N'Đã kết thúc')
        )
        BEGIN
            SET @TrangThaiDangCo = LEFT(
                N'Trạng thái hợp đồng ngoài CHECK đang dùng; dừng để bảo toàn dữ liệu: '
                + COALESCE(@TrangThaiDangCo, N'<NULL>'), 2048);
            THROW 51403, @TrangThaiDangCo, 1;
        END;

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.HopDong hd
                    LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                    LEFT JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                    WHERE sv.MaSinhVien IS NULL OR p.TenPhong IS NULL
                )
                BEGIN
                    DECLARE @ThieuHieuLuc nvarchar(max);
                    SELECT @ThieuHieuLuc = STUFF((
                        SELECT N'', '' + hd.MaHopDong + N'' (SV='' + COALESCE(hd.MaSinhVien, N''<NULL>'')
                             + N'', phòng='' + COALESCE(hd.TenPhong, N''<NULL>'') + N'')''
                        FROM dbo.HopDong hd
                        LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                        LEFT JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                        WHERE sv.MaSinhVien IS NULL OR p.TenPhong IS NULL
                        ORDER BY hd.MaHopDong
                        FOR XML PATH(''''), TYPE
                    ).value(''.'', ''nvarchar(max)''), 1, 2, N'''');
                    SET @ThieuHieuLuc = LEFT(N''Hợp đồng thiếu sinh viên/phòng: '' + @ThieuHieuLuc, 2048);
                    THROW 51404, @ThieuHieuLuc, 1;
                END;

                IF EXISTS (
                    SELECT MaSinhVien
                    FROM dbo.HopDong
                    WHERE TrangThaiHopDong = N''Còn hiệu lực''
                    GROUP BY MaSinhVien
                    HAVING COUNT_BIG(*) > 1
                )
                BEGIN
                    DECLARE @TrungSinhVien nvarchar(max);
                    SELECT @TrungSinhVien = STUFF((
                        SELECT N'', '' + d.MaSinhVien + N'' ('' + CONVERT(nvarchar(20), d.SoHopDong) + N'' hợp đồng)''
                        FROM (
                            SELECT MaSinhVien, COUNT_BIG(*) AS SoHopDong
                            FROM dbo.HopDong
                            WHERE TrangThaiHopDong = N''Còn hiệu lực''
                            GROUP BY MaSinhVien
                            HAVING COUNT_BIG(*) > 1
                        ) d
                        ORDER BY d.MaSinhVien
                        FOR XML PATH(''''), TYPE
                    ).value(''.'', ''nvarchar(max)''), 1, 2, N'''');
                    SET @TrungSinhVien = LEFT(N''Sinh viên có nhiều hợp đồng hiệu lực: '' + @TrungSinhVien, 2048);
                    THROW 51405, @TrungSinhVien, 1;
                END;';

        IF EXISTS (
            SELECT 1
            FROM dbo.HopDong hd
            LEFT JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
            WHERE p.TenPhong IS NULL
        )
            THROW 51406, N'Có hợp đồng (kể cả đã kết thúc) tham chiếu phòng không tồn tại; không thể tạo FK.', 1;

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.HopDong hd
                    INNER JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                    WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
                      AND (sv.GioiTinh IS NULL OR p.LoaiPhong IS NULL OR sv.GioiTinh <> p.LoaiPhong)
                )
                BEGIN
                    DECLARE @SaiGioiTinh nvarchar(max);
                    SELECT @SaiGioiTinh = STUFF((
                        SELECT N'', '' + hd.MaHopDong + N''/'' + hd.MaSinhVien + N''/'' + hd.TenPhong
                        FROM dbo.HopDong hd
                        INNER JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                        INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                        WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
                          AND (sv.GioiTinh IS NULL OR p.LoaiPhong IS NULL OR sv.GioiTinh <> p.LoaiPhong)
                        ORDER BY hd.MaHopDong
                        FOR XML PATH(''''), TYPE
                    ).value(''.'', ''nvarchar(max)''), 1, 2, N'''');
                    SET @SaiGioiTinh = LEFT(N''Sinh viên lệch giới tính phòng: '' + @SaiGioiTinh, 2048);
                    THROW 51407, @SaiGioiTinh, 1;
                END;';

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.SinhVien sv
                    WHERE sv.TenPhong IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM dbo.HopDong hd
                          WHERE hd.MaSinhVien = sv.MaSinhVien
                            AND hd.TenPhong = sv.TenPhong
                            AND hd.TrangThaiHopDong = N''Còn hiệu lực''
                      )
                )
                    THROW 51417, N''Sinh viên đang gán phòng nhưng không có hợp đồng hiệu lực khớp; cần đối soát trước khi chuyển đổi.'', 1;';

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.HopDong hd
                    WHERE EXISTS (
                        SELECT 1 FROM dbo.LichSuHopDong ls
                        WHERE ls.MaHopDong = hd.MaHopDong AND ls.ThaoTac = N''Chuyển phòng''
                    )
                      AND NOT EXISTS (
                        SELECT 1 FROM dbo.LichSuHopDong ls
                        WHERE ls.MaHopDong = hd.MaHopDong AND ls.ThaoTac = N''Tạo mới''
                    )
                )
                    THROW 51418, N''Hợp đồng có lịch sử chuyển phòng nhưng thiếu log Tạo mới; không thể khôi phục hạng phòng lúc ký một cách an toàn.'', 1;';

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'
                IF EXISTS (
                    SELECT 1
                    FROM dbo.LichSuHopDong ls
                    WHERE ls.ThaoTac = N''Tạo mới''
                      AND NOT EXISTS (SELECT 1 FROM dbo.Phong p WHERE p.TenPhong = ls.TenPhong)
                )
                    THROW 51419, N''Log Tạo mới tham chiếu phòng không còn tồn tại; cần đối soát trước khi chuyển đổi.'', 1;';

        IF OBJECT_ID(N'dbo.LichSuHopDong_Backup', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.LichSuHopDong_Backup
            (
                MaLichSu int NOT NULL CONSTRAINT PK_LichSuHopDong_Backup PRIMARY KEY,
                MaHopDong nvarchar(20) NOT NULL,
                MaSinhVien nvarchar(30) NOT NULL,
                HoTen nvarchar(100) NULL,
                TenPhong nvarchar(50) NULL,
                NgayBatDau date NULL,
                NgayKetThuc date NULL,
                TrangThaiHopDong nvarchar(20) NULL,
                ThaoTac nvarchar(30) NOT NULL,
                NguoiThucHien int NULL,
                ThoiGian datetime NOT NULL
            );
        END;

        IF COL_LENGTH(N'dbo.NhatKyHeThong', N'ChiTiet') IS NULL
            THROW 51408, N'Không tìm thấy NhatKyHeThong.ChiTiet.', 1;
        IF COL_LENGTH(N'dbo.NhatKyHeThong', N'HanhDong') IS NULL
           OR COL_LENGTH(N'dbo.NhatKyHeThong', N'DoiTuong') IS NULL
           OR COL_LENGTH(N'dbo.NhatKyHeThong', N'MaDoiTuong') IS NULL
           OR COL_LENGTH(N'dbo.NhatKyHeThong', N'ThoiGian') IS NULL
           OR COL_LENGTH(N'dbo.NhatKyHeThong', N'MaTaiKhoan') IS NULL
            THROW 51409, N'Cấu trúc NhatKyHeThong thiếu cột cần chuyển log.', 1;

        SELECT @MaDoiTuongCan = c.max_length
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.NhatKyHeThong') AND c.name = N'MaDoiTuong';
        IF @MaDoiTuongCan <> -1 AND @MaDoiTuongCan < 48
            THROW 51410, N'NhatKyHeThong.MaDoiTuong không đủ dài cho LichSuHopDong:<MaLichSu>.', 1;

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.NhatKyHeThong')
              AND (definition LIKE N'%HanhDong%' OR definition LIKE N'%DoiTuong%')
        )
        BEGIN
            SELECT name, definition
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.NhatKyHeThong')
              AND (definition LIKE N'%HanhDong%' OR definition LIKE N'%DoiTuong%');
            THROW 51411, N'NhatKyHeThong có CHECK giới hạn HanhDong/DoiTuong; cần xem lại trước khi chuyển log.', 1;
        END;

        ALTER TABLE dbo.NhatKyHeThong ALTER COLUMN ChiTiet nvarchar(max) NULL;

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            EXEC sys.sp_executesql N'
                DECLARE @SoLog bigint, @SoBackup bigint, @SoNhatKy bigint;

                INSERT INTO dbo.LichSuHopDong_Backup
                    (MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc,
                     TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian)
                SELECT ls.MaLichSu, ls.MaHopDong, ls.MaSinhVien, ls.HoTen, ls.TenPhong, ls.NgayBatDau,
                       ls.NgayKetThuc, ls.TrangThaiHopDong, ls.ThaoTac, ls.NguoiThucHien, ls.ThoiGian
                FROM dbo.LichSuHopDong ls
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.LichSuHopDong_Backup b WHERE b.MaLichSu = ls.MaLichSu
                );

                INSERT INTO dbo.NhatKyHeThong
                    (ThoiGian, MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
                SELECT ls.ThoiGian, ls.NguoiThucHien, ls.ThaoTac, N''HopDong'',
                       N''LichSuHopDong:'' + CONVERT(nvarchar(10), ls.MaLichSu),
                       (
                           SELECT N''LichSuHopDong'' AS nguon, ls.MaLichSu, ls.MaHopDong, ls.MaSinhVien,
                                  ls.HoTen, ls.TenPhong, ls.NgayBatDau, ls.NgayKetThuc,
                                  ls.TrangThaiHopDong, ls.ThaoTac, ls.NguoiThucHien, ls.ThoiGian
                           FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
                       )
                FROM dbo.LichSuHopDong ls
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM dbo.NhatKyHeThong nk
                    WHERE nk.DoiTuong = N''HopDong''
                      AND nk.MaDoiTuong = N''LichSuHopDong:'' + CONVERT(nvarchar(10), ls.MaLichSu)
                      AND ISJSON(nk.ChiTiet) = 1
                      AND JSON_VALUE(nk.ChiTiet, ''$.nguon'') = N''LichSuHopDong''
                      AND TRY_CONVERT(int, JSON_VALUE(nk.ChiTiet, ''$.MaLichSu'')) = ls.MaLichSu
                );

                SELECT @SoLog = COUNT_BIG(*) FROM dbo.LichSuHopDong;
                SELECT @SoBackup = COUNT_BIG(*) FROM dbo.LichSuHopDong_Backup b
                INNER JOIN dbo.LichSuHopDong ls ON ls.MaLichSu = b.MaLichSu;
                SELECT @SoNhatKy = COUNT_BIG(*)
                FROM dbo.NhatKyHeThong nk
                WHERE nk.DoiTuong = N''HopDong''
                  AND JSON_VALUE(nk.ChiTiet, ''$.nguon'') = N''LichSuHopDong'';
                PRINT N''[014] Log nguồn='' + CONVERT(nvarchar(20), @SoLog)
                    + N''; bản sao khớp='' + CONVERT(nvarchar(20), @SoBackup)
                    + N''; nhật ký chuyển='' + CONVERT(nvarchar(20), @SoNhatKy);

                IF @SoLog <> @SoBackup OR @SoLog <> @SoNhatKy
                    THROW 51412, N''Số dòng sao lưu/chuyển nhật ký không khớp; rollback, không tiếp tục.'', 1;

                IF EXISTS (
                    SELECT MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                           NgayKetThuc, TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian
                    FROM dbo.LichSuHopDong
                    EXCEPT
                    SELECT MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                           NgayKetThuc, TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian
                    FROM dbo.LichSuHopDong_Backup
                )
                OR EXISTS (
                    SELECT MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                           NgayKetThuc, TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian
                    FROM dbo.LichSuHopDong_Backup
                    EXCEPT
                    SELECT MaLichSu, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                           NgayKetThuc, TrangThaiHopDong, ThaoTac, NguoiThucHien, ThoiGian
                    FROM dbo.LichSuHopDong
                )
                    THROW 51455, N''Nội dung LichSuHopDong_Backup không khớp từng dòng nguồn; rollback migration.'', 1;

                IF EXISTS (
                    SELECT 1
                    FROM dbo.LichSuHopDong_Backup b
                    LEFT JOIN dbo.NhatKyHeThong nk
                      ON nk.DoiTuong = N''HopDong''
                     AND nk.MaDoiTuong = N''LichSuHopDong:'' + CONVERT(nvarchar(10), b.MaLichSu)
                     AND JSON_VALUE(nk.ChiTiet, ''$.nguon'') = N''LichSuHopDong''
                     AND TRY_CONVERT(int, JSON_VALUE(nk.ChiTiet, ''$.MaLichSu'')) = b.MaLichSu
                    WHERE EXISTS (SELECT 1 FROM dbo.LichSuHopDong ls WHERE ls.MaLichSu = b.MaLichSu)
                      AND nk.MaNhatKy IS NULL
                )
                    THROW 51413, N''Thiếu event nhật ký khớp từng MaLichSu; rollback migration.'', 1;';

        IF OBJECT_ID(N'dbo.ChiTietHopDong', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ChiTietHopDong
            (
                MaChiTiet int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChiTietHopDong PRIMARY KEY,
                MaHopDong nvarchar(20) NOT NULL,
                MaSinhVien nvarchar(30) NOT NULL,
                NgayVao date NOT NULL,
                NgayRa date NULL,
                KyHanThanhToanPhong nvarchar(10) NOT NULL
                    CONSTRAINT DF_ChiTietHopDong_KyHan DEFAULT (N'THANG'),
                GiaPhongApDung decimal(18,2) NOT NULL,
                GiaPhongThangApDung decimal(18,2) NOT NULL,
                LaNguoiDaiDienThanhToanDichVu bit NOT NULL
                    CONSTRAINT DF_ChiTietHopDong_DaiDien DEFAULT (0),
                TrangThai nvarchar(20) NOT NULL,
                GhiChu nvarchar(255) NULL,
                LyDoRoi nvarchar(100) NULL,
                NgayTao datetime NOT NULL CONSTRAINT DF_ChiTietHopDong_NgayTao DEFAULT (GETDATE()),
                CONSTRAINT FK_CTHD_HopDong FOREIGN KEY (MaHopDong) REFERENCES dbo.HopDong (MaHopDong),
                CONSTRAINT FK_CTHD_SinhVien FOREIGN KEY (MaSinhVien) REFERENCES dbo.SinhVien (MaSinhVien),
                CONSTRAINT CK_CTHD_KyHan CHECK (KyHanThanhToanPhong IN (N'THANG', N'NAM')),
                CONSTRAINT CK_CTHD_TrangThai CHECK (TrangThai IN (N'Đang ở', N'Đã rời', N'Đã chuyển phòng')),
                CONSTRAINT CK_CTHD_Ngay CHECK (NgayRa IS NULL OR NgayRa >= NgayVao),
                CONSTRAINT CK_CTHD_TrangThai_NgayRa CHECK (
                    (TrangThai = N'Đang ở' AND NgayRa IS NULL)
                    OR (TrangThai <> N'Đang ở' AND NgayRa IS NOT NULL)
                ),
                CONSTRAINT CK_CTHD_Gia CHECK (GiaPhongApDung >= 0 AND GiaPhongThangApDung >= 0)
            );
        END;

        IF COL_LENGTH(N'dbo.HopDong', N'MaHangPhong') IS NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HopDong ADD MaHangPhong nvarchar(20) NULL;';

        EXEC sys.sp_executesql N'
            UPDATE hd
            SET MaHangPhong = COALESCE(hpFirst.MaHangPhong, pCurrent.MaHangPhong)
            FROM dbo.HopDong hd
            LEFT JOIN dbo.Phong pCurrent ON pCurrent.TenPhong = hd.TenPhong
            OUTER APPLY (
                SELECT TOP (1) pFirst.MaHangPhong
                FROM dbo.LichSuHopDong_Backup ls
                INNER JOIN dbo.Phong pFirst ON pFirst.TenPhong = ls.TenPhong
                WHERE ls.MaHopDong = hd.MaHopDong AND ls.ThaoTac = N''Tạo mới''
                ORDER BY ls.ThoiGian, ls.MaLichSu
            ) hpFirst
            WHERE hd.MaHangPhong IS NULL;
        ';

        DECLARE @MissingRoomTier bit = 0;
        EXEC sys.sp_executesql N'
            IF EXISTS (
                SELECT 1
                FROM dbo.HopDong hd
                LEFT JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
                WHERE hp.MaHangPhong IS NULL
            ) SET @MissingRoomTier = 1;',
            N'@MissingRoomTier bit OUTPUT', @MissingRoomTier = @MissingRoomTier OUTPUT;
        IF @MissingRoomTier = 1
            THROW 51414, N'Không xác định được hạng phòng cho mọi hợp đồng; xem log Tạo mới và Phong.', 1;

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.HopDong'') AND name = N''FK_HopDong_HangPhong''
            )
                ALTER TABLE dbo.HopDong WITH CHECK
                    ADD CONSTRAINT FK_HopDong_HangPhong
                    FOREIGN KEY (MaHangPhong) REFERENCES dbo.HangPhong (MaHangPhong);
            IF NOT EXISTS (
                SELECT 1 FROM sys.foreign_keys
                WHERE parent_object_id = OBJECT_ID(N''dbo.HopDong'') AND name = N''FK_HopDong_Phong''
            )
                ALTER TABLE dbo.HopDong WITH CHECK
                    ADD CONSTRAINT FK_HopDong_Phong
                    FOREIGN KEY (TenPhong) REFERENCES dbo.Phong (TenPhong);
            ALTER TABLE dbo.HopDong ALTER COLUMN MaHangPhong nvarchar(20) NOT NULL;';

        DECLARE @CapacityIssue nvarchar(max);
        SELECT @CapacityIssue = STUFF((
            SELECT N', ' + p.TenPhong + N' (' + CONVERT(nvarchar(20), x.SoNguoi) + N'/'
                 + CONVERT(nvarchar(20), p.SucChuaToiDa) + N')'
            FROM (
                SELECT hd.TenPhong, COUNT_BIG(*) AS SoNguoi
                FROM dbo.HopDong hd
                WHERE hd.TrangThaiHopDong = N'Còn hiệu lực'
                GROUP BY hd.TenPhong
            ) x
            INNER JOIN dbo.Phong p ON p.TenPhong = x.TenPhong
            WHERE x.SoNguoi > p.SucChuaToiDa
            ORDER BY p.TenPhong
            FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, N'');
        IF @CapacityIssue IS NOT NULL
        BEGIN
            SET @CapacityIssue = LEFT(N'Sĩ số hợp đồng hiệu lực vượt sức chứa: ' + @CapacityIssue, 2048);
            THROW 51415, @CapacityIssue, 1;
        END;

        EXEC sys.sp_executesql N'
            INSERT INTO dbo.ChiTietHopDong
                (MaHopDong, MaSinhVien, NgayVao, NgayRa, KyHanThanhToanPhong,
                 GiaPhongApDung, GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu,
                 TrangThai, GhiChu)
            SELECT hd.MaHopDong,
                   hd.MaSinhVien,
                   COALESCE(CAST(move.ThoiGian AS date), hd.NgayBatDau),
                   CASE WHEN hd.TrangThaiHopDong = N''Còn hiệu lực'' THEN NULL
                        WHEN COALESCE(hd.NgayKetThucThucTe, hd.NgayKetThuc) < COALESCE(CAST(move.ThoiGian AS date), hd.NgayBatDau)
                            THEN COALESCE(CAST(move.ThoiGian AS date), hd.NgayBatDau)
                        ELSE COALESCE(hd.NgayKetThucThucTe, hd.NgayKetThuc) END,
                   N''THANG'',
                   hp.GiaPhongThang,
                   hp.GiaPhongThang,
                   CASE WHEN hd.TrangThaiHopDong = N''Còn hiệu lực'' THEN 1 ELSE 0 END,
                   CASE WHEN hd.TrangThaiHopDong = N''Còn hiệu lực'' THEN N''Đang ở'' ELSE N''Đã rời'' END,
                   hd.GhiChu
            FROM dbo.HopDong hd
            INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
            OUTER APPLY (
                SELECT TOP (1) ls.ThoiGian
                FROM dbo.LichSuHopDong_Backup ls
                WHERE ls.MaHopDong = hd.MaHopDong
                  AND ls.ThaoTac = N''Chuyển phòng''
                  AND ls.TenPhong = hd.TenPhong
                ORDER BY ls.ThoiGian DESC, ls.MaLichSu DESC
            ) move
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.ChiTietHopDong c
                WHERE c.MaHopDong = hd.MaHopDong AND c.MaSinhVien = hd.MaSinhVien
            );
        ';

        EXEC sys.sp_executesql N'
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.ChiTietHopDong'') AND name = N''IX_CTHD_MaHopDong'')
                CREATE INDEX IX_CTHD_MaHopDong ON dbo.ChiTietHopDong (MaHopDong);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.ChiTietHopDong'') AND name = N''IX_CTHD_MaSinhVien'')
                CREATE INDEX IX_CTHD_MaSinhVien ON dbo.ChiTietHopDong (MaSinhVien);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.ChiTietHopDong'') AND name = N''UX_CTHD_SinhVien_DangO'')
                CREATE UNIQUE INDEX UX_CTHD_SinhVien_DangO ON dbo.ChiTietHopDong (MaSinhVien)
                    WHERE TrangThai = N''Đang ở'';
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N''dbo.ChiTietHopDong'') AND name = N''UX_CTHD_DaiDien_DangO'')
                CREATE UNIQUE INDEX UX_CTHD_DaiDien_DangO ON dbo.ChiTietHopDong (MaHopDong)
                    WHERE LaNguoiDaiDienThanhToanDichVu = 1 AND TrangThai = N''Đang ở'';';

        IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'UQ_HopDong_MotHieuLuc'
        )
            DROP INDEX UQ_HopDong_MotHieuLuc ON dbo.HopDong;
        IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_MaSV_TrangThai'
        )
            DROP INDEX IX_HopDong_MaSV_TrangThai ON dbo.HopDong;

        IF EXISTS (
            SELECT 1
            FROM sys.key_constraints kc
            INNER JOIN sys.index_columns ic
                ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
            INNER JOIN sys.columns c
                ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE kc.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND kc.type = N'PK'
              AND c.name = N'MaSinhVien'
        )
            THROW 51458, N'Khóa chính của HopDong còn dùng MaSinhVien; cần đối soát trước khi bỏ cột.', 1;

        DECLARE @DropKey sysname;
        DECLARE @DropSql nvarchar(max);
        DECLARE key_contract CURSOR LOCAL FAST_FORWARD FOR
            SELECT DISTINCT kc.name
            FROM sys.key_constraints kc
            INNER JOIN sys.index_columns ic
                ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
            INNER JOIN sys.columns c
                ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE kc.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND kc.type = N'UQ'
              AND c.name = N'MaSinhVien';
        OPEN key_contract;
        FETCH NEXT FROM key_contract INTO @DropKey;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @DropSql = N'ALTER TABLE dbo.HopDong DROP CONSTRAINT ' + QUOTENAME(@DropKey) + N';';
            EXEC sys.sp_executesql @DropSql;
            FETCH NEXT FROM key_contract INTO @DropKey;
        END;
        CLOSE key_contract;
        DEALLOCATE key_contract;

        IF EXISTS (
            SELECT 1
            FROM sys.foreign_key_columns fkc
            INNER JOIN sys.columns c
                ON c.object_id = fkc.referenced_object_id
               AND c.column_id = fkc.referenced_column_id
            WHERE fkc.referenced_object_id = OBJECT_ID(N'dbo.HopDong')
              AND c.name = N'MaSinhVien'
        )
            THROW 51453, N'Bảng khác còn khóa ngoại tới HopDong.MaSinhVien; cần xử lý trước khi bỏ cột.', 1;

        DECLARE @DropFk sysname;
        DECLARE fk_contract CURSOR LOCAL FAST_FORWARD FOR
            SELECT DISTINCT fk.name
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            INNER JOIN sys.columns c
                ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
            WHERE fk.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND c.name = N'MaSinhVien';
        OPEN fk_contract;
        FETCH NEXT FROM fk_contract INTO @DropFk;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @DropSql = N'ALTER TABLE dbo.HopDong DROP CONSTRAINT ' + QUOTENAME(@DropFk) + N';';
            EXEC sys.sp_executesql @DropSql;
            FETCH NEXT FROM fk_contract INTO @DropFk;
        END;
        CLOSE fk_contract;
        DEALLOCATE fk_contract;

        DECLARE @DropIndex sysname;
        DECLARE ix_contract CURSOR LOCAL FAST_FORWARD FOR
            SELECT i.name
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.object_id = OBJECT_ID(N'dbo.HopDong')
              AND i.index_id > 0 AND i.is_primary_key = 0 AND i.is_unique_constraint = 0
              AND (c.name = N'MaSinhVien' OR i.filter_definition LIKE N'%MaSinhVien%')
            GROUP BY i.name;
        OPEN ix_contract;
        FETCH NEXT FROM ix_contract INTO @DropIndex;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @DropSql = N'DROP INDEX ' + QUOTENAME(@DropIndex) + N' ON dbo.HopDong;';
            EXEC sys.sp_executesql @DropSql;
            FETCH NEXT FROM ix_contract INTO @DropIndex;
        END;
        CLOSE ix_contract;
        DEALLOCATE ix_contract;

        DECLARE @DropDefault sysname;
        DECLARE default_contract CURSOR LOCAL FAST_FORWARD FOR
            SELECT dc.name
            FROM sys.default_constraints dc
            INNER JOIN sys.columns c
                ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
            WHERE dc.parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND c.name = N'MaSinhVien';
        OPEN default_contract;
        FETCH NEXT FROM default_contract INTO @DropDefault;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @DropSql = N'ALTER TABLE dbo.HopDong DROP CONSTRAINT ' + QUOTENAME(@DropDefault) + N';';
            EXEC sys.sp_executesql @DropSql;
            FETCH NEXT FROM default_contract INTO @DropDefault;
        END;
        CLOSE default_contract;
        DEALLOCATE default_contract;

        IF OBJECT_ID(N'dbo.vw_LichSuHopDongFE', N'V') IS NOT NULL
            DROP VIEW dbo.vw_LichSuHopDongFE;
        IF OBJECT_ID(N'dbo.vw_HopDongSapHetHan', N'V') IS NOT NULL
            DROP VIEW dbo.vw_HopDongSapHetHan;
        IF OBJECT_ID(N'dbo.vw_SinhVienChiTiet', N'V') IS NOT NULL
            DROP VIEW dbo.vw_SinhVienChiTiet;

        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.HopDong')
              AND definition LIKE N'%MaSinhVien%'
        )
            THROW 51416, N'CHECK constraint còn tham chiếu HopDong.MaSinhVien; không thể bỏ cột an toàn.', 1;

        IF COL_LENGTH(N'dbo.HopDong', N'MaSinhVien') IS NOT NULL
            EXEC sys.sp_executesql N'ALTER TABLE dbo.HopDong DROP COLUMN MaSinhVien;';

        IF OBJECT_ID(N'dbo.LichSuHopDong', N'U') IS NOT NULL
            DROP TABLE dbo.LichSuHopDong;

        IF OBJECT_ID(N'dbo.TRG_UpdatePhong', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdatePhong;
        IF OBJECT_ID(N'dbo.TRG_UpdateRoomCount', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdateRoomCount;
        IF OBJECT_ID(N'dbo.TRG_UpdateTrangThaiHopDong', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdateTrangThaiHopDong;

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GhiNhatKyHopDong
    @HanhDong nvarchar(50),
    @MaHopDong nvarchar(20),
    @ChiTiet nvarchar(500) = NULL,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.NhatKyHeThong (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
    VALUES (@NguoiThucHien, @HanhDong, N''HopDong'', @MaHopDong, @ChiTiet);
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_TaoHopDong
    @TenPhong nvarchar(50),
    @NgayBatDau date,
    @NgayKetThuc date,
    @SinhVienJson nvarchar(max),
    @GhiChu nvarchar(255) = NULL,
    @NguoiThucHien int = NULL,
    @MaHopDong nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @NgayKetThuc <= @NgayBatDau THROW 51420, N''Ngày kết thúc phải sau ngày bắt đầu.'', 1;
    IF ISJSON(@SinhVienJson) <> 1 THROW 51421, N''Danh sách sinh viên phải là JSON hợp lệ.'', 1;

    DECLARE @Members table (
        MaSinhVien nvarchar(30) NOT NULL PRIMARY KEY,
        KyHan nvarchar(10) NOT NULL,
        LaDaiDien bit NOT NULL
    );
    INSERT INTO @Members (MaSinhVien, KyHan, LaDaiDien)
    SELECT MaSinhVien, COALESCE(NULLIF(KyHan, N''''), N''THANG''), COALESCE(LaDaiDien, 0)
    FROM OPENJSON(@SinhVienJson)
    WITH (
        MaSinhVien nvarchar(30) N''$.maSinhVien'',
        KyHan nvarchar(10) N''$.kyHanThanhToanPhong'',
        LaDaiDien bit N''$.laNguoiDaiDien''
    );
    IF NOT EXISTS (SELECT 1 FROM @Members) THROW 51422, N''Hợp đồng cần ít nhất một sinh viên.'', 1;
    IF EXISTS (SELECT 1 FROM @Members WHERE KyHan NOT IN (N''THANG'', N''NAM''))
        THROW 51423, N''Kỳ hạn tiền phòng phải là THANG hoặc NAM.'', 1;
    IF (SELECT COUNT(*) FROM @Members WHERE LaDaiDien = 1) > 1
        THROW 51424, N''Mỗi hợp đồng chỉ có tối đa một người đại diện.'', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Gender nvarchar(10), @Capacity int, @RoomStatus nvarchar(20),
                @RoomCount int, @Hang nvarchar(20), @ContractId nvarchar(20);
        SELECT @Gender = p.LoaiPhong, @Capacity = hp.SucChuaToiDa,
               @RoomStatus = p.TrangThaiPhong,
               @Hang = p.MaHangPhong
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TenPhong = @TenPhong;
        IF @Gender IS NULL THROW 51425, N''Không tìm thấy phòng hoặc hạng phòng.'', 1;
        IF @RoomStatus IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 51426, N''Phòng đang bảo trì hoặc ngưng sử dụng.'', 1;
        IF EXISTS (SELECT 1 FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
                   WHERE TenPhong = @TenPhong AND TrangThaiHopDong = N''Còn hiệu lực'')
            THROW 51427, N''Phòng đã có hợp đồng hiệu lực; hãy thêm sinh viên vào hợp đồng đó.'', 1;
        SELECT @RoomCount = COUNT(*)
        FROM dbo.HopDong hd
        INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
        WHERE hd.TenPhong = @TenPhong
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND c.TrangThai = N''Đang ở'';
        IF EXISTS (
            SELECT 1
            FROM @Members m
            LEFT JOIN dbo.SinhVien sv WITH (UPDLOCK, HOLDLOCK) ON sv.MaSinhVien = m.MaSinhVien
            WHERE sv.MaSinhVien IS NULL OR sv.GioiTinh IS NULL OR sv.GioiTinh <> @Gender
               OR EXISTS (SELECT 1 FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
                          WHERE c.MaSinhVien = m.MaSinhVien AND c.TrangThai = N''Đang ở'')
        )
            THROW 51428, N''Có sinh viên không tồn tại, sai giới tính hoặc đã có chỗ ở hiệu lực.'', 1;
        IF @RoomCount + (SELECT COUNT(*) FROM @Members) > @Capacity
            THROW 51429, N''Số sinh viên vượt sức chứa hạng phòng.'', 1;

        IF NOT EXISTS (SELECT 1 FROM @Members WHERE LaDaiDien = 1)
            UPDATE @Members SET LaDaiDien = 1
            WHERE MaSinhVien = (SELECT MIN(MaSinhVien) FROM @Members);

        SET @ContractId = NULLIF(LTRIM(RTRIM(@MaHopDong)), N'''');
        IF @ContractId IS NULL
            SET @ContractId = N''HD'' + RIGHT(N''00000'' + CONVERT(nvarchar(10), NEXT VALUE FOR dbo.Seq_MaHopDong), 5);
        IF EXISTS (SELECT 1 FROM dbo.HopDong WHERE MaHopDong = @ContractId)
            THROW 51430, N''Mã hợp đồng đã tồn tại.'', 1;

        INSERT INTO dbo.HopDong
            (MaHopDong, TenPhong, MaHangPhong, NgayBatDau, NgayKetThuc,
             TrangThaiHopDong, NgayTao, GhiChu, SoLanGiaHan)
        VALUES
            (@ContractId, @TenPhong, @Hang, @NgayBatDau, @NgayKetThuc,
             N''Còn hiệu lực'', CAST(GETDATE() AS date), @GhiChu, 0);

        INSERT INTO dbo.ChiTietHopDong
            (MaHopDong, MaSinhVien, NgayVao, KyHanThanhToanPhong, GiaPhongApDung,
             GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu, TrangThai, GhiChu)
        SELECT @ContractId, m.MaSinhVien, @NgayBatDau, m.KyHan,
               CASE WHEN m.KyHan = N''NAM'' THEN hp.GiaPhongNam ELSE hp.GiaPhongThang END,
               hp.GiaPhongThang, m.LaDaiDien, N''Đang ở'', @GhiChu
        FROM @Members m
        CROSS JOIN dbo.HangPhong hp
        WHERE hp.MaHangPhong = @Hang;

        EXEC dbo.sp_GhiNhatKyHopDong N''Tạo mới'', @ContractId, N''Tạo hợp đồng theo phòng.'', @NguoiThucHien;
        COMMIT TRANSACTION;
        SELECT @ContractId AS MaHopDong;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVienVaoHopDong
    @MaHopDong nvarchar(20),
    @MaSinhVien nvarchar(30),
    @KyHanThanhToanPhong nvarchar(10) = N''THANG'',
    @LaNguoiDaiDien bit = 0,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @KyHanThanhToanPhong NOT IN (N''THANG'', N''NAM'')
        THROW 51431, N''Kỳ hạn tiền phòng phải là THANG hoặc NAM.'', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Room nvarchar(50), @Hang nvarchar(20), @Gender nvarchar(10),
                @Capacity int, @Count int, @End date, @RoomStatus nvarchar(20);
        SELECT @Room = hd.TenPhong, @Hang = hd.MaHangPhong, @End = hd.NgayKetThuc,
               @Gender = p.LoaiPhong, @RoomStatus = p.TrangThaiPhong, @Capacity = hp.SucChuaToiDa
        FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Phong p WITH (UPDLOCK, HOLDLOCK) ON p.TenPhong = hd.TenPhong
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
        WHERE hd.MaHopDong = @MaHopDong AND hd.TrangThaiHopDong = N''Còn hiệu lực'';
        IF @Room IS NULL THROW 51432, N''Không tìm thấy hợp đồng hiệu lực.'', 1;
        IF @RoomStatus IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 51433, N''Phòng đang bảo trì hoặc ngưng sử dụng.'', 1;
        SELECT @Count = COUNT(*)
        FROM dbo.ChiTietHopDong
        WHERE MaHopDong = @MaHopDong AND TrangThai = N''Đang ở'';
        IF EXISTS (
            SELECT 1 FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK)
            WHERE MaSinhVien = @MaSinhVien AND GioiTinh = @Gender
        ) AND NOT EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaSinhVien = @MaSinhVien AND TrangThai = N''Đang ở''
        )
        BEGIN
            IF @Count >= @Capacity THROW 51434, N''Phòng đã đủ sức chứa.'', 1;
            IF @LaNguoiDaiDien = 1
                UPDATE dbo.ChiTietHopDong
                SET LaNguoiDaiDienThanhToanDichVu = 0
                WHERE MaHopDong = @MaHopDong AND TrangThai = N''Đang ở'';

            INSERT INTO dbo.ChiTietHopDong
                (MaHopDong, MaSinhVien, NgayVao, KyHanThanhToanPhong, GiaPhongApDung,
                 GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu, TrangThai)
            SELECT @MaHopDong, @MaSinhVien, CAST(GETDATE() AS date), @KyHanThanhToanPhong,
                   CASE WHEN @KyHanThanhToanPhong = N''NAM'' THEN hp.GiaPhongNam ELSE hp.GiaPhongThang END,
                   hp.GiaPhongThang, @LaNguoiDaiDien, N''Đang ở''
            FROM dbo.HangPhong hp WHERE hp.MaHangPhong = @Hang;
        END
        ELSE
            THROW 51435, N''Sinh viên không tồn tại, sai giới tính hoặc đã có hợp đồng hiệu lực.'', 1;
        EXEC dbo.sp_GhiNhatKyHopDong N''Thêm sinh viên'', @MaHopDong, @MaSinhVien, @NguoiThucHien;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_SinhVienRoiHopDong
    @MaChiTiet int,
    @NgayRa date = NULL,
    @LyDoRoi nvarchar(100) = NULL,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Contract nvarchar(20), @Student nvarchar(30), @Room nvarchar(50),
                @WasRep bit, @LeaveDate date = COALESCE(@NgayRa, CAST(GETDATE() AS date)),
                @NextRep int;
        SELECT @Contract = c.MaHopDong, @Student = c.MaSinhVien,
               @Room = hd.TenPhong, @WasRep = c.LaNguoiDaiDienThanhToanDichVu
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaChiTiet = @MaChiTiet AND c.TrangThai = N''Đang ở'';
        IF @Contract IS NULL THROW 51436, N''Không tìm thấy chi tiết hợp đồng đang ở.'', 1;
        IF @LeaveDate < (SELECT NgayVao FROM dbo.ChiTietHopDong WHERE MaChiTiet = @MaChiTiet)
            THROW 51437, N''Ngày rời không được trước ngày vào.'', 1;

        IF @WasRep = 1
        BEGIN
            SELECT TOP (1) @NextRep = MaChiTiet
            FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaHopDong = @Contract AND TrangThai = N''Đang ở'' AND MaChiTiet <> @MaChiTiet
            ORDER BY NgayVao, MaChiTiet;
            UPDATE dbo.ChiTietHopDong
            SET LaNguoiDaiDienThanhToanDichVu = 0
            WHERE MaChiTiet = @MaChiTiet;
            IF @NextRep IS NOT NULL
                UPDATE dbo.ChiTietHopDong
                SET LaNguoiDaiDienThanhToanDichVu = 1
                WHERE MaChiTiet = @NextRep;
        END;
        UPDATE dbo.ChiTietHopDong
        SET TrangThai = N''Đã rời'', NgayRa = @LeaveDate, LyDoRoi = @LyDoRoi,
            LaNguoiDaiDienThanhToanDichVu = 0
        WHERE MaChiTiet = @MaChiTiet;
        EXEC dbo.sp_GhiNhatKyHopDong N''Sinh viên rời hợp đồng'', @Contract, @Student, @NguoiThucHien;
        COMMIT TRANSACTION;
        IF @WasRep = 1 AND @NextRep IS NULL
            SELECT N''Không còn thành viên đang ở để chuyển đại diện; hợp đồng không có người đại diện.'' AS ThongBao;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KetThucHopDong
    @MaHopDong nvarchar(20),
    @NgayKetThucThucTe date = NULL,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @End date = COALESCE(@NgayKetThucThucTe, CAST(GETDATE() AS date));
        IF NOT EXISTS (
            SELECT 1 FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
            WHERE MaHopDong = @MaHopDong AND TrangThaiHopDong = N''Còn hiệu lực''
        ) THROW 51438, N''Không tìm thấy hợp đồng hiệu lực.'', 1;
        UPDATE dbo.ChiTietHopDong
        SET TrangThai = N''Đã rời'', NgayRa = CASE WHEN NgayVao > @End THEN NgayVao ELSE @End END,
            LyDoRoi = N''Kết thúc hợp đồng'', LaNguoiDaiDienThanhToanDichVu = 0
        WHERE MaHopDong = @MaHopDong AND TrangThai = N''Đang ở'';
        UPDATE dbo.HopDong
        SET TrangThaiHopDong = N''Đã kết thúc'', NgayKetThucThucTe = @End
        WHERE MaHopDong = @MaHopDong;
        EXEC dbo.sp_GhiNhatKyHopDong N''Kết thúc'', @MaHopDong, N''Kết thúc toàn bộ thành viên.'', @NguoiThucHien;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GiaHanHopDong
    @MaHopDong nvarchar(20),
    @NgayKetThucMoi date,
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @OldEnd date;
        SELECT @OldEnd = NgayKetThuc
        FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE MaHopDong = @MaHopDong AND TrangThaiHopDong = N''Còn hiệu lực'';
        IF @OldEnd IS NULL THROW 51439, N''Không tìm thấy hợp đồng hiệu lực.'', 1;
        IF @NgayKetThucMoi <= @OldEnd THROW 51440, N''Ngày kết thúc mới phải sau ngày hiện tại.'', 1;
        UPDATE dbo.HopDong
        SET NgayKetThucGoc = COALESCE(NgayKetThucGoc, NgayKetThuc),
            NgayKetThuc = @NgayKetThucMoi, SoLanGiaHan = SoLanGiaHan + 1
        WHERE MaHopDong = @MaHopDong;
        EXEC dbo.sp_GhiNhatKyHopDong N''Gia hạn'', @MaHopDong, N''Gia hạn hợp đồng.'', @NguoiThucHien;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_CapNhatHopDong
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ended int = 0;
    UPDATE dbo.HopDong
    SET TrangThaiHopDong = N''Đã kết thúc'',
        NgayKetThucThucTe = COALESCE(NgayKetThucThucTe, NgayKetThuc)
    WHERE TrangThaiHopDong = N''Còn hiệu lực''
      AND NgayKetThuc < CAST(GETDATE() AS date);
    SET @Ended = @@ROWCOUNT;
    SELECT @Ended AS SoHopDongDaKetThuc, 0 AS SoLoi;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ThemSinhVien
    @MaSinhVien nvarchar(30),
    @HoTen nvarchar(100),
    @NgaySinh date,
    @GioiTinh nvarchar(10),
    @SDT varchar(10),
    @Email varchar(100),
    @DiaChi nvarchar(255),
    @TenPhong nvarchar(50) = NULL,
    @GhiChu nvarchar(255) = NULL,
    @Truong nvarchar(150) = NULL,
    @Lop nvarchar(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF NULLIF(LTRIM(RTRIM(@TenPhong)), N'''') IS NOT NULL
        THROW 51441, N''Không gán phòng trực tiếp; hãy tạo hợp đồng và chi tiết thành viên.'', 1;
    INSERT INTO dbo.SinhVien
        (MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
         TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop)
    VALUES
        (@MaSinhVien, @HoTen, @NgaySinh, @GioiTinh, @SDT, @Email, @DiaChi,
         NULL, NULL, @GhiChu, @Truong, @Lop);
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_XoaSinhVien
    @MaSinhVien nvarchar(30),
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @MaChiTiet int;
    SELECT @MaChiTiet = MaChiTiet
    FROM dbo.ChiTietHopDong
    WHERE MaSinhVien = @MaSinhVien AND TrangThai = N''Đang ở'';
    IF @MaChiTiet IS NOT NULL
        EXEC dbo.sp_SinhVienRoiHopDong @MaChiTiet, NULL, N''Xóa sinh viên'', @NguoiThucHien;
    UPDATE dbo.SinhVien
    SET TrangThaiSinhVien = N''Đã rời KTX'', TenPhong = NULL,
        NgayRoiKTX = COALESCE(NgayRoiKTX, CAST(GETDATE() AS date))
    WHERE MaSinhVien = @MaSinhVien;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ChuyenPhong
    @MaSinhVien nvarchar(30),
    @PhongMoi nvarchar(50),
    @NguoiThucHien int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @OldDetail int, @OldContract nvarchar(20), @OldRoom nvarchar(50),
                @OldTier nvarchar(20), @NewTier nvarchar(20), @Gender nvarchar(10),
                @Capacity int, @Count int, @RoomStatus nvarchar(20), @Term nvarchar(10),
                @Rate decimal(18,2), @Monthly decimal(18,2), @End date,
                @NewContract nvarchar(20), @Representative bit;
        SELECT @OldDetail = c.MaChiTiet, @OldContract = hd.MaHopDong, @OldRoom = hd.TenPhong,
               @OldTier = hd.MaHangPhong, @Term = c.KyHanThanhToanPhong,
               @Rate = c.GiaPhongApDung, @Monthly = c.GiaPhongThangApDung,
               @Representative = c.LaNguoiDaiDienThanhToanDichVu, @End = hd.NgayKetThuc
        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK) ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaSinhVien = @MaSinhVien AND c.TrangThai = N''Đang ở''
          AND hd.TrangThaiHopDong = N''Còn hiệu lực'';
        IF @OldDetail IS NULL THROW 51442, N''Sinh viên không thuộc hợp đồng hiệu lực.'', 1;

        SELECT @NewTier = p.MaHangPhong, @Gender = p.LoaiPhong,
               @Capacity = hp.SucChuaToiDa, @RoomStatus = p.TrangThaiPhong
        FROM dbo.Phong p
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TenPhong = @PhongMoi;
        IF @NewTier IS NULL THROW 51443, N''Không tìm thấy phòng đích hoặc hạng phòng.'', 1;

        DECLARE @LockedRoom nvarchar(50);
        SELECT @LockedRoom = p.TenPhong
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.TenPhong IN (@OldRoom, @PhongMoi)
        ORDER BY p.TenPhong;

        SELECT @NewTier = p.MaHangPhong, @Gender = p.LoaiPhong,
               @Capacity = hp.SucChuaToiDa, @RoomStatus = p.TrangThaiPhong
        FROM dbo.Phong p
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
        WHERE p.TenPhong = @PhongMoi;
        SELECT @Count = COUNT(*)
        FROM dbo.HopDong hd
        INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
        WHERE hd.TenPhong = @PhongMoi
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND c.TrangThai = N''Đang ở'';
        IF @OldTier <> @NewTier
            THROW 51444, N''Không thể chuyển khác hạng phòng; cần xử lý tiền phòng đã đóng trước ở Bước 3.'', 1;
        IF @RoomStatus IN (N''Bảo trì'', N''Ngưng sử dụng'')
            THROW 51445, N''Phòng đích đang bảo trì hoặc ngưng sử dụng.'', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien AND GioiTinh = @Gender)
            THROW 51446, N''Giới tính sinh viên không phù hợp phòng đích.'', 1;
        IF @OldRoom <> @PhongMoi AND @Count >= @Capacity
            THROW 51447, N''Phòng đích đã đủ sức chứa.'', 1;

        SELECT TOP (1) @NewContract = MaHopDong
        FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
        WHERE TenPhong = @PhongMoi AND TrangThaiHopDong = N''Còn hiệu lực''
        ORDER BY MaHopDong;
        IF @OldRoom = @PhongMoi
            THROW 51448, N''Sinh viên đã ở phòng này.'', 1;

        IF @NewContract IS NULL
        BEGIN
            SET @NewContract = N''HD'' + RIGHT(N''00000'' + CONVERT(nvarchar(10), NEXT VALUE FOR dbo.Seq_MaHopDong), 5);
            INSERT INTO dbo.HopDong
                (MaHopDong, TenPhong, MaHangPhong, NgayBatDau, NgayKetThuc,
                 TrangThaiHopDong, NgayTao, GhiChu, SoLanGiaHan)
            VALUES
                (@NewContract, @PhongMoi, @NewTier, CAST(GETDATE() AS date), @End,
                 N''Còn hiệu lực'', CAST(GETDATE() AS date), N''Chuyển phòng'', 0);
        END;

        IF @Representative = 1
            UPDATE dbo.ChiTietHopDong
            SET LaNguoiDaiDienThanhToanDichVu = 0
            WHERE MaHopDong = @OldContract AND MaChiTiet = @OldDetail;
        UPDATE dbo.ChiTietHopDong
        SET TrangThai = N''Đã chuyển phòng'', NgayRa = CAST(GETDATE() AS date),
            LyDoRoi = N''Chuyển phòng'', LaNguoiDaiDienThanhToanDichVu = 0
        WHERE MaChiTiet = @OldDetail;

        IF EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @NewContract AND TrangThai = N''Đang ở''
              AND LaNguoiDaiDienThanhToanDichVu = 1
        )
            SET @Representative = 0;
        ELSE
            SET @Representative = 1;

        INSERT INTO dbo.ChiTietHopDong
            (MaHopDong, MaSinhVien, NgayVao, KyHanThanhToanPhong, GiaPhongApDung,
             GiaPhongThangApDung, LaNguoiDaiDienThanhToanDichVu, TrangThai, GhiChu)
        VALUES (@NewContract, @MaSinhVien, CAST(GETDATE() AS date), @Term, @Rate,
                @Monthly, COALESCE(@Representative, 0), N''Đang ở'', N''Chuyển phòng'');

        IF NOT EXISTS (
            SELECT 1 FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @OldContract AND TrangThai = N''Đang ở''
              AND LaNguoiDaiDienThanhToanDichVu = 1
        )
        BEGIN
            DECLARE @Replacement int;
            SELECT TOP (1) @Replacement = MaChiTiet
            FROM dbo.ChiTietHopDong
            WHERE MaHopDong = @OldContract AND TrangThai = N''Đang ở''
            ORDER BY NgayVao, MaChiTiet;
            IF @Replacement IS NOT NULL
                UPDATE dbo.ChiTietHopDong SET LaNguoiDaiDienThanhToanDichVu = 1
                WHERE MaChiTiet = @Replacement;
        END;
        DECLARE @LogDetails nvarchar(500);
        SET @LogDetails = N''Sinh viên '' + @MaSinhVien + N'' chuyển đến '' + @PhongMoi;
        EXEC dbo.sp_GhiNhatKyHopDong N''Chuyển phòng'', @OldContract,
             @LogDetails, @NguoiThucHien;
        COMMIT TRANSACTION;
        SELECT @NewContract AS MaHopDongMoi;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_KiemTraChuanHoaDuLieu
    @ApDung bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @ApDung = 1
        EXEC dbo.sp_CapNhatHopDong;

    SELECT hd.MaHopDong, c.MaSinhVien, sv.HoTen, hd.TenPhong,
           hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
    FROM dbo.HopDong hd
    INNER JOIN dbo.ChiTietHopDong c
        ON c.MaHopDong = hd.MaHopDong AND c.TrangThai = N''Đang ở''
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
    WHERE hd.NgayKetThuc < CAST(GETDATE() AS date)
      AND hd.TrangThaiHopDong = N''Còn hiệu lực''
    ORDER BY hd.NgayKetThuc, c.MaSinhVien;

    SELECT sv.MaSinhVien, sv.HoTen, sv.TrangThaiSinhVien,
           sv.TenPhong AS PhongSinhVien, CAST(NULL AS nvarchar(20)) AS MaHopDong,
           CAST(NULL AS nvarchar(50)) AS PhongHopDong, CAST(NULL AS date) AS NgayKetThuc
    FROM dbo.SinhVien sv
    WHERE sv.TrangThaiSinhVien = N''Đang ở''
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.ChiTietHopDong c
          INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
          WHERE c.MaSinhVien = sv.MaSinhVien
            AND c.TrangThai = N''Đang ở''
            AND hd.TrangThaiHopDong = N''Còn hiệu lực''
      )
    ORDER BY sv.MaSinhVien;

    SELECT invoice.MaHoaDon, invoice.MaSinhVien, sv.HoTen, invoice.NgayLap,
           hd.MaHopDong, hd.NgayBatDau, invoice.TenPhong AS PhongHoaDon,
           hd.TenPhong AS PhongHopDong, sv.TenPhong AS PhongSinhVien
    FROM dbo.HoaDon invoice
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = invoice.MaSinhVien
    INNER JOIN dbo.ChiTietHopDong c ON c.MaSinhVien = invoice.MaSinhVien
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
    WHERE invoice.NgayLap < c.NgayVao
    ORDER BY invoice.NgayLap, invoice.MaHoaDon, c.NgayVao;

    SELECT invoice.MaHoaDon, invoice.MaSinhVien, sv.HoTen,
           invoice.TenPhong AS PhongHoaDon, sv.TenPhong AS PhongSinhVien, invoice.NgayLap
    FROM dbo.HoaDon invoice
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = invoice.MaSinhVien
    WHERE ISNULL(invoice.TenPhong, N'''') <> ISNULL(sv.TenPhong, N'''')
    ORDER BY invoice.NgayLap DESC, invoice.MaHoaDon;

    SELECT hd.MaHopDong, c.MaSinhVien, sv.HoTen,
           hd.TenPhong AS PhongHopDong, sv.TenPhong AS PhongSinhVien,
           hd.NgayBatDau, hd.NgayKetThuc
    FROM dbo.ChiTietHopDong c
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
    WHERE c.TrangThai = N''Đang ở''
      AND hd.TrangThaiHopDong = N''Còn hiệu lực''
      AND ISNULL(hd.TenPhong, N'''') <> ISNULL(sv.TenPhong, N'''')
    ORDER BY hd.NgayBatDau DESC, hd.MaHopDong, c.MaSinhVien;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_UpdateTrangThaiHopDong
ON dbo.HopDong
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL(OBJECT_ID(N''dbo.TRG_UpdateTrangThaiHopDong'')) > 1
        RETURN;

    UPDATE c
    SET TrangThai = N''Đã rời'',
        NgayRa = CASE WHEN c.NgayVao > COALESCE(i.NgayKetThucThucTe, CAST(GETDATE() AS date))
                      THEN c.NgayVao ELSE COALESCE(i.NgayKetThucThucTe, CAST(GETDATE() AS date)) END,
        LyDoRoi = COALESCE(c.LyDoRoi, N''Kết thúc hợp đồng''),
        LaNguoiDaiDienThanhToanDichVu = 0
    FROM dbo.ChiTietHopDong c
    INNER JOIN inserted i ON i.MaHopDong = c.MaHopDong
    INNER JOIN deleted d ON d.MaHopDong = i.MaHopDong
    WHERE i.TrangThaiHopDong = N''Đã kết thúc''
      AND d.TrangThaiHopDong <> N''Đã kết thúc''
      AND c.TrangThai = N''Đang ở'';
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_HopDong_BaoVePhong
ON dbo.HopDong
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(TenPhong) AND EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaHopDong = i.MaHopDong
        WHERE i.TenPhong <> d.TenPhong
    )
        THROW 51456, N''Không đổi phòng của hợp đồng đã tạo; dùng nghiệp vụ chuyển phòng.'', 1;

    IF UPDATE(MaHangPhong) AND EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.MaHopDong = i.MaHopDong
        WHERE i.MaHangPhong <> d.MaHangPhong
    )
        THROW 51457, N''Không đổi hạng snapshot của hợp đồng đã tạo.'', 1;

    DECLARE @RoomToLock nvarchar(50);
    DECLARE room_lock CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT TenPhong
        FROM inserted
        WHERE TrangThaiHopDong = N''Còn hiệu lực''
        ORDER BY TenPhong;
    OPEN room_lock;
    FETCH NEXT FROM room_lock INTO @RoomToLock;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @RoomToLock = p.TenPhong
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.TenPhong = @RoomToLock;
        FETCH NEXT FROM room_lock INTO @RoomToLock;
    END;
    CLOSE room_lock;
    DEALLOCATE room_lock;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN deleted d ON d.MaHopDong = i.MaHopDong
        WHERE i.TrangThaiHopDong = N''Còn hiệu lực''
          AND (d.MaHopDong IS NULL
               OR d.TrangThaiHopDong <> i.TrangThaiHopDong
               OR d.TenPhong <> i.TenPhong)
          AND (
              SELECT COUNT_BIG(*)
              FROM dbo.HopDong active
              WHERE active.TenPhong = i.TenPhong
                AND active.TrangThaiHopDong = N''Còn hiệu lực''
          ) > 1
    )
        THROW 51454, N''Phòng đã có hợp đồng hiệu lực; hãy thêm thành viên vào hợp đồng hiện có.'', 1;
END;
';

        IF OBJECT_ID(N'dbo.TRG_UpdatePhong', N'TR') IS NOT NULL
            DROP TRIGGER dbo.TRG_UpdatePhong;
        EXEC sys.sp_executesql N'
CREATE TRIGGER dbo.TRG_UpdatePhong
ON dbo.ChiTietHopDong
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Rooms table (TenPhong nvarchar(50) PRIMARY KEY);
    DECLARE @Students table (MaSinhVien nvarchar(30) PRIMARY KEY);
    INSERT INTO @Rooms
    SELECT DISTINCT hd.TenPhong
    FROM (
        SELECT MaHopDong FROM inserted
        UNION
        SELECT MaHopDong FROM deleted
    ) x
    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = x.MaHopDong;
    DECLARE @RoomToLock nvarchar(50);
    DECLARE room_lock CURSOR LOCAL FAST_FORWARD FOR
        SELECT TenPhong FROM @Rooms ORDER BY TenPhong;
    OPEN room_lock;
    FETCH NEXT FROM room_lock INTO @RoomToLock;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @RoomToLock = p.TenPhong
        FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.TenPhong = @RoomToLock;
        FETCH NEXT FROM room_lock INTO @RoomToLock;
    END;
    CLOSE room_lock;
    DEALLOCATE room_lock;

    INSERT INTO @Students
    SELECT MaSinhVien FROM inserted
    UNION
    SELECT MaSinhVien FROM deleted;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = i.MaHopDong
        INNER JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
        WHERE i.TrangThai = N''Đang ở''
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND NOT EXISTS (
              SELECT 1 FROM dbo.SinhVien sv
              WHERE sv.MaSinhVien = i.MaSinhVien AND sv.GioiTinh = p.LoaiPhong
          )
    )
        THROW 51450, N''Giới tính sinh viên không phù hợp phòng.'', 1;

    IF EXISTS (
        SELECT 1
        FROM @Rooms r
        INNER JOIN dbo.Phong p ON p.TenPhong = r.TenPhong
        CROSS APPLY (
            SELECT COUNT_BIG(*) AS SoNguoi
            FROM dbo.HopDong hd
            INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
            WHERE hd.TenPhong = r.TenPhong
              AND hd.TrangThaiHopDong = N''Còn hiệu lực''
              AND c.TrangThai = N''Đang ở''
        ) x
        WHERE x.SoNguoi > p.SucChuaToiDa
    )
        THROW 51451, N''Số thành viên đang ở vượt sức chứa phòng.'', 1;

    UPDATE hd
    SET TrangThaiHopDong = N''Đã kết thúc'',
        NgayKetThucThucTe = COALESCE(hd.NgayKetThucThucTe, CAST(GETDATE() AS date))
    FROM dbo.HopDong hd
    INNER JOIN (
        SELECT DISTINCT MaHopDong FROM inserted
        UNION
        SELECT DISTINCT MaHopDong FROM deleted
    ) c ON c.MaHopDong = hd.MaHopDong
    WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ChiTietHopDong active
          WHERE active.MaHopDong = hd.MaHopDong AND active.TrangThai = N''Đang ở''
      );

    UPDATE sv
    SET TenPhong = active.TenPhong,
        TrangThaiSinhVien = CASE WHEN active.MaSinhVien IS NULL THEN N''Đã rời KTX'' ELSE N''Đang ở'' END,
        NgayRoiKTX = CASE WHEN active.MaSinhVien IS NULL
                          THEN COALESCE(sv.NgayRoiKTX, CAST(GETDATE() AS date)) ELSE NULL END
    FROM dbo.SinhVien sv
    INNER JOIN @Students s ON s.MaSinhVien = sv.MaSinhVien
    OUTER APPLY (
        SELECT TOP (1) c.MaSinhVien, hd.TenPhong
        FROM dbo.ChiTietHopDong c
        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
        WHERE c.MaSinhVien = sv.MaSinhVien
          AND c.TrangThai = N''Đang ở''
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
        ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
    ) active
    WHERE EXISTS (
        SELECT sv.TenPhong, sv.TrangThaiSinhVien, sv.NgayRoiKTX
        EXCEPT
        SELECT active.TenPhong,
               CASE WHEN active.MaSinhVien IS NULL THEN N''Đã rời KTX'' ELSE N''Đang ở'' END,
               CASE WHEN active.MaSinhVien IS NULL
                    THEN COALESCE(sv.NgayRoiKTX, CAST(GETDATE() AS date)) ELSE NULL END
    );

    UPDATE p
    SET SoSinhVienHienTai = ISNULL(x.SoNguoi, 0),
        TrangThaiPhong = CASE
            WHEN p.TrangThaiPhong IN (N''Bảo trì'', N''Ngưng sử dụng'') THEN p.TrangThaiPhong
            WHEN ISNULL(x.SoNguoi, 0) >= p.SucChuaToiDa THEN N''Đầy'' ELSE N''Trống'' END
    FROM dbo.Phong p
    INNER JOIN @Rooms r ON r.TenPhong = p.TenPhong
    OUTER APPLY (
        SELECT COUNT_BIG(*) AS SoNguoi
        FROM dbo.HopDong hd
        INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
        WHERE hd.TenPhong = p.TenPhong
          AND hd.TrangThaiHopDong = N''Còn hiệu lực''
          AND c.TrangThai = N''Đang ở''
    ) x
    WHERE ISNULL(p.SoSinhVienHienTai, -1) <> ISNULL(x.SoNguoi, 0)
       OR (p.TrangThaiPhong NOT IN (N''Bảo trì'', N''Ngưng sử dụng'')
           AND p.TrangThaiPhong <> CASE
               WHEN ISNULL(x.SoNguoi, 0) >= p.SucChuaToiDa THEN N''Đầy'' ELSE N''Trống'' END);
END;
';

        UPDATE sv
        SET TenPhong = active.TenPhong,
            TrangThaiSinhVien = CASE WHEN active.MaSinhVien IS NULL THEN N'Đã rời KTX' ELSE N'Đang ở' END,
            NgayRoiKTX = CASE WHEN active.MaSinhVien IS NULL
                              THEN COALESCE(sv.NgayRoiKTX, CAST(GETDATE() AS date)) ELSE NULL END
        FROM dbo.SinhVien sv
        OUTER APPLY (
            SELECT TOP (1) c.MaSinhVien, hd.TenPhong
            FROM dbo.ChiTietHopDong c
            INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
            WHERE c.MaSinhVien = sv.MaSinhVien
              AND c.TrangThai = N'Đang ở'
              AND hd.TrangThaiHopDong = N'Còn hiệu lực'
            ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
        ) active
        WHERE sv.TenPhong IS NOT NULL OR active.MaSinhVien IS NOT NULL;

        UPDATE p
        SET SoSinhVienHienTai = ISNULL(x.SoNguoi, 0),
            TrangThaiPhong = CASE
                WHEN p.TrangThaiPhong IN (N'Bảo trì', N'Ngưng sử dụng') THEN p.TrangThaiPhong
                WHEN ISNULL(x.SoNguoi, 0) >= p.SucChuaToiDa THEN N'Đầy' ELSE N'Trống' END
        FROM dbo.Phong p
        OUTER APPLY (
            SELECT COUNT_BIG(*) AS SoNguoi
            FROM dbo.HopDong hd
            INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
            WHERE hd.TenPhong = p.TenPhong
              AND hd.TrangThaiHopDong = N'Còn hiệu lực'
              AND c.TrangThai = N'Đang ở'
        ) x;

        EXEC sys.sp_executesql N'
CREATE OR ALTER TRIGGER dbo.TRG_SinhVien_Insert
ON dbo.SinhVien
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted WHERE TenPhong IS NOT NULL OR TrangThaiSinhVien = N''Đang ở'')
        THROW 51452, N''Sinh viên phải được gán phòng qua hợp đồng và ChiTietHopDong.'', 1;

    INSERT INTO dbo.SinhVien
        (MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
         TrangThaiSinhVien, TenPhong, GhiChu, Truong, Lop, NgayRoiKTX, NgayTao)
    SELECT MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
           TrangThaiSinhVien, NULL, GhiChu, Truong, Lop, NgayRoiKTX, COALESCE(NgayTao, GETDATE())
    FROM inserted;
END;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_ChiTietHopDongFE
AS
SELECT c.MaChiTiet, c.MaHopDong, c.MaSinhVien, sv.HoTen, hd.TenPhong, hd.MaHangPhong,
       c.NgayVao, c.NgayRa, c.KyHanThanhToanPhong, c.GiaPhongApDung,
       c.GiaPhongThangApDung, c.LaNguoiDaiDienThanhToanDichVu,
       c.TrangThai, c.GhiChu, c.LyDoRoi, c.NgayTao,
       hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
FROM dbo.ChiTietHopDong c
INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_LichSuHopDongFE
AS
SELECT CASE WHEN MaLichSu < 1000
            THEN N''LS'' + RIGHT(N''000'' + CAST(MaLichSu AS varchar(10)), 3)
            ELSE N''LS'' + CAST(MaLichSu AS varchar(10)) END AS MaLS,
       MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc,
       TrangThaiHopDong, ThaoTac, ThoiGian AS ThoiDiem
FROM dbo.LichSuHopDong_Backup;
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_HopDongSapHetHan
AS
SELECT hd.MaHopDong, c.MaSinhVien, sv.HoTen, hd.TenPhong, hd.MaHangPhong,
       hd.NgayBatDau, hd.NgayKetThuc,
       DATEDIFF(day, CAST(GETDATE() AS date), hd.NgayKetThuc) AS SoNgayConLai,
       TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_ADMIN'')) AS NguongAdmin,
       TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_SV'')) AS NguongSinhVien
FROM dbo.HopDong hd
INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong AND c.TrangThai = N''Đang ở''
INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
WHERE hd.TrangThaiHopDong = N''Còn hiệu lực''
  AND hd.NgayKetThuc <= DATEADD(day,
      ISNULL(TRY_CONVERT(int, (SELECT GiaTri FROM dbo.CauHinhHeThong WHERE Khoa = N''NGUONG_CANH_BAO_HET_HAN_ADMIN'')), 7),
      CAST(GETDATE() AS date));
';

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_SinhVienChiTiet
AS
SELECT sv.MaSinhVien, sv.HoTen, sv.NgaySinh, sv.GioiTinh, sv.SoDienThoai,
       sv.Email AS EmailTruong, sv.DiaChi, sv.Truong, sv.Lop, sv.GhiChu,
       sv.TrangThaiSinhVien, sv.TenPhong, sv.NgayRoiKTX, sv.NgayTao,
       p.Khu, p.LoaiPhong, p.SucChuaToiDa, p.TrangThaiPhong, p.MaHangPhong,
       c.MaHopDong, hd.NgayBatDau, hd.NgayKetThuc,
       hd.TrangThaiHopDong AS TrangThaiHopDongHienTai,
       tk.MaTaiKhoan, tk.Email AS EmailDangNhap, tk.VaiTro, tk.TrangThai AS TrangThaiTaiKhoan
FROM dbo.SinhVien sv
LEFT JOIN dbo.Phong p ON p.TenPhong = sv.TenPhong
LEFT JOIN dbo.ChiTietHopDong c ON c.MaSinhVien = sv.MaSinhVien AND c.TrangThai = N''Đang ở''
LEFT JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
LEFT JOIN dbo.TaiKhoan tk ON tk.MaSinhVien = sv.MaSinhVien;
';

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_Phong_TrangThai')
            CREATE INDEX IX_HopDong_Phong_TrangThai ON dbo.HopDong (TenPhong, TrangThaiHopDong);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HopDong') AND name = N'IX_HopDong_NgayKetThuc')
            CREATE INDEX IX_HopDong_NgayKetThuc ON dbo.HopDong (NgayKetThuc);

        EXEC sys.sp_executesql N'
CREATE OR ALTER VIEW dbo.vw_PhongCoNhieuHopDongHieuLuc
AS
SELECT TenPhong, COUNT_BIG(*) AS SoHopDongHieuLuc
FROM dbo.HopDong
WHERE TrangThaiHopDong = N''Còn hiệu lực''
GROUP BY TenPhong
HAVING COUNT_BIG(*) > 1;
';

        INSERT INTO dbo.SchemaMigration (MaMigration, TenFile)
        VALUES (N'014', N'014_contract_members.sql');

        COMMIT TRANSACTION;
        PRINT N'[014] Hoàn tất.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;

DROP TABLE #Migration014StartState;
