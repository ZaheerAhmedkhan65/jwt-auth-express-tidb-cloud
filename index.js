//index.js
const JWTUtils = require('./src/utils/jwt');
const AuthController = require('./src/controllers/authController');
const TokenController = require('./src/controllers/tokenController');
const { authenticateToken, optionalAuth } = require('./src/middleware/auth');
const createAuthRoutes = require('./src/routes/authRoutes');
const EmailUtils = require('./src/utils/email');
const DatabaseConfig = require('./src/config/database');
const User = require('./src/models/User');

class JwtAuthExpress {
    constructor(options = {}) {
        const {
            // JWT options
            secret,
            refreshSecret,

            // Database options (TiDB Cloud only)
            database: dbConfig = {},

            // Email options
            emailConfig = {},

            // Token expiry
            tokenExpiry = {
                access: '15m',
                refresh: '7d'
            }
        } = options;

        if (!secret || !refreshSecret) {
            throw new Error('JWT secrets are required');
        }

        // Validate TiDB Cloud configuration
        if (!dbConfig.host || !dbConfig.database || !dbConfig.username || !dbConfig.password) {
            throw new Error('TiDB Cloud configuration requires host, database, username, and password');
        }

        this.jwtUtils = new JWTUtils(secret, refreshSecret);
        this.emailUtils = new EmailUtils(emailConfig);
        this.dbConfig = {
            ...dbConfig,
            dialect: 'mysql2/promise', // Force TiDB dialect
            ssl: {
                rejectUnauthorized: false
            }
        };

        // Set token expiry
        this.jwtUtils.accessTokenExpiry = tokenExpiry.access;
        this.jwtUtils.refreshTokenExpiry = tokenExpiry.refresh;

        this.db = null;
        this.userModel = null;
        this.authController = null;
        this.tokenController = null;
    }

    // Initialize TiDB Cloud connection
    async init() {
        try {
            console.log('🔗 Connecting to TiDB Cloud...');

            this.db = await DatabaseConfig.createTiDBConnection(this.dbConfig);
            this.userModel = new User(this.db, {
                dialect: 'mysql2/promise',
                tableName: this.dbConfig.tableName || 'users'
            });

            // Initialize database tables
            await this.userModel.initDatabase();

            this.authController = new AuthController(this.jwtUtils, this.userModel, this.emailUtils);
            this.tokenController = new TokenController(this.jwtUtils, this.userModel);

            console.log('✅ TiDB Cloud connected successfully');
            return this;
        } catch (error) {
            throw new Error(`Failed to initialize TiDB Cloud: ${error.message}`);
        }
    }

    // Get authentication routes
    getRoutes(validationMiddleware) {
        if (!this.authController) {
            throw new Error('Authentication system not initialized. Call init() first.');
        }

        // Pass the authentication middleware to the route creator
        return createAuthRoutes(
            this.authController,
            validationMiddleware,
            this.getAuthMiddleware() // Add this parameter
        );
    }

    // Get token routes
    getTokenRoutes(validationMiddleware) {
        if (!this.tokenController) {
            throw new Error('Authentication system not initialized. Call init() first.');
        }

        const express = require('express');
        const router = express.Router();

        router.post('/verify', validationMiddleware, this.tokenController.verifyToken);
        router.post('/decode', validationMiddleware, this.tokenController.decodeToken);
        router.post('/revoke-all', this.getAuthMiddleware(), validationMiddleware, this.tokenController.revokeAllTokens);
        router.get('/info', this.getAuthMiddleware(), this.tokenController.getTokenInfo);
        router.post('/generate', this.getAuthMiddleware(), validationMiddleware, this.tokenController.generateCustomToken);

        return router;
    }

    getAuthMiddleware() {
        return authenticateToken(this.jwtUtils);
    }

    getOptionalAuthMiddleware() {
        return optionalAuth(this.jwtUtils);
    }

    getJwtUtils() {
        return this.jwtUtils;
    }

    getUserModel() {
        return this.userModel;
    }

    // Close TiDB connection
    async close() {
        if (this.db) {
            await this.db.end();
        }

        if (this.emailUtils) {
            await this.emailUtils.close();
        }
    }
}

// Convenience function for quick setup
JwtAuthExpress.create = async (options) => {
    const auth = new JwtAuthExpress(options);
    await auth.init();
    return auth;
};

module.exports = JwtAuthExpress;