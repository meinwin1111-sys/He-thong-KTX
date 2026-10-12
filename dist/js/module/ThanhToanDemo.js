// Shared Student demo payments, separate from Admin invoices backed by the API.
(() => {
    const store = KTXPaymentDemo;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = value => Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    const time = value => new Date(value).toLocaleString('vi-VN');
    const itemsOf = value => (value.items || []).map(item => item.name).filter(Boolean).join(', ') || '—';
    let host;
    let tab = 'cash';
    let message = '';
    let generation = 0;
    async function render() {
        if (!host?.isConnected) return;
        const token = ++generation;
        try {
            const waiting = await store.listCashRequests();
            const history = await store.listHistory();
            if (token !== generation || !host?.isConnected) return;
            const cash = tab === 'cash';
            const headers = cash ? ['Mã hóa đơn', 'Hạng mục', 'Mã sinh viên', 'Họ tên', 'Phòng', 'Số tiền', 'Ngày đăng ký', 'Trạng thái', 'Thao tác'] :
                ['Mã GD', 'Mã HĐ', 'Hạng mục', 'Sinh viên', 'Số tiền', 'Phương thức', 'Thời gian', 'Trạng thái', 'Người xác nhận'];
            const rows = (cash ? waiting : history).map(p => cash ? `<tr>
                <td>${esc(p.invoiceId)}</td><td class="st-long">${esc(itemsOf(p))}</td><td>${esc(p.studentId)}</td><td>${esc(p.studentName)}</td><td>${esc(p.room)}</td>
                <td>${money(p.amount)}</td><td>${esc(time(p.requestedAt))}</td><td><span class="dk-badge dk-pending">Chờ thanh toán tiền mặt</span></td>
                <td class="dk-actions"><button type="button" class="dk-button dk-primary" data-cash-request="${esc(p.id)}" data-student="${esc(p.studentId)}">Xác nhận đã thu tiền</button>
                <button type="button" class="dk-button dk-danger" data-cash-request="${esc(p.id)}" data-student="${esc(p.studentId)}" data-cash-reject="1">Từ chối/Hủy yêu cầu</button></td></tr>` :
                `<tr><td>${esc(p.transactionId || p.id)}</td><td>${esc(p.invoiceId)}</td><td class="st-long">${esc(itemsOf(p))}</td><td>${esc(p.studentName)}<small>${esc(p.studentId)}</small></td>
                <td>${money(p.amount)}</td><td>${p.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Online'}</td><td>${esc(time(p.paymentTime))}</td>
                <td><span class="dk-badge dk-approved">Thành công</span></td><td>${esc(p.confirmedBy?.name || (p.paymentMethod === 'ONLINE' ? 'Online DEMO tự động' : '—'))}</td></tr>`).join('');
            host.innerHTML = `<h3 class="text-xl font-bold mt-6 mb-2">Thanh toán Student · DEMO / SANDBOX</h3>
                <p class="dk-demo">Dùng chung dữ liệu với Student trên cùng trình duyệt và địa chỉ website. Không ghi vào hóa đơn API/database thật. Online thành công được ghi nhận tự động; chỉ tiền mặt cần xác nhận.</p>
                <div class="dk-panel"><div class="dk-tabs"><button type="button" data-demo-tab="cash" aria-pressed="${cash}" class="${cash ? 'dk-active' : ''}">Xác nhận thu tiền mặt (${waiting.length})</button>
                <button type="button" data-demo-tab="history" aria-pressed="${!cash}" class="${!cash ? 'dk-active' : ''}">Lịch sử thanh toán (${history.length})</button></div>
                <p role="status" class="p-4">${esc(message)}</p><div class="dk-table-wrap"><table class="dk-table"><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="9" class="dk-empty">Chưa có giao dịch trong danh sách này.</td></tr>'}</tbody></table></div></div>`;
        } catch (error) { if (token === generation) host.innerHTML = `<p role="alert" class="dk-demo">Không thể đọc dữ liệu thanh toán DEMO: ${esc(error.message)}</p>`; }
    }
    window.mountThanhToanDemo = element => {
        host = element;
        tab = 'cash';
        message = '';
        host.addEventListener('click', async event => {
            const tabButton = event.target.closest('[data-demo-tab]');
            if (tabButton) { tab = tabButton.dataset.demoTab; message = ''; render(); return; }
            const button = event.target.closest('[data-cash-request]');
            if (!button) return;
            try {
                const admin = window.currentUser;
                if (!admin) throw new Error('Vui lòng đăng nhập Admin để xác nhận thu tiền.');
                const { student: code, cashRequest: requestId, cashReject } = button.dataset;
                const waiting = await store.listCashRequests();
                const request = waiting.find(entry => entry.id === requestId && entry.studentId === code);
                if (!request) throw new Error('Yêu cầu không còn chờ thanh toán tiền mặt.');
                if (cashReject) {
                    if (!window.confirm(`Hủy yêu cầu thu tiền mặt ${money(request.amount)} của ${request.studentName}? Các hạng mục sẽ được mở khóa.`)) return;
                    button.disabled = true;
                    await store.rejectCash(code, requestId);
                    message = `Đã hủy yêu cầu ${requestId}. Các hạng mục đã được mở khóa.`;
                } else {
                    if (!window.confirm(`Bạn xác nhận đã nhận ${money(request.amount)} tiền mặt của sinh viên ${request.studentName} cho ${itemsOf(request)}?`)) return;
                    button.disabled = true;
                    const receipt = await store.confirmCash(code, requestId, { id: admin.id || '', name: admin.fullName || admin.username || 'Quản trị viên' });
                    message = `Đã xác nhận thu ${money(receipt.amount)} cho ${receipt.invoiceId}. Biên nhận: ${receipt.transactionId}`;
                }
            } catch (error) { message = error.message; }
            render();
        });
        render();
    };
    window.addEventListener('storage', event => { if (event.key === null || event.key.startsWith(store.prefix)) render(); });
    window.addEventListener('ktx-payment-change', render);
    window.addEventListener('focus', render);
})();
