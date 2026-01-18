import { useState, useRef, useCallback, useEffect } from 'react';

interface DraggableNumberInputProps {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	shiftStep?: number;
	altStep?: number;
	label?: string;
	unit?: string;
	className?: string;
}

export function DraggableNumberInput({
	value,
	onChange,
	min = 0,
	max = 100,
	step = 1,
	shiftStep = 10,
	altStep = 0.1,
	label,
	unit,
	className = '',
}: DraggableNumberInputProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [inputValue, setInputValue] = useState(String(value));
	const inputRef = useRef<HTMLInputElement>(null);
	const dragStartRef = useRef<{ x: number; value: number } | null>(null);

	// Sync input value with prop
	useEffect(() => {
		if (!isEditing) {
			setInputValue(String(value));
		}
	}, [value, isEditing]);

	const clamp = useCallback((val: number) => {
		return Math.min(max, Math.max(min, val));
	}, [min, max]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		// Don't start drag if clicking on input
		if (isEditing) return;

		e.preventDefault();
		dragStartRef.current = { x: e.clientX, value };
		setIsDragging(true);
	}, [value, isEditing]);

	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (!dragStartRef.current) return;

		const delta = e.clientX - dragStartRef.current.x;

		// Determine step based on modifiers
		let currentStep = step;
		if (e.shiftKey) currentStep = shiftStep;
		if (e.altKey) currentStep = altStep;

		// Calculate new value (1px = 1 step by default)
		const stepMultiplier = currentStep / step;
		const newValue = dragStartRef.current.value + (delta * currentStep) / stepMultiplier;

		onChange(clamp(Math.round(newValue / step) * step));
	}, [step, shiftStep, altStep, onChange, clamp]);

	const handleMouseUp = useCallback(() => {
		dragStartRef.current = null;
		setIsDragging(false);
	}, []);

	// Add/remove global listeners for drag
	useEffect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = 'ew-resize';
			document.body.style.userSelect = 'none';
		}

		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};
	}, [isDragging, handleMouseMove, handleMouseUp]);

	const handleDoubleClick = useCallback(() => {
		setIsEditing(true);
		setTimeout(() => inputRef.current?.select(), 0);
	}, []);

	const handleInputBlur = useCallback(() => {
		setIsEditing(false);
		const parsed = parseFloat(inputValue);
		if (!isNaN(parsed)) {
			onChange(clamp(Math.round(parsed / step) * step));
		} else {
			setInputValue(String(value));
		}
	}, [inputValue, onChange, clamp, step, value]);

	const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleInputBlur();
		} else if (e.key === 'Escape') {
			setIsEditing(false);
			setInputValue(String(value));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			const newStep = e.shiftKey ? shiftStep : step;
			onChange(clamp(value + newStep));
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			const newStep = e.shiftKey ? shiftStep : step;
			onChange(clamp(value - newStep));
		}
	}, [handleInputBlur, value, onChange, clamp, step, shiftStep]);

	return (
		<div
			className={`inline-flex items-center gap-1.5 select-none ${className}`}
			onMouseDown={handleMouseDown}
			onDoubleClick={handleDoubleClick}
		>
			{label && (
				<span className="text-xs text-muted-foreground">{label}</span>
			)}

			<div
				className={`
					relative flex items-center gap-0.5 px-2 py-1 rounded
					bg-muted/50 border border-transparent
					transition-colors
					${!isEditing ? 'cursor-ew-resize hover:bg-muted hover:border-border' : ''}
					${isDragging ? 'bg-muted border-primary' : ''}
				`}
			>
				{isEditing ? (
					<input
						ref={inputRef}
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onBlur={handleInputBlur}
						onKeyDown={handleInputKeyDown}
						className="w-12 bg-transparent text-sm font-medium text-center outline-none"
						autoFocus
					/>
				) : (
					<span className="text-sm font-medium tabular-nums min-w-[2rem] text-center">
						{value}
					</span>
				)}

				{unit && (
					<span className="text-xs text-muted-foreground">{unit}</span>
				)}
			</div>

			{/* Visual drag indicator */}
			{!isEditing && (
				<div className="flex gap-px opacity-40">
					<div className="w-0.5 h-3 bg-current rounded-full" />
					<div className="w-0.5 h-3 bg-current rounded-full" />
				</div>
			)}
		</div>
	);
}
