// Score Language AST Types
// Abstract Syntax Tree nodes for parsed score notation

import type { Accidental, Articulation, Dynamic, NoteName, Octave } from './score-types';

// Source location for error reporting
export interface SourceLocation {
	line: number;
	column: number;
	start: number;
	end: number;
}

// Base AST node with location
export interface ASTNode {
	kind: string;
	loc: SourceLocation;
}

// ============ Pitch & Duration ============

export interface PitchNode extends ASTNode {
	kind: 'Pitch';
	note: NoteName;
	accidental: Accidental;
	octave: Octave;
}

export interface DurationNode extends ASTNode {
	kind: 'Duration';
	base: 'w' | 'h' | 'q' | '8' | '16' | '32';
	dots: number;
}

// ============ Annotations ============

export interface AnnotationNode extends ASTNode {
	kind: 'Annotation';
	dynamic?: Dynamic;
	articulations?: Articulation[];
	fingering?: number;
	text?: string;
	crescendo?: 'start' | 'end';
	decrescendo?: 'start' | 'end';
	slurStart?: boolean;
	slurEnd?: boolean;
	pedalStart?: boolean;
	pedalEnd?: boolean;
}

// ============ Music Elements ============

export interface NoteNode extends ASTNode {
	kind: 'Note';
	pitch: PitchNode;
	duration: DurationNode;
	tied: boolean;
	beamed?: boolean;
	grace?: boolean;
	annotation?: AnnotationNode;
}

export interface RestNode extends ASTNode {
	kind: 'Rest';
	duration: DurationNode;
}

export interface ChordNode extends ASTNode {
	kind: 'Chord';
	pitches: PitchNode[];
	duration: DurationNode;
	tied?: boolean;
	annotation?: AnnotationNode;
}

export type MusicElementNode = NoteNode | RestNode | ChordNode;

// ============ Structure ============

export interface MeasureNode extends ASTNode {
	kind: 'Measure';
	elements: MusicElementNode[];
	barline: 'single' | 'double' | 'repeat-start' | 'repeat-end' | 'final';
	attributes?: {
		key?: string;
		time?: TimeSignatureNode;
		clef?: string;
	};
}

export interface StaffNode extends ASTNode {
	kind: 'Staff';
	name: string;
	clef: 'treble' | 'bass' | 'alto' | 'tenor' | 'treble-8' | 'bass-8';
	measures: MeasureNode[];
}

// ============ Metadata ============

export interface TimeSignatureNode extends ASTNode {
	kind: 'TimeSignature';
	beats: number;
	beatType: number;
}

export interface MetadataNode extends ASTNode {
	kind: 'Metadata';
	title?: string;
	composer?: string;
	key?: string;
	time?: TimeSignatureNode;
	tempo?: number;
	defaultOctave?: Octave;
	staves?: Array<{ name: string; clef: string }>;
	[key: string]: any; // Allow arbitrary YAML fields
}

// ============ Root ============

export interface ScoreNode extends ASTNode {
	kind: 'Score';
	metadata: MetadataNode;
	staves: StaffNode[];
}

// Union of all AST node types
export type ScoreASTNode =
	| ScoreNode
	| MetadataNode
	| TimeSignatureNode
	| StaffNode
	| MeasureNode
	| NoteNode
	| RestNode
	| ChordNode
	| PitchNode
	| DurationNode
	| AnnotationNode;

// ============ Helpers ============

export function createLocation(line: number, column: number, start: number, end: number): SourceLocation {
	return { line, column, start, end };
}

export function mergeLocations(start: SourceLocation, end: SourceLocation): SourceLocation {
	return {
		line: start.line,
		column: start.column,
		start: start.start,
		end: end.end,
	};
}
