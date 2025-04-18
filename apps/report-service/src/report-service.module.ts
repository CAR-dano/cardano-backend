import { Module } from '@nestjs/common';
import { ReportServiceController } from './report-service.controller';
import { ReportServiceService } from './report-service.service';

@Module({
  imports: [],
  controllers: [ReportServiceController],
  providers: [ReportServiceService],
})
export class ReportServiceModule {}
