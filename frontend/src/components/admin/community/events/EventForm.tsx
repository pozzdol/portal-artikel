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
import { DateTimePicker } from '@/components/ui/pickers';
import {
  useCreateEvent,
  useEvent,
  useUpdateEvent,
} from '@/lib/api/admin/events';
import type {
  AdminEvent,
  EventInput,
  EventStatus,
} from '@/lib/api/admin/types';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import {
  mediaId,
  optionalSlug,
  optionalText,
  optionalUrl,
  requiredDateTime,
  requiredText,
  richText,
  seoFields,
} from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';
import { useLocalDraft } from '@/lib/hooks/useLocalDraft';
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges';
import { absoluteUrl } from '@/lib/site-url';

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'draft', label: 'Draf' },
  { value: 'published', label: 'Terbit' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

const schema = z.object({
  title: requiredText(200),
  slug: optionalSlug,
  summary: optionalText(500),
  description: richText,
  starts_at: requiredDateTime,
  ends_at: z.string().nullable(),
  is_all_day: z.boolean(),
  location_name: requiredText(200),
  location_address: optionalText(500),
  maps_url: optionalUrl(500),
  cover_media_id: mediaId,
  registration_url: optionalUrl(500),
  status: z.enum(['draft', 'published', 'cancelled']),
  ...seoFields,
});

export type EventFormValues = z.input<typeof schema>;

export const DUPLICATE_DRAFT_KEY = 'event:duplicate';

export function eventFormDefaults(item?: AdminEvent | null): EventFormValues {
  return {
    title: item?.title ?? '',
    slug: item?.slug ?? '',
    summary: item?.summary ?? '',
    description: {
      json: item?.description_json ?? null,
      html: item?.description_html ?? '',
    },
    starts_at: item?.starts_at ?? '',
    ends_at: item?.ends_at ?? null,
    is_all_day: item?.is_all_day ?? false,
    location_name: item?.location_name ?? '',
    location_address: item?.location_address ?? '',
    maps_url: item?.maps_url ?? '',
    cover_media_id: item?.cover_media_id ?? null,
    registration_url: item?.registration_url ?? '',
    status: item?.status ?? 'draft',
    seo_title: item?.seo.title ?? '',
    seo_description: item?.seo.description ?? '',
  };
}

/** Snapshot used by the list's "Duplikat" action: same shape, slug cleared, forced to draft. */
export function eventDuplicateDraft(item: AdminEvent): EventFormValues {
  return { ...eventFormDefaults(item), slug: '', status: 'draft' };
}

export type EventFormProps = {
  event?: AdminEvent;
};

export function EventForm({ event }: EventFormProps) {
  const router = useRouter();
  const isEdit = !!event;
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(schema, { defaultValues: eventFormDefaults(event) });
  const { isDirty } = form.formState;
  useUnsavedChanges(isDirty);

  const { draft, clear: clearDraft } = useLocalDraft<EventFormValues>(
    isEdit ? null : DUPLICATE_DRAFT_KEY,
  );
  useEffect(() => {
    if (!isEdit && draft) {
      form.reset(draft.value);
      clearDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const onSubmit = form.handleSubmit(async (values) => {
    const input: EventInput = {
      title: values.title,
      slug: values.slug,
      summary: values.summary,
      description_json: values.description
        .json as EventInput['description_json'],
      description_html: values.description.html,
      starts_at: values.starts_at,
      ends_at: values.ends_at,
      is_all_day: values.is_all_day,
      location_name: values.location_name,
      location_address: values.location_address,
      maps_url: values.maps_url,
      cover_media_id: values.cover_media_id,
      registration_url: values.registration_url,
      status: values.status,
      seo_title: values.seo_title,
      seo_description: values.seo_description,
    };
    try {
      if (isEdit) {
        const saved = await update.mutateAsync({ id: event.id, input });
        form.reset(eventFormDefaults(saved));
        toast.success('Agenda disimpan.');
      } else {
        const saved = await create.mutateAsync(input);
        toast.success('Agenda dibuat.');
        router.push(`/admin/events/${saved.id}`);
      }
    } catch (err) {
      applyServerErrors(form, err, {
        knownFields: ['title', 'slug', 'starts_at', 'ends_at', 'location_name'],
      });
    }
  });

  const slug = form.watch('slug');
  const title = form.watch('title');
  const isAllDay = form.watch('is_all_day');

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-8"
    >
      <FieldGroup className="gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Controller
            control={form.control}
            name="title"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="lg:col-span-2"
              >
                <FieldLabel htmlFor="event-title">Judul</FieldLabel>
                <Input
                  {...field}
                  id="event-title"
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
              <div className="lg:col-span-2">
                <SlugField
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  sourceValue={title}
                  autoFrom="judul"
                  error={fieldState.error?.message}
                />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="summary"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="lg:col-span-2"
              >
                <FieldLabel htmlFor="event-summary">Ringkasan</FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ''}
                  id="event-summary"
                  rows={3}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>Maksimal 500 karakter.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="is_all_day"
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldLabel htmlFor="event-all-day">Sepanjang hari</FieldLabel>
              <Switch
                id="event-all-day"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </Field>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="starts_at"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="event-starts">Mulai</FieldLabel>
                <DateTimePicker
                  id="event-starts"
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  allDay={isAllDay}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="ends_at"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="event-ends">Selesai (opsional)</FieldLabel>
                <DateTimePicker
                  id="event-ends"
                  value={field.value}
                  onChange={field.onChange}
                  allDay={isAllDay}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="location_name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="event-location">Lokasi</FieldLabel>
                <Input
                  {...field}
                  id="event-location"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="maps_url"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="event-maps">Tautan peta</FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  id="event-maps"
                  placeholder="https://maps.google.com/…"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>
        <Controller
          control={form.control}
          name="location_address"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="event-address">Alamat (opsional)</FieldLabel>
              <Textarea
                {...field}
                value={field.value ?? ''}
                id="event-address"
                rows={2}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="registration_url"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="event-registration">
                  Tautan pendaftaran (opsional)
                </FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  id="event-registration"
                  placeholder="https://…"
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
                <FieldLabel htmlFor="event-status">Status</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="event-status"
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
          name="cover_media_id"
          render={({ field, fieldState }) => (
            <MediaField
              value={field.value}
              onChange={(v) => field.onChange(v)}
              label="Gambar sampul"
              aspect="16/9"
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="event-description">Deskripsi</FieldLabel>
              <RichTextEditor
                id="event-description"
                value={field.value}
                onChange={field.onChange}
                mode="body"
                placeholder="Tulis deskripsi acara…"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <SeoFields
          form={form}
          previewUrlBase={absoluteUrl(`/agenda/${slug || '…'}`)}
          fallbackTitle={title}
        />
      </FieldGroup>

      <FormActions>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => router.push('/admin/events')}
        >
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {isEdit ? 'Simpan agenda' : 'Buat agenda'}
        </Button>
      </FormActions>
    </form>
  );
}

/** Fetches the event and renders the edit form (used by /admin/events/[id]). */
export function EventEditView({ id }: { id: number }) {
  const { data, isLoading, isError } = useEvent(id);

  if (isLoading) return <ListPageSkeleton />;
  if (isError || !data) {
    return (
      <EmptyState
        title="Agenda tidak ditemukan"
        description="Agenda ini mungkin sudah dihapus."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sunting agenda" description={data.title} />
      <EventForm event={data} />
    </div>
  );
}
