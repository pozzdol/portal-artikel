<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menahan akun yang masih memakai sandi bawaan di halaman ganti sandi.
 * Tanpa ini, sandi tanggal lahir bisa dipakai selamanya.
 */
class RequirePasswordChange
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        $exempt = $request->routeIs('admin.password.change', 'admin.password.change.update', 'admin.logout');

        if ($user?->must_change_password && ! $exempt) {
            return $request->expectsJson()
                ? response()->json(['message' => 'Ganti kata sandi dulu.'], 403)
                : redirect()->route('admin.password.change');
        }

        return $next($request);
    }
}
