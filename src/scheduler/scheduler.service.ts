import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { join } from 'path';
import { FileService } from 'src/file/file.service';
import * as fs from 'fs/promises';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(private fileService: FileService) {}

    // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    @Cron('*/3 * * * *')
    async handleExpiredFiles() {
        this.logger.log('Running cleanup job for expired files...');
        const expiredFiles = await this.fileService.getExpiredFiles();
      
        const deletionResults = await Promise.allSettled(
          expiredFiles.map(async (file) => {
            const filePath = join(__dirname, '..', '..', 'uploads', file.filename);
      
            try {
              await fs.access(filePath);
              await fs.unlink(filePath);
              this.logger.log(`Deleted file from storage: ${file.filename}`);
      
              await this.fileService.permanentlyDeleteFile(file.id);
              this.logger.log(`Deleted file from database: ${file.filename}`);
            } catch (error) {
              this.logger.error(`Failed to delete file ${file.filename}: ${error.message}`);
      
              await this.fileService.logFileDeletionFailure(file.id, file.filename, error.message);
            }
          })
        );
      
        this.logger.log('Cleanup job completed.');
    }
}