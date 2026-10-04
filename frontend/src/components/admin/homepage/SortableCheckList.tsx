'use client';

import * as React from 'react';
import { GripVerticalIcon } from 'lucide-react';

import { SortableList } from '@/components/admin/SortableList';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { cn } from '@/lib/cn';

import { dragHandleProps } from './drag-handle';

export type SortableCheckListProps = {
  /** All allowed values (schema items.enum). */
  options: readonly string[];
  /** Checked values in display order. */
  value: string[];
  onChange: (value: string[]) => void;
  getLabel?: (value: string) => string;
  id?: string;
  disabled?: boolean;
};

/**
 * Checklist whose checked items can be dragged into order (x-ui: widgets).
 * Checked items come first in their saved order; unchecked ones follow.
 */
export function SortableCheckList({
  options,
  value,
  onChange,
  getLabel = (v) => v,
  id,
  disabled,
}: SortableCheckListProps) {
  const checked = React.useMemo(() => new Set(value), [value]);
  const items = React.useMemo(
    () => [
      ...value.filter((v) => options.includes(v)),
      ...options.filter((o) => !checked.has(o)),
    ],
    [options, value, checked],
  );

  function toggle(opt: string, on: boolean) {
    if (on) onChange([...value.filter((v) => v !== opt), opt]);
    else onChange(value.filter((v) => v !== opt));
  }

  return (
    <div id={id} className="border-line border">
      <SortableList
        items={items}
        getId={(v) => v}
        disabled={disabled}
        className="gap-0"
        onReorder={(next) => onChange(next.filter((v) => checked.has(v)))}
        renderItem={(opt, { handleProps, isDragging }) => {
          const on = checked.has(opt);
          const position = on ? value.indexOf(opt) + 1 : null;
          const cid = `${id ?? 'check'}-${opt}`;
          return (
            <div
              className={cn(
                'border-line bg-background flex items-center gap-2 border-b px-2 py-2 last:border-b-0',
                isDragging && 'shadow-md',
              )}
            >
              <button
                type="button"
                {...dragHandleProps(handleProps)}
                disabled={disabled || !on}
                aria-label={`Pindahkan ${getLabel(opt)}`}
                className="text-meta hover:text-foreground cursor-grab p-1 disabled:cursor-default disabled:opacity-30"
              >
                <GripVerticalIcon className="size-4" />
              </button>
              <Checkbox
                id={cid}
                checked={on}
                disabled={disabled}
                onCheckedChange={(c) => toggle(opt, c === true)}
              />
              <label
                htmlFor={cid}
                className={cn('flex-1 text-sm', !on && 'text-meta')}
              >
                {getLabel(opt)}
              </label>
              {position ? (
                <span className="text-meta text-xs tabular-nums">
                  Urutan {position}
                </span>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  );
}
