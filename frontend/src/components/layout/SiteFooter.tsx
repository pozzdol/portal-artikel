import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { FixedImage } from '@/components/ui/ImageBox';
import { replaceYear } from '@/lib/format';
import type { Media, MenuItem, SitePayload } from '@/lib/api/types';
import { SocialIcon } from './SocialIcon';

function FooterColumn({ title, items }: { title: string; items: MenuItem[] }) {
  if (!items.length) return null;

  return (
    <div>
      <h2 className="mb-[18px] text-[12px] font-bold tracking-[0.1em] uppercase">
        {title}
      </h2>
      <div className="text-soft flex flex-col gap-2.5 text-[13.5px] font-medium">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            target={item.open_new_tab ? '_blank' : undefined}
            rel={item.open_new_tab ? 'noopener noreferrer' : undefined}
            className="text-soft"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SiteFooter({ site }: { site: SitePayload }) {
  const identity = site.settings['site.identity'];
  const footer = site.settings['site.footer'];
  const contact = site.settings['site.contact'];
  const social = site.settings['site.social'] ?? [];
  const name = identity?.name ?? 'ALMAIDAH';

  const logoMedia: Media = identity?.logo ?? {
    id: 0,
    url: '/brand/logo.png',
    width: 38,
    height: 38,
    alt: `Logo ${name}`,
    caption: null,
  };

  const categories = site.menus.footer_categories ?? [];
  const about = site.menus.footer_about ?? [];
  const legal = site.menus.footer_legal ?? [];

  return (
    <footer className="border-line border-t pt-16 pb-7">
      <Container>
        <div className="border-line grid grid-cols-1 gap-12 border-b pb-11 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <FixedImage media={logoMedia} size={38} alt={`Logo ${name}`} />
              <span className="font-serif text-[19px] font-bold">{name}</span>
            </div>
            {footer?.description ? (
              <p className="text-meta mb-4 max-w-[320px] text-[13.5px] leading-[1.7]">
                {footer.description}
              </p>
            ) : null}
            {social.length > 0 ? (
              <div className="flex gap-3">
                {social.map((item) => (
                  <SocialIcon
                    key={item.platform}
                    platform={item.platform}
                    url={item.url}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <FooterColumn title="Kategori" items={categories} />
          <FooterColumn title="Tentang" items={about} />

          {contact ? (
            <div>
              <h2 className="mb-[18px] text-[12px] font-bold tracking-[0.1em] uppercase">
                Kontak
              </h2>
              <p className="text-soft text-[13.5px] leading-[1.8]">
                {contact.address.split('\n').map((line, index) => (
                  <span key={`${line}-${index}`}>
                    {index > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
                <br />
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
                <br />
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>
                  {contact.phone}
                </a>
              </p>
            </div>
          ) : null}
        </div>

        <div className="text-ghost flex flex-col gap-3 pt-[22px] text-[12.5px] sm:flex-row sm:items-center sm:justify-between">
          <span>{footer?.copyright ? replaceYear(footer.copyright) : ''}</span>
          {legal.length > 0 ? (
            <div className="flex gap-5">
              {legal.map((item) => (
                <Link key={item.id} href={item.href} className="text-ghost">
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
