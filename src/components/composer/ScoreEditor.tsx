import { useRef, useCallback } from 'react';
import Editor, { type OnMount, loader } from '@monaco-editor/react';
import { registerScoreLanguage, SCORE_LANG_ID, validate } from '@/lib/score-monaco';

// Pre-load monaco to avoid flashing
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs' } });

interface ScoreEditorProps {
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

export function ScoreEditor({ value, onChange, className = '' }: ScoreEditorProps) {
	const editorRef = useRef<any>(null);
	const monacoRef = useRef<any>(null);

	const handleEditorWillMount = useCallback((monaco: any) => {
		// Register the language once
		if (!monaco.languages.getLanguages().some((lang: any) => lang.id === SCORE_LANG_ID)) {
			registerScoreLanguage(monaco);
		}
	}, []);

	const handleEditorDidMount: OnMount = (editor, monaco) => {
		editorRef.current = editor;
		monacoRef.current = monaco;

		// Initial validation
		updateMarkers(editor.getValue(), monaco, editor);

		// Focus editor
		editor.focus();
	};

	const updateMarkers = (content: string, monaco: any, editor: any) => {
		const markers = validate(content);
		monaco.editor.setModelMarkers(editor.getModel(), SCORE_LANG_ID, markers);
	};

	const handleEditorChange = (newValue: string | undefined) => {
		if (newValue !== undefined) {
			onChange(newValue);
			if (monacoRef.current && editorRef.current) {
				updateMarkers(newValue, monacoRef.current, editorRef.current);
			}
		}
	};

	return (
		<div className={`flex flex-col h-full bg-[#1e1e1e] rounded-lg overflow-hidden border border-slate-800 ${className}`}>
			<Editor
				height="100%"
				language={SCORE_LANG_ID}
				value={value}
				theme="vs-dark"
				onChange={handleEditorChange}
				beforeMount={handleEditorWillMount}
				onMount={handleEditorDidMount}
				options={{
					minimap: { enabled: false },
					fontSize: 14,
					lineHeight: 22,
					fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace",
					renderLineHighlight: 'all',
					scrollBeyondLastLine: false,
					tabSize: 2,
					insertSpaces: true,
					wordWrap: 'on',
					automaticLayout: true,
					padding: { top: 16, bottom: 16 },
				}}
			/>
		</div>
	);
}
