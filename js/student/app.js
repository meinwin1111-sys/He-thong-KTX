(() => {
    if (!window.StudentAuth?.session()) {
        window.location.replace('Admin.html');
        return;
    }
    const ui = StudentUI;
    const data = ui.repository.data;
    const backendStudent = StudentAuth.session().isBackend;
    const { esc, money, date, total, fields } = ui.helpers;
    const main = document.getElementById('student-page');
    const dialog = document.getElementById('student-dialog');
    let signedOut = false;
    let toastTimer;
    let paymentPollTimer;
    let paymentPollStartedAt;
    document.getElementById('student-name').textContent = data.profile.name;
    const studentSession = StudentAuth.session();
    document.getElementById('student-session-label').textContent = studentSession.isBackend
        ? 'Sinh viên · Đăng nhập máy chủ'
        : 'Sinh viên · Demo';
    if (studentSession.isBackend) {
        document.getElementById('student-demo-notice').hidden = true;
    }
    const account = document.getElementById('student-account');
    const accountToggle = document.getElementById('student-account-toggle');
    const accountPanel = document.getElementById('student-account-panel');
    function closeAccount() {
        accountPanel.hidden = true;
        accountToggle.setAttribute('aria-expanded', 'false');
    }
    accountToggle.addEventListener('click', () => {
        accountPanel.hidden = !accountPanel.hidden;
        accountToggle.setAttribute('aria-expanded', String(!accountPanel.hidden));
    });
    accountPanel.addEventListener('click', event => {
        if (event.target.closest('a, button')) {
            closeAccount();
            accountToggle.focus();
        }
    });
    document.addEventListener('click', event => {
        if (!account.contains(event.target)) closeAccount();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dialog.open) {
            event.preventDefault();
            dialog.close();
            return;
        }
        if (event.key === 'Escape' && !accountPanel.hidden) {
            closeAccount();
            accountToggle.focus();
        }
    }, true);
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        dialog.close();
    });
    dialog.addEventListener('close', () => {
        clearTimeout(paymentPollTimer);
        paymentPollTimer = undefined;
        paymentPollStartedAt = undefined;
    });
    account.addEventListener('focusout', event => {
        if (!account.contains(event.relatedTarget)) closeAccount();
    });
    function toast(message) {
        const node = document.getElementById('student-toast');
        clearTimeout(toastTimer);
        node.textContent = message;
        toastTimer = setTimeout(() => { node.textContent = ''; }, 5000);
    }
    window.addEventListener('api:unauthorized', event => {
        if (event.detail?.role !== 'Sinh viên') return;
        toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        window.setTimeout(() => window.location.replace('Admin.html'), 1200);
    });
    function paint() {
        const key = ui.routeFromHash(location.hash);
        const page = ui.pages[key];
        document.querySelectorAll('#main-nav a').forEach(link => {
            const active = link.hash === `#${key}`;
            link.classList.toggle('nav-active', active);
            if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
        });
        main.innerHTML = `<h1 tabindex="-1">${esc(page.title)}</h1>${page.render()}`;
        if (!backendStudent) ui.billing.afterRender?.(main);
        if (key === 'home') {
            ui.pages.home.load?.(main);
            ui.loadStudentDashboardData?.(main, backendStudent);
        }
        if (backendStudent || key === 'requests') page.load?.(main);
        document.title = `${page.title} - Sinh viên`;
    }
    function render() {
        if (signedOut) return;
        if (!backendStudent) ui.billing.sync();
        closeAccount();
        dialog.close();
        paint();
    }
    function modal(title, content) {
        dialog.classList.remove('st-logout-dialog');
        dialog.removeAttribute('aria-describedby');
        dialog.innerHTML = `<div class="st-modal-heading"><h2 id="student-dialog-title">${title}</h2><button class="st-button" data-action="close" aria-label="Đóng" autofocus>×</button></div><div class="st-modal-content">${content}</div>`;
        dialog.showModal();
    }
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'invoice') event.stopPropagation();
        if (action === 'close') { dialog.close(); return; }
        if (action === 'request-detail') {
            modal('Chi tiết yêu cầu', ui.pages.requests.detail(button.dataset.id) +
                '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
            return;
        }
        if (action === 'resume') {
            signedOut = false;
            document.querySelector('header').style.display = '';
            document.getElementById('main-nav').style.display = '';
            render();
            return;
        }
        if (signedOut) return;
        if (action === 'contract-detail') {
            modal('Chi tiết hợp đồng lưu trú', ui.contractDetails() + '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
        } else if (action === 'logout') {
            dialog.classList.add('st-logout-dialog');
            dialog.setAttribute('aria-describedby', 'student-logout-description');
            dialog.innerHTML = '<h2 id="student-dialog-title">Xác nhận đăng xuất</h2><p id="student-logout-description">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?</p><div class="st-logout-actions"><button type="button" class="st-button st-logout-cancel" data-action="close" autofocus>Hủy</button><button type="button" class="st-button st-logout-confirm" data-action="confirm-logout">Đăng xuất</button></div>';
            dialog.showModal();
        } else if (action === 'confirm-logout') {
            try { StudentAuth.logout(); }
            catch { toast('Không thể xóa phiên và dữ liệu của tài khoản. Hãy kiểm tra quyền lưu trữ trình duyệt.'); return; }
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
            window.location.replace('Admin.html');
        } else if (action === 'backend-invoice-pay' && backendStudent) {
            const invoice = button.closest('.st-invoice');
            const method = invoice?.querySelector('[data-payment-method]')?.value;
            if (method === 'CASH') {
                const contact = ui.backendPayments.getOfficeContact();
                const officeHours = contact.GioLamViec || 'liên hệ Ban quản lý KTX';
                const officePhone = contact.DienThoai || 'liên hệ Ban quản lý KTX';
                const balance = Number(button.dataset.max);
                modal('Nộp tiền mặt tại văn phòng',
                    `<p>Vui lòng đến văn phòng Ban quản lý KTX gặp Quản lý, giờ làm việc ${esc(officeHours)}, SĐT ${esc(officePhone)}, mang mã hóa đơn ${esc(button.dataset.id)}, số tiền ${money(balance)}.</p>` +
                    '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
            } else if (method === 'ONLINE') {
                await openBackendPaymentQr(button);
            } else {
                toast('Vui lòng chọn phương thức thanh toán hợp lệ.');
            }
        } else if (action === 'backend-payment-qr' && backendStudent) {
            await openBackendPaymentQr(button);
        } else if (action === 'backend-payment-demo-confirm' && backendStudent) {
            await confirmBackendDemoPayment(button.dataset.id, button.dataset.transactionId, button);
        } else if (action === 'backend-payment-detail' && backendStudent) {
            await showBackendPaymentDetail(button.dataset.id, button.dataset.transactionId);
        } else if (action === 'backend-receipts' && backendStudent) {
            await showBackendReceipts(button.dataset.id);
        } else if (action === 'backend-receipt-print' && backendStudent) {
            await showBackendReceipt(button.dataset.id, button.dataset.receiptId);
        } else if (action === 'print-student-receipt' && backendStudent) {
            const cleanup = () => document.body.classList.remove('student-printing');
            window.addEventListener('afterprint', cleanup, { once: true });
            document.body.classList.add('student-printing');
            window.print();
        } else if (['invoice', 'payment', 'online-step', 'confirm-online'].includes(action)) {
            handleStudentPayment(action, button.dataset.id);
        }
    });
    main.addEventListener('change', event => {
        ui.billing.handleChange?.(event);
    });
    async function backendInvoiceDetail(invoiceId) {
        const response = await window.ApiClient.fetch(`/api/HoaDon/${encodeURIComponent(invoiceId)}`);
        const detail = await response.json();
        if (!response.ok) throw new Error(detail.message || 'Không thể tải chi tiết hóa đơn.');
        if (detail.MaHoaDon !== invoiceId || !Array.isArray(detail.PhieuThu)) {
            throw new Error('Dữ liệu phiếu thu không hợp lệ.');
        }
        return detail;
    }
    async function showBackendPaymentDetail(invoiceId, transactionId) {
        try {
            const response = await window.ApiClient.fetch(
                `/api/payments/history?MaHoaDon=${encodeURIComponent(invoiceId)}`
            );
            const history = await response.json();
            if (!response.ok) throw new Error(history.message || 'Không thể tải chi tiết giao dịch.');
            if (!Array.isArray(history)) throw new Error('Dữ liệu lịch sử thanh toán không hợp lệ.');
            const payment = history.find(item => item.MaGiaoDich === transactionId);
            if (!payment) throw new Error('Không tìm thấy giao dịch trong lịch sử thanh toán.');
            const requested = Number(payment.SoTienYeuCau ?? payment.SoTien);
            const actual = payment.SoTienThucNhan == null ? null : Number(payment.SoTienThucNhan);
            let difference = 'Chưa có';
            if (actual !== null && Number.isFinite(actual) && Number.isFinite(requested)) {
                const delta = actual - requested;
                difference = delta < 0 ? `Thiếu ${money(Math.abs(delta))}`
                    : delta > 0 ? `Dư ${money(delta)}` : 'Không chênh lệch';
            }
            const paymentTime = payment.NgayThanhToan || payment.NgayTao;
            const formattedTime = window.AdminWorkflowUtils?.dateTime(String(paymentTime || ''));
            modal('Chi tiết giao dịch', fields([
                ['Mã giao dịch', payment.MaGiaoDich],
                ['Hóa đơn / phòng', `${payment.MaHoaDon || invoiceId} · ${payment.TenPhong || 'Chưa có'}`],
                ['Người nộp', payment.HoTen || 'Chưa có'],
                ['Số tiền yêu cầu', money(requested)],
                ['Số tiền thực nhận', actual === null ? 'Chưa có' : money(actual)],
                ['Chênh lệch', difference],
                ['Phương thức', ui.helpers.paymentMethodLabel(payment.PhuongThuc) || 'Chưa xác định'],
                ['Thời điểm', formattedTime || date(paymentTime) || 'Chưa có'],
                ['Trạng thái', ui.backendPayments.statusLabel(payment.TrangThai)]
            ]) + '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
        } catch (error) {
            toast(error.message || 'Không thể tải chi tiết giao dịch.');
        }
    }
    async function showBackendReceipts(invoiceId) {
        try {
            const invoice = await backendInvoiceDetail(invoiceId);
            const receipts = invoice.PhieuThu;
            const rows = receipts.length
                ? receipts.map(receipt => `<tr>
                    <td>${esc(receipt.MaPhieuThu ?? 'Chưa có')}</td>
                    <td>${money(receipt.SoTien)}</td>
                    <td>${esc(date(receipt.NgayThu))}</td>
                    <td>${esc(ui.helpers.paymentMethodLabel(receipt.PhuongThuc))}</td>
                    <td>${esc(receipt.TrangThai || 'Chưa có')}</td>
                    <td>${receipt.TrangThai === 'Hợp lệ'
                        ? `<button type="button" class="st-button" data-action="backend-receipt-print"
                            data-id="${esc(invoiceId)}" data-receipt-id="${esc(receipt.MaPhieuThu)}">Xem/In</button>`
                        : 'Chưa có'}</td>
                </tr>`).join('')
                : '';
            const content = receipts.length
                ? ui.helpers.table(['Mã phiếu', 'Số tiền', 'Ngày thu', 'Phương thức', 'Trạng thái', 'Thao tác'], rows)
                : '<p class="st-empty-state" role="status">Hóa đơn chưa có phiếu thu.</p>';
            modal(`Phiếu thu · ${esc(invoiceId)}`, content +
                '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
        } catch (error) {
            toast(error.message || 'Không thể tải phiếu thu.');
        }
    }
    async function showBackendReceipt(invoiceId, receiptId) {
        try {
            const invoice = await backendInvoiceDetail(invoiceId);
            const receipt = invoice.PhieuThu.find(item => String(item.MaPhieuThu) === String(receiptId));
            if (!receipt) throw new Error('Không tìm thấy phiếu thu của hóa đơn này.');
            modal(`Phiếu thu · ${esc(receipt.MaPhieuThu)}`,
                ui.backendPayments.receiptMarkup(receipt) +
                '<div class="st-actions student-receipt-actions"><button type="button" class="st-button" data-action="close">Đóng</button><button type="button" class="st-button st-primary" data-action="print-student-receipt">In phiếu</button></div>');
        } catch (error) {
            toast(error.message || 'Không thể tải phiếu thu.');
        }
    }
    async function handleStudentPayment(action, id) {
        ui.billing.sync();
        if (action === 'invoice') {
            const invoice = data.invoices.find(i => i.id === id);
            if (!invoice) return;
            modal('Chi tiết hóa đơn', ui.billing.detail(invoice) + '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
            return;
        }
        const selection = ui.billing.currentSelection();
        if (!selection.length) { toast('Chưa chọn hạng mục thanh toán.'); return; }
        const payButton = (actionName, title) => `<button type="button" class="st-button st-primary" data-action="${actionName}">${title}</button>`;
        if (action === 'payment' || action === 'online-step') {
            try {
                const content = await ui.billing.qrModal(selection);
                modal('Thanh toán bằng QR', content + '<div class="st-actions"><button type="button" class="st-button" data-action="close">Đóng</button>' + payButton('confirm-online', 'DEMO · Giả lập thanh toán thành công') + '</div>');
            } catch (error) { toast(error.message); }
        } else {
            try {
                const totals = selection.reduce((sum, group) => {
                    const invoice = data.invoices.find(entry => entry.id === group.invoiceId);
                    return sum + group.itemIds.reduce((itemSum, itemId) => itemSum + Number(invoice?.items?.find(item => item.id === itemId)?.amount || 0), 0);
                }, 0);
                const count = selection.reduce((sum, group) => sum + group.itemIds.length, 0);
                if (!window.confirm(`Mô phỏng cổng thanh toán trả kết quả SUCCESS cho ${count} hạng mục (${money(totals)})?`)) return;
                const result = await ui.billing.pay(selection, 'ONLINE');
                dialog.close();
                render();
                modal('Thanh toán thành công', ui.billing.receipt(result) + '<div class="st-dialog-close"><button class="st-button" data-action="close">Đóng</button></div>');
            } catch (error) { toast(error.message); }
        }
    }
    async function openBackendPaymentQr(button) {
        if (button.disabled) return;
        const invoiceId = button.dataset.id;
        let amount;
        try {
            amount = ui.backendPayments.parseAmount(button.dataset.max, Number(button.dataset.max));
        } catch (error) {
            toast(error.message);
            return;
        }
        button.disabled = true;
        try {
            const createResponse = await window.ApiClient.fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ MaHoaDon: invoiceId, PhuongThuc: 'ONLINE', SoTien: amount })
            });
            const request = await createResponse.json();
            if (!createResponse.ok) throw new Error(request.message || 'Không thể tạo yêu cầu thanh toán.');
            const response = await window.ApiClient.fetch(`/api/payments/qr?MaHoaDon=${encodeURIComponent(invoiceId)}&SoTien=${amount}`);
            const payment = await response.json();
            if (!response.ok) throw new Error(payment.message || 'Không thể tạo mã QR.');
            if (Math.round(Number(payment.TongTien) * 100)
                !== Math.round(Number(request.SoTien ?? request.TongTien) * 100)
                || Math.round(Number(payment.TongTien) * 100) !== Math.round(amount * 100)) {
                throw new Error('Số tiền hóa đơn đã thay đổi. Đóng cửa sổ và tải lại hóa đơn trước khi chuyển khoản.');
            }
            if (payment.MaGiaoDich !== request.MaGiaoDich || payment.NoiDungCK !== request.NoiDungCK) {
                throw new Error('Mã nội dung QR không khớp với yêu cầu thanh toán vừa tạo.');
            }
            const confirmButton = payment.DemoPaymentEnabled === true
                ? `<button type="button" class="st-button st-primary" data-action="backend-payment-demo-confirm"
                        data-id="${esc(invoiceId)}" data-transaction-id="${esc(request.MaGiaoDich)}">Giả lập: đã chuyển khoản thành công (demo)</button>`
                : '<span class="st-button st-payment-dialog-status" role="status" data-payment-status>Đang xử lý</span>';
            modal('Chuyển khoản QR', ui.backendPayments.qrModal(payment) +
                `<div class="st-actions st-payment-dialog-actions"><button type="button" class="st-button" data-action="close">Đóng</button>${confirmButton}</div>`);
            if (payment.DemoPaymentEnabled !== true) startBackendPaymentPolling(invoiceId, request.MaGiaoDich);
        } catch (error) {
            toast(error.message || 'Không thể tạo QR chuyển khoản.');
        } finally {
            button.disabled = false;
        }
    }
    async function confirmBackendDemoPayment(invoiceId, transactionId, button) {
        if (!invoiceId || !transactionId || button.disabled) return;
        button.disabled = true;
        try {
            const response = await window.ApiClient.fetch('/api/payments/demo-confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ MaHoaDon: invoiceId, MaGiaoDich: transactionId })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Không thể xác nhận thanh toán.');
            dialog.close();
            render();
            toast('Thanh toán thành công');
        } catch (error) {
            dialog.close();
            modal('Không thể xác nhận thanh toán',
                `<p role="alert">${esc(error.message || 'Không thể xác nhận thanh toán.')}</p><div class="st-dialog-close"><button class="st-button" data-action="close">Đóng</button></div>`);
        } finally {
            button.disabled = false;
        }
    }
    function startBackendPaymentPolling(invoiceId, transactionId) {
        clearTimeout(paymentPollTimer);
        paymentPollStartedAt = Date.now();
        const poll = async () => {
            if (!dialog.open || !paymentPollStartedAt) return;
            if (Date.now() - paymentPollStartedAt >= 10 * 60 * 1000) {
                const status = dialog.querySelector('[data-payment-status]');
                if (status) status.textContent = 'Chưa nhận được kết quả sau 10 phút. Trạng thái: Đang xử lý.';
                clearTimeout(paymentPollTimer);
                paymentPollTimer = undefined;
                paymentPollStartedAt = undefined;
                return;
            }
            try {
                const response = await window.ApiClient.fetch(
                    `/api/payments/history?MaHoaDon=${encodeURIComponent(invoiceId)}`
                );
                const history = await response.json();
                if (!response.ok) throw new Error(history.message || 'Không thể làm mới trạng thái thanh toán.');
                if (!Array.isArray(history)) throw new Error('Dữ liệu lịch sử thanh toán không hợp lệ.');
                const payment = history.find(item => item.MaGiaoDich === transactionId);
                if (!payment) throw new Error('Không tìm thấy giao dịch trong lịch sử thanh toán.');
                const status = dialog.querySelector('[data-payment-status]');
                if (status) status.textContent = ui.backendPayments.statusLabel(payment.TrangThai);
                if (payment.TrangThai === 'SUCCESS') {
                    clearTimeout(paymentPollTimer);
                    paymentPollTimer = undefined;
                    paymentPollStartedAt = undefined;
                    dialog.close();
                    render();
                    toast('Thanh toán thành công');
                    return;
                }
                if (payment.TrangThai !== 'PENDING') {
                    clearTimeout(paymentPollTimer);
                    paymentPollTimer = undefined;
                    paymentPollStartedAt = undefined;
                    return;
                }
            } catch (error) {
                toast(error.message || 'Không thể làm mới trạng thái thanh toán.');
            }
            if (dialog.open && paymentPollStartedAt) {
                paymentPollTimer = setTimeout(poll, 5000);
            }
        };
        paymentPollTimer = setTimeout(poll, 5000);
    }
    main.addEventListener('submit', async event => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        const form = event.target;
        if (form.id === 'student-request-form') {
            const type = form.elements.type.value;
            const content = form.elements.content.value.trim();
            if (!content) {
                form.querySelector('[data-content-error]').textContent = 'Vui lòng nhập nội dung yêu cầu.';
                form.elements.content.focus();
                return;
            }
            if (!ui.requestRules?.isValid(type, content)) {
                form.querySelector('[data-content-error]').textContent = type === 'Trả phòng sớm'
                    ? 'Lý do trả phòng sớm phải từ 10 đến 1.000 ký tự.'
                    : 'Vui lòng chọn loại yêu cầu hợp lệ và nhập nội dung từ 1 đến 1.000 ký tự.';
                return;
            }
            if (backendStudent) {
                const button = form.querySelector('button[type="submit"]');
                if (button.disabled) return;
                button.disabled = true;
                try {
                    const response = await ApiClient.fetch('/api/student/requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            Loai: type,
                            NoiDung: content,
                            ...(ui.requestRules?.dateRequired(type)
                                ? { NgayKetThucDeXuat: form.elements.extensionEndDate.value }
                                : {})
                        })
                    });
                    const result = await response.json();
                    render();
                    toast(result.message || 'Yêu cầu đã được gửi.');
                } catch (error) {
                    button.disabled = false;
                    form.querySelector('[data-form-error]').textContent = error.message || 'Không thể gửi yêu cầu.';
                }
                return;
            }
            form.querySelector('button[type="submit"]').disabled = true;
            ui.repository.addRequest(type, content);
            render();
            toast('Đã thêm yêu cầu demo vào danh sách chờ duyệt.');
        } else if (form.id === 'student-password-form') {
            const { current, password, confirm } = form.elements;
            if (password.value.length < 8 || password.value !== confirm.value) { toast('Mật khẩu mới cần ít nhất 8 ký tự và nhập lại phải khớp.'); confirm.focus(); return; }
            if (current.value === password.value) { toast('Mật khẩu mới phải khác mật khẩu hiện tại.'); password.focus(); return; }
            if (backendStudent) {
                const button = form.querySelector('button[type="submit"]');
                button.disabled = true;
                try {
                    const session = StudentAuth.session();
                    const response = await ApiClient.fetch('/api/change-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            MaTaiKhoan: session.id,
                            MatKhauHienTai: current.value,
                            MatKhauMoi: password.value
                        })
                    });
                    const result = await response.json();
                    form.reset();
                    toast(result.message || 'Đổi mật khẩu thành công.');
                } catch (error) {
                    button.disabled = false;
                    toast(error.message || 'Không thể đổi mật khẩu.');
                }
                return;
            }
            form.reset();
            toast('Thông tin hợp lệ trong bản demo. Mật khẩu thật chưa thay đổi.');
        }
    });
    window.addEventListener('hashchange', render);
    window.addEventListener('storage', event => {
        if (!backendStudent && (event.key === null || event.key.startsWith(KTXPaymentDemo.prefix))) {
            ui.billing.sync();
            if (!dialog.open) paint();
        }
    });
    window.addEventListener('ktx-payment-change', () => {
        if (!backendStudent) { ui.billing.sync(); if (!dialog.open) paint(); }
    });
    window.addEventListener('focus', () => {
        if (!backendStudent) { ui.billing.sync(); if (!dialog.open) paint(); }
    });
    render();
})();
