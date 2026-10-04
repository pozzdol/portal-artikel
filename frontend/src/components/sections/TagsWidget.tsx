import { TagChip } from '@/components/ui/TagChip';
import { WidgetHeading } from '@/components/ui/WidgetHeading';
import type { TagWidgetItem } from '@/lib/api/types';

/** Sidebar widget: popular tag chips. */
export function TagsWidget({ items }: { items: TagWidgetItem[] }) {
  return (
    <div>
      <WidgetHeading>Tag Populer</WidgetHeading>
      <div className="flex flex-wrap gap-2">
        {items.map((tag) => (
          <TagChip key={tag.slug} href={tag.url}>
            {tag.name}
          </TagChip>
        ))}
      </div>
    </div>
  );
}
