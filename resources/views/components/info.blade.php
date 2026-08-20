<div class="w-full bg-[#111111] text-white text-[12.5px] font-medium py-2 tracking-wide">
    <div class="max-w-5xl mx-auto px-6 lg:px-10 flex items-center justify-between gap-4">
        <!-- Left: Selamat Datang -->
        <span class="text-white">
            Selamat datang di ALMAIDAH
        </span>

        <!-- Right: Tombol Login Admin -->
        <nav class="flex items-center gap-3">
            @if (Route::has('login'))
                @auth
                    <a href="{{ url('/dashboard') }}" class="text-accent-gold hover:underline text-xs font-medium">
                        Dashboard
                    </a>
                @else
                    <a href="{{ route('login') }}"
                        class="border border-accent-gold text-accent-gold px-3 py-1 rounded hover:bg-accent-gold hover:text-[#111111] transition-all text-xs font-semibold">
                        Login Admin
                    </a>
                @endauth
            @else
                <a href="#"
                    class="border border-accent-gold text-accent-gold px-3 py-1 rounded hover:bg-accent-gold hover:text-[#111111] transition-all text-xs font-semibold">
                    Login Admin
                </a>
            @endif
        </nav>
    </div>
</div>
