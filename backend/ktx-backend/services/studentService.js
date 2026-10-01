const studentRepository = require('../repositories/studentRepository');
const bcrypt = require('bcryptjs');

const createStudent = async (studentData) => {
    // Validate student data here (e.g., check for required fields)
    // Call the repository function to add the student
    const newStudent = await studentRepository.addStudent(studentData);
    return newStudent;
};

const updateStudent = async (studentId, studentData) => {
    // Validate student data here (e.g., check for required fields)
    // Call the repository function to update the student
    const updatedStudent = await studentRepository.updateStudent(studentId, studentData);
    return updatedStudent;
};

const getStudentById = async (studentId) => {
    // Call the repository function to retrieve the student by ID
    const student = await studentRepository.getStudentById(studentId);
    return student;
};

const getAllStudents = async () => {
    // Call the repository function to retrieve all students
    const students = await studentRepository.getAllStudents();
    return students;
};

const deleteStudent = async (studentId) => {
    // Call the repository function to delete the student (soft delete)
    const result = await studentRepository.deleteStudent(studentId);
    return result;
};

module.exports = {
    createStudent,
    updateStudent,
    getStudentById,
    getAllStudents,
    deleteStudent,
};