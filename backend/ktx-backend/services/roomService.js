// This file contains business logic for managing room data, including availability checks and updates.

const db = require('../config/database');
const roomRepository = require('../repositories/roomRepository');

const getAllRooms = async () => {
    try {
        const rooms = await roomRepository.getAllRooms();
        return rooms;
    } catch (error) {
        throw new Error('Error fetching rooms: ' + error.message);
    }
};

const getRoomById = async (roomId) => {
    try {
        const room = await roomRepository.getRoomById(roomId);
        if (!room) {
            throw new Error('Room not found');
        }
        return room;
    } catch (error) {
        throw new Error('Error fetching room: ' + error.message);
    }
};

const updateRoomStatus = async (roomId, status) => {
    try {
        const updatedRoom = await roomRepository.updateRoomStatus(roomId, status);
        return updatedRoom;
    } catch (error) {
        throw new Error('Error updating room status: ' + error.message);
    }
};

const checkRoomAvailability = async (roomId) => {
    try {
        const isAvailable = await roomRepository.checkRoomAvailability(roomId);
        return isAvailable;
    } catch (error) {
        throw new Error('Error checking room availability: ' + error.message);
    }
};

module.exports = {
    getAllRooms,
    getRoomById,
    updateRoomStatus,
    checkRoomAvailability,
};