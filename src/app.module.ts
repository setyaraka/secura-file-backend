import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { FileModule } from './file/file.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EmailService } from './email/email.service';
import { EmailModule } from './email/email.module';
import { PreviewService } from './preview/preview.service';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [UserModule, AuthModule, 
    ConfigModule.forRoot({
      isGlobal: true
    }), FileModule, SchedulerModule, EmailModule, S3Module,
  ],
  controllers: [AppController],
  providers: [AppService, EmailService, PreviewService],
})
export class AppModule {}
