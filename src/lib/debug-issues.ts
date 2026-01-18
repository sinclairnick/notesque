// Debug script to diagnose Scorelang issues
import { tokenize } from './score-lexer';
import { parseScoreToAST } from './score-parser';
import { transpileToMusicXML } from './score-musicxml';

console.log('========================================');
console.log('DIAGNOSTIC: Scorelang Issues');
console.log('========================================\n');

// Test 1: Chords with parentheses (from user's new fixture)
console.log('--- TEST 1: Chords & Parentheses ---');
const chordTest = `---
&right:
  clef: treble
---
&right { [C E G]/2 [C E G]- [C E G]/4 [(C E)- G]/4 }
`;
const chordTokens = tokenize(chordTest);
console.log('Tokens:', chordTokens.tokens.filter(t => !['WHITESPACE', 'NEWLINE', 'EOF'].includes(t.type)).map(t => `${t.type}:${t.value}`));
const chordResult = parseScoreToAST(chordTest);
console.log('Parse errors:', chordResult.errors);
console.log('Staves:', chordResult.ast?.staves.length);
if (chordResult.ast?.staves[0]) {
	const staff = chordResult.ast.staves[0];
	console.log('Elements in first measure:', staff.measures[0]?.elements.map(e => e.kind));
}
console.log();

// Test 2: Beams
console.log('--- TEST 2: Beams ---');
const beamTest = `---
&main:
  clef: treble
---
&main { =(C D E F) G }
`;
const beamTokens = tokenize(beamTest);
console.log('Tokens:', beamTokens.tokens.filter(t => !['WHITESPACE', 'NEWLINE', 'EOF'].includes(t.type)).map(t => `${t.type}:${t.value}`));
const beamResult = parseScoreToAST(beamTest);
console.log('Parse errors:', beamResult.errors);
console.log('Elements:', beamResult.ast?.staves[0]?.measures[0]?.elements.map(e => ({ kind: e.kind, beamed: (e as any).beamed })));
console.log();

// Test 3: Crescendo annotation
console.log('--- TEST 3: Crescendo Annotation ---');
const crescTest = `---
&main:
  clef: treble
---
&main { C D E F } { cresc(1-4) }
`;
const crescResult = parseScoreToAST(crescTest);
console.log('Parse errors:', crescResult.errors);
const crescElements = crescResult.ast?.staves[0]?.measures[0]?.elements || [];
console.log('Elements with annotations:');
crescElements.forEach((e, i) => {
	if (e.kind === 'Note') {
		console.log(`  [${i}] ${e.pitch.note} - cresc: ${e.annotation?.crescendo}, decresc: ${e.annotation?.decrescendo}`);
	}
});

const crescXml = transpileToMusicXML(crescResult.ast!);
console.log('XML has wedge crescendo:', crescXml.includes('<wedge type="crescendo"/>'));
console.log('XML has wedge stop:', crescXml.includes('<wedge type="stop"/>'));
console.log();

// Test 4: Note spacing/delimiting
console.log('--- TEST 4: Note Delimiting ---');
const noSpaceTest = `---
&main:
  clef: treble
---
&main { CD EF }
`;
const noSpaceTokens = tokenize(noSpaceTest);
console.log('Tokens (no spaces between notes):', noSpaceTokens.tokens.filter(t => !['WHITESPACE', 'NEWLINE', 'EOF'].includes(t.type)).map(t => `${t.type}:${t.value}`));

const spacedTest = `---
&main:
  clef: treble
---
&main { C D E F }
`;
const spacedTokens = tokenize(spacedTest);
console.log('Tokens (with spaces):', spacedTokens.tokens.filter(t => !['WHITESPACE', 'NEWLINE', 'EOF'].includes(t.type)).map(t => `${t.type}:${t.value}`));
console.log();

// Test 5: Slurs via annotation block
console.log('--- TEST 5: Slurs via Annotation Block ---');
const slurTest = `---
&main:
  clef: treble
---
&main { C D E F } { slur(1-4) }
`;
const slurResult = parseScoreToAST(slurTest);
console.log('Parse errors:', slurResult.errors);
const slurElements = slurResult.ast?.staves[0]?.measures[0]?.elements || [];
console.log('Elements with slur annotations:');
slurElements.forEach((e, i) => {
	if (e.kind === 'Note') {
		console.log(`  [${i}] ${e.pitch.note} - slurStart: ${e.annotation?.slurStart}, slurEnd: ${e.annotation?.slurEnd}`);
	}
});
console.log();

// Test 6: Inline dynamic function
console.log('--- TEST 6: Inline Dynamic Function ---');
const dynamicTest = `---
&main:
  clef: treble
---
&main { p(C D E) f(F) }
`;
const dynamicResult = parseScoreToAST(dynamicTest);
console.log('Parse errors:', dynamicResult.errors);
console.log('Elements:', dynamicResult.ast?.staves[0]?.measures.flatMap(m => m.elements).map(e => {
	if (e.kind === 'Note') return `${e.pitch.note}:${e.annotation?.dynamic || 'none'}`;
	return e.kind;
}));
