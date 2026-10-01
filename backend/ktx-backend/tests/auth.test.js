const request = require('supertest');
const app = require('../server'); // Adjust the path if necessary
const db = require('../config/database'); // Adjust the path if necessary
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Authentication Tests', () => {
    beforeAll(async () => {
        await db.connect(); // Ensure the database connection is established
    });

    afterAll(async () => {
        await db.close(); // Close the database connection after tests
    });

    describe('POST /api/login', () => {
        it('should login successfully with valid credentials', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    email: 'test@gmail.com',
                    password: 'validPassword'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('role', 'Student'); // Adjust based on your role structure
        });

        it('should return 401 for invalid password', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    email: 'test@gmail.com',
                    password: 'invalidPassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Sai mật khẩu'); // Adjust based on your error message
        });

        it('should return 403 for locked account', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    email: 'locked@gmail.com',
                    password: 'validPassword'
                });

            expect(response.status).toBe(403);
            expect(response.body.message).toBe('Tài khoản bị khóa'); // Adjust based on your error message
        });
    });

    describe('POST /api/register', () => {
        it('should register a new student successfully', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({
                    name: 'New Student',
                    code: 'SV001',
                    birthday: '2000-01-01',
                    gender: 'Nam',
                    phone: '0123456789',
                    email: 'newstudent@gmail.com',
                    school: 'Test School',
                    className: 'Test Class',
                    address: 'Test Address',
                    password: 'validPassword'
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message', 'Đăng ký thành công'); // Adjust based on your success message
        });

        it('should return 409 for duplicate email', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({
                    name: 'Duplicate Student',
                    code: 'SV002',
                    birthday: '2000-01-01',
                    gender: 'Nam',
                    phone: '0123456789',
                    email: 'newstudent@gmail.com', // Using the same email as before
                    school: 'Test School',
                    className: 'Test Class',
                    address: 'Test Address',
                    password: 'validPassword'
                });

            expect(response.status).toBe(409);
            expect(response.body.message).toBe('Email đã tồn tại'); // Adjust based on your error message
        });

        it('should return 400 for invalid student code', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({
                    name: 'Invalid Code Student',
                    code: 'SV003123456789012345678901234567890', // Exceeding max length
                    birthday: '2000-01-01',
                    gender: 'Nam',
                    phone: '0123456789',
                    email: 'invalidcode@gmail.com',
                    school: 'Test School',
                    className: 'Test Class',
                    address: 'Test Address',
                    password: 'validPassword'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Mã sinh viên không hợp lệ'); // Adjust based on your error message
        });
    });
});