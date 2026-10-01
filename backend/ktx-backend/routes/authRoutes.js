const express = require('express');
const { login, register, changePassword } = require('../services/authService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// POST /api/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await login(email, password);
        res.json({ user, token: user.token });
    } catch (error) {
        next(error);
    }
});

// POST /api/register
router.post('/register', async (req, res, next) => {
    try {
        const newUser = await register(req.body);
        res.status(201).json(newUser);
    } catch (error) {
        next(error);
    }
});

// POST /api/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        await changePassword(req.user.email, oldPassword, newPassword);
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;