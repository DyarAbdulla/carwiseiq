/**
 * Generate JWT Secret
 * Run: node scripts/generate-secret.js
 */

const crypto = require('crypto');

const secret = crypto.randomBytes(64).toString('hex');

console.log('\n🔐 Generated JWT Secret:\n');
console.log(secret);
console.log('\n📝 Add this to your .env file as JWT_SECRET\n');








