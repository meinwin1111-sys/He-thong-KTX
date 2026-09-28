// ==========================================================
// 1. BIẾN TOÀN CỤC VÀ TRẠNG THÁI BIỂU ĐỒ
// ==========================================================

// Biến lưu instance của các biểu đồ (Chart.js)
// Dùng để tránh vẽ chồng nhiều biểu đồ lên nhau
let chartDoanhThuInstance = null; // Biểu đồ doanh thu
let chartGioiTinhInstance = null; // Biểu đồ giới tính
let chartRoiBoInstance = null; // Biểu đồ tỷ lệ rời bỏ
let chartPieUsageInstance = null; // Biểu đồ tỷ lệ sử dụng phòng
let reportState = {
    expiringContracts: [],
    unpaidBills: [],
};

let unpaidBillsState = {
    data: [],
    currentPage: 1,
    pageSize: 10,
};
let expiringContractsState = {
    data: [],
    currentPage: 1,
    pageSize: 10,
};

// ==========================================================
// 2. HÀM HỖ TRỢ
// ==========================================================

// Hàm kiểm tra nếu biểu đồ đã tồn tại thì hủy trước khi tạo mới
// Tránh lỗi render trùng hoặc memory leak
function destroyIfExists(chartInstance) {
    if (chartInstance) {
        chartInstance.destroy();
    }
}

// ==========================================================
// 3. DỮ LIỆU THỐNG KÊ
// ==========================================================

// Lưu doanh thu theo từng năm (key: năm, value: doanh thu)
let doanhThuTheoNam = {};

// Lưu tỷ lệ rời bỏ theo từng năm (key: năm, value: % rời bỏ)
let tyLeRoiBoTheoNam = {};

// Lưu số lượng sinh viên theo giới tính
let gioiTinhSinhVienData = {
    nam: 0, // số sinh viên nam
    nu: 0, // số sinh viên nữ
};

// ==========================================================
// 4. STATE QUẢN LÝ BÁO CÁO (TRẠNG THÁI HIỆN TẠI)
// ==========================================================

// Đối tượng chứa toàn bộ dữ liệu đang dùng để hiển thị báo cáo
let baoCaoState = {
    // Năm đang được chọn để thống kê — mặc định là năm hiện tại
    selectedYear: new Date().getFullYear(),

    // Danh sách dữ liệu phòng (có thể gồm: số người, trạng thái,...)
    phongData: [],

    // Thống kê nam
    male: {
        cap: 0, // số lượng đã cấp phòng
        sv: 0, // tổng số sinh viên nam
    },

    // Thống kê nữ
    female: {
        cap: 0, // số lượng đã cấp phòng
        sv: 0, // tổng số sinh viên nữ
    },

    // Tỷ lệ sử dụng phòng (%)
    usageRate: 0,

    // Tổng số phòng
    totalRoom: 0,

    // Số phòng trống
    emptyRoom: 0,

    // Số phòng đã đầy
    fullRoom: 0,

    totalSV: 0, // Tổng số sinh viên
};

// ==========================================================
// 5. HÀM VẼ BIỂU ĐỒ DOANH THU THEO NĂM (BAR CHART - STACKED)
// ==========================================================
function drawChartDoanhThu() {
    // Lấy thẻ canvas để render biểu đồ
    const canvas = document.getElementById("chartDoanhThu");

    // Nếu không tìm thấy canvas thì dừng (tránh lỗi)
    if (!canvas) return;

    // Lấy năm đang được chọn từ state
    const year = baoCaoState.selectedYear;

    // Lấy dữ liệu doanh thu theo năm tương ứng
    const data = doanhThuTheoNam[year];

    // Nếu không có dữ liệu thì không vẽ
    if (!data) return;

    // Hủy biểu đồ cũ nếu đã tồn tại (tránh vẽ chồng)
    destroyIfExists(chartDoanhThuInstance);

    // Khởi tạo biểu đồ mới bằng Chart.js
    chartDoanhThuInstance = new Chart(canvas, {
        // Loại biểu đồ: cột (bar chart)
        type: "bar",

        data: {
            // Nhãn trục X (12 tháng trong năm)
            labels: [
                "Tháng 1",
                "Tháng 2",
                "Tháng 3",
                "Tháng 4",
                "Tháng 5",
                "Tháng 6",
                "Tháng 7",
                "Tháng 8",
                "Tháng 9",
                "Tháng 10",
                "Tháng 11",
                "Tháng 12",
            ],

            // Dữ liệu biểu đồ (2 loại doanh thu)
            datasets: [
                // Dataset 1: Doanh thu từ phòng
                {
                    label: "Phòng", // Tên hiển thị
                    data: data.phong, // Mảng dữ liệu theo 12 tháng
                    backgroundColor: "#10b981", // Màu cột (xanh)
                    borderRadius: 6, // Bo góc cột
                    borderSkipped: false, // Không bỏ viền
                    stack: "tong", // Stack chung (cộng dồn)
                    categoryPercentage: 0.62, // Độ rộng nhóm cột
                    barPercentage: 0.9, // Độ rộng từng cột
                },

                // Dataset 2: Doanh thu điện nước
                {
                    label: "Điện/Nước",
                    data: data.dienNuoc,
                    backgroundColor: "#facc15", // Vàng
                    borderRadius: 0,
                    borderSkipped: false,
                    stack: "tong",
                    categoryPercentage: 0.62,
                    barPercentage: 0.9,
                },
            ],
        },

        // ======================================================
        // CẤU HÌNH BIỂU ĐỒ
        // ======================================================
        options: {
            // Tự động co giãn theo container
            responsive: true,

            // Cho phép custom chiều cao (không giữ tỷ lệ mặc định)
            maintainAspectRatio: false,

            // Padding xung quanh chart
            layout: {
                padding: {
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                },
            },

            // Cấu hình plugin (legend, tooltip,...)
            plugins: {
                // Legend (chú thích)
                legend: {
                    display: true,
                    position: "top",
                    align: "end",
                    labels: {
                        boxWidth: 14,
                        boxHeight: 10,
                        padding: 16,
                        color: "#64748b",
                        font: { size: 12 },
                        usePointStyle: true,
                        pointStyle: "rectRounded",
                    },
                },
            },

            // ==================================================
            // CẤU HÌNH TRỤC X, Y
            // ==================================================
            scales: {
                // Trục X (tháng)
                x: {
                    stacked: true, // Bật stack (cộng dồn 2 dataset)
                    grid: {
                        display: false, // Ẩn lưới dọc
                        drawBorder: false, // Ẩn viền trục
                    },
                    ticks: {
                        color: "#64748b", // Màu chữ
                        font: { size: 11 },
                    },
                    border: {
                        display: false,
                    },
                },

                // Trục Y (giá trị doanh thu)
                y: {
                    stacked: true, // Stack theo chiều dọc
                    beginAtZero: true, // Bắt đầu từ 0
                    ticks: {
                        color: "#64748b",
                        font: { size: 11 },
                    },
                    grid: {
                        color: "#e2e8f0", // Màu lưới
                        borderDash: [5, 5], // Nét đứt
                        drawBorder: false,
                    },
                    border: {
                        display: false,
                    },
                },
            },
        },
    });
}

// ==========================================================
// 6. HÀM VẼ BIỂU ĐỒ GIỚI TÍNH (SO SÁNH SỨC CHỨA & THỰC TẾ)
// ==========================================================
function drawChartGioiTinh() {
    // Lấy thẻ canvas để render biểu đồ
    const canvas = document.getElementById("chartGioiTinh");

    // Nếu không tồn tại canvas thì dừng để tránh lỗi
    if (!canvas) return;

    // Lấy danh sách phòng từ state (nếu null thì gán mảng rỗng)
    const phongData = baoCaoState.phongData || [];

    // ======================================================
    // 1. TÍNH TỔNG SỨC CHỨA PHÒNG NAM
    // ======================================================

    const tongSucChuaNam = phongData

        // Lọc ra các phòng có LoaiPhong = "nam"
        .filter(
            (p) =>
                String(p.LoaiPhong || "")
                    .trim()
                    .toLowerCase() === "nam",
        )

        // Cộng tổng sức chứa tối đa của các phòng nam
        .reduce((sum, p) => sum + (Number(p.SucChuaToiDa) || 0), 0);

    // ======================================================
    // 2. TÍNH TỔNG SỨC CHỨA PHÒNG NỮ
    // ======================================================

    const tongSucChuaNu = phongData

        // Lọc phòng có LoaiPhong = "nữ" hoặc "nu" (tránh lỗi dấu)
        .filter((p) => {
            const loai = String(p.LoaiPhong || "")
                .trim()
                .toLowerCase();
            return loai === "nữ" || loai === "nu";
        })

        // Cộng tổng sức chứa tối đa của các phòng nữ
        .reduce((sum, p) => sum + (Number(p.SucChuaToiDa) || 0), 0);

    // ======================================================
    // 3. HỦY BIỂU ĐỒ CŨ (NẾU CÓ)
    // ======================================================
    destroyIfExists(chartGioiTinhInstance);

    // ======================================================
    // 4. KHỞI TẠO BIỂU ĐỒ MỚI
    // ======================================================
    chartGioiTinhInstance = new Chart(canvas, {
        type: "bar",

        data: {
            labels: ["Nam", "Nữ"],
            datasets: [
                {
                    label: "Sức chứa",
                    data: [tongSucChuaNam, tongSucChuaNu],
                    backgroundColor: "#e2e8f0",
                    borderRadius: 8,

                    barPercentage: 0.9,
                    categoryPercentage: 0.7,
                },
                {
                    label: "Thực tế",
                    data: [gioiTinhSinhVienData.nam, gioiTinhSinhVienData.nu],
                    backgroundColor: ["#10b981", "#ef4444"],
                    borderRadius: 8,

                    barPercentage: 0.9,
                    categoryPercentage: 0.7,
                },
            ],
        },
// Cấu hình biểu đồ
        options: {
    responsive: true,
    maintainAspectRatio: false,

    layout: {
        padding: 10,
    },

    plugins: {
        legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
                generateLabels: function(chart) {
                    return [
                        {
                            text: "Sức chứa",
                            fillStyle: "#e2e8f0",
                            strokeStyle: "#e2e8f0",
                            lineWidth: 1,
                            pointStyle: "rectRounded",
                            hidden: false,
                        },
                        {
                            text: "Nam",
                            fillStyle: "#10b981",
                            strokeStyle: "#10b981",
                            lineWidth: 0,
                            pointStyle: "rectRounded",
                            hidden: false,
                        },
                        {
                            text: "Nữ",
                            fillStyle: "#ef4444",
                            strokeStyle: "#ef4444",
                            lineWidth: 0,
                            pointStyle: "rectRounded",
                            hidden: false,
                        },
                    ];
                },
                usePointStyle: true,
                pointStyleWidth: 14,
                color: "#64748b",
                font: { size: 12 },
                padding: 16,
                boxHeight: 10,
            },
        },
    },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: "#64748b",
                        font: { size: 11 },
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "#e2e8f0",
                        borderDash: [5, 5],
                    },
                    ticks: {
                        stepSize: 100,
                        color: "#64748b",
                        font: { size: 11 },
                    },
                },
            },
        },
    });
}

// ==========================================================
// 7. HÀM RENDER MODULE BÁO CÁO & THỐNG KÊ
// ==========================================================
function renderBaoCaoThongKeModule() {
    // Lấy thẻ main-content để render toàn bộ UI
    const main = document.getElementById("main-content");

    // Nếu không tồn tại thì dừng
    if (!main) return;

    // ======================================================
    // 1. RENDER HTML GIAO DIỆN
    // ======================================================
    main.innerHTML = `
        <section id="module-baocao-thongke" class="p-6 bg-slate-50 min-h-screen">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-3xl font-bold text-slate-900">Báo cáo & Thống kê</h2>
                    <p class="text-slate-500 mt-1 font-medium">
                        <span class="hover:text-emerald-600 cursor-pointer" onclick="switchPage('Trang Chu', document.querySelectorAll('.nav-item')[0])">Trang chủ</span>
                        <span class="mx-1">></span>
                        <span>Báo cáo & Thống kê</span>
                    </p>
                </div>

                <div class="flex items-center gap-3">
                    <label for="selectRevenueYear" class="text-sm text-slate-500 font-medium">Năm:</label>
                    <select id="selectRevenueYear" class="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none bg-white shadow-sm">
                        <option value="">Đang tải...</option>
                    </select>
                    <button id="btnExportReport" class="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition">
                        <i class="fas fa-file-export"></i> XUẤT BÁO CÁO
                    </button>
                </div>
            </div>
        <div id="reportPreviewModal" class="fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4">
    <div class="bg-white w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        <div class="flex items-center justify-between px-6 py-4 border-b">
            <h3 class="text-base font-semibold text-slate-900">Báo cáo tổng hợp</h3>
           <div class="flex items-center gap-2">
    <button id="btnDownloadReport" class="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
        Tải xuống
    </button>
    <button id="btnPrintReport" class="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
        In báo cáo
    </button>
    <button id="btnCloseReportPreview" class="px-4 py-2 text-sm bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300">
        Đóng
    </button>
</div>
        </div>
        <div id="reportPreviewContent" class="p-6"></div>
    </div>
</div>


        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div class="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div class="flex justify-between items-center mb-4 flex-wrap gap-3">
                        <div>
                            <h3 class="text-2xl font-bold text-slate-900">
                                Doanh thu các tháng năm
                                <span id="selectedRevenueYearText" class="text-emerald-500">${baoCaoState.selectedYear}</span>
                            </h3>
                        </div>
                    </div>

                    <div class="h-[450px] w-full">
                        <canvas id="chartDoanhThu"></canvas>
                    </div>
                </div>

                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <h3 class="text-2xl font-bold text-slate-900 mb-4">Tỷ lệ lấp đầy theo Giới tính</h3>
                    <div class="flex-1 min-h-[450px] flex items-center justify-center">
                        <canvas id="chartGioiTinh"></canvas>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <h3 class="text-2xl font-bold text-slate-900 mb-4">
                        Tỷ lệ sinh viên rời bỏ (%) -
                        <span id="selectedDropoutYearText" class="text-red-400">${baoCaoState.selectedYear}</span>
                    </h3>

                    <div class="h-[350px]">
                        <canvas id="chartRoiBo"></canvas>
                    </div>

                    <div class="mt-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg text-xs text-amber-700">
                        <strong class="text-xs font-semibold"><i class="fas fa-lightbulb mr-1.5"></i>Phân tích:</strong>
                        Tỷ lệ rời bỏ tăng cao vào các tháng cuối kỳ, cần có chính sách giữ chân sinh viên hoặc đẩy mạnh Marketing.
                    </div>
                </div>

                 <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
                <h3 class="text-2xl font-bold text-slate-900 mb-4">Hiệu suất sử dụng phòng</h3>

                <div class="grid grid-cols-2 gap-3 mb-5 text-center">
                    <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p class="text-xs text-slate-500 font-semibold uppercase mb-1">Tổng phòng</p>
                        <p class="text-2xl font-bold text-slate-900" id="statTotalRoom">...</p>
                    </div>
                   <div class="bg-emerald-50 p-4 rounded-lg border border-slate-200">
                        <p class="text-xs text-emerald-500 font-semibold uppercase mb-1">Phòng Trống</p>
                        <p class="text-2xl font-bold text-emerald-500" id="statEmptyRoom">...</p>
                    </div>
                    <div class="bg-red-50 p-4 rounded-lg border border-slate-200">
                        <p class="text-xs text-red-400 font-semibold uppercase mb-1">Phòng Đầy</p>
                        <p class="text-2xl font-bold text-red-400" id="statFullRoom">...</p>
                    </div>
                    <div class="bg-emerald-50 p-4 rounded-lg border border-slate-200">
                        <p class="text-xs text-emerald-500 font-semibold uppercase mb-1">Tổng SV</p>
                        <p class="text-2xl font-bold text-emerald-500" id="statTotalSV">...</p>
                    </div>
                </div>

                <div class="flex items-center gap-6 flex-1">
                    <div class="flex-1">
                        <h4 class="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Chi tiết theo Khu vực (A, B)</h4>
                        <table class="w-full text-sm">
                            <tbody id="areaStatsTable">
                                </tbody>
                        </table>
                    </div>
                    <div class="w-40 h-40 relative flex-shrink-0">
                        <canvas id="chartPieUsage"></canvas>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="text-2xl font-bold text-slate-900" id="usageRateText">0%</span>
                            <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Hiệu suất</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>


        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">

    <h3 class="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <i class="fas fa-file-contract text-emerald-500"></i>
        <span id="contractTableTitle">Sinh viên sắp hết hạn hợp đồng</span>
    </h3>


    <div class="overflow-x-auto rounded-lg border border-slate-200 flex-1">
        <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                    <th class="p-3">MSSV</th>
                    <th class="p-3">Họ và tên</th>
                    <th class="p-3">Phòng</th>
                    <th class="p-3 text-right">Còn lại</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 text-slate-500" id="tableExpiringContracts"></tbody>
        </table>
    </div>


    <div id="expiringContractsPagination" class="mt-4 flex items-center justify-between text-xs text-slate-500 min-h-[36px]"></div>
</div>


            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
    <h3 class="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <i class="fas fa-exclamation-triangle text-orange-500"></i>
        <span>Danh sách công nợ</span>
    </h3>


    <div class="overflow-x-auto rounded-lg border border-slate-200 flex-1">
        <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                    <th class="p-3">Mã HĐ</th>
                    <th class="p-3">Phòng</th>
                    <th class="p-3">Tháng/Năm</th>
                    <th class="p-3 text-right">Số tiền</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 text-slate-500" id="tableUnpaidBills"></tbody>
        </table>
    </div>


    <div id="unpaidBillsPagination" class="mt-4 flex items-center justify-between text-xs text-slate-500 min-h-[36px]"></div>
</div>

</div>
    `;


    // ======================================================
    // 7. KHỞI TẠO MODULE
    // ======================================================

    bindBaoCaoEvents(); // gắn sự kiện
    const btnExportReport = document.getElementById("btnExportReport");
    if (btnExportReport) {
        btnExportReport.addEventListener("click", openReportPreview);
    }
    // Gọi API và render dữ liệu ban đầu
    setTimeout(async () => {
        await loadAvailableYears();
        await Promise.all([
            loadBaoCaoThongKe(baoCaoState.selectedYear),
            loadDoanhThuTheoNam(baoCaoState.selectedYear),
            loadTyLeRoiBoTheoNam(baoCaoState.selectedYear),
            loadGioiTinhSinhVien(baoCaoState.selectedYear),
            loadExpiringContracts(baoCaoState.selectedYear),
            loadUnpaidBills(baoCaoState.selectedYear),
        ]);
    }, 0);
}

// ======================================================
// UPDATE UI TỪ STATE
// ======================================================
function updateBaoCaoUI() {
    // Lấy các phần tử hiển thị
    const totalRoomEl = document.getElementById("statTotalRoom");
    const emptyRoomEl = document.getElementById("statEmptyRoom");
    const fullRoomEl = document.getElementById("statFullRoom");
    const totalSVEl = document.getElementById("statTotalSV");
    const usageRateEl = document.getElementById("usageRateText");

    // Gán dữ liệu từ state ra UI
    if (totalRoomEl) totalRoomEl.textContent = baoCaoState.totalRoom;
    if (emptyRoomEl) emptyRoomEl.textContent = baoCaoState.emptyRoom;
    if (fullRoomEl) fullRoomEl.textContent = baoCaoState.fullRoom;
    if (totalSVEl) totalSVEl.textContent = baoCaoState.totalSV;
    if (usageRateEl) usageRateEl.textContent = `${baoCaoState.usageRate}%`;
}

// ======================================================
// BIND SỰ KIỆN (EVENT)
// ======================================================
function bindBaoCaoEvents() {
    const selectYear = document.getElementById("selectRevenueYear");

    if (selectYear) {
        selectYear.addEventListener("change", async function () {
            baoCaoState.selectedYear = Number(this.value);

            const yearText = document.getElementById("selectedRevenueYearText");
            const dropoutYearText = document.getElementById("selectedDropoutYearText");
            const contractTitle = document.getElementById("contractTableTitle");
            const billTitle = document.getElementById("billTableTitle");
            const currentYear = new Date().getFullYear();

            if (yearText) yearText.textContent = baoCaoState.selectedYear;
            if (dropoutYearText) dropoutYearText.textContent = baoCaoState.selectedYear;
            if (contractTitle) contractTitle.textContent = baoCaoState.selectedYear === currentYear
                ? "Sinh viên sắp hết hạn hợp đồng (30 ngày tới)"
                : `Hợp đồng hết hạn năm ${baoCaoState.selectedYear}`;
            if (billTitle) billTitle.textContent = `Sinh viên chưa thanh toán hóa đơn năm ${baoCaoState.selectedYear}`;

            await Promise.all([
                loadDoanhThuTheoNam(baoCaoState.selectedYear),
                loadTyLeRoiBoTheoNam(baoCaoState.selectedYear),
                loadGioiTinhSinhVien(baoCaoState.selectedYear),
                loadExpiringContracts(baoCaoState.selectedYear),
                loadUnpaidBills(baoCaoState.selectedYear),
            ]);
        });
    }
}

// ======================================================
// LOAD DANH SÁCH NĂM CÓ DỮ LIỆU TỪ DB
// ======================================================
async function loadAvailableYears() {
    try {
        const response = await fetch(`${BASE_URL}/api/nam-co-du-lieu`);
        if (!response.ok) throw new Error("Không lấy được danh sách năm");

        const years = await response.json();
        const select = document.getElementById("selectRevenueYear");
        if (!select || !years.length) return;

        select.innerHTML = years.map(y =>
            `<option value="${y}" ${y === baoCaoState.selectedYear ? "selected" : ""}>${y}</option>`
        ).join("");

        // Nếu năm mặc định không có trong DB, lấy năm mới nhất
        if (!years.includes(baoCaoState.selectedYear)) {
            baoCaoState.selectedYear = years[0];
            select.value = years[0];
        }

        const yearText = document.getElementById("selectedRevenueYearText");
        const dropoutYearText = document.getElementById("selectedDropoutYearText");
        if (yearText) yearText.textContent = baoCaoState.selectedYear;
        if (dropoutYearText) dropoutYearText.textContent = baoCaoState.selectedYear;

    } catch (err) {
        console.error("Lỗi load danh sách năm:", err);
        // Fallback: dùng năm hiện tại
        const select = document.getElementById("selectRevenueYear");
        const y = baoCaoState.selectedYear;
        if (select) select.innerHTML = `<option value="${y}" selected>${y}</option>`;
    }
}

// ======================================================
// LOAD DỮ LIỆU PHÒNG (API)
// ======================================================
async function loadBaoCaoThongKe() {
    try {
        const response = await fetch(`${BASE_URL}/api/Phong`);

        if (!response.ok) throw new Error("Không thể kết nối API");

        const data = await response.json();

        // Lưu vào state
        baoCaoState.phongData = data;

        // Xử lý và render
        processAndRenderRealData(data);
        updateBaoCaoUI();
    } catch (error) {
        console.error("Lỗi:", error);
    }
}

// ======================================================
// LOAD TỶ LỆ RỜI BỎ
// ======================================================
async function loadTyLeRoiBoTheoNam(year) {
    console.log("🔥 CALL API:", year);

    try {
        const response = await fetch(
            `${BASE_URL}/api/tyle-roi-bo/${year}`,
        );

        if (!response.ok) throw new Error("Lỗi API rời bỏ");

        const data = await response.json();
        console.log("✅ DATA:", data);

        // Lưu dữ liệu theo năm
        tyLeRoiBoTheoNam[year] = data.tyLeRoiBo || Array(12).fill(0);

        // Vẽ chart
        drawChartRoiBo();
    } catch (error) {
        console.error("Lỗi load tỷ lệ rời bỏ:", error);
    }
}

// ======================================================
// LOAD GIỚI TÍNH SINH VIÊN
// ======================================================
async function loadGioiTinhSinhVien() {
    try {
        const response = await fetch(
            `${BASE_URL}/api/gioi-tinh-sinh-vien`,
        );

        if (!response.ok) throw new Error("Lỗi API giới tính");

        const result = await response.json();

        // Gán dữ liệu
        gioiTinhSinhVienData = {
            nam: result.nam || 0,
            nu: result.nu || 0,
        };

        // Vẽ chart
        drawChartGioiTinh();
    } catch (error) {
        console.error("Lỗi load giới tính sinh viên:", error);
    }
}

// =========================
// HÀM PHỤ TRỢ (UTILS)
// =========================

// Hàm lấy giá trị từ object với nhiều tên field khác nhau
// Dùng khi API trả về không đồng nhất tên cột
function getField(obj, fieldNames, defaultValue = "") {
    // Duyệt qua danh sách tên field
    for (const field of fieldNames) {
        // Nếu tồn tại và không null thì trả về luôn
        if (obj && obj[field] !== undefined && obj[field] !== null) {
            return obj[field];
        }
    }

    // Nếu không tìm thấy thì trả về giá trị mặc định
    return defaultValue;
}

// Chuyển giá trị bất kỳ về number
// Nếu không phải số → trả về 0
function toNumber(value) {
    const n = Number(value);
    return isNaN(n) ? 0 : n;
}

// Format tiền theo định dạng Việt Nam (có dấu phẩy)
// Ví dụ: 1000000 → "1,000,000 đ"
function formatMoney(value) {
    return toNumber(value).toLocaleString("vi-VN") + " đ";
}

// Format ngày sang định dạng dd/mm/yyyy
function formatDateVN(dateValue) {
    // Nếu không có giá trị thì trả về rỗng
    if (!dateValue) return "";

    const d = new Date(dateValue);

    // Nếu ngày không hợp lệ thì trả về rỗng
    if (isNaN(d.getTime())) return "";

    // Lấy ngày/tháng/năm và thêm số 0 phía trước nếu cần
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    // Trả về dạng dd/mm/yyyy
    return `${day}/${month}/${year}`;
}

// Tính số ngày từ hôm nay đến 1 ngày bất kỳ
// > 0: còn bao nhiêu ngày
// = 0: hôm nay
// < 0: đã quá hạn
function diffDaysFromToday(dateValue) {
    if (!dateValue) return null;

    const target = new Date(dateValue);

    // Nếu ngày không hợp lệ
    if (isNaN(target.getTime())) return null;

    // Lấy ngày hôm nay (reset về 00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Reset ngày target về 00:00:00 để so sánh chính xác
    target.setHours(0, 0, 0, 0);

    // Tính hiệu số mili giây
    const diff = target - today;

    // Đổi sang số ngày
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}


// =========================
// RENDER BẢNG HỢP ĐỒNG SẮP HẾT HẠN
// =========================
function renderExpiringContracts(expiringContracts = []) {
    reportState.expiringContracts = expiringContracts;

    const tbody = document.getElementById("tableExpiringContracts");
    const pagination = document.getElementById("expiringContractsPagination");
    if (!tbody) return;
// Lưu dữ liệu vào state để dùng cho phân trang
    expiringContractsState.data = expiringContracts;
// Lấy thông tin phân trang từ state
    const pageSize = expiringContractsState.pageSize;
    const currentPage = expiringContractsState.currentPage;
    const totalItems = expiringContracts.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageData = expiringContracts.slice(startIndex, endIndex);
// Tạo HTML cho các dòng hợp đồng sắp hết hạn
    const html = pageData.length
        ? pageData.map(item => `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-3 text-xs font-medium text-slate-500">${item.MSSV || item.MaSinhVien || ""}</td>
                <td class="p-3 text-xs text-slate-500">${item.TenSV || item.HoTen || "Không rõ"}</td>
                <td class="p-3 text-xs text-slate-500">${item.TenPhong || "Chưa có"}</td>
                <td class="p-3 text-xs text-red-400 font-semibold text-right">${item.ConLai ?? item.conLai ?? 0} ngày</td>
            </tr>
        `).join("")
        : `
            <tr>
                <td colspan="4" class="p-4 text-center text-xs text-slate-500 italic">
                    Không có sinh viên nào sắp hết hạn hợp đồng
                </td>
            </tr>
        `;
// Gán HTML vào tbody
    tbody.innerHTML = html;
// Tạo HTML cho phần phân trang
    if (pagination) {
        pagination.innerHTML = renderExpiringContractsPagination(
            totalPages,
            currentPage,
            totalItems,
            startIndex,
            endIndex
        );
        bindExpiringContractsPagination(totalPages);
    }
}

// Tạo HTML cho phần phân trang dựa trên tổng số trang, trang hiện tại và tổng số hợp đồng
function renderExpiringContractsPagination(totalPages, currentPage, totalItems, startIndex, endIndex) {
    if (totalPages <= 1) {
        return `
            <div class="text-slate-500">
                Hiển thị ${totalItems === 0 ? 0 : startIndex + 1}-${endIndex}/${totalItems} hợp đồng
            </div>
            <div class="flex items-center gap-2">
                <button class="w-8 h-8 rounded-md border border-slate-200 text-slate-300 cursor-not-allowed" disabled>
                    &lt;
                </button>
                <div class="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-emerald-500 font-medium">
                    1 / 1
                </div>
                <button class="w-8 h-8 rounded-md border border-slate-200 text-slate-300 cursor-not-allowed" disabled>
                    &gt;
                </button>
            </div>
        `;
    }
// Nếu có nhiều hơn 1 trang, hiển thị phân trang với nút bấm
    return `
        <div class="text-slate-500">
            Hiển thị ${startIndex + 1}-${endIndex}/${totalItems} hợp đồng
        </div>

        <div class="flex items-center gap-2">
            <button
                class="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center ${
                    currentPage <= 1
                        ? "text-slate-300 cursor-not-allowed bg-slate-50"
                        : "text-slate-500 hover:bg-slate-50"
                }"
                data-page="${currentPage - 1}"
                ${currentPage <= 1 ? "disabled" : ""}
            >
                &lt;
            </button>

            <div class="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-emerald-500 font-medium">
                ${currentPage} / ${totalPages}
            </div>

            <button
                class="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center ${
                    currentPage >= totalPages
                        ? "text-slate-300 cursor-not-allowed bg-slate-50"
                        : "text-slate-500 hover:bg-slate-50"
                }"
                data-page="${currentPage + 1}"
                ${currentPage >= totalPages ? "disabled" : ""}
            >
                &gt;
            </button>
        </div>
    `;
}


// Gắn sự kiện cho các nút phân trang
function bindExpiringContractsPagination(totalPages) {
    const pagination = document.getElementById("expiringContractsPagination");
    if (!pagination) return;

    pagination.querySelectorAll("button[data-page]").forEach(button => {
        button.addEventListener("click", function () {
            const page = Number(this.dataset.page);

            if (page < 1 || page > totalPages) return;

            expiringContractsState.currentPage = page;
            renderExpiringContracts(expiringContractsState.data);
        });
    });
}

// Hàm gọi API để lấy danh sách hợp đồng sắp hết hạn và render
async function loadExpiringContracts(year) {
    try {
        const response = await fetch(`${BASE_URL}/api/HopDong`);
        if (!response.ok) throw new Error("Không thể lấy dữ liệu hợp đồng");

        const data = await response.json();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentYear = new Date().getFullYear();

        let expiring;

        if (year && year != currentYear) {
            // Năm khác: lấy hợp đồng hết hạn trong năm đó
            expiring = data
                .map(h => {
                    const end = h.NgayKetThuc ? h.NgayKetThuc.split("T")[0] : "";
                    const endDate = end ? new Date(end) : null;
                    if (endDate) endDate.setHours(0, 0, 0, 0);
                    const diff = endDate ? Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)) : -1;
                    return {
                        MSSV:        h.MaSinhVien || "",
                        TenSV:       h.HoTen || "",
                        TenPhong:    h.TenPhong || "",
                        NgayKetThuc: end,
                        ConLai:      Math.max(diff, 0),
                        _endDate:    endDate,
                        _trangThai:  (h.TrangThaiHopDong || "").trim(),
                    };
                })
                .filter(h => h._endDate && h._endDate.getFullYear() == year)
                .sort((a, b) => a.ConLai - b.ConLai);
        } else {
            // Năm hiện tại: lấy hợp đồng còn hiệu lực sắp hết hạn trong 7 ngày
            expiring = data
                .map(h => {
                    const end = h.NgayKetThuc ? h.NgayKetThuc.split("T")[0] : "";
                    const endDate = end ? new Date(end) : null;
                    if (endDate) endDate.setHours(0, 0, 0, 0);
                    const diff = endDate ? Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)) : -1;
                    const trangThai = (h.TrangThaiHopDong || "").trim();
                    return {
                        MSSV:        h.MaSinhVien || "",
                        TenSV:       h.HoTen || "",
                        TenPhong:    h.TenPhong || "",
                        NgayKetThuc: end,
                        ConLai:      Math.max(diff, 0),
                        _diff:       diff,
                        _trangThai:  trangThai,
                    };
                })
                .filter(h => h._diff >= 0 && h._diff <= 7 && !h._trangThai.toLowerCase().includes("kết thúc"))
                .sort((a, b) => a.ConLai - b.ConLai);
        }

        expiringContractsState.currentPage = 1;
        renderExpiringContracts(expiring);
    } catch (error) {
        console.error("Lỗi load hợp đồng sắp hết hạn:", error);
    }
}

// --- HÀM CON 4: RENDER BẢNG HÓA ĐƠN CHƯA THANH TOÁN ---
function renderUnpaidBills(unpaidBills = []) {
    reportState.unpaidBills = unpaidBills;
    const tbody = document.getElementById("tableUnpaidBills");
    const pagination = document.getElementById("unpaidBillsPagination");
    if (!tbody) return;

// Lưu dữ liệu vào state để dùng cho phân trang
    unpaidBillsState.data = unpaidBills;

// Lấy thông tin phân trang từ state
    const pageSize = unpaidBillsState.pageSize;
    const currentPage = unpaidBillsState.currentPage;
    const totalItems = unpaidBills.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;


    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageData = unpaidBills.slice(startIndex, endIndex);


    const html = pageData.length
        ? pageData.map(item => {
            const tongTien = Number(item.tongTien || item.TongTien) || 0;
            const thangNam = (item.thang || item.Thang)
                ? `T${item.thang || item.Thang}/${item.nam || item.Nam}`
                : '---';

            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 text-xs font-medium text-slate-500">${item.id || item.MaHoaDon || ''}</td>
                    <td class="p-3 text-xs text-slate-500">${item.tenPhong || item.TenPhong || 'Chưa có'}</td>
                    <td class="p-3 text-xs text-slate-500">${thangNam}</td>
                    <td class="p-3 text-xs text-red-400 font-semibold text-right">${formatMoney(tongTien)}</td>
                </tr>
            `;
        }).join("")
        : `
            <tr>
                <td colspan="4" class="p-4 text-center text-xs text-slate-500 italic">
                    Không có công nợ
                </td>
            </tr>
        `;


    tbody.innerHTML = html;


    if (pagination) {
        pagination.innerHTML = renderUnpaidBillsPagination(
            totalPages,
            currentPage,
            totalItems,
            startIndex,
            endIndex
        );
        bindUnpaidBillsPagination(totalPages);
    }
}

// Tạo HTML cho phần phân trang dựa trên tổng số trang, trang hiện tại và tổng số hóa đơn chưa thanh toán
function renderUnpaidBillsPagination(totalPages, currentPage, totalItems, startIndex, endIndex) {
    if (totalPages <= 1) {
        return `
            <div class="text-slate-500">
                Hiển thị ${totalItems === 0 ? 0 : startIndex + 1}-${endIndex}/${totalItems} hóa đơn
            </div>
            <div class="flex items-center gap-2">
                <button class="w-8 h-8 rounded-md border border-slate-200 text-slate-300 cursor-not-allowed" disabled>
                    &lt;
                </button>
                <div class="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-emerald-500 font-medium">
                    1 / 1
                </div>
                <button class="w-8 h-8 rounded-md border border-slate-200 text-slate-300 cursor-not-allowed" disabled>
                    &gt;
                </button>
            </div>
        `;
    }


    return `
        <div class="text-slate-500">
            Hiển thị ${startIndex + 1}-${endIndex}/${totalItems} hóa đơn
        </div>


        <div class="flex items-center gap-2">
            <button
                class="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center ${
                    currentPage <= 1
                        ? "text-slate-300 cursor-not-allowed bg-slate-50"
                        : "text-slate-500 hover:bg-slate-50"
                }"
                data-page="${currentPage - 1}"
                ${currentPage <= 1 ? "disabled" : ""}
            >
                &lt;
            </button>


            <div class="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-emerald-500 font-medium">
                ${currentPage} / ${totalPages}
            </div>


            <button
                class="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center ${
                    currentPage >= totalPages
                        ? "text-slate-300 cursor-not-allowed bg-slate-50"
                        : "text-slate-500 hover:bg-slate-50"
                }"
                data-page="${currentPage + 1}"
                ${currentPage >= totalPages ? "disabled" : ""}
            >
                &gt;
            </button>
        </div>
    `;
}

// Gắn sự kiện cho các nút phân trang
function bindUnpaidBillsPagination(totalPages) {
    const pagination = document.getElementById("unpaidBillsPagination");
    if (!pagination) return;


    pagination.querySelectorAll("button[data-page]").forEach(button => {
        button.addEventListener("click", function () {
            const page = Number(this.dataset.page);

            if (page < 1 || page > totalPages) return;

            unpaidBillsState.currentPage = page;
            renderUnpaidBills(unpaidBillsState.data);
        });
    });
}
// =========================
// RENDER BẢNG HÓA ĐƠN CHƯA THANH TOÁN

async function loadUnpaidBills(year) {
    try {
        const response = await fetch(`${BASE_URL}/api/HoaDon`);
        if (!response.ok) throw new Error("Không thể lấy dữ liệu hóa đơn");

        const data = await response.json();
        // Lọc chưa thanh toán, nếu có year thì lọc thêm theo năm
        const unpaid = data.filter(hd => {
            const isUnpaid = (hd.trangThai || hd.TrangThaiThanhToan) === 'Chưa thanh toán';
            if (!year) return isUnpaid;
            const hdNam = hd.nam || hd.Nam || (hd.ngayLap ? new Date(hd.ngayLap).getFullYear() : null);
            return isUnpaid && hdNam == year;
        });

        unpaidBillsState.currentPage = 1;
        renderUnpaidBills(unpaid);
    } catch (error) {
        console.error("Lỗi load công nợ:", error);
    }
}


// ==========================================================
// HÀM CON 2: LOAD DOANH THU THEO NĂM TỪ API
// ==========================================================
async function loadDoanhThuTheoNam(year) {
    try {
        // Log để debug xem đang load năm nào
        console.log("Đang load doanh thu năm:", year);

        // Gọi API backend lấy dữ liệu doanh thu theo năm
        const response = await fetch(`${BASE_URL}/api/doanhthu/${year}`);

        // Nếu response lỗi (status != 200)
        if (!response.ok) {
            throw new Error("Không thể lấy dữ liệu doanh thu");
        }

        // Chuyển dữ liệu về dạng JSON
        const result = await response.json();

        // Log dữ liệu API trả về để debug
        console.log("Dữ liệu doanh thu API trả về:", result);

        // Lưu dữ liệu vào biến toàn cục theo từng năm
        doanhThuTheoNam[year] = {
            // Doanh thu phòng (mảng 12 tháng)
            phong: result.phong || Array(12).fill(0),

            // Doanh thu điện nước (mảng 12 tháng)
            dienNuoc: result.dienNuoc || Array(12).fill(0),
        };

        // Kiểm tra lại dữ liệu sau khi gán
        console.log("doanhThuTheoNam sau khi gán:", doanhThuTheoNam);

        // Vẽ lại biểu đồ doanh thu
        drawChartDoanhThu();
    } catch (error) {
        // Log lỗi ra console
        console.error("Lỗi load doanh thu:", error);

        // Hiển thị lỗi cho người dùng
        showToast("Lỗi load doanh thu: " + error.message, "error");
    }
}

// ==========================================================
// HÀM CON 3: XỬ LÝ DỮ LIỆU THỰC TẾ & RENDER UI + CHART
// ==========================================================
function processAndRenderRealData(data) {
    // ======================================================
    // 1. TÍNH TOÁN CÁC CHỈ SỐ TỔNG QUAN (STAT CARDS)
    // ======================================================

    // Tổng số phòng
    const totalRoom = data.length;

    // Số phòng trống
    const emptyRoom = data.filter((r) => r.TrangThaiPhong === "Trống").length;

    // Số phòng đầy
    const fullRoom = data.filter((r) => r.TrangThaiPhong === "Đầy").length;

    // Tổng số sinh viên hiện tại
    const totalSV = data.reduce((sum, r) => sum + r.SoSinhVienHienTai, 0);

    // Tổng sức chứa tối đa của tất cả phòng
    const totalCap = data.reduce((sum, r) => sum + r.SucChuaToiDa, 0);

    // ======================================================
    // 2. THỐNG KÊ THEO GIỚI TÍNH (NAM / NỮ)
    // ======================================================

    // Lọc phòng nam
    const maleRooms = data.filter((r) => r.LoaiPhong === "Nam");

    // Lọc phòng nữ
    const femaleRooms = data.filter((r) => r.LoaiPhong === "Nữ");

    // Tổng sức chứa phòng nam
    const maleCap = maleRooms.reduce((sum, r) => sum + r.SucChuaToiDa, 0);

    // Tổng sinh viên nam
    const maleSV = maleRooms.reduce((sum, r) => sum + r.SoSinhVienHienTai, 0);

    // Tổng sức chứa phòng nữ
    const femaleCap = femaleRooms.reduce((sum, r) => sum + r.SucChuaToiDa, 0);

    // Tổng sinh viên nữ
    const femaleSV = femaleRooms.reduce((sum, r) => sum + r.SoSinhVienHienTai, 0);

    // ======================================================
    // 3. HIỂN THỊ SỐ LIỆU LÊN UI (STAT CARDS)
    // ======================================================

    document.getElementById("statTotalRoom").innerText = totalRoom;
    document.getElementById("statEmptyRoom").innerText = emptyRoom;
    document.getElementById("statFullRoom").innerText = fullRoom;
    document.getElementById("statTotalSV").innerText = totalSV;

    // ======================================================
    // 4. TÍNH HIỆU SUẤT SỬ DỤNG PHÒNG (%)
    // ======================================================
    // Tránh chia cho 0
    const usageRate = totalCap === 0 ? 0 : Math.round((totalSV / totalCap) * 100);
    baoCaoState.totalRoom = totalRoom;
    baoCaoState.emptyRoom = emptyRoom;
    baoCaoState.fullRoom = fullRoom;
    baoCaoState.totalSV = totalSV;
    baoCaoState.usageRate = usageRate;
    baoCaoState.male = { cap: maleCap, sv: maleSV };
    baoCaoState.female = { cap: femaleCap, sv: femaleSV };
    // Hiển thị lên UI
    document.getElementById("usageRateText").innerText = usageRate + "%";

    // ======================================================
    // 5. THỐNG KÊ THEO KHU VỰC (A, B, C,...)
    // ======================================================

    let areaStats = {};

    // Gom nhóm theo khu
    data.forEach((r) => {
        // Nếu chưa có khu thì khởi tạo
        if (!areaStats[r.Khu]) {
            areaStats[r.Khu] = { capacity: 0, students: 0 };
        }

        // Cộng dồn sức chứa và số sinh viên
        areaStats[r.Khu].capacity += r.SucChuaToiDa;
        areaStats[r.Khu].students += r.SoSinhVienHienTai;
    });

    // ======================================================
    // 6. RENDER BẢNG KHU VỰC
    // ======================================================

    let htmlArea = "";

    // Duyệt từng khu (sort để hiển thị theo thứ tự)
    Object.keys(areaStats)
        .sort()
        .forEach((Khu) => {
            let T = areaStats[Khu].capacity; // tổng sức chứa
            let S = areaStats[Khu].students; // tổng sinh viên

            // Tính tỷ lệ %
            let ratio = T === 0 ? 0 : Math.round((S / T) * 100);

            // Chọn màu theo mức độ sử dụng
            let color =
                ratio > 90
                    ? "bg-red-500" // quá tải
                    : ratio < 50
                        ? "bg-amber-500" // thấp
                        : "bg-emerald-500"; // ổn

            // Tạo HTML cho từng dòng
            htmlArea += `
        <tr class="border-b last:border-0">
            <td class="py-2 text-xs font-semibold text-slate-500 uppercase">Khu ${Khu}</td>
            <td class="text-xs text-slate-500">${T}</td>
            <td class="text-xs text-emerald-500 font-semibold">${S}</td>
            <td class="w-28">
                <div class="flex items-center gap-2">
                    <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div class="${color} h-full" style="width:${ratio}%"></div>
                    </div>
                    <span class="text-[10px] font-semibold text-slate-500">${ratio}%</span>
                </div>
            </td>
        </tr>`;
        });

    // Gán vào bảng
    document.getElementById("areaStatsTable").innerHTML = htmlArea;

    // ======================================================
    // 7. VẼ BIỂU ĐỒ
    // ======================================================

    // Vẽ biểu đồ giới tính (dựa trên API riêng)
    drawChartGioiTinh();

    // Vẽ các biểu đồ thực tế (custom)
    drawRealCharts({
        male: { cap: maleCap, sv: maleSV },
        female: { cap: femaleCap, sv: femaleSV },
        usageRate: usageRate,
    });
}

// =========================
// VẼ BIỂU ĐỒ TỶ LỆ RỜI BỎ (BAR CHART)
// =========================
function drawChartRoiBo() {
    const ctx = document.getElementById("chartRoiBo");
    if (!ctx) return;

    const year = baoCaoState.selectedYear;
    const data = tyLeRoiBoTheoNam[year] || Array(12).fill(0);

    // ✅ FIX
    destroyIfExists(chartRoiBoInstance);

    chartRoiBoInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"],
            datasets: [
                {
                    label: "Tỷ lệ rời bỏ (%)",
                    data: data,
                    borderColor: "#f97316",
                    backgroundColor: "rgba(249,115,22,0.08)",
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: "#f97316",
                    pointBorderColor: "#fff",
                    pointBorderWidth: 2,
                    tension: 0.4,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    align: "end",
                    labels: {
                        color: "#64748b",
                        font: { size: 11 },
                        usePointStyle: true,
                        pointStyle: "circle",
                        generateLabels: () => [{
                            text: "Tỷ lệ rời bỏ (%)",
                            fillStyle: "#f97316",
                            strokeStyle: "#f97316",
                            lineWidth: 0,
                            pointStyle: "circle",
                            hidden: false,
                        }],
                    },
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: "#1e293b",
                    titleColor: "#f1f5f9",
                    bodyColor: "#cbd5e1",
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => ` Tỷ lệ rời bỏ: ${ctx.parsed.y}%`,
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 11 } },
                    border: { display: false },
                },
                y: {
                    beginAtZero: true,
                    min: 0,
                    max: 100,
                    ticks: {
                        color: "#64748b",
                        font: { size: 11 },
                        stepSize: 20,
                        callback: (v) => v + "%",
                    },
                    grid: { color: "#e2e8f0", borderDash: [5, 5] },
                    border: { display: false },
                },
            },
        },
    });
}

// =========================
// VẼ BIỂU ĐỒ THỰC TẾ (PIE/DONUT CHART)
// =========================
function drawRealCharts(data) {
    // data gồm:
    // {
    //   male: { cap, sv },
    //   female: { cap, sv },
    //   usageRate: %
    // }

    // =========================
    // 1. BIỂU ĐỒ HIỆU SUẤT SỬ DỤNG (DONUT)
    // =========================

    // Xóa chart cũ nếu tồn tại
    destroyIfExists(chartPieUsageInstance);

    // Khởi tạo chart mới
    chartPieUsageInstance = new Chart(document.getElementById('chartPieUsage'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [data.usageRate, 100 - data.usageRate],
                backgroundColor: ['#10b981', '#e2e8f0'],
                borderWidth: 0,
                cutout: '80%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}


function openReportPreview() {
    // Mở modal xem trước báo cáo
    const modal = document.getElementById("reportPreviewModal");
    if (!modal) return;

    renderReportPreviewContent();

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    const btnClose = document.getElementById("btnCloseReportPreview");
    const btnPrint = document.getElementById("btnPrintReport");
    const btnDownload = document.getElementById("btnDownloadReport");

    if (btnDownload) btnDownload.onclick = downloadReportPreview;
    if (btnClose)    btnClose.onclick    = closeReportPreview;
    if (btnPrint)    btnPrint.onclick    = printReportPreview;
}

function closeReportPreview() {
    const modal = document.getElementById("reportPreviewModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}
// Render nội dung báo cáo vào modal
function renderReportPreviewContent() {
    const container = document.getElementById("reportPreviewContent");
    if (!container) return;

    const year = baoCaoState.selectedYear;
    const doanhThu = doanhThuTheoNam[year] || { phong: [], dienNuoc: [] };

    const totalRevenuePhong = (doanhThu.phong || []).reduce(
        (sum, value) => sum + Number(value || 0),
        0,
    );
    const totalRevenueDienNuoc = (doanhThu.dienNuoc || []).reduce(
        (sum, value) => sum + Number(value || 0),
        0,
    );
    // Tổng doanh thu là tổng của doanh thu phòng và điện nước
    const totalRevenue = totalRevenuePhong + totalRevenueDienNuoc;
// Lấy dữ liệu tổng số phòng và sinh viên từ state
    const totalRooms = baoCaoState.totalRoom || 0;
    const totalStudents = baoCaoState.totalSV || 0;
// Lấy dữ liệu hợp đồng sắp hết hạn và hóa đơn chưa thanh toán từ state
    const expiringContracts = reportState.expiringContracts || [];
    const unpaidBills = reportState.unpaidBills || [];

    // Helper lấy field linh hoạt
    const getVal = (item, ...keys) => { for (const k of keys) if (item[k] != null) return item[k]; return ""; };

    const expiringHtml = expiringContracts.length
        ? expiringContracts.map((item, index) => `
            <tr class="border-b">
                <td class="p-2">${index + 1}</td>
                <td class="p-2">${getVal(item, 'MSSV', 'MaSinhVien')}</td>
                <td class="p-2">${getVal(item, 'TenSV', 'HoTen')}</td>
                <td class="p-2">${getVal(item, 'TenPhong')}</td>
                <td class="p-2 text-right">${getVal(item, 'ConLai', 'conLai') ?? 0} ngày</td>
            </tr>`).join("")
        : `<tr><td colspan="5" class="p-3 text-center text-slate-500">Không có dữ liệu</td></tr>`;

    const unpaidHtml = unpaidBills.length
        ? unpaidBills.map((item, index) => {
            const tongTien = Number(item.tongTien || item.TongTien) ||
                (Number(item.tienPhong || item.TienPhong || 0) + Number(item.tienDien || item.TienDien || 0) + Number(item.tienNuoc || item.TienNuoc || 0));
            return `
                <tr class="border-b">
                    <td class="p-2">${index + 1}</td>
                    <td class="p-2">${getVal(item, 'id', 'MaHoaDon')}</td>
                    <td class="p-2">${getVal(item, 'tenPhong', 'TenPhong')}</td>
                    <td class="p-2">${(item.thang || item.Thang) ? `T${item.thang || item.Thang}/${item.nam || item.Nam}` : '---'}</td>
                    <td class="p-2 text-right">${formatMoney(tongTien)}</td>
                </tr>`;
        }).join("")
        : `<tr><td colspan="5" class="p-3 text-center text-slate-500">Không có dữ liệu</td></tr>`;

    container.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-center text-slate-900 mb-2">BÁO CÁO TỔNG HỢP</h2>
            <p class="text-center text-slate-500">Năm ${year}</p>
        </div>


        <div class="grid grid-cols-3 gap-4 mb-8">
            <div class="border rounded-xl p-4 bg-slate-50">
                <p class="text-sm text-slate-500 mb-1">Tổng doanh thu</p>
                <p class="text-2xl font-bold text-green-600">${formatMoney(totalRevenue)}</p>
            </div>
            <div class="border rounded-xl p-4 bg-slate-50">
                <p class="text-sm text-slate-500 mb-1">Tổng số sinh viên</p>
                <p class="text-2xl font-bold text-emerald-600">${totalStudents}</p>
            </div>
            <div class="border rounded-xl p-4 bg-slate-50">
                <p class="text-sm text-slate-500 mb-1">Tổng số phòng</p>
                <p class="text-2xl font-bold text-purple-600">${totalRooms}</p>
            </div>
        </div>


        <div class="mb-8">
            <h3 class="text-lg font-bold text-slate-900 mb-3">Sinh viên sắp hết hạn hợp đồng</h3>
            <div class="overflow-x-auto border rounded-lg">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 text-slate-500">
                        <tr>
                            <th class="p-2 text-left">STT</th>
                            <th class="p-2 text-left">MSSV</th>
                            <th class="p-2 text-left">Họ tên</th>
                            <th class="p-2 text-left">Phòng</th>
                            <th class="p-2 text-right">Còn lại</th>
                        </tr>
                    </thead>
                    <tbody>${expiringHtml}</tbody>
                </table>
            </div>
        </div>


        <div>
            <h3 class="text-lg font-bold text-slate-900 mb-3">Danh sách công nợ</h3>
            <div class="overflow-x-auto border rounded-lg">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 text-slate-500">
                        <tr>
                            <th class="p-2 text-left">STT</th>
                            <th class="p-2 text-left">Mã HĐ</th>
                            <th class="p-2 text-left">Phòng</th>
                            <th class="p-2 text-left">Tháng/Năm</th>
                            <th class="p-2 text-right">Số tiền</th>
                        </tr>
                    </thead>
                    <tbody>${unpaidHtml}</tbody>
                </table>
            </div>
        </div>
    `;
}

function printReportPreview() {
    const content = document.getElementById("reportPreviewContent");
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Trình duyệt chặn popup. Vui lòng cho phép popup để in!"); return; }
    printWindow.document.write(`
        <html>
        <head>
            <title>In báo cáo</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 24px;
                    color: #0f172a;
                }
                h2, h3 {
                    margin-bottom: 12px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 24px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background: #f1f5f9;
                }
                .text-right {
                    text-align: right;
                }
                .grid {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 24px;
                }
                .card {
                    flex: 1;
                    border: 1px solid #ddd;
                    border-radius: 12px;
                    padding: 16px;
                    background: #f8fafc;
                }
            </style>
        </head>
        <body>
            ${content.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    }
function downloadReportPreview() {
    const year = baoCaoState.selectedYear || new Date().getFullYear();
    const doanhThu = doanhThuTheoNam[year] || { phong: [], dienNuoc: [] };
    const expiringContracts = reportState.expiringContracts || [];
    const unpaidBills = reportState.unpaidBills || [];

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Tổng quan ──────────────────────────────────
    const tongPhong = doanhThu.phong || Array(12).fill(0);
    const tongDienNuoc = doanhThu.dienNuoc || Array(12).fill(0);
    const thangLabels = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                         "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];

    const tongQuanData = [
        [`BÁO CÁO TỔNG HỢP NĂM ${year}`],
        [],
        ["Tổng số phòng", baoCaoState.totalRoom || 0],
        ["Phòng trống",   baoCaoState.emptyRoom || 0],
        ["Phòng đầy",     baoCaoState.fullRoom  || 0],
        ["Tổng sinh viên",baoCaoState.totalSV   || 0],
        ["Hiệu suất sử dụng", `${baoCaoState.usageRate || 0}%`],
        [],
        ["DOANH THU THEO THÁNG"],
        ["Tháng", "Doanh thu phòng (VNĐ)", "Điện/Nước (VNĐ)", "Tổng (VNĐ)"],
        ...thangLabels.map((t, i) => [
            t,
            Number(tongPhong[i] || 0),
            Number(tongDienNuoc[i] || 0),
            Number(tongPhong[i] || 0) + Number(tongDienNuoc[i] || 0),
        ]),
        [],
        ["Tổng cộng",
            tongPhong.reduce((s, v) => s + Number(v || 0), 0),
            tongDienNuoc.reduce((s, v) => s + Number(v || 0), 0),
            tongPhong.reduce((s, v) => s + Number(v || 0), 0) + tongDienNuoc.reduce((s, v) => s + Number(v || 0), 0),
        ],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(tongQuanData);
    ws1["!cols"] = [{ wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Tổng quan");

    // ── Sheet 2: Hợp đồng sắp hết hạn ──────────────────────
    const hdData = [
        [`HỢP ĐỒNG SẮP HẾT HẠN - NĂM ${year}`],
        [],
        ["STT", "MSSV", "Họ và tên", "Phòng", "Số ngày còn lại"],
        ...expiringContracts.map((item, i) => [
            i + 1,
            item.MSSV || item.MaSinhVien || "",
            item.TenSV || item.HoTen || "",
            item.TenPhong || "",
            item.ConLai ?? item.conLai ?? 0,
        ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(hdData);
    ws2["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 25 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Hợp đồng sắp hết hạn");

    // ── Sheet 3: Hóa đơn chưa thanh toán ───────────────────
    const hdttData = [
        [`HÓA ĐƠN CHƯA THANH TOÁN - NĂM ${year}`],
        [],
        ["STT", "Mã HĐ", "Phòng", "Tháng/Năm", "Số tiền (VNĐ)"],
        ...unpaidBills.map((item, i) => {
            const tongTien = Number(item.tongTien || item.TongTien) ||
                (Number(item.tienPhong || item.TienPhong || 0) + Number(item.tienDien || item.TienDien || 0) + Number(item.tienNuoc || item.TienNuoc || 0));
            const thangNam = (item.thang || item.Thang) ? `T${item.thang || item.Thang}/${item.nam || item.Nam}` : '';
            return [i + 1, item.id || item.MaHoaDon || "", item.tenPhong || item.TenPhong || "", thangNam, tongTien];
        }),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(hdttData);
    ws3["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 25 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Hóa đơn chưa thanh toán");

    // ── Xuất file ───────────────────────────────────────────
    XLSX.writeFile(wb, `BaoCaoTongHop_${year}.xlsx`);
}