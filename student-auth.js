const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const GENERIC_REGISTRATION_ERROR = "Không thể đăng ký với thông tin này, vui lòng liên hệ quản lý";

function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function isDateOnly(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateRegistration(body, now = new Date()) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Request body phải là một đối tượng JSON." };
    }
    const registration = {
        studentId: stringValue(body.MaSinhVien).toUpperCase(),
        name: stringValue(body.HoTen),
        birthday: stringValue(body.NgaySinh),
        gender: stringValue(body.GioiTinh),
        phone: stringValue(body.SoDienThoai).replace(/[\s().-]/g, ""),
        email: stringValue(body.Email).toLowerCase(),
        address: stringValue(body.DiaChi),
        school: stringValue(body.Truong),
        className: stringValue(body.Lop),
        password: typeof body.MatKhau === "string" ? body.MatKhau : ""
    };

    if (!/^[A-Z0-9][A-Z0-9_-]{2,19}$/.test(registration.studentId)) {
        return { error: "Mã sinh viên phải dài từ 3 đến 20 ký tự và chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới." };
    }
    if (!registration.name || registration.name.length > 100) return { error: "Họ tên là bắt buộc và tối đa 100 ký tự." };
    if (!["Nam", "Nữ", "Khác"].includes(registration.gender)) return { error: "Giới tính không hợp lệ." };
    if (registration.phone.startsWith("+84")) registration.phone = `0${registration.phone.slice(3)}`;
    if (!/^0[35789]\d{8}$/.test(registration.phone)) {
        return { error: "Số điện thoại phải là số di động Việt Nam hợp lệ." };
    }
    if (registration.email.length > 100
        || !/^[^\s@]+@gmail\.com$/.test(registration.email)) {
        return { error: "Email phải là Gmail hợp lệ và tối đa 100 ký tự." };
    }
    if (!isDateOnly(registration.birthday)) return { error: "Ngày sinh phải theo định dạng YYYY-MM-DD và là ngày hợp lệ." };
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const birthday = new Date(`${registration.birthday}T00:00:00.000Z`);
    const earliest = new Date(Date.UTC(today.getUTCFullYear() - 100, today.getUTCMonth(), today.getUTCDate()));
    const latest = new Date(Date.UTC(today.getUTCFullYear() - 15, today.getUTCMonth(), today.getUTCDate()));
    if (birthday > latest || birthday < earliest) return { error: "Tuổi phải từ 15 đến 100 và ngày sinh không được ở tương lai." };
    if (registration.address.length > 255) return { error: "Địa chỉ tối đa 255 ký tự." };
    if (!registration.school || registration.school.length > 150) return { error: "Tên trường là bắt buộc và tối đa 150 ký tự." };
    if (!registration.className || registration.className.length > 50) return { error: "Lớp là bắt buộc và tối đa 50 ký tự." };
    if (registration.password.length < 8 || Buffer.byteLength(registration.password, "utf8") > 72) {
        return { error: "Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte khi mã hóa." };
    }
    return { value: registration };
}

function createIpRateLimiter({ windowMs, max, message }) {
    const requests = new Map();
    return (req, res, next) => {
        const now = Date.now();
        const key = req.ip || req.socket?.remoteAddress || "unknown";
        let entry = requests.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            requests.set(key, entry);
        }
        entry.count++;
        res.set("RateLimit-Limit", String(max));
        res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
        if (entry.count > max) {
            res.set("RateLimit-Reset", String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ message });
        }
        return next();
    };
}

function createRegistrationHandler({ getPool, sql, bcrypt, logDatabaseError }) {
    return async (req, res) => {
        const validated = validateRegistration(req.body);
        if (validated.error) return res.status(400).json({ message: validated.error });
        const registration = validated.value;
        const passwordHash = await bcrypt.hash(registration.password, 12);
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const studentResult = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(20), registration.studentId)
                .query(`
                    SELECT MaSinhVien, NgaySinh, SoDienThoai
                    FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaSinhVien = @MaSinhVien
                `);
            const existingStudent = studentResult.recordset[0] || null;
            const duplicate = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(20), registration.studentId)
                .input("Email", sql.VarChar(100), registration.email)
                .query(`
                    SELECT TOP (1) MaSinhVien
                    FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK)
                    WHERE LOWER(LTRIM(RTRIM(Email))) = @Email
                      AND MaSinhVien <> @MaSinhVien
                    UNION ALL
                    SELECT TOP (1) MaSinhVien
                    FROM dbo.TaiKhoan WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaSinhVien = @MaSinhVien OR LOWER(LTRIM(RTRIM(Email))) = @Email
                `);
            if (duplicate.recordset.length) {
                await transaction.rollback();
                return res.status(400).json({ message: GENERIC_REGISTRATION_ERROR });
            }

            if (existingStudent) {
                const existingBirthday = existingStudent.NgaySinh instanceof Date
                    ? existingStudent.NgaySinh.toISOString().slice(0, 10)
                    : String(existingStudent.NgaySinh || "").slice(0, 10);
                const existingPhone = String(existingStudent.SoDienThoai || "").trim().replace(/\D/g, "");
                if (existingBirthday !== registration.birthday || existingPhone !== registration.phone) {
                    await transaction.rollback();
                    return res.status(400).json({ message: GENERIC_REGISTRATION_ERROR });
                }
            } else {
                await new sql.Request(transaction)
                    .input("MaSinhVien", sql.NVarChar(20), registration.studentId)
                    .input("HoTen", sql.NVarChar(100), registration.name)
                    .input("NgaySinh", sql.Date, registration.birthday)
                    .input("GioiTinh", sql.NVarChar(10), registration.gender)
                    .input("SoDienThoai", sql.VarChar(10), registration.phone)
                    .input("Email", sql.NVarChar(100), registration.email)
                    .input("DiaChi", sql.NVarChar(255), registration.address || null)
                    .input("Truong", sql.NVarChar(150), registration.school)
                    .input("Lop", sql.NVarChar(50), registration.className)
                    .query(`
                        INSERT INTO dbo.SinhVien
                            (MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email,
                             DiaChi, TrangThaiSinhVien, TenPhong, Truong, Lop)
                        VALUES
                            (@MaSinhVien, @HoTen, @NgaySinh, @GioiTinh, @SoDienThoai, @Email,
                             @DiaChi, NULL, NULL, @Truong, @Lop)
                    `);
            }

            await new sql.Request(transaction)
                .input("Email", sql.VarChar(100), registration.email)
                .input("MatKhau", sql.VarChar(255), passwordHash)
                .input("TenHienThi", sql.NVarChar(100), registration.name)
                .input("SoDienThoai", sql.VarChar(10), registration.phone)
                .input("VaiTro", sql.NVarChar(20), "Sinh viên")
                .input("MaSinhVien", sql.NVarChar(20), registration.studentId)
                .query(`
                    INSERT INTO dbo.TaiKhoan
                        (Email, MatKhau, TenHienThi, SoDienThoai, VaiTro, MaSinhVien)
                    VALUES
                        (@Email, @MatKhau, @TenHienThi, @SoDienThoai, @VaiTro, @MaSinhVien)
                `);
            await transaction.commit();
            return res.status(201).json({
                success: true,
                message: "Đăng ký thành công, bạn có thể đăng nhập."
            });
        } catch (error) {
            try { await transaction.rollback(); } catch (rollbackError) {
                console.error("ROLLBACK ĐĂNG KÝ SINH VIÊN:", rollbackError.code || rollbackError.name || "Unknown database error");
            }
            if (error.number === 2601 || error.number === 2627) {
                return res.status(400).json({ message: GENERIC_REGISTRATION_ERROR });
            }
            logDatabaseError("LỖI ĐĂNG KÝ SINH VIÊN", error);
            return res.status(500).json({ message: "Không thể tiếp nhận đăng ký. Vui lòng thử lại sau." });
        }
    };
}

function createLoginHandler({ getPool, sql, bcrypt, jwt, getSecret, getExpiresIn, logDatabaseError }) {
    const dummyHash = bcrypt.hash("constant-login-timing-value", 12);
    return async (req, res) => {
        const body = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return res.status(400).json({ message: "Request body phải là một đối tượng JSON." });
        }
        const email = typeof body.Email === "string" ? body.Email.trim().toLowerCase() : "";
        const password = typeof body.MatKhau === "string" ? body.MatKhau : "";
        if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            || !password.trim() || password.length > 255) {
            return res.status(400).json({
                message: "Email phải đúng định dạng và tối đa 100 ký tự; mật khẩu là bắt buộc và tối đa 255 ký tự."
            });
        }

        try {
            const identityResult = await getPool().request()
                .input("Email", sql.VarChar(100), email)
                .query(`
                    SELECT TOP (1) MaTaiKhoan, Email, TenHienThi,
                           SoDienThoai, VaiTro, MaSinhVien, MatKhau
                    FROM dbo.TaiKhoan
                    WHERE LOWER(LTRIM(RTRIM(Email))) = @Email
                `);
            const identity = Array.isArray(identityResult?.recordset)
                ? identityResult.recordset[0]
                : null;
            const accountId = Number(identity?.MaTaiKhoan);
            const account = identity
                && Number.isSafeInteger(accountId)
                && accountId > 0
                && typeof identity.MatKhau === "string"
                && identity.MatKhau.length > 0
                ? identity
                : null;
            const compareHash = account?.MatKhau || await dummyHash;
            const passwordMatches = await bcrypt.compare(password, compareHash);
            if (!account || !passwordMatches) {
                return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
            }
            if (account.VaiTro === "Sinh viên"
                && (typeof account.MaSinhVien !== "string" || !account.MaSinhVien.trim())) {
                return res.status(403).json({ message: "Tài khoản Sinh viên chưa được liên kết với hồ sơ hợp lệ." });
            }
            const jwtSecret = getSecret();
            if (!jwtSecret) return res.status(503).json({ message: "Đăng nhập tạm thời chưa khả dụng." });

            const user = {
                MaTaiKhoan: account.MaTaiKhoan,
                Email: account.Email,
                TenHienThi: account.TenHienThi,
                SoDienThoai: account.SoDienThoai,
                VaiTro: account.VaiTro,
                MaSinhVien: account.MaSinhVien
            };
            const token = jwt.sign({
                sub: String(user.MaTaiKhoan),
                role: user.VaiTro,
                ...(user.VaiTro === "Sinh viên" ? { studentId: account.MaSinhVien } : {})
            }, jwtSecret, { expiresIn: getExpiresIn() });
            await getPool().request()
                .input("MaTaiKhoan", sql.Int, user.MaTaiKhoan)
                .query("UPDATE dbo.TaiKhoan SET LanDangNhapCuoi = GETDATE() WHERE MaTaiKhoan = @MaTaiKhoan");
            return res.status(200).json({
                success: true,
                message: "Đăng nhập thành công",
                user,
                token,
                tokenType: "Bearer"
            });
        } catch (error) {
            logDatabaseError("LỖI API LOGIN", error);
            return res.status(500).json({ message: "Lỗi server khi đăng nhập" });
        }
    };
}

module.exports = {
    BCRYPT_HASH_PATTERN,
    GENERIC_REGISTRATION_ERROR,
    createIpRateLimiter,
    createLoginHandler,
    createRegistrationHandler,
    isDateOnly,
    validateRegistration
};
