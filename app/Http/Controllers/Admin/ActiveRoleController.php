<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Mengganti peran aktif. Hak akses seketika mengikuti peran baru — itu memang
 * maksudnya. Pergantian tidak dicatat.
 */
class ActiveRoleController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'role_id' => ['required', 'uuid'],
        ]);

        $user = $request->user();

        // Hanya boleh berpindah ke peran yang memang dipegang — kalau tidak,
        // siapa pun bisa menaikkan haknya sendiri lewat satu request.
        if (! $user->roles->contains('id', $data['role_id'])) {
            throw ValidationException::withMessages([
                'role_id' => 'Peran itu tidak ditugaskan kepada Anda.',
            ]);
        }

        $user->update(['default_role_id' => $data['role_id']]);

        return back()->with('status', 'Peran aktif diganti ke '.$user->fresh()->activeRole()->name.'.');
    }
}
