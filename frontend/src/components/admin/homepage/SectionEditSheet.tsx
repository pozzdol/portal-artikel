'use client';

import * as React from 'react';
import { CircleAlertIcon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/shadcn/alert';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/shadcn/sheet';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { useCreateSection, useUpdateSection } from '@/lib/api/admin/homepage';
import type { HomepageSection, SectionTypeInfo } from '@/lib/api/admin/types';
import { isApiClientError } from '@/lib/api/client';
import { toastApiError } from '@/lib/forms/serverErrors';

import { SectionConfigForm } from './SectionConfigForm';
import { SectionThumbnail } from './section-meta';
import {
  buildConfig,
  buildFields,
  initialValues,
  splitServerFields,
  validateConfig,
} from './schema-form';

export type SectionEditTarget =
  { kind: 'edit'; section: HomepageSection } | { kind: 'create'; type: string };

export type SectionEditSheetProps = {
  target: SectionEditTarget | null;
  typeInfo: SectionTypeInfo | undefined;
  /** True when the section is active and valid but missing from the public homepage. */
  hiddenBecauseEmpty?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (section: HomepageSection, created: boolean) => void;
};

/** Side sheet that edits (or creates) one section; form generated from its schema. */
export function SectionEditSheet({
  target,
  typeInfo,
  hiddenBecauseEmpty,
  onOpenChange,
  onSaved,
}: SectionEditSheetProps) {
  const [dirty, setDirty] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const open = target !== null;
  const key = target
    ? target.kind === 'edit'
      ? `e${target.section.id}`
      : `c${target.type}`
    : 'none';

  function requestClose(next: boolean) {
    if (next) return;
    if (dirty) setConfirmClose(true);
    else onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        >
          {target && typeInfo ? (
            <SheetBody
              key={key}
              target={target}
              typeInfo={typeInfo}
              hiddenBecauseEmpty={hiddenBecauseEmpty}
              onDirtyChange={setDirty}
              onCancel={() => requestClose(false)}
              onSaved={(s, created) => {
                setDirty(false);
                onOpenChange(false);
                onSaved?.(s, created);
              }}
            />
          ) : (
            <SheetHeader>
              <SheetTitle>Memuat…</SheetTitle>
              <SheetDescription>Menyiapkan formulir section.</SheetDescription>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Buang perubahan?"
        description="Perubahan pada section ini belum disimpan."
        confirmLabel="Buang perubahan"
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          setDirty(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

function SheetBody({
  target,
  typeInfo,
  hiddenBecauseEmpty,
  onDirtyChange,
  onCancel,
  onSaved,
}: {
  target: SectionEditTarget;
  typeInfo: SectionTypeInfo;
  hiddenBecauseEmpty?: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSaved: (s: HomepageSection, created: boolean) => void;
}) {
  const section = target.kind === 'edit' ? target.section : null;
  const fields = React.useMemo(
    () => buildFields(typeInfo.type, typeInfo.schema),
    [typeInfo],
  );
  const [label, setLabel] = React.useState(section?.label ?? typeInfo.label);
  const [values, setValues] = React.useState(() =>
    initialValues(fields, section ? section.config : typeInfo.default_config),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [labelError, setLabelError] = React.useState<string | null>(null);
  const create = useCreateSection();
  const update = useUpdateSection();
  const saving = create.isPending || update.isPending;
  const formId = `section-form-${section?.id ?? 'new'}`;

  const markDirty = () => onDirtyChange(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    const clientErrors = validateConfig(fields, values);
    setLabelError(
      !trimmed
        ? 'Wajib diisi.'
        : trimmed.length > 120
          ? 'Maksimal 120 karakter.'
          : null,
    );
    setErrors(clientErrors);
    if (!trimmed || trimmed.length > 120 || Object.keys(clientErrors).length) {
      toast.error('Periksa kembali isian yang ditandai.');
      return;
    }
    const config = buildConfig(fields, values);
    try {
      if (section) {
        const saved = await update.mutateAsync({
          id: section.id,
          input: { label: trimmed, config },
        });
        toast.success('Section disimpan.');
        onSaved(saved, false);
      } else {
        const saved = await create.mutateAsync({
          type: typeInfo.type,
          label: trimmed,
          config,
          is_active: true,
        });
        toast.success('Section ditambahkan ke beranda.');
        onSaved(saved, true);
      }
    } catch (err) {
      if (isApiClientError(err) && err.status === 422 && err.fields) {
        const { config: cfgErrs, other } = splitServerFields(err.fields);
        setErrors(cfgErrs);
        if (other.label) setLabelError(other.label);
        const leftover = Object.entries(other).filter(([k]) => k !== 'label');
        toast.error(err.message || 'Periksa kembali isian yang ditandai.', {
          description:
            leftover.map(([k, v]) => `${k}: ${v}`).join('\n') || undefined,
        });
        return;
      }
      toastApiError(err);
    }
  }

  return (
    <>
      <SheetHeader className="border-line gap-3 border-b p-5 pr-12">
        <div className="flex items-start gap-4">
          <SectionThumbnail
            type={typeInfo.type}
            className="hidden w-24 shrink-0 sm:block"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="font-serif text-2xl font-medium">
              {section ? 'Edit section' : 'Section baru'}
            </SheetTitle>
            <SheetDescription>
              {typeInfo.label}. {typeInfo.description}
            </SheetDescription>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline" className="font-mono text-[11px]">
                {typeInfo.type}
              </Badge>
              {section && !section.is_active ? (
                <Badge variant="secondary">Nonaktif</Badge>
              ) : null}
            </div>
          </div>
        </div>
      </SheetHeader>

      <form
        id={formId}
        method="post"
        onSubmit={submit}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5"
        noValidate
      >
        {section && !section.config_valid ? (
          <Alert variant="destructive" className="rounded-none">
            <CircleAlertIcon />
            <AlertTitle>Config tersimpan tidak valid</AlertTitle>
            <AlertDescription>
              Section ini tidak tampil di beranda sampai config diperbaiki.
              Periksa isian lalu simpan ulang.
            </AlertDescription>
          </Alert>
        ) : null}
        {hiddenBecauseEmpty ? (
          <Alert className="border-gold/60 rounded-none">
            <TriangleAlertIcon className="text-gold-strong" />
            <AlertTitle>Tidak akan tampil: data kosong</AlertTitle>
            <AlertDescription>
              Belum ada konten yang cocok dengan pengaturan ini, jadi section
              disembunyikan dari beranda.
            </AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={labelError ? true : undefined}>
          <FieldLabel htmlFor={`${formId}-label`}>
            Nama section<span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id={`${formId}-label`}
            value={label}
            maxLength={120}
            onChange={(e) => {
              setLabel(e.target.value);
              markDirty();
            }}
            aria-invalid={labelError ? true : undefined}
          />
          <p className="text-meta text-xs">
            Hanya terlihat di admin untuk mengenali section.
          </p>
          <FieldError>{labelError}</FieldError>
        </Field>

        <SectionConfigForm
          fields={fields}
          values={values}
          onChange={(v) => {
            setValues(v);
            markDirty();
          }}
          errors={errors}
          disabled={saving}
          idPrefix={formId}
        />
      </form>

      <SheetFooter className="border-line flex-row justify-end gap-2 border-t p-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Batal
        </Button>
        <Button type="submit" form={formId} variant="gold" disabled={saving}>
          {saving ? <Spinner className="size-4" /> : null}
          {section ? 'Simpan section' : 'Tambah section'}
        </Button>
      </SheetFooter>
    </>
  );
}
