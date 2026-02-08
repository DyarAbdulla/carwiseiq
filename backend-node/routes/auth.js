/**
 * Authentication Routes
 * Handles user registration, login, and token verification
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for auth endpoints (prevent brute force attacks)
// More lenient in development, stricter in production
const isDevelopment = process.env.NODE_ENV !== 'production';

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour (increased from 15 minutes)
  max: isDevelopment ? 1000 : 20, // 1000 requests/hour in dev, 20 in production
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => {
    if (isDevelopment) {
      const ip = req.ip || req.connection.remoteAddress;
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('127.0.0.1') || ip.startsWith('::1');
    }
    return false;
  },
});

/**
 * Email validation regex
 */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
const validateEmail = (email) => {
  return emailRegex.test(email);
};

/**
 * Generate JWT token
 * @param {number} userId - User ID
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/)
      .withMessage('Password contains invalid characters'),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Validate password byte length (bcrypt has 72-byte limit)
      const passwordBytes = Buffer.byteLength(password, 'utf8');
      if (passwordBytes > 72) {
        return res.status(400).json({
          error: 'Password is too long. Maximum 72 bytes allowed.',
        });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [normalizedEmail]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          error: 'User with this email already exists',
        });
      }

      // Hash password (10 salt rounds)
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert user into database
      const result = await query(
        `INSERT INTO users (email, password_hash, created_at)
         VALUES ($1, $2, NOW())
         RETURNING id, email, created_at`,
        [normalizedEmail, passwordHash]
      );

      const user = result.rows[0];

      // Generate JWT token
      const token = generateToken(user.id);

      // Return success response
      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);

      // Handle unique constraint violation
      if (error.code === '23505') {
        return res.status(400).json({
          error: 'User with this email already exists',
        });
      }

      res.status(500).json({
        error: 'Internal server error. Please try again later.',
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Login validation errors:', errors.array());
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email, password } = req.body;
      console.log('Login attempt for email:', email);
      console.log('Raw password received:', password ? `[${password.length} chars]` : 'undefined');

      // Use normalized email from express-validator (already normalized by .normalizeEmail())
      // But also ensure lowercase and trim for consistency
      const normalizedEmail = (email || '').toLowerCase().trim();
      console.log('Normalized email:', normalizedEmail);

      // Find user by email - try exact match first, then case-insensitive
      let result = await query(
        'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
        [normalizedEmail]
      );

      // If not found, try case-insensitive search
      if (result.rows.length === 0) {
        console.log('Exact match not found, trying case-insensitive search');
        result = await query(
          'SELECT id, email, password_hash, created_at FROM users WHERE LOWER(TRIM(email)) = $1',
          [normalizedEmail]
        );
      }

      console.log('User lookup result:', result.rows.length > 0 ? 'User found' : 'User not found');

      if (result.rows.length === 0) {
        console.log('Login failed: User not found for email:', normalizedEmail);
        // Don't reveal if user exists or not (security best practice)
        return res.status(401).json({
          error: 'Invalid email or password',
        });
      }

      const user = result.rows[0];
      console.log('=== LOGIN DEBUG INFO ===');
      console.log('User found - ID:', user.id);
      console.log('User email:', user.email);
      console.log('Input email:', email);
      console.log('Normalized email:', normalizedEmail);
      console.log('Password hash exists:', !!user.password_hash);
      console.log('Password hash length:', user.password_hash ? user.password_hash.length : 0);
      console.log('Password hash preview:', user.password_hash ? user.password_hash.substring(0, 30) + '...' : 'N/A');
      console.log('Input password length:', password ? password.length : 0);
      console.log('Input password preview:', password ? password.substring(0, 3) + '***' : 'N/A');

      // Verify password - IMPORTANT: bcrypt.compare(plainPassword, hashedPassword)
      if (!user.password_hash) {
        console.error('Login failed: User has no password hash');
        return res.status(401).json({
          error: 'Invalid email or password',
        });
      }

      // Ensure password is a string and not null/undefined
      const passwordToCompare = String(password || '').trim();
      console.log('Password to compare:', passwordToCompare ? `[${passwordToCompare.length} chars]` : 'empty');

      console.log('Attempting bcrypt.compare...');
      const isValidPassword = await bcrypt.compare(passwordToCompare, user.password_hash);
      console.log('Password comparison result:', isValidPassword);
      console.log('bcrypt.compare called with:');
      console.log('  - Plain password length:', passwordToCompare.length);
      console.log('  - Hashed password:', user.password_hash.substring(0, 30) + '...');
      console.log('  - Result:', isValidPassword);

      // Additional check: verify the hash format
      if (user.password_hash && !user.password_hash.startsWith('$2')) {
        console.error('WARNING: Password hash does not appear to be a valid bcrypt hash!');
        console.error('Hash starts with:', user.password_hash.substring(0, 10));
      }

      console.log('=== END DEBUG INFO ===');

      if (!isValidPassword) {
        console.log('Login failed: Invalid password for email:', normalizedEmail);
        return res.status(401).json({
          error: 'Invalid email or password',
        });
      }

      // Generate JWT token
      const token = generateToken(user.id);
      console.log('Login successful - Token generated for user ID:', user.id);

      // Return success response
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        error: 'Internal server error. Please try again later.',
      });
    }
  }
);

/**
 * GET /api/auth/verify
 * Verify JWT token and return user information
 */
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    // User is already attached to req by authenticateToken middleware
    res.json({
      valid: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        created_at: req.user.created_at,
      },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      error: 'Internal server error during token verification.',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user information
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      created_at: req.user.created_at,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error.',
    });
  }
});

module.exports = router;


