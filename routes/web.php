<?php

use App\Http\Controllers\Admin\ActiveRoleController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ProfileController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\ChangePasswordController;
use App\Http\Controllers\Auth\PasswordResetController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('welcome'))->name('home');

Route::prefix('admin')->name('admin.')->group(function () {
    Route::middleware('guest')->group(function () {
        Route::get('login', [AuthenticatedSessionController::class, 'create'])->name('login');

        // Tahap 1 alur masuk. Throttle ketat: endpoint ini menjawab
        // "email ini terdaftar atau tidak", jadi tanpa batas ia bisa dipakai
        // menyisir daftar alamat.
        // Menerima email atau nomor HP.
        Route::post('login/check', [AuthenticatedSessionController::class, 'checkLogin'])
            ->middleware('throttle:10,1')
            ->name('login.check');

        Route::post('login', [AuthenticatedSessionController::class, 'store'])
            ->middleware('throttle:6,1')
            ->name('login.store');

        Route::get('forgot-password', [PasswordResetController::class, 'create'])->name('password.request');
        Route::post('forgot-password', [PasswordResetController::class, 'store'])
            ->middleware('throttle:6,1')
            ->name('password.email');

        // Dipakai dua alur: lupa sandi, dan penerimaan undangan.
        Route::get('reset-password/{token}', [PasswordResetController::class, 'edit'])->name('password.reset');
        Route::post('reset-password', [PasswordResetController::class, 'update'])->name('password.store');
    });

    Route::middleware('auth')->group(function () {
        Route::get('/', DashboardController::class)
            ->middleware('can:view dashboard')
            ->name('dashboard');

        Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

        Route::get('ganti-sandi', [ChangePasswordController::class, 'edit'])->name('password.change');
        Route::put('ganti-sandi', [ChangePasswordController::class, 'update'])->name('password.change.update');

        // Profil sendiri — tanpa permission, siapa pun yang masuk boleh.
        Route::get('profil', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::put('profil', [ProfileController::class, 'update'])->name('profile.update');
        Route::put('peran-aktif', [ActiveRoleController::class, 'update'])->name('active-role.update');

        Route::prefix('pengguna')->name('users.')->group(function () {
            Route::get('/', [UserController::class, 'index'])
                ->middleware('can:view user')->name('index');
            Route::get('undang', [UserController::class, 'create'])
                ->middleware('can:invite user')->name('create');
            Route::post('/', [UserController::class, 'store'])
                ->middleware('can:invite user')->name('store');
            Route::post('{user}/undang-ulang', [UserController::class, 'resendInvitation'])
                ->middleware('can:invite user')->name('resend');
            Route::get('{user}/sunting', [UserController::class, 'edit'])
                ->middleware('can:update user')->name('edit');
            Route::put('{user}', [UserController::class, 'update'])
                ->middleware('can:update user')->name('update');
            Route::patch('{user}/status', [UserController::class, 'toggleActive'])
                ->middleware('can:deactivate user')->name('toggle-active');
        });
    });
});
