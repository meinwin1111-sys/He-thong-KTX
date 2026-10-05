const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const registerApiRoutes = require("./api-routes");

function loadSource(file, context) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}

test("backend Student data starts empty without creating demo data or touching browser storage", () => {
    let storageCalls = 0;
    const context = vm.createContext({
        StudentAuth: { session: () => ({ isBackend: true, code: "SV-A", name: "Sinh viên A" }) },
        localStorage: {
            getItem() { storageCalls++; throw new Error("backend must not read demo storage"); },
            setItem() { storageCalls++; throw new Error("backend must not write demo storage"); }
        },
        Date
    });
    context.window = context;
    loadSource("js/student/data.js", context);

    const data = context.StudentUI.repository.data;
    assert.equal(data.profile.code, "SV-A");
    assert.equal(data.room, null);
    assert.equal(data.contract, null);
    assert.deepEqual(Array.from(data.invoices), []);
    assert.deepEqual(Array.from(data.payments), []);
    assert.deepEqual(Array.from(data.requests), []);
    assert.equal(storageCalls, 0);
    assert.throws(() => context.StudentUI.repository.addRequest("Báo hỏng thiết bị", "Quạt hỏng"), /phải được gửi qua API/);
});

test("demo sample data is not created when the development demo flag is disabled", () => {
    const context = vm.createContext({
        StudentAuth: { session: () => null },
        KTX_CONFIG: { allowStudentDemoAuth: false },
        Date
    });
    context.window = context;
    loadSource("js/student/data.js", context);
    assert.equal(context.StudentUI.repository.data.profile.name, "");
    assert.equal(context.StudentUI.repository.data.room, null);
    assert.deepEqual(Array.from(context.StudentUI.repository.data.invoices), []);
});

test("Student route selection defaults fresh sessions to home and preserves explicit routes", () => {
    const context = vm.createContext({
        StudentUI: { repository: { data: { contract: { start: "", end: "" } }, pages: {} } },
        Date
    });
    context.window = context;
    loadSource("js/student/helpers.js", context);
    const pages = { home: {}, invoices: {}, requests: {} };
    assert.equal(context.StudentUI.routeFromHash("", pages), "home");
    assert.equal(context.StudentUI.routeFromHash("#invoices", pages), "invoices");
    assert.equal(context.StudentUI.routeFromHash("#unknown", pages), "home");
});

test("backend billing does not initialize the browser demo payment ledger", () => {
    let initializeCalls = 0;
    const context = vm.createContext({
        StudentAuth: { session: () => ({ isBackend: true, code: "SV-A" }) },
        localStorage: {
            getItem() { throw new Error("backend billing must not read demo storage"); },
            setItem() { throw new Error("backend billing must not write demo storage"); }
        },
        KTXPaymentDemo: { initialize() { initializeCalls++; throw new Error("demo ledger called"); } },
        Date
    });
    context.window = context;
    loadSource("js/student/data.js", context);
    loadSource("js/student/helpers.js", context);
    loadSource("js/student/HoaDon.js", context);
    context.StudentUI.billing.sync();
    assert.equal(initializeCalls, 0);
});

function dashboard(invoices, contracts = [], room = null) {
    const context = vm.createContext({
        StudentAuth: { session: () => ({ isBackend: true }) },
        StudentUI: {
            repository: { data: { profile: { name: "Sinh viên A" } } },
            helpers: {
                esc: value => String(value ?? ""),
                money: value => `${value} VND`,
                date: value => String(value),
                total() {}, badge() {}, fields() {}, card() {}, table() {}, requestTable() {}, contractWarning() {}
            },
            pages: {}
        },
        ApiClient: {
            fetch: async url => ({
                json: async () => url.endsWith("/room") ? { room } : url.endsWith("/contracts") ? contracts : invoices
            })
        },
        Date
    });
    context.window = context;
    loadSource("js/student/TrangChu.js", context);
    const nodes = new Map();
    const root = {
        isConnected: true,
        querySelector(selector) {
            if (!nodes.has(selector)) nodes.set(selector, { textContent: "" });
            return nodes.get(selector);
        }
    };
    return context.StudentUI.pages.home.load(root).then(() => nodes);
}

test("backend dashboard shows empty statuses and never says fully paid without invoices", async () => {
    const nodes = await dashboard([]);
    assert.equal(nodes.get("[data-dashboard-unpaid]").textContent, "Chưa có");
    assert.equal(nodes.get("[data-dashboard-unpaid-hint]").textContent, "Chưa có hóa đơn");
    assert.equal(nodes.get("[data-dashboard-debt]").textContent, "—");
    assert.equal(nodes.get("[data-dashboard-contract]").textContent, "Chưa có hợp đồng");
    assert.equal(nodes.get("[data-dashboard-contract-warning]").textContent, "");
    assert.equal(nodes.get("[data-dashboard-overdue]").textContent, "");
});

test("backend dashboard says fully paid only when real invoice statuses are paid", async () => {
    const unpaidStatusWithNoBalance = await dashboard([{ ConNo: 0, TrangThaiThanhToan: "Chưa thanh toán" }]);
    assert.notEqual(unpaidStatusWithNoBalance.get("[data-dashboard-unpaid-hint]").textContent, "Đã thanh toán đủ");
    const paid = await dashboard([{ ConNo: 0, TrangThaiThanhToan: "Đã thanh toán" }]);
    assert.equal(paid.get("[data-dashboard-unpaid-hint]").textContent, "Đã thanh toán đủ");
});

function routeHarness() {
    const routes = new Map();
    const queries = [];
    const app = Object.fromEntries(["get", "post", "put", "delete"].map(method => [
        method,
        (url, handler) => routes.set(`${method} ${url}`, handler)
    ]));
    const requestFactory = () => {
        const inputs = {};
        return {
            input(name, _type, value) { inputs[name] = value; return this; },
            async query(statement) {
                queries.push({ inputs: { ...inputs }, statement });
                const studentId = inputs.MaSinhVien || inputs.TenPhong?.replace("ROOM-", "");
                if (statement.includes("@MaSinhVien") && studentId == null) return { recordset: [] };
                if (statement.includes("INNER JOIN dbo.Phong p")) {
                    return { recordset: [{ TenPhong: `ROOM-${studentId}`, MaSinhVien: studentId }] };
                }
                if (inputs.TenPhong) {
                    return { recordset: [{ MaSinhVien: studentId, HoTen: `Sinh viên ${studentId}` }] };
                }
                if (statement.includes("SUM(chi.SoTien)")) {
                    return { recordset: [{ MaHoaDon: inputs.MaHoaDon, TongTien: 1200, SoKhoan: 1 }] };
                }
                if (statement.includes("dbo.vw_HoaDonTongHop")) {
                    return { recordset: [{ MaSinhVien: studentId, MaHoaDon: inputs.MaHoaDon || `HD-${studentId}`, TrangThaiThanhToan: "Đã thanh toán" }] };
                }
                if (statement.includes("dbo.GiaoDichThanhToan")) {
                    return { recordset: [{ MaSinhVien: studentId, MaHoaDon: `HD-${studentId}` }] };
                }
                return { recordset: [{ MaSinhVien: studentId, HoTen: `Sinh viên ${studentId}` }] };
            }
        };
    };
    const sql = new Proxy({
        Request: function Request() { return requestFactory(); },
        Transaction: function Transaction() {},
        ISOLATION_LEVEL: { SERIALIZABLE: "SERIALIZABLE" }
    }, { get(target, key) {
        if (key in target) return target[key];
        return (...args) => ({ type: String(key), args });
    } });
    registerApiRoutes(app, { getPool: () => ({ request: requestFactory }), sql, bcrypt: {} });
    return { routes, queries };
}

function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; }
    };
}

test("student-scoped APIs bind each session to its own records; missing auth is rejected", async () => {
    const { routes, queries } = routeHarness();
    const endpoints = [
        "get /api/student/profile",
        "get /api/student/room",
        "get /api/student/contracts",
        "get /api/student/requests",
        "get /api/HoaDon",
        "get /api/payments/history"
    ];
    for (const endpoint of endpoints) {
        for (const studentId of ["SV-A", "SV-B"]) {
            const res = response();
            await routes.get(endpoint)({ auth: { role: "Sinh viên", studentId }, query: {} }, res);
            assert.equal(res.statusCode, 200, endpoint);
            if (endpoint === "get /api/student/room") {
                assert.equal(res.body.room.TenPhong, `ROOM-${studentId}`, endpoint);
                assert.equal(res.body.members.every(row => row.MaSinhVien === studentId), true, endpoint);
                continue;
            }
            const rows = Array.isArray(res.body) ? res.body : [res.body];
            assert.equal(rows[0].MaSinhVien, studentId, endpoint);
            assert.equal(rows.some(row => row.MaSinhVien !== studentId), false, endpoint);
        }
        const res = response();
        await routes.get(endpoint)({ query: {} }, res);
        assert([401, 403].includes(res.statusCode), endpoint);
    }
    assert(queries.filter(query => query.inputs.MaSinhVien !== undefined)
        .every(query => query.inputs.MaSinhVien === "SV-A" || query.inputs.MaSinhVien === "SV-B"));
    assert(queries.filter(query => query.inputs.TenPhong)
        .every(query => ["ROOM-SV-A", "ROOM-SV-B"].includes(query.inputs.TenPhong)));

    const originalBankConfig = {
        bin: process.env.PAYMENT_BANK_BIN,
        account: process.env.PAYMENT_BANK_ACCOUNT_NO,
        name: process.env.PAYMENT_BANK_ACCOUNT_NAME
    };
    process.env.PAYMENT_BANK_BIN = "970415";
    process.env.PAYMENT_BANK_ACCOUNT_NO = "1234567890";
    process.env.PAYMENT_BANK_ACCOUNT_NAME = "KTX Test";
    try {
        for (const studentId of ["SV-A", "SV-B"]) {
            const res = response();
            await routes.get("get /api/payments/qr")({
                auth: { role: "Sinh viên", studentId },
                query: { MaHoaDon: `HD-${studentId}` }
            }, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.MaHoaDon, `HD-${studentId}`);
            const query = queries.at(-1);
            assert.equal(query.inputs.MaSinhVien, studentId);
            assert.match(query.statement, /hd\.MaSinhVien = @MaSinhVien/);
        }
        const unauthenticated = response();
        await routes.get("get /api/payments/qr")({ query: { MaHoaDon: "HD-SV-A" } }, unauthenticated);
        assert.equal(unauthenticated.statusCode, 403);
    } finally {
        if (originalBankConfig.bin === undefined) delete process.env.PAYMENT_BANK_BIN;
        else process.env.PAYMENT_BANK_BIN = originalBankConfig.bin;
        if (originalBankConfig.account === undefined) delete process.env.PAYMENT_BANK_ACCOUNT_NO;
        else process.env.PAYMENT_BANK_ACCOUNT_NO = originalBankConfig.account;
        if (originalBankConfig.name === undefined) delete process.env.PAYMENT_BANK_ACCOUNT_NAME;
        else process.env.PAYMENT_BANK_ACCOUNT_NAME = originalBankConfig.name;
    }
});

test("Student logout clears student session and account/demo browser keys without touching Admin session", () => {
    const storage = initial => {
        const values = new Map(Object.entries(initial));
        return {
            values,
            get length() { return values.size; },
            key(index) { return [...values.keys()][index] ?? null; },
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, value); },
            removeItem(key) { values.delete(key); }
        };
    };
    const localStorage = storage({
        "ktx.student.mock.accounts.v1": "password-data",
        "ktx.student.residence.v1.SV-A": "profile-data",
        "ktx.billing.demo.account.SV-A": "billing-data",
        "ktx.phase2.storage-cleanup.v1": "keep"
    });
    const sessionStorage = storage({
        "ktx.student.accessToken": "token",
        "ktx.student.currentUser": "user",
        "ktx.accessToken": "admin-token"
    });
    const context = vm.createContext({
        localStorage,
        sessionStorage,
        console,
        ApiClient: {
            getStudentSession: () => ({ user: { studentId: "SV-A" } }),
            clearStudentSession() {
                sessionStorage.removeItem("ktx.student.accessToken");
                sessionStorage.removeItem("ktx.student.currentUser");
            }
        }
    });
    context.window = context;
    loadSource("js/student/auth.js", context);
    context.StudentAuth.logout();
    assert.equal(localStorage.values.has("ktx.student.mock.accounts.v1"), false);
    assert.equal(localStorage.values.has("ktx.student.residence.v1.SV-A"), false);
    assert.equal(localStorage.values.has("ktx.billing.demo.account.SV-A"), false);
    assert.equal(sessionStorage.values.has("ktx.student.accessToken"), false);
    assert.equal(sessionStorage.values.has("ktx.accessToken"), true);
});
