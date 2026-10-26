// Student: TrangChu
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date } = ui.helpers;
    const backendStudent = () => window.StudentAuth?.session()?.isBackend;
    const statusTone = value => {
        const text = String(value || '').toLowerCase();
        if (/quá hạn|đã hết hạn|cần thanh toán|còn nợ/.test(text)) return 'st-danger';
        if (/chờ thanh toán|sắp hết hạn|còn \d+ ngày|\d+ ngày còn lại/.test(text)) return 'st-warning';
        if (/đang ở|đang hiệu lực|đã thanh toán|không có công nợ/.test(text)) return 'st-success';
        return 'st-neutral';
    };
    const banner = room => `<section class="sh-welcome">
        <div class="sh-welcome-copy">
            <h1>Xin chào, ${esc(data.profile?.name || 'Sinh viên')}</h1>
            <p data-dashboard-subtitle>${esc([data.profile?.code, room].filter(Boolean).join(' · '))}</p>
            <p class="sh-welcome-quote">Chúc bạn có một năm học thật nhiều trải nghiệm và thành công!</p>
        </div>
        <div class="sh-welcome-art">${window.StudentBangTree?.render() || ''}</div>
    </section>`;
    const stat = (index, label, value, status, route, icon, dataAttrs = '', hintAttrs = '') => `<a class="sh-stat sh-stat-${index}" href="#${route}">
        <span class="sh-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
        <div class="sh-stat-copy"><span>${label}</span><strong class="${value === '—' ? 'sh-stat-empty' : ''}" ${dataAttrs}>${esc(value)}</strong>
            <span class="st-badge sh-status ${statusTone(status)}" ${hintAttrs}>${esc(status)}</span><small>Xem chi tiết →</small></div>
    </a>`;
    const shell = (roomLabel, backend) => `<div class="student-home-dashboard">
        ${banner(backend ? '' : roomLabel === '—' ? '' : roomLabel)}
        <p data-dashboard-error class="st-notice" role="alert" hidden></p>
        <div class="sh-overview">
            ${stat(0, 'Phòng hiện tại', backend ? 'Đang tải…' : roomLabel, backend ? '' : roomLabel === '—' ? '' : 'Đang ở', 'room', 'fa-bed', 'data-dashboard-room', 'data-dashboard-room-hint')}
            ${stat(1, 'Hợp đồng', '—', '', 'contract', 'fa-file-contract', 'data-dashboard-contract', 'data-dashboard-contract-hint')}
            ${stat(2, 'Hóa đơn chưa thanh toán', '—', '', 'invoices', 'fa-file-invoice', 'data-dashboard-unpaid', 'data-dashboard-unpaid-hint')}
            ${stat(3, 'Công nợ', '—', '', 'invoices', 'fa-wallet', 'data-dashboard-debt', 'data-dashboard-debt-hint')}
        </div>
        <p data-dashboard-contract-warning class="st-notice" role="status" hidden></p>
        <p data-dashboard-overdue class="st-notice sh-overdue" role="status" hidden></p>
        <div class="sh-columns">
            <section class="sh-panel sh-payment-panel"><div class="sh-panel-title"><h2><i class="fa-solid fa-bell" aria-hidden="true"></i> Thông báo</h2></div>
                <ul class="sh-announcements" data-student-notices><li class="st-muted">Đang tải thông tin…</li></ul>
            </section>
            <div class="sh-home-aside">
                <section class="sh-panel sh-residence-panel" data-dashboard-residence-panel>
                    <h2><i class="fa-solid fa-house" aria-hidden="true"></i> Thông tin lưu trú</h2>
                    <dl class="sh-residence">
                        <div><dt>Phòng hiện tại</dt><dd data-dashboard-room-detail>—</dd></div>
                        <div><dt>Khu/Tòa</dt><dd data-dashboard-building>—</dd></div>
                        <div><dt>Đang ở / Sức chứa</dt><dd data-dashboard-occupancy>—</dd></div>
                        <div><dt>Ngày bắt đầu</dt><dd data-dashboard-contract-start>—</dd></div>
                        <div><dt>Hợp đồng đến</dt><dd data-dashboard-contract-end>—</dd></div>
                        <div><dt>Trạng thái hợp đồng</dt><dd data-dashboard-contract-status>—</dd></div>
                        <div><dt>Công nợ</dt><dd data-dashboard-debt-detail>—</dd></div>
                    </dl>
                    <div class="sh-links"><a href="#room">Phòng của tôi</a><a href="#contract">Hợp đồng</a><a href="#invoices">Hóa đơn</a></div>
                </section>
                <section class="sh-panel sh-unassigned-panel" data-dashboard-room-empty hidden>
                    <span class="sh-empty-icon" aria-hidden="true"><i class="fa-solid fa-house-circle-exclamation"></i></span>
                    <h2>Bạn chưa được xếp phòng</h2>
                    <p>Liên hệ Quản lý KTX hoặc gửi yêu cầu hỗ trợ để được hướng dẫn.</p>
                    <a class="st-button st-primary" href="#requests">Yêu cầu &amp; Hỗ trợ</a>
                </section>
                <section class="sh-panel sh-rules-panel">
                    <h2>Nội quy ký túc xá</h2><ul class="sh-rules" data-student-rules><li class="st-muted">Đang tải nội quy…</li></ul>
                    <h3>Liên hệ hỗ trợ</h3><dl class="sh-contact" data-student-contact><div><dt>Thông tin</dt><dd>Đang tải…</dd></div></dl>
                </section>
            </div>
        </div>
    </div>`;
    const dateTime = value => {
        const source = String(value ?? '').trim();
        if (!source) return '—';
        const shared = typeof window.AdminWorkflowUtils?.dateTime === "function"
            ? window.AdminWorkflowUtils.dateTime(source) : null;
        if (shared && shared !== '—') return shared;
        const time = /[T ](\d{2}:\d{2})/.exec(source)?.[1];
        const formatted = date(source.slice(0, 10));
        return formatted === '—' ? '—' : `${time ? `${time} ` : ''}${formatted}`;
    };
    const replaceText = (markup, attribute, value) => {
        const selector = new RegExp(`(<strong\\b[^>]*\\b${attribute}\\b[^>]*>)`);
        markup = markup.replace(selector, opening => {
            const hasEmptyClass = /\bclass="[^"]*\bsh-stat-empty\b/.test(opening);
            if (value === '—' && !hasEmptyClass) return opening.replace('class="', 'class="sh-stat-empty ');
            if (value !== '—' && hasEmptyClass) return opening.replace(/\bsh-stat-empty\s*/, '');
            return opening;
        });
        return markup.replace(
            new RegExp(`(<[^>]*\\b${attribute}\\b[^>]*>)[\\s\\S]*?(<\\/[^>]+>)`),
            (_match, opening, closing) => `${opening}${esc(value)}${closing}`
        );
    };
    const replaceHint = (markup, attribute, value) => {
        const selector = new RegExp(`(<span\\b(?=[^>]*\\b${attribute}\\b)[^>]*>)`);
        markup = markup.replace(selector, opening => opening.replace(/\bst-(?:success|warning|danger|neutral)\b/g, '').replace('class="st-badge sh-status', `class="st-badge sh-status ${statusTone(value)}`));
        return replaceText(markup, attribute, value);
    };
    const replaceHtml = (markup, attribute, value) => {
        const tag = attribute === 'data-student-contact' ? 'dl' : 'ul';
        return markup.replace(
        new RegExp(`(<${tag}\\b[^>]*\\b${attribute}\\b[^>]*>)[\\s\\S]*?(<\\/${tag}>)`),
        (_match, opening, closing) => `${opening}${value}${closing}`
        );
    };
    const renderNotifications = (payments, notices) => {
        const rows = [
            ...payments.filter(payment => payment.TrangThai === 'SUCCESS').map(payment => ({
                kind: 'Thanh toán',
                title: `Đã thanh toán ${payment.TenKhoan || 'khoản phí'}`,
                detail: `Hóa đơn ${payment.MaHoaDon || '—'} · ${money(Number(payment.SoTien || 0))} · ${payment.PhuongThuc === 'ONLINE' ? 'Chuyển khoản (QR)' : 'Tiền mặt'}`,
                createdAt: payment.NgayThanhToan || payment.NgayTao
            })),
            ...notices.map(notice => ({
                kind: 'Thông báo từ Quản lý',
                title: notice.TieuDe || '—',
                detail: notice.NoiDung || '—',
                createdAt: notice.NgayTao
            }))
        ].sort((left, right) => (Date.parse(right.createdAt || '') || 0) - (Date.parse(left.createdAt || '') || 0));
        return rows.length ? rows.map(item => `<li>
            <span class="st-badge st-neutral">${esc(item.kind)}</span>
            <div class="sh-news-content"><h3>${esc(item.title)}</h3>
                <p>${esc(item.detail)}</p><p>${esc(dateTime(item.createdAt))}</p></div>
        </li>`).join('') : '<li class="st-muted">Chưa có thông báo.</li>';
    };
    ui.noticeHelpers = Object.freeze({ renderNotifications });

    ui.pages.home = {
        title: 'Trang chủ',
        render: () => {
            if (backendStudent()) return shell('—', true);
            const room = data.room;
            const contract = data.contract;
            const summary = ui.billing.summary();
            const hasRoom = Boolean(room?.number);
            const roomLabel = hasRoom ? room.number : '—';
            const hasContract = Boolean(contract?.id && contract?.end);
            const days = hasContract ? ui.helpers.remaining() : null;
            const status = hasContract ? ui.helpers.contractStatus() : '—';
            const invoices = data.invoices || [];
            const unpaid = summary.unpaid;
            const debt = summary.debt;
            const hasInvoices = invoices.length > 0;
            const paymentHint = hasInvoices
                ? unpaid ? 'Chờ thanh toán' : 'Đã thanh toán đủ'
                : 'Chưa có hóa đơn';
            let markup = shell(roomLabel, false);
            const set = (attribute, value) => { markup = replaceText(markup, attribute, value); };
            set('data-dashboard-room', roomLabel);
            set('data-dashboard-contract', status);
            set('data-dashboard-unpaid', hasInvoices ? `${unpaid} hóa đơn` : '—');
            set('data-dashboard-debt', hasInvoices ? money(debt) : '—');
            for (const [attribute, value] of [
                ['data-dashboard-room-hint', hasRoom ? 'Đang ở' : ''],
                ['data-dashboard-contract-hint', hasContract ? days < 0 ? 'Đã hết hạn' : `${days} ngày còn lại` : ''],
                ['data-dashboard-unpaid-hint', paymentHint],
                ['data-dashboard-debt-hint', hasInvoices ? debt > 0 ? 'Cần thanh toán' : 'Không có công nợ' : '']
            ]) markup = replaceHint(markup, attribute, value);
            if (!hasRoom) {
                markup = markup.replace('data-dashboard-residence-panel>', 'data-dashboard-residence-panel hidden>');
                markup = markup.replace('data-dashboard-room-empty hidden>', 'data-dashboard-room-empty>');
            } else {
                set('data-dashboard-room-detail', roomLabel);
                set('data-dashboard-building', room.building || '—');
                set('data-dashboard-occupancy', `${Array.isArray(room.members) ? room.members.length : 0}/${room.capacity ?? '—'} người`);
                set('data-dashboard-contract-start', contract?.start ? date(contract.start) : '—');
                set('data-dashboard-contract-end', hasContract ? date(contract.end) : '—');
                set('data-dashboard-contract-status', status);
                set('data-dashboard-debt-detail', hasInvoices ? debt > 0 ? `Còn nợ ${money(debt)}` : 'Không có công nợ' : '—');
            }
            markup = replaceHtml(markup, 'data-student-notices', '<li class="st-muted">Chưa có thông báo.</li>');
            markup = replaceHtml(markup, 'data-student-rules', '<li class="st-muted">Nội quy dùng chung chưa khả dụng trong chế độ demo.</li>');
            markup = replaceHtml(markup, 'data-student-contact', '<div><dt>Thông tin</dt><dd>Chưa cập nhật</dd></div>');
            return markup;
        },
        async load(root) {
            if (!backendStudent()) return;
            const set = (selector, value) => {
                const node = root.querySelector(selector);
                if (node) {
                    node.textContent = value;
                    if (typeof node.matches === 'function'
                        && node.matches('strong[data-dashboard-room], strong[data-dashboard-contract], strong[data-dashboard-unpaid], strong[data-dashboard-debt]')) {
                        node.classList.toggle('sh-stat-empty', value === '—');
                    }
                    if (['[data-dashboard-error]', '[data-dashboard-contract-warning]', '[data-dashboard-overdue]'].includes(selector)) node.hidden = !value;
                }
            };
            try {
                const [roomResponse, contractResponse, invoiceResponse] = await Promise.all([
                    ApiClient.fetch('/api/student/room'),
                    ApiClient.fetch('/api/student/contracts'),
                    ApiClient.fetch('/api/HoaDon')
                ]);
                const [roomData, contracts, invoices] = await Promise.all([
                    roomResponse.json(), contractResponse.json(), invoiceResponse.json()
                ]);
                if (!root.isConnected) return;
                if (!Array.isArray(contracts) || !Array.isArray(invoices)) throw new Error('Dữ liệu lưu trú hoặc hóa đơn không hợp lệ.');
                const room = roomData.room;
                const hasRoom = Boolean(room?.TenPhong);
                const currentContract = contracts.find(item => item.TrangThaiHopDong === 'Còn hiệu lực') || null;
                const unpaidInvoices = invoices.filter(invoice => Number(invoice.ConNo || 0) > 0);
                const allInvoicesPaid = invoices.length > 0 && invoices.every(invoice =>
                    invoice.TrangThaiThanhToan === 'Đã thanh toán' && Number(invoice.ConNo || 0) <= 0);
                const debt = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.ConNo || 0), 0);
                const now = new Date();
                const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const overdueInvoices = unpaidInvoices.filter(invoice => invoice.HanThanhToan && String(invoice.HanThanhToan).slice(0, 10) < todayIso).length;
                const endDate = currentContract?.NgayKetThuc ? String(currentContract.NgayKetThuc).slice(0, 10) : '';
                const daysRemaining = endDate
                    ? Math.ceil((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86400000)
                    : null;
                const contractStatus = currentContract
                    ? daysRemaining < 0 ? 'Hợp đồng đã hết hạn' : daysRemaining <= 30 ? 'Sắp hết hạn' : currentContract.TrangThaiHopDong
                    : '—';
                const roomLabel = hasRoom ? room.TenPhong : '—';
                set('[data-dashboard-room]', roomLabel);
                set('[data-dashboard-contract]', contractStatus);
                set('[data-dashboard-unpaid]', invoices.length ? `${unpaidInvoices.length} hóa đơn` : '—');
                set('[data-dashboard-debt]', invoices.length ? money(debt) : '—');
                set('[data-dashboard-subtitle]', [data.profile?.code, hasRoom ? roomLabel : ''].filter(Boolean).join(' · '));
                const hints = root.querySelectorAll('.sh-stat .sh-status');
                const hintValues = [
                    hasRoom ? room.TrangThaiPhong || 'Đang ở' : '',
                    daysRemaining == null ? '' : daysRemaining < 0 ? 'Đã hết hạn' : `Còn ${daysRemaining} ngày`,
                    overdueInvoices
                    ? `${overdueInvoices} hóa đơn quá hạn`
                    : unpaidInvoices.length ? 'Chờ thanh toán'
                        : allInvoicesPaid ? 'Đã thanh toán đủ' : invoices.length ? 'Không có công nợ' : 'Chưa có hóa đơn',
                    invoices.length ? debt > 0 ? 'Cần thanh toán' : 'Không có công nợ' : ''
                ];
                hints.forEach((node, index) => {
                    node.textContent = hintValues[index];
                    node.classList.remove('st-success', 'st-warning', 'st-danger', 'st-neutral');
                    node.classList.add(statusTone(hintValues[index]));
                });
                root.querySelector('[data-dashboard-residence-panel]').hidden = !hasRoom;
                root.querySelector('[data-dashboard-room-empty]').hidden = hasRoom;
                if (hasRoom) {
                    set('[data-dashboard-room-detail]', roomLabel);
                    set('[data-dashboard-building]', room.Khu ? `Khu ${room.Khu}` : '—');
                    set('[data-dashboard-occupancy]', `${room.SoSinhVienHienTai ?? '—'}/${room.SucChuaToiDa ?? '—'} người`);
                    set('[data-dashboard-contract-start]', currentContract?.NgayBatDau ? date(currentContract.NgayBatDau) : '—');
                    set('[data-dashboard-contract-end]', currentContract?.NgayKetThuc ? date(currentContract.NgayKetThuc) : '—');
                    set('[data-dashboard-contract-status]', contractStatus);
                    set('[data-dashboard-debt-detail]', invoices.length ? debt > 0 ? `Còn nợ ${money(debt)}` : 'Không có công nợ' : '—');
                }
                set('[data-dashboard-contract-warning]', daysRemaining != null && daysRemaining <= 30
                    ? `Hợp đồng lưu trú ${daysRemaining < 0 ? 'đã hết hạn' : `sắp hết hạn ngày ${date(endDate)} (${daysRemaining} ngày)`}.`
                    : '');
                set('[data-dashboard-overdue]', overdueInvoices ? `Bạn có ${overdueInvoices} hóa đơn quá hạn thanh toán.` : '');
            } catch (error) {
                if (root.isConnected) set('[data-dashboard-error]', error.message || 'Không thể tải thông tin lưu trú và hóa đơn.');
            }
        }
    };
    ui.loadStudentDashboardData = async (root, backend) => {
        const noticesNode = root.querySelector('[data-student-notices]');
        const rulesNode = root.querySelector('[data-student-rules]');
        const contactNode = root.querySelector('[data-student-contact]');
        if (!backend) {
            noticesNode.textContent = 'Chưa có thông báo.';
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
        const paymentPromise = ApiClient.fetch('/api/payments/history').then(response => response.json());
        const noticePromise = ApiClient.fetch('/api/student/notifications').then(response => response.json());
        const [paymentResult, noticeResult] = await Promise.allSettled([paymentPromise, noticePromise]);
        if (root.isConnected) {
            const paymentRows = paymentResult.status === 'fulfilled' && Array.isArray(paymentResult.value) ? paymentResult.value : [];
            const noticeRows = noticeResult.status === 'fulfilled' && Array.isArray(noticeResult.value) ? noticeResult.value : [];
            const errorMessages = [paymentResult, noticeResult]
                .filter(result => result.status === 'rejected')
                .map(result => result.reason?.message || 'Không thể tải một số thông báo.');
            if ((paymentResult.status === 'fulfilled' && !Array.isArray(paymentResult.value))
                || (noticeResult.status === 'fulfilled' && !Array.isArray(noticeResult.value))) {
                errorMessages.push('Dữ liệu thông báo không hợp lệ.');
            }
            const notificationMarkup = renderNotifications(paymentRows, noticeRows);
            noticesNode.innerHTML = errorMessages.length
                ? `${notificationMarkup}<li class="st-field-error">${esc(errorMessages.join(' · '))}</li>`
                : notificationMarkup;
        }
        load('/api/noi-quy', rules => {
            if (!Array.isArray(rules)) throw new Error('Dữ liệu nội quy không hợp lệ.');
            rulesNode.innerHTML = rules.length ? rules.map(rule => `<li>${esc(rule.NoiDung || '—')}</li>`).join('') : '<li class="st-muted">Hiện chưa có nội quy.</li>';
        }, message => { rulesNode.textContent = message; });
        load('/api/lien-he', contact => {
            contactNode.innerHTML = [['Điện thoại', contact.DienThoai], ['Email', contact.Email], ['Giờ làm việc', contact.GioLamViec]]
                .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value || '—')}</dd></div>`).join('');
        }, message => { contactNode.textContent = message; });
    };
})();
