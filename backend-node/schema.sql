-- PostgreSQL Schema for Car Price Predictor Authentication System
-- Run this script to create the users table

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on created_at for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Add comment to table
COMMENT ON TABLE users IS 'Stores user authentication information';
COMMENT ON COLUMN users.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN users.email IS 'User email address (unique, normalized to lowercase)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (10 salt rounds)';
COMMENT ON COLUMN users.created_at IS 'Timestamp when user account was created';

-- Example query to verify table creation:
-- SELECT * FROM users;



