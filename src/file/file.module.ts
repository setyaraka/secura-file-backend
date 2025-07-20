import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { EmailModule } from 'src/email/email.module';

@Module({
  controllers: [FileController],
  imports: [EmailModule],
  providers: [FileService],
})
export class FileModule {}
