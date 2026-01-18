import { useState, useCallback, useRef } from 'react';
import { DEFAULT_SCORE_TEMPLATE } from '@/lib/score-types';
import { parseScoreToAST } from '@/lib/score-parser';
import type { ScoreNode, MetadataNode } from '@/lib/score-ast';

interface ScoreState {
	source: string;
	ast: ScoreNode | null;
	isDirty: boolean;
	history: string[];
	historyIndex: number;
}

interface UseScoreReturn {
	source: string;
	ast: ScoreNode | null;
	metadata: MetadataNode;
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

const DEFAULT_METADATA: MetadataNode = {
	kind: 'Metadata',
	loc: { line: 0, column: 0, start: 0, end: 0 },
	title: 'Untitled',
	key: 'C major',
	time: { kind: 'TimeSignature', loc: { line: 0, column: 0, start: 0, end: 0 }, beats: 4, beatType: 4 },
	tempo: 120,
	defaultOctave: 4,
};

function parseAndCache(source: string): ScoreNode | null {
	const { ast } = parseScoreToAST(source);
	return ast;
}

export function useScore(): UseScoreReturn {
	const [state, setState] = useState<ScoreState>(() => {
		const ast = parseAndCache(DEFAULT_SCORE_TEMPLATE);
		return {
			source: DEFAULT_SCORE_TEMPLATE,
			ast,
			isDirty: false,
			history: [DEFAULT_SCORE_TEMPLATE],
			historyIndex: 0,
		};
	});

	// Debounce ref for source updates
	const updateTimeoutRef = useRef<number | undefined>(undefined);

	const setSource = useCallback((source: string) => {
		const ast = parseAndCache(source);
		setState(prev => {
			const newHistory = prev.history.slice(0, prev.historyIndex + 1);
			newHistory.push(source);
			if (newHistory.length > MAX_HISTORY) {
				newHistory.shift();
			}
			return {
				source,
				ast,
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
		const ast = parseAndCache(source);

		// Update state immediately
		setState(prev => ({
			...prev,
			source,
			ast,
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
		const ast = parseAndCache(DEFAULT_SCORE_TEMPLATE);
		setState({
			source: DEFAULT_SCORE_TEMPLATE,
			ast,
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
			const ast = parseAndCache(source);
			return {
				...prev,
				source,
				ast,
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
			const ast = parseAndCache(source);
			return {
				...prev,
				source,
				ast,
				historyIndex: newIndex,
				isDirty: true,
			};
		});
	}, []);

	const markClean = useCallback(() => {
		setState(prev => ({ ...prev, isDirty: false }));
	}, []);

	// Extract metadata from parsed score or use defaults
	const metadata = state.ast?.metadata || DEFAULT_METADATA;

	return {
		source: state.source,
		ast: state.ast,
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
