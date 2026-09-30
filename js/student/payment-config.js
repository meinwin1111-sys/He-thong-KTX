// Student billing only. Bank QR requires a real receiving account and provider integration.
window.StudentPaymentConfig = Object.freeze({
    mode: 'demo',
    bank: Object.freeze({ bankId: '', accountNumber: '', accountName: '' })
});
