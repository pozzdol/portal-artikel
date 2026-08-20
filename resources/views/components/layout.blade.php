<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? config('app.name', 'ALMAIDAH') }}</title>

    <!-- Early script to avoid FOUC (Flash of Unstyled Content) -->
    <script>
        if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia(
                '(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    </script>

    @if (file_exists(public_path('build/manifest.json')) || file_exists(public_path('hot')))
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    @endif
</head>

<body
    class="bg-white dark:bg-[#111111] text-[#111111] dark:text-white min-h-screen font-sans antialiased selection:bg-accent-gold selection:text-[#111111] transition-colors duration-300">

    <x-info />

    <x-navbar />

    <!-- Konten Halaman Utama -->
    <main class="w-full">
        {{ $slot }}
    </main>

    <x-footer />
</body>

</html>
