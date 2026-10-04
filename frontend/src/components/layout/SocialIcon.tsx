import type { ReactElement } from 'react';
import type { SocialPlatform } from '@/lib/api/types';

const iconProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
} as const;

function Instagram() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function YouTube() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsApp() {
  return (
    <svg {...iconProps}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function Facebook() {
  return (
    <svg {...iconProps}>
      <path d="M15.5 8.5H18V5h-2.5A4.5 4.5 0 0 0 11 9.5V12H8.5v4H11v6h4v-6h2.5l.5-4H15V9.5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function TikTok() {
  return (
    <svg {...iconProps}>
      <path d="M14 3v11.8a3.7 3.7 0 1 1-3.7-3.7" />
      <path d="M14 3c.4 2.8 2.2 4.8 5 5.1" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" />
    </svg>
  );
}

function Telegram() {
  return (
    <svg {...iconProps}>
      <path d="M21 4L3 11.2l5.8 2M21 4l-3.8 16-6-5.4M21 4L8.8 14.6" />
    </svg>
  );
}

function Website() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.8 2.6 4.2 5.7 4.2 9s-1.4 6.4-4.2 9c-2.8-2.6-4.2-5.7-4.2-9s1.4-6.4 4.2-9z" />
    </svg>
  );
}

const ICONS: Record<SocialPlatform, () => ReactElement> = {
  instagram: Instagram,
  youtube: YouTube,
  whatsapp: WhatsApp,
  facebook: Facebook,
  tiktok: TikTok,
  x: XIcon,
  telegram: Telegram,
  website: Website,
};

const LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
  telegram: 'Telegram',
  website: 'Situs web',
};

export function SocialIcon({
  platform,
  url,
}: {
  platform: SocialPlatform;
  url: string;
}) {
  const Icon = ICONS[platform] ?? Website;
  const label = LABELS[platform] ?? platform;

  return (
    <a
      href={url}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="border-line text-ink flex h-[34px] w-[34px] items-center justify-center rounded-full border"
    >
      <Icon />
    </a>
  );
}
