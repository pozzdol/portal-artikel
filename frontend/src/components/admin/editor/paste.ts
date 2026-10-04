/**
 * Clean HTML pasted from Word / Google Docs / web pages before ProseMirror
 * parses it. The schema already drops unknown nodes and attributes; this pass
 * keeps meaningful inline formatting that those sources express with styled
 * <span>s, and removes wrappers that would otherwise confuse parsing:
 * - drops <style>, <script>, <meta>, <link>, <title>, Office <o:p>/<w:*> tags and comments;
 * - unwraps Google Docs' <b id="docs-internal-guid-…"> wrapper (not real bold);
 * - turns styled spans into <strong>/<em>/<u>, then unwraps every span and <font>;
 * - turns <div> into <p> (or unwraps it when it contains block children);
 * - strips style/class/id/dir/lang/align/data-* and event attributes everywhere.
 *
 * Browser-only (uses DOMParser); returns the input unchanged on the server.
 */
const DROP_SELECTOR =
  'style, script, meta, link, title, xml, template, noscript, object, embed';
const BLOCK_SELECTOR =
  'p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, figure, table, pre, hr';
const KEEP_ATTRS: Record<string, string[]> = {
  a: ['href'],
  img: ['src', 'alt', 'width', 'height'],
  iframe: ['src', 'title'],
  ol: ['start'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function rename(el: Element, tag: string): Element {
  const next = el.ownerDocument.createElement(tag);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
}

function wrapChildren(el: Element, tag: string) {
  const wrapper = el.ownerDocument.createElement(tag);
  while (el.firstChild) wrapper.appendChild(el.firstChild);
  el.appendChild(wrapper);
}

function spanFormatting(el: HTMLElement) {
  const style = el.style;
  const weight = style.fontWeight;
  const bold =
    weight === 'bold' ||
    weight === 'bolder' ||
    Number.parseInt(weight, 10) >= 600;
  const italic = style.fontStyle === 'italic';
  const underline = /underline/.test(
    style.textDecoration || style.textDecorationLine || '',
  );
  return { bold, italic, underline };
}

export function cleanPastedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  doc.querySelectorAll(DROP_SELECTOR).forEach((el) => el.remove());

  // Comments (Word conditional comments etc.).
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  // Office namespaced tags (<o:p>, <w:sdt>, …).
  Array.from(body.getElementsByTagName('*'))
    .filter((el) => el.tagName.includes(':'))
    .forEach(unwrap);

  body.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);

  body.querySelectorAll<HTMLElement>('span, font').forEach((el) => {
    if (el.tagName === 'SPAN') {
      const { bold, italic, underline } = spanFormatting(el);
      if (underline) wrapChildren(el, 'u');
      if (italic) wrapChildren(el, 'em');
      if (bold) wrapChildren(el, 'strong');
    }
    unwrap(el);
  });

  // Google Docs marks non-bold text with font-weight:normal on <b>.
  body.querySelectorAll<HTMLElement>('b').forEach((el) => {
    if (el.style.fontWeight === 'normal' || el.style.fontWeight === '400')
      unwrap(el);
  });

  body.querySelectorAll('div').forEach((el) => {
    if (el.querySelector(BLOCK_SELECTOR)) unwrap(el);
    else rename(el, 'p');
  });

  body.querySelectorAll('*').forEach((el) => {
    const keep = KEEP_ATTRS[el.tagName.toLowerCase()] ?? [];
    for (const attr of Array.from(el.attributes)) {
      if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
    }
  });

  return body.innerHTML;
}
