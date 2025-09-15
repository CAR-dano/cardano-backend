# Panduan Konfigurasi Logging untuk CAR-dano Backend

## Overview

Aplikasi CAR-dano Backend sekarang telah dikonfigurasi dengan sistem logging yang fleksibel yang dapat dikontrol melalui environment variables. Anda dapat mengatur level log yang ingin ditampilkan di terminal sesuai kebutuhan.

## Konfigurasi Environment Variables

Tambahkan variabel berikut ke file `.env` Anda:

```bash
# Level logging (error, warn, info, debug, verbose)
LOG_LEVEL=info

# Enable/disable timestamp (true/false)
LOG_TIMESTAMP=true

# Enable/disable colors (true/false)
LOG_COLORS=true

# Environment mode
NODE_ENV=development
```

## Level Logging yang Tersedia

### 1. `error` - Hanya Error

Hanya menampilkan pesan error critical.

```bash
LOG_LEVEL=error
```

### 2. `warn` - Error + Warning

Menampilkan error dan peringatan.

```bash
LOG_LEVEL=warn
```

### 3. `info` - Error + Warning + Info (Default)

Menampilkan error, warning, dan informasi umum.

```bash
LOG_LEVEL=info
```

### 4. `debug` - Error + Warning + Info + Debug

Menampilkan semua level di atas plus debug information.

```bash
LOG_LEVEL=debug
```

### 5. `verbose` - Semua Level

Menampilkan semua level logging termasuk verbose.

```bash
LOG_LEVEL=verbose
```

## Contoh Penggunaan

### Untuk Production (Minimal Logging)

```bash
NODE_ENV=production
LOG_LEVEL=error
LOG_TIMESTAMP=true
LOG_COLORS=false
```

### Untuk Development (Debug)

```bash
NODE_ENV=development
LOG_LEVEL=debug
LOG_TIMESTAMP=true
LOG_COLORS=true
```

### Untuk Testing (Hanya Error)

```bash
NODE_ENV=test
LOG_LEVEL=error
LOG_TIMESTAMP=false
LOG_COLORS=false
```

## Penggunaan dalam Code

### Basic Logging

```typescript
import { Logger } from '@nestjs/common';

export class SomeService {
  private readonly logger = new Logger(SomeService.name);

  someMethod() {
    this.logger.log('Info message'); // Akan muncul jika LOG_LEVEL=info atau lebih
    this.logger.warn('Warning message'); // Akan muncul jika LOG_LEVEL=warn atau lebih
    this.logger.error('Error message'); // Akan muncul jika LOG_LEVEL=error atau lebih
    this.logger.debug('Debug message'); // Akan muncul jika LOG_LEVEL=debug atau lebih
    this.logger.verbose('Verbose message'); // Akan muncul jika LOG_LEVEL=verbose
  }
}
```

### Advanced Logging dengan Custom Service

```typescript
import { AppLoggerService } from '../common/services/app-logger.service';

export class SomeService {
  constructor(private readonly appLogger: AppLoggerService) {
    this.appLogger.setContext(SomeService.name);
  }

  someMethod() {
    // Basic logging
    this.appLogger.log('Operation started');

    // Structured logging dengan metadata
    this.appLogger.logWithMetadata('info', 'User action', {
      userId: '123',
      action: 'login',
      ip: '192.168.1.1',
    });

    // HTTP request logging
    this.appLogger.logHttpRequest('POST', '/api/v1/auth/login', 200, 150);

    // Database operation logging
    this.appLogger.logDatabaseOperation('SELECT', 'users', 25);
  }
}
```

## Testing Konfigurasi

Untuk menguji konfigurasi logging:

1. **Test dengan level error saja:**

   ```bash
   LOG_LEVEL=error npm run start:dev
   ```

2. **Test dengan level warning:**

   ```bash
   LOG_LEVEL=warn npm run start:dev
   ```

3. **Test dengan level debug:**
   ```bash
   LOG_LEVEL=debug npm run start:dev
   ```

## Output Examples

### LOG_LEVEL=error

```
[ApiGateway] 14/08/2025, 10:30:00 ERROR [Bootstrap - ApiGateway] Database connection failed
```

### LOG_LEVEL=warn

```
[ApiGateway] 14/08/2025, 10:30:00 ERROR [Bootstrap - ApiGateway] Database connection failed
[ApiGateway] 14/08/2025, 10:30:01 WARN [Bootstrap - ApiGateway] CLIENT_BASE_URL not set in .env
```

### LOG_LEVEL=info

```
[ApiGateway] 14/08/2025, 10:30:00 ERROR [Bootstrap - ApiGateway] Database connection failed
[ApiGateway] 14/08/2025, 10:30:01 WARN [Bootstrap - ApiGateway] CLIENT_BASE_URL not set in .env
[ApiGateway] 14/08/2025, 10:30:02 LOG [Bootstrap - ApiGateway] Logger initialized with levels: [error, warn, log]
[ApiGateway] 14/08/2025, 10:30:03 LOG [Bootstrap - ApiGateway] 🚀 API Gateway running on: http://localhost:3000/api/v1
```

### LOG_LEVEL=debug

```
[ApiGateway] 14/08/2025, 10:30:00 ERROR [Bootstrap - ApiGateway] Database connection failed
[ApiGateway] 14/08/2025, 10:30:01 WARN [Bootstrap - ApiGateway] CLIENT_BASE_URL not set in .env
[ApiGateway] 14/08/2025, 10:30:02 LOG [Bootstrap - ApiGateway] Logger initialized with levels: [error, warn, log, debug]
[ApiGateway] 14/08/2025, 10:30:03 LOG [Bootstrap - ApiGateway] 🚀 API Gateway running on: http://localhost:3000/api/v1
[ApiGateway] 14/08/2025, 10:30:04 DEBUG [Database] Connection established to PostgreSQL
[ApiGateway] 14/08/2025, 10:30:05 DEBUG [AuthGuard] JWT validation successful for user ID: 123
```

## Environment-specific Defaults

Aplikasi secara otomatis menggunakan default yang sesuai berdasarkan `NODE_ENV`:

- **Production**: `LOG_LEVEL=warn`, `LOG_COLORS=false`
- **Development**: `LOG_LEVEL=debug`, `LOG_COLORS=true`
- **Test**: `LOG_LEVEL=error`, `LOG_COLORS=false`

## Tips

1. **Untuk Production**: Gunakan `LOG_LEVEL=warn` atau `LOG_LEVEL=error` untuk performa yang lebih baik
2. **Untuk Development**: Gunakan `LOG_LEVEL=debug` untuk debugging yang lengkap
3. **Untuk CI/CD**: Gunakan `LOG_LEVEL=error` untuk output yang bersih
4. **Monitoring**: Level `warn` dan `error` sebaiknya diintegrasikan dengan monitoring tools
