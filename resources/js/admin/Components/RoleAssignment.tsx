import { CheckRow, SelectField } from '@/admin/Components/form';

interface RoleOption {
    id: string;
    name: string;
    description: string | null;
}

interface Props {
    roles: RoleOption[];
    selected: string[];
    activeRoleId: string;
    onSelectedChange: (ids: string[]) => void;
    onActiveChange: (id: string) => void;
    rolesError?: string;
    activeError?: string;
    disabled?: boolean;
}

/**
 * Satu orang boleh memegang beberapa peran, tapi hak aksesnya diambil hanya
 * dari peran aktif. Kedua kontrol sengaja berdampingan supaya perbedaan itu
 * terlihat, bukan tersembunyi di dua layar.
 */
export default function RoleAssignment({
    roles,
    selected,
    activeRoleId,
    onSelectedChange,
    onActiveChange,
    rolesError,
    activeError,
    disabled,
}: Props) {
    function toggle(id: string, checked: boolean) {
        const next = checked ? [...selected, id] : selected.filter((existing) => existing !== id);
        onSelectedChange(next);

        // Peran aktif harus selalu salah satu yang dipegang.
        if (!checked && activeRoleId === id) {
            onActiveChange(next[0] ?? '');
        }
        if (checked && next.length === 1) {
            onActiveChange(id);
        }
    }

    const held = roles.filter((role) => selected.includes(role.id));

    return (
        <div className="flex flex-col gap-4">
            <div>
                <p className="text-[0.8rem] font-medium">Peran yang dipegang</p>
                <p className="mt-0.5 text-xs text-[var(--ui-ink-2)]">
                    Boleh lebih dari satu. Yang menentukan hak akses hanya peran aktif.
                </p>

                <div className="mt-2 flex flex-col gap-0.5">
                    {roles.map((role) => (
                        <CheckRow
                            key={role.id}
                            checked={selected.includes(role.id)}
                            onChange={(checked) => toggle(role.id, checked)}
                            title={role.name}
                            description={role.description}
                            disabled={disabled}
                        />
                    ))}
                </div>

                {rolesError ? (
                    <p role="alert" className="mt-1.5 text-[0.78rem] text-[var(--ui-danger)]">
                        {rolesError}
                    </p>
                ) : null}
            </div>

            <SelectField
                label="Peran aktif"
                value={activeRoleId}
                onValueChange={onActiveChange}
                options={held.map((role) => ({ value: role.id, label: role.name }))}
                placeholder={held.length === 0 ? 'Pilih peran dulu' : 'Pilih peran aktif'}
                error={activeError}
                hint="Hak akses diambil dari peran ini saja."
                disabled={disabled || held.length === 0}
            />
        </div>
    );
}
