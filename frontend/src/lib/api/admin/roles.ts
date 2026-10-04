import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { qk } from './keys';
import {
  deleteData,
  getData,
  invalidate,
  postData,
  putData,
  type QueryOpts,
} from './shared';
import type {
  CreateRoleInput,
  Permission,
  Role,
  UpdateRoleInput,
} from './types';

export const rolesApi = {
  /** Plain array. */
  list: (signal?: AbortSignal) =>
    getData<Role[]>('/admin/roles', undefined, signal),
  get: (id: number, signal?: AbortSignal) =>
    getData<Role>(`/admin/roles/${id}`, undefined, signal),
  create: (input: CreateRoleInput) => postData<Role>('/admin/roles', input),
  update: (id: number, input: UpdateRoleInput) =>
    putData<Role>(`/admin/roles/${id}`, input),
  /** 409 for system roles or roles still assigned. */
  remove: (id: number) => deleteData(`/admin/roles/${id}`),
  permissions: (signal?: AbortSignal) =>
    getData<Permission[]>('/admin/permissions', undefined, signal),
};

// Permission changes affect users' role lists and possibly the caller's own
// permissions (the backend bumps perm_version → token_expired → refresh).
function invalidateRoles(qc: QueryClient) {
  return invalidate(qc, qk.roles.all, qk.users.all, qk.auth.me());
}

export function useRoles(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.roles.list(),
    queryFn: ({ signal }) => rolesApi.list(signal),
    ...opts,
  });
}

export function useRole(id: number | null | undefined, opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.roles.detail(id ?? 0),
    queryFn: ({ signal }) => rolesApi.get(id as number, signal),
    ...opts,
    enabled: !!id && (opts.enabled ?? true),
  });
}

/** Permission catalog (static). */
export function usePermissions(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.permissions.list(),
    queryFn: ({ signal }) => rolesApi.permissions(signal),
    staleTime: Infinity,
    ...opts,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => rolesApi.create(input),
    onSuccess: () => invalidateRoles(qc),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; input: UpdateRoleInput }) =>
      rolesApi.update(vars.id, vars.input),
    onSuccess: (role) => {
      qc.setQueryData(qk.roles.detail(role.id), role);
      return invalidateRoles(qc);
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rolesApi.remove(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.roles.detail(id) });
      return invalidateRoles(qc);
    },
  });
}
