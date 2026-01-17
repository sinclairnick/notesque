// Score Notation Language Types
// A human-readable sheet music notation format

export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = '' | '#' | 'b' | '##' | 'bb';
export type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Duration tokens
export type DurationToken = 'w' | 'h' | 'q' | '8' | '16' | '32';

export interface Duration {
	base: DurationToken;
	dots: number; // 0, 1, or 2 for dotted
}

// Dynamics
export type Dynamic = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'fp' | 'sfz';

// Articulations  
export type Articulation =
	| 'staccato'    // {.}
	| 'tenuto'      // {-}
	| 'accent'      // {>}
	| 'marcato'     // {^}
	| 'fermata'     // {u}
	| 'trill'       // {tr}
	| 'turn'        // {~}
	| 'mordent';    // {m}

export interface Annotation {
	dynamic?: Dynamic;
	articulations?: Articulation[];
	fingering?: number;
	text?: string;
	crescendo?: 'start' | 'end';
	decrescendo?: 'start' | 'end';
}

export interface Pitch {
	note: NoteName;
	accidental: Accidental;
	octave: Octave;
}

export interface ScoreNote {
	type: 'note';
	pitch: Pitch;
	duration: Duration;
	tied?: boolean;
	annotation?: Annotation;
}

export interface ScoreRest {
	type: 'rest';
	duration: Duration;
}

export interface ScoreChord {
	type: 'chord';
	pitches: Pitch[];
	duration: Duration;
	annotation?: Annotation;
}

export type ScoreElement = ScoreNote | ScoreRest | ScoreChord;

export interface ScoreMeasure {
	elements: ScoreElement[];
	barline?: 'single' | 'double' | 'repeat-start' | 'repeat-end' | 'final';
}

export type ClefType = 'treble' | 'bass' | 'alto' | 'tenor' | 'treble-8' | 'bass-8';

export interface ScoreStaff {
	name: string;
	clef: ClefType;
	measures: ScoreMeasure[];
}

export interface ScoreMetadata {
	title: string;
	composer?: string;
	key: string;
	time: { beats: number; beatType: number };
	tempo?: number;
	defaultOctave?: Octave;
}

export interface ParsedScore {
	metadata: ScoreMetadata;
	staves: ScoreStaff[];
	raw: string; // Original source text
}

// Default score template
export const DEFAULT_SCORE_TEMPLATE = `---
title: Untitled
key: C major
time: 4/4
tempo: 120
&right:
  clef: treble
---
&right { C D E F G A B C+ }
`;

// Error types for parser
export interface ParseError {
	line: number;
	column: number;
	message: string;
}

export interface ParseResult {
	score: ParsedScore | null;
	errors: ParseError[];
	warnings: ParseError[];
}
