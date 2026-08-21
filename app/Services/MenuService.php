<?php

namespace App\Services;

use App\Models\MenuItem;
use App\Models\User;
use Illuminate\Support\Collection;

class MenuService
{
    /**
     * Menu panel untuk seorang pengguna, sebagai pohon.
     *
     * Item induk ikut ditarik walau tidak ditugaskan langsung ke peran —
     * tanpa ini anak yang punya akses jadi yatim dan hilang dari menu.
     */
    public function forUser(?User $user): array
    {
        if (! $user) {
            return [];
        }

        $roleIds = $user->roles->pluck('id');

        if ($roleIds->isEmpty()) {
            return [];
        }

        /** @var Collection<string, MenuItem> $active */
        $active = MenuItem::where('active', true)->orderBy('order')->get()->keyBy('id');

        $assigned = MenuItem::query()
            ->where('active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('roles.id', $roleIds)
                ->where('menu_items_role.is_active', true))
            ->pluck('id');

        $visible = collect();
        foreach ($assigned as $id) {
            $cursor = $active->get($id);
            while ($cursor && ! $visible->has($cursor->id)) {
                $visible->put($cursor->id, $cursor);
                $cursor = $cursor->parent_id ? $active->get($cursor->parent_id) : null;
            }
        }

        return $this->tree($visible->sortBy('order')->values(), null);
    }

    private function tree(Collection $items, ?string $parentId): array
    {
        return $items
            ->where('parent_id', $parentId)
            ->map(fn (MenuItem $item) => [
                'id' => $item->id,
                'title' => $item->title,
                'icon' => $item->icon,
                // Route yang belum terdaftar dikirim sebagai null, bukan URL
                // yang akan melempar error saat diklik.
                'url' => $item->route_name && \Route::has($item->route_name)
                    ? route($item->route_name)
                    : $item->url,
                'routeName' => $item->route_name,
                'children' => $this->tree($items, $item->id),
            ])
            ->values()
            ->all();
    }
}
