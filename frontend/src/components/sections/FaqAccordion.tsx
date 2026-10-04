'use client';

import { Accordion as AccordionPrimitive } from 'radix-ui';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/shadcn/accordion';
import { cn } from '@/lib/cn';
import type { FaqData } from '@/lib/sections/types';

type FaqAccordionProps = {
  items: FaqData['items'];
  defaultOpenIndex: number;
};

/** Single-open accordion for FAQ items; `answer_html` is sanitized inline HTML. */
export function FaqAccordion({ items, defaultOpenIndex }: FaqAccordionProps) {
  const defaultValue =
    defaultOpenIndex >= 0 && defaultOpenIndex < items.length
      ? `faq-${defaultOpenIndex}`
      : undefined;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultValue}
      className="border-line border"
    >
      {items.map((item, i) => {
        const value = `faq-${i}`;
        const buttonId = `faq-${i}-button`;
        const panelId = `faq-${i}-panel`;
        return (
          <AccordionItem key={i} value={value} className="border-line">
            <h3 className="m-0 flex">
              <AccordionPrimitive.Trigger
                id={buttonId}
                aria-controls={panelId}
                className="group/faq-trigger bg-paper text-ink flex w-full items-center justify-between gap-4 px-5 py-[18px] text-left text-[15px] font-semibold outline-none"
              >
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="text-gold group-aria-expanded/faq-trigger:hidden"
                >
                  +
                </span>
                <span
                  aria-hidden="true"
                  className="text-gold hidden group-aria-expanded/faq-trigger:inline"
                >
                  −
                </span>
              </AccordionPrimitive.Trigger>
            </h3>
            <AccordionContent
              id={panelId}
              aria-labelledby={buttonId}
              className={cn(
                'text-soft px-5 pt-0 pb-5 text-[14px] leading-[1.7]',
              )}
            >
              <div dangerouslySetInnerHTML={{ __html: item.answer_html }} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
