import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { EmailModule } from 'src/email/email.module';
import { S3Module } from 'src/s3/s3.module';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [FileController],
  imports: [
    EmailModule, 
    S3Module,
    HttpModule,
    CacheModule.register({
      isGlobal: false,
      ttl: 60
    })
  ],
  providers: [FileService],
})
export class FileModule {}
