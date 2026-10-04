'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/shadcn/button';

type ShareButtonsProps = {
  /** Absolute canonical URL of the article. */
  url: string;
  title: string;
};

const shareButtonClass =
  'h-auto rounded-none border-line bg-transparent px-3.5 py-1.5 text-[12.5px] font-medium text-ink shadow-none transition-colors hover:border-ink hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent';

/** Share links (WhatsApp, Facebook, X) + copy-to-clipboard; no third-party SDK (doc 06 §5 item 8). */
export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = [
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable (older browsers, insecure context); ignore.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-faint text-[12px] font-bold tracking-[0.1em] uppercase">
        Bagikan
      </span>
      {links.map((link) => (
        <Button
          key={link.label}
          asChild
          variant="outline"
          className={shareButtonClass}
        >
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        </Button>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={copyLink}
        className={shareButtonClass}
      >
        {copied ? 'Tautan disalin' : 'Salin tautan'}
      </Button>
    </div>
  );
}
