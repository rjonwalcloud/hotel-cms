const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock database module
jest.mock('../src/config/database');
const db = require('../src/config/database');

// Import auth controller and routes
const authController = require('../src/modules/iam/controllers/auth.controller');
const authRoutes = require('../src/modules/iam/routes/auth.routes');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication API Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {

        it('should return 400 if email is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ password: 'TestPassword123' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Email and password are required');
        });

        it('should return 400 if password is missing', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Email and password are required');
        });

        it('should return 401 if user does not exist', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'TestPassword123'
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid credentials');
        });

        it('should return 401 if password is incorrect', async () => {
            const passwordHash = await bcrypt.hash('CorrectPassword', 10);

            db.query.mockResolvedValue({
                rows: [{
                    id: '123',
                    email: 'test@example.com',
                    password_hash: passwordHash,
                    full_name: 'Test User',
                    is_active: true,
                    roles: [{ role: 'STAFF', hotel_id: null, permissions: [] }]
                }]
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'WrongPassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid credentials');
        });

        it('should return 401 if user is deactivated', async () => {
            const passwordHash = await bcrypt.hash('TestPassword123', 10);

            db.query.mockResolvedValue({
                rows: [{
                    id: '123',
                    email: 'test@example.com',
                    password_hash: passwordHash,
                    full_name: 'Test User',
                    is_active: false,
                    roles: []
                }]
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'TestPassword123'
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Account is deactivated');
        });

        it('should return token and user data on successful login', async () => {
            const passwordHash = await bcrypt.hash('Admin@123', 10);

            db.query.mockResolvedValue({
                rows: [{
                    id: '123',
                    email: 'admin@hotelcms.com',
                    password_hash: passwordHash,
                    full_name: 'System Administrator',
                    phone: '+1234567890',
                    is_active: true,
                    roles: [{
                        role: 'SUPER_ADMIN',
                        hotel_id: null,
                        permissions: ['USER_CREATE', 'HOTEL_CREATE']
                    }]
                }]
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'admin@hotelcms.com',
                    password: 'Admin@123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.user.email).toBe('admin@hotelcms.com');
            expect(response.body.user.password_hash).toBeUndefined(); // Should be removed
        });
    });

    describe('POST /api/auth/register', () => {

        it('should return 400 if required fields are missing', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com' }); // Missing password and full_name

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('required');
        });

        it('should return 400 if email format is invalid', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'invalid-email',
                    password: 'TestPassword123',
                    full_name: 'Test User'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Invalid email format');
        });

        it('should return 400 if password is too short', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'short',
                    full_name: 'Test User'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Password must be at least 8 characters');
        });

        it('should return 409 if user already exists', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: '123' }] }); // User exists

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'existing@example.com',
                    password: 'TestPassword123',
                    full_name: 'Test User'
                });

            expect(response.status).toBe(409);
            expect(response.body.message).toContain('already exists');
        });

        it('should successfully register a new user', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [] }) // Check user doesn't exist
                .mockResolvedValueOnce({ // Insert user
                    rows: [{
                        id: '123',
                        email: 'newuser@example.com',
                        full_name: 'New User',
                        phone: '+1234567890',
                        created_at: new Date()
                    }]
                })
                .mockResolvedValueOnce({ rows: [] }); // Assign role

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'newuser@example.com',
                    password: 'StrongPassword123',
                    full_name: 'New User',
                    phone: '+1234567890',
                    role: 'STAFF'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe('newuser@example.com');
            expect(response.body.message).toBe('User registered successfully');
        });
    });

    describe('Password Hashing', () => {

        it('should correctly hash and verify Admin@123 password', async () => {
            const password = 'Admin@123';
            const hash = await bcrypt.hash(password, 10);

            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);

            const isInvalid = await bcrypt.compare('WrongPassword', hash);
            expect(isInvalid).toBe(false);
        });

        it('should use bcrypt with 10 salt rounds', async () => {
            const password = 'TestPassword123';
            const hash = await bcrypt.hash(password, 10);

            // Bcrypt hashes start with $2b$10$ for 10 rounds
            expect(hash).toMatch(/^\$2b\$10\$/);
        });
    });
});
