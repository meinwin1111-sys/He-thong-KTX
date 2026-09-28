let rawHopDong = []; // Dữ liệu gốc
let filteredHopDong = []; // Dữ liệu sau khi lọc/tab
let currentPageHD = 1; // Trang hiện tại
const rowsPerPageHD = 10; // Số dòng mỗi trang
let historyPage = 1;
const historyPageSize = 5;
let currentTab = "all"; //
let lastUpdatedHD = null; //
let currentEndId = null; // ID hợp đồng đang kết thúc
function renderHopDongModule() {
    document.getElementById("main-content").innerHTML = `
<section class="p-6">


<!-- HEADER -->
<div class="flex justify-between items-start mb-6">
    <div>
        <h2 class="text-3xl font-bold text-slate-900">Quản lý Hợp đồng</h2>
        <p class="text-slate-500 mt-1">
            <span class="hover:text-emerald-600 cursor-pointer" onclick="switchPage('Trang Chu', document.querySelectorAll('.nav-item')[0])">Trang chủ</span>
            <span class="mx-1">></span>
            <span>Hợp đồng</span>
        </p>
    </div>


    <div class="flex gap-3">
        <button onclick="openHistoryModal()"
        class="px-4 py-2 bg-slate-100 rounded-lg font-medium hover:bg-slate-200">
            <i class="fa-solid fa-clock-rotate-left"></i> Lịch sử
        </button>


        <button onclick="openAddHopDongModal()"
            class="bg-[#059669] text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all border-none shadow-lg">
                <i class="fa-solid fa-circle-plus"></i> Tạo hợp đồng
        </button>
    </div>
</div>


<!-- KPI -->
<div class="flex gap-4 mb-8">


    <div class="stat-card text-left cursor-pointer hover:shadow-md transition-all">
        <p class="text-xs text-slate-500 font-semibold">TỔNG HỢP ĐỒNG</p>
        <h2 class="text-3xl font-bold mt-2" id="statTotalHD">0</h2>
    </div>


    <div class="stat-card border-l-4 border-green-500 text-left cursor-pointer hover:shadow-md transition-all">
        <p class="text-xs text-slate-500 font-semibold">CÒN HIỆU LỰC</p>
        <h2 class="text-3xl font-bold text-green-500 mt-2" id="statActiveHD">0</h2>
    </div>


    <div class="stat-card border-l-4 border-orange-400 text-left cursor-pointer hover:shadow-md transition-all">
        <p class="text-xs text-slate-500 font-semibold">SẮP HẾT HẠN</p>
        <h2 class="text-3xl font-bold text-orange-500 mt-2" id="statWarningHD">0</h2>
    </div>


    <div class="stat-card border-l-4 border-red-500 text-left cursor-pointer hover:shadow-md transition-all">
        <p class="text-xs text-slate-500 font-semibold">ĐÃ KẾT THÚC</p>
        <h2 class="text-3xl font-bold text-red-500 mt-2" id="statExpiredHD">0</h2>
    </div>


</div>


<!-- TAB -->
<div class="flex mb-6 border-b border-slate-200">
    <button id="tab-all" onclick="filterHopDong('all')"
        class="tab-item active-tab py-2 px-6 font-semibold text-slate-500 transition-all">
        Danh sách hợp đồng
    </button>


    <button id="tab-warning" onclick="filterHopDong('warning')"
        class="tab-item py-2 px-6 font-semibold text-slate-500 transition-all flex items-center gap-2">
        ⚠️ Sắp hết hạn
    </button>
</div>


<!-- ================= TABLE ================= -->
<div class="bg-white rounded-xl border overflow-x-auto">
<table class="min-w-[1200px] w-full">


<!-- Header bảng (render bằng JS) -->
<thead id="tableHead" class="bg-slate-50 text-slate-500 uppercase text-xs"></thead>


<!-- Body bảng (data từ API) -->
<tbody id="hopdongTableBody"></tbody>


</table>


<!-- ================= FOOTER ================= -->
<div class="px-6 py-4 flex justify-between items-center text-sm text-slate-500">
    <!-- Hiển thị số dòng -->
    <span id="showingHD"></span>
<div id="paginationHD" class="flex items-center gap-2"></div>
</div>


</div>


</section>


<!-- ================= MODAL THÊM HỢP ĐỒNG ================= -->
<div id="addHopDongModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">


<div class="bg-white w-[700px] rounded-2xl p-6 relative">


<!-- Nút đóng -->
<button onclick="closeAddHopDongModal()"
class="absolute right-5 top-4 text-slate-500 text-xl">×</button>


<h2 class="text-xl font-bold mb-6">Tạo hợp đồng lưu trú</h2>


<form id="formHopDong" class="space-y-5">


<!-- MSSV -->
<div>
    <label class="font-semibold text-slate-900">
    Mã sinh viên <span class="text-red-500">*</span>
</label>


    <!-- Khi nhập sẽ tự động tìm sinh viên -->
    <input id="mssvInput"
    oninput="handleMSSVInput()"
    class="w-full border rounded-lg px-4 py-2 mt-2"
    placeholder="Nhập MSSV">
</div>


<!-- Thông tin tự động -->
<div class="grid grid-cols-2 gap-4">
    <div>
        <label>Tên sinh viên</label>
        <input id="tenSV" disabled class="w-full border rounded-lg px-4 py-2 mt-1 bg-slate-50">
    </div>


    <div>
        <label>Phòng hiện tại</label>
        <input id="phongSV" disabled class="w-full border rounded-lg px-4 py-2 mt-1 bg-slate-50">
    </div>
</div>


<!-- Ngày -->
<div class="grid grid-cols-2 gap-4">
    <div>


        <label>Ngày bắt đầu <span class="text-red-500">*</span></label>
        <input type="date" id="startDate" class="w-full border rounded-lg px-4 py-2 mt-2">
    </div>


    <div>
        <label>Ngày kết thúc <span class="text-red-500">*</span></label>
        <input type="date" id="endDate" class="w-full border rounded-lg px-4 py-2 mt-2">
    </div>
</div>


<!-- Ghi chú -->
<div>
    <label>Ghi chú</label>
    <textarea id="ghiChu" rows="3" class="w-full border rounded-lg px-4 py-2 mt-1"></textarea>
</div>


<!-- Trạng thái mặc định -->
<div>
    <label>Trạng thái</label>
    <input value="Còn hiệu lực" disabled class="w-full border rounded-lg px-4 py-2 mt-1 bg-slate-50">
</div>


<!-- BUTTON -->
<div class="flex justify-end gap-3 pt-3 border-t">


    <!-- Lưu -->
    <button type="button" onclick="saveHopDong(event)"
    class="px-6 py-2 bg-emerald-600 text-white rounded-lg">
        Lưu
    </button>


    <!-- Hủy -->
    <button type="button" onclick="closeAddHopDongModal()"
    class="px-6 py-2 bg-slate-300 rounded-lg">
        Hủy
    </button>


</div>


</form>


</div>
</div>


<!-- ================= MODAL GIA HẠN ================= -->
<div id="extendModal" class="fixed inset-0 bg-black/40 hidden flex items-center justify-center z-50">


<div class="bg-white w-[700px] rounded-2xl p-6 relative">


<!-- đóng -->
<button onclick="closeExtend()" class="absolute right-5 top-4 text-slate-500 text-xl">×</button>


<h2 class="text-xl font-bold mb-6">Gia hạn hợp đồng</h2>


<!-- FORM -->
<div class="grid grid-cols-2 gap-4">


    <div>
        <label class="text-sm font-semibold text-slate-900">Mã hợp đồng</label>
        <input id="extendMaHD" disabled class="w-full border rounded-lg px-4 py-2 bg-slate-50">
    </div>


    <div>
        <label class="text-sm font-semibold text-slate-900">Mã sinh viên</label>
        <input id="extendMSSV" disabled class="w-full border rounded-lg px-4 py-2 bg-slate-50">
    </div>


    <div>
        <label class="text-sm font-semibold text-slate-900">Tên sinh viên</label>
        <input id="extendTen" disabled class="w-full border rounded-lg px-4 py-2 bg-slate-50">
    </div>


    <div>
        <label class="text-sm font-semibold text-slate-900">Phòng</label>
        <input id="extendPhong" disabled class="w-full border rounded-lg px-4 py-2 bg-slate-50">
    </div>


    <div>
        <label class="text-sm font-semibold text-slate-900">Ngày bắt đầu</label>
        <input id="extendStart" disabled class="w-full border rounded-lg px-4 py-2 bg-slate-50">
    </div>


    <div>
        <label class="text-sm font-semibold text-slate-900">Ngày kết thúc hiện tại</label>
        <input id="extendEnd" disabled class="w-full border rounded-lg px-4 py-2 bg-slate-50">
    </div>


</div>


<!-- ngày mới -->
<div class="mt-4">
    <label class="text-sm font-semibold text-slate-900">
    Ngày kết thúc mới <span class="text-red-500">*</span>
    </label>
    <input id="extendNewDate" type="date" class="w-full border rounded-lg px-4 py-2 mt-1">
</div>


<!-- BUTTON -->
<div class="flex justify-end gap-3 mt-6">


    <button onclick="saveExtend()"
    class="bg-emerald-600 text-white px-6 py-2 rounded-lg">
        Lưu
    </button>


    <button onclick="closeExtend()"
    class="bg-slate-300 px-6 py-2 rounded-lg">
        Hủy
    </button>


</div>


</div>
</div>
<!-- ================= MODAL KẾT THÚC ================= -->
<div id="endModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">


<div class="bg-white w-[600px] rounded-2xl p-6 relative shadow-lg">


    <!-- Close -->
    <button onclick="closeEnd()" class="absolute top-4 right-4 text-slate-500 text-xl">×</button>


    <!-- Title -->
    <h2 class="text-xl font-bold mb-1">Xác nhận kết thúc hợp đồng</h2>
    <p class="text-slate-500 text-sm mb-4">
        Bạn có chắc chắn muốn kết thúc hợp đồng này?
    </p>


    <!-- Box thông tin -->
    <div class="bg-slate-100 rounded-xl p-4 text-sm space-y-2">


        <div class="flex">
            <span class="w-32 text-slate-500">Mã HD:</span>
            <span id="endMaHD" class="font-medium"></span>
        </div>


        <div class="flex">
            <span class="w-32 text-slate-500">Sinh viên:</span>
            <span id="endSV"></span>
        </div>


        <div class="flex">
            <span class="w-32 text-slate-500">Phòng:</span>
            <span id="endPhong"></span>
        </div>


        <div class="flex">
            <span class="w-32 text-slate-500">Ngày bắt đầu:</span>
            <span id="endStart"></span>
        </div>


        <div class="flex">
            <span class="w-32 text-slate-500">Ngày kết thúc:</span>
            <span id="endEnd"></span>
        </div>


        <div class="flex">
            <span class="w-32 text-slate-500">Trạng thái:</span>
            <span id="endStatus"></span>
        </div>


    </div>


    <!-- Trạng thái thủ tục -->
    <div class="mt-4">
        <p class="text-sm font-medium mb-2">Trạng thái thủ tục:</p>


        <div class="flex gap-6 text-sm">
            <label class="flex items-center gap-2">
            <input type="radio" name="endStatusRadio" value="done" checked class="accent-red-500">
                Đã hoàn tất
            </label>


            <label class="flex items-center gap-2">
                <input type="radio" name="endStatusRadio" value="notdone" class="accent-red-500">
                Chưa hoàn tất
            </label>
        </div>
    </div>


    <!-- Button -->
    <div class="flex justify-end gap-3 mt-6">
        <button onclick="confirmEnd()" class="bg-red-500 text-white px-6 py-2 rounded-lg">
            Xác nhận
        </button>


        <button onclick="closeEnd()" class="bg-slate-300 px-6 py-2 rounded-lg">
            Hủy
        </button>
    </div>


</div>
</div>


<!-- ================= MODAL LỊCH SỬ ================= -->
<div id="historyModal" class="fixed inset-0 bg-black/40 hidden flex items-center justify-center z-50">


<div class="bg-white w-[95vw] max-w-[1400px] max-h-[90vh] rounded-2xl shadow-xl flex flex-col">


    <!-- HEADER -->
    <div class="px-6 py-4 border-b flex justify-between items-center">
        <h2 class="text-2xl font-bold text-slate-900">Lịch sử hợp đồng</h2>
        <button onclick="closeHistoryModal()"
            class="text-slate-500 text-xl hover:text-slate-500">✕</button>
    </div>


    <!-- TABLE (SCROLL) -->
    <div class="flex-1 overflow-y-auto">
        <table class="w-full text-sm">


            <thead class="bg-slate-50 text-slate-500 uppercase text-xs sticky top-0">
                <tr>
                    <th class="px-6 py-3 text-left">MÃ LS</th>
                    <th class="px-6 py-3 text-left">MÃ HD</th>
                    <th class="px-6 py-3 text-left">MSSV</th>
                    <th class="px-6 py-3 text-left">TÊN SV</th>
                    <th class="px-6 py-3 text-left">PHÒNG</th>
                    <th class="px-6 py-3 text-left">NGÀY BD</th>
                    <th class="px-6 py-3 text-left">NGÀY KT</th>
                    <th class="px-6 py-3 text-left">TRẠNG THÁI</th>
                    <th class="px-6 py-3 text-left">THAO TÁC</th>
                    <th class="px-6 py-3 text-left">THỜI ĐIỂM</th>
                </tr>
            </thead>


            <tbody id="historyTable"></tbody>


        </table>
    </div>


    <!-- FOOTER (KHÔNG SCROLL) -->
    <div class="px-6 py-4 flex justify-between items-center text-sm text-slate-500 border-t">


        <span id="historyCount"></span>


        <div class="flex items-center gap-2">
            <button onclick="prevHistoryPage()"
                class="px-3 py-1 border rounded hover:bg-slate-100">‹</button>


            <span id="historyPageInfo" class="px-3 py-1 border rounded"></span>


            <button onclick="nextHistoryPage()"
                class="px-3 py-1 border rounded hover:bg-slate-100">›</button>
        </div>


    </div>


</div>
</div>
<!-- ================= MODAL CHI TIẾT ================= -->
<div id="detailModal" class="fixed inset-0 bg-black/40 hidden flex items-center justify-center z-50">


<div class="bg-white w-[600px] rounded-2xl p-6 relative">


    <button onclick="closeDetail()" class="absolute right-5 top-4 text-slate-500 text-xl">×</button>


    <h2 class="text-xl font-bold mb-4">Chi tiết hợp đồng</h2>


    <div class="space-y-3 text-sm">


        <div><b>Mã HD:</b> <span id="dMaHD"></span></div>
        <div><b>Sinh viên:</b> <span id="dSV"></span></div>
        <div><b>Phòng:</b> <span id="dPhong"></span></div>
        <div><b>Ngày bắt đầu:</b> <span id="dStart"></span></div>
        <div><b>Ngày kết thúc:</b> <span id="dEnd"></span></div>
        <div><b>Trạng thái:</b> <span id="dStatus"></span></div>


        <!-- GHI CHÚ -->
        <div>
            <label class="font-semibold">Ghi chú</label>
            <textarea id="dGhiChu" class="w-full border rounded-lg p-2 mt-1"></textarea>
        </div>


    </div>


    <div class="flex justify-end gap-3 mt-5">
        <button onclick="saveNote()" class="bg-emerald-600 text-white px-5 py-2 rounded-lg">
            Lưu
        </button>


        <button onclick="closeDetail()" class="bg-slate-300 px-5 py-2 rounded-lg">
            Hủy
        </button>
    </div>


</div>
</div>
`;


    loadHopDong();
}


// ======================= LOAD DỮ LIỆU HỢP ĐỒNG =======================


async function loadHopDong() {
    try {
        console.log("🔄 Đang tải dữ liệu hợp đồng từ server...");


        const res = await fetch(`${BASE_URL}/api/HopDong`);
        if (!res.ok) throw new Error("Lỗi khi lấy dữ liệu từ server");


        const data = await res.json();


        rawHopDong = data.map((h) => {
            const start = h.NgayBatDau ? h.NgayBatDau.split("T")[0] : "";
            const end = h.NgayKetThuc ? h.NgayKetThuc.split("T")[0] : "";


            const today = new Date();
            today.setHours(0, 0, 0, 0);


            let endDate = end ? new Date(end) : new Date();
            endDate.setHours(0, 0, 0, 0);


            const diff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));


            // Lấy trạng thái trực tiếp từ DB, không tính toán lại
            const dbStatus = (h.TrangThaiHopDong || "").trim();
            let trangThai;

            if (dbStatus.toLowerCase().includes("kết thúc")) {
                trangThai = "Đã kết thúc";
            } else if (diff <= 7 && diff >= 0) {
                trangThai = "Sắp hết hạn";
            } else if (diff < 0) {
                trangThai = "Đã kết thúc";
            } else {
                trangThai = "Còn hiệu lực";
            }
            return {
                ...h,
                MaHD: h.MaHopDong,
                MSSV: h.MaSinhVien,
                TenSV: h.HoTen || "",
                NgayBatDau: start,
                NgayKetThuc: end,
                TrangThai: trangThai,
                ConLai: Math.max(diff, 0),
                GhiChu: h.GhiChu || "",
                TenPhong: h.TenPhong || "",
            };
        });
            // 👉 filter trước nhưng KHÔNG render
        filteredHopDong = currentTab === "warning"
            ? rawHopDong.filter(h => h.TrangThai === "Sắp hết hạn")
            : [...rawHopDong];



        filterHopDong(currentTab, true);


        if (lastUpdatedHD) {
            const index = filteredHopDong.findIndex(h => h.MaHD === lastUpdatedHD);


            if (index !== -1) {
                currentPageHD = Math.floor(index / rowsPerPageHD) + 1;
            }


            // 👉 THÊM DÒNG NÀY
            goToPageHD(currentPageHD);
        }


        updateStats();


        console.log("LoadHopDong hoàn tất. Tổng hợp đồng:", rawHopDong.length);
        console.table(
            rawHopDong.map((h) => ({ MaHD: h.MaHD, TrangThai: h.TrangThai })),
        );
    } catch (err) {
        console.error("LỖI loadHopDong:", err);
        showToast("Lỗi tải dữ liệu hợp đồng", "error");
    }
    lastUpdatedHD = null;
}


// ======================= CẬP NHẬT THỐNG KÊ =======================
function updateStats() {
    const total = rawHopDong.length;


    const expired = rawHopDong.filter(
        (h) => h.TrangThai === "Đã kết thúc",
    ).length;


    const active = rawHopDong.filter(
        (h) => h.TrangThai === "Còn hiệu lực",
    ).length;


    const warning = rawHopDong.filter(
        (h) => h.TrangThai === "Sắp hết hạn",
    ).length;


    document.getElementById("statTotalHD").innerText = total;
    document.getElementById("statActiveHD").innerText = active;
    document.getElementById("statWarningHD").innerText = warning;
    document.getElementById("statExpiredHD").innerText = expired;
}


// ======================= FILTER THEO TAB =======================
function filterHopDong(type = "all", isReload = false) {
    currentTab = type;


    const tabAll = document.getElementById("tab-all");
    const tabWarning = document.getElementById("tab-warning");


    // reset active tab
    tabAll.classList.remove("active-tab");
    tabWarning.classList.remove("active-tab");


    // 👉 chỉ reset page khi user click tab
    if (!isReload) {
        currentPageHD = 1;
    }


    // render header theo tab
    renderHeader(type);


    // ================= TAB WARNING =================
    if (type === "warning") {
        tabWarning.classList.add("active-tab");


        filteredHopDong = rawHopDong
            .filter(h => h.TrangThai === "Sắp hết hạn")
            .sort((a, b) => {
                // 1. Ưu tiên sắp hết hạn nhất
                if (a.ConLai !== b.ConLai) {
                    return a.ConLai - b.ConLai;
                }


                // 2. Nếu bằng nhau → hợp đồng mới hơn lên trước
                const numA = parseInt(a.MaHD.replace("HD", ""));
                const numB = parseInt(b.MaHD.replace("HD", ""));
                return numB - numA;
            });


        renderTableWarning();
    }


    // ================= TAB ALL =================
    else {
        tabAll.classList.add("active-tab");


        filteredHopDong = [...rawHopDong].sort((a, b) => {
            const numA = parseInt(a.MaHD.replace("HD", ""));
            const numB = parseInt(b.MaHD.replace("HD", ""));
            return numB - numA; // 🔥 giảm dần
        });


        renderTableAll();
    }
}
// ======================= RENDER HEADER TABLE =======================
function renderHeader(type) {
    const head = document.getElementById("tableHead");


    // Header cho tab warning
    if (type === "warning") {
        head.innerHTML = `
        <tr>
            <th class="px-6 py-3 text-left">MÃ HD</th>
            <th class="px-6 py-3 text-left">MSSV</th>
            <th class="px-6 py-3 text-left">HỌ TÊN SV</th>
            <th class="px-6 py-3 text-left">TÊN PHÒNG</th>
            <th class="px-6 py-3 text-left">NGÀY BẮT ĐẦU</th>
            <th class="px-6 py-3 text-left">NGÀY KẾT THÚC</th>
            <th class="px-6 py-3 text-left">TRẠNG THÁI</th>
            <th class="px-6 py-3 text-center">CÒN LẠI</th>
            <th class="px-6 py-3 text-center">THAO TÁC</th>


        </tr>
        `;
    }
    // Header cho tab all
    else {
        head.innerHTML = `
        <tr>
            <th class="px-6 py-3 text-left">MÃ HD</th>
            <th class="px-6 py-3 text-left">MSSV</th>
            <th class="px-6 py-3 text-left">HỌ TÊN SV</th>
            <th class="px-6 py-3 text-left">TÊN PHÒNG</th>
            <th class="px-6 py-3 text-left">NGÀY BẮT ĐẦU</th>
            <th class="px-6 py-3 text-left">NGÀY KẾT THÚC</th>
            <th class="px-6 py-3 text-left">TRẠNG THÁI</th>
            <th class="px-6 py-3 text-center">GHI CHÚ</th>
            <th class="px-6 py-3 text-center">THAO TÁC</th>
        </tr>
        `;
    }
}


// ======================= RENDER TABLE ALL =======================
function renderTableAll() {
    renderHopDongTable(); // dùng lại hàm chung
}


// ======================= RENDER TABLE WARNING =======================
function renderTableWarning() {
    const tbody = document.getElementById("hopdongTableBody");


    const start = (currentPageHD - 1) * rowsPerPageHD;
    const data = filteredHopDong.slice(start, start + rowsPerPageHD);


    tbody.innerHTML = data.map((h) => {


        let rowClass = "";
        if (h.ConLai <= 3) rowClass = "bg-red-50";
        else rowClass = "bg-yellow-50";


        const highlight = h.MaHD === lastUpdatedHD ? "bg-slate-200" : "";


        return `
        <tr class="${rowClass} ${highlight} border-t">


            <td class="px-6 py-4 font-semibold">${h.MaHD}</td>
            <td class="px-6 py-4">${h.MSSV}</td>
            <td class="px-6 py-4">${h.TenSV}</td>
            <td class="px-6 py-4">${h.TenPhong}</td>
            <td class="px-6 py-4">${formatDate(h.NgayBatDau)}</td>
            <td class="px-6 py-4">${formatDate(h.NgayKetThuc)}</td>


            <td class="px-6 py-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold
                    ${h.TrangThai === "Còn hiệu lực"
                        ? "bg-green-100 text-green-600"
                        : h.TrangThai === "Sắp hết hạn"
                            ? "bg-orange-100 text-orange-500"
                            : "bg-slate-200 text-slate-500"
                    }">
                    ${h.TrangThai}
                </span>
            </td>


            <td class="px-6 py-4 text-center font-bold
                ${h.ConLai <= 2 ? "text-red-500" : "text-orange-500"}">
                ${h.ConLai} ngày
            </td>


            <td class="px-6 py-4 text-center">
                <div class="flex justify-center gap-2 whitespace-nowrap">


                    <button
                        onclick="event.stopPropagation(); openExtend('${h.MaHD}')"
                        class="px-3 py-1 border rounded text-slate-500 hover:bg-slate-100 flex items-center gap-1 whitespace-nowrap"
                    >
                        <i class="fa-solid fa-rotate"></i>
                        Gia hạn
                    </button>


                    <button
                        onclick="event.stopPropagation(); openEnd('${h.MaHD}')"
                        class="px-3 py-1 border border-red-300 text-red-500 rounded hover:bg-red-50 flex items-center gap-1 whitespace-nowrap"
                    >
                        <i class="fa-solid fa-xmark"></i>
                        Kết thúc
                    </button>


                </div>
            </td>


        </tr>
        `;
    }).join("");


    document.getElementById("showingHD").innerText =
        `Hiển thị ${data.length}/${filteredHopDong.length} hợp đồng`;


    renderPaginationHD();
}


// ======================= RENDER TABLE CHUNG =======================
function renderHopDongTable() {
    const tbody = document.getElementById("hopdongTableBody");


    const start = (currentPageHD - 1) * rowsPerPageHD;
    const data = filteredHopDong.slice(start, start + rowsPerPageHD);


    tbody.innerHTML = data.map((h) => {


        const highlight = h.MaHD === lastUpdatedHD ? "bg-slate-200" : "";


        return `
        <tr
            class="border-t hover:bg-slate-50 align-top cursor-pointer ${highlight}"
            onclick="openDetail('${h.MaHD}')"
        >


            <td class="px-6 py-4 font-semibold">${h.MaHD}</td>


            <td class="px-6 py-4">${h.MSSV}</td>


            <td class="px-6 py-4 whitespace-normal break-words min-w-[180px]">
                ${h.TenSV}
            </td>


            <td class="px-6 py-4">${h.TenPhong}</td>


            <td class="px-6 py-4">${formatDate(h.NgayBatDau)}</td>


            <td class="px-6 py-4">${formatDate(h.NgayKetThuc)}</td>


            <td class="px-6 py-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold inline-block
                    ${h.TrangThai === "Còn hiệu lực"
                        ? "bg-green-100 text-green-600"
                        : h.TrangThai === "Sắp hết hạn"
                            ? "bg-orange-100 text-orange-500"
                            : "bg-slate-200 text-slate-500"
                    }">
                    ${h.TrangThai}
                </span>
            </td>


            <td class="px-6 py-4 text-slate-500 text-center whitespace-normal break-words">
                ${h.GhiChu || "-"}
            </td>


            <td class="px-6 py-4 text-center min-w-[180px]">
                ${
                    h.TrangThai === "Đã kết thúc"
                        ? `<span class="text-slate-500 italic">-</span>`
                        : `
                        <div class="flex justify-center gap-2 flex-wrap">


                            <button
                                onclick="event.stopPropagation(); openExtend('${h.MaHD}')"
                                class="px-3 py-1 border rounded text-slate-500 hover:bg-slate-100 flex items-center gap-1 whitespace-nowrap"
                            >
                                <i class="fa-solid fa-rotate"></i>
                                Gia hạn
                            </button>


                            <button
                                onclick="event.stopPropagation(); openEnd('${h.MaHD}')"
                                class="px-3 py-1 border border-red-300 text-red-500 rounded hover:bg-red-50 flex items-center gap-1 whitespace-nowrap"
                            >
                                <i class="fa-solid fa-xmark"></i>
                                Kết thúc
                            </button>


                        </div>
                    `
                }
            </td>


        </tr>
        `;
    }).join("");


    document.getElementById("showingHD").innerText =
        `Hiển thị ${start + 1}-${start + data.length}/${filteredHopDong.length} hợp đồng`;


    renderPaginationHD();
}


// ======================= PHÂN TRANG =======================
function renderPaginationHD() {
    const totalRows = filteredHopDong.length;
    const totalPages = Math.ceil(totalRows / rowsPerPageHD) || 1;


    const start = totalRows === 0 ? 0 : (currentPageHD - 1) * rowsPerPageHD + 1;
    const end = Math.min(currentPageHD * rowsPerPageHD, totalRows);


    // TEXT: Hiển thị 1-10/135
    document.getElementById("showingHD").innerText =
        `Hiển thị ${start}-${end}/${totalRows} hợp đồng`;


    // UI pagination giống phòng
    let html = `
        <button onclick="goToPageHD(${Math.max(1, currentPageHD - 1)})"
            ${currentPageHD === 1 ? "disabled" : ""}
            class="px-3 py-1 rounded bg-slate-100 text-slate-500 disabled:opacity-30">
            ‹
        </button>


        <div class="px-4 py-1 border rounded-lg">
            <span class="text-emerald-600 font-bold">${currentPageHD}</span>
            /
            <span>${totalPages}</span>
        </div>


        <button onclick="goToPageHD(${Math.min(totalPages, currentPageHD + 1)})"
            ${currentPageHD === totalPages ? "disabled" : ""}
            class="px-3 py-1 rounded bg-slate-100 text-slate-500 disabled:opacity-30">
            ›
        </button>
    `;


    document.getElementById("paginationHD").innerHTML = html;
}
// ======================= PHÂN TRANG =======================
// Hàm chuyển trang khi click nút phân trang
function goToPageHD(page) {
    currentPageHD = page;


    // kiểm tra đang ở tab nào
    const isWarning = document
        .getElementById("tab-warning")
        .classList.contains("active-tab");


    if (isWarning) {
        renderTableWarning();
    } else {
        renderHopDongTable();
    }
}


// ======================= FORMAT DATE =======================
function formatDate(dateString) {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("vi-VN");
}
// ======================= HANDLE INPUT MSSV =======================
async function handleMSSVInput() {
    const mssv = document.getElementById("mssvInput").value.trim();
    if (mssv.length < 7) return;


    const tenSVInput = document.getElementById("tenSV");
    const phongInput = document.getElementById("phongSV");


    try {
        const res = await fetch(`${BASE_URL}/api/SinhVienById/${mssv}`);
        const sv = await res.json();


        if (!sv) {
            tenSVInput.value = "";
            phongInput.value = "";
            showToast("Không tìm thấy sinh viên", "error");
            return;
        }


        if (!sv.TenPhong) {
            tenSVInput.value = sv.HoTen;
            phongInput.value = "";
            showToast("Sinh viên chưa được phân phòng", "error");
            return;
        }


        // ✅ FILL TRƯỚC
        tenSVInput.value = sv.HoTen;
        phongInput.value = sv.TenPhong;


        // ✅ CHECK SAU - chỉ cảnh báo, KHÔNG return
        const existed = rawHopDong.find(
            (h) => h.MSSV === mssv && h.TrangThai !== "Đã kết thúc",
        );
        if (existed) {
            showToast("Sinh viên đã có hợp đồng còn hiệu lực", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Lỗi khi lấy sinh viên", "error");
    }
}


// ======================= TOAST =======================
let toastTimeout;


// Hiển thị thông báo (success / error) - tạo element động, không phụ thuộc #toast
function showToast(msg, type = "success") {
    const old = document.getElementById("_hd_toast");
    if (old) old.remove();

    const el = document.createElement("div");
    el.id = "_hd_toast";
    Object.assign(el.style, {
        position: "fixed", bottom: "20px", left: "20px",
        padding: "12px 20px", borderRadius: "6px", color: "white",
        fontWeight: "500", zIndex: "9999",
        background: type === "success" ? "#04c54b" : "#ef4444",
        boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
        transition: "opacity 0.3s"
    });
    el.innerText = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}


// ======================= MODAL THÊM =======================
function openAddHopDongModal() {
    const modal = document.getElementById("addHopDongModal");


    modal.classList.remove("hidden");
    modal.classList.add("flex"); // dùng flex để center
}


function closeAddHopDongModal() {
    document.getElementById("addHopDongModal").classList.add("hidden");
}


// ======================= SAVE HỢP ĐỒNG =======================
function saveHopDong(e) {
    e?.preventDefault();


    const mssv = document.getElementById("mssvInput").value.trim();
    const tenSVVal = document.getElementById("tenSV").value.trim();
    const phongSVVal = document.getElementById("phongSV").value.trim();
    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;


    if (!mssv || !start || !end) {
        showToast("Vui lòng nhập đầy đủ thông tin", "error");
        return;
    }


    if (!phongSVVal) {
        showToast("Sinh viên chưa được phân phòng", "error");
        return;
    }


    if (new Date(end) <= new Date(start)) {
        showToast("Ngày kết thúc không hợp lệ", "error");
        return;
    }


    const newHD = {
        MaSinhVien: mssv,
        TenPhong: phongSVVal,
        NgayBatDau: start,
        NgayKetThuc: end,
        GhiChu: document.getElementById("ghiChu").value,
    };


    fetch(`${BASE_URL}/api/HopDong`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHD),
    })
        .then(async (res) => {
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Lỗi server");
            }
            return res.json();
        })
        .then(async (data) => {
            lastUpdatedHD = data.MaHopDong;
            // ✅ FIX: dùng MaHopDong thật từ BE
            saveHistory(
                {
                    ...newHD,
                    MaHD: data.MaHopDong,
                    MSSV: mssv,
                    TenSV: tenSVVal,
                    TenPhong: phongSVVal,
                    TrangThai: "Còn hiệu lực",
                },
                "Tạo mới",
            );


            await loadHopDong();


            showToast("Tạo hợp đồng thành công", "success");


            closeAddHopDongModal();


            document.getElementById("formHopDong").reset();
            document.getElementById("tenSV").value = "";
            document.getElementById("phongSV").value = "";
        })
        .catch((err) => {
            console.error(err);
            showToast("Lỗi khi tạo hợp đồng", "error");
        });
}


// ======================= GIA HẠN =======================
function openExtend(maHD) {
    const hd = rawHopDong.find((h) => h.MaHD === maHD);


    // không tìm thấy
    if (!hd) {
        showToast("Không tìm thấy hợp đồng", "error");
        return;
    }


    if (hd.TrangThai === "Đã kết thúc") {
        showToast("Không thể gia hạn hợp đồng đã kết thúc", "error");
        return;
    }


    // fill dữ liệu vào form
    document.getElementById("extendMaHD").value = hd.MaHD;
    document.getElementById("extendMSSV").value = hd.MSSV;
    document.getElementById("extendTen").value = hd.TenSV;
    document.getElementById("extendPhong").value = hd.TenPhong;
    document.getElementById("extendStart").value = hd.NgayBatDau.split("T")[0];


    document.getElementById("extendEnd").value = hd.NgayKetThuc;
    document.getElementById("extendNewDate").value = "";


    document.getElementById("extendModal").classList.remove("hidden");
}


function closeExtend() {
    document.getElementById("extendModal").classList.add("hidden");
}


function saveExtend() {
    const id = document.getElementById("extendMaHD").value;
    const newDate = document.getElementById("extendNewDate").value;


    // ===== VALIDATE =====
    if (!newDate) {
        showToast("Vui lòng chọn ngày", "error");
        return;
    }


    const hd = rawHopDong.find((h) => h.MaHD === id);


    if (!hd) {
        showToast("Không tìm thấy hợp đồng", "error");
        return;
    }


    const oldDate = new Date(hd.NgayKetThuc);
    const newD = new Date(newDate);


    if (newD <= oldDate) {
        showToast("Ngày kết thúc mới không hợp lệ", "error");
        return;
    }


    // ===== CALL API =====
    fetch(`${BASE_URL}/api/HopDong/extend/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ NgayKetThuc: newDate }),
    })
    .then(async (res) => {
        const text = await res.text();


        if (!res.ok) throw new Error(text);


        return text;
    })
    .then(async () => {


        // ===== TÍNH LẠI TRẠNG THÁI =====
        const today = new Date();
        today.setHours(0,0,0,0);
        newD.setHours(0,0,0,0);


        const diff = Math.ceil((newD - today) / (1000 * 60 * 60 * 24));


        // ===== SET HIGHLIGHT =====
        lastUpdatedHD = id;


        // ===== LOGIC TAB =====
        // 👉 chỉ chuyển tab nếu KHÔNG còn warning
        if (diff > 7) {
            currentTab = "all";
        }
        // 👉 nếu vẫn warning thì GIỮ NGUYÊN TAB


        // ===== LOAD LẠI DATA =====
        await loadHopDong();


        // ===== LƯU LỊCH SỬ =====
        saveHistory(
            {
                ...hd,
                NgayKetThuc: newDate,
                TrangThai: diff <= 7 ? "Sắp hết hạn" : "Còn hiệu lực",
            },
            "Gia hạn"
        );


        // ===== UI =====
        showToast("Gia hạn hợp đồng thành công", "success");
        closeExtend();
    })
    .catch((err) => {
        console.error("LỖI GIA HẠN:", err);
        showToast("Lỗi khi gia hạn", "error");
    });
}


// ======================= KẾT THÚC =======================
function openEnd(maHD) {
    const hd = rawHopDong.find((h) => h.MaHD === maHD);


    if (!hd) {
        showToast("Không tìm thấy hợp đồng", "error");
        return;
    }


    if (hd.TrangThai === "Đã kết thúc") {
        showToast("Không thể kết thúc hợp đồng không hợp lệ", "error");
        return;
    }
    currentEndId = hd.MaHD;
    // ✅ PHẢI nằm trong function
    document.getElementById("endMaHD").innerText = hd.MaHD;
    document.getElementById("endSV").innerText = `${hd.TenSV} (${hd.MSSV})`;
    document.getElementById("endPhong").innerText = hd.TenPhong;
    document.getElementById("endStart").innerText = formatDate(hd.NgayBatDau);
    document.getElementById("endEnd").innerText = formatDate(hd.NgayKetThuc);
    document.getElementById("endStatus").innerText = hd.TrangThai;


    const modal = document.getElementById("endModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    console.log("CLICK ID:", maHD);
}
function closeEnd() {
    const modal = document.getElementById("endModal");


    modal.classList.add("hidden");
    modal.classList.remove("flex");
}
// ======================= KẾT THÚC HỢP ĐỒNG =======================


// ======================= XÁC NHẬN KẾT THÚC HỢP ĐỒNG =======================
async function confirmEnd() {
    const id = currentEndId;

    if (!id) {
        showToast("Không xác định được hợp đồng cần kết thúc", "error");
        return;
    }

    const modal = document.getElementById("endModal");
    const selectedRadio = modal
        ? modal.querySelector('input[name="endStatusRadio"]:checked')
        : document.querySelector('input[name="endStatusRadio"]:checked');

    if (!selectedRadio || selectedRadio.value !== "done") {
        showToast("Vui lòng chọn Đã hoàn tất thủ tục trước khi kết thúc", "error");
        return;
    }

    try {
        const hd = rawHopDong.find((h) => h.MaHD === id);

        // 1. Gọi API lưu lên database
        const res = await fetch(`${BASE_URL}/api/HopDong/end/${encodeURIComponent(id)}`, {
            method: "PUT",
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Lỗi server");
        }

        // 2. Thông báo thành công
        showToast("Kết thúc hợp đồng thành công", "success");
        closeEnd();

        // 3. Lưu lịch sử
        saveHistory({ ...hd, TrangThai: "Đã kết thúc" }, "Kết thúc");

        // 4. Load lại dữ liệu từ database
        currentTab = "all";
        lastUpdatedHD = null;
        await loadHopDong();
        filterHopDong("all");

    } catch (err) {
        console.error("Lỗi kết thúc hợp đồng:", err);
        showToast("Lỗi: " + err.message, "error");
    }
}
function saveHistory(hd, action) {
    fetch(`${BASE_URL}/api/history`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            MaHopDong: hd.MaHD,
            MaSinhVien: hd.MSSV,
            HoTen: hd.TenSV,
            TenPhong: hd.TenPhong,
            NgayBatDau: hd.NgayBatDau,
            NgayKetThuc: hd.NgayKetThuc,
            TrangThaiHopDong: hd.TrangThai,
            ThaoTac: action,
        }),
    });
}
// ======================= MỞ MODAL LỊCH SỬ =======================
async function openHistoryModal() {
    const res = await fetch(`${BASE_URL}/api/history`);
    const data = await res.json();


    if (data.length === 0) {
        showToast("Không có lịch sử hợp đồng", "error");
        return;
    }


    historyHD = data;
    renderHistoryTable();


    document.getElementById("historyModal").classList.remove("hidden");
}


// ======================= ĐÓNG MODAL =======================
function closeHistoryModal() {
    document.getElementById("historyModal").classList.add("hidden");
}


// ======================= RENDER TABLE LỊCH SỬ =======================
function renderHistoryTable() {
    const tbody = document.getElementById("historyTable");


    const start = (historyPage - 1) * historyPageSize;
    const end = start + historyPageSize;


    const pageData = historyHD.slice(start, end);


    tbody.innerHTML = pageData
        .map(
            (h) => `
        <tr class="border-t hover:bg-slate-50 transition">


            <td class="px-6 py-4 font-semibold whitespace-nowrap">${h.MaLS}</td>
            <td class="px-6 py-4 whitespace-nowrap">${h.MaHopDong}</td>
            <td class="px-6 py-4 whitespace-nowrap">${h.MaSinhVien}</td>
            <td class="px-6 py-4">${h.HoTen}</td>
            <td class="px-6 py-4 whitespace-nowrap">${h.TenPhong}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(h.NgayBatDau)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${formatDate(h.NgayKetThuc)}</td>


            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 rounded-full text-xs font-semibold
                ${h.TrangThaiHopDong === "Còn hiệu lực"
                    ? "bg-green-100 text-green-600"
                    : h.TrangThaiHopDong === "Sắp hết hạn"
                        ? "bg-orange-100 text-orange-500"
                        : "bg-slate-200 text-slate-500"
                }">
                    ${h.TrangThaiHopDong}
                </span>
            </td>


            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 rounded-full text-xs font-semibold text-white
                    ${h.ThaoTac === "Tạo mới"
                    ? "bg-green-500"
                    : h.ThaoTac === "Gia hạn"
                        ? "bg-orange-500"
                        : "bg-red-500"
                }">
                    ${h.ThaoTac}
                </span>
            </td>


            <td class="px-6 py-4 text-slate-500 whitespace-nowrap">
    ${new Date(h.ThoiDiem.replace("Z", "")).toLocaleString("vi-VN")}
</td>


        </tr>
    `,
        )
        .join("");


    // update footer
    document.getElementById("historyCount").innerText =
        `Hiển thị ${start + 1}-${Math.min(end, historyHD.length)}/${historyHD.length} hợp đồng`;


    const totalPages = Math.ceil(historyHD.length / historyPageSize);


    document.getElementById("historyPageInfo").innerText =
        `${historyPage} / ${totalPages}`;
}


function nextHistoryPage() {
    const totalPages = Math.ceil(historyHD.length / historyPageSize);
    if (historyPage < totalPages) {
        historyPage++;
        renderHistoryTable();
    }
}


function prevHistoryPage() {
    if (historyPage > 1) {
        historyPage--;
        renderHistoryTable();
    }
}


async function openHistoryModal() {
    const res = await fetch(`${BASE_URL}/api/history`);
    const data = await res.json();


    historyHD = data.sort((a, b) => {
        return (
            parseInt(b.MaLS.replace("LS", "")) - parseInt(a.MaLS.replace("LS", ""))
        );
    });
    historyPage = 1; // 👈 QUAN TRỌNG


    renderHistoryTable();


    document.getElementById("historyModal").classList.remove("hidden");
}
let currentDetailId = null;


function openDetail(maHD) {
    const hd = rawHopDong.find(h => h.MaHD === maHD);
    if (!hd) return;


    currentDetailId = maHD;


    document.getElementById("dMaHD").innerText = hd.MaHD;
    document.getElementById("dSV").innerText = `${hd.TenSV} (${hd.MSSV})`;
    document.getElementById("dPhong").innerText = hd.TenPhong;
    document.getElementById("dStart").innerText = formatDate(hd.NgayBatDau);
    document.getElementById("dEnd").innerText = formatDate(hd.NgayKetThuc);
    document.getElementById("dStatus").innerText = hd.TrangThai;


    document.getElementById("dGhiChu").value = hd.GhiChu || "";


    document.getElementById("detailModal").classList.remove("hidden");
}


function closeDetail() {
    document.getElementById("detailModal").classList.add("hidden");
}
function saveNote() {
    const ghiChu = document.getElementById("dGhiChu").value;
    lastUpdatedHD = currentDetailId;
    currentTab = "all";


    if (currentTab === "warning") {
        currentTab = "all";
    }


    loadHopDong();


    fetch(`${BASE_URL}/api/HopDong/note/${currentDetailId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ GhiChu: ghiChu })
    })
    .then(res => {
        if (!res.ok) throw new Error();
        return res.text();
    })
    .then(() => {
        showToast("Cập nhật ghi chú thành công");


        closeDetail();
        loadHopDong(); // reload lại bảng
    })
    .catch(() => {
        showToast("Lỗi khi cập nhật ghi chú", "error");
    });
}


window.confirmEnd = confirmEnd;
window.openEnd = openEnd;
window.closeEnd = closeEnd;