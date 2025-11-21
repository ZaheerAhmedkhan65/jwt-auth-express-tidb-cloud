//examples/basic-app/server.js
require('dotenv').config();
const express = require('express');
const JwtAuthExpress = require('../../index');
const app = express();
app.use(express.json());

async function startServer() {
  try {
    console.log('🚀 Starting TiDB Cloud Authentication Server...');

    // Initialize authentication system with TiDB Cloud
    const auth = await JwtAuthExpress.create({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-123',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-456',
      database: {
        dialect: 'tidb',
        host: process.env.TIDB_HOST,
        port: process.env.TIDB_PORT || 4000,
        database: process.env.TIDB_DATABASE,
        username: process.env.TIDB_USERNAME,
        password: process.env.TIDB_PASSWORD,
        ssl: true,
        tableName: 'users'
      },
      tokenExpiry: {
        access: '15m',
        refresh: '7d'
      }
    });

    console.log('✅ TiDB Cloud authentication system initialized successfully');

    // Setup routes
    const validationMiddleware = (req, res, next) => next();
    
    app.use('/auth', auth.getRoutes(validationMiddleware));
    app.use('/tokens', auth.getTokenRoutes(validationMiddleware));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'OK', 
        message: 'TiDB Cloud Authentication server is running',
        database: 'TiDB Cloud',
        timestamp: new Date().toISOString()
      });
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🎯 TiDB Cloud server running on http://localhost:${PORT}`);
      console.log('\n📍 Available Endpoints:');
      console.log('   GET  /health              - Health check');
      console.log('   POST /auth/signup         - User registration');
      console.log('   POST /auth/signin         - User login');
      console.log('   POST /auth/refresh-token  - Refresh access token');
      console.log('   POST /auth/forgot-password- Request password reset');
      console.log('   POST /auth/signout        - User logout');
      console.log('   GET  /auth/me             - Get current user (protected)');
    });

  } catch (error) {
    console.error('❌ Failed to start TiDB Cloud server:', error.message);
  }
}

startServer();