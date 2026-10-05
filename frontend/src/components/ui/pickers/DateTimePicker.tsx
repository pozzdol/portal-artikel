'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { combineDateTimeWib, dateOnly, splitDateTimeWib } from '@/lib/datetime';

import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';

export interface DateTimePickerProps {
  /** RFC3339 instant or `null`. Edited and emitted as WIB wall-clock time. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Hide the time input; the emitted instant is 00:00 WIB of the picked day. */
  allDay?: boolean;
  disabled?: boolean;
  /** RFC3339 lower bound; days before its WIB date are disabled. */
  min?: string;
  /** Minute step of the time suggestions. Default 15. */
  step?: number;
  /** Time used when a day is picked before any time is set. Default `'00:00'`. */
  defaultTime?: string;
  id?: string;
  name?: string;
  className?: string;
  onBlur?: () => void;
  /** Forwarded to the date input (react-hook-form `field.ref`). */
  ref?: React.Ref<HTMLInputElement>;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}

type Parts = { date: string | null; time: string | null };

function splitValue(value: string | null): Parts {
  if (!value) return { date: null, time: null };
  try {
    const { date, time } = splitDateTimeWib(value);
    if (!date || date.includes('NaN')) return { date: null, time: null };
    return { date, time };
  } catch {
    return { date: null, time: null };
  }
}

function safeDateOnly(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const d = dateOnly(value);
    return d.includes('NaN') ? undefined : d;
  } catch {
    return undefined;
  }
}

/**
 * Date + time in WIB. Emits RFC3339 (via `combineDateTimeWib`) once both parts
 * are known, `null` when the day is cleared (or the time, unless `allDay`).
 */
export function DateTimePicker({
  value,
  onChange,
  allDay = false,
  disabled,
  min,
  step = 15,
  defaultTime = '00:00',
  id,
  name,
  className,
  onBlur,
  ref,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: DateTimePickerProps) {
  const [parts, setParts] = React.useState<Parts>(() => splitValue(value));
  // Last value we emitted; outside changes (form reset, server data) resync parts.
  const [emitted, setEmitted] = React.useState<string | null>(value);
  if (value !== emitted) {
    setEmitted(value);
    setParts(splitValue(value));
  }

  function update(next: Parts) {
    const time = allDay ? '00:00' : next.time;
    setParts(next);
    const out = next.date && time ? combineDateTimeWib(next.date, time) : null;
    setEmitted(out);
    if (out !== value) onChange(out);
  }

  const timeId = id ? `${id}-time` : undefined;

  return (
    <div
      role="group"
      data-slot="date-time-picker"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      <DatePicker
        ref={ref}
        id={id}
        name={name}
        value={parts.date}
        disabled={disabled}
        min={safeDateOnly(min)}
        aria-label="Tanggal"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onBlur={onBlur}
        onChange={(date) =>
          update({
            date,
            time: date ? (parts.time ?? defaultTime) : parts.time,
          })
        }
      />
      {allDay ? null : (
        <TimePicker
          id={timeId}
          value={parts.time}
          step={step}
          disabled={disabled}
          aria-label="Jam (WIB)"
          suffix="WIB"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          onBlur={onBlur}
          onChange={(time) => update({ date: parts.date, time })}
        />
      )}
    </div>
  );
}
