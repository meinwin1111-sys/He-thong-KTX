const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function environment() {
    const values = new Map();
    const queues = new Map();
    return {
        values,
        storage: {
            get length() { return values.size; }, key: i => [...values.keys()][i],
            getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)
        },
        locks: { request(key, callback) {
            const result = (queues.get(key) || Promise.resolve()).then(callback);
            queues.set(key, result.catch(() => {}));
            return result;
        } }
    };
}
function sampleInvoices() {
    return [
        { id: 'HD-A', month: '2026-09', due: '2020-01-01', paid: false, items: [
            { id: 'HD-A-01', code: 'ROOM', name: 'Tiền phòng', amount: 1000000, status: 'UNPAID' },
            { id: 'HD-A-02', code: 'ELECTRICITY', name: 'Tiền điện', amount: 200000, status: 'UNPAID' },
            { id: 'HD-A-03', code: 'WATER', name: 'Tiền nước', amount: 50000, status: 'UNPAID' }
        ] },
        { id: 'HĐ-B', month: '2026-10', due: '2099-01-01', paid: false, items: [
            { id: 'HĐ-B-01', code: 'ROOM', name: 'Tiền phòng', amount: 1500000, status: 'UNPAID' },
            { id: 'HĐ-B-02', code: 'ELECTRICITY', name: 'Tiền điện', amount: 200000, status: 'UNPAID' },
            { id: 'HĐ-B-03', code: 'WATER', name: 'Tiền nước', amount: 50000, status: 'UNPAID' },
            { id: 'HĐ-B-04', code: 'INTERNET', name: 'Internet', amount: 40000, status: 'UNPAID' },
            { id: 'HĐ-B-05', code: 'PENALTY', name: 'Phí phạt', amount: 250000, status: 'UNPAID' }
        ] }
    ];
}
function unpaidSelection(invoices, invoiceId) {
    const invoice = invoices.find(entry => entry.id === invoiceId);
    return [{ invoiceId, itemIds: invoice.items.filter(item => item.status === 'UNPAID').map(item => item.id) }];
}
function itemSelection(invoiceId, ...itemIds) {
    return [{ invoiceId, itemIds }];
}
function allUnpaid(invoices) {
    return invoices.map(invoice => ({
        invoiceId: invoice.id, itemIds: invoice.items.filter(item => item.status === 'UNPAID').map(item => item.id)
    })).filter(group => group.itemIds.length);
}
function setup(code = 'TEST-A', env = environment()) {
    const context = vm.createContext({ TextEncoder, Date, console, Event, crypto: webcrypto,
        navigator: { locks: env.locks }, localStorage: env.storage,
        StudentAuth: { session: () => ({ code, name: `Sinh viên ${code}`, email: `${code}@example.com` }) },
        dispatchEvent() {}, addEventListener() {}
    });
    context.window = context;
    const run = file => vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
    for (const file of ['../payment-demo.js', 'data.js', 'helpers.js', 'vendor/qrcode.js', 'payment-config.js']) run(file);
    const data = context.StudentUI.repository.data;
    data.invoices = sampleInvoices();
    data.payments = [];
    run('HoaDon.js');
    return { context, data, env, billing: context.StudentUI.billing, store: context.KTXPaymentDemo };
}
function flush() { return new Promise(resolve => setImmediate(resolve)); }

test('QR uses selected items, signed-in identity and UTF-8 content; opening does not pay', async () => {
    const { context, data, billing, env } = setup();
    const original = JSON.stringify([...env.values]);
    const generator = context.qrcode;
    let payload;
    context.qrcode = (...args) => {
        const qr = generator(...args);
        const addData = qr.addData;
        qr.addData = (bytes, mode) => { payload = JSON.parse(Buffer.from(bytes, 'latin1').toString('utf8')); addData(bytes, mode); };
        return qr;
    };
    assert.match(await billing.qrModal(unpaidSelection(data.invoices, 'HD-A')), /<svg/);
    assert.equal(payload.amount, 1250000);
    assert.equal(payload.studentId, 'TEST-A');
    assert.equal(payload.items.length, 3);
    const html = await billing.qrModal(itemSelection('HĐ-B', 'HĐ-B-04'));
    assert.equal(payload.amount, 40000);
    assert.equal(payload.items[0].itemId, 'HĐ-B-04');
    assert.match(payload.paymentContent, /^KTX TEST-A [A-Z0-9]+$/);
    assert.match(html, /Internet/);
    assert.match(html, /2026-10/);
    assert.match(html, /DEMO \/ SANDBOX/);
    assert.match(html, /không thực hiện giao dịch tiền thật/);
    assert.equal(JSON.stringify([...env.values]), original);
    assert.equal(data.payments.length, 0);
});

test('paying one item marks only that item PAID and invoice PARTIAL', async () => {
    const { billing, data } = setup();
    const before = billing.summary();
    const receipt = await billing.pay(itemSelection('HĐ-B', 'HĐ-B-04'), 'ONLINE');
    assert.equal(receipt.amount, 40000);
    assert.equal(receipt.items.map(item => item.itemId).join(), 'HĐ-B-04');
    assert.equal(data.invoices[1].items.find(item => item.id === 'HĐ-B-04').status, 'PAID');
    assert.equal(data.invoices[1].items.find(item => item.id === 'HĐ-B-01').status, 'UNPAID');
    assert.equal(data.invoices[1].status, 'PARTIAL');
    assert.equal(billing.status(data.invoices[1]), 'Đã thanh toán một phần');
    assert.equal(billing.summary().debt, before.debt - 40000);
    assert.equal(billing.summary().unpaid, before.unpaid);
});

test('selecting every unpaid item across invoices clears debt', async () => {
    const { billing, data, store } = setup();
    const receipt = await billing.pay(allUnpaid(data.invoices), 'ONLINE');
    assert.equal(receipt.amount, 3290000);
    assert.equal(billing.summary().debt, 0);
    assert.equal(billing.summary().unpaid, 0);
    assert.equal(store.status(data.invoices[0]), 'PAID');
    assert.equal(store.status(data.invoices[1]), 'PAID');
});

test('online SUCCESS pays once, reduces only selected debt, generates receipt and survives refresh', async () => {
    const { billing, store, env, data } = setup();
    const before = billing.summary();
    const receipt = await billing.pay(unpaidSelection(data.invoices, 'HD-A'), 'ONLINE');
    assert.equal(receipt.paymentStatus, 'SUCCESS');
    assert.equal(receipt.amount, 1250000);
    assert.equal(receipt.paymentMethod, 'ONLINE');
    assert.match(receipt.transactionId, /^DEMO-\d{8}-/);
    assert(Number.isFinite(Date.parse(receipt.paymentTime)));
    assert.equal(data.invoices[0].status, 'PAID');
    assert.equal(data.invoices[1].paid, false);
    assert.equal(billing.summary().debt, before.debt - 1250000);
    assert.equal(billing.summary().unpaid, before.unpaid - 1);
    assert.equal(store.read('TEST-A').requests.length, 0);
    await assert.rejects(billing.pay(unpaidSelection(data.invoices, 'HD-A'), 'ONLINE'), /đã thanh toán|không tồn tại|Chưa chọn/);
    await assert.rejects(billing.pay(itemSelection('HD-A', 'HD-A-01'), 'ONLINE'), /đã thanh toán/);
    await assert.rejects(billing.qrModal(itemSelection('HD-A', 'HD-A-01')), /đã thanh toán/);
    const refreshed = setup('TEST-A', env);
    assert.equal(refreshed.data.payments.length, 1);
    assert.equal(refreshed.billing.summary().debt, 2040000);
    assert.equal(refreshed.store.all()[0].payments[0].transactionId, receipt.transactionId);
});

test('cash locks selected items without reducing debt; Admin confirm and reject', async () => {
    const { billing, data, env, store } = setup();
    const before = billing.summary().debt;
    const request = await billing.pay(itemSelection('HD-A', 'HD-A-02'), 'CASH');
    assert.equal(request.status, 'WAITING_CASH');
    assert.equal(request.amount, 200000);
    assert.equal(request.items[0].itemId, 'HD-A-02');
    assert.equal(data.invoices[0].items.find(item => item.id === 'HD-A-02').status, 'WAITING_CASH');
    assert.equal(data.invoices[0].items.find(item => item.id === 'HD-A-01').status, 'UNPAID');
    assert.equal(billing.summary().debt, before);
    assert.equal(data.payments.length, 0);
    assert.equal(billing.canPay(data.invoices[0]), true);
    await assert.rejects(billing.pay(itemSelection('HD-A', 'HD-A-02'), 'CASH'), /chờ thanh toán tiền mặt/);
    await assert.rejects(billing.pay(itemSelection('HD-A', 'HD-A-02'), 'ONLINE'), /chờ thanh toán tiền mặt/);
    const other = await billing.pay(itemSelection('HD-A', 'HD-A-01'), 'ONLINE');
    assert.equal(other.amount, 1000000);
    const admin = setup('TEST-B', env).store;
    const pending = await admin.listCashRequests();
    assert.equal(pending.length, 1);
    const receipt = await admin.confirmCash('TEST-A', pending[0].id, { id: 42, name: 'Admin test' });
    assert.match(receipt.transactionId, /^CASH-\d{8}-/);
    assert.equal(receipt.confirmedBy.name, 'Admin test');
    assert.equal(receipt.amount, 200000);
    billing.sync();
    assert.equal(data.invoices[0].items.find(item => item.id === 'HD-A-02').status, 'PAID');
    await assert.rejects(admin.confirmCash('TEST-A', pending[0].id, {}), /không còn chờ/);

    const locked = await billing.pay(itemSelection('HĐ-B', 'HĐ-B-04'), 'CASH');
    await admin.rejectCash('TEST-A', locked.id);
    billing.sync();
    assert.equal(store.read('TEST-A').invoices[1].items.find(item => item.id === 'HĐ-B-04').status, 'UNPAID');
    assert.equal(store.read('TEST-A').requests.find(entry => entry.id === locked.id).status, 'CANCELLED');
});

test('same invoice IDs stay isolated between students; stale session cannot pay', async () => {
    const a = setup();
    const b = setup('TEST-B', a.env);
    await a.billing.pay(unpaidSelection(a.data.invoices, 'HD-A'), 'ONLINE');
    b.billing.sync();
    assert.equal(b.data.invoices[0].paid, false);
    assert.equal(b.data.payments.length, 0);
    assert.equal((await b.billing.qrDetails(itemSelection('HD-A', 'HD-A-01'))).studentId, 'TEST-B');
    a.context.StudentAuth.session = () => ({ code: 'TEST-B' });
    await assert.rejects(a.billing.pay(unpaidSelection(a.data.invoices, 'HĐ-B'), 'ONLINE'), /Phiên sinh viên/);
});

test('concurrent tabs cannot double-pay the same items or race online with cash request', async () => {
    const a = setup();
    const b = setup('TEST-A', a.env);
    const selection = unpaidSelection(a.data.invoices, 'HD-A');
    const results = await Promise.allSettled([a.billing.pay(selection, 'ONLINE'), b.billing.pay(selection, 'CASH')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(a.store.read('TEST-A').payments.length, 1);
    assert.equal(a.store.read('TEST-A').requests.length, 0);
    const cash = await a.billing.pay(unpaidSelection(a.store.read('TEST-A').invoices, 'HĐ-B'), 'CASH');
    const confirmations = await Promise.allSettled([
        a.store.confirmCash('TEST-A', cash.id, {}),
        b.store.confirmCash('TEST-A', cash.id, {})
    ]);
    assert.equal(confirmations.filter(r => r.status === 'fulfilled').length, 1);
    const saved = a.store.read('TEST-A');
    assert.equal(saved.payments.length, 2);
    assert.notEqual(saved.payments[0].transactionId, saved.payments[1].transactionId);
});

test('invalid amount, missing invoice and failed persistence never mark invoice paid', async () => {
    const { store, billing, env, data } = setup();
    assert.equal(store.amount({ remainingAmount: 250000, totalAmount: 1250000 }), 250000);
    assert.equal(store.amount({ room: 100, electricity: 20, water: 10 }), 130);
    assert.throws(() => store.amount({ totalAmount: -1 }), /không hợp lệ/);
    await assert.rejects(billing.qrDetails(itemSelection('missing', 'x')), /không tồn tại/);
    const original = JSON.stringify([...env.values]);
    env.storage.setItem = () => { throw new Error('Quota exceeded'); };
    await assert.rejects(billing.pay(unpaidSelection(data.invoices, 'HD-A'), 'ONLINE'), /Quota exceeded/);
    assert.equal(JSON.stringify([...env.values]), original);
    assert.equal(store.read('TEST-A').invoices[0].paid, false);
});

test('existing paid sample invoice/history retained during first initialization', () => {
    const { store } = setup();
    const old = { profile: { code: 'LEGACY', name: 'Legacy Student' }, room: { number: 'B01' },
        invoices: [{ id: 'OLD', paid: true, totalAmount: 100 }],
        payments: [{ id: 'GD001', invoiceId: 'OLD', date: '2026-09-01', amount: 100, method: 'Tiền mặt', status: 'Thành công' }] };
    const saved = store.initialize(old);
    assert.equal(saved.invoices[0].status, 'PAID');
    assert.equal(saved.payments[0].id, 'GD001');
    assert.equal(saved.payments[0].paymentMethod, 'CASH');
});

test('legacy room/electricity/water ledger migrates to items without dropping history', () => {
    const env = environment();
    env.storage.setItem('ktx.billing.demo.v1.LEGACY2', JSON.stringify({
        studentId: 'LEGACY2', studentName: 'Cũ', room: 'C01',
        invoices: [
            { id: 'OLD-1', month: '2026-01', room: 100, electricity: 20, water: 0, due: '2099-01-01', paid: false, status: 'UNPAID' },
            { id: 'OLD-2', month: '2025-12', room: 80, electricity: 10, water: 5, due: '2025-12-01', paid: true, status: 'PAID' },
            { id: 'OLD-3', month: '2026-02', room: 50, electricity: 10, water: 5, due: '2099-02-01', paid: false, status: 'WAITING_CASH' }
        ],
        payments: [{ id: 'GD-OLD', invoiceId: 'OLD-2', amount: 95, paymentMethod: 'ONLINE', status: 'SUCCESS', paymentTime: '2026-01-01T00:00:00.000Z' }],
        requests: [{ invoiceId: 'OLD-3', status: 'WAITING_CASH', amount: 65, studentId: 'LEGACY2' }]
    }));
    const { store } = setup('LEGACY2', env);
    const saved = store.read('LEGACY2');
    assert.equal(saved.invoices[0].items.length, 2);
    assert.equal(saved.invoices[0].items[0].id, 'OLD-1-ROOM');
    assert.equal(saved.invoices[1].items.every(item => item.status === 'PAID'), true);
    assert.equal(saved.invoices[2].status, 'WAITING_CASH');
    assert.equal(saved.invoices[2].items.every(item => item.status === 'WAITING_CASH'), true);
    assert.equal(saved.requests[0].items.length, 3);
    assert.equal(saved.payments[0].id, 'GD-OLD');
});

test('corrupt stored ledger is reported instead of overwritten', () => {
    const { store, env } = setup();
    const key = 'ktx.billing.demo.v1.TEST-A';
    env.storage.setItem(key, '{not json');
    assert.throws(() => store.read('TEST-A'), /JSON|Unexpected|not json/);
    assert.equal(env.storage.getItem(key), '{not json');
});

test('Admin area shows shared cash queue, cancellation preserves debt, confirmation shows both payment methods', async () => {
    const { context, billing, store, data } = setup();
    await billing.pay(unpaidSelection(data.invoices, 'HD-A'), 'CASH');
    await billing.pay(unpaidSelection(store.read('TEST-A').invoices, 'HĐ-B'), 'ONLINE');
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../module/ThanhToanDemo.js'), 'utf8'), context);
    const host = { isConnected: true, innerHTML: '', addEventListener(type, handler) { this.click = handler; } };
    context.currentUser = { id: 9, fullName: 'Admin test' };
    context.mountThanhToanDemo(host);
    await flush();
    assert.match(host.innerHTML, /Xác nhận thu tiền mặt \(1\)/);
    assert.match(host.innerHTML, /Sinh viên TEST-A/);
    assert.match(host.innerHTML, /Tiền phòng/);
    const requestId = store.read('TEST-A').requests.find(entry => entry.status === 'WAITING_CASH').id;
    const button = { dataset: { student: 'TEST-A', cashRequest: requestId } };
    const event = { target: { closest: selector => selector === '[data-cash-request]' ? button : null } };
    let confirmation;
    context.confirm = message => { confirmation = message; return false; };
    await host.click(event);
    assert.match(confirmation, /Sinh viên TEST-A/);
    assert.equal(store.read('TEST-A').invoices[0].status, 'WAITING_CASH');
    context.confirm = () => true;
    await host.click(event);
    assert.equal(store.read('TEST-A').invoices[0].status, 'PAID');
    assert.match(host.innerHTML, /Xác nhận thu tiền mặt \(0\)/);
    await host.click({ target: { closest: selector => selector === '[data-demo-tab]' ? { dataset: { demoTab: 'history' } } : null } });
    await flush();
    assert.match(host.innerHTML, /CASH-/);
    assert.match(host.innerHTML, /DEMO-/);
    assert.match(host.innerHTML, /Tiền mặt/);
    assert.match(host.innerHTML, /Online/);
    assert.match(host.innerHTML, /Admin test/);
    assert.match(host.innerHTML, /Hạng mục/);
});
