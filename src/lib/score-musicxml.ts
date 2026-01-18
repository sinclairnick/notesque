// Scorelang to MusicXML Transpiler
// Converts Score AST to MusicXML format for rendering and export

import {
	type ScoreNode,
	type StaffNode,
	type MeasureNode,
	type NoteNode,
	type RestNode,
	type ChordNode,
	type DurationNode,
	type MusicElementNode,
} from './score-ast';

// ============ MusicXML Duration Mapping ============

// Duration types in MusicXML
const DURATION_TYPE_MAP: Record<DurationNode['base'], string> = {
	'w': 'whole',
	'h': 'half',
	'q': 'quarter',
	'8': 'eighth',
	'16': '16th',
	'32': '32nd',
};

// Duration values in divisions (quarter note = 1)
const DURATION_DIVISIONS: Record<DurationNode['base'], number> = {
	'w': 4,
	'h': 2,
	'q': 1,
	'8': 0.5,
	'16': 0.25,
	'32': 0.125,
};

// Calculate duration with dots
function getDurationDivisions(duration: DurationNode): number {
	let divisions = DURATION_DIVISIONS[duration.base];
	let dotValue = divisions / 2;
	for (let i = 0; i < duration.dots; i++) {
		divisions += dotValue;
		dotValue /= 2;
	}
	// MusicXML uses integer divisions, multiply to avoid fractions
	return Math.round(divisions * 4); // divisions per quarter = 4
}

// ============ Key Signature Mapping ============

// Map key names to fifths (circle of fifths position)
const KEY_FIFTHS: Record<string, number> = {
	'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'Gb': -6,
	'Db': -5, 'Ab': -4, 'Eb': -3, 'Bb': -2, 'F': -1,
	'Am': 0, 'Em': 1, 'Bm': 2, 'F#m': 3, 'C#m': 4, 'G#m': 5, 'D#m': 6,
	'Dm': -1, 'Gm': -2, 'Cm': -3, 'Fm': -4, 'Bbm': -5, 'Ebm': -6,
};

function getKeyFifths(key: string): number {
	// Normalize: "C major" -> "C", "D minor" -> "Dm"
	const normalized = key
		.replace(/\s*(major|maj)/i, '')
		.replace(/\s*(minor|min)/i, 'm')
		.trim();
	return KEY_FIFTHS[normalized] ?? 0;
}

function getKeyMode(key: string): 'major' | 'minor' {
	return /minor|min|m$/i.test(key) ? 'minor' : 'major';
}

// ============ Clef Mapping ============

const CLEF_MAP: Record<string, { sign: string; line: number }> = {
	'treble': { sign: 'G', line: 2 },
	'bass': { sign: 'F', line: 4 },
	'alto': { sign: 'C', line: 3 },
	'tenor': { sign: 'C', line: 4 },
};

// ============ Accidental Mapping ============

const ACCIDENTAL_ALTER: Record<string, number> = {
	'': 0,
	'#': 1,
	'##': 2,
	'b': -1,
	'bb': -2,
};

const ACCIDENTAL_TYPE: Record<string, string> = {
	'#': 'sharp',
	'##': 'double-sharp',
	'b': 'flat',
	'bb': 'flat-flat',
};

// ============ XML Helpers ============

function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function indent(level: number): string {
	return '  '.repeat(level);
}

// ============ Transpiler ============

export interface TranspileOptions {
	includeXmlDeclaration?: boolean;
	prettyPrint?: boolean;
}

const DEFAULT_OPTIONS: TranspileOptions = {
	includeXmlDeclaration: true,
	prettyPrint: true,
};

export function transpileToMusicXML(
	ast: ScoreNode,
	options: TranspileOptions = {}
): string {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const lines: string[] = [];
	const nl = opts.prettyPrint ? '\n' : '';
	const ind = (level: number) => opts.prettyPrint ? indent(level) : '';

	// XML declaration
	if (opts.includeXmlDeclaration) {
		lines.push('<?xml version="1.0" encoding="UTF-8"?>');
		lines.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
	}

	// Root element
	lines.push('<score-partwise version="4.0">');

	// Work title
	if (ast.metadata.title) {
		lines.push(`${ind(1)}<work>`);
		lines.push(`${ind(2)}<work-title>${escapeXml(ast.metadata.title)}</work-title>`);
		lines.push(`${ind(1)}</work>`);
	}

	// Identification (composer)
	if (ast.metadata.composer) {
		lines.push(`${ind(1)}<identification>`);
		lines.push(`${ind(2)}<creator type="composer">${escapeXml(ast.metadata.composer)}</creator>`);
		lines.push(`${ind(1)}</identification>`);
	}

	// Find max measures to align all parts
	const maxMeasures = Math.max(1, ...ast.staves.map(s => s.measures.length));

	// Part list
	lines.push(`${ind(1)}<part-list>`);

	// Add brace group if there are multiple parts (common for piano)
	if (ast.staves.length > 1) {
		lines.push(`${ind(2)}<part-group type="start" number="1">`);
		lines.push(`${ind(3)}<group-symbol>bracket</group-symbol>`);
		lines.push(`${ind(2)}</part-group>`);
	}

	ast.staves.forEach((staff, idx) => {
		const partId = `P${idx + 1}`;
		lines.push(`${ind(2)}<score-part id="${partId}">`);
		lines.push(`${ind(3)}<part-name>${escapeXml(staff.name)}</part-name>`);
		lines.push(`${ind(2)}</score-part>`);
	});

	if (ast.staves.length > 1) {
		lines.push(`${ind(2)}<part-group type="stop" number="1"/>`);
	}

	lines.push(`${ind(1)}</part-list>`);

	// Parts
	ast.staves.forEach((staff, idx) => {
		const partId = `P${idx + 1}`;
		lines.push(`${ind(1)}<part id="${partId}">`);
		transpileStaff(staff, ast, maxMeasures, lines, ind);
		lines.push(`${ind(1)}</part>`);
	});

	lines.push('</score-partwise>');

	return lines.join(nl);
}

function transpileStaff(
	staff: StaffNode,
	score: ScoreNode,
	targetMeasureCount: number,
	lines: string[],
	ind: (level: number) => string
): void {
	const { metadata } = score;

	for (let i = 0; i < targetMeasureCount; i++) {
		const measure = staff.measures[i];
		lines.push(`${ind(2)}<measure number="${i + 1}">`);


		// Attributes (Key, Time, Clef)
		if (measure?.attributes || i === 0) {
			lines.push(`${ind(3)}<attributes>`);

			if (i === 0) {
				lines.push(`${ind(4)}<divisions>4</divisions>`);
			}

			// Key signature
			const key = measure?.attributes?.key ?? (i === 0 ? (metadata.key ?? 'C') : undefined);
			if (key) {
				const fifths = getKeyFifths(key);
				const mode = getKeyMode(key);
				lines.push(`${ind(4)}<key>`);
				lines.push(`${ind(5)}<fifths>${fifths}</fifths>`);
				lines.push(`${ind(5)}<mode>${mode}</mode>`);
				lines.push(`${ind(4)}</key>`);
			}

			// Time signature
			const time = measure?.attributes?.time ?? (i === 0 ? (metadata.time) : undefined);
			if (time || (i === 0 && !time)) {
				const beats = time?.beats ?? 4;
				const beatType = time?.beatType ?? 4;
				lines.push(`${ind(4)}<time>`);
				lines.push(`${ind(5)}<beats>${beats}</beats>`);
				lines.push(`${ind(5)}<beat-type>${beatType}</beat-type>`);
				lines.push(`${ind(4)}</time>`);
			}

			// Clef
			const clefName = measure?.attributes?.clef ?? (i === 0 ? staff.clef : undefined);
			if (clefName) {
				const clef = CLEF_MAP[clefName] ?? CLEF_MAP['treble'];
				lines.push(`${ind(4)}<clef>`);
				lines.push(`${ind(5)}<sign>${clef.sign}</sign>`);
				lines.push(`${ind(5)}<line>${clef.line}</line>`);
				lines.push(`${ind(4)}</clef>`);
			}

			lines.push(`${ind(3)}</attributes>`);
		}

		// Notes or padding
		if (measure) {
			transpileMeasure(measure, lines, ind);
		} else {
			// Pad with a whole rest
			lines.push(`${ind(3)}<note>`);
			lines.push(`${ind(4)}<rest/>`);
			lines.push(`${ind(4)}<duration>${(metadata.time?.beats ?? 4) * 4}</duration>`);
			lines.push(`${ind(4)}<type>whole</type>`);
			lines.push(`${ind(3)}</note>`);
		}

		lines.push(`${ind(2)}</measure>`);
	}
}

function transpileMeasure(
	measure: MeasureNode,
	lines: string[],
	ind: (level: number) => string
): void {
	for (let i = 0; i < measure.elements.length; i++) {
		const element = measure.elements[i];
		const prev = measure.elements[i - 1];
		const next = measure.elements[i + 1];

		// Calculate beam state
		let beamState: 'begin' | 'continue' | 'end' | null = null;
		if (element.kind === 'Note' && element.beamed) {
			const isPrevBeamed = prev?.kind === 'Note' && prev.beamed;
			const isNextBeamed = next?.kind === 'Note' && next.beamed;

			if (!isPrevBeamed && isNextBeamed) beamState = 'begin';
			else if (isPrevBeamed && isNextBeamed) beamState = 'continue';
			else if (isPrevBeamed && !isNextBeamed) beamState = 'end';
			// Single beamed note (shouldn't happen with parser logic but safe fallback)
			else if (!isPrevBeamed && !isNextBeamed) beamState = null;
		}

		transpileElement(element, lines, ind, beamState);
	}
}

function transpileElement(
	element: MusicElementNode,
	lines: string[],
	ind: (level: number) => string,
	beamState: 'begin' | 'continue' | 'end' | null = null
): void {
	// Emit direction elements for dynamics (before note)
	if (element.kind === 'Note' && element.annotation?.dynamic) {
		lines.push(`${ind(3)}<direction placement="below">`);
		lines.push(`${ind(4)}<direction-type>`);
		lines.push(`${ind(5)}<dynamics default-y="-80">`); // default-y helps positioning
		lines.push(`${ind(6)}<${element.annotation.dynamic}/>`);
		lines.push(`${ind(5)}</dynamics>`);
		lines.push(`${ind(4)}</direction-type>`);
		lines.push(`${ind(3)}</direction>`);
	}

	// Emit direction elements for crescendo/decrescendo before the note
	if (element.kind === 'Note' && element.annotation) {
		if (element.annotation.crescendo === 'start') {
			lines.push(`${ind(3)}<direction placement="below">`);
			lines.push(`${ind(4)}<direction-type>`);
			lines.push(`${ind(5)}<wedge type="crescendo"/>`);
			lines.push(`${ind(4)}</direction-type>`);
			lines.push(`${ind(3)}</direction>`);
		} else if (element.annotation.crescendo === 'end') {
			lines.push(`${ind(3)}<direction>`);
			lines.push(`${ind(4)}<direction-type>`);
			lines.push(`${ind(5)}<wedge type="stop"/>`);
			lines.push(`${ind(4)}</direction-type>`);
			lines.push(`${ind(3)}</direction>`);
		}
		if (element.annotation.decrescendo === 'start') {
			lines.push(`${ind(3)}<direction placement="below">`);
			lines.push(`${ind(4)}<direction-type>`);
			lines.push(`${ind(5)}<wedge type="diminuendo"/>`);
			lines.push(`${ind(4)}</direction-type>`);
			lines.push(`${ind(3)}</direction>`);
		} else if (element.annotation.decrescendo === 'end') {
			lines.push(`${ind(3)}<direction>`);
			lines.push(`${ind(4)}<direction-type>`);
			lines.push(`${ind(5)}<wedge type="stop"/>`);
			lines.push(`${ind(4)}</direction-type>`);
			lines.push(`${ind(3)}</direction>`);
		}
	}

	switch (element.kind) {
		case 'Note':
			transpileNote(element, lines, ind, false, beamState);
			break;
		case 'Rest':
			transpileRest(element, lines, ind);
			break;
		case 'Chord':
			transpileChord(element, lines, ind);
			break;
	}
}

function transpileNote(
	note: NoteNode,
	lines: string[],
	ind: (level: number) => string,
	isChordMember = false,
	beamState: 'begin' | 'continue' | 'end' | null = null
): void {
	lines.push(`${ind(3)}<note>`);

	// Grace note
	if (note.grace) {
		lines.push(`${ind(4)}<grace/>`);
	}

	// Chord indicator (for notes after the first in a chord)
	if (isChordMember) {
		lines.push(`${ind(4)}<chord/>`);
	}

	// Pitch
	lines.push(`${ind(4)}<pitch>`);
	lines.push(`${ind(5)}<step>${note.pitch.note}</step>`);
	if (note.pitch.accidental) {
		const alter = ACCIDENTAL_ALTER[note.pitch.accidental];
		lines.push(`${ind(5)}<alter>${alter}</alter>`);
	}
	lines.push(`${ind(5)}<octave>${note.pitch.octave}</octave>`);
	lines.push(`${ind(4)}</pitch>`);

	// Duration
	const divisions = getDurationDivisions(note.duration);
	lines.push(`${ind(4)}<duration>${divisions}</duration>`);

	// Tie
	if (note.tied) {
		lines.push(`${ind(4)}<tie type="start"/>`);
	}

	// Type (note head)
	lines.push(`${ind(4)}<type>${DURATION_TYPE_MAP[note.duration.base]}</type>`);

	// Dots
	for (let i = 0; i < note.duration.dots; i++) {
		lines.push(`${ind(4)}<dot/>`);
	}

	// Accidental (display)
	if (note.pitch.accidental) {
		lines.push(`${ind(4)}<accidental>${ACCIDENTAL_TYPE[note.pitch.accidental]}</accidental>`);
	}

	// Beam
	if (beamState) {
		lines.push(`${ind(4)}<beam number="1">${beamState}</beam>`);
	}

	// Notations (ties, slurs, articulations)
	const hasNotations = note.tied || note.annotation?.articulations?.length ||
		note.annotation?.fingering ||
		note.annotation?.slurStart || note.annotation?.slurEnd ||
		note.annotation?.crescendo || note.annotation?.decrescendo;
	// NOTE: Dynamics are now handled via <direction> before the note

	if (hasNotations) {
		lines.push(`${ind(4)}<notations>`);

		if (note.tied) {
			lines.push(`${ind(5)}<tied type="start"/>`);
		}

		// Slurs
		if (note.annotation?.slurStart) {
			lines.push(`${ind(5)}<slur type="start" number="1"/>`);
		}
		if (note.annotation?.slurEnd) {
			lines.push(`${ind(5)}<slur type="stop" number="1"/>`);
		}

		// Articulations (excluding trill which goes in ornaments)
		const articulations = note.annotation?.articulations?.filter(a => a !== 'trill') || [];
		if (articulations.length > 0) {
			lines.push(`${ind(5)}<articulations>`);
			for (const art of articulations) {
				const xmlArt = articulationToXml(art);
				if (xmlArt) {
					lines.push(`${ind(6)}<${xmlArt}/>`);
				}
			}
			lines.push(`${ind(5)}</articulations>`);
		}

		// Ornaments (trill)
		const hasTrill = note.annotation?.articulations?.includes('trill');
		if (hasTrill) {
			lines.push(`${ind(5)}<ornaments>`);
			lines.push(`${ind(6)}<trill-mark/>`);
			lines.push(`${ind(5)}</ornaments>`);
		}

		// Technical (fingering)
		if (note.annotation?.fingering) {
			lines.push(`${ind(5)}<technical>`);
			lines.push(`${ind(6)}<fingering>${note.annotation.fingering}</fingering>`);
			lines.push(`${ind(5)}</technical>`);
		}

		lines.push(`${ind(4)}</notations>`);
	}

	lines.push(`${ind(3)}</note>`);
}

function transpileRest(
	rest: RestNode,
	lines: string[],
	ind: (level: number) => string
): void {
	lines.push(`${ind(3)}<note>`);
	lines.push(`${ind(4)}<rest/>`);

	const divisions = getDurationDivisions(rest.duration);
	lines.push(`${ind(4)}<duration>${divisions}</duration>`);
	lines.push(`${ind(4)}<type>${DURATION_TYPE_MAP[rest.duration.base]}</type>`);

	for (let i = 0; i < rest.duration.dots; i++) {
		lines.push(`${ind(4)}<dot/>`);
	}

	lines.push(`${ind(3)}</note>`);
}

function transpileChord(
	chord: ChordNode,
	lines: string[],
	ind: (level: number) => string
): void {
	// First note of chord
	if (chord.pitches.length > 0) {
		const firstNote: NoteNode = {
			kind: 'Note',
			pitch: chord.pitches[0],
			duration: chord.duration,
			tied: false,
			annotation: chord.annotation,
			loc: chord.loc,
		};
		transpileNote(firstNote, lines, ind, false);

		// Remaining notes with <chord/> tag
		for (let i = 1; i < chord.pitches.length; i++) {
			const chordNote: NoteNode = {
				kind: 'Note',
				pitch: chord.pitches[i],
				duration: chord.duration,
				tied: false,
				loc: chord.loc,
			};
			transpileNote(chordNote, lines, ind, true, null); // No beams on chord members for now (usually first note carries beam)
		}
	}
}

function articulationToXml(articulation: string): string | null {
	const map: Record<string, string> = {
		'staccato': 'staccato',
		'tenuto': 'tenuto',
		'accent': 'accent',
		'marcato': 'strong-accent',
		'fermata': 'fermata',
	};
	return map[articulation] ?? null;
}
