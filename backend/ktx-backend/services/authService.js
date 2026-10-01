const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authRepository = require('../repositories/authRepository');
const { JWT_SECRET } = process.env;

const login = async (email, password) => {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
        throw new Error('Tài khoản không tồn tại');
    }

    const isMatch = await bcrypt.compare(password, user.MatKhau);
    if (!isMatch) {
        await authRepository.incrementFailedLoginAttempts(user.MaSinhVien);
        throw new Error('Mật khẩu không chính xác');
    }

    if (user.TrangThai === 'Khóa') {
        throw new Error('Tài khoản đã bị khóa');
    }

    const token = jwt.sign({ user: { MaSinhVien: user.MaSinhVien, VaiTro: user.VaiTro } }, JWT_SECRET, { expiresIn: '8h' });
    await authRepository.resetFailedLoginAttempts(user.MaSinhVien);
    await authRepository.updateLastLogin(user.MaSinhVien);

    return { user, token };
};

const register = async (studentData) => {
    const existingUser = await authRepository.findUserByEmail(studentData.email);
    if (existingUser) {
        throw new Error('Gmail đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(studentData.password, 12);
    const newUser = await authRepository.createUser({ ...studentData, MatKhau: hashedPassword });

    return newUser;
};

const changePassword = async (userId, oldPassword, newPassword) => {
    const user = await authRepository.findUserById(userId);
    if (!user) {
        throw new Error('Tài khoản không tồn tại');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.MatKhau);
    if (!isMatch) {
        throw new Error('Mật khẩu cũ không chính xác');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await authRepository.updatePassword(userId, hashedNewPassword);
};

module.exports = {
    login,
    register,
    changePassword,
};