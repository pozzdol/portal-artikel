import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { FixedImage } from '@/components/ui/ImageBox';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/shadcn/button';
import type { Media, SitePayload } from '@/lib/api/types';
import { HeaderControls } from './HeaderControls';
import { NavLinks } from './NavLinks';
import { TodayLabel } from './TodayLabel';

export function SiteHeader({ site }: { site: SitePayload }) {
  const identity = site.settings['site.identity'];
  const headerOptions = site.settings['header.options'];
  const name = identity?.name ?? 'ALMAIDAH';
  const tagline = identity?.tagline ?? 'Alumni Darul Hikmah Sumedang';
  const navItems = site.menus.header ?? [];

  const showDate = headerOptions?.show_date ?? true;
  const showSearch = headerOptions?.show_search ?? true;
  const showThemeToggle = headerOptions?.show_theme_toggle ?? true;
  const showLoginButton = headerOptions?.show_login_button ?? true;
  const loginLabel = headerOptions?.login_label || 'Login Admin';

  const logoMedia: Media = identity?.logo ?? {
    id: 0,
    url: '/brand/logo.png',
    width: 46,
    height: 46,
    alt: `Logo ${name}`,
    caption: null,
  };

  return (
    <header className="bg-paper border-line sticky top-0 z-50 border-b">
      <Container className="flex flex-nowrap items-center justify-between gap-3 py-2.5 sm:gap-6 lg:py-[18px]">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3.5 sm:shrink-0"
        >
          <FixedImage media={logoMedia} size={46} alt={`Logo ${name}`} />
          <span className="flex flex-col leading-[1.1]">
            <span className="font-serif text-[22px] font-bold tracking-[0.02em]">
              {name}
            </span>
            <span className="text-meta hidden text-[12px] font-medium tracking-[0.08em] uppercase sm:block sm:whitespace-nowrap">
              {tagline}
            </span>
          </span>
        </Link>

        <NavLinks items={navItems} />

        <div className="flex shrink-0 flex-nowrap items-center gap-2 lg:gap-3">
          {showDate ? <TodayLabel /> : null}
          <HeaderControls
            navItems={navItems}
            showSearch={showSearch}
            showLoginButton={showLoginButton}
            loginLabel={loginLabel}
          />
          {showThemeToggle ? <ThemeToggle /> : null}
          {showLoginButton ? (
            <Button
              asChild
              variant="outline"
              className="border-ink hidden h-auto rounded-[8px] bg-transparent px-[18px] py-[9px] text-[13px] font-medium whitespace-nowrap shadow-none hover:bg-transparent lg:inline-flex dark:bg-transparent dark:hover:bg-transparent"
            >
              <Link href="/admin/login">{loginLabel}</Link>
            </Button>
          ) : null}
        </div>
      </Container>
    </header>
  );
}
