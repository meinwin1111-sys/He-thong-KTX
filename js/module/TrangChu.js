/**
 * ==========================================
 * MODULE: TRANG CHỦ
 * ==========================================
 */

const mockHomeData = {
    announcements: [
        {
            date: "10/04/2026",
            title: "Kiểm tra phòng định kỳ Quý II/2026",
            content: "Ban quản lý sẽ tiến hành kiểm tra toàn bộ phòng ở khu A và khu B vào ngày 15/04/2026.",
            type: "urgent",
        },
        {
            date: "08/04/2026",
            title: "Bảo trì hệ thống điện tầng 3 – Khu B",
            content: "Hệ thống điện tầng 3 khu B sẽ tạm ngừng từ 8:00 – 12:00 ngày 12/04/2026.",
            type: "warning",
        },
        {
            date: "05/04/2026",
            title: "Thông báo nộp phí ký túc xá tháng 4/2026",
            content: "Sinh viên vui lòng hoàn tất nộp phí trước ngày 20/04/2026 để tránh phát sinh phí trễ hạn.",
            type: "normal",
        },
        {
            date: "01/04/2026",
            title: "Cập nhật nội quy ký túc xá năm học 2025–2026",
            content: "Nội quy mới đã được ban hành, sinh viên vui lòng đọc kỹ và ký xác nhận tại văn phòng.",
            type: "normal",
        },
    ],
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
    notices: [
        "Giờ giới nghiêm: 23:00",
        "Không nấu ăn tại phòng",
        "Giữ vệ sinh khu vực chung",
        "Xuất trình thẻ sinh viên khi ra vào",
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

    const announcementsHTML = mockHomeData.announcements.map(a => {
        const typeStyle  = a.type === "urgent"  ? "border-l-4 border-red-500 bg-red-50/60"
                         : a.type === "warning" ? "border-l-4 border-orange-400 bg-orange-50/60"
                                                : "border-l-4 border-emerald-400 bg-emerald-50/40";
        const badgeStyle = a.type === "urgent"  ? "bg-red-100 text-red-600"
                         : a.type === "warning" ? "bg-orange-100 text-orange-600"
                                                : "bg-emerald-100 text-emerald-600";
        const badgeLabel = a.type === "urgent" ? "Khẩn" : a.type === "warning" ? "Lưu ý" : "Thông báo";
        return `
        <div class="p-4 rounded-xl ${typeStyle} transition-transform hover:translate-x-1">
            <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold uppercase px-2 py-0.5 rounded ${badgeStyle}">${badgeLabel}</span>
                <span class="text-[11px] text-slate-500">${a.date}</span>
            </div>
            <p class="font-bold text-slate-900 text-sm mt-1">${a.title}</p>
            <p class="text-slate-500 text-xs mt-1 leading-relaxed">${a.content}</p>
        </div>`;
    }).join("");

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

    const noticesHTML = mockHomeData.notices.map(n => `
        <li class="flex items-start gap-2 text-slate-600 font-medium text-sm">
            <span class="text-yellow-400 mt-0.5">●</span> ${n}
        </li>
    `).join("");

    main.innerHTML = `
    <section id="module-trangchu" class="w-full">

        <!-- ===== MAIN CONTENT ===== -->
        <div class="home-dashboard">
            <div class="home-welcome">
                <div class="home-greeting"><div class="home-greeting-row"><span class="home-wave" aria-hidden="true">👋</span><div><h2>Xin chào, Quản trị viên</h2><p>Chào mừng bạn trở lại hệ thống Quản lý Ký Túc Xá</p></div></div><p class="home-quote">“Quản lý hiệu quả – Môi trường sống tốt hơn cho sinh viên.”</p></div>
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
                        </div>
                        <div class="space-y-3">${announcementsHTML}</div>
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
                            <ul class="space-y-3">${noticesHTML}</ul>
                        </div>
                    </div>

                    <!-- Liên hệ hỗ trợ -->
                    <div class="home-panel">
                        <h4 class="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-headset text-emerald-600"></i> Liên hệ hỗ trợ
                        </h4>
                        <div class="space-y-3">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="fa-solid fa-phone text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">Điện thoại</p>
                                    <p class="font-semibold text-slate-900 text-sm">023 6384 2288</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="fa-solid fa-envelope text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">Email</p>
                                    <p class="font-semibold text-slate-900 text-sm">ktx@udn.vn</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="fa-solid fa-clock text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">Giờ làm việc</p>
                                    <p class="font-semibold text-slate-900 text-sm">T2 – T6: 7:30 – 17:00</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Văn bản – Biểu mẫu (tải file thật) -->
                    <div class="home-panel home-documents">
                        <div class="bg-slate-700 text-white px-5 py-3 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                            <i class="fa-solid fa-folder-open text-yellow-400"></i> Văn bản – Biểu mẫu
                        </div>
                        <div class="p-4">
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
            const response = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
            if (!response.ok) throw new Error('Statistic unavailable');
            const value = select(await response.json());
            if (!root.isConnected) return;
            root.querySelector(`[data-home-value="${key}"]`).textContent = key === 'revenue' ? value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }) : value.toLocaleString('vi-VN');
            status.textContent = key === 'revenue' ? `Tháng ${now.getMonth() + 1}/${now.getFullYear()}` : 'Dữ liệu hệ thống';
        } catch (error) {
            if (error.name !== 'AbortError' && root.isConnected) status.textContent = 'Chưa tải được dữ liệu';
        }
    });
}
