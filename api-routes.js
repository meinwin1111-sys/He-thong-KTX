const { randomUUID } = require("node:crypto");
const { createRegistrationHandler } = require("./student-auth");
const registerMoneyRoutes = require("./money-routes");
const studentIdentity = require("./js/student-identity");
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const CONTRACT_PAYMENT_DUE_DAYS = 7;
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

function vietnamDateOnly(now = new Date()) {
    return new Date(now.getTime() + VIETNAM_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

function addDateOnlyDays(dateOnly, days) {
    const date = new Date(`${dateOnly}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(dateOnly) {
    return `${dateOnly.slice(0, 7)}-01`;
}

function formatVietnamDate(dateOnly) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateOnly || ""));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function initialContractDueDate(contractStart, today) {
    const defaultDue = addDateOnlyDays(today, CONTRACT_PAYMENT_DUE_DAYS);
    return contractStart && contractStart >= today && contractStart < defaultDue
        ? contractStart
        : defaultDue;
}

async function insertContractNotice(sql, transaction, {
    contractId, studentId, senderId, roomName, startDate, endDate, dueDate
}) {
    const eventKey = `CONTRACT:${contractId}:${studentId}`;
    await new sql.Request(transaction)
        .input("TieuDe", sql.NVarChar(200), `Hợp đồng lưu trú ${contractId}`)
        .input("NoiDung", sql.NVarChar(2000),
            `Bạn đã được xếp ở phòng ${roomName} theo hợp đồng từ ${formatVietnamDate(startDate)} đến ${formatVietnamDate(endDate)}. Hạn thanh toán tiền phòng đầu kỳ: ${formatVietnamDate(dueDate)}.`)
        .input("MaSinhVien", sql.NVarChar(30), studentId)
        .input("NguoiTao", sql.Int, senderId)
        .input("MaSuKien", sql.NVarChar(100), eventKey)
        .query(`
            INSERT INTO dbo.ThongBao
                (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien)
            SELECT @TieuDe, @NoiDung, N'SINH_VIEN', @MaSinhVien, @NguoiTao, @MaSuKien
            WHERE NOT EXISTS
            (
                SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                WHERE MaSuKien = @MaSuKien AND MaSinhVien = @MaSinhVien
            )
        `);
}

async function insertContractInvoiceNotice(sql, transaction, {
    contractId, invoiceId, studentId, senderId, amount, dueDate
}) {
    const eventKey = `INVOICE:${invoiceId}`;
    await new sql.Request(transaction)
        .input("TieuDe", sql.NVarChar(200), `Hóa đơn tiền phòng ${invoiceId}`)
        .input("NoiDung", sql.NVarChar(2000),
            `Hóa đơn ${invoiceId} tiền phòng của hợp đồng ${contractId} đã được lập, số tiền ${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(amount))} đ, hạn đóng ${formatVietnamDate(dueDate)}.`)
        .input("MaSinhVien", sql.NVarChar(30), studentId)
        .input("NguoiTao", sql.Int, senderId)
        .input("MaHoaDon", sql.NVarChar(20), invoiceId)
        .input("MaSuKien", sql.NVarChar(100), eventKey)
        .query(`
            INSERT INTO dbo.ThongBao
                (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaHoaDon, MaSuKien)
            SELECT @TieuDe, @NoiDung, N'SINH_VIEN', @MaSinhVien, @NguoiTao, @MaHoaDon, @MaSuKien
            WHERE NOT EXISTS
            (
                SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                WHERE MaSuKien = @MaSuKien AND MaSinhVien = @MaSinhVien
            )
        `);
}

async function notifyContractAndCreateFirstInvoices(sql, transaction, {
    contractId, creatorId, invoiceStudentIds = null, invoicePeriodDate
}) {
    const result = await new sql.Request(transaction)
        .input("MaHopDong", sql.NVarChar(20), contractId)
        .query(`
            SELECT hd.MaHopDong, hd.TenPhong,
                   CONVERT(nvarchar(10), hd.NgayBatDau, 23) AS NgayBatDau,
                   CONVERT(nvarchar(10), hd.NgayKetThuc, 23) AS NgayKetThuc,
                   c.MaChiTiet, c.MaSinhVien, c.KyHanThanhToanPhong,
                   c.GiaPhongApDung, c.GiaPhongThangApDung,
                   CONVERT(nvarchar(10), c.NgayVao, 23) AS NgayVao
            FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
                ON c.MaHopDong = hd.MaHopDong
            WHERE hd.MaHopDong = @MaHopDong
              AND hd.TrangThaiHopDong = N'Còn hiệu lực'
              AND c.TrangThai = N'Đang ở'
            ORDER BY c.MaChiTiet
        `);
    if (!result.recordset.length) {
        throw new Error(`Không tìm thấy thành viên đang ở trong hợp đồng ${contractId}.`);
    }

    let senderId = creatorId;
    if (!senderId) {
        const sender = await new sql.Request(transaction).query(`
            SELECT TOP (1) MaTaiKhoan
            FROM dbo.TaiKhoan
            WHERE VaiTro = N'Quản lý'
            ORDER BY MaTaiKhoan
        `);
        senderId = sender.recordset?.[0]?.MaTaiKhoan;
    }
    if (!senderId) throw new Error("Không tìm thấy tài khoản Quản lý để gửi thông báo hợp đồng.");

    const today = vietnamDateOnly();
    const invoiceStudentSet = invoiceStudentIds ? new Set(invoiceStudentIds) : null;
    const invoices = [];
    const warnings = [];
    for (const member of result.recordset) {
        const dueDate = initialContractDueDate(member.NgayBatDau, today);
        await insertContractNotice(sql, transaction, {
            contractId,
            studentId: member.MaSinhVien,
            senderId,
            roomName: member.TenPhong,
            startDate: member.NgayBatDau,
            endDate: member.NgayKetThuc,
            dueDate
        });

        if (invoiceStudentSet && !invoiceStudentSet.has(member.MaSinhVien)) continue;
        const amount = member.KyHanThanhToanPhong === "NAM"
            ? Number(member.GiaPhongApDung)
            : Number(member.GiaPhongThangApDung);
        if (!Number.isFinite(amount) || amount <= 0) {
            warnings.push(`Không lập hóa đơn tiền phòng cho sinh viên ${member.MaSinhVien}: chưa có đơn giá hợp lệ.`);
            continue;
        }

        const periodDate = invoicePeriodDate || member.NgayBatDau;
        const period = firstDayOfMonth(periodDate);
        const invoiceResult = await new sql.Request(transaction)
            .input("MaChiTiet", sql.Int, member.MaChiTiet)
            .input("KyThanhToan", sql.Date, period)
            .input("NgayTao", sql.Date, today)
            .output("MaHoaDon", sql.NVarChar(20))
            .execute("dbo.sp_TaoHoaDonTienPhong");
        const invoiceId = invoiceResult.output?.MaHoaDon
            || invoiceResult.recordset?.[0]?.MaHoaDon;
        const invoiceAmount = invoiceResult.recordset?.[0]?.TongTien ?? amount;
        if (!invoiceId) {
            throw new Error(`Procedure lập hóa đơn tiền phòng không trả mã hóa đơn cho sinh viên ${member.MaSinhVien}.`);
        }

        const dueDateUpdate = await new sql.Request(transaction)
            .input("MaHoaDon", sql.NVarChar(20), invoiceId)
            .input("HanThanhToan", sql.Date, dueDate)
            .query(`
                UPDATE dbo.HoaDon
                SET HanThanhToan = @HanThanhToan
                WHERE MaHoaDon = @MaHoaDon AND LoaiHoaDon = N'TIEN_PHONG';
                SELECT @@ROWCOUNT AS RowsAffected;
            `);
        if (Number(dueDateUpdate.recordset?.[0]?.RowsAffected) !== 1) {
            throw new Error(`Không thể đặt hạn thanh toán cho hóa đơn ${invoiceId}.`);
        }
        await insertContractInvoiceNotice(sql, transaction, {
            contractId,
            invoiceId,
            studentId: member.MaSinhVien,
            senderId,
            amount: invoiceAmount,
            dueDate
        });
        invoices.push({ MaSinhVien: member.MaSinhVien, MaHoaDon: invoiceId });
    }
    return { invoices, warnings };
}

function isDateOnly(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.getUTCFullYear() >= 1
        && parsed.toISOString().slice(0, 10) === value;
}

function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function maskStudentIdForLog(value) {
    return studentIdentity.maskStudentIdentity(value);
}

function maskStudentIdsInLog(value, studentIds = []) {
    return studentIdentity.maskStudentIdentitiesInText(value, studentIds);
}

function maskNoticeTexts(notices, studentIds) {
    return notices.map(notice => ({
        ...notice,
        TieuDe: maskStudentIdsInLog(notice.TieuDe, studentIds),
        NoiDung: maskStudentIdsInLog(notice.NoiDung, studentIds)
    }));
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
    studentId, name, gender, phone, email, birthday, address, note, room, status, school,
    requireCccd = false
}) {
    if (requireCccd) {
        const identity = studentIdentity.validateStudentIdentity(studentId);
        if (!identity.valid) return identity.message;
    } else if (!isValidId(studentId, 30)) return "Số CCCD/Hộ chiếu là bắt buộc.";
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
    if (school !== undefined && !isOptionalText(school, 150)) return "Trường phải là chuỗi tối đa 150 ký tự.";
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

function logDatabaseError(operation, error) {
    const sqlNumber = getSqlErrorNumber(error);
    console.error(
        `${operation}: ${error.code || error.name || "Unknown database error"}`
        + (sqlNumber ? ` (SQL ${sqlNumber})` : "")
    );
}

function respondDatabaseError(res, operation, error, message) {
    logDatabaseError(operation, error);
    return respondRequestError(res, 500, message);
}

const CONTRACT_PROCEDURE_ERRORS = Object.freeze({
    51420: [400, "Ngày kết thúc hợp đồng phải sau ngày bắt đầu."],
    51421: [400, "Danh sách sinh viên không hợp lệ."],
    51422: [400, "Hợp đồng phải có ít nhất một sinh viên."],
    51423: [400, "Kỳ hạn tiền phòng chỉ nhận THANG hoặc NAM."],
    51424: [400, "Hợp đồng chỉ được có tối đa một người đại diện thanh toán dịch vụ."],
    51425: [404, "Không tìm thấy phòng hoặc hạng phòng."],
    51426: [409, "Phòng đang bảo trì hoặc ngưng sử dụng."],
    51427: [409, "Phòng đã có hợp đồng hiệu lực; hãy thêm thành viên vào hợp đồng đó."],
    51428: [409, "Sinh viên không tồn tại, sai giới tính hoặc đã có chỗ ở hiệu lực."],
    51429: [409, "Số sinh viên vượt sức chứa hạng phòng."],
    51430: [409, "Mã hợp đồng đã tồn tại."],
    51431: [400, "Kỳ hạn tiền phòng chỉ nhận THANG hoặc NAM."],
    51433: [409, "Phòng đang bảo trì hoặc ngưng sử dụng."],
    51434: [409, "Phòng đã đủ sức chứa."],
    51435: [409, "Sinh viên không tồn tại, sai giới tính hoặc đã có hợp đồng hiệu lực."],
    51437: [400, "Ngày rời không được trước ngày vào."],
    51438: [409, "Hợp đồng không còn hiệu lực."],
    51440: [400, "Ngày kết thúc mới phải sau ngày kết thúc hiện tại."],
    51442: [409, "Sinh viên không thuộc hợp đồng hiệu lực."],
    51443: [404, "Không tìm thấy phòng đích hoặc hạng phòng."],
    51444: [409, "Không thể chuyển khác hạng phòng vì cần đối soát giá đã áp dụng."],
    51445: [409, "Phòng đích đang bảo trì hoặc ngưng sử dụng."],
    51446: [409, "Giới tính sinh viên không phù hợp với phòng đích."],
    51447: [409, "Phòng đích đã đủ sức chứa."],
    51448: [409, "Sinh viên đã ở phòng này."],
    51450: [409, "Giới tính sinh viên không phù hợp với phòng."],
    51451: [409, "Số thành viên đang ở vượt sức chứa phòng."],
    51454: [409, "Phòng đã có hợp đồng hiệu lực; hãy thêm thành viên vào hợp đồng hiện có."],
    51456: [409, "Không thể đổi phòng trực tiếp; hãy dùng nghiệp vụ chuyển phòng."],
    51457: [409, "Không thể đổi hạng snapshot của hợp đồng đã tạo."],
    51458: [404, "Không tìm thấy sinh viên."],
    51459: [409, "Giới tính sinh viên không phù hợp với phòng."],
    51460: [409, "Sinh viên đang ở tại phòng hoặc hợp đồng khác."],
    51461: [409, "Phòng đã đủ sức chứa."]
});

const RENEWAL_PROCEDURE_ERRORS = Object.freeze({
    53203: [409, "Yêu cầu gia hạn đã được xử lý hoặc không còn khớp với thành viên."],
    53204: [409, "Hợp đồng không còn hiệu lực hoặc không tồn tại."],
    53205: [409, "Phòng của hợp đồng không còn khả dụng."],
    53206: [409, "Chỉ gia hạn được sinh viên đang ở trong hợp đồng."],
    53207: [400, "Ngày kết thúc mới phải sau ngày kết thúc hiệu lực hiện tại."],
    53208: [409, "Sinh viên đã có gia hạn đang chờ thanh toán."],
    53209: [400, "Không thể tính số ngày hợp đồng hoặc thời gian gia hạn."],
    53210: [400, "Kỳ hạn tiền phòng của sinh viên không hợp lệ."],
    53211: [400, "Không thể lập hóa đơn vì giá tiền phòng không hợp lệ."],
    53212: [409, "Không tìm thấy sức chứa hợp lệ của hạng phòng."],
    53213: [409, "Không thể gia hạn vì sức chứa phòng bị vượt trong khoảng ngày đề xuất."],
    53214: [409, "Khoảng gia hạn bị trùng với hóa đơn tiền phòng đang có."],
    53215: [404, "Không tìm thấy hóa đơn của gia hạn."]
});

function getSqlErrorNumber(error) {
    return Number(error?.number ?? error?.originalError?.info?.number
        ?? error?.precedingErrors?.[0]?.number);
}

async function respondContractProcedureError(res, operation, error, {
    getPool, sql, fallback = "Không thể thực hiện nghiệp vụ hợp đồng.",
    missingObject = null, missingId = null
} = {}) {
    const number = getSqlErrorNumber(error);
    if (number === 51432 || number === 51436 || number === 51439) {
        try {
            const request = getPool().request();
            const query = number === 51436
                ? (request.input("MaChiTiet", sql.Int, Number(missingId)),
                    "SELECT 1 AS TonTai FROM dbo.ChiTietHopDong WHERE MaChiTiet = @MaChiTiet")
                : (request.input("MaHopDong", sql.NVarChar(20), missingId),
                    "SELECT 1 AS TonTai FROM dbo.HopDong WHERE MaHopDong = @MaHopDong");
            const result = await request.query(query);
            return respondRequestError(
                res,
                result.recordset.length ? 409 : 404,
                number === 51436
                    ? (result.recordset.length
                        ? "Chi tiết hợp đồng không còn trạng thái đang ở."
                        : "Không tìm thấy chi tiết hợp đồng.")
                    : (result.recordset.length
                        ? "Hợp đồng không còn hiệu lực."
                        : "Không tìm thấy hợp đồng.")
            );
        } catch (probeError) {
            logDatabaseError(`${operation} kiểm tra đối tượng`, probeError);
            return respondRequestError(res, 500, fallback);
        }

    }

    const mapped = CONTRACT_PROCEDURE_ERRORS[number];
    if (mapped) {
        logDatabaseError(operation, error);
        return respondRequestError(res, mapped[0], mapped[1]);
    }
    if (number === 2601 || number === 2627) {
        logDatabaseError(operation, error);
        return respondRequestError(res, 409, "Dữ liệu bị trùng; vui lòng kiểm tra lại thông tin.");
    }
    if (number === 547) {
        logDatabaseError(operation, error);
        return respondRequestError(res, 409, "Dữ liệu đang được sử dụng hoặc không thỏa mãn ràng buộc.");
    }
    return respondDatabaseError(res, operation, error, fallback);
}

function respondRenewalProcedureError(res, operation, error, fallback) {
    const mapped = RENEWAL_PROCEDURE_ERRORS[getSqlErrorNumber(error)];
    if (mapped) {
        logDatabaseError(operation, error);
        return respondRequestError(res, mapped[0], mapped[1]);
    }
    return respondDatabaseError(res, operation, error, fallback);
}

async function rollback(transaction, operation) {
    try {
        await transaction.rollback();
    } catch (error) {
        if (error.code === "EABORT") return;
        console.error(`${operation} rollback failed:`, error.code || error.name || "Unknown database error");
    }
}

function writeSystemAudit(request, sql, { actorId, action, entity, entityId, detail }) {
    return request
        .input("MaTaiKhoan", sql.Int, actorId ?? null)
        .input("HanhDong", sql.NVarChar(50), action)
        .input("DoiTuong", sql.NVarChar(50), entity)
        .input("MaDoiTuong", sql.NVarChar(60), entityId)
        .input("ChiTiet", sql.NVarChar(500), detail || null)
        .query(`
            INSERT INTO dbo.NhatKyHeThong (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
            VALUES (@MaTaiKhoan, @HanhDong, @DoiTuong, @MaDoiTuong, @ChiTiet)
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

function registerApiRoutes(app, {
    getPool, sql, bcrypt, mapPaymentStatusToDatabase, mapPaymentMethodToDatabase
}) {
    async function expireOverdueRenewals(filters = {}) {
        const request = getPool().request();
        if (filters.MaChiTiet !== undefined) {
            request.input("MaChiTiet", sql.Int, filters.MaChiTiet);
        }
        if (filters.MaHoaDon !== undefined) {
            request.input("MaHoaDon", sql.NVarChar(20), filters.MaHoaDon);
        }
        await request.execute("dbo.sp_HuyGiaHanQuaHan");
    }

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
                DienThoai: String(process.env.OFFICE_PHONE || "").trim() || values.SUPPORT_PHONE,
                Email: values.SUPPORT_EMAIL,
                GioLamViec: String(process.env.OFFICE_HOURS || "").trim() || values.SUPPORT_HOURS
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
                    SELECT TOP (1) p.TenPhong, p.Khu, p.LoaiPhong,
                           hp.SucChuaToiDa, p.SoSinhVienHienTai, p.TrangThaiPhong,
                           hp.GiaPhongThang AS GiaPhong
                    FROM dbo.ChiTietHopDong c
                    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                    INNER JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                    INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
                    WHERE c.MaSinhVien = @MaSinhVien AND c.TrangThai = N'Đang ở'
                      AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                    ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
                `);
            const room = roomResult.recordset[0] || null;
            if (!room) return res.json({ room: null, members: [] });

            const membersResult = await getPool().request()
                .input("TenPhong", sql.NVarChar(50), room.TenPhong)
                .query(`
                    SELECT c.MaSinhVien, sv.HoTen
                    FROM dbo.ChiTietHopDong c
                    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
                    WHERE hd.TenPhong = @TenPhong AND c.TrangThai = N'Đang ở'
                      AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                    ORDER BY sv.HoTen, c.MaSinhVien
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
                    SELECT hd.MaHopDong, c.MaSinhVien, hd.TenPhong,
                           p.Khu, hp.GiaPhongThang AS GiaPhong, hd.NgayBatDau,
                           CONVERT(char(10), c.NgayVao, 23) AS NgayBatDauThanhVien,
                           hd.NgayKetThuc,
                           hd.TrangThaiHopDong, hd.GhiChu, hd.NgayKetThucThucTe
                    FROM dbo.HopDong hd
                    INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
                    INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
                    LEFT JOIN dbo.Phong p ON p.TenPhong = hd.TenPhong
                    WHERE c.MaSinhVien = @MaSinhVien
                    ORDER BY hd.NgayBatDau DESC, hd.MaHopDong DESC
                `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY HỢP ĐỒNG SINH VIÊN", error, "Không thể lấy hợp đồng.");
        }
    });

    app.get("/api/admin/notifications", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được xem danh sách thông báo.");
        }
        try {
            const [result, identityResult] = await Promise.all([
                getPool().request().query(`
                    SELECT MaThongBao, TieuDe, NoiDung, PhamViNhan, TenPhong,
                           MaSinhVien, NguoiTao, NgayTao, DaXoa
                    FROM dbo.ThongBao
                    WHERE DaXoa = 0
                    ORDER BY NgayTao DESC, MaThongBao DESC
                `),
                getPool().request().query("SELECT MaSinhVien FROM dbo.SinhVien")
            ]);
            const knownIds = identityResult.recordset.map(row => row.MaSinhVien);
            return res.json(maskNoticeTexts(result.recordset, knownIds));
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY THÔNG BÁO QUẢN LÝ", error, "Không thể lấy danh sách thông báo.");
        }
    });

    app.post("/api/admin/notifications", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được tạo thông báo.");
        }
        if (!isObjectBody(req.body)
            || typeof req.body.TieuDe !== "string"
            || !req.body.TieuDe.trim()
            || req.body.TieuDe.trim().length > 200
            || typeof req.body.NoiDung !== "string"
            || !req.body.NoiDung.trim()
            || req.body.NoiDung.trim().length > 2000
            || !["TAT_CA", "PHONG", "SINH_VIEN"].includes(req.body.PhamViNhan)) {
            return respondRequestError(res, 400, "Tiêu đề tối đa 200 ký tự, nội dung tối đa 2.000 ký tự và phạm vi nhận hợp lệ là bắt buộc.");
        }
        const { PhamViNhan } = req.body;
        const TenPhong = req.body.TenPhong;
        const MaSinhVien = req.body.MaSinhVien;
        if ((PhamViNhan === "TAT_CA" && (TenPhong != null || MaSinhVien != null))
            || (PhamViNhan === "PHONG" && (!isValidId(TenPhong, 50) || MaSinhVien != null))
            || (PhamViNhan === "SINH_VIEN" && (!isValidId(MaSinhVien, 30) || TenPhong != null))) {
            return respondRequestError(res, 400, "Đối tượng nhận không khớp với phạm vi thông báo.");
        }
        try {
            const result = await getPool().request()
                .input("TieuDe", sql.NVarChar(200), req.body.TieuDe.trim())
                .input("NoiDung", sql.NVarChar(2000), req.body.NoiDung.trim())
                .input("PhamViNhan", sql.NVarChar(10), PhamViNhan)
                .input("TenPhong", sql.NVarChar(50), PhamViNhan === "PHONG" ? TenPhong.trim() : null)
                .input("MaSinhVien", sql.NVarChar(30), PhamViNhan === "SINH_VIEN" ? MaSinhVien.trim() : null)
                .input("NguoiTao", sql.Int, req.auth.accountId)
                .query(`
                    INSERT INTO dbo.ThongBao
                        (TieuDe, NoiDung, PhamViNhan, TenPhong, MaSinhVien, NguoiTao)
                    OUTPUT inserted.MaThongBao, inserted.TieuDe, inserted.NoiDung,
                           inserted.PhamViNhan, inserted.TenPhong, inserted.MaSinhVien,
                           inserted.NguoiTao, inserted.NgayTao, inserted.DaXoa
                    VALUES
                        (@TieuDe, @NoiDung, @PhamViNhan, @TenPhong, @MaSinhVien, @NguoiTao)
                `);
            return res.status(201).json({ success: true, ...result.recordset[0] });
        } catch (error) {
            if ([547].includes(error.number)) {
                return respondRequestError(res, 400, "Phòng hoặc sinh viên nhận thông báo không tồn tại.");
            }
            return respondDatabaseError(res, "LỖI TẠO THÔNG BÁO", error, "Không thể tạo thông báo.");
        }
    });

    app.delete("/api/admin/notifications/:id", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được xóa thông báo.");
        }
        if (!/^[1-9]\d{0,18}$/.test(req.params.id)) {
            return respondRequestError(res, 400, "Mã thông báo không hợp lệ.");
        }
        try {
            const result = await getPool().request()
                .input("MaThongBao", sql.BigInt, req.params.id)
                .query(`
                    UPDATE dbo.ThongBao
                    SET DaXoa = 1
                    OUTPUT inserted.MaThongBao
                    WHERE MaThongBao = @MaThongBao AND DaXoa = 0
                `);
            if (!result.recordset.length) return respondRequestError(res, 404, "Không tìm thấy thông báo đang hoạt động.");
            return res.json({ success: true, message: "Đã ẩn thông báo." });
        } catch (error) {
            return respondDatabaseError(res, "LỖI ẨN THÔNG BÁO", error, "Không thể ẩn thông báo.");
        }
    });

    app.get("/api/student/notifications", async (req, res) => {
        if (req.auth?.role !== "Sinh viên" || !isValidId(req.auth.studentId, 30)) {
            return respondRequestError(res, 403, "Chỉ Sinh viên mới được xem thông báo của mình.");
        }
        try {
            const [result, identityResult] = await Promise.all([
                getPool().request()
                    .input("MaSinhVien", sql.NVarChar(30), req.auth.studentId)
                    .query(`
                    SELECT tb.MaThongBao, tb.TieuDe, tb.NoiDung, tb.PhamViNhan,
                           tb.TenPhong, tb.NgayTao, tb.MaSuKien
                    FROM dbo.ThongBao tb
                    WHERE tb.DaXoa = 0
                      AND (tb.MaSuKien IS NULL
                           OR (tb.MaSuKien NOT LIKE N'BANK_RECEIVED:%'
                               AND tb.MaSuKien NOT LIKE N'SURPLUS_REFUNDED:%'))
                      AND
                      (
                          tb.PhamViNhan = N'TAT_CA'
                          OR (tb.PhamViNhan = N'SINH_VIEN' AND tb.MaSinhVien = @MaSinhVien)
                          OR
                          (
                              tb.PhamViNhan = N'PHONG'
                              AND EXISTS
                              (
                                  SELECT 1
                                  FROM dbo.ChiTietHopDong c
                                  INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                                  WHERE c.MaSinhVien = @MaSinhVien
                                    AND c.TrangThai = N'Đang ở'
                                    AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                                    AND hd.TenPhong = tb.TenPhong
                              )
                          )
                      )
                    ORDER BY tb.NgayTao DESC, tb.MaThongBao DESC
                    `),
                getPool().request().query("SELECT MaSinhVien FROM dbo.SinhVien")
            ]);
            const knownIds = identityResult.recordset.map(row => row.MaSinhVien);
            return res.json(maskNoticeTexts(result.recordset, knownIds));
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY THÔNG BÁO SINH VIÊN", error, "Không thể lấy thông báo.");
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
                    SELECT yc.MaYeuCau, yc.Loai, yc.NoiDung,
                           CONVERT(char(10), yc.NgayKetThucDeXuat, 23) AS NgayKetThucDeXuat,
                           yc.TenPhong, yc.TrangThai, yc.PhanHoi, yc.NgayTao, yc.NgayXuLy,
                           contractDates.NgayBatDauHopDong, contractDates.NgayKetThucHopDong
                    FROM dbo.YeuCauSinhVien yc
                    OUTER APPLY (
                        SELECT TOP (1)
                               CONVERT(char(10), c.NgayVao, 23) AS NgayBatDauHopDong,
                               CONVERT(char(10), h.NgayKetThuc, 23) AS NgayKetThucHopDong
                        FROM dbo.ChiTietHopDong c
                        INNER JOIN dbo.HopDong h ON h.MaHopDong = c.MaHopDong
                        WHERE c.MaSinhVien = yc.MaSinhVien
                          AND (yc.TenPhong IS NULL OR h.TenPhong = yc.TenPhong)
                        ORDER BY CASE WHEN c.TrangThai = N'Đang ở' THEN 0 ELSE 1 END,
                                 c.NgayVao DESC, c.MaChiTiet DESC
                    ) contractDates
                    WHERE yc.MaSinhVien = @MaSinhVien
                    ORDER BY yc.NgayTao DESC, yc.Id DESC
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
        const earlyCheckout = req.body?.Loai === "Trả phòng sớm";
        const requestTypes = ["Gia hạn hợp đồng", "Báo hỏng thiết bị", "Yêu cầu khác", "Trả phòng sớm"];
        const content = typeof req.body?.NoiDung === "string" ? req.body.NoiDung.trim() : "";
        if (!isObjectBody(req.body)
            || !requestTypes.includes(req.body.Loai)
            || !content
            || content.length > 1000
            || (earlyCheckout && content.length < 10)) {
            return respondRequestError(res, 400, "Loại yêu cầu hợp lệ và nội dung từ 1 đến 1000 ký tự là bắt buộc.");
        }
        const extensionEndDate = req.body.NgayKetThucDeXuat;
        if ((req.body.Loai === "Gia hạn hợp đồng" || earlyCheckout) && !isDateOnly(extensionEndDate)) {
            return respondRequestError(res, 400, "Ngày kết thúc đề xuất hợp lệ là bắt buộc.");
        }
        if (!["Gia hạn hợp đồng", "Trả phòng sớm"].includes(req.body.Loai)
            && extensionEndDate != null && extensionEndDate !== "") {
            return respondRequestError(res, 400, "Yêu cầu này không nhận ngày kết thúc đề xuất.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            if (earlyCheckout) {
                const memberResult = await new sql.Request(transaction)
                    .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                    .input("NgayDeXuat", sql.Date, extensionEndDate)
                    .query(`
                        SELECT TOP (1) c.MaChiTiet, CONVERT(char(10), c.NgayVao, 23) AS NgayVao,
                               h.MaHopDong, CONVERT(char(10), h.NgayKetThuc, 23) AS NgayKetThuc,
                               sv.TenPhong,
                               CONVERT(char(10), DATEADD(hour, 7, SYSUTCDATETIME()), 23) AS HomNayVN
                        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
                        INNER JOIN dbo.HopDong h WITH (UPDLOCK, HOLDLOCK) ON h.MaHopDong = c.MaHopDong
                        INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
                        WHERE c.MaSinhVien = @MaSinhVien
                          AND c.TrangThai = N'Đang ở'
                          AND h.TrangThaiHopDong = N'Còn hiệu lực'
                        ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
                    `);
                const member = memberResult.recordset[0];
                if (!member) {
                    await transaction.rollback();
                    return respondRequestError(res, 409, "Chỉ Sinh viên đang có hợp đồng hiệu lực mới được gửi yêu cầu trả phòng sớm.");
                }
                const proposed = extensionEndDate;
                const start = member.NgayVao;
                const end = member.NgayKetThuc;
                const todayVN = member.HomNayVN;
                if (proposed < todayVN || proposed <= start || proposed >= end) {
                    await transaction.rollback();
                    return respondRequestError(res, 400, "Ngày kết thúc đề xuất phải từ hôm nay trở đi, sau ngày bắt đầu hợp đồng và trước ngày kết thúc hiện tại.");
                }
            }
            const studentResult = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(20), req.auth.studentId)
                .query(`
                    SELECT sv.TenPhong, hd.NgayKetThuc
                    FROM dbo.SinhVien sv WITH (UPDLOCK, HOLDLOCK)
                    OUTER APPLY (
                        SELECT TOP (1) NgayKetThuc
                        FROM dbo.ChiTietHopDong c
                        INNER JOIN dbo.HopDong h ON h.MaHopDong = c.MaHopDong
                        WHERE c.MaSinhVien = sv.MaSinhVien
                          AND c.TrangThai = N'Đang ở'
                          AND h.TrangThaiHopDong = N'Còn hiệu lực'
                        ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
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
                .input("NoiDung", sql.NVarChar(1000), content)
                .input("NgayKetThucDeXuat", sql.Date,
                    ["Gia hạn hợp đồng", "Trả phòng sớm"].includes(req.body.Loai) ? extensionEndDate : null)
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
            if (earlyCheckout && [2601, 2627].includes(Number(error?.number))) {
                return respondRequestError(res, 409, "Bạn đã có yêu cầu trả phòng sớm đang chờ duyệt.");
            }
            return respondDatabaseError(res, "LỖI TẠO YÊU CẦU SINH VIÊN", error, "Không thể gửi yêu cầu.");
        }
    });

    app.get("/api/requests", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được xem danh sách yêu cầu Sinh viên.");
        }
        try {
            await expireOverdueRenewals();
            const result = await getPool().request().query(`
                SELECT yc.MaYeuCau, yc.MaSinhVien, sv.HoTen, yc.TenPhong,
                       yc.Loai, yc.NoiDung,
                       CONVERT(char(10), yc.NgayKetThucDeXuat, 23) AS NgayKetThucDeXuat,
                       yc.TrangThai,
                       yc.PhanHoi, yc.NgayTao, yc.NgayXuLy,
                       contractDates.NgayBatDauHopDong, contractDates.NgayKetThucHopDong,
                       tk.TenHienThi AS TenNguoiXuLy
                FROM dbo.YeuCauSinhVien yc
                INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = yc.MaSinhVien
                LEFT JOIN dbo.TaiKhoan tk ON tk.MaTaiKhoan = yc.XuLyBoi
                OUTER APPLY (
                    SELECT TOP (1)
                           CONVERT(char(10), c.NgayVao, 23) AS NgayBatDauHopDong,
                           CONVERT(char(10), h.NgayKetThuc, 23) AS NgayKetThucHopDong
                    FROM dbo.ChiTietHopDong c
                    INNER JOIN dbo.HopDong h ON h.MaHopDong = c.MaHopDong
                    WHERE c.MaSinhVien = yc.MaSinhVien
                      AND (yc.TenPhong IS NULL OR h.TenPhong = yc.TenPhong)
                    ORDER BY CASE WHEN c.TrangThai = N'Đang ở' THEN 0 ELSE 1 END,
                             c.NgayVao DESC, c.MaChiTiet DESC
                ) contractDates
                ORDER BY yc.NgayTao DESC, yc.Id DESC
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DANH SÁCH YÊU CẦU", error, "Không thể lấy danh sách yêu cầu Sinh viên.");
        }
    });

    app.get("/api/requests/:id/early-checkout", async (req, res) => {
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, 403, "Chỉ Quản lý mới được xem thông tin hoàn trả phòng sớm.");
        }
        if (!/^YC\d{5}$/.test(req.params.id)) {
            return respondRequestError(res, 400, "Mã yêu cầu không hợp lệ.");
        }
        try {
            await expireOverdueRenewals();
            const result = await getPool().request()
                .input("MaYeuCau", sql.NVarChar(7), req.params.id)
                .query(`
                    SELECT yc.MaYeuCau, yc.MaSinhVien, sv.HoTen, yc.TenPhong,
                           yc.NgayKetThucDeXuat, yc.TrangThai,
                           h.MaHopDong,
                           CONVERT(char(10), c.NgayVao, 23) AS NgayBatDauHopDong,
                           CONVERT(char(10), effectiveEnd.NgayKetThucHieuLuc, 23) AS NgayKetThucHopDong,
                           calc.SoNgayHopDong,
                           calc.TienPhongHopDong,
                           calc.DonGiaNgay,
                           calc.SoNgayDaO,
                           ISNULL(periods.DaThanhToan, 0) AS DaThanhToan,
                           calc.TienDaO,
                           ISNULL(periods.SoTienHoan, 0) AS SoTienHoan
                    FROM dbo.YeuCauSinhVien yc
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = yc.MaSinhVien
                    OUTER APPLY (
                        SELECT TOP (1) c0.*
                        FROM dbo.ChiTietHopDong c0
                        INNER JOIN dbo.HopDong h0 ON h0.MaHopDong = c0.MaHopDong
                        WHERE c0.MaSinhVien = yc.MaSinhVien
                          AND h0.TenPhong = yc.TenPhong
                          AND c0.NgayVao <= yc.NgayKetThucDeXuat
                        ORDER BY c0.NgayVao DESC, c0.MaChiTiet DESC
                    ) c
                    LEFT JOIN dbo.HopDong h ON h.MaHopDong = c.MaHopDong
                    LEFT JOIN dbo.vw_NgayKetThucHieuLucThanhVien effectiveEnd
                        ON effectiveEnd.MaChiTiet = c.MaChiTiet
                    CROSS APPLY (
                        SELECT DATEDIFF(day, c.NgayVao, h.NgayKetThuc) + 1 AS SoNgayHopDong,
                               CASE WHEN c.KyHanThanhToanPhong = N'NAM'
                                    THEN c.GiaPhongApDung ELSE c.GiaPhongThangApDung END AS TienPhongHopDong,
                               CASE WHEN yc.NgayKetThucDeXuat < c.NgayVao THEN 0
                                    WHEN yc.NgayKetThucDeXuat > h.NgayKetThuc
                                         THEN DATEDIFF(day, c.NgayVao, h.NgayKetThuc) + 1
                                    ELSE DATEDIFF(day, c.NgayVao, yc.NgayKetThucDeXuat) + 1
                               END AS SoNgayDaO
                    ) term
                    OUTER APPLY (
                        SELECT SUM(periods.NetPaid) AS DaThanhToan,
                               SUM(periods.UsedAmount) AS TienDaO,
                               SUM(periods.RefundAmount) AS SoTienHoan
                        FROM (
                            SELECT baseAmounts.NetPaid,
                                   baseUsage.UsedAmount,
                                   CASE WHEN baseAmounts.NetPaid > baseUsage.UsedAmount
                                        THEN baseAmounts.NetPaid - baseUsage.UsedAmount
                                        ELSE 0 END AS RefundAmount
                            FROM (SELECT 1 AS Seed) seed
                            CROSS APPLY (
                                SELECT COALESCE(
                                    (SELECT MIN(renewal.NgayKetThucCu)
                                     FROM dbo.GiaHanHopDong renewal
                                     WHERE renewal.MaChiTiet = c.MaChiTiet
                                       AND renewal.TrangThai = N'Đã hiệu lực'),
                                    h.NgayKetThuc) AS PeriodEnd
                            ) baseDates
                            CROSS APPLY (
                                SELECT DATEDIFF(day, c.NgayVao, baseDates.PeriodEnd) + 1 AS PeriodDays,
                                       CASE WHEN yc.NgayKetThucDeXuat < c.NgayVao THEN 0
                                            WHEN yc.NgayKetThucDeXuat >= baseDates.PeriodEnd
                                                THEN DATEDIFF(day, c.NgayVao, baseDates.PeriodEnd) + 1
                                            ELSE DATEDIFF(day, c.NgayVao, yc.NgayKetThucDeXuat) + 1
                                       END AS LivedDays
                            ) baseSpan
                            CROSS APPLY (
                                SELECT ROUND(term.TienPhongHopDong * baseSpan.LivedDays
                                             / NULLIF(baseSpan.PeriodDays, 0), 0) AS UsedAmount
                            ) baseUsage
                            CROSS APPLY (
                                SELECT SUM(CASE WHEN ISNULL(paid.Paid, 0) > ISNULL(refunded.Refunded, 0)
                                                THEN ISNULL(paid.Paid, 0) - ISNULL(refunded.Refunded, 0)
                                                ELSE 0 END) AS NetPaid
                                FROM dbo.HoaDon baseInvoice
                                OUTER APPLY (
                                    SELECT SUM(pt.SoTien) AS Paid
                                    FROM dbo.PhieuThu pt
                                    WHERE pt.MaHoaDon = baseInvoice.MaHoaDon
                                      AND pt.TrangThai = N'Hợp lệ'
                                ) paid
                                OUTER APPLY (
                                    SELECT SUM(pha.SoTien) AS Refunded
                                    FROM dbo.PhieuChi_HoaDon pha
                                    INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = pha.MaPhieuChi
                                    WHERE pha.MaHoaDon = baseInvoice.MaHoaDon
                                      AND pc.TrangThai IN (N'Hợp lệ', N'Chờ duyệt')
                                ) refunded
                                WHERE baseInvoice.MaChiTiet = c.MaChiTiet
                                  AND baseInvoice.LoaiHoaDon = N'TIEN_PHONG'
                                  AND baseInvoice.TrangThaiThanhToan <> N'Đã hủy'
                                  AND baseInvoice.KyThanhToan <= baseDates.PeriodEnd
                                  AND baseInvoice.KyThanhToanDen >= c.NgayVao
                                  AND NOT EXISTS (
                                      SELECT 1 FROM dbo.GiaHanHopDong renewal
                                      WHERE renewal.MaHoaDon = baseInvoice.MaHoaDon
                                        AND renewal.TrangThai = N'Đã hiệu lực'
                                  )
                            ) baseAmounts
                            WHERE baseAmounts.NetPaid > 0
                            UNION ALL
                            SELECT amounts.NetPaid,
                                   ROUND(amounts.NetPaid * spans.LivedDays
                                       / NULLIF(spans.PeriodDays, 0), 0),
                                   CASE WHEN amounts.NetPaid > ROUND(amounts.NetPaid
                                            * spans.LivedDays
                                            / NULLIF(spans.PeriodDays, 0), 0)
                                        THEN amounts.NetPaid - ROUND(amounts.NetPaid
                                            * spans.LivedDays
                                            / NULLIF(spans.PeriodDays, 0), 0)
                                        ELSE 0 END
                            FROM dbo.GiaHanHopDong renewal
                            INNER JOIN dbo.HoaDon renewalInvoice
                                ON renewalInvoice.MaHoaDon = renewal.MaHoaDon
                            CROSS APPLY (
                                SELECT DATEADD(day, 1, renewal.NgayKetThucCu) AS StartDate,
                                       renewal.NgayKetThucMoi AS EndDate,
                                       DATEDIFF(day, DATEADD(day, 1, renewal.NgayKetThucCu),
                                                renewal.NgayKetThucMoi) + 1 AS PeriodDays
                            ) renewalDates
                            CROSS APPLY (
                                SELECT CASE WHEN yc.NgayKetThucDeXuat < renewalDates.StartDate THEN 0
                                            WHEN yc.NgayKetThucDeXuat >= renewalDates.EndDate
                                                THEN renewalDates.PeriodDays
                                            ELSE DATEDIFF(day, renewalDates.StartDate,
                                                yc.NgayKetThucDeXuat) + 1 END AS LivedDays,
                                       renewalDates.PeriodDays
                            ) spans
                            OUTER APPLY (
                                SELECT SUM(pt.SoTien) AS Paid
                                FROM dbo.PhieuThu pt
                                WHERE pt.MaHoaDon = renewalInvoice.MaHoaDon
                                  AND pt.TrangThai = N'Hợp lệ'
                            ) paid
                            OUTER APPLY (
                                SELECT SUM(pha.SoTien) AS Refunded
                                FROM dbo.PhieuChi_HoaDon pha
                                INNER JOIN dbo.PhieuChi pc ON pc.MaPhieuChi = pha.MaPhieuChi
                                WHERE pha.MaHoaDon = renewalInvoice.MaHoaDon
                                  AND pc.TrangThai IN (N'Hợp lệ', N'Chờ duyệt')
                            ) refunded
                            CROSS APPLY (
                                SELECT CASE WHEN ISNULL(paid.Paid, 0) > ISNULL(refunded.Refunded, 0)
                                            THEN ISNULL(paid.Paid, 0) - ISNULL(refunded.Refunded, 0)
                                            ELSE 0 END AS NetPaid
                            ) amounts
                            WHERE renewal.MaChiTiet = c.MaChiTiet
                              AND renewal.TrangThai = N'Đã hiệu lực'
                              AND renewalInvoice.LoaiHoaDon = N'TIEN_PHONG'
                              AND renewalInvoice.TrangThaiThanhToan <> N'Đã hủy'
                        ) periods
                    ) periods
                    CROSS APPLY (
                        SELECT term.SoNgayHopDong, term.TienPhongHopDong, term.SoNgayDaO,
                               CASE WHEN term.SoNgayHopDong > 0
                                    THEN ROUND(term.TienPhongHopDong / term.SoNgayHopDong, 0)
                                    ELSE 0 END AS DonGiaNgay,
                               ISNULL(periods.TienDaO, 0) AS TienDaO
                    ) calc
                    WHERE yc.MaYeuCau = @MaYeuCau AND yc.Loai = N'Trả phòng sớm'
                `);
            if (!result.recordset.length) return respondRequestError(res, 404, "Không tìm thấy yêu cầu trả phòng sớm.");
            return res.json(result.recordset[0]);
        } catch (error) {
            return respondDatabaseError(res, "LỖI TÍNH HOÀN TRẢ PHÒNG SỚM", error, "Không thể tính tiền hoàn.");
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

        if (status === "Đã duyệt" || status === "Từ chối") {
            try {
                await expireOverdueRenewals();
                const requestType = await getPool().request()
                    .input("MaYeuCau", sql.NVarChar(7), req.params.id)
                    .query(`
                        SELECT Loai, MaSinhVien, NgayKetThucDeXuat
                        FROM dbo.YeuCauSinhVien WHERE MaYeuCau = @MaYeuCau
                    `);
                if (requestType.recordset[0]?.Loai === "Trả phòng sớm") {
                    const result = await getPool().request()
                        .input("MaYeuCau", sql.NVarChar(7), req.params.id)
                        .input("TrangThai", sql.NVarChar(15), status)
                        .input("PhanHoi", sql.NVarChar(500), stringValue(reply) || null)
                        .input("NguoiThucHien", sql.Int, req.auth.accountId)
                        .execute("dbo.sp_DuyetTraPhongSom");
                    if (!result.recordset?.length) throw new Error("Không nhận được kết quả xử lý trả phòng sớm.");
                    return res.json({ success: true, ...result.recordset[0] });
                }
                if (requestType.recordset[0]?.Loai === "Gia hạn hợp đồng") {
                    if (status === "Đã duyệt") {
                        const endDate = requestType.recordset[0].NgayKetThucDeXuat;
                        if (!endDate) {
                            return respondRequestError(res, 400, "Yêu cầu chưa có ngày kết thúc đề xuất hợp lệ.");
                        }
                        const result = await getPool().request()
                            .input("MaHopDong", sql.NVarChar(20), null)
                            .input("MaChiTiet", sql.Int, null)
                            .input("NgayKetThucMoi", sql.Date, endDate)
                            .input("MaYeuCau", sql.NVarChar(7), req.params.id)
                            .input("NguoiThucHien", sql.Int, req.auth.accountId)
                            .output("MaGiaHan", sql.Int)
                            .output("MaHoaDon", sql.NVarChar(20))
                            .execute("dbo.sp_DuyetGiaHan");
                        const renewal = result.recordset?.[0] || {};
                        return res.json({
                            success: true,
                            ...renewal,
                            MaGiaHan: renewal.MaGiaHan ?? result.output?.MaGiaHan,
                            MaHoaDon: renewal.MaHoaDon ?? result.output?.MaHoaDon
                        });
                    }

                    const transaction = new sql.Transaction(getPool());
                    try {
                        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
                        const updated = await new sql.Request(transaction)
                            .input("MaYeuCau", sql.NVarChar(7), req.params.id)
                            .input("PhanHoi", sql.NVarChar(500), stringValue(reply).trim())
                            .input("XuLyBoi", sql.Int, req.auth.accountId)
                            .query(`
                                UPDATE dbo.YeuCauSinhVien WITH (UPDLOCK, HOLDLOCK)
                                SET TrangThai = N'Từ chối', PhanHoi = @PhanHoi,
                                    NgayXuLy = CONVERT(datetime, DATEADD(hour, 7, SYSUTCDATETIME())),
                                    XuLyBoi = @XuLyBoi
                                OUTPUT inserted.MaYeuCau, inserted.MaSinhVien,
                                       inserted.TrangThai, inserted.PhanHoi, inserted.NgayXuLy
                                WHERE MaYeuCau = @MaYeuCau
                                  AND Loai = N'Gia hạn hợp đồng'
                                  AND TrangThai = N'Chờ duyệt'
                            `);
                        if (!updated.recordset.length) {
                            await transaction.rollback();
                            return respondRequestError(res, 409, "Yêu cầu đã được xử lý.");
                        }
                        const rejected = updated.recordset[0];
                        const eventKey = `RENEWAL_REJECT:${rejected.MaYeuCau}:${rejected.MaSinhVien}`;
                        await new sql.Request(transaction)
                            .input("MaSinhVien", sql.NVarChar(30), rejected.MaSinhVien)
                            .input("NguoiTao", sql.Int, req.auth.accountId)
                            .input("MaSuKien", sql.NVarChar(100), eventKey)
                            .input("PhanHoi", sql.NVarChar(500), rejected.PhanHoi)
                            .query(`
                                IF NOT EXISTS (
                                    SELECT 1 FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                                    WHERE MaSuKien = @MaSuKien AND MaSinhVien = @MaSinhVien
                                )
                                    INSERT INTO dbo.ThongBao
                                        (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaSuKien)
                                    VALUES
                                        (N'Yêu cầu gia hạn hợp đồng bị từ chối',
                                         N'Yêu cầu gia hạn hợp đồng bị từ chối. Lý do: ' + @PhanHoi,
                                         N'SINH_VIEN', @MaSinhVien, @NguoiTao, @MaSuKien)
                            `);
                        await transaction.commit();
                        return res.json({ success: true, ...rejected });
                    } catch (error) {
                        await rollback(transaction, "TỪ CHỐI YÊU CẦU GIA HẠN");
                        return respondDatabaseError(res, "LỖI TỪ CHỐI YÊU CẦU GIA HẠN",
                            error, "Không thể cập nhật yêu cầu gia hạn.");
                    }
                }
            } catch (error) {
                if (RENEWAL_PROCEDURE_ERRORS[getSqlErrorNumber(error)]) {
                    return respondRenewalProcedureError(res, "DUYỆT YÊU CẦU GIA HẠN",
                        error, "Không thể duyệt yêu cầu gia hạn.");
                }
                if ([53020, 53021, 53022, 53025, 53312, 53313, 53314].includes(Number(error?.number))) {
                    const statusCode = Number(error.number) === 53020 ? 404
                        : Number(error.number) === 53025 ? 400 : 409;
                    const message = Number(error.number) === 53313
                        ? "Yêu cầu đã được xử lý."
                        : Number(error.number) === 53314
                            ? "Thành viên hoặc hợp đồng không còn đủ điều kiện trả phòng sớm."
                            : error.message?.replace(/^.*?:\s*/, "")
                                || "Không thể xử lý yêu cầu trả phòng sớm.";
                    return respondRequestError(res, statusCode,
                        message);
                }
                return respondDatabaseError(res, "LỖI XỬ LÝ TRẢ PHÒNG SỚM", error, "Không thể cập nhật yêu cầu.");
            }
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

    function validateTierServices(services) {
        if (services === undefined) return null;
        if (!Array.isArray(services)) return "Danh sách dịch vụ phải là một mảng.";
        const seen = new Set();
        for (const item of services) {
            if (!isObjectBody(item) || !isValidId(item.maDichVu, 20)
                || typeof item.donGia !== "number" || !Number.isFinite(item.donGia)
                || item.donGia < 0 || item.donGia > 999999999999
                || !["CHI_SO", "CO_DINH_KY"].includes(item.cachTinh)
                || !["PHONG", "CA_NHAN"].includes(item.doiTuongThanhToan)
                || (item.hoatDong !== undefined && typeof item.hoatDong !== "boolean")) {
                return "Thông tin dịch vụ theo hạng phòng không hợp lệ.";
            }
            const serviceId = item.maDichVu.trim();
            if (seen.has(serviceId)) return "Không được lặp dịch vụ trong cùng một hạng phòng.";
            seen.add(serviceId);
        }
        return null;
    }

    async function replaceTierServices(transaction, tierId, services) {
        await new sql.Request(transaction).input("MaHangPhong", sql.NVarChar(20), tierId)
            .query("DELETE FROM dbo.HangPhong_DichVu WHERE MaHangPhong = @MaHangPhong");
        for (const service of services) {
            await new sql.Request(transaction)
                .input("MaHangPhong", sql.NVarChar(20), tierId)
                .input("MaDichVu", sql.NVarChar(20), service.maDichVu.trim())
                .input("DonGia", sql.Decimal(18, 2), service.donGia)
                .input("CachTinh", sql.NVarChar(20), service.cachTinh)
                .input("DoiTuongThanhToan", sql.NVarChar(10), service.doiTuongThanhToan)
                .input("HoatDong", sql.Bit, service.hoatDong !== false)
                .query(`
                    INSERT INTO dbo.HangPhong_DichVu
                        (MaHangPhong, MaDichVu, DonGia, CachTinh, DoiTuongThanhToan, HoatDong)
                    VALUES
                        (@MaHangPhong, @MaDichVu, @DonGia, @CachTinh, @DoiTuongThanhToan, @HoatDong)
                `);
        }
    }

    app.get("/api/HangPhong", async (_req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT hp.MaHangPhong, hp.TenHangPhong, hp.SucChuaToiDa,
                       hp.GiaPhongThang, hp.GiaPhongNam, d.MaDichVu, d.TenDichVu,
                       d.DonVi, d.HoatDong AS DichVuHoatDong, hpdv.DonGia,
                       hpdv.CachTinh, hpdv.DoiTuongThanhToan,
                       hpdv.HoatDong AS GiaDichVuHoatDong
                FROM dbo.HangPhong hp
                LEFT JOIN dbo.HangPhong_DichVu hpdv ON hpdv.MaHangPhong = hp.MaHangPhong
                LEFT JOIN dbo.DichVu d ON d.MaDichVu = hpdv.MaDichVu
                ORDER BY hp.MaHangPhong, d.TenDichVu
            `);
            const tiers = new Map();
            for (const row of result.recordset) {
                let tier = tiers.get(row.MaHangPhong);
                if (!tier) {
                    tier = {
                        MaHangPhong: row.MaHangPhong,
                        TenHangPhong: row.TenHangPhong,
                        SucChuaToiDa: row.SucChuaToiDa,
                        GiaPhongThang: row.GiaPhongThang,
                        GiaPhongNam: row.GiaPhongNam,
                        dichVu: []
                    };
                    tiers.set(row.MaHangPhong, tier);
                }
                if (row.MaDichVu) {
                    const hasRate = row.DonGia > 0 && row.DichVuHoatDong && row.GiaDichVuHoatDong;
                    tier.dichVu.push({
                        MaDichVu: row.MaDichVu,
                        TenDichVu: row.TenDichVu,
                        DonVi: row.DonVi,
                        DonGia: row.DonGia,
                        CachTinh: row.CachTinh,
                        DoiTuongThanhToan: row.DoiTuongThanhToan,
                        HoatDong: row.GiaDichVuHoatDong,
                        CanhBao: hasRate ? null : "chưa có đơn giá"
                    });
                }
            }
            return res.json([...tiers.values()]);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY HẠNG PHÒNG", error, "Không thể lấy danh sách hạng phòng.");
        }
    });

    app.post("/api/HangPhong", async (req, res) => {
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const { maHangPhong, tenHangPhong, sucChuaToiDa, giaPhongThang, giaPhongNam, dichVu } = req.body;
        const serviceError = validateTierServices(dichVu);
        if (!isValidId(maHangPhong, 20) || !isValidId(tenHangPhong, 100)
            || !isJsonInteger(sucChuaToiDa, 1, 200)
            || typeof giaPhongThang !== "number" || !Number.isFinite(giaPhongThang) || giaPhongThang < 0
            || typeof giaPhongNam !== "number" || !Number.isFinite(giaPhongNam) || giaPhongNam < 0
            || serviceError) {
            return respondRequestError(res, 400, serviceError || "Mã/tên hạng, sức chứa và giá phòng không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const request = new sql.Request(transaction);
            await request
                .input("MaHangPhong", sql.NVarChar(20), maHangPhong.trim())
                .input("TenHangPhong", sql.NVarChar(100), tenHangPhong.trim())
                .input("SucChuaToiDa", sql.Int, sucChuaToiDa)
                .input("GiaPhongThang", sql.Decimal(18, 2), giaPhongThang)
                .input("GiaPhongNam", sql.Decimal(18, 2), giaPhongNam)
                .query(`
                    INSERT INTO dbo.HangPhong
                        (MaHangPhong, TenHangPhong, SucChuaToiDa, GiaPhongThang, GiaPhongNam)
                    VALUES
                        (@MaHangPhong, @TenHangPhong, @SucChuaToiDa, @GiaPhongThang, @GiaPhongNam)
                `);
            if (dichVu !== undefined) await replaceTierServices(transaction, maHangPhong.trim(), dichVu);
            await writeSystemAudit(new sql.Request(transaction), sql, {
                actorId: req.auth?.accountId, action: "Tạo hạng phòng", entity: "HangPhong",
                entityId: maHangPhong.trim(), detail: `Tạo hạng ${tenHangPhong.trim()}.`
            });
            await transaction.commit();
            return res.status(201).json({ success: true, MaHangPhong: maHangPhong.trim() });
        } catch (error) {
            await rollback(transaction, "TẠO HẠNG PHÒNG");
            return respondContractProcedureError(res, "TẠO HẠNG PHÒNG", error, {
                getPool, sql, fallback: "Không thể tạo hạng phòng."
            });
        }
    });

    app.put("/api/HangPhong/:id", async (req, res) => {
        if (!isValidId(req.params.id, 20) || !isObjectBody(req.body)) {
            return respondRequestError(res, 400, "Mã hạng phòng hoặc nội dung yêu cầu không hợp lệ.");
        }
        const { tenHangPhong, sucChuaToiDa, giaPhongThang, giaPhongNam, dichVu } = req.body;
        const serviceError = validateTierServices(dichVu);
        if (!isValidId(tenHangPhong, 100) || !isJsonInteger(sucChuaToiDa, 1, 200)
            || typeof giaPhongThang !== "number" || !Number.isFinite(giaPhongThang) || giaPhongThang < 0
            || typeof giaPhongNam !== "number" || !Number.isFinite(giaPhongNam) || giaPhongNam < 0
            || serviceError) {
            return respondRequestError(res, 400, serviceError || "Tên hạng, sức chứa và giá phòng không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const updated = await new sql.Request(transaction)
                .input("MaHangPhong", sql.NVarChar(20), req.params.id)
                .input("TenHangPhong", sql.NVarChar(100), tenHangPhong.trim())
                .input("SucChuaToiDa", sql.Int, sucChuaToiDa)
                .input("GiaPhongThang", sql.Decimal(18, 2), giaPhongThang)
                .input("GiaPhongNam", sql.Decimal(18, 2), giaPhongNam)
                .query(`
                    UPDATE dbo.HangPhong WITH (UPDLOCK, HOLDLOCK)
                    SET TenHangPhong = @TenHangPhong, SucChuaToiDa = @SucChuaToiDa,
                        GiaPhongThang = @GiaPhongThang, GiaPhongNam = @GiaPhongNam
                    WHERE MaHangPhong = @MaHangPhong
                `);
            if (!updated.rowsAffected[0]) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hạng phòng.");
            }
            if (dichVu !== undefined) await replaceTierServices(transaction, req.params.id, dichVu);
            await writeSystemAudit(new sql.Request(transaction), sql, {
                actorId: req.auth?.accountId, action: "Cập nhật hạng phòng", entity: "HangPhong",
                entityId: req.params.id, detail: `Cập nhật hạng ${tenHangPhong.trim()}.`
            });
            await transaction.commit();
            return res.json({ success: true, MaHangPhong: req.params.id });
        } catch (error) {
            await rollback(transaction, "CẬP NHẬT HẠNG PHÒNG");
            return respondContractProcedureError(res, "CẬP NHẬT HẠNG PHÒNG", error, {
                getPool, sql, fallback: "Không thể cập nhật hạng phòng."
            });
        }
    });

    app.get("/api/DichVu", async (_req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT d.MaDichVu, d.TenDichVu, d.DonVi, d.HoatDong AS DichVuHoatDong,
                       hp.MaHangPhong, hp.TenHangPhong, hpdv.DonGia, hpdv.CachTinh,
                       hpdv.DoiTuongThanhToan, hpdv.HoatDong AS GiaDichVuHoatDong
                FROM dbo.DichVu d
                LEFT JOIN dbo.HangPhong_DichVu hpdv ON hpdv.MaDichVu = d.MaDichVu
                LEFT JOIN dbo.HangPhong hp ON hp.MaHangPhong = hpdv.MaHangPhong
                ORDER BY d.TenDichVu, hp.MaHangPhong
            `);
            const services = new Map();
            for (const row of result.recordset) {
                let service = services.get(row.MaDichVu);
                if (!service) {
                    service = {
                        MaDichVu: row.MaDichVu, TenDichVu: row.TenDichVu, DonVi: row.DonVi,
                        HoatDong: row.DichVuHoatDong, hangPhong: []
                    };
                    services.set(row.MaDichVu, service);
                }
                if (row.MaHangPhong) {
                    const hasRate = row.DonGia > 0 && row.DichVuHoatDong && row.GiaDichVuHoatDong;
                    service.hangPhong.push({
                        MaHangPhong: row.MaHangPhong, TenHangPhong: row.TenHangPhong,
                        DonGia: row.DonGia, CachTinh: row.CachTinh,
                        DoiTuongThanhToan: row.DoiTuongThanhToan,
                        HoatDong: row.GiaDichVuHoatDong,
                        CanhBao: hasRate ? null : "chưa có đơn giá"
                    });
                }
                if (!row.DichVuHoatDong || !row.DonGia || row.DonGia <= 0) {
                    service.CanhBao = "chưa có đơn giá";
                }
            }
            return res.json([...services.values()]);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DỊCH VỤ", error, "Không thể lấy danh sách dịch vụ.");
        }
    });

    app.post("/api/DichVu", async (req, res) => {
        if (!isObjectBody(req.body) || !isValidId(req.body.maDichVu, 20)
            || !isValidId(req.body.tenDichVu, 100) || !isValidId(req.body.donVi, 20)
            || (req.body.hoatDong !== undefined && typeof req.body.hoatDong !== "boolean")) {
            return respondRequestError(res, 400, "Mã, tên, đơn vị và trạng thái dịch vụ không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            await new sql.Request(transaction)
                .input("MaDichVu", sql.NVarChar(20), req.body.maDichVu.trim())
                .input("TenDichVu", sql.NVarChar(100), req.body.tenDichVu.trim())
                .input("DonVi", sql.NVarChar(20), req.body.donVi.trim())
                .input("HoatDong", sql.Bit, req.body.hoatDong !== false)
                .query(`
                    INSERT INTO dbo.DichVu (MaDichVu, TenDichVu, DonVi, HoatDong)
                    VALUES (@MaDichVu, @TenDichVu, @DonVi, @HoatDong)
                `);
            await writeSystemAudit(new sql.Request(transaction), sql, {
                actorId: req.auth?.accountId, action: "Tạo dịch vụ", entity: "DichVu",
                entityId: req.body.maDichVu.trim(), detail: `Tạo dịch vụ ${req.body.tenDichVu.trim()}.`
            });
            await transaction.commit();
            return res.status(201).json({ success: true, MaDichVu: req.body.maDichVu.trim() });
        } catch (error) {
            await rollback(transaction, "TẠO DỊCH VỤ");
            return respondContractProcedureError(res, "TẠO DỊCH VỤ", error, {
                getPool, sql, fallback: "Không thể tạo dịch vụ."
            });
        }
    });

    app.put("/api/DichVu/:id", async (req, res) => {
        if (!isValidId(req.params.id, 20) || !isObjectBody(req.body)
            || !isValidId(req.body.tenDichVu, 100) || !isValidId(req.body.donVi, 20)
            || (req.body.hoatDong !== undefined && typeof req.body.hoatDong !== "boolean")) {
            return respondRequestError(res, 400, "Tên, đơn vị và trạng thái dịch vụ không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const updated = await new sql.Request(transaction)
                .input("MaDichVu", sql.NVarChar(20), req.params.id)
                .input("TenDichVu", sql.NVarChar(100), req.body.tenDichVu.trim())
                .input("DonVi", sql.NVarChar(20), req.body.donVi.trim())
                .input("HoatDong", sql.Bit, req.body.hoatDong !== false)
                .query(`
                    UPDATE dbo.DichVu WITH (UPDLOCK, HOLDLOCK)
                    SET TenDichVu = @TenDichVu, DonVi = @DonVi, HoatDong = @HoatDong
                    WHERE MaDichVu = @MaDichVu
                `);
            if (!updated.rowsAffected[0]) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy dịch vụ.");
            }
            await writeSystemAudit(new sql.Request(transaction), sql, {
                actorId: req.auth?.accountId, action: "Cập nhật dịch vụ", entity: "DichVu",
                entityId: req.params.id, detail: `Cập nhật dịch vụ ${req.body.tenDichVu.trim()}.`
            });
            await transaction.commit();
            return res.json({ success: true, MaDichVu: req.params.id });
        } catch (error) {
            await rollback(transaction, "CẬP NHẬT DỊCH VỤ");
            return respondContractProcedureError(res, "CẬP NHẬT DỊCH VỤ", error, {
                getPool, sql, fallback: "Không thể cập nhật dịch vụ."
            });
        }
    });

    app.get("/api/Phong", async (req, res) => {
        try {
            const result = await getPool().request().query(`
                SELECT p.TenPhong, p.Khu, p.LoaiPhong, p.MaHangPhong,
                       hp.SucChuaToiDa, residents.SoSinhVienHienTai,
                       p.TrangThaiPhong, p.GhiChu, hp.GiaPhongThang AS GiaPhong,
                       hp.GiaPhongNam
                FROM dbo.Phong p
                INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
                OUTER APPLY (
                    SELECT COUNT_BIG(*) AS SoSinhVienHienTai
                    FROM dbo.HopDong hd
                    INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
                    WHERE hd.TenPhong = p.TenPhong
                      AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                      AND c.TrangThai = N'Đang ở'
                ) residents
                ORDER BY p.Khu, p.TenPhong
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
                    SELECT c.MaSinhVien, sv.HoTen, sv.GioiTinh, sv.SoDienThoai,
                           sv.Email, sv.TrangThaiSinhVien
                    FROM dbo.ChiTietHopDong c
                    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
                    WHERE hd.TenPhong = @TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                      AND c.TrangThai = N'Đang ở'
                    ORDER BY sv.HoTen, c.MaSinhVien
                `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY SINH VIÊN THEO PHÒNG", error, "Không thể lấy danh sách sinh viên của phòng.");
        }
    });

    app.post("/api/Phong", async (req, res) => {
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const { TenPhong, Khu, LoaiPhong, SucChuaToiDa, MaHangPhong, GhiChu } = req.body;
        const roomName = stringValue(TenPhong);
        const area = stringValue(Khu);
        const roomType = stringValue(LoaiPhong);
        const capacity = SucChuaToiDa;
        if (!roomName || roomName.length > 50 || !["A", "B", "C"].includes(area)
            || !["Nam", "Nữ"].includes(roomType) || !isRoomCapacity(capacity)
            || !isOptionalText(GhiChu, 255)
            || (MaHangPhong !== undefined && !isValidId(MaHangPhong, 20))) {
            return respondRequestError(res, 400, "Tên phòng (tối đa 50 ký tự), khu A/B/C, loại phòng Nam/Nữ, sức chứa 4/6/8 và ghi chú tối đa 255 ký tự là bắt buộc/được hỗ trợ.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const tier = await new sql.Request(transaction)
                .input("MaHangPhong", sql.NVarChar(20), stringValue(MaHangPhong) || null)
                .input("SucChuaToiDa", sql.Int, capacity)
                .query(`
                    SELECT TOP (1) MaHangPhong, SucChuaToiDa
                    FROM dbo.HangPhong WITH (UPDLOCK, HOLDLOCK)
                    WHERE (@MaHangPhong IS NULL AND SucChuaToiDa = @SucChuaToiDa)
                       OR (@MaHangPhong IS NOT NULL AND MaHangPhong = @MaHangPhong)
                    ORDER BY MaHangPhong
                `);
            if (!tier.recordset.length || tier.recordset[0].SucChuaToiDa !== capacity) {
                await transaction.rollback();
                return respondRequestError(res, 400, "Sức chứa không khớp với hạng phòng đã chọn.");
            }
            await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), roomName)
                .input("Khu", sql.NVarChar(10), area)
                .input("LoaiPhong", sql.NVarChar(10), roomType)
                .input("SucChuaToiDa", sql.Int, capacity)
                .input("MaHangPhong", sql.NVarChar(20), tier.recordset[0].MaHangPhong)
                .input("GhiChu", sql.NVarChar(255), stringValue(GhiChu) || null)
                .query(`
                    INSERT INTO dbo.Phong
                        (TenPhong, Khu, LoaiPhong, SucChuaToiDa, MaHangPhong,
                         SoSinhVienHienTai, TrangThaiPhong, GhiChu)
                    VALUES
                        (@TenPhong, @Khu, @LoaiPhong, @SucChuaToiDa, @MaHangPhong,
                         0, N'Trống', @GhiChu)
                `);
            await writeSystemAudit(new sql.Request(transaction), sql, {
                actorId: req.auth?.accountId, action: "Tạo phòng", entity: "Phong",
                entityId: roomName, detail: `Tạo phòng thuộc hạng ${tier.recordset[0].MaHangPhong}.`
            });
            await transaction.commit();
            return res.status(201).json({ success: true, TenPhong: roomName });
        } catch (error) {
            await rollback(transaction, "TẠO PHÒNG");
            return respondContractProcedureError(res, "TẠO PHÒNG", error, {
                getPool, sql, fallback: "Không thể tạo phòng."
            });
        }
    });

    app.put("/api/Phong/:id", async (req, res) => {
        if (!isValidId(req.params.id, 50)) return respondRequestError(res, 400, "Tên phòng không hợp lệ.");
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const { Khu, LoaiPhong, SucChuaToiDa, MaHangPhong, TrangThaiPhong, GhiChu } = req.body;
        const area = stringValue(Khu);
        const roomType = stringValue(LoaiPhong);
        const capacity = SucChuaToiDa;
        const status = stringValue(TrangThaiPhong);
        if (!["A", "B", "C"].includes(area) || !["Nam", "Nữ"].includes(roomType)
            || !isRoomCapacity(capacity)
            || !["Trống", "Đầy", "Bảo trì", "Ngưng sử dụng"].includes(status)
            || !isOptionalText(GhiChu, 255)
            || (MaHangPhong !== undefined && !isValidId(MaHangPhong, 20))) {
            return respondRequestError(res, 400, "Khu A/B/C, loại phòng Nam/Nữ, sức chứa 4/6/8, trạng thái hợp lệ và ghi chú tối đa 255 ký tự là bắt buộc/được hỗ trợ.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const tier = await new sql.Request(transaction)
                .input("MaHangPhong", sql.NVarChar(20), stringValue(MaHangPhong) || null)
                .input("SucChuaToiDa", sql.Int, capacity)
                .query(`
                    SELECT TOP (1) MaHangPhong, SucChuaToiDa
                    FROM dbo.HangPhong WITH (UPDLOCK, HOLDLOCK)
                    WHERE (@MaHangPhong IS NULL AND SucChuaToiDa = @SucChuaToiDa)
                       OR (@MaHangPhong IS NOT NULL AND MaHangPhong = @MaHangPhong)
                    ORDER BY MaHangPhong
                `);
            if (!tier.recordset.length || tier.recordset[0].SucChuaToiDa !== capacity) {
                await transaction.rollback();
                return respondRequestError(res, 400, "Sức chứa không khớp với hạng phòng đã chọn.");
            }
            const currentRoom = await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), req.params.id)
                .input("LoaiPhong", sql.NVarChar(10), roomType)
                .query(`
                    SELECT p.MaHangPhong,
                           (SELECT COUNT_BIG(*)
                            FROM dbo.HopDong hd
                            INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
                            WHERE hd.TenPhong = p.TenPhong
                              AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                              AND c.TrangThai = N'Đang ở') AS SoSinhVienHienTai,
                           CASE WHEN EXISTS (
                               SELECT 1
                               FROM dbo.HopDong hd
                               INNER JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
                               INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
                               WHERE hd.TenPhong = p.TenPhong
                                 AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                                 AND c.TrangThai = N'Đang ở'
                                 AND sv.GioiTinh <> @LoaiPhong
                           ) THEN 1 ELSE 0 END AS SaiGioiTinh
                    FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
                    WHERE p.TenPhong = @TenPhong
                `);
            if (!currentRoom.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy phòng.");
            }
            if (Number(currentRoom.recordset[0].SoSinhVienHienTai) > capacity
                || currentRoom.recordset[0].SaiGioiTinh
                || (Number(currentRoom.recordset[0].SoSinhVienHienTai) > 0
                    && currentRoom.recordset[0].MaHangPhong !== tier.recordset[0].MaHangPhong)) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Không thể đổi hạng, sức chứa hoặc giới tính phòng khi đang có thành viên không phù hợp.");
            }
            const result = await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), req.params.id)
                .input("Khu", sql.NVarChar(10), area)
                .input("LoaiPhong", sql.NVarChar(10), roomType)
                .input("SucChuaToiDa", sql.Int, capacity)
                .input("MaHangPhong", sql.NVarChar(20), tier.recordset[0].MaHangPhong)
                .input("TrangThaiPhong", sql.NVarChar(20), status)
                .input("GhiChu", sql.NVarChar(255), stringValue(GhiChu) || null)
                .query(`
                    UPDATE dbo.Phong
                    SET Khu = @Khu, LoaiPhong = @LoaiPhong, SucChuaToiDa = @SucChuaToiDa,
                        MaHangPhong = @MaHangPhong,
                        TrangThaiPhong = @TrangThaiPhong, GhiChu = @GhiChu
                    WHERE TenPhong = @TenPhong
                `);
            if (result.rowsAffected[0] === 0) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy phòng.");
            }
            await writeSystemAudit(new sql.Request(transaction), sql, {
                actorId: req.auth?.accountId, action: "Cập nhật phòng", entity: "Phong",
                entityId: req.params.id, detail: `Cập nhật phòng thuộc hạng ${tier.recordset[0].MaHangPhong}.`
            });
            await transaction.commit();
            return res.json({ success: true });
        } catch (error) {
            await rollback(transaction, "CẬP NHẬT PHÒNG");
            return respondContractProcedureError(res, "CẬP NHẬT PHÒNG", error, {
                getPool, sql, fallback: "Không thể cập nhật phòng."
            });
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
                       DiaChi, TrangThaiSinhVien, TenPhong, Truong, GhiChu
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
        if (!isValidId(req.params.mssv, 30)) return respondRequestError(res, 400, "Số CCCD/Hộ chiếu trên URL không hợp lệ.");
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
                    LEFT JOIN dbo.ChiTietHopDong c
                        ON c.MaSinhVien = sv.MaSinhVien AND c.TrangThai = N'Đang ở'
                    LEFT JOIN dbo.HopDong hd
                        ON hd.MaHopDong = c.MaHopDong AND hd.TrangThaiHopDong = N'Còn hiệu lực'
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
        if (!isValidId(req.params.mssv, 30)) return respondRequestError(res, 400, "Số CCCD/Hộ chiếu trên URL không hợp lệ.");
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
        if (req.auth?.role !== "Quản lý") {
            return respondRequestError(res, req.auth ? 403 : 401,
                req.auth ? "Chỉ Quản lý mới được tạo sinh viên." : "Vui lòng đăng nhập.");
        }
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const body = req.body;
        const identity = studentIdentity.validateStudentIdentity(body.MaSinhVien);
        const studentId = identity.value;
        const name = stringValue(body.HoTen);
        const gender = stringValue(body.GioiTinh);
        const phone = body.SoDienThoai;
        const email = stringValue(body.Email).toLowerCase();
        const room = stringValue(body.TenPhong);
        const birthday = body.NgaySinh;
        const address = stringValue(body.DiaChi);
        const note = stringValue(body.GhiChu);
        const school = body.Truong;
        const validationMessage = validateStudentInput({
            studentId,
            name: body.HoTen,
            gender,
            phone,
            email: body.Email,
            birthday,
            address: body.DiaChi,
            note: body.GhiChu,
            room,
            school,
            requireCccd: true
        });
        if (validationMessage) return respondRequestError(res, 400, validationMessage);
        if (body.TrangThaiSinhVien !== undefined && body.TrangThaiSinhVien !== "Đang ở") {
            return respondRequestError(res, 400, "Sinh viên mới phải có trạng thái 'Đang ở'.");
        }

        const requestedStart = body.NgayBatDau ?? null;
        const requestedEnd = body.NgayKetThuc ?? null;
        const term = body.KyHanThanhToanPhong ?? "THANG";
        if ((requestedStart !== null || requestedEnd !== null)
            && (!isDateOnly(requestedStart) || !isDateOnly(requestedEnd) || requestedEnd <= requestedStart)) {
            return respondRequestError(res, 400, "Ngày bắt đầu và kết thúc hợp đồng phải hợp lệ, ngày kết thúc sau ngày bắt đầu.");
        }
        if (!["THANG", "NAM"].includes(term)) {
            return respondRequestError(res, 400, "Kỳ hạn tiền phòng chỉ nhận THANG hoặc NAM.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const duplicate = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .query(`
                    SELECT TOP (1) HoTen
                    FROM dbo.SinhVien WITH (UPDLOCK, HOLDLOCK)
                    WHERE UPPER(LTRIM(RTRIM(MaSinhVien))) = @MaSinhVien
                `);
            if (duplicate.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409,
                    `Số CCCD/hộ chiếu đã được đăng ký cho sinh viên ${duplicate.recordset[0].HoTen || "khác"}.`);
            }
            const roomRow = await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), room)
                .query(`
                    SELECT p.MaHangPhong
                    FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
                    WHERE p.TenPhong = @TenPhong
                `);
            if (!roomRow.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy phòng hoặc hạng phòng.");
            }
            await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("HoTen", sql.NVarChar(100), name)
                .input("NgaySinh", sql.Date, birthday || null)
                .input("GioiTinh", sql.NVarChar(10), gender)
                .input("SoDienThoai", sql.Char(10), phone)
                .input("Email", sql.NVarChar(100), email)
                .input("DiaChi", sql.NVarChar(255), address || null)
                .input("Truong", sql.NVarChar(150), school || null)
                .input("GhiChu", sql.NVarChar(255), note || null)
                .query(`
                    INSERT INTO dbo.SinhVien
                        (MaSinhVien, HoTen, NgaySinh, GioiTinh, SoDienThoai, Email, DiaChi,
                         TrangThaiSinhVien, Truong, GhiChu)
                    VALUES
                        (@MaSinhVien, @HoTen, @NgaySinh, @GioiTinh, @SoDienThoai, @Email, @DiaChi,
                         NULL, @Truong, @GhiChu)
                `);

            const today = vietnamDateOnly();
            const activeContract = await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), room)
                .query(`
                    SELECT TOP (1) hd.MaHopDong,
                           CONVERT(bit, CASE WHEN EXISTS (
                               SELECT 1 FROM dbo.ChiTietHopDong c
                               WHERE c.MaHopDong = hd.MaHopDong AND c.TrangThai = N'Đang ở'
                                 AND c.LaNguoiDaiDienThanhToanDichVu = 1
                           ) THEN 0 ELSE 1 END) AS LaNguoiDaiDien
                    FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
                    WHERE hd.TenPhong = @TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                    ORDER BY hd.MaHopDong
                `);
            let contractId;
            let invoicePeriodDate = today;
            if (activeContract.recordset.length) {
                contractId = activeContract.recordset[0].MaHopDong;
                await new sql.Request(transaction)
                    .input("MaHopDong", sql.NVarChar(20), contractId)
                    .input("MaSinhVien", sql.NVarChar(30), studentId)
                    .input("KyHanThanhToanPhong", sql.NVarChar(10), term)
                    .input("LaNguoiDaiDien", sql.Bit, activeContract.recordset[0].LaNguoiDaiDien)
                    .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                    .execute("dbo.sp_ThemSinhVienVaoHopDong");
            } else {
                let startDate = requestedStart || today;
                let endDate = requestedEnd;
                if (!endDate) {
                    const end = new Date(`${today}T00:00:00.000Z`);
                    end.setUTCFullYear(end.getUTCFullYear() + 1);
                    endDate = end.toISOString().slice(0, 10);
                }
                invoicePeriodDate = startDate;
                const createdContract = await new sql.Request(transaction)
                    .input("TenPhong", sql.NVarChar(50), room)
                    .input("NgayBatDau", sql.Date, startDate)
                    .input("NgayKetThuc", sql.Date, endDate)
                    .input("SinhVienJson", sql.NVarChar(sql.MAX), JSON.stringify([{
                        maSinhVien: studentId,
                        kyHanThanhToanPhong: term,
                        laNguoiDaiDien: true
                    }]))
                    .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                    .execute("dbo.sp_TaoHopDong");
                contractId = createdContract.recordset?.find(row => row.MaHopDong)?.MaHopDong;
                if (!contractId) throw new Error("Procedure tạo hợp đồng không trả mã hợp đồng.");
            }
            const { invoices, warnings } = await notifyContractAndCreateFirstInvoices(sql, transaction, {
                contractId,
                creatorId: req.auth?.accountId,
                invoiceStudentIds: activeContract.recordset.length ? [studentId] : null,
                invoicePeriodDate
            });
            await transaction.commit();
            return res.status(201).json({
                success: true,
                MaSinhVien: studentId,
                MaHopDong: contractId,
                HoaDonTienPhong: invoices,
                CanhBao: warnings
            });
        } catch (error) {
            await rollback(transaction, "TẠO SINH VIÊN VÀ GÁN PHÒNG");
            return respondContractProcedureError(res, "TẠO SINH VIÊN VÀ GÁN PHÒNG", error, {
                getPool, sql, fallback: "Không thể tạo sinh viên hoặc xếp phòng."
            });
        }
    });

    app.put("/api/sinhvien/:mssv", async (req, res) => {
        if (!isValidId(req.params.mssv, 30)) return respondRequestError(res, 400, "Số CCCD/Hộ chiếu trên URL không hợp lệ.");
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
        const school = bodyValue(body, "truong", "Truong");
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
            school,
            room,
            status
        });
        if (validationMessage) return respondRequestError(res, 400, validationMessage);

        const requestedStart = bodyValue(body, "ngayBatDau", "NgayBatDau") ?? null;
        const requestedEnd = bodyValue(body, "ngayKetThuc", "NgayKetThuc") ?? null;
        const term = bodyValue(body, "kyHanThanhToanPhong", "KyHanThanhToanPhong") ?? "THANG";
        if ((requestedStart !== null || requestedEnd !== null)
            && (!isDateOnly(requestedStart) || !isDateOnly(requestedEnd) || requestedEnd <= requestedStart)) {
            return respondRequestError(res, 400, "Ngày bắt đầu và kết thúc hợp đồng phải hợp lệ, ngày kết thúc sau ngày bắt đầu.");
        }
        if (!["THANG", "NAM"].includes(term)) {
            return respondRequestError(res, 400, "Kỳ hạn tiền phòng chỉ nhận THANG hoặc NAM.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const existing = await new sql.Request(transaction)
                .input("MaSinhVienCu", sql.NVarChar(30), req.params.mssv)
                .query(`
                    SELECT sv.MaSinhVien, sv.TenPhong,
                           active.MaChiTiet, active.MaHopDong, active.TenPhong AS PhongHopDong
                    FROM dbo.SinhVien sv WITH (UPDLOCK, HOLDLOCK)
                    OUTER APPLY (
                        SELECT TOP (1) c.MaChiTiet, c.MaHopDong, hd.TenPhong
                        FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
                        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                        WHERE c.MaSinhVien = sv.MaSinhVien AND c.TrangThai = N'Đang ở'
                          AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                        ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
                    ) active
                    WHERE sv.MaSinhVien = @MaSinhVienCu
                `);
            const current = existing.recordset[0];
            if (!current) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy sinh viên.");
            }
            if (studentId !== req.params.mssv) {
                const history = await new sql.Request(transaction)
                    .input("MaSinhVien", sql.NVarChar(30), req.params.mssv)
                    .query("SELECT TOP (1) 1 AS CoHopDong FROM dbo.ChiTietHopDong WHERE MaSinhVien = @MaSinhVien");
                if (history.recordset.length) {
                    await transaction.rollback();
                    return respondRequestError(res, 409, "Không thể đổi mã sinh viên đã có chi tiết hợp đồng.");
                }
            }
            const profile = await new sql.Request(transaction)
                .input("MaSinhVienCu", sql.NVarChar(30), req.params.mssv)
                .input("MaSinhVien", sql.NVarChar(30), studentId)
                .input("HoTen", sql.NVarChar(100), name)
                .input("NgaySinh", sql.Date, birthday || null)
                .input("GioiTinh", sql.NVarChar(10), gender)
                .input("SoDienThoai", sql.Char(10), phone)
                .input("Email", sql.NVarChar(100), email)
                .input("DiaChi", sql.NVarChar(255), address || null)
                .input("Truong", sql.NVarChar(150), school || null)
                .input("GhiChu", sql.NVarChar(255), note || null)
                .query(`
                    UPDATE dbo.SinhVien
                    SET MaSinhVien = @MaSinhVien, HoTen = @HoTen, NgaySinh = @NgaySinh,
                        GioiTinh = @GioiTinh, SoDienThoai = @SoDienThoai, Email = @Email,
                        DiaChi = @DiaChi, Truong = @Truong, GhiChu = @GhiChu
                    WHERE MaSinhVien = @MaSinhVienCu
                `);
            if (!profile.rowsAffected[0]) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy sinh viên.");
            }
            await writeSystemAudit(new sql.Request(transaction), sql, {
                actorId: req.auth?.accountId,
                action: "Cập nhật hồ sơ sinh viên",
                entity: "SinhVien",
                entityId: maskStudentIdForLog(studentId),
                detail: maskStudentIdsInLog(`Cập nhật hồ sơ và trạng thái lưu trú cho ${studentId}.`, [studentId])
            });

            let contractCreation = null;
            if (status === "Đang ở") {
                if (current.MaChiTiet) {
                    if (current.PhongHopDong !== room) {
                        const today = vietnamDateOnly();
                        const moved = await new sql.Request(transaction)
                            .input("MaSinhVien", sql.NVarChar(30), studentId)
                            .input("PhongMoi", sql.NVarChar(50), room)
                            .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                            .execute("dbo.sp_ChuyenPhong");
                        const contractId = moved.recordset?.find(row => row.MaHopDongMoi)?.MaHopDongMoi;
                        if (!contractId) throw new Error("Procedure chuyển phòng không trả mã hợp đồng đích.");
                        const { invoices, warnings } = await notifyContractAndCreateFirstInvoices(sql, transaction, {
                            contractId,
                            creatorId: req.auth?.accountId,
                            invoiceStudentIds: [studentId],
                            invoicePeriodDate: today
                        });
                        contractCreation = {
                            MaHopDong: contractId,
                            HoaDonTienPhong: invoices,
                            CanhBao: warnings
                        };
                    }
                } else {
                    const roomRow = await new sql.Request(transaction)
                        .input("TenPhong", sql.NVarChar(50), room)
                        .query(`
                            SELECT p.MaHangPhong
                            FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
                            INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = p.MaHangPhong
                            WHERE p.TenPhong = @TenPhong
                        `);
                    if (!roomRow.recordset.length) {
                        await transaction.rollback();
                        return respondRequestError(res, 404, "Không tìm thấy phòng hoặc hạng phòng.");
                    }
                    const today = vietnamDateOnly();
                    const activeContract = await new sql.Request(transaction)
                        .input("TenPhong", sql.NVarChar(50), room)
                        .query(`
                            SELECT TOP (1) hd.MaHopDong,
                                   CONVERT(bit, CASE WHEN EXISTS (
                                       SELECT 1 FROM dbo.ChiTietHopDong c
                                       WHERE c.MaHopDong = hd.MaHopDong AND c.TrangThai = N'Đang ở'
                                         AND c.LaNguoiDaiDienThanhToanDichVu = 1
                                   ) THEN 0 ELSE 1 END) AS LaNguoiDaiDien
                            FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
                            WHERE hd.TenPhong = @TenPhong AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                            ORDER BY hd.MaHopDong
                        `);
                    let contractId;
                    let invoicePeriodDate = today;
                    let invoiceStudentIds = [studentId];
                    if (activeContract.recordset.length) {
                        contractId = activeContract.recordset[0].MaHopDong;
                        await new sql.Request(transaction)
                            .input("MaHopDong", sql.NVarChar(20), contractId)
                            .input("MaSinhVien", sql.NVarChar(30), studentId)
                            .input("KyHanThanhToanPhong", sql.NVarChar(10), term)
                            .input("LaNguoiDaiDien", sql.Bit, activeContract.recordset[0].LaNguoiDaiDien)
                            .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                            .execute("dbo.sp_ThemSinhVienVaoHopDong");
                    } else {
                        const startDate = requestedStart || today;
                        let endDate = requestedEnd;
                        if (!endDate) {
                            const end = new Date(`${startDate}T00:00:00.000Z`);
                            end.setUTCFullYear(end.getUTCFullYear() + 1);
                            endDate = end.toISOString().slice(0, 10);
                        }
                        const createdContract = await new sql.Request(transaction)
                            .input("TenPhong", sql.NVarChar(50), room)
                            .input("NgayBatDau", sql.Date, startDate)
                            .input("NgayKetThuc", sql.Date, endDate)
                            .input("SinhVienJson", sql.NVarChar(sql.MAX), JSON.stringify([{
                                maSinhVien: studentId,
                                kyHanThanhToanPhong: term,
                                laNguoiDaiDien: true
                            }]))
                            .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                            .execute("dbo.sp_TaoHopDong");
                        contractId = createdContract.recordset?.find(row => row.MaHopDong)?.MaHopDong;
                        if (!contractId) throw new Error("Procedure tạo hợp đồng không trả mã hợp đồng.");
                        invoiceStudentIds = null;
                        invoicePeriodDate = startDate;
                    }
                    const { invoices, warnings } = await notifyContractAndCreateFirstInvoices(sql, transaction, {
                        contractId,
                        creatorId: req.auth?.accountId,
                        invoiceStudentIds,
                        invoicePeriodDate
                    });
                    contractCreation = { MaHopDong: contractId, HoaDonTienPhong: invoices, CanhBao: warnings };
                }
            } else if (current.MaChiTiet) {
                await new sql.Request(transaction)
                    .input("MaChiTiet", sql.Int, current.MaChiTiet)
                    .input("NgayRa", sql.Date, null)
                    .input("LyDoRoi", sql.NVarChar(100), "Cập nhật trạng thái sinh viên")
                    .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                    .execute("dbo.sp_SinhVienRoiHopDong");
            } else {
                await new sql.Request(transaction)
                    .input("MaSinhVien", sql.NVarChar(30), studentId)
                    .query(`
                        UPDATE dbo.SinhVien
                        SET TrangThaiSinhVien = N'Đã rời KTX',
                            NgayRoiKTX = CAST(GETDATE() AS date)
                        WHERE MaSinhVien = @MaSinhVien
                    `);
            }
            await transaction.commit();
            return res.json({ success: true, MaSinhVien: studentId, ...(contractCreation || {}) });
        } catch (error) {
            await rollback(transaction, "CẬP NHẬT SINH VIÊN VÀ PHÒNG");
            return respondContractProcedureError(res, "CẬP NHẬT SINH VIÊN VÀ PHÒNG", error, {
                getPool, sql, fallback: "Không thể cập nhật sinh viên hoặc phòng."
            });
        }
    });

    const contractQuery = `
        SELECT hd.MaHopDong, hd.TenPhong, hd.MaHangPhong, hd.NgayBatDau, hd.NgayKetThuc,
               hd.TrangThaiHopDong, hd.GhiChu, hd.SoLanGiaHan, hd.NgayKetThucThucTe,
               c.MaChiTiet, c.MaSinhVien, sv.HoTen, c.NgayVao, c.NgayRa,
               c.KyHanThanhToanPhong, c.GiaPhongApDung, c.GiaPhongThangApDung,
               c.LaNguoiDaiDienThanhToanDichVu, c.TrangThai AS TrangThaiThanhVien,
               counts.SoSinhVienHienTai, hp.SucChuaToiDa, hp.TenHangPhong
        FROM dbo.HopDong hd
        INNER JOIN dbo.HangPhong hp ON hp.MaHangPhong = hd.MaHangPhong
        LEFT JOIN dbo.ChiTietHopDong c ON c.MaHopDong = hd.MaHopDong
        LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
        OUTER APPLY (
            SELECT COUNT_BIG(*) AS SoSinhVienHienTai
            FROM dbo.ChiTietHopDong active
            WHERE active.MaHopDong = hd.MaHopDong AND active.TrangThai = N'Đang ở'
        ) counts
    `;

    async function readContracts(req, res, single = false) {
        if (single && !isValidId(req.params.id, 20)) {
            return respondRequestError(res, 400, "Mã hợp đồng không hợp lệ.");
        }
        const room = req.query?.tenPhong ?? req.query?.TenPhong ?? null;
        const status = req.query?.trangThai ?? req.query?.TrangThaiHopDong ?? null;
        if (!isOptionalText(room, 50) || !isOptionalText(status, 20)) {
            return respondRequestError(res, 400, "Bộ lọc phòng hoặc trạng thái không hợp lệ.");
        }
        try {
            await expireOverdueRenewals();
            const request = getPool().request()
                .input("TenPhong", sql.NVarChar(50), stringValue(room) || null)
                .input("TrangThai", sql.NVarChar(20), stringValue(status) || null);
            if (single) request.input("MaHopDong", sql.NVarChar(20), req.params.id);
            const result = await request.query(`
                ${contractQuery}
                WHERE (@TenPhong IS NULL OR hd.TenPhong = @TenPhong)
                  AND (@TrangThai IS NULL OR hd.TrangThaiHopDong = @TrangThai)
                  ${single ? "AND hd.MaHopDong = @MaHopDong" : ""}
                ORDER BY hd.NgayBatDau DESC, hd.MaHopDong DESC, c.NgayVao, c.MaChiTiet
            `);
            if (single && !result.recordset.length) {
                return respondRequestError(res, 404, "Không tìm thấy hợp đồng.");
            }
            const grouped = new Map();
            for (const row of result.recordset) {
                let contract = grouped.get(row.MaHopDong);
                if (!contract) {
                    contract = {
                        MaHopDong: row.MaHopDong,
                        TenPhong: row.TenPhong,
                        MaHangPhong: row.MaHangPhong,
                        TenHangPhong: row.TenHangPhong,
                        SucChuaToiDa: row.SucChuaToiDa,
                        SoSinhVienHienTai: Number(row.SoSinhVienHienTai),
                        NgayBatDau: row.NgayBatDau,
                        NgayKetThuc: row.NgayKetThuc,
                        TrangThaiHopDong: row.TrangThaiHopDong,
                        GhiChu: row.GhiChu,
                        SoLanGiaHan: row.SoLanGiaHan,
                        NgayKetThucThucTe: row.NgayKetThucThucTe,
                        sinhVien: []
                    };
                    grouped.set(row.MaHopDong, contract);
                }
                if (row.MaChiTiet != null) {
                    contract.sinhVien.push({
                        MaChiTiet: row.MaChiTiet,
                        MaSinhVien: row.MaSinhVien,
                        HoTen: row.HoTen,
                        NgayVao: row.NgayVao,
                        NgayRa: row.NgayRa,
                        KyHanThanhToanPhong: row.KyHanThanhToanPhong,
                        GiaPhongApDung: row.GiaPhongApDung,
                        GiaPhongThangApDung: row.GiaPhongThangApDung,
                        LaNguoiDaiDienThanhToanDichVu: row.LaNguoiDaiDienThanhToanDichVu,
                        TrangThai: row.TrangThaiThanhVien
                    });
                }
            }
            const contracts = [...grouped.values()];
            return single ? res.json(contracts[0]) : res.json(contracts);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY HỢP ĐỒNG", error, "Không thể lấy danh sách hợp đồng.");
        }
    }

    app.get("/api/HopDong", (req, res) => readContracts(req, res));
    app.get("/api/HopDong/:id", (req, res) => readContracts(req, res, true));

    app.post("/api/HopDong", async (req, res) => {
        if (!isObjectBody(req.body)) return respondRequestError(res, 400, "Request body phải là một đối tượng JSON.");
        const { tenPhong, maHangPhong, ngayBatDau, ngayKetThuc, sinhVien } = req.body;
        if (!isValidId(tenPhong, 50) || !isValidId(maHangPhong, 20)
            || !isDateOnly(ngayBatDau) || !isDateOnly(ngayKetThuc)
            || !Array.isArray(sinhVien) || sinhVien.length === 0
            || sinhVien.some(member => !isObjectBody(member)
                || !isValidId(member.maSinhVien, 30)
                || !["THANG", "NAM"].includes(member.kyHanThanhToanPhong)
                || (member.laNguoiDaiDien !== undefined && typeof member.laNguoiDaiDien !== "boolean"))
            || sinhVien.filter(member => member.laNguoiDaiDien === true).length > 1) {
            return respondRequestError(res, 400, "Thông tin hợp đồng hoặc danh sách sinh viên không hợp lệ.");
        }
        if (ngayKetThuc <= ngayBatDau) {
            return respondRequestError(res, 400, "Ngày kết thúc phải sau ngày bắt đầu.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const room = await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), tenPhong.trim())
                .query(`
                    SELECT p.MaHangPhong, p.TrangThaiPhong
                    FROM dbo.Phong p WITH (UPDLOCK, HOLDLOCK)
                    WHERE p.TenPhong = @TenPhong
                `);
            if (!room.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy phòng.");
            }
            if (room.recordset[0].MaHangPhong !== maHangPhong.trim()) {
                await transaction.rollback();
                return respondRequestError(res, 400, "Mã hạng phòng không khớp với hạng hiện tại của phòng đã chọn.");
            }
            const result = await new sql.Request(transaction)
                .input("TenPhong", sql.NVarChar(50), tenPhong.trim())
                .input("NgayBatDau", sql.Date, ngayBatDau)
                .input("NgayKetThuc", sql.Date, ngayKetThuc)
                .input("SinhVienJson", sql.NVarChar(sql.MAX), JSON.stringify(sinhVien))
                .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                .execute("dbo.sp_TaoHopDong");
            const contractId = result.recordset?.find(row => row.MaHopDong)?.MaHopDong;
            if (!contractId) throw new Error("Procedure tạo hợp đồng không trả mã hợp đồng.");
            const { invoices, warnings } = await notifyContractAndCreateFirstInvoices(sql, transaction, {
                contractId,
                creatorId: req.auth?.accountId,
                invoicePeriodDate: ngayBatDau
            });
            await transaction.commit();
            return res.status(201).json({
                success: true,
                MaHopDong: contractId,
                HoaDonTienPhong: invoices,
                CanhBao: warnings
            });
        } catch (error) {
            await rollback(transaction, "TẠO HỢP ĐỒNG");
            return respondContractProcedureError(res, "TẠO HỢP ĐỒNG", error, {
                getPool, sql, fallback: "Không thể tạo hợp đồng."
            });
        }
    });

    const extendContractHandler = async (req, res) => {
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hợp đồng không hợp lệ.");
        const endDate = req.body?.ngayKetThucMoi ?? req.body?.NgayKetThucMoi
            ?? req.body?.ngayKetThuc ?? req.body?.NgayKetThuc;
        if (!isDateOnly(endDate)) return respondRequestError(res, 400, "Ngày kết thúc phải là ngày hợp lệ theo YYYY-MM-DD.");
        const rawDetailId = req.body?.maChiTiet ?? req.body?.MaChiTiet;
        const studentId = req.body?.maSinhVien ?? req.body?.MaSinhVien ?? req.body?.MSSV;
        if ((rawDetailId === undefined && !isValidId(studentId, 30))
            || (rawDetailId !== undefined
                && !isJsonInteger(Number(rawDetailId), 1, 2147483647))
            || (rawDetailId !== undefined && studentId !== undefined)) {
            return respondRequestError(res, 400, "Cần cung cấp đúng một MaChiTiet hoặc MSSV đang ở trong hợp đồng.");
        }
        try {
            const contract = await getPool().request()
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .query("SELECT 1 AS TonTai FROM dbo.HopDong WHERE MaHopDong = @MaHopDong");
            if (!contract.recordset.length) {
                return respondRequestError(res, 404, "Không tìm thấy hợp đồng.");
            }
            let detailId = rawDetailId === undefined ? null : Number(rawDetailId);
            if (detailId === null) {
                const member = await getPool().request()
                    .input("MaHopDong", sql.NVarChar(20), req.params.id)
                    .input("MaSinhVien", sql.NVarChar(30), studentId.trim())
                    .query(`
                        SELECT TOP (1) MaChiTiet
                        FROM dbo.ChiTietHopDong
                        WHERE MaHopDong = @MaHopDong AND MaSinhVien = @MaSinhVien
                          AND TrangThai = N'Đang ở'
                        ORDER BY MaChiTiet DESC
                    `);
                detailId = member.recordset[0]?.MaChiTiet ?? null;
                if (detailId === null) {
                    return respondRequestError(res, 404, "Không tìm thấy sinh viên đang ở trong hợp đồng.");
                }
            }
            await expireOverdueRenewals({ MaChiTiet: detailId });
            const result = await getPool().request()
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("MaChiTiet", sql.Int, detailId)
                .input("NgayKetThucMoi", sql.Date, endDate)
                .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                .output("MaGiaHan", sql.Int)
                .output("MaHoaDon", sql.NVarChar(20))
                .execute("dbo.sp_DuyetGiaHan");
            const renewal = result.recordset?.[0] || {};
            return res.status(201).json({
                success: true,
                ...renewal,
                MaGiaHan: renewal.MaGiaHan ?? result.output?.MaGiaHan,
                MaHoaDon: renewal.MaHoaDon ?? result.output?.MaHoaDon
            });
        } catch (error) {
            return respondRenewalProcedureError(res, "GIA HẠN HỢP ĐỒNG",
                error, "Không thể gia hạn hợp đồng.");
        }
    };
    app.put("/api/HopDong/extend/:id", extendContractHandler);
    app.put("/api/HopDong/:id/gia-han", extendContractHandler);

    const endContractHandler = async (req, res) => {
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hợp đồng không hợp lệ.");
        const endDate = req.body?.ngayKetThucThucTe ?? req.body?.NgayKetThucThucTe ?? null;
        if (endDate !== null && !isDateOnly(endDate)) {
            return respondRequestError(res, 400, "Ngày kết thúc thực tế phải theo định dạng YYYY-MM-DD.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("NgayKetThucThucTe", sql.Date, endDate)
                .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                .execute("dbo.sp_KetThucHopDong");
            await transaction.commit();
            return res.json({ success: true, MaHopDong: req.params.id, TrangThaiHopDong: "Đã kết thúc" });
        } catch (error) {
            await rollback(transaction, "KẾT THÚC HỢP ĐỒNG");
            return respondContractProcedureError(res, "KẾT THÚC HỢP ĐỒNG", error, {
                getPool, sql, missingId: req.params.id, fallback: "Không thể kết thúc hợp đồng."
            });
        }
    };
    app.put("/api/HopDong/end/:id", endContractHandler);
    app.put("/api/HopDong/:id/ket-thuc", endContractHandler);

    const moveStudentHandler = async (req, res) => {
        if (!isValidId(req.params.id, 20) || !isObjectBody(req.body)
            || !isValidId(req.body.maSinhVien, 30) || !isValidId(req.body.tenPhong, 50)) {
            return respondRequestError(res, 400, "Mã hợp đồng, sinh viên và phòng đích là bắt buộc.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const member = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("MaSinhVien", sql.NVarChar(30), req.body.maSinhVien.trim())
                .query(`
                    SELECT c.MaChiTiet
                    FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK) ON hd.MaHopDong = c.MaHopDong
                    WHERE c.MaHopDong = @MaHopDong AND c.MaSinhVien = @MaSinhVien
                      AND c.TrangThai = N'Đang ở' AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                `);
            if (!member.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Sinh viên không thuộc hợp đồng hiệu lực đã chọn.");
            }
            const result = await new sql.Request(transaction)
                .input("MaSinhVien", sql.NVarChar(30), req.body.maSinhVien.trim())
                .input("PhongMoi", sql.NVarChar(50), req.body.tenPhong.trim())
                .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                .execute("dbo.sp_ChuyenPhong");
            const contractId = result.recordset?.find(row => row.MaHopDongMoi)?.MaHopDongMoi;
            if (!contractId) throw new Error("Procedure chuyển phòng không trả mã hợp đồng đích.");
            const { invoices, warnings } = await notifyContractAndCreateFirstInvoices(sql, transaction, {
                contractId,
                creatorId: req.auth?.accountId,
                invoiceStudentIds: [req.body.maSinhVien.trim()],
                invoicePeriodDate: vietnamDateOnly()
            });
            await transaction.commit();
            return res.json({
                success: true,
                MaChiTietCu: member.recordset[0].MaChiTiet,
                MaHopDongMoi: contractId,
                HoaDonTienPhong: invoices,
                CanhBao: warnings
            });
        } catch (error) {
            await rollback(transaction, "CHUYỂN PHÒNG SINH VIÊN");
            return respondContractProcedureError(res, "CHUYỂN PHÒNG SINH VIÊN", error, {
                getPool, sql, fallback: "Không thể chuyển phòng cho sinh viên."
            });
        }
    };
    app.put("/api/HopDong/:id/chuyen-phong", moveStudentHandler);

    app.put("/api/HopDong/:id/dai-dien", async (req, res) => {
        const detailId = req.body?.maChiTiet;
        if (!isValidId(req.params.id, 20) || !isJsonInteger(detailId, 1, 2147483647)) {
            return respondRequestError(res, 400, "Mã hợp đồng và mã chi tiết thành viên hợp lệ là bắt buộc.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const target = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("MaChiTiet", sql.Int, detailId)
                .query(`
                    SELECT c.MaChiTiet, c.MaSinhVien, hd.TrangThaiHopDong
                    FROM dbo.ChiTietHopDong c WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK) ON hd.MaHopDong = c.MaHopDong
                    WHERE c.MaHopDong = @MaHopDong AND c.MaChiTiet = @MaChiTiet
                      AND c.TrangThai = N'Đang ở'
                `);
            if (!target.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy thành viên đang ở trong hợp đồng.");
            }
            if (target.recordset[0].TrangThaiHopDong !== "Còn hiệu lực") {
                await transaction.rollback();
                return respondRequestError(res, 409, "Không thể đổi đại diện của hợp đồng đã kết thúc.");
            }
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("MaChiTiet", sql.Int, detailId)
                .query(`
                    UPDATE dbo.ChiTietHopDong
                    SET LaNguoiDaiDienThanhToanDichVu = 0
                    WHERE MaHopDong = @MaHopDong AND TrangThai = N'Đang ở'
                      AND LaNguoiDaiDienThanhToanDichVu = 1 AND MaChiTiet <> @MaChiTiet;
                    UPDATE dbo.ChiTietHopDong
                    SET LaNguoiDaiDienThanhToanDichVu = 1
                    WHERE MaHopDong = @MaHopDong AND MaChiTiet = @MaChiTiet
                      AND TrangThai = N'Đang ở';
                `);
            await new sql.Request(transaction)
                .input("HanhDong", sql.NVarChar(50), "Đổi đại diện")
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("ChiTiet", sql.NVarChar(500), maskStudentIdsInLog(
                    `Đặt sinh viên ${target.recordset[0].MaSinhVien} làm đại diện thanh toán dịch vụ.`,
                    [target.recordset[0].MaSinhVien]
                ))
                .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                .execute("dbo.sp_GhiNhatKyHopDong");
            await transaction.commit();
            return res.json({ success: true, MaChiTiet: detailId });
        } catch (error) {
            await rollback(transaction, "ĐỔI ĐẠI DIỆN THANH TOÁN");
            return respondContractProcedureError(res, "ĐỔI ĐẠI DIỆN THANH TOÁN", error, {
                getPool, sql, fallback: "Không thể đổi người đại diện."
            });
        }
    });

    async function readContractDetails(req, res) {
        const contractId = req.query?.maHopDong ?? null;
        const studentId = req.query?.maSinhVien ?? null;
        const status = req.query?.trangThai ?? null;
        if (!isOptionalText(contractId, 20) || !isOptionalText(studentId, 30)
            || !isOptionalText(status, 20)) {
            return respondRequestError(res, 400, "Bộ lọc chi tiết hợp đồng không hợp lệ.");
        }
        try {
            const result = await getPool().request()
                .input("MaHopDong", sql.NVarChar(20), stringValue(contractId) || null)
                .input("MaSinhVien", sql.NVarChar(30), stringValue(studentId) || null)
                .input("TrangThai", sql.NVarChar(20), stringValue(status) || null)
                .query(`
                    SELECT c.MaChiTiet, c.MaHopDong, c.MaSinhVien, sv.HoTen, hd.TenPhong,
                           hd.MaHangPhong, c.NgayVao, c.NgayRa, c.KyHanThanhToanPhong,
                           c.GiaPhongApDung, c.GiaPhongThangApDung,
                           c.LaNguoiDaiDienThanhToanDichVu, c.TrangThai, c.GhiChu,
                           c.LyDoRoi, hd.NgayBatDau, hd.NgayKetThuc, hd.TrangThaiHopDong
                    FROM dbo.ChiTietHopDong c
                    INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                    INNER JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
                    WHERE (@MaHopDong IS NULL OR c.MaHopDong = @MaHopDong)
                      AND (@MaSinhVien IS NULL OR c.MaSinhVien = @MaSinhVien)
                      AND (@TrangThai IS NULL OR c.TrangThai = @TrangThai)
                    ORDER BY c.NgayVao DESC, c.MaChiTiet DESC
                `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY CHI TIẾT HỢP ĐỒNG", error, "Không thể lấy chi tiết hợp đồng.");
        }
    }
    app.get("/api/chitiethopdong", readContractDetails);
    app.get("/api/history", readContractDetails);

    app.post("/api/HopDong/:id/chitiet", async (req, res) => {
        if (!isValidId(req.params.id, 20) || !isObjectBody(req.body)
            || !isValidId(req.body.maSinhVien, 30)
            || !["THANG", "NAM"].includes(req.body.kyHanThanhToanPhong)
            || (req.body.laNguoiDaiDien !== undefined && typeof req.body.laNguoiDaiDien !== "boolean")) {
            return respondRequestError(res, 400, "Thông tin sinh viên, kỳ hạn hoặc đại diện không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("MaSinhVien", sql.NVarChar(30), req.body.maSinhVien.trim())
                .input("KyHanThanhToanPhong", sql.NVarChar(10), req.body.kyHanThanhToanPhong)
                .input("LaNguoiDaiDien", sql.Bit, req.body.laNguoiDaiDien === true)
                .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                .execute("dbo.sp_ThemSinhVienVaoHopDong");
            const today = vietnamDateOnly();
            const member = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("MaSinhVien", sql.NVarChar(30), req.body.maSinhVien.trim())
                .query(`
                    SELECT TOP (1) MaChiTiet
                    FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaHopDong = @MaHopDong AND MaSinhVien = @MaSinhVien
                      AND TrangThai = N'Đang ở'
                    ORDER BY MaChiTiet DESC
                `);
            if (!member.recordset.length) {
                throw new Error(`Không tìm thấy sinh viên ${req.body.maSinhVien} trong hợp đồng ${req.params.id} sau khi thêm.`);
            }
            const { invoices, warnings } = await notifyContractAndCreateFirstInvoices(sql, transaction, {
                contractId: req.params.id,
                creatorId: req.auth?.accountId,
                invoiceStudentIds: [req.body.maSinhVien.trim()],
                invoicePeriodDate: today
            });
            await transaction.commit();
            return res.status(201).json({
                success: true,
                MaHopDong: req.params.id,
                MaSinhVien: req.body.maSinhVien.trim(),
                HoaDonTienPhong: invoices,
                CanhBao: warnings
            });
        } catch (error) {
            await rollback(transaction, "THÊM SINH VIÊN VÀO HỢP ĐỒNG");
            return respondContractProcedureError(res, "THÊM SINH VIÊN VÀO HỢP ĐỒNG", error, {
                getPool, sql, missingId: req.params.id, fallback: "Không thể thêm sinh viên vào hợp đồng."
            });
        }
    });

    app.put("/api/HopDong/:id/chitiet/:maChiTiet/roi", async (req, res) => {
        const detailId = Number(req.params.maChiTiet);
        const leaveDate = req.body?.ngayRa ?? null;
        if (!isValidId(req.params.id, 20) || !Number.isSafeInteger(detailId) || detailId < 1
            || (leaveDate !== null && !isDateOnly(leaveDate))
            || !isOptionalText(req.body?.lyDoRoi, 100)) {
            return respondRequestError(res, 400, "Mã chi tiết, ngày rời hoặc lý do rời không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const member = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("MaChiTiet", sql.Int, detailId)
                .query(`
                    SELECT MaChiTiet FROM dbo.ChiTietHopDong WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaHopDong = @MaHopDong AND MaChiTiet = @MaChiTiet
                      AND TrangThai = N'Đang ở'
                `);
            if (!member.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy thành viên đang ở trong hợp đồng.");
            }
            await new sql.Request(transaction)
                .input("MaChiTiet", sql.Int, detailId)
                .input("NgayRa", sql.Date, leaveDate)
                .input("LyDoRoi", sql.NVarChar(100), stringValue(req.body?.lyDoRoi) || null)
                .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                .execute("dbo.sp_SinhVienRoiHopDong");
            await transaction.commit();
            return res.json({ success: true, MaChiTiet: detailId });
        } catch (error) {
            await rollback(transaction, "SINH VIÊN RỜI HỢP ĐỒNG");
            return respondContractProcedureError(res, "SINH VIÊN RỜI HỢP ĐỒNG", error, {
                getPool, sql, missingId: detailId, fallback: "Không thể cập nhật thành viên rời hợp đồng."
            });
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
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const currentResult = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT MaHopDong, TenPhong, NgayBatDau, NgayKetThuc, TrangThaiHopDong
                    FROM dbo.HopDong WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaHopDong = @MaHopDong
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
            await new sql.Request(transaction)
                .input("HanhDong", sql.NVarChar(50), "Ghi chú")
                .input("MaHopDong", sql.NVarChar(20), req.params.id)
                .input("ChiTiet", sql.NVarChar(500), note)
                .input("NguoiThucHien", sql.Int, req.auth?.accountId ?? null)
                .execute("dbo.sp_GhiNhatKyHopDong");
            await transaction.commit();
            return res.status(200).send("Lưu ghi chú thành công.");
        } catch (error) {
            await rollback(transaction, "LƯU GHI CHÚ HỢP ĐỒNG");
            return respondContractProcedureError(res, "LƯU GHI CHÚ HỢP ĐỒNG", error, {
                getPool, sql, fallback: "Không thể lưu ghi chú hợp đồng."
            });
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
                    SELECT Thang, ThuTienPhong, ChiTienPhong, DoanhThuTienPhong,
                           ThuDichVu, ChiDichVu, DoanhThuDichVu,
                           ThuPhatSinh, ChiPhatSinh, DoanhThuPhatSinh,
                           DoanhThuDienNuocKhac, TongThu, TongChi, TongDoanhThu
                    FROM dbo.vw_DoanhThuThang
                    WHERE Nam = @Nam
                    ORDER BY Thang
                `);
            const phong = Array(12).fill(0);
            const dienNuoc = Array(12).fill(0);
            const rowsByMonth = new Map();
            for (const row of result.recordset) {
                phong[row.Thang - 1] = Number(row.DoanhThuTienPhong || 0);
                dienNuoc[row.Thang - 1] = Number(row.DoanhThuDienNuocKhac || 0);
                rowsByMonth.set(row.Thang, row);
            }
            const thang = Array.from({ length: 12 }, (_, index) => {
                const month = index + 1;
                const row = rowsByMonth.get(month) || {};
                return {
                    Nam: year,
                    Thang: month,
                    ThuTienPhong: Number(row.ThuTienPhong || 0),
                    ChiTienPhong: Number(row.ChiTienPhong || 0),
                    DoanhThuTienPhong: Number(row.DoanhThuTienPhong || 0),
                    ThuDichVu: Number(row.ThuDichVu || 0),
                    ChiDichVu: Number(row.ChiDichVu || 0),
                    DoanhThuDichVu: Number(row.DoanhThuDichVu || 0),
                    ThuPhatSinh: Number(row.ThuPhatSinh || 0),
                    ChiPhatSinh: Number(row.ChiPhatSinh || 0),
                    DoanhThuPhatSinh: Number(row.DoanhThuPhatSinh || 0),
                    DoanhThuDienNuocKhac: Number(row.DoanhThuDienNuocKhac || 0),
                    TongThu: Number(row.TongThu || 0),
                    TongChi: Number(row.TongChi || 0),
                    TongDoanhThu: Number(row.TongDoanhThu || 0),
                    DoanhThuRong: Number(row.TongDoanhThu || 0)
                };
            });
            return res.json({ thang, phong, dienNuoc });
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY DOANH THU", error, "Không thể lấy báo cáo doanh thu.");
        }
    });

    registerMoneyRoutes(app, {
        getPool, sql, mapPaymentStatusToDatabase, mapPaymentMethodToDatabase,
        isDateOnly, isObjectBody, isOptionalText, isValidId, isJsonInteger,
        stringValue, respondRequestError, respondDatabaseError, logDatabaseError, rollback
    });
    return {
        initializeDashboardContent: () => ensureDashboardContentDefaults(getPool, sql)
    };
}

module.exports = Object.assign(registerApiRoutes, { validateStudentInput });
