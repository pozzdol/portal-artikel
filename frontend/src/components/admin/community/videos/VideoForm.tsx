'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { EmptyState } from '@/components/admin/EmptyState';
import { FormActions } from '@/components/admin/FormActions';
import { ListPageSkeleton } from '@/components/admin/ListPageSkeleton';
import { MediaField } from '@/components/admin/MediaField';
import { PageHeader } from '@/components/admin/PageHeader';
import { SlugField } from '@/components/admin/SlugField';
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
  useCreateVideo,
  useParseVideoUrl,
  useUpdateVideo,
  useVideo,
} from '@/lib/api/admin/videos';
import type {
  AdminVideo,
  PublishStatus,
  VideoInput,
} from '@/lib/api/admin/types';
import { applyServerErrors, apiErrorMessage } from '@/lib/forms/serverErrors';
import {
  mediaId,
  optionalDateTime,
  optionalInt,
  optionalSlug,
  optionalText,
  requiredText,
} from '@/lib/forms/schemas';
import { useZodForm } from '@/lib/forms/useZodForm';
import { useLocalDraft } from '@/lib/hooks/useLocalDraft';
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges';

const STATUS_OPTIONS: { value: PublishStatus; label: string }[] = [
  { value: 'draft', label: 'Draf' },
  { value: 'published', label: 'Terbit' },
];

const schema = z.object({
  title: requiredText(200),
  slug: optionalSlug,
  youtube_id: z
    .string()
    .length(11, 'ID YouTube harus 11 karakter. Tempel URL lalu klik "Ambil".'),
  description: optionalText(2000),
  duration_seconds: optionalInt(0),
  view_count: optionalInt(0),
  thumbnail_media_id: mediaId,
  published_at: optionalDateTime,
  is_featured: z.boolean(),
  status: z.enum(['draft', 'published']),
});

export type VideoFormValues = z.input<typeof schema>;

export const VIDEO_DUPLICATE_DRAFT_KEY = 'video:duplicate';

export function videoFormDefaults(item?: AdminVideo | null): VideoFormValues {
  return {
    title: item?.title ?? '',
    slug: item?.slug ?? '',
    youtube_id: item?.youtube_id ?? '',
    description: item?.description ?? '',
    duration_seconds: item?.duration_seconds ?? null,
    view_count: item?.view_count ?? null,
    thumbnail_media_id: item?.thumbnail_media_id ?? null,
    published_at: item?.published_at ?? null,
    is_featured: item?.is_featured ?? false,
    status: item?.status ?? 'draft',
  };
}

export function videoDuplicateDraft(item: AdminVideo): VideoFormValues {
  return { ...videoFormDefaults(item), slug: '', status: 'draft' };
}

/** "125" seconds -> "2:05"; null -> "". */
function formatDuration(total: number | null | undefined): string {
  if (total == null || Number.isNaN(total)) return '';
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** "2:05" -> 125; invalid -> null. */
function parseDuration(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const m = t.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

export type VideoFormProps = { video?: AdminVideo };

export function VideoForm({ video }: VideoFormProps) {
  const router = useRouter();
  const isEdit = !!video;
  const create = useCreateVideo();
  const update = useUpdateVideo();
  const parseUrl = useParseVideoUrl();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(schema, { defaultValues: videoFormDefaults(video) });
  const { isDirty } = form.formState;
  useUnsavedChanges(isDirty);

  const { draft, clear: clearDraft } = useLocalDraft<VideoFormValues>(
    isEdit ? null : VIDEO_DUPLICATE_DRAFT_KEY,
  );
  useEffect(() => {
    if (!isEdit && draft) {
      form.reset(draft.value);
      clearDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [durationText, setDurationText] = useState(() =>
    formatDuration(video?.duration_seconds),
  );

  const youtubeId = form.watch('youtube_id');
  const defaultThumb = youtubeId
    ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    : null;

  async function handleParseUrl() {
    if (!youtubeUrl.trim()) return;
    try {
      const res = await parseUrl.mutateAsync(youtubeUrl.trim());
      form.setValue('youtube_id', res.youtube_id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success('ID video ditemukan.');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  function commitDuration() {
    const parsed = parseDuration(durationText);
    if (durationText.trim() !== '' && parsed === null) {
      form.setError('duration_seconds', {
        type: 'manual',
        message: 'Format mm:ss, mis. 5:30.',
      });
      return;
    }
    form.clearErrors('duration_seconds');
    form.setValue('duration_seconds', parsed, { shouldDirty: true });
    setDurationText(formatDuration(parsed));
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const input: VideoInput = {
      title: values.title,
      slug: values.slug,
      youtube_id: values.youtube_id,
      description: values.description,
      duration_seconds: values.duration_seconds,
      view_count: values.view_count,
      thumbnail_media_id: values.thumbnail_media_id,
      published_at: values.published_at,
      is_featured: values.is_featured,
      status: values.status,
    };
    try {
      if (isEdit) {
        const saved = await update.mutateAsync({ id: video.id, input });
        form.reset(videoFormDefaults(saved));
        setDurationText(formatDuration(saved.duration_seconds));
        toast.success('Video disimpan.');
      } else {
        const saved = await create.mutateAsync(input);
        toast.success('Video dibuat.');
        router.push(`/admin/videos/${saved.id}`);
      }
    } catch (err) {
      applyServerErrors(form, err, {
        knownFields: ['title', 'slug', 'youtube_id'],
      });
    }
  });

  const title = form.watch('title');

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-8"
    >
      <FieldGroup className="gap-6">
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="video-title">Judul</FieldLabel>
              <Input
                {...field}
                id="video-title"
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
              sourceValue={title}
              autoFrom="judul"
              error={fieldState.error?.message}
            />
          )}
        />

        <Field>
          <FieldLabel htmlFor="video-url">Tautan YouTube</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="video-url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
            <Button
              type="button"
              variant="outline"
              disabled={parseUrl.isPending || !youtubeUrl.trim()}
              onClick={handleParseUrl}
            >
              {parseUrl.isPending ? <Spinner /> : null}
              Ambil
            </Button>
          </div>
          <FieldDescription>
            Tempel tautan video lalu klik &ldquo;Ambil&rdquo; untuk mengisi ID
            dan pratinjau thumbnail secara otomatis.
          </FieldDescription>
        </Field>

        <Controller
          control={form.control}
          name="youtube_id"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="video-youtube-id">
                ID video YouTube
              </FieldLabel>
              <Input
                {...field}
                id="video-youtube-id"
                className="max-w-xs font-mono text-sm"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        {defaultThumb ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Pratinjau thumbnail</span>
            <div className="border-line bg-muted relative aspect-video w-full max-w-md overflow-hidden border">
              <Image
                src={defaultThumb}
                alt=""
                fill
                sizes="448px"
                className="object-cover"
                unoptimized
              />
            </div>
          </div>
        ) : null}

        <Controller
          control={form.control}
          name="thumbnail_media_id"
          render={({ field, fieldState }) => (
            <MediaField
              value={field.value}
              onChange={(v) => field.onChange(v)}
              label="Thumbnail kustom (opsional)"
              aspect="16/9"
              description="Menggantikan thumbnail bawaan YouTube bila diisi."
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="video-description">
                Deskripsi (opsional)
              </FieldLabel>
              <Textarea
                {...field}
                value={field.value ?? ''}
                id="video-description"
                rows={4}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-3">
          <Field data-invalid={!!form.formState.errors.duration_seconds}>
            <FieldLabel htmlFor="video-duration">Durasi (mm:ss)</FieldLabel>
            <Input
              id="video-duration"
              value={durationText}
              onChange={(e) => setDurationText(e.target.value)}
              onBlur={commitDuration}
              placeholder="5:30"
              aria-invalid={!!form.formState.errors.duration_seconds}
            />
            <FieldError errors={[form.formState.errors.duration_seconds]} />
          </Field>
          <Controller
            control={form.control}
            name="view_count"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="video-views">Jumlah tonton</FieldLabel>
                <Input
                  id="video-views"
                  type="number"
                  min={0}
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
          <Controller
            control={form.control}
            name="published_at"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="video-published">
                  Tanggal terbit
                </FieldLabel>
                <DateTimePicker
                  id="video-published"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  Kosongkan untuk memakai waktu simpan.
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="is_featured"
            render={({ field }) => (
              <Field orientation="horizontal">
                <FieldLabel htmlFor="video-featured">
                  Sorot video ini
                </FieldLabel>
                <Switch
                  id="video-featured"
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
                <FieldLabel htmlFor="video-status">Status</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="video-status"
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
      </FieldGroup>

      <FormActions>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => router.push('/admin/videos')}
        >
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {isEdit ? 'Simpan video' : 'Buat video'}
        </Button>
      </FormActions>
    </form>
  );
}

export function VideoEditView({ id }: { id: number }) {
  const { data, isLoading, isError } = useVideo(id);

  if (isLoading) return <ListPageSkeleton />;
  if (isError || !data) {
    return (
      <EmptyState
        title="Video tidak ditemukan"
        description="Video ini mungkin sudah dihapus."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sunting video" description={data.title} />
      <VideoForm video={data} />
    </div>
  );
}
