import { Link, type LinkOptions } from '@tiptap/extension-link';

export type LinkPolicy = 'body' | 'inline';

const SAFE_HREF_RE = /^(?:https?:\/\/[^\s/?#]+|mailto:[^\s]+$|\/(?!\/)|#)/i;
const ABSOLUTE_RE = /^[a-z][a-z0-9+.-]*:/i;

/** Whether an href is allowed by the server sanitizer (http/https/mailto/relative). */
export function isSafeHref(href: unknown): href is string {
  return (
    typeof href === 'string' && !/\s/.test(href) && SAFE_HREF_RE.test(href)
  );
}

/**
 * Mirrors Go's url.Parse(...).Host != "": bluemonday treats such links as
 * "fully qualified" and adds target="_blank" + rel="noopener" to them.
 */
export function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]/i.test(href);
}

/**
 * Normalises user input from the link popover: trims, prefixes bare domains
 * with https://. Returns null when the result would be rejected by the server.
 */
export function normalizeHref(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let href = raw;
  if (!ABSOLUTE_RE.test(raw) && !raw.startsWith('/') && !raw.startsWith('#')) {
    href =
      raw.includes('@') && !raw.includes('/')
        ? `mailto:${raw}`
        : `https://${raw}`;
  }
  return isSafeHref(href) ? href : null;
}

/**
 * Attributes exactly as the server sanitizer emits them, so the stored HTML
 * equals what the editor sent:
 * - body policy keeps rel and appends target="_blank" for external links;
 * - inline policy drops rel, then appends target="_blank" and rel="noopener".
 */
export function linkRenderAttrs(
  href: string,
  policy: LinkPolicy,
): Record<string, string> {
  if (!isExternalHref(href)) return { href };
  return policy === 'body'
    ? { href, rel: 'noopener noreferrer', target: '_blank' }
    : { href, target: '_blank', rel: 'noopener' };
}

type SafeLinkOptions = LinkOptions & { policy: LinkPolicy };

/**
 * StarterKit's Link with a fixed attribute vocabulary: only href is stored;
 * rel/target are derived at render time to match the sanitizer output.
 */
export const SafeLink = Link.extend<SafeLinkOptions>({
  addOptions() {
    return {
      ...(this.parent?.() as LinkOptions),
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      protocols: [],
      HTMLAttributes: {},
      isAllowedUri: (url) => isSafeHref(url),
      policy: 'body',
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute('href'),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const href = HTMLAttributes.href;
    if (!isSafeHref(href)) return ['a', {}, 0];
    return ['a', linkRenderAttrs(href, this.options.policy), 0];
  },
});
