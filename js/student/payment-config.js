const studentDemoPaymentsEnabled = window.KTX_CONFIG?.allowStudentDemoAuth === true;

window.StudentPaymentConfig = Object.freeze({
    mode: studentDemoPaymentsEnabled ? 'demo' : 'backend',
    bank: Object.freeze({ bankId: '', accountNumber: '', accountName: '' })
});
