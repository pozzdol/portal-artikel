import { describe, expect, test } from 'bun:test';
import { getSchema, type JSONContent } from '@tiptap/react';

import { buildExtensions, type EditorMode } from './extensions';
import {
  isExternalHref,
  linkRenderAttrs,
  normalizeHref,
} from './extensions/SafeLink';
import { parseYoutubeId } from './extensions/YoutubeFigure';
import { serializeDoc, type SerializerDocument } from './output';

// ---------------------------------------------------------------------------
// Minimal string DOM (enough for ProseMirror's DOMSerializer), serialising
// like the browser's innerHTML: void elements unclosed, text escapes & < >,
// attribute values escape & and ".
// ---------------------------------------------------------------------------
const VOID = new Set([
  'img',
  'br',
  'hr',
  'input',
  'meta',
  'link',
  'source',
  'wbr',
]);
const escText = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/ /g, '&nbsp;');
const escAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/ /g, '&nbsp;');

abstract class FakeNode {
  children: FakeNode[] = [];
  appendChild(child: FakeNode) {
    if (child instanceof FakeFragment) {
      this.children.push(...child.children);
      child.children = [];
    } else {
      this.children.push(child);
    }
    return child;
  }
  get firstChild() {
    return this.children[0] ?? null;
  }
  get lastChild() {
    return this.children[this.children.length - 1] ?? null;
  }
  abstract get outerHTML(): string;
  get innerHTML() {
    return this.children.map((c) => c.outerHTML).join('');
  }
}
class FakeText extends FakeNode {
  readonly nodeType = 3;
  constructor(public data: string) {
    super();
  }
  get outerHTML() {
    return escText(this.data);
  }
}
class FakeFragment extends FakeNode {
  readonly nodeType = 11;
  get outerHTML() {
    return this.innerHTML;
  }
}
class FakeElement extends FakeNode {
  readonly nodeType = 1;
  attrs: [string, string][] = [];
  constructor(public tagName: string) {
    super();
  }
  setAttribute(name: string, value: string) {
    const hit = this.attrs.find((a) => a[0] === name);
    if (hit) hit[1] = String(value);
    else this.attrs.push([name, String(value)]);
  }
  get outerHTML() {
    const tag = this.tagName.toLowerCase();
    const attrs = this.attrs.map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
    return VOID.has(tag)
      ? `<${tag}${attrs}>`
      : `<${tag}${attrs}>${this.innerHTML}</${tag}>`;
  }
}
const fakeDocument = {
  createElement: (tag: string) => new FakeElement(tag),
  createElementNS: (_ns: string, tag: string) => new FakeElement(tag),
  createTextNode: (text: string) => new FakeText(text),
  createDocumentFragment: () => new FakeFragment(),
} as unknown as SerializerDocument;

function render(mode: EditorMode, json: JSONContent): string {
  const schema = getSchema(buildExtensions(mode, { placeholder: 'Tulis…' }));
  return serializeDoc(schema.nodeFromJSON(json), mode, fakeDocument);
}

// ---------------------------------------------------------------------------
// Port of backend/internal/richtext/policy.go (body + inline policies).
// ---------------------------------------------------------------------------
const uploadSrcRe =
  /^\/uploads\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const youtubeSrcRe =
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}(?:\?[a-z0-9_=&-]*)?$/;
const classRe =
  /^(?:text-(?:left|center|right)|align-(?:left|center|right)|youtube|image|caption|lead)$/;
const relRe =
  /^(?:noopener|noreferrer|nofollow|ugc)(?: (?:noopener|noreferrer|nofollow|ugc))*$/;
const dimensionRe = /^[0-9]{1,4}(?:%|px)?$/;
const any = /[\s\S]*/;

type Policy = Record<string, Record<string, RegExp>>;
const bodyTags =
  'p h2 h3 h4 strong b em i u s ul ol li blockquote hr br figure figcaption pre code table thead tbody tr th td span';
const classOn = new Set(['p', 'span', 'figure', 'img', 'iframe']);
const BODY: Policy = Object.fromEntries(
  bodyTags
    .split(' ')
    .map((t): [string, Record<string, RegExp>] => [
      t,
      classOn.has(t) ? { class: classRe } : {},
    ]),
);
// target is not in the allow-list, but bluemonday itself adds it to
// fully-qualified links, so it is expected there (checked separately).
BODY.a = { href: any, rel: relRe, title: any, target: /^_blank$/ };
BODY.img = {
  src: uploadSrcRe,
  alt: any,
  title: any,
  width: dimensionRe,
  height: dimensionRe,
  class: classRe,
};
BODY.iframe = {
  src: youtubeSrcRe,
  allowfullscreen: /^(?:|true|allowfullscreen)$/,
  loading: /^(?:lazy|eager)$/,
  title: any,
  class: classRe,
};
const INLINE: Policy = {
  b: {},
  i: {},
  em: {},
  strong: {},
  br: {},
  a: { href: any, target: /^_blank$/, rel: /^noopener$/ },
};

function assertAllowed(html: string, policy: Policy) {
  expect(html).not.toMatch(/<(?:div|script|style|span)\b/i);
  expect(html).not.toMatch(/\s(?:style|id|on[a-z]+|data-[\w-]+)=/i);
  const tagRe = /<\/?([a-zA-Z0-9]+)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g;
  const attrRe = /([a-zA-Z-]+)(?:="([^"]*)")?/g;
  const stripped = html.replace(tagRe, (_m, tag: string, attrs: string) => {
    const allowed = policy[tag.toLowerCase()];
    if (!allowed) throw new Error(`tag <${tag}> not allowed in ${html}`);
    for (const [, name, value = ''] of attrs.matchAll(attrRe)) {
      const re = allowed[name];
      if (!re) throw new Error(`attr ${name} not allowed on <${tag}>`);
      const decoded = value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      if (!re.test(decoded))
        throw new Error(`${tag}[${name}="${value}"] rejected`);
    }
    return '';
  });
  // Nothing tag-like may remain after removing recognised tags.
  expect(stripped).not.toContain('<');
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'text',
  text: t,
  ...(marks ? { marks } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({
  type: 'paragraph',
  content,
});

const BODY_DOC: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [text('Judul dua')] },
    p(
      text('Teks '),
      text('tebal', [{ type: 'bold' }]),
      text(', '),
      text('miring', [{ type: 'italic' }]),
      text(', '),
      text('garis bawah', [{ type: 'underline' }]),
      text(' & '),
      text('tautan dalam', [
        { type: 'link', attrs: { href: '/kategori/berita' } },
      ]),
      text(' serta '),
      text('tautan luar', [
        {
          type: 'link',
          attrs: {
            href: 'https://example.com/a?b=1&c=2',
            target: '_self',
            class: 'x',
          },
        },
      ]),
      { type: 'hardBreak' },
      text('baris baru'),
    ),
    { type: 'heading', attrs: { level: 3 }, content: [text('Judul tiga')] },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(text('satu'))] },
        { type: 'listItem', content: [p(text('dua'))] },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 1 },
      content: [{ type: 'listItem', content: [p(text('pertama'))] }],
    },
    { type: 'blockquote', content: [p(text('Kutipan'))] },
    { type: 'horizontalRule' },
    {
      type: 'figureImage',
      attrs: {
        src: '/uploads/brand/logo.png',
        alt: 'Logo',
        width: 512,
        height: 512,
        caption: 'Logo ALMAIDAH',
      },
    },
    {
      type: 'figureImage',
      attrs: {
        src: '/uploads/2026/09/foto.webp',
        alt: '',
        width: null,
        height: null,
        caption: '',
      },
    },
    {
      type: 'youtubeFigure',
      attrs: { videoId: 'dQw4w9WgXcQ', title: 'Video YouTube' },
    },
    { type: 'paragraph' },
    { type: 'paragraph' },
  ],
};

describe('body output', () => {
  const html = render('body', BODY_DOC);

  test('contains only allow-listed tags and attributes', () => {
    assertAllowed(html, BODY);
  });

  test('figure image shape', () => {
    expect(html).toContain(
      '<figure class="image"><img src="/uploads/brand/logo.png" alt="Logo" width="512" height="512"><figcaption>Logo ALMAIDAH</figcaption></figure>',
    );
    expect(html).toContain(
      '<figure class="image"><img src="/uploads/2026/09/foto.webp" alt=""></figure>',
    );
  });

  test('youtube figure shape (no div)', () => {
    expect(html).toContain(
      '<figure class="youtube"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" allowfullscreen="" loading="lazy" title="Video YouTube"></iframe></figure>',
    );
  });

  test('links mirror sanitizer output', () => {
    expect(html).toContain('<a href="/kategori/berita">tautan dalam</a>');
    expect(html).toContain(
      '<a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer" target="_blank">tautan luar</a>',
    );
  });

  test('trailing empty paragraphs are trimmed', () => {
    expect(html.endsWith('</figure>')).toBe(true);
    expect(
      render('body', { type: 'doc', content: [{ type: 'paragraph' }] }),
    ).toBe('');
  });

  test('off-policy media sources never render', () => {
    const bad = render('body', {
      type: 'doc',
      content: [
        {
          type: 'figureImage',
          attrs: { src: 'https://evil.test/x.png', alt: 'x', caption: 'c' },
        },
        { type: 'figureImage', attrs: { src: '/uploads/../etc/passwd' } },
        { type: 'youtubeFigure', attrs: { videoId: '"><script>' } },
        p(
          text('javascript', [
            { type: 'link', attrs: { href: 'javascript:alert(1)' } },
          ]),
        ),
      ],
    });
    assertAllowed(bad, BODY);
    expect(bad).not.toContain('evil.test');
    expect(bad).not.toContain('passwd');
    expect(bad).not.toContain('javascript:');
    expect(bad).not.toContain('<img');
    expect(bad).not.toContain('<iframe');
  });
});

describe('inline output', () => {
  test('fits the inline policy (no <p>)', () => {
    const html = render('inline', {
      type: 'doc',
      content: [
        p(
          text('Jawaban '),
          text('tebal', [{ type: 'bold' }]),
          text(' dan '),
          text('miring', [{ type: 'italic' }]),
          { type: 'hardBreak' },
          text('lihat '),
          text('halaman', [{ type: 'link', attrs: { href: '/tentang' } }]),
          text(' atau '),
          text('situs', [
            { type: 'link', attrs: { href: 'https://example.com' } },
          ]),
        ),
      ],
    });
    assertAllowed(html, INLINE);
    expect(html).toBe(
      'Jawaban <strong>tebal</strong> dan <em>miring</em><br>lihat <a href="/tentang">halaman</a> atau <a href="https://example.com" target="_blank" rel="noopener">situs</a>',
    );
  });

  test('inline schema has no block nodes', () => {
    const schema = getSchema(buildExtensions('inline'));
    for (const name of [
      'heading',
      'bulletList',
      'blockquote',
      'figureImage',
      'youtubeFigure',
      'horizontalRule',
    ]) {
      expect(schema.nodes[name]).toBeUndefined();
    }
    expect(schema.marks.underline).toBeUndefined();
    expect(
      render('inline', { type: 'doc', content: [{ type: 'paragraph' }] }),
    ).toBe('');
  });
});

describe('helpers', () => {
  test('parseYoutubeId accepts common URL forms', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [
      `https://www.youtube.com/watch?v=${id}&t=10s`,
      `youtube.com/watch?v=${id}`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
      id,
    ]) {
      expect(parseYoutubeId(url)).toBe(id);
    }
    for (const url of [
      'https://vimeo.com/123',
      'https://youtube.com/watch?v=short',
      'javascript:alert(1)',
      '',
    ]) {
      expect(parseYoutubeId(url)).toBeNull();
    }
  });

  test('normalizeHref', () => {
    expect(normalizeHref('example.com')).toBe('https://example.com');
    expect(normalizeHref(' /tentang ')).toBe('/tentang');
    expect(normalizeHref('#faq')).toBe('#faq');
    expect(normalizeHref('redaksi@almaidah.id')).toBe(
      'mailto:redaksi@almaidah.id',
    );
    expect(normalizeHref('javascript:alert(1)')).toBeNull();
    expect(normalizeHref('//evil.test')).toBeNull();
    expect(normalizeHref('')).toBeNull();
  });

  test('external detection matches Go url.Parse host rule', () => {
    expect(isExternalHref('https://a.b')).toBe(true);
    expect(isExternalHref('/a')).toBe(false);
    expect(isExternalHref('mailto:x@y.z')).toBe(false);
    expect(linkRenderAttrs('mailto:x@y.z', 'body')).toEqual({
      href: 'mailto:x@y.z',
    });
  });
});
