import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { parseScore, keyToSignature } from '@/lib/score-parser';
import type { Duration, Pitch, ScoreElement } from '@/lib/score-types';

interface SheetMusicRendererProps {
	source: string;
	currentPosition?: number;
	onNoteClick?: (staffIndex: number, measureIndex: number, noteIndex: number) => void;
}

// Convert Score duration to VexFlow duration string
function durationToVexFlow(duration: Duration): string {
	const baseMap: Record<string, string> = {
		'w': 'w',   // whole
		'h': 'h',   // half
		'q': 'q',   // quarter
		'8': '8',   // eighth
		'16': '16', // sixteenth
		'32': '32', // thirty-second
	};

	let result = baseMap[duration.base] || 'q';

	// VexFlow uses 'd' suffix for dotted notes
	if (duration.dots >= 1) result += 'd';
	if (duration.dots >= 2) result += 'd';

	return result;
}

// Convert pitch to VexFlow key format (e.g., "c/4")
function pitchToVexFlow(pitch: Pitch): string {
	return `${pitch.note.toLowerCase()}/${pitch.octave}`;
}

// Convert pitch accidental to VexFlow accidental
function accidentalToVexFlow(accidental: string): string | null {
	switch (accidental) {
		case '#': return '#';
		case 'b': return 'b';
		case '##': return '##';
		case 'bb': return 'bb';
		default: return null;
	}
}

// Convert Score element to VexFlow note
function elementToVexFlow(element: ScoreElement): { keys: string[]; duration: string; accidentals?: (string | null)[] } | null {
	switch (element.type) {
		case 'rest':
			return {
				keys: ['b/4'],
				duration: durationToVexFlow(element.duration) + 'r',
			};

		case 'note':
			return {
				keys: [pitchToVexFlow(element.pitch)],
				duration: durationToVexFlow(element.duration),
				accidentals: element.pitch.accidental ? [accidentalToVexFlow(element.pitch.accidental)] : undefined,
			};

		case 'chord':
			return {
				keys: element.pitches.map(pitchToVexFlow),
				duration: durationToVexFlow(element.duration),
				accidentals: element.pitches.map((p: Pitch) => accidentalToVexFlow(p.accidental)),
			};

		default:
			return null;
	}
}

export function SheetMusicRenderer({ source, currentPosition, onNoteClick: _onNoteClick }: SheetMusicRendererProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rendererRef = useRef<Renderer | null>(null);

	// Parse the Score notation
	const parseResult = useMemo(() => parseScore(source), [source]);

	const render = useCallback(() => {
		if (!containerRef.current) return;

		const { score, errors } = parseResult;

		// Clear previous content
		containerRef.current.innerHTML = '';

		// Show errors if parsing failed
		if (!score || errors.length > 0) {
			if (errors.length > 0) {
				const errorDiv = document.createElement('div');
				errorDiv.className = 'p-4 text-red-500 text-sm';
				errorDiv.textContent = errors.map(e => `Line ${e.line}: ${e.message}`).join('\n');
				containerRef.current.appendChild(errorDiv);
			}
			return;
		}

		const { metadata, staves } = score;

		// Create renderer
		const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
		rendererRef.current = renderer;

		// Calculate dimensions
		const measureWidth = 250;
		const staveHeight = 100;
		const staveSpacing = 20;
		const staffGroupHeight = staves.length * staveHeight + (staves.length - 1) * staveSpacing;

		const maxMeasures = Math.max(...staves.map(s => s.measures.length), 1);
		const measuresPerLine = Math.max(1, Math.floor((containerRef.current.clientWidth - 40) / measureWidth));
		const numLines = Math.ceil(maxMeasures / measuresPerLine);

		renderer.resize(
			containerRef.current.clientWidth,
			Math.max(200, numLines * staffGroupHeight + 60)
		);

		const context = renderer.getContext();
		context.setFont('Arial', 10);

		const keySignature = keyToSignature(metadata.key);
		const { beats: timeNum, beatType: timeDen } = metadata.time;

		// Render each staff group
		for (let measureIdx = 0; measureIdx < maxMeasures; measureIdx++) {
			const lineIndex = Math.floor(measureIdx / measuresPerLine);
			const posInLine = measureIdx % measuresPerLine;
			const x = 20 + posInLine * measureWidth;

			for (let staffIdx = 0; staffIdx < staves.length; staffIdx++) {
				const staff = staves[staffIdx];
				const y = 20 + lineIndex * staffGroupHeight + staffIdx * (staveHeight + staveSpacing);

				const stave = new Stave(x, y, measureWidth - 10);

				// Add clef, key, and time signature to first measure of each line
				if (posInLine === 0) {
					stave.addClef(staff.clef.replace('-8', '8va') as any || 'treble');
					if (lineIndex === 0) {
						stave.addKeySignature(keySignature);
						stave.addTimeSignature(`${timeNum}/${timeDen}`);
					}
				}

				stave.setContext(context).draw();

				const measure = staff.measures[measureIdx];
				if (!measure || measure.elements.length === 0) continue;

				// Create VexFlow notes
				const vexNotes = measure.elements.map((element, noteIndex) => {
					const data = elementToVexFlow(element);
					if (!data) return null;

					const staveNote = new StaveNote({
						keys: data.keys,
						duration: data.duration,
					});

					// Add accidentals
					if (data.accidentals) {
						data.accidentals.forEach((acc, i) => {
							if (acc) staveNote.addModifier(new Accidental(acc), i);
						});
					}

					// Highlight current playback position
					if (currentPosition !== undefined && staffIdx === 0 && measureIdx === 0 && noteIndex === currentPosition) {
						staveNote.setStyle({ fillStyle: '#6366f1', strokeStyle: '#6366f1' });
					}

					return staveNote;
				}).filter((n): n is StaveNote => n !== null);

				if (vexNotes.length === 0) continue;

				try {
					const voice = new Voice({ numBeats: timeNum, beatValue: timeDen }).setStrict(false);
					voice.addTickables(vexNotes);

					// Calculate available width for notes
					// First measure of each line has clef, key sig, time sig taking ~80px
					const notationOffset = posInLine === 0 ? 100 : 20;
					const availableWidth = measureWidth - 10 - notationOffset;

					new Formatter().joinVoices([voice]).format([voice], availableWidth);
					voice.draw(context, stave);
				} catch (err) {
					console.warn('VexFlow rendering error:', err);
				}
			}
		}
	}, [parseResult, currentPosition]);

	useEffect(() => {
		render();

		// Re-render on resize
		const resizeObserver = new ResizeObserver(() => {
			render();
		});

		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}

		return () => resizeObserver.disconnect();
	}, [render]);

	return (
		<div
			ref={containerRef}
			className="w-full h-full min-h-[200px] bg-white dark:bg-slate-900 rounded-lg overflow-auto"
			onClick={() => {
				// TODO: Implement click-to-note mapping
			}}
		/>
	);
}
