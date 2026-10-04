'use client';

import Link from 'next/link';
import { LogOutIcon, MoonIcon, UserRoundIcon } from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { useLogout, useMe } from '@/lib/api/admin/auth';
import { useMediaByIds } from '@/lib/api/admin/media';
import { setTheme, useIsDark } from '@/lib/theme';

import { beginSignOut } from './AdminGate';
import { usePermission } from './PermissionGate';

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? [parts[0][0], parts[parts.length - 1][0]]
      : [parts[0]?.[0]];
  return letters.filter(Boolean).join('').toUpperCase() || '?';
}

/** Avatar of the signed-in user (photo needs media.manage to resolve). */
export function MeAvatar({
  size = 'default',
}: {
  size?: 'sm' | 'default' | 'lg';
}) {
  const { data: me } = useMe();
  const canMedia = usePermission('media.manage');
  const { byId } = useMediaByIds([me?.avatar_media_id], { enabled: canMedia });
  const photo = me?.avatar_media_id ? byId.get(me.avatar_media_id) : undefined;
  return (
    <Avatar size={size}>
      {photo ? (
        <AvatarImage src={photo.url} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-muted text-[12px] font-medium">
        {initialsOf(me?.display_name ?? '')}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserMenu() {
  const { data: me } = useMe();
  const logout = useLogout();
  const isDark = useIsDark();

  const signOut = async () => {
    beginSignOut();
    try {
      await logout.mutateAsync();
    } catch {
      // Cookies may already be gone; the login page is the right place anyway.
    }
    window.location.replace('/admin/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-1.5 sm:px-2"
          aria-label="Menu akun"
        >
          <MeAvatar size="sm" />
          <span className="hidden max-w-[160px] truncate text-[13px] font-medium sm:inline">
            {me?.display_name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2 font-normal">
          <span className="text-foreground truncate text-sm font-medium">
            {me?.display_name}
          </span>
          {me?.email ? (
            <span className="text-muted-foreground truncate text-xs">
              {me.email}
            </span>
          ) : null}
          {me?.roles.length ? (
            <span className="text-muted-foreground truncate text-xs">
              {me.roles.map((r) => r.name).join(', ')}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/admin/profile">
              <UserRoundIcon />
              Profil saya
            </Link>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem
            checked={isDark}
            onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
            onSelect={(e) => e.preventDefault()}
          >
            <MoonIcon />
            Mode gelap
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
        >
          <LogOutIcon />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
