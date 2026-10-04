import {
  AwardIcon,
  CalendarDaysIcon,
  ClapperboardIcon,
  FileTextIcon,
  FolderTreeIcon,
  HistoryIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  ListTreeIcon,
  MessageSquareQuoteIcon,
  NewspaperIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TagsIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

/** Permission codes used by the admin UI (custom roles may add others). */
export type PermissionCode =
  | 'dashboard.view'
  | 'articles.read'
  | 'articles.create'
  | 'articles.update'
  | 'articles.update_any'
  | 'articles.publish'
  | 'articles.delete'
  | 'categories.manage'
  | 'tags.manage'
  | 'media.manage'
  | 'events.manage'
  | 'alumni.manage'
  | 'videos.manage'
  | 'homepage.manage'
  | 'snippets.manage'
  | 'pages.manage'
  | 'menus.manage'
  | 'settings.manage'
  | 'users.manage'
  | 'authors.manage'
  | 'roles.manage'
  | 'audit.view';

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Any-of; omitted = visible to every signed-in user. */
  perms?: readonly PermissionCode[];
};

export type NavGroup = {
  /** Omitted for the ungrouped top entry (dashboard) and the profile entry. */
  label?: string;
  items: readonly NavItem[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      {
        title: 'Dasbor',
        href: '/admin',
        icon: LayoutDashboardIcon,
        perms: ['dashboard.view'],
      },
    ],
  },
  {
    label: 'Konten',
    items: [
      {
        title: 'Artikel',
        href: '/admin/articles',
        icon: NewspaperIcon,
        perms: ['articles.read'],
      },
      {
        title: 'Kategori',
        href: '/admin/categories',
        icon: FolderTreeIcon,
        perms: ['categories.manage'],
      },
      {
        title: 'Tag',
        href: '/admin/tags',
        icon: TagsIcon,
        perms: ['tags.manage'],
      },
      {
        title: 'Pustaka media',
        href: '/admin/media',
        icon: ImagesIcon,
        perms: ['media.manage'],
      },
    ],
  },
  {
    label: 'Komunitas',
    items: [
      {
        title: 'Agenda',
        href: '/admin/events',
        icon: CalendarDaysIcon,
        perms: ['events.manage'],
      },
      {
        title: 'Tokoh Alumni',
        href: '/admin/alumni',
        icon: AwardIcon,
        perms: ['alumni.manage'],
      },
      {
        title: 'Video',
        href: '/admin/videos',
        icon: ClapperboardIcon,
        perms: ['videos.manage'],
      },
    ],
  },
  {
    label: 'Tampilan',
    items: [
      {
        title: 'Beranda',
        href: '/admin/homepage',
        icon: LayoutTemplateIcon,
        perms: ['homepage.manage'],
      },
      {
        title: 'Snippet',
        href: '/admin/snippets',
        icon: MessageSquareQuoteIcon,
        perms: ['snippets.manage'],
      },
      {
        title: 'Halaman statis',
        href: '/admin/pages',
        icon: FileTextIcon,
        perms: ['pages.manage'],
      },
      {
        title: 'Menu',
        href: '/admin/menus',
        icon: ListTreeIcon,
        perms: ['menus.manage'],
      },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      {
        title: 'Pengaturan situs',
        href: '/admin/settings',
        icon: SettingsIcon,
        perms: ['settings.manage'],
      },
      {
        title: 'Pengguna',
        href: '/admin/users',
        icon: UsersIcon,
        perms: ['users.manage', 'authors.manage'],
      },
      {
        title: 'Role & izin',
        href: '/admin/roles',
        icon: ShieldCheckIcon,
        perms: ['roles.manage'],
      },
      {
        title: 'Log aktivitas',
        href: '/admin/audit-logs',
        icon: HistoryIcon,
        perms: ['audit.view'],
      },
    ],
  },
];

/** Always visible; rendered in the sidebar footer. */
export const PROFILE_ITEM: NavItem = {
  title: 'Profil saya',
  href: '/admin/profile',
  icon: UserRoundIcon,
};

/** Any-of permission check; an empty/omitted list always passes. */
export function hasAnyPermission(
  granted: readonly string[] | undefined,
  required: readonly string[] | undefined,
): boolean {
  if (!required || required.length === 0) return true;
  if (!granted) return false;
  return required.some((p) => granted.includes(p));
}

/** Groups with only the items the user may open; empty groups are dropped. */
export function filterNav(
  groups: readonly NavGroup[],
  permissions: readonly string[] | undefined,
): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => hasAnyPermission(permissions, it.perms)),
    }))
    .filter((g) => g.items.length > 0);
}

/** True when `pathname` is `href` or below it ('/admin' only matches itself). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin' || pathname === '/admin/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type Crumb = { label: string; href?: string };

const SUB_SEGMENT_LABELS: Record<string, string> = { new: 'Baru' };

/**
 * Breadcrumb trail for a pathname: [group] › item › (Baru | Sunting). The
 * dashboard is the root and gets no trail of its own besides "Dasbor".
 */
export function breadcrumbFor(pathname: string): Crumb[] {
  const all: { group?: string; item: NavItem }[] = [
    ...NAV_GROUPS.flatMap((g) =>
      g.items.map((item) => ({ group: g.label, item })),
    ),
    { item: PROFILE_ITEM },
  ];
  const match = all
    .filter(({ item }) => isNavActive(pathname, item.href))
    .sort((a, b) => b.item.href.length - a.item.href.length)[0];
  if (!match) return [{ label: 'Dasbor', href: '/admin' }];
  if (match.item.href === '/admin') return [{ label: 'Dasbor' }];

  const crumbs: Crumb[] = [];
  if (match.group) crumbs.push({ label: match.group });
  const rest = pathname
    .slice(match.item.href.length)
    .split('/')
    .filter(Boolean);
  if (rest.length === 0) {
    crumbs.push({ label: match.item.title });
    return crumbs;
  }
  crumbs.push({ label: match.item.title, href: match.item.href });
  const sub = rest[0];
  crumbs.push({ label: SUB_SEGMENT_LABELS[sub] ?? 'Sunting' });
  return crumbs;
}
