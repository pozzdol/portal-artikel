import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, notifyUnauthenticated } from '@/lib/api/client';

import { qk } from './keys';
import { invalidate, type QueryOpts } from './shared';
import type {
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
  Me,
  SessionInfo,
  UpdateMeInput,
} from './types';

// /auth/* calls never go through the token_expired refresh loop themselves
// except /auth/me and /auth/sessions, which are ordinary authenticated reads.

export const authApi = {
  me: async (signal?: AbortSignal) =>
    (await adminApi.get<Me>('/auth/me', undefined, { signal })).data,
  login: async (input: LoginInput) =>
    (
      await adminApi.post<LoginResponse>('/auth/login', input, {
        skipRefresh: true,
        silentUnauthenticated: true,
      })
    ).data.user,
  logout: async () => {
    await adminApi.post<void>('/auth/logout', undefined, {
      skipRefresh: true,
      silentUnauthenticated: true,
    });
  },
  updateMe: async (input: UpdateMeInput) =>
    (await adminApi.put<Me>('/auth/me', input)).data,
  changePassword: async (input: ChangePasswordInput) => {
    await adminApi.put<void>('/auth/me/password', input);
  },
  sessions: async (signal?: AbortSignal) =>
    (await adminApi.get<SessionInfo[]>('/auth/sessions', undefined, { signal }))
      .data,
  revokeSession: async (familyId: string) => {
    await adminApi.del(`/auth/sessions/${encodeURIComponent(familyId)}`);
  },
};

/** Current user. Seed with `initialData` from the server layout when available. */
export function useMe(opts: QueryOpts & { initialData?: Me | null } = {}) {
  const { initialData, ...rest } = opts;
  return useQuery({
    queryKey: qk.auth.me(),
    queryFn: ({ signal }) => authApi.me(signal),
    staleTime: 60_000,
    ...(initialData ? { initialData } : {}),
    ...rest,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (me) => {
      qc.removeQueries({ queryKey: qk.all });
      qc.setQueryData(qk.auth.me(), me);
    },
  });
}

/** Logs out and clears every cached admin query (cookies are cleared by Go). */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      qc.removeQueries({ queryKey: qk.all });
    },
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (me) => {
      qc.setQueryData(qk.auth.me(), me);
      return invalidate(qc, qk.users.all, qk.authors.all);
    },
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => invalidate(qc, qk.auth.sessions()),
  });
}

export function useSessions(opts: QueryOpts = {}) {
  return useQuery({
    queryKey: qk.auth.sessions(),
    queryFn: ({ signal }) => authApi.sessions(signal),
    ...opts,
  });
}

/**
 * Revokes one session family. Pass `current: true` when revoking the session
 * in use: Go clears the cookies, so the cache is dropped and
 * `admin:unauthenticated` is dispatched.
 */
export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { familyId: string; current?: boolean }) =>
      authApi.revokeSession(vars.familyId),
    onSuccess: (_data, vars) => {
      if (vars.current) {
        qc.removeQueries({ queryKey: qk.all });
        notifyUnauthenticated();
        return;
      }
      return invalidate(qc, qk.auth.sessions());
    },
  });
}
