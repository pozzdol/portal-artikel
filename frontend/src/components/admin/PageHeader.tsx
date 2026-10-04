import { cn } from '@/lib/cn';

export type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  /** Rendered above the title, e.g. an <AdminBreadcrumb />. */
  breadcrumb?: React.ReactNode;
  /** Buttons rendered on the right, e.g. "+ Tambah". */
  actions?: React.ReactNode;
  className?: string;
};

/** Admin page title bar: serif title, optional description/breadcrumb/actions. */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn('border-line flex flex-col gap-3 border-b pb-5', className)}
    >
      {breadcrumb}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground font-serif text-2xl font-medium sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
