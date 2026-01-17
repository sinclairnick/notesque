// Scorelang v2.0 Validator
// Validates parsed AST for correctness and produces diagnostics

import {
	type ScoreNode,
	type StaffNode,
	type MeasureNode,
	type NoteNode,
	type ChordNode,
	type PitchNode,
	type DurationNode,
} from './score-ast';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
	severity: DiagnosticSeverity;
	message: string;
	line: number;
	column: number;
	endLine?: number;
	endColumn?: number;
}

export interface ValidationResult {
	valid: boolean;
	diagnostics: Diagnostic[];
}

// Duration values in beats (assuming quarter = 1)
const DURATION_BEATS: Record<DurationNode['base'], number> = {
	'w': 4,
	'h': 2,
	'q': 1,
	'8': 0.5,
	'16': 0.25,
	'32': 0.125,
};

// Apply dots to duration
function getDurationBeats(duration: DurationNode): number {
	let beats = DURATION_BEATS[duration.base];
	let dotValue = beats / 2;
	for (let i = 0; i < duration.dots; i++) {
		beats += dotValue;
		dotValue /= 2;
	}
	return beats;
}

export class ScoreValidator {
	private diagnostics: Diagnostic[] = [];
	private declaredStaves: Set<string> = new Set();

	validate(ast: ScoreNode): ValidationResult {
		this.diagnostics = [];
		this.declaredStaves = new Set();

		// Collect declared staves
		if (ast.metadata.staves) {
			for (const stave of ast.metadata.staves) {
				this.declaredStaves.add(stave.name);
			}
		}

		// Validate staves
		for (const staff of ast.staves) {
			this.validateStaff(staff, ast);
		}

		return {
			valid: this.diagnostics.filter(d => d.severity === 'error').length === 0,
			diagnostics: this.diagnostics,
		};
	}

	private validateStaff(staff: StaffNode, score: ScoreNode): void {
		// Check if stave was declared
		if (this.declaredStaves.size > 0 && !this.declaredStaves.has(staff.name)) {
			this.addWarning(
				`Stave '${staff.name}' used without declaration`,
				staff.loc.line,
				staff.loc.column
			);
		}

		// Validate measures
		for (const measure of staff.measures) {
			this.validateMeasure(measure, score);
		}
	}

	private validateMeasure(measure: MeasureNode, score: ScoreNode): void {
		// Calculate beat count
		const beats = measure.elements.reduce((sum, el) => {
			if (el.kind === 'Note' || el.kind === 'Rest' || el.kind === 'Chord') {
				return sum + getDurationBeats(el.duration);
			}
			return sum;
		}, 0);

		// Check against time signature
		if (score.metadata.time) {
			const expectedBeats = score.metadata.time.beats;
			if (beats > expectedBeats) {
				this.addWarning(
					`Measure has ${beats} beats, expected ${expectedBeats} (time: ${score.metadata.time.beats}/${score.metadata.time.beatType})`,
					measure.loc.line,
					measure.loc.column
				);
			}
		}

		// Validate elements
		for (const element of measure.elements) {
			if (element.kind === 'Note') {
				this.validateNote(element);
			} else if (element.kind === 'Chord') {
				this.validateChord(element);
			}
		}
	}

	private validateNote(note: NoteNode): void {
		this.validatePitch(note.pitch);
		this.validateDuration(note.duration, note.loc.line, note.loc.column);

		// Validate fingering
		if (note.annotation?.fingering) {
			if (note.annotation.fingering < 1 || note.annotation.fingering > 5) {
				this.addError(
					`Invalid fingering ${note.annotation.fingering}, must be 1-5`,
					note.loc.line,
					note.loc.column
				);
			}
		}
	}

	private validateChord(chord: ChordNode): void {
		if (chord.pitches.length === 0) {
			this.addError(
				'Empty chord',
				chord.loc.line,
				chord.loc.column
			);
		}

		for (const pitch of chord.pitches) {
			this.validatePitch(pitch);
		}

		this.validateDuration(chord.duration, chord.loc.line, chord.loc.column);
	}

	private validatePitch(pitch: PitchNode): void {
		// Validate octave range
		if (pitch.octave < 0 || pitch.octave > 8) {
			this.addError(
				`Invalid octave ${pitch.octave}, must be 0-8`,
				pitch.loc.line,
				pitch.loc.column
			);
		}

		// Warn about unusual enharmonic spellings
		const unusualSpellings: Record<string, string> = {
			'Cb': 'B',
			'Fb': 'E',
			'E#': 'F',
			'B#': 'C',
		};
		const spelling = pitch.note + pitch.accidental;
		if (unusualSpellings[spelling]) {
			this.addInfo(
				`Unusual spelling '${spelling}' (enharmonic with ${unusualSpellings[spelling]})`,
				pitch.loc.line,
				pitch.loc.column
			);
		}
	}

	private validateDuration(duration: DurationNode, line: number, column: number): void {
		// Validate dots (max 2)
		if (duration.dots > 2) {
			this.addWarning(
				`Duration has ${duration.dots} dots, typically max 2`,
				line,
				column
			);
		}
	}

	private addError(message: string, line: number, column: number): void {
		this.diagnostics.push({ severity: 'error', message, line, column });
	}

	private addWarning(message: string, line: number, column: number): void {
		this.diagnostics.push({ severity: 'warning', message, line, column });
	}

	private addInfo(message: string, line: number, column: number): void {
		this.diagnostics.push({ severity: 'info', message, line, column });
	}
}

// Convenience function
export function validateScore(ast: ScoreNode): ValidationResult {
	return new ScoreValidator().validate(ast);
}
