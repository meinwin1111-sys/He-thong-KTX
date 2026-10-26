const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const sql = require("mssql");
const registerApiRoutes = require("./api-routes");

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
            if (call.statement.includes("UPDATE dbo.ThongBao")) return { recordset: [{ MaThongBao: 12 }] };
            return { recordset: [] };
        }
    });
    const denied = await invoke(harness, "get", "/api/student/notifications", {
        auth: { role: "Sinh viên", studentId: "SV-A" },
        query: { MaSinhVien: "SV-B" }
    });
    assert.equal(denied.statusCode, 200);
    assert.equal(harness.queries.length, 1);
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
    assert.match(harness.queries[1].statement, /UPDATE dbo\.ThongBao\s+SET DaXoa = 1/);
    assert.doesNotMatch(harness.queries[1].statement, /\bDELETE\s+FROM\b/i);
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

test("capacity, gender, existing-room and ended-contract conflicts are surfaced as clear HTTP conflicts", async () => {
    for (const [number, route, method, params, body, expectedMessage] of [
        [51434, "/api/HopDong/:id/chitiet", "post", { id: "HD1" },
            { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, /đủ sức chứa/],
        [51435, "/api/HopDong/:id/chitiet", "post", { id: "HD1" },
            { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, /sai giới tính|hợp đồng hiệu lực/],
        [51432, "/api/HopDong/:id/chitiet", "post", { id: "HD1" },
            { maSinhVien: "SV1", kyHanThanhToanPhong: "THANG" }, /không còn hiệu lực/]
    ]) {
        const harness = fakeApi({
            queryResult: call => call.statement.includes("SELECT 1 AS TonTai")
                ? { recordset: [{ TonTai: 1 }] }
                : { recordset: [] },
            executeError: () => Object.assign(new Error("procedure error"), { number })
        });
        const result = await invoke(harness, method, route, { params, body });
        assert.equal(result.statusCode, 409, String(number));
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
            MaSinhVien: "SV001", HoTen: "Student", GioiTinh: "Nam", SoDienThoai: "0123456789",
            Email: "student@example.com", TenPhong: "A101"
        }
    });
    assert.equal(created.statusCode, 201);
    assert(harness.executions.some(call => call.procedure === "dbo.sp_ThemSinhVienVaoHopDong"));
    const insertStudent = harness.queries.find(call => call.statement.includes("INSERT INTO dbo.SinhVien"));
    assert.doesNotMatch(insertStudent.statement, /TenPhong/);

    const updated = await invoke(harness, "put", "/api/sinhvien/:mssv", {
        params: { mssv: "SV001" },
        body: {
            mssv: "SV001", hoTen: "Student", gioiTinh: "Nam",
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
        NoiDungCK: "KTX INV2026100011"
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
            body: { MaHoaDon: "INV2026100011", SoTien: 100, PhuongThuc: "CASH" }
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
            NoiDungCK: `KTX ${serviceInvoiceId}`
        };
        const firstWebhook = await webhookCall(webhookPayload);
        const duplicateWebhook = await webhookCall(webhookPayload);
        assert.equal(firstWebhook.status, 200, JSON.stringify(firstWebhook.body));
        assert.equal(duplicateWebhook.status, 200, JSON.stringify(duplicateWebhook.body));
        assert.equal(duplicateWebhook.body.alreadyProcessed, true);

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
            NoiDungCK: `KTX ${incidentInvoiceId}`
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
