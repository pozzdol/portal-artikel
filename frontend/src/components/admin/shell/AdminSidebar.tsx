'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/shadcn/sidebar';
import { useMe } from '@/lib/api/admin/auth';

import {
  filterNav,
  isNavActive,
  NAV_GROUPS,
  PROFILE_ITEM,
  type NavItem,
} from './nav';

export type AdminBrandProps = { name: string; logoUrl: string };

// Gold bar on the left edge marks the active entry (also when collapsed).
const ACTIVE_MARKER =
  'relative before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:bg-transparent data-active:before:bg-gold data-active:font-medium';

function NavEntry({ item, active }: { item: NavItem; active: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className={ACTIVE_MARKER}
      >
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
        >
          <Icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdminSidebar({ brand }: { brand: AdminBrandProps }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const groups = useMemo(
    () => filterNav(NAV_GROUPS, me?.permissions),
    [me?.permissions],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border h-12 justify-center border-b px-3 group-data-[collapsible=icon]:px-2 lg:h-14">
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2.5"
          aria-label={`Dasbor ${brand.name}`}
        >
          <Image
            src={brand.logoUrl}
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0 object-contain"
          />
          <span className="truncate font-serif text-[21px] leading-none font-bold tracking-[0.03em] group-data-[collapsible=icon]:hidden">
            {brand.name}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="[scrollbar-width:thin] gap-0 overflow-y-auto py-2 pb-2">
        {groups.map((group, i) => (
          <SidebarGroup key={group.label ?? `g${i}`} className="py-1">
            {group.label ? (
              <SidebarGroupLabel className="text-meta h-7 text-[12px] font-medium">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <NavEntry
                    key={item.href}
                    item={item}
                    active={isNavActive(pathname, item.href)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border bg-sidebar border-t">
        <SidebarMenu>
          <NavEntry
            item={PROFILE_ITEM}
            active={isNavActive(pathname, PROFILE_ITEM.href)}
          />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
