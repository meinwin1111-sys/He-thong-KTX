// Student: TrangChu
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    // Thông báo chung mẫu, không phải dữ liệu cá nhân hoặc thông báo từ API.
    const announcements = [
        { type: 'Học phí & lệ phí', title: 'Thông báo đóng phí KTX tháng 10/2026', date: '2026-09-28', description: 'Vui lòng kiểm tra hóa đơn và hạn thanh toán tại mục Hóa đơn & Thanh toán.' },
        { type: 'Lưu trú', title: 'Lịch kiểm tra phòng định kỳ', date: '2026-09-26', description: 'Sinh viên giữ vệ sinh phòng và phối hợp với ban quản lý trong đợt kiểm tra.' },
        { type: 'Bảo trì', title: 'Thông báo bảo trì điện/nước', date: '2026-09-24', description: 'Theo dõi thông báo tại tòa nhà để chủ động sắp xếp sinh hoạt.' },
        { type: 'Nội quy', title: 'Cập nhật nội quy KTX', date: '2026-09-22', description: 'Thực hiện đúng giờ giới nghiêm và các quy định an toàn trong khu lưu trú.' }
    ];
    ui.pages.home = { title: 'Trang chủ', render: () => {
        const room = data.room;
        const contract = data.contract;
        const invoices = Array.isArray(data.invoices) ? data.invoices : [];
        const unpaid = invoices.filter(invoice => !invoice.paid);
        const debt = unpaid.reduce((sum, invoice) => sum + total(invoice), 0);
        const hasContract = Boolean(contract?.id && contract?.end);
        const days = hasContract ? ui.helpers.remaining() : null;
        const status = hasContract ? ui.helpers.contractStatus() : 'Chưa có hợp đồng';
        const roomLabel = room?.number || 'Chưa được xếp phòng';
        const warning = hasContract && days <= 30 ? `<p class="st-notice ${days < 0 ? 'st-contract-expired' : ''}" role="status">⚠ ${days < 0 ? 'Hợp đồng lưu trú của bạn đã hết hạn.' : `Hợp đồng lưu trú của bạn sắp hết hạn vào ngày ${esc(date(contract.end))}. Còn ${days} ngày.`} <a href="#contract">Xem hợp đồng →</a></p>` : '';
        const overdue = unpaid.filter(invoice => invoice.due && new Date(`${invoice.due}T23:59:59.999`) < new Date()).length;
        return `<div class="student-home-dashboard">
            <section class="sh-welcome"><div><h2>Xin chào, ${esc(data.profile?.name || 'Sinh viên')} 👋</h2><p>Đây là thông tin lưu trú của bạn tại Ký túc xá.</p></div><div class="sh-welcome-art"><blockquote>“Chúc bạn có một năm học thật nhiều trải nghiệm và thành công!”</blockquote><img src="files/campus-dashboard.svg" alt="" aria-hidden="true"></div></section>
            <div class="sh-overview">${[
                ['Phòng hiện tại', roomLabel, 'room', 'fa-bed'],
                ['Hợp đồng', status, 'contract', 'fa-file-contract'],
                ['Hóa đơn chưa thanh toán', `${unpaid.length} hóa đơn`, 'invoices', 'fa-file-invoice'],
                ['Công nợ', money(debt), 'invoices', 'fa-wallet']
            ].map(([label, value, route, icon], index) => {
                const hints = [room?.number ? 'Đang ở' : 'Chưa xếp phòng', hasContract ? (days < 0 ? 'Đã hết hạn' : `Còn ${days} ngày`) : 'Chưa có hợp đồng', overdue ? `${overdue} hóa đơn quá hạn` : unpaid.length ? 'Chờ thanh toán' : 'Đã thanh toán đủ', debt > 0 ? 'Cần thanh toán' : 'Không có công nợ'];
                return `<a class="sh-stat sh-stat-${index}" href="#${route}"><span class="sh-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><div class="sh-stat-copy"><span>${label}</span><strong>${esc(value)}</strong><span class="sh-status ${(index === 2 && overdue) || (index === 3 && debt > 0) || (index === 1 && days < 0) ? 'sh-status-danger' : index === 1 && hasContract && days <= 30 ? 'sh-status-warning' : ''}">${esc(hints[index])}</span><small>Xem chi tiết →</small></div><i class="fa-solid ${icon} sh-watermark" aria-hidden="true"></i></a>`;
            }).join('')}</div>
            ${warning}
            ${overdue ? `<p class="st-notice sh-overdue" role="status">⚠ Bạn có ${overdue} hóa đơn quá hạn thanh toán. <a href="#invoices">Xem hóa đơn →</a></p>` : ''}
            <div class="sh-columns">
                <section class="sh-panel"><div class="sh-panel-title"><h2><i class="fa-solid fa-bell" aria-hidden="true"></i> Thông báo KTX</h2><small>Thông báo mẫu</small></div>
                    <ul class="sh-announcements">${announcements.map((item, index) => `<li><span class="sh-news-icon sh-news-${index}"><i class="fa-solid ${['fa-bullhorn', 'fa-calendar-days', 'fa-screwdriver-wrench', 'fa-file-lines'][index]}" aria-hidden="true"></i></span><div class="sh-news-content"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p></div><div class="sh-announcement-meta"><time datetime="${item.date}">${date(item.date)}</time><span>${esc(item.type)}</span></div></li>`).join('')}</ul>
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
                </section>
            </div>
        </div>`;
    } };
})();
