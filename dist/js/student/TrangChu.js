// Student: TrangChu
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    const backendStudent = () => window.StudentAuth?.session()?.isBackend;
    const formatDate = value => value ? date(String(value).slice(0, 10)) : 'Chưa có dữ liệu';
    const renderBackendDashboard = () => `<div class="student-home-dashboard">
        <section class="sh-welcome"><div><h2>Xin chào, ${esc(data.profile?.name || 'Sinh viên')} 👋</h2><p>Đây là thông tin lưu trú của bạn tại Ký túc xá.</p></div><div class="sh-welcome-art"><blockquote>“Chúc bạn có một năm học thật nhiều trải nghiệm và thành công!”</blockquote><img src="files/campus-dashboard.svg" alt="" aria-hidden="true"></div></section>
        <p data-dashboard-error class="st-notice" role="alert"></p>
        <div class="sh-overview">
            <a class="sh-stat sh-stat-0" href="#room"><span class="sh-icon"><i class="fa-solid fa-bed" aria-hidden="true"></i></span><div class="sh-stat-copy"><span>Phòng hiện tại</span><strong data-dashboard-room>Đang tải...</strong><span class="sh-status" data-dashboard-room-hint></span><small>Xem chi tiết →</small></div><i class="fa-solid fa-bed sh-watermark" aria-hidden="true"></i></a>
            <a class="sh-stat sh-stat-1" href="#contract"><span class="sh-icon"><i class="fa-solid fa-file-contract" aria-hidden="true"></i></span><div class="sh-stat-copy"><span>Hợp đồng</span><strong data-dashboard-contract>Đang tải...</strong><span class="sh-status" data-dashboard-contract-hint></span><small>Xem chi tiết →</small></div><i class="fa-solid fa-file-contract sh-watermark" aria-hidden="true"></i></a>
            <a class="sh-stat sh-stat-2" href="#invoices"><span class="sh-icon"><i class="fa-solid fa-file-invoice" aria-hidden="true"></i></span><div class="sh-stat-copy"><span>Hóa đơn chưa thanh toán</span><strong data-dashboard-unpaid>Đang tải...</strong><span class="sh-status" data-dashboard-unpaid-hint></span><small>Xem chi tiết →</small></div><i class="fa-solid fa-file-invoice sh-watermark" aria-hidden="true"></i></a>
            <a class="sh-stat sh-stat-3" href="#invoices"><span class="sh-icon"><i class="fa-solid fa-wallet" aria-hidden="true"></i></span><div class="sh-stat-copy"><span>Công nợ</span><strong data-dashboard-debt>Đang tải...</strong><span class="sh-status" data-dashboard-debt-hint></span><small>Xem chi tiết →</small></div><i class="fa-solid fa-wallet sh-watermark" aria-hidden="true"></i></a>
        </div>
        <p data-dashboard-contract-warning></p><p data-dashboard-overdue></p>
        <div class="sh-columns">
            <section class="sh-panel"><div class="sh-panel-title"><h2><i class="fa-solid fa-bell" aria-hidden="true"></i> Thông báo thanh toán</h2><small>Dựa trên giao dịch thành công</small></div>
                <ul class="sh-announcements" data-student-payment-notices><li class="st-muted">Đang tải thông tin thanh toán…</li></ul>
            </section>
            <section class="sh-panel"><h2><i class="fa-solid fa-house" aria-hidden="true"></i> Thông tin lưu trú</h2>
                <dl class="sh-residence">
                    <div><dt>Phòng hiện tại</dt><dd data-dashboard-room-detail>Đang tải...</dd></div>
                    <div><dt>Khu/Tòa</dt><dd data-dashboard-building>Đang tải...</dd></div>
                    <div><dt>Đang ở / Sức chứa</dt><dd data-dashboard-occupancy>Đang tải...</dd></div>
                    <div><dt>Ngày bắt đầu</dt><dd data-dashboard-contract-start>Đang tải...</dd></div>
                    <div><dt>Hợp đồng đến</dt><dd data-dashboard-contract-end>Đang tải...</dd></div>
                    <div><dt>Trạng thái hợp đồng</dt><dd data-dashboard-contract-status>Đang tải...</dd></div>
                    <div><dt>Công nợ</dt><dd data-dashboard-debt-detail>Đang tải...</dd></div>
                </dl>
                <div class="sh-links"><a href="#room">Xem phòng</a><a href="#contract">Xem hợp đồng</a><a href="#invoices">Xem hóa đơn</a></div>
                <section class="sh-shared-content" aria-label="Thông tin chung ký túc xá">
                    <h3>Nội quy ký túc xá</h3><ul data-student-rules><li class="st-muted">Đang tải nội quy…</li></ul>
                    <h3>Liên hệ hỗ trợ</h3><dl data-student-contact><div><dt>Thông tin</dt><dd>Đang tải…</dd></div></dl>
                </section>
            </section>
        </div>
    </div>`;

    ui.pages.home = { title: 'Trang chủ', render: () => {
        if (backendStudent()) return renderBackendDashboard();
        const room = data.room;
        const contract = data.contract;
        const summary = ui.billing.summary();
        const unpaid = summary.unpaid;
        const debt = summary.debt;
        const hasContract = Boolean(contract?.id && contract?.end);
        const days = hasContract ? ui.helpers.remaining() : null;
        const status = hasContract ? ui.helpers.contractStatus() : 'Chưa có hợp đồng';
        const roomLabel = room?.number || 'Chưa được xếp phòng';
        const warning = hasContract && days <= 30 ? `<p class="st-notice ${days < 0 ? 'st-contract-expired' : ''}" role="status">⚠ ${days < 0 ? 'Hợp đồng lưu trú của bạn đã hết hạn.' : `Hợp đồng lưu trú của bạn sắp hết hạn vào ngày ${esc(date(contract.end))}. Còn ${days} ngày.`} <a href="#contract">Xem hợp đồng →</a></p>` : '';
        const overdue = summary.overdue;
        return `<div class="student-home-dashboard">
            <section class="sh-welcome"><div><h2>Xin chào, ${esc(data.profile?.name || 'Sinh viên')} 👋</h2><p>Đây là thông tin lưu trú của bạn tại Ký túc xá.</p></div><div class="sh-welcome-art"><blockquote>“Chúc bạn có một năm học thật nhiều trải nghiệm và thành công!”</blockquote><img src="files/campus-dashboard.svg" alt="" aria-hidden="true"></div></section>
            <div class="sh-overview">${[
                ['Phòng hiện tại', roomLabel, 'room', 'fa-bed'],
                ['Hợp đồng', status, 'contract', 'fa-file-contract'],
                ['Hóa đơn chưa thanh toán', `${unpaid} hóa đơn`, 'invoices', 'fa-file-invoice'],
                ['Công nợ', money(debt), 'invoices', 'fa-wallet']
            ].map(([label, value, route, icon], index) => {
                const hints = [room?.number ? 'Đang ở' : 'Chưa xếp phòng', hasContract ? (days < 0 ? 'Đã hết hạn' : `Còn ${days} ngày`) : 'Chưa có hợp đồng', overdue ? `${overdue} hóa đơn quá hạn` : unpaid ? 'Chờ thanh toán' : 'Đã thanh toán đủ', debt > 0 ? 'Cần thanh toán' : 'Không có công nợ'];
                return `<a class="sh-stat sh-stat-${index}" href="#${route}"><span class="sh-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><div class="sh-stat-copy"><span>${label}</span><strong>${esc(value)}</strong><span class="sh-status ${(index === 2 && overdue) || (index === 3 && debt > 0) || (index === 1 && days < 0) ? 'sh-status-danger' : index === 1 && hasContract && days <= 30 ? 'sh-status-warning' : ''}">${esc(hints[index])}</span><small>Xem chi tiết →</small></div><i class="fa-solid ${icon} sh-watermark" aria-hidden="true"></i></a>`;
            }).join('')}</div>
            ${warning}
            ${overdue ? `<p class="st-notice sh-overdue" role="status">⚠ Bạn có ${overdue} hóa đơn quá hạn thanh toán. <a href="#invoices">Xem hóa đơn →</a></p>` : ''}
            <div class="sh-columns">
                <section class="sh-panel"><div class="sh-panel-title"><h2><i class="fa-solid fa-bell" aria-hidden="true"></i> Thông báo thanh toán</h2><small>Dựa trên giao dịch thành công</small></div>
                    <ul class="sh-announcements" data-student-payment-notices><li class="st-muted">Đang tải thông tin thanh toán…</li></ul>
                </section>
                <section class="sh-panel"><h2><i class="fa-solid fa-house" aria-hidden="true"></i> Thông tin lưu trú</h2>
                    <dl class="sh-residence">${[
                        ['Phòng hiện tại', roomLabel], ['Khu/Tòa', room?.building || 'Chưa có thông tin'],
                        ['Đang ở / Sức chứa', room ? `${Array.isArray(room.members) ? room.members.length : 0} / ${room.capacity ?? '—'}` : 'Chưa được xếp phòng'],
                        ['Ngày bắt đầu', contract?.start ? date(contract.start) : 'Chưa có hợp đồng'],
                        ['Hợp đồng đến', hasContract ? date(contract.end) : 'Chưa có hợp đồng'],
                        ['Trạng thái hợp đồng', status], ['Công nợ', debt > 0 ? `Còn nợ ${money(debt)}` : 'Không có công nợ']
                    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
                    <div class="sh-links"><a href="#room">Xem phòng</a><a href="#contract">Xem hợp đồng</a><a href="#invoices">Xem hóa đơn</a></div>
                    <section class="sh-shared-content" aria-label="Thông tin chung ký túc xá">
                        <h3>Nội quy ký túc xá</h3>
                        <ul data-student-rules><li class="st-muted">Đang tải nội quy…</li></ul>
                        <h3>Liên hệ hỗ trợ</h3>
                        <dl data-student-contact><div><dt>Thông tin</dt><dd>Đang tải…</dd></div></dl>
                    </section>
                </section>
            </div>
        </div>`;
    }, async load(root) {
        if (!backendStudent()) return;
        const set = (selector, value) => {
            const node = root.querySelector(selector);
            if (node) node.textContent = value;
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
            const room = roomData.room;
            const currentContract = contracts.find(item => item.TrangThaiHopDong === 'Còn hiệu lực') || contracts[0] || null;
            const unpaidInvoices = invoices.filter(invoice => Number(invoice.ConNo || 0) > 0);
            const debt = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.ConNo || 0), 0);
            const today = new Date().toISOString().slice(0, 10);
            const overdueInvoices = unpaidInvoices.filter(invoice => invoice.HanThanhToan
                && String(invoice.HanThanhToan).slice(0, 10) < today).length;
            const endDate = currentContract?.NgayKetThuc ? String(currentContract.NgayKetThuc).slice(0, 10) : '';
            const daysRemaining = endDate
                ? Math.ceil((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
                : null;
            const contractStatus = currentContract
                ? daysRemaining < 0 ? 'Hợp đồng đã hết hạn' : daysRemaining <= 30 ? 'Sắp hết hạn' : currentContract.TrangThaiHopDong
                : 'Chưa có hợp đồng';
            const roomLabel = room?.TenPhong || 'Chưa được xếp phòng';
            set('[data-dashboard-room]', roomLabel);
            set('[data-dashboard-room-hint]', room ? room.TrangThaiPhong : 'Chưa xếp phòng');
            set('[data-dashboard-contract]', contractStatus);
            set('[data-dashboard-contract-hint]', daysRemaining == null ? 'Chưa có hợp đồng' : daysRemaining < 0 ? 'Đã hết hạn' : `Còn ${daysRemaining} ngày`);
            set('[data-dashboard-unpaid]', `${unpaidInvoices.length} hóa đơn`);
            set('[data-dashboard-unpaid-hint]', overdueInvoices ? `${overdueInvoices} hóa đơn quá hạn` : unpaidInvoices.length ? 'Chờ thanh toán' : 'Đã thanh toán đủ');
            set('[data-dashboard-debt]', money(debt));
            set('[data-dashboard-debt-hint]', debt > 0 ? 'Cần thanh toán' : 'Không có công nợ');
            set('[data-dashboard-room-detail]', roomLabel);
            set('[data-dashboard-building]', room ? `Khu ${room.Khu}` : 'Chưa có thông tin');
            set('[data-dashboard-occupancy]', room ? `${room.SoSinhVienHienTai} / ${room.SucChuaToiDa}` : 'Chưa được xếp phòng');
            set('[data-dashboard-contract-start]', currentContract ? formatDate(currentContract.NgayBatDau) : 'Chưa có hợp đồng');
            set('[data-dashboard-contract-end]', currentContract ? formatDate(currentContract.NgayKetThuc) : 'Chưa có hợp đồng');
            set('[data-dashboard-contract-status]', contractStatus);
            set('[data-dashboard-debt-detail]', debt > 0 ? `Còn nợ ${money(debt)}` : 'Không có công nợ');
            set('[data-dashboard-contract-warning]', daysRemaining != null && daysRemaining <= 30
                ? `⚠ Hợp đồng lưu trú ${daysRemaining < 0 ? 'đã hết hạn' : `sắp hết hạn vào ngày ${formatDate(endDate)} (${daysRemaining} ngày)`}.`
                : '');
            set('[data-dashboard-overdue]', overdueInvoices ? `⚠ Bạn có ${overdueInvoices} hóa đơn quá hạn thanh toán.` : '');
        } catch (error) {
            if (root.isConnected) set('[data-dashboard-error]', error.message || 'Không thể tải thông tin lưu trú và hóa đơn.');
        }
    } };
})();
