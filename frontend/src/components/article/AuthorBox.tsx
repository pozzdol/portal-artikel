import Image from 'next/image';
import Link from 'next/link';

import type { AuthorRef } from '@/lib/api/types';
import { getAuthor } from '@/lib/api/queries';

/** Author bio box at the end of the article (doc 06 §5 item 9). Fetches the full profile for `bio`. */
export async function AuthorBox({ author }: { author: AuthorRef }) {
  const profile = await getAuthor(author.slug);

  return (
    <div className="border-line bg-muted mb-12 flex flex-col gap-4 border p-5 sm:flex-row sm:gap-5 sm:p-6">
      <div className="border-line bg-paper relative h-16 w-16 flex-none overflow-hidden rounded-full border">
        {profile.avatar ? (
          <Image
            src={profile.avatar.url}
            alt={profile.avatar.alt ?? profile.display_name}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <h2 className="text-ink font-serif text-[20px] font-semibold">
          <Link href={profile.url} className="hover:underline">
            {profile.display_name}
          </Link>
        </h2>
        {profile.title ? (
          <div className="text-gold-strong mb-2 text-[12.5px] font-medium">
            {profile.title}
          </div>
        ) : null}
        {profile.bio ? (
          <p className="text-soft text-[14px] leading-[1.6]">{profile.bio}</p>
        ) : null}
      </div>
    </div>
  );
}
