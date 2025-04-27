import { Test, TestingModule } from '@nestjs/testing';
import { ScalarDocsController } from './scalar-docs.controller';

describe('ScalarDocsController', () => {
  let controller: ScalarDocsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScalarDocsController],
    }).compile();

    controller = module.get<ScalarDocsController>(ScalarDocsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
