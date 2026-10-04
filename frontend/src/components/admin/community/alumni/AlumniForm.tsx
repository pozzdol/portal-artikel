'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { EmptyState } from '@/components/admin/EmptyState';
import { FormActions } from '@/components/admin/FormActions';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { MediaField } from '@/components/admin/MediaField';
import { PageHeader } from '@/components/admin/PageHeader';
import { SeoFields } from '@/components/admin/SeoFields';
import { SlugField } from '@/components/admin/SlugField';
import { RichTextEditor } from '@/components/admin/editor/RichTextEditor';
import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Switch } from '@/components/ui/shadcn/switch';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  useAlumni,
  useCreateAlumni,
  useUpdateAlumni,
} from '@/lib/api/admin/alumni';
import type {
  AdminAlumni,
  AlumniInput,
  PublishStatus,
} from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import {
  mediaId,
  optionalInt,
  optionalSlug,
  requiredText,
  richText,
  seoFields,
} from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';
import { useLocalDraft } from '@/lib/hooks/useLocalDraft';
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges';
import { absoluteUrl } from '@/lib/site-url';

const STATUS_OPTIONS: { value: PublishStatus; label: string }[] = [
  { value: 'draft', label: 'Draf' },
  { value: 'published', label: 'Terbit' },
];

const schema = z.object({
  name: requiredText(200),
  slug: optionalSlug,
  role_title: requiredText(200),
  class_year: optionalInt(1900, 2100),
  short_bio: requiredText(500),
  story: richText,
  photo_media_id: mediaId,
  is_featured: z.boolean(),
  status: z.enum(['draft', 'published']),
  ...seoFields,
});

export type AlumniFormValues = z.input<typeof schema>;

export const ALUMNI_DUPLICATE_DRAFT_KEY = 'alumni:duplicate';

export function alumniFormDefaults(
  item?: AdminAlumni | null,
): AlumniFormValues {
  return {
    name: item?.name ?? '',
    slug: item?.slug ?? '',
    role_title: item?.role_title ?? '',
    class_year: item?.class_year ?? null,
    short_bio: item?.short_bio ?? '',
    story: { json: item?.story_json ?? null, html: item?.story_html ?? '' },
    photo_media_id: item?.photo_media_id ?? null,
    is_featured: item?.is_featured ?? false,
    status: item?.status ?? 'draft',
    seo_title: item?.seo.title ?? '',
    seo_description: item?.seo.description ?? '',
  };
}

export function alumniDuplicateDraft(item: AdminAlumni): AlumniFormValues {
  return { ...alumniFormDefaults(item), slug: '', status: 'draft' };
}

export type AlumniFormProps = { alumni?: AdminAlumni };

export function AlumniForm({ alumni }: AlumniFormProps) {
  const router = useRouter();
  const isEdit = !!alumni;
  const create = useCreateAlumni();
  const update = useUpdateAlumni();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(schema, {
    defaultValues: alumniFormDefaults(alumni),
  });
  const { isDirty } = form.formState;
  useUnsavedChanges(isDirty);

  const { draft, clear: clearDraft } = useLocalDraft<AlumniFormValues>(
    isEdit ? null : ALUMNI_DUPLICATE_DRAFT_KEY,
  );
  useEffect(() => {
    if (!isEdit && draft) {
      form.reset(draft.value);
      clearDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const onSubmit = form.handleSubmit(async (values) => {
    const input: AlumniInput = {
      name: values.name,
      slug: values.slug,
      role_title: values.role_title,
      class_year: values.class_year,
      short_bio: values.short_bio,
      story_json: values.story.json as AlumniInput['story_json'],
      story_html: values.story.html,
      photo_media_id: values.photo_media_id,
      is_featured: values.is_featured,
      sort_order: alumni?.sort_order,
      status: values.status,
      seo_title: values.seo_title,
      seo_description: values.seo_description,
    };
    try {
      if (isEdit) {
        const saved = await update.mutateAsync({ id: alumni.id, input });
        form.reset(alumniFormDefaults(saved));
        toast.success('Tokoh alumni disimpan.');
      } else {
        const saved = await create.mutateAsync(input);
        toast.success('Tokoh alumni dibuat.');
        router.push(`/admin/alumni/${saved.id}`);
      }
    } catch (err) {
      applyServerErrors(form, err, {
        knownFields: ['name', 'slug', 'role_title', 'short_bio'],
      });
    }
  });

  const slug = form.watch('slug');
  const name = form.watch('name');

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-8"
    >
      <FieldGroup className="gap-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <Controller
            control={form.control}
            name="photo_media_id"
            render={({ field, fieldState }) => (
              <MediaField
                value={field.value}
                onChange={(v) => field.onChange(v)}
                label="Foto"
                aspect="3/4"
                error={fieldState.error?.message}
              />
            )}
          />
          <FieldGroup className="gap-5">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="alumni-name">Nama</FieldLabel>
                  <Input
                    {...field}
                    id="alumni-name"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="slug"
              render={({ field, fieldState }) => (
                <SlugField
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  sourceValue={name}
                  autoFrom="nama"
                  error={fieldState.error?.message}
                />
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="role_title"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="alumni-role">
                      Peran / jabatan
                    </FieldLabel>
                    <Input
                      {...field}
                      id="alumni-role"
                      placeholder="Mis. Wirausahawan, Angkatan 2005"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="class_year"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="alumni-year">
                      Angkatan (opsional)
                    </FieldLabel>
                    <Input
                      id="alumni-year"
                      type="number"
                      value={(field.value as number | null | undefined) ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
          </FieldGroup>
        </div>

        <Controller
          control={form.control}
          name="short_bio"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="alumni-bio">Bio singkat</FieldLabel>
              <Textarea
                {...field}
                id="alumni-bio"
                rows={3}
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                Ditampilkan di kartu daftar tokoh. Maksimal 500 karakter.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="is_featured"
            render={({ field }) => (
              <Field orientation="horizontal">
                <FieldLabel htmlFor="alumni-featured">
                  Tampil di beranda
                </FieldLabel>
                <Switch
                  id="alumni-featured"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="status"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="alumni-status">Status</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="alumni-status"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="story"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="alumni-story">Kisah alumni</FieldLabel>
              <RichTextEditor
                id="alumni-story"
                value={field.value}
                onChange={field.onChange}
                mode="body"
                placeholder="Tulis kisah alumni…"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <SeoFields
          form={form}
          previewUrlBase={absoluteUrl(`/tokoh/${slug || '…'}`)}
          fallbackTitle={name}
        />
      </FieldGroup>

      <FormActions>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => router.push('/admin/alumni')}
        >
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {isEdit ? 'Simpan tokoh' : 'Buat tokoh'}
        </Button>
      </FormActions>
    </form>
  );
}

export function AlumniEditView({ id }: { id: number }) {
  const { data, isLoading, isError } = useAlumni(id);

  if (isLoading) return <ListPageSkeleton />;
  if (isError || !data) {
    return (
      <EmptyState
        title="Tokoh alumni tidak ditemukan"
        description="Profil ini mungkin sudah dihapus."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sunting tokoh alumni" description={data.name} />
      <AlumniForm alumni={data} />
    </div>
  );
}
