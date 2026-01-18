// Comprehensive Scorelang Spec Examples
// Test fixtures for all features defined in SCORELANG_SPEC.md

// ============================================================
// SECTION 1: FILE STRUCTURE
// ============================================================

export const STAVE_DECLARATIONS = {
	// §1.1 Basic stave declarations
	basic: `---
&right:
  clef: treble
&left:
  clef: bass
---
&right { C D E F }
&left { C D E F }`,

	// §1.2 Multi-voice staves
	multiVoice: `---
&right+soprano:
  clef: treble
&right+alto:
  clef: treble
---
&right+soprano { C D E F }
&right+alto { G A B C }`,
};

export const CONTEXT_BLOCKS = {
	// §1.3 All context properties
	full: `---
tempo: 120
key: Dm
time: 3/4
octave: 4
---
&main { C D E }`,

	section: `---
&main:
  clef: treble
section: "Intro"
---
&main { C D E F }`,
};

// ============================================================
// SECTION 2: CORE NOTE SYNTAX
// ============================================================

export const NOTES = {
	// §2.1 Pitch & Accidentals
	allLetters: `---
&main:
  clef: treble
---
&main { A B C D E F G }`,

	sharps: `---
&main:
  clef: treble
---
&main { C# D# F# G# }`,

	doubleSharp: `---
&main:
  clef: treble
---
&main { C## F## }`,

	flats: `---
&main:
  clef: treble
---
&main { Bb Eb Ab Db }`,

	doubleFlat: `---
&main:
  clef: treble
---
&main { Bbb Ebb }`,

	// §2.2 Octaves
	absoluteOctave: `---
&main:
  clef: treble
---
&main { C4 A5 G3 B0 D8 }`,

	relativeOctaveUp: `---
&main:
  clef: treble
octave: 4
---
&main { C C+ C++ }`,

	relativeOctaveDown: `---
&main:
  clef: treble
octave: 4
---
&main { C C- C-- }`,

	// §2.3 Durations
	allDurations: `---
&main:
  clef: treble
---
&main { C/1 D/2 E/4 F/8 G/16 A/32 }`,

	dottedNotes: `---
&main:
  clef: treble
---
&main { C/4. D/2. E. }`,

	doubleDotted: `---
&main:
  clef: treble
---
&main { C/2.. }`,

	// §2.4 Fingerings
	fingerings: `---
&main:
  clef: treble
---
&main { C@1 E@3 G@5 }`,

	allFingerings: `---
&main:
  clef: treble
---
&main { C@1 D@2 E@3 F@4 G@5 }`,
};

export const NOTE_COMBINATIONS = {
	// Complex combinations
	fullNote: `---
&main:
  clef: treble
---
&main { C#4/8@1 }`,

	octaveModWithDuration: `---
&main:
  clef: treble
octave: 4
---
&main { C+/8 D--/4 }`,
};

// ============================================================
// SECTION 3: CONNECTIVE NOTATION
// ============================================================

export const CONNECTIVES = {
	// §3 Slurs
	slur: `---
&main:
  clef: treble
---
&main { C~D~E~F G }`,

	slurLong: `---
&main:
  clef: treble
---
&main { A~B~C~D~E~F~G }`,

	// §3 Ties
	tie: `---
&main:
  clef: treble
---
&main { A^A B C }`,

	// §3 Pedal
	pedal: `---
&main:
  clef: treble
---
&main { C_E_G C }`,

	// Mixed
	mixed: `---
&main:
  clef: treble
---
&main { C~D~E~F G A^A B }`,
};

// ============================================================
// SECTION 4: SPECIAL ELEMENTS
// ============================================================

export const SPECIAL_ELEMENTS = {
	// §4.1 Rests
	simpleRest: `---
&main:
  clef: treble
---
&main { C _ D }`,

	restWithDuration: `---
&main:
  clef: treble
---
&main { C _/2 D }`,

	// §4.2 Chords
	basicChord: `---
&main:
  clef: treble
---
&main { [C E G] }`,

	chordWithDuration: `---
&main:
  clef: treble
---
&main { [C E G]/2 }`,

	chordWithAccidentals: `---
&main:
  clef: treble
---
&main { [C# Eb G] }`,

	// §4.3 Grace Notes
	acciaccatura: `---
&main:
  clef: treble
---
&main { \`G C }`,

	appoggiatura: `---
&main:
  clef: treble
---
&main { \`\`D E }`,

	// §4.4 Beaming
	beamGroup: `---
&main:
  clef: treble
---
&main { =(C D E F) G }`,
};

// ============================================================
// SECTION 5: MODIFIER FUNCTIONS
// ============================================================

export const DYNAMICS = {
	piano: `---
&main:
  clef: treble
---
&main { p(C D E) F G }`,

	allDynamics: `---
&main:
  clef: treble
---
&main { ppp(C) pp(D) p(E) mp(F) mf(G) f(A) ff(B) fff(C+) }`,

	crescendo: `---
&main:
  clef: treble
---
&main { cresc(C D E F) G }`,

	decrescendo: `---
&main:
  clef: treble
---
&main { decresc(C D E F) G }`,
};

export const ARTICULATIONS = {
	staccato: `---
&main:
  clef: treble
---
&main { st(C D) E }`,

	tenuto: `---
&main:
  clef: treble
---
&main { tn(C) D }`,

	accent: `---
&main:
  clef: treble
---
&main { ac(C D) E }`,

	marcato: `---
&main:
  clef: treble
---
&main { mc(C) D }`,

	fermata: `---
&main:
  clef: treble
---
&main { fm(C) D }`,

	trill: `---
&main:
  clef: treble
---
&main { tr(C D) E }`,

	allArticulations: `---
&main:
  clef: treble
---
&main { st(C) tn(D) ac(E) mc(F) fm(G) tr(A) }`,
};

export const ANNOTATION_BLOCKS = {
	// Annotation syntax (function-only)
	dynamicByRange: `---
&main:
  clef: treble
---
&main { C D E F G } { p(1-3) f(4-5) }`,

	textAnnotation: `---
&main:
  clef: treble
---
&main { C D E F G } { text(1, "rit.") }`,

	fingeringByAnnotation: `---
&main:
  clef: treble
---
&main { C D E } { finger(2-2, 3) }`,

	articulationByRange: `---
&main:
  clef: treble
---
&main { C D E F } { st(1-3) }`,

	crescendoByRange: `---
&main:
  clef: treble
---
&main { C D E F G } { cresc(1-4) }`,

	complex: `---
&main:
  clef: treble
---
&main { C D E F G } { cresc(1-4) text(5, "più mosso") }`,
};

// ============================================================
// SECTION 6: LYRICS (Not implemented)
// ============================================================

export const LYRICS = {
	basic: `---
&melody:
  clef: treble
&melody+lyrics:
  type: lyrics
---
&melody { C D E F G }
&melody+lyrics { "Hel-" "lo" "my" "dear" "friend" }`,
};

// ============================================================
// SECTION 7: REPEATS & NAVIGATION (Not implemented)
// ============================================================

export const REPEATS = {
	basic: `---
repeat: start
---
&right { C D E F }
---
repeat: end
volta: 1
---
&right { G A }`,
};

// ============================================================
// SECTION 8: COMMENTS
// ============================================================

export const COMMENTS = {
	singleLine: `---
&main:
  clef: treble
---
// This is a comment
&main { C D E F }`,

	multiLine: `---
&main:
  clef: treble
---
/* multi-line
   comment */
&main { C D E F }`,
};

// ============================================================
// SECTION 9: COMPLETE EXAMPLE
// ============================================================

export const COMPLETE_EXAMPLE = `---
&right:
  clef: treble
&left:
  clef: bass
---

---
tempo: 100
key: C
time: 4/4
section: "Intro"
---

&right { C~D~E~F/8 G A B C+ } {
  cresc(1-4)
  text(5, "più mosso")
}

&left {
  C-/1
}

---
section: "Verse"
---

&right { =(C D E F) G^G A B }
&left { C-_E-_G- C-/1 }`;

// ============================================================
// GROUPED EXPORTS
// ============================================================

export const SPEC_EXAMPLES = {
	// Section 1
	...STAVE_DECLARATIONS,
	...CONTEXT_BLOCKS,
	// Section 2
	...NOTES,
	...NOTE_COMBINATIONS,
	// Section 3
	...CONNECTIVES,
	// Section 4
	...SPECIAL_ELEMENTS,
	// Section 5
	...DYNAMICS,
	...ARTICULATIONS,
	...ANNOTATION_BLOCKS,
	// Section 6 (not implemented)
	// ...LYRICS,
	// Section 7 (not implemented)
	// ...REPEATS,
	// Section 8
	...COMMENTS,
	// Section 9
	completeExample: COMPLETE_EXAMPLE,
};

// Simple examples for core functionality testing
export const CORE_EXAMPLES = {
	basicNotes: NOTES.allLetters,
	accidentals: NOTES.sharps,
	octaves: NOTES.absoluteOctave,
	durations: NOTES.allDurations,
	chords: SPECIAL_ELEMENTS.basicChord,
	rests: SPECIAL_ELEMENTS.simpleRest,
	dynamics: DYNAMICS.piano,
	articulations: ARTICULATIONS.staccato,
	twoStaves: STAVE_DECLARATIONS.basic,
	completeExample: COMPLETE_EXAMPLE,
};
