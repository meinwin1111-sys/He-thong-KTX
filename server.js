const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const registerApiRoutes = require("./api-routes");
const { createApiAuthenticationMiddleware } = require("./api-auth");
const { createIpRateLimiter, createLoginHandler } = require("./student-auth");
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
app.set("trust proxy", 1);

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
const registrationRateLimiter = createIpRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Quá nhiều lần gửi đăng ký. Vui lòng thử lại sau."
});
const loginRateLimiter = createIpRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau."
});
app.use("/api/student/register", registrationRateLimiter);
app.use("/api/login", loginRateLimiter);

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

app.use("/api", createApiAuthenticationMiddleware({
    jwt,
    getSecret: () => process.env.JWT_SECRET
}));

const apiRouteInitialization = registerApiRoutes(app, {
    getPool: () => pool,
    sql,
    bcrypt
});

/* =========================================================
   API ĐĂNG NHẬP
========================================================= */

const handleLogin = createLoginHandler({
    getPool: () => pool,
    sql,
    bcrypt,
    jwt,
    getSecret: () => process.env.JWT_SECRET,
    getExpiresIn: () => process.env.JWT_EXPIRES_IN || "8h",
    logDatabaseError: (operation, error) => console.error(`${operation}:`, error.code || error.name || "Unknown database error")
});
app.post("/api/login", handleLogin);
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
