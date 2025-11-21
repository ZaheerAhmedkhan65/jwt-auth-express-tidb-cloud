// tests/integration.test.js
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const JwtAuthExpress = require('../index');

describe('JWT Auth Express - TiDB Cloud Integration Tests', () => {
  let app;
  let auth;
  let testServer;
  let baseURL;

  beforeAll(async () => {
    // Check if TiDB Cloud configuration is available
    if (!process.env.TIDB_HOST) {
      console.warn('⚠️  TiDB Cloud configuration not found. Skipping integration tests.');
      return;
    }

    app = express();
    app.use(express.json());

    try {
      console.log('🔗 Initializing TiDB Cloud connection for tests...');
      
      auth = await JwtAuthExpress.create({
        secret: process.env.JWT_SECRET || 'test-super-secret-jwt-key-123',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'test-super-secret-refresh-key-456',
        database: {
          host: process.env.TIDB_HOST,
          port: process.env.TIDB_PORT || 4000,
          database: process.env.TIDB_DATABASE,
          username: process.env.TIDB_USERNAME,
          password: process.env.TIDB_PASSWORD,
          ssl: true,
          tableName: 'users' // Use separate table for tests
        },
        tokenExpiry: {
          access: '15m',
          refresh: '7d'
        }
      });

      // Get routes with proper middleware
      const validationMiddleware = (req, res, next) => next();
      app.use('/auth', auth.getRoutes(validationMiddleware));

      // Add test cleanup endpoint
      app.delete('/auth/test-cleanup', async (req, res) => {
        try {
          // Clean up test users
          await auth.userModel._executeQuery('DELETE FROM users WHERE email LIKE ?', ['%test-%@example.com']);
          res.json({ success: true, message: 'Test data cleaned up' });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      });

      // Start test server
      return new Promise((resolve) => {
        testServer = app.listen(0, () => {
          baseURL = `http://localhost:${testServer.address().port}`;
          console.log(`🧪 Test server running on ${baseURL}`);
          resolve();
        });
      });
    } catch (error) {
      console.error('❌ Failed to initialize test server:', error.message);
      throw error;
    }
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    if (auth) {
      await auth.close();
    }
  });

  // Clean up test data after each test suite
  afterEach(async () => {
    if (auth) {
      try {
        await request(app).delete('/auth/test-cleanup');
      } catch (error) {
        console.log('Cleanup failed:', error.message);
      }
    }
  });

  describe('User Registration Flow', () => {
    let testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User'
    };

    test('should register a new user successfully', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/signup')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.name).toBe(testUser.name);
      expect(response.body.data.user.id).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    test('should prevent duplicate user registration', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/signup')
        .send(testUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    test('should reject registration with invalid email', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'ValidPass123!',
          name: 'Test User'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Login Flow', () => {
    let testUser = {
      email: `login-${Date.now()}@example.com`,
      password: 'LoginPassword123!',
      name: 'Login Test User'
    };

    let accessToken;
    let refreshToken;

    beforeAll(async () => {
      if (!auth) return;

      // Register a user first
      await request(app)
        .post('/auth/signup')
        .send(testUser);
    });

    test('should login with valid credentials', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/signin')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);

      accessToken = response.body.data.tokens.accessToken;
      refreshToken = response.body.data.tokens.refreshToken;
    });

    test('should reject login with invalid password', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/signin')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    test('should reject login with non-existent email', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should refresh token successfully', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({
          refreshToken: refreshToken
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Update tokens for next tests
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });
  });

  describe('Protected Routes', () => {
    let testUser = {
      email: `protected-${Date.now()}@example.com`,
      password: 'Protected123!',
      name: 'Protected Test User'
    };

    let accessToken;

    beforeAll(async () => {
      if (!auth) return;

      // Register and login
      await request(app)
        .post('/auth/signup')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/auth/signin')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
    });

    test('should access protected route with valid token', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.name).toBe(testUser.name);
      expect(response.body.data.user.id).toBeDefined();
    });

    test('should reject protected route without token', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access token required');
    });

    test('should reject protected route with invalid token', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired token');
    });
  });

  describe('Token Management', () => {
    let testUser = {
      email: `token-${Date.now()}@example.com`,
      password: 'TokenPass123!',
      name: 'Token Test User'
    };

    let accessToken;
    let refreshToken;

    beforeAll(async () => {
      if (!auth) return;

      await request(app)
        .post('/auth/signup')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/auth/signin')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    test('should sign out successfully', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/signout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle forgot password request', async () => {
      if (!auth) {
        console.log('⏭️  Skipping test - TiDB Cloud not configured');
        return;
      }

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});