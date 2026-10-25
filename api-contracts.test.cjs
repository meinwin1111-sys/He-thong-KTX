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
    registerApiRoutes(app, { getPool: () => pool, sql: sqlTypes, bcrypt: {} });
    return { routes, queries, executions, transactions };
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
    let roomName;
    let contractId;
    const studentIds = Array.from({ length: 6 }, () => `T4${crypto.randomBytes(7).toString("hex").toUpperCase()}`);
    try {
        const identity = await pool.request().query("SELECT DB_NAME() AS DatabaseName");
        assert.equal(identity.recordset[0].DatabaseName, "KTX_Group3_test");
        roomName = `T4-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
        await pool.request()
            .input("TenPhong", sql.NVarChar(50), roomName)
            .query(`
                INSERT INTO dbo.Phong
                    (TenPhong, Khu, LoaiPhong, SucChuaToiDa, MaHangPhong,
                     SoSinhVienHienTai, TrangThaiPhong, GhiChu)
                VALUES (@TenPhong, N'C', N'Nam', 4, N'HP4', 0, N'Trống', N'Bước 4 concurrent test')
            `);
        for (let index = 0; index < studentIds.length; index++) {
            await pool.request()
                .input("MaSinhVien", sql.NVarChar(30), studentIds[index])
                .input("Email", sql.NVarChar(100), `${studentIds[index].toLowerCase()}@example.test`)
                .query(`
                    INSERT INTO dbo.SinhVien
                        (MaSinhVien, HoTen, GioiTinh, SoDienThoai, Email, TrangThaiSinhVien, TenPhong)
                    VALUES
                        (@MaSinhVien, @MaSinhVien, N'Nam', N'0123456789', @Email, NULL, NULL)
                `);
        }

        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.auth = { accountId: 1, role: "Quản lý" };
            next();
        });
        registerApiRoutes(app, { getPool: () => pool, sql, bcrypt: require("bcryptjs") });
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
                tenPhong: roomName, maHangPhong: "HP4", ngayBatDau: startDate, ngayKetThuc: endDate,
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
                for (const studentId of studentIds) {
                    await new sql.Request(cleanup)
                        .input("MaSinhVien", sql.NVarChar(30), studentId)
                        .query("DELETE FROM dbo.SinhVien WHERE MaSinhVien = @MaSinhVien");
                }
                if (roomName) {
                    await new sql.Request(cleanup)
                        .input("TenPhong", sql.NVarChar(50), roomName)
                        .query("DELETE FROM dbo.Phong WHERE TenPhong = @TenPhong");
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
