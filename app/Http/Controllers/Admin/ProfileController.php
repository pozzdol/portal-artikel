<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Profil sendiri. Sengaja tanpa permission — siapa pun yang sudah masuk boleh
 * menyunting dirinya. Peran dan status aktif tidak ada di sini; keduanya hanya
 * bisa diubah lewat modul Pengguna.
 */
class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Profile/Edit', [
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'slug' => $user->slug,
                'initials' => $user->initials,
                'pen_name' => $user->pen_name,
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
                'roles' => $user->roles->pluck('name'),
                'activeRole' => $user->activeRole()?->name,
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            // Boleh salah satu kosong, tapi tidak keduanya — itu identitas masuk.
            'email' => ['nullable', 'email', 'max:190', 'required_without:phone', Rule::unique('users')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:20', 'required_without:email'],
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
        ]);

        $user->update($data);

        return back()->with('status', 'Profil tersimpan.');
    }
}
