import { Module } from '@nestjs/common';
import { ScalarDocsController } from './scalar-docs.controller';

@Module({
  controllers: [ScalarDocsController],
})
export class ScalarDocsModule {}
