import { cn } from '@/lib/cn';

export type SeoSnippetPreviewProps = {
  title: string;
  description: string;
  url: string;
  className?: string;
};

/** Google-like search result preview for the SEO title/description fields. */
export function SeoSnippetPreview({
  title,
  description,
  url,
  className,
}: SeoSnippetPreviewProps) {
  return (
    <div
      className={cn('border-line bg-paper rounded-md border p-4', className)}
    >
      <p className="text-success mb-1 truncate text-xs">{url}</p>
      <p className="text-gold-strong truncate text-lg leading-snug">
        {title || 'Judul akan muncul di sini'}
      </p>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
        {description || 'Deskripsi akan muncul di sini.'}
      </p>
    </div>
  );
}
