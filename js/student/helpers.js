(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = value => value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    const date = value => value.split('-').reverse().join('/');
    const total = invoice => invoice.room + invoice.electricity + invoice.water;
    const badge = status => `<span class="st-badge ${['Đã duyệt', 'Đã thanh toán', 'Đang hiệu lực'].includes(status) ? 'st-success' : status === 'Từ chối' ? 'st-danger' : 'st-warning'}">${esc(status)}</span>`;
    const fields = entries => `<dl class="st-fields">${entries.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
    const card = (title, content) => `<article class="st-card"><h2>${title}</h2>${content}</article>`;
    const table = (headers, rows) => `<div class="st-table-wrap"><table><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="st-empty">Chưa có dữ liệu.</td></tr>`}</tbody></table></div>`;
    const requestTable = rows => table(['Mã yêu cầu', 'Loại yêu cầu', 'Ngày gửi', 'Nội dung', 'Trạng thái', 'Phản hồi'], rows.map(r => `<tr><td>${esc(r.id)}</td><td>${esc(r.type)}</td><td>${date(r.date)}</td><td class="st-long">${esc(r.content)}</td><td>${badge(r.status)}</td><td class="st-long">${esc(r.reply || 'Chưa có phản hồi')}</td></tr>`).join(''));
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
    ui.pages = {};
})();
