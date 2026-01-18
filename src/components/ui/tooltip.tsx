import * as React from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

interface TooltipProps {
	children: React.ReactNode;
	content: React.ReactNode;
	side?: 'top' | 'right' | 'bottom' | 'left';
	align?: 'start' | 'center' | 'end';
	delayDuration?: number;
	className?: string;
}

export function Tooltip({
	children,
	content,
	side = 'top',
	align = 'center',
	delayDuration = 300,
	className,
}: TooltipProps) {
	return (
		<TooltipPrimitive.Provider delayDuration={delayDuration}>
			<TooltipPrimitive.Root>
				<TooltipPrimitive.Trigger asChild>
					{children}
				</TooltipPrimitive.Trigger>
				<TooltipPrimitive.Portal>
					<TooltipPrimitive.Content
						side={side}
						align={align}
						sideOffset={4}
						className={cn(
							'z-50 px-2 py-1 text-xs font-medium rounded shadow-md',
							'bg-slate-900 text-slate-100 border border-slate-700',
							'animate-in fade-in-0 zoom-in-95',
							'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
							'data-[side=bottom]:slide-in-from-top-2',
							'data-[side=left]:slide-in-from-right-2',
							'data-[side=right]:slide-in-from-left-2',
							'data-[side=top]:slide-in-from-bottom-2',
							className
						)}
					>
						{content}
						<TooltipPrimitive.Arrow className="fill-slate-900" />
					</TooltipPrimitive.Content>
				</TooltipPrimitive.Portal>
			</TooltipPrimitive.Root>
		</TooltipPrimitive.Provider>
	);
}

// Convenience wrapper for icon buttons with tooltips
interface TooltipButtonProps extends React.ComponentProps<'button'> {
	tooltip: string;
	tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
	shortcut?: string;
}

export const TooltipButton = React.forwardRef<HTMLButtonElement, TooltipButtonProps>(
	({ tooltip, tooltipSide = 'bottom', shortcut, children, ...props }, ref) => {
		const content = shortcut ? (
			<span className="flex items-center gap-2">
				{tooltip}
				<kbd className="px-1 py-0.5 bg-slate-800 rounded text-[10px] font-mono">{shortcut}</kbd>
			</span>
		) : tooltip;

		return (
			<Tooltip content={content} side={tooltipSide}>
				<button ref={ref} {...props}>
					{children}
				</button>
			</Tooltip>
		);
	}
);

TooltipButton.displayName = 'TooltipButton';
