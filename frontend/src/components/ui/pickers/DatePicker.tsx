'use client';

import * as React from 'react';
import { CalendarDaysIcon, XIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/shadcn/input-group';
import { Button } from '@/components/ui/shadcn/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/shadcn/popover';
import { cn } from '@/lib/cn';

import {
  dateToYmd,
  formatDateLabel,
  formatDateText,
  isYmd,
  isYmdWithin,
  parseDateText,
  ymdToDate,
} from './helpers';
import { WibCalendar } from './WibCalendar';

export interface DatePickerProps {
  /** `'YYYY-MM-DD'` (WIB calendar date) or `null`. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Inclusive lower bound, `'YYYY-MM-DD'`. */
  min?: string;
  /** Inclusive upper bound, `'YYYY-MM-DD'`. */
  max?: string;
  id?: string;
  name?: string;
  className?: string;
  /** Show the clear (×) button when a value is set. Default `true`. */
  clearable?: boolean;
  onBlur?: () => void;
  /** Forwarded to the text input (react-hook-form `field.ref`). */
  ref?: React.Ref<HTMLInputElement>;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
  'aria-label'?: string;
}

/** Calendar year span offered by the month/year dropdowns when unbounded. */
const YEARS_BACK = 80;
const YEARS_AHEAD = 10;

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  disabled,
  min,
  max,
  id,
  name,
  className,
  clearable = true,
  onBlur,
  ref,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const current = isYmd(value) ? value : null;
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() => formatDateText(current));
  const [typedInvalid, setTypedInvalid] = React.useState(false);

  // Keep the typed text in sync when the value changes from outside.
  const [prevValue, setPrevValue] = React.useState(current);
  if (current !== prevValue) {
    setPrevValue(current);
    setText(formatDateText(current));
    setTypedInvalid(false);
  }

  const selected = ymdToDate(current);
  const minDate = ymdToDate(min);
  const maxDate = ymdToDate(max);

  const disabledDays: Matcher[] = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });

  const [todayYmd] = React.useState(() => dateToYmd(Date.now()));
  const thisYear = Number(todayYmd.slice(0, 4));
  const startMonth = minDate ?? ymdToDate(`${thisYear - YEARS_BACK}-01-01`);
  const endMonth = maxDate ?? ymdToDate(`${thisYear + YEARS_AHEAD}-12-31`);

  function commitText() {
    const trimmed = text.trim();
    if (trimmed === '') {
      setTypedInvalid(false);
      if (current !== null) onChange(null);
      return;
    }
    const parsed = parseDateText(trimmed);
    if (parsed && isYmdWithin(parsed, min, max)) {
      setTypedInvalid(false);
      setText(formatDateText(parsed));
      if (parsed !== current) onChange(parsed);
    } else {
      // Keep what the user typed so they can fix it; flag it as invalid.
      setTypedInvalid(true);
    }
  }

  function pick(ymd: string | null) {
    setTypedInvalid(false);
    setText(formatDateText(ymd));
    if (ymd !== current) onChange(ymd);
    setOpen(false);
  }

  const todayAllowed = isYmdWithin(todayYmd, min, max);
  const invalid =
    typedInvalid || ariaInvalid === true || ariaInvalid === 'true';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <InputGroup
          data-disabled={disabled ? 'true' : undefined}
          className={cn('bg-background w-full sm:w-44', className)}
        >
          <InputGroupInput
            ref={ref}
            id={id}
            name={name}
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            inputMode="numeric"
            autoComplete="off"
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            aria-describedby={ariaDescribedBy}
            className="tabular-nums"
            onChange={(e) => {
              setText(e.target.value);
              if (typedInvalid) setTypedInvalid(false);
            }}
            onBlur={() => {
              commitText();
              onBlur?.();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitText();
              } else if (e.key === 'ArrowDown' && e.altKey) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          />
          <InputGroupAddon align="inline-end" className="gap-0.5">
            {clearable && current && !disabled ? (
              <InputGroupButton
                size="icon-xs"
                aria-label="Kosongkan tanggal"
                title="Kosongkan"
                onClick={() => pick(null)}
              >
                <XIcon />
              </InputGroupButton>
            ) : null}
            <InputGroupButton
              size="icon-xs"
              disabled={disabled}
              aria-label={
                current
                  ? `Pilih tanggal, terpilih ${formatDateLabel(current, 'EEEE, d MMMM yyyy')}`
                  : 'Pilih tanggal'
              }
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="text-foreground/70 hover:text-foreground"
            >
              <CalendarDaysIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-auto gap-0 p-0"
        aria-label="Kalender"
        onOpenAutoFocus={(e) => {
          // Let react-day-picker's autoFocus place focus on the selected/today cell.
          e.preventDefault();
        }}
      >
        <WibCalendar
          mode="single"
          autoFocus
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          defaultMonth={
            selected ?? (todayAllowed ? undefined : (minDate ?? maxDate))
          }
          selected={selected}
          disabled={disabledDays}
          onSelect={(d) => pick(d ? dateToYmd(d) : null)}
          required={false}
        />
        <div className="border-line flex items-center justify-between border-t px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!todayAllowed}
            onClick={() => pick(todayYmd)}
          >
            Hari ini
          </Button>
          {clearable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={!current}
              onClick={() => pick(null)}
            >
              Kosongkan
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
