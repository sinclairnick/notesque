// Scorelang Image Export Tests
// These tests render Scorelang to actual image files for visual verification
//
// Images are saved to src/lib/__tests__/__images__/ for manual inspection

import { describe, it, expect, beforeAll } from 'vitest';
import { parseScoreToAST } from '../score-parser';
import { transpileToMusicXML } from '../score-musicxml';
import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

// Output directory for test images
const IMAGE_DIR = path.join(__dirname, '__images__');

// Ensure output directory exists
beforeAll(() => {
	if (!fs.existsSync(IMAGE_DIR)) {
		fs.mkdirSync(IMAGE_DIR, { recursive: true });
	}
});

// OSMD instance
let OSMD: typeof import('opensheetmusicdisplay').OpenSheetMusicDisplay;
let osmdLoaded = false;

// Set up canvas polyfill for OSMD
beforeAll(async () => {
	const { createCanvas: createCanvasFn, Canvas } = await import('canvas');
	(global as any).Canvas = Canvas;

	const originalCreateElement = document.createElement.bind(document);
	document.createElement = function (tagName: string, options?: any): any {
		const element = originalCreateElement(tagName, options);
		if (tagName.toLowerCase() === 'canvas') {
			const canvas = createCanvasFn(1200, 800);
			(element as any).getContext = function (contextType: string) {
				return canvas.getContext(contextType as any);
			};
			(element as any).width = 1200;
			(element as any).height = 800;
		}
		return element;
	};

	if (typeof globalThis.createImageBitmap === 'undefined') {
		(globalThis as any).createImageBitmap = async () => ({ width: 0, height: 0, close: () => { } });
	}
});

// Helper to parse and transpile Scorelang to MusicXML
function toMusicXML(source: string): string {
	const { ast, errors } = parseScoreToAST(source);
	if (!ast || errors.length > 0) {
		throw new Error(`Parse failed: ${errors.map((e) => e.message).join(', ')}`);
	}
	return transpileToMusicXML(ast);
}

// Render MusicXML to SVG and save as file
async function renderAndSave(source: string, filename: string): Promise<string> {
	if (!osmdLoaded) {
		const osmdModule = await import('opensheetmusicdisplay');
		OSMD = osmdModule.OpenSheetMusicDisplay;
		osmdLoaded = true;
	}

	const xml = toMusicXML(source);

	// Create container
	const container = document.createElement('div');
	container.id = 'osmd-render-container';
	container.style.width = '1200px';
	container.style.height = '2000px';
	document.body.appendChild(container);
	Object.defineProperty(container, 'offsetWidth', { value: 1200, configurable: true });
	Object.defineProperty(container, 'offsetHeight', { value: 2000, configurable: true });

	try {
		const osmd = new OSMD(container, {
			autoResize: false,
			backend: 'svg',
			drawTitle: true,
			drawSubtitle: false,
			drawComposer: false,
			drawCredits: false,
			drawPartNames: true,
		});

		await osmd.load(xml);
		osmd.render();

		const svg = container.querySelector('svg');
		if (!svg) {
			throw new Error('No SVG generated');
		}

		const svgContent = svg.outerHTML;
		const filepath = path.join(IMAGE_DIR, `${filename}.svg`);
		fs.writeFileSync(filepath, svgContent);

		return svgContent;
	} finally {
		document.body.removeChild(container);
	}
}

// =============================================================================
// CLEF TESTS
// =============================================================================

describe('Image Export: Clefs', () => {
	it('bass clef renders correctly', async () => {
		const svg = await renderAndSave(`---
title: Bass Clef Test
&left:
  clef: bass
---
&left { C D E F G A B C+ }`, 'clef_bass');

		// Bass clef should have F clef character
		expect(svg).toBeTruthy();
		// File should exist
		expect(fs.existsSync(path.join(IMAGE_DIR, 'clef_bass.svg'))).toBe(true);
	});

	it('treble clef renders correctly', async () => {
		const svg = await renderAndSave(`---
title: Treble Clef Test
&right:
  clef: treble
---
&right { C D E F G A B C+ }`, 'clef_treble');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'clef_treble.svg'))).toBe(true);
	});

	it('grand staff with both clefs renders correctly', async () => {
		const svg = await renderAndSave(`---
title: Grand Staff Test
&right:
  clef: treble
&left:
  clef: bass
---
&right { C D E F }
&left { C D E F }`, 'clef_grand_staff');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'clef_grand_staff.svg'))).toBe(true);
	});
});

// =============================================================================
// DYNAMICS TESTS
// =============================================================================

describe('Image Export: Dynamics', () => {
	it('all dynamics render correctly', async () => {
		const svg = await renderAndSave(`---
title: Dynamics Test
time: 8/4
&main:
  clef: treble
---
&main { ppp(C) pp(D) p(E) mp(F) mf(G) f(A) ff(B) fff(C+) }`, 'dynamics_all');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'dynamics_all.svg'))).toBe(true);
	});
});

// =============================================================================
// ARTICULATIONS TESTS  
// =============================================================================

describe('Image Export: Articulations', () => {
	it('all articulations render correctly', async () => {
		const svg = await renderAndSave(`---
title: Articulations Test
time: 6/4
&main:
  clef: treble
---
&main { st(C) tn(D) ac(E) mc(F) fm(G) tr(A) }`, 'articulations_all');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'articulations_all.svg'))).toBe(true);
	});
});

// =============================================================================
// SLUR TESTS
// =============================================================================

describe('Image Export: Slurs', () => {
	it('slur over multiple notes renders correctly', async () => {
		const svg = await renderAndSave(`---
title: Slur Test
&main:
  clef: treble
---
&main { C D E F } { slur(1-4) }`, 'slur_basic');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'slur_basic.svg'))).toBe(true);
	});
});

// =============================================================================  
// CRESCENDO/DECRESCENDO TESTS
// =============================================================================

describe('Image Export: Crescendo/Decrescendo', () => {
	it('crescendo wedge renders correctly', async () => {
		const svg = await renderAndSave(`---
title: Crescendo Test
&main:
  clef: treble
---
&main { C D E F } { cresc(1-4) }`, 'cresc_basic');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'cresc_basic.svg'))).toBe(true);
	});

	it('decrescendo wedge renders correctly', async () => {
		const svg = await renderAndSave(`---
title: Decrescendo Test
&main:
  clef: treble
---
&main { C D E F } { decresc(1-4) }`, 'decresc_basic');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'decresc_basic.svg'))).toBe(true);
	});
});

// =============================================================================
// ACCIDENTALS TESTS
// =============================================================================

describe('Image Export: Accidentals', () => {
	it('sharps and flats render correctly', async () => {
		const svg = await renderAndSave(`---
title: Accidentals Test
time: 8/4
&main:
  clef: treble
---
&main { C C# D Db E F F# G Gb A }`, 'accidentals_basic');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'accidentals_basic.svg'))).toBe(true);
	});

	it('double sharps and flats render correctly', async () => {
		const svg = await renderAndSave(`---
title: Double Accidentals Test
&main:
  clef: treble
---
&main { C## D Ebb F## }`, 'accidentals_double');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'accidentals_double.svg'))).toBe(true);
	});
});

// =============================================================================
// CHORDS TESTS
// =============================================================================

describe('Image Export: Chords', () => {
	it('basic chords render correctly', async () => {
		const svg = await renderAndSave(`---
title: Chords Test
&main:
  clef: treble
---
&main { [C E G] [D F A] [E G B] [F A C+] }`, 'chords_basic');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'chords_basic.svg'))).toBe(true);
	});
});

// =============================================================================
// DURATIONS TESTS
// =============================================================================

describe('Image Export: Durations', () => {
	it('all durations render correctly', async () => {
		const svg = await renderAndSave(`---
title: Durations Test
time: 15/4
&main:
  clef: treble
---
&main { C/1 D/2 E/4 F/8 G/8 A/16 A/16 B/16 B/16 C+/32 C+/32 C+/32 C+/32 }`, 'durations_all');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'durations_all.svg'))).toBe(true);
	});

	it('dotted notes render correctly', async () => {
		const svg = await renderAndSave(`---
title: Dotted Notes Test
time: 7/4
&main:
  clef: treble
---
&main { C/2. D/4. E/8. F/4 }`, 'durations_dotted');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'durations_dotted.svg'))).toBe(true);
	});
});

// =============================================================================
// COMPLETE EXAMPLE
// =============================================================================

describe('Image Export: Complete Example', () => {
	it('complete score with all features renders correctly', async () => {
		const svg = await renderAndSave(`---
title: Complete Score Test
&right:
  clef: treble
&left:
  clef: bass
tempo: 120
key: C
time: 4/4
---
&right { p(C D) E F } { slur(1-4) cresc(1-4) }
&left { [C E G]/1 }`, 'complete_example');

		expect(svg).toBeTruthy();
		expect(fs.existsSync(path.join(IMAGE_DIR, 'complete_example.svg'))).toBe(true);
	});
});
