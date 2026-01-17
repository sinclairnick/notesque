// Scorelang v2.0 Syntax Highlighter
// Creates highlighted spans from score source code

import type { TokenType } from './score-lexer';
import { tokenize } from './score-lexer';

// Token type to CSS class mapping (VS Code-like semantic colors)
const TOKEN_CLASSES: Record<TokenType, string> = {
	// Structure
	'CONTEXT_DELIM': 'sl-punctuation',
	'CONTEXT_KEY': 'sl-keyword',
	'CONTEXT_VALUE': 'sl-string',
	'STAVE_DECL': 'sl-entity',
	'STAVE_BODY_START': 'sl-punctuation',
	'STAVE_BODY_END': 'sl-punctuation',
	'ANNOTATION_BLOCK_START': 'sl-punctuation-annotation',
	'ANNOTATION_BLOCK_END': 'sl-punctuation-annotation',
	// Notes
	'NOTE': 'sl-variable',
	'REST': 'sl-constant',
	'DURATION': 'sl-number',
	'OCTAVE_MOD': 'sl-operator',
	'FINGERING': 'sl-constant-other',
	// Grouping
	'CHORD_START': 'sl-punctuation',
	'CHORD_END': 'sl-punctuation',
	'BEAM_START': 'sl-operator',
	'PAREN_OPEN': 'sl-punctuation',
	'PAREN_CLOSE': 'sl-punctuation',
	// Connectives
	'SLUR': 'sl-operator',
	'TIE': 'sl-operator',
	'PEDAL': 'sl-operator',
	// Functions
	'FUNCTION': 'sl-function',
	// Arguments
	'NUMBER': 'sl-number',
	'RANGE': 'sl-number',
	'COMMA': 'sl-punctuation',
	'STRING': 'sl-string',
	// Lyrics
	'LYRIC': 'sl-string',
	// Repeats
	'REPEAT_START': 'sl-keyword',
	'REPEAT_END': 'sl-keyword',
	'VOLTA': 'sl-keyword',
	// Misc
	'GRACE': 'sl-keyword',
	'COMMENT': 'sl-comment',
	'NEWLINE': '',
	'WHITESPACE': '',
	'EOF': '',
	'UNKNOWN': 'sl-error',
};

export interface HighlightedSpan {
	text: string;
	className: string;
	start: number;
	end: number;
}

export function highlightScore(source: string): HighlightedSpan[] {
	const { tokens } = tokenize(source);
	const spans: HighlightedSpan[] = [];
	let lastEnd = 0;

	for (const token of tokens) {
		// Fill gap with unstyled text
		if (token.start > lastEnd) {
			const gap = source.slice(lastEnd, token.start);
			if (gap) {
				spans.push({
					text: gap,
					className: '',
					start: lastEnd,
					end: token.start,
				});
			}
		}

		// Skip empty tokens
		if (token.type === 'EOF') continue;

		spans.push({
			text: token.value,
			className: TOKEN_CLASSES[token.type] || '',
			start: token.start,
			end: token.end,
		});

		lastEnd = token.end;
	}

	return spans;
}

// CSS variables for theming
export const HIGHLIGHT_CSS = `
.sl-keyword { color: var(--sl-keyword, #c678dd); }
.sl-function { color: var(--sl-function, #61afef); }
.sl-variable { color: var(--sl-variable, #e06c75); }
.sl-string { color: var(--sl-string, #98c379); }
.sl-number { color: var(--sl-number, #d19a66); }
.sl-constant { color: var(--sl-constant, #d19a66); }
.sl-constant-other { color: var(--sl-constant-other, #e5c07b); }
.sl-operator { color: var(--sl-operator, #56b6c2); }
.sl-punctuation { color: var(--sl-punctuation, #abb2bf); }
.sl-punctuation-annotation { color: var(--sl-punctuation-annotation, #c678dd); }
.sl-entity { color: var(--sl-entity, #e5c07b); }
.sl-comment { color: var(--sl-comment, #5c6370); font-style: italic; }
.sl-error { color: var(--sl-error, #f44747); text-decoration: wavy underline; }
`;

// Generate HTML from highlighted spans
export function highlightToHTML(source: string): string {
	const spans = highlightScore(source);
	return spans
		.map(span => {
			const escaped = span.text
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/\n/g, '<br>');
			if (span.className) {
				return `<span class="${span.className}">${escaped}</span>`;
			}
			return escaped;
		})
		.join('');
}

// ============ Score Parsing Utilities ============

export interface FrontmatterField {
	key: string;
	value: string;
	type: 'text' | 'number' | 'select' | 'time';
	options?: string[];
}

// Field type configurations for the UI
const FIELD_CONFIGS: Record<string, { type: FrontmatterField['type']; options?: string[] }> = {
	key: {
		type: 'select', options: ['C major', 'G major', 'D major', 'A major', 'E major', 'B major', 'F major', 'Bb major',
			'A minor', 'E minor', 'D minor', 'G minor', 'C minor', 'F minor']
	},
	clef: { type: 'select', options: ['treble', 'bass', 'alto', 'tenor'] },
	time: { type: 'time' },
	tempo: { type: 'number' },
};

/**
 * Split a score source into frontmatter and body parts
 */
export function splitScore(source: string): { frontmatter: string; body: string } {
	const lines = source.split('\n');
	let inFrontmatter = false;
	let frontmatterStart = -1;
	let frontmatterEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim() === '---') {
			if (!inFrontmatter) {
				inFrontmatter = true;
				frontmatterStart = i;
			} else {
				frontmatterEnd = i;
				break;
			}
		}
	}

	if (frontmatterStart >= 0 && frontmatterEnd > frontmatterStart) {
		const frontmatter = lines.slice(frontmatterStart + 1, frontmatterEnd).join('\n');
		const body = lines.slice(frontmatterEnd + 1).join('\n');
		return { frontmatter, body };
	}

	return { frontmatter: '', body: source };
}

/**
 * Parse frontmatter into structured fields
 */
export function parseFrontmatterFields(frontmatter: string): FrontmatterField[] {
	if (!frontmatter.trim()) return [];

	const fields: FrontmatterField[] = [];
	const lines = frontmatter.split('\n');
	let currentStave = '';

	for (const line of lines) {
		// Skip stave declarations like &right:
		if (line.trim().startsWith('&')) {
			currentStave = line.trim();
			continue;
		}

		// Parse key: value pairs
		const match = line.match(/^\s*(\w+):\s*(.*)$/);
		if (match) {
			const [, key, value] = match;
			const config = FIELD_CONFIGS[key] || { type: 'text' as const };
			fields.push({
				key: currentStave ? `${currentStave.slice(1, -1)}.${key}` : key,
				value: value.trim(),
				...config,
			});
		}
	}

	return fields;
}

/**
 * Serialize fields back to frontmatter string
 */
export function serializeFrontmatter(fields: FrontmatterField[]): string {
	const lines: string[] = [];
	const staveGroups: Record<string, FrontmatterField[]> = {};
	const globalFields: FrontmatterField[] = [];

	// Group fields by stave
	for (const field of fields) {
		if (field.key.includes('.')) {
			const [stave, key] = field.key.split('.');
			if (!staveGroups[stave]) staveGroups[stave] = [];
			staveGroups[stave].push({ ...field, key });
		} else {
			globalFields.push(field);
		}
	}

	// Output stave groups first
	for (const [stave, staveFields] of Object.entries(staveGroups)) {
		lines.push(`&${stave}:`);
		for (const field of staveFields) {
			lines.push(`  ${field.key}: ${field.value}`);
		}
	}

	// Output global fields
	for (const field of globalFields) {
		lines.push(`${field.key}: ${field.value}`);
	}

	return lines.join('\n');
}

