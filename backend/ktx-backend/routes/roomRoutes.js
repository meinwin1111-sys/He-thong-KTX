const express = require('express');
const roomController = require('../services/roomService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms - Retrieve all rooms
router.get('/', authenticate, authorize('Quản lý'), roomController.getAllRooms);

// GET /api/rooms/:id - Retrieve room details by ID
router.get('/:id', authenticate, authorize('Quản lý', 'Sinh viên'), roomController.getRoomById);

// POST /api/rooms - Create a new room
router.post('/', authenticate, authorize('Quản lý'), roomController.createRoom);

// PUT /api/rooms/:id - Update room status
router.put('/:id', authenticate, authorize('Quản lý'), roomController.updateRoomStatus);

// DELETE /api/rooms/:id - Soft delete a room
router.delete('/:id', authenticate, authorize('Quản lý'), roomController.deleteRoom);

module.exports = router;