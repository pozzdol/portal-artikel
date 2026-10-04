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
        'border-line bg-background/95 supports-[backdrop-filter]:bg-background/80 flex flex-wrap items-center justify-end gap-2 border-t px-1 py-4 backdrop-blur',
        sticky && 'sticky bottom-0 z-10',
        className,
      )}
    >
      {children}
    </div>
  );
}
