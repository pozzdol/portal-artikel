import {
  DOMSerializer,
  Fragment,
  type Node as PMNode,
  type Schema,
} from '@tiptap/pm/model';

import type { EditorMode } from './extensions';

/** Minimal document surface ProseMirror's DOMSerializer needs. */
export type SerializerDocument = Pick<
  Document,
  'createElement' | 'createTextNode' | 'createDocumentFragment'
>;

type HtmlContainer = { appendChild(node: unknown): unknown; innerHTML: string };

function isEmptyParagraph(node: PMNode): boolean {
  return node.type.name === 'paragraph' && node.content.size === 0;
}

function serialize(
  schema: Schema,
  fragment: Fragment,
  doc: SerializerDocument,
): string {
  const out = DOMSerializer.fromSchema(schema).serializeFragment(fragment, {
    document: doc as Document,
  });
  const container = doc.createElement('div') as unknown as HtmlContainer;
  container.appendChild(out);
  return container.innerHTML;
}

/**
 * Serialises an editor document to the HTML that is sent to the API.
 * - body: block HTML without trailing empty paragraphs; "" when empty.
 * - inline: the single paragraph's inner HTML (no <p>); "" when empty.
 */
export function serializeDoc(
  doc: PMNode,
  mode: EditorMode,
  document: SerializerDocument,
): string {
  const schema = doc.type.schema;
  if (mode === 'inline') {
    const para = doc.firstChild;
    if (!para || para.content.size === 0) return '';
    return serialize(schema, para.content, document).trim();
  }
  let end = doc.childCount;
  while (end > 0 && isEmptyParagraph(doc.child(end - 1))) end--;
  if (end === 0) return '';
  let from = 0;
  while (from < end && isEmptyParagraph(doc.child(from))) from++;
  const nodes: PMNode[] = [];
  for (let i = from; i < end; i++) nodes.push(doc.child(i));
  return serialize(schema, Fragment.fromArray(nodes), document);
}
