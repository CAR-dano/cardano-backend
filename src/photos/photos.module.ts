import { Module } from '@nestjs/common';
import { PhotosService } from './photos.service';

@Module({
  controllers: [],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
