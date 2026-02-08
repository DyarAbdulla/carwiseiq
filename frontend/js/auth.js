/**
 * Frontend Authentication Utilities
 * Handles JWT token storage, API calls, and authentication state
 */

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * Get JWT token from localStorage
 * @returns {string|null} JWT token or null
 */
function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Store JWT token in localStorage
 * @param {string} token - JWT token
 */
function setToken(token) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

/**
 * Remove JWT token from localStorage
 */
function removeToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

/**
 * Get Authorization header value
 * @returns {string|null} Authorization header value or null
 */
function getAuthHeader() {
  const token = getToken();
  return token ? `Bearer ${token}` : null;
}

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Response with token and user data
 */
async function register(email, password) {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please provide a valid email address');
    }

    // Validate password length
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors
      if (data.details && Array.isArray(data.details)) {
        const errorMessages = data.details.map(err => err.msg || err.message).join(', ');
        throw new Error(errorMessages);
      }
      throw new Error(data.error || 'Registration failed');
    }

    // Store token
    if (data.token) {
      setToken(data.token);
    }

    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Response with token and user data
 */
async function login(email, password) {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please provide a valid email address');
    }

    if (!password) {
      throw new Error('Password is required');
    }

    const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors
      if (data.details && Array.isArray(data.details)) {
        const errorMessages = data.details.map(err => err.msg || err.message).join(', ');
        throw new Error(errorMessages);
      }
      throw new Error(data.error || 'Login failed');
    }

    // Store token
    if (data.token) {
      setToken(data.token);
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

/**
 * Verify JWT token
 * @returns {Promise<Object>} Response with user data if token is valid
 */
async function verifyToken() {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Token invalid or expired
      removeToken();
      throw new Error(data.error || 'Token verification failed');
    }

    return data;
  } catch (error) {
    console.error('Token verification error:', error);
    removeToken();
    throw error;
  }
}

/**
 * Get current user information
 * @returns {Promise<Object>} User data
 */
async function getCurrentUser() {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No token found');
    }

    const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Token invalid or expired
      removeToken();
      throw new Error(data.error || 'Failed to get user information');
    }

    return data;
  } catch (error) {
    console.error('Get user error:', error);
    removeToken();
    throw error;
  }
}

/**
 * Logout user (remove token)
 */
function logout() {
  removeToken();
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getToken,
    setToken,
    removeToken,
    getAuthHeader,
    register,
    login,
    verifyToken,
    getCurrentUser,
    logout,
  };
}

// Also make available globally for browser usage
if (typeof window !== 'undefined') {
  window.authUtils = {
    getToken,
    setToken,
    removeToken,
    getAuthHeader,
    register,
    login,
    verifyToken,
    getCurrentUser,
    logout,
  };
}



