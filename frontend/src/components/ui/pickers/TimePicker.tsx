'use client';

import * as React from 'react';
import { Clock3Icon } from 'lucide-react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/shadcn/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/shadcn/select';
import { cn } from '@/lib/cn';

import { buildTimeOptions, normalizeTimeText } from './helpers';

export interface TimePickerProps {
  /** `'HH:mm'` (24h, WIB wall clock) or `null`. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Minutes between suggested slots. Default 15. Typed input accepts any minute. */
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
  onBlur?: () => void;
  /** Forwarded to the text input (react-hook-form `field.ref`). */
  ref?: React.Ref<HTMLInputElement>;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
  'aria-label'?: string;
  /** Short unit text shown inside the field after the value (e.g. "WIB"). */
  suffix?: string;
}

export function TimePicker({
  value,
  onChange,
  step = 15,
  disabled,
  placeholder = 'hh:mm',
  id,
  name,
  className,
  onBlur,
  ref,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  suffix,
}: TimePickerProps) {
  const current = value ? normalizeTimeText(value) : null;
  const [text, setText] = React.useState(current ?? '');
  const [typedInvalid, setTypedInvalid] = React.useState(false);
  const [prevValue, setPrevValue] = React.useState(current);
  if (current !== prevValue) {
    setPrevValue(current);
    setText(current ?? '');
    setTypedInvalid(false);
  }

  const options = React.useMemo(() => buildTimeOptions(step), [step]);
  // Radix Select needs a value that exists in the list; off-step times show none selected.
  const selectValue = current && options.includes(current) ? current : '';

  function commitText() {
    const trimmed = text.trim();
    if (trimmed === '') {
      setTypedInvalid(false);
      if (current !== null) onChange(null);
      return;
    }
    const parsed = normalizeTimeText(trimmed);
    if (parsed) {
      setTypedInvalid(false);
      setText(parsed);
      if (parsed !== current) onChange(parsed);
    } else {
      setTypedInvalid(true);
    }
  }

  const invalid =
    typedInvalid || ariaInvalid === true || ariaInvalid === 'true';

  return (
    <InputGroup
      data-disabled={disabled ? 'true' : undefined}
      className={cn(
        'bg-background h-11 w-full md:h-9',
        suffix ? 'sm:w-36' : 'sm:w-32',
        className,
      )}
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
        maxLength={5}
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
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        {suffix ? (
          <span className="text-muted-foreground text-xs font-normal">
            {suffix}
          </span>
        ) : null}
        <Select
          value={selectValue}
          disabled={disabled}
          onValueChange={(v) => {
            setTypedInvalid(false);
            setText(v);
            if (v !== current) onChange(v);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label={
              current ? `Pilih jam, terpilih ${current}` : 'Pilih jam'
            }
            className="text-foreground/70 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground size-9 justify-center border-0 bg-transparent p-0 shadow-none data-[size=sm]:h-9 md:size-6 md:data-[size=sm]:h-6 dark:bg-transparent [&>svg:last-child]:hidden"
          >
            <Clock3Icon />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="end"
            sideOffset={8}
            className="max-h-64 min-w-28 tabular-nums"
          >
            {options.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InputGroupAddon>
    </InputGroup>
  );
}
