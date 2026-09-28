// Student: HoaDon
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    const status = invoice => invoice.paid ? 'Đã thanh toán' : new Date(`${invoice.due}T23:59:59.999`) < new Date() ? 'Quá hạn' : 'Chưa thanh toán';
    const label = value => `<span class="st-badge ${['Đã thanh toán', 'Thành công'].includes(value) ? 'st-success' : value === 'Quá hạn' ? 'st-danger' : 'st-warning'}">${esc(value)}</span>`;
    ui.billing = {
        status,
        summary() {
            const unpaid = data.invoices.filter(i => !i.paid);
            return { debt: unpaid.reduce((sum, i) => sum + total(i), 0), unpaid: unpaid.length, overdue: unpaid.filter(i => status(i) === 'Quá hạn').length };
        },
        pay(id, method) {
            const invoice = data.invoices.find(i => i.id === id);
            if (!invoice || invoice.paid) throw new Error('Hóa đơn đã thanh toán hoặc không tồn tại.');
            if (!['Tiền mặt', 'Online · Ngân hàng (demo)', 'Online · Ví điện tử (demo)'].includes(method)) throw new Error('Phương thức không hợp lệ.');
            if (method === 'Tiền mặt' && data.payments.some(p => p.invoiceId === id && p.status === 'Chờ xác nhận')) throw new Error('Hóa đơn đã có yêu cầu tiền mặt chờ xác nhận.');
            const now = new Date();
            const day = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            if (method !== 'Tiền mặt') {
                invoice.paid = true;
                data.payments.filter(p => p.invoiceId === id && p.status === 'Chờ xác nhận').forEach(p => { p.status = 'Đã hủy'; });
            }
            data.payments.unshift({ id: `GD${String(data.payments.length + 1).padStart(3, '0')}`, invoiceId: id, date: day, amount: total(invoice), method, status: method === 'Tiền mặt' ? 'Chờ xác nhận' : 'Thành công' });
        },
        detail(invoice) {
            return fields([['Mã hóa đơn', invoice.id], ['Tháng', invoice.month], ['Phòng', data.room.number], ['Hạn thanh toán', date(invoice.due)], ['Tiền phòng', money(invoice.room)], ['Tiền điện', money(invoice.electricity)], ['Tiền nước', money(invoice.water)], ['Tổng cộng', money(total(invoice))], ['Trạng thái', status(invoice)]]);
        }
    };
    ui.pages.invoices = { title: 'Hóa đơn & Thanh toán', render: () => {
        const summary = ui.billing.summary();
        return `<p class="st-demo">Thanh toán mô phỏng, không có giao dịch tiền thật. Dữ liệu thay đổi trong phiên xem này và được khôi phục khi tải lại trang.</p>
        <div class="st-summary">${[['Tổng số tiền còn nợ', money(summary.debt)], ['Hóa đơn chưa thanh toán', summary.unpaid], ['Hóa đơn quá hạn', summary.overdue]].map(([title, value]) => `<article class="st-card"><span>${title}</span><strong>${value}</strong></article>`).join('')}</div>` +
        card('Hóa đơn hàng tháng', table(['Mã hóa đơn', 'Tháng', 'Tiền phòng', 'Tiền điện', 'Tiền nước', 'Tổng tiền', 'Hạn thanh toán', 'Trạng thái', 'Thao tác'], data.invoices.map(i => `<tr><td>${esc(i.id)}</td><td>${esc(i.month)}</td><td>${money(i.room)}</td><td>${money(i.electricity)}</td><td>${money(i.water)}</td><td><strong>${money(total(i))}</strong></td><td>${date(i.due)}</td><td>${label(status(i))}</td><td><div class="st-actions"><button class="st-button" data-action="invoice" data-id="${esc(i.id)}">Xem chi tiết</button>${!i.paid ? `<button class="st-button st-primary" data-action="payment" data-id="${esc(i.id)}">Thanh toán</button>` : ''}</div></td></tr>`).join(''))) +
        card('Lịch sử thanh toán', '<p class="st-muted">Giao dịch tiền mặt chờ xác nhận chỉ là yêu cầu, chưa ghi nhận đã thu tiền. Ngày ở dòng này là ngày gửi yêu cầu.</p>' + table(['Mã giao dịch', 'Mã hóa đơn', 'Ngày thanh toán / yêu cầu', 'Số tiền', 'Phương thức', 'Trạng thái'], data.payments.map(p => `<tr><td>${esc(p.id)}</td><td>${esc(p.invoiceId)}</td><td>${date(p.date)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td>${label(p.status)}</td></tr>`).join('')));
    } };
})();
