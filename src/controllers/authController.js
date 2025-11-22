// src/controllers/authController.js
const CryptoUtils = require('../utils/crypto');

class AuthController {
  constructor(jwtUtils, userModel, emailUtils) {
    this.jwtUtils = jwtUtils;
    this.User = userModel;
    this.emailUtils = emailUtils;
  }

  // Helper method to set cookies
  _setAuthCookies(res, accessToken, refreshToken) {
    // Set access token cookie (short-lived)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Set refresh token cookie (long-lived)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  // Helper method to clear cookies
  _clearAuthCookies(res) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
  }

  // Sign up
  signUp = async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // Check if user exists
      const existingUser = await this.User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Create user
      const user = await this.User.create({
        email,
        password,
        name
      });

      // Generate tokens
      const accessToken = this.jwtUtils.generateAccessToken({
        userId: user.id,
        email: user.email
      });

      const refreshToken = this.jwtUtils.generateRefreshToken({
        userId: user.id
      });

      // Store refresh token
      await this.User.storeRefreshToken(user.id, refreshToken);

      // Set cookies
      this._setAuthCookies(res, accessToken, refreshToken);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating user',
        error: error.message
      });
    }
  }

  // Sign in
  signIn = async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await this.User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isPasswordValid = await CryptoUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate tokens
      const accessToken = this.jwtUtils.generateAccessToken({
        userId: user.id,
        email: user.email
      });

      const refreshToken = this.jwtUtils.generateRefreshToken({
        userId: user.id
      });

      // Store refresh token
      await this.User.storeRefreshToken(user.id, refreshToken);

      // Set cookies
      this._setAuthCookies(res, accessToken, refreshToken);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error during login',
        error: error.message
      });
    }
  }

  // Refresh token
  refreshToken = async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      // Verify refresh token
      const decoded = this.jwtUtils.verifyRefreshToken(refreshToken);

      // Check if refresh token exists in database
      const user = await this.User.findByRefreshToken(decoded.userId, refreshToken);
      if (!user) {
        this._clearAuthCookies(res);
        return res.status(403).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Generate new tokens
      const newAccessToken = this.jwtUtils.generateAccessToken({
        userId: user.id,
        email: user.email
      });

      const newRefreshToken = this.jwtUtils.generateRefreshToken({
        userId: user.id
      });

      // Update refresh token in database
      await this.User.updateRefreshToken(user.id, refreshToken, newRefreshToken);

      // Set new cookies
      this._setAuthCookies(res, newAccessToken, newRefreshToken);

      res.json({
        success: true,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      res.status(403).json({
        success: false,
        message: 'Invalid refresh token',
        error: error.message
      });
    }
  }

  // Forgot password
  forgotPassword = async (req, res) => {
    try {
      const { email } = req.body;

      const user = await this.User.findByEmail(email);
      if (!user) {
        // Don't reveal whether user exists
        return res.json({
          success: true,
          message: 'If the email exists, a reset link will be sent'
        });
      }

      // Generate reset token
      const resetToken = CryptoUtils.generateResetToken();
      const hashedToken = CryptoUtils.hashResetToken(resetToken);

      // Store reset token with expiration
      await this.User.storePasswordResetToken(user.id, hashedToken);

      // Send email
      await this.emailUtils.sendPasswordResetEmail(user.email, resetToken, user.id);

      res.json({
        success: true,
        message: 'If the email exists, a reset link will be sent'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error processing request',
        error: error.message
      });
    }
  }

  // Reset password
  resetPassword = async (req, res) => {
    try {
      const { token, userId, newPassword } = req.body;

      // Find user and validate reset token
      const user = await this.User.findValidPasswordResetToken(userId, token);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Update password
      await this.User.updatePassword(userId, newPassword);

      // Invalidate all refresh tokens (optional security measure)
      await this.User.clearAllRefreshTokens(userId);

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error resetting password',
        error: error.message
      });
    }
  }

  // Sign out
  signOut = async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      const userId = req.user?.userId;

      if (refreshToken && userId) {
        await this.User.removeRefreshToken(userId, refreshToken);
      }

      // Clear cookies
      this._clearAuthCookies(res);

      res.json({
        success: true,
        message: 'Signed out successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error during sign out',
        error: error.message
      });
    }
  }

  // Get current user
  getCurrentUser = async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const user = await this.User.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user data',
        error: error.message
      });
    }
  }
}

module.exports = AuthController;