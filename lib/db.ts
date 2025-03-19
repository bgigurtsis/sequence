import { Pool } from 'pg';

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

    if (existingUser && existingUser.rowCount && existingUser.rowCount > 0) {
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

// Export the pool for direct query access if needed
export { pool }; 
