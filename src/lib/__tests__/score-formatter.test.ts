// Scorelang v2.0 Formatter Tests

import { describe, it, expect } from 'vitest';
import { formatScore, minifyScore } from '../score-formatter';

describe('Formatter: Basic', () => {
	it('formats context block', () => {
		const source = `---
title:Test
tempo:120
---`;
		const formatted = formatScore(source);
		expect(formatted).toContain('title: Test');
		expect(formatted).toContain('tempo: 120');
	});

	it('formats stave declarations in context', () => {
		const source = `---
&right:
clef:treble
---`;
		const formatted = formatScore(source);
		expect(formatted).toContain('&right:');
		expect(formatted).toContain('clef: treble');
	});

	it('formats stave body', () => {
		const source = '&right{C D E F}';
		const formatted = formatScore(source);
		expect(formatted).toContain('&right { C D E F }');
	});

	it('preserves note elements', () => {
		const source = '&main { C#4/8 D Eb/4. }';
		const formatted = formatScore(source);
		expect(formatted).toContain('C#4/8');
		expect(formatted).toContain('Eb/4.');
	});
});

describe('Formatter: Connectives', () => {
	it('formats slurs without spaces by default', () => {
		const source = '&main { C~D~E }';
		const formatted = formatScore(source);
		expect(formatted).toMatch(/C~D~E/);
	});

	it('formats ties correctly', () => {
		const source = '&main { C^C }';
		const formatted = formatScore(source);
		expect(formatted).toMatch(/C\^C/);
	});
});

describe('Formatter: Chords', () => {
	it('formats chord brackets', () => {
		const source = '&main { [C E G]/2 }';
		const formatted = formatScore(source);
		expect(formatted).toContain('[C E G]');
	});
});

describe('Formatter: Functions', () => {
	it('formats function calls', () => {
		const source = '&main { p(C D) f(E F) }';
		const formatted = formatScore(source);
		expect(formatted).toContain('p(C D)');
		expect(formatted).toContain('f(E F)');
	});

	it('formats annotation blocks', () => {
		const source = '&main { C D E } { cresc(1-3) }';
		const formatted = formatScore(source);
		expect(formatted).toContain('cresc(1-3)');
	});
});

describe('Minifier', () => {
	it('removes unnecessary whitespace', () => {
		const source = `---
title: Test
---
&main { C    D    E }`;
		const minified = minifyScore(source);
		expect(minified).not.toContain('    ');
		expect(minified.length).toBeLessThan(source.length);
	});

	it('preserves essential structure', () => {
		const source = `---
tempo: 120
---
&main { C D E }`;
		const minified = minifyScore(source);
		expect(minified).toContain('---');
		expect(minified).toContain('tempo');
		expect(minified).toContain('&main');
	});
});
