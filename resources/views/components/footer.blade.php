<footer
    class="w-full border-t border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#111111] pt-16 pb-7 transition-colors duration-300">
    <div class="max-w-[1320px] mx-auto px-6 lg:px-10">
        <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 border-b border-[#E8E8E8] dark:border-[#222222] pb-11">

            <!-- Brand -->
            <div class="sm:col-span-2 lg:col-span-1">
                <div class="mb-4 flex items-center gap-[14px]">
                    <img src="{{ asset('images/logo.png') }}" alt="Logo ALMAIDAH" class="h-10 w-10 object-contain">
                    <span class="font-serif text-xl font-bold text-[#111111] dark:text-white">
                        ALMAIDAH
                    </span>
                </div>

                <p class="mb-5 max-w-xs font-sans text-sm leading-7 text-[#666666] dark:text-[#999999]">
                    Portal resmi alumni Pesantren Darul Hikmah Sumedang &mdash; menyajikan
                    kajian, berita, dan kabar alumni dengan pengalaman membaca yang
                    tenang dan terpercaya.
                </p>

                <div class="flex gap-3">
                    @foreach ([['brand-instagram', 'Instagram'], ['brand-youtube', 'YouTube'], ['brand-whatsapp', 'WhatsApp']] as [$icon, $label])
                        <a href="#" aria-label="{{ $label }}"
                            class="flex h-9 w-9 items-center justify-center rounded-full border border-[#E8E8E8] dark:border-[#333333] text-[#111111] dark:text-white hover:border-accent-gold hover:text-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold transition-colors">
                            <i class="ti ti-{{ $icon }} text-base"></i>
                        </a>
                    @endforeach
                </div>
            </div>

            <!-- Kategori -->
            <div>
                <h2
                    class="mb-5 inline-block border-b-2 border-accent-gold pb-1 font-sans text-xs font-bold uppercase tracking-widest text-[#111111] dark:text-white">
                    Kategori
                </h2>

                <nav class="flex flex-col items-start gap-2.5 font-sans text-sm font-medium">
                    @foreach (['kajian' => 'Kajian', 'berita' => 'Berita', 'tokoh' => 'Alumni', 'kegiatan' => 'Yayasan', 'opini' => 'Opini', 'agenda' => 'Agenda'] as $anchor => $label)
                        <a href="#{{ $anchor }}"
                            class="text-[#666666] dark:text-[#999999] hover:text-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold transition-colors">{{ $label }}</a>
                    @endforeach
                </nav>
            </div>

            <!-- Tentang -->
            <div>
                <h2
                    class="mb-5 inline-block border-b-2 border-accent-gold pb-1 font-sans text-xs font-bold uppercase tracking-widest text-[#111111] dark:text-white">
                    Tentang
                </h2>

                <nav class="flex flex-col items-start gap-2.5 font-sans text-sm font-medium">
                    @foreach (['Profil Yayasan', 'Redaksi', 'Pedoman Media', 'Karier'] as $label)
                        <a href="#"
                            class="text-[#666666] dark:text-[#999999] hover:text-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold transition-colors">{{ $label }}</a>
                    @endforeach
                </nav>
            </div>

            <!-- Kontak -->
            <div>
                <h2
                    class="mb-5 inline-block border-b-2 border-accent-gold pb-1 font-sans text-xs font-bold uppercase tracking-widest text-[#111111] dark:text-white">
                    Kontak
                </h2>

                <address class="not-italic font-sans text-sm leading-7 text-[#666666] dark:text-[#999999]">
                    <p class="mb-2">
                        Jl. Sukawangi, RT 018/RW 007, Desa Tanjungmekar,
                        Kecamatan Tanjungkerta, Kabupaten Sumedang,
                        Jawa Barat 45354
                    </p>

                    <a href="mailto:redaksi@almaidah.id"
                        class="block hover:text-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold transition-colors">
                        redaksi@almaidah.id
                    </a>

                    <a href="tel:+62261123456"
                        class="block hover:text-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold transition-colors">
                        (0261) 123-456
                    </a>
                </address>
            </div>
        </div>

        <!-- Bottom -->
        <div
            class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-6 font-sans text-xs text-[#999999] dark:text-[#666666]">
            <span>
                &copy; {{ now()->year }} ALMAIDAH &mdash; Alumni Darul Hikmah Sumedang. Seluruh hak cipta dilindungi.
            </span>

            <div class="flex gap-5">
                <a href="#"
                    class="hover:text-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold transition-colors">Kebijakan
                    Privasi</a>
                <a href="#"
                    class="hover:text-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold transition-colors">Syarat
                    &amp; Ketentuan</a>
            </div>
        </div>
    </div>
</footer>
