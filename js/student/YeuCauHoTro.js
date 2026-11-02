// Student: YeuCauHoTro
(() => {
    const ui = StudentUI;
    const data = ui.repository.data;
    const { esc, date, badge, card, requestTable } = ui.helpers;
    const backendStudent = () => window.StudentAuth?.session()?.isBackend;
    const requestRules = Object.freeze({
        dateRequired: type => type === 'Gia hạn hợp đồng',
        isValid: (type, content) => ['Gia hạn hợp đồng', 'Báo hỏng thiết bị', 'Yêu cầu khác'].includes(type)
            && typeof content === 'string' && Boolean(content.trim()) && content.trim().length <= 1000
    });
    ui.requestRules = requestRules;
    const guidance = type => ({
        'Gia hạn hợp đồng': 'Mô tả thời gian muốn gia hạn và chọn ngày kết thúc đề xuất. Nội dung tối đa 1.000 ký tự.',
        'Báo hỏng thiết bị': 'Ghi rõ thiết bị, vị trí và tình trạng hư hỏng. Không cần nhập ngày kết thúc.',
        'Yêu cầu khác': 'Mô tả sự việc, góp ý hoặc nội dung khác cần Quản lý hỗ trợ. Không cần nhập ngày kết thúc.'
    })[type] || 'Chọn loại yêu cầu và mô tả nội dung cần hỗ trợ.';
    const backendForm = () => `<form id="student-request-form">
        <div class="st-request-layout">
            <div class="st-request-fields">
                <label>Loại yêu cầu<select name="type" required><option>Gia hạn hợp đồng</option><option>Báo hỏng thiết bị</option><option>Yêu cầu khác</option></select></label>
                <p class="st-request-guidance-inline" data-request-guidance>${guidance('Gia hạn hợp đồng')}</p>
                <label data-extension-date>Ngày kết thúc đề xuất
                    <span class="st-date-control">
                        <input type="text" name="extensionEndDateText" maxlength="10" inputmode="numeric" placeholder="dd/mm/yyyy" autocomplete="off" aria-describedby="extension-date-error" required>
                        <button type="button" class="st-date-picker-button" data-open-date-picker aria-label="Chọn ngày kết thúc đề xuất" title="Chọn ngày"><i class="fa-regular fa-calendar" aria-hidden="true"></i></button>
                        <input class="st-native-date-picker" type="date" data-date-picker tabindex="-1" aria-hidden="true">
                    </span>
                    <input type="hidden" name="extensionEndDate">
                    <span class="st-field-error" id="extension-date-error" data-date-error aria-live="polite"></span>
                </label>
                <label>Nội dung yêu cầu<textarea name="content" rows="5" maxlength="1000" required placeholder="Nhập thời gian muốn gia hạn hoặc thiết bị, vị trí và tình trạng hư hỏng..." aria-describedby="request-content-count request-content-error"></textarea></label>
                <div class="st-request-meta"><span data-content-count id="request-content-count">0/1.000 ký tự</span><span class="st-field-error" data-content-error id="request-content-error" aria-live="polite"></span></div>
                <p class="st-muted">Nội dung tối đa 1.000 ký tự. Yêu cầu được lưu trên hệ thống để Quản lý xử lý.</p>
                <p class="st-field-error" data-form-error role="alert" aria-live="polite"></p>
                <button class="st-button st-primary" type="submit">Gửi yêu cầu</button>
            </div>
        </div>
    </form>`;
    const demoForm = () => `<form id="student-request-form">
        <div class="st-request-layout">
            <div class="st-request-fields">
                <label>Loại yêu cầu<select name="type" required><option>Gia hạn hợp đồng</option><option>Báo hỏng thiết bị</option><option>Yêu cầu khác</option></select></label>
                <p class="st-request-guidance-inline" data-request-guidance>${guidance('Gia hạn hợp đồng')}</p>
                <label data-extension-date>Ngày kết thúc đề xuất
                    <span class="st-date-control">
                        <input type="text" name="extensionEndDateText" maxlength="10" inputmode="numeric" placeholder="dd/mm/yyyy" autocomplete="off" aria-describedby="extension-date-error" required>
                        <button type="button" class="st-date-picker-button" data-open-date-picker aria-label="Chọn ngày kết thúc đề xuất" title="Chọn ngày"><i class="fa-regular fa-calendar" aria-hidden="true"></i></button>
                        <input class="st-native-date-picker" type="date" data-date-picker tabindex="-1" aria-hidden="true">
                    </span>
                    <input type="hidden" name="extensionEndDate">
                    <span class="st-field-error" id="extension-date-error" data-date-error aria-live="polite"></span>
                </label>
                <label>Nội dung yêu cầu<textarea name="content" rows="5" maxlength="1000" required placeholder="Nhập thời gian muốn gia hạn hoặc thiết bị, vị trí và tình trạng hư hỏng..." aria-describedby="request-content-count request-content-error"></textarea></label>
                <div class="st-request-meta"><span data-content-count id="request-content-count">0/1.000 ký tự</span><span class="st-field-error" data-content-error id="request-content-error" aria-live="polite"></span></div>
                <p class="st-muted">Tối đa 1.000 ký tự. Yêu cầu demo được thêm vào danh sách bên dưới.</p>
                <p class="st-field-error" data-form-error role="alert" aria-live="polite"></p>
                <button class="st-button st-primary" type="submit">Gửi yêu cầu (demo)</button>
            </div>
        </div>
    </form>`;
    const normalizeRequest = request => ({
        id: request.MaYeuCau ?? request.id,
        type: request.Loai ?? request.type,
        date: String(request.NgayTao ?? request.date ?? '').slice(0, 10),
        content: request.NoiDung ?? request.content ?? '',
        status: request.TrangThai ?? request.status,
        reply: request.PhanHoi ?? request.reply ?? ''
    });
    const setRequests = requests => {
        const rows = requests.map(normalizeRequest);
        ui.requestsById = new Map(rows.map(request => [String(request.id), request]));
        return rows;
    };
    ui.pages.requests = {
        title: 'Yêu cầu & Hỗ trợ',
        render: () => {
            const requests = setRequests(data.requests);
            return card('Tạo yêu cầu', backendStudent() ? backendForm() : demoForm()) +
                card('Yêu cầu đã gửi', backendStudent()
                    ? '<div data-student-requests><p class="st-muted" role="status">Đang tải yêu cầu...</p></div>'
                    : requestTable(requests));
        },
        detail(id) {
            const request = ui.requestsById?.get(String(id));
            if (!request) return '<p class="st-notice">Không tìm thấy yêu cầu.</p>';
            return `<dl class="st-fields">
                <div><dt>Mã yêu cầu</dt><dd>${esc(request.id || '—')}</dd></div>
                <div><dt>Loại yêu cầu</dt><dd>${esc(request.type || '—')}</dd></div>
                <div><dt>Ngày gửi</dt><dd>${esc(date(request.date))}</dd></div>
                <div><dt>Trạng thái</dt><dd>${badge(request.status)}</dd></div>
                <div class="st-request-full"><dt>Nội dung</dt><dd>${esc(request.content || '—')}</dd></div>
                <div class="st-request-full"><dt>Phản hồi</dt><dd>${esc(request.reply || 'Chưa có phản hồi')}</dd></div>
            </dl>`;
        },
        async load(root) {
            const form = root.querySelector('#student-request-form');
            const dateField = form.querySelector('[data-extension-date]');
            const dateInput = form.elements.extensionEndDateText;
            const picker = form.querySelector('[data-date-picker]');
            const isoDateInput = form.elements.extensionEndDate;
            const dateError = form.querySelector('[data-date-error]');
            const contentInput = form.elements.content;
            const contentError = form.querySelector('[data-content-error]');
            const updateCounter = () => {
                form.querySelector('[data-content-count]').textContent = `${contentInput.value.length.toLocaleString('vi-VN')}/1.000 ký tự`;
            };
            StudentDate.bindInput(dateInput);
            const updateExtensionDate = () => {
                isoDateInput.value = '';
                dateError.textContent = '';
                dateInput.setCustomValidity('');
                if (!dateInput.value.trim()) return;
                try {
                    isoDateInput.value = window.StudentDate.futureDateToIso(dateInput.value);
                } catch (error) {
                    dateInput.setCustomValidity(error.message);
                    dateError.textContent = error.message;
                }
            };
            const updateDateField = () => {
                const required = requestRules.dateRequired(form.elements.type.value);
                form.querySelector('[data-request-guidance]').textContent = guidance(form.elements.type.value);
                dateField.hidden = !required;
                dateInput.required = required;
                if (!required) {
                    dateInput.value = '';
                    picker.value = '';
                    isoDateInput.value = '';
                    dateInput.setCustomValidity('');
                    dateError.textContent = '';
                } else {
                    updateExtensionDate();
                }
            };
            form.elements.type.addEventListener('change', updateDateField);
            dateInput.addEventListener('input', updateExtensionDate);
            dateInput.addEventListener('blur', updateExtensionDate);
            picker.addEventListener('change', () => {
                if (!picker.value) return;
                dateInput.value = StudentDate.formatIso(picker.value);
                updateExtensionDate();
            });
            form.querySelector('[data-open-date-picker]').addEventListener('click', () => {
                if (typeof picker.showPicker === 'function') picker.showPicker();
                else picker.focus();
            });
            contentInput.addEventListener('input', () => {
                contentError.textContent = '';
                updateCounter();
            });
            form.addEventListener('submit', event => {
                updateExtensionDate();
                contentError.textContent = '';
                if (!contentInput.value.trim()) {
                    event.preventDefault();
                    contentError.textContent = 'Vui lòng nhập nội dung yêu cầu.';
                    contentInput.focus();
                } else if (contentInput.value.length > 1000) {
                    event.preventDefault();
                    contentError.textContent = 'Nội dung không được vượt quá 1.000 ký tự.';
                } else if (form.elements.type.value === 'Gia hạn hợp đồng' && !isoDateInput.value) {
                    event.preventDefault();
                    dateInput.reportValidity();
                }
            }, true);
            updateDateField();
            updateCounter();
            if (!backendStudent()) return;
            const content = root.querySelector('[data-student-requests]');
            try {
                const response = await ApiClient.fetch('/api/student/requests');
                const result = await response.json();
                if (!root.isConnected) return;
                if (!Array.isArray(result)) throw new Error('Dữ liệu yêu cầu không hợp lệ.');
                const requests = setRequests(result);
                content.innerHTML = requests.length
                    ? requestTable(requests)
                    : '<p class="st-empty-state" role="status">Chưa có yêu cầu nào.</p><p class="st-muted">Bạn có thể gửi yêu cầu bằng biểu mẫu phía trên nếu cần hỗ trợ.</p>';
            } catch (error) {
                if (root.isConnected) content.innerHTML = `<p class="st-notice" role="alert">${esc(error.message || 'Không thể tải yêu cầu.')}</p>`;
            }
        }
    };
})();
