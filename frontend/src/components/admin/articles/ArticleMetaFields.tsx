'use client';

import * as React from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { AuthorSelect } from '@/components/admin/AuthorSelect';
import { CategorySelect } from '@/components/admin/CategorySelect';
import { MediaField } from '@/components/admin/MediaField';
import { SeoFields } from '@/components/admin/SeoFields';
import { TagInput } from '@/components/admin/TagInput';
import { DatePicker } from '@/components/ui/pickers';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { Switch } from '@/components/ui/shadcn/switch';
import type { ArticleTagRef, CategoryTreeNode } from '@/lib/api/admin/types';

import {
  CAPTION_MAX,
  LOCATION_MAX,
  type ArticleFormOutput,
  type ArticleFormValues,
} from './article-form';

type Form = UseFormReturn<ArticleFormValues, unknown, ArticleFormOutput>;

/** Titled block of the editor's side panel. */
export function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line flex flex-col gap-4 border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export type ArticleMetaFieldsProps = {
  form: Form;
  tree: CategoryTreeNode[];
  categoriesLoading: boolean;
  /** Activity (Yayasan) fields visible. */
  withEvent: boolean;
  /** Absolute public URL for the SEO snippet preview. */
  previewUrl: string;
  /** Author dropdown needs /admin/authors (articles.create). */
  canChooseAuthor: boolean;
  /** Shown instead of the dropdown when it is unavailable. */
  authorName?: string;
  readOnly: boolean;
  /** The loaded article's own tags, so TagInput can label chips outside the search results. */
  knownTags?: ArticleTagRef[];
};

export function ArticleMetaFields({
  form,
  tree,
  categoriesLoading,
  withEvent,
  previewUrl,
  canChooseAuthor,
  authorName,
  readOnly,
  knownTags,
}: ArticleMetaFieldsProps) {
  const { control } = form;
  const coverId = form.watch('cover_media_id');
  const title = form.watch('title');

  return (
    <>
      <PanelSection title="Kategori & tag">
        <Controller
          control={control}
          name="category_id"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="article-category">Kategori</FieldLabel>
              <CategorySelect
                id="article-category"
                tree={tree}
                value={field.value ?? null}
                onChange={(v) => {
                  field.onChange(v);
                  field.onBlur();
                }}
                placeholder={categoriesLoading ? 'Memuat…' : 'Pilih kategori…'}
                disabled={readOnly || categoriesLoading}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="tags"
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5">
              <TagInput
                id="article-tags"
                value={field.value}
                onChange={field.onChange}
                disabled={readOnly}
                knownTags={knownTags}
              />
              <FieldError errors={[fieldState.error]} />
            </div>
          )}
        />
      </PanelSection>

      <PanelSection title="Penulis">
        {canChooseAuthor ? (
          <Controller
            control={control}
            name="author_id"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="article-author" className="sr-only">
                  Penulis
                </FieldLabel>
                <AuthorSelect
                  id="article-author"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  disabled={readOnly}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : (
          <p className="text-foreground text-sm">{authorName ?? '—'}</p>
        )}
      </PanelSection>

      <PanelSection title="Gambar sampul">
        <Controller
          control={control}
          name="cover_media_id"
          render={({ field, fieldState }) => (
            <MediaField
              label="Gambar sampul"
              value={field.value ?? null}
              onChange={(id) => field.onChange(id)}
              aspect="16/9"
              error={fieldState.error?.message}
              disabled={readOnly}
            />
          )}
        />
        {coverId ? (
          <Controller
            control={control}
            name="cover_caption"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="article-cover-caption">
                  Keterangan gambar
                </FieldLabel>
                <Input
                  {...field}
                  id="article-cover-caption"
                  value={field.value ?? ''}
                  maxLength={CAPTION_MAX}
                  placeholder="Contoh: Suasana kajian di aula pondok."
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : null}
      </PanelSection>

      <PanelSection title="Penempatan">
        <Controller
          control={control}
          name="is_featured"
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="article-featured">Unggulan</FieldLabel>
                <FieldDescription>Tampil di hero beranda.</FieldDescription>
              </FieldContent>
              <Switch
                id="article-featured"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={readOnly}
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="is_breaking"
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="article-breaking">Breaking</FieldLabel>
                <FieldDescription>
                  Masuk ke ticker berita terkini.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="article-breaking"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={readOnly}
              />
            </Field>
          )}
        />
      </PanelSection>

      {withEvent ? (
        <PanelSection
          title="Kegiatan"
          description="Untuk liputan kegiatan Yayasan; tampil di linimasa kegiatan."
        >
          <Controller
            control={control}
            name="event_date"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="article-event-date">
                  Tanggal kegiatan
                </FieldLabel>
                <DatePicker
                  id="article-event-date"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={readOnly}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="event_location"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="article-event-location">Lokasi</FieldLabel>
                <Input
                  {...field}
                  id="article-event-location"
                  value={field.value ?? ''}
                  maxLength={LOCATION_MAX}
                  placeholder="Contoh: Aula Pondok Darul Hikmah"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </PanelSection>
      ) : null}

      <PanelSection
        title="SEO"
        description="Kosongkan untuk memakai judul dan ringkasan artikel."
      >
        <SeoFields
          form={form as unknown as UseFormReturn<ArticleFormValues>}
          withOg
          previewUrlBase={previewUrl}
          fallbackTitle={title}
        />
      </PanelSection>
    </>
  );
}
