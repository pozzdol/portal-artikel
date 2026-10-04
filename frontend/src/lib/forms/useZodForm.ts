import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';

/**
 * react-hook-form + zod v4. Field values are typed as the schema *input*;
 * `handleSubmit` receives the parsed schema *output* (transforms applied,
 * e.g. '' → null). Validation runs on blur, then on change after the first
 * submit.
 *
 *   const form = useZodForm(schema, { defaultValues: {...} });
 *   form.handleSubmit((values) => mutate(values))
 */
export function useZodForm<S extends z.ZodType<unknown, FieldValues>>(
  schema: S,
  options: Omit<
    UseFormProps<z.input<S>, unknown, z.output<S>>,
    'resolver'
  > = {},
): UseFormReturn<z.input<S>, unknown, z.output<S>> {
  return useForm<z.input<S>, unknown, z.output<S>>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    ...options,
    // Generic S defeats the resolver's overload inference; the runtime is exact.
    resolver: zodResolver(schema) as unknown as Resolver<
      z.input<S>,
      unknown,
      z.output<S>
    >,
  });
}
