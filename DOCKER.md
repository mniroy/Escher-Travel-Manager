# Panduan Menjalankan Escher Travel Manager (100% Self-Hosted)

Aplikasi ini sekarang **100% Mandiri (Self-Hosted)**:
- ❌ Tidak memerlukan **Vercel**
- ❌ Tidak memerlukan **Supabase Cloud Database & Storage**
- ✅ Menggunakan **PostgreSQL Self-Hosted** via Docker Compose
- ✅ Menggunakan **Local File Uploads Storage** untuk dokumen dan tiket
- ✅ Menggunakan **WebSocket Real-time Live Sync** antar perangkat

---

## 📋 Persyaratan
- **Docker** & **Docker Compose** terpasang di komputer/server Anda.

---

## 🚀 Cara Menjalankan dengan Docker Compose (Sangat Mudah)

### 1. Buat File `.env`
Salin template konfigurasi:
```bash
cp .env.example .env
```

### 2. Isi API Keys di File `.env`
Buka file `.env` dan masukkan API keys Google Anda (hanya Google Maps & Gemini AI yang dibutuhkan):
```env
PORT=3000

# PostgreSQL Self-Hosted
POSTGRES_USER=escher
POSTGRES_PASSWORD=escherpassword
POSTGRES_DB=escher_travel

# Google Maps & Places (Untuk peta, pencarian tempat, dan optimasi rute)
GOOGLE_PLACES_API_KEY=your-google-places-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Google Gemini AI (Untuk scan tiket/dokumen otomatis)
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
```

### 3. Build & Jalankan Container
Jalankan perintah berikut:
```bash
docker compose up -d --build
```

Aplikasi dan PostgreSQL database akan otomatis dibuat dan diinisialisasi.
Akses aplikasi melalui browser di: `http://localhost:3000` (atau IP server Anda).

---

## 💾 Persistensi Data & Backup

Semua data tersimpan secara permanen pada Docker Volumes:
- `postgres_data`: Menyimpan seluruh data trips, events, itinerary, dan riwayat.
- `app_data`: Menyimpan file dokumen/tiket yang diunggah ke `/app/data/uploads`.

Data tetap aman dan tidak akan hilang meskipun container direstart atau diupdate.

---

## 🛠️ Perintah Docker yang Sering Digunakan

- **Melihat Status Container:**
  ```bash
  docker compose ps
  ```

- **Melihat Log Aplikasi & Database:**
  ```bash
  docker compose logs -f
  ```

- **Menghentikan Container:**
  ```bash
  docker compose down
  ```

- **Merestart Container:**
  ```bash
  docker compose restart
  ```

- **Update / Rebuild Versi Baru:**
  ```bash
  git pull
  docker compose up -d --build
  ```

---

## 📱 PWA & Sinkronisasi Multi-Device
- Buka `http://localhost:3000` di smartphone (Chrome di Android atau Safari di iOS).
- Pilih **"Add to Home Screen"** untuk menginstal sebagai aplikasi.
- Saat mengedit rencana perjalanan di satu HP, perubahan langsung tersinkronisasi otomatis ke HP lain melalui WebSocket backend!
