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
    data.invoices = [
        { id: 'HD-A', month: '2026-09', totalAmount: 1250000, room: 1000000, electricity: 200000, water: 50000, due: '2020-01-01', paid: false },
        { id: 'HĐ-B', month: '2026-10', totalAmount: 2040000, room: 1900000, electricity: 90000, water: 50000, due: '2099-01-01', paid: false }
    ];
    data.payments = [];
    run('HoaDon.js');
    return { context, data, env, billing: context.StudentUI.billing, store: context.KTXPaymentDemo };
}

test('QR uses selected invoice, signed-in identity, month and UTF-8 content; opening does not pay', () => {
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
    assert.match(billing.qrModal('HD-A'), /<svg/);
    assert.equal(payload.amount, 1250000);
    assert.equal(payload.studentId, 'TEST-A');
    const html = billing.qrModal('HĐ-B');
    assert.equal(payload.amount, 2040000);
    assert.equal(payload.paymentContent, 'KTX HĐ-B TEST-A');
    assert.match(html, /2026-10/);
    assert.match(html, /DEMO \/ SANDBOX/);
    assert.match(html, /không thực hiện giao dịch tiền thật/);
    assert.equal(JSON.stringify([...env.values]), original);
    assert.equal(data.payments.length, 0);
});

test('online SUCCESS pays once, reduces only selected debt, generates receipt and survives refresh', async () => {
    const { billing, store, env, data } = setup();
    const before = billing.summary();
    const receipt = await billing.pay('HD-A', 'ONLINE');
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
    await assert.rejects(billing.pay('HD-A', 'ONLINE'), /đã thanh toán/);
    await assert.rejects(billing.pay('HD-A', 'CASH'), /đã thanh toán/);
    assert.throws(() => billing.qrModal('HD-A'), /đã thanh toán/);
    const refreshed = setup('TEST-A', env);
    assert.equal(refreshed.data.payments.length, 1);
    assert.equal(refreshed.billing.summary().debt, 2040000);
    assert.equal(refreshed.store.all()[0].payments[0].transactionId, receipt.transactionId);
});

test('cash waits without reducing debt/history; shared Admin confirms and Student reload sees receipt', async () => {
    const { billing, data, env } = setup();
    const before = billing.summary().debt;
    const request = await billing.pay('HD-A', 'CASH');
    assert.equal(request.status, 'WAITING_CASH');
    assert.equal(request.studentName, 'Sinh viên TEST-A');
    assert.equal(request.paymentMethod, 'CASH');
    assert.equal(request.amount, 1250000);
    assert(Number.isFinite(Date.parse(request.requestedAt)));
    assert.equal(data.invoices[0].paid, false);
    assert.equal(billing.summary().debt, before);
    assert.equal(data.payments.length, 0);
    assert.equal(billing.canPay(data.invoices[0]), false);
    await assert.rejects(billing.pay('HD-A', 'CASH'), /chờ thanh toán tiền mặt/);
    await assert.rejects(billing.pay('HD-A', 'ONLINE'), /chờ thanh toán tiền mặt/);
    assert.throws(() => billing.qrModal('HD-A'), /chờ thanh toán tiền mặt/);
    const admin = setup('TEST-B', env).store;
    const pending = admin.all().flatMap(r => r.requests).filter(r => r.status === 'WAITING_CASH');
    assert.equal(pending.length, 1);
    const receipt = await admin.confirmCash('TEST-A', 'HD-A', { id: 42, name: 'Admin test' });
    assert.match(receipt.transactionId, /^CASH-\d{8}-/);
    assert.equal(receipt.confirmedBy.name, 'Admin test');
    assert.equal(receipt.paymentMethod, 'CASH');
    assert.equal(receipt.amount, 1250000);
    billing.sync();
    assert.equal(billing.summary().debt, before - 1250000);
    assert.equal(data.invoices[0].status, 'PAID');
    assert.equal(data.payments.length, 1);
    assert.equal(setup('TEST-A', env).data.payments[0].transactionId, receipt.transactionId);
    await assert.rejects(admin.confirmCash('TEST-A', 'HD-A', {}), /không còn chờ/);
});

test('same invoice IDs stay isolated between students; stale session cannot pay', async () => {
    const a = setup();
    const b = setup('TEST-B', a.env);
    await a.billing.pay('HD-A', 'ONLINE');
    b.billing.sync();
    assert.equal(b.data.invoices[0].paid, false);
    assert.equal(b.data.payments.length, 0);
    assert.equal(b.billing.qrDetails('HD-A').studentId, 'TEST-B');
    a.context.StudentAuth.session = () => ({ code: 'TEST-B' });
    await assert.rejects(a.billing.pay('HĐ-B', 'ONLINE'), /Phiên sinh viên/);
});

test('concurrent tabs cannot double-pay or race online with cash request', async () => {
    const a = setup();
    const b = setup('TEST-A', a.env);
    const results = await Promise.allSettled([a.billing.pay('HD-A', 'ONLINE'), b.billing.pay('HD-A', 'CASH')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(a.store.read('TEST-A').payments.length, 1);
    assert.equal(a.store.read('TEST-A').requests.length, 0);
    await a.billing.pay('HĐ-B', 'CASH');
    const confirmations = await Promise.allSettled([a.store.confirmCash('TEST-A', 'HĐ-B', {}), b.store.confirmCash('TEST-A', 'HĐ-B', {})]);
    assert.equal(confirmations.filter(r => r.status === 'fulfilled').length, 1);
    const saved = a.store.read('TEST-A');
    assert.equal(saved.payments.length, 2);
    assert.notEqual(saved.payments[0].transactionId, saved.payments[1].transactionId);
});

test('invalid amount, missing invoice and failed persistence never mark invoice paid', async () => {
    const { store, billing, env } = setup();
    assert.equal(store.amount({ remainingAmount: 250000, totalAmount: 1250000 }), 250000);
    assert.equal(store.amount({ room: 100, electricity: 20, water: 10 }), 130);
    assert.throws(() => store.amount({ totalAmount: -1 }), /không hợp lệ/);
    assert.throws(() => billing.qrDetails('missing'), /không tồn tại/);
    const original = JSON.stringify([...env.values]);
    env.storage.setItem = () => { throw new Error('Quota exceeded'); };
    await assert.rejects(billing.pay('HD-A', 'ONLINE'), /Quota exceeded/);
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

test('Admin area shows shared cash queue, cancellation preserves debt, confirmation shows both payment methods', async () => {
    const { context, billing, store } = setup();
    await billing.pay('HD-A', 'CASH');
    await billing.pay('HĐ-B', 'ONLINE');
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../module/ThanhToanDemo.js'), 'utf8'), context);
    const host = { isConnected: true, innerHTML: '', addEventListener(type, handler) { this.click = handler; } };
    context.currentUser = { id: 9, fullName: 'Admin test' };
    context.mountThanhToanDemo(host);
    assert.match(host.innerHTML, /Xác nhận thu tiền mặt \(1\)/);
    assert.match(host.innerHTML, /Sinh viên TEST-A/);
    const button = { dataset: { student: 'TEST-A', cashInvoice: 'HD-A' } };
    const event = { target: { closest: selector => selector === '[data-cash-invoice]' ? button : null } };
    let confirmation;
    context.confirm = message => { confirmation = message; return false; };
    await host.click(event);
    assert.match(confirmation, /HD-A/);
    assert.match(confirmation, /Sinh viên TEST-A/);
    assert.equal(store.read('TEST-A').invoices[0].status, 'WAITING_CASH');
    context.confirm = () => true;
    await host.click(event);
    assert.equal(store.read('TEST-A').invoices[0].status, 'PAID');
    assert.match(host.innerHTML, /Xác nhận thu tiền mặt \(0\)/);
    await host.click({ target: { closest: selector => selector === '[data-demo-tab]' ? { dataset: { demoTab: 'history' } } : null } });
    assert.match(host.innerHTML, /CASH-/);
    assert.match(host.innerHTML, /DEMO-/);
    assert.match(host.innerHTML, /Tiền mặt/);
    assert.match(host.innerHTML, /Online/);
    assert.match(host.innerHTML, /Admin test/);
});
