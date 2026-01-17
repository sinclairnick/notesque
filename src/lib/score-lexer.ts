// Scorelang v2.0 Lexer
// Tokenizes score source into typed tokens

export type TokenType =
	// Structure
	| 'CONTEXT_DELIM'        // ---
	| 'CONTEXT_KEY'          // tempo, key, time, etc.
	| 'CONTEXT_VALUE'        // value after colon
	| 'STAVE_DECL'           // &right, &left, &right+alto
	| 'STAVE_BODY_START'     // { after stave name
	| 'STAVE_BODY_END'       // } closing stave body
	| 'ANNOTATION_BLOCK_START' // second { after stave body  
	| 'ANNOTATION_BLOCK_END'   // } closing annotation block
	// Notes
	| 'NOTE'                 // A-G with optional accidental/octave
	| 'REST'                 // _
	| 'DURATION'             // /1, /2, /4, /8, /16, /32, /4.
	| 'OCTAVE_MOD'           // +, ++, -, --
	| 'FINGERING'            // @1, @2, @3, @4, @5
	// Grouping
	| 'CHORD_START'          // [
	| 'CHORD_END'            // ]
	| 'BEAM_START'           // =(
	| 'PAREN_OPEN'           // (
	| 'PAREN_CLOSE'          // )
	// Connectives
	| 'SLUR'                 // ~ between notes
	| 'TIE'                  // ^ between notes
	| 'PEDAL'                // _ between notes (contextual)
	// Functions
	| 'FUNCTION'             // p, f, cresc, st, etc.
	// Arguments (for annotation blocks)
	| 'NUMBER'               // 1, 2, 3, etc.
	| 'RANGE'                // 1-4 (number-number)
	| 'COMMA'                // ,
	| 'STRING'               // "text"
	// Lyrics
	| 'LYRIC'                // lyric text (syllables)
	// Repeats
	| 'REPEAT_START'         // |:
	| 'REPEAT_END'           // :|
	| 'VOLTA'                // [1. or [2.
	// Misc
	| 'GRACE'                // ` or ``
	| 'COMMENT'              // // or /* */
	| 'NEWLINE'
	| 'WHITESPACE'
	| 'EOF'
	| 'UNKNOWN';

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	column: number;
	start: number;
	end: number;
}

export interface LexerError {
	message: string;
	line: number;
	column: number;
}

export interface LexerResult {
	tokens: Token[];
	errors: LexerError[];
}

// Known function names (standard library)
const FUNCTIONS = new Set([
	// Dynamics
	'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff',
	'cresc', 'decresc',
	// Articulations
	'st', 'tn', 'ac', 'mc', 'fm', 'tr',
	// Connectives
	'tie', 'slur', 'pedal',
	// Note properties - base functions
	'oct', 'dur', 'finger',
	// Note properties - shorthand variants
	'oct_up', 'oct_up2', 'oct_down', 'oct_down2',
	'oct_0', 'oct_1', 'oct_2', 'oct_3', 'oct_4', 'oct_5', 'oct_6', 'oct_7', 'oct_8',
	'dur_1', 'dur_2', 'dur_4', 'dur_8', 'dur_16', 'dur_32',
	'dot', 'sharp', 'flat',
	'finger_1', 'finger_2', 'finger_3', 'finger_4', 'finger_5',
	// Grouping
	'beam', 'tuplet', 'grace',
	// Annotations only
	'text', '8va', '8vb',
]);

// Patterns
const NOTE_PATTERN = /^([A-G])(#{1,2}|b{1,2})?(\d)?/;
const DURATION_PATTERN = /^\/(32|16|8|4|2|1)(\.{1,2})?/;
const OCTAVE_MOD_PATTERN = /^(\+\+?|--?)/;
const FINGERING_PATTERN = /^@([1-5])/;
const STAVE_PATTERN = /^&(\w+)(\+\w+)?/;
const CONTEXT_KEY_PATTERN = /^(\w+):\s*/;
const RANGE_PATTERN = /^(\d+)-(\d+)/;
const NUMBER_PATTERN = /^(\d+)/;
const STRING_PATTERN = /^"([^"]*)"/;

export class ScoreLexer {
	private source: string;
	private pos: number = 0;
	private line: number = 1;
	private column: number = 1;
	private tokens: Token[] = [];
	private errors: LexerError[] = [];

	// Mode tracking
	private inContext: boolean = false;
	private staveDepth: number = 0;
	private expectAnnotationBlock: boolean = false;
	private inAnnotationBlock: boolean = false;

	constructor(source: string) {
		this.source = source;
	}

	tokenize(): LexerResult {
		while (!this.isAtEnd()) {
			this.scanToken();
		}

		this.addToken('EOF', '');
		return { tokens: this.tokens, errors: this.errors };
	}

	private scanToken(): void {
		const start = this.pos;
		const startLine = this.line;
		const startColumn = this.column;
		const remaining = this.source.slice(this.pos);

		// Context delimiter ---
		if (remaining.startsWith('---')) {
			this.advance(3);
			this.inContext = !this.inContext;
			this.addTokenAt('CONTEXT_DELIM', '---', startLine, startColumn, start, this.pos);
			return;
		}

		// Inside context block
		if (this.inContext) {
			this.scanContextContent(startLine, startColumn, start);
			return;
		}

		const char = this.peek();

		// Newline
		if (char === '\n') {
			this.advance(1);
			this.addTokenAt('NEWLINE', '\n', startLine, startColumn, start, this.pos);
			this.line++;
			this.column = 1;
			return;
		}

		// Whitespace
		if (/[ \t\r]/.test(char)) {
			let ws = '';
			while (!this.isAtEnd() && /[ \t\r]/.test(this.peek())) {
				ws += this.peek();
				this.advance(1);
			}
			this.addTokenAt('WHITESPACE', ws, startLine, startColumn, start, this.pos);
			return;
		}

		// Single-line comment
		if (remaining.startsWith('//')) {
			this.advance(2);
			let comment = '//';
			while (!this.isAtEnd() && this.peek() !== '\n') {
				comment += this.peek();
				this.advance(1);
			}
			this.addTokenAt('COMMENT', comment, startLine, startColumn, start, this.pos);
			return;
		}

		// Multi-line comment
		if (remaining.startsWith('/*')) {
			this.advance(2);
			let comment = '/*';
			while (!this.isAtEnd() && !this.source.slice(this.pos).startsWith('*/')) {
				if (this.peek() === '\n') {
					this.line++;
					this.column = 0;
				}
				comment += this.peek();
				this.advance(1);
			}
			if (this.source.slice(this.pos).startsWith('*/')) {
				comment += '*/';
				this.advance(2);
			}
			this.addTokenAt('COMMENT', comment, startLine, startColumn, start, this.pos);
			return;
		}

		// Stave declaration &name or &name+voice
		const staveMatch = remaining.match(STAVE_PATTERN);
		if (staveMatch) {
			const fullMatch = staveMatch[0];
			this.advance(fullMatch.length);
			this.addTokenAt('STAVE_DECL', fullMatch, startLine, startColumn, start, this.pos);
			return;
		}

		// Curly braces (stave body or annotation block)
		if (char === '{') {
			this.advance(1);
			if (this.expectAnnotationBlock) {
				this.addTokenAt('ANNOTATION_BLOCK_START', '{', startLine, startColumn, start, this.pos);
				this.expectAnnotationBlock = false;
				this.inAnnotationBlock = true;
			} else {
				this.addTokenAt('STAVE_BODY_START', '{', startLine, startColumn, start, this.pos);
				this.staveDepth++;
			}
			return;
		}

		if (char === '}') {
			this.advance(1);
			if (this.inAnnotationBlock) {
				this.addTokenAt('ANNOTATION_BLOCK_END', '}', startLine, startColumn, start, this.pos);
				this.inAnnotationBlock = false;
			} else if (this.staveDepth > 0) {
				this.addTokenAt('STAVE_BODY_END', '}', startLine, startColumn, start, this.pos);
				this.staveDepth--;
				this.expectAnnotationBlock = true; // May be followed by annotation block
			} else {
				this.addTokenAt('ANNOTATION_BLOCK_END', '}', startLine, startColumn, start, this.pos);
			}
			return;
		}

		// String literal (for annotation text)
		if (char === '"') {
			const stringMatch = remaining.match(STRING_PATTERN);
			if (stringMatch) {
				this.advance(stringMatch[0].length);
				this.addTokenAt('STRING', stringMatch[0], startLine, startColumn, start, this.pos);
				return;
			}
		}

		// Range or Number (for annotation indices) - check RANGE first as it's longer
		const rangeMatch = remaining.match(RANGE_PATTERN);
		if (rangeMatch) {
			this.advance(rangeMatch[0].length);
			this.addTokenAt('RANGE', rangeMatch[0], startLine, startColumn, start, this.pos);
			return;
		}

		// Standalone number (for function arguments like finger(1, 3))
		const numberMatch = remaining.match(NUMBER_PATTERN);
		if (numberMatch) {
			this.advance(numberMatch[0].length);
			this.addTokenAt('NUMBER', numberMatch[0], startLine, startColumn, start, this.pos);
			return;
		}

		// Comma (for annotation arguments)
		if (char === ',') {
			this.advance(1);
			this.addTokenAt('COMMA', ',', startLine, startColumn, start, this.pos);
			return;
		}

		// Grace note prefix
		if (remaining.startsWith('``')) {
			this.advance(2);
			this.addTokenAt('GRACE', '``', startLine, startColumn, start, this.pos);
			return;
		}
		if (char === '`') {
			this.advance(1);
			this.addTokenAt('GRACE', '`', startLine, startColumn, start, this.pos);
			return;
		}

		// Beam start
		if (remaining.startsWith('=(')) {
			this.advance(2);
			this.addTokenAt('BEAM_START', '=(', startLine, startColumn, start, this.pos);
			return;
		}

		// Repeat markers
		if (remaining.startsWith('|:')) {
			this.advance(2);
			this.addTokenAt('REPEAT_START', '|:', startLine, startColumn, start, this.pos);
			return;
		}
		if (remaining.startsWith(':|')) {
			this.advance(2);
			this.addTokenAt('REPEAT_END', ':|', startLine, startColumn, start, this.pos);
			return;
		}

		// Volta brackets [1. or [2.
		const voltaMatch = remaining.match(/^\[(\d+)\./);
		if (voltaMatch) {
			this.advance(voltaMatch[0].length);
			this.addTokenAt('VOLTA', voltaMatch[0], startLine, startColumn, start, this.pos);
			return;
		}

		// Chord brackets
		if (char === '[') {
			this.advance(1);
			this.addTokenAt('CHORD_START', '[', startLine, startColumn, start, this.pos);
			return;
		}
		if (char === ']') {
			this.advance(1);
			this.addTokenAt('CHORD_END', ']', startLine, startColumn, start, this.pos);
			return;
		}

		// Parentheses
		if (char === '(') {
			this.advance(1);
			this.addTokenAt('PAREN_OPEN', '(', startLine, startColumn, start, this.pos);
			return;
		}
		if (char === ')') {
			this.advance(1);
			this.addTokenAt('PAREN_CLOSE', ')', startLine, startColumn, start, this.pos);
			return;
		}

		// Connectives (between notes)
		if (char === '~') {
			this.advance(1);
			this.addTokenAt('SLUR', '~', startLine, startColumn, start, this.pos);
			return;
		}
		if (char === '^') {
			this.advance(1);
			this.addTokenAt('TIE', '^', startLine, startColumn, start, this.pos);
			return;
		}

		// Rest (standalone _) vs Pedal (_ between notes handled by parser)
		if (char === '_') {
			this.advance(1);
			// Check for duration suffix
			const durMatch = this.source.slice(this.pos).match(DURATION_PATTERN);
			if (durMatch) {
				this.addTokenAt('REST', '_', startLine, startColumn, start, this.pos);
				const durStart = this.pos;
				this.advance(durMatch[0].length);
				this.addTokenAt('DURATION', durMatch[0], startLine, this.column - durMatch[0].length, durStart, this.pos);
			} else {
				// Could be rest or pedal - parser decides based on context
				this.addTokenAt('REST', '_', startLine, startColumn, start, this.pos);
			}
			return;
		}

		// Duration
		const durMatch = remaining.match(DURATION_PATTERN);
		if (durMatch) {
			this.advance(durMatch[0].length);
			this.addTokenAt('DURATION', durMatch[0], startLine, startColumn, start, this.pos);
			return;
		}

		// Fingering @1-5
		const fingerMatch = remaining.match(FINGERING_PATTERN);
		if (fingerMatch) {
			this.advance(fingerMatch[0].length);
			this.addTokenAt('FINGERING', fingerMatch[0], startLine, startColumn, start, this.pos);
			return;
		}

		// Function or identifier
		if (/[a-z_]/.test(char)) {
			let ident = '';
			while (!this.isAtEnd() && /[a-z_0-9]/.test(this.peek())) {
				ident += this.peek();
				this.advance(1);
			}
			if (FUNCTIONS.has(ident)) {
				this.addTokenAt('FUNCTION', ident, startLine, startColumn, start, this.pos);
			} else {
				this.addTokenAt('UNKNOWN', ident, startLine, startColumn, start, this.pos);
			}
			return;
		}

		// Note (A-G)
		const noteMatch = remaining.match(NOTE_PATTERN);
		if (noteMatch) {
			const noteStr = noteMatch[0];
			this.advance(noteStr.length);
			this.addTokenAt('NOTE', noteStr, startLine, startColumn, start, this.pos);

			// Check for octave modifier after note
			const octModMatch = this.source.slice(this.pos).match(OCTAVE_MOD_PATTERN);
			if (octModMatch) {
				const modStart = this.pos;
				this.advance(octModMatch[0].length);
				this.addTokenAt('OCTAVE_MOD', octModMatch[0], startLine, this.column - octModMatch[0].length, modStart, this.pos);
			}

			// Check for duration suffix after note
			const durAfter = this.source.slice(this.pos).match(DURATION_PATTERN);
			if (durAfter) {
				const durStart = this.pos;
				this.advance(durAfter[0].length);
				this.addTokenAt('DURATION', durAfter[0], startLine, this.column - durAfter[0].length, durStart, this.pos);
			}

			// Check for fingering
			const fingerAfter = this.source.slice(this.pos).match(FINGERING_PATTERN);
			if (fingerAfter) {
				const fStart = this.pos;
				this.advance(fingerAfter[0].length);
				this.addTokenAt('FINGERING', fingerAfter[0], startLine, this.column - fingerAfter[0].length, fStart, this.pos);
			}

			return;
		}

		// Dot (standalone, for dotted quarter shorthand)
		if (char === '.') {
			this.advance(1);
			this.addTokenAt('DURATION', '.', startLine, startColumn, start, this.pos);
			return;
		}

		// Unknown
		this.advance(1);
		this.expectAnnotationBlock = false; // Reset on unknown
		this.addTokenAt('UNKNOWN', char, startLine, startColumn, start, this.pos);
	}

	private scanContextContent(startLine: number, startColumn: number, start: number): void {
		const char = this.peek();
		const remaining = this.source.slice(this.pos);

		// Newline
		if (char === '\n') {
			this.advance(1);
			this.addTokenAt('NEWLINE', '\n', startLine, startColumn, start, this.pos);
			this.line++;
			this.column = 1;
			return;
		}

		// Whitespace
		if (/[ \t\r]/.test(char)) {
			let ws = '';
			while (!this.isAtEnd() && /[ \t\r]/.test(this.peek())) {
				ws += this.peek();
				this.advance(1);
			}
			this.addTokenAt('WHITESPACE', ws, startLine, startColumn, start, this.pos);
			return;
		}

		// Stave declaration in context
		const staveMatch = remaining.match(STAVE_PATTERN);
		if (staveMatch) {
			const fullMatch = staveMatch[0];
			this.advance(fullMatch.length);
			this.addTokenAt('STAVE_DECL', fullMatch, startLine, startColumn, start, this.pos);
			return;
		}

		// Key-value pair
		const keyMatch = remaining.match(CONTEXT_KEY_PATTERN);
		if (keyMatch) {
			const key = keyMatch[1];
			this.advance(key.length);
			this.addTokenAt('CONTEXT_KEY', key, startLine, startColumn, start, this.pos);

			// Skip colon and whitespace
			while (!this.isAtEnd() && /[:\s]/.test(this.peek()) && this.peek() !== '\n') {
				this.advance(1);
			}

			// Get value until newline
			const valueStart = this.pos;
			let value = '';
			while (!this.isAtEnd() && this.peek() !== '\n') {
				value += this.peek();
				this.advance(1);
			}
			if (value.trim()) {
				this.addTokenAt('CONTEXT_VALUE', value.trim(), startLine, this.column - value.length, valueStart, this.pos);
			}
			return;
		}

		// Comment in context
		if (remaining.startsWith('//')) {
			this.advance(2);
			let comment = '//';
			while (!this.isAtEnd() && this.peek() !== '\n') {
				comment += this.peek();
				this.advance(1);
			}
			this.addTokenAt('COMMENT', comment, startLine, startColumn, start, this.pos);
			return;
		}

		// Unknown in context
		this.advance(1);
		this.addTokenAt('UNKNOWN', char, startLine, startColumn, start, this.pos);
	}

	private isAtEnd(): boolean {
		return this.pos >= this.source.length;
	}

	private peek(): string {
		return this.source[this.pos] || '\0';
	}

	private advance(count: number): void {
		for (let i = 0; i < count; i++) {
			this.pos++;
			this.column++;
		}
	}

	private addToken(type: TokenType, value: string): void {
		this.addTokenAt(type, value, this.line, this.column, this.pos, this.pos);
	}

	private addTokenAt(type: TokenType, value: string, line: number, column: number, start: number, end: number): void {
		this.tokens.push({ type, value, line, column, start, end });
	}
}

export function tokenize(source: string): LexerResult {
	return new ScoreLexer(source).tokenize();
}
