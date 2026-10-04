'use client';

import {
  Controller,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from 'react-hook-form';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { MediaField } from '@/components/admin/MediaField';

import { SeoSnippetPreview } from './SeoSnippetPreview';

const TITLE_MAX = 60;
const DESC_MAX = 160;

export type SeoFieldsProps<T extends FieldValues> = {
  form: UseFormReturn<T>;
  /** Field name prefix, e.g. '' or 'seo.' when the schema nests these under `seo`. */
  prefix?: string;
  /** Render the OG image + canonical URL fields too (articles/pages only). */
  withOg?: boolean;
  /** Full preview URL, e.g. `${SITE_URL}/berita/${slug}`. */
  previewUrlBase: string;
  /** Shown in the preview when seo_title is empty (usually the entity's own title). */
  fallbackTitle?: string;
};

/**
 * SEO title/description (60/160 counters) + optional OG image/canonical URL, with a
 * live Google-style snippet preview. Field names are built dynamically from `prefix`, so
 * this is intentionally loose about react-hook-form's Path<T> typing (see the `as Path<T>`
 * casts below) to stay reusable across every form's own schema.
 */
export function SeoFields<T extends FieldValues>({
  form,
  prefix = '',
  withOg = false,
  previewUrlBase,
  fallbackTitle,
}: SeoFieldsProps<T>) {
  const titleName = `${prefix}seo_title` as Path<T>;
  const descName = `${prefix}seo_description` as Path<T>;
  const ogName = `${prefix}og_media_id` as Path<T>;
  const canonicalName = `${prefix}canonical_url` as Path<T>;

  const watchedTitle = form.watch(titleName) as unknown as
    string | null | undefined;
  const watchedDesc = form.watch(descName) as unknown as
    string | null | undefined;

  return (
    <div className="flex flex-col gap-4">
      <Controller
        control={form.control}
        name={titleName}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Judul SEO</FieldLabel>
            <Input
              {...field}
              id={field.name}
              value={(field.value as string | null) ?? ''}
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription>
              {((field.value as string | null) ?? '').length}/{TITLE_MAX}{' '}
              karakter
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name={descName}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Deskripsi SEO</FieldLabel>
            <Textarea
              {...field}
              id={field.name}
              value={(field.value as string | null) ?? ''}
              rows={3}
              aria-invalid={fieldState.invalid}
            />
            <FieldDescription>
              {((field.value as string | null) ?? '').length}/{DESC_MAX}{' '}
              karakter
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      {withOg ? (
        <>
          <Controller
            control={form.control}
            name={ogName}
            render={({ field, fieldState }) => (
              <MediaField
                value={(field.value as number | null) ?? null}
                onChange={(mediaId) => field.onChange(mediaId)}
                label="Gambar OG"
                aspect="16/9"
                description="Ditampilkan saat tautan dibagikan ke media sosial."
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name={canonicalName}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  URL kanonik (opsional)
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  value={(field.value as string | null) ?? ''}
                  placeholder="https://…"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </>
      ) : null}
      <SeoSnippetPreview
        title={watchedTitle || fallbackTitle || ''}
        description={watchedDesc || ''}
        url={previewUrlBase}
      />
    </div>
  );
}
