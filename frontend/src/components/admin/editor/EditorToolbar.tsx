'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  ChevronDown,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Underline,
  Undo2,
  SquarePlay,
} from 'lucide-react';
import { toast } from 'sonner';

import { MediaPickerDialog } from '@/components/admin/MediaPickerDialog';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { Input } from '@/components/ui/shadcn/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/shadcn/popover';
import { Separator } from '@/components/ui/shadcn/separator';
import { Toggle } from '@/components/ui/shadcn/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import type { MediaItem } from '@/lib/api/admin/types';

import type { EditorMode } from './extensions';
import { isUploadSrc } from './extensions/FigureImage';
import { parseYoutubeId } from './extensions/YoutubeFigure';
import { LinkPopover } from './LinkPopover';

type BlockType = 'paragraph' | 'h2' | 'h3';

const BLOCK_LABEL: Record<BlockType, string> = {
  paragraph: 'Paragraf',
  h2: 'Judul 2',
  h3: 'Judul 3',
};

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MarkToggle({
  label,
  pressed,
  disabled,
  onToggle,
  children,
}: {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Tip label={label}>
      <Toggle
        size="sm"
        pressed={pressed}
        disabled={disabled}
        onPressedChange={onToggle}
        aria-label={label}
      >
        {children}
      </Toggle>
    </Tip>
  );
}

function Divider() {
  return (
    <Separator orientation="vertical" className="editor-toolbar-divider" />
  );
}

function YoutubePopover({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!parseYoutubeId(value)) {
      setError(
        'URL YouTube tidak dikenali. Contoh: https://www.youtube.com/watch?v=…, youtu.be/…, atau /shorts/….',
      );
      return;
    }
    editor.chain().focus().setYoutubeFigure({ url: value }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValue('');
          setError(null);
        }
        setOpen(next);
      }}
    >
      <Tip label="Sematkan video YouTube">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Sematkan video YouTube"
          >
            <SquarePlay />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="w-80 p-3">
        <form onSubmit={submit} className="grid gap-2" noValidate>
          <label htmlFor={inputId} className="text-sm font-medium">
            URL video YouTube
          </label>
          <Input
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          {error ? (
            <p className="text-destructive text-xs">{error}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Video disematkan lewat youtube-nocookie.com (mode privasi).
            </p>
          )}
          <div className="flex justify-end pt-1">
            <Button type="submit" size="sm">
              Sematkan
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export type EditorToolbarProps = {
  editor: Editor;
  mode: EditorMode;
  disabled?: boolean;
};

export function EditorToolbar({ editor, mode, disabled }: EditorToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      block: (e.isActive('heading', { level: 2 })
        ? 'h2'
        : e.isActive('heading', { level: 3 })
          ? 'h3'
          : 'paragraph') as BlockType,
      canUndo: mode === 'body' && e.can().undo(),
      canRedo: mode === 'body' && e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  function setBlock(type: string) {
    if (type === 'h2') chain().setHeading({ level: 2 }).run();
    else if (type === 'h3') chain().setHeading({ level: 3 }).run();
    else chain().setParagraph().run();
  }

  function insertImage(item: MediaItem) {
    if (!isUploadSrc(item.url)) {
      toast.error('Gambar ini tidak dapat disisipkan ke artikel.');
      return;
    }
    chain()
      .setFigureImage({
        src: item.url,
        alt: item.alt_text ?? '',
        width: item.width,
        height: item.height,
        caption: item.caption ?? '',
      })
      .run();
  }

  const marks = (
    <>
      <MarkToggle
        label="Tebal (Ctrl+B)"
        pressed={state.bold}
        disabled={disabled}
        onToggle={() => chain().toggleBold().run()}
      >
        <Bold />
      </MarkToggle>
      <MarkToggle
        label="Miring (Ctrl+I)"
        pressed={state.italic}
        disabled={disabled}
        onToggle={() => chain().toggleItalic().run()}
      >
        <Italic />
      </MarkToggle>
    </>
  );

  if (mode === 'inline') {
    return (
      <div className="editor-toolbar" role="toolbar" aria-label="Format teks">
        {marks}
        <LinkPopover editor={editor} active={state.link} disabled={disabled} />
      </div>
    );
  }

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Format teks">
      <DropdownMenu>
        <Tip label="Jenis blok">
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="editor-block-trigger"
            >
              {BLOCK_LABEL[state.block]}
              <ChevronDown data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuRadioGroup value={state.block} onValueChange={setBlock}>
            <DropdownMenuRadioItem value="paragraph">
              Paragraf
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              value="h2"
              className="font-serif text-lg font-semibold"
            >
              Judul 2
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              value="h3"
              className="font-serif text-base font-semibold"
            >
              Judul 3
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />
      {marks}
      <MarkToggle
        label="Garis bawah (Ctrl+U)"
        pressed={state.underline}
        disabled={disabled}
        onToggle={() => chain().toggleUnderline().run()}
      >
        <Underline />
      </MarkToggle>
      <LinkPopover editor={editor} active={state.link} disabled={disabled} />
      <Divider />
      <MarkToggle
        label="Daftar berbutir"
        pressed={state.bulletList}
        disabled={disabled}
        onToggle={() => chain().toggleBulletList().run()}
      >
        <List />
      </MarkToggle>
      <MarkToggle
        label="Daftar bernomor"
        pressed={state.orderedList}
        disabled={disabled}
        onToggle={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered />
      </MarkToggle>
      <MarkToggle
        label="Kutipan"
        pressed={state.blockquote}
        disabled={disabled}
        onToggle={() => chain().toggleBlockquote().run()}
      >
        <Quote />
      </MarkToggle>
      <Divider />
      <Tip label="Sisipkan gambar dari pustaka media">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          aria-label="Sisipkan gambar"
        >
          <ImageIcon />
        </Button>
      </Tip>
      <YoutubePopover editor={editor} disabled={disabled} />
      <Tip label="Garis pemisah">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={() => chain().setHorizontalRule().run()}
          aria-label="Garis pemisah"
        >
          <Minus />
        </Button>
      </Tip>
      <div className="editor-toolbar-end">
        <Tip label="Urungkan (Ctrl+Z)">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || !state.canUndo}
            onClick={() => chain().undo().run()}
            aria-label="Urungkan"
          >
            <Undo2 />
          </Button>
        </Tip>
        <Tip label="Ulangi (Ctrl+Shift+Z)">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || !state.canRedo}
            onClick={() => chain().redo().run()}
            aria-label="Ulangi"
          >
            <Redo2 />
          </Button>
        </Tip>
      </div>
      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        accept="image"
        title="Sisipkan gambar"
        onSelect={(item) => {
          setPickerOpen(false);
          insertImage(item);
        }}
      />
    </div>
  );
}
