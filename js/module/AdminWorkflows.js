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
        selectedTierId: "",
        tierOriginal: null,
        roomFilters: { status: "ALL", gender: "ALL", khu: "ALL", tier: "ALL", search: "", page: 1 },
        tierSearch: "",
        serviceFilters: { status: "ALL", search: "" },
        servicePage: 1,
        invoiceDetail: null,
        invoiceReceipt: null,
        contractSearch: "",
        contractStatus: "ALL",
        contractPage: 1,
        contractMemberStatus: "Đang ở",
        contractMemberSearch: "",
        tierDraft: null,
        tierServicesEditing: false,
        serviceCatalogEditing: false,
        financeFilters: {},
        financePages: {},
        busy: false,
        listenersBound: false
    };

    const esc = U.escapeHtml;
    const text = value => {
        const raw = String(value ?? "").trim();
        return esc(!raw || /^(null|undefined)$/i.test(raw) ? "—" : raw);
    };
    const dateOnly = value => U.date(String(value ?? "").slice(0, 10), "format") || "—";
    const today = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    };
    const dateAfterDays = (dateValue, days) => {
        const [year, month, day] = String(dateValue || "").slice(0, 10).split("-").map(Number);
        if (![year, month, day].every(Number.isInteger)) return "";
        const date = new Date(year, month - 1, day + days);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    const money = value => value === null || value === undefined || value === "" ? "—" : U.formatVnd(Number(value));
    const display = value => U.displayLabel(value);
    const badge = value => U.statusBadge(value);
    const paymentHasActualAmount = payment =>
        payment?.SoTienThucNhan !== null && payment?.SoTienThucNhan !== undefined;
    const receiptStatusLabel = (receipt, payment = null) => {
        const actualAmount = receipt?.SoTienThucNhan !== null && receipt?.SoTienThucNhan !== undefined
            ? receipt.SoTienThucNhan
            : payment
                ? payment.SoTienThucNhan
                : receipt?.TrangThai === "Hợp lệ" ? receipt.SoTien : null;
        const merged = {
            ...payment,
            ...receipt,
            SoTienYeuCau: receipt?.SoTienYeuCau ?? payment?.SoTienYeuCau
                ?? payment?.TongTien ?? receipt?.SoTien,
            SoTienThucNhan: actualAmount
        };
        if (!paymentHasActualAmount(merged)
            || ["Đã hủy", "Đã huỷ", "REJECTED"].includes(String(merged.TrangThai || ""))) return "";
        const requested = Number(merged.SoTienYeuCau);
        const received = Number(merged.SoTienThucNhan);
        if (!Number.isFinite(requested) || !Number.isFinite(received) || requested !== received) return "";
        return "Đã thanh toán";
    };
    const receiptStatusBadge = label =>
        `<span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800">${esc(label || "—")}</span>`;
    const invoiceStatusBadge = invoice => badge(U.invoicePaymentLabel(invoice));
    function printDocument() {
        document.body.classList.add("admin-printing");
        window.print();
    }
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
    const field = (label, name, type = "text", value = "", required = false, extra = "") => {
        const isDate = type === "date";
        if (isDate) return U.dateField(label, name, value, { required, birthDate: name === "birthday" || name === "ngaySinh" });
        const displayValue = isDate ? U.date(String(value ?? "").slice(0, 10), "format") : value;
        return `
        <label class="block text-sm font-semibold text-slate-700">${esc(label)}
            <input name="${esc(name)}" type="${isDate ? "text" : type}" value="${esc(displayValue)}"
                ${isDate ? 'placeholder="dd/mm/yyyy" inputmode="numeric" autocomplete="off" data-admin-date' : ""}
                ${required ? "required" : ""} ${extra}
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
        </label>`;
    };
    const contractDateField = (label, name, value, required = true) => `
        <label class="block min-w-0 text-sm font-semibold text-slate-700">${esc(label)}
            <span class="mt-1 flex min-w-0 gap-1">
                <input id="date-${esc(name)}" name="${esc(name)}" type="text" maxlength="10"
                    inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy"
                    value="${esc(U.date(String(value || "").slice(0, 10), "format") || "")}"
                    data-admin-date ${required ? "required" : ""}
                    class="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal">
                <button type="button" data-action="date-picker-open" aria-label="Chọn ngày"
                    class="h-10 shrink-0 rounded border border-slate-300 px-3 text-slate-600" title="Chọn ngày">▦</button>
                <input type="date" data-date-picker aria-hidden="true" tabindex="-1"
                    class="absolute h-px w-px opacity-0">
            </span>
            <span data-date-error role="alert" class="mt-1 block min-h-4 text-xs font-normal text-red-700"></span>
        </label>`;
    const expenseDateField = (label, name, value, required = true) => `
        <label class="admin-expense-field admin-expense-date-field">
            <span>${esc(label)}${required ? ' <span class="text-red-600">*</span>' : ""}</span>
            <span class="admin-expense-date-control">
                <input name="${esc(name)}" type="text" maxlength="10" inputmode="numeric" autocomplete="off"
                    placeholder="dd/mm/yyyy" value="${esc(U.date(String(value || "").slice(0, 10), "format") || "")}"
                    data-admin-date class="admin-expense-control" ${required ? "required" : ""}>
                <button type="button" data-action="date-picker-open" aria-label="Chọn ngày"
                    title="Chọn ngày">▦</button>
                <input type="date" data-date-picker aria-hidden="true" tabindex="-1">
            </span>
            <span data-date-error role="alert" class="admin-expense-date-error"></span>
        </label>`;
    const expenseTextField = (label, name, value = "", required = false, extra = "") => `
        <label class="admin-expense-field">
            <span>${esc(label)}${required ? ' <span class="text-red-600">*</span>' : ""}</span>
            <input name="${esc(name)}" type="text" value="${esc(value)}" class="admin-expense-control" ${required ? "required" : ""} ${extra}>
        </label>`;
    const expenseAmountField = (value = "") => `
        <label class="admin-expense-field">
            <span>Số tiền VND <span class="text-red-600">*</span></span>
            <input name="soTien" type="number" value="${esc(value)}" step="1" inputmode="numeric"
                data-expense-amount aria-required="true" aria-describedby="expense-amount-error"
                class="admin-expense-control">
            <span id="expense-amount-error" data-expense-amount-error class="admin-expense-field-error" role="alert"></span>
        </label>`;
    const expenseAmountError = value => {
        const raw = String(value ?? "").trim();
        if (!raw) return "Vui lòng nhập số tiền";
        const amount = U.parseVnd(raw);
        if (amount === null) return "Nhập số nguyên VND dương";
        if (amount > U.MAX_INCIDENT_EXPENSE_VND) return `Không được vượt ${U.MAX_INCIDENT_EXPENSE_VND.toLocaleString("vi-VN")} đ`;
        return "";
    };
    const moneyField = (label, name, value) => `
        <label class="block text-sm font-semibold text-slate-700">${esc(label)}
            <span class="mt-1 flex items-center rounded-lg border border-slate-300 px-3">
                <input name="${esc(name)}" type="text" inputmode="numeric" data-vnd-nonnegative
                    value="${esc(U.formatVnd(Number(value || 0)).replace(/\u00a0?đ$/, ""))}" required
                    class="w-full py-2 font-normal outline-none">
                <span class="text-slate-500">đ</span>
            </span>
        </label>`;
    const select = (label, name, options, selected = "", required = false, fieldClass = "") => `
        <label class="${fieldClass || "block text-sm font-semibold text-slate-700"}"><span>${esc(label)}</span>
            <select name="${esc(name)}" ${required ? "required" : ""}
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal ${fieldClass === "admin-expense-field" ? "admin-expense-control" : ""}">
                ${required && !String(selected) ? '<option value="" selected disabled>Chọn một mục</option>' : ""}
                ${options.map(option => `<option value="${esc(option.value)}" ${String(option.value) === String(selected) ? "selected" : ""}>${esc(option.label)}</option>`).join("")}
            </select>
        </label>`;
    const apiDate = (form, name, required = true) => {
        const value = String(form.elements[name]?.value || "").trim();
        if (!value && !required) return "";
        const parsed = U.date(value, "parse");
        const labels = {
            ngayBatDau: "Ngày bắt đầu", ngayKetThuc: "Ngày kết thúc",
            ngayRa: "Ngày rời", kyThanhToan: "Kỳ thanh toán",
            ngayPhatSinh: "Ngày phát sinh", kyTu: "Kỳ từ", kyDen: "Kỳ đến"
        };
        if (!parsed) throw new Error(`${labels[name] || "Ngày"} không hợp lệ. Nhập theo dd/mm/yyyy.`);
        return parsed;
    };
    const formatDateTime = value => U.dateTime(value);
    const receiptDateTime = value => {
        const formatted = formatDateTime(value);
        const match = /^(\d{2}:\d{2}) (\d{2}\/\d{2}\/\d{4})$/.exec(formatted);
        if (match) return `${match[2]} ${match[1]}`;
        return /^\d{2}\/\d{2}\/\d{4}$/.test(formatted) ? `${formatted} 00:00` : formatted;
    };
    const button = (label, action, attrs = "", style = "bg-emerald-700 text-white") =>
        `<button type="button" data-action="${esc(action)}" ${attrs}
            class="rounded-lg px-3 py-2 text-sm font-semibold ${style}">${esc(label)}</button>`;
    const apiError = error => {
        const message = error?.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
        status(message);
        window.showToast?.(message, "error");
    };
    const setBusy = (element, busy) => {
        if (!element || element.tagName !== "BUTTON") return;
        element.disabled = busy;
        element.dataset.originalText ||= element.textContent;
        element.textContent = busy ? "Đang xử lý…" : element.dataset.originalText;
        element.classList.toggle("opacity-60", busy);
    };
    const modalShell = (title, content, submitLabel = "Xác nhận", dialogClass = "") => {
        const modal = root.querySelector("[data-admin-modal]");
        if (!modal) return null;
        modal.innerHTML = `
            <div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4">
                <section role="dialog" aria-modal="true" aria-labelledby="admin-modal-title"
                    class="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl ${esc(dialogClass)}">
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
    const drawerShell = (title, contentHtml) => {
        const drawer = root?.querySelector("[data-admin-drawer]");
        if (!drawer) return null;
        drawer.innerHTML = `<div class="fixed inset-0 z-[115] flex items-center justify-center p-3 sm:p-6">
            <button type="button" data-action="drawer-close" aria-label="Đóng chi tiết" class="absolute inset-0 bg-slate-950/50"></button>
            <section role="dialog" aria-modal="true" aria-labelledby="admin-drawer-title" tabindex="-1"
                class="relative z-10 max-h-[94vh] w-full max-w-[960px] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
                <header class="mb-5 flex items-center justify-between border-b pb-3">
                    <h2 id="admin-drawer-title" class="text-xl font-bold">${esc(title)}</h2>
                    <button type="button" data-action="drawer-close" aria-label="Đóng chi tiết" class="rounded-lg bg-slate-100 px-4 py-2">Đóng</button>
                </header>${contentHtml}<p data-drawer-error class="mt-3 min-h-6 text-sm text-red-700" role="alert"></p></section>`;
        drawer.classList.remove("hidden");
        drawer.querySelector("section[role='dialog']")?.focus();
        return drawer;
    };
    const closeDrawer = () => {
        const drawer = root?.querySelector("[data-admin-drawer]");
        if (drawer) {
            drawer.classList.add("hidden");
            drawer.replaceChildren();
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
                <div data-admin-drawer class="hidden"></div>
            </section>`;
        if (!state.listenersBound) {
            U.bindDateInputs(document.body);
            root.addEventListener("click", handleClick);
            root.addEventListener("submit", handleSubmit);
            root.addEventListener("change", handleChange);
            root.addEventListener("input", handleInput);
            root.addEventListener("keydown", handleRowKeydown);
            document.addEventListener("keydown", event => {
                if (event.key !== "Escape") return;
                if (event.target.closest?.("[data-student-search]")) return;
                if (root.querySelector("[data-admin-modal]:not(.hidden)")) {
                    event.preventDefault();
                    closeModal();
                } else if (root.querySelector("[data-admin-drawer]:not(.hidden)")) {
                    event.preventDefault();
                    closeDrawer();
                }
            });
            state.listenersBound = true;
        }
        U.enhanceAdminTables(root);
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
    const memberName = member => String(member.HoTen || U.maskStudentId(member.MaSinhVien));
    const studentLabel = student => {
        const name = String(student.HoTen || "").trim();
        const id = String(student.MaSinhVien || "").trim();
        const visibleId = U.maskStudentId(id);
        return name && id ? (name === id ? visibleId : `${name} · ${visibleId}`) : (name || visibleId || "—");
    };
    const activeStudentContract = studentId => state.contracts.find(contract =>
        contract.TrangThaiHopDong === "Còn hiệu lực"
        && activeMembers(contract).some(member => member.MaSinhVien === studentId)
    ) || null;
    const studentConflictMarkup = (studentId, excludedContractId = "") => {
        const contract = activeStudentContract(studentId);
        if (!contract) return "";
        const isSameContract = contract.MaHopDong === excludedContractId;
        const message = `Sinh viên này đang ở phòng ${contract.TenPhong || "—"} (hợp đồng ${contract.MaHopDong})`;
        return `<div class="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
            ${esc(message)}${isSameContract ? " — sinh viên đã thuộc hợp đồng này." : ""}
            ${button("Chuyển phòng", "member-move", `data-contract="${esc(contract.MaHopDong)}" data-student="${esc(studentId)}"`, "ml-2 bg-slate-700 text-white")}
        </div>`;
    };
    const contractOptions = (activeOnly = true) => state.contracts
        .filter(contract => !activeOnly || contract.TrangThaiHopDong === "Còn hiệu lực")
        .map(contract => ({ value: contract.MaHopDong, label: `${contract.MaHopDong || "—"} · ${contract.TenPhong || "—"}` }));
    const roomOptions = (exclude, { gender = "", tier = "" } = {}) => {
        const available = U.filterRoomsByGender(state.rooms, gender)
            .filter(room => room.TenPhong !== exclude
                && (!tier || room.MaHangPhong === tier)
                && room.TrangThaiPhong !== "Bảo trì" && room.TrangThaiPhong !== "Ngưng sử dụng"
                && availableRoomSpaces(room) > 0);
        return available.map(room => ({
            value: room.TenPhong,
            label: `${U.roomLabel(room, roomOccupancy(room.TenPhong))}${U.contractRoomSelection(room.TenPhong, state.contracts).contract
                ? ` · ${U.contractRoomSelection(room.TenPhong, state.contracts).contract.MaHopDong}` : ""}`
        }));
    };
    const studentOptions = ({ availableOnly = false, roomName = "", gender = "", excludeIds = [] } = {}) => {
        const excluded = new Set(excludeIds);
        const room = state.rooms.find(item => item.TenPhong === roomName);
        const selectedGender = gender || room?.LoaiPhong || "";
        return U.filterStudentsByRoomGender(state.students, { LoaiPhong: selectedGender })
            .filter(student => !excluded.has(student.MaSinhVien))
            .map(student => {
                const occupiedContract = activeStudentContract(student.MaSinhVien);
                return {
                    value: student.MaSinhVien,
                    label: `${studentLabel(student)} · ${U.displayLabel(student.GioiTinh)}${occupiedContract
                        ? ` · Đang ở phòng ${occupiedContract.TenPhong} (hợp đồng ${occupiedContract.MaHopDong})`
                        : student.TenPhong ? ` · ${student.TenPhong}` : ""}`
                };
            });
    };
    const roomOccupancy = roomName => state.contracts
        .filter(contract => contract.TenPhong === roomName && contract.TrangThaiHopDong === "Còn hiệu lực")
        .reduce((count, contract) => count + activeMembers(contract).length, 0);
    const availableRoomSpaces = room => Math.max(0,
        Number(room.SucChuaToiDa || 0) - roomOccupancy(room.TenPhong));

    function renderHopDongModule() {
        ensureRoot("Quản lý hợp đồng theo phòng", "Hợp đồng, thành viên, đại diện thanh toán dịch vụ và gợi ý hoàn tiền.");
        content().innerHTML = `
            <div class="mb-4 flex flex-wrap gap-2">
                ${button("Tạo hợp đồng", "contract-create")}
                ${button("⟳", "contract-refresh", 'aria-label="Làm mới" title="Làm mới"', "bg-slate-700 text-white")}
            </div>
            <form data-form="contract-filter" class="mb-1 flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
                <input name="contractSearch" aria-label="Tìm hợp đồng, phòng, Số CCCD hoặc tên" placeholder="Tìm hợp đồng, phòng, Số CCCD hoặc tên"
                    value="${esc(state.contractSearch)}" class="h-10 min-w-56 flex-1 rounded-lg border px-3">
                ${select("Trạng thái", "status", [{value:"ALL",label:"Tất cả"}, {value:"Còn hiệu lực",label:"Còn hiệu lực"}, {value:"Đã kết thúc",label:"Đã kết thúc"}], state.contractStatus)}
                ${button("Xóa lọc", "contract-filter-clear", "", "bg-slate-200 text-slate-800")}
            </form>
            <p data-contract-count class="admin-list-summary text-sm text-slate-600"></p>
            <div data-no-admin-filters data-contract-list class="overflow-x-auto rounded-xl border bg-white"></div>
            <footer class="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-white px-3 py-2">
                <div data-contract-pages class="flex items-center gap-2 whitespace-nowrap"></div>
            </footer>`;
        loadContracts().catch(apiError);
    }
    function renderContractsTable() {
        const container = root?.querySelector("[data-contract-list]");
        if (!container) return;
        const query = state.contractSearch.toLocaleLowerCase("vi");
        const filtered = state.contracts.filter(contract =>
            (state.contractStatus === "ALL" || contract.TrangThaiHopDong === state.contractStatus)
            && (!query || [contract.MaHopDong, contract.TenPhong, contract.MaHangPhong, ...(contract.sinhVien || []).flatMap(member => [member.MaSinhVien, member.HoTen])]
                .some(value => String(value || "").toLocaleLowerCase("vi").includes(query))));
        const page = U.paginateRows(filtered, state.contractPage, 20);
        state.contractPage = page.page;
        const columns = [
            { label: "Hợp đồng", render: contract => text(contract.MaHopDong) },
            { label: "Phòng", render: contract => text(contract.TenPhong) },
            { label: "Hạng", render: contract => text(contract.TenHangPhong || contract.MaHangPhong) },
            { label: "Sĩ số", render: contract => {
            const active = activeMembers(contract);
                return `${Number(contract.SoSinhVienHienTai ?? active.length)}/${Number(contract.SucChuaToiDa || 0)} người`;
            } },
            { label: "Thời hạn", render: contract => `${esc(dateOnly(contract.NgayBatDau))} – ${esc(dateOnly(contract.NgayKetThuc))}` },
            { label: "Trạng thái", render: contract => badge(contract.TrangThaiHopDong) },
            { label: "", render: () => `<span aria-hidden="true" class="text-lg text-slate-500">›</span>` }
        ];
        container.innerHTML = U.renderTable(columns, page.rows, "Không có dữ liệu phù hợp", contract =>
            `data-action="row-detail" data-detail-type="contract" data-detail-id="${esc(contract.MaHopDong)}" tabindex="0" role="button" aria-label="Chi tiết hợp đồng ${esc(contract.MaHopDong)}" class="cursor-pointer hover:bg-slate-50 focus:bg-emerald-50 focus:outline focus:outline-2 focus:outline-emerald-600"`);
        const count = root.querySelector("[data-contract-count]");
        if (count) {
            const endedCount = state.contracts.filter(contract => contract.TrangThaiHopDong !== "Còn hiệu lực").length;
            const activeCount = state.contracts.filter(contract => contract.TrangThaiHopDong === "Còn hiệu lực").length;
            count.textContent = `Tổng: ${state.contracts.length} hợp đồng · ${activeCount} đang hiệu lực · ${endedCount} đã kết thúc · ${page.total} phù hợp`;
        }
        const pages = root.querySelector("[data-contract-pages]");
        if (pages) pages.innerHTML = `${button("Trước", "contract-page", `data-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}`, "bg-slate-100 text-slate-800")}<span>${page.page}/${page.pageCount}</span>${button("Sau", "contract-page", `data-page="${page.page + 1}" ${page.page >= page.pageCount ? "disabled" : ""}`, "bg-slate-100 text-slate-800")}`;
    }
    function renderContractMembers(contract) {
        const query = state.contractMemberSearch.toLocaleLowerCase("vi");
        const members = (contract.sinhVien || []).filter(member =>
            (state.contractMemberStatus === "ALL" || member.TrangThai === state.contractMemberStatus)
            && (!query || [member.MaSinhVien, member.HoTen, contract.TenPhong, contract.MaHopDong]
                .some(value => String(value || "").toLocaleLowerCase("vi").includes(query))));
        const memberHtml = members.map(member => `<article class="rounded-lg border p-4">
            <div class="flex flex-wrap items-center justify-between gap-2"><strong>${text(member.HoTen)}</strong>${badge(member.TrangThai)}</div>
            <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt class="text-slate-500">Số CCCD</dt><dd>${text(member.MaSinhVien)}</dd></div>
                <div><dt class="text-slate-500">Ngày vào / ngày ra</dt><dd>${dateOnly(member.NgayVao)} / ${dateOnly(member.NgayRa)}</dd></div>
                <div><dt class="text-slate-500">Kỳ thanh toán</dt><dd>${text(display(member.KyHanThanhToanPhong))}</dd></div>
                <div><dt class="text-slate-500">Giá áp dụng</dt><dd>${money(member.GiaPhongApDung ?? member.GiaPhongThangApDung)}</dd></div>
                <div><dt class="text-slate-500">Đại diện thanh toán dịch vụ</dt><dd>${member.LaNguoiDaiDienThanhToanDichVu ? "Có" : "Không"}</dd></div>
                <div><dt class="text-slate-500">Ghi chú</dt><dd>${text(member.GhiChu)}</dd></div>
            </dl>
            ${member.TrangThai === "Đang ở" ? `<div class="mt-3 flex flex-wrap gap-2">
                ${button("Rời / gợi ý hoàn", "member-leave", `data-contract="${esc(contract.MaHopDong)}" data-detail="${esc(member.MaChiTiet)}"`, "bg-amber-600 text-white")}
                ${button("Chuyển phòng", "member-move", `data-contract="${esc(contract.MaHopDong)}" data-student="${esc(member.MaSinhVien)}"`, "bg-slate-700 text-white")}
                ${button("Đặt đại diện", "member-representative", `data-contract="${esc(contract.MaHopDong)}" data-detail="${esc(member.MaChiTiet)}"`, "bg-slate-700 text-white")}
            </div>` : ""}
        </article>`).join("");
        const host = root.querySelector("[data-contract-members]");
        if (host) host.innerHTML = memberHtml || `<p class="rounded border p-4 text-center text-slate-500">Không có sinh viên phù hợp.</p>`;
    }
    function openContractDetail(contract) {
        state.contractMemberStatus = "Đang ở";
        state.contractMemberSearch = "";
        const actions = contract.TrangThaiHopDong === "Còn hiệu lực" ? `<div class="flex flex-wrap gap-2">
            ${button("Thêm SV", "member-add", `data-contract="${esc(contract.MaHopDong)}"`)}
            ${button("Gia hạn", "contract-extend", `data-contract="${esc(contract.MaHopDong)}"`, "bg-slate-700 text-white")}
            ${button("Kết thúc", "contract-end", `data-contract="${esc(contract.MaHopDong)}"`, "bg-red-700 text-white")}
        </div>` : "";
        drawerShell(`Hợp đồng ${contract.MaHopDong || "—"}`, `<section data-contract="${esc(contract.MaHopDong)}" class="space-y-5">
            <dl class="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
                <div><dt class="text-sm text-slate-500">Phòng / hạng</dt><dd>${text(contract.TenPhong)} / ${text(contract.TenHangPhong || contract.MaHangPhong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Thời hạn</dt><dd>${dateOnly(contract.NgayBatDau)} – ${dateOnly(contract.NgayKetThuc)}</dd></div>
                <div><dt class="text-sm text-slate-500">Sĩ số</dt><dd>${activeMembers(contract).length}/${Number(contract.SucChuaToiDa || 0)} người</dd></div>
                <div><dt class="text-sm text-slate-500">Trạng thái</dt><dd>${badge(contract.TrangThaiHopDong)}</dd></div>
            </dl>
            <div class="flex flex-wrap items-end gap-2">
                ${select("Trạng thái sinh viên", "contractMemberStatus", [{value:"Đang ở",label:"Đang ở"},{value:"ALL",label:"Tất cả"},{value:"Đã rời",label:"Đã rời"},{value:"Đã chuyển phòng",label:"Đã chuyển phòng"}], state.contractMemberStatus)}
                <label class="inline-flex items-center gap-2 text-sm">Tìm sinh viên<input name="contractMemberSearch" value="" placeholder="Tên hoặc Số CCCD" class="rounded border px-3 py-2"></label>
            </div>
            <h3 class="font-semibold">Sinh viên trong hợp đồng</h3>
            <div data-contract-members class="space-y-3"></div>${actions}
        </section>`);
        renderContractMembers(contract);
    }

    async function openRowDetail(type, id) {
        if (type === "invoice") return openInvoiceDetail(id);
        if (type === "room") {
            const room = state.rooms.find(item => item.TenPhong === id);
            if (!room) throw new Error("Không tìm thấy phòng trong dữ liệu đã tải.");
            drawerShell(`Phòng ${room.TenPhong}`, `<dl class="grid gap-3 sm:grid-cols-2">
                <div><dt class="text-sm text-slate-500">Khu</dt><dd>${text(room.Khu)}</dd></div>
                <div><dt class="text-sm text-slate-500">Giới tính phòng</dt><dd>${text(U.roomGender(room))}</dd></div>
                <div><dt class="text-sm text-slate-500">Hạng</dt><dd>${text(room.MaHangPhong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Sĩ số</dt><dd>${Number(room.SoSinhVienHienTai || 0)}/${Number(room.SucChuaToiDa || 0)} người</dd></div>
                <div><dt class="text-sm text-slate-500">Giá/tháng</dt><dd>${money(room.GiaPhong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Trạng thái</dt><dd>${badge(room.TrangThaiPhong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Ghi chú</dt><dd>${text(room.GhiChu)}</dd></div>
            </dl><div class="mt-5">${button("Sửa phòng", "room-edit", `data-room="${esc(room.TenPhong)}"`)}</div>`);
            return;
        }
        if (type === "contract") {
            const contract = state.contracts.find(item => item.MaHopDong === id);
            if (!contract) throw new Error("Không tìm thấy hợp đồng trong dữ liệu đã tải.");
            openContractDetail(contract);
            return;
        }
        if (type === "expense") {
            const expense = state.expenses.find(item => String(item.MaChiPhi) === String(id));
            if (!expense) throw new Error("Không tìm thấy khoản phát sinh trong dữ liệu đã tải.");
            const editable = ["Chưa lập hóa đơn", "Chờ gộp"].includes(expense.TrangThai) && !expense.MaHoaDon;
            drawerShell(`Chi phí phát sinh #${expense.MaChiPhi}`, `<dl class="grid gap-3 sm:grid-cols-2">
                <div><dt class="text-sm text-slate-500">Khoản phí</dt><dd>${text(expense.NoiDung)}</dd></div>
                <div><dt class="text-sm text-slate-500">Phòng / hợp đồng</dt><dd>${text(expense.TenPhong)} / ${text(expense.MaHopDong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Sinh viên</dt><dd>${text(expense.HoTen || expense.MaSinhVien)}</dd></div>
                <div><dt class="text-sm text-slate-500">Ngày phát sinh</dt><dd>${dateOnly(expense.NgayPhatSinh)}</dd></div>
                <div><dt class="text-sm text-slate-500">Hạn đóng</dt><dd>${dateOnly(expense.HanDong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Số tiền</dt><dd>${money(expense.SoTien)}</dd></div>
                <div><dt class="text-sm text-slate-500">Trạng thái</dt><dd>${badge(expense.TrangThai)}</dd></div>
                <div class="sm:col-span-2"><dt class="text-sm text-slate-500">Ghi chú</dt><dd>${text(expense.GhiChu)}</dd></div>
            </dl><div class="mt-5 flex flex-wrap gap-2">${editable ? `${button("Sửa", "expense-edit", `data-expense="${esc(expense.MaChiPhi)}"`, "bg-slate-700 text-white")}
                ${button("Hủy", "expense-cancel", `data-expense="${esc(expense.MaChiPhi)}"`, "bg-red-700 text-white")}
                ${expense.TrangThai === "Chưa lập hóa đơn" ? button("Lập hóa đơn riêng", "expense-invoice", `data-expense="${esc(expense.MaChiPhi)}"`) : ""}` : ""}</div>`);
            return;
        }
        if (type === "receipt") {
            const receipt = state.receipts.find(item => String(item.MaPhieuThu) === String(id));
            if (!receipt) throw new Error("Không tìm thấy phiếu thu trong dữ liệu đã tải.");
            const payment = state.payments.find(item => String(item.MaGiaoDich) === String(receipt.MaGiaoDich));
            const merged = {
                ...receipt,
                SoTienYeuCau: payment?.SoTienYeuCau ?? payment?.TongTien ?? receipt.SoTien,
                SoTienThucNhan: payment?.SoTienThucNhan
                    ?? (receipt.TrangThai === "Hợp lệ" ? receipt.SoTien : null),
                MaGiaoDich: receipt.MaGiaoDich || payment?.MaGiaoDich,
                PhuongThuc: receipt.PhuongThuc || payment?.PhuongThuc,
                NgayThu: receipt.NgayThu || payment?.NgayThu || payment?.NgayTao
            };
            const status = receiptStatusLabel(merged);
            drawerShell("Chi tiết phiếu thu", `<dl class="grid gap-3 sm:grid-cols-2">
                <div><dt class="text-sm text-slate-500">Mã giao dịch</dt><dd>${text(merged.MaGiaoDich)}</dd></div>
                <div><dt class="text-sm text-slate-500">Hóa đơn/phòng</dt><dd>${text(merged.MaHoaDon)} / ${text(merged.TenPhong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Người nộp</dt><dd>${text(merged.TenNguoiNop || merged.HoTen || merged.MaSinhVienNop)}</dd></div>
                <div><dt class="text-sm text-slate-500">Phương thức</dt><dd>${text(U.paymentMethodLabel(merged.PhuongThuc))}</dd></div>
                <div><dt class="text-sm text-slate-500">Thời điểm</dt><dd>${esc(receiptDateTime(merged.NgayThu))}</dd></div>
                <div><dt class="text-sm text-slate-500">Trạng thái</dt><dd>${receiptStatusBadge(status)}</dd></div>
            </dl>`);
            return;
        }
        if (type === "payment") {
            const payment = state.payments.find(item => String(item.MaGiaoDich) === String(id));
            if (!payment) throw new Error("Không tìm thấy giao dịch trong dữ liệu đã tải.");
            const receipt = state.receipts.find(item => String(item.MaPhieuThu) === String(payment.MaPhieuThu));
            const statusLabel = receiptStatusLabel(receipt || payment, payment);
            drawerShell("Chi tiết giao dịch", `<dl class="grid gap-3 sm:grid-cols-2">
                <div class="sm:col-span-2"><dt class="text-sm text-slate-500">Mã giao dịch</dt><dd class="flex items-center gap-2 break-all">${text(payment.MaGiaoDich)}
                    ${button("⧉", "payment-copy", `data-transaction="${esc(payment.MaGiaoDich)}" aria-label="Sao chép mã giao dịch" title="Sao chép mã giao dịch"`, "bg-slate-100 text-slate-700")}</dd></div>
                <div><dt class="text-sm text-slate-500">Hóa đơn / phòng</dt><dd>${text(payment.MaHoaDon)} / ${text(payment.TenPhong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Người nộp</dt><dd>${text(payment.HoTen || payment.MaSinhVien)}</dd></div>
                <div><dt class="text-sm text-slate-500">Phương thức / trạng thái</dt><dd>${text(U.paymentMethodLabel(payment.PhuongThuc))} / ${badge(statusLabel)}</dd></div>
                <div><dt class="text-sm text-slate-500">Thời điểm</dt><dd>${esc(receiptDateTime(payment.NgayThu || payment.NgayTao))}</dd></div>
            </dl>
            `);
            return;
        }
        if (type === "refund") {
            const refund = state.refunds.find(item => String(item.MaPhieuChi) === String(id));
            if (!refund) throw new Error("Không tìm thấy phiếu chi trong dữ liệu đã tải.");
            drawerShell(`Phiếu chi #${refund.MaPhieuChi}`, `<dl class="grid gap-3 sm:grid-cols-2">
                <div><dt class="text-sm text-slate-500">Sinh viên / chi tiết</dt><dd>${text(refund.HoTen || refund.MaSinhVien)} / ${text(refund.MaChiTiet)}</dd></div>
                <div><dt class="text-sm text-slate-500">Ngày chi</dt><dd>${dateOnly(refund.NgayChi)}</dd></div>
                <div><dt class="text-sm text-slate-500">Đã đóng</dt><dd>${money(refund.SoTienDaDong)}</dd></div>
                <div><dt class="text-sm text-slate-500">Đã hoàn</dt><dd>${money(refund.SoTien)}</dd></div>
                <div><dt class="text-sm text-slate-500">Lý do / trạng thái</dt><dd>${text(refund.LyDo)} / ${badge(refund.TrangThai)}</dd></div>
                <div><dt class="text-sm text-slate-500">Ghi chú</dt><dd>${text(U.refundDisplayNote(refund))}</dd></div>
            </dl><div class="mt-5">${button("In phiếu chi", "refund-print", `data-refund="${esc(refund.MaPhieuChi)}"`, "bg-slate-700 text-white")}</div>`);
        }
    }
    async function openCreateContract() {
        await Promise.all([loadContracts(), loadRoomsAndTiers(), loadStudents()]);
        const modal = modalShell("Tạo hợp đồng và thêm thành viên", `
            <form id="admin-workflow-form" data-form="contract-create" class="space-y-3">
                <div class="flex items-center justify-between"><h4 class="font-bold">Sinh viên</h4>
                    <button type="button" data-action="add-member-row" class="rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-50">Thêm dòng SV</button></div>
                <div data-new-members class="space-y-2"></div>
                ${select("Phòng", "tenPhong", [], "", true)}
                <input type="hidden" name="activeContractId" value="">
                <p data-contract-capacity class="text-sm text-slate-600" role="status">Chọn sinh viên trước để lọc phòng phù hợp.</p>
                <div data-create-contract-fields class="space-y-3">
                    <label class="block text-sm font-semibold text-slate-700">Hạng phòng
                        <input name="maHangPhongDisplay" type="text" readonly placeholder="Tự điền theo phòng"
                            class="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 font-normal">
                        <input name="maHangPhong" type="hidden" value="">
                    </label>
                    <div class="grid min-w-0 gap-3 sm:grid-cols-2">
                        ${contractDateField("Ngày bắt đầu", "ngayBatDau", today())}
                        ${contractDateField("Ngày kết thúc", "ngayKetThuc", "")}
                    </div>
                    <label class="block text-sm font-semibold">Ghi chú<textarea name="ghiChu" maxlength="255" class="mt-1 w-full rounded-lg border p-2"></textarea></label>
                </div>
            </form>`, "Tạo hợp đồng");
        if (!modal) return;
        modal.querySelector("[data-new-members]").innerHTML = memberFormRow();
        const form = modal.querySelector('form[data-form="contract-create"]');
        updateCreateRoomOptions(form, "");
        updateCreateStudentOptions(form, "");
        updateContractCapacity(form, "");
        updateCreateContractDateOrder(form);
    }
    function updateCreateContractDateOrder(form) {
        if (form?.dataset.form !== "contract-create") return "";
        const start = U.date(form.elements.ngayBatDau.value, "parse");
        const end = U.date(form.elements.ngayKetThuc.value, "parse");
        const error = form.querySelector('#date-ngayKetThuc')?.parentElement?.parentElement
            ?.querySelector("[data-date-error]");
        const message = start && end && end <= start
            ? "Ngày kết thúc phải sau ngày bắt đầu."
            : "";
        if (error) error.textContent = message;
        const submit = root.querySelector('button[form="admin-workflow-form"][type="submit"]');
        if (submit) {
            const selectedStudents = [...form.querySelectorAll('.member-row [name="maSinhVien"]')]
                .map(input => input.value).filter(Boolean);
            submit.disabled = Boolean(message) || selectedStudents.some(id => activeStudentContract(id));
        }
        return message;
    }
    function updateContractMode(form, roomName) {
        const selection = U.contractRoomSelection(roomName, state.contracts);
        const contract = selection.contract;
        const isAdding = Boolean(contract);
        form.dataset.activeContract = contract?.MaHopDong || "";
        form.dataset.availableSeats = String(availableRoomSpaces(
            state.rooms.find(item => item.TenPhong === roomName) || {}
        ));
        form.elements.activeContractId.value = contract?.MaHopDong || "";
        const createFields = form.querySelector("[data-create-contract-fields]");
        createFields.hidden = isAdding;
        createFields.querySelectorAll("input, textarea, select").forEach(input => {
            input.disabled = isAdding;
        });
        if (isAdding) {
            const rows = form.querySelectorAll(".member-row");
            rows.forEach((row, index) => { if (index > 0) row.remove(); });
        }
        const addRowButton = form.querySelector('[data-action="add-member-row"]');
        if (addRowButton) addRowButton.hidden = isAdding;
        const title = root.querySelector("#admin-modal-title");
        if (title) title.textContent = isAdding
            ? `Thêm thành viên vào hợp đồng ${contract.MaHopDong}`
            : "Tạo hợp đồng và thêm thành viên";
        const submitButton = root.querySelector('button[form="admin-workflow-form"][type="submit"]');
        if (submitButton) submitButton.textContent = isAdding ? "Thêm sinh viên" : "Tạo hợp đồng";
        const removeButtons = form.querySelectorAll('[data-action="remove-member-row"]');
        removeButtons.forEach(button => { button.hidden = isAdding; });
        updateContractCapacity(form, roomName);
    }
    function updateContractCapacity(form, roomName) {
        const room = state.rooms.find(item => item.TenPhong === roomName);
        const selectedGender = form.querySelector('.member-row [name="maSinhVien"]')?.value
            ? state.students.find(student => student.MaSinhVien === form.querySelector('.member-row [name="maSinhVien"]').value)?.GioiTinh
            : "";
        const availableRooms = U.contractRoomAvailability(state.rooms, state.contracts)
            .filter(candidate => !selectedGender || candidate.LoaiPhong === selectedGender);
        const remaining = room ? availableRoomSpaces(room)
            : Math.max(0, ...availableRooms.map(candidate => candidate.availableSeats));
        const currentRows = form.querySelectorAll(".member-row").length;
        const selectedCount = [...form.querySelectorAll('.member-row [name="maSinhVien"]')]
            .filter(selectNode => selectNode.value).length;
        form.dataset.availableSeats = String(remaining);
        const activeContractId = form.dataset.activeContract;
        form.querySelector("[data-contract-capacity]").textContent = room
            ? `${activeContractId ? `Thêm thành viên vào hợp đồng ${activeContractId} · ` : ""}Đang ở ${roomOccupancy(room.TenPhong)}/${Number(room.SucChuaToiDa || 0)} người · Còn ${remaining} chỗ trống · Đã thêm ${currentRows} dòng`
            : selectedGender
                ? `Đã chọn ${selectedCount} sinh viên · Chọn phòng ${selectedGender} còn đủ chỗ.`
                : "Chọn sinh viên trước để lọc phòng phù hợp.";
        const addButton = form.querySelector('[data-action="add-member-row"]');
        if (addButton) addButton.disabled = Boolean(activeContractId) || currentRows >= remaining;
    }
    function memberFormRow(member = {}, _roomName = "", excludedIds = []) {
        return U.contractMemberRowHtml([], member, excludedIds);
    }
    const normalizeStudentSearch = value => String(value ?? "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi");
    const studentIdentityValues = student => [
        student.MaSinhVien, student.SoCCCD, student.CCCD, student.SoHoChieu,
        student.HoChieu, student.SoGiayTo, student.Passport
    ].filter(Boolean);
    function renderStudentSuggestions(form, row, show = true) {
        const search = row.querySelector("[data-student-search]");
        const list = row.querySelector("[data-student-options]");
        const selectedIds = JSON.parse(row.dataset.excludedIds || "[]");
        const roomName = form.elements.tenPhong?.value || "";
        const room = state.rooms.find(item => item.TenPhong === roomName);
        const firstSelectedId = [...form.querySelectorAll('.member-row [name="maSinhVien"]')]
            .map(input => input.value).find(Boolean);
        const firstGender = state.students.find(student => student.MaSinhVien === firstSelectedId)?.GioiTinh || "";
        const gender = room?.LoaiPhong || firstGender;
        const query = normalizeStudentSearch(search.value.trim());
        const matches = U.filterStudentsByRoomGender(state.students, { LoaiPhong: gender })
            .filter(student => !selectedIds.includes(student.MaSinhVien))
            .filter(student => !query || normalizeStudentSearch([
                student.HoTen, ...studentIdentityValues(student)
            ].join(" ")).includes(query))
            .slice(0, 8);
        list.innerHTML = matches.map((student, index) => {
            const occupiedContract = activeStudentContract(student.MaSinhVien);
            return `<button id="${esc(list.id)}-option-${index}" type="button" role="option" aria-selected="false"
                data-student-option="${esc(student.MaSinhVien)}"
                class="flex w-full min-w-0 items-start justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50 focus:bg-emerald-50">
                <span class="min-w-0 break-words">${esc(studentLabel(student))}</span>
                ${occupiedContract ? `<span class="shrink-0 text-xs font-semibold text-amber-800">Đang ở ${esc(occupiedContract.TenPhong)}</span>` : ""}
            </button>`;
        }).join("");
        const expanded = show && matches.length > 0;
        list.classList.toggle("hidden", !expanded);
        search.setAttribute("aria-expanded", String(expanded));
        if (!expanded) {
            search.removeAttribute("aria-activedescendant");
            row.dataset.activeOptionIndex = "-1";
        }
    }
    function updateCreateStudentOptions(form, _roomName = form.elements.tenPhong.value, activeRow = null) {
        form.querySelectorAll(".member-row").forEach(row => {
            row.dataset.excludedIds = JSON.stringify([...form.querySelectorAll('.member-row [name="maSinhVien"]')]
                .filter(input => input.closest(".member-row") !== row)
                .map(input => input.value).filter(Boolean));
            renderStudentSuggestions(form, row, row === activeRow);
        });
    }
    function applyContractStudentSelection(form, row, studentId) {
        const search = row.querySelector("[data-student-search]");
        const hidden = row.querySelector('[name="maSinhVien"]');
        const student = state.students.find(item => item.MaSinhVien === studentId);
        if (!student) throw new Error("Không tìm thấy sinh viên trong danh sách đã tải.");
        hidden.value = student.MaSinhVien;
        search.value = studentLabel(student);
        search.setAttribute("aria-expanded", "false");
        search.removeAttribute("aria-activedescendant");
        row.querySelector("[data-student-options]").classList.add("hidden");
        const selectedRoom = updateCreateRoomOptions(form);
        updateCreateStudentOptions(form, selectedRoom);
        const tier = U.tierForRoom(state.rooms, selectedRoom);
        form.elements.maHangPhong.value = tier;
        form.elements.maHangPhongDisplay.value = tier;
        updateContractMode(form, selectedRoom);
        row.querySelector("[data-student-conflict]").innerHTML =
            studentConflictMarkup(studentId, form.elements.activeContractId.value);
        const selectedMembers = [...form.querySelectorAll('.member-row [name="maSinhVien"]')]
            .map(input => input.value).filter(Boolean);
        const hasOccupiedStudent = selectedMembers.some(id => activeStudentContract(id));
        const submit = root.querySelector('button[form="admin-workflow-form"][type="submit"]');
        if (submit) submit.disabled = hasOccupiedStudent;
        updateContractCapacity(form, selectedRoom);
    }
    function updateCreateRoomOptions(form, preferredRoom = form.elements.tenPhong.value) {
        const selectedStudents = [...form.querySelectorAll('.member-row [name="maSinhVien"]')]
            .map(selectNode => state.students.find(student => student.MaSinhVien === selectNode.value))
            .filter(Boolean);
        const gender = selectedStudents[0]?.GioiTinh || "";
        const selectedHasCurrentRoom = selectedStudents.some(student => activeStudentContract(student.MaSinhVien));
        const available = selectedHasCurrentRoom ? []
            : U.contractRoomsForStudents(state.rooms, state.contracts, selectedStudents);
        const roomSelect = form.elements.tenPhong;
        const options = available.map(room => {
            const activeContract = U.contractRoomSelection(room.TenPhong, state.contracts).contract;
            return `<option value="${esc(room.TenPhong)}">${esc(U.roomLabel(room, room.currentOccupants))}${activeContract
                ? ` · ${esc(activeContract.MaHopDong)}` : ""}</option>`;
        }).join("");
        const placeholder = gender && !available.length
            ? `Không có phòng ${esc(gender)} còn chỗ`
            : "Chọn sinh viên trước";
        roomSelect.innerHTML = `<option value="" disabled>${placeholder}</option>${options}`;
        roomSelect.value = available.some(room => room.TenPhong === preferredRoom) ? preferredRoom : "";
        if (!roomSelect.value) {
            form.elements.maHangPhong.value = "";
            form.elements.maHangPhongDisplay.value = "";
            form.elements.activeContractId.value = "";
            form.dataset.activeContract = "";
        }
        return roomSelect.value;
    }
    async function openAddMember(contractId) {
        await Promise.all([loadContracts(), loadStudents(), loadRoomsAndTiers()]);
        const contract = state.contracts.find(item => item.MaHopDong === contractId);
        modalShell(`Thêm sinh viên vào ${contractId}`, `
            <form id="admin-workflow-form" data-form="member-add" class="space-y-3">
                <input type="hidden" name="contractId" value="${esc(contractId)}">
                ${select("Sinh viên", "maSinhVien", studentOptions({ availableOnly: true, roomName: contract?.TenPhong || "" }), "", true)}
                <div data-student-conflict></div>
                ${select("Kỳ hạn tiền phòng", "kyHanThanhToanPhong", [{value:"THANG",label:"Theo tháng"},{value:"NAM",label:"Theo năm"}], "THANG", true)}
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
        renderFinancialTabs();
    }
    async     function renderHoaDonModule() {
        ensureRoot("Hóa đơn và thanh toán", "Lập hóa đơn theo kỳ, quản lý khoản phát sinh, phiếu thu/chi và giao dịch.");
        content().innerHTML = `
            <nav data-financial-tabs class="mb-4 flex flex-wrap gap-2" aria-label="Quản lý tài chính"></nav>
            <section data-financial-pane></section>`;
        renderFinancialTabs();
        try {
            await loadContracts();
            renderFinancialPane();
        } catch (error) {
            apiError(error);
        }
    }
    function financialRows(type) {
        if (type === "receipts") {
            const paymentByTransaction = new Map(state.payments
                .filter(row => String(row.TrangThai).toUpperCase() !== "RECONCILIATION")
                .map(row => [String(row.MaGiaoDich), row]));
            const hiddenTransactionIds = new Set(state.payments
                .filter(row => String(row.TrangThai).toUpperCase() === "RECONCILIATION")
                .map(row => String(row.MaGiaoDich)));
            return state.receipts.filter(row => !hiddenTransactionIds.has(String(row.MaGiaoDich))).map(row => {
                const payment = paymentByTransaction.get(String(row.MaGiaoDich));
                const actualAmount = payment?.SoTienThucNhan
                    ?? (row.TrangThai === "Hợp lệ" ? row.SoTien : null);
                const merged = {
                    ...row,
                    SoTienYeuCau: payment?.SoTienYeuCau ?? payment?.TongTien ?? row.SoTien,
                    SoTienThucNhan: actualAmount,
                    HoTen: row.TenNguoiNop || payment?.HoTen || ""
                };
                return { ...merged, TrangThaiDanhSach: receiptStatusLabel(merged, payment) };
            }).filter(row => row.TrangThaiDanhSach)
                .sort((a, b) => String(b.NgayThu || b.NgayTao || "").localeCompare(String(a.NgayThu || a.NgayTao || "")));
        }
        return ({ invoices: state.invoices, expenses: state.expenses, refunds: state.refunds })[type] || [];
    }
    function pagedFinancialRows(type, rows) {
        const result = U.paginateRows(rows, state.financePages[type] || 1, 20);
        state.financePages[type] = result.page;
        const target = root?.querySelector(`[data-financial-pages="${type}"]`);
        const labels = { invoices: "hóa đơn", expenses: "chi phí phát sinh", receipts: "phiếu thu", refunds: "phiếu chi" };
        const allRows = financialRows(type);
        const summary = root?.querySelector(`[data-financial-summary="${type}"]`);
        if (summary) summary.textContent = `${rows.length} trong ${allRows.length} ${labels[type] || "bản ghi"} phù hợp với bộ lọc`;
        if (target) {
            target.innerHTML = result.pageCount > 1
            ? `<button type="button" data-action="financial-page" data-type="${type}" data-page="${result.page - 1}" ${result.page <= 1 ? "disabled" : ""} class="rounded bg-slate-100 px-2 py-1">Trước</button>
                <span class="px-1">${result.page}/${result.pageCount}</span>
                <button type="button" data-action="financial-page" data-type="${type}" data-page="${result.page + 1}" ${result.page >= result.pageCount ? "disabled" : ""} class="rounded bg-slate-100 px-2 py-1">Sau</button>` : "";
            target.classList.toggle("hidden", result.pageCount <= 1);
        }
        return result.rows;
    }
    function renderFinancialTabs() {
        const nav = root?.querySelector("[data-financial-tabs]");
        if (!nav) return;
        const tabs = [
            ["invoices", "Hóa đơn"], ["expenses", "Chi phí phát sinh"],
            ["receipts", "Phiếu thu"], ["refunds", "Phiếu chi"]
        ];
        nav.innerHTML = tabs.map(([tab, label]) => {
            const pending = U.filterFinancialRows(financialRows(tab), tab).length;
            const suffix = tab !== "receipts" && pending ? ` (${pending} cần xử lý)` : "";
            return `<button type="button" data-action="invoice-tab" data-tab="${tab}" class="rounded-lg px-3 py-2 font-semibold ${state.activeInvoiceTab === tab ? "bg-emerald-700 text-white" : "bg-slate-200"}">${label}${suffix}</button>`;
        }).join("") + (state.activeInvoiceTab === "invoices" ? button("Xuất theo kỳ", "invoice-create", "", "bg-indigo-700 text-white hover:bg-indigo-800") : "");
    }
    function financialFilterToolbar(type) {
        const rows = financialRows(type);
        const statuses = type === "invoices"
            ? ["Còn nợ", "Trễ hạn", "Đã thanh toán"]
            : type === "receipts"
                ? ["Đã thanh toán"]
            : [...new Set(rows.map(row => display(row.TrangThaiThanhToan || row.TrangThai, "")).filter(Boolean))];
        const selected = state.financeFilters[type] || {};
        return `<form data-form="financial-filter" data-finance-type="${type}" class="mb-1 flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
            ${type === "invoices" ? select("Loại hóa đơn", "invoiceType", [
                {value:"ALL",label:"Tất cả"}, {value:"TIEN_PHONG",label:"Tiền phòng"},
                {value:"DICH_VU_PHONG",label:"Dịch vụ phòng"}, {value:"PHAT_SINH",label:"Phát sinh"}
            ], selected.invoiceType || "ALL") : ""}
            ${select("Trạng thái", "status", [
                ...(type === "receipts" ? [] : [{value:"ACTION_REQUIRED",label:"Cần xử lý"}]),
                {value:"ALL",label:"Tất cả"},
                ...statuses.map(value => ({value,label:value}))
            ], selected.status || (type === "receipts" ? "ALL" : "ACTION_REQUIRED"))}
            ${["receipts", "payments"].includes(type) ? select("Phương thức", "method", [
                {value:"ALL",label:"Tất cả"}, {value:"CASH",label:"Tiền mặt"}, {value:"ONLINE",label:"Chuyển khoản QR"}
            ], selected.method || "ALL") : ""}
            <input name="search" value="${esc(selected.search || "")}" placeholder="Mã hóa đơn, giao dịch, phòng hoặc tên" aria-label="Tìm mã hóa đơn, mã giao dịch, phòng hoặc tên" class="h-10 min-w-48 flex-1 rounded-lg border px-3">
            <input name="from" type="text" maxlength="10" inputmode="numeric" data-admin-date placeholder="Từ ngày dd/mm/yyyy" value="${esc(selected.from ? U.date(selected.from, "format") : "")}" aria-label="Từ ngày dd/mm/yyyy" class="h-10 min-w-[180px] flex-[0_0_180px] rounded-lg border px-3">
            <input name="to" type="text" maxlength="10" inputmode="numeric" data-admin-date placeholder="Đến ngày dd/mm/yyyy" value="${esc(selected.to ? U.date(selected.to, "format") : "")}" aria-label="Đến ngày dd/mm/yyyy" class="h-10 min-w-[180px] flex-[0_0_180px] rounded-lg border px-3">
            ${button("Xóa lọc", "financial-filter-clear", `data-type="${type}"`, "bg-slate-200 text-slate-800")}
            <p data-filter-error class="w-full text-sm text-red-700" role="alert"></p>
        </form>`;
    }
    function applyFinancialFilter(form) {
        const type = form.dataset.financeType;
        const filters = {
            status: form.elements.status.value,
            method: form.elements.method?.value || "ALL",
            search: form.elements.search.value,
            invoiceType: form.elements.invoiceType?.value || "ALL",
            from: "", to: ""
        };
        for (const name of ["from", "to"]) {
            const value = form.elements[name].value.trim();
            if (value) {
                filters[name] = U.date(value, "parse");
                if (!filters[name]) {
                    form.querySelector("[data-filter-error]").textContent = "Ngày lọc không hợp lệ. Nhập theo dd/mm/yyyy.";
                    return;
                }
            }
        }
        if (filters.from && filters.to && filters.from > filters.to) {
            form.querySelector("[data-filter-error]").textContent = "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.";
            return;
        }
        form.querySelector("[data-filter-error]").textContent = "";
        state.financeFilters[type] = filters;
        state.financePages[type] = 1;
        renderFinancialRows(type);
    }
    function renderFinancialRows(type) {
        if (type === "invoices") renderInvoiceRows();
        else if (type === "expenses") renderExpenses();
        else if (type === "receipts") renderReceiptRows();
        else if (type === "refunds") renderRefundRows();
        renderFinancialTabs();
    }
    function renderFinancialPane() {
        const pane = root?.querySelector("[data-financial-pane]");
        if (!pane) return;
        if (state.activeInvoiceTab === "invoices") {
            pane.innerHTML = `
                ${financialFilterToolbar("invoices")}
                <p data-financial-summary="invoices" class="admin-list-summary text-sm text-slate-600"></p>
                <div data-no-admin-filters data-invoice-table class="overflow-x-auto rounded-xl border bg-white"></div>
                <footer data-financial-pages="invoices" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600"></footer>`;
            loadInvoices().catch(apiError);
        } else if (state.activeInvoiceTab === "expenses") {
            pane.innerHTML = `
                <div class="mb-3">${button("+ Thêm chi phí phát sinh", "expense-create-open")}</div>
                ${financialFilterToolbar("expenses")}
                <p data-financial-summary="expenses" class="admin-list-summary text-sm text-slate-600"></p>
                <div data-no-admin-filters data-expense-table class="overflow-x-auto rounded-xl border bg-white"></div>
                <footer data-financial-pages="expenses" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600"></footer>`;
            loadExpenses().catch(apiError);
        } else if (state.activeInvoiceTab === "receipts") {
            pane.innerHTML = `<div class="mb-2 flex justify-end"><button type="button" data-action="payments-refresh" aria-label="Làm mới phiếu thu" title="Làm mới phiếu thu" class="grid h-10 w-10 place-items-center rounded-lg border bg-white text-lg text-slate-700 hover:bg-slate-100">↻</button></div>${financialFilterToolbar("receipts")}<p data-financial-summary="receipts" class="admin-list-summary py-1 text-sm text-slate-600"></p><div data-no-admin-filters data-receipt-table class="overflow-x-auto rounded-xl border bg-white"></div>
                <footer data-financial-pages="receipts" class="hidden mt-2 flex-wrap items-center gap-2 px-3 py-2 text-sm text-slate-600"></footer>`;
            loadReceipts().catch(apiError);
        } else {
            pane.innerHTML = `${financialFilterToolbar("refunds")}<p data-financial-summary="refunds" class="admin-list-summary text-sm text-slate-600"></p><div data-no-admin-filters data-refund-table class="overflow-x-auto rounded-xl border bg-white"></div>
                <footer data-financial-pages="refunds" class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600"></footer>`;
            loadRefunds().catch(apiError);
        }
    }
    function renderInvoiceRows() {
        const table = root?.querySelector("[data-invoice-table]");
        if (!table) return;
        const rows = pagedFinancialRows("invoices",
            U.filterFinancialRows(state.invoices, "invoices", state.financeFilters.invoices));
        const columns = [
            { label: "Mã hóa đơn", width: 180, code: true, render: invoice => text(invoice.MaHoaDon) },
            { label: "Loại", width: 130, render: invoice => text(display(invoice.LoaiHoaDon)) },
            { label: "Phòng", width: 120, code: true, render: invoice => text(invoice.TenPhong) },
            { label: "Hợp đồng", width: 160, code: true, render: invoice => text(invoice.MaHopDong) },
            { label: "Người", width: 200, wrap: true, render: invoice => `<span class="admin-wrap-cell">${text(invoice.LoaiHoaDon === "DICH_VU_PHONG"
                ? `Cả phòng · ${invoice.TenDaiDienDichVu || "—"}` : invoice.HoTen)}</span>` },
            { label: "Kỳ", width: 110, render: invoice => esc(invoice.KyThanhToan ? dateOnly(invoice.KyThanhToan) : dateOnly(invoice.NgayLap)) },
            { label: "Tổng", align: "right", width: 130, render: invoice => money(invoice.TongTien) },
            { label: "Đã thu", align: "right", width: 130, render: invoice => money(invoice.DaThu) },
            { label: "Còn nợ", align: "right", width: 130, render: invoice => money(invoice.ConNo) },
            { label: "Trạng thái", width: 120, render: invoice => invoiceStatusBadge(invoice) },
            { label: "", width: 40, render: () => `<span aria-hidden="true" class="text-lg text-slate-500">›</span>` }
        ];
        table.innerHTML = U.renderTable(columns, rows, "Không có dữ liệu phù hợp", invoice =>
            `data-action="row-detail" data-detail-type="invoice" data-detail-id="${esc(invoice.MaHoaDon)}" tabindex="0" role="button" aria-label="Chi tiết hóa đơn ${esc(invoice.MaHoaDon)}" class="cursor-pointer hover:bg-slate-50 focus:bg-emerald-50 focus:outline focus:outline-2 focus:outline-emerald-600"`);
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
        const paymentHistory = await request("/api/payments/history");
        if (!state.students.length) await loadStudents();
        state.invoiceDetail = invoice;
        const invoiceTotal = Number(invoice.TongTien ?? invoice.TongThuc
            ?? (invoice.ChiTiet || []).reduce((total, line) => total + Number(line.SoTien || 0), 0));
        const invoicePayments = (Array.isArray(paymentHistory) ? paymentHistory : [])
            .filter(payment => String(payment.MaHoaDon) === String(invoice.MaHoaDon)
                && String(payment.TrangThai).toUpperCase() !== "RECONCILIATION");
        const invoiceContract = state.contracts.find(contract => contract.MaHopDong === invoice.MaHopDong);
        const invoiceMembers = (invoiceContract?.sinhVien || []).filter(member => member.TrangThai === "Đang ở");
        const defaultPayer = invoice.MaSinhVien
            || invoiceMembers.find(member => Boolean(member.LaNguoiDaiDienThanhToanDichVu))?.MaSinhVien
            || invoiceMembers[0]?.MaSinhVien
            || invoice.MaDaiDienDichVu
            || "";
        const invoiceLineTable = U.renderTable([
            { label: "Khoản", render: line => text(line.TenKhoan), longText: true, title: line => line.TenKhoan || "" },
            ...(invoice.ChiTiet?.some(line => line.ChiSoCu != null || line.ChiSoMoi != null)
                ? [{ label: "Chỉ số", render: line => line.ChiSoCu == null && line.ChiSoMoi == null
                    ? "—" : `${text(line.ChiSoCu)} → ${text(line.ChiSoMoi)}` }]
                : []),
            { label: "Số tiền", align: "right", render: line => money(line.SoTien) }
        ], invoice.ChiTiet || []);
        const hiddenTransactionIds = new Set(state.payments
            .filter(payment => String(payment.TrangThai).toUpperCase() === "RECONCILIATION")
            .map(payment => String(payment.MaGiaoDich)));
        const visibleReceipts = (invoice.PhieuThu || []).filter(receipt =>
            receipt.TrangThai !== "Đã hủy" && !hiddenTransactionIds.has(String(receipt.MaGiaoDich)));
        const receiptTable = U.renderTable([
            { label: "Mã phiếu", render: receipt => text(receipt.MaPhieuThu) },
            { label: "Người nộp", render: receipt => text(receipt.TenNguoiNop), longText: true, title: receipt => receipt.TenNguoiNop || "—" },
            { label: "Số tiền", align: "right", render: receipt => money(receipt.SoTien) },
            { label: "Trạng thái", render: receipt => badge(receipt.TrangThai) }
        ], visibleReceipts);
        const paymentTable = U.renderTable([
            { label: "Giao dịch", width: 130, render: payment => text(payment.MaGiaoDich) },
            { label: "Người nộp", width: 180, wrap: true, render: payment => `<span class="admin-wrap-cell">${text(payment.HoTen)}</span>` },
            { label: "Số tiền", align: "right", width: 130, render: payment => money(payment.SoTien) },
            { label: "Phương thức", width: 140, render: payment => text(U.paymentMethodLabel(payment.PhuongThuc)) },
            { label: "Trạng thái", width: 140, render: payment => {
                const receipt = state.receipts.find(item => String(item.MaPhieuThu) === String(payment.MaPhieuThu));
                return badge(receiptStatusLabel(receipt || payment, payment));
            } },
            { label: "Thao tác", width: 160, render: payment =>
                button(
                    "Chi tiết giao dịch", "row-detail",
                    `data-detail-type="payment" data-detail-id="${esc(payment.MaGiaoDich)}"`,
                    "whitespace-normal bg-slate-700 text-white"
                ) }
        ], invoicePayments, "Chưa có giao dịch thanh toán.");
        const modal = drawerShell(`Hóa đơn ${invoice.MaHoaDon}`, `
            <article data-print-area class="space-y-4">
                <div class="grid gap-2 md:grid-cols-3">
                    <p>Mã hóa đơn: <strong>${text(invoice.MaHoaDon)}</strong></p>
                    <p>Loại hóa đơn: <strong>${text(display(invoice.LoaiHoaDon))}</strong></p>
                    <p>Phòng: <strong>${esc(invoice.TenPhong || "—")}</strong></p>
                    <p>Hợp đồng: <strong>${esc(invoice.MaHopDong || "—")}</strong></p>
                    <p>Người: <strong>${esc(invoice.LoaiHoaDon === "DICH_VU_PHONG"
                        ? `Cả phòng · ${invoice.TenDaiDienDichVu || "—"}` : invoice.HoTen || "—")}</strong></p>
                    <p>Kỳ: <strong>${esc(invoice.KyThanhToan ? dateOnly(invoice.KyThanhToan) : dateOnly(invoice.NgayLap))}</strong></p>
                    <p>Hạn thanh toán: <strong>${esc(dateOnly(invoice.HanThanhToan))}</strong></p>
                    <p>Tổng: <strong>${money(invoiceTotal)}</strong></p>
                    <p>Đã thu: <strong>${money(invoice.DaThu)}</strong></p>
                    <p>Còn nợ: <strong data-outstanding>${money(invoice.ConNo)}</strong></p>
                    <p>Trạng thái: <strong>${invoiceStatusBadge(invoice)}</strong></p>
                    ${U.isOverdueInvoice(invoice) ? `<p class="text-xs text-red-700">Trễ hạn ${U.overdueDays(invoice)} ngày</p>` : ""}
                </div>
                <h4 class="font-bold">Chi tiết hóa đơn</h4>
                <div data-no-admin-filters class="overflow-auto">${invoiceLineTable}</div>
                <h4 class="font-bold">Phiếu thu</h4>
                <div data-no-admin-filters class="overflow-auto">${receiptTable}</div>
                <h4 class="font-bold">Lịch sử thanh toán</h4>
                <div data-no-admin-filters class="overflow-auto">${paymentTable}</div>
                ${button("In phiếu thu gần nhất", "receipt-print-latest", "", "bg-slate-700 text-white")}
            </article>
            ${invoice.TrangThaiThanhToan !== "Đã hủy" ? `<div class="mt-4">${button("Hủy hóa đơn", "invoice-cancel", `data-invoice="${esc(invoice.MaHoaDon)}"`, "bg-red-700 text-white")}</div>` : ""}
            ${U.isOverdueInvoice(invoice) ? `<div class="mt-3">${button("Gửi nhắc nợ", "invoice-remind", `data-invoice="${esc(invoice.MaHoaDon)}"`, "bg-amber-700 text-white")}</div>` : ""}
            <form id="admin-workflow-form" data-form="receipt-create" class="mt-5 grid gap-3 border-t pt-4 md:grid-cols-3">
                <input type="hidden" name="invoiceId" value="${esc(invoice.MaHoaDon)}">
                <div>${field("Số tiền tiền mặt (mặc định còn nợ)", "soTien", "number", Math.max(0, Number(invoice.ConNo || 0)), true, 'min="1" step="1" inputmode="numeric"')}</div>
                <p class="hidden md:col-span-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-cash-amount-warning role="alert" aria-live="polite"></p>
                ${select("Người nộp", "maSinhVienNop", [
                    ...(invoiceMembers.length
                        ? invoiceMembers.map(member => ({value:member.MaSinhVien,label:memberName(member)}))
                        : state.students.map(student => ({value:student.MaSinhVien,label:studentLabel(student)})))
                ], defaultPayer, true)}
                <button class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white md:col-span-3">Thu tiền mặt</button>
            </form>`);
        if (modal) modal.querySelector("[data-modal-error]")?.classList.add("hidden");
    }
    async function loadExpenses() {
        state.expenses = await request("/api/ChiPhiPhatSinh");
        renderExpenses();
        renderFinancialTabs();
    }
    function renderExpenses() {
        const table = root?.querySelector("[data-expense-table]");
        if (!table) return;
        const rows = pagedFinancialRows("expenses",
            U.filterFinancialRows(state.expenses, "expenses", state.financeFilters.expenses));
        const columns = [
            { label: "Khoản", width: 220, wrap: true, render: expense => `<span class="admin-wrap-cell">${text(expense.NoiDung)}</span>` },
            { label: "Phòng / hợp đồng", width: 150, render: expense => `${text(expense.TenPhong)} / ${text(expense.MaHopDong)}` },
            { label: "Sinh viên", width: 170, wrap: true, render: expense => `<span class="admin-wrap-cell">${text(expense.HoTen)}</span>` },
            { label: "Ngày", width: 115, render: expense => esc(dateOnly(expense.NgayPhatSinh)) },
            { label: "Hạn đóng", width: 115, render: expense => esc(dateOnly(expense.HanDong)) },
            { label: "Số tiền", align: "right", width: 135, render: expense => money(expense.SoTien) },
            { label: "Trạng thái", width: 130, render: expense => badge(expense.TrangThai) },
            { label: "", width: 40, render: () => `<span aria-hidden="true" class="text-lg text-slate-500">›</span>` }
        ];
        table.innerHTML = U.renderTable(columns, rows, "Không có dữ liệu phù hợp", expense =>
            `data-action="row-detail" data-detail-type="expense" data-detail-id="${esc(expense.MaChiPhi)}" tabindex="0" role="button" aria-label="Chi tiết khoản phát sinh ${esc(expense.MaChiPhi)}" class="cursor-pointer hover:bg-slate-50 focus:bg-emerald-50 focus:outline focus:outline-2 focus:outline-emerald-600"`);
    }
    async function loadReceipts() {
        const [receipts, payments] = await Promise.all([
            request("/api/phieuthu"),
            request("/api/payments/history")
        ]);
        state.receipts = receipts;
        state.payments = payments;
        renderReceiptRows();
        renderFinancialTabs();
    }
    function renderReceiptRows() {
        const table = root?.querySelector("[data-receipt-table]");
        if (!table) return;
        const rows = pagedFinancialRows("receipts",
            U.filterFinancialRows(financialRows("receipts"), "receipts", state.financeFilters.receipts));
        const columns = [
            { label: "Mã hóa đơn", width: 120, wrap: true, render: receipt => text(receipt.MaHoaDon) },
            { label: "Phòng", width: 150, nowrap: true, render: receipt => text(receipt.TenPhong) },
            { label: "Người nộp", width: 165, wrap: true, render: receipt => `<span class="admin-wrap-cell">${text(receipt.TenNguoiNop || receipt.HoTen)}</span>` },
            { label: "Số tiền", align: "right", width: 125, nowrap: true, render: receipt => money(receipt.SoTien) },
            { label: "Phương thức", width: 140, wrap: true, render: receipt => text(U.paymentMethodLabel(receipt.PhuongThuc)) },
            { label: "Thời điểm", width: 155, nowrap: true, render: receipt => esc(receiptDateTime(receipt.NgayThu || receipt.NgayTao)) },
            { label: "Trạng thái", width: 155, wrap: true, render: receipt => receiptStatusBadge(receipt.TrangThaiDanhSach) }
        ];
        table.innerHTML = U.renderTable(columns, rows, "Không có dữ liệu phù hợp",
            receipt => `data-action="row-detail" data-detail-type="receipt" data-detail-id="${esc(receipt.MaPhieuThu)}" data-receipt-row="${esc(receipt.MaPhieuThu)}" tabindex="0" role="button" aria-label="Chi tiết phiếu thu ${esc(receipt.MaPhieuThu)}" class="cursor-pointer hover:bg-slate-50 focus:bg-emerald-50 focus:outline focus:outline-2 focus:outline-emerald-600"`,
            "admin-table--fixed admin-receipt-table");
    }
    async function loadRefunds() {
        state.refunds = await request("/api/phieuchi");
        renderRefundRows();
        renderFinancialTabs();
    }
    function renderRefundRows() {
        const table = root?.querySelector("[data-refund-table]");
        if (!table) return;
        const rows = pagedFinancialRows("refunds",
            U.filterFinancialRows(state.refunds, "refunds", state.financeFilters.refunds));
        const columns = [
            { label: "Phiếu chi", width: 140, render: refund => `#${text(refund.MaPhieuChi)} · ${dateOnly(refund.NgayChi)}` },
            { label: "Sinh viên / chi tiết", width: 230, wrap: true, render: refund => `<span class="admin-wrap-cell">${text(refund.HoTen)} / ${text(refund.MaChiTiet)}</span>` },
            { label: "Đã đóng", align: "right", width: 130, render: refund => money(refund.SoTienDaDong) },
            { label: "Đã hoàn", align: "right", width: 130, render: refund => money(refund.SoTien) },
            { label: "Trạng thái", width: 125, render: refund => badge(refund.TrangThai) },
            { label: "", width: 40, render: () => `<span aria-hidden="true" class="text-lg text-slate-500">›</span>` }
        ];
        table.innerHTML = U.renderTable(columns, rows, "Không có dữ liệu phù hợp", refund =>
            `data-action="row-detail" data-detail-type="refund" data-detail-id="${esc(refund.MaPhieuChi)}" tabindex="0" role="button" aria-label="Chi tiết phiếu chi ${esc(refund.MaPhieuChi)}" class="cursor-pointer hover:bg-slate-50 focus:bg-emerald-50 focus:outline focus:outline-2 focus:outline-emerald-600"`);
    }

    async function renderPhongModule() {
        ensureRoot("Phòng, hạng phòng và dịch vụ", "Giá phòng lấy theo hạng; điều chỉnh giá tại cấu hình hạng phòng, không nhập giá cho từng phòng.");
        content().innerHTML = `
            <nav data-room-tabs class="mb-4 flex flex-wrap gap-2" aria-label="Phòng ở">
                ${["rooms", "tiers"].map((tab, index) => button(
                    ["Phòng", "Hạng phòng"][index], "room-tab", `data-tab="${tab}"`,
                    state.activeRoomTab === tab ? "bg-emerald-700 text-white ring-2 ring-emerald-900" : "bg-slate-100 text-slate-700"
                )).join("")}
            </nav><section data-room-pane></section>`;
        try {
            await Promise.all([loadRoomsAndTiers(), loadContracts(), loadServices()]);
            renderRoomPane();
        } catch (error) {
            apiError(error);
        }
    }
    function renderRoomTabs() {
        const nav = root?.querySelector("[data-room-tabs]");
        if (!nav) return;
        nav.innerHTML = ["rooms", "tiers"].map((tab, index) => button(
            ["Phòng", "Hạng phòng"][index], "room-tab", `data-tab="${tab}"`,
            state.activeRoomTab === tab ? "bg-emerald-700 text-white ring-2 ring-emerald-900" : "bg-slate-100 text-slate-700"
        )).join("");
    }
    function roomStatuses() {
        return [...new Set(state.rooms.map(room => room.TrangThaiPhong).filter(Boolean))];
    }
    function draftForTier(tier) {
        return {
            tierId: tier.MaHangPhong,
            tenHangPhong: tier.TenHangPhong || "",
            sucChuaToiDa: Number(tier.SucChuaToiDa),
            giaPhongThang: Number(tier.GiaPhongThang),
            giaPhongNam: Number(tier.GiaPhongNam),
            dichVu: (tier.dichVu || []).map(service => ({
                MaDichVu: service.MaDichVu, DonGia: Number(service.DonGia || 0),
                CachTinh: service.CachTinh || "CO_DINH_KY",
                DoiTuongThanhToan: service.DoiTuongThanhToan || "PHONG",
                HoatDong: Boolean(Number(service.HoatDong))
            }))
        };
    }
    function readTierDraft(form) {
        return {
            tierId: form.dataset.tier,
            tenHangPhong: form.elements.tenHangPhong.value.trim(),
            sucChuaToiDa: Number(form.elements.sucChuaToiDa.value),
            giaPhongThang: U.parseVndNonNegative(form.elements.giaPhongThang.value),
            giaPhongNam: U.parseVndNonNegative(form.elements.giaPhongNam.value),
            dichVu: form.dataset.serviceEditing === "true" ? [...form.querySelectorAll("[data-tier-service-row]")].map(row => ({
                MaDichVu: row.querySelector('[name="serviceId"]').value,
                DonGia: U.parseVndNonNegative(row.querySelector('[name="servicePrice"]').value),
                CachTinh: row.querySelector('[name="serviceMethod"]').value,
                DoiTuongThanhToan: row.querySelector('[name="servicePayer"]').value,
                HoatDong: row.querySelector('[name="serviceActive"]').checked
            })) : (state.tierDraft?.dichVu || []).map(service => ({ ...service }))
        };
    }
    function syncTierDraft(form) {
        if (!form || form.dataset.form !== "tier-update") return;
        state.tierDraft = readTierDraft(form);
        const dirty = U.hasTierDraftChanges(state.tierDraft, state.tierOriginal || {});
        form.querySelector("[data-tier-save]")?.toggleAttribute("hidden", !dirty || state.tierServicesEditing);
        form.querySelector("[data-tier-cancel]")?.toggleAttribute("hidden", !dirty);
        const summary = form.querySelector("[data-tier-summary]");
        if (summary) summary.textContent = tierSummary(state.tierDraft);
    }
    function tierSummary(draft) {
        const fixed = [];
        const meters = [];
        const unpriced = [];
        for (const service of draft.dichVu.filter(item => item.HoatDong)) {
            const definition = state.services?.find(item => item.MaDichVu === service.MaDichVu);
            const name = definition?.TenDichVu || service.TenDichVu || service.MaDichVu;
            if (!(Number(service.DonGia) > 0)) unpriced.push(name);
            if (service.CachTinh === "CHI_SO") meters.push(`${name}: ${money(service.DonGia)}/${text(definition?.DonVi)}`);
            else fixed.push(`${name}: ${money(service.DonGia)} · ${display(service.DoiTuongThanhToan)}`);
        }
        return `Tiền phòng ${money(draft.giaPhongThang)}/tháng mỗi người · Dịch vụ cố định theo kỳ: ${fixed.join(", ") || "Không có"} · Theo chỉ số: ${meters.join(", ") || "Không có"} · Chưa có giá: ${unpriced.join(", ") || "Không có"}`;
    }
    function tierServiceViewRow(service) {
        const definition = state.services?.find(item => item.MaDichVu === service.MaDichVu);
        const warning = !(Number(service.DonGia) > 0) || !Boolean(Number(service.HoatDong));
        return `<div data-tier-service-row class="grid items-center gap-2 border-t py-3 text-sm md:grid-cols-[minmax(120px,1.2fr)_minmax(100px,.8fr)_minmax(135px,1fr)_minmax(120px,1fr)]">
            <div>${text(definition?.TenDichVu || service.TenDichVu || service.MaDichVu)}${warning ? '<span class="mt-1 block w-fit rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Chưa có đơn giá</span>' : ""}</div>
            <span>${money(service.DonGia)}</span>
            <span>${text(display(service.CachTinh))}</span>
            <span>${text(display(service.DoiTuongThanhToan))}</span>
            <input type="hidden" name="serviceId" value="${esc(service.MaDichVu)}">
            <input type="hidden" name="servicePrice" value="${esc(service.DonGia)}">
            <input type="hidden" name="serviceMethod" value="${esc(service.CachTinh)}">
            <input type="hidden" name="servicePayer" value="${esc(service.DoiTuongThanhToan)}">
            <input type="checkbox" name="serviceActive" hidden ${service.HoatDong !== false ? "checked" : ""}>
        </div>`;
    }
    function roomTierInfo(room) {
        const contracts = state.contracts.filter(contract => contract.TenPhong === room.TenPhong
            && contract.TrangThaiHopDong === "Còn hiệu lực");
        const residents = Math.max(Number(room.SoSinhVienHienTai || 0),
            contracts.reduce((count, contract) => count + activeMembers(contract).length, 0));
        return { contracts, residents };
    }
    async function updateRoomTier(room, tier) {
        if (!room || !tier) throw new Error("Thiếu dữ liệu phòng hoặc hạng đích.");
        await request(`/api/Phong/${encodeURIComponent(room.TenPhong)}`, {
            method: "PUT",
            body: json({
                Khu: room.Khu,
                LoaiPhong: room.LoaiPhong,
                SucChuaToiDa: Number(tier.SucChuaToiDa),
                MaHangPhong: tier.MaHangPhong,
                TrangThaiPhong: room.TrangThaiPhong,
                GhiChu: room.GhiChu || ""
            })
        });
    }
    function roomTierRow(room) {
        const { contracts, residents } = roomTierInfo(room);
        const blocked = !U.canChangeRoomTier({
            SoSinhVienHienTai: residents,
            SoHopDongConHieuLuc: contracts.length
        });
        const reason = contracts.length
            ? "Phòng đang có hợp đồng còn hiệu lực: kết thúc hợp đồng hoặc chuyển người trước"
            : "Phòng đang có người ở; chuyển người trước khi đổi hạng";
        return `<div class="grid items-center gap-2 rounded border p-2 text-sm md:grid-cols-[1fr_.7fr_1fr_1.2fr_auto]">
            <span>${text(room.TenPhong)}</span><span>Khu ${text(room.Khu)}</span>
            <span>Đang ở ${residents}/${Number(room.SucChuaToiDa || 0)}</span>
            <span>${contracts.length} hợp đồng còn hiệu lực</span>
            ${button("Đổi hạng", "room-tier-change", `data-room="${esc(room.TenPhong)}" ${blocked ? `disabled title="${esc(reason)}" aria-disabled="true"` : ""}`, "bg-slate-700 text-white")}
            ${blocked ? `<span class="md:col-span-5 text-xs text-amber-800">${esc(reason)}</span>` : ""}
        </div>`;
    }
    function renderRoomPane() {
        const pane = root?.querySelector("[data-room-pane]");
        if (!pane) return;
        renderRoomTabs();
        if (state.activeRoomTab === "rooms") {
            const filters = state.roomFilters;
            const rooms = state.rooms.filter(room => (filters.status === "ALL" || room.TrangThaiPhong === filters.status)
                && (filters.gender === "ALL" || U.roomGender(room) === filters.gender)
                && (filters.khu === "ALL" || room.Khu === filters.khu)
                && (filters.tier === "ALL" || room.MaHangPhong === filters.tier)
                && String(room.TenPhong || "").toLocaleLowerCase("vi").includes(String(filters.search || "").toLocaleLowerCase("vi")))
                .sort((left, right) => String(left.Khu || "").localeCompare(String(right.Khu || ""), "vi")
                    || String(left.TenPhong || "").localeCompare(String(right.TenPhong || ""), "vi"));
            const page = U.paginateRows(rooms, filters.page, 20);
            state.roomFilters.page = page.page;
            pane.innerHTML = `<form data-form="room-filter" class="mb-1 flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
                ${select("Trạng thái", "status", [{value:"ALL",label:"Tất cả"}, ...roomStatuses().map(value => ({value,label:value}))], filters.status)}
                ${select("Giới tính phòng", "gender", [{value:"ALL",label:"Tất cả"}, ...[...new Set(state.rooms.map(U.roomGender))].map(value => ({value,label:value}))], filters.gender)}
                ${select("Khu", "khu", [{value:"ALL",label:"Tất cả"}, ...[...new Set(state.rooms.map(room => room.Khu).filter(Boolean))].map(value => ({value,label:value}))], filters.khu)}
                ${select("Hạng", "tier", [{value:"ALL",label:"Tất cả"}, ...state.tiers.map(tier => ({value:tier.MaHangPhong,label:tier.MaHangPhong}))], filters.tier)}
                ${field("Tìm tên phòng", "search", "text", filters.search)}
                ${button("Xóa lọc", "room-filter-clear", "", "bg-slate-200 text-slate-800")}
            </form>
            <p class="admin-list-summary text-sm text-slate-600">Tổng: ${state.rooms.length} phòng · ${rooms.length} phù hợp</p>
            <div data-no-admin-filters data-room-list class="overflow-x-auto rounded-xl border bg-white"></div>
            <footer class="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-white px-3 py-2">
                <span class="flex items-center gap-2 whitespace-nowrap">${button("Trước", "room-page", `data-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}`, "bg-slate-100 text-slate-800")}
                    <span>${page.page}/${page.pageCount}</span>${button("Sau", "room-page", `data-page="${page.page + 1}" ${page.page >= page.pageCount ? "disabled" : ""}`, "bg-slate-100 text-slate-800")}</span>
            </footer>`;
            const columns = [
                { label: "Phòng", render: room => text(room.TenPhong) },
                { label: "Khu", render: room => text(room.Khu) },
                { label: "Giới tính", render: room => U.genderBadge(room.LoaiPhong) },
                { label: "Hạng", render: room => text(room.MaHangPhong) },
                { label: "Sĩ số (hiện/tối đa)", render: room => `${Number(room.SoSinhVienHienTai || 0)}/${Number(room.SucChuaToiDa || 0)}` },
                { label: "Giá hạng/tháng", align: "right", width: 160, render: room => money(room.GiaPhong) },
                { label: "Trạng thái", render: room => badge(room.TrangThaiPhong) }
            ];
            root.querySelector("[data-room-list]").innerHTML = U.renderTable(columns, page.rows, "Không có dữ liệu phù hợp", room =>
                `data-action="row-detail" data-detail-type="room" data-detail-id="${esc(room.TenPhong)}" tabindex="0" role="button" aria-label="Chi tiết phòng ${esc(room.TenPhong)}" class="cursor-pointer hover:bg-slate-50 focus:bg-emerald-50 focus:outline focus:outline-2 focus:outline-emerald-600"`);
        } else {
            if (!state.selectedTierId && state.tiers.length) state.selectedTierId = state.tiers[0].MaHangPhong;
            const tiers = state.tiers.filter(tier => `${tier.MaHangPhong} ${tier.TenHangPhong}`.toLocaleLowerCase("vi").includes(state.tierSearch.toLocaleLowerCase("vi")));
            const tier = state.tiers.find(item => item.MaHangPhong === state.selectedTierId);
            if (tier && state.tierDraft?.tierId !== tier.MaHangPhong) {
                state.tierDraft = null;
                state.tierOriginal = null;
            }
            if (tier && !state.tierDraft) {
                state.tierDraft = draftForTier(tier);
                state.tierOriginal = draftForTier(tier);
            }
            const draft = state.tierDraft;
            const rooms = tier ? state.rooms.filter(room => room.MaHangPhong === tier.MaHangPhong) : [];
            const activeContracts = tier ? state.contracts.filter(contract => contract.MaHangPhong === tier.MaHangPhong
                && contract.TrangThaiHopDong === "Còn hiệu lực") : [];
            const grouped = new Map();
            rooms.forEach(room => {
                const area = room.Khu || "—";
                if (!grouped.has(area)) grouped.set(area, []);
                grouped.get(area).push(room);
            });
            pane.innerHTML = `<div class="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
                <aside class="rounded-xl border bg-white p-4"><label class="text-sm font-semibold">Tìm hạng<input name="tierSearch" value="${esc(state.tierSearch)}" class="mt-1 w-full rounded border p-2"></label>
                    <div class="mt-3 max-h-[65vh] space-y-2 overflow-auto">${tiers.map(item => {
                        const roomCount = state.rooms.filter(room => room.MaHangPhong === item.MaHangPhong).length;
                        return `<button type="button" data-action="tier-select" data-tier="${esc(item.MaHangPhong)}" class="w-full rounded-lg border p-3 text-left ${item.MaHangPhong === state.selectedTierId ? "border-emerald-700 bg-emerald-50" : "bg-white"}">
                            <strong>${text(item.MaHangPhong)} · ${text(item.TenHangPhong)}</strong><span class="block text-sm">${Number(item.SucChuaToiDa)} người · ${money(item.GiaPhongThang)}/tháng · ${roomCount} phòng</span></button>`;
                    }).join("") || `<p class="text-sm text-slate-500">Không có hạng phù hợp.</p>`}</div></aside>
                <section class="max-h-[75vh] overflow-auto rounded-xl border bg-white p-4">${tier ? `<form data-form="tier-update" data-tier="${esc(tier.MaHangPhong)}" data-service-editing="${state.tierServicesEditing}" class="space-y-5">
                    <h2 class="text-lg font-bold">Thông tin hạng · ${text(tier.MaHangPhong)}</h2>
                    <div class="grid gap-3 md:grid-cols-2">${field("Tên hạng", "tenHangPhong", "text", draft.tenHangPhong, true)}
                        ${field("Sức chứa", "sucChuaToiDa", "number", draft.sucChuaToiDa, true, 'min="1" step="1"')}
                        ${moneyField("Giá phòng / tháng (mỗi người)", "giaPhongThang", draft.giaPhongThang)}
                        ${moneyField("Giá phòng / năm (mỗi người)", "giaPhongNam", draft.giaPhongNam)}</div>
                    <section class="space-y-3 rounded-lg border p-4"><div class="flex flex-wrap items-center justify-between gap-2">
                        <h3 class="font-semibold">Giá & dịch vụ của hạng</h3>
                        <div class="flex flex-wrap gap-2">
                            ${state.tierServicesEditing ? button("+ Thêm dịch vụ", "tier-service-add", `data-tier="${esc(tier.MaHangPhong)}"`) : ""}
                            ${button(state.tierServicesEditing ? "Lưu dịch vụ" : "Chỉnh sửa dịch vụ", "tier-services-toggle", `data-tier="${esc(tier.MaHangPhong)}"`, "bg-slate-700 text-white")}
                        </div></div>
                        <p data-tier-summary class="text-sm text-slate-700">${esc(tierSummary(draft))}</p>
                        <div class="min-w-0">
                            <div class="grid gap-2 border-b pb-2 text-xs font-bold text-slate-600 ${state.tierServicesEditing
                                ? "lg:grid-cols-[minmax(130px,1.2fr)_minmax(100px,.8fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)_100px]"
                                : "md:grid-cols-[minmax(120px,1.2fr)_minmax(100px,.8fr)_minmax(135px,1fr)_minmax(120px,1fr)]"}">
                                <span>Dịch vụ</span><span>Đơn giá (đ)</span><span>Cách tính</span><span>Người thanh toán</span>
                                ${state.tierServicesEditing ? "<span>Hoạt động</span><span>Thao tác</span>" : ""}
                            </div><div data-tier-services>${draft.dichVu.filter(service =>
                                state.tierServicesEditing || service.HoatDong === true || service.HoatDong === 1)
                                .map(service => state.tierServicesEditing
                                    ? tierServiceRow(service, service.MaDichVu) : tierServiceViewRow(service)).join("")
                                || `<p data-no-services class="p-3 text-slate-500">Chưa có dịch vụ đang áp dụng.</p>`}</div>
                        </div>
                        <button type="button" data-action="service-catalog-manage" class="text-sm text-emerald-800 underline">Quản lý danh mục dịch vụ</button>
                    </section>
                    <section><div class="flex items-center justify-between gap-2"><div><h3 class="font-semibold">Áp dụng cho</h3><p>${rooms.length} phòng · ${activeContracts.length} hợp đồng còn hiệu lực</p></div>
                        ${button("+ Thêm phòng vào hạng này", "tier-room-add", `data-tier="${esc(tier.MaHangPhong)}"`)}</div>
                        ${[...grouped.entries()].map(([area, areaRooms]) => `<details class="mt-2 rounded border p-2" open><summary class="font-semibold">Khu ${text(area)} (${areaRooms.length})</summary>
                            <div class="mt-2 space-y-2">${areaRooms.map(roomTierRow).join("")}</div></details>`).join("") || `<p class="text-sm text-slate-500">Chưa có phòng áp dụng.</p>`}
                    </section>
                    <div class="flex gap-2"><button type="submit" data-tier-save hidden class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Lưu thay đổi</button>
                        ${button("Hủy thay đổi", "tier-draft-cancel", 'data-tier-cancel hidden', "bg-slate-200 text-slate-800")}</div>
                </form>` : `<p class="p-6 text-center text-slate-500">Chọn một hạng để xem</p>`}</section></div>`;
        }
    }
    function tierServiceRow(service = {}, selectedId = "") {
        const id = selectedId || service.MaDichVu || "";
        const price = Number(service.DonGia || 0);
        const canActivate = U.serviceCanBeActive(price);
        const warning = !canActivate || service.CanhBao;
        return `<div data-tier-service-row class="grid items-start gap-2 border-t py-3 lg:grid-cols-[minmax(150px,1.2fr)_minmax(110px,.8fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(160px,1fr)_100px]">
            <div class="min-w-0">
                <select name="serviceId" required aria-label="Dịch vụ" class="w-full rounded border p-2">
                    <option value="">Chọn dịch vụ</option>
                    ${(state.services || []).map(item => `<option value="${esc(item.MaDichVu)}" ${item.MaDichVu === id ? "selected" : ""}>${text(item.TenDichVu)}</option>`).join("")}
                </select>
                <span data-rate-warning class="mt-1 inline-flex rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 ${warning ? "" : "hidden"}">Chưa có đơn giá</span>
            </div>
            <span class="flex items-center rounded border px-2">
                <input name="servicePrice" aria-label="Đơn giá dịch vụ" type="text" inputmode="numeric" data-vnd-nonnegative
                    value="${esc(U.formatVnd(price).replace(/\u00a0đ$/, ""))}" class="w-full min-w-0 py-2">
                <span class="text-xs text-slate-500">đ</span>
            </span>
            <select name="serviceMethod" aria-label="Cách tính" class="rounded border p-2">
                ${["CO_DINH_KY", "CHI_SO"].map(value => `<option value="${value}" ${service.CachTinh === value ? "selected" : ""}>${value === "CHI_SO" ? "Theo chỉ số công tơ" : "Cố định theo kỳ"}</option>`).join("")}
            </select>
            <select name="servicePayer" aria-label="Đối tượng thanh toán" class="rounded border p-2">
                ${["PHONG", "CA_NHAN"].map(value => `<option value="${value}" ${(service.DoiTuongThanhToan || "PHONG") === value ? "selected" : ""}>${value === "PHONG" ? "Cả phòng" : "Từng người"}</option>`).join("")}
            </select>
            <div class="flex flex-col items-start gap-2">
                <label class="flex items-center gap-2 text-sm">
                    <input name="serviceActive" type="checkbox" ${canActivate && Boolean(Number(service.HoatDong)) ? "checked" : ""}
                        ${canActivate ? "" : "disabled"}> Hoạt động
                </label>
                <span data-price-disabled-hint class="text-xs text-amber-800 ${canActivate ? "hidden" : ""}">Nhập đơn giá trước khi bật</span>
            </div>
            <div>${button("Gỡ dịch vụ", "tier-service-remove", "", "bg-red-100 text-red-800")}</div>
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
                ${select("Trạng thái", "TrangThaiPhong", ["Trống","Đầy","Bảo trì","Ngưng sử dụng"].map(value => ({value,label:value})), room.TrangThaiPhong, true)}
                <p class="sm:col-span-2">Hạng ${text(room.MaHangPhong)} · Giá hiện tại theo hạng: <strong>${money(room.GiaPhong)}</strong>. Đổi hạng trong mục Hạng phòng.</p>
                <label class="sm:col-span-2">Ghi chú<textarea name="GhiChu" maxlength="255" class="mt-1 w-full rounded border p-2">${esc(room.GhiChu || "")}</textarea></label>
            </form>`);
    }

    async function renderBaoCaoThongKeModule() {
        ensureRoot("Báo cáo doanh thu và công nợ", "Doanh thu ròng = phiếu thu hợp lệ − phiếu chi hợp lệ.");
        content().innerHTML = `
            <div class="mb-4 flex items-end gap-2">
                ${field("Năm", "reportYear", "number", new Date().getFullYear(), true, 'min="2000" max="2100" step="1"')}
                <button type="button" data-action="report-load" class="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Tải báo cáo</button>
            </div>
            <section data-report-revenue data-no-admin-filters class="admin-report-scroll max-w-full overflow-x-auto rounded-xl border bg-white"></section>
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
        const revenueFields = [
            ["Thu phòng", "ThuTienPhong"], ["Chi phòng", "ChiTienPhong"], ["Ròng phòng", "DoanhThuTienPhong"],
            ["Thu dịch vụ", "ThuDichVu"], ["Chi dịch vụ", "ChiDichVu"], ["Ròng dịch vụ", "DoanhThuDichVu"],
            ["Thu phát sinh", "ThuPhatSinh"], ["Chi phát sinh", "ChiPhatSinh"], ["Ròng phát sinh", "DoanhThuPhatSinh"],
            ["Tổng thu", "TongThu"], ["Tổng chi", "TongChi"], ["Doanh thu ròng", "DoanhThuRong"]
        ];
        root.querySelector("[data-report-revenue]").innerHTML = U.renderTable([
            { label: "Tháng", width: 100, nowrap: true, render: month => `${text(month.Thang)}/${text(year)}` },
            ...revenueFields.map(([label, key]) => ({
                label, align: "right", width: 150, nowrap: true,
                render: month => money(month[key] ?? (key === "DoanhThuRong" ? month.TongDoanhThu : null))
            }))
        ], months, "Không có dữ liệu báo cáo", () => "", "admin-report-table");
        root.querySelector("[data-report-debt]").innerHTML = U.renderTable([
            { label: "Loại", render: debt => text(display(debt.LoaiHoaDon)) },
            { label: "Phòng", render: debt => text(debt.TenPhong) },
            { label: "Hợp đồng", render: debt => text(debt.MaHopDong) },
            { label: "Người", render: debt => text(debt.HoTen || U.maskStudentId(debt.MaSinhVien) || "Theo phòng/hợp đồng"), longText: true, title: debt => debt.HoTen || U.maskStudentId(debt.MaSinhVien) || "Theo phòng/hợp đồng" },
            { label: "Tổng hóa đơn", align: "right", render: debt => money(debt.TongHoaDon) },
            { label: "Đã thu", align: "right", render: debt => money(debt.DaThu) },
            { label: "Còn nợ", align: "right", render: debt => money(debt.TongCongNo) },
            { label: "Tiền dư chờ hoàn", align: "right", render: debt => money(debt.TienDuChoHoan) }
        ], debts);
    }

    function printReceipt(receipt) {
        const amount = Number(receipt.SoTien);
        if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Số tiền trên phiếu không hợp lệ.");
        state.invoiceReceipt = receipt;
        const printHost = root.querySelector("[data-admin-modal]");
        printHost.innerHTML = `<div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 print:static print:block print:bg-white print:p-0">
            <article class="receipt-paper w-full max-w-2xl rounded-xl bg-white p-8 shadow-xl">
                <header class="text-center"><h2 class="text-2xl font-bold">PHIẾU THU</h2><p>Mã phiếu: ${text(receipt.MaPhieuThu)}</p></header>
                <dl class="mt-6 grid grid-cols-2 gap-3">
                    <dt>Hóa đơn</dt><dd>${text(receipt.MaHoaDon)}</dd><dt>Phòng</dt><dd>${text(receipt.TenPhong)}</dd>
                    <dt>Người nộp</dt><dd>${esc(receipt.TenNguoiNop || U.maskStudentId(receipt.MaSinhVienNop))}</dd>
                    <dt>Người thu</dt><dd>${text(receipt.TenNguoiThu)}</dd><dt>Số tiền</dt><dd>${money(amount)}</dd>
                    <dt>Bằng chữ</dt><dd class="col-span-1">${esc(U.amountInWords(amount))}</dd>
                    <dt>Ngày thu</dt><dd>${esc(formatDateTime(receipt.NgayThu))}</dd>
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
                <header class="text-center"><h2 class="text-2xl font-bold">PHIẾU CHI / HOÀN TIỀN</h2><p>Mã phiếu: ${text(refund.MaPhieuChi)}</p></header>
                <dl class="mt-6 grid grid-cols-2 gap-3">
                    <dt>Sinh viên</dt><dd>${esc(refund.HoTen || U.maskStudentId(refund.MaSinhVien))}</dd>
                    <dt>Mã chi tiết</dt><dd>${text(refund.MaChiTiet)}</dd><dt>Đã đóng</dt><dd>${money(refund.SoTienDaDong)}</dd>
                    <dt>Đã hoàn</dt><dd>${money(refund.SoTien)} (${esc(U.amountInWords(Number(refund.SoTien)))})</dd>
                    <dt>Ngày chi</dt><dd>${esc(formatDateTime(refund.NgayChi))}</dd>
                    <dt>Lý do</dt><dd>${text(refund.LyDo)}</dd><dt>Ghi chú</dt><dd>${text(U.refundDisplayNote(refund))}</dd>
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
    async function showReceiptDetails(id) {
        if (!state.receipts.length) await loadReceipts();
        const receipt = state.receipts.find(item => String(item.MaPhieuThu) === String(id));
        if (!receipt) throw new Error("Không tìm thấy phiếu thu hợp lệ.");
        modalShell(`Phiếu thu ${receipt.MaPhieuThu}`, `<dl class="grid grid-cols-[140px_1fr] gap-2">
            <dt>Hóa đơn</dt><dd>${text(receipt.MaHoaDon)}</dd><dt>Phòng</dt><dd>${text(receipt.TenPhong)}</dd>
            <dt>Người nộp</dt><dd>${text(receipt.TenNguoiNop || receipt.MaSinhVienNop)}</dd>
            <dt>Số tiền</dt><dd>${money(receipt.SoTien)}</dd><dt>Thời điểm</dt><dd>${text(formatDateTime(receipt.NgayThu))}</dd>
            <dt>Phương thức</dt><dd>${text(U.paymentMethodLabel(receipt.PhuongThuc))}</dd><dt>Trạng thái</dt><dd>${badge(receipt.TrangThai)}</dd>
        </dl>${button("In phiếu thu", "receipt-print", `data-receipt="${esc(receipt.MaPhieuThu)}"`)}`);
    }
    async function printLatestReceipt() {
        const invoice = state.invoiceDetail;
        const receipt = (invoice?.PhieuThu || []).find(item => item.TrangThai === "Hợp lệ");
        if (!receipt) throw new Error("Hóa đơn chưa có phiếu thu hợp lệ để in.");
        printReceipt({ ...receipt, TenPhong: invoice.TenPhong, TenNguoiNop: receipt.TenNguoiNop, TenNguoiThu: receipt.TenNguoiThu });
    }

    function handleRowKeydown(event) {
        const search = event.target.closest("[data-student-search]");
        if (search) {
            const form = search.closest('form[data-form="contract-create"]');
            const row = search.closest(".member-row");
            const list = row?.querySelector("[data-student-options]");
            if (form && row && list && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) {
                const options = [...list.querySelectorAll("[data-student-option]")];
                if (event.key === "Escape") {
                    if (!list.classList.contains("hidden")) {
                        event.preventDefault();
                        list.classList.add("hidden");
                        search.setAttribute("aria-expanded", "false");
                        search.removeAttribute("aria-activedescendant");
                    }
                    return;
                }
                if (event.key === "Enter") {
                    if (options.length && !list.classList.contains("hidden")) {
                        event.preventDefault();
                        const activeIndex = Number(row.dataset.activeOptionIndex);
                        const option = options[activeIndex >= 0 ? activeIndex : 0];
                        if (option) applyContractStudentSelection(form, row, option.dataset.studentOption);
                    }
                    return;
                }
                event.preventDefault();
                if (list.classList.contains("hidden")) {
                    updateCreateStudentOptions(form, form.elements.tenPhong.value, row);
                }
                const visibleOptions = [...list.querySelectorAll("[data-student-option]")];
                if (!visibleOptions.length) return;
                const previous = Number(row.dataset.activeOptionIndex || -1);
                const next = event.key === "ArrowDown"
                    ? (previous + 1) % visibleOptions.length
                    : (previous <= 0 ? visibleOptions.length - 1 : previous - 1);
                row.dataset.activeOptionIndex = String(next);
                search.setAttribute("aria-activedescendant", visibleOptions[next].id);
                visibleOptions.forEach((option, index) => {
                    option.setAttribute("aria-selected", String(index === next));
                    option.classList.toggle("bg-emerald-50", index === next);
                });
            }
        }
        if (event.key === "Escape" && root.querySelector("[data-admin-modal]:not(.hidden)")) {
            event.preventDefault();
            closeModal();
            return;
        }
        if (event.key === "Escape" && root.querySelector("[data-admin-drawer]:not(.hidden)")) {
            event.preventDefault();
            closeDrawer();
            return;
        }
        const row = event.target.closest('tr[data-action="row-detail"]');
        if (row && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            row.click();
        }
    }

    async function handleClick(event) {
        const studentOption = event.target.closest("[data-student-option]");
        if (studentOption && root.contains(studentOption)) {
            const row = studentOption.closest(".member-row");
            const form = studentOption.closest('form[data-form="contract-create"]');
            if (row && form) applyContractStudentSelection(form, row, studentOption.dataset.studentOption);
            return;
        }
        const actionButton = event.target.closest("[data-action]");
        if (!actionButton || !root.contains(actionButton) || actionButton.disabled
            || actionButton.dataset.action === "date-picker-open" || state.busy) return;
        state.busy = true;
        setBusy(actionButton, true);
        const { action } = actionButton.dataset;
        try {
            switch (action) {
                case "modal-close": closeModal(); break;
                case "drawer-close": closeDrawer(); break;
                case "row-detail":
                    if (event.target.closest("details, summary")) break;
                    await openRowDetail(actionButton.dataset.detailType, actionButton.dataset.detailId);
                    break;
                case "contract-page":
                    state.contractPage = Number(actionButton.dataset.page);
                    renderContractsTable();
                    break;
                case "contract-filter-clear":
                    state.contractSearch = "";
                    state.contractStatus = "ALL";
                    state.contractPage = 1;
                    root.querySelector('[data-form="contract-filter"]')?.reset();
                    renderContractsTable();
                    break;
                case "tier-draft-cancel":
                    if (!window.confirm("Bỏ toàn bộ thay đổi chưa lưu của hạng này?")) break;
                    state.tierDraft = null;
                    state.tierOriginal = null;
                    state.tierServicesEditing = false;
                    renderRoomPane();
                    break;
                case "add-member-row": {
                    const form = root.querySelector('form[data-form="contract-create"]');
                    const rows = form?.querySelectorAll(".member-row").length || 0;
                    const remaining = Number(form?.dataset.availableSeats || 0);
                    if (!form) throw new Error("Không tìm thấy biểu mẫu hợp đồng.");
                    if (rows >= remaining) throw new Error("Không còn chỗ phù hợp để thêm dòng sinh viên.");
                    const selectedIds = [...form.querySelectorAll('.member-row [name="maSinhVien"]')]
                        .map(selectNode => selectNode.value).filter(Boolean);
                    root.querySelector("[data-new-members]").insertAdjacentHTML("beforeend",
                        memberFormRow({}, form.elements.tenPhong.value, selectedIds));
                    updateCreateRoomOptions(form);
                    updateCreateStudentOptions(form);
                    updateContractCapacity(form, form.elements.tenPhong.value);
                    break;
                }
                case "remove-member-row": {
                    const form = actionButton.closest('form[data-form="contract-create"]');
                    actionButton.closest(".member-row")?.remove();
                    if (form) {
                        const selectedRoom = updateCreateRoomOptions(form);
                        updateCreateStudentOptions(form, selectedRoom);
                        updateContractMode(form, selectedRoom);
                    }
                    break;
                }
                case "contract-create": await openCreateContract(); break;
                case "contract-refresh": await loadContracts(); break;
                case "member-add": await openAddMember(actionButton.dataset.contract); break;
                case "member-leave": await openLeaveFlow(actionButton.dataset.contract, actionButton.dataset.detail); break;
                case "member-move": {
                    const contract = state.contracts.find(item => item.MaHopDong === actionButton.dataset.contract);
                    if (!state.rooms.length) await loadRoomsAndTiers();
                    if (!state.students.length) await loadStudents();
                    const student = state.students.find(item => item.MaSinhVien === actionButton.dataset.student);
                    const currentRoom = state.rooms.find(item => item.TenPhong === contract?.TenPhong);
                    const modal = modalShell("Chuyển phòng thành viên", `<form id="admin-workflow-form" data-form="member-move" class="space-y-3">
                        <input type="hidden" name="contractId" value="${esc(actionButton.dataset.contract)}">
                        <input type="hidden" name="maSinhVien" value="${esc(actionButton.dataset.student)}">
                        ${select("Phòng đích", "tenPhong", roomOptions(contract?.TenPhong, {
                            gender: student?.GioiTinh || currentRoom?.LoaiPhong || "",
                            tier: contract?.MaHangPhong || currentRoom?.MaHangPhong || ""
                        }), "", true)}</form>`);
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
                    const members = activeMembers(contract);
                    if (!members.length) {
                        modalShell("Gia hạn hợp đồng", '<p role="alert" class="text-sm text-red-700">Hợp đồng không có sinh viên đang ở để gia hạn.</p>');
                        break;
                    }
                    const memberOptions = members.map(member => ({
                        value: member.MaChiTiet,
                        label: `${memberName(member)} · ${U.maskStudentId(member.MaSinhVien)} · Hiệu lực đến ${dateOnly(member.NgayKetThucHieuLuc || contract.NgayKetThuc)}`
                    }));
                    modalShell("Gia hạn hợp đồng", `<form id="admin-workflow-form" data-form="contract-extend" class="space-y-3">
                        <input type="hidden" name="contractId" value="${esc(contract.MaHopDong)}">
                        ${select("Sinh viên", "maChiTiet", memberOptions, "", true)}
                        ${field("Ngày kết thúc mới", "ngayKetThucMoi", "date", "", true)}
                        <p class="text-sm text-slate-600">Chọn ngày kết thúc mới sau ngày hiệu lực của sinh viên. Hóa đơn gia hạn được gửi cho sinh viên đã chọn.</p>
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
                case "financial-page":
                    state.financePages[actionButton.dataset.type] = Number(actionButton.dataset.page);
                    renderFinancialRows(actionButton.dataset.type);
                    break;
                case "financial-filter-clear": {
                    const type = actionButton.dataset.type;
                    state.financeFilters[type] = {};
                    state.financePages[type] = 1;
                    const form = actionButton.closest("form");
                    if (form) {
                        form.elements.status.value = type === "receipts" ? "ALL" : "ACTION_REQUIRED";
                        form.elements.method.value = "ALL";
                        form.elements.search.value = "";
                        form.elements.from.value = "";
                        form.elements.to.value = "";
                        if (form.elements.invoiceType) form.elements.invoiceType.value = "ALL";
                    }
                    renderFinancialRows(type);
                    break;
                }
                case "invoice-create": await openInvoiceCreate(); break;
                case "invoice-detail": await openInvoiceDetail(actionButton.dataset.invoice); break;
                case "invoice-cancel":
                    if (!window.confirm(`Hủy hóa đơn ${actionButton.dataset.invoice}?`)) break;
                    await request(`/api/HoaDon/${encodeURIComponent(actionButton.dataset.invoice)}/huy`, { method: "PUT", body: "{}" });
                    await loadInvoices();
                    break;
                case "invoice-remind": {
                    const invoiceId = actionButton.dataset.invoice;
                    if (!window.confirm(`Gửi thông báo nhắc nợ hóa đơn ${invoiceId} đến đúng sinh viên theo loại hóa đơn?`)) break;
                    const result = await request(`/api/HoaDon/${encodeURIComponent(invoiceId)}/nhac-no`, { method: "POST", body: "{}" });
                    status(`Đã gửi nhắc nợ cho ${Number(result.SoSinhVienNhan) || 0} sinh viên.`);
                    break;
                }
                case "expense-edit": await openExpenseEdit(actionButton.dataset.expense); break;
                case "expense-cancel":
                    if (!window.confirm("Hủy khoản phát sinh chưa lập hóa đơn?")) break;
                    await request(`/api/ChiPhiPhatSinh/${encodeURIComponent(actionButton.dataset.expense)}/huy`, { method: "PUT", body: "{}" });
                    await loadExpenses();
                    break;
                case "expense-invoice": {
                    if (!window.confirm("Lập hóa đơn riêng cho khoản phát sinh này?")) break;
                    const invoice = await request(`/api/ChiPhiPhatSinh/${encodeURIComponent(actionButton.dataset.expense)}/tao-hoa-don`, { method: "POST", body: "{}" });
                    closeDrawer();
                    state.activeInvoiceTab = "invoices";
                    renderFinancialTabs();
                    renderFinancialPane();
                    await loadInvoices();
                    window.showToast?.("Đã lập hóa đơn cho khoản phát sinh.", "success");
                    if (invoice?.MaHoaDon) await openInvoiceDetail(invoice.MaHoaDon);
                    break;
                }
                case "receipt-print": await receiptForId(actionButton.dataset.receipt); break;
                case "receipt-detail": await showReceiptDetails(actionButton.dataset.receipt); break;
                case "receipt-print-latest": await printLatestReceipt(); break;
                case "refund-print": {
                    if (!state.refunds.length) await loadRefunds();
                    const refund = state.refunds.find(item => String(item.MaPhieuChi) === String(actionButton.dataset.refund));
                    if (!refund) throw new Error("Không tìm thấy phiếu chi cần in.");
                    printRefund(refund);
                    break;
                }
                case "room-tab": {
                    const dirty = state.tierDraft && U.hasTierDraftChanges(state.tierDraft, state.tierOriginal || {});
                    if (dirty && !window.confirm("Bạn có thay đổi hạng phòng chưa lưu. Bỏ thay đổi để chuyển màn?")) break;
                    if (dirty) {
                        state.tierDraft = null;
                        state.tierOriginal = null;
                    }
                    state.tierServicesEditing = false;
                    state.activeRoomTab = actionButton.dataset.tab;
                    renderRoomPane();
                    break;
                }
                case "tier-select":
                    if (state.tierDraft && U.hasTierDraftChanges(state.tierDraft, state.tierOriginal || {})
                        && !window.confirm("Bạn có thay đổi chưa lưu. Bỏ thay đổi để chuyển hạng?")) break;
                    state.selectedTierId = actionButton.dataset.tier;
                    state.tierServicesEditing = false;
                    state.tierDraft = null;
                    state.tierOriginal = null;
                    renderRoomPane();
                    break;
                case "room-filter-clear":
                    state.roomFilters = { status: "ALL", gender: "ALL", khu: "ALL", tier: "ALL", search: "", page: 1 };
                    renderRoomPane();
                    break;
                case "room-page":
                    state.roomFilters.page = Number(actionButton.dataset.page);
                    renderRoomPane();
                    break;
                case "tier-services-toggle": {
                    const form = root.querySelector('form[data-form="tier-update"]');
                    if (!form || form.dataset.tier !== actionButton.dataset.tier) throw new Error("Chọn hạng phòng trước khi sửa dịch vụ.");
                    if (state.tierServicesEditing) {
                        form.requestSubmit();
                        break;
                    }
                    state.tierDraft = readTierDraft(form);
                    state.tierServicesEditing = true;
                    renderRoomPane();
                    break;
                }
                case "tier-service-add": {
                    const form = root.querySelector('[data-form="tier-update"]');
                    if (!form || form.dataset.tier !== actionButton.dataset.tier) throw new Error("Chọn hạng phòng trước khi thêm dịch vụ.");
                    state.tierServicesEditing = true;
                    form.dataset.serviceEditing = "true";
                    const used = new Set([...form.querySelectorAll('[name="serviceId"]')].map(item => item.value));
                    const available = (state.services || []).filter(service => !used.has(service.MaDichVu));
                    modalShell("Thêm dịch vụ vào hạng", `<form id="admin-workflow-form" data-form="tier-service-add" class="space-y-3">
                        ${select("Dịch vụ trong danh mục", "serviceId", [
                            ...available.map(service => ({value:service.MaDichVu,label:`${service.TenDichVu} · ${service.DonVi}`})),
                            {value:"__new__",label:"Tạo dịch vụ mới"}
                        ], "", true)}
                        <section data-new-service-fields class="hidden grid gap-3 sm:grid-cols-3">
                            ${field("Mã dịch vụ", "newServiceId", "text", "", true, 'maxlength="20"')}
                            ${field("Tên dịch vụ", "newServiceName", "text", "", true, 'maxlength="100"')}
                            ${field("Đơn vị", "newServiceUnit", "text", "", true, 'maxlength="20"')}
                        </section>
                        ${moneyField("Đơn giá", "servicePrice", 0)}
                        ${select("Cách tính", "serviceMethod", [{value:"CO_DINH_KY",label:"Cố định theo kỳ"},{value:"CHI_SO",label:"Theo chỉ số công tơ"}], "CO_DINH_KY", true)}
                        ${select("Người thanh toán", "servicePayer", [{value:"PHONG",label:"Cả phòng"},{value:"CA_NHAN",label:"Từng người"}], "PHONG", true)}
                        <label class="flex items-center gap-2"><input name="serviceActive" type="checkbox" disabled> Hoạt động</label>
                        <p data-price-disabled-hint class="text-xs text-amber-800">Nhập đơn giá trước khi bật</p>
                    </form>`);
                    break;
                }
                case "service-catalog-manage": {
                    state.serviceCatalogEditing = false;
                    drawerShell("Quản lý dịch vụ", serviceCatalogMarkup());
                    break;
                }
                case "service-catalog-edit-mode":
                    state.serviceCatalogEditing = !state.serviceCatalogEditing;
                    drawerShell("Quản lý dịch vụ", serviceCatalogMarkup());
                    break;
                case "tier-room-add": {
                    const tier = state.tiers.find(item => item.MaHangPhong === actionButton.dataset.tier);
                    if (!tier) throw new Error("Không tìm thấy hạng phòng.");
                    const areas = [...new Set(state.rooms.map(room => room.Khu).filter(Boolean))];
                    const candidates = state.rooms.filter(room => room.MaHangPhong !== tier.MaHangPhong && !roomTierInfo(room).contracts.length && roomTierInfo(room).residents === 0);
                    modalShell("Thêm phòng vào hạng này", `<form id="admin-workflow-form" data-form="tier-room-add" data-tier="${esc(tier.MaHangPhong)}" class="space-y-3">
                        ${select("Khu", "area", areas.map(area => ({value:area,label:area})), areas[0] || "", true)}
                        <div data-tier-room-list class="max-h-80 space-y-2 overflow-auto">${candidates.filter(room => room.Khu === areas[0]).map(room =>
                            `<label class="flex items-center justify-between gap-2 rounded border p-2"><span><input type="checkbox" name="rooms" value="${esc(room.TenPhong)}"> ${text(room.TenPhong)} · ${text(room.MaHangPhong)} → ${text(tier.MaHangPhong)}</span><span>${money(state.tiers.find(item => item.MaHangPhong === room.MaHangPhong)?.GiaPhongThang)} → ${money(tier.GiaPhongThang)}</span></label>`
                        ).join("") || `<p class="text-sm text-slate-500">Không có phòng phù hợp ở khu này.</p>`}</div>
                    </form>`);
                    break;
                }
                case "room-tier-change": {
                    const room = state.rooms.find(item => item.TenPhong === actionButton.dataset.room);
                    if (!room) throw new Error("Không tìm thấy phòng.");
                    const { contracts, residents } = roomTierInfo(room);
                    if (contracts.length || residents) throw new Error(contracts.length
                        ? "Phòng đang có hợp đồng còn hiệu lực: kết thúc hợp đồng hoặc chuyển người trước."
                        : "Phòng đang có người ở; chuyển người trước khi đổi hạng.");
                    const targets = state.tiers.filter(item => item.MaHangPhong !== room.MaHangPhong);
                    modalShell(`Đổi hạng phòng ${room.TenPhong}`, `<form id="admin-workflow-form" data-form="room-tier-change" class="space-y-3">
                        <input type="hidden" name="roomName" value="${esc(room.TenPhong)}">
                        ${select("Hạng mới", "newTier", targets.map(item => ({value:item.MaHangPhong,label:`${item.MaHangPhong} · ${item.TenHangPhong}`})), "", true)}
                        <div data-tier-change-summary class="rounded bg-slate-50 p-3 text-sm"></div>
                    </form>`);
                    const form = root.querySelector('[data-form="room-tier-change"]');
                    const refresh = () => {
                        const next = state.tiers.find(item => item.MaHangPhong === form.elements.newTier.value);
                        form.querySelector("[data-tier-change-summary]").textContent = next
                            ? `Phòng ${room.TenPhong}: ${room.MaHangPhong} → ${next.MaHangPhong}; giá/tháng ${money(state.tiers.find(item => item.MaHangPhong === room.MaHangPhong)?.GiaPhongThang)} → ${money(next.GiaPhongThang)}. Áp dụng dịch vụ mới: ${(next.dichVu || []).map(item => item.TenDichVu).join(", ") || "Không có"}. Chỉ ảnh hưởng hợp đồng tạo sau khi phòng đổi hạng.`
                            : "";
                    };
                    form.elements.newTier.addEventListener("change", refresh);
                    refresh();
                    break;
                }
                case "service-create-open":
                    modalShell("Tạo dịch vụ", `<form id="admin-workflow-form" data-form="service-create" class="grid gap-3 md:grid-cols-2">
                        ${field("Mã dịch vụ", "maDichVu", "text", "", true, 'maxlength="20"')}
                        ${field("Tên dịch vụ", "tenDichVu", "text", "", true, 'maxlength="100"')}
                        ${field("Đơn vị", "donVi", "text", "", true, 'maxlength="20"')}
                        <label class="flex items-center gap-2"><input name="hoatDong" type="checkbox" checked> Hoạt động</label>
                    </form>`);
                    break;
                case "expense-create-open":
                    modalShell("Thêm chi phí phát sinh", `<form id="admin-workflow-form" data-form="expense-create" class="admin-expense-form">
                        ${select("Hợp đồng", "maHopDong", contractOptions(), "", true, "admin-expense-field")}
                        ${select("Sinh viên (không bắt buộc)", "maChiTiet", [{value:"",label:"Không gắn sinh viên"}], "", false, "admin-expense-field")}
                        ${select("Cách lập hóa đơn", "cheDoLap", [
                            {value:"RIENG",label:"Lập hóa đơn riêng"},
                            {value:"GOP",label:"Gộp vào hóa đơn dịch vụ kỳ"}
                        ], "RIENG", true, "admin-expense-field")}
                        ${expenseTextField("Khoản phí (ví dụ: sửa vòi nước)", "noiDung", "", true, 'maxlength="255"')}
                        ${expenseAmountField()}
                        ${expenseDateField("Ngày phát sinh", "ngayPhatSinh", today())}
                        ${expenseDateField("Hạn đóng", "hanDong", dateAfterDays(today(), 7))}
                        <label class="admin-expense-field admin-expense-note">
                            <span>Ghi chú</span><textarea name="ghiChu" maxlength="255" class="admin-expense-control"></textarea>
                        </label>
                    </form>`, "Xác nhận", "admin-expense-dialog");
                    break;
                case "room-edit": await openRoomEdit(actionButton.dataset.room); break;
                case "service-edit": await openServiceEdit(actionButton.dataset.service); break;
                case "tier-service-remove":
                    if (!window.confirm("Gỡ dịch vụ khỏi cấu hình hạng? Các hóa đơn đã lập giữ nguyên chi tiết và số tiền.")) break;
                    actionButton.closest("[data-tier-service-row]")?.remove();
                    actionButton.closest("[data-form='tier-update']")?.querySelector("[data-no-services]")?.remove();
                    syncTierDraft(actionButton.closest("form[data-form='tier-update']"));
                    break;
                case "report-load": {
                    const year = Number(root.querySelector('[name="reportYear"]').value);
                    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Năm phải là số nguyên từ 2000 đến 2100.");
                    await loadReport(year);
                    break;
                }
                case "payments-refresh":
                    await loadReceipts();
                    break;
                case "payment-copy":
                    if (!navigator.clipboard?.writeText) throw new Error("Trình duyệt không hỗ trợ sao chép mã giao dịch.");
                    await navigator.clipboard.writeText(actionButton.dataset.transaction || "");
                    window.showToast?.("Đã sao chép mã giao dịch.", "success");
                    break;
                case "print-document": printDocument(); break;
                default: break;
            }
        } catch (error) {
            apiError(error);
            const modalError = root.querySelector("[data-modal-error]");
            if (modalError) modalError.textContent = error.message || "Không thể hoàn tất thao tác.";
            const drawerError = root.querySelector("[data-drawer-error]");
            if (drawerError) drawerError.textContent = error.message || "Không thể hoàn tất thao tác.";
        } finally {
            state.busy = false;
            if (actionButton.isConnected) setBusy(actionButton, false);
        }
    }
    async function openExpenseEdit(expenseId) {
        const expense = state.expenses.find(item => String(item.MaChiPhi) === String(expenseId));
        if (!expense || expense.TrangThai !== "Chưa lập hóa đơn" || expense.MaHoaDon) {
            throw new Error("Khoản đã lập hóa đơn hoặc đã hủy, không thể sửa.");
        }
        modalShell("Sửa chi phí phát sinh", `<form id="admin-workflow-form" data-form="expense-edit" class="admin-expense-form">
            <input type="hidden" name="expenseId" value="${esc(expense.MaChiPhi)}">
            ${select("Hợp đồng", "maHopDong", contractOptions(false), expense.MaHopDong, true)}
            ${select("Sinh viên (không bắt buộc)", "maChiTiet", [
                {value:"",label:"Không gắn sinh viên"},
                ...state.contracts.find(item => item.MaHopDong === expense.MaHopDong)?.sinhVien?.map(member => ({value:member.MaChiTiet,label:memberName(member)})) || []
            ], expense.MaChiTiet || "", false)}
            ${field("Khoản phí (ví dụ: sửa vòi nước)", "noiDung", "text", expense.NoiDung, true, 'maxlength="255"')}
            ${expenseAmountField(expense.SoTien)}
            ${expenseDateField("Ngày phát sinh", "ngayPhatSinh", dateOnly(expense.NgayPhatSinh))}
            ${expenseDateField("Hạn đóng", "hanDong", dateOnly(expense.HanDong))}
            <label class="block">Ghi chú<textarea name="ghiChu" maxlength="255" class="mt-1 w-full rounded border p-2">${esc(expense.GhiChu || "")}</textarea></label>
        </form>`, "Xác nhận", "admin-expense-dialog");
    }
    function serviceCatalogMarkup() {
        const services = state.services || [];
        const editMode = U.serviceEditMode(state.serviceCatalogEditing);
        const visibleServices = editMode.canEditRows
            ? services
            : services.filter(service => Boolean(Number(service.HoatDong)));
        const summaryServices = editMode.canEditRows ? services : visibleServices;
        const columns = [
            { label: "Dịch vụ", render: service => `<strong>${text(service.TenDichVu)}</strong>${service.CanhBao ? '<span class="mt-1 block w-fit rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Chưa có đơn giá</span>' : ""}` },
            { label: "Đơn vị", render: service => text(service.DonVi) },
            { label: "Đơn giá", align: "right", width: 220, render: service => (service.hangPhong || []).map(rate => `${text(rate.MaHangPhong)}: ${money(rate.DonGia)}`).join(" · ") || "—" },
            { label: "Cách tính", render: service => [...new Set((service.hangPhong || []).map(rate => display(rate.CachTinh)))].join(" · ") || "—" },
            { label: "Đối tượng thanh toán", render: service => [...new Set((service.hangPhong || []).map(rate => display(rate.DoiTuongThanhToan)))].join(" · ") || "—" },
            ...(editMode.canEditRows ? [{ label: "Trạng thái", render: service => badge(Boolean(Number(service.HoatDong)) ? "Đang áp dụng" : "Ngừng") }] : []),
            { label: "", render: service => editMode.canEditRows
                ? button("Sửa", "service-edit", `data-service="${esc(service.MaDichVu)}"`, "bg-slate-700 text-white") : "" }
        ];
        return `<div class="mb-3 flex flex-wrap items-center gap-2">
                <input type="search" name="catalogSearch" data-catalog-search placeholder="Tìm dịch vụ" aria-label="Tìm dịch vụ" class="h-10 min-w-40 flex-1 rounded border px-3">
                ${editMode.canAdd ? button("+ Thêm dịch vụ", "service-create-open") : ""}
                ${button(editMode.toggleLabel, "service-catalog-edit-mode", "", "bg-slate-700 text-white")}
            </div>
            <p class="mb-2 text-sm text-slate-600">${esc(U.listSummary("dịch vụ", summaryServices,
                service => Boolean(Number(service.HoatDong)), "đang áp dụng"))}.</p>
            <div data-no-admin-filters class="overflow-x-auto rounded-xl border bg-white">${U.renderTable(columns, visibleServices, "Không có dịch vụ phù hợp", service =>
                `data-catalog-service="${esc(`${service.MaDichVu} ${service.TenDichVu}`.toLocaleLowerCase("vi"))}"`)}</div>
            `;
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
        if (form && ["expense-create", "expense-edit"].includes(form.dataset.form)
            && event.target.name === "ngayPhatSinh" && !form.elements.hanDong.dataset.manuallyEdited) {
            const isoDate = U.date(event.target.value, "parse");
            if (isoDate) form.elements.hanDong.value = U.date(dateAfterDays(isoDate, 7), "format");
        }
        if (form?.dataset.form === "member-add" && event.target.name === "maSinhVien") {
            form.querySelector("[data-student-conflict]").innerHTML =
                studentConflictMarkup(event.target.value, form.elements.contractId.value);
            const submit = root.querySelector('button[form="admin-workflow-form"][type="submit"]');
            if (submit) submit.disabled = Boolean(activeStudentContract(event.target.value));
            return;
        }
        if (event.target.name === "serviceTier") {
            state.selectedTierId = event.target.value;
            renderRoomPane();
            return;
        }
        if (event.target.name === "serviceId" && form?.dataset.form === "tier-service-add") {
            form.querySelector("[data-new-service-fields]")?.classList.toggle("hidden", event.target.value !== "__new__");
            return;
        }
        if (event.target.name === "area" && form?.dataset.form === "tier-room-add") {
            const tier = state.tiers.find(item => item.MaHangPhong === form.dataset.tier);
            const candidates = state.rooms.filter(room => room.Khu === event.target.value
                && room.MaHangPhong !== tier?.MaHangPhong
                && !roomTierInfo(room).contracts.length && roomTierInfo(room).residents === 0);
            form.querySelector("[data-tier-room-list]").innerHTML = candidates.map(room =>
                `<label class="flex items-center justify-between gap-2 rounded border p-2"><span><input type="checkbox" name="rooms" value="${esc(room.TenPhong)}"> ${text(room.TenPhong)} · ${text(room.MaHangPhong)} → ${text(tier?.MaHangPhong)}</span><span>${money(state.tiers.find(item => item.MaHangPhong === room.MaHangPhong)?.GiaPhongThang)} → ${money(tier?.GiaPhongThang)}</span></label>`
            ).join("") || `<p class="text-sm text-slate-500">Không có phòng phù hợp ở khu này.</p>`;
            return;
        }
        if (event.target.name === "servicePrice" && form?.dataset.form === "tier-service-add") {
            const active = form.elements.serviceActive;
            const price = U.parseVndNonNegative(event.target.value);
            active.disabled = !U.serviceCanBeActive(price);
            if (active.disabled) active.checked = false;
            form.querySelector("[data-price-disabled-hint]")?.classList.toggle("hidden", !active.disabled);
            return;
        }
        if (event.target.name === "contractMemberStatus") {
            state.contractMemberStatus = event.target.value;
            const contract = state.contracts.find(item => item.MaHopDong === root.querySelector("[data-admin-drawer] [data-contract-members]")?.closest("section")?.dataset.contract);
            if (contract) renderContractMembers(contract);
            return;
        }
        if (form?.dataset.form === "room-filter") {
            state.roomFilters = {
                ...state.roomFilters,
                status: form.elements.status.value,
                gender: form.elements.gender.value,
                khu: form.elements.khu.value,
                tier: form.elements.tier.value,
                search: form.elements.search.value,
                page: 1
            };
            renderRoomPane();
            return;
        }
        if (form?.dataset.form === "contract-filter") {
            state.contractStatus = form.elements.status.value;
            state.contractPage = 1;
            renderContractsTable();
            return;
        }
        if (event.target.name === "serviceStatus") {
            state.serviceFilters.status = event.target.value;
            renderRoomPane();
            return;
        }
        if (event.target.matches("[data-vnd-nonnegative]") && event.target.closest("[data-tier-service-row]")) {
            const parsed = U.parseVndNonNegative(event.target.value);
            if (parsed !== null) event.target.value = parsed.toLocaleString("vi-VN");
            updateTierServiceWarning(event.target);
            syncTierDraft(event.target.closest("form[data-form='tier-update']"));
            return;
        }
        if (!form) return;
        if (form.dataset.form === "financial-filter") {
            applyFinancialFilter(form);
            return;
        }
        if (["expense-create", "expense-edit"].includes(form.dataset.form) && event.target.name === "maHopDong") {
            const memberSelect = form.elements.maChiTiet;
            const selected = memberSelect.value;
            const members = state.contracts.find(item => item.MaHopDong === form.elements.maHopDong.value)?.sinhVien || [];
            memberSelect.innerHTML = `<option value="">Không gắn sinh viên</option>${members.map(member =>
                `<option value="${esc(member.MaChiTiet)}" ${String(member.MaChiTiet) === selected ? "selected" : ""}>${esc(memberName(member))}</option>`
            ).join("")}`;
        }
        if (form.dataset.form === "expense-create" && event.target.name === "cheDoLap") {
            const studentSelect = form.elements.maChiTiet;
            if (event.target.value === "GOP") {
                studentSelect.value = "";
                studentSelect.disabled = true;
                studentSelect.setCustomValidity("");
            } else {
                studentSelect.disabled = false;
            }
        }
        if (form.dataset.form === "contract-create" && event.target.name === "tenPhong") {
            updateCreateStudentOptions(form, event.target.value);
            const tier = U.tierForRoom(state.rooms, event.target.value);
            form.elements.maHangPhong.value = tier;
            form.elements.maHangPhongDisplay.value = tier;
            updateContractMode(form, event.target.value);
        }
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
                    ngayRa: apiDate(form, "ngayRa"),
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
        if (event.target.matches("[data-vnd-nonnegative]")) {
            const parsed = U.parseVndNonNegative(event.target.value);
            if (parsed !== null) event.target.value = parsed.toLocaleString("vi-VN");
        }
    }
    async function handleInput(event) {
        const target = event.target;
        if (target.matches("[data-expense-amount]")) {
            const message = target.value.trim() ? expenseAmountError(target.value) : "";
            const error = target.closest("label")?.querySelector("[data-expense-amount-error]");
            if (error) error.textContent = message;
            target.setAttribute("aria-invalid", message ? "true" : "false");
            return;
        }
        if (target.matches("[data-student-search]")) {
            const form = target.closest('form[data-form="contract-create"]');
            const row = target.closest(".member-row");
            if (!form || !row) return;
            const hidden = row.querySelector('[name="maSinhVien"]');
            if (hidden.value) {
                hidden.value = "";
                row.querySelector("[data-student-conflict]").replaceChildren();
                const room = updateCreateRoomOptions(form);
                updateContractMode(form, room);
            }
            updateCreateStudentOptions(form, form.elements.tenPhong.value, row);
            updateContractCapacity(form, form.elements.tenPhong.value);
            const selectedMembers = [...form.querySelectorAll('.member-row [name="maSinhVien"]')]
                .map(input => input.value).filter(Boolean);
            updateCreateContractDateOrder(form);
            return;
        }
        const expenseForm = target.closest('form[data-form="expense-create"], form[data-form="expense-edit"]');
        if (expenseForm && target.name === "hanDong") target.dataset.manuallyEdited = "true";
        const roomFilter = target.closest('form[data-form="room-filter"]');
        const addServiceForm = target.closest('form[data-form="tier-service-add"]');
        if (addServiceForm && target.name === "servicePrice") {
            const active = addServiceForm.elements.serviceActive;
            const price = U.parseVndNonNegative(target.value);
            active.disabled = !U.serviceCanBeActive(price);
            if (active.disabled) active.checked = false;
            addServiceForm.querySelector("[data-price-disabled-hint]")?.classList.toggle("hidden", !active.disabled);
            return;
        }
        if (roomFilter && target.name === "search") {
            state.roomFilters.search = target.value;
            state.roomFilters.page = 1;
            rerenderKeepingInput(target, renderRoomPane);
            return;
        }
        if (target.name === "tierSearch") {
            state.tierSearch = target.value;
            rerenderKeepingInput(target, renderRoomPane);
            return;
        }
        if (target.name === "serviceSearch") {
            state.serviceFilters.search = target.value;
            state.servicePage = 1;
            rerenderKeepingInput(target, renderRoomPane);
            return;
        }
        if (target.name === "contractSearch") {
            state.contractSearch = target.value;
            state.contractPage = 1;
            rerenderKeepingInput(target, renderContractsTable);
            return;
        }
        if (target.name === "contractMemberSearch") {
            state.contractMemberSearch = target.value;
            const contract = state.contracts.find(item => item.MaHopDong === root.querySelector("[data-admin-drawer] [data-contract-members]")?.closest("section")?.dataset.contract);
            if (contract) renderContractMembers(contract);
            return;
        }
        if (target.name === "catalogSearch") {
            const query = target.value.toLocaleLowerCase("vi");
            root.querySelectorAll("[data-catalog-service]").forEach(row => {
                row.classList.toggle("hidden", !row.dataset.catalogService.includes(query));
            });
            return;
        }
        const filterForm = event.target.closest('form[data-form="financial-filter"]');
        if (filterForm) {
            applyFinancialFilter(filterForm);
            return;
        }
        function rerenderKeepingInput(input, render) {
            const name = input.name;
            const selection = input.selectionStart;
            render();
            const next = root.querySelector(`[name="${CSS.escape(name)}"]`);
            next?.focus();
            if (selection !== null) next?.setSelectionRange(selection, selection);
        }
        const tierForm = target.closest('form[data-form="tier-update"]');
        if (tierForm) {
            syncTierDraft(tierForm);
            return;
        }
        const form = event.target.closest('form[data-form="leave-confirm"]');
        if (!form) return;
        if (event.target.name === "soTien") {
            event.target.dataset.manuallyEdited = "true";
            return;
        }
    }
    root.addEventListener("admin-date-input", event => {
        const form = event.target.closest('form[data-form="contract-create"]');
        if (form) updateCreateContractDateOrder(form);
    });
    function updateTierServiceWarning(target) {
        const row = target.closest("[data-tier-service-row]");
        if (!row) return;
        const price = U.parseVndNonNegative(row.querySelector('[name="servicePrice"]').value);
        const warning = row.querySelector("[data-rate-warning]");
        const activeInput = row.querySelector('[name="serviceActive"]');
        const hint = row.querySelector("[data-price-disabled-hint]");
        activeInput.disabled = !U.serviceCanBeActive(price);
        if (activeInput.disabled) activeInput.checked = false;
        hint.classList.toggle("hidden", !activeInput.disabled);
        warning.classList.toggle("hidden", price !== null && price > 0);
    }
    async function handleSubmit(event) {
        const form = event.target.closest("#admin-workflow-form, form[data-form]");
        if (!form) return;
        event.preventDefault();
        if (["expense-create", "expense-edit"].includes(form.dataset.form)) {
            const amountInput = form.querySelector("[data-expense-amount]");
            const amountError = expenseAmountError(amountInput?.value);
            const errorElement = form.querySelector("[data-expense-amount-error]");
            if (errorElement) errorElement.textContent = amountError;
            amountInput?.setAttribute("aria-invalid", amountError ? "true" : "false");
            if (amountError) {
                amountInput?.focus();
                return;
            }
        }
        for (const input of form.querySelectorAll("[data-admin-date]")) {
            const value = input.value.trim();
            if (!value && !input.required) continue;
            const now = new Date();
            const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const message = U.validateDateInput(value, input.dataset.dateBirth === "true"
                ? { minYear: 1900, maxDate: todayIso } : {});
            const error = input.closest("label")?.querySelector("[data-date-error]")
                || input.closest("div")?.parentElement?.querySelector("[data-date-error]");
            if (error) error.textContent = message;
            if (message) {
                input.focus();
                return;
            }
            input.value = U.normalizeDateInput(value);
            input.dispatchEvent(new Event("admin-date-input", { bubbles: true }));
        }
        const contractDateError = updateCreateContractDateOrder(form);
        if (contractDateError) {
            const endInput = form.elements.ngayKetThuc;
            endInput.focus();
            return;
        }
        if (form.dataset.form === "financial-filter") {
            applyFinancialFilter(form);
            return;
        }
        if (state.busy) return;
        state.busy = true;
        const submitButton = form.querySelector('button[type="submit"], button:not([type])')
            || root.querySelector('button[form="admin-workflow-form"]');
        setBusy(submitButton, true);
        const values = new FormData(form);
        try {
            switch (form.dataset.form) {
                case "tier-service-add": {
                    let serviceId = String(values.get("serviceId") || "");
                    if (serviceId === "__new__") {
                        serviceId = String(values.get("newServiceId") || "").trim();
                        const serviceName = String(values.get("newServiceName") || "").trim();
                        const unit = String(values.get("newServiceUnit") || "").trim();
                        if (!serviceId || !serviceName || !unit) throw new Error("Nhập đầy đủ mã, tên và đơn vị dịch vụ.");
                        if (!window.confirm(`Tạo dịch vụ ${serviceId} · ${serviceName} trong danh mục?`)) break;
                        await request("/api/DichVu", { method: "POST", body: json({
                            maDichVu: serviceId, tenDichVu: serviceName, donVi: unit, hoatDong: true
                        }) });
                        await loadServices();
                    }
                    const price = U.parseVndNonNegative(values.get("servicePrice"));
                    const active = form.elements.serviceActive.checked;
                    if (!serviceId || price === null || (active && !U.serviceCanBeActive(price))) {
                        throw new Error("Dịch vụ giá 0 không thể bật; hãy nhập đơn giá hợp lệ.");
                    }
                    const tierForm = root.querySelector('form[data-form="tier-update"]');
                    if (!tierForm || tierForm.dataset.tier !== state.selectedTierId) throw new Error("Hạng phòng đã thay đổi. Hãy tải lại trước khi thêm.");
                    tierForm.querySelector("[data-no-services]")?.remove();
                    tierForm.querySelector("[data-tier-services]")?.insertAdjacentHTML("beforeend", tierServiceRow({
                        MaDichVu: serviceId,
                        DonGia: price,
                        CachTinh: values.get("serviceMethod"),
                        DoiTuongThanhToan: values.get("servicePayer"),
                        HoatDong: active
                    }, serviceId));
                    syncTierDraft(tierForm);
                    closeModal();
                    renderRoomPane();
                    break;
                }
                case "tier-room-add": {
                    const selectedNames = values.getAll("rooms").map(String);
                    if (!selectedNames.length) throw new Error("Chọn ít nhất một phòng để đổi hạng.");
                    await Promise.all([loadRoomsAndTiers(), loadContracts()]);
                    const tier = state.tiers.find(item => item.MaHangPhong === form.dataset.tier);
                    const selectedRooms = selectedNames.map(name => state.rooms.find(room => room.TenPhong === name)).filter(Boolean);
                    if (!tier || selectedRooms.length !== selectedNames.length) throw new Error("Danh sách phòng/hạng đã thay đổi. Hãy tải lại.");
                    const blocking = selectedRooms.filter(room => !U.canChangeRoomTier({
                        SoSinhVienHienTai: roomTierInfo(room).residents,
                        SoHopDongConHieuLuc: roomTierInfo(room).contracts.length
                    }));
                    if (blocking.length) throw new Error(`Không thể đổi hạng các phòng đang có người hoặc hợp đồng hiệu lực: ${blocking.map(room => room.TenPhong).join(", ")}.`);
                    const serviceNames = (tier.dichVu || []).map(item => item.TenDichVu || item.MaDichVu).join(", ") || "Không có";
                    const preview = selectedRooms.map(room => {
                        const oldTier = state.tiers.find(item => item.MaHangPhong === room.MaHangPhong);
                        return `${room.TenPhong}: ${room.MaHangPhong} → ${tier.MaHangPhong}; giá/tháng ${money(oldTier?.GiaPhongThang)} → ${money(tier.GiaPhongThang)}`;
                    }).join("\n");
                    if (!window.confirm(`${preview}\nDịch vụ mới: ${serviceNames}.\nChỉ áp dụng cho hợp đồng tạo sau khi phòng đổi hạng.\n\nTiếp tục?`)) break;
                    const outcomes = [];
                    for (const room of selectedRooms) {
                        try {
                            await updateRoomTier(room, tier);
                            outcomes.push(`${room.TenPhong}: thành công`);
                        } catch (error) {
                            outcomes.push(`${room.TenPhong}: lỗi — ${error.message}`);
                        }
                    }
                    closeModal();
                    try {
                        await Promise.all([loadRoomsAndTiers(), loadContracts()]);
                        renderRoomPane();
                    } catch (error) {
                        outcomes.push(`Tải lại danh sách: lỗi — ${error.message}`);
                    }
                    drawerShell("Kết quả đổi hạng phòng", `<ul class="list-disc space-y-2 pl-5">${outcomes.map(item => `<li>${text(item)}</li>`).join("")}</ul>`);
                    break;
                }
                case "room-tier-change": {
                    const room = state.rooms.find(item => item.TenPhong === values.get("roomName"));
                    if (!room) throw new Error("Không tìm thấy phòng.");
                    await Promise.all([loadRoomsAndTiers(), loadContracts()]);
                    const currentRoom = state.rooms.find(item => item.TenPhong === room.TenPhong);
                    const tier = state.tiers.find(item => item.MaHangPhong === values.get("newTier"));
                    const currentInfo = currentRoom && roomTierInfo(currentRoom);
                    if (!currentRoom || !tier || !U.canChangeRoomTier({
                        SoSinhVienHienTai: currentInfo?.residents,
                        SoHopDongConHieuLuc: currentInfo?.contracts.length
                    })) {
                        throw new Error(currentInfo?.contracts.length
                            ? "Phòng đang có hợp đồng còn hiệu lực: kết thúc hợp đồng hoặc chuyển người trước."
                            : "Phòng đang có người ở; chuyển người trước khi đổi hạng.");
                    }
                    if (Number(tier.SucChuaToiDa) < currentInfo.residents) {
                        throw new Error("Sức chứa hạng mới thấp hơn số người đang ở.");
                    }
                    const oldTier = state.tiers.find(item => item.MaHangPhong === currentRoom.MaHangPhong);
                    const serviceNames = (tier.dichVu || []).map(item => item.TenDichVu || item.MaDichVu).join(", ") || "Không có";
                    const summary = `Phòng ${currentRoom.TenPhong}: ${currentRoom.MaHangPhong} → ${tier.MaHangPhong}; giá/tháng ${money(oldTier?.GiaPhongThang)} → ${money(tier.GiaPhongThang)}; dịch vụ mới: ${serviceNames}. Chỉ áp dụng cho hợp đồng tạo sau khi phòng đổi hạng.`;
                    if (!window.confirm(`${summary}\n\nTiếp tục?`)) break;
                    await updateRoomTier(currentRoom, tier);
                    closeModal();
                    await Promise.all([loadRoomsAndTiers(), loadContracts()]);
                    renderRoomPane();
                    break;
                }
                case "contract-filter":
                    state.contractSearch = String(values.get("contractSearch") || "");
                    state.contractStatus = String(values.get("status") || "ALL");
                    state.contractPage = 1;
                    renderContractsTable();
                    break;
                case "contract-create": {
                    const members = [...form.querySelectorAll(".member-row")].map(row => ({
                        maSinhVien: row.querySelector('[name="maSinhVien"]').value.trim(),
                        kyHanThanhToanPhong: row.querySelector('[name="kyHanThanhToanPhong"]').value,
                        laNguoiDaiDien: row.querySelector('[name="laNguoiDaiDien"]').checked
                    })).filter(member => member.maSinhVien);
                    if (!members.length) throw new Error("Thêm ít nhất một sinh viên vào hợp đồng.");
                    const room = state.rooms.find(item => item.TenPhong === values.get("tenPhong"));
                    if (!room || members.length > availableRoomSpaces(room)) {
                        throw new Error("Số sinh viên không được vượt số chỗ còn trống của phòng.");
                    }
                    if (new Set(members.map(member => member.maSinhVien)).size !== members.length) throw new Error("Không được nhập trùng mã sinh viên.");
                    if (members.filter(member => member.laNguoiDaiDien).length > 1) throw new Error("Mỗi hợp đồng chỉ có một đại diện.");
                    const selection = U.contractRoomSelection(room.TenPhong, state.contracts);
                    if (selection.mode === "invalid") {
                        throw new Error("Phòng có nhiều hợp đồng hiệu lực; không thể chọn an toàn để thêm thành viên.");
                    }
                    const activeContract = selection.contract;
                    if (activeContract) {
                        if (members.length !== 1) throw new Error("Thêm từng sinh viên vào hợp đồng đang hiệu lực.");
                        if (activeContract.MaHopDong !== values.get("activeContractId")) {
                            throw new Error("Hợp đồng của phòng đã thay đổi. Đóng biểu mẫu và tải lại danh sách.");
                        }
                        if (!window.confirm(`Thêm sinh viên ${members[0].maSinhVien} vào hợp đồng ${activeContract.MaHopDong}?`)) break;
                        await request(`/api/HopDong/${encodeURIComponent(activeContract.MaHopDong)}/chitiet`, {
                            method: "POST", body: json(members[0])
                        });
                        closeModal(); await loadContracts(); break;
                    }
                    const roomTier = U.tierForRoom(state.rooms, String(values.get("tenPhong") || ""));
                    if (!roomTier || values.get("maHangPhong") !== roomTier) throw new Error("Vui lòng chọn phòng hợp lệ để tự điền hạng phòng.");
                    if (!window.confirm(`Tạo hợp đồng cho phòng ${values.get("tenPhong")} với ${members.length} sinh viên?`)) break;
                    const createdContract = await request("/api/HopDong", { method: "POST", body: json({
                        tenPhong: values.get("tenPhong"), maHangPhong: roomTier,
                        ngayBatDau: apiDate(form, "ngayBatDau"), ngayKetThuc: apiDate(form, "ngayKetThuc"),
                        ghiChu: values.get("ghiChu"), sinhVien: members
                    }) });
                    closeModal();
                    await loadContracts();
                    if (Array.isArray(createdContract?.CanhBao) && createdContract.CanhBao.length) {
                        window.showToast?.(
                            `Hợp đồng đã tạo nhưng không lập hóa đơn tiền phòng. ${createdContract.CanhBao.join(" ")}`,
                            "error"
                        );
                    }
                    break;
                }
                case "member-add": {
                    const member = {
                        maSinhVien: values.get("maSinhVien"),
                        kyHanThanhToanPhong: values.get("kyHanThanhToanPhong"),
                        laNguoiDaiDien: form.elements.laNguoiDaiDien.checked
                    };
                    const addRequest = U.memberAddRequest(values.get("contractId"), member);
                    if (!window.confirm(`Thêm sinh viên ${member.maSinhVien} vào hợp đồng ${values.get("contractId")}?`)) break;
                    await request(addRequest.url, addRequest.options);
                    closeModal(); await loadContracts(); break;
                }
                case "leave-preview": {
                    const detailId = values.get("detailId");
                    const ngayRa = apiDate(form, "ngayRa");
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
                        ngayRa: apiDate(form, "ngayRa"),
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
                                ngayRa: apiDate(form, "ngayRa"),
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
                    if (!window.confirm(`Chuyển sinh viên ${values.get("maSinhVien")} sang phòng ${values.get("tenPhong")}?`)) break;
                    await request(`/api/HopDong/${encodeURIComponent(values.get("contractId"))}/chuyen-phong`, {
                        method: "PUT", body: json({ maSinhVien: values.get("maSinhVien"), tenPhong: values.get("tenPhong") })
                    });
                    closeModal(); await loadContracts(); break;
                case "contract-extend": {
                    const contractId = values.get("contractId");
                    const detailId = Number(values.get("maChiTiet"));
                    const contract = state.contracts.find(item => item.MaHopDong === contractId);
                    const member = activeMembers(contract).find(item => Number(item.MaChiTiet) === detailId);
                    if (!Number.isSafeInteger(detailId) || detailId < 1 || !member) {
                        throw new Error("Vui lòng chọn sinh viên đang ở trong hợp đồng.");
                    }
                    const endDate = apiDate(form, "ngayKetThucMoi");
                    const effectiveEnd = String(member.NgayKetThucHieuLuc || contract.NgayKetThuc || "").slice(0, 10);
                    if (effectiveEnd && endDate <= effectiveEnd) {
                        throw new Error("Ngày kết thúc mới phải sau ngày kết thúc hiệu lực của sinh viên.");
                    }
                    if (!window.confirm(`Gia hạn cho ${memberName(member)} đến ${dateOnly(endDate)}?`)) break;
                    const renewal = await request(`/api/HopDong/${encodeURIComponent(contractId)}/gia-han`, {
                        method: "PUT", body: json({ maChiTiet: detailId, ngayKetThucMoi: endDate })
                    });
                    closeModal();
                    await loadContracts();
                    window.showToast?.(renewal?.MaHoaDon
                        ? `Đã tạo hóa đơn gia hạn ${renewal.MaHoaDon} cho ${memberName(member)}, số tiền ${money(renewal.SoTien)}, hạn thanh toán ${dateOnly(renewal.HanThanhToan)}.`
                        : `Gia hạn cho ${memberName(member)} đã xử lý nhưng chưa nhận được mã hóa đơn. Hãy kiểm tra hóa đơn của sinh viên.`,
                    renewal?.MaHoaDon ? "success" : "error");
                    break;
                }
                case "invoice-create": {
                    const type = values.get("loaiHoaDon");
                    const body = { loaiHoaDon: type, maHopDong: values.get("maHopDong"), kyThanhToan: apiDate(form, "kyThanhToan") };
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
                    if (!window.confirm(`Tạo hóa đơn ${display(type)} cho hợp đồng ${values.get("maHopDong")} kỳ ${dateOnly(body.kyThanhToan)}?`)) break;
                    await request("/api/HoaDon/xuat-ky", { method: "POST", body: json(body) });
                    closeModal(); await loadInvoices(); break;
                }
                case "invoice-filter": {
                    const filters = Object.fromEntries(new FormData(form).entries());
                    for (const name of ["kyTu", "kyDen"]) filters[name] = apiDate(form, name, false);
                    await loadInvoices(filters); break;
                }
                case "receipt-create": {
                    const amount = U.parseVnd(values.get("soTien"));
                    const balance = Number(state.invoiceDetail?.ConNo || 0);
                    const warning = form.querySelector("[data-cash-amount-warning]");
                    let warningText = "";
                    if (amount === null) {
                        warningText = "Vui lòng nhập số tiền nguyên VND hợp lệ.";
                    } else if (amount < balance) {
                        warningText = `Bạn nhập thiếu ${money(balance - amount)} so với số tiền cần nộp (${money(balance)}).`;
                    } else if (amount > balance) {
                        warningText = `Bạn nhập dư ${money(amount - balance)} so với số tiền cần nộp (${money(balance)}).`;
                    } else if (balance <= 0) {
                        warningText = "Hóa đơn không còn nợ.";
                    }
                    if (warningText) {
                        if (warning) {
                            warning.textContent = warningText;
                            warning.classList.remove("hidden");
                        }
                        break;
                    }
                    warning?.classList.add("hidden");
                    if (!window.confirm(`Xác nhận đã thu tiền mặt ${money(amount)} cho hóa đơn ${values.get("invoiceId")}?`)) break;
                    const result = await request(`/api/HoaDon/${encodeURIComponent(values.get("invoiceId"))}/phieuthu`, {
                        method: "POST", body: json({
                            soTien: amount, phuongThuc: "CASH",
                            maSinhVienNop: values.get("maSinhVienNop") || state.invoiceDetail.MaSinhVien || null,
                        })
                    });
                    closeModal();
                    if (result?.PhieuThu) printReceipt({...result.PhieuThu, MaPhieuThu: result.PhieuThu.MaPhieuThu});
                    window.showToast?.("Đã ghi nhận phiếu thu tiền mặt.", "success");
                    await loadInvoices();
                    break;
                }
                case "expense-create":
                case "expense-edit": {
                    const amount = U.parseVnd(values.get("soTien"));
                    if (amount === null) throw new Error("Số tiền phải là số nguyên VND dương.");
                    if (amount > U.MAX_INCIDENT_EXPENSE_VND) throw new Error(`Số tiền chi phí phát sinh không được vượt quá ${U.MAX_INCIDENT_EXPENSE_VND.toLocaleString("vi-VN")} đ.`);
                    const body = {
                        maHopDong: values.get("maHopDong"),
                        maChiTiet: values.get("maChiTiet") ? Number(values.get("maChiTiet")) : null,
                        noiDung: values.get("noiDung").trim(), soTien: amount,
                        ngayPhatSinh: apiDate(form, "ngayPhatSinh"),
                        hanDong: apiDate(form, "hanDong"),
                        ghiChu: values.get("ghiChu") || ""
                    };
                    const editing = form.dataset.form === "expense-edit";
                    if (!editing) body.cheDoLap = values.get("cheDoLap");
                    if (!window.confirm(`${editing ? "Cập nhật" : "Thêm"} chi phí phát sinh ${body.noiDung} · ${money(amount)}?`)) break;
                    await request(editing ? `/api/ChiPhiPhatSinh/${encodeURIComponent(values.get("expenseId"))}` : "/api/ChiPhiPhatSinh", {
                        method: editing ? "PUT" : "POST", body: json(body)
                    });
                    closeModal();
                    await loadExpenses();
                    window.showToast?.(editing ? "Đã cập nhật chi phí phát sinh." : "Đã thêm chi phí phát sinh.", "success");
                    break;
                }
                case "room-update": {
                    const room = state.rooms.find(item => item.TenPhong === values.get("roomName"));
                    if (!room) throw new Error("Không tìm thấy phòng đang sửa.");
                    if (!window.confirm(`Lưu thông tin phòng ${room.TenPhong}?`)) break;
                    const tier = state.tiers.find(item => item.MaHangPhong === room.MaHangPhong);
                    await request(`/api/Phong/${encodeURIComponent(values.get("roomName"))}`, {
                        method: "PUT", body: json({
                            Khu: values.get("Khu"), LoaiPhong: values.get("LoaiPhong"),
                            SucChuaToiDa: Number(tier?.SucChuaToiDa), MaHangPhong: room.MaHangPhong,
                            TrangThaiPhong: values.get("TrangThaiPhong"), GhiChu: values.get("GhiChu")
                        })
                    });
                    closeModal(); await loadRoomsAndTiers(); renderRoomPane();
                    window.showToast?.("Đã lưu thông tin phòng.", "success");
                    break;
                }
                case "tier-update": {
                    const id = form.dataset.tier;
                    const tier = state.tiers.find(item => item.MaHangPhong === id);
                    const draft = readTierDraft(form);
                    if (!tier || draft.giaPhongThang === null || draft.giaPhongNam === null
                        || draft.dichVu.some(service => service.DonGia === null
                            || !service.MaDichVu || (service.DonGia === 0 && service.HoatDong))) {
                        throw new Error("Giá phòng phải là số nguyên VND không âm.");
                    }
                    const latestTiers = await request("/api/HangPhong");
                    const latest = latestTiers.find(item => item.MaHangPhong === id);
                    if (!latest) throw new Error("Hạng phòng không còn tồn tại trên máy chủ.");
                    if (U.hasTierDraftChanges(draftForTier(latest), state.tierOriginal)) {
                        throw new Error("Dữ liệu đã thay đổi, hãy tải lại.");
                    }
                    const changedPrice = draft.giaPhongThang !== Number(tier.GiaPhongThang)
                        || draft.giaPhongNam !== Number(tier.GiaPhongNam);
                    const affectedContracts = state.contracts.filter(contract =>
                        contract.MaHangPhong === id && contract.TrangThaiHopDong === "Còn hiệu lực");
                    const affectedRooms = state.rooms.filter(room => room.MaHangPhong === id);
                    const confirmMessage = `${changedPrice && affectedContracts.length
                        ? `Thay đổi giá hạng có ${affectedRooms.length} phòng và ${affectedContracts.length} hợp đồng còn hiệu lực đang sử dụng. `
                        : ""}Lưu đồng thời thông tin hạng và ${draft.dichVu.length} dịch vụ?`;
                    if (!window.confirm(confirmMessage)) break;
                    await request(`/api/HangPhong/${encodeURIComponent(id)}`, {
                        method: "PUT", body: json({
                            tenHangPhong: draft.tenHangPhong,
                            sucChuaToiDa: draft.sucChuaToiDa,
                            giaPhongThang: draft.giaPhongThang,
                            giaPhongNam: draft.giaPhongNam,
                            dichVu: draft.dichVu.map(service => ({
                                maDichVu: service.MaDichVu, donGia: service.DonGia,
                                cachTinh: service.CachTinh, doiTuongThanhToan: service.DoiTuongThanhToan,
                                hoatDong: service.HoatDong
                            }))
                        })
                    });
                    await Promise.all([loadRoomsAndTiers(), loadServices()]);
                    state.tierDraft = null;
                    state.tierOriginal = null;
                    state.tierServicesEditing = false;
                    renderRoomPane();
                    window.showToast?.("Đã lưu thay đổi hạng phòng và dịch vụ.", "success");
                    break;
                }
                case "service-create":
                    if (!window.confirm(`Tạo dịch vụ ${values.get("maDichVu")} · ${values.get("tenDichVu")}?`)) break;
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
                    closeModal();
                    renderRoomPane();
                    window.showToast?.("Đã tạo dịch vụ.", "success");
                    break;
                case "service-edit":
                    if (!window.confirm(`Cập nhật danh mục dịch vụ ${values.get("serviceId")}?`)) break;
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
                    window.showToast?.("Đã cập nhật dịch vụ.", "success");
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
    window.addEventListener("afterprint", () => {
        document.body.classList.remove("admin-printing");
    });
})();
