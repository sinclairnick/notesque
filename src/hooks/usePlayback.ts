import { useState, useCallback, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { Piano } from '@tonejs/piano';
import { parseScoreToAST } from '@/lib/score-parser';
import type { PitchNode, DurationNode } from '@/lib/score-ast';

interface UsePlaybackReturn {
	isPlaying: boolean;
	isPaused: boolean;
	isLoading: boolean;
	isLoaded: boolean;
	currentPosition: number;
	tempo: number;

	play: () => Promise<void>;
	pause: () => void;
	stop: () => void;
	setTempo: (tempo: number) => void;
}

// Convert pitch to MIDI note number
function pitchToMidi(pitch: PitchNode): number {
	const noteMap: Record<string, number> = {
		'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
	};

	let semitone = noteMap[pitch.note];
	if (pitch.accidental === '#') semitone += 1;
	if (pitch.accidental === 'b') semitone -= 1;
	if (pitch.accidental === '##') semitone += 2;
	if (pitch.accidental === 'bb') semitone -= 2;

	return (pitch.octave + 1) * 12 + semitone;
}

// Convert duration to seconds
function durationToSeconds(duration: DurationNode, tempo: number): number {
	const beatDuration = 60 / tempo; // Quarter note duration

	const baseMultipliers: Record<string, number> = {
		'w': 4,     // whole = 4 beats
		'h': 2,     // half = 2 beats
		'q': 1,     // quarter = 1 beat
		'8': 0.5,   // eighth = 0.5 beats
		'16': 0.25, // sixteenth = 0.25 beats
		'32': 0.125,// thirty-second = 0.125 beats
	};

	let multiplier = baseMultipliers[duration.base] || 1;

	// Apply dots: first dot adds 50%, second adds 25%
	if (duration.dots >= 1) multiplier *= 1.5;
	if (duration.dots >= 2) multiplier *= 1.25;

	return multiplier * beatDuration;
}

// Extract notes from parsed score for playback
interface PlaybackNote {
	midiNotes: number[];
	duration: number;
	time: number;
}

function extractNotes(source: string, tempo: number): PlaybackNote[] {
	const result = parseScoreToAST(source);
	if (!result.ast) return [];

	const allNotes: PlaybackNote[] = [];

	for (const staff of result.ast.staves) {
		let currentTime = 0;
		for (const measure of staff.measures) {
			for (const element of measure.elements) {
				const duration = durationToSeconds(element.duration, tempo);

				switch (element.kind) {
					case 'Rest':
						// Still add rest to tracking if we need it, but for piano playback we just skip
						currentTime += duration;
						break;
					case 'Note':
						allNotes.push({
							midiNotes: [pitchToMidi(element.pitch)],
							duration,
							time: currentTime
						});
						currentTime += duration;
						break;
					case 'Chord':
						allNotes.push({
							midiNotes: element.pitches.map(pitchToMidi),
							duration,
							time: currentTime
						});
						currentTime += duration;
						break;
				}
			}
		}
	}

	// Sort by time so progress tracking (setCurrentPosition) makes sense
	return allNotes.sort((a, b) => a.time - b.time);
}

export function usePlayback(source: string, initialTempo: number = 120): UsePlaybackReturn {
	const [isPlaying, setIsPlaying] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const [currentPosition, setCurrentPosition] = useState(0);
	const [tempo, setTempoState] = useState(initialTempo);

	const pianoRef = useRef<Piano | null>(null);
	const scheduledEventsRef = useRef<number[]>([]);
	const startTimeRef = useRef<number>(0);
	const pauseTimeRef = useRef<number>(0);

	// Initialize piano instrument
	useEffect(() => {
		const loadPiano = async () => {
			if (pianoRef.current) return;

			setIsLoading(true);
			try {
				const piano = new Piano({
					velocities: 5,
				});

				piano.toDestination();

				await piano.load();

				pianoRef.current = piano;
				setIsLoaded(true);
			} catch (error) {
				console.error('Failed to load piano samples:', error);
			} finally {
				setIsLoading(false);
			}
		};

		loadPiano();

		return () => {
			pianoRef.current?.dispose();
		};
	}, []);

	const clearScheduledEvents = useCallback(() => {
		scheduledEventsRef.current.forEach(id => Tone.getTransport().clear(id));
		scheduledEventsRef.current = [];
	}, []);

	const play = useCallback(async () => {
		if (!pianoRef.current || !isLoaded) return;

		// Start audio context if needed
		await Tone.start();

		const notes = extractNotes(source, tempo);
		if (notes.length === 0) return;

		clearScheduledEvents();

		Tone.getTransport().bpm.value = tempo;

		const resumeTime = isPaused ? pauseTimeRef.current : 0;
		startTimeRef.current = Tone.now() - resumeTime;

		let maxTime = 0;

		notes.forEach((note, index) => {
			// Skip notes that already passed if we are resuming
			if (note.time < resumeTime) {
				return;
			}

			const eventId = Tone.getTransport().schedule((t) => {
				if (note.midiNotes.length > 0) {
					note.midiNotes.forEach(midi => {
						const noteName = Tone.Frequency(midi, 'midi').toNote();
						pianoRef.current?.keyDown({
							note: noteName,
							time: t,
							velocity: 0.8
						});
						pianoRef.current?.keyUp({
							note: noteName,
							time: t + (note.duration * 0.9)
						});
					});
				}
				setCurrentPosition(index);
			}, note.time);

			scheduledEventsRef.current.push(eventId);
			maxTime = Math.max(maxTime, note.time + note.duration);
		});

		// Schedule stop at end
		const endEventId = Tone.getTransport().schedule((t) => {
			Tone.getTransport().scheduleOnce(() => stop(), t);
		}, maxTime);
		scheduledEventsRef.current.push(endEventId);

		Tone.getTransport().start();
		setIsPlaying(true);
		setIsPaused(false);
	}, [source, tempo, isPaused, isLoaded, clearScheduledEvents]);

	const pause = useCallback(() => {
		Tone.getTransport().pause();
		pauseTimeRef.current = Tone.now() - startTimeRef.current;
		setIsPlaying(false);
		setIsPaused(true);
	}, []);

	const stop = useCallback(() => {
		Tone.getTransport().stop();
		clearScheduledEvents();
		setIsPlaying(false);
		setIsPaused(false);
		setCurrentPosition(0);
		pauseTimeRef.current = 0;
	}, [clearScheduledEvents]);

	const setTempo = useCallback((newTempo: number) => {
		setTempoState(newTempo);
		Tone.getTransport().bpm.value = newTempo;
	}, []);

	return {
		isPlaying,
		isPaused,
		isLoading,
		isLoaded,
		currentPosition,
		tempo,
		play,
		pause,
		stop,
		setTempo,
	};
}

