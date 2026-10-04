package seed

// Demo content other than articles. All texts are placeholders that the
// editorial team can edit or delete from /admin.

type demoAuthor struct {
	Slug, Name, Title, Bio string
}

var demoAuthors = []demoAuthor{
	{"ust-ahmad-fauzi", "Ust. Ahmad Fauzi", "Pengajar Kajian Akhlak",
		"Alumni angkatan 1996 yang kini mengasuh kajian akhlak mingguan bagi santri dan alumni Darul Hikmah."},
	{"ust-dedi-kurniawan", "Ust. Dedi Kurniawan", "Pengajar Fikih",
		"Pengajar fikih di Pesantren Darul Hikmah yang menekuni fikih muamalah dan fikih ibadah sehari-hari."},
	{"ustzh-nurul-hidayah", "Ustzh. Nurul Hidayah", "Pengasuh Majelis Taklim",
		"Pengasuh majelis taklim muslimah di Sumedang yang gemar mengajak jamaah menadaburi Al-Qur'an."},
	{"h-muhammad-ridwan", "H. Muhammad Ridwan", "Pengurus Yayasan",
		"Pengurus Yayasan Darul Hikmah yang membidangi pembangunan sarana dan program sosial yayasan."},
	{"siti-aminah", "Siti Aminah", "Redaksi ALMAIDAH",
		"Anggota tim redaksi ALMAIDAH yang meliput kabar alumni, prestasi santri, dan kegiatan yayasan."},
	{"fajar-nugraha", "Fajar Nugraha", "Kontributor",
		"Kontributor ALMAIDAH dari komunitas alumni yang menulis tentang karier, komunitas, dan dunia digital."},
}

type demoTag struct{ Slug, Name string }

var demoTags = []demoTag{
	{"akhlak", "Akhlak"},
	{"tahfidz", "Tahfidz"},
	{"beasiswa", "Beasiswa"},
	{"reuni", "Reuni"},
	{"fikih", "Fikih"},
}

type demoEvent struct {
	Slug, Title, Summary string
	Location, Address    string
	RegistrationURL      string
	// Start is computed in demo.go (relative to the seed time).
	Paragraphs []string
}

var demoEvents = []demoEvent{
	{
		Slug:     "kajian-subuh-bersama",
		Title:    "Kajian Subuh Bersama",
		Summary:  "Kajian ba'da Subuh terbuka untuk alumni, santri, dan masyarakat sekitar, dilanjutkan sarapan bersama.",
		Location: "Masjid Pusat Pesantren",
		Address:  "Jl. Darul Hikmah No. 1, Sumedang, Jawa Barat 45311",
		Paragraphs: []string{
			"Kajian Subuh Bersama kembali digelar di Masjid Pusat Pesantren Darul Hikmah. Kegiatan rutin ini menjadi ruang bagi alumni, santri, dan masyarakat sekitar untuk memulai hari dengan ilmu dan zikir berjamaah.",
			"Kajian kali ini mengangkat tema keutamaan menuntut ilmu dan adab seorang penuntut ilmu, disampaikan oleh para asatidz pengajar pesantren. Jamaah dipersilakan membawa mushaf dan catatan masing-masing.",
			"Acara dimulai selepas shalat Subuh berjamaah dan diakhiri dengan sarapan sederhana bersama. Tidak ada pendaftaran khusus; seluruh jamaah laki-laki dan perempuan dipersilakan hadir dengan tempat yang dipisah.",
		},
	},
	{
		Slug:     "rapat-koordinasi-alumni-wilayah",
		Title:    "Rapat Koordinasi Alumni Wilayah",
		Summary:  "Pertemuan para koordinator alumni wilayah untuk menyelaraskan program kerja dan persiapan Reuni Akbar.",
		Location: "Aula Yayasan",
		Address:  "Jl. Darul Hikmah No. 1, Sumedang, Jawa Barat 45311",
		Paragraphs: []string{
			"Ikatan Alumni Darul Hikmah mengundang seluruh koordinator wilayah untuk hadir dalam Rapat Koordinasi Alumni Wilayah di Aula Yayasan. Rapat ini menjadi forum evaluasi program sekaligus perencanaan kegiatan hingga akhir tahun.",
			"Agenda utama rapat meliputi laporan kegiatan tiap wilayah, pembaruan data alumni, penguatan program beasiswa, serta pembagian tugas kepanitiaan Reuni Akbar Alumni 2026.",
			"Koordinator yang berhalangan hadir dapat mengutus perwakilan pengurus wilayah. Notulen rapat akan dibagikan kepada seluruh pengurus melalui grup koordinasi alumni.",
		},
	},
	{
		Slug:            "reuni-akbar-alumni-2026",
		Title:           "Reuni Akbar Alumni 2026",
		Summary:         "Silaturahmi akbar lintas angkatan alumni Darul Hikmah Sumedang di Kampus Pusat. Pendaftaran telah dibuka.",
		Location:        "Kampus Pusat",
		Address:         "Jl. Darul Hikmah No. 1, Sumedang, Jawa Barat 45311",
		RegistrationURL: "https://forms.gle/placeholder",
		Paragraphs: []string{
			"Reuni Akbar Alumni 2026 mempertemukan kembali alumni Darul Hikmah Sumedang dari berbagai angkatan dan daerah. Setelah bertahun-tahun menempuh jalan masing-masing, inilah saatnya pulang ke rumah tempat kita pertama kali belajar mengeja ilmu dan adab.",
			"Rangkaian acara meliputi pembukaan dan tausiyah, sambutan pengurus yayasan, temu kangen per angkatan, bazar produk usaha alumni, penggalangan dana beasiswa santri, serta ziarah dan doa bersama untuk para guru yang telah mendahului kita.",
			"Alumni diharapkan mendaftar terlebih dahulu melalui tautan pendaftaran agar panitia dapat menyiapkan konsumsi dan tempat dengan baik. Keluarga alumni dipersilakan turut hadir.",
		},
	},
}

type demoAlumnus struct {
	Slug, Name, RoleTitle string
	ClassYear             int16
	ShortBio              string
	Story                 []string
}

var demoAlumni = []demoAlumnus{
	{
		Slug: "asep-suryana", Name: "Dr. H. Asep Suryana", RoleTitle: "Dosen & Peneliti", ClassYear: 1998,
		ShortBio: "Dosen studi Islam dan peneliti pendidikan pesantren yang aktif membina jejaring akademisi alumni.",
		Story: []string{
			"Asep Suryana masuk Darul Hikmah sebagai santri yang pemalu. Kebiasaan muthala'ah malam dan diskusi kitab bersama teman sekamar perlahan menumbuhkan kecintaannya pada ilmu, hingga ia memberanikan diri melanjutkan studi ke perguruan tinggi negeri selepas lulus pada 1998.",
			"Perjalanan akademiknya mengantarnya meraih gelar doktor di bidang pendidikan Islam. Penelitiannya banyak mengkaji tradisi belajar di pesantren dan bagaimana nilai-nilai kemandirian santri dapat menjadi modal menghadapi dunia kerja modern.",
			"Kini, di sela kesibukan mengajar, ia rutin membimbing adik-adik alumni yang ingin melanjutkan studi pascasarjana. \"Pesantren mengajarkan saya bahwa ilmu itu amanah. Ia harus kembali memberi manfaat bagi yang lain,\" tuturnya.",
		},
	},
	{
		Slug: "ratna-kusumawati", Name: "Hj. Ratna Kusumawati", RoleTitle: "Pengusaha & Filantropis", ClassYear: 2001,
		ShortBio: "Pendiri usaha busana muslim yang menyisihkan keuntungannya untuk beasiswa santri dan pemberdayaan perempuan.",
		Story: []string{
			"Ratna Kusumawati memulai usahanya dari sebuah mesin jahit di ruang tamu rumah orang tuanya, tak lama setelah lulus dari Darul Hikmah pada 2001. Berbekal ketekunan dan kejujuran yang ia pelajari di pesantren, usahanya tumbuh menjadi merek busana muslim dengan puluhan penjahit binaan.",
			"Sejak awal, ia menetapkan prinsip bahwa sebagian keuntungan adalah hak orang lain. Dari prinsip itu lahir program beasiswa bagi santri dari keluarga kurang mampu serta pelatihan menjahit bagi ibu-ibu di sekitar Sumedang.",
			"Bagi Ratna, keberhasilan bukan diukur dari besarnya usaha, melainkan dari seberapa banyak orang yang ikut tumbuh bersamanya. Ia berharap semakin banyak alumni yang berani berwirausaha sambil tetap menjaga amanah dan keberkahan.",
		},
	},
	{
		Slug: "muhammad-rizky-fadillah", Name: "Muhammad Rizky Fadillah", RoleTitle: "Software Engineer", ClassYear: 2012,
		ShortBio: "Software engineer di perusahaan teknologi yang menginisiasi kelas pemrograman gratis bagi santri.",
		Story: []string{
			"Rizky mengenal komputer pertama kali di laboratorium sederhana milik pesantren. Rasa ingin tahunya membuat ia betah berjam-jam mempelajari cara kerja program, hingga ia memutuskan menekuni ilmu komputer selepas lulus pada 2012.",
			"Kini ia bekerja sebagai software engineer di sebuah perusahaan teknologi di Jakarta. Di tengah dunia kerja yang serba cepat, ia mengaku kebiasaan disiplin waktu shalat berjamaah di pesantren justru membantunya mengatur ritme kerja dan istirahat.",
			"Bersama beberapa rekan alumni, Rizky menginisiasi kelas pemrograman daring gratis untuk santri tingkat akhir. \"Santri harus percaya diri. Kita bisa menguasai teknologi tanpa kehilangan akhlak,\" ujarnya.",
		},
	},
	{
		Slug: "nurul-hidayah", Name: "Ustzh. Nurul Hidayah", RoleTitle: "Pengasuh Majelis Taklim", ClassYear: 2005,
		ShortBio: "Pengasuh majelis taklim muslimah yang mengajak jamaah mencintai Al-Qur'an melalui kajian tadabbur.",
		Story: []string{
			"Selepas lulus dari Darul Hikmah pada 2005, Nurul Hidayah kembali ke kampung halamannya dan mulai mengajar mengaji anak-anak di serambi rumah. Dari lima murid pertama, kegiatan itu berkembang menjadi majelis taklim yang kini diikuti ratusan jamaah muslimah.",
			"Ciri khas kajiannya adalah tadabbur: mengajak jamaah merenungi makna ayat dan mengaitkannya dengan persoalan sehari-hari, dari mengasuh anak hingga menghadapi ujian hidup. Pendekatan yang lembut membuat banyak ibu yang semula canggung kini rutin hadir.",
			"Ia juga menulis kajian untuk ALMAIDAH agar ilmu yang disampaikan di majelis dapat menjangkau alumni di mana pun berada. Baginya, majelis taklim adalah cara merawat warisan para guru di pesantren.",
		},
	},
}

type demoVideo struct {
	Slug, Title, YouTubeID, Description string
	DurationSeconds                     int32
	ViewCount                           int64
	Featured                            bool
	DaysAgo                             int
}

// YouTube ids are public placeholders; the admin replaces them with the channel's own videos.
var demoVideos = []demoVideo{
	{"kajian-subuh-keutamaan-menuntut-ilmu", "Kajian Subuh: Keutamaan Menuntut Ilmu", "M7lc1UVf-VE",
		"Rekaman Kajian Subuh Bersama di Masjid Pusat Pesantren tentang keutamaan dan adab menuntut ilmu.", 1104, 3200, true, 3},
	{"dokumenter-jejak-30-tahun-darul-hikmah", "Dokumenter: Jejak 30 Tahun Darul Hikmah", "ysz5S6PUM-U",
		"Film dokumenter perjalanan Pesantren Darul Hikmah Sumedang dari sebuah surau kecil hingga hari ini.", 1450, 1800, false, 10},
	{"liputan-reuni-akbar-alumni-2025", "Liputan Reuni Akbar Alumni 2025", "aqz-KE-bpKQ",
		"Suasana haru dan hangat Reuni Akbar Alumni 2025 yang mempertemukan alumni lintas angkatan.", 725, 950, false, 30},
}

type demoSnippet struct {
	Type, Title, Body, Source, LinkURL string
	SortOrder                          int
}

var demoSnippets = []demoSnippet{
	{Type: "announcement", Body: "Pendaftaran Reuni Akbar Alumni 2026 telah dibuka", LinkURL: "/agenda/reuni-akbar-alumni-2026", SortOrder: 10},
	{Type: "announcement", Body: "Kajian Subuh Bersama setiap Ahad pekan kedua di Masjid Pusat", SortOrder: 20},
	{Type: "breaking", Body: "Reuni Akbar Alumni 2026 digelar 12 Desember di Kampus Pusat", SortOrder: 10},
	{Type: "breaking", Body: "Program beasiswa tahfidz alumni dibuka untuk 50 santri", SortOrder: 20},
	{Type: "breaking", Body: "Pendaftaran relawan bakti sosial alumni diperpanjang hingga akhir bulan", SortOrder: 30},
	{Type: "quote", Body: "Sesungguhnya bersama kesulitan ada kemudahan.", Source: "QS. Al-Insyirah: 6", SortOrder: 10},
	{Type: "quote", Body: "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya.", Source: "HR. Ahmad & Thabrani", SortOrder: 20},
	{Type: "quote", Body: "Sebaik-baik kalian adalah orang yang mempelajari Al-Qur'an dan mengajarkannya.", Source: "HR. Bukhari", SortOrder: 30},
	{Type: "faq", Title: "Bagaimana cara bergabung dengan komunitas alumni?",
		Body:      "Hubungi koordinator alumni di wilayah Anda atau kirim email ke redaksi@almaidah.id dengan menyertakan nama lengkap, angkatan, dan kota domisili. Tim kami akan menghubungkan Anda dengan pengurus wilayah terdekat.",
		SortOrder: 10},
	{Type: "faq", Title: "Apakah alumni dapat mengirimkan tulisan ke portal ini?",
		Body:      "Tentu. Alumni dapat mengirimkan artikel kajian, opini, atau kabar kegiatan ke redaksi@almaidah.id. Setiap tulisan akan disunting oleh redaksi sesuai pedoman media sebelum diterbitkan.",
		SortOrder: 20},
	{Type: "faq", Title: "Bagaimana cara mendaftar Reuni Akbar Alumni 2026?",
		Body:      "Pendaftaran dilakukan melalui tautan formulir pada halaman Agenda Reuni Akbar Alumni 2026. Setelah mengisi formulir, panitia akan mengirimkan konfirmasi dan informasi teknis acara.",
		SortOrder: 30},
}
