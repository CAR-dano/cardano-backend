import { Module } from '@nestjs/common';
import { PublicUsersController } from './public-users.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PublicUsersController],
  providers: [],
})
export class PublicApiModule {}
