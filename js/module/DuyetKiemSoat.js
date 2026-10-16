(() => {
    const pending = 'Chờ duyệt';
    const approved = 'Đã duyệt';
    const rejected = 'Từ chối';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    const dateText = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
    const badge = status => {
        const label = String(status || '').trim() || 'Chưa xác định';
        return `<span class="dk-badge ${label === pending ? 'dk-pending' : label === rejected ? 'dk-rejected' : label === 'Chưa xác định' ? '' : 'dk-approved'}">${escape(label)}</span>`;
    };
    let requests = [];
    let page = 1;
    let root;
    const pageSize = 6;
    const requestRows = () => requests.map(row => ({
        id: row.MaYeuCau,
        student: row.HoTen,
        code: row.MaSinhVien,
        room: row.TenPhong || 'Chưa xếp phòng',
        type: row.Loai,
        date: row.NgayTao,
        content: row.NoiDung,
        status: row.TrangThai,
        reviewedAt: row.NgayXuLy,
        reviewer: row.TenNguoiXuLy,
        note: row.PhanHoi,
        extensionEndDate: row.NgayKetThucDeXuat
    }));

    window.renderDuyetKiemSoatModule = function () {
        requests = [];
        page = 1;
        document.getElementById('main-content').innerHTML = `
            <section class="dk-module">
                <h2 class="text-3xl font-bold text-slate-900">Duyệt &amp; Kiểm soát</h2>
                <p class="text-slate-500 mt-2">Tiếp nhận và xử lý yêu cầu sinh viên.</p>
                <p id="dk-load-error" class="text-red-600 mt-2" role="alert"></p>
                <section id="dk-requests-panel" role="tabpanel">
                <div id="dk-stats" class="dk-stats"></div>
                <div class="dk-panel">
                    <form id="dk-filters" class="dk-filters" role="search">
                        <label class="dk-search">Tìm kiếm<input id="dk-search" type="search" placeholder="Mã, tên sinh viên, phòng..." maxlength="100"></label>
                        <label>Loại yêu cầu<select id="dk-type"></select></label>
                        <label>Trạng thái<select id="dk-status"></select></label>
                        <label>Từ ngày<input id="dk-from" type="date"></label>
                        <label>Đến ngày<input id="dk-to" type="date"></label>
                        <button type="button" id="dk-reset" class="dk-button">Đặt lại</button>
                    </form>
                    <p id="dk-date-error" class="text-red-600 px-5" role="alert"></p>
                    <div class="dk-table-wrap"><table class="dk-table"><thead id="dk-head"></thead><tbody id="dk-body"></tbody></table></div>
                    <footer class="dk-footer"><span id="dk-count" role="status"></span><div class="flex items-center gap-3"><button id="dk-prev" class="dk-button" aria-label="Trang trước">‹</button><span id="dk-page"></span><button id="dk-next" class="dk-button" aria-label="Trang sau">›</button></div></footer>
                </div>
                </section>
                <dialog id="dk-dialog" class="dk-dialog" aria-labelledby="dk-dialog-title"></dialog>
            </section>`;
        root = document.querySelector('.dk-module');
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
        loadRequests();
    };

    async function loadRequests() {
        const body = root.querySelector('#dk-body');
        const errorNode = root.querySelector('#dk-load-error');
        body.innerHTML = '<tr><td colspan="7" class="dk-empty" role="status">Đang tải yêu cầu...</td></tr>';
        errorNode.textContent = '';
        try {
            const response = await ApiClient.fetch('/api/requests');
            const result = await response.json();
            if (!Array.isArray(result)) throw new Error('Dữ liệu yêu cầu không hợp lệ.');
            requests = result;
            renderRows();
        } catch (error) {
            body.innerHTML = '<tr><td colspan="7" class="dk-empty">Không thể tải danh sách yêu cầu.</td></tr>';
            errorNode.textContent = error.message || 'Không thể tải danh sách yêu cầu.';
        }
    }

    function configureFilters() {
        root.querySelector('#dk-filters').reset();
        const options = list => '<option value="">Tất cả</option>' + list.map(value => `<option>${escape(value)}</option>`).join('');
        root.querySelector('#dk-type').innerHTML = options(['Gia hạn hợp đồng', 'Báo hỏng thiết bị']);
        root.querySelector('#dk-status').innerHTML = options([pending, approved, rejected]);
        page = 1;
        renderRows();
    }

    function renderRows() {
        const allRequests = requestRows();
        const stats = [['Chờ duyệt', allRequests.filter(r => r.status === pending).length], ['Đã duyệt', allRequests.filter(r => r.status === approved).length], ['Từ chối yêu cầu', allRequests.filter(r => r.status === rejected).length]];
        root.querySelector('#dk-stats').innerHTML = stats.map(([label, count]) => `<div class="dk-stat"><p>${label}</p><strong>${count}</strong></div>`).join('');
        const value = id => root.querySelector(`#dk-${id}`).value;
        const keyword = fold(value('search').trim());
        const from = value('from');
        const to = value('to');
        const invalidDates = from && to && from > to;
        root.querySelector('#dk-date-error').textContent = invalidDates ? 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.' : '';
        const rows = allRequests.filter(row => {
            const day = row.date.slice(0, 10);
            return !invalidDates && (!keyword || fold([row.id, row.student, row.code, row.room].join(' ')).includes(keyword)) &&
                (!value('type') || row.type === value('type')) &&
                (!value('status') || row.status === value('status')) && (!from || day >= from) && (!to || day <= to);
        }).sort((a, b) => b.date.localeCompare(a.date));
        const pages = Math.max(1, Math.ceil(rows.length / pageSize));
        page = Math.min(Math.max(page, 1), pages);
        const headers = ['Mã yêu cầu', 'Sinh viên', 'Phòng', 'Loại yêu cầu', 'Ngày gửi', 'Trạng thái', 'Thao tác'];
        root.querySelector('#dk-head').innerHTML = `<tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr>`;
        root.querySelector('#dk-body').innerHTML = rows.slice((page - 1) * pageSize, page * pageSize).map(row => `<tr>
            <td><strong>${escape(row.id)}</strong></td>
            <td><strong>${escape(row.student)}</strong><small>${escape(row.code)}</small></td>
            <td>${escape(row.room)}</td><td>${escape(row.type)}</td><td>${dateText(row.date)}</td>
            <td>${badge(row.status)}</td><td><button type="button" class="dk-button" data-detail="${escape(row.id)}">${row.status === pending ? 'Xử lý' : 'Chi tiết'}</button></td>
        </tr>`).join('') || '<tr><td colspan="7" class="dk-empty">Không có kết quả phù hợp. Hãy thử thay đổi bộ lọc.</td></tr>';
        root.querySelector('#dk-count').textContent = `Hiển thị ${rows.length ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, rows.length)} / ${rows.length} kết quả`;
        root.querySelector('#dk-page').textContent = `${page} / ${pages}`;
        root.querySelector('#dk-prev').disabled = page <= 1;
        root.querySelector('#dk-next').disabled = page >= pages;
    }

    function openDetail(id) {
        const row = requestRows().find(item => item.id === id);
        if (!row) return;
        const dialog = root.querySelector('#dk-dialog');
        const field = (label, content) => `<div><dt>${label}</dt><dd>${escape(content)}</dd></div>`;
        dialog.innerHTML = `<div class="dk-dialog-heading"><h3 id="dk-dialog-title">Chi tiết yêu cầu</h3><button type="button" class="dk-button" data-close aria-label="Đóng chi tiết">×</button></div>
            <div class="dk-dialog-content">${badge(row.status)}<dl class="dk-details">
                ${field('Mã', row.id)}${field('Sinh viên', `${row.student} (${row.code})`)}${field('Phòng', row.room)}${field('Ngày gửi', dateText(row.date))}
                ${field('Loại yêu cầu', row.type)}${row.extensionEndDate ? field('Ngày kết thúc đề xuất', dateText(row.extensionEndDate)) : ''}
                ${row.reviewedAt ? field('Thời gian xử lý', dateText(row.reviewedAt)) : ''}
                ${row.reviewer ? field('Người xử lý', row.reviewer) : ''}
            </dl><h4 class="font-semibold mt-4">Nội dung yêu cầu</h4><p class="dk-description">${escape(row.content)}</p>
            ${row.note ? `<h4 class="font-semibold mt-4">Ghi chú / Lý do</h4><p class="dk-description">${escape(row.note)}</p>` : ''}
            ${row.status === pending ? `<form id="dk-decision"><label for="dk-note" class="block font-semibold mt-4">Ghi chú xử lý <span class="font-normal text-slate-500">(bắt buộc khi từ chối)</span></label><textarea id="dk-note" rows="3" maxlength="1000" placeholder="Nhập phản hồi cho sinh viên..."></textarea><p id="dk-error" role="alert" class="text-red-600"></p><div class="dk-dialog-actions"><button type="button" class="dk-button" data-close>Đóng</button><button type="submit" value="reject" class="dk-button dk-danger">Từ chối yêu cầu</button><button type="submit" value="approve" class="dk-button dk-primary">Duyệt yêu cầu</button></div></form>` : '<div class="dk-dialog-actions"><button type="button" class="dk-button" data-close>Đóng</button></div>'}
            </div>`;
        dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
        dialog.querySelector('#dk-decision')?.addEventListener('submit', async event => {
            event.preventDefault();
            if (!event.submitter || requestRows().find(item => item.id === id)?.status !== pending) return;
            const status = event.submitter.value === 'approve' ? approved : rejected;
            const note = dialog.querySelector('#dk-note').value.trim();
            if (status === rejected && !note) {
                dialog.querySelector('#dk-error').textContent = 'Vui lòng nhập lý do từ chối để sinh viên biết cần bổ sung gì.';
                dialog.querySelector('#dk-note').focus();
                return;
            }
            const buttons = [...dialog.querySelectorAll('#dk-decision button[type="submit"]')];
            buttons.forEach(button => { button.disabled = true; });
            try {
                await ApiClient.fetch(`/api/requests/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TrangThai: status, PhanHoi: note })
                });
                dialog.close();
                await loadRequests();
                showToast(`${status} yêu cầu ${id}.`);
            } catch (error) {
                dialog.querySelector('#dk-error').textContent = error.message || 'Không thể xử lý yêu cầu.';
                buttons.forEach(button => { button.disabled = false; });
            }
        });
        dialog.showModal();
    }

})();
