const sql = require('mssql');
const contractRepository = require('../repositories/contractRepository');
const { mapPaymentStatusToDatabase } = require('../utils/mapping');

const createContract = async (contractData) => {
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        const result = await contractRepository.createContract(transaction, contractData);
        await transaction.commit();

        return result;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const updateContract = async (contractId, contractData) => {
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        const result = await contractRepository.updateContract(transaction, contractId, contractData);
        await transaction.commit();

        return result;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const extendContract = async (contractId, extensionData) => {
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        const result = await contractRepository.extendContract(transaction, contractId, extensionData);
        await transaction.commit();

        return result;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const terminateContract = async (contractId, terminationDate) => {
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        const result = await contractRepository.terminateContract(transaction, contractId, terminationDate);
        await transaction.commit();

        return result;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const getContractsByStudentId = async (studentId) => {
    try {
        const contracts = await contractRepository.getContractsByStudentId(studentId);
        return contracts;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createContract,
    updateContract,
    extendContract,
    terminateContract,
    getContractsByStudentId,
};