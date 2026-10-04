'use client';

import * as React from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '@/lib/cn';

const INDENT_WIDTH = 24;

export type TreeItem<T = Record<string, unknown>> = T & {
  id: string | number;
  children?: TreeItem<T>[];
};

export type FlatTreeItem<T = Record<string, unknown>> = T & {
  id: string | number;
  parentId: string | number | null;
  depth: number;
};

/** Depth-first flatten of a tree into a flat, order-preserving list. */
export function flattenTree<T extends object>(
  items: TreeItem<T>[],
  parentId: string | number | null = null,
  depth = 0,
): FlatTreeItem<T>[] {
  const out: FlatTreeItem<T>[] = [];
  for (const item of items) {
    const { children, ...rest } = item;
    out.push({ ...(rest as T & { id: string | number }), parentId, depth });
    if (children && children.length > 0) {
      out.push(...flattenTree<T>(children, item.id, depth + 1));
    }
  }
  return out;
}

/** Inverse of flattenTree: rebuilds nesting from parentId, preserving array order
 * (so a caller can reorder/re-parent the flat list, then rebuild the tree to save). */
export function nestTree<T extends object>(
  flat: FlatTreeItem<T>[],
): TreeItem<T>[] {
  const byId = new Map<string | number, TreeItem<T>>();
  for (const node of flat) {
    const rest = { ...node } as Record<string, unknown>;
    delete rest.parentId;
    delete rest.depth;
    byId.set(node.id, rest as TreeItem<T>);
  }
  const roots: TreeItem<T>[] = [];
  for (const node of flat) {
    const current = byId.get(node.id) as TreeItem<T>;
    if (node.parentId !== null && byId.has(node.parentId)) {
      const parent = byId.get(node.parentId) as TreeItem<T>;
      parent.children = [...(parent.children ?? []), current];
    } else {
      roots.push(current);
    }
  }
  return roots;
}

export type Projection = { depth: number; parentId: string | number | null };

/**
 * Computes the drop depth/parent for a drag in progress: clamped to `maxDepth` levels
 * (0-indexed — maxDepth=2 allows depth 0 and 1), and to what neighbours allow (a node can
 * only nest one level deeper than the item above it, and no deeper than the item below it).
 * Adapted from dnd-kit's sortable-tree example, generalized over a flat item list.
 */
export function getProjection<T extends object>(
  items: FlatTreeItem<T>[],
  activeId: string | number,
  overId: string | number,
  dragDepthDelta: number,
  maxDepth: number,
  canNestUnder?: (parent: FlatTreeItem<T>) => boolean,
): Projection {
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const overIndex = items.findIndex((i) => i.id === overId);
  if (activeIndex === -1 || overIndex === -1)
    return { depth: 0, parentId: null };

  const newItems = arrayMove(items, activeIndex, overIndex);
  const previousItem = newItems[overIndex - 1] as FlatTreeItem<T> | undefined;
  const nextItem = newItems[overIndex + 1] as FlatTreeItem<T> | undefined;
  const activeItem = items[activeIndex];

  const projectedDepth = activeItem.depth + dragDepthDelta;
  const maxDepthAllowed = previousItem
    ? Math.min(previousItem.depth + 1, maxDepth - 1)
    : 0;
  const minDepthAllowed = nextItem ? nextItem.depth : 0;
  let depth = Math.min(
    Math.max(projectedDepth, minDepthAllowed),
    Math.max(maxDepthAllowed, 0),
  );
  depth = Math.max(0, depth);

  let parentId: string | number | null = null;
  if (depth > 0) {
    for (let i = overIndex - 1; i >= 0; i--) {
      if (newItems[i].depth === depth - 1) {
        parentId = newItems[i].id;
        break;
      }
    }
    if (parentId !== null && canNestUnder) {
      const parent = newItems.find((i) => i.id === parentId);
      if (parent && !canNestUnder(parent)) {
        depth = 0;
        parentId = null;
      }
    }
  }
  return { depth, parentId };
}

export type SortableTreeHandleProps = {
  ref: (el: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
};

export type SortableTreeRenderContext = {
  depth: number;
  handleProps: SortableTreeHandleProps;
  isDragging: boolean;
  /** True while this row is the current drop target. */
  isOver: boolean;
};

export type SortableTreeProps<T extends object> = {
  items: TreeItem<T>[];
  /** Levels allowed (2 = top-level + one level of children — categories, header menu). */
  maxDepth?: number;
  onChange: (items: TreeItem<T>[]) => void;
  renderItem: (item: T, ctx: SortableTreeRenderContext) => React.ReactNode;
  /** Return false to forbid nesting *under* a given item. */
  canNest?: (item: T) => boolean;
  disabled?: boolean;
  className?: string;
};

export function SortableTree<T extends object>({
  items,
  maxDepth = 2,
  onChange,
  renderItem,
  canNest,
  disabled,
  className,
}: SortableTreeProps<T>) {
  const flat = React.useMemo(() => flattenTree<T>(items), [items]);
  const [activeId, setActiveId] = React.useState<string | number | null>(null);
  const [overId, setOverId] = React.useState<string | number | null>(null);
  const [depthDelta, setDepthDelta] = React.useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = React.useMemo(() => flat.map((i) => String(i.id)), [flat]);
  const nestGuard = canNest
    ? (p: FlatTreeItem<T>) => canNest(p as unknown as T)
    : undefined;

  const projection =
    activeId != null && overId != null
      ? getProjection<T>(
          flat,
          activeId,
          overId,
          depthDelta,
          maxDepth,
          nestGuard,
        )
      : null;

  function reset() {
    setActiveId(null);
    setOverId(null);
    setDepthDelta(0);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
    setOverId(event.active.id);
    setDepthDelta(0);
  }

  function handleDragMove(event: DragMoveEvent) {
    setDepthDelta(Math.round(event.delta.x / INDENT_WIDTH));
    setOverId(event.over?.id ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    reset();
    if (!over) return;

    const finalProjection = getProjection<T>(
      flat,
      active.id,
      over.id,
      depthDelta,
      maxDepth,
      nestGuard,
    );
    const activeIndex = flat.findIndex((i) => i.id === active.id);
    const overIndex = flat.findIndex((i) => i.id === over.id);
    if (activeIndex === -1 || overIndex === -1) return;

    const reordered = arrayMove(flat, activeIndex, overIndex).map((node) =>
      node.id === active.id
        ? {
            ...node,
            depth: finalProjection.depth,
            parentId: finalProjection.parentId,
          }
        : node,
    );
    onChange(nestTree(reordered));
  }

  function handleDragCancel() {
    reset();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext
        items={ids}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        <div className={cn('flex flex-col gap-1', className)}>
          {flat.map((node) => {
            const depth =
              activeId != null && node.id === activeId && projection
                ? projection.depth
                : node.depth;
            return (
              <SortableTreeRow
                key={node.id}
                id={String(node.id)}
                depth={depth}
                item={node as unknown as T}
                renderItem={renderItem}
                isOver={overId === node.id}
                disabled={disabled}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTreeRow<T extends object>({
  id,
  depth,
  item,
  renderItem,
  isOver,
  disabled,
}: {
  id: string;
  depth: number;
  item: T;
  renderItem: SortableTreeProps<T>['renderItem'];
  isOver: boolean;
  disabled?: boolean;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: depth * INDENT_WIDTH,
    zIndex: isDragging ? 1 : undefined,
    opacity: isDragging ? 0.6 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, {
        depth,
        handleProps: { ref: setActivatorNodeRef, attributes, listeners },
        isDragging,
        isOver,
      })}
    </div>
  );
}
