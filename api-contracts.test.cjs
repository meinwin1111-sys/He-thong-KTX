const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const sql = require("mssql");
const registerApiRoutes = require("./api-routes");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createLoginHandler, createRegistrationHandler } = require("./student-auth");
const { createApiAuthenticationMiddleware } = require("./api-auth");
const { createSqlIntegrationFixture, createNonFixtureContract } = require("./db-test-sql-fixtures.cjs");

function fakeApi({ queryResult, executeError, executeResult } = {}) {
    const routes = new Map();
    const queries = [];
    const executions = [];
    const transactions = [];
    class Transaction {
        constructor() {
            this.state = "new";
            transactions.push(this);
        }
        async begin(isolation) { this.state = "active"; this.isolation = isolation; }
        async commit() { this.state = "committed"; }
        async rollback() { this.state = "rolledback"; }
    }
    const makeRequest = () => {
        const inputs = {};
        return {
            input(name, _type, value) { inputs[name] = value; return this; },
            output(name, _type, value) { inputs[name] = value; return this; },
            async query(statement) {
                const call = { inputs: { ...inputs }, statement };
                queries.push(call);
                return queryResult ? queryResult(call) : { recordset: [], rowsAffected: [1] };
            },
            async execute(procedure) {
                const call = { inputs: { ...inputs }, procedure };
                executions.push(call);
                if (executeError) {
                    const error = executeError(call);
                    if (error) throw error;
                }
                return executeResult ? executeResult(call) : { recordset: [{ MaHopDong: "HD00001", MaHopDongMoi: "HD00002" }] };
            }
        };
    };
    const app = Object.fromEntries(["get", "post", "put", "delete"].map(method => [
        method, (url, handler) => routes.set(`${method} ${url}`, handler)
    ]));
    const sqlTypes = new Proxy({
        Request: function Request() { return makeRequest(); },
        Transaction,
        ISOLATION_LEVEL: { SERIALIZABLE: "SERIALIZABLE" },
        MAX: "MAX"
    }, {
        get(target, key) {
            if (key in target) return target[key];
            return (...args) => ({ type: String(key), args });
        }
    });
    const pool = { request: makeRequest };
    registerApiRoutes(app, {
        getPool: () => pool,
        sql: sqlTypes,
        bcrypt: {},
        mapPaymentStatusToDatabase: value => ({
            PENDING: "PENDING",
            WAITING_CASH: "Chờ xác nhận",
            SUCCESS: "SUCCESS",
            REJECTED: "REJECTED",
            EXPIRED: "EXPIRED",
            "Cần đối soát": "RECONCILIATION",
            "Hợp lệ": "Hợp lệ",
            "Chờ xác nhận": "Chờ xác nhận",
            "Đã hủy": "Đã hủy"
        })[value] || null,
        mapPaymentMethodToDatabase: value => ({
            CASH: "CASH",
            "Tiền mặt": "CASH",
            ONLINE: "ONLINE",
            "Chuyển khoản": "ONLINE",
            "Ví điện tử": "ONLINE",
            CHUYEN_DOI: "CHUYEN_DOI"
        })[value] || null,
        rollback: async () => {}
    });
    return { routes, queries, executions, transactions };
}

async function deleteContractInvoices(transaction, sql, contractId) {
    await new sql.Request(transaction)
        .input("MaHopDong", sql.NVarChar(20), contractId)
        .query(`
            DELETE tb
            FROM dbo.ThongBao tb
            WHERE tb.MaSinhVien IN (
                SELECT MaSinhVien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong
            );

            DELETE hd
            FROM dbo.HoaDon hd
            LEFT JOIN dbo.ChiTietHopDong cthd ON cthd.MaChiTiet = hd.MaChiTiet
            WHERE hd.MaHopDong = @MaHopDong OR cthd.MaHopDong = @MaHopDong;
        `);
}

async function cleanupSqlIntegrationFixture(pool, sql, fixture, extraRooms = []) {
    if (!pool.connected || !fixture) return;
    const cleanup = new sql.Transaction(pool);
    await cleanup.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const rooms = [...new Set([fixture.roomA, fixture.roomB, ...extraRooms].filter(Boolean))];
        const contracts = await new sql.Request(cleanup)
            .input("RoomA", sql.NVarChar(50), rooms[0] || "")
            .input("RoomB", sql.NVarChar(50), rooms[1] || "")
            .input("RoomC", sql.NVarChar(50), rooms[2] || "")
            .query(`
                SELECT MaHopDong, TenPhong
                FROM dbo.HopDong
                WHERE TenPhong IN (@RoomA, @RoomB, @RoomC)
            `);
        for (const { MaHopDong: contractId, TenPhong } of contracts.recordset) {
            if (TenPhong.startsWith("T5-")) {
                await new sql.Request(cleanup)
                    .input("MaHopDong", sql.NVarChar(20), contractId)
                    .input("NguoiThucHien", sql.Int, fixture.managerId || null)
                    .execute("dbo.sp_HuyPhieuChiFixtureKiemThu");
                await new sql.Request(cleanup)
                    .input("MaHopDong", sql.NVarChar(20), contractId)
                    .input("NguoiThucHien", sql.Int, fixture.managerId || null)
                    .execute("dbo.sp_DonDepFixtureTaiChinhKiemThu");
            }
            await new sql.Request(cleanup)
                .input("MaHopDong", sql.NVarChar(20), contractId)
                .query(`
                    DELETE tb FROM dbo.ThongBao tb
                    WHERE tb.MaSinhVien IN (
                        SELECT MaSinhVien FROM dbo.ChiTietHopDong WHERE MaHopDong = @MaHopDong
                    ) OR tb.MaHoaDon IN (
                        SELECT MaHoaDon FROM dbo.HoaDon WHERE MaHopDong = @MaHopDong
                    );
                    DELETE yc FROM dbo.YeuCauSinhVien yc
                    WHERE yc.MaSinhVien IN (
                        SELECT MaSinhVien FROM dbo.ChiTietHopDong WHERE MaHopDong = @MaHopDong
                    );
                    DELETE pha FROM dbo.PhieuChi_HoaDon pha
                    WHERE pha.MaHoaDon IN (
                        SELECT MaHoaDon FROM dbo.HoaDon WHERE MaHopDong = @MaHopDong
                    ) OR pha.MaPhieuChi IN (
                        SELECT pc.MaPhieuChi FROM dbo.PhieuChi pc
                        INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                        WHERE c.MaHopDong = @MaHopDong
                    );
                    DELETE log FROM dbo.NhatKyHeThong log
                    INNER JOIN dbo.PhieuChi pc
                        ON log.DoiTuong = N'PhieuChi'
                       AND log.MaDoiTuong = CONVERT(nvarchar(60), pc.MaPhieuChi)
                    INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                    WHERE c.MaHopDong = @MaHopDong
                      AND log.HanhDong = N'Hủy phiếu chi fixture kiểm thử';
                    DELETE log FROM dbo.NhatKyHeThong log
                    INNER JOIN dbo.GiaHanHopDong g
                        ON log.DoiTuong = N'GiaHanHopDong'
                       AND log.MaDoiTuong = CONVERT(nvarchar(60), g.MaGiaHan)
                    WHERE g.MaHopDong = @MaHopDong;
                    DELETE FROM dbo.NhatKyHeThong
                    WHERE DoiTuong = N'FixtureCleanup' AND MaDoiTuong = @MaHopDong;
                    DELETE pc FROM dbo.PhieuChi pc
                    INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                    WHERE c.MaHopDong = @MaHopDong;
                    DECLARE @PaymentIds TABLE (MaGiaoDich nvarchar(60) NOT NULL PRIMARY KEY);
                    INSERT INTO @PaymentIds(MaGiaoDich)
                    SELECT DISTINCT pt.MaGiaoDich
                    FROM dbo.PhieuThu pt
                    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                    WHERE hd.MaHopDong = @MaHopDong AND pt.MaGiaoDich IS NOT NULL;
                    DELETE pt FROM dbo.PhieuThu pt
                    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                    WHERE hd.MaHopDong = @MaHopDong;
                    DELETE gd FROM dbo.GiaoDichThanhToan gd
                    INNER JOIN @PaymentIds ids ON ids.MaGiaoDich = gd.MaGiaoDich;
                    DELETE cp FROM dbo.ChiPhiPhatSinh cp
                    WHERE cp.MaHopDong = @MaHopDong;
                    DELETE FROM dbo.GiaHanHopDong WHERE MaHopDong = @MaHopDong;
                `);
            await deleteContractInvoices(cleanup, sql, contractId);
            await new sql.Request(cleanup)
                .input("MaHopDong", sql.NVarChar(20), contractId)
                .query(`
                    DELETE FROM dbo.NhatKyHeThong
                    WHERE DoiTuong = N'HopDong' AND MaDoiTuong = @MaHopDong;
                    DELETE FROM dbo.ChiTietHopDong WHERE MaHopDong = @MaHopDong;
                    DELETE FROM dbo.HopDong WHERE MaHopDong = @MaHopDong;
                `);
        }
        for (const studentId of fixture.studentIds) {
            await new sql.Request(cleanup)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    DELETE FROM dbo.TaiKhoan WHERE MaSinhVien = @MaSinhVien;
                    DELETE FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;
                `);
        }
        await new sql.Request(cleanup)
            .input("ManagerId", sql.Int, fixture.managerId)
            .input("TierId", sql.NVarChar(20), fixture.tierId)
            .input("ServiceId", sql.NVarChar(20), fixture.serviceId)
            .input("RoomA", sql.NVarChar(50), rooms[0] || "")
            .input("RoomB", sql.NVarChar(50), rooms[1] || "")
            .input("RoomC", sql.NVarChar(50), rooms[2] || "")
            .query(`
                DELETE FROM dbo.NhatKyHeThong WHERE MaTaiKhoan = @ManagerId;
                DELETE FROM dbo.TaiKhoan WHERE MaTaiKhoan = @ManagerId;
                DELETE FROM dbo.Phong WHERE TenPhong IN (@RoomA, @RoomB, @RoomC);
                DELETE FROM dbo.HangPhong_DichVu WHERE MaHangPhong = @TierId;
                DELETE FROM dbo.DichVu WHERE MaDichVu = @ServiceId;
                DELETE FROM dbo.HangPhong WHERE MaHangPhong = @TierId;
            `);
        await cleanup.commit();
    } catch (error) {
        try {
            await cleanup.rollback();
        } catch (rollbackError) {
            if (rollbackError.code !== "EABORT") throw rollbackError;
        }
        throw error;
    }
}

async function withSqlMemberRenewalFixture(memberCount, run, {
    roomPrefix = "T5-",
    roomCapacity = 4,
    allowOverCapacityFixture = false
} = {}) {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình SQL Server cho kiểm thử gia hạn theo thành viên.");
    }

    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    const envKeys = [
        "JWT_SECRET", "PAYMENT_BANK_BIN", "PAYMENT_BANK_ACCOUNT_NO",
        "PAYMENT_BANK_ACCOUNT_NAME", "PAYMENT_WEBHOOK_SECRET", "ALLOW_DEMO_PAYMENT"
    ];
    const previousEnv = new Map(envKeys.map(key => [key, process.env[key]]));
    const authSecret = `renewal-${crypto.randomBytes(24).toString("hex")}`;
    const webhookSecret = `webhook-${crypto.randomBytes(24).toString("hex")}`;
    process.env.JWT_SECRET = authSecret;
    process.env.PAYMENT_BANK_BIN = "970436";
    process.env.PAYMENT_BANK_ACCOUNT_NO = "1234567890";
    process.env.PAYMENT_BANK_ACCOUNT_NAME = "KTX TEST";
    process.env.PAYMENT_WEBHOOK_SECRET = webhookSecret;
    process.env.ALLOW_DEMO_PAYMENT = "true";

    let server;
    let fixture;
    try {
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: memberCount,
            createOtherRoomStudent: false,
            roomPrefix,
            roomCapacity
        });
        const studentAccounts = new Map();
        for (const studentId of fixture.studentIds) {
            const account = await pool.request()
                .input("Email", sql.VarChar(100), `${studentId.toLowerCase()}@gmail.com`)
                .input("TenHienThi", sql.NVarChar(100), `Renewal ${studentId}`)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    INSERT INTO dbo.TaiKhoan (Email, MatKhau, TenHienThi, VaiTro, MaSinhVien)
                    OUTPUT inserted.MaTaiKhoan
                    VALUES (@Email, 'test-only-not-authenticated', @TenHienThi, N'Sinh viên', @MaSinhVien)
                `);
            studentAccounts.set(studentId, account.recordset[0].MaTaiKhoan);
        }

        const app = express();
        app.use(express.json());
        app.use("/api", createApiAuthenticationMiddleware({ jwt, getSecret: () => authSecret }));
        registerApiRoutes(app, {
            getPool: () => pool,
            sql,
            bcrypt,
            mapPaymentStatusToDatabase: value => ({
                PENDING: "PENDING", WAITING_CASH: "Chờ xác nhận",
                SUCCESS: "SUCCESS", REJECTED: "REJECTED",
                EXPIRED: "EXPIRED", "Cần đối soát": "RECONCILIATION",
                "Hợp lệ": "Hợp lệ", "Chờ xác nhận": "Chờ xác nhận", "Đã hủy": "Đã hủy"
            })[value] || null,
            mapPaymentMethodToDatabase: value => ({
                CASH: "CASH", ONLINE: "ONLINE", CHUYEN_DOI: "CHUYEN_DOI"
            })[value] || null,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });

        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const tokenFor = (role, studentId) => jwt.sign({
            sub: String(role === "Quản lý" ? fixture.managerId : studentAccounts.get(studentId)),
            role,
            ...(role === "Sinh viên" ? { studentId } : {})
        }, authSecret);
        const call = async (method, route, role, studentId, body) => {
            const headers = {};
            if (role) headers.Authorization = `Bearer ${tokenFor(role, studentId)}`;
            if (body !== undefined) headers["Content-Type"] = "application/json";
            const response = await fetch(`${baseUrl}${route}`, {
                method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };
        const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const shiftDate = (date, days) => {
            const value = new Date(`${date}T00:00:00.000Z`);
            value.setUTCDate(value.getUTCDate() + days);
            return value.toISOString().slice(0, 10);
        };
        const startDate = shiftDate(todayVN, -13);
        const endDate = shiftDate(startDate, 29);
        const members = fixture.studentIds.slice(0, memberCount);
        const contractMembers = allowOverCapacityFixture
            ? members.slice(0, roomCapacity)
            : members;
        const created = await call("POST", "/api/HopDong", "Quản lý", null, {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: startDate,
            ngayKetThuc: endDate,
            sinhVien: contractMembers.map((maSinhVien, index) => ({
                maSinhVien,
                kyHanThanhToanPhong: "THANG",
                laNguoiDaiDien: index === 0
            }))
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const contractId = created.body.MaHopDong;
        if (allowOverCapacityFixture) {
            // Model a legacy over-capacity contract while keeping room/class capacities FK-consistent.
            await pool.request()
                .input("MaHopDong", sql.NVarChar(20), contractId)
                .query(`
                    UPDATE dbo.ChiTietHopDong
                    SET TrangThai = N'Đã rời', NgayRa = CAST(GETDATE() AS date),
                        LaNguoiDaiDienThanhToanDichVu = 0
                    WHERE MaHopDong = @MaHopDong;
                    UPDATE dbo.ChiTietHopDong
                    SET TrangThai = N'Đang ở', NgayRa = NULL, LyDoRoi = NULL,
                        LaNguoiDaiDienThanhToanDichVu =
                            CASE WHEN MaChiTiet = (
                                SELECT MIN(MaChiTiet) FROM dbo.ChiTietHopDong
                                WHERE MaHopDong = @MaHopDong
                            ) THEN 1 ELSE 0 END
                    WHERE MaHopDong = @MaHopDong;
                `);
            for (const studentId of members.slice(contractMembers.length)) {
                await pool.request()
                    .input("MaHopDong", sql.NVarChar(20), contractId)
                    .input("MaSinhVien", sql.NVarChar(30), studentId)
                    .input("NgayVao", sql.Date, startDate)
                    .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                    .query(`
                        INSERT INTO dbo.ChiTietHopDong
                            (MaHopDong, MaSinhVien, NgayVao, KyHanThanhToanPhong,
                             GiaPhongApDung, GiaPhongThangApDung,
                             LaNguoiDaiDienThanhToanDichVu, TrangThai)
                        SELECT @MaHopDong, @MaSinhVien, @NgayVao, N'THANG',
                               hp.GiaPhongThang, hp.GiaPhongThang, 0, N'Đang ở'
                        FROM dbo.HangPhong hp
                        WHERE hp.MaHangPhong = @MaHangPhong
                    `);
            }
            await pool.request()
                .input("MaHopDong", sql.NVarChar(20), contractId)
                .query(`
                    UPDATE dbo.HopDong
                    SET TrangThaiHopDong = N'Còn hiệu lực', NgayKetThucThucTe = NULL
                    WHERE MaHopDong = @MaHopDong;
                `);
        }
        const detailResult = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaChiTiet, MaSinhVien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong
                ORDER BY MaChiTiet
            `);
        const detailByStudent = new Map(detailResult.recordset.map(row => [
            row.MaSinhVien, Number(row.MaChiTiet)
        ]));
        const invoiceByStudent = new Map(created.body.HoaDonTienPhong.map(item => [
            item.MaSinhVien, item.MaHoaDon
        ]));
        const renewTo = async (studentId, endDate) => {
            const result = await call(
                "PUT", `/api/HopDong/${contractId}/gia-han`, "Quản lý", null, {
                    maChiTiet: detailByStudent.get(studentId),
                    ngayKetThucMoi: endDate
                });
            return result;
        };
        const renew = (studentId, days = 10) =>
            renewTo(studentId, shiftDate(endDate, days));
        const renewalState = async studentId => pool.request()
            .input("MaChiTiet", sql.Int, detailByStudent.get(studentId))
            .query(`
                SELECT g.MaGiaHan, g.MaHoaDon, g.TrangThai, g.HanThanhToan,
                       g.NgayKetThucCu, g.NgayKetThucMoi,
                       effectiveEnd.NgayKetThucHieuLuc
                FROM dbo.GiaHanHopDong g
                INNER JOIN dbo.vw_NgayKetThucHieuLucThanhVien effectiveEnd
                    ON effectiveEnd.MaChiTiet = g.MaChiTiet
                WHERE g.MaChiTiet = @MaChiTiet
            `);
        const invoiceTotal = async invoiceId => {
            const result = await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .query(`
                    SELECT hd.LoaiHoaDon, hd.MaChiTiet,
                           SUM(line.SoTien) AS TongTien
                    FROM dbo.HoaDon hd
                    INNER JOIN dbo.ChiTietHoaDon line ON line.MaHoaDon = hd.MaHoaDon
                    WHERE hd.MaHoaDon = @MaHoaDon
                    GROUP BY hd.LoaiHoaDon, hd.MaChiTiet
                `);
            return result.recordset[0];
        };
        const payCash = async (invoiceId, studentId) => {
            if (!invoiceId) throw new Error("Thiếu mã hóa đơn gia hạn.");
            const total = await invoiceTotal(invoiceId);
            return call("POST", `/api/HoaDon/${invoiceId}/phieuthu`, "Quản lý", null, {
                soTien: Number(total?.TongTien), phuongThuc: "CASH",
                trangThai: "Hợp lệ", maSinhVienNop: studentId
            });
        };
        const createQrPayment = async (invoiceId, studentId) => {
            const result = await call("POST", "/api/payments/create", "Sinh viên", studentId, {
                MaHoaDon: invoiceId, PhuongThuc: "ONLINE"
            });
            assert.ok([200, 201].includes(result.status), JSON.stringify(result.body));
            return result.body;
        };
        const confirmDemoPayment = (invoiceId, studentId, payment, amount) =>
            call("POST", "/api/payments/demo-confirm", "Sinh viên", studentId, {
                MaHoaDon: invoiceId, MaGiaoDich: payment.MaGiaoDich, SoTien: amount
            });
        const sendWebhook = async (invoiceId, payment, replayPayload = null) => {
            const payload = replayPayload || {
                MaHoaDon: invoiceId,
                SoTien: Number(payment.SoTien),
                MaThamChieuNgoai: `BANK-${crypto.randomBytes(12).toString("hex").toUpperCase()}`,
                NoiDungCK: payment.NoiDungCK
            };
            const { createPaymentWebhookSignature } = require("./payment-webhook");
            const response = await fetch(`${baseUrl}/api/payments/bank-transfer/notify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-payment-signature": createPaymentWebhookSignature(webhookSecret, payload)
                },
                body: JSON.stringify(payload)
            });
            return { status: response.status, body: await response.json(), payload };
        };

        return await run({
            pool, fixture, members, detailByStudent, invoiceByStudent, contractId,
            startDate, endDate, todayVN, shiftDate, call, renew, renewTo, renewalState,
            invoiceTotal, payCash, createQrPayment, confirmDemoPayment, sendWebhook
        });
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool.connected && fixture) await cleanupSqlIntegrationFixture(pool, sql, fixture);
        await pool.close();
        for (const [key, value] of previousEnv) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

test("real SQL member renewal approval leaves the effective end date unchanged", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(1, async context => {
    const studentId = context.members[0];
    const result = await context.renew(studentId);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const state = (await context.renewalState(studentId)).recordset[0];
    assert.equal(state.TrangThai, "Chờ thanh toán");
    assert.equal(state.NgayKetThucHieuLuc.toISOString().slice(0, 10), context.endDate);
    const invoice = await context.invoiceTotal(state.MaHoaDon);
    assert.equal(invoice.LoaiHoaDon, "TIEN_PHONG");
    assert.equal(Number(invoice.TongTien), 400000);
}));

test("real SQL member renewal activates through QR, webhook, and cash payment", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(3, async context => {
    const channels = ["cash", "QR demo", "bank webhook"];
    const renewals = [];
    for (let index = 0; index < context.members.length; index += 1) {
        const studentId = context.members[index];
        const result = await context.renew(studentId);
        assert.equal(result.status, 201, JSON.stringify(result.body));
        renewals.push({ studentId, invoiceId: result.body.MaHoaDon, channel: channels[index] });
    }

    for (const renewal of renewals) {
        let result;
        if (renewal.channel === "cash") {
            result = await context.payCash(renewal.invoiceId, renewal.studentId);
        } else {
            const payment = await context.createQrPayment(renewal.invoiceId, renewal.studentId);
            result = renewal.channel === "QR demo"
                ? await context.confirmDemoPayment(
                    renewal.invoiceId, renewal.studentId, payment, Number(payment.SoTien))
                : await context.sendWebhook(renewal.invoiceId, payment);
        }
        assert.equal(result.status, renewal.channel === "cash" ? 201 : 200,
            `${renewal.channel}: ${JSON.stringify(result.body)}`);
        const state = (await context.renewalState(renewal.studentId)).recordset[0];
        assert.equal(state.TrangThai, "Đã hiệu lực", renewal.channel);
        assert.equal(state.NgayKetThucHieuLuc.toISOString().slice(0, 10),
            context.shiftDate(context.endDate, 10), renewal.channel);
    }
}));

test("real SQL renewal rejects short and excess QR amounts without activation", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(1, async context => {
    const studentId = context.members[0];
    const renewal = await context.renew(studentId);
    assert.equal(renewal.status, 201, JSON.stringify(renewal.body));
    const payment = await context.createQrPayment(renewal.body.MaHoaDon, studentId);
    const required = Number(payment.SoTien);
    for (const amount of [required - 1, required + 1]) {
        const rejected = await context.confirmDemoPayment(
            renewal.body.MaHoaDon, studentId, payment, amount);
        assert.equal(rejected.status, 400, JSON.stringify(rejected.body));
    }
    const state = (await context.renewalState(studentId)).recordset[0];
    assert.equal(state.TrangThai, "Chờ thanh toán");
    assert.equal(state.NgayKetThucHieuLuc.toISOString().slice(0, 10), context.endDate);
}));

test("real SQL duplicate bank webhook activates a member renewal once", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(1, async context => {
    const studentId = context.members[0];
    const renewal = await context.renew(studentId);
    assert.equal(renewal.status, 201, JSON.stringify(renewal.body));
    const payment = await context.createQrPayment(renewal.body.MaHoaDon, studentId);
    const first = await context.sendWebhook(renewal.body.MaHoaDon, payment);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const repeated = await context.sendWebhook(renewal.body.MaHoaDon, payment, first.payload);
    assert.equal(repeated.status, 200, JSON.stringify(repeated.body));
    assert.equal(repeated.body.alreadyProcessed, true);
    const state = (await context.renewalState(studentId)).recordset[0];
    assert.equal(state.TrangThai, "Đã hiệu lực");
    const receipts = await context.pool.request()
        .input("MaHoaDon", sql.NVarChar(20), renewal.body.MaHoaDon)
        .query(`
            SELECT COUNT_BIG(*) AS ReceiptCount
            FROM dbo.PhieuThu
            WHERE MaHoaDon = @MaHoaDon AND TrangThai = N'Hợp lệ'
        `);
    assert.equal(Number(receipts.recordset[0].ReceiptCount), 1);
}));

test("real SQL overdue member renewal cancels before attempted QR payment", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(1, async context => {
    const studentId = context.members[0];
    const renewal = await context.renew(studentId);
    assert.equal(renewal.status, 201, JSON.stringify(renewal.body));
    const payment = await context.createQrPayment(renewal.body.MaHoaDon, studentId);
    const stateBefore = (await context.renewalState(studentId)).recordset[0];
    await context.pool.request()
        .input("MaGiaHan", sql.Int, stateBefore.MaGiaHan)
        .query(`
            UPDATE dbo.GiaHanHopDong
            SET HanThanhToan = DATEADD(day, -1, CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME())))
            WHERE MaGiaHan = @MaGiaHan AND TrangThai = N'Chờ thanh toán'
        `);
    const result = await context.confirmDemoPayment(
        renewal.body.MaHoaDon, studentId, payment, Number(payment.SoTien));
    assert.equal(result.status, 409, JSON.stringify(result.body));
    const state = (await context.renewalState(studentId)).recordset[0];
    assert.equal(state.TrangThai, "Hủy");
    assert.equal(state.NgayKetThucHieuLuc.toISOString().slice(0, 10), context.endDate);
    const invoice = await context.pool.request()
        .input("MaHoaDon", sql.NVarChar(20), renewal.body.MaHoaDon)
        .query("SELECT TrangThaiThanhToan FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon");
    assert.equal(invoice.recordset[0].TrangThaiThanhToan, "Đã hủy");
}));

test("real SQL second pending renewal for the same member is rejected", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(1, async context => {
    const studentId = context.members[0];
    const first = await context.renew(studentId);
    const second = await context.renew(studentId);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(second.status, 409, JSON.stringify(second.body));
    const state = await context.renewalState(studentId);
    assert.equal(state.recordset.length, 1);
    assert.equal(state.recordset[0].TrangThai, "Chờ thanh toán");
}));

test("real SQL activating one member renewal does not change another member end date", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(2, async context => {
    const [renewingStudent, otherStudent] = context.members;
    const renewal = await context.renew(renewingStudent);
    assert.equal(renewal.status, 201, JSON.stringify(renewal.body));
    const payment = await context.payCash(renewal.body.MaHoaDon, renewingStudent);
    assert.equal(payment.status, 201, JSON.stringify(payment.body));
    const [renewed, unchanged] = await Promise.all([
        context.renewalState(renewingStudent),
        context.pool.request()
            .input("MaChiTiet", sql.Int, context.detailByStudent.get(otherStudent))
            .query(`
                SELECT effectiveEnd.NgayKetThucHieuLuc
                FROM dbo.vw_NgayKetThucHieuLucThanhVien effectiveEnd
                WHERE effectiveEnd.MaChiTiet = @MaChiTiet
            `)
    ]);
    assert.equal(renewed.recordset[0].TrangThai, "Đã hiệu lực");
    assert.equal(renewed.recordset[0].NgayKetThucHieuLuc.toISOString().slice(0, 10),
        context.shiftDate(context.endDate, 10));
    assert.equal(unchanged.recordset[0].NgayKetThucHieuLuc.toISOString().slice(0, 10),
        context.endDate);
}));

test("real SQL pending renewal reserves room capacity and over-capacity approval returns 409", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(5, async context => {
    const reservingMembers = context.members.slice(0, 4);
    const reservations = new Map();
    for (const studentId of reservingMembers) {
        const result = await context.renew(studentId);
        assert.equal(result.status, 201, JSON.stringify(result.body));
        const state = (await context.renewalState(studentId)).recordset[0];
        assert.equal(state.TrangThai, "Chờ thanh toán");
        reservations.set(studentId, state.MaGiaHan);
    }
    const competing = await context.renew(context.members[4]);
    assert.equal(competing.status, 409, JSON.stringify(competing.body));
    assert.match(competing.body.message, /sức chứa phòng/i);
    for (const [studentId, renewalId] of reservations) {
        const reservationAfter = (await context.renewalState(studentId)).recordset[0];
        assert.equal(reservationAfter.MaGiaHan, renewalId);
        assert.equal(reservationAfter.TrangThai, "Chờ thanh toán");
    }
}, { roomCapacity: 4, allowOverCapacityFixture: true }));

test("real SQL contract remains active while any member has an effective end date", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(2, async context => {
    const [departingStudent] = context.members;
    await context.pool.request()
        .input("MaChiTiet", sql.Int, context.detailByStudent.get(departingStudent))
        .input("NgayRa", sql.Date, context.todayVN)
        .input("LyDoRoi", sql.NVarChar(100), "SQL renewal test")
        .input("NguoiThucHien", sql.Int, context.fixture.managerId)
        .execute("dbo.sp_SinhVienRoiHopDong");
    await context.pool.request().execute("dbo.sp_CapNhatHopDong");
    const contract = await context.pool.request()
        .input("MaHopDong", sql.NVarChar(20), context.contractId)
        .query("SELECT TrangThaiHopDong FROM dbo.HopDong WHERE MaHopDong = @MaHopDong");
    assert.equal(contract.recordset[0].TrangThaiHopDong, "Còn hiệu lực");
}));

test("real SQL early checkout cancels a pending member renewal and its invoice", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(1, async context => {
    const studentId = context.members[0];
    const renewal = await context.renew(studentId);
    assert.equal(renewal.status, 201, JSON.stringify(renewal.body));
    const request = await context.call("POST", "/api/student/requests", "Sinh viên", studentId, {
        Loai: "Trả phòng sớm",
        NoiDung: "Yêu cầu trả phòng sớm để kiểm tra hủy gia hạn đang chờ.",
        NgayKetThucDeXuat: context.todayVN
    });
    assert.equal(request.status, 201, JSON.stringify(request.body));
    const decision = await context.call(
        "PUT", `/api/requests/${request.body.MaYeuCau}`, "Quản lý", null,
        { TrangThai: "Đã duyệt" });
    assert.equal(decision.status, 200, JSON.stringify(decision.body));
    const state = (await context.renewalState(studentId)).recordset[0];
    assert.equal(state.TrangThai, "Hủy");
    const invoice = await context.pool.request()
        .input("MaHoaDon", sql.NVarChar(20), renewal.body.MaHoaDon)
        .query("SELECT TrangThaiThanhToan FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon");
    assert.equal(invoice.recordset[0].TrangThaiThanhToan, "Đã hủy");
}));

test("real SQL concurrent renewal approval and payment complete in five rounds without deadlock", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 180000
}, async () => withSqlMemberRenewalFixture(1, async context => {
    const studentId = context.members[0];
    let nextEnd = context.shiftDate(context.endDate, 5);
    for (let round = 1; round <= 5; round += 1) {
        const renewal = await context.renewTo(studentId, nextEnd);
        assert.equal(renewal.status, 201, `round ${round}: ${JSON.stringify(renewal.body)}`);
        const invoice = await context.invoiceTotal(renewal.body.MaHoaDon);
        const [duplicateApproval, payment] = await Promise.all([
            context.renewTo(studentId, nextEnd),
            context.payCash(renewal.body.MaHoaDon, studentId)
        ]);
        assert.equal(payment.status, 201, `round ${round}: ${JSON.stringify(payment.body)}`);
        assert.ok([400, 409].includes(duplicateApproval.status),
            `round ${round}: duplicate approval status ${duplicateApproval.status}: ${JSON.stringify(duplicateApproval.body)}`);
        assert.notEqual(payment.status, 500, `round ${round}: payment did not deadlock`);
        const state = (await context.renewalState(studentId)).recordset
            .find(row => row.MaHoaDon === renewal.body.MaHoaDon);
        assert.ok(state);
        assert.equal(state.TrangThai, "Đã hiệu lực");
        assert.equal(Number(invoice.TongTien), 200000);
        nextEnd = context.shiftDate(nextEnd, 5);
    }
}));

async function runSqlEarlyCheckoutRefundScenario({ sql, withRenewal }) {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình SQL Server cho kiểm thử hoàn tiền trả phòng sớm.");
    }

    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    let contractId;
    let studentId;

    try {
        assert.equal((await pool.request().query("SELECT DB_NAME() AS DatabaseName"))
            .recordset[0].DatabaseName, "KTX_Group3_test");
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 1,
            createOtherRoomStudent: false
        });
        [studentId] = fixture.studentIds;
        const shift = (iso, amount) => {
            const date = new Date(`${iso}T00:00:00.000Z`);
            date.setUTCDate(date.getUTCDate() + amount);
            return date.toISOString().slice(0, 10);
        };
        const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const startDate = shift(todayVN, -13);
        const endDate = shift(startDate, 29);
        const checkoutDate = withRenewal ? shift(endDate, 5) : todayVN;
        const authSecret = `refund-${crypto.randomBytes(24).toString("hex")}`;
        const app = express();
        app.use(express.json());
        app.use("/api", createApiAuthenticationMiddleware({ jwt, getSecret: () => authSecret }));
        registerApiRoutes(app, {
            getPool: () => pool, sql, bcrypt,
            mapPaymentStatusToDatabase: value => value,
            mapPaymentMethodToDatabase: value => value,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const call = async (method, route, role, body) => {
            const headers = {};
            if (body !== undefined && body !== null) headers["Content-Type"] = "application/json";
            if (role === "manager") {
                headers.Authorization = `Bearer ${jwt.sign(
                    { sub: String(fixture.managerId), role: "Quản lý" }, authSecret
                )}`;
            }
            const response = await fetch(`${baseUrl}${route}`, {
                method, headers,
                ...(body === undefined || body === null ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };

        const contract = await call("POST", "/api/HopDong", "manager", {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: startDate,
            ngayKetThuc: endDate,
            sinhVien: [{
                maSinhVien: studentId,
                kyHanThanhToanPhong: "THANG",
                laNguoiDaiDien: true
            }]
        });
        assert.equal(contract.status, 201, JSON.stringify(contract.body));
        contractId = contract.body.MaHopDong;
        const baseInvoiceId = contract.body.HoaDonTienPhong
            .find(item => item.MaSinhVien === studentId)?.MaHoaDon;
        assert.ok(baseInvoiceId);
        const baseInvoiceTotal = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), baseInvoiceId)
            .query("SELECT SUM(SoTien) AS TongTien FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @MaHoaDon");
        assert.equal(Number(baseInvoiceTotal.recordset[0].TongTien), 1200000);
        const baseInvoicePeriod = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), baseInvoiceId)
            .query(`
                SELECT CONVERT(char(10), KyThanhToan, 23) AS KyThanhToan,
                       CONVERT(char(10), KyThanhToanDen, 23) AS KyThanhToanDen
                FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon
            `);
        await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), baseInvoiceId)
            .input("SoTien", sql.Decimal(18, 2), 1200000)
            .input("PhuongThuc", sql.NVarChar(20), "CASH")
            .input("MaSinhVienNop", sql.NVarChar(30), studentId)
            .input("NguoiThu", sql.Int, fixture.managerId)
            .execute("dbo.sp_GhiPhieuThu");

        let renewalInvoiceId;
        let renewalId;
        let renewalStartDate;
        let renewalEndDate;
        if (withRenewal) {
            const detail = await pool.request()
                .input("MaHopDong", sql.NVarChar(20), contractId)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    SELECT MaChiTiet FROM dbo.ChiTietHopDong
                    WHERE MaHopDong = @MaHopDong AND MaSinhVien = @MaSinhVien
                `);
            assert.equal(detail.recordset.length, 1);
            const renewal = await pool.request()
                .input("MaHopDong", sql.NVarChar(20), contractId)
                .input("MaChiTiet", sql.Int, detail.recordset[0].MaChiTiet)
                .input("NgayKetThucMoi", sql.Date, shift(endDate, 10))
                .input("NguoiThucHien", sql.Int, fixture.managerId)
                .output("MaGiaHan", sql.Int)
                .output("MaHoaDon", sql.NVarChar(20))
                .execute("dbo.sp_DuyetGiaHan");
            renewalId = renewal.output.MaGiaHan;
            renewalInvoiceId = renewal.output.MaHoaDon;
            assert.ok(renewalId);
            assert.ok(renewalInvoiceId);
            const renewalTotal = await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), renewalInvoiceId)
                .query("SELECT SUM(SoTien) AS TongTien FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @MaHoaDon");
            assert.equal(Number(renewalTotal.recordset[0].TongTien), 400000);
            await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), renewalInvoiceId)
                .input("SoTien", sql.Decimal(18, 2), 400000)
                .input("PhuongThuc", sql.NVarChar(20), "CASH")
                .input("MaSinhVienNop", sql.NVarChar(30), studentId)
                .input("NguoiThu", sql.Int, fixture.managerId)
                .execute("dbo.sp_GhiPhieuThu");
            await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), renewalInvoiceId)
                .execute("dbo.sp_KichHoatGiaHan");
            const renewalState = await pool.request()
                .input("MaGiaHan", sql.Int, renewalId)
                .query(`
                    SELECT DATEADD(day, 1, NgayKetThucCu) AS NgayBatDau,
                           NgayKetThucMoi, TrangThai
                    FROM dbo.GiaHanHopDong WHERE MaGiaHan = @MaGiaHan
                `);
            assert.equal(renewalState.recordset[0]?.TrangThai, "Đã hiệu lực");
            renewalStartDate = renewalState.recordset[0].NgayBatDau.toISOString().slice(0, 10);
            renewalEndDate = renewalState.recordset[0].NgayKetThucMoi.toISOString().slice(0, 10);
        }

        const request = await pool.request()
            .input("MaSinhVien", sql.NVarChar(30), studentId)
            .input("Loai", sql.NVarChar(30), "Trả phòng sớm")
            .input("NoiDung", sql.NVarChar(1000), "SQL test trả phòng sớm.")
            .input("NgayKetThucDeXuat", sql.Date, checkoutDate)
            .input("TenPhong", sql.NVarChar(50), fixture.roomA)
            .query(`
                INSERT INTO dbo.YeuCauSinhVien
                    (MaSinhVien, Loai, NoiDung, NgayKetThucDeXuat, TenPhong)
                OUTPUT inserted.MaYeuCau
                VALUES (@MaSinhVien, @Loai, @NoiDung, @NgayKetThucDeXuat, @TenPhong)
            `);
        const requestId = request.recordset[0].MaYeuCau;
        const preview = await call("GET", `/api/requests/${requestId}/early-checkout`,
            "manager", null);
        const decision = await call("PUT", `/api/requests/${requestId}`,
            "manager", { TrangThai: "Đã duyệt" });
        const cashOut = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .input("MaSinhVien", sql.NVarChar(30), studentId)
            .query(`
                SELECT SUM(pc.SoTien) AS SoTienHoan
                FROM dbo.PhieuChi pc
                INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                WHERE c.MaHopDong = @MaHopDong AND c.MaSinhVien = @MaSinhVien
                  AND pc.LyDo = N'Trả phòng sớm'
            `);
        const inclusiveDays = (start, end) =>
            Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`))
                / 86400000) + 1;
        const baseDays = inclusiveDays(startDate, endDate);
        const baseLivedDays = Math.min(baseDays, inclusiveDays(startDate, checkoutDate));
        const renewalDays = withRenewal
            ? inclusiveDays(renewalStartDate, renewalEndDate) : 0;
        const renewalLivedDays = withRenewal
            ? Math.max(0, Math.min(renewalDays, inclusiveDays(renewalStartDate, checkoutDate)))
            : 0;
        return {
            decision,
            preview,
            refund: Number(decision.body?.SoTienHoan),
            cashOut: Number(cashOut.recordset[0].SoTienHoan || 0),
            baseRent: Number(baseInvoiceTotal.recordset[0].TongTien),
            renewalRent: withRenewal ? 400000 : 0,
            baseInvoiceId,
            baseInvoicePeriod: baseInvoicePeriod.recordset[0],
            renewalInvoiceId,
            renewalId,
            startDate,
            endDate,
            checkoutDate,
            renewalStartDate,
            renewalEndDate,
            baseDays,
            baseLivedDays,
            renewalDays,
            renewalLivedDays
        };
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool.connected && fixture) {
            const cleanup = new sql.Transaction(pool);
            await cleanup.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            try {
                if (contractId) {
                    await new sql.Request(cleanup)
                        .input("MaHopDong", sql.NVarChar(20), contractId)
                        .input("NguoiThucHien", sql.Int, fixture.managerId || null)
                        .execute("dbo.sp_HuyPhieuChiFixtureKiemThu");
                    await new sql.Request(cleanup)
                        .input("MaHopDong", sql.NVarChar(20), contractId)
                        .input("NguoiThucHien", sql.Int, fixture.managerId || null)
                        .execute("dbo.sp_DonDepFixtureTaiChinhKiemThu");
                    await new sql.Request(cleanup)
                        .input("MaHopDong", sql.NVarChar(20), contractId)
                        .query(`
                            DELETE tb FROM dbo.ThongBao tb WHERE tb.MaSinhVien IN
                                (SELECT MaSinhVien FROM dbo.ChiTietHopDong WHERE MaHopDong = @MaHopDong);
                            DELETE pha FROM dbo.PhieuChi_HoaDon pha
                                INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = pha.MaPhieuChi
                                INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                                WHERE c.MaHopDong = @MaHopDong;
                            DELETE log FROM dbo.NhatKyHeThong log
                                INNER JOIN dbo.PhieuChi pc
                                    ON log.DoiTuong = N'PhieuChi'
                                   AND log.MaDoiTuong = CONVERT(nvarchar(60), pc.MaPhieuChi)
                                INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                                WHERE c.MaHopDong = @MaHopDong
                                  AND log.HanhDong = N'Hủy phiếu chi fixture kiểm thử';
                            DELETE log FROM dbo.NhatKyHeThong log
                                INNER JOIN dbo.GiaHanHopDong g
                                    ON log.DoiTuong = N'GiaHanHopDong'
                                   AND log.MaDoiTuong = CONVERT(nvarchar(60), g.MaGiaHan)
                                WHERE g.MaHopDong = @MaHopDong;
                            DELETE FROM dbo.NhatKyHeThong
                            WHERE DoiTuong = N'FixtureCleanup' AND MaDoiTuong = @MaHopDong;
                            DELETE pc FROM dbo.PhieuChi pc
                                INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                                WHERE c.MaHopDong = @MaHopDong;
                            DELETE pt FROM dbo.PhieuThu pt
                                INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                                WHERE hd.MaHopDong = @MaHopDong;
                            DELETE FROM dbo.GiaHanHopDong WHERE MaHopDong = @MaHopDong;
                            DELETE yc FROM dbo.YeuCauSinhVien yc
                                INNER JOIN dbo.ChiTietHopDong c ON c.MaSinhVien = yc.MaSinhVien
                                WHERE c.MaHopDong = @MaHopDong;
                        `);
                    await deleteContractInvoices(cleanup, sql, contractId);
                    await new sql.Request(cleanup)
                        .input("MaHopDong", sql.NVarChar(20), contractId)
                        .query(`
                            DELETE FROM dbo.ChiTietHopDong WHERE MaHopDong = @MaHopDong;
                            DELETE FROM dbo.HopDong WHERE MaHopDong = @MaHopDong;
                        `);
                }
                for (const id of fixture.studentIds) {
                    await new sql.Request(cleanup).input("MaSinhVien", sql.NVarChar(30), id)
                        .query("DELETE FROM dbo.TaiKhoan WHERE MaSinhVien = @MaSinhVien; DELETE FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien;");
                }
                await new sql.Request(cleanup)
                    .input("ManagerId", sql.Int, fixture.managerId)
                    .input("TierId", sql.NVarChar(20), fixture.tierId)
                    .input("ServiceId", sql.NVarChar(20), fixture.serviceId)
                    .input("RoomA", sql.NVarChar(50), fixture.roomA)
                    .input("RoomB", sql.NVarChar(50), fixture.roomB)
                    .query(`
                        DELETE FROM dbo.TaiKhoan WHERE MaTaiKhoan = @ManagerId;
                        DELETE FROM dbo.Phong WHERE TenPhong IN (@RoomA, @RoomB);
                        DELETE FROM dbo.HangPhong_DichVu WHERE MaHangPhong = @TierId;
                        DELETE FROM dbo.DichVu WHERE MaDichVu = @ServiceId;
                        DELETE FROM dbo.HangPhong WHERE MaHangPhong = @TierId;
                    `);
                await cleanup.commit();
            } catch (error) {
                try {
                    await cleanup.rollback();
                } catch (rollbackError) {
                    if (rollbackError.code !== "EABORT") throw rollbackError;
                }
                throw error;
            }
        }
        await pool.close();
    }
}

function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        send(value) { this.body = value; return this; }
    };
}

async function invoke(harness, method, route, request = {}) {
    const handler = harness.routes.get(`${method} ${route}`);
    assert.equal(typeof handler, "function", `${method} ${route} registered`);
    const res = response();
    await handler({
        params: {},
        query: {},
        body: {},
        auth: { role: "Quản lý", accountId: 17 },
        ...request
    }, res);
    return res;
}

test("student notifications are session-scoped and admin removal is a soft delete", async () => {
    const harness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("SELECT tb.MaThongBao")) return { recordset: [] };
            if (call.statement === "SELECT MaSinhVien FROM dbo.SinhVien") return { recordset: [] };
            if (call.statement.includes("UPDATE dbo.ThongBao")) return { recordset: [{ MaThongBao: 12 }] };
            return { recordset: [] };
        }
    });
    const denied = await invoke(harness, "get", "/api/student/notifications", {
        auth: { role: "Sinh viên", studentId: "SV-A" },
        query: { MaSinhVien: "SV-B" }
    });
    assert.equal(denied.statusCode, 200);
    assert.equal(harness.queries.length, 2);
    const select = harness.queries[0];
    assert.equal(select.inputs.MaSinhVien, "SV-A");
    assert.match(select.statement, /PhamViNhan = N'TAT_CA'/);
    assert.match(select.statement, /tb\.PhamViNhan = N'SINH_VIEN' AND tb\.MaSinhVien = @MaSinhVien/);
    assert.match(select.statement, /dbo\.ChiTietHopDong/);
    assert.match(select.statement, /c\.TrangThai = N'Đang ở'/);
    assert.match(select.statement, /hd\.TrangThaiHopDong = N'Còn hiệu lực'/);
    assert.match(select.statement, /tb\.DaXoa = 0/);
    assert.doesNotMatch(select.statement, /SinhVien\.TenPhong|req\.query|req\.body/);

    const deniedManager = await invoke(harness, "post", "/api/admin/notifications", {
        auth: { role: "Sinh viên", studentId: "SV-A" },
        body: { TieuDe: "T", NoiDung: "N", PhamViNhan: "TAT_CA" }
    });
    assert.equal(deniedManager.statusCode, 403);
    const hidden = await invoke(harness, "delete", "/api/admin/notifications/:id", {
        auth: { role: "Quản lý", accountId: 17 },
        params: { id: "12" }
    });
    assert.equal(hidden.statusCode, 200);
    const softDelete = harness.queries.find(query => query.statement.includes("UPDATE dbo.ThongBao"));
    assert.match(softDelete.statement, /UPDATE dbo\.ThongBao\s+SET DaXoa = 1/);
    assert.doesNotMatch(softDelete.statement, /\bDELETE\s+FROM\b/i);
});

test("notification text masks only known student identities and preserves business references", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT MaThongBao")
            ? { recordset: [{
                MaThongBao: 8,
                TieuDe: "CCCD 012345678901 hộ chiếu AB12CD34",
                NoiDung: "Hóa đơn HD20261001, hợp đồng HD00042, phòng A103, giao dịch PAY-1, QR KTXABCDEF0123456789ABCD",
                PhamViNhan: "TAT_CA",
                MaSinhVien: null
            }] }
            : call.statement === "SELECT MaSinhVien FROM dbo.SinhVien"
                ? { recordset: [{ MaSinhVien: "012345678901" }, { MaSinhVien: "AB12CD34" }] }
                : { recordset: [] }
    });
    const result = await invoke(harness, "get", "/api/admin/notifications");
    assert.equal(result.statusCode, 200);
    assert.equal(result.body[0].TieuDe, "CCCD 0123****8901 hộ chiếu AB****34");
    assert.equal(result.body[0].NoiDung,
        "Hóa đơn HD20261001, hợp đồng HD00042, phòng A103, giao dịch PAY-1, QR KTXABCDEF0123456789ABCD");
});

test("QR demo confirmation is unavailable when the feature flag is disabled", async () => {
    const original = process.env.ALLOW_DEMO_PAYMENT;
    delete process.env.ALLOW_DEMO_PAYMENT;
    try {
        const harness = fakeApi();
        const result = await invoke(harness, "post", "/api/payments/demo-confirm", {
            auth: { role: "Sinh viên", accountId: 23, studentId: "SV-A" },
            body: { MaHoaDon: "INV1", MaGiaoDich: `PAY-${"A".repeat(32)}` }
        });
        assert.equal(result.statusCode, 503);
        assert.equal(result.body.message, "Thanh toán QR demo đang tắt.");
        assert.equal(harness.queries.length, 0);
    } finally {
        if (original === undefined) delete process.env.ALLOW_DEMO_PAYMENT;
        else process.env.ALLOW_DEMO_PAYMENT = original;
    }
});

test("public office contact uses configured phone and hours", async () => {
    const previous = {
        phone: process.env.OFFICE_PHONE,
        hours: process.env.OFFICE_HOURS
    };
    process.env.OFFICE_PHONE = "0123456789";
    process.env.OFFICE_HOURS = "08:00-17:00";
    try {
        const harness = fakeApi({
            queryResult: () => ({ recordset: [
                { Khoa: "SUPPORT_PHONE", GiaTri: "0999999999" },
                { Khoa: "SUPPORT_HOURS", GiaTri: "09:00-18:00" },
                { Khoa: "SUPPORT_EMAIL", GiaTri: "office@example.test" }
            ] })
        });
        const result = await invoke(harness, "get", "/api/lien-he");
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.body, {
            DienThoai: "0123456789",
            Email: "office@example.test",
            GioLamViec: "08:00-17:00"
        });
    } finally {
        if (previous.phone === undefined) delete process.env.OFFICE_PHONE;
        else process.env.OFFICE_PHONE = previous.phone;
        if (previous.hours === undefined) delete process.env.OFFICE_HOURS;
        else process.env.OFFICE_HOURS = previous.hours;
    }
});

test("invoice notifications include configured cash-payment guidance without changing the event key", async () => {
    const previous = {
        phone: process.env.OFFICE_PHONE,
        hours: process.env.OFFICE_HOURS
    };
    process.env.OFFICE_PHONE = "0123456789";
    process.env.OFFICE_HOURS = "08:00-17:00";
    try {
        const harness = fakeApi({
            queryResult: call => {
                if (call.statement.includes("SELECT hd.MaHopDong, hd.LoaiHoaDon")) {
                    return { recordset: [{
                        MaHopDong: "HD00001", LoaiHoaDon: "TIEN_PHONG",
                        TongThuc: 1200000, HanThanhToan: "2026-03-08"
                    }] };
                }
                if (call.statement.includes("SELECT DISTINCT c.MaSinhVien")) {
                    return { recordset: [{ MaSinhVien: "SV001" }] };
                }
                return { recordset: [], rowsAffected: [1] };
            },
            executeResult: () => ({ recordset: [], output: { MaHoaDon: "INV-CASH-NOTICE" } })
        });
        const result = await invoke(harness, "post", "/api/HoaDon/xuat-ky", {
            body: { loaiHoaDon: "TIEN_PHONG", maChiTiet: 45, kyThanhToan: "2026-03-01" }
        });
        assert.equal(result.statusCode, 201);
        const notification = harness.queries.find(call =>
            call.statement.includes("INSERT INTO dbo.ThongBao"));
        assert.equal(notification.inputs.MaSuKien, "INVOICE:INV-CASH-NOTICE");
        assert.match(notification.inputs.NoiDung, /giờ làm việc 08:00-17:00/);
        assert.match(notification.inputs.NoiDung, /SĐT 0123456789/);
    } finally {
        if (previous.phone === undefined) delete process.env.OFFICE_PHONE;
        else process.env.OFFICE_PHONE = previous.phone;
        if (previous.hours === undefined) delete process.env.OFFICE_HOURS;
        else process.env.OFFICE_HOURS = previous.hours;
    }
});

test("Yêu cầu khác requires non-empty description and rejects proposed end dates", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT sv.TenPhong")
            ? { recordset: [{ TenPhong: null, NgayKetThuc: null }] }
            : { recordset: [{ MaYeuCau: "YC1" }], rowsAffected: [1] }
    });
    const empty = await invoke(harness, "post", "/api/student/requests", {
        auth: { role: "Sinh viên", studentId: "SV-A" },
        body: { Loai: "Yêu cầu khác", NoiDung: " " }
    });
    assert.equal(empty.statusCode, 400);
    assert.equal(harness.queries.length, 0);

    const withDate = await invoke(harness, "post", "/api/student/requests", {
        auth: { role: "Sinh viên", studentId: "SV-A" },
        body: { Loai: "Yêu cầu khác", NoiDung: "Mô tả sự việc", NgayKetThucDeXuat: "2026-12-31" }
    });
    assert.equal(withDate.statusCode, 400);
    assert.equal(harness.queries.length, 0);

    const accepted = await invoke(harness, "post", "/api/student/requests", {
        auth: { role: "Sinh viên", studentId: "SV-A" },
        body: { Loai: "Yêu cầu khác", NoiDung: "Mô tả sự việc" }
    });
    assert.equal(accepted.statusCode, 201);
    const insert = harness.queries.find(call => call.statement.includes("INSERT INTO dbo.YeuCauSinhVien"));
    assert.equal(insert.inputs.Loai, "Yêu cầu khác");
    assert.equal(insert.inputs.NgayKetThucDeXuat, null);
});

test("early checkout request validates reason, active-member date range, and stores only the student's request", async () => {
    const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const proposedDate = new Date(`${todayVN}T00:00:00.000Z`);
    proposedDate.setUTCDate(proposedDate.getUTCDate() + 2);
    const endDate = new Date(`${todayVN}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 20);
    const isoDate = date => date.toISOString().slice(0, 10);
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT TOP (1) c.MaChiTiet")
            ? { recordset: [{
                MaChiTiet: 71,
                NgayVao: todayVN,
                NgayKetThuc: isoDate(endDate),
                HomNayVN: todayVN,
                TenPhong: "A201"
            }] }
            : call.statement.includes("SELECT sv.TenPhong")
                ? { recordset: [{ TenPhong: "A201", NgayKetThuc: isoDate(endDate) }] }
                : call.statement.includes("INSERT INTO dbo.YeuCauSinhVien")
                    ? { recordset: [{ MaYeuCau: "YC00001", TrangThai: "Chờ duyệt" }], rowsAffected: [1] }
                    : { recordset: [] }
    });
    const invalidReason = await invoke(harness, "post", "/api/student/requests", {
        auth: { role: "Sinh viên", studentId: "SV-A" },
        body: { Loai: "Trả phòng sớm", NoiDung: "Ngắn", NgayKetThucDeXuat: isoDate(proposedDate) }
    });
    assert.equal(invalidReason.statusCode, 400);
    assert.equal(harness.transactions.length, 0);

    const accepted = await invoke(harness, "post", "/api/student/requests", {
        auth: { role: "Sinh viên", studentId: "SV-A" },
        body: {
            Loai: "Trả phòng sớm",
            NoiDung: "  Xin trả phòng sớm vì chuyển nơi ở.  ",
            NgayKetThucDeXuat: isoDate(proposedDate)
        }
    });
    assert.equal(accepted.statusCode, 201);
    const insert = harness.queries.find(call => call.statement.includes("INSERT INTO dbo.YeuCauSinhVien"));
    assert.equal(insert.inputs.MaSinhVien, "SV-A");
    assert.equal(insert.inputs.Loai, "Trả phòng sớm");
    assert.equal(insert.inputs.NoiDung, "Xin trả phòng sớm vì chuyển nơi ở.");
    assert.equal(insert.inputs.NgayKetThucDeXuat, isoDate(proposedDate));
    assert.equal(harness.transactions.at(-1).state, "committed");
});

test("incident cost API requires an explicit valid due date before opening a SQL transaction", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT hd.MaHopDong")
            ? { recordset: [{ MaHopDong: "HD1" }] }
            : call.statement.includes("INSERT INTO dbo.ChiPhiPhatSinh")
                ? { recordset: [{ MaChiPhi: 1 }] }
                : { recordset: [], rowsAffected: [1] }
    });
    const baseBody = {
        maHopDong: "HD1", maChiTiet: null, noiDung: "Sửa vòi nước",
        soTien: 300, ngayPhatSinh: "2026-03-01", cheDoLap: "GOP"
    };
    const missingDue = await invoke(harness, "post", "/api/ChiPhiPhatSinh", { body: baseBody });
    assert.equal(missingDue.statusCode, 400);
    assert.match(missingDue.body.message, /hạn đóng/i);
    assert.equal(harness.transactions.length, 0);

    const invalidDue = await invoke(harness, "post", "/api/ChiPhiPhatSinh", {
        body: { ...baseBody, hanDong: "2026-02-31" }
    });
    assert.equal(invalidDue.statusCode, 400);
    assert.equal(harness.transactions.length, 0);

    const accepted = await invoke(harness, "post", "/api/ChiPhiPhatSinh", {
        body: { ...baseBody, hanDong: "2026-03-08" }
    });
    assert.equal(accepted.statusCode, 201);
    assert.equal(harness.transactions[0].state, "committed");
    const insert = harness.queries.find(call => call.statement.includes("INSERT INTO dbo.ChiPhiPhatSinh"));
    assert.equal(insert.inputs.HanDong, "2026-03-08");
    const tooHigh = await invoke(harness, "post", "/api/ChiPhiPhatSinh", {
        body: { ...baseBody, hanDong: "2026-03-08", soTien: 50000001 }
    });
    assert.equal(tooHigh.statusCode, 400);
    const individualMerge = await invoke(harness, "post", "/api/ChiPhiPhatSinh", {
        body: { ...baseBody, maChiTiet: 1, hanDong: "2026-03-08" }
    });
    assert.equal(individualMerge.statusCode, 400);
});

test("contract endpoints validate and create contracts through sp_TaoHopDong", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT p.MaHangPhong")
            ? { recordset: [{ MaHangPhong: "HP4" }] }
            : call.statement.includes("AS NgayVao")
                ? { recordset: [{
                    MaHopDong: "HD00001", TenPhong: "A101",
                    NgayBatDau: "2026-10-01", NgayKetThuc: "2027-10-01",
                    MaChiTiet: 45, MaSinhVien: "SV001", KyHanThanhToanPhong: "THANG",
                    GiaPhongApDung: 1200000, GiaPhongThangApDung: 1200000, NgayVao: "2026-10-01"
                }] }
                : call.statement.includes("SELECT @@ROWCOUNT AS RowsAffected")
                    ? { recordset: [{ RowsAffected: 1 }] }
                : { recordset: [], rowsAffected: [1] },
        executeResult: call => call.procedure === "dbo.sp_TaoHopDong"
            ? { recordset: [{ MaHopDong: "HD00001" }] }
            : { recordset: [{ MaHoaDon: "INV00001", TongTien: 1200000 }], output: { MaHoaDon: "INV00001" } }
    });
    const badTier = await invoke(harness, "post", "/api/HopDong", {
        body: {
            tenPhong: "A101", maHangPhong: "HP6", ngayBatDau: "2026-10-01",
            ngayKetThuc: "2027-10-01",
            sinhVien: [{ maSinhVien: "SV001", kyHanThanhToanPhong: "THANG" }]
        }
    });
    assert.equal(badTier.statusCode, 400);
    assert.match(badTier.body.message, /hạng phòng/);

    const created = await invoke(harness, "post", "/api/HopDong", {
        body: {
            tenPhong: "A101", maHangPhong: "HP4", ngayBatDau: "2026-10-01",
            ngayKetThuc: "2027-10-01",
            sinhVien: [{ maSinhVien: "SV001", kyHanThanhToanPhong: "THANG", laNguoiDaiDien: true }]
        }
    });
    assert.equal(created.statusCode, 201, JSON.stringify(created.body));
    assert.equal(created.body.MaHopDong, "HD00001");
    const createContract = harness.executions.find(call => call.procedure === "dbo.sp_TaoHopDong");
    assert.ok(createContract);
    assert.deepEqual(JSON.parse(createContract.inputs.SinhVienJson), [{
        maSinhVien: "SV001", kyHanThanhToanPhong: "THANG", laNguoiDaiDien: true
    }]);
    const createRentInvoice = harness.executions.find(call => call.procedure === "dbo.sp_TaoHoaDonTienPhong");
    assert.equal(createRentInvoice.inputs.MaChiTiet, 45);
    assert.equal(createRentInvoice.inputs.KyThanhToan, "2026-10-01");
    assert.equal(createRentInvoice.inputs.NgayTao,
        new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const notices = harness.queries.filter(call => call.statement.includes("INSERT INTO dbo.ThongBao"));
    assert.deepEqual(notices.map(call => call.inputs.MaSuKien), [
        "CONTRACT:HD00001:SV001", "INVOICE:INV00001"
    ]);
    assert.equal(harness.transactions.at(-1).state, "committed");

    const invalid = await invoke(harness, "post", "/api/HopDong", {
        body: { tenPhong: "A101", sinhVien: [] }
    });
    assert.equal(invalid.statusCode, 400);
});

test("contract creation warns and skips first invoice when the saved room price is missing", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT p.MaHangPhong")
            ? { recordset: [{ MaHangPhong: "HP4" }] }
            : call.statement.includes("AS NgayVao")
                ? { recordset: [{
                    MaHopDong: "HD-MISSING-PRICE", TenPhong: "A101",
                    NgayBatDau: "2026-10-01", NgayKetThuc: "2027-10-01",
                    MaChiTiet: 45, MaSinhVien: "SV001", KyHanThanhToanPhong: "THANG",
                    GiaPhongApDung: null, GiaPhongThangApDung: null, NgayVao: "2026-10-01"
                }] }
                : { recordset: [], rowsAffected: [1] },
        executeResult: () => ({ recordset: [{ MaHopDong: "HD-MISSING-PRICE" }] })
    });
    const result = await invoke(harness, "post", "/api/HopDong", {
        body: {
            tenPhong: "A101", maHangPhong: "HP4", ngayBatDau: "2026-10-01",
            ngayKetThuc: "2027-10-01",
            sinhVien: [{ maSinhVien: "SV001", kyHanThanhToanPhong: "THANG" }]
        }
    });
    assert.equal(result.statusCode, 201);
    assert.deepEqual(result.body.HoaDonTienPhong, []);
    assert.match(result.body.CanhBao[0], /chưa có đơn giá hợp lệ/);
    assert.equal(harness.executions.some(call => call.procedure === "dbo.sp_TaoHoaDonTienPhong"), false);
    assert(harness.queries.some(call => call.inputs.MaSuKien === "CONTRACT:HD-MISSING-PRICE:SV001"));
    assert.equal(harness.transactions.at(-1).state, "committed");
});

test("real SQL Server creates one contract notice and first rent invoice per member atomically", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình kết nối SQL Server; không thể chạy kiểm thử hợp đồng thật.");
    }

    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    try {
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 2,
            unassignedCount: 1,
            createOtherRoomStudent: true
        });
        const [monthlyStudent, yearlyStudent, midTermStudent, unrelatedStudent] = fixture.studentIds;
        const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const startDateValue = new Date(`${today}T00:00:00.000Z`);
        startDateValue.setUTCDate(startDateValue.getUTCDate() - 10);
        const startDate = startDateValue.toISOString().slice(0, 10);
        const endDateValue = new Date(`${startDate}T00:00:00.000Z`);
        endDateValue.setUTCFullYear(endDateValue.getUTCFullYear() + 1);
        const endDate = endDateValue.toISOString().slice(0, 10);
        const expectedDueDateValue = new Date(`${today}T00:00:00.000Z`);
        expectedDueDateValue.setUTCDate(expectedDueDateValue.getUTCDate() + 7);
        const expectedDueDate = expectedDueDateValue.toISOString().slice(0, 10);

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            if (req.get("x-test-role") === "manager") {
                req.auth = { accountId: fixture.managerId, role: "Quản lý" };
            } else if (req.get("x-test-role") === "student") {
                req.auth = { role: "Sinh viên", studentId: req.get("x-test-student") };
            }
            next();
        });
        registerApiRoutes(app, {
            getPool: () => pool,
            sql,
            bcrypt: require("bcryptjs"),
            mapPaymentStatusToDatabase: value => ({
                PENDING: "PENDING",
                WAITING_CASH: "Chờ xác nhận",
                SUCCESS: "SUCCESS",
                REJECTED: "REJECTED",
                EXPIRED: "EXPIRED",
                "Cần đối soát": "RECONCILIATION",
                "Hợp lệ": "Hợp lệ",
                "Chờ xác nhận": "Chờ xác nhận",
                "Đã hủy": "Đã hủy"
            })[value] || null,
            mapPaymentMethodToDatabase: value => ({
                CASH: "CASH", ONLINE: "ONLINE", CHUYEN_DOI: "CHUYEN_DOI"
            })[value] || null,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });

        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const call = async (method, route, role, studentId, body) => {
            const headers = {};
            if (body !== undefined) headers["Content-Type"] = "application/json";
            if (role) headers["x-test-role"] = role;
            if (studentId) headers["x-test-student"] = studentId;
            const response = await fetch(`${baseUrl}${route}`, {
                method,
                headers,
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };
        const contractBody = {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: startDate,
            ngayKetThuc: endDate,
            sinhVien: [
                { maSinhVien: monthlyStudent, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: true },
                { maSinhVien: yearlyStudent, kyHanThanhToanPhong: "NAM" }
            ]
        };
        const created = await call("POST", "/api/HopDong", "manager", null, contractBody);
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const contractId = created.body.MaHopDong;
        assert.equal(created.body.HoaDonTienPhong.length, 2);

        const firstInvoices = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaHoaDon, MaSinhVien, MaChiTiet, LoaiHoaDon,
                       CONVERT(nvarchar(10), NgayLap, 23) AS NgayLap,
                       CONVERT(nvarchar(10), KyThanhToan, 23) AS KyThanhToan,
                       CONVERT(nvarchar(10), KyThanhToanDen, 23) AS KyThanhToanDen,
                       CONVERT(nvarchar(10), HanThanhToan, 23) AS HanThanhToan,
                       (SELECT SUM(ct.SoTien) FROM dbo.ChiTietHoaDon ct
                        WHERE ct.MaHoaDon = hd.MaHoaDon) AS TongTien
                FROM dbo.HoaDon hd
                WHERE MaHopDong = @MaHopDong AND LoaiHoaDon = N'TIEN_PHONG'
            `);
        assert.equal(firstInvoices.recordset.length, 2);
        const monthlyInvoice = firstInvoices.recordset.find(row => row.MaSinhVien === monthlyStudent);
        const yearlyInvoice = firstInvoices.recordset.find(row => row.MaSinhVien === yearlyStudent);
        assert.ok(monthlyInvoice && yearlyInvoice);
        assert.equal(monthlyInvoice.LoaiHoaDon, "TIEN_PHONG");
        assert.equal(yearlyInvoice.LoaiHoaDon, "TIEN_PHONG");
        assert.ok(firstInvoices.recordset.every(row => row.NgayLap === today));
        assert.equal(Number(monthlyInvoice.TongTien), 1200000);
        assert.equal(Number(yearlyInvoice.TongTien), 14400000);
        assert.equal(monthlyInvoice.KyThanhToan, `${startDate.slice(0, 7)}-01`);
        assert.equal(monthlyInvoice.KyThanhToanDen,
            new Date(Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)), 0))
                .toISOString().slice(0, 10));
        assert.equal(yearlyInvoice.KyThanhToanDen,
            new Date(Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)) + 11, 0))
                .toISOString().slice(0, 10));
        assert.ok(firstInvoices.recordset.every(row => row.HanThanhToan === expectedDueDate));
        for (const invoice of firstInvoices.recordset) {
            const invoiceNotice = await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoice.MaHoaDon)
                .input("MaSinhVien", sql.NVarChar(30), invoice.MaSinhVien)
                .query(`
                    SELECT MaHoaDon, NoiDung, COUNT_BIG(*) OVER () AS NoticeCount
                    FROM dbo.ThongBao
                    WHERE MaHoaDon = @MaHoaDon AND MaSinhVien = @MaSinhVien
                      AND MaSuKien = CONCAT(N'INVOICE:', @MaHoaDon)
                `);
            assert.equal(invoiceNotice.recordset.length, 1);
            assert.equal(Number(invoiceNotice.recordset[0].NoticeCount), 1);
            assert.match(invoiceNotice.recordset[0].NoiDung, new RegExp(invoice.MaHoaDon));
            assert.ok(invoiceNotice.recordset[0].NoiDung.includes(expectedDueDate.split("-").reverse().join("/")));
            assert.match(invoiceNotice.recordset[0].NoiDung,
                new RegExp(new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 })
                    .format(Number(invoice.TongTien)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }

        const contractNotices = await pool.request()
            .input("MonthlyEvent", sql.NVarChar(100), `CONTRACT:${contractId}:${monthlyStudent}`)
            .input("YearlyEvent", sql.NVarChar(100), `CONTRACT:${contractId}:${yearlyStudent}`)
            .query(`
                SELECT MaSuKien, MaSinhVien, COUNT_BIG(*) AS NoticeCount
                FROM dbo.ThongBao
                WHERE MaSuKien IN (@MonthlyEvent, @YearlyEvent)
                GROUP BY MaSuKien, MaSinhVien
            `);
        assert.deepEqual(contractNotices.recordset.map(row =>
            [row.MaSinhVien, Number(row.NoticeCount)]).sort((a, b) => a[0].localeCompare(b[0])), [
            [monthlyStudent, 1], [yearlyStudent, 1]
        ].sort((a, b) => a[0].localeCompare(b[0])));

        const monthlyNotices = await call("GET", "/api/student/notifications", "student", monthlyStudent);
        assert.equal(monthlyNotices.status, 200);
        assert.equal(monthlyNotices.body.filter(notice =>
            notice.TieuDe.includes(`Hợp đồng lưu trú ${contractId}`)).length, 1);
        assert.ok(monthlyNotices.body.some(notice => notice.TieuDe.includes(monthlyInvoice.MaHoaDon)));
        assert.equal(monthlyNotices.body.some(notice => notice.TieuDe.includes(yearlyInvoice.MaHoaDon)), false);
        const unrelatedNotices = await call("GET", "/api/student/notifications", "student", unrelatedStudent);
        assert.equal(unrelatedNotices.status, 200);
        assert.equal(unrelatedNotices.body.some(notice =>
            notice.TieuDe.includes(`Hợp đồng lưu trú ${contractId}`)
            || notice.TieuDe.includes(monthlyInvoice.MaHoaDon)
            || notice.TieuDe.includes(yearlyInvoice.MaHoaDon)), false);

        const repeatedCreate = await call("POST", "/api/HopDong", "manager", null, contractBody);
        assert.notEqual(repeatedCreate.status, 201);
        const afterRepeatedCreate = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT
                    (SELECT COUNT_BIG(*) FROM dbo.HoaDon
                     WHERE MaHopDong = @MaHopDong AND LoaiHoaDon = N'TIEN_PHONG') AS InvoiceCount,
                    (SELECT COUNT_BIG(*) FROM dbo.ThongBao
                     WHERE MaSuKien LIKE CONCAT(N'CONTRACT:', @MaHopDong, N':%')) AS ContractNoticeCount,
                    (SELECT COUNT_BIG(*) FROM dbo.ThongBao tb
                     INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = tb.MaHoaDon
                     WHERE hd.MaHopDong = @MaHopDong AND tb.MaSuKien LIKE N'INVOICE:%') AS InvoiceNoticeCount
            `);
        assert.equal(Number(afterRepeatedCreate.recordset[0].InvoiceCount), 2);
        assert.equal(Number(afterRepeatedCreate.recordset[0].ContractNoticeCount), 2);
        assert.equal(Number(afterRepeatedCreate.recordset[0].InvoiceNoticeCount), 2);

        const beforeFailedContract = Number((await pool.request()
            .input("StudentA", sql.NVarChar(30), monthlyStudent)
            .input("StudentB", sql.NVarChar(30), yearlyStudent)
            .query(`
                SELECT COUNT_BIG(*) AS NoticeCount FROM dbo.ThongBao
                WHERE MaSinhVien IN (@StudentA, @StudentB) AND MaSuKien LIKE N'CONTRACT:%'
            `)).recordset[0].NoticeCount);
        const failedContract = await call("POST", "/api/HopDong", "manager", null, {
            ...contractBody,
            tenPhong: fixture.roomB,
            sinhVien: [{ maSinhVien: `MISSING${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
                kyHanThanhToanPhong: "THANG" }]
        });
        assert.notEqual(failedContract.status, 201);
        const failedContractState = await pool.request()
            .input("TenPhong", sql.NVarChar(50), fixture.roomB)
            .input("StudentA", sql.NVarChar(30), monthlyStudent)
            .input("StudentB", sql.NVarChar(30), yearlyStudent)
            .query(`
                SELECT
                    (SELECT COUNT_BIG(*) FROM dbo.HopDong
                     WHERE TenPhong = @TenPhong AND TrangThaiHopDong = N'Còn hiệu lực') AS ContractCount,
                    (SELECT COUNT_BIG(*) FROM dbo.ThongBao
                     WHERE MaSinhVien IN (@StudentA, @StudentB) AND MaSuKien LIKE N'CONTRACT:%') AS NoticeCount
            `);
        assert.equal(Number(failedContractState.recordset[0].ContractCount), 0);
        assert.equal(Number(failedContractState.recordset[0].NoticeCount), beforeFailedContract);

        const futureStartValue = new Date(`${today}T00:00:00.000Z`);
        futureStartValue.setUTCDate(futureStartValue.getUTCDate() + 3);
        const futureStart = futureStartValue.toISOString().slice(0, 10);
        const futureEndValue = new Date(`${futureStart}T00:00:00.000Z`);
        futureEndValue.setUTCFullYear(futureEndValue.getUTCFullYear() + 1);
        const futureEnd = futureEndValue.toISOString().slice(0, 10);
        const futureContract = await call("POST", "/api/HopDong", "manager", null, {
            ...contractBody,
            tenPhong: fixture.roomB,
            ngayBatDau: futureStart,
            ngayKetThuc: futureEnd,
            sinhVien: [{ maSinhVien: unrelatedStudent, kyHanThanhToanPhong: "THANG" }]
        });
        assert.equal(futureContract.status, 201, JSON.stringify(futureContract.body));
        const futureInvoice = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), futureContract.body.MaHopDong)
            .query(`
                SELECT TOP (1) MaHoaDon, LoaiHoaDon,
                       CONVERT(nvarchar(10), NgayLap, 23) AS NgayLap,
                       CONVERT(nvarchar(10), HanThanhToan, 23) AS HanThanhToan
                FROM dbo.HoaDon
                WHERE MaHopDong = @MaHopDong
            `);
        assert.equal(futureInvoice.recordset.length, 1);
        assert.equal(futureInvoice.recordset[0].LoaiHoaDon, "TIEN_PHONG");
        assert.equal(futureInvoice.recordset[0].NgayLap, today);
        assert.equal(futureInvoice.recordset[0].HanThanhToan, futureStart);

        const addedMember = await call("POST", `/api/HopDong/${contractId}/chitiet`,
            "manager", null, {
                maSinhVien: midTermStudent,
                kyHanThanhToanPhong: "THANG",
                laNguoiDaiDien: false
            });
        assert.equal(addedMember.status, 201, JSON.stringify(addedMember.body));
        assert.equal(addedMember.body.HoaDonTienPhong.length, 1);
        const repeatedAdd = await call("POST", `/api/HopDong/${contractId}/chitiet`,
            "manager", null, {
                maSinhVien: midTermStudent,
                kyHanThanhToanPhong: "THANG",
                laNguoiDaiDien: false
            });
        assert.notEqual(repeatedAdd.status, 201);

        const finalState = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .input("MidTermEvent", sql.NVarChar(100), `CONTRACT:${contractId}:${midTermStudent}`)
            .input("MidTermStudent", sql.NVarChar(30), midTermStudent)
            .query(`
                SELECT
                    (SELECT COUNT_BIG(*) FROM dbo.HoaDon
                     WHERE MaHopDong = @MaHopDong AND LoaiHoaDon = N'TIEN_PHONG') AS InvoiceCount,
                    (SELECT COUNT_BIG(*) FROM dbo.ThongBao
                     WHERE MaSuKien LIKE CONCAT(N'CONTRACT:', @MaHopDong, N':%')) AS ContractNoticeCount,
                    (SELECT COUNT_BIG(*) FROM dbo.ThongBao tb
                     INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = tb.MaHoaDon
                     WHERE hd.MaHopDong = @MaHopDong AND tb.MaSuKien LIKE N'INVOICE:%') AS InvoiceNoticeCount,
                    (SELECT COUNT_BIG(*) FROM dbo.ThongBao
                     WHERE MaSuKien = @MidTermEvent AND MaSinhVien = @MidTermStudent) AS NewMemberNoticeCount
            `);
        assert.equal(Number(finalState.recordset[0].InvoiceCount), 3);
        assert.equal(Number(finalState.recordset[0].ContractNoticeCount), 3);
        assert.equal(Number(finalState.recordset[0].InvoiceNoticeCount), 3);
        assert.equal(Number(finalState.recordset[0].NewMemberNoticeCount), 1);

        const allInvoices = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaSinhVien, LoaiHoaDon
                FROM dbo.HoaDon
                WHERE MaHopDong = @MaHopDong
            `);
        assert.equal(allInvoices.recordset.length, 3);
        assert.ok(allInvoices.recordset.every(row => row.LoaiHoaDon === "TIEN_PHONG"));
        assert.deepEqual(allInvoices.recordset.map(row => row.MaSinhVien).sort(),
            [monthlyStudent, yearlyStudent, midTermStudent].sort());

        for (const studentId of [monthlyStudent, yearlyStudent, midTermStudent]) {
            const notices = await call("GET", "/api/student/notifications", "student", studentId);
            assert.equal(notices.status, 200);
            assert.equal(notices.body.filter(notice =>
                notice.TieuDe.includes(`Hợp đồng lưu trú ${contractId}`)).length, 1);
        }
        t.diagnostic("Contract and initial rent notices committed per student; repeat/failure paths added no duplicate rows; monthly, annual, and mid-term rent invoices were TIEN_PHONG.");
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (fixture) await cleanupSqlIntegrationFixture(pool, sql, fixture);
        await pool.close();
    }
});

test("real SQL early checkout uses day-based refunds, concurrency guards, and per-student membership", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình SQL Server cho kiểm thử trả phòng sớm.");
    }
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    let contractId;
    let cancelledReportCashOutId;
    let studentIds = [];
    try {
        assert.equal((await pool.request().query("SELECT DB_NAME() AS DatabaseName"))
            .recordset[0].DatabaseName, "KTX_Group3_test");
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 4,
            createOtherRoomStudent: false
        });
        studentIds = fixture.studentIds;
        const [paidStudent, unpaidStudent, partialStudent, rejectedStudent] = studentIds;
        const accounts = new Map();
        for (const studentId of studentIds) {
            const result = await pool.request()
                .input("Email", sql.VarChar(100), `${studentId.toLowerCase()}@gmail.com`)
                .input("TenHienThi", sql.NVarChar(100), `Checkout ${studentId}`)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    INSERT INTO dbo.TaiKhoan (Email, MatKhau, TenHienThi, VaiTro, MaSinhVien)
                    OUTPUT inserted.MaTaiKhoan
                    VALUES (@Email, 'test-only-not-authenticated', @TenHienThi, N'Sinh viên', @MaSinhVien)
                `);
            accounts.set(studentId, result.recordset[0].MaTaiKhoan);
        }
        const shift = (iso, amount) => {
            const date = new Date(`${iso}T00:00:00.000Z`);
            date.setUTCDate(date.getUTCDate() + amount);
            return date.toISOString().slice(0, 10);
        };
        const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const startDate = shift(todayVN, -13);
        const endDate = shift(startDate, 29);
        const authSecret = `checkout-${crypto.randomBytes(24).toString("hex")}`;
        const app = express();
        app.use(express.json());
        app.use("/api", createApiAuthenticationMiddleware({ jwt, getSecret: () => authSecret }));
        registerApiRoutes(app, {
            getPool: () => pool, sql, bcrypt: require("bcryptjs"),
            mapPaymentStatusToDatabase: value => value,
            mapPaymentMethodToDatabase: value => value,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const call = async (method, route, role, studentId, body) => {
            const headers = {};
            if (body !== undefined) headers["Content-Type"] = "application/json";
            if (role) {
                const payload = role === "manager"
                    ? { sub: String(fixture.managerId), role: "Quản lý" }
                    : role === "admin"
                        ? { sub: String(fixture.managerId), role: "Admin" }
                        : { sub: String(accounts.get(studentId)), role: "Sinh viên", studentId };
                headers.Authorization = `Bearer ${jwt.sign(payload, authSecret)}`;
            }
            const response = await fetch(`${baseUrl}${route}`, {
                method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };
        const contract = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: startDate,
            ngayKetThuc: endDate,
            sinhVien: studentIds.map((maSinhVien, index) => ({
                maSinhVien, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: index === 0
            }))
        });
        assert.equal(contract.status, 201, JSON.stringify(contract.body));
        contractId = contract.body.MaHopDong;
        const invoiceIds = new Map(contract.body.HoaDonTienPhong.map(item => [item.MaSinhVien, item.MaHoaDon]));
        assert.equal(invoiceIds.size, 4);
        await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), invoiceIds.get(paidStudent))
            .input("SoTien", sql.Decimal(18, 2), 1200000)
            .input("PhuongThuc", sql.NVarChar(20), "CASH")
            .input("MaSinhVienNop", sql.NVarChar(30), paidStudent)
            .input("NguoiThu", sql.Int, fixture.managerId)
            .execute("dbo.sp_GhiPhieuThu");
        await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), invoiceIds.get(partialStudent))
            .input("SoTien", sql.Decimal(18, 2), 700000)
            .input("PhuongThuc", sql.NVarChar(20), "CASH")
            .input("MaSinhVienNop", sql.NVarChar(30), partialStudent)
            .input("NguoiThu", sql.Int, fixture.managerId)
            .execute("dbo.sp_GhiPhieuThu");

        const submit = studentId => call("POST", "/api/student/requests", "student", studentId, {
            Loai: "Trả phòng sớm",
            NoiDung: "Xin trả phòng sớm do chuyển nơi ở.",
            NgayKetThucDeXuat: todayVN
        });
        const invalidDate = await call("POST", "/api/student/requests", "student", paidStudent, {
            Loai: "Trả phòng sớm",
            NoiDung: "Xin trả phòng sớm do chuyển nơi ở.",
            NgayKetThucDeXuat: endDate
        });
        assert.equal(invalidDate.status, 400);
        const reqA = await submit(paidStudent);
        const reqB = await submit(unpaidStudent);
        const reqC = await submit(partialStudent);
        const reqD = await submit(rejectedStudent);
        for (const result of [reqA, reqB, reqC, reqD]) assert.equal(result.status, 201, JSON.stringify(result.body));
        assert.equal((await submit(unpaidStudent)).status, 409);
        const ownRequests = await call("GET", "/api/student/requests", "student", unpaidStudent);
        assert.equal(ownRequests.status, 200);
        assert.deepEqual(ownRequests.body.map(row => row.MaYeuCau), [reqB.body.MaYeuCau]);
        assert.equal(ownRequests.body[0].NgayBatDauHopDong, startDate);
        assert.equal(ownRequests.body[0].NgayKetThucHopDong, endDate);
        assert.equal(ownRequests.body[0].NgayKetThucDeXuat, todayVN);
        const managerRequests = await call("GET", "/api/requests", "manager", null);
        const managerRequest = managerRequests.body.find(row => row.MaYeuCau === reqB.body.MaYeuCau);
        assert.equal(managerRequest.NgayBatDauHopDong, startDate);
        assert.equal(managerRequest.NgayKetThucHopDong, endDate);
        assert.equal(managerRequest.NgayKetThucDeXuat, todayVN);

        assert.equal((await call("GET", `/api/requests/${reqA.body.MaYeuCau}/early-checkout`, null, null)).status, 401);
        assert.equal((await call("GET", `/api/requests/${reqA.body.MaYeuCau}/early-checkout`, "student", paidStudent)).status, 403);
        assert.equal((await call("PUT", `/api/requests/${reqD.body.MaYeuCau}`, "admin", null, {
            TrangThai: "Đã duyệt"
        })).status, 403);
        assert.equal((await call("PUT", `/api/requests/${reqD.body.MaYeuCau}`, "student", rejectedStudent, {
            TrangThai: "Đã duyệt"
        })).status, 403);

        const preview = await call("GET", `/api/requests/${reqA.body.MaYeuCau}/early-checkout`, "manager", null);
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.equal(Number(preview.body.SoNgayHopDong), 30);
        assert.equal(Number(preview.body.SoNgayDaO), 14);
        assert.equal(Number(preview.body.TienDaO), 560000);
        assert.equal(Number(preview.body.SoTienHoan), 640000);
        const reportYearBeforeRefund = Number((await pool.request()
            .query("SELECT YEAR(GETDATE()) AS ReportYear")).recordset[0].ReportYear);
        const reportBeforeRefund = await call("GET", `/api/doanhthu/${reportYearBeforeRefund}`, "manager", null);
        assert.equal(reportBeforeRefund.status, 200, JSON.stringify(reportBeforeRefund.body));
        const concurrent = await Promise.all([
            call("PUT", `/api/requests/${reqA.body.MaYeuCau}`, "manager", null, { TrangThai: "Đã duyệt" }),
            call("PUT", `/api/requests/${reqA.body.MaYeuCau}`, "manager", null, { TrangThai: "Đã duyệt" })
        ]);
        assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409]);
        assert.equal(Number(concurrent.find(result => result.status === 200).body.SoTienHoan), 640000);
        await t.test("real SQL early-checkout cash refund updates its NgayChi month in revenue reports", async () => {
            const cashOut = await pool.request()
                .input("MaHopDong", sql.NVarChar(20), contractId)
                .input("MaSinhVien", sql.NVarChar(30), paidStudent)
                .query(`
                    SELECT pc.MaPhieuChi, pc.NgayChi, YEAR(pc.NgayChi) AS ReportYear,
                           MONTH(pc.NgayChi) AS ReportMonth, pc.SoTien, pc.TrangThai, hd.MaHoaDon
                    FROM dbo.PhieuChi pc
                    INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                    INNER JOIN dbo.PhieuChi_HoaDon ph ON ph.MaPhieuChi = pc.MaPhieuChi
                    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = ph.MaHoaDon
                    WHERE c.MaHopDong = @MaHopDong AND c.MaSinhVien = @MaSinhVien
                      AND pc.LyDo = N'Trả phòng sớm' AND pc.TrangThai = N'Hợp lệ'
                `);
            assert.equal(cashOut.recordset.length, 1);
            const refund = cashOut.recordset[0];
            assert.equal(Number(refund.SoTien), 640000);
            assert.equal(Number(refund.ReportYear), reportYearBeforeRefund);
            const reportAfterRefund = await call("GET", `/api/doanhthu/${refund.ReportYear}`, "manager", null);
            assert.equal(reportAfterRefund.status, 200, JSON.stringify(reportAfterRefund.body));
            const monthNumber = Number(refund.ReportMonth);
            const before = reportBeforeRefund.body.thang.find(row =>
                Number(row.Nam) === Number(refund.ReportYear)
                && Number(row.Thang) === monthNumber);
            const after = reportAfterRefund.body.thang.find(row => Number(row.Thang) === monthNumber);
            assert.ok(before);
            assert.ok(after);
            assert.equal(Number(after.ChiTienPhong) - Number(before.ChiTienPhong), 640000);
            assert.equal(Number(after.DoanhThuTienPhong) - Number(before.DoanhThuTienPhong), -640000);
            assert.equal(Number(after.TongChi) - Number(before.TongChi), 640000);
            assert.equal(Number(after.TongDoanhThu) - Number(before.TongDoanhThu), -640000);
            assert.equal(Number(after.ChiPhatSinh) - Number(before.ChiPhatSinh), 0);

            const member = await pool.request()
                .input("MaSinhVien", sql.NVarChar(30), paidStudent)
                .query(`
                    SELECT TOP (1) c.MaChiTiet, hd.MaHoaDon
                    FROM dbo.ChiTietHopDong c
                    INNER JOIN dbo.HoaDon hd ON hd.MaChiTiet = c.MaChiTiet
                    WHERE c.MaSinhVien = @MaSinhVien AND hd.LoaiHoaDon = N'TIEN_PHONG'
                    ORDER BY hd.NgayLap
                `);
            const cancelled = await pool.request()
                .input("MaChiTiet", sql.Int, member.recordset[0].MaChiTiet)
                .input("NgayRa", sql.Date, todayVN)
                .input("NguoiLap", sql.Int, fixture.managerId)
                .query(`
                    INSERT INTO dbo.PhieuChi
                        (MaChiTiet, SoTienDaDong, SoTienDaSuDung, KhauTru, SoTien, NgayRa, LyDo, TrangThai, NguoiLap)
                    VALUES (@MaChiTiet, 1200000, 560000, 0, 1, @NgayRa, N'Khác', N'Đã hủy', @NguoiLap);
                    SELECT CAST(SCOPE_IDENTITY() AS bigint) AS MaPhieuChi;
                `);
            cancelledReportCashOutId = cancelled.recordset[0].MaPhieuChi;
            await pool.request()
                .input("MaPhieuChi", sql.BigInt, cancelledReportCashOutId)
                .input("MaHoaDon", sql.NVarChar(20), member.recordset[0].MaHoaDon)
                .query("INSERT INTO dbo.PhieuChi_HoaDon (MaPhieuChi, MaHoaDon, SoTien) VALUES (@MaPhieuChi, @MaHoaDon, 1)");
            const reportWithCancelledCashOut = await call("GET", `/api/doanhthu/${refund.ReportYear}`, "manager", null);
            assert.equal(reportWithCancelledCashOut.status, 200);
            const afterCancelled = reportWithCancelledCashOut.body.thang.find(row => Number(row.Thang) === monthNumber);
            assert.equal(Number(afterCancelled.ChiTienPhong), Number(after.ChiTienPhong));
            assert.equal(Number(afterCancelled.TongChi), Number(after.TongChi));
        });

        const unpaidDecision = await call("PUT", `/api/requests/${reqB.body.MaYeuCau}`, "manager", null, {
            TrangThai: "Đã duyệt"
        });
        assert.equal(unpaidDecision.status, 200, JSON.stringify(unpaidDecision.body));
        assert.equal(Number(unpaidDecision.body.SoTienHoan), 0);
        const partialDecision = await call("PUT", `/api/requests/${reqC.body.MaYeuCau}`, "manager", null, {
            TrangThai: "Đã duyệt"
        });
        assert.equal(partialDecision.status, 200, JSON.stringify(partialDecision.body));
        assert.equal(Number(partialDecision.body.SoTienHoan), 140000);
        assert.ok(Number(partialDecision.body.SoTienHoan) <= 700000);
        const rejected = await call("PUT", `/api/requests/${reqD.body.MaYeuCau}`, "manager", null, {
            TrangThai: "Từ chối", PhanHoi: "Vui lòng cung cấp thêm thông tin."
        });
        assert.equal(rejected.status, 200, JSON.stringify(rejected.body));

        const state = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT c.MaSinhVien, c.TrangThai, c.NgayRa,
                       (SELECT COUNT_BIG(*) FROM dbo.ChiTietHopDong active
                        WHERE active.MaHopDong = c.MaHopDong AND active.TrangThai = N'Đang ở') AS SoNguoiConO
                FROM dbo.ChiTietHopDong c
                WHERE c.MaHopDong = @MaHopDong
            `);
        const memberA = state.recordset.find(row => row.MaSinhVien === paidStudent);
        const memberB = state.recordset.find(row => row.MaSinhVien === unpaidStudent);
        const memberC = state.recordset.find(row => row.MaSinhVien === partialStudent);
        const memberD = state.recordset.find(row => row.MaSinhVien === rejectedStudent);
        assert.equal(memberA.TrangThai, "Đã rời");
        assert.equal(memberA.NgayRa.toISOString().slice(0, 10), todayVN);
        assert.equal(memberB.TrangThai, "Đã rời");
        assert.equal(memberC.TrangThai, "Đã rời");
        assert.equal(memberD.TrangThai, "Đang ở");
        assert.equal(memberD.NgayRa, null);
        assert.equal(Number(memberA.SoNguoiConO), 1);
        const roomState = await pool.request()
            .input("TenPhong", sql.NVarChar(50), fixture.roomA)
            .query("SELECT SoSinhVienHienTai, TrangThaiPhong FROM dbo.Phong WHERE TenPhong = @TenPhong");
        assert.equal(Number(roomState.recordset[0].SoSinhVienHienTai), 1);
        assert.equal(roomState.recordset[0].TrangThaiPhong, "Trống");

        const receipts = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .input("MaSinhVien", sql.NVarChar(30), paidStudent)
            .query(`
                SELECT COUNT_BIG(*) AS SoPhieuChi, SUM(pc.SoTien) AS TongHoan
                FROM dbo.PhieuChi pc
                INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                WHERE c.MaHopDong = @MaHopDong AND c.MaSinhVien = @MaSinhVien
                  AND pc.LyDo = N'Trả phòng sớm'
            `);
        assert.equal(Number(receipts.recordset[0].SoPhieuChi), 1);
        assert.equal(Number(receipts.recordset[0].TongHoan), 640000);
        const noRefund = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .input("MaSinhVien", sql.NVarChar(30), unpaidStudent)
            .query(`
                SELECT COUNT_BIG(*) AS SoPhieuChi FROM dbo.PhieuChi pc
                INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                WHERE c.MaHopDong = @MaHopDong AND c.MaSinhVien = @MaSinhVien
                  AND pc.LyDo = N'Trả phòng sớm'
            `);
        assert.equal(Number(noRefund.recordset[0].SoPhieuChi), 0);
        const partialRefund = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .input("MaSinhVien", sql.NVarChar(30), partialStudent)
            .query(`
                SELECT COUNT_BIG(*) AS SoPhieuChi, SUM(pc.SoTien) AS TongHoan
                FROM dbo.PhieuChi pc
                INNER JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                WHERE c.MaHopDong = @MaHopDong AND c.MaSinhVien = @MaSinhVien
                  AND pc.LyDo = N'Trả phòng sớm'
            `);
        assert.equal(Number(partialRefund.recordset[0].SoPhieuChi), 1);
        assert.equal(Number(partialRefund.recordset[0].TongHoan), 140000);
        assert.ok(Number(partialRefund.recordset[0].TongHoan) <= 700000);
        const notice = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `CHECKOUT:${reqA.body.MaYeuCau}:${paidStudent}`)
            .query("SELECT COUNT_BIG(*) AS SoThongBao FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.equal(Number(notice.recordset[0].SoThongBao), 1);
        t.diagnostic("Early checkout: 30d/14d = 560000 used/640000 refund; unpaid refund=0; concurrent approval creates one refund; only the approved member exits.");
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool.connected && fixture) await cleanupSqlIntegrationFixture(pool, sql, fixture);
        await pool.close();
    }
});

test("real SQL early checkout without renewals refunds 640000", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async () => {
    const result = await runSqlEarlyCheckoutRefundScenario({ sql, withRenewal: false });
    const baseUsed = Math.round(result.baseRent * result.baseLivedDays / result.baseDays);
    const expectedRefund = Math.max(result.baseRent - baseUsed, 0);
    assert.equal(result.decision.status, 200, JSON.stringify(result.decision.body));
    assert.equal(baseUsed, 560000);
    assert.equal(expectedRefund, 640000);
    assert.equal(result.preview.status, 200, JSON.stringify(result.preview.body));
    assert.equal(Number(result.preview.body?.SoTienHoan), expectedRefund,
        JSON.stringify({ preview: result.preview.body, baseInvoicePeriod: result.baseInvoicePeriod,
            baseDays: result.baseDays, baseLivedDays: result.baseLivedDays }));
    assert.equal(result.refund, expectedRefund);
    assert.equal(result.cashOut, expectedRefund);
});

test("real SQL early checkout refunds each paid renewal period separately", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async () => {
    const result = await runSqlEarlyCheckoutRefundScenario({ sql, withRenewal: true });
    const baseUsed = Math.round(result.baseRent * result.baseLivedDays / result.baseDays);
    const baseRefund = Math.max(result.baseRent - baseUsed, 0);
    const renewalUsed = Math.round(result.renewalRent
        * result.renewalLivedDays / result.renewalDays);
    const renewalRefund = Math.max(result.renewalRent - renewalUsed, 0);
    const expectedRefund = baseRefund + renewalRefund;
    assert.equal(result.decision.status, 200, JSON.stringify(result.decision.body));
    assert.equal(baseUsed, 1200000);
    assert.equal(baseRefund, 0);
    assert.equal(renewalUsed, 200000);
    assert.equal(renewalRefund, 200000);
    assert.equal(expectedRefund, 200000);
    assert.equal(result.preview.status, 200, JSON.stringify(result.preview.body));
    assert.equal(Number(result.preview.body?.SoTienHoan), expectedRefund,
        JSON.stringify({ preview: result.preview.body, baseInvoicePeriod: result.baseInvoicePeriod,
            baseDays: result.baseDays, baseLivedDays: result.baseLivedDays,
            renewalDays: result.renewalDays, renewalLivedDays: result.renewalLivedDays }));
    assert.equal(result.refund, expectedRefund);
    assert.equal(result.cashOut, expectedRefund);
});

test("real SQL fixture cashout cleanup rejects non-T5 cashout data", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false,
    timeout: 120000
}, async () => withSqlMemberRenewalFixture(1, async context => {
    const studentId = context.members[0];
    const transaction = new sql.Transaction(context.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let finished = false;
    try {
        const invoiceId = context.invoiceByStudent.get(studentId);
        const receipt = await new sql.Request(transaction)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .input("SoTien", sql.Decimal(18, 2), 1200000)
            .input("PhuongThuc", sql.NVarChar(20), "CASH")
            .input("MaSinhVienNop", sql.NVarChar(30), studentId)
            .input("NguoiThu", sql.Int, context.fixture.managerId)
            .execute("dbo.sp_GhiPhieuThu");
        const receiptId = receipt.recordset?.[0]?.MaPhieuThu;
        assert.ok(receiptId);
        const cashout = await new sql.Request(transaction)
            .input("MaChiTiet", sql.Int, context.detailByStudent.get(studentId))
            .input("NgayRa", sql.Date, context.todayVN)
            .input("LyDo", sql.NVarChar(30), "Trả phòng sớm")
            .input("KhauTru", sql.Decimal(18, 2), 0)
            .input("SoTien", sql.Decimal(18, 2), 1)
            .input("NguoiLap", sql.Int, context.fixture.managerId)
            .input("GhiChu", sql.NVarChar(255), "Fixture kiểm tra hàng rào non-T5")
            .execute("dbo.sp_TaoPhieuChi");
        const cashoutId = cashout.recordset?.[0]?.MaPhieuChi;
        assert.ok(cashoutId);

        await assert.rejects(
            context.pool.request()
                .input("MaHopDong", sql.NVarChar(20), context.contractId)
                .input("NguoiThucHien", sql.Int, context.fixture.managerId)
                .execute("dbo.sp_HuyPhieuChiFixtureKiemThu"),
            error => error.number === 53506
        );
        const unchanged = await new sql.Request(transaction)
            .input("MaPhieuChi", sql.BigInt, cashoutId)
            .query("SELECT TrangThai FROM dbo.PhieuChi WHERE MaPhieuChi = @MaPhieuChi");
        assert.equal(unchanged.recordset[0]?.TrangThai, "Hợp lệ");
        await transaction.rollback();
        finished = true;
    } finally {
        if (!finished) {
            try {
                await transaction.rollback();
            } catch (error) {
                if (error.code !== "EABORT") throw error;
            }
        }
    }
}, { roomPrefix: "LIVE-" }));

test("real SQL non-fixture paid surplus refund remains protected by its trigger after migration 040", {
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
    let transaction;
    try {
        const migration = await pool.request().query(`
            SELECT COUNT(*) AS Applied
            FROM dbo.SchemaMigration
            WHERE MaMigration IN (N'038', N'040')
        `);
        assert.equal(migration.recordset[0]?.Applied, 2,
            "Migrations 038 and 040 must be applied.");
        const fixture = await createNonFixtureContract(pool, sql);
        transaction = fixture.transaction;
        const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const invoicePeriod = `${todayVN.slice(0, 7)}-01`;
        const lastDay = new Date(Date.UTC(
            Number(todayVN.slice(0, 4)), Number(todayVN.slice(5, 7)), 0
        )).getUTCDate();
        const invoiceId = `NRV${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
        const invoiceItemId = `${invoiceId}-R`;
        await new sql.Request(transaction)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .input("MaSinhVien", sql.NVarChar(20), fixture.studentId)
            .input("TenPhong", sql.NVarChar(50), fixture.roomA)
            .input("NgayLap", sql.Date, todayVN)
            .input("HanThanhToan", sql.Date, todayVN)
            .input("MaHopDong", sql.NVarChar(20), fixture.contractId)
            .input("MaChiTiet", sql.Int, fixture.memberId)
            .input("KyThanhToan", sql.Date, invoicePeriod)
            .input("KyThanhToanDen", sql.Date, `${todayVN.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`)
            .query(`
                INSERT INTO dbo.HoaDon
                    (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
                     TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
                     KyThanhToan, KyThanhToanDen)
                VALUES
                    (@MaHoaDon, @MaSinhVien, @TenPhong, @NgayLap, 1, 0, 0,
                     N'Đã thanh toán', @HanThanhToan, N'TIEN_PHONG', @MaHopDong, @MaChiTiet,
                     @KyThanhToan, @KyThanhToanDen)
            `);
        await new sql.Request(transaction)
            .input("MaChiTiet", sql.NVarChar(40), invoiceItemId)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .query(`
                INSERT INTO dbo.ChiTietHoaDon
                    (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
                     TrangThai, ThuTu)
                VALUES
                    (@MaChiTiet, @MaHoaDon, N'ROOM', N'Tiền phòng', 1, 1, 1,
                     N'Đã thanh toán', 1)
            `);
        const paymentId = `TRIGGER-REFUND-${crypto.randomUUID()}`;
        const payment = await new sql.Request(transaction)
            .input("MaGiaoDich", sql.NVarChar(60), paymentId)
            .input("MaSinhVien", sql.NVarChar(20), fixture.studentId)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .input("NguoiTra", sql.Int, fixture.managerId)
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
        const refundId = payment.recordset[0].MaHoanTien;
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), fixture.contractId)
                .query(`
                    EXEC sys.sp_set_session_context
                        @key = N'KTXFixtureCleanup', @value = 1;
                    EXEC sys.sp_set_session_context
                        @key = N'KTXFixtureCleanupContract', @value = @MaHopDong;
                `);
            await assert.rejects(
                new sql.Request(transaction)
                    .input("MaHoanTien", sql.BigInt, refundId)
                .query("DELETE FROM dbo.HoanTienChuyenKhoanDu WHERE MaHoanTien = @MaHoanTien"),
            error => Number(error.number) === 52703
        );
    } finally {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (error) {
                if (error.code !== "EABORT") throw error;
            }
        }
        await pool.close();
    }
});

test("real SQL non-fixture invoiced incident cost remains protected by its trigger after migration 040", {
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
    let transaction;
    try {
        const migration = await pool.request().query(`
            SELECT COUNT(*) AS Applied
            FROM dbo.SchemaMigration
            WHERE MaMigration IN (N'038', N'040')
        `);
        assert.equal(migration.recordset[0]?.Applied, 2,
            "Migrations 038 and 040 must be applied.");
        const fixture = await createNonFixtureContract(pool, sql);
        transaction = fixture.transaction;
        const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const invoiceId = `NRC${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
        const invoiceItemId = `${invoiceId}-I`;
        const invoicePeriod = `${todayVN.slice(0, 7)}-01`;
        const lastDay = new Date(Date.UTC(
            Number(todayVN.slice(0, 4)), Number(todayVN.slice(5, 7)), 0
        )).getUTCDate();
        await new sql.Request(transaction)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .input("MaSinhVien", sql.NVarChar(20), fixture.studentId)
            .input("TenPhong", sql.NVarChar(50), fixture.roomA)
            .input("NgayLap", sql.Date, todayVN)
            .input("HanThanhToan", sql.Date, todayVN)
            .input("MaHopDong", sql.NVarChar(20), fixture.contractId)
            .input("MaChiTiet", sql.Int, fixture.memberId)
            .input("KyThanhToan", sql.Date, invoicePeriod)
            .input("KyThanhToanDen", sql.Date, `${todayVN.slice(0, 7)}-${lastDay}`)
            .query(`
                INSERT INTO dbo.HoaDon
                    (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, TienDien, TienNuoc,
                     TrangThaiThanhToan, HanThanhToan, LoaiHoaDon, MaHopDong, MaChiTiet,
                     KyThanhToan, KyThanhToanDen)
                VALUES
                    (@MaHoaDon, @MaSinhVien, @TenPhong, @NgayLap, 0, 0, 0,
                     N'Chưa thanh toán', @HanThanhToan, N'PHAT_SINH', @MaHopDong, @MaChiTiet,
                     @KyThanhToan, @KyThanhToanDen)
            `);
        await new sql.Request(transaction)
            .input("MaChiTiet", sql.NVarChar(40), invoiceItemId)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .query(`
                INSERT INTO dbo.ChiTietHoaDon
                    (MaChiTiet, MaHoaDon, MaKhoan, TenKhoan, SoTien, SoLuong, DonGia,
                     TrangThai, ThuTu)
                VALUES
                    (@MaChiTiet, @MaHoaDon, N'INCIDENT', N'Test incident', 1, 1, 1,
                     N'Chưa thanh toán', 1)
            `);
        const cost = await new sql.Request(transaction)
            .input("MaHopDong", sql.NVarChar(20), fixture.contractId)
            .input("MaChiTiet", sql.Int, fixture.memberId)
            .input("MaChiTietHoaDon", sql.NVarChar(40), invoiceItemId)
            .input("NoiDung", sql.NVarChar(255), `Trigger regression ${crypto.randomUUID()}`)
            .input("SoTien", sql.Decimal(18, 2), 1)
            .input("NguoiNhap", sql.Int, fixture.managerId)
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
        const costId = cost.recordset[0].MaChiPhi;
        assert.ok(costId);
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), fixture.contractId)
                .query(`
                    EXEC sys.sp_set_session_context
                        @key = N'KTXFixtureCleanup', @value = 1;
                    EXEC sys.sp_set_session_context
                        @key = N'KTXFixtureCleanupContract', @value = @MaHopDong;
                `);
            await assert.rejects(
                new sql.Request(transaction).input("MaChiPhi", sql.BigInt, costId)
                .query("DELETE FROM dbo.ChiPhiPhatSinh WHERE MaChiPhi = @MaChiPhi"),
            error => Number(error.number) === 51702
        );
    } finally {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (error) {
                if (error.code !== "EABORT") throw error;
            }
        }
        await pool.close();
    }
});

test("contract list/detail return grouped members and parameterized filters", async () => {
    const rows = [{
        MaHopDong: "HD00001", TenPhong: "A101", MaHangPhong: "HP4",
        TenHangPhong: "Phòng 4", SucChuaToiDa: 4, SoSinhVienHienTai: 1,
        NgayBatDau: new Date("2026-10-01"), NgayKetThuc: new Date("2027-10-01"),
        TrangThaiHopDong: "Còn hiệu lực", MaChiTiet: 5, MaSinhVien: "SV001",
        HoTen: "Student", TrangThaiThanhVien: "Đang ở"
    }];
    const harness = fakeApi({ queryResult: call => call.statement.includes("OUTER APPLY")
        ? { recordset: rows } : { recordset: [] } });
    const list = await invoke(harness, "get", "/api/HopDong", { query: { tenPhong: "A101", trangThai: "Còn hiệu lực" } });
    assert.equal(list.statusCode, 200);
    assert.equal(list.body[0].sinhVien[0].MaSinhVien, "SV001");
    assert.equal(list.body[0].SoSinhVienHienTai, 1);
    assert.equal(harness.queries[0].inputs.TenPhong, "A101");
    assert.doesNotMatch(harness.queries[0].statement, /hd\.MaSinhVien/);

    const detail = await invoke(harness, "get", "/api/HopDong/:id", { params: { id: "HD00001" } });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.body.MaHopDong, "HD00001");
});

test("history is the same handler as contract-member listing", async () => {
    const harness = fakeApi();
    assert.equal(
        harness.routes.get("get /api/history"),
        harness.routes.get("get /api/chitiethopdong")
    );
    const result = await invoke(harness, "get", "/api/chitiethopdong", {
        query: { maHopDong: "HD1", maSinhVien: "SV1", trangThai: "Đang ở" }
    });
    assert.equal(result.statusCode, 200);
    assert.match(harness.queries[0].statement, /FROM dbo\.ChiTietHopDong/);
    assert.equal(harness.queries[0].inputs.MaHopDong, "HD1");
});

test("renewal and member-management routes call the member-level renewal procedure", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT c.MaChiTiet")
            ? { recordset: [{ MaChiTiet: 9 }] }
            : call.statement.includes("SELECT 1 AS TonTai FROM dbo.HopDong")
                ? { recordset: [{ TonTai: 1 }] }
            : { recordset: [{ MaChiTiet: 9 }], rowsAffected: [1] }
    });
    for (const [url, body, expected] of [
        ["/api/HopDong/:id/gia-han", { maChiTiet: 9, ngayKetThucMoi: "2028-01-01" }, "dbo.sp_DuyetGiaHan"],
        ["/api/HopDong/:id/ket-thuc", {}, "dbo.sp_KetThucHopDong"],
        ["/api/HopDong/:id/chuyen-phong", { maSinhVien: "SV001", tenPhong: "B101" }, "dbo.sp_ChuyenPhong"],
        ["/api/HopDong/:id/chitiet", { maSinhVien: "SV002", kyHanThanhToanPhong: "THANG" }, "dbo.sp_ThemSinhVienVaoHopDong"],
        ["/api/HopDong/:id/chitiet/:maChiTiet/roi", {}, "dbo.sp_SinhVienRoiHopDong"]
    ]) {
        const method = url.endsWith("/chitiet") ? "post" : "put";
        const result = await invoke(harness, method, url, {
            params: { id: "HD00001", maChiTiet: "9" },
            body: { ...body, ...(url.endsWith("/roi") ? {} : {}) }
        });
        assert([200, 201].includes(result.statusCode), `${url}: ${result.statusCode}`);
        assert.equal(harness.executions.at(-1).procedure, expected);
    }
    const leave = harness.queries.find(call => call.statement.includes("UPDATE dbo.SinhVien"));
    assert.equal(leave, undefined);
});

test("database procedure errors map to Vietnamese 400/409/404 responses", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT 1 AS TonTai")
            ? { recordset: call.inputs.MaHopDong === "EXISTS" || call.inputs.MaChiTiet === 8 ? [{ TonTai: 1 }] : [] }
            : { recordset: [{ MaChiTiet: 8, MaSinhVien: "SV001", TrangThaiHopDong: "Còn hiệu lực" }] },
        executeError: call => call.procedure === "dbo.sp_DuyetGiaHan"
            ? Object.assign(new Error("raw SQL secret"), { number: 53208 }) : null
    });

    test("renewal request approval creates a member renewal invoice and rejection notifies the student", async () => {
        const approval = fakeApi({
            queryResult: call => call.statement.includes("SELECT Loai, MaSinhVien")
                ? { recordset: [{
                    Loai: "Gia hạn hợp đồng",
                    MaSinhVien: "SV001",
                    NgayKetThucDeXuat: new Date("2028-01-01T00:00:00.000Z")
                }] }
                : { recordset: [] },
            executeResult: call => call.procedure === "dbo.sp_DuyetGiaHan"
                ? { recordset: [{ MaGiaHan: 14, MaHoaDon: "HDINV14" }] }
                : { recordset: [] }
        });
        const approved = await invoke(approval, "put", "/api/requests/:id", {
            params: { id: "YC12345" },
            body: { TrangThai: "Đã duyệt" }
        });
        assert.equal(approved.statusCode, 200);
        assert.equal(approved.body.MaHoaDon, "HDINV14");
        const approvalCall = approval.executions.find(call => call.procedure === "dbo.sp_DuyetGiaHan");
        assert.equal(approvalCall.inputs.MaYeuCau, "YC12345");
        assert.equal(approvalCall.inputs.NgayKetThucMoi.toISOString().slice(0, 10), "2028-01-01");

        const rejection = fakeApi({
            queryResult: call => call.statement.includes("SELECT Loai, MaSinhVien")
                ? { recordset: [{ Loai: "Gia hạn hợp đồng", MaSinhVien: "SV009" }] }
                : call.statement.includes("UPDATE dbo.YeuCauSinhVien")
                    ? { recordset: [{
                        MaYeuCau: "YC12345", MaSinhVien: "SV009",
                        TrangThai: "Từ chối", PhanHoi: "Không đủ điều kiện"
                    }] }
                    : { recordset: [] }
        });
        const rejected = await invoke(rejection, "put", "/api/requests/:id", {
            params: { id: "YC12345" },
            body: { TrangThai: "Từ chối", PhanHoi: "Không đủ điều kiện" }
        });
        assert.equal(rejected.statusCode, 200);
        assert.equal(rejection.transactions[0].state, "committed");
        const notice = rejection.queries.find(call => call.statement.includes("INSERT INTO dbo.ThongBao"));
        assert.equal(notice.inputs.MaSuKien, "RENEWAL_REJECT:YC12345:SV009");
        assert.equal(notice.inputs.PhanHoi, "Không đủ điều kiện");
    });
    const exists = await invoke(harness, "put", "/api/HopDong/:id/gia-han", {
        params: { id: "EXISTS" }, body: { maChiTiet: 8, ngayKetThucMoi: "2028-01-01" }
    });
    assert.equal(exists.statusCode, 409);
    assert.match(exists.body.message, /đang chờ thanh toán/);
    assert.doesNotMatch(exists.body.message, /raw SQL/);

    const missing = await invoke(harness, "put", "/api/HopDong/:id/gia-han", {
        params: { id: "MISSING" }, body: { maChiTiet: 8, ngayKetThucMoi: "2028-01-01" }
    });
    assert.equal(missing.statusCode, 404);

    const capacity = fakeApi({
        queryResult: call => call.statement.includes("SELECT 1 AS TonTai")
            ? { recordset: [{ TonTai: 1 }] }
            : { recordset: [] },
        executeError: call => call.procedure === "dbo.sp_DuyetGiaHan"
            ? Object.assign(new Error("raw capacity detail"), { number: 53213 }) : null
    });
    const fullRoom = await invoke(capacity, "put", "/api/HopDong/:id/gia-han", {
        params: { id: "EXISTS" },
        body: { maChiTiet: 8, ngayKetThucMoi: "2028-01-01" }
    });
    assert.equal(fullRoom.statusCode, 409);
    assert.match(fullRoom.body.message, /sức chứa phòng bị vượt/);
    assert.doesNotMatch(fullRoom.body.message, /raw capacity detail/);

    const other = fakeApi({
        queryResult: call => call.statement.includes("SELECT p.MaHangPhong")
            ? { recordset: [{ MaHangPhong: "HP4" }] }
            : { recordset: [], rowsAffected: [1] },
        executeError: () => Object.assign(new Error("internal"), { number: 51429 })
    });
    const full = await invoke(other, "post", "/api/HopDong", {
        body: {
            tenPhong: "A101", maHangPhong: "HP4", ngayBatDau: "2026-10-01",
            ngayKetThuc: "2027-10-01",
            sinhVien: [{ maSinhVien: "SV001", kyHanThanhToanPhong: "THANG" }]
        }
    });
    assert.equal(full.statusCode, 409);
    assert.match(full.body.message, /sức chứa/);
});

test("early checkout processed and ineligible-member SQL errors map to 409", async () => {
    for (const [number, expectedMessage] of [
        [53313, "Yêu cầu đã được xử lý."],
        [53314, "Thành viên hoặc hợp đồng không còn đủ điều kiện trả phòng sớm."]
    ]) {
        const harness = fakeApi({
            queryResult: call => call.statement.includes("SELECT Loai, MaSinhVien, NgayKetThucDeXuat")
                ? { recordset: [{ Loai: "Trả phòng sớm", MaSinhVien: "SV001" }] }
                : { recordset: [] },
            executeError: call => call.procedure === "dbo.sp_DuyetTraPhongSom"
                ? Object.assign(new Error("raw SQL detail"), { number }) : null
        });
        const result = await invoke(harness, "put", "/api/requests/:id", {
            params: { id: "YC12345" },
            body: { TrangThai: "Đã duyệt" }
        });
        assert.equal(result.statusCode, 409);
        assert.equal(result.body.message, expectedMessage);
        assert.doesNotMatch(result.body.message, /raw SQL detail/);
    }
});

test("missing versus inactive contract/member procedure errors are probed from their tables", async () => {
    for (const { code, route, method, body, params, probeInput, expected } of [
        { code: 51432, route: "/api/HopDong/:id/chitiet", method: "post",
            body: { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, params: { id: "HD1" },
            probeInput: { MaHopDong: "HD1" }, expected: 409 },
        { code: 51436, route: "/api/HopDong/:id/chitiet/:maChiTiet/roi", method: "put",
            body: {}, params: { id: "HD1", maChiTiet: "8" },
            probeInput: { MaChiTiet: 8 }, expected: 409 }
    ]) {
        const harness = fakeApi({
            queryResult: call => call.statement.includes("SELECT 1 AS TonTai")
                ? { recordset: call.inputs[Object.keys(probeInput)[0]] === Object.values(probeInput)[0] ? [{ TonTai: 1 }] : [] }
                : { recordset: [{ MaChiTiet: 8 }] },
            executeError: () => Object.assign(new Error("procedure error"), { number: code })
        });
        const result = await invoke(harness, method, route, { params, body });
        assert.equal(result.statusCode, expected, String(code));

        const missingHarness = fakeApi({
            queryResult: () => ({ recordset: [] }),
            executeError: () => Object.assign(new Error("procedure error"), { number: code })
        });
        const missing = await invoke(missingHarness, method, route, { params, body });
        assert.equal(missing.statusCode, 404, `missing object for ${code}`);
    }
});

test("member renewal validates MaChiTiet or MSSV and maps a pending renewal to 409", async () => {
    const invalidId = await invoke(fakeApi(), "put", "/api/HopDong/:id/gia-han", {
        params: { id: "HD1" },
        body: { ngayKetThucMoi: "2028-01-01" }
    });
    assert.equal(invalidId.statusCode, 400);
    assert.match(invalidId.body.message, /MaChiTiet hoặc MSSV/);

    const invalidDate = await invoke(fakeApi(), "put", "/api/HopDong/:id/gia-han", {
        params: { id: "HD1" },
        body: { maChiTiet: 8, ngayKetThucMoi: "not-a-date" }
    });
    assert.equal(invalidDate.statusCode, 400);

    for (const body of [
        { maChiTiet: 8, ngayKetThucMoi: "2028-01-01" },
        { MSSV: "SV001", ngayKetThucMoi: "2028-01-01" }
    ]) {
        const harness = fakeApi({
            queryResult: call => call.statement.includes("SELECT 1 AS TonTai")
                ? { recordset: [{ TonTai: 1 }] }
                : { recordset: [{ MaChiTiet: 8 }] },
            executeError: call => call.procedure === "dbo.sp_DuyetGiaHan"
                ? Object.assign(new Error("raw SQL detail"), { number: 53208 }) : null
        });
        const result = await invoke(harness, "put", "/api/HopDong/:id/gia-han", {
            params: { id: "HD1" }, body
        });
        assert.equal(result.statusCode, 409);
        assert.match(result.body.message, /đang chờ thanh toán/);
        assert.doesNotMatch(result.body.message, /raw SQL detail/);
        const renewalCall = harness.executions.find(call => call.procedure === "dbo.sp_DuyetGiaHan");
        assert(renewalCall);
        assert.equal(renewalCall.inputs.MaHopDong, "HD1");
        assert.equal(renewalCall.inputs.MaChiTiet, 8);
    }
});

test("contract membership failures use distinct SQL error mappings", async () => {
    for (const [number, route, method, params, body, expectedStatus, expectedMessage] of [
        [51461, "/api/HopDong/:id/chitiet", "post", { id: "HD1" },
            { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, 409, /^Phòng đã đủ sức chứa\.$/],
        [51459, "/api/HopDong/:id/chitiet", "post", { id: "HD1" },
            { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, 409, /^Giới tính sinh viên không phù hợp với phòng\.$/],
        [51460, "/api/HopDong/:id/chitiet", "post", { id: "HD1" },
            { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, 409, /^Sinh viên đang ở tại phòng hoặc hợp đồng khác\.$/],
        [51458, "/api/HopDong/:id/chitiet", "post", { id: "HD1" },
            { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, 404, /^Không tìm thấy sinh viên\.$/],
        [51432, "/api/HopDong/:id/chitiet", "post", { id: "HD1" },
            { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, 409, /không còn hiệu lực/]
    ]) {
        const harness = fakeApi({
            queryResult: call => call.statement.includes("SELECT 1 AS TonTai")
                ? { recordset: [{ TonTai: 1 }] }
                : { recordset: [] },
            executeError: () => Object.assign(new Error("procedure error"), { number })
        });
        const result = await invoke(harness, method, route, { params, body });
        assert.equal(result.statusCode, expectedStatus, String(number));
        assert.match(result.body.message, expectedMessage);
    }
    const invalid = await invoke(fakeApi(), "post", "/api/HopDong/:id/chitiet", {
        params: { id: "HD1" }, body: { maSinhVien: "SV1", kyHanThanhToanPhong: "QUY" }
    });
    assert.equal(invalid.statusCode, 400);
});

test("representative changes clear the previous member before setting the new one and log the action", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT c.MaChiTiet, c.MaSinhVien")
            ? { recordset: [{ MaChiTiet: 22, MaSinhVien: "SV022", TrangThaiHopDong: "Còn hiệu lực" }] }
            : { recordset: [], rowsAffected: [1] }
    });
    const result = await invoke(harness, "put", "/api/HopDong/:id/dai-dien", {
        params: { id: "HD00001" }, body: { maChiTiet: 22 }
    });
    assert.equal(result.statusCode, 200);
    const representativeUpdate = harness.queries.find(call => call.statement.includes("LaNguoiDaiDienThanhToanDichVu = 0"));
    assert.match(representativeUpdate.statement, /LaNguoiDaiDienThanhToanDichVu = 0[\s\S]*LaNguoiDaiDienThanhToanDichVu = 1/);
    assert.equal(harness.executions.at(-1).procedure, "dbo.sp_GhiNhatKyHopDong");
    assert.equal(harness.transactions.at(-1).state, "committed");
});

test("room-class and service endpoints return price warnings and write transactionally", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("FROM dbo.HangPhong hp")
            ? { recordset: [{
                MaHangPhong: "HP4", TenHangPhong: "Phòng 4", SucChuaToiDa: 4,
                GiaPhongThang: 100, GiaPhongNam: 1000, MaDichVu: "WIFI",
                TenDichVu: "Wifi", DonVi: "tháng", DichVuHoatDong: 0,
                DonGia: 0, CachTinh: "CO_DINH_KY", DoiTuongThanhToan: "PHONG",
                GiaDichVuHoatDong: 0
            }] }
            : { recordset: [], rowsAffected: [1] }
    });
    const tiers = await invoke(harness, "get", "/api/HangPhong");
    assert.equal(tiers.statusCode, 200);
    assert.equal(tiers.body[0].dichVu[0].CanhBao, "chưa có đơn giá");
    const services = await invoke(harness, "get", "/api/DichVu");
    assert.equal(services.statusCode, 200);

    const servicePayload = { maDichVu: "TEST", tenDichVu: "Test", donVi: "lần", hoatDong: true };
    const createService = await invoke(harness, "post", "/api/DichVu", { body: servicePayload });
    assert.equal(createService.statusCode, 201);
    const updateService = await invoke(harness, "put", "/api/DichVu/:id", {
        params: { id: "TEST" }, body: { ...servicePayload, tenDichVu: "Test sửa" }
    });
    assert.equal(updateService.statusCode, 200);
    assert.equal(harness.transactions.slice(-2).every(tx => tx.state === "committed"), true);

    const tierPayload = {
        maHangPhong: "HPX", tenHangPhong: "Hạng test", sucChuaToiDa: 4,
        giaPhongThang: 10, giaPhongNam: 100,
        dichVu: [{ maDichVu: "TEST", donGia: 0, cachTinh: "CO_DINH_KY", doiTuongThanhToan: "PHONG" }]
    };
    const createTier = await invoke(harness, "post", "/api/HangPhong", { body: tierPayload });
    assert.equal(createTier.statusCode, 201);
    const updateTier = await invoke(harness, "put", "/api/HangPhong/:id", {
        params: { id: "HPX" }, body: { ...tierPayload, tenHangPhong: "Hạng sửa" }
    });
    assert.equal(updateTier.statusCode, 200);
    assert(harness.queries.some(call => call.statement.includes("INSERT INTO dbo.HangPhong_DichVu")));
    assert(harness.queries.some(call => call.statement.includes("INSERT INTO dbo.NhatKyHeThong")));
});

test("service endpoints reject malformed data before database writes", async () => {
    const harness = fakeApi();
    const badService = await invoke(harness, "post", "/api/DichVu", {
        body: { maDichVu: "D", tenDichVu: "Service", donVi: "lần", hoatDong: "yes" }
    });
    assert.equal(badService.statusCode, 400);
    const badTier = await invoke(harness, "post", "/api/HangPhong", {
        body: {
            maHangPhong: "HP", tenHangPhong: "Tier", sucChuaToiDa: "4",
            giaPhongThang: 10, giaPhongNam: 100
        }
    });
    assert.equal(badTier.statusCode, 400);
    assert.equal(harness.queries.length, 0);
});

test("room endpoints read price from the room class and protect occupied rooms on updates", async () => {
    const harness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("SELECT TOP (1) MaHangPhong, SucChuaToiDa")) {
                return { recordset: [{ MaHangPhong: "HP4", SucChuaToiDa: 4 }] };
            }
            if (call.statement.includes("SELECT p.MaHangPhong,")) {
                return { recordset: [{
                    MaHangPhong: "HP4", SoSinhVienHienTai: 0, SaiGioiTinh: 0
                }] };
            }
            if (call.statement.includes("FROM dbo.Phong p")) {
                return { recordset: [{
                    TenPhong: "A101", MaHangPhong: "HP4", GiaPhong: 100,
                    GiaPhongNam: 1000, SoSinhVienHienTai: 2
                }] };
            }
            return { recordset: [], rowsAffected: [1] };
        }
    });
    const rooms = await invoke(harness, "get", "/api/Phong");
    assert.equal(rooms.statusCode, 200);
    assert.equal(rooms.body[0].GiaPhong, 100);
    assert.match(harness.queries[0].statement, /INNER JOIN dbo\.HangPhong hp/);
    assert.doesNotMatch(harness.queries[0].statement, /(?:^|[^\w])p\.GiaPhong/);

    const roomPayload = {
        TenPhong: "A102", Khu: "A", LoaiPhong: "Nam", SucChuaToiDa: 4,
        MaHangPhong: "HP4", GhiChu: "Kiểm thử"
    };
    const created = await invoke(harness, "post", "/api/Phong", { body: roomPayload });
    assert.equal(created.statusCode, 201);
    const updated = await invoke(harness, "put", "/api/Phong/:id", {
        params: { id: "A102" },
        body: { ...roomPayload, TrangThaiPhong: "Trống" }
    });
    assert.equal(updated.statusCode, 200);
    assert(harness.transactions.slice(-2).every(transaction => transaction.state === "committed"));

    const occupiedHarness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("SELECT TOP (1) MaHangPhong, SucChuaToiDa")) {
                return { recordset: [{ MaHangPhong: "HP6", SucChuaToiDa: 6 }] };
            }
            if (call.statement.includes("SELECT p.MaHangPhong,")) {
                return { recordset: [{
                    MaHangPhong: "HP4", SoSinhVienHienTai: 1, SaiGioiTinh: 0
                }] };
            }
            return { recordset: [] };
        }
    });
    const occupiedUpdate = await invoke(occupiedHarness, "put", "/api/Phong/:id", {
        params: { id: "A101" },
        body: { ...roomPayload, SucChuaToiDa: 6, MaHangPhong: "HP6", TrangThaiPhong: "Trống" }
    });
    assert.equal(occupiedUpdate.statusCode, 409);
    assert.match(occupiedUpdate.body.message, /đang có thành viên/);
});

test("Admin student creation validates CCCD/passport and reports duplicate owners only to Managers", async () => {
    const validStudent = {
        name: "Student", gender: "Nam", phone: "0123456789", email: "student@example.com",
        room: "A101", requireCccd: true
    };
    const identityError = require("./js/student-identity").IDENTITY_ERROR;
    for (const studentId of ["012345678901", " ab1234 "]) {
        assert.equal(registerApiRoutes.validateStudentInput({ ...validStudent, studentId }), null);
    }
    for (const studentId of ["12345678901", "0123456789012", "123456", "AB12 34", "AB12-34"]) {
        assert.equal(registerApiRoutes.validateStudentInput({ ...validStudent, studentId }), identityError);
    }

    const invalidHarness = fakeApi();
    const invalid = await invoke(invalidHarness, "post", "/api/sinhvien", {
        body: {
            MaSinhVien: "12345678901", HoTen: "Student", GioiTinh: "Nam",
            SoDienThoai: "0123456789", Email: "student@example.com", TenPhong: "A101"
        }
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.body.message, identityError);
    assert.equal(invalidHarness.queries.length, 0);

    for (const auth of [null, { role: "Sinh viên", studentId: "012345678901" }]) {
        const deniedHarness = fakeApi();
        const denied = await invoke(deniedHarness, "post", "/api/sinhvien", {
            auth,
            body: {
                MaSinhVien: "AB1234", HoTen: "Student", GioiTinh: "Nam",
                SoDienThoai: "0123456789", Email: "student@example.com", TenPhong: "A101"
            }
        });
        assert.equal(denied.statusCode, auth ? 403 : 401);
        assert.doesNotMatch(denied.body.message, /Nguyễn An/);
        assert.equal(deniedHarness.queries.length, 0);
    }

    const duplicateHarness = fakeApi({
        queryResult: call => call.statement.includes("SELECT TOP (1) HoTen")
            ? { recordset: [{ HoTen: "Nguyễn An" }] }
            : { recordset: [] }
    });
    const duplicate = await invoke(duplicateHarness, "post", "/api/sinhvien", {
        body: {
            MaSinhVien: " ab1234 ", HoTen: "Student", GioiTinh: "Nam",
            SoDienThoai: "0123456789", Email: "student@example.com", TenPhong: "A101"
        }
    });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.body.message, "Số CCCD/hộ chiếu đã được đăng ký cho sinh viên Nguyễn An.");
    assert.equal(duplicateHarness.queries[0].inputs.MaSinhVien, "AB1234");
    assert.match(duplicateHarness.queries[0].statement, /UPPER\(LTRIM\(RTRIM\(MaSinhVien\)\)\)/);
    assert.equal(duplicateHarness.transactions[0].state, "rolledback");
});

test("student creation and room changes assign through contract procedures, never direct room writes", async () => {
    let activeContractLookups = 0;
    const harness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("SELECT p.MaHangPhong")) return { recordset: [{ MaHangPhong: "HP4" }] };
            if (call.statement.includes("SELECT TOP (1) hd.MaHopDong")) {
                activeContractLookups++;
                return activeContractLookups === 1
                    ? { recordset: [{ MaHopDong: "HD00001", LaNguoiDaiDien: 0 }] }
                    : { recordset: [] };
            }
            if (call.statement.includes("AS NgayVao")) {
                return { recordset: [{
                    MaHopDong: "HD00001", TenPhong: "A101",
                    NgayBatDau: "2026-10-01", NgayKetThuc: "2027-10-01",
                    MaChiTiet: 45, MaSinhVien: "012345678901", KyHanThanhToanPhong: "THANG",
                    GiaPhongApDung: 1200000, GiaPhongThangApDung: 1200000, NgayVao: "2026-10-01"
                }] };
            }
            if (call.statement.includes("SELECT @@ROWCOUNT AS RowsAffected")) {
                return { recordset: [{ RowsAffected: 1 }], rowsAffected: [1] };
            }
            if (call.statement.includes("SELECT sv.MaSinhVien, sv.TenPhong")) {
                return { recordset: [{ MaSinhVien: "SV001", TenPhong: "A101", MaChiTiet: null }] };
            }
            if (call.statement.includes("SELECT CAST(GETDATE()")) {
                return { recordset: [{ NgayBatDau: new Date("2026-10-01"), NgayKetThuc: new Date("2027-10-01") }] };
            }
            return { recordset: [], rowsAffected: [1] };
        },
        executeResult: call => call.procedure === "dbo.sp_TaoHoaDonTienPhong"
            ? { recordset: [{ MaHoaDon: "INV00001", TongTien: 1200000 }], output: { MaHoaDon: "INV00001" } }
            : { recordset: [{ MaHopDong: "HD00001" }] }
    });
    const created = await invoke(harness, "post", "/api/sinhvien", {
        body: {
            MaSinhVien: "012345678901", HoTen: "Student", GioiTinh: "Nam", SoDienThoai: "0123456789",
            Email: "student@example.com", TenPhong: "A101"
        }
    });
    assert.equal(created.statusCode, 201);
    assert(harness.executions.some(call => call.procedure === "dbo.sp_ThemSinhVienVaoHopDong"));
    assert(harness.executions.some(call => call.procedure === "dbo.sp_TaoHoaDonTienPhong"));
    assert(harness.queries.some(call => call.inputs.MaSuKien === "CONTRACT:HD00001:012345678901"));
    const insertStudent = harness.queries.find(call => call.statement.includes("INSERT INTO dbo.SinhVien"));
    assert.doesNotMatch(insertStudent.statement, /TenPhong/);

    const updated = await invoke(harness, "put", "/api/sinhvien/:mssv", {
        params: { mssv: "012345678901" },
        body: {
            mssv: "012345678901", hoTen: "Student", gioiTinh: "Nam",
            soDienThoai: "0123456789", email: "student@example.com",
            tenPhong: "A102", trangThaiSinhVien: "Đang ở"
        }
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.MaHopDong, "HD00001");
    assert.equal(updated.body.HoaDonTienPhong.length, 1);
    assert(harness.queries.some(call => call.inputs.MaSuKien === "CONTRACT:HD00001:012345678901"));
    assert.equal(harness.transactions.at(-1).state, "committed");
    const profileUpdate = harness.queries.find(call => call.statement.includes("UPDATE dbo.SinhVien"));
    assert.doesNotMatch(profileUpdate.statement, /TenPhong\s*=/);
    assert(harness.executions.some(call => call.procedure === "dbo.sp_TaoHopDong"));
});

test("money invoice APIs enforce student ownership and return invoice aggregates", async () => {
    const harness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("FROM dbo.HoaDon hd")
                && call.statement.includes("vw_HoaDonTongHop")) {
                if (call.inputs.MaSinhVien === "SV002") return { recordset: [] };
                return { recordset: [{
                    MaHoaDon: "INV2026100011", MaSinhVien: null, MaHopDong: "HD00001",
                    LoaiHoaDon: "DICH_VU_PHONG", TongTien: 300, DaThu: 100, ConNo: 200
                }] };
            }
            if (call.statement.includes("FROM dbo.ChiTietHoaDon")) {
                return { recordset: [{ MaChiTiet: 1, SoTien: 300 }] };
            }
            if (call.statement.includes("FROM dbo.PhieuThu")) {
                return { recordset: [{ MaPhieuThu: 2, SoTien: 100 }] };
            }
            return { recordset: [] };
        }
    });
    const list = await invoke(harness, "get", "/api/HoaDon", {
        auth: { role: "Sinh viên", studentId: "SV001" }
    });
    assert.equal(list.statusCode, 200);
    assert.match(harness.queries[0].statement, /ChiTietHopDong/);
    assert.match(harness.queries[0].statement, /CONVERT\(nvarchar\(10\), hd\.NgayLap, 23\) AS NgayLap/);
    assert.match(harness.queries[0].statement, /CONVERT\(nvarchar\(10\), hd\.HanThanhToan, 23\) AS HanThanhToan/);
    assert.equal(harness.queries[0].inputs.MaSinhVien, "SV001");
    assert.match(harness.queries[0].statement, /hd\.LoaiHoaDon = N'CU' AND hd\.MaSinhVien = @MaSinhVien/);
    assert.match(harness.queries[0].statement, /ChiTietHopDong c[\s\S]*c\.MaSinhVien = @MaSinhVien/);

    const detail = await invoke(harness, "get", "/api/HoaDon/:id", {
        params: { id: "INV2026100011" },
        auth: { role: "Sinh viên", studentId: "SV001" }
    });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.body.DaThu, 100);
    assert.equal(detail.body.ConNo, 200);
    assert.equal(detail.body.ChiTiet.length, 1);
    assert.equal(detail.body.PhieuThu.length, 1);
    assert.match(harness.queries[1].statement, /ownerDetail\.MaSinhVien = @MaSinhVien/);

    const denied = await invoke(harness, "get", "/api/HoaDon/:id", {
        params: { id: "INV2026100011" },
        auth: { role: "Sinh viên", studentId: "SV002" },
        // The SQL ownership predicate filters out invoices belonging to another room.
        query: {}
    });
    assert.equal(denied.statusCode, 404);
});

test("money receipt endpoints call procedures and reject non-integer VND", async () => {
    const harness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("SELECT pt.MaHoaDon, pt.MaGiaoDich")
                && call.statement.includes("TrangThaiPhieuThu")) {
                return { recordset: [{
                    MaHoaDon: "INV2026100011", MaGiaoDich: null,
                    TrangThaiPhieuThu: "Chờ xác nhận", TrangThai: null
                }] };
            }
            if ((call.statement.includes("SELECT MaHoaDon, MaGiaoDich")
                || call.statement.includes("SELECT pt.MaHoaDon, pt.MaGiaoDich"))
                && call.statement.includes("dbo.PhieuThu")) {
                return { recordset: [{ MaHoaDon: "INV2026100011", MaGiaoDich: null }] };
            }
            if (call.statement.includes("SELECT MaPhieuThu")
                && call.statement.includes("dbo.PhieuThu")) {
                return { recordset: [{ MaPhieuThu: 93 }] };
            }
            if (call.statement.includes("hd.TrangThaiThanhToan")
                && call.statement.includes("CROSS APPLY")) {
                return { recordset: [{ TrangThaiThanhToan: "Chưa thanh toán", ConNo: 100 }] };
            }
            if (call.statement.includes("FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)")) {
                return { recordset: [{ MaHoaDon: "INV2026100011" }] };
            }
            if (call.statement.includes("SELECT MaHopDong, MaChiTiet FROM dbo.HoaDon")) {
                return { recordset: [{ MaHopDong: "HD-1", MaChiTiet: 1 }] };
            }
            if (call.statement.includes("SELECT hd.MaHopDong, hd.MaChiTiet, pt.SoTien")) {
                return { recordset: [{
                    MaHopDong: "HD-1", MaChiTiet: 1, SoTien: 100,
                    MaSinhVienNop: "SV-1", TrangThaiPhieuThu: "Chờ xác nhận", ConNo: 100
                }] };
            }
            if (call.statement.includes("SELECT pt.MaSinhVienNop, gd.MaSinhVien")) {
                return { recordset: [{
                    MaSinhVienNop: "SV-1", MaSinhVienGiaoDich: null,
                    MaHopDong: "HD-1", MaChiTiet: 1, MaHoaDon: "INV2026100011"
                }] };
            }
            if (call.statement.includes("SELECT DISTINCT c.MaSinhVien")) {
                return { recordset: [{ MaSinhVien: "SV-1" }] };
            }
            return { recordset: [], rowsAffected: [1] };
        },
        executeResult: call => call.procedure === "dbo.sp_GhiPhieuThu"
            ? { recordset: [{ MaPhieuThu: 93 }] }
            : call.procedure === "dbo.sp_XacNhanPhieuThu"
                ? { recordset: [{ TrangThaiPhieuThu: "Hợp lệ", TrangThaiGiaoDich: "SUCCESS" }] }
                : { recordset: [] }
    });
    const invalid = await invoke(harness, "post", "/api/HoaDon/:id/phieuthu", {
        params: { id: "INV2026100011" },
        body: { soTien: "100", phuongThuc: "CASH", trangThai: "Hợp lệ" }
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(harness.executions.some(call => call.procedure === "dbo.sp_GhiPhieuThu"), false);

    const created = await invoke(harness, "post", "/api/HoaDon/:id/phieuthu", {
        params: { id: "INV2026100011" },
        body: { soTien: 100, phuongThuc: "CASH", trangThai: "Hợp lệ" }
    });
    assert.equal(created.statusCode, 201);
    const receiptCall = harness.executions.find(call => call.procedure === "dbo.sp_GhiPhieuThu");
    assert.ok(receiptCall);
    assert.equal(receiptCall.inputs.SoTien, 100);
    assert.equal(harness.transactions.at(-1).state, "committed");
    const paymentNotice = harness.queries.find(call =>
        call.statement.includes("INSERT INTO dbo.ThongBao"));
    assert.equal(paymentNotice.inputs.MaSuKien, "PAYMENT:93");

    const confirmation = await invoke(harness, "put", "/api/phieuthu/:id/xac-nhan", {
        params: { id: "93" }, body: {}
    });
    assert.equal(confirmation.statusCode, 200);
    assert(harness.executions.some(call => call.procedure === "dbo.sp_XacNhanPhieuThu"));
});

test("cash receipts reject short, excess, and already-paid invoices before writing a receipt", async () => {
    const harness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("CROSS APPLY") && call.statement.includes("AS ConNo")) {
                const balances = { "INV-SHORT": 100, "INV-OVER": 100, "INV-PAID": 0 };
                return { recordset: [{
                    TrangThaiThanhToan: call.inputs.MaHoaDon === "INV-PAID" ? "Đã thanh toán" : "Chưa thanh toán",
                    ConNo: balances[call.inputs.MaHoaDon]
                }] };
            }
            return { recordset: [], rowsAffected: [1] };
        }
    });
    const submit = (id, amount) => invoke(harness, "post", "/api/HoaDon/:id/phieuthu", {
        params: { id },
        body: { soTien: amount, phuongThuc: "CASH", trangThai: "Hợp lệ" }
    });
    const underpayment = await submit("INV-SHORT", 99);
    const overpayment = await submit("INV-OVER", 101);
    const paidInvoice = await submit("INV-PAID", 1);
    assert.equal(underpayment.statusCode, 400);
    assert.match(underpayment.body.message, /phải đúng bằng số còn nợ 100 đ/);
    assert.equal(overpayment.statusCode, 400);
    assert.match(overpayment.body.message, /phải đúng bằng số còn nợ 100 đ/);
    assert.equal(paidInvoice.statusCode, 409);
    assert.match(paidInvoice.body.message, /đã được thanh toán đầy đủ/);
    assert.equal(harness.executions.some(call => call.procedure === "dbo.sp_GhiPhieuThu"), false);
    assert.ok(harness.transactions.every(transaction => transaction.state === "rolledback"));
});

test("incident expense API rejects amounts above the 50 million VND limit", async () => {
    const harness = fakeApi();
    const baseBody = {
        maHopDong: "HD1", maChiTiet: null, noiDung: "Sửa vòi nước",
        soTien: 50000001, ngayPhatSinh: "2026-03-01", hanDong: "2026-03-08",
        cheDoLap: "GOP"
    };
    const tooHigh = await invoke(harness, "post", "/api/ChiPhiPhatSinh", { body: baseBody });
    assert.equal(tooHigh.statusCode, 400);
    assert.match(tooHigh.body.message, /50\.000\.000 đ/);
    assert.equal(harness.transactions.length, 0);
});

test("incident expense API rejects merging a cost assigned to one student", async () => {
    const harness = fakeApi();
    const individualMerge = await invoke(harness, "post", "/api/ChiPhiPhatSinh", {
        body: {
            maHopDong: "HD1", maChiTiet: 1, noiDung: "Sửa vòi nước", soTien: 1000,
            ngayPhatSinh: "2026-03-01", hanDong: "2026-03-08", cheDoLap: "GOP"
        }
    });
    assert.equal(individualMerge.statusCode, 400);
    assert.equal(harness.transactions.length, 0);
});

test("student invoice API returns an overdue invoice with balance and due date", async () => {
    const dueDate = "2026-11-02";
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT hd.MaHoaDon, hd.MaSinhVien")
            ? { recordset: [{
                MaHoaDon: "INV-LATE-STUDENT", MaSinhVien: "SV-LATE", MaHopDong: "HD-LATE",
                MaChiTiet: 1, KyThanhToan: "2026-10-01", KyThanhToanDen: "2026-10-31",
                LoaiHoaDon: "TIEN_PHONG", TenPhong: "A201", NgayLap: "2026-10-01",
                HanThanhToan: dueDate, HanThanhToanApDung: dueDate,
                TrangThaiThanhToan: "Chưa thanh toán", TongTien: 1200000, DaThu: 0, ConNo: 1200000
            }] }
            : { recordset: [] }
    });
    const response = await invoke(harness, "get", "/api/HoaDon", {
        auth: { role: "Sinh viên", studentId: "SV-LATE" }
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body[0].HanThanhToan, dueDate);
    assert.equal(response.body[0].ConNo, 1200000);
    const utils = require("./js/module/AdminWorkflowUtils");
    assert.equal(utils.invoicePaymentLabel(response.body[0], "2026-11-03"), "Trễ hạn");
});

test("student payment requests reject cash at the office and validate invoice ownership", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT hd.MaHoaDon, hd.TrangThaiThanhToan")
            ? { recordset: [] }
            : { recordset: [] }
    });
    const invalid = await invoke(harness, "post", "/api/payments/create", {
        auth: { role: "Sinh viên", studentId: "SV001" },
        body: { MaHoaDon: "INV2026100011", SoTien: 100.5, PhuongThuc: "CASH" }
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(harness.transactions.length, 0);

    const cash = await invoke(harness, "post", "/api/payments/create", {
        auth: { role: "Sinh viên", studentId: "SV001" },
        body: { MaHoaDon: "INV2026100011", SoTien: 100, PhuongThuc: "CASH" }
    });
    assert.equal(cash.statusCode, 400);
    assert.match(cash.body.message, /nộp tiền mặt tại văn phòng ký túc xá/i);
    assert.equal(harness.transactions.length, 0);
    assert.equal(harness.queries.length, 0);

    const previousBankConfig = {
        bin: process.env.PAYMENT_BANK_BIN,
        account: process.env.PAYMENT_BANK_ACCOUNT_NO,
        name: process.env.PAYMENT_BANK_ACCOUNT_NAME
    };
    process.env.PAYMENT_BANK_BIN = "970415";
    process.env.PAYMENT_BANK_ACCOUNT_NO = "1234567890";
    process.env.PAYMENT_BANK_ACCOUNT_NAME = "TEST ACCOUNT";
    let foreign;
    try {
        foreign = await invoke(harness, "post", "/api/payments/create", {
            auth: { role: "Sinh viên", studentId: "SV001" },
            body: { MaHoaDon: "INV2026100011", SoTien: 100, PhuongThuc: "ONLINE" }
        });
    } finally {
        if (previousBankConfig.bin === undefined) delete process.env.PAYMENT_BANK_BIN;
        else process.env.PAYMENT_BANK_BIN = previousBankConfig.bin;
        if (previousBankConfig.account === undefined) delete process.env.PAYMENT_BANK_ACCOUNT_NO;
        else process.env.PAYMENT_BANK_ACCOUNT_NO = previousBankConfig.account;
        if (previousBankConfig.name === undefined) delete process.env.PAYMENT_BANK_ACCOUNT_NAME;
        else process.env.PAYMENT_BANK_ACCOUNT_NAME = previousBankConfig.name;
    }
    assert.equal(foreign.statusCode, 404);
    const ownerLookup = harness.queries.find(call =>
        call.statement.includes("SELECT hd.MaHoaDon, hd.TrangThaiThanhToan"));
    assert.equal(ownerLookup.inputs.MaSinhVien, "SV001");
    assert.match(ownerLookup.statement, /ChiTietHopDong/);
    assert.equal(harness.executions.some(call => call.procedure === "dbo.sp_GhiPhieuThu"), false);
    assert.equal(harness.executions.some(call => call.procedure === "dbo.sp_KichHoatGiaHan"), false);
});

test("student payment request reports an existing payment as processing", async () => {
    const config = {
        bin: process.env.PAYMENT_BANK_BIN,
        account: process.env.PAYMENT_BANK_ACCOUNT_NO,
        name: process.env.PAYMENT_BANK_ACCOUNT_NAME
    };
    Object.assign(process.env, {
        PAYMENT_BANK_BIN: "970415",
        PAYMENT_BANK_ACCOUNT_NO: "1234567890",
        PAYMENT_BANK_ACCOUNT_NAME: "TEST ACCOUNT"
    });
    const harness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("FROM dbo.GiaoDichThanhToan WITH (UPDLOCK, HOLDLOCK)")) {
                return { recordset: [] };
            }
            if (call.statement.includes("SELECT MaGiaoDich")
                && call.statement.includes("FROM dbo.PhieuThu WITH (READCOMMITTED)")) {
                return { recordset: [{ MaGiaoDich: "PAY-EXISTING" }] };
            }
            if (call.statement.includes("SELECT hd.MaHoaDon, hd.TrangThaiThanhToan")) {
                return { recordset: [{
                    MaHoaDon: "INV2026100011", TrangThaiThanhToan: "Chưa thanh toán", ConNo: 200
                }] };
            }
            if (call.statement.includes("SELECT TOP (1) gd.MaGiaoDich")) {
                return { recordset: [{
                    MaGiaoDich: "PAY-EXISTING", TongTien: 100, PhuongThuc: "ONLINE",
                    TrangThai: "PENDING", NoiDungCK: "KTXEXISTING", MaPhieuThu: 12
                }] };
            }
            return { recordset: [] };
        }
    });
    try {
        const result = await invoke(harness, "post", "/api/payments/create", {
            auth: { role: "Sinh viên", studentId: "SV001" },
            body: { MaHoaDon: "INV2026100011", SoTien: 200, PhuongThuc: "ONLINE" }
        });
        assert.equal(result.statusCode, 409);
        assert.equal(result.body.message, "Hóa đơn đã có yêu cầu thanh toán đang xử lý.");
    } finally {
        for (const [key, value] of Object.entries({
            PAYMENT_BANK_BIN: config.bin,
            PAYMENT_BANK_ACCOUNT_NO: config.account,
            PAYMENT_BANK_ACCOUNT_NAME: config.name
        })) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test("duplicate signed bank webhook is acknowledged without creating another receipt", async () => {
    const { createPaymentWebhookSignature } = require("./payment-webhook");
    const previousSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const secret = "test-webhook-secret-with-at-least-32-characters";
    process.env.PAYMENT_WEBHOOK_SECRET = secret;
    const payload = {
        MaHoaDon: "INV2026100011",
        SoTien: 100,
        MaThamChieuNgoai: "BANK-REF-001",
        NoiDungCK: "KTXABCDEF0123456789ABCD"
    };
    const harness = fakeApi({
        queryResult: () => ({
            recordset: [{
                MaGiaoDich: "PAY-TEST", TrangThai: "SUCCESS", PhuongThuc: "ONLINE",
                TongTien: 100, NoiDungCK: payload.NoiDungCK, MaHoaDon: payload.MaHoaDon,
                SoTien: 100, SoTienThucNhan: 100, TrangThaiPhieuThu: "Hợp lệ"
            }]
        })
    });
    try {
        const result = await invoke(harness, "post", "/api/payments/bank-transfer/notify", {
            body: payload,
            get: name => name === "x-payment-signature"
                ? createPaymentWebhookSignature(secret, payload)
                : undefined
        });
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.alreadyProcessed, true);
        assert.equal(harness.executions.filter(call =>
            call.procedure === "dbo.sp_GhiPhieuThu").length, 0);
        assert.equal(harness.executions.filter(call =>
            call.procedure === "dbo.sp_XacNhanPhieuThu").length, 0);
        assert.equal(harness.executions.filter(call =>
            call.procedure === "dbo.sp_KichHoatGiaHan").length, 0);
    } finally {
        if (previousSecret === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET;
        else process.env.PAYMENT_WEBHOOK_SECRET = previousSecret;
    }
});

test("financial list, report, and legacy routes enforce their intended access", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("FROM dbo.vw_DoanhThuThang")
            ? { recordset: [{
                Thang: 1,
                ThuTienPhong: 1200,
                ChiTienPhong: 200,
                DoanhThuTienPhong: 1000,
                ThuDichVu: 300,
                ChiDichVu: 50,
                DoanhThuDichVu: 250,
                ThuPhatSinh: 80,
                ChiPhatSinh: 0,
                DoanhThuPhatSinh: 80,
                DoanhThuDienNuocKhac: 250,
                TongThu: 1580,
                TongChi: 250,
                TongDoanhThu: 1330
            }] }
            : { recordset: [], rowsAffected: [1] }
    });
    for (const route of [
        "post /api/HoaDon/xuat-ky",
        "get /api/HoaDon",
        "get /api/HoaDon/:id",
        "get /api/doanhthu/:year",
        "put /api/HoaDon/:id/huy",
        "get /api/ChiPhiPhatSinh",
        "post /api/ChiPhiPhatSinh",
        "put /api/ChiPhiPhatSinh/:id",
        "put /api/ChiPhiPhatSinh/:id/huy",
        "post /api/ChiPhiPhatSinh/:id/tao-hoa-don",
        "post /api/HoaDon/:id/phieuthu",
        "get /api/phieuthu",
        "put /api/phieuthu/:id/xac-nhan",
        "put /api/phieuthu/:id/huy",
        "get /api/chitiethopdong/:id/goi-y-hoan-tien",
        "post /api/phieuchi",
        "get /api/phieuchi",
        "get /api/congno",
        "get /api/payments/history",
        "get /api/payments/qr",
        "post /api/payments/create",
        "post /api/payments/bank-transfer/notify",
        "post /api/payments/confirm/:transactionId",
        "post /api/payments/reject/:transactionId",
        "post /api/payments/surplus/:transactionId/return",
        "post /api/HoaDon",
        "put /api/HoaDon/:id",
        "put /api/HoaDon/:id/thanhtoan"
    ]) {
        assert.equal(harness.routes.has(route), true, `${route} is registered`);
    }

    const deniedDebt = await invoke(harness, "get", "/api/congno", {
        auth: { role: "Sinh viên", studentId: "SV001" }
    });
    assert.equal(deniedDebt.statusCode, 403);
    assert.equal(harness.queries.length, 0);

    const debt = await invoke(harness, "get", "/api/congno");
    assert.equal(debt.statusCode, 200);
    assert.match(harness.queries[0].statement, /vw_CongNo/);

    const revenue = await invoke(harness, "get", "/api/doanhthu/:year", {
        params: { year: "2026" }
    });
    assert.equal(revenue.statusCode, 200);
    assert.equal(revenue.body.thang.length, 12);
    assert.deepEqual(revenue.body.thang[0], {
        Nam: 2026,
        Thang: 1,
        ThuTienPhong: 1200,
        ChiTienPhong: 200,
        DoanhThuTienPhong: 1000,
        ThuDichVu: 300,
        ChiDichVu: 50,
        DoanhThuDichVu: 250,
        ThuPhatSinh: 80,
        ChiPhatSinh: 0,
        DoanhThuPhatSinh: 80,
        DoanhThuDienNuocKhac: 250,
        TongThu: 1580,
        TongChi: 250,
        TongDoanhThu: 1330,
        DoanhThuRong: 1330
    });
    assert.match(harness.queries[1].statement, /ThuPhatSinh/);

    const oldCreate = await invoke(harness, "post", "/api/HoaDon");
    assert.equal(oldCreate.statusCode, 410);
    const oldUpdate = await invoke(harness, "put", "/api/HoaDon/:id");
    assert.equal(oldUpdate.statusCode, 410);
    const directPayment = await invoke(harness, "put", "/api/HoaDon/:id/thanhtoan");
    assert.equal(directPayment.statusCode, 409);
});

test("non-representative room member can pay a service invoice and QR uses injected string parsing", async () => {
    const harness = fakeApi({
        queryResult: call => {
            if (call.statement.includes("FROM dbo.GiaoDichThanhToan gd")
                && call.statement.includes("gd.NoiDungCK")) {
                return { recordset: [{ MaGiaoDich: "PAY-TEST", NoiDungCK: "KTXABCDEF0123456789ABCD" }] };
            }
            if (call.statement.includes("SELECT hd.MaHoaDon, hd.TrangThaiThanhToan")) {
                return { recordset: [{
                    MaHoaDon: "INV2026100011", TrangThaiThanhToan: "Chưa thanh toán", ConNo: 300
                }] };
            }
            if (call.statement.includes("SELECT TOP (1) gd.MaGiaoDich")) return { recordset: [] };
            if (call.statement.includes("SELECT hd.MaHoaDon, total.TongThuc")) {
                return { recordset: [{
                    MaHoaDon: "INV2026100011", TongThuc: 300, ConNo: 300, SoKhoan: 1
                }] };
            }
            return { recordset: [], rowsAffected: [1] };
        },
        executeResult: call => call.procedure === "dbo.sp_GhiPhieuThu"
            ? { recordset: [{ MaPhieuThu: 95 }] }
            : { recordset: [] }
    });
    const previousConfig = {
        bankBin: process.env.PAYMENT_BANK_BIN,
        accountNumber: process.env.PAYMENT_BANK_ACCOUNT_NO,
        accountName: process.env.PAYMENT_BANK_ACCOUNT_NAME
    };
    Object.assign(process.env, {
        PAYMENT_BANK_BIN: "970415",
        PAYMENT_BANK_ACCOUNT_NO: "123456789012",
        PAYMENT_BANK_ACCOUNT_NAME: "KTX TEST"
    });
    try {
        const payment = await invoke(harness, "post", "/api/payments/create", {
            auth: { role: "Sinh viên", studentId: "SV002" },
            body: { MaHoaDon: "INV2026100011", SoTien: 300, PhuongThuc: "ONLINE" }
        });
        assert.equal(payment.statusCode, 201);
        assert.equal(harness.executions.at(-1).procedure, "dbo.sp_GhiPhieuThu");
        assert.equal(harness.executions.at(-1).inputs.MaSinhVienNop, "SV002");
        const ownerLookup = harness.queries.find(call =>
            call.statement.includes("ownerDetail.MaSinhVien = @MaSinhVien"));
        assert(ownerLookup);
        assert.match(ownerLookup.statement, /ownerDetail\.MaSinhVien = @MaSinhVien/);

        const qr = await invoke(harness, "get", "/api/payments/qr", {
            auth: { role: "Sinh viên", studentId: "SV002" },
            query: { MaHoaDon: "INV2026100011", SoTien: "300" }
        });
        assert.equal(qr.statusCode, 200);
        assert.equal(qr.body.TongTien, 300);
        assert.equal(qr.body.MaHoaDon, "INV2026100011");
    } finally {
        for (const [key, value] of Object.entries({
            PAYMENT_BANK_BIN: previousConfig.bankBin,
            PAYMENT_BANK_ACCOUNT_NO: previousConfig.accountNumber,
            PAYMENT_BANK_ACCOUNT_NAME: previousConfig.accountName
        })) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test("service invoice creation requires each active meter reading before calling the procedure", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("hpdv.CachTinh = N'CHI_SO'")
            ? { recordset: [{ MaDichVu: "DV_DIEN" }] }
            : { recordset: [], rowsAffected: [1] }
    });
    const body = {
        loaiHoaDon: "DICH_VU_PHONG",
        maHopDong: "HD00001",
        kyThanhToan: "2026-10-01"
    };
    const missing = await invoke(harness, "post", "/api/HoaDon/xuat-ky", { body });
    assert.equal(missing.statusCode, 400);
    assert.match(missing.body.message, /chỉ số cũ và mới/);
    assert.equal(harness.executions.length, 0);

    const created = await invoke(harness, "post", "/api/HoaDon/xuat-ky", {
        body: { ...body, chiSoDichVu: [{ maDichVu: "DV_DIEN", chiSoCu: 10, chiSoMoi: 12 }] }
    });
    assert.equal(created.statusCode, 201);
    assert.equal(harness.executions.at(-1).procedure, "dbo.sp_TaoHoaDonDichVuPhong");
    assert.deepEqual(JSON.parse(harness.executions.at(-1).inputs.ChiSoJson), [{
        maDichVu: "DV_DIEN", chiSoCu: 10, chiSoMoi: 12
    }]);
});

test("real SQL Server concurrency: two HTTP membership requests compete for one remaining place", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình kết nối SQL Server; không thể chạy kiểm thử đồng thời thật.");
    }
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    let contractId;
    const studentIds = [];
    try {
        const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
        assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 3,
            unassignedCount: 3,
            createOtherRoomStudent: false
        });
        studentIds.push(...fixture.studentIds);

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.auth = { accountId: fixture.managerId, role: "Quản lý" };
            next();
        });
        registerApiRoutes(app, {
            getPool: () => pool, sql, bcrypt: require("bcryptjs"),
            mapPaymentStatusToDatabase: value => value,
            mapPaymentMethodToDatabase: value => value,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const startDate = new Date().toISOString().slice(0, 10);
        const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const createResponse = await fetch(`${baseUrl}/api/HopDong`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            tenPhong: fixture.roomA, maHangPhong: fixture.tierId, ngayBatDau: startDate, ngayKetThuc: endDate,
                sinhVien: studentIds.slice(0, 3).map((maSinhVien, index) => ({
                    maSinhVien, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: index === 0
                }))
            })
        });
        const contractResponse = await createResponse.json();
        assert.equal(createResponse.status, 201, JSON.stringify(contractResponse));
        contractId = contractResponse.MaHopDong;

        const members = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaChiTiet, MaSinhVien, NgayVao
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
                ORDER BY NgayVao, MaChiTiet
            `);
        const memberA = members.recordset.find(member => member.MaSinhVien === studentIds[0]);
        const memberB = members.recordset.find(member => member.MaSinhVien === studentIds[1]);
        assert(memberA && memberB, "Both representative test members must be present.");
        const initialRepresentative = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaSinhVien, COUNT_BIG(*) OVER () AS SoDaiDien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
                  AND LaNguoiDaiDienThanhToanDichVu = 1
            `);
        assert.equal(Number(initialRepresentative.recordset[0]?.SoDaiDien), 1);
        assert.equal(initialRepresentative.recordset[0]?.MaSinhVien, studentIds[0]);

        const changeRepresentativeResponse = await fetch(`${baseUrl}/api/HopDong/${contractId}/dai-dien`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ maChiTiet: memberB.MaChiTiet })
        });
        assert.equal(changeRepresentativeResponse.status, 200);
        const representativeAfterChange = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaSinhVien, COUNT_BIG(*) OVER () AS SoDaiDien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
                  AND LaNguoiDaiDienThanhToanDichVu = 1
            `);
        assert.equal(Number(representativeAfterChange.recordset[0]?.SoDaiDien), 1);
        assert.equal(representativeAfterChange.recordset[0]?.MaSinhVien, studentIds[1]);
        t.diagnostic(
            `Representative change A -> B: student ${studentIds.indexOf(representativeAfterChange.recordset[0].MaSinhVien) + 1}; exactly one representative.`
        );

        const expectedRepresentativeAfterLeave = members.recordset
            .filter(member => member.MaSinhVien !== studentIds[1])
            .sort((left, right) => left.NgayVao - right.NgayVao || left.MaChiTiet - right.MaChiTiet)[0]
            .MaSinhVien;
        const leaveResponse = await fetch(`${baseUrl}/api/HopDong/${contractId}/chitiet/${memberB.MaChiTiet}/roi`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });
        assert.equal(leaveResponse.status, 200);
        const representativeAfterLeave = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaSinhVien, COUNT_BIG(*) OVER () AS SoDaiDien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
                  AND LaNguoiDaiDienThanhToanDichVu = 1
            `);
        assert.equal(Number(representativeAfterLeave.recordset[0]?.SoDaiDien), 1);
        assert.equal(representativeAfterLeave.recordset[0]?.MaSinhVien, expectedRepresentativeAfterLeave);
        t.diagnostic(
            `Representative after B leaves: student ${studentIds.indexOf(representativeAfterLeave.recordset[0].MaSinhVien) + 1}.`
        );

        const addOne = await fetch(`${baseUrl}/api/HopDong/${contractId}/chitiet`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ maSinhVien: studentIds[3], kyHanThanhToanPhong: "THANG" })
        });
        assert.equal(addOne.status, 201);

        const concurrent = await Promise.all(studentIds.slice(4).map(maSinhVien => fetch(
            `${baseUrl}/api/HopDong/${contractId}/chitiet`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maSinhVien, kyHanThanhToanPhong: "THANG" })
            }
        ).then(async response => ({ status: response.status, body: await response.json() }))));
        console.log(`[B4 concurrent] ${JSON.stringify(concurrent)}`);
        assert.equal(concurrent.filter(result => result.status === 201).length, 1);
        assert.equal(concurrent.filter(result => result.status === 409).length, 1);
        const finalCount = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT COUNT_BIG(*) AS SoThanhVien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
            `);
        assert.equal(Number(finalCount.recordset[0].SoThanhVien), 4);
        t.diagnostic(`Concurrent API responses: ${JSON.stringify(concurrent)}`);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool.connected) {
            const cleanup = new sql.Transaction(pool);
            await cleanup.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            try {
                if (contractId) {
                    await deleteContractInvoices(cleanup, sql, contractId);
                    await new sql.Request(cleanup)
                        .input("MaHopDong", sql.NVarChar(20), contractId)
                        .query("DELETE FROM dbo.ChiTietHopDong WHERE MaHopDong = @MaHopDong");
                    await new sql.Request(cleanup)
                        .input("MaHopDong", sql.NVarChar(20), contractId)
                        .query("DELETE FROM dbo.HopDong WHERE MaHopDong = @MaHopDong");
                    await new sql.Request(cleanup)
                        .input("MaDoiTuong", sql.NVarChar(60), contractId)
                        .query("DELETE FROM dbo.NhatKyHeThong WHERE MaDoiTuong = @MaDoiTuong");
                }
                if (fixture) {
                    await new sql.Request(cleanup)
                        .input("ManagerId", sql.Int, fixture.managerId)
                        .query("DELETE FROM dbo.NhatKyHeThong WHERE MaTaiKhoan = @ManagerId");
                }
                for (const studentId of studentIds) {
                    await new sql.Request(cleanup)
                        .input("MaSinhVien", sql.NVarChar(30), studentId)
                        .query("DELETE FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien");
                }
                if (fixture) {
                    for (const roomName of [fixture.roomA, fixture.roomB]) {
                        await new sql.Request(cleanup)
                            .input("TenPhong", sql.NVarChar(50), roomName)
                            .query("DELETE FROM dbo.Phong WHERE TenPhong = @TenPhong");
                    }
                    await new sql.Request(cleanup)
                        .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                        .input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
                        .query("DELETE FROM dbo.HangPhong_DichVu WHERE MaHangPhong = @MaHangPhong AND MaDichVu = @MaDichVu");
                    await new sql.Request(cleanup)
                        .input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
                        .query("DELETE FROM dbo.DichVu WHERE MaDichVu = @MaDichVu");
                    await new sql.Request(cleanup)
                        .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                        .query("DELETE FROM dbo.HangPhong WHERE MaHangPhong = @MaHangPhong");
                    await new sql.Request(cleanup)
                        .input("ManagerId", sql.Int, fixture.managerId)
                        .query("DELETE FROM dbo.TaiKhoan WHERE MaTaiKhoan = @ManagerId");
                }
                await cleanup.commit();
            } catch (error) {
                await cleanup.rollback();
                throw error;
            }
            await pool.close();
        }
    }
});

test("real SQL registration, login, room-gender contracts and wrong-gender rejection work end to end", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình kết nối SQL Server; không thể chạy kiểm thử đăng ký thật.");
    }
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    const contractIds = [];
    const registrationInputs = [];
    try {
        const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
        assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 0,
            createOtherRoomStudent: false
        });
        await pool.request().input("TenPhong", sql.NVarChar(50), fixture.roomB)
            .query("UPDATE dbo.Phong SET LoaiPhong = N'Nữ' WHERE TenPhong = @TenPhong");
        const genders = ["Nam", "Nam", "Nữ", "Nữ"];
        const baseStudentId = String(Date.now()).slice(-12);
        for (let index = 0; index < genders.length; index++) {
            const studentId = String(Number(baseStudentId) + index).padStart(12, "0").slice(-12);
            const phoneDigits = fixture.tierId.replace(/\D/g, "").slice(-7).padStart(7, "0");
            const phone = `09${[3, 5, 7, 8][index]}${phoneDigits}`;
            const email = `${studentId.toLowerCase()}@gmail.com`;
            registrationInputs.push({ studentId, phone, email, gender: genders[index] });
        }

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.auth = { accountId: fixture.managerId, role: "Quản lý" };
            next();
        });
        app.post("/api/student/register", createRegistrationHandler({
            getPool: () => pool, sql, bcrypt,
            logDatabaseError: (operation, error) => console.error(operation, error.number || error.code)
        }));
        app.post("/api/login", createLoginHandler({
            getPool: () => pool, sql, bcrypt, jwt,
            getSecret: () => "e2e-test-only-signing-secret",
            getExpiresIn: () => "15m",
            logDatabaseError: (operation, error) => console.error(operation, error.number || error.code)
        }));
        registerApiRoutes(app, {
            getPool: () => pool, sql, bcrypt,
            mapPaymentStatusToDatabase: value => value,
            mapPaymentMethodToDatabase: value => value,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        for (let index = 0; index < registrationInputs.length; index++) {
            const student = registrationInputs[index];
            const response = await fetch(`${baseUrl}/api/student/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    MaSinhVien: student.studentId,
                    HoTen: `E2E ${student.studentId}`,
                    NgaySinh: "2005-01-01",
                    GioiTinh: student.gender,
                    SoDienThoai: student.phone,
                    Email: student.email,
                    DiaChi: "Ký túc xá E2E",
                    Truong: "Trường E2E",
                    Lop: "E2E01",
                    MatKhau: "e2e-valid-password"
                })
            });
            const result = await response.json();
            assert.equal(response.status, 201, JSON.stringify(result));
        }

        const firstStudent = registrationInputs[0];
        const loginResponse = await fetch(`${baseUrl}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ Email: firstStudent.email, MatKhau: "e2e-valid-password" })
        });
        const login = await loginResponse.json();
        assert.equal(loginResponse.status, 200, JSON.stringify(login));
        assert.equal(jwt.verify(login.token, "e2e-test-only-signing-secret").studentId, firstStudent.studentId);

        const startDate = new Date().toISOString().slice(0, 10);
        const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const createContract = async (room, students) => {
            const response = await fetch(`${baseUrl}/api/HopDong`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenPhong: room, maHangPhong: fixture.tierId,
                    ngayBatDau: startDate, ngayKetThuc: endDate,
                    sinhVien: students.map(student => ({
                        maSinhVien: student.studentId, kyHanThanhToanPhong: "THANG"
                    }))
                })
            });
            return { status: response.status, body: await response.json() };
        };
        const wrongGender = await createContract(fixture.roomA, [registrationInputs[2]]);
        assert.equal(wrongGender.status, 409);
        assert.equal(wrongGender.body.message, "Giới tính sinh viên không phù hợp với phòng.");
        const maleContract = await createContract(fixture.roomA, registrationInputs.slice(0, 2));
        assert.equal(maleContract.status, 201, JSON.stringify(maleContract.body));
        contractIds.push(maleContract.body.MaHopDong);
        const femaleContract = await createContract(fixture.roomB, registrationInputs.slice(2));
        assert.equal(femaleContract.status, 201, JSON.stringify(femaleContract.body));
        contractIds.push(femaleContract.body.MaHopDong);
        t.diagnostic(`Registered 4 students through HTTP (2 Nam, 2 Nữ); login token scoped to ${firstStudent.studentId}; two matching-gender room contracts created; wrong-gender HTTP response=${wrongGender.status}/${wrongGender.body.message}.`);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool.connected) {
            const cleanup = new sql.Transaction(pool);
            await cleanup.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            try {
                for (const contractId of contractIds) {
                    await deleteContractInvoices(cleanup, sql, contractId);
                    await new sql.Request(cleanup).input("MaHopDong", sql.NVarChar(20), contractId)
                        .query("DELETE FROM dbo.ChiTietHopDong WHERE MaHopDong = @MaHopDong");
                    await new sql.Request(cleanup).input("MaHopDong", sql.NVarChar(20), contractId)
                        .query("DELETE FROM dbo.HopDong WHERE MaHopDong = @MaHopDong");
                    await new sql.Request(cleanup).input("MaDoiTuong", sql.NVarChar(60), contractId)
                        .query("DELETE FROM dbo.NhatKyHeThong WHERE MaDoiTuong = @MaDoiTuong");
                }
                if (fixture) {
                    await new sql.Request(cleanup).input("ManagerId", sql.Int, fixture.managerId)
                        .query("DELETE FROM dbo.NhatKyHeThong WHERE MaTaiKhoan = @ManagerId");
                    for (const student of registrationInputs) {
                        await new sql.Request(cleanup).input("MaSinhVien", sql.NVarChar(30), student.studentId)
                            .query("DELETE FROM dbo.TaiKhoan WHERE MaSinhVien = @MaSinhVien");
                        await new sql.Request(cleanup).input("MaSinhVien", sql.NVarChar(30), student.studentId)
                            .query("DELETE FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien");
                    }
                    for (const roomName of [fixture.roomA, fixture.roomB]) {
                        await new sql.Request(cleanup).input("TenPhong", sql.NVarChar(50), roomName)
                            .query("DELETE FROM dbo.Phong WHERE TenPhong = @TenPhong");
                    }
                    await new sql.Request(cleanup)
                        .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                        .input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
                        .query("DELETE FROM dbo.HangPhong_DichVu WHERE MaHangPhong = @MaHangPhong AND MaDichVu = @MaDichVu");
                    await new sql.Request(cleanup).input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
                        .query("DELETE FROM dbo.DichVu WHERE MaDichVu = @MaDichVu");
                    await new sql.Request(cleanup).input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                        .query("DELETE FROM dbo.HangPhong WHERE MaHangPhong = @MaHangPhong");
                    await new sql.Request(cleanup).input("ManagerId", sql.Int, fixture.managerId)
                        .query("DELETE FROM dbo.TaiKhoan WHERE MaTaiKhoan = @ManagerId");
                }
                await cleanup.commit();
            } catch (error) {
                await cleanup.rollback();
                throw error;
            }
            await pool.close();
        }
    }
});

test("real SQL Server contract APIs distinguish missing, wrong-gender, occupied, and full-room cases", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình kết nối SQL Server; không thể chạy kiểm thử giới tính phòng thật.");
    }
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    let roomC;
    const studentIds = [];
    let contractId;
    try {
        const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
        assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 4,
            createOtherRoomStudent: false
        });
        studentIds.push(...fixture.studentIds);
        const femaleStudent = `${fixture.studentIds[0]}F`;
        const overflowStudent = `${fixture.studentIds[0]}O`;
        studentIds.push(femaleStudent, overflowStudent);
        roomC = `${fixture.roomA}-C`;
        await pool.request().input("TenPhong", sql.NVarChar(50), fixture.roomB)
            .query("UPDATE dbo.Phong SET LoaiPhong = N'Nữ' WHERE TenPhong = @TenPhong");
        await pool.request().input("TenPhong", sql.NVarChar(50), roomC)
            .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
            .query(`
                INSERT INTO dbo.Phong
                    (TenPhong, Khu, LoaiPhong, SucChuaToiDa, MaHangPhong,
                     SoSinhVienHienTai, TrangThaiPhong, GhiChu)
                VALUES (@TenPhong, N'C', N'Nam', 4, @MaHangPhong, 0, N'Trống', N'B5 gender E2E fixture')
            `);
        await pool.request()
            .input("FemaleId", sql.NVarChar(30), femaleStudent)
            .input("OverflowId", sql.NVarChar(30), overflowStudent)
            .query(`
                INSERT INTO dbo.SinhVien (MaSinhVien, HoTen, GioiTinh, TrangThaiSinhVien)
                VALUES (@FemaleId, @FemaleId, N'Nữ', NULL), (@OverflowId, @OverflowId, N'Nam', NULL)
            `);

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.auth = { accountId: fixture.managerId, role: "Quản lý" };
            next();
        });
        registerApiRoutes(app, {
            getPool: () => pool, sql, bcrypt: require("bcryptjs"),
            mapPaymentStatusToDatabase: value => value,
            mapPaymentMethodToDatabase: value => value,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const startDate = new Date().toISOString().slice(0, 10);
        const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const createContract = async (room, students) => {
            const response = await fetch(`${baseUrl}/api/HopDong`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenPhong: room, maHangPhong: fixture.tierId,
                    ngayBatDau: startDate, ngayKetThuc: endDate,
                    sinhVien: students.map(maSinhVien => ({
                        maSinhVien, kyHanThanhToanPhong: "THANG"
                    }))
                })
            });
            return { status: response.status, body: await response.json() };
        };
        const missing = await createContract(fixture.roomA, ["NO_SUCH_STUDENT"]);
        assert.equal(missing.status, 404);
        assert.equal(missing.body.message, "Không tìm thấy sinh viên.");
        const wrongGender = await createContract(fixture.roomA, [femaleStudent]);
        assert.equal(wrongGender.status, 409);
        assert.equal(wrongGender.body.message, "Giới tính sinh viên không phù hợp với phòng.");

        const created = await createContract(fixture.roomA, fixture.studentIds);
        assert.equal(created.status, 201, JSON.stringify(created.body));
        contractId = created.body.MaHopDong;
        const full = await fetch(`${baseUrl}/api/HopDong/${encodeURIComponent(contractId)}/chitiet`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ maSinhVien: overflowStudent, kyHanThanhToanPhong: "THANG" })
        });
        const fullBody = await full.json();
        assert.equal(full.status, 409);
        assert.equal(fullBody.message, "Phòng đã đủ sức chứa.");

        const occupiedElsewhere = await createContract(roomC, [fixture.studentIds[0]]);
        assert.equal(occupiedElsewhere.status, 409);
        assert.equal(occupiedElsewhere.body.message, "Sinh viên đang ở tại phòng hoặc hợp đồng khác.");
        t.diagnostic(`SQL-backed HTTP results: missing=${missing.status}/${missing.body.message}; wrong-gender=${wrongGender.status}/${wrongGender.body.message}; full=${full.status}/${fullBody.message}; occupied=${occupiedElsewhere.status}/${occupiedElsewhere.body.message}`);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool.connected) {
            const cleanup = new sql.Transaction(pool);
            await cleanup.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            try {
                if (contractId) {
                    await deleteContractInvoices(cleanup, sql, contractId);
                    await new sql.Request(cleanup).input("MaHopDong", sql.NVarChar(20), contractId)
                        .query("DELETE FROM dbo.ChiTietHopDong WHERE MaHopDong = @MaHopDong");
                    await new sql.Request(cleanup).input("MaHopDong", sql.NVarChar(20), contractId)
                        .query("DELETE FROM dbo.HopDong WHERE MaHopDong = @MaHopDong");
                    await new sql.Request(cleanup).input("MaDoiTuong", sql.NVarChar(60), contractId)
                        .query("DELETE FROM dbo.NhatKyHeThong WHERE MaDoiTuong = @MaDoiTuong");
                }
                if (fixture) {
                    await new sql.Request(cleanup).input("ManagerId", sql.Int, fixture.managerId)
                        .query("DELETE FROM dbo.NhatKyHeThong WHERE MaTaiKhoan = @ManagerId");
                }
                for (const studentId of studentIds) {
                    await new sql.Request(cleanup).input("MaSinhVien", sql.NVarChar(30), studentId)
                        .query("DELETE FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien");
                }
                if (fixture) {
                    for (const roomName of [fixture.roomA, fixture.roomB, roomC].filter(Boolean)) {
                        await new sql.Request(cleanup).input("TenPhong", sql.NVarChar(50), roomName)
                            .query("DELETE FROM dbo.Phong WHERE TenPhong = @TenPhong");
                    }
                    await new sql.Request(cleanup)
                        .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                        .input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
                        .query("DELETE FROM dbo.HangPhong_DichVu WHERE MaHangPhong = @MaHangPhong AND MaDichVu = @MaDichVu");
                    await new sql.Request(cleanup).input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
                        .query("DELETE FROM dbo.DichVu WHERE MaDichVu = @MaDichVu");
                    await new sql.Request(cleanup).input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                        .query("DELETE FROM dbo.HangPhong WHERE MaHangPhong = @MaHangPhong");
                    await new sql.Request(cleanup).input("ManagerId", sql.Int, fixture.managerId)
                        .query("DELETE FROM dbo.TaiKhoan WHERE MaTaiKhoan = @ManagerId");
                }
                await cleanup.commit();
            } catch (error) {
                await cleanup.rollback();
                throw error;
            }
            await pool.close();
        }
    }
});

test("real SQL Server money APIs enforce room ownership and webhook idempotency", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình kết nối SQL Server; không thể chạy kiểm thử tiền thật.");
    }
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    const originalEnvironment = {
        PAYMENT_BANK_BIN: process.env.PAYMENT_BANK_BIN,
        PAYMENT_BANK_ACCOUNT_NO: process.env.PAYMENT_BANK_ACCOUNT_NO,
        PAYMENT_BANK_ACCOUNT_NAME: process.env.PAYMENT_BANK_ACCOUNT_NAME,
        PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
        ALLOW_DEMO_PAYMENT: process.env.ALLOW_DEMO_PAYMENT
    };
    const restoreEnvironment = () => {
        for (const [key, value] of Object.entries(originalEnvironment)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    };

    try {
        const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
        assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 3,
            createOtherRoomStudent: true
        });
        const [departingStudent, nextRepresentative, payer, otherRoomStudent] = fixture.studentIds;
        const studentAccountIds = new Map();
        for (const studentId of fixture.studentIds) {
            const account = await pool.request()
                .input("Email", sql.VarChar(100), `${studentId.toLowerCase()}@gmail.com`)
                .input("TenHienThi", sql.NVarChar(100), `B5 student ${studentId}`)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    INSERT INTO dbo.TaiKhoan (Email, MatKhau, TenHienThi, VaiTro, MaSinhVien)
                    OUTPUT inserted.MaTaiKhoan
                    VALUES (@Email, 'test-only-not-authenticated', @TenHienThi, N'Sinh viên', @MaSinhVien)
                `);
            studentAccountIds.set(studentId, account.recordset[0].MaTaiKhoan);
        }
        const startDate = new Date(Date.UTC(
            new Date().getUTCFullYear(), new Date().getUTCMonth(), 1
        ));
        const periodText = startDate.toISOString().slice(0, 10);
        const endDate = new Date(Date.UTC(
            startDate.getUTCFullYear() + 3, startDate.getUTCMonth(), startDate.getUTCDate()
        )).toISOString().slice(0, 10);

        const secret = `test-${crypto.randomBytes(24).toString("hex")}`;
        const authSecret = `api-${crypto.randomBytes(24).toString("hex")}`;
        Object.assign(process.env, {
            PAYMENT_BANK_BIN: "970415",
            PAYMENT_BANK_ACCOUNT_NO: "123456789012",
            PAYMENT_BANK_ACCOUNT_NAME: "KTX TEST",
            PAYMENT_WEBHOOK_SECRET: secret,
            ALLOW_DEMO_PAYMENT: "true"
        });

        const app = express();
        app.use(express.json());
        app.use("/api", createApiAuthenticationMiddleware({ jwt, getSecret: () => authSecret }));
        registerApiRoutes(app, {
            getPool: () => pool,
            sql,
            bcrypt: require("bcryptjs"),
            mapPaymentStatusToDatabase: value => ({
                PENDING: "PENDING",
                WAITING_CASH: "Chờ xác nhận",
                SUCCESS: "SUCCESS",
                REJECTED: "REJECTED",
                EXPIRED: "EXPIRED",
                "Cần đối soát": "RECONCILIATION",
                "Hợp lệ": "Hợp lệ",
                "Chờ xác nhận": "Chờ xác nhận",
                "Đã hủy": "Đã hủy"
            })[value] || null,
            mapPaymentMethodToDatabase: value => ({
                CASH: "CASH",
                ONLINE: "ONLINE",
                CHUYEN_DOI: "CHUYEN_DOI"
            })[value] || null,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });

        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const call = async (method, route, role, studentId, body) => {
            const headers = {};
            if (body !== undefined) headers["Content-Type"] = "application/json";
            if (role) {
                const payload = role === "manager"
                    ? { sub: String(fixture.managerId), role: "Quản lý" }
                    : role === "admin"
                        ? { sub: String(fixture.managerId), role: "Admin" }
                        : { sub: String(studentAccountIds.get(studentId)), role: "Sinh viên", studentId };
                headers.Authorization = `Bearer ${jwt.sign(payload, authSecret)}`;
            }
            const response = await fetch(`${baseUrl}${route}`, {
                method,
                headers,
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };

        const { createPaymentWebhookSignature } = require("./payment-webhook");
        const webhookCall = async (payload, signature) => {
            const response = await fetch(`${baseUrl}/api/payments/bank-transfer/notify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-payment-signature": signature || createPaymentWebhookSignature(secret, payload)
                },
                body: JSON.stringify(payload)
            });
            return { status: response.status, body: await response.json() };
        };

        const contractResponse = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: periodText,
            ngayKetThuc: endDate,
            sinhVien: [
                { maSinhVien: departingStudent, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: true },
                { maSinhVien: nextRepresentative, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: false },
                { maSinhVien: payer, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: false }
            ]
        });
        assert.equal(contractResponse.status, 201, JSON.stringify(contractResponse.body));
        const contractId = contractResponse.body.MaHopDong;
        const testWebhookAmountMismatch = async (testName, monthOffset, amountDelta) => {
            const invoicePeriodDate = new Date(`${periodText}T00:00:00.000Z`);
            invoicePeriodDate.setUTCMonth(invoicePeriodDate.getUTCMonth() + monthOffset);
            const invoicePeriod = invoicePeriodDate.toISOString().slice(0, 10);
            const invoiceResponse = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
                loaiHoaDon: "DICH_VU_PHONG", maHopDong: contractId, kyThanhToan: invoicePeriod
            });
            assert.equal(invoiceResponse.status, 201, JSON.stringify(invoiceResponse.body));
            const invoiceId = invoiceResponse.body.MaHoaDon;
            const totalResult = await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .query("SELECT TongThuc FROM dbo.vw_HoaDonTongHop WHERE MaHoaDon = @MaHoaDon");
            const invoiceTotal = Number(totalResult.recordset[0].TongThuc);
            const paymentRequest = await call("POST", "/api/payments/create", "student", payer, {
                MaHoaDon: invoiceId, SoTien: invoiceTotal, PhuongThuc: "ONLINE"
            });
            assert.equal(paymentRequest.status, 201, JSON.stringify(paymentRequest.body));
            await t.test(testName, async () => {
                const payload = {
                    MaHoaDon: invoiceId,
                    SoTien: invoiceTotal + amountDelta,
                    MaThamChieuNgoai: `B5-AMOUNT-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
                    NoiDungCK: paymentRequest.body.NoiDungCK
                };
                const response = await webhookCall(payload);
                assert.equal(response.status, 200, JSON.stringify(response.body));
                assert.equal(response.body.needsReconciliation, true);
                const persisted = await pool.request()
                    .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                    .input("MaThamChieuNgoai", sql.NVarChar(100), payload.MaThamChieuNgoai)
                    .query(`
                        SELECT gd.TrangThai, gd.SoTienThucNhan, pt.TrangThai AS TrangThaiPhieuThu,
                               hd.TrangThaiThanhToan, total.DaThu, total.ConNo,
                               (SELECT COUNT_BIG(*) FROM dbo.PhieuThu valid
                                WHERE valid.MaHoaDon = hd.MaHoaDon AND valid.TrangThai = N'Hợp lệ') AS SoPhieuThuHopLe
                        FROM dbo.GiaoDichThanhToan gd
                        INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                        INNER JOIN dbo.vw_HoaDonTongHop total ON total.MaHoaDon = hd.MaHoaDon
                        WHERE hd.MaHoaDon = @MaHoaDon AND gd.MaThamChieuNgoai = @MaThamChieuNgoai
                    `);
                assert.equal(persisted.recordset[0].TrangThai, "RECONCILIATION");
                assert.equal(persisted.recordset[0].TrangThaiPhieuThu, "Đã hủy");
                assert.equal(Number(persisted.recordset[0].SoTienThucNhan), invoiceTotal + amountDelta);
                assert.equal(persisted.recordset[0].TrangThaiThanhToan, "Chưa thanh toán");
                assert.equal(Number(persisted.recordset[0].DaThu), 0);
                assert.equal(Number(persisted.recordset[0].ConNo), invoiceTotal);
                assert.equal(Number(persisted.recordset[0].SoPhieuThuHopLe), 0);
            });
        };
        await testWebhookAmountMismatch(
            "real SQL webhook underpayment creates reconciliation only, without a valid receipt", 18, -1
        );
        await testWebhookAmountMismatch(
            "real SQL webhook overpayment creates reconciliation only, without a valid receipt", 19, 1
        );
        const rentInvoicesByStudent = new Map((contractResponse.body.HoaDonTienPhong || [])
            .map(invoice => [invoice.MaSinhVien, invoice.MaHoaDon]));
        assert.equal(rentInvoicesByStudent.size, 3);
        const otherContractResponse = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomB,
            maHangPhong: fixture.tierId,
            ngayBatDau: periodText,
            ngayKetThuc: endDate,
            sinhVien: [{
                maSinhVien: otherRoomStudent, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: true
            }]
        });
        assert.equal(otherContractResponse.status, 201, JSON.stringify(otherContractResponse.body));
        const otherContractId = otherContractResponse.body.MaHopDong;
        const otherRoomInvoiceId = (otherContractResponse.body.HoaDonTienPhong || [])
            .find(invoice => invoice.MaSinhVien === otherRoomStudent)?.MaHoaDon;
        assert.ok(otherRoomInvoiceId);
        const memberResult = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaChiTiet, MaSinhVien, LaNguoiDaiDienThanhToanDichVu
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
            `);
        const members = new Map(memberResult.recordset.map(member => [member.MaSinhVien, member]));
        const departingMember = members.get(departingStudent);
        const payerMember = members.get(payer);
        assert(departingMember && payerMember);
        assert.equal(payerMember.LaNguoiDaiDienThanhToanDichVu, false);

        const rentInvoiceId = rentInvoicesByStudent.get(departingStudent);
        assert.ok(rentInvoiceId);

        const leaveResponse = await call(
            "PUT",
            `/api/HopDong/${contractId}/chitiet/${departingMember.MaChiTiet}/roi`,
            "manager",
            null,
            {}
        );
        assert.equal(leaveResponse.status, 200, JSON.stringify(leaveResponse.body));
        const rentAfterLeaving = await call("GET", `/api/HoaDon/${rentInvoiceId}`, "student", departingStudent);
        assert.equal(rentAfterLeaving.status, 200, JSON.stringify(rentAfterLeaving.body));
        assert(Number(rentAfterLeaving.body.ConNo) > 0);

        const serviceInvoiceResponse = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
            loaiHoaDon: "DICH_VU_PHONG",
            maHopDong: contractId,
            kyThanhToan: periodText
        });
        assert.equal(serviceInvoiceResponse.status, 201, JSON.stringify(serviceInvoiceResponse.body));
        const serviceInvoiceId = serviceInvoiceResponse.body.MaHoaDon;
        const totalResult = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), serviceInvoiceId)
            .query(`
                SELECT hd.LoaiHoaDon, v.TongThuc, v.DaThu, v.ConNo
                FROM dbo.HoaDon hd
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                WHERE hd.MaHoaDon = @MaHoaDon
            `);
        assert.equal(totalResult.recordset[0].LoaiHoaDon, "DICH_VU_PHONG");
        const total = Number(totalResult.recordset[0].TongThuc);
        assert(Number.isSafeInteger(total) && total > 1);

        const formerMemberCannotViewService = await call(
            "GET", `/api/HoaDon/${serviceInvoiceId}`, "student", departingStudent
        );
        assert.equal(formerMemberCannotViewService.status, 404);
        const expenseResponse = await call("POST", "/api/ChiPhiPhatSinh", "manager", null, {
            maHopDong: contractId,
            maChiTiet: payerMember.MaChiTiet,
            noiDung: `B5 isolated incident ${fixture.tierId}`,
            soTien: 200,
            ngayPhatSinh: periodText,
            hanDong: periodText,
            cheDoLap: "RIENG"
        });
        assert.equal(expenseResponse.status, 201, JSON.stringify(expenseResponse.body));
        const expenseNotices = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `INVOICE:${expenseResponse.body.MaHoaDon}`)
            .query("SELECT MaSinhVien, TieuDe, NoiDung FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.deepEqual(expenseNotices.recordset.map(row => row.MaSinhVien), [payer]);
        assert.match(expenseNotices.recordset[0].TieuDe, /^Hóa đơn phát sinh/);
        assert.match(expenseNotices.recordset[0].NoiDung, /hạn đóng/);
        const beforeIncidentInvoice = await call("GET", "/api/HoaDon", "student", payer);
        assert.equal(beforeIncidentInvoice.body.some(invoice =>
            invoice.MaHoaDon === expenseResponse.body.MaHoaDon), true);
        const anotherRoomMemberNotices = await call(
            "GET", "/api/student/notifications", "student", departingStudent
        );
        assert.equal(anotherRoomMemberNotices.status, 200);
        assert.equal(anotherRoomMemberNotices.body.some(row =>
            row.TieuDe.includes(`B5 isolated incident ${fixture.tierId}`)), false);
        const incidentInvoiceId = expenseResponse.body.MaHoaDon;
        const incidentForPayer = await call("GET", "/api/HoaDon", "student", payer);
        assert.equal(incidentForPayer.status, 200);
        const payerIncident = incidentForPayer.body.find(invoice => invoice.MaHoaDon === incidentInvoiceId);
        assert.ok(payerIncident);
        assert.equal(payerIncident.LoaiHoaDon, "PHAT_SINH");
        assert.equal(Number(payerIncident.TongTien), 200);
        assert.equal(payerIncident.HanThanhToan, periodText);
        const incidentForRoommate = await call("GET", "/api/HoaDon", "student", nextRepresentative);
        assert.equal(incidentForRoommate.status, 200);
        assert.equal(incidentForRoommate.body.some(invoice => invoice.MaHoaDon === incidentInvoiceId), false);

        const nextServicePeriod = new Date(`${periodText}T00:00:00.000Z`);
        nextServicePeriod.setUTCMonth(nextServicePeriod.getUTCMonth() + 1);
        const paidServicePeriodText = nextServicePeriod.toISOString().slice(0, 10);
        const paidServiceInvoiceResponse = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
            loaiHoaDon: "DICH_VU_PHONG", maHopDong: contractId, kyThanhToan: paidServicePeriodText
        });
        assert.equal(paidServiceInvoiceResponse.status, 201, JSON.stringify(paidServiceInvoiceResponse.body));
        const paidServiceInvoiceId = paidServiceInvoiceResponse.body.MaHoaDon;
        const paidServiceTotalResult = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), paidServiceInvoiceId)
            .query("SELECT TongThuc FROM dbo.vw_HoaDonTongHop WHERE MaHoaDon = @MaHoaDon");
        const paidServiceTotal = Number(paidServiceTotalResult.recordset[0].TongThuc);
        const payServiceInvoice = await call("POST", `/api/HoaDon/${paidServiceInvoiceId}/phieuthu`,
            "manager", null, {
                soTien: paidServiceTotal, phuongThuc: "CASH", trangThai: "Hợp lệ",
                maSinhVienNop: payer
            });
        assert.equal(payServiceInvoice.status, 201, JSON.stringify(payServiceInvoice.body));

        const mergeMigration = await pool.request()
            .query("SELECT COUNT_BIG(*) AS Applied FROM dbo.SchemaMigration WHERE MaMigration = N'031'");
        assert.equal(Number(mergeMigration.recordset[0].Applied), 1,
            "Migration 031 chưa áp dụng trên KTX_Group3_test; không thể kiểm thử chi phí chờ gộp.");

        const roomExpense = await call("POST", "/api/ChiPhiPhatSinh", "manager", null, {
            maHopDong: contractId,
            noiDung: `B5 room incident ${fixture.tierId}`,
            soTien: 1000,
            ngayPhatSinh: periodText,
            hanDong: periodText,
            cheDoLap: "GOP"
        });
        assert.equal(roomExpense.status, 201, JSON.stringify(roomExpense.body));
        const roomExpenseNotices = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `EXPENSE:${roomExpense.body.MaChiPhi}`)
            .query("SELECT MaSinhVien, TieuDe, NoiDung FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.equal(roomExpenseNotices.recordset.length, 0);
        const pendingRoomCost = await pool.request()
            .input("MaChiPhi", sql.BigInt, roomExpense.body.MaChiPhi)
            .query("SELECT TrangThai FROM dbo.ChiPhiPhatSinh WHERE MaChiPhi = @MaChiPhi");
        assert.equal(pendingRoomCost.recordset[0].TrangThai, "Chờ gộp");
        const paidInvoiceLinesBefore = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), paidServiceInvoiceId)
            .query("SELECT COUNT_BIG(*) AS IncidentLines FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @MaHoaDon AND MaKhoan = N'INCIDENT'");
        assert.equal(Number(paidInvoiceLinesBefore.recordset[0].IncidentLines), 0);
        const paidPeriodCannotBeReissued = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
            loaiHoaDon: "DICH_VU_PHONG", maHopDong: contractId, kyThanhToan: paidServicePeriodText
        });
        await t.test("real SQL refuses to merge incident costs into an already-paid service-period invoice", async () => {
            assert.equal(paidPeriodCannotBeReissued.status, 409);
            const linesAfterAttempt = await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), paidServiceInvoiceId)
                .query("SELECT COUNT_BIG(*) AS IncidentLines FROM dbo.ChiTietHoaDon WHERE MaHoaDon = @MaHoaDon AND MaKhoan = N'INCIDENT'");
            assert.equal(Number(linesAfterAttempt.recordset[0].IncidentLines), 0);
        });
        const mergedServicePeriod = new Date(`${periodText}T00:00:00.000Z`);
        mergedServicePeriod.setUTCMonth(mergedServicePeriod.getUTCMonth() + 2);
        const mergedServicePeriodText = mergedServicePeriod.toISOString().slice(0, 10);
        const roomInvoiceResponse = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
            loaiHoaDon: "DICH_VU_PHONG", maHopDong: contractId, kyThanhToan: mergedServicePeriodText
        });
        assert.equal(roomInvoiceResponse.status, 201, JSON.stringify(roomInvoiceResponse.body));
        const roomInvoiceId = roomInvoiceResponse.body.MaHoaDon;
        const roomInvoiceLines = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), roomInvoiceId)
            .query(`
                SELECT TenKhoan, SoTien
                FROM dbo.ChiTietHoaDon
                WHERE MaHoaDon = @MaHoaDon
            `);
        assert(roomInvoiceLines.recordset.some(line =>
            line.TenKhoan === `Chi phí phát sinh: B5 room incident ${fixture.tierId}`
            && Number(line.SoTien) === 1000));
        const roomInvoiceTotal = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), roomInvoiceId)
            .query("SELECT TongThuc FROM dbo.vw_HoaDonTongHop WHERE MaHoaDon = @MaHoaDon");
        const roomInvoiceAmount = Number(roomInvoiceTotal.recordset[0].TongThuc);
        assert.equal(roomInvoiceAmount,
            roomInvoiceLines.recordset.reduce((sum, line) => sum + Number(line.SoTien), 0));
        const roomInvoiceNotice = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `INVOICE:${roomInvoiceId}`)
            .query("SELECT MaSinhVien, MaHoaDon, NoiDung FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.deepEqual(roomInvoiceNotice.recordset.map(row => row.MaSinhVien).sort(),
            [nextRepresentative, payer].sort());
        assert(roomInvoiceNotice.recordset.every(row => row.MaHoaDon === roomInvoiceId));
        assert.match(roomInvoiceNotice.recordset[0].NoiDung, /bao gồm chi phí phát sinh/);
        const roomInvoiceDueDateResult = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), roomInvoiceId)
            .query(`
                SELECT CONVERT(nvarchar(10), HanThanhToan, 23) AS HanThanhToan
                FROM dbo.HoaDon
                WHERE MaHoaDon = @MaHoaDon
            `);
        const roomInvoiceDueDate = roomInvoiceDueDateResult.recordset[0].HanThanhToan;
        for (const studentId of [nextRepresentative, payer]) {
            const invoices = await call("GET", "/api/HoaDon", "student", studentId);
            assert.equal(invoices.status, 200);
            const roomInvoice = invoices.body.find(invoice => invoice.MaHoaDon === roomInvoiceId);
            assert.ok(roomInvoice);
            assert.equal(roomInvoice.LoaiHoaDon, "DICH_VU_PHONG");
            assert.equal(Number(roomInvoice.TongTien), roomInvoiceAmount);
            assert.equal(roomInvoice.HanThanhToan, roomInvoiceDueDate);
        }
        const otherRoomInvoices = await call("GET", "/api/HoaDon", "student", otherRoomStudent);
        assert.equal(otherRoomInvoices.status, 200);
        assert.equal(otherRoomInvoices.body.some(invoice =>
            [incidentInvoiceId, roomInvoiceId].includes(invoice.MaHoaDon)), false);
        const roomPayment = await call("POST", "/api/payments/create", "student", payer, {
            MaHoaDon: roomInvoiceId, SoTien: roomInvoiceAmount, PhuongThuc: "ONLINE"
        });
        assert.equal(roomPayment.status, 201, JSON.stringify(roomPayment.body));
        const shortDemo = await call("POST", "/api/payments/demo-confirm", "student", payer, {
            MaHoaDon: roomInvoiceId, MaGiaoDich: roomPayment.body.MaGiaoDich, SoTien: roomInvoiceAmount - 1
        });
        assert.equal(shortDemo.status, 400);
        assert.match(shortDemo.body.message, /thấp hơn số tiền cần nộp/i);
        const overDemo = await call("POST", "/api/payments/demo-confirm", "student", payer, {
            MaHoaDon: roomInvoiceId, MaGiaoDich: roomPayment.body.MaGiaoDich, SoTien: roomInvoiceAmount + 1
        });
        assert.equal(overDemo.status, 400);
        assert.match(overDemo.body.message, /cao hơn số tiền cần nộp/i);
        const noDemoMismatchReceipt = await pool.request()
            .input("MaGiaoDich", sql.NVarChar(60), roomPayment.body.MaGiaoDich)
            .query(`
                SELECT COUNT_BIG(*) AS SoPhieuThuHopLe
                FROM dbo.PhieuThu WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'Hợp lệ'
            `);
        assert.equal(Number(noDemoMismatchReceipt.recordset[0].SoPhieuThuHopLe), 0);
        const demoPayment = await call("POST", "/api/payments/demo-confirm", "student", payer, {
            MaHoaDon: roomInvoiceId, MaGiaoDich: roomPayment.body.MaGiaoDich, SoTien: roomInvoiceAmount
        });
        assert.equal(demoPayment.status, 200, JSON.stringify(demoPayment.body));
        const paidRoomInvoices = await call("GET", "/api/HoaDon", "student", payer);
        assert.equal(paidRoomInvoices.body.find(invoice => invoice.MaHoaDon === roomInvoiceId)
            .TrangThaiThanhToan, "Đã thanh toán");
        const roomPaymentHistory = await call(
            "GET", `/api/payments/history?MaHoaDon=${encodeURIComponent(roomInvoiceId)}`, "student", payer
        );
        assert.equal(roomPaymentHistory.status, 200);
        assert.equal(roomPaymentHistory.body.some(payment =>
            payment.MaHoaDon === roomInvoiceId && payment.TrangThai === "SUCCESS"), true);
        const invoiceNotices = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `INVOICE:${incidentInvoiceId}`)
            .query("SELECT MaSinhVien, MaHoaDon FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.deepEqual(invoiceNotices.recordset.map(row => row.MaSinhVien), [payer]);
        assert(invoiceNotices.recordset.every(row => row.MaHoaDon === incidentInvoiceId));
        const formerMemberCannotViewIncident = await call(
            "GET", `/api/HoaDon/${incidentInvoiceId}`, "student", departingStudent
        );
        assert.equal(formerMemberCannotViewIncident.status, 404);
        const otherRoomCannotView = await call(
            "GET", `/api/HoaDon/${otherRoomInvoiceId}`, "student", departingStudent
        );
        assert.equal(otherRoomCannotView.status, 404);
        const otherRoomCannotPay = await call("POST", "/api/payments/create", "student",
            departingStudent, {
                MaHoaDon: otherRoomInvoiceId, SoTien: 1, PhuongThuc: "CASH"
            });
        assert.equal(otherRoomCannotPay.status, 400);
        assert.match(otherRoomCannotPay.body.message, /nộp tiền mặt tại văn phòng ký túc xá/i);

        const firstPayment = total;
        const firstActualReceived = total;
        const shortOnlineRequest = await call("POST", "/api/payments/create", "student", payer, {
            MaHoaDon: serviceInvoiceId, SoTien: total - 1, PhuongThuc: "ONLINE"
        });
        assert.equal(shortOnlineRequest.status, 400);
        assert.match(shortOnlineRequest.body.message, /thấp hơn số tiền cần nộp/i);
        const overOnlineRequest = await call("POST", "/api/payments/create", "student", payer, {
            MaHoaDon: serviceInvoiceId, SoTien: total + 1, PhuongThuc: "ONLINE"
        });
        assert.equal(overOnlineRequest.status, 400);
        assert.match(overOnlineRequest.body.message, /cao hơn số tiền cần nộp/i);
        const paymentRequest = await call("POST", "/api/payments/create", "student", payer, {
            MaHoaDon: serviceInvoiceId, SoTien: firstPayment, PhuongThuc: "ONLINE"
        });
        assert.equal(paymentRequest.status, 201, JSON.stringify(paymentRequest.body));
        const webhookPayload = {
            MaHoaDon: serviceInvoiceId,
            SoTien: firstActualReceived,
            MaThamChieuNgoai: `B5-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
            NoiDungCK: paymentRequest.body.NoiDungCK
        };
        const invalidSignatureWebhook = await webhookCall(webhookPayload, "0".repeat(64));
        assert.equal(invalidSignatureWebhook.status, 401);
        const qrResponse = await call(
            "GET",
            `/api/payments/qr?MaHoaDon=${encodeURIComponent(serviceInvoiceId)}&SoTien=${firstPayment}`,
            "student",
            payer
        );
        assert.equal(qrResponse.status, 200, JSON.stringify(qrResponse.body));
        assert.equal(qrResponse.body.MaGiaoDich, paymentRequest.body.MaGiaoDich);
        assert.equal(qrResponse.body.NoiDungCK, paymentRequest.body.NoiDungCK);
        assert.match(qrResponse.body.NoiDungCK, /^KTX[A-F0-9]{20}$/);
        assert.doesNotMatch(qrResponse.body.NoiDungCK, new RegExp(payer, "i"));
        const { createVietQrPayload } = require("./payment-qr");
        assert.equal(qrResponse.body.QrPayload, createVietQrPayload({
            bankBin: "970415",
            accountNumber: "123456789012",
            amount: firstPayment,
            paymentContent: paymentRequest.body.NoiDungCK
        }));
        const firstWebhook = await webhookCall(webhookPayload);
        const duplicateWebhook = await webhookCall(webhookPayload);
        assert.equal(firstWebhook.status, 200, JSON.stringify(firstWebhook.body));
        assert.equal(firstWebhook.body.allocated, firstActualReceived);
        assert.equal(firstWebhook.body.surplus, 0);
        assert.equal(duplicateWebhook.status, 200, JSON.stringify(duplicateWebhook.body));
        assert.equal(duplicateWebhook.body.alreadyProcessed, true);
        const reusedReferenceWithDifferentPayload = await webhookCall({
            ...webhookPayload, SoTien: firstActualReceived + 1
        });
        assert.equal(reusedReferenceWithDifferentPayload.status, 409);
        const nonPendingWebhook = await webhookCall({
            ...webhookPayload,
            MaThamChieuNgoai: `B5-NON-PENDING-${crypto.randomBytes(10).toString("hex").toUpperCase()}`
        });
        assert.equal(nonPendingWebhook.status, 404);
        const paymentReceipt = await pool.request()
            .input("MaGiaoDich", sql.NVarChar(60), paymentRequest.body.MaGiaoDich)
            .query("SELECT MaPhieuThu FROM dbo.PhieuThu WHERE MaGiaoDich = @MaGiaoDich");
        const paymentNotices = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `PAYMENT:${paymentReceipt.recordset[0].MaPhieuThu}`)
            .query(`
                SELECT tb.MaSinhVien, tb.MaHoaDon, tb.MaSuKien, tb.NoiDung
                FROM dbo.ThongBao tb
                WHERE tb.MaSuKien = @MaSuKien
            `);
        assert.deepEqual(paymentNotices.recordset.map(row => row.MaSinhVien), [payer]);
        assert(paymentNotices.recordset.every(row =>
            row.MaHoaDon === serviceInvoiceId && row.MaSuKien === `PAYMENT:${paymentReceipt.recordset[0].MaPhieuThu}`));
        assert.match(paymentNotices.recordset[0].NoiDung, /đã được xác nhận/);
        assert.match(paymentNotices.recordset[0].NoiDung, new RegExp(serviceInvoiceId));
        const receiptCountAfterDuplicateWebhook = await pool.request()
            .input("MaGiaoDich", sql.NVarChar(60), paymentRequest.body.MaGiaoDich)
            .query(`
                SELECT COUNT_BIG(*) AS SoPhieuThu
                FROM dbo.PhieuThu
                WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'Hợp lệ'
            `);
        assert.equal(Number(receiptCountAfterDuplicateWebhook.recordset[0].SoPhieuThu), 1);

        const cashExpense = await call("POST", "/api/ChiPhiPhatSinh", "manager", null, {
            maHopDong: contractId,
            maChiTiet: payerMember.MaChiTiet,
            noiDung: `B5 cash concurrency ${fixture.tierId}`,
            soTien: 350,
            ngayPhatSinh: periodText,
            hanDong: periodText,
            cheDoLap: "RIENG"
        });
        assert.equal(cashExpense.status, 201, JSON.stringify(cashExpense.body));
        const cashMismatch = await call("POST", `/api/HoaDon/${cashExpense.body.MaHoaDon}/phieuthu`,
            "manager", null, {
                soTien: 349, phuongThuc: "CASH", trangThai: "Hợp lệ", maSinhVienNop: payer
            });
        await t.test("real SQL cash receipt rejects underpayment", async () => {
            assert.equal(cashMismatch.status, 400);
            assert.match(cashMismatch.body.message, /phải đúng bằng số còn nợ/i);
        });
        const cashOverpayment = await call(
            "POST", `/api/HoaDon/${cashExpense.body.MaHoaDon}/phieuthu`, "manager", null, {
                soTien: 351, phuongThuc: "CASH", trangThai: "Hợp lệ", maSinhVienNop: payer
            }
        );
        await t.test("real SQL cash receipt rejects overpayment", async () => {
            assert.equal(cashOverpayment.status, 400);
            assert.match(cashOverpayment.body.message, /phải đúng bằng số còn nợ/i);
        });
        const noCashMismatchReceipt = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), cashExpense.body.MaHoaDon)
            .query(`
                SELECT COUNT_BIG(*) AS SoPhieuThuHopLe
                FROM dbo.PhieuThu WHERE MaHoaDon = @MaHoaDon AND TrangThai = N'Hợp lệ'
            `);
        assert.equal(Number(noCashMismatchReceipt.recordset[0].SoPhieuThuHopLe), 0);
        const competingReceipts = await Promise.all([1, 2].map(() => call(
            "POST", `/api/HoaDon/${cashExpense.body.MaHoaDon}/phieuthu`, "manager", null, {
                soTien: 350,
                phuongThuc: "CASH",
                trangThai: "Hợp lệ",
                maSinhVienNop: payer
            }
        )));
        assert.deepEqual(competingReceipts.map(result => result.status).sort(), [201, 409]);
        const paidServiceInvoice = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), serviceInvoiceId)
            .query(`
                SELECT v.TongThuc, v.DaThu, v.ConNo, hd.TrangThaiThanhToan
                FROM dbo.HoaDon hd
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                WHERE hd.MaHoaDon = @MaHoaDon
            `);
        assert.equal(Number(paidServiceInvoice.recordset[0].DaThu), total);
        assert.equal(Number(paidServiceInvoice.recordset[0].ConNo), 0);
        assert.equal(paidServiceInvoice.recordset[0].TrangThaiThanhToan, "Đã thanh toán");

        const exactInvoiceTotal = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), otherRoomInvoiceId)
            .query("SELECT TongThuc FROM dbo.vw_HoaDonTongHop WHERE MaHoaDon = @MaHoaDon");
        const exactAmount = Number(exactInvoiceTotal.recordset[0].TongThuc);
        const exactPayment = await call("POST", "/api/payments/create", "student", otherRoomStudent, {
            MaHoaDon: otherRoomInvoiceId, SoTien: exactAmount, PhuongThuc: "ONLINE"
        });
        assert.equal(exactPayment.status, 201, JSON.stringify(exactPayment.body));
        const exactPayload = {
            MaHoaDon: otherRoomInvoiceId,
            SoTien: exactAmount,
            MaThamChieuNgoai: `B5-EXACT-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
            NoiDungCK: exactPayment.body.NoiDungCK
        };
        const exactWebhook = await webhookCall(exactPayload);
        assert.equal(exactWebhook.status, 200, JSON.stringify(exactWebhook.body));
        assert.equal(exactWebhook.body.allocated, exactAmount);
        assert.equal(exactWebhook.body.surplus, 0);
        const exactState = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), otherRoomInvoiceId)
            .input("MaGiaoDich", sql.NVarChar(60), exactPayment.body.MaGiaoDich)
            .query(`
                SELECT gd.SoTienThucNhan, gd.TrangThai, v.DaThu, v.ConNo,
                       (SELECT COUNT_BIG(*) FROM dbo.HoanTienChuyenKhoanDu h
                        WHERE h.MaGiaoDich = @MaGiaoDich) AS SoKhoanDu,
                       (SELECT COUNT_BIG(*) FROM dbo.ThongBao tb
                        WHERE tb.MaSuKien = CONCAT(N'PAYMENT:', pt.MaPhieuThu)) AS SoThongBao
                FROM dbo.GiaoDichThanhToan gd
                INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = pt.MaHoaDon
                WHERE gd.MaGiaoDich = @MaGiaoDich AND v.MaHoaDon = @MaHoaDon
            `);
        assert.equal(Number(exactState.recordset[0].SoTienThucNhan), exactAmount);
        assert.equal(exactState.recordset[0].TrangThai, "SUCCESS");
        assert.equal(Number(exactState.recordset[0].DaThu), exactAmount);
        assert.equal(Number(exactState.recordset[0].ConNo), 0);
        assert.equal(Number(exactState.recordset[0].SoKhoanDu), 0);
        assert.equal(Number(exactState.recordset[0].SoThongBao), 1);
        const exactPaymentHistory = await call(
            "GET", `/api/payments/history?MaHoaDon=${encodeURIComponent(otherRoomInvoiceId)}`,
            "manager", null
        );
        assert.equal(exactPaymentHistory.status, 200);
        const exactHistoryRow = exactPaymentHistory.body.find(row => row.MaGiaoDich === exactPayment.body.MaGiaoDich);
        assert.equal(Number(exactHistoryRow.SoTienThucNhan), exactAmount);
        assert.equal(Number(exactHistoryRow.SoTienYeuCau), exactAmount);
        assert.equal(exactHistoryRow.SoTienDu, null);

        const concurrentPeriodDate = new Date(`${periodText}T00:00:00.000Z`);
        concurrentPeriodDate.setUTCDate(1);
        concurrentPeriodDate.setUTCMonth(concurrentPeriodDate.getUTCMonth() + 3);
        const concurrentPeriodText = concurrentPeriodDate.toISOString().slice(0, 10);
        const concurrentQrInvoiceResponse = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
            loaiHoaDon: "DICH_VU_PHONG", maHopDong: contractId, kyThanhToan: concurrentPeriodText
        });
        assert.equal(concurrentQrInvoiceResponse.status, 201, JSON.stringify(concurrentQrInvoiceResponse.body));
        const concurrentQrInvoiceId = concurrentQrInvoiceResponse.body.MaHoaDon;
        const concurrentInvoiceTotalResult = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), concurrentQrInvoiceId)
            .query("SELECT TongThuc FROM dbo.vw_HoaDonTongHop WHERE MaHoaDon = @MaHoaDon");
        const concurrentInvoiceTotal = Number(concurrentInvoiceTotalResult.recordset[0].TongThuc);
        const concurrentRequestAmount = concurrentInvoiceTotal;
        const mismatchPayment = await call("POST", "/api/payments/create", "student", nextRepresentative, {
            MaHoaDon: concurrentQrInvoiceId, SoTien: concurrentRequestAmount, PhuongThuc: "ONLINE"
        });
        assert.equal(mismatchPayment.status, 201, JSON.stringify(mismatchPayment.body));
        const mismatchPayload = {
            MaHoaDon: concurrentQrInvoiceId,
            SoTien: 1,
            MaThamChieuNgoai: `B5-MISMATCH-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
            NoiDungCK: `${mismatchPayment.body.NoiDungCK}-SAI`
        };
        const reconciliationWebhook = await webhookCall(mismatchPayload);
        assert.equal(reconciliationWebhook.status, 200, JSON.stringify(reconciliationWebhook.body));
        assert.equal(reconciliationWebhook.body.needsReconciliation, true);
        const unreconciledInvoice = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), concurrentQrInvoiceId)
            .query(`
                SELECT v.DaThu, v.ConNo, hd.TrangThaiThanhToan,
                       (SELECT COUNT_BIG(*) FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N'Hợp lệ') AS SoPhieuThuHopLe
                FROM dbo.HoaDon hd
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                WHERE hd.MaHoaDon = @MaHoaDon
            `);
        assert.equal(Number(unreconciledInvoice.recordset[0].DaThu), 0);
        assert.equal(Number(unreconciledInvoice.recordset[0].ConNo), concurrentInvoiceTotal);
        assert.equal(unreconciledInvoice.recordset[0].TrangThaiThanhToan, "Chưa thanh toán");
        assert.equal(Number(unreconciledInvoice.recordset[0].SoPhieuThuHopLe), 0);
        const reconciliation = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), concurrentQrInvoiceId)
            .input("MaThamChieuNgoai", sql.NVarChar(100), mismatchPayload.MaThamChieuNgoai)
            .query(`
                SELECT pt.MaPhieuThu, pt.TrangThai AS TrangThaiPhieuThu,
                       gd.MaGiaoDich, gd.TrangThai, gd.LyDoDoiSoat,
                       gd.SoTienThucNhan, h.SoTien AS SoTienDu, h.TrangThai AS TrangThaiHoanDu
                FROM dbo.GiaoDichThanhToan gd
                INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                INNER JOIN dbo.HoanTienChuyenKhoanDu h ON h.MaGiaoDich = gd.MaGiaoDich
                WHERE pt.MaHoaDon = @MaHoaDon AND gd.MaThamChieuNgoai = @MaThamChieuNgoai
            `);
        assert.equal(reconciliation.recordset[0].TrangThai, "RECONCILIATION");
        assert.equal(reconciliation.recordset[0].TrangThaiPhieuThu, "Đã hủy");
        assert.match(reconciliation.recordset[0].LyDoDoiSoat, /Nội dung chuyển khoản không khớp/);
        assert.equal(Number(reconciliation.recordset[0].SoTienThucNhan), 1);
        assert.equal(Number(reconciliation.recordset[0].SoTienDu), 1);
        assert.equal(reconciliation.recordset[0].TrangThaiHoanDu, "CHO_HOAN");
        const studentPaymentHistory = await call(
            "GET", `/api/payments/history?MaHoaDon=${encodeURIComponent(concurrentQrInvoiceId)}`,
            "student", nextRepresentative
        );
        assert.equal(studentPaymentHistory.status, 200);
        assert.equal(studentPaymentHistory.body.some(row =>
            row.MaGiaoDich === reconciliation.recordset[0].MaGiaoDich), false);
        const adminReceipts = await call("GET", "/api/phieuthu", "manager", null);
        assert.equal(adminReceipts.status, 200);
        assert.equal(adminReceipts.body.some(row =>
            row.MaGiaoDich === reconciliation.recordset[0].MaGiaoDich), false);
        const mismatchNotice = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `BANK_RECEIVED:${reconciliation.recordset[0].MaGiaoDich}`)
            .query("SELECT MaSinhVien, MaHoaDon, NoiDung FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.deepEqual(mismatchNotice.recordset, []);
        const reconciliationReceiptId = reconciliation.recordset[0].MaPhieuThu;
        const blockedReconciliationConfirmation = await call(
            "PUT", `/api/phieuthu/${reconciliationReceiptId}/xac-nhan`, "manager", null, {}
        );
        assert.equal(blockedReconciliationConfirmation.status, 409);
        const rejectedReconciliation = await call(
            "PUT", `/api/phieuthu/${reconciliationReceiptId}/huy`, "manager", null,
            { lyDo: "Ngân hàng báo số tiền khác với yêu cầu. Đã kiểm tra sao kê." }
        );
        assert.equal(rejectedReconciliation.status, 409, JSON.stringify(rejectedReconciliation.body));
        const repeatedRejection = await call(
            "PUT", `/api/phieuthu/${reconciliationReceiptId}/huy`, "manager", null,
            { lyDo: "Ngân hàng báo số tiền khác với yêu cầu. Đã kiểm tra sao kê." }
        );
        const rejectionNotices = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `REJECTION:${reconciliationReceiptId}`)
            .query("SELECT MaSinhVien, MaHoaDon, NoiDung FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.equal(rejectionNotices.recordset.length, 0);
        assert.notEqual(repeatedRejection.status, 200);
        const nonRecipientCannotReadRejection = await call(
            "GET", "/api/student/notifications", "student", otherRoomStudent
        );
        assert.equal(nonRecipientCannotReadRejection.status, 200);
        assert.equal(nonRecipientCannotReadRejection.body.some(row =>
            row.TieuDe.includes(`Phiếu thu ${reconciliationReceiptId} đã bị từ chối`)), false);

        const concurrentQrPayments = await Promise.all([payer, nextRepresentative].map(studentId => call(
            "POST", "/api/payments/create", "student", studentId, {
                MaHoaDon: concurrentQrInvoiceId, SoTien: concurrentRequestAmount, PhuongThuc: "ONLINE"
            }
        )));
        assert.deepEqual(concurrentQrPayments.map(result => result.status).sort(), [200, 201]);
        assert.equal(concurrentQrPayments[0].body.MaGiaoDich, concurrentQrPayments[1].body.MaGiaoDich);
        const concurrentPayload = {
            MaHoaDon: concurrentQrInvoiceId,
            SoTien: concurrentRequestAmount,
            MaThamChieuNgoai: `B5-CONCURRENT-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
            NoiDungCK: concurrentQrPayments[0].body.NoiDungCK
        };
        const concurrentWebhooks = await Promise.all([
            webhookCall(concurrentPayload),
            webhookCall(concurrentPayload)
        ]);
        assert.deepEqual(concurrentWebhooks.map(result => result.status), [200, 200]);
        assert.equal(concurrentWebhooks.filter(result => result.body.alreadyProcessed).length, 1);
        const concurrentTotals = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), concurrentQrInvoiceId)
            .query(`
                SELECT v.TongThuc, v.DaThu, v.ConNo,
                       (SELECT ISNULL(SUM(gd.SoTienThucNhan), 0)
                        FROM dbo.GiaoDichThanhToan gd
                        INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                        WHERE pt.MaHoaDon = @MaHoaDon AND gd.TrangThai = N'SUCCESS') AS TongThucNhan,
                       (SELECT ISNULL(SUM(h.SoTien), 0)
                        FROM dbo.HoanTienChuyenKhoanDu h
                        INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = h.MaGiaoDich
                        WHERE h.MaHoaDon = @MaHoaDon AND gd.TrangThai = N'SUCCESS') AS TongTienDu,
                       (SELECT COUNT_BIG(*) FROM dbo.HoanTienChuyenKhoanDu h
                        INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = h.MaGiaoDich
                        WHERE h.MaHoaDon = @MaHoaDon AND gd.TrangThai = N'SUCCESS') AS SoKhoanDu
                FROM dbo.vw_HoaDonTongHop v WHERE v.MaHoaDon = @MaHoaDon
            `);
        assert.equal(Number(concurrentTotals.recordset[0].TongThuc), concurrentInvoiceTotal);
        assert.equal(Number(concurrentTotals.recordset[0].DaThu), concurrentInvoiceTotal);
        assert.equal(Number(concurrentTotals.recordset[0].ConNo), 0);
        assert.equal(Number(concurrentTotals.recordset[0].TongThucNhan), concurrentInvoiceTotal);
        assert.equal(Number(concurrentTotals.recordset[0].TongTienDu), 0);
        assert.equal(Number(concurrentTotals.recordset[0].SoKhoanDu), 0);

        const incidentTotal = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), incidentInvoiceId)
            .query(`
                SELECT v.TongThuc
                FROM dbo.vw_HoaDonTongHop v
                WHERE v.MaHoaDon = @MaHoaDon
            `);
        const lateWebhookAmount = Number(incidentTotal.recordset[0].TongThuc);
        const pendingLateWebhook = await call("POST", "/api/payments/create", "student", payer, {
            MaHoaDon: incidentInvoiceId, SoTien: lateWebhookAmount, PhuongThuc: "ONLINE"
        });
        assert.equal(pendingLateWebhook.status, 201, JSON.stringify(pendingLateWebhook.body));
        const cashPaidIncident = await call(
            "POST", `/api/HoaDon/${incidentInvoiceId}/phieuthu`, "manager", null, {
                soTien: lateWebhookAmount,
                phuongThuc: "CASH",
                trangThai: "Hợp lệ",
                maSinhVienNop: payer
            }
        );
        assert.equal(cashPaidIncident.status, 201, JSON.stringify(cashPaidIncident.body));
        const lateActualReceived = lateWebhookAmount + 17;
        const lateWebhookPayload = {
            MaHoaDon: incidentInvoiceId,
            SoTien: lateActualReceived,
            MaThamChieuNgoai: `B5-LATE-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
            NoiDungCK: pendingLateWebhook.body.NoiDungCK
        };
        const revenueBeforeLateWebhook = await pool.request()
            .query("SELECT ISNULL(SUM(TongThu), 0) AS TongThu FROM dbo.vw_DoanhThuThang");
        const lateWebhook = await webhookCall(lateWebhookPayload);
        assert.equal(lateWebhook.status, 200, JSON.stringify(lateWebhook.body));
        assert.equal(lateWebhook.body.needsReconciliation, true);
        const revenueAfterLateWebhook = await pool.request()
            .query("SELECT ISNULL(SUM(TongThu), 0) AS TongThu FROM dbo.vw_DoanhThuThang");
        assert.equal(Number(revenueAfterLateWebhook.recordset[0].TongThu),
            Number(revenueBeforeLateWebhook.recordset[0].TongThu));
        const lateWebhookState = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), incidentInvoiceId)
            .input("MaThamChieuNgoai", sql.NVarChar(100), lateWebhookPayload.MaThamChieuNgoai)
            .query(`
                SELECT pt.MaPhieuThu, pt.TrangThai AS TrangThaiPhieuThu,
                       gd.MaGiaoDich, gd.TrangThai, gd.SoTienThucNhan,
                       v.TongThuc, v.DaThu, v.ConNo,
                       surplus.SoTien AS SoTienDu, surplus.TrangThai AS TrangThaiHoanDu,
                       (SELECT COUNT_BIG(*) FROM dbo.PhieuChi_HoaDon pha
                        INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = pha.MaPhieuChi
                        WHERE pha.MaHoaDon = @MaHoaDon) AS SoDongPhieuChi
                FROM dbo.GiaoDichThanhToan gd
                INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = pt.MaHoaDon
                INNER JOIN dbo.HoanTienChuyenKhoanDu surplus ON surplus.MaGiaoDich = gd.MaGiaoDich
                WHERE pt.MaHoaDon = @MaHoaDon AND gd.MaThamChieuNgoai = @MaThamChieuNgoai
            `);
        const surplusState = lateWebhookState.recordset[0];
        assert.equal(surplusState.TrangThai, "RECONCILIATION");
        assert.equal(surplusState.TrangThaiPhieuThu, "Đã hủy");
        assert.equal(Number(surplusState.SoTienThucNhan), lateActualReceived);
        assert.equal(Number(surplusState.TongThuc), lateWebhookAmount);
        assert.equal(Number(surplusState.DaThu), lateWebhookAmount);
        assert.equal(Number(surplusState.ConNo), 0);
        assert.equal(Number(surplusState.SoTienDu), lateActualReceived);
        assert.equal(surplusState.TrangThaiHoanDu, "CHO_HOAN");
        const debtSurplus = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT TongCongNo, TienDuChoHoan
                FROM dbo.vw_CongNo
                WHERE MaHopDong = @MaHopDong AND LoaiHoaDon = N'PHAT_SINH'
            `);
        assert.equal(Number(debtSurplus.recordset[0].TongCongNo), 0);
        assert.equal(Number(debtSurplus.recordset[0].TienDuChoHoan), lateActualReceived);
        const surplusTransactionId = surplusState.MaGiaoDich;
        const revenueBeforeSurplusReturn = await pool.request()
            .query("SELECT ISNULL(SUM(TongThu), 0) AS TongThu FROM dbo.vw_DoanhThuThang");
        const expensesBeforeSurplusReturn = await pool.request()
            .query("SELECT COUNT_BIG(*) AS SoDong FROM dbo.PhieuChi_HoaDon");
        const paymentExpensesBeforeSurplusReturn = await pool.request()
            .query("SELECT COUNT_BIG(*) AS SoDong FROM dbo.PhieuChi");
        const studentCannotReturnSurplus = await call(
            "POST", `/api/payments/surplus/${surplusTransactionId}/return`, "student", payer, {}
        );
        assert.equal(studentCannotReturnSurplus.status, 403);
        const surplusReturn = await call(
            "POST", `/api/payments/surplus/${surplusTransactionId}/return`, "manager", null, {}
        );
        assert.equal(surplusReturn.status, 200, JSON.stringify(surplusReturn.body));
        assert.equal(surplusReturn.body.alreadyProcessed, false);
        assert.equal(Number(surplusReturn.body.SoTien), lateActualReceived);
        const repeatedSurplusReturn = await call(
            "POST", `/api/payments/surplus/${surplusTransactionId}/return`, "manager", null, {}
        );
        assert.equal(repeatedSurplusReturn.status, 200, JSON.stringify(repeatedSurplusReturn.body));
        assert.equal(repeatedSurplusReturn.body.alreadyProcessed, true);
        const returnedSurplus = await pool.request()
            .input("MaGiaoDich", sql.NVarChar(60), surplusTransactionId)
            .query(`
                SELECT h.TrangThai, h.NguoiTra, COUNT_BIG(*) OVER() AS SoKhoan,
                       (SELECT COUNT_BIG(*) FROM dbo.ThongBao tb
                        WHERE tb.MaSuKien = CONCAT(N'SURPLUS_REFUNDED:', h.MaGiaoDich)) AS SoThongBao,
                       (SELECT COUNT_BIG(*) FROM dbo.NhatKyHeThong nk
                        WHERE nk.DoiTuong = N'HoanTienChuyenKhoanDu'
                          AND nk.MaDoiTuong = h.MaGiaoDich) AS SoAudit
                FROM dbo.HoanTienChuyenKhoanDu h WHERE h.MaGiaoDich = @MaGiaoDich
            `);
        assert.equal(returnedSurplus.recordset[0].TrangThai, "DA_HOAN");
        assert.equal(Number(returnedSurplus.recordset[0].SoKhoan), 1);
        assert.equal(Number(returnedSurplus.recordset[0].SoThongBao), 0);
        assert.equal(Number(returnedSurplus.recordset[0].SoAudit), 1);
        await assert.rejects(
            pool.request()
                .input("MaGiaoDich", sql.NVarChar(60), surplusTransactionId)
                .query(`
                    UPDATE dbo.HoanTienChuyenKhoanDu
                    SET TrangThai = N'CHO_HOAN', NguoiTra = NULL, ThoiDiemTra = NULL
                    WHERE MaGiaoDich = @MaGiaoDich
                `),
            error => error.number === 52703
        );
        const revenueAfterSurplusReturn = await pool.request()
            .query("SELECT ISNULL(SUM(TongThu), 0) AS TongThu FROM dbo.vw_DoanhThuThang");
        const expensesAfterSurplusReturn = await pool.request()
            .query("SELECT COUNT_BIG(*) AS SoDong FROM dbo.PhieuChi_HoaDon");
        const paymentExpensesAfterSurplusReturn = await pool.request()
            .query("SELECT COUNT_BIG(*) AS SoDong FROM dbo.PhieuChi");
        assert.equal(Number(revenueAfterSurplusReturn.recordset[0].TongThu),
            Number(revenueBeforeSurplusReturn.recordset[0].TongThu));
        assert.equal(Number(expensesAfterSurplusReturn.recordset[0].SoDong),
            Number(expensesBeforeSurplusReturn.recordset[0].SoDong));
        assert.equal(Number(paymentExpensesAfterSurplusReturn.recordset[0].SoDong),
            Number(paymentExpensesBeforeSurplusReturn.recordset[0].SoDong));
        const refundedNotice = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `SURPLUS_REFUNDED:${surplusTransactionId}`)
            .query("SELECT MaSinhVien, MaHoaDon FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.deepEqual(refundedNotice.recordset, []);

        const adminQrInvoiceId = rentInvoicesByStudent.get(payer);
        assert.ok(adminQrInvoiceId);
        await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), adminQrInvoiceId)
            .query("UPDATE dbo.ChiTietHoaDon SET SoTien = 300, DonGia = 300 WHERE MaHoaDon = @MaHoaDon");
        const adminQrPayment = await call("POST", "/api/payments/create", "student", payer, {
            MaHoaDon: adminQrInvoiceId, SoTien: 300, PhuongThuc: "ONLINE"
        });
        assert.equal(adminQrPayment.status, 201, JSON.stringify(adminQrPayment.body));
        const pendingReceipt = await pool.request()
            .input("MaGiaoDich", sql.NVarChar(60), adminQrPayment.body.MaGiaoDich)
            .query("SELECT MaPhieuThu FROM dbo.PhieuThu WHERE MaGiaoDich = @MaGiaoDich");
        const pendingReceiptId = pendingReceipt.recordset[0].MaPhieuThu;
        const nonManagerConfirmation = await call(
            "PUT", `/api/phieuthu/${pendingReceiptId}/xac-nhan`, "student", payer, {}
        );
        assert.equal(nonManagerConfirmation.status, 403);
        const managerConfirmation = await call(
            "PUT", `/api/phieuthu/${pendingReceiptId}/xac-nhan`, "manager", null, {}
        );
        assert.equal(managerConfirmation.status, 200, JSON.stringify(managerConfirmation.body));
        const repeatedAdminConfirmation = await call(
            "PUT", `/api/phieuthu/${pendingReceiptId}/xac-nhan`, "manager", null, {}
        );
        assert.equal(repeatedAdminConfirmation.status, 409, JSON.stringify(repeatedAdminConfirmation.body));
        const overpayment = await call(
            "POST", `/api/HoaDon/${adminQrInvoiceId}/phieuthu`, "manager", null, {
                soTien: 201, phuongThuc: "CASH", trangThai: "Hợp lệ", maSinhVienNop: payer
            }
        );
        assert.equal(overpayment.status, 409, JSON.stringify(overpayment.body));
        const adminQrTotals = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), adminQrInvoiceId)
            .input("MaPhieuThu", sql.BigInt, pendingReceiptId)
            .input("MaSinhVien", sql.NVarChar(30), payer)
            .query(`
                SELECT v.TongThuc, v.DaThu, v.ConNo,
                       (SELECT COUNT_BIG(*) FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = @MaHoaDon AND pt.TrangThai = N'Hợp lệ') AS ValidReceiptCount,
                       (SELECT COUNT_BIG(*) FROM dbo.ThongBao tb
                        WHERE tb.MaSuKien = CONCAT(N'PAYMENT:', @MaPhieuThu)
                          AND tb.MaSinhVien = @MaSinhVien) AS PaymentNoticeCount
                FROM dbo.vw_HoaDonTongHop v WHERE v.MaHoaDon = @MaHoaDon
            `);
        assert.equal(Number(adminQrTotals.recordset[0].TongThuc), 300);
        assert.equal(Number(adminQrTotals.recordset[0].DaThu), 300);
        assert.equal(Number(adminQrTotals.recordset[0].ConNo), 0);
        assert.equal(Number(adminQrTotals.recordset[0].ValidReceiptCount), 1);
        assert.equal(Number(adminQrTotals.recordset[0].PaymentNoticeCount), 1);
        const refundResponse = await call("POST", "/api/phieuchi", "manager", null, {
            maChiTiet: payerMember.MaChiTiet,
            ngayRa: periodText,
            lyDo: "Khác",
            khauTru: 0
        });
        assert.equal(refundResponse.status, 201, JSON.stringify(refundResponse.body));
        const refundNotice = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `REFUND:${refundResponse.body.MaPhieuChi}`)
            .query("SELECT MaSinhVien, COUNT_BIG(*) AS NoticeCount FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien GROUP BY MaSinhVien");
        assert.equal(refundNotice.recordset.length, 1);
        assert.equal(refundNotice.recordset[0].MaSinhVien, payer);
        assert.equal(Number(refundNotice.recordset[0].NoticeCount), 1);
        const repeatedRefund = await call("POST", "/api/phieuchi", "manager", null, {
            maChiTiet: payerMember.MaChiTiet,
            ngayRa: periodText,
            lyDo: "Khác",
            khauTru: 0
        });
        const refundNoticeAfterRetry = await pool.request()
            .input("MaSuKien", sql.NVarChar(100), `REFUND:${refundResponse.body.MaPhieuChi}`)
            .query("SELECT COUNT_BIG(*) AS NoticeCount FROM dbo.ThongBao WHERE MaSuKien = @MaSuKien");
        assert.notEqual(repeatedRefund.status, 201);
        assert.equal(Number(refundNoticeAfterRetry.recordset[0].NoticeCount), 1);
        t.diagnostic(
            `Manager QR confirmation ${pendingReceiptId}: non-manager 403; first confirm 200; repeat 409; overpayment 409; one valid receipt and one payer notification. Refund ${refundResponse.body.MaPhieuChi} created one notification for its student.`
        );
        t.diagnostic(
            `Self-seeded fixture ${fixture.tierId}: short QR allocated ${firstActualReceived}; exact QR paid ${exactAmount}; repeated QR creation reused one pending transaction; overpayment ${lateActualReceived} remains excluded from receipts and revenue; content mismatch was rejected without student notices.`
        );
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        restoreEnvironment();
        if (fixture) await cleanupSqlIntegrationFixture(pool, sql, fixture);
        await pool.close();
    }
});

test("real SQL Server serializes concurrent exact QR requests and duplicate webhooks in five rounds", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình kết nối SQL Server; không thể chạy kiểm thử QR đồng thời.");
    }

    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    const previousSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const secret = `test-${crypto.randomBytes(24).toString("hex")}`;
    process.env.PAYMENT_WEBHOOK_SECRET = secret;

    try {
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 2,
            createOtherRoomStudent: false
        });
        const [studentA, studentB] = fixture.studentIds;
        const period = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
            .toISOString().slice(0, 10);
        const contractEnd = new Date(Date.UTC(
            Number(period.slice(0, 4)) + 3, Number(period.slice(5, 7)) - 1, 1
        )).toISOString().slice(0, 10);

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            if (req.get("x-test-role") === "manager") {
                req.auth = { accountId: fixture.managerId, role: "Quản lý" };
            } else if (req.get("x-test-role") === "student") {
                req.auth = { role: "Sinh viên", studentId: req.get("x-test-student") };
            }
            next();
        });
        registerApiRoutes(app, {
            getPool: () => pool,
            sql,
            bcrypt: require("bcryptjs"),
            mapPaymentStatusToDatabase: value => ({
                PENDING: "PENDING",
                WAITING_CASH: "Chờ xác nhận",
                SUCCESS: "SUCCESS",
                REJECTED: "REJECTED",
                EXPIRED: "EXPIRED",
                "Cần đối soát": "RECONCILIATION",
                "Hợp lệ": "Hợp lệ",
                "Chờ xác nhận": "Chờ xác nhận",
                "Đã hủy": "Đã hủy"
            })[value] || null,
            mapPaymentMethodToDatabase: value => ({
                CASH: "CASH", ONLINE: "ONLINE", CHUYEN_DOI: "CHUYEN_DOI"
            })[value] || null,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });

        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const call = async (method, route, role, studentId, body) => {
            const headers = {};
            if (body !== undefined) headers["Content-Type"] = "application/json";
            if (role) headers["x-test-role"] = role;
            if (studentId) headers["x-test-student"] = studentId;
            const response = await fetch(`${baseUrl}${route}`, {
                method,
                headers,
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };
        const { createPaymentWebhookSignature } = require("./payment-webhook");
        const webhookCall = async payload => {
            const response = await fetch(`${baseUrl}/api/payments/bank-transfer/notify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-payment-signature": createPaymentWebhookSignature(secret, payload)
                },
                body: JSON.stringify(payload)
            });
            return { status: response.status, body: await response.json() };
        };

        const contract = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: period,
            ngayKetThuc: contractEnd,
            sinhVien: [studentA, studentB].map((maSinhVien, index) => ({
                maSinhVien,
                kyHanThanhToanPhong: "THANG",
                laNguoiDaiDien: index === 0
            }))
        });
        assert.equal(contract.status, 201, JSON.stringify(contract.body));
        const roundResults = [];

        for (let round = 0; round < 5; round += 1) {
            const invoicePeriodDate = new Date(`${period}T00:00:00.000Z`);
            invoicePeriodDate.setUTCMonth(invoicePeriodDate.getUTCMonth() + round + 2);
            const invoicePeriod = invoicePeriodDate.toISOString().slice(0, 10);
            const invoiceResponse = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
                loaiHoaDon: "DICH_VU_PHONG",
                maHopDong: contract.body.MaHopDong,
                kyThanhToan: invoicePeriod
            });
            assert.equal(invoiceResponse.status, 201,
                `Round ${round + 1} invoice: ${JSON.stringify(invoiceResponse.body)}`);
            const invoiceId = invoiceResponse.body.MaHoaDon;
            const invoiceTotalResult = await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .query("SELECT TongThuc FROM dbo.vw_HoaDonTongHop WHERE MaHoaDon = @MaHoaDon");
            const invoiceTotal = Number(invoiceTotalResult.recordset[0]?.TongThuc);
            assert(Number.isSafeInteger(invoiceTotal) && invoiceTotal > 1);
            const requests = await Promise.all([studentA, studentB].map(studentId => call(
                "POST", "/api/payments/create", "student", studentId, {
                    MaHoaDon: invoiceId, SoTien: invoiceTotal, PhuongThuc: "ONLINE"
                }
            )));
            assert.deepEqual(requests.map(result => result.status).sort(), [200, 201],
                `Round ${round + 1} request responses: ${JSON.stringify(requests)}`);
            assert.equal(requests[0].body.MaGiaoDich, requests[1].body.MaGiaoDich);
            const payment = {
                transactionId: requests[0].body.MaGiaoDich,
                content: requests[0].body.NoiDungCK,
                reference: `B5-EXACT-${round}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`
            };
            const persisted = await pool.request()
                .input("MaGiaoDich", sql.NVarChar(60), payment.transactionId)
                .query(`
                    SELECT COUNT_BIG(*) AS SoGiaoDich,
                           COUNT(DISTINCT pt.MaPhieuThu) AS SoPhieuThu,
                           MAX(gd.TongTien) AS TongTien
                    FROM dbo.GiaoDichThanhToan gd
                    INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.MaGiaoDich = @MaGiaoDich
                `);
            assert.equal(Number(persisted.recordset[0].SoGiaoDich), 1);
            assert.equal(Number(persisted.recordset[0].SoPhieuThu), 1);
            assert.equal(Number(persisted.recordset[0].TongTien), invoiceTotal);

            const webhookPayload = {
                MaHoaDon: invoiceId,
                SoTien: invoiceTotal,
                MaThamChieuNgoai: payment.reference,
                NoiDungCK: payment.content
            };
            const webhookResults = await Promise.all([
                webhookCall(webhookPayload),
                webhookCall(webhookPayload)
            ]);
            assert.deepEqual(webhookResults.map(result => result.status), [200, 200],
                `Round ${round + 1} webhook responses: ${JSON.stringify(webhookResults)}`);
            assert.equal(webhookResults.filter(result => result.body.alreadyProcessed).length, 1);

            const stateResult = await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .query(`
                    SELECT v.TongThuc, v.DaThu, v.ConNo,
                           (SELECT COUNT_BIG(*) FROM dbo.GiaoDichThanhToan gd
                            INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                            WHERE pt.MaHoaDon = @MaHoaDon AND gd.TrangThai = N'SUCCESS') AS SuccessfulPayments,
                           (SELECT ISNULL(SUM(gd.SoTienThucNhan), 0) FROM dbo.GiaoDichThanhToan gd
                            INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                            WHERE pt.MaHoaDon = @MaHoaDon AND gd.TrangThai = N'SUCCESS') AS ActualReceived,
                           (SELECT ISNULL(SUM(h.SoTien), 0) FROM dbo.HoanTienChuyenKhoanDu h
                            WHERE h.MaHoaDon = @MaHoaDon AND h.TrangThai = N'CHO_HOAN') AS PendingSurplus,
                           (SELECT COUNT_BIG(*) FROM dbo.ThongBao tb
                            WHERE tb.MaHoaDon = @MaHoaDon AND tb.MaSuKien LIKE N'PAYMENT:%') AS PaymentNotices
                    FROM dbo.vw_HoaDonTongHop v WHERE v.MaHoaDon = @MaHoaDon
                `);
            const state = stateResult.recordset[0];
            assert.equal(Number(state.SuccessfulPayments), 1);
            assert.equal(Number(state.ActualReceived), invoiceTotal);
            assert.equal(Number(state.DaThu), invoiceTotal);
            assert.equal(Number(state.ConNo), 0);
            assert.equal(Number(state.PendingSurplus), 0);
            assert.equal(Number(state.PaymentNotices), 1);
            roundResults.push(`round ${round + 1}: pass`);
        }

        assert.deepEqual(roundResults, [
            "round 1: pass", "round 2: pass", "round 3: pass", "round 4: pass", "round 5: pass"
        ]);
        t.diagnostic("5/5 independent invoice rounds passed; no Msg 1205.");
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (previousSecret === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET;
        else process.env.PAYMENT_WEBHOOK_SECRET = previousSecret;
        if (fixture) await cleanupSqlIntegrationFixture(pool, sql, fixture);
        await pool.close();
    }
});

test("real SQL Server overdue reminders use invoice scope, audit sender, recheck debt, and serialize duplicates", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình kết nối SQL Server; không thể chạy kiểm thử nhắc nợ thật.");
    }
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    const invoiceIds = new Set();
    try {
        const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
        assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 3,
            createOtherRoomStudent: true
        });
        const [departedStudent, activeStudentA, activeStudentB, otherRoomStudent] = fixture.studentIds;
        const startDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
        const periodText = startDate.toISOString().slice(0, 10);
        const endDate = new Date(Date.UTC(
            startDate.getUTCFullYear() + 3, startDate.getUTCMonth(), startDate.getUTCDate()
        )).toISOString().slice(0, 10);
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            if (req.get("x-test-role") === "manager") {
                req.auth = { accountId: fixture.managerId, role: "Quản lý" };
            } else if (req.get("x-test-role") === "student") {
                req.auth = { role: "Sinh viên", studentId: req.get("x-test-student") };
            }
            next();
        });
        registerApiRoutes(app, {
            getPool: () => pool,
            sql,
            bcrypt: require("bcryptjs"),
            mapPaymentStatusToDatabase: value => value,
            mapPaymentMethodToDatabase: value => value,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const call = async (method, route, role, studentId, body) => {
            const headers = {};
            if (body !== undefined) headers["Content-Type"] = "application/json";
            if (role) headers["x-test-role"] = role;
            if (studentId) headers["x-test-student"] = studentId;
            const response = await fetch(`${baseUrl}${route}`, {
                method,
                headers,
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };
        const contractResponse = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: periodText,
            ngayKetThuc: endDate,
            sinhVien: [departedStudent, activeStudentA, activeStudentB].map((maSinhVien, index) => ({
                maSinhVien, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: index === 0
            }))
        });
        assert.equal(contractResponse.status, 201, JSON.stringify(contractResponse.body));
        const contractId = contractResponse.body.MaHopDong;
        const rentInvoicesByStudent = new Map((contractResponse.body.HoaDonTienPhong || [])
            .map(invoice => [invoice.MaSinhVien, invoice.MaHoaDon]));
        assert.equal(rentInvoicesByStudent.size, 3);
        const otherContractResponse = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomB,
            maHangPhong: fixture.tierId,
            ngayBatDau: periodText,
            ngayKetThuc: endDate,
            sinhVien: [{ maSinhVien: otherRoomStudent, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: true }]
        });
        assert.equal(otherContractResponse.status, 201, JSON.stringify(otherContractResponse.body));
        const otherRentInvoiceId = (otherContractResponse.body.HoaDonTienPhong || [])
            .find(invoice => invoice.MaSinhVien === otherRoomStudent)?.MaHoaDon;
        assert.ok(otherRentInvoiceId);
        const detailsResult = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaChiTiet, MaSinhVien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
            `);
        const details = new Map(detailsResult.recordset.map(row => [row.MaSinhVien, row.MaChiTiet]));
        const otherDetailsResult = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), otherContractResponse.body.MaHopDong)
            .query(`
                SELECT MaChiTiet, MaSinhVien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
            `);
        const otherDetails = new Map(otherDetailsResult.recordset.map(row => [row.MaSinhVien, row.MaChiTiet]));
        const overdueInvoice = async studentId => {
            const invoiceId = rentInvoicesByStudent.get(studentId) || otherRentInvoiceId;
            assert.ok(invoiceId, `No initial rent invoice for ${studentId}`);
            invoiceIds.add(invoiceId);
            await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .query("UPDATE dbo.HoaDon SET HanThanhToan = DATEADD(day, -1, CONVERT(date, SYSDATETIME())) WHERE MaHoaDon = @MaHoaDon");
            return invoiceId;
        };
        const rentInvoice = await overdueInvoice(departedStudent);
        const concurrencyInvoice = await overdueInvoice(activeStudentA);
        const paidInvoice = await overdueInvoice(otherRoomStudent);
        const leave = await call(
            "PUT", `/api/HopDong/${contractId}/chitiet/${details.get(departedStudent)}/roi`, "manager", null, {}
        );
        assert.equal(leave.status, 200, JSON.stringify(leave.body));

        const serviceResult = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
            loaiHoaDon: "DICH_VU_PHONG", maHopDong: contractId, kyThanhToan: periodText
        });
        assert.equal(serviceResult.status, 201, JSON.stringify(serviceResult.body));
        const serviceInvoice = serviceResult.body.MaHoaDon;
        invoiceIds.add(serviceInvoice);
        const expenseResult = await call("POST", "/api/ChiPhiPhatSinh", "manager", null, {
            maHopDong: contractId,
            maChiTiet: details.get(activeStudentB),
            noiDung: `Reminder test ${fixture.tierId}`,
            soTien: 250,
            ngayPhatSinh: periodText,
            hanDong: periodText,
            cheDoLap: "RIENG"
        });
        assert.equal(expenseResult.status, 201, JSON.stringify(expenseResult.body));
        const incidentInvoice = expenseResult.body.MaHoaDon;
        invoiceIds.add(incidentInvoice);

        await pool.request()
            .input("ServiceInvoice", sql.NVarChar(20), serviceInvoice)
            .input("IncidentInvoice", sql.NVarChar(20), incidentInvoice)
            .query(`
                UPDATE dbo.HoaDon
                SET HanThanhToan = DATEADD(day, -1, CONVERT(date, SYSDATETIME()))
                WHERE MaHoaDon IN (@ServiceInvoice, @IncidentInvoice)
            `);

        const rentReminder = await call("POST", `/api/HoaDon/${rentInvoice}/nhac-no`, "manager", null, {});
        assert.equal(rentReminder.status, 201, JSON.stringify(rentReminder.body));
        assert.equal(rentReminder.body.SoSinhVienNhan, 1);
        const repeatedRentReminder = await call("POST", `/api/HoaDon/${rentInvoice}/nhac-no`, "manager", null, {});
        assert.equal(repeatedRentReminder.status, 409);
        const serviceReminder = await call("POST", `/api/HoaDon/${serviceInvoice}/nhac-no`, "manager", null, {});
        const incidentReminder = await call("POST", `/api/HoaDon/${incidentInvoice}/nhac-no`, "manager", null, {});
        assert.equal(serviceReminder.status, 201, JSON.stringify(serviceReminder.body));
        assert.equal(serviceReminder.body.SoSinhVienNhan, 2);
        assert.equal(incidentReminder.status, 201, JSON.stringify(incidentReminder.body));
        assert.equal(incidentReminder.body.SoSinhVienNhan, 2);

        for (const [invoiceId, expected] of [
            [rentInvoice, [departedStudent]],
            [serviceInvoice, [activeStudentA, activeStudentB]],
            [incidentInvoice, [activeStudentA, activeStudentB]]
        ]) {
            const notices = await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .query(`
                    SELECT MaSinhVien, NguoiTao, NgayTao, TieuDe, NoiDung, DaXoa, MaSuKien
                    FROM dbo.ThongBao
                    WHERE MaHoaDon = @MaHoaDon
                `);
            const reminders = notices.recordset.filter(row =>
                row.MaSuKien?.startsWith(`REMINDER:${invoiceId}:`));
            assert.deepEqual(reminders.map(row => row.MaSinhVien).sort(), [...expected].sort());
            const invoiceNoticeRecipients = invoiceId === incidentInvoice
                ? [activeStudentB] : expected;
            const invoiceNotices = notices.recordset.filter(row => row.MaSuKien === `INVOICE:${invoiceId}`);
            assert.deepEqual(invoiceNotices.map(row => row.MaSinhVien).sort(), [...invoiceNoticeRecipients].sort());
            assert(notices.recordset.every(row => row.NguoiTao === fixture.managerId && row.NgayTao && row.DaXoa === false));
            assert(reminders.every(row => row.NoiDung.includes(invoiceId)));
            assert(invoiceNotices.every(row =>
                row.TieuDe.includes(invoiceId) || row.NoiDung.includes(invoiceId)));
            assert.equal(notices.recordset.some(row => row.MaSinhVien === otherRoomStudent), false);
        }

        const currentMembers = [...details.entries()]
            .filter(([studentId]) => studentId !== departedStudent)
            .map(([, detailId]) => detailId);
        const currentRoomMembers = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contractId)
            .query(`
                SELECT MaSinhVien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
            `);
        assert.deepEqual(currentRoomMembers.recordset.map(row => row.MaSinhVien).sort(),
            [activeStudentA, activeStudentB].sort());
        assert.equal(currentMembers.length, 2);

        const concurrent = await Promise.all([1, 2].map(() =>
            call("POST", `/api/HoaDon/${concurrencyInvoice}/nhac-no`, "manager", null, {})));
        assert.deepEqual(concurrent.map(result => result.status).sort(), [201, 409]);
        const concurrentCount = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), concurrencyInvoice)
            .query("SELECT COUNT_BIG(*) AS ReminderCount FROM dbo.ThongBao WHERE MaHoaDon = @MaHoaDon AND MaSuKien LIKE CONCAT(N'REMINDER:', @MaHoaDon, N':%')");
        assert.equal(Number(concurrentCount.recordset[0].ReminderCount), 1);

        const paidAmount = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), paidInvoice)
            .query(`
                SELECT v.TongThuc, v.ConNo
                FROM dbo.vw_HoaDonTongHop v
                WHERE v.MaHoaDon = @MaHoaDon
            `);
        const paid = await call("POST", `/api/HoaDon/${paidInvoice}/phieuthu`, "manager", null, {
            soTien: Number(paidAmount.recordset[0].TongThuc),
            phuongThuc: "CASH",
            trangThai: "Hợp lệ",
            maSinhVienNop: otherRoomStudent
        });
        assert.equal(paid.status, 201, JSON.stringify(paid.body));
        const paidReminder = await call("POST", `/api/HoaDon/${paidInvoice}/nhac-no`, "manager", null, {});
        assert.equal(paidReminder.status, 409);
        const noPaidReminder = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), paidInvoice)
            .query("SELECT COUNT_BIG(*) AS ReminderCount FROM dbo.ThongBao WHERE MaHoaDon = @MaHoaDon AND MaSuKien LIKE CONCAT(N'REMINDER:', @MaHoaDon, N':%')");
        assert.equal(Number(noPaidReminder.recordset[0].ReminderCount), 0);

        const otherRoomNotices = await call("GET", "/api/student/notifications", "student", otherRoomStudent);
        assert.equal(otherRoomNotices.status, 200);
        assert(otherRoomNotices.body.some(row => row.TieuDe.includes(paidInvoice)));
        assert.equal(otherRoomNotices.body.some(row =>
            [...invoiceIds].filter(invoiceId => invoiceId !== paidInvoice)
                .some(invoiceId => row.TieuDe.includes(invoiceId))), false);

        t.diagnostic(
            `Real SQL reminders on ${fixture.tierId}: TIEN_PHONG -> departed member only; DICH_VU_PHONG/PHAT_SINH -> current room members; other room excluded; duplicate blocked; concurrent result ${JSON.stringify(concurrent.map(result => result.status))}; fully paid invoice blocked; sender/time audited.`
        );
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool.connected && invoiceIds.size) {
            const cleanup = new sql.Transaction(pool);
            await cleanup.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            try {
                for (const invoiceId of invoiceIds) {
                    await new sql.Request(cleanup)
                        .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                        .query("UPDATE dbo.ThongBao SET DaXoa = 1 WHERE MaHoaDon = @MaHoaDon AND DaXoa = 0");
                }
                await cleanup.commit();
            } catch (error) {
                await cleanup.rollback();
                throw error;
            }
        }
        if (fixture) await cleanupSqlIntegrationFixture(pool, sql, fixture);
        await pool.close();
    }
});

test("real SQL Server QR demo records one valid receipt and blocks repeat or already-paid confirmation", {
    skip: process.env.DB_NAME !== "KTX_Group3_test"
        ? "Only runs when DB_NAME is explicitly set to KTX_Group3_test."
        : false
}, async t => {
    require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
    assert.equal(process.env.DB_NAME, "KTX_Group3_test");
    if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error("Thiếu cấu hình kết nối SQL Server; không thể chạy kiểm thử QR demo thật.");
    }
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT) || undefined,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, useUTC: true }
    }).connect();
    let server;
    let fixture;
    const fixtureEnvironment = {};
    for (const name of [
        "ALLOW_DEMO_PAYMENT", "PAYMENT_BANK_BIN", "PAYMENT_BANK_ACCOUNT_NO",
        "PAYMENT_BANK_ACCOUNT_NAME", "PAYMENT_WEBHOOK_SECRET"
    ]) fixtureEnvironment[name] = process.env[name];
    try {
        const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
        assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");
        fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 2,
            createOtherRoomStudent: false
        });
        const [studentA, studentB] = fixture.studentIds;
        const studentAccounts = new Map();
        for (const studentId of [studentA, studentB]) {
            const account = await pool.request()
                .input("Email", sql.VarChar(100), `${studentId.toLowerCase()}@gmail.com`)
                .input("TenHienThi", sql.NVarChar(100), `Demo ${studentId}`)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    INSERT INTO dbo.TaiKhoan (Email, MatKhau, TenHienThi, VaiTro, MaSinhVien)
                    OUTPUT inserted.MaTaiKhoan
                    VALUES (@Email, 'test-only-not-authenticated', @TenHienThi, N'Sinh viên', @MaSinhVien)
                `);
            studentAccounts.set(studentId, account.recordset[0].MaTaiKhoan);
        }

        const startDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
        const periodText = startDate.toISOString().slice(0, 10);
        const endDate = new Date(Date.UTC(
            startDate.getUTCFullYear() + 3, startDate.getUTCMonth(), startDate.getUTCDate()
        )).toISOString().slice(0, 10);
        const app = express();
        app.use(express.json());
        const authSecret = `integration-${crypto.randomBytes(24).toString("hex")}`;
        app.use("/api", createApiAuthenticationMiddleware({ jwt, getSecret: () => authSecret }));
        registerApiRoutes(app, {
            getPool: () => pool,
            sql,
            bcrypt: require("bcryptjs"),
            mapPaymentStatusToDatabase: value => ({
                PENDING: "PENDING",
                WAITING_CASH: "Chờ xác nhận",
                SUCCESS: "SUCCESS",
                REJECTED: "REJECTED",
                EXPIRED: "EXPIRED",
                RECONCILIATION: "RECONCILIATION",
                "Hợp lệ": "Hợp lệ",
                "Chờ xác nhận": "Chờ xác nhận",
                "Đã hủy": "Đã hủy"
            })[value] || null,
            mapPaymentMethodToDatabase: value => ({
                CASH: "CASH", ONLINE: "ONLINE", CHUYEN_DOI: "CHUYEN_DOI"
            })[value] || null,
            rollback: async transaction => transaction.rollback()
        });
        await new Promise((resolve, reject) => {
            server = app.listen(0, "127.0.0.1", resolve);
            server.once("error", reject);
        });
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        const call = async (method, route, role, studentId, body) => {
            const headers = {};
            if (body !== undefined) headers["Content-Type"] = "application/json";
            if (role) {
                const payload = role === "manager"
                    ? { sub: String(fixture.managerId), role: "Quản lý" }
                    : role === "admin"
                        ? { sub: String(fixture.managerId), role: "Admin" }
                        : {
                            sub: String(studentAccounts.get(studentId)),
                            role: "Sinh viên",
                            studentId
                        };
                headers.Authorization = `Bearer ${jwt.sign(payload, authSecret)}`;
            }
            const response = await fetch(`${baseUrl}${route}`, {
                method,
                headers,
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };
        const invalidContractDates = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: periodText,
            ngayKetThuc: periodText,
            sinhVien: [{ maSinhVien: studentA, kyHanThanhToanPhong: "THANG" }]
        });
        assert.equal(invalidContractDates.status, 400);
        assert.equal(invalidContractDates.body.message, "Ngày kết thúc phải sau ngày bắt đầu.");
        const contract = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomA,
            maHangPhong: fixture.tierId,
            ngayBatDau: periodText,
            ngayKetThuc: endDate,
            sinhVien: [studentA, studentB].map((maSinhVien, index) => ({
                maSinhVien, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: index === 0
            }))
        });
        assert.equal(contract.status, 201, JSON.stringify(contract.body));
        const invoiceIds = new Map((contract.body.HoaDonTienPhong || [])
            .map(invoice => [invoice.MaSinhVien, invoice.MaHoaDon]));
        assert.equal(invoiceIds.size, 2);
        for (const studentId of [studentA, studentB]) {
            const invoiceId = invoiceIds.get(studentId);
            await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .query(`
                    UPDATE dbo.ChiTietHoaDon
                    SET SoTien = 300, DonGia = 300
                    WHERE MaHoaDon = @MaHoaDon
                `);
        }

        Object.assign(process.env, {
            ALLOW_DEMO_PAYMENT: "false",
            PAYMENT_BANK_BIN: "970415",
            PAYMENT_BANK_ACCOUNT_NO: "123456789012",
            PAYMENT_BANK_ACCOUNT_NAME: "KTX TEST",
            PAYMENT_WEBHOOK_SECRET: `test-${crypto.randomBytes(24).toString("hex")}`
        });
        const invoiceA = invoiceIds.get(studentA);
        const requestA = await call("POST", "/api/payments/create", "student", studentA, {
            MaHoaDon: invoiceA, PhuongThuc: "ONLINE"
        });
        assert.equal(requestA.status, 201, JSON.stringify(requestA.body));
        const disabledDemo = await call("POST", "/api/payments/demo-confirm", "student", studentA, {
            MaHoaDon: invoiceA, MaGiaoDich: requestA.body.MaGiaoDich
        });
        assert.equal(disabledDemo.status, 503);
        assert.equal(disabledDemo.body.message, "Thanh toán QR demo đang tắt.");
        const qrOff = await call("GET", `/api/payments/qr?MaHoaDon=${invoiceA}`, "student", studentA);
        assert.equal(qrOff.status, 200);
        assert.equal(qrOff.body.DemoPaymentEnabled, false);
        assert.equal(qrOff.body.MaGiaoDich, requestA.body.MaGiaoDich);
        assert.equal(qrOff.body.NoiDungCK, requestA.body.NoiDungCK);
        assert.match(qrOff.body.NoiDungCK, /^KTX[A-F0-9]{20}$/);

        process.env.ALLOW_DEMO_PAYMENT = "true";
        const qrOn = await call("GET", `/api/payments/qr?MaHoaDon=${invoiceA}`, "student", studentA);
        assert.equal(qrOn.status, 200);
        assert.equal(qrOn.body.DemoPaymentEnabled, true);
        assert.equal(qrOn.body.NoiDungCK, requestA.body.NoiDungCK);
        const wrongOwnerDemo = await call("POST", "/api/payments/demo-confirm", "student", studentB, {
            MaHoaDon: invoiceA, MaGiaoDich: requestA.body.MaGiaoDich
        });
        assert.equal(wrongOwnerDemo.status, 403);
        const confirmedA = await call("POST", "/api/payments/demo-confirm", "student", studentA, {
            MaHoaDon: invoiceA, MaGiaoDich: requestA.body.MaGiaoDich, SoTien: 300
        });
        assert.equal(confirmedA.status, 200, JSON.stringify(confirmedA.body));
        assert.equal(confirmedA.body.PhuongThuc, "QR_DEMO");
        assert.equal(confirmedA.body.SoTien, 300);
        const invoiceListA = await call("GET", "/api/HoaDon", "student", studentA);
        assert.equal(invoiceListA.status, 200);
        assert.equal(invoiceListA.body.find(invoice => invoice.MaHoaDon === invoiceA)?.TrangThaiThanhToan,
            "Đã thanh toán");
        const historyA = await call("GET", `/api/payments/history?MaHoaDon=${invoiceA}`, "student", studentA);
        assert.equal(historyA.status, 200);
        assert.equal(historyA.body.some(payment =>
            payment.MaGiaoDich === requestA.body.MaGiaoDich && payment.TrangThai === "SUCCESS"), true);
        const adminDemo = await call("POST", "/api/payments/demo-confirm", "admin", null, {
            MaHoaDon: invoiceA, MaGiaoDich: requestA.body.MaGiaoDich
        });
        assert.equal(adminDemo.status, 403);
        const anonymousDemo = await call("POST", "/api/payments/demo-confirm", null, null, {
            MaHoaDon: invoiceA, MaGiaoDich: requestA.body.MaGiaoDich
        });
        assert.equal(anonymousDemo.status, 401);
        const managerRequests = await call("GET", "/api/requests", "manager", null);
        assert.equal(managerRequests.status, 200);
        const studentRequests = await call("GET", "/api/requests", "student", studentA);
        assert.equal(studentRequests.status, 403);
        const repeatedA = await call("POST", "/api/payments/demo-confirm", "student", studentA, {
            MaHoaDon: invoiceA, MaGiaoDich: requestA.body.MaGiaoDich, SoTien: 300
        });
        assert.equal(repeatedA.status, 409);

        const lateTransactionId = `PAY-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
        await pool.request()
            .input("MaGiaoDich", sql.NVarChar(60), lateTransactionId)
            .input("MaSinhVien", sql.NVarChar(30), studentA)
            .input("NoiDungCK", sql.NVarChar(100), `KTX ${invoiceA}`)
            .query(`
                INSERT INTO dbo.GiaoDichThanhToan
                    (MaGiaoDich, MaSinhVien, TongTien, PhuongThuc, TrangThai, NoiDungCK)
                VALUES (@MaGiaoDich, @MaSinhVien, 300, N'ONLINE', N'PENDING', @NoiDungCK)
            `);
        await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), invoiceA)
            .input("SoTien", sql.Decimal(18, 2), 300)
            .input("PhuongThuc", sql.NVarChar(20), "ONLINE")
            .input("MaSinhVienNop", sql.NVarChar(30), studentA)
            .input("TrangThai", sql.NVarChar(20), "Chờ xác nhận")
            .input("MaGiaoDich", sql.NVarChar(60), lateTransactionId)
            .execute("dbo.sp_GhiPhieuThu");
        const lateDemo = await call("POST", "/api/payments/demo-confirm", "student", studentA, {
            MaHoaDon: invoiceA, MaGiaoDich: lateTransactionId
        });
        assert.equal(lateDemo.status, 409);
        assert.equal(lateDemo.body.message, "Hóa đơn đã thanh toán đủ, không ghi nhận thêm.");

        const invoiceB = invoiceIds.get(studentB);
        const requestB = await call("POST", "/api/payments/create", "student", studentB, {
            MaHoaDon: invoiceB, PhuongThuc: "ONLINE"
        });
        assert.equal(requestB.status, 201, JSON.stringify(requestB.body));
        const concurrentResults = await Promise.all([1, 2].map(() =>
            call("POST", "/api/payments/demo-confirm", "student", studentB, {
                MaHoaDon: invoiceB, MaGiaoDich: requestB.body.MaGiaoDich, SoTien: 300
            })));
        assert.deepEqual(concurrentResults.map(result => result.status).sort(), [200, 409]);

        const totals = await pool.request()
            .input("InvoiceA", sql.NVarChar(20), invoiceA)
            .input("InvoiceB", sql.NVarChar(20), invoiceB)
            .input("MaGiaoDichLate", sql.NVarChar(60), lateTransactionId)
            .query(`
                SELECT hd.MaHoaDon, v.TongThuc, v.DaThu, v.ConNo,
                       SUM(CASE WHEN pt.TrangThai = N'Hợp lệ' THEN pt.SoTien ELSE 0 END) AS ThuHopLe,
                       SUM(CASE WHEN gd.TrangThai = N'RECONCILIATION' THEN pt.SoTien ELSE 0 END) AS KhongGhiNhan,
                       SUM(CASE WHEN pt.MaThamChieu LIKE N'QR-DEMO:%'
                                 AND pt.TrangThai = N'Hợp lệ' THEN 1 ELSE 0 END) AS SoPhieuQrDemo,
                       SUM(CASE WHEN pt.MaThamChieu LIKE N'QR-DEMO:%'
                                 AND gd.TrangThai = N'RECONCILIATION' THEN 1 ELSE 0 END) AS SoQrKhongGhiNhan
                FROM dbo.HoaDon hd
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                LEFT JOIN dbo.PhieuThu pt ON pt.MaHoaDon = hd.MaHoaDon
                LEFT JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = pt.MaGiaoDich
                WHERE hd.MaHoaDon IN (@InvoiceA, @InvoiceB)
                GROUP BY hd.MaHoaDon, v.TongThuc, v.DaThu, v.ConNo
            `);
        assert.equal(totals.recordset.length, 2);
        for (const row of totals.recordset) {
            assert.equal(Number(row.TongThuc), 300);
            assert.equal(Number(row.DaThu), 300);
            assert.equal(Number(row.ConNo), 0);
            assert.equal(Number(row.ThuHopLe), 300);
            assert.equal(Number(row.SoPhieuQrDemo), 1);
            assert.equal(Number(row.KhongGhiNhan), 0);
            assert.equal(Number(row.SoQrKhongGhiNhan), 0);
        }
        const rejectedTransaction = await pool.request()
            .input("MaGiaoDich", sql.NVarChar(60), lateTransactionId)
            .query(`
                SELECT gd.TrangThai, pt.TrangThai AS TrangThaiPhieuThu,
                       pt.PhuongThuc, pt.MaThamChieu, pt.GhiChu
                FROM dbo.GiaoDichThanhToan gd
                INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                WHERE gd.MaGiaoDich = @MaGiaoDich
            `);
        assert.equal(rejectedTransaction.recordset[0].TrangThai, "PENDING");
        assert.equal(rejectedTransaction.recordset[0].TrangThaiPhieuThu, "Chờ xác nhận");
        assert.equal(rejectedTransaction.recordset[0].PhuongThuc, "ONLINE");
        assert.equal(rejectedTransaction.recordset[0].MaThamChieu, null);
        assert.equal(rejectedTransaction.recordset[0].GhiChu, null);

        const revenueConsistency = await pool.request().query(`
            SELECT report.TongThu AS BaoCaoThang,
                   ISNULL(receipts.TongThuHopLe, 0) AS TongPhieuThuHopLe
            FROM dbo.vw_DoanhThuThang report
            OUTER APPLY (
                SELECT SUM(pt.SoTien) AS TongThuHopLe
                FROM dbo.PhieuThu pt
                WHERE pt.TrangThai = N'Hợp lệ'
                  AND YEAR(pt.NgayThu) = report.Nam
                  AND MONTH(pt.NgayThu) = report.Thang
            ) receipts
            WHERE report.Nam = YEAR(SYSDATETIME()) AND report.Thang = MONTH(SYSDATETIME())
        `);
        assert.equal(
            Number(revenueConsistency.recordset[0].BaoCaoThang),
            Number(revenueConsistency.recordset[0].TongPhieuThuHopLe)
        );
        t.diagnostic(
            `Real SQL QR demo: invoices ${invoiceA}/${invoiceB} each have exactly one valid 300 VND receipt; same-code repeat blocked; concurrent confirmations ${JSON.stringify(concurrentResults.map(result => result.status))}; late overpayment is RECONCILIATION and remains excluded from paid balance.`
        );
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        for (const [name, value] of Object.entries(fixtureEnvironment)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
        if (fixture) await cleanupSqlIntegrationFixture(pool, sql, fixture);
        await pool.close();
    }
});
