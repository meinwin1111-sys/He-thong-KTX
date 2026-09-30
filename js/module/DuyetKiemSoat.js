// Frontend demo: dữ liệu độc lập với hóa đơn/hợp đồng thật trên server.
(() => {
    const storageKey = 'dms.duyet-kiem-soat.demo.v1';
    const pending = 'Chờ duyệt';
    const approved = 'Đã duyệt';
    const rejected = 'Từ chối';
    const requests = [
        { id: 'YC001', student: 'Nguyễn Văn An', code: 'SV001', room: 'A101', type: 'Gia hạn hợp đồng', date: '2026-09-27T08:30:00', content: 'Xin gia hạn hợp đồng HD001 thêm 6 tháng, từ 01/10/2026 đến 31/03/2027.', status: pending },
        { id: 'YC002', student: 'Trần Thị Mai', code: 'SV002', room: 'B203', type: 'Báo hỏng thiết bị', date: '2026-09-26T14:15:00', content: 'Quạt trần phát tiếng kêu lớn và không điều chỉnh được tốc độ. Nhờ ban quản lý kiểm tra.', status: pending },
        { id: 'YC003', student: 'Lê Minh Quân', code: 'SV003', room: 'A102', type: 'Yêu cầu khác', date: '2026-09-25T09:00:00', content: 'Xin phép tạm vắng từ 01/10 đến 03/10/2026 để về thăm gia đình.', status: pending },
        { id: 'YC004', student: 'Phạm Ngọc Linh', code: 'SV004', room: 'B201', type: 'Báo hỏng thiết bị', date: '2026-09-24T10:00:00', content: 'Vòi nước trong phòng bị rò rỉ.', status: approved, reviewer: 'Quản trị viên (mẫu)', reviewedAt: '2026-09-24T15:00:00', note: 'Đã chuyển bộ phận kỹ thuật kiểm tra.' },
        { id: 'YC005', student: 'Hoàng Đức Nam', code: 'SV005', room: 'A301', type: 'Gia hạn hợp đồng', date: '2026-09-23T11:20:00', content: 'Xin gia hạn thêm một học kỳ.', status: rejected, reviewer: 'Quản trị viên (mẫu)', reviewedAt: '2026-09-23T16:00:00', note: 'Vui lòng bổ sung giấy xác nhận sinh viên.' }
    ];
    const payments = [
        { id: 'GD001', invoice: 'HD092601', student: 'Nguyễn Văn An', code: 'SV001', room: 'A101', amount: 1650000, method: 'Chuyển khoản', reference: 'VCB260925001', date: '2026-09-25T09:30:00', status: 'Đã xác nhận', reviewer: 'Nguyễn Thị Hương (mẫu)', reviewedAt: '2026-09-25T10:00:00', note: 'Đã đối chiếu số tiền và nội dung chuyển khoản.' },
        { id: 'GD002', invoice: 'HD092602', student: 'Trần Thị Mai', code: 'SV002', room: 'B203', amount: 1580000, method: 'Ví điện tử', reference: 'MOMO260924002', date: '2026-09-24T14:00:00', status: 'Đã xác nhận', reviewer: 'Quản trị viên (mẫu)', reviewedAt: '2026-09-24T14:30:00', note: 'Thanh toán đủ tiền phòng và điện nước.' },
        { id: 'GD003', invoice: 'HD092603', student: 'Lê Minh Quân', code: 'SV003', room: 'A102', amount: 1500000, method: 'Chuyển khoản', reference: 'BIDV260923003', date: '2026-09-23T08:00:00', status: rejected, reviewer: 'Quản trị viên (mẫu)', reviewedAt: '2026-09-23T09:00:00', note: 'Chưa tìm thấy giao dịch tương ứng trong sao kê.' }
    ];
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    const dateText = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
    const money = value => value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    const badge = status => `<span class="dk-badge ${status === pending ? 'dk-pending' : status === rejected ? 'dk-rejected' : 'dk-approved'}">${escape(status)}</span>`;
    let decisions = {};
    let tab = 'requests';
    let page = 1;
    let root;
    const pageSize = 6;
    const requestRows = () => requests.map(row => ({ ...row, ...decisions[row.id] }));

    window.renderDuyetKiemSoatModule = function () {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
            decisions = {};
            requests.forEach(row => {
                const item = saved?.[row.id];
                if (row.status === pending && item && [approved, rejected].includes(item.status) &&
                    ['note', 'reviewer', 'reviewedAt'].every(key => typeof item[key] === 'string')) {
                    decisions[row.id] = { status: item.status, note: item.note, reviewer: item.reviewer, reviewedAt: item.reviewedAt };
                }
            });
        } catch { decisions = {}; }
        tab = 'requests';
        page = 1;
        document.getElementById('main-content').innerHTML = `
            <section class="dk-module">
                <h2 class="text-3xl font-bold text-slate-900">Duyệt &amp; Kiểm soát</h2>
                <p class="text-slate-500 mt-2">Tiếp nhận yêu cầu sinh viên và tra cứu lịch sử xác nhận thanh toán online.</p>
                <p class="dk-demo"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Chế độ mẫu — thao tác chỉ lưu trên trình duyệt này, chưa kết nối dữ liệu thật.</p>
                <div id="dk-stats" class="dk-stats"></div>
                <div class="dk-panel">
                    <div class="dk-tabs" aria-label="Chọn danh sách">
                        <button type="button" data-tab="requests">Yêu cầu sinh viên</button>
                        <button type="button" data-tab="payments">Lịch sử thanh toán online</button>
                    </div>
                    <form id="dk-filters" class="dk-filters" role="search">
                        <label class="dk-search">Tìm kiếm<input id="dk-search" type="search" placeholder="Mã, tên sinh viên, phòng..." maxlength="100"></label>
                        <label>Loại yêu cầu / phương thức<select id="dk-type"></select></label>
                        <label>Trạng thái<select id="dk-status"></select></label>
                        <label>Từ ngày<input id="dk-from" type="date"></label>
                        <label>Đến ngày<input id="dk-to" type="date"></label>
                        <button type="button" id="dk-reset" class="dk-button">Đặt lại</button>
                    </form>
                    <p id="dk-date-error" class="text-red-600 px-5" role="alert"></p>
                    <div class="dk-table-wrap"><table class="dk-table"><thead id="dk-head"></thead><tbody id="dk-body"></tbody></table></div>
                    <footer class="dk-footer"><span id="dk-count" role="status"></span><div class="flex items-center gap-3"><button id="dk-prev" class="dk-button" aria-label="Trang trước">‹</button><span id="dk-page"></span><button id="dk-next" class="dk-button" aria-label="Trang sau">›</button></div></footer>
                </div>
                <section id="dk-student-payments" aria-label="Thanh toán Student demo"></section>
                <dialog id="dk-dialog" class="dk-dialog" aria-labelledby="dk-dialog-title"></dialog>
            </section>`;
        root = document.querySelector('.dk-module');
        window.mountThanhToanDemo(root.querySelector('#dk-student-payments'));
        root.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
            tab = button.dataset.tab;
            configureFilters();
        }));
        root.querySelector('#dk-filters').addEventListener('submit', event => event.preventDefault());
        root.querySelector('#dk-filters').addEventListener('input', () => { page = 1; renderRows(); });
        root.querySelector('#dk-reset').addEventListener('click', configureFilters);
        root.querySelector('#dk-prev').addEventListener('click', () => { page--; renderRows(); });
        root.querySelector('#dk-next').addEventListener('click', () => { page++; renderRows(); });
        root.querySelector('#dk-body').addEventListener('click', event => {
            const button = event.target.closest('[data-detail]');
            if (button) openDetail(button.dataset.detail);
        });
        configureFilters();
    };

    function configureFilters() {
        root.querySelector('#dk-filters').reset();
        const isRequest = tab === 'requests';
        const options = list => '<option value="">Tất cả</option>' + list.map(value => `<option>${escape(value)}</option>`).join('');
        root.querySelector('#dk-type').innerHTML = options(isRequest ? ['Gia hạn hợp đồng', 'Báo hỏng thiết bị', 'Yêu cầu khác'] : ['Chuyển khoản', 'Ví điện tử']);
        root.querySelector('#dk-status').innerHTML = options(isRequest ? [pending, approved, rejected] : ['Đã xác nhận', rejected]);
        root.querySelectorAll('[data-tab]').forEach(button => {
            button.classList.toggle('dk-active', button.dataset.tab === tab);
            button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
        });
        page = 1;
        renderRows();
    }

    function renderRows() {
        const allRequests = requestRows();
        const stats = [['Chờ duyệt', allRequests.filter(r => r.status === pending).length], ['Đã duyệt', allRequests.filter(r => r.status === approved).length], ['Từ chối yêu cầu', allRequests.filter(r => r.status === rejected).length], ['Thanh toán đã xác nhận', payments.filter(r => r.status === 'Đã xác nhận').length]];
        root.querySelector('#dk-stats').innerHTML = stats.map(([label, count]) => `<div class="dk-stat"><p>${label}</p><strong>${count}</strong></div>`).join('');
        const value = id => root.querySelector(`#dk-${id}`).value;
        const keyword = fold(value('search').trim());
        const from = value('from');
        const to = value('to');
        const invalidDates = from && to && from > to;
        root.querySelector('#dk-date-error').textContent = invalidDates ? 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.' : '';
        const isRequest = tab === 'requests';
        const rows = (isRequest ? allRequests : payments).filter(row => {
            const day = (isRequest ? row.date : row.reviewedAt).slice(0, 10);
            return !invalidDates && (!keyword || fold([row.id, row.student, row.code, row.room, row.invoice || '', row.reference || ''].join(' ')).includes(keyword)) &&
                (!value('type') || (isRequest ? row.type : row.method) === value('type')) &&
                (!value('status') || row.status === value('status')) && (!from || day >= from) && (!to || day <= to);
        }).sort((a, b) => (isRequest ? b.date : b.reviewedAt).localeCompare(isRequest ? a.date : a.reviewedAt));
        const pages = Math.max(1, Math.ceil(rows.length / pageSize));
        page = Math.min(Math.max(page, 1), pages);
        const headers = isRequest ? ['Mã yêu cầu', 'Sinh viên', 'Phòng', 'Loại yêu cầu', 'Ngày gửi', 'Trạng thái', 'Thao tác'] : ['Giao dịch / Hóa đơn', 'Sinh viên', 'Số tiền', 'Phương thức', 'Xác nhận lúc / Người xử lý', 'Kết quả', 'Thao tác'];
        root.querySelector('#dk-head').innerHTML = `<tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr>`;
        root.querySelector('#dk-body').innerHTML = rows.slice((page - 1) * pageSize, page * pageSize).map(row => `<tr>
            <td><strong>${escape(row.id)}</strong>${!isRequest ? `<small>${escape(row.invoice)}</small>` : ''}</td>
            <td><strong>${escape(row.student)}</strong><small>${escape(row.code)}</small></td>
            ${isRequest ? `<td>${escape(row.room)}</td><td>${escape(row.type)}</td><td>${dateText(row.date)}</td>` : `<td class="whitespace-nowrap font-semibold">${money(row.amount)}</td><td>${escape(row.method)}</td><td>${dateText(row.reviewedAt)}<small>${escape(row.reviewer)}</small></td>`}
            <td>${badge(row.status)}</td><td><button type="button" class="dk-button" data-detail="${escape(row.id)}">${isRequest && row.status === pending ? 'Xử lý' : 'Chi tiết'}</button></td>
        </tr>`).join('') || '<tr><td colspan="7" class="dk-empty">Không có kết quả phù hợp. Hãy thử thay đổi bộ lọc.</td></tr>';
        root.querySelector('#dk-count').textContent = `Hiển thị ${rows.length ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, rows.length)} / ${rows.length} kết quả`;
        root.querySelector('#dk-page').textContent = `${page} / ${pages}`;
        root.querySelector('#dk-prev').disabled = page <= 1;
        root.querySelector('#dk-next').disabled = page >= pages;
    }

    function openDetail(id) {
        const isRequest = tab === 'requests';
        const row = (isRequest ? requestRows() : payments).find(item => item.id === id);
        if (!row) return;
        const dialog = root.querySelector('#dk-dialog');
        const field = (label, content) => `<div><dt>${label}</dt><dd>${escape(content)}</dd></div>`;
        dialog.innerHTML = `<div class="dk-dialog-heading"><h3 id="dk-dialog-title">${isRequest ? 'Chi tiết yêu cầu' : 'Chi tiết xác nhận thanh toán'}</h3><button type="button" class="dk-button" data-close aria-label="Đóng chi tiết">×</button></div>
            <div class="dk-dialog-content">${badge(row.status)}<dl class="dk-details">
                ${field('Mã', row.id)}${field('Sinh viên', `${row.student} (${row.code})`)}${field('Phòng', row.room)}${field('Ngày gửi', dateText(row.date))}
                ${isRequest ? field('Loại yêu cầu', row.type) : field('Hóa đơn', row.invoice) + field('Số tiền', money(row.amount)) + field('Phương thức', row.method) + field('Mã tham chiếu', row.reference)}
                ${row.reviewedAt ? field('Người xử lý', row.reviewer) + field('Thời gian xử lý', dateText(row.reviewedAt)) : ''}
            </dl>${isRequest ? `<h4 class="font-semibold mt-4">Nội dung yêu cầu</h4><p class="dk-description">${escape(row.content)}</p>` : ''}
            ${row.note ? `<h4 class="font-semibold mt-4">Ghi chú / Lý do</h4><p class="dk-description">${escape(row.note)}</p>` : ''}
            ${isRequest && row.status === pending ? `<form id="dk-decision"><label for="dk-note" class="block font-semibold mt-4">Ghi chú xử lý <span class="font-normal text-slate-500">(bắt buộc khi từ chối)</span></label><textarea id="dk-note" rows="3" maxlength="1000" placeholder="Nhập phản hồi cho sinh viên..."></textarea><p id="dk-error" role="alert" class="text-red-600"></p><div class="dk-dialog-actions"><button type="button" class="dk-button" data-close>Đóng</button><button type="submit" value="reject" class="dk-button dk-danger">Từ chối yêu cầu</button><button type="submit" value="approve" class="dk-button dk-primary">Duyệt yêu cầu</button></div></form>` : '<div class="dk-dialog-actions"><button type="button" class="dk-button" data-close>Đóng</button></div>'}
            </div>`;
        dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
        dialog.querySelector('#dk-decision')?.addEventListener('submit', event => {
            event.preventDefault();
            if (!event.submitter || requestRows().find(item => item.id === id)?.status !== pending) return;
            const status = event.submitter.value === 'approve' ? approved : rejected;
            const note = dialog.querySelector('#dk-note').value.trim();
            if (status === rejected && !note) {
                dialog.querySelector('#dk-error').textContent = 'Vui lòng nhập lý do từ chối để sinh viên biết cần bổ sung gì.';
                dialog.querySelector('#dk-note').focus();
                return;
            }
            const next = { ...decisions, [id]: { status, note, reviewer: window.currentUser?.TenHienThi || 'Quản trị viên (mẫu)', reviewedAt: new Date().toISOString() } };
            try { localStorage.setItem(storageKey, JSON.stringify(next)); }
            catch {
                dialog.querySelector('#dk-error').textContent = 'Không thể lưu trên trình duyệt. Hãy kiểm tra quyền lưu trữ rồi thử lại.';
                return;
            }
            decisions = next;
            dialog.close();
            renderRows();
            showToast(`${status} yêu cầu ${id} (dữ liệu mẫu).`);
        });
        dialog.showModal();
    }
})();
