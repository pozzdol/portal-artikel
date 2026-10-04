import { notFound } from 'next/navigation';

// Unknown /admin/* URLs render the admin not-found page inside the shell
// instead of the public site's 404.
export default function AdminCatchAll(): never {
  notFound();
}
