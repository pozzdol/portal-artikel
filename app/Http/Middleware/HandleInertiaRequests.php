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
                    'roles' => $user->getRoleNames(),
                    // Dikirim agar UI bisa menyembunyikan aksi yang tidak
                    // diizinkan. Otorisasi sebenarnya tetap di server.
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
