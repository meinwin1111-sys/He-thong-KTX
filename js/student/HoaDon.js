// Student billing UI backed by the shared browser demo ledger.
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const store = KTXPaymentDemo;
    const { esc, money, date, fields, card, table, maskStudentId, maskReference, paymentMethodLabel } = ui.helpers;
    const labels = { UNPAID: 'Còn nợ', OVERDUE: 'Trễ hạn', WAITING_CASH: 'Còn nợ', PARTIAL: 'Còn nợ', PAID: 'Đã thanh toán' };
    const itemLabels = { UNPAID: 'Còn nợ', WAITING_CASH: 'Còn nợ', PAID: 'Đã thanh toán' };
    let officeContact = {};
    const method = value => value === 'CASH' ? 'Tiền mặt' : value ? 'Chuyển khoản QR' : 'Chưa xác định';
    const invoiceStatus = invoice => window.AdminWorkflowUtils?.invoicePaymentLabel(invoice)
        || (Number(invoice?.ConNo) > 0 ? 'Còn nợ' : 'Đã thanh toán');
    const backendStudent = () => window.StudentAuth?.session()?.isBackend === true;
    const time = value => {
        const formatted = window.AdminWorkflowUtils?.dateTime(String(value ?? ''));
        if (formatted && /^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) return formatted;
        const source = String(value ?? '');
        const day = date(source.slice(0, 10));
        const hour = /[T ](\d{2}:\d{2})/.exec(source)?.[1];
        return /^\d{2}\/\d{2}\/\d{4}$/.test(day) ? `${hour ? `${hour} ` : ''}${day}` : 'Chưa có';
    };
    const badgeClass = value => value === 'PAID' || value === 'Đã thanh toán' ? 'st-success'
        : value === 'Trễ hạn' ? 'st-danger' : 'st-warning';
    const badge = value => `<span class="st-badge ${badgeClass(value)}">${esc(labels[value] || value || 'Chưa có')}</span>`;
    const itemBadge = value => `<span class="st-badge ${badgeClass(value)}">${esc(itemLabels[value] || value)}</span>`;
    const token = (invoiceId, itemId) => `${invoiceId}\0${itemId}`;
    const selected = new Map();
    let storageError = '';
    function sync() {
        if (backendStudent()) return;
        try {
            const saved = store.initialize(data);
            data.invoices = saved.invoices;
            data.payments = saved.payments;
            storageError = '';
            pruneSelection();
        } catch (error) { storageError = `Không thể đọc/lưu dữ liệu thanh toán demo: ${error.message}`; }
    }
    function identity() {
        const code = window.StudentAuth?.session()?.code;
        if (!code || code !== data.profile.code) throw new Error('Phiên sinh viên đã thay đổi. Vui lòng tải lại trang.');
        if (storageError) throw new Error(storageError);
        return code;
    }
    function payableItems(invoice) {
        return (invoice?.items || []).filter(item => item.status === 'UNPAID' && Number(item.amount) > 0);
    }
    function allPayable() {
        return data.invoices.flatMap(invoice => payableItems(invoice).map(item => ({ invoiceId: invoice.id, itemId: item.id, amount: item.amount })));
    }
    function pruneSelection() {
        for (const [key, { invoiceId, itemId }] of [...selected]) {
            const invoice = data.invoices.find(entry => entry.id === invoiceId);
            const item = invoice?.items?.find(entry => entry.id === itemId);
            if (!item || item.status !== 'UNPAID' || Number(item.amount) <= 0) selected.delete(key);
        }
    }
    function currentSelection() {
        pruneSelection();
        const groups = new Map();
        for (const { invoiceId, itemId } of selected.values()) {
            if (!groups.has(invoiceId)) groups.set(invoiceId, []);
            groups.get(invoiceId).push(itemId);
        }
        return [...groups].map(([invoiceId, itemIds]) => ({ invoiceId, itemIds }));
    }
    function selectedTotals() {
        pruneSelection();
        let amount = 0;
        for (const { invoiceId, itemId } of selected.values()) {
            const item = data.invoices.find(entry => entry.id === invoiceId)?.items?.find(entry => entry.id === itemId);
            amount += Number(item?.amount || 0);
        }
        return { count: selected.size, amount };
    }
    function itemNames(items) {
        return (items || []).map(item => item.name).filter(Boolean).join(', ') || 'Chưa có';
    }
    function groupedHtml(selection) {
        return selection.map(group => {
            const invoice = data.invoices.find(entry => entry.id === group.invoiceId);
            const rows = group.itemIds.map(itemId => {
                const item = invoice?.items?.find(entry => entry.id === itemId);
                return `<li><span>${esc(item?.name || itemId)}${item?.note ? `<small>${esc(item.note)}</small>` : ''}</span><strong>${money(item?.amount || 0)}</strong></li>`;
            }).join('');
            return `<section class="st-pay-group"><h3>${esc(invoice?.id || group.invoiceId)} · ${esc(invoice?.month || '')}</h3><ul>${rows}</ul></section>`;
        }).join('');
    }
    function encodeQrText(value) {
        if (typeof qrcode !== 'function') throw new Error('Không thể tải bộ tạo QR. Vui lòng tải lại trang.');
        const qr = qrcode(0, 'M');
        const bytes = Array.from(new TextEncoder().encode(value), byte => String.fromCharCode(byte)).join('');
        qr.addData(bytes, 'Byte');
        qr.make();
        return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
    }
    function encodeQr(payload) {
        return encodeQrText(JSON.stringify(payload));
    }
    const qrPayloadForDisplay = (payment, compact = false) => {
        const payload = payment.qrPayload || payment;
        const safeIdentity = maskStudentId(payload.studentId || payment.studentId);
        const safeContent = String(payload.paymentContent || payment.paymentContent || '');
        if (compact) return { studentId: safeIdentity, amount: payment.amount, paymentContent: safeContent };
        return {
            ...payload,
            studentId: safeIdentity,
            paymentContent: safeContent
        };
    };
    function paintChecks(root) {
        if (!root) return;
        pruneSelection();
        root.querySelectorAll('[data-item-id]').forEach(box => {
            box.checked = selected.has(token(box.dataset.invoiceId, box.dataset.itemId));
        });
        root.querySelectorAll('[data-select-invoice]').forEach(box => {
            const invoice = data.invoices.find(entry => entry.id === box.dataset.selectInvoice);
            const payable = payableItems(invoice);
            const count = payable.filter(item => selected.has(token(invoice.id, item.id))).length;
            box.checked = payable.length > 0 && count === payable.length;
            box.indeterminate = count > 0 && count < payable.length;
        });
        const all = root.querySelector('[data-select-all]');
        if (all) {
            const payable = allPayable();
            const count = payable.filter(item => selected.has(token(item.invoiceId, item.itemId))).length;
            all.checked = payable.length > 0 && count === payable.length;
            all.indeterminate = count > 0 && count < payable.length;
        }
        const totals = selectedTotals();
        const summary = root.querySelector('[data-pay-summary]');
        if (summary) summary.textContent = `Đã chọn ${totals.count} hạng mục – Tổng: ${money(totals.amount)}`;
        root.querySelectorAll('[data-pay-action]').forEach(button => { button.disabled = totals.count === 0; });
    }
    sync();
    ui.billing = {
        sync,
        pruneSelection,
        currentSelection,
        afterRender: paintChecks,
        status: invoice => labels[store.status(invoice)],
        canPay: invoice => payableItems(invoice).length > 0,
        qrDetails(selection) { return store.qrDetails(identity(), selection || currentSelection()); },
        qrPayloadForDisplay,
        async qrModal(selection) {
            const chosen = selection || currentSelection();
            const payment = await store.qrDetails(identity(), chosen);
            if (window.StudentPaymentConfig?.mode !== 'demo') throw new Error('Chưa cấu hình cổng thanh toán ngân hàng thật.');
            let svg;
            try { svg = encodeQr(qrPayloadForDisplay(payment)); }
            catch {
                svg = encodeQr(qrPayloadForDisplay(payment, true));
            }
            return '<p class="st-demo">DEMO / SANDBOX</p>' +
                `<div class="st-payment-amount">${money(payment.amount)}</div>` +
                fields([['Họ tên', data.profile.name], ['Số CCCD', maskStudentId(payment.studentId)], ['Phòng', data.room.number],
                    ['Nội dung thanh toán', maskReference(payment.paymentContent)], ['Số hạng mục', String(payment.items.length)]]) +
                `<div class="st-pay-items">${groupedHtml(chosen)}</div>` +
                `<figure class="st-payment-qr"><div role="img" aria-label="QR thanh toán ${esc(maskReference(payment.paymentContent))}">${svg}</div><figcaption>DEMO / SANDBOX</figcaption></figure>` +
                '<p class="st-notice">QR này mô phỏng chuyển khoản, không thực hiện giao dịch tiền thật.</p>';
        },
        summary() {
            const unpaid = data.invoices.filter(invoice => store.amount(invoice) > 0);
            return { debt: unpaid.reduce((sum, invoice) => sum + store.amount(invoice), 0), unpaid: unpaid.length };
        },
        async pay(selection, paymentMethod) {
            if (!['ONLINE', 'CASH'].includes(paymentMethod)) throw new Error('Phương thức không hợp lệ.');
            const code = identity();
            if (paymentMethod === 'ONLINE' && window.StudentPaymentConfig?.mode !== 'demo') throw new Error('Chỉ hỗ trợ thanh toán DEMO.');
            const result = await (paymentMethod === 'ONLINE' ? store.payOnline(code, selection) : store.requestCash(code, selection));
            sync();
            return result;
        },
        receipt(payment) {
            const groups = (payment.items || []).reduce((list, item) => {
                const group = list.find(entry => entry.invoiceId === item.invoiceId);
                if (group) group.itemIds.push(item.itemId); else list.push({ invoiceId: item.invoiceId, itemIds: [item.itemId] });
                return list;
            }, []);
            return '<p class="st-demo">Biên nhận DEMO / SANDBOX</p>' + fields([
                ['Hóa đơn', payment.invoiceId], ['Số tiền', money(payment.amount)], ['Thời gian thanh toán', time(payment.paymentTime)],
                ['Phương thức', method(payment.paymentMethod)],
                ['Mã giao dịch', payment.transactionId], ['Hạng mục', itemNames(payment.items)]
            ]) + (groups.length ? `<div class="st-pay-items">${groupedHtml(groups)}</div>` : '');
        },
        detail(invoice) {
            return fields([['Mã hóa đơn', invoice.id], ['Tháng', invoice.month], ['Phòng', data.room.number], ['Hạn thanh toán', date(invoice.due)],
                ...((invoice.items || []).filter(item => Number(item.amount) > 0).map(item => [item.name + (item.note ? ` (${item.note})` : ''), money(item.amount)])),
                ['Tổng cộng', money((invoice.items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0))],
                ['Còn nợ', money(store.amount(invoice))], ['Trạng thái', this.status(invoice)],
                ...(invoice.paid && invoice.paymentMethod ? [['Phương thức', method(invoice.paymentMethod)], ['Thời gian thanh toán', time(invoice.paymentTime)]] : [])]);
        },
        handleChange(event) {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
            if (input.hasAttribute('data-select-all')) {
                const payable = allPayable();
                const allOn = payable.every(item => selected.has(token(item.invoiceId, item.itemId)));
                selected.clear();
                if (!allOn) payable.forEach(item => selected.set(token(item.invoiceId, item.itemId), item));
            } else if (input.hasAttribute('data-select-invoice')) {
                const invoiceId = input.dataset.selectInvoice;
                const payable = payableItems(data.invoices.find(entry => entry.id === invoiceId));
                const allOn = payable.every(item => selected.has(token(invoiceId, item.id)));
                payable.forEach(item => {
                    const key = token(invoiceId, item.id);
                    if (allOn) selected.delete(key); else selected.set(key, { invoiceId, itemId: item.id });
                });
            } else if (input.dataset.itemId) {
                const invoiceId = input.dataset.invoiceId;
                const itemId = input.dataset.itemId;
                const key = token(invoiceId, itemId);
                if (input.checked) selected.set(key, { invoiceId, itemId }); else selected.delete(key);
            } else return;
            paintChecks(input.closest('#student-page') || input.closest('.st-invoice-page'));
        }
    };
    ui.backendPayments = Object.freeze({
        setOfficeContact(contact) {
            officeContact = contact && typeof contact === 'object' ? contact : {};
        },
        getOfficeContact() {
            return officeContact;
        },
        statusLabel(status) {
            return ({
                SUCCESS: 'Thành công',
                PENDING: 'Đang xử lý',
                REJECTED: 'Thất bại',
                FAILED: 'Thất bại',
                EXPIRED: 'Thất bại',
            })[status] || 'Thất bại';
        },
        parseAmount(value, balance) {
            const input = String(value ?? '');
            const amount = Number(input);
            const maximum = Number(balance);
            if (!/^[1-9]\d*$/.test(input) || !Number.isSafeInteger(amount)
                || !Number.isSafeInteger(maximum) || maximum <= 0 || amount > maximum) {
                throw new Error('Số tiền phải là số nguyên VND dương và không vượt số còn nợ.');
            }
            return amount;
        },
        qrModal(payment) {
            const svg = encodeQrText(payment.QrPayload);
            return '<p class="st-notice">QR được tạo đúng số tiền còn nợ của hóa đơn. Hóa đơn chỉ được ghi nhận đã thanh toán khi hệ thống nhận xác minh ngân hàng với đúng số tiền và nội dung; bấm nút bên dưới không phải bằng chứng thanh toán.</p>' +
                fields([
                    ['Ngân hàng', payment.NganHang],
                    ['Chủ tài khoản', payment.TenTaiKhoan],
                    ['Số tài khoản', payment.SoTaiKhoan],
                    ['Mã hóa đơn', payment.MaHoaDon],
                    ['Số tiền', money(Number(payment.TongTien))],
                    ['Nội dung chuyển khoản', payment.NoiDungCK]
                ]) +
                `<figure class="st-payment-qr"><div role="img" aria-label="Mã QR chuyển khoản hóa đơn ${esc(payment.MaHoaDon)}">${svg}</div><figcaption>Chuyển khoản QR</figcaption></figure>`;
        },
        receiptMarkup(receipt) {
            if (!receipt || receipt.TrangThai !== 'Hợp lệ') throw new Error('Chỉ có thể in phiếu thu hợp lệ.');
            const paymentMethod = paymentMethodLabel(receipt.PhuongThuc);
            return `<article class="student-receipt-paper">
                <header class="text-center"><h2>PHIẾU THU</h2><p>Mã phiếu: ${esc(receipt.MaPhieuThu || 'Chưa có')}</p></header>
                ${fields([
                    ['Mã hóa đơn', receipt.MaHoaDon],
                    ['Ngày thu', time(receipt.NgayThu)],
                    ['Số tiền', money(Number(receipt.SoTien))],
                    ['Phương thức', paymentMethod],
                    ['Mã tham chiếu', maskReference(receipt.MaThamChieu)],
                    ['Trạng thái', receipt.TrangThai]
                ])}
            </article>`;
        }
    });
    async function loadBackendInvoices(root) {
        if (!root) return;
        try {
            const [invoiceResponse, historyResponse] = await Promise.all([
                window.ApiClient.fetch('/api/HoaDon'),
                window.ApiClient.fetch('/api/payments/history')
            ]);
            let contact = {};
            try {
                const contactResponse = await window.ApiClient.fetch('/api/lien-he');
                const contactResult = await contactResponse.json();
                if (!contactResponse.ok) throw new Error(contactResult.message || 'Không thể tải thông tin văn phòng.');
                contact = contactResult;
            } catch {
                contact = {};
            }
            ui.backendPayments.setOfficeContact(contact);
            const [invoices, payments] = await Promise.all([
                invoiceResponse.json(),
                historyResponse.json()
            ]);
            if (!root.isConnected) return;
            if (!Array.isArray(invoices) || !Array.isArray(payments)) {
                throw new Error('Dữ liệu hóa đơn hoặc lịch sử thanh toán không hợp lệ.');
            }

            const historyByInvoice = new Map();
            for (const payment of payments) {
                if (!historyByInvoice.has(payment.MaHoaDon)) historyByInvoice.set(payment.MaHoaDon, []);
                historyByInvoice.get(payment.MaHoaDon).push(payment);
            }
            const statusLabel = payment => ui.backendPayments.statusLabel(payment.TrangThai);
            const methodLabel = payment => paymentMethodLabel(payment.PhuongThuc);
            const historyRows = (rows, invoiceId) => rows.length
                ? table(
                    ['Mã giao dịch', 'Người nộp', 'Khoản thanh toán', 'Số tiền', 'Thời gian', 'Phương thức', 'Trạng thái'],
                    rows.map(payment => `<tr>
                        <td class="st-transaction-id"><button type="button" class="st-transaction-detail"
                            data-action="backend-payment-detail" data-id="${esc(invoiceId)}"
                            data-transaction-id="${esc(payment.MaGiaoDich || '')}">${esc(payment.MaGiaoDich || 'Chưa có')}</button></td>
                        <td class="st-transaction-payer">${esc(payment.HoTen || '')}</td>
                        <td>${esc(payment.TenKhoan || 'Chưa có')}</td>
                        <td class="st-amount">${money(payment.SoTien)}</td>
                        <td>${esc(time(payment.NgayThanhToan || payment.NgayTao))}</td>
                        <td>${esc(methodLabel(payment) || 'Chưa xác định')}</td>
                        <td>${esc(statusLabel(payment))}${payment.LyDoTuChoi || payment.LyDoDoiSoat
                            ? `<small>${esc(payment.LyDoTuChoi || payment.LyDoDoiSoat)}</small>` : ''}</td>
                    </tr>`).join('')
                ).replace('class="st-table-wrap"', 'class="st-table-wrap st-payment-history"')
                : '<p class="st-muted">Chưa có giao dịch thanh toán cho hóa đơn này.</p>';
            const invoiceType = {
                TIEN_PHONG: 'Tiền phòng',
                DICH_VU_PHONG: 'Dịch vụ phòng',
                PHAT_SINH: 'Phát sinh',
                CU: 'Hóa đơn cá nhân'
            };
            const invoiceCards = invoices.map(invoice => {
                const invoiceId = invoice.MaHoaDon;
                const status = invoiceStatus(invoice);
                const overdue = window.AdminWorkflowUtils?.isOverdueInvoice(invoice) === true;
                const invoiceHistory = historyByInvoice.get(invoiceId) || [];
                const balance = Number(invoice.ConNo || 0);
                const period = invoice.NgayLap
                    ? date(invoice.NgayLap)
                    : invoice.KyThanhToan
                        ? date(invoice.KyThanhToan)
                    : invoice.Thang !== null && invoice.Thang !== undefined
                        && invoice.Nam !== null && invoice.Nam !== undefined
                        ? `${invoice.Thang}/${invoice.Nam}` : 'Chưa có';
                const paymentControls = balance > 0 && invoice.TrangThaiThanhToan !== 'Đã hủy'
                    ? `<div class="st-payment-controls">
                        <label class="st-payment-method-control">Phương thức thanh toán
                            <select data-payment-method aria-label="Phương thức thanh toán cho hóa đơn ${esc(invoiceId)}">
                                <option value="ONLINE">Chuyển khoản QR</option>
                                <option value="CASH">Tiền mặt tại văn phòng</option>
                            </select>
                        </label>
                        <button type="button" class="st-button st-primary" data-action="backend-invoice-pay"
                            data-id="${esc(invoiceId)}" data-max="${esc(balance)}">Thanh toán</button>
                    </div>`
                    : '';
                return `<details class="st-invoice">
                    <summary><span>${esc(invoiceId || 'Chưa có')}</span>${badge(status)}
                        <span>${esc(period)}</span><span>${money(invoice.TongTien)}</span></summary>
                    <div class="st-invoice-items">
                        ${fields([
                            ['Mã hóa đơn', invoiceId],
                            ['Loại hóa đơn', invoiceType[invoice.LoaiHoaDon] || invoice.LoaiHoaDon || 'Chưa có'],
                            ['Phòng', invoice.TenPhong],
                            ['Ngày lập', date(invoice.NgayLap)],
                            ['Hạn thanh toán', date(invoice.HanThanhToan)],
                            ['Tổng tiền', money(invoice.TongTien)],
                            ['Đã thanh toán', money(invoice.DaThu)],
                            ['Còn nợ', money(invoice.ConNo)],
                            ['Trạng thái', status]
                        ])}
                        ${overdue ? `<p class="text-sm text-red-700">Trễ hạn ${window.AdminWorkflowUtils?.overdueDays(invoice) || 0} ngày</p>` : ''}
                    </div>
                    <div class="st-invoice-payment-section">
                        ${paymentControls}
                        <div class="st-actions"><button type="button" class="st-button" data-action="backend-receipts"
                            data-id="${esc(invoiceId)}">Xem phiếu thu</button></div>
                        <h3 class="font-semibold">Lịch sử thanh toán</h3>
                        ${historyRows(invoiceHistory, invoiceId)}
                    </div>
                </details>`;
            }).join('');
            root.innerHTML = invoices.length
                ? `<div class="st-invoice-list">${invoiceCards}</div>`
                : '<article class="st-card"><h2>Hóa đơn</h2><p class="st-empty-state" role="status">Chưa có hóa đơn.</p><p class="st-muted">Hóa đơn sẽ hiển thị tại đây khi được Ban quản lý tạo. Nếu bạn cần kiểm tra khoản thu, vui lòng liên hệ quản lý ký túc xá.</p></article>';
        } catch (error) {
            if (root.isConnected) root.innerHTML = `<p class="st-notice" role="alert">${esc(error.message || 'Không thể tải hóa đơn và lịch sử thanh toán.')}</p>`;
        }
    }

    ui.pages.invoices = { title: 'Hóa đơn & Thanh toán', render: () => {
        if (window.StudentAuth?.session()?.isBackend) {
            window.setTimeout(() => loadBackendInvoices(document.getElementById('student-real-invoices')), 0);
            return '<section id="student-real-invoices" aria-live="polite"><p class="st-muted">Đang tải hóa đơn và lịch sử thanh toán...</p></section>';
        }
        sync();
        if (storageError) return `<p class="st-notice" role="alert">${esc(storageError)}</p>`;
        const summary = ui.billing.summary();
        const payable = allPayable();
        const totals = selectedTotals();
        const invoices = data.invoices.map(invoice => {
            const state = store.status(invoice);
            const debt = store.amount(invoice);
            const items = (invoice.items || []).filter(item => Number(item.amount) > 0).map(item => {
                const locked = item.status !== 'UNPAID';
                const checked = selected.has(token(invoice.id, item.id));
                return `<li class="st-invoice-item">
                    <label>
                        <input type="checkbox" data-invoice-id="${esc(invoice.id)}" data-item-id="${esc(item.id)}" ${locked ? 'disabled' : ''} ${checked ? 'checked' : ''}>
                        <span><strong>${esc(item.name)}</strong>${item.note ? `<small>${esc(item.note)}</small>` : ''}</span>
                        <span class="st-item-amount">${money(item.amount)}</span>
                        ${locked ? itemBadge(item.status) : ''}
                    </label>
                </li>`;
            }).join('');
            const invoicePayable = payableItems(invoice);
            const selectedCount = invoicePayable.filter(item => selected.has(token(invoice.id, item.id))).length;
            return `<details class="st-invoice" ${debt > 0 ? 'open' : ''}>
                <summary><span>${esc(invoice.id)} · ${esc(invoice.month)}</span>${badge(state)}<span>Còn nợ: ${money(debt)}</span>
                    <button type="button" class="st-button" data-action="invoice" data-id="${esc(invoice.id)}">Xem chi tiết</button></summary>
                ${invoicePayable.length ? `<label class="st-check-all"><input type="checkbox" data-select-invoice="${esc(invoice.id)}" ${selectedCount === invoicePayable.length && invoicePayable.length ? 'checked' : ''}> Chọn tất cả hạng mục còn thanh toán được</label>` : ''}
                <ul class="st-invoice-items">${items}</ul>
            </details>`;
        }).join('');
        return `<p class="st-demo">DEMO / SANDBOX · không giao dịch tiền thật. Dữ liệu được lưu trên trình duyệt này và dùng chung với màn hình Admin cùng địa chỉ website.</p>
        <div class="st-invoice-page">
        <div class="st-summary">${[['Tổng số tiền còn nợ', money(summary.debt)], ['Hóa đơn còn nợ', summary.unpaid]].map(([title, value]) => `<article class="st-card"><span>${title}</span><strong>${value}</strong></article>`).join('')}</div>
        <label class="st-check-all st-check-all-page"><input type="checkbox" data-select-all ${payable.length && totals.count === payable.length ? 'checked' : ''}> Chọn tất cả hạng mục còn nợ</label>
        <div class="st-invoice-list">${invoices}</div>
        <div class="st-pay-bar">
            <p data-pay-summary aria-live="polite">Đã chọn ${totals.count} hạng mục – Tổng: ${money(totals.amount)}</p>
            <div class="st-actions">
                <button type="button" class="st-button st-primary" data-action="online-step" data-pay-action ${totals.count ? '' : 'disabled'}><i class="fa-solid fa-qrcode" aria-hidden="true"></i> Thanh toán chuyển khoản QR</button>
                <p class="st-muted">Nộp tiền mặt tại văn phòng.</p>
            </div>
        </div>
        </div>` +
        card('Lịch sử thanh toán', table(['Mã GD', 'Mã HĐ', 'Hạng mục', 'Số tiền', 'Phương thức', 'Thời gian', 'Trạng thái'], data.payments.filter(p => ['SUCCESS', 'Thành công'].includes(p.status)).map(p => {
            const items = itemNames(p.items);
            return `<tr><td>${esc(p.transactionId || p.id)}</td><td>${esc(p.invoiceId)}</td><td class="st-long" title="${esc(items)}">${esc(items)}</td><td class="st-amount">${money(p.amount)}</td><td>${method(p.paymentMethod)}</td><td>${esc(time(p.paymentTime))}</td><td><span class="st-badge st-success">Hợp lệ</span></td></tr>`;
        }).join('')));
    } };
})();
