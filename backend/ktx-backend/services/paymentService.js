const sql = require('mssql');
const paymentRepository = require('../repositories/paymentRepository');
const { mapPaymentStatusToDatabase } = require('../utils/mapping');

const createPaymentTransaction = async (paymentData) => {
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        const { invoiceId, items, paymentMethod } = paymentData;

        // Check for existing pending transactions
        const existingTransaction = await paymentRepository.checkPendingTransaction(invoiceId);
        if (existingTransaction) {
            throw new Error('Hạng mục đã thuộc giao dịch PENDING khác.');
        }

        // Create payment transaction
        const transactionId = await paymentRepository.createTransaction(invoiceId, paymentMethod, transaction);
        
        // Process each item in the transaction
        for (const item of items) {
            await paymentRepository.addTransactionDetail(transactionId, item.id, item.amount, transaction);
        }

        await transaction.commit();
        return { status: 'SUCCESS', transactionId };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const confirmPayment = async (transactionId) => {
    try {
        const result = await paymentRepository.updateTransactionStatus(transactionId, 'SUCCESS');
        return result;
    } catch (error) {
        throw error;
    }
};

const rejectPayment = async (transactionId, reason) => {
    try {
        const result = await paymentRepository.updateTransactionStatus(transactionId, 'REJECTED', reason);
        return result;
    } catch (error) {
        throw error;
    }
};

const getPaymentHistory = async (studentId) => {
    try {
        const history = await paymentRepository.getPaymentHistory(studentId);
        return history;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createPaymentTransaction,
    confirmPayment,
    rejectPayment,
    getPaymentHistory,
};