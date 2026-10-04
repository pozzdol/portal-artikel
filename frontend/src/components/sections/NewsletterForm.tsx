'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';

type NewsletterFormProps = {
  buttonLabel: string;
  placeholder: string;
};

/**
 * Newsletter signup form. Subscription is not wired to the backend yet
 * (see docs/06 §12); submitting shows an inline "coming soon" notice.
 */
export function NewsletterForm({
  buttonLabel,
  placeholder,
}: NewsletterFormProps) {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap justify-center gap-3"
    >
      <label className="sr-only" htmlFor="newsletter-email">
        Alamat email
      </label>
      <Input
        id="newsletter-email"
        name="email"
        type="email"
        required
        placeholder={placeholder}
        className="border-ink-input-line bg-ink-input text-on-ink placeholder:text-on-ink-muted focus-visible:border-gold dark:bg-ink-input h-auto max-w-[340px] min-w-[260px] flex-1 rounded-[8px] border px-[18px] py-[14px] text-[14px] shadow-none focus-visible:ring-0"
      />
      <Button
        type="submit"
        variant="gold"
        className="h-auto rounded-[8px] px-7 py-[14px] text-[14px] font-semibold shadow-none"
      >
        {buttonLabel}
      </Button>
      {submitted ? (
        <p role="status" className="text-on-ink-muted w-full text-[13px]">
          Segera hadir — fitur buletin belum aktif.
        </p>
      ) : null}
    </form>
  );
}
