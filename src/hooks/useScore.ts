import { useState, useCallback, useRef } from 'react';
import { DEFAULT_SCORE_TEMPLATE } from '@/lib/score-types';
import { parseScore } from '@/lib/score-parser';
import type { ParsedScore, ScoreMetadata } from '@/lib/score-types';

interface ScoreState {
	source: string;  // Raw .score text
	parsed: ParsedScore | null;
	isDirty: boolean;
	history: string[];
	historyIndex: number;
}

interface UseScoreReturn {
	source: string;
	parsed: ParsedScore | null;
	metadata: ScoreMetadata;
	isDirty: boolean;

	// Score operations
	updateSource: (source: string) => void;
	setSource: (source: string) => void;
	newScore: () => void;

	// History
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;

	// File operations
	markClean: () => void;
}

const MAX_HISTORY = 50;

const DEFAULT_METADATA: ScoreMetadata = {
	title: 'Untitled',
	key: 'C major',
	time: { beats: 4, beatType: 4 },
	tempo: 120,
	defaultOctave: 4,
};

function parseAndCache(source: string): ParsedScore | null {
	const result = parseScore(source);
	return result.score;
}

export function useScore(): UseScoreReturn {
	const [state, setState] = useState<ScoreState>(() => {
		const parsed = parseAndCache(DEFAULT_SCORE_TEMPLATE);
		return {
			source: DEFAULT_SCORE_TEMPLATE,
			parsed,
			isDirty: false,
			history: [DEFAULT_SCORE_TEMPLATE],
			historyIndex: 0,
		};
	});

	// Debounce ref for source updates
	const updateTimeoutRef = useRef<number | undefined>(undefined);

	const setSource = useCallback((source: string) => {
		const parsed = parseAndCache(source);
		setState(prev => {
			const newHistory = prev.history.slice(0, prev.historyIndex + 1);
			newHistory.push(source);
			if (newHistory.length > MAX_HISTORY) {
				newHistory.shift();
			}
			return {
				source,
				parsed,
				isDirty: true,
				history: newHistory,
				historyIndex: newHistory.length - 1,
			};
		});
	}, []);

	const updateSource = useCallback((source: string) => {
		// Clear any pending update
		if (updateTimeoutRef.current) {
			window.clearTimeout(updateTimeoutRef.current);
		}

		// Parse immediately for responsive updates
		const parsed = parseAndCache(source);

		// Update state immediately
		setState(prev => ({
			...prev,
			source,
			parsed,
			isDirty: true,
		}));

		// Debounce the history push
		updateTimeoutRef.current = window.setTimeout(() => {
			setState(prev => {
				// Only add to history if source actually changed
				if (prev.history[prev.historyIndex] === source) return prev;

				const newHistory = prev.history.slice(0, prev.historyIndex + 1);
				newHistory.push(source);
				if (newHistory.length > MAX_HISTORY) {
					newHistory.shift();
				}
				return {
					...prev,
					history: newHistory,
					historyIndex: newHistory.length - 1,
				};
			});
		}, 500);
	}, []);

	const newScore = useCallback(() => {
		const parsed = parseAndCache(DEFAULT_SCORE_TEMPLATE);
		setState({
			source: DEFAULT_SCORE_TEMPLATE,
			parsed,
			isDirty: false,
			history: [DEFAULT_SCORE_TEMPLATE],
			historyIndex: 0,
		});
	}, []);

	const undo = useCallback(() => {
		setState(prev => {
			if (prev.historyIndex <= 0) return prev;
			const newIndex = prev.historyIndex - 1;
			const source = prev.history[newIndex];
			const parsed = parseAndCache(source);
			return {
				...prev,
				source,
				parsed,
				historyIndex: newIndex,
				isDirty: true,
			};
		});
	}, []);

	const redo = useCallback(() => {
		setState(prev => {
			if (prev.historyIndex >= prev.history.length - 1) return prev;
			const newIndex = prev.historyIndex + 1;
			const source = prev.history[newIndex];
			const parsed = parseAndCache(source);
			return {
				...prev,
				source,
				parsed,
				historyIndex: newIndex,
				isDirty: true,
			};
		});
	}, []);

	const markClean = useCallback(() => {
		setState(prev => ({ ...prev, isDirty: false }));
	}, []);

	// Extract metadata from parsed score or use defaults
	const metadata = state.parsed?.metadata || DEFAULT_METADATA;

	return {
		source: state.source,
		parsed: state.parsed,
		metadata,
		isDirty: state.isDirty,
		updateSource,
		setSource,
		newScore,
		undo,
		redo,
		canUndo: state.historyIndex > 0,
		canRedo: state.historyIndex < state.history.length - 1,
		markClean,
	};
}
