package seed

// demoArticle is one sample article. Category and Author are slugs; Tags are tag slugs.
type demoArticle struct {
	Slug, Title      string
	Category, Author string
	Tags             []string
	Featured         bool
	Breaking         bool
	DaysAgo          int // published_at = now - DaysAgo (WIB calendar day) at Hour:Minute WIB
	Hour, Minute     int
	HasEvent         bool
	EventDaysAgo     int
	EventLocation    string
	Excerpt          string
	Paragraphs       []string
}

// demoArticles is ordered as in the Fase 1 plan (index+1 = article number).
var demoArticles = []demoArticle{
	// 1 — hero
	{
		Slug: "menjaga-keikhlasan-di-tengah-derasnya-arus-informasi", Title: "Menjaga Keikhlasan di Tengah Derasnya Arus Informasi",
		Category: "akhlak", Author: "ust-ahmad-fauzi", Tags: []string{"akhlak"}, Featured: true, DaysAgo: 1, Hour: 6, Minute: 30,
		Excerpt: "Di zaman ketika setiap amal mudah dipamerkan dan setiap kabar cepat disebarkan, keikhlasan menjadi benteng yang menjaga hati tetap lurus. Bagaimana seorang muslim merawatnya?",
		Paragraphs: []string{
			"Setiap hari kita dibanjiri informasi. Linimasa media sosial tak pernah berhenti bergerak, grup percakapan terus berdenting, dan hampir setiap aktivitas kita, termasuk ibadah dan kebaikan, dapat dengan mudah diabadikan lalu dibagikan. Di tengah keadaan seperti ini, ada satu amalan hati yang sering luput dari perhatian padahal menjadi penentu diterimanya seluruh amal, yaitu keikhlasan.",
			"Rasulullah shallallahu 'alaihi wa sallam bersabda, \"Sesungguhnya setiap amal tergantung pada niatnya, dan setiap orang akan mendapatkan apa yang ia niatkan\" (HR. Bukhari dan Muslim). Allah pun menegaskan dalam Surah Al-Bayyinah ayat 5 bahwa manusia tidak diperintah kecuali untuk menyembah-Nya dengan memurnikan ketaatan kepada-Nya. Ikhlas berarti menjadikan rida Allah sebagai satu-satunya tujuan, bukan pujian, jumlah penonton, atau tanda suka.",
			"Tantangan keikhlasan hari ini tidak selalu tampak besar. Ia hadir dalam keinginan kecil untuk memperlihatkan sedekah yang baru saja ditunaikan, dalam rasa kecewa ketika unggahan kajian tidak banyak ditanggapi, atau dalam dorongan untuk selalu menjadi yang pertama menyebarkan kabar. Para ulama mengingatkan bahwa riya dapat menyusup sangat halus, bahkan lebih halus dari langkah semut hitam di atas batu hitam pada malam yang gelap.",
			"Keikhlasan juga berkaitan erat dengan cara kita memperlakukan informasi. Allah memerintahkan dalam Surah Al-Hujurat ayat 6 agar kita memeriksa kebenaran setiap berita sebelum menyebarkannya. Menahan diri dari membagikan kabar yang belum jelas, meskipun terasa penting dan mendesak, adalah bentuk kejujuran dan keikhlasan: kita berbicara karena ingin memberi manfaat, bukan karena ingin terlihat paling tahu.",
			"Lalu bagaimana merawatnya? Biasakan memperbarui niat sebelum beramal, sisihkan amalan yang sengaja kita sembunyikan sebagai rahasia antara kita dan Allah, dan jangan tergesa-gesa menilai hati orang lain. Keikhlasan tidak menuntut kita berhenti berbagi kebaikan di ruang digital, tetapi mengajak kita untuk terus bertanya dengan jujur: untuk siapa sebenarnya semua ini aku lakukan?",
		},
	},
	// 2
	{
		Slug: "adab-menuntut-ilmu", Title: "Adab Menuntut Ilmu: Bekal Sebelum Melangkah",
		Category: "fikih", Author: "ust-dedi-kurniawan", Tags: []string{"fikih"}, DaysAgo: 2, Hour: 7, Minute: 0,
		Excerpt: "Para ulama terdahulu mempelajari adab sebelum mempelajari ilmu. Inilah bekal yang perlu disiapkan setiap penuntut ilmu, dari meluruskan niat hingga memuliakan guru.",
		Paragraphs: []string{
			"Di pesantren, kita mengenal ungkapan yang sering diulang para guru: adab lebih tinggi daripada ilmu. Ungkapan ini bukan untuk merendahkan ilmu, melainkan untuk menegaskan bahwa ilmu hanya akan membawa berkah apabila dibawa oleh pribadi yang beradab. Tanpa adab, ilmu bisa berubah menjadi alat untuk menyombongkan diri dan merendahkan orang lain.",
			"Sejarah para ulama memberikan teladan yang indah. Diriwayatkan bahwa ibunda Imam Malik memakaikan sorban kepada putranya lalu berpesan agar ia belajar adab dari gurunya sebelum mempelajari ilmunya. Abdullah bin Al-Mubarak juga dikenal dengan ucapannya bahwa ia mempelajari adab dalam waktu yang lebih lama dibandingkan waktu yang ia gunakan untuk mempelajari ilmu.",
			"Adab pertama adalah meluruskan niat. Menuntut ilmu hendaknya diniatkan untuk mencari rida Allah, menghilangkan kebodohan dari diri sendiri dan orang lain, serta menghidupkan agama. Kitab Ta'lim al-Muta'allim karya Syekh Az-Zarnuji yang akrab di kalangan santri menempatkan pembahasan niat di bagian awal, karena niat yang keliru akan membelokkan seluruh perjalanan belajar.",
			"Adab berikutnya adalah memuliakan guru dan majelis ilmu: hadir tepat waktu, mendengarkan dengan saksama, tidak memotong pembicaraan, serta bertanya dengan santun. Termasuk di dalamnya menghormati kitab dan sumber ilmu. Di era digital, adab ini meluas pada cara kita mengambil ilmu dari internet, yaitu memilih guru yang jelas sanad dan kapasitas keilmuannya, bukan sekadar yang paling populer.",
			"Terakhir, seorang penuntut ilmu perlu bersabar dan mengamalkan apa yang telah dipelajari. Ilmu tidak diraih dalam semalam, dan keberkahannya tampak ketika ia menjelma menjadi amal serta akhlak. Semoga Allah menjadikan kita penuntut ilmu yang beradab, dan menjadikan ilmu kita cahaya bagi diri sendiri serta orang-orang di sekitar kita.",
		},
	},
	// 3
	{
		Slug: "tadabbur-surah-al-insyirah", Title: "Tadabbur Surah Al-Insyirah: Bersama Kesulitan Ada Kemudahan",
		Category: "tafsir", Author: "ustzh-nurul-hidayah", DaysAgo: 3, Hour: 19, Minute: 30,
		Excerpt: "Surah Al-Insyirah turun sebagai penghiburan bagi Rasulullah di masa-masa sulit dakwah. Delapan ayatnya menyimpan pelajaran tentang harapan, kesungguhan, dan tempat kembali seorang hamba.",
		Paragraphs: []string{
			"Surah Al-Insyirah, yang juga dikenal dengan nama Asy-Syarh, adalah surah Makkiyah yang terdiri dari delapan ayat. Surah ini turun pada masa ketika Rasulullah shallallahu 'alaihi wa sallam menghadapi beratnya tantangan dakwah di Makkah. Allah membukanya dengan pertanyaan yang penuh kasih: bukankah Kami telah melapangkan dadamu?",
			"Ayat-ayat awal mengingatkan nikmat Allah yang telah diberikan: kelapangan dada, diangkatnya beban yang memberatkan punggung, dan ditinggikannya sebutan nama beliau. Tadabbur atas ayat-ayat ini mengajak kita menengok ke belakang dan menghitung pertolongan Allah yang pernah datang dalam hidup kita. Sering kali kita lupa bahwa kesulitan yang dahulu terasa tak tertanggungkan ternyata telah berlalu dengan izin-Nya.",
			"Kemudian datang dua ayat yang begitu akrab di telinga kita: \"Maka sesungguhnya bersama kesulitan ada kemudahan. Sesungguhnya bersama kesulitan ada kemudahan.\" Para ahli tafsir menjelaskan bahwa kata al-'usr (kesulitan) disebut dalam bentuk definit sehingga menunjuk pada kesulitan yang sama, sedangkan yusr (kemudahan) disebut dalam bentuk indefinit sehingga menunjuk pada kemudahan yang berbeda. Karena itu masyhur ungkapan bahwa satu kesulitan tidak akan mengalahkan dua kemudahan.",
			"Perhatikan pula bahwa Allah menggunakan kata ma'a, yang berarti bersama, bukan sesudah. Kemudahan itu tidak selalu menunggu di ujung kesulitan; ia sering hadir berdampingan dengannya, berupa kesabaran yang dianugerahkan, orang-orang baik yang dihadirkan, atau pelajaran berharga yang hanya bisa dipetik di masa sulit.",
			"Surah ini ditutup dengan perintah yang sangat praktis: apabila engkau telah selesai dari suatu urusan, bersungguh-sungguhlah dalam urusan yang lain, dan hanya kepada Tuhanmulah engkau berharap. Seorang mukmin tidak berhenti pada keluh kesah. Ia terus bergerak dari satu kebaikan menuju kebaikan berikutnya, sambil menggantungkan seluruh harapannya hanya kepada Allah.",
		},
	},
	// 4
	{
		Slug: "merawat-silaturahmi-di-era-digital", Title: "Merawat Silaturahmi di Era Digital",
		Category: "akhlak", Author: "ust-ahmad-fauzi", Tags: []string{"akhlak"}, DaysAgo: 4, Hour: 8, Minute: 0,
		Excerpt: "Teknologi memudahkan kita terhubung, namun tidak otomatis mendekatkan hati. Bagaimana menjadikan gawai sebagai sarana menyambung silaturahmi, bukan sekadar pengganti kehadiran?",
		Paragraphs: []string{
			"Silaturahmi adalah salah satu ajaran yang sangat ditekankan dalam Islam. Rasulullah shallallahu 'alaihi wa sallam bersabda bahwa siapa yang ingin dilapangkan rezekinya dan dipanjangkan umurnya, hendaklah ia menyambung tali silaturahmi (HR. Bukhari dan Muslim). Menyambung hubungan dengan kerabat, guru, dan sahabat adalah ibadah yang mendatangkan keberkahan.",
			"Era digital membawa kemudahan luar biasa. Kita dapat menyapa keluarga di kota lain dalam hitungan detik, mengikuti kabar teman seangkatan, dan berkumpul dalam grup alumni tanpa harus bertatap muka. Namun kemudahan ini juga menyimpan jebakan: kita merasa sudah terhubung hanya karena tergabung dalam grup yang sama, padahal sudah bertahun-tahun tidak benar-benar saling menanyakan keadaan.",
			"Silaturahmi sejati menuntut perhatian yang tulus. Sesekali, kirimkan pesan pribadi kepada teman lama, bukan sekadar meneruskan pesan berantai. Telepon orang tua atau guru kita dan dengarkan cerita mereka dengan sabar. Ucapkan selamat atas kabar bahagia, sampaikan doa ketika ada yang tertimpa musibah, dan jangan ragu mengunjungi jika memungkinkan.",
			"Kita juga perlu menjaga adab dalam ruang digital. Grup keluarga dan alumni sebaiknya menjadi tempat yang menenangkan, bukan ajang perdebatan yang memutus hubungan. Menahan diri dari komentar yang menyakitkan, tidak menyebarkan aib, dan memaafkan kekhilafan saudara adalah bagian dari merawat silaturahmi.",
			"Pada akhirnya, teknologi hanyalah alat. Ia bisa mendekatkan yang jauh, tetapi juga bisa menjauhkan yang dekat. Mari menjadikan gawai di tangan kita sebagai jembatan kebaikan, sehingga setiap pesan yang kita kirim menjadi sebab bertambahnya kasih sayang dan keberkahan di antara kita.",
		},
	},
	// 5
	{
		Slug: "alumni-angkatan-2015-raih-beasiswa-s2-al-azhar", Title: "Alumni Angkatan 2015 Raih Beasiswa S2 ke Al-Azhar",
		Category: "prestasi", Author: "siti-aminah", Tags: []string{"beasiswa"}, DaysAgo: 2, Hour: 10, Minute: 15,
		Excerpt: "Ahmad Zaki Mubarok, alumni angkatan 2015, diterima di program magister Universitas Al-Azhar Kairo dengan beasiswa penuh. Ia berpesan agar adik-adik santri tidak takut bermimpi besar.",
		Paragraphs: []string{
			"Kabar membanggakan datang dari keluarga besar alumni Darul Hikmah Sumedang. Ahmad Zaki Mubarok, alumni angkatan 2015, dinyatakan diterima di program magister bidang Tafsir dan Ilmu Al-Qur'an di Universitas Al-Azhar, Kairo, Mesir, dengan beasiswa penuh.",
			"Zaki menyelesaikan pendidikan sarjananya di sebuah perguruan tinggi Islam di Jawa Barat sambil mengajar mengaji di lingkungan tempat tinggalnya. Ia mengaku proses seleksi yang ditempuhnya tidak mudah, mulai dari tes bahasa Arab, wawancara, hingga ujian hafalan Al-Qur'an. Ia bahkan sempat gagal pada percobaan pertama sebelum akhirnya berhasil tahun ini.",
			"\"Bekal terbesar saya justru dari pesantren: kebiasaan muraja'ah hafalan setiap selepas Subuh dan disiplin belajar kitab di malam hari. Guru-guru di Darul Hikmah mengajarkan bahwa kegagalan adalah bagian dari proses menuntut ilmu,\" ujar Zaki saat ditemui redaksi di sela persiapan keberangkatannya.",
			"Pengurus Ikatan Alumni menyampaikan apresiasi atas capaian tersebut. Menurut pengurus, keberhasilan Zaki diharapkan dapat memotivasi santri dan alumni muda lainnya untuk melanjutkan studi ke pusat-pusat keilmuan Islam dunia. Ikatan Alumni juga tengah menyiapkan program pendampingan bagi alumni yang ingin mendaftar beasiswa luar negeri.",
			"Sebelum berangkat, Zaki menitipkan pesan untuk adik-adik santri. \"Jangan takut bermimpi besar. Luruskan niat, jaga shalat dan hafalan, dan mintalah doa kepada orang tua serta guru. Insya Allah jalan akan dibukakan,\" tuturnya.",
		},
	},
	// 6
	{
		Slug: "komunitas-alumni-bandung-bakti-sosial-panti-asuhan", Title: "Komunitas Alumni Bandung Gelar Bakti Sosial di Panti Asuhan",
		Category: "komunitas", Author: "fajar-nugraha", DaysAgo: 5, Hour: 13, Minute: 0,
		Excerpt: "Puluhan alumni Darul Hikmah di Bandung Raya berbagi paket sembako, perlengkapan sekolah, dan keceriaan bersama anak-anak panti asuhan di akhir pekan lalu.",
		Paragraphs: []string{
			"Komunitas Alumni Darul Hikmah wilayah Bandung Raya menggelar bakti sosial di sebuah panti asuhan di kawasan Bandung Timur pada akhir pekan lalu. Sekitar empat puluh alumni lintas angkatan hadir bersama keluarga mereka untuk berbagi dengan puluhan anak asuh.",
			"Dalam kegiatan tersebut, alumni menyerahkan paket sembako, perlengkapan sekolah, serta sejumlah buku bacaan Islami. Seluruh bantuan berasal dari donasi alumni yang dihimpun selama sebulan terakhir melalui grup komunitas wilayah.",
			"Tidak hanya menyerahkan bantuan, para alumni juga mengisi acara dengan permainan edukatif, lomba hafalan surah pendek, dan dongeng kisah para nabi. Suasana hangat terasa ketika anak-anak dan alumni makan siang bersama di halaman panti.",
			"Koordinator Komunitas Alumni Bandung Raya menyampaikan bahwa kegiatan ini merupakan wujud syukur sekaligus upaya menghidupkan nilai-nilai yang diajarkan di pesantren. \"Dulu kita diajarkan bahwa sebaik-baik manusia adalah yang paling bermanfaat bagi sesama. Hari ini kita berusaha mempraktikkannya,\" ujarnya.",
			"Pengelola panti menyampaikan terima kasih atas kepedulian para alumni. Komunitas berencana menjadikan kegiatan ini agenda rutin setiap tiga bulan dan membuka kesempatan bagi alumni di wilayah lain untuk ikut berkontribusi.",
		},
	},
	// 7
	{
		Slug: "reuni-angkatan-2010-kembali-bersua", Title: "Reuni Angkatan 2010: Dua Belas Tahun Berpisah, Kembali Bersua",
		Category: "alumni", Author: "siti-aminah", Tags: []string{"reuni"}, DaysAgo: 6, Hour: 16, Minute: 45,
		Excerpt: "Dua belas tahun setelah kelulusan, santri angkatan 2010 kembali berkumpul di pesantren. Tawa, haru, dan doa untuk para guru mewarnai pertemuan mereka.",
		Paragraphs: []string{
			"Suasana haru menyelimuti halaman Pesantren Darul Hikmah ketika puluhan alumni angkatan 2010 kembali berkumpul. Angkatan yang mulai mondok pada 2010 dan lulus pada 2014 itu akhirnya bersua lagi setelah dua belas tahun menempuh jalan masing-masing.",
			"Para alumni datang dari berbagai kota, bahkan ada yang sengaja pulang dari luar pulau. Sebagian datang bersama pasangan dan anak-anak, memperkenalkan keluarga kecil mereka pada tempat yang dahulu menjadi rumah kedua. Kamar asrama, dapur umum, dan serambi masjid menjadi lokasi favorit untuk bernostalgia.",
			"Acara diawali dengan shalat Zuhur berjamaah dan tausiyah singkat dari salah satu guru yang dahulu menjadi wali kelas mereka. Dalam tausiyahnya, sang guru berpesan agar para alumni menjaga persaudaraan yang telah dibangun dan terus menjadi teladan di tengah masyarakat.",
			"Momen paling mengharukan terjadi saat para alumni bersama-sama mendoakan guru-guru yang telah wafat. Beberapa alumni tak kuasa menahan air mata ketika mengenang nasihat dan kesabaran para guru dalam membimbing mereka.",
			"Reuni ditutup dengan penggalangan dana untuk renovasi kamar asrama yang dulu mereka tempati. Panitia berharap silaturahmi ini tidak berhenti di satu pertemuan, tetapi berlanjut dalam bentuk kontribusi nyata bagi pesantren dan adik-adik santri.",
		},
	},
	// 8
	{
		Slug: "kisah-alumni-membangun-tahfidz-center-bekasi", Title: "Kisah Alumni Membangun Tahfidz Center di Bekasi",
		Category: "karier", Author: "fajar-nugraha", Tags: []string{"tahfidz"}, DaysAgo: 8, Hour: 9, Minute: 0,
		Excerpt: "Berawal dari mengajar tiga anak tetangga di teras rumah, Hasan Basri kini mengelola tahfidz center dengan ratusan santri di Bekasi. Ia memadukan idealisme dakwah dengan pengelolaan yang profesional.",
		Paragraphs: []string{
			"Tidak semua jalan karier harus berujung di kantor. Bagi Hasan Basri, alumni angkatan 2008, panggilan hatinya justru mengantarnya membangun sebuah tahfidz center di Bekasi yang kini membina lebih dari dua ratus santri dari berbagai usia.",
			"Semuanya bermula sekitar delapan tahun lalu, ketika Hasan yang saat itu bekerja sebagai staf administrasi di sebuah perusahaan mulai mengajar mengaji tiga anak tetangga di teras rumahnya selepas Maghrib. Kabar dari mulut ke mulut membuat jumlah murid terus bertambah hingga teras rumah tak lagi mampu menampung.",
			"Hasan kemudian memberanikan diri berhenti bekerja dan menyewa sebuah ruko kecil. Ia menyusun kurikulum hafalan bertahap, merekrut pengajar dari kalangan alumni pesantren, dan menerapkan pencatatan perkembangan hafalan yang rapi sehingga orang tua dapat memantau kemajuan anak-anak mereka.",
			"Menurut Hasan, pengalaman di Darul Hikmah sangat membekas dalam cara ia mengelola lembaganya. \"Di pesantren saya belajar disiplin, kemandirian, dan bahwa mengajar Al-Qur'an adalah amanah besar. Karena amanah, ia harus dikelola dengan sungguh-sungguh dan profesional,\" tuturnya.",
			"Kini tahfidz center yang dikelolanya telah memiliki gedung sendiri dan program beasiswa bagi anak-anak dari keluarga kurang mampu. Hasan berharap semakin banyak alumni yang berani mengambil peran di bidang pendidikan Al-Qur'an, sesuai kapasitas masing-masing.",
		},
	},
	// 9 — breaking
	{
		Slug: "pendaftaran-program-tahfidz-alumni-dibuka", Title: "Pendaftaran Program Tahfidz Alumni Dibuka Hingga Akhir Bulan",
		Category: "alumni", Author: "siti-aminah", Tags: []string{"tahfidz"}, Breaking: true, DaysAgo: 1, Hour: 9, Minute: 0,
		Excerpt: "Ikatan Alumni membuka pendaftaran program tahfidz bagi alumni dan keluarganya, dengan kelas daring dan luring yang bisa disesuaikan dengan kesibukan peserta. Pendaftaran ditutup akhir bulan ini.",
		Paragraphs: []string{
			"Ikatan Alumni Darul Hikmah Sumedang resmi membuka pendaftaran Program Tahfidz Alumni angkatan pertama. Program ini ditujukan bagi alumni beserta pasangan dan anak-anak mereka yang ingin memulai atau melanjutkan hafalan Al-Qur'an di tengah kesibukan sehari-hari.",
			"Peserta dapat memilih kelas daring melalui pertemuan virtual tiga kali sepekan, atau kelas luring yang diselenggarakan setiap akhir pekan di Masjid Pusat Pesantren. Setiap peserta akan didampingi seorang musyrif yang memantau setoran dan muraja'ah hafalan secara berkala.",
			"Target hafalan disesuaikan dengan kemampuan peserta, mulai dari Juz 30 bagi pemula hingga program khusus bagi alumni yang ingin menuntaskan 30 juz. Selain hafalan, peserta juga akan mendapatkan materi tahsin untuk memperbaiki bacaan sesuai kaidah tajwid.",
			"Pendaftaran dibuka hingga akhir bulan ini melalui koordinator alumni wilayah masing-masing atau langsung ke sekretariat Ikatan Alumni. Kuota setiap kelas dibatasi agar pendampingan dapat berjalan dengan optimal.",
			"Pengurus Ikatan Alumni berharap program ini menjadi sarana bagi alumni untuk kembali dekat dengan Al-Qur'an, sebagaimana yang dahulu mereka jalani di pesantren. \"Kesibukan bukan alasan untuk menjauh dari Al-Qur'an. Justru di tengah kesibukanlah kita paling membutuhkannya,\" ujar salah satu pengurus.",
		},
	},
	// 10
	{
		Slug: "mengenal-tauhid-fondasi-utama-seorang-muslim", Title: "Mengenal Tauhid: Fondasi Utama Seorang Muslim",
		Category: "aqidah", Author: "ust-dedi-kurniawan", DaysAgo: 7, Hour: 6, Minute: 0,
		Excerpt: "Tauhid adalah fondasi seluruh bangunan keislaman seseorang. Mengenal maknanya membantu kita memahami mengapa setiap ibadah, harapan, dan rasa takut hanya layak ditujukan kepada Allah.",
		Paragraphs: []string{
			"Tauhid adalah inti dari ajaran Islam. Kalimat la ilaha illallah yang kita ucapkan setiap hari bukan sekadar lafaz, melainkan pengakuan dan komitmen bahwa tidak ada yang berhak disembah kecuali Allah. Di atas fondasi inilah seluruh bangunan ibadah, akhlak, dan muamalah seorang muslim didirikan.",
			"Para ulama menjelaskan tauhid dalam beberapa aspek. Pertama, mengesakan Allah dalam penciptaan, pengaturan, dan pemberian rezeki. Kedua, mengesakan Allah dalam peribadatan, sehingga doa, shalat, nazar, rasa takut, dan harapan hanya ditujukan kepada-Nya. Ketiga, meyakini nama-nama dan sifat-sifat Allah sebagaimana yang Dia tetapkan bagi diri-Nya tanpa menyerupakan-Nya dengan makhluk.",
			"Surah Al-Ikhlas merangkum makna tauhid dengan sangat indah: Allah Maha Esa, Allah tempat bergantung segala sesuatu, Dia tidak beranak dan tidak diperanakkan, dan tidak ada sesuatu pun yang setara dengan-Nya. Tidak mengherankan jika Rasulullah menyebut surah ini sebanding dengan sepertiga Al-Qur'an.",
			"Tauhid bukan hanya materi hafalan di kelas aqidah. Ia memengaruhi cara kita menjalani hidup. Orang yang bertauhid tidak menggantungkan harapan kepada jabatan atau manusia, tidak mudah putus asa ketika ditimpa musibah, dan tidak sombong ketika mendapat kenikmatan, karena ia yakin semuanya berasal dari Allah dan akan kembali kepada-Nya.",
			"Allah berfirman dalam Surah Adz-Dzariyat ayat 56 bahwa Dia tidak menciptakan jin dan manusia melainkan agar mereka menyembah-Nya. Mengenal tauhid berarti mengenal tujuan hidup kita sendiri. Karena itu, mempelajari dan menjaga kemurnian tauhid adalah kewajiban sepanjang hayat, bukan hanya pelajaran di masa mondok.",
		},
	},
	// 11
	{
		Slug: "santri-darul-hikmah-juara-mtq-kabupaten", Title: "Santri Darul Hikmah Juara MTQ Tingkat Kabupaten",
		Category: "prestasi", Author: "siti-aminah", DaysAgo: 3, Hour: 14, Minute: 30,
		Excerpt: "Tiga santri Darul Hikmah meraih juara pada Musabaqah Tilawatil Qur'an tingkat Kabupaten Sumedang, masing-masing di cabang tilawah remaja, hifzh lima juz, dan syarhil Qur'an.",
		Paragraphs: []string{
			"Santri Pesantren Darul Hikmah kembali menorehkan prestasi. Pada Musabaqah Tilawatil Qur'an (MTQ) tingkat Kabupaten Sumedang yang digelar pekan lalu, kafilah Darul Hikmah berhasil membawa pulang tiga gelar juara dari berbagai cabang lomba.",
			"Gelar juara pertama cabang tilawah remaja diraih oleh Muhammad Faiz, santri kelas XI. Di cabang hifzh lima juz, Aisyah Nur Rahma berhasil meraih juara kedua, sementara tim syarhil Qur'an putri meraih juara ketiga dengan penampilan yang memukau dewan juri.",
			"Pembina tahfidz pesantren menyampaikan bahwa persiapan dilakukan sejak tiga bulan sebelum lomba. Para santri berlatih setiap hari di sela jadwal belajar reguler, dengan bimbingan khusus pada aspek tajwid, fashahah, dan irama bacaan.",
			"Pimpinan pesantren menyampaikan rasa syukur dan terima kasih kepada para pembina, orang tua, dan alumni yang turut memberikan dukungan. Menurutnya, prestasi ini merupakan buah dari kesungguhan santri dan tradisi Al-Qur'an yang terus dijaga di lingkungan pesantren.",
			"Para juara akan mewakili Kabupaten Sumedang pada MTQ tingkat Provinsi Jawa Barat. Keluarga besar alumni diharapkan turut mendoakan agar para santri dapat memberikan penampilan terbaik dan membawa nama baik pesantren di tingkat yang lebih tinggi.",
		},
	},
	// 12
	{
		Slug: "alumni-wilayah-jakarta-bentuk-kepengurusan-baru", Title: "Alumni Wilayah Jakarta Bentuk Kepengurusan Baru",
		Category: "komunitas", Author: "fajar-nugraha", DaysAgo: 9, Hour: 20, Minute: 0,
		Excerpt: "Musyawarah alumni wilayah Jakarta menetapkan kepengurusan baru untuk periode tiga tahun ke depan, dengan fokus pada pendataan alumni, jejaring karier, dan kajian rutin bulanan.",
		Paragraphs: []string{
			"Alumni Darul Hikmah yang berdomisili di Jakarta dan sekitarnya menggelar musyawarah wilayah untuk memilih kepengurusan baru. Musyawarah yang berlangsung di sebuah masjid di Jakarta Selatan itu dihadiri puluhan alumni dari berbagai angkatan.",
			"Melalui musyawarah mufakat, forum menetapkan ketua dan jajaran pengurus wilayah Jakarta untuk periode tiga tahun ke depan. Pengurus lama menyampaikan laporan pertanggungjawaban, termasuk kegiatan kajian, santunan, dan silaturahmi yang telah dilaksanakan selama periode sebelumnya.",
			"Kepengurusan baru menetapkan tiga program prioritas: pendataan ulang alumni di wilayah Jabodetabek, pembentukan jejaring karier untuk membantu alumni muda yang baru merantau, serta kajian rutin bulanan yang terbuka bagi alumni dan keluarga.",
			"Ketua terpilih menyampaikan bahwa Jakarta adalah tujuan merantau bagi banyak alumni, sehingga keberadaan komunitas yang solid sangat penting. \"Kami ingin setiap alumni yang datang ke Jakarta merasa punya keluarga di sini,\" ujarnya.",
			"Pengurus Ikatan Alumni pusat menyambut baik terbentuknya kepengurusan baru ini dan berharap wilayah Jakarta dapat menjadi motor penggerak program alumni, terutama dalam persiapan Reuni Akbar Alumni 2026.",
		},
	},
	// 13 — yayasan timeline
	{
		Slug: "peletakan-batu-pertama-asrama-putri-baru", Title: "Peletakan Batu Pertama Asrama Putri Baru",
		Category: "yayasan", Author: "h-muhammad-ridwan", DaysAgo: 10, Hour: 11, Minute: 0,
		HasEvent: true, EventDaysAgo: 10, EventLocation: "Kampus Pusat, Sumedang",
		Excerpt: "Yayasan Darul Hikmah memulai pembangunan asrama putri baru berkapasitas 120 santri. Pembangunan didukung wakaf dari alumni, wali santri, dan masyarakat.",
		Paragraphs: []string{
			"Yayasan Darul Hikmah Sumedang menggelar peletakan batu pertama pembangunan asrama putri baru di Kampus Pusat. Acara dihadiri pengurus yayasan, pimpinan pesantren, perwakilan alumni, wali santri, serta tokoh masyarakat sekitar.",
			"Asrama baru ini dirancang dua lantai dengan kapasitas sekitar 120 santri putri. Pembangunan dilakukan untuk menjawab meningkatnya jumlah pendaftar santri putri dalam beberapa tahun terakhir, sekaligus menghadirkan lingkungan tinggal yang lebih sehat dan nyaman.",
			"Dalam sambutannya, pengurus yayasan menyampaikan bahwa pembangunan ini terwujud berkat wakaf dan infak dari alumni, wali santri, dan masyarakat. \"Setiap bata yang tersusun adalah amal jariyah yang insya Allah terus mengalir pahalanya selama asrama ini digunakan untuk menuntut ilmu,\" tuturnya.",
			"Prosesi peletakan batu pertama diawali dengan doa bersama dan pembacaan tahlil. Setelah itu, pimpinan pesantren beserta perwakilan alumni dan wali santri secara bergantian meletakkan batu pertama di lokasi pembangunan.",
			"Pembangunan ditargetkan selesai dalam waktu satu tahun. Yayasan masih membuka kesempatan bagi siapa pun yang ingin berpartisipasi melalui program wakaf bangunan, dengan laporan perkembangan yang akan disampaikan secara berkala kepada para donatur.",
		},
	},
	// 14 — yayasan timeline
	{
		Slug: "santunan-anak-yatim-dan-dhuafa", Title: "Santunan Anak Yatim dan Dhuafa",
		Category: "yayasan", Author: "h-muhammad-ridwan", DaysAgo: 25, Hour: 15, Minute: 30,
		HasEvent: true, EventDaysAgo: 25, EventLocation: "Aula Yayasan",
		Excerpt: "Yayasan Darul Hikmah menyalurkan santunan kepada ratusan anak yatim dan keluarga dhuafa di sekitar pesantren, bekerja sama dengan Ikatan Alumni dan para donatur.",
		Paragraphs: []string{
			"Yayasan Darul Hikmah menggelar kegiatan santunan anak yatim dan dhuafa di Aula Yayasan. Kegiatan tahunan ini menyasar anak-anak yatim dan keluarga kurang mampu di desa-desa sekitar pesantren.",
			"Santunan yang disalurkan berupa uang tunai, paket sembako, perlengkapan sekolah, dan pakaian. Seluruh bantuan dihimpun dari infak alumni, wali santri, dan donatur yang menitipkan amanahnya melalui yayasan.",
			"Acara diawali dengan pembacaan ayat suci Al-Qur'an oleh santri, dilanjutkan tausiyah tentang keutamaan memuliakan anak yatim. Penceramah mengingatkan sabda Rasulullah bahwa orang yang menanggung anak yatim akan bersama beliau di surga seperti dekatnya jari telunjuk dan jari tengah.",
			"Pengurus yayasan menyampaikan bahwa santunan bukan sekadar pemberian materi, melainkan cara menghadirkan rasa kasih sayang dan kepedulian. Selain santunan, yayasan juga membuka program beasiswa bagi anak-anak yatim yang ingin melanjutkan pendidikan di pesantren.",
			"Wajah-wajah ceria anak-anak menjadi penutup kegiatan hari itu. Yayasan menyampaikan terima kasih kepada seluruh donatur dan berharap kebaikan ini menjadi pemberat timbangan amal bagi semua yang terlibat.",
		},
	},
	// 15 — yayasan timeline
	{
		Slug: "penyerahan-beasiswa-yayasan-50-santri", Title: "Penyerahan Beasiswa Yayasan untuk 50 Santri",
		Category: "yayasan", Author: "siti-aminah", Tags: []string{"beasiswa"}, DaysAgo: 40, Hour: 9, Minute: 30,
		HasEvent: true, EventDaysAgo: 40, EventLocation: "Masjid Pusat Pesantren",
		Excerpt: "Sebanyak 50 santri berprestasi dan dari keluarga kurang mampu menerima beasiswa pendidikan dari Yayasan Darul Hikmah untuk satu tahun ajaran penuh.",
		Paragraphs: []string{
			"Yayasan Darul Hikmah menyerahkan beasiswa pendidikan kepada 50 santri dalam sebuah acara sederhana di Masjid Pusat Pesantren. Beasiswa ini mencakup biaya pendidikan dan asrama selama satu tahun ajaran penuh.",
			"Penerima beasiswa dipilih melalui seleksi yang mempertimbangkan prestasi akademik, capaian hafalan Al-Qur'an, akhlak sehari-hari, serta kondisi ekonomi keluarga. Sebagian besar penerima berasal dari keluarga petani dan buruh di wilayah Sumedang dan sekitarnya.",
			"Dana beasiswa bersumber dari program orang tua asuh yang didukung alumni dan donatur. Pengurus yayasan menyampaikan bahwa jumlah alumni yang bergabung sebagai orang tua asuh terus bertambah setiap tahunnya.",
			"Salah satu wali santri penerima beasiswa tak kuasa menahan haru saat menyampaikan terima kasih. Ia mengaku sempat khawatir anaknya harus berhenti mondok karena kesulitan biaya setelah panen yang kurang baik.",
			"Yayasan berpesan agar para penerima beasiswa menjaga amanah dengan belajar sungguh-sungguh dan kelak turut membantu adik-adik mereka. Dengan begitu, rantai kebaikan ini akan terus bersambung dari satu generasi ke generasi berikutnya.",
		},
	},
	// 16 — opini utama
	{
		Slug: "alumni-dan-tanggung-jawab-sosial", Title: "Alumni dan Tanggung Jawab Sosial di Tengah Masyarakat",
		Category: "opini", Author: "h-muhammad-ridwan", DaysAgo: 2, Hour: 19, Minute: 0,
		Excerpt: "Gelar alumni pesantren bukan sekadar kebanggaan, melainkan amanah. Masyarakat menanti kontribusi nyata dari mereka yang pernah ditempa dengan ilmu dan adab.",
		Paragraphs: []string{
			"Setiap tahun, pesantren melepas ratusan santri untuk kembali ke masyarakat. Mereka pulang dengan membawa ilmu, hafalan, dan pengalaman hidup yang tidak dimiliki banyak orang. Namun, sering kali kita lupa bahwa semua itu bukan hanya bekal pribadi, melainkan juga amanah yang kelak dimintai pertanggungjawaban.",
			"Masyarakat memandang alumni pesantren dengan harapan tertentu. Ketika ada anak yang perlu diajari mengaji, ketika masjid membutuhkan imam, atau ketika ada persoalan yang memerlukan pertimbangan agama, alumni pesantren kerap menjadi tempat bertanya. Harapan ini adalah kehormatan sekaligus ujian bagi kita.",
			"Tanggung jawab sosial tidak selalu harus dalam bentuk besar. Mengajar mengaji anak-anak tetangga, aktif dalam kegiatan masjid, menjadi penengah dalam perselisihan, atau sekadar menjadi warga yang jujur dan dapat dipercaya adalah bentuk-bentuk kontribusi yang sangat berarti. Justru dari hal-hal kecil yang konsisten itulah kepercayaan masyarakat terbangun.",
			"Di sisi lain, alumni yang berkiprah di dunia profesional juga memikul tanggung jawab yang sama. Seorang alumni yang menjadi pengusaha dapat membuka lapangan kerja dan berbisnis dengan jujur. Alumni yang menjadi pegawai dapat menjaga integritas di tempat kerjanya. Di mana pun kita berada, nilai-nilai pesantren semestinya tercermin dalam sikap dan keputusan kita.",
			"Ikatan alumni dapat menjadi wadah untuk memperbesar dampak tersebut. Dengan bergandengan tangan, program beasiswa, santunan, dan pemberdayaan ekonomi dapat dijalankan lebih luas. Mari kita jadikan status alumni bukan sekadar kebanggaan, melainkan pengingat bahwa kita pernah dididik untuk menjadi manusia yang bermanfaat bagi sesama.",
		},
	},
	// 17
	{
		Slug: "pendidikan-karakter-dimulai-dari-rumah", Title: "Pendidikan Karakter Dimulai dari Rumah",
		Category: "opini", Author: "siti-aminah", Tags: []string{"akhlak"}, DaysAgo: 5, Hour: 20, Minute: 30,
		Excerpt: "Sekolah dan pesantren berperan besar, tetapi rumah tetaplah madrasah pertama. Keteladanan orang tua dalam hal-hal kecil membentuk karakter anak lebih kuat daripada nasihat panjang.",
		Paragraphs: []string{
			"Banyak orang tua menaruh harapan besar pada sekolah dan pesantren untuk membentuk akhlak anak-anak mereka. Harapan itu wajar, karena lembaga pendidikan memang dirancang untuk mendidik. Namun, kita perlu jujur mengakui bahwa rumah tetap menjadi madrasah pertama dan utama bagi setiap anak.",
			"Anak belajar lebih banyak dari apa yang mereka lihat daripada apa yang mereka dengar. Nasihat untuk jujur akan kehilangan maknanya jika anak menyaksikan orang tuanya berbohong dalam urusan kecil. Ajakan untuk shalat tepat waktu akan lebih mudah diterima jika anak melihat ayah dan ibunya bergegas ketika azan berkumandang.",
			"Pendidikan karakter di rumah tidak membutuhkan kurikulum yang rumit. Ia tumbuh dari kebiasaan sehari-hari: makan bersama sambil berbincang, membiasakan mengucapkan terima kasih dan meminta maaf, melibatkan anak dalam pekerjaan rumah, serta memberi ruang bagi mereka untuk bercerita tanpa takut dihakimi.",
			"Tantangan terbesar hari ini adalah gawai yang sering kali mengambil alih waktu kebersamaan keluarga. Orang tua perlu membuat kesepakatan yang adil tentang penggunaan layar, dan yang lebih penting, memberi contoh dengan meletakkan gawai ketika sedang bersama anak.",
			"Pesantren dan sekolah adalah mitra, bukan pengganti peran orang tua. Ketika rumah dan lembaga pendidikan berjalan seiring, insya Allah akan lahir generasi yang tidak hanya cerdas, tetapi juga berakhlak mulia dan kokoh menghadapi zaman.",
		},
	},
	// 18
	{
		Slug: "menjadi-muslim-produktif-di-era-digital", Title: "Menjadi Muslim Produktif di Era Digital",
		Category: "opini", Author: "fajar-nugraha", DaysAgo: 8, Hour: 12, Minute: 0,
		Excerpt: "Surah Al-'Ashr mengingatkan bahwa waktu adalah modal utama manusia. Di era notifikasi tanpa henti, menjaga fokus dan niat menjadi kunci produktivitas seorang muslim.",
		Paragraphs: []string{
			"Allah bersumpah demi waktu dalam Surah Al-'Ashr, lalu menegaskan bahwa manusia berada dalam kerugian kecuali mereka yang beriman, beramal saleh, serta saling menasihati dalam kebenaran dan kesabaran. Surah pendek ini adalah pengingat bahwa waktu adalah modal yang paling berharga, dan setiap detiknya akan dimintai pertanggungjawaban.",
			"Era digital menawarkan peluang yang luar biasa. Kita dapat belajar apa saja secara daring, bekerja dari mana saja, dan menyebarkan kebaikan ke seluruh dunia. Namun, era yang sama juga menghadirkan godaan terbesar bagi produktivitas: notifikasi tanpa henti, video pendek yang membuat lupa waktu, dan kebiasaan berpindah-pindah aplikasi tanpa tujuan.",
			"Seorang muslim sebenarnya telah dibekali pola hidup yang sangat produktif. Lima waktu shalat membagi hari kita menjadi bagian-bagian yang teratur. Kebiasaan bangun sebelum Subuh memberi kita waktu yang tenang untuk berpikir dan bekerja. Jika ritme ini dijaga, kita memiliki struktur harian yang lebih baik daripada teori manajemen waktu mana pun.",
			"Beberapa langkah sederhana dapat membantu: tentukan prioritas harian selepas Subuh, matikan notifikasi yang tidak penting saat bekerja, batasi waktu untuk media sosial, dan jadikan waktu antara dua shalat sebagai satu sesi kerja yang fokus. Yang tak kalah penting, niatkan pekerjaan sebagai ibadah agar setiap usaha bernilai di sisi Allah.",
			"Produktif bukan berarti sibuk tanpa henti. Produktif berarti menggunakan waktu untuk hal-hal yang bermanfaat bagi dunia dan akhirat, termasuk beristirahat dengan cukup dan meluangkan waktu untuk keluarga. Semoga kita termasuk orang-orang yang tidak merugi karena mampu memanfaatkan waktu dengan sebaik-baiknya.",
		},
	},
	// 19
	{
		Slug: "belajar-dari-kesederhanaan-para-kiai", Title: "Belajar dari Kesederhanaan Para Kiai",
		Category: "opini", Author: "ust-dedi-kurniawan", Tags: []string{"akhlak"}, DaysAgo: 12, Hour: 7, Minute: 30,
		Excerpt: "Para kiai yang mendidik kita hidup dengan sangat sederhana, namun pengaruhnya begitu luas. Di tengah budaya pamer, kesederhanaan mereka adalah pelajaran yang semakin relevan.",
		Paragraphs: []string{
			"Siapa pun yang pernah mondok tentu memiliki kenangan tentang kiai dan para guru yang hidup dengan sangat bersahaja. Rumah yang sederhana, pakaian yang itu-itu saja, makanan yang tidak berlebihan, namun dengan hati yang lapang dan pintu yang selalu terbuka bagi siapa pun yang datang meminta nasihat.",
			"Kesederhanaan para kiai bukan karena mereka tidak mampu, melainkan karena pilihan. Mereka memahami bahwa dunia hanyalah tempat singgah, dan bahwa kemuliaan seseorang tidak diukur dari apa yang ia miliki, melainkan dari ketakwaan dan manfaatnya bagi orang lain. Sikap ini sejalan dengan teladan Rasulullah yang hidup sederhana meskipun beliau adalah pemimpin umat.",
			"Hari ini, kita hidup di tengah budaya yang mendorong kita untuk terus memperlihatkan pencapaian. Gaya hidup menjadi tontonan, dan tanpa sadar kita mulai mengukur kebahagiaan dari perbandingan dengan orang lain. Di sinilah kesederhanaan para kiai menjadi pelajaran yang semakin relevan.",
			"Sederhana tidak berarti menolak kemajuan atau enggan meraih rezeki yang halal. Sederhana berarti menempatkan harta di tangan, bukan di hati. Kita boleh bekerja keras dan sukses, namun tetap rendah hati, tidak berlebih-lebihan, dan senantiasa ingat bahwa di dalam harta kita ada hak orang lain.",
			"Mungkin inilah warisan terbesar para guru kita: bukan hanya ilmu yang mereka ajarkan di kelas, tetapi juga cara mereka menjalani hidup. Semoga kita mampu meneladani kesederhanaan itu, dan semoga Allah merahmati para kiai dan guru yang telah mendidik kita dengan penuh keikhlasan.",
		},
	},
	// 20
	{
		Slug: "hukum-zakat-profesi-panduan-praktis", Title: "Hukum Zakat Profesi: Panduan Praktis bagi Alumni Pekerja",
		Category: "fikih", Author: "ust-dedi-kurniawan", Tags: []string{"fikih"}, DaysAgo: 15, Hour: 8, Minute: 0,
		Excerpt: "Bagaimana hukum zakat atas gaji dan penghasilan profesional? Panduan ringkas tentang dasar, nisab, kadar, dan cara menunaikan zakat profesi bagi alumni yang telah bekerja.",
		Paragraphs: []string{
			"Banyak alumni yang kini bekerja sebagai pegawai, profesional, atau pekerja lepas bertanya tentang kewajiban zakat atas penghasilan mereka. Zakat profesi, atau zakat penghasilan, adalah zakat yang dikeluarkan dari pendapatan yang diperoleh melalui pekerjaan atau keahlian, seperti gaji, honorarium, dan upah jasa.",
			"Dasar kewajibannya adalah keumuman perintah Allah dalam Surah Al-Baqarah ayat 267 untuk menginfakkan sebagian dari hasil usaha yang baik. Para ulama kontemporer berbeda pendapat tentang rincian zakat profesi. Di Indonesia, Majelis Ulama Indonesia melalui fatwa tahun 2003 menetapkan bahwa penghasilan yang mencapai nisab wajib dizakati.",
			"Dalam fatwa tersebut, nisab zakat penghasilan dianalogikan dengan nisab zakat emas, yaitu senilai 85 gram emas dalam setahun, dengan kadar zakat sebesar 2,5 persen. Zakat dapat ditunaikan setiap kali menerima penghasilan, misalnya setiap bulan, apabila jumlahnya telah mencapai nisab, atau dikumpulkan lalu dibayarkan di akhir tahun.",
			"Sebagai ilustrasi sederhana, seseorang yang penghasilannya dalam setahun telah melampaui nilai 85 gram emas dapat menyisihkan 2,5 persen dari penghasilan bulanannya sebagai zakat. Karena harga emas berubah-ubah, sebaiknya kita memeriksa ketetapan nisab terbaru yang diumumkan lembaga amil zakat resmi.",
			"Zakat sebaiknya disalurkan melalui lembaga amil zakat yang terpercaya agar sampai kepada delapan golongan penerima secara tepat. Bagi yang masih ragu mengenai perhitungan dalam kondisi tertentu, seperti penghasilan yang tidak tetap atau adanya tanggungan utang, dianjurkan untuk berkonsultasi dengan ustaz atau lembaga amil zakat. Semoga zakat kita membersihkan harta dan menyucikan jiwa.",
		},
	},
	// 21 — breaking
	{
		Slug: "ikatan-alumni-luncurkan-portal-berita-almaidah", Title: "Ikatan Alumni Luncurkan Portal Berita ALMAIDAH",
		Category: "alumni", Author: "siti-aminah", Breaking: true, DaysAgo: 20, Hour: 10, Minute: 0,
		Excerpt: "ALMAIDAH hadir sebagai portal berita resmi alumni Darul Hikmah Sumedang, menyajikan kajian, kabar alumni, kegiatan yayasan, opini, agenda, dan video dalam satu tempat.",
		Paragraphs: []string{
			"Ikatan Alumni Darul Hikmah Sumedang resmi meluncurkan ALMAIDAH, portal berita resmi komunitas alumni. Peluncuran ini menjadi tonggak baru dalam upaya menyatukan informasi dan merekatkan silaturahmi alumni yang kini tersebar di berbagai daerah, bahkan di luar negeri.",
			"ALMAIDAH menyajikan berbagai rubrik, mulai dari kajian keislaman yang diasuh para asatidz, berita alumni dan prestasi santri, kegiatan yayasan, opini, hingga agenda dan dokumentasi video. Seluruh konten dikelola oleh tim redaksi yang terdiri dari alumni lintas angkatan.",
			"Ketua Ikatan Alumni menyampaikan bahwa kehadiran portal ini dilatarbelakangi kebutuhan akan sumber informasi yang terpercaya. \"Selama ini kabar alumni banyak beredar di grup percakapan dan mudah tenggelam. Dengan ALMAIDAH, kami ingin setiap kabar baik terdokumentasi dengan rapi dan dapat diakses kapan saja,\" ujarnya.",
			"Portal ini juga membuka kesempatan bagi alumni untuk berkontribusi dengan mengirimkan tulisan, baik berupa kajian, opini, maupun liputan kegiatan di wilayah masing-masing. Setiap naskah akan disunting oleh redaksi sesuai pedoman media yang berlaku.",
			"Dengan hadirnya ALMAIDAH, Ikatan Alumni berharap silaturahmi antaralumni semakin erat dan semangat berbagi kebaikan terus tumbuh. Alumni dapat mengikuti kabar terbaru melalui situs ini serta kanal media sosial resmi ALMAIDAH.",
		},
	},
}
