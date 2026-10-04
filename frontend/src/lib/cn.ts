import { createCn } from 'cn/config';

/**
 * Join class names (clsx semantics) and resolve Tailwind conflicts
 * (tailwind-merge semantics). Extended with our custom `--text-*` font-size
 * scale from globals.css so e.g. `text-caption text-meta` keeps both classes
 * (otherwise the merger treats `text-caption` as a color and drops it).
 * A font-size class no longer removes an earlier `leading-*` class: our
 * components write `leading-[x] text-[y]` and expect both to apply.
 */
export const cn = createCn({
  override: {
    conflictingClassGroups: {
      'font-size': [],
    },
  },
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'h2',
            'h2-sm',
            'h3',
            'h3-sm',
            'quote',
            'brand',
            'lead',
            'copy',
            'copy-sm',
            'nav',
            'caption',
            'caption-sm',
            'caption-xs',
            'eyebrow',
            'eyebrow-sm',
            'eyebrow-xs',
          ],
        },
      ],
    },
  },
});
