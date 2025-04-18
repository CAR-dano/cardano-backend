import { Controller, Get } from '@nestjs/common';
import { ReportServiceService } from './report-service.service';

@Controller()
export class ReportServiceController {
  constructor(private readonly reportServiceService: ReportServiceService) {}

  @Get()
  getHello(): string {
    return this.reportServiceService.getHello();
  }
}
