const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const path = require("path");

let pool;

/* =========================================================
   KẾT NỐI DATABASE SQL SERVER
========================================================= */

const dbConfig = {
    user: "DNKTX",
    password: "ktx123456789@",
    server: "127.0.0.1",
    port: 53606,
    database: "KTX_Group3",
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

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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
/* =========================================================
   API ĐĂNG NHẬP
========================================================= */

app.post("/api/login", async (req, res) => {
    try {
        const { Email, MatKhau } = req.body;

        console.log("LOGIN REQUEST:", Email, MatKhau);

        if (!Email || !MatKhau) {
            return res.status(400).json({
                message: "Vui lòng nhập email và mật khẩu"
            });
        }

        const result = await pool
            .request()
            .input("Email", sql.NVarChar, Email.trim().toLowerCase())
            .input("MatKhau", sql.NVarChar, MatKhau)
            .query(`
                SELECT
                    MaTaiKhoan,
                    Email,
                    TenHienThi,
                    SoDienThoai,
                    VaiTro
                FROM TaiKhoan
                WHERE LOWER(LTRIM(RTRIM(Email))) = @Email
                  AND MatKhau = @MatKhau
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({
                message: "Email hoặc mật khẩu không đúng"
            });
        }

        const user = result.recordset[0];

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
            user: user
        });

    } catch (err) {
        console.error("LỖI API LOGIN:", err);

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
        path.join(__dirname, "DMSGroup6.html")
    );
});


/* =========================================================
   API HÓA ĐƠN - LẤY DANH SÁCH
========================================================= */

app.get("/api/HoaDon", async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT
                MaHoaDon,
                MaSinhVien,
                TenPhong,
                NgayLap,
                MONTH(NgayLap) AS Thang,
                YEAR(NgayLap) AS Nam,
                TienPhong,
                ChiSoDien,
                ChiSoNuoc,
                TienDien,
                TienNuoc,
                TongTien,
                TrangThaiThanhToan
            FROM HoaDon
            ORDER BY NgayLap DESC, MaHoaDon DESC
        `);

        res.status(200).json(result.recordset);

    } catch (err) {
        console.error("LỖI LẤY HÓA ĐƠN:", err);

        res.status(500).json({
            message: "Không thể lấy danh sách hóa đơn"
        });
    }
});
/* =========================================================
   SERVER RUN
========================================================= */

const PORT = process.env.PORT || 3000;

async function connectDB() {

    try {

        pool = await sql.connect(dbConfig);

        console.log("Kết nối SQL Server thành công");

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