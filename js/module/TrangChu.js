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

function renderTrangChuModule() {
    const main = document.getElementById("main-content");

    // Ẩn header và nav, bỏ padding main để banner full màn hình
    document.querySelector("header").style.display = "none";
    document.getElementById("main-nav").style.display = "none";
    main.classList.remove("p-6");

    // Cho main tự scroll, ẩn scrollbar trình duyệt
    main.style.overflowY = 'scroll';
    main.style.height = '100vh';

    const announcementsHTML = mockHomeData.announcements.map(a => {
        const typeStyle  = a.type === "urgent"  ? "border-l-4 border-red-500 bg-red-50/60"
                         : a.type === "warning" ? "border-l-4 border-orange-400 bg-orange-50/60"
                                                : "border-l-4 border-blue-400 bg-blue-50/40";
        const badgeStyle = a.type === "urgent"  ? "bg-red-100 text-red-600"
                         : a.type === "warning" ? "bg-orange-100 text-orange-600"
                                                : "bg-blue-100 text-blue-600";
        const badgeLabel = a.type === "urgent" ? "Khẩn" : a.type === "warning" ? "Lưu ý" : "Thông báo";
        return `
        <div class="p-4 rounded-xl ${typeStyle} transition-transform hover:translate-x-1">
            <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold uppercase px-2 py-0.5 rounded ${badgeStyle}">${badgeLabel}</span>
                <span class="text-[11px] text-gray-400">${a.date}</span>
            </div>
            <p class="font-bold text-gray-800 text-sm mt-1">${a.title}</p>
            <p class="text-gray-500 text-xs mt-1 leading-relaxed">${a.content}</p>
        </div>`;
    }).join("");

    const valuesHTML = mockHomeData.mission.values.map(v => `
        <div class="p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition-all duration-300 text-center group">
            <div class="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <i class="fa-solid ${v.icon} text-xl"></i>
            </div>
            <h4 class="font-bold text-gray-800 text-base mb-2">${v.title}</h4>
            <p class="text-xs text-gray-500 leading-relaxed">${v.detail}</p>
        </div>
    `).join("");

    const documentsHTML = mockHomeData.documents.map(d => `
        <a href="files/${d.file}" download="${d.file}"
           class="flex justify-between items-center p-3 mb-2 rounded-lg hover:bg-blue-50 border-b border-gray-100 transition-all group">
            <div class="flex items-center gap-3">
                <div class="text-blue-600"><i class="fa-solid ${d.icon}"></i></div>
                <span class="text-gray-700 text-sm font-medium group-hover:text-blue-700">${d.label}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">${d.tag}</span>
                <i class="fa-solid fa-download text-gray-300 group-hover:text-blue-500 text-xs transition-colors"></i>
            </div>
        </a>
    `).join("");

    const noticesHTML = mockHomeData.notices.map(n => `
        <li class="flex items-start gap-2 text-blue-100 font-medium text-sm">
            <span class="text-yellow-400 mt-0.5">●</span> ${n}
        </li>
    `).join("");

    main.innerHTML = `
    <section id="module-trangchu" class="w-full">

        <!-- ===== HERO BANNER ===== -->
        <div class="relative overflow-hidden" style="height: 100vh; min-height: 520px; background: linear-gradient(135deg, #1e3a8a 0%, #2c4ca3 50%, #1e40af 100%);">

            <!-- Hiệu ứng hình tròn mờ trang trí -->
            <div class="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-10" style="background: radial-gradient(circle, #facc15, transparent)"></div>
            <div class="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full opacity-10" style="background: radial-gradient(circle, #60a5fa, transparent)"></div>

            <!-- Nội dung banner -->
            <div class="absolute inset-0 flex flex-col justify-center px-10 md:px-16 z-10">

                <!-- Header mini: tên tài khoản góc trên phải -->
                <div class="absolute top-0 right-0 left-0 flex justify-between items-center px-10 md:px-16 py-4">
                    <!-- Logo DMS -->
                    <div class="flex items-center gap-2">
                        <div class="bg-yellow-400 p-1 rounded">
                            <i class="fa-solid fa-hotel text-white text-base"></i>
                        </div>
                        <div>
                            <p class="text-white font-extrabold text-base leading-tight">DMS</p>
                            <p class="text-blue-300 text-[8px] uppercase tracking-wider">Dormitory Management System</p>
                        </div>
                    </div>
                    <!-- Tài khoản: clone từ admin-menu-wrapper trong HTML -->
                    <div id="banner-account-slot"></div>
                </div>

                <!-- Tiêu đề -->
                <h1 class="text-white font-black leading-[1.1]" style="font-size: clamp(3rem, 7vw, 6rem); font-family: 'Courier Prime', 'Courier New', Courier, monospace; letter-spacing: 0.04em;">
                    HỆ THỐNG<br>
                    <span style="color: #facc15;">QUẢN LÝ KTX</span>
                </h1>

                <!-- Slogan -->
                <p class="text-blue-200 mt-5 text-base md:text-lg italic font-medium max-w-lg">
                    "${mockHomeData.mission.slogan}"
                </p>

                <!-- Nút điều hướng tất cả module -->
                <div class="mt-8 flex flex-wrap gap-3">
                    <button id="btn-home-phong" onclick="_restoreLayout(); switchPage('Phong', document.querySelectorAll('.nav-item')[1])"
                        class="flex items-center gap-2 bg-white/10 hover:bg-yellow-400 hover:text-[#0a1628] backdrop-blur-sm text-white border border-white/30 px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:border-yellow-400">
                        <i class="fa-solid fa-bed"></i> Phòng ở
                    </button>
                    <button id="btn-home-sv" onclick="_restoreLayout(); switchPage('Sinh Vien', document.querySelectorAll('.nav-item')[2])"
                        class="flex items-center gap-2 bg-white/10 hover:bg-yellow-400 hover:text-[#0a1628] backdrop-blur-sm text-white border border-white/30 px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:border-yellow-400">
                        <i class="fa-solid fa-user-group"></i> Sinh viên
                    </button>
                    <button id="btn-home-hd" onclick="_restoreLayout(); switchPage('Hop Dong', document.querySelectorAll('.nav-item')[3])"
                        class="flex items-center gap-2 bg-white/10 hover:bg-yellow-400 hover:text-[#0a1628] backdrop-blur-sm text-white border border-white/30 px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:border-yellow-400">
                        <i class="fa-solid fa-file-lines"></i> Hợp đồng
                    </button>
                    <button id="btn-home-hoadon" onclick="_restoreLayout(); switchPage('Hoa Don', document.querySelectorAll('.nav-item')[4])"
                        class="flex items-center gap-2 bg-white/10 hover:bg-yellow-400 hover:text-[#0a1628] backdrop-blur-sm text-white border border-white/30 px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:border-yellow-400">
                        <i class="fa-solid fa-wallet"></i> Hóa đơn
                    </button>
                    <button id="btn-home-bc" onclick="_restoreLayout(); switchPage('Bao cao & Thong ke', document.querySelectorAll('.nav-item')[5])"
                        class="flex items-center gap-2 bg-white/10 hover:bg-yellow-400 hover:text-[#0a1628] backdrop-blur-sm text-white border border-white/30 px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:border-yellow-400">
                        <i class="fa-solid fa-chart-simple"></i> Báo cáo & Thống kê
                    </button>
                </div>
            </div>

            <!-- Scroll indicator -->
            <div id="scroll-indicator" class="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-60 transition-opacity duration-500">
                <span class="text-white text-[10px] uppercase tracking-widest">Cuộn xuống</span>
                <div class="w-5 h-8 rounded-full border-2 border-white/50 flex items-start justify-center pt-1">
                    <div class="w-1 h-2 bg-white rounded-full animate-bounce"></div>
                </div>
            </div>

            <!-- Wave bottom -->
            <div class="absolute bottom-0 left-0 w-full z-10 overflow-hidden leading-[0]">
                <svg viewBox="0 0 1440 80" preserveAspectRatio="none" class="block w-full" style="height:60px;fill:#f8fafc">
                    <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z"/>
                </svg>
            </div>
        </div>

        <!-- ===== MAIN CONTENT ===== -->
        <div class="container mx-auto px-6 py-12">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">

                <!-- LEFT: Thông báo + Sứ mệnh -->
                <div class="lg:col-span-2 space-y-10">

                    <!-- Thông báo -->
                    <div>
                        <div class="flex items-center mb-5 border-b-2 border-blue-600">
                            <h3 class="bg-blue-600 text-white px-5 py-2 uppercase font-extrabold text-xs tracking-wider flex items-center gap-2">
                                <i class="fa-solid fa-bullhorn"></i> Thông báo mới nhất
                            </h3>
                        </div>
                        <div class="space-y-3">${announcementsHTML}</div>
                    </div>

                    <!-- Sứ mệnh -->
                    <div>
                        <div class="flex items-center mb-5 border-b-2 border-indigo-500">
                            <h3 class="bg-indigo-500 text-white px-5 py-2 uppercase font-extrabold text-xs tracking-wider flex items-center gap-2">
                                <i class="fa-solid fa-star"></i> Sứ mệnh & Tầm nhìn
                            </h3>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">${valuesHTML}</div>
                    </div>
                </div>

                <!-- RIGHT: Lưu ý + Liên hệ + Văn bản -->
                <div class="space-y-6">

                    <!-- Lưu ý nội quy -->
                    <div class="bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
                        <div class="relative z-10">
                            <h4 class="font-black text-base mb-4 flex items-center gap-2">
                                <i class="fa-solid fa-circle-info text-yellow-400"></i>
                                Lưu ý nội quy
                            </h4>
                            <ul class="space-y-3">${noticesHTML}</ul>
                        </div>
                        <i class="fa-solid fa-bookmark absolute -right-3 -bottom-3 text-white/10 text-[80px] rotate-12 group-hover:rotate-0 transition-transform duration-500"></i>
                    </div>

                    <!-- Liên hệ hỗ trợ -->
                    <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-md">
                        <h4 class="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-headset text-blue-600"></i> Liên hệ hỗ trợ
                        </h4>
                        <div class="space-y-3">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                                    <i class="fa-solid fa-phone text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase font-bold">Điện thoại</p>
                                    <p class="font-semibold text-gray-800 text-sm">023 6384 2288</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                                    <i class="fa-solid fa-envelope text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase font-bold">Email</p>
                                    <p class="font-semibold text-gray-800 text-sm">ktx@udn.vn</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                                    <i class="fa-solid fa-clock text-xs"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase font-bold">Giờ làm việc</p>
                                    <p class="font-semibold text-gray-800 text-sm">T2 – T6: 7:30 – 17:00</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Văn bản – Biểu mẫu (tải file thật) -->
                    <div class="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-md">
                        <div class="bg-slate-700 text-white px-5 py-3 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                            <i class="fa-solid fa-folder-open text-yellow-400"></i> Văn bản – Biểu mẫu
                        </div>
                        <div class="p-4">
                            ${documentsHTML}
                            <p class="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
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

    // Scroll indicator
    const scrollIndicator = document.getElementById('scroll-indicator');
    let scrollTimer;
    const onScroll = () => {
        if (scrollIndicator) scrollIndicator.style.opacity = '0';
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            if (main.scrollTop < 50 && scrollIndicator) scrollIndicator.style.opacity = '0.6';
        }, 800);
    };
    main.addEventListener('scroll', onScroll);

    // Di chuyển #admin-menu-wrapper thật vào banner
    const adminWrapper = document.getElementById('admin-menu-wrapper');
    const slot = document.getElementById('banner-account-slot');
    const headerEl = document.querySelector('header');
    if (adminWrapper && slot) {
        const toggleBtn = adminWrapper.querySelector('button[onclick*="toggleAdminMenu"]');
        if (toggleBtn) {
            toggleBtn.style.color = 'white';
            const nameSpan = toggleBtn.querySelector('span');
            if (nameSpan) nameSpan.style.color = 'white';
            const chevron = toggleBtn.querySelector('i.fa-chevron-down');
            if (chevron) chevron.style.color = 'white';
        }
        slot.appendChild(adminWrapper);

        // Một _restoreLayout duy nhất xử lý tất cả
        window._restoreLayout = function () {
            main.removeEventListener('scroll', onScroll);
            // Reset admin wrapper về header
            if (toggleBtn) {
                toggleBtn.style.color = '';
                const nameSpan = toggleBtn.querySelector('span');
                if (nameSpan) nameSpan.style.color = '';
                const chevron = toggleBtn.querySelector('i.fa-chevron-down');
                if (chevron) chevron.style.color = '';
            }
            if (headerEl && adminWrapper) headerEl.appendChild(adminWrapper);
            // Reset layout
            document.querySelector("header").style.display = "";
            document.getElementById("main-nav").style.display = "";
            main.classList.add("p-6");
            main.style.overflowY = '';
            main.style.height = '';
            window._restoreLayout = null;
        };
    } else {
        // Fallback nếu không có adminWrapper
        window._restoreLayout = function () {
            main.removeEventListener('scroll', onScroll);
            document.querySelector("header").style.display = "";
            document.getElementById("main-nav").style.display = "";
            main.classList.add("p-6");
            main.style.overflowY = '';
            main.style.height = '';
            window._restoreLayout = null;
        };
    }

    // Highlight nút khi click (active state)
    document.querySelectorAll('[id^="btn-home-"]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[id^="btn-home-"]').forEach(b => {
                b.classList.remove('bg-yellow-400', 'text-[#0a1628]', 'border-yellow-400');
                b.classList.add('bg-white/10', 'text-white', 'border-white/30');
            });
            btn.classList.add('bg-yellow-400', 'text-[#0a1628]', 'border-yellow-400');
            btn.classList.remove('bg-white/10', 'text-white', 'border-white/30');
        });
    });
}