const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createApiAuthenticationMiddleware } = require("./api-auth");
const {
    createIpRateLimiter,
    createLoginHandler,
    createRegistrationHandler,
    validateRegistration
} = require("./student-auth");
const registerApiRoutes = require("./api-routes");

const now = new Date("2026-10-02T00:00:00.000Z");
const validRegistration = {
    MaSinhVien: "SV20261001",
    HoTen: "Nguyễn Thị An",
    NgaySinh: "2005-08-15",
    GioiTinh: "Nữ",
    SoDienThoai: "+84901234567",
    Email: "an@gmail.com",
    DiaChi: "Đà Nẵng",
    Truong: "Đại học",
    Lop: "CNTT01",
    MatKhau: "valid-password"
};
const genericRegistrationError = "Không thể đăng ký với thông tin này, vui lòng liên hệ quản lý";

function responseRecorder() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        set(name, value) { this.headers[name] = value; return this; }
    };
}

function basicSql() {
    return {
        ISOLATION_LEVEL: { SERIALIZABLE: "SERIALIZABLE" },
        NVarChar: () => "NVarChar",
        VarChar: () => "VarChar",
        Char: () => "Char",
        Date: "Date",
        DateTime: "DateTime",
        Int: "Int",
        BigInt: "BigInt",
        Transaction: class {
            async begin() {}
            async commit() {}
            async rollback() {}
        },
        Request: class {
            constructor() { this.values = {}; }
            input(name, _type, value) { this.values[name] = value; return this; }
        }
    };
}

function createRegistrationHarness({ students = [], accounts = [] } = {}) {
    const sql = basicSql();
    const state = { students, accounts, transactions: 0, committed: 0, rolledBack: 0, bcryptHash: null };
    sql.Transaction = class {
        async begin(level) { assert.equal(level, "SERIALIZABLE"); state.transactions++; }
        async commit() { state.committed++; }
        async rollback() { state.rolledBack++; }
    };
    sql.Request = class {
        constructor() { this.values = {}; }
        input(name, _type, value) { this.values[name] = value; return this; }
        async query(query) {
            if (query.includes("SELECT MaSinhVien, NgaySinh, SoDienThoai")) {
                const student = state.students.find(row => row.MaSinhVien === this.values.MaSinhVien);
                return { recordset: student ? [student] : [] };
            }
            if (query.includes("FROM dbo.SinhVien") || query.includes("FROM dbo.TaiKhoan")) {
                const duplicate = state.students.some(row =>
                    row.MaSinhVien !== this.values.MaSinhVien
                    && row.Email?.trim().toLowerCase() === this.values.Email)
                    || state.accounts.some(row =>
                        row.MaSinhVien === this.values.MaSinhVien
                        || row.Email?.trim().toLowerCase() === this.values.Email);
                return { recordset: duplicate ? [{ MaSinhVien: this.values.MaSinhVien }] : [] };
            }
            if (query.includes("INSERT INTO dbo.SinhVien")) {
                state.students.push({
                    MaSinhVien: this.values.MaSinhVien,
                    Email: this.values.Email,
                    NgaySinh: this.values.NgaySinh,
                    SoDienThoai: this.values.SoDienThoai,
                    TrangThaiSinhVien: null,
                    TenPhong: null
                });
                return { rowsAffected: [1] };
            }
            if (query.includes("INSERT INTO dbo.TaiKhoan")) {
                state.bcryptHash = this.values.MatKhau;
                state.accounts.push({ ...this.values });
                return { rowsAffected: [1] };
            }
            throw new Error(`Unexpected SQL: ${query}`);
        }
    };
    const handler = createRegistrationHandler({
        getPool: () => ({ request: () => new sql.Request() }),
        sql,
        bcrypt,
        logDatabaseError: () => {}
    });
    return { handler, state, sql, pool: { request: () => new sql.Request() } };
}

test("Express API keeps registration, login, and health public while protecting student profile", async t => {
    const { state, sql, pool } = createRegistrationHarness();
    const app = express();
    app.use(express.json());
    app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok" }));
    app.use("/api", createApiAuthenticationMiddleware({ jwt, getSecret: () => "integration-test-secret" }));
    registerApiRoutes(app, { getPool: () => pool, sql, bcrypt });
    app.post("/api/login", (_req, res) => res.status(200).json({ message: "login route is public" }));

    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    }));
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const post = (route, body) => fetch(`${baseUrl}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const registration = await post("/api/student/register", validRegistration);
    assert.equal(registration.status, 201);
    assert.equal(state.accounts.length, 1);
    assert.equal((await post("/api/login", {})).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);

    const profile = await fetch(`${baseUrl}/api/student/profile`);
    assert.equal(profile.status, 401);
    assert.equal((await profile.json()).message, "Vui lòng đăng nhập để tiếp tục.");
});

test("registration validation accepts Vietnamese phone formats and normalizes phone", () => {
    assert.equal(validateRegistration(validRegistration, now).value.phone, "0901234567");
    assert.equal(validateRegistration({ ...validRegistration, SoDienThoai: "0901234567" }, now).error, undefined);
});

test("registration validates fields, date, age, and password", () => {
    for (const patch of [
        { MaSinhVien: "?" },
        { Email: "not-email" },
        { Email: "an@example.org" },
        { SoDienThoai: "123" },
        { NgaySinh: "2005-02-30" },
        { NgaySinh: "2027-01-01" },
        { NgaySinh: "2015-10-02" },
        { MatKhau: "short" },
        { MatKhau: "p".repeat(73) },
        { Truong: "T".repeat(151) },
        { Lop: "L".repeat(51) }
    ]) assert.ok(validateRegistration({ ...validRegistration, ...patch }, now).error, JSON.stringify(patch));
});

test("registration transaction immediately creates an unassigned student and linked bcrypt account", async () => {
    const { handler, state } = createRegistrationHarness();
    const response = responseRecorder();
    await handler({ body: validRegistration }, response);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.message, "Đăng ký thành công, bạn có thể đăng nhập.");
    assert.equal(state.students.length, 1);
    assert.equal(state.students[0].TrangThaiSinhVien, null);
    assert.equal(state.students[0].TenPhong, null);
    assert.equal(state.accounts.length, 1);
    assert.equal(state.accounts[0].VaiTro, "Sinh viên");
    assert.equal(state.accounts[0].MaSinhVien, validRegistration.MaSinhVien);
    assert.equal(state.accounts[0].SoDienThoai, "0901234567");
    assert.notEqual(state.bcryptHash, validRegistration.MatKhau);
    assert.equal(await bcrypt.compare(validRegistration.MatKhau, state.bcryptHash), true);
    assert.equal(state.transactions, 1);
    assert.equal(state.committed, 1);
});

test("registration blocks duplicate MSSV/email references with one generic error", async () => {
    const collisionCases = [
        { students: [{ MaSinhVien: "OTHER", Email: "an@gmail.com" }] },
        { accounts: [{ MaSinhVien: "OTHER", Email: "an@gmail.com" }] }
    ];
    for (const existing of collisionCases) {
        const { handler, state } = createRegistrationHarness(existing);
        const response = responseRecorder();
        await handler({ body: validRegistration }, response);
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.message, genericRegistrationError);
        assert.equal(state.committed, 0);
    }
});

test("existing student can link an account only when birthday and phone match and no account exists", async () => {
    const profile = {
        MaSinhVien: validRegistration.MaSinhVien,
        NgaySinh: new Date(`${validRegistration.NgaySinh}T00:00:00.000Z`),
        SoDienThoai: "0901234567"
    };
    const matching = createRegistrationHarness({ students: [{ ...profile }] });
    const accepted = responseRecorder();
    await matching.handler({ body: validRegistration }, accepted);
    assert.equal(accepted.statusCode, 201);
    assert.equal(matching.state.students.length, 1);
    assert.equal(matching.state.accounts.length, 1);

    for (const mismatch of [
        { ...profile, NgaySinh: new Date("2005-08-16T00:00:00.000Z") },
        { ...profile, SoDienThoai: "0901234568" }
    ]) {
        const rejected = createRegistrationHarness({ students: [mismatch] });
        const response = responseRecorder();
        await rejected.handler({ body: validRegistration }, response);
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.message, genericRegistrationError);
        assert.equal(rejected.state.accounts.length, 0);
    }

    const linked = createRegistrationHarness({
        students: [{ ...profile }],
        accounts: [{ MaSinhVien: validRegistration.MaSinhVien, Email: "linked@example.com" }]
    });
    const linkedResponse = responseRecorder();
    await linked.handler({ body: validRegistration }, linkedResponse);
    assert.equal(linkedResponse.statusCode, 400);
    assert.equal(linkedResponse.body.message, genericRegistrationError);
    assert.equal(linked.state.accounts.length, 1);
});

test("registration rate limiter blocks requests over its configured limit", () => {
    const limiter = createIpRateLimiter({ windowMs: 60_000, max: 2, message: "rate limited" });
    const call = () => {
        const res = responseRecorder();
        let nextCalled = false;
        limiter({ ip: "203.0.113.1" }, res, () => { nextCalled = true; });
        return { res, nextCalled };
    };
    assert.equal(call().nextCalled, true);
    assert.equal(call().nextCalled, true);
    const blocked = call();
    assert.equal(blocked.res.statusCode, 429);
    assert.equal(blocked.res.body.message, "rate limited");
    assert.equal(blocked.nextCalled, false);
});

async function loginCase(findAccount, password = validRegistration.MatKhau) {
    const accountHash = await bcrypt.hash(validRegistration.MatKhau, 4);
    let comparisons = 0;
    let tokenIssued = false;
    const countedBcrypt = {
        hash: (...args) => bcrypt.hash(...args),
        compare: (...args) => { comparisons++; return bcrypt.compare(...args); }
    };
    const sql = basicSql();
    sql.Request = class {
        constructor() { this.values = {}; }
        input(name, _type, value) { this.values[name] = value; return this; }
        async query(query) {
            assert.doesNotMatch(query, /DangKySinhVienChoDuyet/);
            if (query.includes("FROM dbo.TaiKhoan")) {
                const account = findAccount(accountHash);
                return { recordset: account ? [account] : [] };
            }
            if (query.includes("UPDATE dbo.TaiKhoan")) return { rowsAffected: [1] };
            throw new Error("Unexpected login SQL.");
        }
    };
    const handler = createLoginHandler({
        getPool: () => ({ request: () => new sql.Request() }),
        sql,
        bcrypt: countedBcrypt,
        jwt: { sign() { tokenIssued = true; return "signed-token"; } },
        getSecret: () => "unit-test-secret",
        getExpiresIn: () => "8h",
        logDatabaseError: () => {}
    });
    const response = responseRecorder();
    await handler({ body: { Email: "an@example.com", MatKhau: password } }, response);
    return { response, comparisons, tokenIssued, accountHash };
}

test("login gives the same generic response and one bcrypt comparison for missing or wrong accounts", async () => {
    const missing = await loginCase(() => null);
    const wrongPassword = await loginCase(hash => ({
        MaTaiKhoan: 23, Email: "an@example.com", VaiTro: "Sinh viên",
        MaSinhVien: "SV20261001", MatKhau: hash
    }), "incorrect-password");
    for (const result of [missing, wrongPassword]) {
        assert.equal(result.response.statusCode, 401);
        assert.equal(result.response.body.message, "Email hoặc mật khẩu không đúng.");
        assert.equal(result.comparisons, 1);
        assert.equal(result.tokenIssued, false);
    }
});

test("login accepts a bcrypt-authenticated student account", async () => {
    const result = await loginCase(accountHash => ({
        MaTaiKhoan: 23, Email: "an@example.com", TenHienThi: "Nguyễn Thị An",
        SoDienThoai: "0901234567", VaiTro: "Sinh viên",
        MaSinhVien: "SV20261001", MatKhau: accountHash
    }));
    assert.equal(result.response.statusCode, 200);
    assert.equal(result.response.body.token, "signed-token");
    assert.equal(result.comparisons, 1);
    assert.equal(result.tokenIssued, true);
});

test("login treats missing SQL recordset as invalid credentials without issuing a token", async () => {
    let comparisons = 0;
    let tokenIssued = false;
    const countedBcrypt = {
        hash: (...args) => bcrypt.hash(...args),
        compare: (...args) => { comparisons++; return bcrypt.compare(...args); }
    };
    const sql = basicSql();
    sql.Request = class {
        input() { return this; }
        async query(query) {
            if (query.includes("FROM dbo.TaiKhoan")) return {};
            if (query.includes("UPDATE dbo.TaiKhoan")) throw new Error("Should not update a missing account.");
            throw new Error("Unexpected login SQL.");
        }
    };
    const handler = createLoginHandler({
        getPool: () => ({ request: () => new sql.Request() }),
        sql,
        bcrypt: countedBcrypt,
        jwt: { sign() { tokenIssued = true; return "unexpected-token"; } },
        getSecret: () => "unit-test-secret",
        getExpiresIn: () => "8h",
        logDatabaseError: () => {}
    });
    const response = responseRecorder();
    await handler({ body: { Email: "missing@example.com", MatKhau: "incorrect-password" } }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.message, "Email hoặc mật khẩu không đúng.");
    assert.equal(comparisons, 1);
    assert.equal(tokenIssued, false);
});

test("login accepts one-row admin recordset and returns the account data", async () => {
    const result = await loginCase(accountHash => ({
        MaTaiKhoan: 7, Email: "admin@example.com", TenHienThi: "Quản lý thử",
        SoDienThoai: "0901234567", VaiTro: "Quản lý", MatKhau: accountHash
    }));
    assert.equal(result.response.statusCode, 200);
    assert.equal(result.response.body.user.MaTaiKhoan, 7);
    assert.equal(result.response.body.user.VaiTro, "Quản lý");
    assert.equal(result.response.body.token, "signed-token");
    assert.equal(result.comparisons, 1);
    assert.equal(result.tokenIssued, true);
});

test("login client maps 401 and malformed success payloads to safe messages", async () => {
    const source = fs.readFileSync(path.join(__dirname, "js/module/Login.js"), "utf8");
    const createClient = fetch => {
        const context = {
            BASE_URL: "",
            ApiClient: { fetch },
            document: { addEventListener() {} },
            window: { addEventListener() {} },
            console
        };
        vm.runInNewContext(source, context, { filename: "Login.js" });
        return context.authenticateLogin;
    };
    const unauthorized = createClient(async () => {
        throw Object.assign(new Error("Email hoặc mật khẩu không đúng."), { status: 401 });
    });
    const rejected = await unauthorized("not-found@example.com", "bad-password");
    assert.deepEqual({ success: rejected.success, message: rejected.message, status: rejected.status }, {
        success: false,
        message: "Email hoặc mật khẩu không đúng.",
        status: 401
    });

    for (const body of [{ token: "token-without-user" }, { user: { MaTaiKhoan: 1, VaiTro: "Quản lý" } }]) {
        const authenticate = createClient(async () => ({ json: async () => body }));
        const result = await authenticate("user@example.com", "password123");
        assert.equal(result.success, false);
        assert.equal(result.message, "Email hoặc mật khẩu không đúng.");
        assert.equal(result.message.includes("Cannot read properties"), false);
    }

    for (const role of ["Quản lý", "Sinh viên"]) {
        const authenticate = createClient(async () => ({
            json: async () => ({
                token: "valid-token",
                user: { MaTaiKhoan: 1, Email: "user@example.com", VaiTro: role }
            })
        }));
        const result = await authenticate("user@example.com", "password123");
        assert.equal(result.success, true);
        assert.equal(result.token, "valid-token");
        assert.equal(result.user.role, role);
    }
});

test("newly registered student can log in immediately without approval-table lookups", async () => {
    const registration = createRegistrationHarness();
    const registrationResponse = responseRecorder();
    await registration.handler({ body: validRegistration }, registrationResponse);
    assert.equal(registrationResponse.statusCode, 201);

    let tokenIssued = false;
    const state = registration.state;
    const sql = basicSql();
    sql.Request = class {
        constructor() { this.values = {}; }
        input(name, _type, value) { this.values[name] = value; return this; }
        async query(query) {
            assert.doesNotMatch(query, /DangKySinhVienChoDuyet/);
            if (query.includes("FROM dbo.TaiKhoan")) {
                const account = state.accounts.find(row => row.Email === this.values.Email);
                return { recordset: account ? [{ ...account, MaTaiKhoan: 123 }] : [] };
            }
            if (query.includes("UPDATE dbo.TaiKhoan")) return { rowsAffected: [1] };
            throw new Error(`Unexpected login SQL: ${query}`);
        }
    };
    const login = createLoginHandler({
        getPool: () => ({ request: () => new sql.Request() }),
        sql,
        bcrypt,
        jwt: { sign() { tokenIssued = true; return "registered-student-token"; } },
        getSecret: () => "unit-test-secret",
        getExpiresIn: () => "8h",
        logDatabaseError: () => {}
    });
    const loginResponse = responseRecorder();
    await login({
        body: { Email: validRegistration.Email, MatKhau: validRegistration.MatKhau }
    }, loginResponse);
    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.body.token, "registered-student-token");
    assert.equal(tokenIssued, true);
});

test("immediate registration API is registered and approval endpoints are absent", () => {
    const routes = new Map();
    const app = new Proxy({}, {
        get(_target, method) {
            return (path, handler) => routes.set(`${method} ${path}`, handler);
        }
    });
    registerApiRoutes(app, { getPool: () => ({}), sql: basicSql(), bcrypt });
    assert.equal(routes.has("post /api/student/register"), true);
    assert.equal(routes.has("get /api/student-registrations"), false);
    assert.equal(routes.has("get /api/student-registrations/:id"), false);
    assert.equal(routes.has("put /api/student-registrations/:id/decision"), false);
});
