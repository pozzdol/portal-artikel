import { describe, expect, test } from 'bun:test';

import {
  flattenTree,
  getProjection,
  nestTree,
  type TreeItem,
} from './SortableTree';

type Item = { id: number; name: string };

const tree: TreeItem<Item>[] = [
  {
    id: 1,
    name: 'Yayasan',
    children: [
      { id: 11, name: 'Kegiatan' },
      { id: 12, name: 'Pengumuman' },
    ],
  },
  { id: 2, name: 'Alumni' },
  {
    id: 3,
    name: 'Kajian',
    children: [{ id: 31, name: 'Fikih' }],
  },
];

describe('flattenTree', () => {
  test('preserves order and computes depth/parentId', () => {
    const flat = flattenTree(tree);
    expect(flat.map((n) => [n.id, n.parentId, n.depth])).toEqual([
      [1, null, 0],
      [11, 1, 1],
      [12, 1, 1],
      [2, null, 0],
      [3, null, 0],
      [31, 3, 1],
    ]);
  });

  test('keeps the item payload', () => {
    const flat = flattenTree(tree);
    expect(flat.find((n) => n.id === 11)?.name).toBe('Kegiatan');
  });

  test('handles an empty tree', () => {
    expect(flattenTree<Item>([])).toEqual([]);
  });
});

describe('nestTree', () => {
  test('is the inverse of flattenTree', () => {
    const rebuilt = nestTree(flattenTree(tree));
    expect(rebuilt).toEqual(tree);
  });

  test('respects flat array order for siblings', () => {
    const flat = flattenTree(tree);
    // Move id 12 before id 11 (still children of 1).
    const reordered = [flat[0], flat[2], flat[1], ...flat.slice(3)];
    const rebuilt = nestTree(reordered);
    expect(rebuilt[0].children?.map((c) => c.id)).toEqual([12, 11]);
  });

  test('re-parenting: moving a node under a new parentId', () => {
    const flat = flattenTree(tree).map((n) =>
      n.id === 2 ? { ...n, parentId: 3, depth: 1 } : n,
    );
    const rebuilt = nestTree(flat);
    const kajian = rebuilt.find((n) => n.id === 3);
    // Children are appended in flat-array encounter order; id 2 (index 3) precedes id 31
    // (index 5), matching how a real drag places the moved item among its new siblings.
    expect(kajian?.children?.map((c) => c.id)).toEqual([2, 31]);
    expect(rebuilt.some((n) => n.id === 2)).toBe(false);
  });

  test('a leaf node has no children key', () => {
    const rebuilt = nestTree(flattenTree(tree));
    const alumni = rebuilt.find((n) => n.id === 2);
    expect(alumni?.children).toBeUndefined();
  });
});

describe('getProjection', () => {
  const flat = flattenTree(tree);

  test('dropping at the very top (no previous item) is always depth 0', () => {
    // Drag id 2 (depth 0) to before id 1 — even with a large rightward delta, there is no
    // previous item to nest under.
    const p = getProjection(flat, 2, 1, 5, 2, undefined);
    expect(p.depth).toBe(0);
    expect(p.parentId).toBeNull();
  });

  test('dropping between two depth-1 siblings forces depth 1 under their parent', () => {
    // Drag id 2 in between id 11 and id 12 (both children of id 1, depth 1): the
    // surrounding context forces depth 1 regardless of the drag delta.
    const p = getProjection(flat, 2, 12, 0, 2, undefined);
    expect(p.depth).toBe(1);
    expect(p.parentId).toBe(1);
  });

  test('never exceeds maxDepth - 1 even with a large rightward delta', () => {
    const p = getProjection(flat, 2, 12, 10, 2, undefined);
    expect(p.depth).toBeLessThanOrEqual(1);
  });

  test('canNestUnder can veto a parent, falling back to depth 0', () => {
    const p = getProjection(flat, 2, 12, 0, 2, () => false);
    expect(p.depth).toBe(0);
    expect(p.parentId).toBeNull();
  });
});
