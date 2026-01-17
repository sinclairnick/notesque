// Score to VexFlow Transpiler
// Converts Score AST to VexFlow objects with full notation support

import {
	Stave,
	StaveNote,
	Voice,
	Formatter,
	Accidental,
	Annotation,
	AnnotationVerticalJustify,
	Articulation,
	StaveTie,
	StaveHairpin,
	Curve,
	type RenderContext,
} from 'vexflow';
import type {
	ScoreNode,
	StaffNode,
	MeasureNode,
	NoteNode,
	ChordNode,
	RestNode,
	PitchNode,
	DurationNode,
	AnnotationNode,
	MusicElementNode,
} from './score-ast';

// ============ Types ============

export interface VexFlowNote {
	staveNote: StaveNote;
	element: MusicElementNode;
	staffIndex: number;
	measureIndex: number;
	elementIndex: number;
}

export interface VexFlowMeasure {
	stave: Stave;
	voice: Voice;
	notes: VexFlowNote[];
	ties: Array<{ from: StaveNote; to: StaveNote }>;
}

export interface VexFlowStaff {
	name: string;
	clef: string;
	measures: VexFlowMeasure[];
}

export interface TranspileResult {
	staves: VexFlowStaff[];
	errors: string[];
}

// ============ Transpiler ============

export class VexFlowTranspiler {
	private errors: string[] = [];

	transpile(ast: ScoreNode): TranspileResult {
		this.errors = [];
		const staves: VexFlowStaff[] = [];

		for (const staff of ast.staves) {
			staves.push(this.transpileStaff(staff));
		}

		return { staves, errors: this.errors };
	}

	private transpileStaff(staff: StaffNode): VexFlowStaff {
		return {
			name: staff.name,
			clef: staff.clef,
			measures: [], // Measures are built during render with context
		};
	}

	// Render a staff to a VexFlow context
	renderStaff(
		staff: StaffNode,
		staffIndex: number,
		context: RenderContext,
		options: {
			x: number;
			y: number;
			measureWidth: number;
			keySignature: string;
			timeSignature: { beats: number; beatType: number };
			isFirstMeasure: boolean;
			isFirstLine: boolean;
		}
	): { notes: VexFlowNote[]; ties: StaveTie[]; hairpins: StaveHairpin[]; slurs: Curve[] } {
		const allNotes: VexFlowNote[] = [];
		const allTies: StaveTie[] = [];
		const allHairpins: StaveHairpin[] = [];
		const allSlurs: Curve[] = [];

		for (let measureIdx = 0; measureIdx < staff.measures.length; measureIdx++) {
			const measure = staff.measures[measureIdx];
			const lineIndex = Math.floor(measureIdx / 4); // Assume 4 measures per line
			const posInLine = measureIdx % 4;

			const measureX = options.x + posInLine * options.measureWidth;
			const measureY = options.y + lineIndex * 120; // Staff height

			const { notes, ties } = this.renderMeasure(
				measure,
				staffIndex,
				measureIdx,
				context,
				{
					x: measureX,
					y: measureY,
					width: options.measureWidth - 10,
					clef: staff.clef,
					keySignature: options.keySignature,
					timeSignature: options.timeSignature,
					showClef: posInLine === 0,
					showKeySig: posInLine === 0 && lineIndex === 0,
					showTimeSig: posInLine === 0 && lineIndex === 0,
				}
			);

			allNotes.push(...notes);
			allTies.push(...ties);
		}

		return { notes: allNotes, ties: allTies, hairpins: allHairpins, slurs: allSlurs };
	}

	renderMeasure(
		measure: MeasureNode,
		staffIndex: number,
		measureIndex: number,
		context: RenderContext,
		options: {
			x: number;
			y: number;
			width: number;
			clef: string;
			keySignature: string;
			timeSignature: { beats: number; beatType: number };
			showClef: boolean;
			showKeySig: boolean;
			showTimeSig: boolean;
		}
	): { notes: VexFlowNote[]; ties: StaveTie[] } {
		const stave = new Stave(options.x, options.y, options.width);

		if (options.showClef) {
			stave.addClef(options.clef.replace('-8', '8va') as any || 'treble');
		}
		if (options.showKeySig) {
			stave.addKeySignature(options.keySignature);
		}
		if (options.showTimeSig) {
			stave.addTimeSignature(`${options.timeSignature.beats}/${options.timeSignature.beatType}`);
		}

		stave.setContext(context).draw();

		if (measure.elements.length === 0) {
			return { notes: [], ties: [] };
		}

		const notes: VexFlowNote[] = [];
		const ties: StaveTie[] = [];
		let previousNote: NoteNode | null = null;
		let previousStaveNote: StaveNote | null = null;

		for (let i = 0; i < measure.elements.length; i++) {
			const element = measure.elements[i];
			const staveNote = this.elementToStaveNote(element);

			if (!staveNote) continue;

			notes.push({
				staveNote,
				element,
				staffIndex,
				measureIndex,
				elementIndex: i,
			});

			// Handle ties
			if (previousNote?.tied && previousStaveNote && element.kind === 'Note') {
				ties.push(new StaveTie({ firstNote: previousStaveNote, lastNote: staveNote }));
			}

			if (element.kind === 'Note') {
				previousNote = element;
				previousStaveNote = staveNote;
			} else {
				previousNote = null;
				previousStaveNote = null;
			}
		}

		if (notes.length > 0) {
			try {
				const voice = new Voice({
					numBeats: options.timeSignature.beats,
					beatValue: options.timeSignature.beatType,
				}).setStrict(false);

				voice.addTickables(notes.map(n => n.staveNote));

				const notationOffset = options.showClef ? 100 : 20;
				const availableWidth = options.width - notationOffset;

				new Formatter().joinVoices([voice]).format([voice], availableWidth);
				voice.draw(context, stave);

				// Draw ties
				for (const tie of ties) {
					tie.setContext(context).draw();
				}
			} catch (err) {
				this.errors.push(`Measure ${measureIndex}: ${err}`);
			}
		}

		return { notes, ties };
	}

	elementToStaveNote(element: MusicElementNode): StaveNote | null {
		switch (element.kind) {
			case 'Rest':
				return this.restToStaveNote(element);
			case 'Note':
				return this.noteToStaveNote(element);
			case 'Chord':
				return this.chordToStaveNote(element);
			default:
				return null;
		}
	}

	private restToStaveNote(rest: RestNode): StaveNote {
		return new StaveNote({
			keys: ['b/4'],
			duration: this.durationToVexFlow(rest.duration) + 'r',
		});
	}

	private noteToStaveNote(note: NoteNode): StaveNote {
		const key = this.pitchToKey(note.pitch);
		const duration = this.durationToVexFlow(note.duration);

		const staveNote = new StaveNote({
			keys: [key],
			duration,
		});

		// Add accidental
		if (note.pitch.accidental) {
			staveNote.addModifier(new Accidental(note.pitch.accidental), 0);
		}

		// Add annotation modifiers
		if (note.annotation) {
			this.addAnnotationModifiers(staveNote, note.annotation);
		}

		return staveNote;
	}

	private chordToStaveNote(chord: ChordNode): StaveNote {
		const keys = chord.pitches.map(p => this.pitchToKey(p));
		const duration = this.durationToVexFlow(chord.duration);

		const staveNote = new StaveNote({
			keys,
			duration,
		});

		// Add accidentals
		chord.pitches.forEach((pitch, i) => {
			if (pitch.accidental) {
				staveNote.addModifier(new Accidental(pitch.accidental), i);
			}
		});

		// Add annotation modifiers
		if (chord.annotation) {
			this.addAnnotationModifiers(staveNote, chord.annotation);
		}

		return staveNote;
	}

	private addAnnotationModifiers(staveNote: StaveNote, annotation: AnnotationNode): void {
		// Dynamics (below staff)
		if (annotation.dynamic) {
			const dynamicAnnotation = new Annotation(annotation.dynamic)
				.setVerticalJustification(AnnotationVerticalJustify.BOTTOM);
			staveNote.addModifier(dynamicAnnotation, 0);
		}

		// Articulations
		if (annotation.articulations) {
			for (const art of annotation.articulations) {
				const vexArt = this.articulationToVexFlow(art);
				if (vexArt) {
					staveNote.addModifier(new Articulation(vexArt), 0);
				}
			}
		}

		// Fingering (above staff)
		if (annotation.fingering) {
			const fingerAnnotation = new Annotation(String(annotation.fingering))
				.setVerticalJustification(AnnotationVerticalJustify.TOP);
			staveNote.addModifier(fingerAnnotation, 0);
		}

		// Text annotation
		if (annotation.text) {
			const textAnnotation = new Annotation(annotation.text)
				.setVerticalJustification(AnnotationVerticalJustify.TOP);
			staveNote.addModifier(textAnnotation, 0);
		}
	}

	private articulationToVexFlow(articulation: string): string | null {
		const map: Record<string, string> = {
			'staccato': 'a.',
			'tenuto': 'a-',
			'accent': 'a>',
			'marcato': 'a^',
			'fermata': 'a@a',
			'trill': 'tr',
			'turn': 'turn',
			'mordent': 'mordent',
		};
		return map[articulation] || null;
	}

	private pitchToKey(pitch: PitchNode): string {
		return `${pitch.note.toLowerCase()}/${pitch.octave}`;
	}

	private durationToVexFlow(duration: DurationNode): string {
		let result = duration.base;

		// VexFlow uses 'd' suffix for dotted notes
		if (duration.dots >= 1) result += 'd';
		if (duration.dots >= 2) result += 'd';

		return result;
	}
}

// Convenience function
export function transpileToVexFlow(ast: ScoreNode): TranspileResult {
	return new VexFlowTranspiler().transpile(ast);
}
