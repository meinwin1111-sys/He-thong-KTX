const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

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
context.StudentAuth = { session: () => ({ isBackend: false }) };

vm.runInNewContext(load('js/student/helpers.js'), context, { filename: 'helpers.js' });
vm.runInNewContext(load('js/student/BangTree.js'), context, { filename: 'BangTree.js' });
vm.runInNewContext(load('js/student/TrangChu.js'), context, { filename: 'TrangChu.js' });
vm.runInNewContext(load('js/student/YeuCauHoTro.js'), context, { filename: 'YeuCauHoTro.js' });

test('formats VND with a non-breaking space', () => {
    assert.equal(ui.helpers.money(1200000), '1.200.000\u00a0đ');
});

test('renders one roomless state and never claims payment without invoices', () => {
    const html = ui.pages.home.render();
    assert.equal((html.match(/Bạn chưa được xếp phòng/g) || []).length, 1);
    assert.match(html, /data-dashboard-room-empty(?! hidden)/);
    assert.match(html, /data-dashboard-residence-panel hidden/);
    assert.doesNotMatch(html, /đã thanh toán/i);
    assert.doesNotMatch(html, /Đang tải/);
    assert.match(html, /data-dashboard-debt>—<\/strong>/);
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
