// Student: YeuCauHoTro
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    ui.pages.requests = { title: 'Yêu cầu & Hỗ trợ', render: () => card('Tạo yêu cầu', `<form id="student-request-form"><label>Loại yêu cầu<select name="type" required><option>Gia hạn hợp đồng</option><option>Báo hỏng thiết bị</option></select></label><label>Nội dung yêu cầu<textarea name="content" rows="4" maxlength="1000" required placeholder="Nhập thời gian muốn gia hạn hoặc thiết bị, vị trí và tình trạng hư hỏng..."></textarea></label><p class="st-muted">Tối đa 1.000 ký tự. Yêu cầu demo được thêm vào danh sách bên dưới.</p><button class="st-button st-primary" type="submit">Gửi yêu cầu (demo)</button></form>`) + card('Yêu cầu đã gửi', requestTable(data.requests)) };
})();
