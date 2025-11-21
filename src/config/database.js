//src/config/database.js
class DatabaseConfig {
  constructor(options = {}) {
    this.options = {
      dialect: 'mysql2/promise',
      host: options.host,
      port: options.port || 4000,
      database: options.database,
      username: options.username,
      password: options.password,

      // TiDB Cloud requires SSL
      ssl: true,
      sslCA: options.sslCA,

      // Connection settings optimized for TiDB Cloud
      timezone: '+00:00',
      charset: 'utf8mb4',
      connectTimeout: 60000,

      // Connection pool settings
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 60000,

      ...options
    };
  }

  // Get TiDB Cloud connection configuration
  getConnectionConfig() {
    const {
      host,
      port,
      database,
      username,
      password
    } = this.options;

    const baseConfig = {
      host,
      port: parseInt(port),
      user: username,
      password,
      database,
      charset: 'utf8mb4',
      timezone: '+00:00',
      connectTimeout: 60000,
      ssl: {
        rejectUnauthorized: false
      }
    };

    return baseConfig;
  }

  // Get connection pool configuration
  getPoolConfig() {
    return {
      ...this.getConnectionConfig(),
      connectionLimit: this.options.connectionLimit,
      waitForConnections: true,
      queueLimit: 0
    };
  }

  // Validate TiDB Cloud configuration
  validate() {
    const errors = [];
    const { host, database, username, password } = this.options;

    if (!host) {
      errors.push('TiDB Cloud host is required');
    }

    if (!database) {
      errors.push('TiDB Cloud database name is required');
    }

    if (!username) {
      errors.push('TiDB Cloud username is required');
    }

    if (!password) {
      errors.push('TiDB Cloud password is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Static method to create TiDB Cloud connection
  static async createTiDBConnection(options) {
    const config = new DatabaseConfig(options);
    const validation = config.validate();

    if (!validation.isValid) {
      throw new Error(`TiDB Cloud configuration invalid: ${validation.errors.join(', ')}`);
    }

    const poolConfig = config.getPoolConfig();

    console.log('🔧 Creating TiDB Cloud connection with config:', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Use mysql2/promise for TiDB Cloud
    const mysql = require('mysql2/promise');

    // Create connection pool
    const pool = mysql.createPool(poolConfig);

    // Test the connection
    try {
      const connection = await pool.getConnection();
      console.log('✅ TiDB Cloud database connected successfully');
      connection.release();
      return pool;
    } catch (error) {
      console.error('❌ TiDB Cloud connection failed:', error.message);
      throw error;
    }
  }
}

// TiDB Cloud specific configuration
DatabaseConfig.tidb = () => {
  return new DatabaseConfig({
    host: process.env.TIDB_HOST,
    port: process.env.TIDB_PORT || 4000,
    database: process.env.TIDB_DATABASE,
    username: process.env.TIDB_USERNAME,
    password: process.env.TIDB_PASSWORD
  });
};

module.exports = DatabaseConfig;