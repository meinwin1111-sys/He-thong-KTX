// This file contains functions for managing payment transactions, including creating payment records and updating their statuses.

const sql = require('mssql');
const { mapPaymentStatusToDatabase } = require('../utils/paymentUtils');

// Function to create a new payment transaction
const createPaymentTransaction = async (transactionData) => {
    const { studentId, amount, paymentMethod } = transactionData;
    const request = new sql.Request();
    
    try {
        // Begin transaction
        const transaction = new sql.Transaction();
        await transaction.begin();

        // Create payment record
        const result = await request
            .input('StudentId', sql.NVarChar(30), studentId)
            .input('Amount', sql.Decimal(18, 2), amount)
            .input('PaymentMethod', sql.NVarChar(50), mapPaymentStatusToDatabase(paymentMethod))
            .execute('sp_CreatePaymentTransaction');

        // Commit transaction
        await transaction.commit();
        return result.recordset[0];
    } catch (error) {
        // Rollback transaction in case of error
        await transaction.rollback();
        throw error;
    }
};

// Function to update payment status
const updatePaymentStatus = async (paymentId, status) => {
    const request = new sql.Request();
    
    try {
        const result = await request
            .input('PaymentId', sql.NVarChar(50), paymentId)
            .input('Status', sql.NVarChar(50), mapPaymentStatusToDatabase(status))
            .execute('sp_UpdatePaymentStatus');

        return result.rowsAffected[0];
    } catch (error) {
        throw error;
    }
};

// Function to retrieve payment history for a student
const getPaymentHistory = async (studentId) => {
    const request = new sql.Request();
    
    try {
        const result = await request
            .input('StudentId', sql.NVarChar(30), studentId)
            .execute('sp_GetPaymentHistory');

        return result.recordset;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createPaymentTransaction,
    updatePaymentStatus,
    getPaymentHistory,
};