const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const sql = require("mssql");
const registerApiRoutes = require("./api-routes");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createLoginHandler, createRegistrationHandler } = require("./student-auth");

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

async function createSqlIntegrationFixture(pool, sql, {
    roomMemberCount = 3,
    unassignedCount = 0,
    createOtherRoomStudent = true
} = {}) {
    const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
    assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");

    const suffix = crypto.randomBytes(6).toString("hex").toUpperCase();
    const fixture = {
        managerEmail: `b5-${suffix.toLowerCase()}@example.test`,
        tierId: `T5HP${suffix}`,
        tierName: `B5 fixture ${suffix}`,
        serviceId: `T5DV${suffix}`,
        serviceName: `B5 service ${suffix}`,
        roomA: `T5-${suffix}-A`,
        roomB: `T5-${suffix}-B`,
        studentIds: Array.from(
            { length: roomMemberCount + unassignedCount + Number(createOtherRoomStudent) },
            (_, index) => `T5${suffix}${String.fromCharCode(65 + index)}`
        )
    };

    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let committed = false;
    try {
        const manager = await new sql.Request(transaction)
            .input("Email", sql.VarChar(100), fixture.managerEmail)
            .input("TenHienThi", sql.NVarChar(100), `B5 manager ${suffix}`)
            .query(`
                INSERT INTO dbo.TaiKhoan (Email, MatKhau, TenHienThi, VaiTro)
                OUTPUT inserted.MaTaiKhoan
                VALUES (@Email, 'test-only-not-authenticated', @TenHienThi, N'Quản lý')
            `);
        fixture.managerId = manager.recordset[0].MaTaiKhoan;

        await new sql.Request(transaction)
            .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
            .input("TenHangPhong", sql.NVarChar(100), fixture.tierName)
            .query(`
                INSERT INTO dbo.HangPhong
                    (MaHangPhong, TenHangPhong, SucChuaToiDa, GiaPhongThang, GiaPhongNam)
                VALUES (@MaHangPhong, @TenHangPhong, 4, 1200000, 14400000)
            `);
        await new sql.Request(transaction)
            .input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
            .input("TenDichVu", sql.NVarChar(100), fixture.serviceName)
            .query(`
                INSERT INTO dbo.DichVu (MaDichVu, TenDichVu, DonVi, HoatDong)
                VALUES (@MaDichVu, @TenDichVu, N'lần', 1)
            `);
        await new sql.Request(transaction)
            .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
            .input("MaDichVu", sql.NVarChar(20), fixture.serviceId)
            .query(`
                INSERT INTO dbo.HangPhong_DichVu
                    (MaHangPhong, MaDichVu, DonGia, CachTinh, DoiTuongThanhToan, HoatDong)
                VALUES (@MaHangPhong, @MaDichVu, 1000, N'CO_DINH_KY', N'PHONG', 1)
            `);

        for (const roomName of [fixture.roomA, fixture.roomB]) {
            await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), roomName)
                .input("MaHangPhong", sql.NVarChar(20), fixture.tierId)
                .query(`
                    INSERT INTO dbo.Phong
                        (TenPhong, Khu, LoaiPhong, SucChuaToiDa, MaHangPhong,
                         SoSinhVienHienTai, TrangThaiPhong, GhiChu)
                    VALUES (@TenPhong, N'C', N'Nam', 4, @MaHangPhong, 0, N'Trống', N'B5 isolated SQL fixture')
                `);
        }

        for (let index = 0; index < fixture.studentIds.length; index++) {
            const studentId = fixture.studentIds[index];
            await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("Email", sql.NVarChar(100), `${studentId.toLowerCase()}@example.test`)
                .query(`
                    INSERT INTO dbo.SinhVien
                        (MaSinhVien, HoTen, GioiTinh, Email, TrangThaiSinhVien, TenPhong)
                    VALUES (@MaSinhVien, @MaSinhVien, N'Nam', @Email, NULL, NULL)
                `);
        }
        await transaction.commit();
        committed = true;
        return fixture;
    } catch (error) {
        if (!committed) await transaction.rollback();
        throw error;
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

test("contract endpoints validate and create contracts through sp_TaoHopDong", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT p.MaHangPhong")
            ? { recordset: [{ MaHangPhong: "HP4" }] }
            : { recordset: [], rowsAffected: [1] }
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
    assert.equal(created.statusCode, 201);
    assert.equal(harness.executions.at(-1).procedure, "dbo.sp_TaoHopDong");
    assert.deepEqual(JSON.parse(harness.executions.at(-1).inputs.SinhVienJson), [{
        maSinhVien: "SV001", kyHanThanhToanPhong: "THANG", laNguoiDaiDien: true
    }]);
    assert.equal(harness.transactions.at(-1).state, "committed");

    const invalid = await invoke(harness, "post", "/api/HopDong", {
        body: { tenPhong: "A101", sinhVien: [] }
    });
    assert.equal(invalid.statusCode, 400);
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

test("extend, end, move, add-member, and leave-member routes call the contract procedures", async () => {
    const harness = fakeApi({
        queryResult: call => call.statement.includes("SELECT c.MaChiTiet")
            ? { recordset: [{ MaChiTiet: 9 }] }
            : { recordset: [{ MaChiTiet: 9 }], rowsAffected: [1] }
    });
    for (const [url, body, expected] of [
        ["/api/HopDong/:id/gia-han", { ngayKetThuc: "2028-01-01" }, "dbo.sp_GiaHanHopDong"],
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
        executeError: () => Object.assign(new Error("raw SQL secret"), { number: 51439 })
    });
    const exists = await invoke(harness, "put", "/api/HopDong/:id/gia-han", {
        params: { id: "EXISTS" }, body: { ngayKetThuc: "2028-01-01" }
    });
    assert.equal(exists.statusCode, 409);
    assert.match(exists.body.message, /không còn hiệu lực/);
    assert.doesNotMatch(exists.body.message, /raw SQL/);

    const missing = await invoke(harness, "put", "/api/HopDong/:id/gia-han", {
        params: { id: "MISSING" }, body: { ngayKetThuc: "2028-01-01" }
    });
    assert.equal(missing.statusCode, 404);

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

test("missing versus inactive contract/member procedure errors are probed from their tables", async () => {
    for (const { code, route, method, body, params, probeInput, expected } of [
        { code: 51432, route: "/api/HopDong/:id/chitiet", method: "post",
            body: { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, params: { id: "HD1" },
            probeInput: { MaHopDong: "HD1" }, expected: 409 },
        { code: 51436, route: "/api/HopDong/:id/chitiet/:maChiTiet/roi", method: "put",
            body: {}, params: { id: "HD1", maChiTiet: "8" },
            probeInput: { MaChiTiet: 8 }, expected: 409 },
        { code: 51439, route: "/api/HopDong/:id/gia-han", method: "put",
            body: { ngayKetThuc: "2028-01-01" }, params: { id: "HD1" },
            probeInput: { MaHopDong: "HD1" }, expected: 409 }
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
            if (call.statement.includes("SELECT sv.MaSinhVien, sv.TenPhong")) {
                return { recordset: [{ MaSinhVien: "SV001", TenPhong: "A101", MaChiTiet: null }] };
            }
            if (call.statement.includes("SELECT CAST(GETDATE()")) {
                return { recordset: [{ NgayBatDau: new Date("2026-10-01"), NgayKetThuc: new Date("2027-10-01") }] };
            }
            return { recordset: [], rowsAffected: [1] };
        }
    });
    const created = await invoke(harness, "post", "/api/sinhvien", {
        body: {
            MaSinhVien: "012345678901", HoTen: "Student", GioiTinh: "Nam", SoDienThoai: "0123456789",
            Email: "student@example.com", TenPhong: "A101"
        }
    });
    assert.equal(created.statusCode, 201);
    assert(harness.executions.some(call => call.procedure === "dbo.sp_ThemSinhVienVaoHopDong"));
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
            if (call.statement.includes("SELECT MaHoaDon FROM dbo.HoaDon")) {
                return { recordset: [{ MaHoaDon: "INV2026100011" }] };
            }
            return { recordset: [], rowsAffected: [1] };
        },
        executeResult: call => call.procedure === "dbo.sp_GhiPhieuThu"
            ? { recordset: [{ MaPhieuThu: 93 }] }
            : { recordset: [] }
    });
    const invalid = await invoke(harness, "post", "/api/HoaDon/:id/phieuthu", {
        params: { id: "INV2026100011" },
        body: { soTien: "100", phuongThuc: "CASH", trangThai: "Hợp lệ" }
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(harness.executions.length, 0);

    const created = await invoke(harness, "post", "/api/HoaDon/:id/phieuthu", {
        params: { id: "INV2026100011" },
        body: { soTien: 100, phuongThuc: "CASH", trangThai: "Hợp lệ" }
    });
    assert.equal(created.statusCode, 201);
    assert.equal(harness.executions.at(-1).procedure, "dbo.sp_GhiPhieuThu");
    assert.equal(harness.executions.at(-1).inputs.SoTien, 100);
    assert.equal(harness.transactions.at(-1).state, "committed");

    const confirmation = await invoke(harness, "put", "/api/phieuthu/:id/xac-nhan", {
        params: { id: "93" }, body: {}
    });
    assert.equal(confirmation.statusCode, 200);
    assert.equal(harness.executions.at(-1).procedure, "dbo.sp_XacNhanPhieuThu");
});

test("student payment requests are scoped to their contract and reject invalid or foreign invoices", async () => {
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

    const foreign = await invoke(harness, "post", "/api/payments/create", {
        auth: { role: "Sinh viên", studentId: "SV001" },
        body: { MaHoaDon: "INV2026100011", SoTien: 100, PhuongThuc: "CASH" }
    });
    assert.equal(foreign.statusCode, 404);
    assert.equal(harness.queries[0].inputs.MaSinhVien, "SV001");
    assert.match(harness.queries[0].statement, /ChiTietHopDong/);
    assert.equal(harness.executions.length, 0);
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
                SoTien: 100, TrangThaiPhieuThu: "Hợp lệ"
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
        assert.equal(harness.executions.length, 0);
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
                    MaHoaDon: "INV2026100011", TongThuc: 300, ConNo: 200, SoKhoan: 1
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
            body: { MaHoaDon: "INV2026100011", SoTien: 100, PhuongThuc: "ONLINE" }
        });
        assert.equal(payment.statusCode, 201);
        assert.equal(harness.executions.at(-1).procedure, "dbo.sp_GhiPhieuThu");
        assert.equal(harness.executions.at(-1).inputs.MaSinhVienNop, "SV002");
        assert.match(harness.queries[0].statement, /ownerDetail\.MaSinhVien = @MaSinhVien/);

        const qr = await invoke(harness, "get", "/api/payments/qr", {
            auth: { role: "Sinh viên", studentId: "SV002" },
            query: { MaHoaDon: "INV2026100011", SoTien: "100" }
        });
        assert.equal(qr.statusCode, 200);
        assert.equal(qr.body.TongTien, 100);
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

test("real SQL Server money APIs enforce room ownership, webhook idempotency, and concurrent receipts", {
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
    const originalEnvironment = {
        PAYMENT_BANK_BIN: process.env.PAYMENT_BANK_BIN,
        PAYMENT_BANK_ACCOUNT_NO: process.env.PAYMENT_BANK_ACCOUNT_NO,
        PAYMENT_BANK_ACCOUNT_NAME: process.env.PAYMENT_BANK_ACCOUNT_NAME,
        PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET
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
        const fixture = await createSqlIntegrationFixture(pool, sql, {
            roomMemberCount: 3,
            createOtherRoomStudent: true
        });
        const [departingStudent, nextRepresentative, payer, otherRoomStudent] = fixture.studentIds;
        const startDate = new Date(Date.UTC(
            new Date().getUTCFullYear(), new Date().getUTCMonth(), 1
        ));
        const periodText = startDate.toISOString().slice(0, 10);
        const endDate = new Date(Date.UTC(
            startDate.getUTCFullYear() + 3, startDate.getUTCMonth(), startDate.getUTCDate()
        )).toISOString().slice(0, 10);

        const secret = `test-${crypto.randomBytes(24).toString("hex")}`;
        Object.assign(process.env, {
            PAYMENT_BANK_BIN: "970415",
            PAYMENT_BANK_ACCOUNT_NO: "123456789012",
            PAYMENT_BANK_ACCOUNT_NAME: "KTX TEST",
            PAYMENT_WEBHOOK_SECRET: secret
        });

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

        const postRentInvoice = async member => call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
            loaiHoaDon: "TIEN_PHONG",
            maChiTiet: member.MaChiTiet,
            kyThanhToan: periodText
        });
        const rentInvoiceResponse = await postRentInvoice(departingMember);
        assert.equal(rentInvoiceResponse.status, 201, JSON.stringify(rentInvoiceResponse.body));
        const rentInvoiceId = rentInvoiceResponse.body.MaHoaDon;
        const otherRoomRentResponse = await postRentInvoice({
            MaChiTiet: (await pool.request()
                .input("MaHopDong", sql.NVarChar(20), otherContractId)
                .query(`
                    SELECT TOP (1) MaChiTiet
                    FROM dbo.ChiTietHopDong
                    WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
                `)).recordset[0].MaChiTiet
        });
        assert.equal(otherRoomRentResponse.status, 201, JSON.stringify(otherRoomRentResponse.body));
        const otherRoomInvoiceId = otherRoomRentResponse.body.MaHoaDon;

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
            ngayPhatSinh: periodText
        });
        assert.equal(expenseResponse.status, 201, JSON.stringify(expenseResponse.body));
        const incidentInvoiceResponse = await call(
            "POST",
            `/api/ChiPhiPhatSinh/${expenseResponse.body.MaChiPhi}/tao-hoa-don`,
            "manager",
            null,
            {}
        );
        assert.equal(incidentInvoiceResponse.status, 201, JSON.stringify(incidentInvoiceResponse.body));
        const incidentInvoiceId = incidentInvoiceResponse.body.MaHoaDon;
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
        assert.equal(otherRoomCannotPay.status, 404);

        const firstPayment = Math.min(100, total - 1);
        const paymentRequest = await call("POST", "/api/payments/create", "student", payer, {
            MaHoaDon: serviceInvoiceId, SoTien: firstPayment, PhuongThuc: "ONLINE"
        });
        assert.equal(paymentRequest.status, 201, JSON.stringify(paymentRequest.body));
        const webhookPayload = {
            MaHoaDon: serviceInvoiceId,
            SoTien: firstPayment,
            MaThamChieuNgoai: `B5-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
            NoiDungCK: paymentRequest.body.NoiDungCK
        };
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
        assert.equal(duplicateWebhook.status, 200, JSON.stringify(duplicateWebhook.body));
        assert.equal(duplicateWebhook.body.alreadyProcessed, true);
        const receiptCountAfterDuplicateWebhook = await pool.request()
            .input("MaGiaoDich", sql.NVarChar(60), paymentRequest.body.MaGiaoDich)
            .query(`
                SELECT COUNT_BIG(*) AS SoPhieuThu
                FROM dbo.PhieuThu
                WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'Hợp lệ'
            `);
        assert.equal(Number(receiptCountAfterDuplicateWebhook.recordset[0].SoPhieuThu), 1);

        const remaining = total - firstPayment;
        const competingReceipts = await Promise.all([1, 2].map(() => call(
            "POST", `/api/HoaDon/${serviceInvoiceId}/phieuthu`, "manager", null, {
                soTien: remaining,
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
        const lateWebhookPayload = {
            MaHoaDon: incidentInvoiceId,
            SoTien: lateWebhookAmount,
            MaThamChieuNgoai: `B5-LATE-${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
            NoiDungCK: pendingLateWebhook.body.NoiDungCK
        };
        const lateWebhook = await webhookCall(lateWebhookPayload);
        assert.equal(lateWebhook.status, 200, JSON.stringify(lateWebhook.body));
        assert.equal(lateWebhook.body.needsReconciliation, true);
        const reconciliation = await pool.request()
            .input("MaHoaDon", sql.NVarChar(20), incidentInvoiceId)
            .input("MaThamChieuNgoai", sql.NVarChar(100), lateWebhookPayload.MaThamChieuNgoai)
            .query(`
                SELECT gd.TrangThai, gd.LyDoDoiSoat, v.TongThuc, v.DaThu, v.ConNo,
                       receipts.ThuHopLe, receipts.SoPhieuThu, receipts.SoChoXacNhan
                FROM dbo.GiaoDichThanhToan gd
                INNER JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = pt.MaHoaDon
                CROSS APPLY (
                    SELECT SUM(CASE WHEN allReceipts.TrangThai = N'Hợp lệ'
                                    THEN allReceipts.SoTien ELSE 0 END) AS ThuHopLe,
                           COUNT_BIG(*) AS SoPhieuThu,
                           SUM(CASE WHEN allReceipts.TrangThai = N'Chờ xác nhận'
                                    THEN 1 ELSE 0 END) AS SoChoXacNhan
                    FROM dbo.PhieuThu allReceipts
                    WHERE allReceipts.MaHoaDon = @MaHoaDon
                ) receipts
                WHERE pt.MaHoaDon = @MaHoaDon AND gd.MaThamChieuNgoai = @MaThamChieuNgoai
            `);
        assert.equal(reconciliation.recordset[0].TrangThai, "RECONCILIATION");
        assert.match(reconciliation.recordset[0].LyDoDoiSoat, /vượt tổng hóa đơn/);
        assert.equal(Number(reconciliation.recordset[0].TongThuc), lateWebhookAmount);
        assert.equal(Number(reconciliation.recordset[0].DaThu), lateWebhookAmount);
        assert.equal(Number(reconciliation.recordset[0].ConNo), 0);
        assert.equal(Number(reconciliation.recordset[0].ThuHopLe), lateWebhookAmount);
        assert.equal(Number(reconciliation.recordset[0].SoPhieuThu), 2);
        assert.equal(Number(reconciliation.recordset[0].SoChoXacNhan), 1);
        t.diagnostic(
            `Self-seeded fixture ${fixture.tierId}: departed member retained rent access and lost room invoice access; other-room access denied; duplicate webhook idempotent; concurrent receipts ${JSON.stringify(competingReceipts.map(result => result.status))}; late webhook returned 200 and was marked RECONCILIATION without extra valid receipts.`
        );
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        restoreEnvironment();
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
        const otherContractResponse = await call("POST", "/api/HopDong", "manager", null, {
            tenPhong: fixture.roomB,
            maHangPhong: fixture.tierId,
            ngayBatDau: periodText,
            ngayKetThuc: endDate,
            sinhVien: [{ maSinhVien: otherRoomStudent, kyHanThanhToanPhong: "THANG", laNguoiDaiDien: true }]
        });
        assert.equal(otherContractResponse.status, 201, JSON.stringify(otherContractResponse.body));
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
            const result = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
                loaiHoaDon: "TIEN_PHONG",
                maChiTiet: details.get(studentId) || otherDetails.get(studentId),
                kyThanhToan: periodText
            });
            assert.equal(result.status, 201, JSON.stringify(result.body));
            invoiceIds.add(result.body.MaHoaDon);
            await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), result.body.MaHoaDon)
                .query("UPDATE dbo.HoaDon SET HanThanhToan = DATEADD(day, -1, CONVERT(date, SYSDATETIME())) WHERE MaHoaDon = @MaHoaDon");
            return result.body.MaHoaDon;
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
            ngayPhatSinh: periodText
        });
        assert.equal(expenseResult.status, 201, JSON.stringify(expenseResult.body));
        const incidentResult = await call(
            "POST", `/api/ChiPhiPhatSinh/${expenseResult.body.MaChiPhi}/tao-hoa-don`, "manager", null, {}
        );
        assert.equal(incidentResult.status, 201, JSON.stringify(incidentResult.body));
        const incidentInvoice = incidentResult.body.MaHoaDon;
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
                    SELECT MaSinhVien, NguoiTao, NgayTao, TieuDe, NoiDung, DaXoa
                    FROM dbo.ThongBao
                    WHERE MaHoaDon = @MaHoaDon
                `);
            assert.deepEqual(notices.recordset.map(row => row.MaSinhVien).sort(), [...expected].sort());
            assert(notices.recordset.every(row => row.NguoiTao === fixture.managerId && row.NgayTao && row.DaXoa === false));
            assert(notices.recordset.every(row => row.NoiDung.includes(invoiceId)));
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
            .query("SELECT COUNT_BIG(*) AS ReminderCount FROM dbo.ThongBao WHERE MaHoaDon = @MaHoaDon");
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
            .query("SELECT COUNT_BIG(*) AS ReminderCount FROM dbo.ThongBao WHERE MaHoaDon = @MaHoaDon");
        assert.equal(Number(noPaidReminder.recordset[0].ReminderCount), 0);

        const otherRoomNotices = await call("GET", "/api/student/notifications", "student", otherRoomStudent);
        assert.equal(otherRoomNotices.status, 200);
        assert.equal(otherRoomNotices.body.some(row =>
            [...invoiceIds].some(invoiceId => row.TieuDe.includes(invoiceId))), false);

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
        await pool.close();
    }
});

test("real SQL Server QR demo records one valid receipt, blocks repeats, and reconciles overpayment", {
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
    const fixtureEnvironment = {};
    for (const name of [
        "ALLOW_DEMO_PAYMENT", "PAYMENT_BANK_BIN", "PAYMENT_BANK_ACCOUNT_NO",
        "PAYMENT_BANK_ACCOUNT_NAME", "PAYMENT_WEBHOOK_SECRET"
    ]) fixtureEnvironment[name] = process.env[name];
    try {
        const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
        assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");
        const fixture = await createSqlIntegrationFixture(pool, sql, {
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
        app.use((req, _res, next) => {
            if (req.get("x-test-role") === "manager") {
                req.auth = { accountId: fixture.managerId, role: "Quản lý" };
            } else if (req.get("x-test-role") === "student") {
                const studentId = req.get("x-test-student");
                req.auth = {
                    accountId: studentAccounts.get(studentId),
                    role: "Sinh viên",
                    studentId
                };
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
            if (role) headers["x-test-role"] = role;
            if (studentId) headers["x-test-student"] = studentId;
            const response = await fetch(`${baseUrl}${route}`, {
                method,
                headers,
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            return { status: response.status, body: await response.json() };
        };
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
        const members = await pool.request()
            .input("MaHopDong", sql.NVarChar(20), contract.body.MaHopDong)
            .query(`
                SELECT MaChiTiet, MaSinhVien
                FROM dbo.ChiTietHopDong
                WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
            `);
        const memberDetails = new Map(members.recordset.map(row => [row.MaSinhVien, row.MaChiTiet]));
        const invoiceIds = new Map();
        for (const studentId of [studentA, studentB]) {
            const invoice = await call("POST", "/api/HoaDon/xuat-ky", "manager", null, {
                loaiHoaDon: "TIEN_PHONG",
                maChiTiet: memberDetails.get(studentId),
                kyThanhToan: periodText
            });
            assert.equal(invoice.status, 201, JSON.stringify(invoice.body));
            invoiceIds.set(studentId, invoice.body.MaHoaDon);
            await pool.request()
                .input("MaHoaDon", sql.NVarChar(20), invoice.body.MaHoaDon)
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
        const confirmedA = await call("POST", "/api/payments/demo-confirm", "student", studentA, {
            MaHoaDon: invoiceA, MaGiaoDich: requestA.body.MaGiaoDich
        });
        assert.equal(confirmedA.status, 200, JSON.stringify(confirmedA.body));
        assert.equal(confirmedA.body.PhuongThuc, "QR_DEMO");
        assert.equal(confirmedA.body.SoTien, 300);
        const repeatedA = await call("POST", "/api/payments/demo-confirm", "student", studentA, {
            MaHoaDon: invoiceA, MaGiaoDich: requestA.body.MaGiaoDich
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
                MaHoaDon: invoiceB, MaGiaoDich: requestB.body.MaGiaoDich
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
            assert.equal(Number(row.KhongGhiNhan), row.MaHoaDon === invoiceA ? 300 : 0);
            assert.equal(Number(row.SoQrKhongGhiNhan), row.MaHoaDon === invoiceA ? 1 : 0);
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
        assert.equal(rejectedTransaction.recordset[0].TrangThai, "RECONCILIATION");
        assert.equal(rejectedTransaction.recordset[0].TrangThaiPhieuThu, "Chờ xác nhận");
        assert.equal(rejectedTransaction.recordset[0].PhuongThuc, "ONLINE");
        assert.match(rejectedTransaction.recordset[0].MaThamChieu, /^QR-DEMO:/);
        assert.equal(rejectedTransaction.recordset[0].GhiChu, "QR demo thanh toán");

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
        await pool.close();
    }
});
