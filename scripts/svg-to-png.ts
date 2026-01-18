// Script to convert SVG files to PNG for visual verification
// Run with: npx tsx scripts/svg-to-png.ts

import { createCanvas, loadImage, registerFont } from 'canvas';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_DIR = path.join(__dirname, '../src/lib/__tests__/__images__');
const PNG_DIR = path.join(IMAGE_DIR, 'png');

// Ensure PNG output directory exists
if (!fs.existsSync(PNG_DIR)) {
	fs.mkdirSync(PNG_DIR, { recursive: true });
}

// Get all SVG files
const svgFiles = fs.readdirSync(IMAGE_DIR).filter(f => f.endsWith('.svg'));

console.log(`Converting ${svgFiles.length} SVG files to PNG...`);

for (const svgFile of svgFiles) {
	const svgPath = path.join(IMAGE_DIR, svgFile);
	const pngFile = svgFile.replace('.svg', '.png');
	const pngPath = path.join(PNG_DIR, pngFile);

	const svgContent = fs.readFileSync(svgPath, 'utf-8');

	// Parse SVG to get dimensions
	const dom = new JSDOM(svgContent);
	const svgEl = dom.window.document.querySelector('svg');

	if (!svgEl) {
		console.log(`  Skipping ${svgFile}: No SVG element found`);
		continue;
	}

	const width = parseInt(svgEl.getAttribute('width') || '1200');
	const height = parseInt(svgEl.getAttribute('height') || '800');

	// Create canvas and draw
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// White background
	ctx.fillStyle = 'white';
	ctx.fillRect(0, 0, width, height);

	// For proper SVG rendering, we'd need a full SVG renderer
	// For now, we'll just output info about the file
	console.log(`  ${svgFile}: ${width}x${height}`);

	// Save placeholder PNG (canvas with info)
	ctx.fillStyle = 'black';
	ctx.font = '14px sans-serif';
	ctx.fillText(`File: ${svgFile}`, 20, 30);
	ctx.fillText(`Dimensions: ${width}x${height}`, 20, 50);
	ctx.fillText(`Open the SVG file in a browser to view the sheet music`, 20, 70);

	const buffer = canvas.toBuffer('image/png');
	fs.writeFileSync(pngPath, buffer);
}

console.log(`\nDone! PNG files saved to: ${PNG_DIR}`);
console.log('\nTo properly view the sheet music, open the SVG files in a web browser.');
