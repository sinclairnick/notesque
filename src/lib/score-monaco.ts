import type { Monaco } from '@monaco-editor/react';
import { validateScore } from './score-validator';
import { formatScore } from './score-formatter';
import { parseScoreToAST } from './score-parser';

export const SCORE_LANG_ID = 'scorelang';

export function registerScoreLanguage(monaco: Monaco) {
	// Register the language
	monaco.languages.register({ id: SCORE_LANG_ID });

	// Define tokens for syntax highlighting
	monaco.languages.setMonarchTokensProvider(SCORE_LANG_ID, {
		tokenizer: {
			root: [
				// Context Block
				[/^---\s*$/, { token: 'punctuation', next: '@frontmatter' }],

				// Stave Declaration
				[/&[a-zA-Z0-9+]+/, 'tag'],

				// Braces
				[/\{/, 'delimiter.curly', '@body'],

				// Comments
				[/\/\/.*$/, 'comment'],
				[/\/\*/, 'comment', '@comment_block'],
			],

			frontmatter: [
				[/^---\s*$/, { token: 'punctuation', next: '@pop' }],
				[/\/\/.*$/, 'comment'],
				[/\/\*/, 'comment', '@comment_block'],
				[/&[a-zA-Z0-9+]+(?=:)/, 'tag'], // Stave declaration as key
				[/[a-zA-Z0-9_-]+(?=:)/, 'keyword'], // YAML keys
				[/[:\-,?\[\]\{\}]/, 'punctuation'], // YAML punctuation
				[/[ \t\r\n]+/, 'white'],
				[/".*?"/, 'string'],
				[/'.*?'/, 'string'],
				[/[^---#\s][^---#]*/, 'string'], // YAML values
			],

			body: [
				[/\}/, 'delimiter.curly', '@pop'],

				// Notes and Rests
				[/[A-G][#b]{0,2}\d?/, 'variable'], // Pitch
				[/_/, 'constant'], // Rest
				[/\/(32|16|8|4|2|1)\.?\.?/, 'number'], // Duration
				[/@[1-5]/, 'constant.other'], // Fingering
				[/[\+\-]{1,2}/, 'operator'], // Octave modifiers

				// Chords
				[/\[/, 'delimiter.square', '@chord'],

				// Functions
				[/[a-zA-Z]+\(/, { token: 'function', next: '@function_args' }],

				// Connectives
				[/[\^~]/, 'operator'],

				// Comments
				[/\/\/.*$/, 'comment'],
				[/\/\*/, 'comment', '@comment_block'],
			],

			chord: [
				[/\]/, 'delimiter.square', '@pop'],
				[/[A-G][#b]{0,2}\d?/, 'variable'],
			],

			function_args: [
				[/\)/, { token: 'function', next: '@pop' }],
				[/\d+-\d+/, 'number'],
				[/\d+/, 'number'],
				[/".*?"/, 'string'],
				[/,/, 'punctuation'],
				// Nested notes or functions might need recursion, but let's keep it simple for now
				[/[A-G][#b]{0,2}\d?/, 'variable'],
				[/_/, 'constant'],
				[/\/(32|16|8|4|2|1)\.?\.?/, 'number'],
			],

			comment_block: [
				[/\*\//, 'comment', '@pop'],
				[/./, 'comment'],
			],
		},
	});

	// Set language configuration (brackets, comments)
	monaco.languages.setLanguageConfiguration(SCORE_LANG_ID, {
		comments: {
			lineComment: '//',
			blockComment: ['/*', '*/'],
		},
		brackets: [
			['{', '}'],
			['[', ']'],
			['(', ')'],
		],
		autoClosingPairs: [
			{ open: '{', close: '}' },
			{ open: '[', close: ']' },
			{ open: '(', close: ')' },
			{ open: '"', close: '"' },
		],
	});

	monaco.languages.registerDocumentFormattingEditProvider(SCORE_LANG_ID, {
		provideDocumentFormattingEdits(model: any) {
			const source = model.getValue();
			try {
				const formatted = formatScore(source);
				return [
					{
						range: model.getFullModelRange(),
						text: formatted,
					},
				];
			} catch (e) {
				console.error('Monaco formatting error:', e);
				return [];
			}
		},
	});
}

/**
 * Run validator and return Monaco markers
 */
export function validate(source: string) {
	const { ast, errors: parseErrors } = parseScoreToAST(source);

	const markers: any[] = [];

	// Add parser errors
	for (const err of parseErrors) {
		markers.push({
			severity: 8, // Error
			message: err.message,
			startLineNumber: err.line,
			startColumn: err.column,
			endLineNumber: err.line,
			endColumn: err.column + 1,
		});
	}

	// Add validator errors if we have an AST
	if (ast) {
		const validationResult = validateScore(ast);
		for (const diag of validationResult.diagnostics) {
			markers.push({
				severity: diag.severity === 'error' ? 8 : 4, // 8 = Error, 4 = Warning
				message: diag.message,
				startLineNumber: diag.line,
				startColumn: diag.column,
				endLineNumber: diag.line,
				endColumn: diag.column + 5,
			});
		}
	}

	return markers;
}
