const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sql = require("mssql");
const { createNonFixtureContract } = require("./db-test-sql-fixtures.cjs");

test("real SQL fixture cashout cleanup accepts GH identifiers only in GH-TEST rooms", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let activeFixture;
    try {
        const applied = await pool.request().query(`
            SELECT 1 AS Applied
            FROM dbo.SchemaMigration
            WHERE MaMigration = N'039'
        `);
        assert.equal(applied.recordset.length, 1, "Migration 039 must be applied.");

        activeFixture = await createNonFixtureContract(pool, sql, {
            roomPrefix: "GH-TEST-",
            managerEmailPrefix: "gh-test-",
            tierPrefix: "GH-TEST-HP-",
            servicePrefix: "GH-TEST-DV",
            suffixLength: 9,
            studentIdFactory: () => `GH${crypto.randomInt(100000000, 1000000000)}`
        });
        assert.match(activeFixture.roomA, /^GH-TEST-/);
        assert.match(activeFixture.studentId, /^GH\d{9}$/);
        await new sql.Request(activeFixture.transaction)
            .input("MaChiTiet", sql.Int, activeFixture.memberId)
            .input("SoTien", sql.Decimal(18, 2), 1)
            .input("NguoiLap", sql.Int, activeFixture.managerId)
            .input("NgayRa", sql.Date, new Date().toISOString().slice(0, 10))
            .query(`
                INSERT INTO dbo.PhieuChi
                    (MaChiTiet, SoTienDaDong, SoTienDaSuDung, KhauTru,
                     SoTien, NgayRa, LyDo, TrangThai, NguoiLap)
                VALUES
                    (@MaChiTiet, 1, 0, 0, @SoTien, @NgayRa,
                     N'Khác', N'Đã hủy', @NguoiLap)
            `);

        const ghResult = await new sql.Request(activeFixture.transaction)
            .input("MaHopDong", sql.NVarChar(20), activeFixture.contractId)
            .input("NguoiThucHien", sql.Int, activeFixture.managerId)
            .execute("dbo.sp_HuyPhieuChiFixtureKiemThu");
        assert.equal(Number(ghResult.recordset?.[0]?.SoPhieuChiDaHuy), 0);

        await activeFixture.transaction.rollback();
        activeFixture = null;
        activeFixture = await createNonFixtureContract(pool, sql, {
            roomPrefix: "T5-",
            managerEmailPrefix: "b5-",
            tierPrefix: "T5HP",
            servicePrefix: "T5DV",
            studentIdFactory: () => `GH${crypto.randomInt(100000000, 1000000000)}`
        });
        await new sql.Request(activeFixture.transaction)
            .input("MaChiTiet", sql.Int, activeFixture.memberId)
            .input("SoTien", sql.Decimal(18, 2), 1)
            .input("NguoiLap", sql.Int, activeFixture.managerId)
            .input("NgayRa", sql.Date, new Date().toISOString().slice(0, 10))
            .query(`
                INSERT INTO dbo.PhieuChi
                    (MaChiTiet, SoTienDaDong, SoTienDaSuDung, KhauTru,
                     SoTien, NgayRa, LyDo, TrangThai, NguoiLap)
                VALUES
                    (@MaChiTiet, 1, 0, 0, @SoTien, @NgayRa,
                     N'Khác', N'Đã hủy', @NguoiLap)
            `);
        assert.match(activeFixture.roomA, /^T5-/);
        assert.match(activeFixture.studentId, /^GH\d{9}$/);
        await assert.rejects(
            new sql.Request(activeFixture.transaction)
                .input("MaHopDong", sql.NVarChar(20), activeFixture.contractId)
                .input("NguoiThucHien", sql.Int, activeFixture.managerId)
                .execute("dbo.sp_HuyPhieuChiFixtureKiemThu"),
            error => Number(error.number) === 53506
        );
    } finally {
        if (activeFixture) {
            try {
                await activeFixture.transaction.rollback();
            } catch (error) {
                if (error.code !== "EABORT") throw error;
            }
        }
        await pool.close();
    }
});

test("real SQL financial cleanup accepts GH identifiers only in GH-TEST rooms after migration 040", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let activeFixture;
    try {
        const applied = await pool.request().query(`
            SELECT COUNT(*) AS Applied
            FROM dbo.SchemaMigration
            WHERE MaMigration IN (N'039', N'040')
        `);
        assert.equal(applied.recordset[0]?.Applied, 2,
            "Migrations 039 and 040 must be applied.");

        activeFixture = await createNonFixtureContract(pool, sql, {
            roomPrefix: "GH-TEST-",
            managerEmailPrefix: "gh-test-",
            tierPrefix: "GH-TEST-HP-",
            servicePrefix: "GH-TEST-DV",
            suffixLength: 9,
            studentIdFactory: () => `GH${crypto.randomInt(100000000, 1000000000)}`
        });
        assert.match(activeFixture.roomA, /^GH-TEST-/);
        assert.match(activeFixture.studentId, /^GH\d{9}$/);
        const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const invoiceId = `GHF${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
        const invoiceItemId = `${invoiceId}-I`;
        const invoicePeriod = `${todayVN.slice(0, 7)}-01`;
        const lastDay = new Date(Date.UTC(
            Number(todayVN.slice(0, 4)), Number(todayVN.slice(5, 7)), 0
        )).getUTCDate();
        await new sql.Request(activeFixture.transaction)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .input("MaSinhVien", sql.NVarChar(20), activeFixture.studentId)
            .input("TenPhong", sql.NVarChar(50), activeFixture.roomA)
            .input("NgayLap", sql.Date, todayVN)
            .input("HanThanhToan", sql.Date, todayVN)
            .input("MaHopDong", sql.NVarChar(20), activeFixture.contractId)
            .input("MaChiTiet", sql.Int, activeFixture.memberId)
            .input("KyThanhToan", sql.Date, invoicePeriod)
            .input("KyThanhToanDen", sql.Date,
                `${todayVN.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`)
            .query(`
                INSERT INTO dbo.HoaDon
                    (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
                     TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
                     KyThanhToan, KyThanhToanDen)
                VALUES
                    (@MaHoaDon, @MaSinhVien, @TenPhong, @NgayLap, 1, 0, 0,
                     N'Đã thanh toán', @HanThanhToan, N'PHAT_SINH', @MaHopDong, @MaChiTiet,
                     @KyThanhToan, @KyThanhToanDen)
            `);
        await new sql.Request(activeFixture.transaction)
            .input("MaChiTiet", sql.NVarChar(40), invoiceItemId)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .query(`
                INSERT INTO dbo.ChiTietHoaDon
                    (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
                     TrangThai, ThuTu)
                VALUES
                    (@MaChiTiet, @MaHoaDon, N'INCIDENT', N'Fixture incident', 1, 1, 1,
                     N'Chưa thanh toán', 1)
            `);
        const paymentId = `GH-FIXTURE-${crypto.randomUUID()}`;
        const refund = await new sql.Request(activeFixture.transaction)
            .input("MaGiaoDich", sql.NVarChar(60), paymentId)
            .input("MaSinhVien", sql.NVarChar(20), activeFixture.studentId)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .input("NguoiTra", sql.Int, activeFixture.managerId)
            .input("SoTien", sql.Decimal(18, 2), 1)
            .query(`
                INSERT INTO dbo.GiaoDichThanhToan
                    (MaGiaoDich, MaSinhVien, TongTien, PhuongThuc, TrangThai, NgayThanhToan)
                VALUES
                    (@MaGiaoDich, @MaSinhVien, @SoTien, N'ONLINE', N'SUCCESS', GETDATE());
                INSERT INTO dbo.HoanTienChuyenKhoanDu
                    (MaGiaoDich, MaHoaDon, SoTien, TrangThai, NguoiTra, ThoiDiemTra)
                OUTPUT inserted.MaHoanTien
                VALUES
                    (@MaGiaoDich, @MaHoaDon, @SoTien, N'DA_HOAN', @NguoiTra, GETDATE());
            `);
        const refundId = refund.recordset[0].MaHoanTien;
        const expense = await new sql.Request(activeFixture.transaction)
            .input("MaHopDong", sql.NVarChar(20), activeFixture.contractId)
            .input("MaChiTiet", sql.Int, activeFixture.memberId)
            .input("MaChiTietHoaDon", sql.NVarChar(40), invoiceItemId)
            .input("NoiDung", sql.NVarChar(255), `GH fixture trigger ${crypto.randomUUID()}`)
            .input("SoTien", sql.Decimal(18, 2), 1)
            .input("NguoiNhap", sql.Int, activeFixture.managerId)
            .query(`
                INSERT INTO dbo.ChiPhiPhatSinh
                    (MaHopDong, MaChiTiet, NoiDung, SoTien, NgayPhatSinh, HanDong,
                     NguoiNhap, TrangThai, MaChiTietHoaDon)
                OUTPUT inserted.MaChiPhi
                VALUES
                    (@MaHopDong, @MaChiTiet, @NoiDung, @SoTien,
                     CONVERT(date, GETDATE()), DATEADD(day, 7, CONVERT(date, GETDATE())),
                     @NguoiNhap, N'Đã lập hóa đơn', @MaChiTietHoaDon)
            `);
        const expenseId = expense.recordset[0].MaChiPhi;
        const accepted = await new sql.Request(activeFixture.transaction)
            .input("MaHopDong", sql.NVarChar(20), activeFixture.contractId)
            .input("NguoiThucHien", sql.Int, activeFixture.managerId)
            .execute("dbo.sp_DonDepFixtureTaiChinhKiemThu");
        assert.equal(accepted.recordset[0]?.MaHopDong, activeFixture.contractId);
        assert.equal(accepted.recordset[0]?.SoKhoanHoanDaXoa, 1);
        assert.equal(accepted.recordset[0]?.SoChiPhiDaXoa, 1);
        const removed = await new sql.Request(activeFixture.transaction)
            .input("MaHoanTien", sql.BigInt, refundId)
            .input("MaChiPhi", sql.BigInt, expenseId)
            .query(`
                SELECT
                    (SELECT COUNT_BIG(*) FROM dbo.HoanTienChuyenKhoanDu
                     WHERE MaHoanTien = @MaHoanTien) AS SoKhoanHoanConLai,
                    (SELECT COUNT_BIG(*) FROM dbo.ChiPhiPhatSinh
                     WHERE MaChiPhi = @MaChiPhi) AS SoChiPhiConLai
            `);
        assert.equal(Number(removed.recordset[0].SoKhoanHoanConLai), 0);
        assert.equal(Number(removed.recordset[0].SoChiPhiConLai), 0);

        await activeFixture.transaction.rollback();
        activeFixture = null;
        activeFixture = await createNonFixtureContract(pool, sql, {
            roomPrefix: "T5-",
            managerEmailPrefix: "b5-",
            tierPrefix: "T5HP",
            servicePrefix: "T5DV",
            studentIdFactory: () => `GH${crypto.randomInt(100000000, 1000000000)}`
        });
        assert.match(activeFixture.roomA, /^T5-/);
        assert.match(activeFixture.studentId, /^GH\d{9}$/);
        await assert.rejects(
            new sql.Request(activeFixture.transaction)
                .input("MaHopDong", sql.NVarChar(20), activeFixture.contractId)
                .input("NguoiThucHien", sql.Int, activeFixture.managerId)
                .execute("dbo.sp_DonDepFixtureTaiChinhKiemThu"),
            error => Number(error.number) === 53807
        );
    } finally {
        if (activeFixture) {
            try {
                await activeFixture.transaction.rollback();
            } catch (error) {
                if (error.code !== "EABORT") throw error;
            }
        }
        await pool.close();
    }
});
