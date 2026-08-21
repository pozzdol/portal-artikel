<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title inertia>{{ config('app.name', 'ALMAIDAH') }}</title>

    <!-- Early script to avoid FOUC (Flash of Unstyled Content) -->
    <script>
        if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia(
                '(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    </script>

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/admin.tsx'])
    @inertiaHead
</head>

<body class="bg-white dark:bg-[#111111] text-[#111111] dark:text-white min-h-screen font-sans antialiased">
    @inertia
</body>

</html>
