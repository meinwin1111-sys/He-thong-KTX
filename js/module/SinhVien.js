/**
 * BIẾN TOÀN CỤC - QUẢN LÝ TRẠNG THÁI DỮ LIỆU
 */
let totalStudentsFromDB = 0;
let maleStudentsFromDB = 0;
let femaleStudentsFromDB = 0;

let totalPagesFromDB = 1;

let students = [];
let currentFilteredStudents = [];
const rowsPerPage = 10;
let currentPage = 1;
let currentDetailIndex = null;
let currentEditIndex = null;

let validRooms = [];
let roomCapacity = {};

const studentIdentityValidationMessage = value => window.StudentIdentity.validateStudentIdentity(value).message;
const studentIdentityDuplicateMessage = name =>
    `Số CCCD/hộ chiếu đã được đăng ký cho sinh viên ${String(name || "khác").trim()}.`;
window.AdminStudentValidation = Object.freeze({
    studentIdentityValidationMessage,
    studentIdentityDuplicateMessage
});

// Hàm khởi tạo để tải cấu hình phòng từ Server khi module được kích hoạt
async function loadRoomConfig() {
    try {
        const response = await ApiClient.fetch(`${BASE_URL}/api/Phong`);
        const data = await response.json();

        // Lưu toàn bộ data phòng để filter theo giới tính
        window._allRooms = Array.isArray(data) ? data : [];

        // validRooms: chỉ phòng còn chỗ (không đầy, không bảo trì)
        validRooms = window._allRooms
            .filter(p => p.TrangThaiPhong === "Trống" || p.TrangThaiPhong === "Còn chỗ")
            .map(p => p.TenPhong);

        // roomCapacity: map tên phòng → sức chứa
        roomCapacity = {};
        window._allRooms.forEach(p => {
            roomCapacity[p.TenPhong] = p.SucChuaToiDa;
        });

        console.log("Đã tải cấu hình phòng thành công:", validRooms.length, "phòng trống");
    } catch (error) {
        validRooms = [];
        roomCapacity = {};
        window._allRooms = [];
        showToast(error.message || "Không thể tải danh sách phòng.", "error");
    }
}

/**
 * HÀM RENDER MODULE SINH VIÊN
 * Khởi tạo giao diện chính, các thẻ thống kê và bảng danh sách
 */
async function renderSinhVienModule() {
    const main = document.getElementById("main-content");

    await loadRoomConfig();

    // Thiết lập cấu trúc HTML cho Module
    main.innerHTML = `
        <section class="p-6">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-3xl font-bold text-slate-900">Quản lý Sinh viên</h2>
                    <p class="text-slate-500 mt-1 font-medium text-[13px]">
                        <span class="hover:text-emerald-600 cursor-pointer" onclick="switchPage('Trang Chu', document.querySelectorAll('.nav-item')[0])">Trang chủ</span>
                        <span class="mx-1">></span>
                        <span>Sinh viên</span>
                    </p>
                </div>

                <button id="btnOpenAddStudent"
                    class="bg-[#059669] text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all border-none shadow-lg">
                    <i class="fa-solid fa-circle-plus"></i> Thêm sinh viên
                </button>
            </div>

            <div class="flex gap-4 mb-8">
                <div class="stat-card text-left cursor-pointer hover:shadow-md transition-all">
                    <p class="text-[10px] font-bold text-slate-500 uppercase mb-1">Tổng sinh viên</p>
                    <p class="text-3xl font-bold text-slate-900" id="tongSinhVienStat"></p>
                </div>

                <div class="stat-card border-l-4 border-green-500 text-left cursor-pointer hover:shadow-md transition-all">
                    <p class="text-[10px] font-bold text-slate-500 uppercase mb-1">Sinh viên Nam</p>
                    <p class="text-3xl font-bold text-green-500" id="tongNamStat"></p>
                </div>

                <div class="stat-card border-l-4 border-red-500 text-left cursor-pointer hover:shadow-md transition-all">
                    <p class="text-[10px] font-bold text-slate-500 uppercase mb-1">Sinh viên Nữ</p>
                    <p class="text-3xl font-bold text-red-500" id="tongNuStat"></p>
                </div>

                <div class="stat-card border-l-4 border-emerald-500 text-left cursor-pointer hover:shadow-md transition-all">
                    <p class="text-[10px] font-bold text-slate-500 uppercase mb-1">Đang lưu trú</p>
                    <p class="text-3xl font-bold text-emerald-500" id="statLiving"></p>
                </div>
            </div>

            <div class="flex items-center gap-3 mb-2">
                <input id="studentSearch" type="text" placeholder="Tìm tên sinh viên..."
                    class="border-none rounded px-4 py-2 w-64 outline-none bg-white shadow-sm focus:ring-1 focus:ring-emerald-400 text-sm">

                <select id="studentStatusFilter"
                    class="border-none rounded px-4 py-2 text-slate-500 outline-none bg-white shadow-sm cursor-pointer text-sm">
                    <option value="">Trạng thái sinh viên</option>
                    <option value="Đang ở">Đang ở</option>
                    <option value="Đã rời khỏi">Đã rời khỏi</option>
                </select>

                <button id="btnResetText" class="text-slate-500 hover:text-red-500 text-sm transition-colors flex items-center gap-1">
                    <i class="fa-solid fa-rotate-left"></i> Reset lọc
                </button>
            </div>

            <p id="studentLoadError" class="mb-3 min-h-5 text-sm text-red-700" role="alert" aria-live="polite"></p>
            <p id="studentCountText" class="admin-list-summary text-sm text-slate-600" aria-live="polite"></p>
            <div data-no-admin-filters class="bg-white rounded-lg shadow-sm overflow-x-auto border border-slate-200">
                <table class="min-w-[1620px] w-full text-left table-fixed">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr class="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                            <th class="px-5 py-4 w-[190px] whitespace-nowrap">Số CCCD</th>
                            <th class="px-5 py-4 w-[190px]">Tên sinh viên</th>
                            <th class="px-5 py-4 w-[120px] whitespace-nowrap">Ngày sinh</th>
                            <th class="px-5 py-4 w-[85px] whitespace-nowrap">Giới tính</th>
                            <th class="px-5 py-4 w-[130px] whitespace-nowrap">Điện thoại</th>
                            <th class="px-5 py-4 w-[220px]">Email</th>
                            <th class="px-5 py-4 w-[180px]">Địa chỉ</th>
                            <th class="px-5 py-4 w-[95px] whitespace-nowrap">Phòng</th>
                            <th class="px-5 py-4 w-[130px] whitespace-nowrap">Trạng thái</th>
                            <th class="px-5 py-4 w-[130px]">Ghi chú</th>
                            <th class="px-5 py-4 w-[150px] text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="studentTableBody" class="divide-y divide-slate-100">
                        </tbody>
                </table>

                <footer class="px-8 py-4 flex justify-between items-center text-slate-500 bg-white border-t border-slate-200 text-xs">
                    <div class="flex items-center gap-3">
                        <button id="btnPrevPage" class="hover:text-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <div class="flex items-center gap-1 font-medium">
                            <span id="currentPageBox" class="text-emerald-600 font-bold border border-emerald-100 bg-emerald-50 px-2 py-0.5 rounded">1</span>
                            <span class="mx-1">/</span>
                            <span id="totalPageText">1</span>
                        </div>
                        <button id="btnNextPage" class="hover:text-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                </footer>
            </div>

            <div id="addStudentModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
                <div class="bg-white w-[470px] rounded-xl shadow-xl p-6 relative">
                    <h3 class="text-2xl font-bold text-slate-900 mb-5">Thêm sinh viên mới</h3>
                    <form id="addStudentForm" class="space-y-4">
                        ${renderStudentForm("", true)}
                        <div class="flex justify-end gap-2 pt-4 border-t border-slate-200">
                            <button type="submit" class="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-all">Lưu</button>
                            <button type="button" id="btnCloseAddStudent" class="bg-slate-100 text-slate-500 px-5 py-2 rounded-lg font-bold hover:bg-slate-200 transition-all">Hủy</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="editStudentModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
                <div class="bg-white w-[470px] rounded-xl shadow-xl p-6 relative">
                    <h3 class="text-2xl font-bold text-slate-900 mb-5">Cập nhật thông tin</h3>
                    <form id="editStudentForm" class="space-y-4">
                        <div id="editStudentFormContainer"></div>
                        <div class="flex justify-end gap-2 pt-4 border-t border-slate-200">
                            <button type="submit" class="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-all">Lưu thay đổi</button>
                            <button type="button" id="btnCloseEditStudent" class="bg-slate-100 text-slate-500 px-5 py-2 rounded-lg font-bold hover:bg-slate-200 transition-all">Hủy</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="detailStudentModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
                <div class="bg-white w-[520px] rounded-xl shadow-xl p-6 relative">
                    <h3 class="text-2xl font-bold text-emerald-800 mb-5 border-b border-slate-200 pb-3">Chi tiết sinh viên</h3>
                    <div id="detailStudentContent"></div>
                    <div class="flex justify-end gap-2 mt-6">
                        <button id="btnEditFromDetail" class="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-all">Sửa</button>
                        <button id="btnCloseDetailStudent" class="bg-slate-100 text-slate-500 px-5 py-2 rounded-lg font-bold hover:bg-slate-200 transition-all">Đóng</button>
                    </div>
                </div>
            </div>
        </section>
    `;

    initStudentEvents(); // Gán sự kiện cho các phần tử sau khi đã render xong
    // Khởi chạy nạp dữ liệu từ Server sau khi giao diện đã sẵn sàng
    loadThongKeSinhVien();
    loadDanhSachSinhVien(1, rowsPerPage, "", "");
}


/**
 * Chuyển đổi dữ liệu từ API sang định dạng hiển thị trong ứng dụng
 * @param {Object} item - Đối tượng sinh viên thô từ API
 */
function normalizeStudentFromAPI(item) {
    return {
        mssv: item.MaSinhVien || "",
        school: item.Truong || "",
        name: item.HoTen || "",
        birthday: formatApiDateToDisplay(item.NgaySinh),
        gender: item.GioiTinh || "",
        phone: item.SoDienThoai || "",
        email: item.Email || "",
        address: item.DiaChi || "-",
        room: item.TenPhong || "",
        status: item.TrangThaiSinhVien || "",
        note: item.GhiChu || "-",
    };
}

/**
 * Lấy dữ liệu thống kê tổng hợp (Tổng, Nam, Nữ) và hiển thị lên các thẻ KPI
 */
async function loadThongKeSinhVien() {
    try {
        const response = await ApiClient.fetch(`${BASE_URL}/api/sinhvien/thongke`);
        if (!response.ok) {
            const text = await response.text();
            console.error("API lỗi:", text);
            return;
        }

        // Cách lấy mới: Destructuring trực tiếp từ JSON trả về
        const { tongSinhVien, tongNam, tongNu, dangO } = await response.json();

        // 1. Cập nhật biến toàn cục
        totalStudentsFromDB = tongSinhVien || 0;
        maleStudentsFromDB = tongNam || 0;
        femaleStudentsFromDB = tongNu || 0;
        const livingCount = dangO || 0;

        // 2. Cập nhật giao diện
        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val.toLocaleString();
        };

        updateText("tongSinhVienStat", totalStudentsFromDB);
        updateText("tongNamStat", maleStudentsFromDB);
        updateText("tongNuStat", femaleStudentsFromDB);
        updateText("statLiving", livingCount);

    } catch (error) {
        showToast(error.message || "Không thể tải thống kê sinh viên.", "error");
    }
}

/**
 * Tải danh sách sinh viên có hỗ trợ Phân trang, Tìm kiếm và Lọc trạng thái
 */
async function loadDanhSachSinhVien(
    page = 1,
    pageSize = 10,
    keyword = "",
    status = "",
) {
    try {
        let url = `${BASE_URL}/api/sinhvien?page=${page}&pageSize=${pageSize}`;

        // Gắn tham số tìm kiếm nếu có
        if (keyword) {
            url += `&keyword=${encodeURIComponent(keyword)}`;
        }

        // Gắn tham số lọc trạng thái nếu có
        if (status) {
            url += `&status=${encodeURIComponent(status)}`;
        }

        const response = await ApiClient.fetch(url);
        const result = await response.json();
        if (!result || !Array.isArray(result.data)) {
            throw new Error("Dữ liệu danh sách sinh viên từ máy chủ không hợp lệ.");
        }

        // Chuẩn hóa và lưu trữ danh sách
        students = result.data.map(normalizeStudentFromAPI);
        currentFilteredStudents = [...students];
        const loadError = document.getElementById("studentLoadError");
        if (loadError) loadError.textContent = "";

        // Cập nhật thông tin phân trang
        currentPage = result.page || 1;
        totalPagesFromDB = result.totalPages || 1;
        totalStudentsFromDB = result.total || 0;

        // Vẽ lại bảng dữ liệu
        renderTable(students);
    } catch (error) {
        console.error("Lỗi tải danh sách sinh viên:", error);
        students = [];
        currentFilteredStudents = [];
        const tableBody = document.getElementById("studentTableBody");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="11" class="text-center py-10 text-red-700">Không thể tải danh sách sinh viên.</td></tr>';
        const loadError = document.getElementById("studentLoadError");
        const message = error.message || "Không thể tải danh sách sinh viên.";
        if (loadError) loadError.textContent = message;
        showToast(message, "error");
    }
}

/**
 * Tạo nhãn Badge màu sắc cho cột trạng thái
 */
function getStatusBadge(status) {
    const label = window.AdminWorkflowUtils?.displayLabel(status, "Chưa xếp phòng") || "Chưa xếp phòng";
    return window.AdminWorkflowUtils?.statusBadge(label, "min-w-[100px]") || escapeStudentHtml(label);
}

/**
 * Render cụm nút hành động (Xem, Sửa) cho từng dòng
 */
function renderActionButtons(studentIndex) {
    return `
            <div class="flex items-center justify-center gap-2">
                <button onclick="openDetailStudentModal(${studentIndex})"
                    class="h-[26px] px-2 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] text-[11px] flex items-center gap-1 hover:bg-[#f1f5f9]">
                    <span>👁</span> <span>Xem</span>
                </button>
                <button onclick="openEditStudentModal(${studentIndex})"
                    class="h-[26px] px-2 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] text-[11px] flex items-center gap-1 hover:bg-[#f1f5f9]">
                    <span>✎</span> <span>Sửa</span>
                </button>
            </div>
        `;
}

/**
 * Hàm vẽ bảng dữ liệu Sinh viên (Đã đồng bộ giao diện với module Phòng)
 * @param {Array} data - Mảng danh sách sinh viên
 */
function renderTable(data) {
    const tableBody = document.getElementById("studentTableBody");
    const studentCountText = document.getElementById("studentCountText");
    const currentPageBox = document.getElementById("currentPageBox");
    const totalPageText = document.getElementById("totalPageText");
    if (!tableBody) return;
    const U = window.AdminWorkflowUtils;
    const columns = [
        { label: "Số CCCD", width: 180, render: student => escapeStudentHtml(window.AdminWorkflowUtils.maskStudentId(student.mssv)), longText: true, title: student => window.AdminWorkflowUtils.maskStudentId(student.mssv) },
        { label: "Tên sinh viên", width: 220, render: student => escapeStudentHtml(student.name || "—"), longText: true, title: student => student.name || "—" },
        { label: "Ngày sinh", width: 130, render: student => escapeStudentHtml(student.birthday || "—") },
        { label: "Giới tính", width: 100, render: student => escapeStudentHtml(U?.displayLabel(student.gender) || student.gender || "—") },
        { label: "Điện thoại", width: 150, render: student => escapeStudentHtml(student.phone || "—") },
        { label: "Email", width: 260, render: student => escapeStudentHtml(student.email || "—"), longText: true, title: student => student.email || "—" },
        { label: "Địa chỉ", width: 260, render: student => escapeStudentHtml(student.address || "—"), longText: true, title: student => student.address || "—" },
        { label: "Phòng", width: 130, render: student => escapeStudentHtml(student.room || "—") },
        { label: "Trạng thái", width: 160, render: student => getStatusBadge(student.status) },
        { label: "Ghi chú", width: 180, render: student => escapeStudentHtml(student.note || "—"), longText: true, title: student => student.note || "—" },
        { label: "Thao tác", width: 150, render: (_, index) => renderActionButtons(index) }
    ];
    const table = tableBody.closest("table");
    if (!table) return;
    const tableHost = table.parentElement;
    table.outerHTML = U.renderTable(columns, data, "Không có sinh viên phù hợp", () =>
        'class="hover:bg-slate-50 transition-colors text-[13px] text-slate-500"', "min-w-[1620px] table-fixed");
    const nextBody = tableHost.querySelector("table tbody");
    if (nextBody) nextBody.id = "studentTableBody";

    const displayStart =
        totalStudentsFromDB === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const displayEnd = Math.min(currentPage * rowsPerPage, totalStudentsFromDB);

    studentCountText.textContent = `Tổng: ${totalStudentsFromDB} sinh viên`;
    currentPageBox.textContent = currentPage;
    totalPageText.textContent = totalPagesFromDB;

    updatePaginationButtons(totalPagesFromDB);
}

function escapeStudentHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
}

// ====================================================================================================================
// XỬ LÝ PHÂN TRANG (PAGINATION)
// ====================================================================================================================

/**
 * Cập nhật trạng thái hiển thị và hiệu ứng của các nút chuyển trang
 * @param {number} totalPages - Tổng số trang hiện có
 */
function updatePaginationButtons(totalPages) {
    const btnPrevPage = document.getElementById("btnPrevPage");
    const btnNextPage = document.getElementById("btnNextPage");
    if (!btnPrevPage || !btnNextPage) return;

    // Kiểm tra điều kiện để khóa nút (Trang đầu/cuối hoặc không có dữ liệu)
    btnPrevPage.disabled = currentPage <= 1 || totalPages === 0;
    btnNextPage.disabled = currentPage >= totalPages || totalPages === 0;

    // Cập nhật giao diện nút "Trang trước"
    if (btnPrevPage.disabled) {
        btnPrevPage.className =
            "w-7 h-7 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#e2e8f0] flex items-center justify-center cursor-not-allowed";
    } else {
        btnPrevPage.className =
            "w-7 h-7 rounded border border-[#e2e8f0] bg-white text-[#94A3B8] flex items-center justify-center hover:bg-[#f1f5f9] transition-colors";
    }

    // Cập nhật giao diện nút "Trang sau"
    if (btnNextPage.disabled) {
        btnNextPage.className =
            "w-7 h-7 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#e2e8f0] flex items-center justify-center cursor-not-allowed";
    } else {
        btnNextPage.className =
            "w-7 h-7 rounded border border-[#e2e8f0] bg-white text-[#94A3B8] flex items-center justify-center hover:bg-[#f1f5f9] transition-colors";
    }
}

// ====================================================================================================================
// XỬ LÝ TÌM KIẾM VÀ BỘ LỌC (SEARCH & FILTER)
// ====================================================================================================================

/**
 * Thu thập dữ liệu từ ô tìm kiếm và dropdown để lọc danh sách
 */
async function filterStudents() {
    const keyword = studentSearch.value.trim();
    const status = studentStatusFilter.value;
    // Mỗi khi lọc, hệ thống sẽ tự động quay về trang 1
    await loadDanhSachSinhVien(1, rowsPerPage, keyword, status);
}

/**
 * Xóa sạch các bộ lọc và tải lại danh sách gốc
 */
async function resetFilters() {
    studentSearch.value = "";
    studentStatusFilter.value = "";
    await loadDanhSachSinhVien(1, rowsPerPage, "", "");
}

/**
 * Mở Modal hiển thị chi tiết sinh viên và thông tin hợp đồng liên quan
 */
window.openDetailStudentModal = async function (index) {
    // LẤY BIẾN DOM Ở ĐÂY - Đảm bảo lúc này HTML đã tồn tại
    const detailStudentModal = document.getElementById("detailStudentModal");
    const detailStudentContent = document.getElementById("detailStudentContent");

    if (!detailStudentModal || !detailStudentContent) return;

    try {
        currentDetailIndex = index;
        const s = students[index];

        // 1. Gọi API lấy thông tin chi tiết
        const response = await ApiClient.fetch(
            `${BASE_URL}/api/sinhvien/chitiet/${encodeURIComponent(s.mssv)}`,
        );
        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Không lấy được chi tiết sinh viên", "error");
            return;
        }

        const student = result.student || {};
        const contract = result.contract;

        // 2. Chuẩn hóa dữ liệu hợp đồng (Logic của Tuyết giữ nguyên)
        const contractData = contract ? {
            code: contract.MaHopDong || "--",
            start: formatApiDateToDisplay(contract.NgayBatDau),
            end: formatApiDateToDisplay(contract.NgayKetThuc),
            status: contract.TrangThaiHopDong || "--",
        } : {
            code: "HD---",
            start: "--/--/----",
            end: "--/--/----",
            status: "Chưa có",
        };

        // 3. Render nội dung
        detailStudentContent.innerHTML = `
                <div class="space-y-3 text-[13px]">
                    ${renderDetailField("Số CCCD", student.MaSinhVien || s.mssv)}
                    ${renderDetailField("Họ và tên sinh viên", student.HoTen || s.name)}
                    ${renderDetailField("Ngày sinh", formatApiDateToDisplay(student.NgaySinh))}
                    ${renderDetailField("Giới tính", window.AdminWorkflowUtils?.displayLabel(student.GioiTinh || s.gender) || student.GioiTinh || s.gender)}
                    ${renderDetailField("Số điện thoại", student.SoDienThoai || s.phone)}
                    ${renderDetailField("Email", student.Email || s.email)}
                    ${renderDetailField("Địa chỉ", student.DiaChi || s.address)}
                    ${renderDetailField("Trường", student.Truong || s.school || "—")}
                    ${renderDetailField("Phòng", student.TenPhong || s.room)}
                    ${renderDetailField("Trạng thái sinh viên", window.AdminWorkflowUtils?.displayLabel(student.TrangThaiSinhVien || s.status) || student.TrangThaiSinhVien || s.status)}
                    <div class="pt-2 border-t border-slate-200 mt-1">
                        <p class="font-semibold text-[#0f172a] mb-2">Thông tin hợp đồng:</p>
                        ${renderDetailField("Mã hợp đồng", contractData.code)}
                        ${renderDetailField("Ngày bắt đầu", contractData.start)}
                        ${renderDetailField("Ngày kết thúc", contractData.end)}
                        ${renderDetailField("Trạng thái HĐ", window.AdminWorkflowUtils?.displayLabel(contractData.status) || contractData.status)}
                    </div>
                    ${renderDetailField("Ghi chú", student.GhiChu || s.note || "-")}
                </div>
            `;

        // 4. Hiển thị Modal
        detailStudentModal.classList.remove("hidden");
        detailStudentModal.classList.add("flex");

    } catch (error) {
        showToast(error.message || "Không thể tải chi tiết sinh viên.", "error");
    }
};

/**
 * Hàm đóng Modal xem chi tiết
 */
function closeDetailModal() {
    detailStudentModal.classList.add("hidden");
    detailStudentModal.classList.remove("flex");
}

/**
 * Logic mở Modal sửa và điền dữ liệu sinh viên hiện tại vào form
 * @param {number} index - Vị trí sinh viên trong mảng
 */
function openEditModal(index) {
    // 1. Truy vấn các phần tử DOM ngay khi hàm được gọi
    const editStudentModal = document.getElementById("editStudentModal");
    const editStudentForm = document.getElementById("editStudentForm");
    const editStudentFormContainer = document.getElementById("editStudentFormContainer");

    // Kiểm tra an toàn trước khi xử lý
    if (!editStudentModal || !editStudentFormContainer) {
        console.error("Không tìm thấy các phần tử Modal chỉnh sửa trong DOM.");
        return;
    }

    currentEditIndex = index;
    const s = students[index];

    // 2. Đổ dữ liệu vào form thông qua hàm render đã có
    // Lưu ý: s là dữ liệu sinh viên hiện tại, false nghĩa là chế độ Edit
    editStudentFormContainer.innerHTML = renderStudentForm(s, false);

    // 3. Làm sạch các thông báo lỗi cũ từ lần chỉnh sửa trước
    clearValidationUI(editStudentForm);

    // 4. Hiển thị Modal
    editStudentModal.classList.remove("hidden");
    editStudentModal.classList.add("flex");
}

/**
 * Hàm toàn cục để mở modal chỉnh sửa (gọi từ danh sách bảng hoặc chi tiết)
 */
window.openEditStudentModal = function (index) {
    openEditModal(index);
};

/**
 * Hàm đóng Modal chỉnh sửa
 */
function closeEditModal() {
    editStudentModal.classList.add("hidden");
    editStudentModal.classList.remove("flex");
    clearValidationUI(editStudentForm);
}

/**
 * HÀM THU THẬP DỮ LIỆU TỪ FORM (GETTER)
 * Trích xuất giá trị từ các phần tử input, select, textarea trong form
 * @param {HTMLElement} form - Đối tượng form cần lấy dữ liệu
 */
function getFormData(form) {
    return {
        mssv: (form.querySelector('[name="mssv"]')?.value || "").trim(),
        name: (form.querySelector('[name="name"]')?.value || "").trim(),
        birthday: (form.querySelector('[name="birthday"]')?.value || "").trim(),
        gender: (form.querySelector('[name="gender"]')?.value || "").trim(),
        // Loại bỏ khoảng trắng trong số điện thoại trước khi xử lý
        phone: (form.querySelector('[name="phone"]')?.value || "")
            .replace(/\s/g, "")
            .trim(),
        email: (form.querySelector('[name="email"]')?.value || "").trim(),
        address: (form.querySelector('[name="address"]')?.value || "").trim(),
        school: (form.querySelector('[name="school"]')?.value || "").trim(),
        room: (form.querySelector('[name="room"]')?.value || "").trim(),
        status: (form.querySelector('[name="status"]')?.value || "").trim(),
        note: (form.querySelector('[name="note"]')?.value || "").trim(),
    };
}

/**
 * HÀM KIỂM TRA HỢP LỆ (VALIDATION)
 * Kiểm tra các ràng buộc dữ liệu: trống, định dạng, trùng lặp, sức chứa phòng
 * @param {Object} formData - Dữ liệu cần kiểm tra
 * @param {string} mode - Chế độ "add" hoặc "edit"
 * @param {number} editIndex - Vị trí của sinh viên đang chỉnh sửa
 */
function validateStudentForm(formData, mode = "add", editIndex = null) {
    const errors = {};

    // Kiểm tra số CCCD
    if (!formData.mssv) {
        errors.mssv = "Vui lòng nhập Số CCCD/Hộ chiếu.";
    } else if (mode === "add" && studentIdentityValidationMessage(formData.mssv)) {
        errors.mssv = studentIdentityValidationMessage(formData.mssv);
    } else {
        const duplicateStudent = students.find((student, index) => {
            if (mode === "edit" && index === editIndex) return false;
            return window.StudentIdentity.validateStudentIdentity(student.mssv).value
                === window.StudentIdentity.validateStudentIdentity(formData.mssv).value;
        });

        if (duplicateStudent) {
            errors.mssv = studentIdentityDuplicateMessage(duplicateStudent.name);
        }
    }

    // Kiểm tra Họ tên
    if (!formData.name) {
        errors.name = "Vui lòng nhập họ và tên sinh viên";
    }

    // Kiểm tra Ngày sinh (không được chọn ngày tương lai)
    if (!formData.birthday) {
        errors.birthday = "Vui lòng chọn ngày sinh";
    } else {
        const birthDate = window.AdminWorkflowUtils?.date(formData.birthday, "parse");
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        if (!birthDate || birthDate >= today || Number(birthDate.slice(0, 4)) < 1900) {
            errors.birthday = "Ngày sinh không hợp lệ. Năm phải từ 1900 trở lên và không được ở tương lai.";
        }
    }

    // Kiểm tra Giới tính
    if (!formData.gender) {
        errors.gender = "Vui lòng chọn giới tính";
    } else {
        const validGenders = ["Nam", "Nữ"];
        if (!validGenders.includes(formData.gender)) {
            errors.gender = "Giới tính không hợp lệ";
        }
    }

    // Kiểm tra Số điện thoại (yêu cầu 10 chữ số)
    if (!formData.phone) {
        errors.phone = "Vui lòng nhập số điện thoại";
    } else if (!/^\d{10}$/.test(formData.phone)) {
        errors.phone = "Số điện thoại không hợp lệ";
    }

    // Kiểm tra định dạng Email
    if (!formData.email) {
        errors.email = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = "Email không hợp lệ";
    }

    // Kiểm tra Phòng và Sức chứa của phòng
    if (!formData.room) {
        errors.room = "Vui lòng chọn phòng";
    } else if (!validRooms.includes(formData.room)) {
        errors.room = "Phòng không tồn tại trong hệ thống";
    } else {
        // Đếm số lượng sinh viên đang ở hiện tại trong phòng đó
        const roomCurrentCount = students.filter((student, index) => {
            if (mode === "edit" && index === editIndex) return false;
            return student.room === formData.room && student.status === "Đang ở";
        }).length;

        // Kiểm tra sức chứa khi thêm mới
        if (
            roomCurrentCount >= (roomCapacity[formData.room] || 4) &&
            mode === "add"
        ) {
            errors.room = "Phòng có thể đã đầy";
        }

        // Kiểm tra sức chứa khi chuyển phòng ở chế độ chỉnh sửa
        if (mode === "edit") {
            const currentStudent = students[editIndex];
            const isChangingRoom = currentStudent.room !== formData.room;
            if (
                isChangingRoom &&
                roomCurrentCount >= (roomCapacity[formData.room] || 4)
            ) {
                errors.room = "Phòng có thể đã đầy";
            }
        }
    }

    // Kiểm tra Trạng thái sinh viên (chỉ yêu cầu ở chế độ sửa)
    if (mode === "edit") {
        if (!formData.status) {
            errors.status = "Vui lòng chọn trạng thái sinh viên";
        } else if (!["Đang ở", "Đã rời khỏi"].includes(formData.status)) {
            errors.status = "Trạng thái sinh viên không hợp lệ";
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}
// ====================================================================================================================
// CÁC HÀM XỬ LÝ GIAO DIỆN VALIDATE (VALIDATION UI)
// ====================================================================================================================

/**
 * Làm sạch giao diện thông báo lỗi trên Form
 * @param {HTMLElement} form - Đối tượng form cần xóa lỗi
 */
function clearValidationUI(form) {
    // 1. Ẩn và xóa nội dung hộp thông báo lỗi tổng quát
    const errorBox = form.querySelector(
        "#addStudentErrorBox, #editStudentErrorBox",
    );
    if (errorBox) {
        errorBox.classList.add("hidden");
        errorBox.innerHTML = "";
    }

    // 2. Khôi phục màu viền mặc định cho tất cả các trường nhập liệu
    form.querySelectorAll("input, select, textarea").forEach((field) => {
        field.classList.remove("border-red-500");
        field.classList.add("border-[#e2e8f0]");
    });

    // 3. Xóa bỏ các dòng tin nhắn lỗi chi tiết dưới mỗi field
    form.querySelectorAll(".field-error-message").forEach((el) => el.remove());
}

/**
 * Hiển thị các lỗi dữ liệu lên giao diện Form
 * @param {HTMLElement} form - Form cần hiển thị lỗi
 * @param {Object} errors - Danh sách lỗi { name: "message" }
 * @param {string} errorBoxId - ID của vùng chứa lỗi tổng quát
 */
function showValidationErrors(form, errors, errorBoxId) {
    // Chỉ hiển thị lỗi ngay dưới từng ô input, không dùng box tổng hợp
    Object.keys(errors).forEach((fieldName) => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field) {
            field.classList.remove("border-[#e2e8f0]");
            field.classList.add("border-red-500");

            const errorMsg = document.createElement("div");
            errorMsg.className = "field-error-message text-red-500 text-[11px] mt-1";
            errorMsg.textContent = errors[fieldName];
            field.parentElement.appendChild(errorMsg);
        }
    });
}

// ====================================================================================================================
// CÁC HÀM TIỆN ÍCH ĐỊNH DẠNG (FORMATTERS)
// ====================================================================================================================

/**
 * Chuyển đổi Date từ API sang định dạng dd/mm/yyyy để hiển thị
 */
function formatApiDateToDisplay(value) {
    if (!value) return "—";
    return window.AdminWorkflowUtils?.date(String(value).slice(0, 10), "format") || "—";
}

/**
 * Normalize API dates for the shared dd/mm/yyyy text input.
 */
function formatDateForInput(dateStr) {
    if (!dateStr) return "";
    return window.AdminWorkflowUtils?.date(String(dateStr).slice(0, 10), "format") || "";
}

/**
 * Định dạng yyyy-mm-dd sang dd/mm/yyyy
 */
function formatDateToDisplay(dateStr) {
    if (!dateStr) return "";
    const [yyyy, mm, dd] = dateStr.split("-");
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * Định dạng hiển thị số điện thoại (0000 000 000)
 */
function formatPhoneDisplay(phone) {
    if (!phone || phone.length !== 10) return phone;
    return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
}

/**
 * Tự động tạo mã hợp đồng dựa trên số lượng sinh viên
 */
function generateContractCode() {
    const maxNumber = students.length + 1;
    return `HD${String(maxNumber).padStart(3, "0")}`;
}

// ====================================================================================================================
// CÁC HÀM RENDER THÀNH PHẦN FORM (UI RENDERERS)
// ====================================================================================================================

/**
 * Render một dòng thông tin chi tiết (Read-only)
 */
function renderDetailField(label, value) {
    return `
            <div class="grid grid-cols-[160px_1fr] items-center gap-3">
                <label class="font-semibold text-[#0f172a]">${label}</label>
                <input
                    type="text"
                    value="${value}"
                    readonly
                    class="h-[34px] border border-[#e2e8f0] rounded-[4px] px-3 text-[12px] text-[#64748b] bg-slate-50 cursor-not-allowed"
                />
            </div>
        `;
}

/**
 * Render toàn bộ cấu trúc các trường nhập liệu cho Form Sinh viên
 * @param {Object} data - Dữ liệu sinh viên hiện có (nếu sửa)
 * @param {boolean} isAdd - Xác định là Form thêm hay sửa
 */
function renderStudentForm(data = "", isAdd = false) {
    const d = data || {};

    return `
            ${renderInputRow(isAdd ? "Số CCCD/Hộ chiếu" : "Số CCCD", "text", "mssv", "12 chữ số hoặc hộ chiếu", d.mssv || "", true, isAdd ? 'maxlength="12" autocomplete="off"' : "")}
            ${renderInputRow("Họ và tên sinh viên", "text", "name", "Nguyễn Văn An", d.name || "", true)}
            ${renderInputRow("Ngày sinh (dd/mm/yyyy)", "text", "birthday", "dd/mm/yyyy", formatDateForInput(d.birthday || ""), true)}
            ${renderSelectRow("Giới tính", "gender", ["Nam", "Nữ"], d.gender || "", true)}
            ${renderInputRow("Số điện thoại", "text", "phone", "0914268735", (d.phone || "").replace(/\s/g, ""), true)}
            ${renderInputRow("Email", "email", "email", "nguyenvanan@gmail.com", d.email || "", true)}
            ${renderInputRow("Trường", "text", "school", "Tên trường (không bắt buộc)", d.school || "", false, 'maxlength="150"')}
            ${renderInputRow("Địa chỉ", "text", "address", "Đắk Lắk", d.address && d.address !== "-" ? d.address : "", false)}
            ${renderRoomSelectRow(d.room || "", d.gender || "")}
            ${renderSelectRow("Trạng thái sinh viên", "status", ["Đang ở", "Đã rời khỏi"], isAdd ? "Đang ở" : d.status || "Đang ở", true)}
            ${renderTextareaRow("Ghi chú", "note", d.note && d.note !== "-" ? d.note : "")}
            <div id="${isAdd ? "addStudentErrorBox" : "editStudentErrorBox"}" class="hidden text-red-500 text-[12px] pt-1"></div>
        `;
}

/**
 * Render một hàng nhập liệu (Input Row)
 * Sử dụng CSS Grid để căn chỉnh nhãn (160px) và ô nhập liệu
 */
function renderInputRow(
    label,
    type,
    name,
    placeholder,
    value,
    required = false,
    attributes = "",
) {
    if (name === "birthday" && window.AdminWorkflowUtils) {
        window.AdminWorkflowUtils.bindDateInputs(document.body);
        return window.AdminWorkflowUtils.dateField(label, name, value, { required, birthDate: true });
    }
    return `
            <div class="grid grid-cols-[160px_1fr] items-center gap-3">
                <label for="student-${name}" class="text-[13px] font-semibold text-[#0f172a]">
                    ${label} ${required ? '<span class="text-red-500">*</span>' : ""}
                </label>
                <div>
                    <input
                        id="student-${name}"
                        type="${type}"
                        name="${name}"
                        placeholder="${escapeStudentHtml(placeholder)}"
                        value="${escapeStudentHtml(value)}"
                        ${required ? "required" : ""}
                        ${attributes}
                        class="w-full h-[34px] border border-[#e2e8f0] rounded-[4px] px-3 text-[12px] outline-none focus:border-emerald-400 transition-all"
                    />
                </div>
            </div>
        `;
}

/**
 * Render một hàng lựa chọn (Select Row)
 * Tự động duyệt qua mảng options để tạo các thẻ <option>
 */
/**
 * Render select phòng — lọc theo giới tính và chỉ hiện phòng còn trống
 */
function renderRoomSelectRow(selectedRoom = "", gender = "") {
    const allRooms = window._allRooms || [];
    const availableRooms = allRooms.filter(p => {
        const trangThai = p.TrangThaiPhong || "";
        const loai = (p.LoaiPhong || "").toLowerCase();
        const isAvailable = trangThai === "Trống" || trangThai === "Còn chỗ";
        // Luôn giữ lại phòng hiện tại của sinh viên dù đã đầy
        const isCurrentRoom = p.TenPhong === selectedRoom;
        if (!isAvailable && !isCurrentRoom) return false;
        if (!gender) return true;
        const g = gender.toLowerCase();
        if (g === "nam") return loai === "nam";
        if (g === "nữ" || g === "nu") return loai === "nữ" || loai === "nu";
        return true;
    });

    const options = availableRooms.map(p =>
        `<option value="${p.TenPhong}" ${selectedRoom === p.TenPhong ? "selected" : ""}>${p.TenPhong} (${p.LoaiPhong} - còn ${p.SucChuaToiDa - p.SoSinhVienHienTai} chỗ)</option>`
    ).join("");

    return `
        <div class="grid grid-cols-[160px_1fr] items-center gap-3">
            <label class="text-[13px] font-semibold text-[#0f172a]">
                Phòng <span class="text-red-500">*</span>
            </label>
            <div>
                <select name="room" id="roomSelect"
                    class="w-full h-[34px] border border-[#e2e8f0] rounded-[4px] px-3 text-[12px] outline-none bg-white focus:border-emerald-400 transition-all">
                    <option value="">Chọn phòng</option>
                    ${options}
                </select>
            </div>
        </div>
    `;
}

function renderSelectRow(
    label,
    name,
    options,
    selectedValue,
    required = false,
) {
    return `
            <div class="grid grid-cols-[160px_1fr] items-center gap-3">
                <label class="text-[13px] font-semibold text-[#0f172a]">
                    ${label} ${required ? '<span class="text-red-500">*</span>' : ""}
                </label>
                <div>
                    <select
                        name="${name}"
                        class="w-full h-[34px] border border-[#e2e8f0] rounded-[4px] px-3 text-[12px] outline-none bg-white focus:border-emerald-400 transition-all">
                        <option value="">Chọn</option>
                        ${options
            .map(
                (opt) => `
                                    <option value="${opt}" ${selectedValue === opt ? "selected" : ""}>${opt}</option>
                                `,
            )
            .join("")}
                    </select>
                </div>
            </div>
        `;
}

/**
 * Render một hàng văn bản dài (Textarea Row)
 * items-start giúp căn nhãn lên đầu ô nhập liệu khi có nhiều dòng
 */
function renderTextareaRow(label, name, value = "") {
    return `
            <div class="grid grid-cols-[160px_1fr] items-start gap-3">
                <label class="text-[13px] font-semibold text-[#0f172a] pt-2">${label}</label>
                <div>
                    <textarea
                        name="${name}"
                        rows="3"
                        class="w-full border border-[#e2e8f0] rounded-[4px] px-3 py-2 text-[12px] outline-none resize-none focus:border-emerald-400 transition-all"
                    >${value}</textarea>
                </div>
            </div>
        `;
}

/**
 * HÀM KHỞI TẠO TẤT CẢ SỰ KIỆN (EVENT LISTENERS)
 * Phải được gọi ngay sau khi main.innerHTML đã render xong HTML.
 */
function initStudentEvents() {
    // --- 1. Truy vấn các phần tử DOM từ giao diện vừa tạo ---
    const studentSearch = document.getElementById("studentSearch");
    const studentStatusFilter = document.getElementById("studentStatusFilter");
    const btnRefreshStudent = document.getElementById("btnRefreshStudent");
    const btnResetText = document.getElementById("btnResetText");
    const btnPrevPage = document.getElementById("btnPrevPage");
    const btnNextPage = document.getElementById("btnNextPage");

    const btnOpenAddStudent = document.getElementById("btnOpenAddStudent");
    const btnCloseAddStudent = document.getElementById("btnCloseAddStudent");
    const addStudentForm = document.getElementById("addStudentForm");
    const addStudentModal = document.getElementById("addStudentModal");

    const editStudentForm = document.getElementById("editStudentForm");
    const editStudentModal = document.getElementById("editStudentModal");
    const btnCloseEditStudent = document.getElementById("btnCloseEditStudent");

    const detailStudentModal = document.getElementById("detailStudentModal");
    const btnCloseDetailStudent = document.getElementById("btnCloseDetailStudent");
    const btnEditFromDetail = document.getElementById("btnEditFromDetail");

    // --- 2. Gán sự kiện Tìm kiếm & Lọc ---
    if (studentSearch) {
        studentSearch.addEventListener("input", filterStudents);
    }
    if (studentStatusFilter) {
        studentStatusFilter.addEventListener("change", filterStudents);
    }
    if (btnRefreshStudent) {
        btnRefreshStudent.addEventListener("click", resetFilters);
    }
    if (btnResetText) {
        btnResetText.addEventListener("click", resetFilters);
    }

    // --- 3. Gán sự kiện Phân trang ---
    if (btnPrevPage) {
        btnPrevPage.onclick = async () => {
            if (currentPage > 1) {
                currentPage--;
                await loadDanhSachSinhVien(
                    currentPage,
                    rowsPerPage,
                    studentSearch?.value.trim() || "",
                    studentStatusFilter?.value || ""
                );
            }
        };
    }

    if (btnNextPage) {
        btnNextPage.onclick = async () => {
            if (currentPage < totalPagesFromDB) {
                currentPage++;
                await loadDanhSachSinhVien(
                    currentPage,
                    rowsPerPage,
                    studentSearch?.value.trim() || "",
                    studentStatusFilter?.value || ""
                );
            }
        };
    }

    // --- 4. Sự kiện Modal Thêm mới ---
    if (btnOpenAddStudent) {
        btnOpenAddStudent.addEventListener("click", () => {
            addStudentForm.reset();
            const statusField = addStudentForm.querySelector('[name="status"]');
            if (statusField) statusField.value = "Đang ở";
            clearValidationUI(addStudentForm);
            addStudentModal.classList.remove("hidden");
            addStudentModal.classList.add("flex");

            // Khi đổi giới tính → cập nhật danh sách phòng
            setTimeout(() => {
                const genderSelect = addStudentForm.querySelector('[name="gender"]');
                const roomSelect = addStudentForm.querySelector('[name="room"]');
                if (genderSelect && roomSelect) {
                    genderSelect.addEventListener("change", () => {
                        const gender = genderSelect.value;
                        const allRooms = window._allRooms || [];
                        const filtered = allRooms.filter(p => {
                            const trangThai = p.TrangThaiPhong || "";
                            const loai = (p.LoaiPhong || "").toLowerCase();
                            const isAvailable = trangThai === "Trống" || trangThai === "Còn chỗ";
                            if (!isAvailable) return false;
                            if (!gender) return true;
                            const g = gender.toLowerCase();
                            if (g === "nam") return loai === "nam";
                            if (g === "nữ" || g === "nu") return loai === "nữ" || loai === "nu";
                            return true;
                        });
                        roomSelect.innerHTML = '<option value="">Chọn phòng</option>' +
                            filtered.map(p => `<option value="${p.TenPhong}">${p.TenPhong} (${p.LoaiPhong} - còn ${p.SucChuaToiDa - p.SoSinhVienHienTai} chỗ)</option>`).join("");
                    });
                }
            }, 0);
        });
    }

    if (btnCloseAddStudent) {
        btnCloseAddStudent.addEventListener("click", closeAddModal);
    }

    if (addStudentForm) {
        addStudentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = getFormData(addStudentForm);
            clearValidationUI(addStudentForm);
            const validation = validateStudentForm(formData, "add");

            if (!validation.isValid) {
                showValidationErrors(addStudentForm, validation.errors, "addStudentErrorBox");
                return;
            }
            formData.mssv = window.StudentIdentity.validateStudentIdentity(formData.mssv).value;

            try {
                const response = await ApiClient.fetch(`${BASE_URL}/api/sinhvien`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        MaSinhVien: formData.mssv,
                        HoTen: formData.name,
                        NgaySinh: window.AdminWorkflowUtils.date(formData.birthday, "parse"),
                        GioiTinh: formData.gender,
                        SoDienThoai: formData.phone,
                        Email: formData.email,
                        DiaChi: formData.address || "",
                        Truong: formData.school || "",
                        TenPhong: formData.room,
                        TrangThaiSinhVien: "Đang ở",
                        GhiChu: formData.note || "",
                    }),
                });

                const result = await response.json();
                if (!response.ok) {
                    showToast(result.message || "Thêm sinh viên thất bại", "error");
                    return;
                }

                showToast("Thêm sinh viên thành công", "success");
                closeAddModal();
                await loadThongKeSinhVien();
                await loadDanhSachSinhVien(1, rowsPerPage, "", "");
            } catch (error) {
                showToast(error.message || "Không thể thêm sinh viên.", "error");
            }
        });
    }

    // --- 5. Sự kiện Modal Chỉnh sửa ---
    if (btnCloseEditStudent) {
        btnCloseEditStudent.addEventListener("click", closeEditModal);
    }

    if (editStudentForm) {
        editStudentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = getFormData(editStudentForm);
            clearValidationUI(editStudentForm);
            const validation = validateStudentForm(formData, "edit", currentEditIndex);

            if (!validation.isValid) {
                showValidationErrors(editStudentForm, validation.errors, "editStudentErrorBox");
                return;
            }

            try {
                const oldMssv = students[currentEditIndex].mssv;
                const response = await ApiClient.fetch(`${BASE_URL}/api/sinhvien/${oldMssv}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mssv: formData.mssv,
                        hoTen: formData.name,
                        ngaySinh: window.AdminWorkflowUtils.date(formData.birthday, "parse"),
                        gioiTinh: formData.gender,
                        soDienThoai: formData.phone,
                        email: formData.email,
                        diaChi: formData.address || "",
                        truong: formData.school || "",
                        tenPhong: formData.room,
                        trangThaiSinhVien: formData.status,
                        ghiChu: formData.note || "",
                    }),
                });

                if (!response.ok) {
                    const result = await response.json();
                    showToast(result.message || "Cập nhật thất bại", "error");
                    return;
                }

                showToast("Cập nhật thành công");
                closeEditModal();
                await loadThongKeSinhVien();
                await loadDanhSachSinhVien(currentPage, rowsPerPage, "", "");
            } catch (error) {
                showToast(error.message || "Không thể cập nhật sinh viên.", "error");
            }
        });
    }

    // --- 6. Sự kiện Modal Chi tiết ---
    if (btnCloseDetailStudent) {
        btnCloseDetailStudent.addEventListener("click", closeDetailModal);
    }

    if (btnEditFromDetail) {
        btnEditFromDetail.addEventListener("click", () => {
            if (currentDetailIndex !== null) {
                closeDetailModal();
                openEditModal(currentDetailIndex);
            }
        });
    }

    // --- 7. Đóng Modal khi click vùng nền mờ ---
    [addStudentModal, editStudentModal, detailStudentModal].forEach(modal => {
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    modal.classList.add("hidden");
                    modal.classList.remove("flex");
                }
            });
        }
    });
}

/**
 * Hàm đóng Modal Thêm sinh viên
 * Được gọi từ initStudentEvents khi nhấn nút Hủy hoặc Click ra ngoài
 */
function closeAddModal() {
    const addStudentModal = document.getElementById("addStudentModal");
    const addStudentForm = document.getElementById("addStudentForm");

    if (addStudentModal) {
        addStudentModal.classList.add("hidden");
        addStudentModal.classList.remove("flex");
    }

    // Làm sạch các thông báo lỗi đỏ nếu có
    if (addStudentForm) {
        clearValidationUI(addStudentForm);
    }
}

/**
 * Hàm đóng Modal Chỉnh sửa sinh viên (Tuyết nên thêm luôn để tránh lỗi tương tự)
 */
function closeEditModal() {
    const editStudentModal = document.getElementById("editStudentModal");
    const editStudentForm = document.getElementById("editStudentForm");

    if (editStudentModal) {
        editStudentModal.classList.add("hidden");
        editStudentModal.classList.remove("flex");
    }

    if (editStudentForm) {
        clearValidationUI(editStudentForm);
    }
}

/**
 * Hàm đóng Modal Chi tiết
 */
function closeDetailModal() {
    const detailStudentModal = document.getElementById("detailStudentModal");
    if (detailStudentModal) {
        detailStudentModal.classList.add("hidden");
        detailStudentModal.classList.remove("flex");
    }
}