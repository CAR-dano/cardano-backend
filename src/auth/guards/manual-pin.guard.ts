import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class ManualPinGuard implements CanActivate {
  private readonly logger = new Logger(ManualPinGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { pin } = request.body;

    if (!pin) {
      this.logger.error(
        'ManualPinGuard failed: No PIN provided in request body.',
      );
      throw new UnauthorizedException('PIN is required.');
    }

    const user = await this.authService.validateInspectorByPin(pin);

    if (!user) {
      this.logger.warn('ManualPinGuard validation failed: Invalid PIN.');
      throw new UnauthorizedException('Invalid credentials.');
    }
    request.user = user; // Attach user to the request object
    return true;
  }
}
