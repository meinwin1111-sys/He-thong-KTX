const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { JWT_SECRET } = process.env;

// Middleware to authenticate JWT token
const authenticate = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token không tồn tại' });
    }

    try {
        const decoded = await promisify(jwt.verify)(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token không hợp lệ' });
    }
};

// Middleware to authorize user roles
const authorize = (roles = []) => {
    return (req, res, next) => {
        if (roles.length && !roles.includes(req.user.VaiTro)) {
            return res.status(403).json({ message: 'Không có quyền truy cập' });
        }
        next();
    };
};

module.exports = {
    authenticate,
    authorize,
};