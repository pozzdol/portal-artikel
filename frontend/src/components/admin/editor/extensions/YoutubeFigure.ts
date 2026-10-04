import { Node } from '@tiptap/react';

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Extracts the 11-character video id from the common YouTube URL forms:
 * watch?v=, shorts/, live/, embed/ (incl. youtube-nocookie), v/ and youtu.be/.
 * A bare id is accepted too. Returns null for anything else.
 */
export function parseYoutubeId(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (ID_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
    );
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = parts[0] ?? null;
  } else if (YT_HOSTS.has(host)) {
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? ''))
      id = parts[1] ?? null;
  }
  return id && ID_RE.test(id) ? id : null;
}

/** Privacy-enhanced embed URL; the only iframe src the sanitizer accepts. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export const DEFAULT_YOUTUBE_TITLE = 'Video YouTube';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    youtubeFigure: {
      /** Insert a YouTube embed from any supported URL form (or a bare id). */
      setYoutubeFigure: (options: {
        url: string;
        title?: string;
      }) => ReturnType;
    };
  }
}

/**
 * YouTube embed. Serialises to exactly
 * <figure class="youtube"><iframe src="https://www.youtube-nocookie.com/embed/<id>"
 * allowfullscreen="" loading="lazy" title="…"></iframe></figure> — no wrapper div.
 */
export const YoutubeFigure = Node.create({
  name: 'youtubeFigure',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      videoId: {
        default: null,
        rendered: false,
        parseHTML: (el) => {
          const iframe =
            el.tagName === 'IFRAME' ? el : el.querySelector('iframe');
          return parseYoutubeId(iframe?.getAttribute('src'));
        },
      },
      title: {
        default: DEFAULT_YOUTUBE_TITLE,
        rendered: false,
        parseHTML: (el) => {
          const iframe =
            el.tagName === 'IFRAME' ? el : el.querySelector('iframe');
          return iframe?.getAttribute('title')?.trim() || DEFAULT_YOUTUBE_TITLE;
        },
      },
    };
  },

  parseHTML() {
    const hasVideo = (el: HTMLElement) => {
      const iframe = el.tagName === 'IFRAME' ? el : el.querySelector('iframe');
      return parseYoutubeId(iframe?.getAttribute('src')) ? null : false;
    };
    return [
      { tag: 'figure.youtube', priority: 61, getAttrs: hasVideo },
      { tag: 'iframe[src]', getAttrs: hasVideo },
    ];
  },

  renderHTML({ node }) {
    const id = typeof node.attrs.videoId === 'string' ? node.attrs.videoId : '';
    if (!ID_RE.test(id)) return ['figure', { class: 'youtube' }];
    const title =
      (typeof node.attrs.title === 'string' && node.attrs.title.trim()) ||
      DEFAULT_YOUTUBE_TITLE;
    return [
      'figure',
      { class: 'youtube' },
      [
        'iframe',
        {
          src: youtubeEmbedUrl(id),
          allowfullscreen: '',
          loading: 'lazy',
          title,
        },
      ],
    ];
  },

  addCommands() {
    return {
      setYoutubeFigure:
        ({ url, title }) =>
        ({ commands }) => {
          const videoId = parseYoutubeId(url);
          if (!videoId) return false;
          return commands.insertContent({
            type: this.name,
            attrs: { videoId, title: title?.trim() || DEFAULT_YOUTUBE_TITLE },
          });
        },
    };
  },
});
