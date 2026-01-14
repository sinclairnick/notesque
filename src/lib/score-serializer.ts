// Score Notation Language Serializer
// Converts ParsedScore back to .score text

import type {
	ParsedScore,
	ScoreMeasure,
	ScoreElement,
	Duration,
	Pitch,
	Annotation,
} from './score-types';

/**
 * Serialize a pitch to Score notation
 */
function serializePitch(pitch: Pitch, defaultOctave: number): string {
	const { note, accidental, octave } = pitch;

	// Use lowercase for octave above default
	let noteLetter = octave > defaultOctave ? note.toLowerCase() : note;

	// Add accidental
	let result = noteLetter + accidental;

	// Add explicit octave if not default or default+1
	if (octave !== defaultOctave && octave !== defaultOctave + 1) {
		result += octave;
	} else if (octave === defaultOctave && note === note.toLowerCase()) {
		// Explicit octave needed when case would imply wrong octave
		result = note + accidental + octave;
	}

	return result;
}

/**
 * Serialize a duration to Score notation
 */
function serializeDuration(duration: Duration, isDefault: boolean): string {
	if (isDefault && duration.dots === 0) return '';

	let result = '.' + duration.base;
	if (duration.dots > 0) {
		result += '.'.repeat(duration.dots);
	}

	return result;
}

/**
 * Serialize an annotation to Score notation
 */
function serializeAnnotation(annotation: Annotation | undefined): string {
	if (!annotation) return '';

	const parts: string[] = [];

	if (annotation.dynamic) {
		parts.push(annotation.dynamic);
	}

	if (annotation.articulations) {
		for (const art of annotation.articulations) {
			const symbol = Object.entries({
				staccato: '.',
				tenuto: '-',
				accent: '>',
				marcato: '^',
				fermata: 'u',
				trill: 'tr',
				turn: '~',
				mordent: 'm',
			}).find(([name]) => name === art)?.[1];

			if (symbol) parts.push(symbol);
		}
	}

	if (annotation.fingering) {
		parts.push(String(annotation.fingering));
	}

	if (annotation.crescendo === 'start') parts.push('<');
	if (annotation.decrescendo === 'start') parts.push('>');

	if (annotation.text) {
		parts.push(`"${annotation.text}"`);
	}

	if (parts.length === 0) return '';
	return `{${parts.join(', ')}}`;
}

/**
 * Serialize a single element
 */
function serializeElement(element: ScoreElement, defaultOctave: number): string {
	switch (element.type) {
		case 'rest': {
			const dur = serializeDuration(element.duration, element.duration.base === 'q');
			return '_' + dur;
		}

		case 'note': {
			const pitch = serializePitch(element.pitch, defaultOctave);
			const dur = serializeDuration(element.duration, element.duration.base === 'q');
			const ann = serializeAnnotation(element.annotation);
			const tie = element.tied ? '~' : '';
			return pitch + dur + ann + tie;
		}

		case 'chord': {
			const pitches = element.pitches.map(p => serializePitch(p, defaultOctave)).join(' ');
			const dur = serializeDuration(element.duration, element.duration.base === 'q');
			const ann = serializeAnnotation(element.annotation);
			return `[${pitches}]${dur}${ann}`;
		}
	}
}

/**
 * Serialize a measure
 */
function serializeMeasure(measure: ScoreMeasure, defaultOctave: number): string {
	const elements = measure.elements.map(e => serializeElement(e, defaultOctave));
	return elements.join(' ');
}

/**
 * Main serializer function
 */
export function serializeScore(score: ParsedScore): string {
	const lines: string[] = [];

	// Frontmatter
	lines.push('---');
	lines.push(`title: ${score.metadata.title}`);

	if (score.metadata.composer) {
		lines.push(`composer: ${score.metadata.composer}`);
	}

	lines.push(`key: ${score.metadata.key}`);
	lines.push(`time: ${score.metadata.time.beats}/${score.metadata.time.beatType}`);

	if (score.metadata.tempo) {
		lines.push(`tempo: ${score.metadata.tempo}`);
	}

	// Multi-staff declaration
	if (score.staves.length > 1 || score.staves[0]?.name !== 'main') {
		lines.push('');
		lines.push('staves:');
		for (const staff of score.staves) {
			lines.push(`  - name: ${staff.name}`);
			lines.push(`    clef: ${staff.clef}`);
		}
	}

	lines.push('---');
	lines.push('');

	// Music content
	const defaultOctave = score.metadata.defaultOctave || 4;
	const multiStaff = score.staves.length > 1 || score.staves[0]?.name !== 'main';

	if (multiStaff) {
		// For multi-staff, output all staves for each measure group
		const maxMeasures = Math.max(...score.staves.map(s => s.measures.length));
		const measuresPerLine = 2;

		for (let i = 0; i < maxMeasures; i += measuresPerLine) {
			for (const staff of score.staves) {
				const staffMeasures = staff.measures.slice(i, i + measuresPerLine);
				if (staffMeasures.length > 0) {
					const content = staffMeasures.map(m => serializeMeasure(m, defaultOctave)).join(' | ');
					lines.push(`${staff.name}: | ${content} |`);
				}
			}
			lines.push('');
		}
	} else {
		// Single staff - just output measures
		const staff = score.staves[0];
		if (staff) {
			const measuresPerLine = 4;
			for (let i = 0; i < staff.measures.length; i += measuresPerLine) {
				const lineMeasures = staff.measures.slice(i, i + measuresPerLine);
				const content = lineMeasures.map(m => serializeMeasure(m, defaultOctave)).join(' | ');
				lines.push(`| ${content} |`);
			}
		}
	}

	return lines.join('\n');
}
