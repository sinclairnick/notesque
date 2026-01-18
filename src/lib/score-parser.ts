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
	type TimeSignatureNode,
	createLocation,
} from './score-ast';
import type { Accidental, Articulation, Dynamic, NoteName, Octave } from './score-types';
import { load } from 'js-yaml';

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

// Duration values in beats (quarter note = 1)
const DURATION_BEATS: Record<DurationNode['base'], number> = {
	'w': 4,
	'h': 2,
	'q': 1,
	'8': 0.5,
	'16': 0.25,
	'32': 0.125,
};

// Calculate beats for a duration (including dots)
function getDurationBeats(duration: DurationNode): number {
	let beats = DURATION_BEATS[duration.base];
	let dotValue = beats / 2;
	for (let i = 0; i < duration.dots; i++) {
		beats += dotValue;
		dotValue /= 2;
	}
	return beats;
}

// Split elements into measures based on time signature
function splitIntoMeasures(
	elements: MusicElementNode[],
	beatsPerMeasure: number,
	staveToken: Token,
	attributes?: { key?: string; time?: TimeSignatureNode; clef?: string }
): MeasureNode[] {
	if (elements.length === 0) return [];

	const measures: MeasureNode[] = [];
	let currentElements: MusicElementNode[] = [];
	let currentBeats = 0;
	let measureStartToken = staveToken;

	for (const element of elements) {
		const elementBeats = getDurationBeats(element.duration);

		// If adding this element would exceed measure, start new measure
		if (currentBeats + elementBeats > beatsPerMeasure && currentElements.length > 0) {
			measures.push({
				kind: 'Measure',
				elements: currentElements,
				barline: 'single',
				loc: createLocation(
					measureStartToken.line,
					measureStartToken.column,
					measureStartToken.start,
					element.loc.start
				),
				attributes: measures.length === 0 ? attributes : undefined, // Apply attributes to first measure only
			});
			currentElements = [];
			currentBeats = 0;
			measureStartToken = { ...staveToken, start: element.loc.start };
		}

		currentElements.push(element);
		currentBeats += elementBeats;

		// If we've hit exactly the measure boundary, close the measure
		if (currentBeats >= beatsPerMeasure) {
			measures.push({
				kind: 'Measure',
				elements: currentElements,
				barline: 'single',
				loc: createLocation(
					measureStartToken.line,
					measureStartToken.column,
					measureStartToken.start,
					element.loc.end
				),
			});
			currentElements = [];
			currentBeats = 0;
			measureStartToken = { ...staveToken, start: element.loc.end };
		}
	}

	// Add remaining elements as final (possibly incomplete) measure
	if (currentElements.length > 0) {
		measures.push({
			kind: 'Measure',
			elements: currentElements,
			barline: 'single',
			loc: createLocation(
				measureStartToken.line,
				measureStartToken.column,
				measureStartToken.start,
				currentElements[currentElements.length - 1].loc.end
			),
			attributes: measures.length === 0 ? attributes : undefined,
		});
	}

	return measures;
}

export class ScoreParser {
	private tokens: Token[] = [];
	private pos: number = 0;
	private errors: ParseError[] = [];
	private warnings: ParseError[] = [];
	private defaultOctave: Octave = 4;
	private timeSignature: { beats: number; beatType: number } = { beats: 4, beatType: 4 };
	private globalKey: string = 'C';
	private declaredStaves: Map<string, { clef: string; voice?: string }> = new Map();
	private currentDuration: DurationNode = { ...DEFAULT_DURATION };

	parse(source: string): ParseResult {
		const lexResult = tokenize(source);

		this.tokens = lexResult.tokens;
		this.pos = 0;
		this.errors = [];
		this.warnings = [];
		this.declaredStaves = new Map();
		this.currentDuration = { ...DEFAULT_DURATION };
		this.globalKey = 'C';
		this.timeSignature = { beats: 4, beatType: 4 };

		// Add lexer errors
		for (const err of lexResult.errors) {
			this.errors.push(err);
		}

		// Validate token stream (spacing rules)
		this.validateTokens();

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

		// Capture time signature for measure computation
		if (metadata.time) {
			this.timeSignature = { beats: metadata.time.beats, beatType: metadata.time.beatType };
		}
		if (metadata.key) {
			this.globalKey = metadata.key;
		}

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
		while (!this.isAtEnd() && !this.check('CONTEXT_DELIM')) {
			if (this.check('YAML_CONTENT')) {
				const token = this.advance();
				try {
					// YAML doesn't like keys starting with & (reserved for anchors)
					// but Scorelang use & for staves. We quote them for YAML parser.
					const sanitizedValue = token.value.replace(/^(\s*)&([a-zA-Z0-9+]+):/gm, '$1"&$2":');
					const doc = load(sanitizedValue) as any;
					if (doc && typeof doc === 'object') {
						for (const [key, value] of Object.entries(doc)) {
							if (key.startsWith('&')) {
								// Stave declaration in YAML
								const staveName = key.slice(1);
								const staveData = typeof value === 'object' ? value : { clef: value };
								this.declaredStaves.set(staveName, {
									clef: (staveData as any).clef || 'treble',
									voice: (staveData as any).voice
								});
							} else {
								this.applyMetadataValue(metadata, key, String(value));
							}
						}
					}
				} catch (e) {
					this.errors.push({
						message: `YAML error: ${e instanceof Error ? e.message : 'Unknown'}`,
						line: token.line,
						column: token.column,
					});
				}
				continue;
			}

			// Fallback for old tokens if any
			if (this.check('CONTEXT_KEY') || this.check('STAVE_DECL') || this.check('NEWLINE') || this.check('WHITESPACE') || this.check('COMMENT')) {
				this.advance();
				continue;
			}

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
			default:
				metadata[key] = value;
				break;
		}
	}

	private parseStaveBodies(): StaffNode[] {
		const staves: StaffNode[] = [];
		const staffMeasures = new Map<string, MeasureNode[]>();

		// Track context per staff to detect changes
		const staffContexts = new Map<string, { key: string; time: { beats: number; beatType: number } }>();

		// Initialize from declared staves
		for (const [name] of this.declaredStaves) {
			staffMeasures.set(name, []);
			staffContexts.set(name, {
				key: this.globalKey,
				time: { ...this.timeSignature }
			});
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

				// Apply context to globals
				if (tempMetadata.key) this.globalKey = tempMetadata.key;
				if (tempMetadata.time) this.timeSignature = { beats: tempMetadata.time.beats, beatType: tempMetadata.time.beatType };

				this.skipWhitespaceAndNewlines();
				if (this.check('CONTEXT_DELIM')) {
					this.advance();
				}
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
					if (this.check('ANNOTATION_BLOCK_START')) {
						this.advance();
						this.parseAnnotationBlock(elements);
						if (this.check('ANNOTATION_BLOCK_END')) {
							this.advance();
						}
					}

					// Split elements into measures based on time signature
					if (elements.length > 0) {
						if (!staffMeasures.has(staveName)) {
							staffMeasures.set(staveName, []);
							staffContexts.set(staveName, { key: 'C', time: { beats: 4, beatType: 4 } }); // Default if undeclared
						}

						// Check for context changes
						const currentCtx = staffContexts.get(staveName)!;
						const attributes: { key?: string; time?: TimeSignatureNode } = {};
						let changed = false;

						if (currentCtx.key !== this.globalKey) {
							attributes.key = this.globalKey;
							currentCtx.key = this.globalKey;
							changed = true;
						}

						// Basic Time Signature check (deep comparison handled loosely here)
						if (currentCtx.time.beats !== this.timeSignature.beats || currentCtx.time.beatType !== this.timeSignature.beatType) {
							attributes.time = {
								kind: 'TimeSignature',
								beats: this.timeSignature.beats,
								beatType: this.timeSignature.beatType,
								loc: createLocation(0, 0, 0, 0)
							};
							currentCtx.time = { ...this.timeSignature };
							changed = true;
						}

						const measures = splitIntoMeasures(
							elements,
							this.timeSignature.beats,
							staveToken,
							changed ? attributes : undefined
						);
						staffMeasures.get(staveName)!.push(...measures);
					}
				}
				continue;
			}

			// Skip orphan tokens
			this.advance();
		}

		// Build staff nodes
		const processedStaves = new Set<string>();

		// First add all declared staves (preserves declaration order)
		for (const [name, data] of this.declaredStaves) {
			staves.push({
				kind: 'Staff',
				name,
				clef: (data.clef as StaffNode['clef']) || 'treble',
				measures: staffMeasures.get(name) || [],
				loc: createLocation(0, 0, 0, 0),
			});
			processedStaves.add(name);
		}

		// Then add any staves that were used but NOT declared
		for (const [name, measures] of staffMeasures) {
			if (!processedStaves.has(name)) {
				staves.push({
					kind: 'Staff',
					name,
					clef: 'treble',
					measures,
					loc: createLocation(0, 0, 0, 0),
				});
			}
		}

		// Default single staff if nothing else found
		if (staves.length === 0) {
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

	private validateTokens(): void {
		let inChord = false;
		const noteRelatedTypes = new Set(['NOTE', 'DURATION', 'OCTAVE_MOD', 'FINGERING']);

		for (let i = 0; i < this.tokens.length - 1; i++) {
			const current = this.tokens[i];
			const next = this.tokens[i + 1];

			if (current.type === 'CHORD_START') inChord = true;
			if (current.type === 'CHORD_END') inChord = false;

			if (!inChord) {
				// Check for adjacent notes without separation
				// Strict mode: Note-related token followed immediately by NOTE
				if (noteRelatedTypes.has(current.type) && next.type === 'NOTE') {
					this.errors.push({
						message: 'Notes must be separated by whitespace or connectives',
						line: next.line,
						column: next.column,
					});
				}
			}
		}
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
			const parsed = this.parseMusicElement();
			if (parsed) {
				if (Array.isArray(parsed)) {
					elements.push(...parsed);
				} else {
					elements.push(parsed);
				}
			} else if (this.check('TIE')) {
				this.advance(); // consume ^
				// Attach tie to the last element if it's a note or chord
				if (elements.length > 0) {
					const last = elements[elements.length - 1];
					if (last.kind === 'Note') {
						last.tied = true;
					} else if (last.kind === 'Chord' && last.pitches.length > 0) {
						// For chords, we might want to flag the chord itself or all notes?
						// MusicXML expects tie on each note.
						// The renderer/transpiler needs to handle this property on ChordNode?
						// NoteNode has 'tied', ChordNode doesn't in AST?
						// Let's check AST. ScoreAST defines ChordNode without 'tied'.
						// We need to add 'tied' to ChordNode or handle it differently.
						// For now, let's assume NoteNode.
					}
				}
			} else if (!this.check('STAVE_BODY_END') && !this.check('EOF')) {
				this.advance(); // Skip unknown
			}
		}

		return elements;
	}

	private parseMusicElement(): MusicElementNode | MusicElementNode[] | null {
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
				note.grace = true;
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
				const parsed = this.parseMusicElement();
				if (parsed) {
					const elements = Array.isArray(parsed) ? parsed : [parsed];
					for (const el of elements) {
						if (el.kind === 'Note') {
							el.beamed = true;
							notes.push(el);
						}
					}
				} else if (!this.check('PAREN_CLOSE')) {
					this.advance();
				}
			}
			if (this.check('PAREN_CLOSE')) {
				this.advance();
			}
			// Return all parsed notes
			return notes;
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

		let duration = { ...this.currentDuration };
		if (this.check('DURATION')) {
			duration = this.parseDuration();
			this.currentDuration = { ...duration };
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

		let duration = { ...this.currentDuration };
		if (this.check('DURATION')) {
			duration = this.parseDuration();
			this.currentDuration = { ...duration };
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

		let duration = { ...this.currentDuration };
		if (this.check('DURATION')) {
			duration = this.parseDuration();
			this.currentDuration = { ...duration };
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

	private parseFunctionCall(): MusicElementNode[] | null {
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
			// Apply dynamic to FIRST note only
			if (notes.length > 0) {
				const firstNote = notes[0];
				if (!firstNote.annotation) {
					firstNote.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };
				}
				firstNote.annotation.dynamic = fnName as Dynamic;
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
		} else if (fnName === 'slur' || fnName === 'legato') {
			if (notes.length > 0) {
				const first = notes[0];
				const last = notes[notes.length - 1];
				if (!first.annotation) first.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };
				if (!last.annotation) last.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };

				first.annotation.slurStart = true;
				last.annotation.slurEnd = true;
			}
		} else if (fnName === 'cresc' || fnName === 'crescendo' || fnName === '<') {
			if (notes.length > 0) {
				const first = notes[0];
				const last = notes[notes.length - 1];
				if (!first.annotation) first.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };
				if (!last.annotation) last.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };

				first.annotation.crescendo = 'start';
				last.annotation.crescendo = 'end';
			}
		} else if (fnName === 'decresc' || fnName === 'dim' || fnName === '>') {
			if (notes.length > 0) {
				const first = notes[0];
				const last = notes[notes.length - 1];
				if (!first.annotation) first.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };
				if (!last.annotation) last.annotation = { kind: 'Annotation', loc: createLocation(0, 0, 0, 0) };

				first.annotation.decrescendo = 'start';
				last.annotation.decrescendo = 'end';
			}
		}

		return notes;
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
