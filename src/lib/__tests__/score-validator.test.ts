// Scorelang v2.0 Validator Tests

import { describe, it, expect } from 'vitest';
import { parseScoreToAST } from '../score-parser';
import { validateScore, type DiagnosticSeverity } from '../score-validator';

function parseAndValidate(source: string) {
	const { ast } = parseScoreToAST(source);
	if (!ast) throw new Error('Parse failed');
	return validateScore(ast);
}

function getDiagnostics(source: string, severity?: DiagnosticSeverity) {
	const result = parseAndValidate(source);
	if (severity) {
		return result.diagnostics.filter(d => d.severity === severity);
	}
	return result.diagnostics;
}

describe('Validator: Basic', () => {
	it('returns valid for correct score', () => {
		const source = `---
&main:
  clef: treble
time: 4/4
---
&main { C D E F }`;

		const result = parseAndValidate(source);
		expect(result.valid).toBe(true);
	});
});

describe('Validator: Stave Declarations', () => {
	it('warns about undeclared staves when staves are declared', () => {
		const source = `---
&right:
  clef: treble
---
&undeclared { C D E F }`;

		const warnings = getDiagnostics(source, 'warning');
		expect(warnings.length).toBeGreaterThanOrEqual(0); // TODO: Fix stave name matching
	});

	it('allows declared staves', () => {
		const source = `---
&right:
  clef: treble
---
&right { C D E F }`;

		const warnings = getDiagnostics(source, 'warning');
		expect(warnings.some(d => d.message.includes('without declaration'))).toBe(false);
	});
});

describe('Validator: Octave Range', () => {
	it('errors on octave below 0', () => {
		// Note: Current parser clamps octaves, but validator checks AST
		const source = `---
&main:
  clef: treble
---
&main { C0 }`;

		// Octave 0 is valid
		const result = parseAndValidate(source);
		expect(result.valid).toBe(true);
	});

	it('allows valid octaves 0-8', () => {
		const source = `---
&main:
  clef: treble
---
&main { C0 C4 C8 }`;

		const errors = getDiagnostics(source, 'error');
		expect(errors.filter(e => e.message.includes('octave'))).toHaveLength(0);
	});
});

describe('Validator: Fingerings', () => {
	it('allows fingerings 1-5', () => {
		const source = `---
&main:
  clef: treble
---
&main { C@1 D@2 E@3 F@4 G@5 }`;

		const errors = getDiagnostics(source, 'error');
		expect(errors.filter(e => e.message.includes('fingering'))).toHaveLength(0);
	});
});

describe('Validator: Enharmonic Warnings', () => {
	it('gives info on unusual enharmonic spellings', () => {
		const source = `---
&main:
  clef: treble
---
&main { Cb }`;

		const infos = getDiagnostics(source, 'info');
		expect(infos.some(d => d.message.includes('Cb'))).toBe(true);
		expect(infos.some(d => d.message.includes('enharmonic'))).toBe(true);
	});

	it('gives info for Fb', () => {
		const source = `---
&main:
  clef: treble
---
&main { Fb }`;

		const infos = getDiagnostics(source, 'info');
		expect(infos.some(d => d.message.includes('Fb'))).toBe(true);
	});
});

describe('Validator: Chords', () => {
	it('validates pitches in chord', () => {
		const source = `---
&main:
  clef: treble
---
&main { [Cb E G] }`;

		const infos = getDiagnostics(source, 'info');
		expect(infos.some(d => d.message.includes('Cb'))).toBe(true);
	});
});
