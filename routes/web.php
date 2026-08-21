<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordResetController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('welcome'))->name('home');

Route::prefix('admin')->name('admin.')->group(function () {
    Route::middleware('guest')->group(function () {
        Route::get('login', [AuthenticatedSessionController::class, 'create'])->name('login');

        // Tahap 1 alur masuk. Throttle ketat: endpoint ini menjawab
        // "email ini terdaftar atau tidak", jadi tanpa batas ia bisa dipakai
        // menyisir daftar alamat.
        Route::post('login/check-email', [AuthenticatedSessionController::class, 'checkEmail'])
            ->middleware('throttle:10,1')
            ->name('login.check-email');

        Route::post('login', [AuthenticatedSessionController::class, 'store'])
            ->middleware('throttle:6,1')
            ->name('login.store');

        Route::get('forgot-password', [PasswordResetController::class, 'create'])->name('password.request');
        Route::post('forgot-password', [PasswordResetController::class, 'store'])
            ->middleware('throttle:6,1')
            ->name('password.email');

        Route::get('reset-password/{token}', [PasswordResetController::class, 'edit'])->name('password.reset');
        Route::post('reset-password', [PasswordResetController::class, 'update'])->name('password.store');
    });

    Route::middleware('auth')->group(function () {
        Route::get('/', DashboardController::class)->name('dashboard');
        Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
    });
});
