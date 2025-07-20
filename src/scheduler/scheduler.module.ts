import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ScheduleModule } from '@nestjs/schedule';
import { FileService } from 'src/file/file.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [EmailModule, ScheduleModule.forRoot()],
  providers: [SchedulerService, FileService, PrismaService]
})
export class SchedulerModule {}
