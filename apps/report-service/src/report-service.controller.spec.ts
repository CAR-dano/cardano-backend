import { Test, TestingModule } from '@nestjs/testing';
import { ReportServiceController } from './report-service.controller';
import { ReportServiceService } from './report-service.service';

describe('ReportServiceController', () => {
  let reportServiceController: ReportServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ReportServiceController],
      providers: [ReportServiceService],
    }).compile();

    reportServiceController = app.get<ReportServiceController>(ReportServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(reportServiceController.getHello()).toBe('Hello World!');
    });
  });
});
