import { Pool } from 'pg';

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for some cloud PostgreSQL providers
  }
});

// Initialize the database by creating necessary tables
export async function initializeDatabase() {
  try {
    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user_tokens table for storing OAuth tokens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        google_refresh_token TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// User functions
export async function getOrCreateUser(userId: string) {
  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (existingUser.rowCount > 0) {
      return existingUser.rows[0];
    }

    // Create new user
    const newUser = await pool.query(
      'INSERT INTO users (user_id) VALUES ($1) RETURNING *',
      [userId]
    );

    return newUser.rows[0];
  } catch (error) {
    console.error('Error getting or creating user:', error);
    throw error;
  }
}

// Google token functions
export async function saveGoogleRefreshToken(userId: string, refreshToken: string) {
  try {
    // Ensure user exists first
    await getOrCreateUser(userId);

    // Check if token exists
    const existingToken = await pool.query(
      'SELECT * FROM user_tokens WHERE user_id = $1',
      [userId]
    );

    if (existingToken.rowCount > 0) {
      // Update existing token
      await pool.query(
        'UPDATE user_tokens SET google_refresh_token = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [refreshToken, userId]
      );
    } else {
      // Insert new token
      await pool.query(
        'INSERT INTO user_tokens (user_id, google_refresh_token) VALUES ($1, $2)',
        [userId, refreshToken]
      );
    }

    return true;
  } catch (error) {
    console.error('Error saving Google refresh token:', error);
    throw error;
  }
}

export async function getGoogleRefreshToken(userId: string) {
  try {
    const result = await pool.query(
      'SELECT google_refresh_token FROM user_tokens WHERE user_id = $1',
      [userId]
    );

    if (result.rowCount > 0 && result.rows[0].google_refresh_token) {
      return result.rows[0].google_refresh_token;
    }

    return null;
  } catch (error) {
    console.error('Error getting Google refresh token:', error);
    throw error;
  }
}

export async function deleteGoogleRefreshToken(userId: string) {
  try {
    await pool.query(
      'UPDATE user_tokens SET google_refresh_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
    return true;
  } catch (error) {
    console.error('Error deleting Google refresh token:', error);
    throw error;
  }
}

// Export the pool for direct query access if needed
export { pool }; 