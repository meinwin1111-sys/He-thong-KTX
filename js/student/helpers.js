(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = value => {
        if (value === null || value === undefined || value === '') return '—';
        const amount = Number(value);
        return Number.isFinite(amount)
            ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)}\u00a0đ`
            : '—';
    };
    const date = value => {
        const input = String(value ?? '').trim();
        if (!input) return '—';
        const shared = window.AdminWorkflowUtils?.date(input.slice(0, 10), 'format');
        if (shared) return shared;
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.slice(0, 10));
        if (!match) return '—';
        const [, year, month, day] = match;
        return `${day}/${month}/${year}`;
    };
    const total = invoice => Array.isArray(invoice.items)
        ? invoice.items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : Number(invoice.room) + Number(invoice.electricity) + Number(invoice.water);
    const badge = status => {
        const value = String(status ?? '').trim() || '—';
        const tone = ['Đã duyệt', 'Đã thanh toán', 'Đang hiệu lực', 'Đã xử lý', 'Hoàn tất'].includes(value)
            ? 'st-success'
            : ['Từ chối', 'Đã hủy', 'Đã huỷ'].includes(value)
                ? 'st-neutral'
                : ['Chờ xác nhận', 'Cần đối soát', 'Còn nợ', 'Chờ duyệt', 'Chờ xử lý', 'Quá hạn'].includes(value)
                    ? 'st-warning'
                    : 'st-neutral';
        return `<span class="st-badge ${tone}">${esc(value)}</span>`;
    };
    const fields = entries => `<dl class="st-fields">${entries.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value === null || value === undefined || value === '' ? '—' : value)}</dd></div>`).join('')}</dl>`;
    const card = (title, content) => `<article class="st-card"><h2>${title}</h2>${content}</article>`;
    const table = (headers, rows) => `<div class="st-table-wrap"><table><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="st-empty">Chưa có dữ liệu.</td></tr>`}</tbody></table></div>`;
    const requestTable = rows => table(['Mã yêu cầu', 'Loại yêu cầu', 'Ngày gửi', 'Nội dung', 'Trạng thái', 'Phản hồi', 'Chi tiết'], rows.map(r => `<tr><td>${esc(r.id || '—')}</td><td>${esc(r.type || '—')}</td><td>${date(r.date)}</td><td class="st-long" title="${esc(r.content || '—')}">${esc(r.content || '—')}</td><td>${badge(r.status)}</td><td class="st-long" title="${esc(r.reply || 'Chưa có phản hồi')}">${esc(r.reply || 'Chưa có phản hồi')}</td><td><button type="button" class="st-button st-request-detail" data-action="request-detail" data-id="${esc(r.id)}">Xem</button></td></tr>`).join(''));
    const calendarDay = value => {
        const [year, month, day] = value.split('-').map(Number);
        return Date.UTC(year, month - 1, day) / 86400000;
    };
    const remaining = () => {
        const now = new Date();
        return calendarDay(data.contract.end) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
    };
    const contractStatus = () => remaining() < 0 ? 'Hợp đồng đã hết hạn' : remaining() <= 30 ? 'Sắp hết hạn' : 'Đang hiệu lực';
    const contractTerm = () => `${calendarDay(data.contract.end) - calendarDay(data.contract.start) + 1} ngày (tính cả ngày bắt đầu và kết thúc)`;
    const contractWarning = () => remaining() <= 30 ? `<p class="st-notice ${remaining() < 0 ? 'st-contract-expired' : ''}" role="status">${remaining() < 0 ? 'Hợp đồng đã hết hạn' : `Hợp đồng lưu trú của bạn sắp hết hạn vào ngày ${esc(date(data.contract.end))}. Còn ${remaining()} ngày.`} <a href="#requests">Gửi yêu cầu gia hạn tại Yêu cầu &amp; Hỗ trợ</a>.</p>` : '';
    ui.helpers = { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning, contractStatus, contractTerm, remaining };
    ui.routeFromHash = (hash, pages = ui.pages) => {
        const route = String(hash || '').replace(/^#/, '');
        return Object.hasOwn(pages, route) ? route : 'home';
    };
    ui.pages = {};
})();
