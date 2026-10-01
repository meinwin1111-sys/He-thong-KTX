const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const studentService = require('../services/studentService');

const router = express.Router();

// GET /api/students/:id - Retrieve student information by ID
router.get('/:id', authenticate, authorize('Sinh viên', 'Quản lý'), async (req, res) => {
    try {
        const studentId = req.params.id;
        const student = await studentService.getStudentById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Sinh viên không tồn tại.' });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy thông tin sinh viên.', error: error.message });
    }
});

// POST /api/students - Create a new student
router.post('/', authenticate, authorize('Quản lý'), async (req, res) => {
    try {
        const newStudent = req.body;
        const createdStudent = await studentService.addStudent(newStudent);
        res.status(201).json(createdStudent);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi tạo sinh viên.', error: error.message });
    }
});

// PUT /api/students/:id - Update student information
router.put('/:id', authenticate, authorize('Sinh viên', 'Quản lý'), async (req, res) => {
    try {
        const studentId = req.params.id;
        const updatedStudent = await studentService.updateStudent(studentId, req.body);
        if (!updatedStudent) {
            return res.status(404).json({ message: 'Sinh viên không tồn tại.' });
        }
        res.json(updatedStudent);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi cập nhật thông tin sinh viên.', error: error.message });
    }
});

// DELETE /api/students/:id - Soft delete a student
router.delete('/:id', authenticate, authorize('Quản lý'), async (req, res) => {
    try {
        const studentId = req.params.id;
        const result = await studentService.deleteStudent(studentId);
        if (!result) {
            return res.status(404).json({ message: 'Sinh viên không tồn tại.' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi xóa sinh viên.', error: error.message });
    }
});

module.exports = router;