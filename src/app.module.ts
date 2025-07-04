import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { FileModule } from './file/file.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [UserModule, AuthModule, 
    ConfigModule.forRoot({
      isGlobal: true
    }), FileModule, SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
