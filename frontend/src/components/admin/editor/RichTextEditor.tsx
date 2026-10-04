'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  EditorContent,
  useEditor,
  type Content,
  type JSONContent,
} from '@tiptap/react';

import { cn } from '@/lib/cn';

import { EditorToolbar } from './EditorToolbar';
import { buildExtensions, type EditorMode } from './extensions';
import { FigureImageWithView, YoutubeFigureWithView } from './NodeViews';
import { serializeDoc } from './output';
import { cleanPastedHtml } from './paste';

export type RichTextValue = {
  /** Tiptap JSON (content_json); preferred when present and valid. */
  json: unknown | null;
  /** Sanitizer-safe HTML (content_html). */
  html: string;
};

export type RichTextEditorProps = {
  value: RichTextValue;
  onChange: (value: { json: JSONContent; html: string }) => void;
  /** body: articles/pages; inline: short texts (FAQ answers) — bold/italic/link only. */
  mode?: EditorMode;
  placeholder?: string;
  /** Minimum height of the writing area in px. */
  minHeight?: number;
  disabled?: boolean;
  /** Optional hard character limit (shown in the footer). */
  maxLength?: number;
  id?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  className?: string;
};

function isDocJson(json: unknown): json is JSONContent {
  return (
    typeof json === 'object' &&
    json !== null &&
    (json as { type?: unknown }).type === 'doc' &&
    Array.isArray((json as { content?: unknown }).content)
  );
}

function initialContent(value: RichTextValue): Content {
  return isDocJson(value.json) ? value.json : value.html || '';
}

const numberFmt = new Intl.NumberFormat('id-ID');

type EditorCounts = { characters: number; words: number; focused: boolean };

function readCounts(e: {
  storage: {
    characterCount: { characters: () => number; words: () => number };
  };
  isFocused: boolean;
}): EditorCounts {
  return {
    characters: e.storage.characterCount.characters(),
    words: e.storage.characterCount.words(),
    focused: e.isFocused,
  };
}

/**
 * Tiptap editor whose HTML output always survives the server sanitizer
 * unchanged (see extensions/ and output.ts). Emits {json, html} on every
 * change; html is "" for an empty document.
 */
export function RichTextEditor({
  value,
  onChange,
  mode = 'body',
  placeholder,
  minHeight,
  disabled = false,
  maxLength,
  id,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  className,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // HTML the editor last emitted (or loaded); used to tell our own echoes
  // from external value changes (form reset, data loaded after mount).
  const lastHtml = useRef<string | null>(null);
  const prevValueHtml = useRef(value.html);

  // Character/word count + focus state. Computed straight off editor events (not
  // `useEditorState`): with `immediatelyRender: false` the editor is created after
  // mount already holding `value`'s content, but `useEditorState`'s snapshot cache
  // only refreshes on the *next* transaction — so it would report zero counts for
  // server-loaded content until the user's first edit.
  const [counts, setCounts] = useState<EditorCounts>({
    characters: 0,
    words: 0,
    focused: false,
  });

  // The schema is fixed for the editor's lifetime; mode/placeholder/limit are
  // read once on creation.
  const extensions = useMemo(
    () =>
      buildExtensions(mode, {
        placeholder,
        limit: maxLength ?? null,
        figureImage: FigureImageWithView,
        youtubeFigure: YoutubeFigureWithView,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: initialContent(value),
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    enableContentCheck: true,
    onContentError: ({ editor: e }) => {
      // content_json that no longer matches the schema: fall back to HTML.
      e.commands.setContent(value.html || '', { emitUpdate: false });
    },
    editorProps: {
      attributes: {
        class: cn('prose-almaidah', mode === 'inline' && 'editor-inline'),
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        ...(ariaInvalid ? { 'aria-invalid': 'true' } : {}),
      },
      transformPastedHTML: cleanPastedHtml,
    },
    onCreate: ({ editor: e }) => {
      lastHtml.current = serializeDoc(e.state.doc, mode, document);
      setCounts(readCounts(e));
    },
    onUpdate: ({ editor: e }) => {
      const html = serializeDoc(e.state.doc, mode, document);
      lastHtml.current = html;
      setCounts(readCounts(e));
      onChangeRef.current({ json: e.getJSON(), html });
    },
    onFocus: ({ editor: e }) => setCounts(readCounts(e)),
    onBlur: ({ editor: e }) => setCounts(readCounts(e)),
  });

  // External value changes.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value.html === prevValueHtml.current) return;
    prevValueHtml.current = value.html;
    if (lastHtml.current === null || value.html === lastHtml.current) return;
    editor.commands.setContent(initialContent(value), { emitUpdate: false });
    lastHtml.current = serializeDoc(editor.state.doc, mode, document);
    setCounts(readCounts(editor));
  }, [editor, value, mode]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  return (
    <div
      className={cn(
        'editor-root',
        mode === 'inline' && 'editor-root-inline',
        className,
      )}
      data-disabled={disabled || undefined}
      data-focused={counts.focused || undefined}
      data-invalid={ariaInvalid || undefined}
      style={
        minHeight
          ? ({ '--editor-min-h': `${minHeight}px` } as CSSProperties)
          : undefined
      }
    >
      {editor ? (
        <EditorToolbar editor={editor} mode={mode} disabled={disabled} />
      ) : (
        <div className="editor-toolbar" aria-hidden />
      )}
      <EditorContent editor={editor} className="editor-content" />
      <div className="editor-footer" aria-live="polite">
        {maxLength ? (
          <span data-over={counts.characters >= maxLength || undefined}>
            {numberFmt.format(counts.characters)} /{' '}
            {numberFmt.format(maxLength)} karakter
          </span>
        ) : (
          <span>
            {numberFmt.format(counts.characters)} karakter,{' '}
            {numberFmt.format(counts.words)} kata
          </span>
        )}
      </div>
    </div>
  );
}
