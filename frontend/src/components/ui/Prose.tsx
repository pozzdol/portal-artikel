import { cn } from '@/lib/cn';

type ProseProps = {
  /** Sanitized HTML (article/page `content_html`, event `description_html`, alumni `story_html`, FAQ `answer_html`). */
  html: string;
  className?: string;
  size?: 'article' | 'compact';
};

/** Renders sanitized rich-text HTML with the shared `.prose-almaidah` typography. */
export function Prose({ html, className, size = 'article' }: ProseProps) {
  return (
    <div
      className={cn(
        'prose-almaidah',
        size === 'compact' && 'prose-almaidah--compact',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
