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
    async function loadStudentDashboardData(root) {
        const paymentsNode = root.querySelector('[data-student-payment-notices]');
        const rulesNode = root.querySelector('[data-student-rules]');
        const contactNode = root.querySelector('[data-student-contact]');
        if (!backendStudent) {
            paymentsNode.textContent = 'Thông báo thanh toán chỉ khả dụng với tài khoản Sinh viên đã kết nối máy chủ.';
            rulesNode.textContent = 'Nội quy dùng chung chưa khả dụng trong chế độ demo.';
            contactNode.textContent = 'Thông tin liên hệ dùng chung chưa khả dụng trong chế độ demo.';
            return;
        }

        const load = async (url, onData, onError) => {
            try {
                const response = await ApiClient.fetch(url);
                const value = await response.json();
                if (root.isConnected) onData(value);
            } catch (error) {
                if (root.isConnected && error.name !== 'AbortError') onError(error.message || 'Không thể tải dữ liệu.');
            }
        };
        const localDateTime = value => {
            const timestamp = new Date(value);
            return Number.isFinite(timestamp.getTime())
                ? timestamp.toLocaleString('vi-VN')
                : 'Chưa có thời gian';
        };
        load('/api/payments/history', payments => {
            if (!Array.isArray(payments)) throw new Error('Dữ liệu giao dịch không hợp lệ.');
            const successful = payments.filter(payment => payment.TrangThai === 'SUCCESS');
            paymentsNode.innerHTML = successful.length ? successful.map(payment => `
                <li>
                    <span class="sh-news-icon sh-news-0"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></span>
                    <div class="sh-news-content">
                        <h3>Bạn đã thanh toán ${esc(payment.TenKhoan || 'khoản phí')}</h3>
                        <p>Hóa đơn ${esc(payment.MaHoaDon)} · ${money(Number(payment.SoTien || 0))} · ${esc(payment.PhuongThuc === 'ONLINE' ? 'Chuyển khoản' : 'Tiền mặt')}</p>
                        <p>${esc(localDateTime(payment.NgayThanhToan || payment.NgayTao))}</p>
                    </div>
                </li>`).join('') : '<li class="st-muted">Chưa có khoản thanh toán thành công.</li>';
        }, message => { paymentsNode.textContent = message; });
        load('/api/noi-quy', rules => {
            if (!Array.isArray(rules)) throw new Error('Dữ liệu nội quy không hợp lệ.');
            rulesNode.innerHTML = rules.length
                ? rules.map(rule => `<li>${esc(rule.NoiDung)}</li>`).join('')
                : '<li class="st-muted">Hiện chưa có nội quy.</li>';
        }, message => { rulesNode.textContent = message; });
        load('/api/lien-he', contact => {
            contactNode.innerHTML = [
                ['Điện thoại', contact.DienThoai],
                ['Email', contact.Email],
                ['Giờ làm việc', contact.GioLamViec]
            ].map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value || 'Chưa cập nhật')}</dd></div>`).join('');
        }, message => { contactNode.textContent = message; });
    }
    function paint() {
        const key = ui.routeFromHash(location.hash);
        const page = ui.pages[key];
        document.querySelectorAll('#main-nav a').forEach(link => {
            const active = link.hash === `#${key}`;
            link.classList.toggle('nav-active', active);
            if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
        });
        main.innerHTML = `<h1 tabindex="-1">${esc(page.title)}</h1>${page.render()}`;
        const campusBanner = main.querySelector('[data-campus-banner]');
        if (campusBanner) campusBanner.addEventListener('error', () => { campusBanner.hidden = true; }, { once: true });
        if (!backendStudent) ui.billing.afterRender?.(main);
        if (key === 'home') loadStudentDashboardData(main);
        if (backendStudent) page.load?.(main);
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
        } else if (action === 'backend-payment-qr' && backendStudent) {
            await openBackendPaymentQr(button.dataset.id);
        } else if (action === 'backend-payment-cash' && backendStudent) {
            await submitBackendPaymentRequest(button.dataset.id, 'CASH', button);
        } else if (action === 'backend-payment-submit' && backendStudent) {
            await submitBackendPaymentRequest(button.dataset.id, button.dataset.paymentMethod, button);
        } else if (['invoice', 'payment', 'online-step', 'cash-step', 'confirm-online', 'confirm-cash'].includes(action)) {
            handleStudentPayment(action, button.dataset.id);
        }
    });
    main.addEventListener('change', event => ui.billing.handleChange?.(event));
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
        } else if (action === 'cash-step') {
            modal('Thanh toán tại Ban quản lý KTX', ui.billing.cashModal(selection) +
                '<div class="st-actions">' + payButton('confirm-cash', 'Đăng ký thanh toán tiền mặt') + '</div>' +
                '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
        } else {
            try {
                const method = action === 'confirm-cash' ? 'CASH' : 'ONLINE';
                const totals = selection.reduce((sum, group) => {
                    const invoice = data.invoices.find(entry => entry.id === group.invoiceId);
                    return sum + group.itemIds.reduce((itemSum, itemId) => itemSum + Number(invoice?.items?.find(item => item.id === itemId)?.amount || 0), 0);
                }, 0);
                const count = selection.reduce((sum, group) => sum + group.itemIds.length, 0);
                if (!window.confirm(method === 'ONLINE'
                    ? `Mô phỏng cổng thanh toán trả kết quả SUCCESS cho ${count} hạng mục (${money(totals)})?`
                    : `Đăng ký thanh toán tiền mặt cho ${count} hạng mục (${money(totals)})?`)) return;
                const result = await ui.billing.pay(selection, method);
                dialog.close();
                render();
                if (method === 'ONLINE') modal('Thanh toán thành công', ui.billing.receipt(result) + '<div class="st-dialog-close"><button class="st-button" data-action="close">Đóng</button></div>');
                else toast('Chờ thanh toán tiền mặt. Vui lòng đến Ban quản lý KTX để hoàn tất thanh toán. Công nợ chưa thay đổi.');
            } catch (error) { toast(error.message); }
        }
    }
    async function openBackendPaymentQr(invoiceId) {
        try {
            const createResponse = await window.ApiClient.fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ MaHoaDon: invoiceId, PhuongThuc: 'ONLINE' })
            });
            const request = await createResponse.json();
            const response = await window.ApiClient.fetch(`/api/payments/qr?MaHoaDon=${encodeURIComponent(invoiceId)}`);
            const payment = await response.json();
            if (Math.round(Number(payment.TongTien) * 100) !== Math.round(Number(request.TongTien) * 100)) {
                throw new Error('Số tiền hóa đơn đã thay đổi. Đóng cửa sổ và tải lại hóa đơn trước khi chuyển khoản.');
            }
            modal('Chuyển khoản QR', ui.backendPayments.qrModal(payment) +
                `<div class="st-actions"><button type="button" class="st-button" data-action="close">Đóng</button>
                    <button type="button" class="st-button st-primary" data-action="backend-payment-submit"
                        data-payment-method="ONLINE" data-id="${esc(invoiceId)}"
                        data-transaction-id="${esc(request.MaGiaoDich)}">Đã chuyển khoản thành công</button></div>`);
        } catch (error) {
            toast(error.message || 'Không thể tạo QR chuyển khoản.');
        }
    }
    async function submitBackendPaymentRequest(invoiceId, paymentMethod, button) {
        if (!invoiceId || !['ONLINE', 'CASH'].includes(paymentMethod)) return;
        button.disabled = true;
        try {
            if (paymentMethod === 'ONLINE') {
                const transactionId = button.dataset.transactionId;
                const response = await window.ApiClient.fetch(`/api/payments/history?MaHoaDon=${encodeURIComponent(invoiceId)}`);
                const history = await response.json();
                const transaction = history.find(payment => payment.MaGiaoDich === transactionId);
                if (!transaction) throw new Error('Không tìm thấy yêu cầu chuyển khoản. Hãy tải lại hóa đơn và thử lại.');
                dialog.close();
                render();
                const title = transaction.TrangThai === 'SUCCESS'
                    ? 'Thanh toán thành công'
                    : transaction.TrangThai === 'REJECTED'
                        ? 'Chuyển khoản chưa được xác nhận'
                        : 'Đang xác minh chuyển khoản';
                modal(title, fields([
                    ['Mã giao dịch', transaction.MaGiaoDich],
                    ['Mã hóa đơn', invoiceId],
                    ['Số tiền', money(Number(transaction.SoTien))],
                    ['Trạng thái', transaction.TrangThai === 'SUCCESS' ? 'Thanh toán thành công' : transaction.TrangThai === 'REJECTED' ? 'Số tiền hoặc nội dung không khớp' : 'Đang chờ ngân hàng xác minh'],
                    ['Xác nhận', transaction.PhuongThuc === 'ONLINE' && transaction.TrangThai === 'SUCCESS' ? 'Tự động từ ngân hàng' : 'Chờ xác minh']
                ]) + (transaction.LyDoTuChoi ? `<p class="st-notice" role="alert">${esc(transaction.LyDoTuChoi)}</p>` : '') +
                    '<p class="st-notice">Nút này chỉ kiểm tra trạng thái giao dịch; thao tác bấm không xác nhận thanh toán.</p>' +
                    '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
                return;
            }
            const response = await window.ApiClient.fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ MaHoaDon: invoiceId, PhuongThuc: paymentMethod })
            });
            const result = await response.json();
            dialog.close();
            render();
            modal('Yêu cầu thanh toán đã được ghi nhận', fields([
                ['Mã giao dịch', result.MaGiaoDich],
                ['Mã hóa đơn', result.MaHoaDon],
                ['Số tiền', money(Number(result.TongTien))],
                ['Phương thức', result.PhuongThuc === 'ONLINE' ? 'Chuyển khoản QR' : 'Tiền mặt'],
                ['Trạng thái', result.PhuongThuc === 'ONLINE' ? 'Đang chờ ngân hàng xác minh' : 'Chờ Quản lý xác nhận']
            ]) + `<p class="st-notice">${esc(result.message)}</p>
                <div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>`);
        } catch (error) {
            button.disabled = false;
            toast(error.message || 'Không thể gửi yêu cầu thanh toán.');
        }
    }
    main.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.target;
        if (form.id === 'student-request-form') {
            const type = form.elements.type.value;
            const content = form.elements.content.value.trim();
            if (!content) { toast('Vui lòng nhập nội dung yêu cầu.'); form.elements.content.focus(); return; }
            if (!['Gia hạn hợp đồng', 'Báo hỏng thiết bị'].includes(type) || content.length > 1000) return;
            if (backendStudent) {
                const button = form.querySelector('button[type="submit"]');
                button.disabled = true;
                try {
                    const response = await ApiClient.fetch('/api/student/requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            Loai: type,
                            NoiDung: content,
                            ...(type === 'Gia hạn hợp đồng'
                                ? { NgayKetThucDeXuat: form.elements.extensionEndDate.value }
                                : {})
                        })
                    });
                    const result = await response.json();
                    render();
                    toast(result.message || 'Yêu cầu đã được gửi.');
                } catch (error) {
                    button.disabled = false;
                    toast(error.message || 'Không thể gửi yêu cầu.');
                }
                return;
            }
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
