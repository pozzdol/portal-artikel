'use client';

import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { ArticleSearchCombobox } from '@/components/admin/ArticleSearchCombobox';
import { CategoryCombobox } from '@/components/admin/CategoryCombobox';
import { TagCombobox } from '@/components/admin/TagCombobox';
import { RichTextEditor } from '@/components/admin/editor/RichTextEditor';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/shadcn/collapsible';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/shadcn/field';
import { Input } from '@/components/ui/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Switch } from '@/components/ui/shadcn/switch';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/shadcn/toggle-group';
import { cn } from '@/lib/cn';

import { SortableCheckList } from './SortableCheckList';
import {
  WIDGET_LABELS,
  enumLabel,
  type ConfigValues,
  type FormField,
} from './schema-form';

const NONE = '__none__';

/** Fields that only make sense for a given value of a sibling. */
const VISIBLE_WHEN: Record<string, (v: ConfigValues) => boolean> = {
  hero_article_id: (v) => v.hero_source === 'manual',
};

export type SectionConfigFormProps = {
  fields: FormField[];
  values: ConfigValues;
  onChange: (values: ConfigValues) => void;
  /** Keys "config.<path>". */
  errors: Record<string, string>;
  disabled?: boolean;
  idPrefix?: string;
};

/** Form generated from a section type's JSON Schema (plan §1.9). */
export function SectionConfigForm({
  fields,
  values,
  onChange,
  errors,
  disabled,
  idPrefix = 'cfg',
}: SectionConfigFormProps) {
  const specific = fields.filter(
    (f) => f.group === 'specific' && (VISIBLE_WHEN[f.name]?.(values) ?? true),
  );
  const common = fields.filter((f) => f.group === 'common');
  const commonHasError = Object.keys(errors).some((k) =>
    common.some(
      (f) => k === `config.${f.name}` || k.startsWith(`config.${f.name}.`),
    ),
  );
  const commonFilled = common.some((f) => {
    const v = values[f.name];
    if (v && typeof v === 'object') return Object.values(v).some(Boolean);
    return v != null && v !== '';
  });
  const [open, setOpen] = React.useState(commonFilled);
  const commonOpen = open || commonHasError;

  const set = (name: string, v: unknown) => onChange({ ...values, [name]: v });

  return (
    <div className="flex flex-col gap-6">
      {specific.length ? (
        <FieldGroup className="gap-5">
          {specific.map((f) => (
            <ConfigField
              key={f.path}
              field={f}
              value={values[f.name]}
              onChange={(v) => set(f.name, v)}
              errors={errors}
              disabled={disabled}
              idPrefix={idPrefix}
            />
          ))}
        </FieldGroup>
      ) : (
        <p className="text-meta text-sm">
          Tipe ini tidak punya pengaturan khusus.
        </p>
      )}

      {common.length ? (
        <Collapsible
          open={commonOpen}
          onOpenChange={setOpen}
          className="border-line border-t pt-4"
        >
          <CollapsibleTrigger className="hover:text-gold-strong group flex w-full items-center justify-between gap-2 text-left">
            <span className="flex flex-col">
              <span className="text-sm font-medium">Umum</span>
              <span className="text-meta text-xs">
                Judul, eyebrow, anchor, tautan selengkapnya, dan latar section.
              </span>
            </span>
            <ChevronDownIcon
              className={cn(
                'text-meta size-4 transition-transform',
                commonOpen && 'rotate-180',
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FieldGroup className="gap-5 pt-5">
              {common.map((f) => (
                <ConfigField
                  key={f.path}
                  field={f}
                  value={values[f.name]}
                  onChange={(v) => set(f.name, v)}
                  errors={errors}
                  disabled={disabled}
                  idPrefix={idPrefix}
                />
              ))}
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

type ConfigFieldProps = {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  idPrefix: string;
};

function ConfigField({
  field,
  value,
  onChange,
  errors,
  disabled,
  idPrefix,
}: ConfigFieldProps) {
  const id = `${idPrefix}-${field.path.replace(/\./g, '-')}`;
  const error = errors[`config.${field.path}`];
  const invalid = error ? true : undefined;
  const s = field.schema;
  const str = typeof value === 'string' ? value : '';
  const num =
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  if (field.kind === 'object') {
    const obj = (value ?? {}) as ConfigValues;
    return (
      <FieldSet className="border-line gap-4 border p-4">
        <FieldLegend variant="label" className="mb-0">
          {field.label}
        </FieldLegend>
        {field.description ? (
          <FieldDescription>{field.description}</FieldDescription>
        ) : null}
        <FieldDescription className="-mt-2 text-xs">
          Kosongkan keduanya bila section tidak perlu tautan.
        </FieldDescription>
        <div className="grid gap-4 sm:grid-cols-2">
          {(field.children ?? []).map((c) => (
            <ConfigField
              key={c.path}
              field={c}
              value={obj[c.name]}
              onChange={(v) => onChange({ ...obj, [c.name]: v })}
              errors={errors}
              disabled={disabled}
              idPrefix={idPrefix}
            />
          ))}
        </div>
      </FieldSet>
    );
  }

  if (field.kind === 'switch') {
    return (
      <Field orientation="horizontal" data-invalid={invalid}>
        <FieldContent>
          <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
          {field.description ? (
            <FieldDescription>{field.description}</FieldDescription>
          ) : null}
          <FieldError>{error}</FieldError>
        </FieldContent>
        <Switch
          id={id}
          checked={value === true}
          onCheckedChange={(c) => onChange(c)}
          disabled={disabled}
          aria-invalid={invalid}
        />
      </Field>
    );
  }

  let control: React.ReactNode;
  switch (field.kind) {
    case 'category':
      control = (
        <CategoryCombobox
          id={id}
          value={str || null}
          onChange={onChange}
          disabled={disabled}
        />
      );
      break;
    case 'tag':
      control = (
        <TagCombobox
          id={id}
          value={str || null}
          onChange={onChange}
          disabled={disabled}
        />
      );
      break;
    case 'article':
      control = (
        <ArticleSearchCombobox
          id={id}
          value={num}
          onChange={onChange}
          disabled={disabled}
        />
      );
      break;
    case 'widgets':
      control = (
        <SortableCheckList
          id={id}
          options={s.items?.enum ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          getLabel={(v) => WIDGET_LABELS[v] ?? v}
          disabled={disabled}
        />
      );
      break;
    case 'richtext':
      control = (
        <RichTextEditor
          id={id}
          value={{ json: null, html: str }}
          onChange={(v) => onChange(v.html)}
          placeholder="Tulis konten section…"
          minHeight={220}
          disabled={disabled}
          aria-label={field.label}
          aria-invalid={invalid}
        />
      );
      break;
    case 'textarea':
      control = (
        <Textarea
          id={id}
          value={str}
          maxLength={s.maxLength}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={invalid}
        />
      );
      break;
    case 'select': {
      const options = (s.enum ?? []).map(String);
      const clearable = s.default === undefined && !field.required;
      control = (
        <Select
          value={str || (clearable ? NONE : undefined)}
          onValueChange={(v) => onChange(v === NONE ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger
            id={id}
            className="w-full sm:w-64"
            aria-invalid={invalid}
          >
            <SelectValue placeholder="Pilih…" />
          </SelectTrigger>
          <SelectContent>
            {clearable ? <SelectItem value={NONE}>Bawaan</SelectItem> : null}
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {enumLabel(o)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    }
    case 'segmented':
      control = (
        <ToggleGroup
          id={id}
          type="single"
          variant="outline"
          spacing={0}
          value={num != null ? String(num) : ''}
          onValueChange={(v) => {
            if (v) onChange(Number(v));
          }}
          disabled={disabled}
          aria-invalid={invalid}
          aria-label={field.label}
        >
          {(s.enum ?? []).map((o) => (
            <ToggleGroupItem
              key={String(o)}
              value={String(o)}
              className="data-[state=on]:bg-ink data-[state=on]:text-paper min-w-12 tabular-nums"
            >
              {String(o)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
      break;
    case 'number':
      control = (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="w-32 tabular-nums"
          min={s.minimum}
          max={s.maximum}
          step={1}
          value={num ?? ''}
          placeholder={s.default != null ? String(s.default) : undefined}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
          disabled={disabled}
          aria-invalid={invalid}
        />
      );
      break;
    case 'text':
      control = (
        <Input
          id={id}
          value={str}
          maxLength={s.maxLength}
          placeholder={typeof s.default === 'string' ? s.default : undefined}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={invalid}
        />
      );
      break;
    default:
      control = (
        <p className="text-meta text-sm">
          Field ini belum didukung oleh formulir. Nilai tersimpan tidak diubah.
        </p>
      );
  }

  const range =
    field.kind === 'number' && (s.minimum != null || s.maximum != null)
      ? `Rentang ${s.minimum ?? '…'}–${s.maximum ?? '…'}.`
      : null;
  const description = [field.description, range].filter(Boolean).join(' ');

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>
        {field.label}
        {field.required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      {field.kind === 'number' ||
      field.kind === 'segmented' ||
      field.kind === 'select' ? (
        <div>{control}</div>
      ) : (
        control
      )}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
