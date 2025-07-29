import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { EmailModule } from 'src/email/email.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  controllers: [FileController],
  imports: [EmailModule, S3Module],
  providers: [FileService],
})
export class FileModule {}
