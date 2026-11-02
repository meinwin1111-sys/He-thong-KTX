const { test } = require("node:test");
const assert = require("node:assert/strict");
const utils = require("./AdminWorkflowUtils");
const fs = require("node:fs");
const path = require("node:path");

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

test("Admin status badges use one consistent status color mapping", () => {
    assert.match(utils.statusBadge("Đang ở"), /admin-status--success/);
    assert.match(utils.statusBadge("Chưa xếp phòng"), /admin-status--warning/);
    assert.match(utils.statusBadge("Đã rời khỏi"), /admin-status--danger/);
    assert.match(utils.statusBadge("Trống"), /admin-status--neutral/);
    assert.match(utils.statusBadge("Đầy"), /admin-status--info/);
    assert.match(utils.statusBadge("Còn hiệu lực"), /admin-status--success/);
    assert.match(utils.statusBadge("Đã kết thúc"), /admin-status--neutral/);
    assert.match(utils.statusBadge("Trễ hạn"), /admin-status--danger/);
    assert.match(utils.statusBadge("Chờ xác nhận"), /admin-status--warning/);
    assert.match(utils.statusBadge("Không ghi nhận"), /admin-status--dark/);
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

test("Admin date inputs normalize compact and slash dates and reject invalid calendar days", () => {
    for (const input of ["01022003", "1/2/2003", "01/02/2003"]) {
        assert.equal(utils.normalizeDateInput(input), "01/02/2003");
        assert.equal(utils.date(utils.normalizeDateInput(input), "parse"), "2003-02-01");
    }
    assert.equal(utils.normalizeDateInput("31/02/2024"), null);
    assert.equal(utils.validateDateInput("31/02/2024"), "Ngày không hợp lệ. Nhập theo dd/mm/yyyy.");
    assert.equal(utils.normalizeDateInput("29/02/2024"), "29/02/2024");
    assert.equal(utils.normalizeDateInput("29/02/2023"), null);
    assert.equal(utils.normalizeDateInput("01/01/2024"), "01/01/2024");
    assert.equal(utils.normalizeDateInput("31/12/2024"), "31/12/2024");
    assert.deepEqual(utils.sanitizeDateInput("01022003", 4), { value: "01022003", caret: 4 });
    assert.deepEqual(utils.sanitizeDateInput("2003-02-01", 10), { value: "01/02/2003", caret: 10 });
    assert.match(utils.validateDateInput("01/01/1899", { minYear: 1900 }), /1900/);
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

test("Admin contract and move-room forms apply room gender and tier filters", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    assert.match(source, /updateCreateRoomOptions\(form\)/);
    assert.match(source, /updateCreateStudentOptions\(form, event\.target\.value\)/);
    assert.match(source, /gender: student\?\.GioiTinh \|\| currentRoom\?\.LoaiPhong/);
    assert.match(source, /tier: contract\?\.MaHangPhong \|\| currentRoom\?\.MaHangPhong/);
    assert.match(source, /Không có phòng \$\{esc\(gender\)\} còn chỗ/);
});

test("Admin display labels translate persisted payment and workflow codes without changing values", () => {
    assert.equal(utils.displayLabel("CASH"), "Tiền mặt");
    assert.equal(utils.displayLabel("ONLINE"), "Chuyển khoản (QR)");
    assert.equal(utils.displayLabel("CHUYEN_DOI"), "Chuyển đổi dữ liệu cũ");
    assert.equal(utils.displayLabel("Chưa thanh toán"), "Còn nợ");
    assert.equal(utils.displayLabel("RECONCILIATION"), "Không ghi nhận");
    assert.equal(utils.displayLabel("Cần đối soát"), "Không ghi nhận");
    assert.equal(utils.displayLabel("PENDING"), "Chờ xác nhận");
    assert.equal(utils.displayLabel("VALID"), "Hợp lệ");
    assert.equal(utils.displayLabel("OVERDUE"), "Trễ hạn");
    assert.equal(utils.displayLabel("CHI_SO"), "Theo chỉ số công tơ");
    assert.equal(utils.displayLabel("CO_DINH_KY"), "Cố định theo kỳ");
    assert.equal(utils.displayLabel("PHONG"), "Cả phòng");
    assert.equal(utils.displayLabel("CA_NHAN"), "Từng người");
    assert.equal(utils.displayLabel("THANG"), "Theo tháng");
    assert.equal(utils.displayLabel("NAM"), "Theo năm");
    assert.equal(utils.displayLabel("MALE"), "Nam");
    assert.equal(utils.displayLabel("FEMALE"), "Nữ");
});

test("Financial filters default to actionable rows and allow all rows", () => {
    const receipts = [
        { MaPhieuThu: "PT01", TrangThai: "Chờ xác nhận" },
        { MaPhieuThu: "PT02", TrangThai: "Hợp lệ" },
        { MaPhieuThu: "PT03", TrangThai: "Đã hủy" }
    ];
    assert.deepEqual(utils.filterFinancialRows(receipts, "receipts").map(row => row.MaPhieuThu), ["PT01"]);
    assert.equal(utils.filterFinancialRows(receipts, "receipts", { status: "ALL" }).length, 3);
});

test("Invoice overdue label and filter derive from the due date and outstanding balance", () => {
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
    assert.deepEqual(utils.filterFinancialRows(rows, "invoices", { status: "OVERDUE" })
        .map(row => row.MaHoaDon), ["OLD-OWED"]);
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

test("Admin row-detail controls preserve existing table actions in detail views", () => {
    const source = fs.readFileSync(path.join(__dirname, "AdminWorkflows.js"), "utf8");
    for (const type of ["room", "contract", "invoice", "expense", "receipt", "payment", "refund"]) {
        assert.match(source, new RegExp(`data-detail-type="${type}"`));
    }
    for (const action of ["room-edit", "invoice-cancel", "receipt-confirm", "receipt-cancel",
        "payment-confirm", "payment-reject", "refund-print", "member-leave", "member-move",
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
    assert.equal(utils.invoicePersonLabel({ MaSinhVien: "SV01", HoTen: "Nguyễn A" }), "Nguyễn A (SV01)");
    assert.equal(utils.invoicePersonLabel({ MaSinhVien: "SV01", HoTen: "SV01" }), "SV01");
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
