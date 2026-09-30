(() => {
    if (!window.StudentAuth?.session()) {
        window.location.replace('Admin.html');
        return;
    }
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, fields } = ui.helpers;
    const main = document.getElementById('student-page');
    const dialog = document.getElementById('student-dialog');
    let signedOut = false;
    let toastTimer;
    document.getElementById('student-name').textContent = data.profile.name;
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
        if (event.key === 'Escape' && !accountPanel.hidden) {
            closeAccount();
            accountToggle.focus();
        }
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
    function render() {
        if (signedOut) return;
        ui.billing.sync();
        closeAccount();
        dialog.close();
        const route = location.hash.slice(1) || 'home';
        const key = Object.hasOwn(ui.pages, route) ? route : 'home';
        const page = ui.pages[key];
        document.querySelectorAll('#main-nav a').forEach(link => {
            const active = link.hash === `#${key}`;
            link.classList.toggle('nav-active', active);
            if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
        });
        main.innerHTML = `<h1 tabindex="-1">${esc(page.title)}</h1>${page.render()}`;
        document.title = `${page.title} - Sinh viên`;
    }
    function modal(title, content) {
        dialog.classList.remove('st-logout-dialog');
        dialog.removeAttribute('aria-describedby');
        dialog.innerHTML = `<div class="st-modal-heading"><h2 id="student-dialog-title">${title}</h2><button class="st-button" data-action="close" aria-label="Đóng">×</button></div><div class="st-modal-content">${content}</div>`;
        dialog.showModal();
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const action = button.dataset.action;
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
            catch { toast('Không thể xóa phiên demo. Hãy kiểm tra quyền lưu trữ trình duyệt.'); return; }
            window.location.replace('Admin.html');
        } else if (['invoice', 'payment', 'online-step', 'cash-step', 'confirm-online', 'confirm-cash'].includes(action)) {
            handleStudentPayment(action, button.dataset.id);

        }
    });
    async function handleStudentPayment(action, id) {
        ui.billing.sync();
        const invoice = data.invoices.find(i => i.id === id);
        if (!invoice) return;
        const info = ui.billing.detail(invoice);
        const button = (actionName, title) => `<button type="button" class="st-button st-primary" data-action="${actionName}" data-id="${esc(id)}">${title}</button>`;
        if (action === 'invoice') { modal('Chi tiết hóa đơn', info + '<div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>'); return; }
        if (!ui.billing.canPay(invoice)) { toast(ui.billing.status(invoice)); return; }
        if (action === 'payment') {
            modal('Chọn cách thanh toán', info + '<p class="st-notice">Đây là demo, không thực hiện giao dịch tiền thật.</p><div class="st-actions">' + button('online-step', '<i class="fa-solid fa-qrcode" aria-hidden="true"></i> Thanh toán online') + button('cash-step', '<i class="fa-solid fa-money-bill" aria-hidden="true"></i> Thanh toán tiền mặt') + '</div>');
        } else if (action === 'online-step') {
            try {
                const content = ui.billing.qrModal(id);
                dialog.close();
                modal('Thanh toán bằng QR', content + '<div class="st-actions"><button type="button" class="st-button" data-action="close">Đóng</button>' + button('confirm-online', 'DEMO · Giả lập thanh toán thành công') + '</div>');
            } catch (error) { toast(error.message); }
        } else if (action === 'cash-step') {
            dialog.close();
            modal('Thanh toán tại Ban quản lý KTX', info + '<p class="st-notice">Vui lòng đến Ban quản lý KTX để thanh toán hóa đơn. Hóa đơn chỉ được xác nhận sau khi Ban quản lý đã nhận tiền.</p><div class="st-actions">' + button('confirm-cash', 'Đăng ký thanh toán tiền mặt') + '</div><div class="st-dialog-close"><button type="button" class="st-button" data-action="close">Đóng</button></div>');
        } else {
            try {
                const method = action === 'confirm-cash' ? 'CASH' : 'ONLINE';
                if (!window.confirm(method === 'ONLINE' ? `Mô phỏng cổng thanh toán trả kết quả SUCCESS cho hóa đơn ${id}?` : `Đăng ký thanh toán tiền mặt cho hóa đơn ${id}?`)) return;
                const result = await ui.billing.pay(id, method);
                dialog.close();
                render();
                if (method === 'ONLINE') modal('Thanh toán thành công', ui.billing.receipt(result) + '<div class="st-dialog-close"><button class="st-button" data-action="close">Đóng</button></div>');
                else toast('Chờ thanh toán tiền mặt. Vui lòng đến Ban quản lý KTX để hoàn tất thanh toán. Công nợ chưa thay đổi.');
            } catch (error) { toast(error.message); }
        }
    }
    main.addEventListener('submit', event => {
        event.preventDefault();
        const form = event.target;
        if (form.id === 'student-request-form') {
            const type = form.elements.type.value;
            const content = form.elements.content.value.trim();
            if (!content) { toast('Vui lòng nhập nội dung yêu cầu.'); form.elements.content.focus(); return; }
            if (!['Gia hạn hợp đồng', 'Báo hỏng thiết bị'].includes(type) || content.length > 1000) return;
            ui.repository.addRequest(type, content);
            render();
            toast('Đã thêm yêu cầu demo vào danh sách chờ duyệt.');
        } else if (form.id === 'student-password-form') {
            const { current, password, confirm } = form.elements;
            if (password.value.length < 8 || password.value !== confirm.value) { toast('Mật khẩu mới cần ít nhất 8 ký tự và nhập lại phải khớp.'); confirm.focus(); return; }
            if (current.value === password.value) { toast('Mật khẩu mới phải khác mật khẩu hiện tại.'); password.focus(); return; }
            form.reset();
            toast('Thông tin hợp lệ trong bản demo. Mật khẩu thật chưa thay đổi.');
        }
    });
    window.addEventListener('hashchange', render);
    window.addEventListener('storage', event => {
        if (event.key === null || event.key.startsWith(KTXPaymentDemo.prefix)) { ui.billing.sync(); render(); }
    });
    window.addEventListener('focus', () => { ui.billing.sync(); if (!dialog.open) render(); });
    render();
})();
