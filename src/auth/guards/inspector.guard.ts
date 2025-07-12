import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class InspectorGuard implements CanActivate {
  private readonly logger = new Logger(InspectorGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { pin, email } = request.body;

    if (!pin || !email) {
      this.logger.error(
        'InspectorGuard failed: PIN or email not provided in request body.',
      );
      throw new UnauthorizedException('PIN and email are required.');
    }

    const user = await this.authService.validateInspector(pin, email);

    if (!user) {
      this.logger.warn(
        'InspectorGuard validation failed: Invalid credentials.',
      );
      throw new UnauthorizedException('Invalid credentials.');
    }
    request.user = user; // Attach user to the request object
    return true;
  }
}
