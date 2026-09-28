// ==========================================================
// KHAI BÁO BIẾN CHUNG: Quản lý dữ liệu và phân trang
// ==========================================================
let rawPhong = [];      // Chứa dữ liệu gốc tải về từ server (chưa qua bộ lọc)
let filteredPhong = []; // Chứa dữ liệu sau khi đã áp dụng các điều kiện tìm kiếm/lọc
let currentPage = 1;    // Theo dõi trang hiện tại đang hiển thị
const rowsPerPage = 10; // Giới hạn số dòng hiển thị trên mỗi trang bảng

/** Tính toán các chỉ số thống kê ở đầu trang (Dashboard mini) */
function updateRoomStats() {
    // 1. Tính toán các con số cơ bản
    const total = rawPhong.length;
    const empty = rawPhong.filter(r => r.TrangThaiPhong === 'Trống').length;
    const full = rawPhong.filter(r => r.TrangThaiPhong === 'Đầy').length;

    // 2. Tính tổng số sinh viên hiện tại (SV)
    const sv = rawPhong.reduce((sum, r) => sum + (parseInt(r.SoSinhVienHienTai) || 0), 0);

    // 3. Tính tổng sức chứa tối đa (Capacity)
    const totalCapacity = rawPhong.reduce((sum, r) => sum + (parseInt(r.SucChuaToiDa) || 0), 0);

    // 4. Cập nhật dữ liệu lên giao diện
    document.getElementById('statTotal').innerText = total;
    document.getElementById('statEmpty').innerText = empty;
    document.getElementById('statFull').innerText = full;
    document.getElementById('statSV').innerText = sv;

    // 5. Tính toán Tỷ lệ sử dụng (%)
    // Công thức mới: (Tổng SV / Tổng sức chứa) * 100
    const usageRate = totalCapacity > 0 ? Math.round((sv / totalCapacity) * 100) : 0;
    document.getElementById('statRate').innerText = usageRate + '%';
}

// ==========================================================
/** 1. Tải dữ liệu từ Backend API */
async function loadPhong(type) {
    try {
        const response = await fetch(`${BASE_URL}/api/${type}`);
        if (!response.ok) throw new Error("Không thể kết nối Backend");
        const data = await response.json();
        console.log("Dữ liệu nhận được:", data);

        if (type === 'Phong') {
            rawPhong = data;
            filterData();
            updateRoomStats();
        }
    } catch (err) {
        console.error("Lỗi:", err);
        showToast("Không kết nối được đến cơ sở dữ liệu", "error"); // Đồng nhất thông báo lỗi
        rawPhong = [];
        filterData();
    }
}

// ==========================================================
/** 2. Xử lý Lọc và Tìm kiếm dữ liệu */
function filterData() {
    // 1. Lấy giá trị an toàn: Nếu không tìm thấy ID, trả về chuỗi rỗng ""
    const topSearch = document.getElementById('topSearch')?.value.toLowerCase().trim() || "";
    const roomSearch = document.getElementById('searchRoom')?.value.toLowerCase().trim() || "";
    const typeFilter = document.getElementById('filterType')?.value || "";
    const statusFilter = document.getElementById('filterStatus')?.value || "";

    // 2. Thực hiện lọc
    filteredPhong = rawPhong.filter(r => {
        // Nếu các ô tìm kiếm trống, match sẽ luôn là true (hiển thị tất cả)
        const matchTop = !topSearch ||
                         r.TenPhong.toLowerCase().includes(topSearch) ||
                         r.TrangThaiPhong.toLowerCase().includes(topSearch);

        const matchRoom = !roomSearch || r.TenPhong.toLowerCase().includes(roomSearch);
        const matchType = !typeFilter || r.LoaiPhong === typeFilter;
        const matchStatus = !statusFilter || r.TrangThaiPhong === statusFilter;

        return matchTop && matchRoom && matchType && matchStatus;
    });

    currentPage = 1;

    // 3. Quan trọng: Phải đảm bảo dòng này được chạy
    renderRoomTable();
}

/** Hàm riêng biệt để tạo HTML cho các nút thao tác
 */
function renderButtons(roomName) {
    const safeName = String(roomName);

    return `
        <div class="flex justify-center gap-2">
            <button onclick="showRoomDetail('${safeName}')"
                class="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-500 flex items-center gap-1 hover:bg-slate-50 hover:border-emerald-300 transition-all shadow-sm">
                <i class="fa-regular fa-eye text-[10px]"></i> Xem
            </button>

            <button onclick="openEditRoom('${safeName}')"
                class="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-500 flex items-center gap-1 hover:bg-slate-50 hover:border-emerald-300 transition-all shadow-sm">
                <i class="fa-solid fa-pen text-[10px]"></i> Sửa
            </button>
        </div>
    `;
}

// ==========================================================
/** 3. Hiển thị dữ liệu lên Bảng HTML - CẬP NHẬT THEO UI MỚI
*/
function renderRoomTable() {
    const tbody = document.getElementById('roomTableBody');
    if (!tbody) return;

    // Tính toán vị trí dữ liệu để cắt mảng theo phân trang
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = filteredPhong.slice(startIndex, startIndex + rowsPerPage);

    // Chuyển đổi mảng dữ liệu thành chuỗi HTML
    tbody.innerHTML = paginatedData.map((r) => `
        <tr class="group border-b border-slate-200 hover:bg-emerald-50/30 transition-all">
            <td class="px-6 py-4 font-bold text-slate-900">${r.TenPhong}</td>
            <td class="px-6 py-4 text-slate-500">${r.Khu || '-'}</td>
            <td class="px-6 py-4 text-slate-500">${r.LoaiPhong}</td>
            <td class="px-6 py-4 text-slate-500 font-medium">${r.SoSinhVienHienTai}/${r.SucChuaToiDa}</td>
            <td class="px-6 py-4">
                <span class="font-bold text-xs ${
                    r.TrangThaiPhong === 'Đầy' ? 'text-rose-500' :
                    r.TrangThaiPhong === 'Trống' ? 'text-emerald-500' : 'text-orange-500'
                }">
                    ${r.TrangThaiPhong}
                </span>
            </td>
            <td class="px-6 py-4 text-slate-500 text-sm">
                ${r.GhiChu && r.GhiChu.trim() !== "" ? r.GhiChu : "-"}
            </td>
            <td class="px-6 py-4">
                ${renderButtons(r.TenPhong)}
            </td>
        </tr>
    `).join('')

    renderPaginationFooter(paginatedData.length);
};

// ==========================================================

/** Nút RESET - Làm mới các ô lọc về trạng thái ban đầu */
function resetPhongFilters() {
    const ids = ['topSearch', 'searchRoom', 'filterType', 'filterStatus'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    if (typeof filterData === "function") {
        filterData();
    }
}

/** Hiển thị chi tiết phòng và danh sách sinh viên đang ở */
async function showRoomDetail(roomName) {
    const room = rawPhong.find(r => r.TenPhong === roomName);
    if (!room) return;

    // --- PHẦN 1: HIỂN THỊ THÔNG TIN PHÒNG ---
    document.getElementById('detName').innerText = "Phòng " + room.TenPhong;
    document.getElementById('detType').innerText = room.LoaiPhong;
    document.getElementById('detKhu').innerText = (room.Khu || "N/A");
    document.getElementById('detMax').innerText = room.SucChuaToiDa + " chỗ";
    document.getElementById('detCurrent').innerText = room.SoSinhVienHienTai + " sinh viên";

    const detNote = document.getElementById('detNote');
    detNote.innerText = room.GhiChu || "-";
    detNote.className = "text-slate-500 text-sm leading-relaxed";

    const badge = document.getElementById('detStatusBadge');
    badge.innerText = room.TrangThaiPhong;
    badge.className = `px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        room.TrangThaiPhong === 'Đầy' ? 'bg-red-100 text-red-600' :
        room.TrangThaiPhong === 'Trống' || room.TrangThaiPhong === 'Còn chỗ' ? 'bg-green-100 text-green-600' :
        'bg-orange-100 text-orange-600'
    }`;

    // --- PHẦN 2: LOAD SINH VIÊN TỪ DATABASE ---
    const studentTable = document.getElementById('detStudentList');
    if (studentTable) {
        // Thay đổi colspan từ 5 xuống 4 vì đã xóa 1 cột
        studentTable.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 text-sm">Đang truy xuất dữ liệu...</td></tr>`;

        try {
            const response = await fetch(`${BASE_URL}/api/SinhVien/Phong/${roomName}`);
            if (!response.ok) throw new Error("Lỗi API");

            const students = await response.json();

            if (Array.isArray(students) && students.length > 0) {
                studentTable.innerHTML = students.map(sv => {
                    const statusHĐ = sv.TrangThaiHopDong || "Còn hiệu lực";
                    const statusClass = statusHĐ === "Còn hiệu lực" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600";

                    return `
                    <tr class="hover:bg-slate-50 border-b border-slate-200 last:border-0">
                        <td class="p-3 pl-4 text-slate-500 text-sm">${sv.MaSinhVien || sv.MSSV}</td>
                        <td class="p-3 text-slate-900 text-sm font-semibold">${sv.HoTen || sv.TenSV}</td>
                        <td class="p-3 text-slate-500 text-sm">${sv.SoDienThoai || 'N/A'}</td>
                        <td class="p-3 pl-4">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusClass}">
                                ${statusHĐ}
                            </span>
                        </td>
                        </tr>`;
                }).join('');
            } else {
                // Thay đổi colspan xuống 4
                studentTable.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-500 text-sm italic">Phòng hiện đang trống.</td></tr>`;
            }
        } catch (err) {
            console.error("Lỗi:", err);
            // Thay đổi colspan xuống 4
            studentTable.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-400 text-sm">Không thể tải danh sách sinh viên.</td></tr>`;
        }
    }

    document.getElementById('detailModalButtons').innerHTML =
        createButton("Sửa", "openEditRoom('" + roomName + "')") +
        createButton("Đóng", "toggleModal('detailModal')");

    toggleModal('detailModal');
};

// reset trong validate
function resetRoomValidation() {
    const roomMaxEl = document.getElementById('editRoomMax');
    const roomCurrentEl = document.getElementById('editRoomCurrent');
    const errorMax = document.getElementById('errorRoomMax');

    if (roomMaxEl) roomMaxEl.style.border = "";
    if (roomCurrentEl) roomCurrentEl.style.border = "";
    if (errorMax) errorMax.innerText = "";
};

/* =====================================================
   THÊM PHÒNG MỚI - VALIDATE TRÙNG TÊN & TRỐNG
===================================================== */

function validateField(id, errorId, validationFn) {
    const el = document.getElementById(id);
    const errEl = document.getElementById(errorId);
    if (!el || !errEl) return true;

    const msg = validationFn(el.value);
    if (msg) {
        el.style.border = "1px solid red";
        errEl.innerText = msg;
        return false;
    } else {
        el.style.border = "";
        errEl.innerText = "";
        return true;
    }
};

// Kiểm tra toàn bộ form trước khi lưu
function validateAddRoom() {
    const v1 = validateField('addRoomName', 'errorAddRoomName', (val) => {
        const roomName = val.trim();

        if (!roomName) return "Tên phòng không được để trống";

        const isDuplicate = rawPhong.some(
            r => (r.TenPhong || "").trim().toLowerCase() === roomName.toLowerCase()
        );

        if (isDuplicate) return "Tên phòng đã tồn tại";
        return "";
    });

    const v2 = validateField('addRoomKhu', 'errorAddRoomKhu', (val) =>
        !val ? "Vui lòng chọn khu" : ""
    );

    const v3 = validateField('addRoomType', 'errorAddRoomType', (val) =>
        !val ? "Vui lòng chọn loại phòng" : ""
    );

    const v4 = validateField('addRoomMax', 'errorAddRoomMax', (val) =>
        !val ? "Vui lòng chọn sức chứa" : ""
    );

    return v1 && v2 && v3 && v4;
}


/** Mở Popup Thêm Phòng */
function openAddRoom() {
    const form = document.getElementById('addRoomForm');
    if (form) form.reset();

    const fields = [
        { id: 'addRoomName', err: 'errorAddRoomName' },
        { id: 'addRoomKhu', err: 'errorAddRoomKhu' },
        { id: 'addRoomType', err: 'errorAddRoomType' },
        { id: 'addRoomMax', err: 'errorAddRoomMax' }
    ];

    fields.forEach(f => {
        const el = document.getElementById(f.id);
        const errEl = document.getElementById(f.err);
        if (el) {
            el.style.border = ""; // Reset border về mặc định
            if (errEl) errEl.innerText = ""; // Xóa tin nhắn lỗi cũ

            // Dùng oninput/onchange để khi người dùng sửa lỗi, viền đỏ biến mất ngay
            const clearError = () => {
                el.style.border = "";
                if (errEl) errEl.innerText = "";
            };
            el.oninput = clearError;
            el.onchange = clearError; // Dùng cho thẻ <select>
        }
    });

    toggleModal("addRoomModal");
}

/** Gửi dữ liệu POST */
async function saveNewRoom(event) {
    if (event) event.preventDefault();

    // Gọi hàm validate tổng quát
    if (!validateAddRoom()) return;

    const roomData = {
        TenPhong: document.getElementById('addRoomName').value.trim(),
        Khu: document.getElementById('addRoomKhu').value,
        LoaiPhong: document.getElementById('addRoomType').value,
        SucChuaToiDa: parseInt(document.getElementById('addRoomMax').value),
        SoSinhVienHienTai: 0,
        TrangThaiPhong: "Trống",
        GhiChu: document.getElementById('addRoomNote').value.trim()
    };

    try {
        const response = await fetch(`${BASE_URL}/api/Phong`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(roomData)
        });

        if (!response.ok) throw new Error("Lỗi Server");

        showToast("Thêm phòng mới thành công!", "success");
        toggleModal('addRoomModal');
        loadPhong('Phong'); // Refresh lại danh sách phòng

    } catch (err) {
        showToast("Không thể lưu dữ liệu!", "error");
        console.error(err);
    }
}

/* =====================================================
   SỬA PHÒNG - MỞ POPUP SỬA VỚI DỮ LIỆU ĐẦY ĐỦ VÀ VALIDATE NGAY TRÊN FORM
===================================================== */
function validateRoomInputs() {

    const roomMaxEl = document.getElementById('editRoomMax');
    const roomCurrentEl = document.getElementById('editRoomCurrent');

    //element hiển thị lỗi
    const errorMax = document.getElementById('errorRoomMax');

    const max = Number(roomMaxEl.value);
    const current = Number(roomCurrentEl.value);

    // reset
    roomMaxEl.style.border = "";
    roomCurrentEl.style.border = "";
    errorMax.innerText = "";

    // chỉ hiện lỗi khi sai
    if (!Number.isFinite(max) || max <= 0) {
        roomMaxEl.style.border = "1px solid red";
        errorMax.innerText = "Sức chứa phải > 0";
        return false;
    }

    if (current > max) {
        roomMaxEl.style.border = "1px solid red";
        roomCurrentEl.style.border = "1px solid red";
        errorMax.innerText = "Sức chứa không hợp lệ!";
        return false;
    }

    return true;
}

/** Mở Popup Sửa */
function openEditRoom(roomName) {
    resetRoomValidation();

    const room = rawPhong.find(r => r.TenPhong === roomName);
    if (!room) return;

    // Đóng modal chi tiết nếu đang mở
    const detailModal = document.getElementById('detailModal');
    if (detailModal && detailModal.classList.contains('active')) {
        toggleModal('detailModal');
    }

    document.getElementById('editId').value = room.TenPhong;

    // 1. Tên phòng: Read-only
    const roomNameInput = document.getElementById('editRoomName');
    roomNameInput.value = room.TenPhong || "";
    roomNameInput.disabled = true;
    roomNameInput.style.cursor = "not-allowed";
    roomNameInput.style.backgroundColor = "#f8fafc";

    // 2. Khu: CHO PHÉP SỬA
    const roomKhu = document.getElementById('editRoomKhu');
    roomKhu.value = room.Khu || "";
    roomKhu.disabled = false;
    roomKhu.style.cursor = "pointer";

    // 3. Loại phòng
    const roomType = document.getElementById('editRoomType');
    if (room.LoaiPhong === "Nam") {
        roomType.value = "Nam";
    } else if (room.LoaiPhong === "Nữ") {
        roomType.value = "Nữ";
    } else {
        roomType.value = room.LoaiPhong;
    }

    // Khóa nếu có sinh viên
    if (room.SoSinhVienHienTai > 0) {
        roomType.disabled = true;
        roomType.style.cursor = "not-allowed";
        roomType.style.backgroundColor = "#f8fafc";
        roomType.title = "Không thể đổi loại phòng khi đang có sinh viên";
    } else {
        roomType.disabled = false;
        roomType.style.cursor = "pointer";
        roomType.style.backgroundColor = "";
        roomType.title = "";
    }

    // 4. Sức chứa
    const roomMax = document.getElementById('editRoomMax');
    roomMax.value = room.SucChuaToiDa;
    roomMax.disabled = false;
    roomMax.style.cursor = "pointer";

    // 5. Số sinh viên (read-only)
    const roomCurrent = document.getElementById('editRoomCurrent');
    roomCurrent.value = room.SoSinhVienHienTai;
    roomCurrent.disabled = true;
    roomCurrent.style.backgroundColor = "#f8fafc";
    roomCurrent.style.cursor = "not-allowed";


    // 6. Trạng thái phòng
    const roomStatus = document.getElementById('editRoomStatus');

    // Reset option
    Array.from(roomStatus.options).forEach(opt => opt.disabled = false);

    const current = room.SoSinhVienHienTai;
    const max = room.SucChuaToiDa;

    // Đầy không cho chọn "Trống"
    if (current === max) {
        Array.from(roomStatus.options).forEach(opt => {
            if (opt.value === "Trống") opt.disabled = true;
        });
    }

    // Trống không cho chọn "Đầy"
    else if (current < max) {
        Array.from(roomStatus.options).forEach(opt => {
            if (opt.value === "Đầy") opt.disabled = true;
        });
    }

    // Logic gợi ý trạng thái (theo đặc tả)
    if (room.TrangThaiPhong === "Bảo trì" || room.TrangThaiPhong === "Ngưng sử dụng") {
        roomStatus.value = room.TrangThaiPhong; // ưu tiên user chọn
    } else {
        // Tự động tính toán nếu là phòng bình thường
        if (current >= max) {
            roomStatus.value = "Đầy";
        } else if (current === 0) {
            roomStatus.value = "Trống";
        }
    }

    roomStatus.disabled = false;
    roomStatus.style.cursor = "pointer";

    // 7. Ghi chú
    document.getElementById('editRoomNote').value = room.GhiChu || "";

    // Cảnh báo phòng gần đầy (UX)
    if (room.SoSinhVienHienTai === room.SucChuaToiDa - 1) {
        showToast("Phòng sắp đầy!", "warning");
    }

    toggleModal('editRoomModal');

    // VALIDATE NGAY KHI NHẬP
    document.getElementById('editRoomMax')
        .addEventListener('input', validateRoomInputs);
}

/** [LUỒNG CẬP NHẬT] Gửi dữ liệu PUT - Lưu từng giá trị riêng biệt */
async function updateRoomData(event) {
    if (event) event.preventDefault();

    // 1. Lấy định danh phòng (Key để tìm kiếm dòng cần sửa trong DB)
    const id = document.getElementById('editId').value;

    // 2. Trích xuất từng giá trị riêng biệt từ các phần tử Form
    const khuValue = document.getElementById('editRoomKhu').value.trim();
    const typeValue = document.getElementById('editRoomType').value.trim();
    let statusValue = document.getElementById('editRoomStatus').value.trim();
    const noteValue = document.getElementById('editRoomNote').value.trim();

    // Chuyển đổi dữ liệu số chính xác
    const maxNumber = parseInt(document.getElementById('editRoomMax').value, 10);
    const currentNumber = parseInt(document.getElementById('editRoomCurrent').value, 10);

    // Không tự động đổi nếu người dùng đã chọn Bảo trì hoặc Ngưng sử dụng
    if (statusValue !== "Bảo trì" && statusValue !== "Ngưng sử dụng") {
        // Tự động tính trạng thái theo số sinh viên
        if (currentNumber < maxNumber) {
            statusValue = "Trống";
        } else {
            statusValue = "Đầy";
        }
    }


    // 4. Đóng gói thành Object JSON với các thuộc tính riêng biệt
    // Đảm bảo tên thuộc tính khớp với tên Backend đang bóc tách (Khu, LoaiPhong,...)
    const roomData = {
        Khu: khuValue,
        LoaiPhong: typeValue,
        SucChuaToiDa: maxNumber,
        SoSinhVienHienTai: currentNumber,
        TrangThaiPhong: statusValue,
        GhiChu: noteValue
    };

    // Log chi tiết để Debug từng trường dữ liệu trước khi bay đi
    console.log(">>> DỮ LIỆU RIÊNG BIỆT SẮP GỬI:", {
        TenPhong_ID: id,
        Data: roomData
    });

    try {
        // 5. Gửi yêu cầu với URL đã được mã hóa Unicode cho TenPhong
        const response = await fetch(`${BASE_URL}/api/Phong/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(roomData)
        });

        // 6. Xử lý phản hồi từ Server
        if (!response.ok) {
            // Đọc thông báo lỗi thật từ SQL (ví dụ lỗi CHECK Constraint)
            const errorMsg = await response.text();
            throw new Error(errorMsg || "Lỗi Server khi cập nhật");
        }

        // Đọc phản hồi thành công (Text: "Cập nhật phòng thành công")
        const resultText = await response.text();
        console.log("Server response:", resultText);

        // 7. Hoàn tất và cập nhật UI
        showToast("Cập nhật thông tin phòng thành công!", "success");

        toggleModal('editRoomModal');

    } catch (err) {
        console.error("--- LỖI THỰC SỰ TẠI FRONTEND ---");
        console.error("Thông điệp:", err.message);
        console.log("Dữ liệu gây lỗi:", { roomName: id, LoaiPhong: roomData.LoaiPhong });

        // // Hiển thị thông báo lỗi cụ thể cho người dùng
        // showToast("Lỗi: " + err.message, "error");
    }

    // Load lại danh sách để thấy thay đổi (đặc biệt là chữ "Nữ" hoặc "N?")
    if (typeof loadPhong === 'function') {
        loadPhong('Phong');
    }
}

/** Mở Popup Sửa từ màn hình Chi tiết bằng cách trích xuất tên phòng hiện tại */
function openEditFromDetail() {
    const roomName = document.getElementById('detName').innerText.replace("Phòng ", "");
    openEditRoom(roomName);
}



/** Vẽ thanh phân trang (Pagination) ở dưới bảng */
function renderPaginationFooter() {
    const totalRows = filteredPhong.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;

    // 1. Cập nhật dòng thông báo số lượng
    const start = totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, totalRows);

    const showingCountEl = document.getElementById('showingCount');
    if (showingCountEl) {
        showingCountEl.innerText = `Hiển thị ${start}-${end}/${totalRows} phòng`;
    }

    // 2. Tạo HTML chỉ bao gồm: [Trước] [Số trang hiện tại / Tổng] [Sau]
    let html = `
        <div class="flex items-center gap-2">
            <button onclick="goToPage(${Math.max(1, currentPage - 1)})"
                ${currentPage === 1 ? 'disabled' : ''}
                class="px-3 py-1 rounded bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-all border border-slate-200">
                <i class="fa-solid fa-chevron-left text-[10px]"></i>
            </button>

            <div class="flex items-center px-4 py-1 bg-50 border border-200 rounded-lg">
                <span class="text-emerald-700 font-bold text-sm">${currentPage}</span>
                <span class="mx-2 text-slate-300">/</span>
                <span class="text-slate-500 text-sm">${totalPages}</span>
            </div>

            <button onclick="goToPage(${Math.min(totalPages, currentPage + 1)})"
                ${currentPage === totalPages ? 'disabled' : ''}
                class="px-3 py-1 rounded bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-all border border-slate-200">
                <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
        </div>
    `;

    const paginationEl = document.getElementById('pagination');
    if (paginationEl) {
        paginationEl.innerHTML = html;
    }
}


/** Chuyển đến trang cụ thể */
function goToPage(p) { currentPage = p; renderRoomTable(); }

/** Hàm đóng modal khi nhấn ra vùng mờ bên ngoài (Overlay) */
function closeModal(e, id) { if (e.target === document.getElementById(id)) toggleModal(id); }


// Cập nhật trạng thái phòng tự động khi thay đổi số sinh viên hoặc sức chứa
function autoUpdateRoomStatus() {
    const roomMax = document.getElementById('editRoomMax');
    const roomCurrent = document.getElementById('editRoomCurrent');
    const roomStatus = document.getElementById('editRoomStatus');

    const max = parseInt(roomMax.value) || 0;
    const current = parseInt(roomCurrent.value) || 0;

    const currentStatus = roomStatus.value;

    // Không override trạng thái đặc biệt
    if (currentStatus === "Bảo trì" || currentStatus === "Ngưng sử dụng") {
        return;
    }

    // Auto set
    if (current === 0) {
        roomStatus.value = "Trống";
    } else if (current === max) {
        roomStatus.value = "Đầy";
    }
}


// ================= TEMPLATE HTML MODULE PHONG =================
const PhongHTML = `
<section id="page-rooms" class="page-section active">
    <main class="p-6">
            <!-- Tiêu đề trang + nút thêm phòng -->
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-3xl font-bold text-slate-900">Quản lý Phòng ở</h2>
                    <p class="text-slate-500 mt-1 font-medium">
                        <span class="hover:text-emerald-600 cursor-pointer" onclick="switchPage('Trang Chu', document.querySelectorAll('.nav-item')[0])">Trang chủ</span>
                        <span class="mx-1">></span>
                        <span>Phòng ở</span>
                    </p>
                </div>

                <!-- Nút mở modal thêm phòng -->
                <button onclick="openAddRoom()"
                    class="bg-[#059669] text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all border-none shadow-lg">
                    <i class="fa-solid fa-circle-plus"></i> Thêm phòng
                </button>
            </div>

            <!-- ================= THỐNG KÊ PHÒNG ================= -->
            <div class="flex gap-4 mb-8">
            <div onclick="goToReportPage()" class="stat-card text-left cursor-pointer hover:shadow-md transition-all">
                <p class="text-[10px] font-bold text-slate-500 text-left">TỔNG PHÒNG</p>
                <p class="text-3xl font-bold" id="statTotal">0</p>
            </div>
            <div onclick="goToReportPage()" class="stat-card border-l-4 border-green-500 text-left cursor-pointer hover:shadow-md transition-all">
                <p class="text-[10px] font-bold text-slate-500">PHÒNG TRỐNG</p>
                <p class="text-3xl font-bold text-green-500" id="statEmpty">0</p>
            </div>
            <div onclick="goToReportPage()" class="stat-card border-l-4 border-red-500 text-left cursor-pointer hover:shadow-md transition-all">
                <p class="text-[10px] font-bold text-slate-500">PHÒNG ĐẦY</p>
                <p class="text-3xl font-bold text-red-500" id="statFull">0</p>
            </div>
            <div onclick="goToReportPage()" class="stat-card border-l-4 border-emerald-500 text-left cursor-pointer hover:shadow-md transition-all">
                <p class="text-[10px] font-bold text-slate-500">TỔNG SV</p>
                <p class="text-3xl font-bold text-emerald-500" id="statSV">0</p>
            </div>
            <div onclick="goToReportPage()" class="stat-card border-l-4 border-purple-400 text-left cursor-pointer hover:shadow-md transition-all">
                <p class="text-[10px] font-bold text-slate-500">TỶ LỆ</p>
                <p class="text-3xl font-bold text-purple-500" id="statRate">0%</p>
            </div>
        </div>
            <!-- ================= BỘ LỌC TÌM KIẾM ================= -->
            <!-- Thanh tìm kiếm và lọc dữ liệu phòng -->
            <div class="flex gap-4 mb-6">

                <!-- Tìm kiếm theo tên phòng -->
                <input type="text" id="searchRoom" oninput="filterData()" placeholder="Tìm tên phòng..." class="border-none rounded px-4 py-2 w-64 outline-none bg-white shadow-sm focus:ring-1 focus:ring-emerald-400">

                <!-- Lọc theo loại phòng -->
                <select id="filterType" onchange="filterData()" class="border-none rounded px-4 py-2 text-slate-500 outline-none bg-white shadow-sm cursor-pointer">
                    <option value="">Tất cả loại phòng</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                </select>

                <!-- Lọc theo trạng thái -->
                <select id="filterStatus" onchange="filterData()" class="border-none rounded px-4 py-2 text-slate-500 outline-none bg-white shadow-sm cursor-pointer">
                    <option value="">Tất cả trạng thái</option>
                    <option value="Trống">Trống</option>
                    <option value="Đầy">Đầy</option>
                    <option value="Bảo trì">Bảo trì</option>
                    <option value="Ngưng sử dụng">Ngưng sử dụng</option>
                </select>

                <!-- Nút reset bộ lọc -->
                <button onclick="resetPhongFilters()" class="text-slate-500 hover:text-red-500 transition-colors px-2 flex items-center gap-1">
                    <i class="fa-solid fa-rotate-left"></i> Reset lọc
                </button>
            </div>

            <!-- ================= BẢNG DỮ LIỆU PHÒNG ================= -->
            <div class="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">

                <!-- Bảng hiển thị danh sách phòng -->
                <table class="w-full text-left">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr class="text-[12px] font-bold text-slate-500 uppercase">
                            <th class="px-5 py-4">Tên phòng</th>
                            <th class="px-5 py-4">Khu</th>
                            <th class="px-5 py-4">Loại phòng</th>
                            <th class="px-5 py-4">Sức chứa</th>
                            <th class="px-5 py-4">Trạng thái</th>
                            <th class="px-5 py-4">Ghi chú</th>
                            <th class="px-8 py-4 text-center">Thao tác</th>
                        </tr>
                    </thead>

                    <!-- Body sẽ được render bằng JavaScript -->
                    <tbody id="roomTableBody" class="divide-y divide-slate-100"></tbody>
                </table>

                <!-- Footer hiển thị phân trang -->
                <footer class="px-8 py-4 flex justify-between items-center text-slate-500 bg-white border-t border-slate-200">
                    <span id="showingCount">Đang tải dữ liệu...</span>
                    <div class="flex gap-1 text-xs" id="pagination"></div>
                </footer>
            </div>
    </main>

    <!-- ================= MODAL CHI TIẾT PHÒNG ================= -->
    <!-- Popup hiển thị thông tin chi tiết phòng -->
    <div id="detailModal" class="modal" onclick="toggleModal('detailModal')">

        <!-- Nội dung modal -->
        <div class="bg-white rounded-xl p-8 w-[700px] shadow-2xl relative" onclick="event.stopPropagation()">

            <!-- Header modal -->
            <div class="flex justify-between items-start mb-6 border-b border-slate-200 pb-4">
                <div>
                    <h3 class="text-2xl font-bold text-emerald-800" id="detName">Chi tiết phòng</h3>
                    <p class="text-slate-500 text-xs mt-1 italic">Thông tin chi tiết</p>
                </div>

                <!-- Badge trạng thái -->
                <span id="detStatusBadge" class="px-3 py-1 rounded-full text-[10px] font-bold"></span>
            </div>

            <!-- Thông tin chi tiết phòng -->
            <div class="grid grid-cols-2 gap-6 text-sm mb-6">

                <!-- Cột thông tin bên trái -->
                <div class="space-y-4">
                    <div><p class="text-slate-500 text-[10px] font-bold uppercase mb-1">Loại phòng</p><p id="detType" class="font-semibold text-slate-900"></p></div>
                    <div><p class="text-slate-500 text-[10px] font-bold uppercase mb-1">Khu</p><p id="detKhu" class="font-semibold text-slate-900"></p></div>
                </div>

                <!-- Cột thông tin bên phải -->
                <div class="space-y-4">
                    <div><p class="text-slate-500 text-[10px] font-bold uppercase mb-1">Sức chứa tối đa</p><p id="detMax" class="font-semibold text-slate-900"></p></div>
                    <div><p class="text-slate-500 text-[10px] font-bold uppercase mb-1">Số sinh viên hiện tại</p><p id="detCurrent" class="font-semibold text-slate-900"></p></div>
                </div>
            </div>

            <!-- Ghi chú phòng -->
            <div class="bg-slate-50 p-4 rounded-lg mb-8 border border-dashed border-slate-200">
                <p class="text-slate-500 text-[10px] font-bold uppercase mb-2">Ghi chú phòng</p>
                <p id="detNote" class="text-slate-500 italic leading-relaxed"></p>
            </div>

            <!-- Danh sách sinh viên trong phòng -->
            <div class="mb-6">
                <p class="text-slate-500 text-[12px] font-bold uppercase mb-3">Danh sách sinh viên đang ở</p>

                <!-- Bảng sinh viên -->
                <div class="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                    <table class="w-full text-[11px]">
                        <thead class="bg-slate-50 sticky top-0">
                            <tr class="text-left text-slate-500">
                                <th class="p-3 pl-4">MSSV</th>
                                <th class="p-3">Họ tên</th>
                                <th class="p-3">SDT</th>
                                <th class="p-3">Hợp đồng</th>
                                <th class="p-3"></th>
                            </tr>
                        </thead>

                        <!-- Render bằng JS -->
                        <tbody id="detStudentList" class="divide-y divide-slate-50 bg-white">
                            </tbody>
                    </table>
                </div>
            </div>

            <!-- Các nút thao tác -->
            <div class="flex gap-3" id="detailModalButtons"></div>
        </div>
    </div>

    <!-- ================= MODAL THÊM PHÒNG ================= -->
    <div id="addRoomModal" class="modal" onclick="toggleModal('addRoomModal')">
        <div class="bg-white rounded-xl p-8 w-[550px] shadow-2xl" onclick="event.stopPropagation()">

            <div class="mb-6 border-b border-slate-200 pb-4">
                <h3 class="text-2xl font-bold text-slate-900">Thêm phòng mới</h3>
                <p class="text-slate-500 text-xs mt-1">
                    Thông tin được đánh dấu <span class="text-red-500 font-bold">*</span> là bắt buộc
                </p>
            </div>

            <form id="addRoomForm" onsubmit="saveNewRoom(event)">
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Tên phòng <span class="text-red-500">*</span>
                            </label>
                            <input type="text" id="addRoomName" placeholder="Nhập tên phòng..."
                                class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none focus:border-emerald-500 transition-all">
                            <small id="errorAddRoomName" style="color: red; display: block; margin-top: 4px;"></small>

                        </div>

                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Khu <span class="text-red-500">*</span>
                            </label>
                            <select id="addRoomKhu"
                                class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none cursor-pointer focus:border-emerald-500">
                                <option value="">Chọn khu</option>
                                <option value="A">Khu A</option>
                                <option value="B">Khu B</option>
                                <option value="C">Khu C</option>
                            </select>
                            <small id="errorAddRoomKhu" style="color: red; display: block; margin-top: 4px;"></small>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Loại phòng <span class="text-red-500">*</span>
                            </label>
                            <select id="addRoomType"
                                class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none cursor-pointer focus:border-emerald-500">
                                <option value="">Chọn loại phòng</option>
                                <option value="Nam">Nam</option>
                                <option value="Nữ">Nữ</option>
                            </select>
                            <small id="errorAddRoomType" style="color: red; display: block; margin-top: 4px;"></small>
                        </div>

                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Trạng thái
                            </label>
                            <select id="addRoomStatus" disabled
                                class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg cursor-not-allowed text-slate-500">
                                <option value="Trống" selected>Trống</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Sức chứa tối đa <span class="text-red-500">*</span>
                            </label>
                            <select id="addRoomMax"
                                class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none cursor-pointer focus:border-emerald-500">
                                <option value="">Chọn sức chứa</option>
                                <option value="4">4 chỗ</option>
                                <option value="6">6 chỗ</option>
                                <option value="8">8 chỗ</option>
                            </select>
                            <small id="errorAddRoomMax" style="color: red; display: block; margin-top: 4px;"></small>
                        </div>

                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                SV hiện tại
                            </label>
                            <input type="number" id="addRoomCurrent" value="0" disabled
                                class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg cursor-not-allowed text-slate-500">
                        </div>
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Ghi chú phòng
                        </label>
                        <textarea id="addRoomNote" rows="3"
                            placeholder="Nhập ghi chú (nếu có)..."
                            class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none focus:border-emerald-500 transition-all resize-none"></textarea>
                    </div>

                    <div class="flex gap-3 pt-6 border-t border-slate-200">
                        <button type="submit"
                            class="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-all">
                            Lưu phòng
                        </button>
                        <button type="button"
                            onclick="toggleModal('addRoomModal')"
                            class="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-lg font-bold hover:bg-slate-200 transition-all">
                            Hủy
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- ================= MODAL SỬA PHÒNG ================= -->
    <div id="editRoomModal" class="modal" onclick="toggleModal('editRoomModal')">
    <div class="bg-white rounded-xl p-8 w-[550px] shadow-2xl" onclick="event.stopPropagation()">

        <div class="mb-6 border-b border-slate-200 pb-4">
            <h3 class="text-2xl font-bold text-slate-900">Cập nhật thông tin phòng</h3>
            <p class="text-slate-500 text-xs mt-1">Sửa đổi các thông tin cần thiết bên dưới</p>
        </div>

        <!-- FORM -->
        <form id="editRoomForm" onsubmit="updateRoomData(event)">

            <div class="space-y-4">

                <input type="hidden" id="editId">

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1 ">Tên phòng</label>
                        <input type="text" id="editRoomName"
                        class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none focus:border-emerald-500">
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1 ">Khu</label>
                        <select id="editRoomKhu"
                        class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none cursor-pointer">
                            <option value="A">Khu A</option>
                            <option value="B">Khu B</option>
                            <option value="C">Khu C</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">

                    <div>
                        <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1 ">Loại phòng</label>
                        <select id="editRoomType"
                        class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none cursor-pointer">
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1 ">Trạng thái</label>
                        <select id="editRoomStatus"
                        class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none cursor-pointer">
                            <option value="Trống">Trống</option>
                            <option value="Đầy">Đầy</option>
                            <option value="Bảo trì">Bảo trì</option>
                            <option value="Ngưng sử dụng">Ngưng sử dụng</option>
                        </select>
                    </div>

                </div>

                <div class="grid grid-cols-2 gap-4">

                    <div class="flex flex-col">
                        <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1 ">
                            Sức chứa tối đa
                        </label>

                        <select id="editRoomMax"
                        class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none cursor-pointer">
                            <option value="4">4 chỗ</option>
                            <option value="6">6 chỗ</option>
                            <option value="8">8 chỗ</option>
                        </select>

                        <small id="errorRoomMax" class="text-red-500 text-xs mt-1"></small>
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1 ">SV hiện tại</label>
                        <input type="number" id="editRoomCurrent" disabled
                        class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg cursor-not-allowed">
                    </div>

                </div>

                <div>
                    <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Ghi chú phòng</label>
                    <textarea id="editRoomNote" rows="3"
                    class="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none focus:border-emerald-500 resize-none"></textarea>
                </div>

                <div class="flex gap-3 pt-6 border-t border-slate-200">

                    <!-- SUBMIT -->
                    <button type="submit"
                        class="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-all">
                        Cập nhật thay đổi
                    </button>

                    <button type="button"
                    onclick="toggleModal('editRoomModal')"
                    class="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-lg font-bold hover:bg-slate-200 transition-all">
                    Đóng
                    </button>

                </div>

            </div>

        </form>

    </div>
    </div>


</section>
`;

// Tạo hàm render module Phòng để gọi khi chuyển tab
function renderPhongModule() {
    document.getElementById("main-content").innerHTML = PhongHTML;
}

document.addEventListener("DOMContentLoaded", () => {
    const roomMaxEl = document.getElementById('editRoomMax');
    const roomCurrentEl = document.getElementById('editRoomCurrent');

    if (roomMaxEl && roomCurrentEl) {
        roomMaxEl.addEventListener("input", validateRoomInputs);
        roomCurrentEl.addEventListener("input", validateRoomInputs);
    }
});