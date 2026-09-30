// Student billing UI backed by the shared browser demo ledger.
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const store = KTXPaymentDemo;
    const { esc, money, date, fields, card, table } = ui.helpers;
    const labels = { UNPAID: 'Chưa thanh toán', OVERDUE: 'Quá hạn', WAITING_CASH: 'Chờ thanh toán tiền mặt', PAID: 'Đã thanh toán' };
    const method = value => value === 'CASH' ? 'Tiền mặt' : 'Online';
    const time = value => new Date(value).toLocaleString('vi-VN');
    const badge = value => `<span class="st-badge ${value === 'PAID' ? 'st-success' : value === 'WAITING_CASH' ? 'st-warning' : 'st-danger'}">${esc(labels[value])}</span>`;
    let storageError = '';
    function sync() {
        try {
            const saved = store.initialize(data);
            data.invoices = saved.invoices;
            data.payments = saved.payments;
            storageError = '';
        } catch (error) { storageError = `Không thể đọc/lưu dữ liệu thanh toán demo: ${error.message}`; }
    }
    function identity() {
        const code = window.StudentAuth?.session()?.code;
        if (!code || code !== data.profile.code) throw new Error('Phiên sinh viên đã thay đổi. Vui lòng tải lại trang.');
        if (storageError) throw new Error(storageError);
        return code;
    }
    sync();
    ui.billing = {
        sync,
        status: invoice => labels[store.status(invoice)],
        canPay: invoice => ['UNPAID', 'OVERDUE'].includes(store.status(invoice)),
        qrDetails(id) { return store.qrDetails(identity(), id); },
        qrModal(id) {
            const payment = this.qrDetails(id);
            const invoice = data.invoices.find(i => i.id === id);
            if (window.StudentPaymentConfig?.mode !== 'demo') throw new Error('Chưa cấu hình cổng thanh toán ngân hàng thật.');
            if (typeof qrcode !== 'function') throw new Error('Không thể tải bộ tạo QR. Vui lòng tải lại trang.');
            const qr = qrcode(0, 'M');
            const bytes = Array.from(new TextEncoder().encode(JSON.stringify(payment)), byte => String.fromCharCode(byte)).join('');
            qr.addData(bytes, 'Byte');
            qr.make();
            return '<p class="st-demo">DEMO / SANDBOX</p>' +
                `<div class="st-payment-amount">${money(payment.amount)}</div>` +
                fields([['Mã hóa đơn', payment.invoiceId], ['Họ tên', data.profile.name], ['Mã sinh viên', payment.studentId],
                    ['Phòng', data.room.number], ['Tháng hóa đơn', invoice.month], ['Nội dung thanh toán', payment.paymentContent]]) +
                `<figure class="st-payment-qr"><div role="img" aria-label="QR demo cho hóa đơn ${esc(payment.invoiceId)}">${qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true })}</div><figcaption>DEMO / SANDBOX</figcaption></figure>` +
                '<p class="st-notice">QR này dùng để mô phỏng quy trình thanh toán online, không thực hiện giao dịch tiền thật.</p>';
        },
        summary() {
            const unpaid = data.invoices.filter(i => store.status(i) !== 'PAID');
            return { debt: unpaid.reduce((sum, i) => sum + store.amount(i), 0), unpaid: unpaid.length,
                overdue: unpaid.filter(i => new Date(`${i.due}T23:59:59.999`) < new Date()).length };
        },
        async pay(id, paymentMethod) {
            if (!['ONLINE', 'CASH'].includes(paymentMethod)) throw new Error('Phương thức không hợp lệ.');
            const code = identity();
            if (paymentMethod === 'ONLINE' && window.StudentPaymentConfig?.mode !== 'demo') throw new Error('Chỉ hỗ trợ thanh toán DEMO.');
            const result = await (paymentMethod === 'ONLINE' ? store.online(code, id) : store.requestCash(code, id));
            sync();
            return result;
        },
        receipt(payment) {
            return '<p class="st-demo">Biên nhận DEMO / SANDBOX</p>' + fields([
                ['Mã hóa đơn', payment.invoiceId], ['Số tiền', money(payment.amount)], ['Thời gian thanh toán', time(payment.paymentTime)],
                ['Phương thức', payment.paymentMethod === 'ONLINE' ? 'Thanh toán online' : 'Tiền mặt'], ['Mã giao dịch', payment.transactionId]
            ]);
        },
        detail(invoice) {
            return fields([['Mã hóa đơn', invoice.id], ['Tháng', invoice.month], ['Phòng', data.room.number], ['Hạn thanh toán', date(invoice.due)],
                ['Tiền phòng', money(invoice.room)], ['Tiền điện', money(invoice.electricity)], ['Tiền nước', money(invoice.water)],
                ['Tổng cộng', money(store.amount(invoice))], ['Trạng thái', this.status(invoice)],
                ...(invoice.paymentMethod ? [['Phương thức', method(invoice.paymentMethod)], ['Thời gian thanh toán', time(invoice.paymentTime)]] : [])]);
        }
    };
    ui.pages.invoices = { title: 'Hóa đơn & Thanh toán', render: () => {
        sync();
        if (storageError) return `<p class="st-notice" role="alert">${esc(storageError)}</p>`;
        const summary = ui.billing.summary();
        return `<p class="st-demo">DEMO / SANDBOX — không giao dịch tiền thật. Dữ liệu được lưu trên trình duyệt này và dùng chung với màn hình Admin cùng địa chỉ website.</p>
        <div class="st-summary">${[['Tổng số tiền còn nợ', money(summary.debt)], ['Hóa đơn chưa thanh toán', summary.unpaid], ['Hóa đơn quá hạn', summary.overdue]].map(([title, value]) => `<article class="st-card"><span>${title}</span><strong>${value}</strong></article>`).join('')}</div>` +
        card('Hóa đơn hàng tháng', table(['Mã hóa đơn', 'Tháng', 'Tiền phòng', 'Tiền điện', 'Tiền nước', 'Tổng tiền', 'Hạn thanh toán', 'Trạng thái', 'Thao tác'], data.invoices.map(i => `<tr><td>${esc(i.id)}</td><td>${esc(i.month)}</td><td>${money(i.room)}</td><td>${money(i.electricity)}</td><td>${money(i.water)}</td><td><strong>${money(store.amount(i))}</strong></td><td>${date(i.due)}</td><td>${badge(store.status(i))}${store.status(i) === 'WAITING_CASH' ? '<p class="st-muted">Vui lòng đến Ban quản lý KTX để hoàn tất thanh toán.</p>' : i.paymentMethod ? `<p>${method(i.paymentMethod)}</p>` : ''}</td><td><div class="st-actions"><button class="st-button" data-action="invoice" data-id="${esc(i.id)}">Xem chi tiết</button>${ui.billing.canPay(i) ? `<button class="st-button st-primary" data-action="payment" data-id="${esc(i.id)}">Thanh toán</button>` : ''}</div></td></tr>`).join(''))) +
        card('Lịch sử thanh toán', table(['Mã GD', 'Mã HĐ', 'Số tiền', 'Phương thức', 'Thời gian', 'Trạng thái'], data.payments.filter(p => ['SUCCESS', 'Thành công'].includes(p.status)).map(p => `<tr><td>${esc(p.transactionId || p.id)}</td><td>${esc(p.invoiceId)}</td><td>${money(p.amount)}</td><td>${method(p.paymentMethod)}</td><td>${esc(time(p.paymentTime))}</td><td><span class="st-badge st-success">Thành công</span></td></tr>`).join('')));
    } };
})();
