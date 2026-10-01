const test = require('node:test');
const assert = require('node:assert/strict');
const { createVietQrPayload, crc16CcittFalse } = require('./payment-qr');

function parseTlv(payload) {
    const fields = [];
    for (let offset = 0; offset < payload.length;) {
        const id = payload.slice(offset, offset + 2);
        const length = Number(payload.slice(offset + 2, offset + 4));
        const start = offset + 4;
        fields.push({ id, value: payload.slice(start, start + length) });
        offset = start + length;
    }
    return fields;
}

test('VietQR uses NAPAS account fields, fixed amount, purpose and a valid CRC', () => {
    const payload = createVietQrPayload({
        bankBin: '970436',
        accountNumber: '0123456789',
        amount: 1650000,
        paymentContent: 'KTX HD2026100001'
    });
    const withoutCrc = payload.slice(0, -4);
    const root = parseTlv(payload.slice(0, -8));
    const merchant = parseTlv(root.find(field => field.id === '38').value);
    const bankAccount = parseTlv(merchant.find(field => field.id === '01').value);
    const purpose = parseTlv(root.find(field => field.id === '62').value);

    assert.equal(crc16CcittFalse('123456789'), '29B1');
    assert.equal(payload.slice(-4), crc16CcittFalse(withoutCrc));
    assert.equal(root.find(field => field.id === '01').value, '11');
    assert.equal(merchant.find(field => field.id === '00').value, 'A000000727');
    assert.equal(bankAccount.find(field => field.id === '00').value, '970436');
    assert.equal(bankAccount.find(field => field.id === '01').value, '0123456789');
    assert.equal(merchant.find(field => field.id === '02').value, 'QRIBFTTA');
    assert.equal(root.find(field => field.id === '53').value, '704');
    assert.equal(root.find(field => field.id === '54').value, '1650000');
    assert.equal(root.find(field => field.id === '58').value, 'VN');
    assert.equal(purpose.find(field => field.id === '08').value, 'KTX HD2026100001');
});

test('VietQR rejects invalid receiving account and transfer note data', () => {
    assert.throws(() => createVietQrPayload({
        bankBin: 'not-a-bin',
        accountNumber: '0123456789',
        amount: 1000,
        paymentContent: 'KTX HD001'
    }), TypeError);
    assert.throws(() => createVietQrPayload({
        bankBin: '970436',
        accountNumber: '0123456789',
        amount: 1000,
        paymentContent: 'KTX mã hóa đơn'
    }), TypeError);
});
