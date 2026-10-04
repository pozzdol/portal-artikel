'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { EmptyState } from '@/components/admin/EmptyState';
import { FormActions } from '@/components/admin/FormActions';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { PageHeader } from '@/components/admin/PageHeader';
import { SeoFields } from '@/components/admin/SeoFields';
import { SlugField } from '@/components/admin/SlugField';
import { RichTextEditor } from '@/components/admin/editor/RichTextEditor';
import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
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
import { useCreatePage, usePage, useUpdatePage } from '@/lib/api/admin/pages';
import type {
  AdminPage,
  PageInput,
  PublishStatus,
} from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import {
  mediaId,
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
  title: requiredText(200),
  slug: optionalSlug,
  content: richText,
  status: z.enum(['draft', 'published']),
  og_media_id: mediaId,
  ...seoFields,
});

export type PageFormValues = z.input<typeof schema>;

export const PAGE_DUPLICATE_DRAFT_KEY = 'page:duplicate';

export function pageFormDefaults(item?: AdminPage | null): PageFormValues {
  return {
    title: item?.title ?? '',
    slug: item?.slug ?? '',
    content: {
      json: item?.content_json ?? null,
      html: item?.content_html ?? '',
    },
    status: item?.status ?? 'draft',
    og_media_id: item?.og_media_id ?? null,
    seo_title: item?.seo.title ?? '',
    seo_description: item?.seo.description ?? '',
  };
}

export function pageDuplicateDraft(item: AdminPage): PageFormValues {
  return { ...pageFormDefaults(item), slug: '', status: 'draft' };
}

export type PageFormProps = { page?: AdminPage };

export function PageForm({ page }: PageFormProps) {
  const router = useRouter();
  const isEdit = !!page;
  const create = useCreatePage();
  const update = useUpdatePage();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(schema, { defaultValues: pageFormDefaults(page) });
  const { isDirty } = form.formState;
  useUnsavedChanges(isDirty);

  const { draft, clear: clearDraft } = useLocalDraft<PageFormValues>(
    isEdit ? null : PAGE_DUPLICATE_DRAFT_KEY,
  );
  useEffect(() => {
    if (!isEdit && draft) {
      form.reset(draft.value);
      clearDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const onSubmit = form.handleSubmit(async (values) => {
    const input: PageInput = {
      title: values.title,
      slug: values.slug,
      content_json: values.content.json as PageInput['content_json'],
      content_html: values.content.html,
      status: values.status,
      og_media_id: values.og_media_id,
      seo_title: values.seo_title,
      seo_description: values.seo_description,
    };
    try {
      if (isEdit) {
        const saved = await update.mutateAsync({ id: page.id, input });
        form.reset(pageFormDefaults(saved));
        toast.success('Halaman disimpan.');
      } else {
        const saved = await create.mutateAsync(input);
        toast.success('Halaman dibuat.');
        router.push(`/admin/pages/${saved.id}`);
      }
    } catch (err) {
      applyServerErrors(form, err, { knownFields: ['title', 'slug'] });
    }
  });

  const slug = form.watch('slug');
  const title = form.watch('title');

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-8"
    >
      <FieldGroup className="gap-6">
        <div className="grid gap-6 sm:grid-cols-[1fr_180px]">
          <Controller
            control={form.control}
            name="title"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="page-title">Judul</FieldLabel>
                <Input
                  {...field}
                  id="page-title"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="status"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="page-status">Status</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="page-status"
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
          name="slug"
          render={({ field, fieldState }) => (
            <SlugField
              value={field.value ?? ''}
              onChange={field.onChange}
              sourceValue={title}
              autoFrom="judul"
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={form.control}
          name="content"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="page-content">Konten</FieldLabel>
              <RichTextEditor
                id="page-content"
                value={field.value}
                onChange={field.onChange}
                mode="body"
                placeholder="Tulis konten halaman…"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <SeoFields
          form={form}
          withOg
          previewUrlBase={absoluteUrl(`/halaman/${slug || '…'}`)}
          fallbackTitle={title}
        />
      </FieldGroup>

      <FormActions>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => router.push('/admin/pages')}
        >
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {isEdit ? 'Simpan halaman' : 'Buat halaman'}
        </Button>
      </FormActions>
    </form>
  );
}

export function PageEditView({ id }: { id: number }) {
  const { data, isLoading, isError } = usePage(id);

  if (isLoading) return <ListPageSkeleton />;
  if (isError || !data) {
    return (
      <EmptyState
        title="Halaman tidak ditemukan"
        description="Halaman ini mungkin sudah dihapus."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sunting halaman" description={data.title} />
      <PageForm page={data} />
    </div>
  );
}
