// Simple script to create placeholder car images
// Run with: node frontend/scripts/create-placeholder-images.js

const fs = require('fs');
const path = require('path');

const carsDir = path.join(__dirname, '../public/images/cars');
if (!fs.existsSync(carsDir)) {
  fs.mkdirSync(carsDir, { recursive: true });
}

// Create a simple SVG placeholder
function createSVGPlaceholder(text, filename) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#1e293b"/>
  <text x="400" y="300" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">${text}</text>
</svg>`;
  fs.writeFileSync(path.join(carsDir, filename.replace('.png', '.svg')), svg);
}

// List of placeholder images to create
const placeholders = [
  { name: 'default-car.png', text: 'Default Car' },
  { name: 'toyota_camry_2025.png', text: 'Toyota Camry' },
  { name: 'toyota_corolla_2025.png', text: 'Toyota Corolla' },
  { name: 'honda_accord_2025.png', text: 'Honda Accord' },
  { name: 'honda_civic_2025.png', text: 'Honda Civic' },
  { name: 'hyundai_sonata_2025.png', text: 'Hyundai Sonata' },
  { name: 'hyundai_elantra_2025.png', text: 'Hyundai Elantra' },
  { name: 'bmw_3series_2025.png', text: 'BMW 3 Series' },
];

placeholders.forEach(({ name, text }) => {
  createSVGPlaceholder(text, name);
  console.log(`Created ${name}`);
});

console.log('\nPlaceholder images created! Note: These are SVG files. For production, convert to PNG.');
