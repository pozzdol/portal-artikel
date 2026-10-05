'use client';

import { Share2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/shadcn/button';

type ShareButtonsProps = {
  /** Absolute canonical URL of the article. */
  url: string;
  title: string;
};

const noopSubscribe = () => () => {};

const shareButtonClass =
  'h-11 justify-center rounded-none border-line bg-transparent px-3.5 text-[13px] font-medium lg:h-9 text-ink shadow-none transition-colors hover:border-ink hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent';

/** Share links (WhatsApp, Facebook, X) + copy-to-clipboard; no third-party SDK (doc 06 §5 item 8). */
export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  // Server snapshot is false, so SSR and hydration match; the client value applies after mount.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  );
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

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // User dismissed the share sheet; nothing to do.
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
      <span className="text-faint col-span-2 text-[12px] font-bold tracking-[0.1em] uppercase sm:col-span-1">
        Bagikan
      </span>
      {canShare ? (
        <Button
          type="button"
          variant="outline"
          onClick={nativeShare}
          className={`${shareButtonClass} col-span-2 sm:col-span-1`}
        >
          <Share2 className="size-4" aria-hidden="true" />
          Bagikan…
        </Button>
      ) : null}
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
