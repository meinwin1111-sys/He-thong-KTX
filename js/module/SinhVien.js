/**
 * BIẾN TOÀN CỤC - QUẢN LÝ TRẠNG THÁI DỮ LIỆU
 */
let totalStudentsFromDB = 0;
let maleStudentsFromDB = 0;
let femaleStudentsFromDB = 0;

let totalPagesFromDB = 1;

let students = [];
let currentFilteredStudents = [];
let currentDetailIndex = null;
let currentEditIndex = null;

let validRooms = [];
let roomCapacity = {};

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

            <div class="flex items-center gap-3 mb-6">
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

            <div class="bg-white rounded-lg shadow-sm overflow-x-auto border border-slate-200">
                <table class="min-w-[1620px] w-full text-left table-fixed">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr class="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                            <th class="px-5 py-4 w-[190px] whitespace-nowrap">MSSV</th>
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
                    <span id="studentCountText"></span>
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

        // Chuẩn hóa và lưu trữ danh sách
        students = (result.data || []).map(normalizeStudentFromAPI);
        currentFilteredStudents = [...students];

        // Cập nhật thông tin phân trang
        currentPage = result.page || 1;
        totalPagesFromDB = result.totalPages || 1;
        totalStudentsFromDB = result.total || 0;

        // Vẽ lại bảng dữ liệu
        renderTable(students);
    } catch (error) {
        students = [];
        currentFilteredStudents = [];
        renderTable(students);
        showToast(error.message || "Không thể tải danh sách sinh viên.", "error");
    }
}

/**
 * Tạo nhãn Badge màu sắc cho cột trạng thái
 */
function getStatusBadge(status) {
    const label = String(status || "").trim() || "Chưa xếp phòng";
    if (label === "Đang ở") {
        return `
                <span class="inline-flex items-center justify-center whitespace-nowrap min-w-[100px] h-[24px] px-3 rounded-full text-[11px] font-medium bg-[#DDF8E8] text-[#166534]">
                    ${label}
                </span>
            `;
    }
    if (label === "Chưa xếp phòng") {
        return `
                <span class="inline-flex items-center justify-center whitespace-nowrap min-w-[100px] h-[24px] px-3 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                    ${label}
                </span>
            `;
    }
    return `
            <span class="inline-flex items-center justify-center whitespace-nowrap min-w-[100px] h-[24px] px-3 rounded-full text-[11px] font-medium bg-[#FFE3E3] text-[#991b1b]">
                ${label}
            </span>
        `;
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
    // --- KHAI BÁO CÁC PHẦN TỬ DOM ---
    const tableBody = document.getElementById("studentTableBody");
    const studentCountText = document.getElementById("studentCountText");
    const currentPageBox = document.getElementById("currentPageBox");
    const totalPageText = document.getElementById("totalPageText");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    // Xử lý trường hợp không tìm thấy kết quả
    if (data.length === 0) {
        tableBody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-10 text-[13px] text-slate-500 italic">
                        Không tìm thấy sinh viên phù hợp
                    </td>
                </tr>
            `;
        studentCountText.textContent = `Hiển thị 0-0/${totalStudentsFromDB} sinh viên`;
        currentPageBox.textContent = currentPage;
        totalPageText.textContent = totalPagesFromDB;
        updatePaginationButtons(totalPagesFromDB);
        return;
    }

    // Render từng dòng sinh viên vào tbody
    data.forEach((s, index) => {
        tableBody.innerHTML += `
                <tr class="hover:bg-slate-50 border-b border-slate-200 transition-colors text-[13px] text-slate-500">
                    <td class="px-5 py-4 text-left font-bold text-slate-900 whitespace-nowrap">${s.mssv}</td>
                    <td class="px-5 py-4 text-left font-medium text-slate-900 truncate whitespace-nowrap" title="${s.name}">${s.name}</td>
                    <td class="px-5 py-4 text-left whitespace-nowrap">${s.birthday}</td>
                    <td class="px-5 py-4 text-left whitespace-nowrap">${s.gender}</td>
                    <td class="px-5 py-4 text-left whitespace-nowrap">${s.phone}</td>
                    <td class="px-5 py-4 text-left truncate whitespace-nowrap" title="${s.email}">${s.email}</td>
                    <td class="px-5 py-4 text-left truncate whitespace-nowrap" title="${s.address}">${s.address}</td>
                    <td class="px-5 py-4 text-left font-bold text-emerald-600 whitespace-nowrap">${s.room}</td>
                    <td class="px-5 py-4 text-left whitespace-nowrap">${getStatusBadge(s.status)}</td>
                    <td class="px-5 py-4 text-left text-slate-500 italic truncate whitespace-nowrap" title="${s.note}">${s.note}</td>
                    <td class="px-5 py-4 text-center">
                        ${renderActionButtons(index)}
                    </td>
                </tr>
            `;
    });

    // Tính toán thông báo hiển thị dưới chân trang
    const displayStart =
        totalStudentsFromDB === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const displayEnd = Math.min(currentPage * rowsPerPage, totalStudentsFromDB);

    studentCountText.textContent = `Hiển thị ${displayStart}-${displayEnd}/${totalStudentsFromDB} sinh viên`;
    currentPageBox.textContent = currentPage;
    totalPageText.textContent = totalPagesFromDB;

    // Cập nhật trạng thái các nút phân trang (Next/Prev)
    updatePaginationButtons(totalPagesFromDB);
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
                    ${renderDetailField("Mã số sinh viên", student.MaSinhVien || s.mssv)}
                    ${renderDetailField("Họ và tên sinh viên", student.HoTen || s.name)}
                    ${renderDetailField("Ngày sinh", formatApiDateToDisplay(student.NgaySinh))}
                    ${renderDetailField("Giới tính", student.GioiTinh || s.gender)}
                    ${renderDetailField("Số điện thoại", student.SoDienThoai || s.phone)}
                    ${renderDetailField("Email", student.Email || s.email)}
                    ${renderDetailField("Địa chỉ", student.DiaChi || s.address)}
                    ${renderDetailField("Phòng", student.TenPhong || s.room)}
                    ${renderDetailField("Trạng thái sinh viên", student.TrangThaiSinhVien || s.status)}
                    <div class="pt-2 border-t border-slate-200 mt-1">
                        <p class="font-semibold text-[#0f172a] mb-2">Thông tin hợp đồng:</p>
                        ${renderDetailField("Mã hợp đồng", contractData.code)}
                        ${renderDetailField("Ngày bắt đầu", contractData.start)}
                        ${renderDetailField("Ngày kết thúc", contractData.end)}
                        ${renderDetailField("Trạng thái HĐ", contractData.status)}
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

    // Kiểm tra Mã số sinh viên (MSSV)
    if (!formData.mssv) {
        errors.mssv = "Vui lòng nhập mã số sinh viên";
    } else {
        // Kiểm tra xem MSSV có bị trùng lặp với sinh viên khác trong trang không
        const duplicateStudent = students.find((student, index) => {
            if (mode === "edit" && index === editIndex) return false;
            return student.mssv.toLowerCase() === formData.mssv.toLowerCase();
        });

        if (duplicateStudent) {
            errors.mssv = "Mã số sinh viên đã tồn tại trong trang hiện tại";
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
        const birthDate = new Date(formData.birthday);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(birthDate.getTime()) || birthDate >= today) {
            errors.birthday = "Ngày sinh không hợp lệ";
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
    if (!value) return "--/--/----";

    const date = new Date(value);
    if (!isNaN(date.getTime())) {
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    if (typeof value === "string" && value.includes("/")) return value;
    return String(value);
}

/**
 * Chuyển đổi dd/mm/yyyy sang yyyy-mm-dd cho input[type="date"]
 */
function formatDateForInput(dateStr) {
    if (!dateStr) return "";
    if (dateStr.includes("-") && !dateStr.includes("/")) return dateStr;

    const parts = dateStr.split("/");
    if (parts.length !== 3) return "";
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
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
            ${renderInputRow("Mã số sinh viên", "text", "mssv", "SV001", d.mssv || "", true)}
            ${renderInputRow("Họ và tên sinh viên", "text", "name", "Nguyễn Văn An", d.name || "", true)}
            ${renderInputRow("Ngày sinh", "date", "birthday", "", formatDateForInput(d.birthday || ""), true)}
            ${renderSelectRow("Giới tính", "gender", ["Nam", "Nữ"], d.gender || "", true)}
            ${renderInputRow("Số điện thoại", "text", "phone", "0914268735", (d.phone || "").replace(/\s/g, ""), true)}
            ${renderInputRow("Email", "email", "email", "nguyenvanan@gmail.com", d.email || "", true)}
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
) {
    return `
            <div class="grid grid-cols-[160px_1fr] items-center gap-3">
                <label class="text-[13px] font-semibold text-[#0f172a]">
                    ${label} ${required ? '<span class="text-red-500">*</span>' : ""}
                </label>
                <div>
                    <input
                        type="${type}"
                        name="${name}"
                        placeholder="${placeholder}"
                        value="${value}"
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

            try {
                const response = await ApiClient.fetch(`${BASE_URL}/api/sinhvien`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        MaSinhVien: formData.mssv,
                        HoTen: formData.name,
                        NgaySinh: formData.birthday,
                        GioiTinh: formData.gender,
                        SoDienThoai: formData.phone,
                        Email: formData.email,
                        DiaChi: formData.address || "",
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
                        ngaySinh: formData.birthday,
                        gioiTinh: formData.gender,
                        soDienThoai: formData.phone,
                        email: formData.email,
                        diaChi: formData.address || "",
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