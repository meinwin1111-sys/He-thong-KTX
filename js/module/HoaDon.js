let dsHoaDon = [];
let currentInvoiceTab = 'all'; // Mặc định hiển thị tất cả
let invoiceCurrentPage = 1;
const invoiceRowsPerPage = 10; // Mỗi trang hiển thị 10 dòng
let filteredInvoices = [];    // Mảng chứa hóa đơn sau khi lọc (nếu có)




// ĐƯỜNG DẪN API (Thay đổi đường dẫn này khi bạn có Backend thật)
const API_URL = `${BASE_URL}/api/HoaDon`;


// ==========================================================
// RENDER MODULE HÓA ĐƠN
// ==========================================================
function renderHoaDonModule() {
    const main = document.getElementById("main-content");
    main.innerHTML = `
    <section class="p-6">


    <div class="flex justify-between items-start mb-6">
        <div>
            <h2 class="text-3xl font-bold text-slate-900">Quản lý Hóa đơn</h2>
            <p class="text-slate-500 mt-1 font-medium">
                <span class="hover:text-emerald-600 cursor-pointer" onclick="switchPage('Trang Chu', document.querySelectorAll('.nav-item')[0])">Trang chủ</span>
                <span class="mx-1">></span>
                <span>Hóa đơn</span>
            </p>
        </div>


        <div class="flex gap-3">
            <button onclick="openAddInvoiceModal()"
                class="bg-[#059669] text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2">
                <i class="fa-solid fa-circle-plus"></i> Tạo hóa đơn
            </button>
        </div>
    </div>


    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 w-full">


        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between min-h-[100px] hover:shadow-md transition-all">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng hóa đơn</p>
            <h3 id="statTotalInvoice" class="text-3xl font-black text-slate-900">0</h3>
        </div>


        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 flex flex-col justify-between min-h-[100px] hover:shadow-md transition-all">
            <p class="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Tổng doanh thu</p>
            <div class="flex items-baseline gap-1">
                <h3 id="statTotalRevenue" class="text-3xl font-black text-emerald-600">0</h3>
                <span class="text-sm font-bold text-emerald-400"></span>
            </div>
        </div>


        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-green-500 flex flex-col justify-between min-h-[100px] hover:shadow-md transition-all">
            <p class="text-xs font-bold text-green-500 uppercase tracking-wider mb-2">Thực thu</p>
            <div class="flex items-baseline gap-1">
                <h3 id="statCollected" class="text-3xl font-black text-green-600">0</h3>
                <span class="text-sm font-bold text-green-400"></span>
            </div>
        </div>


        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-red-500 flex flex-col justify-between min-h-[100px] hover:shadow-md transition-all">
            <p class="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Công nợ</p>
            <div class="flex items-baseline gap-1">
                <h3 id="statDebt" class="text-3xl font-black text-red-600">0</h3>
                <span class="text-sm font-bold text-red-400"></span>
            </div>
        </div>
    </div>


    <div class="flex mb-6 border-b border-slate-200">
        <button id="tab-all-inv" onclick="filterHoaDon('all')"
            class="tab-item active-tab py-2 px-6 font-semibold text-slate-500 transition-all">
            Tất cả hóa đơn
        </button>


        <button id="tab-unpaid" onclick="filterHoaDon('unpaid')"
            class="tab-item py-2 px-6 font-semibold text-slate-500 transition-all flex items-center gap-2">
            Chưa thanh toán
        </button>
    </div>


    <div class="bg-white rounded-xl border overflow-x-auto shadow-sm">
        <table class="min-w-[1000px] w-full text-left border-collapse">
            <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                    <th class="px-6 py-4 font-semibold">Mã HĐ</th>
                    <th class="px-6 py-4 font-semibold">Phòng</th>
                    <th class="px-6 py-4 font-semibold">Tháng</th>
                    <th class="px-6 py-4 font-semibold">Năm</th>
                    <th class="px-6 py-4 font-semibold">Ngày lập</th>
                    <th class="px-6 py-4 font-semibold text-right">Tổng tiền (VNĐ)</th>
                    <th class="px-6 py-4 font-semibold text-center">Trạng thái</th>
                    <th class="px-6 py-4 font-semibold text-center">Thao tác</th>
                </tr>
            </thead>
            <tbody id="hoadon-table-body" class="divide-y divide-slate-100 text-sm">
                </tbody>
        </table>


        <div class="px-6 py-4 flex justify-between items-center text-sm text-slate-500 border-t">
            <span id="showingInvoice">Đang tải dữ liệu...</span>
            <div id="paginationInvoice" class="flex items-center gap-2">
                </div>
        </div>
    </div>


    <div id="addInvoiceModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
        <div class="bg-white w-[600px] rounded-2xl shadow-2xl overflow-hidden">
            <div class="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                <h3 class="text-xl font-bold text-slate-900">Tạo Hóa Đơn Điện Nước & Phòng</h3>
                <button onclick="closeAddInvoiceModal()" class="text-slate-500 text-2xl">×</button>
            </div>


            <div class="p-6 space-y-4">
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">Mã sinh viên <span class="text-red-500">*</span></label>
                <input type="text" id="add-maSV" maxlength="30" oninput="handleAutoFillRoom(); clearFieldError('add-maSV')" placeholder="Nhập mã sinh viên" class="w-full border rounded-lg px-3 py-2 uppercase">
                <p id="err-add-maSV" class="hidden text-xs text-red-500 mt-1"></p>
                <p id="maSV-error" class="hidden text-xs text-red-500 mt-1"></p>
            </div>
            <div class="grid grid-cols-2 gap-4">
    <div>
        <label class="block text-xs font-bold text-slate-500 mb-1">Mã hóa đơn (do hệ thống cấp)</label>
        <input type="text" id="add-id"
            class="w-full border rounded-lg px-3 py-2 bg-slate-50 font-bold text-emerald-600 cursor-not-allowed"
            placeholder="Cấp sau khi lưu" readonly>
    </div>

    <div>
        <label class="block text-xs font-bold text-slate-500 mb-1">Ngày lập</label>
        <input type="date" id="add-ngayLap"
            class="w-full border rounded-lg px-3 py-2 bg-slate-50 cursor-not-allowed"
            readonly>
    </div>
</div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Tháng <span class="text-red-500">*</span></label>
                        <select id="add-thang" class="w-full border rounded-lg px-3 py-2">
                            ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===new Date().getMonth()+1?'selected':''}>${i+1}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Năm <span class="text-red-500">*</span></label>
                        <select id="add-nam" class="w-full border rounded-lg px-3 py-2">
                            ${[2024,2025,2026,2027].map(y=>`<option value="${y}" ${y===new Date().getFullYear()?'selected':''}>${y}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Tên phòng <span class="text-red-500">*</span></label>
                        <input type="text" id="add-tenPhong" oninput="handleAutoFillByRoom(); clearFieldError('add-tenPhong')" placeholder="Nhập tên phòng (VD: A101)" class="w-full border rounded-lg px-3 py-2 uppercase">
                        <p id="err-add-tenPhong" class="hidden text-xs text-red-500 mt-1"></p>
                        <p id="tenPhong-error" class="hidden text-xs text-red-500 mt-1"></p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Tiền phòng</label>
                        <input type="number" id="add-tienPhong" oninput="calculateTotal(); clearFieldError('add-tienPhong')" class="w-full border rounded-lg px-3 py-2 font-bold bg-slate-50 cursor-not-allowed" readonly>
                        <p id="err-add-tienPhong" class="hidden text-xs text-red-500 mt-1"></p>
                    </div>
                </div>


                <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p class="text-emerald-600 font-bold text-sm mb-2"><i class="fa-solid fa-bolt"></i> TIỀN ĐIỆN (3.500đ/kWh)</p>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase">Chỉ số cũ</label>
                            <input type="number" id="add-dienCu" oninput="calculateTotal()" class="w-full border rounded px-3 py-1.5" value="0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase">Chỉ số mới</label>
                            <input type="number" id="add-dienMoi" oninput="calculateTotal(); clearFieldError('add-dienMoi')" class="w-full border rounded px-3 py-1.5" placeholder="Nhập số mới">
                            <p id="err-add-dienMoi" class="hidden text-xs text-red-500 mt-1"></p>
                        </div>
                    </div>
                </div>


                <div class="p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                    <p class="text-cyan-600 font-bold text-sm mb-2"><i class="fa-solid fa-droplet"></i> TIỀN NƯỚC (15.000đ/m3)</p>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase">Chỉ số cũ</label>
                            <input type="number" id="add-nuocCu" oninput="calculateTotal()" class="w-full border rounded px-3 py-1.5" value="0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase">Chỉ số mới</label>
                            <input type="number" id="add-nuocMoi" oninput="calculateTotal(); clearFieldError('add-nuocMoi')" class="w-full border rounded px-3 py-1.5" placeholder="Nhập số mới">
                            <p id="err-add-nuocMoi" class="hidden text-xs text-red-500 mt-1"></p>
                        </div>
                    </div>
                </div>


                <div class="bg-red-50 p-2 rounded-lg border border-red-100">
                        <label class="block text-[10px] font-bold text-red-400 uppercase">Tổng cộng thanh toán</label>
                        <h3 id="display-tongTien" class="text-xl font-black text-red-600">0 đ</h3>
                    </div>
            </div>


            <div class="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t">
                <button onclick="closeAddInvoiceModal()" class="px-5 py-2 text-slate-500 font-bold">Hủy</button>
                <button onclick="saveNewInvoice()" class="px-8 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg">LƯU HÓA ĐƠN</button>
            </div>
        </div>
    </div>


    <!-- POPUP THANH TOÁN -->
    <div id="paymentModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
        <div class="bg-white w-[460px] rounded-2xl shadow-2xl overflow-hidden">
            <div class="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                <h3 class="text-lg font-bold text-slate-900"><i class="fa-solid fa-money-bill-wave text-green-500 mr-2"></i>Xác nhận thanh toán</h3>
                <button onclick="closePaymentModal()" class="text-slate-500 text-2xl leading-none">×</button>
            </div>
            <div class="p-6 space-y-3 text-sm">
                <div class="bg-slate-50 rounded-xl p-4 space-y-2 border">
                    <div class="flex justify-between"><span class="text-slate-500">Mã hóa đơn</span><span id="pay-id" class="font-bold text-slate-900"></span></div>
                    <div class="flex justify-between"><span class="text-slate-500">Phòng</span><span id="pay-phong" class="font-medium text-emerald-600"></span></div>
                    <div class="flex justify-between"><span class="text-slate-500">Ngày lập</span><span id="pay-ngay" class="font-medium"></span></div>
                    <div class="flex justify-between border-t pt-2 mt-1">
                        <span class="text-slate-500">Tiền phòng</span><span id="pay-tienPhong" class="font-medium"></span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-500">Tiền điện</span><span id="pay-tienDien" class="font-medium"></span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-500">Tiền nước</span><span id="pay-tienNuoc" class="font-medium"></span>
                    </div>
                    <div class="flex justify-between border-t pt-2 mt-1"><span class="text-slate-500 font-bold">Tổng tiền</span><span id="pay-tong" class="font-black text-red-500 text-base"></span></div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Phương thức thanh toán</label>
                    <select id="pay-method" class="w-full border rounded-lg px-3 py-2">
                        <option value="Tiền mặt">Tiền mặt</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Ghi chú</label>
                    <input type="text" id="pay-note" placeholder="Ghi chú (tuỳ chọn)" class="w-full border rounded-lg px-3 py-2">
                </div>
            </div>
            <div class="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t">
                <button onclick="closePaymentModal()" class="px-5 py-2 text-slate-500 font-bold">Hủy</button>
                <button onclick="confirmPayment()" class="px-8 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow">Xác nhận thanh toán</button>
            </div>
        </div>
    </div>

    <!-- POPUP IN HÓA ĐƠN -->
    <div id="printModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
        <div class="bg-white w-[560px] rounded-2xl shadow-2xl overflow-hidden">
            <div class="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                <h3 class="text-lg font-bold text-slate-900"><i class="fa-solid fa-print text-slate-500 mr-2"></i>In hóa đơn</h3>
                <button onclick="closePrintModal()" class="text-slate-500 text-2xl leading-none">×</button>
            </div>
            <div class="p-6">
                <!-- Vùng nội dung in -->
                <div id="print-area" class="border rounded-xl p-6 space-y-3 text-sm bg-white">
                    <div class="text-center mb-4">
                        <p class="text-xs text-slate-500 uppercase tracking-widest">Ký túc xá</p>
                        <h2 class="text-xl font-black text-slate-900 mt-1">HÓA ĐƠN TIỀN PHÒNG</h2>
                        <p id="print-id" class="text-emerald-600 font-bold mt-1"></p>
                    </div>
                    <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div><span class="text-slate-500">Phòng:</span> <span id="print-phong" class="font-semibold text-emerald-600"></span></div>
                        <div><span class="text-slate-500">Ngày lập:</span> <span id="print-ngay" class="font-semibold"></span></div>
                        <div><span class="text-slate-500">Trạng thái:</span> <span id="print-trangThai" class="font-semibold"></span></div>
                    </div>
                    <hr class="my-2">
                    <table class="w-full text-sm">
                        <thead><tr class="text-slate-500 text-xs uppercase"><th class="text-left py-1">Khoản mục</th><th class="text-right py-1">Số tiền</th></tr></thead>
                        <tbody>
                            <tr><td class="py-1">Tiền phòng</td><td id="print-tienPhong" class="text-right font-medium"></td></tr>
                            <tr><td class="py-1">Tiền điện</td><td id="print-tienDien" class="text-right font-medium"></td></tr>
                            <tr><td class="py-1">Tiền nước</td><td id="print-tienNuoc" class="text-right font-medium"></td></tr>
                            <tr class="border-t font-bold"><td class="pt-2">Tổng cộng</td><td id="print-tongTien" class="text-right text-red-500 pt-2"></td></tr>
                        </tbody>
                    </table>
                    <div class="mt-4">
                        <label class="block text-xs font-bold text-slate-500 mb-1">Phương thức thanh toán</label>
                        <select id="print-pay-method" onchange="toggleQR()" class="w-full border rounded-lg px-3 py-2 text-sm">
                            <option value="Tiền mặt">Tiền mặt</option>
                            <option value="Chuyển khoản">Chuyển khoản</option>
                        </select>
                    </div>
                    <div id="print-qr-box" class="hidden"></div>
                </div>
            </div>
            <div class="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t">
                <button onclick="closePrintModal()" class="px-5 py-2 text-slate-500 font-bold">Đóng</button>
                <button onclick="doPrint()" class="px-8 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 shadow flex items-center gap-2">
                    <i class="fa-solid fa-print"></i> In ngay
                </button>
            </div>
        </div>
    </div>

    <!-- POPUP CẬP NHẬT HÓA ĐƠN -->
    <div id="editInvoiceModal" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
        <div class="bg-white w-[600px] rounded-2xl shadow-2xl overflow-hidden">
            <div class="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                <h3 class="text-xl font-bold text-slate-900"><i class="fa-solid fa-pen text-emerald-500 mr-2"></i>Cập nhật hóa đơn</h3>
                <button onclick="closeEditInvoiceModal()" class="text-slate-500 text-2xl leading-none">×</button>
            </div>
            <div class="p-6 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Mã hóa đơn</label>
                        <input type="text" id="edit-id" readonly class="w-full border rounded-lg px-3 py-2 bg-slate-50 font-bold text-emerald-600 cursor-not-allowed">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Ngày lập</label>
                        <input type="date" id="edit-ngayLap" class="w-full border rounded-lg px-3 py-2">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Tên phòng</label>
                        <input type="text" id="edit-tenPhong" readonly class="w-full border rounded-lg px-3 py-2 bg-slate-50 text-emerald-600 font-bold cursor-not-allowed">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">Tiền phòng</label>
                        <input type="number" id="edit-tienPhong" oninput="calculateEditTotal()" class="w-full border rounded-lg px-3 py-2 font-bold">
                    </div>
                </div>
                <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p class="text-emerald-600 font-bold text-sm mb-2"><i class="fa-solid fa-bolt"></i> TIỀN ĐIỆN (3.500đ/kWh)</p>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase">Chỉ số cũ</label>
                            <input type="number" id="edit-dienCu" oninput="calculateEditTotal()" class="w-full border rounded px-3 py-1.5" value="0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase">Chỉ số mới</label>
                            <input type="number" id="edit-dienMoi" oninput="calculateEditTotal()" class="w-full border rounded px-3 py-1.5">
                        </div>
                    </div>
                </div>
                <div class="p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                    <p class="text-cyan-600 font-bold text-sm mb-2"><i class="fa-solid fa-droplet"></i> TIỀN NƯỚC (15.000đ/m3)</p>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase">Chỉ số cũ</label>
                            <input type="number" id="edit-nuocCu" oninput="calculateEditTotal()" class="w-full border rounded px-3 py-1.5" value="0">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase">Chỉ số mới</label>
                            <input type="number" id="edit-nuocMoi" oninput="calculateEditTotal()" class="w-full border rounded px-3 py-1.5">
                        </div>
                    </div>
                </div>
                <div class="bg-red-50 p-2 rounded-lg border border-red-100">
                        <label class="block text-[10px] font-bold text-red-400 uppercase">Tổng cộng</label>
                        <h3 id="edit-display-tongTien" class="text-xl font-black text-red-600">0 đ</h3>
                    </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Trạng thái thanh toán (từ giao dịch)</label>
                    <select id="edit-trangThai" disabled class="w-full border rounded-lg px-3 py-2 bg-slate-50 text-slate-500 cursor-not-allowed">
                        <option value="Chưa thanh toán">Chưa thanh toán</option>
                        <option value="Đã thanh toán">Đã thanh toán</option>
                    </select>
                </div>
            </div>
            <div class="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t">
                <button onclick="closeEditInvoiceModal()" class="px-5 py-2 text-slate-500 font-bold">Hủy</button>
                <button onclick="saveEditInvoice()" class="px-8 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg">LƯU THAY ĐỔI</button>
            </div>
        </div>
    </div>

    </section>
    `;

    main.querySelector("#hoadon-table-body").addEventListener("click", event => {
        const button = event.target.closest("[data-payment-history]");
        if (!button) return;
        openInvoicePaymentHistory(decodeURIComponent(button.dataset.paymentHistory));
    });

    // Gọi các hàm xử lý dữ liệu
    updateInvoiceStats();
    renderHoaDonTable();
    fetchHoaDonFromServer();
}


// Hàm lấy dữ liệu từ mảng dsHoaDon và sinh HTML cho bảng
async function fetchHoaDonFromServer() {
    try {
        // 1. Gửi yêu cầu GET đến Server
        const response = await ApiClient.fetch(API_URL);


        // 2. Kiểm tra nếu phản hồi từ Server không OK (ví dụ lỗi 404, 500)
        if (!response.ok) {
            throw new Error("Không thể kết nối với máy chủ!");
        }


        // 3. Chuyển đổi dữ liệu từ dạng JSON sang mảng JavaScript
        const raw = await response.json();

        // Normalize field names (hỗ trợ cả PascalCase từ SQL và camelCase từ alias)
        dsHoaDon = raw.map(r => ({
            id:        r.id        || r.MaHoaDon        || r.maHoaDon        || '',
            tenPhong:  r.tenPhong  || r.TenPhong         || '',
            ngayLap:   r.ngayLap   || r.NgayLap          || '',
            thang:     r.thang     || r.Thang            || (r.ngayLap || r.NgayLap ? new Date(r.ngayLap || r.NgayLap).getMonth()+1 : null),
            nam:       r.nam       || r.Nam              || (r.ngayLap || r.NgayLap ? new Date(r.ngayLap || r.NgayLap).getFullYear() : null),
            tienPhong: r.tienPhong || r.TienPhong        || 0,
            tienDien:  r.tienDien  || r.TienDien         || 0,
            tienNuoc:  r.tienNuoc  || r.TienNuoc         || 0,
            tongTien:  r.tongTien  || r.TongTien         || 0,
            trangThai: r.trangThai || r.TrangThaiThanhToan || r.TrangThai || '',
            SoDienCu:  r.SoDienCu  || r.soDienCu         || 0,
            SoDienMoi: r.SoDienMoi || r.soDienMoi         || 0,
            SoNuocCu:  r.SoNuocCu  || r.soNuocCu         || 0,
            SoNuocMoi: r.SoNuocMoi || r.soNuocMoi         || 0,
        }));


        // 4. Sau khi có dữ liệu, gọi hàm vẽ bảng để hiển thị lên màn hình
        updateInvoiceStats(); // Cập nhật lại các chỉ số thống kê
        renderHoaDonTable();


    } catch (error) {
        dsHoaDon = [];
        updateInvoiceStats();
        renderHoaDonTable();
        showToast(error.message || "Không thể tải danh sách hóa đơn.", "error");
    }
}


/** Tính toán các chỉ số thống kê tài chính cho Hóa đơn */
function updateInvoiceStats() {
    // 1. Tính tổng số hóa đơn
    const total = dsHoaDon.length;


    // 2. Tính Tổng Tiền (Doanh thu dự tính)
    const totalRevenue = dsHoaDon.reduce((sum, hd) => sum + (parseFloat(hd.tongTien) || 0), 0);


    // 3. Tính Thực Thu (Tiền từ các hóa đơn đã thanh toán)
    const actualCollected = dsHoaDon
        .filter(hd => hd.trangThai === 'Đã thanh toán')
        .reduce((sum, hd) => sum + (parseFloat(hd.tongTien) || 0), 0);


    // 4. Tính Công Nợ (Tiền từ các hóa đơn chưa thanh toán)
    const pendingDebt = dsHoaDon
        .filter(hd => hd.trangThai === 'Chưa thanh toán')
        .reduce((sum, hd) => sum + (parseFloat(hd.tongTien) || 0), 0);


    // 5. Cập nhật lên giao diện
    const statTotal = document.getElementById('statTotalInvoice');
    const statRevenue = document.getElementById('statTotalRevenue');
    const statCollected = document.getElementById('statCollected');
    const statDebt = document.getElementById('statDebt');
    const statRate = document.getElementById('statPaymentRate');


    if (statTotal) statTotal.innerText = total;
    if (statRevenue) statRevenue.innerText = totalRevenue.toLocaleString() + ' đ';
    if (statCollected) statCollected.innerText = actualCollected.toLocaleString() + ' đ';
    if (statDebt) statDebt.innerText = pendingDebt.toLocaleString() + ' đ';


    // 6. Tính Tỷ lệ thu hồi nợ (%)
    const collectionRate = totalRevenue > 0 ? Math.round((actualCollected / totalRevenue) * 100) : 0;
    if (statRate) statRate.innerText = collectionRate + '%';
}


/** Vẽ thanh phân trang cho module Hóa đơn */
function renderInvoicePagination(totalRows) {
    if (totalRows === undefined) {
        totalRows = currentInvoiceTab === 'unpaid'
            ? dsHoaDon.filter(hd => hd.trangThai === 'Chưa thanh toán').length
            : dsHoaDon.length;
    }
    const totalPages = Math.ceil(totalRows / invoiceRowsPerPage) || 1;


    // 1. Cập nhật dòng thông báo số lượng (ID khớp với HTML module Hóa đơn)
    const start = totalRows === 0 ? 0 : (invoiceCurrentPage - 1) * invoiceRowsPerPage + 1;
    const end = Math.min(invoiceCurrentPage * invoiceRowsPerPage, totalRows);


    const showingInvoiceEl = document.getElementById('showingInvoice');
    if (showingInvoiceEl) {
        showingInvoiceEl.innerText = `Hiển thị ${start}-${end}/${totalRows} hóa đơn`;
    }


    // 2. Tạo HTML phân trang
    let html = `
        <div class="flex items-center gap-2">
            <button onclick="changeInvoicePage(${Math.max(1, invoiceCurrentPage - 1)})"
                ${invoiceCurrentPage === 1 ? 'disabled' : ''}
                class="px-3 py-1 rounded bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-all border border-slate-200">
                <i class="fa-solid fa-chevron-left text-[10px]"></i>
            </button>


            <div class="flex items-center px-4 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <span class="text-emerald-700 font-bold text-sm">${invoiceCurrentPage}</span>
                <span class="mx-2 text-slate-300">/</span>
                <span class="text-slate-500 text-sm">${totalPages}</span>
            </div>


            <button onclick="changeInvoicePage(${Math.min(totalPages, invoiceCurrentPage + 1)})"
                ${invoiceCurrentPage === totalPages ? 'disabled' : ''}
                class="px-3 py-1 rounded bg-slate-100 text-slate-500 disabled:opacity-30 hover:bg-slate-200 transition-all border border-slate-200">
                <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
        </div>
    `;


    const paginationInvoiceEl = document.getElementById('paginationInvoice');
    if (paginationInvoiceEl) {
        paginationInvoiceEl.innerHTML = html;
    }
}


/** Hàm thực hiện chuyển trang */
function changeInvoicePage(page) {
    invoiceCurrentPage = page;
    renderHoaDonTable(); // Vẽ lại bảng khi đổi trang
}


// Hàm này sẽ thay đổi trạng thái tab, lọc dữ liệu và vẽ lại bảng.
function filterHoaDon(type) {
    currentInvoiceTab = type;


    // 1. Cập nhật giao diện Tab (đổi màu nút active)
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.classList.remove('active-tab', 'text-emerald-600', 'border-b-2', 'border-emerald-600');
        tab.classList.add('text-slate-500');
    });


    const activeTab = type === 'all' ? document.getElementById('tab-all-inv') : document.getElementById('tab-unpaid');
    if (activeTab) {
        activeTab.classList.add('active-tab', 'text-emerald-600', 'border-b-2', 'border-emerald-600');
        activeTab.classList.remove('text-slate-500');
    }


    // 2. Reset về trang 1 khi chuyển tab
    invoiceCurrentPage = 1;


    // 3. Vẽ lại bảng (Hàm renderHoaDonTable sẽ tự kiểm tra currentInvoiceTab)
    renderHoaDonTable();
}


// Hàm vẽ bảng Hóa đơn dựa trên dữ liệu trong mảng dsHoaDon
function renderHoaDonTable() {
    const tbody = document.getElementById("hoadon-table-body");
    if (!tbody) return;


    // --- BƯỚC LỌC DỮ LIỆU THEO TAB ---
    let dataDisplay = dsHoaDon;
    if (currentInvoiceTab === 'unpaid') {
        dataDisplay = dsHoaDon.filter(hd => hd.trangThai === 'Chưa thanh toán');
    }


    // --- BƯỚC TÍNH PHÂN TRANG TRÊN DỮ LIỆU ĐÃ LỌC ---
    const startIndex = (invoiceCurrentPage - 1) * invoiceRowsPerPage;
    const endIndex = startIndex + invoiceRowsPerPage;
    const pageData = dataDisplay.slice(startIndex, endIndex);


    if (dataDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500 italic">Không tìm thấy hóa đơn nào trong mục này.</td></tr>`;
        renderInvoicePagination(0);
        return;
    }

    // Vẽ dữ liệu từ pageData
    tbody.innerHTML = pageData.map(hd => `
        <tr class="hover:bg-slate-50 border-b transition-colors text-sm">
            <td class="px-6 py-4 font-bold text-slate-900">${hd.id}</td>
            <td class="px-6 py-4 text-emerald-600 font-medium">${hd.tenPhong}</td>
            <td class="px-6 py-4 text-slate-500">${hd.thang || (hd.ngayLap ? new Date(hd.ngayLap).getMonth()+1 : '---')}</td>
            <td class="px-6 py-4 text-slate-500">${hd.nam || (hd.ngayLap ? new Date(hd.ngayLap).getFullYear() : '---')}</td>
            <td class="px-6 py-4">${hd.ngayLap ? hd.ngayLap.split('T')[0] : '---'}</td>
            <td class="px-6 py-4 text-right font-bold text-red-500">${(hd.tongTien || 0).toLocaleString()}</td>
            <td class="px-6 py-4 text-center">
                <span class="px-3 py-1 rounded-full text-[11px] font-bold
                    ${hd.trangThai === 'Đã thanh toán' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${hd.trangThai}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex justify-center gap-2 whitespace-nowrap">
                    ${hd.trangThai === 'Đã thanh toán'
                        ? `<button disabled class="px-3 py-1 border rounded bg-slate-50 text-slate-500 flex items-center gap-1 cursor-not-allowed text-xs">
                            <i class="fa-solid fa-check"></i> Đã thu tiền
                           </button>`
                        : `<button onclick="openPaymentModal('${hd.id}')"
                            class="px-3 py-1 border border-green-300 text-green-600 rounded hover:bg-green-50 flex items-center gap-1 text-xs">
                            <i class="fa-solid fa-clipboard-check"></i> Kiểm tra yêu cầu
                           </button>`
                    }
                    <button onclick="openPrintModal('${hd.id}')"
                        class="px-3 py-1 border border-slate-200 text-slate-500 rounded hover:bg-slate-50 flex items-center gap-1 text-xs">
                        <i class="fa-solid fa-print"></i> In
                    </button>
                    ${hd.trangThai === 'Đã thanh toán'
                        ? `<button disabled class="px-3 py-1 border rounded bg-slate-50 text-slate-500 flex items-center gap-1 cursor-not-allowed text-xs">
                            <i class="fa-solid fa-pen"></i> Sửa
                           </button>`
                        : `<button onclick="openEditInvoiceModal('${hd.id}')"
                            class="px-3 py-1 border border-emerald-300 text-emerald-600 rounded hover:bg-emerald-50 flex items-center gap-1 text-xs">
                            <i class="fa-solid fa-pen"></i> Sửa
                           </button>`
                    }
                    <button type="button" data-payment-history="${encodeURIComponent(hd.id)}"
                        class="px-3 py-1 border border-blue-200 text-blue-700 rounded hover:bg-blue-50 flex items-center gap-1 text-xs">
                        <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Lịch sử thanh toán
                    </button>
                </div>
            </td>
        </tr>
    `).join('');


    // Cập nhật footer dựa trên dataDisplay.length
    renderInvoicePagination(dataDisplay.length);
}


async function openInvoicePaymentHistory(invoiceId) {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
    const dialog = document.createElement('dialog');
    dialog.className = 'w-[min(900px,95vw)] max-h-[85vh] rounded-2xl p-0 shadow-2xl';
    dialog.innerHTML = `
        <section class="bg-white rounded-2xl overflow-hidden">
            <header class="px-6 py-4 border-b flex justify-between items-center">
                <div><h2 class="text-xl font-bold text-slate-900">Lịch sử thanh toán</h2>
                    <p class="text-sm text-slate-500">Hóa đơn ${escape(invoiceId)}</p></div>
                <button type="button" data-close class="text-slate-500 text-2xl" aria-label="Đóng">×</button>
            </header>
            <div data-history-content class="p-6 overflow-auto"><p role="status">Đang tải lịch sử từ máy chủ...</p></div>
            <footer class="px-6 py-4 bg-slate-50 flex justify-end">
                <button type="button" data-close class="px-5 py-2 rounded-lg border">Đóng</button>
            </footer>
        </section>`;
    document.body.append(dialog);
    dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
        dialog.close();
        dialog.remove();
    }));
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal();

    try {
        const response = await ApiClient.fetch(`/api/payments/history?MaHoaDon=${encodeURIComponent(invoiceId)}`);
        const records = await response.json();
        const content = dialog.querySelector('[data-history-content]');
        if (!records.length) {
            content.innerHTML = '<p class="text-slate-500">Hóa đơn này chưa có giao dịch thanh toán được ghi nhận.</p>';
            return;
        }
        const formatDate = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
        const transactions = new Map();
        for (const record of records) {
            let transaction = transactions.get(record.MaGiaoDich);
            if (!transaction) {
                transaction = { ...record, items: [], total: 0 };
                transactions.set(record.MaGiaoDich, transaction);
            }
            transaction.items.push(record.TenKhoan);
            transaction.total += Number(record.SoTien || 0);
        }
        content.innerHTML = `
            <div class="overflow-auto">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs uppercase text-slate-500 bg-slate-50"><tr>
                        <th class="p-3">Giao dịch / sinh viên</th><th class="p-3">Khoản thanh toán</th>
                        <th class="p-3 text-right">Số tiền</th><th class="p-3">Thời gian</th>
                        <th class="p-3">Phương thức / trạng thái</th><th class="p-3">Xác nhận / xử lý</th>
                    </tr></thead>
                    <tbody>${[...transactions.values()].map(record => `<tr class="border-b align-top" data-transaction-row="${escape(record.MaGiaoDich)}">
                        <td class="p-3"><strong>${escape(record.MaGiaoDich)}</strong><small class="block">${escape(record.HoTen)} (${escape(record.MaSinhVien)})</small>
                            <small>${escape(record.TenPhong)}</small><small>Nội dung: ${escape(record.NoiDungCK || '—')}</small>
                            ${record.MaThamChieuNgoai ? `<small>Mã NH: ${escape(record.MaThamChieuNgoai)}</small>` : ''}</td>
                        <td class="p-3">${escape(record.items.join(', '))}</td>
                        <td class="p-3 text-right">${Number(record.total).toLocaleString('vi-VN')} ₫</td>
                        <td class="p-3">${escape(formatDate(record.NgayThanhToan || record.NgayTao))}</td>
                        <td class="p-3">${escape(record.PhuongThuc === 'ONLINE' ? 'Chuyển khoản QR' : 'Tiền mặt')}
                            <strong class="block">${escape(record.TrangThai)}</strong>
                            ${record.LyDoTuChoi ? `<small>${escape(record.LyDoTuChoi)}</small>` : ''}</td>
                        <td class="p-3">${record.TrangThai === 'PENDING' && record.PhuongThuc === 'CASH' ? `
                            <label class="block text-xs mb-1" for="payment-ref-${escape(record.MaGiaoDich)}">Mã biên nhận tiền mặt (nếu có)</label>
                            <input id="payment-ref-${escape(record.MaGiaoDich)}" data-payment-reference maxlength="100" class="border rounded px-2 py-1 w-48 mb-2">
                            <button type="button" data-confirm-payment class="block mb-2 px-3 py-1 rounded bg-emerald-600 text-white">Xác nhận đã thu tiền</button>
                            <button type="button" data-reject-payment class="px-3 py-1 rounded border border-red-300 text-red-700">Từ chối</button>
                            <p data-action-error role="alert" class="text-red-600 mt-2"></p>` : record.TrangThai === 'PENDING' && record.PhuongThuc === 'ONLINE'
                                ? 'Chờ xác minh tự động từ ngân hàng'
                                : record.TrangThai === 'SUCCESS' && record.PhuongThuc === 'ONLINE'
                                    ? 'Ngân hàng (tự động)'
                                    : record.TrangThai === 'SUCCESS'
                                        ? `Quản lý${record.TenNguoiXacNhan ? `: ${escape(record.TenNguoiXacNhan)}` : ' xác nhận'}`
                                        : '—'}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>`;
        content.addEventListener('click', async event => {
            const button = event.target.closest('[data-confirm-payment], [data-reject-payment]');
            if (!button) return;
            const row = button.closest('[data-transaction-row]');
            const errorNode = row.querySelector('[data-action-error]');
            const reject = button.hasAttribute('data-reject-payment');
            let reason = '';
            if (reject) {
                reason = window.prompt('Nhập lý do từ chối để Sinh viên biết cần kiểm tra gì:') || '';
                if (!reason.trim()) {
                    errorNode.textContent = 'Cần nhập lý do để từ chối giao dịch.';
                    return;
                }
            } else if (!window.confirm('Chỉ xác nhận sau khi đã nhận tiền mặt thực tế. Tiếp tục?')) {
                return;
            }
            button.disabled = true;
            errorNode.textContent = '';
            try {
                const transactionId = row.dataset.transactionRow;
                const response = await ApiClient.fetch(`/api/payments/${reject ? 'reject' : 'confirm'}/${encodeURIComponent(transactionId)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reject
                        ? { LyDoTuChoi: reason.trim() }
                        : { MaThamChieuNgoai: row.querySelector('[data-payment-reference]').value.trim() })
                });
                const result = await response.json();
                if (typeof showToast === 'function') showToast(result.message || 'Đã cập nhật giao dịch.', 'success');
                dialog.close();
                await fetchHoaDonFromServer();
                await openInvoicePaymentHistory(invoiceId);
            } catch (error) {
                errorNode.textContent = error.message || 'Không thể cập nhật giao dịch.';
                button.disabled = false;
            }
        });
    } catch (error) {
        const content = dialog.querySelector('[data-history-content]');
        content.innerHTML = `<p class="text-red-600" role="alert">${escape(error.message || 'Không thể tải lịch sử thanh toán.')}</p>`;
    }
}


// ======================================================================================================================
// XỬ LÝ THAO TÁC THÊM HÓA ĐƠN MỚI
// ======================================================================================================================


/** 1. Mở Modal và thiết lập mặc định */

// ==========================================================
// XỬ LÝ THAO TÁC THÊM HÓA ĐƠN MỚI
// ==========================================================

// Helper: hiển thị lỗi inline dưới input
function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    if (input) input.classList.add('border-red-400');
    if (errEl) { errEl.textContent = message; errEl.classList.remove('hidden'); }
}

// Helper: xóa lỗi inline
function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    if (input) input.classList.remove('border-red-400');
    if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
}

// 👇 function này gọi nó

function openAddInvoiceModal() {


    const modal = document.getElementById('addInvoiceModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const addIdEl = document.getElementById('add-id');
    if (addIdEl) addIdEl.value = '';

    // ✅ Ngày hôm nay
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('add-ngayLap').value = today;

    // Reset form
    const addMaSVEl = document.getElementById('add-maSV');
    if (addMaSVEl) addMaSVEl.value = "";
    const addTenPhongEl = document.getElementById('add-tenPhong');
    if (addTenPhongEl) addTenPhongEl.value = "";
    const displayTongTienEl = document.getElementById('display-tongTien');
    if (displayTongTienEl) displayTongTienEl.innerText = "0 đ";
}


function closeAddInvoiceModal() {
    const modal = document.getElementById('addInvoiceModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    // Reset form
    ['add-tenPhong','add-tienPhong','add-dienMoi','add-nuocMoi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['add-dienCu','add-nuocCu'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 0;
    });
    const tongEl = document.getElementById('display-tongTien');
    if (tongEl) tongEl.innerText = '0 đ';
    const errEl = document.getElementById('tenPhong-error');
    if (errEl) errEl.classList.add('hidden');
}


/** 2. Tự động lấy Tên phòng từ Mã sinh viên khi đang nhập */
let _autoFillTimer = null;
function handleAutoFillRoom() {
    const maSVInput = document.getElementById('add-maSV');
    if (!maSVInput) return;
    const maSV = maSVInput.value.trim().toUpperCase();
    const tenPhongInput = document.getElementById('add-tenPhong');
    const errorMsg = document.getElementById('maSV-error');

    // Reset khi trống
    if (!maSV) {
        if (tenPhongInput) { tenPhongInput.value = ""; tenPhongInput.style.color = ""; }
        if (errorMsg) errorMsg.classList.add('hidden');
        return;
    }

    // Ẩn lỗi cũ khi đang gõ
    if (errorMsg) errorMsg.classList.add('hidden');

    // Debounce: chờ người dùng ngừng gõ 400ms rồi mới tìm
    clearTimeout(_autoFillTimer);
    _autoFillTimer = setTimeout(async () => {
        // Thử tìm trong rawHopDong nếu đã được load, lọc đúng theo maSV
        if (typeof rawHopDong !== 'undefined' && rawHopDong.length > 0) {
            const found = rawHopDong.find(h =>
                (h.MaSinhVien || '').toUpperCase() === maSV &&
                (h.TrangThaiHopDong === 'Còn hiệu lực' || h.TrangThai === 'Còn hiệu lực')
            );
            if (found) {
                if (tenPhongInput) { tenPhongInput.value = found.TenPhong || ""; tenPhongInput.style.color = "#059669"; }
                handleAutoFillByRoom();
                if (errorMsg) errorMsg.classList.add('hidden');
                return;
            }
        }

        // Không tìm thấy
        if (tenPhongInput) { tenPhongInput.value = ""; tenPhongInput.style.color = ""; }
        if (errorMsg) { errorMsg.classList.remove('hidden'); errorMsg.innerText = "Không tìm thấy sinh viên có hợp đồng hiệu lực!"; }
    }, 400);
}


// Định nghĩa giá điện và nước (có thể thay đổi nếu cần)
const GIA_DIEN = 3500;
const GIA_NUOC = 15000;

// Tự động lấy chỉ số cũ và tiền phòng khi nhập tên phòng
let _autoFillRoomTimer = null;
function handleAutoFillByRoom() {
    const tenPhong = document.getElementById('add-tenPhong').value.trim().toUpperCase();
    const errorEl = document.getElementById('tenPhong-error');
    if (errorEl) errorEl.classList.add('hidden');

    if (!tenPhong) {
        document.getElementById('add-tienPhong').value = '';
        document.getElementById('add-dienCu').value = 0;
        document.getElementById('add-nuocCu').value = 0;
        calculateTotal();
        return;
    }

    clearTimeout(_autoFillRoomTimer);
    _autoFillRoomTimer = setTimeout(async () => {
        try {
            // Lấy thông tin phòng (tiền phòng theo sức chứa)
            const resPhong = await ApiClient.fetch(`${BASE_URL}/api/Phong`);
            if (resPhong.ok) {
                const phongList = await resPhong.json();
                const phong = phongList.find(p => (p.TenPhong || '').toUpperCase() === tenPhong);
                if (phong) {
                    document.getElementById('add-tienPhong').value = Number(phong.GiaPhong) || 0;
                    if (errorEl) errorEl.classList.add('hidden');
                } else {
                    if (errorEl) { errorEl.innerText = 'Không tìm thấy phòng'; errorEl.classList.remove('hidden'); }
                }
            }

            // Lấy chỉ số cũ từ dsHoaDon đã load — SoDienMoi của HĐ gần nhất là chỉ số cũ kỳ này
            const hdPhong = dsHoaDon
                .filter(h => (h.tenPhong || '').toUpperCase() === tenPhong)
                .sort((a, b) => new Date(b.ngayLap) - new Date(a.ngayLap));

            if (hdPhong.length > 0) {
                const last = hdPhong[0];
                document.getElementById('add-dienCu').value = last.SoDienMoi || last.soDienMoi || 0;
                document.getElementById('add-nuocCu').value = last.SoNuocMoi || last.soNuocMoi || 0;
            } else {
                document.getElementById('add-dienCu').value = 0;
                document.getElementById('add-nuocCu').value = 0;
            }
            calculateTotal();
        } catch (e) {
            if (errorEl) {
                errorEl.innerText = e.message || 'Không thể lấy dữ liệu phòng.';
                errorEl.classList.remove('hidden');
            }
            showToast(e.message || 'Không thể tải dữ liệu phòng.', 'error');
        }
    }, 500);
}


function calculateTotal() {
    const tienPhong = parseFloat(document.getElementById('add-tienPhong').value) || 0;


    // Tính điện
    const dienCu = parseFloat(document.getElementById('add-dienCu').value) || 0;
    const dienMoi = parseFloat(document.getElementById('add-dienMoi').value) || 0;
    const soDien = Math.max(0, dienMoi - dienCu);
    const tienDien = soDien * GIA_DIEN;


    // Tính nước
    const nuocCu = parseFloat(document.getElementById('add-nuocCu').value) || 0;
    const nuocMoi = parseFloat(document.getElementById('add-nuocMoi').value) || 0;
    const soNuoc = Math.max(0, nuocMoi - nuocCu);
    const tienNuoc = soNuoc * GIA_NUOC;


    // Tổng cộng
    const tongTien = tienPhong + tienDien + tienNuoc;
    const maSinhVien = document.getElementById('add-maSV').value.trim();


    // Hiển thị lên modal
    document.getElementById('display-tongTien').innerText = tongTien.toLocaleString() + " đ";


    return { soDien, soNuoc, tongTien };
}


/** 3. Lưu hóa đơn vào CSDL */
async function saveNewInvoice() {
    const calc = calculateTotal();

    const tenPhong = document.getElementById('add-tenPhong').value.trim().toUpperCase();
    const thang    = parseInt(document.getElementById('add-thang').value);
    const nam      = parseInt(document.getElementById('add-nam').value);
    const tienPhong = parseFloat(document.getElementById('add-tienPhong').value) || 0;
    const dienCu   = parseFloat(document.getElementById('add-dienCu').value) || 0;
    const dienMoi  = parseFloat(document.getElementById('add-dienMoi').value) || 0;
    const nuocCu   = parseFloat(document.getElementById('add-nuocCu').value) || 0;
    const nuocMoi  = parseFloat(document.getElementById('add-nuocMoi').value) || 0;
    const tienDien = Math.max(0, dienMoi - dienCu) * GIA_DIEN;
    const tienNuoc = Math.max(0, nuocMoi - nuocCu) * GIA_NUOC;
    const tongTien = tienPhong + tienDien + tienNuoc;

    // Validate inline
    let hasError = false;
    ['add-maSV', 'add-tenPhong', 'add-tienPhong', 'add-dienMoi', 'add-nuocMoi'].forEach(clearFieldError);

    if (!tenPhong) {
        showFieldError('add-tenPhong', 'Vui lòng nhập tên phòng');
        hasError = true;
    }
    if (!maSinhVien) {
        showFieldError('add-maSV', 'Vui lòng nhập mã sinh viên');
        hasError = true;
    }
    if (!tienPhong) {
        showFieldError('add-tienPhong', 'Chưa tìm thấy tiền phòng, kiểm tra lại tên phòng');
        hasError = true;
    }
    if (!dienMoi) {
        showFieldError('add-dienMoi', 'Vui lòng nhập chỉ số điện mới');
        hasError = true;
    }
    if (!nuocMoi) {
        showFieldError('add-nuocMoi', 'Vui lòng nhập chỉ số nước mới');
        hasError = true;
    }
    if (hasError) return;

    // Ngày lập: ngày 1 của tháng/năm được chọn
    const ngayLap = `${nam}-${String(thang).padStart(2,'0')}-01`;
    const payload = {
        MaSinhVien:         maSinhVien,
        TenPhong:           tenPhong,
        NgayLap:            ngayLap,
        Thang:              thang,
        Nam:                nam,
        TienPhong:          tienPhong,
        TienDien:           tienDien,
        TienNuoc:           tienNuoc,
        TongTien:           tongTien,
        SoDienCu:           dienCu,
        SoDienMoi:          dienMoi,
        SoNuocCu:           nuocCu,
        SoNuocMoi:          nuocMoi,
        TrangThaiThanhToan: "Chưa thanh toán",
    };

    try {
        const res = await ApiClient.fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || "Lỗi khi lưu hóa đơn!", "error");
            return;
        }

        showToast("Tạo hóa đơn thành công!", "success");
        closeAddInvoiceModal();
        fetchHoaDonFromServer();
    } catch (e) {
        console.error(e);
        showToast(e.message || "Không thể tạo hóa đơn.", "error");
    }
}


// ==========================================================
// POPUP THANH TOÁN
// ==========================================================
function openPaymentModal(id) {
    if (!dsHoaDon.some(invoice => invoice.id === id)) return;
    openInvoicePaymentHistory(id);
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function confirmPayment() {
    closePaymentModal();
    showToast('Quản lý chỉ xác nhận giao dịch tiền mặt đang chờ trong lịch sử thanh toán.', 'info');
}

// ==========================================================
// POPUP IN HÓA ĐƠN
// ==========================================================
async function openPrintModal(id) {
    let hd;
    try {
        const res = await ApiClient.fetch(`${API_URL}/${encodeURIComponent(id)}`);
        hd = await res.json();
    } catch (error) {
        showToast(error.message || "Không thể tải hóa đơn để in.", "error");
        return;
    }

    const tienPhong = parseFloat(hd.tienPhong || hd.TienPhong) || 0;
    const tienDien  = parseFloat(hd.tienDien  || hd.TienDien)  || (parseFloat(hd.chiSoDien || hd.ChiSoDien) || 0) * GIA_DIEN;
    const tienNuoc  = parseFloat(hd.tienNuoc  || hd.TienNuoc)  || (parseFloat(hd.chiSoNuoc || hd.ChiSoNuoc) || 0) * GIA_NUOC;
    const tongTien  = parseFloat(hd.tongTien  || hd.TongTien)  || (tienPhong + tienDien + tienNuoc);
    const maHD      = hd.id || hd.MaHoaDon || id;
    const maSV      = hd.maSV || hd.MaSinhVien || '';
    const tenPhong  = hd.tenPhong || hd.TenPhong || '';
    const ngayLap   = (hd.ngayLap || hd.NgayLap || '').split('T')[0];
    const trangThai = hd.trangThai || hd.TrangThaiThanhToan || '';

    document.getElementById('print-id').innerText        = maHD;
    document.getElementById('print-phong').innerText     = tenPhong;
    document.getElementById('print-ngay').innerText      = ngayLap;
    document.getElementById('print-trangThai').innerText = trangThai;
    document.getElementById('print-tienPhong').innerText = tienPhong.toLocaleString() + ' đ';
    document.getElementById('print-tienDien').innerText  = tienDien.toLocaleString() + ' đ';
    document.getElementById('print-tienNuoc').innerText  = tienNuoc.toLocaleString() + ' đ';
    document.getElementById('print-tongTien').innerText  = tongTien.toLocaleString() + ' đ';

    // Ẩn QR mặc định
    const qrBox = document.getElementById('print-qr-box');
    if (qrBox) qrBox.classList.add('hidden');

    // Lưu data để doPrint dùng
    window._currentPrintData = { maHD, maSV, tenPhong, ngayLap, trangThai, tienPhong, tienDien, tienNuoc, tongTien };

    const modal = document.getElementById('printModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePrintModal() {
    const modal = document.getElementById('printModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function toggleQR() {
    const method = document.getElementById('print-pay-method')?.value;
    const qrBox = document.getElementById('print-qr-box');
    if (!qrBox) return;
    if (method === 'Chuyển khoản') {
        qrBox.innerHTML = `
            <div class="text-center mt-4 p-4 border rounded-xl bg-amber-50" role="status">
                <p class="text-xs font-bold text-amber-700 mb-2">CHƯA CÓ TÍCH HỢP THANH TOÁN QR</p>
                <p class="text-[11px] text-slate-600">Hãy xác nhận giao dịch chuyển khoản theo thông tin chính thức của đơn vị trước khi ghi nhận thanh toán trong hệ thống.</p>
            </div>`;
        qrBox.classList.remove('hidden');
    } else {
        qrBox.classList.add('hidden');
    }
}

function doPrint() {
    const d = window._currentPrintData || {};
    const method = document.getElementById('print-pay-method')?.value || 'Tiền mặt';
    const qrHtml = method === 'Chuyển khoản' ? `
        <div style="text-align:center;margin-top:20px;padding:16px;border:1px solid #fcd34d;border-radius:8px;background:#fffbeb">
            <p style="font-size:11px;font-weight:bold;color:#b45309;margin-bottom:8px">CHƯA CÓ TÍCH HỢP THANH TOÁN QR</p>
            <p style="font-size:11px;color:#475569">Chỉ ghi nhận chuyển khoản sau khi xác nhận giao dịch theo thông tin chính thức của đơn vị.</p>
        </div>` : '';

    const win = window.open('', '_blank', 'width=620,height=800');
    if (!win) {
        showToast('Trình duyệt đã chặn popup. Vui lòng cho phép popup để in!', 'error');
        return;
    }
    win.document.write(`
        <html><head><title>Hóa đơn ${d.maHD}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 32px; font-size: 14px; color: #111; }
            h2 { text-align: center; margin: 0; font-size: 18px; }
            .sub { text-align: center; color: #64748b; font-size: 12px; margin-bottom: 16px; }
            .badge { display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:bold;
                background:${d.trangThai === 'Đã thanh toán' ? '#dcfce7' : '#fef9c3'};
                color:${d.trangThai === 'Đã thanh toán' ? '#16a34a' : '#ca8a04'}; }
            .info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 12px 0; }
            .info .label { color: #64748b; font-size:12px; }
            .info .value { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { text-align: left; border-bottom: 1px solid #ddd; padding: 6px 0; font-size: 11px; color: #64748b; text-transform: uppercase; }
            td { padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
            .total td { font-weight: bold; border-top: 2px solid #ddd; border-bottom: none; padding-top: 10px; }
            .total td:last-child { color: #dc2626; font-size: 16px; }
            .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #64748b; }
        </style></head><body>
        <p class="sub">KÝ TÚC XÁ - ĐẠI HỌC KINH TẾ ĐÀ NẴNG</p>
        <h2>HÓA ĐƠN TIỀN PHÒNG</h2>
        <p style="text-align:center;color:#059669;font-weight:bold;margin:4px 0">${d.maHD}</p>
        <p style="text-align:center;margin:4px 0"><span class="badge">${d.trangThai}</span></p>
        <div class="info" style="margin-top:16px">
            <div><span class="label">Phòng</span><br><span class="value" style="color:#059669">${d.tenPhong}</span></div>
            <div><span class="label">Ngày lập</span><br><span class="value">${d.ngayLap}</span></div>
            <div><span class="label">Phương thức</span><br><span class="value">${method}</span></div>
        </div>
        <table>
            <thead><tr><th>Khoản mục</th><th style="text-align:right">Số tiền</th></tr></thead>
            <tbody>
                <tr><td>Tiền phòng</td><td style="text-align:right">${d.tienPhong.toLocaleString()} đ</td></tr>
                <tr><td>Tiền điện</td><td style="text-align:right">${d.tienDien.toLocaleString()} đ</td></tr>
                <tr><td>Tiền nước</td><td style="text-align:right">${d.tienNuoc.toLocaleString()} đ</td></tr>
            </tbody>
            <tfoot><tr class="total"><td>TỔNG CỘNG</td><td style="text-align:right">${d.tongTien.toLocaleString()} đ</td></tr></tfoot>
        </table>
        ${qrHtml}
        <p class="footer">Cảm ơn bạn đã thanh toán đúng hạn!<br>In lúc: ${new Date().toLocaleString('vi-VN')}</p>
        </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

// ==========================================================
// POPUP CẬP NHẬT HÓA ĐƠN
// ==========================================================
function openEditInvoiceModal(id) {
    const hd = dsHoaDon.find(h => h.id === id);
    if (!hd) { showToast('Không tìm thấy hóa đơn!', 'error'); return; }

    document.getElementById('edit-id').value        = hd.id;
    document.getElementById('edit-ngayLap').value   = hd.ngayLap ? hd.ngayLap.split('T')[0] : '';
    document.getElementById('edit-tenPhong').value  = hd.tenPhong || '';
    document.getElementById('edit-tienPhong').value = hd.tienPhong || 0;
    document.getElementById('edit-dienCu').value    = hd.SoDienCu  || hd.soDienCu  || 0;
    document.getElementById('edit-dienMoi').value   = hd.SoDienMoi || hd.soDienMoi || 0;
    document.getElementById('edit-nuocCu').value    = hd.SoNuocCu  || hd.soNuocCu  || 0;
    document.getElementById('edit-nuocMoi').value   = hd.SoNuocMoi || hd.soNuocMoi || 0;
    document.getElementById('edit-trangThai').value = hd.trangThai || 'Chưa thanh toán';

    calculateEditTotal();

    const modal = document.getElementById('editInvoiceModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeEditInvoiceModal() {
    const modal = document.getElementById('editInvoiceModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function calculateEditTotal() {
    const tienPhong = parseFloat(document.getElementById('edit-tienPhong').value) || 0;
    const dienCu = parseFloat(document.getElementById('edit-dienCu').value) || 0;
    const dienMoi = parseFloat(document.getElementById('edit-dienMoi').value) || 0;
    const nuocCu = parseFloat(document.getElementById('edit-nuocCu').value) || 0;
    const nuocMoi = parseFloat(document.getElementById('edit-nuocMoi').value) || 0;

    const tienDien = Math.max(0, dienMoi - dienCu) * GIA_DIEN;
    const tienNuoc = Math.max(0, nuocMoi - nuocCu) * GIA_NUOC;
    const tongTien = tienPhong + tienDien + tienNuoc;

    document.getElementById('edit-display-tongTien').innerText = tongTien.toLocaleString() + ' đ';
    return tongTien;
}

async function saveEditInvoice() {
    const id = document.getElementById('edit-id').value;
    const tienPhong = parseFloat(document.getElementById('edit-tienPhong').value) || 0;
    const dienCu    = parseFloat(document.getElementById('edit-dienCu').value)    || 0;
    const dienMoi   = parseFloat(document.getElementById('edit-dienMoi').value)   || 0;
    const nuocCu    = parseFloat(document.getElementById('edit-nuocCu').value)    || 0;
    const nuocMoi   = parseFloat(document.getElementById('edit-nuocMoi').value)   || 0;
    const tienDien  = Math.max(0, dienMoi - dienCu) * GIA_DIEN;
    const tienNuoc  = Math.max(0, nuocMoi - nuocCu) * GIA_NUOC;
    const tongTien  = tienPhong + tienDien + tienNuoc;

    // Cập nhật hiển thị tổng tiền
    const tongEl = document.getElementById('edit-display-tongTien');
    if (tongEl) tongEl.innerText = tongTien.toLocaleString() + ' đ';

    const formData = {
        ngayLap:   document.getElementById('edit-ngayLap').value,
        tienPhong,
        tienDien,
        tienNuoc,
        SoDienCu:  dienCu,
        SoDienMoi: dienMoi,
        SoNuocCu:  nuocCu,
        SoNuocMoi: nuocMoi,
        tongTien,
        trangThai: document.getElementById('edit-trangThai').value
    };

    try {
        const res = await ApiClient.fetch(`${API_URL}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!res.ok) throw new Error("Không thể cập nhật hóa đơn.");

        // Cập nhật local
        const hd = dsHoaDon.find(h => h.id === id);
        if (hd) Object.assign(hd, formData);

        showToast('Cập nhật hóa đơn thành công!', 'success');
        closeEditInvoiceModal();
        updateInvoiceStats();
        renderHoaDonTable();
    } catch (err) {
        showToast(err.message || 'Không thể cập nhật hóa đơn.', 'error');
    }
}