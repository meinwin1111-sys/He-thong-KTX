const sql = require('mssql');
const bcrypt = require('bcryptjs');
const config = require('../config/database');

// Function to find user by email
const findUserByEmail = async (email) => {
    try {
        const pool = await config.connect();
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('SELECT * FROM TaiKhoan WHERE Email = @Email');
        return result.recordset[0];
    } catch (error) {
        throw error;
    }
};

// Function to create a new user
const createUser = async (userData) => {
    const { MaSinhVien, Email, MatKhau, TenHienThi, SoDienThoai, VaiTro, TrangThai } = userData;
    try {
        const pool = await config.connect();
        await pool.request()
            .input('MaSinhVien', sql.NVarChar(30), MaSinhVien)
            .input('Email', sql.NVarChar, Email)
            .input('MatKhau', sql.NVarChar, MatKhau)
            .input('TenHienThi', sql.NVarChar, TenHienThi)
            .input('SoDienThoai', sql.NVarChar, SoDienThoai)
            .input('VaiTro', sql.NVarChar, VaiTro)
            .input('TrangThai', sql.NVarChar, TrangThai)
            .execute('sp_ThemSinhVien'); // Assuming this stored procedure handles the insertion
    } catch (error) {
        throw error;
    }
};

// Function to validate user password
const validatePassword = async (inputPassword, storedPassword) => {
    return await bcrypt.compare(inputPassword, storedPassword);
};

// Function to update failed login attempts
const updateFailedLoginAttempts = async (email) => {
    try {
        const pool = await config.connect();
        await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('UPDATE TaiKhoan SET SoLanDangNhapSai = SoLanDangNhapSai + 1 WHERE Email = @Email');
    } catch (error) {
        throw error;
    }
};

// Function to reset failed login attempts
const resetFailedLoginAttempts = async (email) => {
    try {
        const pool = await config.connect();
        await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('UPDATE TaiKhoan SET SoLanDangNhapSai = 0 WHERE Email = @Email');
    } catch (error) {
        throw error;
    }
};

// Function to lock account
const lockAccount = async (email) => {
    try {
        const pool = await config.connect();
        await pool.request()
            .input('Email', sql.NVarChar, email)
            .query('UPDATE TaiKhoan SET KhoaDenLuc = DATEADD(MINUTE, 15, GETDATE()) WHERE Email = @Email');
    } catch (error) {
        throw error;
    }
};

module.exports = {
    findUserByEmail,
    createUser,
    validatePassword,
    updateFailedLoginAttempts,
    resetFailedLoginAttempts,
    lockAccount
};