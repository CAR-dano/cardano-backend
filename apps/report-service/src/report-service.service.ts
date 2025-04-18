import { Injectable } from '@nestjs/common';

@Injectable()
export class ReportServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
