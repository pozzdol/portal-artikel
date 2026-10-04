import type { TreeItem } from '@/components/admin/SortableTree';
import type {
  AdminMenuItem,
  CategoryTreeNode,
  MenuItemInput,
  MenuLinkType,
} from '@/lib/api/admin/types';

export type MenuNodeData = {
  id: string;
  label: string;
  link_type: MenuLinkType;
  link_target: string;
  open_new_tab: boolean;
  is_active: boolean;
};

export type MenuTreeNode = TreeItem<MenuNodeData>;

export const LINK_TYPE_LABEL: Record<MenuLinkType, string> = {
  url: 'URL',
  route: 'Rute',
  category: 'Kategori',
  page: 'Halaman',
  anchor: 'Anchor',
};

/** Route whitelist (menu.resolveHref / docs/05 §"Menu & pengaturan"). */
export const ROUTE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '/', label: 'Beranda (/)' },
  { value: '/agenda', label: 'Agenda (/agenda)' },
  { value: '/tokoh', label: 'Tokoh (/tokoh)' },
  { value: '/video', label: 'Video (/video)' },
  { value: '/cari', label: 'Cari (/cari)' },
];

function newId(): string {
  return `new-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export function emptyNode(linkType: MenuLinkType = 'url'): MenuNodeData {
  return {
    id: newId(),
    label: '',
    link_type: linkType,
    link_target: '',
    open_new_tab: false,
    is_active: true,
  };
}

/** Server tree -> editable client tree (drops the resolved `href`, keeps ids as strings). */
export function toClientTree(items: AdminMenuItem[]): MenuTreeNode[] {
  return items.map((it) => ({
    id: String(it.id),
    label: it.label,
    link_type: it.link_type,
    link_target: it.link_target,
    open_new_tab: it.open_new_tab,
    is_active: it.is_active,
    children: it.children.length ? toClientTree(it.children) : undefined,
  }));
}

/** Client tree -> PUT /menus/{code}/items body (drops ids; sort_order is server-assigned). */
export function treeToInput(items: MenuTreeNode[]): MenuItemInput[] {
  return items.map((it) => ({
    label: it.label,
    link_type: it.link_type,
    link_target: it.link_target,
    open_new_tab: it.open_new_tab,
    is_active: it.is_active,
    ...(it.children && it.children.length > 0
      ? { children: treeToInput(it.children) }
      : {}),
  }));
}

/** Structural signature (ignoring ids) used to detect unsaved changes. */
export function treeSignature(items: MenuTreeNode[]): string {
  return JSON.stringify(treeToInput(items));
}

export function updateNodeById(
  items: MenuTreeNode[],
  id: string,
  patch: Partial<MenuNodeData>,
): MenuTreeNode[] {
  return items.map((item) => {
    if (item.id === id) return { ...item, ...patch };
    if (item.children?.length) {
      return { ...item, children: updateNodeById(item.children, id, patch) };
    }
    return item;
  });
}

export function removeNodeById(
  items: MenuTreeNode[],
  id: string,
): MenuTreeNode[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) =>
      item.children?.length
        ? { ...item, children: removeNodeById(item.children, id) }
        : item,
    );
}

export function addChildNode(
  items: MenuTreeNode[],
  parentId: string,
  child: MenuNodeData,
): MenuTreeNode[] {
  return items.map((item) => {
    if (item.id === parentId) {
      return { ...item, children: [...(item.children ?? []), child] };
    }
    if (item.children?.length) {
      return {
        ...item,
        children: addChildNode(item.children, parentId, child),
      };
    }
    return item;
  });
}

export function addRootNode(
  items: MenuTreeNode[],
  child: MenuNodeData,
): MenuTreeNode[] {
  return [...items, child];
}

function findParentSlug(
  tree: CategoryTreeNode[],
  slug: string,
): CategoryTreeNode | null {
  for (const node of tree) {
    if (node.children?.some((c) => c.slug === slug)) return node;
  }
  return null;
}

/**
 * Client-side mirror of backend/internal/menu/resolve.go resolveHref, for a
 * live preview before saving. Returns null when the target cannot resolve
 * (mirrors the admin tree's empty href, not the public tree's item drop).
 */
export function computeHrefPreview(
  linkType: MenuLinkType,
  linkTarget: string,
  categoryTree: CategoryTreeNode[],
  pageSlugs: readonly string[],
): string | null {
  const target = linkTarget.trim();
  if (!target) return null;
  switch (linkType) {
    case 'route':
      return ROUTE_OPTIONS.some((r) => r.value === target) ? target : null;
    case 'anchor':
      return `/#${target}`;
    case 'url':
      return /^(https?:\/\/|\/)/.test(target) ? target : null;
    case 'category': {
      for (const node of categoryTree) {
        if (node.slug === target) return `/${node.slug}`;
      }
      const parent = findParentSlug(categoryTree, target);
      return parent ? `/${parent.slug}?sub=${target}` : null;
    }
    case 'page':
      return pageSlugs.includes(target) ? `/halaman/${target}` : null;
    default:
      return null;
  }
}
