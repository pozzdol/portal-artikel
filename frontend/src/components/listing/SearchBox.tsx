import { Search } from 'lucide-react';

import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';

type SearchBoxProps = {
  defaultValue?: string;
};

/** Large search input on `/cari`; a plain GET form, no client JS required. */
export function SearchBox({ defaultValue }: SearchBoxProps) {
  return (
    <form
      action="/cari"
      className="border-ink focus-within:border-gold relative mb-8 flex items-center gap-3 border-b-2 pb-3 sm:mb-11 sm:pb-4"
    >
      <Search className="text-meta size-5 shrink-0" aria-hidden="true" />
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Cari artikel, tokoh, agenda…"
        aria-label="Kata kunci pencarian"
        enterKeyHint="search"
        autoComplete="off"
        className="text-ink placeholder:text-ghost h-12 flex-1 rounded-none border-0 bg-transparent px-0 py-0 font-serif text-[22px] leading-[1.2] shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-[26px]"
      />
      <Button
        type="submit"
        variant="outline"
        className="border-ink hover:bg-ink hover:text-paper h-11 rounded-[8px] bg-transparent px-5 text-[13px] font-medium whitespace-nowrap shadow-none dark:bg-transparent"
      >
        Cari
      </Button>
    </form>
  );
}
