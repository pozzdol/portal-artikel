<header
    class="sticky top-0 z-50 w-full bg-white dark:bg-[#111111] border-b border-[#E8E8E8] dark:border-[#222222] transition-colors duration-300">
    <div
        class="max-w-[1320px] mx-auto px-6 lg:px-10 py-[18px] flex flex-wrap items-center justify-between gap-6 row-gap-3.5">
        <!-- Logo & Brand Name -->
        <a href="/" class="flex items-center gap-[14px] group">
            <img src="{{ asset('images/logo.png') }}" alt="Logo ALMAIDAH" class="w-[46px] h-[46px] object-contain">
            <div class="flex flex-col leading-[1.1]">
                <span class="font-serif font-bold text-[22px] tracking-[0.02em] text-[#111111] dark:text-white">
                    ALMAIDAH
                </span>
                <span
                    class="font-sans font-medium text-[10.5px] tracking-[0.08em] uppercase text-[#666666] dark:text-[#999999]">
                    Alumni Darul Hikmah Sumedang
                </span>
            </div>
        </a>

        <!-- Navigation Links -->
        <nav
            class="flex flex-wrap items-center gap-[22px] font-sans font-medium text-[14.5px] text-[#111111] dark:text-white">
            <a href="/"
                class="border-b-2 border-accent-gold pb-1 font-semibold text-[#111111] dark:text-white">Beranda</a>
            <a href="#kajian" class="hover:text-accent-gold transition-colors">Kajian</a>
            <a href="#berita" class="hover:text-accent-gold transition-colors">Berita</a>
            <a href="#tokoh" class="hover:text-accent-gold transition-colors">Alumni</a>
            <a href="#kegiatan" class="hover:text-accent-gold transition-colors">Yayasan</a>
            <a href="#opini" class="hover:text-accent-gold transition-colors">Opini</a>
            <a href="#agenda" class="hover:text-accent-gold transition-colors">Agenda</a>
            <a href="#video" class="hover:text-accent-gold transition-colors">Video</a>
        </nav>

        <!-- Right Action Controls (Tanggal, Search, Dark Mode) -->
        <div class="flex items-center flex-wrap gap-[14px]">
            <span class="font-sans font-medium text-[13px] text-[#666666] dark:text-[#999999] whitespace-nowrap">
                {{ \Carbon\Carbon::now()->locale('id')->isoFormat('D MMMM YYYY') }}
            </span>

            <button aria-label="Cari"
                class="w-[36px] h-[36px] border border-[#E8E8E8] dark:border-[#333333] rounded-lg flex items-center justify-center text-[#111111] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <i class="ti ti-search text-base"></i>
            </button>

            <button id="theme-toggle" type="button" aria-label="Mode Gelap"
                class="w-[36px] h-[36px] border border-[#E8E8E8] dark:border-[#333333] rounded-lg flex items-center justify-center text-[#111111] dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <i class="ti ti-moon text-base dark:hidden"></i>
                <i class="ti ti-sun text-base hidden dark:inline-block"></i>
            </button>
        </div>
    </div>
</header>
