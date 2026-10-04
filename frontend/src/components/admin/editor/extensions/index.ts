import { Node, type AnyExtension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Placeholder } from '@tiptap/extension-placeholder';

import { FigureImage } from './FigureImage';
import { SafeLink } from './SafeLink';
import { YoutubeFigure } from './YoutubeFigure';

export type EditorMode = 'body' | 'inline';

/**
 * Inline documents are a single paragraph; Enter inserts <br>. The serialised
 * output is the paragraph's inner HTML only (b/i/em/strong/br/a[href]).
 */
const InlineDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph',
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.setHardBreak(),
    };
  },
});

export type BuildExtensionsOptions = {
  placeholder?: string;
  /** Hard character limit (CharacterCount). */
  limit?: number | null;
  /** Node overrides (e.g. with React node views), keyed by node name. */
  figureImage?: typeof FigureImage;
  youtubeFigure?: typeof YoutubeFigure;
};

/**
 * The single source of truth for the editor schema. Everything the schema can
 * render is inside the server allow-list (backend/internal/richtext/policy.go).
 */
export function buildExtensions(
  mode: EditorMode,
  options: BuildExtensionsOptions = {},
): AnyExtension[] {
  const common: AnyExtension[] = [
    CharacterCount.configure({ limit: options.limit ?? null }),
  ];
  if (options.placeholder) {
    common.push(Placeholder.configure({ placeholder: options.placeholder }));
  }

  if (mode === 'inline') {
    return [
      InlineDocument,
      StarterKit.configure({
        document: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
        trailingNode: false,
        dropcursor: false,
      }),
      SafeLink.configure({ policy: 'inline' }),
      ...common,
    ];
  }

  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      strike: false,
      link: false,
    }),
    SafeLink.configure({ policy: 'body' }),
    options.figureImage ?? FigureImage,
    options.youtubeFigure ?? YoutubeFigure,
    ...common,
  ];
}
