import { useState, useCallback, useEffect } from 'react';
import {
	Play, Pause, Square, RotateCcw, RotateCw,
	Plus, FolderOpen, Save, Download,
	Music, FileText, Keyboard, Wand2, Loader2
} from 'lucide-react';
import { SheetMusicRenderer } from '@/components/composer/SheetMusicRenderer';
import { ScoreEditor } from '@/components/composer/ScoreEditor';
import { DraggableNumberInput } from '@/components/ui/draggable-number-input';
import { TooltipButton } from '@/components/ui/tooltip';
import { useScore } from '@/hooks/useScore';
import { usePlayback } from '@/hooks/usePlayback';
import { useFileSystem } from '@/hooks/useFileSystem';
import { formatScore } from '@/lib/score-formatter';

export function ComposerPage() {
	const {
		source,
		metadata,
		isDirty,
		updateSource,
		setSource,
		newScore,
		undo,
		redo,
		canUndo,
		canRedo,
	} = useScore();

	const {
		isPlaying,
		isLoading,
		isLoaded,
		currentPosition,
		tempo,
		play,
		pause,
		stop,
		setTempo,
	} = usePlayback(source, metadata.tempo);

	const { filename, openFile, saveFile, saveFileAs, exportAsScore } = useFileSystem();

	// Panel visibility state
	const [showVisualEditor, setShowVisualEditor] = useState(true);
	const [showTextEditor, setShowTextEditor] = useState(true);
	const [panelRatio, setPanelRatio] = useState(0.5);

	// Handle keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey) {
				switch (e.key) {
					case 's':
						e.preventDefault();
						if (e.shiftKey) {
							saveFileAs(source, metadata.title ?? 'Untitled');
						} else {
							saveFile(source, metadata.title ?? 'Untitled');
						}
						break;
					case 'o':
						e.preventDefault();
						handleOpen();
						break;
					case 'n':
						e.preventDefault();
						handleNew();
						break;
					case 'z':
						e.preventDefault();
						if (e.shiftKey) {
							redo();
						} else {
							undo();
						}
						break;
					case '1':
						e.preventDefault();
						setShowVisualEditor(!showVisualEditor);
						break;
					case '2':
						e.preventDefault();
						setShowTextEditor(!showTextEditor);
						break;
					case ' ':
						e.preventDefault();
						if (isPlaying) {
							pause();
						} else {
							play();
						}
						break;
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [source, metadata, isPlaying, showVisualEditor, showTextEditor, undo, redo, saveFile, saveFileAs, play, pause]);

	const handleNew = useCallback(() => {
		if (isDirty && !confirm('You have unsaved changes. Create a new file anyway?')) {
			return;
		}
		newScore();
	}, [isDirty, newScore]);

	const handleOpen = useCallback(async () => {
		if (isDirty && !confirm('You have unsaved changes. Open a new file anyway?')) {
			return;
		}
		const content = await openFile();
		if (content) {
			setSource(content);
		}
	}, [isDirty, openFile, setSource]);

	const handleFormat = useCallback(() => {
		try {
			const formatted = formatScore(source);
			setSource(formatted);
		} catch (err) {
			console.error('Formatting error:', err);
		}
	}, [source, setSource]);

	const handlePlayPause = useCallback(() => {
		if (isPlaying) {
			pause();
		} else {
			play();
		}
	}, [isPlaying, play, pause]);

	// Calculate panel widths
	const getLeftPanelWidth = () => {
		if (!showVisualEditor) return 0;
		if (!showTextEditor) return 100;
		return panelRatio * 100;
	};

	const getRightPanelWidth = () => {
		if (!showTextEditor) return 0;
		if (!showVisualEditor) return 100;
		return (1 - panelRatio) * 100;
	};

	return (
		<div className="h-screen flex flex-col bg-background text-foreground">
			{/* Header / Toolbar */}
			<header className="flex-none h-14 px-4 flex items-center gap-2 border-b border-border bg-card">
				{/* App title */}
				<div className="flex items-center gap-2 mr-4">
					<Music className="w-5 h-5 text-primary" />
					<span className="font-semibold text-lg">Notesque</span>
				</div>

				{/* Divider */}
				<div className="w-px h-6 bg-border" />

				{/* File actions */}
				<div className="flex items-center gap-1">
					<TooltipButton
						onClick={handleNew}
						className="p-2 hover:bg-accent rounded-md transition-colors"
						tooltip="New"
						shortcut="⌘N"
					>
						<Plus className="w-4 h-4" />
					</TooltipButton>
					<TooltipButton
						onClick={handleOpen}
						className="p-2 hover:bg-accent rounded-md transition-colors"
						tooltip="Open"
						shortcut="⌘O"
					>
						<FolderOpen className="w-4 h-4" />
					</TooltipButton>
					<TooltipButton
						onClick={() => saveFile(source, metadata.title ?? 'Untitled')}
						className="p-2 hover:bg-accent rounded-md transition-colors"
						tooltip="Save"
						shortcut="⌘S"
					>
						<Save className="w-4 h-4" />
					</TooltipButton>
					<TooltipButton
						onClick={() => exportAsScore(source, metadata.title ?? 'Untitled')}
						className="p-2 hover:bg-accent rounded-md transition-colors"
						tooltip="Export .score"
					>
						<Download className="w-4 h-4" />
					</TooltipButton>
				</div>

				{/* Divider */}
				<div className="w-px h-6 bg-border" />

				{/* Undo/Redo */}
				<div className="flex items-center gap-1">
					<TooltipButton
						onClick={undo}
						disabled={!canUndo}
						className="p-2 hover:bg-accent rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						tooltip="Undo"
						shortcut="⌘Z"
					>
						<RotateCcw className="w-4 h-4" />
					</TooltipButton>
					<TooltipButton
						onClick={redo}
						disabled={!canRedo}
						className="p-2 hover:bg-accent rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						tooltip="Redo"
						shortcut="⇧⌘Z"
					>
						<RotateCw className="w-4 h-4" />
					</TooltipButton>

					<TooltipButton
						onClick={handleFormat}
						className="p-2 hover:bg-accent rounded-md transition-colors"
						tooltip="Format Score"
						shortcut="⌘B"
					>
						<Wand2 className="w-4 h-4" />
					</TooltipButton>
				</div>

				{/* Divider */}
				<div className="w-px h-6 bg-border" />

				{/* Playback controls */}
				<div className="flex items-center gap-1">
					{!isLoaded && (
						<div className="flex items-center gap-2 px-3 text-xs text-muted-foreground animate-pulse">
							<Loader2 className="w-3 h-3 animate-spin" />
							<span>Loading Piano Samples...</span>
						</div>
					)}
					<TooltipButton
						onClick={stop}
						className="p-2 hover:bg-accent rounded-md transition-colors"
						tooltip="Stop"
					>
						<Square className="w-4 h-4" />
					</TooltipButton>
					<TooltipButton
						onClick={handlePlayPause}
						disabled={!isLoaded}
						className="p-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait"
						tooltip={isPlaying ? 'Pause' : (isLoading ? 'Loading...' : 'Play')}
						shortcut="Space"
					>
						{isPlaying ? (
							<Pause className="w-4 h-4" />
						) : isLoading ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Play className="w-4 h-4" />
						)}
					</TooltipButton>
				</div>

				{/* Tempo control */}
				<DraggableNumberInput
					value={tempo}
					onChange={setTempo}
					min={40}
					max={240}
					step={1}
					shiftStep={10}
					unit="BPM"
					className="ml-2"
				/>

				{/* Spacer */}
				<div className="flex-1" />

				{/* Filename */}
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					{filename || metadata.title}
					{isDirty && <span className="text-primary">•</span>}
				</div>

				{/* Divider */}
				<div className="w-px h-6 bg-border ml-4" />

				{/* View toggles */}
				<div className="flex items-center gap-1">
					<TooltipButton
						onClick={() => setShowVisualEditor(!showVisualEditor)}
						className={`p-2 rounded-md transition-colors ${showVisualEditor ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
						tooltip="Toggle Visual Editor"
						shortcut="⌘1"
					>
						<Music className="w-4 h-4" />
					</TooltipButton>
					<TooltipButton
						onClick={() => setShowTextEditor(!showTextEditor)}
						className={`p-2 rounded-md transition-colors ${showTextEditor ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
						tooltip="Toggle Text Editor"
						shortcut="⌘2"
					>
						<FileText className="w-4 h-4" />
					</TooltipButton>
				</div>
			</header>

			{/* Main content - split pane */}
			<main className="flex-1 flex overflow-hidden">
				{/* Visual Editor Panel */}
				{showVisualEditor && (
					<div
						className="flex-none overflow-hidden border-r border-border transition-all duration-200"
						style={{ width: `${getLeftPanelWidth()}%` }}
					>
						<div className="h-full p-4 overflow-auto">
							<SheetMusicRenderer
								source={source}
								currentPosition={isPlaying ? currentPosition : undefined}
							/>
						</div>
					</div>
				)}

				{/* Resize handle */}
				{showVisualEditor && showTextEditor && (
					<div
						className="flex-none w-1 bg-border hover:bg-primary cursor-col-resize transition-colors"
						onMouseDown={(e) => {
							e.preventDefault();
							const startX = e.clientX;
							const startRatio = panelRatio;

							const handleMouseMove = (e: MouseEvent) => {
								const delta = e.clientX - startX;
								const containerWidth = window.innerWidth;
								const newRatio = Math.min(0.8, Math.max(0.2, startRatio + delta / containerWidth));
								setPanelRatio(newRatio);
							};

							const handleMouseUp = () => {
								document.removeEventListener('mousemove', handleMouseMove);
								document.removeEventListener('mouseup', handleMouseUp);
							};

							document.addEventListener('mousemove', handleMouseMove);
							document.addEventListener('mouseup', handleMouseUp);
						}}
					/>
				)}

				{/* Text Editor Panel */}
				{showTextEditor && (
					<div
						className="flex-1 overflow-hidden transition-all duration-200"
						style={{ width: `${getRightPanelWidth()}%` }}
					>
						<ScoreEditor
							value={source}
							onChange={updateSource}
							className="h-full"
						/>
					</div>
				)}

				{/* Empty state when both panels are hidden */}
				{!showVisualEditor && !showTextEditor && (
					<div className="flex-1 flex items-center justify-center text-muted-foreground">
						<div className="text-center">
							<p>All panels are hidden</p>
							<p className="text-sm mt-2">Press Ctrl+1 or Ctrl+2 to show a panel</p>
						</div>
					</div>
				)}
			</main>

			{/* Footer / Status bar */}
			<footer className="flex-none h-8 px-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border bg-card">
				<div className="flex items-center gap-4">
					<span>Key: {metadata.key ?? 'C major'}</span>
					<span>Time: {metadata.time?.beats ?? 4}/{metadata.time?.beatType ?? 4}</span>
					<span>Tempo: {metadata.tempo} BPM</span>
				</div>
				<div className="flex items-center gap-4">
					<span className="flex items-center gap-1">
						<Keyboard className="w-3 h-3" />
						Ctrl+S: Save | Space: Play/Pause
					</span>
				</div>
			</footer>
		</div>
	);
}
