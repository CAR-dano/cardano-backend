# Panduan Logging (nestjs-pino)

## Ringkas
- Logger: nestjs-pino (JSON terstruktur; pretty-print di dev)
- Wrapper: `AppLogger` menjaga API `.log/.warn/.error/.verbose/.debug`
- Correlation: `x-request-id` otomatis via middleware; dibawa ke log
- Redaction: header sensitif, token, password, secret disensor
- Filter global: error terstruktur + respons disanitasi

## Env Vars Utama
```bash
# Level pino: error | warn | info | debug | trace
LOG_LEVEL=info
NODE_ENV=development # pretty-print non-prod
```

## Pemakaian di Code
Inject dan set context sekali di constructor:
```ts
import { AppLogger } from '../logging/app-logger.service';

@Injectable()
export class ExampleService {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(ExampleService.name);
  }
  doWork() {
    this.logger.log('start');     // => pino info
    this.logger.verbose('detail'); // => pino debug
    this.logger.warn('caution');
    this.logger.error('failed');
  }
}
```

Untuk controller/guard/strategy sama pola-nya: injeksi `AppLogger`, panggil `setContext()`.

## HTTP Access Log
Sudah global via `HttpLoggingInterceptor` dengan field: `requestId`, `method`, `url`, `statusCode`, `ms`, `userId`.

## Exception Filter
Global structured errors: body `{ statusCode, message, error, path, timestamp }`. Stack hanya di log, tidak dikirim ke klien.

## Audit Log
Gunakan `AuditLoggerService.log({ rid, actorId, action, resource, subjectId, result, ... })` untuk event sensitif.

## Output
- Dev: pretty-print; Prod: JSON line per event (siap dikirim ke ELK/Datadog/SIEM).

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
