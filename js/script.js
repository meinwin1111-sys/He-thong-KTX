// ==========================================================
// BASE URL - tự động dùng đúng host khi deploy
// ==========================================================
const BASE_URL = window.ApiClient.baseUrl;

// ==========================================================
// CẤU TRÚC NÚT BẤM DÙNG CHUNG
// ==========================================================

// const e = require("express");

document.addEventListener("DOMContentLoaded", function () {
    const session = window.ApiClient?.getSession();
    if (session) {
        window.currentUser = session.user;
        showSystemLayout();
        renderTrangChuModule();
        updateAdminHoverPopup();
        return;
    }
    renderLoginModule();
});

/** Hàm tạo HTML cho các nút bấm dựa trên cấu hình (Style Tailwind và Icon FontAwesome) */
function createButton(type, onClick) {
    const config = {
        "Sửa": { class: "flex-1 bg-emerald-600 text-white py-2.5 rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center gap-2", icon: "fa-pen-to-square" },
        "Đóng": { class: "flex-1 bg-slate-100 py-2.5 rounded-lg text-slate-500 hover:bg-slate-200 font-bold", icon: "" },
        "Lưu": { class: "flex-[2] bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-md", icon: "" },
        "Hủy": { class: "flex-1 bg-slate-100 text-slate-500 py-3 rounded-lg font-bold hover:bg-slate-200", icon: "" },
        "Xóa": { class: "flex-1 bg-red-500 text-white py-2.5 rounded-lg font-bold hover:bg-red-600", icon: "fa-trash-can" }
    };
    const btn = config[type];
    if (!btn) return "";
    const iconHtml = btn.icon ? `<i class="fa-solid ${btn.icon}"></i> ` : "";
    return `<button onclick="${onClick}" class="${btn.class}">${iconHtml}${type}</button>`;
}

// ==========================================================
// HÀM ĐIỀU HƯỚNG CHUYỂN TRANG
// ==========================================================

// Hàm chuyển đổi giữa các trang/module trong giao diện
function switchPage(pageId, element) {
    if (!window.ApiClient?.getSession()) {
        renderLoginModule();
        return;
    }

    // Restore header/nav nếu đang ở trang chủ
    if (typeof window._restoreLayout === "function") {
        window._restoreLayout();
    }

    // Bỏ active của tất cả menu
    document.querySelectorAll('.nav-item')
        .forEach(nav => nav.classList.remove('nav-active'));

    // Active menu vừa click
    if (element) {
        element.classList.add('nav-active');
    }

    const main = document.getElementById("main-content");

    if (pageId === "Phong") {
        renderPhongModule();
        loadPhong("Phong");
    }
    else if (pageId === "Bao cao & Thong ke") {
        renderBaoCaoThongKeModule();
    }
    else if (pageId === "Trang Chu") {
        renderTrangChuModule();
    }
    else if (pageId === "Sinh Vien") {
        renderSinhVienModule();
    }
    else if (pageId === "Hop Dong") {
        renderHopDongModule();
        loadHopDong();
    }
    else if (pageId === "Hoa Don") {
        renderHoaDonModule();
    }
    else if (pageId === "Duyet & Kiem soat") {
        renderDuyetKiemSoatModule();
    }

    // Module chưa phát triển
    else {
        main.innerHTML = `
        <section class="page-section active">
            <main class="p-6">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h2 class="text-3xl font-bold text-slate-900">${pageId}</h2>
                    <p class="text-slate-500 mt-1 font-medium">DMS > ${pageId}</p>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-20 text-center text-slate-500">
                    Module đang được phát triển
                </div>
            </main>
        </section>`;
    }
}

/** Hàm bổ trợ để chuyển sang trang Báo cáo từ thẻ thống kê */
function goToReportPage() {
    // 1. Tìm tất cả các mục menu bên trái
    const navItems = document.querySelectorAll('.nav-item');

    // 2. Tìm mục có tên là "Báo cáo & Thống kê"
    const reportMenu = Array.from(navItems).find(nav =>
        nav.innerText.includes('Báo cáo') || nav.innerText.includes('Thống kê')
    );

    if (reportMenu) {
        // 3. Gọi hàm chuyển trang đã có sẵn trong script.js
        switchPage("Bao cao & Thong ke", reportMenu);
    } else {
        // Nếu không tìm thấy menu, vẫn cố gắng render module báo cáo
        renderBaoCaoThongKeModule();
        loadBaoCaoThongKe();
    }
}

// ==========================================================
// HÀM BẬT/TẮT MODAL VÀ DỌN DẸP FORM
// ==========================================================
// Hàm bật/tắt modal (popup form thêm/sửa dữ liệu)
function toggleModal(id) {

    // Lấy phần tử modal theo id
    const m = document.getElementById(id);

    // Thêm hoặc xóa class 'active' để hiển thị hoặc ẩn modal
    const active = m.classList.toggle('active');

    // Chỉ thực hiện dọn dẹp nếu đây là Modal THÊM và nó đang ĐÓNG
    if (!active && id === 'addRoomModal') {
        // Cập nhật đúng các ID của Modal Thêm (addRoom...)
        document.getElementById('addRoomName').value = "";
        document.getElementById('addRoomKhu').value = "";
        document.getElementById('addRoomType').value = "";
        document.getElementById('addRoomMax').value = "";
        document.getElementById('addRoomNote').value = "";

        // Reset trạng thái hiển thị
        const nameInput = document.getElementById('addRoomName');
        nameInput.disabled = false;
        nameInput.style.backgroundColor = "";

        document.getElementById('addRoomStatus').value = "Trống";
        document.getElementById('addRoomCurrent').value = "0";
    }
}

// Hàm đóng modal khi click ra bên ngoài vùng modal
function closeModal(e, id) {
    // Kiểm tra nếu phần tử được click chính là nền modal (không phải nội dung bên trong)
    if (e.target === document.getElementById(id)) {
        // Gọi lại hàm toggleModal để đóng modal
        toggleModal(id);
    }
}

// ==========================================================
// TOAST
// ==========================================================
// hàm hiển thị thông báo (toast) khi thực hiện các thao tác như thêm/sửa dữ liệu
function showToast(message, type = 'success') {
    const toast = document.createElement("div");
    toast.innerText = message;

    // Thiết lập Style cơ bản
    Object.assign(toast.style, {
        position: "fixed",
        bottom: "20px",
        left: "20px",
        padding: "12px 20px",
        borderRadius: "6px",
        color: "white",
        fontWeight: "500",
        zIndex: "9999",
        opacity: "0",
        transition: "opacity 0.3s",
        boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
    });

    // Thay đổi màu nền dựa trên loại thông báo
    toast.style.background = type === 'success' ? "#04c54b" : "#ef4444";

    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = "1", 10);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
