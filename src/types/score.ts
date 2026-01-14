// Core types for Notesque sheet music application

export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = '' | '#' | 'b' | '##' | 'bb';
export type Octave = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Pitch {
	note: NoteName;
	accidental: Accidental;
	octave: Octave;
}

export type Duration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond';
export type DurationValue = 1 | 2 | 4 | 8 | 16 | 32;

export interface Note {
	type: 'note';
	pitch: Pitch;
	duration: Duration;
	dotted?: boolean;
	tied?: boolean;
}

export interface Rest {
	type: 'rest';
	duration: Duration;
	dotted?: boolean;
}

export interface Chord {
	type: 'chord';
	pitches: Pitch[];
	duration: Duration;
	dotted?: boolean;
}

export type MusicElement = Note | Rest | Chord;

export interface Measure {
	elements: MusicElement[];
	barline?: 'single' | 'double' | 'repeat-start' | 'repeat-end' | 'final';
}

export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';
export type KeySignature =
	| 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#' | 'C#'  // Major sharp keys
	| 'F' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb' | 'Cb'    // Major flat keys
	| 'Am' | 'Em' | 'Bm' | 'F#m' | 'C#m' | 'G#m' | 'D#m' | 'A#m'  // Minor sharp keys
	| 'Dm' | 'Gm' | 'Cm' | 'Fm' | 'Bbm' | 'Ebm' | 'Abm';          // Minor flat keys

export interface TimeSignature {
	beats: number;
	beatType: 4 | 8 | 2 | 16;
}

export interface Staff {
	clef: Clef;
	measures: Measure[];
}

export interface Score {
	title: string;
	composer?: string;
	key: KeySignature;
	time: TimeSignature;
	tempo?: number;
	staves: Staff[];
	abc: string; // Raw ABC notation - source of truth
}

// Selection state for editor
export interface Selection {
	staffIndex: number;
	measureIndex: number;
	elementIndex: number;
	type: 'note' | 'rest' | 'chord' | 'measure';
}

// File metadata
export interface ScoreFile {
	filename: string;
	path?: string;
	lastModified: Date;
	score: Score;
}

// Editor state
export interface EditorState {
	currentTool: 'select' | 'note' | 'rest' | 'eraser';
	selectedDuration: Duration;
	selectedAccidental: Accidental;
	isPlaying: boolean;
	playbackPosition: number;
	tempo: number;
	selection: Selection | null;
}

// Default values
export const DEFAULT_SCORE: Score = {
	title: 'Untitled',
	key: 'C',
	time: { beats: 4, beatType: 4 },
	tempo: 120,
	staves: [{ clef: 'treble', measures: [{ elements: [], barline: 'single' }] }],
	abc: `X:1
T:Untitled
M:4/4
L:1/4
K:C
| z4 |`,
};
