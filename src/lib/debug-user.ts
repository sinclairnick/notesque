import { parseScoreToAST } from './score-parser';
import { transpileToMusicXML } from './score-musicxml';

const source = `---
title: Untitled
key: C major
time: 4/4
tempo: 120
&right:
  clef: treble
&left:
  clef: bass
---
&right { C D E F G A B C+ }
&left { C D E F G A B C+ }`;

const { ast, errors } = parseScoreToAST(source);
if (ast) {
	const xml = transpileToMusicXML(ast);
	console.log(xml);
}
