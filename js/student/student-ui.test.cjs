const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

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
        ApiClient: {
            fetch: async (url, options = {}) => {
                calls.push({ url, options });
                return { json: async () => [] };
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
            invoicePaymentLabel: () => 'Còn nợ',
            isOverdueInvoice: () => false,
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
    assert.equal(dialog.open, false);
    dom.window.close();
});

function createStudentAppHarness({
    demoEnabled = false,
    onDemoConfirm = async () => ({ success: true }),
    invoicePaid = false,
    qrConfirmed = false,
    paymentMethod = 'ONLINE',
    invoiceDates = { NgayLap: '2026-03-01', KyThanhToan: '2026-03-01', HanThanhToan: '2026-03-08' }
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
    let qrPaymentConfirmed = qrConfirmed;
    let paymentStatus = invoicePaid ? 'SUCCESS' : 'PENDING';
    const response = (value, ok = true) => ({ ok, json: async () => value });
    const appUi = {
        repository: { data: { profile: { code: 'SV001', name: 'Sinh viên thử nghiệm' }, invoices: [], payments: [], requests: [] } },
        helpers: ui.helpers,
        billing: { sync() {}, summary: () => ({ debt: 0, unpaid: 0 }) },
        pages: {},
        routeFromHash: () => 'invoices'
    };
    Object.assign(dom.window, {
        StudentUI: appUi,
        KTXPaymentDemo: {},
        StudentAuth: { session: () => ({ isBackend: true, code: 'SV001', name: 'Sinh viên thử nghiệm' }) },
        AdminWorkflowUtils: {
            invoicePaymentLabel: () => serverInvoicePaid ? 'Đã thanh toán' : 'Còn nợ',
            invoicePaymentDisplayLabel: invoice => serverInvoicePaid && invoice?.DaXacNhanQR
                ? 'Đã xác nhận thanh toán' : serverInvoicePaid ? 'Đã thanh toán' : 'Còn nợ',
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
                    MaHoaDon: 'INV-APP-UI', LoaiHoaDon: 'TIEN_PHONG',
                    ...invoiceDates, TongTien: 100, DaThu: serverInvoicePaid ? 100 : 0,
                    ConNo: serverInvoicePaid ? 0 : 100,
                    DaXacNhanQR: qrPaymentConfirmed,
                    TrangThaiThanhToan: serverInvoicePaid ? 'Đã thanh toán' : 'Chưa thanh toán'
                }]);
                if (url === '/api/payments/history' || url.startsWith('/api/payments/history?')) {
                    return response([{
                        MaHoaDon: 'INV-APP-UI', MaGiaoDich: 'PAY-APP-UI', SoTien: 100,
                        PhuongThuc: paymentMethod, TrangThai: paymentStatus, NgayTao: '2026-03-01',
                        HoTen: 'Sinh viên thử nghiệm'
                    }].filter(item => item.TrangThai));
                }
                if (url === '/api/lien-he') return response({ DienThoai: '0123456789', GioLamViec: '08:00-17:00' });
                if (url === '/api/payments/create') {
                    return response({ MaGiaoDich: 'PAY-APP-UI', SoTien: 100, NoiDungCK: 'KTXPAYAPP' });
                }
                if (url.startsWith('/api/payments/qr?')) {
                    return response({ DemoPaymentEnabled: demoEnabled, QrPayload: 'test-qr', TongTien: 100,
                        MaGiaoDich: 'PAY-APP-UI', NoiDungCK: 'KTXPAYAPP' });
                }
                if (url === '/api/payments/demo-confirm') {
                    const result = await onDemoConfirm(options);
                    if (result.success) {
                        serverInvoicePaid = true;
                        qrPaymentConfirmed = true;
                        paymentStatus = 'SUCCESS';
                    }
                    return response(result, result.success === true);
                }
                throw new Error(`Unexpected student payment request: ${url}`);
            }
        }
    });
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

test('QR demo visibility follows server configuration; success and polling use server status', async () => {
    const enabled = createStudentAppHarness({ demoEnabled: true });
    try {
        await enabled.loadInvoices();
        enabled.dom.window.document.querySelector('[data-action="backend-invoice-pay"]').click();
        await new Promise(resolve => setImmediate(resolve));
        const demoButton = enabled.dom.window.document.querySelector('[data-action="backend-payment-demo-confirm"]');
        assert.ok(demoButton);
        assert.equal(demoButton.textContent.trim(), 'Giả lập: đã chuyển khoản thành công (demo)');
        const invoiceReadsBeforeDemo = enabled.calls.filter(call => call.url === '/api/HoaDon').length;
        demoButton.click();
        await new Promise(resolve => setImmediate(resolve));
        assert.ok(enabled.calls.some(call => call.url === '/api/payments/demo-confirm'));
        assert.equal(enabled.dom.window.document.getElementById('student-toast').textContent, 'Thanh toán thành công');
        assert.equal(enabled.dom.window.document.getElementById('student-dialog').open, false);
        await enabled.loadInvoices();
        assert.equal(enabled.calls.filter(call => call.url === '/api/HoaDon').length, invoiceReadsBeforeDemo + 1);
        const invoice = enabled.dom.window.document.querySelector('.st-invoice');
        assert.match(invoice.textContent, /Đã xác nhận thanh toán/);
        assert.match(invoice.textContent, /Thành công/);
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
        assert.doesNotMatch(invoice.textContent, /Đã xác nhận thanh toán/);
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
        assert.equal(dialog.querySelector('#student-dialog-title').textContent, 'Không thể xác nhận thanh toán');
        assert.equal(dialog.querySelector('[role="alert"]').textContent, 'Giao dịch không thuộc hóa đơn.');
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
        { TieuDe: '<script>alert(1)</script>', NoiDung: 'Tin mới', NgayTao: '2026-10-24T12:00:00.000Z' }
    ]);
    assert.match(html, /Thông báo từ Quản lý/);
    assert.match(html, /Thanh toán/);
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
