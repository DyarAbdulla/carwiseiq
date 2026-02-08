/**
 * Automated Setup Script
 * Runs all setup steps automatically
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('========================================');
console.log('Car Price Predictor Auth Setup');
console.log('========================================');
console.log('');

// Step 1: Check Node.js version
console.log('[1/6] Checking Node.js version...');
try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    console.log(`✓ Node.js ${nodeVersion} found`);
} catch (error) {
    console.error('✗ Node.js is not installed!');
    console.error('Please install Node.js from https://nodejs.org/');
    process.exit(1);
}

// Step 2: Install dependencies
console.log('\n[2/6] Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✓ Dependencies installed');
} catch (error) {
    console.error('✗ Failed to install dependencies');
    process.exit(1);
}

// Step 3: Check for .env file
console.log('\n[3/6] Checking for .env file...');
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
    console.log('Creating .env file from template...');
    if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✓ .env file created');
    } else {
        console.error('✗ .env.example not found!');
        process.exit(1);
    }
} else {
    console.log('✓ .env file already exists');
}

// Step 4: Generate JWT Secret
console.log('\n[4/6] Generating JWT Secret...');
const secret = crypto.randomBytes(64).toString('hex');
console.log(`Generated secret: ${secret.substring(0, 20)}...`);

// Update .env file with JWT secret if not already set
try {
    let envContent = fs.readFileSync(envPath, 'utf-8');
    if (envContent.includes('JWT_SECRET=your_super_secret_jwt_key_change_this_in_production')) {
        envContent = envContent.replace(
            'JWT_SECRET=your_super_secret_jwt_key_change_this_in_production',
            `JWT_SECRET=${secret}`
        );
        fs.writeFileSync(envPath, envContent);
        console.log('✓ JWT_SECRET added to .env');
    } else if (!envContent.includes('JWT_SECRET=')) {
        envContent += `\nJWT_SECRET=${secret}\n`;
        fs.writeFileSync(envPath, envContent);
        console.log('✓ JWT_SECRET added to .env');
    } else {
        console.log('✓ JWT_SECRET already configured');
    }
} catch (error) {
    console.error('✗ Failed to update .env file:', error.message);
}

// Step 5: Check PostgreSQL
console.log('\n[5/6] Checking PostgreSQL...');
try {
    execSync('psql --version', { stdio: 'ignore' });
    console.log('✓ PostgreSQL found');
} catch (error) {
    console.log('⚠ PostgreSQL not found in PATH');
    console.log('  You may need to install PostgreSQL or add it to PATH');
}

// Step 6: Display next steps
console.log('\n[6/6] Setup complete!');
console.log('\n========================================');
console.log('Next Steps:');
console.log('========================================');
console.log('');
console.log('1. Edit .env file with your PostgreSQL credentials:');
console.log('   - DB_PASSWORD (your PostgreSQL password)');
console.log('   - Other settings as needed');
console.log('');
console.log('2. Create PostgreSQL database:');
console.log('   psql -U postgres -c "CREATE DATABASE car_price_predictor;"');
console.log('');
console.log('3. Setup database schema:');
console.log('   npm run setup-db');
console.log('');
console.log('4. Start the server:');
console.log('   npm run dev');
console.log('');
console.log('5. Add to frontend .env.local:');
console.log('   NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001');
console.log('');
console.log('========================================\n');








