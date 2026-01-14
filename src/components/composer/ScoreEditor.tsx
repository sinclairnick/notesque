import { useRef, useCallback } from 'react';

interface ScoreEditorProps {
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

export function ScoreEditor({ value, onChange, className = '' }: ScoreEditorProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const lineNumbersRef = useRef<HTMLDivElement>(null);

	// Sync scroll between textarea and line numbers
	const handleScroll = useCallback(() => {
		if (textareaRef.current && lineNumbersRef.current) {
			lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
		}
	}, []);

	// Calculate line numbers
	const lineCount = value.split('\n').length;

	// Handle tab key for indentation
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Tab') {
			e.preventDefault();
			const textarea = textareaRef.current;
			if (!textarea) return;

			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const newValue = value.substring(0, start) + '  ' + value.substring(end);
			onChange(newValue);

			// Restore cursor position
			requestAnimationFrame(() => {
				textarea.selectionStart = textarea.selectionEnd = start + 2;
			});
		}
	};

	return (
		<div className={`flex h-full bg-slate-950 rounded-lg overflow-hidden ${className}`}>
			{/* Line numbers */}
			<div
				ref={lineNumbersRef}
				className="flex-none w-12 bg-slate-900 text-slate-500 text-right py-4 pr-3 select-none overflow-hidden font-mono text-sm"
				style={{ lineHeight: '1.5rem' }}
			>
				{Array.from({ length: lineCount }, (_, i) => (
					<div key={i}>{i + 1}</div>
				))}
			</div>

			{/* Editor textarea with basic styling */}
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onScroll={handleScroll}
				onKeyDown={handleKeyDown}
				className="flex-1 py-4 px-3 bg-slate-950 text-slate-200 resize-none outline-none border-none font-mono text-sm"
				style={{
					lineHeight: '1.5rem',
					tabSize: 2,
				}}
				spellCheck={false}
				autoCapitalize="off"
				autoCorrect="off"
				placeholder="Enter Score notation..."
			/>
		</div>
	);
}
