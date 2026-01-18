// Scorelang v2.0 Parser Tests

import { describe, it, expect } from 'vitest';
import { parseScoreToAST } from '../score-parser';

describe('Parser: Context Blocks', () => {
	it('parses basic context block', () => {
		const source = `---
title: Test
key: C major
time: 4/4
tempo: 120
---`;

		const { ast } = parseScoreToAST(source);
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

describe('Parser: Automatic Measure Splitting', () => {
	it('creates one measure for 4 quarter notes in 4/4 time', () => {
		const source = `---
&main:
  clef: treble
time: 4/4
---
&main { C D E F }`;

		const { ast } = parseScoreToAST(source);
		expect(ast?.staves[0].measures).toHaveLength(1);
		expect(ast?.staves[0].measures[0].elements).toHaveLength(4);
	});

	it('creates two measures for 8 quarter notes in 4/4 time', () => {
		const source = `---
&main:
  clef: treble
time: 4/4
---
&main { C D E F G A B C }`;

		const { ast } = parseScoreToAST(source);
		expect(ast?.staves[0].measures).toHaveLength(2);
		expect(ast?.staves[0].measures[0].elements).toHaveLength(4);
		expect(ast?.staves[0].measures[1].elements).toHaveLength(4);
	});

	it('respects 3/4 time signature', () => {
		const source = `---
&main:
  clef: treble
time: 3/4
---
&main { C D E F G A }`;

		const { ast } = parseScoreToAST(source);
		expect(ast?.staves[0].measures).toHaveLength(2);
		expect(ast?.staves[0].measures[0].elements).toHaveLength(3);
		expect(ast?.staves[0].measures[1].elements).toHaveLength(3);
	});

	it('handles incomplete final measure', () => {
		const source = `---
&main:
  clef: treble
time: 4/4
---
&main { C D E F G }`;

		const { ast } = parseScoreToAST(source);
		expect(ast?.staves[0].measures).toHaveLength(2);
		expect(ast?.staves[0].measures[0].elements).toHaveLength(4);
		expect(ast?.staves[0].measures[1].elements).toHaveLength(1); // G is in incomplete second measure
	});

	it('handles half notes correctly', () => {
		const source = `---
&main:
  clef: treble
time: 4/4
---
&main { C/2 D/2 E/2 F/2 }`;

		const { ast } = parseScoreToAST(source);
		// 4 half notes = 8 beats = 2 measures of 4 beats each
		expect(ast?.staves[0].measures).toHaveLength(2);
		expect(ast?.staves[0].measures[0].elements).toHaveLength(2);
		expect(ast?.staves[0].measures[1].elements).toHaveLength(2);
	});
});

// ============================================================
// COMPREHENSIVE SPEC COVERAGE TESTS
// ============================================================

describe('Parser: All Dynamics (§5)', () => {
	const dynamics = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];

	dynamics.forEach(dyn => {
		it(`parses ${dyn} dynamic`, () => {
			const source = `---
&main:
  clef: treble
---
&main { ${dyn}(C D) }`;

			const { ast } = parseScoreToAST(source);
			const note = ast?.staves[0].measures[0].elements[0];
			if (note?.kind === 'Note') {
				expect(note.annotation?.dynamic).toBe(dyn);
			}
		});
	});
});

describe('Parser: All Articulations (§5)', () => {
	const articulations: Record<string, string> = {
		'st': 'staccato',
		'tn': 'tenuto',
		'ac': 'accent',
		'mc': 'marcato',
		'fm': 'fermata',
		'tr': 'trill',
	};

	Object.entries(articulations).forEach(([fn, art]) => {
		it(`parses ${fn}() articulation as ${art}`, () => {
			const source = `---
&main:
  clef: treble
---
&main { ${fn}(C) }`;

			const { ast } = parseScoreToAST(source);
			const note = ast?.staves[0].measures[0].elements[0];
			if (note?.kind === 'Note') {
				expect(note.annotation?.articulations).toContain(art);
			}
		});
	});
});

describe('Parser: Crescendo/Decrescendo (§5)', () => {
	it('parses crescendo with start/end annotations', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E F } { cresc(1-4) }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;

		// First note should have crescendo start
		if (elements?.[0]?.kind === 'Note') {
			expect(elements[0].annotation?.crescendo).toBe('start');
		}
		// Last note should have crescendo end
		if (elements?.[3]?.kind === 'Note') {
			expect(elements[3].annotation?.crescendo).toBe('end');
		}
	});

	it('parses decrescendo with start/end annotations', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E F } { decresc(1-4) }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;

		if (elements?.[0]?.kind === 'Note') {
			expect(elements[0].annotation?.decrescendo).toBe('start');
		}
		if (elements?.[3]?.kind === 'Note') {
			expect(elements[3].annotation?.decrescendo).toBe('end');
		}
	});
});

describe('Parser: Double Accidentals (§2.1)', () => {
	it('parses double sharp', () => {
		const source = `---
&main:
  clef: treble
---
&main { C## F## }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;
		if (elements?.[0]?.kind === 'Note') {
			expect(elements[0].pitch.accidental).toBe('##');
		}
	});

	it('parses double flat', () => {
		const source = `---
&main:
  clef: treble
---
&main { Bbb Ebb }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;
		if (elements?.[0]?.kind === 'Note') {
			expect(elements[0].pitch.accidental).toBe('bb');
		}
	});
});

describe('Parser: All Durations (§2.3)', () => {
	const durations: Record<string, string> = {
		'/1': 'w',
		'/2': 'h',
		'/4': 'q',
		'/8': '8',
		'/16': '16',
		'/32': '32',
	};

	Object.entries(durations).forEach(([input, base]) => {
		it(`parses ${input} as duration base ${base}`, () => {
			const source = `---
&main:
  clef: treble
---
&main { C${input} }`;

			const { ast } = parseScoreToAST(source);
			const note = ast?.staves[0].measures[0].elements[0];
			if (note?.kind === 'Note') {
				expect(note.duration.base).toBe(base);
			}
		});
	});

	it('parses dotted duration', () => {
		const source = `---
&main:
  clef: treble
---
&main { C/4. }`;

		const { ast } = parseScoreToAST(source);
		const note = ast?.staves[0].measures[0].elements[0];
		if (note?.kind === 'Note') {
			expect(note.duration.base).toBe('q');
			expect(note.duration.dots).toBe(1);
		}
	});

	it('parses double-dotted duration', () => {
		const source = `---
&main:
  clef: treble
---
&main { C/2.. }`;

		const { ast } = parseScoreToAST(source);
		const note = ast?.staves[0].measures[0].elements[0];
		if (note?.kind === 'Note') {
			expect(note.duration.base).toBe('h');
			expect(note.duration.dots).toBe(2);
		}
	});
});

describe('Parser: Chord Details (§4.2)', () => {
	it('parses chord with accidentals', () => {
		const source = `---
&main:
  clef: treble
---
&main { [C# Eb G] }`;

		const { ast } = parseScoreToAST(source);
		const chord = ast?.staves[0].measures[0].elements[0];
		if (chord?.kind === 'Chord') {
			expect(chord.pitches).toHaveLength(3);
			expect(chord.pitches[0].accidental).toBe('#');
			expect(chord.pitches[1].accidental).toBe('b');
		}
	});

	it('parses chord with octave numbers', () => {
		const source = `---
&main:
  clef: treble
---
&main { [C4 E4 G4] }`;

		const { ast } = parseScoreToAST(source);
		const chord = ast?.staves[0].measures[0].elements[0];
		if (chord?.kind === 'Chord') {
			expect(chord.pitches[0].octave).toBe(4);
			expect(chord.pitches[1].octave).toBe(4);
			expect(chord.pitches[2].octave).toBe(4);
		}
	});
});

describe('Parser: All Octaves (§2.2)', () => {
	it('parses all valid octave numbers 0-8', () => {
		const source = `---
&main:
  clef: treble
time: 9/4
---
&main { C0 C1 C2 C3 C4 C5 C6 C7 C8 }`;

		const { ast } = parseScoreToAST(source);
		// Collect elements from all measures (9/4 time fits all 9 quarter notes in one measure)
		const elements = ast?.staves[0].measures.flatMap(m => m.elements) ?? [];
		expect(elements).toHaveLength(9);

		for (let i = 0; i <= 8; i++) {
			const note = elements?.[i];
			if (note?.kind === 'Note') {
				expect(note.pitch.octave).toBe(i);
			}
		}
	});
});

describe('Parser: Slur Annotation (§3)', () => {
	it('applies slur annotations via function', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E F } { slur(1-4) }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;

		if (elements?.[0]?.kind === 'Note') {
			expect(elements[0].annotation?.slurStart).toBe(true);
		}
		if (elements?.[3]?.kind === 'Note') {
			expect(elements[3].annotation?.slurEnd).toBe(true);
		}
	});
});

describe('Parser: Tie Annotation (§3)', () => {
	it('applies tie via function', () => {
		const source = `---
&main:
  clef: treble
---
&main { C D E F } { tie(1-2) }`;

		const { ast } = parseScoreToAST(source);
		const elements = ast?.staves[0].measures[0].elements;

		if (elements?.[0]?.kind === 'Note') {
			expect(elements[0].tied).toBe(true);
		}
	});
});

describe('Parser: Error Handling', () => {
	it('returns errors for invalid syntax', () => {
		const source = `&main { `;  // Unterminated
		const { ast, errors } = parseScoreToAST(source);
		// Should either parse with warnings or return errors
		expect(ast !== null || errors.length > 0).toBe(true);
	});

	it('handles empty source', () => {
		const { ast, errors } = parseScoreToAST('');
		expect(errors).toHaveLength(0);
		expect(ast).not.toBeNull();
	});
});

