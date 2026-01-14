// Score Notation Language Parser
// Converts .score text to ParsedScore object

import type {
	ParsedScore,
	ParseResult,
	ParseError,
	ScoreMetadata,
	ScoreStaff,
	ScoreMeasure,
	ScoreElement,
	Pitch,
	Duration,
	DurationToken,
	NoteName,
	Accidental,
	Octave,
	Annotation,
	Dynamic,
	Articulation,
	ClefType,
} from './score-types';

// Frontmatter regex
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

// Note regex: matches C, C4, C#, C#4, Cb5, etc.
const NOTE_REGEX = /([A-Ga-g])(#{1,2}|b{1,2})?(\d)?/;

// Duration suffix regex
const DURATION_REGEX = /\.(w|h|q|8|16|32)(\.{0,2})?/;

// Annotation regex: {ff}, {.}, {1}, {"text"}, {ff, .}
const ANNOTATION_REGEX = /\{([^}]+)\}/;

// Dynamic values
const DYNAMICS: Set<string> = new Set(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sfz']);

// Articulation map
const ARTICULATION_MAP: Record<string, Articulation> = {
	'.': 'staccato',
	'-': 'tenuto',
	'>': 'accent',
	'^': 'marcato',
	'u': 'fermata',
	'tr': 'trill',
	'~': 'turn',
	'm': 'mordent',
};

/**
 * Parse YAML-like frontmatter (simple key: value parsing)
 */
function parseFrontmatter(content: string): { metadata: Partial<ScoreMetadata>; staves: Array<{ name: string; clef: ClefType }> } {
	const lines = content.split('\n');
	const metadata: Partial<ScoreMetadata> = {};
	const staves: Array<{ name: string; clef: ClefType }> = [];

	let inStaves = false;
	let currentStaff: { name?: string; clef?: ClefType } = {};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Check for staves array
		if (trimmed === 'staves:') {
			inStaves = true;
			continue;
		}

		if (inStaves) {
			// Staff array item
			if (trimmed.startsWith('- name:')) {
				if (currentStaff.name && currentStaff.clef) {
					staves.push(currentStaff as { name: string; clef: ClefType });
				}
				currentStaff = { name: trimmed.replace('- name:', '').trim() };
			} else if (trimmed.startsWith('name:')) {
				currentStaff.name = trimmed.replace('name:', '').trim();
			} else if (trimmed.startsWith('clef:')) {
				currentStaff.clef = trimmed.replace('clef:', '').trim() as ClefType;
			} else if (!trimmed.startsWith('-') && trimmed.includes(':') && !trimmed.startsWith(' ')) {
				// End of staves section
				if (currentStaff.name && currentStaff.clef) {
					staves.push(currentStaff as { name: string; clef: ClefType });
				}
				inStaves = false;
			}
		}

		if (!inStaves) {
			// Simple key: value parsing
			const colonIndex = trimmed.indexOf(':');
			if (colonIndex > 0) {
				const key = trimmed.slice(0, colonIndex).trim();
				const value = trimmed.slice(colonIndex + 1).trim();

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
						const [beats, beatType] = value.split('/').map(Number);
						metadata.time = { beats, beatType };
						break;
					case 'tempo':
						metadata.tempo = parseInt(value);
						break;
					case 'octave':
						metadata.defaultOctave = parseInt(value) as Octave;
						break;
				}
			}
		}
	}

	// Don't forget last staff
	if (currentStaff.name && currentStaff.clef) {
		staves.push(currentStaff as { name: string; clef: ClefType });
	}

	return { metadata, staves };
}

/**
 * Parse a single pitch (e.g., "C#4", "Eb", "g")
 */
function parsePitch(token: string, defaultOctave: Octave): Pitch | null {
	const match = token.match(NOTE_REGEX);
	if (!match) return null;

	const [, letter, accidental = '', octaveStr] = match;
	const noteName = letter.toUpperCase() as NoteName;

	// Lowercase letters are octave 5, uppercase are octave 4 (unless specified)
	let octave: Octave;
	if (octaveStr) {
		octave = parseInt(octaveStr) as Octave;
	} else if (letter === letter.toLowerCase()) {
		octave = (defaultOctave + 1) as Octave;
	} else {
		octave = defaultOctave;
	}

	return {
		note: noteName,
		accidental: accidental as Accidental,
		octave,
	};
}

/**
 * Parse duration suffix (e.g., ".h", ".8..")
 */
function parseDuration(token: string, defaultDuration: DurationToken): Duration {
	const match = token.match(DURATION_REGEX);
	if (!match) {
		return { base: defaultDuration, dots: 0 };
	}

	const [, base, dots = ''] = match;
	return {
		base: base as DurationToken,
		dots: dots.length,
	};
}

/**
 * Parse annotation block (e.g., "{ff}", "{., 2}")
 */
function parseAnnotation(token: string): Annotation | undefined {
	const match = token.match(ANNOTATION_REGEX);
	if (!match) return undefined;

	const content = match[1];
	const parts = content.split(',').map(p => p.trim());

	const annotation: Annotation = {};

	for (const part of parts) {
		// Check for quoted text
		if (part.startsWith('"') && part.endsWith('"')) {
			annotation.text = part.slice(1, -1);
			continue;
		}

		// Check for dynamics
		if (DYNAMICS.has(part.toLowerCase())) {
			annotation.dynamic = part.toLowerCase() as Dynamic;
			continue;
		}

		// Check for fingering (single digit)
		if (/^[1-5]$/.test(part)) {
			annotation.fingering = parseInt(part);
			continue;
		}

		// Check for crescendo/decrescendo
		if (part === '<' || part === 'cresc') {
			annotation.crescendo = 'start';
			continue;
		}
		if (part === '>' && !annotation.articulations?.includes('accent')) {
			annotation.decrescendo = 'start';
			continue;
		}

		// Check for articulations
		if (ARTICULATION_MAP[part]) {
			if (!annotation.articulations) annotation.articulations = [];
			annotation.articulations.push(ARTICULATION_MAP[part]);
		}
	}

	return Object.keys(annotation).length > 0 ? annotation : undefined;
}

/**
 * Parse a single music token (note, rest, or chord)
 */
function parseToken(token: string, defaultOctave: Octave, defaultDuration: DurationToken): ScoreElement | null {
	token = token.trim();
	if (!token) return null;

	// Rest
	if (token.startsWith('_')) {
		const duration = parseDuration(token, defaultDuration);
		return { type: 'rest', duration };
	}

	// Chord [C E G]
	if (token.startsWith('[')) {
		const chordMatch = token.match(/\[([^\]]+)\]/);
		if (!chordMatch) return null;

		const noteTokens = chordMatch[1].trim().split(/\s+/);
		const pitches: Pitch[] = [];

		for (const noteToken of noteTokens) {
			const pitch = parsePitch(noteToken, defaultOctave);
			if (pitch) pitches.push(pitch);
		}

		if (pitches.length === 0) return null;

		const remainder = token.slice(chordMatch[0].length);
		const duration = parseDuration(remainder, defaultDuration);
		const annotation = parseAnnotation(remainder);

		return { type: 'chord', pitches, duration, annotation };
	}

	// Single note
	const pitch = parsePitch(token, defaultOctave);
	if (!pitch) return null;

	const duration = parseDuration(token, defaultDuration);
	const tied = token.includes('~');
	const annotation = parseAnnotation(token);

	return { type: 'note', pitch, duration, tied, annotation };
}

/**
 * Parse a measure content (between | bars)
 */
function parseMeasure(content: string, defaultOctave: Octave, defaultDuration: DurationToken): ScoreMeasure {
	const elements: ScoreElement[] = [];

	// Split by whitespace, preserving brackets for chords
	const tokens: string[] = [];
	let current = '';
	let inBracket = false;

	for (const char of content) {
		if (char === '[') {
			inBracket = true;
			current += char;
		} else if (char === ']') {
			inBracket = false;
			current += char;
		} else if (/\s/.test(char) && !inBracket) {
			if (current) tokens.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	if (current) tokens.push(current);

	for (const token of tokens) {
		const element = parseToken(token, defaultOctave, defaultDuration);
		if (element) elements.push(element);
	}

	return { elements, barline: 'single' };
}

/**
 * Parse a line of music content
 */
function parseMusicLine(line: string, defaultOctave: Octave, defaultDuration: DurationToken): ScoreMeasure[] {
	const measures: ScoreMeasure[] = [];

	// Extract staff prefix if present (e.g., "right: | C D E |")
	let content = line;
	const prefixMatch = line.match(/^(\w+):\s*/);
	if (prefixMatch) {
		content = line.slice(prefixMatch[0].length);
	}

	// Split by bar lines
	const parts = content.split(/\|+/).filter(p => p.trim());

	for (const part of parts) {
		const measure = parseMeasure(part, defaultOctave, defaultDuration);
		if (measure.elements.length > 0) {
			measures.push(measure);
		}
	}

	return measures;
}

/**
 * Main parser function
 */
export function parseScore(source: string): ParseResult {
	const errors: ParseError[] = [];
	const warnings: ParseError[] = [];

	// Extract frontmatter
	const frontmatterMatch = source.match(FRONTMATTER_REGEX);
	if (!frontmatterMatch) {
		errors.push({ line: 1, column: 1, message: 'Missing frontmatter (--- ... ---)' });
		return { score: null, errors, warnings };
	}

	const frontmatterContent = frontmatterMatch[1];
	const { metadata, staves: declaredStaves } = parseFrontmatter(frontmatterContent);

	// Set defaults
	const defaultMetadata: ScoreMetadata = {
		title: metadata.title || 'Untitled',
		composer: metadata.composer,
		key: metadata.key || 'C major',
		time: metadata.time || { beats: 4, beatType: 4 },
		tempo: metadata.tempo || 120,
		defaultOctave: metadata.defaultOctave || 4,
	};

	// Get music body (after frontmatter)
	const bodyStart = frontmatterMatch[0].length;
	const body = source.slice(bodyStart);
	const lines = body.split('\n');

	// Parse music content
	const defaultDuration: DurationToken = 'q'; // Quarter note default
	const staffMap = new Map<string, ScoreMeasure[]>();

	// If staves are declared, initialize them
	if (declaredStaves.length > 0) {
		for (const staff of declaredStaves) {
			staffMap.set(staff.name, []);
		}
	}

	let currentLineNumber = source.slice(0, bodyStart).split('\n').length;

	for (const line of lines) {
		currentLineNumber++;
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
			continue;
		}

		// Check for staff prefix
		const prefixMatch = trimmed.match(/^(\w+):\s*/);
		if (prefixMatch && declaredStaves.length > 0) {
			const staffName = prefixMatch[1];
			if (!staffMap.has(staffName)) {
				warnings.push({ line: currentLineNumber, column: 1, message: `Unknown staff: ${staffName}` });
				continue;
			}

			const measures = parseMusicLine(trimmed, defaultMetadata.defaultOctave!, defaultDuration);
			const existing = staffMap.get(staffName) || [];
			staffMap.set(staffName, [...existing, ...measures]);
		} else {
			// Single staff mode
			const measures = parseMusicLine(trimmed, defaultMetadata.defaultOctave!, defaultDuration);
			if (!staffMap.has('main')) {
				staffMap.set('main', []);
			}
			const existing = staffMap.get('main') || [];
			staffMap.set('main', [...existing, ...measures]);
		}
	}

	// Build staves array
	const staves: ScoreStaff[] = [];

	if (declaredStaves.length > 0) {
		for (const declared of declaredStaves) {
			staves.push({
				name: declared.name,
				clef: declared.clef,
				measures: staffMap.get(declared.name) || [],
			});
		}
	} else {
		// Single staff mode
		staves.push({
			name: 'main',
			clef: 'treble',
			measures: staffMap.get('main') || [],
		});
	}

	const score: ParsedScore = {
		metadata: defaultMetadata,
		staves,
		raw: source,
	};

	return { score, errors, warnings };
}

/**
 * Convert key string to key signature for VexFlow
 */
export function keyToSignature(key: string): string {
	// Extract base key (e.g., "C major" -> "C", "F# minor" -> "F#m")
	const match = key.match(/([A-G][#b]?)\s*(major|minor|m)?/i);
	if (!match) return 'C';

	const [, base, mode] = match;
	const isMinor = mode?.toLowerCase() === 'minor' || mode?.toLowerCase() === 'm';

	return base + (isMinor ? 'm' : '');
}
