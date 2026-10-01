// This file contains functions for managing room data, including room availability and status updates.

const sql = require('mssql');
const { mapPaymentStatusToDatabase } = require('../server');

const getRoomById = async (roomId) => {
    const request = new sql.Request();
    request.input('RoomId', sql.NVarChar, roomId);
    const result = await request.query('SELECT * FROM Rooms WHERE RoomId = @RoomId');
    return result.recordset[0];
};

const getAllRooms = async () => {
    const request = new sql.Request();
    const result = await request.query('SELECT * FROM Rooms');
    return result.recordset;
};

const updateRoomStatus = async (roomId, status) => {
    const request = new sql.Request();
    request.input('RoomId', sql.NVarChar, roomId);
    request.input('Status', sql.NVarChar, status);
    await request.query('UPDATE Rooms SET Status = @Status WHERE RoomId = @RoomId');
};

const checkRoomAvailability = async (roomId) => {
    const room = await getRoomById(roomId);
    return room && room.Status === 'Available';
};

module.exports = {
    getRoomById,
    getAllRooms,
    updateRoomStatus,
    checkRoomAvailability,
};