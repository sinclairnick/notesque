import { useState, useCallback } from 'react';

interface RecentFile {
	name: string;
	handle?: FileSystemFileHandle;
	lastOpened: Date;
}

interface UseFileSystemReturn {
	filename: string | null;
	hasFileSystemAccess: boolean;
	recentFiles: RecentFile[];

	newFile: () => void;
	openFile: () => Promise<string | null>;
	saveFile: (source: string, title: string) => Promise<boolean>;
	saveFileAs: (source: string, title: string) => Promise<boolean>;
	exportAsScore: (source: string, title: string) => void;
}

// Check if File System Access API is available
const hasFileSystemAccess = 'showOpenFilePicker' in window;

export function useFileSystem(): UseFileSystemReturn {
	const [filename, setFilename] = useState<string | null>(null);
	const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
	const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => {
		try {
			const stored = localStorage.getItem('notesque-recent-files');
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});

	const addToRecent = useCallback((name: string, handle?: FileSystemFileHandle) => {
		setRecentFiles(prev => {
			const filtered = prev.filter(f => f.name !== name);
			const newRecent = [{ name, handle, lastOpened: new Date() }, ...filtered].slice(0, 10);
			localStorage.setItem('notesque-recent-files', JSON.stringify(
				newRecent.map(f => ({ name: f.name, lastOpened: f.lastOpened }))
			));
			return newRecent;
		});
	}, []);

	const newFile = useCallback(() => {
		setFilename(null);
		setFileHandle(null);
	}, []);

	const openFile = useCallback(async (): Promise<string | null> => {
		try {
			if (hasFileSystemAccess) {
				const [handle] = await (window as any).showOpenFilePicker({
					types: [{
						description: 'Score Music Files',
						accept: { 'text/plain': ['.score'] },
					}],
				});

				const file = await handle.getFile();
				const content = await file.text();

				setFilename(file.name);
				setFileHandle(handle);
				addToRecent(file.name, handle);

				return content;
			} else {
				// Fallback: use file input
				return new Promise((resolve) => {
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = '.score';
					input.onchange = async (e) => {
						const file = (e.target as HTMLInputElement).files?.[0];
						if (!file) {
							resolve(null);
							return;
						}

						const content = await file.text();
						setFilename(file.name);
						addToRecent(file.name);
						resolve(content);
					};
					input.click();
				});
			}
		} catch (err) {
			if ((err as Error).name !== 'AbortError') {
				console.error('Error opening file:', err);
			}
			return null;
		}
	}, [addToRecent]);

	const saveFile = useCallback(async (source: string, title: string): Promise<boolean> => {
		if (!fileHandle) {
			return saveFileAs(source, title);
		}

		try {
			const writable = await (fileHandle as any).createWritable();
			await writable.write(source);
			await writable.close();
			return true;
		} catch (err) {
			console.error('Error saving file:', err);
			return false;
		}
	}, [fileHandle]);

	const saveFileAs = useCallback(async (source: string, title: string): Promise<boolean> => {
		try {
			if (hasFileSystemAccess) {
				const handle = await (window as any).showSaveFilePicker({
					suggestedName: title + '.score',
					types: [{
						description: 'Score Music Files',
						accept: { 'text/plain': ['.score'] },
					}],
				});

				const writable = await handle.createWritable();
				await writable.write(source);
				await writable.close();

				setFileHandle(handle);
				setFilename(handle.name);
				addToRecent(handle.name, handle);
				return true;
			} else {
				// Fallback: download file
				const blob = new Blob([source], { type: 'text/plain' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = title + '.score';
				a.click();
				URL.revokeObjectURL(url);
				setFilename(title + '.score');
				return true;
			}
		} catch (err) {
			if ((err as Error).name !== 'AbortError') {
				console.error('Error saving file:', err);
			}
			return false;
		}
	}, [addToRecent]);

	const exportAsScore = useCallback((source: string, title: string) => {
		const blob = new Blob([source], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = title + '.score';
		a.click();
		URL.revokeObjectURL(url);
	}, []);

	return {
		filename,
		hasFileSystemAccess,
		recentFiles,
		newFile,
		openFile,
		saveFile,
		saveFileAs,
		exportAsScore,
	};
}
