/**
 * ==========================================
 * MODULE: TRANG CHỦ
 * ==========================================
 */

const mockHomeData = {
    mission: {
        slogan: "Văn minh – An toàn – Hiện đại",
        values: [
            { icon: "fa-handshake",    title: "Văn minh", detail: "Xây dựng môi trường sống lịch sự, tôn trọng lẫn nhau." },
            { icon: "fa-shield-halved",title: "An toàn",  detail: "Đảm bảo an ninh, phòng cháy chữa cháy và trật tự." },
            { icon: "fa-microchip",    title: "Hiện đại", detail: "Ứng dụng công nghệ vào quản lý và sinh hoạt." },
        ],
    },
    documents: [
        { icon: "fa-file-lines", label: "Đơn đăng ký lưu trú",   tag: "PDF",  file: "don-dang-ky-luu-tru.pdf" },
        { icon: "fa-book-open",  label: "Nội quy ký túc xá 2026", tag: "PDF",  file: "noi-quy-ktx-2026.pdf" },
        { icon: "fa-file-pen",   label: "Mẫu đơn xin tạm vắng",  tag: "DOCX", file: "don-xin-tam-vang.docx" },
    ],
};

let homeDashboardCleanup = null;

function renderTrangChuModule() {
    if (homeDashboardCleanup) homeDashboardCleanup();
    const main = document.getElementById("main-content");


    // Reuse the shared system layout and its existing sidebar.
    document.querySelector("header").style.display = "";
    document.getElementById("main-nav").style.display = "";
    main.classList.add("p-6");
    main.style.overflowY = "";
    main.style.height = "";
    const menuItems = document.querySelectorAll("#main-nav .nav-item");
    menuItems.forEach((item, index) => item.classList.toggle("nav-active", index === 0));

    const documentsHTML = mockHomeData.documents.map(d => `
        <a href="files/${d.file}" download="${d.file}"
           class="flex justify-between items-center p-3 mb-2 rounded-lg hover:bg-emerald-50 border-b border-slate-200 transition-all group">
            <div class="flex items-center gap-3">
                <div class="text-emerald-600"><i class="fa-solid ${d.icon}"></i></div>
                <span class="text-slate-900 text-sm font-medium group-hover:text-emerald-700">${d.label}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">${d.tag}</span>
                <i class="fa-solid fa-download text-slate-300 group-hover:text-emerald-500 text-xs transition-colors"></i>
            </div>
        </a>
    `).join("");

    main.innerHTML = `
    <section id="module-trangchu" class="w-full">

        <!-- ===== MAIN CONTENT ===== -->
        <div class="home-dashboard">
            <div class="home-welcome">
                <div class="home-greeting"><div class="home-greeting-row"><span class="home-wave" aria-hidden="true">👋</span><div><h2>Xin chào, <span data-home-user>Quản lý</span></h2><p>Chào mừng bạn trở lại hệ thống Quản lý Ký Túc Xá</p></div></div><p class="home-quote">“Quản lý hiệu quả – Môi trường sống tốt hơn cho sinh viên.”</p></div>
                <img class="home-campus-art" src="${window.KTX_IMAGE_PATHS?.dormitory || 'files/ky-tuc-xa.webp'}" alt="Khu ký túc xá với tòa nhà và cây xanh" loading="eager">
                <div class="home-clock"><i class="fa-regular fa-calendar-days" aria-hidden="true"></i><time data-home-clock><span class="home-calendar"><span data-home-weekday></span><span data-home-date></span></span><strong data-home-hour></strong></time></div>
            </div>
            <div class="home-stats" aria-label="Thống kê quản trị">
                ${[['rooms', 'Tổng phòng', 'fa-bed'], ['students', 'Tổng sinh viên', 'fa-user-group'], ['contracts', 'Hợp đồng đang hiệu lực', 'fa-file-contract'], ['revenue', 'Doanh thu tháng này', 'fa-wallet']].map(([key, label, icon]) => `<article class="home-stat"><span class="home-stat-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><p>${label}</p><strong data-home-value="${key}">—</strong><small data-home-status="${key}" role="status">Đang tải dữ liệu…</small></article>`).join('')}
            </div>
            <div class="home-columns">

                <!-- LEFT: Thông báo + Sứ mệnh -->
                <div class="home-panel home-announcements">

                    <!-- Thông báo -->
                    <div>
                        <div class="home-section-heading">
                            <h3 class="home-section-title">
                                <i class="fa-solid fa-bullhorn"></i> Thông báo mới nhất
                            </h3>
                            <p class="text-xs text-slate-500 mt-1">Thanh toán và yêu cầu mới từ sinh viên.</p>
                        </div>
                        <div class="space-y-3" data-payment-announcements role="status">Đang tải giao dịch…</div>
                    </div>
                    <section class="mt-6 border-t border-slate-200 pt-5" aria-labelledby="manage-student-notices">
                        <h3 id="manage-student-notices" class="home-section-title">Thông báo đến Sinh viên</h3>
                        <form data-notice-form class="mt-3 grid gap-3">
                            <input name="TieuDe" maxlength="200" required placeholder="Tiêu đề (tối đa 200 ký tự)" aria-label="Tiêu đề thông báo" class="w-full rounded-lg border px-3 py-2">
                            <textarea name="NoiDung" maxlength="2000" required rows="3" placeholder="Nội dung (tối đa 2.000 ký tự)" aria-label="Nội dung thông báo" class="w-full rounded-lg border px-3 py-2"></textarea>
                            <select name="PhamViNhan" aria-label="Đối tượng nhận" class="w-full rounded-lg border px-3 py-2">
                                <option value="TAT_CA">Tất cả sinh viên</option><option value="PHONG">Theo phòng</option><option value="SINH_VIEN">Theo Số CCCD</option>
                            </select>
                            <input name="TenPhong" maxlength="50" placeholder="Nhập hoặc chọn tên phòng" aria-label="Tên phòng nhận thông báo" class="w-full rounded-lg border px-3 py-2" hidden>
                            <label data-notice-student-field class="hidden text-sm font-semibold">Số CCCD
                                <input name="MaSinhVien" maxlength="30" placeholder="Nhập Số CCCD" aria-label="Số CCCD nhận thông báo" class="mt-1 w-full rounded-lg border px-3 py-2">
                            </label>
                            <p data-notice-status role="status" class="text-sm"></p>
                            <button type="submit" class="w-fit rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Gửi thông báo</button>
                        </form>
                        <ul data-notice-list class="mt-4 space-y-2"><li class="text-sm text-slate-500">Đang tải thông báo…</li></ul>
                    </section>

                </div>

                <!-- RIGHT: Lưu ý + Liên hệ + Văn bản -->
                <div class="home-aside">

                    <!-- Lưu ý nội quy -->
                    <div class="home-panel home-rules">
                        <div class="relative z-10">
                            <h4 class="font-black text-base mb-4 flex items-center gap-2">
                                <i class="fa-solid fa-circle-info text-yellow-400"></i>
                                Lưu ý nội quy
                            </h4>
                            <p class="text-xs text-slate-600 mb-3">Nội dung dùng chung với cổng Sinh viên.</p>
                            <div class="mb-3 flex flex-wrap items-center gap-2">
                                <button type="button" data-rule-edit-start disabled class="rounded-lg border border-emerald-700 px-3 py-1 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">Chỉnh sửa</button>
                                <button type="button" data-rule-save hidden class="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-bold text-white hover:bg-emerald-700">Lưu</button>
                                <button type="button" data-rule-cancel hidden class="rounded-lg border px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hủy</button>
                                <button type="submit" form="home-rule-create" data-rule-add hidden aria-label="Thêm nội quy" title="Thêm nội quy" class="home-rule-add flex h-7 w-8 items-center justify-center rounded-lg bg-yellow-400 p-0 text-lg font-bold leading-none text-slate-900 hover:bg-yellow-300">+</button>
                            </div>
                            <form id="home-rule-create" data-rule-create hidden class="mb-3">
                                <input name="NoiDung" maxlength="200" required aria-label="Nội quy mới" placeholder="Nhập nội quy mới" class="min-w-0 flex-1 rounded-lg px-2 py-1 text-sm text-slate-900">
                            </form>
                            <p data-rule-status role="status" class="mb-2 text-xs"></p>
                            <ul class="space-y-3" data-rules-list>Đang tải nội quy…</ul>
                        </div>
                    </div>

                    <!-- Liên hệ hỗ trợ -->
                    <div class="home-panel">
                        <h4 class="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-headset text-emerald-600"></i> Liên hệ hỗ trợ
                        </h4>
                        <p class="text-xs text-slate-500 mb-3">Thông tin dùng chung với cổng Sinh viên.</p>
                        <form data-contact-form class="space-y-3">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="fa-solid fa-phone text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">Điện thoại</p>
                                    <span data-contact-display="DienThoai" class="contact-display block py-1 font-semibold text-slate-900 text-sm">Đang tải…</span>
                                    <input name="DienThoai" type="tel" maxlength="50" required hidden aria-label="Điện thoại hỗ trợ" class="contact-input max-w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-900 text-sm">
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="fa-solid fa-envelope text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">Email</p>
                                    <span data-contact-display="Email" class="contact-display block py-1 font-semibold text-slate-900 text-sm">Đang tải…</span>
                                    <input name="Email" type="email" maxlength="100" required hidden aria-label="Email hỗ trợ" class="contact-input max-w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-900 text-sm">
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="fa-solid fa-clock text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">Giờ làm việc</p>
                                    <span data-contact-display="GioLamViec" class="contact-display block py-1 font-semibold text-slate-900 text-sm">Đang tải…</span>
                                    <input name="GioLamViec" maxlength="200" required hidden aria-label="Giờ làm việc" class="contact-input max-w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-900 text-sm">
                                </div>
                            </div>
                            <p data-contact-status role="status" class="text-xs"></p>
                            <div class="flex flex-wrap gap-2">
                                <button type="button" data-contact-edit-start disabled class="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">Chỉnh sửa</button>
                                <button type="submit" data-contact-save hidden class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Lưu</button>
                                <button type="button" data-contact-cancel hidden class="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Hủy</button>
                                <button type="button" data-contact-retry hidden class="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Thử tải lại</button>
                            </div>
                        </div>

                        <!-- Văn bản – Biểu mẫu (tải file thật) -->
                        <div class="home-panel home-documents">
                            <div class="home-section-heading">
                                <h4 class="home-section-title">
                                    <i class="fa-solid fa-folder-open"></i> Văn bản – Biểu mẫu
                                </h4>
                        </div>
                        <div>
                            ${documentsHTML}
                            <p class="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                                <i class="fa-solid fa-circle-info"></i>
                                Nhấn vào tên file để tải xuống.
                            </p>
                        </div>
                    </div>

                    </div>

                </div>
            </div>
        </div>
    </section>
    `;

    const userName = window.currentUser?.fullName || "Quản lý";
    main.querySelector("[data-home-user]").textContent = userName;
    startHomeDashboard(main.querySelector("#module-trangchu"));
}

function startHomeDashboard(root) {
    const controller = new AbortController();
    root.querySelector(".home-campus-art")?.addEventListener("error", event => {
        event.currentTarget.hidden = true;
    }, { once: true });
    const now = new Date();
    const clock = root.querySelector('[data-home-clock]');
    const updateClock = () => {
        const time = new Date();
        clock.dateTime = time.toISOString();
        clock.querySelector('[data-home-weekday]').textContent = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(time);
        clock.querySelector('[data-home-date]').textContent = window.AdminWorkflowUtils.date(
            `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}`,
            'format'
        );
        clock.querySelector('[data-home-hour]').textContent = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    const observer = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
    const cleanup = () => {
        clearInterval(timer);
        controller.abort();
        observer.disconnect();
        if (homeDashboardCleanup === cleanup) homeDashboardCleanup = null;
    };
    homeDashboardCleanup = cleanup;
    observer.observe(root.parentNode, { childList: true });
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
    const fetchJson = async (url, options) => {
        const response = await ApiClient.fetch(`${BASE_URL}${url}`, {
            ...options,
            signal: controller.signal
        });
        return response.json();
    };
    let rulesDraft = [];
    let nextRuleKey = 1;
    let editingRules = false;
    const statusTimers = new WeakMap();
    const showStatus = (status, message, isError = false) => {
        const oldTimer = statusTimers.get(status);
        if (oldTimer) clearTimeout(oldTimer);
        status.textContent = message;
        status.classList.toggle("text-red-600", isError);
        if (message && !isError) {
            statusTimers.set(status, setTimeout(() => {
                if (status.isConnected) status.textContent = "";
                statusTimers.delete(status);
            }, 3000));
        }
    };
    const renderRules = () => {
        const list = root.querySelector("[data-rules-list]");
        list.innerHTML = rulesDraft.length ? rulesDraft.map(rule => `
            <li class="rounded-lg bg-white/10 p-2">
                <div class="flex min-w-0 items-center gap-2">
                    ${editingRules
                        ? `<input data-rule-content="${rule.key}" maxlength="200" required aria-label="Nội dung nội quy" value="${escapeHtml(rule.content)}" ${rule.deleted ? "disabled" : ""} class="min-w-0 flex-1 rounded px-2 py-1 text-sm text-slate-900">`
                        : `<span class="min-w-0 flex-1 text-sm ${rule.deleted ? "text-slate-500 line-through" : "text-slate-900"}">${escapeHtml(rule.content)}</span>`}
                    ${editingRules ? rule.deleted
                        ? `<span class="text-xs font-semibold text-slate-600">Sẽ xóa khi lưu</span><button type="button" data-rule-undo="${rule.key}" class="shrink-0 text-xs font-bold text-emerald-800 underline">Hoàn tác</button>`
                        : `<button type="button" data-rule-delete="${rule.key}" class="shrink-0 text-xs font-bold text-red-700 underline hover:text-red-900">Xóa</button>`
                        : ""}
                </div>
            </li>`).join("") : '<li class="text-sm text-slate-600">Chưa có nội quy.</li>';
        root.querySelector("[data-rule-create]").hidden = !editingRules;
        root.querySelector("[data-rule-add]").hidden = !editingRules;
        root.querySelector("[data-rule-edit-start]").hidden = editingRules;
        root.querySelector("[data-rule-save]").hidden = !editingRules;
        root.querySelector("[data-rule-cancel]").hidden = !editingRules;
    };
    const setRulesEditing = editing => {
        editingRules = editing;
        renderRules();
    };
    const loadRules = async () => {
        const list = root.querySelector("[data-rules-list]");
        try {
            const rules = await fetchJson("/api/noi-quy");
            if (!root.isConnected) return;
            if (!Array.isArray(rules)) throw new Error("Dữ liệu nội quy không hợp lệ.");
            rulesDraft = rules.map(rule => ({
                key: nextRuleKey++,
                id: rule.id,
                originalContent: String(rule.NoiDung ?? ""),
                content: String(rule.NoiDung ?? ""),
                deleted: false
            }));
            root.querySelector("[data-rule-edit-start]").disabled = false;
            renderRules();
            showStatus(root.querySelector("[data-rule-status]"), "");
        } catch (error) {
            if (error.name !== "AbortError" && root.isConnected) {
                list.textContent = error.message || "Không thể tải nội quy.";
            }
        }
    };
    const saveRules = async () => {
        const status = root.querySelector("[data-rule-status]");
        const saveButton = root.querySelector("[data-rule-save]");
        if (rulesDraft.some(rule => !rule.deleted && !rule.content.trim())) {
            showStatus(status, "Nội dung nội quy không được để trống.", true);
            return;
        }
        saveButton.disabled = true;
        try {
            for (let index = 0; index < rulesDraft.length;) {
                const rule = rulesDraft[index];
                if (rule.deleted) {
                    if (rule.id) {
                        await fetchJson(`/api/noi-quy/${encodeURIComponent(rule.id)}`, { method: "DELETE" });
                    }
                    rulesDraft.splice(index, 1);
                    continue;
                }
                if (!rule.id) {
                    const created = await fetchJson("/api/noi-quy", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ NoiDung: rule.content })
                    });
                    rule.id = created.id;
                    rule.originalContent = rule.content;
                } else if (rule.content !== rule.originalContent) {
                    await fetchJson(`/api/noi-quy/${encodeURIComponent(rule.id)}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ NoiDung: rule.content })
                    });
                    rule.originalContent = rule.content;
                }
                index += 1;
            }
            setRulesEditing(false);
            showStatus(status, "Đã lưu thay đổi nội quy.");
        } catch (error) {
            showStatus(status, error.message || "Không thể lưu thay đổi nội quy.", true);
            renderRules();
        } finally {
            saveButton.disabled = false;
        }
    };
    let originalContact = null;
    let editingContact = false;
    const setContactEditing = editing => {
        editingContact = editing;
        const form = root.querySelector("[data-contact-form]");
        form.querySelectorAll(".contact-input").forEach(input => { input.hidden = !editing; });
        form.querySelectorAll(".contact-display").forEach(value => { value.hidden = editing; });
        form.querySelector("[data-contact-edit-start]").hidden = editing;
        form.querySelector("[data-contact-save]").hidden = !editing;
        form.querySelector("[data-contact-cancel]").hidden = !editing;
    };
    const loadContact = async () => {
        const form = root.querySelector("[data-contact-form]");
        const status = form.querySelector("[data-contact-status]");
        const retry = form.querySelector("[data-contact-retry]");
        form.querySelectorAll("input").forEach(control => { control.disabled = true; });
        retry.disabled = true;
        retry.hidden = true;
        status.textContent = "Đang tải thông tin liên hệ…";
        try {
            const contact = await fetchJson("/api/lien-he");
            if (!root.isConnected) return;
            for (const key of ["DienThoai", "Email", "GioLamViec"]) {
                form.elements.namedItem(key).value = contact[key] || "";
                form.querySelector(`[data-contact-display="${key}"]`).textContent = contact[key] || "Chưa cập nhật";
            }
            originalContact = {
                DienThoai: form.elements.DienThoai.value,
                Email: form.elements.Email.value,
                GioLamViec: form.elements.GioLamViec.value
            };
            form.querySelector("[data-contact-edit-start]").disabled = false;
            form.querySelectorAll("input").forEach(control => { control.disabled = false; });
            showStatus(status, "");
            retry.hidden = true;
            setContactEditing(false);
        } catch (error) {
            if (error.name !== "AbortError" && root.isConnected) {
                status.textContent = error.message || "Không thể tải thông tin liên hệ.";
                status.classList.add("text-red-600");
                retry.disabled = false;
                retry.hidden = false;
            }
        }
    };
    const renderManagedNotices = notices => {
        const list = root.querySelector("[data-notice-list]");
        list.innerHTML = notices.length ? notices.map(notice => {
            const scope = notice.PhamViNhan === "PHONG"
                ? `Phòng ${notice.TenPhong || "—"}`
                : notice.PhamViNhan === "SINH_VIEN" ? `Sinh viên ${window.AdminWorkflowUtils.maskStudentId(notice.MaSinhVien)}` : "Tất cả sinh viên";
            return `<li class="rounded-lg border p-3">
                <div class="flex min-w-0 items-start gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-start justify-between gap-3">
                            <strong class="min-w-0 break-words">${escapeHtml(window.AdminWorkflowUtils.maskStudentIdsInText(
                                notice.TieuDe || "—", [notice.MaSinhVien]
                            ))}</strong>
                            <button type="button" data-notice-delete="${escapeHtml(notice.MaThongBao)}" class="shrink-0 self-start rounded bg-red-50 px-3 py-1 text-sm font-semibold text-red-800">Ẩn</button>
                        </div>
                        <p class="mt-1 whitespace-pre-wrap break-words text-sm">${escapeHtml(window.AdminWorkflowUtils.maskStudentIdsInText(
                            notice.NoiDung || "—", [notice.MaSinhVien]
                        ))}</p>
                        <p class="mt-1 text-xs text-slate-500">${escapeHtml(scope)} · ${escapeHtml(window.AdminWorkflowUtils.dateTime(notice.NgayTao))}</p>
                    </div>
                </div>
            </li>`;
        }).join("") : '<li class="text-sm text-slate-500">Chưa có thông báo.</li>';
    };
    const loadManagedNotices = async () => {
        const list = root.querySelector("[data-notice-list]");
        try {
            const notices = await fetchJson("/api/admin/notifications");
            if (!Array.isArray(notices)) throw new Error("Dữ liệu thông báo không hợp lệ.");
            if (root.isConnected) renderManagedNotices(notices);
        } catch (error) {
            if (error.name !== "AbortError" && root.isConnected) list.textContent = error.message || "Không thể tải thông báo.";
        }
    };
    const loadPaymentAnnouncements = async () => {
        const list = root.querySelector("[data-payment-announcements]");
        try {
            const [payments, requests] = await Promise.all([
                fetchJson("/api/payments/history"),
                fetchJson("/api/requests")
            ]);
            if (!root.isConnected) return;
            if (!Array.isArray(payments)) throw new Error("Dữ liệu thanh toán không hợp lệ.");
            if (!Array.isArray(requests)) throw new Error("Dữ liệu yêu cầu sinh viên không hợp lệ.");
            const successful = payments.filter(payment => payment.TrangThai === "SUCCESS");
            const entries = [
                ...successful.map(payment => ({
                    kind: "payment",
                    date: payment.NgayThanhToan || payment.NgayTao || "",
                    html: `<button type="button" data-payment-announcement="${escapeHtml(payment.MaGiaoDich || "")}"
                        aria-label="Xem chi tiết thanh toán của ${escapeHtml(payment.HoTen)}"
                        class="home-payment-announcement block w-full cursor-pointer rounded-xl border-y border-r border-l-4 border-slate-200 border-l-emerald-400 bg-emerald-50/40 p-4 text-left transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                        <p class="font-bold text-slate-900 text-sm">${escapeHtml(payment.HoTen)} đã thanh toán ${escapeHtml(payment.TenKhoan)}</p>
                        <p class="mt-1 text-xs text-slate-500">Hóa đơn ${escapeHtml(payment.MaHoaDon || "—")} · ${payment.SoTien !== null && payment.SoTien !== undefined && payment.SoTien !== "" && Number.isFinite(Number(payment.SoTien)) ? `${Number(payment.SoTien).toLocaleString("vi-VN")} ₫` : "—"} · ${escapeHtml(payment.PhuongThuc === "ONLINE" ? "Chuyển khoản QR" : "Tiền mặt")}</p>
                    </button>`,
                    payment
                })),
                ...requests.map(request => ({
                    kind: "request",
                    date: request.NgayTao || "",
                    html: `<button type="button" data-request-announcement="${escapeHtml(request.MaYeuCau)}"
                        aria-label="Mở xử lý yêu cầu ${escapeHtml(request.MaYeuCau)} của ${escapeHtml(request.HoTen)}"
                        class="home-request-announcement block w-full cursor-pointer rounded-xl border-y border-r border-l-4 border-amber-200 border-l-amber-600 bg-amber-50 p-4 text-left transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">
                        <p class="flex items-center gap-2 font-bold text-amber-950 text-sm"><i class="fa-solid ${requestIcon(request.Loai)}" aria-hidden="true"></i><span>Yêu cầu · ${escapeHtml(request.Loai || "Yêu cầu sinh viên")}</span></p>
                        <p class="mt-1 text-sm text-slate-900">${escapeHtml(request.HoTen || "Sinh viên")} · ${escapeHtml(request.TenPhong || "Chưa xếp phòng")}</p>
                        <p class="mt-1 text-xs text-slate-600">${escapeHtml(window.AdminWorkflowUtils.dateTime(request.NgayTao))}</p>
                    </button>`,
                    request
                }))
            ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
            list.innerHTML = entries.length ? entries.map(entry => entry.html).join("")
                : '<p class="text-sm text-slate-500">Chưa có thanh toán hoặc yêu cầu mới.</p>';
            list.addEventListener("click", event => {
                const paymentButton = event.target.closest("[data-payment-announcement]");
                if (paymentButton) {
                    const payment = successful.find(item => String(item.MaGiaoDich || "") === paymentButton.dataset.paymentAnnouncement);
                    if (payment) openPaymentAnnouncementDetails(payment);
                    return;
                }
                const requestButton = event.target.closest("[data-request-announcement]");
                if (!requestButton) return;
                window.pendingAdminRequestId = requestButton.dataset.requestAnnouncement;
                const menuItem = [...document.querySelectorAll(".nav-item")]
                    .find(item => item.textContent.includes("Duyệt") && item.textContent.includes("Kiểm soát"));
                window.switchPage?.("Duyet & Kiem soat", menuItem);
            }, { signal: controller.signal });
        } catch (error) {
            if (error.name !== "AbortError" && root.isConnected) list.textContent = error.message || "Không thể tải giao dịch.";
        }
    };
    const requestIcon = type => ({
        "Gia hạn hợp đồng": "fa-calendar-plus",
        "Báo hỏng thiết bị": "fa-screwdriver-wrench",
        "Yêu cầu khác": "fa-circle-question"
    })[type] || "fa-clipboard-question";
    const openPaymentAnnouncementDetails = payment => {
        const display = value => value === null || value === undefined || String(value).trim() === "" ? "—" : String(value);
        const formatDate = value => window.AdminWorkflowUtils.dateTime(value);
        const amount = Number(payment.SoTien);
        const formatAmount = payment.SoTien !== null && payment.SoTien !== undefined && payment.SoTien !== ""
            && Number.isFinite(amount)
            ? `${amount.toLocaleString("vi-VN")} ₫`
            : "—";
        const status = window.AdminWorkflowUtils.displayLabel(payment.TrangThai);
        const fields = [
            ["Tên sinh viên", payment.HoTen],
            ["Số CCCD", window.AdminWorkflowUtils.maskStudentId(payment.MaSinhVien)],
            ["Mã hóa đơn", payment.MaHoaDon],
            ["Phòng", payment.TenPhong],
            ["Tháng/năm hóa đơn", payment.ThangHoaDon && payment.NamHoaDon
                ? `${payment.ThangHoaDon}/${payment.NamHoaDon}`
                : "—"],
            ["Hạng mục thanh toán", payment.TenKhoan],
            ["Số tiền", formatAmount],
            ["Phương thức thanh toán", window.AdminWorkflowUtils.paymentMethodLabel(payment.PhuongThuc)],
            ["Thời điểm thanh toán", formatDate(payment.NgayThanhToan || payment.NgayTao)],
            ["Trạng thái", status],
            ["Mã giao dịch", payment.MaGiaoDich],
            ["Mã tham chiếu", window.AdminWorkflowUtils.maskPaymentReference(payment.MaThamChieuNgoai)],
            ["Người xác nhận", payment.TenNguoiXacNhan || payment.XacNhanBoi]
        ];
        const invoiceId = display(payment.MaHoaDon);
        const dialog = document.createElement("dialog");
        dialog.className = "m-auto w-[min(640px,95vw)] max-h-[85vh] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/50";
        dialog.innerHTML = `
            <section class="overflow-hidden rounded-2xl bg-white">
                <header class="flex items-center justify-between border-b px-6 py-4">
                    <div>
                        <h2 class="text-xl font-bold text-slate-900">Chi tiết thanh toán</h2>
                        <p class="mt-1 text-sm text-slate-500">Hóa đơn ${escapeHtml(invoiceId)}</p>
                    </div>
                    <button type="button" data-payment-detail-close aria-label="Đóng"
                        class="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">×</button>
                </header>
                <dl class="grid max-h-[60vh] grid-cols-1 gap-x-6 gap-y-4 overflow-y-auto p-6 sm:grid-cols-2">
                    ${fields.map(([label, value]) => `
                        <div class="min-w-0">
                            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(label)}</dt>
                            <dd class="mt-1 break-words text-sm font-medium text-slate-900">${escapeHtml(display(value))}</dd>
                        </div>`).join("")}
                </dl>
                <footer class="flex justify-end gap-3 border-t bg-slate-50 px-6 py-4">
                    <button type="button" data-payment-detail-close class="rounded-lg border px-4 py-2 font-semibold text-slate-700 hover:bg-white">Đóng</button>
                    ${display(payment.MaHoaDon) !== "—" ? `<button type="button" data-view-invoice="${escapeHtml(encodeURIComponent(invoiceId))}"
                        class="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">Xem hóa đơn</button>` : ""}
                </footer>
            </section>`;
        document.body.append(dialog);
        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
            const closeButton = event.target.closest("[data-payment-detail-close]");
            if (closeButton) dialog.close();
            const invoiceButton = event.target.closest("[data-view-invoice]");
            if (invoiceButton) {
                const menuItem = Array.from(document.querySelectorAll(".nav-item"))
                    .find(item => item.textContent.toLowerCase().includes("hóa đơn"));
                dialog.close();
                if (menuItem && typeof switchPage === "function") {
                    const id = decodeURIComponent(invoiceButton.dataset.viewInvoice);
                    switchPage("Hoa Don", menuItem);
                    if (typeof openPrintModal === "function") openPrintModal(id);
                }
            }
        });
        dialog.addEventListener("close", () => dialog.remove(), { once: true });
        dialog.showModal();
    };
    const setFormStatus = (form, message, isError = false) => {
        const status = form.matches("[data-rule-create], [data-rule-edit]")
            ? root.querySelector("[data-rule-status]")
            : form.querySelector("[data-contact-status]");
        if (status) {
            showStatus(status, message, isError);
        }
    };
    root.addEventListener("input", event => {
        const input = event.target.closest("[data-rule-content]");
        if (!input) return;
        const rule = rulesDraft.find(item => item.key === Number(input.dataset.ruleContent));
        if (rule) rule.content = input.value;
    }, { signal: controller.signal });
    root.addEventListener("change", event => {
        const scope = event.target.closest('[name="PhamViNhan"]');
        if (!scope) return;
        const form = scope.form;
        form.elements.TenPhong.hidden = scope.value !== "PHONG";
        form.elements.TenPhong.required = scope.value === "PHONG";
        form.elements.TenPhong.classList.toggle("hidden", scope.value !== "PHONG");
        form.querySelector("[data-notice-student-field]").classList.toggle("hidden", scope.value !== "SINH_VIEN");
        form.elements.MaSinhVien.required = scope.value === "SINH_VIEN";
    }, { signal: controller.signal });
    root.addEventListener("submit", async event => {
        const form = event.target.closest("[data-rule-create], [data-contact-form], [data-notice-form]");
        if (!form) return;
        event.preventDefault();
        if (form.matches("[data-rule-create]")) {
            if (!editingRules || !form.reportValidity()) return;
            rulesDraft.push({
                key: nextRuleKey++,
                id: null,
                originalContent: "",
                content: form.elements.NoiDung.value.trim(),
                deleted: false
            });
            form.reset();
            renderRules();
            return;
        }
        if (form.matches("[data-notice-form]")) {
            if (form.dataset.submitting || !form.reportValidity()) return;
            if (!window.confirm("Gửi thông báo này đến đối tượng đã chọn?")) return;
            const submit = form.querySelector('[type="submit"]');
            form.dataset.submitting = "true";
            submit.disabled = true;
            form.querySelector("[data-notice-status]").textContent = "Đang gửi thông báo…";
            try {
                await fetchJson("/api/admin/notifications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        TieuDe: form.elements.TieuDe.value.trim(),
                        NoiDung: form.elements.NoiDung.value.trim(),
                        PhamViNhan: form.elements.PhamViNhan.value,
                        TenPhong: form.elements.PhamViNhan.value === "PHONG" ? form.elements.TenPhong.value.trim() : null,
                        MaSinhVien: form.elements.PhamViNhan.value === "SINH_VIEN" ? form.elements.MaSinhVien.value.trim() : null
                    })
                });
                form.reset();
                form.elements.TenPhong.hidden = true;
                form.elements.TenPhong.required = false;
                form.elements.TenPhong.classList.add("hidden");
                form.querySelector("[data-notice-student-field]").classList.add("hidden");
                form.elements.MaSinhVien.required = false;
                showStatus(form.querySelector("[data-notice-status]"), "Đã gửi thông báo.");
                await loadManagedNotices();
            } catch (error) {
                showStatus(form.querySelector("[data-notice-status]"), error.message || "Không thể gửi thông báo.", true);
            } finally {
                delete form.dataset.submitting;
                submit.disabled = false;
            }
            return;
        }
        if (!editingContact || form.dataset.submitting) return;
        form.dataset.submitting = "true";
        form.querySelectorAll("button").forEach(button => { button.disabled = true; });
        try {
            await fetchJson("/api/lien-he", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    DienThoai: form.elements.DienThoai.value,
                    Email: form.elements.Email.value,
                    GioLamViec: form.elements.GioLamViec.value
                })
            });
            originalContact = {
                DienThoai: form.elements.DienThoai.value,
                Email: form.elements.Email.value,
                GioLamViec: form.elements.GioLamViec.value
            };
            for (const key of ["DienThoai", "Email", "GioLamViec"]) {
                form.querySelector(`[data-contact-display="${key}"]`).textContent = originalContact[key] || "Chưa cập nhật";
            }
            setContactEditing(false);
            setFormStatus(form, "Đã lưu thông tin liên hệ.");
        } catch (error) {
            setFormStatus(form, error.message || "Không thể lưu thông tin liên hệ.", true);
        } finally {
            delete form.dataset.submitting;
            form.querySelectorAll("button").forEach(button => { button.disabled = false; });
        }
    }, { signal: controller.signal });
    root.addEventListener("click", async event => {
        const startRuleEdit = event.target.closest("[data-rule-edit-start]");
        if (startRuleEdit) {
            showStatus(root.querySelector("[data-rule-status]"), "");
            setRulesEditing(true);
            return;
        }
        const cancelRuleEdit = event.target.closest("[data-rule-cancel]");
        if (cancelRuleEdit) {
            setRulesEditing(false);
            await loadRules();
            showStatus(root.querySelector("[data-rule-status]"), "Đã hủy thay đổi nội quy.");
            return;
        }
        const saveRuleEdit = event.target.closest("[data-rule-save]");
        if (saveRuleEdit && !saveRuleEdit.disabled) {
            await saveRules();
            return;
        }
        const deleteRule = event.target.closest("[data-rule-delete]");
        if (deleteRule) {
            const rule = rulesDraft.find(item => item.key === Number(deleteRule.dataset.ruleDelete));
            if (rule) {
                rule.deleted = true;
                renderRules();
            }
            return;
        }
        const undoRuleDelete = event.target.closest("[data-rule-undo]");
        if (undoRuleDelete) {
            const rule = rulesDraft.find(item => item.key === Number(undoRuleDelete.dataset.ruleUndo));
            if (rule) {
                rule.deleted = false;
                renderRules();
            }
            return;
        }
        const startContactEdit = event.target.closest("[data-contact-edit-start]");
        if (startContactEdit) {
            showStatus(root.querySelector("[data-contact-status]"), "");
            setContactEditing(true);
            return;
        }
        const cancelContactEdit = event.target.closest("[data-contact-cancel]");
        if (cancelContactEdit) {
            if (originalContact) {
                for (const key of ["DienThoai", "Email", "GioLamViec"]) {
                    root.querySelector("[data-contact-form]").elements[key].value = originalContact[key];
                }
            }
            setContactEditing(false);
            setFormStatus(root.querySelector("[data-contact-form]"), "Đã hủy thay đổi thông tin liên hệ.");
            return;
        }
        const retry = event.target.closest("[data-contact-retry]");
        if (retry && !retry.disabled) {
            await loadContact();
            return;
        }
        const deleteNotice = event.target.closest("[data-notice-delete]");
        if (deleteNotice && !deleteNotice.disabled) {
            if (!window.confirm("Ẩn thông báo này khỏi danh sách của sinh viên?")) return;
            deleteNotice.disabled = true;
            try {
                await fetchJson(`/api/admin/notifications/${encodeURIComponent(deleteNotice.dataset.noticeDelete)}`, { method: "DELETE" });
                await loadManagedNotices();
            } catch (error) {
                deleteNotice.disabled = false;
                showStatus(root.querySelector("[data-notice-status]"), error.message || "Không thể ẩn thông báo.", true);
            }
        }
    }, { signal: controller.signal });
    loadRules();
    loadContact();
    loadPaymentAnnouncements();
    loadManagedNotices();
    const numeric = value => {
        if (value === null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Invalid statistic');
        return Number(value);
    };
    const array = value => { if (!Array.isArray(value)) throw new Error('Invalid list'); return value; };
    const configs = [
        ['rooms', '/api/Phong', data => array(data).length],
        ['students', '/api/sinhvien/thongke', data => numeric(data.tongSinhVien)],
        ['contracts', '/api/HopDong', data => {
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            return array(data).filter(contract => {
                const end = String(contract.NgayKetThuc || '').slice(0, 10);
                const start = contract.NgayBatDau ? String(contract.NgayBatDau).slice(0, 10) : today;
                return start <= today && end >= today && !String(contract.TrangThaiHopDong || '').toLowerCase().includes('kết thúc');
            }).length;
        }],
        ['revenue', `/api/doanhthu/${now.getFullYear()}`, data => numeric(array(data.phong)[now.getMonth()]) + numeric(array(data.dienNuoc)[now.getMonth()])]
    ];
    configs.forEach(async ([key, path, select]) => {
        const status = root.querySelector(`[data-home-status="${key}"]`);
        try {
            const response = await ApiClient.fetch(`${BASE_URL}${path}`, { signal: controller.signal });
            if (!response.ok) throw new Error('Statistic unavailable');
            const value = select(await response.json());
            if (!root.isConnected) return;
            root.querySelector(`[data-home-value="${key}"]`).textContent = key === 'revenue' ? value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }) : value.toLocaleString('vi-VN');
            status.textContent = key === 'revenue' ? `Tháng ${now.getMonth() + 1}/${now.getFullYear()}` : 'Dữ liệu hệ thống';
        } catch (error) {
            if (error.name !== 'AbortError' && root.isConnected) status.textContent = error.message || 'Chưa tải được dữ liệu';
        }
    });
}
