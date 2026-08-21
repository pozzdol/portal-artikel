<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Login');
    }

    /**
     * Tahap 1: apakah kredensial ini milik akun aktif?
     * Menerima email atau nomor HP — anggota hasil impor tidak punya email.
     *
     * Endpoint ini memang membocorkan keberadaan akun; itu konsekuensi yang
     * diterima dari alur dua tahap. Throttle di route yang menahannya dipakai
     * menyisir daftar.
     */
    public function checkLogin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'login' => ['required', 'string', 'max:190'],
        ]);

        $user = User::findByLogin($validated['login']);

        return response()->json([
            'registered' => $user !== null && $user->is_active,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'login' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::findByLogin($credentials['login']);

        // Pesan sengaja sama untuk sandi salah dan akun nonaktif — tahap 1
        // sudah menjawab soal keberadaan akun, tahap 2 tidak menambah apa pun.
        if (! $user || ! $user->is_active || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => 'Kata sandi salah.',
            ]);
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        if ($user->must_change_password) {
            return redirect()->route('admin.password.change');
        }

        return redirect()->intended(route('admin.dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login');
    }
}
