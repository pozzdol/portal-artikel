import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// List filters/sort/page kept in the URL (shareable, back-button friendly).
// The *type* of each param is taken from its default: number → Number(),
// boolean → 'true'/'false', string → as is. A default of `undefined` means
// "optional string". Values equal to their default are omitted from the URL.
// Wrap the component using this hook in <Suspense> (Next prerender rule).

export type ListParamValue = string | number | boolean | undefined;
export type ListParamDefaults = Record<string, ListParamValue>;

type Widen<V> = V extends number
  ? number
  : V extends boolean
    ? boolean
    : V extends string
      ? string
      : string | undefined;
export type ListParams<D extends ListParamDefaults> = {
  [K in keyof D]: Widen<D[K]>;
};

type Reader = { get(name: string): string | null };

export function parseListParams<D extends ListParamDefaults>(
  defaults: D,
  sp: Reader,
): ListParams<D> {
  const out: Record<string, ListParamValue> = {};
  for (const [key, def] of Object.entries(defaults)) {
    const raw = sp.get(key);
    if (raw === null || raw === '') {
      out[key] = def;
      continue;
    }
    if (typeof def === 'number') {
      const n = Number(raw);
      out[key] = Number.isFinite(n) ? n : def;
    } else if (typeof def === 'boolean') {
      out[key] = raw === 'true' ? true : raw === 'false' ? false : def;
    } else {
      out[key] = raw;
    }
  }
  return out as ListParams<D>;
}

/** Query string (without '?') for `values`, skipping defaults/empties; foreign keys in `base` are kept. */
export function serializeListParams<D extends ListParamDefaults>(
  defaults: D,
  values: Partial<ListParams<D>>,
  base?: URLSearchParams,
): string {
  const sp = new URLSearchParams(base ? base.toString() : '');
  for (const key of Object.keys(defaults)) {
    const v = (values as Record<string, ListParamValue>)[key];
    if (
      v === undefined ||
      v === '' ||
      v === defaults[key] ||
      (typeof v === 'number' && !Number.isFinite(v))
    ) {
      sp.delete(key);
    } else {
      sp.set(key, String(v));
    }
  }
  return sp.toString();
}

export type SetListParamsOptions = {
  /** Reset `page` to its default when any other key changes (default true). */
  resetPage?: boolean;
  /** Use router.push instead of replace (adds a history entry). */
  push?: boolean;
};

export function useListParams<D extends ListParamDefaults>(defaults: D) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Callers usually pass an inline object literal; key on its content.
  const defaultsKey = JSON.stringify(defaults);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableDefaults = useMemo(() => defaults, [defaultsKey]);
  const spKey = searchParams.toString();

  const params = useMemo(
    () => parseListParams(stableDefaults, new URLSearchParams(spKey)),
    [stableDefaults, spKey],
  );

  const navigate = useCallback(
    (qs: string, push?: boolean) => {
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (push) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router],
  );

  const set = useCallback(
    (patch: Partial<ListParams<D>>, opts: SetListParamsOptions = {}) => {
      const next = { ...params, ...patch } as Record<string, ListParamValue>;
      const resetPage = opts.resetPage ?? true;
      if (resetPage && 'page' in stableDefaults && !('page' in patch)) {
        const changed = Object.keys(patch).some(
          (k) =>
            (patch as Record<string, ListParamValue>)[k] !==
            (params as Record<string, ListParamValue>)[k],
        );
        if (changed) next.page = stableDefaults.page;
      }
      navigate(
        serializeListParams(
          stableDefaults,
          next as Partial<ListParams<D>>,
          new URLSearchParams(spKey),
        ),
        opts.push,
      );
    },
    [params, stableDefaults, spKey, navigate],
  );

  const reset = useCallback(() => {
    navigate(
      serializeListParams(stableDefaults, {}, new URLSearchParams(spKey)),
    );
  }, [stableDefaults, spKey, navigate]);

  return { params, set, reset };
}
