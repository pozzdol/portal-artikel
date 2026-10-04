'use client';

import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';

import { FigureImage } from './extensions/FigureImage';
import {
  DEFAULT_YOUTUBE_TITLE,
  YoutubeFigure,
  youtubeEmbedUrl,
} from './extensions/YoutubeFigure';

function RemoveButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      className="editor-node-remove"
      aria-label="Hapus dari artikel"
      title="Hapus dari artikel"
      disabled={disabled}
      onClick={onClick}
    >
      <Trash2 />
    </Button>
  );
}

function FigureImageView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: ReactNodeViewProps) {
  const { src, alt, width, height, caption } = node.attrs as {
    src: string | null;
    alt: string | null;
    width: number | null;
    height: number | null;
    caption: string | null;
  };
  const editable = editor.isEditable;
  return (
    <NodeViewWrapper
      as="figure"
      className="editor-node"
      data-selected={selected || undefined}
    >
      <div className="editor-node-media" data-drag-handle>
        {src ? (
          // Editor-only preview of a same-origin upload; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt ?? ''}
            width={width ?? undefined}
            height={height ?? undefined}
            draggable={false}
          />
        ) : null}
        <RemoveButton onClick={deleteNode} disabled={!editable} />
      </div>
      <div className="editor-node-fields" contentEditable={false}>
        <Input
          value={caption ?? ''}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          placeholder="Keterangan gambar (opsional)"
          aria-label="Keterangan gambar"
          readOnly={!editable}
          className="h-8 text-sm"
        />
        <Input
          value={alt ?? ''}
          onChange={(e) => updateAttributes({ alt: e.target.value })}
          placeholder="Teks alternatif untuk pembaca layar"
          aria-label="Teks alternatif gambar"
          readOnly={!editable}
          className="h-8 text-sm"
        />
      </div>
    </NodeViewWrapper>
  );
}

function YoutubeFigureView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: ReactNodeViewProps) {
  const videoId =
    typeof node.attrs.videoId === 'string' ? node.attrs.videoId : '';
  const title =
    typeof node.attrs.title === 'string'
      ? node.attrs.title
      : DEFAULT_YOUTUBE_TITLE;
  const editable = editor.isEditable;
  return (
    <NodeViewWrapper
      as="figure"
      className="editor-node"
      data-selected={selected || undefined}
    >
      <div className="editor-node-media editor-node-embed" data-drag-handle>
        {videoId ? (
          <iframe
            src={youtubeEmbedUrl(videoId)}
            title={title}
            loading="lazy"
            allowFullScreen
          />
        ) : null}
        <RemoveButton onClick={deleteNode} disabled={!editable} />
      </div>
      <div className="editor-node-fields" contentEditable={false}>
        <Input
          value={title}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          placeholder="Judul video (untuk pembaca layar)"
          aria-label="Judul video"
          readOnly={!editable}
          className="h-8 text-sm"
        />
      </div>
    </NodeViewWrapper>
  );
}

/** FigureImage with its editing view (caption + alt fields). */
export const FigureImageWithView = FigureImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FigureImageView);
  },
});

/** YoutubeFigure with its editing view (preview + title field). */
export const YoutubeFigureWithView = YoutubeFigure.extend({
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeFigureView);
  },
});
