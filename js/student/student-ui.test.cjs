const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const adminUtils = require('../module/AdminWorkflowUtils');

const root = resolve(__dirname, '../..');
const load = path => readFileSync(resolve(root, path), 'utf8');
const data = {
    profile: { code: 'SV001', name: 'Sinh viên thử nghiệm' },
    room: null,
    contract: null,
    invoices: [],
    requests: []
};
const ui = {
    repository: { data },
    billing: { summary: () => ({ unpaid: 0, debt: 0 }) }
};
const context = {
    StudentUI: ui,
    Intl,
    Date,
    Number,
    String,
    Array,
    Map,
    Object,
    RegExp,
    window: null,
    StudentIdentity: require('../student-identity'),
    AdminWorkflowUtils: {
        date(value, mode) {
            const input = String(value || '');
            if (mode === 'parse') {
                const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
                return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
            }
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
            return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
        }
    }
};
context.window = context;
let backendStudent = false;
context.StudentAuth = { session: () => ({ isBackend: backendStudent }) };

vm.runInNewContext(load('js/student/helpers.js'), context, { filename: 'helpers.js' });
vm.runInNewContext(load('js/student/BangTree.js'), context, { filename: 'BangTree.js' });
vm.runInNewContext(load('js/student/TrangChu.js'), context, { filename: 'TrangChu.js' });
vm.runInNewContext(load('js/student/YeuCauHoTro.js'), context, { filename: 'YeuCauHoTro.js' });

test('formats VND with a non-breaking space', () => {
    assert.equal(ui.helpers.money(1200000), '1.200.000\u00a0đ');
});

test('Admin date inputs keep raw digits while typing and normalize on blur', () => {
    const dom = new JSDOM('<body><label><input data-admin-date maxlength="10" required><span data-date-error></span></label></body>');
    const input = dom.window.document.querySelector('input');
    const adminDates = require('../module/AdminWorkflowUtils');
    adminDates.bindDateInputs(dom.window.document.body);
    let expected = '';
    for (const digit of '02112026') {
        input.setRangeText(digit, input.selectionStart, input.selectionEnd, 'end');
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        expected += digit;
        assert.equal(input.value, expected);
        assert.equal(input.selectionStart, expected.length);
    }
    assert.equal(input.value, '02112026');
    assert.equal(input.closest('label').querySelector('[data-date-error]').textContent, '');
    input.dispatchEvent(new dom.window.Event('focusout', { bubbles: true }));
    assert.equal(input.value, '02/11/2026');
    input.value = '11112005';
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true, cancelable: true
    }));
    assert.equal(input.value, '11/11/2005');
    dom.window.close();
});

test('shared date input uses native editing until blur, then normalizes calendar dates and rejects invalid dates', () => {
    const dom = new JSDOM(`
        <body><label>
            <span><input data-admin-date maxlength="10"><button type="button" data-action="date-picker-open"></button>
                <input type="date" data-date-picker></span>
            <span data-date-error></span>
        </label></body>`, { url: 'http://localhost/' });
    const input = dom.window.document.querySelector('[data-admin-date]');
    const utility = require('../module/AdminWorkflowUtils');
    utility.bindDateInputs(dom.window.document.body);
    const edit = (value, inserted, start = value.selectionStart, end = value.selectionEnd) => {
        value.setRangeText(inserted, start, end, 'end');
        value.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        return value.selectionStart;
    };
    const typeEach = (value, text) => {
        let expected = value.value;
        let start = value.selectionStart;
        let end = value.selectionEnd;
        for (const digit of text) {
            const allowed = value.value.length - (end - start) < Number(value.maxLength);
            if (allowed) {
                const caret = start;
                edit(value, digit);
                expected = `${expected.slice(0, start)}${digit}${expected.slice(end)}`;
                start = caret + 1;
                end = start;
            }
            assert.equal(value.value, expected);
            if (allowed) {
                assert.equal(value.selectionStart, start);
                assert.equal(value.selectionEnd, end);
            }
        }
    };
    input.required = true;
    let expected = '';
    for (const digit of '10112005') {
        edit(input, digit);
        expected += digit;
        assert.equal(input.value, expected);
        assert.equal(input.selectionStart, expected.length);
        assert.equal(dom.window.document.querySelector('[data-date-error]').textContent, '');
    }
    edit(input, '1');
    assert.equal(input.value, '101120051');
    edit(input, '2');
    assert.equal(input.value, '1011200512');
    const beyondLimit = edit(input, '3');
    assert.equal(input.value, '1011200512');
    assert.equal(beyondLimit, 10);
    input.dispatchEvent(new dom.window.Event('focusout', { bubbles: true }));
    assert.equal(input.value, '1011200512');
    assert.equal(dom.window.document.querySelector('[data-date-error]').textContent, 'Ngày không hợp lệ');

    input.value = '';
    input.setSelectionRange(0, 0);
    expected = '';
    for (const character of '1/2/2005') {
        edit(input, character);
        expected += character;
        assert.equal(input.value, expected);
        assert.equal(input.selectionStart, expected.length);
    }
    input.dispatchEvent(new dom.window.Event('focusout', { bubbles: true }));
    assert.equal(input.value, '01/02/2005');

    input.value = '12345678';
    input.setSelectionRange(4, 4);
    edit(input, '9');
    assert.equal(input.value, '123495678');
    assert.equal(input.selectionStart, 5);
    input.setSelectionRange(3, 3);
    input.setRangeText('', 2, 3, 'start');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(input.value, '12495678');
    assert.equal(input.selectionStart, 2);
    input.setSelectionRange(2, 2);
    input.setRangeText('', 2, 3, 'start');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(input.value, '1295678');
    assert.equal(input.selectionStart, 2);

    input.value = '10/11/2005';
    input.setSelectionRange(3, 3);
    input.setRangeText('', 2, 3, 'start');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(input.value, '1011/2005');
    assert.equal(input.selectionStart, 2);
    input.setSelectionRange(4, 4);
    input.setRangeText('', 4, 5, 'start');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(input.value, '10112005');
    assert.equal(input.selectionStart, 4);

    input.value = '10/11/2005';
    input.setSelectionRange(0, input.value.length);
    typeEach(input, '10112005');
    assert.equal(input.value, '10112005');
    input.setSelectionRange(0, input.value.length);
    input.setRangeText('1/2/2005', 0, input.value.length, 'end');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(input.value, '1/2/2005');
    assert.equal(input.selectionStart, 8);
    input.dispatchEvent(new dom.window.Event('focusout', { bubbles: true }));
    assert.equal(input.value, '01/02/2005');

    const picker = dom.window.document.querySelector('[data-date-picker]');
    dom.window.document.querySelector('[data-action="date-picker-open"]').click();
    picker.value = '2026-11-10';
    picker.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(input.value, '10/11/2026');
    input.setSelectionRange(6, 7);
    edit(input, '3');
    assert.equal(input.value, '10/11/3026');
    assert.equal(input.selectionStart, 7);

    for (const invalid of ['30/02/2024', '31/04/2024', '01/01/1899', '01/01/2101', '1/2/05']) {
        input.value = invalid;
        input.dispatchEvent(new dom.window.Event('focusout', { bubbles: true }));
        assert.equal(dom.window.document.querySelector('[data-date-error]').textContent, 'Ngày không hợp lệ');
        assert.equal(utility.validateDateInput(input.value), 'Ngày không hợp lệ');
    }
    input.value = '1/2/2005';
    input.dispatchEvent(new dom.window.Event('focusout', { bubbles: true }));
    assert.equal(input.value, '01/02/2005');
    dom.window.close();
});

test('invalid proposed end dates show the existing validation message and block request submission', async () => {
    const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
    const { window } = dom;
    const calls = [];
    const ui = {
        repository: { data: { requests: [] } },
        pages: {},
        helpers: {
            esc: value => String(value ?? ''),
            date: value => {
                const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
                return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? '');
            },
            badge: value => String(value ?? ''),
            card: (_title, content) => content,
            requestTable: () => ''
        }
    };
    const testContext = {
        StudentUI: ui,
        StudentAuth: { session: () => ({ isBackend: true }) },
        AdminWorkflowUtils: require('../module/AdminWorkflowUtils'),
        ApiClient: {
            fetch: async (url, options = {}) => {
                calls.push({ url, options });
                return { json: async () => url === '/api/student/contracts' ? [{
                    TrangThaiHopDong: 'Còn hiệu lực',
                    NgayBatDau: '2026-10-01',
                    NgayKetThuc: '2027-09-30'
                }] : [] };
            }
        },
        Date,
        Event: window.Event,
        document: window.document,
        localStorage: window.localStorage,
        sessionStorage: window.sessionStorage,
        console
    };
    testContext.window = testContext;
    vm.runInNewContext(load('js/student/auth.js'), testContext, { filename: 'auth.js' });
    testContext.StudentAuth = { session: () => ({ isBackend: true }) };
    vm.runInNewContext(load('js/student/YeuCauHoTro.js'), testContext, { filename: 'YeuCauHoTro.js' });
    const root = window.document.createElement('main');
    root.innerHTML = ui.pages.requests.render();
    window.document.body.append(root);
    await ui.pages.requests.load(root);
    const form = root.querySelector('#student-request-form');
    assert.match(form.querySelector('[data-contract-dates]').textContent, /01\/10\/2026/);
    assert.match(form.querySelector('[data-contract-dates]').textContent, /30\/09\/2027/);
    const dateInput = form.elements.extensionEndDateText;
    const dateError = form.querySelector('[data-date-error]');
    form.elements.content.value = 'Gia hạn hợp đồng';
    for (const invalidDate of ['30/02/2026', '31/04/2026', '01/01/1899', '01/01/2101']) {
        dateInput.value = invalidDate;
        dateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
        const submit = new window.Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submit);
        assert.match(dateError.textContent, /^Ngày không hợp lệ/, invalidDate);
        assert.equal(submit.defaultPrevented, true, invalidDate);
    }
    assert.equal(calls.some(call => call.options.method === 'POST'), false);
    dom.window.close();
});

test('early checkout request DOM requires a proposed date and a trimmed 10-character reason', async () => {
    const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
    const { window } = dom;
    const calls = [];
    const ui = {
        repository: { data: { requests: [] } },
        pages: {},
        helpers: {
            esc: value => String(value ?? ''),
            date: value => String(value ?? ''),
            badge: value => String(value ?? ''),
            card: (_title, content) => content,
            requestTable: () => ''
        }
    };
    const testContext = {
        StudentUI: ui,
        StudentAuth: { session: () => ({ isBackend: true }) },
        AdminWorkflowUtils: require('../module/AdminWorkflowUtils'),
        ApiClient: { fetch: async (url, options = {}) => {
            calls.push({ url, options });
            return { json: async () => [] };
        } },
        Date,
        Event: window.Event,
        document: window.document,
        localStorage: window.localStorage,
        sessionStorage: window.sessionStorage,
        console
    };
    testContext.window = testContext;
    vm.runInNewContext(load('js/student/auth.js'), testContext, { filename: 'auth.js' });
    testContext.StudentAuth = { session: () => ({ isBackend: true }) };
    vm.runInNewContext(load('js/student/YeuCauHoTro.js'), testContext, { filename: 'YeuCauHoTro.js' });
    const root = window.document.createElement('main');
    root.innerHTML = ui.pages.requests.render();
    window.document.body.append(root);
    await ui.pages.requests.load(root);
    const form = root.querySelector('#student-request-form');
    const dateField = form.querySelector('[data-extension-date]');
    form.elements.type.value = 'Trả phòng sớm';
    form.elements.type.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(dateField.hidden, false);
    assert.equal(form.elements.extensionEndDateText.required, true);
    assert.equal(ui.requestRules.dateRequired('Trả phòng sớm'), true);
    assert.equal(ui.requestRules.isValid('Trả phòng sớm', '123456789'), false);
    assert.equal(ui.requestRules.isValid('Trả phòng sớm', '  Lý do trả phòng sớm  '), true);

    const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const date = testContext.StudentDate.formatIso(todayVN);
    form.elements.extensionEndDateText.value = date;
    form.elements.extensionEndDateText.dispatchEvent(new window.Event('input', { bubbles: true }));
    form.elements.content.value = '123456789';
    const submit = new window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    assert.equal(submit.defaultPrevented, true);
    assert.equal(calls.some(call => call.options.method === 'POST'), false);
    assert.match(form.querySelector('[data-content-error]').textContent, /10 đến 1\.000/);
    dom.window.close();
});

test('student request history displays contract dates before the reason', () => {
    const markup = ui.helpers.requestTable([{
        id: 'YC00001',
        type: 'Trả phòng sớm',
        date: '2026-10-02',
        contractStart: '2026-10-01',
        contractEnd: '2027-09-30',
        proposedEnd: '2026-10-14',
        content: 'Xin trả phòng sớm vì chuyển nơi ở.',
        status: 'Chờ duyệt',
        reply: ''
    }]);
    const dom = new JSDOM(markup);
    const table = dom.window.document.querySelector('table');
    const headers = [...table.querySelectorAll('th')].map(cell => cell.textContent.trim());
    const row = table.querySelector('tbody tr');
    const dateColumn = row.cells[headers.indexOf('Ngày hợp đồng / đề xuất')];
    const reasonColumn = row.cells[headers.indexOf('Lý do')];
    assert.match(dateColumn.textContent, /01\/10\/2026/);
    assert.match(dateColumn.textContent, /30\/09\/2027/);
    assert.match(dateColumn.textContent, /14\/10\/2026/);
    assert.match(reasonColumn.textContent, /Xin trả phòng sớm/);
    assert.ok(headers.indexOf('Ngày hợp đồng / đề xuất') < headers.indexOf('Lý do'));
    dom.window.close();
});

test('student registration birth-date input stays raw until blur normalizes it', () => {
    const dom = new JSDOM('<body><div><input id="birthday" data-date-error></div></body>', {
        url: 'http://localhost/'
    });
    dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    const authContext = {
        Date,
        AdminWorkflowUtils: require('../module/AdminWorkflowUtils'),
        document: dom.window.document,
        localStorage: dom.window.localStorage,
        sessionStorage: dom.window.sessionStorage,
        console
    };
    authContext.window = authContext;
    vm.runInNewContext(load('js/student/auth.js'), authContext, { filename: 'auth.js' });
    vm.runInNewContext(load('js/student/DangKy.js'), authContext, { filename: 'DangKy.js' });
    authContext.openStudentRegistration();
    const input = dom.window.document.querySelector('.student-register-dialog [name="birthday"]');
    assert.ok(input);

    let expected = '';
    for (const digit of '11112005') {
        input.setRangeText(digit, input.selectionStart, input.selectionEnd, 'end');
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        expected += digit;
        assert.equal(input.value, expected);
        assert.equal(input.selectionStart, expected.length);
    }
    assert.equal(input.value, '11112005');
    input.dispatchEvent(new dom.window.Event('focusout', { bubbles: true }));
    assert.equal(input.value, '11/11/2005');
    assert.equal(input.dataset.adminDate, 'true');
    assert.equal(input.dataset.dateBirth, 'true');
    dom.window.close();
});

test('student registration requires a non-empty school and shows the inline error', () => {
    const dom = new JSDOM('<body></body>', { url: 'http://localhost/' });
    dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    const authContext = {
        Date,
        FormData: dom.window.FormData,
        AdminWorkflowUtils: require('../module/AdminWorkflowUtils'),
        document: dom.window.document,
        localStorage: dom.window.localStorage,
        sessionStorage: dom.window.sessionStorage,
        console
    };
    authContext.window = authContext;
    vm.runInNewContext(load('js/student/auth.js'), authContext, { filename: 'auth.js' });
    vm.runInNewContext(load('js/student/DangKy.js'), authContext, { filename: 'DangKy.js' });
    authContext.openStudentRegistration();
    const dialog = dom.window.document.querySelector('.student-register-dialog');
    const school = dialog.querySelector('[name="school"]');
    assert.equal(school.required, true);
    assert.match(dialog.querySelector('label[for="sr-school"]').textContent, /Tên trường\s*\*/);
    const submit = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    dialog.querySelector('form').dispatchEvent(submit);
    assert.equal(submit.defaultPrevented, true);
    assert.equal(dialog.querySelector('[data-school-error]').textContent, 'Vui lòng nhập tên trường.');
    assert.equal(school.validationMessage, 'Vui lòng nhập tên trường.');
    dom.window.close();
});

test('renders one roomless state and never claims payment without invoices', () => {
    const html = ui.pages.home.render();
    assert.equal((html.match(/Bạn chưa được xếp phòng/g) || []).length, 1);
    assert.match(html, /data-dashboard-room-empty(?! hidden)/);
    assert.match(html, /data-dashboard-residence-panel hidden/);
    assert.doesNotMatch(html, /đã thanh toán/i);
    assert.doesNotMatch(html, /Đang tải/);
    assert.ok(html.includes(`data-dashboard-debt>${ui.helpers.money(0)}</strong>`));
    assert.match(html, /data-dashboard-debt-hint[^>]*>Không có nợ<\/span>/);
});

test('student dashboard shows contract days, occupied room count, and zero debt in backend mode', async () => {
    backendStudent = true;
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    const dom = new JSDOM('<main></main>');
    context.ApiClient = {
        fetch: async url => ({
            async json() {
                if (url === '/api/student/room') return {
                    room: {
                        TenPhong: 'A201', Khu: 'A', TrangThaiPhong: 'Trống',
                        SoSinhVienHienTai: 0, SucChuaToiDa: 4
                    },
                    members: [{ MaSinhVien: 'SV001', HoTen: 'Sinh viên thử nghiệm' }]
                };
                if (url === '/api/student/contracts') return [{
                    TrangThaiHopDong: 'Còn hiệu lực',
                    NgayBatDau: '2026-01-01',
                    NgayKetThuc: end
                }];
                if (url === '/api/HoaDon') return [];
                throw new Error(`Unexpected dashboard request: ${url}`);
            }
        })
    };
    const dashboard = dom.window.document.querySelector('main');
    dashboard.innerHTML = ui.pages.home.render();
    try {
        await ui.pages.home.load(dashboard, true);
        assert.equal(dashboard.querySelector('[data-dashboard-room]').textContent, 'A201');
        assert.equal(dashboard.querySelector('[data-dashboard-room-hint]').textContent, 'Đang ở · 1/4 người');
        assert.doesNotMatch(dashboard.textContent, /Trống/);
        assert.equal(dashboard.querySelector('[data-dashboard-room]').tagName, 'STRONG');
        assert.equal(dashboard.querySelector('[data-dashboard-contract]').textContent, '30 ngày');
        assert.equal(dashboard.querySelector('[data-dashboard-contract-hint]').textContent, 'Sắp hết hạn');
        assert.equal(dashboard.querySelector('[data-dashboard-contract]').tagName, 'STRONG');
        assert.equal(dashboard.querySelector('[data-dashboard-contract-hint]').tagName, 'SPAN');
        assert.ok(dashboard.querySelector('[data-dashboard-contract-hint]').classList.contains('sh-status'));
        assert.equal(dashboard.querySelector('[data-dashboard-debt]').textContent, '0 đ');
        assert.equal(dashboard.querySelector('[data-dashboard-debt-hint]').textContent, 'Không có nợ');
        assert.equal(dashboard.querySelector('[data-dashboard-debt-detail]').textContent, '0 đ · Không có nợ');
    } finally {
        dom.window.close();
        context.ApiClient = undefined;
        backendStudent = false;
    }
});

test('backend invoice DOM offers QR or cash guidance and maps transaction statuses to Vietnamese', async () => {
    const dom = new JSDOM('<main id="student-real-invoices"></main>');
    let loadInvoices;
    const testUi = {
        repository: { data: { profile: { code: 'SV001', name: 'Sinh viên thử nghiệm' } } },
        helpers: ui.helpers,
        pages: {},
        billing: { summary: () => ({ debt: 0, unpaid: 0 }) }
    };
    const testWindow = {
        StudentUI: testUi,
        KTXPaymentDemo: {},
        StudentAuth: { session: () => ({ isBackend: true }) },
        ApiClient: {
            fetch: async url => ({
                ok: true,
                async json() {
                    if (url === '/api/HoaDon') return [{
                        MaHoaDon: 'INV-CASH-UI', LoaiHoaDon: 'TIEN_PHONG', NgayLap: '2026-03-01',
                        HanThanhToan: '2026-03-08', TongTien: 100, DaThu: 0, ConNo: 100,
                        TrangThaiThanhToan: 'Chưa thanh toán'
                    }];
                    if (url === '/api/payments/history') return [{
                        MaHoaDon: 'INV-CASH-UI', MaGiaoDich: 'PAY-ONLINE-PENDING',
                        SoTien: 100, PhuongThuc: 'ONLINE', TrangThai: 'PENDING', NgayTao: '2026-03-01',
                        HoTen: 'Sinh viên thử nghiệm'
                    }];
                    if (url === '/api/lien-he') return { DienThoai: '0123456789', GioLamViec: '08:00-17:00' };
                    throw new Error(`Unexpected student payment request: ${url}`);
                }
            })
        },
        AdminWorkflowUtils: {
            invoicePaymentLabel: invoice => adminUtils.invoicePaymentLabel(invoice, '2026-03-09'),
            isOverdueInvoice: invoice => adminUtils.isOverdueInvoice(invoice, '2026-03-09'),
            overdueDays: () => 0,
            dateTime: () => '01/03/2026',
            date: (value, mode) => mode === 'format' ? value : value
        },
        setTimeout: callback => { loadInvoices = callback; return 1; },
        Intl,
        Date,
        Number,
        String,
        Array,
        Map,
        Object,
        RegExp,
        document: dom.window.document,
        console
    };
    testWindow.window = testWindow;
    try {
        vm.runInNewContext(load('js/student/HoaDon.js'), testWindow, { filename: 'HoaDon.js' });
        const host = dom.window.document.querySelector('main');
        host.innerHTML = testUi.pages.invoices.render();
        loadInvoices();
        await new Promise(resolve => setImmediate(resolve));
        const method = host.querySelector('[data-payment-method]');
        assert.ok(method);
        assert.deepEqual([...method.options].map(option => option.textContent), [
            'Chuyển khoản QR', 'Tiền mặt tại văn phòng'
        ]);
        assert.equal(host.querySelector('[data-payment-amount]'), null);
        assert.equal(host.querySelector('[data-payment-amount-wrapper]'), null);
        assert.doesNotMatch(host.textContent, /Số tiền thanh toán \(tối đa/);
        const emDash = String.fromCharCode(0x2014);
        assert.equal(load('js/student/HoaDon.js').includes(emDash), false);
        assert.equal(load('js/student/app.js').includes(emDash), false);
        assert.equal(host.querySelector('[data-action="backend-invoice-pay"]').textContent.trim(), 'Thanh toán');
        assert.match(host.textContent, /Trễ hạn/);
        assert.ok(host.querySelector('.st-badge.st-danger'));
        assert.equal(testUi.backendPayments.statusLabel('PENDING'), 'Đang xử lý');
        assert.equal(testUi.backendPayments.statusLabel('SUCCESS'), 'Thành công');
        assert.equal(testUi.backendPayments.statusLabel('REJECTED'), 'Thất bại');
        assert.equal(testUi.backendPayments.statusLabel('FAILED'), 'Thất bại');
        assert.match(host.textContent, /Đang xử lý/);
        assert.match(host.textContent, /Sinh viên thử nghiệm/);
        assert.deepEqual([...host.querySelectorAll('th')].map(header => header.textContent), [
            'Mã giao dịch', 'Người nộp', 'Khoản thanh toán', 'Số tiền',
            'Thời gian', 'Phương thức', 'Trạng thái'
        ]);
        assert.match(load('student.css'), /st-payment-history td:is\(\.st-transaction-id, \.st-transaction-payer\).*overflow-wrap: anywhere/);
        assert.match(load('student.css'), /st-payment-history table \{ table-layout: fixed; \}/);
        assert.equal(host.querySelector('[data-action="backend-payment-cash"]'), null);
        assert.equal(host.querySelector('[data-action="cash-step"], [data-action="confirm-cash"]'), null);
        assert.equal([...host.querySelectorAll('button')].some(button =>
            /tiền mặt|cash/i.test(button.textContent)), false);
        assert.equal(host.querySelector('[data-action="backend-payment-qr"]'), null);
        assert.doesNotMatch(load('js/student/app.js'), /backend-payment-cash|cash-step|confirm-cash/);
    } finally {
        dom.window.close();
    }
});

test('student registration form omits address and submits successfully without it', async () => {
    const dom = new JSDOM('<body></body>');
    dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    dom.window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
    let registrationBody;
    const context = {
        document: dom.window.document,
        FormData: dom.window.FormData,
        TextEncoder,
        StudentDate: {
            bindInput() {},
            birthDateToIso: () => '2005-08-15'
        },
        StudentIdentity: {
            validateStudentIdentity: value => ({ valid: true, value })
        },
        ApiClient: {
            async fetch(_url, options) {
                registrationBody = JSON.parse(options.body);
                return { ok: true, json: async () => ({ success: true }) };
            }
        },
        showRegistrationSuccessMessage() {},
        console
    };
    context.window = context;
    vm.runInNewContext(load('js/student/DangKy.js'), context, { filename: 'DangKy.js' });
    context.openStudentRegistration();
    const dialog = dom.window.document.querySelector('dialog');
    assert.equal(dialog.querySelector('[name="address"]'), null);
    for (const [name, value] of Object.entries({
        name: 'Sinh viên kiểm thử',
        code: '012345678901',
        birthday: '15/08/2005',
        gender: 'Nữ',
        phone: '0901234567',
        email: 'student@gmail.com',
        school: '  Đại học kiểm thử  ',
        className: 'CNTT01',
        password: 'valid-password',
        confirm: 'valid-password'
    })) {
        dialog.querySelector(`[name="${name}"]`).value = value;
    }
    await dialog.querySelector('form').onsubmit({
        preventDefault() {},
        target: dialog.querySelector('form')
    });
    assert.ok(registrationBody);
    assert.equal(Object.hasOwn(registrationBody, 'DiaChi'), false);
    assert.equal(registrationBody.Truong, 'Đại học kiểm thử');
    assert.equal(dialog.open, false);
    dom.window.close();
});

function createStudentAppHarness({
    demoEnabled = false,
    onDemoConfirm = async () => ({ success: true }),
    invoicePaid = false,
    invoiceCanceled = false,
    paymentMethod = 'ONLINE',
    invoiceDates = { NgayLap: '2026-03-01', KyThanhToan: '2026-03-01', HanThanhToan: '2026-03-08' },
    invoiceId = 'INV-APP-UI',
    invoiceAmount = 100,
    includeRequests = false,
    requestRows = []
} = {}) {
    const dom = new JSDOM(`
        <header><span id="student-name"></span><span id="student-session-label"></span>
            <div id="student-account"><button id="student-account-toggle"></button>
                <div id="student-account-panel"></div></div></header>
        <nav id="main-nav"></nav><main id="student-page"></main>
        <div id="student-demo-notice"></div><dialog id="student-dialog"></dialog>
        <div id="student-toast"></div>`, { url: 'http://localhost/Student.html#invoices' });
    const timers = new Map();
    let timerId = 0;
    dom.window.setTimeout = (callback, delay = 0) => {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
    };
    dom.window.clearTimeout = id => timers.delete(id);
    dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
    dom.window.HTMLDialogElement.prototype.close = function close() {
        this.open = false;
        this.dispatchEvent(new dom.window.Event('close'));
    };
    const calls = [];
    let serverInvoicePaid = invoicePaid;
    let paymentStatus = invoicePaid ? 'SUCCESS' : 'PENDING';
    const response = (value, ok = true) => ({ ok, json: async () => value });
    const appUi = {
        repository: { data: { profile: { code: 'SV001', name: 'Sinh viên thử nghiệm' }, invoices: [], payments: [], requests: [] } },
        helpers: ui.helpers,
        billing: { sync() {}, summary: () => ({ debt: 0, unpaid: 0 }) },
        pages: {},
        routeFromHash: hash => String(hash || '').replace(/^#/, '') || 'invoices'
    };
    Object.assign(dom.window, {
        StudentUI: appUi,
        KTXPaymentDemo: {},
        StudentAuth: { session: () => ({ isBackend: true, code: 'SV001', name: 'Sinh viên thử nghiệm' }) },
        AdminWorkflowUtils: {
            invoicePaymentLabel: () => invoiceCanceled
                ? 'Đã hủy' : serverInvoicePaid ? 'Đã thanh toán' : 'Còn nợ',
            isOverdueInvoice: () => false,
            overdueDays: () => 0,
            dateTime: () => '01/03/2026',
            date(value) {
                const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
                return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
            }
        },
        ApiClient: {
            async fetch(url, options = {}) {
                calls.push({ url, options });
                if (url === '/api/HoaDon') return response([{
                    MaHoaDon: invoiceId, LoaiHoaDon: 'TIEN_PHONG',
                    ...invoiceDates, TongTien: invoiceAmount, DaThu: serverInvoicePaid ? invoiceAmount : 0,
                    ConNo: serverInvoicePaid ? 0 : invoiceAmount,
                    TrangThaiThanhToan: invoiceCanceled
                        ? 'Đã hủy' : serverInvoicePaid ? 'Đã thanh toán' : 'Chưa thanh toán'
                }]);
                if (url === '/api/payments/history' || url.startsWith('/api/payments/history?')) {
                    return response([{
                        MaHoaDon: invoiceId, MaGiaoDich: 'PAY-APP-UI', SoTien: invoiceAmount,
                        PhuongThuc: paymentMethod, TrangThai: paymentStatus, NgayTao: '2026-03-01',
                        HoTen: 'Sinh viên thử nghiệm'
                    }].filter(item => item.TrangThai));
                }
                if (url === '/api/student/requests') return response(requestRows);
                if (url === '/api/student/contracts') return response([]);
                if (url === '/api/lien-he') return response({ DienThoai: '0123456789', GioLamViec: '08:00-17:00' });
                if (url === '/api/payments/create') {
                    return response({ MaGiaoDich: 'PAY-APP-UI', SoTien: invoiceAmount, NoiDungCK: 'KTXPAYAPP' });
                }
                if (url.startsWith('/api/payments/qr?')) {
                    return response({ DemoPaymentEnabled: demoEnabled, QrPayload: 'test-qr', TongTien: invoiceAmount,
                        MaGiaoDich: 'PAY-APP-UI', NoiDungCK: 'KTXPAYAPP' });
                }
                if (url === '/api/payments/demo-confirm') {
                    const result = await onDemoConfirm(options);
                    if (result.success) {
                        serverInvoicePaid = true;
                        paymentStatus = 'SUCCESS';
                    }
                    return response(result, result.success === true);
                }
                throw new Error(`Unexpected student payment request: ${url}`);
            }
        }
    });
    if (includeRequests) {
        dom.window.StudentDate = {
            bindInput() {},
            normalizeInput: () => '',
            formatIso: () => '',
            earlyCheckoutDateToIso: () => '',
            futureDateToIso: () => ''
        };
        vm.runInNewContext(load('js/student/YeuCauHoTro.js'), dom.window, { filename: 'YeuCauHoTro.js' });
    }
    dom.window.qrcode = () => ({
        addData() {},
        make() {},
        createSvgTag() { return '<svg aria-hidden="true"></svg>'; }
    });
    vm.runInNewContext(load('js/student/HoaDon.js'), dom.window, { filename: 'HoaDon.js' });
    vm.runInNewContext(load('js/student/app.js'), dom.window, { filename: 'app.js' });
    return {
        dom,
        appUi,
        calls,
        timers,
        setPaymentStatus(status) { paymentStatus = status; },
        async runTimer(delay) {
            const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
            assert.ok(entry, `expected a ${delay}ms timer`);
            timers.delete(entry[0]);
            await entry[1].callback();
            await new Promise(resolve => setImmediate(resolve));
        },
        async loadInvoices() {
            const entry = [...timers.entries()].find(([, timer]) => timer.delay === 0);
            assert.ok(entry, 'expected invoice load timer');
            timers.delete(entry[0]);
            await entry[1].callback();
            await new Promise(resolve => setImmediate(resolve));
        }
    };
}

test('choosing cash opens configured office instructions without creating a payment request', async () => {
    const harness = createStudentAppHarness();
    try {
        await harness.loadInvoices();
        const main = harness.dom.window.document.getElementById('student-page');
        main.querySelector('[data-action="backend-payment-detail"]').click();
        await new Promise(resolve => setImmediate(resolve));
        const detail = harness.dom.window.document.getElementById('student-dialog');
        assert.match(detail.textContent, /PAY-APP-UI/);
        assert.match(detail.textContent, /Sinh viên thử nghiệm/);
        assert.doesNotMatch(detail.textContent, /SV001/);
        detail.close();
        const method = main.querySelector('[data-payment-method]');
        method.value = 'CASH';
        method.dispatchEvent(new harness.dom.window.Event('change', { bubbles: true }));
        main.querySelector('[data-action="backend-invoice-pay"]').click();
        await new Promise(resolve => setImmediate(resolve));
        const dialog = harness.dom.window.document.getElementById('student-dialog');
        assert.match(dialog.textContent, /giờ làm việc 08:00-17:00/);
        assert.match(dialog.textContent, /SĐT 0123456789/);
        assert.match(dialog.textContent, /INV-APP-UI/);
        assert.match(dialog.textContent, /100/);
        assert.equal(harness.calls.some(call => call.url === '/api/payments/create'
            || call.url.startsWith('/api/payments/qr?')), false);
    } finally {
        harness.dom.window.close();
    }
});

test('invoice header date matches displayed creation and due dates', async () => {
    const harness = createStudentAppHarness({
        invoiceDates: {
            NgayLap: '2026-11-02',
            KyThanhToan: '2026-11-01',
            HanThanhToan: '2026-11-02'
        }
    });
    try {
        await harness.loadInvoices();
        const invoice = harness.dom.window.document.querySelector('.st-invoice');
        const summary = invoice.querySelector('summary');
        const displayedDates = new Map([...invoice.querySelectorAll('.st-fields > div')].map(row => [
            row.querySelector('dt').textContent,
            row.querySelector('dd').textContent
        ]));
        assert.equal(summary.textContent.includes('02/11/2026'), true);
        assert.equal(summary.textContent.includes('01/11/2026'), false);
        assert.equal(displayedDates.get('Ngày lập'), '02/11/2026');
        assert.equal(displayedDates.get('Hạn thanh toán'), '02/11/2026');
    } finally {
        harness.dom.window.close();
    }
});

test('invoice payment has no editable amount and QR request uses the full outstanding balance', async () => {
    const harness = createStudentAppHarness();
    try {
        await harness.loadInvoices();
        const main = harness.dom.window.document.getElementById('student-page');
        assert.equal(main.querySelector('[data-payment-amount]'), null);
        assert.equal(main.querySelector('[data-payment-amount-wrapper]'), null);
        assert.doesNotMatch(main.textContent, /Số tiền thanh toán \(tối đa/);
        main.querySelector('[data-action="backend-invoice-pay"]').click();
        await new Promise(resolve => setImmediate(resolve));
        const createRequest = harness.calls.find(call => call.url === '/api/payments/create');
        assert.deepEqual(JSON.parse(createRequest.options.body), {
            MaHoaDon: 'INV-APP-UI',
            PhuongThuc: 'ONLINE',
            SoTien: 100
        });
        assert.equal(harness.calls.some(call => call.url === '/api/payments/qr?MaHoaDon=INV-APP-UI&SoTien=100'), true);
        assert.match(harness.dom.window.document.getElementById('student-dialog').textContent,
            /QR được tạo đúng số tiền còn nợ của hóa đơn/);
    } finally {
        harness.dom.window.close();
    }
});

test('renewal invoice shows its amount and due date and opens payment for its balance', async () => {
    const harness = createStudentAppHarness({
        invoiceId: 'INV-RENEWAL-UI',
        invoiceAmount: 1250000,
        invoiceDates: {
            NgayLap: '2026-03-04',
            KyThanhToan: '2026-03-01',
            HanThanhToan: '2026-03-11'
        }
    });
    try {
        await harness.loadInvoices();
        const invoice = harness.dom.window.document.querySelector('.st-invoice');
        const fields = new Map([...invoice.querySelectorAll('.st-fields > div')].map(row => [
            row.querySelector('dt').textContent,
            row.querySelector('dd').textContent
        ]));
        assert.match(invoice.querySelector('summary').textContent, /1\.250\.000\s*đ/);
        assert.equal(fields.get('Loại hóa đơn'), 'Tiền phòng');
        assert.equal(fields.get('Tổng tiền'), '1.250.000\u00a0đ');
        assert.equal(fields.get('Còn nợ'), '1.250.000\u00a0đ');
        assert.equal(fields.get('Hạn thanh toán'), '11/03/2026');

        invoice.querySelector('[data-action="backend-invoice-pay"]').click();
        await new Promise(resolve => setImmediate(resolve));
        const createRequest = harness.calls.find(call => call.url === '/api/payments/create');
        assert.deepEqual(JSON.parse(createRequest.options.body), {
            MaHoaDon: 'INV-RENEWAL-UI',
            PhuongThuc: 'ONLINE',
            SoTien: 1250000
        });
        assert.equal(harness.calls.some(call => call.url ===
            '/api/payments/qr?MaHoaDon=INV-RENEWAL-UI&SoTien=1250000'), true);
        assert.match(harness.dom.window.document.getElementById('student-dialog').textContent,
            /QR được tạo đúng số tiền còn nợ của hóa đơn/);
    } finally {
        harness.dom.window.close();
    }
});

test('canceled renewal invoice shows canceled status without payment controls', async () => {
    const harness = createStudentAppHarness({
        invoiceId: 'INV-RENEWAL-CANCELED',
        invoiceAmount: 1250000,
        invoiceCanceled: true,
        invoiceDates: {
            NgayLap: '2026-03-04',
            KyThanhToan: '2026-03-01',
            HanThanhToan: '2026-03-11'
        }
    });
    try {
        await harness.loadInvoices();
        const invoice = harness.dom.window.document.querySelector('.st-invoice');
        assert.match(invoice.querySelector('summary').textContent, /Đã hủy/);
        assert.equal(invoice.querySelector('[data-action="backend-invoice-pay"]'), null);
        assert.equal(invoice.querySelector('[data-payment-method]'), null);
        assert.equal(harness.calls.some(call => call.url === '/api/payments/create'), false);
    } finally {
        harness.dom.window.close();
    }
});

test('renewal rejection notification opens the request detail with its rejection reason', async () => {
    const requestId = 'YC-RENEWAL-UI';
    const rejectionReason = 'Hợp đồng không đủ điều kiện gia hạn.';
    const harness = createStudentAppHarness({
        includeRequests: true,
        requestRows: [{
            MaYeuCau: requestId,
            Loai: 'Gia hạn hợp đồng',
            NgayTao: '2026-03-01',
            NoiDung: 'Xin gia hạn hợp đồng.',
            TrangThai: 'Từ chối',
            PhanHoi: rejectionReason
        }]
    });
    try {
        await harness.loadInvoices();
        const main = harness.dom.window.document.getElementById('student-page');
        main.insertAdjacentHTML('beforeend', ui.noticeHelpers.renderNotifications([], [{
            TieuDe: 'Yêu cầu gia hạn hợp đồng bị từ chối',
            NoiDung: `Lý do: ${rejectionReason}`,
            MaSuKien: `RENEWAL_REJECT:${requestId}:SV001`,
            NgayTao: '2026-03-02'
        }]));
        const notification = main.querySelector('[data-action="student-notification"]');
        assert.ok(notification);
        assert.match(notification.textContent, /Mở yêu cầu/);
        notification.click();
        await new Promise(resolve => setImmediate(resolve));
        for (let attempt = 0; attempt < 4
            && [...harness.timers.values()].some(timer => timer.delay === 0); attempt += 1) {
            await new Promise(resolve => setImmediate(resolve));
            await harness.runTimer(0);
        }
        await new Promise(resolve => setImmediate(resolve));

        const dialog = harness.dom.window.document.getElementById('student-dialog');
        assert.ok(dialog.querySelector('#student-dialog-title'));
        assert.equal(dialog.querySelector('#student-dialog-title').textContent, 'Chi tiết yêu cầu');
        assert.equal(dialog.querySelector('[data-action="close"]') !== null, true);
        assert.match(dialog.textContent, new RegExp(rejectionReason));
        assert.ok(harness.calls.some(call => call.url === '/api/student/requests'));
    } finally {
        harness.dom.window.close();
    }
});

test('QR demo visibility follows server configuration; success and polling use server status', async () => {
    const enabled = createStudentAppHarness({ demoEnabled: true });
    try {
        await enabled.loadInvoices();
        enabled.dom.window.document.querySelector('[data-action="backend-invoice-pay"]').click();
        await new Promise(resolve => setImmediate(resolve));
        const demoButton = enabled.dom.window.document.querySelector('[data-action="backend-payment-demo-confirm"]');
        assert.ok(demoButton);
        assert.equal(demoButton.textContent.trim(), 'Giả lập: đã chuyển khoản thành công (demo)');
        const amountInput = enabled.dom.window.document.querySelector('[data-demo-amount]');
        assert.equal(amountInput.value, '100');
        const invoiceReadsBeforeDemo = enabled.calls.filter(call => call.url === '/api/HoaDon').length;
        amountInput.value = '99';
        demoButton.click();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(enabled.calls.some(call => call.url === '/api/payments/demo-confirm'), false);
        assert.match(enabled.dom.window.document.querySelector('[data-demo-error]').textContent,
            /Bạn nhập thiếu 1\s*đ so với số tiền cần nộp \(100\s*đ\)/);
        assert.ok(enabled.dom.window.document.querySelector('[data-demo-error]').classList.contains('st-payment-amount-warning'));
        assert.equal(enabled.dom.window.document.getElementById('student-dialog').open, true);

        amountInput.value = '101';
        demoButton.click();
        await new Promise(resolve => setImmediate(resolve));
        assert.match(enabled.dom.window.document.querySelector('[data-demo-error]').textContent,
            /Bạn nhập dư 1\s*đ so với số tiền cần nộp \(100\s*đ\)/);
        assert.equal(enabled.calls.some(call => call.url === '/api/payments/demo-confirm'), false);

        amountInput.value = '';
        demoButton.click();
        await new Promise(resolve => setImmediate(resolve));
        assert.match(enabled.dom.window.document.querySelector('[data-demo-error]').textContent,
            /Vui lòng nhập số tiền nguyên VND hợp lệ/);
        assert.equal(enabled.calls.some(call => call.url === '/api/payments/demo-confirm'), false);

        amountInput.value = '100';
        demoButton.click();
        await new Promise(resolve => setImmediate(resolve));
        assert.ok(enabled.calls.some(call => call.url === '/api/payments/demo-confirm'));
        const demoRequest = enabled.calls.find(call => call.url === '/api/payments/demo-confirm');
        assert.equal(JSON.parse(demoRequest.options.body).SoTien, 100);
        assert.equal(enabled.dom.window.document.getElementById('student-toast').textContent, 'Thanh toán thành công');
        assert.equal(enabled.dom.window.document.getElementById('student-dialog').open, false);
        await enabled.loadInvoices();
        assert.equal(enabled.calls.filter(call => call.url === '/api/HoaDon').length, invoiceReadsBeforeDemo + 1);
        const invoice = enabled.dom.window.document.querySelector('.st-invoice');
        assert.match(invoice.textContent, /Đã thanh toán/);
        assert.match(invoice.textContent, /Thành công/);
        assert.ok(invoice.querySelector('.st-badge.st-success'));
    } finally {
        enabled.dom.window.close();
    }

    const cashPaid = createStudentAppHarness({
        invoicePaid: true,
        paymentMethod: 'CASH'
    });
    try {
        await cashPaid.loadInvoices();
        const invoice = cashPaid.dom.window.document.querySelector('.st-invoice');
        assert.match(invoice.textContent, /Đã thanh toán/);
        assert.match(invoice.textContent, /Đã thanh toán/);
        assert.ok(invoice.querySelector('.st-badge.st-success'));
    } finally {
        cashPaid.dom.window.close();
    }

    const failed = createStudentAppHarness({
        demoEnabled: true,
        onDemoConfirm: async () => ({ success: false, message: 'Giao dịch không thuộc hóa đơn.' })
    });
    try {
        await failed.loadInvoices();
        failed.dom.window.document.querySelector('[data-action="backend-invoice-pay"]').click();
        await new Promise(resolve => setImmediate(resolve));
        failed.dom.window.document.querySelector('[data-action="backend-payment-demo-confirm"]').click();
        await new Promise(resolve => setImmediate(resolve));
        const dialog = failed.dom.window.document.getElementById('student-dialog');
        assert.equal(dialog.querySelector('#student-dialog-title').textContent, 'Chuyển khoản QR');
        assert.equal(dialog.querySelector('[data-demo-error]').textContent, 'Giao dịch không thuộc hóa đơn.');
        assert.doesNotMatch(dialog.textContent, /Thất bại/);
    } finally {
        failed.dom.window.close();
    }

    const disabled = createStudentAppHarness();
    try {
        await disabled.loadInvoices();
        disabled.dom.window.document.querySelector('[data-action="backend-invoice-pay"]').click();
        await new Promise(resolve => setImmediate(resolve));
        const dialog = disabled.dom.window.document.getElementById('student-dialog');
        assert.equal(dialog.querySelector('[data-action="backend-payment-demo-confirm"]'), null);
        const status = dialog.querySelector('[data-payment-status]');
        const close = dialog.querySelector('[data-action="close"]');
        assert.equal(status.textContent, 'Đang xử lý');
        assert.equal(status.classList.contains('st-button'), true);
        assert.equal(close.classList.contains('st-button'), true);
        assert.match(load('student.css'), /st-payment-dialog-actions > :is\(button, \[role="status"\]\).*height: 44px/);
        assert.ok([...disabled.timers.values()].some(timer => timer.delay === 5000));
        dialog.close();
        assert.equal([...disabled.timers.values()].some(timer => timer.delay === 5000), false);
    } finally {
        disabled.dom.window.close();
    }

    const polling = createStudentAppHarness();
    try {
        await polling.loadInvoices();
        polling.dom.window.document.querySelector('[data-action="backend-invoice-pay"]').click();
        await new Promise(resolve => setImmediate(resolve));
        assert.ok([...polling.timers.values()].some(timer => timer.delay === 5000));
        polling.setPaymentStatus('SUCCESS');
        await polling.runTimer(5000);
        assert.equal(polling.dom.window.document.getElementById('student-dialog').open, false);
        assert.equal(polling.dom.window.document.getElementById('student-toast').textContent, 'Thanh toán thành công');
        assert.equal([...polling.timers.values()].filter(timer => timer.delay === 5000).length, 1);
    } finally {
        polling.dom.window.close();
    }
});

test('renders a self-contained, decorative banyan SVG', () => {
    const svg = context.StudentBangTree.render();
    assert.match(svg, /aria-hidden="true"/);
    assert.doesNotMatch(svg, /(?:https?:\/\/|url\()/i);
});

test('merges payment and management notices in newest-first order and escapes content', () => {
    const html = ui.noticeHelpers.renderNotifications([
        { TrangThai: 'SUCCESS', TenKhoan: 'Tiền phòng', MaHoaDon: 'INV1', SoTien: 1200, PhuongThuc: 'CASH', NgayTao: '2026-10-23T12:00:00.000Z' },
        { TrangThai: 'PENDING', TenKhoan: 'Bỏ qua', NgayTao: '2026-10-25T12:00:00.000Z' }
    ], [
        { TieuDe: '<script>alert(1)</script>', NoiDung: 'Tin mới', NgayTao: '2026-10-24T12:00:00.000Z' },
        { TieuDe: 'Yêu cầu trả phòng sớm', NoiDung: 'Xin trả phòng', MaSuKien: 'CHECKOUT:YC00001:SV001', NgayTao: '2026-10-22T12:00:00.000Z' }
    ]);
    assert.match(html, /Thông báo từ Quản lý/);
    assert.match(html, /Thanh toán/);
    assert.match(html, /st-notification-kind--payment/);
    assert.match(html, /st-notification-kind--management/);
    assert.match(html, /st-notification-kind--request/);
    assert.match(html, /sh-notice--payment/);
    assert.match(html, /sh-notice--management/);
    assert.match(html, /sh-notice--request/);
    const noticeDom = new JSDOM(`<ul>${html}</ul>`);
    const noticeButtons = [...noticeDom.window.document.querySelectorAll('button[data-action="student-notification"]')];
    assert.equal(noticeButtons.length, 3);
    assert.ok(noticeButtons.every(button => button.type === 'button' && button.tabIndex === 0));
    assert.ok(noticeButtons.every(button => button.querySelector('.sh-notice-title')
        && button.querySelector('.sh-notice-detail') && button.querySelector('time.sh-notice-time')));
    assert.ok(noticeButtons.every(button => {
        const content = button.querySelector('.sh-news-content');
        return button.firstElementChild.matches('.st-notification-kind')
            && content?.children[0]?.matches('.sh-notice-title')
            && content?.children[1]?.matches('.sh-notice-detail')
            && content?.children[2]?.matches('time.sh-notice-time')
            && content?.children[3]?.matches('.sh-notice-action');
    }));
    assert.equal(noticeButtons[1].dataset.eventKey, 'INVOICE:INV1');
    assert.equal(noticeButtons[2].dataset.eventKey, 'CHECKOUT:YC00001:SV001');
    noticeDom.window.close();
    const styles = readFileSync(resolve(root, 'student.css'), 'utf8');
    assert.match(styles, /\.sh-notice--payment\s*\{[^}]*border-left-color:[^}]*background:/);
    assert.match(styles, /\.sh-notice--management\s*\{[^}]*border-left-color:[^}]*background:/);
    assert.match(styles, /\.sh-notice--request\s*\{[^}]*border-left-color:[^}]*background:/);
    const noticeButtonCss = styles.match(/\.student-home-dashboard \.sh-notice-button\s*\{[^}]*\}/)?.[0] || '';
    for (const declaration of ['appearance: none', 'background: transparent', 'border: 0',
        'font: inherit', 'color: #334155', 'text-align: left', 'width: 100%', 'flex-direction: column']) {
        assert.ok(noticeButtonCss.includes(declaration), declaration);
    }
    assert.match(styles, /\.sh-announcements li\.sh-notice\s*\{[^}]*margin: 0 0 11px/);
    assert.match(styles, /\.sh-notice\s*\{[^}]*border-radius: 12px/);
    assert.match(styles, /\.st-payment-amount-warning:not\(:empty\)\s*\{[^}]*border-left-width:\s*4px;[^}]*background:\s*#fffbeb/);
    assert.ok(html.indexOf('&lt;script&gt;') < html.indexOf('Đã thanh toán'));
    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /Bỏ qua/);
    assert.match(ui.noticeHelpers.renderNotifications([], []), /Chưa có thông báo/);
});

test('Yêu cầu khác requires description and never requests an end date', () => {
    assert.equal(ui.requestRules.dateRequired('Yêu cầu khác'), false);
    assert.equal(ui.requestRules.isValid('Yêu cầu khác', '   '), false);
    assert.equal(ui.requestRules.isValid('Yêu cầu khác', 'Mô tả sự việc'), true);
    assert.equal(ui.requestRules.isValid('Không hợp lệ', 'Nội dung'), false);
    const html = ui.pages.requests.render();
    assert.match(html, /<option>Yêu cầu khác<\/option>/);
});

test('binds birth-date validation only to birth-date inputs', () => {
    const authContext = {
        Date,
        AdminWorkflowUtils: {
            date: context.AdminWorkflowUtils.date,
            bindDateInputs() {}
        },
        document: { body: {} },
        localStorage: {
            getItem: () => '1',
            removeItem() {},
            setItem() {},
            get length() { return 0; },
            key() { return null; }
        },
        sessionStorage: {
            getItem: () => null,
            removeItem() {}
        },
        console
    };
    authContext.window = authContext;
    vm.runInNewContext(load('js/student/auth.js'), authContext, { filename: 'auth.js' });

    const birthInput = { dataset: {} };
    authContext.StudentDate.bindInput(birthInput, { birth: true });
    assert.equal(birthInput.dataset.dateBirth, 'true');

    const requestDateInput = { dataset: { dateBirth: 'true' } };
    authContext.StudentDate.bindInput(requestDateInput);
    assert.equal(Object.hasOwn(requestDateInput.dataset, 'dateBirth'), false);
});
