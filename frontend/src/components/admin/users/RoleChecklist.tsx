'use client';

import { Checkbox } from '@/components/ui/shadcn/checkbox';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/shadcn/field';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { usePermission } from '@/components/admin/shell/PermissionGate';
import { useMe } from '@/lib/api/admin/auth';
import { useRoles } from '@/lib/api/admin/roles';

/** Role multi-select for the user form. GET /admin/roles is open to
 * `roles.manage` and `users.manage`; an actor with neither sees a note instead
 * and the form omits `role_ids` (leaves roles unchanged). Only a super admin
 * may grant super_admin, so the option is hidden from everyone else. */
export function RoleChecklist({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const canList = usePermission('roles.manage', 'users.manage');
  const { data: me } = useMe();
  const { data: roles, isLoading } = useRoles({ enabled: canList });
  const actorIsSuperAdmin =
    me?.roles.some((r) => r.code === 'super_admin') ?? false;
  const choices = (roles ?? []).filter(
    (r) => actorIsSuperAdmin || r.code !== 'super_admin',
  );

  if (!canList) {
    return (
      <Field>
        <FieldLabel>Role</FieldLabel>
        <FieldDescription>
          Anda tidak memiliki izin untuk melihat daftar role. Peran pengguna ini
          tidak akan berubah.
        </FieldDescription>
      </Field>
    );
  }

  function toggle(id: number, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  }

  return (
    <Field>
      <FieldLabel>Role</FieldLabel>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-32" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {choices.map((r) => (
            <label
              key={r.id}
              className="flex items-center gap-2 text-sm font-normal"
            >
              <Checkbox
                checked={value.includes(r.id)}
                disabled={disabled}
                onCheckedChange={(c) => toggle(r.id, c === true)}
              />
              {r.name}
            </label>
          ))}
        </div>
      )}
    </Field>
  );
}
