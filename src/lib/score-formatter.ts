// Scorelang v2.0 Formatter
// Formats score source code for consistent styling

import { tokenize, type Token, type TokenType } from './score-lexer';
import { load, dump } from 'js-yaml';

export interface FormatOptions {
	indentSize: number;
	indentChar: ' ' | '\t';
	maxLineLength: number;
	notesPerLine: number;
	spaceAroundConnectives: boolean;
	alignContextValues: boolean;
}

const DEFAULT_OPTIONS: FormatOptions = {
	indentSize: 2,
	indentChar: ' ',
	maxLineLength: 80,
	notesPerLine: 8,
	spaceAroundConnectives: false,
	alignContextValues: true,
};

export function formatScore(source: string, options: Partial<FormatOptions> = {}): string {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const { tokens } = tokenize(source);

	const lines: string[] = [];
	let currentLine = '';
	let indentLevel = 0;
	let inContextBlock = false;
	let inStaveBody = false;
	let noteCount = 0;

	const indent = () => opts.indentChar.repeat(opts.indentSize * indentLevel);

	const flush = () => {
		if (currentLine.trim()) {
			lines.push(indent() + currentLine.trim());
		}
		currentLine = '';
	};

	const addToken = (token: Token) => {
		const value = token.value;

		switch (token.type) {
			case 'CONTEXT_DELIM':
				flush();
				lines.push('---');
				inContextBlock = !inContextBlock;
				if (inContextBlock) indentLevel = 0;
				break;

			case 'YAML_CONTENT':
				try {
					// YAML doesn't like keys starting with & (reserved for anchors)
					// but Scorelang use & for staves. We quote them for YAML parser.
					const sanitizedValue = value.replace(/^(\s*)&([a-zA-Z0-9+]+):/gm, '$1"&$2":');
					const doc = load(sanitizedValue);
					if (doc && typeof doc === 'object') {
						const formattedYaml = dump(doc, {
							indent: opts.indentSize,
							lineWidth: opts.maxLineLength
						});
						lines.push(formattedYaml.trim());
					} else {
						lines.push(value.trim());
					}
				} catch (e) {
					// If YAML is invalid, keep as is
					lines.push(value.trim());
				}
				break;

			case 'STAVE_DECL':
				flush();
				if (inContextBlock) {
					// Inside context block: stave declaration with colon
					lines.push(`${value}:`);
					indentLevel = 1;
				} else {
					// Outside context block: stave body
					currentLine = value + ' ';
				}
				break;

			case 'CONTEXT_KEY':
				flush();
				currentLine = value;
				break;

			case 'CONTEXT_VALUE':
				currentLine += ': ' + value;
				flush();
				break;

			case 'STAVE_BODY_START':
				currentLine += '{ ';
				inStaveBody = true;
				noteCount = 0;
				break;

			case 'STAVE_BODY_END':
				if (currentLine.endsWith(' ')) {
					currentLine = currentLine.slice(0, -1);
				}
				currentLine += ' }';
				flush();
				inStaveBody = false;
				break;

			case 'ANNOTATION_BLOCK_START':
				currentLine += ' { ';
				break;

			case 'ANNOTATION_BLOCK_END':
				if (currentLine.endsWith(' ')) {
					currentLine = currentLine.slice(0, -1);
				}
				currentLine += ' }';
				flush();
				break;

			case 'NOTE':
			case 'REST':
				if (inStaveBody && noteCount > 0 && noteCount % opts.notesPerLine === 0) {
					flush();
					currentLine = indent() + '  '; // Extra indent for continued notes
				}
				currentLine += value;
				noteCount++;
				break;

			case 'DURATION':
			case 'OCTAVE_MOD':
			case 'FINGERING':
				// Attach directly to previous token (no space)
				currentLine += value;
				break;

			case 'SLUR':
			case 'TIE':
			case 'PEDAL':
				if (opts.spaceAroundConnectives) {
					currentLine += ' ' + value + ' ';
				} else {
					currentLine += value;
				}
				break;

			case 'CHORD_START':
				currentLine += '[';
				break;

			case 'CHORD_END':
				currentLine += ']';
				break;

			case 'FUNCTION':
				currentLine += value;
				break;

			case 'PAREN_OPEN':
				currentLine += '(';
				break;

			case 'PAREN_CLOSE':
				currentLine += ')';
				break;

			case 'COMMA':
				currentLine += ', ';
				break;

			case 'RANGE':
			case 'NUMBER':
				currentLine += value;
				break;

			case 'STRING':
				currentLine += value;
				break;

			case 'GRACE':
				currentLine += value;
				break;

			case 'BEAM_START':
				currentLine += '=(';
				break;

			case 'COMMENT':
				flush();
				lines.push(indent() + value);
				break;

			case 'NEWLINE':
				// Handled by context
				break;

			case 'WHITESPACE':
				// Add single space between tokens if not already present
				if (inStaveBody && !currentLine.endsWith(' ') && !currentLine.endsWith('[') &&
					!currentLine.endsWith('(') && !currentLine.endsWith('~') &&
					!currentLine.endsWith('^') && currentLine.length > 0) {
					currentLine += ' ';
				}
				break;

			case 'EOF':
				flush();
				break;

			default:
				// Unknown tokens - keep as-is
				currentLine += value;
		}
	};

	for (const token of tokens) {
		addToken(token);
	}

	// Clean up empty lines and trailing whitespace
	return lines
		.map(line => line.trimEnd())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim() + '\n';
}

// Minify score by removing unnecessary whitespace
export function minifyScore(source: string): string {
	const { tokens } = tokenize(source);

	let result = '';
	let lastTokenType: TokenType | null = null;

	for (const token of tokens) {
		const t = token.type;
		const v = token.value;

		// Skip whitespace and newlines entirely
		if (t === 'WHITESPACE' || t === 'NEWLINE' || t === 'EOF') continue;

		// Add space between certain tokens
		const needsSpace = lastTokenType !== null &&
			!['CHORD_START', 'PAREN_OPEN', 'SLUR', 'TIE', 'FUNCTION'].includes(lastTokenType) &&
			!['CHORD_END', 'PAREN_CLOSE', 'DURATION', 'OCTAVE_MOD', 'FINGERING', 'SLUR', 'TIE', 'COMMA'].includes(t) &&
			lastTokenType !== 'CONTEXT_KEY' &&
			t !== 'CONTEXT_VALUE';

		if (needsSpace && !result.endsWith(' ') && !result.endsWith('\n')) {
			// Context blocks need newlines
			if (t === 'CONTEXT_DELIM' || lastTokenType === 'CONTEXT_DELIM' ||
				t === 'STAVE_DECL' || (lastTokenType === 'CONTEXT_VALUE')) {
				result += '\n';
			} else if (t === 'NOTE' || t === 'REST' || t === 'CHORD_START') {
				result += ' ';
			}
		}

		// Special handling for context
		if (lastTokenType === 'CONTEXT_KEY' && t === 'CONTEXT_VALUE') {
			result += ': ';
		}

		result += v;
		lastTokenType = t;
	}

	return result.trim() + '\n';
}
