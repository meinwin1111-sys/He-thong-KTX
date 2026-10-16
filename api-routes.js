const { randomUUID } = require("node:crypto");
const { createVietQrPayload } = require("./payment-qr");
const { verifyPaymentWebhookSignature } = require("./payment-webhook");
const { createRegistrationHandler } = require("./student-auth");
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const PAYMENT_STATUS_TO_API = Object.freeze({
    PAID: "Đã thanh toán",
    UNPAID: "Chưa thanh toán",
    WAITING_CASH: "Chờ tiền mặt"
});

const INVOICE_SELECT = `
    SELECT
        hd.MaHoaDon,
        hd.MaSinhVien,
        tong.HoTen,
        hd.TenPhong,
        hd.NgayLap,
        MONTH(hd.NgayLap) AS Thang,
        YEAR(hd.NgayLap) AS Nam,
        hd.HanThanhToan,
        hd.TienPhong,
        hd.ChiSoDien,
        hd.ChiSoNuoc,
        hd.TienDien,
        hd.TienNuoc,
        tong.TongThuc AS TongTien,
        tong.DaTra,
        tong.ConNo,
        hd.TrangThaiThanhToan,
        hd.PhuongThucThanhToan,
        hd.NgayThanhToan,
        hd.GhiChuThanhToan,
        hd.SoDienCu,
        hd.SoDienMoi,
        hd.SoNuocCu,
        hd.SoNuocMoi
    FROM dbo.HoaDon hd
    INNER JOIN dbo.vw_HoaDonTongHop tong ON tong.MaHoaDon = hd.MaHoaDon
`;

function isDateOnly(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.getUTCFullYear() >= 1
        && parsed.toISOString().slice(0, 10) === value;
}

function normalizeInvoice(invoice) {
    const paymentMethod = invoice.PhuongThucThanhToan
        ? normalizePaymentMethod(invoice.PhuongThucThanhToan)
        : null;
    return {
        ...invoice,
        TrangThaiThanhToan: PAYMENT_STATUS_TO_API[invoice.TrangThaiThanhToan] || invoice.TrangThaiThanhToan,
        PhuongThucThanhToan: paymentMethod || invoice.PhuongThucThanhToan || null
    };
}

function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function isObjectBody(body) {
    return body !== null && typeof body === "object" && !Array.isArray(body);
}

function respondRequestError(res, status, message) {
    return res.status(status).json({ message });
}

function isOptionalText(value, maxLength) {
    return value == null || (typeof value === "string" && value.length <= maxLength);
}

function isValidEmail(value) {
    return typeof value === "string"
        && value.length <= 100
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
    return typeof value === "string" && /^\d{10}$/.test(value);
}

function isValidId(value, maxLength) {
    return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isJsonInteger(value, minimum, maximum) {
    return typeof value === "number" && Number.isSafeInteger(value)
        && value >= minimum && value <= maximum;
}

function isRoomCapacity(value) {
    return [4, 6, 8].includes(value);
}

function validateStudentInput({
    studentId, name, gender, phone, email, birthday, address, note, room, status
}) {
    if (!isValidId(studentId, 30)) return "Mã sinh viên là bắt buộc và tối đa 30 ký tự.";
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
        return "Họ tên là bắt buộc và tối đa 100 ký tự.";
    }
    if (!["Nam", "Nữ"].includes(gender)) return "Giới tính phải là Nam hoặc Nữ.";
    if (!isValidPhone(phone)) return "Số điện thoại phải gồm đúng 10 chữ số.";
    if (!isValidEmail(email)) return "Email không đúng định dạng hoặc vượt quá 100 ký tự.";
    if (birthday != null && birthday !== "" && !isDateOnly(birthday)) {
        return "Ngày sinh phải là ngày hợp lệ theo định dạng YYYY-MM-DD.";
    }
    if (!isOptionalText(address, 255)) return "Địa chỉ phải là chuỗi tối đa 255 ký tự.";
    if (!isOptionalText(note, 255)) return "Ghi chú phải là chuỗi tối đa 255 ký tự.";
    if (status !== undefined && !normalizeStudentStatus(status)) return "Trạng thái sinh viên không hợp lệ.";
    if ((status === undefined || normalizeStudentStatus(status) === "Đang ở") && !isValidId(room, 50)) {
        return "Sinh viên đang ở phải có tên phòng hợp lệ, tối đa 50 ký tự.";
    }
    return null;
}

function bodyValue(body, ...keys) {
    for (const key of keys) {
        if (body[key] !== undefined) return body[key];
    }
    return undefined;
}

function normalizeStudentStatus(value) {
    if (value === "Đã rời khỏi" || value === "Đã rời KTX") return "Đã rời KTX";
    if (value === "Đang ở") return value;
    return null;
}

function normalizeStudent(student) {
    return {
        ...student,
        TrangThaiSinhVien: student.TrangThaiSinhVien === "Đã rời KTX"
            ? "Đã rời khỏi"
            : student.TrangThaiSinhVien
    };
}

function normalizePaymentMethod(value) {
    if (value === "Tiền mặt" || value === "CASH") return "CASH";
    if (value === "Chuyển khoản" || value === "Ví điện tử" || value === "ONLINE") return "ONLINE";
    return null;
}

function getBankTransferConfig() {
    const bankBin = stringValue(process.env.PAYMENT_BANK_BIN);
    const accountNumber = stringValue(process.env.PAYMENT_BANK_ACCOUNT_NO);
    const accountName = stringValue(process.env.PAYMENT_BANK_ACCOUNT_NAME);
    if (!/^\d{6}$/.test(bankBin) || !/^\d{6,19}$/.test(accountNumber)
        || !accountName || accountName.length > 100) {
        return null;
    }
    return { bankBin, accountNumber, accountName };
}

function logDatabaseError(operation, error) {
    console.error(`${operation}:`, error.code || error.name || "Unknown database error");
}

function respondDatabaseError(res, operation, error, message) {
    logDatabaseError(operation, error);
    return respondRequestError(res, 500, message);
}

async function rollback(transaction, operation) {
    try {
        await transaction.rollback();
    } catch (error) {
        console.error(`${operation} rollback failed:`, error.code || error.name || "Unknown database error");
    }
}

function addContractHistory(request, sql, { contractId, studentId, studentName, room, startDate, endDate, status, action }) {
    return request
        .input("HistoryContractId", sql.NVarChar(20), contractId)
        .input("HistoryStudentId", sql.NVarChar(30), studentId)
        .input("HistoryStudentName", sql.NVarChar(100), studentName)
        .input("HistoryRoom", sql.NVarChar(50), room)
        .input("HistoryStartDate", sql.Date, startDate)
        .input("HistoryEndDate", sql.Date, endDate)
        .input("HistoryStatus", sql.NVarChar(20), status)
        .input("HistoryAction", sql.NVarChar(30), action)
        .query(`
            INSERT INTO dbo.LichSuHopDong
            (MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong, ThaoTac, ThoiGian)
            VALUES
                (@HistoryContractId, @HistoryStudentId, @HistoryStudentName, @HistoryRoom,
             @HistoryStartDate, @HistoryEndDate, @HistoryStatus, @HistoryAction, GETDATE())
        `);
}

async function ensureDashboardContentDefaults(getPool, sql) {
        const defaults = [
            ["NOI_QUY_01", "Giờ giới nghiêm: 23:00", "Lưu ý nội quy"],
            ["NOI_QUY_02", "Không nấu ăn tại phòng", "Lưu ý nội quy"],
            ["NOI_QUY_03", "Giữ vệ sinh khu vực chung", "Lưu ý nội quy"],
            ["NOI_QUY_04", "Xuất trình thẻ sinh viên khi ra vào", "Lưu ý nội quy"],
            ["SUPPORT_PHONE", "023 6384 2288", "Liên hệ hỗ trợ"],
            ["SUPPORT_EMAIL", "ktx@udn.vn", "Liên hệ hỗ trợ"],
            ["SUPPORT_HOURS", "T2 – T6: 7:30 – 17:00", "Liên hệ hỗ trợ"]
        ];
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const initialized = await new sql.Request(transaction).query(`
                SELECT Khoa
                FROM dbo.CauHinhHeThong WITH (UPDLOCK, HOLDLOCK)
                WHERE Khoa = N'DASHBOARD_CONTENT_INITIALIZED'
            `);
            if (!initialized.recordset.length) {
                for (const [key, value, description] of defaults) {
                    await new sql.Request(transaction)
                        .input("Khoa", sql.NVarChar(50), key)
                        .input("GiaTri", sql.NVarChar(200), value)
                        .input("MoTa", sql.NVarChar(255), description)
                        .query(`
                            MERGE dbo.CauHinhHeThong WITH (HOLDLOCK) AS target
                            USING (SELECT @Khoa AS Khoa, @GiaTri AS GiaTri, @MoTa AS MoTa) AS source
                            ON target.Khoa = source.Khoa
                            WHEN NOT MATCHED THEN
                                INSERT (Khoa, GiaTri, MoTa)
                                VALUES (source.Khoa, source.GiaTri, source.MoTa);
                        `);
                }
                await new sql.Request(transaction).query(`
                    INSERT INTO dbo.CauHinhHeThong (Khoa, GiaTri, MoTa)
                    VALUES (N'DASHBOARD_CONTENT_INITIALIZED', N'1', N'Khởi tạo nội dung dùng chung hoàn tất')
                `);
            }
            await transaction.commit();
        } catch (error) {
            await rollback(transaction, "KHỞI TẠO NỘI DUNG DASHBOARD");
            throw error;
        }
}

function isDashboardRuleId(value) {
        return typeof value === "string" && /^NOI_QUY_[A-Z0-9_-]{1,41}$/.test(value);
}

function validateSupportContact({ phone, email, hours }) {
        const normalizedPhone = phone.replace(/[\s().-]/g, "");
        const phoneIsValid = phone.length <= 50
            && /^\+?\d+$/.test(normalizedPhone)
            && (/^0\d{9,10}$/.test(normalizedPhone) || /^\+84\d{9,10}$/.test(normalizedPhone));
        if (!phoneIsValid) return "Số điện thoại phải là số điện thoại Việt Nam hợp lệ.";
        if (!isValidEmail(email)) return "Email liên hệ không đúng định dạng hoặc vượt quá 100 ký tự.";
        const schedule = /^T([2-7])\s*[-–]\s*T([2-7])\s*:\s*(\d{1,2}):([0-5]\d)\s*[-–]\s*(\d{1,2}):([0-5]\d)$/u.exec(hours);
        if (!schedule || Number(schedule[1]) > Number(schedule[2])
            || Number(schedule[3]) > 23 || Number(schedule[5]) > 23
            || Number(schedule[3]) * 60 + Number(schedule[4]) >= Number(schedule[5]) * 60 + Number(schedule[6])) {
            return "Giờ làm việc phải theo dạng T2 – T6: 7:30 – 17:00 và giờ kết thúc phải sau giờ bắt đầu.";
        }
        return null;
}

function registerApiRoutes(app, { getPool, sql, bcrypt }) {
    app.post("/api/student/register", createRegistrationHandler({
        getPool,
        sql,
        bcrypt,
        logDatabaseError
    }));

    app.post("/api/change-password", async (req, res) => {
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const { MaTaiKhoan: accountId, MatKhauHienTai: currentPassword, MatKhauMoi: newPassword } = req.body;
        if (!isJsonInteger(accountId, 1, 2147483647)
            || typeof currentPassword !== "string" || !currentPassword.trim()
            || typeof newPassword !== "string" || !newPassword.trim()
            || newPassword.length < 8 || newPassword.length > 128) {
            return respondRequestError(res, 400, "Mã tài khoản hợp lệ, mật khẩu hiện tại bắt buộc và mật khẩu mới phải dài từ 8 đến 128 ký tự.");
        }
        if (req.auth?.accountId !== accountId) {
            return respondRequestError(res, 403, "Bạn chỉ có thể đổi mật khẩu cho tài khoản đang đăng nhập.");
        }

        try {
            const accountResult = await getPool().request()
                .input("MaTaiKhoan", sql.Int, accountId)
                .query(`
                    SELECT MatKhau
                    FROM dbo.TaiKhoan
                    WHERE MaTaiKhoan = @MaTaiKhoan
                `);
            const account = accountResult.recordset[0];
            if (!account) return respondRequestError(res, 404, "Không tìm thấy tài khoản.");
            const validPassword = BCRYPT_HASH_PATTERN.test(account.MatKhau)
                ? await bcrypt.compare(currentPassword, account.MatKhau)
                : account.MatKhau === currentPassword;
            if (!validPassword) return respondRequestError(res, 401, "Mật khẩu hiện tại không đúng.");

            const passwordHash = await bcrypt.hash(newPassword, 12);
            await getPool().request()
                .input("MaTaiKhoan", sql.Int, accountId)
                .input("MatKhau", sql.VarChar(255), passwordHash)
                .query("UPDATE dbo.TaiKhoan SET MatKhau = @MatKhau WHERE MaTaiKhoan = @MaTaiKhoan");
            return res.status(200).json({ success: true, message: "Đổi mật khẩu thành công." });
        } catch (error) {
            return respondDatabaseError(res, "LỖI ĐỔI MẬT KHẨU", error, "Không thể đổi mật khẩu.");
        }
    });

    app.get("/api/noi-quy", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT Khoa AS id, GiaTri AS NoiDung
                FROM dbo.CauHinhHeThong
                WHERE Khoa LIKE N'NOI_QUY[_]%'
                ORDER BY Khoa
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY NỘI QUY", error, "Không thể lấy danh sách nội quy.");
        }
    });

    app.post("/api/noi-quy", async (req, res) => {
        if (!isObjectBody(req.body) || typeof req.body.NoiDung !== "string"
            || !req.body.NoiDung.trim() || req.body.NoiDung.trim().length > 200) {
            return respondRequestError(res, 400, "Nội dung nội quy là bắt buộc và tối đa 200 ký tự.");
        }
        const id = `NOI_QUY_${randomUUID().replace(/-/g, "").toUpperCase()}`;
        try {
            await getPool().request()
                .input("Khoa", sql.NVarChar(50), id)
                .input("GiaTri", sql.NVarChar(200), req.body.NoiDung.trim())
                .input("MoTa", sql.NVarChar(255), "Lưu ý nội quy")
                .query(`
                    INSERT INTO dbo.CauHinhHeThong (Khoa, GiaTri, MoTa)
                    VALUES (@Khoa, @GiaTri, @MoTa)
                `);
            return res.status(201).json({ success: true, id, NoiDung: req.body.NoiDung.trim() });
        } catch (error) {
            if ([2601, 2627].includes(error.number)) return respondRequestError(res, 409, "Nội quy bị trùng mã. Vui lòng thử lại.");
            return respondDatabaseError(res, "LỖI THÊM NỘI QUY", error, "Không thể thêm nội quy.");
        }
    });

    app.put("/api/noi-quy/:id", async (req, res) => {
        if (!isDashboardRuleId(req.params.id)) return respondRequestError(res, 400, "Mã nội quy không hợp lệ.");
        if (!isObjectBody(req.body) || typeof req.body.NoiDung !== "string"
            || !req.body.NoiDung.trim() || req.body.NoiDung.trim().length > 200) {
            return respondRequestError(res, 400, "Nội dung nội quy là bắt buộc và tối đa 200 ký tự.");
        }
        try {
            const result = await getPool().request()
                .input("Khoa", sql.NVarChar(50), req.params.id)
                .input("GiaTri", sql.NVarChar(200), req.body.NoiDung.trim())
                .query(`
                    UPDATE dbo.CauHinhHeThong
                    SET GiaTri = @GiaTri
                    WHERE Khoa = @Khoa AND Khoa LIKE N'NOI_QUY[_]%'
                `);
            if (!result.rowsAffected[0]) return respondRequestError(res, 404, "Không tìm thấy nội quy.");
            return res.json({ success: true, id: req.params.id, NoiDung: req.body.NoiDung.trim() });
        } catch (error) {
            return respondDatabaseError(res, "LỖI CẬP NHẬT NỘI QUY", error, "Không thể cập nhật nội quy.");
        }
    });

    app.delete("/api/noi-quy/:id", async (req, res) => {
        if (!isDashboardRuleId(req.params.id)) return respondRequestError(res, 400, "Mã nội quy không hợp lệ.");
        try {
            const result = await getPool().request()
                .input("Khoa", sql.NVarChar(50), req.params.id)
                .query(`
                    DELETE FROM dbo.CauHinhHeThong
                    WHERE Khoa = @Khoa AND Khoa LIKE N'NOI_QUY[_]%'
                `);
            if (!result.rowsAffected[0]) return respondRequestError(res, 404, "Không tìm thấy nội quy.");
            return res.json({ success: true, message: "Đã xóa nội quy." });
        } catch (error) {
            return respondDatabaseError(res, "LỖI XÓA NỘI QUY", error, "Không thể xóa nội quy.");
        }
    });

    app.get("/api/lien-he", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT Khoa, GiaTri
                FROM dbo.CauHinhHeThong
                WHERE Khoa IN (N'SUPPORT_PHONE', N'SUPPORT_EMAIL', N'SUPPORT_HOURS')
            `);
            const values = Object.fromEntries(result.recordset.map(row => [row.Khoa, row.GiaTri]));
            return res.json({
                DienThoai: values.SUPPORT_PHONE,
                Email: values.SUPPORT_EMAIL,
                GioLamViec: values.SUPPORT_HOURS
            });
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY LIÊN HỆ", error, "Không thể lấy thông tin liên hệ.");
        }
    });

    app.put("/api/lien-he", async (req, res) => {
        if (!isObjectBody(req.body)
            || typeof req.body.DienThoai !== "string" || !req.body.DienThoai.trim()
            || typeof req.body.Email !== "string" || !req.body.Email.trim()
            || typeof req.body.GioLamViec !== "string" || !req.body.GioLamViec.trim()) {
            return respondRequestError(res, 400, "Điện thoại, email và giờ làm việc đều là thông tin bắt buộc.");
        }
        const contact = {
            phone: req.body.DienThoai.trim(),
            email: req.body.Email.trim(),
            hours: req.body.GioLamViec.trim()
        };
        const validationError = validateSupportContact(contact);
        if (validationError) return respondRequestError(res, 400, validationError);

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            for (const [key, value] of [
                ["SUPPORT_PHONE", contact.phone],
                ["SUPPORT_EMAIL", contact.email],
                ["SUPPORT_HOURS", contact.hours]
            ]) {
                await new sql.Request(transaction)
                    .input("Khoa", sql.NVarChar(50), key)
                    .input("GiaTri", sql.NVarChar(200), value)
                    .input("MoTa", sql.NVarChar(255), "Liên hệ hỗ trợ")
                    .query(`
                        MERGE dbo.CauHinhHeThong WITH (HOLDLOCK) AS target
                        USING (SELECT @Khoa AS Khoa, @GiaTri AS GiaTri, @MoTa AS MoTa) AS source
                        ON target.Khoa = source.Khoa
                        WHEN MATCHED THEN UPDATE SET GiaTri = source.GiaTri
                        WHEN NOT MATCHED THEN INSERT (Khoa, GiaTri, MoTa)
                            VALUES (source.Khoa, source.GiaTri, source.MoTa);
                    `);
            }
            await transaction.commit();
            return res.json({
                success: true,
                DienThoai: contact.phone,
                Email: contact.email,
                GioLamViec: contact.hours
            });
        } catch (error) {
            await rollback(transaction, "CẬP NHẬT LIÊN HỆ HỖ TRỢ");
            return respondDatabaseError(res, "LỖI CẬP NHẬT LIÊN HỆ", error, "Không thể cập nhật thông tin liên hệ.");
        }
    });

    app.get("/api/student/profile", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, 403, "Chỉ Sinh viên mới được xem hồ sơ của mình.");
        }
        try {
            const result = await getPool().request()
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .query(`
                    SELECT sv.MaSinhVien, sv.HoTen, sv.NgaySinh, sv.GioiTinh,
                           sv.SoDienThoai, tk.Email, sv.Email AS EmailTruong,
                           sv.DiaChi, sv.Truong, sv.Lop,
                           sv.TrangThaiSinhVien, sv.TenPhong
                    FROM dbo.SinhVien sv
                    INNER JOIN dbo.TaiKhoan tk ON tk.MaSinhVien = sv.MaSinhVien
                    WHERE sv.MaSinhVien = @MaSinhVien
                `);
            if (!result.recordset[0]) return respondRequestError(res, 404, "Không tìm thấy hồ sơ Sinh viên.");
            return res.json(result.recordset[0]);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY HỒ SƠ SINH VIÊN", error, "Không thể lấy hồ sơ Sinh viên.");
        }
    });

    app.get("/api/student/room", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, 403, "Chỉ Sinh viên mới được xem thông tin phòng của mình.");
        }
        try {
            const roomResult = await getPool().request()
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .query(`
                    SELECT p.TenPhong, p.Khu, p.LoaiPhong, p.SucChuaToiDa,
                           p.SoSinhVienHienTai, p.TrangThaiPhong, p.GiaPhong
                    FROM dbo.SinhVien sv
                    INNER JOIN dbo.Phong p ON p.TenPhong = sv.TenPhong
                    WHERE sv.MaSinhVien = @MaSinhVien
                      AND sv.TrangThaiSinhVien = N'Đang ở'
                `);
            const room = roomResult.recordset[0] || null;
            if (!room) return res.json({ room: null, members: [] });

            const membersResult = await getPool().request()
                .input("TenPhong", sql.NVarChar(50), room.TenPhong)
                .query(`
                    SELECT MaSinhVien, HoTen
                    FROM dbo.SinhVien
                    WHERE TenPhong = @TenPhong AND TrangThaiSinhVien = N'Đang ở'
                    ORDER BY HoTen, MaSinhVien
                `);
            return res.json({ room, members: membersResult.recordset });
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY PHÒNG SINH VIÊN", error, "Không thể lấy thông tin phòng.");
        }
    });

    app.get("/api/student/contracts", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, 403, "Chỉ Sinh viên mới được xem hợp đồng của mình.");
        }
        try {
            const result = await getPool().request()
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .query(`
                    SELECT hd.MaHopDong, hd.MaSinhVien, hd.TenPhong,
                           p.Khu, p.GiaPhong, hd.NgayBatDau, hd.NgayKetThuc,
                           hd.TrangThaiHopDong, hd.GhiChu, hd.NgayKetThucThucTe
                    FROM dbo.HopDong hd
                    LEFT JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                    WHERE hd.MaSinhVien = @MaSinhVien
                    ORDER BY hd.NgayBatDau DESC, hd.MaHopDong DESC
                `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY HỢP ĐỒNG SINH VIÊN", error, "Không thể lấy hợp đồng.");
        }
    });

    app.get("/api/student/requests", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, 403, "Chỉ Sinh viên mới được xem yêu cầu của mình.");
        }
        try {
            const result = await getPool().request()
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .query(`
                    SELECT MaYeuCau, Loai, NoiDung, NgayKetThucDeXuat,
                           TenPhong, TrangThai, PhanHoi, NgayTao, NgayXuLy
                    FROM dbo.YeuCauSinhVien
                    WHERE MaSinhVien = @MaSinhVien
                    ORDER BY NgayTao DESC, Id DESC
                `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY YÊU CẦU SINH VIÊN", error, "Không thể lấy danh sách yêu cầu.");
        }
    });

    app.post("/api/student/requests", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, 403, "Chỉ Sinh viên mới được gửi yêu cầu.");
        }
        if (!isObjectBody(req.body)
            || !["Gia hạn hợp đồng", "Báo hỏng thiết bị"].includes(req.body.Loai)
            || typeof req.body.NoiDung !== "string"
            || !req.body.NoiDung.trim()
            || req.body.NoiDung.trim().length > 1000) {
            return respondRequestError(res, 400, "Loại yêu cầu hợp lệ và nội dung từ 1 đến 1000 ký tự là bắt buộc.");
        }
        const extensionEndDate = req.body.NgayKetThucDeXuat;
        if (req.body.Loai === "Gia hạn hợp đồng" && !isDateOnly(extensionEndDate)) {
            return respondRequestError(res, 400, "Ngày kết thúc đề xuất hợp lệ là bắt buộc khi yêu cầu gia hạn.");
        }
        if (req.body.Loai === "Báo hỏng thiết bị" && extensionEndDate != null && extensionEndDate !== "") {
            return respondRequestError(res, 400, "Yêu cầu báo hỏng không nhận ngày kết thúc đề xuất.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const studentResult = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .query(`
                    SELECT sv.TenPhong, hd.NgayKetThuc
                    FROM dbo.SinhVien sv WITH (UPDLOCK, HOLDLOCK)
                    OUTER APPLY (
                        SELECT TOP (1) NgayKetThuc
                        FROM dbo.HopDong
                        WHERE MaSinhVien = sv.MaSinhVien
                          AND TrangThaiHopDong = N'Còn hiệu lực'
                        ORDER BY NgayBatDau DESC, MaHopDong DESC
                    ) hd
                    WHERE sv.MaSinhVien = @MaSinhVien
                `);
            const student = studentResult.recordset[0];
            if (!student) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hồ sơ Sinh viên.");
            }
            if (req.body.Loai === "Gia hạn hợp đồng"
                && (!student.NgayKetThuc
                    || extensionEndDate <= student.NgayKetThuc.toISOString().slice(0, 10))) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Ngày kết thúc đề xuất phải sau ngày kết thúc hợp đồng hiện tại còn hiệu lực.");
            }
            const result = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .input("Loai", sql.NVarChar(30), req.body.Loai)
                .input("NoiDung", sql.NVarChar(1000), req.body.NoiDung.trim())
                .input("NgayKetThucDeXuat", sql.Date,
                    req.body.Loai === "Gia hạn hợp đồng" ? extensionEndDate : null)
                .input("TenPhong", sql.NVarChar(50), student.TenPhong)
                .query(`
                    INSERT INTO dbo.YeuCauSinhVien
                        (MaSinhVien, Loai, NoiDung, NgayKetThucDeXuat, TenPhong)
                    OUTPUT inserted.MaYeuCau, inserted.TrangThai, inserted.NgayTao
                    VALUES
                        (@MaSinhVien, @Loai, @NoiDung, @NgayKetThucDeXuat, @TenPhong)
                `);
            await transaction.commit();
            return res.status(201).json({ success: true, ...result.recordset[0] });
        } catch (error) {
            await rollback(transaction, "TẠO YÊU CẦU SINH VIÊN");
            return respondDatabaseError(res, "LỖI TẠO YÊU CẦU SINH VIÊN", error, "Không thể gửi yêu cầu.");
        }
    });

    app.get("/api/requests", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được xem danh sách yêu cầu Sinh viên.");
        }
        try {
            const result = await getPool().request().query(`
                SELECT yc.MaYeuCau, yc.MaSinhVien, sv.HoTen, yc.TenPhong,
                       yc.Loai, yc.NoiDung, yc.NgayKetThucDeXuat, yc.TrangThai,
                       yc.PhanHoi, yc.NgayTao, yc.NgayXuLy,
                       tk.TenHienThi AS TenNguoiXuLy
                FROM dbo.YeuCauSinhVien yc
                INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = yc.MaSinhVien
                LEFT JOIN dbo.TaiKhoan tk ON tk.MaTaiKhoan = yc.XuLyBoi
                ORDER BY yc.NgayTao DESC, yc.Id DESC
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DANH SÁCH YÊU CẦU", error, "Không thể lấy danh sách yêu cầu Sinh viên.");
        }
    });

    app.put("/api/requests/:id", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được xử lý yêu cầu Sinh viên.");
        }
        if (!/^YC\d{5}$/.test(req.params.id)) {
            return respondRequestError(res, 400, "Mã yêu cầu không hợp lệ.");
        }
        const status = req.body?.TrangThai;
        const reply = req.body?.PhanHoi;
        if (!isObjectBody(req.body) || !["Đã duyệt", "Từ chối"].includes(status)
            || !isOptionalText(reply, 500)
            || (status === "Từ chối" && !stringValue(reply))) {
            return respondRequestError(res, 400, "Trạng thái xử lý không hợp lệ; lý do từ chối là bắt buộc và phản hồi tối đa 500 ký tự.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const result = await new sql.Request(transaction)
                .input("MaYeuCau", sql.NVarChar(7), req.params.id)
                .input("TrangThai", sql.NVarChar(15), status)
                .input("PhanHoi", sql.NVarChar(500), stringValue(reply) || null)
                .input("XuLyBoi", sql.Int, req.auth.accountId)
                .query(`
                    UPDATE dbo.YeuCauSinhVien WITH (UPDLOCK, HOLDLOCK)
                    SET TrangThai = @TrangThai,
                        PhanHoi = @PhanHoi,
                        NgayXuLy = GETDATE(),
                        XuLyBoi = @XuLyBoi
                    OUTPUT inserted.MaYeuCau, inserted.TrangThai,
                           inserted.PhanHoi, inserted.NgayXuLy
                    WHERE MaYeuCau = @MaYeuCau AND TrangThai = N'Chờ duyệt'
                `);
            if (!result.recordset.length) {
                const exists = await new sql.Request(transaction)
                    .input("MaYeuCau", sql.NVarChar(7), req.params.id)
                    .query("SELECT TrangThai FROM dbo.YeuCauSinhVien WHERE MaYeuCau = @MaYeuCau");
                await transaction.rollback();
                return exists.recordset.length
                    ? respondRequestError(res, 409, "Yêu cầu đã được xử lý.")
                    : respondRequestError(res, 404, "Không tìm thấy yêu cầu.");
            }
            await transaction.commit();
            return res.json({ success: true, ...result.recordset[0] });
        } catch (error) {
            await rollback(transaction, "XỬ LÝ YÊU CẦU SINH VIÊN");
            return respondDatabaseError(res, "LỖI XỬ LÝ YÊU CẦU", error, "Không thể cập nhật yêu cầu.");
        }
    });

    app.get("/api/Phong", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT TenPhong, Khu, LoaiPhong, SucChuaToiDa, SoSinhVienHienTai,
                       TrangThaiPhong, GhiChu, GiaPhong
                FROM dbo.Phong
                ORDER BY Khu, TenPhong
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DANH SÁCH PHÒNG", error, "Không thể lấy danh sách phòng.");
        }
    });

    app.get("/api/SinhVien/Phong/:roomName", async (req, res) => {
        if (!isValidId(req.params.roomName, 50)) {
            return respondRequestError(res, 400, "Tên phòng không hợp lệ.");
        }
        try {
            const result = await getPool().request()
                .input("TenPhong", sql.NVarChar(50), req.params.roomName)
                .query(`
                    SELECT MaSinhVien, HoTen, GioiTinh, SoDienThoai, Email, TrangThaiSinhVien
                    FROM dbo.SinhVien
                    WHERE TenPhong = @TenPhong AND TrangThaiSinhVien = N'Đang ở'
                    ORDER BY HoTen, MaSinhVien
                `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY SINH VIÊN THEO PHÒNG", error, "Không thể lấy danh sách sinh viên của phòng.");
        }
    });

    app.post("/api/Phong", async (req, res) => {
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const { TenPhong, Khu, LoaiPhong, SucChuaToiDa, GhiChu } = req.body;
        const roomName = stringValue(TenPhong);
        const area = stringValue(Khu);
        const roomType = stringValue(LoaiPhong);
        const capacity = SucChuaToiDa;
        if (!roomName || roomName.length > 50 || !["A", "B", "C"].includes(area)
            || !["Nam", "Nữ"].includes(roomType) || !isRoomCapacity(capacity)
            || !isOptionalText(GhiChu, 255)) {
            return respondRequestError(res, 400, "Tên phòng (tối đa 50 ký tự), khu A/B/C, loại phòng Nam/Nữ, sức chứa 4/6/8 và ghi chú tối đa 255 ký tự là bắt buộc/được hỗ trợ.");
        }

        try {
            await getPool().request()
                .input("TenPhong", sql.NVarChar(50), roomName)
                .input("Khu", sql.NVarChar(10), area)
                .input("LoaiPhong", sql.NVarChar(10), roomType)
                .input("SucChuaToiDa", sql.Int, capacity)
                .input("GhiChu", sql.NVarChar(255), stringValue(GhiChu) || null)
                .query(`
                    INSERT INTO dbo.Phong
                        (TenPhong, Khu, LoaiPhong, SucChuaToiDa, SoSinhVienHienTai, TrangThaiPhong, GhiChu)
                    VALUES
                        (@TenPhong, @Khu, @LoaiPhong, @SucChuaToiDa, 0, N'Trống', @GhiChu)
                `);
            return res.status(201).json({ success: true, TenPhong: roomName });
        } catch (error) {
            if (error.number === 2627 || error.number === 2601) {
                return respondRequestError(res, 409, "Tên phòng đã tồn tại.");
            }
            return respondDatabaseError(res, "LỖI TẠO PHÒNG", error, "Không thể tạo phòng.");
        }
    });

    app.put("/api/Phong/:id", async (req, res) => {
        if (!isValidId(req.params.id, 50)) return respondRequestError(res, 400, "Tên phòng không hợp lệ.");
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const { Khu, LoaiPhong, SucChuaToiDa, TrangThaiPhong, GhiChu } = req.body;
        const area = stringValue(Khu);
        const roomType = stringValue(LoaiPhong);
        const capacity = SucChuaToiDa;
        const status = stringValue(TrangThaiPhong);
        if (!["A", "B", "C"].includes(area) || !["Nam", "Nữ"].includes(roomType)
            || !isRoomCapacity(capacity)
            || !["Trống", "Đầy", "Bảo trì", "Ngưng sử dụng"].includes(status)
            || !isOptionalText(GhiChu, 255)) {
            return respondRequestError(res, 400, "Khu A/B/C, loại phòng Nam/Nữ, sức chứa 4/6/8, trạng thái hợp lệ và ghi chú tối đa 255 ký tự là bắt buộc/được hỗ trợ.");
        }

        try {
            const result = await getPool().request()
                .input("TenPhong", sql.NVarChar(50), req.params.id)
                .input("Khu", sql.NVarChar(10), area)
                .input("LoaiPhong", sql.NVarChar(10), roomType)
                .input("SucChuaToiDa", sql.Int, capacity)
                .input("TrangThaiPhong", sql.NVarChar(20), status)
                .input("GhiChu", sql.NVarChar(255), stringValue(GhiChu) || null)
                .query(`
                    UPDATE dbo.Phong
                    SET Khu = @Khu, LoaiPhong = @LoaiPhong, SucChuaToiDa = @SucChuaToiDa,
                        TrangThaiPhong = @TrangThaiPhong, GhiChu = @GhiChu
                    WHERE TenPhong = @TenPhong
                `);
            if (result.rowsAffected[0] === 0) return respondRequestError(res, 404, "Không tìm thấy phòng.");
            return res.json({ success: true });
        } catch (error) {
            return respondDatabaseError(res, "LỖI CẬP NHẬT PHÒNG", error, "Không thể cập nhật phòng.");
        }
    });

    app.get("/api/sinhvien/thongke", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT
                    COUNT_BIG(*) AS tongSinhVien,
                    SUM(CASE WHEN GioiTinh = N'Nam' THEN 1 ELSE 0 END) AS tongNam,
                    SUM(CASE WHEN GioiTinh = N'Nữ' THEN 1 ELSE 0 END) AS tongNu,
                    SUM(CASE WHEN TrangThaiSinhVien = N'Đang ở' THEN 1 ELSE 0 END) AS dangO
                FROM dbo.SinhVien
            `);
            const stats = result.recordset[0];
            return res.json({
                tongSinhVien: Number(stats.tongSinhVien),
                tongNam: Number(stats.tongNam || 0),
                tongNu: Number(stats.tongNu || 0),
                dangO: Number(stats.dangO || 0)
            });
        } catch (error) {
            return respondDatabaseError(res, "LỖI THỐNG KÊ SINH VIÊN", error, "Không thể lấy thống kê sinh viên.");
        }
    });

    app.get("/api/sinhvien", async (req, res) => {
        const pageInput = req.query.page;
        const pageSizeInput = req.query.pageSize;
        const page = pageInput === undefined ? 1 : Number(pageInput);
        const pageSize = pageSizeInput === undefined ? 10 : Number(pageSizeInput);
        const keywordInput = req.query.keyword;
        if (!isJsonInteger(page, 1, 2147483647) || !isJsonInteger(pageSize, 1, 100)
            || (page - 1) * pageSize > 2147483647
            || (keywordInput !== undefined && (typeof keywordInput !== "string" || keywordInput.length > 200))) {
            return respondRequestError(res, 400, "Trang phải là số nguyên dương, kích thước trang từ 1 đến 100 và từ khóa tối đa 200 ký tự.");
        }

        const statusInput = stringValue(req.query.status);
        const status = statusInput ? normalizeStudentStatus(statusInput) : null;
        if (statusInput && !status) return respondRequestError(res, 400, "Trạng thái sinh viên không hợp lệ.");

        try {
            const request = getPool().request()
                .input("Keyword", sql.NVarChar(200), stringValue(req.query.keyword))
                .input("TrangThai", sql.NVarChar(20), status)
                .input("Offset", sql.Int, (page - 1) * pageSize)
                .input("PageSize", sql.Int, pageSize);
            const result = await request.query(`
                SELECT COUNT_BIG(*) AS total
                FROM dbo.SinhVien
                WHERE (@Keyword = N'' OR MaSinhVien LIKE N'%' + @Keyword + N'%' OR HoTen LIKE N'%' + @Keyword + N'%')
                  AND (@TrangThai IS NULL OR TrangThaiSinhVien = @TrangThai);

                SELECT MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email,
                       DiaChi, TrangThaiSinhVien, TenPhong, GhiChu
                FROM dbo.SinhVien
                WHERE (@Keyword = N'' OR MaSinhVien LIKE N'%' + @Keyword + N'%' OR HoTen LIKE N'%' + @Keyword + N'%')
                  AND (@TrangThai IS NULL OR TrangThaiSinhVien = @TrangThai)
                ORDER BY HoTen, MaSinhVien
                OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
            `);
            const total = Number(result.recordsets[0][0].total);
            const totalPages = Math.ceil(total / pageSize);
            const data = result.recordsets[1].map(normalizeStudent);
            return res.json({ data, page, pageSize, total, totalPages });
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DANH SÁCH SINH VIÊN", error, "Không thể lấy danh sách sinh viên.");
        }
    });

    app.get("/api/sinhvien/chitiet/:mssv", async (req, res) => {
        if (!isValidId(req.params.mssv, 30)) return respondRequestError(res, 400, "Mã sinh viên không hợp lệ.");
        try {
            const result = await getPool().request()
                .input("MaSinhVien", sql.NVarChar(30), req.params.mssv)
                .query(`
                    SELECT TOP (1)
                        sv.MaSinhVien, sv.HoTen, sv.NgaySinh, sv.GioiTinh, sv.SoDienThoai,
                        sv.Email, sv.Email AS EmailTruong, sv.DiaChi, sv.Truong, sv.Lop, sv.GhiChu,
                        sv.TrangThaiSinhVien, sv.TenPhong, sv.NgayRoiKTX, sv.NgayTao,
                        p.Khu, p.LoaiPhong, p.SucChuaToiDa, p.TrangThaiPhong,
                        hd.MaHopDong, hd.NgayBatDau, hd.NgayKetThuc,
                        hd.TrangThaiHopDong AS TrangThaiHopDongHienTai,
                        tk.MaTaiKhoan, tk.Email AS EmailDangNhap, tk.VaiTro,
                        tk.TrangThai AS TrangThaiTaiKhoan
                    FROM dbo.SinhVien sv
                    LEFT JOIN dbo.Phong p ON p.TenPhong = sv.TenPhong
                    LEFT JOIN dbo.HopDong hd
                        ON hd.MaSinhVien = sv.MaSinhVien AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                    LEFT JOIN dbo.TaiKhoan tk ON tk.MaSinhVien = sv.MaSinhVien
                    WHERE sv.MaSinhVien = @MaSinhVien
                    ORDER BY hd.NgayKetThuc DESC
                `);
            if (!result.recordset[0]) return respondRequestError(res, 404, "Không tìm thấy sinh viên.");
            return res.json(normalizeStudent(result.recordset[0]));
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY CHI TIẾT SINH VIÊN", error, "Không thể lấy chi tiết sinh viên.");
        }
    });

    app.get("/api/SinhVienById/:mssv", async (req, res) => {
        if (!isValidId(req.params.mssv, 30)) return respondRequestError(res, 400, "Mã sinh viên không hợp lệ.");
        try {
            const result = await getPool().request()
                .input("MaSinhVien", sql.NVarChar(30), req.params.mssv)
                .query(`
                    SELECT MaSinhVien, HoTen, TenPhong, TrangThaiSinhVien
                    FROM dbo.SinhVien
                    WHERE MaSinhVien = @MaSinhVien
                `);
            return res.json(result.recordset[0] || null);
        } catch (error) {
            return respondDatabaseError(res, "LỖI TRA CỨU SINH VIÊN", error, "Không thể tra cứu sinh viên.");
        }
    });

    app.post("/api/sinhvien", async (req, res) => {
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const body = req.body;
        const studentId = stringValue(body.MaSinhVien);
        const name = stringValue(body.HoTen);
        const gender = stringValue(body.GioiTinh);
        const phone = body.SoDienThoai;
        const email = stringValue(body.Email).toLowerCase();
        const room = stringValue(body.TenPhong);
        const birthday = body.NgaySinh;
        const address = stringValue(body.DiaChi);
        const note = stringValue(body.GhiChu);
        const validationMessage = validateStudentInput({
            studentId: body.MaSinhVien,
            name: body.HoTen,
            gender,
            phone,
            email: body.Email,
            birthday,
            address: body.DiaChi,
            note: body.GhiChu,
            room
        });
        if (validationMessage) return respondRequestError(res, 400, validationMessage);
        if (body.TrangThaiSinhVien !== undefined && body.TrangThaiSinhVien !== "Đang ở") {
            return respondRequestError(res, 400, "Sinh viên mới phải có trạng thái 'Đang ở'.");
        }

        try {
            await getPool().request()
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("HoTen", sql.NVarChar(100), name)
                .input("NgaySinh", sql.Date, birthday || null)
                .input("GioiTinh", sql.NVarChar(10), gender)
                .input("SoDienThoai", sql.Char(10), phone)
                .input("Email", sql.NVarChar(100), email)
                .input("DiaChi", sql.NVarChar(255), address || null)
                .input("TenPhong", sql.NVarChar(50), room)
                .input("GhiChu", sql.NVarChar(255), note || null)
                .query(`
                    INSERT INTO dbo.SinhVien
                        (MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
                         TrangThaiSinhVien, TenPhong, GhiChu)
                    VALUES
                        (@MaSinhVien, @HoTen, @NgaySinh, @GioiTinh, @SoDienThoai, @Email, @DiaChi,
                         N'Đang ở', @TenPhong, @GhiChu)
                `);
            return res.status(201).json({ success: true, MaSinhVien: studentId });
        } catch (error) {
            if (error.number === 2627 || error.number === 2601) {
                return respondRequestError(res, 409, "Mã sinh viên hoặc email đã tồn tại.");
            }
            if (error.number === 547 || error.number === 50000) {
                return respondRequestError(res, 409, "Phòng không hợp lệ, đã đầy hoặc không phù hợp với giới tính.");
            }
            return respondDatabaseError(res, "LỖI TẠO SINH VIÊN", error, "Không thể tạo sinh viên.");
        }
    });

    app.put("/api/sinhvien/:mssv", async (req, res) => {
        if (!isValidId(req.params.mssv, 30)) return respondRequestError(res, 400, "Mã sinh viên trên URL không hợp lệ.");
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const body = req.body;
        const studentId = stringValue(bodyValue(body, "mssv", "MaSinhVien"));
        const name = stringValue(bodyValue(body, "hoTen", "HoTen"));
        const birthday = bodyValue(body, "ngaySinh", "NgaySinh");
        const gender = stringValue(bodyValue(body, "gioiTinh", "GioiTinh"));
        const phone = bodyValue(body, "soDienThoai", "SoDienThoai");
        const emailValue = bodyValue(body, "email", "Email");
        const email = stringValue(emailValue).toLowerCase();
        const address = stringValue(bodyValue(body, "diaChi", "DiaChi"));
        const room = stringValue(bodyValue(body, "tenPhong", "room", "TenPhong"));
        const status = normalizeStudentStatus(bodyValue(body, "trangThaiSinhVien", "status", "TrangThaiSinhVien"));
        const note = stringValue(bodyValue(body, "ghiChu", "note", "GhiChu"));
        const validationMessage = validateStudentInput({
            studentId,
            name,
            gender,
            phone,
            email: emailValue,
            birthday,
            address: bodyValue(body, "diaChi", "DiaChi"),
            note: bodyValue(body, "ghiChu", "note", "GhiChu"),
            room,
            status
        });
        if (validationMessage) return respondRequestError(res, 400, validationMessage);

        try {
            const result = await getPool().request()
                .input("MaSinhVienCu", sql.NVarChar(30), req.params.mssv)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("HoTen", sql.NVarChar(100), name)
                .input("NgaySinh", sql.Date, birthday || null)
                .input("GioiTinh", sql.NVarChar(10), gender)
                .input("SoDienThoai", sql.Char(10), phone)
                .input("Email", sql.NVarChar(100), email)
                .input("DiaChi", sql.NVarChar(255), address || null)
                .input("TenPhong", sql.NVarChar(50), status === "Đang ở" ? room : null)
                .input("TrangThaiSinhVien", sql.NVarChar(20), status)
                .input("GhiChu", sql.NVarChar(255), note || null)
                .query(`
                    UPDATE dbo.SinhVien
                    SET MaSinhVien = @MaSinhVien, HoTen = @HoTen, NgaySinh = @NgaySinh,
                        GioiTinh = @GioiTinh, SoDienThoai = @SoDienThoai, Email = @Email,
                        DiaChi = @DiaChi, TenPhong = @TenPhong, TrangThaiSinhVien = @TrangThaiSinhVien,
                        NgayRoiKTX = CASE WHEN @TrangThaiSinhVien = N'Đang ở' THEN NULL ELSE CAST(GETDATE() AS date) END,
                        GhiChu = @GhiChu
                    WHERE MaSinhVien = @MaSinhVienCu
                `);
            if (result.rowsAffected[0] === 0) return respondRequestError(res, 404, "Không tìm thấy sinh viên.");
            return res.json({ success: true, MaSinhVien: studentId });
        } catch (error) {
            if (error.number === 2627 || error.number === 2601) {
                return respondRequestError(res, 409, "Mã sinh viên hoặc email đã tồn tại.");
            }
            if (error.number === 547 || error.number === 50000) {
                return respondRequestError(res, 409, "Không thể đổi phòng hoặc trạng thái theo thông tin đã chọn.");
            }
            return respondDatabaseError(res, "LỖI CẬP NHẬT SINH VIÊN", error, "Không thể cập nhật sinh viên.");
        }
    });

    app.get("/api/HopDong", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT hd.MaHopDong, hd.MaSinhVien, sv.HoTen, hd.TenPhong,
                       hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong, hd.GhiChu,
                       hd.SoLanGiaHan, hd.NgayKetThucThucTe
                FROM dbo.HopDong hd
                INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                ORDER BY hd.NgayBatDau DESC, hd.MaHopDong DESC
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DANH SÁCH HỢP ĐỒNG", error, "Không thể lấy danh sách hợp đồng.");
        }
    });

    app.post("/api/HopDong", async (req, res) => {
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const studentId = stringValue(req.body.MaSinhVien);
        const room = stringValue(req.body.TenPhong);
        const startDate = req.body.NgayBatDau;
        const endDate = req.body.NgayKetThuc;
        const note = typeof req.body.GhiChu === "string" ? req.body.GhiChu.trim() : "";
        if (!isValidId(req.body.MaSinhVien, 30) || !isValidId(req.body.TenPhong, 50)
            || !isDateOnly(startDate) || !isDateOnly(endDate)
            || endDate <= startDate || !isOptionalText(req.body.GhiChu, 255)) {
            return respondRequestError(res, 400, "Mã sinh viên và phòng là bắt buộc; ngày bắt đầu/kết thúc phải là ngày hợp lệ theo YYYY-MM-DD, ngày kết thúc phải sau ngày bắt đầu và ghi chú tối đa 255 ký tự.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const studentResult = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    SELECT MaSinhVien, HoTen, TenPhong, GioiTinh, TrangThaiSinhVien
                    FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaSinhVien = @MaSinhVien
                `);
            const student = studentResult.recordset[0];
            if (!student) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy sinh viên.");
            }

            const existing = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    SELECT TOP (1) MaHopDong
                    FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N'Còn hiệu lực'
                `);
            if (existing.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Sinh viên đã có hợp đồng còn hiệu lực.");
            }

            const roomResult = await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), room)
                .query(`
                    SELECT LoaiPhong, TrangThaiPhong, SucChuaToiDa, SoSinhVienHienTai
                    FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
                    WHERE TenPhong = @TenPhong
                `);
            const roomInfo = roomResult.recordset[0];
            if (!roomInfo) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy phòng.");
            }
            if (student.GioiTinh !== roomInfo.LoaiPhong
                || ["Bảo trì", "Ngưng sử dụng"].includes(roomInfo.TrangThaiPhong)
                || (student.TenPhong !== room && roomInfo.SoSinhVienHienTai >= roomInfo.SucChuaToiDa)) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Phòng không khả dụng hoặc không phù hợp với sinh viên.");
            }

            const sequenceResult = await new sql.Request(transaction)
                .query("SELECT NEXT VALUE FOR dbo.Seq_MaHopDong AS SoThuTu");
            const contractId = `HD${String(sequenceResult.recordset[0].SoThuTu).padStart(5, "0")}`;
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), contractId)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("TenPhong", sql.NVarChar(50), room)
                .input("NgayBatDau", sql.Date, startDate)
                .input("NgayKetThuc", sql.Date, endDate)
                .input("GhiChu", sql.NVarChar(255), note || null)
                .query(`
                    INSERT INTO dbo.HopDong
                        (MaHopDong, MaSinhVien, TenPhong, NgayBatDau, NgayKetThuc,
                         TrangThaiHopDong, NgayTao, GhiChu)
                    VALUES
                        (@MaHopDong, @MaSinhVien, @TenPhong, @NgayBatDau, @NgayKetThuc,
                         N'Còn hiệu lực', CAST(GETDATE() AS date), @GhiChu)
                `);
            await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("TenPhong", sql.NVarChar(50), room)
                .query(`
                    UPDATE dbo.SinhVien
                    SET TenPhong = @TenPhong, TrangThaiSinhVien = N'Đang ở', NgayRoiKTX = NULL
                    WHERE MaSinhVien = @MaSinhVien
                `);
            await addContractHistory(new sql.Request(transaction), sql, {
                contractId, studentId, studentName: student.HoTen, room, startDate, endDate,
                status: "Còn hiệu lực", action: "Tạo mới"
            });
            await transaction.commit();
            return res.status(201).json({ success: true, MaHopDong: contractId });
        } catch (error) {
            await rollback(transaction, "TẠO HỢP ĐỒNG");
            return respondDatabaseError(res, "LỖI TẠO HỢP ĐỒNG", error, "Không thể tạo hợp đồng.");
        }
    });

    app.put("/api/HopDong/extend/:id", async (req, res) => {
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hợp đồng không hợp lệ.");
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const endDate = req.body.NgayKetThuc;
        if (!isDateOnly(endDate)) return respondRequestError(res, 400, "Ngày kết thúc phải là ngày hợp lệ theo YYYY-MM-DD.");

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const currentResult = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT hd.MaHopDong, hd.MaSinhVien, sv.HoTen, hd.TenPhong, hd.NgayBatDau,
                           hd.NgayKetThuc, hd.TrangThaiHopDong
                    FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                    WHERE hd.MaHopDong = @MaHopDong
                `);
            const contract = currentResult.recordset[0];
            if (!contract) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hợp đồng.");
            }
            if (contract.TrangThaiHopDong !== "Còn hiệu lực" || endDate <= contract.NgayKetThuc.toISOString().slice(0, 10)) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Chỉ có thể gia hạn hợp đồng còn hiệu lực đến ngày sau hạn hiện tại.");
            }
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), contract.MaHopDong)
                .input("NgayKetThuc", sql.Date, endDate)
                .query(`
                    UPDATE dbo.HopDong
                    SET NgayKetThucGoc = COALESCE(NgayKetThucGoc, NgayKetThuc),
                        NgayKetThuc = @NgayKetThuc, SoLanGiaHan = SoLanGiaHan + 1
                    WHERE MaHopDong = @MaHopDong
                `);
            await addContractHistory(new sql.Request(transaction), sql, {
                contractId: contract.MaHopDong, studentId: contract.MaSinhVien, studentName: contract.HoTen,
                room: contract.TenPhong, startDate: contract.NgayBatDau, endDate,
                status: "Còn hiệu lực", action: "Gia hạn"
            });
            await transaction.commit();
            return res.status(200).send("Gia hạn hợp đồng thành công.");
        } catch (error) {
            await rollback(transaction, "GIA HẠN HỢP ĐỒNG");
            return respondDatabaseError(res, "LỖI GIA HẠN HỢP ĐỒNG", error, "Không thể gia hạn hợp đồng.");
        }
    });

    app.put("/api/HopDong/end/:id", async (req, res) => {
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hợp đồng không hợp lệ.");
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const contractResult = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT hd.MaHopDong, hd.MaSinhVien, sv.HoTen, hd.TenPhong,
                           hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
                    FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                    WHERE hd.MaHopDong = @MaHopDong
                `);
            const contract = contractResult.recordset[0];
            if (!contract) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hợp đồng.");
            }
            if (contract.TrangThaiHopDong !== "Còn hiệu lực") {
                await transaction.rollback();
                return respondRequestError(res, 409, "Hợp đồng không còn hiệu lực.");
            }

            await addContractHistory(new sql.Request(transaction), sql, {
                contractId: contract.MaHopDong, studentId: contract.MaSinhVien, studentName: contract.HoTen,
                room: contract.TenPhong, startDate: contract.NgayBatDau, endDate: contract.NgayKetThuc,
                status: "Đã kết thúc", action: "Kết thúc"
            });
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), contract.MaHopDong)
                .query(`
                    UPDATE dbo.HopDong
                    SET TrangThaiHopDong = N'Đã kết thúc',
                        NgayKetThucThucTe = CAST(GETDATE() AS date)
                    WHERE MaHopDong = @MaHopDong
                `);
            const activeContractResult = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), contract.MaSinhVien)
                .query(`
                    SELECT TOP (1) 1 AS existsActive
                    FROM dbo.HopDong
                    WHERE MaSinhVien = @MaSinhVien AND TrangThaiHopDong = N'Còn hiệu lực'
                `);
            if (!activeContractResult.recordset.length) {
                await new sql.Request(transaction)
                    .input("MaSinhVien", sql.NVarChar(30), contract.MaSinhVien)
                    .query(`
                        UPDATE dbo.SinhVien
                        SET TrangThaiSinhVien = N'Đã rời KTX', TenPhong = NULL,
                            NgayRoiKTX = CAST(GETDATE() AS date)
                        WHERE MaSinhVien = @MaSinhVien
                    `);
            }
            await transaction.commit();
            return res.status(200).send("Kết thúc hợp đồng thành công.");
        } catch (error) {
            await rollback(transaction, "KẾT THÚC HỢP ĐỒNG");
            return respondDatabaseError(res, "LỖI KẾT THÚC HỢP ĐỒNG", error, "Không thể kết thúc hợp đồng.");
        }
    });

    app.get("/api/history", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT MaLS, MaHopDong, MaSinhVien, HoTen, TenPhong, NgayBatDau,
                       NgayKetThuc, TrangThaiHopDong, ThaoTac, ThoiDiem
                FROM dbo.vw_LichSuHopDongFE
                ORDER BY ThoiDiem DESC, MaLS DESC
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY LỊCH SỬ HỢP ĐỒNG", error, "Không thể lấy lịch sử hợp đồng.");
        }
    });

    app.put("/api/HopDong/note/:id", async (req, res) => {
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hợp đồng không hợp lệ.");
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const note = req.body.GhiChu;
        if (typeof note !== "string" || note.length > 255) {
            return respondRequestError(res, 400, "Ghi chú phải là chuỗi tối đa 255 ký tự.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin();
            const currentResult = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT hd.MaHopDong, hd.MaSinhVien, sv.HoTen, hd.TenPhong,
                           hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
                    FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                    WHERE hd.MaHopDong = @MaHopDong
                `);
            const contract = currentResult.recordset[0];
            if (!contract) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hợp đồng.");
            }
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("GhiChu", sql.NVarChar(255), note || null)
                .query("UPDATE dbo.HopDong SET GhiChu = @GhiChu WHERE MaHopDong = @MaHopDong");
            await addContractHistory(new sql.Request(transaction), sql, {
                contractId: contract.MaHopDong, studentId: contract.MaSinhVien, studentName: contract.HoTen,
                room: contract.TenPhong, startDate: contract.NgayBatDau, endDate: contract.NgayKetThuc,
                status: contract.TrangThaiHopDong, action: "Ghi chú"
            });
            await transaction.commit();
            return res.status(200).send("Lưu ghi chú thành công.");
        } catch (error) {
            await rollback(transaction, "LƯU GHI CHÚ HỢP ĐỒNG");
            return respondDatabaseError(res, "LỖI LƯU GHI CHÚ HỢP ĐỒNG", error, "Không thể lưu ghi chú hợp đồng.");
        }
    });

    app.get("/api/nam-co-du-lieu", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT Nam FROM (
                    SELECT YEAR(NgayLap) AS Nam FROM dbo.HoaDon WHERE NgayLap IS NOT NULL
                    UNION
                    SELECT YEAR(NgayTao) FROM dbo.SinhVien WHERE NgayTao IS NOT NULL
                    UNION
                    SELECT YEAR(NgayBatDau) FROM dbo.HopDong
                ) years
                WHERE Nam IS NOT NULL
                ORDER BY Nam DESC
            `);
            return res.json(result.recordset.map(row => row.Nam));
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DANH SÁCH NĂM", error, "Không thể lấy danh sách năm.");
        }
    });

    app.get("/api/tyle-roi-bo/:year", async (req, res) => {
        const year = /^\d{4}$/.test(req.params.year) ? Number(req.params.year) : NaN;
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            return respondRequestError(res, 400, "Năm thống kê phải là số nguyên từ 2000 đến 2100.");
        }

        try {
            const result = await getPool().request()
                .input("Nam", sql.Int, year)
                .query(`
                    WITH Months AS (
                        SELECT 1 AS Thang
                        UNION ALL SELECT Thang + 1 FROM Months WHERE Thang < 12
                    ),
                    Periods AS (
                        SELECT Thang,
                               DATEFROMPARTS(@Nam, Thang, 1) AS BatDau,
                               DATEADD(month, 1, DATEFROMPARTS(@Nam, Thang, 1)) AS KetThuc
                        FROM Months
                    )
                    SELECT p.Thang,
                           CAST(CASE WHEN active.SoLuong = 0 THEN 0
                                     ELSE 100.0 * exits.SoLuong / active.SoLuong END AS decimal(7,2)) AS TyLe
                    FROM Periods p
                    OUTER APPLY (
                        SELECT COUNT_BIG(*) AS SoLuong
                        FROM dbo.SinhVien sv
                        WHERE ISNULL(sv.NgayTao, CONVERT(datetime, '19000101', 112)) < p.BatDau
                          AND (sv.NgayRoiKTX IS NULL OR sv.NgayRoiKTX >= p.BatDau)
                    ) active
                    OUTER APPLY (
                        SELECT COUNT_BIG(*) AS SoLuong
                        FROM dbo.SinhVien sv
                        WHERE sv.NgayRoiKTX >= p.BatDau AND sv.NgayRoiKTX < p.KetThuc
                    ) exits
                    ORDER BY p.Thang
                    OPTION (MAXRECURSION 12)
                `);
            return res.json({ tyLeRoiBo: result.recordset.map(row => Number(row.TyLe)) });
        } catch (error) {
            return respondDatabaseError(res, "LỖI THỐNG KÊ TỶ LỆ RỜI BỎ", error, "Không thể lấy tỷ lệ sinh viên rời ký túc xá.");
        }
    });

    app.get("/api/gioi-tinh-sinh-vien", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT
                    SUM(CASE WHEN GioiTinh = N'Nam' THEN 1 ELSE 0 END) AS nam,
                    SUM(CASE WHEN GioiTinh = N'Nữ' THEN 1 ELSE 0 END) AS nu
                FROM dbo.SinhVien
                WHERE TrangThaiSinhVien = N'Đang ở'
            `);
            return res.json({
                nam: Number(result.recordset[0].nam || 0),
                nu: Number(result.recordset[0].nu || 0)
            });
        } catch (error) {
            return respondDatabaseError(res, "LỖI THỐNG KÊ GIỚI TÍNH", error, "Không thể lấy thống kê giới tính sinh viên.");
        }
    });

    app.get("/api/doanhthu/:year", async (req, res) => {
        const year = /^\d{4}$/.test(req.params.year) ? Number(req.params.year) : NaN;
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            return respondRequestError(res, 400, "Năm thống kê phải là số nguyên từ 2000 đến 2100.");
        }

        try {
            const result = await getPool().request()
                .input("Nam", sql.Int, year)
                .query(`
                    SELECT Thang, DoanhThuTienPhong, DoanhThuDienNuocKhac
                    FROM dbo.vw_DoanhThuThang
                    WHERE Nam = @Nam
                `);
            const phong = Array(12).fill(0);
            const dienNuoc = Array(12).fill(0);
            for (const row of result.recordset) {
                phong[row.Thang - 1] = Number(row.DoanhThuTienPhong || 0);
                dienNuoc[row.Thang - 1] = Number(row.DoanhThuDienNuocKhac || 0);
            }
            return res.json({ phong, dienNuoc });
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DOANH THU", error, "Không thể lấy báo cáo doanh thu.");
        }
    });

    app.get("/api/HoaDon", async (req, res) => {
        if (!req.auth) return respondRequestError(res, 401, "Vui lòng đăng nhập để xem hóa đơn.");
        try {
            const request = getPool().request();
            const studentFilter = req.auth?.role === "Sinh viên";
            if (studentFilter) request.input("MaSinhVien", sql.NVarChar(20), req.auth.studentId);
            const result = await request.query(`${INVOICE_SELECT}
                ${studentFilter ? "WHERE hd.MaSinhVien = @MaSinhVien" : ""}
                ORDER BY hd.NgayLap DESC, hd.MaHoaDon DESC`);
            return res.json(result.recordset.map(normalizeInvoice));
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY HÓA ĐƠN", error, "Không thể lấy danh sách hóa đơn.");
        }
    });

    app.get("/api/HoaDon/:id", async (req, res) => {
        if (!req.auth) return respondRequestError(res, 401, "Vui lòng đăng nhập để xem hóa đơn.");
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hóa đơn không hợp lệ.");
        try {
            const request = getPool().request()
                .input("MaHoaDon", sql.NVarChar(20), req.params.id);
            const studentFilter = req.auth?.role === "Sinh viên";
            if (studentFilter) request.input("MaSinhVien", sql.NVarChar(20), req.auth.studentId);
            const result = await request.query(`${INVOICE_SELECT}
                WHERE hd.MaHoaDon = @MaHoaDon
                ${studentFilter ? "AND hd.MaSinhVien = @MaSinhVien" : ""}`);
            if (!result.recordset[0]) return respondRequestError(res, 404, "Không tìm thấy hóa đơn.");
            return res.json(normalizeInvoice(result.recordset[0]));
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY CHI TIẾT HÓA ĐƠN", error, "Không thể lấy chi tiết hóa đơn.");
        }
    });

    app.get("/api/payments/history", async (req, res) => {
        if (!req.auth) return respondRequestError(res, 401, "Vui lòng đăng nhập để xem lịch sử thanh toán.");
        const invoiceId = req.query.MaHoaDon;
        if (invoiceId !== undefined && !isValidId(invoiceId, 20)) {
            return respondRequestError(res, 400, "Mã hóa đơn không hợp lệ.");
        }

        const studentId = req.auth?.role === "Sinh viên" ? req.auth.studentId : null;
        try {
            const request = getPool().request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId || null)
                .input("MaSinhVien", sql.NVarChar(20), studentId);
            const result = await request.query(`
                SELECT gd.MaGiaoDich,
                       gd.MaSinhVien,
                       sv.HoTen,
                       hd.MaHoaDon,
                       hd.TenPhong,
                       MONTH(hd.NgayLap) AS ThangHoaDon,
                       YEAR(hd.NgayLap) AS NamHoaDon,
                       chi.TenKhoan,
                       cgd.SoTien,
                       gd.NoiDungCK,
                       gd.NgayTao,
                       gd.NgayThanhToan,
                       gd.PhuongThuc,
                       gd.TrangThai,
                       gd.XacNhanBoi,
                       xa.TenHienThi AS TenNguoiXacNhan,
                       gd.MaThamChieuNgoai,
                       gd.LyDoTuChoi
                FROM dbo.GiaoDichThanhToan gd
                INNER JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaGiaoDich = gd.MaGiaoDich
                INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
                INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = gd.MaSinhVien
                LEFT JOIN dbo.TaiKhoan xa ON xa.MaTaiKhoan = gd.XacNhanBoi
                WHERE (@MaHoaDon IS NULL OR hd.MaHoaDon = @MaHoaDon)
                  AND (@MaSinhVien IS NULL OR (hd.MaSinhVien = @MaSinhVien AND gd.MaSinhVien = @MaSinhVien))
                ORDER BY COALESCE(gd.NgayThanhToan, gd.NgayTao) DESC,
                         gd.MaGiaoDich,
                         chi.ThuTu
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY LỊCH SỬ THANH TOÁN", error, "Không thể lấy lịch sử thanh toán.");
        }
    });

    app.get("/api/payments/qr", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, 403, "Chỉ Sinh viên mới được tạo thông tin QR cho hóa đơn của mình.");
        }
        const invoiceId = req.query.MaHoaDon;
        if (!isValidId(invoiceId, 20)) return respondRequestError(res, 400, "Mã hóa đơn hợp lệ là bắt buộc.");
        const bank = getBankTransferConfig();
        if (!bank) return respondRequestError(res, 503, "Chưa cấu hình tài khoản nhận chuyển khoản QR.");

        try {
            const result = await getPool().request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .query(`
                    SELECT hd.MaHoaDon,
                           SUM(chi.SoTien) AS TongTien,
                           COUNT_BIG(*) AS SoKhoan
                    FROM dbo.HoaDon hd
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaHoaDon = hd.MaHoaDon
                    WHERE hd.MaHoaDon = @MaHoaDon
                      AND hd.MaSinhVien = @MaSinhVien
                      AND chi.TrangThai = N'Chưa thanh toán'
                      AND chi.SoTien > 0
                    GROUP BY hd.MaHoaDon
                `);
            const invoice = result.recordset[0];
            if (!invoice) return respondRequestError(res, 404, "Không tìm thấy khoản chưa thanh toán của hóa đơn này.");

            const total = Number(invoice.TongTien);
            if (!Number.isFinite(total) || total <= 0) {
                return respondRequestError(res, 409, "Tổng tiền hóa đơn không hợp lệ để tạo mã QR.");
            }
            const paymentContent = `KTX ${invoice.MaHoaDon}`;
            return res.json({
                MaHoaDon: invoice.MaHoaDon,
                TongTien: total,
                SoKhoan: Number(invoice.SoKhoan),
                PhuongThuc: "ONLINE",
                NganHang: bank.bankBin,
                SoTaiKhoan: bank.accountNumber,
                TenTaiKhoan: bank.accountName,
                NoiDungCK: paymentContent,
                QrPayload: createVietQrPayload({
                    bankBin: bank.bankBin,
                    accountNumber: bank.accountNumber,
                    amount: total,
                    paymentContent
                })
            });
        } catch (error) {
            return respondDatabaseError(res, "LỖI TẠO QR THANH TOÁN", error, "Không thể tạo mã QR thanh toán.");
        }
    });

    app.post("/api/payments/create", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, 403, "Chỉ Sinh viên mới được gửi yêu cầu thanh toán.");
        }
        const paymentMethod = req.body?.PhuongThuc;
        if (!isObjectBody(req.body) || !isValidId(req.body.MaHoaDon, 20)
            || !["ONLINE", "CASH"].includes(paymentMethod)) {
            return respondRequestError(res, 400, "Mã hóa đơn hợp lệ và phương thức ONLINE hoặc CASH là bắt buộc.");
        }
        if (paymentMethod === "ONLINE" && !getBankTransferConfig()) {
            return respondRequestError(res, 503, "Chưa cấu hình tài khoản nhận chuyển khoản QR.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const invoice = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon)
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .query(`
                    SELECT MaHoaDon
                    FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaHoaDon = @MaHoaDon AND MaSinhVien = @MaSinhVien
                `);
            if (!invoice.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hóa đơn của tài khoản này.");
            }

            const items = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon)
                .query(`
                    SELECT MaChiTiet, SoTien
                    FROM dbo.ChiTietHoaDon WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaHoaDon = @MaHoaDon
                      AND TrangThai = N'Chưa thanh toán'
                      AND SoTien > 0
                    ORDER BY ThuTu, MaChiTiet
                `);
            if (!items.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Hóa đơn không còn khoản nào cần thanh toán.");
            }

            const activePayment = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon)
                .query(`
                    SELECT TOP (1) gd.MaGiaoDich, gd.TongTien, gd.PhuongThuc, gd.TrangThai
                    FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaGiaoDich = gd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE chi.MaHoaDon = @MaHoaDon
                      AND gd.TrangThai IN (N'PENDING', N'SUCCESS')
                    ORDER BY CASE WHEN gd.TrangThai = N'SUCCESS' THEN 0 ELSE 1 END
                `);
            if (activePayment.recordset[0]?.TrangThai === "SUCCESS") {
                await transaction.rollback();
                return respondRequestError(res, 409, "Hóa đơn đã có giao dịch thanh toán thành công.");
            }
            if (activePayment.recordset[0]?.TrangThai === "PENDING") {
                const existing = activePayment.recordset[0];
                if (existing.PhuongThuc === paymentMethod) {
                    await transaction.rollback();
                    return res.status(200).json({
                        success: true,
                        message: paymentMethod === "ONLINE"
                            ? "Đang chờ ngân hàng xác minh giao dịch chuyển khoản."
                            : "Đang chờ Quản lý xác nhận đã thu tiền mặt.",
                        MaGiaoDich: existing.MaGiaoDich,
                        MaHoaDon: req.body.MaHoaDon,
                        TongTien: Number(existing.TongTien),
                        PhuongThuc: existing.PhuongThuc,
                        TrangThai: existing.TrangThai
                    });
                }
                await transaction.rollback();
                return respondRequestError(res, 409, "Hóa đơn đã có yêu cầu thanh toán khác đang chờ xử lý.");
            }

            const total = Math.round(items.recordset.reduce((sum, item) => sum + Number(item.SoTien), 0) * 100) / 100;
            if (!Number.isFinite(total) || total <= 0) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Tổng tiền hóa đơn không hợp lệ để thanh toán.");
            }
            const transactionId = `PAY-${randomUUID().replace(/-/g, "").toUpperCase()}`;
            const paymentContent = paymentMethod === "ONLINE" ? `KTX ${req.body.MaHoaDon}` : null;
            await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), transactionId)
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .input("TongTien", sql.Decimal(18, 2), total)
                .input("PhuongThuc", sql.NVarChar(10), paymentMethod)
                .input("NoiDungCK", sql.NVarChar(100), paymentContent)
                .query(`
                    INSERT INTO dbo.GiaoDichThanhToan
                        (MaGiaoDich, MaSinhVien, TongTien, PhuongThuc, TrangThai, NoiDungCK)
                    VALUES
                        (@MaGiaoDich, @MaSinhVien, @TongTien, @PhuongThuc, N'PENDING', @NoiDungCK)
                `);

            for (const item of items.recordset) {
                await new sql.Request(transaction)
                    .input("MaGiaoDich", sql.NVarChar(60), transactionId)
                    .input("MaChiTiet", sql.NVarChar(40), item.MaChiTiet)
                    .input("SoTien", sql.Decimal(18, 2), item.SoTien)
                    .query(`
                        INSERT INTO dbo.ChiTietGiaoDich (MaGiaoDich, MaChiTiet, SoTien)
                        VALUES (@MaGiaoDich, @MaChiTiet, @SoTien)
                    `);
            }

            await transaction.commit();
            return res.status(201).json({
                success: true,
                message: paymentMethod === "ONLINE"
                    ? "Đã tạo yêu cầu chuyển khoản. Hóa đơn chỉ được thanh toán sau khi ngân hàng xác minh đúng số tiền."
                    : "Đã ghi nhận yêu cầu thanh toán tiền mặt. Hóa đơn sẽ được thanh toán sau khi Quản lý xác nhận thu tiền.",
                MaGiaoDich: transactionId,
                MaHoaDon: req.body.MaHoaDon,
                TongTien: total,
                NoiDungCK: paymentContent,
                PhuongThuc: paymentMethod,
                TrangThai: "PENDING"
            });
        } catch (error) {
            await rollback(transaction, "TẠO YÊU CẦU CHUYỂN KHOẢN");
            return respondDatabaseError(res, "LỖI TẠO YÊU CẦU CHUYỂN KHOẢN", error, "Không thể ghi nhận yêu cầu chuyển khoản.");
        }
    });

    app.post("/api/payments/bank-transfer/notify", async (req, res) => {
        const webhookSecret = stringValue(process.env.PAYMENT_WEBHOOK_SECRET);
        if (webhookSecret.length < 32) {
            return respondRequestError(res, 503, "Chưa cấu hình xác thực thông báo thanh toán ngân hàng.");
        }
        if (!isObjectBody(req.body)
            || !isValidId(req.body.MaHoaDon, 20)
            || typeof req.body.SoTien !== "number"
            || !Number.isSafeInteger(Math.round(req.body.SoTien * 100))
            || Math.abs(req.body.SoTien * 100 - Math.round(req.body.SoTien * 100)) > 1e-7
            || req.body.SoTien <= 0
            || typeof req.body.MaThamChieuNgoai !== "string"
            || !req.body.MaThamChieuNgoai.trim()
            || req.body.MaThamChieuNgoai.length > 100
            || typeof req.body.NoiDungCK !== "string"
            || req.body.NoiDungCK.length > 100) {
            return respondRequestError(res, 400, "Mã hóa đơn, số tiền hợp lệ, mã tham chiếu và nội dung chuyển khoản là bắt buộc.");
        }
        if (!verifyPaymentWebhookSignature(webhookSecret, req.body, req.get("x-payment-signature"))) {
            return respondRequestError(res, 401, "Chữ ký thông báo thanh toán không hợp lệ.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const reference = stringValue(req.body.MaThamChieuNgoai);
            const existingReference = await new sql.Request(transaction)
                .input("MaThamChieuNgoai", sql.NVarChar(100), reference)
                .query(`
                    SELECT TOP (1) gd.MaGiaoDich, gd.TrangThai, gd.PhuongThuc, gd.TongTien,
                           gd.NoiDungCK, hd.MaHoaDon
                    FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaGiaoDich = gd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = chi.MaHoaDon
                    WHERE gd.MaThamChieuNgoai = @MaThamChieuNgoai
                `);
            if (existingReference.recordset.length) {
                const existing = existingReference.recordset[0];
                const sameEvent = existing.PhuongThuc === "ONLINE"
                    && existing.TrangThai === "SUCCESS"
                    && existing.MaHoaDon === req.body.MaHoaDon.trim()
                    && existing.NoiDungCK === req.body.NoiDungCK
                    && Math.round(Number(existing.TongTien) * 100) === Math.round(req.body.SoTien * 100);
                await transaction.rollback();
                if (sameEvent) {
                    return res.json({ success: true, alreadyProcessed: true, message: "Thông báo chuyển khoản đã được xử lý." });
                }
                return respondRequestError(res, 409, "Mã tham chiếu bên ngoài đã được sử dụng.");
            }

            const paymentResult = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon.trim())
                .query(`
                    SELECT gd.MaGiaoDich, gd.MaSinhVien, gd.TongTien, gd.NoiDungCK,
                           chi.MaChiTiet, chi.SoTien AS SoTienHoaDon, chi.TrangThai AS TrangThaiKhoan,
                           cgd.SoTien AS SoTienGiaoDich, chi.MaHoaDon
                    FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaGiaoDich = gd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi WITH (UPDLOCK, HOLDLOCK) ON chi.MaChiTiet = cgd.MaChiTiet
                    INNER JOIN dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK) ON hd.MaHoaDon = chi.MaHoaDon
                    WHERE hd.MaHoaDon = @MaHoaDon
                      AND hd.MaSinhVien = gd.MaSinhVien
                      AND gd.PhuongThuc = N'ONLINE'
                      AND gd.TrangThai = N'PENDING'
                    ORDER BY chi.ThuTu, chi.MaChiTiet
                `);
            const rows = paymentResult.recordset;
            if (!rows.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy yêu cầu chuyển khoản đang chờ cho hóa đơn này.");
            }

            const transactionIds = new Set(rows.map(row => row.MaGiaoDich));
            if (transactionIds.size !== 1) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Hóa đơn có nhiều yêu cầu chuyển khoản chờ xử lý; cần kiểm tra thủ công.");
            }
            const transactionId = rows[0].MaGiaoDich;
            const currentOutstanding = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon.trim())
                .query(`
                    SELECT MaChiTiet, SoTien
                    FROM dbo.ChiTietHoaDon WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaHoaDon = @MaHoaDon
                      AND TrangThai = N'Chưa thanh toán'
                      AND SoTien > 0
                `);
            const expectedCents = Math.round(currentOutstanding.recordset.reduce((sum, item) => sum + Number(item.SoTien), 0) * 100);
            const recordedCents = Math.round(rows.reduce((sum, item) => sum + Number(item.SoTienGiaoDich), 0) * 100);
            const linkedItemIds = new Set(rows.map(row => row.MaChiTiet));
            const outstandingItemIds = new Set(currentOutstanding.recordset.map(item => item.MaChiTiet));
            const transferMatches = req.body.NoiDungCK === rows[0].NoiDungCK
                && req.body.NoiDungCK === `KTX ${req.body.MaHoaDon.trim()}`
                && rows.every(row => row.TrangThaiKhoan === "Chưa thanh toán"
                    && Math.round(Number(row.SoTienHoaDon) * 100) === Math.round(Number(row.SoTienGiaoDich) * 100))
                && linkedItemIds.size === outstandingItemIds.size
                && [...linkedItemIds].every(itemId => outstandingItemIds.has(itemId))
                && Math.round(Number(rows[0].TongTien) * 100) === recordedCents
                && Math.round(req.body.SoTien * 100) === expectedCents
                && Math.round(req.body.SoTien * 100) === Math.round(Number(rows[0].TongTien) * 100);

            if (!transferMatches) {
                await new sql.Request(transaction)
                    .input("MaGiaoDich", sql.NVarChar(60), transactionId)
                    .input("MaThamChieuNgoai", sql.NVarChar(100), reference)
                    .input("LyDoTuChoi", sql.NVarChar(255),
                        `Số tiền chuyển khoản (${req.body.SoTien.toFixed(2)}) hoặc nội dung không khớp số tiền hóa đơn còn nợ (${(expectedCents / 100).toFixed(2)}).`)
                    .query(`
                        UPDATE dbo.GiaoDichThanhToan
                        SET TrangThai = N'REJECTED',
                            MaThamChieuNgoai = @MaThamChieuNgoai,
                            LyDoTuChoi = @LyDoTuChoi
                        WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'PENDING'
                    `);
                await transaction.commit();
                return respondRequestError(res, 409,
                    `Số tiền chuyển khoản (${req.body.SoTien.toFixed(2)}) không khớp số tiền hóa đơn còn nợ (${(expectedCents / 100).toFixed(2)}). Hóa đơn chưa được thanh toán.`);
            }

            const updatedPayment = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), transactionId)
                .input("MaThamChieuNgoai", sql.NVarChar(100), reference)
                .query(`
                    UPDATE dbo.GiaoDichThanhToan
                    SET TrangThai = N'SUCCESS',
                        NgayThanhToan = GETDATE(),
                        XacNhanBoi = NULL,
                        MaThamChieuNgoai = @MaThamChieuNgoai
                    WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'PENDING' AND PhuongThuc = N'ONLINE'
                `);
            if (updatedPayment.rowsAffected[0] !== 1) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Giao dịch đã được xử lý bởi thao tác khác.");
            }
            const updatedItems = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), transactionId)
                .query(`
                    UPDATE chi
                    SET TrangThai = N'Đã thanh toán',
                        NgayThanhToan = GETDATE(),
                        MaGiaoDich = @MaGiaoDich
                    FROM dbo.ChiTietHoaDon chi
                    INNER JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaChiTiet = chi.MaChiTiet
                    WHERE cgd.MaGiaoDich = @MaGiaoDich
                      AND chi.TrangThai = N'Chưa thanh toán'
                `);
            if (updatedItems.rowsAffected[0] !== rows.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Trạng thái hóa đơn vừa thay đổi; giao dịch chưa được xác nhận.");
            }
            await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon.trim())
                .query(`
                    UPDATE dbo.HoaDon
                    SET PhuongThucThanhToan = N'ONLINE',
                        GhiChuThanhToan = N'Đã xác minh tự động từ ngân hàng'
                    WHERE MaHoaDon = @MaHoaDon
                `);
            await transaction.commit();
            return res.json({ success: true, message: "Đã xác minh đúng số tiền chuyển khoản; hóa đơn đã được thanh toán." });
        } catch (error) {
            await rollback(transaction, "XÁC MINH CHUYỂN KHOẢN NGÂN HÀNG");
            return respondDatabaseError(res, "LỖI XÁC MINH CHUYỂN KHOẢN NGÂN HÀNG", error, "Không thể xác minh thông báo chuyển khoản.");
        }
    });

    app.post("/api/payments/confirm/:transactionId", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được xác nhận giao dịch.");
        }
        if (!isValidId(req.params.transactionId, 60)
            || !isObjectBody(req.body)
            || !isOptionalText(req.body.MaThamChieuNgoai, 100)) {
            return respondRequestError(res, 400, "Mã giao dịch hợp lệ; mã chứng từ, nếu có, tối đa 100 ký tự.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const payment = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), req.params.transactionId)
                .query(`
                    SELECT MaGiaoDich, TongTien, PhuongThuc, TrangThai
                    FROM dbo.GiaoDichThanhToan WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaGiaoDich = @MaGiaoDich
                `);
            const paymentRow = payment.recordset[0];
            if (!paymentRow) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy giao dịch.");
            }
            if (paymentRow.PhuongThuc !== "CASH" || paymentRow.TrangThai !== "PENDING") {
                await transaction.rollback();
                return respondRequestError(res, 409, "Chỉ yêu cầu tiền mặt đang chờ mới được Quản lý xác nhận.");
            }

            const details = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), req.params.transactionId)
                .query(`
                    SELECT chi.MaChiTiet, chi.MaHoaDon, chi.SoTien, chi.TrangThai, cgd.SoTien AS SoTienGiaoDich
                    FROM dbo.ChiTietGiaoDich cgd
                    INNER JOIN dbo.ChiTietHoaDon chi WITH (UPDLOCK, HOLDLOCK) ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE cgd.MaGiaoDich = @MaGiaoDich
                `);
            const detailRows = details.recordset;
            const detailTotal = detailRows.reduce((sum, item) => sum + Number(item.SoTienGiaoDich), 0);
            if (!detailRows.length || detailRows.some(item =>
                item.TrangThai !== "Chưa thanh toán"
                || Math.round(Number(item.SoTien) * 100) !== Math.round(Number(item.SoTienGiaoDich) * 100))
                || new Set(detailRows.map(item => item.MaHoaDon)).size !== 1
                || Math.round(detailTotal * 100) !== Math.round(Number(paymentRow.TongTien) * 100)) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Khoản thu đã thay đổi hoặc đã được thanh toán; giao dịch chưa được xác nhận.");
            }

            const updatedPayment = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), req.params.transactionId)
                .input("XacNhanBoi", sql.Int, req.auth.accountId)
                .input("MaThamChieuNgoai", sql.NVarChar(100), stringValue(req.body.MaThamChieuNgoai) || null)
                .query(`
                    UPDATE dbo.GiaoDichThanhToan
                    SET TrangThai = N'SUCCESS',
                        NgayThanhToan = GETDATE(),
                        XacNhanBoi = @XacNhanBoi,
                        MaThamChieuNgoai = @MaThamChieuNgoai
                    WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'PENDING'
                `);
            if (updatedPayment.rowsAffected[0] !== 1) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Giao dịch đã được xử lý bởi thao tác khác.");
            }

            const updatedItems = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), req.params.transactionId)
                .query(`
                    UPDATE chi
                    SET TrangThai = N'Đã thanh toán',
                        NgayThanhToan = GETDATE(),
                        MaGiaoDich = @MaGiaoDich
                    FROM dbo.ChiTietHoaDon chi
                    INNER JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaChiTiet = chi.MaChiTiet
                    WHERE cgd.MaGiaoDich = @MaGiaoDich
                      AND chi.TrangThai = N'Chưa thanh toán'
                `);
            if (updatedItems.rowsAffected[0] !== detailRows.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Trạng thái khoản thu vừa thay đổi. Giao dịch đã được giữ nguyên để kiểm tra lại.");
            }
            await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), detailRows[0].MaHoaDon)
                .input("PhuongThuc", sql.NVarChar(10), paymentRow.PhuongThuc)
                .input("GhiChu", sql.NVarChar(255), stringValue(req.body.MaThamChieuNgoai) || null)
                .query(`
                    UPDATE dbo.HoaDon
                    SET PhuongThucThanhToan = @PhuongThuc,
                        GhiChuThanhToan = COALESCE(@GhiChu, GhiChuThanhToan)
                    WHERE MaHoaDon = @MaHoaDon
                `);

            await transaction.commit();
            return res.json({
                success: true,
                message: paymentRow.PhuongThuc === "ONLINE"
                    ? "Đã xác nhận giao dịch chuyển khoản."
                    : "Đã xác nhận đã thu tiền mặt."
            });
        } catch (error) {
            await rollback(transaction, "XÁC NHẬN CHUYỂN KHOẢN");
            return respondDatabaseError(res, "LỖI XÁC NHẬN THANH TOÁN TIỀN MẶT", error, "Không thể xác nhận giao dịch.");
        }
    });

    app.post("/api/payments/reject/:transactionId", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được từ chối giao dịch.");
        }
        if (!isValidId(req.params.transactionId, 60)
            || !isObjectBody(req.body)
            || !isOptionalText(req.body.LyDoTuChoi, 255)
            || !stringValue(req.body.LyDoTuChoi)) {
            return respondRequestError(res, 400, "Mã giao dịch hợp lệ và lý do từ chối tối đa 255 ký tự là bắt buộc.");
        }
        try {
            const result = await getPool().request()
                .input("MaGiaoDich", sql.NVarChar(60), req.params.transactionId)
                .input("LyDoTuChoi", sql.NVarChar(255), stringValue(req.body.LyDoTuChoi))
                .query(`
                    UPDATE dbo.GiaoDichThanhToan
                    SET TrangThai = N'REJECTED', LyDoTuChoi = @LyDoTuChoi
                    WHERE MaGiaoDich = @MaGiaoDich
                      AND TrangThai = N'PENDING'
                      AND PhuongThuc = N'CASH'
                `);
            if (result.rowsAffected[0] === 0) {
                const existing = await getPool().request()
                    .input("MaGiaoDich", sql.NVarChar(60), req.params.transactionId)
                    .query("SELECT MaGiaoDich FROM dbo.GiaoDichThanhToan WHERE MaGiaoDich = @MaGiaoDich");
                if (!existing.recordset.length) return respondRequestError(res, 404, "Không tìm thấy giao dịch.");
                return respondRequestError(res, 409, "Chỉ yêu cầu tiền mặt đang chờ mới được từ chối thủ công.");
            }
            return res.json({ success: true, message: "Đã từ chối yêu cầu thanh toán." });
        } catch (error) {
            return respondDatabaseError(res, "LỖI TỪ CHỐI CHUYỂN KHOẢN", error, "Không thể từ chối giao dịch.");
        }
    });

    app.post("/api/HoaDon", async (req, res) => {
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const body = req.body;
        const studentId = stringValue(body.MaSinhVien);
        const room = stringValue(body.TenPhong);
        const invoiceDate = body.NgayLap;
        const oldElectricity = body.SoDienCu;
        const newElectricity = body.SoDienMoi;
        const oldWater = body.SoNuocCu;
        const newWater = body.SoNuocMoi;
        if (!isValidId(body.MaSinhVien, 30) || !isValidId(body.TenPhong, 50) || !isDateOnly(invoiceDate)
            || ![oldElectricity, newElectricity, oldWater, newWater].every(value => isJsonInteger(value, 0, 2147483647))
            || newElectricity < oldElectricity || newWater < oldWater) {
            return respondRequestError(res, 400, "Mã sinh viên, phòng và ngày lập hợp lệ là bắt buộc; các chỉ số điện/nước phải là số nguyên từ 0 đến 2147483647 và chỉ số mới không được nhỏ hơn chỉ số cũ.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const studentResult = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("TenPhong", sql.NVarChar(50), room)
                .query(`
                    SELECT sv.MaSinhVien, sv.TenPhong
                    FROM dbo.SinhVien sv WITH (UPDLOCK, HOLDLOCK)
                    WHERE sv.MaSinhVien = @MaSinhVien
                      AND sv.TenPhong = @TenPhong
                      AND sv.TrangThaiSinhVien = N'Đang ở'
                `);
            if (!studentResult.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Sinh viên không tồn tại, chưa ở hoặc không thuộc phòng đã chọn.");
            }
            const todayResult = await new sql.Request(transaction)
                .query("SELECT CAST(GETDATE() AS date) AS NgayHienTai");
            if (invoiceDate > todayResult.recordset[0].NgayHienTai.toISOString().slice(0, 10)) {
                await transaction.rollback();
                return respondRequestError(res, 400, "Ngày lập hóa đơn không được lớn hơn ngày hiện tại.");
            }
            const duplicate = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("NgayLap", sql.Date, invoiceDate)
                .query(`
                    SELECT TOP (1) MaHoaDon
                    FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaSinhVien = @MaSinhVien
                      AND YEAR(NgayLap) = YEAR(@NgayLap) AND MONTH(NgayLap) = MONTH(@NgayLap)
                `);
            if (duplicate.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Sinh viên đã có hóa đơn trong tháng này.");
            }
            const roomResult = await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), room)
                .query("SELECT GiaPhong FROM dbo.Phong WHERE TenPhong = @TenPhong");
            if (!roomResult.recordset[0]) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy phòng.");
            }

            const rates = await new sql.Request(transaction).query(`
                SELECT
                    COALESCE(MAX(CASE WHEN Khoa = N'DON_GIA_DIEN' THEN TRY_CONVERT(decimal(18,2), GiaTri) END), 3500) AS DonDien,
                    COALESCE(MAX(CASE WHEN Khoa = N'DON_GIA_NUOC' THEN TRY_CONVERT(decimal(18,2), GiaTri) END), 15000) AS DonNuoc,
                    COALESCE(MAX(CASE WHEN Khoa = N'SO_NGAY_HAN_THANH_TOAN' THEN TRY_CONVERT(int, GiaTri) END), 15) AS SoNgayHan
                FROM dbo.CauHinhHeThong
            `);
            const transactionRates = rates.recordset[0];
            const electricity = newElectricity - oldElectricity;
            const water = newWater - oldWater;
            const createResult = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("TenPhong", sql.NVarChar(50), room)
                .input("NgayLap", sql.Date, invoiceDate)
                .input("TienPhong", sql.Decimal(18, 2), roomResult.recordset[0].GiaPhong)
                .input("ChiSoDien", sql.Int, electricity)
                .input("ChiSoNuoc", sql.Int, water)
                .input("TienDien", sql.Decimal(18, 2), electricity * Number(transactionRates.DonDien))
                .input("TienNuoc", sql.Decimal(18, 2), water * Number(transactionRates.DonNuoc))
                .input("SoDienCu", sql.Int, oldElectricity)
                .input("SoDienMoi", sql.Int, newElectricity)
                .input("SoNuocCu", sql.Int, oldWater)
                .input("SoNuocMoi", sql.Int, newWater)
                .input("SoNgayHan", sql.Int, Number(transactionRates.SoNgayHan))
                .query(`
                    DECLARE @Ky char(6) = CONVERT(char(6), @NgayLap, 112);
                    DECLARE @SoCuoi int;
                    SELECT @SoCuoi = SoCuoi
                    FROM dbo.MaHoaDonCounter WITH (UPDLOCK, HOLDLOCK)
                    WHERE Ky = @Ky;

                    IF @SoCuoi IS NULL
                    BEGIN
                        SET @SoCuoi = 1;
                        INSERT INTO dbo.MaHoaDonCounter (Ky, SoCuoi) VALUES (@Ky, @SoCuoi);
                    END
                    ELSE
                    BEGIN
                        SET @SoCuoi = @SoCuoi + 1;
                        UPDATE dbo.MaHoaDonCounter SET SoCuoi = @SoCuoi WHERE Ky = @Ky;
                    END;

                    IF @SoCuoi > 9999 THROW 50073, N'Đã vượt số hóa đơn cho kỳ này.', 1;
                    DECLARE @MaHoaDon nvarchar(20) = N'HD' + @Ky + RIGHT(N'0000' + CONVERT(nvarchar(4), @SoCuoi), 4);
                    INSERT INTO dbo.HoaDon
                        (MaHoaDon, MaSinhVien, TenPhong, NgayLap, TienPhong, ChiSoDien, ChiSoNuoc,
                         TienDien, TienNuoc, TrangThaiThanhToan, SoDienCu, SoDienMoi,
                         SoNuocCu, SoNuocMoi, HanThanhToan)
                    VALUES
                        (@MaHoaDon, @MaSinhVien, @TenPhong, @NgayLap, @TienPhong, @ChiSoDien, @ChiSoNuoc,
                         @TienDien, @TienNuoc, N'Chưa thanh toán', @SoDienCu, @SoDienMoi,
                         @SoNuocCu, @SoNuocMoi, DATEADD(day, @SoNgayHan, @NgayLap));
                    SELECT @MaHoaDon AS MaHoaDon;
                `);
            await transaction.commit();
            return res.status(201).json({ success: true, MaHoaDon: createResult.recordset[0].MaHoaDon });
        } catch (error) {
            await rollback(transaction, "TẠO HÓA ĐƠN");
            if (error.number === 50072) return respondRequestError(res, 409, "Sinh viên đã có hóa đơn trong tháng này.");
            return respondDatabaseError(res, "LỖI TẠO HÓA ĐƠN", error, "Không thể tạo hóa đơn.");
        }
    });

    app.put("/api/HoaDon/:id/thanhtoan", async (req, res) => {
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hóa đơn không hợp lệ.");
        return respondRequestError(res, 409,
            "Không thể thanh toán trực tiếp trên hóa đơn. Sinh viên cần gửi yêu cầu; Quản lý xác nhận tiền mặt trong giao dịch đang chờ.");
    });

    app.put("/api/HoaDon/:id", async (req, res) => {
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hóa đơn không hợp lệ.");
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const body = req.body;
        const invoiceDate = body.ngayLap;
        const roomPrice = body.tienPhong;
        const oldElectricity = body.SoDienCu;
        const newElectricity = body.SoDienMoi;
        const oldWater = body.SoNuocCu;
        const newWater = body.SoNuocMoi;
        const status = stringValue(body.trangThai);
        if (!isDateOnly(invoiceDate) || typeof roomPrice !== "number" || !Number.isFinite(roomPrice)
            || roomPrice < 0 || roomPrice > 9999999999999998
            || ![oldElectricity, newElectricity, oldWater, newWater].every(value => isJsonInteger(value, 0, 2147483647))
            || newElectricity < oldElectricity || newWater < oldWater
            || !["Chưa thanh toán", "Đã thanh toán"].includes(status)) {
            return respondRequestError(res, 400, "Ngày lập phải hợp lệ; tiền phòng phải là số không âm trong giới hạn SQL decimal; chỉ số điện/nước phải là số nguyên từ 0 đến 2147483647 với chỉ số mới không nhỏ hơn chỉ số cũ; trạng thái thanh toán không hợp lệ.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const currentInvoice = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT TrangThaiThanhToan
                    FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaHoaDon = @MaHoaDon
                `);
            if (!currentInvoice.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hóa đơn.");
            }
            if (currentInvoice.recordset[0].TrangThaiThanhToan !== "Chưa thanh toán") {
                await transaction.rollback();
                return respondRequestError(res, 409, "Không thể sửa hóa đơn đã thanh toán.");
            }
            if (status !== currentInvoice.recordset[0].TrangThaiThanhToan) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Trạng thái hóa đơn chỉ được cập nhật từ giao dịch thanh toán hợp lệ.");
            }
            const pendingPayment = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT TOP (1) gd.MaGiaoDich
                    FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.ChiTietGiaoDich cgd ON cgd.MaGiaoDich = gd.MaGiaoDich
                    INNER JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cgd.MaChiTiet
                    WHERE chi.MaHoaDon = @MaHoaDon AND gd.TrangThai = N'PENDING'
                `);
            if (pendingPayment.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Không thể sửa hóa đơn khi đang có yêu cầu thanh toán chờ xử lý.");
            }
            const rates = await new sql.Request(transaction).query(`
                SELECT
                    COALESCE(MAX(CASE WHEN Khoa = N'DON_GIA_DIEN' THEN TRY_CONVERT(decimal(18,2), GiaTri) END), 3500) AS DonDien,
                    COALESCE(MAX(CASE WHEN Khoa = N'DON_GIA_NUOC' THEN TRY_CONVERT(decimal(18,2), GiaTri) END), 15000) AS DonNuoc
                FROM dbo.CauHinhHeThong
            `);
            const electricity = newElectricity - oldElectricity;
            const water = newWater - oldWater;
            const result = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .input("NgayLap", sql.Date, invoiceDate)
                .input("TienPhong", sql.Decimal(18, 2), roomPrice)
                .input("ChiSoDien", sql.Int, electricity)
                .input("ChiSoNuoc", sql.Int, water)
                .input("TienDien", sql.Decimal(18, 2), electricity * Number(rates.recordset[0].DonDien))
                .input("TienNuoc", sql.Decimal(18, 2), water * Number(rates.recordset[0].DonNuoc))
                .input("SoDienCu", sql.Int, oldElectricity)
                .input("SoDienMoi", sql.Int, newElectricity)
                .input("SoNuocCu", sql.Int, oldWater)
                .input("SoNuocMoi", sql.Int, newWater)
                .query(`
                    UPDATE dbo.HoaDon
                    SET NgayLap = @NgayLap, TienPhong = @TienPhong,
                        ChiSoDien = @ChiSoDien, ChiSoNuoc = @ChiSoNuoc,
                        TienDien = @TienDien, TienNuoc = @TienNuoc,
                        SoDienCu = @SoDienCu, SoDienMoi = @SoDienMoi,
                        SoNuocCu = @SoNuocCu, SoNuocMoi = @SoNuocMoi
                    WHERE MaHoaDon = @MaHoaDon
                `);
            if (result.rowsAffected[0] === 0) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hóa đơn.");
            }
            await transaction.commit();
            return res.json({ success: true });
        } catch (error) {
            await rollback(transaction, "CẬP NHẬT HÓA ĐƠN");
            return respondDatabaseError(res, "LỖI CẬP NHẬT HÓA ĐƠN", error, "Không thể cập nhật hóa đơn.");
        }
    });

    return {
        initializeDashboardContent: () => ensureDashboardContentDefaults(getPool, sql)
    };
}

module.exports = registerApiRoutes;
