<?php

namespace App\Providers;

use App\Models\Category;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Tautan reset menunjuk ke route panel, bukan 'password.reset' bawaan
        // yang tidak terdaftar di aplikasi ini.
        ResetPassword::createUrlUsing(fn ($notifiable, string $token) => route('admin.password.reset', [
            'token' => $token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]));

        // Rubrik navbar & footer publik dibaca dari tabel categories, supaya
        // is_nav benar-benar menentukan apa yang tampil. once() menahan agar
        // dua komponen dalam satu request tidak memicu dua query.
        View::composer(['components.navbar', 'components.footer'], function ($view) {
            $view->with('navCategories', once(fn () => Category::forNav()->get()));
        });
    }
}
