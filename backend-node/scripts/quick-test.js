/**
 * Quick Test - Simple connection test
 */

const axios = require('axios');

const API_URL = 'http://127.0.0.1:3001';

console.log('Testing connection to:', API_URL);
console.log('Attempting health check...\n');

axios.get(`${API_URL}/health`, { timeout: 5000 })
    .then(response => {
        console.log('✓ SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    })
    .catch(error => {
        console.log('✗ FAILED!');
        console.log('Error:', error.message);
        if (error.code) {
            console.log('Error code:', error.code);
        }
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    });

