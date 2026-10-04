import { sectionRegistry } from '@/lib/sections/registry';
import type { ResolvedSection, SectionType } from '@/lib/sections/types';

/**
 * Renders the homepage's active sections in order. Unknown `type`s (a
 * newer backend feature this build doesn't know about yet) are skipped with
 * a console warning; sections whose resolved `data` is empty are skipped
 * silently. `padTop`/`isFirst` are computed from the sections that actually
 * render, not from the raw list, so spacing stays correct regardless of
 * what gets skipped.
 */
export function SectionRenderer({ sections }: { sections: ResolvedSection[] }) {
  // Resolve which sections actually render (known type + non-empty data)
  // before computing spacing, so padTop/isFirst never depend on mutating a
  // variable across render iterations.
  const renderable = sections.flatMap((section) => {
    const entry = sectionRegistry[section.type as SectionType];
    if (!entry) {
      console.warn('[sections] unknown type', section.type);
      return [];
    }
    if (entry.isEmpty(section.data)) {
      return [];
    }
    return [{ section, entry }];
  });

  return (
    <>
      {renderable.map(({ section, entry }, i) => {
        const { Component } = entry;
        const previous = i > 0 ? renderable[i - 1] : undefined;
        const previousBackground =
          previous &&
          (previous.section.config.background ??
            previous.entry.defaultBackground ??
            'paper');
        const padTop = previousBackground === 'ink';
        const isFirst = i === 0;
        return (
          <Component
            key={section.id}
            id={section.id}
            config={section.config}
            data={section.data}
            padTop={padTop}
            isFirst={isFirst}
          />
        );
      })}
    </>
  );
}
