import type { DOMOutputSpec } from '@tiptap/pm/model';
import { mergeAttributes, Node } from '@tiptap/react';

/**
 * Same-origin media path check, mirroring the server sanitizer
 * (backend/internal/richtext/policy.go uploadSrcRe): every segment starts with
 * an alphanumeric, "_" or "-", so ".." and "//" can never occur.
 */
const UPLOAD_SRC_RE =
  /^\/uploads\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const DIMENSION_RE = /^[0-9]{1,4}$/;

export function isUploadSrc(src: unknown): src is string {
  return typeof src === 'string' && UPLOAD_SRC_RE.test(src);
}

function toDimension(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return DIMENSION_RE.test(String(value)) ? value : null;
  }
  if (typeof value === 'string' && DIMENSION_RE.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10);
    return n > 0 ? n : null;
  }
  return null;
}

function findImg(el: HTMLElement): HTMLImageElement | null {
  if (el.tagName === 'IMG') return el as HTMLImageElement;
  return el.querySelector('img');
}

export type FigureImageAttrs = {
  src: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figureImage: {
      /** Insert a media-library image as <figure class="image">. */
      setFigureImage: (attrs: FigureImageAttrs) => ReturnType;
    };
  }
}

/**
 * Block image from the media library. Serialises to exactly
 * <figure class="image"><img src alt width height><figcaption>…</figcaption></figure>
 * (figcaption omitted when empty). Only /uploads/… sources are accepted, so
 * pasted external images are dropped on parse.
 */
export const FigureImage = Node.create({
  name: 'figureImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        rendered: false,
        parseHTML: (el) => findImg(el)?.getAttribute('src') ?? null,
      },
      alt: {
        default: '',
        rendered: false,
        parseHTML: (el) => findImg(el)?.getAttribute('alt') ?? '',
      },
      width: {
        default: null,
        rendered: false,
        parseHTML: (el) => toDimension(findImg(el)?.getAttribute('width')),
      },
      height: {
        default: null,
        rendered: false,
        parseHTML: (el) => toDimension(findImg(el)?.getAttribute('height')),
      },
      caption: {
        default: '',
        rendered: false,
        parseHTML: (el) =>
          el.tagName === 'FIGURE'
            ? (el.querySelector('figcaption')?.textContent?.trim() ?? '')
            : '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        // Above paragraphs/other figures so the whole figure becomes one node.
        priority: 60,
        getAttrs: (el) => {
          if (el.classList.contains('youtube')) return false;
          return isUploadSrc(findImg(el)?.getAttribute('src')) ? null : false;
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (el) => (isUploadSrc(el.getAttribute('src')) ? null : false),
      },
    ];
  },

  renderHTML({ node }) {
    const { src, alt, width, height, caption } = node.attrs as FigureImageAttrs;
    const figure = mergeAttributes({ class: 'image' });
    const text = typeof caption === 'string' ? caption.trim() : '';
    const tail: DOMOutputSpec[] = text ? [['figcaption', {}, text]] : [];
    if (!isUploadSrc(src)) {
      // Never emit an off-policy src; the server would drop it anyway.
      return ['figure', figure, ...tail];
    }
    const img: Record<string, string> = { src, alt: alt ?? '' };
    const w = toDimension(width);
    const h = toDimension(height);
    if (w) img.width = String(w);
    if (h) img.height = String(h);
    return ['figure', figure, ['img', img], ...tail];
  },

  addCommands() {
    return {
      setFigureImage:
        (attrs) =>
        ({ commands }) => {
          if (!isUploadSrc(attrs.src)) return false;
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              alt: attrs.alt ?? '',
              width: toDimension(attrs.width),
              height: toDimension(attrs.height),
              caption: attrs.caption ?? '',
            },
          });
        },
    };
  },
});
