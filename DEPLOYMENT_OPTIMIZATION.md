# ============================================
# DEPLOYMENT OPTIMIZATION GUIDE
# ============================================

## 🚀 Quick Wins (Implementasi Sekarang)

### 1. **Gunakan .dockerignore** (PALING PENTING)

Buat file `.dockerignore` untuk exclude file yang tidak perlu:

```
# .dockerignore
node_modules
dist
.git
.github
.env*
!.env.example
*.md
!README.md
.vscode
.idea
coverage
.nyc_output
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
uploads/*
!uploads/.gitkeep
pdfarchived/*
!pdfarchived/.gitkeep
```

**Impact**: Mengurangi context size dari ~500MB → ~50MB
**Speed**: Build 30-50% lebih cepat

---

### 2. **Enable BuildKit** (Docker Build Cache)

Di Coolify, tambahkan environment variable:

```bash
DOCKER_BUILDKIT=1
```

**Impact**: Parallel builds, better caching
**Speed**: Build 20-40% lebih cepat

---

### 3. **Suppress NPM Warnings**

Update `package.json`:

```json
{
  "scripts": {
    "build": "npm run build --loglevel=error",
    "postinstall": "npm run prisma:generate --silent"
  },
  "config": {
    "loglevel": "error"
  }
}
```

Atau di Dockerfile:

```dockerfile
RUN npm ci --silent --legacy-peer-deps
RUN npm run build --silent
```

**Impact**: Cleaner logs, faster terminal output
**Speed**: 5-10% lebih cepat (visual improvement)

---

## 🎯 Medium Impact (Implementasi Minggu Depan)

### 4. **Use pnpm Instead of npm**

pnpm lebih cepat dan hemat disk space:

```dockerfile
# Install pnpm
RUN npm install -g pnpm

# Use pnpm instead of npm
RUN pnpm install --frozen-lockfile
RUN pnpm build
```

**Impact**: 2-3x faster install, 50% less disk space
**Speed**: Build 30-50% lebih cepat

---

### 5. **Cache node_modules di Coolify**

Di Coolify settings, enable persistent volumes:

```yaml
volumes:
  - /var/lib/docker/volumes/cardano-backend-cache:/usr/src/app/.npm-cache
```

Lalu di Dockerfile:

```dockerfile
RUN npm config set cache /usr/src/app/.npm-cache --global
RUN npm ci --prefer-offline
```

**Impact**: Reuse downloaded packages
**Speed**: Subsequent builds 40-60% lebih cepat

---

### 6. **Optimize Prisma Generation**

Di `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "scripts": {
    "prisma:generate": "prisma generate --generator client"
  }
}
```

Di Dockerfile:

```dockerfile
# Only generate client, skip other generators
RUN npx prisma generate --generator client
```

**Impact**: Faster Prisma client generation
**Speed**: 10-15% lebih cepat

---

## 🔥 Advanced (Implementasi Bulan Depan)

### 7. **Use Turborepo/Nx for Monorepo**

Jika punya multiple services:

```bash
npm install -g turbo
```

**Impact**: Incremental builds, remote caching
**Speed**: Subsequent builds 70-90% lebih cepat

---

### 8. **Pre-built Base Images**

Buat custom base image dengan dependencies pre-installed:

```dockerfile
# base.Dockerfile
FROM node:22-alpine
RUN apk add --no-cache chromium nss freetype ...
# Push to registry
```

Lalu di main Dockerfile:

```dockerfile
FROM your-registry/cardano-base:latest
```

**Impact**: Skip dependency installation
**Speed**: Build 50-70% lebih cepat

---

### 9. **GitHub Actions Cache**

Jika deploy via GitHub Actions:

```yaml
- uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Impact**: Reuse dependencies across builds
**Speed**: 40-60% lebih cepat

---

## 📊 Expected Results

| Optimization | Current | After | Improvement |
|--------------|---------|-------|-------------|
| **Context Upload** | 500MB | 50MB | 90% faster |
| **Dependency Install** | 3-5 min | 1-2 min | 60% faster |
| **Build Time** | 2-3 min | 1 min | 50% faster |
| **Total Deploy** | 8-10 min | 3-4 min | 60% faster |

---

## ✅ Quick Action Plan (Hari Ini)

1. ✅ Buat `.dockerignore` file
2. ✅ Enable `DOCKER_BUILDKIT=1` di Coolify
3. ✅ Suppress npm warnings di Dockerfile
4. ✅ Test deployment

**Expected**: Deploy time dari 8-10 menit → 4-5 menit

---

## 🔧 Implementation Priority

**Priority 1 (Today):**
- [ ] Create `.dockerignore`
- [ ] Enable BuildKit
- [ ] Suppress npm warnings

**Priority 2 (This Week):**
- [ ] Switch to pnpm
- [ ] Enable npm cache volume

**Priority 3 (Next Month):**
- [ ] Create base image
- [ ] Setup remote cache

---

## 📝 Notes

- Coolify sudah support BuildKit by default (check di settings)
- npm warnings tidak mempengaruhi build, hanya visual
- Layer caching adalah kunci utama untuk speed
- Persistent volumes di Coolify sangat membantu untuk cache
