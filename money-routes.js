const { randomUUID } = require("node:crypto");
const { createVietQrPayload } = require("./payment-qr");
const { verifyPaymentWebhookSignature } = require("./payment-webhook");

const INVOICE_OWNER = `
    (
        (hd.LoaiHoaDon = N'TIEN_PHONG' AND EXISTS (
            SELECT 1
            FROM dbo.ChiTietHopDong ownerDetail
            WHERE ownerDetail.MaChiTiet = hd.MaChiTiet
              AND ownerDetail.MaSinhVien = @MaSinhVien
        ))
        OR (hd.LoaiHoaDon IN (N'DICH_VU_PHONG', N'PHAT_SINH') AND EXISTS (
            SELECT 1
            FROM dbo.ChiTietHopDong ownerDetail
            INNER JOIN dbo.HopDong ownerContract ON ownerContract.MaHopDong = ownerDetail.MaHopDong
            WHERE ownerContract.MaHopDong = hd.MaHopDong
              AND ownerContract.TrangThaiHopDong = N'Còn hiệu lực'
              AND ownerDetail.MaSinhVien = @MaSinhVien
              AND ownerDetail.TrangThai = N'Đang ở'
        ))
        OR (hd.LoaiHoaDon = N'CU' AND hd.MaSinhVien = @MaSinhVien)
    )
`;

const MONEY_PROCEDURE_ERRORS = Object.freeze({
    51802: [409, "Tổng phiếu thu hợp lệ vượt tổng hóa đơn hoặc hóa đơn đã hủy."],
    51803: [409, "Không thể hủy hóa đơn còn phiếu thu hợp lệ."],
    51804: [409, "Không thể giảm hoặc xóa chi tiết làm tổng hóa đơn thấp hơn số đã thu."],
    51805: [409, "Phiếu chi chỉ được phân bổ vào hóa đơn tiền phòng của đúng thành viên."],
    51806: [409, "Tổng phân bổ hóa đơn phải bằng tổng phiếu chi hợp lệ."],
    51807: [409, "Tổng phiếu chi hợp lệ vượt tổng phiếu thu hợp lệ của hóa đơn."],
    51808: [409, "Phiếu chi hợp lệ phải có phân bổ bằng đúng tổng số tiền."],
    51809: [409, "Phiếu chi hợp lệ chỉ được dùng cho hóa đơn tiền phòng cùng thành viên."],
    51810: [409, "Trạng thái hóa đơn chỉ được cập nhật từ phiếu thu hợp lệ."],
    51811: [409, "Tổng phiếu chi hợp lệ vượt tổng phiếu thu hợp lệ của hóa đơn."],
    51906: [409, "Không thể thay đổi hạng mục hóa đơn cũ đã thanh toán."],
    51910: [409, "Đã hết dải mã hóa đơn trong tháng."],
    51911: [404, "Không tìm thấy hóa đơn."],
    51912: [400, "Số tiền phiếu thu phải là số nguyên VND dương."],
    51913: [400, "Phương thức thu không hợp lệ."],
    51914: [400, "Trạng thái phiếu thu không hợp lệ."],
    51915: [409, "Không thể thu tiền cho hóa đơn đã hủy."],
    51916: [409, "Phiếu thu làm tổng thu vượt tổng hóa đơn."],
    51920: [404, "Không tìm thấy thành viên hợp đồng đang ở."],
    51921: [400, "Kỳ thanh toán tiền phòng phải là ngày đầu tháng."],
    51922: [409, "Kỳ tiền phòng bị trùng hoặc chồng với hóa đơn đang hoạt động."],
    51923: [409, "Mã hóa đơn đã tồn tại."],
    51924: [409, "Khoản phát sinh không còn ở trạng thái chưa lập hóa đơn."],
    51925: [409, "Mã hóa đơn đã tồn tại."],
    51926: [404, "Không tìm thấy hợp đồng hoặc phòng hiệu lực."],
    51927: [400, "Kỳ dịch vụ phải là ngày đầu tháng."],
    51928: [400, "Dữ liệu chỉ số dịch vụ không hợp lệ."],
    51929: [409, "Kỳ dịch vụ bị trùng hoặc chồng với hóa đơn đang hoạt động."],
    51930: [400, "Thiếu hoặc sai chỉ số cũ/mới cho dịch vụ tính theo chỉ số."],
    51931: [400, "Số lượng dịch vụ phải lớn hơn 0."],
    51932: [404, "Không tìm thấy thành viên hợp đồng để tính hoàn tiền."],
    51933: [400, "Ngày ra không được trước ngày vào."],
    51934: [400, "Khấu trừ không được âm."],
    51935: [404, "Không tìm thấy thành viên hợp đồng."],
    51936: [400, "Ngày ra không được trước ngày vào."],
    51937: [409, "Không có số dư hoàn tiền dương."],
    51938: [409, "Số tiền hoàn không được vượt số tiền gợi ý."],
    51939: [400, "Lý do hoàn tiền không hợp lệ."],
    51940: [400, "Khi sửa số tiền hoàn phải ghi lý do."],
    51941: [409, "Tổng hoàn vượt số tiền thu hợp lệ còn lại."],
    52103: [404, "Không tìm thấy phiếu thu."],
    52104: [409, "Chỉ xử lý được phiếu thu đang chờ xác nhận."],
    52105: [409, "Phiếu thu đã được xử lý bởi thao tác khác."]
});

function getSqlErrorNumber(error) {
    return Number(error?.number ?? error?.originalError?.info?.number
        ?? error?.precedingErrors?.[0]?.number);
}

function respondMoneyProcedureError(res, operation, error, fallback, {
    logDatabaseError, respondDatabaseError, respondRequestError
}) {
    const number = getSqlErrorNumber(error);
    const mapped = MONEY_PROCEDURE_ERRORS[number];
    if (mapped) {
        logDatabaseError(operation, error);
        return respondRequestError(res, mapped[0], mapped[1]);
    }
    if (number === 2601 || number === 2627) {
        logDatabaseError(operation, error);
        return respondRequestError(res, 409, "Dữ liệu thanh toán bị trùng; vui lòng kiểm tra lại.");
    }
    if (number === 547) {
        logDatabaseError(operation, error);
        return respondRequestError(res, 409, "Dữ liệu đang được sử dụng hoặc không thỏa mãn ràng buộc.");
    }
    return respondDatabaseError(res, operation, error, fallback);
}

function isPositiveVnd(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeVnd(value) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function getBankTransferConfig(stringValue) {
    const bankBin = stringValue(process.env.PAYMENT_BANK_BIN);
    const accountNumber = stringValue(process.env.PAYMENT_BANK_ACCOUNT_NO);
    const accountName = stringValue(process.env.PAYMENT_BANK_ACCOUNT_NAME);
    if (!/^\d{6}$/.test(bankBin) || !/^\d{6,19}$/.test(accountNumber)
        || !accountName || accountName.length > 100) {
        return null;
    }
    return { bankBin, accountNumber, accountName };
}

function routeManager(req, res, respondRequestError) {
    if (req.auth?.role === "Quản lý") return true;
    respondRequestError(res, req.auth ? 403 : 401,
        req.auth ? "Chỉ Quản lý mới được thực hiện thao tác này." : "Vui lòng đăng nhập.");
    return false;
}

function auditRequest(sql, transaction, req, action, object, id, detail) {
    return new sql.Request(transaction)
        .input("MaTaiKhoan", sql.Int, req.auth?.accountId || null)
        .input("HanhDong", sql.NVarChar(50), action)
        .input("DoiTuong", sql.NVarChar(50), object)
        .input("MaDoiTuong", sql.NVarChar(60), String(id))
        .input("ChiTiet", sql.NVarChar(500), detail)
        .query(`
            INSERT INTO dbo.NhatKyHeThong
                (MaTaiKhoan, HanhDong, DoiTuong, MaDoiTuong, ChiTiet)
            VALUES (@MaTaiKhoan, @HanhDong, @DoiTuong, @MaDoiTuong, @ChiTiet)
        `);
}

function studentCanViewInvoice(req) {
    return req.auth?.role === "Sinh viên";
}

function registerMoneyRoutes(app, {
    getPool, sql, mapPaymentStatusToDatabase, mapPaymentMethodToDatabase,
    isDateOnly, isObjectBody, isOptionalText, isValidId, isJsonInteger,
    stringValue, respondRequestError, respondDatabaseError, logDatabaseError, rollback
}) {
    const errorContext = { logDatabaseError, respondDatabaseError, respondRequestError };

    app.get("/api/HoaDon", async (req, res) => {
        if (!req.auth) return respondRequestError(res, 401, "Vui lòng đăng nhập để xem hóa đơn.");
        const { loaiHoaDon, tenPhong, maHopDong, maSinhVien, trangThai, kyTu, kyDen } = req.query;
        if ((loaiHoaDon !== undefined && !["TIEN_PHONG", "DICH_VU_PHONG", "PHAT_SINH", "CU"].includes(loaiHoaDon))
            || (tenPhong !== undefined && !isValidId(tenPhong, 50))
            || (maHopDong !== undefined && !isValidId(maHopDong, 20))
            || (maSinhVien !== undefined && !isValidId(maSinhVien, 30))
            || (trangThai !== undefined && !["Chưa thanh toán", "Thanh toán một phần", "Đã thanh toán", "Đã hủy"].includes(trangThai))
            || (kyTu !== undefined && !isDateOnly(kyTu))
            || (kyDen !== undefined && !isDateOnly(kyDen))) {
            return respondRequestError(res, 400, "Bộ lọc hóa đơn không hợp lệ.");
        }
        if (studentCanViewInvoice(req) && maSinhVien && maSinhVien !== req.auth.studentId) {
            return respondRequestError(res, 403, "Không được xem hóa đơn của sinh viên khác.");
        }

        try {
            const request = getPool().request();
            const clauses = [];
            const addFilter = (key, type, value, expression) => {
                if (value === undefined) return;
                request.input(key, type, value);
                clauses.push(expression);
            };
            addFilter("LoaiHoaDon", sql.NVarChar(20), loaiHoaDon, "hd.LoaiHoaDon = @LoaiHoaDon");
            addFilter("TenPhong", sql.NVarChar(50), tenPhong, "hd.TenPhong = @TenPhong");
            addFilter("MaHopDong", sql.NVarChar(20), maHopDong, "hd.MaHopDong = @MaHopDong");
            addFilter("TrangThai", sql.NVarChar(30), trangThai, "hd.TrangThaiThanhToan = @TrangThai");
            addFilter("KyTu", sql.Date, kyTu, "hd.KyThanhToan >= @KyTu");
            addFilter("KyDen", sql.Date, kyDen, "hd.KyThanhToan <= @KyDen");
            if (maSinhVien !== undefined || studentCanViewInvoice(req)) {
                request.input("MaSinhVien", sql.NVarChar(30), maSinhVien || req.auth.studentId);
                clauses.push(`(
                    (hd.LoaiHoaDon = N'TIEN_PHONG' AND EXISTS (
                        SELECT 1 FROM dbo.ChiTietHopDong c
                        WHERE c.MaChiTiet = hd.MaChiTiet AND c.MaSinhVien = @MaSinhVien
                    ))
                    OR (hd.LoaiHoaDon IN (N'DICH_VU_PHONG', N'PHAT_SINH') AND EXISTS (
                        SELECT 1 FROM dbo.ChiTietHopDong c
                        INNER JOIN dbo.HopDong h ON h.MaHopDong = c.MaHopDong
                        WHERE h.MaHopDong = hd.MaHopDong
                          AND h.TrangThaiHopDong = N'Còn hiệu lực'
                          AND c.MaSinhVien = @MaSinhVien
                          AND c.TrangThai = N'Đang ở'
                    ))
                    OR (hd.LoaiHoaDon = N'CU' AND hd.MaSinhVien = @MaSinhVien)
                )`);
            }
            const result = await request.query(`
                SELECT hd.MaHoaDon, hd.MaSinhVien, hd.MaHopDong, hd.MaChiTiet,
                       hd.KyThanhToan, hd.KyThanhToanDen, hd.LoaiHoaDon,
                       sv.HoTen, hd.TenPhong, hd.NgayLap, hd.HanThanhToan,
                       hd.TrangThaiThanhToan, hd.NgayThanhToan,
                       v.TongThuc AS TongTien, v.DaThu, v.ConNo, v.TrangThaiSuyRa,
                       (SELECT COUNT_BIG(*) FROM dbo.ChiTietHoaDon c
                        WHERE c.MaHoaDon = hd.MaHoaDon) AS SoDong
                FROM dbo.HoaDon hd
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
                ORDER BY hd.NgayLap DESC, hd.MaHoaDon DESC
            `);
            return res.json(result.recordset);
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
            const studentFilter = studentCanViewInvoice(req);
            if (studentFilter) request.input("MaSinhVien", sql.NVarChar(30), req.auth.studentId);
            const result = await request.query(`
                SELECT hd.*, sv.HoTen, v.TongThuc AS TongTien,
                       v.DaThu, v.ConNo, v.TrangThaiSuyRa
                FROM dbo.HoaDon hd
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = hd.MaSinhVien
                WHERE hd.MaHoaDon = @MaHoaDon
                  ${studentFilter ? `AND ${INVOICE_OWNER}` : ""}
            `);
            const invoice = result.recordset[0];
            if (!invoice) return respondRequestError(res, 404, "Không tìm thấy hóa đơn.");

            const lines = await getPool().request()
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT MaChiTiet, MaKhoan, TenKhoan, SoTien, MaDichVu,
                           ChiSoCu, ChiSoMoi, SoLuong, DonGia, TrangThai, GhiChu, ThuTu
                    FROM dbo.ChiTietHoaDon
                    WHERE MaHoaDon = @MaHoaDon
                    ORDER BY ThuTu, MaChiTiet
                `);
            const receipts = await getPool().request()
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT pt.MaPhieuThu, pt.MaHoaDon, pt.MaGiaoDich, pt.SoTien,
                           pt.NgayThu, pt.PhuongThuc, pt.MaSinhVienNop, sv.HoTen AS TenNguoiNop,
                           pt.NguoiThu, tk.TenHienThi AS TenNguoiThu, pt.TrangThai,
                           pt.MaThamChieu, pt.GhiChu
                    FROM dbo.PhieuThu pt
                    LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = pt.MaSinhVienNop
                    LEFT JOIN dbo.TaiKhoan tk ON tk.MaTaiKhoan = pt.NguoiThu
                    WHERE pt.MaHoaDon = @MaHoaDon
                    ORDER BY pt.NgayThu DESC, pt.MaPhieuThu DESC
                `);
            return res.json({
                ...invoice,
                ChiTiet: lines.recordset,
                PhieuThu: receipts.recordset
            });
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY CHI TIẾT HÓA ĐƠN", error, "Không thể lấy chi tiết hóa đơn.");
        }
    });

    app.post("/api/HoaDon/:id/nhac-no", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        if (!isValidId(req.params.id, 20)) {
            return respondRequestError(res, 400, "Mã hóa đơn không hợp lệ.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const invoiceResult = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .query(`
                    SELECT hd.MaHoaDon, hd.LoaiHoaDon, hd.MaChiTiet, hd.MaHopDong,
                           hd.HanThanhToan,
                           CASE WHEN hd.HanThanhToan < CONVERT(date, SYSDATETIME()) THEN 1 ELSE 0 END AS IsOverdue,
                           v.ConNo,
                           CONVERT(nvarchar(10), hd.HanThanhToan, 103) AS HanHienThi
                    FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                    WHERE hd.MaHoaDon = @MaHoaDon
                `);
            const invoice = invoiceResult.recordset[0];
            if (!invoice) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hóa đơn.");
            }
            if (!invoice.HanThanhToan || !invoice.IsOverdue) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Chỉ gửi nhắc nợ cho hóa đơn đã quá hạn.");
            }
            if (Number(invoice.ConNo) <= 0) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Hóa đơn đã được thanh toán đủ.");
            }
            if (!["TIEN_PHONG", "DICH_VU_PHONG", "PHAT_SINH"].includes(invoice.LoaiHoaDon)) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Loại hóa đơn này chưa hỗ trợ gửi nhắc nợ.");
            }

            const recentReminder = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), invoice.MaHoaDon)
                .query(`
                    SELECT TOP (1) MaThongBao
                    FROM dbo.ThongBao WITH (UPDLOCK, HOLDLOCK)
                    WHERE MaHoaDon = @MaHoaDon
                      AND NgayTao >= DATEADD(hour, -24, SYSDATETIME())
                `);
            if (recentReminder.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Hóa đơn này đã được nhắc nợ trong 24 giờ qua.");
            }

            let recipients;
            if (invoice.LoaiHoaDon === "TIEN_PHONG") {
                recipients = await new sql.Request(transaction)
                    .input("MaChiTiet", sql.Int, invoice.MaChiTiet)
                    .query(`
                        SELECT DISTINCT MaSinhVien
                        FROM dbo.ChiTietHopDong
                        WHERE MaChiTiet = @MaChiTiet
                    `);
            } else {
                recipients = await new sql.Request(transaction)
                    .input("MaHopDong", sql.NVarChar(20), invoice.MaHopDong)
                    .query(`
                        SELECT DISTINCT c.MaSinhVien
                        FROM dbo.ChiTietHopDong c
                        INNER JOIN dbo.HopDong hd ON hd.MaHopDong = c.MaHopDong
                        WHERE c.MaHopDong = @MaHopDong
                          AND c.TrangThai = N'Đang ở'
                          AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                    `);
            }
            if (!recipients.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Không có sinh viên phù hợp để nhận nhắc nợ.");
            }

            const amountText = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 })
                .format(Number(invoice.ConNo));
            const title = `Nhắc nợ hóa đơn ${invoice.MaHoaDon}`;
            const content = `Hóa đơn ${invoice.MaHoaDon} còn nợ ${amountText} đ, hạn thanh toán ${invoice.HanHienThi || "—"}. Vui lòng liên hệ Ban quản lý KTX để được hỗ trợ.`;
            for (const recipient of recipients.recordset) {
                await new sql.Request(transaction)
                    .input("TieuDe", sql.NVarChar(200), title)
                    .input("NoiDung", sql.NVarChar(2000), content)
                    .input("MaSinhVien", sql.NVarChar(30), recipient.MaSinhVien)
                    .input("NguoiTao", sql.Int, req.auth.accountId)
                    .input("MaHoaDon", sql.NVarChar(20), invoice.MaHoaDon)
                    .query(`
                        INSERT INTO dbo.ThongBao
                            (TieuDe, NoiDung, PhamViNhan, MaSinhVien, NguoiTao, MaHoaDon)
                        VALUES
                            (@TieuDe, @NoiDung, N'SINH_VIEN', @MaSinhVien, @NguoiTao, @MaHoaDon)
                    `);
            }
            await transaction.commit();
            return res.status(201).json({
                success: true,
                MaHoaDon: invoice.MaHoaDon,
                SoSinhVienNhan: recipients.recordset.length
            });
        } catch (error) {
            await rollback(transaction, "GỬI NHẮC NỢ");
            return respondDatabaseError(res, "LỖI GỬI NHẮC NỢ",
                error, "Không thể gửi nhắc nợ.");
        }
    });

    app.post("/api/HoaDon/xuat-ky", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        const body = req.body;
        if (!isObjectBody(body) || !isDateOnly(body.kyThanhToan)
            || !["TIEN_PHONG", "DICH_VU_PHONG"].includes(body.loaiHoaDon)) {
            return respondRequestError(res, 400, "Loại hóa đơn và kỳ thanh toán hợp lệ là bắt buộc.");
        }
        if ((body.loaiHoaDon === "TIEN_PHONG" && !isJsonInteger(body.maChiTiet, 1, 2147483647))
            || (body.loaiHoaDon === "DICH_VU_PHONG"
                && (!isValidId(body.maHopDong, 20)
                    || (body.maSinhVienNop != null && !isValidId(body.maSinhVienNop, 30))))) {
            return respondRequestError(res, 400, "Thiếu mã thành viên hoặc hợp đồng để lập hóa đơn.");
        }
        let readings = [];
        if (body.chiSoDichVu !== undefined) {
            const readingIds = Array.isArray(body.chiSoDichVu)
                ? body.chiSoDichVu.map(item => isObjectBody(item) ? item.maDichVu : null)
                : [];
            if (!Array.isArray(body.chiSoDichVu) || body.chiSoDichVu.length > 100
                || body.chiSoDichVu.some(item => !isObjectBody(item)
                    || !isValidId(item.maDichVu, 20)
                    || !isJsonInteger(item.chiSoCu, 0, 2147483647)
                    || !isJsonInteger(item.chiSoMoi, 0, 2147483647)
                    || item.chiSoMoi < item.chiSoCu)
                || new Set(readingIds).size !== readingIds.length) {
                return respondRequestError(res, 400, "Chỉ số dịch vụ phải là danh sách số nguyên hợp lệ, chỉ số mới không nhỏ hơn chỉ số cũ.");
            }
            readings = body.chiSoDichVu.map(item => ({
                maDichVu: item.maDichVu,
                chiSoCu: item.chiSoCu,
                chiSoMoi: item.chiSoMoi
            }));
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const request = new sql.Request(transaction);
            let result;
            if (body.loaiHoaDon === "TIEN_PHONG") {
                request.input("MaChiTiet", sql.Int, body.maChiTiet)
                    .input("KyThanhToan", sql.Date, body.kyThanhToan)
                    .output("MaHoaDon", sql.NVarChar(20));
                result = await request.execute("dbo.sp_TaoHoaDonTienPhong");
            } else {
                const requiredReadings = await new sql.Request(transaction)
                    .input("MaHopDong", sql.NVarChar(20), body.maHopDong)
                    .query(`
                        SELECT hpdv.MaDichVu
                        FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
                        INNER JOIN dbo.HangPhong_DichVu hpdv WITH (UPDLOCK, HOLDLOCK)
                            ON hpdv.MaHangPhong = hd.MaHangPhong
                        INNER JOIN dbo.DichVu d ON d.MaDichVu = hpdv.MaDichVu
                        WHERE hd.MaHopDong = @MaHopDong
                          AND hd.TrangThaiHopDong = N'Còn hiệu lực'
                          AND hpdv.HoatDong = 1 AND d.HoatDong = 1
                          AND hpdv.CachTinh = N'CHI_SO'
                    `);
                const providedReadings = new Set(readings.map(item => item.maDichVu));
                const missingReading = requiredReadings.recordset.some(
                    service => !providedReadings.has(service.MaDichVu)
                );
                if (missingReading) {
                    await transaction.rollback();
                    return respondRequestError(res, 400,
                        "Cần nhập chỉ số cũ và mới cho tất cả dịch vụ tính theo chỉ số đang hoạt động.");
                }
                request.input("MaHopDong", sql.NVarChar(20), body.maHopDong)
                    .input("KyThanhToan", sql.Date, body.kyThanhToan)
                    .input("ChiSoJson", sql.NVarChar(sql.MAX), readings.length ? JSON.stringify(readings) : null)
                    .input("MaSinhVienNop", sql.NVarChar(30), body.maSinhVienNop || null)
                    .output("MaHoaDon", sql.NVarChar(20));
                result = await request.execute("dbo.sp_TaoHoaDonDichVuPhong");
            }
            const invoiceId = result.output?.MaHoaDon || result.recordset?.[0]?.MaHoaDon;
            await auditRequest(sql, transaction, req, "Lập hóa đơn theo kỳ", "HoaDon",
                invoiceId || "Theo kỳ", `${body.loaiHoaDon}; kỳ ${body.kyThanhToan}`);
            await transaction.commit();
            return res.status(201).json({ success: true, MaHoaDon: invoiceId });
        } catch (error) {
            await rollback(transaction, "LẬP HÓA ĐƠN THEO KỲ");
            return respondMoneyProcedureError(res, "LỖI LẬP HÓA ĐƠN THEO KỲ", error,
                "Không thể lập hóa đơn.", errorContext);
        }
    });

    app.put("/api/HoaDon/:id/huy", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        if (!isValidId(req.params.id, 20)) return respondRequestError(res, 400, "Mã hóa đơn không hợp lệ.");
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const result = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .query(`
                    UPDATE dbo.HoaDon
                    SET TrangThaiThanhToan = N'Đã hủy'
                    WHERE MaHoaDon = @MaHoaDon AND TrangThaiThanhToan <> N'Đã hủy';
                    SELECT @@ROWCOUNT AS SoDong;
                `);
            if (result.recordset[0]?.SoDong !== 1) {
                await transaction.rollback();
                const exists = await getPool().request()
                    .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                    .query("SELECT MaHoaDon FROM dbo.HoaDon WHERE MaHoaDon = @MaHoaDon");
                return respondRequestError(res, exists.recordset.length ? 409 : 404,
                    exists.recordset.length ? "Hóa đơn đã bị hủy." : "Không tìm thấy hóa đơn.");
            }
            await auditRequest(sql, transaction, req, "Hủy hóa đơn", "HoaDon", req.params.id, "Hủy hóa đơn.");
            await transaction.commit();
            return res.json({ success: true, message: "Đã hủy hóa đơn." });
        } catch (error) {
            await rollback(transaction, "HỦY HÓA ĐƠN");
            return respondMoneyProcedureError(res, "LỖI HỦY HÓA ĐƠN", error,
                "Không thể hủy hóa đơn.", errorContext);
        }
    });

    app.get("/api/ChiPhiPhatSinh", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        const { maHopDong, maChiTiet, trangThai } = req.query;
        if ((maHopDong !== undefined && !isValidId(maHopDong, 20))
            || (maChiTiet !== undefined && !isJsonInteger(Number(maChiTiet), 1, 2147483647))
            || (trangThai !== undefined && !["Chưa lập hóa đơn", "Đã lập hóa đơn", "Đã hủy"].includes(trangThai))) {
            return respondRequestError(res, 400, "Bộ lọc chi phí phát sinh không hợp lệ.");
        }
        try {
            const request = getPool().request();
            const filters = [];
            if (maHopDong) {
                request.input("MaHopDong", sql.NVarChar(20), maHopDong);
                filters.push("cp.MaHopDong = @MaHopDong");
            }
            if (maChiTiet) {
                request.input("MaChiTiet", sql.Int, Number(maChiTiet));
                filters.push("cp.MaChiTiet = @MaChiTiet");
            }
            if (trangThai) {
                request.input("TrangThai", sql.NVarChar(30), trangThai);
                filters.push("cp.TrangThai = @TrangThai");
            }
            const result = await request.query(`
                SELECT cp.MaChiPhi, cp.MaHopDong, cp.MaChiTiet, cp.NoiDung, cp.SoTien,
                       cp.NgayPhatSinh, cp.NguoiNhap, cp.TrangThai, cp.MaChiTietHoaDon,
                       cp.GhiChu, cp.NgayTao, hd.TenPhong, c.MaSinhVien, sv.HoTen,
                       chi.MaHoaDon
                FROM dbo.ChiPhiPhatSinh cp
                INNER JOIN dbo.HopDong hd ON hd.MaHopDong = cp.MaHopDong
                LEFT JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = cp.MaChiTiet
                LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
                LEFT JOIN dbo.ChiTietHoaDon chi ON chi.MaChiTiet = cp.MaChiTietHoaDon
                ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
                ORDER BY cp.NgayPhatSinh DESC, cp.MaChiPhi DESC
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY CHI PHÍ PHÁT SINH", error, "Không thể lấy chi phí phát sinh.");
        }
    });

    app.post("/api/ChiPhiPhatSinh", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        const body = req.body;
        if (!isObjectBody(body) || !isValidId(body.maHopDong, 20)
            || (body.maChiTiet != null && !isJsonInteger(body.maChiTiet, 1, 2147483647))
            || typeof body.noiDung !== "string" || !body.noiDung.trim() || body.noiDung.trim().length > 255
            || !isPositiveVnd(body.soTien)
            || (body.ngayPhatSinh !== undefined && !isDateOnly(body.ngayPhatSinh))
            || !isOptionalText(body.ghiChu, 255)) {
            return respondRequestError(res, 400, "Hợp đồng, nội dung, ngày hợp lệ và số tiền nguyên VND dương là bắt buộc.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const contract = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), body.maHopDong)
                .input("MaChiTiet", sql.Int, body.maChiTiet ?? null)
                .query(`
                    SELECT hd.MaHopDong
                    FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
                    WHERE hd.MaHopDong = @MaHopDong
                      AND (@MaChiTiet IS NULL OR EXISTS (
                          SELECT 1 FROM dbo.ChiTietHopDong c
                          WHERE c.MaChiTiet = @MaChiTiet AND c.MaHopDong = hd.MaHopDong
                      ))
                `);
            if (!contract.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hợp đồng hoặc thành viên thuộc hợp đồng.");
            }
            const insert = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), body.maHopDong)
                .input("MaChiTiet", sql.Int, body.maChiTiet ?? null)
                .input("NoiDung", sql.NVarChar(255), body.noiDung.trim())
                .input("SoTien", sql.Decimal(18, 2), body.soTien)
                .input("NgayPhatSinh", sql.Date, body.ngayPhatSinh || null)
                .input("NguoiNhap", sql.Int, req.auth.accountId)
                .input("GhiChu", sql.NVarChar(255), body.ghiChu || null)
                .query(`
                    INSERT INTO dbo.ChiPhiPhatSinh
                        (MaHopDong, MaChiTiet, NoiDung, SoTien, NgayPhatSinh, NguoiNhap, GhiChu)
                    VALUES
                        (@MaHopDong, @MaChiTiet, @NoiDung, @SoTien,
                         COALESCE(@NgayPhatSinh, CAST(GETDATE() AS date)), @NguoiNhap, @GhiChu);
                    SELECT CONVERT(bigint, SCOPE_IDENTITY()) AS MaChiPhi;
                `);
            const expenseId = insert.recordset[0].MaChiPhi;
            await auditRequest(sql, transaction, req, "Tạo chi phí phát sinh", "ChiPhiPhatSinh",
                expenseId, `${body.noiDung.trim()}; ${body.soTien} VND`);
            await transaction.commit();
            return res.status(201).json({ success: true, MaChiPhi: expenseId });
        } catch (error) {
            await rollback(transaction, "TẠO CHI PHÍ PHÁT SINH");
            return respondDatabaseError(res, "LỖI TẠO CHI PHÍ PHÁT SINH", error, "Không thể tạo chi phí phát sinh.");
        }
    });

    app.put("/api/ChiPhiPhatSinh/:id", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        if (!isJsonInteger(Number(req.params.id), 1, Number.MAX_SAFE_INTEGER)
            || !isObjectBody(req.body)
            || !isValidId(req.body.maHopDong, 20)
            || (req.body.maChiTiet != null && !isJsonInteger(req.body.maChiTiet, 1, 2147483647))
            || typeof req.body.noiDung !== "string" || !req.body.noiDung.trim() || req.body.noiDung.trim().length > 255
            || !isPositiveVnd(req.body.soTien)
            || (req.body.ngayPhatSinh !== undefined && !isDateOnly(req.body.ngayPhatSinh))
            || !isOptionalText(req.body.ghiChu, 255)) {
            return respondRequestError(res, 400, "Thông tin chi phí phát sinh không hợp lệ; số tiền phải là nguyên VND dương.");
        }
        const body = req.body;
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const contract = await new sql.Request(transaction)
                .input("MaHopDong", sql.NVarChar(20), body.maHopDong)
                .input("MaChiTiet", sql.Int, body.maChiTiet ?? null)
                .query(`
                    SELECT hd.MaHopDong
                    FROM dbo.HopDong hd WITH (UPDLOCK, HOLDLOCK)
                    WHERE hd.MaHopDong = @MaHopDong
                      AND (@MaChiTiet IS NULL OR EXISTS (
                          SELECT 1 FROM dbo.ChiTietHopDong c
                          WHERE c.MaChiTiet = @MaChiTiet AND c.MaHopDong = hd.MaHopDong
                      ))
                `);
            if (!contract.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hợp đồng hoặc thành viên thuộc hợp đồng.");
            }
            const updated = await new sql.Request(transaction)
                .input("MaChiPhi", sql.BigInt, Number(req.params.id))
                .input("MaHopDong", sql.NVarChar(20), body.maHopDong)
                .input("MaChiTiet", sql.Int, body.maChiTiet ?? null)
                .input("NoiDung", sql.NVarChar(255), body.noiDung.trim())
                .input("SoTien", sql.Decimal(18, 2), body.soTien)
                .input("NgayPhatSinh", sql.Date, body.ngayPhatSinh || null)
                .input("GhiChu", sql.NVarChar(255), body.ghiChu || null)
                .query(`
                    UPDATE dbo.ChiPhiPhatSinh
                    SET MaHopDong = @MaHopDong, MaChiTiet = @MaChiTiet,
                        NoiDung = @NoiDung, SoTien = @SoTien,
                        NgayPhatSinh = COALESCE(@NgayPhatSinh, NgayPhatSinh),
                        GhiChu = @GhiChu
                    WHERE MaChiPhi = @MaChiPhi AND TrangThai = N'Chưa lập hóa đơn';
                    SELECT @@ROWCOUNT AS SoDong;
                `);
            if (updated.recordset[0]?.SoDong !== 1) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Không tìm thấy hoặc chi phí đã lập hóa đơn/đã hủy.");
            }
            await auditRequest(sql, transaction, req, "Sửa chi phí phát sinh", "ChiPhiPhatSinh",
                req.params.id, `${body.noiDung.trim()}; ${body.soTien} VND`);
            await transaction.commit();
            return res.json({ success: true });
        } catch (error) {
            await rollback(transaction, "CẬP NHẬT CHI PHÍ PHÁT SINH");
            return respondMoneyProcedureError(res, "LỖI CẬP NHẬT CHI PHÍ PHÁT SINH", error,
                "Không thể cập nhật chi phí phát sinh.", errorContext);
        }
    });

    app.put("/api/ChiPhiPhatSinh/:id/huy", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        if (!isJsonInteger(Number(req.params.id), 1, Number.MAX_SAFE_INTEGER)) {
            return respondRequestError(res, 400, "Mã chi phí phát sinh không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const result = await new sql.Request(transaction)
                .input("MaChiPhi", sql.BigInt, Number(req.params.id))
                .query(`
                    UPDATE dbo.ChiPhiPhatSinh
                    SET TrangThai = N'Đã hủy'
                    WHERE MaChiPhi = @MaChiPhi AND TrangThai = N'Chưa lập hóa đơn';
                    SELECT @@ROWCOUNT AS SoDong;
                `);
            if (result.recordset[0]?.SoDong !== 1) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Không tìm thấy hoặc chi phí đã lập hóa đơn/đã hủy.");
            }
            await auditRequest(sql, transaction, req, "Hủy chi phí phát sinh", "ChiPhiPhatSinh",
                req.params.id, "Hủy khoản chưa lập hóa đơn.");
            await transaction.commit();
            return res.json({ success: true });
        } catch (error) {
            await rollback(transaction, "HỦY CHI PHÍ PHÁT SINH");
            return respondMoneyProcedureError(res, "LỖI HỦY CHI PHÍ PHÁT SINH", error,
                "Không thể hủy chi phí phát sinh.", errorContext);
        }
    });

    app.post("/api/ChiPhiPhatSinh/:id/tao-hoa-don", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        if (!isJsonInteger(Number(req.params.id), 1, Number.MAX_SAFE_INTEGER)) {
            return respondRequestError(res, 400, "Mã chi phí phát sinh không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const request = new sql.Request(transaction)
                .input("MaChiPhi", sql.BigInt, Number(req.params.id))
                .output("MaHoaDon", sql.NVarChar(20));
            const result = await request.execute("dbo.sp_TaoHoaDonPhatSinh");
            const invoiceId = result.output?.MaHoaDon || result.recordset?.[0]?.MaHoaDon;
            await auditRequest(sql, transaction, req, "Lập hóa đơn phát sinh", "ChiPhiPhatSinh",
                req.params.id, `Hóa đơn ${invoiceId || ""}`);
            await transaction.commit();
            return res.status(201).json({ success: true, MaHoaDon: invoiceId });
        } catch (error) {
            await rollback(transaction, "LẬP HÓA ĐƠN PHÁT SINH");
            return respondMoneyProcedureError(res, "LỖI LẬP HÓA ĐƠN PHÁT SINH", error,
                "Không thể lập hóa đơn phát sinh.", errorContext);
        }
    });

    app.post("/api/HoaDon/:id/phieuthu", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        const body = req.body;
        const method = isObjectBody(body) ? mapPaymentMethodToDatabase(body.phuongThuc) : null;
        const status = isObjectBody(body)
            ? mapPaymentStatusToDatabase(body.trangThai || "Hợp lệ")
            : null;
        if (!isValidId(req.params.id, 20) || !isObjectBody(body)
            || !isPositiveVnd(body.soTien) || !["CASH", "ONLINE", "CHUYEN_DOI"].includes(method)
            || !["Hợp lệ", "Chờ xác nhận", "Đã hủy"].includes(status)
            || !isOptionalText(body.maThamChieu, 100) || !isOptionalText(body.ghiChu, 255)
            || (body.maSinhVienNop != null && !isValidId(body.maSinhVienNop, 30))) {
            return respondRequestError(res, 400, "Phiếu thu cần số tiền nguyên VND dương, phương thức và trạng thái hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const invoice = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .query("SELECT MaHoaDon FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK) WHERE MaHoaDon = @MaHoaDon");
            if (!invoice.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hóa đơn.");
            }
            if (body.maThamChieu) {
                const duplicate = await new sql.Request(transaction)
                    .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                    .input("MaThamChieu", sql.NVarChar(100), body.maThamChieu.trim())
                    .query(`
                        SELECT TOP (1) MaPhieuThu
                        FROM dbo.PhieuThu WITH (UPDLOCK, HOLDLOCK)
                        WHERE MaHoaDon = @MaHoaDon AND MaThamChieu = @MaThamChieu
                          AND TrangThai <> N'Đã hủy'
                    `);
                if (duplicate.recordset.length) {
                    await transaction.rollback();
                    return respondRequestError(res, 409, "Mã tham chiếu đã được dùng trên hóa đơn này.");
                }
            }
            const receipt = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.params.id)
                .input("SoTien", sql.Decimal(18, 2), body.soTien)
                .input("PhuongThuc", sql.NVarChar(20), method)
                .input("MaSinhVienNop", sql.NVarChar(30), body.maSinhVienNop || null)
                .input("NguoiThu", sql.Int, req.auth.accountId)
                .input("TrangThai", sql.NVarChar(20), status)
                .input("MaThamChieu", sql.NVarChar(100), body.maThamChieu?.trim() || null)
                .input("GhiChu", sql.NVarChar(255), body.ghiChu || null)
                .execute("dbo.sp_GhiPhieuThu");
            const receiptId = receipt.recordset?.[0]?.MaPhieuThu;
            await auditRequest(sql, transaction, req, "Ghi phiếu thu", "PhieuThu",
                receiptId || req.params.id, `${body.soTien} VND; ${method}; ${status}`);
            const printResult = receiptId
                ? await new sql.Request(transaction)
                    .input("MaPhieuThu", sql.BigInt, receiptId)
                    .query(`
                        SELECT pt.MaPhieuThu, pt.MaHoaDon, pt.MaGiaoDich, pt.SoTien, pt.NgayThu,
                               pt.PhuongThuc, pt.MaSinhVienNop, sv.HoTen AS TenNguoiNop,
                               pt.NguoiThu, tk.TenHienThi AS TenNguoiThu, pt.TrangThai,
                               pt.MaThamChieu, pt.GhiChu, hd.TenPhong, hd.NgayLap,
                               v.TongThuc AS TongHoaDon, v.DaThu, v.ConNo
                        FROM dbo.PhieuThu pt
                        INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                        INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                        LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = pt.MaSinhVienNop
                        LEFT JOIN dbo.TaiKhoan tk ON tk.MaTaiKhoan = pt.NguoiThu
                        WHERE pt.MaPhieuThu = @MaPhieuThu
                    `)
                : { recordset: [] };
            await transaction.commit();
            return res.status(201).json({ success: true, PhieuThu: printResult.recordset[0] || null });
        } catch (error) {
            await rollback(transaction, "GHI PHIẾU THU");
            return respondMoneyProcedureError(res, "LỖI GHI PHIẾU THU", error,
                "Không thể ghi phiếu thu.", errorContext);
        }
    });

    app.get("/api/phieuthu", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        try {
            const result = await getPool().request().query(`
                SELECT pt.MaPhieuThu, pt.MaHoaDon, pt.MaGiaoDich, pt.SoTien, pt.NgayThu,
                       pt.PhuongThuc, pt.MaSinhVienNop, sv.HoTen AS TenNguoiNop,
                       pt.NguoiThu, tk.TenHienThi AS TenNguoiThu, pt.TrangThai,
                       pt.MaThamChieu, pt.GhiChu, hd.TenPhong, hd.NgayLap,
                       v.TongThuc AS TongHoaDon, v.DaThu, v.ConNo
                FROM dbo.PhieuThu pt
                INNER JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                INNER JOIN dbo.vw_HoaDonTongHop v ON v.MaHoaDon = hd.MaHoaDon
                LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = pt.MaSinhVienNop
                LEFT JOIN dbo.TaiKhoan tk ON tk.MaTaiKhoan = pt.NguoiThu
                ORDER BY pt.NgayThu DESC, pt.MaPhieuThu DESC
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY PHIẾU THU", error, "Không thể lấy danh sách phiếu thu.");
        }
    });

    async function processReceiptAction(req, res, action) {
        if (!routeManager(req, res, respondRequestError)) return;
        if (!isJsonInteger(Number(req.params.id), 1, Number.MAX_SAFE_INTEGER)
            || (req.body?.lyDo !== undefined && !isOptionalText(req.body.lyDo, 255))
            || (req.body?.maThamChieuNgoai !== undefined
                && !isOptionalText(req.body.maThamChieuNgoai, 100))) {
            return respondRequestError(res, 400, "Mã phiếu thu hoặc lý do không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const request = new sql.Request(transaction)
                .input("MaPhieuThu", sql.BigInt, Number(req.params.id));
            let result;
            if (action === "confirm") {
                request.input("NguoiXacNhan", sql.Int, req.auth.accountId)
                    .input("MaThamChieuNgoai", sql.NVarChar(100), req.body?.maThamChieuNgoai || null);
                result = await request.execute("dbo.sp_XacNhanPhieuThu");
            } else {
                request.input("NguoiThucHien", sql.Int, req.auth.accountId)
                    .input("LyDo", sql.NVarChar(255), req.body?.lyDo || null);
                result = await request.execute("dbo.sp_HuyPhieuThu");
            }
            await transaction.commit();
            const row = result.recordset?.[0] || {};
            if (row.TrangThaiGiaoDich === "RECONCILIATION") {
                return respondRequestError(res, 409,
                    row.LyDoDoiSoat || "Giao dịch cần được đối soát trước khi xác nhận.");
            }
            return res.json({ success: true, ...row });
        } catch (error) {
            await rollback(transaction, "XỬ LÝ PHIẾU THU");
            return respondMoneyProcedureError(res, "LỖI XỬ LÝ PHIẾU THU", error,
                "Không thể xử lý phiếu thu.", errorContext);
        }
    }

    app.put("/api/phieuthu/:id/xac-nhan", (req, res) => processReceiptAction(req, res, "confirm"));
    app.put("/api/phieuthu/:id/huy", (req, res) => processReceiptAction(req, res, "cancel"));

    app.get("/api/chitiethopdong/:id/goi-y-hoan-tien", async (req, res) => {
        if (!req.auth) return respondRequestError(res, 401, "Vui lòng đăng nhập.");
        if (!isJsonInteger(Number(req.params.id), 1, 2147483647)
            || (req.query.ngayRa !== undefined && !isDateOnly(req.query.ngayRa))
            || (req.query.khauTru !== undefined && !isNonNegativeVnd(Number(req.query.khauTru)))) {
            return respondRequestError(res, 400, "Mã thành viên, ngày ra hoặc khoản khấu trừ không hợp lệ.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const request = new sql.Request(transaction)
                .input("MaChiTiet", sql.Int, Number(req.params.id))
                .input("NgayRa", sql.Date, req.query.ngayRa || null)
                .input("KhauTru", sql.Decimal(18, 2), Number(req.query.khauTru || 0))
                .output("SoThangDaSuDung", sql.Int)
                .output("TienSuDung", sql.Decimal(18, 2))
                .output("SoTienDaDong", sql.Decimal(18, 2))
                .output("SoTienDaHoan", sql.Decimal(18, 2))
                .output("GoiYHoan", sql.Decimal(18, 2));
            const result = await request.execute("dbo.sp_TinhGoiYHoanTien");
            await transaction.commit();
            return res.json(result.output);
        } catch (error) {
            await rollback(transaction, "TÍNH GỢI Ý HOÀN TIỀN");
            return respondMoneyProcedureError(res, "LỖI TÍNH GỢI Ý HOÀN TIỀN", error,
                "Không thể tính gợi ý hoàn tiền.", errorContext);
        }
    });

    app.post("/api/phieuchi", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        const body = req.body;
        if (!isObjectBody(body) || !isJsonInteger(body.maChiTiet, 1, 2147483647)
            || !isDateOnly(body.ngayRa)
            || !["Nghỉ học giữa chừng", "Chuyển đi", "Khác"].includes(body.lyDo)
            || (body.khauTru !== undefined && !isNonNegativeVnd(body.khauTru))
            || (body.soTien !== undefined && !isPositiveVnd(body.soTien))
            || !isOptionalText(body.ghiChu, 255)) {
            return respondRequestError(res, 400, "Thông tin hoàn tiền không hợp lệ; tiền phải là số nguyên VND.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const result = await new sql.Request(transaction)
                .input("MaChiTiet", sql.Int, body.maChiTiet)
                .input("NgayRa", sql.Date, body.ngayRa)
                .input("LyDo", sql.NVarChar(30), body.lyDo)
                .input("KhauTru", sql.Decimal(18, 2), body.khauTru || 0)
                .input("SoTien", sql.Decimal(18, 2), body.soTien ?? null)
                .input("NguoiLap", sql.Int, req.auth.accountId)
                .input("GhiChu", sql.NVarChar(255), body.ghiChu || null)
                .execute("dbo.sp_TaoPhieuChi");
            const refund = result.recordset?.[0] || {};
            await auditRequest(sql, transaction, req, "Tạo phiếu chi", "PhieuChi",
                refund.MaPhieuChi || body.maChiTiet, `${body.soTien ?? "theo gợi ý"} VND; ${body.lyDo}`);
            await transaction.commit();
            return res.status(201).json({ success: true, ...refund });
        } catch (error) {
            await rollback(transaction, "TẠO PHIẾU CHI");
            return respondMoneyProcedureError(res, "LỖI TẠO PHIẾU CHI", error,
                "Không thể tạo phiếu chi.", errorContext);
        }
    });

    app.get("/api/phieuchi", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        try {
            const result = await getPool().request().query(`
                SELECT pc.MaPhieuChi, pc.MaChiTiet, pc.SoTienDaDong, pc.SoTienDaSuDung,
                       pc.KhauTru, pc.SoTien, pc.NgayRa, pc.LyDo, pc.NgayChi, pc.TrangThai,
                       pc.NguoiLap, tk.TenHienThi AS TenNguoiLap, pc.GhiChu,
                       c.MaSinhVien, sv.HoTen,
                       JSON_QUERY((
                           SELECT pha.MaHoaDon, pha.SoTien
                           FROM dbo.PhieuChi_HoaDon pha
                           WHERE pha.MaPhieuChi = pc.MaPhieuChi
                           FOR JSON PATH
                       )) AS PhanBoHoaDon
                FROM dbo.PhieuChi pc
                LEFT JOIN dbo.ChiTietHopDong c ON c.MaChiTiet = pc.MaChiTiet
                LEFT JOIN dbo.SinhVien sv ON sv.MaSinhVien = c.MaSinhVien
                LEFT JOIN dbo.TaiKhoan tk ON tk.MaTaiKhoan = pc.NguoiLap
                ORDER BY pc.NgayChi DESC, pc.MaPhieuChi DESC
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY PHIẾU CHI", error, "Không thể lấy danh sách phiếu chi.");
        }
    });

    app.get("/api/congno", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        try {
            const result = await getPool().request().query("SELECT * FROM dbo.vw_CongNo ORDER BY TongCongNo DESC");
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY CÔNG NỢ", error, "Không thể lấy báo cáo công nợ.");
        }
    });

    app.get("/api/payments/history", async (req, res) => {
        if (!req.auth) return respondRequestError(res, 401, "Vui lòng đăng nhập để xem lịch sử thanh toán.");
        const invoiceId = req.query.MaHoaDon;
        if (invoiceId !== undefined && !isValidId(invoiceId, 20)) {
            return respondRequestError(res, 400, "Mã hóa đơn không hợp lệ.");
        }
        const studentFilter = studentCanViewInvoice(req);
        try {
            const request = getPool().request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId || null);
            if (studentFilter) request.input("MaSinhVien", sql.NVarChar(30), req.auth.studentId);
            const result = await request.query(`
                SELECT gd.MaGiaoDich, gd.MaSinhVien, payer.HoTen,
                       hd.MaHoaDon, hd.TenPhong, hd.LoaiHoaDon, hd.KyThanhToan,
                       pt.MaPhieuThu, pt.SoTien, pt.NgayThu, pt.PhuongThuc, pt.TrangThai AS TrangThaiPhieuThu,
                       pt.MaThamChieu AS ThamChieuPhieuThu, pt.GhiChu AS GhiChuPhieuThu,
                       gd.NoiDungCK, gd.NgayTao, gd.NgayThanhToan,
                       CASE WHEN gd.TrangThai = N'RECONCILIATION' THEN N'Cần đối soát'
                            ELSE gd.TrangThai END AS TrangThai,
                       gd.XacNhanBoi, approver.TenHienThi AS TenNguoiXacNhan,
                       gd.MaThamChieuNgoai, gd.LyDoTuChoi, gd.LyDoDoiSoat
                FROM dbo.GiaoDichThanhToan gd
                LEFT JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                LEFT JOIN dbo.HoaDon hd ON hd.MaHoaDon = pt.MaHoaDon
                LEFT JOIN dbo.SinhVien payer ON payer.MaSinhVien = gd.MaSinhVien
                LEFT JOIN dbo.TaiKhoan approver ON approver.MaTaiKhoan = gd.XacNhanBoi
                WHERE (@MaHoaDon IS NULL OR hd.MaHoaDon = @MaHoaDon)
                  ${studentFilter ? `AND hd.MaHoaDon IS NOT NULL AND ${INVOICE_OWNER}` : ""}
                ORDER BY COALESCE(gd.NgayThanhToan, gd.NgayTao) DESC, gd.MaGiaoDich
            `);
            return res.json(result.recordset);
        } catch (error) {
            return respondDatabaseError(res, "LỖI LẤY LỊCH SỬ THANH TOÁN", error, "Không thể lấy lịch sử thanh toán.");
        }
    });

    app.get("/api/payments/qr", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, req.auth ? 403 : 401,
                "Chỉ Sinh viên mới được tạo thông tin QR cho hóa đơn của mình.");
        }
        const invoiceId = req.query.MaHoaDon;
        if (!isValidId(invoiceId, 20)
            || (req.query.SoTien !== undefined
                && (!/^[1-9]\d*$/.test(req.query.SoTien) || !isPositiveVnd(Number(req.query.SoTien))))) {
            return respondRequestError(res, 400, "Mã hóa đơn hợp lệ và số tiền nguyên VND dương là bắt buộc.");
        }
        const bank = getBankTransferConfig(stringValue);
        if (!bank) return respondRequestError(res, 503, "Chưa cấu hình tài khoản nhận chuyển khoản QR.");
        try {
            const result = await getPool().request()
                .input("MaHoaDon", sql.NVarChar(20), invoiceId)
                .input("MaSinhVien", sql.NVarChar(30), req.auth.studentId)
                .query(`
                    SELECT hd.MaHoaDon, total.TongThuc,
                           total.TongThuc - received.DaThu AS ConNo,
                           (SELECT COUNT_BIG(*) FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon) AS SoKhoan
                    FROM dbo.HoaDon hd
                    CROSS APPLY (
                        SELECT ISNULL(SUM(c.SoTien), 0) AS TongThuc
                        FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
                    ) total
                    CROSS APPLY (
                        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N'Hợp lệ'
                    ) received
                    WHERE hd.MaHoaDon = @MaHoaDon
                      AND hd.TrangThaiThanhToan <> N'Đã hủy'
                      AND ${INVOICE_OWNER}
                `);
            const invoice = result.recordset[0];
            if (!invoice) return respondRequestError(res, 404, "Không tìm thấy hóa đơn của sinh viên này.");
            const amount = req.query.SoTien === undefined ? Number(invoice.ConNo) : Number(req.query.SoTien);
            if (!Number.isSafeInteger(amount) || amount <= 0 || amount > Number(invoice.ConNo)) {
                return respondRequestError(res, 409, "Số tiền QR phải là số nguyên VND dương và không vượt công nợ.");
            }
            const paymentContent = `KTX ${invoice.MaHoaDon}`;
            return res.json({
                MaHoaDon: invoice.MaHoaDon,
                TongTien: amount,
                SoKhoan: Number(invoice.SoKhoan),
                PhuongThuc: "ONLINE",
                NganHang: bank.bankBin,
                SoTaiKhoan: bank.accountNumber,
                TenTaiKhoan: bank.accountName,
                DemoPaymentEnabled: process.env.ALLOW_DEMO_PAYMENT === "true",
                NoiDungCK: paymentContent,
                QrPayload: createVietQrPayload({
                    bankBin: bank.bankBin, accountNumber: bank.accountNumber,
                    amount, paymentContent
                })
            });
        } catch (error) {
            return respondDatabaseError(res, "LỖI TẠO QR THANH TOÁN", error, "Không thể tạo mã QR thanh toán.");
        }
    });

    app.post("/api/payments/create", async (req, res) => {
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, req.auth ? 403 : 401, "Chỉ Sinh viên mới được gửi yêu cầu thanh toán.");
        }
        const body = req.body;
        const method = isObjectBody(body) ? mapPaymentMethodToDatabase(body.PhuongThuc) : null;
        if (!isObjectBody(body) || !isValidId(body.MaHoaDon, 20)
            || !["ONLINE", "CASH"].includes(method)
            || (body.SoTien !== undefined && !isPositiveVnd(body.SoTien))) {
            return respondRequestError(res, 400,
                "Mã hóa đơn, phương thức ONLINE/CASH và số tiền nguyên VND dương (nếu có) là bắt buộc.");
        }
        if (method === "ONLINE" && !getBankTransferConfig(stringValue)) {
            return respondRequestError(res, 503, "Chưa cấu hình tài khoản nhận chuyển khoản QR.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const invoiceResult = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), body.MaHoaDon)
                .input("MaSinhVien", sql.NVarChar(30), req.auth.studentId)
                .query(`
                    SELECT hd.MaHoaDon, hd.TrangThaiThanhToan,
                           total.TongThuc - received.DaThu AS ConNo
                    FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
                    CROSS APPLY (
                        SELECT ISNULL(SUM(c.SoTien), 0) AS TongThuc
                        FROM dbo.ChiTietHoaDon c WHERE c.MaHoaDon = hd.MaHoaDon
                    ) total
                    CROSS APPLY (
                        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N'Hợp lệ'
                    ) received
                    WHERE hd.MaHoaDon = @MaHoaDon
                      AND hd.TrangThaiThanhToan <> N'Đã hủy'
                      AND ${INVOICE_OWNER}
                `);
            const invoice = invoiceResult.recordset[0];
            if (!invoice) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hóa đơn được phép thanh toán.");
            }
            const amount = body.SoTien === undefined ? Number(invoice.ConNo) : body.SoTien;
            if (!Number.isSafeInteger(amount) || amount <= 0 || amount > Number(invoice.ConNo)) {
                await transaction.rollback();
                return respondRequestError(res, 409, "Số tiền phải là số nguyên VND dương và không vượt công nợ.");
            }

            const pending = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), body.MaHoaDon)
                .query(`
                    SELECT TOP (1) gd.MaGiaoDich, gd.TongTien, gd.PhuongThuc, gd.TrangThai,
                           pt.MaPhieuThu
                    FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.GiaoDichThanhToan gd ON gd.MaGiaoDich = pt.MaGiaoDich
                    WHERE pt.MaHoaDon = @MaHoaDon AND pt.TrangThai = N'Chờ xác nhận'
                      AND gd.TrangThai IN (N'PENDING', N'RECONCILIATION')
                    ORDER BY gd.NgayTao DESC
                `);
            if (pending.recordset.length) {
                const existing = pending.recordset[0];
                await transaction.rollback();
                if (existing.TrangThai === "RECONCILIATION") {
                    return respondRequestError(res, 409, "Giao dịch đang cần đối soát; không thể tạo yêu cầu thu trùng.");
                }
                if (existing.PhuongThuc === method && Number(existing.TongTien) === amount) {
                    return res.status(200).json({
                        success: true, MaGiaoDich: existing.MaGiaoDich,
                        MaHoaDon: body.MaHoaDon, SoTien: amount,
                        PhuongThuc: existing.PhuongThuc, TrangThai: existing.TrangThai
                    });
                }
                return respondRequestError(res, 409, "Hóa đơn đã có yêu cầu thanh toán đang chờ xác nhận.");
            }

            const transactionId = `PAY-${randomUUID().replace(/-/g, "").toUpperCase()}`;
            const paymentContent = method === "ONLINE" ? `KTX ${body.MaHoaDon}` : null;
            await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), transactionId)
                .input("MaSinhVien", sql.NVarChar(30), req.auth.studentId)
                .input("TongTien", sql.Decimal(18, 2), amount)
                .input("PhuongThuc", sql.NVarChar(10), method)
                .input("TrangThai", sql.NVarChar(20), mapPaymentStatusToDatabase("PENDING"))
                .input("NoiDungCK", sql.NVarChar(100), paymentContent)
                .query(`
                    INSERT INTO dbo.GiaoDichThanhToan
                        (MaGiaoDich, MaSinhVien, TongTien, PhuongThuc, TrangThai, NoiDungCK)
                    VALUES (@MaGiaoDich, @MaSinhVien, @TongTien, @PhuongThuc, @TrangThai, @NoiDungCK)
                `);
            const receiptResult = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), body.MaHoaDon)
                .input("SoTien", sql.Decimal(18, 2), amount)
                .input("PhuongThuc", sql.NVarChar(20), method)
                .input("MaSinhVienNop", sql.NVarChar(30), req.auth.studentId)
                .input("TrangThai", sql.NVarChar(20), mapPaymentStatusToDatabase("WAITING_CASH"))
                .input("MaGiaoDich", sql.NVarChar(60), transactionId)
                .input("GhiChu", sql.NVarChar(255), "Tạo từ yêu cầu thanh toán trực tuyến.")
                .execute("dbo.sp_GhiPhieuThu");
            const receiptId = receiptResult.recordset?.[0]?.MaPhieuThu;
            await auditRequest(sql, transaction, req, "Tạo yêu cầu thanh toán", "GiaoDichThanhToan",
                transactionId, `${amount} VND; ${method}; phiếu ${receiptId || ""}`);
            await transaction.commit();
            return res.status(201).json({
                success: true,
                message: method === "ONLINE"
                    ? "Đã tạo yêu cầu chuyển khoản; giao dịch sẽ được đối soát trước khi xác nhận."
                    : "Đã ghi nhận yêu cầu thu tiền mặt, đang chờ Quản lý xác nhận.",
                MaGiaoDich: transactionId, MaPhieuThu: receiptId,
                MaHoaDon: body.MaHoaDon, SoTien: amount, NoiDungCK: paymentContent,
                PhuongThuc: method, TrangThai: "PENDING"
            });
        } catch (error) {
            await rollback(transaction, "TẠO YÊU CẦU THANH TOÁN");
            return respondMoneyProcedureError(res, "LỖI TẠO YÊU CẦU THANH TOÁN", error,
                "Không thể ghi nhận yêu cầu thanh toán.", errorContext);
        }
    });

    app.post("/api/payments/demo-confirm", async (req, res) => {
        if (process.env.ALLOW_DEMO_PAYMENT !== "true") {
            return respondRequestError(res, 503, "Thanh toán QR demo đang tắt.");
        }
        if (req.auth?.role !== "Sinh viên") {
            return respondRequestError(res, req.auth ? 403 : 401,
                "Chỉ Sinh viên mới được xác nhận thanh toán QR demo.");
        }
        if (!isObjectBody(req.body) || !isValidId(req.body.MaHoaDon, 20)
            || typeof req.body.MaGiaoDich !== "string"
            || !/^PAY-[A-F0-9]{32}$/.test(req.body.MaGiaoDich)) {
            return respondRequestError(res, 400, "Mã hóa đơn hoặc mã giao dịch demo không hợp lệ.");
        }

        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const invoiceResult = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon)
                .input("MaSinhVien", sql.NVarChar(30), req.auth.studentId)
                .query(`
                    SELECT hd.MaHoaDon, hd.TrangThaiThanhToan,
                           total.TongThuc - received.DaThu AS ConNo
                    FROM dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK)
                    CROSS APPLY (
                        SELECT ISNULL(SUM(c.SoTien), 0) AS TongThuc
                        FROM dbo.ChiTietHoaDon c
                        WHERE c.MaHoaDon = hd.MaHoaDon
                    ) total
                    CROSS APPLY (
                        SELECT ISNULL(SUM(pt.SoTien), 0) AS DaThu
                        FROM dbo.PhieuThu pt
                        WHERE pt.MaHoaDon = hd.MaHoaDon AND pt.TrangThai = N'Hợp lệ'
                    ) received
                    WHERE hd.MaHoaDon = @MaHoaDon
                      AND ${INVOICE_OWNER}
                `);
            const invoice = invoiceResult.recordset[0];
            if (!invoice) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy hóa đơn được phép thanh toán.");
            }
            if (invoice.TrangThaiThanhToan === "Đã hủy") {
                await transaction.rollback();
                return respondRequestError(res, 409, "Hóa đơn đã bị hủy.");
            }

            const paymentResult = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), req.body.MaGiaoDich)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon)
                .input("MaSinhVien", sql.NVarChar(30), req.auth.studentId)
                .query(`
                    SELECT gd.TrangThai AS TrangThaiGiaoDich, gd.PhuongThuc,
                           pt.MaPhieuThu, pt.TrangThai AS TrangThaiPhieuThu, pt.SoTien
                    FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
                        ON pt.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.MaGiaoDich = @MaGiaoDich
                      AND gd.MaSinhVien = @MaSinhVien
                      AND gd.PhuongThuc = N'ONLINE'
                      AND pt.PhuongThuc = N'ONLINE'
                      AND pt.MaHoaDon = @MaHoaDon
                `);
            const payment = paymentResult.recordset[0];
            if (!payment) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy giao dịch QR thuộc hóa đơn này.");
            }
            if (payment.TrangThaiGiaoDich !== "PENDING"
                || payment.TrangThaiPhieuThu !== "Chờ xác nhận") {
                await transaction.rollback();
                return respondRequestError(res, 409,
                    Number(invoice.ConNo) <= 0
                        ? "Hóa đơn đã thanh toán đủ, không ghi nhận thêm."
                        : "Giao dịch này đã được xử lý, không ghi nhận thêm.");
            }

            const demoReference = `QR-DEMO:${req.body.MaGiaoDich}`;
            await new sql.Request(transaction)
                .input("MaPhieuThu", sql.BigInt, payment.MaPhieuThu)
                .input("MaThamChieu", sql.NVarChar(100), demoReference)
                .input("GhiChu", sql.NVarChar(255), "QR demo thanh toán")
                .query(`
                    UPDATE dbo.PhieuThu
                    SET MaThamChieu = @MaThamChieu, GhiChu = @GhiChu
                    WHERE MaPhieuThu = @MaPhieuThu AND TrangThai = N'Chờ xác nhận'
                `);
            const confirmed = await new sql.Request(transaction)
                .input("MaPhieuThu", sql.BigInt, payment.MaPhieuThu)
                .input("NguoiXacNhan", sql.Int, req.auth.accountId)
                .input("MaThamChieuNgoai", sql.NVarChar(100), demoReference)
                .execute("dbo.sp_XacNhanPhieuThu");
            const result = confirmed.recordset?.[0] || {};
            if (result.TrangThaiGiaoDich === "RECONCILIATION") {
                await transaction.commit();
                return respondRequestError(res, 409,
                    Number(invoice.ConNo) <= 0
                        ? "Hóa đơn đã thanh toán đủ, không ghi nhận thêm."
                        : result.LyDoDoiSoat || "Không ghi nhận giao dịch QR demo.");
            }
            await transaction.commit();
            return res.json({
                success: true,
                message: "Thanh toán thành công.",
                MaGiaoDich: req.body.MaGiaoDich,
                MaHoaDon: req.body.MaHoaDon,
                SoTien: Number(payment.SoTien),
                PhuongThuc: "QR_DEMO"
            });
        } catch (error) {
            await rollback(transaction, "XÁC NHẬN THANH TOÁN QR DEMO");
            return respondMoneyProcedureError(res, "LỖI XÁC NHẬN THANH TOÁN QR DEMO",
                error, "Không thể xác nhận thanh toán QR demo.", errorContext);
        }
    });

    app.post("/api/payments/bank-transfer/notify", async (req, res) => {
        const webhookSecret = stringValue(process.env.PAYMENT_WEBHOOK_SECRET);
        if (webhookSecret.length < 32) {
            return respondRequestError(res, 503, "Chưa cấu hình xác thực thông báo thanh toán ngân hàng.");
        }
        if (!isObjectBody(req.body) || !isValidId(req.body.MaHoaDon, 20)
            || !isPositiveVnd(req.body.SoTien)
            || typeof req.body.MaThamChieuNgoai !== "string"
            || !req.body.MaThamChieuNgoai.trim() || req.body.MaThamChieuNgoai.length > 100
            || typeof req.body.NoiDungCK !== "string" || req.body.NoiDungCK.length > 100) {
            return respondRequestError(res, 400,
                "Mã hóa đơn, số tiền nguyên VND dương, mã tham chiếu và nội dung chuyển khoản là bắt buộc.");
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
                           gd.NoiDungCK, gd.LyDoDoiSoat, pt.MaHoaDon, pt.SoTien, pt.TrangThai AS TrangThaiPhieuThu
                    FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                    LEFT JOIN dbo.PhieuThu pt ON pt.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.MaThamChieuNgoai = @MaThamChieuNgoai
                `);
            if (existingReference.recordset.length) {
                const existing = existingReference.recordset[0];
                const sameIdentity = existing.PhuongThuc === "ONLINE"
                    && existing.MaHoaDon === req.body.MaHoaDon.trim()
                    && existing.NoiDungCK === req.body.NoiDungCK;
                const sameEvent = sameIdentity
                    && (existing.TrangThai === "RECONCILIATION"
                        || (existing.TrangThai === "SUCCESS"
                            && Number(existing.TongTien) === req.body.SoTien
                            && Number(existing.SoTien) === req.body.SoTien));
                await transaction.rollback();
                if (sameEvent) {
                    return res.status(200).json({
                        success: true, alreadyProcessed: true,
                        needsReconciliation: existing.TrangThai === "RECONCILIATION",
                        message: existing.LyDoDoiSoat || "Thông báo chuyển khoản đã được xử lý."
                    });
                }
                return respondRequestError(res, 409, "Mã tham chiếu bên ngoài đã được sử dụng cho giao dịch khác.");
            }

            const pending = await new sql.Request(transaction)
                .input("MaHoaDon", sql.NVarChar(20), req.body.MaHoaDon.trim())
                .query(`
                    SELECT TOP (1) gd.MaGiaoDich, gd.MaSinhVien, gd.TongTien, gd.NoiDungCK,
                           pt.MaPhieuThu, pt.SoTien, pt.TrangThai AS TrangThaiPhieuThu,
                           pt.MaHoaDon, hd.TrangThaiThanhToan
                    FROM dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                        ON gd.MaGiaoDich = pt.MaGiaoDich
                    INNER JOIN dbo.HoaDon hd WITH (UPDLOCK, HOLDLOCK) ON hd.MaHoaDon = pt.MaHoaDon
                    WHERE pt.MaHoaDon = @MaHoaDon
                      AND pt.TrangThai = N'Chờ xác nhận'
                      AND gd.PhuongThuc = N'ONLINE'
                      AND gd.TrangThai = N'PENDING'
                    ORDER BY pt.NgayTao DESC, pt.MaPhieuThu DESC
                `);
            const payment = pending.recordset[0];
            if (!payment) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy phiếu chuyển khoản đang chờ cho hóa đơn này.");
            }
            const eventMatches = Number(payment.TongTien) === req.body.SoTien
                && Number(payment.SoTien) === req.body.SoTien
                && payment.NoiDungCK === req.body.NoiDungCK
                && req.body.NoiDungCK === `KTX ${req.body.MaHoaDon.trim()}`
                && payment.TrangThaiThanhToan !== "Đã hủy";
            if (!eventMatches) {
                const reason = "Số tiền hoặc nội dung chuyển khoản không khớp phiếu thu đang chờ.";
                await new sql.Request(transaction)
                    .input("MaGiaoDich", sql.NVarChar(60), payment.MaGiaoDich)
                    .input("TrangThai", sql.NVarChar(20), mapPaymentStatusToDatabase("Cần đối soát"))
                    .input("MaThamChieuNgoai", sql.NVarChar(100), reference)
                    .input("LyDoDoiSoat", sql.NVarChar(255), reason)
                    .query(`
                        UPDATE dbo.GiaoDichThanhToan
                        SET TrangThai = @TrangThai,
                            MaThamChieuNgoai = @MaThamChieuNgoai,
                            LyDoDoiSoat = @LyDoDoiSoat
                        WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'PENDING'
                    `);
                await auditRequest(sql, transaction, req, "Giao dịch cần đối soát",
                    "GiaoDichThanhToan", payment.MaGiaoDich, reason);
                await transaction.commit();
                return res.status(200).json({ success: true, needsReconciliation: true, message: reason });
            }

            await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), payment.MaGiaoDich)
                .input("MaThamChieuNgoai", sql.NVarChar(100), reference)
                .query(`
                    UPDATE dbo.GiaoDichThanhToan
                    SET MaThamChieuNgoai = @MaThamChieuNgoai
                    WHERE MaGiaoDich = @MaGiaoDich AND TrangThai = N'PENDING'
                `);
            const confirmed = await new sql.Request(transaction)
                .input("MaPhieuThu", sql.BigInt, payment.MaPhieuThu)
                .input("NguoiXacNhan", sql.Int, null)
                .input("MaThamChieuNgoai", sql.NVarChar(100), reference)
                .execute("dbo.sp_XacNhanPhieuThu");
            const confirmation = confirmed.recordset?.[0] || {};
            await transaction.commit();
            if (confirmation.TrangThaiGiaoDich === "RECONCILIATION") {
                return res.status(200).json({
                    success: true, needsReconciliation: true,
                    message: confirmation.LyDoDoiSoat || "Giao dịch cần được đối soát."
                });
            }
            return res.status(200).json({ success: true, message: "Đã ghi nhận giao dịch chuyển khoản." });
        } catch (error) {
            await rollback(transaction, "XỬ LÝ WEBHOOK CHUYỂN KHOẢN");
            return respondMoneyProcedureError(res, "LỖI XỬ LÝ WEBHOOK CHUYỂN KHOẢN", error,
                "Không thể xử lý thông báo chuyển khoản.", errorContext);
        }
    });

    app.post("/api/payments/confirm/:transactionId", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        if (!isValidId(req.params.transactionId, 60) || !isObjectBody(req.body)
            || !isOptionalText(req.body.MaThamChieuNgoai, 100)) {
            return respondRequestError(res, 400, "Mã giao dịch hợp lệ; mã chứng từ, nếu có, tối đa 100 ký tự.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const payment = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), req.params.transactionId)
                .query(`
                    SELECT pt.MaPhieuThu, pt.MaHoaDon, pt.TrangThai AS TrangThaiPhieuThu,
                           gd.PhuongThuc, gd.TrangThai
                    FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK) ON pt.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.MaGiaoDich = @MaGiaoDich
                `);
            if (!payment.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy giao dịch.");
            }
            const row = payment.recordset[0];
            if (row.PhuongThuc !== "CASH") {
                await transaction.rollback();
                return respondRequestError(res, 409, "Chỉ Quản lý mới xác nhận yêu cầu tiền mặt tại đây.");
            }
            const result = await new sql.Request(transaction)
                .input("MaPhieuThu", sql.BigInt, row.MaPhieuThu)
                .input("NguoiXacNhan", sql.Int, req.auth.accountId)
                .input("MaThamChieuNgoai", sql.NVarChar(100), req.body.MaThamChieuNgoai || null)
                .execute("dbo.sp_XacNhanPhieuThu");
            await transaction.commit();
            const confirmation = result.recordset?.[0] || {};
            if (confirmation.TrangThaiGiaoDich === "RECONCILIATION") {
                return respondRequestError(res, 409,
                    confirmation.LyDoDoiSoat || "Giao dịch cần được đối soát trước khi xác nhận.");
            }
            return res.json({ success: true, message: "Đã xác nhận thu tiền mặt." });
        } catch (error) {
            await rollback(transaction, "XÁC NHẬN GIAO DỊCH");
            return respondMoneyProcedureError(res, "LỖI XÁC NHẬN GIAO DỊCH", error,
                "Không thể xác nhận giao dịch.", errorContext);
        }
    });

    app.post("/api/payments/reject/:transactionId", async (req, res) => {
        if (!routeManager(req, res, respondRequestError)) return;
        if (!isValidId(req.params.transactionId, 60) || !isObjectBody(req.body)
            || !isOptionalText(req.body.LyDoTuChoi, 255) || !stringValue(req.body.LyDoTuChoi)) {
            return respondRequestError(res, 400, "Mã giao dịch hợp lệ và lý do từ chối tối đa 255 ký tự là bắt buộc.");
        }
        const transaction = new sql.Transaction(getPool());
        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            const payment = await new sql.Request(transaction)
                .input("MaGiaoDich", sql.NVarChar(60), req.params.transactionId)
                .query(`
                    SELECT pt.MaPhieuThu, gd.PhuongThuc
                    FROM dbo.GiaoDichThanhToan gd WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.PhieuThu pt WITH (UPDLOCK, HOLDLOCK) ON pt.MaGiaoDich = gd.MaGiaoDich
                    WHERE gd.MaGiaoDich = @MaGiaoDich
                `);
            if (!payment.recordset.length) {
                await transaction.rollback();
                return respondRequestError(res, 404, "Không tìm thấy giao dịch.");
            }
            if (payment.recordset[0].PhuongThuc !== "CASH") {
                await transaction.rollback();
                return respondRequestError(res, 409, "Chỉ yêu cầu tiền mặt đang chờ mới được từ chối thủ công.");
            }
            const result = await new sql.Request(transaction)
                .input("MaPhieuThu", sql.BigInt, payment.recordset[0].MaPhieuThu)
                .input("NguoiThucHien", sql.Int, req.auth.accountId)
                .input("LyDo", sql.NVarChar(255), stringValue(req.body.LyDoTuChoi))
                .execute("dbo.sp_HuyPhieuThu");
            await transaction.commit();
            return res.json({ success: true, ...result.recordset?.[0] });
        } catch (error) {
            await rollback(transaction, "TỪ CHỐI GIAO DỊCH");
            return respondMoneyProcedureError(res, "LỖI TỪ CHỐI GIAO DỊCH", error,
                "Không thể từ chối giao dịch.", errorContext);
        }
    });

    for (const [method, route] of [["post", "/api/HoaDon"], ["put", "/api/HoaDon/:id"]]) {
        app[method](route, (_req, res) => respondRequestError(res, 410,
            "API hóa đơn cũ đã ngừng sử dụng. Hãy dùng POST /api/HoaDon/xuat-ky để lập hóa đơn."));
    }
    app.put("/api/HoaDon/:id/thanhtoan", (_req, res) => respondRequestError(res, 409,
        "Không thể thanh toán trực tiếp trên hóa đơn. Hãy tạo yêu cầu thanh toán hoặc ghi phiếu thu."));
}

module.exports = registerMoneyRoutes;
