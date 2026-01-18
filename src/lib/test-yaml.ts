import { load } from 'js-yaml';

function sanitize(value: string): string {
	return value.replace(/^(\s*)&([a-zA-Z0-9+]+):/gm, '$1"&$2":');
}

const input = `title: Untitled
key: C major
time: 4/4
tempo: 120
&right:
  clef: treble
&left:
  clef: bass`;

const sanitized = sanitize(input);
console.log('Sanitized Input:\n', sanitized);

const doc = load(sanitized) as any;
console.log('\nParsed Doc:', doc);
console.log('\nKeys starting with &:');
for (const key of Object.keys(doc)) {
	if (key.startsWith('&')) {
		console.log(`- ${key}:`, doc[key]);
	}
}
