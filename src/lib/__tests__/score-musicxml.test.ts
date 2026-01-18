// Scorelang MusicXML Transpiler Tests
// Tests are organized by spec section to ensure comprehensive coverage

import { describe, it, expect } from 'vitest';
import { parseScoreToAST } from '../score-parser';
import { transpileToMusicXML } from '../score-musicxml';

// Helper to parse and transpile in one step
function toMusicXML(source: string): string {
	const { ast, errors } = parseScoreToAST(source);
	if (!ast) throw new Error(`Parse failed: ${errors.map(e => e.message).join(', ')}`);
	return transpileToMusicXML(ast);
}

describe('Spec §1.1: Stave Declarations', () => {
	it('creates parts for declared staves', () => {
		const xml = toMusicXML(`---
&right:
  clef: treble
&left:
  clef: bass
---
&right { C }
&left { C }`);

		expect(xml).toContain('<part-group type="start" number="1">');
		expect(xml).toContain('<group-symbol>bracket</group-symbol>');
		expect(xml).toContain('<score-part id="P1">');
		expect(xml).toContain('<part-name>right</part-name>');
		expect(xml).toContain('<score-part id="P2">');
		expect(xml).toContain('<part-name>left</part-name>');
	});

	it('applies correct clefs', () => {
		const xml = toMusicXML(`---
&treble:
  clef: treble
&bass:
  clef: bass
---
&treble { C }
&bass { C }`);

		// Treble clef: G on line 2
		expect(xml).toMatch(/<clef>\s*<sign>G<\/sign>\s*<line>2<\/line>\s*<\/clef>/);
		// Bass clef: F on line 4
		expect(xml).toMatch(/<clef>\s*<sign>F<\/sign>\s*<line>4<\/line>\s*<\/clef>/);
	});
});

describe('Spec §1.3: Context Blocks', () => {
	it('applies tempo metadata', () => {
		const { ast } = parseScoreToAST(`---
tempo: 120
---`);
		expect(ast?.metadata.tempo).toBe(120);
	});

	it('applies key signature', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
key: D major
---
&main { C }`);

		// D major = 2 sharps = fifths 2
		expect(xml).toMatch(/<key>\s*<fifths>2<\/fifths>\s*<mode>major<\/mode>\s*<\/key>/);
	});

	it('applies minor key signature', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
key: Am
---
&main { C }`);

		// A minor = 0 sharps/flats, minor mode
		expect(xml).toMatch(/<key>\s*<fifths>0<\/fifths>\s*<mode>minor<\/mode>\s*<\/key>/);
	});

	it('applies time signature', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
time: 3/4
---
&main { C D E }`);

		expect(xml).toMatch(/<time>\s*<beats>3<\/beats>\s*<beat-type>4<\/beat-type>\s*<\/time>/);
	});

	it('applies default octave to notes', () => {
		const { ast } = parseScoreToAST(`---
&main:
  clef: treble
octave: 5
---
&main { C }`);

		const note = ast?.staves[0].measures[0].elements[0];
		expect(note?.kind).toBe('Note');
		if (note?.kind === 'Note') {
			expect(note.pitch.octave).toBe(5);
		}
	});
});

// ============================================================
// SPEC SECTION 2: Core Note Syntax
// ============================================================

describe('Spec §2.1: Pitch & Accidentals', () => {
	it('transpiles all note letters', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { A B C D E F G }`);

		expect(xml).toContain('<step>A</step>');
		expect(xml).toContain('<step>B</step>');
		expect(xml).toContain('<step>C</step>');
		expect(xml).toContain('<step>D</step>');
		expect(xml).toContain('<step>E</step>');
		expect(xml).toContain('<step>F</step>');
		expect(xml).toContain('<step>G</step>');
	});

	it('transpiles single sharp', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C# }`);

		expect(xml).toContain('<alter>1</alter>');
		expect(xml).toContain('<accidental>sharp</accidental>');
	});

	it('transpiles double sharp', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C## }`);

		expect(xml).toContain('<alter>2</alter>');
		expect(xml).toContain('<accidental>double-sharp</accidental>');
	});

	it('transpiles single flat', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { Bb }`);

		expect(xml).toContain('<alter>-1</alter>');
		expect(xml).toContain('<accidental>flat</accidental>');
	});

	it('transpiles double flat', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { Bbb }`);

		expect(xml).toContain('<alter>-2</alter>');
		expect(xml).toContain('<accidental>flat-flat</accidental>');
	});
});

describe('Spec §2.2: Octave', () => {
	it('transpiles absolute octave', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C4 }`);

		expect(xml).toContain('<octave>4</octave>');
	});

	it('transpiles relative octave up (+)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
octave: 4
---
&main { C+ }`);

		expect(xml).toContain('<octave>5</octave>');
	});

	it('transpiles relative octave up (++)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
octave: 4
---
&main { C++ }`);

		expect(xml).toContain('<octave>6</octave>');
	});

	it('transpiles relative octave down (-)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
octave: 4
---
&main { C- }`);

		expect(xml).toContain('<octave>3</octave>');
	});

	it('transpiles relative octave down (--)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
octave: 4
---
&main { C-- }`);

		expect(xml).toContain('<octave>2</octave>');
	});
});

describe('Spec §2.3: Duration', () => {
	it('transpiles whole note (/1)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C/1 }`);

		expect(xml).toContain('<type>whole</type>');
		expect(xml).toContain('<duration>16</duration>'); // 4 beats * 4 divisions
	});

	it('transpiles half note (/2)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C/2 }`);

		expect(xml).toContain('<type>half</type>');
		expect(xml).toContain('<duration>8</duration>'); // 2 beats * 4 divisions
	});

	it('transpiles quarter note (/4 - default)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C }`);

		expect(xml).toContain('<type>quarter</type>');
		expect(xml).toContain('<duration>4</duration>'); // 1 beat * 4 divisions
	});

	it('transpiles eighth note (/8)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C/8 }`);

		expect(xml).toContain('<type>eighth</type>');
		expect(xml).toContain('<duration>2</duration>'); // 0.5 beats * 4 divisions
	});

	it('transpiles sixteenth note (/16)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C/16 }`);

		expect(xml).toContain('<type>16th</type>');
		expect(xml).toContain('<duration>1</duration>'); // 0.25 beats * 4 divisions
	});

	it('transpiles dotted quarter (/4.)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C/4. }`);

		expect(xml).toContain('<type>quarter</type>');
		expect(xml).toContain('<dot/>');
		expect(xml).toContain('<duration>6</duration>'); // 1.5 beats * 4 divisions
	});
});

describe('Spec §2.4: Fingerings', () => {
	it('transpiles fingering annotation', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C@1 }`);

		expect(xml).toContain('<fingering>1</fingering>');
	});

	it('transpiles all valid fingerings (1-5)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C@1 D@2 E@3 F@4 G@5 }`);

		expect(xml).toContain('<fingering>1</fingering>');
		expect(xml).toContain('<fingering>2</fingering>');
		expect(xml).toContain('<fingering>3</fingering>');
		expect(xml).toContain('<fingering>4</fingering>');
		expect(xml).toContain('<fingering>5</fingering>');
	});
});

// ============================================================
// SPEC SECTION 4: Special Elements
// ============================================================

describe('Spec §4.1: Rests', () => {
	it('transpiles rest (_)', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { _ }`);

		expect(xml).toContain('<rest/>');
		expect(xml).toContain('<type>quarter</type>');
	});

	it('transpiles rest with explicit duration', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { _/2 }`);

		expect(xml).toContain('<rest/>');
		expect(xml).toContain('<type>half</type>');
	});
});

describe('Spec §4.2: Chords', () => {
	it('transpiles chord with multiple notes', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { [C E G] }`);

		// First note has no <chord/>, subsequent notes do
		expect(xml).toContain('<step>C</step>');
		expect(xml).toContain('<step>E</step>');
		expect(xml).toContain('<step>G</step>');
		expect(xml).toContain('<chord/>');
	});

	it('transpiles chord with duration', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { [C E G]/2 }`);

		// All notes in chord should have half duration
		const matches = xml.match(/<type>half<\/type>/g);
		expect(matches?.length).toBe(3);
	});
});

// ============================================================
// SPEC SECTION 5: Modifier Functions (Dynamics & Articulations)
// ============================================================

describe('Spec §5: Dynamics', () => {
	it('transpiles piano dynamic p()', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { p(C) }`);

		expect(xml).toContain('<dynamics>');
		expect(xml).toContain('<p/>');
	});
});

describe('Spec §5: Articulations', () => {
	it('transpiles staccato st()', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { st(C) }`);

		expect(xml).toContain('<articulations>');
		expect(xml).toContain('<staccato/>');
	});

	it('transpiles accent ac()', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { ac(C) }`);

		expect(xml).toContain('<articulations>');
		expect(xml).toContain('<accent/>');
	});

	it('transpiles tenuto tn()', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { tn(C) }`);

		expect(xml).toContain('<articulations>');
		expect(xml).toContain('<tenuto/>');
	});
});

// ============================================================
// Automatic Measure Splitting (Implicit from Spec)
// ============================================================

describe('Automatic Measure Splitting', () => {
	it('splits 8 quarter notes into 2 measures in 4/4', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
time: 4/4
---
&main { C D E F G A B C }`);

		expect(xml).toContain('<measure number="1">');
		expect(xml).toContain('<measure number="2">');
	});

	it('splits 6 quarter notes into 2 measures in 3/4', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
time: 3/4
---
&main { C D E F G A }`);

		expect(xml).toContain('<measure number="1">');
		expect(xml).toContain('<measure number="2">');
	});
});

// ============================================================
// Multi-Stave (Grand Staff) Support
// ============================================================

describe('Multi-Stave Support', () => {
	it('creates separate parts for treble and bass', () => {
		const xml = toMusicXML(`---
&right:
  clef: treble
&left:
  clef: bass
time: 4/4
---
&right { C D E F }
&left { C D E F }`);

		// Two parts
		expect(xml).toContain('<part id="P1">');
		expect(xml).toContain('<part id="P2">');

		// Both have measures
		const measureMatches = xml.match(/<measure number="1">/g);
		expect(measureMatches?.length).toBe(2);
	});

	it('ensures distinct content in multiple staves', () => {
		const xml = toMusicXML(`---
&right:
  clef: treble
&left:
  clef: bass
---
&right { C4 }
&left { C2 }`);

		// Split by part
		const parts = xml.split('<part id="');
		expect(parts.length).toBe(3); // [before, P1", P2"]

		expect(parts[1]).toContain('<octave>4</octave>');
		expect(parts[2]).toContain('<octave>2</octave>');
	});

	it('handles mixed declared and undeclared staves without dropping undeclared ones', () => {
		const xml = toMusicXML(`---
&right:
  clef: treble
---
&right { C }
&left { G }`);

		expect(xml).toContain('<part-name>right</part-name>');
		expect(xml).toContain('<part-name>left</part-name>');
	});

	it('generates a valid two-staff score for the user report', () => {
		const xml = toMusicXML(`---
title: Untitled
key: C major
time: 4/4
tempo: 120
&right:
  clef: treble
&left:
  clef: bass
---
&right { C D E F G A B C+ }
&left { C D E F G A B C+ }`);

		expect(xml).toContain('<work-title>Untitled</work-title>');
		expect(xml).toContain('<part-group type="start" number="1">');
		expect(xml).toContain('<group-symbol>bracket</group-symbol>');
		expect(xml).toContain('<part id="P1">');
		expect(xml).toContain('<part id="P2">');

		// 2 measures per part
		const measure1Count = (xml.match(/<measure number="1">/g) || []).length;
		const measure2Count = (xml.match(/<measure number="2">/g) || []).length;
		expect(measure1Count).toBe(2);
		expect(measure2Count).toBe(2);

		// Clefs
		const p1 = xml.split('<part id="P1">')[1].split('</part>')[0];
		const p2 = xml.split('<part id="P2">')[1].split('</part>')[0];
		expect(p1).toContain('<sign>G</sign>');
		expect(p2).toContain('<sign>F</sign>');
	});
});

// =============================================================================
// SLURS (§3)
// =============================================================================

describe('Spec §3: Slurs', () => {
	it('transpiles slur annotations to MusicXML slur elements', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C D E F } { slur(1-4) }`);

		expect(xml).toContain('<slur type="start" number="1"/>');
		expect(xml).toContain('<slur type="stop" number="1"/>');
	});

	it('places slur start on first note and stop on last note', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C D E } { slur(1-3) }`);

		// Extract note elements
		const notes = xml.match(/<note>[\s\S]*?<\/note>/g) || [];
		expect(notes.length).toBe(3);

		// First note should have slur start
		expect(notes[0]).toContain('<slur type="start"');
		// Last note should have slur stop
		expect(notes[2]).toContain('<slur type="stop"');
		// Middle notes should not have slur elements
		expect(notes[1]).not.toContain('<slur');
	});
});

// =============================================================================
// CRESCENDO/DECRESCENDO WEDGES (§5)
// =============================================================================

describe('Spec §5: Crescendo/Decrescendo Wedges', () => {
	it('transpiles crescendo to MusicXML wedge direction', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C D E F } { cresc(1-4) }`);

		expect(xml).toContain('<wedge type="crescendo"/>');
		expect(xml).toContain('<wedge type="stop"/>');
	});

	it('transpiles decrescendo to MusicXML wedge direction', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C D E F } { decresc(1-4) }`);

		expect(xml).toContain('<wedge type="diminuendo"/>');
		expect(xml).toContain('<wedge type="stop"/>');
	});

	it('places wedges in direction elements', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C D E F } { cresc(1-4) }`);

		// Wedges should be inside direction elements
		expect(xml).toMatch(/<direction[\s\S]*?<wedge type="crescendo"\/>/);
		expect(xml).toMatch(/<direction[\s\S]*?<wedge type="stop"\/>/);
	});
});

// =============================================================================
// ALL DYNAMICS IN XML (§5)
// =============================================================================

describe('Spec §5: All Dynamics in MusicXML', () => {
	const dynamics = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];

	dynamics.forEach(dyn => {
		it(`transpiles ${dyn} dynamic to MusicXML`, () => {
			const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { ${dyn}(C) }`);

			expect(xml).toContain(`<${dyn}/>`);
			expect(xml).toContain('<dynamics>');
		});
	});
});

// =============================================================================
// ALL ARTICULATIONS IN XML (§5)
// =============================================================================

describe('Spec §5: All Articulations in MusicXML', () => {
	const articulations: Record<string, string> = {
		'st': 'staccato',
		'tn': 'tenuto',
		'ac': 'accent',
		'mc': 'strong-accent', // marcato
		'fm': 'fermata',
	};

	Object.entries(articulations).forEach(([fn, xmlElement]) => {
		it(`transpiles ${fn}() to <${xmlElement}/>`, () => {
			const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { ${fn}(C) }`);

			expect(xml).toContain(`<${xmlElement}/>`);
		});
	});

	it('transpiles trill tr() to ornaments', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { tr(C) }`);

		// Trill should be in ornaments, not articulations
		expect(xml).toContain('<trill-mark/>');
	});
});

// =============================================================================
// TIES IN XML (§3)
// =============================================================================

describe('Spec §3: Ties in MusicXML', () => {
	it('transpiles tie annotation to MusicXML tied element', () => {
		const xml = toMusicXML(`---
&main:
  clef: treble
---
&main { C D } { tie(1-2) }`);

		expect(xml).toContain('<tie type="start"/>');
		expect(xml).toContain('<tied type="start"/>');
	});
});

