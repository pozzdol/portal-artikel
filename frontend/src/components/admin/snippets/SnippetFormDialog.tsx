'use client';

import * as React from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { RichTextEditor } from '@/components/admin/editor/RichTextEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Switch } from '@/components/ui/shadcn/switch';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { DateTimePicker } from '@/components/ui/pickers';
import { useCreateSnippet, useUpdateSnippet } from '@/lib/api/admin/snippets';
import type { AdminSnippet, SnippetType } from '@/lib/api/admin/types';
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges';
import { apiErrorMessage, applyServerErrors } from '@/lib/forms/serverErrors';
import {
  MSG,
  optionalDateTime,
  optionalText,
  requiredText,
} from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';

import { SNIPPET_TYPE_LABEL, nextSortOrder } from './helpers';

const announcementSchema = z
  .object({
    body: requiredText(5000),
    link_url: optionalText(500),
    is_active: z.boolean(),
    starts_at: optionalDateTime,
    ends_at: optionalDateTime,
  })
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at >= v.starts_at, {
    message: 'Selesai tayang harus setelah mulai tayang.',
    path: ['ends_at'],
  });

const quoteSchema = z.object({
  body: requiredText(5000),
  source: optionalText(200),
  is_active: z.boolean(),
});

const faqSchema = z.object({
  title: requiredText(300),
  body: z.string().min(1, MSG.required),
  is_active: z.boolean(),
});

type AnnouncementValues = z.infer<typeof announcementSchema>;
type QuoteValues = z.infer<typeof quoteSchema>;
type FaqValues = z.infer<typeof faqSchema>;

export type SnippetFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: SnippetType;
  /** null = create. */
  snippet: AdminSnippet | null;
  existing: AdminSnippet[];
};

/** Create/edit dialog for one snippet, fields vary per `type` (docs/07 §3.8). */
export function SnippetFormDialog({
  open,
  onOpenChange,
  type,
  snippet,
  existing,
}: SnippetFormDialogProps) {
  if (type === 'quote') {
    return (
      <QuoteForm
        open={open}
        onOpenChange={onOpenChange}
        snippet={snippet}
        existing={existing}
      />
    );
  }
  if (type === 'faq') {
    return (
      <FaqForm
        open={open}
        onOpenChange={onOpenChange}
        snippet={snippet}
        existing={existing}
      />
    );
  }
  return (
    <PeriodForm
      open={open}
      onOpenChange={onOpenChange}
      type={type}
      snippet={snippet}
      existing={existing}
    />
  );
}

function useSaveHandlers() {
  const create = useCreateSnippet();
  const update = useUpdateSnippet();
  const busy = create.isPending || update.isPending;
  return { create, update, busy };
}

function PeriodForm({
  open,
  onOpenChange,
  type,
  snippet,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'announcement' | 'breaking';
  snippet: AdminSnippet | null;
  existing: AdminSnippet[];
}) {
  const { create, update, busy } = useSaveHandlers();
  const form = useZodForm(announcementSchema, {
    defaultValues: {
      body: snippet?.body ?? '',
      link_url: snippet?.link_url ?? null,
      is_active: snippet?.is_active ?? true,
      starts_at: snippet?.starts_at ?? null,
      ends_at: snippet?.ends_at ?? null,
    },
  });
  const { confirmLeave } = useUnsavedChanges(form.formState.isDirty);

  const onSubmit = form.handleSubmit(async (values: AnnouncementValues) => {
    const input = {
      type,
      title: null,
      body: values.body,
      source: null,
      link_url: values.link_url,
      sort_order: snippet?.sort_order ?? nextSortOrder(existing),
      is_active: values.is_active,
      starts_at: values.starts_at,
      ends_at: values.ends_at,
    };
    try {
      if (snippet) await update.mutateAsync({ id: snippet.id, input });
      else await create.mutateAsync(input);
      toast.success(snippet ? 'Perubahan disimpan.' : 'Snippet ditambahkan.');
      onOpenChange(false);
    } catch (err) {
      const result = applyServerErrors(form, err, {
        knownFields: ['body', 'link_url', 'starts_at', 'ends_at'],
      });
      if (!result.handled) toast.error(apiErrorMessage(err));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !confirmLeave()) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {snippet ? 'Sunting' : 'Tambah'} {SNIPPET_TYPE_LABEL[type]}
          </DialogTitle>
          <DialogDescription>
            {type === 'announcement'
              ? 'Teks pengumuman yang tampil di bar atas beranda.'
              : 'Teks yang berputar di ticker breaking news.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.body}>
              <FieldLabel htmlFor="snippet-body">Teks</FieldLabel>
              <Textarea
                id="snippet-body"
                rows={3}
                aria-invalid={!!form.formState.errors.body}
                {...form.register('body')}
              />
              <FieldError errors={[form.formState.errors.body]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.link_url}>
              <FieldLabel htmlFor="snippet-link">Tautan (opsional)</FieldLabel>
              <Input
                id="snippet-link"
                placeholder="/artikel/... atau https://…"
                aria-invalid={!!form.formState.errors.link_url}
                {...form.register('link_url')}
              />
              <FieldError errors={[form.formState.errors.link_url]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.starts_at}>
                <FieldLabel htmlFor="snippet-starts">
                  Mulai tayang (opsional)
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <DateTimePicker
                      id="snippet-starts"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      aria-invalid={!!form.formState.errors.starts_at}
                    />
                  )}
                />
                <FieldError errors={[form.formState.errors.starts_at]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.ends_at}>
                <FieldLabel htmlFor="snippet-ends">
                  Selesai tayang (opsional)
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="ends_at"
                  render={({ field }) => (
                    <DateTimePicker
                      id="snippet-ends"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      aria-invalid={!!form.formState.errors.ends_at}
                    />
                  )}
                />
                <FieldError errors={[form.formState.errors.ends_at]} />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    id="snippet-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="snippet-active" className="font-normal">
                Aktif
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (confirmLeave()) onOpenChange(false);
              }}
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner className="size-4" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuoteForm({
  open,
  onOpenChange,
  snippet,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippet: AdminSnippet | null;
  existing: AdminSnippet[];
}) {
  const { create, update, busy } = useSaveHandlers();
  const form = useZodForm(quoteSchema, {
    defaultValues: {
      body: snippet?.body ?? '',
      source: snippet?.source ?? null,
      is_active: snippet?.is_active ?? true,
    },
  });
  const { confirmLeave } = useUnsavedChanges(form.formState.isDirty);

  const onSubmit = form.handleSubmit(async (values: QuoteValues) => {
    const input = {
      type: 'quote' as const,
      title: null,
      body: values.body,
      source: values.source,
      link_url: null,
      sort_order: snippet?.sort_order ?? nextSortOrder(existing),
      is_active: values.is_active,
      starts_at: null,
      ends_at: null,
    };
    try {
      if (snippet) await update.mutateAsync({ id: snippet.id, input });
      else await create.mutateAsync(input);
      toast.success(snippet ? 'Perubahan disimpan.' : 'Kutipan ditambahkan.');
      onOpenChange(false);
    } catch (err) {
      const result = applyServerErrors(form, err, {
        knownFields: ['body', 'source'],
      });
      if (!result.handled) toast.error(apiErrorMessage(err));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !confirmLeave()) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{snippet ? 'Sunting' : 'Tambah'} kutipan</DialogTitle>
          <DialogDescription>
            Berputar di section kutipan beranda.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.body}>
              <FieldLabel htmlFor="quote-body">Teks kutipan</FieldLabel>
              <Textarea
                id="quote-body"
                rows={3}
                aria-invalid={!!form.formState.errors.body}
                {...form.register('body')}
              />
              <FieldError errors={[form.formState.errors.body]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.source}>
              <FieldLabel htmlFor="quote-source">Sumber (opsional)</FieldLabel>
              <Input
                id="quote-source"
                placeholder="mis. QS. Al-Insyirah: 6"
                aria-invalid={!!form.formState.errors.source}
                {...form.register('source')}
              />
              <FieldError errors={[form.formState.errors.source]} />
            </Field>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    id="quote-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="quote-active" className="font-normal">
                Aktif
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (confirmLeave()) onOpenChange(false);
              }}
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner className="size-4" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FaqForm({
  open,
  onOpenChange,
  snippet,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippet: AdminSnippet | null;
  existing: AdminSnippet[];
}) {
  const { create, update, busy } = useSaveHandlers();
  const form = useZodForm(faqSchema, {
    defaultValues: {
      title: snippet?.title ?? '',
      body: snippet?.body ?? '',
      is_active: snippet?.is_active ?? true,
    },
  });
  const { confirmLeave } = useUnsavedChanges(form.formState.isDirty);

  const onSubmit = form.handleSubmit(async (values: FaqValues) => {
    const input = {
      type: 'faq' as const,
      title: values.title,
      body: values.body,
      source: null,
      link_url: null,
      sort_order: snippet?.sort_order ?? nextSortOrder(existing),
      is_active: values.is_active,
      starts_at: null,
      ends_at: null,
    };
    try {
      if (snippet) await update.mutateAsync({ id: snippet.id, input });
      else await create.mutateAsync(input);
      toast.success(
        snippet ? 'Perubahan disimpan.' : 'Pertanyaan ditambahkan.',
      );
      onOpenChange(false);
    } catch (err) {
      const result = applyServerErrors(form, err, {
        knownFields: ['title', 'body'],
      });
      if (!result.handled) toast.error(apiErrorMessage(err));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !confirmLeave()) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{snippet ? 'Sunting' : 'Tambah'} pertanyaan</DialogTitle>
          <DialogDescription>
            Tampil pada section Pertanyaan Umum di beranda.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.title}>
              <FieldLabel htmlFor="faq-title">Pertanyaan</FieldLabel>
              <Input
                id="faq-title"
                aria-invalid={!!form.formState.errors.title}
                {...form.register('title')}
              />
              <FieldError errors={[form.formState.errors.title]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.body}>
              <FieldLabel htmlFor="faq-body">Jawaban</FieldLabel>
              <Controller
                control={form.control}
                name="body"
                render={({ field }) => (
                  <RichTextEditor
                    id="faq-body"
                    mode="inline"
                    value={{ json: null, html: field.value }}
                    onChange={(v) => field.onChange(v.html)}
                    placeholder="Jawaban singkat…"
                    maxLength={2000}
                    aria-invalid={!!form.formState.errors.body}
                  />
                )}
              />
              <FieldError errors={[form.formState.errors.body]} />
            </Field>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    id="faq-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="faq-active" className="font-normal">
                Aktif
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (confirmLeave()) onOpenChange(false);
              }}
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner className="size-4" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
