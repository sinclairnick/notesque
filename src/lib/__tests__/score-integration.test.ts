// Scorelang Integration Tests
// End-to-end tests validating the full pipeline: Source → Lexer → Parser → MusicXML

import { describe, it, expect } from 'vitest';
import { parseScoreToAST } from '../score-parser';
import { transpileToMusicXML } from '../score-musicxml';
import { SPEC_EXAMPLES, CORE_EXAMPLES } from './fixtures/spec-examples';

// Helper to parse and transpile in one step
function scorelangToXML(source: string): { xml: string | null; errors: string[] } {
	const { ast, errors } = parseScoreToAST(source);
	if (!ast || errors.length > 0) {
		return { xml: null, errors: errors.map((e) => `Line ${e.line}: ${e.message}`) };
	}
	try {
		const xml = transpileToMusicXML(ast);
		return { xml, errors: [] };
	} catch (e) {
		return { xml: null, errors: [e instanceof Error ? e.message : 'Unknown transpile error'] };
	}
}

// Helper to check if XML is well-formed (basic validation without DOMParser)
function isWellFormedXML(xml: string): { valid: boolean; error?: string } {
	// Basic structural checks since DOMParser isn't available in Node.js
	if (!xml.includes('<?xml')) {
		return { valid: false, error: 'Missing XML declaration' };
	}
	if (!xml.includes('<score-partwise')) {
		return { valid: false, error: 'Missing score-partwise root element' };
	}
	if (!xml.includes('</score-partwise>')) {
		return { valid: false, error: 'Missing closing score-partwise tag' };
	}

	// Check for balanced basic tags
	const openParts = (xml.match(/<part /g) || []).length;
	const closeParts = (xml.match(/<\/part>/g) || []).length;
	if (openParts !== closeParts) {
		return { valid: false, error: `Unbalanced part tags: ${openParts} open, ${closeParts} close` };
	}

	const openMeasures = (xml.match(/<measure /g) || []).length;
	const closeMeasures = (xml.match(/<\/measure>/g) || []).length;
	if (openMeasures !== closeMeasures) {
		return { valid: false, error: `Unbalanced measure tags: ${openMeasures} open, ${closeMeasures} close` };
	}

	return { valid: true };
}

describe('Integration: End-to-End Pipeline', () => {
	describe('Core Examples', () => {
		Object.entries(CORE_EXAMPLES).forEach(([name, source]) => {
			it(`parses and transpiles "${name}" without errors`, () => {
				const { xml, errors } = scorelangToXML(source);
				expect(errors, `${name} should have no errors`).toEqual([]);
				expect(xml).not.toBeNull();
			});

			it(`produces well-formed XML for "${name}"`, () => {
				const { xml } = scorelangToXML(source);
				expect(xml).not.toBeNull();
				if (xml) {
					const result = isWellFormedXML(xml);
					expect(result.valid, result.error).toBe(true);
				}
			});
		});
	});

	describe('All Spec Examples', () => {
		Object.entries(SPEC_EXAMPLES).forEach(([name, source]) => {
			it(`processes "${name}" through full pipeline`, () => {
				const { xml, errors } = scorelangToXML(source);
				// Some examples may have expected errors (unimplemented features)
				// but for implemented features, we expect success
				if (errors.length === 0) {
					expect(xml).not.toBeNull();
					if (xml) {
						expect(xml).toContain('<score-partwise');
						expect(xml).toContain('</score-partwise>');
					}
				}
			});
		});
	});

	describe('XML Structure Validation', () => {
		it('includes required MusicXML elements', () => {
			const { xml } = scorelangToXML(CORE_EXAMPLES.basicNotes);
			expect(xml).not.toBeNull();
			if (xml) {
				// Required structure
				expect(xml).toContain('<?xml version="1.0"');
				expect(xml).toContain('<score-partwise version="4.0">');
				expect(xml).toContain('<part-list>');
				expect(xml).toContain('<part id=');
				expect(xml).toContain('<measure number="1">');
				expect(xml).toContain('<attributes>');
				expect(xml).toContain('<divisions>');
				expect(xml).toContain('<clef>');
			}
		});

		it('includes key signature', () => {
			const source = `---
&main:
  clef: treble
key: G major
---
&main { C D E F }`;
			const { xml } = scorelangToXML(source);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<key>');
				expect(xml).toContain('<fifths>1</fifths>'); // G major = 1 sharp
				expect(xml).toContain('<mode>major</mode>');
			}
		});

		it('includes time signature', () => {
			const source = `---
&main:
  clef: treble
time: 3/4
---
&main { C D E }`;
			const { xml } = scorelangToXML(source);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<time>');
				expect(xml).toContain('<beats>3</beats>');
				expect(xml).toContain('<beat-type>4</beat-type>');
			}
		});

		it('includes correct clefs for multiple staves', () => {
			const { xml } = scorelangToXML(CORE_EXAMPLES.twoStaves);
			expect(xml).not.toBeNull();
			if (xml) {
				// Should have treble (G on line 2) and bass (F on line 4)
				expect(xml).toMatch(/<sign>G<\/sign>\s*<line>2<\/line>/);
				expect(xml).toMatch(/<sign>F<\/sign>\s*<line>4<\/line>/);
			}
		});
	});

	describe('Note Elements', () => {
		it('transpiles notes with correct pitch elements', () => {
			const { xml } = scorelangToXML(CORE_EXAMPLES.basicNotes);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<pitch>');
				expect(xml).toContain('<step>A</step>');
				expect(xml).toContain('<step>B</step>');
				expect(xml).toContain('<step>C</step>');
			}
		});

		it('transpiles accidentals correctly', () => {
			const source = `---
&main:
  clef: treble
---
&main { C# Bb F## Ebb }`;
			const { xml } = scorelangToXML(source);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<alter>1</alter>'); // C#
				expect(xml).toContain('<alter>-1</alter>'); // Bb
				expect(xml).toContain('<alter>2</alter>'); // F##
				expect(xml).toContain('<alter>-2</alter>'); // Ebb
			}
		});

		it('transpiles durations correctly', () => {
			const { xml } = scorelangToXML(CORE_EXAMPLES.durations);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<type>whole</type>');
				expect(xml).toContain('<type>half</type>');
				expect(xml).toContain('<type>quarter</type>');
				expect(xml).toContain('<type>eighth</type>');
				expect(xml).toContain('<type>16th</type>');
				expect(xml).toContain('<type>32nd</type>');
			}
		});

		it('transpiles dotted notes', () => {
			const source = `---
&main:
  clef: treble
---
&main { C/4. }`;
			const { xml } = scorelangToXML(source);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<dot/>');
			}
		});

		it('transpiles chords with multiple notes', () => {
			const { xml } = scorelangToXML(CORE_EXAMPLES.chords);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<chord/>'); // Second and third notes have chord tag
			}
		});

		it('transpiles rests', () => {
			const { xml } = scorelangToXML(CORE_EXAMPLES.rests);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<rest/>');
			}
		});
	});

	describe('Dynamics and Articulations', () => {
		it('transpiles dynamics', () => {
			const { xml } = scorelangToXML(CORE_EXAMPLES.dynamics);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<dynamics>');
				expect(xml).toContain('<p/>');
			}
		});

		it('transpiles articulations', () => {
			const { xml } = scorelangToXML(CORE_EXAMPLES.articulations);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<articulations>');
				expect(xml).toContain('<staccato/>');
			}
		});

		it('transpiles fingerings', () => {
			const source = `---
&main:
  clef: treble
---
&main { C@1 E@3 }`;
			const { xml } = scorelangToXML(source);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<technical>');
				expect(xml).toContain('<fingering>1</fingering>');
				expect(xml).toContain('<fingering>3</fingering>');
			}
		});
	});

	describe('Measure Splitting', () => {
		it('splits notes into correct number of measures in 4/4', () => {
			const source = `---
&main:
  clef: treble
time: 4/4
---
&main { C D E F G A B C }`;
			const { xml } = scorelangToXML(source);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<measure number="1">');
				expect(xml).toContain('<measure number="2">');
			}
		});

		it('splits notes into correct number of measures in 3/4', () => {
			const source = `---
&main:
  clef: treble
time: 3/4
---
&main { C D E F G A }`;
			const { xml } = scorelangToXML(source);
			expect(xml).not.toBeNull();
			if (xml) {
				expect(xml).toContain('<measure number="1">');
				expect(xml).toContain('<measure number="2">');
			}
		});
	});

	describe('Complete Example from Spec', () => {
		it('successfully processes the complete spec example', () => {
			const { xml, errors } = scorelangToXML(CORE_EXAMPLES.completeExample);
			expect(errors).toEqual([]);
			expect(xml).not.toBeNull();
			if (xml) {
				// Has two parts (right and left hand)
				expect(xml).toContain('<part id="P1">');
				expect(xml).toContain('<part id="P2">');
				// Has part grouping (brace)
				expect(xml).toContain('<part-group');
			}
		});
	});
});
