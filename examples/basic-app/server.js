//examples/basic-app/server.js
require('dotenv').config();
const express = require('express');
const JwtAuthExpress = require('../../index');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function startServer() {
  try {
    console.log('🚀 Starting jwt-auth-express-cloud Server...');

    // Initialize authentication system with TiDB Cloud
    const auth = await JwtAuthExpress.create({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-123',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-456',
      database: {
        dialect: 'mysql2/promise',
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
      },
      basePath: '/o/auth',
      enableUI: true,
      // Optional: Provide custom views path
      // viewsPath: path.join(__dirname, 'custom-views'),
      // publicPath: path.join(__dirname, 'public')
    });

    // Setup the app with authentication
    auth.setupApp(app, (req, res, next) => next());

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
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();