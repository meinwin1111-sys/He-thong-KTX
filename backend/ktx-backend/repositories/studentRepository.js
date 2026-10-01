const sql = require('mssql');
const config = require('../config/database');

// Function to add a new student
const addStudent = async (studentData) => {
    const pool = await sql.connect(config);
    const result = await pool.request()
        .input('MaSinhVien', sql.NVarChar(30), studentData.MaSinhVien)
        .input('Ten', sql.NVarChar(50), studentData.Ten)
        .input('NgaySinh', sql.Date, studentData.NgaySinh)
        .input('GioiTinh', sql.NVarChar(10), studentData.GioiTinh)
        .input('SoDienThoai', sql.NVarChar(10), studentData.SoDienThoai)
        .input('Email', sql.NVarChar(50), studentData.Email)
        .input('Truong', sql.NVarChar(50), studentData.Truong)
        .input('Lop', sql.NVarChar(50), studentData.Lop)
        .input('DiaChi', sql.NVarChar(255), studentData.DiaChi)
        .execute('sp_ThemSinhVien');

    return result.recordset[0];
};

// Function to update student information
const updateStudent = async (studentData) => {
    const pool = await sql.connect(config);
    const result = await pool.request()
        .input('MaSinhVien', sql.NVarChar(30), studentData.MaSinhVien)
        .input('Ten', sql.NVarChar(50), studentData.Ten)
        .input('NgaySinh', sql.Date, studentData.NgaySinh)
        .input('GioiTinh', sql.NVarChar(10), studentData.GioiTinh)
        .input('SoDienThoai', sql.NVarChar(10), studentData.SoDienThoai)
        .input('Email', sql.NVarChar(50), studentData.Email)
        .input('Truong', sql.NVarChar(50), studentData.Truong)
        .input('Lop', sql.NVarChar(50), studentData.Lop)
        .input('DiaChi', sql.NVarChar(255), studentData.DiaChi)
        .execute('sp_CapNhatSinhVien');

    return result.recordset[0];
};

// Function to get student details by student ID
const getStudentById = async (maSinhVien) => {
    const pool = await sql.connect(config);
    const result = await pool.request()
        .input('MaSinhVien', sql.NVarChar(30), maSinhVien)
        .query('SELECT * FROM vw_SinhVienChiTiet WHERE MaSinhVien = @MaSinhVien');

    return result.recordset[0];
};

// Function to delete a student (soft delete)
const deleteStudent = async (maSinhVien) => {
    const pool = await sql.connect(config);
    const result = await pool.request()
        .input('MaSinhVien', sql.NVarChar(30), maSinhVien)
        .execute('sp_XoaSinhVien');

    return result.rowsAffected[0];
};

module.exports = {
    addStudent,
    updateStudent,
    getStudentById,
    deleteStudent
};