// Capture PNG screenshots of rendered sheet music using Playwright
// This uses a real browser to render MusicXML via OSMD
// Run with: npx tsx scripts/capture-screenshots.ts

import { chromium } from 'playwright';
import { parseScoreToAST } from '../src/lib/score-parser';
import { transpileToMusicXML } from '../src/lib/score-musicxml';
import { GOD_EXAMPLE } from '../src/lib/__tests__/fixtures/god-example';
import { BEAM_TESTS, CHORD_TESTS, RHYTHM_TESTS, DYNAMICS_TESTS, BASICS_TESTS, CONTEXT_TESTS, GRACE_TESTS, FINGERING_TESTS } from '../src/lib/__tests__/fixtures/stress-tests';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../src/lib/__tests__/__screenshots__');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Test cases to render
const TEST_CASES: Record<string, string> = {
	'god_example': GOD_EXAMPLE,
	'stress_beams': BEAM_TESTS,
	'stress_chords': CHORD_TESTS,
	'stress_rhythm': RHYTHM_TESTS,
	'stress_dynamics': DYNAMICS_TESTS,
	'stress_basics': BASICS_TESTS,
	'stress_context': CONTEXT_TESTS,
	'stress_grace': GRACE_TESTS,
	'stress_fingering': FINGERING_TESTS,
};

// Helper to convert Scorelang to MusicXML
function toMusicXML(source: string): string {
	const { ast, errors } = parseScoreToAST(source);
	if (!ast || errors.length > 0) {
		console.error('Parse errors:', errors);
		throw new Error(`Parse failed: ${errors.map(e => e.message).join(', ')}`);
	}
	return transpileToMusicXML(ast);
}

// HTML template that loads OSMD and renders MusicXML
function createRenderHTML(musicXML: string, title: string): string {
	const escapedXML = musicXML
		.replace(/\\/g, '\\\\')
		.replace(/`/g, '\\`')
		.replace(/\$/g, '\\$');

	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js"></script>
  <style>
    body { margin: 0; padding: 20px; background: white; }
    #osmd { width: 1000px; }
    #status { font-family: monospace; padding: 10px; }
  </style>
</head>
<body>
  <div id="status">Loading...</div>
  <div id="osmd"></div>
  <script>
    const musicXML = \`${escapedXML}\`;
    
    async function render() {
      try {
        const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("osmd", {
          autoResize: false,
          backend: "svg",
          drawTitle: true,
          drawComposer: false,
          drawCredits: false,
          drawPartNames: true,
        });
        
        await osmd.load(musicXML);
        osmd.render();
        
        document.getElementById('status').textContent = 'Rendered';
        document.getElementById('status').setAttribute('data-ready', 'true');
      } catch (err) {
        document.getElementById('status').textContent = 'Error: ' + err.message;
        document.getElementById('status').setAttribute('data-error', 'true');
        console.error(err);
      }
    }
    
    render();
  </script>
</body>
</html>`;
}

async function captureScreenshots() {
	console.log('Starting Playwright browser...');
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 1200, height: 800 }
	});

	for (const [name, source] of Object.entries(TEST_CASES)) {
		console.log(`\nRendering: ${name}`);

		try {
			const musicXML = toMusicXML(source);
			const html = createRenderHTML(musicXML, name);

			const page = await context.newPage();

			// Load the HTML directly
			await page.setContent(html);

			// Wait for OSMD to render
			await page.waitForFunction(() => {
				const status = document.getElementById('status');
				return status?.getAttribute('data-ready') === 'true' ||
					status?.getAttribute('data-error') === 'true';
			}, { timeout: 30000 });

			// Check for errors
			const status = await page.$eval('#status', el => el.textContent);
			if (status?.startsWith('Error')) {
				console.log(`  ERROR: ${status}`);
				await page.close();
				continue;
			}

			// Wait a bit for rendering to stabilize
			await page.waitForTimeout(500);

			// Capture screenshot of just the OSMD container
			const osmd = await page.$('#osmd');
			if (osmd) {
				const screenshotPath = path.join(OUTPUT_DIR, `${name}.png`);
				await osmd.screenshot({ path: screenshotPath });
				console.log(`  Saved: ${screenshotPath}`);
			}

			await page.close();
		} catch (err) {
			console.log(`  Failed: ${err}`);
		}
	}

	await browser.close();
	console.log('\nDone!');
}

captureScreenshots().catch(console.error);
