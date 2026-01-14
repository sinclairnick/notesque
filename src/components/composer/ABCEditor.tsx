import { useRef, useEffect, useState } from 'react';

interface ABCEditorProps {
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

// ABC notation syntax highlighting helper
function highlightABC(text: string): string {
	// This is a simple regex-based highlighter
	return text
		// Headers (X:, T:, M:, etc.)
		.replace(/^([A-Z]:)(.*)$/gm, '<span class="abc-header">$1</span><span class="abc-header-value">$2</span>')
		// Bar lines
		.replace(/(\|+|:\||:\|:|:\||:\|)/g, '<span class="abc-barline">$1</span>')
		// Notes with accidentals
		.replace(/([_=^]+)([A-Ga-g])/g, '<span class="abc-accidental">$1</span><span class="abc-note">$2</span>')
		// Plain notes
		.replace(/(?<![A-Za-z_=^])([A-Ga-g])(?![A-Za-z:])/g, '<span class="abc-note">$1</span>')
		// Rests
		.replace(/\b(z\d*)\b/g, '<span class="abc-rest">$1</span>')
		// Numbers (durations)
		.replace(/(\d+)/g, '<span class="abc-duration">$1</span>');
}

export function ABCEditor({ value, onChange, className = '' }: ABCEditorProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const highlightRef = useRef<HTMLDivElement>(null);
	const [lineCount, setLineCount] = useState(1);

	// Sync scroll between textarea and highlight overlay
	const handleScroll = () => {
		if (textareaRef.current && highlightRef.current) {
			highlightRef.current.scrollTop = textareaRef.current.scrollTop;
			highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
		}
	};

	useEffect(() => {
		setLineCount(value.split('\n').length);
	}, [value]);

	return (
		<div className={`relative flex h-full bg-slate-950 rounded-lg overflow-hidden ${className}`}>
			{/* Line numbers */}
			<div className="flex-none w-12 bg-slate-900 text-slate-500 text-right py-4 pr-2 font-mono text-sm leading-6 select-none overflow-hidden">
				{Array.from({ length: lineCount }, (_, i) => (
					<div key={i}>{i + 1}</div>
				))}
			</div>

			{/* Editor area */}
			<div className="relative flex-1 overflow-hidden">
				{/* Syntax highlight overlay */}
				<div
					ref={highlightRef}
					className="absolute inset-0 py-4 px-3 font-mono text-sm leading-6 whitespace-pre-wrap break-all pointer-events-none overflow-hidden text-slate-300"
					dangerouslySetInnerHTML={{ __html: highlightABC(value.replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '\n' }}
					aria-hidden="true"
				/>

				{/* Actual textarea */}
				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onScroll={handleScroll}
					className="absolute inset-0 w-full h-full py-4 px-3 font-mono text-sm leading-6 bg-transparent text-transparent caret-white resize-none outline-none"
					spellCheck={false}
					autoCapitalize="off"
					autoCorrect="off"
					placeholder="Enter ABC notation..."
				/>
			</div>

			{/* Styles for syntax highlighting */}
			<style>{`
        .abc-header {
          color: #f472b6;
          font-weight: bold;
        }
        .abc-header-value {
          color: #a78bfa;
        }
        .abc-barline {
          color: #6b7280;
          font-weight: bold;
        }
        .abc-note {
          color: #60a5fa;
        }
        .abc-accidental {
          color: #fbbf24;
        }
        .abc-rest {
          color: #6b7280;
          font-style: italic;
        }
        .abc-duration {
          color: #34d399;
        }
      `}</style>
		</div>
	);
}
