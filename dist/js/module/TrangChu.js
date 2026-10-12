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
                <img class="home-campus-art" src="files/campus-dashboard.svg" alt="" aria-hidden="true">
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
                            <p class="text-xs text-slate-500 mt-1">Các khoản thanh toán thành công từ dữ liệu giao dịch.</p>
                        </div>
                        <div class="space-y-3" data-payment-announcements role="status">Đang tải giao dịch…</div>
                    </div>

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
                            <p class="text-xs text-amber-100 mb-3">Nội dung dùng chung với cổng Sinh viên.</p>
                            <form data-rule-create class="flex gap-2 mb-3">
                                <input name="NoiDung" maxlength="200" required aria-label="Nội quy mới" placeholder="Nhập nội quy mới" class="min-w-0 flex-1 rounded-lg px-2 py-1 text-sm text-slate-900">
                                <button type="submit" class="rounded-lg bg-yellow-400 px-3 py-1 text-sm font-bold text-slate-900">Thêm</button>
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
                                    <input name="DienThoai" type="tel" maxlength="50" required aria-label="Điện thoại hỗ trợ" class="max-w-full border-b border-slate-200 bg-transparent py-1 font-semibold text-slate-900 text-sm">
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="fa-solid fa-envelope text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">Email</p>
                                    <input name="Email" type="email" maxlength="100" required aria-label="Email hỗ trợ" class="max-w-full border-b border-slate-200 bg-transparent py-1 font-semibold text-slate-900 text-sm">
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="fa-solid fa-clock text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">Giờ làm việc</p>
                                    <input name="GioLamViec" maxlength="200" required aria-label="Giờ làm việc" class="max-w-full border-b border-slate-200 bg-transparent py-1 font-semibold text-slate-900 text-sm">
                                    <p data-contact-status role="status" class="text-xs"></p>
                                    <div class="flex flex-wrap gap-2">
                                        <button type="submit" data-contact-submit class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Cập nhật liên hệ</button>
                                        <button type="button" data-contact-retry hidden class="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Thử tải lại</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- Văn bản – Biểu mẫu (tải file thật) -->
                    <div class="home-panel home-documents">
                        <div class="bg-slate-700 text-white px-5 py-3 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                            <i class="fa-solid fa-folder-open text-yellow-400"></i> Văn bản – Biểu mẫu
                        </div>
                        <div class="p-4">
                            <p class="text-xs text-amber-700 mb-3">Danh sách mẫu — chưa có API văn bản.</p>
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
    </section>
    `;

    const userName = window.currentUser?.fullName || "Quản lý";
    main.querySelector("[data-home-user]").textContent = userName;
    startHomeDashboard(main.querySelector("#module-trangchu"));
}

function startHomeDashboard(root) {
    const controller = new AbortController();
    const now = new Date();
    const clock = root.querySelector('[data-home-clock]');
    const updateClock = () => {
        const time = new Date();
        clock.dateTime = time.toISOString();
        clock.querySelector('[data-home-weekday]').textContent = time.toLocaleDateString('vi-VN', { weekday: 'long' });
        clock.querySelector('[data-home-date]').textContent = time.toLocaleDateString('vi-VN');
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
    const loadRules = async () => {
        const list = root.querySelector("[data-rules-list]");
        const createForm = root.querySelector("[data-rule-create]");
        createForm.querySelectorAll("input, button").forEach(control => { control.disabled = true; });
        try {
            const rules = await fetchJson("/api/noi-quy");
            if (!root.isConnected) return;
            if (!Array.isArray(rules)) throw new Error("Dữ liệu nội quy không hợp lệ.");
            list.innerHTML = rules.length ? rules.map(rule => `
                <li class="rounded-lg bg-white/10 p-2">
                    <form data-rule-edit data-id="${escapeHtml(rule.id)}" class="flex items-center gap-2">
                        <input name="NoiDung" maxlength="200" required value="${escapeHtml(rule.NoiDung)}" aria-label="Nội dung nội quy" class="min-w-0 flex-1 rounded px-2 py-1 text-sm text-slate-900">
                        <button type="submit" class="text-xs font-bold text-white underline">Lưu</button>
                        <button type="button" data-rule-delete="${escapeHtml(rule.id)}" class="text-xs font-bold text-red-100 underline">Xóa</button>
                    </form>
                </li>`).join("") : '<li class="text-sm">Chưa có nội quy.</li>';
            createForm.querySelectorAll("input, button").forEach(control => { control.disabled = false; });
        } catch (error) {
            if (error.name !== "AbortError" && root.isConnected) {
                list.textContent = error.message || "Không thể tải nội quy.";
                createForm.querySelectorAll("input, button").forEach(control => { control.disabled = false; });
            }
        }
    };
    const loadContact = async () => {
        const form = root.querySelector("[data-contact-form]");
        const status = form.querySelector("[data-contact-status]");
        const retry = form.querySelector("[data-contact-retry]");
        form.querySelectorAll("input, [data-contact-submit]").forEach(control => { control.disabled = true; });
        retry.disabled = true;
        retry.hidden = true;
        status.textContent = "Đang tải thông tin liên hệ…";
        try {
            const contact = await fetchJson("/api/lien-he");
            if (!root.isConnected) return;
            for (const key of ["DienThoai", "Email", "GioLamViec"]) {
                form.elements.namedItem(key).value = contact[key] || "";
            }
            status.textContent = "";
            form.querySelectorAll("input, [data-contact-submit]").forEach(control => { control.disabled = false; });
        } catch (error) {
            if (error.name !== "AbortError" && root.isConnected) {
                status.textContent = error.message || "Không thể tải thông tin liên hệ.";
                retry.disabled = false;
                retry.hidden = false;
            }
        }
    };
    const loadPaymentAnnouncements = async () => {
        const list = root.querySelector("[data-payment-announcements]");
        try {
            const payments = await fetchJson("/api/payments/history");
            if (!root.isConnected) return;
            if (!Array.isArray(payments)) throw new Error("Dữ liệu thanh toán không hợp lệ.");
            const successful = payments.filter(payment => payment.TrangThai === "SUCCESS").slice(0, 5);
            list.innerHTML = successful.length ? successful.map(payment => `
                <div class="rounded-xl border-l-4 border-emerald-400 bg-emerald-50/40 p-4">
                    <p class="font-bold text-slate-900 text-sm">${escapeHtml(payment.HoTen)} đã thanh toán ${escapeHtml(payment.TenKhoan)}</p>
                    <p class="mt-1 text-xs text-slate-500">Hóa đơn ${escapeHtml(payment.MaHoaDon)} · ${Number(payment.SoTien || 0).toLocaleString("vi-VN")} ₫ · ${escapeHtml(payment.PhuongThuc === "ONLINE" ? "Chuyển khoản" : "Tiền mặt")}</p>
                </div>`).join("") : '<p class="text-sm text-slate-500">Chưa có khoản thanh toán thành công.</p>';
        } catch (error) {
            if (error.name !== "AbortError" && root.isConnected) list.textContent = error.message || "Không thể tải giao dịch.";
        }
    };
    const setFormStatus = (form, message, isError = false) => {
        const status = form.matches("[data-rule-create], [data-rule-edit]")
            ? root.querySelector("[data-rule-status]")
            : form.querySelector("[data-contact-status]");
        if (status) {
            status.textContent = message;
            status.classList.toggle("text-red-600", isError);
        }
    };
    root.addEventListener("submit", async event => {
        const form = event.target.closest("[data-rule-create], [data-rule-edit], [data-contact-form]");
        if (!form || form.dataset.submitting) return;
        event.preventDefault();
        form.dataset.submitting = "true";
        form.querySelectorAll("button").forEach(button => { button.disabled = true; });
        try {
            if (form.matches("[data-rule-create]")) {
                await fetchJson("/api/noi-quy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ NoiDung: form.elements.NoiDung.value })
                });
                form.reset();
                setFormStatus(form, "Đã thêm nội quy.");
                await loadRules();
            } else if (form.matches("[data-rule-edit]")) {
                await fetchJson(`/api/noi-quy/${encodeURIComponent(form.dataset.id)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ NoiDung: form.elements.NoiDung.value })
                });
                setFormStatus(root.querySelector("[data-rule-create]"), "Đã cập nhật nội quy.");
                await loadRules();
            } else {
                await fetchJson("/api/lien-he", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        DienThoai: form.elements.DienThoai.value,
                        Email: form.elements.Email.value,
                        GioLamViec: form.elements.GioLamViec.value
                    })
                });
                setFormStatus(form, "Đã cập nhật thông tin liên hệ.");
            }
        } catch (error) {
            setFormStatus(form.matches("[data-rule-edit]") ? root.querySelector("[data-rule-create]") : form, error.message || "Không thể lưu dữ liệu.", true);
        } finally {
            delete form.dataset.submitting;
            form.querySelectorAll("button").forEach(button => { button.disabled = false; });
        }
    }, { signal: controller.signal });
    root.addEventListener("click", async event => {
        const retry = event.target.closest("[data-contact-retry]");
        if (retry && !retry.disabled) {
            await loadContact();
            return;
        }
        const button = event.target.closest("[data-rule-delete]");
        if (!button || button.disabled) return;
        if (!window.confirm("Bạn có chắc chắn muốn xóa nội quy này?")) return;
        button.disabled = true;
        try {
            await fetchJson(`/api/noi-quy/${encodeURIComponent(button.dataset.ruleDelete)}`, { method: "DELETE" });
            setFormStatus(root.querySelector("[data-rule-create]"), "Đã xóa nội quy.");
            await loadRules();
        } catch (error) {
            setFormStatus(root.querySelector("[data-rule-create]"), error.message || "Không thể xóa nội quy.", true);
            button.disabled = false;
        }
    }, { signal: controller.signal });
    loadRules();
    loadContact();
    loadPaymentAnnouncements();
    const numeric = value => {
        if (value === null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Invalid statistic');
        return Number(value);
    };
    const array = value => { if (!Array.isArray(value)) throw new Error('Invalid list'); return value; };
    const configs = [
        ['rooms', '/api/Phong', data => array(data).length],
        ['students', '/api/sinhvien/thongke', data => numeric(data.tongSinhVien)],
        ['contracts', '/api/HopDong', data => {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return array(data).filter(contract => {
                const end = new Date(String(contract.NgayKetThuc || '').split('T')[0] + 'T00:00:00');
                const start = contract.NgayBatDau ? new Date(String(contract.NgayBatDau).split('T')[0] + 'T00:00:00') : today;
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
