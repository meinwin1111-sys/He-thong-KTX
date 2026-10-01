const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authenticate, authorize } = require('../middleware/auth');

// Route to create a payment
router.post('/create', authenticate, authorize('Sinh viên', 'Quản lý'), async (req, res) => {
    try {
        const paymentData = req.body;
        const result = await paymentService.createPayment(paymentData);
        res.status(201).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
});

// Route to get payment history
router.get('/history', authenticate, authorize('Sinh viên', 'Quản lý'), async (req, res) => {
    try {
        const userId = req.user.id; // Assuming user ID is stored in the token
        const history = await paymentService.getPaymentHistory(userId);
        res.status(200).json(history);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
});

// Route to process payment confirmation
router.post('/confirm/:transactionId', authenticate, authorize('Quản lý'), async (req, res) => {
    try {
        const transactionId = req.params.transactionId;
        const confirmationData = req.body;
        const result = await paymentService.confirmPayment(transactionId, confirmationData);
        res.status(200).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
});

// Route to reject payment
router.post('/reject/:transactionId', authenticate, authorize('Quản lý'), async (req, res) => {
    try {
        const transactionId = req.params.transactionId;
        const rejectionReason = req.body.reason;
        const result = await paymentService.rejectPayment(transactionId, rejectionReason);
        res.status(200).json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
});

module.exports = router;