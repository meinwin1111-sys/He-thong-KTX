(function (root) {
    const MAX_INCIDENT_EXPENSE_VND = 50000000;
    const studentIdentity = root.StudentIdentity
        || (typeof module !== "undefined" && module.exports ? require("../student-identity") : null);
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);

    function parseVnd(value) {
        if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
        if (typeof value !== "string") return null;
        const raw = value.trim();
        if (!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(raw)) return null;
        const normalized = raw.replace(/\./g, "");
        const amount = Number(normalized);
        return Number.isSafeInteger(amount) ? amount : null;
    }

    function formatVnd(value) {
        const amount = Number(value);
        if (!Number.isSafeInteger(amount)) return "—";
        return `${amount.toLocaleString("vi-VN")}\u00a0đ`;
    }

    function parseVndNonNegative(value) {
        if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
        if (typeof value !== "string") return null;
        const raw = value.trim();
        if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(raw)) return null;
        const amount = Number(raw.replace(/\./g, ""));
        return Number.isSafeInteger(amount) ? amount : null;
    }

    function exceedsBalance(amount, balance) {
        return !Number.isSafeInteger(amount) || amount <= 0
            || !Number.isSafeInteger(balance) || balance < 0 || amount > balance;
    }

    function refundReasonRequired(amount, suggested, reason) {
        return Number(amount) !== Number(suggested) && !String(reason || "").trim();
    }

    function invoicePersonLabel(invoice, maskId = true) {
        const name = String(invoice?.HoTen || invoice?.TenSinhVien || "").trim();
        const id = String(invoice?.MaSinhVien || "").trim();
        const visibleId = maskId ? maskStudentId(id) : id;
        if (name && id) return name === id ? visibleId : `${name} (${visibleId})`;
        return name || (id ? visibleId : "Theo phòng/hợp đồng");
    }

    function maskStudentId(value) {
        return studentIdentity.maskStudentIdentity(value);
    }

    function maskStudentIdsInText(value, knownIdentities = []) {
        return studentIdentity.maskStudentIdentitiesInText(value, knownIdentities);
    }

    function parseDateParts(value) {
        if (typeof value !== "string") return null;
        const input = value.trim();
        let year;
        let month;
        let day;
        let match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(input);
        if (match) [, year, month, day] = match;
        else {
            match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
            if (match) [, day, month, year] = match;
            else {
                match = /^(\d{2})(\d{2})(\d{4})$/.exec(input);
                if (!match) return null;
                [, day, month, year] = match;
            }
        }
        const y = Number(year);
        const m = Number(month);
        const d = Number(day);
        const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
        const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (y < 1 || m < 1 || m > 12 || d < 1 || d > daysInMonth[m - 1]) return null;
        return { year: y, month: m, day: d };
    }

    function date(value, mode = "format") {
        const parts = parseDateParts(value);
        if (!parts) return mode === "parse" ? null : "";
        const { year, month, day } = parts;
        const apiDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return mode === "parse" ? apiDate : `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year).padStart(4, "0")}`;
    }

    function filterDateInput(value) {
        return String(value ?? "").replace(/[^\d/]/g, "").slice(0, 10);
    }

    function normalizeDateInput(value) {
        const source = String(value ?? "").trim();
        let day;
        let month;
        let year;
        if (/^\d{8}$/.test(source)) {
            day = source.slice(0, 2);
            month = source.slice(2, 4);
            year = source.slice(4);
        } else if (source.includes("/")) {
            const parts = source.split("/");
            if (parts.length !== 3 || !/^\d{1,2}$/.test(parts[0])
                || !/^\d{1,2}$/.test(parts[1]) || !/^\d{4}$/.test(parts[2])) return null;
            [day, month, year] = parts;
        } else {
            return null;
        }
        const normalized = `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
        const parts = parseDateParts(normalized);
        if (!parts || parts.year < 1900 || parts.year > 2100) return null;
        return normalized;
    }

    function validateDateInput(value, { minYear, maxDate } = {}) {
        if (!String(value ?? "").trim()) return "Vui lòng nhập ngày.";
        const normalized = normalizeDateInput(value);
        const parsed = normalized && date(normalized, "parse");
        if (!parsed) return "Ngày không hợp lệ";
        const year = Number(parsed.slice(0, 4));
        if (year < 1900 || year > 2100) return "Ngày không hợp lệ";
        if (minYear && year < minYear) return `Ngày không hợp lệ. Năm phải từ ${minYear} trở lên.`;
        if (maxDate && parsed > maxDate) return "Ngày không được ở tương lai.";
        return "";
    }

    function filterRows(rows, filters = {}, { searchFields = [], statusField = "TrangThai", dateField = "" } = {}) {
        const search = String(filters.search || "").trim().toLocaleLowerCase("vi");
        const status = String(filters.status || "ALL");
        const from = String(filters.from || "");
        const to = String(filters.to || "");
        return rows.filter(row => {
            if (status !== "ALL" && String(row[statusField] ?? "") !== status) return false;
            const text = searchFields.map(key => row[key]).filter(value => value != null)
                .join(" ").toLocaleLowerCase("vi");
            if (search && !text.includes(search)) return false;
            if (dateField) {
                const rowDate = String(row[dateField] || "").slice(0, 10);
                if (from && rowDate < from) return false;
                if (to && rowDate > to) return false;
            }
            return true;
        });
    }

    function paginateRows(rows, page = 1, pageSize = 20) {
        const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 20));
        const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize));
        const currentPage = Math.min(pageCount, Math.max(1, Math.floor(Number(page) || 1)));
        const start = (currentPage - 1) * safePageSize;
        return {
            rows: rows.slice(start, start + safePageSize),
            page: currentPage,
            pageCount,
            total: rows.length,
            start: rows.length ? start + 1 : 0,
            end: Math.min(start + safePageSize, rows.length)
        };
    }

    function listSummary(label, rows, activePredicate, activeLabel) {
        const items = Array.isArray(rows) ? rows : [];
        const activeCount = items.filter(activePredicate).length;
        return `Tổng: ${items.length} ${label} (${activeCount} ${activeLabel})`;
    }

    function statusClass(value) {
        const label = displayLabel(value).trim().toLocaleLowerCase("vi");
        if (["chờ xác nhận", "còn nợ", "chưa thanh toán", "thanh toán một phần",
            "chưa xếp phòng", "chờ duyệt", "chờ xử lý", "sắp hết hạn"].includes(label)) {
            return "admin-status--warning";
        }
        if (["đang ở", "còn hiệu lực", "đã thanh toán", "hợp lệ", "thành công",
            "đang áp dụng", "đã xác nhận", "đã xác nhận (tự động)"].includes(label)) {
            return "admin-status--success";
        }
        if (["đã rời", "đã rời khỏi", "trễ hạn", "quá hạn", "thất bại", "từ chối"].includes(label)) {
            return "admin-status--danger";
        }
        if (["đầy"].includes(label)) return "admin-status--info";
        return "admin-status--neutral";
    }

    function statusBadge(value, extraClass = "") {
        const label = displayLabel(value).trim() || "—";
        return `<span class="admin-status-badge ${statusClass(label)} ${escapeHtml(extraClass)}">${escapeHtml(label)}</span>`;
    }

    function paymentMethodLabel(value) {
        const method = String(value ?? "").trim().toUpperCase();
        if (!method) return "—";
        return ["CASH", "TIỀN MẶT"].includes(method) ? "Tiền mặt" : "Chuyển khoản QR";
    }

    function maskPaymentReference(value) {
        return String(value ?? "");
    }

    function vietnamToday() {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Ho_Chi_Minh",
            year: "numeric", month: "2-digit", day: "2-digit"
        }).formatToParts(new Date());
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    function invoicePaymentLabel(invoice, today = vietnamToday()) {
        if (String(invoice?.TrangThaiThanhToan || "").trim() === "Đã hủy") return "Đã hủy";
        const balance = Number(invoice?.ConNo);
        if ((invoice?.ConNo !== undefined && balance <= 0)
            || String(invoice?.TrangThaiThanhToan || "").trim() === "Đã thanh toán") {
            return "Đã thanh toán";
        }
        const dueDate = String(invoice?.HanThanhToanApDung || invoice?.HanThanhToan || "")
            .slice(0, 10);
        if (balance > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < today) {
            return "Trễ hạn";
        }
        return "Còn nợ";
    }

    function refundDisplayNote(refund) {
        const note = String(refund?.GhiChu || "").trim();
        const requestId = note.match(/yêu cầu\s+(YC\d{5})/i)?.[1];
        const days = Number(refund?.SoNgayDaO);
        const amount = Number(refund?.SoTien);
        if (refund?.LyDo !== "Trả phòng sớm" || !requestId
            || !Number.isInteger(days) || days < 1 || !Number.isFinite(amount) || amount < 0) {
            return note || "—";
        }
        return `Trả phòng sớm theo yêu cầu ${requestId}: ở ${days} ngày, hoàn ${amount.toLocaleString("vi-VN")} đ`;
    }

    function overdueDays(invoice, today = "") {
        if (!isOverdueInvoice(invoice, today)) return 0;
        const dueDate = date(String(invoice?.HanThanhToan ?? "").slice(0, 10), "parse");
        const currentDate = today || (() => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        })();
        const toDayNumber = value => {
            const [year, month, day] = value.split("-").map(Number);
            return Date.UTC(year, month - 1, day) / 86400000;
        };
        return dueDate ? Math.max(0, toDayNumber(currentDate) - toDayNumber(dueDate)) : 0;
    }

    function genderBadge(value) {
        const label = String(value ?? "").trim() || "Chưa xác định";
        const color = label === "Nam" ? "admin-status--info"
            : label === "Nữ" ? "admin-status--success" : "admin-status--neutral";
        return `<span class="admin-status-badge ${color}">${escapeHtml(label)}</span>`;
    }

    function serviceEditMode(editing) {
        const isEditing = Boolean(editing);
        return Object.freeze({
            canAdd: isEditing,
            canEditRows: isEditing,
            toggleLabel: isEditing ? "Xem danh sách" : "Chỉnh sửa dịch vụ"
        });
    }

    function groupContractDetails(rows) {
        const groups = new Map();
        rows.forEach(row => {
            if (!groups.has(row.MaHopDong)) groups.set(row.MaHopDong, { contract: row, members: [] });
            groups.get(row.MaHopDong).members.push(row);
        });
        return [...groups.values()];
    }

    function renderTable(columns, rows, emptyText = "Không có dữ liệu phù hợp", rowAttributes = () => "", tableClass = "") {
        const fixedLayout = tableClass.includes("admin-table--fixed");
        const header = columns.map(column => {
            const widthStyle = `width:${Number(column.width) || 140}px`;
            const wrapStyle = fixedLayout ? ";overflow-wrap:anywhere" : "";
            const style = fixedLayout ? `style="${widthStyle}${wrapStyle}"`
                : column.align === "right" || column.width ? `style="width:${Number(column.width) || 140}px"` : "";
            return `<th scope="col" ${style} class="whitespace-normal p-3 align-middle ${column.code ? "admin-code-cell" : ""} ${column.align === "right" ? "text-right tabular-nums" : "text-left"}">${escapeHtml(column.label)}</th>`;
        }).join("");
        const body = rows.length ? rows.map((row, index) => `<tr class="border-t" ${rowAttributes(row, index)}>${columns.map(column => {
            const value = column.render(row, index);
            const title = column.title ? ` title="${escapeHtml(column.title(row, index))}"` : "";
            const longText = column.longText ? " admin-cell-truncate" : "";
            const wrapText = column.wrap ? " admin-wrap-cell whitespace-normal break-words" : "";
            const width = Number(column.width) || (column.align === "right" ? 140 : 0);
            const nowrap = column.nowrap || column.align === "right";
            const widthStyle = Number.isFinite(width) && width > 0 ? `width:${width}px;max-width:${width}px` : "";
            const wrapStyle = fixedLayout ? `${widthStyle ? ";" : ""}overflow-wrap:anywhere` : "";
            const cellWhiteSpace = nowrap && column.align === "right" ? "whitespace-nowrap" : "whitespace-normal";
            return `<td ${widthStyle || fixedLayout ? `style="${widthStyle}${wrapStyle}"` : ""} class="${cellWhiteSpace} ${column.code ? "admin-code-cell" : ""} p-3 align-middle${longText}${wrapText} ${column.align === "right" ? "text-right tabular-nums" : "text-left"}"${title}>${value}</td>`;
        }).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}" class="p-5 text-center text-slate-500">${escapeHtml(emptyText)}</td></tr>`;
        const tableWidth = columns.every(column => Number(column.width) > 0) ? "w-full" : "min-w-max w-full";
        const colgroup = fixedLayout
            ? `<colgroup>${columns.map(column => `<col style="width:${Number(column.width) || 140}px">`).join("")}</colgroup>`
            : "";
        return `<table ${fixedLayout ? 'style="table-layout:fixed;width:100%"' : ""} class="admin-data-table ${tableWidth} text-sm text-left ${escapeHtml(tableClass)}">${colgroup}<thead class="bg-slate-100"><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
    }

    function enhanceAdminTables(container) {
        if (!container || typeof MutationObserver === "undefined" || container.dataset.adminTableObserver) return;
        container.dataset.adminTableObserver = "true";
        const enhance = table => {
            if (table.dataset.adminFilterEnhanced || table.closest("[data-no-admin-filters]") || !table.querySelector("thead")) return;
            const parent = table.parentElement;
            if (!parent || !table.isConnected) return;
            table.dataset.adminFilterEnhanced = "true";
            [...table.querySelectorAll("thead th")].forEach((header, index) => {
            header.classList.add("whitespace-nowrap", "align-middle");
            [...table.querySelectorAll("tbody tr")].forEach(row => {
                const cell = row.cells[index];
                if (!cell) return;
                cell.classList.add("whitespace-nowrap", "align-middle");
                cell.classList.toggle("text-right", header.classList.contains("text-right"));
                cell.classList.toggle("text-left", !header.classList.contains("text-right"));
            });
            });
            const id = `admin-table-${Math.random().toString(36).slice(2)}`;
            const toolbar = document.createElement("div");
            toolbar.className = "mb-2 flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3";
            toolbar.dataset.adminTableToolbar = id;
            toolbar.innerHTML = `<input type="search" data-table-search placeholder="Tìm kiếm" aria-label="Tìm kiếm bảng"
                    class="h-10 min-w-40 flex-1 rounded border px-3 py-2 text-sm">
                <select data-table-status aria-label="Lọc trạng thái"                 class="h-10 min-w-36 rounded border px-3 py-2 text-sm">
                    <option value="ALL">Tất cả trạng thái</option></select>
                <input type="text" maxlength="10" inputmode="numeric" placeholder="Từ ngày dd/mm/yyyy" data-table-from
                    class="hidden h-10 min-w-36 rounded border px-3 py-2 text-sm">
                <input type="text" maxlength="10" inputmode="numeric" placeholder="Đến ngày dd/mm/yyyy" data-table-to
                    class="hidden h-10 min-w-36 rounded border px-3 py-2 text-sm">
                <button type="button" data-table-clear class="h-10 rounded bg-slate-100 px-3 text-sm">Xóa lọc</button>
                <p data-table-error class="w-full text-xs text-red-700" role="alert"></p>`;
            parent.insertBefore(toolbar, table);
            const footer = document.createElement("footer");
            footer.className = "mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2";
            footer.innerHTML = `<p data-table-empty class="hidden w-full text-center text-sm text-slate-500">Không có dữ liệu phù hợp</p>
                <span data-table-count class="whitespace-nowrap text-sm text-slate-600"></span>
                <div data-table-pages class="flex items-center justify-end gap-2 whitespace-nowrap"></div>`;
            parent.insertBefore(footer, table.nextSibling);
            const searchInput = toolbar.querySelector("[data-table-search]");
            const statusSelect = toolbar.querySelector("[data-table-status]");
            const fromInput = toolbar.querySelector("[data-table-from]");
            const toInput = toolbar.querySelector("[data-table-to]");
            let page = 1;
            const apply = () => {
                const rows = [...table.querySelectorAll("tbody tr")].filter(row => row.cells.length > 1 || row.cells[0]?.colSpan <= 1);
                const statuses = [...new Set(rows.flatMap(row => [...row.querySelectorAll('[class*="rounded-full"]')]
                    .map(node => node.textContent.trim()).filter(Boolean)))];
                const selectedStatus = statusSelect.value;
                statusSelect.innerHTML = `<option value="ALL">Tất cả trạng thái</option>${statuses.map(value =>
                    `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
                if (statuses.includes(selectedStatus)) statusSelect.value = selectedStatus;
                const hasDates = rows.some(row => /\b\d{2}\/\d{2}\/\d{4}\b/.test(row.textContent));
                fromInput.classList.toggle("hidden", !hasDates);
                toInput.classList.toggle("hidden", !hasDates);
                const search = searchInput.value.trim().toLocaleLowerCase("vi");
                const selected = statusSelect.value;
                const fromText = fromInput.value.trim();
                const toText = toInput.value.trim();
                const from = fromText ? date(fromText, "parse") : "";
                const to = toText ? date(toText, "parse") : "";
                const error = toolbar.querySelector("[data-table-error]");
                error.textContent = (fromText && !from) || (toText && !to)
                    ? "Ngày lọc không hợp lệ. Nhập theo dd/mm/yyyy." : "";
                if (from && to && from > to) error.textContent = "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.";
                let matches = 0;
                rows.forEach(row => {
                    const statusText = row.querySelector('[class*="rounded-full"]')?.textContent.trim() || "";
                    const text = row.textContent.toLocaleLowerCase("vi");
                    const rowDateText = row.textContent.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] || "";
                    const rowDate = rowDateText ? date(rowDateText, "parse") : "";
                    const visible = (!search || text.includes(search))
                        && (selected === "ALL" || statusText === selected)
                        && (!fromText || Boolean(from && rowDate && rowDate >= from))
                        && (!toText || Boolean(to && rowDate && rowDate <= to));
                    row.hidden = !visible;
                    if (visible) matches++;
                });
                const pageCount = Math.max(1, Math.ceil(matches / 20));
                page = Math.min(page, pageCount);
                let visibleIndex = 0;
                rows.forEach(row => {
                    if (row.hidden) return;
                    row.hidden = visibleIndex < (page - 1) * 20 || visibleIndex >= page * 20;
                    visibleIndex++;
                });
                footer.querySelector("[data-table-count]").textContent = `Tổng: ${rows.length} dòng · ${matches} phù hợp`;
                footer.querySelector("[data-table-empty]").classList.toggle("hidden", matches > 0);
                footer.querySelector("[data-table-pages]").innerHTML = `<button type="button" data-table-page="${page - 1}" ${page <= 1 ? "disabled" : ""} class="rounded bg-slate-100 px-3 py-1">Trước</button>
                    <span class="text-sm">Trang ${page}/${pageCount}</span>
                    <button type="button" data-table-page="${page + 1}" ${page >= pageCount ? "disabled" : ""} class="rounded bg-slate-100 px-3 py-1">Sau</button>`;
            };
            toolbar.addEventListener("input", event => {
                if (event.target.matches("[data-table-search]")) page = 1;
                apply();
            });
            toolbar.addEventListener("change", () => { page = 1; apply(); });
            toolbar.addEventListener("click", event => {
                if (event.target.matches("[data-table-clear]")) {
                    searchInput.value = "";
                    statusSelect.value = "ALL";
                    fromInput.value = "";
                    toInput.value = "";
                    page = 1;
                    apply();
                }
                if (event.target.matches("[data-table-page]")) {
                    page = Number(event.target.dataset.tablePage);
                    apply();
                }
            });
            footer.addEventListener("click", event => {
                const pageButton = event.target.closest("[data-table-page]");
                if (!pageButton) return;
                page = Number(pageButton.dataset.tablePage);
                apply();
            });
            const bodyObserver = new MutationObserver(() => {
                if (!table.isConnected) {
                    bodyObserver.disconnect();
                    return;
                }
                apply();
            });
            bodyObserver.observe(table, { childList: true, subtree: true });
            apply();
        };
        const scan = node => {
            if (node.nodeType !== 1) return;
            if (node.matches("table")) enhance(node);
            node.querySelectorAll?.("table").forEach(enhance);
        };
        scan(container);
        const observer = new MutationObserver(records => records.forEach(record =>
            record.addedNodes.forEach(scan)));
        observer.observe(container, { childList: true, subtree: true });
    }

    function dateField(label, name, value = "", { required = false, birthDate = false } = {}) {
        const sourceValue = String(value ?? "");
        const displayValue = normalizeDateInput(sourceValue) || date(sourceValue, "format") || "";
        return `<div class="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-3 text-[13px] font-semibold text-[#0f172a]">
            <label class="pt-2" for="date-${escapeHtml(name)}">${escapeHtml(label)}${required ? ' <span class="text-red-500">*</span>' : ""}</label>
            <div>
            <div class="relative flex gap-1">
                <input id="date-${escapeHtml(name)}" name="${escapeHtml(name)}" type="text" maxlength="10"
                    inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy" value="${escapeHtml(displayValue)}"
                    data-admin-date ${birthDate ? 'data-date-birth="true"' : ""} ${required ? "required" : ""}
                    class="h-[34px] w-full rounded border border-[#e2e8f0] px-3 text-[12px] font-normal">
                <button type="button" data-action="date-picker-open" aria-label="Chọn ngày"
                    class="h-[34px] rounded border border-[#e2e8f0] px-3 text-slate-600" title="Chọn ngày">▦</button>
                <input type="date" data-date-picker aria-hidden="true" tabindex="-1"
                    class="absolute right-0 top-0 h-px w-px opacity-0">
            </div>
            <p class="mt-1 min-h-4 text-xs font-normal text-red-700" data-date-error role="alert"></p>
            </div>
        </div>`;
    }

    function dateTime(value) {
        const input = String(value ?? "").trim();
        const formattedDate = date(input.slice(0, 10));
        if (!formattedDate) return "—";
        const timeMatch = /[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?/.exec(input);
        return timeMatch ? `${timeMatch[1]} ${formattedDate}` : formattedDate;
    }

    function tierForRoom(rooms, roomName) {
        return rooms.find(room => room.TenPhong === roomName)?.MaHangPhong || "";
    }

    function roomGender(room) {
        return String(room?.LoaiPhong ?? "").trim() || "Chưa xác định";
    }

    function roomLabel(room, occupants = room?.SoSinhVienHienTai) {
        const current = Number.isFinite(Number(occupants)) ? Number(occupants) : 0;
        const capacity = Number.isFinite(Number(room?.SucChuaToiDa))
            ? Number(room.SucChuaToiDa) : "—";
        return `${String(room?.TenPhong || "—")} · ${roomGender(room)} · ${current}/${capacity}`;
    }

    function filterRoomsByGender(rooms, gender) {
        const expected = String(gender ?? "").trim();
        return (rooms || []).filter(room => !expected || String(room?.LoaiPhong ?? "").trim() === expected);
    }

    function filterStudentsByRoomGender(students, room) {
        const expected = String(room?.LoaiPhong ?? "").trim();
        return (students || []).filter(student =>
            !expected || String(student?.GioiTinh ?? "").trim() === expected
        );
    }

    function serviceCanBeActive(price) {
        const amount = parseVndNonNegative(price);
        return amount !== null && amount > 0;
    }

    function canChangeRoomTier(room) {
        return Number(room?.SoSinhVienHienTai || 0) === 0
            && Number(room?.SoHopDongConHieuLuc || 0) === 0;
    }

    function contractRoomSelection(roomName, contracts) {
        const roomContracts = (contracts || []).filter(contract =>
            contract.TenPhong === roomName && contract.TrangThaiHopDong === "Còn hiệu lực"
        );
        if (roomContracts.length > 1) return { mode: "invalid", contract: null };
        return roomContracts.length === 1
            ? { mode: "add-member", contract: roomContracts[0] }
            : { mode: "create-contract", contract: null };
    }

    function contractRoomAvailability(rooms, contracts) {
        const occupied = new Map();
        const activeContracts = new Map();
        for (const contract of contracts || []) {
            if (contract.TrangThaiHopDong !== "Còn hiệu lực") continue;
            const roomContracts = activeContracts.get(contract.TenPhong) || [];
            roomContracts.push(contract);
            activeContracts.set(contract.TenPhong, roomContracts);
            for (const member of contract.sinhVien || []) {
                if (member.TrangThai !== "Đang ở") continue;
                occupied.set(contract.TenPhong, (occupied.get(contract.TenPhong) || 0) + 1);
            }
        }
        return (rooms || [])
            .filter(room => !["Bảo trì", "Ngưng sử dụng"].includes(room.TrangThaiPhong))
            .map(room => {
                const currentOccupants = occupied.get(room.TenPhong) || 0;
                const contractsForRoom = activeContracts.get(room.TenPhong) || [];
                return {
                    ...room,
                    currentOccupants,
                    availableSeats: Math.max(0, Number(room.SucChuaToiDa || 0) - currentOccupants),
                    activeContract: contractsForRoom.length === 1 ? contractsForRoom[0] : null,
                    activeContractAmbiguous: contractsForRoom.length > 1
                };
            })
            .filter(room => room.availableSeats > 0 && !room.activeContractAmbiguous)
            .sort((left, right) => left.availableSeats - right.availableSeats
                || String(left.TenPhong || "").localeCompare(String(right.TenPhong || ""), "vi"));
    }

    function contractRoomsForStudents(rooms, contracts, students) {
        const selected = (students || []).filter(Boolean);
        if (!selected.length) return [];
        const gender = String(selected[0].GioiTinh || "").trim();
        if (!gender || selected.some(student => String(student.GioiTinh || "").trim() !== gender)) return [];
        return contractRoomAvailability(rooms, contracts).filter(room =>
            String(room.LoaiPhong || "").trim() === gender && room.availableSeats >= selected.length
            && (selected.length === 1 || !room.activeContract)
        );
    }

    let contractMemberSearchSequence = 0;
    function contractMemberRowHtml(_students, member = {}, excludedIds = []) {
        const listId = `contract-student-options-${++contractMemberSearchSequence}`;
        return `<div class="member-row min-w-0 rounded-lg border p-3" data-excluded-ids="${escapeHtml(JSON.stringify(excludedIds))}">
            <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2 md:grid-cols-[minmax(0,1fr)_140px_auto_auto]">
                <div class="relative col-span-3 min-w-0 md:col-span-1">
                    <label class="block text-sm font-semibold">Sinh viên
                        <input type="hidden" name="maSinhVien" value="${escapeHtml(member.MaSinhVien || "")}" required>
                        <input type="search" data-student-search role="combobox" aria-autocomplete="list"
                            aria-expanded="false" aria-controls="${listId}" aria-label="Tìm sinh viên theo họ tên, Số CCCD hoặc hộ chiếu"
                            autocomplete="off" placeholder="Tìm theo họ tên, Số CCCD hoặc hộ chiếu"
                            class="mt-1 h-10 w-full min-w-0 rounded border px-3 font-normal">
                    </label>
                    <div id="${listId}" data-student-options role="listbox" class="absolute z-30 mt-1 hidden max-h-60 w-full overflow-y-auto rounded-lg border bg-white shadow-lg"></div>
                </div>
                <label class="block min-w-0 text-sm font-semibold">Kỳ hạn
                    <select name="kyHanThanhToanPhong" class="mt-1 h-10 w-full rounded border px-2 font-normal">
                        <option value="THANG">Theo tháng</option><option value="NAM">Theo năm</option>
                    </select>
                </label>
                <label class="flex min-h-10 items-center gap-2 whitespace-nowrap text-sm"><input name="laNguoiDaiDien" type="checkbox"> Đại diện dịch vụ</label>
                <button type="button" data-action="remove-member-row" class="min-h-10 shrink-0 whitespace-nowrap rounded bg-red-100 px-3 py-2 text-red-800">Bỏ</button>
            </div>
            <div data-student-conflict class="mt-2"></div>
        </div>`;
    }

    function memberAddRequest(contractId, member) {
        const id = String(member?.maSinhVien || "").trim();
        if (!contractId || !id || !["THANG", "NAM"].includes(member?.kyHanThanhToanPhong)) {
            throw new Error("Vui lòng chọn sinh viên và kỳ hạn thanh toán hợp lệ.");
        }
        return {
            url: `/api/HopDong/${encodeURIComponent(contractId)}/chitiet`,
            options: {
                method: "POST",
                body: JSON.stringify({
                    maSinhVien: id,
                    kyHanThanhToanPhong: member.kyHanThanhToanPhong,
                    laNguoiDaiDien: Boolean(member.laNguoiDaiDien)
                })
            }
        };
    }

    function tierDraftKey(draft = {}) {
        return JSON.stringify({
            tierId: draft.tierId,
            tenHangPhong: String(draft.tenHangPhong || "").trim(),
            sucChuaToiDa: Number(draft.sucChuaToiDa),
            giaPhongThang: Number(draft.giaPhongThang),
            giaPhongNam: Number(draft.giaPhongNam),
            dichVu: [...(draft.dichVu || [])].map(service => ({
                MaDichVu: service.MaDichVu,
                DonGia: Number(service.DonGia),
                CachTinh: service.CachTinh,
                DoiTuongThanhToan: service.DoiTuongThanhToan,
                HoatDong: service.HoatDong !== false
            })).sort((left, right) => String(left.MaDichVu).localeCompare(String(right.MaDichVu)))
        });
    }

    function hasTierDraftChanges(draft, original) {
        return tierDraftKey(draft) !== tierDraftKey(original);
    }

    const displayLabels = Object.freeze({
        CASH: "Tiền mặt",
        ONLINE: "Chuyển khoản QR",
        QR_DEMO: "Chuyển khoản QR",
        CHUYEN_DOI: "Chuyển khoản QR",
        CHI_SO: "Theo chỉ số công tơ",
        CO_DINH_KY: "Cố định theo kỳ",
        PHONG: "Cả phòng",
        CA_NHAN: "Từng người",
        VALID: "Hợp lệ",
        SUCCESS: "Hợp lệ",
        PENDING: "Chờ xác nhận",
        CANCELLED: "Đã hủy",
        CANCELED: "Đã hủy",
        CANCEL: "Đã hủy",
        VOID: "Đã hủy",
        PAID: "Đã thanh toán",
        UNPAID: "Còn nợ",
        "CHƯA THANH TOÁN": "Còn nợ",
        "THANH TOÁN MỘT PHẦN": "Còn nợ",
        "QUÁ HẠN": "Còn nợ",
        PARTIAL: "Thanh toán một phần",
        OVERDUE: "Còn nợ",
        THANG: "Theo tháng",
        NAM: "Theo năm",
        PENDING_CONFIRMATION: "Chờ xác nhận",
        COMPLETED: "Hợp lệ",
        PROCESSING: "Đang xử lý",
        FAILED: "Thất bại",
        REJECTED: "Từ chối",
        REFUNDED: "Đã hoàn tiền",
        EXPIRED: "Đã hết hạn",
        ACTIVE: "Còn hiệu lực",
        ENDED: "Đã kết thúc",
        TERMINATED: "Đã kết thúc",
        INACTIVE: "Ngừng hoạt động",
        OCCUPIED: "Đầy",
        VACANT: "Trống",
        WAITING_CASH: "Chờ xác nhận",
        APPROVED: "Đã duyệt",
        MALE: "Nam",
        FEMALE: "Nữ",
        CHECKED_IN: "Đang ở",
        CHECKED_OUT: "Đã rời",
        "ĐÃ KẾT THÚC": "Đã kết thúc",
        "CÒN HIỆU LỰC": "Còn hiệu lực",
        "CHỜ XÁC NHẬN": "Chờ xác nhận",
        "ĐÃ THANH TOÁN": "Đã thanh toán",
        "HỢP LỆ": "Hợp lệ",
        "ĐÃ HỦY": "Đã hủy",
        EMPTY: "Trống",
        FULL: "Đầy",
        MAINTENANCE: "Bảo trì",
        DISABLED: "Ngưng sử dụng",
        TIEN_PHONG: "Tiền phòng",
        DICH_VU_PHONG: "Dịch vụ phòng",
        PHAT_SINH: "Phát sinh",
        "ĐÃ RỜI KHỎI": "Đã rời",
        "ĐANG Ở": "Đang ở",
        ROOM: "Cả phòng",
        PERSON: "Từng người"
    });
    function displayLabel(value, fallback = "—") {
        const raw = String(value ?? "").trim();
        if (!raw || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") return fallback;
        if (raw.toUpperCase() === "RECONCILIATION") return fallback;
        return displayLabels[raw.toUpperCase()] || raw;
    }

    function isOverdueInvoice(invoice, today = "") {
        return invoicePaymentLabel(invoice, today || vietnamToday()) === "Trễ hạn";
    }

    function filterFinancialRows(rows, type, filters = {}) {
        const search = String(filters.search || "").trim().toLocaleLowerCase("vi");
        const status = String(filters.status || (type === "receipts" ? "ALL" : "ACTION_REQUIRED"));
        const receiptStatuses = ["Đã xác nhận"];
        const method = String(filters.method || "ALL");
        const from = String(filters.from || "");
        const to = String(filters.to || "");
        return rows.filter(row => {
            const rowStatus = String(row.TrangThaiDanhSach || row.TrangThaiThanhToan || row.TrangThai || "");
            if (String(rowStatus).toUpperCase() === "RECONCILIATION") return false;
            const normalizedStatus = displayLabel(rowStatus, "");
            if (type === "invoices" && ["Đã hủy", "Đã huỷ"].includes(normalizedStatus)) return false;
            if (type === "receipts" && !receiptStatuses.includes(normalizedStatus)) return false;
            if (filters.invoiceType && filters.invoiceType !== "ALL" && row.LoaiHoaDon !== filters.invoiceType) return false;
            const isActionRequired = type === "invoices"
                ? ["Còn nợ", "Trễ hạn"].includes(invoicePaymentLabel(row))
                : type === "receipts"
                    ? false
                    : type === "payments"
                            ? ["Chờ xác nhận"].includes(normalizedStatus)
                        : type === "expenses"
                            ? normalizedStatus === "Chưa lập hóa đơn"
                        : ["Chờ xác nhận", "Cần xử lý"].includes(normalizedStatus);
            if (status === "ACTION_REQUIRED" && !isActionRequired) return false;
            if (status !== "ACTION_REQUIRED" && status !== "ALL") {
                const expectedStatus = type === "invoices" ? displayLabel(status, status) : displayLabel(status, status);
                const actualStatus = type === "invoices" ? invoicePaymentLabel(row) : normalizedStatus;
                if (actualStatus !== expectedStatus) return false;
            }
            if (method !== "ALL" && String(row.PhuongThuc || "") !== method) return false;
            const searchable = [
                row.TenPhong, row.MaSinhVien, row.MaSinhVienNop, row.HoTen,
                row.TenNguoiNop, row.MaHoaDon, row.MaPhieuThu, row.MaPhieuChi,
                row.MaGiaoDich, row.MaHopDong
            ].filter(Boolean).join(" ").toLocaleLowerCase("vi");
            if (search && !searchable.includes(search)) return false;
            const rawDate = row.NgayLap || row.KyThanhToan || row.NgayThu || row.NgayChi || row.NgayTao || "";
            const rowDate = String(rawDate).slice(0, 10);
            if (from && rowDate < from) return false;
            if (to && rowDate > to) return false;
            return true;
        });
    }

    function bindDateInputs(rootElement) {
        if (!rootElement || rootElement.dataset.dateInputsBound) return;
        rootElement.dataset.dateInputsBound = "true";
        const getError = input => {
            const id = input.getAttribute("aria-describedby");
            return (id && input.ownerDocument.getElementById(id))
                || input.closest("label")?.querySelector("[data-date-error]")
                || input.closest("div")?.parentElement?.querySelector("[data-date-error]");
        };
        const commit = input => {
            const value = input.value.trim();
            const error = getError(input);
            if (!value && !input.required) {
                if (error) error.textContent = "";
                input.setCustomValidity("");
                return "";
            }
            const today = new Date();
            const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            const message = validateDateInput(value, input.dataset.dateBirth === "true"
                ? { minYear: 1900, maxDate: todayIso } : {});
            if (!message) input.value = normalizeDateInput(value);
            if (error) error.textContent = message;
            input.setCustomValidity(message);
            if (!message) {
                const InputEvent = input.ownerDocument.defaultView?.Event || Event;
                input.dispatchEvent(new InputEvent("admin-date-input", { bubbles: true }));
            }
            return message;
        };
        rootElement.addEventListener("input", event => {
            const input = event.target.closest("[data-admin-date]");
            if (!input) return;
            const filtered = filterDateInput(input.value);
            if (filtered !== input.value) {
                input.setRangeText(filtered, 0, input.value.length, "end");
            }
        });
        rootElement.addEventListener("focusout", event => {
            const input = event.target.closest("[data-admin-date]");
            if (!input) return;
            commit(input);
        });
        rootElement.addEventListener("keydown", event => {
            const input = event.target.closest("[data-admin-date]");
            if (!input || event.key !== "Enter") return;
            if (commit(input)) event.preventDefault();
        });
        rootElement.addEventListener("click", event => {
            const button = event.target.closest('[data-action="date-picker-open"]');
            if (!button) return;
            const picker = button.parentElement.querySelector("[data-date-picker]");
            if (typeof picker.showPicker === "function") picker.showPicker();
            else picker.click();
            picker.onchange = () => {
                const input = button.parentElement.querySelector("[data-admin-date]");
                input.value = date(picker.value);
                commit(input);
            };
        });
        return Object.freeze({ commit });
    }

    function threeDigitsToWords(value) {
        const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
        const hundred = Math.floor(value / 100);
        const ten = Math.floor((value % 100) / 10);
        const unit = value % 10;
        const words = [];
        if (hundred) words.push(`${digits[hundred]} trăm`);
        else if (ten) words.push("không trăm");
        if (ten > 1) {
            words.push(`${digits[ten]} mươi`);
            if (unit === 1) words.push("mốt");
            else if (unit === 5) words.push("lăm");
            else if (unit) words.push(digits[unit]);
        } else if (ten === 1) {
            words.push("mười");
            if (unit === 5) words.push("lăm");
            else if (unit) words.push(digits[unit]);
        } else if (unit) {
            if (hundred) words.push("lẻ");
            words.push(digits[unit]);
        }
        return words.join(" ");
    }

    function amountInWords(value) {
        if (!Number.isSafeInteger(value) || value < 0) return "";
        if (value === 0) return "Không đồng";
        const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ"];
        const groups = [];
        let remaining = value;
        while (remaining > 0) {
            groups.push(remaining % 1000);
            remaining = Math.floor(remaining / 1000);
        }
        if (groups.length > units.length) return "";
        const words = [];
        for (let index = groups.length - 1; index >= 0; index--) {
            if (!groups[index]) continue;
            const part = threeDigitsToWords(groups[index]);
            words.push([part, units[index]].filter(Boolean).join(" "));
        }
        const result = words.join(" ").replace(/\s+/g, " ").trim();
        return `${result.charAt(0).toLocaleUpperCase("vi-VN")}${result.slice(1)} đồng`;
    }

    const utils = Object.freeze({
        MAX_INCIDENT_EXPENSE_VND,
        escapeHtml, parseVnd, parseVndNonNegative, formatVnd, exceedsBalance,
        refundReasonRequired, invoicePersonLabel, amountInWords, date, dateTime, tierForRoom,
        displayLabel, statusClass, statusBadge, genderBadge, paymentMethodLabel, maskPaymentReference,
        invoicePaymentLabel, vietnamToday, refundDisplayNote, overdueDays,
        maskStudentId, maskStudentIdsInText, filterFinancialRows, isOverdueInvoice, serviceCanBeActive, canChangeRoomTier,
        roomGender, roomLabel, filterRoomsByGender, filterStudentsByRoomGender,
        contractRoomAvailability, contractRoomSelection, contractRoomsForStudents, contractMemberRowHtml, memberAddRequest, hasTierDraftChanges, filterDateInput, normalizeDateInput,
        validateDateInput, filterRows, paginateRows, groupContractDetails, renderTable, dateField, bindDateInputs,
        listSummary, serviceEditMode
        , enhanceAdminTables
    });
    root.AdminWorkflowUtils = utils;
    if (typeof module !== "undefined" && module.exports) module.exports = utils;
})(typeof window !== "undefined" ? window : globalThis);
