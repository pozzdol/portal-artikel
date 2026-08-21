<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class UserInvitation extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $token,
        private readonly string $invitedBy,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = route('admin.password.reset', [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);

        $expire = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('Undangan bergabung ke Panel ALMAIDAH')
            ->greeting("Assalamu'alaikum, {$notifiable->name}.")
            ->line("{$this->invitedBy} mengundang Anda mengelola konten di panel redaksi ALMAIDAH.")
            ->line('Tetapkan kata sandi Anda untuk mengaktifkan akun.')
            ->action('Tetapkan kata sandi', $url)
            ->line("Tautan ini berlaku {$expire} menit.")
            ->line('Kalau Anda merasa tidak seharusnya menerima undangan ini, abaikan saja — akun tidak akan aktif tanpa kata sandi.')
            ->salutation('Wassalam, Redaksi ALMAIDAH');
    }
}
