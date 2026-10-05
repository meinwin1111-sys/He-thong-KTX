// Student: YeuCauHoTro
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, money, date, total, badge, fields, card, table, requestTable, contractWarning } = ui.helpers;

    const backendStudent = () => window.StudentAuth?.session()?.isBackend;
    const backendForm = () => `<form id="student-request-form">
        <label>Loại yêu cầu<select name="type" required><option>Gia hạn hợp đồng</option><option>Báo hỏng thiết bị</option></select></label>
        <label data-extension-date>Ngày kết thúc đề xuất<input type="text" name="extensionEndDateText" maxlength="10" inputmode="numeric" placeholder="dd/mm/yyyy" autocomplete="off" required><input type="hidden" name="extensionEndDate"></label>
        <label>Nội dung yêu cầu<textarea name="content" rows="4" maxlength="1000" required placeholder="Nhập thời gian muốn gia hạn hoặc thiết bị, vị trí và tình trạng hư hỏng..."></textarea></label>
        <p class="st-muted">Nội dung tối đa 1.000 ký tự. Yêu cầu được lưu trên hệ thống để Quản lý xử lý.</p>
        <button class="st-button st-primary" type="submit">Gửi yêu cầu</button>
    </form>`;
    const demoForm = () => `<form id="student-request-form"><label>Loại yêu cầu<select name="type" required><option>Gia hạn hợp đồng</option><option>Báo hỏng thiết bị</option></select></label><label>Nội dung yêu cầu<textarea name="content" rows="4" maxlength="1000" required placeholder="Nhập thời gian muốn gia hạn hoặc thiết bị, vị trí và tình trạng hư hỏng..."></textarea></label><p class="st-muted">Tối đa 1.000 ký tự. Yêu cầu demo được thêm vào danh sách bên dưới.</p><button class="st-button st-primary" type="submit">Gửi yêu cầu (demo)</button></form>`;

    ui.pages.requests = {
        title: 'Yêu cầu & Hỗ trợ',
        render: () => backendStudent()
            ? card('Tạo yêu cầu', backendForm()) +
                card('Yêu cầu đã gửi', '<div data-student-requests><p class="st-muted" role="status">Đang tải yêu cầu...</p></div>')
            : card('Tạo yêu cầu', demoForm()) + card('Yêu cầu đã gửi', requestTable(data.requests)),
        async load(root) {
            if (!backendStudent()) return;
            const content = root.querySelector('[data-student-requests]');
            const form = root.querySelector('#student-request-form');
            const dateField = form.querySelector('[data-extension-date]');
            const dateInput = form.elements.extensionEndDateText;
            const isoDateInput = form.elements.extensionEndDate;
            const updateExtensionDate = () => {
                isoDateInput.value = '';
                if (!dateInput.value.trim()) {
                    dateInput.setCustomValidity('');
                    return;
                }
                try {
                    isoDateInput.value = window.StudentDate.futureDateToIso(dateInput.value);
                    dateInput.setCustomValidity('');
                } catch (error) {
                    dateInput.setCustomValidity(error.message);
                }
            };
            const updateDateField = () => {
                const required = form.elements.type.value === 'Gia hạn hợp đồng';
                dateField.hidden = !required;
                dateInput.required = required;
                if (!required) {
                    dateInput.value = '';
                    isoDateInput.value = '';
                    dateInput.setCustomValidity('');
                } else {
                    updateExtensionDate();
                }
            };
            form.elements.type.addEventListener('change', updateDateField);
            dateInput.addEventListener('input', updateExtensionDate);
            form.addEventListener('submit', event => {
                updateExtensionDate();
                if (form.elements.type.value === 'Gia hạn hợp đồng' && !isoDateInput.value) {
                    event.preventDefault();
                    dateInput.reportValidity();
                }
            }, true);
            updateDateField();
            try {
                const response = await ApiClient.fetch('/api/student/requests');
                const result = await response.json();
                if (!root.isConnected) return;
                if (!Array.isArray(result)) throw new Error('Dữ liệu yêu cầu không hợp lệ.');
                content.innerHTML = result.length ? requestTable(result.map(request => ({
                    id: request.MaYeuCau,
                    type: request.Loai,
                    date: String(request.NgayTao).slice(0, 10),
                    content: request.NoiDung,
                    status: request.TrangThai,
                    reply: request.PhanHoi
                }))) : '<p class="st-empty-state" role="status">Chưa có yêu cầu nào.</p><p class="st-muted">Bạn có thể gửi yêu cầu bằng biểu mẫu phía trên nếu cần hỗ trợ.</p>';
            } catch (error) {
                if (root.isConnected) content.innerHTML = `<p class="st-notice" role="alert">${esc(error.message || 'Không thể tải yêu cầu.')}</p>`;
            }
        }
    };
})();
