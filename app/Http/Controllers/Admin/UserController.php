<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Notifications\UserInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $users = User::query()
            ->with(['roles:id,name', 'defaultRole:id,name'])
            ->when($request->string('cari')->toString(), fn ($q, $term) => $q->where(
                fn ($q) => $q->where('name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%")
                    ->orWhere('pen_name', 'like', "%{$term}%")
            ))
            ->when($request->string('peran')->toString(), fn ($q, $role) => $q->whereHas(
                'roles', fn ($q) => $q->where('roles.name', $role)
            ))
            ->when($request->string('status')->toString(), fn ($q, $status) => match ($status) {
                'aktif' => $q->where('is_active', true),
                'nonaktif' => $q->where('is_active', false),
                'undangan' => $q->whereNull('email_verified_at'),
                default => $q,
            })
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $user) => $this->row($user));

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => $request->only('cari', 'peran', 'status'),
            'roles' => Role::orderBy('order')->pluck('name'),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Users/Invite', [
            'roles' => $this->roleOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate($this->rules(), $this->messages());

        $this->assertDefaultRoleIsHeld($data);

        // Sandi acak yang tidak diberitahukan ke siapa pun. Akun baru bisa
        // dimasuki setelah penerima menetapkan sandinya lewat tautan undangan.
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'password' => Str::random(64),
            'is_active' => false,
            'default_role_id' => $data['default_role_id'],
        ]);

        $user->syncRoles(Role::whereIn('id', $data['role_ids'])->get());

        $this->sendInvitation($user, $request->user());

        return redirect()
            ->route('admin.users.index')
            ->with('status', "Undangan dikirim ke {$user->email}.");
    }

    public function edit(User $user): Response
    {
        return Inertia::render('Users/Edit', [
            'user' => [
                ...$this->row($user),
                'bio' => $user->bio,
                'public_email' => $user->public_email,
                'instagram' => $user->instagram,
                'x_handle' => $user->x_handle,
                'birth_place' => $user->birth_place,
                'birth_date' => $user->birth_date?->toDateString(),
                'angkatan' => $user->angkatan,
                'tahun_masuk' => $user->tahun_masuk,
                'is_mondok' => $user->is_mondok,
                'kesibukan' => $user->kesibukan,
                'nama_instansi' => $user->nama_instansi,
                'kota_domisili' => $user->kota_domisili,
                'provinsi_domisili' => $user->provinsi_domisili,
                'asatidz_title' => $user->asatidz_title,
                'role_ids' => $user->roles->pluck('id'),
            ],
            'roles' => $this->roleOptions(),
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate($this->rules($user), $this->messages());

        $this->assertDefaultRoleIsHeld($data);
        $this->assertNotRemovingOwnAccess($request, $user, $data);

        $user->update([
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'default_role_id' => $data['default_role_id'],
            'pen_name' => $data['pen_name'] ?? null,
            'bio' => $data['bio'] ?? null,
            'public_email' => $data['public_email'] ?? null,
            'instagram' => $data['instagram'] ?? null,
            'x_handle' => $data['x_handle'] ?? null,
            'birth_place' => $data['birth_place'] ?? null,
            'birth_date' => $data['birth_date'] ?? null,
            'angkatan' => $data['angkatan'] ?? null,
            'tahun_masuk' => $data['tahun_masuk'] ?? null,
            'kesibukan' => $data['kesibukan'] ?? null,
            'nama_instansi' => $data['nama_instansi'] ?? null,
            'kota_domisili' => $data['kota_domisili'] ?? null,
            'provinsi_domisili' => $data['provinsi_domisili'] ?? null,
            'asatidz_title' => $data['asatidz_title'] ?? null,
        ]);

        $user->syncRoles(Role::whereIn('id', $data['role_ids'])->get());

        return redirect()
            ->route('admin.users.index')
            ->with('status', "Perubahan pada {$user->name} tersimpan.");
    }

    /** Tidak ada hapus — hanya nonaktif, supaya byline artikel lama tetap utuh. */
    public function toggleActive(Request $request, User $user): RedirectResponse
    {
        if ($request->user()->is($user)) {
            throw ValidationException::withMessages([
                'is_active' => 'Anda tidak bisa menonaktifkan akun sendiri.',
            ]);
        }

        $user->update(['is_active' => ! $user->is_active]);

        return back()->with(
            'status',
            $user->is_active ? "{$user->name} diaktifkan." : "{$user->name} dinonaktifkan."
        );
    }

    public function resendInvitation(Request $request, User $user): RedirectResponse
    {
        if ($user->email === null) {
            throw ValidationException::withMessages([
                'email' => 'Akun ini belum punya alamat email, jadi undangan tidak bisa dikirim.',
            ]);
        }

        if ($user->email_verified_at !== null) {
            throw ValidationException::withMessages([
                'email' => 'Akun ini sudah menetapkan kata sandinya sendiri.',
            ]);
        }

        $this->sendInvitation($user, $request->user());

        return back()->with('status', "Undangan dikirim ulang ke {$user->email}.");
    }

    private function sendInvitation(User $user, User $invitedBy): void
    {
        $token = Password::broker()->createToken($user);

        $user->notify(new UserInvitation($token, $invitedBy->byline));
    }

    /** @return array<string, mixed> */
    private function rules(?User $user = null): array
    {
        $base = [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190', 'required_without:phone', Rule::unique('users')->ignore($user?->id)],
            'phone' => ['nullable', 'string', 'max:20', 'required_without:email', Rule::unique('users')->ignore($user?->id)],
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['uuid', Rule::exists('roles', 'id')],
            'default_role_id' => ['required', 'uuid', Rule::exists('roles', 'id')],
        ];

        if ($user === null) {
            return $base;
        }

        return [...$base,
            'pen_name' => ['nullable', 'string', 'max:120'],
            'bio' => ['nullable', 'string', 'max:600'],
            'public_email' => ['nullable', 'email', 'max:190'],
            'instagram' => ['nullable', 'string', 'max:60'],
            'x_handle' => ['nullable', 'string', 'max:60'],
            'birth_place' => ['nullable', 'string', 'max:120'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'angkatan' => ['nullable', 'integer', 'min:1950', 'max:'.(date('Y') + 1)],
            'tahun_masuk' => ['nullable', 'integer', 'min:1950', 'max:'.(date('Y') + 1)],
            'kesibukan' => ['nullable', 'string', 'max:60'],
            'nama_instansi' => ['nullable', 'string', 'max:190'],
            'kota_domisili' => ['nullable', 'string', 'max:120'],
            'provinsi_domisili' => ['nullable', 'string', 'max:120'],
            'asatidz_title' => ['nullable', 'string', 'max:120'],
        ];
    }

    /** @return array<string, string> */
    private function messages(): array
    {
        return [
            'role_ids.required' => 'Pilih minimal satu peran.',
            'default_role_id.required' => 'Tentukan peran aktifnya.',
        ];
    }

    /**
     * Peran aktif menentukan seluruh hak akses, jadi ia wajib salah satu dari
     * peran yang dipegang — kalau tidak, pengguna bisa berakhir tanpa hak apa pun.
     *
     * @param  array<string, mixed>  $data
     */
    private function assertDefaultRoleIsHeld(array $data): void
    {
        if (! in_array($data['default_role_id'], $data['role_ids'], true)) {
            throw ValidationException::withMessages([
                'default_role_id' => 'Peran aktif harus salah satu peran yang dipilih.',
            ]);
        }
    }

    /** @param array<string, mixed> $data */
    private function assertNotRemovingOwnAccess(Request $request, User $user, array $data): void
    {
        if (! $request->user()->is($user)) {
            return;
        }

        $stillAdmin = Role::whereIn('id', [$data['default_role_id']])
            ->whereHas('permissions', fn ($q) => $q->where('name', 'view user'))
            ->exists();

        if (! $stillAdmin) {
            throw ValidationException::withMessages([
                'default_role_id' => 'Peran aktif itu akan mengunci Anda keluar dari halaman ini. Minta admin lain yang mengubahnya.',
            ]);
        }
    }

    /** @return array<string, mixed> */
    private function row(User $user): array
    {
        return [
            'id' => $user->id,
            'slug' => $user->slug,
            'name' => $user->name,
            'pen_name' => $user->pen_name,
            'byline' => $user->byline,
            'initials' => $user->initials,
            'email' => $user->email,
            'phone' => $user->phone,
            'isActive' => $user->is_active,
            // Undangan hanya berlaku bagi akun yang punya email. Alumni hasil
            // impor juga belum terverifikasi, tapi mereka tidak pernah diundang.
            'isInvited' => $user->email_verified_at === null && $user->email !== null,
            'mustChangePassword' => $user->must_change_password,
            'roles' => $user->roles->pluck('name'),
            'activeRole' => $user->defaultRole?->name,
        ];
    }

    /** @return \Illuminate\Support\Collection<int, array<string, mixed>> */
    private function roleOptions()
    {
        return Role::orderBy('order')->get()->map(fn (Role $role) => [
            'id' => $role->id,
            'name' => $role->name,
            'description' => $role->description,
        ]);
    }
}
