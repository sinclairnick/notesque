import { useState, useCallback, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { parseScore } from '@/lib/score-parser';
import type { Pitch, Duration } from '@/lib/score-types';

interface UsePlaybackReturn {
	isPlaying: boolean;
	isPaused: boolean;
	currentPosition: number;
	tempo: number;

	play: () => Promise<void>;
	pause: () => void;
	stop: () => void;
	setTempo: (tempo: number) => void;
}

// Convert pitch to frequency
function pitchToFrequency(pitch: Pitch): number {
	const noteMap: Record<string, number> = {
		'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
	};

	let semitone = noteMap[pitch.note];
	if (pitch.accidental === '#') semitone += 1;
	if (pitch.accidental === 'b') semitone -= 1;
	if (pitch.accidental === '##') semitone += 2;
	if (pitch.accidental === 'bb') semitone -= 2;

	// A4 = 440Hz, MIDI note 69
	const midiNote = (pitch.octave + 1) * 12 + semitone;
	return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Convert duration to seconds
function durationToSeconds(duration: Duration, tempo: number): number {
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
function extractNotes(source: string, tempo: number): Array<{ frequencies: number[]; duration: number }> {
	const result = parseScore(source);
	if (!result.score) return [];

	const notes: Array<{ frequencies: number[]; duration: number }> = [];

	// For now, just use first staff
	const staff = result.score.staves[0];
	if (!staff) return [];

	for (const measure of staff.measures) {
		for (const element of measure.elements) {
			const duration = durationToSeconds(element.duration, tempo);

			switch (element.type) {
				case 'rest':
					notes.push({ frequencies: [], duration });
					break;
				case 'note':
					notes.push({ frequencies: [pitchToFrequency(element.pitch)], duration });
					break;
				case 'chord':
					notes.push({
						frequencies: element.pitches.map(pitchToFrequency),
						duration
					});
					break;
			}
		}
	}

	return notes;
}

export function usePlayback(source: string, initialTempo: number = 120): UsePlaybackReturn {
	const [isPlaying, setIsPlaying] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [currentPosition, setCurrentPosition] = useState(0);
	const [tempo, setTempoState] = useState(initialTempo);

	const synthRef = useRef<Tone.PolySynth | null>(null);
	const scheduledEventsRef = useRef<number[]>([]);
	const startTimeRef = useRef<number>(0);
	const pauseTimeRef = useRef<number>(0);

	// Initialize synth
	useEffect(() => {
		synthRef.current = new Tone.PolySynth(Tone.Synth, {
			oscillator: { type: 'triangle' },
			envelope: {
				attack: 0.02,
				decay: 0.1,
				sustain: 0.3,
				release: 0.4,
			},
		}).toDestination();

		return () => {
			synthRef.current?.dispose();
		};
	}, []);

	const clearScheduledEvents = useCallback(() => {
		scheduledEventsRef.current.forEach(id => Tone.getTransport().clear(id));
		scheduledEventsRef.current = [];
	}, []);

	const play = useCallback(async () => {
		if (!synthRef.current) return;

		// Start audio context if needed
		await Tone.start();

		const notes = extractNotes(source, tempo);
		if (notes.length === 0) return;

		clearScheduledEvents();

		Tone.getTransport().bpm.value = tempo;

		let time = isPaused ? pauseTimeRef.current : 0;
		startTimeRef.current = Tone.now() - time;

		notes.forEach((note, index) => {
			if (time < (isPaused ? pauseTimeRef.current : 0)) {
				time += note.duration;
				return;
			}

			const eventId = Tone.getTransport().schedule((t) => {
				if (note.frequencies.length > 0) {
					synthRef.current?.triggerAttackRelease(note.frequencies, note.duration * 0.9, t);
				}
				setCurrentPosition(index);
			}, time);

			scheduledEventsRef.current.push(eventId);
			time += note.duration;
		});

		// Schedule stop at end
		const endEventId = Tone.getTransport().schedule(() => {
			stop();
		}, time);
		scheduledEventsRef.current.push(endEventId);

		Tone.getTransport().start();
		setIsPlaying(true);
		setIsPaused(false);
	}, [source, tempo, isPaused, clearScheduledEvents]);

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
		currentPosition,
		tempo,
		play,
		pause,
		stop,
		setTempo,
	};
}
