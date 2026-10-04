'use client';

import * as React from 'react';
import { CalendarRangeIcon, XIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/shadcn/button';
import { Field, FieldLabel } from '@/components/ui/shadcn/field';
import {
  InputGroup,
  InputGroupInput,
} from '@/components/ui/shadcn/input-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/shadcn/popover';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/shadcn/toggle-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/cn';

import {
  type DateRangeValue,
  dateToYmd,
  formatDateText,
  formatRangeLabel,
  isYmd,
  matchPreset,
  normalizeRange,
  parseDateText,
  rangePresets,
  ymdToDate,
} from './helpers';
import { WibCalendar } from './WibCalendar';

export type { DateRangeValue } from './helpers';

export interface DateRangePickerProps {
  /** Inclusive WIB range of `'YYYY-MM-DD'` strings; either end may be missing. */
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Show quick ranges (Hari ini, 7/30 hari terakhir, Bulan ini). Default `true`. */
  presets?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Forwarded to the trigger button. */
  ref?: React.Ref<HTMLButtonElement>;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}

function clean(value: DateRangeValue): DateRangeValue {
  const out: DateRangeValue = {};
  if (isYmd(value.from)) out.from = value.from;
  if (isYmd(value.to)) out.to = value.to;
  return normalizeRange(out);
}

function sameRange(a: DateRangeValue, b: DateRangeValue): boolean {
  return a.from === b.from && a.to === b.to;
}

export function DateRangePicker({
  value,
  onChange,
  presets = true,
  placeholder = 'Semua tanggal',
  disabled,
  id,
  className,
  ref,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const current = clean(value);
  const [open, setOpen] = React.useState(false);
  // In-progress calendar selection (first click made, second pending).
  const [draft, setDraft] = React.useState<DateRangeValue | null>(null);
  const presetList = React.useMemo(() => (open ? rangePresets() : []), [open]);

  const shown = draft ?? current;
  const selected: DateRange | undefined = shown.from
    ? { from: ymdToDate(shown.from), to: ymdToDate(shown.to) }
    : undefined;

  function emit(next: DateRangeValue) {
    const n = clean(next);
    if (!sameRange(n, current)) onChange(n);
  }

  function handleOpenChange(next: boolean) {
    if (!next && draft) {
      emit(draft);
      setDraft(null);
    }
    setOpen(next);
  }

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) {
      setDraft(null);
      emit({});
      return;
    }
    const from = dateToYmd(range.from);
    const to = range.to ? dateToYmd(range.to) : undefined;
    if (to) {
      setDraft(null);
      emit({ from, to });
    } else {
      setDraft({ from });
    }
  }

  const label = formatRangeLabel(current);
  const hasValue = !!(current.from || current.to);
  const presetKey = matchPreset(shown, presetList);
  const defaultMonth = ymdToDate(current.from ?? current.to);

  return (
    <div className={cn('flex w-full items-center gap-1 sm:w-auto', className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={
              ariaInvalid === true || ariaInvalid === 'true' || undefined
            }
            aria-describedby={ariaDescribedBy}
            aria-label={
              hasValue ? `Rentang tanggal: ${label}` : 'Pilih rentang tanggal'
            }
            className={cn(
              'w-full justify-start gap-2 font-normal tabular-nums sm:w-auto sm:min-w-56',
              !hasValue && 'text-muted-foreground',
            )}
          >
            <CalendarRangeIcon className="text-foreground/70" />
            <span className="truncate">{hasValue ? label : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0"
          aria-label="Pilih rentang tanggal"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col sm:flex-row">
            {presets ? (
              <div className="border-line border-b p-2 sm:w-40 sm:border-r sm:border-b-0">
                <ToggleGroup
                  type="single"
                  orientation={isMobile ? 'horizontal' : 'vertical'}
                  spacing={1}
                  size="sm"
                  value={presetKey}
                  aria-label="Rentang cepat"
                  className="w-full flex-wrap"
                  onValueChange={(key) => {
                    const p = presetList.find((x) => x.key === key);
                    if (!p) return;
                    setDraft(null);
                    emit({ from: p.from, to: p.to });
                    setOpen(false);
                  }}
                >
                  {presetList.map((p) => (
                    <ToggleGroupItem
                      key={p.key}
                      value={p.key}
                      className="data-[state=on]:text-foreground justify-start px-2 font-normal data-[state=on]:bg-transparent data-[state=on]:font-medium data-[state=on]:shadow-[inset_2px_0_0_var(--gold)]"
                    >
                      {p.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ) : null}
            <WibCalendar
              mode="range"
              autoFocus
              resetOnSelect
              numberOfMonths={isMobile ? 1 : 2}
              showOutsideDays={isMobile}
              defaultMonth={defaultMonth}
              selected={selected}
              onSelect={handleSelect}
            />
          </div>
          <div className="border-line flex flex-wrap items-end gap-2 border-t p-2">
            <RangeTextInput
              label="Dari"
              value={shown.from}
              onCommit={(from) => {
                setDraft(null);
                emit({ ...current, from });
              }}
            />
            <RangeTextInput
              label="Sampai"
              value={shown.to}
              onCommit={(to) => {
                setDraft(null);
                emit({ ...current, to });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground ml-auto"
              disabled={!hasValue && !draft}
              onClick={() => {
                setDraft(null);
                emit({});
              }}
            >
              Kosongkan
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {hasValue && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Hapus rentang tanggal"
          title="Hapus rentang"
          onClick={() => emit({})}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}

function RangeTextInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
}) {
  const inputId = React.useId();
  const [text, setText] = React.useState(formatDateText(value));
  const [invalid, setInvalid] = React.useState(false);
  const [prev, setPrev] = React.useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(formatDateText(value));
    setInvalid(false);
  }

  function commit() {
    const t = text.trim();
    if (t === '') {
      setInvalid(false);
      if (value) onCommit(undefined);
      return;
    }
    const parsed = parseDateText(t);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatDateText(parsed));
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <Field className="w-32 gap-1">
      <FieldLabel htmlFor={inputId} className="text-muted-foreground text-xs">
        {label}
      </FieldLabel>
      <InputGroup className="h-8">
        <InputGroupInput
          id={inputId}
          value={text}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={invalid || undefined}
          className="tabular-nums"
          onChange={(e) => {
            setText(e.target.value);
            if (invalid) setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
        />
      </InputGroup>
    </Field>
  );
}
