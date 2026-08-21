<?php

namespace App\Http\Middleware;

use App\Services\MenuService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'admin';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'byline' => $user->byline,
                    'email' => $user->email,
                    'initials' => $user->initials,
                    // Semua peran yang dipegang, untuk pengalih peran.
                    'roles' => $user->roles->map(fn ($role) => [
                        'id' => $role->id,
                        'name' => $role->name,
                    ])->values(),
                    'activeRole' => $user->activeRole()?->name,
                    'canSwitchRole' => $user->canSwitchRole(),
                    // Sudah dipersempit ke peran aktif oleh override di model
                    // User. Dikirim agar UI bisa menyembunyikan aksi yang tidak
                    // diizinkan; otorisasi sebenarnya tetap di server.
                    'permissions' => $user->getAllPermissions()->pluck('name'),
                ] : null,
            ],
            'menu' => fn () => app(MenuService::class)->forUser($user),
            'flash' => [
                'status' => fn () => $request->session()->get('status'),
            ],
        ];
    }
}
