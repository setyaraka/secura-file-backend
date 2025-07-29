import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { EmailModule } from 'src/email/email.module';
import { S3Module } from 'src/s3/s3.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  controllers: [FileController],
  imports: [
    EmailModule, 
    S3Module,
    CacheModule.register({
      isGlobal: false,
      ttl: 60
    })
  ],
  providers: [FileService],
})
export class FileModule {}
