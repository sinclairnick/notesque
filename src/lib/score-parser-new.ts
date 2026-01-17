// Scorelang v2.0 Parser
// Consumes tokens from lexer and produces AST

import { tokenize, type Token, type TokenType } from './score-lexer';
import {
	type ScoreNode,
	type MetadataNode,
	type StaffNode,
	type MeasureNode,
	type NoteNode,
	type RestNode,
	type ChordNode,
	type PitchNode,
	type DurationNode,
	type AnnotationNode,
	type MusicElementNode,
	type SourceLocation,
	createLocation,
} from './score-ast';
import type { Accidental, Articulation, Dynamic, NoteName, Octave } from './score-types';

// Default duration
const DEFAULT_DURATION: DurationNode = {
	kind: 'Duration',
	base: 'q',
	dots: 0,
	loc: createLocation(0, 0, 0, 0),
};

// Parser error
export interface ParseError {
	message: string;
	line: number;
	column: number;
}

export interface ParseResult {
	ast: ScoreNode | null;
	errors: ParseError[];
	warnings: ParseError[];
}

// Dynamics set
const DYNAMICS: Set<string> = new Set(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sfz']);

// Articulation function map
const ARTICULATION_FN_MAP: Record<string, Articulation> = {
	'st': 'staccato',
	'tn': 'tenuto',
	'ac': 'accent',
	'mc': 'marcato',
	'fm': 'fermata',
	'tr': 'trill',
};

export class ScoreParser {
	private tokens: Token[] = [];
	private pos: number = 0;
	private errors: ParseError[] = [];
	private warnings: ParseError[] = [];
	private defaultOctave: Octave = 4;
	private declaredStaves: Map<string, { clef: string; voice?: string }> = new Map();

	parse(source: string): ParseResult {
		const lexResult = tokenize(source);

		this.tokens = lexResult.tokens;
		this.pos = 0;
		this.errors = [];
		this.warnings = [];
		this.declaredStaves = new Map();

		// Add lexer errors
		for (const err of lexResult.errors) {
			this.errors.push(err);
		}

		try {
			const ast = this.parseScore();
			return { ast, errors: this.errors, warnings: this.warnings };
		} catch (e) {
			this.errors.push({
				message: e instanceof Error ? e.message : 'Unknown parse error',
				line: this.current()?.line ?? 1,
				column: this.current()?.column ?? 1,
			});
			return { ast: null, errors: this.errors, warnings: this.warnings };
		}
	}

	private parseScore(): ScoreNode {
		const startToken = this.current();
		const startLoc = startToken
			? createLocation(startToken.line, startToken.column, startToken.start, startToken.end)
			: createLocation(1, 1, 0, 0);

		// Parse initial context blocks (frontmatter + stave declarations)
		const metadata = this.parseContextBlocks();
		this.defaultOctave = metadata.defaultOctave ?? 4;

		// Parse stave bodies
		const staves = this.parseStaveBodies();

		return {
			kind: 'Score',
			metadata,
			staves,
			loc: createLocation(startLoc.line, startLoc.column, startLoc.start, this.previous()?.end ?? 0),
		};
	}

	private parseContextBlocks(): MetadataNode {
		const startToken = this.current();
		const startLoc = startToken
			? createLocation(startToken.line, startToken.column, startToken.start, startToken.end)
			: createLocation(1, 1, 0, 0);

		const metadata: MetadataNode = {
			kind: 'Metadata',
			loc: startLoc,
		};

		this.skipWhitespaceAndNewlines();

		// Parse all context blocks until we hit stave bodies or EOF
		while (!this.isAtEnd()) {
			this.skipWhitespaceAndNewlines();

			if (this.check('CONTEXT_DELIM')) {
				this.advance(); // ---
				this.parseContextContent(metadata);

				// Expect closing ---
				this.skipWhitespaceAndNewlines();
				if (this.check('CONTEXT_DELIM')) {
					this.advance();
				}
				continue;
			}

			// If we see a stave declaration followed by {, stop parsing context
			if (this.check('STAVE_DECL')) {
				const lookahead = this.tokens[this.pos + 1];
				if (lookahead && (lookahead.type === 'STAVE_BODY_START' ||
					(lookahead.type === 'WHITESPACE' && this.tokens[this.pos + 2]?.type === 'STAVE_BODY_START'))) {
					break;
				}
			}

			// Skip unknown tokens
			if (!this.check('EOF')) {
				this.advance();
			} else {
				break;
			}
		}

		// Build staves array from declared staves
		if (this.declaredStaves.size > 0) {
			metadata.staves = Array.from(this.declaredStaves.entries()).map(([name, data]) => ({
				name,
				clef: data.clef,
			}));
		}

		return metadata;
	}

	private parseContextContent(metadata: MetadataNode): void {
		let currentStave: string | null = null;

		while (!this.isAtEnd() && !this.check('CONTEXT_DELIM')) {
			this.skipWhitespace();

			if (this.check('NEWLINE')) {
				this.advance();
				continue;
			}

			if (this.check('COMMENT')) {
				this.advance();
				continue;
			}

			// Stave declaration in context
			if (this.check('STAVE_DECL')) {
				const token = this.advance();
				const staveValue = token.value; // e.g., &right or &right+alto
				const match = staveValue.match(/^&(\w+)(\+\w+)?/);
				if (match) {
					const baseName = match[1];
					const voice = match[2]?.slice(1); // Remove + prefix
					currentStave = voice ? `${baseName}+${voice}` : baseName;
					this.declaredStaves.set(currentStave, { clef: 'treble', voice });
				}
				continue;
			}

			// Key-value pair
			if (this.check('CONTEXT_KEY')) {
				const keyToken = this.advance();
				const key = keyToken.value;

				this.skipWhitespace();
				let value = '';
				if (this.check('CONTEXT_VALUE')) {
					value = this.advance().value;
				}

				// Apply to current stave or global metadata
				if (currentStave && key === 'clef') {
					const staveData = this.declaredStaves.get(currentStave);
					if (staveData) {
						staveData.clef = value;
					}
				} else if (currentStave && key === 'type') {
					// Lyrics stave type etc.
					const staveData = this.declaredStaves.get(currentStave);
					if (staveData) {
						(staveData as any).type = value;
					}
				} else {
					currentStave = null; // Reset after non-stave key
					this.applyMetadataValue(metadata, key, value);
				}
				continue;
			}

			// Skip unknown in context
			this.advance();
		}
	}

	private applyMetadataValue(metadata: MetadataNode, key: string, value: string): void {
		switch (key) {
			case 'title':
				metadata.title = value;
				break;
			case 'composer':
				metadata.composer = value;
				break;
			case 'key':
				metadata.key = value;
				break;
			case 'time':
				const timeMatch = value.match(/(\d+)\/(\d+)/);
				if (timeMatch) {
					metadata.time = {
						kind: 'TimeSignature',
						beats: parseInt(timeMatch[1]),
						beatType: parseInt(timeMatch[2]),
						loc: createLocation(0, 0, 0, 0),
					};
				}
				break;
			case 'tempo':
				metadata.tempo = parseInt(value);
				break;
			case 'octave':
				metadata.defaultOctave = parseInt(value) as Octave;
				break;
		}
	}

	private parseStaveBodies(): StaffNode[] {
		const staves: StaffNode[] = [];
		const staffMeasures = new Map<string, MeasureNode[]>();

		// Initialize from declared staves
		for (const [name] of this.declaredStaves) {
			staffMeasures.set(name, []);
		}

		this.skipWhitespaceAndNewlines();

		while (!this.isAtEnd()) {
			this.skipWhitespaceAndNewlines();

			if (this.check('COMMENT')) {
				this.advance();
				continue;
			}

			if (this.check('EOF')) {
				break;
			}

			// Context block mid-score
			if (this.check('CONTEXT_DELIM')) {
				this.advance();
				const tempMetadata: MetadataNode = { kind: 'Metadata', loc: createLocation(0, 0, 0, 0) };
				this.parseContextContent(tempMetadata);
				this.skipWhitespaceAndNewlines();
				if (this.check('CONTEXT_DELIM')) {
					this.advance();
				}
				// TODO: Apply context changes to subsequent notes
				continue;
			}

			// Stave body: &name { ... }
			if (this.check('STAVE_DECL')) {
				const staveToken = this.advance();
				const staveName = staveToken.value.slice(1); // Remove &

				this.skipWhitespace();

				if (this.check('STAVE_BODY_START')) {
					this.advance();
					const elements = this.parseStaveBodyContent();

					// Expect closing }
					if (this.check('STAVE_BODY_END')) {
						this.advance();
					}

					// Parse optional annotation block
					this.skipWhitespace();
					if (this.check('ANNOTATION_BLOCK_START') || this.check('STAVE_BODY_START')) {
						this.advance();
						this.parseAnnotationBlock(elements);
						if (this.check('ANNOTATION_BLOCK_END') || this.check('STAVE_BODY_END')) {
							this.advance();
						}
					}

					// Add elements as a measure
					if (elements.length > 0) {
						if (!staffMeasures.has(staveName)) {
							staffMeasures.set(staveName, []);
						}
						staffMeasures.get(staveName)!.push({
							kind: 'Measure',
							elements,
							barline: 'single',
							loc: createLocation(staveToken.line, staveToken.column, staveToken.start, this.previous()?.end ?? 0),
						});
					}
				}
				continue;
			}

			// Skip orphan tokens
			this.advance();
		}

		// Build staff nodes
		if (this.declaredStaves.size > 0) {
			for (const [name, data] of this.declaredStaves) {
				staves.push({
					kind: 'Staff',
					name,
					clef: data.clef as StaffNode['clef'],
					measures: staffMeasures.get(name) || [],
					loc: createLocation(0, 0, 0, 0),
				});
			}
		} else if (staffMeasures.size > 0) {
			// Staves used without declaration
			for (const [name, measures] of staffMeasures) {
				staves.push({
					kind: 'Staff',
					name,
					clef: 'treble',
					measures,
					loc: createLocation(0, 0, 0, 0),
				});
			}
		} else {
			// Default single staff
			staves.push({
				kind: 'Staff',
				name: 'main',
				clef: 'treble',
				measures: [],
				loc: createLocation(0, 0, 0, 0),
			});
		}

		return staves;
	}

	private parseStaveBodyContent(): MusicElementNode[] {
		const elements: MusicElementNode[] = [];

		while (!this.isAtEnd() && !this.check('STAVE_BODY_END')) {
			this.skipWhitespace();

			if (this.check('NEWLINE')) {
				this.advance();
				continue;
			}

			if (this.check('COMMENT')) {
				this.advance();
				continue;
			}

			// Parse music element
			const element = this.parseMusicElement();
			if (element) {
				elements.push(element);
			} else if (!this.check('STAVE_BODY_END') && !this.check('EOF')) {
				this.advance(); // Skip unknown
			}
		}

		return elements;
	}

	private parseMusicElement(): MusicElementNode | null {
		this.skipWhitespace();

		// Skip connectives (handled by parser at higher level)
		if (this.check('SLUR') || this.check('TIE') || this.check('PEDAL')) {
			this.advance();
			return null;
		}

		// Grace note
		if (this.check('GRACE')) {
			this.advance();
			// Next should be a note
			this.skipWhitespace();
			if (this.check('NOTE')) {
				const note = this.parseNote();
				// Mark as grace (TODO: add grace property to NoteNode)
				return note;
			}
			return null;
		}

		// Rest
		if (this.check('REST')) {
			return this.parseRest();
		}

		// Chord
		if (this.check('CHORD_START')) {
			return this.parseChord();
		}

		// Beam group
		if (this.check('BEAM_START')) {
			this.advance();
			const notes: NoteNode[] = [];
			while (!this.isAtEnd() && !this.check('PAREN_CLOSE')) {
				this.skipWhitespace();
				if (this.check('NOTE')) {
					notes.push(this.parseNote());
				} else if (!this.check('PAREN_CLOSE')) {
					this.advance();
				}
			}
			if (this.check('PAREN_CLOSE')) {
				this.advance();
			}
			// Return first note for now (TODO: proper beam group handling)
			return notes[0] || null;
		}

		// Function call (dynamics, articulations, etc.)
		if (this.check('FUNCTION')) {
			return this.parseFunctionCall();
		}

		// Note
		if (this.check('NOTE')) {
			return this.parseNote();
		}

		return null;
	}

	private parseNote(): NoteNode {
		const noteToken = this.advance();
		const pitch = this.parseNotePitch(noteToken);

		// Check for octave modifier
		if (this.check('OCTAVE_MOD')) {
			const modToken = this.advance();
			const mod = modToken.value;
			if (mod === '+') pitch.octave = Math.min(8, pitch.octave + 1) as Octave;
			else if (mod === '++') pitch.octave = Math.min(8, pitch.octave + 2) as Octave;
			else if (mod === '-') pitch.octave = Math.max(0, pitch.octave - 1) as Octave;
			else if (mod === '--') pitch.octave = Math.max(0, pitch.octave - 2) as Octave;
		}

		let duration = { ...DEFAULT_DURATION };
		if (this.check('DURATION')) {
			duration = this.parseDuration();
		}

		// Fingering
		let fingering: number | undefined;
		if (this.check('FINGERING')) {
			const fingerToken = this.advance();
			fingering = parseInt(fingerToken.value.slice(1));
		}

		const annotation: AnnotationNode | undefined = fingering
			? { kind: 'Annotation', fingering, loc: createLocation(0, 0, 0, 0) }
			: undefined;

		return {
			kind: 'Note',
			pitch,
			duration,
			tied: false,
			annotation,
			loc: createLocation(noteToken.line, noteToken.column, noteToken.start, this.previous()?.end ?? noteToken.end),
		};
	}

	private parseNotePitch(token: Token): PitchNode {
		const value = token.value;
		const match = value.match(/^([A-G])(#{1,2}|b{1,2})?(\d)?/);

		if (!match) {
			return {
				kind: 'Pitch',
				note: 'C',
				accidental: '',
				octave: this.defaultOctave,
				loc: createLocation(token.line, token.column, token.start, token.end),
			};
		}

		const [, letter, accidental = '', octaveStr] = match;
		const noteName = letter as NoteName;

		let octave: Octave;
		if (octaveStr) {
			octave = parseInt(octaveStr) as Octave;
		} else {
			octave = this.defaultOctave;
		}

		return {
			kind: 'Pitch',
			note: noteName,
			accidental: accidental as Accidental,
			octave,
			loc: createLocation(token.line, token.column, token.start, token.end),
		};
	}

	private parseRest(): RestNode {
		const restToken = this.advance();

		let duration = { ...DEFAULT_DURATION };
		if (this.check('DURATION')) {
			duration = this.parseDuration();
		}

		return {
			kind: 'Rest',
			duration,
			loc: createLocation(restToken.line, restToken.column, restToken.start, this.previous()?.end ?? restToken.end),
		};
	}

	private parseChord(): ChordNode {
		const startToken = this.advance(); // [
		const pitches: PitchNode[] = [];

		while (!this.isAtEnd() && !this.check('CHORD_END')) {
			this.skipWhitespace();

			if (this.check('NOTE')) {
				const noteToken = this.advance();
				pitches.push(this.parseNotePitch(noteToken));
			} else if (!this.check('CHORD_END')) {
				this.advance();
			}
		}

		if (this.check('CHORD_END')) {
			this.advance();
		}

		let duration = { ...DEFAULT_DURATION };
		if (this.check('DURATION')) {
			duration = this.parseDuration();
		}

		return {
			kind: 'Chord',
			pitches,
			duration,
			loc: createLocation(startToken.line, startToken.column, startToken.start, this.previous()?.end ?? startToken.end),
		};
	}

	private parseDuration(): DurationNode {
		const token = this.advance();
		const value = token.value;

		// Handle /4, /8, etc.
		const match = value.match(/^\/([1248]|16|32)(\.{1,2})?$/);
		if (match) {
			const baseMap: Record<string, DurationNode['base']> = {
				'1': 'w', '2': 'h', '4': 'q', '8': '8', '16': '16', '32': '32'
			};
			return {
				kind: 'Duration',
				base: baseMap[match[1]] || 'q',
				dots: match[2]?.length ?? 0,
				loc: createLocation(token.line, token.column, token.start, token.end),
			};
		}

		// Handle standalone dot (dotted quarter shorthand)
		if (value === '.') {
			return {
				kind: 'Duration',
				base: 'q',
				dots: 1,
				loc: createLocation(token.line, token.column, token.start, token.end),
			};
		}

		return { ...DEFAULT_DURATION, loc: createLocation(token.line, token.column, token.start, token.end) };
	}

	private parseFunctionCall(): MusicElementNode | null {
		const fnToken = this.advance();
		const fnName = fnToken.value;

		// Expect (
		this.skipWhitespace();
		if (!this.check('PAREN_OPEN')) {
			return null;
		}
		this.advance();

		// Parse function arguments (notes or ranges)
		const notes: NoteNode[] = [];
		while (!this.isAtEnd() && !this.check('PAREN_CLOSE')) {
			this.skipWhitespace();

			if (this.check('NOTE')) {
				const note = this.parseNote();
				notes.push(note);
			} else if (this.check('CHORD_START')) {
				// Chord in function
				this.parseChord();
			} else if (!this.check('PAREN_CLOSE')) {
				this.advance();
			}
		}

		if (this.check('PAREN_CLOSE')) {
			this.advance();
		}

		// Apply function to notes
		if (DYNAMICS.has(fnName)) {
			// Apply dynamic to all notes
			for (const note of notes) {
				if (!note.annotation) {
					note.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };
				}
				note.annotation.dynamic = fnName as Dynamic;
			}
		} else if (ARTICULATION_FN_MAP[fnName]) {
			// Apply articulation to all notes
			for (const note of notes) {
				if (!note.annotation) {
					note.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };
				}
				if (!note.annotation.articulations) {
					note.annotation.articulations = [];
				}
				note.annotation.articulations.push(ARTICULATION_FN_MAP[fnName]);
			}
		}

		// Return first note (the rest are added implicitly)
		return notes[0] || null;
	}

	private parseAnnotationBlock(elements: MusicElementNode[]): void {
		// Parse function calls that reference elements by index
		while (!this.isAtEnd() && !this.check('ANNOTATION_BLOCK_END') && !this.check('STAVE_BODY_END')) {
			this.skipWhitespaceAndNewlines();

			if (this.check('FUNCTION')) {
				const fnToken = this.advance();
				const fnName = fnToken.value;

				// Expect (
				this.skipWhitespace();
				if (!this.check('PAREN_OPEN')) {
					continue;
				}
				this.advance();

				// Parse first argument: range or single index
				this.skipWhitespace();
				let startIdx = 1;
				let endIdx = 1;

				if (this.check('RANGE')) {
					const rangeToken = this.advance();
					const match = rangeToken.value.match(/^(\d+)-(\d+)$/);
					if (match) {
						startIdx = parseInt(match[1]);
						endIdx = parseInt(match[2]);
					}
				} else if (this.check('NUMBER')) {
					const numToken = this.advance();
					startIdx = endIdx = parseInt(numToken.value);
				}

				// Parse additional arguments (comma-separated)
				const args: (string | number)[] = [];
				while (this.check('COMMA')) {
					this.advance(); // skip comma
					this.skipWhitespace();

					if (this.check('NUMBER')) {
						args.push(parseInt(this.advance().value));
					} else if (this.check('STRING')) {
						const strToken = this.advance();
						// Remove quotes
						args.push(strToken.value.slice(1, -1));
					} else if (this.check('RANGE')) {
						// Ranges in additional args - just store as string
						args.push(this.advance().value);
					}
					this.skipWhitespace();
				}

				// Expect )
				if (this.check('PAREN_CLOSE')) {
					this.advance();
				}

				// Apply function to elements in range (1-indexed)
				this.applyAnnotationFunction(fnName, startIdx, endIdx, args, elements);
				continue;
			}

			if (this.check('COMMENT')) {
				this.advance();
				continue;
			}

			if (!this.check('ANNOTATION_BLOCK_END') && !this.check('STAVE_BODY_END') && !this.check('EOF')) {
				this.advance();
			} else {
				break;
			}
		}
	}

	private applyAnnotationFunction(fnName: string, startIdx: number, endIdx: number, args: (string | number)[], elements: MusicElementNode[]): void {
		// Convert 1-indexed to 0-indexed
		const start = startIdx - 1;
		const end = endIdx - 1;

		for (let i = start; i <= end && i < elements.length; i++) {
			const element = elements[i];
			if (element.kind !== 'Note' && element.kind !== 'Chord') {
				continue;
			}

			// Get or create annotation
			if (element.kind === 'Note') {
				if (!element.annotation) {
					element.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };
				}

				// Apply based on function name
				if (DYNAMICS.has(fnName)) {
					element.annotation.dynamic = fnName as Dynamic;
				} else if (ARTICULATION_FN_MAP[fnName]) {
					if (!element.annotation.articulations) {
						element.annotation.articulations = [];
					}
					element.annotation.articulations.push(ARTICULATION_FN_MAP[fnName]);
				} else if (fnName === 'cresc' || fnName === 'decresc') {
					// Mark start/end of hairpin
					if (i === start) {
						element.annotation.crescendo = fnName === 'cresc' ? 'start' : undefined;
						element.annotation.decrescendo = fnName === 'decresc' ? 'start' : undefined;
					} else if (i === end) {
						element.annotation.crescendo = fnName === 'cresc' ? 'end' : undefined;
						element.annotation.decrescendo = fnName === 'decresc' ? 'end' : undefined;
					}
				} else if (fnName === 'text' && args.length > 0) {
					element.annotation.text = String(args[0]);
				} else if (fnName === 'finger' && args.length > 0) {
					element.annotation.fingering = Number(args[0]);
				} else if (fnName === 'tie') {
					element.tied = true;
				} else if (fnName === 'slur') {
					// Mark slur start/end on annotation
					if (i === start) {
						element.annotation.slurStart = true;
					} else if (i === end) {
						element.annotation.slurEnd = true;
					}
				}
			}
		}
	}

	// ============ Helper methods ============

	private current(): Token | undefined {
		return this.tokens[this.pos];
	}

	private previous(): Token | undefined {
		return this.tokens[this.pos - 1];
	}

	private isAtEnd(): boolean {
		return this.pos >= this.tokens.length || this.current()?.type === 'EOF';
	}

	private check(type: TokenType): boolean {
		return this.current()?.type === type;
	}

	private advance(): Token {
		const token = this.current()!;
		this.pos++;
		return token;
	}

	private skipWhitespace(): void {
		while (this.check('WHITESPACE')) {
			this.advance();
		}
	}

	private skipWhitespaceAndNewlines(): void {
		while (this.check('WHITESPACE') || this.check('NEWLINE')) {
			this.advance();
		}
	}
}

// Convenience function
export function parseScoreToAST(source: string): ParseResult {
	return new ScoreParser().parse(source);
}
