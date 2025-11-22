//index.js
const JWTUtils = require('./src/utils/jwt');
const AuthController = require('./src/controllers/authController');
const TokenController = require('./src/controllers/tokenController');
const { authenticateToken, optionalAuth } = require('./src/middleware/auth');
const createAuthRoutes = require('./src/routes/authRoutes');
const EmailUtils = require('./src/utils/email');
const DatabaseConfig = require('./src/config/database');
const User = require('./src/models/User');
const path = require('path');
const fs = require('fs');

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
            },

            // Auth UI options
            viewsPath = null,
            publicPath = null,
            basePath = '/auth',
            enableUI = true
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
            dialect: 'mysql2/promise', // TiDB dialect
            ssl: {
                rejectUnauthorized: false
            }
        };

        // Set token expiry
        this.jwtUtils.accessTokenExpiry = tokenExpiry.access;
        this.jwtUtils.refreshTokenExpiry = tokenExpiry.refresh;

        // UI configuration
        this.viewsPath = viewsPath;
        this.publicPath = publicPath;
        this.basePath = basePath;
        this.enableUI = enableUI;

        this.db = null;
        this.userModel = null;
        this.authController = null;
        this.tokenController = null;
    }

    // Initialize TiDB Cloud connection
    async init() {
        try {
            this.db = await DatabaseConfig.createTiDBConnection(this.dbConfig);
            this.userModel = new User(this.db, {
                dialect: 'mysql2/promise',
                tableName: this.dbConfig.tableName || 'users'
            });

            // Initialize database tables
            await this.userModel.initDatabase();

            this.authController = new AuthController(this.jwtUtils, this.userModel, this.emailUtils);
            this.tokenController = new TokenController(this.jwtUtils, this.userModel);
            return this;
        } catch (error) {
            throw new Error(`Failed to initialize TiDB Cloud: ${error.message}`);
        }
    }

    // Setup both API routes and UI routes
    setupApp(app, validationMiddleware = (req, res, next) => next()) {
    if (!this.authController) {
        throw new Error('Authentication system not initialized. Call init() first.');
    }

    // Get the auth middleware
    const authMiddleware = this.getAuthMiddleware();

    // Setup API routes with proper middleware
    app.use(`${this.basePath}`, createAuthRoutes(this.authController, validationMiddleware, authMiddleware));

    // Setup UI routes if enabled
    if (this.enableUI) {
        this._setupUIRoutes(app);
    }

    return this;
}

    // Setup UI routes and views
    _setupUIRoutes(app) {
        const express = require('express');
        const router = express.Router();

        // Set view engine to EJS if not already set
        if (!app.get('view engine')) {
            const expressLayouts = require("express-ejs-layouts");
            app.set('view engine', 'ejs');
             app.use(expressLayouts);
        }

        // Setup views directories
        const packageViewsPath = path.join(__dirname, 'src', 'views');

        // Debug: Check if package views directory exists
        if (!fs.existsSync(packageViewsPath)) {
            console.warn('⚠️ Package views directory not found:', packageViewsPath);
        }

        // Get current views directories
        let viewsDirs = [];

        // Add custom views path if provided
        if (this.viewsPath) {
            if (fs.existsSync(this.viewsPath)) {
                viewsDirs.push(this.viewsPath);
            } else {
                console.warn('⚠️ Custom views path not found:', this.viewsPath);
            }
        }

        // Always add package views path
        viewsDirs.push(packageViewsPath);

        // Add app's existing views directories if any
        const currentViews = app.get('views');
        if (currentViews) {
            if (Array.isArray(currentViews)) {
                viewsDirs = [...currentViews, ...viewsDirs];
            } else {
                viewsDirs = [currentViews, ...viewsDirs];
            }
        }

        // Set the views directories
        app.set('views', viewsDirs);

        // Setup static files
        const packagePublicPath = path.join(__dirname, 'public');

        // Serve custom public directory if provided
        if (this.publicPath && fs.existsSync(this.publicPath)) {
            app.use(`${this.basePath}/public`, express.static(this.publicPath));
        }

        // Serve package public directory
        if (fs.existsSync(packagePublicPath)) {
            app.use(`${this.basePath}/public`, express.static(packagePublicPath));
        } else {
            console.warn('⚠️ Package public directory not found:', packagePublicPath);
        }

        // Auth pages routes with error handling
        router.get('/signup', (req, res) => {
            try {
                res.render('auth/signup', {
                    title: 'Sign Up',
                    layout: 'layouts/auth-layout',
                    basePath: this.basePath,
                    error: null,
                    success: null
                });
            } catch (error) {
                console.error('❌ Error rendering signup view:', error);
                res.status(500).send('Error loading signup page');
            }
        });

        router.get('/signin', (req, res) => {
            try {
                res.render('auth/signin', {
                    title: 'Sign In',
                    layout: 'layouts/auth-layout',
                    basePath: this.basePath,
                    error: null,
                    success: null
                });
            } catch (error) {
                console.error('❌ Error rendering signin view:', error);
                res.status(500).send('Error loading signin page');
            }
        });

        router.get('/forgot-password', (req, res) => {
            try {
                res.render('auth/forgot-password', {
                    title: 'Forgot Password',
                    layout: 'layouts/auth-layout',
                    basePath: this.basePath,
                    error: null,
                    success: null
                });
            } catch (error) {
                console.error('❌ Error rendering forgot-password view:', error);
                res.status(500).send('Error loading forgot password page');
            }
        });

        router.get('/reset-password', (req, res) => {
            try {
                const { token } = req.query;

                if (!token) {
                    return res.redirect(this.basePath + '/forgot-password');
                }

                res.render('auth/reset-password', {
                    title: 'Reset Password',
                    layout: 'layouts/auth-layout',
                    basePath: this.basePath,
                    token: token,
                    error: null,
                    success: null
                });
            } catch (error) {
                console.error('❌ Error rendering reset-password view:', error);
                res.status(500).send('Error loading reset password page');
            }
        });

        // Mount the router
        app.use(this.basePath, router);
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