'use client';

import { useState } from 'react';
import type { MenuItem } from '@/lib/api/types';
import { Button } from '@/components/ui/shadcn/button';
import { MobileMenu } from './MobileMenu';
import { SearchOverlay } from './SearchOverlay';

const iconButtonClass =
  'size-11 lg:size-9 rounded-[8px] border-line bg-transparent shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent';

/**
 * Single client island holding the state for both the search overlay and the
 * mobile navigation drawer, so the (server) SiteHeader stays a Server Component.
 */
export function HeaderControls({
  navItems,
  showSearch,
  showLoginButton,
  loginLabel,
}: {
  navItems: MenuItem[];
  showSearch: boolean;
  showLoginButton?: boolean;
  loginLabel?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 lg:gap-3">
        {showSearch ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Cari"
            onClick={() => setSearchOpen(true)}
            className={iconButtonClass}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Button>
        ) : null}
        {navItems.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Buka menu navigasi"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className={`${iconButtonClass} lg:hidden`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Button>
        ) : null}
      </div>
      {showSearch ? (
        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      ) : null}
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={navItems}
        showLoginButton={showLoginButton}
        loginLabel={loginLabel}
        showSearch={showSearch}
      />
    </>
  );
}
