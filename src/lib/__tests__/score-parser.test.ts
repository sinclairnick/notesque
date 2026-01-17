// Scorelang v2.0 Parser Tests

import { describe, it, expect } from 'vitest';
import { parseScoreToAST } from '../score-parser-new';

describe('Parser: Context Blocks', () => {
	it('parses basic context block', () => {
		const source = `---
title: Test
key: C major
time: 4/4
tempo: 120
---`;

		const { ast, errors } = parseScoreToAST(source);
		expect(ast).not.toBeNull();
		expect(ast?.metadata.title).toBe('Test');
		expect(ast?.metadata.key).toBe('C major');
		expect(ast?.metadata.tempo).toBe(120);
	});

	it('parses time signature', () => {
		const source = `---
time: 3/4
---`;

		const { ast } = parseScoreToAST(source);
		expect(ast?.metadata.time?.beats).toBe(3);
		expect(ast?.metadata.time?.beatType).toBe(4);
	});

	it('parses stave declarations', () => {
		const source = `---
&right:
  clef: treble
&left:
  clef: bass
---`;

		const { ast } = parseScoreToAST(source);
		expect(ast?.metadata.staves).toHaveLength(2);
		expect(ast?.metadata.staves?.[0].name).toBe('right');
		expect(ast?.metadata.staves?.[0].clef).toBe('treble');
	});

	it('parses multi-voice stave declarations', () => {
		const source = `---
&right+soprano:
  clef: treble
&right+alto:
  clef: treble
---`;

		const { ast } = parseScoreToAST(source);
		expect(ast?.metadata.staves).toHaveLength(2);
		expect(ast?.metadata.staves?.[0].name).toBe('right+soprano');
	});
});

describe('Parser: Stave Bodies', () => {
	it('parses stave body with notes', () => {
		const source = `---
&right:
  clef: treble
---
&right { C D E F }`;

		const { ast } = parseScoreToAST(source);
		expect(ast?.staves).toHaveLength(1);
		expect(ast?.staves[0].measures).toHaveLength(1);
		expect(ast?.staves[0].measures[0].elements).toHaveLength(4);
	});

	it('parses notes with accidentals', () => {
		const source = `---
&main:
  clef: treble
---
&main { C# Db E }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;
		expect(elements?.[0]).toMatchObject({
			kind: 'Note',
			pitch: { note: 'C', accidental: '#' }
		});
		expect(elements?.[1]).toMatchObject({
			kind: 'Note',
			pitch: { note: 'D', accidental: 'b' }
		});
	});

	it('parses notes with durations', () => {
		const source = `---
&main:
  clef: treble
---
&main { C/4 D/8 E/2 }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;
		expect(elements?.[0]).toMatchObject({
			kind: 'Note',
			duration: { base: 'q' }
		});
		expect(elements?.[1]).toMatchObject({
			kind: 'Note',
			duration: { base: '8' }
		});
		expect(elements?.[2]).toMatchObject({
			kind: 'Note',
			duration: { base: 'h' }
		});
	});

	it('parses notes with octave modifiers', () => {
		const source = `---
&main:
  clef: treble
---
&main { C+ D-- }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;
		expect(elements?.[0]).toMatchObject({
			kind: 'Note',
			pitch: { note: 'C', octave: 5 }
		});
		expect(elements?.[1]).toMatchObject({
			kind: 'Note',
			pitch: { note: 'D', octave: 2 }
		});
	});
});

describe('Parser: Chords', () => {
	it('parses chord brackets', () => {
		const source = `---
&main:
  clef: treble
---
&main { [C E G] }`;

		const { ast } = parseScoreToAST(source);
		const chord = ast?.staves[0].measures[0].elements[0];
		expect(chord?.kind).toBe('Chord');
		if (chord?.kind === 'Chord') {
			expect(chord.pitches).toHaveLength(3);
			expect(chord.pitches[0].note).toBe('C');
			expect(chord.pitches[1].note).toBe('E');
			expect(chord.pitches[2].note).toBe('G');
		}
	});

	it('parses chord with duration', () => {
		const source = `---
&main:
  clef: treble
---
&main { [C E G]/2 }`;

		const { ast } = parseScoreToAST(source);
		const chord = ast?.staves[0].measures[0].elements[0];
		if (chord?.kind === 'Chord') {
			expect(chord.duration.base).toBe('h');
		}
	});
});

describe('Parser: Functions', () => {
	it('parses dynamic function', () => {
		const source = `---
&main:
  clef: treble
---
&main { p(C D E) }`;

		const { ast } = parseScoreToAST(source);
		const note = ast?.staves[0].measures[0].elements[0];
		if (note?.kind === 'Note') {
			expect(note.annotation?.dynamic).toBe('p');
		}
	});

	it('parses articulation function', () => {
		const source = `---
&main:
  clef: treble
---
&main { st(C D) }`;

		const { ast } = parseScoreToAST(source);
		const note = ast?.staves[0].measures[0].elements[0];
		if (note?.kind === 'Note') {
			expect(note.annotation?.articulations).toContain('staccato');
		}
	});
});

describe('Parser: Rests', () => {
	it('parses rests', () => {
		const source = `---
&main:
  clef: treble
---
&main { C _ D }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;
		expect(elements?.[1]?.kind).toBe('Rest');
	});

	it('parses rests with duration', () => {
		const source = `---
&main:
  clef: treble
---
&main { _/2 }`;

		const { ast } = parseScoreToAST(source);
		const rest = ast?.staves[0].measures[0].elements[0];
		if (rest?.kind === 'Rest') {
			expect(rest.duration.base).toBe('h');
		}
	});
});

describe('Parser: Fingerings', () => {
	it('parses fingerings', () => {
		const source = `---
&main:
  clef: treble
---
&main { C@1 E@3 }`;

		const { ast } = parseScoreToAST(source);
		const note = ast?.staves[0].measures[0].elements[0];
		if (note?.kind === 'Note') {
			expect(note.annotation?.fingering).toBe(1);
		}
	});
});

describe('Parser: Annotation Blocks', () => {
	it('applies dynamic by range', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E F } { p(1-2) }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;

		// First two notes should have dynamic 'p'
		if (elements?.[0]?.kind === 'Note') {
			expect(elements[0].annotation?.dynamic).toBe('p');
		}
		if (elements?.[1]?.kind === 'Note') {
			expect(elements[1].annotation?.dynamic).toBe('p');
		}
		// Third note should NOT have dynamic
		if (elements?.[2]?.kind === 'Note') {
			expect(elements[2].annotation?.dynamic).toBeUndefined();
		}
	});

	it('applies multiple functions', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E F } { p(1-2) f(3-4) }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;

		if (elements?.[0]?.kind === 'Note') {
			expect(elements[0].annotation?.dynamic).toBe('p');
		}
		if (elements?.[2]?.kind === 'Note') {
			expect(elements[2].annotation?.dynamic).toBe('f');
		}
	});

	it('applies text annotation', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E F } { text(1, "rit.") }`;

		const { ast } = parseScoreToAST(source);
		const note = ast?.staves[0].measures[0].elements[0];
		if (note?.kind === 'Note') {
			expect(note.annotation?.text).toBe('rit.');
		}
	});

	it('applies articulations by range', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E F } { st(1-3) }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;

		// First three notes should have staccato
		for (let i = 0; i < 3; i++) {
			const el = elements?.[i];
			if (el?.kind === 'Note') {
				expect(el.annotation?.articulations).toContain('staccato');
			}
		}
		// Fourth note should NOT have staccato
		if (elements?.[3]?.kind === 'Note') {
			expect(elements[3].annotation?.articulations).toBeUndefined();
		}
	});

	it('applies fingering by annotation', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E } { finger(2-2, 3) }`;

		const { ast } = parseScoreToAST(source);
		const note = ast?.staves[0].measures[0].elements[1];
		if (note?.kind === 'Note') {
			expect(note.annotation?.fingering).toBe(3);
		}
	});
});

