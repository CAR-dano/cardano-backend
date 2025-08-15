# 🛡️ Safe Deployment Guide

## ⚠️ CRITICAL: Data Safety First!

Semua deployment script telah dimodifikasi untuk melindungi data yang sudah ada. **TIDAK ADA** data yang akan hilang!

## 🔧 Script yang Tersedia

### 1. 🔍 Pre-Deployment Check

```bash
./pre-deploy-check.sh [environment]
```

- Melakukan semua pengecekan keamanan
- Membuat backup otomatis
- Memverifikasi konfigurasi
- **WAJIB dijalankan sebelum deploy!**

### 2. 💾 Manual Backup

```bash
./backup-data.sh [environment]
```

- Backup .env file
- Backup database PostgreSQL
- Backup directory uploads/
- Backup directory pdfarchived/

### 3. 🛡️ Restore Data

```bash
./restore-data.sh [backup_directory]
```

- Restore dari backup directory
- Membuat backup state saat ini sebelum restore
- Restore semua data dengan aman

### 4. 🚀 Safe Deployment Scripts

#### Production:

```bash
./pre-deploy-check.sh production    # Wajib!
./deploy-production.sh --confirm
```

#### Staging:

```bash
./pre-deploy-check.sh staging       # Wajib!
./deploy-staging.sh
```

## 🛡️ Perbedaan dengan Script Lama

### ❌ Script Lama (BERBAHAYA):

- Langsung copy `.env.production` → menimpa `.env` yang sudah ada
- `docker-compose down` → menghapus container dan data
- Tidak ada backup database
- Tidak ada pengecekan keamanan

### ✅ Script Baru (AMAN):

- **Backup otomatis** `.env` yang sudah ada
- **Graceful restart** dengan `docker-compose up -d` (tidak down dulu)
- **Backup database** otomatis sebelum deploy
- **Pengecekan keamanan** sebelum deploy
- **Tidak menimpa** file yang sudah ada
- **Membuat directory** jika belum ada, tidak menghapus yang sudah ada

## 🔐 Fitur Keamanan

### 1. **.env Protection**

- Backup otomatis dengan timestamp
- Tidak menimpa .env yang sudah ada
- Peringatan jika .env tidak ada

### 2. **Database Protection**

- Backup otomatis sebelum deployment
- Graceful restart (tidak menghapus data)
- Volume mapping yang aman

### 3. **Directory Protection**

- Hanya membuat directory jika belum ada
- Tidak menghapus directory yang sudah ada
- Preserve semua file di uploads/ dan pdfarchived/

### 4. **Deployment Protection**

- Pre-deployment checks wajib
- Confirmation prompt untuk production
- Automatic backup sebelum deploy

## 📋 Safe Deployment Checklist

### Sebelum Deploy:

- [ ] Jalankan `./pre-deploy-check.sh [environment]`
- [ ] Pastikan backup terbuat
- [ ] Verify .env file sudah benar
- [ ] Check disk space cukup
- [ ] Check semua service tidak crash

### Saat Deploy:

- [ ] Gunakan script yang baru (data-safe)
- [ ] Monitor log output
- [ ] Verify semua container up
- [ ] Test health endpoints

### Setelah Deploy:

- [ ] Test application berjalan normal
- [ ] Check monitoring dashboard
- [ ] Verify data masih utuh
- [ ] Test critical features

## 🚨 Emergency Procedures

### Jika Deploy Gagal:

```bash
# 1. Check container status
docker-compose ps

# 2. Check logs
docker-compose logs [service_name]

# 3. Restore dari backup jika perlu
./restore-data.sh ./backups/[backup_directory]
```

### Jika Data Hilang:

```bash
# List available backups
ls -la backups/

# Restore dari backup terakhir
./restore-data.sh ./backups/[latest_backup]
```

## 📊 Environment-Specific Configurations

### Production (`/home/maul/cardano-app/backend/`):

- Uploads: `/home/maul/cardano-app/backend/uploads`
- PDF: `/home/maul/cardano-app/backend/pdfarchived`
- Database: External PostgreSQL
- Monitoring: Port 9090, 3001

### Staging (`/home/maul/cardano-app/staging/`):

- Uploads: `/home/maul/cardano-app/staging/uploads`
- PDF: `/home/maul/cardano-app/staging/pdfarchived`
- Database: Staging PostgreSQL
- Monitoring: Port 9091, 3002

### Development (local):

- Uploads: `./uploads`
- PDF: `./pdfarchived`
- Database: Local PostgreSQL
- Monitoring: Port 9090, 3001

## 🔗 Quick Commands

```bash
# Full safe deployment production
./pre-deploy-check.sh production && ./deploy-production.sh --confirm

# Full safe deployment staging
./pre-deploy-check.sh staging && ./deploy-staging.sh

# Manual backup sebelum maintenance
./backup-data.sh maintenance

# Check semua service
docker-compose ps
docker-compose logs

# Monitor metrics
curl http://localhost:3010/api/v1/metrics
```

## ⚡ Emergency Contacts

Jika ada masalah critical:

1. Stop deployment: `Ctrl+C`
2. Check containers: `docker-compose ps`
3. Restore data: `./restore-data.sh [backup]`
4. Contact: Developer on duty

---

**🛡️ INGAT: Safety First! Selalu jalankan pre-deploy-check sebelum deployment apapun!**
