import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class FileService {
    constructor (private prisma: PrismaService) {}

    async saveFileMetadata(file: Express.Multer.File, userId: string, expiresAt?: string) {
        const expirationDate = expiresAt ? new Date(expiresAt) : (() => {
            const defaultExpiration = new Date();
            defaultExpiration.setDate(defaultExpiration.getDate() + 7);
            return defaultExpiration;
        })();
    
        const savedFile = await this.prisma.file.create({
            data: {
                filename: file.filename,
                url: `uploads/${file.filename}`,
                ownerId: userId,
                expiresAt: expirationDate,
            }
        });

        return { message: 'File uploaded successfully', file: savedFile };
    }

    async getFileById(id: string) {
        return this.prisma.file.findUnique({
            where: { id },
        });
    }

    async getFilesByUser(userId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            this.prisma.file.findMany({
                where: { ownerId: userId },
                select: {
                    id: true,
                    filename: true,
                    url: true,
                    createdAt: true,
                    expiresAt: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip,
                take: limit,
            }),
            this.prisma.file.count({
                where: { ownerId: userId },
            }),
        ]);
        
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            data: logs,
        };
    }

    async logFileAccess(fileId: string, ipAddress: string, userAgent: string) {
        return this.prisma.fileAccessLog.create({
            data: {
                fileId,
                ipAddress,
                userAgent,
            },
        });
    }

    async getAccessLogsByFileId(fileId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            this.prisma.fileAccessLog.findMany({
                where: { fileId },
                orderBy: { accessedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.fileAccessLog.count({
                where: { fileId },
            }),
        ]);

        return { data: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    
    async logFailedAccess(fileId: string, ipAddress: string, userAgent: string, reason: string) {
        return this.prisma.failedAccessLog.create({
            data: { fileId, ipAddress, userAgent, reason },
        });
    }

    async getFailedAccessLogsByFileId(fileId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            this.prisma.failedAccessLog.findMany({
                where: { fileId },
                orderBy: { accessedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.failedAccessLog.count({
                where: { fileId },
            }),
        ]);

        return {
            data: logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async deleteFile(fileId: string, userId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });

        if (!file) {
          throw new NotFoundException('File not found');
        }

        if (file.ownerId !== userId) {
          throw new ForbiddenException('You do not have permission to delete this file');
        }

        const filePath = join(__dirname, '..', '..', 'uploads', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        await this.prisma.file.delete({ where: { id: fileId } });
      
        return { message: 'File deleted successfully' };
    }

    async getFileLogs(fileId: string, userId: string, page = 1, limit = 10) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (!file) throw new NotFoundException('File not found');
        if (file.ownerId !== userId) throw new ForbiddenException('You do not have access to this file log');
      
        const skip = (page - 1) * limit;

        const [accessLogs, accessTotal] = await Promise.all([
            this.prisma.fileAccessLog.findMany({
                where: { fileId },
                orderBy: { accessedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.fileAccessLog.count({ where: { fileId } })
        ]);

        const [failedLogs, failedTotal] = await Promise.all([
            this.prisma.failedAccessLog.findMany({
                where: { fileId },
                orderBy: { accessedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.failedAccessLog.count({ where: { fileId } })
        ]);
      
        return {
            accessLogs: { total: accessTotal, page, limit, data: accessLogs },
            failedLogs: { total: failedTotal, page, limit, data: failedLogs }
        };
    }

    async getExpiredFiles() {
        return this.prisma.file.findMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
    }
    
    async permanentlyDeleteFile(fileId: string) {
        return this.prisma.file.delete({ where: { id: fileId } });
    }

    async bulkDeleteFiles(fileIds: string[]) {
        return this.prisma.file.deleteMany({
            where: { id: { in: fileIds } },
        });
    }
    
    async logFileDeletionFailure(fileId: string, fileName: string, reason: string) {
        return this.prisma.fileDeletionFailureLog.create({
          data: { fileId, fileName, reason },
        });
      }
}