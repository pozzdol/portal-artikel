'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  FileWarningIcon,
  HistoryIcon,
  LockIcon,
  Trash2Icon,
} from 'lucide-react';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { EmptyState } from '@/components/admin/EmptyState';
import { FormActions } from '@/components/admin/FormActions';
import { SlugField } from '@/components/admin/SlugField';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { RichTextEditor } from '@/components/admin/editor/RichTextEditor';
import { usePermission } from '@/components/admin/shell/PermissionGate';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/shadcn/alert';
import { Button } from '@/components/ui/shadcn/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import {
  articlesApi,
  useArticle,
  useCreateArticle,
  useUpdateArticle,
} from '@/lib/api/admin/articles';
import { useMe } from '@/lib/api/admin/auth';
import {
  useCategoryTree,
  usePublicCategoryTree,
} from '@/lib/api/admin/taxonomy';
import type { AdminArticleDetail, Me } from '@/lib/api/admin/types';
import { isApiClientError } from '@/lib/api/client';
import { formatWib, relativeWib } from '@/lib/datetime';
import { applyServerErrors } from '@/lib/forms/serverErrors';
import { useZodForm } from '@/lib/forms/useZodForm';
import { useLocalDraft } from '@/lib/hooks/useLocalDraft';
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges';
import { absoluteUrl } from '@/lib/site-url';

import { ArticleMetaFields } from './ArticleMetaFields';
import {
  ActionButton,
  PublishPanel,
  publishButtons,
  type PublishAction,
} from './PublishPanel';
import {
  activeTree,
  articleSchema,
  articleToValues,
  canEditArticle,
  emptyArticleValues,
  EXCERPT_MAX,
  findCategory,
  isEventCategory,
  KNOWN_FIELDS,
  publicPath,
  SERVER_FIELD_MAP,
  snapshotValues,
  TITLE_MAX,
  valuesToInput,
  type ArticleFormOutput,
  type ArticleFormValues,
  type ArticlePerms,
} from './article-form';
import { useArticleActions } from './useArticleActions';

const AUTOSAVE_MS = 10_000;

type StoredDraft = {
  values: ArticleFormValues;
  /** updated_at of the server version the draft started from. */
  baseUpdatedAt: string | null;
};

/** Loads the article (or the signed-in user for a new one) and mounts the form. */
export function ArticleEditor({ id }: { id: number | null }) {
  const { data: me } = useMe();
  const query = useArticle(id);

  if (id !== null && query.isError) {
    const notFound =
      isApiClientError(query.error) && query.error.status === 404;
    return (
      <EmptyState
        icon={FileWarningIcon}
        title={notFound ? 'Artikel tidak ditemukan' : 'Artikel gagal dimuat'}
        description={
          notFound
            ? 'Artikel ini mungkin sudah dihapus permanen atau alamatnya salah.'
            : 'Periksa koneksi Anda, lalu coba lagi.'
        }
        className="border-line border py-16"
        action={
          notFound ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/articles">Kembali ke daftar artikel</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Coba lagi
            </Button>
          )
        }
      />
    );
  }

  if (!me || (id !== null && !query.data)) return <EditorSkeleton />;

  return (
    <ArticleEditorForm
      key={id ?? 'new'}
      article={id !== null ? (query.data ?? null) : null}
      me={me}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[26rem] w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

function ArticleEditorForm({
  article,
  me,
}: {
  article: AdminArticleDetail | null;
  me: Me;
}) {
  const router = useRouter();
  const isNew = article === null;

  const perms: ArticlePerms = {
    create: usePermission('articles.create'),
    update: usePermission('articles.update'),
    updateAny: usePermission('articles.update_any'),
    publish: usePermission('articles.publish'),
    remove: usePermission('articles.delete'),
  };
  const editable = isNew
    ? perms.create
    : canEditArticle(perms, me.id, article.created_by);
  const trashed = !!article?.deleted_at;
  const readOnly = !editable || trashed;

  // ---- form + dirty tracking (JSON snapshot, never HTML) -----------------
  const [initialValues] = React.useState<ArticleFormValues>(() =>
    article ? articleToValues(article) : emptyArticleValues(me.id),
  );
  const form = useZodForm(articleSchema, { defaultValues: initialValues });
  const [baseline, setBaseline] = React.useState(() =>
    snapshotValues(initialValues),
  );
  const values = useWatch({ control: form.control }) as ArticleFormValues;
  const snapshot = snapshotValues(values);
  const dirty = !readOnly && snapshot !== baseline;
  const { confirmLeave } = useUnsavedChanges(dirty);

  // ---- categories --------------------------------------------------------
  const canManageCategories = usePermission('categories.manage');
  const adminTree = useCategoryTree({ enabled: canManageCategories });
  const publicTree = usePublicCategoryTree({ enabled: !canManageCategories });
  const treeQuery = canManageCategories ? adminTree : publicTree;
  const tree = React.useMemo(
    () => activeTree(treeQuery.data, values.category_id),
    [treeQuery.data, values.category_id],
  );
  const categoryHit = findCategory(tree, values.category_id);
  const withEvent = isEventCategory(categoryHit);
  const previewUrl = absoluteUrl(publicPath(categoryHit, values.slug));

  // ---- slug: follows the title only until the article has been published --
  const followTitle =
    isNew || (article.status === 'draft' && !article.published_at);
  const [slugKey, setSlugKey] = React.useState(0);
  const articleId = article?.id;
  const checkSlug = React.useCallback(
    (slug: string) => articlesApi.slugCheck(slug, articleId),
    [articleId],
  );

  // ---- local draft autosave ---------------------------------------------
  const local = useLocalDraft<StoredDraft>(
    readOnly ? null : isNew ? 'article:new' : `article:${article.id}`,
  );
  const [draftDecided, setDraftDecided] = React.useState(false);
  const storedDraft = local.draft;
  const showRestore =
    !draftDecided &&
    !!storedDraft?.value?.values &&
    snapshotValues(storedDraft.value.values) !== baseline;

  const live = React.useRef({ baseline, blocked: showRestore });
  const lastDraftSnap = React.useRef<string | null>(null);
  React.useEffect(() => {
    live.current = { baseline, blocked: showRestore };
  }, [baseline, showRestore]);

  const { saveNow: saveDraftNow, clear: clearDraft } = local;
  const baseUpdatedAt = article?.updated_at ?? null;
  React.useEffect(() => {
    if (readOnly) return;
    const timer = setInterval(() => {
      if (live.current.blocked) return;
      const current = form.getValues();
      const snap = snapshotValues(current);
      if (snap === live.current.baseline || snap === lastDraftSnap.current)
        return;
      lastDraftSnap.current = snap;
      saveDraftNow({ values: current, baseUpdatedAt });
      setDraftDecided(true);
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [readOnly, form, saveDraftNow, baseUpdatedAt]);

  function restoreDraft() {
    const v = storedDraft?.value?.values;
    if (!v) return;
    form.reset(v, { keepDefaultValues: true });
    setSlugKey((k) => k + 1);
    setDraftDecided(true);
    lastDraftSnap.current = snapshotValues(v);
    toast.success('Draf lokal dipulihkan.', {
      description: 'Simpan untuk mengirim perubahan ini ke server.',
    });
  }
  function discardDraft() {
    clearDraft();
    lastDraftSnap.current = null;
    setDraftDecided(true);
  }

  // ---- publication time ---------------------------------------------------
  const status = article?.status ?? null;
  const savedPublishedAt = article?.published_at ?? null;
  const pubBase =
    status === 'published' || status === 'scheduled' ? savedPublishedAt : null;
  const pubKey = `${status}|${savedPublishedAt}`;
  const [pubEdit, setPubEdit] = React.useState<{
    key: string;
    value: string | null;
  } | null>(null);
  const publishAt = pubEdit && pubEdit.key === pubKey ? pubEdit.value : pubBase;
  const buttons = publishButtons({
    status,
    savedPublishedAt: pubBase,
    publishAt,
    canPublish: perms.publish,
  });

  // ---- persistence ------------------------------------------------------
  const create = useCreateArticle();
  const update = useUpdateArticle();
  const actions = useArticleActions();
  const [busy, setBusy] = React.useState<PublishAction['kind'] | null>(null);
  const [confirm, setConfirm] = React.useState<'unpublish' | 'trash' | null>(
    null,
  );

  async function persist(): Promise<AdminArticleDetail | null> {
    const box: { parsed?: ArticleFormOutput } = {};
    await form.handleSubmit(
      (v) => {
        box.parsed = v;
      },
      () => {
        toast.error('Periksa kembali isian yang ditandai.');
      },
    )();
    if (!box.parsed) return null;
    const content = form.getValues('content');
    const input = valuesToInput(box.parsed, { withEvent });
    try {
      const d = isNew
        ? await create.mutateAsync(input)
        : await update.mutateAsync({ id: article.id, input });
      // Keep the editor's own content object so Tiptap is not re-seeded, and
      // an empty excerpt empty (the server derives one from the body each save).
      const next: ArticleFormValues = {
        ...articleToValues(d),
        content,
        ...(box.parsed.excerpt ? {} : { excerpt: '' }),
      };
      form.reset(next);
      setBaseline(snapshotValues(next));
      clearDraft();
      lastDraftSnap.current = null;
      return d;
    } catch (err) {
      applyServerErrors(form, err, {
        fieldMap: SERVER_FIELD_MAP,
        knownFields: KNOWN_FIELDS,
      });
      return null;
    }
  }

  async function onAction(a: PublishAction) {
    if (busy) return;
    if (a.kind === 'unpublish') {
      setConfirm('unpublish');
      return;
    }
    setBusy(a.kind);
    try {
      if (a.kind === 'save') {
        const d = await persist();
        if (!d) return;
        toast.success(
          d.status === 'draft' ? 'Draf disimpan.' : 'Perubahan disimpan.',
        );
        if (isNew) router.replace(`/admin/articles/${d.id}`);
        return;
      }
      let target: AdminArticleDetail | null = article;
      if (isNew || dirty) target = await persist();
      if (!target) return;
      const res = await actions.publishNow(target, a.at);
      if (res) setPubEdit(null);
      if (isNew) router.replace(`/admin/articles/${target.id}`);
    } finally {
      setBusy(null);
    }
  }

  // Ctrl/Cmd+S saves.
  const onActionRef = React.useRef(onAction);
  React.useEffect(() => {
    onActionRef.current = onAction;
  });
  React.useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void onActionRef.current({ kind: 'save', label: 'Simpan' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  const excerptLen = (values.excerpt ?? '').length;
  const draftSavedAt = draftDecided && storedDraft ? storedDraft.savedAt : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar: the article title field below is the page's headline. */}
      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2.5">
            <Link
              href="/admin/articles"
              onClick={(e) => {
                if (!confirmLeave()) e.preventDefault();
              }}
            >
              <ArrowLeftIcon />
              Artikel
            </Link>
          </Button>
          <span className="text-muted-foreground text-sm">
            {isNew ? 'Tulis artikel' : `#${article.id}`}
          </span>
          {status ? <StatusBadge status={status} /> : null}
        </div>
        <div className="flex items-center gap-3">
          {draftSavedAt ? (
            <span className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:inline-flex">
              <HistoryIcon className="size-3.5" />
              Cadangan lokal {formatWib(draftSavedAt, 'HH:mm:ss')}
            </span>
          ) : null}
          {article && !trashed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actions.pending.preview}
                  onClick={() => void actions.view(article)}
                >
                  <ExternalLinkIcon />
                  {article.status === 'published' ? 'Lihat' : 'Pratinjau'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {dirty
                  ? 'Menampilkan versi tersimpan — simpan dulu untuk melihat perubahan.'
                  : 'Buka di tab baru.'}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {showRestore && storedDraft ? (
        <Alert>
          <HistoryIcon />
          <AlertTitle>Ada cadangan lokal yang belum disimpan</AlertTitle>
          <AlertDescription>
            Dibuat {relativeWib(storedDraft.savedAt)} di perangkat ini.
            {!isNew &&
            storedDraft.value.baseUpdatedAt &&
            storedDraft.value.baseUpdatedAt !== article.updated_at
              ? ' Artikel sudah diubah di server sejak cadangan ini dibuat.'
              : null}
          </AlertDescription>
          <AlertAction className="flex gap-2">
            <Button size="sm" onClick={restoreDraft}>
              Pulihkan
            </Button>
            <Button size="sm" variant="ghost" onClick={discardDraft}>
              Buang
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {trashed && article ? (
        <Alert>
          <Trash2Icon />
          <AlertTitle>Artikel ini ada di Sampah</AlertTitle>
          <AlertDescription>
            Pulihkan untuk mengedit atau menerbitkannya lagi.
          </AlertDescription>
          {perms.remove ? (
            <AlertAction>
              <Button
                size="sm"
                variant="outline"
                disabled={actions.pending.restore}
                onClick={() => void actions.untrash(article)}
              >
                Pulihkan
              </Button>
            </AlertAction>
          ) : null}
        </Alert>
      ) : null}

      {!editable && !trashed ? (
        <Alert>
          <LockIcon />
          <AlertTitle>Hanya bisa dibaca</AlertTitle>
          <AlertDescription>
            {isNew
              ? 'Akun Anda tidak memiliki izin menulis artikel.'
              : 'Artikel ini milik penulis lain. Anda memerlukan izin mengedit semua artikel untuk mengubahnya.'}
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        method="post"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void onAction({ kind: 'save', label: 'Simpan' });
        }}
        className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-6">
          <legend className="sr-only">Isi artikel</legend>
          <Controller
            control={form.control}
            name="title"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="article-title" className="sr-only">
                  Judul
                </FieldLabel>
                <Textarea
                  {...field}
                  id="article-title"
                  rows={1}
                  maxLength={TITLE_MAX}
                  placeholder="Judul artikel"
                  aria-invalid={fieldState.invalid}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  className="text-foreground placeholder:text-muted-foreground/60 min-h-0 resize-none border-0 bg-transparent px-0 py-1 font-serif text-4xl leading-[1.15] font-medium shadow-none focus-visible:ring-0 md:text-5xl dark:bg-transparent"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <div className="border-line flex flex-col gap-2 border-t pt-5">
            <Controller
              control={form.control}
              name="slug"
              render={({ field, fieldState }) => (
                <SlugField
                  key={slugKey}
                  id="article-slug"
                  value={field.value}
                  onChange={field.onChange}
                  sourceValue={followTitle ? values.title : article.slug}
                  autoFrom={followTitle ? 'judul' : 'slug tersimpan'}
                  checkAvailability={checkSlug}
                  error={fieldState.error?.message}
                  disabled={readOnly}
                />
              )}
            />
            {!followTitle ? (
              <p className="text-muted-foreground text-xs">
                Artikel ini pernah terbit. Mengubah slug membuat alamat lama
                dialihkan otomatis ke alamat baru.
              </p>
            ) : null}
          </div>

          <Controller
            control={form.control}
            name="excerpt"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="article-excerpt">Ringkasan</FieldLabel>
                <Textarea
                  {...field}
                  id="article-excerpt"
                  value={field.value ?? ''}
                  rows={3}
                  maxLength={EXCERPT_MAX}
                  placeholder="Satu-dua kalimat yang tampil di kartu artikel dan hasil pencarian."
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription className="flex justify-between gap-2">
                  <span>Kosongkan untuk mengambil dari awal isi artikel.</span>
                  <span
                    className={
                      excerptLen >= EXCERPT_MAX
                        ? 'text-destructive tabular-nums'
                        : 'tabular-nums'
                    }
                  >
                    {excerptLen}/{EXCERPT_MAX}
                  </span>
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="content"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="article-body" className="sr-only">
                  Isi artikel
                </FieldLabel>
                <RichTextEditor
                  id="article-body"
                  aria-label="Isi artikel"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Mulai menulis…"
                  minHeight={440}
                  disabled={readOnly}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </fieldset>

        <aside
          className="flex min-w-0 flex-col gap-4"
          aria-label="Pengaturan artikel"
        >
          <PublishPanel
            status={status}
            savedPublishedAt={savedPublishedAt}
            publishAt={publishAt}
            onPublishAtChange={(v) => setPubEdit({ key: pubKey, value: v })}
            buttons={buttons}
            onAction={(a) => void onAction(a)}
            busy={busy}
            canPublish={perms.publish}
            readOnly={readOnly}
            dirty={dirty}
            onTrash={
              article && !trashed && perms.remove
                ? () => setConfirm('trash')
                : undefined
            }
          />
          <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
            <legend className="sr-only">Metadata artikel</legend>
            <ArticleMetaFields
              form={form}
              tree={tree}
              categoriesLoading={treeQuery.isLoading}
              withEvent={withEvent}
              previewUrl={previewUrl}
              canChooseAuthor={perms.create}
              authorName={article?.author.display_name ?? me.display_name}
              readOnly={readOnly}
              knownTags={article?.tags}
            />
          </fieldset>
        </aside>
      </form>

      {!readOnly && buttons.primary ? (
        <FormActions className="-mx-1 lg:hidden">
          {buttons.secondary ? (
            <ActionButton
              action={buttons.secondary}
              variant="outline"
              busy={busy}
              onAction={(a) => void onAction(a)}
            />
          ) : null}
          <ActionButton
            action={buttons.primary}
            variant="default"
            busy={busy}
            onAction={(a) => void onAction(a)}
          />
        </FormActions>
      ) : null}

      {article ? (
        <>
          <ConfirmDialog
            open={confirm === 'unpublish'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={
              article.status === 'scheduled'
                ? 'Batalkan jadwal terbit?'
                : 'Batalkan terbit artikel?'
            }
            description={
              <>
                “{article.title}” akan kembali menjadi draf dan tidak tampil di
                portal.
              </>
            }
            confirmLabel="Batalkan terbit"
            loading={actions.pending.unpublish}
            onConfirm={async () => {
              const res = await actions.unpublishNow(article);
              if (res) setPubEdit(null);
              setConfirm(null);
            }}
          />
          <ConfirmDialog
            open={confirm === 'trash'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title="Pindahkan artikel ke Sampah?"
            description={
              <>
                “{article.title}” tidak lagi tampil di portal. Anda bisa
                memulihkannya dari tab Sampah.
              </>
            }
            confirmLabel="Hapus artikel"
            destructive
            loading={actions.pending.remove}
            onConfirm={async () => {
              const ok = await actions.trash(article);
              setConfirm(null);
              if (ok) {
                clearDraft();
                router.push('/admin/articles');
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}
