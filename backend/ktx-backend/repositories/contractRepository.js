// contractRepository.js
const sql = require('mssql');
const config = require('../config/database');

// Function to create a new contract
const createContract = async (contractData) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('MaHopDong', sql.NVarChar, contractData.MaHopDong)
            .input('MaSinhVien', sql.NVarChar, contractData.MaSinhVien)
            .input('TenPhong', sql.NVarChar, contractData.TenPhong)
            .input('NgayBatDau', sql.DateTime, contractData.NgayBatDau)
            .input('NgayKetThuc', sql.DateTime, contractData.NgayKetThuc)
            .execute('sp_TaoHopDong');

        return result.recordset[0];
    } catch (error) {
        throw error;
    }
};

// Function to update an existing contract
const updateContract = async (contractId, contractData) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('MaHopDong', sql.NVarChar, contractId)
            .input('NgayKetThuc', sql.DateTime, contractData.NgayKetThuc)
            .execute('sp_CapNhatHopDong');

        return result.recordset[0];
    } catch (error) {
        throw error;
    }
};

// Function to end a contract
const endContract = async (contractId, endDate) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('MaHopDong', sql.NVarChar, contractId)
            .input('NgayKetThucThucTe', sql.DateTime, endDate)
            .execute('sp_KetThucHopDong');

        return result.recordset[0];
    } catch (error) {
        throw error;
    }
};

// Function to get contract details
const getContractDetails = async (contractId) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('MaHopDong', sql.NVarChar, contractId)
            .query('SELECT * FROM vw_HopDongSapHetHan WHERE MaHopDong = @MaHopDong');

        return result.recordset[0];
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createContract,
    updateContract,
    endContract,
    getContractDetails,
};