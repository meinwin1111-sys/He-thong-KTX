const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const registerApiRoutes = require("./api-routes");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

let pool;

async function hashLegacyAccountPasswords() {
    const accounts = await pool.request().query(`
        SELECT MaTaiKhoan, MatKhau
        FROM dbo.TaiKhoan
    `);

    for (const account of accounts.recordset) {
        if (BCRYPT_HASH_PATTERN.test(account.MatKhau)) continue;

        const passwordHash = await bcrypt.hash(account.MatKhau, 12);
        await pool.request()
            .input("MaTaiKhoan", sql.Int, account.MaTaiKhoan)
            .input("MatKhauCu", sql.VarChar(255), account.MatKhau)
            .input("MatKhauHash", sql.VarChar(255), passwordHash)
            .query(`
                UPDATE dbo.TaiKhoan
                SET MatKhau = @MatKhauHash
                WHERE MaTaiKhoan = @MaTaiKhoan AND MatKhau = @MatKhauCu
            `);
    }
}

/* =========================================================
   KẾT NỐI DATABASE SQL SERVER
========================================================= */

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        useUTC: true
    }
};


/* =========================================================
   EXPRESS
========================================================= */

const app = express();

const allowedCorsOrigins = new Set(
    (process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean)
        .map(origin => {
            let parsed;
            try {
                parsed = new URL(origin);
            } catch {
                throw new Error("CORS_ALLOWED_ORIGINS must contain valid origins.");
            }
            if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) {
                throw new Error("CORS_ALLOWED_ORIGINS must contain origins without paths or credentials.");
            }
            return parsed.origin;
        })
);

app.use(cors({
    origin(origin, callback) {
        callback(null, !origin || allowedCorsOrigins.size === 0 || allowedCorsOrigins.has(origin));
    },
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"]
}));
app.use(express.json());
app.use("/js", express.static(path.join(__dirname, "js"), { dotfiles: "deny", index: false }));

app.get("/Admin.html", (req, res) => {
    res.sendFile(path.join(__dirname, "Admin.html"));
});

app.get("/Student.html", (req, res) => {
    res.sendFile(path.join(__dirname, "Student.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/student.css", (req, res) => {
    res.sendFile(path.join(__dirname, "student.css"));
});

app.get("/api/health", async (req, res) => {
    try {
        if (!pool || !pool.connected) {
            return res.status(503).json({ status: "error", db: false });
        }

        const result = await pool.request().query("SELECT 1 AS ok");
        const dbConnected = result.recordset[0]?.ok === 1;

        return res.status(dbConnected ? 200 : 503).json({
            status: dbConnected ? "ok" : "error",
            db: dbConnected
        });
    } catch (err) {
        console.error("LỖI HEALTH CHECK DATABASE:", err.code || err.name);
        return res.status(503).json({ status: "error", db: false });
    }
});

/* =========================================================
   KIỂM TRA DATABASE CONNECTION
========================================================= */

app.use(async (req, res, next) => {
    if (!pool || !pool.connected) {
        try {
            pool = await sql.connect(dbConfig);
            console.log("Pool reconnected");
        } catch (err) {
            console.error("Lỗi reconnect database:", err);

            return res.status(503).json({
                message: "Database không khả dụng, vui lòng thử lại"
            });
        }
    }

    next();
});

app.use("/api", (req, res, next) => {
    if ((req.method === "GET" && req.path === "/health")
        || (req.method === "POST" && (req.path === "/login" || req.path === "/payments/bank-transfer/notify"))) {
        return next();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return res.status(503).json({ message: "Xác thực API chưa được cấu hình." });
    }

    const authorization = req.get("authorization") || "";
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Vui lòng đăng nhập để tiếp tục." });
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        if (typeof payload === "string" || !/^\d+$/.test(String(payload.sub || ""))) {
            return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
        }
        if (payload.role === "Sinh viên") {
            const studentId = typeof payload.studentId === "string" ? payload.studentId.trim() : "";
            const allowedStudentRequest = (req.method === "GET"
                && (/^\/HoaDon(?:\/[^/]+)?$/.test(req.path)
                    || req.path === "/payments/history"
                    || req.path === "/payments/qr"
                    || req.path === "/noi-quy"
                        || req.path === "/lien-he"
                        || /^\/student\/(?:profile|room|contracts|requests)$/.test(req.path)))
                    || (req.method === "POST" && (req.path === "/payments/create"
                        || req.path === "/student/requests"
                        || req.path === "/change-password"));
            if (!studentId || studentId.length > 20) {
                return res.status(403).json({ message: "Tài khoản Sinh viên chưa được liên kết với hồ sơ hợp lệ." });
            }
            if (!allowedStudentRequest) {
                return res.status(403).json({ message: "Sinh viên chỉ được xem hóa đơn, lịch sử và gửi yêu cầu thanh toán của mình." });
            }
            req.auth = { accountId: Number(payload.sub), role: payload.role, studentId };
            return next();
        }
        if (payload.role !== "Quản lý") {
            return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này." });
        }

        req.auth = { accountId: Number(payload.sub), role: payload.role };
        return next();
    } catch (error) {
        const message = error.name === "TokenExpiredError"
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : "Phiên đăng nhập không hợp lệ.";
        return res.status(401).json({ message });
    }
});

const apiRouteInitialization = registerApiRoutes(app, {
    getPool: () => pool,
    sql,
    bcrypt
});

/* =========================================================
   API ĐĂNG NHẬP
========================================================= */

app.post("/api/login", async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return res.status(400).json({ message: "Request body phải là một đối tượng JSON." });
        }
        const { Email, MatKhau } = body;
        if (typeof Email !== "string" || Email.trim().length > 100
            || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Email.trim())
            || typeof MatKhau !== "string" || !MatKhau.trim() || MatKhau.length > 255) {
            return res.status(400).json({
                message: "Email phải đúng định dạng và tối đa 100 ký tự; mật khẩu là bắt buộc và tối đa 255 ký tự."
            });
        }

        const result = await pool
            .request()
            .input("Email", sql.NVarChar, Email.trim().toLowerCase())
            .query(`
                SELECT
                    MaTaiKhoan,
                    Email,
                    TenHienThi,
                    SoDienThoai,
                    VaiTro,
                    MaSinhVien,
                    MatKhau
                FROM TaiKhoan
                WHERE LOWER(LTRIM(RTRIM(Email))) = @Email
            `);

        const account = result.recordset[0];
        if (!account || !(await bcrypt.compare(MatKhau, account.MatKhau))) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không đúng"
            });
        }
        if (account.VaiTro === "Sinh viên"
            && (typeof account.MaSinhVien !== "string" || !account.MaSinhVien.trim())) {
            return res.status(403).json({
                message: "Tài khoản Sinh viên chưa được liên kết với hồ sơ hợp lệ."
            });
        }

        const user = {
            MaTaiKhoan: account.MaTaiKhoan,
            Email: account.Email,
            TenHienThi: account.TenHienThi,
            SoDienThoai: account.SoDienThoai,
            VaiTro: account.VaiTro,
            MaSinhVien: account.MaSinhVien
        };
        if (!process.env.JWT_SECRET) {
            return res.status(503).json({ message: "Đăng nhập tạm thời chưa khả dụng." });
        }
        const token = jwt.sign(
            {
                sub: String(user.MaTaiKhoan),
                role: user.VaiTro,
                ...(user.VaiTro === "Sinh viên" ? { studentId: account.MaSinhVien } : {})
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
        );

        // Cập nhật lần đăng nhập cuối
        await pool
            .request()
            .input("MaTaiKhoan", sql.Int, user.MaTaiKhoan)
            .query(`
                UPDATE TaiKhoan
                SET LanDangNhapCuoi = GETDATE()
                WHERE MaTaiKhoan = @MaTaiKhoan
            `);

        return res.status(200).json({
            success: true,
            message: "Đăng nhập thành công",
            user,
            token,
            tokenType: "Bearer"
        });

    } catch (err) {
        console.error("LỖI API LOGIN:", err.code || err.name || "Unknown database error");

        return res.status(500).json({
            message: "Lỗi server khi đăng nhập"
        });
    }
});
/* =========================================================
   TRANG CHỦ
========================================================= */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "Admin.html")
    );
});

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Request body không phải JSON hợp lệ." });
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json({ message: "Request body vượt quá giới hạn cho phép." });
    }

    console.error("LỖI REQUEST:", err.code || err.name || "Unknown request error");
    return res.status(500).json({ message: "Không thể xử lý yêu cầu." });
});
/* =========================================================
   SERVER RUN
========================================================= */

const PORT = process.env.PORT || 3000;

async function connectDB() {

    try {

        pool = await sql.connect(dbConfig);

        console.log("Kết nối SQL Server thành công");
        await hashLegacyAccountPasswords();
        console.log("Đã kiểm tra và băm các mật khẩu legacy trước khi mở API");
        await apiRouteInitialization.initializeDashboardContent();

        pool.on("error", async (err) => {

            console.error(
                "Pool lỗi:",
                err
            );

            try {

                pool = await sql.connect(dbConfig);

                console.log(
                    "Reconnect thành công"
                );

            } catch (e) {

                console.error(
                    "Reconnect thất bại:",
                    e
                );
            }
        });

        app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    `Server đang chạy tại http://localhost:${PORT}`
                );
            }
        );

    } catch (err) {

        console.error(
            "========== LỖI KẾT NỐI SQL =========="
        );

        console.error(
            "Message:",
            err.message
        );

        console.error(
            "Code:",
            err.code
        );

        console.error(
            "Name:",
            err.name
        );

        console.error(
            "Original Error:",
            err.originalError
        );

        console.error(
            "Preceding Errors:",
            err.precedingErrors
        );

        console.error(
            "Full Error:",
            err
        );

        console.error(
            "======================================"
        );

        console.log(
            "Thử lại sau 5 giây..."
        );

        setTimeout(
            connectDB,
            5000
        );
    }
}

connectDB();
