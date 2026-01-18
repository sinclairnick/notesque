import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { OpenSheetMusicDisplay as OSMD } from 'opensheetmusicdisplay';
import { parseScoreToAST } from '@/lib/score-parser';
import { transpileToMusicXML } from '@/lib/score-musicxml';

interface SheetMusicRendererProps {
	source: string;
	currentPosition?: number;
	onNoteClick?: (staffIndex: number, measureIndex: number, noteIndex: number) => void;
}

export function SheetMusicRenderer({ source, currentPosition: _currentPosition, onNoteClick: _onNoteClick }: SheetMusicRendererProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const osmdRef = useRef<OSMD | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Parse and transpile to MusicXML
	const musicXml = useMemo(() => {
		try {
			const { ast, errors } = parseScoreToAST(source);
			if (!ast || errors.length > 0) {
				return { xml: null, error: errors.map(e => `Line ${e.line}: ${e.message}`).join('\n') };
			}
			// Check if there are any measures to render
			const hasMeasures = ast.staves.some(s => s.measures.length > 0);
			if (!hasMeasures) {
				return { xml: null, error: null }; // No content yet, not an error
			}
			const xml = transpileToMusicXML(ast);
			return { xml, error: null };
		} catch (e) {
			return { xml: null, error: e instanceof Error ? e.message : 'Unknown error' };
		}
	}, [source]);

	const render = useCallback(async () => {
		if (!containerRef.current) return;

		// Clear previous content on error or no content
		if (musicXml.error) {
			setError(musicXml.error);
			return;
		}

		if (!musicXml.xml) {
			// No content to render yet
			containerRef.current.innerHTML = '';
			setError(null);
			return;
		}

		setError(null);

		try {
			// Always clear and re-initialize OSMD for now to ensure clean multi-stave layout
			// Reusing the instance sometimes causes issues with part/staff counts
			containerRef.current.innerHTML = '';
			osmdRef.current = new OSMD(containerRef.current, {
				autoResize: true,
				backend: 'svg',
				drawTitle: false,
				drawSubtitle: false,
				drawComposer: false,
				drawCredits: false,
				drawPartNames: false,
			});

			// Load and render
			await osmdRef.current.load(musicXml.xml);
			osmdRef.current.render();
		} catch (e) {
			console.error('OSMD render error:', e);
			setError(e instanceof Error ? e.message : 'Render error');
		}
	}, [musicXml]);

	useEffect(() => {
		render();

		// Re-render on resize
		const resizeObserver = new ResizeObserver(() => {
			if (osmdRef.current) {
				osmdRef.current.render();
			}
		});

		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}

		return () => resizeObserver.disconnect();
	}, [render]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			osmdRef.current = null;
		};
	}, []);

	if (error) {
		return (
			<div className="w-full h-full min-h-[200px] bg-white dark:bg-slate-900 rounded-lg overflow-auto p-4">
				<pre className="text-red-500 text-sm whitespace-pre-wrap">{error}</pre>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className="w-full h-full min-h-[200px] bg-white dark:bg-slate-900 rounded-lg overflow-auto"
		/>
	);
}
