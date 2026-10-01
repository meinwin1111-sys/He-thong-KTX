const test = require('node:test');
const assert = require('node:assert/strict');
const { createPaymentWebhookSignature, verifyPaymentWebhookSignature } = require('./payment-webhook');

const secret = 'e2e-webhook-secret-with-at-least-32-characters';
const payload = {
    MaHoaDon: 'E2E_PAYMENT_001',
    SoTien: 50000,
    MaThamChieuNgoai: 'BANK-REF-001',
    NoiDungCK: 'KTX E2E_PAYMENT_001'
};

test('payment webhook signature verifies only the signed invoice transfer details', () => {
    const signature = createPaymentWebhookSignature(secret, payload);
    assert.equal(verifyPaymentWebhookSignature(secret, payload, signature), true);
    assert.equal(verifyPaymentWebhookSignature(secret, { ...payload, SoTien: 49999 }, signature), false);
    assert.equal(verifyPaymentWebhookSignature(secret, payload, 'invalid'), false);
    assert.equal(verifyPaymentWebhookSignature('different webhook secret of sufficient length', payload, signature), false);
});
