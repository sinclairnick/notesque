// Scorelang v2.0 Comprehensive Lexer Tests

import { describe, it, expect } from 'vitest';
import { tokenize, type Token, type TokenType } from '../score-lexer';

// Helper to extract token types (filtering whitespace/newlines)
function getTokenTypes(source: string): TokenType[] {
	const { tokens } = tokenize(source);
	return tokens
		.filter(t => !['WHITESPACE', 'NEWLINE', 'EOF'].includes(t.type))
		.map(t => t.type);
}

// Helper to get tokens with values
function getTokens(source: string): Array<{ type: TokenType; value: string }> {
	const { tokens } = tokenize(source);
	return tokens
		.filter(t => !['WHITESPACE', 'NEWLINE', 'EOF'].includes(t.type))
		.map(t => ({ type: t.type, value: t.value }));
}

// =============================================================================
// CONTEXT BLOCKS
// =============================================================================

describe('Lexer: Context Blocks', () => {
	it('tokenizes context delimiters', () => {
		const types = getTokenTypes('---\ntempo: 120\n---');
		expect(types).toContain('CONTEXT_DELIM');
		expect(types.filter(t => t === 'CONTEXT_DELIM')).toHaveLength(2);
	});

	it('tokenizes context key-value pairs', () => {
		const tokens = getTokens('---\ntempo: 120\nkey: C\n---');
		expect(tokens).toContainEqual({ type: 'CONTEXT_KEY', value: 'tempo' });
		expect(tokens).toContainEqual({ type: 'CONTEXT_VALUE', value: '120' });
		expect(tokens).toContainEqual({ type: 'CONTEXT_KEY', value: 'key' });
		expect(tokens).toContainEqual({ type: 'CONTEXT_VALUE', value: 'C' });
	});

	it('tokenizes stave declarations with &', () => {
		const tokens = getTokens('---\n&right:\n  clef: treble\n---');
		expect(tokens).toContainEqual({ type: 'STAVE_DECL', value: '&right' });
	});

	it('tokenizes stave declarations with voice (+)', () => {
		const tokens = getTokens('---\n&right+alto:\n  clef: treble\n---');
		expect(tokens).toContainEqual({ type: 'STAVE_DECL', value: '&right+alto' });
	});

	it('handles multiple context blocks', () => {
		const types = getTokenTypes('---\ntempo: 100\n---\n---\ntempo: 120\n---');
		expect(types.filter(t => t === 'CONTEXT_DELIM')).toHaveLength(4);
	});

	it('handles context with time signature', () => {
		const tokens = getTokens('---\ntime: 3/4\n---');
		expect(tokens).toContainEqual({ type: 'CONTEXT_VALUE', value: '3/4' });
	});

	it('handles quoted context values', () => {
		const tokens = getTokens('---\ntitle: "My Song"\n---');
		expect(tokens).toContainEqual({ type: 'CONTEXT_VALUE', value: '"My Song"' });
	});
});

// =============================================================================
// NOTES - Basic
// =============================================================================

describe('Lexer: Notes - Basic', () => {
	it('tokenizes all note letters', () => {
		const tokens = getTokens('A B C D E F G');
		expect(tokens).toHaveLength(7);
		expect(tokens.every(t => t.type === 'NOTE')).toBe(true);
	});

	it('tokenizes notes without whitespace around stave blocks', () => {
		const tokens = getTokens('&right{C D E}');
		expect(tokens.filter(t => t.type === 'NOTE')).toHaveLength(3);
	});
});

// =============================================================================
// NOTES - Accidentals
// =============================================================================

describe('Lexer: Notes - Accidentals', () => {
	it('tokenizes single sharp', () => {
		const tokens = getTokens('C#');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C#' });
	});

	it('tokenizes double sharp', () => {
		const tokens = getTokens('F##');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'F##' });
	});

	it('tokenizes single flat', () => {
		const tokens = getTokens('Bb');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'Bb' });
	});

	it('tokenizes double flat', () => {
		const tokens = getTokens('Ebb');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'Ebb' });
	});
});

// =============================================================================
// NOTES - Octaves
// =============================================================================

describe('Lexer: Notes - Octaves', () => {
	it('tokenizes notes with octave numbers', () => {
		const tokens = getTokens('C4 A5 G3 B0 D8');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C4' });
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'A5' });
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'G3' });
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'B0' });
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'D8' });
	});

	it('tokenizes octave up modifier (+)', () => {
		const tokens = getTokens('C+');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C' });
		expect(tokens).toContainEqual({ type: 'OCTAVE_MOD', value: '+' });
	});

	it('tokenizes double octave up modifier (++)', () => {
		const tokens = getTokens('C++');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C' });
		expect(tokens).toContainEqual({ type: 'OCTAVE_MOD', value: '++' });
	});

	it('tokenizes octave down modifier (-)', () => {
		const tokens = getTokens('C-');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C' });
		expect(tokens).toContainEqual({ type: 'OCTAVE_MOD', value: '-' });
	});

	it('tokenizes double octave down modifier (--)', () => {
		const tokens = getTokens('C--');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C' });
		expect(tokens).toContainEqual({ type: 'OCTAVE_MOD', value: '--' });
	});

	it('tokenizes accidental with octave number', () => {
		const tokens = getTokens('C#4 Bb5');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C#4' });
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'Bb5' });
	});
});

// =============================================================================
// DURATIONS
// =============================================================================

describe('Lexer: Durations', () => {
	it('tokenizes whole note', () => {
		const tokens = getTokens('C/1');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/1' });
	});

	it('tokenizes half note', () => {
		const tokens = getTokens('C/2');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/2' });
	});

	it('tokenizes quarter note', () => {
		const tokens = getTokens('C/4');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/4' });
	});

	it('tokenizes eighth note', () => {
		const tokens = getTokens('C/8');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/8' });
	});

	it('tokenizes sixteenth note', () => {
		const tokens = getTokens('C/16');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/16' });
	});

	it('tokenizes thirty-second note', () => {
		const tokens = getTokens('C/32');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/32' });
	});

	it('tokenizes dotted quarter', () => {
		const tokens = getTokens('C/4.');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/4.' });
	});

	it('tokenizes double-dotted half', () => {
		const tokens = getTokens('C/2..');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/2..' });
	});

	it('tokenizes standalone dot shorthand', () => {
		const tokens = getTokens('C.');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '.' });
	});
});

// =============================================================================
// NOTE COMBINATIONS
// =============================================================================

describe('Lexer: Note Combinations', () => {
	it('tokenizes note + accidental + octave + duration', () => {
		const tokens = getTokens('C#4/8');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C#4' });
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/8' });
	});

	it('tokenizes note + octave modifier + duration', () => {
		const tokens = getTokens('C+/8');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C' });
		expect(tokens).toContainEqual({ type: 'OCTAVE_MOD', value: '+' });
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/8' });
	});

	it('tokenizes note + accidental + octave modifier + duration', () => {
		const tokens = getTokens('C#++/4');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C#' });
		expect(tokens).toContainEqual({ type: 'OCTAVE_MOD', value: '++' });
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/4' });
	});

	it('tokenizes note + duration + fingering', () => {
		const tokens = getTokens('C/8@3');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C' });
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/8' });
		expect(tokens).toContainEqual({ type: 'FINGERING', value: '@3' });
	});

	it('tokenizes full note: accidental + octave + duration + fingering', () => {
		const tokens = getTokens('C#4/8@1');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C#4' });
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/8' });
		expect(tokens).toContainEqual({ type: 'FINGERING', value: '@1' });
	});
});

// =============================================================================
// RESTS
// =============================================================================

describe('Lexer: Rests', () => {
	it('tokenizes simple rest', () => {
		const tokens = getTokens('_');
		expect(tokens).toContainEqual({ type: 'REST', value: '_' });
	});

	it('tokenizes rest with duration', () => {
		const tokens = getTokens('_/2');
		expect(tokens).toContainEqual({ type: 'REST', value: '_' });
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/2' });
	});

	it('tokenizes rest between notes', () => {
		const tokens = getTokens('C _ D');
		expect(tokens[0]).toEqual({ type: 'NOTE', value: 'C' });
		expect(tokens[1]).toEqual({ type: 'REST', value: '_' });
		expect(tokens[2]).toEqual({ type: 'NOTE', value: 'D' });
	});
});

// =============================================================================
// CHORDS
// =============================================================================

describe('Lexer: Chords', () => {
	it('tokenizes chord brackets', () => {
		const types = getTokenTypes('[C E G]');
		expect(types).toContain('CHORD_START');
		expect(types).toContain('CHORD_END');
	});

	it('tokenizes chord with notes', () => {
		const tokens = getTokens('[C E G]');
		expect(tokens.filter(t => t.type === 'NOTE')).toHaveLength(3);
	});

	it('tokenizes chord with duration', () => {
		const tokens = getTokens('[C E G]/2');
		expect(tokens).toContainEqual({ type: 'DURATION', value: '/2' });
	});

	it('tokenizes chord with accidentals', () => {
		const tokens = getTokens('[C# Eb G]');
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'C#' });
		expect(tokens).toContainEqual({ type: 'NOTE', value: 'Eb' });
	});
});

// =============================================================================
// STAVE BLOCKS
// =============================================================================

describe('Lexer: Stave Blocks', () => {
	it('tokenizes stave body', () => {
		const types = getTokenTypes('&right{ C D E }');
		expect(types).toContain('STAVE_DECL');
		expect(types).toContain('STAVE_BODY_START');
		expect(types).toContain('STAVE_BODY_END');
	});

	it('tokenizes stave with voice', () => {
		const tokens = getTokens('&right+alto{ C D }');
		expect(tokens).toContainEqual({ type: 'STAVE_DECL', value: '&right+alto' });
	});

	it('tokenizes multiple stave blocks', () => {
		const tokens = getTokens('&right{ C D } &left{ E F }');
		expect(tokens.filter(t => t.type === 'STAVE_DECL')).toHaveLength(2);
	});
});

// =============================================================================
// CONNECTIVES
// =============================================================================

describe('Lexer: Connectives', () => {
	it('tokenizes slur between notes', () => {
		const tokens = getTokens('C~D~E');
		expect(tokens.filter(t => t.type === 'SLUR')).toHaveLength(2);
	});

	it('tokenizes tie between notes', () => {
		const tokens = getTokens('C^C');
		expect(tokens).toContainEqual({ type: 'TIE', value: '^' });
	});

	it('preserves note order with connectives', () => {
		const tokens = getTokens('A~B~C');
		expect(tokens[0]).toEqual({ type: 'NOTE', value: 'A' });
		expect(tokens[1]).toEqual({ type: 'SLUR', value: '~' });
		expect(tokens[2]).toEqual({ type: 'NOTE', value: 'B' });
		expect(tokens[3]).toEqual({ type: 'SLUR', value: '~' });
		expect(tokens[4]).toEqual({ type: 'NOTE', value: 'C' });
	});
});

// =============================================================================
// FUNCTIONS
// =============================================================================

describe('Lexer: Functions', () => {
	it('tokenizes dynamics', () => {
		const tokens = getTokens('p(C D)');
		expect(tokens).toContainEqual({ type: 'FUNCTION', value: 'p' });
	});

	it('tokenizes all dynamic levels', () => {
		const funcs = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];
		for (const fn of funcs) {
			const tokens = getTokens(`${fn}(C)`);
			expect(tokens).toContainEqual({ type: 'FUNCTION', value: fn });
		}
	});

	it('tokenizes articulations', () => {
		const funcs = ['st', 'tn', 'ac', 'mc', 'fm', 'tr'];
		for (const fn of funcs) {
			const tokens = getTokens(`${fn}(C)`);
			expect(tokens).toContainEqual({ type: 'FUNCTION', value: fn });
		}
	});

	it('tokenizes crescendo', () => {
		const tokens = getTokens('cresc(C D E)');
		expect(tokens).toContainEqual({ type: 'FUNCTION', value: 'cresc' });
	});

	it('tokenizes nested parentheses properly', () => {
		const tokens = getTokens('p(C D) f(E F)');
		expect(tokens.filter(t => t.type === 'FUNCTION')).toHaveLength(2);
	});
});

// =============================================================================
// COMMENTS
// =============================================================================

describe('Lexer: Comments', () => {
	it('tokenizes single-line comment', () => {
		const tokens = getTokens('C D // comment\nE');
		expect(tokens.some(t => t.type === 'COMMENT')).toBe(true);
	});

	it('captures full comment content', () => {
		const tokens = getTokens('// this is a comment');
		const comment = tokens.find(t => t.type === 'COMMENT');
		expect(comment?.value).toContain('this is a comment');
	});

	it('tokenizes multi-line comment', () => {
		const tokens = getTokens('/* multi\nline */ C D');
		expect(tokens.some(t => t.type === 'COMMENT')).toBe(true);
	});

	it('captures multi-line comment content', () => {
		const tokens = getTokens('/* first\nsecond */');
		const comment = tokens.find(t => t.type === 'COMMENT');
		expect(comment?.value).toContain('first');
		expect(comment?.value).toContain('second');
	});

	it('handles comment in stave body', () => {
		const tokens = getTokens('&right{ C // comment\nD }');
		expect(tokens.some(t => t.type === 'COMMENT')).toBe(true);
		expect(tokens.filter(t => t.type === 'NOTE')).toHaveLength(2);
	});
});

// =============================================================================
// GRACE NOTES
// =============================================================================

describe('Lexer: Grace Notes', () => {
	it('tokenizes acciaccatura (single backtick)', () => {
		const tokens = getTokens('`G C');
		expect(tokens).toContainEqual({ type: 'GRACE', value: '`' });
	});

	it('tokenizes appoggiatura (double backtick)', () => {
		const tokens = getTokens('``D E');
		expect(tokens).toContainEqual({ type: 'GRACE', value: '``' });
	});

	it('grace note followed by main note', () => {
		const tokens = getTokens('`G C');
		expect(tokens[0]).toEqual({ type: 'GRACE', value: '`' });
		expect(tokens[1]).toEqual({ type: 'NOTE', value: 'G' });
		expect(tokens[2]).toEqual({ type: 'NOTE', value: 'C' });
	});
});

// =============================================================================
// BEAMING
// =============================================================================

describe('Lexer: Beaming', () => {
	it('tokenizes beam start', () => {
		const tokens = getTokens('=(C D E F)');
		expect(tokens).toContainEqual({ type: 'BEAM_START', value: '=(' });
		expect(tokens).toContainEqual({ type: 'PAREN_CLOSE', value: ')' });
	});

	it('tokenizes notes inside beam', () => {
		const tokens = getTokens('=(C D E F)');
		expect(tokens.filter(t => t.type === 'NOTE')).toHaveLength(4);
	});
});

// =============================================================================
// FINGERINGS
// =============================================================================

describe('Lexer: Fingerings', () => {
	it('tokenizes fingerings 1-5', () => {
		for (let i = 1; i <= 5; i++) {
			const tokens = getTokens(`C@${i}`);
			expect(tokens).toContainEqual({ type: 'FINGERING', value: `@${i}` });
		}
	});

	it('fingering after note', () => {
		const tokens = getTokens('C@1 E@3');
		expect(tokens[0]).toEqual({ type: 'NOTE', value: 'C' });
		expect(tokens[1]).toEqual({ type: 'FINGERING', value: '@1' });
	});
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Lexer: Edge Cases', () => {
	it('handles empty source', () => {
		const { tokens, errors } = tokenize('');
		expect(errors).toHaveLength(0);
		expect(tokens).toContainEqual(expect.objectContaining({ type: 'EOF' }));
	});

	it('handles only whitespace', () => {
		const tokens = getTokens('   \n\t  ');
		expect(tokens).toHaveLength(0); // Filtered out
	});

	it('handles only context block', () => {
		const tokens = getTokens('---\ntempo: 120\n---');
		expect(tokens.some(t => t.type === 'CONTEXT_DELIM')).toBe(true);
	});

	it('handles consecutive stave declarations', () => {
		const tokens = getTokens('&right{ C } &left{ D } &right{ E }');
		expect(tokens.filter(t => t.type === 'STAVE_DECL')).toHaveLength(3);
	});

	it('handles complex nested structure', () => {
		const source = `---
&right:
  clef: treble
---
&right{ p(C~D~E/8) [F A C]/2@1 }`;
		const { tokens, errors } = tokenize(source);
		expect(errors).toHaveLength(0);
		expect(tokens.filter(t => t.type === 'NOTE').length).toBeGreaterThan(0);
	});
});

// =============================================================================
// ANNOTATION BLOCKS
// =============================================================================

describe('Lexer: Annotation Blocks', () => {
	it('tokenizes annotation block markers', () => {
		const tokens = getTokens('&right{ C D } { cresc(1-4) }');
		expect(tokens).toContainEqual({ type: 'STAVE_BODY_START', value: '{' });
		expect(tokens).toContainEqual({ type: 'STAVE_BODY_END', value: '}' });
		expect(tokens).toContainEqual({ type: 'ANNOTATION_BLOCK_START', value: '{' });
		expect(tokens).toContainEqual({ type: 'ANNOTATION_BLOCK_END', value: '}' });
	});

	it('tokenizes range in annotation block', () => {
		const tokens = getTokens('&right{ C D } { cresc(1-4) }');
		expect(tokens).toContainEqual({ type: 'RANGE', value: '1-4' });
	});

	it('tokenizes multiple ranges', () => {
		const tokens = getTokens('&right{ C D E F } { p(1-2) f(3-4) }');
		expect(tokens).toContainEqual({ type: 'RANGE', value: '1-2' });
		expect(tokens).toContainEqual({ type: 'RANGE', value: '3-4' });
	});

	it('tokenizes string in annotation block', () => {
		const tokens = getTokens('&right{ C D } { text(1, "rit.") }');
		expect(tokens).toContainEqual({ type: 'STRING', value: '"rit."' });
	});

	it('tokenizes comma in annotation arguments', () => {
		const tokens = getTokens('&right{ C D } { finger(1, 3) }');
		expect(tokens).toContainEqual({ type: 'COMMA', value: ',' });
	});

	it('tokenizes number in annotation arguments', () => {
		const tokens = getTokens('&right{ C D } { dur(1-4, 8) }');
		expect(tokens).toContainEqual({ type: 'NUMBER', value: '8' });
	});

	it('tokenizes complex annotation block', () => {
		const tokens = getTokens('&right{ C D E F G } { cresc(1-4) text(5, "ff") }');
		expect(tokens.filter(t => t.type === 'FUNCTION')).toHaveLength(2);
		expect(tokens).toContainEqual({ type: 'RANGE', value: '1-4' });
		expect(tokens).toContainEqual({ type: 'STRING', value: '"ff"' });
	});
});

