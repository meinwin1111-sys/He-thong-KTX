const { test } = require("node:test");
const assert = require("node:assert/strict");
const utils = require("./AdminWorkflowUtils");
const studentIdentity = require("../student-identity");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM, VirtualConsole } = require("jsdom");

test("Admin table enhancement ignores detached tables and enhances connected tables", async () => {
    const jsdomErrors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", error => jsdomErrors.push(error));
    const dom = new JSDOM("<main id='tables'></main>", { virtualConsole });
    const previousDocument = global.document;
    const previousMutationObserver = global.MutationObserver;
    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;

    try {
        const container = dom.window.document.getElementById("tables");
        utils.enhanceAdminTables(container);

        const detachedTable = dom.window.document.createElement("table");
        detachedTable.innerHTML = "<thead><tr><th>Title</th></tr></thead><tbody><tr><td>Value</td></tr></tbody>";
        container.append(detachedTable);
        detachedTable.remove();
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(jsdomErrors.length, 0);
        assert.equal(detachedTable.dataset.adminFilterEnhanced, undefined);

        const connectedTable = dom.window.document.createElement("table");
        connectedTable.innerHTML = "<thead><tr><th>Title</th></tr></thead><tbody><tr><td>Value</td></tr></tbody>";
        container.append(connectedTable);
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(connectedTable.dataset.adminFilterEnhanced, "true");
        assert.equal(connectedTable.previousElementSibling.matches("[data-admin-table-toolbar]"), true);
        assert.equal(connectedTable.nextElementSibling.matches("footer"), true);
        assert.equal(jsdomErrors.length, 0);
    } finally {
        if (previousDocument === undefined) delete global.document;
        else global.document = previousDocument;
        if (previousMutationObserver === undefined) delete global.MutationObserver;
        else global.MutationObserver = previousMutationObserver;
        dom.window.close();
    }
});

test("Admin money helpers accept positive integer VND and format thousands", () => {
    assert.equal(utils.parseVnd("1.250.000"), 1250000);
    assert.equal(utils.parseVnd("1250000"), 1250000);
    assert.equal(utils.parseVnd("0"), null);
    assert.equal(utils.parseVnd("-1"), null);
    assert.equal(utils.parseVnd("1.5"), null);
    assert.equal(utils.formatVnd(1250000), "1.250.000\u00a0đ");
    assert.equal(utils.formatVnd(-1250000), "-1.250.000\u00a0đ");
    const table = utils.renderTable([
        { label: "Đơn giá", align: "right", render: row => utils.formatVnd(row.amount) }
    ], [{ amount: 1250000 }]);
    assert.match(table, /<th[^>]+style="width:140px"[^>]+text-right tabular-nums/);
    assert.match(table, /style="width:140px;max-width:140px"[^>]+text-right tabular-nums/);
});

test("shared student identity validation and masking cover CCCD, passport, and legacy IDs", () => {
    assert.deepEqual(studentIdentity.validateStudentIdentity(" 012345678901 "), {
        valid: true, value: "012345678901", type: "CCCD", message: ""
    });
    assert.equal(studentIdentity.validateStudentIdentity(" ab1234 ").value, "AB1234");
    for (const invalid of ["12345678901", "0123456789012", "123456", "AB12 34", "AB12-34", "ABC12"]) {
        assert.equal(studentIdentity.validateStudentIdentity(invalid).valid, false, invalid);
    }
    assert.equal(utils.maskStudentId("012345678901"), "0123****8901");
    assert.equal(utils.maskStudentId("ab1234"), "ab****34");
    assert.equal(utils.maskStudentId("abc"), "***");
    const knownIds = ["012345678901", "AB12CD34"];
    const message = "CCCD 012345678901; hộ chiếu AB12CD34; hóa đơn HD20261001; hợp đồng HD00042; phòng A103; giao dịch PAY-1; QR KTXABCDEF0123456789ABCD";
    assert.equal(utils.maskStudentIdsInText(message, knownIds),
        "CCCD 0123****8901; hộ chiếu AB****34; hóa đơn HD20261001; hợp đồng HD00042; phòng A103; giao dịch PAY-1; QR KTXABCDEF0123456789ABCD");
    assert.equal(utils.maskStudentIdsInText("PAY-AB12CD34-KTX", knownIds), "PAY-AB12CD34-KTX");
    assert.equal(utils.maskStudentIdsInText("AB12CD34"), "AB12CD34");
});

test("Admin status badges use one consistent status color mapping", () => {
    assert.match(utils.statusBadge("Đang ở"), /admin-status--success/);
    assert.match(utils.statusBadge("Chưa xếp phòng"), /admin-status--warning/);
    assert.match(utils.statusBadge("Đã rời khỏi"), /admin-status--danger/);
    assert.match(utils.statusBadge("Trống"), /admin-status--neutral/);
    assert.match(utils.statusBadge("Đầy"), /admin-status--info/);
    assert.match(utils.statusBadge("Còn hiệu lực"), /admin-status--success/);
    assert.match(utils.statusBadge("Đã thanh toán"), /admin-status--success/);
    assert.match(utils.statusBadge("Đã kết thúc"), /admin-status--neutral/);
    assert.match(utils.statusBadge("Trễ hạn"), /admin-status--danger/);
    assert.match(utils.statusBadge("Chờ xác nhận"), /admin-status--warning/);
    assert.doesNotMatch(utils.statusBadge("RECONCILIATION"), /RECONCILIATION|Cần đối soát/);
});

test("shared invoice status is due-date-aware and overdue remains action-required", () => {
    const invoice = { MaHoaDon: "INV-LATE", ConNo: 500, HanThanhToan: "2026-11-03" };
    assert.equal(utils.invoicePaymentLabel(invoice, "2026-11-03"), "Còn nợ");
    assert.equal(utils.invoicePaymentLabel(invoice, "2026-11-04"), "Trễ hạn");
    assert.equal(utils.invoicePaymentLabel({
        ...invoice, ConNo: 0, TrangThaiThanhToan: "Đã thanh toán"
    }, "2026-11-04"), "Đã thanh toán");
    const rows = [
        { ...invoice, HanThanhToan: "2000-01-01" },
        { ...invoice, MaHoaDon: "INV-PAID", ConNo: 0, TrangThaiThanhToan: "Đã thanh toán" }
    ];
    assert.deepEqual(utils.filterFinancialRows(rows, "invoices", {
        status: "Trễ hạn"
    }).map(row => row.MaHoaDon), ["INV-LATE"]);
    assert.deepEqual(utils.filterFinancialRows(rows, "invoices", {
        status: "ACTION_REQUIRED"
    }).map(row => row.MaHoaDon), ["INV-LATE"]);
});

test("Shared table filters, pagination, grouping, and rendering preserve row and column counts", () => {
    const rows = Array.from({ length: 42 }, (_, index) => ({
        id: index + 1,
        status: index % 2 ? "Hợp lệ" : "Chờ xác nhận",
        name: `SV${index + 1}`,
        date: index < 3 ? "2026-03-01" : "2026-04-01"
    }));
    assert.deepEqual(utils.filterRows(rows, { search: "sv21", status: "Chờ xác nhận" }, {
        searchFields: ["name"], statusField: "status"
    }).map(row => row.id), [21]);
    assert.equal(utils.filterRows(rows, { from: "2026-04-01" }, { dateField: "date" }).length, 39);
    const page = utils.paginateRows(rows, 2, 20);
    assert.equal(page.rows.length, 20);
    assert.equal(page.pageCount, 3);
    assert.equal(page.start, 21);
    const groups = utils.groupContractDetails([
        { MaHopDong: "HD1", MaSinhVien: "SV1" },
        { MaHopDong: "HD1", MaSinhVien: "SV2" },
        { MaHopDong: "HD2", MaSinhVien: "SV3" }
    ]);
    assert.deepEqual(groups.map(group => group.members.length), [2, 1]);
    const table = utils.renderTable([
        { label: "Tên", render: row => row.name },
        { label: "Số tiền", align: "right", render: row => String(row.amount) }
    ], [{ name: "Dòng 1", amount: 100 }]);
    assert.equal((table.match(/<th /g) || []).length, (table.match(/<td /g) || []).length);
    assert.match(table, /text-right/);
});

test("Admin list summaries count active rows and service catalog modes gate editing controls", () => {
    const contracts = [
        { TrangThaiHopDong: "Còn hiệu lực" },
        { TrangThaiHopDong: "Đã kết thúc" },
        { TrangThaiHopDong: "Còn hiệu lực" }
    ];
    assert.equal(utils.listSummary("hợp đồng", contracts,
        item => item.TrangThaiHopDong === "Còn hiệu lực", "đang hiệu lực"),
    "Tổng: 3 hợp đồng (2 đang hiệu lực)");
    const services = [
        { HoatDong: true, CanhBao: false },
        { HoatDong: true, CanhBao: true },
        { HoatDong: false, CanhBao: false }
    ];
    assert.equal(utils.listSummary("dịch vụ", services,
        item => item.HoatDong && !item.CanhBao, "đang áp dụng"),
    "Tổng: 3 dịch vụ (1 đang áp dụng)");
    assert.deepEqual(utils.serviceEditMode(false), {
        canAdd: false, canEditRows: false, toggleLabel: "Chỉnh sửa dịch vụ"
    });
    assert.deepEqual(utils.serviceEditMode(true), {
        canAdd: true, canEditRows: true, toggleLabel: "Xem danh sách"
    });
});

test("Admin receipt amount can be rendered in Vietnamese words", () => {
    assert.equal(utils.amountInWords(0), "Không đồng");
    assert.equal(utils.amountInWords(1000000), "Một triệu đồng");
    assert.equal(utils.amountInWords(1250000), "Một triệu hai trăm năm mươi nghìn đồng");
});

test("Admin receipt amount validation prevents exceeding invoice balance", () => {
    assert.equal(utils.exceedsBalance(100, 300), false);
    assert.equal(utils.exceedsBalance(301, 300), true);
    assert.equal(utils.exceedsBalance(0, 300), true);
    assert.equal(utils.exceedsBalance(100, 0), true);
});

test("Admin date format and parse validate calendar dates without timezone conversion", () => {
    assert.equal(utils.date("2026-10-25", "format"), "25/10/2026");
    assert.equal(utils.date("25/10/2026", "parse"), "2026-10-25");
    assert.equal(utils.date("2026-01-01", "format"), "01/01/2026");
    assert.equal(utils.date("2026-01-31", "format"), "31/01/2026");
    assert.equal(utils.date("31/02/2026", "parse"), null);
    assert.equal(utils.date("29/02/2024", "parse"), "2024-02-29");
    assert.equal(utils.date("29/02/2025", "parse"), null);
    assert.equal(utils.date("2026-10-25T00:00:00.000Z", "format"), "25/10/2026");
});

test("Admin date-time rendering preserves the API date portion", () => {
    assert.equal(utils.dateTime("2026-10-25T00:15:00.000Z"), "00:15 25/10/2026");
});

test("Admin shared date normalizer handles compact and slash dates with real calendar and year validation", () => {
    for (const input of ["01022003", "1/2/2003", "01/02/2003"]) {
        assert.equal(utils.normalizeDateInput(input), "01/02/2003");
        assert.equal(utils.date(utils.normalizeDateInput(input), "parse"), "2003-02-01");
    }
    assert.equal(utils.normalizeDateInput("10112005"), "10/11/2005");
    assert.equal(utils.normalizeDateInput("1/2/05"), null);
    assert.equal(utils.normalizeDateInput("30/02/2024"), null);
    assert.equal(utils.normalizeDateInput("31/04/2024"), null);
    assert.equal(utils.normalizeDateInput("01/01/1899"), null);
    assert.equal(utils.normalizeDateInput("01/01/2101"), null);
    assert.equal(utils.normalizeDateInput("31/02/2024"), null);
    assert.equal(utils.validateDateInput("31/02/2024"), "Ngày không hợp lệ");
    assert.equal(utils.normalizeDateInput("29/02/2024"), "29/02/2024");
    assert.equal(utils.normalizeDateInput("29/02/2023"), null);
    assert.equal(utils.normalizeDateInput("01/01/2024"), "01/01/2024");
    assert.equal(utils.normalizeDateInput("31/12/2024"), "31/12/2024");
    assert.match(utils.dateField("Ngày", "ngay", "2026-11-03"), /value="03\/11\/2026"/);
    assert.equal(utils.filterDateInput("1a/02-2003x"), "1/022003");
    assert.equal(utils.validateDateInput("01/01/1899", { minYear: 1900 }), "Ngày không hợp lệ");
    assert.match(utils.validateDateInput("01/01/2027", { maxDate: "2026-12-31" }), /tương lai/);
});

test("Selecting a room resolves its exact tier instead of defaulting to the first tier", () => {
    const rooms = [
        { TenPhong: "A101", MaHangPhong: "HP4" },
        { TenPhong: "A102", MaHangPhong: "HP6" }
    ];
    assert.equal(utils.tierForRoom(rooms, "A101"), "HP4");
    assert.equal(utils.tierForRoom(rooms, "A102"), "HP6");
    assert.equal(utils.tierForRoom(rooms, ""), "");
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    assert.match(source, /form\.elements\.maHangPhong\.value = tier/);
    assert.match(source, /form\.elements\.maHangPhongDisplay\.value = tier/);
    assert.match(source, /maHangPhong: roomTier/);
});

async function setupAdminWorkflowDom({
    financialFixture = false,
    expenseFlow = null,
    contractCreateResponse = null
} = {}) {
    const dom = new JSDOM('<main id="main-content"></main>', {
        runScripts: "outside-only",
        url: "http://localhost/"
    });
    const { window } = dom;
    const calls = [];
    const toasts = [];
    const contracts = [
        {
            MaHopDong: "HD-A", TenPhong: "A101", MaHangPhong: "HP4", SucChuaToiDa: 4,
            TrangThaiHopDong: "Còn hiệu lực",
            sinhVien: [{ MaSinhVien: "MEMBER-A", HoTen: "Thành viên", TrangThai: "Đang ở" }]
        },
        {
            MaHopDong: "HD-B", TenPhong: "A102", MaHangPhong: "HP4", SucChuaToiDa: 4,
            TrangThaiHopDong: "Còn hiệu lực",
            sinhVien: [{ MaSinhVien: "OCCUPIED", HoTen: "Đang ở nơi khác", TrangThai: "Đang ở" }]
        }
    ];
    const students = [
        { MaSinhVien: "MEMBER-A", HoTen: "Thành viên", GioiTinh: "Nữ" },
        { MaSinhVien: "OCCUPIED", HoTen: "Đang ở nơi khác", GioiTinh: "Nữ" },
        { MaSinhVien: "FREE-STUDENT", HoTen: "Sinh viên mới", GioiTinh: "Nữ" },
        { MaSinhVien: "012345678901", HoTen: "Nguyễn Ánh", GioiTinh: "Nữ" },
        { MaSinhVien: "AB12CD34", HoTen: "Bình An", GioiTinh: "Nữ" }
    ];
    const rooms = [
        { TenPhong: "A101", LoaiPhong: "Nữ", MaHangPhong: "HP4", SucChuaToiDa: 4, TrangThaiPhong: "Đang sử dụng" },
        { TenPhong: "A102", LoaiPhong: "Nữ", MaHangPhong: "HP4", SucChuaToiDa: 4, TrangThaiPhong: "Đang sử dụng" },
        { TenPhong: "A103", LoaiPhong: "Nữ", MaHangPhong: "HP4", SucChuaToiDa: 4, TrangThaiPhong: "Trống" }
    ];
    window.AdminWorkflowUtils = {
        ...utils,
        bindDateInputs: () => {},
        enhanceAdminTables: () => {}
    };
    window.BASE_URL = "";
    window.confirm = () => true;
    let openedRequest;
    window.switchPage = (page, menuItem) => { openedRequest = { page, menuItem }; };
    window.showToast = (message, kind) => toasts.push({ message, kind });
    window.ApiClient = {
        fetch: async (url, options = {}) => {
            calls.push({ url, options });
            let body = [];
            if (url === "/api/HopDong" && options.method === "POST" && contractCreateResponse) {
                body = contractCreateResponse;
            } else if (url.startsWith("/api/HopDong")) body = contracts;
            else if (url.startsWith("/api/sinhvien")) body = { data: students, totalPages: 1 };
            else if (url === "/api/Phong") body = rooms;
            else if (url === "/api/HangPhong") body = [];
            else if (financialFixture && url === "/api/HoaDon") body = [{
                MaHoaDon: expenseFlow ? "INV-NEW" : "INV-DOM", MaSinhVien: null, MaHopDong: "HD-A", MaChiTiet: null,
                LoaiHoaDon: "DICH_VU_PHONG", TenPhong: "A101", TenDaiDienDichVu: "Thành viên",
                TongTien: 300, DaThu: 0, ConNo: 300, HanThanhToan: "2026-03-10",
                KyThanhToan: "2026-03-01", TrangThaiThanhToan: "Chưa thanh toán"
            }];
            else if (financialFixture && ["/api/HoaDon/INV-DOM", "/api/HoaDon/INV-NEW"].includes(url)) body = {
                MaHoaDon: url.endsWith("INV-NEW") ? "INV-NEW" : "INV-DOM", MaSinhVien: null, MaHopDong: "HD-A", MaChiTiet: null,
                LoaiHoaDon: "DICH_VU_PHONG", TenPhong: "A101", TenDaiDienDichVu: "Thành viên",
                TongTien: 300, DaThu: 0, ConNo: 300, HanThanhToan: "2026-03-10",
                KyThanhToan: "2026-03-01", TrangThaiThanhToan: "Chưa thanh toán",
                ChiTiet: [{ MaChiTiet: "LINE-1", TenKhoan: "Điện", SoTien: 300 }],
                PhieuThu: []
            };
            else if (financialFixture && url === "/api/payments/history") body = [{
                MaGiaoDich: "PAY-TEST-1", MaHoaDon: "INV-DOM", MaPhieuThu: 901,
                MaSinhVien: "012345678901",
                TenPhong: "A101", HoTen: "Nguyễn An Với Tên Hiển Thị Thật Dài", SoTien: 100, PhuongThuc: "ONLINE",
                TongTien: 100, SoTienYeuCau: 100, SoTienThucNhan: null,
                TrangThai: "PENDING", TrangThaiPhieuThu: "Chờ xác nhận", NgayTao: "2026-03-01"
            }, {
                MaGiaoDich: "PAY-RECON", MaHoaDon: "INV-DOM", MaPhieuThu: 902,
                MaSinhVien: "AB12CD34",
                TenPhong: "T5-/67EB123/F-A", HoTen: "Sinh viên thử nghiệm", SoTien: 100, TongTien: 100, PhuongThuc: "ONLINE",
                SoTienYeuCau: 100, SoTienThucNhan: 90,
                TrangThai: "RECONCILIATION", TrangThaiPhieuThu: "Chờ xác nhận", NgayTao: "2026-03-02",
                LyDoDoiSoat: "Số tiền hoặc nội dung chuyển khoản không khớp."
            }, {
                MaGiaoDich: "PAY-LONG", MaHoaDon: "INV-DOM", MaPhieuThu: 903,
                MaSinhVien: "IDENTIFIERWITHOUTSPACES123456789",
                TenPhong: "ROOMWITHOUTSPACES123456789", HoTen: "NguyenVanAnWithoutAnySpacesABCDEFGHIJKLMNOPQRSTUVWXYZ",
                SoTien: 80, PhuongThuc: "ONLINE", TongTien: 80, SoTienYeuCau: 80,
                SoTienThucNhan: null, TrangThai: "RECONCILIATION",
                TrangThaiPhieuThu: "Hợp lệ", NgayTao: "2026-03-03T08:30:00"
            }, {
                MaGiaoDich: "PAY-AUTO", MaHoaDon: "INV-DOM", MaPhieuThu: 904,
                MaSinhVien: "AUTOSTUDENT", TenPhong: "A101", HoTen: "Sinh viên QR đã xác nhận",
                SoTien: 50, PhuongThuc: "ONLINE", TrangThai: "SUCCESS",
                TongTien: 50, SoTienYeuCau: 50, SoTienThucNhan: 55,
                SoTienDu: 5, TrangThaiHoanDu: "CHO_HOAN",
                TrangThaiPhieuThu: "Hợp lệ", NgayTao: "2026-03-04T09:15:00"
            }, {
                MaGiaoDich: "PAY-QR-PAID", MaHoaDon: "INV-DOM", MaPhieuThu: 907,
                MaSinhVien: "QRPAIDSTUDENT", TenPhong: "A101", HoTen: "Sinh viên QR đã thanh toán",
                SoTien: 60, PhuongThuc: "ONLINE", TrangThai: "SUCCESS",
                TongTien: 60, SoTienYeuCau: 60, SoTienThucNhan: 60,
                TrangThaiPhieuThu: "Hợp lệ", NgayTao: "2026-03-07T09:15:00"
            }, {
                MaGiaoDich: "PAY-RETURNED", MaHoaDon: "INV-DOM", MaPhieuThu: 906,
                MaSinhVien: "RETURNED-STUDENT", TenPhong: "A101", HoTen: "Sinh viên đã nhận hoàn tiền",
                SoTien: 50, PhuongThuc: "ONLINE", TongTien: 50, SoTienYeuCau: 50,
                SoTienThucNhan: 55, SoTienDu: 5, TrangThaiHoanDu: "DA_HOAN",
                TrangThai: "SUCCESS", TrangThaiPhieuThu: "Hợp lệ", NgayTao: "2026-03-06T09:15:00"
            }];
            else if (financialFixture && url === "/api/phieuchi") body = [{
                MaPhieuChi: 49, MaChiTiet: "CT-49", SoTienDaDong: 1200000,
                SoTienDaSuDung: 560000, KhauTru: 0, SoTien: 640000,
                NgayRa: "2026-10-14", LyDo: "Trả phòng sớm", TrangThai: "Chờ xác nhận",
                NgayChi: "2026-10-14", MaSinhVien: "SV-49", HoTen: "Sinh viên trả phòng",
                GhiChu: "Gợi ý 0.00; Hoàn tiền theo ngày, yêu cầu YC00049", SoNgayDaO: 14
            }];
            else if (financialFixture && url === "/api/phieuthu") body = [{
                MaPhieuThu: 901, MaHoaDon: "INV-DOM", MaGiaoDich: "PAY-TEST-1",
                MaSinhVienNop: "012345678901", TenPhong: "A101",
                TenNguoiNop: "Nguyễn An Với Tên Hiển Thị Thật Dài", SoTien: 100,
                PhuongThuc: "ONLINE", TrangThai: "Chờ xác nhận", NgayThu: "2026-03-01"
            }, {
                MaPhieuThu: 902, MaHoaDon: "INV-DOM", MaGiaoDich: "PAY-RECON",
                MaSinhVienNop: "AB12CD34", TenPhong: "T5-/67EB123/F-A",
                TenNguoiNop: "Sinh viên thử nghiệm", SoTien: 100,
                PhuongThuc: "ONLINE", TrangThai: "Chờ xác nhận", NgayThu: "2026-03-02"
            }, {
                MaPhieuThu: 903, MaHoaDon: "INV-DOM", MaGiaoDich: "PAY-LONG",
                MaSinhVienNop: "IDENTIFIERWITHOUTSPACES123456789", TenPhong: "ROOMWITHOUTSPACES123456789",
                TenNguoiNop: "NguyenVanAnWithoutAnySpacesABCDEFGHIJKLMNOPQRSTUVWXYZ", SoTien: 80,
                PhuongThuc: "ONLINE", TrangThai: "Hợp lệ", NgayThu: "2026-03-03T08:30:00"
            }, {
                MaPhieuThu: 904, MaHoaDon: "INV-DOM", MaGiaoDich: "PAY-AUTO",
                MaSinhVienNop: "AUTOSTUDENT", TenPhong: "A101", TenNguoiNop: "Sinh viên QR đã xác nhận",
                SoTien: 50, PhuongThuc: "ONLINE", TrangThai: "Hợp lệ", NgayThu: "2026-03-04T09:15:00"
            }, {
                MaPhieuThu: 905, MaHoaDon: "INV-DOM", MaGiaoDich: null,
                MaSinhVienNop: "SV-CASH", TenPhong: "A101", TenNguoiNop: "Sinh viên nộp tiền mặt",
                SoTien: 40, PhuongThuc: "CASH", TrangThai: "Hợp lệ", NgayThu: "2026-03-05T10:00:00"
            }, {
                MaPhieuThu: 907, MaHoaDon: "INV-DOM", MaGiaoDich: "PAY-QR-PAID",
                MaSinhVienNop: "QRPAIDSTUDENT", TenPhong: "A101", TenNguoiNop: "Sinh viên QR đã thanh toán",
                SoTien: 60, PhuongThuc: "ONLINE", TrangThai: "Hợp lệ", NgayThu: "2026-03-07T09:15:00"
            }, {
                MaPhieuThu: 906, MaHoaDon: "INV-DOM", MaGiaoDich: "PAY-RETURNED",
                MaSinhVienNop: "RETURNED-STUDENT", TenPhong: "A101", TenNguoiNop: "Sinh viên đã nhận hoàn tiền",
                SoTien: 50, PhuongThuc: "ONLINE", TrangThai: "Hợp lệ", NgayThu: "2026-03-06T09:15:00"
            }];
            else if (expenseFlow && url === "/api/ChiPhiPhatSinh") body = [{
                MaChiPhi: 1, MaHopDong: "HD-A", MaChiTiet: 1, NoiDung: "Sửa vòi nước",
                SoTien: 300, NgayPhatSinh: "2026-03-01", HanDong: "2026-03-08",
                TrangThai: "Chưa lập hóa đơn"
            }];
            if (expenseFlow && url === "/api/ChiPhiPhatSinh/1/tao-hoa-don"
                && expenseFlow.fail) {
                return { ok: false, status: 500, json: async () => ({ message: "Lỗi lập hóa đơn thật." }) };
            }
            if (expenseFlow && url === "/api/ChiPhiPhatSinh/1/tao-hoa-don") {
                return { ok: true, status: 201, json: async () => ({ success: true, MaHoaDon: "INV-NEW" }) };
            }
            return { ok: true, status: 200, json: async () => body };
        }
    };
    const workflowSource = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    window.eval(workflowSource);
    window.renderHopDongModule();
    await window.loadHopDong();
    return { dom, window, calls, toasts, get openedRequest() { return openedRequest; } };
}

async function waitForDom(predicate) {
    for (let attempt = 0; attempt < 30; attempt++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    assert.fail("DOM workflow did not reach the expected state");
}

test("Incident expense form aligns date controls and gives inline Vietnamese amount errors", async () => {
    const { dom, window, calls } = await setupAdminWorkflowDom({ financialFixture: true });
    try {
        await window.renderHoaDonModule();
        window.document.querySelector('[data-action="invoice-tab"][data-tab="expenses"]').click();
        window.document.querySelector('[data-action="expense-create-open"]').click();
        const form = window.document.querySelector('form[data-form="expense-create"]');
        assert.ok(form);
        const dialog = form.closest('[role="dialog"]');
        assert.ok(dialog.classList.contains("admin-expense-dialog"));
        const amount = form.querySelector('[data-expense-amount]');
        assert.ok(amount);
        assert.equal(amount.required, false);
        assert.match(form.querySelector("label").textContent, /Hợp đồng/);
        assert.doesNotMatch(form.textContent, /tối đa 50\.000\.000/);
        const dateLabels = [...form.querySelectorAll(".admin-expense-date-field")];
        assert.equal(dateLabels.length, 2);
        assert.deepEqual(dateLabels.map(label => label.firstElementChild.textContent.trim()),
            ["Ngày phát sinh *", "Hạn đóng *"]);
        assert.ok(dateLabels.every(label => label.querySelector("[data-admin-date]")?.type === "text"
            && label.querySelector('[data-action="date-picker-open"]')
            && label.querySelector("[data-date-picker]")));
        assert.deepEqual([...form.children].map(element => element.matches(".admin-expense-note")
            ? "Ghi chú" : element.querySelector("[name]")?.name),
        ["maHopDong", "maChiTiet", "cheDoLap", "noiDung", "soTien", "ngayPhatSinh", "hanDong", "Ghi chú"]);
        assert.ok([...form.children].every(element => element.classList.contains("admin-expense-field")));
        assert.ok([...form.querySelectorAll("select, input:not([type=date]), textarea")]
            .filter(control => control.name)
            .every(control => control.classList.contains("admin-expense-control")));
        assert.equal(form.querySelector(".admin-expense-date-field").style.gridColumn, "");
        assert.equal(form.querySelector('[name="hanDong"]').closest(".admin-expense-field").style.gridColumn, "");
        assert.match(form.querySelector(".admin-expense-note").className, /admin-expense-note/);
        assert.equal(form.querySelector(".admin-expense-note textarea").getAttribute("maxlength"), "255");
        const styles = fs.readFileSync(path.join(__dirname, "..", "..", "style.css"), "utf8");
        const style = window.document.createElement("style");
        style.textContent = styles;
        window.document.head.append(style);
        assert.match(styles, /\.admin-expense-form\s*\{[^}]*align-items:\s*start;[^}]*column-gap:\s*16px;[^}]*row-gap:\s*16px/);
        assert.match(styles, /\.admin-expense-field\s*\{[^}]*margin:\s*0;[^}]*font-size:\s*14px;[^}]*font-weight:\s*600/);
        assert.match(styles, /\.admin-expense-field > span:first-child\s*\{\s*display:\s*block;\s*margin:\s*0 0 6px;/);
        assert.match(styles, /\.admin-expense-control\s*\{[^}]*height:\s*42px;[^}]*min-height:\s*0;\s*margin:\s*0/);
        assert.match(styles, /\.admin-expense-date-control \[data-action="date-picker-open"\]\s*\{[^}]*height:\s*42px/);
        assert.match(styles, /\.admin-expense-date-error,\s*\.admin-expense-field-error\s*\{\s*display:\s*none;\s*margin:\s*4px 0 0;/);
        assert.match(styles, /\.admin-expense-date-error:not\(:empty\),\s*\.admin-expense-field-error:not\(:empty\)\s*\{\s*display:\s*block;/);
        assert.match(styles, /\.admin-expense-form \.admin-expense-note\s*\{\s*grid-column:\s*1 \/ -1;/);
        assert.match(styles, /\.admin-expense-form \.admin-expense-note textarea\s*\{[^}]*height:\s*72px;[^}]*padding:\s*8px 12px;[^}]*resize:\s*vertical/);
        assert.match(styles, /\.admin-expense-dialog > footer\s*\{\s*margin-top:\s*16px;\s*padding-top:\s*16px;/);
        assert.match(styles, /\.admin-expense-dialog > \[data-modal-error\]:empty\s*\{\s*display:\s*none;/);
        const fieldLabels = [...form.querySelectorAll(":scope > .admin-expense-field")];
        assert.ok(fieldLabels.every(label => window.getComputedStyle(label).fontSize === "14px"
            && window.getComputedStyle(label).fontWeight === "600"));
        assert.ok(fieldLabels.every(label => window.getComputedStyle(label.firstElementChild).marginBottom === "6px"));
        assert.equal(window.getComputedStyle(form).alignItems, "start");
        assert.equal(window.getComputedStyle(form).columnGap, "16px");
        assert.equal(window.getComputedStyle(form).rowGap, "16px");
        const controls = [...form.querySelectorAll(".admin-expense-control")];
        assert.equal(controls.length, 8);
        assert.ok(controls.filter(control => control.tagName !== "TEXTAREA")
            .every(control => window.getComputedStyle(control).height === "42px"));
        assert.equal(window.getComputedStyle(form.querySelector(".admin-expense-date-control [data-action='date-picker-open']")).height, "42px");
        assert.equal(window.getComputedStyle(form.querySelector(".admin-expense-note textarea")).height, "72px");
        assert.equal(window.getComputedStyle(form.querySelector(".admin-expense-note textarea")).marginTop, "0px");
        assert.equal(window.getComputedStyle(form.querySelector(".admin-expense-date-error")).display, "none");
        assert.equal(window.getComputedStyle(form.querySelector(".admin-expense-field-error")).display, "none");

        amount.value = String(utils.MAX_INCIDENT_EXPENSE_VND + 1);
        amount.dispatchEvent(new window.Event("input", { bubbles: true }));
        assert.match(form.querySelector("[data-expense-amount-error]").textContent, /Không được vượt 50\.000\.000 đ/);
        amount.value = "";
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        assert.equal(form.querySelector("[data-expense-amount-error]").textContent, "Vui lòng nhập số tiền");
        assert.equal(calls.some(call => call.url === "/api/ChiPhiPhatSinh" && call.options.method === "POST"), false);
    } finally {
        dom.window.close();
    }
});

test("Admin revenue report keeps month and amount columns on one line inside a horizontal scroller", async () => {
    const { dom, window } = await setupAdminWorkflowDom();
    try {
        const originalFetch = window.ApiClient.fetch;
        window.ApiClient.fetch = async (url, options) => {
            if (url.startsWith("/api/doanhthu/")) {
                return {
                    ok: true, status: 200,
                    json: async () => ({
                        thang: Array.from({ length: 12 }, (_, index) => ({
                            Nam: 2026, Thang: index + 1,
                            ThuTienPhong: 1234567, ChiTienPhong: 0, DoanhThuTienPhong: 1234567,
                            ThuDichVu: 0, ChiDichVu: 0, DoanhThuDichVu: 0,
                            ThuPhatSinh: 0, ChiPhatSinh: 0, DoanhThuPhatSinh: 0,
                            TongThu: 1234567, TongChi: 0, TongDoanhThu: 1234567
                        }))
                    })
                };
            }
            if (url === "/api/congno") return { ok: true, status: 200, json: async () => [] };
            return originalFetch(url, options);
        };
        const style = window.document.createElement("style");
        style.textContent = fs.readFileSync(path.join(__dirname, "..", "..", "style.css"), "utf8");
        window.document.head.append(style);
        await window.renderBaoCaoThongKeModule();
        const wrapper = window.document.querySelector("[data-report-revenue]");
        const table = wrapper.querySelector(".admin-report-table");
        assert.ok(table);
        assert.equal(wrapper.dataset.noAdminFilters, "");
        assert.equal(window.getComputedStyle(wrapper).overflowX, "auto");
        assert.match(table.textContent, /10\/2026/);
        assert.equal(window.getComputedStyle(table).tableLayout, "auto");
        const styles = fs.readFileSync(path.join(__dirname, "..", "..", "style.css"), "utf8");
        assert.match(styles, /\.admin-report-table th,\s*\.admin-report-table td\s*\{\s*white-space:\s*nowrap;/);
    } finally {
        dom.window.close();
    }
});

test("Admin contract and member-add popups render conflict warning and open the selected student's move form in DOM", async () => {
    const { dom, window } = await setupAdminWorkflowDom();
    try {
        window.document.querySelector('[data-action="contract-create"]').click();
        await waitForDom(() => window.document.querySelector('form[data-form="contract-create"]'));
        const createForm = window.document.querySelector('form[data-form="contract-create"]');
        const createStudent = createForm.querySelector('[data-student-search]');
        createStudent.value = "OCCUPIED";
        createStudent.dispatchEvent(new window.Event("input", { bubbles: true }));
        assert.ok(createForm.querySelector('[data-student-option="OCCUPIED"]'));
        createForm.querySelector('[data-student-option="OCCUPIED"]').click();
        const createAlert = createForm.querySelector("[data-student-conflict]");
        assert.match(createAlert.textContent, /đang ở phòng A102 \(hợp đồng HD-B\)/);
        assert.equal(window.document.querySelector('button[form="admin-workflow-form"][type="submit"]').disabled, true);
        createAlert.querySelector('[data-action="member-move"]').click();
        await waitForDom(() => window.document.querySelector('form[data-form="member-move"]'));
        assert.equal(window.document.querySelector('[name="maSinhVien"]').value, "OCCUPIED");

        window.document.querySelector('[data-action="modal-close"]').click();
        window.document.querySelector('[data-detail-type="contract"][data-detail-id="HD-A"]').click();
        await waitForDom(() => window.document.querySelector('[data-action="member-add"]'));
        window.document.querySelector('[data-action="member-add"]').click();
        await waitForDom(() => window.document.querySelector('form[data-form="member-add"]'));
        const addForm = window.document.querySelector('form[data-form="member-add"]');
        const addStudent = addForm.querySelector('[name="maSinhVien"]');
        assert.ok([...addStudent.options].some(option => option.value === "OCCUPIED"));
        addStudent.value = "OCCUPIED";
        addStudent.dispatchEvent(new window.Event("change", { bubbles: true }));
        assert.match(addForm.querySelector("[data-student-conflict]").textContent,
            /đang ở phòng A102 \(hợp đồng HD-B\)/);
        assert.equal(window.document.querySelector('button[form="admin-workflow-form"][type="submit"]').disabled, true);
        addForm.querySelector('[data-student-conflict] [data-action="member-move"]').click();
        await waitForDom(() => window.document.querySelector('form[data-form="member-move"]'));
        assert.equal(window.document.querySelector('[name="maSinhVien"]').value, "OCCUPIED");
    } finally {
        dom.window.close();
    }
});

test("Contract student combobox searches names and identifiers, excludes selected students, and submits full IDs", async () => {
    const { dom, window, calls } = await setupAdminWorkflowDom({
        contractCreateResponse: { success: true, MaHopDong: "HD-NEW" }
    });
    try {
        window.document.querySelector('[data-action="contract-create"]').click();
        await waitForDom(() => window.document.querySelector('form[data-form="contract-create"]'));
        const form = window.document.querySelector('form[data-form="contract-create"]');
        const firstRow = form.querySelector(".member-row");
        const search = firstRow.querySelector("[data-student-search]");
        const removeButton = firstRow.querySelector('[data-action="remove-member-row"]');
        assert.ok(removeButton.classList.contains("shrink-0"));
        assert.ok(removeButton.classList.contains("whitespace-nowrap"));
        assert.match(firstRow.querySelector(".grid").className, /minmax\(0,1fr\)/);
        assert.equal(search.getAttribute("aria-label").includes("Số CCCD hoặc hộ chiếu"), true);

        search.value = "nguyen anh";
        search.dispatchEvent(new window.Event("input", { bubbles: true }));
        assert.deepEqual([...firstRow.querySelectorAll('[data-student-option]')]
            .map(option => option.dataset.studentOption), ["012345678901"]);
        search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        assert.ok(firstRow.querySelector("[data-student-options]").classList.contains("hidden"));
        assert.equal(search.getAttribute("aria-expanded"), "false");
        assert.equal(window.document.querySelector("[data-admin-modal]").classList.contains("hidden"), false);
        search.value = "012345678901";
        search.dispatchEvent(new window.Event("input", { bubbles: true }));
        assert.equal(firstRow.querySelectorAll('[data-student-option]').length, 1);
        search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        assert.ok(search.getAttribute("aria-activedescendant"));
        search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        assert.equal(firstRow.querySelector('[name="maSinhVien"]').value, "012345678901");
        assert.equal(search.value, "Nguyễn Ánh · 0123****8901");

        window.document.querySelector('[data-action="add-member-row"]').click();
        const rows = [...form.querySelectorAll(".member-row")];
        const secondRow = rows[1];
        const secondSearch = secondRow.querySelector("[data-student-search]");
        secondSearch.value = "AB12CD34";
        secondSearch.dispatchEvent(new window.Event("input", { bubbles: true }));
        assert.deepEqual([...secondRow.querySelectorAll('[data-student-option]')]
            .map(option => option.dataset.studentOption), ["AB12CD34"]);
        secondRow.querySelector('[data-student-option="AB12CD34"]').click();
        assert.equal(secondRow.querySelector("[data-student-search]").value, "Bình An · AB****34");

        window.document.querySelector('[data-action="add-member-row"]').click();
        const thirdRow = form.querySelectorAll(".member-row")[2];
        const thirdSearch = thirdRow.querySelector("[data-student-search]");
        thirdSearch.value = "012345678901";
        thirdSearch.dispatchEvent(new window.Event("input", { bubbles: true }));
        assert.equal(thirdRow.querySelectorAll('[data-student-option="012345678901"]').length, 0);

        form.elements.tenPhong.value = "A103";
        form.elements.tenPhong.dispatchEvent(new window.Event("change", { bubbles: true }));
        form.elements.ngayBatDau.value = "01/03/2026";
        form.elements.ngayKetThuc.value = "01/03/2027";
        assert.match(form.elements.ngayBatDau.className, /w-full.*min-w-0/);
        assert.match(form.elements.ngayKetThuc.className, /w-full.*min-w-0/);
        window.document.querySelector('button[form="admin-workflow-form"][type="submit"]').click();
        await waitForDom(() => calls.some(call => call.url === "/api/HopDong" && call.options.method === "POST"));
        const body = JSON.parse(calls.find(call =>
            call.url === "/api/HopDong" && call.options.method === "POST").options.body);
        assert.deepEqual(body.sinhVien.map(member => member.maSinhVien), ["012345678901", "AB12CD34"]);

        const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
        assert.match(source, /\.slice\(0, 8\)/);
    } finally {
        dom.window.close();
    }
});

test("Member-add popup DOM submit calls the contract member endpoint", async () => {
    const { dom, window, calls } = await setupAdminWorkflowDom();
    try {
        window.document.querySelector('[data-detail-type="contract"][data-detail-id="HD-A"]').click();
        await waitForDom(() => window.document.querySelector('[data-action="member-add"]'));
        window.document.querySelector('[data-action="member-add"]').click();
        await waitForDom(() => window.document.querySelector('form[data-form="member-add"]'));
        const form = window.document.querySelector('form[data-form="member-add"]');
        form.elements.maSinhVien.value = "FREE-STUDENT";
        form.elements.maSinhVien.dispatchEvent(new window.Event("change", { bubbles: true }));
        window.document.querySelector('button[form="admin-workflow-form"][type="submit"]').click();
        await waitForDom(() => calls.some(call => call.url === "/api/HopDong/HD-A/chitiet" && call.options.method === "POST"));
        const post = calls.find(call => call.url === "/api/HopDong/HD-A/chitiet" && call.options.method === "POST");
        assert.deepEqual(JSON.parse(post.options.body), {
            maSinhVien: "FREE-STUDENT", kyHanThanhToanPhong: "THANG", laNguoiDaiDien: false
        });
    } finally {
        dom.window.close();
    }
});

test("Admin navigation removes the separate receipt menu and polling badge", () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, "..", "..", "Admin.html"), "utf8");
    const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
    const login = fs.readFileSync(path.join(__dirname, "Login.js"), "utf8");
    assert.doesNotMatch(adminHtml, /pending-receipt-count|switchPage\('Thanh Toan'/);
    assert.doesNotMatch(script, /AdminPendingReceiptPolling|refreshAdminPendingReceiptCount|setInterval|Thanh Toan/);
    assert.doesNotMatch(login, /AdminPendingReceiptPolling|refreshAdminPendingReceiptCount/);
});

test("Admin invoice page contains the receipt tab without a separate receipt page", async () => {
    const { dom, window } = await setupAdminWorkflowDom();
    try {
        await window.renderHoaDonModule();
        await waitForDom(() => window.document.querySelector("[data-invoice-table] thead th"));
        const headers = [...window.document.querySelectorAll("[data-invoice-table] thead th")]
            .map(header => header.textContent.trim());
        assert.ok(headers.includes("Phòng"));
        assert.ok(headers.includes("Hợp đồng"));
        assert.equal(headers.includes("Phòng / hợp đồng"), false);

        assert.ok([...window.document.querySelectorAll("[data-financial-tabs] button")]
            .some(tab => tab.textContent.trim() === "Phiếu thu"));
        assert.equal(window.renderThanhToanDemoModule, undefined);
    } finally {
        dom.window.close();
    }
});

test("Admin receipt table excludes discrepancy transactions and opens valid receipt details", async () => {
    const { dom, window } = await setupAdminWorkflowDom({ financialFixture: true });
    try {
        await window.renderHoaDonModule();
        window.document.querySelector('[data-action="invoice-tab"][data-tab="receipts"]').click();
        await waitForDom(() => window.document.querySelector('[data-receipt-table] tbody tr td'));
        const table = window.document.querySelector("[data-receipt-table]");
        assert.ok(window.document.querySelector('[data-action="payments-refresh"]'));
        assert.equal(window.document.querySelector('[data-action="payments-refresh"]').textContent.trim(), "↻");
        const statusFilter = window.document.querySelector('[data-form="financial-filter"] [name="status"]');
        assert.equal(statusFilter.value, "ALL");
        assert.deepEqual([...statusFilter.options].map(option => option.textContent), ["Tất cả", "Đã thanh toán"]);
        assert.match(table.textContent, /INV-DOM/);
        assert.equal(table.querySelector("table").style.tableLayout, "fixed");
        assert.equal(table.querySelectorAll("colgroup col").length, 7);
        assert.match(table.querySelector("thead").textContent, /Mã hóa đơn\s*Phòng\s*Người nộp\s*Số tiền\s*Phương thức\s*Thời điểm\s*Trạng thái/);
        assert.doesNotMatch(table.querySelector("thead").textContent, /Thao tác/);
        assert.ok(table.querySelector("colgroup col:nth-child(2)").style.width === "150px");
        assert.equal(table.querySelectorAll("tbody tr").length, 2);
        assert.equal(table.textContent.includes("PAY-TEST-1"), false);
        assert.equal(table.textContent.includes("PAY-LONG"), false);
        assert.equal(table.textContent.includes("012345678901"), false);
        assert.equal(table.textContent.includes("AB12CD34"), false);
        assert.doesNotMatch(table.textContent, /Chờ xác nhận|Đã từ chối|Cần đối soát|Lệch số tiền|tự động|đối chiếu|sao kê|PAY-RECON|PAY-AUTO|PAY-RETURNED/);
        assert.equal(table.querySelectorAll('[data-action="receipt-reject-open"]').length, 0);
        const exactRow = table.querySelector('tbody tr[data-receipt-row="905"]');
        assert.ok(exactRow);
        assert.match(exactRow.cells[3].textContent, /40\s*đ/);
        assert.match(exactRow.cells[6].textContent, /Đã thanh toán/);
        const qrRow = table.querySelector('tbody tr[data-receipt-row="907"]');
        assert.ok(qrRow);
        assert.match(qrRow.cells[4].textContent, /Chuyển khoản QR/);
        assert.match(qrRow.cells[6].textContent, /Đã thanh toán/);
        assert.equal(table.querySelectorAll("tbody tr button").length, 0);
        assert.equal(window.document.querySelector('[data-financial-summary="receipts"]').textContent.includes("cần xử lý"), false);

        exactRow.click();
        await waitForDom(() => window.document.querySelector('[data-admin-drawer] [role="dialog"]'));
        const detail = window.document.querySelector("[data-admin-drawer]");
        assert.equal(detail.querySelectorAll("dt").length, 6);
        for (const label of ["Mã giao dịch", "Hóa đơn/phòng", "Người nộp",
            "Phương thức", "Thời điểm", "Trạng thái"]) {
            assert.ok([...detail.querySelectorAll("dt")].some(item => item.textContent === label), label);
        }
        assert.doesNotMatch(detail.textContent, /Đã trả lại|hoàn trả|chênh lệch/i);
        assert.equal(detail.querySelector('[data-action="surplus-return-open"]'), null);
        assert.equal([...window.document.querySelectorAll("[data-financial-tabs] button")]
            .some(tab => tab.textContent.includes("Giao dịch")), false);
    } finally {
        dom.window.close();
    }
});

test("Admin refund table and detail show paid/refunded amounts and readable early-checkout notes", async () => {
    const { dom, window } = await setupAdminWorkflowDom({ financialFixture: true });
    try {
        await window.renderHoaDonModule();
        window.document.querySelector('[data-action="invoice-tab"][data-tab="refunds"]').click();
        await waitForDom(() => window.document.querySelector("[data-refund-table] tbody tr td"));
        const table = window.document.querySelector("[data-refund-table]");
        const headers = [...table.querySelectorAll("thead th")].map(cell => cell.textContent.trim());
        assert.ok(headers.includes("Đã đóng"));
        assert.ok(headers.includes("Đã hoàn"));
        assert.equal(headers.includes("Đã dùng"), false);
        assert.equal(headers.includes("Khấu trừ"), false);
        assert.match(table.textContent, /1\.200\.000/);
        assert.match(table.textContent, /640\.000/);

        table.querySelector('[data-detail-type="refund"]').click();
        await waitForDom(() => window.document.querySelector("[data-admin-drawer]")?.textContent.includes("YC00049"));
        const popup = window.document.querySelector("[data-admin-drawer]");
        assert.match(popup.textContent, /Đã đóng/);
        assert.match(popup.textContent, /Đã hoàn/);
        assert.match(popup.textContent, /Trả phòng sớm theo yêu cầu YC00049: ở 14 ngày, hoàn 640\.000 đ/);
        assert.doesNotMatch(popup.textContent, /Đã dùng|Khấu trừ|Gợi ý 0\.00/);
    } finally {
        dom.window.close();
    }
});

test("Admin receipt UI keeps discrepancy transactions and return controls hidden", async () => {
    const { dom, window, calls } = await setupAdminWorkflowDom({ financialFixture: true });
    try {
        await window.renderHoaDonModule();
        window.document.querySelector('[data-action="invoice-tab"][data-tab="receipts"]').click();
        await waitForDom(() => window.document.querySelector('[data-receipt-row="905"]'));
        const table = window.document.querySelector("[data-receipt-table]");
        assert.equal(table.querySelector('[data-receipt-row="902"]'), null);
        assert.equal(table.querySelector('[data-receipt-row="903"]'), null);
        assert.equal(table.querySelector('[data-receipt-row="904"]'), null);
        assert.equal(table.querySelector('[data-receipt-row="906"]'), null);
        assert.equal(window.document.querySelector('[data-action="surplus-return-open"]'), null);
        assert.equal(window.document.querySelector('[data-action="surplus-return-submit"]'), null);
        assert.equal(calls.some(call => call.url.includes("/surplus/")), false);
    } finally {
        dom.window.close();
    }
});

test("Receipt and invoice payment views expose no confirmation or rejection controls", async () => {
    const { dom, window, calls } = await setupAdminWorkflowDom({ financialFixture: true });
    try {
        await window.renderHoaDonModule();
        window.document.querySelector('[data-action="invoice-tab"][data-tab="receipts"]').click();
        await waitForDom(() => window.document.querySelector('[data-receipt-row="905"]'));
        const receiptRow = window.document.querySelector('[data-receipt-row="905"]');
        assert.equal(receiptRow.querySelectorAll("button").length, 0);
        receiptRow.click();
        await waitForDom(() => window.document.querySelector('[data-admin-drawer] [role="dialog"]'));
        const receiptDetail = window.document.querySelector("[data-admin-drawer]");
        assert.equal(receiptDetail.querySelector('[data-action="receipt-confirm"]'), null);
        assert.equal(receiptDetail.querySelector('[data-action="receipt-reject-open"]'), null);
        assert.equal([...receiptDetail.querySelectorAll("button")].some(button =>
            /^(Xác nhận|Từ chối)$/.test(button.textContent.trim())), false);
        assert.equal(calls.some(call => call.url.includes("/xac-nhan") || call.url.endsWith("/huy")), false);
    } finally {
        dom.window.close();
    }
});

test("Admin invoice detail provides direct cash collection defaulted to the outstanding balance", async () => {
    const { dom, window } = await setupAdminWorkflowDom({ financialFixture: true });
    try {
        await window.renderHoaDonModule();
        await waitForDom(() => window.document.querySelector('[data-invoice-table] tbody tr[data-detail-id="INV-DOM"]'));
        window.document.querySelector('[data-invoice-table] tbody tr[data-detail-id="INV-DOM"]').click();
        await waitForDom(() => window.document.querySelector('[data-admin-drawer] [data-form="receipt-create"]'));
        const drawer = window.document.querySelector("[data-admin-drawer]");
        const form = drawer.querySelector('[data-form="receipt-create"]');
        assert.match(drawer.textContent, /Lịch sử thanh toán/);
        assert.equal(drawer.querySelector('[data-action="receipt-confirm"]'), null);
        assert.equal(drawer.querySelector('[data-action="receipt-reject-open"]'), null);
        assert.doesNotMatch(drawer.textContent, /Chờ xác nhận|Đã từ chối|Lệch số tiền|PAY-RECON|RECONCILIATION|Cần đối soát/);
        const history = drawer.querySelector("h4:nth-of-type(3)")?.nextElementSibling;
        const reconciliationPayment = [...(history?.querySelectorAll("tbody tr") || [])]
            .find(row => row.textContent.includes("PAY-RECON"));
        assert.equal(reconciliationPayment, undefined);
        assert.match(drawer.textContent, /Cả phòng · Thành viên/);
        assert.equal(form.elements.phuongThuc, undefined);
        assert.equal(form.elements.maThamChieu, undefined);
        assert.match(form.textContent, /Thu tiền mặt/);
        assert.equal(form.elements.soTien.value, "300");
        assert.equal(drawer.textContent.includes("PAY-TEST-1"), true);
        assert.equal(drawer.textContent.includes("INV-DOM"), true);
        assert.match(drawer.textContent, /Hạn thanh toán:\s*10\/03\/2026/);
        assert.match(drawer.textContent, /Tổng:\s*300/);
        assert.equal(drawer.textContent.includes("— → —"), false);
    } finally {
        dom.window.close();
    }
});

test("Admin cash collection warns in the invoice drawer and never submits a mismatched amount", async () => {
    const { dom, window, calls } = await setupAdminWorkflowDom({ financialFixture: true });
    try {
        await window.renderHoaDonModule();
        await waitForDom(() => window.document.querySelector('[data-invoice-table] tbody tr[data-detail-id="INV-DOM"]'));
        window.document.querySelector('[data-invoice-table] tbody tr[data-detail-id="INV-DOM"]').click();
        await waitForDom(() => window.document.querySelector('[data-admin-drawer] [data-form="receipt-create"]'));
        const form = window.document.querySelector('[data-form="receipt-create"]');
        const amount = form.elements.soTien;
        const warning = form.querySelector("[data-cash-amount-warning]");
        const submits = () => calls.filter(call =>
            call.url === "/api/HoaDon/INV-DOM/phieuthu" && call.options.method === "POST").length;

        amount.value = "299";
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        await new Promise(resolve => setImmediate(resolve));
        assert.match(warning.textContent, /Bạn nhập thiếu 1\s*đ so với số tiền cần nộp \(300\s*đ\)/);
        assert.equal(warning.classList.contains("hidden"), false);
        assert.equal(submits(), 0);

        amount.value = "301";
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        await new Promise(resolve => setImmediate(resolve));
        assert.match(warning.textContent, /Bạn nhập dư 1\s*đ so với số tiền cần nộp \(300\s*đ\)/);
        assert.equal(submits(), 0);

        amount.value = "";
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        await new Promise(resolve => setImmediate(resolve));
        assert.match(warning.textContent, /Vui lòng nhập số tiền nguyên VND hợp lệ/);
        assert.equal(submits(), 0);
    } finally {
        dom.window.close();
    }
});

test("Incident invoice DOM closes and switches to the created invoice on success, but stays open with API errors", async () => {
    const success = await setupAdminWorkflowDom({ financialFixture: true, expenseFlow: {} });
    try {
        await success.window.renderHoaDonModule();
        success.window.document.querySelector('[data-action="invoice-tab"][data-tab="expenses"]').click();
        await waitForDom(() => success.window.document.querySelector('[data-expense-table] tbody tr[data-detail-id="1"]'));
        success.window.document.querySelector('[data-expense-table] tbody tr[data-detail-id="1"]').click();
        await waitForDom(() => success.window.document.querySelector('[data-action="expense-invoice"]'));
        success.window.document.querySelector('[data-action="expense-invoice"]').click();
        await waitForDom(() => success.window.document.querySelector('#admin-drawer-title')?.textContent === "Hóa đơn INV-NEW");
        assert.ok(success.toasts.some(toast => toast.message === "Đã lập hóa đơn cho khoản phát sinh." && toast.kind === "success"));
    } finally {
        success.dom.window.close();
    }

    const failure = await setupAdminWorkflowDom({ financialFixture: true, expenseFlow: { fail: true } });
    try {
        await failure.window.renderHoaDonModule();
        failure.window.document.querySelector('[data-action="invoice-tab"][data-tab="expenses"]').click();
        await waitForDom(() => failure.window.document.querySelector('[data-expense-table] tbody tr[data-detail-id="1"]'));
        failure.window.document.querySelector('[data-expense-table] tbody tr[data-detail-id="1"]').click();
        await waitForDom(() => failure.window.document.querySelector('[data-action="expense-invoice"]'));
        failure.window.document.querySelector('[data-action="expense-invoice"]').click();
        await waitForDom(() => failure.window.document.querySelector('[data-drawer-error]')?.textContent === "Lỗi lập hóa đơn thật.");
        assert.equal(failure.window.document.querySelector("[data-admin-drawer]").classList.contains("hidden"), false);
    } finally {
        failure.dom.window.close();
    }
});

test("Admin student creation validates new CCCD values and duplicate owner messages", () => {
    const previousWindow = global.window;
    global.window = { StudentIdentity: studentIdentity };
    try {
        const studentPath = path.join(__dirname, "SinhVien.js");
        delete require.cache[require.resolve(studentPath)];
        require(studentPath);
        assert.equal(global.window.AdminStudentValidation.studentIdentityValidationMessage("012345678901"), "");
        assert.equal(global.window.AdminStudentValidation.studentIdentityValidationMessage("AB 1234"),
            studentIdentity.IDENTITY_ERROR);
        assert.equal(global.window.AdminStudentValidation.studentIdentityDuplicateMessage("Nguyễn An"),
            "Số CCCD/hộ chiếu đã được đăng ký cho sinh viên Nguyễn An.");
    } finally {
        global.window = previousWindow;
    }
});

test("Contract room options use current members, exclude unusable/full rooms, and sort by remaining seats", () => {
    const rooms = [
        { TenPhong: "B2", SucChuaToiDa: 4, SoSinhVienHienTai: 0, TrangThaiPhong: "Trống" },
        { TenPhong: "A1", SucChuaToiDa: 4, SoSinhVienHienTai: 3, TrangThaiPhong: "Trống" },
        { TenPhong: "C3", SucChuaToiDa: 4, SoSinhVienHienTai: 4, TrangThaiPhong: "Trống" },
        { TenPhong: "D4", SucChuaToiDa: 4, TrangThaiPhong: "Bảo trì" },
        { TenPhong: "E5", SucChuaToiDa: 4, TrangThaiPhong: "Ngưng sử dụng" }
    ];
    const contracts = [
        { MaHopDong: "HD-A1", TenPhong: "A1", TrangThaiHopDong: "Còn hiệu lực",
            sinhVien: [{ TrangThai: "Đang ở" }, { TrangThai: "Đang ở" }, { TrangThai: "Đã rời" }] },
        { MaHopDong: "HD-B2", TenPhong: "B2", TrangThaiHopDong: "Còn hiệu lực",
            sinhVien: [{ TrangThai: "Đang ở" }, { TrangThai: "Đã rời" }] },
        { TenPhong: "C3", TrangThaiHopDong: "Còn hiệu lực", sinhVien: Array.from({ length: 4 }, () => ({ TrangThai: "Đang ở" })) }
    ];
    assert.deepEqual(utils.contractRoomAvailability(rooms, contracts).map(room =>
        [room.TenPhong, room.currentOccupants, room.availableSeats]), [
        ["A1", 2, 2], ["B2", 1, 3]
    ]);
});

test("Contract room selection routes active rooms to member-add and new rooms to contract-create", () => {
    const rooms = [
        { TenPhong: "A1", SucChuaToiDa: 4, TrangThaiPhong: "Trống" },
        { TenPhong: "B2", SucChuaToiDa: 4, TrangThaiPhong: "Trống" }
    ];
    const contracts = [
        {
            MaHopDong: "HD00042", TenPhong: "A1", TrangThaiHopDong: "Còn hiệu lực",
            sinhVien: [{ TrangThai: "Đang ở" }, { TrangThai: "Đang ở" }]
        }
    ];
    const options = utils.contractRoomAvailability(rooms, contracts);
    assert.equal(options.find(room => room.TenPhong === "A1").activeContract.MaHopDong, "HD00042");
    assert.deepEqual(utils.contractRoomSelection("A1", contracts), {
        mode: "add-member", contract: contracts[0]
    });
    assert.deepEqual(utils.contractRoomSelection("B2", contracts), {
        mode: "create-contract", contract: null
    });
    assert.equal(utils.contractRoomSelection("A1", [
        ...contracts, { ...contracts[0], MaHopDong: "HD00043" }
    ]).mode, "invalid");
    assert.deepEqual(options.map(room => [room.TenPhong, room.activeContract?.MaHopDong || null]), [
        ["A1", "HD00042"], ["B2", null]
    ]);
});

test("Contract creation popup renders a search combobox with a hidden submission identifier", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    const fakeMemberHost = { innerHTML: "" };
    const initialStudents = [
        { value: "SV-A", label: "An · SV-A · Nữ" },
        { value: "SV-B", label: "Bình · SV-B · Nam" }
    ];
    fakeMemberHost.innerHTML = utils.contractMemberRowHtml(initialStudents, { MaSinhVien: "SV-A" }, ["SV-B"]);
    assert.match(fakeMemberHost.innerHTML, /name="maSinhVien"/);
    assert.match(fakeMemberHost.innerHTML, /value="SV-A"/);
    assert.match(fakeMemberHost.innerHTML, /data-student-search/);
    assert.match(fakeMemberHost.innerHTML, /role="combobox"/);
    assert.match(fakeMemberHost.innerHTML, /aria-label="Tìm sinh viên theo họ tên, Số CCCD hoặc hộ chiếu"/);
    assert.match(fakeMemberHost.innerHTML, /data-excluded-ids="\[&quot;SV-B&quot;\]"/);
    assert.match(source, /function memberFormRow\(member = \{\}, _roomName = "", excludedIds = \[\]\)/);
    assert.doesNotMatch(source, /studentOptions\(\{\s*availableOnly:\s*true,\s*roomName,\s*excludeIds\s*\}\)/);
    assert.match(source, /modal\.querySelector\("\[data-new-members\]"\)\.innerHTML = memberFormRow\(\)/);
    assert.match(source, /function openAddMember\(contractId\)[\s\S]*?data-form="member-add"[\s\S]*?studentOptions\(\{ availableOnly: true, roomName: contract\?\.TenPhong \|\| "" \}\)/);
    assert.match(source, /data-form="member-move"[\s\S]*?roomOptions\(contract\?\.TenPhong/);
});

test("Admin student-notice form styles and toggles the room and student targets in the DOM", async () => {
    const dom = new JSDOM(`
        <header></header>
        <nav id="main-nav"><a class="nav-item">Trang chủ</a></nav>
        <main id="main-content"></main>
    `, { url: "http://localhost/" });
    const { window } = dom;
    let openedRequest;
    window.switchPage = (page, menuItem) => { openedRequest = { page, menuItem }; };
    window.AdminWorkflowUtils = utils;
    window.currentUser = { fullName: "Quản lý kiểm thử" };
    window.confirm = () => true;
    window.showToast = () => {};
    const currentYear = new Date().getFullYear();
    const responses = {
        "/api/noi-quy": [],
        "/api/lien-he": { DienThoai: "0123456789", Email: "test@example.test", GioLamViec: "08:00-17:00" },
        "/api/admin/notifications": [{
            MaThongBao: 1, TieuDe: "Tiêu đề thông báo rất dài để kiểm tra xuống dòng",
            NoiDung: "Nội dung kiểm tra.", PhamViNhan: "TAT_CA", NgayTao: "2026-10-01"
        }],
        "/api/payments/history": Array.from({ length: 6 }, (_, index) => ({
            MaGiaoDich: `PAY-HOME-${index}`,
            HoTen: `Sinh viên thanh toán ${index}`,
            MaHoaDon: `INV-${index}`,
            TenKhoan: "Tiền phòng",
            SoTien: 100,
            PhuongThuc: "ONLINE",
            TrangThai: "SUCCESS",
            NgayTao: `2026-10-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`
        })),
        "/api/requests": Array.from({ length: 6 }, (_, index) => ({
            MaYeuCau: `YC${String(index + 1).padStart(5, "0")}`,
            MaSinhVien: `0123456789${String(index).padStart(2, "0")}`,
            HoTen: `Sinh viên yêu cầu ${index}`,
            TenPhong: `A10${index}`,
            Loai: index % 2 ? "Yêu cầu khác" : "Gia hạn hợp đồng",
            NgayBatDauHopDong: "2026-10-01",
            NgayKetThucHopDong: "2027-09-30",
            NgayKetThucDeXuat: "2028-09-30",
            NoiDung: `Lý do xin gia hạn ${index}`,
            NgayTao: `2026-11-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`
        })),
        "/api/Phong": [],
        "/api/sinhvien/thongke": { tongSinhVien: 0 },
        "/api/HopDong": [],
        [`/api/doanhthu/${currentYear}`]: { phong: Array(12).fill(0), dienNuoc: Array(12).fill(0) }
    };
    const context = {
        window,
        document: window.document,
        AdminWorkflowUtils: utils,
        ApiClient: {
            fetch: async url => ({
                ok: true,
                json: async () => {
                    if (!(url in responses)) throw new Error(`Unexpected Admin request: ${url}`);
                    return responses[url];
                }
            })
        },
        BASE_URL: "",
        AbortController: window.AbortController,
        MutationObserver: window.MutationObserver,
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
        Intl,
        Date,
        console
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "TrangChu.js"), "utf8"), context, {
        filename: "TrangChu.js"
    });

    try {
        context.renderTrangChuModule();
        await new Promise(resolve => setImmediate(resolve));
        const form = window.document.querySelector("[data-notice-form]");
        const title = form.elements.TieuDe;
        const content = form.elements.NoiDung;
        const scope = form.elements.PhamViNhan;
        const room = form.elements.TenPhong;
        const studentField = form.querySelector("[data-notice-student-field]");
        const studentInput = studentField.querySelector("input");
        assert.equal(room.className, title.className);
        assert.equal(room.className, content.className);
        assert.equal(room.className, scope.className);
        assert.equal(studentInput.className.replace("mt-1 ", ""), room.className);
        assert.equal(room.placeholder, "Nhập hoặc chọn tên phòng");
        assert.equal(room.hidden, true);
        assert.equal(studentField.classList.contains("hidden"), true);

        scope.value = "PHONG";
        scope.dispatchEvent(new window.Event("change", { bubbles: true }));
        assert.equal(room.hidden, false);
        assert.equal(room.required, true);
        assert.equal(studentField.classList.contains("hidden"), true);

        scope.value = "SINH_VIEN";
        scope.dispatchEvent(new window.Event("change", { bubbles: true }));
        assert.equal(room.hidden, true);
        assert.equal(room.required, false);
        assert.equal(studentField.classList.contains("hidden"), false);

        scope.value = "TAT_CA";
        scope.dispatchEvent(new window.Event("change", { bubbles: true }));
        assert.equal(room.hidden, true);
        assert.equal(studentField.classList.contains("hidden"), true);

        const notice = window.document.querySelector("[data-notice-list] li");
        const heading = notice.querySelector("strong");
        const hideButton = notice.querySelector("[data-notice-delete]");
        assert.ok(notice.classList.contains("home-managed-notice"));
        assert.ok(notice.querySelector(".home-notice-label--management"));
        assert.ok(heading.classList.contains("break-words"));
        assert.ok(hideButton.classList.contains("shrink-0"));
        assert.equal(heading.closest(".flex").contains(hideButton), true);

        assert.match(window.document.querySelector(".home-section-heading").textContent,
            /Thanh toán và yêu cầu mới từ sinh viên/);
        const announcements = window.document.querySelector("[data-payment-announcements]");
        const cards = [...announcements.querySelectorAll("button")];
        assert.equal(cards.length, 10);
        assert.equal(cards[0].classList.contains("home-request-announcement"), true);
        assert.equal(cards[0].textContent.includes("Yêu cầu"), true);
        assert.equal(cards[0].textContent.includes("0123456789"), false);
        const extensionCard = cards.find(card => card.dataset.requestAnnouncement === "YC00005");
        assert.match(extensionCard.textContent, /Ngày bắt đầu hợp đồng: 01\/10\/2026/);
        assert.match(extensionCard.textContent, /Ngày kết thúc hợp đồng hiện tại: 30\/09\/2027/);
        assert.match(extensionCard.textContent, /Ngày kết thúc đề xuất: 30\/09\/2028/);
        assert.match(extensionCard.textContent, /Lý do: Lý do xin gia hạn 4/);
        assert.equal(cards.some(card => card.classList.contains("home-payment-announcement")), true);
        assert.equal(cards.some(card => card.classList.contains("home-request-announcement")), true);
        assert.match(fs.readFileSync(path.join(__dirname, "../../style.css"), "utf8"),
            /#module-trangchu \.home-request-announcement[^}]*#fffbeb/);
        assert.match(fs.readFileSync(path.join(__dirname, "../../style.css"), "utf8"),
            /#module-trangchu \.home-managed-notice[^}]*#eff6ff/);
        cards[0].click();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(openedRequest.page, "Duyet & Kiem soat");
        assert.equal(window.pendingAdminRequestId, cards[0].dataset.requestAnnouncement);
    } finally {
        window.document.querySelector("#module-trangchu").remove();
        await new Promise(resolve => setImmediate(resolve));
        window.close();
    }
});

test("Admin request announcement opens the matching request detail after loading", async () => {
    const dom = new JSDOM('<main id="main-content"></main>', { url: "http://localhost/" });
    const { window } = dom;
    window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
    window.pendingAdminRequestId = "YC00001";
    const request = {
        MaYeuCau: "YC00001",
        MaSinhVien: "012345678901",
        HoTen: "Nguyễn An",
        TenPhong: "A101",
        Loai: "Gia hạn hợp đồng",
        NgayTao: "2026-11-02T09:00:00",
        NgayBatDauHopDong: "2026-10-01",
        NgayKetThucHopDong: "2027-09-30",
        NgayKetThucDeXuat: "2028-09-30",
        NoiDung: "Xin gia hạn."
    };
    const context = {
        window,
        document: window.document,
        AdminWorkflowUtils: {
            dateTime: value => String(value),
            date: value => `${String(value).slice(8, 10)}/${String(value).slice(5, 7)}/${String(value).slice(0, 4)}`,
            renderTable: (...args) => utils.renderTable(...args),
            maskStudentId: () => "0123****8901"
        },
        ApiClient: { fetch: async () => ({ json: async () => [request] }) },
        Intl,
        Date,
        console
    };
    window.AdminWorkflowUtils = context.AdminWorkflowUtils;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "DuyetKiemSoat.js"), "utf8"), context, {
        filename: "DuyetKiemSoat.js"
    });
    try {
        window.renderDuyetKiemSoatModule();
        await new Promise(resolve => setImmediate(resolve));
        const dialog = window.document.querySelector("#dk-dialog");
        assert.equal(dialog.open, true);
        const requestRow = window.document.querySelector("#dk-table-wrap tbody tr");
        const summaryRows = [...requestRow.querySelectorAll(".dk-contract-summary-row")];
        assert.deepEqual(summaryRows.map(row => row.querySelector("span").textContent.trim()),
            ["Bắt đầu HĐ:", "Kết thúc HĐ hiện tại:", "Kết thúc đề xuất:", "Lý do:"]);
        assert.equal(summaryRows[3].title, "Xin gia hạn.");
        assert.match(requestRow.textContent, /01\/10\/2026/);
        assert.match(requestRow.textContent, /30\/09\/2027/);
        assert.match(requestRow.textContent, /30\/09\/2028/);
        assert.ok(requestRow.textContent.indexOf("30/09/2028")
            < requestRow.textContent.indexOf("Lý do: Xin gia hạn."));
        assert.match(dialog.textContent, /Chi tiết yêu cầu/);
        assert.match(dialog.textContent, /YC00001/);
        assert.match(dialog.textContent, /Nguyễn An/);
        assert.match(dialog.textContent, /01\/10\/2026/);
        assert.match(dialog.textContent, /30\/09\/2027/);
        assert.match(dialog.textContent, /30\/09\/2028/);
        assert.equal(window.pendingAdminRequestId, undefined);
    } finally {
        window.close();
    }
});

test("Admin early-checkout dialog shows server refund values and confirms cash handover without client amount", async () => {
    const dom = new JSDOM('<main id="main-content"></main>', { url: "http://localhost/" });
    const { window } = dom;
    window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
    window.pendingAdminRequestId = "YC00001";
    const request = {
        MaYeuCau: "YC00001",
        MaSinhVien: "SV-ONE",
        HoTen: "Nguyễn An",
        TenPhong: "A101",
        Loai: "Trả phòng sớm",
        NgayTao: "2026-10-01T09:00:00",
        NgayKetThucDeXuat: "2026-10-14",
        NoiDung: "Xin trả phòng sớm vì chuyển nơi ở.",
        TrangThai: "Chờ duyệt"
    };
    const preview = {
        MaHopDong: "HD00001",
        NgayBatDauHopDong: "2026-10-01",
        NgayKetThucHopDong: "2026-10-30",
        NgayKetThucDeXuat: "2026-10-14",
        SoNgayHopDong: 30,
        DonGiaNgay: 40000,
        SoNgayDaO: 14,
        TienDaO: 560000,
        DaThanhToan: 1200000,
        SoTienHoan: 640000
    };
    const calls = [];
    let confirmation = "";
    let toast = "";
    window.confirm = message => { confirmation = message; return true; };
    const workflowUtils = {
        dateTime: value => String(value),
        date(value, mode) {
            const text = String(value || "").slice(0, 10);
            return mode === "format" ? `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}` : text;
        },
        renderTable: () => "<table></table>",
        maskStudentId: () => "SV-****"
    };
    const context = {
        window,
        document: window.document,
        AdminWorkflowUtils: workflowUtils,
        ApiClient: {
            fetch: async (url, options = {}) => {
                calls.push({ url, options });
                if (url === "/api/requests") return { json: async () => [request] };
                if (url.endsWith("/early-checkout")) return { json: async () => preview };
                return { json: async () => ({ success: true }) };
            }
        },
        showToast: message => { toast = message; },
        Intl,
        Date,
        console
    };
    window.AdminWorkflowUtils = workflowUtils;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "DuyetKiemSoat.js"), "utf8"), context, {
        filename: "DuyetKiemSoat.js"
    });
    try {
        window.renderDuyetKiemSoatModule();
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
        const dialog = window.document.querySelector("#dk-dialog");
        assert.equal(dialog.open, true);
        assert.match(dialog.textContent, /HD00001/);
        assert.match(dialog.textContent, /Ngày bắt đầu hợp đồng/);
        assert.match(dialog.textContent, /01\/10\/2026/);
        assert.match(dialog.textContent, /Đã thanh toán tiền phòng/);
        assert.match(dialog.textContent, /1\.200\.000 đ/);
        assert.match(dialog.textContent, /Đơn giá ngày/);
        assert.match(dialog.textContent, /40\.000 đ/);
        assert.match(dialog.textContent, /560\.000 đ/);
        assert.match(dialog.textContent, /640\.000 đ/);
        const approve = dialog.querySelector('button[value="approve"]');
        assert.equal(approve.textContent, "Duyệt và hoàn tiền mặt");
        dialog.querySelector("#dk-decision").dispatchEvent(new window.SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
            submitter: approve
        }));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(confirmation, "Xác nhận đã đưa 640.000 đ tiền mặt cho sinh viên?");
        const decision = calls.find(call => call.options.method === "PUT");
        assert.ok(decision);
        assert.equal(JSON.parse(decision.options.body).SoTienHoan, undefined);
        assert.match(toast, /Đã duyệt/);
    } finally {
        window.close();
    }
});

test("Admin contract creation shows a clear toast when the first rent invoice cannot be created", async () => {
    const warning = "Không lập hóa đơn tiền phòng cho sinh viên FREE-STUDENT: chưa có đơn giá hợp lệ.";
    const { dom, window, toasts, calls } = await setupAdminWorkflowDom({
        contractCreateResponse: { success: true, MaHopDong: "HD-NEW", HoaDonTienPhong: [], CanhBao: [warning] }
    });
    try {
        window.document.querySelector('[data-action="contract-create"]').click();
        await waitForDom(() => window.document.querySelector('form[data-form="contract-create"]'));
        const form = window.document.querySelector('form[data-form="contract-create"]');
        const member = form.querySelector(".member-row");
        const studentSearch = member.querySelector("[data-student-search]");
        studentSearch.value = "FREE-STUDENT";
        studentSearch.dispatchEvent(new window.Event("input", { bubbles: true }));
        member.querySelector('[data-student-option="FREE-STUDENT"]').click();
        form.elements.tenPhong.value = "A103";
        form.elements.tenPhong.dispatchEvent(new window.Event("change", { bubbles: true }));
        form.elements.ngayKetThuc.value = "02112027";
        window.document.querySelector('button[form="admin-workflow-form"][type="submit"]').click();

        await waitForDom(() => toasts.some(toast => toast.message.includes(warning)));
        assert.ok(toasts.some(toast => toast.kind === "error"
            && toast.message.includes("Hợp đồng đã tạo nhưng không lập hóa đơn tiền phòng")
            && toast.message.includes(warning)));
        assert.ok(calls.some(call => call.url === "/api/HopDong" && call.options.method === "POST"));
    } finally {
        dom.window.close();
    }
});

test("Admin contract form blocks an end date that is not after its start date", async () => {
    const { dom, window, calls } = await setupAdminWorkflowDom();
    try {
        window.document.querySelector('[data-action="contract-create"]').click();
        await waitForDom(() => window.document.querySelector('form[data-form="contract-create"]'));
        const form = window.document.querySelector('form[data-form="contract-create"]');
        const submit = window.document.querySelector('button[form="admin-workflow-form"][type="submit"]');
        const endDate = form.elements.ngayKetThuc;
        form.elements.ngayBatDau.value = '10/11/2026';
        endDate.value = '10/11/2026';
        endDate.dispatchEvent(new window.Event('admin-date-input', { bubbles: true }));
        const error = form.querySelector('#date-ngayKetThuc').parentElement.parentElement
            .querySelector('[data-date-error]');
        assert.equal(error.textContent, 'Ngày kết thúc phải sau ngày bắt đầu.');
        assert.equal(submit.disabled, true);
        submit.click();
        assert.equal(calls.some(call => call.url === '/api/HopDong' && call.options.method === 'POST'), false);

        endDate.value = '11/11/2026';
        endDate.dispatchEvent(new window.Event('admin-date-input', { bubbles: true }));
        assert.equal(error.textContent, '');
        assert.equal(submit.disabled, false);
    } finally {
        dom.window.close();
    }
});

test("Room labels preserve nonstandard gender values and gender filters match exactly", () => {
    const rooms = [
        { TenPhong: "A103", LoaiPhong: "Nữ", SoSinhVienHienTai: 0, SucChuaToiDa: 4 },
        { TenPhong: "A101", LoaiPhong: "Nam", SoSinhVienHienTai: 2, SucChuaToiDa: 4 },
        { TenPhong: "X1", LoaiPhong: "Khác", SucChuaToiDa: 3 }
    ];
    assert.equal(utils.roomLabel(rooms[0]), "A103 · Nữ · 0/4");
    assert.equal(utils.roomLabel(rooms[1]), "A101 · Nam · 2/4");
    assert.equal(utils.roomLabel(rooms[2]), "X1 · Khác · 0/3");
    assert.equal(utils.roomGender({ TenPhong: "X2", LoaiPhong: null }), "Chưa xác định");
    assert.deepEqual(utils.filterRoomsByGender(rooms, "Nữ").map(room => room.TenPhong), ["A103"]);
    assert.deepEqual(utils.filterStudentsByRoomGender([
        { MaSinhVien: "SV1", GioiTinh: "Nữ" }, { MaSinhVien: "SV2", GioiTinh: "Nam" }
    ], rooms[0]).map(student => student.MaSinhVien), ["SV1"]);
});

test("Contract room options require selected students' gender and enough remaining seats", () => {
    const rooms = [
        { TenPhong: "N-2", Khu: "N", LoaiPhong: "Nữ", SucChuaToiDa: 2 },
        { TenPhong: "N-4", Khu: "N", LoaiPhong: "Nữ", SucChuaToiDa: 4 },
        { TenPhong: "M-4", Khu: "M", LoaiPhong: "Nam", SucChuaToiDa: 4 }
    ];
    const students = [
        { MaSinhVien: "N1", GioiTinh: "Nữ" },
        { MaSinhVien: "N2", GioiTinh: "Nữ" },
        { MaSinhVien: "M1", GioiTinh: "Nam" }
    ];
    const contracts = [{
        MaHopDong: "HD-N2", TenPhong: "N-2", TrangThaiHopDong: "Còn hiệu lực",
        sinhVien: [{ TrangThai: "Đang ở" }]
    }];
    const available = utils.contractRoomsForStudents(rooms, contracts, [students[0], students[1]]);
    assert.deepEqual(available.map(room => room.TenPhong), ["N-4"]);
    assert.deepEqual(utils.contractRoomsForStudents(rooms, contracts, [students[0], students[2]]), []);
    assert.deepEqual(utils.contractRoomsForStudents(rooms, contracts, []), []);
});

test("Admin contract and move-room forms apply room gender and tier filters", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    assert.match(source, /updateCreateRoomOptions\(form\)/);
    assert.match(source, /updateCreateStudentOptions\(form, event\.target\.value\)/);
    assert.match(source, /Chọn sinh viên trước/);
    assert.match(source, /gender: student\?\.GioiTinh \|\| currentRoom\?\.LoaiPhong/);
    assert.match(source, /tier: contract\?\.MaHangPhong \|\| currentRoom\?\.MaHangPhong/);
    assert.match(source, /Không có phòng \$\{esc\(gender\)\} còn chỗ/);
    assert.match(source, /data-new-members[\s\S]*?select\("Phòng", "tenPhong", \[\], "", true\)/);
    assert.match(source, /label: "Phòng"[\s\S]*?label: "Khu"[\s\S]*?label: "Giới tính"[\s\S]*?label: "Hạng"[\s\S]*?label: "Sĩ số \(hiện\/tối đa\)"[\s\S]*?label: "Giá hạng\/tháng"[\s\S]*?label: "Trạng thái"/);
    assert.match(source, /\.sort\(\(left, right\) => String\(left\.Khu \|\| ""\)\.localeCompare/);
    assert.match(utils.genderBadge("Nam"), /admin-status--info/);
    assert.match(utils.genderBadge("Nữ"), /admin-status--success/);
    assert.match(utils.genderBadge("Khác"), /Khác/);
});

test("Admin display labels translate persisted payment and workflow codes without changing values", () => {
    assert.equal(utils.displayLabel("CASH"), "Tiền mặt");
    assert.equal(utils.displayLabel("ONLINE"), "Chuyển khoản QR");
    assert.equal(utils.displayLabel("CHUYEN_DOI"), "Chuyển khoản QR");
    assert.equal(utils.displayLabel("Chưa thanh toán"), "Còn nợ");
    assert.equal(utils.displayLabel("RECONCILIATION"), "—");
    assert.equal(utils.displayLabel("PENDING"), "Chờ xác nhận");
    assert.equal(utils.displayLabel("VALID"), "Hợp lệ");
    assert.equal(utils.displayLabel("OVERDUE"), "Còn nợ");
    assert.equal(utils.displayLabel("CHI_SO"), "Theo chỉ số công tơ");
    assert.equal(utils.displayLabel("CO_DINH_KY"), "Cố định theo kỳ");
    assert.equal(utils.displayLabel("PHONG"), "Cả phòng");
    assert.equal(utils.displayLabel("CA_NHAN"), "Từng người");
    assert.equal(utils.displayLabel("THANG"), "Theo tháng");
    assert.equal(utils.displayLabel("NAM"), "Theo năm");
    assert.equal(utils.displayLabel("MALE"), "Nam");
    assert.equal(utils.displayLabel("FEMALE"), "Nữ");
    assert.equal(utils.paymentMethodLabel("QR_DEMO"), "Chuyển khoản QR");
    assert.equal(utils.paymentMethodLabel("unexpected"), "Chuyển khoản QR");
    assert.equal(utils.maskStudentId("012345678901"), "0123****8901");
    assert.equal(utils.maskStudentId("OLD-ID"), "OL****ID");
    assert.equal(utils.maskPaymentReference("QR-DEMO:012345678901"), "QR-DEMO:012345678901");
    assert.equal(utils.invoicePaymentLabel({
        TrangThaiThanhToan: "Trễ hạn", ConNo: 20, HanThanhToan: "2026-10-10"
    }, "2026-10-11"), "Trễ hạn");
    assert.equal(utils.invoicePaymentLabel({ TrangThaiThanhToan: "Đã thanh toán", ConNo: 0 }), "Đã thanh toán");
    assert.equal(utils.refundDisplayNote({
        LyDo: "Trả phòng sớm", GhiChu: "Gợi ý 0.00; Hoàn tiền theo ngày, yêu cầu YC00049",
        SoNgayDaO: 14, SoTien: 640000
    }), "Trả phòng sớm theo yêu cầu YC00049: ở 14 ngày, hoàn 640.000 đ");
});

test("Receipt filters exclude discrepancy records and default to paid receipts", () => {
    const receipts = [
        { MaPhieuThu: "PT01", TrangThaiDanhSach: "RECONCILIATION" },
        { MaPhieuThu: "PT02", TrangThaiDanhSach: "Đã thanh toán" },
        { MaPhieuThu: "PT03", TrangThai: "RECONCILIATION" },
        { MaPhieuThu: "PT04", TrangThaiDanhSach: "SUCCESS" },
        { MaPhieuThu: "PT05", TrangThai: "Chờ xác nhận" },
        { MaPhieuThu: "PT06", TrangThaiDanhSach: "Đã xác nhận" }
    ];
    assert.deepEqual(utils.filterFinancialRows(receipts, "receipts").map(row => row.MaPhieuThu), ["PT02"]);
    assert.equal(utils.filterFinancialRows(receipts, "receipts", { status: "ALL" }).length, 1);
    assert.deepEqual(utils.filterFinancialRows(receipts, "receipts", { status: "Đã thanh toán" })
        .map(row => row.MaPhieuThu), ["PT02"]);
    assert.deepEqual(utils.filterFinancialRows(receipts, "receipts", { status: "Đã xác nhận" }), []);
    assert.deepEqual(utils.filterFinancialRows(receipts, "receipts", { status: "ACTION_REQUIRED" }), []);
    assert.deepEqual(utils.filterFinancialRows([
        { MaHoaDon: "OWED", ConNo: 100, TrangThaiThanhToan: "Chưa thanh toán" },
        { MaHoaDon: "PAID", ConNo: 0, TrangThaiThanhToan: "Đã thanh toán" }
    ], "invoices").map(row => row.MaHoaDon), ["OWED"]);
});

test("Invoice filters distinguish debt, overdue, and paid labels while omitting canceled rows", () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const rows = [
        { MaHoaDon: "OLD-OWED", HanThanhToan: "2000-01-01", ConNo: 100, TrangThaiThanhToan: "Chưa thanh toán" },
        { MaHoaDon: "TODAY", HanThanhToan: today, ConNo: 100, TrangThaiThanhToan: "Chưa thanh toán" },
        { MaHoaDon: "PAID", HanThanhToan: "2000-01-01", ConNo: 0, TrangThaiThanhToan: "Đã thanh toán" },
        { MaHoaDon: "CANCELLED", HanThanhToan: "2000-01-01", ConNo: 100, TrangThaiThanhToan: "Đã hủy" }
    ];
    assert.equal(utils.isOverdueInvoice(rows[0], today), true);
    assert.equal(utils.isOverdueInvoice(rows[1], today), false);
    assert.equal(utils.isOverdueInvoice(rows[2], today), false);
    assert.equal(utils.isOverdueInvoice(rows[3], today), false);
    assert.deepEqual(utils.filterFinancialRows(rows, "invoices", { status: "Còn nợ" })
        .map(row => row.MaHoaDon), ["TODAY"]);
    assert.deepEqual(utils.filterFinancialRows(rows, "invoices", { status: "Trễ hạn" })
        .map(row => row.MaHoaDon), ["OLD-OWED"]);
    assert.deepEqual(utils.filterFinancialRows(rows, "invoices", { status: "ALL" })
        .map(row => row.MaHoaDon), ["OLD-OWED", "TODAY", "PAID"]);
});

test("A zero-priced tier service cannot be enabled", () => {
    assert.equal(utils.serviceCanBeActive("0"), false);
    assert.equal(utils.serviceCanBeActive("1.200.000"), true);
});

test("Tier drafts track edits and stale snapshots without overwriting server changes", () => {
    const baseline = {
        tierId: "HP4", tenHangPhong: "Bốn người", sucChuaToiDa: 4,
        giaPhongThang: 1000, giaPhongNam: 12000, dichVu: []
    };
    assert.equal(utils.hasTierDraftChanges({ ...baseline }, baseline), false);
    assert.equal(utils.hasTierDraftChanges({ ...baseline, giaPhongThang: 1100 }, baseline), true);
    assert.equal(utils.hasTierDraftChanges({ ...baseline, giaPhongNam: 12000 }, baseline), false);
});

test("Room tier changes are blocked for current residents and active contracts", () => {
    assert.equal(utils.canChangeRoomTier({ SoSinhVienHienTai: 0, SoHopDongConHieuLuc: 0 }), true);
    assert.equal(utils.canChangeRoomTier({ SoSinhVienHienTai: 1, SoHopDongConHieuLuc: 0 }), false);
    assert.equal(utils.canChangeRoomTier({ SoSinhVienHienTai: 0, SoHopDongConHieuLuc: 1 }), false);
});

test("Admin shared table keeps one definition for headers and cells and nowrap money", () => {
    const table = utils.renderTable([
        { label: "Số tiền", align: "right", render: row => utils.formatVnd(row.amount) },
        { label: "Trạng thái", render: row => `<span class="admin-status-badge">${row.status}</span>` }
    ], [{ amount: 1200000, status: "Hợp lệ" }]);
    const headerCount = (table.match(/<th /g) || []).length;
    const cellCount = (table.match(/<td /g) || []).length;
    assert.equal(headerCount, 2);
    assert.equal(cellCount, 2);
    assert.match(table, /whitespace-nowrap/);
    assert.match(table, /1\.200\.000\u00a0đ/);
    assert.match(table, /text-right/);
});

test("Admin shared CSS wraps long values and headings across all management tables", () => {
    const css = fs.readFileSync(path.join(__dirname, "..", "..", "style.css"), "utf8");
    const workflows = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    const contracts = fs.readFileSync(path.join(__dirname, "HopDong.js"), "utf8");
    const students = fs.readFileSync(path.join(__dirname, "SinhVien.js"), "utf8");
    const approvals = fs.readFileSync(path.join(__dirname, "DuyetKiemSoat.js"), "utf8");
    assert.match(css, /#main-content th,\s*#main-content td\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*break-word;/);
    assert.match(css, /#main-content \.admin-data-table \.admin-code-cell\s*\{\s*min-width:\s*132px;/);
    assert.match(workflows, /label: "Phòng", width: 120, code: true/);
    assert.match(workflows, /label: "Hợp đồng", width: 160, code: true/);
    assert.match(contracts, /data-table|table/);
    assert.match(students, /renderTable\(/);
    assert.match(approvals, /renderTable\(/);
});

test("Admin row-detail controls preserve accessible detail views without receipt confirmation actions", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    for (const type of ["room", "contract", "invoice", "expense", "receipt", "payment", "refund"]) {
        assert.match(source, new RegExp(`data-detail-type="${type}"`));
    }
    assert.doesNotMatch(source, /receipt-confirm|receipt-reject/);
    for (const action of ["room-edit", "invoice-cancel", "refund-print", "member-leave", "member-move",
        "member-representative", "member-add", "contract-extend", "contract-end"]) {
        assert.match(source, new RegExp(`"${action}"`));
    }
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /event\.key === "Enter" \|\| event\.key === " "/);
});

test("Admin row actions are locked while handling a click to prevent duplicate API calls", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    assert.match(source, /!root\.contains\(actionButton\)[\s\S]*?state\.busy/);
    assert.match(source, /finally \{\s*state\.busy = false;\s*if \(actionButton\.isConnected\) setBusy\(actionButton, false\);/);
});

test("Admin student list initializes pagination and reports API failures instead of silently emptying", () => {
    const source = fs.readFileSync(path.join(__dirname, "SinhVien.js"), "utf8");
    assert.match(source, /const rowsPerPage = 10/);
    assert.match(source, /let currentPage = 1/);
    assert.match(source, /Array\.isArray\(result\.data\)/);
    assert.match(source, /id="studentLoadError"/);
    assert.match(source, /Không có sinh viên phù hợp/);
    assert.match(source, /console\.error\("Lỗi tải danh sách sinh viên:", error\)/);
});

test("Admin HTML loads the API-backed workflow instead of legacy finance modules", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "..", "Admin.html"), "utf8");
    const legacyInvoice = fs.readFileSync(path.join(__dirname, "HoaDon.js"), "utf8");
    assert.match(html, /js\/module\/AdminWorkflows\.js/);
    assert.doesNotMatch(html, /js\/module\/HoaDon\.js|js\/payment-demo\.js|js\/module\/ThanhToanDemo\.js/);
    assert.doesNotMatch(legacyInvoice, /ApiClient\.fetch\(API_URL,\s*\{/);
    assert.doesNotMatch(legacyInvoice, /method:\s*['"]PUT['"]/);
});

test("Admin receipt printing uses a shared print helper visible to receipt handlers", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    const helperIndex = source.indexOf("function printDocument()");
    const receiptIndex = source.indexOf("function printReceipt(receipt)");
    const actionHandlerIndex = source.indexOf("async function handleClick");
    assert.ok(helperIndex >= 0);
    assert.ok(receiptIndex > helperIndex);
    assert.ok(actionHandlerIndex > receiptIndex);
    assert.match(source, /function printDocument\(\)\s*\{\s*document\.body\.classList\.add\("admin-printing"\);\s*window\.print\(\);\s*\}/);
    assert.match(source, /function printReceipt\(receipt\)[\s\S]*?printDocument\(\);/);
    assert.match(source, /function printRefund\(refund\)[\s\S]*?printDocument\(\);/);
    assert.doesNotMatch(source.slice(actionHandlerIndex), /function printDocument\(\)/);
});

test("Active Admin date fields are text inputs using the shared date utility", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "..", "Admin.html"), "utf8");
    const adminWorkflows = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    const utilsSource = fs.readFileSync(path.join(__dirname, "AdminWorkflowUtils.js"), "utf8");
    const students = fs.readFileSync(path.join(__dirname, "SinhVien.js"), "utf8");
    const approvals = fs.readFileSync(path.join(__dirname, "DuyetKiemSoat.js"), "utf8");
    assert.match(html, /js\/module\/AdminWorkflowUtils\.js/);
    assert.match(adminWorkflows, /U\.dateField/);
    assert.match(utilsSource, /data-date-picker/);
    assert.match(utilsSource, /data-admin-date/);
    assert.match(utilsSource, /grid-cols-\[160px_minmax\(0,1fr\)\]/);
    assert.match(utilsSource, /data-date-picker/);
    assert.doesNotMatch(students, /type="date"/);
    assert.doesNotMatch(approvals, /type="date"/);
    assert.match(adminWorkflows, /U\.date\(value, "parse"\)/);
});

test("Admin refund edits require an explanation when amount differs from suggestion", () => {
    assert.equal(utils.refundReasonRequired(100, 100, ""), false);
    assert.equal(utils.refundReasonRequired(90, 100, ""), true);
    assert.equal(utils.refundReasonRequired(90, 100, "Lý do điều chỉnh"), false);
});

test("Admin invoice display handles a NULL student without rendering undefined", () => {
    assert.equal(utils.invoicePersonLabel({ MaSinhVien: null, HoTen: null }), "Theo phòng/hợp đồng");
    assert.equal(utils.invoicePersonLabel({ MaSinhVien: "SV01", HoTen: "Nguyễn A" }), "Nguyễn A (****)");
    assert.equal(utils.invoicePersonLabel({ MaSinhVien: "SV01", HoTen: "SV01" }), "****");
});

test("Admin contract module uses the approved Chi tiết hợp đồng label and API alias", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    assert.doesNotMatch(source, /Chi tiết theo phòng/);
    assert.match(source, /data-action="row-detail" data-detail-type="contract"/);
    assert.match(source, /\/api\/chitiethopdong/);
    assert.doesNotMatch(source, /\/api\/history/);
});

test("Admin output escapes API strings before HTML rendering", () => {
    assert.equal(utils.escapeHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});
