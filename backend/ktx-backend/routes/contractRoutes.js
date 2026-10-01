const express = require('express');
const router = express.Router();
const contractService = require('../services/contractService');
const { authenticate, authorize } = require('../middleware/auth');

// Create a new contract
router.post('/', authenticate, authorize('Quản lý'), async (req, res, next) => {
    try {
        const contractData = req.body;
        const newContract = await contractService.createContract(contractData);
        res.status(201).json(newContract);
    } catch (error) {
        next(error);
    }
});

// Update an existing contract
router.put('/:id', authenticate, authorize('Quản lý'), async (req, res, next) => {
    try {
        const contractId = req.params.id;
        const contractData = req.body;
        const updatedContract = await contractService.updateContract(contractId, contractData);
        res.status(200).json(updatedContract);
    } catch (error) {
        next(error);
    }
});

// Get contract details
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const contractId = req.params.id;
        const contractDetails = await contractService.getContractDetails(contractId);
        res.status(200).json(contractDetails);
    } catch (error) {
        next(error);
    }
});

// Get all contracts
router.get('/', authenticate, authorize('Quản lý'), async (req, res, next) => {
    try {
        const contracts = await contractService.getAllContracts();
        res.status(200).json(contracts);
    } catch (error) {
        next(error);
    }
});

// Delete a contract (soft delete)
router.delete('/:id', authenticate, authorize('Quản lý'), async (req, res, next) => {
    try {
        const contractId = req.params.id;
        await contractService.deleteContract(contractId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

module.exports = router;