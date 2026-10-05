import { cn } from '@/lib/cn';

export type FormActionsProps = {
  /** Buttons (Cancel, Save draft, Publish, …), in visual order. */
  children: React.ReactNode;
  className?: string;
  /** Stick to the bottom of the viewport while scrolling a long form (default true). */
  sticky?: boolean;
};

/** Consistent action row at the bottom of admin forms. */
export function FormActions({
  children,
  className,
  sticky = true,
}: FormActionsProps) {
  return (
    <div
      className={cn(
        'border-line bg-background flex flex-wrap items-center justify-end gap-2 border-t px-1 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&_button]:min-h-11 lg:[&_button]:min-h-9',
        sticky && 'shadow-[0_-8px_24px_-16px_rgb(0_0_0/0.25)]',
        sticky && 'sticky bottom-0 z-10',
        className,
      )}
    >
      {children}
    </div>
  );
}
