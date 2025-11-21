// src/models/User.js
const CryptoUtils = require('../utils/crypto');

class User {
  constructor(database, options = {}) {
    if (!database) {
      throw new Error('TiDB Cloud database connection is required');
    }
    
    this.db = database;
    this.options = {
      tableName: options.tableName || 'users',
      refreshTokensTable: options.refreshTokensTable || 'refresh_tokens',
      passwordResetTable: options.passwordResetTable || 'password_resets',
      ...options
    };

    console.log('📊 User model initialized for TiDB Cloud');
  }

  // Helper method to execute queries
  async _executeQuery(query, params = []) {
    try {
      console.log(`🔍 Executing TiDB query: ${query.substring(0, 100)}...`);
      
      const result = await this.db.execute(query, params);
      
      // mysql2/promise returns [rows, fields] structure
      if (Array.isArray(result) && result.length > 0) {
        return result[0]; // Return rows only
      }
      
      return result;
    } catch (error) {
      console.error('❌ TiDB Query error:', error.message);
      console.error('Query:', query.substring(0, 200));
      throw error;
    }
  }

  // Find user by email
  async findByEmail(email) {
    try {
      const rows = await this._executeQuery(
        `SELECT * FROM ${this.options.tableName} WHERE email = ? AND is_active = 1 LIMIT 1`,
        [email]
      );
      
      return rows && rows.length > 0 ? this._formatUser(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  // Find user by ID
  async findById(userId) {
    try {
      const rows = await this._executeQuery(
        `SELECT * FROM ${this.options.tableName} WHERE id = ? AND is_active = 1 LIMIT 1`,
        [userId]
      );
      
      return rows && rows.length > 0 ? this._formatUser(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  // Create new user
  async create(userData) {
    try {
      const { email, password, name } = userData;
      
      // Validate required fields
      if (!email || !password || !name) {
        throw new Error('Email, password, and name are required');
      }

      // Check if user already exists
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const hashedPassword = await CryptoUtils.hashPassword(password);

      // Start transaction
      await this._beginTransaction();

      try {
        const result = await this._executeQuery(
          `INSERT INTO ${this.options.tableName} 
           (email, password, name, is_active, is_verified, created_at, updated_at) 
           VALUES (?, ?, ?, 1, 0, NOW(), NOW())`,
          [email, hashedPassword, name]
        );

        const userId = result.insertId;

        // Commit transaction
        await this._commitTransaction();

        // Return created user
        return await this.findById(userId);

      } catch (error) {
        await this._rollbackTransaction();
        throw error;
      }

    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  // Store refresh token
  async storeRefreshToken(userId, refreshToken) {
    try {
      await this._executeQuery(
        `INSERT INTO ${this.options.refreshTokensTable} 
         (user_id, token, created_at, expires_at) 
         VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [userId, refreshToken]
      );
      return true;
    } catch (error) {
      throw new Error(`Error storing refresh token: ${error.message}`);
    }
  }

  // Find user by refresh token
  async findByRefreshToken(userId, refreshToken) {
    try {
      const rows = await this._executeQuery(
        `SELECT u.* FROM ${this.options.refreshTokensTable} rt 
         INNER JOIN ${this.options.tableName} u ON rt.user_id = u.id 
         WHERE rt.user_id = ? AND rt.token = ? AND rt.expires_at > NOW() 
         AND u.is_active = 1 LIMIT 1`,
        [userId, refreshToken]
      );
      
      return rows && rows.length > 0 ? this._formatUser(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding user by refresh token: ${error.message}`);
    }
  }

  // Update refresh token (rotation)
  async updateRefreshToken(userId, oldToken, newToken) {
    try {
      await this._beginTransaction();

      try {
        // Delete old token
        await this._executeQuery(
          `DELETE FROM ${this.options.refreshTokensTable} 
           WHERE user_id = ? AND token = ?`,
          [userId, oldToken]
        );
        
        // Store new token
        await this.storeRefreshToken(userId, newToken);
        
        await this._commitTransaction();
        return true;

      } catch (error) {
        await this._rollbackTransaction();
        throw error;
      }

    } catch (error) {
      throw new Error(`Error updating refresh token: ${error.message}`);
    }
  }

  // Remove specific refresh token
  async removeRefreshToken(userId, refreshToken) {
    try {
      const result = await this._executeQuery(
        `DELETE FROM ${this.options.refreshTokensTable} 
         WHERE user_id = ? AND token = ?`,
        [userId, refreshToken]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error removing refresh token: ${error.message}`);
    }
  }

  // Store password reset token
  async storePasswordResetToken(userId, hashedToken) {
    try {
      await this._beginTransaction();

      try {
        // Invalidate any existing tokens
        await this._executeQuery(
          `UPDATE ${this.options.passwordResetTable} 
           SET is_valid = 0 WHERE user_id = ?`,
          [userId]
        );
        
        // Insert new token
        await this._executeQuery(
          `INSERT INTO ${this.options.passwordResetTable} 
           (user_id, token, is_valid, created_at, expires_at) 
           VALUES (?, ?, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
          [userId, hashedToken]
        );
        
        await this._commitTransaction();
        return true;

      } catch (error) {
        await this._rollbackTransaction();
        throw error;
      }

    } catch (error) {
      throw new Error(`Error storing password reset token: ${error.message}`);
    }
  }

  // Find valid password reset token
  async findValidPasswordResetToken(userId, token) {
    try {
      const hashedToken = CryptoUtils.hashResetToken(token);
      
      const rows = await this._executeQuery(
        `SELECT u.* FROM ${this.options.passwordResetTable} prt 
         INNER JOIN ${this.options.tableName} u ON prt.user_id = u.id 
         WHERE prt.user_id = ? AND prt.token = ? AND prt.is_valid = 1 
         AND prt.expires_at > NOW() AND u.is_active = 1 LIMIT 1`,
        [userId, hashedToken]
      );
      
      return rows && rows.length > 0 ? this._formatUser(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding valid password reset token: ${error.message}`);
    }
  }

  // Update user password
  async updatePassword(userId, newPassword) {
    try {
      const hashedPassword = await CryptoUtils.hashPassword(newPassword);
      
      await this._beginTransaction();

      try {
        // Update password
        const result = await this._executeQuery(
          `UPDATE ${this.options.tableName} 
           SET password = ?, updated_at = NOW() 
           WHERE id = ? AND is_active = 1`,
          [hashedPassword, userId]
        );

        if (result.affectedRows === 0) {
          throw new Error('User not found or not active');
        }

        // Clear all refresh tokens for security
        await this.clearAllRefreshTokens(userId);

        // Invalidate all password reset tokens
        await this._executeQuery(
          `UPDATE ${this.options.passwordResetTable} 
           SET is_valid = 0 WHERE user_id = ?`,
          [userId]
        );

        await this._commitTransaction();
        return true;

      } catch (error) {
        await this._rollbackTransaction();
        throw error;
      }

    } catch (error) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }

  // Clear all refresh tokens for a user
  async clearAllRefreshTokens(userId) {
    try {
      const result = await this._executeQuery(
        `DELETE FROM ${this.options.refreshTokensTable} WHERE user_id = ?`,
        [userId]
      );
      
      return result.affectedRows;
    } catch (error) {
      throw new Error(`Error clearing refresh tokens: ${error.message}`);
    }
  }

  // Update user profile
  async updateProfile(userId, updateData) {
    try {
      const { password, ...safeUpdateData } = updateData;
      
      if (Object.keys(safeUpdateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      const setClause = Object.keys(safeUpdateData)
        .map(key => `${key} = ?`)
        .join(', ');
      
      const values = [...Object.values(safeUpdateData), userId];
      
      const result = await this._executeQuery(
        `UPDATE ${this.options.tableName} 
         SET ${setClause}, updated_at = NOW() 
         WHERE id = ? AND is_active = 1`,
        values
      );

      if (result.affectedRows === 0) {
        throw new Error('User not found or not active');
      }

      return await this.findById(userId);
    } catch (error) {
      throw new Error(`Error updating profile: ${error.message}`);
    }
  }

  // Database initialization (create tables for TiDB)
  async initDatabase() {
    try {
      console.log('🔄 Initializing TiDB Cloud database tables...');

      // Create users table
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS ${this.options.tableName} (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          is_active TINYINT(1) DEFAULT 1,
          is_verified TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email),
          INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;

      // Create refresh tokens table
      const createRefreshTokensTable = `
        CREATE TABLE IF NOT EXISTS ${this.options.refreshTokensTable} (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          token TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_expires (expires_at),
          FOREIGN KEY (user_id) REFERENCES ${this.options.tableName}(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;

      // Create password reset table
      const createPasswordResetTable = `
        CREATE TABLE IF NOT EXISTS ${this.options.passwordResetTable} (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          token VARCHAR(255) NOT NULL,
          is_valid TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          INDEX idx_user_token (user_id, token),
          INDEX idx_valid_expires (is_valid, expires_at),
          FOREIGN KEY (user_id) REFERENCES ${this.options.tableName}(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;

      await this._executeQuery(createUsersTable);
      await this._executeQuery(createRefreshTokensTable);
      await this._executeQuery(createPasswordResetTable);

      console.log('✅ TiDB Cloud database tables initialized successfully');
      
    } catch (error) {
      throw new Error(`Failed to initialize TiDB Cloud database: ${error.message}`);
    }
  }

  // Transaction helpers for TiDB
  async _beginTransaction() {
    await this.db.execute('START TRANSACTION');
  }

  async _commitTransaction() {
    await this.db.execute('COMMIT');
  }

  async _rollbackTransaction() {
    await this.db.execute('ROLLBACK');
  }

  // Format user data
  _formatUser(userData) {
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      password: userData.password,
      isActive: userData.is_active === 1,
      isVerified: userData.is_verified === 1,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at
    };
  }
}

module.exports = User;