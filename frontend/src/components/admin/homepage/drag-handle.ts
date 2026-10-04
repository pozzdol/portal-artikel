import type { SortableHandleProps } from '@/components/admin/SortableList';

/** Flattens SortableList's handle props into spreadable button props. */
export function dragHandleProps({
  ref,
  attributes,
  listeners,
}: SortableHandleProps) {
  return { ref, ...attributes, ...listeners };
}
