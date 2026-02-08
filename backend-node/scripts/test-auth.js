/**
 * Test Authentication API
 * Tests all auth endpoints to verify setup
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = `http://127.0.0.1:${process.env.PORT || 3001}`;

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealth() {
    try {
        log('\n[1/5] Testing health endpoint...', 'blue');
        const response = await axios.get(`${API_URL}/health`, { timeout: 10000 });
        log('✓ Health check passed', 'green');
        log(`  Status: ${response.data.status}`, 'green');
        log(`  Database: ${response.data.database}`, 'green');
        return true;
    } catch (error) {
        log('✗ Health check failed', 'red');
        log(`  Error: ${error.message}`, 'red');
        if (error.code === 'ECONNREFUSED') {
            log('  Server is not running or not accessible', 'red');
        }
        return false;
    }
}

async function testRegister() {
    try {
        log('\n[2/5] Testing registration...', 'blue');
        const testEmail = `test${Date.now()}@example.com`;
        const response = await axios.post(`${API_URL}/api/auth/register`, {
            email: testEmail,
            password: 'testpassword123',
        });
        log('✓ Registration successful', 'green');
        log(`  User ID: ${response.data.user.id}`, 'green');
        log(`  Email: ${response.data.user.email}`, 'green');
        log(`  Token: ${response.data.token.substring(0, 20)}...`, 'green');
        return { token: response.data.token, email: testEmail };
    } catch (error) {
        log('✗ Registration failed', 'red');
        if (error.response) {
            log(`  Error: ${error.response.data.error || error.response.data.message}`, 'red');
        } else {
            log(`  Error: ${error.message}`, 'red');
        }
        return null;
    }
}

async function testLogin(email) {
    try {
        log('\n[3/5] Testing login...', 'blue');
        const response = await axios.post(`${API_URL}/api/auth/login`, {
            email: email,
            password: 'testpassword123',
        });
        log('✓ Login successful', 'green');
        log(`  Token: ${response.data.token.substring(0, 20)}...`, 'green');
        return response.data.token;
    } catch (error) {
        log('✗ Login failed', 'red');
        if (error.response) {
            log(`  Error: ${error.response.data.error || error.response.data.message}`, 'red');
        } else {
            log(`  Error: ${error.message}`, 'red');
        }
        return null;
    }
}

async function testVerify(token) {
    try {
        log('\n[4/5] Testing token verification...', 'blue');
        const response = await axios.get(`${API_URL}/api/auth/verify`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        log('✓ Token verification successful', 'green');
        log(`  Valid: ${response.data.valid}`, 'green');
        log(`  User ID: ${response.data.user.id}`, 'green');
        return true;
    } catch (error) {
        log('✗ Token verification failed', 'red');
        if (error.response) {
            log(`  Error: ${error.response.data.error || error.response.data.message}`, 'red');
        } else {
            log(`  Error: ${error.message}`, 'red');
        }
        return false;
    }
}

async function testMe(token) {
    try {
        log('\n[5/5] Testing /me endpoint...', 'blue');
        const response = await axios.get(`${API_URL}/api/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        log('✓ /me endpoint successful', 'green');
        log(`  User ID: ${response.data.id}`, 'green');
        log(`  Email: ${response.data.email}`, 'green');
        return true;
    } catch (error) {
        log('✗ /me endpoint failed', 'red');
        if (error.response) {
            log(`  Error: ${error.response.data.error || error.response.data.message}`, 'red');
        } else {
            log(`  Error: ${error.message}`, 'red');
        }
        return false;
    }
}

async function runTests() {
    log('========================================', 'blue');
    log('Authentication API Test Suite', 'blue');
    log('========================================', 'blue');
    log(`\nTesting API at: ${API_URL}`, 'yellow');
    log('Make sure the server is running!\n', 'yellow');

    // Test health
    const healthOk = await testHealth();
    if (!healthOk) {
        log('\n✗ Server is not running or not accessible', 'red');
        log('Please start the server with: npm run dev', 'yellow');
        process.exit(1);
    }

    // Test registration
    const registerResult = await testRegister();
    if (!registerResult) {
        log('\n✗ Registration test failed', 'red');
        process.exit(1);
    }

    // Test login
    const loginToken = await testLogin(registerResult.email);
    if (!loginToken) {
        log('\n✗ Login test failed', 'red');
        process.exit(1);
    }

    // Test verify
    const verifyOk = await testVerify(loginToken);
    if (!verifyOk) {
        log('\n✗ Token verification test failed', 'red');
        process.exit(1);
    }

    // Test me
    const meOk = await testMe(loginToken);
    if (!meOk) {
        log('\n✗ /me endpoint test failed', 'red');
        process.exit(1);
    }

    log('\n========================================', 'green');
    log('✓ All tests passed!', 'green');
    log('========================================', 'green');
    log('\nAuthentication system is working correctly!\n', 'green');
}

// Run tests
runTests().catch((error) => {
    log(`\n✗ Test suite error: ${error.message}`, 'red');
    process.exit(1);
});


