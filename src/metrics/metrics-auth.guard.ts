import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const metricsEnabled = process.env.METRICS_ENABLED;
    if (metricsEnabled && metricsEnabled.toLowerCase() === 'false') {
      throw new NotFoundException('Metrics endpoint is disabled');
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const bearerToken = process.env.METRICS_BEARER_TOKEN;
    const basicUser = process.env.METRICS_BASIC_AUTH_USER;
    const basicPassword = process.env.METRICS_BASIC_AUTH_PASSWORD;

    const hasBearer = Boolean(bearerToken);
    const hasBasic = Boolean(basicUser) && Boolean(basicPassword);

    if (!hasBearer && !hasBasic) {
      return !isProduction;
    }

    const authorization = this.getAuthorizationHeader(request.headers);
    if (!authorization) {
      return false;
    }

    if (hasBearer && this.isValidBearer(authorization, bearerToken as string)) {
      return true;
    }

    if (
      hasBasic &&
      this.isValidBasic(
        authorization,
        basicUser as string,
        basicPassword as string,
      )
    ) {
      return true;
    }

    return false;
  }

  private getAuthorizationHeader(
    headers?: Record<string, string | string[] | undefined>,
  ): string | undefined {
    if (!headers) {
      return undefined;
    }

    const value = headers.authorization;
    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  private isValidBearer(authorization: string, expectedToken: string): boolean {
    const [scheme, token] = authorization.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token === expectedToken;
  }

  private isValidBasic(
    authorization: string,
    expectedUser: string,
    expectedPassword: string,
  ): boolean {
    const [scheme, encoded] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'basic' || !encoded) {
      return false;
    }

    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const [user, ...rest] = decoded.split(':');
      const password = rest.join(':');

      return user === expectedUser && password === expectedPassword;
    } catch {
      return false;
    }
  }
}
