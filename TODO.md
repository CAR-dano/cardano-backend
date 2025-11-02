# Rencana Fitur Baru

## Fitur: Endpoint Pendaftaran & Tracking Inspeksi oleh Customer/Admin

Masih kurang perencanaan untuk pembayaran untuk mendaftarkan kendaraan untuk inspeksi berdasarkan kelas mobil (LCGC, regular, extra, luxury, eropa/amerika small, eropa/amerika medium, eropa/amerika high end. hybrid, dan EV/listrik).

1. **Analisis kebutuhan** – Review struktur `Inspection` dan modul terkait (inspections, customer) untuk memahami data dan lifecycle yang sudah ada. Catat service/helper yang dapat dipakai ulang dan area yang perlu isolasi baru.
2. **Desain status enum** – Tambahkan enum Prisma `CustomerInspectionStatus` dengan nilai: NOT_STARTED, IN_PROGRESS, ON_HOLD, AWAITING_APPROVAL, DONE. Sertakan komentar penjelasan di schema.
3. **Skema data** – Buat model Prisma `CustomerInspectionRequest` (id, customerId, vehicleId?, adminAssigneeId?, preferredSchedule, notes, status, createdAt, updatedAt). Pertimbangkan table foto lampiran `CustomerInspectionRequestPhoto` bila dibutuhkan (mengikuti pola vehicle photo). Relasikan ke `CustomerVehicle` dan `User`.
4. **Migrasi & Prisma Client** – Jalankan `npx prisma migrate dev --name add-customer-inspection-request` setelah schema diperbarui, lalu `npx prisma generate`. Pastikan migrasi sebelumnya (blockchain) tetap sinkron.
5. **DTO & Validasi** – Definisikan DTO create/update (customer) dan admin update/status (class-validator + Swagger). Validasi enum status, tanggal preferensi, catatan optional.
6. **Service layer** – Implement `CustomerInspectionRequestsService` mencakup: create oleh customer (link ke kendaraan), list/detail milik customer, create/list/detail untuk admin, update status dengan rule transition, serta assignment admin. Gunakan transaksi untuk penulisan dan audit log.
7. **Controller & Routing** – Tambahkan controller customer (`/me/inspection-requests`) dan admin (`/admin/customer-inspections`). Terapkan `JwtAuthGuard`, `RolesGuard` (CUSTOMER vs ADMIN/SUPERADMIN), throttling seperlunya, serta swagger summary/responses.
8. **Komentar & dokumentasi** – Beri komentar ringkas pada service/controller baru; tambahkan dokumentasi swagger (deskripsi, contoh payload, status enumeration, penjelasan response).
9. **Workflow status & audit** – Terapkan helper transition status (validasi urutan, catat actor) dan integrasikan `AuditLoggerService` untuk CREATE/UPDATE/STATUS_CHANGE.
10. **Unit tests** – Tuliskan spec untuk service (create customer, create admin, status transition valid/invalid, ownership) dan controller (mock service, guard) termasuk edge case validasi DTO.
11. **Manual QA checklist** – Susun skenario manual: customer membuat request, admin menginput/assign status, update status via UI, filter list per status.
12. **Commit message** – Setelah implementasi & test beres, gunakan `feat(customer): add inspection request workflow`.

## Fitur: Endpoint Riwayat Inspeksi Kendaraan Milik Customer

1. **Analisis awal** – Review model `Inspection`, layanan `ReportsService`, `CustomerVehiclesService` untuk memastikan bagaimana inspeksi terkait ke pemilik (cek field `ownerId` atau relasi kendaraan). Catat data yang akan ditampilkan (status, jadwal, PDF).
2. **Strategi akses data** – Tentukan query utama: join `Inspection` ke `CustomerVehicle`/`ownerId` atau gunakan `CreditConsumption` (jika inspeksi hanya terlihat setelah pembelian). Siapkan fallback untuk inspeksi milik user namun belum dibeli.
3. **DTO penyajian** – Definisikan DTO list (`CustomerInspectionHistoryItemDto`) berisi id, prettyId, info kendaraan, status, tanggal, flag ketersediaan PDF/no-docs; dan detail (`CustomerInspectionDetailDto`) yang memperluas `ReportDetailResponseDto` dengan metadata kendaraan.
4. **Service layer** – Implement `CustomerInspectionHistoryService` untuk list/detail dan streaming no-docs. Reuse `ReportsService.getDetail`/`streamNoDocsPdf`, namun tambahkan pengecekan kepemilikan sebelum pemanggilan. Sertakan pagination, filter status, dan audit log.
5. **Controller** – Tambahkan endpoint `/me/inspections` (GET list), `/me/inspections/:inspectionId` (detail), `/me/inspections/:inspectionId/no-docs` (download). Terapkan `JwtAuthGuard`, `RolesGuard` (Role.CUSTOMER), ThrottlerGuard; dokumentasikan via Swagger.
6. **Audit & logging** – Integrasikan `AuditLoggerService` untuk setiap tindakan (VIEW_LIST, VIEW_DETAIL, DOWNLOAD). Pastikan error unauthorized/404 ditangani dengan aman.
7. **Swagger & dokumentasi** – Lengkapi summary/description, contoh payload respons, dan penjelasan field PDF/no-docs agar frontend dapat mengonsumsi dengan mudah.
8. **Unit tests** – Tulis spec service (list ownership, detail, download flow) dan controller (mock service & guard). Sertakan edge case akses inspeksi milik user lain (harus 404/403).
9. **Manual QA checklist** – Susun skenario manual: melihat list, memfilter status, membuka detail, mengunduh PDF, menguji akses inspeksi bukan milik sendiri.
10. **Commit message** – Setelah implementasi dan test selesai, gunakan `feat(customer): expose inspection history endpoints`.

## Rencana Perbaikan Proses PDF

1. **Audit & reproduksi** – Buka `pdfarchived/SOL-23062025-003-no-confidential-1756125640549.pdf`, catat konten yang hilang, lalu jalankan ulang alur `approveInspection` untuk memastikan masalah konsisten.
2. **Observability** – Di `src/inspections/inspections.service.ts:2088` tambahkan hook `page.on('requestfailed')` dan `page.on('response')` guna melog URL aset, status, referer, ukuran, dan latensi sehingga akar masalah (timeout, 403, DNS, dsb.) terlihat di log.
3. **Kontrol navigasi** – Revisi `page.goto` (`src/inspections/inspections.service.ts:2207`) agar menggunakan `waitUntil: ['load', 'networkidle0']` dengan fallback eksplisit, tambahkan retry terbatas, dan jalankan `page.waitForFunction(() => document.readyState === 'complete')` untuk memastikan DOM final tercapai.
4. **Tangani lazy loading** – Sebelum menunggu gambar (`src/inspections/inspections.service.ts:2234`) lakukan `page.evaluate` untuk menghapus atribut `loading="lazy"`/`data-src`, scroll seluruh halaman, dan trigger `IntersectionObserver` agar semua `img` melakukan fetch.
5. **Validasi gambar** – Setelah fase tunggu, evaluasi `naturalWidth === 0` atau `complete === false`; bila ada, lakukan fetch ulang (misal `img.src = img.src` atau `fetch` + `createObjectURL`) serta log daftar URL bermasalah untuk analisis lanjutan.
6. **Kredensial aset** – Investigasi apakah foto/logo berasal dari origin yang memerlukan header auth; jika ya, sediakan proxy backend yang menyisipkan token atau gunakan `page.setCookie`/`page.authenticate` supaya request gambar membawa kredensial.
7. **Optimalisasi intersepsi** – Tinjau filter `page.on('request')` (`src/inspections/inspections.service.ts:2176`) agar tidak memblok CDN statis; gunakan whitelist berbasis hostname, bukan filter substring longgar seperti "ads".
8. **Refactor maintainability** – Pecah `generatePdfFromUrl` menjadi helper `setupBrowserContext`, `loadInspectionPage`, `ensureAssetsLoaded`, `renderPdf` untuk menurunkan kompleksitas dan memudahkan pengujian.
9. **Quality gate** – Tambahkan pemeriksaan pasca-render yang menghitung jumlah gambar/kanvas sukses, sertakan checksum HTML ke metadata PDF, dan lakukan retry dengan penurunan kompresi bila render pertama gagal.
10. **QA & monitoring** – Buat skrip e2e/headless untuk sampel inspeksi yang memverifikasi hash PDF; tambahkan alert logger saat request gagal serta dokumentasikan kebutuhan env (`PDF_COMPRESSION_LEVEL`, path Chromium).
11. **Langkah berikutnya**

- Realisasikan observability (langkah 2 & 5) untuk mengumpulkan bukti penyebab gambar hilang.
- Implementasikan penanganan lazy-load dan kredensial (langkah 4–6).
- Jalankan ulang approval dan validasi PDF baru sebelum refactor lanjutan.

## Rencana Optimasi Kompresi PDF

1. **Audit pipeline saat ini** – Review `generatePdfFromUrl` dan penggunaan env `PDF_COMPRESSION_LEVEL` untuk memahami bagaimana skala dan opsi kompresi diterapkan ke `page.pdf`. Catat titik di mana ukuran buffer dihitung/logging.
2. **Instrumentasi ukuran** – Tambahkan helper yang menghitung size buffer dalam MB dan melog ukuran sebelum/selesai kompresi, termasuk flag apakah re-render dilakukan. Persist informasi ini ke audit log untuk tracing historis.
3. **Threshold dinamis** – Implementasikan fungsi `getCompressionStrategy(sizeInMB)` yang mengembalikan strategi: `skip` bila <50MB, `recompress` bila 50–120MB, `aggressive` bila >120MB. Sediakan konfigurasi env untuk batas minimum/maximum agar mudah diubah.
4. **Loop re-render** – Setelah render awal, jika size > threshold, lakukan re-render bertahap dengan parameter berbeda (misal skala 0.95 → 0.85 → 0.75, atur `preferCSSPageSize`, aktifkan `omitBackground` opsional) sampai ukuran berada di rentang 50–100MB atau limit percobaan tercapai.
5. **Optimisasi gambar** – Untuk percobaan ulang, terapkan pengurangan resolusi gambar via evaluasi di browser (resize canvas, atur `maxWidth`, convert ke JPEG dengan kualitas lebih rendah) khusus pada elemen gambar besar yang teridentifikasi di audit. Pastikan tidak memodifikasi logo kecil/ikon penting.
6. **Fallback kompresor eksternal** – Jika setelah re-render ukuran tetap >100MB, jalankan tahap pasca-proses menggunakan Ghostscript (CLI) atau library setara (misal `ghostscript4js`) dengan preset `ebook`/`printer` dan monitoring hasil; pastikan binary tersedia di deployment dan tangani error gracefully.
7. **Validasi kualitas** – Bandingkan jumlah halaman, hash teks, dan jumlah gambar sebelum/sesudah kompresi untuk memastikan tidak ada konten hilang. Simpan metrik per eksperimen agar mudah dievaluasi.
8. **Pengendalian konfigurasi** – Tambahkan setting baru (`PDF_MAX_SIZE_MB`, `PDF_TARGET_RANGE_MB`) di `.env` serta dokumentasi internal; buat default aman (50 & 100). Pastikan queue/parallelism tidak memperburuk waktu render saat re-render terjadi.
9. **Testing** – Buat unit test untuk fungsi strategi kompresi, serta integration test yang mensimulasikan PDF >50MB (mock buffer) guna memverifikasi siklus re-render. Sertakan QA manual: render inspeksi besar, cek ukuran akhir, dan periksa kualitas visual.
10. **Langkah berikutnya**

- Tambahkan instrumentasi ukuran (langkah 2) untuk mendapatkan data real tentang distribusi size PDF sekarang.
- Implementasikan loop re-render dinamis (langkah 4) dengan konfigurasi threshold baru.
- Uji fallback eksternal dengan sampel PDF >120MB sebelum mengaktifkannya di produksi.

## Rencana Optimasi Queue Approve Inspections

1. **Mapping alur kerja** – Gambar sequence proses approve (queue add → render PDF → kompresi → upload Backblaze → IPFS → update DB). Identifikasi waktu tunggu tiap tahap dengan log timestamp detail.
2. **Telemetry queue** – Perluas `PdfGenerationQueue.stats` dengan metrik rata-rata durasi, varian, dan bucket error per tahap. Simpan di logger + optional Prometheus endpoint agar antrian bisa dipantau real-time.
3. **Prioritas & batching** – Evaluasi kebutuhan prioritas (misal re-generate vs approval baru). Jika ada, terapkan dua queue: high-priority (single) dan bulk (throttled). Sedikan opsi batching IPFS/Backblaze jika API mendukung multi-upload.
4. **Pipeline tersegmentasi** – Pisahkan langkah berat (render, kompres) dari I/O (upload, hash). Gunakan worker async terpisah atau job queue (BullMQ) sehingga kegagalan upload tidak memblokir render berikutnya.
5. **Retry cerdas** – Terapkan retry granular: render dengan exponential backoff max 3x, upload Backblaze/IPFS dengan retry berbasis status code (retryable). Hindari retry penuh approval bila hanya satu sub-step gagal; simpan state parsial dan lanjutkan dari step gagal.
6. **Timeout & circuit breaker** – Sesuaikan timeout per tahap (render 10m, upload 2m, IPFS 1m) dan tambahkan circuit breaker khusus per layanan (Backblaze/IPFS) agar ketika vendor error, antrian berhenti sementara tanpa menguras resource lain.
7. **Resource guard** – Monitor konsumsi CPU/RAM saat Puppeteer berjalan banyak. Atur `maxConcurrent` queue berdasarkan metrik runtime (misal adaptif: 3 thread default, turunkan jika load tinggi). Pertimbangkan penggunaan pool browser reusable untuk mengurangi overhead launch.
8. **Persistensi status** – Simpan status job di tabel baru `PdfJob` (inspectionId, stage, attempts, lastError, payload) untuk memungkinkan resume/manual replay dan observasi via dashboard admin.
9. **Alerting** – Tambahkan notifikasi (Slack/email) ketika job gagal permanen, atau queue depth > X selama >Y menit. Gunakan hook dari logger atau integrasi langsung job queue.
10. **Testing & drill** – Buat skrip stress test untuk menyimulasikan approve bulk (50 inspeksi) dan ukur throughput. Lakukan failure drill (matikan koneksi Backblaze/IPFS) guna memastikan retry & circuit breaker bekerja sesuai desain.
11. **Langkah berikutnya**

- Tambahkan telemetry detail (langkah 2) untuk mengetahui bottleneck nyata.
- Rancang pemisahan pipeline & retry granular (langkah 4–5) sebelum refactor besar.
- Jalankan stress test setelah perubahan untuk memvalidasi peningkatan throughput dan stabilitas.

## Rencana Optimasi Queue Archive/Minting

1. **Audit proses minting** – Dokumentasikan alur lengkap `processToArchive` dan antrean `BlockchainMintingQueue`: mulai dari enqueue, build tx, submit, tunggu konfirmasi, update DB. Identifikasi titik di mana TX hash langsung disimpan.
2. **Telemetry detail** – Tambahkan metrik pada queue (waktu tunggu, jumlah retry, error per kategori seperti UTXO_BUSY, MempoolFull, NetworkTimeout). Log juga tx-hash sementara beserta slot/timestamp.
3. **UTXO management** – Implementasikan pre-check UTXO sebelum build tx (misal panggil endpoint balance/utxo Cardano node). Reservasi UTXO (lock) di DB sementara agar job lain tidak memakainya; rilis lock saat transaksi selesai/gagal.
4. **Retry strategis** – Kategorikan error menjadi retryable (misal UTXO_NOT_SPENT, Mempool full) dan fatal (invalid witness). Terapkan exponential backoff dengan jitter, batasi percobaan (misal 5x) sebelum menandai job gagal.
5. **Menunggu konfirmasi** – Setelah submit, panggil watcher yang menunggu konfirmasi block (n slot). Gunakan kombinasi polling node (`cardano-cli query`/GraphQL) atau webhook dari provider, dengan timeout wajar (misal 5 menit).
6. **Persistensi status job** – Simpan state minting di tabel `MintJob` (inspectionId, txHashSementara, state: QUEUED, SUBMITTED, CONFIRMED, FAILED, lastError, attempts). Update DB inspeksi hanya ketika state CONFIRMED.
7. **Tx hash sementara** – Lakukan commit tx hash ke DB hanya dalam state sementara (field `pendingTxHash`), pindahkan ke `txHash` final setelah watcher memastikan konfirmasi minimal 1-3 blok dan memastikan tx tidak orphan.
8. **Circuit breaker minting** – Jika kesalahan berturut-turut >N (misal 3) karena penyebab sama, hentikan sementara antrean dan kirim alert agar operator mengecek node/UTXO pool sebelum melanjutkan.
9. **Notifikasi & manual intervention** – Integrasikan alerting (Slack/email) ketika job status FAILED atau stuck di SUBMITTED > threshold (misal 10 menit). Sediakan CLI/manual command untuk melanjutkan/ulang job spesifik.
10. **Testing & drill** – Buat simulasi dengan jaringan testnet: jalankan bulk minting, injeksi error (habiskan UTXO, set node offline) untuk memverifikasi retry dan state machine. Pastikan data DB tetap konsisten ketika job gagal.
11. **Langkah berikutnya**

- Tambahkan telemetry & pencatatan status job (langkah 2 & 6) untuk mendapatkan visibilitas awal.
- Implementasikan penundaan commit tx hash hingga konfirmasi (langkah 5 & 7).
- Uji retry UTXO & circuit breaker pada lingkungan staging sebelum rilis produksi.

## Rencana Multipart Upload Backblaze PDF Besar

1. **Analisis batas ukuran** – Cek dokumentasi Backblaze B2: threshold multipart (>=200MB) dan batas part (100–5000). Identifikasi rata-rata size PDF dan pastikan logic memicu multipart hanya ketika ukuran > threshold (misal 100MB agar aman).
2. **API wrapper** – Review `BackblazeService.uploadPdfBuffer` untuk melihat apakah saat ini pakai single `b2_upload_file`. Rancang adapter baru `uploadPdfMultipart` yang memanfaatkan `b2_start_large_file`, `b2_get_upload_part_url`, `b2_upload_part`, dan `b2_finish_large_file`.
3. **Streaming buffer** – Implementasikan konversi Buffer → stream chunk (misal `Readable.from(buffer)` lalu pecah chunk by chunk). Pastikan chunk size minimal 5MB sesuai B2, default aman 10–50MB.
4. **Concurrency part upload** – Gunakan worker pool (Promise.all limited) untuk mengupload part paralel. Batasi concurrency agar tidak menabrak rate limit (misal 3–5 part bersamaan) dengan retry per part jika gagal.
5. **Checksum & part numbers** – Kalkulasi SHA1 per part seperti yang disyaratkan B2; simpan mapping partNumber → sha1, dan lanjutkan ke `b2_finish_large_file`. Log masing-masing part sehingga debugging mudah.
6. **Fallback ke single upload** – Jika buffer < threshold, tetap gunakan upload biasa tanpa overhead. Tulis helper `shouldUseMultipart(sizeMB)` agar mudah diuji.
7. **Error handling** – Tangani kegagalan pada part: retry part tersebut saja. Jika setelah beberapa kali tetap gagal, batalkan (`b2_cancel_large_file`) agar tidak meninggalkan upload zombie. Pastikan error diteruskan ke caller.
8. **Integrasi service** – Update `BackblazeService.uploadPdfBuffer` untuk memilih jalur multipart atau single. Pastikan signature tetap sama agar pemanggil tidak perlu berubah.
9. **Testing** – Buat unit test untuk helper `shouldUseMultipart`, dan integration test menggunakan mock B2 (atau test mode) yang mengupload buffer >200MB. Verifikasi part count, SHA1, dan bahwa file berhasil diunduh/valid.
10. **Monitoring & dokumentasi** – Tambahkan logging ukuran file, jumlah part, durasi upload. Dokumentasikan kebutuhan env (misal `BACKBLAZE_MULTIPART_THRESHOLD_MB`, `BACKBLAZE_MULTIPART_PART_SIZE_MB`).
11. **Langkah berikutnya**

- Tambahkan helper threshold & fallback (langkah 1 & 6) sebelum refactor besar.
- Implementasikan adapter multipart dan integrasikan ke `BackblazeService` (langkah 2–4, 8).
- Uji upload >200MB di staging untuk memastikan performa dan stabilitas.

## Rencana Migrasi Penyimpanan Foto ke Backblaze Cloud Storage

1. **Audit arsitektur saat ini** – Review implementasi upload foto: identifikasi semua titik di mana file disimpan (`InspectionsController.photoStorageConfig`, `PhotosService.addPhoto`), lokasi penyimpanan (`./uploads/inspection-photos`), dan bagaimana foto diakses (`ServeStaticModule` dengan `/uploads`). Catat dependensi pada path lokal dan alur pengunduhan/penyajian foto ke frontend.
2. **Setup BackblazeService** – Buat modul baru `backblaze` dengan service `BackblazeService` yang menyediakan method `uploadPhotoBuffer(buffer, filename, contentType)` menggunakan SDK Backblaze B2 (`backblaze-b2` atau `@backblaze/b2-sdk`). Konfigurasi koneksi (applicationKeyId, applicationKey, bucketId) via `ConfigService` dari env vars (`BACKBLAZE_APPLICATION_KEY_ID`, `BACKBLAZE_APPLICATION_KEY`, `BACKBLAZE_BUCKET_ID_PHOTOS`, `BACKBLAZE_BUCKET_NAME_PHOTOS`). Tambahkan retry mechanism dengan exponential backoff dan logging detail untuk observability.
3. **Strategi path & URL** – Tentukan struktur path di Backblaze (misal `inspection-photos/{inspectionId}/{filename}` atau `photos/{year}/{month}/{inspectionId}-{timestamp}-{hash}.{ext}`). Siapkan helper `getPhotoPublicUrl(fileId)` yang mengembalikan URL publik Backblaze atau signed URL (bila perlu akses terbatas). Pertimbangkan CDN endpoint jika tersedia untuk performa lebih baik.
4. **Refactor Multer storage** – Ganti `diskStorage` dengan `memoryStorage` di `InspectionsController.photoStorageConfig` agar file tidak disimpan lokal, melainkan di-memori untuk di-upload langsung ke Backblaze. Atau, gunakan custom storage engine yang membaca buffer dan langsung upload ke Backblaze tanpa menulis ke disk.
5. **Update PhotosService** – Modifikasi `addPhoto` dan `addMultiplePhotos` untuk mengupload buffer ke Backblaze sebelum menyimpan record DB. Simpan URL publik Backblaze atau fileId di field `path` (atau pertimbangkan field baru `backblazeFileId`/`publicUrl`). Tangani error upload: rollback DB jika upload gagal, dan pastikan cleanup buffer jika terjadi exception.
6. **Update metode delete & update** – Revisi `deletePhoto` untuk menghapus file dari Backblaze menggunakan `b2_delete_file_version`. Update `updatePhoto` agar menghapus foto lama dari Backblaze saat mengganti dengan foto baru. Pastikan error handling yang robust: log error namun jangan gagalkan operasi DB jika hanya delete Backblaze yang gagal (opsional: flag retry queue).
7. **Migrasi data existing** – Buat script migrasi (`migrate-photos-to-backblaze.ts` atau CLI command) yang membaca semua foto dari `./uploads/inspection-photos`, mengupload ke Backblaze, dan update field `path` di tabel `inspection_photos` dengan URL baru. Sertakan progress tracking, resume capability (skip foto sudah ter-upload), dan dry-run mode. Simpan mapping lokal ke cloud untuk audit trail.
8. **Perubahan endpoint akses foto** – Karena foto tidak lagi di-serve via `ServeStaticModule`, update semua endpoint/respons yang mengembalikan path foto agar menggunakan URL Backblaze. Pastikan `PhotoResponseDto.path` mengembalikan URL lengkap, bukan path relatif. Pertimbangkan endpoint proxy untuk foto private (misal `/api/v1/photos/:photoId/file`) yang mengunduh dari Backblaze dan forward ke client jika diperlukan autentikasi.
9. **Integrasi dengan PDF generation** – Review `generatePdfFromUrl` dan proses render PDF: pastikan URL foto Backblaze dapat diakses oleh Puppeteer untuk rendering. Jika perlu autentikasi, sediakan signed URL atau proxy internal. Uji end-to-end: upload foto → approve inspection → generate PDF untuk memastikan foto muncul dengan benar.
10. **Konfigurasi & environment** – Dokumentasikan env vars baru di `.env.example`: kredensial Backblaze, bucket name, URL base untuk foto publik. Update `docker-compose.yml` dan deployment script agar tidak lagi mount volume `uploads/inspection-photos` (atau buat opsional untuk backward compatibility). Sertakan instruksi setup Backblaze bucket dan IAM policy.
11. **Testing** – Tulis unit test untuk `BackblazeService.uploadPhotoBuffer` (mock B2 client), integration test untuk `PhotosService.addPhoto` dengan upload real ke bucket test, dan e2e test untuk flow lengkap upload → retrieve → delete. Sertakan test error handling (network failure, invalid credentials, bucket full). Tambahkan test untuk migrasi script dengan data sample.
12. **Rollout strategy** – Rencanakan deployment bertahap: (a) Deploy code baru dengan feature flag `USE_BACKBLAZE_PHOTOS` (default false), (b) Aktifkan di staging dan uji menyeluruh, (c) Jalankan migrasi data existing di staging, (d) Aktifkan di production dengan monitoring ketat, (e) Jalankan migrasi data production selama maintenance window, (f) Setelah semua foto ter-migrasi dan stabil, hapus kode local storage dan flag.
13. **Monitoring & observability** – Tambahkan metrik untuk upload success rate, latency upload, error rate per kategori (network, auth, quota), serta alert jika success rate < threshold (misal 95%). Log setiap operasi upload/delete dengan correlation ID untuk tracing. Buat dashboard Grafana untuk memantau penggunaan storage Backblaze (GB digunakan, jumlah file).
14. **Cleanup & dokumentasi** – Setelah migrasi selesai dan stabil (misal 1 bulan), hapus kode terkait local storage (diskStorage config, ServeStaticModule untuk uploads, script backup uploads lokal). Update dokumentasi API (Swagger) untuk menjelaskan bahwa path foto adalah URL Backblaze. Tulis runbook untuk troubleshooting masalah upload Backblaze dan prosedur manual rollback jika diperlukan.
15. **Langkah berikutnya**

- Setup BackblazeService dan konfigurasi dasar (langkah 2–3).
- Refactor upload flow dengan Multer memoryStorage dan integrasi BackblazeService (langkah 4–5).
- Buat script migrasi dan uji di staging sebelum rollout production (langkah 7, 11–12).

## Rencana Peningkatan Reliability Proyek

1. **Definisikan SLO & indikator** – Tetapkan metrik utama (latensi API inspeksi, tingkat kegagalan approve/archive, keberhasilan upload) beserta target SLO/SLI. Dokumentasikan di repo agar semua tim paham prioritas reliability.
2. **Observability terpadu** – Pasang tracing (OpenTelemetry) untuk alur inspeksi end-to-end, lengkapi log terstruktur (correlation id, inspectionId) dan metrik queue. Integrasikan dashboard (Grafana/Datadog) dan log aggregation.
3. **Alerting proaktif** – Buat alert berbasis SLO (error rate, backlog queue, PDF >100MB gagal). Sertakan eskalasi multi-level dan runbook penanganan.
4. **Hardening alur kritis** – Review semua flow approve/archive: tambahkan retry granular, idempotency key, serta circuit breaker per layanan eksternal (Backblaze, IPFS, Cardano node). Lengkapi fallback manual untuk operator.
5. **Testing berlapis** – Tingkatkan coverage unit/service untuk modul kritis, tambah contract test dengan back-end eksternal, serta e2e regression (CI) yang mensimulasikan approve → archive. Gunakan data seed agar test stabil.
6. **Chaos & load testing** – Jalankan chaos experiment (matikan Backblaze/IPFS sementara) dan load test bulk approve/mint untuk mengukur ketahanan. Catat bottleneck dan jadwalkan perbaikan.
7. **Deployment & rollback** – Terapkan strategi blue-green/rolling deployment, sertakan health check otomatis, dan prosedur rollback cepat. Dokumentasikan checklist sebelum rilis (env vars, migrasi, kredensial).
8. **Dependency management** – Audit versi puppeteer, prisma, SDK Backblaze, dan Cardano tooling secara berkala; uji upgrade di staging dan catat breaking change.
9. **Security & secrets** – Gunakan vault/secret manager terpusat, rotasi kredensial berkala, serta audit IAM Backblaze/IPFS. Tambahkan pemeriksaan lint/security di CI.
10. **Dokumentasi & pelatihan** – Susun runbook insiden, panduan debug queue, dan SOP oncall. Latih tim melalui drill triwulanan agar respon insiden konsisten.
11. **Langkah berikutnya**

- Tetapkan SLO awal dan konfigurasi dashboard/alert (langkah 1–3).
- Hardening alur approve/archive dengan retry & circuit breaker (langkah 4).
- Siapkan suite e2e + load test untuk mengukur baseline reliability (langkah 5–6).

## Rencana Implementasi Caching Redis

1. **Identifikasi kandidat cache** – Petakan endpoint dan service yang sering diakses atau berat (misal detail inspeksi, daftar kendaraan, metadata PDF). Tandai jenis data (read-mostly, expensive compute, external API call).
2. **Tentukan model data** – Pilih struktur key (misal `inspection:{id}:detail`, `customer:{id}:inspections`) dan TTL berbeda (misal detail 5 menit, metadata 1 jam). Gunakan prefix untuk memudahkan invalidasi.
3. **Setup koneksi** – Tambahkan konfigurasi `RedisModule` (NestJS) dengan pooling, retry strategy, dan koneksi TLS (jika perlu). Tambahkan env vars (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TTL_DEFAULT`).
4. **Cache layer service** – Buat util/helper `CacheService` yang menyediakan method `getOrSet`, `invalidate`, `invalidatePattern`. Gunakan JSON serialization aman (misal `safe-stable-stringify`).
5. **Integrasi low-latency reads** – Bungkus operasi read berat dengan `getOrSet`. Pastikan ada log cache hit/miss untuk observability. Pertimbangkan warmup job untuk data populer.
6. **Invalidasi & konsistensi** – Definisikan strategi invalidasi saat data berubah (misal ketika approve/update inspection). Implemen event listener atau publish/subscribe untuk men-trigger invalidasi.
7. **Fallback & circuit breaker** – Jika Redis down, pastikan service fallback ke DB/API tanpa memblokir. Tambahkan circuit breaker agar tidak terus mencoba koneksi gagal.
8. **Monitoring & metrics** – Tambahkan metrik hit/miss rate, latensi Redis, error count. Integrasikan ke dashboard; buat alert ketika error tinggi atau miss rate > target.
9. **Testing** – Tulis unit test untuk helper cache, integration test yang memverifikasi data tersimpan dan invalidasi berjalan. Tambahkan test chaos (matikan Redis) untuk memastikan fallback.
10. **Dokumentasi & rollout** – Dokumentasikan pola penggunaan cache, TTL default, prosedur flush, serta guardrails (data yang tidak boleh di-cache). Rencanakan rollout bertahap dimulai dari endpoint read-only.
11. **Langkah berikutnya**

- Setup koneksi Redis & helper cache (langkah 3–4).
- Terapkan caching di endpoint prioritas tinggi dan atur invalidasi (langkah 5–6).
- Monitoring hit/miss dan uji fallback sebelum memperluas ke data lain (langkah 8–9).

## Rencana Perbaikan Grafana & Prometheus

1. **Audit instalasi** – Review konfigurasi Prometheus (scrape targets, retention, storage) dan Grafana (datasource, folder dashboard). Catat error di log pod/service.
2. **Inventaris target & metric** – Pastikan semua service (Nest backend, queue, blockchain worker, Redis, Backblaze proxy) terekspos metric `/metrics`. Tambah service discovery/relabelling bila ada yang belum ter-scrape.
3. **Standarisasi naming & label** – Terapkan konvensi metric (`service`, `env`, `instance`). Refactor metric custom agar konsisten (misal `car_dano_pdf_queue_duration_seconds`). Hindari label cardinality tinggi.
4. **Recording & alert rules** – Buat recording rule untuk metrik mahal (p95 latency, error rate) dan definisikan alert rule align SLO (approve failure rate, queue backlog, minting errors). Simpan rule di repo dengan version control.
5. **Dashboards tematik** – Susun dashboard per domain: (a) API performance, (b) PDF pipeline (render, upload, hash), (c) Minting/Blockchain, (d) Infrastruktur (Redis, Postgres, host). Gunakan panel standar (stat, heatmap, exemplars).
6. **Alert routing & eskalasi** – Integrasikan Grafana Alerting atau Alertmanager dengan kanal Slack/email. Definisikan severity, oncall schedule, dan tambahkan link ke runbook.
7. **Security & akses** – Terapkan auth SSO/LDAP bila ada, set role read-only vs editor, audit API key. Pastikan Prometheus endpoint tidak publik.
8. **Backup & versioning** – Simpan dashboard JSON di repo, gunakan provisioning Grafana (`dashboards.yml`). Set backup untuk Prometheus TSDB (snapshot) dan Grafana database (SQLite/Postgres).
9. **Capacity & retention** – Hitung kebutuhan storage berdasarkan ingestion rate; set retention (misal 30d) dan remote-write bila perlu (Thanos/VictoriaMetrics). Monitor usage disk dan memori Prometheus.
10. **Dokumentasi & pelatihan** – Buat panduan menambah metric/alert, cara membaca dashboard, dan SOP incident response. Lakukan workshop singkat untuk tim.
11. **Langkah berikutnya**

- Audit instalasi dan inventaris target metric (langkah 1–2).
- Standarisasi metric dan tambahkan recording + alert rules utama (langkah 3–4).
- Susun dashboard kritikal dan integrasi alert routing (langkah 5–6).

## Rencana Implementasi Grafana Loki

1. **Tujuan & scope** – Tetapkan penggunaan Loki untuk agregasi log backend Nest, worker queue, dan cron. Identifikasi volume log harian dan retention yang dibutuhkan.
2. **Arsitektur** – Pilih mode deploy (single binary, distributed) sesuai skala. Tentukan komponen: Promtail/Fluent Bit sebagai agent, Loki sebagai store, Grafana sebagai frontend.
3. **Promtail konfigurasi** – Susun pipeline scrape file log (Nest, queue) dan syslog/docker. Tambah stage untuk label (`app`, `env`, `service`) serta parsing JSON log agar field seperti `inspectionId` terbaca.
4. **Retensi & storage** – Atur konfigurasi boltdb-shipper atau S3-compatible object storage. Definisikan retention per tenant (misal 30d) dan kebutuhan disk/cache.
5. **Index & label hygiene** – Batasi label cardinality tinggi (hanya `app`, `env`, `level`, `service`). Gunakan `replace`/`drop` stage untuk label dinamis seperti request id.
6. **Integrasi Grafana** – Tambah datasource Loki di Grafana, buat dashboard log search, panel kombinasi metric+log (exemplars). Simpan query favorit (log untuk approval failure, minting error).
7. **Alerting berbasis log** – Gunakan Grafana/Loki alert rule untuk mendeteksi pattern tertentu (error rate tinggi, kata kunci "UTXO" gagal). Integrasikan dengan kanal oncall.
8. **Security & multi-tenant** – Aktifkan auth reverse proxy atau Grafana auth; pisahkan tenant bila ada staging/prod. Pastikan TLS antar komponen bila di environment publik.
9. **Monitoring Loki** – Ekspos metric Loki/Promtail (`/metrics`) dan tambahkan dashboard resource usage (ingest rate, query latency). Set alert untuk backlog atau error tinggi.
10. **Testing & runbook** – Uji ingestion dengan log sample besar, validasi pencarian dan alert. Dokumentasikan runbook (restart promtail, menambah path log, troubleshoot ingestion).
11. **Langkah berikutnya**

- Tentukan arsitektur & konfigurasi promtail awal (langkah 2–3).
- Set retensi/storage dan label hygiene sebelum produksi (langkah 4–5).
- Integrasikan ke Grafana dengan alert berbasis log dan buat runbook (langkah 6–10).

## Rencana Standardisasi Dokumentasi & Swagger

1. **Audit dokumentasi** – Gunakan script untuk memindai module/service/controller yang belum memiliki komentar header, JSDoc, atau Swagger decorator. Buat checklist per file.
2. **Definisikan style guide** – Susun pedoman dokumentasi (format header comment, JSDoc, naming summary Swagger) agar konsisten dengan yang sudah ada. Sertakan contoh di `/docs/CONTRIBUTING.md`.
3. **Template komentar** – Siapkan snippet/comment template untuk service method (deskripsi, parameter, throw), serta controller (summary, response, param docs).
4. **Swagger coverage** – Pastikan setiap controller memiliki `@ApiTags`, `@ApiOperation`, `@ApiResponse` minimal 200/400/500, dan dekorator parameter/body sesuai DTO.
5. **Service & helper docs** – Tambahkan JSDoc pada method public penting di service dan util untuk menjelaskan side effect, return value, dan exception.
6. **DTO & entity** – Document field DTO dengan `@ApiProperty` (type, description, example) agar swagger schema jelas. Tambahkan komentar singkat untuk enum dan interface.
7. **Automasi lint** – Tambah lint rule/custom script yang menolak PR jika file baru tanpa dokumentasi (misal ESLint rule custom atau CI check yang mengecek coverage doc).
8. **Review & QA** – Lakukan peer review fokus dokumentasi untuk modul prioritas (inspections, blockchain, uploads). Gunakan checklist saat code review.
9. **Integrasi CI** – Sertakan pemeriksaan swagger build (misal `npm run swagger:check`) dan sematkan generasi dokumen ke artefak build.
10. **Pelatihan & update** – Sosialisasikan pedoman ke tim, lakukan sesi singkat cara menulis komentar/Swagger. Review berkala (misal triwulan) agar pedoman tetap relevan.
11. **Langkah berikutnya**

- Audit coverage dokumentasi dan siapkan style guide (langkah 1–2).
- Terapkan template komentar dan lengkapi Swagger pada modul prioritas (langkah 3–6).
- Tambah lint/CI guard agar standar dokumentasi terjaga (langkah 7–9).

## Operasional: Cron Backup DB Harian (PostgreSQL)

1. **Tujuan & cakupan** – Menyediakan backup database harian yang terotomasikan (via cron) dengan retensi terukur, logging, dan panduan pemulihan. Sumber DB: service `postgres` pada `docker-compose.yml` (container name `postgres_db`).
2. **Evaluasi skrip saat ini (`db-backup.sh`)** –
   - Sudah: mendump via `docker compose exec -T postgres pg_dumpall -U $POSTGRES_USER | gzip`, membuat direktori backup, validasi file, dan pembersihan retensi dasar (`find ... -mtime +RETENTION_DAYS`).
   - Catatan: default `BACKUP_DIR` masih `/backups` (absolute). Disarankan diarahkan ke direktori repo `./backups` untuk konsistensi; atau override via env saat cron.
   - Opsional perbaikan: baca `BACKUP_DIR` dan `RETENTION_DAYS` dari `.env` juga; atau ubah default ke `"$SCRIPT_DIR/backups"`. Dokumentasikan dengan jelas di header skrip.
3. **Direktori & izin** – Pastikan direktori `backups/` ada dan dapat ditulis user yang menjalankan cron.
   - Perintah: `mkdir -p /home/maul/Documents/CAR-dano/cardano-backend/backups && chmod 750 /home/maul/Documents/CAR-dano/cardano-backend/backups`
4. **Uji manual sekali** – Jalankan `BACKUP_DIR=/home/maul/Documents/CAR-dano/cardano-backend/backups RETENTION_DAYS=10 bash db-backup.sh` lalu verifikasi file `.sql.gz` terbentuk dan tidak kosong; catat ukuran file.
5. **Konfigurasi cron (harian 02:00)** – Tambahkan entri cron untuk user yang punya akses `docker` (mis. user `maul`).
   - `crontab -e`
   - Entri: `0 2 * * * BACKUP_DIR=/home/maul/Documents/CAR-dano/cardano-backend/backups RETENTION_DAYS=10 /bin/bash /home/maul/Documents/CAR-dano/cardano-backend/db-backup.sh >> /var/log/db-backup.log 2>&1`
   - Catatan: gunakan path absolut; pastikan user cron tergabung dalam grup `docker` atau jalankan via root bila diperlukan.
6. **Log & rotasi** – Siapkan rotasi untuk `/var/log/db-backup.log` agar tidak membesar.
   - Contoh `logrotate` (ops): `/etc/logrotate.d/db-backup` dengan isi: `/var/log/db-backup.log { weekly rotate 8 compress missingok notifempty copytruncate }`
7. **Retensi & housekeeping** – Terapkan `RETENTION_DAYS=10` (hapus otomatis arsip yang lebih lama dari 10 hari). Kebijakan dapat diubah sesuai kebutuhan bisnis; untuk retensi lebih panjang, pertimbangkan unggah backup mingguan/bulanan ke storage offsite (Backblaze B2 yang sudah tersedia) menggunakan job terpisah. Skrip sudah melakukan pembersihan otomatis via `find ... -mtime +$RETENTION_DAYS`.
8. **Monitoring ringan** –
   - Tambah pemeriksaan harian: cek file terbaru di `backups/` < 36 jam; kirim alert jika tidak ada. Bisa via script kecil yang dieksekusi oleh cron dan laporan ke Prometheus (textfile collector) atau email sederhana.
   - Alternatif: tambahkan `echo "backup_ok $(date +%s)"` ke file state untuk dipantau.
9. **Latihan pemulihan (restore drill)** – Secara berkala uji pemulihan di lingkungan staging:
   - Gunakan `restore-data.sh` atau jalankan `psql` terhadap dump untuk memastikan dump valid dan skema/data pulih dengan benar.
   - Dokumentasikan langkah dan estimasi waktu pemulihan.
10. **Keamanan** – Pastikan direktori backup tidak terekspos publik dan dikecualikan dari VCS. Pertimbangkan enkripsi at-rest (mis. `gpg`) jika backup dipindahkan ke media eksternal/cloud.
11. **Perbaikan skrip (opsional, PR terpisah)** –
   - Default `BACKUP_DIR` → `"$SCRIPT_DIR/backups"` agar tidak bergantung `/backups`.
   - Baca `BACKUP_DIR` dan `RETENTION_DAYS` dari `.env` (fallback ke env, lalu default).
   - Tambah flag CLI: `--db-only` (pakai `pg_dump $POSTGRES_DB`) vs `--all` (pakai `pg_dumpall`).
   - Exit code dan pesan error sudah baik; tambahkan ringkasan durasi eksekusi untuk observabilitas.
12. **Runbook singkat** –
   - Cek terakhir sukses: `ls -lt backups | head -n1` dan periksa timestamp/ukuran.
   - Jalankan manual: `BACKUP_DIR=... bash db-backup.sh` dan review `/var/log/db-backup.log`.
   - Pulihkan cepat: `docker compose exec -T postgres psql -U $POSTGRES_USER < backups/<file-terbaru>.sql.gz` (ingat: dekompresi dengan `gunzip -c`).
