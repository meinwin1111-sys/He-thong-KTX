(() => {
    const U = window.AdminWorkflowUtils;
    const root = document.getElementById("main-content");
    const state = {
        contracts: [],
        rooms: [],
        tiers: [],
        students: [],
        invoices: [],
        expenses: [],
        receipts: [],
        payments: [],
        refunds: [],
        report: [],
        debts: [],
        activeInvoiceTab: "invoices",
        activeRoomTab: "rooms",
        invoiceDetail: null,
        invoiceReceipt: null,
        busy: false,
        listenersBound: false
    };

    const esc = U.escapeHtml;
    const dateOnly = value => value ? String(value).slice(0, 10) : "";
    const today = () => new Date().toISOString().slice(0, 10);
    const money = value => U.formatVnd(Number(value || 0));
    const status = message => {
        const target = root?.querySelector("[data-admin-status]");
        if (target) target.textContent = message || "";
        else if (message) window.showToast?.(message, "error");
    };
    const request = async (url, options = {}) => {
        const response = await window.ApiClient.fetch(`${BASE_URL}${url}`, {
            ...options,
            headers: {
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {})
            }
        });
        let body = null;
        try {
            body = await response.json();
        } catch {
            body = null;
        }
        if (!response.ok) {
            const error = new Error(
                typeof body?.message === "string" && body.message.trim()
                    ? body.message
                    : `Không thể hoàn tất thao tác (HTTP ${response.status}).`
            );
            error.status = response.status;
            throw error;
        }
        return body;
    };
    const json = data => JSON.stringify(data);
    const queryString = entries => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(entries)) {
            if (value !== undefined && value !== null && value !== "") query.set(key, value);
        }
        const value = query.toString();
        return value ? `?${value}` : "";
    };
    const field = (label, name, type = "text", value = "", required = false, extra = "") => `
        <label class="block text-sm font-semibold text-slate-700">${esc(label)}
            <input name="${esc(name)}" type="${type}" value="${esc(value)}"
                ${required ? "required" : ""} ${extra}
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
        </label>`;
    const select = (label, name, options, selected = "", required = false) => `
        <label class="block text-sm font-semibold text-slate-700">${esc(label)}
            <select name="${esc(name)}" ${required ? "required" : ""}
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                ${options.map(option => `<option value="${esc(option.value)}" ${String(option.value) === String(selected) ? "selected" : ""}>${esc(option.label)}</option>`).join("")}
            </select>
        </label>`;
    const button = (label, action, attrs = "", style = "bg-emerald-700 text-white") =>
        `<button type="button" data-action="${esc(action)}" ${attrs}
            class="rounded-lg px-3 py-2 text-sm font-semibold ${style}">${esc(label)}</button>`;
    const apiError = error => {
        const message = error?.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
        status(message);
        window.showToast?.(message, "error");
    };
    const setBusy = (element, busy) => {
        if (!element) return;
        element.disabled = busy;
        element.dataset.originalText ||= element.textContent;
        element.textContent = busy ? "Đang xử lý…" : element.dataset.originalText;
        element.classList.toggle("opacity-60", busy);
    };
    const modalShell = (title, content, submitLabel = "Xác nhận") => {
        const modal = root.querySelector("[data-admin-modal]");
        if (!modal) return null;
        modal.innerHTML = `
            <div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4">
                <section role="dialog" aria-modal="true" aria-labelledby="admin-modal-title"
                    class="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
                    <header class="mb-5 flex items-center justify-between border-b pb-3">
                        <h3 id="admin-modal-title" class="text-xl font-bold">${esc(title)}</h3>
                        <button type="button" data-action="modal-close" aria-label="Đóng"
                            class="px-2 text-2xl text-slate-500">×</button>
                    </header>
                    ${content}
                    <p class="mt-3 min-h-6 text-sm text-red-700" role="alert" data-modal-error></p>
                    <footer class="mt-4 flex justify-end gap-2 border-t pt-4">
                        <button type="button" data-action="modal-close"
                            class="rounded-lg bg-slate-100 px-4 py-2">Đóng</button>
                        <button type="submit" form="admin-workflow-form"
                            class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">${esc(submitLabel)}</button>
                    </footer>
                </section>
            </div>`;
        modal.classList.remove("hidden");
        return modal;
    };
    const closeModal = () => {
        const modal = root?.querySelector("[data-admin-modal]");
        if (modal) {
            modal.classList.add("hidden");
            modal.replaceChildren();
        }
    };
    const ensureRoot = (title, description) => {
        if (!root) return null;
        root.innerHTML = `
            <section class="space-y-5 p-4 md:p-6">
                <header>
                    <h1 class="text-2xl font-bold text-slate-900">${esc(title)}</h1>
                    <p class="mt-1 text-sm text-slate-600">${esc(description)}</p>
                </header>
                <p data-admin-status role="status" aria-live="polite" class="min-h-5 text-sm text-red-700"></p>
                <div data-admin-content></div>
                <div data-admin-modal class="hidden"></div>
            </section>`;
        if (!state.listenersBound) {
            root.addEventListener("click", handleClick);
            root.addEventListener("submit", handleSubmit);
            root.addEventListener("change", handleChange);
            root.addEventListener("input", handleInput);
            state.listenersBound = true;
        }
        return root.querySelector("[data-admin-content]");
    };
    const content = () => root?.querySelector("[data-admin-content]");

    async function loadContracts(filters = {}) {
        state.contracts = await request(`/api/HopDong${queryString(filters)}`);
        if (!Array.isArray(state.contracts)) throw new Error("API hợp đồng trả về dữ liệu không đúng định dạng.");
        renderContractsTable();
    }
    async function loadStudents() {
        const first = await request("/api/sinhvien?page=1&pageSize=100");
        state.students = Array.isArray(first?.data) ? first.data : [];
        for (let page = 2; page <= Number(first?.totalPages || 1); page++) {
            const next = await request(`/api/sinhvien?page=${page}&pageSize=100`);
            if (Array.isArray(next?.data)) state.students.push(...next.data);
        }
    }
    async function loadRoomsAndTiers() {
        const [rooms, tiers] = await Promise.all([
            request("/api/Phong"),
            request("/api/HangPhong")
        ]);
        if (!Array.isArray(rooms) || !Array.isArray(tiers)) {
            throw new Error("API phòng hoặc hạng phòng trả về dữ liệu không đúng định dạng.");
        }
        state.rooms = rooms;
        state.tiers = tiers;
    }
    async function loadServices() {
        const services = await request("/api/DichVu");
        if (!Array.isArray(services)) throw new Error("API dịch vụ trả về dữ liệu không đúng định dạng.");
        state.services = services;
        return services;
    }
    const activeMembers = contract =>
        (contract.sinhVien || []).filter(member => member.TrangThai === "Đang ở");
    const memberName = member => [member.HoTen, member.MaSinhVien].filter(Boolean).join(" · ");
    const contractOptions = (activeOnly = true) => state.contracts
        .filter(contract => !activeOnly || contract.TrangThaiHopDong === "Còn hiệu lực")
        .map(contract => ({ value: contract.MaHopDong, label: `${contract.MaHopDong} · ${contract.TenPhong}` }));
    const roomOptions = exclude => state.rooms.filter(room => room.TenPhong !== exclude
        && room.TrangThaiPhong !== "Bảo trì" && room.TrangThaiPhong !== "Ngưng sử dụng"
        && Number(room.SoSinhVienHienTai || 0) < Number(room.SucChuaToiDa || 0))
        .map(room => ({ value: room.TenPhong, label: `${room.TenPhong} · ${room.TrangThaiPhong}` }));
    const studentOptions = ({ availableOnly = false } = {}) => {
        const activeIds = new Set(state.contracts.flatMap(contract => activeMembers(contract).map(member => member.MaSinhVien)));
        return state.students.filter(student => !availableOnly || !activeIds.has(student.MaSinhVien))
            .map(student => ({
                value: student.MaSinhVien,
                label: `${student.MaSinhVien} · ${student.HoTen}${student.TenPhong ? ` · ${student.TenPhong}` : ""}`
            }));
    };

    function renderHopDongModule() {
        ensureRoot("Quản lý hợp đồng theo phòng", "Hợp đồng, thành viên, đại diện thanh toán dịch vụ và gợi ý hoàn tiền.");
        content().innerHTML = `
            <div class="mb-4 flex flex-wrap gap-2">
                ${button("Tạo hợp đồng", "contract-create")}
                ${button("Làm mới", "contract-refresh", "", "bg-slate-700 text-white")}
                ${button("Chi tiết hợp đồng", "contract-history", "", "bg-slate-700 text-white")}
            </div>
            <form data-form="contract-filter" class="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-3">
                ${field("Phòng", "tenPhong")}
                ${select("Trạng thái hợp đồng", "trangThai", [
                    {value:"",label:"Tất cả"},
                    {value:"Còn hiệu lực",label:"Còn hiệu lực"},
                    {value:"Đã kết thúc",label:"Đã kết thúc"}
                ])}
                <button class="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">Lọc hợp đồng</button>
            </form>
            <div class="overflow-x-auto rounded-xl border bg-white">
                <table class="min-w-full text-left text-sm">
                    <thead class="bg-slate-100"><tr>
                        <th class="p-3">Hợp đồng / phòng / hạng</th><th class="p-3">Thành viên</th>
                        <th class="p-3">Sĩ số</th><th class="p-3">Thời hạn</th><th class="p-3">Trạng thái</th><th class="p-3">Thao tác</th>
                    </tr></thead><tbody data-contract-rows></tbody>
                </table>
            </div>`;
        loadContracts().catch(apiError);
    }
    function renderContractsTable() {
        const tbody = root?.querySelector("[data-contract-rows]");
        if (!tbody) return;
        tbody.innerHTML = state.contracts.map(contract => {
            const members = contract.sinhVien || [];
            const active = activeMembers(contract);
            return `<tr class="border-t align-top">
                <td class="p-3"><strong>${esc(contract.MaHopDong)}</strong><br>${esc(contract.TenPhong)} · ${esc(contract.TenHangPhong || contract.MaHangPhong)}<br>
                    <span class="text-xs text-slate-500">${esc(dateOnly(contract.NgayBatDau))} – ${esc(dateOnly(contract.NgayKetThuc))}</span></td>
                <td class="p-3">${members.map(member => `<div class="mb-2">
                    ${esc(memberName(member))}${member.LaNguoiDaiDienThanhToanDichVu ? " · Đại diện" : ""}
                    <span class="text-xs text-slate-500">(${esc(member.TrangThai)})</span>
                    ${member.TrangThai === "Đang ở" ? `
                        <div class="mt-1 flex flex-wrap gap-1">
                            ${button("Rời / gợi ý hoàn", "member-leave", `data-contract="${esc(contract.MaHopDong)}" data-detail="${esc(member.MaChiTiet)}"`, "bg-amber-600 text-white")}
                            ${button("Chuyển phòng", "member-move", `data-contract="${esc(contract.MaHopDong)}" data-student="${esc(member.MaSinhVien)}"`, "bg-slate-700 text-white")}
                            ${button("Đặt đại diện", "member-representative", `data-contract="${esc(contract.MaHopDong)}" data-detail="${esc(member.MaChiTiet)}"`, "bg-slate-700 text-white")}
                        </div>` : ""}
                    </div>`).join("") || "Chưa có thành viên"}</td>
                <td class="p-3">${Number(contract.SoSinhVienHienTai || active.length)} / ${Number(contract.SucChuaToiDa || 0)}</td>
                <td class="p-3">${esc(dateOnly(contract.NgayBatDau))}<br>${esc(dateOnly(contract.NgayKetThuc))}</td>
                <td class="p-3">${esc(contract.TrangThaiHopDong)}</td>
                <td class="p-3"><div class="flex flex-wrap gap-1">
                    ${contract.TrangThaiHopDong === "Còn hiệu lực" ? button("Thêm SV", "member-add", `data-contract="${esc(contract.MaHopDong)}"`, "bg-emerald-700 text-white") : ""}
                    ${contract.TrangThaiHopDong === "Còn hiệu lực" ? button("Gia hạn", "contract-extend", `data-contract="${esc(contract.MaHopDong)}"`, "bg-slate-700 text-white") : ""}
                    ${contract.TrangThaiHopDong === "Còn hiệu lực" ? button("Kết thúc", "contract-end", `data-contract="${esc(contract.MaHopDong)}"`, "bg-red-700 text-white") : ""}
                </div></td>
            </tr>`;
        }).join("") || `<tr><td colspan="6" class="p-6 text-center text-slate-500">Chưa có hợp đồng.</td></tr>`;
    }
    function contractDetailsTable(history) {
        return `<div class="max-h-[65vh] overflow-auto"><table class="w-full text-sm">
            <thead><tr><th class="p-2">Hợp đồng</th><th class="p-2">Sinh viên</th><th class="p-2">Phòng</th><th class="p-2">Thời gian</th><th class="p-2">Trạng thái</th></tr></thead>
            <tbody>${history.map(item => `<tr class="border-t"><td class="p-2">${esc(item.MaHopDong)}</td>
                <td class="p-2">${esc(item.HoTen)} · ${esc(item.MaSinhVien)}</td><td class="p-2">${esc(item.TenPhong)}</td>
                <td class="p-2">${esc(dateOnly(item.NgayVao))} – ${esc(dateOnly(item.NgayRa) || "Hiện tại")}</td>
                <td class="p-2">${esc(item.TrangThai)}</td></tr>`).join("") ||
                `<tr><td colspan="5" class="p-4 text-center">Không có chi tiết hợp đồng.</td></tr>`}</tbody>
            </table></div>`;
    }
    async function openCreateContract() {
        await Promise.all([loadContracts(), loadRoomsAndTiers(), loadStudents()]);
        const options = state.rooms.filter(room => room.TrangThaiPhong !== "Bảo trì" && room.TrangThaiPhong !== "Ngưng sử dụng"
            && Number(room.SoSinhVienHienTai || 0) < Number(room.SucChuaToiDa || 0))
            .map(room => ({ value: room.TenPhong, label: `${room.TenPhong} · ${room.MaHangPhong}` }));
        const modal = modalShell("Tạo hợp đồng và thêm thành viên", `
            <form id="admin-workflow-form" data-form="contract-create" class="space-y-3">
                ${select("Phòng", "tenPhong", options, "", true)}
                ${select("Hạng phòng", "maHangPhong", state.tiers.map(tier => ({ value: tier.MaHangPhong, label: `${tier.MaHangPhong} · ${tier.TenHangPhong}` })), "", true)}
                ${field("Ngày bắt đầu", "ngayBatDau", "date", today(), true)}
                ${field("Ngày kết thúc", "ngayKetThuc", "date", "", true)}
                <label class="block text-sm font-semibold">Ghi chú<textarea name="ghiChu" maxlength="255" class="mt-1 w-full rounded-lg border p-2"></textarea></label>
                <div class="flex items-center justify-between"><h4 class="font-bold">Sinh viên</h4>
                    <button type="button" data-action="add-member-row" class="rounded bg-slate-700 px-3 py-2 text-white">Thêm dòng SV</button></div>
                <div data-new-members class="space-y-2"></div>
            </form>`);
        if (!modal) return;
        modal.querySelector("[data-new-members]").innerHTML = memberFormRow();
    }
    function memberFormRow(member = {}) {
        return `<div class="member-row grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_130px_1fr_auto]">
            <select name="maSinhVien" required class="rounded border p-2">
                <option value="">Chọn sinh viên</option>
                ${studentOptions({ availableOnly: true }).map(student => `<option value="${esc(student.value)}" ${student.value === member.MaSinhVien ? "selected" : ""}>${esc(student.label)}</option>`).join("")}
            </select>
            <select name="kyHanThanhToanPhong" class="rounded border p-2"><option value="THANG">THANG</option><option value="NAM">NAM</option></select>
            <label class="flex items-center gap-2 text-sm"><input name="laNguoiDaiDien" type="checkbox"> Đại diện dịch vụ</label>
            <button type="button" data-action="remove-member-row" class="rounded bg-red-100 px-3 py-2 text-red-800">Bỏ</button>
        </div>`;
    }
    async function openAddMember(contractId) {
        await Promise.all([loadContracts(), loadStudents()]);
        modalShell(`Thêm sinh viên vào ${contractId}`, `
            <form id="admin-workflow-form" data-form="member-add" class="space-y-3">
                <input type="hidden" name="contractId" value="${esc(contractId)}">
                ${select("Sinh viên", "maSinhVien", studentOptions({ availableOnly: true }), "", true)}
                ${select("Kỳ hạn tiền phòng", "kyHanThanhToanPhong", [{value:"THANG",label:"Hàng tháng"},{value:"NAM",label:"Hàng năm"}], "THANG", true)}
                <label class="flex items-center gap-2"><input name="laNguoiDaiDien" type="checkbox"> Là người đại diện thanh toán dịch vụ</label>
            </form>`);
    }
    async function openLeaveFlow(contractId, detailId) {
        modalShell("Thành viên rời hợp đồng · gợi ý hoàn tiền", `
            <form id="admin-workflow-form" data-form="leave-preview" class="space-y-3">
                <input type="hidden" name="contractId" value="${esc(contractId)}">
                <input type="hidden" name="detailId" value="${esc(detailId)}">
                ${field("Ngày rời", "ngayRa", "date", today(), true)}
                ${select("Lý do", "lyDoRoi", [
                    {value:"Nghỉ học giữa chừng",label:"Nghỉ học giữa chừng"},
                    {value:"Chuyển đi",label:"Chuyển đi"},
                    {value:"Khác",label:"Khác"}
                ], "Chuyển đi", true)}
                <p class="text-sm text-slate-600">Xem gợi ý và xác nhận riêng trước khi ghi phiếu chi.</p>
            </form>`, "Tính gợi ý");
    }
    function renderRefundConfirmation(payload) {
        const modal = root.querySelector("[data-admin-modal]");
        modal.innerHTML = `
            <div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4">
                <section role="dialog" aria-modal="true" class="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
                    <h3 class="mb-4 text-xl font-bold">Xác nhận rời và lập phiếu chi</h3>
                    <form id="admin-workflow-form" data-form="leave-confirm" class="space-y-3">
                        <input type="hidden" name="contractId" value="${esc(payload.contractId)}">
                        <input type="hidden" name="detailId" value="${esc(payload.detailId)}">
                        <input type="hidden" name="ngayRa" value="${esc(payload.ngayRa)}">
                        <input type="hidden" name="lyDoRoi" value="${esc(payload.lyDoRoi)}">
                        <div class="grid gap-2 sm:grid-cols-2">
                            <p>Số tháng đã ở: <strong>${esc(payload.suggestion.SoThangDaSuDung)}</strong></p>
                            <p>Đã đóng: <strong>${money(payload.suggestion.SoTienDaDong)}</strong></p>
                            <p>Đã sử dụng: <strong>${money(payload.suggestion.TienSuDung)}</strong></p>
                            <p>Đã hoàn trước: <strong>${money(payload.suggestion.SoTienDaHoan)}</strong></p>
                            <p>Gợi ý hoàn: <strong data-suggestion>${money(payload.suggestion.GoiYHoan)}</strong></p>
                        </div>
                        ${field("Khấu trừ (VND)", "khauTru", "number", "0", true, 'min="0" step="1" inputmode="numeric"')}
                        ${field("Số tiền hoàn (VND)", "soTien", "number", String(Math.floor(Number(payload.suggestion.GoiYHoan || 0))), false, 'min="1" step="1" inputmode="numeric"')}
                        <label class="block text-sm font-semibold">Lý do điều chỉnh số hoàn<textarea name="ghiChu" maxlength="255" class="mt-1 w-full rounded-lg border p-2"></textarea></label>
                        ${select("Lý do rời", "lyDo", [
                            {value:"Nghỉ học giữa chừng",label:"Nghỉ học giữa chừng"},
                            {value:"Chuyển đi",label:"Chuyển đi"},
                            {value:"Khác",label:"Khác"}
                        ], payload.lyDoRoi, true)}
                        <p role="alert" data-refund-validation class="text-sm text-red-700"></p>
                    </form>
                    <p role="alert" data-modal-error class="mt-3 min-h-6 text-sm text-red-700"></p>
                    <div class="mt-4 flex justify-end gap-2 border-t pt-4">
                        <button type="button" data-action="modal-close" class="rounded-lg bg-slate-100 px-4 py-2">Hủy</button>
                        <button type="submit" form="admin-workflow-form" class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Xác nhận rời và lập phiếu chi</button>
                    </div>
                </section>
            </div>`;
        state.refundSuggestion = payload.suggestion;
    }

    async function loadInvoices(filters = {}) {
        const result = await request(`/api/HoaDon${queryString(filters)}`);
        if (!Array.isArray(result)) throw new Error("API hóa đơn trả về dữ liệu không đúng định dạng.");
        state.invoices = result;
        renderInvoiceRows();
    }
    async function renderHoaDonModule() {
        ensureRoot("Hóa đơn và thanh toán", "Lập hóa đơn theo kỳ, quản lý khoản phát sinh, phiếu thu/chi và giao dịch.");
        content().innerHTML = `
            <nav class="mb-4 flex flex-wrap gap-2" aria-label="Quản lý tài chính">
                ${["invoices", "expenses", "receipts", "payments", "refunds"].map((tab, index) =>
                    `<button type="button" data-action="invoice-tab" data-tab="${tab}" class="rounded-lg px-3 py-2 font-semibold ${state.activeInvoiceTab === tab ? "bg-emerald-700 text-white" : "bg-slate-200"}">${["Hóa đơn", "Chi phí phát sinh", "Phiếu thu", "Giao dịch", "Phiếu chi"][index]}</button>`
                ).join("")}
                ${button("Xuất theo kỳ", "invoice-create")}
            </nav>
            <section data-financial-pane></section>`;
        try {
            await loadContracts();
            renderFinancialPane();
        } catch (error) {
            apiError(error);
        }
    }
    function renderFinancialPane() {
        const pane = root?.querySelector("[data-financial-pane]");
        if (!pane) return;
        if (state.activeInvoiceTab === "invoices") {
            pane.innerHTML = `
                <form data-form="invoice-filter" class="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-5">
                    ${select("Loại", "loaiHoaDon", [
                        {value:"",label:"Tất cả"},
                        {value:"TIEN_PHONG",label:"Tiền phòng"},
                        {value:"DICH_VU_PHONG",label:"Dịch vụ phòng"},
                        {value:"PHAT_SINH",label:"Phát sinh"},
                        {value:"CU",label:"Cũ"}
                    ])}
                    ${field("Phòng", "tenPhong")}
                    ${field("Hợp đồng", "maHopDong")}
                    ${field("Mã sinh viên", "maSinhVien")}
                    ${field("Kỳ từ", "kyTu", "date")}
                    ${field("Kỳ đến", "kyDen", "date")}
                    ${select("Trạng thái", "trangThai", [
                        {value:"",label:"Tất cả"},
                        {value:"Chưa thanh toán",label:"Chưa thanh toán"},
                        {value:"Thanh toán một phần",label:"Thanh toán một phần"},
                        {value:"Đã thanh toán",label:"Đã thanh toán"},
                        {value:"Đã hủy",label:"Đã hủy"}
                    ])}
                    <button class="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white md:col-span-7">Lọc hóa đơn</button>
                </form>
                <div class="overflow-x-auto rounded-xl border bg-white"><table class="min-w-full text-left text-sm">
                    <thead class="bg-slate-100"><tr><th class="p-3">Mã / loại</th><th class="p-3">Phòng / hợp đồng</th><th class="p-3">Người</th><th class="p-3">Kỳ</th><th class="p-3">Tổng</th><th class="p-3">Đã thu</th><th class="p-3">Còn nợ</th><th class="p-3">Trạng thái</th><th class="p-3">Thao tác</th></tr></thead>
                    <tbody data-invoice-rows></tbody></table></div>`;
            loadInvoices().catch(apiError);
        } else if (state.activeInvoiceTab === "expenses") {
            pane.innerHTML = `
                <form data-form="expense-create" class="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-3">
                    ${select("Hợp đồng / phòng", "maHopDong", contractOptions(), "", true)}
                    ${select("Sinh viên (không bắt buộc)", "maChiTiet", [{value:"",label:"Không gắn sinh viên"}])}
                    ${field("Nội dung", "noiDung", "text", "", true, 'maxlength="255"')}
                    ${field("Số tiền VND", "soTien", "number", "", true, 'min="1" step="1" inputmode="numeric"')}
                    ${field("Ngày phát sinh", "ngayPhatSinh", "date", today(), true)}
                    <label class="block text-sm font-semibold">Ghi chú<textarea name="ghiChu" maxlength="255" class="mt-1 w-full rounded-lg border p-2"></textarea></label>
                    <button class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white md:col-span-3">Thêm chi phí phát sinh</button>
                </form>
                <div class="overflow-x-auto rounded-xl border bg-white"><table class="min-w-full text-left text-sm">
                    <thead class="bg-slate-100"><tr><th class="p-3">Khoản</th><th class="p-3">Phòng / HĐ</th><th class="p-3">Sinh viên</th><th class="p-3">Ngày</th><th class="p-3">Số tiền</th><th class="p-3">Trạng thái</th><th class="p-3">Thao tác</th></tr></thead><tbody data-expense-rows></tbody></table></div>`;
            loadExpenses().catch(apiError);
        } else if (state.activeInvoiceTab === "receipts") {
            pane.innerHTML = `<div class="overflow-x-auto rounded-xl border bg-white"><table class="min-w-full text-left text-sm">
                <thead class="bg-slate-100"><tr><th class="p-3">Phiếu / hóa đơn</th><th class="p-3">Phòng</th><th class="p-3">Người nộp</th><th class="p-3">Số tiền</th><th class="p-3">Thời điểm</th><th class="p-3">Phương thức</th><th class="p-3">Trạng thái</th><th class="p-3">Thao tác</th></tr></thead><tbody data-receipt-rows></tbody></table></div>`;
            loadReceipts().catch(apiError);
        } else if (state.activeInvoiceTab === "payments") {
            pane.innerHTML = `<div class="overflow-x-auto rounded-xl border bg-white"><table class="min-w-full text-left text-sm">
                <thead class="bg-slate-100"><tr><th class="p-3">Giao dịch</th><th class="p-3">Hóa đơn / phòng</th><th class="p-3">Người nộp</th><th class="p-3">Số tiền</th><th class="p-3">Phương thức</th><th class="p-3">Trạng thái</th><th class="p-3">Lý do đối soát</th></tr></thead><tbody data-payment-rows></tbody></table></div>`;
            loadPayments().catch(apiError);
        } else {
            pane.innerHTML = `<div class="overflow-x-auto rounded-xl border bg-white"><table class="min-w-full text-left text-sm">
                <thead class="bg-slate-100"><tr><th class="p-3">Phiếu chi</th><th class="p-3">Sinh viên / chi tiết</th><th class="p-3">Đã đóng</th><th class="p-3">Đã dùng</th><th class="p-3">Khấu trừ</th><th class="p-3">Đã hoàn</th><th class="p-3">Trạng thái</th><th class="p-3">Thao tác</th></tr></thead><tbody data-refund-rows></tbody></table></div>`;
            loadRefunds().catch(apiError);
        }
    }
    function renderInvoiceRows() {
        const tbody = root?.querySelector("[data-invoice-rows]");
        if (!tbody) return;
        tbody.innerHTML = state.invoices.map(invoice => `
            <tr class="border-t">
                <td class="p-3"><strong>${esc(invoice.MaHoaDon)}</strong><br>${esc(invoice.LoaiHoaDon || "—")}</td>
                <td class="p-3">${esc(invoice.TenPhong || "—")}<br><span class="text-xs text-slate-500">${esc(invoice.MaHopDong || "—")}</span></td>
                <td class="p-3">${esc(U.invoicePersonLabel(invoice))}</td>
                <td class="p-3">${esc(dateOnly(invoice.KyThanhToan) || dateOnly(invoice.NgayLap) || "—")}</td>
                <td class="p-3">${money(invoice.TongTien)}</td><td class="p-3">${money(invoice.DaThu)}</td>
                <td class="p-3 font-semibold">${money(invoice.ConNo)}</td><td class="p-3">${esc(invoice.TrangThaiThanhToan || "—")}</td>
                <td class="p-3"><div class="flex gap-1">
                    ${button("Chi tiết", "invoice-detail", `data-invoice="${esc(invoice.MaHoaDon)}"`)}
                    ${invoice.TrangThaiThanhToan !== "Đã hủy" ? button("Hủy", "invoice-cancel", `data-invoice="${esc(invoice.MaHoaDon)}"`, "bg-red-700 text-white") : ""}
                </div></td>
            </tr>`).join("") || `<tr><td colspan="9" class="p-5 text-center text-slate-500">Không có hóa đơn.</td></tr>`;
    }
    async function openInvoiceCreate() {
        if (!state.contracts.length || !state.tiers.length) await Promise.all([loadContracts(), loadRoomsAndTiers()]);
        if (!state.services) await loadServices();
        modalShell("Xuất hóa đơn theo kỳ", `
            <form id="admin-workflow-form" data-form="invoice-create" class="space-y-3">
                ${select("Loại hóa đơn", "loaiHoaDon", [
                    {value:"TIEN_PHONG",label:"Tiền phòng"},
                    {value:"DICH_VU_PHONG",label:"Dịch vụ phòng"}
                ], "TIEN_PHONG", true)}
                ${select("Hợp đồng", "maHopDong", contractOptions(), "", true)}
                <div data-invoice-member-field>${select("Thành viên lập hóa đơn tiền phòng", "maChiTiet", [], "", true)}</div>
                ${field("Kỳ thanh toán (ngày đầu tháng)", "kyThanhToan", "date", `${today().slice(0, 7)}-01`, true)}
                <div data-meter-fields></div>
            </form>`);
        const form = root.querySelector("#admin-workflow-form");
        await refreshInvoiceContext();
    }
    async function refreshInvoiceContext() {
        const form = root?.querySelector('#admin-workflow-form[data-form="invoice-create"]');
        if (!form) return;
        const contract = state.contracts.find(item => item.MaHopDong === form.elements.maHopDong.value);
        const isRent = form.elements.loaiHoaDon.value === "TIEN_PHONG";
        const memberField = form.querySelector("[data-invoice-member-field]");
        if (isRent) {
            memberField.innerHTML = select("Thành viên lập hóa đơn tiền phòng", "maChiTiet",
                activeMembers(contract || {}).map(member => ({ value: member.MaChiTiet, label: memberName(member) })), "", true);
        } else {
            memberField.replaceChildren();
        }
        const meterHost = form.querySelector("[data-meter-fields]");
        meterHost.replaceChildren();
        if (isRent || !contract) return;
        const tier = state.tiers.find(item => item.MaHangPhong === contract.MaHangPhong);
        const meters = (tier?.dichVu || []).filter(service =>
            service.CachTinh === "CHI_SO" && service.HoatDong
                && state.services.some(item => item.MaDichVu === service.MaDichVu && item.HoatDong)
        );
        if (!meters.length) {
            meterHost.innerHTML = `<p class="rounded bg-amber-50 p-3 text-sm">Hạng phòng không có dịch vụ chỉ số đang hoạt động cần nhập.</p>`;
            return;
        }
        meterHost.innerHTML = `<h4 class="font-semibold">Chỉ số bắt buộc</h4>${meters.map(service => `
            <div class="grid gap-2 rounded border p-3 md:grid-cols-[1fr_1fr_1fr]">
                <input type="hidden" name="meterService" value="${esc(service.MaDichVu)}">
                <span>${esc(service.TenDichVu)}</span>
                <label class="text-sm">Chỉ số cũ<input name="meterOld" type="number" min="0" step="1" required class="mt-1 w-full rounded border p-2"></label>
                <label class="text-sm">Chỉ số mới<input name="meterNew" type="number" min="0" step="1" required class="mt-1 w-full rounded border p-2"></label>
            </div>`).join("")}`;
    }
    async function openInvoiceDetail(invoiceId) {
        const invoice = await request(`/api/HoaDon/${encodeURIComponent(invoiceId)}`);
        if (!state.students.length) await loadStudents();
        state.invoiceDetail = invoice;
        const lines = (invoice.ChiTiet || []).map(line => `<tr class="border-t">
            <td class="p-2">${esc(line.TenKhoan)}</td><td class="p-2">${esc(line.ChiSoCu ?? "—")} → ${esc(line.ChiSoMoi ?? "—")}</td>
            <td class="p-2 text-right">${money(line.SoTien)}</td></tr>`).join("");
        const receipts = (invoice.PhieuThu || []).map(receipt => `<tr class="border-t">
            <td class="p-2">${esc(receipt.MaPhieuThu)}</td><td class="p-2">${esc(receipt.TenNguoiNop || receipt.MaSinhVienNop || "—")}</td>
            <td class="p-2">${money(receipt.SoTien)}</td><td class="p-2">${esc(receipt.TrangThai)}</td></tr>`).join("");
        const modal = modalShell(`Hóa đơn ${invoice.MaHoaDon}`, `
            <article data-print-area class="space-y-4">
                <div class="grid gap-2 md:grid-cols-3">
                    <p>Phòng: <strong>${esc(invoice.TenPhong || "—")}</strong></p>
                    <p>Hợp đồng: <strong>${esc(invoice.MaHopDong || "—")}</strong></p>
                    <p>Người: <strong>${esc(U.invoicePersonLabel(invoice))}</strong></p>
                    <p>Tổng: <strong>${money(invoice.TongTien)}</strong></p>
                    <p>Đã thu: <strong>${money(invoice.DaThu)}</strong></p>
                    <p>Còn nợ: <strong data-outstanding>${money(invoice.ConNo)}</strong></p>
                </div>
                <h4 class="font-bold">Chi tiết hóa đơn</h4>
                <div class="overflow-auto"><table class="w-full text-sm"><thead><tr><th class="p-2 text-left">Khoản</th><th class="p-2 text-left">Chỉ số</th><th class="p-2 text-right">Số tiền</th></tr></thead><tbody>${lines || `<tr><td colspan="3" class="p-2">Không có dòng chi tiết.</td></tr>`}</tbody></table></div>
                <h4 class="font-bold">Phiếu thu</h4>
                <div class="overflow-auto"><table class="w-full text-sm"><thead><tr><th class="p-2 text-left">Mã phiếu</th><th class="p-2 text-left">Người nộp</th><th class="p-2 text-left">Số tiền</th><th class="p-2 text-left">Trạng thái</th></tr></thead><tbody>${receipts || `<tr><td colspan="4" class="p-2">Chưa có phiếu thu.</td></tr>`}</tbody></table></div>
                ${button("In phiếu thu gần nhất", "receipt-print-latest", "", "bg-slate-700 text-white")}
            </article>
            <form id="admin-workflow-form" data-form="receipt-create" class="mt-5 grid gap-3 border-t pt-4 md:grid-cols-3">
                <input type="hidden" name="invoiceId" value="${esc(invoice.MaHoaDon)}">
                ${field("Số tiền VND (một phần)", "soTien", "number", "", true, 'min="1" step="1" inputmode="numeric"')}
                ${select("Phương thức", "phuongThuc", [{value:"CASH",label:"Tiền mặt"},{value:"ONLINE",label:"Chuyển khoản"}], "CASH", true)}
                ${select("Người nộp", "maSinhVienNop", [
                    {value:"",label:"Chọn nếu cần ghi nhận người nộp"},
                    ...state.students.map(student => ({value:student.MaSinhVien,label:`${student.HoTen} · ${student.MaSinhVien}`}))
                ], invoice.MaSinhVien || "", false)}
                ${field("Mã tham chiếu (nếu có)", "maThamChieu")}
                <button class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white md:col-span-3">Ghi phiếu thu</button>
            </form>`);
        if (modal) modal.querySelector("[data-modal-error]")?.classList.add("hidden");
    }
    async function loadExpenses() {
        state.expenses = await request("/api/ChiPhiPhatSinh");
        renderExpenses();
    }
    function renderExpenses() {
        const tbody = root?.querySelector("[data-expense-rows]");
        if (!tbody) return;
        tbody.innerHTML = state.expenses.map(expense => {
            const locked = expense.TrangThai !== "Chưa lập hóa đơn" || expense.MaHoaDon;
            return `<tr class="border-t">
                <td class="p-3">${esc(expense.NoiDung)}</td><td class="p-3">${esc(expense.TenPhong)} · ${esc(expense.MaHopDong)}</td>
                <td class="p-3">${esc(expense.HoTen || expense.MaSinhVien || "—")}</td><td class="p-3">${esc(dateOnly(expense.NgayPhatSinh))}</td>
                <td class="p-3">${money(expense.SoTien)}</td><td class="p-3">${esc(expense.TrangThai)}</td>
                <td class="p-3 flex flex-wrap gap-1">
                    ${locked ? "" : button("Sửa", "expense-edit", `data-expense="${esc(expense.MaChiPhi)}"`, "bg-slate-700 text-white")}
                    ${locked ? "" : button("Hủy", "expense-cancel", `data-expense="${esc(expense.MaChiPhi)}"`, "bg-red-700 text-white")}
                    ${!locked ? button("Lập hóa đơn riêng", "expense-invoice", `data-expense="${esc(expense.MaChiPhi)}"`) : esc(expense.MaHoaDon || "")}
                </td></tr>`;
        }).join("") || `<tr><td colspan="7" class="p-5 text-center">Chưa có khoản phát sinh.</td></tr>`;
        const form = root?.querySelector('[data-form="expense-create"]');
        const contractSelect = form?.elements.maHopDong;
        if (contractSelect) {
            const selected = contractSelect.value;
            const contract = state.contracts.find(item => item.MaHopDong === selected);
            const memberSelect = form.elements.maChiTiet;
            if (memberSelect) {
                const options = [{value:"",label:"Không gắn sinh viên"}, ...activeMembers(contract || {}).map(member => ({value:member.MaChiTiet,label:memberName(member)}))];
                memberSelect.innerHTML = options.map(item => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join("");
            }
        }
    }
    async function loadReceipts() {
        state.receipts = await request("/api/phieuthu");
        const tbody = root?.querySelector("[data-receipt-rows]");
        if (!tbody) return;
        tbody.innerHTML = state.receipts.map(receipt => `<tr class="border-t ${receipt.TrangThai === "Chờ xác nhận" ? "bg-amber-50" : ""}">
            <td class="p-3">${esc(receipt.MaPhieuThu)} / ${esc(receipt.MaHoaDon)}</td><td class="p-3">${esc(receipt.TenPhong || "—")}</td>
            <td class="p-3">${esc(receipt.TenNguoiNop || receipt.MaSinhVienNop || "—")}</td><td class="p-3">${money(receipt.SoTien)}</td>
            <td class="p-3">${esc(new Date(receipt.NgayThu).toLocaleString("vi-VN"))}</td><td class="p-3">${esc(receipt.PhuongThuc)}</td>
            <td class="p-3">${esc(receipt.TrangThai)}</td><td class="p-3 flex gap-1">
                ${receipt.TrangThai === "Chờ xác nhận" ? button("Xác nhận", "receipt-confirm", `data-receipt="${esc(receipt.MaPhieuThu)}"`) : ""}
                ${receipt.TrangThai === "Chờ xác nhận" ? button("Hủy", "receipt-cancel", `data-receipt="${esc(receipt.MaPhieuThu)}"`, "bg-red-700 text-white") : ""}
                ${button("In", "receipt-print", `data-receipt="${esc(receipt.MaPhieuThu)}"`, "bg-slate-700 text-white")}
            </td></tr>`).join("") || `<tr><td colspan="8" class="p-5 text-center">Chưa có phiếu thu.</td></tr>`;
    }
    async function loadPayments() {
        state.payments = await request("/api/payments/history");
        const tbody = root?.querySelector("[data-payment-rows]");
        if (!tbody) return;
        tbody.innerHTML = state.payments.map(payment => {
            const reconciliation = payment.TrangThai === "Cần đối soát" || payment.TrangThai === "RECONCILIATION";
            return `<tr class="border-t ${reconciliation ? "bg-amber-100 font-semibold text-amber-950" : ""}">
                <td class="p-3">${esc(payment.MaGiaoDich || "—")}</td>
                <td class="p-3">${esc(payment.MaHoaDon || "Chưa liên kết")} · ${esc(payment.TenPhong || "—")}</td>
                <td class="p-3">${esc(payment.HoTen || payment.MaSinhVien || "—")}</td><td class="p-3">${money(payment.SoTien)}</td>
                <td class="p-3">${esc(payment.PhuongThuc || "—")}</td><td class="p-3">${reconciliation ? "⚠ Cần đối soát" : esc(payment.TrangThai || "—")}</td>
                <td class="p-3">${esc(payment.LyDoDoiSoat || "—")}</td></tr>`;
        }).join("") || `<tr><td colspan="7" class="p-5 text-center">Chưa có giao dịch.</td></tr>`;
    }
    async function loadRefunds() {
        state.refunds = await request("/api/phieuchi");
        const tbody = root?.querySelector("[data-refund-rows]");
        if (!tbody) return;
        tbody.innerHTML = state.refunds.map(refund => `<tr class="border-t">
            <td class="p-3">#${esc(refund.MaPhieuChi)}<br>${esc(dateOnly(refund.NgayChi))}</td>
            <td class="p-3">${esc(refund.HoTen || refund.MaSinhVien || "—")}<br>Chi tiết ${esc(refund.MaChiTiet)}</td>
            <td class="p-3">${money(refund.SoTienDaDong)}</td><td class="p-3">${money(refund.SoTienDaSuDung)}</td>
            <td class="p-3">${money(refund.KhauTru)}</td><td class="p-3">${money(refund.SoTien)}</td>
            <td class="p-3">${esc(refund.TrangThai)}</td>
            <td class="p-3">${button("In phiếu chi", "refund-print", `data-refund="${esc(refund.MaPhieuChi)}"`, "bg-slate-700 text-white")}</td>
        </tr>`).join("") || `<tr><td colspan="8" class="p-5 text-center">Chưa có phiếu chi.</td></tr>`;
    }

    async function renderPhongModule() {
        ensureRoot("Phòng, hạng phòng và dịch vụ", "Giá phòng lấy theo hạng; điều chỉnh giá tại cấu hình hạng phòng, không nhập giá cho từng phòng.");
        content().innerHTML = `
            <nav class="mb-4 flex gap-2">
                ${button("Phòng", "room-tab", 'data-tab="rooms"')}
                ${button("Hạng phòng & dịch vụ", "room-tab", 'data-tab="tiers"')}
            </nav><section data-room-pane></section>`;
        try {
            await loadRoomsAndTiers();
            renderRoomPane();
        } catch (error) {
            apiError(error);
        }
    }
    function renderRoomPane() {
        const pane = root?.querySelector("[data-room-pane]");
        if (!pane) return;
        if (state.activeRoomTab === "rooms") {
            pane.innerHTML = `<div class="overflow-x-auto rounded-xl border bg-white"><table class="min-w-full text-left text-sm">
                <thead class="bg-slate-100"><tr><th class="p-3">Phòng</th><th class="p-3">Khu / loại</th><th class="p-3">Hạng</th><th class="p-3">Sĩ số</th><th class="p-3">Giá hạng/tháng</th><th class="p-3">Trạng thái</th><th class="p-3">Thao tác</th></tr></thead>
                <tbody>${state.rooms.map(room => `<tr class="border-t">
                    <td class="p-3">${esc(room.TenPhong)}</td><td class="p-3">${esc(room.Khu)} · ${esc(room.LoaiPhong)}</td>
                    <td class="p-3">${esc(room.MaHangPhong || "—")}</td><td class="p-3">${Number(room.SoSinhVienHienTai || 0)} / ${Number(room.SucChuaToiDa || 0)}</td>
                    <td class="p-3">${money(room.GiaPhong)}</td><td class="p-3">${esc(room.TrangThaiPhong)}</td>
                    <td class="p-3">${button("Sửa phòng", "room-edit", `data-room="${esc(room.TenPhong)}"`)}</td></tr>`).join("")}</tbody>
            </table></div>`;
        } else {
            pane.innerHTML = `<div class="grid gap-4 lg:grid-cols-2">${state.tiers.map(tier => `
                <form data-form="tier-update" data-tier="${esc(tier.MaHangPhong)}" class="space-y-3 rounded-xl border bg-white p-4">
                    <h3 class="font-bold">${esc(tier.TenHangPhong)} · ${esc(tier.MaHangPhong)}</h3>
                    <div class="grid grid-cols-3 gap-2">
                        ${field("Tên hạng", "tenHangPhong", "text", tier.TenHangPhong, true)}
                        ${field("Sức chứa", "sucChuaToiDa", "number", tier.SucChuaToiDa, true, 'min="1" step="1"')}
                        ${field("Giá tháng", "giaPhongThang", "number", tier.GiaPhongThang, true, 'min="0" step="1"')}
                        ${field("Giá năm", "giaPhongNam", "number", tier.GiaPhongNam, true, 'min="0" step="1"')}
                    </div>
                    <h4 class="font-semibold">Dịch vụ theo hạng</h4>
                    <div data-tier-services class="space-y-2">
                        ${(tier.dichVu || []).map(service => tierServiceRow(service, service.MaDichVu)).join("") || `<p class="text-sm text-slate-500" data-no-services>Chưa cấu hình dịch vụ.</p>`}
                    </div>
                    ${button("Thêm dịch vụ vào hạng", "tier-service-add", `data-tier="${esc(tier.MaHangPhong)}"`, "bg-slate-700 text-white")}
                    <button class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Lưu hạng và dịch vụ</button>
                </form>`).join("")}</div>
                <form data-form="service-create" class="mt-5 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
                    <h3 class="font-bold md:col-span-4">Thêm dịch vụ</h3>
                    ${field("Mã dịch vụ", "maDichVu", "text", "", true, 'maxlength="20"')}
                    ${field("Tên dịch vụ", "tenDichVu", "text", "", true, 'maxlength="100"')}
                    ${field("Đơn vị", "donVi", "text", "", true, 'maxlength="20"')}
                    <label class="flex items-center gap-2 text-sm"><input name="hoatDong" type="checkbox" checked> Hoạt động</label>
                    <button class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white md:col-span-4">Tạo dịch vụ</button>
                </form>
                <div class="mt-5 overflow-x-auto rounded-xl border bg-white"><table class="min-w-full text-left text-sm">
                    <thead class="bg-slate-100"><tr><th class="p-3">Dịch vụ</th><th class="p-3">Đơn vị</th><th class="p-3">Trạng thái</th><th class="p-3">Hạng / giá</th><th class="p-3">Thao tác</th></tr></thead>
                    <tbody>${state.services?.map(service => `<tr class="border-t">
                        <td class="p-3">${esc(service.TenDichVu)}</td><td class="p-3">${esc(service.DonVi)}</td>
                        <td class="p-3">${service.CanhBao ? `<strong class="rounded bg-amber-100 px-2 py-1 text-amber-900">⚠ chưa có đơn giá</strong>` : esc(service.HoatDong ? "Hoạt động" : "Ngừng hoạt động")}</td>
                        <td class="p-3">${(service.hangPhong || []).map(entry => `${esc(entry.TenHangPhong)}: ${money(entry.DonGia)}${entry.CanhBao ? " · chưa có đơn giá" : ""}`).join("<br>") || "Chưa gắn hạng"}</td>
                        <td class="p-3">${button("Sửa", "service-edit", `data-service="${esc(service.MaDichVu)}"`)}</td>
                    </tr>`).join("") || ""}</tbody>
                </table></div>`;
        }
    }
    function tierServiceRow(service = {}, selectedId = "") {
        const id = selectedId || service.MaDichVu || "";
        const warning = !service.DonGia || !service.HoatDong || service.CanhBao;
        return `<div data-tier-service-row class="grid gap-2 rounded border-t py-2 md:grid-cols-5">
            <select name="serviceId" required aria-label="Dịch vụ" class="rounded border p-2">
                <option value="">Chọn dịch vụ</option>
                ${(state.services || []).map(item => `<option value="${esc(item.MaDichVu)}" ${item.MaDichVu === id ? "selected" : ""}>${esc(item.TenDichVu)}</option>`).join("")}
            </select>
            <input name="servicePrice" aria-label="Đơn giá dịch vụ" type="number" min="0" step="1" value="${esc(service.DonGia ?? 0)}" class="rounded border p-2">
            <select name="serviceMethod" aria-label="Cách tính" class="rounded border p-2">
                ${["CO_DINH_KY", "CHI_SO"].map(value => `<option value="${value}" ${service.CachTinh === value ? "selected" : ""}>${value === "CHI_SO" ? "Chỉ số" : "Cố định theo kỳ"}</option>`).join("")}
            </select>
            <select name="servicePayer" aria-label="Đối tượng thanh toán" class="rounded border p-2">
                ${["PHONG", "CA_NHAN"].map(value => `<option value="${value}" ${(service.DoiTuongThanhToan || "PHONG") === value ? "selected" : ""}>${value === "PHONG" ? "Theo phòng" : "Theo cá nhân"}</option>`).join("")}
            </select>
            <div class="flex items-center justify-between gap-2">
                <label class="flex items-center gap-2 text-sm"><input name="serviceActive" type="checkbox" ${service.HoatDong !== false ? "checked" : ""}> Hoạt động</label>
                <strong data-rate-warning class="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 ${warning ? "" : "hidden"}">⚠ chưa có đơn giá</strong>
                ${button("Bỏ", "tier-service-remove", "", "bg-red-100 text-red-800")}
            </div>
        </div>`;
    }
    async function openRoomEdit(roomName) {
        const room = state.rooms.find(item => item.TenPhong === roomName);
        if (!room) return;
        modalShell(`Cập nhật phòng ${roomName}`, `
            <form id="admin-workflow-form" data-form="room-update" class="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="roomName" value="${esc(room.TenPhong)}">
                ${select("Khu", "Khu", ["A","B","C"].map(value => ({value,label:value})), room.Khu, true)}
                ${select("Loại phòng", "LoaiPhong", ["Nam","Nữ"].map(value => ({value,label:value})), room.LoaiPhong, true)}
                ${select("Hạng phòng", "MaHangPhong", state.tiers.map(tier => ({value:tier.MaHangPhong,label:`${tier.MaHangPhong} · ${tier.TenHangPhong}`})), room.MaHangPhong, true)}
                ${select("Trạng thái", "TrangThaiPhong", ["Trống","Đầy","Bảo trì","Ngưng sử dụng"].map(value => ({value,label:value})), room.TrangThaiPhong, true)}
                <p class="sm:col-span-2">Giá hiện tại theo hạng: <strong>${money(room.GiaPhong)}</strong>. Không thể đặt giá riêng cho phòng.</p>
                <label class="sm:col-span-2">Ghi chú<textarea name="GhiChu" maxlength="255" class="mt-1 w-full rounded border p-2">${esc(room.GhiChu || "")}</textarea></label>
            </form>`);
    }

    async function renderBaoCaoThongKeModule() {
        ensureRoot("Báo cáo doanh thu và công nợ", "Doanh thu ròng = phiếu thu hợp lệ − phiếu chi hợp lệ; công nợ gồm tiền phòng, dịch vụ và phát sinh.");
        content().innerHTML = `
            <div class="mb-4 flex items-end gap-2">
                ${field("Năm", "reportYear", "number", new Date().getFullYear(), true, 'min="2000" max="2100" step="1"')}
                <button type="button" data-action="report-load" class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Tải báo cáo</button>
            </div>
            <section data-report-revenue class="overflow-x-auto rounded-xl border bg-white"></section>
            <h2 class="mt-6 text-xl font-bold">Công nợ</h2>
            <section data-report-debt class="overflow-x-auto rounded-xl border bg-white"></section>`;
        try {
            await loadReport(new Date().getFullYear());
        } catch (error) {
            apiError(error);
        }
    }
    async function loadReport(year) {
        const [revenue, debts] = await Promise.all([
            request(`/api/doanhthu/${encodeURIComponent(year)}`),
            request("/api/congno")
        ]);
        const months = Array.isArray(revenue.thang) ? revenue.thang : [];
        if (!months.length || !Array.isArray(debts)) throw new Error("API báo cáo trả về dữ liệu không đúng định dạng.");
        root.querySelector("[data-report-revenue]").innerHTML = `<table class="min-w-full text-left text-sm">
            <thead class="bg-slate-100"><tr><th class="p-3">Tháng</th><th class="p-3">Thu phòng</th><th class="p-3">Chi phòng</th><th class="p-3">Ròng phòng</th><th class="p-3">Thu dịch vụ</th><th class="p-3">Chi dịch vụ</th><th class="p-3">Ròng dịch vụ</th><th class="p-3">Thu phát sinh</th><th class="p-3">Chi phát sinh</th><th class="p-3">Ròng phát sinh</th><th class="p-3">Tổng thu</th><th class="p-3">Tổng chi</th><th class="p-3">Doanh thu ròng</th></tr></thead>
            <tbody>${months.map(month => `<tr class="border-t">
                <td class="p-3">${esc(month.Thang)}/${esc(year)}</td><td class="p-3">${money(month.ThuTienPhong)}</td><td class="p-3">${money(month.ChiTienPhong)}</td>
                <td class="p-3">${money(month.DoanhThuTienPhong)}</td>
                <td class="p-3">${money(month.ThuDichVu)}</td><td class="p-3">${money(month.ChiDichVu)}</td>
                <td class="p-3">${money(month.DoanhThuDichVu)}</td>
                <td class="p-3">${money(month.ThuPhatSinh)}</td><td class="p-3">${money(month.ChiPhatSinh)}</td>
                <td class="p-3">${money(month.DoanhThuPhatSinh)}</td>
                <td class="p-3">${money(month.TongThu)}</td><td class="p-3">${money(month.TongChi)}</td>
                <td class="p-3 font-bold">${money(month.DoanhThuRong ?? month.TongDoanhThu)}</td>
            </tr>`).join("")}</tbody></table>`;
        root.querySelector("[data-report-debt]").innerHTML = `<table class="min-w-full text-left text-sm">
            <thead class="bg-slate-100"><tr><th class="p-3">Loại</th><th class="p-3">Phòng</th><th class="p-3">Hợp đồng</th><th class="p-3">Người</th><th class="p-3">Tổng hóa đơn</th><th class="p-3">Đã thu</th><th class="p-3">Còn nợ</th></tr></thead>
            <tbody>${debts.map(debt => `<tr class="border-t">
                <td class="p-3">${esc(debt.LoaiHoaDon)}</td><td class="p-3">${esc(debt.TenPhong || "—")}</td>
                <td class="p-3">${esc(debt.MaHopDong || "—")}</td><td class="p-3">${esc(debt.HoTen || debt.MaSinhVien || "Theo phòng/hợp đồng")}</td>
                <td class="p-3">${money(debt.TongHoaDon)}</td><td class="p-3">${money(debt.DaThu)}</td><td class="p-3 font-semibold">${money(debt.TongCongNo)}</td>
            </tr>`).join("") || `<tr><td colspan="7" class="p-5 text-center">Không có công nợ.</td></tr>`}</tbody></table>`;
    }

    function renderThanhToanDemoModule() {
        ensureRoot("Giao dịch thanh toán", "Dữ liệu trực tiếp từ API thanh toán. Giao dịch cần đối soát được làm nổi bật.");
        content().innerHTML = `
            <div class="mb-4 flex gap-2">${button("Tải lại", "payments-refresh")}${button("Danh sách phiếu thu", "payments-receipts", "", "bg-slate-700 text-white")}</div>
            <div class="overflow-x-auto rounded-xl border bg-white"><table class="min-w-full text-left text-sm">
                <thead class="bg-slate-100"><tr><th class="p-3">Mã giao dịch</th><th class="p-3">Hóa đơn</th><th class="p-3">Phòng</th><th class="p-3">Người nộp</th><th class="p-3">Số tiền</th><th class="p-3">Phương thức</th><th class="p-3">Trạng thái</th><th class="p-3">Lý do</th></tr></thead><tbody data-payment-rows></tbody></table></div>`;
        loadPayments().catch(apiError);
    }

    function renderPaymentRows() {
        const tbody = root?.querySelector("[data-payment-rows]");
        if (!tbody) return;
        tbody.innerHTML = state.payments.map(payment => {
            const reconciliation = payment.TrangThai === "Cần đối soát" || payment.TrangThai === "RECONCILIATION";
            return `<tr class="border-t ${reconciliation ? "bg-amber-100 font-semibold text-amber-950" : ""}">
                <td class="p-3">${esc(payment.MaGiaoDich || "—")}</td><td class="p-3">${esc(payment.MaHoaDon || "Chưa liên kết")}</td>
                <td class="p-3">${esc(payment.TenPhong || "—")}</td><td class="p-3">${esc(payment.HoTen || payment.MaSinhVien || "—")}</td>
                <td class="p-3">${money(payment.SoTien)}</td><td class="p-3">${esc(payment.PhuongThuc || "—")}</td>
                <td class="p-3">${reconciliation ? "⚠ Cần đối soát" : esc(payment.TrangThai || "—")}</td>
                <td class="p-3">${esc(payment.LyDoDoiSoat || "—")}</td></tr>`;
        }).join("") || `<tr><td colspan="8" class="p-5 text-center">Chưa có giao dịch.</td></tr>`;
    }

    function printReceipt(receipt) {
        const amount = Number(receipt.SoTien);
        if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Số tiền trên phiếu không hợp lệ.");
        state.invoiceReceipt = receipt;
        const printHost = root.querySelector("[data-admin-modal]");
        printHost.innerHTML = `<div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 print:static print:block print:bg-white print:p-0">
            <article class="receipt-paper w-full max-w-2xl rounded-xl bg-white p-8 shadow-xl">
                <header class="text-center"><h2 class="text-2xl font-bold">PHIẾU THU</h2><p>Mã phiếu: ${esc(receipt.MaPhieuThu)}</p></header>
                <dl class="mt-6 grid grid-cols-2 gap-3">
                    <dt>Hóa đơn</dt><dd>${esc(receipt.MaHoaDon)}</dd><dt>Phòng</dt><dd>${esc(receipt.TenPhong || "—")}</dd>
                    <dt>Người nộp</dt><dd>${esc(receipt.TenNguoiNop || receipt.MaSinhVienNop || "—")}</dd>
                    <dt>Người thu</dt><dd>${esc(receipt.TenNguoiThu || "—")}</dd><dt>Số tiền</dt><dd>${money(amount)}</dd>
                    <dt>Bằng chữ</dt><dd class="col-span-1">${esc(U.amountInWords(amount))}</dd>
                    <dt>Ngày thu</dt><dd>${esc(new Date(receipt.NgayThu).toLocaleString("vi-VN"))}</dd>
                </dl>
                <div class="mt-12 flex justify-around text-center"><p>Người nộp<br><br><br>Ký, ghi rõ họ tên</p><p>Người thu<br><br><br>Ký, ghi rõ họ tên</p></div>
                <div class="mt-6 flex justify-end gap-2 print:hidden">
                    <button type="button" data-action="modal-close" class="rounded bg-slate-200 px-4 py-2">Đóng</button>
                    <button type="button" data-action="print-document" class="rounded bg-emerald-700 px-4 py-2 text-white">In phiếu</button>
                </div>
            </article></div>`;
        printHost.classList.remove("hidden");
        printDocument();
    }
    function printRefund(refund) {
        const modal = root.querySelector("[data-admin-modal]");
        modal.innerHTML = `<div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 print:static print:block print:bg-white print:p-0">
            <article class="receipt-paper w-full max-w-2xl rounded-xl bg-white p-8 shadow-xl">
                <header class="text-center"><h2 class="text-2xl font-bold">PHIẾU CHI / HOÀN TIỀN</h2><p>Mã phiếu: ${esc(refund.MaPhieuChi)}</p></header>
                <dl class="mt-6 grid grid-cols-2 gap-3">
                    <dt>Sinh viên</dt><dd>${esc(refund.HoTen || refund.MaSinhVien || "—")}</dd>
                    <dt>Mã chi tiết</dt><dd>${esc(refund.MaChiTiet)}</dd><dt>Đã đóng</dt><dd>${money(refund.SoTienDaDong)}</dd>
                    <dt>Đã sử dụng</dt><dd>${money(refund.SoTienDaSuDung)}</dd><dt>Khấu trừ</dt><dd>${money(refund.KhauTru)}</dd>
                    <dt>Số tiền hoàn</dt><dd>${money(refund.SoTien)} (${esc(U.amountInWords(Number(refund.SoTien)))})</dd>
                    <dt>Ngày chi</dt><dd>${esc(new Date(refund.NgayChi).toLocaleString("vi-VN"))}</dd>
                    <dt>Lý do</dt><dd>${esc(refund.LyDo)}</dd><dt>Ghi chú</dt><dd>${esc(refund.GhiChu || "—")}</dd>
                </dl>
                <div class="mt-12 flex justify-around text-center"><p>Người nhận<br><br><br>Ký, ghi rõ họ tên</p><p>Người lập<br><br><br>Ký, ghi rõ họ tên</p></div>
                <div class="mt-6 flex justify-end gap-2 print:hidden">
                    <button type="button" data-action="modal-close" class="rounded bg-slate-200 px-4 py-2">Đóng</button>
                    <button type="button" data-action="print-document" class="rounded bg-emerald-700 px-4 py-2 text-white">In phiếu</button>
                </div>
            </article></div>`;
        modal.classList.remove("hidden");
        printDocument();
    }
    async function receiptForId(id) {
        if (!state.receipts.length) await loadReceipts();
        const receipt = state.receipts.find(item => String(item.MaPhieuThu) === String(id));
        if (!receipt) throw new Error("Không tìm thấy phiếu thu cần in.");
        printReceipt(receipt);
    }
    async function printLatestReceipt() {
        const invoice = state.invoiceDetail;
        const receipt = (invoice?.PhieuThu || []).find(item => item.TrangThai === "Hợp lệ");
        if (!receipt) throw new Error("Hóa đơn chưa có phiếu thu hợp lệ để in.");
        printReceipt({ ...receipt, TenPhong: invoice.TenPhong, TenNguoiNop: receipt.TenNguoiNop, TenNguoiThu: receipt.TenNguoiThu });
    }

    async function handleClick(event) {
        const actionButton = event.target.closest("[data-action]");
        if (!actionButton || !root.contains(actionButton)) return;
        const { action } = actionButton.dataset;
        try {
            switch (action) {
                case "modal-close": closeModal(); break;
                case "add-member-row": root.querySelector("[data-new-members]").insertAdjacentHTML("beforeend", memberFormRow()); break;
                case "remove-member-row": actionButton.closest(".member-row")?.remove(); break;
                case "contract-create": await openCreateContract(); break;
                case "contract-refresh": await loadContracts(); break;
                case "contract-history": {
                    const history = await request("/api/chitiethopdong");
                    modalShell("Chi tiết hợp đồng", `<form id="admin-workflow-form" data-form="contract-detail-filter" class="mb-3 grid gap-2 md:grid-cols-3">
                            ${field("Mã hợp đồng", "maHopDong")}
                            ${field("Mã sinh viên", "maSinhVien")}
                            ${select("Trạng thái thành viên", "trangThai", [
                                {value:"",label:"Tất cả"},
                                {value:"Đang ở",label:"Đang ở"},
                                {value:"Đã rời",label:"Đã rời"}
                            ])}
                        </form>
                        <div data-contract-details>${contractDetailsTable(history)}</div>`);
                    break;
                }
                case "member-add": await openAddMember(actionButton.dataset.contract); break;
                case "member-leave": await openLeaveFlow(actionButton.dataset.contract, actionButton.dataset.detail); break;
                case "member-move": {
                    const contract = state.contracts.find(item => item.MaHopDong === actionButton.dataset.contract);
                    if (!state.rooms.length) await loadRoomsAndTiers();
                    const modal = modalShell("Chuyển phòng thành viên", `<form id="admin-workflow-form" data-form="member-move" class="space-y-3">
                        <input type="hidden" name="contractId" value="${esc(actionButton.dataset.contract)}">
                        <input type="hidden" name="maSinhVien" value="${esc(actionButton.dataset.student)}">
                        ${select("Phòng đích", "tenPhong", roomOptions(contract?.TenPhong), "", true)}</form>`);
                    break;
                }
                case "member-representative": {
                    if (!window.confirm("Đặt thành viên này làm đại diện thanh toán dịch vụ?")) break;
                    await request(`/api/HopDong/${encodeURIComponent(actionButton.dataset.contract)}/dai-dien`, {
                        method: "PUT", body: json({ maChiTiet: Number(actionButton.dataset.detail) })
                    });
                    await loadContracts();
                    break;
                }
                case "contract-extend": {
                    const contract = state.contracts.find(item => item.MaHopDong === actionButton.dataset.contract);
                    modalShell("Gia hạn hợp đồng", `<form id="admin-workflow-form" data-form="contract-extend">
                        <input type="hidden" name="contractId" value="${esc(contract.MaHopDong)}">
                        ${field("Ngày kết thúc mới", "ngayKetThuc", "date", dateOnly(contract.NgayKetThuc), true)}
                    </form>`);
                    break;
                }
                case "contract-end":
                    if (!window.confirm("Kết thúc hợp đồng này? Thao tác có thể cập nhật trạng thái thành viên/phòng.")) break;
                    await request(`/api/HopDong/${encodeURIComponent(actionButton.dataset.contract)}/ket-thuc`, {
                        method: "PUT", body: json({ ngayKetThucThucTe: today() })
                    });
                    await loadContracts();
                    break;
                case "invoice-tab":
                    state.activeInvoiceTab = actionButton.dataset.tab;
                    renderFinancialPane();
                    break;
                case "invoice-create": await openInvoiceCreate(); break;
                case "invoice-detail": await openInvoiceDetail(actionButton.dataset.invoice); break;
                case "invoice-cancel":
                    if (!window.confirm(`Hủy hóa đơn ${actionButton.dataset.invoice}?`)) break;
                    await request(`/api/HoaDon/${encodeURIComponent(actionButton.dataset.invoice)}/huy`, { method: "PUT", body: "{}" });
                    await loadInvoices();
                    break;
                case "expense-edit": await openExpenseEdit(actionButton.dataset.expense); break;
                case "expense-cancel":
                    if (!window.confirm("Hủy khoản phát sinh chưa lập hóa đơn?")) break;
                    await request(`/api/ChiPhiPhatSinh/${encodeURIComponent(actionButton.dataset.expense)}/huy`, { method: "PUT", body: "{}" });
                    await loadExpenses();
                    break;
                case "expense-invoice":
                    if (!window.confirm("Lập hóa đơn riêng cho khoản phát sinh này?")) break;
                    await request(`/api/ChiPhiPhatSinh/${encodeURIComponent(actionButton.dataset.expense)}/tao-hoa-don`, { method: "POST", body: "{}" });
                    await loadExpenses();
                    break;
                case "receipt-confirm":
                    setBusy(actionButton, true);
                    await request(`/api/phieuthu/${encodeURIComponent(actionButton.dataset.receipt)}/xac-nhan`, { method: "PUT", body: "{}" });
                    await loadReceipts();
                    break;
                case "receipt-cancel":
                    if (!window.confirm("Hủy phiếu thu đang chờ xác nhận?")) break;
                    setBusy(actionButton, true);
                    await request(`/api/phieuthu/${encodeURIComponent(actionButton.dataset.receipt)}/huy`, { method: "PUT", body: json({ lyDo: "Hủy phiếu thu theo xác nhận quản lý." }) });
                    await loadReceipts();
                    break;
                case "receipt-print": await receiptForId(actionButton.dataset.receipt); break;
                case "receipt-print-latest": await printLatestReceipt(); break;
                case "refund-print": {
                    if (!state.refunds.length) await loadRefunds();
                    const refund = state.refunds.find(item => String(item.MaPhieuChi) === String(actionButton.dataset.refund));
                    if (!refund) throw new Error("Không tìm thấy phiếu chi cần in.");
                    printRefund(refund);
                    break;
                }
                case "room-tab":
                    state.activeRoomTab = actionButton.dataset.tab;
                    if (state.activeRoomTab === "tiers") await loadServices();
                    renderRoomPane();
                    break;
                case "room-edit": await openRoomEdit(actionButton.dataset.room); break;
                case "service-edit": await openServiceEdit(actionButton.dataset.service); break;
                case "tier-service-add": {
                    const form = actionButton.closest('form[data-form="tier-update"]');
                    const serviceContainer = form?.querySelector("[data-tier-services]");
                    const used = new Set([...form.querySelectorAll('[name="serviceId"]')].map(item => item.value));
                    const next = state.services.find(service => !used.has(service.MaDichVu));
                    if (!next) throw new Error("Mọi dịch vụ hiện có đã được thêm vào hạng này.");
                    form.querySelector("[data-no-services]")?.remove();
                    serviceContainer.insertAdjacentHTML("beforeend", tierServiceRow({
                        MaDichVu: next.MaDichVu, TenDichVu: next.TenDichVu,
                        DonGia: 0, CachTinh: "CO_DINH_KY", DoiTuongThanhToan: "PHONG", HoatDong: true
                    }, next.MaDichVu));
                    break;
                }
                case "tier-service-remove":
                    actionButton.closest("[data-tier-service-row]")?.remove();
                    break;
                case "report-load": {
                    const year = Number(root.querySelector('[name="reportYear"]').value);
                    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Năm phải là số nguyên từ 2000 đến 2100.");
                    setBusy(actionButton, true);
                    await loadReport(year);
                    setBusy(actionButton, false);
                    break;
                }
                case "payments-refresh": state.payments = await request("/api/payments/history"); renderPaymentRows(); break;
                case "payments-receipts":
                    state.activeInvoiceTab = "receipts";
                    renderHoaDonModule();
                    break;
                case "print-document": printDocument(); break;
                default: break;
            }
            function printDocument() {
                document.body.classList.add("admin-printing");
                window.print();
            }
        } catch (error) {
            setBusy(actionButton, false);
            apiError(error);
            const modalError = root.querySelector("[data-modal-error]");
            if (modalError) modalError.textContent = error.message || "Không thể hoàn tất thao tác.";
        }
    }
    async function openExpenseEdit(expenseId) {
        const expense = state.expenses.find(item => String(item.MaChiPhi) === String(expenseId));
        if (!expense || expense.TrangThai !== "Chưa lập hóa đơn" || expense.MaHoaDon) {
            throw new Error("Khoản đã lập hóa đơn hoặc đã hủy, không thể sửa.");
        }
        modalShell("Sửa chi phí phát sinh", `<form id="admin-workflow-form" data-form="expense-edit">
            <input type="hidden" name="expenseId" value="${esc(expense.MaChiPhi)}">
            ${select("Hợp đồng", "maHopDong", contractOptions(false), expense.MaHopDong, true)}
            ${select("Sinh viên (không bắt buộc)", "maChiTiet", [
                {value:"",label:"Không gắn sinh viên"},
                ...state.contracts.find(item => item.MaHopDong === expense.MaHopDong)?.sinhVien?.map(member => ({value:member.MaChiTiet,label:memberName(member)})) || []
            ], expense.MaChiTiet || "", false)}
            ${field("Nội dung", "noiDung", "text", expense.NoiDung, true, 'maxlength="255"')}
            ${field("Số tiền VND", "soTien", "number", expense.SoTien, true, 'min="1" step="1" inputmode="numeric"')}
            ${field("Ngày phát sinh", "ngayPhatSinh", "date", dateOnly(expense.NgayPhatSinh), true)}
            <label class="block">Ghi chú<textarea name="ghiChu" maxlength="255" class="mt-1 w-full rounded border p-2">${esc(expense.GhiChu || "")}</textarea></label>
        </form>`);
    }
    async function openServiceEdit(serviceId) {
        if (!state.services) await loadServices();
        const service = state.services.find(item => item.MaDichVu === serviceId);
        if (!service) throw new Error("Không tìm thấy dịch vụ.");
        modalShell(`Cập nhật dịch vụ ${service.MaDichVu}`, `<form id="admin-workflow-form" data-form="service-edit">
            <input type="hidden" name="serviceId" value="${esc(service.MaDichVu)}">
            ${field("Tên dịch vụ", "tenDichVu", "text", service.TenDichVu, true, 'maxlength="100"')}
            ${field("Đơn vị", "donVi", "text", service.DonVi, true, 'maxlength="20"')}
            <label class="mt-3 flex items-center gap-2"><input name="hoatDong" type="checkbox" ${service.HoatDong ? "checked" : ""}> Hoạt động</label>
            <p class="mt-3 rounded bg-amber-50 p-3 text-sm">Đơn giá theo từng hạng phòng được cập nhật trong phần Hạng phòng & dịch vụ.</p>
        </form>`);
    }

    async function handleChange(event) {
        const form = event.target.closest("form");
        if (!form) return;
        if (form.dataset.form === "expense-create" && event.target.name === "maHopDong") renderExpenses();
        if (form.dataset.form === "invoice-create"
            && ["maHopDong", "loaiHoaDon"].includes(event.target.name)) await refreshInvoiceContext();
        if (form.dataset.form === "leave-confirm" && event.target.name === "khauTru") {
            const deduction = event.target.value === "" ? 0 : Number(event.target.value);
            if (!Number.isSafeInteger(deduction) || deduction < 0) {
                root.querySelector("[data-modal-error]").textContent = "Khấu trừ phải là số nguyên VND không âm.";
                return;
            }
            try {
                const suggestion = await request(`/api/chitiethopdong/${encodeURIComponent(form.elements.detailId.value)}/goi-y-hoan-tien${queryString({
                    ngayRa: form.elements.ngayRa.value,
                    khauTru: deduction
                })}`);
                state.refundSuggestion = suggestion;
                form.querySelector("[data-suggestion]").textContent = money(suggestion.GoiYHoan);
                if (!form.elements.soTien.dataset.manuallyEdited) {
                    form.elements.soTien.value = String(Math.floor(Number(suggestion.GoiYHoan || 0)));
                }
                const validation = form.querySelector("[data-refund-validation]");
                if (validation) validation.textContent = "";
                root.querySelector("[data-modal-error]").textContent = "";
            } catch (error) {
                root.querySelector("[data-modal-error]").textContent = error.message;
            }
        }
        if (form.dataset.form === "tier-update") {
            updateTierServiceWarning(event.target);
        }
    }
    async function handleInput(event) {
        if (event.target.closest('form[data-form="tier-update"]')) {
            updateTierServiceWarning(event.target);
            return;
        }
        const form = event.target.closest('form[data-form="leave-confirm"]');
        if (!form) return;
        if (event.target.name === "soTien") {
            event.target.dataset.manuallyEdited = "true";
            return;
        }
    }
    function updateTierServiceWarning(target) {
        const row = target.closest("[data-tier-service-row]");
        if (!row) return;
        const price = Number(row.querySelector('[name="servicePrice"]').value);
        const active = row.querySelector('[name="serviceActive"]').checked;
        const serviceId = row.querySelector('[name="serviceId"]').value;
        const service = state.services?.find(item => item.MaDichVu === serviceId);
        const warning = row.querySelector("[data-rate-warning]");
        warning.classList.toggle("hidden", price > 0 && active && service?.HoatDong !== false);
    }
    async function handleSubmit(event) {
        const form = event.target.closest("#admin-workflow-form, form[data-form]");
        if (!form) return;
        event.preventDefault();
        if (state.busy) return;
        state.busy = true;
        const submitButton = form.querySelector('button[type="submit"], button:not([type])')
            || root.querySelector('button[form="admin-workflow-form"]');
        setBusy(submitButton, true);
        const values = new FormData(form);
        try {
            switch (form.dataset.form) {
                case "contract-filter":
                    await loadContracts(Object.fromEntries(values.entries()));
                    break;
                case "contract-detail-filter": {
                    const history = await request(`/api/chitiethopdong${queryString(Object.fromEntries(values.entries()))}`);
                    root.querySelector("[data-contract-details]").innerHTML = contractDetailsTable(history);
                    break;
                }
                case "contract-create": {
                    const members = [...form.querySelectorAll(".member-row")].map(row => ({
                        maSinhVien: row.querySelector('[name="maSinhVien"]').value.trim(),
                        kyHanThanhToanPhong: row.querySelector('[name="kyHanThanhToanPhong"]').value,
                        laNguoiDaiDien: row.querySelector('[name="laNguoiDaiDien"]').checked
                    })).filter(member => member.maSinhVien);
                    if (!members.length) throw new Error("Thêm ít nhất một sinh viên vào hợp đồng.");
                    if (new Set(members.map(member => member.maSinhVien)).size !== members.length) throw new Error("Không được nhập trùng mã sinh viên.");
                    if (members.filter(member => member.laNguoiDaiDien).length > 1) throw new Error("Mỗi hợp đồng chỉ có một đại diện.");
                    await request("/api/HopDong", { method: "POST", body: json({
                        tenPhong: values.get("tenPhong"), maHangPhong: values.get("maHangPhong"),
                        ngayBatDau: values.get("ngayBatDau"), ngayKetThuc: values.get("ngayKetThuc"),
                        ghiChu: values.get("ghiChu"), sinhVien: members
                    }) });
                    closeModal(); await loadContracts(); break;
                }
                case "member-add": {
                    await request(`/api/HopDong/${encodeURIComponent(values.get("contractId"))}/chitiet`, {
                        method: "POST", body: json({
                            maSinhVien: values.get("maSinhVien"),
                            kyHanThanhToanPhong: values.get("kyHanThanhToanPhong"),
                            laNguoiDaiDien: form.elements.laNguoiDaiDien.checked
                        })
                    });
                    closeModal(); await loadContracts(); break;
                }
                case "leave-preview": {
                    const detailId = values.get("detailId");
                    const ngayRa = values.get("ngayRa");
                    const suggestion = await request(`/api/chitiethopdong/${encodeURIComponent(detailId)}/goi-y-hoan-tien${queryString({ngayRa})}`);
                    renderRefundConfirmation({
                        contractId: values.get("contractId"), detailId, ngayRa,
                        lyDoRoi: values.get("lyDoRoi"), suggestion
                    });
                    break;
                }
                case "leave-confirm": {
                    const amountValue = values.get("soTien");
                    const amount = amountValue === "" ? null : U.parseVnd(amountValue);
                    const deduction = values.get("khauTru") === "0" ? 0 : U.parseVnd(values.get("khauTru"));
                    const suggested = Number(state.refundSuggestion?.GoiYHoan || 0);
                    const note = String(values.get("ghiChu") || "").trim();
                    const validation = root.querySelector("[data-refund-validation]");
                    if (deduction === null) throw new Error("Khấu trừ phải là số nguyên VND không âm.");
                    if (amountValue && amount === null) throw new Error("Số tiền hoàn phải là số nguyên VND dương.");
                    if ((amount !== null && U.refundReasonRequired(amount, suggested, note))
                        || (amount === null && suggested > 0)) {
                        throw new Error("Số hoàn khác gợi ý bắt buộc nhập số tiền và ghi rõ lý do.");
                    }
                    const leavePayload = {
                        ngayRa: values.get("ngayRa"),
                        lyDoRoi: values.get("lyDoRoi")
                    };
                    await request(`/api/HopDong/${encodeURIComponent(values.get("contractId"))}/chitiet/${encodeURIComponent(values.get("detailId"))}/roi`, {
                        method: "PUT", body: json(leavePayload)
                    });
                    if (amount !== 0 && (amount === null || amount > 0)
                        && !(amount === null && suggested === 0)) {
                        await request("/api/phieuchi", {
                            method: "POST",
                            body: json({
                                maChiTiet: Number(values.get("detailId")),
                                ngayRa: values.get("ngayRa"),
                                lyDo: values.get("lyDo"),
                                khauTru: deduction,
                                ...(amount === null ? {} : { soTien: amount }),
                                ...(note ? { ghiChu: note } : {})
                            })
                        });
                    }
                    closeModal(); await loadContracts(); break;
                }
                case "member-move":
                    await request(`/api/HopDong/${encodeURIComponent(values.get("contractId"))}/chuyen-phong`, {
                        method: "PUT", body: json({ maSinhVien: values.get("maSinhVien"), tenPhong: values.get("tenPhong") })
                    });
                    closeModal(); await loadContracts(); break;
                case "contract-extend":
                    await request(`/api/HopDong/${encodeURIComponent(values.get("contractId"))}/gia-han`, {
                        method: "PUT", body: json({ ngayKetThuc: values.get("ngayKetThuc") })
                    });
                    closeModal(); await loadContracts(); break;
                case "invoice-create": {
                    const type = values.get("loaiHoaDon");
                    const body = { loaiHoaDon: type, maHopDong: values.get("maHopDong"), kyThanhToan: values.get("kyThanhToan") };
                    if (type === "TIEN_PHONG") {
                        body.maChiTiet = Number(values.get("maChiTiet"));
                    } else {
                        const services = [...form.querySelectorAll('[name="meterService"]')];
                        const readings = services.map((service, index) => {
                            const oldReading = form.querySelectorAll('[name="meterOld"]')[index].value;
                            const newReading = form.querySelectorAll('[name="meterNew"]')[index].value;
                            if (oldReading === "" || newReading === "") throw new Error("Cần nhập chỉ số cũ và mới cho từng dịch vụ tính theo chỉ số.");
                            const oldValue = Number(oldReading);
                            const newValue = Number(newReading);
                            if (!Number.isSafeInteger(oldValue) || !Number.isSafeInteger(newValue) || oldValue < 0 || newValue < oldValue) {
                                throw new Error("Chỉ số dịch vụ phải là số nguyên không âm và chỉ số mới không nhỏ hơn chỉ số cũ.");
                            }
                            return { maDichVu: service.value, chiSoCu: oldValue, chiSoMoi: newValue };
                        });
                        body.chiSoDichVu = readings;
                    }
                    await request("/api/HoaDon/xuat-ky", { method: "POST", body: json(body) });
                    closeModal(); await loadInvoices(); break;
                }
                case "invoice-filter": {
                    const filters = Object.fromEntries(new FormData(form).entries());
                    await loadInvoices(filters); break;
                }
                case "receipt-create": {
                    const amount = U.parseVnd(values.get("soTien"));
                    const balance = Number(state.invoiceDetail?.ConNo || 0);
                    if (U.exceedsBalance(amount, balance)) throw new Error(`Số tiền phải là số nguyên VND dương và không vượt còn nợ ${money(balance)}.`);
                    const result = await request(`/api/HoaDon/${encodeURIComponent(values.get("invoiceId"))}/phieuthu`, {
                        method: "POST", body: json({
                            soTien: amount, phuongThuc: values.get("phuongThuc"),
                            maSinhVienNop: values.get("maSinhVienNop") || state.invoiceDetail.MaSinhVien || null,
                            ...(values.get("maThamChieu") ? {maThamChieu:values.get("maThamChieu")} : {})
                        })
                    });
                    closeModal();
                    if (result?.PhieuThu) printReceipt({...result.PhieuThu, MaPhieuThu: result.PhieuThu.MaPhieuThu});
                    await loadInvoices();
                    break;
                }
                case "expense-create":
                case "expense-edit": {
                    const amount = U.parseVnd(values.get("soTien"));
                    if (amount === null) throw new Error("Số tiền phải là số nguyên VND dương.");
                    const body = {
                        maHopDong: values.get("maHopDong"),
                        maChiTiet: values.get("maChiTiet") ? Number(values.get("maChiTiet")) : null,
                        noiDung: values.get("noiDung").trim(), soTien: amount,
                        ngayPhatSinh: values.get("ngayPhatSinh"),
                        ghiChu: values.get("ghiChu") || ""
                    };
                    const editing = form.dataset.form === "expense-edit";
                    await request(editing ? `/api/ChiPhiPhatSinh/${encodeURIComponent(values.get("expenseId"))}` : "/api/ChiPhiPhatSinh", {
                        method: editing ? "PUT" : "POST", body: json(body)
                    });
                    closeModal(); await loadExpenses(); break;
                }
                case "room-update": {
                    const room = state.rooms.find(item => item.TenPhong === values.get("roomName"));
                    const tier = state.tiers.find(item => item.MaHangPhong === values.get("MaHangPhong"));
                    await request(`/api/Phong/${encodeURIComponent(values.get("roomName"))}`, {
                        method: "PUT", body: json({
                            Khu: values.get("Khu"), LoaiPhong: values.get("LoaiPhong"),
                            SucChuaToiDa: Number(tier?.SucChuaToiDa), MaHangPhong: values.get("MaHangPhong"),
                            TrangThaiPhong: values.get("TrangThaiPhong"), GhiChu: values.get("GhiChu")
                        })
                    });
                    if (!room) throw new Error("Không tìm thấy phòng đang sửa.");
                    closeModal(); await loadRoomsAndTiers(); renderRoomPane(); break;
                }
                case "tier-update": {
                    const id = form.dataset.tier;
                    const tier = state.tiers.find(item => item.MaHangPhong === id);
                    const serviceIds = [...form.querySelectorAll('[name="serviceId"]')];
                    const prices = [...form.querySelectorAll('[name="servicePrice"]')];
                    const methods = [...form.querySelectorAll('[name="serviceMethod"]')];
                    const payers = [...form.querySelectorAll('[name="servicePayer"]')];
                    const active = [...form.querySelectorAll('[name="serviceActive"]')];
                    const services = serviceIds.map((input, index) => ({
                        maDichVu: input.value,
                        donGia: Number(prices[index].value),
                        cachTinh: methods[index].value,
                        doiTuongThanhToan: payers[index].value,
                        hoatDong: active[index].checked
                    }));
                    const amount = name => Number(form.elements[name].value);
                    if (!Number.isSafeInteger(amount("giaPhongThang")) || !Number.isSafeInteger(amount("giaPhongNam"))
                        || services.some(service => !service.maDichVu || !Number.isSafeInteger(service.donGia) || service.donGia < 0)
                        || new Set(services.map(service => service.maDichVu)).size !== services.length) {
                        throw new Error("Giá phòng và đơn giá dịch vụ phải là số nguyên VND không âm.");
                    }
                    await request(`/api/HangPhong/${encodeURIComponent(id)}`, {
                        method: "PUT", body: json({
                            tenHangPhong: values.get("tenHangPhong"),
                            sucChuaToiDa: Number(values.get("sucChuaToiDa")),
                            giaPhongThang: amount("giaPhongThang"),
                            giaPhongNam: amount("giaPhongNam"),
                            dichVu: services
                        })
                    });
                    await Promise.all([loadRoomsAndTiers(), loadServices()]);
                    renderRoomPane();
                    break;
                }
                case "service-create":
                    await request("/api/DichVu", {
                        method: "POST",
                        body: json({
                            maDichVu: values.get("maDichVu"),
                            tenDichVu: values.get("tenDichVu"),
                            donVi: values.get("donVi"),
                            hoatDong: form.elements.hoatDong.checked
                        })
                    });
                    await Promise.all([loadRoomsAndTiers(), loadServices()]);
                    renderRoomPane();
                    break;
                case "service-edit":
                    await request(`/api/DichVu/${encodeURIComponent(values.get("serviceId"))}`, {
                        method: "PUT",
                        body: json({
                            tenDichVu: values.get("tenDichVu"),
                            donVi: values.get("donVi"),
                            hoatDong: form.elements.hoatDong.checked
                        })
                    });
                    closeModal();
                    await Promise.all([loadRoomsAndTiers(), loadServices()]);
                    renderRoomPane();
                    break;
                default: break;
            }
            status("");
        } catch (error) {
            apiError(error);
            const modalError = root.querySelector("[data-modal-error]");
            if (modalError) modalError.textContent = error.message || "Không thể hoàn tất thao tác.";
        } finally {
            state.busy = false;
            if (submitButton?.isConnected) setBusy(submitButton, false);
        }
    }

    window.renderHopDongModule = renderHopDongModule;
    window.loadHopDong = loadContracts;
    window.renderHoaDonModule = renderHoaDonModule;
    window.renderPhongModule = renderPhongModule;
    window.renderBaoCaoThongKeModule = renderBaoCaoThongKeModule;
    window.renderThanhToanDemoModule = renderThanhToanDemoModule;
    window.mountThanhToanDemo = element => {
        if (element && element !== root) {
            document.getElementById("main-content").replaceChildren(element);
        }
        renderThanhToanDemoModule();
    };
    window.addEventListener("afterprint", () => {
        document.body.classList.remove("admin-printing");
    });
})();
