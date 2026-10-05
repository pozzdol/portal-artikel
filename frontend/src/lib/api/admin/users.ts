import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { qk } from './keys';
import {
  getData,
  getPaged,
  invalidate,
  keepPrevious,
  postData,
  putData,
  toQuery,
  type QueryOpts,
} from './shared';
import type {
  AuthorOption,
  CreateUserInput,
  ResetPasswordInput,
  UpdateUserInput,
  UserDetail,
  UserItem,
  UserListParams,
} from './types';

// There is no DELETE: deactivate instead (is_active=false).

export const usersApi = {
  list: (params?: UserListParams, signal?: AbortSignal) =>
    getPaged<UserItem>('/admin/users', toQuery(params), signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<UserDetail>(`/admin/users/${id}`, undefined, signal),
  create: (input: CreateUserInput) =>
    postData<UserDetail>('/admin/users', input),
  update: (id: number, input: UpdateUserInput) =>
    putData<UserDetail>(`/admin/users/${id}`, input),
  /** 204; revokes all sessions of the target. */
  resetPassword: (id: number, input: ResetPasswordInput) =>
    postData<void>(`/admin/users/${id}/reset-password`, input),
  activate: (id: number) => postData<void>(`/admin/users/${id}/activate`),
  deactivate: (id: number) => postData<void>(`/admin/users/${id}/deactivate`),
  /** Author dropdown (articles.create). Plain array. */
  authors: (signal?: AbortSignal) =>
    getData<AuthorOption[]>('/admin/authors', undefined, signal),
};

// Users embed roles (user_count on roles), authors feed the article form,
// and a self-edit may change /auth/me.
function invalidateUsers(qc: QueryClient) {
  return invalidate(
    qc,
    qk.users.all,
    qk.authors.all,
    qk.roles.all,
    qk.auth.me(),
  );
}

export function useUsers(params?: UserListParams, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.users.list(params),
    queryFn: ({ signal }) => usersApi.list(params, signal),
    ...keepPrevious,
    ...opts,
  });
}

export function useUser(id: number | null | undefined, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.users.detail(id ?? 0),
    queryFn: ({ signal }) => usersApi.get(id as number, signal),
    ...opts,
    enabled: !!id && (opts.enabled ?? true),
  });
}

export function useAuthors(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.authors.list(),
    queryFn: ({ signal }) => usersApi.authors(signal),
    staleTime: 5 * 60_000,
    ...opts,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.create(input),
    onSuccess: (u) => {
      qc.setQueryData(qk.users.detail(u.id), u);
      return invalidateUsers(qc);
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: UpdateUserInput }) =>
      usersApi.update(vars.id, vars.input),
    onSuccess: (u) => {
      qc.setQueryData(qk.users.detail(u.id), u);
      return invalidateUsers(qc);
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (vars: { id: number; input: ResetPasswordInput }) =>
      usersApi.resetPassword(vars.id, vars.input),
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.activate(id),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.deactivate(id),
    onSuccess: () => invalidateUsers(qc),
  });
}
